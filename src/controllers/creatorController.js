const supabase = require('../config/supabaseClient');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

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
      .insert({ name, email, password_hash, role: 'creator' })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
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
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
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

    const folder = fileType === 'picture' ? 'pictures' : 'raw';
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

module.exports = { login, register, getCreatorEvents, creatorUpload };
