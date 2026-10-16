const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const uploadsDir = path.join(__dirname, '../../uploads');

// Full path of a stored file, or null if it would leave the uploads folder
const diskPath = (relative) => {
  const full = path.resolve(uploadsDir, relative);
  return full.startsWith(uploadsDir + path.sep) ? full : null;
};

// Check the first bytes of the file: a real PNG or JPEG starts with a fixed signature
const looksLikeImage = (filePath, ext) => {
  const buf = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buf, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (ext === '.png') {
    return buf.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff; // JPEG
};

// Upload or change my photo
const savePhoto = async (req, res, next) => {
  const file = req.file;
  try {
    if (!file) return sendError(res, 'Please choose a photo', 400);

    const ext = path.extname(file.filename).toLowerCase();
    if (!looksLikeImage(file.path, ext)) {
      fs.unlink(file.path, () => {});
      return sendError(res, 'This file is not a valid JPG or PNG image', 400);
    }

    const old = await pool.query('SELECT photo_path FROM users WHERE id = $1', [req.user.id]);
    await pool.query('UPDATE users SET photo_path = $1 WHERE id = $2', [
      `profiles/${file.filename}`,
      req.user.id,
    ]);

    // The new photo is saved, so the old file can go
    const oldRel = old.rows[0] && old.rows[0].photo_path;
    const oldFull = oldRel && diskPath(oldRel);
    if (oldFull) fs.unlink(oldFull, () => {});

    sendSuccess(res, 'Profile photo updated', { has_photo: true });
  } catch (err) {
    if (file) fs.unlink(file.path, () => {});
    next(err);
  }
};

// Send my photo (the cookie decides whose photo it is)
const getPhoto = async (req, res, next) => {
  try {
    const r = await pool.query('SELECT photo_path FROM users WHERE id = $1', [req.user.id]);
    const rel = r.rows[0] && r.rows[0].photo_path;
    const full = rel && diskPath(rel);
    if (!full || !fs.existsSync(full)) return sendError(res, 'No profile photo', 404);

    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(full, { etag: false, lastModified: false, dotfiles: 'allow' });
  } catch (err) {
    next(err);
  }
};

// Remove my photo
const removePhoto = async (req, res, next) => {
  try {
    const r = await pool.query('SELECT photo_path FROM users WHERE id = $1', [req.user.id]);
    const rel = r.rows[0] && r.rows[0].photo_path;
    if (!rel) return sendError(res, 'You have no profile photo', 404);

    await pool.query('UPDATE users SET photo_path = NULL WHERE id = $1', [req.user.id]);
    const full = diskPath(rel);
    if (full) fs.unlink(full, () => {});

    sendSuccess(res, 'Profile photo removed', { has_photo: false });
  } catch (err) {
    next(err);
  }
};

module.exports = { savePhoto, getPhoto, removePhoto };