const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/ApiError');
const File = require('../models/File');
const DecryptSession = require('../models/DecryptSession');
const logActivity = require('../utils/logActivity');
const { sendDecryptOTP } = require('../utils/sendEmail');
const { hashFile, decryptFile, verifySignature } = require('../utils/crypto');

const DECRYPTED_DIR = path.join(__dirname, '..', 'decrypted');
const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES) || 10;
const SESSION_EXPIRES_MINUTES = Number(process.env.DECRYPT_SESSION_EXPIRES_MINUTES) || 10;

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download encrypted file (status ${response.statusCode})`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

function safeUnlink(filePath) {
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`[Cleanup] Failed to remove ${filePath}:`, err.message);
    }
  });
}

// @route  POST /api/decrypt/:fileId/request-otp
const requestDecryptOTP = asyncHandler(async (req, res) => {
  const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id, status: 'active' });
  if (!file) throw new ApiError(404, 'File not found.');

  const { otp, hashedOTP } = req.user.generateOTP();
  req.user.decryptOTP = hashedOTP;
  req.user.decryptOTPExpires = Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000;
  await req.user.save();

  await sendDecryptOTP(req.user.email, req.user.name, otp, file.originalName);
  await logActivity({
    userId: req.user._id,
    action: 'REQUEST_DECRYPT_OTP',
    description: `Requested decrypt OTP for "${file.originalName}"`,
    req,
  });

  res.json({ success: true, message: 'A decryption authorization code has been sent to your email.' });
});

// @route  POST /api/decrypt/:fileId/verify-otp
// Creates a short-lived DecryptSession once the OTP is confirmed.
const verifyDecryptOTP = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  if (!otp) throw new ApiError(400, 'OTP is required.');

  const file = await File.findOne({ _id: req.params.fileId, owner: req.user._id, status: 'active' });
  if (!file) throw new ApiError(404, 'File not found.');

  const user = await require('../models/User')
    .findById(req.user._id)
    .select('+decryptOTP +decryptOTPExpires');

  if (!user.decryptOTP || !user.decryptOTPExpires || user.decryptOTPExpires < Date.now()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }
  if (hashOTP(otp) !== user.decryptOTP) {
    throw new ApiError(400, 'Invalid OTP.');
  }

  user.decryptOTP = undefined;
  user.decryptOTPExpires = undefined;
  await user.save();

  const session = await DecryptSession.create({
    user: req.user._id,
    file: file._id,
    verified: true,
    expiresAt: new Date(Date.now() + SESSION_EXPIRES_MINUTES * 60 * 1000),
  });

  res.json({
    success: true,
    message: 'OTP verified. You may now decrypt this file.',
    data: { sessionId: session._id, expiresAt: session.expiresAt },
  });
});

// @route  POST /api/decrypt/session/:sessionId/download
// Verifies hash + signature, decrypts, streams the original file back, then cleans up.
const decryptAndDownload = asyncHandler(async (req, res) => {
  const session = await DecryptSession.findOne({
    _id: req.params.sessionId,
    user: req.user._id,
    verified: true,
  }).populate('file');

  if (!session) throw new ApiError(404, 'Decrypt session not found.');
  if (session.expiresAt < new Date()) throw new ApiError(410, 'Decrypt session has expired. Please request a new OTP.');

  const file = session.file;
  if (!file || file.status !== 'active') throw new ApiError(404, 'File not found.');

  const encryptedPath = path.join(DECRYPTED_DIR, `${file._id}.download.enc`);
  const decryptedPath = path.join(DECRYPTED_DIR, `${file._id}.${file.originalName}`);

  try {
    // 1. Download the encrypted file from Cloudinary
    await downloadToFile(file.cloudinaryUrl, encryptedPath);

    // 2. Verify integrity: hash of downloaded ciphertext must match stored hash
    const currentEncryptedHash = await hashFile(encryptedPath);
    if (currentEncryptedHash !== file.encryptedHash) {
      throw new ApiError(422, 'File integrity check failed. The encrypted file may have been tampered with.');
    }

    // 3. Verify digital signature against that same hash
    const validSignature = verifySignature(currentEncryptedHash, file.signature);
    if (!validSignature) {
      throw new ApiError(422, 'Digital signature verification failed. Rejecting decryption.');
    }

    // 4. Decrypt (unwrap AES key via RSA, then AES-256-GCM decrypt)
    await decryptFile(encryptedPath, decryptedPath, {
      iv: file.iv,
      authTag: file.authTag,
      encryptedAESKey: file.encryptedAESKey,
    });

    // 5. Verify the recovered plaintext matches the original hash taken at upload time
    const recoveredHash = await hashFile(decryptedPath);
    if (recoveredHash !== file.originalHash) {
      throw new ApiError(422, 'Decrypted file does not match the original. Aborting.');
    }

    await logActivity({
      userId: req.user._id,
      action: 'DECRYPT_FILE',
      description: `Decrypted and downloaded "${file.originalName}"`,
      req,
    });

    // Invalidate the session immediately after successful use (single-use)
    session.expiresAt = new Date();
    await session.save();

    res.download(decryptedPath, file.originalName, (err) => {
      safeUnlink(encryptedPath);
      safeUnlink(decryptedPath);
      if (err) console.error('[Download] Error streaming decrypted file:', err.message);
    });
  } catch (err) {
    safeUnlink(encryptedPath);
    safeUnlink(decryptedPath);
    throw err;
  }
});

module.exports = { requestDecryptOTP, verifyDecryptOTP, decryptAndDownload };
