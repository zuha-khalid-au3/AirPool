import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Avatar from '../ui/Avatar';

export default function IncomingCallBanner({ call, onAccept, onReject }) {
  if (!call) return null;

  return (
    <View className="absolute top-0 left-0 right-0 z-50 bg-secondary-900 px-5 py-4 shadow-lg">
      <View className="flex-row items-center">
        <Avatar name={call.caller?.name} size={48} />
        <View className="flex-1 ml-3">
          <Text className="text-white font-bold text-base">{call.caller?.name || 'Pool member'}</Text>
          <Text className="text-primary-300 text-sm">Incoming voice call…</Text>
        </View>
      </View>
      <View className="flex-row mt-4 gap-3">
        <TouchableOpacity
          className="flex-1 bg-danger py-3 rounded-xl items-center"
          onPress={onReject}
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold">Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-success py-3 rounded-xl items-center"
          onPress={onAccept}
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
