const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { generateCode, newGuid } = require('../utils/generators');
const { computePurchaseCostPerBaseUnit, roundMoney, roundQty, toBaseQuantity } = require('../utils/units');
const { logAudit } = require('../utils/audit');

/**
 * Computes live Purchase Requirements across all non-deleted vegetables.
 *
 * Formula:
 *  - Total Confirmed Demand = SUM(oi.base_quantity - oi.delivered_base_quantity)
 *    for orders in ('CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED')
 *  - Current Stock = SUM(stock_movements.signed_quantity)
 *  - Allocated Stock = SUM(GREATEST(0, sa.allocated_base_quantity - sa.fulfilled_base_quantity))
 *    for active allocations on non-cancelled, non-delivered orders
 *  - Available Unallocated Stock = MAX(0, Current Stock - Allocated Stock)
 *  - Unallocated Demand = MAX(0, Total Confirmed Demand - Allocated Stock)
 *  - Purchase Shortage = MAX(0, Unallocated Demand - Available Unallocated Stock)
 */
async function getPurchaseRequirements(query = {}) {
  const { onlyShortages } = query;

  const [rows] = await pool.query(`
    SELECT
      v.id AS vegetable_id,
      v.name AS vegetable_name,
      v.sku,
      v.base_unit,
      v.unit AS default_unit,
      v.selling_price,
      v.min_stock_threshold,
      c.name AS category_name,

      COALESCE((
        SELECT SUM(GREATEST(0, oi.base_quantity - oi.delivered_base_quantity))
        FROM order_items oi
        JOIN customer_orders co ON co.id = oi.order_id
        WHERE oi.vegetable_id = v.id
          AND co.status IN ('CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED')
      ), 0) AS total_confirmed_demand,

      COALESCE((
        SELECT SUM(GREATEST(0, oi.base_quantity - oi.delivered_base_quantity))
        FROM order_items oi
        JOIN customer_orders co ON co.id = oi.order_id
        WHERE oi.vegetable_id = v.id
          AND co.status = 'PENDING'
      ), 0) AS pending_unconfirmed_demand,

      COALESCE((
        SELECT SUM(sm.signed_quantity)
        FROM stock_movements sm
        WHERE sm.vegetable_id = v.id
      ), 0) AS current_stock,

      COALESCE((
        SELECT SUM(GREATEST(0, sa.allocated_base_quantity - sa.fulfilled_base_quantity))
        FROM stock_allocations sa
        JOIN customer_orders co ON co.id = sa.order_id
        WHERE sa.vegetable_id = v.id
          AND sa.status IN ('ALLOCATED', 'PARTIALLY_FULFILLED')
          AND co.status NOT IN ('CANCELLED', 'DELIVERED')
      ), 0) AS allocated_stock,

      COALESCE((
        SELECT SUM(GREATEST(0, pi.base_quantity - pi.received_base_quantity))
        FROM purchase_items pi
        JOIN purchase_orders po ON po.id = pi.purchase_order_id
        WHERE pi.vegetable_id = v.id
          AND po.status IN ('ORDERED', 'PARTIALLY_RECEIVED')
      ), 0) AS incoming_po_stock,

      COALESCE((
        SELECT SUM(pi.received_base_quantity * pi.base_unit_cost) / NULLIF(SUM(pi.received_base_quantity), 0)
        FROM purchase_items pi
        JOIN purchase_orders po ON po.id = pi.purchase_order_id
        WHERE pi.vegetable_id = v.id
          AND po.status != 'CANCELLED'
          AND pi.received_base_quantity > 0
      ), 0) AS last_avg_cost

    FROM vegetables v
    JOIN vegetable_categories c ON c.id = v.category_id
    WHERE v.is_deleted = 0
    ORDER BY v.name ASC
  `);

  const requirements = rows
    .map((r) => {
      const totalConfirmedDemand = roundQty(r.total_confirmed_demand);
      const pendingUnconfirmedDemand = roundQty(r.pending_unconfirmed_demand);
      const currentStock = roundQty(r.current_stock);
      const allocatedStock = roundQty(r.allocated_stock);
      const availableUnallocatedStock = roundQty(Math.max(0, currentStock - allocatedStock));
      const unallocatedDemand = roundQty(Math.max(0, totalConfirmedDemand - allocatedStock));
      const purchaseShortage = roundQty(
        Math.max(0, unallocatedDemand - availableUnallocatedStock)
      );
      const incomingPoStock = roundQty(r.incoming_po_stock);
      const netShortageAfterIncoming = roundQty(Math.max(0, purchaseShortage - incomingPoStock));

      return {
        vegetable_id: r.vegetable_id,
        vegetable_name: r.vegetable_name,
        sku: r.sku,
        category_name: r.category_name,
        base_unit: r.base_unit,
        default_unit: r.default_unit,
        selling_price: Number(r.selling_price),
        last_avg_cost: roundMoney(r.last_avg_cost),
        total_confirmed_demand: totalConfirmedDemand,
        pending_unconfirmed_demand: pendingUnconfirmedDemand,
        current_stock: currentStock,
        allocated_stock: allocatedStock,
        available_unallocated_stock: availableUnallocatedStock,
        unallocated_demand: unallocatedDemand,
        purchase_shortage: purchaseShortage,
        incoming_po_stock: incomingPoStock,
        net_shortage_after_incoming: netShortageAfterIncoming,
      };
    })
    .filter((item) => {
      if (onlyShortages === 'true') {
        return item.purchase_shortage > 0;
      }
      return item.total_confirmed_demand > 0 || item.purchase_shortage > 0 || item.pending_unconfirmed_demand > 0;
    });

  return {
    items: requirements,
    summary: {
      totalItemsWithDemand: requirements.length,
      itemsRequiringPurchase: requirements.filter((i) => i.purchase_shortage > 0).length,
      totalShortageUnits: roundQty(
        requirements.reduce((sum, i) => sum + i.purchase_shortage, 0)
      ),
    },
  };
}

