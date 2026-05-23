const User = require('../models/User');
const { uploadBuffer, getFileUrl } = require('../config/minio');
const { AppError } = require('../middleware/errorHandler');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const BUCKET = process.env.MINIO_BUCKET_NAME || 'airpool-uploads';

// Update profile
const updateProfile = async (req, res, next) => {
  try {
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Upload avatar
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    // Resize and compress image
    const processedImage = await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const objectName = `avatars/${req.user._id}/${uuidv4()}.jpg`;
    await uploadBuffer(BUCKET, objectName, processedImage, {
      'Content-Type': 'image/jpeg',
    });

    const avatarUrl = await getFileUrl(BUCKET, objectName, 7 * 24 * 3600);

    req.user.avatar = objectName;
    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatarUrl, objectName },
    });
  } catch (error) {
    next(error);
  }
};

// Upload Government ID
const uploadGovtId = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const { idType } = req.body; // aadhaar, pan, passport, voter_id

    const objectName = `kyc/${req.user._id}/govt_id_${uuidv4()}.${req.file.originalname.split('.').pop()}`;
    await uploadBuffer(BUCKET, objectName, req.file.buffer, {
      'Content-Type': req.file.mimetype,
    });

    req.user.kycDocuments.govtId = {
      url: objectName,
      type: idType || 'aadhaar',
      verified: false,
      uploadedAt: new Date(),
    };
    req.user.kycStatus = 'submitted';
    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Government ID uploaded successfully. Verification pending.',
      data: { kycStatus: 'submitted' },
    });
  } catch (error) {
    next(error);
  }
};

// Upload Selfie
const uploadSelfie = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const processedImage = await sharp(req.file.buffer)
      .resize(500, 500, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const objectName = `kyc/${req.user._id}/selfie_${uuidv4()}.jpg`;
    await uploadBuffer(BUCKET, objectName, processedImage, {
      'Content-Type': 'image/jpeg',
    });

    req.user.kycDocuments.selfie = {
      url: objectName,
      verified: false,
      uploadedAt: new Date(),
    };

    // If both docs are uploaded, mark as submitted
    if (req.user.kycDocuments.govtId && req.user.kycDocuments.govtId.url) {
      req.user.kycStatus = 'submitted';
    }

    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Selfie uploaded successfully. Verification pending.',
      data: { kycStatus: req.user.kycStatus },
    });
  } catch (error) {
    next(error);
  }
};

// Get KYC status
const getKYCStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('kycStatus kycDocuments isVerified');

    res.status(200).json({
      success: true,
      data: {
        kycStatus: user.kycStatus,
        isVerified: user.isVerified,
        documents: {
          govtId: {
            uploaded: !!user.kycDocuments?.govtId?.url,
            verified: user.kycDocuments?.govtId?.verified || false,
            type: user.kycDocuments?.govtId?.type,
          },
          selfie: {
            uploaded: !!user.kycDocuments?.selfie?.url,
            verified: user.kycDocuments?.selfie?.verified || false,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get trust score
const getTrustScore = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'trustScore totalRides completedRides noShows'
    );

    const completionRate = user.totalRides > 0
      ? Math.round((user.completedRides / user.totalRides) * 100)
      : 100;

    res.status(200).json({
      success: true,
      data: {
        trustScore: user.trustScore,
        totalRides: user.totalRides,
        completedRides: user.completedRides,
        noShows: user.noShows,
        completionRate,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update device info
const updateDeviceInfo = async (req, res, next) => {
  try {
    const { deviceId, platform, pushToken, appVersion } = req.body;

    req.user.deviceInfo = {
      deviceId,
      platform,
      pushToken,
      appVersion,
    };
    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Device info updated',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  uploadAvatar,
  uploadGovtId,
  uploadSelfie,
  getKYCStatus,
  getTrustScore,
  updateDeviceInfo,
};
