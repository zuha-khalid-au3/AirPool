const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';
const rateLimitDisabled =
  process.env.RATE_LIMIT_DISABLED === 'true' || process.env.RATE_LIMIT_DISABLED === '1';

// General API rate limiter
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || (isDev ? '10000' : '100'),
    10
  ),
  skip: () => isDev || rateLimitDisabled,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for OTP endpoints
const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 100 : 3,
  skip: () => rateLimitDisabled,
  message: {
    success: false,
    error: {
      code: 'OTP_RATE_LIMIT',
      message: 'Too many OTP requests. Please wait before trying again.',
    },
  },
});

// Auth rate limiter
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10,
  skip: () => rateLimitDisabled,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

module.exports = { rateLimiter, otpRateLimiter, authRateLimiter };
