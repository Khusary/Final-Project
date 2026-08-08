const ActivityLog = require('../models/ActivityLog');

/**
 * Writes an activity log entry. Never throws — logging failures must not
 * break the primary request flow.
 *
 * @param {object} opts
 * @param {string} [opts.userId]
 * @param {string} [opts.adminId]
 * @param {string} opts.action - one of the ActivityLog enum values
 * @param {string} [opts.description]
 * @param {import('express').Request} opts.req - used to extract IP / user agent
 */
async function logActivity({ userId, adminId, action, description = '', req }) {
  try {
    await ActivityLog.create({
      user: userId || null,
      admin: adminId || null,
      action,
      description,
      ipAddress: req?.ip || req?.headers['x-forwarded-for'] || '',
      userAgent: req?.headers['user-agent'] || '',
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to write log:', err.message);
  }
}

module.exports = logActivity;
