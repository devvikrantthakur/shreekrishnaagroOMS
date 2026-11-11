const userService = require('../services/userService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listUsers = asyncHandler(async (req, res) => {
  const data = await userService.listUsers(req.query, req.user);
  res.json({ success: true, data });
});

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: user });
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.user);
  res.json({ success: true, data: user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const result = await userService.softDeleteUser(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

exports.restoreUser = asyncHandler(async (req, res) => {
  const result = await userService.restoreUser(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

exports.listUserAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.listAddresses(req.params.id);
  res.json({ success: true, data: addresses });
});

exports.createUserAddress = asyncHandler(async (req, res) => {
  const address = await userService.createAddress(req.params.id, req.body);
  res.status(201).json({ success: true, data: address });
});

exports.updateUserAddress = asyncHandler(async (req, res) => {
  const address = await userService.updateAddress(req.params.id, req.params.addressId, req.body);
  res.json({ success: true, data: address });
});

exports.deleteUserAddress = asyncHandler(async (req, res) => {
  const result = await userService.softDeleteAddress(req.params.id, req.params.addressId);
  res.json({ success: true, ...result });
});
