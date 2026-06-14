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

function getMessageKey(message) {
  return String(message?._id || message?.localId || '');
}

function getSenderId(message) {
  if (!message?.sender) return '';
  return String(getUserId(message.sender) || message.sender?._id || message.sender || '');
}

function isLikelySameMessage(a, b) {
  if (!a || !b) return false;
  if (a.content !== b.content) return false;
  if (getSenderId(a) !== getSenderId(b)) return false;

  const aTime = new Date(a.createdAt || 0).getTime();
  const bTime = new Date(b.createdAt || 0).getTime();
  return Math.abs(aTime - bTime) < 60000;
}

function dedupeMessagesById(messages) {
  const result = [];

  for (const message of messages) {
    const id = getMessageKey(message);
    const localId = message.localId ? String(message.localId) : '';

    if (!id || id === 'undefined') continue;

    const duplicateIndex = result.findIndex((existing) => {
      if (getMessageKey(existing) === id) return true;
      if (localId && existing.localId === localId) return true;
      if (localId && getMessageKey(existing) === localId) return true;
      return false;
    });

    if (duplicateIndex === -1) {
      result.push(message);
      continue;
    }

    const existing = result[duplicateIndex];
    const preferNew =
      (!existing.isLocal && message.isLocal) ? false
        : (existing.isLocal && !message.isLocal) ? true
          : Boolean(message.deliveryStatus === 'delivered' && existing.isLocal);

    if (preferNew) {
      result[duplicateIndex] = message;
    }
  }

  return result;
}

function mergeMessagesWithServer(serverMessages, currentMessages) {
  const serverIds = new Set(
    serverMessages.map(getMessageKey).filter((id) => id && id !== 'undefined')
  );

  const keepFromCurrent = currentMessages.filter((message) => {
    const id = getMessageKey(message);
    if (!id || id === 'undefined') return false;
    if (serverIds.has(id)) return false;

    if (message.isLocal) {
      return !serverMessages.some((serverMessage) => isLikelySameMessage(serverMessage, message));
    }

    return true;
  });

  return [...serverMessages, ...keepFromCurrent];
}

function buildConfirmedMessage(existingLocal, localId, messageId, timestamp, sender, serverMessage, roomId) {
  if (serverMessage) {
    return enrichMessageMedia(
      {
        ...serverMessage,
        _id: messageId,
        localId: existingLocal?.localId || localId,
        chatRoomId: roomId,
        isLocal: false,
        deliveryStatus: 'delivered',
        createdAt: timestamp || serverMessage.createdAt,
        metadata: {
          ...(serverMessage.metadata || {}),
          ...(existingLocal?.metadata?.localUri ? { localUri: existingLocal.metadata.localUri } : {}),
        },
        sender: sender || serverMessage.sender || existingLocal?.sender,
      },
      roomId
    );
  }

  return enrichMessageMedia(
    {
      ...existingLocal,
      _id: messageId,
      localId: existingLocal?.localId || localId,
      chatRoomId: roomId,
      isLocal: false,
      deliveryStatus: 'delivered',
      createdAt: timestamp || existingLocal?.createdAt,
      sender: sender || existingLocal?.sender,
    },
    roomId
  );
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
  const sorted = sortMessagesByTime(dedupeMessagesById(next));

  return {
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomId]: sorted,
    },
    messagesRevisionByRoom: {
      ...(state.messagesRevisionByRoom || {}),
      [roomId]: (state.messagesRevisionByRoom?.[roomId] || 0) + 1,
    },
  };
}

export const useChatStore = create((set, get) => ({
  messagesByRoom: {},
  messagesRevisionByRoom: {},
  onlineUsersByRoom: {},
  offlineMessages: [],
  isConnected: false,
  typingUsersByRoom: {},
  memberLocations: {},
  liveLocations: {},
  activeLiveSession: null,
  socketListenersReady: false,
  loadRequestTokens: {},

  getRoomMessages: (chatRoomId) => get().messagesByRoom[normalizeRoomId(chatRoomId)] || [],

  getRoomOnlineUsers: (chatRoomId) => get().onlineUsersByRoom[normalizeRoomId(chatRoomId)] || [],

  getRoomTypingUsers: (chatRoomId) => get().typingUsersByRoom[normalizeRoomId(chatRoomId)] || [],

  initSocketListeners: () => {
    if (get().socketListenersReady) {
      socketService.setChatHandlers({
        onNewMessage: (data) => {
          const roomId = normalizeRoomId(data.chatRoomId || data.message?.chatRoomId);
          if (!roomId || !data.message) return;
          get().receiveMessage(data.message, roomId);
        },
        onMessageSent: (data) => {
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
        },
      });
      return;
    }

    socketService.setChatHandlers({
      onNewMessage: (data) => {
        const roomId = normalizeRoomId(data.chatRoomId || data.message?.chatRoomId);
        if (!roomId || !data.message) return;
        get().receiveMessage(data.message, roomId);
      },
      onMessageSent: (data) => {
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
      },
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
        socketService.rejoinActiveRooms();
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

    const requestToken = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      loadRequestTokens: {
        ...state.loadRequestTokens,
        [roomId]: requestToken,
      },
    }));

    try {
      const response = await api.get(`/chat/${roomId}/messages?page=${page}`);
      const newMessages = response.data.data.messages.map(normalizeMessageSender).map((message) =>
        enrichMessageMedia(message, roomId)
      );

      set((state) => {
        if (state.loadRequestTokens[roomId] !== requestToken) {
          return state;
        }

        if (page === 1) {
          return updateRoomMessages(state, roomId, (current) =>
            mergeMessagesWithServer(newMessages, current)
          );
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
        const messageId = getMessageKey(normalizedMessage);
        if (!messageId || messageId === 'undefined') {
          return [...current, normalizedMessage];
        }

        const incomingLocalId = normalizedMessage.localId
          ? String(normalizedMessage.localId)
          : '';

        const alreadyExists = current.some((existing) => {
          if (getMessageKey(existing) === messageId) return true;
          if (incomingLocalId && existing.localId === incomingLocalId) return true;
          if (incomingLocalId && existing._id === incomingLocalId) return true;
          return false;
        });

        if (alreadyExists) {
          return current.map((existing) => {
            if (getMessageKey(existing) !== messageId && existing.localId !== incomingLocalId) {
              return existing;
            }

            return {
              ...normalizedMessage,
              metadata: {
                ...(normalizedMessage.metadata || {}),
                ...(existing.metadata?.localUri ? { localUri: existing.metadata.localUri } : {}),
              },
            };
          });
        }

        const withoutReplacedLocal = incomingLocalId
          ? current.filter(
              (existing) =>
                existing.localId !== incomingLocalId && existing._id !== incomingLocalId
            )
          : current;

        return [...withoutReplacedLocal, normalizedMessage];
      })
    );
  },

  confirmMessageSent: (localId, messageId, timestamp, sender, serverMessage, chatRoomId) => {
    const roomId = normalizeRoomId(chatRoomId || serverMessage?.chatRoomId);
    if (!roomId || !localId) return;

    const serverId = String(messageId);

    set((state) =>
      updateRoomMessages(state, roomId, (current) => {
        const existingLocal = current.find(
          (message) => message.localId === localId || message._id === localId
        );

        const confirmed = buildConfirmedMessage(
          existingLocal,
          localId,
          messageId,
          timestamp,
          sender,
          serverMessage,
          roomId
        );

        const remaining = current.filter((message) => {
          if (message.localId === localId || message._id === localId) return false;
          if (getMessageKey(message) === serverId) return false;
          return true;
        });

        return [...remaining, confirmed];
      })
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
