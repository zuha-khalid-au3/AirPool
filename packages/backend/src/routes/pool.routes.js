const express = require('express');
const router = express.Router();
const poolController = require('../controllers/pool.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');

// All pool routes require authentication
router.use(authenticate);

// Create a new ride pool
router.post('/', validate(schemas.createPool), poolController.createPool);

// Get available pools for a flight/airport
router.get('/search', poolController.searchPools);

// Get pool details
router.get('/:poolId', poolController.getPoolDetails);

// Join a pool
router.post('/:poolId/join', poolController.joinPool);

// Leave a pool
router.post('/:poolId/leave', poolController.leavePool);

// Update pool status (creator only)
router.patch('/:poolId/status', poolController.updatePoolStatus);

// Rate pool members after ride completion
router.post('/:poolId/rate', poolController.rateMembers);

// Get user's pools (active and history)
router.get('/user/my-pools', poolController.getMyPools);

module.exports = router;
