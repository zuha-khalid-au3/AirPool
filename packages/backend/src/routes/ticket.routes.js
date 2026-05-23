const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');
const { authenticate } = require('../middleware/auth.middleware');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.'));
    }
  },
});

router.use(authenticate);

// Upload and process flight ticket
router.post('/upload', upload.single('ticket'), ticketController.uploadTicket);

// Get user's tickets
router.get('/my-tickets', ticketController.getMyTickets);

// Get ticket details
router.get('/:ticketId', ticketController.getTicketDetails);

// Manually update ticket details (after OCR confirmation)
router.patch('/:ticketId', ticketController.updateTicket);

// Delete a ticket
router.delete('/:ticketId', ticketController.deleteTicket);

module.exports = router;
