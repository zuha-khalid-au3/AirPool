import { create } from 'zustand';
import api from '../services/api';
import { socketService } from '../services/socket.service';
import { useAuthStore } from './authStore';
import { getUserId } from '../utils/user';

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

  // Load messages for a chat room
  loadMessages: async (chatRoomId, page = 1) => {
    try {
      const response = await api.get(`/chat/${chatRoomId}/messages?page=${page}`);
      const newMessages = response.data.data.messages;

      if (page === 1) {
        set({ messages: dedupeMessagesById(newMessages.map(normalizeMessageSender)) });
      } else {
        set((state) => ({
          messages: dedupeMessagesById([
            ...newMessages.map(normalizeMessageSender),
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

    const localMessage = {
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
    };

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

  // Handle incoming message from socket
  receiveMessage: (message) => {
    const normalizedMessage = normalizeMessageSender(message);

    set((state) => {
      const messageId = String(normalizedMessage._id);

      let updatedMessages = state.messages.map((m) =>
        m.isLocal && normalizedMessage.localId && m.localId === normalizedMessage.localId
          ? { ...normalizedMessage, isLocal: false }
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
  confirmMessageSent: (localId, messageId, timestamp, sender) => {
    set((state) => ({
      messages: dedupeMessagesById(
        state.messages.map((m) =>
          m._id === localId || m.localId === localId
            ? {
                ...m,
                _id: messageId,
                sender: sender || m.sender,
                deliveryStatus: 'delivered',
                createdAt: timestamp,
                isLocal: false,
              }
            : m
        )
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

  // Connection status
  setConnected: (status) => set({ isConnected: status }),

  // Clear messages
  clearMessages: () => set({ messages: [], typingUsers: [], memberLocations: {} }),
}));
