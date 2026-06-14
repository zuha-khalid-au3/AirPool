import React from 'react';
import { View, Text, Image } from 'react-native';

export default function Avatar({ name, uri, size = 40, className = '' }) {
  const initials = (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={dimension}
        className={`bg-secondary-200 ${className}`}
      />
    );
  }

  return (
    <View
      style={dimension}
      className={`bg-primary items-center justify-center ${className}`}
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  );
}
