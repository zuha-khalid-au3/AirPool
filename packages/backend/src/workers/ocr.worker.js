const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const FlightTicket = require('../models/FlightTicket');
const { getMinIOClient } = require('../config/minio');
const { consumeFromQueue, QUEUES } = require('../config/rabbitmq');
const logger = require('../utils/logger');

const BUCKET = process.env.MINIO_BUCKET_NAME || 'airpool-uploads';

// Indian airline codes and patterns
const AIRLINE_PATTERNS = {
  '6E': 'IndiGo',
  'AI': 'Air India',
  'SG': 'SpiceJet',
  'UK': 'Vistara',
  'G8': 'Go First',
  'I5': 'AirAsia India',
  'QP': 'Akasa Air',
  'IX': 'Air India Express',
};

// Airport code pattern
const AIRPORT_CODE_REGEX = /\b([A-Z]{3})\b/g;
const FLIGHT_NUMBER_REGEX = /\b(6E|AI|SG|UK|G8|I5|QP|IX|AA|UA|DL|BA|EK|QR|SQ)\s*(\d{3,4})\b/gi;
const PNR_REGEX = /\b(PNR|BOOKING\s*REF|CONFIRMATION)[:\s]*([A-Z0-9]{6})\b/gi;
const DATE_REGEX = /(\d{1,2}[\s\-\/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-\/]\d{2,4})/gi;
const TIME_REGEX = /(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/gi;

const extractFlightDetails = (text) => {
  const details = {
    flightNumber: null,
    pnr: null,
    airline: null,
    airports: [],
    dates: [],
    times: [],
  };

  // Extract flight number
  const flightMatch = text.match(FLIGHT_NUMBER_REGEX);
  if (flightMatch && flightMatch.length > 0) {
    details.flightNumber = flightMatch[0].replace(/\s/g, '').toUpperCase();
    const airlineCode = details.flightNumber.match(/^[A-Z]{2}/);
    if (airlineCode) {
      details.airline = AIRLINE_PATTERNS[airlineCode[0]] || airlineCode[0];
    }
  }

  // Extract PNR
  const pnrMatch = PNR_REGEX.exec(text);
  if (pnrMatch) {
    details.pnr = pnrMatch[2];
  }

  // Extract airport codes
  const airportMatches = text.match(AIRPORT_CODE_REGEX);
  if (airportMatches) {
    // Filter out common non-airport 3-letter words
    const nonAirport = ['THE', 'AND', 'FOR', 'NOT', 'ARE', 'BUT', 'ALL', 'CAN', 'HER', 'WAS'];
    details.airports = [...new Set(airportMatches.filter((code) => !nonAirport.includes(code)))];
  }

  // Extract dates
  const dateMatches = text.match(DATE_REGEX);
  if (dateMatches) {
    details.dates = dateMatches;
  }

  // Extract times
  const timeMatches = text.match(TIME_REGEX);
  if (timeMatches) {
    details.times = timeMatches;
  }

  return details;
};

const processTicketOCR = async (jobData) => {
  const { ticketId, objectName, mimeType, userId } = jobData;

  try {
    logger.info(`Processing OCR for ticket: ${ticketId}`);

    const minioClient = getMinIOClient();
    let text = '';

    // Get file from MinIO
    const stream = await minioClient.getObject(BUCKET, objectName);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extract text based on file type
    if (mimeType === 'application/pdf') {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else {
      // Image OCR using Tesseract
      const result = await Tesseract.recognize(buffer, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      text = result.data.text;
    }

    // Extract flight details from OCR text
    const details = extractFlightDetails(text);

    // Update ticket in database
    const updateData = {
      ocrRawText: text,
      ocrConfidence: 75, // Base confidence
    };

    if (details.flightNumber) {
      updateData.flightNumber = details.flightNumber;
      updateData.airline = details.airline;
      updateData.ocrConfidence = 85;
    }

    if (details.pnr) {
      updateData.pnr = details.pnr;
    }

    if (details.airports.length >= 2) {
      updateData['departureAirport.code'] = details.airports[0];
      updateData['arrivalAirport.code'] = details.airports[1];
      updateData.ocrConfidence = 90;
    }

    updateData.verificationStatus = details.flightNumber ? 'verified' : 'pending';

    await FlightTicket.findByIdAndUpdate(ticketId, updateData);

    logger.info(`OCR completed for ticket ${ticketId}. Flight: ${details.flightNumber || 'Not detected'}`);
  } catch (error) {
    logger.error(`OCR processing failed for ticket ${ticketId}:`, error);
    await FlightTicket.findByIdAndUpdate(ticketId, {
      verificationStatus: 'failed',
      ocrRawText: `Error: ${error.message}`,
    });
  }
};

// Start consuming OCR jobs
const startOCRWorker = async () => {
  await consumeFromQueue(QUEUES.OCR_PROCESSING, processTicketOCR);
  logger.info('OCR Worker started, listening for jobs...');
};

module.exports = { startOCRWorker, processTicketOCR, extractFlightDetails };
