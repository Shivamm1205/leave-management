const pool = require('../config/db');
const { sendSuccess } = require('../utils/response');

// Counts, recent leaves and extra info.
// Employee: own data only (id from the token). Admin: everything.
const getDashboard = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';

    // 1. Counts by status
    const counts = await pool.query(
      isAdmin
        ? 'SELECT status, COUNT(*)::int AS count FROM leaves GROUP BY status'
        : 'SELECT status, COUNT(*)::int AS count FROM leaves WHERE user_id = $1 GROUP BY status',
      isAdmin ? [] : [req.user.id]
    );
    const data = { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 };
    counts.rows.forEach((r) => {
      data[r.status.toLowerCase()] = r.count;
      data.total += r.count;
    });

    // 2. Five most recent leaves
    const recent = await pool.query(
      `SELECT l.id, u.name AS employee, lt.name AS leave_type,
              to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
              l.total_days, l.status
       FROM leaves l
       JOIN users u ON u.id = l.user_id
       JOIN leave_types lt ON lt.id = l.leave_type_id
       ${isAdmin ? '' : 'WHERE l.user_id = $1'}
       ORDER BY l.id DESC LIMIT 5`,
      isAdmin ? [] : [req.user.id]
    );
    data.recent = recent.rows;

    if (isAdmin) {
      // Active employees
      const emp = await pool.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'EMPLOYEE' AND is_active = true"
      );
      data.total_employees = emp.rows[0].count;

      // Who is on approved leave today
      const today = await pool.query(
        `SELECT u.name, u.department, lt.name AS leave_type,
                to_char(l.end_date, 'YYYY-MM-DD') AS end_date
         FROM leaves l
         JOIN users u ON u.id = l.user_id
         JOIN leave_types lt ON lt.id = l.leave_type_id
         WHERE l.status = 'APPROVED' AND CURRENT_DATE BETWEEN l.start_date AND l.end_date
         ORDER BY u.name`
      );
      data.on_leave_today = today.rows;
    } else {
      // Balance per leave type
      const bal = await pool.query(
        `SELECT lt.name AS leave_type, b.total_days, b.used_days,
                (b.total_days - b.used_days) AS remaining
         FROM leave_balances b
         JOIN leave_types lt ON lt.id = b.leave_type_id
         WHERE b.user_id = $1 AND lt.is_active = true
         ORDER BY lt.id`,
        [req.user.id]
      );
      data.balance = bal.rows;

      // Next approved leave that has not started yet
      const next = await pool.query(
        `SELECT lt.name AS leave_type,
                to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
                to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
                l.total_days
         FROM leaves l
         JOIN leave_types lt ON lt.id = l.leave_type_id
         WHERE l.user_id = $1 AND l.status = 'APPROVED' AND l.start_date >= CURRENT_DATE
         ORDER BY l.start_date LIMIT 1`,
        [req.user.id]
      );
      data.next_leave = next.rows[0] || null;
    }

    sendSuccess(res, 'Dashboard fetched', data);
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };