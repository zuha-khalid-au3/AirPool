import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InFlightModeScreen({ navigation, route }) {
  const { chatRoomId, poolId } = route.params || {};
  const [isInFlightMode, setIsInFlightMode] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState([]);
  const [bleStatus, setBleStatus] = useState('idle'); // idle, scanning, connected

  const enableInFlightMode = () => {
    setIsInFlightMode(true);
    setBleStatus('scanning');
    // In production, this would activate BLE scanning
    // BLE is permitted in airplane mode as it uses very low power
    Alert.alert(
      'In-Flight Mode Active',
      'AirPool will use Bluetooth Low Energy to find nearby pool members. This is safe to use during flight.',
      [{ text: 'OK' }]
    );

    // Simulate finding nearby devices (in production, use react-native-ble-plx)
    setTimeout(() => {
      setNearbyDevices([
        { id: '1', name: 'AirPool User', signal: -45 },
      ]);
      setBleStatus('connected');
    }, 3000);
  };

  const disableInFlightMode = () => {
    setIsInFlightMode(false);
    setBleStatus('idle');
    setNearbyDevices([]);
  };

  return (
    <SafeAreaView className="flex-1 bg-secondary-900">
      <ScrollView className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-primary-300 text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">In-Flight Mode</Text>
        </View>

        {/* Status Card */}
        <View className="bg-secondary-800 rounded-2xl p-6 mb-6 border border-secondary-700">
          <View className="items-center mb-6">
            <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
              isInFlightMode ? 'bg-primary/20' : 'bg-secondary-700'
            }`}>
              <Text className="text-4xl">{isInFlightMode ? '📡' : '✈️'}</Text>
            </View>
            <Text className="text-white text-xl font-bold">
              {isInFlightMode ? 'BLE Active' : 'Airplane Mode'}
            </Text>
            <Text className="text-secondary-400 text-center mt-2">
              {isInFlightMode
                ? 'Scanning for nearby AirPool members via Bluetooth'
                : 'Enable BLE communication to connect with co-passengers'}
            </Text>
          </View>

          {/* BLE Status */}
          {isInFlightMode && (
            <View className="bg-secondary-700 rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-secondary-300">BLE Status</Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${
                    bleStatus === 'connected' ? 'bg-success' : 'bg-warning'
                  }`} />
                  <Text className="text-white capitalize">{bleStatus}</Text>
                </View>
              </View>
              {nearbyDevices.length > 0 && (
                <View className="mt-3 pt-3 border-t border-secondary-600">
                  <Text className="text-secondary-400 text-sm mb-2">
                    Nearby AirPool Members: {nearbyDevices.length}
                  </Text>
                  {nearbyDevices.map((device) => (
                    <View key={device.id} className="flex-row items-center py-2">
                      <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center mr-3">
                        <Text className="text-primary text-sm">👤</Text>
                      </View>
                      <Text className="text-white">{device.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Toggle Button */}
          <TouchableOpacity
            className={`w-full py-4 rounded-xl items-center ${
              isInFlightMode ? 'bg-danger/80' : 'bg-primary'
            }`}
            onPress={isInFlightMode ? disableInFlightMode : enableInFlightMode}
            activeOpacity={0.8}
          >
            <Text className="text-white text-lg font-semibold">
              {isInFlightMode ? 'Disable In-Flight Mode' : 'Enable In-Flight Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View className="bg-secondary-800 rounded-2xl p-6 mb-6 border border-secondary-700">
          <Text className="text-white font-bold text-lg mb-4">How it works</Text>

          <InfoStep
            number="1"
            title="BLE is flight-safe"
            description="Bluetooth Low Energy operates at milliwatt power levels and is approved by FAA/EASA for in-flight use."
          />
          <InfoStep
            number="2"
            title="Proximity detection"
            description="We detect nearby AirPool users on the same flight using BLE beacons."
          />
          <InfoStep
            number="3"
            title="Pre-cached data"
            description="Pool details and member info are cached before takeoff. No internet needed."
          />
          <InfoStep
            number="4"
            title="Auto-sync on landing"
            description="All messages and updates sync automatically once you're back online."
          />
        </View>

        {/* Offline Messages */}
        <View className="bg-secondary-800 rounded-2xl p-6 mb-8 border border-secondary-700">
          <Text className="text-white font-bold text-lg mb-3">Offline Messages</Text>
          <Text className="text-secondary-400">
            Messages composed during flight will be queued and delivered automatically upon landing.
          </Text>
          <View className="bg-secondary-700 rounded-xl p-4 mt-4">
            <Text className="text-secondary-300 text-sm">
              💡 Tip: Coordinate your meeting point before boarding. Most coordination should happen pre-flight!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoStep({ number, title, description }) {
  return (
    <View className="flex-row mb-4">
      <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center mr-3 mt-1">
        <Text className="text-primary font-bold text-sm">{number}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white font-medium">{title}</Text>
        <Text className="text-secondary-400 text-sm mt-1">{description}</Text>
      </View>
    </View>
  );
}
