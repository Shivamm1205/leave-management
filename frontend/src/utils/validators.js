// Phone is optional. If given: 10-digit mobile starting with 6 to 9, optional +91 / 91 / 0 in front.
export const isValidPhone = (p) => {
  const v = (p || '').trim();
  if (!v) return true;
  return /^(\+91|91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));
};

export const PHONE_MESSAGE = 'Enter a valid 10-digit mobile number (optional +91)';

// True if the text contains an emoji (letters, digits, punctuation and Hindi/other languages are fine)
export const hasEmoji = (text) =>
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{FE0F}\u{20E3}]/u.test(text || '');