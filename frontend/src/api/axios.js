import axios from 'axios';

// withCredentials: the browser sends the login cookie with every request
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
});

// If the session has ended, go to the right login page
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/'); // login, logout and /auth/me handle their own 401
    if (err.response?.status === 401 && !isAuthCall) {
      const isAdminArea = window.location.pathname.startsWith('/admin');
      window.location.href = isAdminArea ? '/admin/login' : '/login';
    }
    return Promise.reject(err);
  }
);

export default API;