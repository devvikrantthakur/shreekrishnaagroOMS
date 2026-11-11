const { pool } = require('../config/db');
const { roundMoney, roundQty } = require('../utils/units');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { getPurchaseRequirements } = require('./purchaseRequirementService');
const { getInventorySummary } = require('./inventoryService');

async function getWeightedAvgCostMap() {
  const [rows] = await pool.query(`
    SELECT pi.vegetable_id,
           COALESCE(
             SUM(pi.received_base_quantity * pi.base_unit_cost) / NULLIF(SUM(pi.received_base_quantity), 0),
             0
           ) AS weighted_avg_cost
    FROM purchase_items pi
    JOIN purchase_orders po ON po.id = pi.purchase_order_id
    WHERE po.status != 'CANCELLED' AND pi.received_base_quantity > 0
    GROUP BY pi.vegetable_id
  `);
  const map = new Map();
  for (const r of rows) {
    map.set(String(r.vegetable_id), Number(r.weighted_avg_cost));
  }
  return map;
}

function buildDateFilter(column, startDate, endDate, params) {
  const parts = [];
  if (startDate) {
    parts.push(`DATE(${column}) >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    parts.push(`DATE(${column}) <= ?`);
    params.push(endDate);
  }
  return parts;
}

async function computeProfitAndLoss({ startDate, endDate } = {}) {
  const costMap = await getWeightedAvgCostMap();

  const delivConditions = ["co.status != 'CANCELLED'"];
  const delivParams = [];
  delivConditions.push(...buildDateFilter('d.delivery_date', startDate, endDate, delivParams));

  const [deliveredRows] = await pool.query(
    `SELECT di.vegetable_id, v.name AS vegetable_name, di.base_unit,
            di.delivered_base_quantity, oi.base_unit_price,
            co.subtotal AS order_subtotal, co.discount_amount AS order_discount
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     JOIN order_items oi ON oi.id = di.order_item_id
     JOIN customer_orders co ON co.id = d.order_id
     JOIN vegetables v ON v.id = di.vegetable_id
     WHERE ${delivConditions.join(' AND ')}`,
    delivParams
  );

  let grossDeliveredSales = 0;
  let totalProportionalDiscounts = 0;
  let totalCogs = 0;

  for (const row of deliveredRows) {
    const qty = Number(row.delivered_base_quantity);
    const price = Number(row.base_unit_price);
    const lineGross = qty * price;
    const orderSub = Number(row.order_subtotal);
    const orderDisc = Number(row.order_discount);
    const propDisc = orderSub > 0 ? (lineGross / orderSub) * orderDisc : 0;

    const unitCost = costMap.get(String(row.vegetable_id)) || 0;
    const cogs = qty * unitCost;

    grossDeliveredSales += lineGross;
    totalProportionalDiscounts += propDisc;
    totalCogs += cogs;
  }

  // Refunds issued in the period reduce net realized revenue if tied to delivered orders, or track separately
  const refConditions = ["pr.status = 'SUCCESS'"];
  const refParams = [];
  refConditions.push(...buildDateFilter('pr.refund_date', startDate, endDate, refParams));
  const [refRows] = await pool.query(
    `SELECT COALESCE(SUM(pr.amount), 0) AS total_refunds
     FROM payment_refunds pr
     WHERE ${refConditions.join(' AND ')}`,
    refParams
  );
  const totalRefunds = Number(refRows[0].total_refunds);

  const expConditions = ['e.is_deleted = 0'];
  const expParams = [];
  expConditions.push(...buildDateFilter('e.expense_date', startDate, endDate, expParams));

  const [expRows] = await pool.query(
    `SELECT e.category, COALESCE(SUM(e.amount), 0) AS total_amount
     FROM expenses e
     WHERE ${expConditions.join(' AND ')}
     GROUP BY e.category
     ORDER BY total_amount DESC`,
    expParams
  );

  const totalExpenses = expRows.reduce((s, r) => s + Number(r.total_amount), 0);

  // Total Purchases (received value in period)
  const poConditions = ["po.status != 'CANCELLED'"];
  const poParams = [];
  poConditions.push(...buildDateFilter('po.purchase_date', startDate, endDate, poParams));
  const [poRows] = await pool.query(
    `SELECT COALESCE(SUM((pi.received_base_quantity / NULLIF(pi.base_quantity, 0)) * pi.line_total), 0) AS received_purchase_total
     FROM purchase_items pi
     JOIN purchase_orders po ON po.id = pi.purchase_order_id
     WHERE ${poConditions.join(' AND ')}`,
    poParams
  );
  const totalPurchases = Number(poRows[0].received_purchase_total);

  const netSales = roundMoney(Math.max(0, grossDeliveredSales - totalProportionalDiscounts));
  const grossProfit = roundMoney(netSales - totalCogs);
  const netProfit = roundMoney(grossProfit - totalExpenses);

  return {
    grossDeliveredSales: roundMoney(grossDeliveredSales),
    discounts: roundMoney(totalProportionalDiscounts),
    refundsIssued: roundMoney(totalRefunds),
    netSales,
    costOfGoodsSold: roundMoney(totalCogs),
    grossProfit,
    totalExpenses: roundMoney(totalExpenses),
    expenseBreakdown: expRows.map((e) => ({
      category: e.category,
      amount: roundMoney(e.total_amount),
    })),
    netProfit,
    totalPurchasesReceived: roundMoney(totalPurchases),
  };
}

async function getDashboardStats() {
  const [orderStats] = await pool.query(`
    SELECT
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS todays_orders,
      COUNT(*) AS total_orders,
      SUM(CASE WHEN status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED') THEN 1 ELSE 0 END) AS pending_orders
    FROM customer_orders
    WHERE status != 'CANCELLED'
  `);

  const [paymentStats] = await pool.query(`
    SELECT
      COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'SUCCESS'), 0)
      - COALESCE((SELECT SUM(amount) FROM payment_refunds WHERE status = 'SUCCESS'), 0) AS total_received_payments
  `);

  const [duesStats] = await pool.query(`
    SELECT COALESCE(SUM(
      GREATEST(0,
        co.total_amount - (
          COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = co.id AND p.status = 'SUCCESS'), 0)
          - COALESCE((SELECT SUM(pr.amount) FROM payment_refunds pr WHERE pr.order_id = co.id AND pr.status = 'SUCCESS'), 0)
        )
      )
    ), 0) AS outstanding_customer_dues
    FROM customer_orders co
    WHERE co.status != 'CANCELLED'
  `);

  const inventory = await getInventorySummary();
  const totalAvailableStock = roundQty(
    inventory.reduce((sum, i) => sum + Number(i.available_stock), 0)
  );
  const totalInventoryValue = roundMoney(
    inventory.reduce((sum, i) => sum + Number(i.inventory_value), 0)
  );

  const reqData = await getPurchaseRequirements({ onlyShortages: 'true' });
  const pnl = await computeProfitAndLoss({});

  // Last 7 days delivered sales vs orders chart
  const [chartRows] = await pool.query(`
    SELECT DATE(d.delivery_date) AS date_label,
           COALESCE(SUM(di.delivered_base_quantity * oi.base_unit_price), 0) AS delivered_sales
    FROM deliveries d
    JOIN delivery_items di ON di.delivery_id = d.id
    JOIN order_items oi ON oi.id = di.order_item_id
    JOIN customer_orders co ON co.id = d.order_id
    WHERE co.status != 'CANCELLED'
      AND d.delivery_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
    GROUP BY DATE(d.delivery_date)
    ORDER BY date_label ASC
  `);

  const [recentOrders] = await pool.query(`
    SELECT co.id, co.order_number, co.status, co.total_amount, co.created_at,
           u.full_name AS customer_name
    FROM customer_orders co
    JOIN users u ON u.id = co.customer_id
    ORDER BY co.created_at DESC
    LIMIT 6
  `);

  return {
    metrics: {
      todaysOrders: Number(orderStats[0].todays_orders || 0),
      totalOrders: Number(orderStats[0].total_orders || 0),
      pendingOrders: Number(orderStats[0].pending_orders || 0),
      totalSales: pnl.netSales,
      totalPurchases: pnl.totalPurchasesReceived,
      totalReceivedPayments: roundMoney(paymentStats[0].total_received_payments || 0),
      outstandingCustomerDues: roundMoney(duesStats[0].outstanding_customer_dues || 0),
      availableStock: totalAvailableStock,
      inventoryValuation: totalInventoryValue,
      itemsRequiringPurchase: reqData.summary.itemsRequiringPurchase,
      totalExpenses: pnl.totalExpenses,
      grossProfit: pnl.grossProfit,
      netProfit: pnl.netProfit,
    },
    salesChart: chartRows.map((r) => ({
      date: r.date_label instanceof Date ? r.date_label.toISOString().slice(0, 10) : String(r.date_label),
      sales: roundMoney(r.delivered_sales),
    })),
    shortagePreview: reqData.items.slice(0, 5),
    recentOrders,
  };
}

async function getSalesReport({ startDate, endDate, granularity = 'daily' }) {
  let periodExpr = "DATE_FORMAT(d.delivery_date, '%Y-%m-%d')";
  if (granularity === 'weekly') {
    periodExpr = "DATE_FORMAT(d.delivery_date, '%x-W%v')";
  } else if (granularity === 'monthly') {
    periodExpr = "DATE_FORMAT(d.delivery_date, '%Y-%m')";
  } else if (granularity === 'yearly') {
    periodExpr = "DATE_FORMAT(d.delivery_date, '%Y')";
  }

  const conditions = ["co.status != 'CANCELLED'"];
  const params = [];
  conditions.push(...buildDateFilter('d.delivery_date', startDate, endDate, params));

  const [rows] = await pool.query(
    `SELECT ${periodExpr} AS period,
            COUNT(DISTINCT d.order_id) AS orders_count,
            COUNT(DISTINCT d.id) AS deliveries_count,
            COALESCE(SUM(di.delivered_base_quantity * oi.base_unit_price), 0) AS gross_sales,
            COALESCE(SUM(
              CASE WHEN co.subtotal > 0
                   THEN ((di.delivered_base_quantity * oi.base_unit_price) / co.subtotal) * co.discount_amount
                   ELSE 0 END
            ), 0) AS discounts
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     JOIN order_items oi ON oi.id = di.order_item_id
     JOIN customer_orders co ON co.id = d.order_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY period
     ORDER BY period ASC`,
    params
  );

  return rows.map((r) => ({
    period: r.period,
    orders_count: Number(r.orders_count),
    deliveries_count: Number(r.deliveries_count),
    gross_sales: roundMoney(r.gross_sales),
    discounts: roundMoney(r.discounts),
    net_sales: roundMoney(Number(r.gross_sales) - Number(r.discounts)),
  }));
}

async function getPurchaseReport({ startDate, endDate }) {
  const conditions = ["po.status != 'CANCELLED'"];
  const params = [];
  conditions.push(...buildDateFilter('po.purchase_date', startDate, endDate, params));

  const [rows] = await pool.query(
    `SELECT po.id, po.purchase_number, po.purchase_date, po.status, po.total_amount AS ordered_amount,
            s.supplier_name,
            COALESCE((
              SELECT SUM((pi.received_base_quantity / NULLIF(pi.base_quantity, 0)) * pi.line_total)
              FROM purchase_items pi WHERE pi.purchase_order_id = po.id
            ), 0) AS received_amount
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY po.purchase_date DESC, po.created_at DESC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    ordered_amount: roundMoney(r.ordered_amount),
    received_amount: roundMoney(r.received_amount),
  }));
}

