import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';

export default function PhoneInputScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendOTP } = useAuthStore();

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    try {
      await sendOTP(phone);
      navigation.navigate('OTPVerify', { phone });
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to send OTP. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        {/* Back Button */}
        <TouchableOpacity
          className="mb-8"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text className="text-3xl font-bold text-secondary-900 mb-2">
          Enter your phone number
        </Text>
        <Text className="text-secondary-500 text-base mb-8">
          We'll send you a verification code via SMS
        </Text>

        {/* Phone Input */}
        <View className="flex-row items-center border-2 border-secondary-200 rounded-xl px-4 py-3 mb-6">
          <View className="flex-row items-center mr-3 pr-3 border-r border-secondary-200">
            <Text className="text-2xl mr-2">🇮🇳</Text>
            <Text className="text-secondary-700 text-lg font-medium">+91</Text>
          </View>
          <TextInput
            className="flex-1 text-lg text-secondary-900"
            placeholder="98765 43210"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
            autoFocus
          />
        </View>

        {/* Phone number validation hint */}
        {phone.length > 0 && phone.length < 10 && (
          <Text className="text-warning text-sm mb-4">
            {10 - phone.length} more digits needed
          </Text>
        )}

        {/* Send OTP Button */}
        <TouchableOpacity
          className={`w-full py-4 rounded-xl items-center ${
            phone.length === 10 ? 'bg-primary' : 'bg-secondary-200'
          }`}
          onPress={handleSendOTP}
          disabled={phone.length !== 10 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              className={`text-lg font-semibold ${
                phone.length === 10 ? 'text-white' : 'text-secondary-400'
              }`}
            >
              Send OTP
            </Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View className="mt-8 bg-primary-50 p-4 rounded-xl">
          <Text className="text-primary-700 text-sm leading-5">
            💡 Your phone number is used only for verification. We never share it with other users
            without your permission.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
