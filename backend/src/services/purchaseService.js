const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { generateCode, newGuid } = require('../utils/generators');
const {
  computePurchaseCostPerBaseUnit,
  roundMoney,
  roundQty,
  toBaseQuantity,
} = require('../utils/units');
const { logAudit } = require('../utils/audit');

async function listPurchases(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { search, supplierId, status, dateFrom, dateTo } = query;

  const conditions = [];
  const params = [];

  if (supplierId) {
    conditions.push('po.supplier_id = ?');
    params.push(String(supplierId));
  }
  if (status) {
    conditions.push('po.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('po.purchase_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('po.purchase_date <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(po.purchase_number LIKE ? OR po.supplier_invoice_ref LIKE ? OR s.supplier_name LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT po.*, s.supplier_name, s.mobile AS supplier_mobile,
            u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_order_id = po.id) AS item_count
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.created_by
     ${where}
     ORDER BY po.purchase_date DESC, po.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function getPurchaseById(id) {
  const [rows] = await pool.query(
    `SELECT po.*, s.supplier_name, s.contact_person, s.mobile AS supplier_mobile, s.address AS supplier_address
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.id = ? LIMIT 1`,
    [id]
  );
  if (rows.length === 0) throw new AppError('Purchase order not found.', 404);

  const [items] = await pool.query(
    `SELECT pi.*, v.name AS vegetable_name, v.sku,
            GREATEST(0, pi.ordered_quantity - pi.received_quantity) AS pending_quantity,
            GREATEST(0, pi.base_quantity - pi.received_base_quantity) AS pending_base_quantity
     FROM purchase_items pi
     JOIN vegetables v ON v.id = pi.vegetable_id
     WHERE pi.purchase_order_id = ?
     ORDER BY pi.created_at ASC`,
    [id]
  );

  const [payments] = await pool.query(
    `SELECT * FROM supplier_payments WHERE purchase_order_id = ? ORDER BY payment_date DESC`,
    [id]
  );

  return { ...rows[0], items, payments };
}

async function createPurchaseOrder(
  { supplierId, supplierInvoiceRef = null, purchaseDate, status = 'ORDERED', notes = null, items },
  actor,
  ipAddress = null
) {
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Supplier and at least one vegetable item are required.', 400);
  }
  if (!['DRAFT', 'ORDERED'].includes(status)) {
    throw new AppError('Initial purchase status must be DRAFT or ORDERED. Receive stock via the receive endpoint.', 400);
  }

  return withTransaction(async (conn) => {
    const [sup] = await conn.query(
      'SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0 AND status = "ACTIVE"',
      [supplierId]
    );
    if (sup.length === 0) throw new AppError('Active supplier not found.', 404);

    let totalAmount = 0;
    const prepared = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError('Item quantity must be greater than zero.', 400);
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new AppError('Unit cost cannot be negative.', 400);
      }

      const [vegRows] = await conn.query('SELECT * FROM vegetables WHERE id = ? AND is_deleted = 0', [
        item.vegetableId,
      ]);
      if (vegRows.length === 0) {
        throw new AppError(`Vegetable #${item.vegetableId} not found.`, 404);
      }
      const veg = vegRows[0];
      const unit = item.unit || veg.base_unit;
      const baseQty = toBaseQuantity(qty, unit, veg.base_unit);
      const baseUnitCost = computePurchaseCostPerBaseUnit(unitCost, unit, veg.base_unit);
      const lineTotal = roundMoney(qty * unitCost);
      totalAmount = roundMoney(totalAmount + lineTotal);

      prepared.push({
        vegetableId: veg.id,
        orderedQuantity: roundQty(qty),
        unit,
        baseQuantity: baseQty,
        baseUnit: veg.base_unit,
        unitCost: roundMoney(unitCost),
        baseUnitCost,
        lineTotal,
      });
    }

    const purchaseNumber = generateCode('SKA-PO');
    const poDate = purchaseDate || new Date().toISOString().slice(0, 10);

    const poId = newGuid();
    await conn.query(
      `INSERT INTO purchase_orders (
        id, purchase_number, supplier_id, supplier_invoice_ref, purchase_date,
        status, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [poId, purchaseNumber, supplierId, supplierInvoiceRef, poDate, status, totalAmount, notes, actor.id]
    );

    for (const p of prepared) {
      await conn.query(
        `INSERT INTO purchase_items (
          id, purchase_order_id, vegetable_id, ordered_quantity, received_quantity,
          unit, base_quantity, received_base_quantity, base_unit, unit_cost, base_unit_cost, line_total
        ) VALUES (?, ?, ?, ?, 0.000, ?, ?, 0.000, ?, ?, ?, ?)`,
        [
          newGuid(),
          poId,
          p.vegetableId,
          p.orderedQuantity,
          p.unit,
          p.baseQuantity,
          p.baseUnit,
          p.unitCost,
          p.baseUnitCost,
          p.lineTotal,
        ]
      );
    }

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'PURCHASE_ORDER_CREATED',
        entity: 'purchase_orders',
        entityId: poId,
        details: { purchaseNumber, supplierId, totalAmount },
        ipAddress,
      },
      conn
    );

    return poId;
  }).then((id) => getPurchaseById(id));
}

async function receivePurchaseOrder(
  poId,
  { items, supplierInvoiceRef = null, remarks = null },
  actor,
  ipAddress = null
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one received item quantity is required.', 400);
  }

  return withTransaction(async (conn) => {
    const [poRows] = await conn.query(
      'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
      [poId]
    );
    if (poRows.length === 0) throw new AppError('Purchase order not found.', 404);
    const po = poRows[0];

    if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
      throw new AppError(`Cannot receive stock for a ${po.status} purchase order.`, 400);
    }

    const [poItems] = await conn.query(
      'SELECT * FROM purchase_items WHERE purchase_order_id = ? FOR UPDATE',
      [poId]
    );
    const poItemMap = new Map(poItems.map((pi) => [String(pi.id), pi]));

    let anyReceived = false;

    for (const reqItem of items) {
      const qtyToReceive = Number(reqItem.receiveQuantity);
      if (!Number.isFinite(qtyToReceive) || qtyToReceive <= 0) {
        continue;
      }

      const pi = poItemMap.get(String(reqItem.purchaseItemId));
      if (!pi) {
        throw new AppError(`Purchase item #${reqItem.purchaseItemId} not found on this PO.`, 404);
      }

      const remainingQty = roundQty(Number(pi.ordered_quantity) - Number(pi.received_quantity));
      if (qtyToReceive > remainingQty + 0.0001) {
        throw new AppError(
          `Received quantity (${qtyToReceive}) exceeds remaining ordered quantity (${remainingQty} ${pi.unit}).`,
          400
        );
      }

      const receiveBaseQty = toBaseQuantity(qtyToReceive, pi.unit, pi.base_unit);

      // Lock vegetable row before inserting ledger movement
      await conn.query('SELECT id FROM vegetables WHERE id = ? FOR UPDATE', [pi.vegetable_id]);

      await conn.query(
        `UPDATE purchase_items
         SET received_quantity = received_quantity + ?,
             received_base_quantity = received_base_quantity + ?
         WHERE id = ?`,
        [roundQty(qtyToReceive), receiveBaseQty, pi.id]
      );

      await conn.query(
        `INSERT INTO stock_movements (
          id, vegetable_id, movement_type, quantity, signed_quantity, base_unit,
          unit_cost, reference_type, reference_id, movement_date, remarks, created_by
        ) VALUES (?, ?, 'PURCHASE_IN', ?, ?, ?, ?, 'PURCHASE_ORDER', ?, NOW(), ?, ?)`,
        [
          newGuid(),
          pi.vegetable_id,
          receiveBaseQty,
          receiveBaseQty,
          pi.base_unit,
          pi.base_unit_cost,
          poId,
          remarks || `Receipt against ${po.purchase_number}`,
          actor.id,
        ]
      );
      anyReceived = true;
    }

    if (!anyReceived) {
      throw new AppError('No positive quantities provided to receive.', 400);
    }

    // Re-evaluate overall PO receipt status
    const [updatedItems] = await conn.query(
      'SELECT ordered_quantity, received_quantity FROM purchase_items WHERE purchase_order_id = ?',
      [poId]
    );
    const allReceived = updatedItems.every(
      (i) => Number(i.received_quantity) >= Number(i.ordered_quantity) - 0.0001
    );
    const nextStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    await conn.query(
      `UPDATE purchase_orders
       SET status = ?, supplier_invoice_ref = COALESCE(?, supplier_invoice_ref)
       WHERE id = ?`,
      [nextStatus, supplierInvoiceRef, poId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'PURCHASE_RECEIVED',
        entity: 'purchase_orders',
        entityId: poId,
        details: { purchaseNumber: po.purchase_number, status: nextStatus, items },
        ipAddress,
      },
      conn
    );
  }).then(() => getPurchaseById(poId));
}

