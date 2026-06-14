const RidePool = require('../models/RidePool');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { publishToQueue, QUEUES } = require('../config/rabbitmq');
const logger = require('../utils/logger');

// Create a new ride pool
const createPool = async (req, res, next) => {
  try {
    const {
      flightNumber,
      arrivalAirport,
      arrivalTime,
      destination,
      vehicleType,
      maxMembers,
      genderPreference,
      meetingPoint,
      estimatedCostTotal,
    } = req.body;

    // Check if user already has an active pool for this flight
    const existingPool = await RidePool.findOne({
      creator: req.user._id,
      flightNumber,
      status: { $in: ['open', 'full'] },
    });

    if (existingPool) {
      throw new AppError(
        'You already have an active pool for this flight.',
        409,
        'POOL_EXISTS'
      );
    }

    // Gender preference validation
    if (genderPreference === 'female_only' && req.user.gender !== 'female') {
      throw new AppError(
        'Only female users can create female-only pools.',
        403,
        'GENDER_RESTRICTION'
      );
    }

    const pool = await RidePool.create({
      creator: req.user._id,
      flightNumber,
      arrivalAirport,
      arrivalTime: new Date(arrivalTime),
      destination,
      vehicleType,
      maxMembers,
      genderPreference,
      meetingPoint: meetingPoint || { description: 'Airport Exit Gate' },
      estimatedCostTotal: estimatedCostTotal || 0,
      members: [{ user: req.user._id, status: 'active' }],
    });

    // Populate creator info
    await pool.populate('members.user', 'name avatar trustScore isVerified');

    res.status(201).json({
      success: true,
      message: 'Ride pool created successfully',
      data: { pool },
    });
  } catch (error) {
    next(error);
  }
};

