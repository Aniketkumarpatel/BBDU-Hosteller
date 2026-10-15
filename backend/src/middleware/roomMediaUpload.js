import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ApiError from '../utils/ApiError.js';
import { safeExtension } from '../utils/uploadFiles.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseUploads = path.resolve(__dirname, '../../uploads');

const photosDir = path.join(baseUploads, 'rooms', 'photos');
const videosDir = path.join(baseUploads, 'rooms', 'videos');

if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'video' || file.fieldname === 'videos') {
      cb(null, videosDir);
    } else {
      cb(null, photosDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // The extension comes from the checked file type, never from the client's file name (DEC-034)
    const ext = safeExtension(file.mimetype);
    const isVid = file.fieldname === 'video' || file.fieldname === 'videos';
    const prefix = isVid ? 'room-video' : 'room-photo';
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

const allowedImageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const allowedVideoMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];

const fileFilter = (_req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();
  if (file.fieldname === 'video' || file.fieldname === 'videos') {
    if (allowedVideoMimes.includes(mime)) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest('Please upload valid video format (MP4, WebM, MOV).'), false);
    }
  } else {
    if (allowedImageMimes.includes(mime)) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest('Please upload valid photo format (JPG, JPEG, PNG, WEBP).'), false);
    }
  }
};

export const roomMediaUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 40 * 1024 * 1024, // 40MB limit for short videos, photos
  },
}).fields([
  { name: 'photos', maxCount: 6 },
  { name: 'photo', maxCount: 6 },
  { name: 'videos', maxCount: 2 },
  { name: 'video', maxCount: 2 },
  { name: 'panorama', maxCount: 1 },
]);

export const handleRoomMediaUpload = (req, res, next) => {
  roomMediaUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('File size exceeds the 40MB limit. Please upload shorter videos or smaller images.'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(ApiError.badRequest('Too many files uploaded. Max 6 photos and 2 short videos allowed.'));
      }
      return next(ApiError.badRequest(`Upload error: ${err.message}`));
    } else if (err) {
      return next(err);
    }
    next();
  });
};
