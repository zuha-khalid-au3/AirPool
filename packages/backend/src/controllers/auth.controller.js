const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const { generateOTP } = require('../utils/encryption');
const { getRedisClient } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Send OTP
const sendOTP = async (req, res, next) => {
  try {
    const { phone, countryCode } = req.body;
    const otp = generateOTP(6);
    const redis = getRedisClient();

    // Store OTP in Redis with 5 minute expiry
    const otpKey = `otp:${countryCode}${phone}`;
    await redis.setEx(otpKey, 300, otp);

    // In production, send OTP via SMS (Twilio/Fonoster)
    // For development, log the OTP
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[DEV] OTP for ${countryCode}${phone}: ${otp}`);
    } else {
      // TODO: Integrate SMS service (Twilio or Fonoster)
      // await smsService.sendOTP(countryCode + phone, otp);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: 300,
        ...(process.env.NODE_ENV !== 'production' && { otp }), // Only in dev
      },
    });
  } catch (error) {
    next(error);
  }
};

// Verify OTP
const verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp, countryCode } = req.body;
    const redis = getRedisClient();

    // Get stored OTP from Redis
    const otpKey = `otp:${countryCode}${phone}`;
    const storedOTP = await redis.get(otpKey);

    if (!storedOTP) {
      throw new AppError('OTP expired. Please request a new one.', 400, 'OTP_EXPIRED');
    }

    if (storedOTP !== otp) {
      throw new AppError('Invalid OTP. Please try again.', 400, 'INVALID_OTP');
    }

    // Delete OTP from Redis
    await redis.del(otpKey);

    // Find or create user
    let user = await User.findOne({ phone, countryCode });
    let isNewUser = false;

    if (!user) {
      user = await User.create({ phone, countryCode });
      isNewUser = true;
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    // Store refresh token
    user.refreshToken = refreshToken;
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified,
          kycStatus: user.kycStatus,
          trustScore: user.trustScore,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Google OAuth
const googleAuth = async (req, res, next) => {
  try {
    const { googleId, email, name, avatar, phone } = req.body;

    if (!googleId || !email) {
      throw new AppError('Google ID and email are required', 400, 'MISSING_FIELDS');
    }

    // Find user by Google ID or phone
    let user = await User.findOne({
      $or: [{ googleId }, ...(phone ? [{ phone }] : [])],
    });

    if (user) {
      // Link Google account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.email) user.email = email;
      if (!user.name) user.name = name;
      if (!user.avatar) user.avatar = avatar;
    } else {
      // Create new user with Google
      user = await User.create({
        googleId,
        email,
        name,
        avatar,
        phone: phone || `google_${googleId}`,
      });
    }

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = refreshToken;
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified,
          kycStatus: user.kycStatus,
          trustScore: user.trustScore,
        },
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new AppError('Refresh token is required', 400, 'NO_REFRESH_TOKEN');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== token) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const newAccessToken = generateAccessToken({ userId: user._id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    req.user.refreshToken = null;
    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Admin login (React admin dashboard)
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@airpool.app').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (email.toLowerCase() !== adminEmail || password !== adminPassword) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const user = await User.findOne({
      email: adminEmail,
      role: { $in: ['admin', 'moderator'] },
    });

    if (!user) {
      throw new AppError(
        'Admin account not found. Run "make seed" to create the default admin user.',
        404,
        'ADMIN_NOT_FOUND'
      );
    }

    const token = generateAccessToken({ userId: user._id, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
const getCurrentUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  googleAuth,
  refreshToken,
  logout,
  adminLogin,
  getCurrentUser,
};
