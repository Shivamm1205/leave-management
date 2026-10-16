import { useEffect, useState } from 'react';
import API from '../api/axios';
import { hasEmoji } from '../utils/validators';

// Same rules as the backend
const checkReason = (text) => {
  const t = text.trim();
  if (t.length < 3) return 'Rejection reason must be at least 3 characters';
  if (t.length > 500) return 'Rejection reason must be 500 characters or less';
  if (hasEmoji(t)) return 'Rejection reason cannot contain emojis';
  return '';
};

export default function AllLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [fileList, setFileList] = useState([]);

  // Reject form
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const loadLeaves = async () => {
    const res = await API.get('/leaves', { params: { status } });
    setLeaves(res.data.data);
  };

  useEffect(() => { loadLeaves(); }, [status]);

  const approve = async (id) => {
    try {
      await API.put(`/leaves/${id}/approve`);
      setError('');
      loadLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  // ---------- Reject (with validation) ----------

  const openReject = (id) => {
    setRejectId(id);
    setRejectReason('');
    setRejectError('');
    setError('');
  };

  const closeReject = () => {
    setRejectId(null);
    setRejectReason('');
    setRejectError('');
  };

  const handleReasonChange = (e) => {
    const text = e.target.value;
    setRejectReason(text);
    // Tell the admin about an emoji straight away
    setRejectError(hasEmoji(text) ? 'Rejection reason cannot contain emojis' : '');
  };

  const submitReject = async () => {
    const problem = checkReason(rejectReason);
    if (problem) return setRejectError(problem);

    try {
      await API.put(`/leaves/${rejectId}/reject`, { reason: rejectReason.trim() });
      closeReject();
      loadLeaves();
    } catch (err) {
      setRejectError(err.response?.data?.message || 'Failed');
    }
  };

  // ---------- Files ----------

  // Show or hide the files of one leave
  const showFiles = async (id) => {
    if (openId === id) { setOpenId(null); return; }
    try {
      const res = await API.get(`/leaves/${id}/attachments`);
      setFileList(res.data.data);
      setOpenId(id);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load files');
    }
  };

  // Download needs the cookie, so we fetch it as a blob
  const download = async (f) => {
    try {
      const res = await API.get(`/attachments/${f.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed');
    }
  };

  return (
    <div className="container">
      {rejectId && (
        <div className="card">
          <h3>Reject leave #{rejectId}</h3>
          <label>Reason for rejection (required, no emojis)</label>
          <textarea
            value={rejectReason}
            onChange={handleReasonChange}
            maxLength={500}
            placeholder="Write the reason"
          />
          {rejectError && <p className="msg">{rejectError}</p>}
          <button className="red" onClick={submitReject}>Reject leave</button>{' '}
          <button onClick={closeReject}>Cancel</button>
        </div>
      )}

      {openId && (
        <div className="card">
          <h3>Files of leave #{openId}</h3>
          {fileList.length === 0 && <p>No files attached.</p>}
          {fileList.map((f) => (
            <p key={f.id}>
              {f.original_name} ({Math.round(f.file_size / 1024)} KB){' '}
              <button onClick={() => download(f)}>Download</button>
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h3>All Leave Requests</h3>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        {error && <p className="msg">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td>{l.employee}</td><td>{l.leave_type}</td><td>{l.start_date}</td><td>{l.end_date}</td>
                  <td>{l.total_days}</td><td>{l.reason}</td>
                  <td>{l.status}{l.rejection_reason ? ` (${l.rejection_reason})` : ''}</td>
                  <td className="row-actions">
                    <button className="small" onClick={() => showFiles(l.id)}>Files</button>
                    {l.status === 'PENDING' && (
                      <>
                        <button className="small green" onClick={() => approve(l.id)}>Approve</button>
                        <button className="small red" onClick={() => openReject(l.id)}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}