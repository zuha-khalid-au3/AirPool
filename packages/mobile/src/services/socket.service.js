import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL = __DEV__
  ? 'http://localhost:5000'
  : 'https://api.airpool.app';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  async connect() {
    try {
      const tokenData = await SecureStore.getItemAsync('auth_tokens');
      if (!tokenData) {
        console.warn('No auth token for socket connection');
        return false;
      }

      const { accessToken } = JSON.parse(tokenData);

      this.socket = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('Socket connected:', this.socket.id);
        this._notifyListeners('connection_status', { connected: true });
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        console.log('Socket disconnected:', reason);
        this._notifyListeners('connection_status', { connected: false, reason });
      });

      this.socket.on('connect_error', (error) => {
        console.warn('Socket connection error:', error.message);
        this._notifyListeners('connection_status', { connected: false, error: error.message });
      });

      return true;
    } catch (error) {
      console.error('Socket connection failed:', error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join a chat room
  joinRoom(chatRoomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_room', { chatRoomId });
    }
  }

  // Leave a chat room
  leaveRoom(chatRoomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_room', { chatRoomId });
    }
  }

  // Send a message
  sendMessage(messageData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', messageData);
      return true;
    }
    return false;
  }

  // Start typing indicator
  startTyping(chatRoomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { chatRoomId });
    }
  }

  // Stop typing indicator
  stopTyping(chatRoomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { chatRoomId });
    }
  }

  // Share location
  shareLocation(chatRoomId, latitude, longitude) {
    if (this.socket && this.isConnected) {
      this.socket.emit('share_location', { chatRoomId, latitude, longitude });
    }
  }

  // Update meeting point
  updateMeetingPoint(chatRoomId, meetingPoint) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_meeting_point', { chatRoomId, meetingPoint });
    }
  }

  // Register event listener
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
    // Store for reconnection
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event).filter((cb) => cb !== callback);
      this.listeners.set(event, callbacks);
    }
  }

  // Internal: notify stored listeners
  _notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => cb(data));
    }
  }
}

export const socketService = new SocketService();
