const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendError } = require('../utils/response');
const { COOKIE_NAME } = require('../utils/cookie');

// Checks that the user is logged in (the token comes from the cookie)
const auth = async (req, res, next) => {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return sendError(res, 'Please login first', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return sendError(res, 'Invalid or expired token', 401);
  }

  try {
    // Make sure the user still exists and is active
    const result = await pool.query(
      'SELECT id, role, token_version FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (result.rowCount === 0) {
      return sendError(res, 'User not found or deactivated', 401);
    }
    const user = result.rows[0];

    // Logout raises token_version, so tokens issued before it stop working
    if (user.token_version !== decoded.v) {
      return sendError(res, 'Session ended. Please login again', 401);
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

// Allows only admin
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return sendError(res, 'Admin access only', 403);
  }
  next();
};

module.exports = { auth, adminOnly };