import { useEffect, useState } from 'react';
import { getAllAppraisals, getAppraisal, patchAppraisal } from '../api/appraisalApi';
import styles from './AppraisalListPage.module.css';

function normalizeMemoList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const reason = String(item.reason ?? item.memo_reason ?? item.note ?? item.remarks ?? '').trim();
      const deduction = Number(item.deduction ?? item.deduction_mark ?? item.mark ?? 0);
      if (!reason) return null;
      return {
        reason,
        deduction: Number.isFinite(deduction) && deduction >= 0 ? deduction : 0,
      };
    })
    .filter(Boolean);
}

function readMemosFromAppraisal(appraisal = {}) {
  const fromExtraData = normalizeMemoList(
    appraisal.extra_appraiser_data?.memos || appraisal.extra_appraiser_data?.memo_history
  );
  if (fromExtraData.length > 0) return fromExtraData;

  const fromDirectField = normalizeMemoList(appraisal.memos);
  if (fromDirectField.length > 0) return fromDirectField;

  const fromAlternativeField = normalizeMemoList(appraisal.memo_entries || appraisal.memo_list);
  if (fromAlternativeField.length > 0) return fromAlternativeField;

  return [];
}

export default function MemoPage({ employee, onBack, embeddedInShell = false }) {
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppraisalId, setSelectedAppraisalId] = useState(null);
  const [selectedAppraisal, setSelectedAppraisal] = useState(null);
  const [memos, setMemos] = useState([]);
  const [loadingAppraisal, setLoadingAppraisal] = useState(false);

  // Form state
  const [memoReason, setMemoReason] = useState('');
  const [memoDeduction, setMemoDeduction] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Edit state
  const [editingMemoIndex, setEditingMemoIndex] = useState(null);
  const [editReason, setEditReason] = useState('');
  const [editDeduction, setEditDeduction] = useState('');

  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    getAllAppraisals()
      .then((list) => {
        // All appraisals returned are for staff
        setAppraisals(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshSelectedAppraisal = async (appraisalId) => {
    const appraisal = await getAppraisal(appraisalId);
    setSelectedAppraisal(appraisal);
    setMemos(readMemosFromAppraisal(appraisal));
    return appraisal;
  };

  const saveMemos = async (updatedMemos) => {
    const actor = employee?.name || employee?.username || employee?.emp_id || 'hr';
    const nowIso = new Date().toISOString();
    const updatedExtraData = {
      ...(selectedAppraisal?.extra_appraiser_data || {}),
      // Persist memos in extra_appraiser_data for reliable backend storage/retrieval.
      memos: updatedMemos,
      memo_history: updatedMemos,
      memo_last_updated_at: nowIso,
      memo_last_updated_by: actor,
      memo_total_deduction: updatedMemos.reduce((sum, m) => sum + Number(m.deduction || 0), 0),
    };

    try {
      await patchAppraisal(selectedAppraisalId, { memos: updatedMemos, extra_appraiser_data: updatedExtraData });
    } catch {
      // Fallback for serializers that don't accept a dedicated "memos" field.
      await patchAppraisal(selectedAppraisalId, { extra_appraiser_data: updatedExtraData });
    }
  };

  const handleSelectAppraisal = async (appraisalId) => {
    setSelectedAppraisalId(appraisalId);
    setLoadingAppraisal(true);
    setSaveError('');
    try {
      await refreshSelectedAppraisal(appraisalId);
      setMemoReason('');
      setMemoDeduction('');
      setEditingMemoIndex(null);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setLoadingAppraisal(false);
    }
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
      const updatedMemos = [
        ...(memos || []),
        { reason: memoReason.trim(), deduction },
      ];
      await saveMemos(updatedMemos);
      await refreshSelectedAppraisal(selectedAppraisalId);
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

  const handleEditMemo = (index) => {
    const memo = memos[index];
    setEditingMemoIndex(index);
    setEditReason(memo.reason);
    setEditDeduction(memo.deduction.toString());
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
      const updatedMemos = memos.map((m, i) =>
        i === editingMemoIndex ? { reason: editReason.trim(), deduction } : m
      );
      await saveMemos(updatedMemos);
      await refreshSelectedAppraisal(selectedAppraisalId);
      setEditingMemoIndex(null);
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

  const handleDeleteMemo = async (index) => {
    setSaving(true);
    setSaveError('');
    try {
      const updatedMemos = memos.filter((_, i) => i !== index);
      await saveMemos(updatedMemos);
      await refreshSelectedAppraisal(selectedAppraisalId);
      setSaveSuccess('Memo deleted successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMemoIndex(null);
    setEditReason('');
    setEditDeduction('');
  };

  const filteredAppraisals = appraisals.filter((a) =>
    !searchText.trim() ||
    (a.employee_name || '').toLowerCase().includes(searchText.trim().toLowerCase())
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
        <div className={styles.loading}>Loading staff appraisals…</div>
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
                {filteredAppraisals.length === 0 ? (
                  <li style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No staff found.</li>
                ) : (
                  filteredAppraisals.map((appraisal) => (
                    <li
                      key={appraisal.id}
                      onClick={() => handleSelectAppraisal(appraisal.id)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        background: selectedAppraisalId === appraisal.id ? '#dbeafe' : '#fff',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{appraisal.employee_name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Dept: {appraisal.employee_department || '—'}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Memo Editor */}
            <div>
              {selectedAppraisalId ? (
                <>
                  {loadingAppraisal && <div className={styles.loading}>Loading selected staff memo data…</div>}
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>
                    Memos: {selectedAppraisal?.employee_name}
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
                      {memos.map((memo, index) => (
                        <li
                          key={index}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '1rem',
                            background: '#fff',
                          }}
                        >
                          {editingMemoIndex === index ? (
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
                                <strong style={{ color: '#1e293b' }}>{memo.reason}</strong>
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.75rem' }}>
                                Deduction: <span style={{ color: '#dc2626', fontWeight: 600 }}>{memo.deduction}</span> marks
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleEditMemo(index)}
                                  disabled={saving || editingMemoIndex !== null}
                                  style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: '#f59e0b',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: saving || editingMemoIndex !== null ? 'not-allowed' : 'pointer',
                                    opacity: saving || editingMemoIndex !== null ? 0.6 : 1,
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMemo(index)}
                                  disabled={saving || editingMemoIndex !== null}
                                  style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    cursor: saving || editingMemoIndex !== null ? 'not-allowed' : 'pointer',
                                    opacity: saving || editingMemoIndex !== null ? 0.6 : 1,
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
