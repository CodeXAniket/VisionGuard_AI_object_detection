const MonitoringConfig = require('../models/MonitoringConfig');
const visionService = require('../services/visionService');
const detectionService = require('../services/detectionService');
const s3Service = require('../services/s3Service');
const logger = require('../utils/logger');
const { isDatabaseConnected } = require('../config/db');
const { sendSuccess } = require('../utils/response');
const { COCO_CLASSES } = require('../utils/cocoClasses');
const { validateMonitoringConfig } = require('../utils/validators');

async function getConfig(req, res) {
  const config = await MonitoringConfig.getForUser(req.user.id);
  sendSuccess(res, config);
}

async function updateConfig(req, res) {
  const updates = validateMonitoringConfig(req.body);
  const config = await MonitoringConfig.findOneAndUpdate(
    { userId: req.user.id },
    { $set: updates },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  logger.info(
    `Monitoring config updated: classes=[${updates.targetClasses.join(', ')}] threshold=${updates.confidenceThreshold} cooldown=${updates.cooldownSeconds}s`
  );
  sendSuccess(res, config);
}

function getClasses(_req, res) {
  sendSuccess(res, COCO_CLASSES);
}

async function getHealth(_req, res) {
  sendSuccess(res, {
    api: 'ok',
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
    visionService: await visionService.checkHealth(),
    storage: { s3Configured: s3Service.isConfigured() },
  });
}

/**
 * POST /api/monitoring/detect - the real-time pipeline, called for every frame:
 *
 *   browser frame -> Python YOLO (+ cooldown) -> [event?] -> S3 upload + MongoDB
 *
 * The frame is already in memory here, so when Python says "this is an event"
 * we upload exactly the frame that triggered it. Frames that are not events
 * are never stored.
 */
async function detectFrame(req, res) {
  const config = await MonitoringConfig.getForUser(req.user.id);

  const result = await visionService.detectObjects({
    imageBuffer: req.file.buffer,
    mimeType: req.file.mimetype,
    sessionId: req.user.id,
    config,
  });

  const events = await detectionService.createDetectionEvents({
    userId: req.user.id,
    imageBuffer: req.file.buffer,
    mimeType: req.file.mimetype,
    events: result.events,
    frameWidth: result.frameWidth,
    frameHeight: result.frameHeight,
    source: 'browser',
  });

  sendSuccess(res, {
    detections: result.detections,
    frameWidth: result.frameWidth,
    frameHeight: result.frameHeight,
    inferenceMs: result.inferenceMs,
    events,
  });
}

module.exports = { getConfig, updateConfig, getClasses, getHealth, detectFrame };
