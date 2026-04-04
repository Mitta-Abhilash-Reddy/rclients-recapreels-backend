const supabase = require('../config/supabaseClient');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, email, password_hash, role: 'creator', phone: phone || '' })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, phone: user.phone || '' },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

// GET /api/creator/events
async function getCreatorEvents(req, res) {
  try {
    const creatorId = req.user.id;

    const { data: assignments, error: aErr } = await supabase
      .from('creator_assignments')
      .select('event_id')
      .eq('creator_id', creatorId);

    if (aErr) throw aErr;

    const eventIds = assignments.map((a) => a.event_id);

    if (eventIds.length === 0) {
      return res.json([]);
    }

    const { data: events, error: eErr } = await supabase
      .from('events')
      .select('id, name, occasion_type, date, status, client_id, clients(name)')
      .in('id', eventIds)
      .order('date', { ascending: true });

    if (eErr) throw eErr;

    // Also fetch OTP status for each event
    const { data: otps } = await supabase
      .from('event_otps')
      .select('event_id, start_verified, end_verified, actual_start_time, actual_end_time')
      .in('event_id', eventIds);

    const otpMap = (otps || []).reduce((acc, o) => { acc[o.event_id] = o; return acc; }, {});

    const result = events.map((e) => ({
      id: String(e.id),
      name: e.name,
      occasionType: e.occasion_type || '',
      date: e.date,
      status: e.status,
      client: {
        id: String(e.client_id),
        name: e.clients?.name || '',
      },
      otpStatus: {
        startVerified: otpMap[e.id]?.start_verified || false,
        endVerified: otpMap[e.id]?.end_verified || false,
        actualStartTime: otpMap[e.id]?.actual_start_time || null,
        actualEndTime: otpMap[e.id]?.actual_end_time || null,
      },
    }));

    res.json(result);
  } catch (err) {
    console.error('[getCreatorEvents]', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

// POST /api/creator/upload
async function creatorUpload(req, res) {
  try {
    const creatorId = req.user.id;
    const { eventId, fileType } = req.body;

    if (!req.file || !eventId || !fileType) {
      return res.status(400).json({ error: 'file, eventId, fileType are required' });
    }

    // Validate creator is assigned to this event
    const { data: assignment, error: aErr } = await supabase
      .from('creator_assignments')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('event_id', eventId)
      .single();

    if (aErr || !assignment) {
      return res.status(403).json({ error: 'Not authorized for this event' });
    }

    const validTypes = ['reel', 'picture', 'raw'];
    if (!validTypes.includes(fileType)) {
      return res.status(400).json({ error: 'fileType must be reel, picture or raw' });
    }

    // Get client_id for storage path
    const { data: event, error: eErr } = await supabase
      .from('events')
      .select('client_id')
      .eq('id', eventId)
      .single();

    if (eErr || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const folder = fileType === 'reel' ? 'reels' : fileType === 'picture' ? 'pictures' : 'raw';
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${ext}`;
    const storagePath = `${event.client_id}/${eventId}/${folder}/${fileName}`;

    const url = await storageService.uploadFile(req.file.buffer, storagePath, req.file.mimetype);

    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .insert({
        event_id: eventId,
        name: req.file.originalname,
        file_type: fileType,
        url,
        storage_path: storagePath,
        size: req.file.size,
        thumbnail: '',
        uploaded_by: creatorId,
      })
      .select()
      .single();

    if (fileError) throw fileError;

    res.status(201).json({
      id: String(fileRecord.id),
      name: fileRecord.name,
      url: fileRecord.url,
      thumbnail: fileRecord.thumbnail,
      size: fileRecord.size,
      createdAt: fileRecord.created_at,
    });
  } catch (err) {
    console.error('[creatorUpload]', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

// POST /api/creator/otp
// Called by creator to verify OTP given by client at event start/end
async function submitOtp(req, res) {
  try {
    const creatorId = req.user.id;
    const { eventId, otpType, otpValue } = req.body;

    if (!eventId || !otpType || !otpValue) {
      return res.status(400).json({ error: 'eventId, otpType, and otpValue are required' });
    }

    if (!['start', 'end'].includes(otpType)) {
      return res.status(400).json({ error: 'otpType must be "start" or "end"' });
    }

    // Verify creator is assigned to this event
    const { data: assignment, error: aErr } = await supabase
      .from('creator_assignments')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('event_id', eventId)
      .single();

    if (aErr || !assignment) {
      return res.status(403).json({ error: 'Not authorized for this event' });
    }

    // Fetch the stored OTP record
    const { data: otpRecord, error: otpErr } = await supabase
      .from('event_otps')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (otpErr || !otpRecord) {
      return res.status(404).json({ error: 'OTP record not found for this event' });
    }

    const otpField = otpType === 'start' ? 'start_otp' : 'end_otp';
    const verifiedField = otpType === 'start' ? 'start_verified' : 'end_verified';
    const timeField = otpType === 'start' ? 'actual_start_time' : 'actual_end_time';

    // Check if already verified
    if (otpRecord[verifiedField]) {
      return res.status(400).json({
        error: `${otpType === 'start' ? 'Start' : 'End'} OTP already verified`,
        alreadyVerified: true,
      });
    }

    // Enforce order: can't submit end OTP before start OTP
    if (otpType === 'end' && !otpRecord.start_verified) {
      return res.status(400).json({ error: 'Please verify the Start OTP first' });
    }

    // Validate OTP value
    if (String(otpRecord[otpField]).trim() !== String(otpValue).trim()) {
      return res.status(400).json({ error: 'Incorrect OTP. Please check with your client.' });
    }

    const now = new Date().toISOString();

    // Mark verified + record actual time
    const { error: updateErr } = await supabase
      .from('event_otps')
      .update({
        [verifiedField]: true,
        [timeField]: now,
      })
      .eq('event_id', eventId);

    if (updateErr) throw updateErr;

    // Auto-update event status
    if (otpType === 'start') {
      await supabase
        .from('events')
        .update({ status: 'ONGOING' })
        .eq('id', eventId);
    } else {
      await supabase
        .from('events')
        .update({ status: 'COMPLETED' })
        .eq('id', eventId);
    }

    res.json({
      success: true,
      otpType,
      verifiedAt: now,
      message: otpType === 'start'
        ? `Event started at ${new Date(now).toLocaleTimeString('en-IN')}! Status set to ONGOING.`
        : `Event ended at ${new Date(now).toLocaleTimeString('en-IN')}! Status set to COMPLETED.`,
    });
  } catch (err) {
    console.error('[submitOtp]', err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
}

// GET /api/creator/otp-status/:eventId
// Creator can check current OTP verification status
async function getOtpStatus(req, res) {
  try {
    const creatorId = req.user.id;
    const { eventId } = req.params;

    const { data: assignment } = await supabase
      .from('creator_assignments')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('event_id', eventId)
      .single();

    if (!assignment) {
      return res.status(403).json({ error: 'Not authorized for this event' });
    }

    const { data: otpRecord, error } = await supabase
      .from('event_otps')
      .select('start_verified, end_verified, actual_start_time, actual_end_time')
      .eq('event_id', eventId)
      .single();

    if (error || !otpRecord) {
      return res.status(404).json({ error: 'OTP record not found' });
    }

    res.json({
      startVerified: otpRecord.start_verified || false,
      endVerified: otpRecord.end_verified || false,
      actualStartTime: otpRecord.actual_start_time || null,
      actualEndTime: otpRecord.actual_end_time || null,
    });
  } catch (err) {
    console.error('[getOtpStatus]', err);
    res.status(500).json({ error: 'Failed to fetch OTP status' });
  }
}

module.exports = { login, register, getCreatorEvents, creatorUpload, submitOtp, getOtpStatus };