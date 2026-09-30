// Preloaded before every test file (node --require ./tests/setupEnv.js).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.VISION_SERVICE_URL = 'http://vision.test';
process.env.VISION_API_KEY = 'test-vision-key';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_S3_BUCKET = 'visionguard-test-bucket';
