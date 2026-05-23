const FlightTicket = require('../models/FlightTicket');
const { uploadBuffer, getFileUrl, deleteFile } = require('../config/minio');
const { publishToQueue, QUEUES } = require('../config/rabbitmq');
const { AppError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const BUCKET = process.env.MINIO_BUCKET_NAME || 'airpool-uploads';

// Upload and process flight ticket
const uploadTicket = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    // Upload to MinIO
    const ext = req.file.originalname.split('.').pop();
    const objectName = `tickets/${req.user._id}/${uuidv4()}.${ext}`;
    await uploadBuffer(BUCKET, objectName, req.file.buffer, {
      'Content-Type': req.file.mimetype,
    });

    // Create ticket record with pending status
    const ticket = await FlightTicket.create({
      user: req.user._id,
      documentUrl: objectName,
      flightNumber: req.body.flightNumber || 'PENDING_OCR',
      arrivalAirport: {
        code: req.body.arrivalAirportCode || 'XXX',
      },
      departureTime: req.body.departureTime || new Date(),
      arrivalTime: req.body.arrivalTime || new Date(),
      verificationStatus: 'pending',
    });

    // Queue OCR processing
    await publishToQueue(QUEUES.OCR_PROCESSING, {
      ticketId: ticket._id.toString(),
      objectName,
      mimeType: req.file.mimetype,
      userId: req.user._id.toString(),
    });

    res.status(201).json({
      success: true,
      message: 'Ticket uploaded. Processing in background...',
      data: {
        ticket: {
          id: ticket._id,
          verificationStatus: 'pending',
          documentUrl: objectName,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user's tickets
const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await FlightTicket.find({
      user: req.user._id,
      isActive: true,
    }).sort({ arrivalTime: -1 });

    res.status(200).json({
      success: true,
      data: { tickets },
    });
  } catch (error) {
    next(error);
  }
};

// Get ticket details
const getTicketDetails = async (req, res, next) => {
  try {
    const ticket = await FlightTicket.findOne({
      _id: req.params.ticketId,
      user: req.user._id,
    });

    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    // Generate presigned URL for document access
    let documentUrl = null;
    try {
      documentUrl = await getFileUrl(BUCKET, ticket.documentUrl, 3600);
    } catch (err) {
      logger.warn('Could not generate document URL:', err.message);
    }

    res.status(200).json({
      success: true,
      data: {
        ticket: {
          ...ticket.toObject(),
          documentAccessUrl: documentUrl,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update ticket (after OCR confirmation by user)
const updateTicket = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'flightNumber',
      'airline',
      'departureAirport',
      'arrivalAirport',
      'departureTime',
      'arrivalTime',
      'passengerName',
      'seatNumber',
      'pnr',
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const ticket = await FlightTicket.findOneAndUpdate(
      { _id: req.params.ticketId, user: req.user._id },
      { ...updates, verificationStatus: 'verified' },
      { new: true, runValidators: true }
    );

    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      message: 'Ticket updated and verified',
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

// Delete ticket
const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await FlightTicket.findOne({
      _id: req.params.ticketId,
      user: req.user._id,
    });

    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    // Delete from MinIO
    try {
      await deleteFile(BUCKET, ticket.documentUrl);
    } catch (err) {
      logger.warn('Could not delete file from storage:', err.message);
    }

    await FlightTicket.findByIdAndDelete(ticket._id);

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadTicket,
  getMyTickets,
  getTicketDetails,
  updateTicket,
  deleteTicket,
};
