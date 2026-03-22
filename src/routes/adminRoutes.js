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

router.get('/clients', getClients);
router.get('/creators', getCreators);
router.get('/events', getEvents);
router.post('/client', createClient);
router.post('/event', createEvent);
router.delete('/event/:id', deleteEvent);
router.post('/assign-creator', assignCreator);
router.post('/upload', upload.single('file'), adminUpload);
router.delete('/file/:id', deleteFile);
router.post('/payment', addPayment);

module.exports = router;
