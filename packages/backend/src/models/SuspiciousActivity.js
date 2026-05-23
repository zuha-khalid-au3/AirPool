const mongoose = require('mongoose');

const suspiciousActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activityType: {
      type: String,
      enum: [
        'multiple_pools_created',
        'rapid_join_leave',
        'duplicate_device',
        'fake_ticket',
        'abusive_chat',
        'location_spoofing',
        'repeated_no_shows',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    description: String,
    metadata: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'dismissed'],
      default: 'open',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    resolution: String,
  },
  {
    timestamps: true,
  }
);

suspiciousActivitySchema.index({ user: 1, createdAt: -1 });
suspiciousActivitySchema.index({ status: 1, severity: -1 });
suspiciousActivitySchema.index({ activityType: 1 });

const SuspiciousActivity = mongoose.model('SuspiciousActivity', suspiciousActivitySchema);

module.exports = SuspiciousActivity;
