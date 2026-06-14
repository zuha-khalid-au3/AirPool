import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { downloadAuthenticatedMediaFile, normalizeLocalFileUri } from '../../utils/chatMedia';

export default function AuthenticatedImage({
  chatRoomId,
  objectName,
  mimeType,
  localUri,
  style,
  resizeMode = 'cover',
}) {
  const [uri, setUri] = useState(localUri ? normalizeLocalFileUri(localUri) : null);
  const [loading, setLoading] = useState(!localUri);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (localUri) {
        if (!cancelled) {
          setUri(normalizeLocalFileUri(localUri));
          setLoading(false);
          setFailed(false);
        }
        return;
      }

      if (!chatRoomId || !objectName) {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setFailed(false);

      try {
        const downloadedUri = await downloadAuthenticatedMediaFile(chatRoomId, objectName);
        if (!cancelled) {
          setUri(downloadedUri);
        }
      } catch (error) {
        console.warn('[AuthenticatedImage] load failed:', error?.message || error);
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [chatRoomId, objectName, localUri, mimeType]);

  if (loading) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }]}>
        <ActivityIndicator color="#0284C7" />
      </View>
    );
  }

  if (failed || !uri) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }]}>
        <Text style={{ color: '#64748B', fontSize: 13 }}>Image unavailable</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}
