const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    countryCode: {
      type: String,
      default: '+91',
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    googleId: {
      type: String,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: ['pending', 'submitted', 'approved', 'rejected'],
      default: 'pending',
    },
    kycDocuments: {
      govtId: {
        url: String,
        type: { type: String, enum: ['aadhaar', 'pan', 'passport', 'voter_id'] },
        verified: { type: Boolean, default: false },
        uploadedAt: Date,
      },
      selfie: {
        url: String,
        verified: { type: Boolean, default: false },
        uploadedAt: Date,
      },
    },
    trustScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    completedRides: {
      type: Number,
      default: 0,
    },
    noShows: {
      type: Number,
      default: 0,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    preferredLanguage: {
      type: String,
      default: 'en',
    },
    deviceInfo: {
      deviceId: String,
      platform: String,
      pushToken: String,
      appVersion: String,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    banReason: String,
    banExpiresAt: Date,
    refreshToken: String,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
userSchema.index({ phone: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ trustScore: -1 });
userSchema.index({ lastActive: -1 });

// Virtual for full phone number
userSchema.virtual('fullPhone').get(function () {
  return `${this.countryCode}${this.phone}`;
});

// Method to update trust score
userSchema.methods.updateTrustScore = function () {
  if (this.totalRides === 0) return;
  const completionRate = this.completedRides / this.totalRides;
  const noShowPenalty = this.noShows * 5;
  this.trustScore = Math.max(0, Math.min(100, Math.round(completionRate * 100) - noShowPenalty));
};

const User = mongoose.model('User', userSchema);

module.exports = User;
