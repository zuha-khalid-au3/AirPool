import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

const PROD_API_URL = 'https://api.airpool.app/api/v1';
const PROD_SOCKET_URL = 'https://api.airpool.app';

function getDevServerHost() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
    const host = match?.[1];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.expoConfig?.hostUri?.split(':')[0];

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return 'localhost';
}

function resolveDevUrl(path, envUrl, fallbackPath) {
  const host = getDevServerHost();
  const baseUrl = envUrl || `http://${host}:5000${fallbackPath}`;

  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return baseUrl.replace(/localhost|127\.0\.0\.1/g, host);
  }

  return baseUrl;
}

const API_BASE_URL = __DEV__
  ? resolveDevUrl('/api/v1', process.env.EXPO_PUBLIC_API_BASE_URL, '/api/v1')
  : PROD_API_URL;

const SOCKET_URL = __DEV__
  ? resolveDevUrl('', process.env.EXPO_PUBLIC_SOCKET_URL, '')
  : PROD_SOCKET_URL;

export { API_BASE_URL, SOCKET_URL };
