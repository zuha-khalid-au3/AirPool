import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const normalizeUser = (user) => {
  if (!user) return null;
  return { ...user, id: user.id || user._id, isGuest: user.isGuest || false };
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isGuest: false,
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
        const user = normalizeUser(response.data.data.user);
        set({
          user,
          tokens,
          isAuthenticated: true,
          isGuest: user.isGuest,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Token might be expired, try refresh
      try {
        await get().refreshToken();
        const response = await api.get('/auth/me');
        const user = normalizeUser(response.data.data.user);
        set({
          user,
          isAuthenticated: true,
          isGuest: user.isGuest,
          isLoading: false,
        });
      } catch (refreshError) {
        await SecureStore.deleteItemAsync('auth_tokens');
        await SecureStore.deleteItemAsync('guest_user_id');
        set({
          isAuthenticated: false,
          isGuest: false,
          isLoading: false,
          user: null,
          tokens: null,
        });
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
    await SecureStore.deleteItemAsync('guest_user_id');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

    set({ user: normalizeUser(user), tokens, isAuthenticated: true, isGuest: false });
    return { user, isNewUser };
  },

  // Guest login — full app access with anonymous account
  guestLogin: async () => {
    const storedGuestId = await SecureStore.getItemAsync('guest_user_id');
    const response = await api.post('/auth/guest-login', storedGuestId ? { guestId: storedGuestId } : {});
    const { user, tokens } = response.data.data;

    await SecureStore.setItemAsync('auth_tokens', JSON.stringify(tokens));
    if (user.isGuest) {
      await SecureStore.setItemAsync('guest_user_id', user.id);
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

    set({ user: normalizeUser(user), tokens, isAuthenticated: true, isGuest: true });
    return user;
  },

  // Google Auth (browser flow via backend — works in Expo Go + tunnel)
  googleAuth: async ({ session }) => {
    const response = await api.post('/auth/google/session', { session });
    const { user, tokens } = response.data.data;

    await SecureStore.setItemAsync('auth_tokens', JSON.stringify(tokens));
    await SecureStore.deleteItemAsync('guest_user_id');
    api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

    set({ user: normalizeUser(user), tokens, isAuthenticated: true, isGuest: false });
    return normalizeUser(user);
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
    set({ user: normalizeUser({ ...get().user, ...userData }) });
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout API errors
    }
    await SecureStore.deleteItemAsync('auth_tokens');
    await SecureStore.deleteItemAsync('guest_user_id');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, tokens: null, isAuthenticated: false, isGuest: false });
  },
}));
