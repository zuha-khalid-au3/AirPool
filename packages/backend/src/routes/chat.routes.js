const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validator');

router.use(authenticate);

// Get messages for a chat room
router.get('/:chatRoomId/messages', chatController.getMessages);

// Send a message (REST fallback for offline sync)
router.post('/messages', validate(schemas.sendMessage), chatController.sendMessage);

// Mark messages as read
router.post('/:chatRoomId/read', chatController.markAsRead);

// Sync offline messages
router.post('/sync', chatController.syncOfflineMessages);

module.exports = router;
