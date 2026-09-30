const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../app');
const Detection = require('../models/Detection');
const s3Service = require('../services/s3Service');
const { connectTestDatabase, clearTestDatabase, closeTestDatabase, registerUser } = require('./helpers');

const app = createApp();
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // content isn't inspected by the API

let owner;
let otherUser;

function auth(user) {
  return { Authorization: `Bearer ${user.token}` };
}

function createEvent(user, overrides = {}) {
  return Detection.create({
    userId: user.user.id,
    objectClass: 'person',
    confidence: 0.9,
    boundingBox: { x1: 1, y1: 2, x2: 3, y2: 4 },
    frameWidth: 640,
    frameHeight: 480,
    imageStatus: 'uploaded',
    s3Key: `detections/${user.user.id}/key-${Math.random()}.jpg`,
    ...overrides,
  });
}

function postDetection(user, fields = {}) {
  const body = { objectClass: 'person', confidence: '0.91', bbox: '[10, 20, 110, 220]', frameWidth: '640', frameHeight: '480', ...fields };
  let req = request(app).post('/api/detections').set(auth(user));
  for (const [key, value] of Object.entries(body)) req = req.field(key, value);
  return req.attach('image', JPEG, { filename: 'snap.jpg', contentType: 'image/jpeg' });
}

before(connectTestDatabase);
after(closeTestDatabase);

beforeEach(async () => {
  owner = await registerUser(app);
  otherUser = await registerUser(app);
  mock.method(s3Service, 'uploadImage', async () => {});
  mock.method(s3Service, 'deleteImage', async () => {});
  mock.method(s3Service, 'getSignedImageUrl', async (key) => `https://signed.example/${key}`);
});

afterEach(async () => {
  mock.restoreAll();
  await clearTestDatabase();
});

