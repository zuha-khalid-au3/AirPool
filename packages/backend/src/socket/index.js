const { verifyToken } = require('../utils/jwt');
const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../utils/logger');

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
          content,
          messageType,
          metadata,
          deliveryStatus: 'delivered',
        });

        await message.populate('sender', 'name avatar');

        const serializedMessage = serializeChatMessage(message, socket.user);

        // Broadcast to room
        io.to(chatRoomId).emit('new_message', {
          message: serializedMessage,
        });

        // Acknowledge to sender
        socket.emit('message_sent', {
          localId: data.localId,
          messageId: message._id,
          timestamp: message.createdAt,
          sender: serializeSender(socket.user),
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

    // Live location sharing
    socket.on('share_location', (data) => {
      const { chatRoomId, latitude, longitude } = data;
      socket.to(chatRoomId).emit('member_location', {
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

    // Disconnect
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${socket.userId}`);
      await redisClient.hDel('online_users', socket.userId);
    });
  });

  return io;
};

module.exports = { setupSocketHandlers };
