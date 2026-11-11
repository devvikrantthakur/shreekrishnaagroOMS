const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { generateCode, newGuid } = require('../utils/generators');
const { computeOrderLinePricing, roundMoney, roundQty } = require('../utils/units');
const { logAudit } = require('../utils/audit');

async function computeOrderPaymentStats(orderId, conn = pool) {
  const [orderRows] = await conn.query(
    'SELECT id, total_amount, status FROM customer_orders WHERE id = ? LIMIT 1',
    [orderId]
  );
  if (orderRows.length === 0) return null;
  const order = orderRows[0];

  const [payRows] = await conn.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments WHERE order_id = ? AND status = 'SUCCESS'`,
    [orderId]
  );
  const [refRows] = await conn.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_refunded
     FROM payment_refunds WHERE order_id = ? AND status = 'SUCCESS'`,
    [orderId]
  );

  const totalAmount = Number(order.total_amount);
  const totalPaid = Number(payRows[0].total_paid);
  const totalRefunded = Number(refRows[0].total_refunded);
  const netPaid = roundMoney(totalPaid - totalRefunded);
  const balanceDue =
    order.status === 'CANCELLED' ? 0 : roundMoney(Math.max(0, totalAmount - netPaid));

  let paymentStatus = 'UNPAID';
  if (order.status === 'CANCELLED') {
    paymentStatus = netPaid > 0 ? 'REFUND_PENDING' : 'CANCELLED';
  } else if (balanceDue <= 0 && totalAmount > 0) {
    paymentStatus = 'PAID';
  } else if (netPaid > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    totalAmount,
    totalPaid,
    totalRefunded,
    netPaid,
    balanceDue,
    paymentStatus,
  };
}

