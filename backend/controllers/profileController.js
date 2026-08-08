const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

// @route  GET /api/profile
const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// @route  PUT /api/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2) {
    throw new ApiError(400, 'Name must be at least 2 characters long.');
  }

  const user = await User.findByIdAndUpdate(req.user._id, { name: name.trim() }, { new: true, runValidators: true });

  res.json({ success: true, message: 'Profile updated successfully.', data: user });
});

// @route  PUT /api/profile/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current and new password are required.');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters long.');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully.' });
});

module.exports = { getProfile, updateProfile, changePassword };
