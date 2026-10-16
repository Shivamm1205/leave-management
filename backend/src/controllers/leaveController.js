const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const calcDays = require('../utils/calcDays');
const {
  clean, isValidId, isValidDate, todayStr, checkLength, VALID_STATUSES,
} = require('../utils/Validators');

// Reused query: leave + employee name + leave type name
const SELECT_LEAVE = `
  SELECT l.id, u.name AS employee, u.department, lt.name AS leave_type,
         to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
         l.total_days, l.reason, l.status, l.rejection_reason
  FROM leaves l
  JOIN users u ON u.id = l.user_id
  JOIN leave_types lt ON lt.id = l.leave_type_id`;

// Employee: apply for leave (nothing is deducted here)
const applyLeave = async (req, res, next) => {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body || {};

    if (!isValidId(leave_type_id)) {
      return sendError(res, 'Please select a leave type', 400);
    }
    if (!start_date || !end_date) {
      return sendError(res, 'Start date and end date are required', 400);
    }
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return sendError(res, 'Dates must be in YYYY-MM-DD format', 400);
    }
    // No back dates: the leave cannot start before today
    if (start_date < todayStr()) {
      return sendError(res, 'Start date cannot be in the past', 400);
    }
    if (end_date < start_date) {
      return sendError(res, 'End date cannot be before start date', 400);
    }

    const reasonProblem = checkLength('Reason', reason, 3, 500);
    if (reasonProblem) return sendError(res, reasonProblem, 400);

    const days = calcDays(start_date, end_date);
    if (days > 365) {
      return sendError(res, 'A leave cannot be longer than 365 days', 400);
    }

    // Documents uploaded earlier (optional): must be this user's unused files
    let attachmentIds = [];
    const ids = req.body.attachment_ids;
    if (ids !== undefined) {
      if (!Array.isArray(ids) || ids.length > 5 || !ids.every(isValidId)) {
        return sendError(res, 'Invalid attachments', 400);
      }
      attachmentIds = [...new Set(ids.map(Number))];
      if (attachmentIds.length > 0) {
        const own = await pool.query(
          `SELECT COUNT(*)::int AS n FROM attachments
           WHERE id = ANY($1::int[]) AND user_id = $2 AND leave_id IS NULL`,
          [attachmentIds, req.user.id]
        );
        if (own.rows[0].n !== attachmentIds.length) {
          return sendError(res, 'One or more files are not available. Please upload them again', 400);
        }
      }
    }

    // No overlap with a PENDING or APPROVED leave of this user
    const clash = await pool.query(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date, status
       FROM leaves
       WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED')
         AND start_date <= $3 AND end_date >= $2
       LIMIT 1`,
      [req.user.id, start_date, end_date]
    );
    if (clash.rowCount > 0) {
      const c = clash.rows[0];
      return sendError(
        res,
        `You already have a ${c.status} leave from ${c.start_date} to ${c.end_date} that overlaps these dates`,
        409
      );
    }

    const bal = await pool.query(
      `SELECT (b.total_days - b.used_days) AS remaining
       FROM leave_balances b
       JOIN leave_types lt ON lt.id = b.leave_type_id
       WHERE b.user_id = $1 AND b.leave_type_id = $2 AND lt.is_active = true`,
      [req.user.id, leave_type_id]
    );
    if (bal.rowCount === 0) return sendError(res, 'Leave type not available', 404);
    if (days > bal.rows[0].remaining) {
      return sendError(res, `Only ${bal.rows[0].remaining} day(s) left for this leave type`, 400);
    }

    const result = await pool.query(
      `INSERT INTO leaves (user_id, leave_type_id, start_date, end_date, total_days, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.id, leave_type_id, start_date, end_date, days, clean(reason)]
    );
    const leaveId = result.rows[0].id;

    // Link the uploaded files to this leave
    if (attachmentIds.length > 0) {
      await pool.query(
        `UPDATE attachments SET leave_id = $1
         WHERE id = ANY($2::int[]) AND user_id = $3 AND leave_id IS NULL`,
        [leaveId, attachmentIds, req.user.id]
      );
    }

    sendSuccess(res, 'Leave applied', { id: leaveId, total_days: days }, 201);
  } catch (err) {
    next(err);
  }
};

