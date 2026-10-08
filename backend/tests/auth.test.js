const { describe, it, before, after, afterEach, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../app');
const User = require('../models/User');
const { connectTestDatabase, clearTestDatabase, closeTestDatabase, registerUser } = require('./helpers');

const app = createApp();

before(connectTestDatabase);
afterEach(clearTestDatabase);
after(closeTestDatabase);

describe('POST /api/auth/register', () => {
  it('creates a user, hashes the password and returns a JWT', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'Asha@Example.com', password: 'password123' });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    const { user, token } = response.body.data;
    assert.equal(user.name, 'Asha');
    assert.equal(user.email, 'asha@example.com');
    assert.equal(user.passwordHash, undefined);
    assert.equal(jwt.verify(token, 'test-secret').sub, user.id);

    const stored = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    assert.notEqual(stored.passwordHash, 'password123');
    assert.match(stored.passwordHash, /^\$2[aby]\$/); // bcrypt hash
  });

  it('rejects invalid input with 400 and lists the problems', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /Name is required/);
    assert.match(response.body.message, /valid email/);
    assert.match(response.body.message, /at least 8 characters/);
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser(app, { email: 'dup@example.com' });
    const response = await request(app).post('/api/auth/register').send({ name: 'B', email: 'dup@example.com', password: 'password123' });
    assert.equal(response.status, 409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => registerUser(app, { email: 'login@example.com', password: 'correct-password' }));

  it('returns a token for valid credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'correct-password' });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.data.token, 'string');
  });

  it('returns 401 with a generic message for a wrong password', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong-password' });
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { success: false, message: 'Invalid email or password' });
  });

  it('returns the same 401 for an unknown email', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever123' });
    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Invalid email or password');
  });

  it('rejects NoSQL-injection style payloads with 400', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.equal(response.status, 400);
  });
});

describe('JWT-protected routes', () => {
  it('returns the current user for a valid token', async () => {
    const { token } = await registerUser(app, { email: 'me@example.com' });
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.email, 'me@example.com');
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/api/auth/me');
    assert.equal(response.status, 401);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const forged = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'attacker-secret');
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Invalid authentication token');
  });

  it('returns 401 with a clear message for an expired token', async () => {
    const expired = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'test-secret', { expiresIn: -10 });
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    assert.equal(response.status, 401);
    assert.match(response.body.message, /expired/);
  });
});

describe('general API behaviour', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const response = await request(app).get('/api/does-not-exist');
    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
  });

  it('allows every configured frontend origin (CORS) and no others', async () => {
    const local = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    const hosted = await request(app).get('/api/health').set('Origin', 'https://visionguard.example.app');
    const other = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');

    assert.equal(local.headers['access-control-allow-origin'], 'http://localhost:5173');
    // Trailing slash and spaces in CLIENT_ORIGIN are tolerated
    assert.equal(hosted.headers['access-control-allow-origin'], 'https://visionguard.example.app');
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(response.status, 400);
    assert.equal(response.body.message, 'Request body is not valid JSON');
  });
});
