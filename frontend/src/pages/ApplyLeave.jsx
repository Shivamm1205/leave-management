import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

const ALLOWED = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

// Today as YYYY-MM-DD (used to block past dates in the date picker)
const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export default function ApplyLeave() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [drafts, setDrafts] = useState([]);   // files uploaded but not yet used in a leave
  const [fileKey, setFileKey] = useState(0);  // changing this clears the file input
  const [msg, setMsg] = useState({ text: '', ok: true });
  const navigate = useNavigate();
  const today = todayStr();

  const loadDrafts = async () => {
    const res = await API.get('/attachments/draft');
    setDrafts(res.data.data);
  };

  useEffect(() => {
    API.get('/leave-types').then((res) => setTypes(res.data.data));
    loadDrafts();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Files are uploaded as soon as they are chosen
  const handleFiles = async (e) => {
    const picked = [...e.target.files];
    if (picked.length === 0) return;

    if (drafts.length + picked.length > MAX_FILES) {
      setFileKey(fileKey + 1);
      return setMsg({ text: `You can attach at most ${MAX_FILES} files`, ok: false });
    }
    for (const f of picked) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext)) {
        setFileKey(fileKey + 1);
        return setMsg({ text: 'Only PDF, DOC, DOCX, JPG, JPEG and PNG files are allowed', ok: false });
      }
      if (f.size > MAX_SIZE) {
        setFileKey(fileKey + 1);
        return setMsg({ text: `${f.name} is larger than 5 MB`, ok: false });
      }
    }

    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append('files', f));
      await API.post('/attachments', fd);
      setMsg({ text: '', ok: true });
      await loadDrafts();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Upload failed', ok: false });
    }
    setFileKey(fileKey + 1); // clear the input so the same file can be chosen again
  };

  const removeDraft = async (id) => {
    try {
      await API.delete(`/attachments/${id}`);
      await loadDrafts();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Delete failed', ok: false });
    }
  };

  const apply = async () => {
    if (!form.leave_type_id) return setMsg({ text: 'Please select a leave type', ok: false });
    if (!form.start_date || !form.end_date) return setMsg({ text: 'Start date and end date are required', ok: false });
    if (form.start_date < today) return setMsg({ text: 'Start date cannot be in the past', ok: false });
    if (form.end_date < form.start_date) return setMsg({ text: 'End date cannot be before start date', ok: false });
    if (form.reason.trim().length < 3) return setMsg({ text: 'Reason must be at least 3 characters', ok: false });

    try {
      await API.post('/leaves', { ...form, attachment_ids: drafts.map((d) => d.id) });
      navigate('/my-leaves'); // go to the list after applying
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Failed', ok: false });
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h3>Apply Leave</h3>
        <select name="leave_type_id" value={form.leave_type_id} onChange={handleChange}>
          <option value="">Select leave type</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label>Start date</label>
        <input type="date" name="start_date" min={today} value={form.start_date} onChange={handleChange} />
        <label>End date</label>
        <input type="date" name="end_date" min={form.start_date || today} value={form.end_date} onChange={handleChange} />
        <textarea name="reason" placeholder="Reason" value={form.reason} onChange={handleChange} />

        <label>Documents (optional: PDF, DOC, DOCX, JPG, PNG, max 5 MB each, up to 5 files)</label>
        <input
          key={fileKey}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFiles}
        />

        {drafts.length > 0 && (
          <div>
            <p><b>Attached files</b></p>
            {drafts.map((d) => (
              <p key={d.id}>
                {d.original_name} ({Math.round(d.file_size / 1024)} KB){' '}
                <button className="red" onClick={() => removeDraft(d.id)}>Delete</button>
              </p>
            ))}
          </div>
        )}

        <button onClick={apply}>Apply</button>
        {msg.text && <p className={msg.ok ? 'ok' : 'msg'}>{msg.text}</p>}
      </div>
    </div>
  );
}