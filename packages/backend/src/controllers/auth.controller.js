const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const { generateOTP } = require('../utils/encryption');
const { getRedisClient } = require('../config/redis');
const { AppError } = require('../middleware/errorHandler');
const { verifyGoogleIdToken, exchangeGoogleAuthCode, getGoogleOAuthCallbackUrl } = require('../utils/googleAuth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const formatAuthUser = (user) => ({
  id: user._id,
  phone: user.phone,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isVerified: user.isVerified,
  kycStatus: user.kycStatus,
  trustScore: user.trustScore,
  role: user.role,
  isGuest: user.isGuest || false,
});

const issueUserTokens = async (user) => {
  const accessToken = generateAccessToken({ userId: user._id, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user._id });

  user.refreshToken = refreshToken;
  user.lastActive = new Date();
  await user.save({ validateBeforeSave: false });

  return {
    user: formatAuthUser(user),
    tokens: { accessToken, refreshToken },
  };
};

async function upsertGoogleUser({ googleId, email, name, avatar, phone }) {
  let user = await User.findOne({
    $or: [{ googleId }, { email: email.toLowerCase() }, ...(phone ? [{ phone }] : [])],
  });

  if (user) {
    if (!user.googleId) user.googleId = googleId;
    if (!user.email) user.email = email.toLowerCase();
    if (!user.name && name) user.name = name;
    if (!user.avatar && avatar) user.avatar = avatar;
    user.isGuest = false;
    await user.save({ validateBeforeSave: false });
  } else {
    user = await User.create({
      googleId,
      email: email.toLowerCase(),
      name,
      avatar,
      phone: phone || `google_${googleId}`,
    });
  }

  return user;
}

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

    const authData = await issueUserTokens(user);

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        ...authData,
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
    let { googleId, email, name, avatar, phone, idToken } = req.body;

    if (idToken) {
      const verified = await verifyGoogleIdToken(idToken);
      googleId = verified.googleId;
      email = verified.email;
      name = verified.name || name;
      avatar = verified.avatar || avatar;
    }

    if (!googleId || !email) {
      throw new AppError('Google ID and email are required', 400, 'MISSING_FIELDS');
    }

    const user = await upsertGoogleUser({ googleId, email, name, avatar, phone });
    const authData = await issueUserTokens(user);

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: authData,
    });
  } catch (error) {
    next(error);
  }
};

// Browser-based Google OAuth for Expo Go (redirect goes through your public backend URL)
const googleOAuthStart = async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('Google OAuth is not configured on the server', 503, 'GOOGLE_NOT_CONFIGURED');
    }

    const returnUrl = req.query.returnUrl || 'airpool://auth';
    const state = uuidv4();
    const redis = getRedisClient();

    await redis.setEx(`google_oauth_state:${state}`, 300, JSON.stringify({ returnUrl }));

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: getGoogleOAuthCallbackUrl(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    next(error);
  }
};

const googleOAuthCallback = async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      throw new AppError(`Google OAuth error: ${error}`, 401, 'GOOGLE_OAUTH_ERROR');
    }

    if (!code || !state) {
      throw new AppError('Missing Google OAuth parameters', 400, 'INVALID_OAUTH_CALLBACK');
    }

    const redis = getRedisClient();
    const statePayload = await redis.get(`google_oauth_state:${state}`);

    if (!statePayload) {
      throw new AppError('OAuth state expired. Please try again.', 400, 'OAUTH_STATE_EXPIRED');
    }

    await redis.del(`google_oauth_state:${state}`);
    const { returnUrl } = JSON.parse(statePayload);

    const tokenPayload = await exchangeGoogleAuthCode(code);
    const profile = await verifyGoogleIdToken(tokenPayload.id_token);
    const user = await upsertGoogleUser(profile);
    const authData = await issueUserTokens(user);

    const sessionCode = uuidv4();
    await redis.setEx(
      `google_login_session:${sessionCode}`,
      120,
      JSON.stringify(authData)
    );

    const separator = returnUrl.includes('?') ? '&' : '?';
    res.redirect(`${returnUrl}${separator}session=${sessionCode}`);
  } catch (error) {
    next(error);
  }
};

const googleSessionExchange = async (req, res, next) => {
  try {
    const { session } = req.body;
    const redis = getRedisClient();
    const payload = await redis.get(`google_login_session:${session}`);

    if (!payload) {
      throw new AppError('Login session expired. Please try Google sign-in again.', 400, 'GOOGLE_SESSION_EXPIRED');
    }

    await redis.del(`google_login_session:${session}`);

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: JSON.parse(payload),
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

// Guest login — creates a real user with JWT so all app features work
const guestLogin = async (req, res, next) => {
  try {
    const { guestId } = req.body;

    let user = null;
    if (guestId) {
      user = await User.findOne({ _id: guestId, isGuest: true });
    }

    if (!user) {
      const guestUuid = uuidv4().replace(/-/g, '').slice(0, 12);
      user = await User.create({
        phone: `guest_${guestUuid}`,
        countryCode: '+00',
        name: `Guest ${guestUuid.slice(0, 4).toUpperCase()}`,
        isGuest: true,
      });
      logger.info(`Guest user created: ${user._id}`);
    }

    const authData = await issueUserTokens(user);

    res.status(200).json({
      success: true,
      message: 'Guest login successful',
      data: authData,
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
  googleOAuthStart,
  googleOAuthCallback,
  googleSessionExchange,
  refreshToken,
  logout,
  guestLogin,
  adminLogin,
  getCurrentUser,
};
