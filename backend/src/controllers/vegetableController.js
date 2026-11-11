const vegetableService = require('../services/vegetableService');
const { asyncHandler } = require('../middleware/errorHandler');

// Public catalog endpoints
exports.listPublicCategories = asyncHandler(async (req, res) => {
  const categories = await vegetableService.listCategories({ status: 'ACTIVE' });
  res.json({ success: true, data: categories });
});

exports.listPublicVegetables = asyncHandler(async (req, res) => {
  const data = await vegetableService.listVegetables(req.query, null, true);
  res.json({ success: true, data });
});

exports.getPublicVegetableById = asyncHandler(async (req, res) => {
  const veg = await vegetableService.getVegetableById(req.params.id, true);
  res.json({ success: true, data: veg });
});

// Admin categories
exports.listAdminCategories = asyncHandler(async (req, res) => {
  const categories = await vegetableService.listCategories(req.query, req.user);
  res.json({ success: true, data: categories });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const cat = await vegetableService.createCategory(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: cat });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const cat = await vegetableService.updateCategory(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, data: cat });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const result = await vegetableService.softDeleteCategory(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

exports.restoreCategory = asyncHandler(async (req, res) => {
  const result = await vegetableService.restoreCategory(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

// Admin vegetables
exports.listAdminVegetables = asyncHandler(async (req, res) => {
  const data = await vegetableService.listVegetables(req.query, req.user, false);
  res.json({ success: true, data });
});

exports.getAdminVegetableById = asyncHandler(async (req, res) => {
  const veg = await vegetableService.getVegetableById(req.params.id, false);
  res.json({ success: true, data: veg });
});

exports.createVegetable = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = `/uploads/vegetables/${req.file.filename}`;
  }
  const veg = await vegetableService.createVegetable(payload, req.user, req.ip);
  res.status(201).json({ success: true, data: veg });
});

exports.updateVegetable = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (req.file) {
    payload.imageUrl = `/uploads/vegetables/${req.file.filename}`;
  }
  const veg = await vegetableService.updateVegetable(req.params.id, payload, req.user, req.ip);
  res.json({ success: true, data: veg });
});

exports.deleteVegetable = asyncHandler(async (req, res) => {
  const result = await vegetableService.softDeleteVegetable(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});

exports.restoreVegetable = asyncHandler(async (req, res) => {
  const result = await vegetableService.restoreVegetable(req.params.id, req.user, req.ip);
  res.json({ success: true, ...result });
});
