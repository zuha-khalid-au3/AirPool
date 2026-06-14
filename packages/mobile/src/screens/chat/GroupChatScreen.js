import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket.service';
import { format } from 'date-fns';
import { getUserId, idsMatch } from '../../utils/user';

export default function GroupChatScreen({ navigation, route }) {
  const { chatRoomId, poolId } = route.params;
  const { user } = useAuthStore();
  const userId = getUserId(user);
  const {
    messages, loadMessages, sendMessage, receiveMessage,
    confirmMessageSent, typingUsers, setTypingUser, removeTypingUser,
    setConnected, clearMessages, shareLiveLocation, stopActiveLiveSession,
    activeLiveSession, updateLiveLocation, markLiveLocationStopped,
  } = useChatStore();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    let isActive = true;

    const handleNewMessage = (data) => {
      if (!idsMatch(getUserId(data.message.sender), userId)) {
        receiveMessage(data.message);
      }
    };

    const handleMessageSent = (data) => {
      confirmMessageSent(data.localId, data.messageId, data.timestamp, data.sender);
    };

    const handleUserTyping = (data) => {
      setTypingUser(data.userId, data.name);
    };

    const handleUserStoppedTyping = (data) => {
      removeTypingUser(data.userId);
    };

    const handleConnectionStatus = (data) => {
      setConnected(data.connected);
      if (data.connected) {
        socketService.joinRoom(chatRoomId);
      }
    };

    const handleLiveUpdate = (data) => {
      if (data.chatRoomId && data.chatRoomId !== chatRoomId) return;
      updateLiveLocation(data.liveSessionId, data);
    };

    const handleLiveStop = (data) => {
      markLiveLocationStopped(data.liveSessionId);
    };

    const setup = async () => {
      const connected = await socketService.connect();
      if (!isActive) return;

      socketService.on('new_message', handleNewMessage);
      socketService.on('message_sent', handleMessageSent);
      socketService.on('user_typing', handleUserTyping);
      socketService.on('user_stopped_typing', handleUserStoppedTyping);
      socketService.on('connection_status', handleConnectionStatus);
      socketService.on('live_location_update', handleLiveUpdate);
      socketService.on('live_location_stop', handleLiveStop);

      if (connected) {
        socketService.joinRoom(chatRoomId);
      }

      await loadMessages(chatRoomId);
    };

    setup();

    return () => {
      isActive = false;
      socketService.off('new_message', handleNewMessage);
      socketService.off('message_sent', handleMessageSent);
      socketService.off('user_typing', handleUserTyping);
      socketService.off('user_stopped_typing', handleUserStoppedTyping);
      socketService.off('connection_status', handleConnectionStatus);
      socketService.off('live_location_update', handleLiveUpdate);
      socketService.off('live_location_stop', handleLiveStop);
      stopActiveLiveSession();
      socketService.leaveRoom(chatRoomId);
      clearMessages();
    };
  }, [chatRoomId, userId]);

  useEffect(() => {
    setSharingLocation(!!activeLiveSession && activeLiveSession.chatRoomId === chatRoomId);
  }, [activeLiveSession, chatRoomId]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    sendMessage(chatRoomId, inputText.trim());
    setInputText('');
    socketService.stopTyping(chatRoomId);
  };

  const handleShareLocation = async () => {
    if (sharingLocation) {
      stopActiveLiveSession();
      setSharingLocation(false);
      return;
    }

    try {
      setSharingLocation(true);
      await shareLiveLocation(chatRoomId);
    } catch (error) {
      setSharingLocation(false);
      Alert.alert('Could not share location', error.message);
    }
  };

  const openLiveLocation = (message) => {
    const meta = message.metadata || {};
    const senderId = getUserId(message.sender);
    navigation.navigate('LiveLocation', {
      chatRoomId,
      poolId,
      liveSessionId: meta.liveSessionId || `static_${message._id}`,
      targetUserId: senderId,
      targetName: message.sender?.name || 'Member',
      initialLatitude: meta.latitude,
      initialLongitude: meta.longitude,
      isLive: meta.isLive !== false && !!meta.liveSessionId,
    });
  };

  const handleTyping = (text) => {
    setInputText(text);

    if (!isTyping) {
      setIsTyping(true);
      socketService.startTyping(chatRoomId);
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(chatRoomId);
    }, 2000);
  };

  const renderMessage = ({ item: message }) => {
    const isOwnMessage =
      message.isLocal || idsMatch(getUserId(message.sender), userId);
    const isSystem = message.messageType === 'system';
    const senderName = isOwnMessage
      ? user?.name || 'You'
      : message.sender?.name || 'Unknown';

    if (isSystem) {
      return (
        <View className="items-center my-2">
          <View className="bg-secondary-100 rounded-full px-4 py-2">
            <Text className="text-secondary-500 text-xs">{message.content}</Text>
          </View>
        </View>
      );
    }

    if (message.messageType === 'location') {
      const meta = message.metadata || {};
      const isLiveShare = meta.isLive !== false && !!meta.liveSessionId;

      return (
        <View className={`mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {!isOwnMessage && (
            <Text className="text-secondary-400 text-xs mb-1 ml-3">{senderName}</Text>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openLiveLocation(message)}
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              isOwnMessage ? 'bg-primary rounded-br-sm' : 'bg-secondary-100 rounded-bl-sm'
            }`}
          >
            <Text className={`text-2xl mb-1 ${isOwnMessage ? 'text-white' : 'text-secondary-900'}`}>
              📍
            </Text>
            <Text className={`text-base font-medium ${isOwnMessage ? 'text-white' : 'text-secondary-900'}`}>
              {isLiveShare ? 'Live location' : 'Shared location'}
            </Text>
            <Text className={`text-sm mt-1 ${isOwnMessage ? 'text-primary-100' : 'text-secondary-500'}`}>
              Tap to track {isOwnMessage ? 'your position' : senderName} and get directions
            </Text>
            {isLiveShare && (
              <Text className={`text-xs mt-2 ${isOwnMessage ? 'text-primary-200' : 'text-success'}`}>
                🟢 Live updates enabled
              </Text>
            )}
            <Text
              className={`text-xs mt-2 ${isOwnMessage ? 'text-primary-200' : 'text-secondary-400'}`}
            >
              {message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className={`mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {!isOwnMessage && (
          <Text className="text-secondary-400 text-xs mb-1 ml-3">
            {senderName}
          </Text>
        )}
        <View
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isOwnMessage
              ? 'bg-primary rounded-br-sm'
              : 'bg-secondary-100 rounded-bl-sm'
          }`}
        >
          <Text className={`text-base ${isOwnMessage ? 'text-white' : 'text-secondary-900'}`}>
            {message.content}
          </Text>
          <View className="flex-row justify-end mt-1">
            <Text
              className={`text-xs ${isOwnMessage ? 'text-primary-200' : 'text-secondary-400'}`}
            >
              {message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : ''}
            </Text>
            {isOwnMessage && (
              <Text className="text-primary-200 text-xs ml-1">
                {message.deliveryStatus === 'delivered' ? '✓✓' : message.deliveryStatus === 'sent' ? '✓' : '⏳'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="bg-white px-6 py-4 border-b border-secondary-100 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-secondary-900 font-bold text-lg">Pool Chat</Text>
          {typingUsers.length > 0 && (
            <Text className="text-primary text-xs">
              {typingUsers.map((u) => u.name).join(', ')} typing...
            </Text>
          )}
          {sharingLocation && (
            <Text className="text-success text-xs">You are sharing live location</Text>
          )}
        </View>
        <TouchableOpacity
          className="bg-primary-50 px-3 py-2 rounded-lg mr-2"
          onPress={() => navigation.navigate('PostLandingMap', { chatRoomId, poolId })}
        >
          <Text className="text-primary text-xs font-medium">🗺️ All</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => {
            const id = item._id || item.localId;
            return id ? String(id) : `message-${index}`;
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-4xl mb-3">💬</Text>
              <Text className="text-secondary-500">No messages yet. Say hello!</Text>
            </View>
          }
        />

        <View className="flex-row items-end px-4 py-3 border-t border-secondary-100 bg-white">
          <TouchableOpacity
            className={`w-11 h-11 rounded-full items-center justify-center mr-2 ${
              sharingLocation ? 'bg-danger' : 'bg-success/10'
            }`}
            onPress={handleShareLocation}
            activeOpacity={0.85}
          >
            <Text className="text-lg">{sharingLocation ? '⏹' : '📍'}</Text>
          </TouchableOpacity>
          <TextInput
            className="flex-1 border border-secondary-200 rounded-2xl px-4 py-3 mr-3 text-base max-h-24"
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            multiline
            value={inputText}
            onChangeText={handleTyping}
          />
          <TouchableOpacity
            className={`w-12 h-12 rounded-full items-center justify-center ${
              inputText.trim() ? 'bg-primary' : 'bg-secondary-200'
            }`}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text className="text-white text-lg">↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
