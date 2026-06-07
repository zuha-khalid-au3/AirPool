const {
  isPrivateLanHost,
  isRemoteBundlerHost,
  isNgrokUrl,
  isLocalhostUrl,
  sanitizeUrl,
  normalizePublicApiUrl,
  buildRemoteApiBaseUrl,
  resolveDevUrl,
  getNetworkErrorMessage,
} = require('./env.utils');

describe('env URL resolution', () => {
  test('uses explicit public API URLs as-is', () => {
    expect(resolveDevUrl('https://abc.ngrok-free.app/api/v1', '/api/v1', 'localhost')).toBe(
      'https://abc.ngrok-free.app/api/v1'
    );
  });

  test('replaces localhost with LAN IP for same-network devices', () => {
    expect(
      resolveDevUrl('http://localhost:5000/api/v1', '/api/v1', '192.168.1.42')
    ).toBe('http://192.168.1.42:5000/api/v1');
  });

  test('does not map localhost to LAN when Expo tunnel is active without a public URL', () => {
    expect(
      resolveDevUrl('http://localhost:5000/api/v1', '/api/v1', '192.168.1.42', {
        usingExpoTunnel: true,
      })
    ).toBe('http://localhost:5000/api/v1');
  });

  test('ignores Expo tunnel hosts when resolving localhost URLs', () => {
    expect(isRemoteBundlerHost('u.expo.dev')).toBe(true);
    expect(isRemoteBundlerHost('abc.exp.direct')).toBe(true);
    expect(isPrivateLanHost('abc.exp.direct')).toBe(false);
  });

  test('detects ngrok URLs for request bypass header', () => {
    expect(isNgrokUrl('https://abc.ngrok-free.app/api/v1')).toBe(true);
    expect(isNgrokUrl('https://1112-115-99-221-32.ngrok')).toBe(true);
  });

  test('detects private LAN hosts', () => {
    expect(isPrivateLanHost('192.168.0.15')).toBe(true);
    expect(isPrivateLanHost('10.0.0.5')).toBe(true);
    expect(isPrivateLanHost('localhost')).toBe(true);
  });

  test('detects localhost URLs', () => {
    expect(isLocalhostUrl('http://localhost:5000/api/v1')).toBe(true);
    expect(isLocalhostUrl('http://127.0.0.1:5000')).toBe(true);
    expect(isLocalhostUrl('https://api.airpool.app/api/v1')).toBe(false);
  });

  test('returns helpful remote testing error copy', () => {
    expect(getNetworkErrorMessage('http://localhost:5000/api/v1', true)).toContain(
      'yarn dev:remote'
    );
    expect(getNetworkErrorMessage('https://abc.ngrok-free.app/api/v1', true)).toContain(
      'abc.ngrok-free.app'
    );
  });

  test('sanitizes whitespace from URLs', () => {
    expect(sanitizeUrl(' https://abc.ngrok-free.app ')).toBe('https://abc.ngrok-free.app');
  });

  test('fixes incomplete ngrok-free URLs', () => {
    expect(normalizePublicApiUrl('https://2885-115-99-221-32.ngrok-free')).toBe(
      'https://2885-115-99-221-32.ngrok-free.app'
    );
    expect(buildRemoteApiBaseUrl('https://2885-115-99-221-32.ngrok-free')).toBe(
      'https://2885-115-99-221-32.ngrok-free.app/api/v1'
    );
  });
});
