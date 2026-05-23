const amqplib = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const QUEUES = {
  OCR_PROCESSING: 'ocr_processing',
  NOTIFICATIONS: 'notifications',
  DATA_CLEANUP: 'data_cleanup',
  FLIGHT_STATUS: 'flight_status_check',
};

const connectRabbitMQ = async () => {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  try {
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();

    // Assert all queues
    for (const queue of Object.values(QUEUES)) {
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': `${queue}.dead`,
        },
      });
    }

    // Dead letter exchange for failed messages
    await channel.assertExchange('dlx', 'direct', { durable: true });

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });

    return channel;
  } catch (error) {
    logger.warn('RabbitMQ connection failed:', error.message);
    // Non-fatal: app can still run without RabbitMQ for development
    return null;
  }
};

const getChannel = () => channel;

const publishToQueue = async (queueName, message) => {
  if (!channel) {
    logger.warn('RabbitMQ channel not available. Message not sent.');
    return false;
  }

  try {
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      timestamp: Date.now(),
    });
    return true;
  } catch (error) {
    logger.error(`Failed to publish to queue ${queueName}:`, error);
    return false;
  }
};

const consumeFromQueue = async (queueName, handler) => {
  if (!channel) {
    logger.warn('RabbitMQ channel not available. Consumer not started.');
    return;
  }

  await channel.consume(queueName, async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Error processing message from ${queueName}:`, error);
        channel.nack(msg, false, false); // Send to dead letter queue
      }
    }
  });
};

const disconnectRabbitMQ = async () => {
  if (channel) await channel.close();
  if (connection) await connection.close();
};

module.exports = {
  connectRabbitMQ,
  getChannel,
  publishToQueue,
  consumeFromQueue,
  disconnectRabbitMQ,
  QUEUES,
};
