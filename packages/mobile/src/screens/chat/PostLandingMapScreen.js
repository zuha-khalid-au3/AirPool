import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useChatStore } from '../../store/chatStore';
import { socketService } from '../../services/socket.service';

const { width } = Dimensions.get('window');

export default function PostLandingMapScreen({ navigation, route }) {
  const { chatRoomId, poolId } = route.params || {};
  const { memberLocations, updateMemberLocation } = useChatStore();
  const [myLocation, setMyLocation] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [locationWatcher, setLocationWatcher] = useState(null);

  useEffect(() => {
    requestLocationPermission();

    // Listen for member locations
    socketService.on('member_location', (data) => {
      updateMemberLocation(data.userId, data);
    });

    return () => {
      socketService.off('member_location');
      if (locationWatcher) {
        locationWatcher.remove();
      }
    };
  }, []);

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

  const startSharingLocation = async () => {
    setIsSharing(true);

    const watcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
        timeInterval: 5000, // Or every 5 seconds
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        setMyLocation({ latitude, longitude });
        socketService.shareLocation(chatRoomId, latitude, longitude);
      }
    );

    setLocationWatcher(watcher);
  };

  const stopSharingLocation = () => {
    setIsSharing(false);
    if (locationWatcher) {
      locationWatcher.remove();
      setLocationWatcher(null);
    }
  };

  const memberLocationsList = Object.entries(memberLocations);

  return (
    <SafeAreaView className="flex-1 bg-secondary-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-secondary-100 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-secondary-900 font-bold text-lg">Live Locations</Text>
          <Text className="text-secondary-500 text-xs">
            {memberLocationsList.length} members sharing location
          </Text>
        </View>
      </View>

      {/* Map Placeholder - In production, use react-native-maps */}
      <View className="flex-1 bg-secondary-100 items-center justify-center">
        <View className="bg-white rounded-2xl p-8 mx-6 items-center shadow-lg">
          <Text className="text-5xl mb-4">🗺️</Text>
          <Text className="text-secondary-900 font-bold text-lg text-center">
            Live Map View
          </Text>
          <Text className="text-secondary-500 text-center mt-2 leading-5">
            In the full build, this shows a real-time map with all pool members' locations,
            the meeting point, and navigation directions.
          </Text>

          {myLocation && (
            <View className="bg-primary-50 rounded-xl p-4 mt-4 w-full">
              <Text className="text-primary-700 text-sm font-medium">Your Location:</Text>
              <Text className="text-primary-600 text-xs mt-1">
                {myLocation.latitude.toFixed(6)}, {myLocation.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Members Sharing */}
      {memberLocationsList.length > 0 && (
        <View className="bg-white px-6 py-4 border-t border-secondary-100">
          <Text className="text-secondary-700 font-medium mb-2">Members Nearby:</Text>
          {memberLocationsList.map(([userId, data]) => (
            <View key={userId} className="flex-row items-center py-2">
              <View className="w-8 h-8 bg-success/10 rounded-full items-center justify-center mr-3">
                <Text className="text-success">📍</Text>
              </View>
              <Text className="text-secondary-700">{data.name}</Text>
              <Text className="text-secondary-400 text-xs ml-auto">
                {new Date(data.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Share Location Button */}
      <View className="bg-white px-6 py-4 border-t border-secondary-100">
        <TouchableOpacity
          className={`w-full py-4 rounded-xl items-center ${
            isSharing ? 'bg-danger' : 'bg-success'
          }`}
          onPress={isSharing ? stopSharingLocation : startSharingLocation}
          activeOpacity={0.8}
        >
          <Text className="text-white text-lg font-semibold">
            {isSharing ? '⏹ Stop Sharing Location' : '📍 Share My Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
