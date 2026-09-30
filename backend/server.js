const mongoose = require('mongoose');
const logger = require('./utils/logger');

// Warn early about optional dependencies instead of failing on the first frame.
async function reportDependencies(env) {
  const s3Service = require('./services/s3Service');
  const visionService = require('./services/visionService');

  if (s3Service.isConfigured()) logger.info(`AWS S3 bucket: ${env.aws.bucket} (${env.aws.region})`);
  else logger.warn('AWS S3 is not configured - detection events will be saved without images');

  const vision = await visionService.checkHealth();
  if (!vision.available) logger.warn(`Vision service not reachable at ${env.visionServiceUrl} - start it with: python server.py`);
  else if (!vision.modelLoaded) logger.warn(`Vision service is running but the YOLO model is not loaded: ${vision.message}`);
  else logger.info(`Vision service ready (model: ${vision.model})`);
}

async function start() {
  let env;
  try {
    env = require('./config/env');
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }

  const { connectDatabase } = require('./config/db');
  const createApp = require('./app');

  try {
    await connectDatabase(env.mongoUri);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    logger.error('Is MongoDB running? Check MONGODB_URI in backend/.env');
    process.exit(1);
  }

  const server = createApp().listen(env.port, () => {
    logger.info(`VisionGuard API listening on http://localhost:${env.port}`);
    reportDependencies(env);
  });

  // Graceful shutdown: stop accepting requests, then close the DB connection.
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
