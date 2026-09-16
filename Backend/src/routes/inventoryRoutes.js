const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All authenticated users (Admin and Sales) can view inventory availability
router.get('/', authenticateToken, inventoryController.getInventory);

// Only ADMIN can update physical inventory
router.patch('/:productId', authenticateToken, requireRole('ADMIN'), inventoryController.updateInventory);

module.exports = router;
