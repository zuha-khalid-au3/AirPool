const { AppError } = require('../middleware/errorHandler');

function getGoogleRedirectBaseUrl() {
  const base = process.env.GOOGLE_REDIRECT_BASE_URL || process.env.API_PUBLIC_URL;
  if (!base) {
    return `http://localhost:${process.env.PORT || 5000}`;
  }
  return base.replace(/\/+$/, '');
}

function getGoogleOAuthCallbackUrl() {
  return `${getGoogleRedirectBaseUrl()}/api/v1/auth/google/callback`;
}

function getAllowedGoogleClientIds() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter(Boolean);
}

async function verifyGoogleIdToken(idToken) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new AppError('Invalid Google token', 401, 'INVALID_GOOGLE_TOKEN');
  }

  const allowedClientIds = getAllowedGoogleClientIds();
  if (allowedClientIds.length > 0 && !allowedClientIds.includes(payload.aud)) {
    throw new AppError('Google token audience mismatch', 401, 'INVALID_GOOGLE_TOKEN');
  }

  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new AppError('Google email is not verified', 401, 'GOOGLE_EMAIL_NOT_VERIFIED');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    avatar: payload.picture,
  };
}

async function exchangeGoogleAuthCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getGoogleOAuthCallbackUrl(),
      grant_type: 'authorization_code',
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new AppError(
      payload.error_description || 'Failed to exchange Google auth code',
      401,
      'GOOGLE_TOKEN_EXCHANGE_FAILED'
    );
  }

  return payload;
}

module.exports = {
  getGoogleRedirectBaseUrl,
  getGoogleOAuthCallbackUrl,
  verifyGoogleIdToken,
  exchangeGoogleAuthCode,
};
