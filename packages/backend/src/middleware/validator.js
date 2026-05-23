const Joi = require('joi');
const { AppError } = require('./errorHandler');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }

    req[property] = value;
    next();
  };
};

// Validation schemas
const schemas = {
  sendOTP: Joi.object({
    phone: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please enter a valid 10-digit Indian mobile number',
      }),
    countryCode: Joi.string().default('+91'),
  }),

  verifyOTP: Joi.object({
    phone: Joi.string().required(),
    otp: Joi.string().length(6).required(),
    countryCode: Joi.string().default('+91'),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
    preferredLanguage: Joi.string().min(2).max(5),
  }),

  createPool: Joi.object({
    flightNumber: Joi.string().required().uppercase(),
    arrivalAirport: Joi.object({
      code: Joi.string().length(3).required().uppercase(),
      name: Joi.string(),
      city: Joi.string(),
    }).required(),
    arrivalTime: Joi.date().iso().required(),
    destination: Joi.object({
      name: Joi.string().required(),
      address: Joi.string(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90),
        longitude: Joi.number().min(-180).max(180),
      }),
      distanceKm: Joi.number().min(0),
    }).required(),
    vehicleType: Joi.string().valid('auto_rickshaw', 'sedan', 'suv', 'any').default('any'),
    maxMembers: Joi.number().integer().min(2).max(8).default(4),
    genderPreference: Joi.string().valid('any', 'female_only', 'male_only').default('any'),
    meetingPoint: Joi.object({
      description: Joi.string(),
      landmark: Joi.string(),
      coordinates: Joi.object({
        latitude: Joi.number(),
        longitude: Joi.number(),
      }),
    }),
    estimatedCostTotal: Joi.number().min(0),
  }),

  joinPool: Joi.object({
    poolId: Joi.string().required(),
  }),

  sendMessage: Joi.object({
    chatRoomId: Joi.string().required(),
    content: Joi.string().max(2000).required(),
    messageType: Joi.string().valid('text', 'location', 'image', 'meeting_point').default('text'),
    metadata: Joi.object(),
  }),

  uploadTicket: Joi.object({
    flightNumber: Joi.string().uppercase(),
    departureTime: Joi.date().iso(),
    arrivalTime: Joi.date().iso(),
    arrivalAirportCode: Joi.string().length(3).uppercase(),
  }),
};

module.exports = { validate, schemas };
