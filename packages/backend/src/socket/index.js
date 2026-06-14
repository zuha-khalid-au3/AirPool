const { verifyToken } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');
const User = require('../models/User');
const { resolveMessageMedia } = require('../controllers/chat.controller');
const logger = require('../utils/logger');

const activeCalls = new Map();

function serializeChatMessage(message, senderUser) {
  const messageObj = message.toObject({ virtuals: true });
  const populatedSender = message.sender?.name ? message.sender : senderUser;

  messageObj.sender = {
    _id: populatedSender?._id || populatedSender?.id || messageObj.sender,
    name: populatedSender?.name || 'Unknown',
    avatar: populatedSender?.avatar,
  };

  return messageObj;
}

function serializeSender(senderUser) {
  return {
    _id: senderUser._id || senderUser.id,
    name: senderUser.name,
    avatar: senderUser.avatar,
  };
}

const ALLOWED_MESSAGE_METADATA_KEYS = [
  'latitude',
  'longitude',
  'heading',
  'accuracy',
  'liveSessionId',
  'isLive',
  'objectName',
  'mimeType',
  'fileSize',
  'width',
  'height',
  'duration',
  'action',
  'meetingPoint',
];

function sanitizeMessageMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined;

  const sanitized = {};
  for (const key of ALLOWED_MESSAGE_METADATA_KEYS) {
    if (metadata[key] !== undefined) {
      sanitized[key] = metadata[key];
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

const setupSocketHandlers = (io, redisClient) => {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      const user = await User.findById(decoded.userId).select('name avatar trustScore');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = decoded.userId;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Store user's socket in Redis for multi-server support
    redisClient.hSet('online_users', socket.userId, socket.id);

    // Join a chat room (pool)
    socket.on('join_room', async (data) => {
      const { chatRoomId } = data;
      socket.join(chatRoomId);
      logger.info(`User ${socket.userId} joined room ${chatRoomId}`);

      // Notify room members
      socket.to(chatRoomId).emit('user_joined', {
        userId: socket.userId,
        name: socket.user.name,
        avatar: socket.user.avatar,
        timestamp: new Date(),
      });
    });

    // Leave a chat room
    socket.on('leave_room', (data) => {
      const { chatRoomId } = data;
      socket.leave(chatRoomId);

      socket.to(chatRoomId).emit('user_left', {
        userId: socket.userId,
        name: socket.user.name,
        timestamp: new Date(),
      });
    });

    // Send a message
    socket.on('send_message', async (data) => {
      try {
        const { chatRoomId, content, messageType = 'text', metadata } = data;

        const message = await Message.create({
          chatRoomId,
          sender: socket.userId,
          content: content || '',
          messageType,
          metadata: sanitizeMessageMetadata(metadata),
          deliveryStatus: 'delivered',
        });

        await message.populate('sender', 'name avatar');

        const resolved = await resolveMessageMedia(message);
        const serializedMessage = serializeChatMessage(resolved, socket.user);

        // Broadcast to other members in the room (sender gets message_sent)
        socket.to(chatRoomId).emit('new_message', {
          message: serializedMessage,
        });

        // Acknowledge to sender with full resolved message (includes media URLs)
        socket.emit('message_sent', {
          localId: data.localId,
          messageId: message._id,
          timestamp: message.createdAt,
          sender: serializeSender(socket.user),
          message: serializedMessage,
        });
      } catch (error) {
        socket.emit('message_error', {
          localId: data.localId,
          error: error.message,
        });
      }
    });

    // Typing indicator
    socket.on('typing_start', (data) => {
      socket.to(data.chatRoomId).emit('user_typing', {
        userId: socket.userId,
        name: socket.user.name,
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(data.chatRoomId).emit('user_stopped_typing', {
        userId: socket.userId,
      });
    });

    // Live location sharing (session-based, tied to chat location messages)
    socket.on('live_location_update', (data) => {
      const {
        chatRoomId,
        liveSessionId,
        latitude,
        longitude,
        heading,
        accuracy,
      } = data;

      if (!chatRoomId || !liveSessionId) return;

      io.to(chatRoomId).emit('live_location_update', {
        liveSessionId,
        userId: socket.userId,
        name: socket.user.name,
        avatar: socket.user.avatar,
        latitude,
        longitude,
        heading,
        accuracy,
        timestamp: new Date(),
      });
    });

    socket.on('live_location_stop', (data) => {
      const { chatRoomId, liveSessionId } = data;
      if (!chatRoomId || !liveSessionId) return;

      io.to(chatRoomId).emit('live_location_stop', {
        liveSessionId,
        userId: socket.userId,
        name: socket.user.name,
        timestamp: new Date(),
      });
    });

    // Legacy location broadcast (kept for PostLandingMap screen)
    socket.on('share_location', (data) => {
      const { chatRoomId, latitude, longitude } = data;
      io.to(chatRoomId).emit('member_location', {
        userId: socket.userId,
        name: socket.user.name,
        avatar: socket.user.avatar,
        latitude,
        longitude,
        timestamp: new Date(),
      });
    });

    // Update meeting point
    socket.on('update_meeting_point', (data) => {
      const { chatRoomId, meetingPoint } = data;
      io.to(chatRoomId).emit('meeting_point_updated', {
        userId: socket.userId,
        name: socket.user.name,
        meetingPoint,
        timestamp: new Date(),
      });
    });

    // Voice call signaling
    socket.on('call_invite', async (data) => {
      try {
        const { chatRoomId, calleeId, callType = 'voice' } = data;
        if (!chatRoomId || !calleeId || calleeId === socket.userId) return;

        const callId = uuidv4();
        activeCalls.set(callId, {
          callId,
          chatRoomId,
          callerId: socket.userId,
          calleeId,
          callType,
          status: 'ringing',
          startedAt: new Date(),
        });

        const payload = {
          callId,
          chatRoomId,
          callType,
          callerId: socket.userId,
          caller: serializeSender(socket.user),
        };

        const calleeSocketId = await redisClient.hGet('online_users', calleeId);
        if (calleeSocketId) {
          io.to(calleeSocketId).emit('call_invite', payload);
          socket.emit('call_ringing', { callId, calleeId, chatRoomId });
        } else {
          activeCalls.delete(callId);
          socket.emit('call_unavailable', {
            calleeId,
            reason: 'User is offline',
          });
        }
      } catch (error) {
        socket.emit('call_error', { error: error.message });
      }
    });

    socket.on('call_accept', async (data) => {
      const { callId } = data;
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== socket.userId) return;

      call.status = 'connected';
      call.connectedAt = new Date();

      const payload = {
        callId,
        chatRoomId: call.chatRoomId,
        callType: call.callType,
        callerId: call.callerId,
        calleeId: call.calleeId,
        callee: serializeSender(socket.user),
      };

      const callerSocketId = await redisClient.hGet('online_users', call.callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_accepted', payload);
      }
      socket.emit('call_connected', payload);
    });

    socket.on('call_reject', async (data) => {
      const { callId, reason = 'declined' } = data;
      const call = activeCalls.get(callId);
      if (!call) return;

      const payload = { callId, reason, chatRoomId: call.chatRoomId };
      const callerSocketId = await redisClient.hGet('online_users', call.callerId);

      if (callerSocketId) {
        io.to(callerSocketId).emit('call_rejected', payload);
      }
      activeCalls.delete(callId);
    });

    socket.on('call_end', async (data) => {
      const { callId } = data;
      const call = activeCalls.get(callId);
      if (!call) return;

      const payload = { callId, chatRoomId: call.chatRoomId };
      const otherUserId =
        call.callerId === socket.userId ? call.calleeId : call.callerId;
      const otherSocketId = await redisClient.hGet('online_users', otherUserId);

      if (otherSocketId) {
        io.to(otherSocketId).emit('call_ended', payload);
      }
      socket.emit('call_ended', payload);
      activeCalls.delete(callId);
    });

    async function relayCallWebRtcSignal(io, redisClient, callId, fromUserId, event, payload) {
      const call = activeCalls.get(callId);
      if (!call) return;

      const otherUserId = call.callerId === fromUserId ? call.calleeId : call.callerId;
      const otherSocketId = await redisClient.hGet('online_users', otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit(event, { callId, ...payload });
      }
    }

    socket.on('call_webrtc_offer', async (data) => {
      const { callId, offer } = data;
      if (!callId || !offer) return;
      await relayCallWebRtcSignal(io, redisClient, callId, socket.userId, 'call_webrtc_offer', {
        offer,
      });
    });

    socket.on('call_webrtc_answer', async (data) => {
      const { callId, answer } = data;
      if (!callId || !answer) return;
      await relayCallWebRtcSignal(io, redisClient, callId, socket.userId, 'call_webrtc_answer', {
        answer,
      });
    });

    socket.on('call_webrtc_ice', async (data) => {
      const { callId, candidate } = data;
      if (!callId || !candidate) return;
      await relayCallWebRtcSignal(io, redisClient, callId, socket.userId, 'call_webrtc_ice', {
        candidate,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${socket.userId}`);
      await redisClient.hDel('online_users', socket.userId);
    });
  });

  return io;
};

module.exports = { setupSocketHandlers };
