const mongoose = require('mongoose');
const ApiError = require('./ApiError');
const { COCO_CLASSES } = require('./cocoClasses');

// Plain validation functions: each takes untrusted input, throws a 400
// ApiError listing every problem, or returns a clean, typed object.
// Checking `typeof x === 'string'` also blocks NoSQL injection payloads
// such as { "email": { "$gt": "" } }.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DETECTION_STATUSES = ['new', 'reviewed', 'dismissed'];
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores bytes after 72

function assertValid(errors) {
  if (errors.length > 0) throw ApiError.badRequest(errors.join('. '));
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  return Number(value);
}

function parseOptionalDate(value, field, errors) {
  if (value === undefined || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${field} must be a valid date`);
    return undefined;
  }
  return date;
}

function validateRegistration(body = {}) {
  const { name, email, password } = body;
  const errors = [];
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 60) {
    errors.push('Name is required (max 60 characters)');
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    errors.push('A valid email is required');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  assertValid(errors);
  return { name: name.trim(), email: email.trim().toLowerCase(), password };
}

function validateLogin(body = {}) {
  const { email, password } = body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw ApiError.badRequest('Email and password are required');
  }
  return { email: email.trim().toLowerCase(), password };
}

function validateMonitoringConfig(body = {}) {
  const { targetClasses, confidenceThreshold, cooldownSeconds } = body;
  const errors = [];

  if (!Array.isArray(targetClasses)) {
    errors.push('targetClasses must be an array of object class names');
  } else {
    const unknown = targetClasses.filter((name) => !COCO_CLASSES.includes(name));
    if (unknown.length > 0) errors.push(`Unknown object classes: ${unknown.join(', ')}`);
  }
  if (typeof confidenceThreshold !== 'number' || confidenceThreshold < 0.05 || confidenceThreshold > 0.95) {
    errors.push('confidenceThreshold must be a number between 0.05 and 0.95');
  }
  if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 5 || cooldownSeconds > 3600) {
    errors.push('cooldownSeconds must be a whole number between 5 and 3600');
  }

  assertValid(errors);
  return { targetClasses: [...new Set(targetClasses)], confidenceThreshold, cooldownSeconds };
}

// Query string for GET /api/detections -> Mongo filter + pagination
function validateDetectionQuery(query = {}) {
  const errors = [];
  const filter = {};

  const page = query.page === undefined ? 1 : toNumber(query.page);
  const limit = query.limit === undefined ? 20 : toNumber(query.limit);
  if (!Number.isInteger(page) || page < 1) errors.push('page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.push('limit must be between 1 and 100');

  if (query.objectClass) {
    if (COCO_CLASSES.includes(query.objectClass)) filter.objectClass = query.objectClass;
    else errors.push(`Unknown objectClass: ${query.objectClass}`);
  }

  const from = parseOptionalDate(query.from, 'from', errors);
  const to = parseOptionalDate(query.to, 'to', errors);
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = from;
    if (to) filter.timestamp.$lt = to;
  }

  if (query.minConfidence !== undefined && query.minConfidence !== '') {
    const minConfidence = toNumber(query.minConfidence);
    if (Number.isNaN(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      errors.push('minConfidence must be between 0 and 1');
    } else {
      filter.confidence = { $gte: minConfidence };
    }
  }

  if (query.status) {
    if (DETECTION_STATUSES.includes(query.status)) filter.status = query.status;
    else errors.push(`status must be one of: ${DETECTION_STATUSES.join(', ')}`);
  }

  assertValid(errors);
  return { filter, page, limit };
}

// Multipart fields for POST /api/detections (all arrive as strings)
function validateDetectionInput(body = {}) {
  const errors = [];
  const { objectClass } = body;
  const confidence = toNumber(body.confidence);
  const frameWidth = toNumber(body.frameWidth);
  const frameHeight = toNumber(body.frameHeight);

  let bbox = null;
  try {
    bbox = JSON.parse(body.bbox);
  } catch {
    bbox = null;
  }

  if (!COCO_CLASSES.includes(objectClass)) errors.push('objectClass must be one of the supported COCO classes');
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) errors.push('confidence must be between 0 and 1');
  const bboxIsValid =
    Array.isArray(bbox) &&
    bbox.length === 4 &&
    bbox.every((n) => Number.isFinite(n) && n >= 0) &&
    bbox[2] > bbox[0] &&
    bbox[3] > bbox[1];
  if (!bboxIsValid) errors.push('bbox must be a JSON array [x1, y1, x2, y2] with x2 > x1 and y2 > y1');
  if (!Number.isInteger(frameWidth) || frameWidth <= 0) errors.push('frameWidth must be a positive integer');
  if (!Number.isInteger(frameHeight) || frameHeight <= 0) errors.push('frameHeight must be a positive integer');

  assertValid(errors);
  return { objectClass, confidence, bbox, frameWidth, frameHeight };
}

function validateStatusUpdate(body = {}) {
  if (!DETECTION_STATUSES.includes(body.status)) {
    throw ApiError.badRequest(`status must be one of: ${DETECTION_STATUSES.join(', ')}`);
  }
  return { status: body.status };
}

function assertObjectId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}`);
}

module.exports = {
  DETECTION_STATUSES,
  validateRegistration,
  validateLogin,
  validateMonitoringConfig,
  validateDetectionQuery,
  validateDetectionInput,
  validateStatusUpdate,
  assertObjectId,
};
