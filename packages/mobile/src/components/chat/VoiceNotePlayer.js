import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import {
  buildAuthenticatedChatMediaUrl,
  getMediaAuthHeaders,
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
  autoPlay = false,
}) {
  const soundRef = useRef(null);
  const autoPlayedRef = useRef(false);
  const [playbackUri, setPlaybackUri] = useState(localUri || uri || null);
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
        const authenticatedUrl = await buildAuthenticatedChatMediaUrl(
          chatRoomId,
          resolvedObjectName
        );
        if (!cancelled) setPlaybackUri(authenticatedUrl);
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

    const headers = localUri ? {} : await getMediaAuthHeaders();
    const { sound } = await Audio.Sound.createAsync(
      { uri: playbackUri, headers },
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

  useEffect(() => {
    if (!autoPlay || autoPlayedRef.current || !playbackUri) return;

    autoPlayedRef.current = true;
    togglePlayback();
  }, [autoPlay, playbackUri]);

  const totalDuration = duration || 0;
  const progress = totalDuration > 0 ? Math.min(position / totalDuration, 1) : 0;

  return (
    <TouchableOpacity
      onPress={togglePlayback}
      activeOpacity={0.85}
      className="flex-row items-center min-w-[200px]"
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
          isOwnMessage ? 'bg-white/20' : 'bg-primary/10'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwnMessage ? '#fff' : '#0284C7'} />
        ) : (
          <Text className={isOwnMessage ? 'text-white' : 'text-primary'}>
            {hasError ? '⚠️' : isPlaying ? '⏸' : '▶️'}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <View
          className={`h-1.5 rounded-full overflow-hidden ${
            isOwnMessage ? 'bg-white/30' : 'bg-secondary-200'
          }`}
        >
          <View
            className={`h-full rounded-full ${isOwnMessage ? 'bg-white' : 'bg-primary'}`}
            style={{ width: `${Math.max(progress * 100, 4)}%` }}
          />
        </View>
        <Text className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-100' : 'text-secondary-500'}`}>
          {hasError ? 'Tap to retry' : formatDuration(isPlaying ? position : totalDuration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
