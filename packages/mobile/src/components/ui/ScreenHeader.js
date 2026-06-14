import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  variant = 'light',
}) {
  const isDark = variant === 'dark';

  return (
    <View
      className={`px-5 py-4 flex-row items-center border-b ${
        isDark ? 'bg-secondary-900 border-secondary-800' : 'bg-white border-secondary-100'
      }`}
    >
      {onBack && (
        <TouchableOpacity onPress={onBack} className="mr-3 pr-1 py-1" activeOpacity={0.7}>
          <Text className={`text-lg ${isDark ? 'text-primary-300' : 'text-primary'}`}>←</Text>
        </TouchableOpacity>
      )}
      <View className="flex-1">
        <Text
          className={`font-bold text-lg ${isDark ? 'text-white' : 'text-secondary-900'}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className={`text-xs mt-0.5 ${isDark ? 'text-secondary-400' : 'text-secondary-500'}`}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction}
    </View>
  );
}
