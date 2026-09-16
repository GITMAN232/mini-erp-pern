const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, enquiryController.getEnquiries);
router.get('/:id', authenticateToken, enquiryController.getEnquiryById);
router.post('/', authenticateToken, enquiryController.createEnquiry);

module.exports = router;