async function placeOrder(customerId, { addressId, discountAmount = 0, notes = null, items = null }, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    // Load delivery address
    const [addrRows] = await conn.query(
      'SELECT * FROM customer_addresses WHERE id = ? AND user_id = ? AND is_deleted = 0 LIMIT 1',
      [addressId, customerId]
    );
    if (addrRows.length === 0) {
      throw new AppError('Valid delivery address is required.', 400);
    }
    const address = addrRows[0];
    const addressSnapshot = {
      label: address.label,
      recipient_name: address.recipient_name,
      mobile: address.mobile,
      address_line1: address.address_line1,
      address_line2: address.address_line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
    };

    // Determine items: either explicit list (e.g. admin order) or customer's persistent cart
    let orderSourceItems = items;
    const usingCart = !orderSourceItems || orderSourceItems.length === 0;
    if (usingCart) {
      const [cartRows] = await conn.query(
        'SELECT vegetable_id, quantity, unit FROM cart_items WHERE user_id = ?',
        [customerId]
      );
      if (cartRows.length === 0) {
        throw new AppError('Your cart is empty.', 400);
      }
      orderSourceItems = cartRows.map((c) => ({
        vegetableId: c.vegetable_id,
        quantity: Number(c.quantity),
        unit: c.unit,
      }));
    }

    let subtotal = 0;
    const preparedItems = [];

    for (const reqItem of orderSourceItems) {
      const [vegRows] = await conn.query(
        'SELECT * FROM vegetables WHERE id = ? AND is_deleted = 0 AND status = "ACTIVE" LIMIT 1',
        [reqItem.vegetableId]
      );
      if (vegRows.length === 0) {
        throw new AppError(`Vegetable #${reqItem.vegetableId} is unavailable.`, 400);
      }
      const veg = vegRows[0];
      const pricing = computeOrderLinePricing(veg, reqItem.quantity, reqItem.unit);
      subtotal = roundMoney(subtotal + pricing.lineTotal);
      preparedItems.push({
        vegetableId: veg.id,
        name: veg.name,
        packSize: Number(veg.pack_size),
        sellingPrice: Number(veg.selling_price),
        ...pricing,
      });
    }

    const discount = roundMoney(Math.max(0, Number(discountAmount) || 0));
    if (discount > subtotal) {
      throw new AppError('Discount cannot exceed order subtotal.', 400);
    }
    const totalAmount = roundMoney(subtotal - discount);
    const orderNumber = generateCode('SKA-ORD');

    const orderId = newGuid();
    await conn.query(
      `INSERT INTO customer_orders (
        id, order_number, customer_id, address_id, delivery_address_snapshot,
        status, subtotal, discount_amount, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
      [
        orderId,
        orderNumber,
        customerId,
        addressId,
        JSON.stringify(addressSnapshot),
        subtotal,
        discount,
        totalAmount,
        notes,
        actor.id,
      ]
    );

    for (const item of preparedItems) {
      await conn.query(
        `INSERT INTO order_items (
          id, order_id, vegetable_id, vegetable_name_snapshot, quantity, unit,
          pack_size_snapshot, selling_price_snapshot, base_quantity, base_unit,
          delivered_base_quantity, base_unit_price, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.000, ?, ?)`,
        [
          newGuid(),
          orderId,
          item.vegetableId,
          item.name,
          item.quantity,
          item.unit,
          item.packSize,
          item.sellingPrice,
          item.baseQuantity,
          item.baseUnit,
          item.baseUnitPrice,
          item.lineTotal,
        ]
      );
    }

    if (usingCart) {
      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [customerId]);
    }

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'ORDER_CREATED',
        entity: 'customer_orders',
        entityId: orderId,
        details: { orderNumber, totalAmount, itemCount: preparedItems.length },
        ipAddress,
      },
      conn
    );

    return orderId;
  }).then((orderId) => getOrderById(orderId, actor));
}

async function listOrders(query, actor) {
  const { page, limit, offset } = parsePagination(query);
  const { search, status, customerId, dateFrom, dateTo, paymentStatus } = query;

  const conditions = [];
  const params = [];

  if (actor.role === 'CUSTOMER') {
    conditions.push('co.customer_id = ?');
    params.push(actor.id);
  } else if (customerId) {
    conditions.push('co.customer_id = ?');
    params.push(String(customerId));
  }

  if (status) {
    conditions.push('co.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(co.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(co.created_at) <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(co.order_number LIKE ? OR u.full_name LIKE ? OR u.mobile LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const paidSubquery = `
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = co.id AND p.status = 'SUCCESS'), 0)
    - COALESCE((SELECT SUM(pr.amount) FROM payment_refunds pr WHERE pr.order_id = co.id AND pr.status = 'SUCCESS'), 0)
  `;

  let having = '';
  const havingParams = [];
  if (paymentStatus === 'PAID') {
    having = 'HAVING balance_due <= 0 AND co.status != "CANCELLED"';
  } else if (paymentStatus === 'PARTIALLY_PAID') {
    having = 'HAVING net_paid > 0 AND balance_due > 0 AND co.status != "CANCELLED"';
  } else if (paymentStatus === 'UNPAID') {
    having = 'HAVING net_paid <= 0 AND co.status != "CANCELLED"';
  }

  const baseSelect = `
    SELECT co.id, co.order_number, co.customer_id, co.status, co.subtotal, co.discount_amount,
           co.total_amount, co.created_at, co.confirmed_at, co.delivered_at, co.cancelled_at,
           u.full_name AS customer_name, u.mobile AS customer_mobile, u.email AS customer_email,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = co.id) AS item_count,
           (${paidSubquery}) AS net_paid,
           CASE WHEN co.status = 'CANCELLED' THEN 0
                ELSE GREATEST(0, co.total_amount - (${paidSubquery}))
           END AS balance_due
    FROM customer_orders co
    JOIN users u ON u.id = co.customer_id
    ${where}
    ${having}
  `;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM (${baseSelect}) AS t`,
    [...params, ...havingParams]
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `${baseSelect} ORDER BY co.created_at DESC LIMIT ? OFFSET ?`,
    [...params, ...havingParams, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function getOrderById(orderId, actor) {
  const [rows] = await pool.query(
    `SELECT co.*, u.full_name AS customer_name, u.email AS customer_email, u.mobile AS customer_mobile
     FROM customer_orders co
     JOIN users u ON u.id = co.customer_id
     WHERE co.id = ? LIMIT 1`,
    [orderId]
  );
  if (rows.length === 0) {
    throw new AppError('Order not found.', 404);
  }
  const order = rows[0];
  if (actor.role === 'CUSTOMER' && String(order.customer_id) !== String(actor.id)) {
    throw new AppError('Access denied.', 403);
  }

  if (typeof order.delivery_address_snapshot === 'string') {
    order.delivery_address_snapshot = JSON.parse(order.delivery_address_snapshot);
  }

  const [items] = await pool.query(
    `SELECT oi.*, v.image_url, v.status AS vegetable_status,
            GREATEST(0, oi.base_quantity - oi.delivered_base_quantity) AS remaining_base_quantity,
            COALESCE(sa.allocated_base_quantity, 0) AS allocated_base_quantity,
            COALESCE(sa.fulfilled_base_quantity, 0) AS fulfilled_base_quantity,
            sa.status AS allocation_status,
            COALESCE((SELECT SUM(sm.signed_quantity) FROM stock_movements sm WHERE sm.vegetable_id = oi.vegetable_id), 0) AS current_stock
     FROM order_items oi
     JOIN vegetables v ON v.id = oi.vegetable_id
     LEFT JOIN stock_allocations sa ON sa.order_item_id = oi.id
     WHERE oi.order_id = ?
     ORDER BY oi.created_at ASC, oi.vegetable_name_snapshot ASC`,
    [orderId]
  );

  const [deliveries] = await pool.query(
    `SELECT d.*, u.full_name AS created_by_name
     FROM deliveries d
     LEFT JOIN users u ON u.id = d.created_by
     WHERE d.order_id = ?
     ORDER BY d.delivery_date DESC`,
    [orderId]
  );

  const [payments] = await pool.query(
    `SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC`,
    [orderId]
  );

  const [refunds] = await pool.query(
    `SELECT * FROM payment_refunds WHERE order_id = ? ORDER BY refund_date DESC`,
    [orderId]
  );

  const [invoices] = await pool.query(
    `SELECT * FROM invoices WHERE order_id = ? ORDER BY created_at DESC`,
    [orderId]
  );

  const paymentSummary = await computeOrderPaymentStats(orderId);

  return {
    ...order,
    items,
    deliveries,
    payments,
    refunds,
    invoices,
    paymentSummary,
  };
}

async function updateOrderStatus(orderId, { status, reason = null }, actor, ipAddress = null) {
  const allowedStatuses = ['CONFIRMED', 'PROCESSING', 'CANCELLED'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(`Cannot manually set status to ${status}. Use delivery workflow for deliveries.`, 400);
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT * FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (rows.length === 0) throw new AppError('Order not found.', 404);
    const order = rows[0];

    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      throw new AppError(`Cannot change status of a ${order.status} order.`, 400);
    }

    if (status === 'CANCELLED') {
      if (order.status === 'PARTIALLY_DELIVERED') {
        throw new AppError(
          'Cannot cancel a partially delivered order directly. Handle remaining items or refunds carefully.',
          400
        );
      }
      await conn.query(
        `UPDATE customer_orders
         SET status = 'CANCELLED', cancelled_reason = ?, cancelled_at = NOW()
         WHERE id = ?`,
        [reason || 'Cancelled by admin', orderId]
      );
      // Release unfulfilled stock allocations
      await conn.query(
        `UPDATE stock_allocations
         SET status = 'RELEASED'
         WHERE order_id = ? AND status IN ('ALLOCATED', 'PARTIALLY_FULFILLED')`,
        [orderId]
      );
    } else if (status === 'CONFIRMED') {
      if (order.status !== 'PENDING') {
        throw new AppError('Only PENDING orders can be confirmed.', 400);
      }
      await conn.query(
        `UPDATE customer_orders SET status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?`,
        [orderId]
      );
    } else if (status === 'PROCESSING') {
      if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
        throw new AppError('Only PENDING or CONFIRMED orders can move to PROCESSING.', 400);
      }
      await conn.query(
        `UPDATE customer_orders SET status = 'PROCESSING', confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?`,
        [orderId]
      );
    }

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: `ORDER_STATUS_${status}`,
        entity: 'customer_orders',
        entityId: orderId,
        details: { previousStatus: order.status, newStatus: status, reason },
        ipAddress,
      },
      conn
    );
  }).then(() => getOrderById(orderId, actor));
}

