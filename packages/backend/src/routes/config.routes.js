const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

// Public: Get app configuration (SDUI)
router.get('/app', optionalAuth, configController.getAppConfig);

// Public: Get supported airports
router.get('/airports', configController.getSupportedAirports);

// Public: Get vehicle types
router.get('/vehicles', configController.getVehicleTypes);

// Public: Get announcements
router.get('/announcements', configController.getAnnouncements);

// Public: Get feature flags
router.get('/features', optionalAuth, configController.getFeatureFlags);

module.exports = router;
