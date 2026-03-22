const supabase = require('../config/supabaseClient');

// GET /api/files/:eventId — list files for an event grouped by type
async function getEventFiles(req, res) {
  try {
    const { eventId } = req.params;

    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reels = files.filter((f) => f.file_type === 'reel').map(toFileItem);
    const pictures = files.filter((f) => f.file_type === 'picture').map(toFileItem);
    const raw = files.filter((f) => f.file_type === 'raw').map(toFileItem);

    res.json({ reels, pictures, raw });
  } catch (err) {
    console.error('[getEventFiles]', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
}

function toFileItem(f) {
  return {
    id: String(f.id),
    name: f.name,
    url: f.url,
    thumbnail: f.thumbnail || '',
    size: Number(f.size || 0),
    createdAt: f.created_at,
  };
}

module.exports = { getEventFiles };