async function getVegetableSalesReport({ startDate, endDate }) {
  const costMap = await getWeightedAvgCostMap();
  const conditions = ["co.status != 'CANCELLED'"];
  const params = [];
  conditions.push(...buildDateFilter('d.delivery_date', startDate, endDate, params));

  const [rows] = await pool.query(
    `SELECT v.id AS vegetable_id, v.name AS vegetable_name, v.base_unit,
            COALESCE(SUM(di.delivered_base_quantity), 0) AS delivered_qty,
            COALESCE(SUM(di.delivered_base_quantity * oi.base_unit_price), 0) AS gross_sales
     FROM delivery_items di
     JOIN deliveries d ON d.id = di.delivery_id
     JOIN order_items oi ON oi.id = di.order_item_id
     JOIN customer_orders co ON co.id = d.order_id
     JOIN vegetables v ON v.id = di.vegetable_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY v.id, v.name, v.base_unit
     ORDER BY gross_sales DESC`,
    params
  );

  return rows.map((r) => {
    const qty = roundQty(r.delivered_qty);
    const sales = roundMoney(r.gross_sales);
    const avgCost = costMap.get(String(r.vegetable_id)) || 0;
    const cogs = roundMoney(qty * avgCost);
    return {
      vegetable_id: r.vegetable_id,
      vegetable_name: r.vegetable_name,
      base_unit: r.base_unit,
      delivered_qty: qty,
      sales_amount: sales,
      cogs,
      gross_profit: roundMoney(sales - cogs),
    };
  });
}

