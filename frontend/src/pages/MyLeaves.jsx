import { useEffect, useState } from 'react';
import API from '../api/axios';

export default function MyLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(null);   // the leave whose files are shown
  const [fileList, setFileList] = useState([]);

  const loadLeaves = async () => {
    const res = await API.get('/leaves/my');
    setLeaves(res.data.data);
  };

  useEffect(() => { loadLeaves(); }, []);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this leave?')) return;
    try {
      await API.put(`/leaves/${id}/cancel`);
      setMsg('');
      setOpen(null);
      loadLeaves();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed');
    }
  };

  // Show or hide the files of one leave
  const showFiles = async (leave) => {
    if (open && open.id === leave.id) { setOpen(null); return; }
    try {
      const res = await API.get(`/leaves/${leave.id}/attachments`);
      setFileList(res.data.data);
      setOpen(leave);
      setMsg('');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Could not load files');
    }
  };

  // Download needs the token, so we fetch it as a blob
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
      setMsg('Download failed');
    }
  };

  const removeFile = async (f) => {
    try {
      await API.delete(`/attachments/${f.id}`);
      const res = await API.get(`/leaves/${open.id}/attachments`);
      setFileList(res.data.data);
      setMsg('');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="container">
      {open && (
        <div className="card">
          <h3>Files of leave #{open.id}</h3>
          {fileList.length === 0 && <p>No files attached.</p>}
          {fileList.map((f) => (
            <p key={f.id}>
              {f.original_name} ({Math.round(f.file_size / 1024)} KB){' '}
              <button onClick={() => download(f)}>Download</button>{' '}
              {open.status === 'PENDING' && (
                <button className="red" onClick={() => removeFile(f)}>Delete</button>
              )}
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h3>My Leaves</h3>
        {msg && <p className="msg">{msg}</p>}
        <table>
          <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id}>
                <td>{l.leave_type}</td><td>{l.start_date}</td><td>{l.end_date}</td><td>{l.total_days}</td>
                <td>{l.status}{l.rejection_reason ? ` (${l.rejection_reason})` : ''}</td>
                <td>
                  <button onClick={() => showFiles(l)}>Files</button>{' '}
                  {l.status === 'PENDING' && <button className="red" onClick={() => cancel(l.id)}>Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}