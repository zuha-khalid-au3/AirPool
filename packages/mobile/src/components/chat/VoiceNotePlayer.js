import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import {
  downloadAuthenticatedMediaFile,
  parseObjectNameFromMediaUrl,
} from '../../utils/chatMedia';

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VoiceNotePlayer({
  uri,
  localUri,
  chatRoomId,
  objectName,
  duration,
  isOwnMessage,
}) {
  const soundRef = useRef(null);
  const [playbackUri, setPlaybackUri] = useState(localUri || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function resolveUri() {
      if (localUri) {
        if (!cancelled) setPlaybackUri(localUri);
        return;
      }

      const resolvedObjectName = objectName || parseObjectNameFromMediaUrl(uri);
      if (resolvedObjectName && chatRoomId) {
        try {
          const cachedUri = await downloadAuthenticatedMediaFile(chatRoomId, resolvedObjectName);
          if (!cancelled) {
            setPlaybackUri(cachedUri);
            setHasError(false);
          }
        } catch {
          if (!cancelled) setHasError(true);
        }
        return;
      }

      if (uri && !cancelled) {
        setPlaybackUri(uri);
      }
    }

    resolveUri();
    return () => {
      cancelled = true;
    };
  }, [uri, localUri, chatRoomId, objectName]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [playbackUri]);

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis / 1000);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  };

  const startPlayback = async () => {
    if (!playbackUri) {
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: playbackUri },
      { shouldPlay: false },
      onPlaybackStatusUpdate
    );

    soundRef.current = sound;
    await sound.playAsync();
    setIsPlaying(true);
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (!isPlaying && soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }

      await startPlayback();
    } catch {
      setHasError(true);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const totalDuration = duration || 0;
  const progress = totalDuration > 0 ? Math.min(position / totalDuration, 1) : 0;

  return (
    <TouchableOpacity
      onPress={togglePlayback}
      activeOpacity={0.85}
      style={styles.container}
    >
      <View style={[styles.playButton, isOwnMessage ? styles.playButtonOwn : styles.playButtonOther]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwnMessage ? '#fff' : '#0284C7'} />
        ) : (
          <Text style={isOwnMessage ? styles.playIconOwn : styles.playIconOther}>
            {hasError ? '⚠️' : isPlaying ? '⏸' : '▶️'}
          </Text>
        )}
      </View>
      <View style={styles.progressWrap}>
        <View style={[styles.progressTrack, isOwnMessage ? styles.trackOwn : styles.trackOther]}>
          <View
            style={[
              styles.progressFill,
              isOwnMessage ? styles.fillOwn : styles.fillOther,
              { width: `${Math.max(progress * 100, 4)}%` },
            ]}
          />
        </View>
        <Text style={[styles.durationText, isOwnMessage ? styles.durationOwn : styles.durationOther]}>
          {hasError ? 'Tap to retry' : formatDuration(isPlaying ? position : totalDuration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playButtonOwn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  playButtonOther: {
    backgroundColor: 'rgba(2,132,199,0.1)',
  },
  playIconOwn: {
    color: '#FFFFFF',
  },
  playIconOther: {
    color: '#0284C7',
  },
  progressWrap: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  trackOwn: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trackOther: {
    backgroundColor: '#E2E8F0',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  fillOwn: {
    backgroundColor: '#FFFFFF',
  },
  fillOther: {
    backgroundColor: '#0284C7',
  },
  durationText: {
    fontSize: 12,
    marginTop: 4,
  },
  durationOwn: {
    color: '#E0F2FE',
  },
  durationOther: {
    color: '#64748B',
  },
});
