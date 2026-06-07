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
router.post('/google', authRateLimiter, validate(schemas.googleAuth), authController.googleAuth);
router.post(
  '/google/session',
  authRateLimiter,
  validate(schemas.googleSessionExchange),
  authController.googleSessionExchange
);
router.get('/google/start', authController.googleOAuthStart);
router.get('/google/callback', authController.googleOAuthCallback);

// Guest login
router.post(
  '/guest-login',
  authRateLimiter,
  validate(schemas.guestLogin),
  authController.guestLogin
);

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
