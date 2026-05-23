const Minio = require('minio');
const logger = require('../utils/logger');

let minioClient = null;

const initMinIO = async () => {
  minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });

  const bucketName = process.env.MINIO_BUCKET_NAME || 'airpool-uploads';

  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      logger.info(`MinIO bucket '${bucketName}' created successfully`);

      // Set bucket policy for read access
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/public/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }
  } catch (error) {
    logger.warn('MinIO initialization warning:', error.message);
    // Non-fatal: app can still run without MinIO for development
  }

  return minioClient;
};

const getMinIOClient = () => {
  if (!minioClient) {
    throw new Error('MinIO client not initialized. Call initMinIO() first.');
  }
  return minioClient;
};

const uploadFile = async (bucketName, objectName, filePath, metadata = {}) => {
  const client = getMinIOClient();
  return client.fPutObject(bucketName, objectName, filePath, metadata);
};

const uploadBuffer = async (bucketName, objectName, buffer, metadata = {}) => {
  const client = getMinIOClient();
  return client.putObject(bucketName, objectName, buffer, buffer.length, metadata);
};

const getFileUrl = async (bucketName, objectName, expiry = 3600) => {
  const client = getMinIOClient();
  return client.presignedGetObject(bucketName, objectName, expiry);
};

const deleteFile = async (bucketName, objectName) => {
  const client = getMinIOClient();
  return client.removeObject(bucketName, objectName);
};

module.exports = {
  initMinIO,
  getMinIOClient,
  uploadFile,
  uploadBuffer,
  getFileUrl,
  deleteFile,
};
