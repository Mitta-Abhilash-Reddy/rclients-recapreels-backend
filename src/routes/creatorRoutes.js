const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {
  login,
  register,
  getCreatorEvents,
  creatorUpload,
  submitOtp,
  getOtpStatus,
} = require('../controllers/creatorController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ─── Auth (public) ────────────────────────────────────────────────────────────
router.post('/auth/login', login);
router.post('/auth/register', register);

// ─── Creator protected routes ─────────────────────────────────────────────────
router.get(
  '/creator/events',
  authMiddleware,
  roleMiddleware('admin', 'creator'),
  getCreatorEvents
);

router.post(
  '/creator/upload',
  authMiddleware,
  roleMiddleware('creator'),
  upload.single('file'),
  creatorUpload
);

// OTP verification — creator submits OTP received from client
router.post(
  '/creator/otp',
  authMiddleware,
  roleMiddleware('creator', 'admin'),
  submitOtp
);

// OTP status — creator checks current verification state of an event
router.get(
  '/creator/otp-status/:eventId',
  authMiddleware,
  roleMiddleware('creator', 'admin'),
  getOtpStatus
);

module.exports = router;