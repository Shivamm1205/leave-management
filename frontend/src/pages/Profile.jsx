import { useEffect, useRef, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { isValidPhone, PHONE_MESSAGE } from '../utils/validators';

const PHOTO_EXT = ['jpg', 'jpeg', 'png'];
const PHOTO_MAX = 2 * 1024 * 1024; // 2 MB

const initials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Profile() {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', department: '', phone: '' });
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({ employees: 0, pending: 0 }); // admin only
  const [msg, setMsg] = useState({ text: '', ok: true });

  // Photo
  const fileRef = useRef(null);
  const [photoKey, setPhotoKey] = useState(Date.now()); // changes after every upload, so the browser reloads the image
  const [imgFailed, setImgFailed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState({ text: '', ok: true });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/users/me');
        const me = res.data.data;
        setProfile(me);

        if (me.role === 'ADMIN') {
          const [e, p] = await Promise.all([
            API.get('/admin/users', { params: { limit: 1 } }),
            API.get('/leaves', { params: { status: 'PENDING' } }),
          ]);
          setStats({ employees: e.data.data.total, pending: p.data.data.length });
        }
      } catch (err) {
        setMsg({ text: err.response?.data?.message || 'Could not load profile', ok: false });
      }
    };
    load();
  }, []);

  // ---------- Profile details ----------

  const startEdit = () => {
    setForm({
      name: profile.name || '',
      department: profile.department || '',
      phone: profile.phone || '',
    });
    setMsg({ text: '', ok: true });
    setEditing(true);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const save = async () => {
    if (form.name.trim().length < 2) {
      return setMsg({ text: 'Name must be at least 2 characters', ok: false });
    }
    if (!isValidPhone(form.phone)) {
      return setMsg({ text: PHONE_MESSAGE, ok: false });
    }
    try {
      const res = await API.put('/users/me', form);
      const updated = res.data.data;
      setProfile(updated);

      // keep the logged-in user in step with the saved profile
      setUser((u) => ({ ...u, name: updated.name, department: updated.department }));

      setEditing(false);
      setMsg({ text: 'Profile updated', ok: true });
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Update failed', ok: false });
    }
  };

  // ---------- Photo ----------

  const choosePhoto = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // so the same file can be chosen again
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!PHOTO_EXT.includes(ext)) {
      return setPhotoMsg({ text: 'Only JPG, JPEG and PNG photos are allowed', ok: false });
    }
    if (file.size > PHOTO_MAX) {
      return setPhotoMsg({ text: 'Photo must be 2 MB or less', ok: false });
    }

    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await API.put('/users/me/photo', fd);
      setProfile((p) => ({ ...p, has_photo: true }));
      setImgFailed(false);
      setPhotoKey(Date.now());
      setPhotoMsg({ text: 'Photo updated', ok: true });
    } catch (err) {
      setPhotoMsg({ text: err.response?.data?.message || 'Upload failed', ok: false });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setPhotoBusy(true);
    try {
      await API.delete('/users/me/photo');
      setProfile((p) => ({ ...p, has_photo: false }));
      setPhotoMsg({ text: 'Photo removed', ok: true });
    } catch (err) {
      setPhotoMsg({ text: err.response?.data?.message || 'Could not remove the photo', ok: false });
    } finally {
      setPhotoBusy(false);
    }
  };

  if (!profile) return <div className="container"><p>{msg.text || 'Loading...'}</p></div>;

  const showPhoto = profile.has_photo && !imgFailed;
  const photoUrl = `${API.defaults.baseURL}/users/me/photo?t=${photoKey}`;

  return (
    <div className="container">
      <div className="card profile-head">
        {showPhoto ? (
          <img
            className="avatar-img"
            src={photoUrl}
            alt="Profile"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="avatar">{initials(profile.name)}</div>
        )}

        <div>
          <h2 style={{ margin: 0 }}>{profile.name}</h2>
          <span className="badge">{profile.role}</span>

          <div className="photo-actions">
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={choosePhoto}
              style={{ display: 'none' }}
            />
            <button className="small" disabled={photoBusy} onClick={() => fileRef.current.click()}>
              {photoBusy ? 'Please wait...' : profile.has_photo ? 'Change photo' : 'Upload photo'}
            </button>
            {profile.has_photo && (
              <button className="small red" disabled={photoBusy} onClick={removePhoto}>
                Remove photo
              </button>
            )}
          </div>
          {photoMsg.text && <p className={photoMsg.ok ? 'ok' : 'msg'}>{photoMsg.text}</p>}
         
        </div>
      </div>

      <div className="card">
        <h3>Profile details</h3>
        {!editing ? (
          <>
            <p><b>Name:</b> {profile.name}</p>
            <p><b>Email:</b> {profile.email}</p>
            <p><b>Role:</b> {profile.role}</p>
            <p><b>Department:</b> {profile.department || '-'}</p>
            <p><b>Phone:</b> {profile.phone || '-'}</p>
            <button onClick={startEdit}>Edit profile</button>
          </>
        ) : (
          <>
            <label>Name</label>
            <input name="name" value={form.name} onChange={handleChange} />
            <label>Email (cannot be changed)</label>
            <input value={profile.email} disabled />
            <label>Department</label>
            <input name="department" value={form.department} onChange={handleChange} />
            <label>Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} />
            <button onClick={save}>Save</button>{' '}
            <button className="red" onClick={() => setEditing(false)}>Cancel</button>
          </>
        )}
        {msg.text && <p className={msg.ok ? 'ok' : 'msg'}>{msg.text}</p>}
      </div>

      {profile.role === 'ADMIN' && (
        <div className="card">
          <h3>Overview</h3>
          <p><b>Total employees:</b> {stats.employees}</p>
          <p><b>Pending leave requests:</b> {stats.pending}</p>
        </div>
      )}
    </div>
  );
}