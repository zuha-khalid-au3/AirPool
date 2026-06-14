import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { useConfigStore } from './src/store/configStore';
import { useChatStore } from './src/store/chatStore';
import { socketService } from './src/services/socket.service';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();
  const { fetchConfig } = useConfigStore();
  const initSocketListeners = useChatStore((state) => state.initSocketListeners);

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

  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      useChatStore.setState({ socketListenersReady: false });
      return undefined;
    }

    initSocketListeners();
    socketService.connect();
    return undefined;
  }, [isAuthenticated, initSocketListeners]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
