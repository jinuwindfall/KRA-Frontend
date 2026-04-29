import { useEffect, useRef, useState } from 'react';
import { getEmployees, createEmployee, patchEmployee, deleteEmployee, getDepartments, getDepartmentManagers, importEmployees } from '../api/appraisalApi';
import styles from './EmployeesPage.module.css';

const ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'appraiser', label: 'Appraiser' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'hr', label: 'HR' },
];

const EMPTY_FORM = {
  name: '',
  first_name: '',
  last_name: '',
  emp_id: '',
  department: '',
  designation: '',
  role: 'staff',
  date_of_joining: '',
  gender: '',
  appraiser: null,
  reviewer: null,
};

export default function EmployeesPage({ employee, onBack }) {
  const formRef = useRef(null);
  const firstNameInputRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState('');
  const [showTemplateHelp, setShowTemplateHelp] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const isHR = employee?.role === 'hr';
  const canManage = isHR || employee?.role === 'reviewer';

  useEffect(() => {
    Promise.all([getEmployees(), getDepartments()])
      .then(([emps, depts]) => {
        setEmployees(emps);
        setDepartments(depts);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showForm) {
      return;
    }

    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      firstNameInputRef.current?.focus();
    }, 150);
  }, [showForm, editingId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'Appraiser' || name === 'Reviewer' ? (value ? Number(value) : null) : value }));
    // Auto-fill appraiser/reviewer when department changes
    if (name === 'department' && value) {
      getDepartmentManagers(Number(value))
        .then((mgrs) => {
          setForm((prev) => ({
            ...prev,
            appraiser: mgrs.appraiser_id,
            reviewer: mgrs.reviewer_id,
          }));
        })
        .catch(() => {});
    } else if (name === 'department' && !value) {
      setForm((prev) => ({ ...prev, appraiser: null, reviewer: null }));
    }
  };

  const resetFormState = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaveError('');
    setShowForm(false);
  };

  const handleEdit = (emp) => {
    setForm({
      ...EMPTY_FORM,
      name: emp.name || '',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      emp_id: emp.emp_id || '',
      department: emp.department || '',
      designation: emp.designation || '',
      role: emp.role || 'staff',
      date_of_joining: emp.date_of_joining || '',
      gender: emp.gender || '',
      appraiser: emp.appraiser || null,
      reviewer: emp.reviewer || null,
    });
    setEditingId(emp.id);
    setSaveError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        department: form.department ? Number(form.department) : null,
        date_of_joining: form.date_of_joining || null,
        gender: form.gender || null,
        appraiser: form.appraiser || null,
        reviewer: form.reviewer || null,
      };
      if (editingId) {
        await patchEmployee(editingId, payload);
      } else {
        await createEmployee(payload);
      }
      const latestEmployees = await getEmployees();
      setEmployees(latestEmployees);
      resetFormState();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp) => {
    if (emp.id === employee?.id) {
      setSaveError('You cannot delete the currently logged-in account.');
      return;
    }

    if (confirmDeleteId !== emp.id) {
      setConfirmDeleteId(emp.id);
      setSaveError('');
      return;
    }

    setDeletingId(emp.id);
    setSaveError('');
    try {
      await deleteEmployee(emp.id);
      setEmployees((prev) => prev.filter((item) => item.id !== emp.id));
      setConfirmDeleteId(null);
      if (editingId === emp.id) {
        resetFormState();
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelectEmp = (id) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setConfirmBulkDelete(false);
  };

  const selectAllVisibleEmps = () => {
    const visibleIds = employees
      .filter((emp) =>
        emp.id !== employee?.id &&
        (!nameSearch.trim() || (emp.name || '').toLowerCase().includes(nameSearch.trim().toLowerCase()))
      )
      .map((emp) => emp.id);
    setSelectedEmpIds(visibleIds);
    setConfirmBulkDelete(false);
  };

  const handleBulkDeleteEmps = async () => {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setBulkDeleting(true);
    setSaveError('');
    try {
      await Promise.all(selectedEmpIds.map((id) => deleteEmployee(id)));
      setEmployees((prev) => prev.filter((e) => !selectedEmpIds.includes(e.id)));
      setSelectedEmpIds([]);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportError('');
    setImportResult('');
    try {
      const result = await importEmployees(importFile);
      const createdCount = result?.created_count ?? 0;
      const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
      setImportResult(`Imported ${createdCount} employees${warningCount ? ` with ${warningCount} warning(s)` : ''}.`);
      const latestEmployees = await getEmployees();
      setEmployees(latestEmployees);
      setImportFile(null);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'EMP ID',
      'Name Of The Employee',
      'Email ID',
      'Designation',
      'Role',
      'Department',
      'Date of Joining',
      'is_active',
      'Gender',
      'Appraiser',
      'Reviewer',
    ];
    const sampleRow = [
      'EMP001',
      'John Doe',
      'john.doe@company.com',
      'Software Engineer',
      'staff',
      'Engineering',
      '01-December-2023',
      'true',
      'Male',
      'Jane Smith',
      'Robert Brown',
    ];
    const csvContent = `${headers.join(',')}\n${sampleRow.join(',')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employee_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadXlsxTemplate = async () => {
    const XLSX = await import('xlsx');
    const templateRows = [
      {
        'EMP ID': 'EMP001',
        'Name Of The Employee': 'John Doe',
        'Email ID': 'john.doe@company.com',
        'Designation': 'Software Engineer',
        'Role': 'staff',
        'Department': 'Engineering',
        'Date of Joining': '01-December-2023',
        'is_active': true,
        'Gender': 'Male',
        'Appraiser': 'Jane Smith',
        'Reviewer': 'Robert Brown',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateRows, {
      header: [
        'EMP ID',
        'Name Of The Employee',
        'Email ID',
        'Designation',
        'Role',
        'Department',
        'Date of Joining',
        'is_active',
        'Gender',
        'Appraiser',
        'Reviewer',
      ],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    XLSX.writeFile(workbook, 'employee_import_template.xlsx');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h2>Employees</h2>
        {canManage && (
          <button
            className={styles.addBtn}
            onClick={() => {
              if (showForm) {
                resetFormState();
              } else {
                setEditingId(null);
                setForm(EMPTY_FORM);
                setSaveError('');
                setShowForm(true);
              }
            }}
          >
            {showForm ? 'Cancel' : '+ Add Employee'}
          </button>
        )}
      </div>

      {isHR && (
        <section className={styles.importPanel}>
          <h3 className={styles.formTitle}>Bulk Import (HR only)</h3>
          <p className={styles.importHint}>
            Upload CSV or XLSX with columns: <strong>EMP ID, Name Of The Employee, Designation, Role</strong>. Optional: Email ID, Department, Date of Joining, is_active, Gender, Appraiser (emp id), Reviewer (emp id).
          </p>
          <div className={styles.importRow}>
            <button
              type="button"
              className={styles.templateBtn}
              onClick={() => setShowTemplateHelp(true)}
            >
              Template Instructions
            </button>
            <button
              type="button"
              className={styles.templateBtn}
              onClick={handleDownloadTemplate}
            >
              Download Sample CSV
            </button>
            <button
              type="button"
              className={styles.templateBtn}
              onClick={() => {
                void handleDownloadXlsxTemplate();
              }}
            >
              Download Sample XLSX
            </button>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleImport}
              disabled={!importFile || importing}
            >
              {importing ? 'Importing…' : 'Import Employees'}
            </button>
          </div>
          {importError && <div className={styles.saveError}>{importError}</div>}
          {importResult && <div className={styles.importSuccess}>{importResult}</div>}
        </section>
      )}

      {saveError && !showForm && <div className={styles.saveError}>{saveError}</div>}

      {showTemplateHelp && (
        <div className={styles.overlay} onClick={() => setShowTemplateHelp(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Template Instructions</h3>
            <p className={styles.modalSubtitle}>
              Use one row per employee. Username is auto-generated from name and password is employee ID.
            </p>

            <div className={styles.instructionsSection}>
              <h4>Required Columns</h4>
              <p>EMP ID, Name Of The Employee, Designation, Role</p>
            </div>

            <div className={styles.instructionsSection}>
              <h4>Optional Columns</h4>
              <p>Email ID, Department, Date of Joining, is_active, Gender, Appraiser, Reviewer</p>
            </div>

            <div className={styles.instructionsSection}>
              <h4>Allowed Role Values</h4>
              <p>staff, appraiser, reviewer, hr</p>
            </div>

            <div className={styles.instructionsSection}>
              <h4>Format Rules</h4>
              <ul className={styles.instructionsList}>
                <li>Date of Joining format: <strong>01-December-2023</strong>. Also accepts YYYY-MM-DD and DD/Month/YYYY.</li>
                <li>is_active accepts true/false, yes/no, or 1/0.</li>
                <li>Gender accepts Male, Female, or Other.</li>
                <li>Appraiser and Reviewer columns should contain the full name of the respective employee (e.g. Jane Smith).</li>
              </ul>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setShowTemplateHelp(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && canManage && (
        <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
          <h3 className={styles.formTitle}>{editingId ? 'Edit Employee' : 'New Employee'}</h3>
          <p className={styles.importHint}>Username is auto-generated from name and password is set to employee ID.</p>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>First Name</label>
              <input ref={firstNameInputRef} name="first_name" value={form.first_name} onChange={handleChange} />
            </div>
            <div className={styles.field}>
              <label>Last Name</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} />
            </div>
            <div className={styles.field}>
              <label>Employee ID *</label>
              <input name="emp_id" value={form.emp_id} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Designation *</label>
              <input name="designation" value={form.designation} onChange={handleChange} required />
            </div>
            <div className={styles.field}>
              <label>Department</label>
              <select name="department" value={form.department} onChange={handleChange}>
                <option value="">— Select Department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Appraiser</label>
              <select name="appraiser" value={form.appraiser || ''} onChange={handleChange}>
                <option value="">— None —</option>
                {employees.filter(e => e.role === 'appraiser' || e.role === 'reviewer').map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.emp_id})</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Reviewer</label>
              <select name="reviewer" value={form.reviewer || ''} onChange={handleChange}>
                <option value="">— None —</option>
                {employees.filter(e => e.role === 'reviewer').map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.emp_id})</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Role *</label>
              <select name="role" value={form.role} onChange={handleChange} required>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Date of Joining</label>
              <input name="date_of_joining" type="date" value={form.date_of_joining} onChange={handleChange} />
            </div>
            <div className={styles.field}>
              <label>Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange}>
                <option value="">— Select Gender —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {saveError && <div className={styles.saveError}>{saveError}</div>}

          <button className={styles.submitBtn} type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update Employee' : 'Create Employee'}
          </button>
        </form>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Loading…</div>}

      {!loading && !error && employees.length === 0 && (
        <div className={styles.empty}>No employees found.</div>
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

      <div className={styles.tableWrap}>
        {isHR && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selectedEmpIds.length} selected</span>
            <button type="button" className={styles.editBtn} onClick={selectAllVisibleEmps}>Select All</button>
            {selectedEmpIds.length > 0 && (
              <button type="button" className={styles.editBtn} style={{ background: '#64748b' }} onClick={() => { setSelectedEmpIds([]); setConfirmBulkDelete(false); }}>Clear</button>
            )}
            {selectedEmpIds.length > 0 && !confirmBulkDelete && (
              <button type="button" className={styles.deleteBtn} onClick={handleBulkDeleteEmps} disabled={bulkDeleting}>
                Delete Selected ({selectedEmpIds.length})
              </button>
            )}
            {selectedEmpIds.length > 0 && confirmBulkDelete && (
              <>
                <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>Delete {selectedEmpIds.length} employee{selectedEmpIds.length > 1 ? 's' : ''}? This cannot be undone.</span>
                <button type="button" className={styles.deleteBtn} onClick={handleBulkDeleteEmps} disabled={bulkDeleting}>
                  {bulkDeleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
                <button type="button" className={styles.editBtn} style={{ background: '#64748b' }} onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
              </>
            )}
          </div>
        )}
        {employees.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                {isHR && <th></th>}
                <th>Emp ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Role</th>
                <th>Gender</th>
                <th>Appraiser</th>
                <th>Reviewer</th>
                <th>Date of Joining</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.filter((emp) =>
                !nameSearch.trim() ||
                (emp.name || '').toLowerCase().includes(nameSearch.trim().toLowerCase())
              ).map((emp) => (
                <tr key={emp.id}>
                  {isHR && (
                    <td>
                      <input
                        type="checkbox"
                        className={styles.rowCheckbox}
                        checked={selectedEmpIds.includes(emp.id)}
                        disabled={emp.id === employee?.id}
                        onChange={() => toggleSelectEmp(emp.id)}
                      />
                    </td>
                  )}
                  <td>{emp.emp_id}</td>
                  <td>{emp.name}</td>
                  <td>{emp.department_name || '—'}</td>
                  <td>{emp.designation}</td>
                  <td className={styles[`role_${emp.role}`]}>{emp.role}</td>
                  <td>{emp.gender || '—'}</td>
                  <td>{emp.appraiser_name || '—'}</td>
                  <td>{emp.reviewer_name || '—'}</td>
                  <td>{emp.date_of_joining || '—'}</td>
                  {canManage && (
                    <td>
                      <div className={styles.actionGroup}>
                        <button type="button" className={styles.editBtn} onClick={() => handleEdit(emp)}>
                          Edit
                        </button>
                        {confirmDeleteId === emp.id ? (
                          <>
                            <span style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>Delete?</span>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(emp)}
                              disabled={deletingId === emp.id}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              className={styles.editBtn}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(emp)}
                            disabled={deletingId === emp.id || emp.id === employee?.id}
                            title={emp.id === employee?.id ? 'Current logged-in user cannot be deleted' : 'Delete employee'}
                          >
                            {emp.id === employee?.id
                              ? 'Current User'
                              : deletingId === emp.id
                                ? 'Deleting…'
                                : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
