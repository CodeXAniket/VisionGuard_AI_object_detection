const Detection = require('../models/Detection');
const detectionService = require('../services/detectionService');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');
const {
  assertObjectId,
  validateDetectionInput,
  validateDetectionQuery,
  validateStatusUpdate,
} = require('../utils/validators');

// 404 if the event doesn't exist, 403 if it belongs to another user.
async function findOwnedDetection(id, userId) {
  assertObjectId(id, 'detection id');
  const detection = await Detection.findById(id);
  if (!detection) throw ApiError.notFound('Detection not found');
  if (!detection.userId.equals(userId)) throw ApiError.forbidden('You do not have access to this detection');
  return detection;
}

// POST /api/detections - create an event from an uploaded snapshot.
// Used by the standalone Python monitor (vision/local_monitor.py --post).
async function createDetection(req, res) {
  const input = validateDetectionInput(req.body);
  const [detection] = await detectionService.createDetectionEvents({
    userId: req.user.id,
    imageBuffer: req.file.buffer,
    mimeType: req.file.mimetype,
    events: [{ class: input.objectClass, confidence: input.confidence, bbox: input.bbox }],
    frameWidth: input.frameWidth,
    frameHeight: input.frameHeight,
    source: 'local-camera',
  });
  sendSuccess(res, detection, 201);
}

// GET /api/detections?objectClass=&from=&to=&minConfidence=&status=&page=&limit=
async function listDetections(req, res) {
  const { filter, page, limit } = validateDetectionQuery(req.query);
  const query = { ...filter, userId: req.user.id };

  const [documents, total] = await Promise.all([
    Detection.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Detection.countDocuments(query),
  ]);

  sendSuccess(res, {
    items: await Promise.all(documents.map(detectionService.toDetectionResponse)),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

async function getDetection(req, res) {
  const detection = await findOwnedDetection(req.params.id, req.user.id);
  sendSuccess(res, await detectionService.toDetectionResponse(detection));
}

// PATCH /api/detections/:id - { status: 'new' | 'reviewed' | 'dismissed' }
async function updateDetectionStatus(req, res) {
  const { status } = validateStatusUpdate(req.body);
  const detection = await findOwnedDetection(req.params.id, req.user.id);
  detection.status = status;
  await detection.save();
  sendSuccess(res, await detectionService.toDetectionResponse(detection));
}

async function deleteDetection(req, res) {
  const detection = await findOwnedDetection(req.params.id, req.user.id);
  await detectionService.deleteDetection(detection);
  sendSuccess(res, { id: detection.id });
}

module.exports = { createDetection, listDetections, getDetection, updateDetectionStatus, deleteDetection };
