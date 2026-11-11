const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { generateCode, newGuid } = require('../utils/generators');
const { roundQty, toBaseQuantity } = require('../utils/units');
const { logAudit } = require('../utils/audit');

async function getDeliveryQueue() {
  const [orders] = await pool.query(`
    SELECT co.id, co.order_number, co.status, co.delivery_address_snapshot, co.created_at,
           u.id AS customer_id, u.full_name AS customer_name, u.mobile AS customer_mobile
    FROM customer_orders co
    JOIN users u ON u.id = co.customer_id
    WHERE co.status IN ('CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED')
    ORDER BY co.created_at ASC
  `);

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT oi.*, v.name AS vegetable_name,
            GREATEST(0, oi.base_quantity - oi.delivered_base_quantity) AS remaining_base_quantity,
            COALESCE((SELECT SUM(sm.signed_quantity) FROM stock_movements sm WHERE sm.vegetable_id = oi.vegetable_id), 0) AS current_stock
     FROM order_items oi
     JOIN vegetables v ON v.id = oi.vegetable_id
     WHERE oi.order_id IN (?)
       AND oi.base_quantity > oi.delivered_base_quantity
     ORDER BY oi.created_at ASC`,
    [orderIds]
  );

  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  return orders
    .map((o) => ({
      ...o,
      delivery_address_snapshot:
        typeof o.delivery_address_snapshot === 'string'
          ? JSON.parse(o.delivery_address_snapshot)
          : o.delivery_address_snapshot,
      pending_items: itemsByOrder.get(o.id) || [],
    }))
    .filter((o) => o.pending_items.length > 0);
}

async function listDeliveries(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { orderId, search, dateFrom, dateTo } = query;

  const conditions = [];
  const params = [];

  if (orderId) {
    conditions.push('d.order_id = ?');
    params.push(String(orderId));
  }
  if (dateFrom) {
    conditions.push('DATE(d.delivery_date) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(d.delivery_date) <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(d.delivery_number LIKE ? OR co.order_number LIKE ? OR u.full_name LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM deliveries d
     JOIN customer_orders co ON co.id = d.order_id
     JOIN users u ON u.id = co.customer_id
     ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT d.*, co.order_number, u.full_name AS customer_name, u.mobile AS customer_mobile,
            cb.full_name AS created_by_name,
            (SELECT COUNT(*) FROM delivery_items di WHERE di.delivery_id = d.id) AS item_count
     FROM deliveries d
     JOIN customer_orders co ON co.id = d.order_id
     JOIN users u ON u.id = co.customer_id
     LEFT JOIN users cb ON cb.id = d.created_by
     ${where}
     ORDER BY d.delivery_date DESC, d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function getDeliveryById(id) {
  const [rows] = await pool.query(
    `SELECT d.*, co.order_number, co.delivery_address_snapshot,
            u.full_name AS customer_name, u.mobile AS customer_mobile
     FROM deliveries d
     JOIN customer_orders co ON co.id = d.order_id
     JOIN users u ON u.id = co.customer_id
     WHERE d.id = ? LIMIT 1`,
    [id]
  );
  if (rows.length === 0) throw new AppError('Delivery not found.', 404);

  const delivery = rows[0];
  if (typeof delivery.delivery_address_snapshot === 'string') {
    delivery.delivery_address_snapshot = JSON.parse(delivery.delivery_address_snapshot);
  }

  const [items] = await pool.query(
    `SELECT di.*, v.name AS vegetable_name, oi.base_quantity AS ordered_base_quantity,
            oi.delivered_base_quantity AS total_delivered_base_quantity
     FROM delivery_items di
     JOIN vegetables v ON v.id = di.vegetable_id
     JOIN order_items oi ON oi.id = di.order_item_id
     WHERE di.delivery_id = ?`,
    [id]
  );

  return { ...delivery, items };
}

async function createDelivery(
  { orderId, deliveryDate = null, driverName = null, driverPhone = null, notes = null, items },
  actor,
  ipAddress = null
) {
  if (!orderId || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Order ID and at least one delivered item quantity are required.', 400);
  }

  return withTransaction(async (conn) => {
    const [orderRows] = await conn.query(
      'SELECT * FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orderRows.length === 0) throw new AppError('Order not found.', 404);
    const order = orderRows[0];

    if (!['CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(order.status)) {
      throw new AppError(
        `Deliveries can only be recorded for CONFIRMED, PROCESSING, or PARTIALLY_DELIVERED orders (current: ${order.status}).`,
        400
      );
    }

    const [orderItems] = await conn.query(
      'SELECT * FROM order_items WHERE order_id = ? FOR UPDATE',
      [orderId]
    );
    const orderItemMap = new Map(orderItems.map((oi) => [String(oi.id), oi]));

    const deliveryNumber = generateCode('SKA-DEL');
    const delivDate = deliveryDate ? new Date(deliveryDate) : new Date();
    const deliveryId = newGuid();

    await conn.query(
      `INSERT INTO deliveries (
        id, delivery_number, order_id, delivery_date, status, driver_name, driver_phone, notes, created_by
      ) VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)`,
      [deliveryId, deliveryNumber, orderId, delivDate, driverName, driverPhone, notes, actor.id]
    );

    let anyDelivered = false;

    for (const reqItem of items) {
      const qtyDelivered = Number(reqItem.deliverQuantity);
      if (!Number.isFinite(qtyDelivered) || qtyDelivered <= 0) {
        continue;
      }

      const oi = orderItemMap.get(String(reqItem.orderItemId));
      if (!oi) {
        throw new AppError(`Order item #${reqItem.orderItemId} does not belong to this order.`, 404);
      }

      const unit = reqItem.unit || oi.base_unit;
      const deliveredBase = toBaseQuantity(qtyDelivered, unit, oi.base_unit);
      const remainingBase = roundQty(Number(oi.base_quantity) - Number(oi.delivered_base_quantity));

      if (deliveredBase > remainingBase + 0.0001) {
        throw new AppError(
          `Delivered quantity (${deliveredBase} ${oi.base_unit}) for ${oi.vegetable_name_snapshot} exceeds remaining ordered quantity (${remainingBase} ${oi.base_unit}).`,
          400
        );
      }

      // Lock vegetable and verify current stock
      await conn.query('SELECT id FROM vegetables WHERE id = ? FOR UPDATE', [oi.vegetable_id]);
      const [stockRows] = await conn.query(
        'SELECT COALESCE(SUM(signed_quantity), 0) AS current_stock FROM stock_movements WHERE vegetable_id = ?',
        [oi.vegetable_id]
      );
      const currentStock = roundQty(stockRows[0].current_stock);
      if (currentStock < deliveredBase - 0.0001) {
        throw new AppError(
          `Insufficient stock for ${oi.vegetable_name_snapshot}. Available: ${currentStock} ${oi.base_unit}, requested delivery: ${deliveredBase} ${oi.base_unit}.`,
          400
        );
      }

      await conn.query(
        `INSERT INTO delivery_items (
          id, delivery_id, order_item_id, vegetable_id, delivered_quantity,
          unit, delivered_base_quantity, base_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newGuid(),
          deliveryId,
          oi.id,
          oi.vegetable_id,
          roundQty(qtyDelivered),
          unit,
          deliveredBase,
          oi.base_unit,
        ]
      );

      await conn.query(
        `INSERT INTO stock_movements (
          id, vegetable_id, movement_type, quantity, signed_quantity, base_unit,
          reference_type, reference_id, movement_date, remarks, created_by
        ) VALUES (?, ?, 'DELIVERY_OUT', ?, ?, ?, 'DELIVERY', ?, ?, ?, ?)`,
        [
          newGuid(),
          oi.vegetable_id,
          deliveredBase,
          -deliveredBase,
          oi.base_unit,
          deliveryId,
          delivDate,
          `Delivery ${deliveryNumber} for ${order.order_number}`,
          actor.id,
        ]
      );

      const newDeliveredBase = roundQty(Number(oi.delivered_base_quantity) + deliveredBase);
      await conn.query(
        'UPDATE order_items SET delivered_base_quantity = ? WHERE id = ?',
        [newDeliveredBase, oi.id]
      );
      oi.delivered_base_quantity = newDeliveredBase;

      // Update stock allocation if present
      const [allocRows] = await conn.query(
        'SELECT * FROM stock_allocations WHERE order_item_id = ? FOR UPDATE',
        [oi.id]
      );
      if (allocRows.length > 0) {
        const alloc = allocRows[0];
        const nextFulfilled = Math.min(
          Number(alloc.allocated_base_quantity),
          roundQty(Number(alloc.fulfilled_base_quantity) + deliveredBase)
        );
        const allocStatus =
          newDeliveredBase >= Number(oi.base_quantity) - 0.0001 ||
          nextFulfilled >= Number(alloc.allocated_base_quantity) - 0.0001
            ? 'FULFILLED'
            : 'PARTIALLY_FULFILLED';

        await conn.query(
          'UPDATE stock_allocations SET fulfilled_base_quantity = ?, status = ? WHERE id = ?',
          [nextFulfilled, allocStatus, alloc.id]
        );
      }

      anyDelivered = true;
    }

    if (!anyDelivered) {
      throw new AppError('At least one item must have a positive delivery quantity.', 400);
    }

    const allDone = orderItems.every(
      (oi) => Number(oi.delivered_base_quantity) >= Number(oi.base_quantity) - 0.0001
    );
    const nextOrderStatus = allDone ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
    const delivStatus = allDone ? 'COMPLETED' : 'PARTIAL';

    await conn.query('UPDATE deliveries SET status = ? WHERE id = ?', [delivStatus, deliveryId]);
    await conn.query(
      `UPDATE customer_orders
       SET status = ?, delivered_at = CASE WHEN ? = 'DELIVERED' THEN NOW() ELSE delivered_at END
       WHERE id = ?`,
      [nextOrderStatus, nextOrderStatus, orderId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'DELIVERY_RECORDED',
        entity: 'deliveries',
        entityId: deliveryId,
        details: {
          deliveryNumber,
          orderId,
          orderNumber: order.order_number,
          orderStatus: nextOrderStatus,
        },
        ipAddress,
      },
      conn
    );

    return deliveryId;
  }).then((id) => getDeliveryById(id));
}

module.exports = {
  getDeliveryQueue,
  listDeliveries,
  getDeliveryById,
  createDelivery,
};
