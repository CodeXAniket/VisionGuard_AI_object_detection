const logger = require('../utils/logger');

// The frame endpoint is hit several times per second while monitoring;
// logging each call would drown out the useful lines.
const QUIET_PATHS = ['/api/monitoring/detect'];

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  // Routers rewrite req.path, so read the path from the original URL.
  const path = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    const quiet = QUIET_PATHS.includes(path) && res.statusCode < 400;
    if (quiet) return;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}

module.exports = requestLogger;
