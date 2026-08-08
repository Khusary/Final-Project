const express = require('express');
const router = express.Router();
const { requestDecryptOTP, verifyDecryptOTP, decryptAndDownload } = require('../controllers/decryptController');
const { protect, requireVerified } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

router.use(protect, requireVerified);

router.post('/:fileId/request-otp', authLimiter, requestDecryptOTP);
router.post('/:fileId/verify-otp', authLimiter, verifyDecryptOTP);
router.post('/session/:sessionId/download', decryptAndDownload);

module.exports = router;
