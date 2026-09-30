const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { sendSuccess } = require('../utils/response');
const { signToken } = require('../middleware/auth');
const { validateLogin, validateRegistration } = require('../utils/validators');

// Cost factor 10 = ~2^10 hashing rounds: slow for attackers, fast enough for login.
const SALT_ROUNDS = 10;

async function register(req, res) {
  const { name, email, password } = validateRegistration(req.body);

  if (await User.exists({ email })) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });
  logger.info(`User registered: ${user.email}`);

  sendSuccess(res, { token: signToken(user._id), user }, 201);
}

async function login(req, res) {
  const { email, password } = validateLogin(req.body);

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  // Same message for "no such user" and "wrong password" so the API
  // doesn't reveal which emails are registered.
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  sendSuccess(res, { token: signToken(user._id), user });
}

async function getCurrentUser(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  sendSuccess(res, { user });
}

module.exports = { register, login, getCurrentUser };
