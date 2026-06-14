import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, Alert, Modal, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { usePoolStore } from '../../store/poolStore';
import { socketService } from '../../services/socket.service';
import ScreenHeader from '../../components/ui/ScreenHeader';
import MessageBubble from '../../components/chat/MessageBubble';
import ChatComposer from '../../components/chat/ChatComposer';
import IncomingCallBanner from '../../components/chat/IncomingCallBanner';
import Avatar from '../../components/ui/Avatar';
import { getUserId, idsMatch } from '../../utils/user';

export default function GroupChatScreen({ navigation, route }) {
  const { chatRoomId, poolId } = route.params;
  const { user } = useAuthStore();
  const userId = getUserId(user);
  const { currentPool, getPoolDetails } = usePoolStore();
  const {
    incomingCall, setIncomingCall, setOutgoingCall, setActiveCall, clearCall,
  } = useCallStore();
  const {
    messages, loadMessages, sendMessage, sendMediaMessage, receiveMessage,
    confirmMessageSent, typingUsers, setTypingUser, removeTypingUser,
    setConnected, clearMessages, shareLiveLocation, stopActiveLiveSession,
    activeLiveSession, updateLiveLocation, markLiveLocationStopped,
    syncOfflineMessages,
  } = useChatStore();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);

  const otherMembers =
    currentPool?.members?.filter(
      (m) => m.status === 'active' && !idsMatch(getUserId(m.user), userId)
    ) || [];

  useEffect(() => {
    if (poolId) getPoolDetails(poolId);
  }, [poolId]);

  useEffect(() => {
    let isActive = true;

    const handleNewMessage = (data) => {
      if (!idsMatch(getUserId(data.message.sender), userId)) {
        receiveMessage(data.message);
      }
    };

    const handleMessageSent = (data) => {
      confirmMessageSent(
        data.localId,
        data.messageId,
        data.timestamp,
        data.sender,
        data.message
      );
    };

    const handleUserTyping = (data) => setTypingUser(data.userId, data.name);
    const handleUserStoppedTyping = (data) => removeTypingUser(data.userId);

    const handleConnectionStatus = (data) => {
      setConnected(data.connected);
      if (data.connected) {
        socketService.joinRoom(chatRoomId);
        syncOfflineMessages();
      }
    };

    const handleLiveUpdate = (data) => updateLiveLocation(data.liveSessionId, data);
    const handleLiveStop = (data) => markLiveLocationStopped(data.liveSessionId);

    const handleCallInvite = (data) => {
      if (data.chatRoomId === chatRoomId) setIncomingCall(data);
    };
    const handleCallRinging = (data) => {
      if (data.chatRoomId === chatRoomId) setOutgoingCall(data);
    };
    const handleCallAccepted = (data) => {
      if (data.chatRoomId !== chatRoomId) return;
      const peer = otherMembers.find((m) => idsMatch(getUserId(m.user), data.calleeId));
      setActiveCall(data);
      navigation.navigate('Call', {
        callId: data.callId,
        chatRoomId,
        peerName: peer?.user?.name || data.callee?.name,
        peerPhone: peer?.user?.phone,
        isOutgoing: true,
        status: 'connected',
      });
    };
    const handleCallConnected = (data) => {
      if (data.chatRoomId !== chatRoomId) return;
      const peer = otherMembers.find((m) => idsMatch(getUserId(m.user), data.callerId));
      setActiveCall(data);
      navigation.navigate('Call', {
        callId: data.callId,
        chatRoomId,
        peerName: peer?.user?.name || data.caller?.name,
        peerPhone: peer?.user?.phone,
        isOutgoing: false,
        status: 'connected',
      });
    };
    const handleCallRejected = () => {
      clearCall();
      Alert.alert('Call declined', 'The other person is unavailable.');
    };
    const handleCallUnavailable = (data) => {
      clearCall();
      Alert.alert('Unavailable', data.reason || 'User is offline.');
    };
    const handleCallEnded = () => clearCall();

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
      socketService.on('call_invite', handleCallInvite);
      socketService.on('call_ringing', handleCallRinging);
      socketService.on('call_accepted', handleCallAccepted);
      socketService.on('call_connected', handleCallConnected);
      socketService.on('call_rejected', handleCallRejected);
      socketService.on('call_unavailable', handleCallUnavailable);
      socketService.on('call_ended', handleCallEnded);

      if (connected) socketService.joinRoom(chatRoomId);
      await loadMessages(chatRoomId);
    };

    setup();

    return () => {
      isActive = false;
      [
        'new_message', 'message_sent', 'user_typing', 'user_stopped_typing',
        'connection_status', 'live_location_update', 'live_location_stop',
        'call_invite', 'call_ringing', 'call_accepted', 'call_connected',
        'call_rejected', 'call_unavailable', 'call_ended',
      ].forEach((event) => socketService.off(event));
      stopActiveLiveSession();
      clearCall();
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

  const handleSendMedia = async (file) => {
    setSendingMedia(true);
    try {
      await sendMediaMessage(chatRoomId, file);
    } catch (error) {
      Alert.alert('Upload failed', error.response?.data?.error?.message || error.message);
    } finally {
      setSendingMedia(false);
    }
  };

  const openLiveLocation = (message) => {
    const meta = message.metadata || {};
    navigation.navigate('LiveLocation', {
      chatRoomId,
      poolId,
      liveSessionId: meta.liveSessionId || `static_${message._id}`,
      targetUserId: getUserId(message.sender),
      targetName: message.sender?.name || 'Member',
      initialLatitude: meta.latitude,
      initialLongitude: meta.longitude,
      isLive: meta.isLive !== false && !!meta.liveSessionId,
    });
  };

  const startVoiceCall = () => {
    if (otherMembers.length === 0) {
      Alert.alert('No members', 'There is no one else in this pool to call.');
      return;
    }

    const buttons = otherMembers.map((m) => ({
      text: m.user?.name || 'Member',
      onPress: () => {
        socketService.inviteCall(chatRoomId, getUserId(m.user), 'voice');
        setOutgoingCall({ chatRoomId, calleeId: getUserId(m.user) });
        navigation.navigate('Call', {
          callId: null,
          chatRoomId,
          peerName: m.user?.name,
          peerPhone: m.user?.phone,
          isOutgoing: true,
          status: 'ringing',
        });
      },
    }));
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Voice call', 'Choose a pool member', buttons);
  };

  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    socketService.acceptCall(incomingCall.callId);
    const caller = otherMembers.find((m) =>
      idsMatch(getUserId(m.user), incomingCall.callerId)
    );
    setIncomingCall(null);
    navigation.navigate('Call', {
      callId: incomingCall.callId,
      chatRoomId,
      peerName: incomingCall.caller?.name || caller?.user?.name,
      peerPhone: caller?.user?.phone,
      isOutgoing: false,
      status: 'connected',
    });
  };

  const rejectIncomingCall = () => {
    if (incomingCall) socketService.rejectCall(incomingCall.callId);
    setIncomingCall(null);
  };

  const handleTyping = (text) => {
    setInputText(text);
    if (!isTyping) {
      setIsTyping(true);
      socketService.startTyping(chatRoomId);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(chatRoomId);
    }, 2000);
  };

  const renderMessage = ({ item: message }) => {
    const isOwnMessage = message.isLocal || idsMatch(getUserId(message.sender), userId);
    const senderName = isOwnMessage ? user?.name || 'You' : message.sender?.name || 'Unknown';

    return (
      <MessageBubble
        message={message}
        chatRoomId={chatRoomId}
        isOwnMessage={isOwnMessage}
        senderName={senderName}
        onLocationPress={openLiveLocation}
        onImagePress={async (_, url) => {
          setPreviewImage(url);
        }}
      />
    );
  };

  const subtitle = typingUsers.length
    ? `${typingUsers.map((u) => u.name).join(', ')} typing…`
    : sharingLocation
      ? 'You are sharing live location'
      : `${otherMembers.length + 1} members in chat`;

  return (
    <SafeAreaView className="flex-1 bg-secondary-50" edges={['top']}>
      <IncomingCallBanner
        call={incomingCall}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
      />

      <ScreenHeader
        title="Pool Chat"
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
        rightAction={
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-success/10 items-center justify-center"
              onPress={startVoiceCall}
              activeOpacity={0.8}
            >
              <Text>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center"
              onPress={() => navigation.navigate('PostLandingMap', { chatRoomId, poolId })}
              activeOpacity={0.8}
            >
              <Text>🗺️</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {otherMembers.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-white border-b border-secondary-100 px-4 py-3"
        >
          {otherMembers.map((m) => (
            <View key={getUserId(m.user)} className="items-center mr-4">
              <Avatar name={m.user?.name} size={44} />
              <Text className="text-secondary-500 text-[11px] mt-1 max-w-[56px]" numberOfLines={1}>
                {m.user?.name?.split(' ')[0]}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

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
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-5xl mb-4">💬</Text>
              <Text className="text-secondary-700 font-semibold text-lg">Start the conversation</Text>
              <Text className="text-secondary-400 text-center mt-2 px-8">
                Share text, photos, voice notes, live location, or start a voice call.
              </Text>
            </View>
          }
        />

        <ChatComposer
          inputText={inputText}
          onChangeText={handleTyping}
          onSend={handleSend}
          onShareLocation={handleShareLocation}
          onSendMedia={handleSendMedia}
          sharingLocation={sharingLocation}
          sendingMedia={sendingMedia}
        />
      </KeyboardAvoidingView>

      <Modal visible={!!previewImage} transparent animationType="fade">
        <View className="flex-1 bg-black/95 justify-center">
          <TouchableOpacity
            className="absolute top-14 right-6 z-10 bg-white/20 px-4 py-2 rounded-full"
            onPress={() => setPreviewImage(null)}
          >
            <Text className="text-white font-medium">Close</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={{ width: '100%', height: '70%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