async function editOrderItems(orderId, { items, discountAmount }, actor, ipAddress = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one order item is required.', 400);
  }

  return withTransaction(async (conn) => {
    const [orderRows] = await conn.query(
      'SELECT * FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orderRows.length === 0) throw new AppError('Order not found.', 404);
    const order = orderRows[0];

    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new AppError(`Cannot edit items for ${order.status} order.`, 400);
    }

    const [delivRows] = await conn.query(
      'SELECT id FROM deliveries WHERE order_id = ? LIMIT 1',
      [orderId]
    );
    if (delivRows.length > 0) {
      throw new AppError('Cannot edit order items after deliveries have already been recorded.', 400);
    }

    // Release old allocations and delete old items
    await conn.query('DELETE FROM stock_allocations WHERE order_id = ?', [orderId]);

    const [oldItems] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const oldItemByVeg = new Map(oldItems.map((oi) => [String(oi.vegetable_id), oi]));

    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);

    let subtotal = 0;
    for (const reqItem of items) {
      const [vegRows] = await conn.query('SELECT * FROM vegetables WHERE id = ? AND is_deleted = 0', [
        reqItem.vegetableId,
      ]);
      if (vegRows.length === 0) {
        throw new AppError(`Vegetable #${reqItem.vegetableId} not found.`, 404);
      }
      const veg = vegRows[0];
      const existingSnapshot = oldItemByVeg.get(String(veg.id));
      // Preserve snapshot selling price if item existed and admin didn't override
      const effectiveVeg = existingSnapshot && reqItem.useCurrentPrice !== true
        ? {
            ...veg,
            unit: existingSnapshot.unit,
            pack_size: existingSnapshot.pack_size_snapshot,
            selling_price: existingSnapshot.selling_price_snapshot,
          }
        : veg;

      const pricing = computeOrderLinePricing(effectiveVeg, reqItem.quantity, reqItem.unit || veg.unit);
      subtotal = roundMoney(subtotal + pricing.lineTotal);

      await conn.query(
        `INSERT INTO order_items (
          id, order_id, vegetable_id, vegetable_name_snapshot, quantity, unit,
          pack_size_snapshot, selling_price_snapshot, base_quantity, base_unit,
          delivered_base_quantity, base_unit_price, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.000, ?, ?)`,
        [
          newGuid(),
          orderId,
          veg.id,
          veg.name,
          pricing.quantity,
          pricing.unit,
          Number(effectiveVeg.pack_size),
          Number(effectiveVeg.selling_price),
          pricing.baseQuantity,
          pricing.baseUnit,
          pricing.baseUnitPrice,
          pricing.lineTotal,
        ]
      );
    }

    const discount =
      discountAmount !== undefined
        ? roundMoney(Math.max(0, Number(discountAmount)))
        : Number(order.discount_amount);
    if (discount > subtotal) {
      throw new AppError('Discount cannot exceed subtotal.', 400);
    }
    const totalAmount = roundMoney(subtotal - discount);

    await conn.query(
      'UPDATE customer_orders SET subtotal = ?, discount_amount = ?, total_amount = ? WHERE id = ?',
      [subtotal, discount, totalAmount, orderId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'ORDER_ITEMS_EDITED',
        entity: 'customer_orders',
        entityId: orderId,
        details: { subtotal, discount, totalAmount, itemCount: items.length },
        ipAddress,
      },
      conn
    );
  }).then(() => getOrderById(orderId, actor));
}

