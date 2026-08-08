const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },

    // Cloudinary storage of the ENCRYPTED file only
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },

    // Integrity + crypto metadata
    originalHash: {
      type: String, // SHA-256 of the plaintext file, computed before encryption
      required: true,
    },
    encryptedHash: {
      type: String, // SHA-256 of the ciphertext, computed after encryption
      required: true,
    },
    iv: {
      type: String, // AES-GCM initialization vector (hex)
      required: true,
    },
    authTag: {
      type: String, // AES-GCM authentication tag (hex)
      required: true,
    },
    encryptedAESKey: {
      type: String, // AES key, RSA-encrypted with the server's public key (base64)
      required: true,
    },
    signature: {
      type: String, // RSA signature of the encrypted file hash (base64)
      required: true,
    },

    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },
  },
  { timestamps: true }
);

fileSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('File', fileSchema);
