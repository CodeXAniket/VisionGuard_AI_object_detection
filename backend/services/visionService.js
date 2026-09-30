const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// HTTP client for the Python vision service (vision/server.py).
// Uses Node's built-in fetch/FormData, so no extra HTTP library is needed.

const UNAVAILABLE_MESSAGE = 'Vision service is unavailable. Make sure the Python detection service is running.';

function authHeaders() {
  return env.visionApiKey ? { 'X-API-Key': env.visionApiKey } : {};
}

/**
 * Sends one frame to the vision service.
 * Resolves to { detections, events, frameWidth, frameHeight, inferenceMs }.
 */
async function detectObjects({ imageBuffer, mimeType, sessionId, config }) {
  const form = new FormData();
  form.append('frame', new Blob([imageBuffer], { type: mimeType }), 'frame.jpg');
  form.append('session_id', sessionId);
  form.append('target_classes', JSON.stringify(config.targetClasses));
  form.append('confidence_threshold', String(config.confidenceThreshold));
  form.append('cooldown_seconds', String(config.cooldownSeconds));

  let response;
  try {
    response = await fetch(`${env.visionServiceUrl}/detect`, {
      method: 'POST',
      body: form,
      headers: authHeaders(),
      signal: AbortSignal.timeout(env.visionTimeoutMs),
    });
  } catch (error) {
    logger.error(`Vision service request failed: ${error.message}`);
    throw new ApiError(503, UNAVAILABLE_MESSAGE);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error(`Vision service responded ${response.status}: ${body.message || response.statusText}`);
    // 503 = model not loaded; anything else is a bad gateway from our point of view.
    const status = response.status === 503 ? 503 : 502;
    throw new ApiError(status, body.message || 'Vision service could not process the frame');
  }
  return body;
}

// Never throws: used by the health endpoint to report status in the UI.
async function checkHealth() {
  try {
    const response = await fetch(`${env.visionServiceUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    return { available: true, modelLoaded: body.modelLoaded, model: body.model, message: body.message };
  } catch {
    return { available: false, modelLoaded: false, model: null, message: UNAVAILABLE_MESSAGE };
  }
}

module.exports = { detectObjects, checkHealth };
