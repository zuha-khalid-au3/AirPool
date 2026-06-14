import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  className = '',
}) {
  const variants = {
    primary: 'bg-primary',
    success: 'bg-success',
    danger: 'bg-danger',
    outline: 'bg-white border-2 border-primary',
  };

  const textVariants = {
    primary: 'text-white',
    success: 'text-white',
    danger: 'text-white',
    outline: 'text-primary',
  };

  return (
    <TouchableOpacity
      className={`w-full py-4 rounded-2xl items-center flex-row justify-center shadow-sm ${
        variants[variant]
      } ${disabled || loading ? 'opacity-60' : ''} ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#0284C7' : '#fff'} />
      ) : (
        <>
          {icon ? <Text className="mr-2 text-lg">{icon}</Text> : null}
          <Text className={`text-base font-semibold ${textVariants[variant]}`}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
