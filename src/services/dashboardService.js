const supabase = require('../config/supabaseClient');

/**
 * Build the full DashboardResponse for a given unique_link_id
 */
async function getDashboardByUniqueLink(uniqueLinkId) {
  // 1. Fetch client by unique_link_id
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, phone, tnc_accepted, unique_link_id')
    .eq('unique_link_id', uniqueLinkId)
    .single();

  if (clientError || !client) {
    throw new Error('Client not found');
  }

  // 2. Fetch all events for this client
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('client_id', client.id)
    .order('date', { ascending: true });

  if (eventsError) throw new Error('Failed to fetch events');

  const eventIds = events.map((e) => e.id);

  // 3. Batch fetch related data for all events
  const [detailsRes, pocRes, otpRes, paymentsRes, filesRes, ratingsRes] =
    await Promise.all([
      supabase
        .from('event_details')
        .select('*')
        .in('event_id', eventIds),
      supabase
        .from('event_poc')
        .select('*')
        .in('event_id', eventIds),
      supabase
        .from('event_otps')
        .select('*')
        .in('event_id', eventIds),
      supabase
        .from('payments')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('files')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('ratings')
        .select('*')
        .in('event_id', eventIds),
    ]);

  if (detailsRes.error) throw new Error('Failed to fetch event details');
  if (pocRes.error) throw new Error('Failed to fetch POC data');
  if (otpRes.error) throw new Error('Failed to fetch OTP data');
  if (paymentsRes.error) throw new Error('Failed to fetch payments');
  if (filesRes.error) throw new Error('Failed to fetch files');
  if (ratingsRes.error) throw new Error('Failed to fetch ratings');

  // Index by event_id for O(1) lookup
  const detailsByEvent = indexBy(detailsRes.data, 'event_id');
  const pocByEvent = indexBy(pocRes.data, 'event_id');
  const otpByEvent = indexBy(otpRes.data, 'event_id');
  const ratingsByEvent = indexBy(ratingsRes.data, 'event_id');

  // Group payments and files by event_id
  const paymentsByEvent = groupBy(paymentsRes.data, 'event_id');
  const filesByEvent = groupBy(filesRes.data, 'event_id');

  // 4. Transform events into full contract shape
  const eventsFull = events.map((event) => {
    const details = detailsByEvent[event.id] || {};
    const poc = pocByEvent[event.id] || {};
    const otp = otpByEvent[event.id] || {};
    const rating = ratingsByEvent[event.id] || {};
    const eventPayments = paymentsByEvent[event.id] || [];
    const eventFiles = filesByEvent[event.id] || [];

    const paid = eventPayments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const total = Number(event.total_amount || 0);
    const due = total - paid;

    const reels = eventFiles.filter((f) => f.file_type === 'reel').map(toFileItem);
    const pictures = eventFiles.filter((f) => f.file_type === 'picture').map(toFileItem);
    const raw = eventFiles.filter((f) => f.file_type === 'raw').map(toFileItem);

    return {
      id: String(event.id),
      name: event.name,
      occasionType: event.occasion_type || '',
      date: event.date,
      status: event.status,

      poc: {
        name: poc.name || '',
        phone: poc.phone || '',
      },

      otp: {
        startOtp: otp.start_otp || '',
        endOtp: otp.end_otp || '',
      },

      details: {
        description: details.description || '',
        musicPreferences: details.music_preferences || '',
        locationLink: details.location_link || '',
        clientPoc: {
          name: details.client_poc_name || '',
          phone: details.client_poc_phone || '',
        },
      },

      payments: {
        total,
        paid,
        due,
        history: eventPayments.map((p) => ({
          id: String(p.id),
          amount: Number(p.amount),
          method: p.method,
          status: p.status,
          createdAt: p.created_at,
        })),
      },

      files: { reels, pictures, raw },

      meta: {
        startTime: event.start_time || '',
        endTime: event.end_time || '',
        duration: event.duration || '',
      },

      rating: {
        value: rating.value || 0,
        comment: rating.comment || '',
      },
    };
  });

  return {
    client: {
      id: String(client.id),
      name: client.name,
      phone: client.phone,
      tncAccepted: Boolean(client.tnc_accepted),
    },
    events: events.map((e) => ({
      id: String(e.id),
      name: e.name,
      date: e.date,
      status: e.status,
    })),
    eventsFull,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function indexBy(arr, key) {
  return (arr || []).reduce((acc, item) => {
    acc[item[key]] = item;
    return acc;
  }, {});
}

function groupBy(arr, key) {
  return (arr || []).reduce((acc, item) => {
    if (!acc[item[key]]) acc[item[key]] = [];
    acc[item[key]].push(item);
    return acc;
  }, {});
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

module.exports = { getDashboardByUniqueLink };
