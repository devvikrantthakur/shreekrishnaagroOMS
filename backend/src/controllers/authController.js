const authService = require('../services/authService');
const userService = require('../services/userService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.registerCustomer(req.body, req.ip);
  res.status(201).json({ success: true, data: result });
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
});

exports.logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

exports.getMe = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  res.json({ success: true, data: profile });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const profile = await authService.updateProfile(req.user.id, req.body);
  res.json({ success: true, data: profile });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  res.json({ success: true, ...result });
});

// Self-service customer address endpoints
exports.listMyAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.listAddresses(req.user.id);
  res.json({ success: true, data: addresses });
});

exports.createMyAddress = asyncHandler(async (req, res) => {
  const address = await userService.createAddress(req.user.id, req.body);
  res.status(201).json({ success: true, data: address });
});

exports.updateMyAddress = asyncHandler(async (req, res) => {
  const address = await userService.updateAddress(req.user.id, req.params.addressId, req.body);
  res.json({ success: true, data: address });
});

exports.deleteMyAddress = asyncHandler(async (req, res) => {
  const result = await userService.softDeleteAddress(req.user.id, req.params.addressId);
  res.json({ success: true, ...result });
});

exports.reverseGeocode = asyncHandler(async (req, res) => {
  const result = await authService.reverseGeocode(req.query.lat, req.query.lng);
  res.json({ success: true, data: result });
});
