const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { uploadVegetableImage } = require('../middleware/upload');

const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController');
const vegCtrl = require('../controllers/vegetableController');
const cartCtrl = require('../controllers/cartController');
const orderCtrl = require('../controllers/orderController');
const purchaseCtrl = require('../controllers/purchaseController');
const invCtrl = require('../controllers/inventoryController');
const finCtrl = require('../controllers/financeController');

const router = express.Router();
const adminOnly = authorizeRoles('ADMIN', 'SUPER_ADMIN');
const superAdminOnly = authorizeRoles('SUPER_ADMIN');

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, service: 'SHREE KRISHNA AGRO OMS API', timestamp: new Date().toISOString() });
});

// ==================== PUBLIC AUTH & CATALOG ====================
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/logout', authCtrl.logout);

router.get('/catalog/categories', vegCtrl.listPublicCategories);
router.get('/catalog/vegetables', vegCtrl.listPublicVegetables);
router.get('/catalog/vegetables/:id', vegCtrl.getPublicVegetableById);

// ==================== AUTHENTICATED CUSTOMER / PORTAL ====================
router.use('/auth/me', authenticate);
router.get('/auth/me', authCtrl.getMe);
router.put('/auth/me', authCtrl.updateMe);
router.put('/auth/change-password', authenticate, authCtrl.changePassword);

router.get('/auth/addresses', authenticate, authCtrl.listMyAddresses);
router.post('/auth/addresses', authenticate, authCtrl.createMyAddress);
router.put('/auth/addresses/:addressId', authenticate, authCtrl.updateMyAddress);
router.delete('/auth/addresses/:addressId', authenticate, authCtrl.deleteMyAddress);
router.get('/auth/reverse-geocode', authenticate, authCtrl.reverseGeocode);

router.get('/cart', authenticate, cartCtrl.getCart);
router.put('/cart', authenticate, cartCtrl.setCartItem);
router.delete('/cart/:vegetableId', authenticate, cartCtrl.removeCartItem);
router.delete('/cart', authenticate, cartCtrl.clearCart);

router.post('/orders', authenticate, orderCtrl.placeCustomerOrder);
router.get('/orders', authenticate, orderCtrl.listOrders);
router.get('/orders/:id', authenticate, orderCtrl.getOrderById);

router.get('/payments', authenticate, finCtrl.listPayments);
router.post('/payments', authenticate, finCtrl.recordPayment);

router.get('/invoices', authenticate, finCtrl.listInvoices);
router.get('/invoices/:id', authenticate, finCtrl.getInvoiceById);
router.get('/invoices/:id/pdf', authenticate, finCtrl.downloadInvoicePdf);

// ==================== ADMIN & SUPER_ADMIN ROUTES ====================
const adminRouter = express.Router();
adminRouter.use(authenticate, adminOnly);

adminRouter.get('/dashboard', finCtrl.getDashboard);
adminRouter.get('/company-settings', finCtrl.getCompanySettings);
adminRouter.get('/audit-logs', finCtrl.listAuditLogs);

// Users & Customer Addresses
adminRouter.get('/users', userCtrl.listUsers);
adminRouter.post('/users', userCtrl.createUser);
adminRouter.get('/users/:id', userCtrl.getUserById);
adminRouter.put('/users/:id', userCtrl.updateUser);
adminRouter.delete('/users/:id', userCtrl.deleteUser);
adminRouter.post('/users/:id/restore', superAdminOnly, userCtrl.restoreUser);
adminRouter.get('/users/:id/addresses', userCtrl.listUserAddresses);
adminRouter.post('/users/:id/addresses', userCtrl.createUserAddress);
adminRouter.put('/users/:id/addresses/:addressId', userCtrl.updateUserAddress);
adminRouter.delete('/users/:id/addresses/:addressId', userCtrl.deleteUserAddress);

// Categories
adminRouter.get('/categories', vegCtrl.listAdminCategories);
adminRouter.post('/categories', vegCtrl.createCategory);
adminRouter.put('/categories/:id', vegCtrl.updateCategory);
adminRouter.delete('/categories/:id', vegCtrl.deleteCategory);
adminRouter.post('/categories/:id/restore', superAdminOnly, vegCtrl.restoreCategory);

// Vegetables
adminRouter.get('/vegetables', vegCtrl.listAdminVegetables);
adminRouter.get('/vegetables/:id', vegCtrl.getAdminVegetableById);
adminRouter.post('/vegetables', uploadVegetableImage.single('image'), vegCtrl.createVegetable);
adminRouter.put('/vegetables/:id', uploadVegetableImage.single('image'), vegCtrl.updateVegetable);
adminRouter.delete('/vegetables/:id', vegCtrl.deleteVegetable);
adminRouter.post('/vegetables/:id/restore', superAdminOnly, vegCtrl.restoreVegetable);

