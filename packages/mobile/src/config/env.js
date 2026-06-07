import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  isPrivateLanHost,
  isRemoteBundlerHost,
  resolveDevUrl as buildDevUrl,
} from './env.utils';

const PROD_API_URL = 'https://api.airpool.app/api/v1';
const PROD_SOCKET_URL = 'https://api.airpool.app';

function isUsingExpoTunnel() {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.expoConfig?.hostUri;

  if (!debuggerHost) return false;
  return isRemoteBundlerHost(debuggerHost.split(':')[0]);
}

function getDevServerHost() {
  const candidates = [];

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
    if (match?.[1]) {
      candidates.push(match[1]);
    }
  }

  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.expoConfig?.hostUri;

  if (debuggerHost) {
    candidates.push(debuggerHost.split(':')[0]);
  }

  for (const host of candidates) {
    const normalizedHost = host.split(':')[0];
    if (isPrivateLanHost(normalizedHost) && !isRemoteBundlerHost(normalizedHost)) {
      return normalizedHost;
    }
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return 'localhost';
}

const usingExpoTunnel = isUsingExpoTunnel();
const devUrlOptions = { usingExpoTunnel };

const API_BASE_URL = __DEV__
  ? buildDevUrl(
      process.env.EXPO_PUBLIC_API_BASE_URL,
      '/api/v1',
      getDevServerHost(),
      devUrlOptions
    )
  : PROD_API_URL;

const SOCKET_URL = __DEV__
  ? buildDevUrl(
      process.env.EXPO_PUBLIC_SOCKET_URL,
      '',
      getDevServerHost(),
      devUrlOptions
    )
  : PROD_SOCKET_URL;

if (__DEV__) {
  console.log('[AirPool] API:', API_BASE_URL);
  if (usingExpoTunnel && /localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
    console.warn(
      '[AirPool] Expo tunnel is active but API still points to localhost. ' +
        'Restart with: AIRPOOL_PUBLIC_API_URL=https://YOUR-PUBLIC-URL yarn dev:remote'
    );
  }
}

export { API_BASE_URL, SOCKET_URL, usingExpoTunnel };
