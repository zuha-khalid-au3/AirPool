import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { API_BASE_URL, usingExpoTunnel } from '../../config/env';
import { getNetworkErrorMessage } from '../../config/env.utils';

export default function WelcomeScreen({ navigation }) {
  const guestLogin = useAuthStore((state) => state.guestLogin);
  const googleAuth = useAuthStore((state) => state.googleAuth);
  const { signIn: signInWithGoogle, isLoading: isGoogleLoading, isConfigured } = useGoogleAuth();
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    try {
      await guestLogin();
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        (error.message === 'Network Error'
          ? getNetworkErrorMessage(API_BASE_URL, usingExpoTunnel)
          : error.message || 'Unable to continue as guest. Please try again.');
      Alert.alert('Guest login failed', message);
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const authentication = await signInWithGoogle();
      if (!authentication) return;

      await googleAuth(authentication);
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        (error.message === 'Network Error'
          ? getNetworkErrorMessage(API_BASE_URL, usingExpoTunnel)
          : error.message || 'Unable to sign in with Google. Please try again.');
      Alert.alert('Google login failed', message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <View className="flex-1 justify-center items-center px-6">
        <View className="items-center mb-10">
          <View className="w-28 h-28 bg-primary rounded-3xl items-center justify-center mb-6 shadow-lg">
            <Text className="text-5xl">✈️</Text>
          </View>
          <Text className="text-4xl font-bold text-secondary-900 mb-2">AirPool</Text>
          <Text className="text-lg text-secondary-500 text-center leading-7">
            Share rides from airports.{'\n'}Save money. Make connections.
          </Text>
        </View>

        <View className="w-full mb-10 bg-white rounded-3xl p-5 shadow-sm border border-secondary-100">
          <FeatureItem
            icon="🤝"
            title="Connect with Co-Passengers"
            description="Find people on the same flight heading your way"
          />
          <FeatureItem
            icon="💰"
            title="Split the Fare"
            description="Share cab costs and save up to 75%"
          />
          <FeatureItem
            icon="🔒"
            title="Verified & Safe"
            description="All users verified with flight tickets & ID"
          />
        </View>

        <View className="w-full">
          <TouchableOpacity
            className="bg-primary w-full py-4 rounded-2xl items-center mb-3 shadow-md"
            onPress={() => navigation.navigate('PhoneInput')}
            activeOpacity={0.8}
          >
            <Text className="text-white text-lg font-semibold">Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="border-2 border-secondary-200 bg-white w-full py-4 rounded-2xl items-center mb-3"
            onPress={() => navigation.navigate('PhoneInput')}
            activeOpacity={0.8}
          >
            <Text className="text-secondary-700 text-lg font-semibold">I have an account</Text>
          </TouchableOpacity>

          {isConfigured && (
            <TouchableOpacity
              className="border-2 border-secondary-200 w-full py-4 rounded-xl items-center mb-4 flex-row justify-center"
              onPress={handleGoogleLogin}
              disabled={isGoogleLoading}
              activeOpacity={0.8}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#0284C7" />
              ) : (
                <>
                  <Text className="text-lg mr-2">G</Text>
                  <Text className="text-secondary-700 text-lg font-semibold">Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="w-full py-4 rounded-xl items-center"
            onPress={handleGuestLogin}
            disabled={isGuestLoading}
            activeOpacity={0.8}
          >
            {isGuestLoading ? (
              <ActivityIndicator color="#0284C7" />
            ) : (
              <Text className="text-primary text-base font-semibold">Continue as Guest</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View className="pb-4 items-center">
        <Text className="text-secondary-400 text-xs">
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <View className="flex-row items-center mb-4">
      <View className="w-12 h-12 bg-primary-50 rounded-full items-center justify-center mr-4">
        <Text className="text-xl">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-secondary-900 font-semibold text-base">{title}</Text>
        <Text className="text-secondary-500 text-sm">{description}</Text>
      </View>
    </View>
  );
}
