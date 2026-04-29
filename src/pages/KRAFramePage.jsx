import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllAppraisals,
  getDepartments,
  getEmployees,
  getKRATemplate,
  patchAppraisal,
  saveKRATemplate,
} from '../api/appraisalApi';
import {
  APPRAISAL_TYPE_OPTIONS,
  APPRAISER_FIELD_OPTIONS,
  DEFAULT_FRAME_CONFIG,
  FRAME_STEP_OPTIONS,
  normalizeFrameConfig,
} from '../utils/frameConfig';
import styles from './AppraisalListPage.module.css';

const EMPTY_KRA_ROW = {
  section: 'kra_objectives',
  max_mark: '',
};

const SECTION_LABELS = {
  kra_objectives: 'KRA Objective',
  competencies: 'Competency',
  behaviour: 'Behaviour',
}

function isSpecialAppraisalType(value) {
  return `${value || ''}`.trim().toLowerCase() === 'special';
}

function getEmployeeLabel(employeeRecord) {
  const name = employeeRecord?.name || employeeRecord?.full_name || employeeRecord?.username || 'Staff';
  const empId = employeeRecord?.emp_id ? ` (${employeeRecord.emp_id})` : '';
  return `${name}${empId}`;
}

export default function KRAFramePage({ employee, onBack, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [frameConfig, setFrameConfig] = useState(DEFAULT_FRAME_CONFIG);
  const [templateKras, setTemplateKras] = useState([EMPTY_KRA_ROW]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);

  useEffect(() => {
    Promise.all([getKRATemplate(), getDepartments(), getEmployees()])
      .then(([templateData, departmentList, employeeList]) => {
        const safeDepartments = Array.isArray(departmentList) ? departmentList : [];
        const safeEmployees = Array.isArray(employeeList) ? employeeList : [];

        setDepartments(safeDepartments);
        setEmployees(safeEmployees);

        const data = templateData || {};
        if (data.frame_config) {
          setFrameConfig(normalizeFrameConfig(data.frame_config));
        }
        if (data.rows && data.rows.length > 0) {
          setTemplateKras(data.rows.map((row) => ({
            id: row.id,
            section: row.section,
            max_mark: row.max_mark || '',
          })));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selectableStaff = employees.filter((employeeRecord) => employeeRecord?.id != null);

  const filteredSelectableStaff = useMemo(() => {
    const query = staffSearchQuery.trim().toLowerCase();
    if (!query) return selectableStaff;

    return selectableStaff.filter((staffMember) => {
      const staffName = `${staffMember?.name || ''}`.toLowerCase();
      const staffEmpId = `${staffMember?.emp_id || ''}`.toLowerCase();
      const staffDepartment = `${staffMember?.department || ''}`.toLowerCase();
      return (
        staffName.includes(query)
        || staffEmpId.includes(query)
        || staffDepartment.includes(query)
      );
    });
  }, [selectableStaff, staffSearchQuery]);

  const selectedTargetStaff = useMemo(() => {
    const selectedIds = frameConfig.appraisal_options?.target_staff_ids || [];
    return selectedIds
      .map((staffId) => selectableStaff.find((staffMember) => `${staffMember.id}` === `${staffId}`))
      .filter(Boolean);
  }, [frameConfig.appraisal_options?.target_staff_ids, selectableStaff]);

  const selectedStaffSummary = useMemo(() => {
    if (selectedTargetStaff.length === 0) {
      return 'Select Staff';
    }

    const visibleNames = selectedTargetStaff.slice(0, 3).map((staffMember) => staffMember.name || staffMember.username || 'Staff');
    const remainingCount = selectedTargetStaff.length - visibleNames.length;
    const suffix = remainingCount > 0 ? ` +${remainingCount} more` : '';

    return `${selectedTargetStaff.length} selected: ${visibleNames.join(', ')}${suffix}`;
  }, [selectedTargetStaff]);

  const handleToggleFrameStep = (key) => {
    setFrameConfig((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        [key]: !prev.steps[key],
      },
    }));
  };

  const handleToggleAppraiserField = (key) => {
    setFrameConfig((prev) => ({
      ...prev,
      appraiser_fields: {
        ...prev.appraiser_fields,
        [key]: !prev.appraiser_fields[key],
      },
    }));
  };

  const handleStepWeightChange = (key, value) => {
    const parsed = Math.max(0, Number(value) || 0);
    setFrameConfig((prev) => ({
      ...prev,
      step_weights: {
        ...prev.step_weights,
        [key]: parsed,
      },
    }));
  };

  const handleAppraisalOptionChange = (key, value) => {
    setFrameConfig((prev) => ({
      ...prev,
      appraisal_options: {
        ...prev.appraisal_options,
        [key]: value,
        ...(key === 'default_type' && !isSpecialAppraisalType(value)
          ? { special_appraisal_text: '' }
          : {}),
        ...(key === 'target_scope' && value !== 'selected_staff'
          ? { target_staff_ids: [] }
          : {}),
        ...(key === 'target_scope' && value !== 'department'
          ? { target_department_ids: [] }
          : {}),
      },
    }));

    if (key === 'target_scope' && value !== 'selected_staff') {
      setStaffSearchQuery('');
      setStaffDropdownOpen(false);
    }
    if (key === 'target_scope' && value !== 'department') {
      setDeptSearchQuery('');
      setDeptDropdownOpen(false);
    }
  };

  const filteredDepartments = useMemo(() => {
    const query = deptSearchQuery.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter((dept) => `${dept.name || ''}`.toLowerCase().includes(query));
  }, [departments, deptSearchQuery]);

  const selectedTargetDepts = useMemo(() => {
    const selectedIds = frameConfig.appraisal_options?.target_department_ids || [];
    return selectedIds
      .map((deptId) => departments.find((dept) => `${dept.id}` === `${deptId}`))
      .filter(Boolean);
  }, [frameConfig.appraisal_options?.target_department_ids, departments]);

  const selectedDeptSummary = useMemo(() => {
    if (selectedTargetDepts.length === 0) return 'Select Departments';
    const visibleNames = selectedTargetDepts.slice(0, 3).map((dept) => dept.name || 'Dept');
    const remaining = selectedTargetDepts.length - visibleNames.length;
    const suffix = remaining > 0 ? ` +${remaining} more` : '';
    return `${selectedTargetDepts.length} selected: ${visibleNames.join(', ')}${suffix}`;
  }, [selectedTargetDepts]);

  const handleToggleTargetDept = (deptId) => {
    setFrameConfig((prev) => {
      const deptIds = prev.appraisal_options?.target_department_ids || [];
      const stringId = `${deptId}`;
      const nextDeptIds = deptIds.includes(stringId)
        ? deptIds.filter((id) => id !== stringId)
        : [...deptIds, stringId];
      return {
        ...prev,
        appraisal_options: {
          ...prev.appraisal_options,
          target_department_ids: nextDeptIds,
        },
      };
    });
  };

  const handleToggleTargetStaff = (staffId) => {
    setFrameConfig((prev) => {
      const staffIds = prev.appraisal_options?.target_staff_ids || [];
      const stringId = `${staffId}`;
      const nextStaffIds = staffIds.includes(stringId)
        ? staffIds.filter((id) => id !== stringId)
        : [...staffIds, stringId];

      return {
        ...prev,
        appraisal_options: {
          ...prev.appraisal_options,
          target_staff_ids: nextStaffIds,
        },
      };
    });
  };

  const customFieldRefs = useRef([]);

  const handleAddCustomField = () => {
    setFrameConfig((prev) => {
      const newFields = [
        ...(prev.custom_fields || []),
        {
          key: `custom_${Date.now()}_${(prev.custom_fields || []).length + 1}`,
          label: '',
          type: 'text',
        },
      ];
      // Focus the new input after render
      const newIndex = newFields.length - 1;
      setTimeout(() => {
        const el = customFieldRefs.current[newIndex];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 50);
      return { ...prev, custom_fields: newFields };
    });
  };

  const handleFormulaModeChange = (value) => {
    setFrameConfig((prev) => ({
      ...prev,
      rating_settings: {
        ...prev.rating_settings,
        formula_mode: value,
      },
    }));
  };

  const handleFormulaWeightChange = (key, value) => {
    const parsed = Math.max(0, Number(value) || 0);
    setFrameConfig((prev) => ({
      ...prev,
      rating_settings: {
        ...prev.rating_settings,
        formula_weights: {
          ...prev.rating_settings?.formula_weights,
          [key]: parsed,
        },
      },
    }));
  };

  const handleFormulaExpressionChange = (value) => {
    setFrameConfig((prev) => ({
      ...prev,
      rating_settings: {
        ...prev.rating_settings,
        formula_expression: value,
      },
    }));
  };

  const handleMemoPenaltyChange = (value) => {
    const parsed = Math.max(0, Number(value) || 0);
    setFrameConfig((prev) => ({
      ...prev,
      rating_settings: {
        ...prev.rating_settings,
        memo_penalty: parsed,
      },
    }));
  };

  const handleBandChange = (index, field, value) => {
    setFrameConfig((prev) => ({
      ...prev,
      rating_settings: {
        ...prev.rating_settings,
        bands: (prev.rating_settings?.bands || []).map((band, bandIndex) =>
          bandIndex === index
            ? {
                ...band,
                [field]: field === 'min' ? Math.max(0, Number(value) || 0) : value,
              }
            : band
        ),
      },
    }));
  };

  const handleCustomFieldLabelChange = (index, value) => {
    setFrameConfig((prev) => ({
      ...prev,
      custom_fields: (prev.custom_fields || []).map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, label: value } : field
      ),
    }));
  };

  const handleCustomFieldTypeChange = (index, value) => {
    setFrameConfig((prev) => ({
      ...prev,
      custom_fields: (prev.custom_fields || []).map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, type: value } : field
      ),
    }));
  };

  const handleRemoveCustomField = (index) => {
    setFrameConfig((prev) => ({
      ...prev,
      custom_fields: (prev.custom_fields || []).filter((_, fieldIndex) => fieldIndex !== index),
    }));
  };

  const handleConfirmCustomFields = () => {
    // Mark all non-empty custom fields as confirmed, then save with the updated config
    const confirmedFields = (frameConfig.custom_fields || [])
      .filter((f) => f.label?.trim())
      .map((f) => ({ ...f, confirmed: true }));
    const updatedConfig = { ...frameConfig, custom_fields: confirmedFields };
    setFrameConfig(updatedConfig);
    handleSaveWithConfig(updatedConfig);
  };

  const handleToggleCustomField = (key) => {
    setFrameConfig((prev) => ({
      ...prev,
      custom_fields: (prev.custom_fields || []).map((f) =>
        f.key === key ? { ...f, enabled: !f.enabled } : f
      ),
    }));
  };

  const handleKraFieldChange = (index, event) => {
    const { name, value } = event.target;
    setTemplateKras((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [name]: value } : item
      )
    );
  };

  const kraRowRefs = useRef([]);

  const handleAddKraRow = () => {
    setTemplateKras((prev) => {
      const newRows = [...prev, { ...EMPTY_KRA_ROW }];
      const newIndex = newRows.length - 1;
      setTimeout(() => {
        const el = kraRowRefs.current[newIndex];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstInput = el.querySelector('select, input');
          if (firstInput) firstInput.focus();
        }
      }, 50);
      return newRows;
    });
  };

  const handleRemoveKraRow = (index) => {
    setTemplateKras((prev) => (prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)));
  };

  const handleSave = async () => handleSaveWithConfig(frameConfig);

  // Save everything — confirm any pending custom fields first, then save
  const handleSaveAll = () => {
    const hasPending = (frameConfig.custom_fields || []).some((f) => !f.confirmed && f.label?.trim());
    if (hasPending) {
      const confirmedFields = (frameConfig.custom_fields || [])
        .filter((f) => f.label?.trim())
        .map((f) => ({ ...f, confirmed: true }));
      const updatedConfig = { ...frameConfig, custom_fields: confirmedFields };
      setFrameConfig(updatedConfig);
      handleSaveWithConfig(updatedConfig);
    } else {
      handleSaveWithConfig(frameConfig);
    }
  };

  const handleSaveWithConfig = async (configToSave) => {
    if (employee?.role !== 'hr') {
      setError('Only HR can manage the common KRA structure.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const normalizedFrame = normalizeFrameConfig(configToSave);
      const cleanedFrame = {
        ...normalizedFrame,
        custom_fields: normalizedFrame.custom_fields.filter((field) => field.label?.trim()),
      };

      if (
        cleanedFrame.appraisal_options?.period_from
        && cleanedFrame.appraisal_options?.period_to
        && cleanedFrame.appraisal_options.period_from > cleanedFrame.appraisal_options.period_to
      ) {
        throw new Error('Default appraisal period cannot start after it ends.');
      }

      if (
        isSpecialAppraisalType(cleanedFrame.appraisal_options?.default_type)
        && !cleanedFrame.appraisal_options?.special_appraisal_text?.trim()
      ) {
        throw new Error('Enter special appraisal details when appraisal type is Special.');
      }

      if (cleanedFrame.appraisal_options?.target_scope === 'department'
        && (cleanedFrame.appraisal_options?.target_department_ids || []).length === 0) {
        throw new Error('Select at least one department for department-wise KRA structure.');
      }

      if (cleanedFrame.appraisal_options?.target_scope === 'selected_staff'
        && (cleanedFrame.appraisal_options?.target_staff_ids || []).length === 0) {
        throw new Error('Select at least one staff member for selected-staff KRA structure.');
      }

      const activeWeightedSteps = ['kra_objectives', 'competencies', 'behaviour'].filter(
        (key) => cleanedFrame.steps[key]
      );
      const totalWeight = activeWeightedSteps.reduce(
        (sum, key) => sum + (Number(cleanedFrame.step_weights[key]) || 0),
        0
      );

      if (activeWeightedSteps.length > 0 && totalWeight !== 100) {
        throw new Error('The active step weightage must total 100%.');
      }

      if (cleanedFrame.rating_settings?.formula_mode === 'weighted_average') {
        const formulaWeights = cleanedFrame.rating_settings?.formula_weights || {};
        const formulaTotal = ['appraisee', 'appraiser', 'reviewer'].reduce(
          (sum, key) => sum + (Number(formulaWeights[key]) || 0),
          0
        );
        if (formulaTotal !== 100) {
          throw new Error('The final rating formula weights must total 100%.');
        }
      }

      if (cleanedFrame.rating_settings?.formula_mode === 'custom_formula'
        && !cleanedFrame.rating_settings?.formula_expression?.trim()) {
        throw new Error('Enter the custom final rating formula.');
      }

      const activeRows = templateKras.filter((item) => item.max_mark || item.section);
      if (activeRows.length === 0) {
        throw new Error('Add at least one common KRA row.');
      }

      const sectionCounts = {};
      const preparedRows = activeRows.map((item) => {
        const nextSlNo = (sectionCounts[item.section] || 0) + 1;
        sectionCounts[item.section] = nextSlNo;
        const maxMark = Number(item.max_mark) || 0;
        if (maxMark <= 0) {
          throw new Error('Each common KRA row needs a valid max mark.');
        }
        return { section: item.section, sl_no: nextSlNo, max_mark: maxMark };
      });

      const saved = await saveKRATemplate(cleanedFrame, preparedRows);

      const allAppraisals = await getAllAppraisals();
      const targetScope = cleanedFrame.appraisal_options?.target_scope;
      const selectedStaffIds = new Set((cleanedFrame.appraisal_options?.target_staff_ids || []).map((id) => `${id}`));
      const selectedDepartmentIds = new Set((cleanedFrame.appraisal_options?.target_department_ids || []).map((id) => `${id}`));
      const selectedDepartmentNames = new Set(
        departments
          .filter((dept) => selectedDepartmentIds.has(`${dept.id}`))
          .map((dept) => `${dept.name || ''}`.trim().toLowerCase())
      );

      const targetAppraisals = (Array.isArray(allAppraisals) ? allAppraisals : []).filter((appraisal) => {
        if (targetScope === 'department') {
          const appraisalDeptName = `${appraisal.employee_department || ''}`.trim().toLowerCase();
          const appraisalDeptId = `${appraisal.employee_department_id || ''}`;
          return selectedDepartmentNames.has(appraisalDeptName) || selectedDepartmentIds.has(appraisalDeptId);
        }
        if (targetScope === 'selected_staff') {
          return selectedStaffIds.has(`${appraisal.employee}`);
        }
        return true;
      });

      await Promise.all(
        targetAppraisals.map((appraisal) => {
          const previousExtras = appraisal?.extra_appraiser_data || {};
          const nextExtras = { ...previousExtras };
          if (isSpecialAppraisalType(cleanedFrame.appraisal_options?.default_type)) {
            nextExtras.special_appraisal_text = cleanedFrame.appraisal_options?.special_appraisal_text || '';
          } else {
            delete nextExtras.special_appraisal_text;
          }

          return patchAppraisal(appraisal.id, {
            appraisal_type: cleanedFrame.appraisal_options?.default_type || '',
            period_from: cleanedFrame.appraisal_options?.period_from || '',
            period_to: cleanedFrame.appraisal_options?.period_to || '',
            extra_appraiser_data: nextExtras,
            frame_config: cleanedFrame,
          });
        })
      );

      setTemplateKras(saved.rows.map((row) => ({
        id: row.id,
        section: row.section,
        max_mark: row.max_mark,
      })));
      setSuccess(
        `KRA structure saved and synced to ${targetAppraisals.length} appraisal(s).`
      );
    } catch (err) {
      setError(err.message || 'Failed to save the KRA structure.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Common KRA Structure</h2>
        <div className={styles.headerActions}>
          <button className={styles.navBtn} onClick={onBack}>← Back</button>
        </div>
      </div>

      <div className={styles.infoBanner}>
        HR sets only the common structure here: how many rows each step needs, the max marks, and the rating calculation. Appraisers will fill the actual content later.
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      {loading && <div className={styles.loading}>Loading common structure…</div>}

      {!loading && (
        <div className={styles.formGrid}>
          <div className={`${styles.draftCard} ${styles.sectionCard} ${styles.sectionAppraisal}`}>
            <div className={styles.draftTop}>
              <strong>Appraisal Details</strong>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label>Type of Appraisal</label>
                <select
                  value={frameConfig.appraisal_options?.default_type || APPRAISAL_TYPE_OPTIONS[0]}
                  onChange={(e) => handleAppraisalOptionChange('default_type', e.target.value)}
                >
                  {APPRAISAL_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              {isSpecialAppraisalType(frameConfig.appraisal_options?.default_type) && (
                <div className={styles.inputGroup}>
                  <label>Special Appraisal Details</label>
                  <textarea
                    rows="3"
                    value={frameConfig.appraisal_options?.special_appraisal_text || ''}
                    onChange={(e) => handleAppraisalOptionChange('special_appraisal_text', e.target.value)}
                    placeholder="Enter the reason/details for special appraisal"
                  />
                </div>
              )}
              <div className={styles.inputGroup}>
                <label>Period From</label>
                <input
                  type="date"
                  value={frameConfig.appraisal_options?.period_from || ''}
                  onChange={(e) => handleAppraisalOptionChange('period_from', e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Period To</label>
                <input
                  type="date"
                  value={frameConfig.appraisal_options?.period_to || ''}
                  onChange={(e) => handleAppraisalOptionChange('period_to', e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>KRA Structure Target</label>
                <select
                  value={frameConfig.appraisal_options?.target_scope || 'selected_staff'}
                  onChange={(e) => handleAppraisalOptionChange('target_scope', e.target.value)}
                >
                  <option value="selected_staff">Staff Wise</option>
                  <option value="department">Department Wise</option>
                </select>
              </div>
              {frameConfig.appraisal_options?.target_scope === 'department' && (
                <div className={styles.inputGroup}>
                  <label>Department Selection</label>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setDeptDropdownOpen((prev) => !prev)}
                  >
                    {selectedDeptSummary}
                  </button>
                  {deptDropdownOpen && (
                    <div className={styles.draftCard} style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        value={deptSearchQuery}
                        onChange={(e) => setDeptSearchQuery(e.target.value)}
                        placeholder="Search department..."
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          style={{ padding: '3px 10px', fontSize: '0.78rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                          onClick={() => {
                            const ids = filteredDepartments.map((d) => `${d.id}`);
                            const existing = frameConfig.appraisal_options?.target_department_ids || [];
                            const merged = Array.from(new Set([...existing, ...ids]));
                            handleAppraisalOptionChange('target_department_ids', merged);
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          style={{ padding: '3px 10px', fontSize: '0.78rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                          onClick={() => handleAppraisalOptionChange('target_department_ids', [])}
                        >
                          Unselect All
                        </button>
                      </div>
                      <div className={styles.toggleList} style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                        {departments.length === 0 && <div className={styles.modalSub}>No departments available.</div>}
                        {departments.length > 0 && filteredDepartments.length === 0 && (
                          <div className={styles.modalSub}>No matching departments found.</div>
                        )}
                        {filteredDepartments.map((dept) => {
                          const deptId = `${dept.id}`;
                          const checked = (frameConfig.appraisal_options?.target_department_ids || []).includes(deptId);
                          return (
                            <label key={deptId} className={styles.toggleRow}>
                              <span className={styles.toggleLabel}>{dept.name}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleTargetDept(deptId)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {frameConfig.appraisal_options?.target_scope === 'selected_staff' && (
                <div className={styles.inputGroup}>
                  <label>Staff Selection</label>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setStaffDropdownOpen((prev) => !prev)}
                  >
                    {selectedStaffSummary}
                  </button>
                  {staffDropdownOpen && (
                    <div className={styles.draftCard} style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        placeholder="Search staff by name, emp id, or department"
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          style={{ padding: '3px 10px', fontSize: '0.78rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                          onClick={() => {
                            const ids = filteredSelectableStaff.map((s) => `${s.id}`);
                            const existing = frameConfig.appraisal_options?.target_staff_ids || [];
                            const merged = Array.from(new Set([...existing, ...ids]));
                            handleAppraisalOptionChange('target_staff_ids', merged);
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          style={{ padding: '3px 10px', fontSize: '0.78rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                          onClick={() => handleAppraisalOptionChange('target_staff_ids', [])}
                        >
                          Unselect All
                        </button>
                      </div>
                      <div className={styles.toggleList} style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                        {selectableStaff.length === 0 && <div className={styles.modalSub}>No staff records available.</div>}
                        {selectableStaff.length > 0 && filteredSelectableStaff.length === 0 && (
                          <div className={styles.modalSub}>No matching staff found.</div>
                        )}
                        {filteredSelectableStaff.map((staffMember) => {
                          const staffId = `${staffMember.id}`;
                          const checked = (frameConfig.appraisal_options?.target_staff_ids || []).includes(staffId);
                          return (
                            <label key={staffId} className={styles.toggleRow}>
                              <span className={styles.toggleLabel}>{getEmployeeLabel(staffMember)}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleTargetStaff(staffId)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`${styles.draftCard} ${styles.sectionCard} ${styles.sectionFrame}`}>
            <div className={styles.draftTop}>
              <strong>KRA Step Frame</strong>
            </div>
            <div className={styles.toggleList}>
              {FRAME_STEP_OPTIONS.map((option) => (
                <label key={option.key} className={styles.toggleRow}>
                  <span className={styles.toggleLabel}>{option.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(frameConfig.steps?.[option.key])}
                    onChange={() => handleToggleFrameStep(option.key)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className={`${styles.draftCard} ${styles.sectionCard} ${styles.sectionAppraiser}`}>
            <div className={styles.draftTop}>
              <strong>Appraiser Fields</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={styles.secondaryBtn} onClick={handleAddCustomField}>
                  + Add Extra Field
                </button>
                {(frameConfig.custom_fields || []).some((f) => !f.confirmed && f.label?.trim()) && (
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={handleConfirmCustomFields}
                    disabled={saving || loading}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {saving ? 'Saving…' : '💾 Save Fields'}
                  </button>
                )}
              </div>
            </div>
            <div className={styles.toggleList}>
              {/* Built-in appraiser fields */}
              {APPRAISER_FIELD_OPTIONS.map((option) => (
                <label key={option.key} className={styles.toggleRow}>
                  <span className={styles.toggleLabel}>{option.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(frameConfig.appraiser_fields?.[option.key])}
                    onChange={() => handleToggleAppraiserField(option.key)}
                  />
                </label>
              ))}
              {/* Confirmed custom fields — shown as checkbox rows */}
              {(frameConfig.custom_fields || []).filter((f) => f.confirmed).map((field) => (
                <div key={field.key} className={styles.toggleRow} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.toggleLabel}>
                    {field.label}
                    <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                      {field.type === 'radio' ? 'Radio' : field.type === 'checkbox' ? 'Checkbox' : 'Text'}
                    </span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={field.enabled !== false}
                      onChange={() => handleToggleCustomField(field.key)}
                    />
                    <button
                      type="button"
                      className={styles.removeBtn}
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleRemoveCustomField(
                        (frameConfig.custom_fields || []).findIndex((f) => f.key === field.key)
                      )}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Unconfirmed (new, not yet saved) custom fields — text inputs */}
            {(frameConfig.custom_fields || []).some((f) => !f.confirmed) && (
              <div className={styles.formGrid} style={{ marginTop: '0.5rem' }}>
                {(frameConfig.custom_fields || []).map((field, index) => field.confirmed ? null : (
                  <div key={field.key || index} className={styles.customFieldRow}>
                    <input
                      ref={(el) => { customFieldRefs.current[index] = el; }}
                      type="text"
                      value={field.label || ''}
                      placeholder={`Extra field ${index + 1} — type a name then click Save Fields`}
                      onChange={(e) => handleCustomFieldLabelChange(index, e.target.value)}
                    />
                    <select
                      value={field.type || 'text'}
                      onChange={(e) => handleCustomFieldTypeChange(index, e.target.value)}
                    >
                      <option value="text">Text</option>
                      <option value="radio">Radio (Yes/No)</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => handleRemoveCustomField(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${styles.draftCard} ${styles.sectionCard} ${styles.sectionRating}`}>
            <div className={styles.draftTop}>
              <strong>Rating Calculation</strong>
            </div>
            <div className={styles.formGrid}>
              {[
                { key: 'kra_objectives', label: 'KRA Objectives' },
                { key: 'competencies', label: 'Competencies' },
                { key: 'behaviour', label: 'Behaviour' },
              ].map((option) => (
                <div key={option.key} className={styles.customFieldRow}>
                  <span className={styles.toggleLabel}>{option.label} Weight</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={frameConfig.step_weights?.[option.key] ?? 0}
                    onChange={(e) => handleStepWeightChange(option.key, e.target.value)}
                  />
                </div>
              ))}

              <div className={styles.inputGroup}>
                <label>Final Rating Formula</label>
                <select
                  value={frameConfig.rating_settings?.formula_mode || 'weighted_average'}
                  onChange={(e) => handleFormulaModeChange(e.target.value)}
                >
                  <option value="weighted_average">Weighted average of Appraisee, Appraiser and Reviewer marks</option>
                  <option value="latest_available">Use the latest available mark priority</option>
                  <option value="custom_formula">Custom formula entry</option>
                </select>
              </div>

              {(frameConfig.rating_settings?.formula_mode || 'weighted_average') === 'weighted_average' && (
                <>
                  {[
                    { key: 'appraisee', label: 'Appraisee Contribution' },
                    { key: 'appraiser', label: 'Appraiser Contribution' },
                    { key: 'reviewer', label: 'Reviewer Contribution' },
                  ].map((option) => (
                    <div key={option.key} className={styles.customFieldRow}>
                      <span className={styles.toggleLabel}>{option.label}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={frameConfig.rating_settings?.formula_weights?.[option.key] ?? 0}
                        onChange={(e) => handleFormulaWeightChange(option.key, e.target.value)}
                      />
                    </div>
                  ))}
                </>
              )}

              {(frameConfig.rating_settings?.formula_mode || 'weighted_average') === 'custom_formula' && (
                <div className={styles.inputGroup}>
                  <label>Custom Formula Expression</label>
                  <input
                    type="text"
                    value={frameConfig.rating_settings?.formula_expression || ''}
                    onChange={(e) => handleFormulaExpressionChange(e.target.value)}
                    placeholder="((appraisee * 20) + (appraiser * 40) + (reviewer * 40)) / 100"
                  />
                  <div className={styles.modalSub}>
                    Use appraisee, appraiser and reviewer with +, -, *, /, brackets, and optional min, max, round, ceil or floor.
                  </div>
                </div>
              )}

              <div className={styles.modalSub}>The active scoring steps must total 100%.</div>
            </div>

            <div className={styles.formGrid}>
              {(frameConfig.rating_settings?.bands || []).map((band, index) => (
                <div key={index} className={styles.draftCard}>
                  <div className={styles.inputGroup}>
                    <label>Band Label</label>
                    <input
                      type="text"
                      value={band.label}
                      onChange={(e) => handleBandChange(index, 'label', e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Minimum Score %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={band.min}
                      onChange={(e) => handleBandChange(index, 'min', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.draftCard} ${styles.sectionCard} ${styles.sectionRows}`}>
            <div className={styles.draftTop}>
              <strong>Structure Rows</strong>
            </div>

            {templateKras.map((item, index) => (
              <div key={index} className={styles.draftCard} ref={(el) => { kraRowRefs.current[index] = el; }}>
                <div className={styles.draftTop}>
                  <strong>Row {index + 1}</strong>
                  {templateKras.length > 1 && (
                    <button type="button" className={styles.removeBtn} onClick={() => handleRemoveKraRow(index)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label>Section</label>
                  <select name="section" value={item.section} onChange={(e) => handleKraFieldChange(index, e)}>
                    <option value="kra_objectives">KRA Objectives</option>
                    <option value="competencies">Competencies</option>
                    <option value="behaviour">Behaviour</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Max Mark</label>
                  <input
                    name="max_mark"
                    type="number"
                    min="1"
                    value={item.max_mark}
                    onChange={(e) => handleKraFieldChange(index, e)}
                    placeholder="25"
                  />
                </div>

                <div className={styles.modalSub}>
                  Appraiser content will be entered later for this row.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.modalActions}>
        <button className={styles.secondaryBtn} onClick={onBack}>Back</button>
        <button type="button" className={styles.secondaryBtn} onClick={handleAddKraRow}>
          + Add Row
        </button>
        <button className={styles.editBtn} onClick={handleSaveAll} disabled={saving || loading}>
          {saving ? 'Applying...' : 'Save Common Structure'}
        </button>
      </div>

      <button
        type="button"
        title="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          fontSize: '1.2rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
        }}
      >
        ↑
      </button>
    </div>
  );
}
