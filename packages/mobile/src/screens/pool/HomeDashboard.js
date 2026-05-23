import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { usePoolStore } from '../../store/poolStore';
import { useConfigStore } from '../../store/configStore';

export default function HomeDashboard({ navigation }) {
  const { user } = useAuthStore();
  const { myPools, fetchMyPools, isLoading } = usePoolStore();
  const { announcements } = useConfigStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMyPools();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyPools();
    setRefreshing(false);
  };

  const activePools = myPools.filter((p) => ['open', 'full', 'in_progress'].includes(p.status));

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-6 pb-10 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-primary-200 text-base">Welcome back,</Text>
              <Text className="text-white text-2xl font-bold">{user?.name || 'Traveller'}</Text>
            </View>
            <TouchableOpacity
              className="w-12 h-12 bg-white/20 rounded-full items-center justify-center"
              onPress={() => navigation.navigate('Profile')}
            >
              <Text className="text-white text-lg">👤</Text>
            </TouchableOpacity>
          </View>

          {/* Trust Score Badge */}
          <View className="flex-row items-center bg-white/10 rounded-xl px-4 py-3">
            <Text className="text-white mr-2">⭐</Text>
            <Text className="text-white font-medium">
              Trust Score: {user?.trustScore || 50}/100
            </Text>
            {user?.isVerified && (
              <View className="ml-auto bg-success/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-medium">✓ Verified</Text>
              </View>
            )}
          </View>
        </View>

        {/* Announcements */}
        {announcements.length > 0 && (
          <View className="px-6 mt-4">
            {announcements.map((announcement) => (
              <View
                key={announcement.id}
                className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-3"
              >
                <Text className="text-primary-800 font-semibold">{announcement.title}</Text>
                <Text className="text-primary-600 text-sm mt-1">{announcement.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-900 text-xl font-bold mb-4">Quick Actions</Text>
          <View className="flex-row">
            <TouchableOpacity
              className="flex-1 bg-white rounded-2xl p-5 mr-3 shadow-sm border border-secondary-100"
              onPress={() => navigation.navigate('CreatePool')}
              activeOpacity={0.7}
            >
              <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center mb-3">
                <Text className="text-2xl">➕</Text>
              </View>
              <Text className="text-secondary-900 font-bold text-base">Create Pool</Text>
              <Text className="text-secondary-500 text-sm mt-1">Start a new ride group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-secondary-100"
              onPress={() => navigation.navigate('JoinPool')}
              activeOpacity={0.7}
            >
              <View className="w-12 h-12 bg-success/10 rounded-full items-center justify-center mb-3">
                <Text className="text-2xl">🔍</Text>
              </View>
              <Text className="text-secondary-900 font-bold text-base">Join Pool</Text>
              <Text className="text-secondary-500 text-sm mt-1">Find existing groups</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Pools */}
        <View className="px-6 mt-8">
          <Text className="text-secondary-900 text-xl font-bold mb-4">Your Active Pools</Text>

          {activePools.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-secondary-100">
              <Text className="text-4xl mb-3">🛫</Text>
              <Text className="text-secondary-700 font-semibold text-base">No active pools</Text>
              <Text className="text-secondary-400 text-sm text-center mt-2">
                Create or join a pool before your next flight to save on cab fares!
              </Text>
            </View>
          ) : (
            activePools.map((pool) => (
              <TouchableOpacity
                key={pool._id}
                className="bg-white rounded-2xl p-5 mb-3 border border-secondary-100"
                onPress={() => navigation.navigate('PoolDetails', { poolId: pool._id })}
                activeOpacity={0.7}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-secondary-900 font-bold text-base">
                      {pool.destination?.name}
                    </Text>
                    <Text className="text-secondary-500 text-sm mt-1">
                      Flight: {pool.flightNumber} • {pool.arrivalAirport?.code}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      pool.status === 'open'
                        ? 'bg-success/10'
                        : pool.status === 'full'
                        ? 'bg-warning/10'
                        : 'bg-primary-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium capitalize ${
                        pool.status === 'open'
                          ? 'text-success'
                          : pool.status === 'full'
                          ? 'text-warning'
                          : 'text-primary'
                      }`}
                    >
                      {pool.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center mt-3 pt-3 border-t border-secondary-100">
                  <Text className="text-secondary-500 text-sm">
                    👥 {pool.members?.filter((m) => m.status === 'active').length || 0}/
                    {pool.maxMembers} members
                  </Text>
                  <Text className="text-secondary-300 mx-2">•</Text>
                  <Text className="text-secondary-500 text-sm">
                    🚗 {pool.vehicleType?.replace('_', ' ')}
                  </Text>
                  {pool.estimatedCostPerPerson > 0 && (
                    <>
                      <Text className="text-secondary-300 mx-2">•</Text>
                      <Text className="text-success font-semibold text-sm">
                        ₹{pool.estimatedCostPerPerson}/person
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Upload Ticket CTA */}
        {!user?.isVerified && (
          <View className="px-6 mt-6 mb-8">
            <TouchableOpacity
              className="bg-warning/10 border border-warning/30 rounded-2xl p-5"
              onPress={() => navigation.navigate('Profile', { screen: 'DocumentHub' })}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">📄</Text>
                <View className="flex-1">
                  <Text className="text-secondary-900 font-bold">Complete Verification</Text>
                  <Text className="text-secondary-500 text-sm mt-1">
                    Upload your ID to unlock all features and build trust
                  </Text>
                </View>
                <Text className="text-secondary-400 text-lg">→</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
