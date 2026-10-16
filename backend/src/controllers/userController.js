const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const {
  clean, cleanEmail, isValidId,
  checkName, checkEmail, checkPassword, checkPhone, checkDepartment, firstError,
} = require('../utils/Validators');

// Make %, _ and \ in the search text match themselves instead of acting as wildcards
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// ---------- Profile (logged-in user) ----------

const getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
            'SELECT id, name, email, role, department, phone, (photo_path IS NOT NULL) AS has_photo FROM users WHERE id = $1',
      [req.user.id]
    );
    sendSuccess(res, 'Profile fetched', result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const { name, department, phone } = req.body || {};

    const problem = firstError(checkName(name), checkPhone(phone), checkDepartment(department));
    if (problem) return sendError(res, problem, 400);

    const result = await pool.query(
           `UPDATE users SET name = $1, department = $2, phone = $3
       WHERE id = $4
       RETURNING id, name, email, role, department, phone, (photo_path IS NOT NULL) AS has_photo`,
      [clean(name), clean(department) || null, clean(phone) || null, req.user.id]
    );
    sendSuccess(res, 'Profile updated', result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ---------- Employee management (admin only) ----------

// List employees with search, department filter and pagination
const getEmployees = async (req, res, next) => {
  try {
    const search = clean(req.query.search);
    const department = clean(req.query.department);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;

    if (search.length > 100 || department.length > 100) {
      return sendError(res, 'Search text is too long', 400);
    }

    // Build the WHERE part step by step; values always go in the array
    const conditions = ["role = 'EMPLOYEE'"];
    const values = [];

    if (search) {
      values.push(`%${escapeLike(search)}%`);
      conditions.push(`(name ILIKE $${values.length} OR email ILIKE $${values.length})`);
    }
    if (department) {
      values.push(department);
      conditions.push(`department = $${values.length}`);
    }
    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT id, name, email, department, phone, is_active,
              to_char(created_at, 'YYYY-MM-DD') AS joined
       FROM users WHERE ${where}
       ORDER BY id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    sendSuccess(res, 'Employees fetched', {
      employees: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// Departments that exist, for the filter dropdown
const getDepartments = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT department FROM users
       WHERE role = 'EMPLOYEE' AND department IS NOT NULL AND department <> ''
       ORDER BY department`
    );
    sendSuccess(res, 'Departments fetched', result.rows.map((r) => r.department));
  } catch (err) {
    next(err);
  }
};

// Admin adds an employee
const createEmployee = async (req, res, next) => {
  try {
    const { name, password, department, phone } = req.body || {};
    const email = cleanEmail(req.body && req.body.email);

    const problem = firstError(
      checkName(name),
      checkEmail(email),
      checkPassword(password),
      checkPhone(phone),
      checkDepartment(department)
    );
    if (problem) return sendError(res, problem, 400);

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      return sendError(res, 'Email already registered', 409);
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, department, phone)
       VALUES ($1, $2, $3, 'EMPLOYEE', $4, $5)
       RETURNING id, name, email, role, department, phone, is_active`,
      [clean(name), email, hashed, clean(department) || null, clean(phone) || null]
    );
    const user = result.rows[0];

    await pool.query(
      `INSERT INTO leave_balances (user_id, leave_type_id, total_days)
       SELECT $1::int, id, total_days FROM leave_types WHERE is_active = true`,
      [user.id]
    );

    sendSuccess(res, 'Employee added', user, 201);
  } catch (err) {
    next(err);
  }
};

// Admin edits an employee (can also reactivate with is_active: true)
const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid employee id', 400);

    const { name, department, phone, is_active } = req.body || {};
    const email = cleanEmail(req.body && req.body.email);

    const problem = firstError(
      checkName(name),
      checkEmail(email),
      checkPhone(phone),
      checkDepartment(department)
    );
    if (problem) return sendError(res, problem, 400);

    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return sendError(res, 'is_active must be true or false', 400);
    }

    const found = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'EMPLOYEE'",
      [id]
    );
    if (found.rowCount === 0) return sendError(res, 'Employee not found', 404);

    // Email must not belong to someone else
    const taken = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [email, id]
    );
    if (taken.rowCount > 0) return sendError(res, 'Email already in use', 409);

    const result = await pool.query(
      `UPDATE users
       SET name = $1, email = $2, department = $3, phone = $4,
           is_active = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING id, name, email, department, phone, is_active`,
      [clean(name), email, clean(department) || null, clean(phone) || null, is_active ?? null, id]
    );
    sendSuccess(res, 'Employee updated', result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// "Delete" = deactivate. The row stays in the database.
const deactivateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendError(res, 'Invalid employee id', 400);

    const result = await pool.query(
      `UPDATE users SET is_active = false
       WHERE id = $1 AND role = 'EMPLOYEE'
       RETURNING id, name, is_active`,
      [id]
    );
    if (result.rowCount === 0) return sendError(res, 'Employee not found', 404);

    sendSuccess(res, 'Employee deactivated', result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
  updateMe,
  getEmployees,
  getDepartments,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
};