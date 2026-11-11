const supplierService = require('../services/supplierService');
const purchaseService = require('../services/purchaseService');
const purchaseRequirementService = require('../services/purchaseRequirementService');
const { asyncHandler } = require('../middleware/errorHandler');

// Purchase Requirements
exports.getPurchaseRequirements = asyncHandler(async (req, res) => {
  const data = await purchaseRequirementService.getPurchaseRequirements(req.query);
  res.json({ success: true, data });
});

exports.generatePurchaseOrderFromRequirements = asyncHandler(async (req, res) => {
  const po = await purchaseRequirementService.generatePurchaseOrderFromShortages(
    req.body,
    req.user,
    req.ip
  );
  res.status(201).json({ success: true, data: po });
});

// Suppliers
exports.listSuppliers = asyncHandler(async (req, res) => {
  const data = await supplierService.listSuppliers(req.query, req.user);
  res.json({ success: true, data });
});

exports.getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await supplierService.getSupplierById(req.params.id);
  res.json({ success: true, data: supplier });
});

exports.createSupplier = asyncHandler(async (req, res) => {
  const supplier = await supplierService.createSupplier(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: supplier });
});

exports.updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await supplierService.updateSupplier(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: supplier });
});

exports.deleteSupplier = asyncHandler(async (req, res) => {
  const result = await supplierService.softDeleteSupplier(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

exports.restoreSupplier = asyncHandler(async (req, res) => {
  const result = await supplierService.restoreSupplier(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

// Purchase Orders
exports.listPurchases = asyncHandler(async (req, res) => {
  const data = await purchaseService.listPurchases(req.query);
  res.json({ success: true, data });
});

exports.getPurchaseById = asyncHandler(async (req, res) => {
  const po = await purchaseService.getPurchaseById(req.params.id);
  res.json({ success: true, data: po });
});

exports.createPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseService.createPurchaseOrder(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: po });
});

exports.receivePurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseService.receivePurchaseOrder(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: po });
});

exports.cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseService.cancelPurchaseOrder(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: po });
});

exports.recordSupplierPayment = asyncHandler(async (req, res) => {
  const payment = await purchaseService.recordSupplierPayment(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: payment });
});
