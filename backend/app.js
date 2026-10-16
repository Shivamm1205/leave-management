require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./src/config/db');
const { sendSuccess, sendError } = require('./src/utils/response');
const { requestLogger, logError } = require('./src/utils/logger');

const app = express();

app.set('etag', false); // no ETag, so the server never answers 304

// Middleware
// Cookies need a fixed origin and credentials: true (an open cors() would be blocked)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store'); // browser must always ask the server
  next();
});

// Test the server and database work
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    sendSuccess(res, 'Server and database are working');
  } catch (err) {
    sendError(res, 'Database not connected', 500);
  }
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/leave-types', require('./src/routes/leaveTypes'));
app.use('/api/leaves', require('./src/routes/leaves'));
app.use('/api/attachments', require('./src/routes/attachments'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/admin', require('./src/routes/admin'));        // <-- the new line

// Unknown URL -> 404
app.use((req, res) => {
  sendError(res, 'Route not found', 404);
});

// Errors
app.use((err, req, res, next) => {
  // Broken JSON in the request body
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'Invalid JSON in request body', 400);
  }
  // Duplicate value caught by the database (for example the same email sent twice at once)
  if (err.code === '23505') {
    return sendError(res, 'This value already exists', 409);
  }

  console.error(err);
  logError(err, req);
  sendError(res, 'Something went wrong on the server', 500);
});

module.exports = app;