async function generatePurchaseOrderFromShortages(
  { supplierId, purchaseDate = null, supplierInvoiceRef = null, notes = null, items },
  actor,
  ipAddress = null
) {
  if (!supplierId || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Supplier and at least one purchase item are required.', 400);
  }

  return withTransaction(async (conn) => {
    const [sup] = await conn.query(
      'SELECT id, supplier_name FROM suppliers WHERE id = ? AND is_deleted = 0 AND status = "ACTIVE"',
      [supplierId]
    );
    if (sup.length === 0) {
      throw new AppError('Active supplier not found.', 404);
    }

    const purchaseNumber = generateCode('SKA-PO');
    const dateStr = purchaseDate || new Date().toISOString().slice(0, 10);

    let totalAmount = 0;
    const prepared = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError('Purchase quantity must be greater than zero.', 400);
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

    const poId = newGuid();
    await conn.query(
      `INSERT INTO purchase_orders (
        id, purchase_number, supplier_id, supplier_invoice_ref, purchase_date,
        status, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, 'ORDERED', ?, ?, ?)`,
      [
        poId,
        purchaseNumber,
        supplierId,
        supplierInvoiceRef,
        dateStr,
        totalAmount,
        notes || 'Generated from Purchase Requirement Shortage',
        actor.id,
      ]
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
        action: 'PO_GENERATED_FROM_REQUIREMENTS',
        entity: 'purchase_orders',
        entityId: poId,
        details: { purchaseNumber, supplierId, totalAmount, itemCount: prepared.length },
        ipAddress,
      },
      conn
    );

    const [created] = await conn.query('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    return created[0];
  });
}

module.exports = {
  getPurchaseRequirements,
  generatePurchaseOrderFromShortages,
};
