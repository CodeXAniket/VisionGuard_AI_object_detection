const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { isDatabaseConnected } = require('./config/db');
const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/response');
const authRoutes = require('./routes/authRoutes');
const detectionRoutes = require('./routes/detectionRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Builds the Express app without starting a server or connecting to MongoDB,
// so tests can import it directly (server.js does the startup work).
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  // Public liveness check
  app.get('/api/health', (_req, res) => {
    sendSuccess(res, { status: 'ok', database: isDatabaseConnected() ? 'connected' : 'disconnected' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/detections', detectionRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
