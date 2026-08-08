const jwt = require('jsonwebtoken');

/**
 * Signs a JWT for a regular user.
 * @param {string} userId
 * @param {boolean} rememberMe - extends expiry when true
 */
function generateUserToken(userId, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Signs a JWT for an admin, using a separate secret so admin and user
 * tokens can never be swapped or reused across privilege boundaries.
 */
function generateAdminToken(adminId, role = 'admin') {
  return jwt.sign({ id: adminId, role }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

module.exports = { generateUserToken, generateAdminToken };
