import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePoolStore } from '../../store/poolStore';
import { useConfigStore } from '../../store/configStore';
import { useAuthStore } from '../../store/authStore';

export default function CreatePoolScreen({ navigation }) {
  const { createPool, isLoading } = usePoolStore();
  const { airports, vehicleTypes } = useConfigStore();
  const { user } = useAuthStore();

  const [flightNumber, setFlightNumber] = useState('');
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [destination, setDestination] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('any');
  const [maxMembers, setMaxMembers] = useState(4);
  const [genderPreference, setGenderPreference] = useState('any');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');

  const handleCreate = async () => {
    if (!flightNumber.trim()) {
      Alert.alert('Required', 'Please enter your flight number');
      return;
    }
    if (!selectedAirport) {
      Alert.alert('Required', 'Please select your arrival airport');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Required', 'Please enter your destination');
      return;
    }
    if (!arrivalDate || !arrivalTime) {
      Alert.alert('Required', 'Please enter arrival date and time');
      return;
    }

    try {
      const poolData = {
        flightNumber: flightNumber.toUpperCase(),
        arrivalAirport: {
          code: selectedAirport.code,
          name: selectedAirport.name,
          city: selectedAirport.city,
        },
        arrivalTime: new Date(`${arrivalDate}T${arrivalTime}:00`).toISOString(),
        destination: {
          name: destination,
          address: destinationAddress || destination,
        },
        vehicleType,
        maxMembers,
        genderPreference,
        estimatedCostTotal: parseInt(estimatedCost) || 0,
      };

      const pool = await createPool(poolData);
      Alert.alert('Success', 'Your ride pool has been created!', [
        { text: 'View Pool', onPress: () => navigation.replace('PoolDetails', { poolId: pool._id }) },
      ]);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to create pool';
      Alert.alert('Error', message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1 px-6 pt-4">
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Text className="text-primary text-lg">← Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-secondary-900">Create Ride Pool</Text>
          </View>

          {/* Flight Number */}
          <View className="mb-5">
            <Text className="text-secondary-700 font-medium mb-2">Flight Number *</Text>
            <TextInput
              className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900"
              placeholder="e.g., 6E 2341"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={flightNumber}
              onChangeText={setFlightNumber}
            />
          </View>

          {/* Arrival Airport */}
          <View className="mb-5">
            <Text className="text-secondary-700 font-medium mb-2">Arrival Airport *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(airports.length > 0 ? airports : defaultAirports).map((airport) => (
                <TouchableOpacity
                  key={airport.code}
                  className={`mr-3 px-4 py-3 rounded-xl border-2 ${
                    selectedAirport?.code === airport.code
                      ? 'border-primary bg-primary-50'
                      : 'border-secondary-200'
                  }`}
                  onPress={() => setSelectedAirport(airport)}
                >
                  <Text
                    className={`font-bold ${
                      selectedAirport?.code === airport.code ? 'text-primary' : 'text-secondary-700'
                    }`}
                  >
                    {airport.code}
                  </Text>
                  <Text className="text-secondary-500 text-xs">{airport.city}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Arrival Date & Time */}
          <View className="flex-row mb-5">
            <View className="flex-1 mr-3">
              <Text className="text-secondary-700 font-medium mb-2">Arrival Date *</Text>
              <TextInput
                className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={arrivalDate}
                onChangeText={setArrivalDate}
              />
            </View>
            <View className="flex-1">
              <Text className="text-secondary-700 font-medium mb-2">Time *</Text>
              <TextInput
                className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900"
                placeholder="HH:MM"
                placeholderTextColor="#94A3B8"
                value={arrivalTime}
                onChangeText={setArrivalTime}
              />
            </View>
          </View>

          {/* Destination */}
          <View className="mb-5">
            <Text className="text-secondary-700 font-medium mb-2">Destination *</Text>
            <TextInput
              className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900"
              placeholder="e.g., Varanasi Bus Stand, BHU Gate"
              placeholderTextColor="#94A3B8"
              value={destination}
              onChangeText={setDestination}
            />
            <TextInput
              className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900 mt-2"
              placeholder="Full address (optional)"
              placeholderTextColor="#94A3B8"
              value={destinationAddress}
              onChangeText={setDestinationAddress}
            />
          </View>

          {/* Vehicle Type */}
          <View className="mb-5">
            <Text className="text-secondary-700 font-medium mb-2">Vehicle Preference</Text>
            <View className="flex-row flex-wrap">
              {(vehicleTypes.length > 0 ? vehicleTypes : defaultVehicles).map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  className={`mr-3 mb-3 px-4 py-3 rounded-xl border-2 ${
                    vehicleType === vehicle.id
                      ? 'border-primary bg-primary-50'
                      : 'border-secondary-200'
                  }`}
                  onPress={() => setVehicleType(vehicle.id)}
                >
                  <Text
                    className={`font-medium ${
                      vehicleType === vehicle.id ? 'text-primary' : 'text-secondary-600'
                    }`}
                  >
                    {vehicle.name}
                  </Text>
                  <Text className="text-secondary-400 text-xs">Max {vehicle.maxPassengers}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Max Members */}
          <View className="mb-5">
            <Text className="text-secondary-700 font-medium mb-2">
              Max Members: {maxMembers}
            </Text>
            <View className="flex-row">
              {[2, 3, 4, 5, 6].map((num) => (
                <TouchableOpacity
                  key={num}
                  className={`mr-3 w-12 h-12 rounded-full items-center justify-center border-2 ${
                    maxMembers === num ? 'border-primary bg-primary-50' : 'border-secondary-200'
                  }`}
                  onPress={() => setMaxMembers(num)}
                >
                  <Text
                    className={`font-bold ${
                      maxMembers === num ? 'text-primary' : 'text-secondary-600'
                    }`}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Gender Preference */}
          <View className="mb-5">
            <Text className="text-secondary-700 font-medium mb-2">Gender Preference</Text>
            <View className="flex-row">
              {[
                { value: 'any', label: 'Anyone' },
                { value: 'female_only', label: 'Female Only' },
                { value: 'male_only', label: 'Male Only' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className={`mr-3 px-4 py-3 rounded-xl border-2 ${
                    genderPreference === option.value
                      ? 'border-primary bg-primary-50'
                      : 'border-secondary-200'
                  }`}
                  onPress={() => setGenderPreference(option.value)}
                  disabled={
                    option.value === 'female_only' && user?.gender !== 'female'
                  }
                >
                  <Text
                    className={`font-medium ${
                      genderPreference === option.value ? 'text-primary' : 'text-secondary-600'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Estimated Total Cost */}
          <View className="mb-8">
            <Text className="text-secondary-700 font-medium mb-2">
              Estimated Total Fare (₹)
            </Text>
            <TextInput
              className="border-2 border-secondary-200 rounded-xl px-4 py-3 text-base text-secondary-900"
              placeholder="e.g., 400"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={estimatedCost}
              onChangeText={setEstimatedCost}
            />
            {estimatedCost && maxMembers > 0 && (
              <Text className="text-success font-medium mt-2">
                ≈ ₹{Math.ceil(parseInt(estimatedCost) / maxMembers)} per person
              </Text>
            )}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            className="bg-primary w-full py-4 rounded-xl items-center mb-8"
            onPress={handleCreate}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-lg font-semibold">Create Pool</Text>
            )}
          </TouchableOpacity>

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const defaultAirports = [
  { code: 'VNS', city: 'Varanasi', name: 'Lal Bahadur Shastri Airport' },
  { code: 'DEL', city: 'New Delhi', name: 'IGI Airport' },
  { code: 'BOM', city: 'Mumbai', name: 'CSMIA' },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda Airport' },
  { code: 'HYD', city: 'Hyderabad', name: 'RGIA' },
];

const defaultVehicles = [
  { id: 'auto_rickshaw', name: 'Auto', maxPassengers: 3 },
  { id: 'sedan', name: 'Sedan', maxPassengers: 4 },
  { id: 'suv', name: 'SUV', maxPassengers: 6 },
  { id: 'any', name: 'Any', maxPassengers: 4 },
];
