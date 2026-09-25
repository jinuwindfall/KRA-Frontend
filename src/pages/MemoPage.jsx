import { useEffect, useState } from 'react';
import { createEmployeeMemo, deleteEmployeeMemo, getEmployeeMemosGrouped, updateEmployeeMemo } from '../api/appraisalApi';
import styles from './AppraisalListPage.module.css';

export default function MemoPage({ onBack, embeddedInShell = false }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // Form state
  const [memoReason, setMemoReason] = useState('');
  const [memoDeduction, setMemoDeduction] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Edit state
  const [editingMemoId, setEditingMemoId] = useState(null);
  const [editReason, setEditReason] = useState('');
  const [editDeduction, setEditDeduction] = useState('');

  const [searchText, setSearchText] = useState('');

  const loadEmployees = () =>
    getEmployeeMemosGrouped().then((list) => {
      setEmployees(Array.isArray(list) ? list : []);
      return list;
    });

  useEffect(() => {
    loadEmployees()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId) || null;
  const memos = selectedEmployee?.memos || [];

  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setMemoReason('');
    setMemoDeduction('');
    setEditingMemoId(null);
    setSaveError('');
  };

  const handleAddMemo = async () => {
    if (!memoReason.trim() || !memoDeduction.trim()) {
      setSaveError('Enter both reason and deduction mark.');
      return;
    }

    const deduction = Number(memoDeduction);
    if (isNaN(deduction) || deduction < 0) {
      setSaveError('Deduction mark must be a valid number >= 0.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await createEmployeeMemo(selectedEmployeeId, memoReason.trim(), deduction);
      await loadEmployees();
      setMemoReason('');
      setMemoDeduction('');
      setSaveSuccess('Memo added successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditMemo = (memo) => {
    setEditingMemoId(memo.id);
    setEditReason(memo.memo);
    setEditDeduction(String(memo.deduction ?? ''));
  };

  const handleSaveEditMemo = async () => {
    if (!editReason.trim() || !editDeduction.trim()) {
      setSaveError('Enter both reason and deduction mark.');
      return;
    }

    const deduction = Number(editDeduction);
    if (isNaN(deduction) || deduction < 0) {
      setSaveError('Deduction mark must be a valid number >= 0.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await updateEmployeeMemo(selectedEmployeeId, editingMemoId, {
        memo: editReason.trim(),
        deduction,
      });
      await loadEmployees();
      setEditingMemoId(null);
      setEditReason('');
      setEditDeduction('');
      setSaveSuccess('Memo updated successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMemo = async (memo) => {
    setSaving(true);
    setSaveError('');
    try {
      await deleteEmployeeMemo(selectedEmployeeId, memo.id);
      await loadEmployees();
      setSaveSuccess('Memo deleted successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMemoId(null);
    setEditReason('');
    setEditDeduction('');
  };

  const filteredEmployees = employees.filter((emp) =>
    !searchText.trim() ||
    (emp.name || '').toLowerCase().includes(searchText.trim().toLowerCase())
  );

  const totalMemoDeduction = memos.reduce((sum, m) => sum + Number(m.deduction || 0), 0);

  const content = (
    <>
      {!embeddedInShell && (
        <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', flex: 1 }}>Staff Memos & Deductions</h2>
          <button
            onClick={onBack}
            style={{
              background: '#fff',
              border: '1.5px solid #2563eb',
              color: '#2563eb',
              borderRadius: '6px',
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.target.style.background = '#fff')}
          >
            ← Back
          </button>
        </div>
      )}

      <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: '0.9rem', color: '#92400e', fontWeight: 500 }}>
        ℹ️ Add memos with deduction marks to adjust staff final performance ratings. Total deduction will be applied from the final score.
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {saveError && <div className={styles.error}>{saveError}</div>}
      {saveSuccess && <div style={{ background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>✔ {saveSuccess}</div>}

      {loading ? (
        <div className={styles.loading}>Loading staff…</div>
      ) : (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1e293b' }}>Search Staff</label>
            <input
              type="text"
              placeholder="Type name or emp ID…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Staff List */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>Staff List</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 500, overflowY: 'auto' }}>
                {filteredEmployees.length === 0 ? (
                  <li style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No staff found.</li>
                ) : (
                  filteredEmployees.map((emp) => (
                    <li
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp.id)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        background: selectedEmployeeId === emp.id ? '#dbeafe' : '#fff',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{emp.name} ({emp.emp_id})</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Dept: {emp.department_name || '—'}
                        {Array.isArray(emp.memos) && emp.memos.length > 0 && (
                          <span> • {emp.memos.length} memo{emp.memos.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Memo Editor */}
            <div>
              {selectedEmployeeId ? (
                <>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>
                    Memos: {selectedEmployee?.name}
                  </h3>

                  {/* Memo Form */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', background: '#f8fafc' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: '#1e293b' }}>Reason for Memo</label>
                      <textarea
                        value={memoReason}
                        onChange={(e) => setMemoReason(e.target.value)}
                        placeholder="E.g., Attendance issue, policy violation, etc."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontFamily: 'system-ui',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: '#1e293b' }}>Deduction Mark (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={memoDeduction}
                        onChange={(e) => setMemoDeduction(e.target.value)}
                        placeholder="5"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      onClick={handleAddMemo}
                      disabled={saving}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Adding…' : '+ Add Memo'}
                    </button>
                  </div>

                  {/* Memos List */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
                      Total Deduction: <span style={{ color: '#dc2626', fontSize: '1.1rem' }}>{totalMemoDeduction}</span> marks
                    </div>
                  </div>

                  {memos.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f1f5f9', borderRadius: 8 }}>
                      No memos yet.
                    </div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {memos.map((memo) => (
                        <li
                          key={memo.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '1rem',
                            background: '#fff',
                          }}
                        >
                          {editingMemoId === memo.id ? (
                            <>
                              <textarea
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.9rem',
                                  marginBottom: '0.5rem',
                                  fontFamily: 'system-ui',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editDeduction}
                                onChange={(e) => setEditDeduction(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.9rem',
                                  marginBottom: '0.5rem',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={handleSaveEditMemo}
                                  disabled={saving}
                                  style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: '#059669',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    opacity: saving ? 0.6 : 1,
                                  }}
                                >
                                  {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                  style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: '#64748b',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    opacity: saving ? 0.6 : 1,
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: '#1e293b' }}>{memo.memo}</strong>
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.75rem' }}>
                                Deduction: <span style={{ color: '#dc2626', fontWeight: 600 }}>{memo.deduction}</span> marks
                                {memo.created_by_name && (
                                  <span> • Added by {memo.created_by_name}</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleEditMemo(memo)}
                                  disabled={saving || editingMemoId !== null}
                                  style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: '#f59e0b',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: saving || editingMemoId !== null ? 'not-allowed' : 'pointer',
                                    opacity: saving || editingMemoId !== null ? 0.6 : 1,
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMemo(memo)}
                                  disabled={saving || editingMemoId !== null}
                                  style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: saving || editingMemoId !== null ? 'not-allowed' : 'pointer',
                                    opacity: saving || editingMemoId !== null ? 0.6 : 1,
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f1f5f9', borderRadius: 8 }}>
                  Select a staff member to manage their memos.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  return embeddedInShell ? content : <div className={styles.page}>{content}</div>;
}
