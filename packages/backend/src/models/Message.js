const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chatRoomId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    messageType: {
      type: String,
      enum: ['text', 'location', 'image', 'system', 'meeting_point'],
      default: 'text',
    },
    metadata: {
      // For location messages
      latitude: Number,
      longitude: Number,
      // For image messages
      imageUrl: String,
      // For system messages
      action: String,
      // For meeting point messages
      meetingPoint: String,
    },
    deliveryStatus: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'offline_queued'],
      default: 'sent',
    },
    isOfflineMessage: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ chatRoomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