async function allocateStockToOrder(orderId, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [orderRows] = await conn.query(
      'SELECT * FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    if (orderRows.length === 0) throw new AppError('Order not found.', 404);
    const order = orderRows[0];
    if (!['CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(order.status)) {
      throw new AppError('Stock can only be allocated to CONFIRMED, PROCESSING, or PARTIALLY_DELIVERED orders.', 400);
    }

    const [items] = await conn.query(
      'SELECT * FROM order_items WHERE order_id = ? FOR UPDATE',
      [orderId]
    );

    const allocationSummary = [];

    for (const item of items) {
      // Lock vegetable row to prevent concurrent over-allocation race conditions
      await conn.query('SELECT id FROM vegetables WHERE id = ? FOR UPDATE', [item.vegetable_id]);

      const [stockRows] = await conn.query(
        'SELECT COALESCE(SUM(signed_quantity), 0) AS current_stock FROM stock_movements WHERE vegetable_id = ?',
        [item.vegetable_id]
      );
      const currentStock = Number(stockRows[0].current_stock);

      const [allocRows] = await conn.query(
        `SELECT COALESCE(SUM(GREATEST(0, sa.allocated_base_quantity - sa.fulfilled_base_quantity)), 0) AS other_allocated
         FROM stock_allocations sa
         JOIN customer_orders co ON co.id = sa.order_id
         WHERE sa.vegetable_id = ?
           AND sa.order_item_id != ?
           AND sa.status IN ('ALLOCATED', 'PARTIALLY_FULFILLED')
           AND co.status NOT IN ('CANCELLED', 'DELIVERED')`,
        [item.vegetable_id, item.id]
      );
      const otherAllocated = Number(allocRows[0].other_allocated);
      const availableUnallocated = Math.max(0, roundQty(currentStock - otherAllocated));

      const remainingOrderNeed = Math.max(
        0,
        roundQty(Number(item.base_quantity) - Number(item.delivered_base_quantity))
      );

      // Desired total allocation for this item (fulfilled + newly reserved)
      const [existingAlloc] = await conn.query(
        'SELECT * FROM stock_allocations WHERE order_item_id = ? FOR UPDATE',
        [item.id]
      );

      const alreadyFulfilled = existingAlloc.length > 0 ? Number(existingAlloc[0].fulfilled_base_quantity) : Number(item.delivered_base_quantity);
      const canReserveNow = Math.min(remainingOrderNeed, availableUnallocated);
      const targetAllocatedTotal = roundQty(alreadyFulfilled + canReserveNow);

      const nextStatus =
        canReserveNow === 0 && alreadyFulfilled > 0
          ? 'FULFILLED'
          : alreadyFulfilled > 0 && canReserveNow > 0
          ? 'PARTIALLY_FULFILLED'
          : 'ALLOCATED';

      if (canReserveNow > 0 || existingAlloc.length > 0) {
        if (existingAlloc.length === 0) {
          await conn.query(
            `INSERT INTO stock_allocations (
              id, order_id, order_item_id, vegetable_id, allocated_base_quantity,
              fulfilled_base_quantity, base_unit, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newGuid(),
              orderId,
              item.id,
              item.vegetable_id,
              targetAllocatedTotal,
              alreadyFulfilled,
              item.base_unit,
              nextStatus,
            ]
          );
        } else {
          await conn.query(
            `UPDATE stock_allocations
             SET allocated_base_quantity = ?, fulfilled_base_quantity = ?, status = ?
             WHERE id = ?`,
            [targetAllocatedTotal, alreadyFulfilled, nextStatus, existingAlloc[0].id]
          );
        }
      }

      allocationSummary.push({
        vegetable_id: item.vegetable_id,
        vegetable_name: item.vegetable_name_snapshot,
        remaining_needed: remainingOrderNeed,
        allocated_remaining: canReserveNow,
        shortage: Math.max(0, roundQty(remainingOrderNeed - canReserveNow)),
        base_unit: item.base_unit,
      });
    }

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'ORDER_STOCK_ALLOCATED',
        entity: 'customer_orders',
        entityId: orderId,
        details: allocationSummary,
        ipAddress,
      },
      conn
    );

    return allocationSummary;
  });
}

module.exports = {
  computeOrderPaymentStats,
  placeOrder,
  listOrders,
  getOrderById,
  updateOrderStatus,
  editOrderItems,
  allocateStockToOrder,
};
