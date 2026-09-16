const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const salesOrderController = require('../controllers/salesOrderController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, quotationController.getQuotations);
router.post('/calculate', authenticateToken, quotationController.calculatePreview);
router.get('/:id', authenticateToken, quotationController.getQuotationById);
router.post('/', authenticateToken, quotationController.createQuotation);
router.patch('/:id/status', authenticateToken, quotationController.updateStatus);
router.post('/:id/convert', authenticateToken, salesOrderController.convertQuotationToSalesOrder);

module.exports = router;
