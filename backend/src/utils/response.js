// Success 
const sendSuccess = (res, message, data = null, status = 200) => {
  return res.status(status).json({ success: true, message, data });
};
// Error
const sendError = (res, message, status = 400) => {
  return res.status(status).json({ success: false, message, data: null });
};

module.exports = { sendSuccess, sendError };

