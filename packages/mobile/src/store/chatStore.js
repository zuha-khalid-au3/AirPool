import { create } from 'zustand';
import api from '../services/api';
import { socketService } from '../services/socket.service';

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
        set({ messages: newMessages });
      } else {
        set((state) => ({ messages: [...newMessages, ...state.messages] }));
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

    const localMessage = {
      _id: localId,
      chatRoomId,
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
    set((state) => {
      // Replace local message with server message if it exists
      const updatedMessages = state.messages.map((m) =>
        m.isLocal && m._id === message.localId ? { ...message, isLocal: false } : m
      );

      // If not replacing a local message, add it
      const exists = state.messages.some((m) => m._id === message._id);
      if (!exists) {
        updatedMessages.push(message);
      }

      return { messages: updatedMessages };
    });
  },

  // Message sent confirmation
  confirmMessageSent: (localId, messageId, timestamp) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m._id === localId
          ? { ...m, _id: messageId, deliveryStatus: 'delivered', createdAt: timestamp, isLocal: false }
          : m
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
