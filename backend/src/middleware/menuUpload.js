import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ApiError from '../utils/ApiError.js';

// Dedicated secure directory for incoming menu timetable uploads
const menuUploadDir = path.join(process.cwd(), 'uploads', 'menus');
if (!fs.existsSync(menuUploadDir)) {
  fs.mkdirSync(menuUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, menuUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `menu-upload-${uniqueSuffix}${ext}`);
  },
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (allowedMimeTypes.includes(mime) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        'Unsupported file format. Please upload a JPG, JPEG, PNG image or a PDF document.'
      ),
      false
    );
  }
};

export const menuUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1,
  },
}).single('menuFile');

export const handleMenuUpload = (req, res, next) => {
  menuUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          ApiError.badRequest(
            'File is too large. Maximum allowed size is 10MB.'
          )
        );
      }
      return next(ApiError.badRequest(`File upload error: ${err.message}`));
    } else if (err) {
      return next(err);
    }
    next();
  });
};
