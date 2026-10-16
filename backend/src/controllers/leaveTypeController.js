const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { clean, isValidId, checkLength } = require('../utils/Validators');

// Name 2 to 50 characters (the column allows 50), days a whole number from 0 to 365
const checkLeaveType = (name, totalDays) => {
  const nameProblem = checkLength('Leave type name', name, 2, 50);
  if (nameProblem) return nameProblem;

  const days = Number(totalDays);
  if (totalDays === undefined || totalDays === null || totalDays === '' ||
      !Number.isInteger(days) || days < 0 || days > 365) {
    return 'Total days must be a whole number from 0 to 365';
  }
  return null;
};

// Give every active employee a balance row for this leave type (skips existing ones)
const addBalancesForEmployees = async (leaveTypeId, totalDays) => {
  await pool.query(
    `INSERT INTO leave_balances (user_id, leave_type_id, total_days)
     SELECT id, $1::int, $2::int FROM users
     WHERE role = 'EMPLOYEE' AND is_active = true
     ON CONFLICT (user_id, leave_type_id) DO NOTHING`,
    [leaveTypeId, totalDays]
  );
};

// Everyone logged in: employees see active types, admin sees all
const getLeaveTypes = async (req, res, next) => {
  try {
    const sql =
      req.user.role === 'ADMIN'
        ? 'SELECT id, name, total_days, is_active FROM leave_types ORDER BY id'
        : 'SELECT id, name, total_days, is_active FROM leave_types WHERE is_active = true ORDER BY id';
    const result = await pool.query(sql);
    sendSuccess(res, 'Leave types fetched', result.rows);
  } catch (err) {
    next(err);
  }
};

// Admin adds a leave type
const createLeaveType = async (req, res, next) => {
  try {
    const { name, total_days } = req.body || {};

    const problem = checkLeaveType(name, total_days);
    if (problem) return sendError(res, problem, 400);

    const cleanName = clean(name);
    const exists = await pool.query(
      'SELECT id FROM leave_types WHERE LOWER(name) = LOWER($1)',
      [cleanName]
    );
    if (exists.rowCount > 0) {
      return sendError(res, 'Leave type already exists', 409);
    }

    const result = await pool.query(
      `INSERT INTO leave_types (name, total_days) VALUES ($1, $2)
       RETURNING id, name, total_days, is_active`,
      [cleanName, Number(total_days)]
    );
    const leaveType = result.rows[0];

    await addBalancesForEmployees(leaveType.id, leaveType.total_days);

    sendSuccess(res, 'Leave type added', leaveType, 201);
  } catch (err) {
    next(err);
  }
};

// Admin edits a leave type (name, days, and optionally is_active)
const updateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid leave type id', 400);

    const { name, total_days, is_active } = req.body || {};

    const problem = checkLeaveType(name, total_days);
    if (problem) return sendError(res, problem, 400);

    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return sendError(res, 'is_active must be true or false', 400);
    }

    const found = await pool.query('SELECT id FROM leave_types WHERE id = $1', [id]);
    if (found.rowCount === 0) return sendError(res, 'Leave type not found', 404);

    const cleanName = clean(name);
    const taken = await pool.query(
      'SELECT id FROM leave_types WHERE LOWER(name) = LOWER($1) AND id <> $2',
      [cleanName, id]
    );
    if (taken.rowCount > 0) {
      return sendError(res, 'Another leave type has this name', 409);
    }

    const result = await pool.query(
      `UPDATE leave_types
       SET name = $1, total_days = $2, is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING id, name, total_days, is_active`,
      [cleanName, Number(total_days), is_active ?? null, id]
    );
    const leaveType = result.rows[0];

    // Keep employee balances in step with the new total
    await pool.query(
      'UPDATE leave_balances SET total_days = $1 WHERE leave_type_id = $2',
      [leaveType.total_days, leaveType.id]
    );
    if (leaveType.is_active) {
      await addBalancesForEmployees(leaveType.id, leaveType.total_days);
    }

    sendSuccess(res, 'Leave type updated', leaveType);
  } catch (err) {
    next(err);
  }
};

// "Delete" = deactivate
const deactivateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid leave type id', 400);

    const result = await pool.query(
      `UPDATE leave_types SET is_active = false WHERE id = $1
       RETURNING id, name, is_active`,
      [id]
    );
    if (result.rowCount === 0) return sendError(res, 'Leave type not found', 404);

    sendSuccess(res, 'Leave type deactivated', result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deactivateLeaveType,
};