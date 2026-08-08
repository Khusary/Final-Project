const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/ApiError');
const Admin = require('../models/Admin');
const User = require('../models/User');
const File = require('../models/File');
const ActivityLog = require('../models/ActivityLog');
const cloudinary = require('../config/cloudinary');
const { generateAdminToken } = require('../utils/generateToken');
const logActivity = require('../utils/logActivity');

// @route  POST /api/admin/login
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) {
    throw new ApiError(401, 'Invalid admin credentials.');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = generateAdminToken(admin._id, admin.role);

  await logActivity({ adminId: admin._id, action: 'ADMIN_LOGIN', req });

  res.json({
    success: true,
    message: 'Admin login successful.',
    data: { token, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } },
  });
});

// @route  GET /api/admin/dashboard
const getAdminDashboard = asyncHandler(async (req, res) => {
  const [totalUsers, totalFiles, storageAgg, verifiedUsers] = await Promise.all([
    User.countDocuments(),
    File.countDocuments({ status: 'active' }),
    File.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, totalBytes: { $sum: '$sizeBytes' } } },
    ]),
    User.countDocuments({ isVerified: true }),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      verifiedUsers,
      totalFiles,
      totalStorageBytes: storageAgg[0]?.totalBytes || 0,
    },
  });
});

// @route  GET /api/admin/users?search=&page=&limit=
const getUsers = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;

  const query = search
    ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
    : {};

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await User.countDocuments(query);

  res.json({ success: true, data: users, meta: { total, page: Number(page), limit: Number(limit) } });
});

// @route  DELETE /api/admin/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  const files = await File.find({ owner: user._id });
  for (const file of files) {
    await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: 'raw' }).catch(() => {});
  }
  await File.deleteMany({ owner: user._id });
  await user.deleteOne();

  await logActivity({
    adminId: req.admin._id,
    action: 'ADMIN_DELETE_USER',
    description: `Deleted user ${user.email}`,
    req,
  });

  res.json({ success: true, message: 'User and their files have been deleted.' });
});

// @route  GET /api/admin/files?search=&page=&limit=
const getAllFiles = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;

  const query = { status: 'active', ...(search ? { originalName: new RegExp(search, 'i') } : {}) };

  const files = await File.find(query)
    .populate('owner', 'name email')
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await File.countDocuments(query);

  res.json({ success: true, data: files, meta: { total, page: Number(page), limit: Number(limit) } });
});

// @route  DELETE /api/admin/files/:id
const adminDeleteFile = asyncHandler(async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) throw new ApiError(404, 'File not found.');

  await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: 'raw' }).catch(() => {});
  await User.findByIdAndUpdate(file.owner, { $inc: { storageUsedBytes: -file.sizeBytes, totalFilesUploaded: -1 } });
  await file.deleteOne();

  await logActivity({
    adminId: req.admin._id,
    action: 'ADMIN_DELETE_FILE',
    description: `Deleted file "${file.originalName}"`,
    req,
  });

  res.json({ success: true, message: 'File deleted successfully.' });
});

// @route  GET /api/admin/logs?page=&limit=
const getLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const logs = await ActivityLog.find({})
    .populate('user', 'name email')
    .populate('admin', 'name email')
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await ActivityLog.countDocuments({});

  res.json({ success: true, data: logs, meta: { total, page: Number(page), limit: Number(limit) } });
});

module.exports = {
  adminLogin,
  getAdminDashboard,
  getUsers,
  deleteUser,
  getAllFiles,
  adminDeleteFile,
  getLogs,
};
