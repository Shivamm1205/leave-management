import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { user, loading, login } = useAuth();

  // Browser tab title
  useEffect(() => {
    document.title = 'Employee Login ';
  }, []);

  // Already logged in: go to your own home page
  if (!loading && user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) return setError('Email and password are required');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email');
    try {
      await login('/auth/login', email.trim(), password); // the page redirects once the user is set
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 380 }}>
      <div className="card">
        <h2 className="auth-sub">Employee Login</h2>
        <p className="auth-hint">Enter your credentials to continue</p>

        <label>Email</label>
        <input placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={handleLogin}>Login</button>
        {error && <p className="msg">{error}</p>}
        <p>New employee? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
}