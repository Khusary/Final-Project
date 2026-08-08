const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user'],
      default: 'user',
    },

    // Email verification OTP
    verifyOTP: { type: String, select: false },
    verifyOTPExpires: { type: Date, select: false },

    // Password reset OTP
    resetOTP: { type: String, select: false },
    resetOTPExpires: { type: Date, select: false },

    // Decrypt-flow OTP (short-lived, tied to a specific decrypt session)
    decryptOTP: { type: String, select: false },
    decryptOTPExpires: { type: Date, select: false },

    storageUsedBytes: {
      type: Number,
      default: 0,
    },
    totalFilesUploaded: {
      type: Number,
      default: 0,
    },
    lastUploadAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: compare candidate password
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Instance method: generate a 6-digit numeric OTP + hashed storage
userSchema.methods.generateOTP = function generateOTP() {
  const otp = crypto.randomInt(100000, 999999).toString();
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  return { otp, hashedOTP };
};

module.exports = mongoose.model('User', userSchema);