async function cancelPurchaseOrder(poId, { reason }, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [poRows] = await conn.query(
      'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
      [poId]
    );
    if (poRows.length === 0) throw new AppError('Purchase order not found.', 404);
    const po = poRows[0];

    if (po.status === 'CANCELLED') {
      throw new AppError('Purchase order is already cancelled.', 400);
    }

    const [poItems] = await conn.query(
      'SELECT * FROM purchase_items WHERE purchase_order_id = ? FOR UPDATE',
      [poId]
    );

    // Reverse any already-received stock movements safely
    for (const pi of poItems) {
      const receivedBase = roundQty(pi.received_base_quantity);
      if (receivedBase > 0) {
        await conn.query('SELECT id FROM vegetables WHERE id = ? FOR UPDATE', [pi.vegetable_id]);
        const [stockRows] = await conn.query(
          'SELECT COALESCE(SUM(signed_quantity), 0) AS current_stock FROM stock_movements WHERE vegetable_id = ?',
          [pi.vegetable_id]
        );
        const currentStock = roundQty(stockRows[0].current_stock);
        if (currentStock < receivedBase) {
          throw new AppError(
            `Cannot cancel purchase order: ${receivedBase} ${pi.base_unit} of vegetable #${pi.vegetable_id} was already received and partly consumed/delivered (current stock ${currentStock}).`,
            409
          );
        }

        await conn.query(
          `INSERT INTO stock_movements (
            id, vegetable_id, movement_type, quantity, signed_quantity, base_unit,
            unit_cost, reference_type, reference_id, movement_date, remarks, created_by
          ) VALUES (?, ?, 'REVERSAL', ?, ?, ?, ?, 'PURCHASE_ORDER_CANCEL', ?, NOW(), ?, ?)`,
          [
            newGuid(),
            pi.vegetable_id,
            receivedBase,
            -receivedBase,
            pi.base_unit,
            pi.base_unit_cost,
            poId,
            reason || `Reversal for cancelled PO ${po.purchase_number}`,
            actor.id,
          ]
        );
      }
    }

    await conn.query(
      `UPDATE purchase_orders
       SET status = 'CANCELLED', cancelled_reason = ?, cancelled_at = NOW()
       WHERE id = ?`,
      [reason || 'Cancelled by admin', poId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'PURCHASE_ORDER_CANCELLED',
        entity: 'purchase_orders',
        entityId: poId,
        details: { purchaseNumber: po.purchase_number, reason },
        ipAddress,
      },
      conn
    );
  }).then(() => getPurchaseById(poId));
}