async function getVegetablePurchaseReport({ startDate, endDate }) {
  const conditions = ["po.status != 'CANCELLED'"];
  const params = [];
  conditions.push(...buildDateFilter('po.purchase_date', startDate, endDate, params));

  const [rows] = await pool.query(
    `SELECT v.id AS vegetable_id, v.name AS vegetable_name, v.base_unit,
            COALESCE(SUM(pi.base_quantity), 0) AS ordered_qty,
            COALESCE(SUM(pi.received_base_quantity), 0) AS received_qty,
            COALESCE(SUM((pi.received_base_quantity / NULLIF(pi.base_quantity, 0)) * pi.line_total), 0) AS received_cost
     FROM purchase_items pi
     JOIN purchase_orders po ON po.id = pi.purchase_order_id
     JOIN vegetables v ON v.id = pi.vegetable_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY v.id, v.name, v.base_unit
     ORDER BY received_cost DESC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    ordered_qty: roundQty(r.ordered_qty),
    received_qty: roundQty(r.received_qty),
    received_cost: roundMoney(r.received_cost),
    avg_unit_cost: r.received_qty > 0 ? roundMoney(r.received_cost / r.received_qty) : 0,
  }));
}

async function getCustomerSalesReport({ startDate, endDate }) {
  const conditions = ["co.status != 'CANCELLED'"];
  const params = [];
  conditions.push(...buildDateFilter('co.created_at', startDate, endDate, params));

  const [rows] = await pool.query(
    `SELECT u.id AS customer_id, u.full_name AS customer_name, u.mobile,
            COUNT(DISTINCT co.id) AS total_orders,
            COALESCE(SUM(co.total_amount), 0) AS total_ordered_value
     FROM customer_orders co
     JOIN users u ON u.id = co.customer_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id, u.full_name, u.mobile
     ORDER BY total_ordered_value DESC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    total_orders: Number(r.total_orders),
    total_ordered_value: roundMoney(r.total_ordered_value),
  }));
}

