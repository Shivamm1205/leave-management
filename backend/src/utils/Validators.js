// Shared validation helpers. Each check returns an error message, or null if the value is fine.

// Trim a value to a string ('' if empty)
const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d));
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
const cleanEmail = (email) => clean(email).toLowerCase();

// Today as YYYY-MM-DD (server's local date)
const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const checkName = (name) => {
  const n = clean(name);
  if (n.length < 2 || n.length > 100) return 'Name must be 2 to 100 characters';
  return null;
};

const checkEmail = (email) => {
  const e = cleanEmail(email);
  if (!e) return 'Email is required';
  if (e.length > 150) return 'Email is too long';
  if (!isValidEmail(e)) return 'Enter a valid email';
  return null;
};

const checkPassword = (password) => {
  const p = password === undefined || password === null ? '' : String(password);
  if (p.length < 6) return 'Password must be at least 6 characters';
  if (p.length > 72) return 'Password must be 72 characters or less';
  return null;
};

// Phone is optional. If given: 10-digit mobile starting with 6 to 9, optional +91 / 91 / 0 in front.
// Spaces and dashes are allowed, for example "+91 98765-43210".
const checkPhone = (phone) => {
  const p = clean(phone);
  if (!p) return null;
  const digits = p.replace(/[\s-]/g, '');
  if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(digits)) {
    return 'Enter a valid 10-digit mobile number';
  }
  return null;
};

const checkDepartment = (dep) => {
  if (clean(dep).length > 100) return 'Department must be 100 characters or less';
  return null;
};

// Text with a minimum and maximum length
const hasEmoji = (text) =>
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{FE0F}\u{20E3}]/u.test(text);

// Text with a minimum and maximum length and refuse emojis
const checkLength = (label, value, min, max, noEmoji = false) => {
  const v = clean(value);
  if (v.length < min) return `${label} must be at least ${min} characters`;
  if (v.length > max) return `${label} must be ${max} characters or less`;
  if (noEmoji && hasEmoji(v)) return `${label} cannot contain emojis`;
  return null;
};
// Returns the first error found, or null
const firstError = (...errors) => errors.find(Boolean) || null;

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

module.exports = {
  clean, isValidId, isValidDate, isValidEmail, cleanEmail, todayStr,
  checkName, checkEmail, checkPassword, checkPhone, checkDepartment, checkLength,
  firstError, VALID_STATUSES,
};