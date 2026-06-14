import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import VoiceNotePlayer from './VoiceNotePlayer';
import AuthenticatedImage from './AuthenticatedImage';
import { downloadAuthenticatedMediaFile, parseObjectNameFromMediaUrl } from '../../utils/chatMedia';

export default function MessageBubble({
  message,
  chatRoomId,
  isOwnMessage,
  senderName,
  onLocationPress,
  onImagePress,
}) {
  const meta = message.metadata || {};
  const isSystem = message.messageType === 'system';
  const roomId = chatRoomId || message.chatRoomId;

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const imageStyle = { width: 200, height: 200, borderRadius: 12 };

  const renderBody = () => {
    if (message.messageType === 'location') {
      const isLiveShare = meta.isLive !== false && !!meta.liveSessionId;
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => onLocationPress?.(message)}>
          <Text style={styles.locationEmoji}>📍</Text>
          <Text style={[styles.bodyText, isOwnMessage ? styles.ownText : styles.otherText]}>
            {isLiveShare ? 'Live location' : 'Shared location'}
          </Text>
          <Text style={[styles.metaText, isOwnMessage ? styles.ownMeta : styles.otherMeta]}>
            Tap to track and get directions
          </Text>
          {isLiveShare && (
            <Text style={[styles.liveText, isOwnMessage ? styles.ownMeta : styles.liveOther]}>
              🟢 Live
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    if (message.messageType === 'image' && (meta.objectName || meta.imageUrl)) {
      const resolvedObjectName = meta.objectName || parseObjectNameFromMediaUrl(meta.imageUrl);
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={async () => {
            if (resolvedObjectName) {
              try {
                const localUri = await downloadAuthenticatedMediaFile(roomId, resolvedObjectName);
                onImagePress?.(message, localUri);
              } catch {
                onImagePress?.(message, meta.imageUrl);
              }
              return;
            }
            onImagePress?.(message, meta.imageUrl);
          }}
        >
          <AuthenticatedImage
            chatRoomId={roomId}
            objectName={resolvedObjectName}
            mimeType={meta.mimeType}
            style={imageStyle}
            resizeMode="cover"
          />
          {message.content && message.content !== '📷 Photo' ? (
            <Text style={[styles.captionText, isOwnMessage ? styles.ownMeta : styles.otherMeta]}>
              {message.content}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    }

    if (
      (message.messageType === 'voice' || message.messageType === 'audio') &&
      (meta.objectName || meta.audioUrl)
    ) {
      return (
        <VoiceNotePlayer
          chatRoomId={roomId}
          objectName={meta.objectName || parseObjectNameFromMediaUrl(meta.audioUrl)}
          uri={meta.audioUrl}
          localUri={meta.localUri}
          duration={meta.duration}
          isOwnMessage={isOwnMessage}
        />
      );
    }

    return (
      <Text style={[styles.bodyText, isOwnMessage ? styles.ownText : styles.otherText]}>
        {message.content}
      </Text>
    );
  };

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}>
      {!isOwnMessage && <Text style={styles.senderName}>{senderName}</Text>}
      <View style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}>
        {renderBody()}
        <View style={styles.metaRow}>
          <Text style={[styles.timeText, isOwnMessage ? styles.ownTime : styles.otherTime]}>
            {message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''}
          </Text>
          {isOwnMessage && (
            <Text style={styles.deliveryText}>
              {message.deliveryStatus === 'delivered'
                ? '✓✓'
                : message.deliveryStatus === 'sent'
                  ? '✓'
                  : '⏳'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },
  senderName: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleOwn: {
    backgroundColor: '#0284C7',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
  },
  ownText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#0F172A',
  },
  metaText: {
    fontSize: 14,
    marginTop: 4,
  },
  ownMeta: {
    color: '#E0F2FE',
  },
  otherMeta: {
    color: '#64748B',
  },
  captionText: {
    fontSize: 14,
    marginTop: 8,
  },
  locationEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  liveText: {
    fontSize: 12,
    marginTop: 8,
  },
  liveOther: {
    color: '#10B981',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
  },
  ownTime: {
    color: '#BAE6FD',
  },
  otherTime: {
    color: '#94A3B8',
  },
  deliveryText: {
    color: '#BAE6FD',
    fontSize: 11,
    marginLeft: 4,
  },
  systemWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemBubble: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  systemText: {
    color: '#64748B',
    fontSize: 12,
  },
});
