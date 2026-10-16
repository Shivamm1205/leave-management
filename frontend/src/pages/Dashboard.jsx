import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

// Table of recent leaves, used by both roles
function RecentTable({ rows, showEmployee }) {
  if (rows.length === 0) return <p>No leaves yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          {showEmployee && <th>Employee</th>}
          <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id}>
            {showEmployee && <td>{l.employee}</td>}
            <td>{l.leave_type}</td><td>{l.start_date}</td><td>{l.end_date}</td><td>{l.total_days}</td>
            <td><span className={`status ${l.status.toLowerCase()}`}>{l.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// One colour per leave type
const COLORS = ['#1f3a5f', '#27ae60', '#e67e22', '#8e44ad', '#16a085', '#c0392b'];

// Leave balance: one donut ring per leave type. The coloured part is what is left.
function BalanceChart({ balance }) {
  if (balance.length === 0) return <p>No leave types yet.</p>;

  const R = 42;                    // radius of the ring
  const C = 2 * Math.PI * R;       // length of the full circle

  return (
    <div className="rings">
      {balance.map((b, i) => {
        const left = b.total_days > 0 ? b.remaining / b.total_days : 0; // share still available
        const color = COLORS[i % COLORS.length];

        return (
          <div className="ring-card" key={b.leave_type}>
            <svg viewBox="0 0 100 100" className="ring" role="img"
                 aria-label={`${b.leave_type}: ${b.remaining} days left of ${b.total_days}`}>
              <title>{`${b.leave_type}: ${b.used_days} used, ${b.remaining} left of ${b.total_days}`}</title>

              {/* grey ring = the whole entitlement */}
              <circle cx="50" cy="50" r={R} className="ring-bg" />

              {/* coloured arc = remaining days */}
              {b.remaining > 0 && (
                <circle
                  cx="50" cy="50" r={R}
                  className="ring-fg"
                  stroke={color}
                  strokeDasharray={`${C * left} ${C}`}
                  transform="rotate(-90 50 50)"
                />
              )}

              <text x="50" y="52" textAnchor="middle" className="ring-num">{b.remaining}</text>
              <text x="50" y="66" textAnchor="middle" className="ring-lbl">days left</text>
            </svg>

            <div className="ring-name">
              <i className="ring-dot" style={{ background: color }} />
              {b.leave_type}
            </div>
            <div className="ring-sub">{b.used_days} of {b.total_days} used</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    API.get('/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load dashboard'));
  }, []);

  if (error) return <div className="container"><p className="msg">{error}</p></div>;
  if (!data) return <div className="container"><p>Loading...</p></div>;

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="container">
      <h2>Welcome, {user?.name}</h2>

      <div className="stats">
        <div className="stat"><span>{data.total}</span>Total</div>
        <div className="stat pending"><span>{data.pending}</span>Pending</div>
        <div className="stat approved"><span>{data.approved}</span>Approved</div>
        <div className="stat rejected"><span>{data.rejected}</span>Rejected</div>
        <div className="stat cancelled"><span>{data.cancelled}</span>Cancelled</div>
        {isAdmin && <div className="stat"><span>{data.total_employees}</span>Employees</div>}
      </div>

      {/* ---------- Employee ---------- */}
      {!isAdmin && (
        <>
          <div className="card">
            <h3>Leave balance</h3>
            <BalanceChart balance={data.balance} />
          </div>

          <div className="card">
            <h3>Next approved leave</h3>
            {data.next_leave ? (
              <p>
                <b>{data.next_leave.leave_type}</b>: {data.next_leave.start_date} to {data.next_leave.end_date}
                {' '}({data.next_leave.total_days} day{data.next_leave.total_days > 1 ? 's' : ''})
              </p>
            ) : (
              <p>No upcoming approved leave.</p>
            )}
          </div>

          <div className="card">
            <h3>Recent leaves</h3>
            <RecentTable rows={data.recent} showEmployee={false} />
          </div>

          <div className="card">
            <Link to="/apply-leave"><button>Apply for leave</button></Link>{' '}
            <Link to="/my-leaves"><button>View all my leaves</button></Link>
          </div>
        </>
      )}

      {/* ---------- Admin ---------- */}
      {isAdmin && (
        <>
          <div className="card">
            <h3>On leave today</h3>
            {data.on_leave_today.length === 0 ? (
              <p>Nobody is on leave today.</p>
            ) : (
              data.on_leave_today.map((p, i) => (
                <p key={i}>
                  <b>{p.name}</b> ({p.department || 'No department'}): {p.leave_type}, back after {p.end_date}
                </p>
              ))
            )}
          </div>

          <div className="card">
            <h3>Latest leave requests</h3>
            <RecentTable rows={data.recent} showEmployee={true} />
          </div>

          <div className="card">
            <Link to="/admin/leaves"><button>Review all leave requests</button></Link>
          </div>
        </>
      )}
    </div>
  );
}