async function getCustomerDuesReport() {
  const [rows] = await pool.query(`
    SELECT u.id AS customer_id, u.full_name AS customer_name, u.mobile, u.email,
           COUNT(DISTINCT co.id) AS active_orders,
           COALESCE(SUM(co.total_amount), 0) AS total_order_amount,
           COALESCE((
             SELECT SUM(p.amount) FROM payments p
             JOIN customer_orders co2 ON co2.id = p.order_id
             WHERE p.customer_id = u.id AND p.status = 'SUCCESS' AND co2.status != 'CANCELLED'
           ), 0)
           - COALESCE((
             SELECT SUM(pr.amount) FROM payment_refunds pr
             JOIN customer_orders co3 ON co3.id = pr.order_id
             WHERE pr.customer_id = u.id AND pr.status = 'SUCCESS' AND co3.status != 'CANCELLED'
           ), 0) AS net_paid
    FROM users u
    JOIN customer_orders co ON co.customer_id = u.id
    WHERE co.status != 'CANCELLED'
    GROUP BY u.id, u.full_name, u.mobile, u.email
    HAVING (total_order_amount - net_paid) > 0.01
    ORDER BY (total_order_amount - net_paid) DESC
  `);

  return rows.map((r) => ({
    ...r,
    total_order_amount: roundMoney(r.total_order_amount),
    net_paid: roundMoney(r.net_paid),
    outstanding_due: roundMoney(Math.max(0, Number(r.total_order_amount) - Number(r.net_paid))),
  }));
}

