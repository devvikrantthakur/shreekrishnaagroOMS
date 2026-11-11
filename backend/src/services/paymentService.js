const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { generateCode, newGuid } = require('../utils/generators');
const { roundMoney } = require('../utils/units');
const { logAudit } = require('../utils/audit');
const { computeOrderPaymentStats } = require('./orderService');

async function recordPayment(
  { orderId, amount, paymentMethod, transactionRef = null, paymentDate = null, remarks = null },
  actor,
  ipAddress = null
) {
  const amt = roundMoney(amount);
  if (!orderId || !Number.isFinite(amt) || amt <= 0) {
    throw new AppError('Order ID and a positive payment amount are required.', 400);
  }
  if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(paymentMethod)) {
    throw new AppError('Payment method must be CASH, UPI, or BANK_TRANSFER.', 400);
  }

  return withTransaction(async (conn) => {
    const [orderRows] = await conn.query(
      'SELECT * FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orderRows.length === 0) throw new AppError('Order not found.', 404);
    const order = orderRows[0];

    if (actor.role === 'CUSTOMER' && String(order.customer_id) !== String(actor.id)) {
      throw new AppError('Access denied: you can only pay for your own orders.', 403);
    }
    if (order.status === 'CANCELLED') {
      throw new AppError('Cannot accept payments for a cancelled order.', 400);
    }

    const stats = await computeOrderPaymentStats(orderId, conn);
    if (amt > stats.balanceDue + 0.01) {
      throw new AppError(
        `Payment amount (Rs. ${amt.toFixed(2)}) exceeds outstanding balance due (Rs. ${stats.balanceDue.toFixed(2)}).`,
        400
      );
    }

    const paymentNumber = generateCode('SKA-PAY');
    const pDate = paymentDate ? new Date(paymentDate) : new Date();
    const paymentId = newGuid();

    await conn.query(
      `INSERT INTO payments (
        id, payment_number, order_id, customer_id, amount, payment_method,
        transaction_ref, payment_date, status, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?)`,
      [
        paymentId,
        paymentNumber,
        orderId,
        order.customer_id,
        amt,
        paymentMethod,
        transactionRef,
        pDate,
        remarks,
        actor.id,
      ]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'PAYMENT_RECORDED',
        entity: 'payments',
        entityId: paymentId,
        details: { paymentNumber, orderId, orderNumber: order.order_number, amount: amt, paymentMethod },
        ipAddress,
      },
      conn
    );

    const [created] = await conn.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    const updatedStats = await computeOrderPaymentStats(orderId, conn);
    return { payment: created[0], orderPaymentSummary: updatedStats };
  });
}

async function createRefund(
  { paymentId, amount, refundMethod, transactionRef = null, reason },
  actor,
  ipAddress = null
) {
  const amt = roundMoney(amount);
  if (!paymentId || !Number.isFinite(amt) || amt <= 0 || !reason || !reason.trim()) {
    throw new AppError('Payment ID, positive refund amount, and reason are required.', 400);
  }
  if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(refundMethod)) {
    throw new AppError('Refund method must be CASH, UPI, or BANK_TRANSFER.', 400);
  }

  return withTransaction(async (conn) => {
    const [payRows] = await conn.query(
      'SELECT * FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    if (payRows.length === 0) throw new AppError('Payment not found.', 404);
    const payment = payRows[0];

    if (payment.status !== 'SUCCESS') {
      throw new AppError('Refunds can only be issued against SUCCESS payments.', 400);
    }

    const [refSum] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS already_refunded
       FROM payment_refunds
       WHERE payment_id = ? AND status = 'SUCCESS'`,
      [paymentId]
    );
    const alreadyRefunded = Number(refSum[0].already_refunded);
    const maxRefundable = roundMoney(Number(payment.amount) - alreadyRefunded);

    if (amt > maxRefundable + 0.01) {
      throw new AppError(
        `Refund amount exceeds remaining refundable balance (Rs. ${maxRefundable.toFixed(2)}).`,
        400
      );
    }

    const refundNumber = generateCode('SKA-REF');
    const refundId = newGuid();
    await conn.query(
      `INSERT INTO payment_refunds (
        id, refund_number, payment_id, order_id, customer_id, amount,
        refund_method, transaction_ref, refund_date, reason, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'SUCCESS', ?)`,
      [
        refundId,
        refundNumber,
        paymentId,
        payment.order_id,
        payment.customer_id,
        amt,
        refundMethod,
        transactionRef,
        reason.trim(),
        actor.id,
      ]
    );

    if (roundMoney(alreadyRefunded + amt) >= Number(payment.amount)) {
      await conn.query("UPDATE payments SET status = 'REVERSED' WHERE id = ?", [paymentId]);
    }

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'PAYMENT_REFUNDED',
        entity: 'payment_refunds',
        entityId: refundId,
        details: { refundNumber, paymentId, orderId: payment.order_id, amount: amt, reason },
        ipAddress,
      },
      conn
    );

    const [created] = await conn.query('SELECT * FROM payment_refunds WHERE id = ?', [refundId]);
    return created[0];
  });
}

async function listPayments(query, actor) {
  const { page, limit, offset } = parsePagination(query);
  const { orderId, method, status, search, dateFrom, dateTo } = query;

  const conditions = [];
  const params = [];

  if (actor.role === 'CUSTOMER') {
    conditions.push('p.customer_id = ?');
    params.push(actor.id);
  }
  if (orderId) {
    conditions.push('p.order_id = ?');
    params.push(String(orderId));
  }
  if (method) {
    conditions.push('p.payment_method = ?');
    params.push(method);
  }
  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(p.payment_date) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(p.payment_date) <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push(
      '(p.payment_number LIKE ? OR p.transaction_ref LIKE ? OR co.order_number LIKE ? OR u.full_name LIKE ?)'
    );
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM payments p
     JOIN customer_orders co ON co.id = p.order_id
     JOIN users u ON u.id = p.customer_id
     ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT p.*, co.order_number, co.total_amount AS order_total,
            u.full_name AS customer_name, u.mobile AS customer_mobile,
            COALESCE((SELECT SUM(pr.amount) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status = 'SUCCESS'), 0) AS refunded_amount
     FROM payments p
     JOIN customer_orders co ON co.id = p.order_id
     JOIN users u ON u.id = p.customer_id
     ${where}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

module.exports = {
  recordPayment,
  createRefund,
  listPayments,
};