// Employee: only my own leaves (user_id comes from the token)
const getMyLeaves = async (req, res, next) => {
  try {
    const result = await pool.query(
      `${SELECT_LEAVE} WHERE l.user_id = $1 ORDER BY l.id DESC`,
      [req.user.id]
    );
    sendSuccess(res, 'Leaves fetched', result.rows);
  } catch (err) {
    next(err);
  }
};

// Employee: remaining days per leave type
const getBalance = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT lt.name AS leave_type, b.total_days, b.used_days,
              (b.total_days - b.used_days) AS remaining
       FROM leave_balances b
       JOIN leave_types lt ON lt.id = b.leave_type_id
       WHERE b.user_id = $1 AND lt.is_active = true
       ORDER BY lt.id`,
      [req.user.id]
    );
    sendSuccess(res, 'Balance fetched', result.rows);
  } catch (err) {
    next(err);
  }
};

// Employee: cancel own leave, only if PENDING
const cancelLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid leave id', 400);

    const result = await pool.query(
      `UPDATE leaves SET status = 'CANCELLED'
       WHERE id = $1 AND user_id = $2 AND status = 'PENDING' RETURNING id`,
      [id, req.user.id]
    );
    if (result.rowCount === 0) {
      return sendError(res, 'Pending leave not found', 404);
    }
    sendSuccess(res, 'Leave cancelled');
  } catch (err) {
    next(err);
  }
};

// Admin: all leaves, optional ?status=PENDING
const getAllLeaves = async (req, res, next) => {
  try {
    const status = clean(req.query.status).toUpperCase();
    const values = [];
    let where = '';
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return sendError(res, 'Status must be PENDING, APPROVED, REJECTED or CANCELLED', 400);
      }
      values.push(status);
      where = 'WHERE l.status = $1';
    }
    const result = await pool.query(`${SELECT_LEAVE} ${where} ORDER BY l.id DESC`, values);
    sendSuccess(res, 'Leaves fetched', result.rows);
  } catch (err) {
    next(err);
  }
};

// Admin: approve (balance is deducted ONLY here)
const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid leave id', 400);

    const found = await pool.query('SELECT * FROM leaves WHERE id = $1', [id]);
    if (found.rowCount === 0) return sendError(res, 'Leave not found', 404);
    const leave = found.rows[0];
    if (leave.status !== 'PENDING') {
      return sendError(res, 'Only a PENDING leave can be approved', 400);
    }

    const bal = await pool.query(
      `SELECT (total_days - used_days) AS remaining FROM leave_balances
       WHERE user_id = $1 AND leave_type_id = $2`,
      [leave.user_id, leave.leave_type_id]
    );
    if (bal.rowCount === 0 || bal.rows[0].remaining < leave.total_days) {
      return sendError(res, 'Employee does not have enough balance', 400);
    }

    await pool.query(
      "UPDATE leaves SET status = 'APPROVED' WHERE id = $1 AND status = 'PENDING'",
      [id]
    );
    await pool.query(
      `UPDATE leave_balances SET used_days = used_days + $1
       WHERE user_id = $2 AND leave_type_id = $3`,
      [leave.total_days, leave.user_id, leave.leave_type_id]
    );
    sendSuccess(res, 'Leave approved');
  } catch (err) {
    next(err);
  }
};

// Admin: reject (reason required, balance unchanged)
const rejectLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!isValidId(id)) return sendError(res, 'Invalid leave id', 400);

       const problem = checkLength('Rejection reason', reason, 3, 500, true);
    if (problem) return sendError(res, problem, 400);

    const found = await pool.query('SELECT status FROM leaves WHERE id = $1', [id]);
    if (found.rowCount === 0) return sendError(res, 'Leave not found', 404);
    if (found.rows[0].status !== 'PENDING') {
      return sendError(res, 'Only a PENDING leave can be rejected', 400);
    }

    await pool.query(
      "UPDATE leaves SET status = 'REJECTED', rejection_reason = $1 WHERE id = $2",
      [clean(reason), id]
    );
    sendSuccess(res, 'Leave rejected');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  applyLeave, getMyLeaves, getBalance, cancelLeave,
  getAllLeaves, approveLeave, rejectLeave,
};