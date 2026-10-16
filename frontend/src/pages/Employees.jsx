import { useEffect, useState } from 'react';
import API from '../api/axios';
import { isValidPhone, PHONE_MESSAGE } from '../utils/validators';

const LIMIT = 10; // employees per page
const EMPTY_FORM = { name: '', email: '', password: '', department: '', phone: '' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(''); // what is typed in the box
  const [query, setQuery] = useState('');             // the search text actually sent to the API
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);      // change it to reload the list

  // Add / edit form
  const [formMode, setFormMode] = useState(null);     // null, 'add' or 'edit'
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ text: '', ok: true });

  // Departments for the filter dropdown (also refreshed after add or edit)
  useEffect(() => {
    API.get('/admin/departments')
      .then((res) => setDepartments(res.data.data))
      .catch(() => {});
  }, [reloadKey]);

  // Wait 400 ms after typing stops, then search from page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load the list whenever the page, search, department or reloadKey changes
  useEffect(() => {
    let ignore = false; // ignore an old response if a newer request was made
    setLoading(true);

    const params = { page, limit: LIMIT };
    if (query) params.search = query;
    if (department) params.department = department;

    API.get('/admin/users', { params })
      .then((res) => {
        if (ignore) return;
        const d = res.data.data;
        setEmployees(d.employees);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setError('');
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.message || 'Could not load employees');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, [page, query, department, reloadKey]);

  const changeDepartment = (e) => {
    setDepartment(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setDepartment('');
    setPage(1);
  };

  // ---------- Add / edit ----------

  const openAdd = () => {
    setFormMode('add');
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setNotice({ text: '', ok: true });
  };

  const openEdit = (emp) => {
    setFormMode('edit');
    setEditId(emp.id);
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      department: emp.department || '',
      phone: emp.phone || '',
    });
    setFormError('');
    setNotice({ text: '', ok: true });
  };

  const closeForm = () => {
    setFormMode(null);
    setEditId(null);
    setFormError('');
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Same rules as the backend, so mistakes show before the request is sent
  const validate = () => {
    const name = form.name.trim();
    const email = form.email.trim();
    if (name.length < 2 || name.length > 100) return 'Name must be 2 to 100 characters';
    if (!email) return 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 150) return 'Enter a valid email';
    if (formMode === 'add') {
      if (form.password.length < 6) return 'Password must be at least 6 characters';
      if (form.password.length > 72) return 'Password must be 72 characters or less';
    }
    if (form.department.trim().length > 100) return 'Department must be 100 characters or less';
    if (!isValidPhone(form.phone)) return PHONE_MESSAGE;
    return '';
  };

  const submit = async () => {
    const problem = validate();
    if (problem) return setFormError(problem);

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        phone: form.phone.trim(),
      };

      if (formMode === 'add') {
        await API.post('/admin/users', { ...body, password: form.password });
        setNotice({ text: 'Employee added', ok: true });
        setPage(1); // new employees appear at the top of page 1
      } else {
        await API.put(`/admin/users/${editId}`, body);
        setNotice({ text: 'Employee updated', ok: true });
      }

      closeForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Activate / deactivate ----------

  const toggleActive = async (emp) => {
    try {
      if (emp.is_active) {
        if (!window.confirm(`Deactivate ${emp.name}? They will no longer be able to log in.`)) return;
        await API.delete(`/admin/users/${emp.id}`);
        setNotice({ text: `${emp.name} deactivated`, ok: true });
      } else {
        await API.put(`/admin/users/${emp.id}`, {
          name: emp.name,
          email: emp.email,
          department: emp.department || '',
          phone: emp.phone || '',
          is_active: true,
        });
        setNotice({ text: `${emp.name} activated`, ok: true });
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      setNotice({ text: err.response?.data?.message || 'Action failed', ok: false });
    }
  };

  const pages = Math.max(totalPages, 1);
  const filtered = query !== '' || department !== '';

  return (
    <div className="container">
      {formMode && (
        <div className="card">
          <h3>{formMode === 'add' ? 'Add employee' : 'Edit employee'}</h3>
          <div className="form-grid">
            <div>
              <label>Name</label>
              <input name="name" value={form.name} onChange={handleChange} />
            </div>
            <div>
              <label>Email</label>
              <input name="email" value={form.email} onChange={handleChange} />
            </div>
            {formMode === 'add' && (
              <div>
                <label>Password (min 6 characters)</label>
                <input name="password" type="password" value={form.password} onChange={handleChange} />
              </div>
            )}
            <div>
              <label>Department</label>
              <input name="department" value={form.department} onChange={handleChange} />
            </div>
            <div>
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>
          {formError && <p className="msg">{formError}</p>}
          <button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : formMode === 'add' ? 'Add employee' : 'Save changes'}
          </button>{' '}
          <button className="red" onClick={closeForm}>Cancel</button>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Employees ({total})</h3>
          <button onClick={openAdd}>+ Add employee</button>
        </div>

        <div className="toolbar">
          <input
            placeholder="Search by name or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select value={department} onChange={changeDepartment}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {filtered && <button className="red" onClick={clearFilters}>Clear</button>}
        </div>

        {notice.text && <p className={notice.ok ? 'ok' : 'msg'}>{notice.text}</p>}
        {error && <p className="msg">{error}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Email</th><th>Department</th>
                <th>Phone</th><th>Joined</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={e.id} className={e.is_active ? '' : 'inactive'}>
                  <td>{(page - 1) * LIMIT + i + 1}</td>
                  <td>{e.name}</td>
                  <td>{e.email}</td>
                  <td>{e.department || '-'}</td>
                  <td>{e.phone || '-'}</td>
                  <td>{e.joined}</td>
                  <td>
                    <span className={`status ${e.is_active ? 'approved' : 'cancelled'}`}>
                      {e.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="small" onClick={() => openEdit(e)}>Edit</button>
                    <button
                      className={`small ${e.is_active ? 'red' : 'green'}`}
                      onClick={() => toggleActive(e)}
                    >
                      {e.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <p>Loading...</p>}
        {!loading && !error && employees.length === 0 && <p>No employees found.</p>}

        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}