// Orders
adminRouter.get('/orders', orderCtrl.listOrders);
adminRouter.post('/orders', orderCtrl.placeAdminOrder);
adminRouter.get('/orders/:id', orderCtrl.getOrderById);
adminRouter.patch('/orders/:id/status', orderCtrl.updateOrderStatus);
adminRouter.put('/orders/:id/items', orderCtrl.editOrderItems);
adminRouter.post('/orders/:id/allocate', orderCtrl.allocateOrderStock);

// Purchase Requirements
adminRouter.get('/purchase-requirements', purchaseCtrl.getPurchaseRequirements);
adminRouter.post('/purchase-requirements/generate-po', purchaseCtrl.generatePurchaseOrderFromRequirements);

// Suppliers
adminRouter.get('/suppliers', purchaseCtrl.listSuppliers);
adminRouter.post('/suppliers', purchaseCtrl.createSupplier);
adminRouter.get('/suppliers/:id', purchaseCtrl.getSupplierById);
adminRouter.put('/suppliers/:id', purchaseCtrl.updateSupplier);
adminRouter.delete('/suppliers/:id', purchaseCtrl.deleteSupplier);
adminRouter.post('/suppliers/:id/restore', superAdminOnly, purchaseCtrl.restoreSupplier);
adminRouter.post('/supplier-payments', purchaseCtrl.recordSupplierPayment);

// Purchase Orders
adminRouter.get('/purchases', purchaseCtrl.listPurchases);
adminRouter.post('/purchases', purchaseCtrl.createPurchaseOrder);
adminRouter.get('/purchases/:id', purchaseCtrl.getPurchaseById);
adminRouter.post('/purchases/:id/receive', purchaseCtrl.receivePurchaseOrder);
adminRouter.post('/purchases/:id/cancel', purchaseCtrl.cancelPurchaseOrder);

// Inventory & Stock Movements
adminRouter.get('/inventory', invCtrl.getInventorySummary);
adminRouter.get('/inventory/movements', invCtrl.getStockMovements);
adminRouter.post('/inventory/adjustments', invCtrl.createStockAdjustment);

// Deliveries
adminRouter.get('/deliveries/queue', invCtrl.getDeliveryQueue);
adminRouter.get('/deliveries', invCtrl.listDeliveries);
adminRouter.get('/deliveries/:id', invCtrl.getDeliveryById);
adminRouter.post('/deliveries', invCtrl.createDelivery);

// Payments & Refunds
adminRouter.get('/payments', finCtrl.listPayments);
adminRouter.post('/payments', finCtrl.recordPayment);
adminRouter.post('/payments/refunds', finCtrl.createRefund);

// Invoices
adminRouter.get('/invoices', finCtrl.listInvoices);
adminRouter.get('/invoices/:id', finCtrl.getInvoiceById);
adminRouter.get('/invoices/:id/pdf', finCtrl.downloadInvoicePdf);
adminRouter.post('/invoices/order/:orderId', finCtrl.generateInvoice);
adminRouter.post('/invoices/:id/cancel', finCtrl.cancelInvoice);

// Expenses
adminRouter.get('/expenses', finCtrl.listExpenses);
adminRouter.post('/expenses', finCtrl.createExpense);
adminRouter.put('/expenses/:id', finCtrl.updateExpense);
adminRouter.delete('/expenses/:id', finCtrl.deleteExpense);
adminRouter.post('/expenses/:id/restore', superAdminOnly, finCtrl.restoreExpense);

// Reports
adminRouter.get('/reports/sales', finCtrl.getSalesReport);
adminRouter.get('/reports/purchases', finCtrl.getPurchaseReport);
adminRouter.get('/reports/vegetable-sales', finCtrl.getVegetableSalesReport);
adminRouter.get('/reports/vegetable-purchases', finCtrl.getVegetablePurchaseReport);
adminRouter.get('/reports/customer-sales', finCtrl.getCustomerSalesReport);
adminRouter.get('/reports/customer-dues', finCtrl.getCustomerDuesReport);
adminRouter.get('/reports/supplier-payables', finCtrl.getSupplierPayablesReport);
adminRouter.get('/reports/payment-collections', finCtrl.getPaymentCollectionReport);
adminRouter.get('/reports/expenses', finCtrl.getExpenseReport);
adminRouter.get('/reports/inventory-valuation', finCtrl.getInventoryValuationReport);
adminRouter.get('/reports/pnl', finCtrl.getProfitAndLoss);
adminRouter.get('/reports/export', finCtrl.exportReport);

router.use('/admin', adminRouter);

module.exports = router;
