import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePoolStore } from '../../store/poolStore';
import { useAuthStore } from '../../store/authStore';
import { getUserId, idsMatch } from '../../utils/user';

export default function PoolDetailsScreen({ navigation, route }) {
  const { poolId } = route.params;
  const { currentPool, getPoolDetails, joinPool, leavePool, updatePoolStatus, isLoading } = usePoolStore();
  const { user } = useAuthStore();
  const [actionLoading, setActionLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const userId = getUserId(user);

  useEffect(() => {
    getPoolDetails(poolId);
  }, [poolId]);

  if (!currentPool) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0284C7" />
      </SafeAreaView>
    );
  }

  const activeMembers = currentPool.members?.filter((m) => m.status === 'active') || [];
  const isMember = activeMembers.some((m) => idsMatch(getUserId(m.user), userId));
  const isCreator = idsMatch(currentPool.creator, userId);
  const spotsLeft = currentPool.maxMembers - activeMembers.length;

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await joinPool(poolId);
      Alert.alert('Joined!', 'You have successfully joined this pool.');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to join pool');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = () => {
    const message = isCreator
      ? 'As the creator, leaving will cancel this pool for everyone. Are you sure?'
      : 'Are you sure you want to leave this pool?';

    Alert.alert('Leave Pool', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leavePool(poolId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to leave pool');
          }
        },
      },
    ]);
  };

  const handleStartRide = () => {
    Alert.alert('Start Ride', 'Mark this pool as in-progress?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          try {
            await updatePoolStatus(poolId, 'in_progress');
          } catch (error) {
            Alert.alert('Error', 'Failed to update status');
          }
        },
      },
    ]);
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await updatePoolStatus(poolId, 'completed');
            Alert.alert('Ride Completed!', 'Thank you for using AirPool.');
          } catch (error) {
            Alert.alert('Error', 'Failed to complete ride');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        {/* Header */}
        <View className="bg-primary px-6 pt-4 pb-8">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Text className="text-white text-lg">← Back</Text>
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold flex-1">Pool Details</Text>
            <View className={`px-3 py-1 rounded-full ${
              currentPool.status === 'open' ? 'bg-white/20' : 'bg-white/10'
            }`}>
              <Text className="text-white text-xs font-medium capitalize">
                {currentPool.status?.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {/* Destination */}
          <Text className="text-white text-2xl font-bold">{currentPool.destination?.name}</Text>
          <Text className="text-primary-200 mt-1">
            From {currentPool.arrivalAirport?.name || currentPool.arrivalAirport?.code}
          </Text>
        </View>

        {/* Info Cards */}
        <View className="px-6 -mt-4">
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-secondary-100">
            <View className="flex-row justify-between mb-4">
              <InfoItem label="Flight" value={currentPool.flightNumber} />
              <InfoItem label="Vehicle" value={currentPool.vehicleType?.replace('_', ' ')} />
              <InfoItem label="Members" value={`${activeMembers.length}/${currentPool.maxMembers}`} />
            </View>
            <View className="flex-row justify-between">
              <InfoItem label="Total Cost" value={`₹${currentPool.estimatedCostTotal || '—'}`} />
              <InfoItem
                label="Per Person"
                value={`₹${currentPool.estimatedCostPerPerson || Math.ceil((currentPool.estimatedCostTotal || 0) / activeMembers.length) || '—'}`}
                highlight
              />
              <InfoItem label="Spots Left" value={spotsLeft.toString()} />
            </View>
          </View>
        </View>

        {/* Meeting Point */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-900 font-bold text-lg mb-3">Meeting Point</Text>
          <View className="bg-white rounded-xl p-4 border border-secondary-100">
            <Text className="text-secondary-700">
              📍 {currentPool.meetingPoint?.description || 'Airport Exit Gate'}
            </Text>
            {currentPool.meetingPoint?.landmark && (
              <Text className="text-secondary-500 text-sm mt-1">
                Near: {currentPool.meetingPoint.landmark}
              </Text>
            )}
          </View>
        </View>

        {/* Members */}
        <View className="px-6 mt-6">
          <Text className="text-secondary-900 font-bold text-lg mb-3">Members</Text>
          {activeMembers.map((member, index) => (
            <View
              key={member.user?._id || index}
              className="bg-white rounded-xl p-4 mb-2 flex-row items-center border border-secondary-100"
            >
              <View className="w-10 h-10 bg-primary-100 rounded-full items-center justify-center mr-3">
                <Text className="text-primary font-bold">
                  {(member.user?.name || 'U')[0].toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-secondary-900 font-medium">
                    {member.user?.name || 'Unknown'}
                  </Text>
                  {member.user?.isVerified && (
                    <Text className="text-primary ml-1 text-xs">✓ Verified</Text>
                  )}
                </View>
                <Text className="text-secondary-400 text-xs">
                  Trust Score: {member.user?.trustScore || 50}
                </Text>
              </View>
              {(idsMatch(member.user, currentPool.creator)) && (
                <View className="bg-primary-50 px-2 py-1 rounded">
                  <Text className="text-primary text-xs font-medium">Creator</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="px-6 mt-8 mb-8">
          {!isMember && currentPool.status === 'open' && (
            <TouchableOpacity
              className="bg-primary w-full py-4 rounded-xl items-center mb-3"
              onPress={handleJoin}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-lg font-semibold">Join This Pool</Text>
              )}
            </TouchableOpacity>
          )}

          {isMember && (
            <>
              <TouchableOpacity
                className="bg-primary w-full py-4 rounded-xl items-center mb-3"
                onPress={() => navigation.navigate('GroupChat', { chatRoomId: currentPool.chatRoomId, poolId })}
                activeOpacity={0.8}
              >
                <Text className="text-white text-lg font-semibold">💬 Open Group Chat</Text>
              </TouchableOpacity>

              {isCreator && currentPool.status === 'open' && (
                <TouchableOpacity
                  className="bg-success w-full py-4 rounded-xl items-center mb-3"
                  onPress={handleStartRide}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-lg font-semibold">🚗 Start Ride</Text>
                </TouchableOpacity>
              )}

              {isCreator && currentPool.status === 'in_progress' && (
                <TouchableOpacity
                  className="bg-success w-full py-4 rounded-xl items-center mb-3"
                  onPress={handleCompleteRide}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-lg font-semibold">✅ Complete Ride</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                className="border-2 border-danger w-full py-4 rounded-xl items-center"
                onPress={handleLeave}
                activeOpacity={0.8}
              >
                <Text className="text-danger text-lg font-semibold">Leave Pool</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ label, value, highlight }) {
  return (
    <View className="items-center">
      <Text className="text-secondary-400 text-xs mb-1">{label}</Text>
      <Text className={`font-bold ${highlight ? 'text-success text-lg' : 'text-secondary-900'}`}>
        {value}
      </Text>
    </View>
  );
}
