import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { isValidPhone, PHONE_MESSAGE } from '../utils/validators';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', phone: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Browser tab title
  useEffect(() => {
    document.title = 'Register | Leave Management System';
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRegister = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    if (name.length < 2 || name.length > 100) return setError('Name must be 2 to 100 characters');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password.length > 72) return setError('Password must be 72 characters or less');
    if (!isValidPhone(form.phone)) return setError(PHONE_MESSAGE);

    try {
      await API.post('/auth/register', { ...form, name, email });
      alert('Registered successfully. Please login.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 380 }}>
      <div className="card">
       
        <h2 className="auth-sub">Create an Employee Account</h2>
        <p className="auth-hint">Fill in your details to register</p>

        <label>Full name</label>
        <input name="name" placeholder="Your name" value={form.name} onChange={handleChange} />
        <label>Email</label>
        <input name="email" placeholder="you@company.com" value={form.email} onChange={handleChange} />
        <label>Password</label>
        <input name="password" type="password" placeholder="Minimum 6 characters" value={form.password} onChange={handleChange} />
        <label>Department (optional)</label>
        <input name="department" placeholder="Department" value={form.department} onChange={handleChange} />
        <label>Phone (optional)</label>
        <input name="phone" placeholder="10-digit mobile number" value={form.phone} onChange={handleChange} />
        <button onClick={handleRegister}>Register</button>
        {error && <p className="msg">{error}</p>}
        <p>Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}