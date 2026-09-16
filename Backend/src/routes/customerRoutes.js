const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, customerController.getCustomers);
router.post('/', authenticateToken, customerController.createCustomer);

module.exports = router;
