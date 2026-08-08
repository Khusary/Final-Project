const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Admin = require('../models/Admin');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
}

/**
 * Protects routes for authenticated regular users.
 * Verifies the JWT, loads the user, and rejects deactivated accounts.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'Not authorized. Please log in.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Session expired or invalid token. Please log in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'User account no longer exists.');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated.');
  }

  req.user = user;
  next();
});

/**
 * Protects routes for admin users. Uses the separate admin JWT secret.
 */
const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'Admin authorization required.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired admin session.');
  }

  const admin = await Admin.findById(decoded.id);
  if (!admin) {
    throw new ApiError(401, 'Admin account no longer exists.');
  }

  req.admin = admin;
  next();
});

/**
 * Requires the authenticated user's email to be verified.
 * Must run after `protect`.
 */
const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    throw new ApiError(403, 'Please verify your email to access this feature.');
  }
  next();
};

module.exports = { protect, protectAdmin, requireVerified };