async function recordSupplierPayment(
  { supplierId, purchaseOrderId = null, amount, paymentMethod, transactionRef = null, paymentDate = null, remarks = null },
  actor,
  ipAddress = null
) {
  const amt = roundMoney(amount);
  if (!supplierId || !Number.isFinite(amt) || amt <= 0) {
    throw new AppError('Supplier and a positive payment amount are required.', 400);
  }
  if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(paymentMethod)) {
    throw new AppError('Payment method must be CASH, UPI, or BANK_TRANSFER.', 400);
  }

  return withTransaction(async (conn) => {
    const [sup] = await conn.query('SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0', [
      supplierId,
    ]);
    if (sup.length === 0) throw new AppError('Supplier not found.', 404);

    if (purchaseOrderId) {
      const [po] = await conn.query(
        'SELECT id FROM purchase_orders WHERE id = ? AND supplier_id = ? AND status != "CANCELLED"',
        [purchaseOrderId, supplierId]
      );
      if (po.length === 0) {
        throw new AppError('Purchase order not found for this supplier.', 404);
      }
    }

    const paymentNumber = generateCode('SKA-SPAY');
    const pDate = paymentDate ? new Date(paymentDate) : new Date();
    const spId = newGuid();

    await conn.query(
      `INSERT INTO supplier_payments (
        id, payment_number, supplier_id, purchase_order_id, amount, payment_method,
        transaction_ref, payment_date, status, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?)`,
      [
        spId,
        paymentNumber,
        supplierId,
        purchaseOrderId || null,
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
        action: 'SUPPLIER_PAYMENT_RECORDED',
        entity: 'supplier_payments',
        entityId: spId,
        details: { paymentNumber, supplierId, amount: amt, paymentMethod },
        ipAddress,
      },
      conn
    );

    const [created] = await conn.query('SELECT * FROM supplier_payments WHERE id = ?', [spId]);
    return created[0];
  });
}

module.exports = {
  listPurchases,
  getPurchaseById,
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  recordSupplierPayment,
};
