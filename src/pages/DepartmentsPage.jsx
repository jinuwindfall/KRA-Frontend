import { useEffect, useState } from 'react';
import { getDepartments, createDepartment, deleteDepartment, updateDepartment } from '../api/appraisalApi';
import styles from './DepartmentsPage.module.css';

function toTitleCase(str) {
  return str.trim().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function DepartmentsPage({ employee, onBack }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const isReviewer = employee?.role === 'reviewer';
  const isHR = employee?.role === 'hr';
  const canAdd = isReviewer || isHR;

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const dept = await createDepartment(newName.trim());
      setDepartments((prev) => [...prev, dept].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (dept) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setSaveError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (departmentId) => {
    if (!editName.trim()) return;
    setEditSaving(true);
    setSaveError('');
    try {
      const updated = await updateDepartment(departmentId, editName.trim());
      setDepartments((prev) =>
        prev.map((d) => (d.id === departmentId ? updated : d)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const toggleSelectDept = (id) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setConfirmBulkDelete(false);
  };

  const selectAllVisibleDepts = () => {
    const visibleIds = departments
      .filter((d) => !nameSearch.trim() || d.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
      .map((d) => d.id);
    setSelectedDeptIds(visibleIds);
    setConfirmBulkDelete(false);
  };

  const handleBulkDeleteDepts = async () => {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setBulkDeleting(true);
    setSaveError('');
    try {
      await Promise.all(selectedDeptIds.map((id) => deleteDepartment(id)));
      setDepartments((prev) => prev.filter((d) => !selectedDeptIds.includes(d.id)));
      setSelectedDeptIds([]);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const handleDelete = async (departmentId) => {
    if (confirmDeleteId !== departmentId) {
      setConfirmDeleteId(departmentId);
      setSaveError('');
      return;
    }
    setDeletingId(departmentId);
    setConfirmDeleteId(null);
    setSaveError('');
    try {
      await deleteDepartment(departmentId);
      setDepartments((prev) => prev.filter((dept) => dept.id !== departmentId));
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h2>Departments</h2>
      </div>

      {canAdd && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <input
            className={styles.input}
            type="text"
            placeholder="Department name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <button className={styles.addBtn} type="submit" disabled={saving}>
            {saving ? 'Adding…' : '+ Add Department'}
          </button>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
        </form>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Loading…</div>}

      {!loading && !error && departments.length === 0 && (
        <div className={styles.empty}>No departments yet.</div>
      )}

      <div style={{ padding: '0.5rem 0 0.75rem 0', maxWidth: 340 }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🔍 Search by Name
        </label>
        <input
          type="text"
          placeholder="Type a name to filter…"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '2px solid #667eea',
            fontSize: '0.875rem',
            boxSizing: 'border-box',
            background: '#f7f8ff',
            color: '#2d3748',
            boxShadow: '0 1px 4px rgba(102,126,234,0.15)',
          }}
        />
      </div>

      {isHR && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedDeptIds.length} selected</span>
          <button type="button" className={styles.cancelBtn} onClick={selectAllVisibleDepts}>Select All</button>
          {selectedDeptIds.length > 0 && (
            <button type="button" className={styles.cancelBtn} onClick={() => { setSelectedDeptIds([]); setConfirmBulkDelete(false); }}>Clear</button>
          )}
          {selectedDeptIds.length > 0 && !confirmBulkDelete && (
            <button type="button" className={styles.removeBtn} onClick={handleBulkDeleteDepts} disabled={bulkDeleting}>
              Delete Selected ({selectedDeptIds.length})
            </button>
          )}
          {selectedDeptIds.length > 0 && confirmBulkDelete && (
            <>
              <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>Delete {selectedDeptIds.length} department{selectedDeptIds.length > 1 ? 's' : ''}? This cannot be undone.</span>
              <button type="button" className={styles.removeBtn} onClick={handleBulkDeleteDepts} disabled={bulkDeleting}>
                {bulkDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button type="button" className={styles.cancelBtn} onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
            </>
          )}
        </div>
      )}

      <ul className={styles.list}>
        {departments.filter((d) =>
          !nameSearch.trim() ||
          d.name.toLowerCase().includes(nameSearch.trim().toLowerCase())
        ).map((d) => (
          <li className={styles.item} key={d.id}>
            {isHR && (
              <input
                type="checkbox"
                className={styles.rowCheckbox}
                checked={selectedDeptIds.includes(d.id)}
                onChange={() => toggleSelectDept(d.id)}
              />
            )}
            {editingId === d.id ? (
              <input
                className={styles.editInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            ) : (
              <span className={styles.itemName}>{d.name}</span>
            )}
            {isHR && (
              <div className={styles.itemActions}>
                {editingId === d.id ? (
                  <>
                    <button
                      className={styles.saveBtn}
                      onClick={() => handleSaveEdit(d.id)}
                      disabled={editSaving}
                    >
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button className={styles.cancelBtn} onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.editBtn}
                    onClick={() => handleStartEdit(d)}
                    disabled={deletingId === d.id}
                  >
                    Edit
                  </button>
                )}
                {confirmDeleteId === d.id ? (
                  <>
                    <span style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>Delete?</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                    >
                      Yes
                    </button>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingId === d.id || editingId === d.id}
                  >
                    {deletingId === d.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
