import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket.service';
import { getUserId } from '../../utils/user';

export default function PostLandingMapScreen({ navigation, route }) {
  const { chatRoomId } = route.params || {};
  const { user } = useAuthStore();
  const userId = getUserId(user);
  const {
    memberLocations,
    liveLocations,
    updateMemberLocation,
    updateLiveLocation,
    shareLiveLocation,
    stopActiveLiveSession,
    activeLiveSession,
  } = useChatStore();

  const mapRef = useRef(null);
  const [myLocation, setMyLocation] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const handleMemberLocation = (data) => {
      updateMemberLocation(data.userId, data);
    };

    const handleLiveUpdate = (data) => {
      updateLiveLocation(data.liveSessionId, data);
    };

    requestLocationPermission();
    socketService.on('member_location', handleMemberLocation);
    socketService.on('live_location_update', handleLiveUpdate);

    return () => {
      socketService.off('member_location', handleMemberLocation);
      socketService.off('live_location_update', handleLiveUpdate);
    };
  }, []);

  useEffect(() => {
    setIsSharing(!!activeLiveSession && activeLiveSession.chatRoomId === chatRoomId);
  }, [activeLiveSession, chatRoomId]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Required',
        'Please enable location to share your position with pool members.'
      );
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setMyLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  };

  const toggleSharing = async () => {
    if (isSharing) {
      stopActiveLiveSession();
      setIsSharing(false);
      return;
    }

    try {
      await shareLiveLocation(chatRoomId);
      setIsSharing(true);
    } catch (error) {
      Alert.alert('Could not share location', error.message);
    }
  };

  const liveMarkers = Object.values(liveLocations).filter(
    (loc) => loc.chatRoomId === chatRoomId && loc.latitude != null
  );
  const memberMarkers = Object.entries(memberLocations).map(([id, data]) => ({
    id,
    ...data,
  }));

  const allMarkers = [
    ...liveMarkers.map((loc) => ({
      id: loc.liveSessionId || loc.userId,
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      isLive: loc.isLive !== false,
    })),
    ...memberMarkers.map((m) => ({
      id: m.userId,
      name: m.name,
      latitude: m.latitude,
      longitude: m.longitude,
      isLive: false,
    })),
  ];

  const uniqueMarkers = allMarkers.filter(
    (marker, index, arr) => arr.findIndex((m) => m.id === marker.id) === index
  );

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      <View className="bg-white px-6 py-4 border-b border-secondary-100 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-secondary-900 font-bold text-lg">Live Locations</Text>
          <Text className="text-secondary-500 text-xs">
            {uniqueMarkers.length} member{uniqueMarkers.length === 1 ? '' : 's'} on map
          </Text>
        </View>
      </View>

      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          showsUserLocation
          showsMyLocationButton={Platform.OS === 'android'}
          initialRegion={{
            latitude: myLocation?.latitude || 28.5562,
            longitude: myLocation?.longitude || 77.1,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {uniqueMarkers.map((marker) => (
            <Marker
              key={String(marker.id)}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              title={marker.name}
              description={marker.isLive ? 'Live location' : 'Last known location'}
              pinColor={marker.id === userId ? '#10B981' : '#0284C7'}
            />
          ))}
        </MapView>
      </View>

      {uniqueMarkers.length > 0 && (
        <View className="bg-white px-6 py-3 border-t border-secondary-100 max-h-36">
          {uniqueMarkers.slice(0, 4).map((marker) => (
            <View key={String(marker.id)} className="flex-row items-center py-1.5">
              <Text className="text-success mr-2">{marker.isLive ? '🟢' : '📍'}</Text>
              <Text className="text-secondary-700 flex-1">{marker.name}</Text>
              <Text className="text-secondary-400 text-xs">
                {marker.isLive ? 'Live' : 'Recent'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className="bg-white px-6 py-4 border-t border-secondary-100">
        <TouchableOpacity
          className={`w-full py-4 rounded-xl items-center ${
            isSharing ? 'bg-danger' : 'bg-success'
          }`}
          onPress={toggleSharing}
          activeOpacity={0.8}
        >
          <Text className="text-white text-lg font-semibold">
            {isSharing ? '⏹ Stop sharing live location' : '📍 Share my live location in chat'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
