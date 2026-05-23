const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validate, schemas } = require('../middleware/validator');
const { otpRateLimiter, authRateLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth.middleware');

// Send OTP
router.post('/send-otp', otpRateLimiter, validate(schemas.sendOTP), authController.sendOTP);

// Verify OTP
router.post(
  '/verify-otp',
  authRateLimiter,
  validate(schemas.verifyOTP),
  authController.verifyOTP
);

// Google OAuth
router.post('/google', authRateLimiter, authController.googleAuth);

// Admin login
router.post(
  '/admin/login',
  authRateLimiter,
  validate(schemas.adminLogin),
  authController.adminLogin
);

// Refresh Token
router.post('/refresh-token', authController.refreshToken);

// Logout
router.post('/logout', authenticate, authController.logout);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
