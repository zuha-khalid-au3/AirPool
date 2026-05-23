const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? 'http://localhost:5000/api/v1' : 'https://api.airpool.app/api/v1');

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  (__DEV__ ? 'http://localhost:5000' : 'https://api.airpool.app');

export { API_BASE_URL, SOCKET_URL };
