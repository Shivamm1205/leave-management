const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sendError } = require('../utils/response');

// Documents are saved in uploads/documents
const docsDir = path.join(__dirname, '../../uploads/documents');
fs.mkdirSync(docsDir, { recursive: true });

// Allowed extension -> allowed MIME types (both must match)
const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docsDir),
  // Unique name: time + random text + original extension
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5 MB each, max 5 files
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimes = ALLOWED[ext];
    if (mimes && mimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('INVALID_TYPE'));
  },
});

// Wrapper so upload errors come back in our standard JSON format
const uploadFiles = (req, res, next) => {
  upload.array('files', 5)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return sendError(res, 'Each file must be 5 MB or less', 400);
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return sendError(res, 'You can upload at most 5 files at a time', 400);
    }
    if (err.message === 'INVALID_TYPE') {
      return sendError(res, 'Only PDF, DOC, DOCX, JPG, JPEG and PNG files are allowed', 400);
    }
    return sendError(res, 'File upload failed', 400);
  });
};

module.exports = uploadFiles;