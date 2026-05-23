import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePoolStore } from '../../store/poolStore';

export default function JoinPoolScreen({ navigation }) {
  const { pools, searchPools, isLoading } = usePoolStore();
  const [flightNumber, setFlightNumber] = useState('');
  const [airportCode, setAirportCode] = useState('');
  const [destination, setDestination] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    searchPools();
  }, []);

  const handleSearch = () => {
    const filters = {};
    if (flightNumber.trim()) filters.flightNumber = flightNumber.trim();
    if (airportCode.trim()) filters.airportCode = airportCode.trim();
    if (destination.trim()) filters.destination = destination.trim();
    searchPools(filters);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await searchPools();
    setRefreshing(false);
  };

  const renderPoolCard = ({ item: pool }) => {
    const activeMembers = pool.members?.filter((m) => m.status === 'active').length || 0;
    const spotsLeft = pool.maxMembers - activeMembers;

    return (
      <TouchableOpacity
        className="bg-white rounded-2xl p-5 mb-4 border border-secondary-100 shadow-sm"
        onPress={() => navigation.navigate('PoolDetails', { poolId: pool._id })}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-secondary-900 font-bold text-lg">{pool.destination?.name}</Text>
            <Text className="text-secondary-500 text-sm mt-1">
              From: {pool.arrivalAirport?.code} ({pool.arrivalAirport?.city})
            </Text>
          </View>
          <View className="bg-success/10 px-3 py-1 rounded-full">
            <Text className="text-success text-xs font-bold">{spotsLeft} spots left</Text>
          </View>
        </View>

        {/* Details */}
        <View className="flex-row flex-wrap mt-2">
          <View className="bg-secondary-50 rounded-lg px-3 py-2 mr-2 mb-2">
            <Text className="text-secondary-600 text-xs">✈️ {pool.flightNumber}</Text>
          </View>
          <View className="bg-secondary-50 rounded-lg px-3 py-2 mr-2 mb-2">
            <Text className="text-secondary-600 text-xs">
              🚗 {pool.vehicleType?.replace('_', ' ')}
            </Text>
          </View>
          <View className="bg-secondary-50 rounded-lg px-3 py-2 mr-2 mb-2">
            <Text className="text-secondary-600 text-xs">
              👥 {activeMembers}/{pool.maxMembers}
            </Text>
          </View>
          {pool.genderPreference !== 'any' && (
            <View className="bg-pink-50 rounded-lg px-3 py-2 mr-2 mb-2">
              <Text className="text-pink-600 text-xs">
                {pool.genderPreference === 'female_only' ? '♀ Female Only' : '♂ Male Only'}
              </Text>
            </View>
          )}
        </View>

        {/* Cost & Creator */}
        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-secondary-100">
          <View className="flex-row items-center">
            <Text className="text-secondary-500 text-sm">
              By {pool.creator?.name || 'Unknown'}
            </Text>
            {pool.creator?.isVerified && (
              <Text className="text-primary ml-1 text-xs">✓</Text>
            )}
          </View>
          {pool.estimatedCostPerPerson > 0 && (
            <Text className="text-success font-bold text-base">
              ₹{pool.estimatedCostPerPerson}/person
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      {/* Header */}
      <View className="bg-white px-6 pt-4 pb-4 border-b border-secondary-100">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-secondary-900">Find Pools</Text>
        </View>

        {/* Search Filters */}
        <View className="flex-row mb-2">
          <TextInput
            className="flex-1 border border-secondary-200 rounded-lg px-3 py-2 mr-2 text-sm"
            placeholder="Flight (6E2341)"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            value={flightNumber}
            onChangeText={setFlightNumber}
          />
          <TextInput
            className="w-20 border border-secondary-200 rounded-lg px-3 py-2 mr-2 text-sm"
            placeholder="VNS"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            maxLength={3}
            value={airportCode}
            onChangeText={setAirportCode}
          />
          <TouchableOpacity
            className="bg-primary px-4 py-2 rounded-lg items-center justify-center"
            onPress={handleSearch}
          >
            <Text className="text-white font-medium text-sm">Search</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          className="border border-secondary-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Destination (e.g., Bus Stand, Railway Station)"
          placeholderTextColor="#94A3B8"
          value={destination}
          onChangeText={setDestination}
          onSubmitEditing={handleSearch}
        />
      </View>

      {/* Results */}
      {isLoading && pools.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0284C7" />
          <Text className="text-secondary-500 mt-4">Searching pools...</Text>
        </View>
      ) : (
        <FlatList
          data={pools}
          renderItem={renderPoolCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text className="text-secondary-700 font-semibold text-lg">No pools found</Text>
              <Text className="text-secondary-400 text-center mt-2">
                Try different search filters or create your own pool!
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
