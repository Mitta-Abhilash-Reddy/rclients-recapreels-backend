const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {
  createClient,
  createEvent,
  deleteEvent,
  assignCreator,
  updateEventPoc,
  getEventOtpStatus,
  updateEventOtp,
  adminUpload,
  deleteFile,
  addPayment,
  getClients,
  getCreators,
  getEvents,
} = require('../controllers/adminController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// All admin routes require auth + admin role
router.use(authMiddleware, roleMiddleware('admin'));

// ─── Clients ──────────────────────────────────────────────────────────────────
router.get('/clients', getClients);
router.post('/client', createClient);

// ─── Events ───────────────────────────────────────────────────────────────────
router.get('/events', getEvents);
router.post('/event', createEvent);
router.delete('/event/:id', deleteEvent);

// ─── POC management (assign + manual override) ────────────────────────────────
router.post('/assign-creator', assignCreator);
router.patch('/event/:eventId/poc', updateEventPoc);

// ─── OTP management ───────────────────────────────────────────────────────────
router.get('/event/:eventId/otp', getEventOtpStatus);
router.patch('/event/:eventId/otp', updateEventOtp);

// ─── Creators ─────────────────────────────────────────────────────────────────
router.get('/creators', getCreators);

// ─── Files ────────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), adminUpload);
router.delete('/file/:id', deleteFile);

// ─── Payments ─────────────────────────────────────────────────────────────────
router.post('/payment', addPayment);

module.exports = router;