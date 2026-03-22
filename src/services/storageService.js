const supabase = require('../config/supabaseClient');

const BUCKET = 'recapreels';

/**
 * Upload a file buffer to Supabase Storage
 * @param {Buffer} fileBuffer
 * @param {string} path - e.g. "clientId/eventId/reels/filename.mp4"
 * @param {string} mimeType
 * @returns {Promise<string>} public URL
 */
async function uploadFile(fileBuffer, path, mimeType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return getPublicUrl(path);
}

/**
 * Delete a file from Supabase Storage
 * @param {string} path
 */
async function deleteFile(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

/**
 * Get public URL for a stored file
 * @param {string} path
 * @returns {string}
 */
function getPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { uploadFile, deleteFile, getPublicUrl };
