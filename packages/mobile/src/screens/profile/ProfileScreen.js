import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen({ navigation }) {
  const { user, logout, isGuest } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <ScrollView className="flex-1">
        {/* Profile Header */}
        <View className="bg-white px-6 pt-6 pb-8 border-b border-secondary-100">
          <Text className="text-2xl font-bold text-secondary-900 mb-6">Profile</Text>

          <View className="items-center">
            <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl text-primary font-bold">
                {(user?.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text className="text-secondary-900 text-xl font-bold">{user?.name || 'User'}</Text>
            {isGuest ? (
              <Text className="text-secondary-500 mt-1">Guest Account</Text>
            ) : (
              <Text className="text-secondary-500 mt-1">+91 {user?.phone}</Text>
            )}
            {user?.email && (
              <Text className="text-secondary-400 text-sm mt-1">{user.email}</Text>
            )}

            {/* Verification Badge */}
            <View className={`mt-3 px-4 py-2 rounded-full ${
              isGuest ? 'bg-secondary-100' : user?.isVerified ? 'bg-success/10' : 'bg-warning/10'
            }`}>
              <Text className={`font-medium text-sm ${
                isGuest ? 'text-secondary-600' : user?.isVerified ? 'text-success' : 'text-warning'
              }`}>
                {isGuest ? '👤 Guest Mode' : user?.isVerified ? '✓ Verified Account' : '⚠ Unverified'}
              </Text>
            </View>
          </View>
        </View>

        {/* Trust Score */}
        <TouchableOpacity
          className="bg-white mx-6 mt-4 rounded-2xl p-5 border border-secondary-100"
          onPress={() => navigation.navigate('TrustScore')}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-primary-50 rounded-full items-center justify-center mr-4">
                <Text className="text-xl">⭐</Text>
              </View>
              <View>
                <Text className="text-secondary-900 font-bold text-lg">Trust Score</Text>
                <Text className="text-secondary-500 text-sm">
                  {user?.completedRides || 0} rides completed
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-primary text-2xl font-bold">{user?.trustScore || 50}</Text>
              <Text className="text-secondary-400 text-xs">/100</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Menu Items */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-500 text-sm font-medium mb-3 uppercase">Account</Text>

          <MenuItem
            icon="📄"
            title="Documents & KYC"
            subtitle="Upload ID, flight tickets"
            onPress={() => navigation.navigate('DocumentHub')}
          />
          <MenuItem
            icon="🎫"
            title="Upload Flight Ticket"
            subtitle="Verify your upcoming flights"
            onPress={() => navigation.navigate('TicketUpload')}
          />
          <MenuItem
            icon="📊"
            title="Ride History"
            subtitle="View past pools and ratings"
            onPress={() => {}}
          />
        </View>

        <View className="px-6 mt-6">
          <Text className="text-secondary-500 text-sm font-medium mb-3 uppercase">Settings</Text>

          <MenuItem
            icon="🔔"
            title="Notifications"
            subtitle="Manage push notifications"
            onPress={() => {}}
          />
          <MenuItem
            icon="🌐"
            title="Language"
            subtitle="English"
            onPress={() => {}}
          />
          <MenuItem
            icon="🛡️"
            title="Privacy & Safety"
            subtitle="SOS, block list, data"
            onPress={() => {}}
          />
        </View>

        <View className="px-6 mt-6">
          <Text className="text-secondary-500 text-sm font-medium mb-3 uppercase">Support</Text>

          <MenuItem
            icon="❓"
            title="Help & FAQ"
            subtitle="Get answers to common questions"
            onPress={() => {}}
          />
          <MenuItem
            icon="📝"
            title="Report an Issue"
            subtitle="Safety concerns or bugs"
            onPress={() => {}}
          />
          <MenuItem
            icon="ℹ️"
            title="About AirPool"
            subtitle="Version 1.0.0"
            onPress={() => {}}
          />
        </View>

        {/* Logout */}
        <View className="px-6 mt-8 mb-8">
          <TouchableOpacity
            className="border-2 border-danger rounded-xl py-4 items-center"
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text className="text-danger font-semibold text-lg">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 flex-row items-center border border-secondary-100"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 bg-secondary-50 rounded-full items-center justify-center mr-4">
        <Text className="text-lg">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-secondary-900 font-medium">{title}</Text>
        <Text className="text-secondary-400 text-sm">{subtitle}</Text>
      </View>
      <Text className="text-secondary-300 text-lg">→</Text>
    </TouchableOpacity>
  );
}
