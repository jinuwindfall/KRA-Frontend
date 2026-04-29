import { useEffect, useState } from 'react';
import {
  getEmployees,
  getDepartments,
  setAppraiserDepartments,
  setReviewerDepartments,
} from '../api/appraisalApi';
import styles from './ManagersPage.module.css';

export default function ManagersPage({ employee, onBack }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null); // employee id being saved

  useEffect(() => {
    Promise.all([getEmployees(), getDepartments()])
      .then(([emps, depts]) => {
        setEmployees(emps);
        setDepartments(depts);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const appraisers = employees.filter((e) => e.role === 'appraiser');
  const reviewers = employees.filter((e) => e.role === 'reviewer');

  const toggleDept = (emp, deptId, field) => {
    const currentIds = (emp[field] || []).map((d) => d.id);
    const newIds = currentIds.includes(deptId)
      ? currentIds.filter((id) => id !== deptId)
      : [...currentIds, deptId];

    // Update local state immediately
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === emp.id
          ? { ...e, [field]: departments.filter((d) => newIds.includes(d.id)) }
          : e
      )
    );
  };

  const saveDepts = async (emp, field) => {
    const deptIds = (emp[field] || []).map((d) => d.id);
    setSaving(emp.id);
    try {
      if (field === 'appraiser_departments') {
        await setAppraiserDepartments(emp.id, deptIds);
      } else {
        await setReviewerDepartments(emp.id, deptIds);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className={styles.page}><p>Loading…</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h2>Manage Appraisers & Reviewers</h2>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Appraisers Section ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Appraisers</h3>
        {appraisers.length === 0 && <p className={styles.empty}>No appraisers found.</p>}
        {appraisers.map((app) => (
          <div key={app.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.empName}>{app.name}</span>
              <span className={styles.empId}>{app.emp_id}</span>
              <button
                className={styles.saveBtn}
                disabled={saving === app.id}
                onClick={() => saveDepts(app, 'appraiser_departments')}
              >
                {saving === app.id ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className={styles.deptGrid}>
              {departments.map((d) => {
                const checked = (app.appraiser_departments || []).some((ad) => ad.id === d.id);
                return (
                  <label key={d.id} className={`${styles.deptCheck} ${checked ? styles.deptChecked : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDept(app, d.id, 'appraiser_departments')}
                    />
                    <span>{d.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── Reviewers Section ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Reviewers</h3>
        {reviewers.length === 0 && <p className={styles.empty}>No reviewers found.</p>}
        {reviewers.map((rev) => (
          <div key={rev.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.empName}>{rev.name}</span>
              <span className={styles.empId}>{rev.emp_id}</span>
              <button
                className={styles.saveBtn}
                disabled={saving === rev.id}
                onClick={() => saveDepts(rev, 'reviewer_departments')}
              >
                {saving === rev.id ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className={styles.deptGrid}>
              {departments.map((d) => {
                const checked = (rev.reviewer_departments || []).some((rd) => rd.id === d.id);
                return (
                  <label key={d.id} className={`${styles.deptCheck} ${checked ? styles.deptChecked : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDept(rev, d.id, 'reviewer_departments')}
                    />
                    <span>{d.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
