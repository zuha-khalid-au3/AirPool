const Message = require('../models/Message');
const RidePool = require('../models/RidePool');
const { uploadBuffer, getMinIOClient } = require('../config/minio');
const { AppError } = require('../middleware/errorHandler');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const BUCKET = process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_NAME || 'airpool-uploads';

function getApiPublicBaseUrl() {
  const base =
    process.env.API_PUBLIC_URL ||
    process.env.GOOGLE_REDIRECT_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  return base.replace(/\/$/, '');
}

function buildChatMediaApiUrl(chatRoomId, objectName) {
  return `${getApiPublicBaseUrl()}/api/v1/chat/${encodeURIComponent(chatRoomId)}/file?objectName=${encodeURIComponent(objectName)}`;
}

async function assertPoolMember(chatRoomId, userId) {
  const pool = await RidePool.findOne({ chatRoomId });
  if (!pool) {
    throw new AppError('Chat room not found', 404, 'CHAT_NOT_FOUND');
  }

  const isMember = pool.members.some(
    (m) => m.user.toString() === userId.toString() && m.status !== 'left'
  );
  if (!isMember) {
    throw new AppError('You are not a member of this chat', 403, 'NOT_MEMBER');
  }

  return pool;
}

async function resolveMessageMedia(message) {
  const obj = message.toObject ? message.toObject({ virtuals: true }) : { ...message };
  const meta = obj.metadata || {};

  if (meta.objectName && obj.chatRoomId) {
    const url = buildChatMediaApiUrl(obj.chatRoomId, meta.objectName);
    if (obj.messageType === 'image') {
      obj.metadata = { ...meta, imageUrl: url };
    } else if (obj.messageType === 'audio' || obj.messageType === 'voice') {
      obj.metadata = { ...meta, audioUrl: url };
    }
  }

  return obj;
}

async function resolveMessagesMedia(messages) {
  return Promise.all(messages.map((msg) => resolveMessageMedia(msg)));
}

// Get messages for a chat room
const getMessages = async (req, res, next) => {
  try {
    const { chatRoomId } = req.params;
    const { page = 1, limit = 50, before } = req.query;

    await assertPoolMember(chatRoomId, req.user._id);

    const query = { chatRoomId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    const resolved = await resolveMessagesMedia(messages.reverse());

    res.status(200).json({
      success: true,
      data: {
        messages: resolved,
        hasMore: messages.length === parseInt(limit, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Upload chat media (image or voice note)
const uploadMedia = async (req, res, next) => {
  try {
    const { chatRoomId } = req.params;
    const { duration, width, height } = req.body;

    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    await assertPoolMember(chatRoomId, req.user._id);

    const isImage = req.file.mimetype.startsWith('image/');
    const isAudio =
      req.file.mimetype.startsWith('audio/') ||
      req.file.mimetype === 'video/mp4'; // expo-av m4a sometimes reports as mp4

    if (!isImage && !isAudio) {
      throw new AppError('Only images and audio files are allowed', 400, 'INVALID_FILE_TYPE');
    }

    let buffer = req.file.buffer;
    let contentType = req.file.mimetype;
    let extension = req.file.originalname?.split('.').pop() || (isImage ? 'jpg' : 'm4a');

    if (isImage) {
      buffer = await sharp(req.file.buffer)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      contentType = 'image/jpeg';
      extension = 'jpg';
    }

    const folder = isImage ? 'images' : 'audio';
    const objectName = `chat/${chatRoomId}/${folder}/${req.user._id}/${uuidv4()}.${extension}`;

    await uploadBuffer(BUCKET, objectName, buffer, { 'Content-Type': contentType });
    const mediaUrl = buildChatMediaApiUrl(chatRoomId, objectName);

    const mediaType = isImage ? 'image' : 'voice';
    const metadata = {
      objectName,
      mimeType: contentType,
      fileSize: buffer.length,
    };

    if (isImage) {
      metadata.imageUrl = mediaUrl;
      if (width) metadata.width = parseInt(width, 10);
      if (height) metadata.height = parseInt(height, 10);
    } else {
      metadata.audioUrl = mediaUrl;
      if (duration) metadata.duration = parseFloat(duration);
    }

    res.status(201).json({
      success: true,
      data: {
        mediaType,
        objectName,
        url: mediaUrl,
        metadata,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Stream a chat media file (authenticated proxy to MinIO)
const serveMediaFile = async (req, res, next) => {
  try {
    const { chatRoomId } = req.params;
    const { objectName } = req.query;

    if (!objectName || typeof objectName !== 'string') {
      throw new AppError('Media object name is required', 400, 'INVALID_MEDIA');
    }

    const expectedPrefix = `chat/${chatRoomId}/`;
    if (!objectName.startsWith(expectedPrefix)) {
      throw new AppError('Invalid media file path', 403, 'INVALID_MEDIA');
    }

    await assertPoolMember(chatRoomId, req.user._id);

    const client = getMinIOClient();
    const stat = await client.statObject(BUCKET, objectName);
    const contentType =
      stat.metaData?.['content-type'] ||
      stat.metaData?.['Content-Type'] ||
      'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = await client.getObject(BUCKET, objectName);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (error) {
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      return next(new AppError('Media file not found', 404, 'MEDIA_NOT_FOUND'));
    }
    next(error);
  }
};

// Send a message (REST endpoint for offline sync)
const sendMessage = async (req, res, next) => {
  try {
    const { chatRoomId, content, messageType, metadata } = req.body;

    await assertPoolMember(chatRoomId, req.user._id);

    const message = await Message.create({
      chatRoomId,
      sender: req.user._id,
      content: content || '',
      messageType,
      metadata,
      deliveryStatus: 'sent',
    });

    await message.populate('sender', 'name avatar');
    const resolved = await resolveMessageMedia(message);

    res.status(201).json({
      success: true,
      data: { message: resolved },
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
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      throw new AppError('Messages array is required', 400, 'INVALID_INPUT');
    }

    const savedMessages = [];

    for (const msg of messages) {
      const message = await Message.create({
        chatRoomId: msg.chatRoomId,
        sender: req.user._id,
        content: msg.content || '',
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
  uploadMedia,
  serveMediaFile,
  sendMessage,
  markAsRead,
  syncOfflineMessages,
  resolveMessageMedia,
  buildChatMediaApiUrl,
};
