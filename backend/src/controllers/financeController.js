const paymentService = require('../services/paymentService');
const invoiceService = require('../services/invoiceService');
const expenseService = require('../services/expenseService');
const reportService = require('../services/reportService');
const inventoryService = require('../services/inventoryService');
const { pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generateInvoicePdf, generateReportPdf } = require('../utils/pdfGenerator');

// Payments
exports.listPayments = asyncHandler(async (req, res) => {
  const data = await paymentService.listPayments(req.query, req.user);
  res.json({ success: true, data });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.recordPayment(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: result });
});

exports.createRefund = asyncHandler(async (req, res) => {
  const refund = await paymentService.createRefund(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: refund });
});

// Invoices
exports.listInvoices = asyncHandler(async (req, res) => {
  const data = await invoiceService.listInvoices(req.query, req.user);
  res.json({ success: true, data });
});

exports.getInvoiceById = asyncHandler(async (req, res) => {
  const data = await invoiceService.getInvoiceById(req.params.id, req.user);
  res.json({ success: true, data });
});

exports.generateInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.generateInvoiceForOrder(
    req.params.orderId,
    req.body,
    req.user,
    req.ip
  );
  res.status(201).json({ success: true, data });
});

exports.cancelInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.cancelInvoice(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data });
});

exports.downloadInvoicePdf = asyncHandler(async (req, res) => {
  const invoiceData = await invoiceService.getInvoiceById(req.params.id, req.user);
  generateInvoicePdf(invoiceData, res);
});

// Expenses
exports.listExpenses = asyncHandler(async (req, res) => {
  const data = await expenseService.listExpenses(req.query, req.user);
  res.json({ success: true, data });
});

exports.createExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.createExpense(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data });
});

exports.updateExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.updateExpense(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data });
});

exports.deleteExpense = asyncHandler(async (req, res) => {
  const result = await expenseService.softDeleteExpense(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

exports.restoreExpense = asyncHandler(async (req, res) => {
  const result = await expenseService.restoreExpense(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

// Dashboard & Reports
exports.getDashboard = asyncHandler(async (req, res) => {
  const data = await reportService.getDashboardStats();
  res.json({ success: true, data });
});

exports.getSalesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getSalesReport(req.query);
  res.json({ success: true, data });
});

exports.getPurchaseReport = asyncHandler(async (req, res) => {
  const data = await reportService.getPurchaseReport(req.query);
  res.json({ success: true, data });
});

exports.getVegetableSalesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getVegetableSalesReport(req.query);
  res.json({ success: true, data });
});

exports.getVegetablePurchaseReport = asyncHandler(async (req, res) => {
  const data = await reportService.getVegetablePurchaseReport(req.query);
  res.json({ success: true, data });
});

exports.getCustomerSalesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getCustomerSalesReport(req.query);
  res.json({ success: true, data });
});

exports.getCustomerDuesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getCustomerDuesReport();
  res.json({ success: true, data });
});

exports.getSupplierPayablesReport = asyncHandler(async (req, res) => {
  const data = await reportService.getSupplierPayablesReport();
  res.json({ success: true, data });
});

exports.getPaymentCollectionReport = asyncHandler(async (req, res) => {
  const data = await reportService.getPaymentCollectionReport(req.query);
  res.json({ success: true, data });
});

exports.getExpenseReport = asyncHandler(async (req, res) => {
  const data = await reportService.getExpenseReport(req.query);
  res.json({ success: true, data });
});

exports.getInventoryValuationReport = asyncHandler(async (req, res) => {
  const data = await inventoryService.getInventorySummary({});
  res.json({ success: true, data });
});

exports.getProfitAndLoss = asyncHandler(async (req, res) => {
  const data = await reportService.computeProfitAndLoss(req.query);
  res.json({ success: true, data });
});

