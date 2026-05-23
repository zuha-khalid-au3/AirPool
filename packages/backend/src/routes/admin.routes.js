const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('admin', 'moderator'));

router.get('/stats', adminController.getDashboardStats);
router.get('/pools', adminController.listPools);
router.get('/users', adminController.listUsers);

module.exports = router;
