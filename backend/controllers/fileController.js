const fs = require('fs');
const path = require('path');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/ApiError');
const File = require('../models/File');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const logActivity = require('../utils/logActivity');
const { hashFile, encryptFile, signHash } = require('../utils/crypto');

const ENCRYPTED_DIR = path.join(__dirname, '..', 'encrypted');

function safeUnlink(filePath) {
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`[Cleanup] Failed to remove ${filePath}:`, err.message);
    }
  });
}

// @route  POST /api/files/upload
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file was uploaded.');

  const plaintextPath = req.file.path;
  const encryptedFileName = `${req.file.filename}.enc`;
  const encryptedPath = path.join(ENCRYPTED_DIR, encryptedFileName);

  try {
    // 1. Hash the original (plaintext) file
    const originalHash = await hashFile(plaintextPath);

    // 2. Encrypt with AES-256-GCM, wrap AES key with RSA public key
    const { iv, authTag, encryptedAESKey } = await encryptFile(plaintextPath, encryptedPath);

    // 3. Hash the encrypted file, then sign that hash (digital signature)
    const encryptedHash = await hashFile(encryptedPath);
    const signature = signHash(encryptedHash);

    // 4. Upload the ENCRYPTED file to Cloudinary — original never leaves the server
    const cloudResult = await cloudinary.uploader.upload(encryptedPath, {
      resource_type: 'raw',
      folder: 'securecrypt/encrypted',
      public_id: encryptedFileName,
      overwrite: false,
    });

    // 5. Persist metadata
    const fileDoc = await File.create({
      owner: req.user._id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      cloudinaryUrl: cloudResult.secure_url,
      cloudinaryPublicId: cloudResult.public_id,
      originalHash,
      encryptedHash,
      iv,
      authTag,
      encryptedAESKey,
      signature,
    });

    // 6. Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { storageUsedBytes: req.file.size, totalFilesUploaded: 1 },
      lastUploadAt: new Date(),
    });

    await logActivity({
      userId: req.user._id,
      action: 'UPLOAD_FILE',
      description: `Uploaded "${req.file.originalname}"`,
      req,
    });

    res.status(201).json({
      success: true,
      message: 'File encrypted and uploaded successfully.',
      data: fileDoc,
    });
  } finally {
    // Always clean up local temp files — plaintext must never persist
    safeUnlink(plaintextPath);
    safeUnlink(encryptedPath);
  }
});

// @route  GET /api/files
const listFiles = asyncHandler(async (req, res) => {
  const files = await File.find({ owner: req.user._id, status: 'active' }).sort({ createdAt: -1 });
  res.json({ success: true, data: files });
});

// @route  GET /api/files/:id
const getFile = asyncHandler(async (req, res) => {
  const file = await File.findOne({ _id: req.params.id, owner: req.user._id, status: 'active' });
  if (!file) throw new ApiError(404, 'File not found.');
  res.json({ success: true, data: file });
});

// @route  DELETE /api/files/:id
const deleteFile = asyncHandler(async (req, res) => {
  const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
  if (!file) throw new ApiError(404, 'File not found.');

  await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: 'raw' });

  await User.findByIdAndUpdate(req.user._id, {
    $inc: { storageUsedBytes: -file.sizeBytes, totalFilesUploaded: -1 },
  });

  await file.deleteOne();

  await logActivity({
    userId: req.user._id,
    action: 'DELETE_FILE',
    description: `Deleted "${file.originalName}"`,
    req,
  });

  res.json({ success: true, message: 'File deleted successfully.' });
});

// @route  GET /api/files/dashboard/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const user = req.user;
  const recentFiles = await File.find({ owner: user._id, status: 'active' })
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      name: user.name,
      email: user.email,
      totalFilesUploaded: user.totalFilesUploaded,
      storageUsedBytes: user.storageUsedBytes,
      lastUploadAt: user.lastUploadAt,
      isVerified: user.isVerified,
      recentFiles,
    },
  });
});

module.exports = { uploadFile, listFiles, getFile, deleteFile, getDashboardStats };
