import { createContext, useContext, useEffect, useState } from 'react';
import API from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ask the server who is logged in (the cookie is sent automatically)
  useEffect(() => {
    API.get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // path is '/auth/login' or '/auth/admin-login'
  const login = async (path, email, password) => {
    const res = await API.post(path, { email, password });
    setUser(res.data.data.user);
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);