const Message = require('../models/Message');
const RidePool = require('../models/RidePool');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Get messages for a chat room
const getMessages = async (req, res, next) => {
  try {
    const { chatRoomId } = req.params;
    const { page = 1, limit = 50, before } = req.query;

    // Verify user is a member of this pool
    const pool = await RidePool.findOne({ chatRoomId });
    if (!pool) {
      throw new AppError('Chat room not found', 404, 'CHAT_NOT_FOUND');
    }

    const isMember = pool.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.status !== 'left'
    );
    if (!isMember) {
      throw new AppError('You are not a member of this chat', 403, 'NOT_MEMBER');
    }

    const query = { chatRoomId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Send a message (REST endpoint for offline sync)
const sendMessage = async (req, res, next) => {
  try {
    const { chatRoomId, content, messageType, metadata } = req.body;

    // Verify membership
    const pool = await RidePool.findOne({ chatRoomId });
    if (!pool) {
      throw new AppError('Chat room not found', 404, 'CHAT_NOT_FOUND');
    }

    const isMember = pool.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.status !== 'left'
    );
    if (!isMember) {
      throw new AppError('You are not a member of this chat', 403, 'NOT_MEMBER');
    }

    const message = await Message.create({
      chatRoomId,
      sender: req.user._id,
      content,
      messageType,
      metadata,
      deliveryStatus: 'sent',
    });

    await message.populate('sender', 'name avatar');

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};

// Mark messages as read
const markAsRead = async (req, res, next) => {
  try {
    const { chatRoomId } = req.params;
    const { messageIds } = req.body;

    if (messageIds && messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds }, chatRoomId },
        {
          $addToSet: {
            readBy: { user: req.user._id, readAt: new Date() },
          },
          $set: { deliveryStatus: 'read' },
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// Sync offline messages (batch upload from device)
const syncOfflineMessages = async (req, res, next) => {
  try {
    const { messages } = req.body; // Array of offline messages

    if (!messages || !Array.isArray(messages)) {
      throw new AppError('Messages array is required', 400, 'INVALID_INPUT');
    }

    const savedMessages = [];

    for (const msg of messages) {
      const message = await Message.create({
        chatRoomId: msg.chatRoomId,
        sender: req.user._id,
        content: msg.content,
        messageType: msg.messageType || 'text',
        metadata: msg.metadata,
        isOfflineMessage: true,
        deliveryStatus: 'delivered',
        createdAt: msg.sentAt || new Date(),
      });
      savedMessages.push(message);
    }

    res.status(201).json({
      success: true,
      message: `${savedMessages.length} offline messages synced`,
      data: { syncedCount: savedMessages.length },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markAsRead,
  syncOfflineMessages,
};
