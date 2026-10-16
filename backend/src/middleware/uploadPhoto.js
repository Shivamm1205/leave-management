const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sendError } = require('../utils/response');

// Profile photos are saved in uploads/profiles
const photosDir = path.join(__dirname, '../../uploads/profiles');
fs.mkdirSync(photosDir, { recursive: true });

// Allowed extension -> allowed MIME type (both must match)
const ALLOWED = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  // Unique name: time + random text + original extension
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2 MB, one photo
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimes = ALLOWED[ext];
    if (mimes && mimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('INVALID_TYPE'));
  },
});

// Wrapper so upload errors come back in our standard JSON format
const uploadPhoto = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return sendError(res, 'Photo must be 2 MB or less', 400);
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return sendError(res, 'Please upload one photo', 400);
    if (err.message === 'INVALID_TYPE') {
      return sendError(res, 'Only JPG, JPEG and PNG photos are allowed', 400);
    }
    return sendError(res, 'Photo upload failed', 400);
  });
};

module.exports = uploadPhoto;