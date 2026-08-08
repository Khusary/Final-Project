const express = require('express');
const router = express.Router();
const { uploadFile, listFiles, getFile, deleteFile, getDashboardStats } = require('../controllers/fileController');
const { protect, requireVerified } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

router.get('/dashboard/stats', getDashboardStats);
router.post('/upload', requireVerified, upload.single('file'), uploadFile);
router.get('/', listFiles);
router.get('/:id', getFile);
router.delete('/:id', deleteFile);

module.exports = router;
