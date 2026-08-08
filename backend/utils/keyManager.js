const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.join(__dirname, '..', 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

/**
 * Ensures an RSA key pair exists on disk. Generates one on first boot.
 * The private key never leaves the server; it is used to decrypt AES keys
 * and to sign/verify file hashes.
 */
function ensureRSAKeyPair() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    return {
      publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'),
      privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
    };
  }

  const modulusLength = Number(process.env.RSA_KEY_SIZE) || 2048;

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o600 });
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });

  console.log('[KeyManager] Generated new RSA key pair at backend/keys/');

  return { publicKey, privateKey };
}

function getPublicKey() {
  return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
}

function getPrivateKey() {
  return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
}

module.exports = { ensureRSAKeyPair, getPublicKey, getPrivateKey };
