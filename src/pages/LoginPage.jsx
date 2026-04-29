import { useState } from 'react';
import { login, resetPassword } from '../api/appraisalApi';
import styles from './LoginPage.module.css';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetEmpId, setResetEmpId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      localStorage.setItem('kra_token', data.token);
      localStorage.setItem('kra_employee', JSON.stringify(data.employee));
      onLogin(data.employee);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);
    try {
      const data = await resetPassword(resetUsername, resetEmpId, newPassword);
      setResetMessage(data.message || 'Password reset successful.');
      setResetUsername('');
      setResetEmpId('');
      setNewPassword('');
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <h1>KRA Portal</h1>
          <p>Performance Appraisal System</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 5C6.5 5 2.1 8.3 1 12c1.1 3.7 5.5 7 11 7s9.9-3.3 11-7c-1.1-3.7-5.5-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                    fill="currentColor"
                  />
                  {!showPassword && (
                    <path
                      d="M4 20L20 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setShowReset((prev) => !prev);
              setResetError('');
              setResetMessage('');
            }}
          >
            {showReset ? 'Hide Reset Password' : 'Forgot/Reset Password'}
          </button>
        </form>

        {showReset && (
          <form className={styles.resetForm} onSubmit={handleResetPassword}>
            <h3>Reset Password</h3>
            {resetError && <div className={styles.error}>{resetError}</div>}
            {resetMessage && <div className={styles.success}>{resetMessage}</div>}

            <div className={styles.field}>
              <label htmlFor="resetUsername">Username</label>
              <input
                id="resetUsername"
                type="text"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="resetEmpId">Employee ID</label>
              <input
                id="resetEmpId"
                type="text"
                value={resetEmpId}
                onChange={(e) => setResetEmpId(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="newPassword">New Password</label>
              <div className={styles.passwordWrap}>
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      d="M12 5C6.5 5 2.1 8.3 1 12c1.1 3.7 5.5 7 11 7s9.9-3.3 11-7c-1.1-3.7-5.5-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                      fill="currentColor"
                    />
                    {!showNewPassword && (
                      <path
                        d="M4 20L20 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button className={styles.btn} type="submit" disabled={resetLoading}>
              {resetLoading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
