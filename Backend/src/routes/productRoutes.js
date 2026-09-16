const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All authenticated users can view products
router.get('/', authenticateToken, productController.getProducts);

// Only ADMIN can create products
router.post('/', authenticateToken, requireRole('ADMIN'), productController.createProduct);

module.exports = router;
