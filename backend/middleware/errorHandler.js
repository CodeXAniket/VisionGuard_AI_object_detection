const multer = require('multer');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { MAX_IMAGE_BYTES } = require('./upload');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Maps known library errors to an HTTP status + safe message.
function classifyError(error) {
  if (error instanceof ApiError) return { status: error.statusCode, message: error.message };

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? `Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)` : error.message;
    return { status: 400, message };
  }
  if (error.type === 'entity.parse.failed') return { status: 400, message: 'Request body is not valid JSON' };
  if (error.name === 'ValidationError') {
    return { status: 400, message: Object.values(error.errors).map((e) => e.message).join('. ') };
  }
  if (error.name === 'CastError') return { status: 400, message: `Invalid value for ${error.path}` };
  if (error.code === 11000) return { status: 409, message: 'A record with this value already exists' };
  if (/^Mongo(ose)?(ServerSelection|Network)Error$/.test(error.name) || /buffering timed out/.test(error.message)) {
    return { status: 503, message: 'Database is unavailable. Please try again shortly.' };
  }

  // Unknown error: never leak internals (stack traces, queries) to the client.
  return { status: 500, message: 'Internal server error' };
}

// Express recognises error handlers by their 4 arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  const { status, message } = classifyError(error);

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}: ${error.message}`, error instanceof ApiError ? undefined : error.stack);
  }

  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