describe('POST /api/detections', () => {
  it('uploads the snapshot to S3 and stores metadata in MongoDB', async () => {
    const response = await postDetection(owner);

    assert.equal(response.status, 201);
    const event = response.body.data;
    assert.equal(event.objectClass, 'person');
    assert.equal(event.confidence, 0.91);
    assert.deepEqual(event.boundingBox, { x1: 10, y1: 20, x2: 110, y2: 220 });
    assert.equal(event.imageStatus, 'uploaded');
    assert.equal(event.status, 'new');
    assert.equal(event.source, 'local-camera');
    assert.match(event.imageUrl, /^https:\/\/signed\.example\/detections\//);

    const [key, body, contentType] = s3Service.uploadImage.mock.calls[0].arguments;
    assert.match(key, new RegExp(`^detections/${owner.user.id}/\\d{4}-\\d{2}-\\d{2}/\\d+-[\\w-]+\\.jpg$`));
    assert.deepEqual(body, JPEG);
    assert.equal(contentType, 'image/jpeg');

    const stored = await Detection.findById(event.id);
    assert.equal(stored.s3Key, key);
    assert.equal(stored.imageUrl, `https://visionguard-test-bucket.s3.ap-south-1.amazonaws.com/${key}`);
  });

  it('still records the event when the S3 upload fails', async () => {
    s3Service.uploadImage.mock.mockImplementation(async () => {
      throw new Error('AccessDenied');
    });

    const response = await postDetection(owner);

    assert.equal(response.status, 201);
    assert.equal(response.body.data.imageStatus, 'failed');
    assert.equal(response.body.data.imageUrl, null);
    assert.equal(await Detection.countDocuments(), 1);
  });

  it('rejects an invalid bounding box with 400', async () => {
    const response = await postDetection(owner, { bbox: '[100, 100, 50, 50]' });
    assert.equal(response.status, 400);
    assert.match(response.body.message, /bbox/);
  });

  it('rejects an unknown object class with 400', async () => {
    const response = await postDetection(owner, { objectClass: 'dragon' });
    assert.equal(response.status, 400);
  });

  it('rejects a request without an image', async () => {
    const response = await request(app).post('/api/detections').set(auth(owner)).field('objectClass', 'person');
    assert.equal(response.status, 400);
    assert.match(response.body.message, /image file is required/);
  });

  it('rejects non-image uploads', async () => {
    const response = await request(app)
      .post('/api/detections')
      .set(auth(owner))
      .attach('image', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    assert.equal(response.status, 400);
  });

  it('requires authentication', async () => {
    const response = await request(app).post('/api/detections');
    assert.equal(response.status, 401);
  });
});

describe('GET /api/detections', () => {
  beforeEach(async () => {
    await createEvent(owner, { objectClass: 'person', confidence: 0.95, timestamp: new Date('2026-09-01T10:00:00Z') });
    await createEvent(owner, { objectClass: 'dog', confidence: 0.6, timestamp: new Date('2026-09-02T10:00:00Z') });
    await createEvent(owner, { objectClass: 'person', confidence: 0.7, timestamp: new Date('2026-09-03T10:00:00Z') });
    await createEvent(otherUser, { objectClass: 'person' });
  });

  it("returns only the user's own events, newest first", async () => {
    const response = await request(app).get('/api/detections').set(auth(owner));
    assert.equal(response.status, 200);
    const { items, pagination } = response.body.data;
    assert.equal(items.length, 3);
    assert.deepEqual(items.map((i) => i.objectClass), ['person', 'dog', 'person']);
    assert.ok(items.every((i) => i.userId === owner.user.id));
    assert.deepEqual(pagination, { page: 1, limit: 20, total: 3, pages: 1 });
  });

  it('filters by object class, confidence and date range', async () => {
    const byClass = await request(app).get('/api/detections?objectClass=dog').set(auth(owner));
    assert.deepEqual(byClass.body.data.items.map((i) => i.objectClass), ['dog']);

    const byConfidence = await request(app).get('/api/detections?minConfidence=0.8').set(auth(owner));
    assert.deepEqual(byConfidence.body.data.items.map((i) => i.confidence), [0.95]);

    const byDate = await request(app)
      .get('/api/detections?from=2026-09-02T00:00:00Z&to=2026-09-03T00:00:00Z')
      .set(auth(owner));
    assert.deepEqual(byDate.body.data.items.map((i) => i.objectClass), ['dog']);
  });

  it('paginates', async () => {
    const response = await request(app).get('/api/detections?limit=2&page=2').set(auth(owner));
    assert.equal(response.body.data.items.length, 1);
    assert.equal(response.body.data.pagination.pages, 2);
  });

  it('rejects invalid query parameters with 400', async () => {
    const response = await request(app).get('/api/detections?minConfidence=5&page=0').set(auth(owner));
    assert.equal(response.status, 400);
    assert.match(response.body.message, /page/);
    assert.match(response.body.message, /minConfidence/);
  });
});

describe('single detection routes', () => {
  it('returns an event with a presigned image URL', async () => {
    const event = await createEvent(owner);
    const response = await request(app).get(`/api/detections/${event.id}`).set(auth(owner));
    assert.equal(response.status, 200);
    assert.equal(response.body.data.imageUrl, `https://signed.example/${event.s3Key}`);
  });

  it("returns 403 for another user's event", async () => {
    const event = await createEvent(otherUser);
    const response = await request(app).get(`/api/detections/${event.id}`).set(auth(owner));
    assert.equal(response.status, 403);
  });

  it('returns 404 for a missing event and 400 for a malformed id', async () => {
    const missing = await request(app).get('/api/detections/507f1f77bcf86cd799439011').set(auth(owner));
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { success: false, message: 'Detection not found' });

    const malformed = await request(app).get('/api/detections/not-an-id').set(auth(owner));
    assert.equal(malformed.status, 400);
  });

  it('updates the status', async () => {
    const event = await createEvent(owner);
    const response = await request(app).patch(`/api/detections/${event.id}`).set(auth(owner)).send({ status: 'reviewed' });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'reviewed');

    const invalid = await request(app).patch(`/api/detections/${event.id}`).set(auth(owner)).send({ status: 'archived' });
    assert.equal(invalid.status, 400);
  });

  it('deletes the event and its S3 image', async () => {
    const event = await createEvent(owner);
    const response = await request(app).delete(`/api/detections/${event.id}`).set(auth(owner));
    assert.equal(response.status, 200);
    assert.equal(await Detection.countDocuments(), 0);
    assert.equal(s3Service.deleteImage.mock.calls[0].arguments[0], event.s3Key);
  });

  it('keeps an S3 image that another event still uses', async () => {
    const first = await createEvent(owner, { s3Key: 'detections/shared.jpg' });
    await createEvent(owner, { objectClass: 'dog', s3Key: 'detections/shared.jpg' });

    await request(app).delete(`/api/detections/${first.id}`).set(auth(owner));
    assert.equal(s3Service.deleteImage.mock.callCount(), 0);
  });

  it("does not let a user delete another user's event", async () => {
    const event = await createEvent(otherUser);
    const response = await request(app).delete(`/api/detections/${event.id}`).set(auth(owner));
    assert.equal(response.status, 403);
    assert.equal(await Detection.countDocuments(), 1);
  });
});
