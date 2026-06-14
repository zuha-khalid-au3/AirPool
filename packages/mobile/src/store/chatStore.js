import { create } from 'zustand';
import api from '../services/api';
import { socketService } from '../services/socket.service';
import { useAuthStore } from './authStore';
import { getUserId } from '../utils/user';
import { createLiveSessionId } from '../utils/location';
import { uploadChatMedia } from '../services/chatMedia.service';
import { enrichMessageMedia } from '../utils/chatMedia';

function dedupeMessagesById(messages) {
  const seen = new Set();

  return messages.filter((message) => {
    const id = String(message._id || message.localId || '');
    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function buildSenderSnapshot(user) {
  if (!user) return null;

  return {
    _id: getUserId(user),
    name: user.name,
    avatar: user.avatar,
  };
}

function normalizeMessageSender(message) {
  if (message.sender && typeof message.sender === 'object' && message.sender.name) {
    return message;
  }

  const senderId =
    typeof message.sender === 'string' ? message.sender : getUserId(message.sender);

  if (!senderId) {
    return message;
  }

  return {
    ...message,
    sender: {
      _id: senderId,
      name: message.sender?.name || 'Unknown',
      avatar: message.sender?.avatar,
    },
  };
}

export const useChatStore = create((set, get) => ({
  messages: [],
  offlineMessages: [],
  isConnected: false,
  typingUsers: [],
  memberLocations: {},
  liveLocations: {},
  activeLiveSession: null,

  // Load messages for a chat room
  loadMessages: async (chatRoomId, page = 1) => {
    try {
      const response = await api.get(`/chat/${chatRoomId}/messages?page=${page}`);
      const newMessages = response.data.data.messages;

      if (page === 1) {
        set({
          messages: dedupeMessagesById(
            newMessages
              .map(normalizeMessageSender)
              .map((message) => enrichMessageMedia(message, chatRoomId))
          ),
        });
      } else {
        set((state) => ({
          messages: dedupeMessagesById([
            ...newMessages
              .map(normalizeMessageSender)
              .map((message) => enrichMessageMedia(message, chatRoomId)),
            ...state.messages,
          ]),
        }));
      }

      return response.data.data.hasMore;
    } catch (error) {
      console.warn('Failed to load messages:', error.message);
      return false;
    }
  },

  // Send a message via socket
  sendMessage: (chatRoomId, content, messageType = 'text', metadata = null) => {
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sender = buildSenderSnapshot(useAuthStore.getState().user);

    const localMessage = enrichMessageMedia(
      {
        _id: localId,
        localId,
        chatRoomId,
        sender,
        content,
        messageType,
        metadata,
        deliveryStatus: 'sent',
        createdAt: new Date().toISOString(),
        isLocal: true,
      },
      chatRoomId
    );

    // Add to local messages immediately
    set((state) => ({ messages: [...state.messages, localMessage] }));

    // Send via socket
    const sent = socketService.sendMessage({
      localId,
      chatRoomId,
      content,
      messageType,
      metadata,
    });

    if (!sent) {
      // Store as offline message
      set((state) => ({
        offlineMessages: [...state.offlineMessages, { ...localMessage, deliveryStatus: 'offline_queued' }],
      }));
    }

    return localId;
  },

  sendMediaMessage: async (chatRoomId, file) => {
    const upload = await uploadChatMedia(chatRoomId, file, {
      duration: file.duration,
      width: file.width,
      height: file.height,
    });

    const messageType = upload.mediaType === 'image' ? 'image' : 'voice';
    const content = messageType === 'image' ? '📷 Photo' : '🎤 Voice message';
    const metadata = {
      ...upload.metadata,
      ...(messageType === 'voice' && file.uri ? { localUri: file.uri } : {}),
    };
    get().sendMessage(chatRoomId, content, messageType, metadata);
  },

  // Handle incoming message from socket
  receiveMessage: (message) => {
    const normalizedMessage = enrichMessageMedia(
      normalizeMessageSender(message),
      message.chatRoomId
    );

    set((state) => {
      const messageId = String(normalizedMessage._id);

      let updatedMessages = state.messages.map((m) =>
        m.isLocal && normalizedMessage.localId && m.localId === normalizedMessage.localId
          ? {
              ...normalizedMessage,
              isLocal: false,
              metadata: {
                ...(normalizedMessage.metadata || {}),
                ...(m.metadata?.localUri ? { localUri: m.metadata.localUri } : {}),
              },
            }
          : m
      );

      const exists = updatedMessages.some((m) => String(m._id) === messageId);
      if (!exists) {
        updatedMessages.push(normalizedMessage);
      }

      return { messages: dedupeMessagesById(updatedMessages) };
    });
  },

  // Message sent confirmation
  confirmMessageSent: (localId, messageId, timestamp, sender, serverMessage) => {
    set((state) => ({
      messages: dedupeMessagesById(
        state.messages.map((m) => {
          if (m._id !== localId && m.localId !== localId) return m;

          const roomId = serverMessage?.chatRoomId || m.chatRoomId;
          const merged = serverMessage
            ? enrichMessageMedia(
                {
                  ...serverMessage,
                  _id: messageId,
                  localId: m.localId,
                  isLocal: false,
                  deliveryStatus: 'delivered',
                  createdAt: timestamp || serverMessage.createdAt,
                  metadata: {
                    ...(serverMessage.metadata || {}),
                    ...(m.metadata?.localUri ? { localUri: m.metadata.localUri } : {}),
                  },
                },
                roomId
              )
            : enrichMessageMedia(
                {
                  ...m,
                  _id: messageId,
                  isLocal: false,
                  deliveryStatus: 'delivered',
                  createdAt: timestamp || m.createdAt,
                },
                roomId
              );

          return {
            ...merged,
            sender: sender || merged.sender,
          };
        })
      ),
    }));
  },

  // Sync offline messages when back online
  syncOfflineMessages: async () => {
    const { offlineMessages } = get();
    if (offlineMessages.length === 0) return;

    try {
      await api.post('/chat/sync', { messages: offlineMessages });
      set({ offlineMessages: [] });
    } catch (error) {
      console.warn('Failed to sync offline messages:', error.message);
    }
  },

  // Typing indicators
  setTypingUser: (userId, name) => {
    set((state) => {
      const exists = state.typingUsers.find((u) => u.userId === userId);
      if (!exists) {
        return { typingUsers: [...state.typingUsers, { userId, name }] };
      }
      return state;
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
      }));
    }, 3000);
  },

  removeTypingUser: (userId) => {
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
    }));
  },

  // Member locations
  updateMemberLocation: (userId, locationData) => {
    set((state) => ({
      memberLocations: {
        ...state.memberLocations,
        [userId]: locationData,
      },
    }));
  },

  updateLiveLocation: (liveSessionId, locationData) => {
    set((state) => ({
      liveLocations: {
        ...state.liveLocations,
        [liveSessionId]: {
          ...state.liveLocations[liveSessionId],
          ...locationData,
          isLive: true,
        },
      },
    }));
  },

  markLiveLocationStopped: (liveSessionId) => {
    set((state) => {
      if (!state.liveLocations[liveSessionId]) return state;
      return {
        liveLocations: {
          ...state.liveLocations,
          [liveSessionId]: {
            ...state.liveLocations[liveSessionId],
            isLive: false,
            stoppedAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  shareLiveLocation: async (chatRoomId) => {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission is required to share live location.');
    }

    const user = useAuthStore.getState().user;
    const userId = getUserId(user);
    const liveSessionId = createLiveSessionId(userId);

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude, heading, accuracy } = position.coords;

    const metadata = {
      latitude,
      longitude,
      heading,
      accuracy,
      liveSessionId,
      isLive: true,
    };

    get().sendMessage(
      chatRoomId,
      '📍 Sharing live location — tap to track and navigate',
      'location',
      metadata
    );

    get().updateLiveLocation(liveSessionId, {
      userId,
      name: user?.name,
      latitude,
      longitude,
      heading,
      accuracy,
      chatRoomId,
    });

    const watcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 8,
        timeInterval: 4000,
      },
      (loc) => {
        const coords = loc.coords;
        get().updateLiveLocation(liveSessionId, {
          userId,
          name: user?.name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: coords.heading,
          accuracy: coords.accuracy,
          chatRoomId,
          timestamp: new Date().toISOString(),
        });
        socketService.sendLiveLocationUpdate(
          chatRoomId,
          liveSessionId,
          coords.latitude,
          coords.longitude,
          coords.heading,
          coords.accuracy
        );
      }
    );

    set({
      activeLiveSession: { liveSessionId, chatRoomId, watcher },
    });

    return liveSessionId;
  },

  stopActiveLiveSession: () => {
    const { activeLiveSession } = get();
    if (!activeLiveSession) return;

    const { liveSessionId, chatRoomId, watcher } = activeLiveSession;
    if (watcher?.remove) {
      watcher.remove();
    }

    socketService.stopLiveLocation(chatRoomId, liveSessionId);
    get().markLiveLocationStopped(liveSessionId);
    set({ activeLiveSession: null });
  },

  // Connection status
  setConnected: (status) => set({ isConnected: status }),

  // Clear messages
  clearMessages: () =>
    set({
      messages: [],
      typingUsers: [],
      memberLocations: {},
      liveLocations: {},
    }),
}));