// Search available pools
const searchPools = async (req, res, next) => {
  try {
    const {
      flightNumber,
      airportCode,
      destination,
      vehicleType,
      genderPreference,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {
      status: 'open',
      isActive: true,
    };

    if (flightNumber) query.flightNumber = flightNumber.toUpperCase();
    if (airportCode) query['arrivalAirport.code'] = airportCode.toUpperCase();
    if (destination) query['destination.name'] = new RegExp(destination, 'i');
    if (vehicleType) query.vehicleType = vehicleType;
    if (genderPreference) query.genderPreference = genderPreference;

    // Don't show pools the user is already in
    query['members.user'] = { $ne: req.user._id };

    // Gender filter: if user is male, don't show female_only pools
    if (req.user.gender === 'male') {
      query.genderPreference = { $ne: 'female_only' };
    }
    if (req.user.gender === 'female') {
      query.genderPreference = { $ne: 'male_only' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pools = await RidePool.find(query)
      .populate('members.user', 'name avatar trustScore isVerified gender')
      .populate('creator', 'name avatar trustScore isVerified')
      .sort({ arrivalTime: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RidePool.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        pools,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get pool details
const getPoolDetails = async (req, res, next) => {
  try {
    const pool = await RidePool.findById(req.params.poolId)
      .populate('members.user', 'name avatar trustScore isVerified phone gender')
      .populate('creator', 'name avatar trustScore isVerified');

    if (!pool) {
      throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: { pool },
    });
  } catch (error) {
    next(error);
  }
};

// Join a pool
const joinPool = async (req, res, next) => {
  try {
    const pool = await RidePool.findById(req.params.poolId);

    if (!pool) {
      throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
    }

    if (pool.status !== 'open') {
      throw new AppError('This pool is no longer accepting members', 400, 'POOL_NOT_OPEN');
    }

    // Gender restriction check
    if (pool.genderPreference === 'female_only' && req.user.gender !== 'female') {
      throw new AppError('This pool is restricted to female members only', 403, 'GENDER_RESTRICTION');
    }
    if (pool.genderPreference === 'male_only' && req.user.gender !== 'male') {
      throw new AppError('This pool is restricted to male members only', 403, 'GENDER_RESTRICTION');
    }

    pool.addMember(req.user._id);
    await pool.save();

    await pool.populate('members.user', 'name avatar trustScore isVerified');

    // Notify other pool members
    await publishToQueue(QUEUES.NOTIFICATIONS, {
      type: 'member_joined',
      poolId: pool._id,
      userId: req.user._id,
      userName: req.user.name,
      chatRoomId: pool.chatRoomId,
    });

    res.status(200).json({
      success: true,
      message: 'Successfully joined the pool',
      data: { pool },
    });
  } catch (error) {
    next(error);
  }
};

// Leave a pool
const leavePool = async (req, res, next) => {
  try {
    const pool = await RidePool.findById(req.params.poolId);

    if (!pool) {
      throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
    }

    // If creator leaves, cancel the pool
    if (pool.creator.toString() === req.user._id.toString()) {
      pool.status = 'cancelled';
      pool.cancelReason = 'Creator left the pool';
      pool.cancelledAt = new Date();
    } else {
      pool.removeMember(req.user._id);
    }

    await pool.save();

    // Notify other members
    await publishToQueue(QUEUES.NOTIFICATIONS, {
      type: 'member_left',
      poolId: pool._id,
      userId: req.user._id,
      userName: req.user.name,
    });

    res.status(200).json({
      success: true,
      message: 'Successfully left the pool',
    });
  } catch (error) {
    next(error);
  }
};

// Remove a member from the pool (creator only)
const removeMember = async (req, res, next) => {
  try {
    const { poolId, userId: targetUserId } = req.params;
    const pool = await RidePool.findById(poolId);

    if (!pool) {
      throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
    }

    if (pool.creator.toString() !== req.user._id.toString()) {
      throw new AppError('Only the pool creator can remove members', 403, 'NOT_CREATOR');
    }

    if (targetUserId === req.user._id.toString()) {
      throw new AppError('Use leave pool instead of removing yourself', 400, 'CANNOT_REMOVE_SELF');
    }

    if (targetUserId === pool.creator.toString()) {
      throw new AppError('Cannot remove the pool creator', 400, 'CANNOT_REMOVE_CREATOR');
    }

    const removableStatuses = ['open', 'full', 'in_progress'];
    if (!removableStatuses.includes(pool.status)) {
      throw new AppError('Members cannot be removed from this pool in its current state', 400, 'POOL_NOT_REMOVABLE');
    }

    const targetMember = pool.members.find(
      (m) => m.user.toString() === targetUserId && m.status === 'active'
    );

    if (!targetMember) {
      throw new AppError('Member not found in this pool', 404, 'MEMBER_NOT_FOUND');
    }

    const removedUser = await User.findById(targetUserId).select('name');
    pool.removeMember(targetUserId);
    await pool.save();

    await pool.populate('members.user', 'name avatar trustScore isVerified');
    await pool.populate('creator', 'name avatar trustScore isVerified');

    await publishToQueue(QUEUES.NOTIFICATIONS, {
      type: 'member_removed',
      poolId: pool._id,
      userId: targetUserId,
      userName: removedUser?.name,
      removedBy: req.user._id,
      removedByName: req.user.name,
      chatRoomId: pool.chatRoomId,
    });

    res.status(200).json({
      success: true,
      message: 'Member removed from the pool',
      data: { pool },
    });
  } catch (error) {
    next(error);
  }
};

// Update pool status
const updatePoolStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const pool = await RidePool.findById(req.params.poolId);

    if (!pool) {
      throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
    }

    if (pool.creator.toString() !== req.user._id.toString()) {
      throw new AppError('Only the pool creator can update status', 403, 'NOT_CREATOR');
    }

    const validTransitions = {
      open: ['in_progress', 'cancelled'],
      full: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };

    if (!validTransitions[pool.status] || !validTransitions[pool.status].includes(status)) {
      throw new AppError(`Cannot transition from ${pool.status} to ${status}`, 400, 'INVALID_TRANSITION');
    }

    pool.status = status;
    if (status === 'completed') {
      pool.completedAt = new Date();
      // Update ride counts for all active members
      const activeMembers = pool.members.filter((m) => m.status === 'active');
      for (const member of activeMembers) {
        member.status = 'completed';
        await User.findByIdAndUpdate(member.user, {
          $inc: { totalRides: 1, completedRides: 1 },
        });
      }
    }
    if (status === 'cancelled') {
      pool.cancelledAt = new Date();
    }

    await pool.save();

    res.status(200).json({
      success: true,
      message: `Pool status updated to ${status}`,
      data: { pool },
    });
  } catch (error) {
    next(error);
  }
};

// Rate pool members
const rateMembers = async (req, res, next) => {
  try {
    const { ratings } = req.body; // Array of { userId, rating, comment }
    const pool = await RidePool.findById(req.params.poolId);

    if (!pool) {
      throw new AppError('Pool not found', 404, 'POOL_NOT_FOUND');
    }

    if (pool.status !== 'completed') {
      throw new AppError('Can only rate members of completed pools', 400, 'POOL_NOT_COMPLETED');
    }

    for (const { userId, rating, comment } of ratings) {
      const member = pool.members.find((m) => m.user.toString() === userId);
      if (member) {
        member.rating = rating;
        member.ratingComment = comment;
      }
    }

    await pool.save();

    res.status(200).json({
      success: true,
      message: 'Ratings submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get user's pools
const getMyPools = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {
      'members.user': req.user._id,
      'members.status': { $ne: 'left' },
    };

    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const pools = await RidePool.find(query)
      .populate('members.user', 'name avatar trustScore isVerified')
      .populate('creator', 'name avatar trustScore')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RidePool.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        pools,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPool,
  searchPools,
  getPoolDetails,
  joinPool,
  leavePool,
  removeMember,
  updatePoolStatus,
  rateMembers,
  getMyPools,
};
