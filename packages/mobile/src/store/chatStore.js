import { create } from 'zustand';
import api from '../services/api';
import { socketService } from '../services/socket.service';
import { useAuthStore } from './authStore';
import { getUserId } from '../utils/user';
import { createLiveSessionId } from '../utils/location';
import { uploadChatMedia } from '../services/chatMedia.service';
import { enrichMessageMedia, sanitizeOutgoingMetadata } from '../utils/chatMedia';

const typingClearTimers = new Map();

function normalizeRoomId(chatRoomId) {
  if (chatRoomId == null || chatRoomId === '') return '';
  return String(chatRoomId);
}

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
  const roomId = normalizeRoomId(chatRoomId);
  if (!roomId) return state;

  const current = state.messagesByRoom[roomId] || [];
  const next = updater(current);
  return {
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomId]: sortMessagesByTime(dedupeMessagesById(next)),
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

  getRoomMessages: (chatRoomId) => get().messagesByRoom[normalizeRoomId(chatRoomId)] || [],

  getRoomOnlineUsers: (chatRoomId) => get().onlineUsersByRoom[normalizeRoomId(chatRoomId)] || [],

  getRoomTypingUsers: (chatRoomId) => get().typingUsersByRoom[normalizeRoomId(chatRoomId)] || [],

  initSocketListeners: () => {
    if (get().socketListenersReady) return;

    socketService.on('new_message', (data) => {
      const roomId = normalizeRoomId(data.chatRoomId || data.message?.chatRoomId);
      if (!roomId || !data.message) return;
      get().receiveMessage(data.message, roomId);
    });

    socketService.on('message_sent', (data) => {
      const roomId = normalizeRoomId(data.chatRoomId || data.message?.chatRoomId);
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
      const roomId = normalizeRoomId(data.chatRoomId);
      if (roomId && Array.isArray(data.onlineUserIds)) {
        get().setRoomPresence(roomId, data.onlineUserIds);
      }
    });

    socketService.on('user_online', (data) => {
      const roomId = normalizeRoomId(data.chatRoomId);
      if (roomId && data.userId) {
        get().markUserOnline(roomId, String(data.userId));
      }
    });

    socketService.on('user_offline', (data) => {
      const roomId = normalizeRoomId(data.chatRoomId);
      if (roomId && data.userId) {
        get().markUserOffline(roomId, String(data.userId));
      }
    });

    socketService.on('user_typing', (data) => {
      const roomId = normalizeRoomId(data.chatRoomId);
      if (!roomId || !data.userId) return;
      const me = getUserId(useAuthStore.getState().user);
      if (me && String(data.userId) === String(me)) return;
      get().setTypingUser(roomId, String(data.userId), data.name);
    });

    socketService.on('user_stopped_typing', (data) => {
      const roomId = normalizeRoomId(data.chatRoomId);
      if (!roomId || !data.userId) return;
      get().removeTypingUser(roomId, String(data.userId));
    });

    socketService.on('connection_status', (data) => {
      get().setConnected(data.connected);
      if (data.connected) {
        socketService.joinCurrentRoom();
        get().syncOfflineMessages();
      }
    });

    set({ socketListenersReady: true });
  },

  setRoomPresence: (chatRoomId, onlineUserIds) => {
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return;

    set((state) => ({
      onlineUsersByRoom: {
        ...state.onlineUsersByRoom,
        [roomId]: onlineUserIds.map(String),
      },
    }));
  },

  markUserOnline: (chatRoomId, userId) => {
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return;

    set((state) => {
      const current = state.onlineUsersByRoom[roomId] || [];
      const id = String(userId);
      if (current.includes(id)) return state;
      return {
        onlineUsersByRoom: {
          ...state.onlineUsersByRoom,
          [roomId]: [...current, id],
        },
      };
    });
  },

  markUserOffline: (chatRoomId, userId) => {
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return;

    set((state) => {
      const id = String(userId);
      const current = state.onlineUsersByRoom[roomId] || [];
      return {
        onlineUsersByRoom: {
          ...state.onlineUsersByRoom,
          [roomId]: current.filter((uid) => uid !== id),
        },
      };
    });
  },

  loadMessages: async (chatRoomId, page = 1) => {
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return false;

    try {
      const response = await api.get(`/chat/${roomId}/messages?page=${page}`);
      const newMessages = response.data.data.messages.map(normalizeMessageSender).map((message) =>
        enrichMessageMedia(message, roomId)
      );

      set((state) => {
        if (page === 1) {
          return updateRoomMessages(state, roomId, (current) => {
            const pendingLocal = current.filter((message) => message.isLocal);
            const merged = [...newMessages];

            pendingLocal.forEach((localMessage) => {
              const alreadySaved = merged.some(
                (message) =>
                  (localMessage.localId &&
                    (message.localId === localMessage.localId ||
                      String(message._id) === String(localMessage.localId))) ||
                  String(message._id) === String(localMessage._id)
              );

              if (!alreadySaved) {
                merged.push(localMessage);
              }
            });

            return merged;
          });
        }

        return updateRoomMessages(state, roomId, (current) => [...newMessages, ...current]);
      });

      return response.data.data.hasMore;
    } catch (error) {
      console.warn('Failed to load messages:', error.message);
      return false;
    }
  },

  sendMessage: (chatRoomId, content, messageType = 'text', metadata = null) => {
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return null;

    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sender = buildSenderSnapshot(useAuthStore.getState().user);

    const localMessage = enrichMessageMedia(
      {
        _id: localId,
        localId,
        chatRoomId: roomId,
        sender,
        content,
        messageType,
        metadata,
        deliveryStatus: 'sent',
        createdAt: new Date().toISOString(),
        isLocal: true,
      },
      roomId
    );

    set((state) => updateRoomMessages(state, roomId, (current) => [...current, localMessage]));

    const sent = socketService.sendMessage({
      localId,
      chatRoomId: roomId,
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
    const roomId = normalizeRoomId(chatRoomId || message.chatRoomId);
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
    const roomId = normalizeRoomId(chatRoomId || serverMessage?.chatRoomId);
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
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return;

    const id = String(userId);
    const timerKey = `${roomId}:${id}`;

    if (typingClearTimers.has(timerKey)) {
      clearTimeout(typingClearTimers.get(timerKey));
    }

    set((state) => {
      const current = state.typingUsersByRoom[roomId] || [];
      const withoutUser = current.filter((u) => String(u.userId) !== id);

      return {
        typingUsersByRoom: {
          ...state.typingUsersByRoom,
          [roomId]: [...withoutUser, { userId: id, name }],
        },
      };
    });

    typingClearTimers.set(
      timerKey,
      setTimeout(() => {
        get().removeTypingUser(roomId, id);
        typingClearTimers.delete(timerKey);
      }, 3500)
    );
  },

  removeTypingUser: (chatRoomId, userId) => {
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return;

    const id = String(userId);

    set((state) => ({
      typingUsersByRoom: {
        ...state.typingUsersByRoom,
        [roomId]: (state.typingUsersByRoom[roomId] || []).filter(
          (u) => String(u.userId) !== id
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
    const roomId = normalizeRoomId(chatRoomId);
    if (!roomId) return;

    set((state) => {
      const typingUsersByRoom = { ...state.typingUsersByRoom };
      delete typingUsersByRoom[roomId];
      return { typingUsersByRoom };
    });
  },
}));
