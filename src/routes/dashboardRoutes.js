const express = require('express');
const router = express.Router();
const {
  getDashboard,
  updateEventDetails,
  submitRating,
  trackAnalytics,
} = require('../controllers/dashboardController');

router.get('/p/:uniqueLinkId', getDashboard);
router.patch('/event-details/:eventId', updateEventDetails);
router.post('/rating', submitRating);
router.post('/analytics', trackAnalytics);

module.exports = router;
