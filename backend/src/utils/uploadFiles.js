import fs from 'fs/promises';
import path from 'path';

/**
 * Helpers shared by the upload middlewares and the media controllers (DEC-034).
 *
 * Uploads are served back from the same site, so the extension a file is saved with decides how a
 * browser treats it. It is therefore taken from the file type that was checked, never from the
 * name the client typed: "evil.html" sent as an image is stored as ".png" and cannot run as a page.
 */
const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/ogg': '.ogv',
  'application/pdf': '.pdf',
};

/** Extension for a checked MIME type, or an empty string when the type is not on the list. */
export const safeExtension = (mimeType) => EXTENSION_BY_MIME[String(mimeType || '').toLowerCase()] || '';

/**
 * Media URLs a Warden may attach to a room. Only files this server stored itself are accepted,
 * so a room can never point students at another website or at a script.
 */
const ROOM_MEDIA_URL = /^\/uploads\/rooms\/(photos|videos)\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

export const isRoomMediaUrl = (value) => typeof value === 'string' && ROOM_MEDIA_URL.test(value) && !value.includes('..');

/** Delete files multer already wrote when the request is then refused (limits, scope, validation). */
export const removeUploadedFiles = async (files) => {
  const list = Array.isArray(files) ? files : Object.values(files || {}).flat();
  await Promise.all(
    list
      .map((file) => file?.path)
      .filter(Boolean)
      .map((filePath) => fs.unlink(path.resolve(filePath)).catch(() => {}))
  );
};
