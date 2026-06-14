import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  variant = 'light',
}) {
  const isDark = variant === 'dark';

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backIcon, isDark ? styles.backIconDark : styles.backIconLight]}>
            ←
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.titleWrap}>
        <Text
          style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, isDark ? styles.subtitleDark : styles.subtitleLight]}
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#F1F5F9',
  },
  containerDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#1E293B',
  },
  backButton: {
    marginRight: 12,
    paddingRight: 4,
    paddingVertical: 4,
  },
  backIcon: {
    fontSize: 18,
  },
  backIconLight: {
    color: '#0284C7',
  },
  backIconDark: {
    color: '#7DD3FC',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    fontSize: 18,
  },
  titleLight: {
    color: '#0F172A',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  subtitleLight: {
    color: '#64748B',
  },
  subtitleDark: {
    color: '#94A3B8',
  },
});
