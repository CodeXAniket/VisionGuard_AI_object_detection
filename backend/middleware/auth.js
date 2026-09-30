const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Protects a route: expects "Authorization: Bearer <jwt>".
 * On success, sets req.user = { id } for the controllers.
 *
 * The token is verified with the server's secret (signature + expiry), so no
 * database lookup is needed per request - important for the frame endpoint,
 * which is called several times per second.
 */
function requireAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authentication token is missing');
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub };
    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Invalid authentication token';
    throw ApiError.unauthorized(message);
  }
}

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

module.exports = { requireAuth, signToken };
