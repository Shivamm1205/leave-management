const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = () => new Date().toISOString().slice(0, 10);

const write = (file, text) => {
  fs.appendFile(path.join(logsDir, file), text + '\n', () => {});
};

// Logs every request: time, method, url, status, how long it took
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    write(
      `access-${today()}.log`,
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
};

// Logs unexpected errors (never logs passwords or request bodies)
const logError = (err, req) => {
  write(
    'error.log',
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}\n${err.stack}\n`
  );
};

module.exports = { requestLogger, logError };