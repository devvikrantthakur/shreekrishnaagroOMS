const orderService = require('../services/orderService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.placeCustomerOrder = asyncHandler(async (req, res) => {
  const order = await orderService.placeOrder(req.user.id, req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: order });
});

exports.placeAdminOrder = asyncHandler(async (req, res) => {
  const { customerId, ...rest } = req.body;
  const order = await orderService.placeOrder(customerId, rest, req.user, req.ip);
  res.status(201).json({ success: true, data: order });
});

exports.listOrders = asyncHandler(async (req, res) => {
  const data = await orderService.listOrders(req.query, req.user);
  res.json({ success: true, data });
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user);
  res.json({ success: true, data: order });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: order });
});

exports.editOrderItems = asyncHandler(async (req, res) => {
  const order = await orderService.editOrderItems(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: order });
});

exports.allocateOrderStock = asyncHandler(async (req, res) => {
  const summary = await orderService.allocateStockToOrder(req.params.id, req.user, req.ip);
  res.json({ success: true, data: summary });
});
