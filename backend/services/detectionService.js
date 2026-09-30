const { randomUUID } = require('node:crypto');
const Detection = require('../models/Detection');
const s3Service = require('./s3Service');
const logger = require('../utils/logger');

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// detections/<userId>/<yyyy-mm-dd>/<timestamp>-<uuid>.jpg
// Grouping by user and day makes the bucket easy to browse and to clean up.
function buildSnapshotKey(userId, mimeType, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return `detections/${userId}/${day}/${now.getTime()}-${randomUUID()}.${EXTENSIONS[mimeType] || 'jpg'}`;
}

/**
 * Uploads the snapshot to S3. Never throws: if S3 is down or not configured
 * the event is still worth recording, so we return imageStatus 'failed'
 * and the caller saves the metadata anyway.
 */
async function uploadSnapshot(userId, imageBuffer, mimeType) {
  if (!s3Service.isConfigured()) {
    logger.warn('S3 is not configured (AWS_S3_BUCKET / AWS_REGION) - saving event without image');
    return { s3Key: null, imageUrl: null, imageStatus: 'failed' };
  }

  const s3Key = buildSnapshotKey(userId, mimeType);
  try {
    await s3Service.uploadImage(s3Key, imageBuffer, mimeType);
    logger.info(`Image uploaded to S3: ${s3Key}`);
    return { s3Key, imageUrl: s3Service.getObjectUrl(s3Key), imageStatus: 'uploaded' };
  } catch (error) {
    logger.error(`S3 upload failed: ${error.name}: ${error.message}`);
    return { s3Key: null, imageUrl: null, imageStatus: 'failed' };
  }
}

/**
 * Creates detection events from one frame.
 *
 * events: [{ class, confidence, bbox: [x1, y1, x2, y2] }] - already
 * de-duplicated by the vision service's cooldown logic. If several objects
 * trigger on the same frame, the image is uploaded once and shared.
 */
async function createDetectionEvents({ userId, imageBuffer, mimeType, events, frameWidth, frameHeight, source }) {
  if (!events || events.length === 0) return [];

  const snapshot = await uploadSnapshot(userId, imageBuffer, mimeType);
  const timestamp = new Date();

  const documents = events.map((event) => ({
    userId,
    objectClass: event.class,
    confidence: event.confidence,
    boundingBox: { x1: event.bbox[0], y1: event.bbox[1], x2: event.bbox[2], y2: event.bbox[3] },
    frameWidth,
    frameHeight,
    timestamp,
    source,
    ...snapshot,
  }));

  let saved;
  try {
    saved = await Detection.insertMany(documents);
  } catch (error) {
    // Don't leave an orphaned image in S3 if MongoDB rejected the metadata.
    if (snapshot.s3Key) await s3Service.deleteImage(snapshot.s3Key).catch(() => {});
    throw error;
  }

  saved.forEach((detection) =>
    logger.info(`Detection event created: ${detection.objectClass} confidence=${detection.confidence.toFixed(2)} id=${detection.id}`)
  );
  return Promise.all(saved.map(toDetectionResponse));
}

/** Detection document -> API JSON, with a short-lived presigned image URL. */
async function toDetectionResponse(detection) {
  const json = detection.toJSON();
  json.imageUrl = null;
  if (detection.s3Key && detection.imageStatus === 'uploaded') {
    try {
      json.imageUrl = await s3Service.getSignedImageUrl(detection.s3Key);
    } catch (error) {
      logger.error(`Could not sign URL for ${detection.s3Key}: ${error.message}`);
    }
  }
  return json;
}

/** Deletes the event, and its S3 image unless another event shares it. */
async function deleteDetection(detection) {
  await detection.deleteOne();
  if (!detection.s3Key) return;

  const stillUsed = await Detection.exists({ userId: detection.userId, s3Key: detection.s3Key });
  if (stillUsed) return;

  try {
    await s3Service.deleteImage(detection.s3Key);
    logger.info(`Image deleted from S3: ${detection.s3Key}`);
  } catch (error) {
    // The metadata is gone either way; an orphaned object is only a storage cost.
    logger.error(`S3 delete failed for ${detection.s3Key}: ${error.message}`);
  }
}

module.exports = { buildSnapshotKey, createDetectionEvents, toDetectionResponse, deleteDetection };
