const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { isValidId } = require('../utils/Validators');

const uploadsDir = path.join(__dirname, '../../uploads');
const MAX_FILES = 5;

// Delete files from disk (used when something fails after Multer saved them)
const removeFiles = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

// Full path of a stored file. New rows use file_path, old rows use stored_name.
// Returns null if the path would leave the uploads folder.
const diskPath = (row) => {
  const full = path.resolve(uploadsDir, row.file_path || row.stored_name);
  return full.startsWith(uploadsDir + path.sep) ? full : null;
};

// Save the file details in the database (the file itself is already on disk)
const saveFiles = async (files, userId, leaveId) => {
  const saved = [];
  for (const f of files) {
    const r = await pool.query(
      `INSERT INTO attachments (leave_id, user_id, original_name, stored_name, file_path, file_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, original_name, file_type, file_size`,
      [leaveId, userId, f.originalname, f.filename, `documents/${f.filename}`, f.mimetype, f.size]
    );
    saved.push(r.rows[0]);
  }
  return saved;
};

// Employee: upload files BEFORE applying (a "draft": not linked to a leave yet)
const uploadDrafts = async (req, res, next) => {
  const files = req.files || [];
  try {
    if (files.length === 0) return sendError(res, 'Please choose at least one file', 400);

    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM attachments WHERE user_id = $1 AND leave_id IS NULL',
      [req.user.id]
    );
    if (count.rows[0].n + files.length > MAX_FILES) {
      removeFiles(files);
      return sendError(res, `You can attach at most ${MAX_FILES} files to a leave`, 400);
    }

    const saved = await saveFiles(files, req.user.id, null);
    sendSuccess(res, 'Files uploaded', saved, 201);
  } catch (err) {
    removeFiles(files);
    next(err);
  }
};

// Employee: my uploaded files that are not used in any leave yet
const listDrafts = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, original_name, file_type, file_size
       FROM attachments WHERE user_id = $1 AND leave_id IS NULL ORDER BY id`,
      [req.user.id]
    );
    sendSuccess(res, 'Files fetched', result.rows);
  } catch (err) {
    next(err);
  }
};

// Employee: add files to an existing leave, only while it is PENDING
const uploadAttachments = async (req, res, next) => {
  const files = req.files || [];
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      removeFiles(files);
      return sendError(res, 'Invalid leave id', 400);
    }
    if (files.length === 0) return sendError(res, 'Please choose at least one file', 400);

    // Privacy: the leave must belong to the logged-in user
    const leave = await pool.query(
      'SELECT status FROM leaves WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (leave.rowCount === 0) {
      removeFiles(files);
      return sendError(res, 'Leave not found', 404);
    }
    if (leave.rows[0].status !== 'PENDING') {
      removeFiles(files);
      return sendError(res, 'Files can be added only while the leave is PENDING', 400);
    }

    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM attachments WHERE leave_id = $1',
      [id]
    );
    if (count.rows[0].n + files.length > MAX_FILES) {
      removeFiles(files);
      return sendError(res, `A leave can have at most ${MAX_FILES} files`, 400);
    }

    const saved = await saveFiles(files, req.user.id, id);
    sendSuccess(res, 'Files uploaded', saved, 201);
  } catch (err) {
    removeFiles(files);
    next(err);
  }
};

// List files of a leave (owner or admin)
const listAttachments = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid leave id', 400);

    const leave = await pool.query('SELECT user_id FROM leaves WHERE id = $1', [id]);
    if (
      leave.rowCount === 0 ||
      (req.user.role !== 'ADMIN' && leave.rows[0].user_id !== req.user.id)
    ) {
      return sendError(res, 'Leave not found', 404);
    }

    const result = await pool.query(
      `SELECT id, original_name, file_type, file_size, uploaded_at
       FROM attachments WHERE leave_id = $1 ORDER BY id`,
      [id]
    );
    sendSuccess(res, 'Files fetched', result.rows);
  } catch (err) {
    next(err);
  }
};

// Download one file. Owner: any of their files. Admin: only files attached to a leave.
const downloadAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid file id', 400);

    const result = await pool.query(
      `SELECT a.leave_id, a.original_name, a.stored_name, a.file_path,
              COALESCE(a.user_id, l.user_id) AS owner_id
       FROM attachments a LEFT JOIN leaves l ON l.id = a.leave_id
       WHERE a.id = $1`,
      [id]
    );
    const row = result.rows[0];
    const allowed =
      row && (row.owner_id === req.user.id || (req.user.role === 'ADMIN' && row.leave_id !== null));
    if (!allowed) return sendError(res, 'File not found', 404);

    const filePath = diskPath(row);
    if (!filePath || !fs.existsSync(filePath)) return sendError(res, 'File missing on server', 404);

    res.download(filePath, row.original_name);
  } catch (err) {
    next(err);
  }
};

// Delete one file: only the owner, and only while it is a draft or the leave is PENDING
const deleteAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid file id', 400);

    const result = await pool.query(
      `SELECT a.leave_id, a.stored_name, a.file_path, l.status,
              COALESCE(a.user_id, l.user_id) AS owner_id
       FROM attachments a LEFT JOIN leaves l ON l.id = a.leave_id
       WHERE a.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row || row.owner_id !== req.user.id) return sendError(res, 'File not found', 404);

    if (row.leave_id !== null && row.status !== 'PENDING') {
      return sendError(res, 'Files can be removed only while the leave is PENDING', 400);
    }

    await pool.query('DELETE FROM attachments WHERE id = $1', [id]);
    const filePath = diskPath(row);
    if (filePath) fs.unlink(filePath, () => {});
    sendSuccess(res, 'File deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadDrafts, listDrafts, uploadAttachments, listAttachments, downloadAttachment, deleteAttachment,
};