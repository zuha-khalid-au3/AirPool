const mongoose = require('mongoose');

const flightTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pnr: {
      type: String,
      trim: true,
      uppercase: true,
    },
    flightNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    airline: {
      type: String,
      trim: true,
    },
    departureAirport: {
      code: { type: String, uppercase: true },
      name: String,
      city: String,
    },
    arrivalAirport: {
      code: { type: String, required: true, uppercase: true },
      name: String,
      city: String,
    },
    departureTime: {
      type: Date,
      required: true,
    },
    arrivalTime: {
      type: Date,
      required: true,
    },
    passengerName: {
      type: String,
      trim: true,
    },
    seatNumber: String,
    ticketClass: {
      type: String,
      enum: ['economy', 'premium_economy', 'business', 'first'],
      default: 'economy',
    },
    documentUrl: {
      type: String,
      required: true,
    },
    ocrRawText: String,
    ocrConfidence: {
      type: Number,
      min: 0,
      max: 100,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'expired'],
      default: 'pending',
    },
    flightStatus: {
      type: String,
      enum: ['scheduled', 'delayed', 'boarding', 'in_air', 'landed', 'cancelled'],
      default: 'scheduled',
    },
    actualArrivalTime: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      index: { expires: 0 }, // TTL index - auto-delete after expiry
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
flightTicketSchema.index({ user: 1, arrivalTime: -1 });
flightTicketSchema.index({ flightNumber: 1, arrivalTime: 1 });
flightTicketSchema.index({ 'arrivalAirport.code': 1, arrivalTime: 1 });
flightTicketSchema.index({ verificationStatus: 1 });

// Set expiry to 24 hours after arrival
flightTicketSchema.pre('save', function (next) {
  if (this.arrivalTime && !this.expiresAt) {
    this.expiresAt = new Date(this.arrivalTime.getTime() + 24 * 60 * 60 * 1000);
  }
  next();
});

const FlightTicket = mongoose.model('FlightTicket', flightTicketSchema);

module.exports = FlightTicket;
