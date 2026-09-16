const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All authenticated users can view sales orders
router.get('/', authenticateToken, salesOrderController.getSalesOrders);
router.get('/:id', authenticateToken, salesOrderController.getSalesOrderById);

// ADMIN ONLY endpoints for order confirmation & dispatch
router.post('/:id/confirm', authenticateToken, requireRole('ADMIN'), salesOrderController.confirmSalesOrder);
router.post('/:id/dispatch', authenticateToken, requireRole('ADMIN'), salesOrderController.dispatchSalesOrder);

module.exports = router;
