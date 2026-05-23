import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tokens: null,

  // Check if user is already authenticated
  checkAuth: async () => {
    try {
      const tokenData = await SecureStore.getItemAsync('auth_tokens');
      if (tokenData) {
        const tokens = JSON.parse(tokenData);
        api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

        const response = await api.get('/auth/me');
        set({
          user: response.data.data.user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Token might be expired, try refresh
      try {
        await get().refreshToken();
      } catch (refreshError) {
        await SecureStore.deleteItemAsync('auth_tokens');
        set({ isAuthenticated: false, isLoading: false, user: null, tokens: null });
      }
    }
  },

  // Send OTP
  sendOTP: async (phone, countryCode = '+91') => {
    const response = await api.post('/auth/send-otp', { phone, countryCode });
    return response.data;
  },

  // Verify OTP and login
  verifyOTP: async (phone, otp, countryCode = '+91') => {
    const response = await api.post('/auth/verify-otp', { phone, otp, countryCode });
    const { user, tokens, isNewUser } = response.data.data;

    // Store tokens securely
    await SecureStore.setItemAsync('auth_tokens', JSON.stringify(tokens));
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

    set({ user, tokens, isAuthenticated: true });
    return { user, isNewUser };
  },

  // Google Auth
  googleAuth: async (googleData) => {
    const response = await api.post('/auth/google', googleData);
    const { user, tokens } = response.data.data;

    await SecureStore.setItemAsync('auth_tokens', JSON.stringify(tokens));
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

    set({ user, tokens, isAuthenticated: true });
    return user;
  },

  // Refresh token
  refreshToken: async () => {
    const tokenData = await SecureStore.getItemAsync('auth_tokens');
    if (!tokenData) throw new Error('No tokens');

    const { refreshToken } = JSON.parse(tokenData);
    const response = await api.post('/auth/refresh-token', { refreshToken });
    const { tokens: newTokens } = response.data.data;

    await SecureStore.setItemAsync('auth_tokens', JSON.stringify(newTokens));
    api.defaults.headers.common['Authorization'] = `Bearer ${newTokens.accessToken}`;

    set({ tokens: newTokens });
  },

  // Update user profile
  updateUser: (userData) => {
    set({ user: { ...get().user, ...userData } });
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout API errors
    }
    await SecureStore.deleteItemAsync('auth_tokens');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, tokens: null, isAuthenticated: false });
  },
}));
