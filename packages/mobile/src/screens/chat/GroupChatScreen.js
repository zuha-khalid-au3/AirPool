import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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

const EMPTY_MESSAGES = [];

export default function GroupChatScreen({ navigation, route }) {
  const { chatRoomId, poolId } = route.params;
  const { user } = useAuthStore();
  const userId = getUserId(user);
  const insets = useSafeAreaInsets();
  const { currentPool, getPoolDetails } = usePoolStore();
  const {
    incomingCall, setIncomingCall, setOutgoingCall, setActiveCall, clearCall,
  } = useCallStore();

  const messages = useChatStore(
    (state) => state.messagesByRoom[chatRoomId] || EMPTY_MESSAGES
  );
  const onlineUserIds = useChatStore(
    (state) => state.onlineUsersByRoom[chatRoomId] || []
  );
  const typingUsers = useChatStore(
    (state) => state.typingUsersByRoom[chatRoomId] || []
  );
  const isConnected = useChatStore((state) => state.isConnected);

  const loadMessages = useChatStore((state) => state.loadMessages);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const sendMediaMessage = useChatStore((state) => state.sendMediaMessage);
  const setTypingUser = useChatStore((state) => state.setTypingUser);
  const removeTypingUser = useChatStore((state) => state.removeTypingUser);
  const clearRoomState = useChatStore((state) => state.clearRoomState);
  const shareLiveLocation = useChatStore((state) => state.shareLiveLocation);
  const stopActiveLiveSession = useChatStore((state) => state.stopActiveLiveSession);
  const activeLiveSession = useChatStore((state) => state.activeLiveSession);
  const updateLiveLocation = useChatStore((state) => state.updateLiveLocation);
  const markLiveLocationStopped = useChatStore((state) => state.markLiveLocationStopped);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);

  const headerHeight = insets.top + 56;

  const otherMembers =
    currentPool?.members?.filter(
      (m) => m.status === 'active' && !idsMatch(getUserId(m.user), userId)
    ) || [];

  const onlineSet = useMemo(() => new Set(onlineUserIds.map(String)), [onlineUserIds]);

  useEffect(() => {
    if (poolId) getPoolDetails(poolId);
  }, [poolId]);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const lastMessageKey = messages.length
    ? String(messages[messages.length - 1]._id || messages[messages.length - 1].localId)
    : 'empty';

  useEffect(() => {
    if (messages.length > 0) {
      scrollToLatest(false);
    }
  }, [lastMessageKey, scrollToLatest]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const joinChat = async () => {
        await socketService.connect();
        if (!active) return;

        socketService.joinRoom(chatRoomId);

        const existing = useChatStore.getState().messagesByRoom[chatRoomId];
        if (!existing?.length) {
          await loadMessages(chatRoomId);
        }

        scrollToLatest(false);
      };

      joinChat();

      return () => {
        active = false;
        socketService.leaveRoom(chatRoomId);
        clearRoomState(chatRoomId);
      };
    }, [chatRoomId, loadMessages, scrollToLatest, clearRoomState])
  );

  useEffect(() => {
    let isActive = true;

    const handleUserTyping = (data) => {
      if (data.chatRoomId !== chatRoomId) return;
      if (idsMatch(data.userId, userId)) return;
      setTypingUser(chatRoomId, data.userId, data.name);
    };

    const handleUserStoppedTyping = (data) => {
      if (data.chatRoomId !== chatRoomId) return;
      removeTypingUser(chatRoomId, data.userId);
    };

    const handleLiveUpdate = (data) => updateLiveLocation(data.liveSessionId, data);
    const handleLiveStop = (data) => markLiveLocationStopped(data.liveSessionId);

    const handleCallInvite = (data) => {
      if (data.chatRoomId === chatRoomId) setIncomingCall(data);
    };
    const handleCallRinging = (data) => {
      if (data.chatRoomId === chatRoomId) {
        setOutgoingCall({ ...data, chatRoomId });
      }
    };
    const handleCallAccepted = (data) => {
      if (data.chatRoomId !== chatRoomId) return;
      setActiveCall(data);
    };
    const handleCallConnected = (data) => {
      if (data.chatRoomId !== chatRoomId) return;
      setActiveCall(data);
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

    socketService.on('user_typing', handleUserTyping);
    socketService.on('user_stopped_typing', handleUserStoppedTyping);
    socketService.on('live_location_update', handleLiveUpdate);
    socketService.on('live_location_stop', handleLiveStop);
    socketService.on('call_invite', handleCallInvite);
    socketService.on('call_ringing', handleCallRinging);
    socketService.on('call_accepted', handleCallAccepted);
    socketService.on('call_connected', handleCallConnected);
    socketService.on('call_rejected', handleCallRejected);
    socketService.on('call_unavailable', handleCallUnavailable);
    socketService.on('call_ended', handleCallEnded);

    return () => {
      isActive = false;
      socketService.off('user_typing', handleUserTyping);
      socketService.off('user_stopped_typing', handleUserStoppedTyping);
      socketService.off('live_location_update', handleLiveUpdate);
      socketService.off('live_location_stop', handleLiveStop);
      socketService.off('call_invite', handleCallInvite);
      socketService.off('call_ringing', handleCallRinging);
      socketService.off('call_accepted', handleCallAccepted);
      socketService.off('call_connected', handleCallConnected);
      socketService.off('call_rejected', handleCallRejected);
      socketService.off('call_unavailable', handleCallUnavailable);
      socketService.off('call_ended', handleCallEnded);
      stopActiveLiveSession();
      clearCall();
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
    scrollToLatest(true);
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
      scrollToLatest(true);
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
      text: `${m.user?.name || 'Member'}${onlineSet.has(String(getUserId(m.user))) ? ' · online' : ''}`,
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
      status: 'connecting',
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

  const totalMembers = otherMembers.length + 1;
  const onlineCount = onlineSet.size || (isConnected ? 1 : 0);

  const subtitle = typingUsers.length
    ? `${typingUsers.map((u) => u.name).join(', ')} typing…`
    : sharingLocation
      ? 'You are sharing live location'
      : `${onlineCount} online · ${totalMembers} members`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={startVoiceCall}
              activeOpacity={0.8}
            >
              <Text>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerActionBtn, styles.headerActionBtnPrimary]}
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
          style={styles.presenceStrip}
          contentContainerStyle={styles.presenceStripContent}
        >
          <View style={styles.presenceItem}>
            <View style={styles.avatarWrap}>
              <Avatar name={user?.name} size={34} />
              <View style={[styles.statusDot, styles.statusOnline]} />
            </View>
            <Text style={styles.presenceName} numberOfLines={1}>You</Text>
          </View>
          {otherMembers.map((m) => {
            const memberId = String(getUserId(m.user));
            const isOnline = onlineSet.has(memberId);
            return (
              <View key={memberId} style={styles.presenceItem}>
                <View style={styles.avatarWrap}>
                  <Avatar name={m.user?.name} size={34} />
                  <View
                    style={[
                      styles.statusDot,
                      isOnline ? styles.statusOnline : styles.statusOffline,
                    ]}
                  />
                </View>
                <Text style={styles.presenceName} numberOfLines={1}>
                  {m.user?.name?.split(' ')[0]}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => {
            const id = item._id || item.localId;
            return id ? String(id) : `message-${index}`;
          }}
          style={styles.messageList}
          contentContainerStyle={[
            styles.messageListContent,
            messages.length === 0 && styles.messageListContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          onContentSizeChange={() => scrollToLatest(false)}
          extraData={lastMessageKey}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Start the conversation</Text>
              <Text style={styles.emptySubtitle}>
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
          bottomInset={insets.bottom}
          onInputFocus={() => scrollToLatest(true)}
        />
      </KeyboardAvoidingView>

      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewBackdrop}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewImage(null)}
          >
            <Text style={styles.previewCloseText}>Close</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  chatBody: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtnPrimary: {
    backgroundColor: 'rgba(2,132,199,0.1)',
  },
  presenceStrip: {
    maxHeight: 72,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  presenceStripContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presenceItem: {
    alignItems: 'center',
    marginRight: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusOnline: {
    backgroundColor: '#22C55E',
  },
  statusOffline: {
    backgroundColor: '#94A3B8',
  },
  presenceName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    maxWidth: 52,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageListContentEmpty: {
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 18,
  },
  emptySubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  previewCloseText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  previewImage: {
    width: '100%',
    height: '70%',
  },
});
