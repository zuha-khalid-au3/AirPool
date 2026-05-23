import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5000/api/v1'
  : 'https://api.airpool.app/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const tokenData = await SecureStore.getItemAsync('auth_tokens');
      if (tokenData) {
        const { accessToken } = JSON.parse(tokenData);
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch (error) {
      // Ignore token retrieval errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokenData = await SecureStore.getItemAsync('auth_tokens');
        if (tokenData) {
          const { refreshToken } = JSON.parse(tokenData);
          const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken,
          });

          const { tokens } = response.data.data;
          await SecureStore.setItemAsync('auth_tokens', JSON.stringify(tokens));

          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        await SecureStore.deleteItemAsync('auth_tokens');
        // The auth store will handle the redirect
      }
    }

    return Promise.reject(error);
  }
);

export default api;
