const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'REGISTER',
        'LOGIN',
        'LOGOUT',
        'VERIFY_EMAIL',
        'FORGOT_PASSWORD',
        'RESET_PASSWORD',
        'UPLOAD_FILE',
        'DOWNLOAD_FILE',
        'DELETE_FILE',
        'REQUEST_DECRYPT_OTP',
        'DECRYPT_FILE',
        'ADMIN_LOGIN',
        'ADMIN_DELETE_USER',
        'ADMIN_DELETE_FILE',
        'ADMIN_VIEW_LOGS',
      ],
    },
    description: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
