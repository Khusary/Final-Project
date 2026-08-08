const express = require('express');
const router = express.Router();
const {
  adminLogin,
  getAdminDashboard,
  getUsers,
  deleteUser,
  getAllFiles,
  adminDeleteFile,
  getLogs,
} = require('../controllers/adminController');
const { protectAdmin } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/login', authLimiter, adminLogin);

router.use(protectAdmin);

router.get('/dashboard', getAdminDashboard);
router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);
router.get('/files', getAllFiles);
router.delete('/files/:id', adminDeleteFile);
router.get('/logs', getLogs);

module.exports = router;
