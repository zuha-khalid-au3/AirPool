const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'left', 'no_show', 'completed'],
    default: 'active',
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  ratingComment: String,
});

const ridePoolSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    flightNumber: {
      type: String,
      required: true,
      uppercase: true,
    },
    arrivalAirport: {
      code: { type: String, required: true, uppercase: true },
      name: String,
      city: String,
    },
    arrivalTime: {
      type: Date,
      required: true,
    },
    destination: {
      name: { type: String, required: true },
      address: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
      distanceKm: Number,
    },
    meetingPoint: {
      description: { type: String, default: 'Airport Exit Gate' },
      landmark: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    vehicleType: {
      type: String,
      enum: ['auto_rickshaw', 'sedan', 'suv', 'any'],
      default: 'any',
    },
    maxMembers: {
      type: Number,
      default: 4,
      min: 2,
      max: 8,
    },
    members: [memberSchema],
    estimatedCostTotal: {
      type: Number,
      default: 0,
    },
    estimatedCostPerPerson: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'full', 'in_progress', 'completed', 'cancelled', 'expired'],
      default: 'open',
    },
    genderPreference: {
      type: String,
      enum: ['any', 'female_only', 'male_only'],
      default: 'any',
    },
    chatRoomId: {
      type: String,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    completedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    expiresAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
ridePoolSchema.index({ flightNumber: 1, arrivalTime: 1 });
ridePoolSchema.index({ 'arrivalAirport.code': 1, arrivalTime: 1, status: 1 });
ridePoolSchema.index({ 'destination.name': 1 });
ridePoolSchema.index({ status: 1, isActive: 1 });
ridePoolSchema.index({ creator: 1 });
ridePoolSchema.index({ 'members.user': 1 });

// Virtual for current member count
ridePoolSchema.virtual('currentMembers').get(function () {
  return this.members.filter((m) => m.status === 'active').length;
});

// Virtual for available spots
ridePoolSchema.virtual('availableSpots').get(function () {
  const activeMembers = this.members.filter((m) => m.status === 'active').length;
  return this.maxMembers - activeMembers;
});

// Pre-save: generate chat room ID and set expiry
ridePoolSchema.pre('save', function (next) {
  if (!this.chatRoomId) {
    this.chatRoomId = `pool_${this._id}`;
  }
  if (this.arrivalTime && !this.expiresAt) {
    // Pool expires 6 hours after arrival
    this.expiresAt = new Date(this.arrivalTime.getTime() + 6 * 60 * 60 * 1000);
  }
  // Update cost per person
  const activeMembers = this.members.filter((m) => m.status === 'active').length;
  if (activeMembers > 0 && this.estimatedCostTotal > 0) {
    this.estimatedCostPerPerson = Math.ceil(this.estimatedCostTotal / activeMembers);
  }
  next();
});

// Check if pool is full
ridePoolSchema.methods.isFull = function () {
  const activeMembers = this.members.filter((m) => m.status === 'active').length;
  return activeMembers >= this.maxMembers;
};

// Add member to pool
ridePoolSchema.methods.addMember = function (userId) {
  if (this.isFull()) {
    throw new Error('Pool is already full');
  }
  const alreadyMember = this.members.find(
    (m) => m.user.toString() === userId.toString() && m.status === 'active'
  );
  if (alreadyMember) {
    throw new Error('User is already a member of this pool');
  }
  this.members.push({ user: userId });
  if (this.isFull()) {
    this.status = 'full';
  }
};

// Remove member from pool
ridePoolSchema.methods.removeMember = function (userId) {
  const member = this.members.find(
    (m) => m.user.toString() === userId.toString() && m.status === 'active'
  );
  if (member) {
    member.status = 'left';
    if (this.status === 'full') {
      this.status = 'open';
    }
  }
};

const RidePool = mongoose.model('RidePool', ridePoolSchema);

module.exports = RidePool;
