// One place for the login cookie: name and settings
const COOKIE_NAME = 'token';

const baseOptions = () => ({
  httpOnly: true,                                   // JavaScript in the browser cannot read it
  sameSite: 'lax',                                  // not sent with requests from other sites
  secure: process.env.NODE_ENV === 'production',    // HTTPS only when deployed
  path: '/',
});

const setAuthCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, { ...baseOptions(), maxAge: 24 * 60 * 60 * 1000 }); // 1 day, same as the token

const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, baseOptions());

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie };