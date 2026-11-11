const inventoryService = require('../services/inventoryService');
const deliveryService = require('../services/deliveryService');
const { asyncHandler } = require('../middleware/errorHandler');

// Inventory
exports.getInventorySummary = asyncHandler(async (req, res) => {
  const items = await inventoryService.getInventorySummary(req.query);
  res.json({ success: true, data: items });
});

exports.getStockMovements = asyncHandler(async (req, res) => {
  const data = await inventoryService.getStockMovements(req.query);
  res.json({ success: true, data });
});

exports.createStockAdjustment = asyncHandler(async (req, res) => {
  const movement = await inventoryService.createStockAdjustment(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: movement });
});

// Deliveries
exports.getDeliveryQueue = asyncHandler(async (req, res) => {
  const queue = await deliveryService.getDeliveryQueue();
  res.json({ success: true, data: queue });
});

exports.listDeliveries = asyncHandler(async (req, res) => {
  const data = await deliveryService.listDeliveries(req.query);
  res.json({ success: true, data });
});

exports.getDeliveryById = asyncHandler(async (req, res) => {
  const delivery = await deliveryService.getDeliveryById(req.params.id);
  res.json({ success: true, data: delivery });
});

exports.createDelivery = asyncHandler(async (req, res) => {
  const delivery = await deliveryService.createDelivery(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: delivery });
});
