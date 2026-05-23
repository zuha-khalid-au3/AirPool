const User = require('../models/User');
const RidePool = require('../models/RidePool');
const SuspiciousActivity = require('../models/SuspiciousActivity');

const ACTIVE_POOL_STATUSES = ['open', 'full', 'in_progress'];

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, activePools, completedRides, pendingKYC, openFraudAlerts] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      RidePool.countDocuments({ status: { $in: ACTIVE_POOL_STATUSES }, isActive: true }),
      RidePool.countDocuments({ status: 'completed' }),
      User.countDocuments({ kycStatus: { $in: ['pending', 'submitted'] } }),
      SuspiciousActivity.countDocuments({ status: 'open' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activePools,
        completedRides,
        pendingKYC,
        openFraudAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

const listPools = async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};

    if (status === 'active') {
      filter.status = { $in: ACTIVE_POOL_STATUSES };
      filter.isActive = true;
    } else if (status) {
      filter.status = status;
    }

    const pools = await RidePool.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('creator', 'name phone email trustScore isGuest')
      .populate('members.user', 'name trustScore');

    res.status(200).json({
      success: true,
      data: { pools },
    });
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const { search, kycStatus, limit = 50 } = req.query;
    const filter = { role: 'user' };

    if (kycStatus && kycStatus !== 'all') {
      filter.kycStatus = kycStatus === 'pending_kyc' ? { $in: ['pending', 'submitted'] } : kycStatus;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('name phone email kycStatus trustScore isVerified isBanned isGuest createdAt');

    res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  listPools,
  listUsers,
};
