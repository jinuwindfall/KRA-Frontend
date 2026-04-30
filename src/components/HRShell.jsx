import { useRef } from 'react';
import styles from '../pages/AppraisalListPage.module.css';

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { key: 'appraisals', label: 'Dashboard', icon: 'dashboard' },
      { key: 'structure', label: 'KRA Structure', icon: 'layers' },
    ],
  },
  {
    label: 'Management',
    items: [
      { key: 'downloads', label: 'Download KRA', icon: 'download' },
      { key: 'employees', label: 'Employees', icon: 'users' },
      { key: 'departments', label: 'Departments', icon: 'building' },
      { key: 'memos', label: 'Memos', icon: 'note' },
    ],
  },
];

function NavIcon({ icon }) {
  switch (icon) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h4v7H4v-7Zm6 0h10v7H10v-7Z" fill="currentColor" />
        </svg>
      );
    case 'layers':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 8.5L12 16l8-4.5M4 16.5 12 21l8-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'download':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4.5 19a4.5 4.5 0 0 1 9 0m1.5 0a3.5 3.5 0 0 1 5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'building':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20V6l7-3 7 3v14M9 9h1m4 0h1M9 13h1m4 0h1M11 20v-3h2v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'note':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h7l5 5v11H7V4Zm7 0v5h5M9 13h6M9 17h6M9 9h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'target':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6v2m0 8v2m4-6h2M6 12H4m8-6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function HRShell({
  employee,
  activePage,
  onNavigate,
  onLogout,
  onOpenMyKra,
  title,
  subtitle,
  children,
}) {
  const hrMainRef = useRef(null);

  const handleScrollTop = () => {
    hrMainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`${styles.page} ${styles.hrPage}`}>
      <div className={styles.hrShell}>
        <aside className={styles.hrSidebar}>
          <div className={styles.hrBrandBlock}>
            <span className={styles.hrBrandOrb} aria-hidden="true" />
            <span className={styles.hrBrandEyebrow}>KRA ADMIN</span>
            <strong className={styles.hrBrandTitle}>HR Dashboard</strong>
          </div>

          <div className={styles.hrSidebarNav}>
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className={styles.hrNavSection}>
                <span className={styles.hrNavSectionLabel}>{section.label}</span>
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.hrSidebarBtn} ${activePage === item.key ? styles.hrSidebarBtnActive : ''}`}
                    onClick={() => onNavigate(item.key)}
                  >
                    <span className={styles.hrSidebarBtnContent}>
                      <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                        <NavIcon icon={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {onOpenMyKra && (
              <div className={styles.hrNavSection}>
                <span className={styles.hrNavSectionLabel}>Quick Access</span>
                <button type="button" className={styles.hrSidebarBtn} onClick={onOpenMyKra}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="target" />
                    </span>
                    <span>My KRA</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className={styles.hrSidebarFooter}>
            <span className={styles.hrSidebarUser}>Logged in as {employee?.name}</span>
            <button type="button" className={styles.hrSidebarLogoutBtn} onClick={onLogout}>
              Logout
            </button>
          </div>
        </aside>

        <div className={styles.hrMain} ref={hrMainRef}>
          <div className={styles.hrTopbar}>
            <div>
              <div className={styles.hrEyebrow}>CONTROL CENTER</div>
              <h2 className={styles.hrTitle}>{title}</h2>
              <p className={styles.hrSubtext}>{subtitle}</p>
            </div>
          </div>

          {children}
        </div>

        <button
          type="button"
          className={styles.scrollTopBtn}
          title="Back to top"
          onClick={handleScrollTop}
        >
          ↑
        </button>
      </div>
    </div>
  );
}