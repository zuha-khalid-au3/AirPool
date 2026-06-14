import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';

import { useAuthStore } from '../store/authStore';

// Auth Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Verification Screens
import DocumentHubScreen from '../screens/verification/DocumentHubScreen';
import TicketUploadScreen from '../screens/verification/TicketUploadScreen';
import OCRConfirmScreen from '../screens/verification/OCRConfirmScreen';

// Pool Screens
import HomeDashboard from '../screens/pool/HomeDashboard';
import CreatePoolScreen from '../screens/pool/CreatePoolScreen';
import JoinPoolScreen from '../screens/pool/JoinPoolScreen';
import PoolDetailsScreen from '../screens/pool/PoolDetailsScreen';

// Chat Screens
import GroupChatScreen from '../screens/chat/GroupChatScreen';
import InFlightModeScreen from '../screens/chat/InFlightModeScreen';
import PostLandingMapScreen from '../screens/chat/PostLandingMapScreen';
import LiveLocationScreen from '../screens/chat/LiveLocationScreen';
import CallScreen from '../screens/chat/CallScreen';

// Profile Screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import TrustScoreScreen from '../screens/profile/TrustScoreScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Icon Component
const TabIcon = ({ name, focused }) => (
  <View className={`items-center justify-center ${focused ? 'opacity-100' : 'opacity-50'}`}>
    <Text className={`text-xs mt-1 ${focused ? 'text-primary font-bold' : 'text-secondary-400'}`}>
      {name}
    </Text>
  </View>
);

// Main Tab Navigator (for authenticated users)
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
        },
        tabBarActiveTintColor: '#0284C7',
        tabBarInactiveTintColor: '#94A3B8',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="MyPools"
        component={PoolStack}
        options={{
          tabBarLabel: 'My Pools',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

// Home Stack
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeDashboard} />
      <Stack.Screen name="CreatePool" component={CreatePoolScreen} />
      <Stack.Screen name="JoinPool" component={JoinPoolScreen} />
      <Stack.Screen name="PoolDetails" component={PoolDetailsScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="InFlightMode" component={InFlightModeScreen} />
      <Stack.Screen name="PostLandingMap" component={PostLandingMapScreen} />
      <Stack.Screen name="LiveLocation" component={LiveLocationScreen} />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

// Pool Stack
function PoolStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JoinPoolList" component={JoinPoolScreen} />
      <Stack.Screen name="PoolDetails" component={PoolDetailsScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="LiveLocation" component={LiveLocationScreen} />
      <Stack.Screen name="PostLandingMap" component={PostLandingMapScreen} />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="TrustScore" component={TrustScoreScreen} />
      <Stack.Screen name="DocumentHub" component={DocumentHubScreen} />
      <Stack.Screen name="TicketUpload" component={TicketUploadScreen} />
      <Stack.Screen name="OCRConfirm" component={OCRConfirmScreen} />
    </Stack.Navigator>
  );
}

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  return <MainTabs />;
}