async function getSupplierPayablesReport() {
  const [rows] = await pool.query(`
    SELECT s.id AS supplier_id, s.supplier_name, s.mobile, s.opening_balance,
           COALESCE((
             SELECT SUM((pi.received_base_quantity / NULLIF(pi.base_quantity, 0)) * pi.line_total)
             FROM purchase_items pi
             JOIN purchase_orders po ON po.id = pi.purchase_order_id
             WHERE po.supplier_id = s.id AND po.status != 'CANCELLED'
           ), 0) AS total_received_purchases,
           COALESCE((
             SELECT SUM(sp.amount)
             FROM supplier_payments sp
             WHERE sp.supplier_id = s.id AND sp.status = 'SUCCESS'
           ), 0) AS total_paid
    FROM suppliers s
    WHERE s.is_deleted = 0
    ORDER BY s.supplier_name ASC
  `);

  return rows.map((r) => {
    const payable = roundMoney(
      Number(r.opening_balance) + Number(r.total_received_purchases) - Number(r.total_paid)
    );
    return {
      ...r,
      opening_balance: roundMoney(r.opening_balance),
      total_received_purchases: roundMoney(r.total_received_purchases),
      total_paid: roundMoney(r.total_paid),
      outstanding_payable: payable,
    };
  });
}

async function getPaymentCollectionReport({ startDate, endDate }) {
  const conditions = ["p.status = 'SUCCESS'"];
  const params = [];
  conditions.push(...buildDateFilter('p.payment_date', startDate, endDate, params));

  const [byMethod] = await pool.query(
    `SELECT p.payment_method, COUNT(*) AS tx_count, COALESCE(SUM(p.amount), 0) AS total_amount
     FROM payments p
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.payment_method`,
    params
  );

  const [rows] = await pool.query(
    `SELECT p.payment_number, p.payment_date, p.payment_method, p.amount, p.transaction_ref,
            co.order_number, u.full_name AS customer_name
     FROM payments p
     JOIN customer_orders co ON co.id = p.order_id
     JOIN users u ON u.id = p.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.payment_date DESC`,
    params
  );

  return {
    byMethod: byMethod.map((m) => ({
      payment_method: m.payment_method,
      tx_count: Number(m.tx_count),
      total_amount: roundMoney(m.total_amount),
    })),
    transactions: rows.map((r) => ({ ...r, amount: roundMoney(r.amount) })),
  };
}

async function getExpenseReport({ startDate, endDate }) {
  const conditions = ['e.is_deleted = 0'];
  const params = [];
  conditions.push(...buildDateFilter('e.expense_date', startDate, endDate, params));

  const [byCategory] = await pool.query(
    `SELECT e.category, COUNT(*) AS entry_count, COALESCE(SUM(e.amount), 0) AS total_amount
     FROM expenses e
     WHERE ${conditions.join(' AND ')}
     GROUP BY e.category
     ORDER BY total_amount DESC`,
    params
  );

  const [items] = await pool.query(
    `SELECT e.id, e.title, e.category, e.amount, e.expense_date, e.payment_method, e.remarks
     FROM expenses e
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.expense_date DESC`,
    params
  );

  return {
    byCategory: byCategory.map((c) => ({
      category: c.category,
      entry_count: Number(c.entry_count),
      total_amount: roundMoney(c.total_amount),
    })),
    items: items.map((i) => ({ ...i, amount: roundMoney(i.amount) })),
  };
}

async function listAuditLogs(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { entity, action } = query;
  const conditions = [];
  const params = [];

  if (entity) {
    conditions.push('al.entity = ?');
    params.push(entity);
  }
  if (action) {
    conditions.push('al.action LIKE ?');
    params.push(`%${action.trim()}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs al ${where}`, params);
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT al.*, u.full_name AS actor_name, u.email AS actor_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

module.exports = {
  getDashboardStats,
  computeProfitAndLoss,
  getSalesReport,
  getPurchaseReport,
  getVegetableSalesReport,
  getVegetablePurchaseReport,
  getCustomerSalesReport,
  getCustomerDuesReport,
  getSupplierPayablesReport,
  getPaymentCollectionReport,
  getExpenseReport,
  listAuditLogs,
};
