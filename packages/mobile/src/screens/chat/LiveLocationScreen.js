import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket.service';
import { getUserId, idsMatch } from '../../utils/user';
import {
  formatDistance,
  haversineDistanceKm,
  openDirectionsTo,
} from '../../utils/location';

export default function LiveLocationScreen({ navigation, route }) {
  const {
    chatRoomId,
    liveSessionId,
    targetUserId,
    targetName = 'Member',
    initialLatitude,
    initialLongitude,
    isLive = true,
  } = route.params || {};

  const { user } = useAuthStore();
  const userId = getUserId(user);
  const { liveLocations, updateLiveLocation, markLiveLocationStopped } = useChatStore();

  const mapRef = useRef(null);
  const [myLocation, setMyLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionLive, setSessionLive] = useState(isLive);

  const tracked = liveLocations[liveSessionId];
  const targetLat = tracked?.latitude ?? initialLatitude;
  const targetLng = tracked?.longitude ?? initialLongitude;

  const distanceKm = useMemo(() => {
    if (!myLocation || targetLat == null || targetLng == null) return null;
    return haversineDistanceKm(
      myLocation.latitude,
      myLocation.longitude,
      targetLat,
      targetLng
    );
  }, [myLocation, targetLat, targetLng]);

  useEffect(() => {
    let locationWatcher = null;
    let isMounted = true;

    const handleLiveUpdate = (data) => {
      if (data.liveSessionId !== liveSessionId) return;
      updateLiveLocation(liveSessionId, data);
      setSessionLive(true);
    };

    const handleLiveStop = (data) => {
      if (data.liveSessionId !== liveSessionId) return;
      markLiveLocationStopped(liveSessionId);
      setSessionLive(false);
    };

    const setup = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Enable location to see your path to this member.');
        setLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!isMounted) return;

      setMyLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 15,
          timeInterval: 5000,
        },
        (loc) => {
          setMyLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );

      socketService.on('live_location_update', handleLiveUpdate);
      socketService.on('live_location_stop', handleLiveStop);

      if (targetLat != null && targetLng != null) {
        updateLiveLocation(liveSessionId, {
          userId: targetUserId,
          name: targetName,
          latitude: targetLat,
          longitude: targetLng,
          isLive: sessionLive,
          chatRoomId,
        });
      }

      setLoading(false);
    };

    setup();

    return () => {
      isMounted = false;
      locationWatcher?.remove();
      socketService.off('live_location_update', handleLiveUpdate);
      socketService.off('live_location_stop', handleLiveStop);
    };
  }, [chatRoomId, liveSessionId, targetUserId, targetName]);

  useEffect(() => {
    if (!mapRef.current || targetLat == null || targetLng == null) return;

    const coordinates = [];
    if (myLocation) coordinates.push(myLocation);
    coordinates.push({ latitude: targetLat, longitude: targetLng });

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 80, right: 60, bottom: 180, left: 60 },
      animated: true,
    });
  }, [myLocation, targetLat, targetLng]);

  const handleNavigate = () => {
    if (targetLat == null || targetLng == null) {
      Alert.alert('Location unavailable', 'Waiting for a location update from this member.');
      return;
    }
    openDirectionsTo(targetLat, targetLng, targetName);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="text-secondary-500 mt-3">Loading map…</Text>
      </SafeAreaView>
    );
  }

  if (targetLat == null || targetLng == null) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-6 py-4 border-b border-secondary-100 flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-primary text-lg">← Back</Text>
          </TouchableOpacity>
          <Text className="text-secondary-900 font-bold text-lg">Live Location</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-secondary-500 text-center">
            No location data yet. Ask {targetName} to keep live sharing on.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSelf = idsMatch(targetUserId, userId);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 py-4 border-b border-secondary-100 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-secondary-900 font-bold text-lg">
            {isSelf ? 'Your live location' : targetName}
          </Text>
          <Text className="text-secondary-500 text-xs">
            {sessionLive ? '🟢 Live — updates every few seconds' : '⚪ Sharing ended'}
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
            latitude: targetLat,
            longitude: targetLng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          <Marker
            coordinate={{ latitude: targetLat, longitude: targetLng }}
            title={targetName}
            description={sessionLive ? 'Live location' : 'Last known location'}
            pinColor="#0284C7"
          />

          {myLocation && !isSelf && (
            <>
              <Marker
                coordinate={myLocation}
                title="You"
                pinColor="#10B981"
              />
              <Polyline
                coordinates={[myLocation, { latitude: targetLat, longitude: targetLng }]}
                strokeColor="#0284C7"
                strokeWidth={3}
                lineDashPattern={[8, 6]}
              />
            </>
          )}
        </MapView>
      </View>

      <View className="bg-white px-6 py-4 border-t border-secondary-100">
        {!isSelf && distanceKm != null && (
          <Text className="text-secondary-700 text-center mb-3">
            About <Text className="font-bold text-primary">{formatDistance(distanceKm)}</Text> away
          </Text>
        )}

        <TouchableOpacity
          className="bg-primary w-full py-4 rounded-xl items-center mb-2"
          onPress={handleNavigate}
          activeOpacity={0.85}
        >
          <Text className="text-white text-lg font-semibold">🧭 Open turn-by-turn directions</Text>
        </TouchableOpacity>

        <Text className="text-secondary-400 text-xs text-center">
          Opens Apple Maps or Google Maps for navigation while this screen keeps updating their position.
        </Text>
      </View>
    </SafeAreaView>
  );
}
