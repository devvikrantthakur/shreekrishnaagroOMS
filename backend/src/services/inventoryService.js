const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { toBaseQuantity, roundMoney, roundQty } = require('../utils/units');
const { logAudit } = require('../utils/audit');
const { newGuid } = require('../utils/generators');

async function getInventorySummary(query = {}) {
  const { search, lowStockOnly } = query;
  const conditions = ['v.is_deleted = 0'];
  const params = [];

  if (search) {
    conditions.push('(v.name LIKE ? OR v.sku LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  const [rows] = await pool.query(
    `SELECT v.id AS vegetable_id, v.name, v.sku, v.base_unit, v.unit, v.selling_price,
            v.min_stock_threshold, v.status, c.name AS category_name,
            COALESCE((SELECT SUM(sm.signed_quantity) FROM stock_movements sm WHERE sm.vegetable_id = v.id), 0) AS current_stock,
            COALESCE((
              SELECT SUM(GREATEST(0, sa.allocated_base_quantity - sa.fulfilled_base_quantity))
              FROM stock_allocations sa
              JOIN customer_orders co ON co.id = sa.order_id
              WHERE sa.vegetable_id = v.id
                AND sa.status IN ('ALLOCATED', 'PARTIALLY_FULFILLED')
                AND co.status NOT IN ('CANCELLED', 'DELIVERED')
            ), 0) AS reserved_stock,
            COALESCE((
              SELECT SUM(pi.received_base_quantity * pi.base_unit_cost) / NULLIF(SUM(pi.received_base_quantity), 0)
              FROM purchase_items pi
              JOIN purchase_orders po ON po.id = pi.purchase_order_id
              WHERE pi.vegetable_id = v.id
                AND po.status != 'CANCELLED'
                AND pi.received_base_quantity > 0
            ), 0) AS weighted_avg_cost
     FROM vegetables v
     JOIN vegetable_categories c ON c.id = v.category_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY v.name ASC`,
    params
  );

  let items = rows.map((r) => {
    const currentStock = roundQty(r.current_stock);
    const reservedStock = roundQty(r.reserved_stock);
    const availableStock = roundQty(Math.max(0, currentStock - reservedStock));
    const weightedAvgCost = roundMoney(r.weighted_avg_cost);
    const inventoryValue = roundMoney(Math.max(0, currentStock) * weightedAvgCost);
    const isLowStock = availableStock <= Number(r.min_stock_threshold);

    return {
      ...r,
      current_stock: currentStock,
      reserved_stock: reservedStock,
      available_stock: availableStock,
      weighted_avg_cost: weightedAvgCost,
      inventory_value: inventoryValue,
      is_low_stock: isLowStock,
    };
  });

  if (lowStockOnly === 'true') {
    items = items.filter((i) => i.is_low_stock);
  }

  return items;
}

async function getStockMovements(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { vegetableId, movementType, dateFrom, dateTo } = query;

  const conditions = [];
  const params = [];

  if (vegetableId) {
    conditions.push('sm.vegetable_id = ?');
    params.push(String(vegetableId));
  }
  if (movementType) {
    conditions.push('sm.movement_type = ?');
    params.push(movementType);
  }
  if (dateFrom) {
    conditions.push('DATE(sm.movement_date) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(sm.movement_date) <= ?');
    params.push(dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM stock_movements sm ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT sm.*, v.name AS vegetable_name, v.sku, u.full_name AS created_by_name
     FROM stock_movements sm
     JOIN vegetables v ON v.id = sm.vegetable_id
     LEFT JOIN users u ON u.id = sm.created_by
     ${where}
     ORDER BY sm.movement_date DESC, sm.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function createStockAdjustment(
  { vegetableId, movementType, quantity, unit, remarks },
  actor,
  ipAddress = null
) {
  const allowedTypes = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN'];
  if (!allowedTypes.includes(movementType)) {
    throw new AppError(
      'Manual adjustment movementType must be ADJUSTMENT_IN, ADJUSTMENT_OUT, or RETURN_IN.',
      400
    );
  }
  if (!remarks || !remarks.trim()) {
    throw new AppError('Remarks are required for stock adjustments.', 400);
  }

  return withTransaction(async (conn) => {
    const [vegRows] = await conn.query(
      'SELECT * FROM vegetables WHERE id = ? AND is_deleted = 0 FOR UPDATE',
      [vegetableId]
    );
    if (vegRows.length === 0) {
      throw new AppError('Vegetable not found.', 404);
    }
    const veg = vegRows[0];
    const chosenUnit = unit || veg.base_unit;
    const baseQty = toBaseQuantity(quantity, chosenUnit, veg.base_unit);

    const [stockRows] = await conn.query(
      'SELECT COALESCE(SUM(signed_quantity), 0) AS current_stock FROM stock_movements WHERE vegetable_id = ?',
      [vegetableId]
    );
    const currentStock = roundQty(stockRows[0].current_stock);

    const signedQty = movementType === 'ADJUSTMENT_OUT' ? -baseQty : baseQty;
    if (movementType === 'ADJUSTMENT_OUT' && currentStock - baseQty < 0) {
      throw new AppError(
        `Insufficient stock for outward adjustment. Current stock: ${currentStock} ${veg.base_unit}.`,
        400
      );
    }

    const movementId = newGuid();
    await conn.query(
      `INSERT INTO stock_movements (
        id, vegetable_id, movement_type, quantity, signed_quantity, base_unit,
        reference_type, reference_id, movement_date, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'MANUAL_ADJUSTMENT', NULL, NOW(), ?, ?)`,
      [movementId, vegetableId, movementType, baseQty, signedQty, veg.base_unit, remarks.trim(), actor.id]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'STOCK_ADJUSTMENT',
        entity: 'stock_movements',
        entityId: movementId,
        details: {
          vegetableId,
          vegetableName: veg.name,
          movementType,
          baseQty,
          baseUnit: veg.base_unit,
          remarks,
        },
        ipAddress,
      },
      conn
    );

    const [created] = await conn.query('SELECT * FROM stock_movements WHERE id = ?', [movementId]);
    return created[0];
  });
}

module.exports = {
  getInventorySummary,
  getStockMovements,
  createStockAdjustment,
};
