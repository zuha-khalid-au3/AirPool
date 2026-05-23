import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export const useConfigStore = create((set, get) => ({
  theme: {
    primaryColor: '#0284C7',
    secondaryColor: '#0F172A',
    successColor: '#10B981',
    warningColor: '#F59E0B',
  },
  airports: [],
  vehicleTypes: [],
  announcements: [],
  featureFlags: {},
  isLoaded: false,

  // Fetch all app configuration from server
  fetchConfig: async () => {
    try {
      // Try to load cached config first
      const cached = await AsyncStorage.getItem('app_config');
      if (cached) {
        const parsedConfig = JSON.parse(cached);
        set({ ...parsedConfig, isLoaded: true });
      }

      // Fetch fresh config from server
      const response = await api.get('/config/app');
      const config = response.data.data;

      const newState = {
        theme: {
          primaryColor: config.theme?.theme_primary_color || '#0284C7',
          secondaryColor: config.theme?.theme_secondary_color || '#0F172A',
          successColor: config.theme?.theme_success_color || '#10B981',
          warningColor: config.theme?.theme_warning_color || '#F59E0B',
        },
        airports: config.airports?.supported_airports || [],
        vehicleTypes: config.vehicles?.vehicle_types || [],
        announcements: config.announcements?.active_announcements || [],
        featureFlags: config.feature_flags || {},
        isLoaded: true,
      };

      set(newState);

      // Cache the config
      await AsyncStorage.setItem('app_config', JSON.stringify(newState));
    } catch (error) {
      console.warn('Failed to fetch config:', error.message);
      // Use cached or defaults
      set({ isLoaded: true });
    }
  },

  // Check if a feature is enabled
  isFeatureEnabled: (featureKey) => {
    const { featureFlags } = get();
    return featureFlags[featureKey] === true;
  },

  // Get airport by code
  getAirport: (code) => {
    const { airports } = get();
    return airports.find((a) => a.code === code);
  },
}));
