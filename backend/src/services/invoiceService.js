const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { generateCode, newGuid } = require('../utils/generators');
const { logAudit } = require('../utils/audit');
const { computeOrderPaymentStats } = require('./orderService');

async function generateInvoiceForOrder(orderId, { notes = null }, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [orderRows] = await conn.query(
      'SELECT * FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orderRows.length === 0) throw new AppError('Order not found.', 404);
    const order = orderRows[0];

    if (order.status === 'CANCELLED') {
      throw new AppError('Cannot issue an invoice for a cancelled order.', 400);
    }

    const [existingActive] = await conn.query(
      "SELECT id, invoice_number FROM invoices WHERE order_id = ? AND status = 'ISSUED' LIMIT 1",
      [orderId]
    );
    if (existingActive.length > 0) {
      throw new AppError(
        `An active invoice (${existingActive[0].invoice_number}) already exists for this order.`,
        409
      );
    }

    const stats = await computeOrderPaymentStats(orderId, conn);
    const invoiceNumber = generateCode('SKA-INV');
    const invoiceId = newGuid();

    await conn.query(
      `INSERT INTO invoices (
        id, invoice_number, order_id, customer_id, invoice_date,
        subtotal, discount_amount, total_amount, paid_amount, balance_due,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'ISSUED', ?, ?)`,
      [
        invoiceId,
        invoiceNumber,
        orderId,
        order.customer_id,
        order.subtotal,
        order.discount_amount,
        order.total_amount,
        stats.netPaid,
        stats.balanceDue,
        notes,
        actor.id,
      ]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'INVOICE_ISSUED',
        entity: 'invoices',
        entityId: invoiceId,
        details: { invoiceNumber, orderId, orderNumber: order.order_number, totalAmount: order.total_amount },
        ipAddress,
      },
      conn
    );

    return invoiceId;
  }).then((id) => getInvoiceById(id, actor));
}

async function cancelInvoice(invoiceId, { reason, status = 'CANCELLED' }, actor, ipAddress = null) {
  if (!['CANCELLED', 'CREDIT_NOTE'].includes(status)) {
    throw new AppError('Status must be CANCELLED or CREDIT_NOTE.', 400);
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    if (rows.length === 0) throw new AppError('Invoice not found.', 404);
    const inv = rows[0];
    if (inv.status !== 'ISSUED') {
      throw new AppError(`Invoice is already ${inv.status}.`, 400);
    }

    await conn.query(
      `UPDATE invoices
       SET status = ?, cancelled_reason = ?, cancelled_at = NOW()
       WHERE id = ?`,
      [status, reason || 'Cancelled by admin', invoiceId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: `INVOICE_${status}`,
        entity: 'invoices',
        entityId: invoiceId,
        details: { invoiceNumber: inv.invoice_number, reason },
        ipAddress,
      },
      conn
    );
  }).then(() => getInvoiceById(invoiceId, actor));
}

async function listInvoices(query, actor) {
  const { page, limit, offset } = parsePagination(query);
  const { search, status, dateFrom, dateTo } = query;

  const conditions = [];
  const params = [];

  if (actor.role === 'CUSTOMER') {
    conditions.push('i.customer_id = ?');
    params.push(actor.id);
  }
  if (status) {
    conditions.push('i.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(i.invoice_date) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(i.invoice_date) <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(i.invoice_number LIKE ? OR co.order_number LIKE ? OR u.full_name LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM invoices i
     JOIN customer_orders co ON co.id = i.order_id
     JOIN users u ON u.id = i.customer_id
     ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT i.*, co.order_number, u.full_name AS customer_name, u.mobile AS customer_mobile
     FROM invoices i
     JOIN customer_orders co ON co.id = i.order_id
     JOIN users u ON u.id = i.customer_id
     ${where}
     ORDER BY i.invoice_date DESC, i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function getInvoiceById(invoiceId, actor) {
  const [rows] = await pool.query(
    `SELECT i.* FROM invoices i WHERE i.id = ? LIMIT 1`,
    [invoiceId]
  );
  if (rows.length === 0) throw new AppError('Invoice not found.', 404);
  const invoice = rows[0];

  if (actor.role === 'CUSTOMER' && String(invoice.customer_id) !== String(actor.id)) {
    throw new AppError('Access denied.', 403);
  }

  const [orderRows] = await pool.query('SELECT * FROM customer_orders WHERE id = ?', [
    invoice.order_id,
  ]);
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC', [
    invoice.order_id,
  ]);
  const [customerRows] = await pool.query(
    'SELECT id, full_name, email, mobile FROM users WHERE id = ?',
    [invoice.customer_id]
  );
  const [companyRows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  const [payments] = await pool.query(
    'SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC',
    [invoice.order_id]
  );

  // Sync live payment stats on invoice view if still ISSUED
  const liveStats = await computeOrderPaymentStats(invoice.order_id);
  if (invoice.status === 'ISSUED' && liveStats) {
    invoice.paid_amount = liveStats.netPaid;
    invoice.balance_due = liveStats.balanceDue;
  }

  return {
    invoice,
    order: orderRows[0],
    items,
    customer: customerRows[0],
    company: companyRows[0] || null,
    payments,
  };
}

module.exports = {
  generateInvoiceForOrder,
  cancelInvoice,
  listInvoices,
  getInvoiceById,
};
