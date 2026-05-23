import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function ProfileSetupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { updateUser } = useAuthStore();

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      const profileData = { name: name.trim() };
      if (email.trim()) profileData.email = email.trim();
      if (gender) profileData.gender = gender;

      const response = await api.patch('/users/profile', profileData);
      updateUser(response.data.data.user);
      // Navigation will be handled by AppNavigator (isAuthenticated = true)
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to save profile';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-12">
        {/* Header */}
        <Text className="text-3xl font-bold text-secondary-900 mb-2">Set up your profile</Text>
        <Text className="text-secondary-500 text-base mb-8">
          Help co-passengers know who you are
        </Text>

        {/* Name Input */}
        <View className="mb-6">
          <Text className="text-secondary-700 font-medium mb-2">Full Name *</Text>
          <TextInput
            className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-lg text-secondary-900"
            placeholder="Enter your name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        {/* Email Input */}
        <View className="mb-6">
          <Text className="text-secondary-700 font-medium mb-2">Email (Optional)</Text>
          <TextInput
            className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-lg text-secondary-900"
            placeholder="your@email.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Gender Selection */}
        <View className="mb-8">
          <Text className="text-secondary-700 font-medium mb-3">Gender</Text>
          <Text className="text-secondary-400 text-sm mb-3">
            Used for gender-specific ride pools (e.g., female-only pools)
          </Text>
          <View className="flex-row flex-wrap">
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                className={`mr-3 mb-3 px-5 py-3 rounded-full border-2 ${
                  gender === option.value
                    ? 'border-primary bg-primary-50'
                    : 'border-secondary-200 bg-white'
                }`}
                onPress={() => setGender(option.value)}
              >
                <Text
                  className={`font-medium ${
                    gender === option.value ? 'text-primary' : 'text-secondary-600'
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          className={`w-full py-4 rounded-xl items-center ${
            name.trim() ? 'bg-primary' : 'bg-secondary-200'
          }`}
          onPress={handleSave}
          disabled={!name.trim() || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              className={`text-lg font-semibold ${
                name.trim() ? 'text-white' : 'text-secondary-400'
              }`}
            >
              Continue
            </Text>
          )}
        </TouchableOpacity>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
