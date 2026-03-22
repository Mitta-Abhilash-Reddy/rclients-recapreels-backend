const supabase = require('../config/supabaseClient');
const dashboardService = require('../services/dashboardService');

// GET /api/p/:uniqueLinkId
async function getDashboard(req, res) {
  try {
    const { uniqueLinkId } = req.params;
    const data = await dashboardService.getDashboardByUniqueLink(uniqueLinkId);
    res.json(data);
  } catch (err) {
    if (err.message === 'Client not found') {
      return res.status(404).json({ error: 'Client not found' });
    }
    console.error('[getDashboard]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/event-details/:eventId
async function updateEventDetails(req, res) {
  try {
    const { eventId } = req.params;
    const { description, musicPreferences, locationLink, clientPoc } = req.body;

    const updates = {};
    if (description !== undefined) updates.description = description;
    if (musicPreferences !== undefined) updates.music_preferences = musicPreferences;
    if (locationLink !== undefined) updates.location_link = locationLink;
    if (clientPoc?.name !== undefined) updates.client_poc_name = clientPoc.name;
    if (clientPoc?.phone !== undefined) updates.client_poc_phone = clientPoc.phone;

    const { error } = await supabase
      .from('event_details')
      .upsert({ event_id: eventId, ...updates }, { onConflict: 'event_id' });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[updateEventDetails]', err);
    res.status(500).json({ error: 'Failed to update event details' });
  }
}

// POST /api/rating
async function submitRating(req, res) {
  try {
    const { eventId, value, comment } = req.body;

    if (!eventId || value === undefined) {
      return res.status(400).json({ error: 'eventId and value are required' });
    }

    const { error } = await supabase
      .from('ratings')
      .upsert(
        { event_id: eventId, value, comment: comment || '' },
        { onConflict: 'event_id' }
      );

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[submitRating]', err);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
}

// POST /api/analytics
async function trackAnalytics(req, res) {
  try {
    const { eventId, clientId, action, metadata } = req.body;

    const { error } = await supabase.from('analytics_events').insert({
      event_id: eventId || null,
      client_id: clientId || null,
      action,
      metadata: metadata || {},
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[trackAnalytics]', err);
    res.status(500).json({ error: 'Failed to track analytics' });
  }
}

module.exports = { getDashboard, updateEventDetails, submitRating, trackAnalytics };
