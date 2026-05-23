import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { useConfigStore } from './src/store/configStore';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function App() {
  const { checkAuth, isLoading } = useAuthStore();
  const { fetchConfig } = useConfigStore();

  useEffect(() => {
    const initialize = async () => {
      try {
        await checkAuth();
        await fetchConfig();
      } catch (error) {
        console.warn('Initialization error:', error);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
