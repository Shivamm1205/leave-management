import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { user, loading, login } = useAuth();

  // Already logged in: go to your own home page
  if (!loading && user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) return setError('Email and password are required');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email');
    try {
      await login('/auth/admin-login', email.trim(), password);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 380 }}>
      <div className="card">
        <h2>Admin Login</h2>
        <input placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={handleLogin}>Login</button>
        {error && <p className="msg">{error}</p>}
      </div>
    </div>
  );
}