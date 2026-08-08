require('dotenv').config();
const fs = require('fs');
const path = require('path');
const app = require('./app');
const connectDB = require('./config/db');
const { ensureRSAKeyPair } = require('./utils/keyManager');

const PORT = process.env.PORT || 5000;

// Ensure required local directories exist (they are also in .gitignore-able
// runtime folders, but must exist for multer/crypto to write to them)
['uploads', 'encrypted', 'decrypted', 'keys'].forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

(async () => {
  try {
    await connectDB();
    ensureRSAKeyPair();

    app.listen(PORT, () => {
      console.log(`[Server] SecureCrypt API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
})();

process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err);
});
