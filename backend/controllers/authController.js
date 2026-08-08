const crypto = require('crypto');
const validator = require('validator');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { generateUserToken } = require('../utils/generateToken');
const logActivity = require('../utils/logActivity');
const {
  sendWelcomeEmail,
  sendVerificationOTP,
  sendForgotPasswordOTP,
} = require('../utils/sendEmail');

const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES) || 10;

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// @route  POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required.');
  }
  if (!validator.isEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long.');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const user = await User.create({ name, email: email.toLowerCase(), password });

  // Generate + store email verification OTP
  const { otp, hashedOTP } = user.generateOTP();
  user.verifyOTP = hashedOTP;
  user.verifyOTPExpires = Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000;
  await user.save();

  await sendWelcomeEmail(user.email, user.name);
  await sendVerificationOTP(user.email, user.name, otp);

  await logActivity({ userId: user._id, action: 'REGISTER', description: 'New account registered', req });

  res.status(201).json({
    success: true,
    message: 'Account created. Please check your email for a verification code.',
    data: { id: user._id, email: user.email },
  });
});

// @route  POST /api/auth/verify-email
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new ApiError(400, 'Email and OTP are required.');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+verifyOTP +verifyOTPExpires');
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.isVerified) throw new ApiError(400, 'Email is already verified.');

  if (!user.verifyOTP || !user.verifyOTPExpires || user.verifyOTPExpires < Date.now()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }
  if (hashOTP(otp) !== user.verifyOTP) {
    throw new ApiError(400, 'Invalid OTP.');
  }

  user.isVerified = true;
  user.verifyOTP = undefined;
  user.verifyOTPExpires = undefined;
  await user.save();

  await logActivity({ userId: user._id, action: 'VERIFY_EMAIL', req });

  res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
});

// @route  POST /api/auth/resend-verification
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.isVerified) throw new ApiError(400, 'Email is already verified.');

  const { otp, hashedOTP } = user.generateOTP();
  user.verifyOTP = hashedOTP;
  user.verifyOTPExpires = Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000;
  await user.save();

  await sendVerificationOTP(user.email, user.name, otp);

  res.json({ success: true, message: 'Verification code resent.' });
});

// @route  POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateUserToken(user._id, !!rememberMe);

  await logActivity({ userId: user._id, action: 'LOGIN', req });

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    },
  });
});

// @route  POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await logActivity({ userId: req.user._id, action: 'LOGOUT', req });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// @route  POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });

  // Do not reveal whether the email exists
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
  }

  const { otp, hashedOTP } = user.generateOTP();
  user.resetOTP = hashedOTP;
  user.resetOTPExpires = Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000;
  await user.save();

  await sendForgotPasswordOTP(user.email, user.name, otp);
  await logActivity({ userId: user._id, action: 'FORGOT_PASSWORD', req });

  res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
});

// @route  POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    throw new ApiError(400, 'Email, OTP, and new password are required.');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long.');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+resetOTP +resetOTPExpires');
  if (!user) throw new ApiError(404, 'User not found.');

  if (!user.resetOTP || !user.resetOTPExpires || user.resetOTPExpires < Date.now()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }
  if (hashOTP(otp) !== user.resetOTP) {
    throw new ApiError(400, 'Invalid OTP.');
  }

  user.password = newPassword;
  user.resetOTP = undefined;
  user.resetOTPExpires = undefined;
  await user.save();

  await logActivity({ userId: user._id, action: 'RESET_PASSWORD', req });

  res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
});

// @route  GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
};
