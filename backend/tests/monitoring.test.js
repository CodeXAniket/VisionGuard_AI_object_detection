const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../app');
const Detection = require('../models/Detection');
const ApiError = require('../utils/ApiError');
const s3Service = require('../services/s3Service');
const visionService = require('../services/visionService');
const { connectTestDatabase, clearTestDatabase, closeTestDatabase, registerUser } = require('./helpers');

const app = createApp();
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

let session;

function auth() {
  return { Authorization: `Bearer ${session.token}` };
}

function sendFrame() {
  return request(app).post('/api/monitoring/detect').set(auth()).attach('frame', JPEG, { filename: 'frame.jpg', contentType: 'image/jpeg' });
}

function visionResult(events = []) {
  return {
    detections: [
      { class: 'person', classId: 0, confidence: 0.91, bbox: [10, 20, 110, 220], target: true },
      { class: 'chair', classId: 56, confidence: 0.6, bbox: [300, 200, 400, 400], target: false },
    ],
    events,
    frameWidth: 640,
    frameHeight: 480,
    inferenceMs: 42,
  };
}

before(connectTestDatabase);
after(closeTestDatabase);

beforeEach(async () => {
  session = await registerUser(app);
  mock.method(s3Service, 'uploadImage', async () => {});
  mock.method(s3Service, 'getSignedImageUrl', async (key) => `https://signed.example/${key}`);
});

afterEach(async () => {
  mock.restoreAll();
  await clearTestDatabase();
});

describe('monitoring config', () => {
  it('returns defaults for a new user', async () => {
    const response = await request(app).get('/api/monitoring/config').set(auth());
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.targetClasses, ['person']);
    assert.equal(response.body.data.confidenceThreshold, 0.5);
    assert.equal(response.body.data.cooldownSeconds, 30);
  });

  it('saves a valid config', async () => {
    const config = { targetClasses: ['person', 'cell phone', 'person'], confidenceThreshold: 0.65, cooldownSeconds: 10 };
    const response = await request(app).put('/api/monitoring/config').set(auth()).send(config);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.targetClasses, ['person', 'cell phone']); // de-duplicated

    const reloaded = await request(app).get('/api/monitoring/config').set(auth());
    assert.equal(reloaded.body.data.cooldownSeconds, 10);
  });

  it('rejects unknown classes and out-of-range values', async () => {
    const response = await request(app)
      .put('/api/monitoring/config')
      .set(auth())
      .send({ targetClasses: ['unicorn'], confidenceThreshold: 2, cooldownSeconds: 1 });
    assert.equal(response.status, 400);
    assert.match(response.body.message, /unicorn/);
    assert.match(response.body.message, /confidenceThreshold/);
    assert.match(response.body.message, /cooldownSeconds/);
  });

  it('lists the 80 COCO classes', async () => {
    const response = await request(app).get('/api/monitoring/classes').set(auth());
    assert.equal(response.body.data.length, 80);
    assert.ok(response.body.data.includes('cell phone'));
  });
});