exports.exportReport = asyncHandler(async (req, res) => {
  const { type, format = 'csv', startDate, endDate, granularity = 'daily' } = req.query;
  let title = 'Business Report';
  let columns = [];
  let rows = [];
  let summaryLines = [];

  if (type === 'sales') {
    title = `Sales Report (${granularity})`;
    rows = await reportService.getSalesReport({ startDate, endDate, granularity });
    columns = [
      { key: 'period', label: 'Period' },
      { key: 'orders_count', label: 'Orders', align: 'right' },
      { key: 'deliveries_count', label: 'Deliveries', align: 'right' },
      { key: 'gross_sales', label: 'Gross Sales', align: 'right' },
      { key: 'discounts', label: 'Discounts', align: 'right' },
      { key: 'net_sales', label: 'Net Sales', align: 'right' },
    ];
  } else if (type === 'purchases') {
    title = 'Purchase Orders Report';
    rows = await reportService.getPurchaseReport({ startDate, endDate });
    columns = [
      { key: 'purchase_number', label: 'PO #' },
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'purchase_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'ordered_amount', label: 'Ordered', align: 'right' },
      { key: 'received_amount', label: 'Received', align: 'right' },
    ];
  } else if (type === 'vegetable-sales') {
    title = 'Vegetable-wise Sales & Margin';
    rows = await reportService.getVegetableSalesReport({ startDate, endDate });
    columns = [
      { key: 'vegetable_name', label: 'Vegetable' },
      { key: 'base_unit', label: 'Unit' },
      { key: 'delivered_qty', label: 'Delivered Qty', align: 'right' },
      { key: 'sales_amount', label: 'Sales', align: 'right' },
      { key: 'cogs', label: 'COGS', align: 'right' },
      { key: 'gross_profit', label: 'Gross Profit', align: 'right' },
    ];
  } else if (type === 'customer-dues') {
    title = 'Customer Outstanding Dues';
    rows = await reportService.getCustomerDuesReport();
    columns = [
      { key: 'customer_name', label: 'Customer' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'active_orders', label: 'Orders', align: 'right' },
      { key: 'total_order_amount', label: 'Order Total', align: 'right' },
      { key: 'net_paid', label: 'Paid', align: 'right' },
      { key: 'outstanding_due', label: 'Balance Due', align: 'right' },
    ];
  } else if (type === 'supplier-payables') {
    title = 'Supplier Outstanding Payables';
    rows = await reportService.getSupplierPayablesReport();
    columns = [
      { key: 'supplier_name', label: 'Supplier' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'total_received_purchases', label: 'Purchased', align: 'right' },
      { key: 'total_paid', label: 'Paid', align: 'right' },
      { key: 'outstanding_payable', label: 'Payable', align: 'right' },
    ];
  } else if (type === 'expenses') {
    title = 'Expense Report';
    const exp = await reportService.getExpenseReport({ startDate, endDate });
    rows = exp.items;
    columns = [
      { key: 'expense_date', label: 'Date' },
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'payment_method', label: 'Method' },
      { key: 'amount', label: 'Amount', align: 'right' },
    ];
  } else if (type === 'inventory-valuation') {
    title = 'Inventory Valuation Report';
    rows = await inventoryService.getInventorySummary({});
    columns = [
      { key: 'name', label: 'Vegetable' },
      { key: 'base_unit', label: 'Unit' },
      { key: 'current_stock', label: 'Current Stock', align: 'right' },
      { key: 'reserved_stock', label: 'Reserved', align: 'right' },
      { key: 'available_stock', label: 'Available', align: 'right' },
      { key: 'weighted_avg_cost', label: 'Avg Cost', align: 'right' },
      { key: 'inventory_value', label: 'Valuation', align: 'right' },
    ];
  } else if (type === 'pnl') {
    title = 'Profit & Loss Statement';
    const pnl = await reportService.computeProfitAndLoss({ startDate, endDate });
    summaryLines = [
      { label: 'Net Delivered Sales', value: `Rs. ${pnl.netSales.toFixed(2)}` },
      { label: 'Cost of Goods Sold (Weighted Avg)', value: `Rs. ${pnl.costOfGoodsSold.toFixed(2)}` },
      { label: 'Gross Profit', value: `Rs. ${pnl.grossProfit.toFixed(2)}` },
      { label: 'Total Business Expenses', value: `Rs. ${pnl.totalExpenses.toFixed(2)}` },
      { label: 'Net Profit', value: `Rs. ${pnl.netProfit.toFixed(2)}` },
    ];
    rows = [
      { item: 'Gross Delivered Sales', amount: pnl.grossDeliveredSales.toFixed(2) },
      { item: 'Less: Order Discounts', amount: (-pnl.discounts).toFixed(2) },
      { item: 'Net Sales Revenue', amount: pnl.netSales.toFixed(2) },
      { item: 'Less: Cost of Goods Sold (COGS)', amount: (-pnl.costOfGoodsSold).toFixed(2) },
      { item: 'Gross Profit', amount: pnl.grossProfit.toFixed(2) },
      ...pnl.expenseBreakdown.map((e) => ({
        item: `Expense - ${e.category}`,
        amount: (-e.amount).toFixed(2),
      })),
      { item: 'Total Business Expenses', amount: (-pnl.totalExpenses).toFixed(2) },
      { item: 'Net Profit', amount: pnl.netProfit.toFixed(2) },
    ];
    columns = [
      { key: 'item', label: 'Line Item' },
      { key: 'amount', label: 'Amount (Rs.)', align: 'right' },
    ];
  } else {
    throw new AppError('Unsupported export report type.', 400);
  }

  if (format === 'pdf') {
    const subtitle =
      startDate || endDate
        ? `Period: ${startDate || 'Beginning'} to ${endDate || 'Present'}`
        : 'All-time report';
    return generateReportPdf(title, subtitle, columns, rows, summaryLines, res);
  }

  // CSV export
  const escapeCsv = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escapeCsv(c.label)).join(',');
  const dataLines = rows.map((r) => columns.map((c) => escapeCsv(r[c.key])).join(','));
  const csv = [headerLine, ...dataLines].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type || 'report'}.csv"`);
  return res.send(csv);
});

exports.listAuditLogs = asyncHandler(async (req, res) => {
  const data = await reportService.listAuditLogs(req.query);
  res.json({ success: true, data });
});

exports.getCompanySettings = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  res.json({ success: true, data: rows[0] || null });
});
