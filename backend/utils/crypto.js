const crypto = require('crypto');
const fs = require('fs');
const { getPublicKey, getPrivateKey } = require('./keyManager');

const AES_ALGORITHM = 'aes-256-gcm';

/**
 * Computes the SHA-256 hash of a file on disk.
 * @param {string} filePath
 * @returns {Promise<string>} hex digest
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Computes the SHA-256 hash of a Buffer.
 */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Encrypts a file using AES-256-GCM with a freshly generated key + IV.
 * The AES key is then encrypted (wrapped) with the server's RSA public key
 * (hybrid encryption), so only the server's RSA private key can unwrap it.
 *
 * @param {string} inputPath  - path to the plaintext file
 * @param {string} outputPath - path to write the ciphertext file
 * @returns {Promise<{iv: string, authTag: string, encryptedAESKey: string}>}
 */
async function encryptFile(inputPath, outputPath) {
  const aesKey = crypto.randomBytes(32); // 256-bit key
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, iv);

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    input.pipe(cipher).pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
    input.on('error', reject);
  });

  const authTag = cipher.getAuthTag();

  const publicKey = getPublicKey();
  const encryptedAESKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey
  );

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encryptedAESKey: encryptedAESKey.toString('base64'),
  };
}

/**
 * Decrypts a file that was encrypted with encryptFile().
 * Unwraps the AES key using the RSA private key, then decrypts with AES-256-GCM.
 *
 * @param {string} inputPath  - path to the ciphertext file
 * @param {string} outputPath - path to write the recovered plaintext
 * @param {object} meta - { iv (hex), authTag (hex), encryptedAESKey (base64) }
 */
async function decryptFile(inputPath, outputPath, meta) {
  const { iv, authTag, encryptedAESKey } = meta;

  const privateKey = getPrivateKey();
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedAESKey, 'base64')
  );

  const decipher = crypto.createDecipheriv(AES_ALGORITHM, aesKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    input
      .pipe(decipher)
      .pipe(output)
      .on('finish', resolve)
      .on('error', reject);
    input.on('error', reject);
    decipher.on('error', reject);
  });
}

/**
 * Signs a hex digest (e.g. the encrypted file's SHA-256 hash) with the
 * server's RSA private key. Used as the file's digital signature.
 */
function signHash(hexDigest) {
  const privateKey = getPrivateKey();
  const sign = crypto.createSign('SHA256');
  sign.update(hexDigest);
  sign.end();
  return sign.sign(privateKey).toString('base64');
}

/**
 * Verifies a digital signature against a hex digest using the server's
 * RSA public key. Returns true/false.
 */
function verifySignature(hexDigest, signatureBase64) {
  const publicKey = getPublicKey();
  const verify = crypto.createVerify('SHA256');
  verify.update(hexDigest);
  verify.end();
  return verify.verify(publicKey, Buffer.from(signatureBase64, 'base64'));
}

module.exports = {
  hashFile,
  hashBuffer,
  encryptFile,
  decryptFile,
  signHash,
  verifySignature,
};
