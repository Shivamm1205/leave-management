import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ApplyLeave from './pages/ApplyLeave.jsx';
import MyLeaves from './pages/MyLeaves.jsx';
import AllLeaves from './pages/AllLeaves.jsx';
import Employees from './pages/Employees.jsx';
import Profile from './pages/Profile.jsx';

// Must be logged in with the right role (who is logged in comes from the server)
function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container"><p>Loading...</p></div>;
  if (!user) return <Navigate to={role === 'ADMIN' ? '/admin/login' : '/login'} />;
  if (user.role !== role) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} />;
  }
  return children;
}

function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  if (loading || !user) return null;

  const isAdmin = user.role === 'ADMIN';

  const handleLogout = async () => {
    await logout(); // calls the logout API, which clears the cookie
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  return (
    <div className="nav">
      <b>Leave Management</b>
      <span>
        {isAdmin ? (
          <>
            <Link to="/admin/dashboard">Dashboard</Link>
            <Link to="/admin/leaves">Leave Requests</Link>
            <Link to="/admin/employees">Employees</Link>
            <Link to="/admin/profile">Profile</Link>
          </>
        ) : (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/apply-leave">Apply Leave</Link>
            <Link to="/my-leaves">My Leaves</Link>
            <Link to="/profile">Profile</Link>
          </>
        )}
        <button onClick={handleLogout}>Logout</button>
      </span>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />

        {/* Employee */}
        <Route path="/dashboard" element={<Protected role="EMPLOYEE"><Dashboard /></Protected>} />
        <Route path="/apply-leave" element={<Protected role="EMPLOYEE"><ApplyLeave /></Protected>} />
        <Route path="/my-leaves" element={<Protected role="EMPLOYEE"><MyLeaves /></Protected>} />
        <Route path="/profile" element={<Protected role="EMPLOYEE"><Profile /></Protected>} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<Protected role="ADMIN"><Dashboard /></Protected>} />
        <Route path="/admin/leaves" element={<Protected role="ADMIN"><AllLeaves /></Protected>} />
        <Route path="/admin/employees" element={<Protected role="ADMIN"><Employees /></Protected>} />
        <Route path="/admin/profile" element={<Protected role="ADMIN"><Profile /></Protected>} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </AuthProvider>
  );
}