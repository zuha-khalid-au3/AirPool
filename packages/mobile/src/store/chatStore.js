import { create } from 'zustand';
import api from '../services/api';
import { socketService } from '../services/socket.service';
import { useAuthStore } from './authStore';
import { getUserId } from '../utils/user';
import { createLiveSessionId } from '../utils/location';
import { uploadChatMedia } from '../services/chatMedia.service';
import { enrichMessageMedia, sanitizeOutgoingMetadata } from '../utils/chatMedia';

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

function sortMessagesByTime(messages) {
  return [...messages].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return aTime - bTime;
  });
}

function updateRoomMessages(state, chatRoomId, updater) {
  const current = state.messagesByRoom[chatRoomId] || [];
  const next = updater(current);
  return {
    messagesByRoom: {
      ...state.messagesByRoom,
      [chatRoomId]: sortMessagesByTime(dedupeMessagesById(next)),
    },
  };
}

export const useChatStore = create((set, get) => ({
  messagesByRoom: {},
  onlineUsersByRoom: {},
  offlineMessages: [],
  isConnected: false,
  typingUsersByRoom: {},
  memberLocations: {},
  liveLocations: {},
  activeLiveSession: null,
  socketListenersReady: false,

  getRoomMessages: (chatRoomId) => get().messagesByRoom[chatRoomId] || [],

  getRoomOnlineUsers: (chatRoomId) => get().onlineUsersByRoom[chatRoomId] || [],

  getRoomTypingUsers: (chatRoomId) => get().typingUsersByRoom[chatRoomId] || [],

  initSocketListeners: () => {
    if (get().socketListenersReady) return;

    socketService.on('new_message', (data) => {
      const roomId = data.chatRoomId || data.message?.chatRoomId;
      if (!roomId || !data.message) return;
      get().receiveMessage(data.message, roomId);
    });

    socketService.on('message_sent', (data) => {
      const roomId = data.chatRoomId || data.message?.chatRoomId;
      if (!roomId) return;
      get().confirmMessageSent(
        data.localId,
        data.messageId,
        data.timestamp,
        data.sender,
        data.message,
        roomId
      );
    });

    socketService.on('room_presence', (data) => {
      if (data.chatRoomId && Array.isArray(data.onlineUserIds)) {
        get().setRoomPresence(data.chatRoomId, data.onlineUserIds);
      }
    });

    socketService.on('user_online', (data) => {
      if (data.chatRoomId && data.userId) {
        get().markUserOnline(data.chatRoomId, String(data.userId));
      }
    });

    socketService.on('user_offline', (data) => {
      if (data.chatRoomId && data.userId) {
        get().markUserOffline(data.chatRoomId, String(data.userId));
      }
    });

    socketService.on('connection_status', (data) => {
      get().setConnected(data.connected);
      if (data.connected) {
        get().syncOfflineMessages();
      }
    });

    set({ socketListenersReady: true });
  },

  setRoomPresence: (chatRoomId, onlineUserIds) => {
    set((state) => ({
      onlineUsersByRoom: {
        ...state.onlineUsersByRoom,
        [chatRoomId]: onlineUserIds.map(String),
      },
    }));
  },

  markUserOnline: (chatRoomId, userId) => {
    set((state) => {
      const current = state.onlineUsersByRoom[chatRoomId] || [];
      const id = String(userId);
      if (current.includes(id)) return state;
      return {
        onlineUsersByRoom: {
          ...state.onlineUsersByRoom,
          [chatRoomId]: [...current, id],
        },
      };
    });
  },

  markUserOffline: (chatRoomId, userId) => {
    set((state) => {
      const id = String(userId);
      const current = state.onlineUsersByRoom[chatRoomId] || [];
      return {
        onlineUsersByRoom: {
          ...state.onlineUsersByRoom,
          [chatRoomId]: current.filter((uid) => uid !== id),
        },
      };
    });
  },

  loadMessages: async (chatRoomId, page = 1) => {
    try {
      const response = await api.get(`/chat/${chatRoomId}/messages?page=${page}`);
      const newMessages = response.data.data.messages.map(normalizeMessageSender).map((message) =>
        enrichMessageMedia(message, chatRoomId)
      );

      set((state) => {
        if (page === 1) {
          return updateRoomMessages(state, chatRoomId, () => newMessages);
        }

        return updateRoomMessages(state, chatRoomId, (current) => [...newMessages, ...current]);
      });

      return response.data.data.hasMore;
    } catch (error) {
      console.warn('Failed to load messages:', error.message);
      return false;
    }
  },

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

    set((state) => updateRoomMessages(state, chatRoomId, (current) => [...current, localMessage]));

    const sent = socketService.sendMessage({
      localId,
      chatRoomId,
      content,
      messageType,
      metadata: sanitizeOutgoingMetadata(metadata),
    });

    if (!sent) {
      set((state) => ({
        offlineMessages: [
          ...state.offlineMessages,
          { ...localMessage, deliveryStatus: 'offline_queued' },
        ],
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
      ...(file.uri ? { localUri: file.uri } : {}),
    };
    get().sendMessage(chatRoomId, content, messageType, metadata);
  },

  receiveMessage: (message, chatRoomId) => {
    const roomId = chatRoomId || message.chatRoomId;
    if (!roomId) return;

    const normalizedMessage = enrichMessageMedia(
      normalizeMessageSender({ ...message, chatRoomId: roomId }),
      roomId
    );

    set((state) =>
      updateRoomMessages(state, roomId, (current) => {
        const messageId = String(normalizedMessage._id);

        let updatedMessages = current.map((m) =>
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
          updatedMessages = [...updatedMessages, normalizedMessage];
        }

        return updatedMessages;
      })
    );
  },

  confirmMessageSent: (localId, messageId, timestamp, sender, serverMessage, chatRoomId) => {
    const roomId = chatRoomId || serverMessage?.chatRoomId;
    if (!roomId) return;

    set((state) =>
      updateRoomMessages(state, roomId, (current) =>
        current.map((m) => {
          if (m._id !== localId && m.localId !== localId) return m;

          const merged = serverMessage
            ? enrichMessageMedia(
                {
                  ...serverMessage,
                  _id: messageId,
                  localId: m.localId,
                  chatRoomId: roomId,
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
                  chatRoomId: roomId,
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
      )
    );
  },

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

  setTypingUser: (chatRoomId, userId, name) => {
    if (!chatRoomId) return;

    set((state) => {
      const current = state.typingUsersByRoom[chatRoomId] || [];
      const exists = current.find((u) => u.userId === userId);
      if (exists) return state;

      return {
        typingUsersByRoom: {
          ...state.typingUsersByRoom,
          [chatRoomId]: [...current, { userId, name }],
        },
      };
    });

    setTimeout(() => {
      get().removeTypingUser(chatRoomId, userId);
    }, 3000);
  },

  removeTypingUser: (chatRoomId, userId) => {
    if (!chatRoomId) return;

    set((state) => ({
      typingUsersByRoom: {
        ...state.typingUsersByRoom,
        [chatRoomId]: (state.typingUsersByRoom[chatRoomId] || []).filter(
          (u) => u.userId !== userId
        ),
      },
    }));
  },

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

  setConnected: (status) => set({ isConnected: status }),

  clearRoomState: (chatRoomId) => {
    set((state) => {
      const typingUsersByRoom = { ...state.typingUsersByRoom };
      delete typingUsersByRoom[chatRoomId];
      return { typingUsersByRoom };
    });
  },
}));
