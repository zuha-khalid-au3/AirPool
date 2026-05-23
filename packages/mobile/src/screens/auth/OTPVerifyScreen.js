import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';

export default function OTPVerifyScreen({ navigation, route }) {
  const { phone } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const { verifyOTP, sendOTP } = useAuthStore();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOTPChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.every((digit) => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpString) => {
    const otpCode = otpString || otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const { isNewUser } = await verifyOTP(phone, otpCode);
      if (isNewUser) {
        navigation.replace('ProfileSetup');
      }
      // If not new user, the AppNavigator will auto-redirect to MainTabs
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Invalid OTP. Please try again.';
      Alert.alert('Verification Failed', message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOTP(phone);
      setCountdown(60);
      setCanResend(false);
      Alert.alert('OTP Sent', 'A new OTP has been sent to your phone');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        {/* Back Button */}
        <TouchableOpacity className="mb-8" onPress={() => navigation.goBack()}>
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text className="text-3xl font-bold text-secondary-900 mb-2">Verify OTP</Text>
        <Text className="text-secondary-500 text-base mb-8">
          Enter the 6-digit code sent to{' '}
          <Text className="font-semibold text-secondary-700">+91 {phone}</Text>
        </Text>

        {/* OTP Input */}
        <View className="flex-row justify-between mb-8">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              className={`w-12 h-14 border-2 rounded-xl text-center text-2xl font-bold ${
                digit ? 'border-primary text-secondary-900' : 'border-secondary-200 text-secondary-400'
              }`}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(value) => handleOTPChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              autoFocus={index === 0}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          className={`w-full py-4 rounded-xl items-center ${
            otp.every((d) => d) ? 'bg-primary' : 'bg-secondary-200'
          }`}
          onPress={() => handleVerify()}
          disabled={!otp.every((d) => d) || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              className={`text-lg font-semibold ${
                otp.every((d) => d) ? 'text-white' : 'text-secondary-400'
              }`}
            >
              Verify & Continue
            </Text>
          )}
        </TouchableOpacity>

        {/* Resend OTP */}
        <View className="mt-6 items-center">
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text className="text-primary font-semibold text-base">Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text className="text-secondary-400 text-base">
              Resend OTP in <Text className="font-semibold text-secondary-600">{countdown}s</Text>
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
