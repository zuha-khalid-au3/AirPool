import React from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center items-center px-6">
        {/* Logo & Illustration */}
        <View className="items-center mb-12">
          <View className="w-24 h-24 bg-primary-100 rounded-full items-center justify-center mb-6">
            <Text className="text-4xl">✈️</Text>
          </View>
          <Text className="text-4xl font-bold text-secondary-900 mb-2">AirPool</Text>
          <Text className="text-lg text-secondary-500 text-center leading-7">
            Share rides from airports.{'\n'}Save money. Make connections.
          </Text>
        </View>

        {/* Features */}
        <View className="w-full mb-12">
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

        {/* Action Buttons */}
        <View className="w-full">
          <TouchableOpacity
            className="bg-primary w-full py-4 rounded-xl items-center mb-4"
            onPress={() => navigation.navigate('PhoneInput')}
            activeOpacity={0.8}
          >
            <Text className="text-white text-lg font-semibold">Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="border-2 border-secondary-200 w-full py-4 rounded-xl items-center"
            onPress={() => navigation.navigate('PhoneInput')}
            activeOpacity={0.8}
          >
            <Text className="text-secondary-700 text-lg font-semibold">I have an account</Text>
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
