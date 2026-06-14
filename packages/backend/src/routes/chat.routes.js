const express = require('express');
const multer = require('multer');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/m4a',
      'audio/mp4',
      'audio/mpeg',
      'audio/aac',
      'audio/wav',
      'audio/x-m4a',
      'audio/x-caf',
      'audio/x-wav',
      'video/mp4',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for chat media'));
    }
  },
});

router.use(authenticate);

router.get('/:chatRoomId/file', chatController.serveMediaFile);
router.post('/:chatRoomId/media', upload.single('file'), chatController.uploadMedia);
router.get('/:chatRoomId/messages', chatController.getMessages);
router.post('/messages', validate(schemas.sendMessage), chatController.sendMessage);
router.post('/:chatRoomId/read', chatController.markAsRead);
router.post('/sync', chatController.syncOfflineMessages);

module.exports = router;
