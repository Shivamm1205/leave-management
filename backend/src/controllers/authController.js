const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { COOKIE_NAME, setAuthCookie, clearAuthCookie } = require('../utils/cookie');
const {
  clean, cleanEmail, isValidEmail,
  checkName, checkEmail, checkPassword, checkPhone, checkDepartment, firstError,
} = require('../utils/Validators');

const register = async (req, res, next) => {
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

    // Email must be unique
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      return sendError(res, 'Email already registered', 409);
    }

    // Hash the password, role is always EMPLOYEE
    const hashed = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, department, phone)
       VALUES ($1, $2, $3, 'EMPLOYEE', $4, $5)
       RETURNING id, name, email, role, department, phone`,
      [clean(name), email, hashed, clean(department) || null, clean(phone) || null]
    );
    const user = result.rows[0];

    // Give the new employee a balance row for every active leave type
    await pool.query(
      `INSERT INTO leave_balances (user_id, leave_type_id, total_days)
       SELECT $1::int, id, total_days FROM leave_types WHERE is_active = true`,
      [user.id]
    );

    sendSuccess(res, 'Registered successfully', user, 201);
  } catch (err) {
    next(err);
  }
};

// Used by both logins. `role` is the only role allowed on that login page.
const makeLogin = (role) => async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const email = cleanEmail(req.body && req.body.email);

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }
    if (!isValidEmail(email)) {
      return sendError(res, 'Enter a valid email', 400);
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Same message for both cases, so nobody can guess which emails exist
    if (!user) return sendError(res, 'Invalid email or password', 401);
    if (!user.is_active) return sendError(res, 'Your account is deactivated', 403);

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) return sendError(res, 'Invalid email or password', 401);

    // The password is correct, now check this is the right login page for the role
    if (user.role !== role) {
      return sendError(
        res,
        role === 'ADMIN'
          ? 'This login is for administrators only'
          : 'Administrators must use the admin login page',
        403
      );
    }

    // The token carries the id, the role and the token version
    const token = jwt.sign(
      { id: user.id, role: user.role, v: user.token_version },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    setAuthCookie(res, token); // the token goes in an httpOnly cookie, not in the response body

    sendSuccess(res, 'Login successful', {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (err) {
    next(err);
  }
};

const login = makeLogin('EMPLOYEE');
const adminLogin = makeLogin('ADMIN');

// Logout: end the session on the server, then clear the cookie
const logout = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];

    let decoded = null;
    try {
      decoded = token ? jwt.verify(token, process.env.JWT_SECRET) : null;
    } catch (err) {
      decoded = null; // expired or invalid token: nothing to end
    }

    if (decoded) {
      // Raising the version makes every token issued before now invalid
      await pool.query(
        'UPDATE users SET token_version = token_version + 1 WHERE id = $1 AND token_version = $2',
        [decoded.id, decoded.v]
      );
    }

    clearAuthCookie(res);
    sendSuccess(res, 'Logged out');
  } catch (err) {
    next(err);
  }
};

// Who is logged in? The frontend calls this when the page loads.
const me = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, department, phone FROM users WHERE id = $1',
      [req.user.id]
    );
    sendSuccess(res, 'Session valid', result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, adminLogin, logout, me };