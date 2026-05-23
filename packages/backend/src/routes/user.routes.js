const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

router.use(authenticate);

// Update profile
router.patch('/profile', validate(schemas.updateProfile), userController.updateProfile);

// Upload avatar
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

// Upload KYC documents
router.post('/kyc/govt-id', upload.single('document'), userController.uploadGovtId);
router.post('/kyc/selfie', upload.single('selfie'), userController.uploadSelfie);

// Get KYC status
router.get('/kyc/status', userController.getKYCStatus);

// Get trust score breakdown
router.get('/trust-score', userController.getTrustScore);

// Update device info (push token)
router.patch('/device', userController.updateDeviceInfo);

module.exports = router;
