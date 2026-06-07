import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '../config/env';

WebBrowser.maybeCompleteAuthSession();

const isGoogleConfigured = Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);

  const signIn = async () => {
    if (!isGoogleConfigured) {
      throw new Error(
        'Google Sign-In is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to packages/mobile/.env'
      );
    }

    const returnUrl = Linking.createURL('auth');
    const startUrl = `${API_BASE_URL}/auth/google/start?returnUrl=${encodeURIComponent(returnUrl)}`;

    if (__DEV__) {
      console.log('[AirPool] Google OAuth start URL:', startUrl);
      console.log('[AirPool] Google OAuth return URL:', returnUrl);
    }

    setIsLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return null;
      }

      if (result.type !== 'success') {
        throw new Error('Google Sign-In failed. Please try again.');
      }

      const { queryParams } = Linking.parse(result.url);
      const session = queryParams?.session;

      if (!session) {
        throw new Error('Google login did not return a session. Check backend Google OAuth settings.');
      }

      return { session };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    isConfigured: isGoogleConfigured,
  };
}
