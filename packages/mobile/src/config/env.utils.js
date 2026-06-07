const PRIVATE_IP_PATTERN =
  /^(127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

const REMOTE_BUNDLER_HOST_PATTERN =
  /\.(exp\.direct|expo\.dev|ngrok\.io|ngrok-free\.app|trycloudflare\.com)$/i;

const NGROK_URL_PATTERN = /ngrok/i;

function isPrivateLanHost(host) {
  if (!host) return false;
  return PRIVATE_IP_PATTERN.test(host.split(':')[0].toLowerCase());
}

function isRemoteBundlerHost(host) {
  if (!host) return false;
  return REMOTE_BUNDLER_HOST_PATTERN.test(host.split(':')[0].toLowerCase());
}

function isNgrokUrl(url) {
  if (!url) return false;
  return NGROK_URL_PATTERN.test(url);
}

function isLocalhostUrl(url) {
  if (!url) return false;
  return /localhost|127\.0\.0\.1/.test(url);
}

function isRemoteApiUrl(url) {
  if (!url || isLocalhostUrl(url)) return false;
  return /^https?:\/\//.test(url);
}

function sanitizeUrl(url) {
  if (!url) return '';
  return url.replace(/\s+/g, '').trim();
}

function normalizePublicApiUrl(url) {
  let normalized = sanitizeUrl(url).replace(/\/+$/, '');

  if (/\.ngrok-free$/i.test(normalized)) {
    normalized = `${normalized}.app`;
  }

  return normalized;
}

function buildRemoteApiBaseUrl(publicApiUrl) {
  const baseUrl = normalizePublicApiUrl(publicApiUrl);
  if (!baseUrl) return '';

  if (baseUrl.endsWith('/api/v1')) {
    return baseUrl;
  }

  return `${baseUrl}/api/v1`;
}

function resolveDevUrl(envUrl, fallbackPath, host, options = {}) {
  const { usingExpoTunnel = false } = options;
  const normalizedEnvUrl = envUrl ? normalizePublicApiUrl(envUrl) : envUrl;

  if (normalizedEnvUrl && !isLocalhostUrl(normalizedEnvUrl)) {
    return normalizedEnvUrl;
  }

  if (usingExpoTunnel) {
    return envUrl || '';
  }

  const baseUrl = envUrl || `http://${host}:5000${fallbackPath}`;

  if (isLocalhostUrl(baseUrl)) {
    return baseUrl.replace(/localhost|127\.0\.0\.1/g, host);
  }

  return baseUrl;
}

function getNetworkErrorMessage(apiBaseUrl, usingExpoTunnel = false) {
  if (usingExpoTunnel && isLocalhostUrl(apiBaseUrl)) {
    return (
      'Remote testing requires a public backend URL. On your dev machine run:\n' +
      'AIRPOOL_PUBLIC_API_URL=https://YOUR-PUBLIC-URL yarn dev:remote'
    );
  }

  if (isLocalhostUrl(apiBaseUrl)) {
    return (
      'Cannot reach the server. Make sure the backend is running. ' +
      'On a physical device, use the same Wi-Fi as your computer or run yarn dev:remote for remote testing.'
    );
  }

  return (
    'Cannot reach the server.\n\n' +
    `API: ${apiBaseUrl}\n\n` +
    'Check that the backend is running and your ngrok/cloudflared tunnel is still active.'
  );
}

module.exports = {
  isPrivateLanHost,
  isRemoteBundlerHost,
  isNgrokUrl,
  isLocalhostUrl,
  isRemoteApiUrl,
  sanitizeUrl,
  normalizePublicApiUrl,
  buildRemoteApiBaseUrl,
  resolveDevUrl,
  getNetworkErrorMessage,
};
