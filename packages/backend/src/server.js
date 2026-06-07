require('dotenv').config({ path: '../../.env' });

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const { connectDB } = require('./config/database');
const { connectRedis, getRedisClient } = require('./config/redis');
const { initMinIO } = require('./config/minio');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { setupSocketHandlers } = require('./socket');
const { setupAdminPanel } = require('./admin');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Import Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const poolRoutes = require('./routes/pool.routes');
const chatRoutes = require('./routes/chat.routes');
const ticketRoutes = require('./routes/ticket.routes');
const configRoutes = require('./routes/config.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'AirPool API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/pools', poolRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error Handler (must be last)
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to databases and services
    await connectDB();
    logger.info('MongoDB connected successfully');

    await connectRedis();
    logger.info('Redis connected successfully');

    await initMinIO();
    logger.info('MinIO initialized successfully');

    await connectRabbitMQ();
    logger.info('RabbitMQ connected successfully');

    // Setup AdminJS Panel (optional — React admin dashboard uses JWT API)
    try {
      await setupAdminPanel(app);
      logger.info('Admin panel initialized at /admin');
    } catch (error) {
      logger.warn({ err: error }, 'AdminJS panel failed to initialize; API will continue without /admin');
    }

    // Setup Socket.io handlers
    setupSocketHandlers(io, getRedisClient());
    logger.info('Socket.io handlers initialized');

    // Start listening (0.0.0.0 allows LAN devices and tunnel proxies)
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`AirPool API Server running on port ${PORT}`);
      logger.info(`Admin Panel available at http://localhost:${PORT}/admin`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };
