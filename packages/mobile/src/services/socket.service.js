import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { isNgrokUrl } from '../config/env.utils';
import { SOCKET_URL } from '../config/env';

const SERVER_EVENTS = [
  'new_message',
  'message_sent',
  'message_error',
  'user_typing',
  'user_stopped_typing',
  'user_joined',
  'user_left',
  'member_location',
  'live_location_update',
  'live_location_stop',
  'meeting_point_updated',
  'call_invite',
  'call_ringing',
  'call_accepted',
  'call_connected',
  'call_rejected',
  'call_unavailable',
  'call_ended',
  'call_error',
  'call_webrtc_offer',
  'call_webrtc_answer',
  'call_webrtc_ice',
];

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.currentRoomId = null;
    this.connectPromise = null;
    this.serverEventsBound = false;
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

  bindServerEvents() {
    if (!this.socket || this.serverEventsBound) return;

    SERVER_EVENTS.forEach((event) => {
      this.socket.on(event, (data) => this._notifyListeners(event, data));
    });

    this.serverEventsBound = true;
  }

  joinCurrentRoom() {
    if (this.socket?.connected && this.currentRoomId) {
      this.socket.emit('join_room', { chatRoomId: this.currentRoomId });
    }
  }

  async connect() {
    if (this.socket?.connected) {
      this.joinCurrentRoom();
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
        this.socket.connect();
        return this.waitForConnection();
      }

      const extraHeaders = isNgrokUrl(SOCKET_URL)
        ? { 'ngrok-skip-browser-warning': 'true' }
        : undefined;

      this.socket = io(SOCKET_URL, {
        auth: { token: accessToken },
        extraHeaders,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.bindServerEvents();

      this.socket.io.on('reconnect', () => {
        this.joinCurrentRoom();
        this._notifyListeners('connection_status', { connected: true, reconnected: true });
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
      this.serverEventsBound = false;
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

  sendLiveLocationUpdate(chatRoomId, liveSessionId, latitude, longitude, heading, accuracy) {
    if (this.socket?.connected) {
      this.socket.emit('live_location_update', {
        chatRoomId,
        liveSessionId,
        latitude,
        longitude,
        heading,
        accuracy,
      });
    }
  }

  stopLiveLocation(chatRoomId, liveSessionId) {
    if (this.socket?.connected) {
      this.socket.emit('live_location_stop', { chatRoomId, liveSessionId });
    }
  }

  inviteCall(chatRoomId, calleeId, callType = 'voice') {
    if (this.socket?.connected) {
      this.socket.emit('call_invite', { chatRoomId, calleeId, callType });
    }
  }

  acceptCall(callId) {
    if (this.socket?.connected) {
      this.socket.emit('call_accept', { callId });
    }
  }

  rejectCall(callId, reason = 'declined') {
    if (this.socket?.connected) {
      this.socket.emit('call_reject', { callId, reason });
    }
  }

  endCall(callId) {
    if (this.socket?.connected) {
      this.socket.emit('call_end', { callId });
    }
  }

  sendCallOffer(callId, offer) {
    if (this.socket?.connected) {
      this.socket.emit('call_webrtc_offer', { callId, offer });
    }
  }

  sendCallAnswer(callId, answer) {
    if (this.socket?.connected) {
      this.socket.emit('call_webrtc_answer', { callId, answer });
    }
  }

  sendCallIceCandidate(callId, candidate) {
    if (this.socket?.connected) {
      this.socket.emit('call_webrtc_ice', { callId, candidate });
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
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;

    if (callback) {
      this.listeners.set(
        event,
        this.listeners.get(event).filter((cb) => cb !== callback)
      );
    } else {
      this.listeners.set(event, []);
    }
  }

  _notifyListeners(event, data) {
    const callbacks = this.listeners.get(event);
    if (!callbacks?.length) return;
    callbacks.forEach((cb) => cb(data));
  }
}

export const socketService = new SocketService();
