import { useState } from 'react';
import { changePassword } from '../api/appraisalApi';
import styles from './ChangePasswordPage.module.css';

export default function ChangePasswordPage({ employee, onBack, onLogout }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.new_password.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await changePassword(form.current_password, form.new_password);
      setSuccess(result.message || 'Password changed. Please log in again.');
      // Auto logout after short delay since token is invalidated
      setTimeout(() => onLogout(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
        </div>

        <h2 className={styles.title}>Change Password</h2>
        <p className={styles.subtitle}>
          Logged in as <strong>{employee?.name}</strong> ({employee?.emp_id})
        </p>

        {success ? (
          <div className={styles.successBox}>{success} Redirecting to login…</div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label>Current Password</label>
              <input
                type="password"
                name="current_password"
                value={form.current_password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>
            <div className={styles.field}>
              <label>New Password</label>
              <input
                type="password"
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
            <div className={styles.field}>
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button className={styles.submitBtn} type="submit" disabled={saving}>
              {saving ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
