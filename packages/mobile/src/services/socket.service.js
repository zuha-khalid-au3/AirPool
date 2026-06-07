import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { isNgrokUrl } from '../config/env.utils';
import { SOCKET_URL } from '../config/env';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.currentRoomId = null;
    this.connectPromise = null;
  }

  waitForConnection(timeoutMs = 10000) {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        this.socket?.off('connect', onConnect);
        resolve(false);
      }, timeoutMs);

      const onConnect = () => {
        clearTimeout(timeout);
        this.socket?.off('connect', onConnect);
        resolve(true);
      };

      this.socket?.on('connect', onConnect);
    });
  }

  attachStoredListeners() {
    if (!this.socket) return;

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket.off(event, callback);
        this.socket.on(event, callback);
      });
    });
  }

  joinCurrentRoom() {
    if (this.socket?.connected && this.currentRoomId) {
      this.socket.emit('join_room', { chatRoomId: this.currentRoomId });
    }
  }

  async connect() {
    if (this.socket?.connected) {
      return true;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this._connect();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async _connect() {
    try {
      const tokenData = await SecureStore.getItemAsync('auth_tokens');
      if (!tokenData) {
        console.warn('No auth token for socket connection');
        return false;
      }

      const { accessToken } = JSON.parse(tokenData);

      if (this.socket) {
        this.socket.auth = { token: accessToken };
        this.attachStoredListeners();
        this.socket.connect();
        return this.waitForConnection();
      }

      const extraHeaders = isNgrokUrl(SOCKET_URL)
        ? { 'ngrok-skip-browser-warning': 'true' }
        : undefined;

      this.socket = io(SOCKET_URL, {
        auth: { token: accessToken },
        extraHeaders,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('Socket connected:', this.socket.id);
        this.joinCurrentRoom();
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

      this.attachStoredListeners();
      return this.waitForConnection();
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
      this.currentRoomId = null;
    }
  }

  joinRoom(chatRoomId) {
    this.currentRoomId = chatRoomId;
    this.joinCurrentRoom();
  }

  leaveRoom(chatRoomId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_room', { chatRoomId });
    }

    if (this.currentRoomId === chatRoomId) {
      this.currentRoomId = null;
    }
  }

  sendMessage(messageData) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', messageData);
      return true;
    }

    return false;
  }

  startTyping(chatRoomId) {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', { chatRoomId });
    }
  }

  stopTyping(chatRoomId) {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', { chatRoomId });
    }
  }

  shareLocation(chatRoomId, latitude, longitude) {
    if (this.socket?.connected) {
      this.socket.emit('share_location', { chatRoomId, latitude, longitude });
    }
  }

  updateMeetingPoint(chatRoomId, meetingPoint) {
    if (this.socket?.connected) {
      this.socket.emit('update_meeting_point', { chatRoomId, meetingPoint });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const callbacks = this.listeners.get(event);
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
    }

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = callback
        ? this.listeners.get(event).filter((cb) => cb !== callback)
        : [];
      this.listeners.set(event, callbacks);
    }

    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  _notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => cb(data));
    }
  }
}

export const socketService = new SocketService();
