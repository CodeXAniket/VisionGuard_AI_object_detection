const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Each test file gets its own throwaway in-memory MongoDB.
let mongoServer;

async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function clearTestDatabase() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function closeTestDatabase() {
  await mongoose.disconnect();
  await mongoServer?.stop();
}

let userCounter = 0;

// Registers a fresh user and returns { token, user }.
async function registerUser(app, overrides = {}) {
  userCounter += 1;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: `user${userCounter}@example.com`, password: 'password123', ...overrides });
  return response.body.data;
}

module.exports = { connectTestDatabase, clearTestDatabase, closeTestDatabase, registerUser };