describe('POST /api/monitoring/detect', () => {
  it("sends the frame with the user's config to the vision service", async () => {
    await request(app).put('/api/monitoring/config').set(auth()).send({ targetClasses: ['dog'], confidenceThreshold: 0.7, cooldownSeconds: 15 });
    mock.method(visionService, 'detectObjects', async () => visionResult());

    await sendFrame();

    const [{ sessionId, config, mimeType, imageBuffer }] = visionService.detectObjects.mock.calls[0].arguments;
    assert.equal(sessionId, session.user.id);
    assert.deepEqual([...config.targetClasses], ['dog']);
    assert.equal(config.confidenceThreshold, 0.7);
    assert.equal(config.cooldownSeconds, 15);
    assert.equal(mimeType, 'image/jpeg');
    assert.deepEqual(imageBuffer, JPEG);
  });

  it('returns detections without storing anything when there is no event', async () => {
    mock.method(visionService, 'detectObjects', async () => visionResult([]));

    const response = await sendFrame();

    assert.equal(response.status, 200);
    assert.equal(response.body.data.detections.length, 2);
    assert.deepEqual(response.body.data.events, []);
    assert.equal(await Detection.countDocuments(), 0);
    assert.equal(s3Service.uploadImage.mock.callCount(), 0); // no uploads for ordinary frames
  });

  it('creates an event, uploads the frame once and returns the event', async () => {
    const events = [
      { class: 'person', confidence: 0.91, bbox: [10, 20, 110, 220] },
      { class: 'dog', confidence: 0.8, bbox: [5, 5, 50, 50] },
    ];
    mock.method(visionService, 'detectObjects', async () => visionResult(events));

    const response = await sendFrame();

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.events.map((e) => e.objectClass), ['person', 'dog']);
    assert.equal(s3Service.uploadImage.mock.callCount(), 1); // one snapshot shared by both events
    const stored = await Detection.find().sort({ objectClass: 1 });
    assert.equal(stored.length, 2);
    assert.equal(stored[0].s3Key, stored[1].s3Key);
    assert.equal(stored[0].source, 'browser');
    assert.equal(stored[0].frameWidth, 640);
  });

  it('passes vision service errors through with a meaningful status', async () => {
    mock.method(visionService, 'detectObjects', async () => {
      throw new ApiError(503, 'Vision service is unavailable. Make sure the Python detection service is running.');
    });

    const response = await sendFrame();

    assert.equal(response.status, 503);
    assert.match(response.body.message, /Python detection service/);
  });

  it('requires a frame', async () => {
    const response = await request(app).post('/api/monitoring/detect').set(auth());
    assert.equal(response.status, 400);
  });
});

describe('health and dashboard', () => {
  it('reports vision, database and storage status', async () => {
    mock.method(visionService, 'checkHealth', async () => ({ available: true, modelLoaded: true, model: 'yolov8n.pt', message: 'ready' }));
    const response = await request(app).get('/api/monitoring/health').set(auth());
    assert.equal(response.status, 200);
    assert.equal(response.body.data.database, 'connected');
    assert.equal(response.body.data.visionService.modelLoaded, true);
    assert.equal(response.body.data.storage.s3Configured, true);
  });

  it('computes dashboard statistics', async () => {
    const base = { userId: session.user.id, boundingBox: { x1: 0, y1: 0, x2: 1, y2: 1 }, frameWidth: 1, frameHeight: 1, confidence: 0.9, imageStatus: 'failed' };
    const today = new Date();
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    await Detection.create([
      { ...base, objectClass: 'person', timestamp: today },
      { ...base, objectClass: 'person', timestamp: today, status: 'reviewed' },
      { ...base, objectClass: 'dog', timestamp: today, imageStatus: 'uploaded' },
      { ...base, objectClass: 'car', timestamp: lastWeek, status: 'dismissed' },
    ]);

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const response = await request(app).get(`/api/dashboard/stats?since=${midnight.toISOString()}`).set(auth());

    assert.equal(response.status, 200);
    const stats = response.body.data;
    assert.equal(stats.detectionsToday, 3);
    assert.equal(stats.totalDetections, 4);
    assert.deepEqual(stats.topObjectsToday, [
      { objectClass: 'person', count: 2 },
      { objectClass: 'dog', count: 1 },
    ]);
    assert.deepEqual(stats.topObjects.map((o) => o.objectClass), ['person', 'car', 'dog']);
    assert.deepEqual(stats.statusCounts, { new: 2, reviewed: 1, dismissed: 1 });
    assert.equal(stats.failedUploads, 3);
    assert.equal(stats.recentEvents.length, 4);
    assert.ok(stats.lastDetectionAt);
  });

  it('rejects an invalid since date', async () => {
    const response = await request(app).get('/api/dashboard/stats?since=yesterday-ish').set(auth());
    assert.equal(response.status, 400);
  });
});
