import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import VoiceNotePlayer from './VoiceNotePlayer';
import AuthenticatedImage from './AuthenticatedImage';
import { fetchAuthenticatedImageDataUri, parseObjectNameFromMediaUrl } from '../../utils/chatMedia';

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
      <View className="items-center my-2">
        <View className="bg-secondary-100 rounded-full px-4 py-2">
          <Text className="text-secondary-500 text-xs">{message.content}</Text>
        </View>
      </View>
    );
  }

  const bubbleClass = isOwnMessage
    ? 'bg-primary rounded-br-md shadow-sm'
    : 'bg-white border border-secondary-100 rounded-bl-md shadow-sm';

  const textClass = isOwnMessage ? 'text-white' : 'text-secondary-900';
  const metaClass = isOwnMessage ? 'text-primary-100' : 'text-secondary-500';
  const timeClass = isOwnMessage ? 'text-primary-200' : 'text-secondary-400';

  const imageStyle = { width: 224, height: 224, borderRadius: 12 };

  const renderBody = () => {
    if (message.messageType === 'location') {
      const isLiveShare = meta.isLive !== false && !!meta.liveSessionId;
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => onLocationPress?.(message)}>
          <Text className={`text-2xl mb-1 ${textClass}`}>📍</Text>
          <Text className={`text-base font-semibold ${textClass}`}>
            {isLiveShare ? 'Live location' : 'Shared location'}
          </Text>
          <Text className={`text-sm mt-1 ${metaClass}`}>Tap to track and get directions</Text>
          {isLiveShare && (
            <Text className={`text-xs mt-2 ${isOwnMessage ? 'text-primary-200' : 'text-success'}`}>
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
              const dataUri = await fetchAuthenticatedImageDataUri(
                roomId,
                resolvedObjectName,
                meta.mimeType
              );
              onImagePress?.(message, dataUri);
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
            <Text className={`text-sm mt-2 ${metaClass}`}>{message.content}</Text>
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
          autoPlay={Boolean(isOwnMessage && meta.localUri)}
        />
      );
    }

    return <Text className={`text-base leading-6 ${textClass}`}>{message.content}</Text>;
  };

  return (
    <View className={`mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
      {!isOwnMessage && (
        <Text className="text-secondary-400 text-xs mb-1 ml-1 font-medium">{senderName}</Text>
      )}
      <View className={`max-w-[82%] rounded-2xl px-4 py-3 ${bubbleClass}`}>
        {renderBody()}
        <View className="flex-row justify-end items-center mt-1.5">
          <Text className={`text-[11px] ${timeClass}`}>
            {message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''}
          </Text>
          {isOwnMessage && (
            <Text className="text-primary-200 text-[11px] ml-1">
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
