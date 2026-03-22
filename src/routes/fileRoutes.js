const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getEventFiles } = require('../controllers/fileController');

router.get('/files/:eventId', authMiddleware, getEventFiles);

module.exports = router;
