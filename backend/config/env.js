require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  }
  return value;
}

// All configuration is read from environment variables in one place.
// Nothing secret is ever hardcoded.
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/visionguard',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  // Comma-separated list, e.g. "http://localhost:5173,https://visionguard.vercel.app"
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),

  visionServiceUrl: process.env.VISION_SERVICE_URL || 'http://127.0.0.1:8000',
  visionApiKey: process.env.VISION_API_KEY || '',
  visionTimeoutMs: Number(process.env.VISION_TIMEOUT_MS) || 10000,

  // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are read by the AWS SDK itself
  // from the environment, so they never pass through our code.
  aws: {
    region: process.env.AWS_REGION || '',
    bucket: process.env.AWS_S3_BUCKET || '',
    urlExpiresSeconds: Number(process.env.S3_URL_EXPIRES_SECONDS) || 3600,
  },
};

module.exports = env;
