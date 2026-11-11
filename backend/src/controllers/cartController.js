const cartService = require('../services/cartService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  res.json({ success: true, data: cart });
});

exports.setCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.setCartItem(req.user.id, req.body);
  res.json({ success: true, data: cart });
});

exports.removeCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeCartItem(req.user.id, req.params.vegetableId);
  res.json({ success: true, data: cart });
});

exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.id);
  res.json({ success: true, data: cart });
});
