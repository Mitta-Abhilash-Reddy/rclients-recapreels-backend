const supabase = require('../config/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');

// POST /api/admin/client
async function createClient(req, res) {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }

    const uniqueLinkId = uuidv4();

    const { data, error } = await supabase
      .from('clients')
      .insert({ name, phone, unique_link_id: uniqueLinkId, tnc_accepted: false })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: String(data.id),
      name: data.name,
      phone: data.phone,
      uniqueLinkId: data.unique_link_id,
    });
  } catch (err) {
    console.error('[createClient]', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
}

// POST /api/admin/event
async function createEvent(req, res) {
  try {
    const {
      clientId,
      name,
      occasionType,
      date,
      status,
      totalAmount,
      startTime,
      endTime,
      duration,
      poc,
      otp,
    } = req.body;

    if (!clientId || !name || !date) {
      return res.status(400).json({ error: 'clientId, name, and date are required' });
    }

    // Insert event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        client_id: clientId,
        name,
        occasion_type: occasionType || '',
        date,
        status: status || 'UPCOMING',
        total_amount: totalAmount || 0,
        start_time: startTime || null,
        end_time: endTime || null,
        duration: duration || null,
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // Insert POC if provided
    if (poc) {
      await supabase.from('event_poc').insert({
        event_id: event.id,
        name: poc.name || '',
        phone: poc.phone || '',
      });
    }

    // Insert OTP if provided
    if (otp) {
      await supabase.from('event_otps').insert({
        event_id: event.id,
        start_otp: otp.startOtp || '',
        end_otp: otp.endOtp || '',
      });
    }

    // Insert empty event_details
    await supabase.from('event_details').insert({
      event_id: event.id,
      description: '',
      music_preferences: '',
      location_link: '',
      client_poc_name: '',
      client_poc_phone: '',
    });

    res.status(201).json({ id: String(event.id), name: event.name });
  } catch (err) {
    console.error('[createEvent]', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
}

// DELETE /api/admin/event/:id
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[deleteEvent]', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
}

// POST /api/admin/assign-creator
async function assignCreator(req, res) {
  try {
    const { creatorId, eventId } = req.body;

    if (!creatorId || !eventId) {
      return res.status(400).json({ error: 'creatorId and eventId are required' });
    }

    const { error } = await supabase
      .from('creator_assignments')
      .upsert({ creator_id: creatorId, event_id: eventId }, { onConflict: 'creator_id,event_id' });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[assignCreator]', err);
    res.status(500).json({ error: 'Failed to assign creator' });
  }
}

// POST /api/admin/upload
async function adminUpload(req, res) {
  try {
    const { clientId, eventId, fileType } = req.body;

    if (!req.file || !clientId || !eventId || !fileType) {
      return res.status(400).json({ error: 'file, clientId, eventId, fileType are required' });
    }

    const validTypes = ['reel', 'picture', 'raw'];
    if (!validTypes.includes(fileType)) {
      return res.status(400).json({ error: `fileType must be one of: ${validTypes.join(', ')}` });
    }

    const folder = fileType === 'reel' ? 'reels' : fileType === 'picture' ? 'pictures' : 'raw';
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${ext}`;
    const storagePath = `${clientId}/${eventId}/${folder}/${fileName}`;

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
    console.error('[adminUpload]', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

// DELETE /api/admin/file/:id
async function deleteFile(req, res) {
  try {
    const { id } = req.params;

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await storageService.deleteFile(file.storage_path);

    const { error: deleteError } = await supabase.from('files').delete().eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (err) {
    console.error('[deleteFile]', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

// POST /api/admin/payment
async function addPayment(req, res) {
  try {
    const { eventId, amount, method, status } = req.body;

    if (!eventId || !amount || !method) {
      return res.status(400).json({ error: 'eventId, amount, and method are required' });
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        event_id: eventId,
        amount: Number(amount),
        method,
        status: status || 'PAID',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: String(payment.id),
      amount: Number(payment.amount),
      method: payment.method,
      status: payment.status,
      createdAt: payment.created_at,
    });
  } catch (err) {
    console.error('[addPayment]', err);
    res.status(500).json({ error: 'Failed to add payment' });
  }
}

// GET /api/admin/clients
async function getClients(req, res) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, phone, unique_link_id, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      uniqueLinkId: c.unique_link_id,
      createdAt: c.created_at,
    })));
  } catch (err) {
    console.error('[getClients]', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
}

// GET /api/admin/creators
async function getCreators(req, res) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('role', 'creator')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.created_at,
    })));
  } catch (err) {
    console.error('[getCreators]', err);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
}

// GET /api/admin/events
async function getEvents(req, res) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, date, status, occasion_type, total_amount, client_id, clients(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data.map(e => ({
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status,
      occasionType: e.occasion_type || '',
      totalAmount: Number(e.total_amount || 0),
      clientId: e.client_id,
      clientName: e.clients?.name || '',
    })));
  } catch (err) {
    console.error('[getEvents]', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

module.exports = {
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
};
