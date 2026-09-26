import { useEffect, useMemo, useRef, useState } from 'react';
import { createKRA, deleteKRA, getAllAppraisals, getDepartments, getMyAppraisals, patchAppraisal, patchKRA } from '../api/appraisalApi';
import { APPRAISAL_TYPE_OPTIONS, APPRAISER_FIELD_OPTIONS, DEFAULT_FRAME_CONFIG, FRAME_STEP_OPTIONS, normalizeFrameConfig } from '../utils/frameConfig';
import { getFinalMark, getOverallPerformance } from '../utils/ratingUtils';
import { pickActiveAppraisal } from '../utils/appraisalSelection';
import styles from './AppraisalListPage.module.css';

const BADGE_CLASS = {
  Draft: styles.badgeDraft,
  'Employee Submitted': styles.badgeSubmitted,
  'Appraiser Submitted': styles.badgeAppraiserReviewed,
  Reviewed: styles.badgeReviewed,
};

const SECTION_LABELS = {
  kra_objectives: 'KRA Objectives',
  competencies: 'Competencies',
  behaviour: 'Behaviour',
};

const ROLE_LABEL = {
  appraiser: 'Appraiser',
  reviewer: 'Reviewer',
  hr: 'HR',
  staff: 'Staff',
};

const DEFAULT_EXPORT_FIELDS = {
  employee_details: true,
  kra_objectives: true,
  competencies: true,
  behaviour: true,
  appraiser_assessment: true,
  remarks: true,
  performance_ratings: true,
};

const EXPORT_FIELD_OPTIONS = [
  { key: 'employee_details', label: 'Employee Details' },
  { key: 'kra_objectives', label: 'KRA Objectives' },
  { key: 'competencies', label: 'Competencies' },
  { key: 'behaviour', label: 'Behaviour' },
  { key: 'appraiser_assessment', label: 'Appraiser Assessment' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'performance_ratings', label: 'Performance Ratings' },
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
    case 'spark':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 9.8 9.8 3 12l6.8 2.2L12 21l2.2-6.8L21 12l-6.8-2.2L12 3Z" fill="currentColor" />
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

function sanitizeSheetName(value, index) {
  const cleaned = String(value || `Staff ${index + 1}`)
    .replace(/[\\/?*\[\]:]/g, ' ')
    .trim();
  return (cleaned || `Staff ${index + 1}`).slice(0, 31);
}

function toDisplayValue(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function normalizeAppraisalType(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  const matched = APPRAISAL_TYPE_OPTIONS.find(
    (option) => option.toLowerCase() === normalized
  );

  return matched || DEFAULT_FRAME_CONFIG.appraisal_options.default_type;
}

function isSpecialAppraisalType(value) {
  return `${value || ''}`.trim().toLowerCase() === 'special';
}

export default function AppraisalListPage({
  employee,
  onSelect,
  onLogout,
  onNavigate,
  onOpenMyKra,
  selectedAppraisalIds = [],
  setSelectedAppraisalIds,
}) {
  const hrMainRef = useRef(null);
  const [appraisals, setAppraisals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [nameSearch, setNameSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessUpdating, setAccessUpdating] = useState(false);
  const [ratingBannerMessage, setRatingBannerMessage] = useState('');
  const [ratingBannerState, setRatingBannerState] = useState(null);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingDepartmentSearch, setRatingDepartmentSearch] = useState('');
  const [ratingStaffSearch, setRatingStaffSearch] = useState('');
  const [ratingSelectedDepartments, setRatingSelectedDepartments] = useState([]);
  const [ratingSelectedStaff, setRatingSelectedStaff] = useState([]);
  const [kraModalOpen, setKraModalOpen] = useState(false);
  const [selectedAppraisalForKra, setSelectedAppraisalForKra] = useState(null);
  const [kraSaving, setKraSaving] = useState(false);
  const [kraError, setKraError] = useState('');
  const [kraSuccess, setKraSuccess] = useState('');
  const [kraDrafts, setKraDrafts] = useState([
    { section: 'kra_objectives', title: '', description: '', max_mark: '' },
  ]);
  const [appraisalMeta, setAppraisalMeta] = useState({
    appraisal_type: DEFAULT_FRAME_CONFIG.appraisal_options.default_type,
    period_from: '',
    period_to: '',
    special_appraisal_text: '',
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAppraisalForEdit, setSelectedAppraisalForEdit] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editKras, setEditKras] = useState([]);
  const [frameConfig, setFrameConfig] = useState(DEFAULT_FRAME_CONFIG);
  const [removedKraIds, setRemovedKraIds] = useState([]);

  const isHR = employee?.role === 'hr';
  const isReviewer = employee?.role === 'reviewer';
  const isAppraiser = employee?.role === 'appraiser';
  const isRoleShell = isHR || isReviewer || isAppraiser;
  const showDepartmentFilter = isHR || isReviewer || isAppraiser;

  useEffect(() => {
    Promise.all([getAllAppraisals(), getDepartments()])
      .then(([appraisalList, departmentList]) => {
        setAppraisals(appraisalList);
        setDepartments(departmentList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const markSectionVisible = appraisals.some((a) => Boolean(a.mark_entry_access_open));

  const availableDepartments = useMemo(() => {
    const role = employee?.role;
    if (role === 'appraiser' || role === 'reviewer') {
      // Derive departments only from the appraisals visible to this user
      const seen = new Map();
      for (const a of appraisals) {
        if (a.employee_department && !seen.has(a.employee_department)) {
          seen.set(a.employee_department, { id: a.employee_department, name: a.employee_department });
        }
      }
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...departments].sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, appraisals, employee?.role]);

  const ratingDepartmentOptions = useMemo(() => {
    const seen = new Set();
    return appraisals
      .map((appraisal) => appraisal.employee_department)
      .filter((deptName) => {
        if (!deptName || seen.has(deptName)) return false;
        seen.add(deptName);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [appraisals]);

  const ratingAllStaffOptions = useMemo(() => {
    const seen = new Set();
    return appraisals
      .map((appraisal) => ({
        employeeId: `${appraisal.employee}`,
        employeeName: appraisal.employee_name || `Employee #${appraisal.employee}`,
        employeeEmpId: appraisal.employee_emp_id || '',
        employeeDepartment: appraisal.employee_department || '—',
      }))
      .filter((staff) => {
        if (!staff.employeeId || seen.has(staff.employeeId)) return false;
        seen.add(staff.employeeId);
        return true;
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [appraisals]);

  const ratingStaffOptions = useMemo(() => {
    if (ratingSelectedDepartments.length === 0) {
      return ratingAllStaffOptions;
    }
    return ratingAllStaffOptions.filter((staff) =>
      ratingSelectedDepartments.includes(staff.employeeDepartment)
    );
  }, [ratingAllStaffOptions, ratingSelectedDepartments]);

  const filteredRatingDepartmentOptions = useMemo(() => {
    const query = ratingDepartmentSearch.trim().toLowerCase();
    if (!query) return ratingDepartmentOptions;
    return ratingDepartmentOptions.filter((dept) => dept.toLowerCase().includes(query));
  }, [ratingDepartmentOptions, ratingDepartmentSearch]);

  const filteredRatingStaffOptions = useMemo(() => {
    const query = ratingStaffSearch.trim().toLowerCase();
    if (!query) return ratingStaffOptions;
    return ratingStaffOptions.filter((staff) => {
      const name = `${staff.employeeName || ''}`.toLowerCase();
      const empId = `${staff.employeeEmpId || ''}`.toLowerCase();
      const dept = `${staff.employeeDepartment || ''}`.toLowerCase();
      return name.includes(query) || empId.includes(query) || dept.includes(query);
    });
  }, [ratingStaffOptions, ratingStaffSearch]);

  const filteredAppraisals = useMemo(() => {
    let result = appraisals;
    if (selectedDepartment !== 'all') {
      result = result.filter((a) => a.employee_department === selectedDepartment);
    }
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      result = result.filter((a) => (a.employee_name || '').toLowerCase().includes(q));
    }
    return result;
  }, [appraisals, selectedDepartment, nameSearch]);

  const selectedKraFrameConfig = useMemo(
    () => normalizeFrameConfig(selectedAppraisalForKra?.frame_config),
    [selectedAppraisalForKra?.frame_config]
  );

  const displayAppraisals = useMemo(() => {
    const grouped = new Map();

    const getMeta = (item) => ({
      periodTo: item?.period_to ? new Date(item.period_to).getTime() : 0,
      updatedAt: item?.updated_at ? new Date(item.updated_at).getTime() : 0,
      kraCount: Array.isArray(item?.kras) ? item.kras.length : 0,
    });

    filteredAppraisals.forEach((appraisal) => {
      const key = appraisal.employee ?? appraisal.employee_name;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...appraisal, recordCount: 1 });
        return;
      }

      const currentMeta = getMeta(appraisal);
      const existingMeta = getMeta(existing);
      const shouldReplace =
        currentMeta.periodTo > existingMeta.periodTo ||
        (currentMeta.periodTo === existingMeta.periodTo && currentMeta.updatedAt > existingMeta.updatedAt) ||
        (currentMeta.periodTo === existingMeta.periodTo &&
          currentMeta.updatedAt === existingMeta.updatedAt &&
          currentMeta.kraCount > existingMeta.kraCount);

      grouped.set(key, {
        ...(shouldReplace ? appraisal : existing),
        recordCount: (existing.recordCount || 1) + 1,
      });
    });

    return Array.from(grouped.values());
  }, [filteredAppraisals]);

  const handleOpenRatingModal = () => {
    const allDepartments = [...ratingDepartmentOptions];
    const allStaffIds = ratingAllStaffOptions.map((staff) => staff.employeeId);
    setRatingSelectedDepartments(allDepartments);
    setRatingSelectedStaff(allStaffIds);
    setRatingDepartmentSearch('');
    setRatingStaffSearch('');
    setRatingModalOpen(true);
  };

  const handleToggleRatingDepartment = (departmentName) => {
    setRatingSelectedDepartments((prev) => (
      prev.includes(departmentName)
        ? prev.filter((item) => item !== departmentName)
        : [...prev, departmentName]
    ));
  };

  const handleToggleRatingStaff = (staffId) => {
    setRatingSelectedStaff((prev) => (
      prev.includes(staffId)
        ? prev.filter((item) => item !== staffId)
        : [...prev, staffId]
    ));
  };

  const handleApplyMarkSectionAccess = async (nextAccessState) => {
    if (!isHR || appraisals.length === 0) return;

    if (ratingSelectedDepartments.length === 0 && ratingSelectedStaff.length === 0) {
      setError('Select at least one department or one staff member to update rating visibility.');
      return;
    }

    const targetAppraisals = appraisals.filter((appraisal) => (
      (ratingSelectedDepartments.length === 0
        || ratingSelectedDepartments.includes(appraisal.employee_department))
      && (ratingSelectedStaff.length === 0
        || ratingSelectedStaff.includes(`${appraisal.employee}`))
    ));

    if (targetAppraisals.length === 0) {
      setError('No appraisals matched the selected department and staff filters.');
      return;
    }

    setAccessUpdating(true);
    setError('');

    try {
      const updatedAppraisals = await Promise.all(
        targetAppraisals.map((appraisal) =>
          patchAppraisal(appraisal.id, { mark_entry_access_open: nextAccessState })
        )
      );
      const updatedMap = new Map(updatedAppraisals.map((appraisal) => [appraisal.id, appraisal]));
      setAppraisals((prev) => prev.map((appraisal) => updatedMap.get(appraisal.id) || appraisal));
      const formatSelectedNames = (names) => {
        if (names.length <= 3) return names.join(', ');
        return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
      };

      const selectedDepartmentLabel = (
        ratingSelectedDepartments.length === 0
        || ratingSelectedDepartments.length === ratingDepartmentOptions.length
      )
        ? 'all departments'
        : `department${ratingSelectedDepartments.length > 1 ? 's' : ''}: ${formatSelectedNames(ratingSelectedDepartments)}`;

      const selectedStaffNames = ratingSelectedStaff
        .map((staffId) => ratingAllStaffOptions.find((staff) => staff.employeeId === staffId)?.employeeName)
        .filter(Boolean);
      const selectedStaffLabel = (
        ratingSelectedStaff.length === 0
        || ratingSelectedStaff.length === ratingAllStaffOptions.length
      )
        ? 'all staff'
        : `staff: ${formatSelectedNames(selectedStaffNames)}`;

      setRatingBannerState(nextAccessState);
      setRatingBannerMessage(
        `Rating section ${nextAccessState ? 'shown' : 'hidden'} for ${targetAppraisals.length} appraisal(s) using ${selectedDepartmentLabel} and ${selectedStaffLabel}.`
      );
      setRatingModalOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccessUpdating(false);
    }
  };

  const handleToggleAppraisalSelection = (appraisalId) => {
    setSelectedAppraisalIds((prev) =>
      prev.includes(appraisalId)
        ? prev.filter((id) => id !== appraisalId)
        : [...prev, appraisalId]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = displayAppraisals.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedAppraisalIds.includes(id));

    setSelectedAppraisalIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const handleToggleExportField = (key) => {
    setExportFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExportAppraisals = async (targetAppraisals, label) => {
    if (!isHR) return;
    if (!targetAppraisals.length) {
      setError(label === 'selected'
        ? 'Select at least one staff card to download selected KRA forms.'
        : 'No staff appraisals available to download.');
      return;
    }

    if (!Object.values(exportFields).some(Boolean)) {
      setError('Choose at least one field to download.');
      return;
    }

    setExporting(true);
    setError('');

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const summaryHeaders = ['Employee'];
      if (exportFields.employee_details) {
        summaryHeaders.push('Department', 'Appraisal Type', 'Period From', 'Period To', 'Status');
      }
      if (exportFields.performance_ratings) {
        summaryHeaders.push('Net Rating', 'Performance Band');
      }
      const summaryRows = [summaryHeaders];

      const addSectionTable = (rows, heading, items, appraisal) => {
        rows.push([heading]);
        rows.push(['Sl No', 'Title', 'Description', 'Max Mark', 'Appraisee', 'Appraiser', 'Reviewer', 'Final Rating']);

        if (!items.length) {
          rows.push(['—', 'No rows available', '', '', '', '', '', '']);
          rows.push([]);
          return;
        }

        items.forEach((kra, index) => {
          const hasAnyMark = [kra.appraisee_mark, kra.appraiser_mark, kra.reviewer_mark].some(
            (value) => value !== null && value !== undefined && value !== ''
          );

          rows.push([
            kra.sl_no ?? index + 1,
            kra.title || `${heading} Row ${index + 1}`,
            kra.description || '',
            Number(kra.max_mark) || 0,
            kra.appraisee_mark ?? '',
            kra.appraiser_mark ?? '',
            kra.reviewer_mark ?? '',
            hasAnyMark ? Number(getFinalMark(kra, {}, appraisal)).toFixed(2) : '',
          ]);
        });

        rows.push([]);
      };

      targetAppraisals.forEach((appraisal) => {
        const overall = getOverallPerformance(appraisal, {});
        const row = [appraisal.employee_name || ''];

        if (exportFields.employee_details) {
          row.push(
            appraisal.employee_department || '',
            appraisal.appraisal_type || '',
            appraisal.period_from || '',
            appraisal.period_to || '',
            appraisal.status || ''
          );
        }

        if (exportFields.performance_ratings) {
          row.push(overall.netRating.toFixed(2), overall.performanceBand);
        }

        summaryRows.push(row);
      });

      targetAppraisals.forEach((appraisal, index) => {
        const overall = getOverallPerformance(appraisal, {});
        const ratingSettings = appraisal?.frame_config?.rating_settings || {};
        const formulaMode = ratingSettings?.formula_mode || 'custom_formula';
        const formulaText = formulaMode === 'custom_formula'
          ? (ratingSettings?.formula_expression || '')
          : formulaMode === 'weighted_average'
            ? `Appraisee ${ratingSettings?.formula_weights?.appraisee ?? 0}% + Appraiser ${ratingSettings?.formula_weights?.appraiser ?? 0}% + Reviewer ${ratingSettings?.formula_weights?.reviewer ?? 0}%`
            : 'Latest available mark priority';

        const rows = [
          ['PERFORMANCE APPRAISAL FORM'],
          [],
        ];

        if (exportFields.employee_details) {
          rows.push(
            ['Employee Details'],
            ['Employee Name', appraisal.employee_name || '', 'Department', appraisal.employee_department || '—'],
            ['Appraisal Type', appraisal.appraisal_type || '', 'Status', appraisal.status || ''],
            ['Period From', appraisal.period_from || '', 'Period To', appraisal.period_to || ''],
            []
          );
        }

        if (exportFields.kra_objectives) {
          addSectionTable(
            rows,
            'KRA OBJECTIVES',
            (appraisal.kras || []).filter((kra) => kra.section === 'kra_objectives'),
            appraisal
          );
        }
        if (exportFields.competencies) {
          addSectionTable(
            rows,
            'COMPETENCIES',
            (appraisal.kras || []).filter((kra) => kra.section === 'competencies'),
            appraisal
          );
        }
        if (exportFields.behaviour) {
          addSectionTable(
            rows,
            'BEHAVIOUR',
            (appraisal.kras || []).filter((kra) => kra.section === 'behaviour'),
            appraisal
          );
        }

        if (exportFields.appraiser_assessment) {
          rows.push(
            ['APPRAISER ASSESSMENT'],
            ['Strong Areas', toDisplayValue(appraisal.strong_areas)],
            ['Weak Areas', toDisplayValue(appraisal.weak_areas)],
            ['Training Need A', toDisplayValue(appraisal.training_need_a)],
            ['Training Need B', toDisplayValue(appraisal.training_need_b)],
            ['Training Need C', toDisplayValue(appraisal.training_need_c)],
            ['Eligible for Confirmation', toDisplayValue(appraisal.eligible_for_confirmation)],
            ['Additional Responsibilities', toDisplayValue(appraisal.considered_for_additional_responsibilities)],
            []
          );

          const extraAppraiserData = appraisal.extra_appraiser_data || {};
          const customFields = appraisal?.frame_config?.custom_fields || [];
          if (customFields.length) {
            rows.push(['CUSTOM APPRAISER FIELDS']);
            customFields.forEach((field, fieldIndex) => {
              rows.push([
                field.label || `Extra Field ${fieldIndex + 1}`,
                toDisplayValue(extraAppraiserData[field.key])
              ]);
            });
            rows.push([]);
          }
        }

        if (exportFields.remarks) {
          rows.push(
            ['REMARKS'],
            ['Employee Remarks', toDisplayValue(appraisal.employee_remarks)],
            ['Appraiser Remarks', toDisplayValue(appraisal.appraiser_remarks)],
            ['Reviewer Remarks', toDisplayValue(appraisal.reviewer_remarks)],
            ['MGMT / HR Remarks', toDisplayValue(appraisal.mgmt_hr_remarks)],
            []
          );
        }

        if (exportFields.performance_ratings) {
          rows.push(
            ['PERFORMANCE RATINGS'],
            ['Formula Used', formulaText],
            ['KRA Objectives Ratio', `${overall.part1Rating.toFixed(2)}%`],
            ['Competencies Ratio', `${overall.competenciesMetrics.ratio.toFixed(2)}%`],
            ['Behaviour Ratio', `${overall.behaviourMetrics.ratio.toFixed(2)}%`],
            ['KRA Objectives Weighted', overall.weightedPart1.toFixed(2)],
            ['Attributes Weighted', overall.weightedPart2.toFixed(2)],
            ['Total Ratings', overall.totalRating.toFixed(2)],
            ['Memo / Warning Deduction', overall.memoPenalty.toFixed(2)],
            ['Net Ratings', overall.netRating.toFixed(2)],
            ['Final Qualifying Ratings', overall.performanceBand]
          );
        }

        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = [
          { wch: 22 },
          { wch: 28 },
          { wch: 22 },
          { wch: 42 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
        ];
        sheet['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
        ];

        XLSX.utils.book_append_sheet(
          workbook,
          sheet,
          sanitizeSheetName(appraisal.employee_name || `Staff ${index + 1}`, index)
        );
      });

      if (targetAppraisals.length > 1) {
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
        summarySheet['!cols'] = [
          { wch: 24 },
          { wch: 20 },
          { wch: 18 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 12 },
          { wch: 28 },
        ];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Staff Summary');
      }

      const fileSuffix = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `kra_sheet_${label}_${fileSuffix}.xlsx`);
    } catch (err) {
      setError(err.message || 'Failed to download the KRA forms.');
    } finally {
      setExporting(false);
    }
  };

  const openKraModal = (appraisal) => {
    const normalizedFrame = normalizeFrameConfig(appraisal.frame_config);
    setSelectedAppraisalForKra(appraisal);
    setKraModalOpen(true);
    setKraError('');
    setKraSuccess('');
    setKraDrafts([
      { section: 'kra_objectives', title: '', description: '', max_mark: '' },
    ]);
    setAppraisalMeta({
      appraisal_type: normalizeAppraisalType(
        appraisal.appraisal_type || normalizedFrame.appraisal_options.default_type
      ),
      period_from: appraisal.period_from || normalizedFrame.appraisal_options.period_from || '',
      period_to: appraisal.period_to || normalizedFrame.appraisal_options.period_to || '',
      special_appraisal_text: appraisal.extra_appraiser_data?.special_appraisal_text || '',
    });
  };

  const closeKraModal = () => {
    setKraModalOpen(false);
    setSelectedAppraisalForKra(null);
    setKraError('');
    setKraSuccess('');
  };

  const openEditModal = (appraisal) => {
    const normalizedFrame = normalizeFrameConfig(appraisal.frame_config);
    setSelectedAppraisalForEdit(appraisal);
    setEditModalOpen(true);
    setEditError('');
    setEditSuccess('');
    setRemovedKraIds([]);
    setFrameConfig(normalizedFrame);
    setAppraisalMeta({
      appraisal_type: normalizeAppraisalType(
        appraisal.appraisal_type || normalizedFrame.appraisal_options.default_type
      ),
      period_from: appraisal.period_from || normalizedFrame.appraisal_options.period_from || '',
      period_to: appraisal.period_to || normalizedFrame.appraisal_options.period_to || '',
      special_appraisal_text: appraisal.extra_appraiser_data?.special_appraisal_text || '',
    });
    setEditKras(
      (appraisal.kras || []).map((kra) => ({
        id: kra.id,
        section: kra.section,
        title: kra.title || '',
        description: kra.description || '',
        max_mark: kra.max_mark || '',
      }))
    );
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedAppraisalForEdit(null);
    setEditError('');
    setEditSuccess('');
    setEditKras([]);
    setRemovedKraIds([]);
    setFrameConfig(DEFAULT_FRAME_CONFIG);
  };

  const handleKraFieldChange = (index, e) => {
    const { name, value } = e.target;
    setKraDrafts((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [name]: value } : item
      )
    );
  };

  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'appraisal_type' ? normalizeAppraisalType(value) : value;
    setAppraisalMeta((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === 'appraisal_type' && !isSpecialAppraisalType(nextValue)
        ? { special_appraisal_text: '' }
        : {}),
    }));
  };

  const handleEditKraFieldChange = (index, e) => {
    const { name, value } = e.target;
    setEditKras((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [name]: value } : item
      )
    );
  };

  const handleAddKraDraft = () => {
    setKraDrafts((prev) => [
      ...prev,
      { section: 'kra_objectives', title: '', description: '', max_mark: '' },
    ]);
  };

  const handleAddEditKra = () => {
    setEditKras((prev) => [
      ...prev,
      { section: 'kra_objectives', title: '', description: '', max_mark: '' },
    ]);
  };

  const handleRemoveEditKra = (index) => {
    setEditKras((prev) => {
      const target = prev[index];
      if (target?.id) {
        setRemovedKraIds((ids) => [...ids, target.id]);
      }
      if (prev.length === 1) return [];
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

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

  const handleAddCustomField = () => {
    setFrameConfig((prev) => ({
      ...prev,
      custom_fields: [
        ...(prev.custom_fields || []),
        {
          key: `custom_${Date.now()}_${(prev.custom_fields || []).length + 1}`,
          label: '',
          type: 'text',
        },
      ],
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

  const handleRemoveCustomField = (index) => {
    setFrameConfig((prev) => ({
      ...prev,
      custom_fields: (prev.custom_fields || []).filter((_, fieldIndex) => fieldIndex !== index),
    }));
  };

  const handleRemoveKraDraft = (index) => {
    setKraDrafts((prev) =>
      prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const handleCreateKra = async () => {
    if (!selectedAppraisalForKra) return;

    const activeDrafts = kraDrafts.filter(
      (item) => item.title.trim() || item.description.trim() || item.max_mark
    );

    if (activeDrafts.length === 0) {
      setKraError('Add at least one KRA item.');
      return;
    }

    for (const item of activeDrafts) {
      if (!item.title.trim()) {
        setKraError('Each KRA item needs a title.');
        return;
      }
      if (!item.max_mark || Number(item.max_mark) <= 0) {
        setKraError('Each KRA item needs a valid max mark.');
        return;
      }
    }

    if (appraisalMeta.period_from && appraisalMeta.period_to && appraisalMeta.period_from > appraisalMeta.period_to) {
      setKraError('Period From cannot be after Period To.');
      return;
    }

    if (isSpecialAppraisalType(appraisalMeta.appraisal_type) && !appraisalMeta.special_appraisal_text.trim()) {
      setKraError('Enter the special appraisal details.');
      return;
    }

    setKraSaving(true);
    setKraError('');
    setKraSuccess('');
    try {
      const targetAppraisals = isHR ? appraisals : [selectedAppraisalForKra];

      const syncedAppraisals = await Promise.all(
        targetAppraisals.map(async (appraisal) => {
          const shouldUpdateMeta = appraisal.id === selectedAppraisalForKra.id;
          const updatedAppraisal = shouldUpdateMeta
            ? await patchAppraisal(appraisal.id, {
                appraisal_type: appraisalMeta.appraisal_type,
                period_from: appraisalMeta.period_from,
                period_to: appraisalMeta.period_to,
                extra_appraiser_data: {
                  ...(appraisal.extra_appraiser_data || {}),
                  special_appraisal_text:
                    isSpecialAppraisalType(appraisalMeta.appraisal_type)
                      ? appraisalMeta.special_appraisal_text.trim()
                      : '',
                },
              })
            : appraisal;

          const sectionCounts = (appraisal.kras || []).reduce((acc, kra) => {
            acc[kra.section] = Math.max(acc[kra.section] || 0, Number(kra.sl_no) || 0);
            return acc;
          }, {});

          const createdItems = [];

          for (const item of activeDrafts) {
            const nextSlNo = (sectionCounts[item.section] || 0) + 1;
            sectionCounts[item.section] = nextSlNo;

            const created = await createKRA({
              appraisal: appraisal.id,
              section: item.section,
              sl_no: nextSlNo,
              title: item.title.trim(),
              description: item.description.trim(),
              max_mark: Number(item.max_mark),
            });

            createdItems.push(created);
          }

          return {
            ...appraisal,
            appraisal_type: updatedAppraisal.appraisal_type || appraisal.appraisal_type,
            period_from: updatedAppraisal.period_from || appraisal.period_from,
            period_to: updatedAppraisal.period_to || appraisal.period_to,
            extra_appraiser_data: updatedAppraisal.extra_appraiser_data || appraisal.extra_appraiser_data,
            frame_config: updatedAppraisal.frame_config || appraisal.frame_config,
            kras: [...(appraisal.kras || []), ...createdItems],
          };
        })
      );

      setAppraisals((prev) =>
        prev.map(
          (appraisal) => syncedAppraisals.find((item) => item.id === appraisal.id) || appraisal
        )
      );
      setSelectedAppraisalForKra((prev) =>
        prev ? syncedAppraisals.find((item) => item.id === prev.id) || prev : prev
      );
      setKraSuccess(
        isHR
          ? 'Common KRA steps saved and applied to all staff appraisals.'
          : 'KRA items saved successfully.'
      );
      setKraDrafts([
        { section: 'kra_objectives', title: '', description: '', max_mark: '' },
      ]);
    } catch (err) {
      setKraError(err.message);
    } finally {
      setKraSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedAppraisalForEdit) return;

    if (appraisalMeta.period_from && appraisalMeta.period_to && appraisalMeta.period_from > appraisalMeta.period_to) {
      setEditError('Period From cannot be after Period To.');
      return;
    }

    if (isSpecialAppraisalType(appraisalMeta.appraisal_type) && !appraisalMeta.special_appraisal_text.trim()) {
      setEditError('Enter the special appraisal details.');
      return;
    }

    const activeKras = editKras.filter(
      (item) => item.title.trim() || item.description.trim() || item.max_mark
    );

    for (const item of activeKras) {
      if (!item.title.trim()) {
        setEditError('Each KRA item needs a title.');
        return;
      }
      if (!item.max_mark || Number(item.max_mark) <= 0) {
        setEditError('Each KRA item needs a valid max mark.');
        return;
      }
    }

    setEditSaving(true);
    setEditError('');
    setEditSuccess('');

    try {
      const normalizedFrame = normalizeFrameConfig(frameConfig);
      const cleanedFrame = {
        ...normalizedFrame,
        custom_fields: normalizedFrame.custom_fields.filter((field) => field.label?.trim()),
      };

      if (isHR) {
        const activeWeightedSteps = ['kra_objectives', 'competencies', 'behaviour'].filter(
          (key) => cleanedFrame.steps[key]
        );
        const totalWeight = activeWeightedSteps.reduce(
          (sum, key) => sum + (Number(cleanedFrame.step_weights[key]) || 0),
          0
        );

        if (activeWeightedSteps.length > 0 && totalWeight !== 100) {
          setEditError('The active step weightage must total 100%.');
          setEditSaving(false);
          return;
        }
      }

      const sectionCounts = {};
      const preparedKras = activeKras.map((kra) => {
        const nextSlNo = (sectionCounts[kra.section] || 0) + 1;
        sectionCounts[kra.section] = nextSlNo;
        return {
          ...kra,
          sl_no: nextSlNo,
          title: kra.title.trim(),
          description: kra.description.trim(),
        };
      });

      const targetAppraisals = isHR ? appraisals : [selectedAppraisalForEdit];

      const syncedAppraisals = await Promise.all(
        targetAppraisals.map(async (appraisal) => {
          const shouldUpdateMeta = appraisal.id === selectedAppraisalForEdit.id;
          const appraisalPatch = {};

          if (shouldUpdateMeta && isHR) {
            appraisalPatch.appraisal_type = appraisalMeta.appraisal_type;
            appraisalPatch.period_from = appraisalMeta.period_from;
            appraisalPatch.period_to = appraisalMeta.period_to;
            appraisalPatch.extra_appraiser_data = {
              ...(appraisal.extra_appraiser_data || {}),
              special_appraisal_text:
                isSpecialAppraisalType(appraisalMeta.appraisal_type)
                  ? appraisalMeta.special_appraisal_text.trim()
                  : '',
            };
          }

          if (isHR) {
            appraisalPatch.frame_config = cleanedFrame;
          }

          const updatedAppraisal = Object.keys(appraisalPatch).length
            ? await patchAppraisal(appraisal.id, appraisalPatch)
            : appraisal;

          const currentBySection = (appraisal.kras || []).reduce((acc, kra) => {
            if (!acc[kra.section]) {
              acc[kra.section] = [];
            }
            acc[kra.section].push(kra);
            return acc;
          }, {});

          Object.values(currentBySection).forEach((items) => {
            items.sort((a, b) => (Number(a.sl_no) || 0) - (Number(b.sl_no) || 0));
          });

          const syncedKras = [];

          for (const templateKra of preparedKras) {
            const bucket = currentBySection[templateKra.section] || [];
            const existing = bucket.shift();

            if (existing) {
              const payload = isHR
                ? {
                    section: templateKra.section,
                    sl_no: templateKra.sl_no,
                    title: shouldUpdateMeta ? templateKra.title : existing.title || templateKra.title,
                    description: shouldUpdateMeta
                      ? templateKra.description
                      : existing.description || templateKra.description,
                    max_mark: Number(templateKra.max_mark) || 0,
                  }
                : {
                    title: templateKra.title,
                    description: templateKra.description,
                  };

              syncedKras.push(await patchKRA(existing.id, payload));
            } else if (isHR) {
              syncedKras.push(
                await createKRA({
                  appraisal: appraisal.id,
                  section: templateKra.section,
                  sl_no: templateKra.sl_no,
                  title: templateKra.title,
                  description: templateKra.description,
                  max_mark: Number(templateKra.max_mark),
                })
              );
            }
          }

          if (isHR) {
            const extraRows = Object.values(currentBySection).flat();
            if (extraRows.length) {
              await Promise.all(extraRows.map((kra) => deleteKRA(kra.id)));
            }
          }

          return {
            ...appraisal,
            appraisal_type: updatedAppraisal.appraisal_type || appraisal.appraisal_type,
            period_from: updatedAppraisal.period_from || appraisal.period_from,
            period_to: updatedAppraisal.period_to || appraisal.period_to,
            extra_appraiser_data: updatedAppraisal.extra_appraiser_data || appraisal.extra_appraiser_data,
            frame_config: updatedAppraisal.frame_config || appraisal.frame_config,
            kras: syncedKras,
          };
        })
      );

      setAppraisals((prev) =>
        prev.map(
          (appraisal) => syncedAppraisals.find((item) => item.id === appraisal.id) || appraisal
        )
      );

      const refreshedSelection = syncedAppraisals.find(
        (item) => item.id === selectedAppraisalForEdit.id
      );
      setSelectedAppraisalForEdit(refreshedSelection || selectedAppraisalForEdit);

      setRemovedKraIds([]);
      setEditSuccess(
        isHR
          ? 'Common KRA structure and rating rules applied to all staff appraisals.'
          : 'KRA content saved successfully.'
      );
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenLatestMyKra = () => {
    getMyAppraisals().then((list) => {
      const active = pickActiveAppraisal(list);
      if (active?.id) {
        onOpenMyKra(active.id);
      } else {
        alert('No appraisal assigned to you yet.');
      }
    }).catch(() => alert('Failed to load your appraisal.'));
  };

  const hrDashboardStats = [
    {
      key: 'staff',
      label: 'Visible Staff',
      value: displayAppraisals.length,
      note: `${appraisals.length} total appraisal records`,
      accent: styles.statCardSky,
    },
    {
      key: 'drafts',
      label: 'Drafts',
      value: appraisals.filter((appraisal) => `${appraisal.status || ''}`.toLowerCase() === 'draft').length,
      note: 'Pending staff or appraiser action',
      accent: styles.statCardSun,
    },
    {
      key: 'departments',
      label: 'Departments',
      value: availableDepartments.length,
      note: 'Available in this view',
      accent: styles.statCardMint,
    },
    {
      key: 'ratings',
      label: 'Rating Access',
      value: appraisals.filter((appraisal) => Boolean(appraisal.mark_entry_access_open)).length,
      note: markSectionVisible ? 'Rating section is open' : 'Rating section is hidden',
      accent: styles.statCardCoral,
    },
  ];

  const appraisalCards = (
    <div className={`${styles.grid} ${isHR ? styles.hrGrid : ''}`}>
      {displayAppraisals.map((a) => (
        <div
          className={`${styles.card} ${isHR ? styles.hrCard : ''}`}
          key={a.id}
          onClick={() => onSelect(a.id)}
        >
          <h3>{a.employee_name || `Employee #${a.employee}`}</h3>
          <p>Department: {a.employee_department || '—'}</p>
          <p>Employee ID: {a.employee_emp_id || '—'}</p>
          {a.recordCount > 1 && (
            <p className={styles.helperText}>Showing latest appraisal • {a.recordCount} records</p>
          )}
          <div className={styles.cardMetaRow}>
            <span className={`${styles.badge} ${BADGE_CLASS[a.status] || ''}`}>
              {a.status}
            </span>
            {isHR && (
              <span
                className={`${styles.ratingVisibilityPill} ${
                  a.mark_entry_access_open ? styles.ratingVisiblePill : styles.ratingHiddenPill
                }`}
              >
                Rating {a.mark_entry_access_open ? 'Shown' : 'Hidden'}
              </span>
            )}
          </div>

          {(isHR || isAppraiser) && (
            <div className={styles.cardActions}>
              {isHR && (
                <button
                  className={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(a);
                  }}
                >
                  Edit Details
                </button>
              )}
              {isAppraiser && (
                <button
                  className={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(a);
                  }}
                >
                  Add Content
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const handleScrollTop = () => {
    if (isRoleShell && hrMainRef.current) {
      hrMainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`${styles.page} ${isRoleShell ? styles.hrPage : ''}`}>
      {isHR ? (
        <div className={styles.hrShell}>
          <aside className={styles.hrSidebar}>
            <div className={styles.hrBrandBlock}>
              <span className={styles.hrBrandOrb} aria-hidden="true" />
              <span className={styles.hrBrandEyebrow}>KRA ADMIN</span>
              <strong className={styles.hrBrandTitle}>HR Dashboard</strong>
            </div>

            <div className={styles.hrSidebarNav}>
              <div className={styles.hrNavSection}>
                <span className={styles.hrNavSectionLabel}>Workspace</span>
                <button type="button" className={`${styles.hrSidebarBtn} ${styles.hrSidebarBtnActive}`}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="dashboard" />
                    </span>
                    <span>Dashboard</span>
                  </span>
                </button>
                <button type="button" className={styles.hrSidebarBtn} onClick={() => onNavigate('structure')}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="layers" />
                    </span>
                    <span>KRA Structure</span>
                  </span>
                </button>
              </div>

              <div className={styles.hrNavSection}>
                <span className={styles.hrNavSectionLabel}>Management</span>
                <button type="button" className={styles.hrSidebarBtn} onClick={() => onNavigate('downloads')}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="download" />
                    </span>
                    <span>Download KRA</span>
                  </span>
                </button>
                <button type="button" className={styles.hrSidebarBtn} onClick={() => onNavigate('employees')}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="users" />
                    </span>
                    <span>Employees</span>
                  </span>
                </button>
                <button type="button" className={styles.hrSidebarBtn} onClick={() => onNavigate('departments')}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="building" />
                    </span>
                    <span>Departments</span>
                  </span>
                </button>
                <button type="button" className={styles.hrSidebarBtn} onClick={() => onNavigate('memos')}>
                  <span className={styles.hrSidebarBtnContent}>
                    <span className={styles.hrSidebarBtnIcon} aria-hidden="true">
                      <NavIcon icon="note" />
                    </span>
                    <span>Memos</span>
                  </span>
                </button>
              </div>

              {onOpenMyKra && (
                <div className={styles.hrNavSection}>
                  <span className={styles.hrNavSectionLabel}>Quick Access</span>
                  <button type="button" className={styles.hrSidebarBtn} onClick={handleOpenLatestMyKra}>
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
              <span className={styles.hrSidebarUser}>Logged in as {employee.name}</span>
              <button type="button" className={styles.hrSidebarLogoutBtn} onClick={onLogout}>
                Logout
              </button>
            </div>

          </aside>

          <div className={styles.hrMain} ref={hrMainRef}>
            <div className={styles.hrTopbar}>
              <div>
                <div className={styles.hrEyebrow}>CONTROL CENTER</div>
                <h2 className={styles.hrTitle}>Appraisals Dashboard</h2>
                <p className={styles.hrSubtext}>
                  Review staff progress, manage structure updates, and control appraisal access from a single workspace.
                </p>
              </div>
              {isHR && (
                <button
                  type="button"
                  className={styles.handleRatingBtn}
                  onClick={handleOpenRatingModal}
                >
                  Manage Ratings
                </button>
              )}
            </div>

            {!loading && !error && (
              <div className={styles.hrStatsGrid}>
                {hrDashboardStats.map((stat) => (
                  <div key={stat.key} className={`${styles.statCard} ${stat.accent}`}>
                    <span className={styles.statLabel}>{stat.label}</span>
                    <strong className={styles.statValue}>{stat.value}</strong>
                    <span className={styles.statNote}>{stat.note}</span>
                  </div>
                ))}
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
            {loading && <div className={styles.loading}>Loading appraisals…</div>}

            {!loading && !error && displayAppraisals.length === 0 && (
              <div className={styles.empty}>
                {selectedDepartment === 'all'
                  ? 'No appraisals found.'
                  : 'No staff found for the selected department.'}
              </div>
            )}

            <div className={styles.hrToolbar}>
              {showDepartmentFilter && (
                <div className={`${styles.filterGroup} ${styles.hrToolbarCard} ${styles.hrToolbarFilterLeft}`}>
                  <label htmlFor="departmentFilter" className={styles.srOnly}>Department</label>
                  <select
                    id="departmentFilter"
                    className={styles.filterSelect}
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                  >
                    <option value="all">All Departments</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={`${styles.filterGroup} ${styles.hrToolbarCard} ${styles.hrToolbarSearch}`}> 
                <label htmlFor="nameSearch" className={styles.srOnly}>Search by name</label>
                <span className={styles.filterIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="m21 21-4.35-4.35M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  id="nameSearch"
                  type="text"
                  className={styles.filterSelect}
                  placeholder="Search by name..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
            </div>

            <section className={styles.hrContentPanel}>
              <div className={styles.hrSectionHead}>
                <div>
                  <h3>Staff Appraisals</h3>
                  <p>Latest appraisal card for each employee in the selected view.</p>
                </div>
                <span className={styles.hrSectionPill}>{displayAppraisals.length} live records</span>
              </div>
              {appraisalCards}
            </section>
          </div>
        </div>
      ) : isRoleShell ? (
        <div className={styles.hrShell}>
          <aside className={styles.hrSidebar}>
            <div className={styles.hrBrandBlock}>
              <span className={styles.hrBrandOrb} aria-hidden="true" />
              <span className={styles.hrBrandEyebrow}>KRA WORKSPACE</span>
              <strong className={styles.hrBrandTitle}>{ROLE_LABEL[employee.role] || employee.role} Dashboard</strong>
            </div>

            <div className={styles.hrSidebarNav}>
              <div className={styles.hrNavSection}>
                <span className={styles.hrNavSectionLabel}>Workspace</span>
                <button type="button" className={`${styles.hrSidebarBtn} ${styles.hrSidebarBtnActive}`}>
                  Dashboard
                </button>
                {onOpenMyKra && (
                  <button type="button" className={styles.hrSidebarBtn} onClick={handleOpenLatestMyKra}>
                    My KRA
                  </button>
                )}
              </div>
            </div>

            <div className={styles.hrSidebarFooter}>
              <span className={styles.hrSidebarUser}>Logged in as {employee.name}</span>
              <button type="button" className={styles.hrSidebarLogoutBtn} onClick={onLogout}>
                Logout
              </button>
            </div>
          </aside>

          <div className={styles.hrMain} ref={hrMainRef}>
            <div className={styles.hrTopbar}>
              <div>
                <div className={styles.hrEyebrow}>CONTROL CENTER</div>
                <h2 className={styles.hrTitle}>Appraisals Dashboard</h2>
                <p className={styles.hrSubtext}>
                  Review your assigned staff appraisals, filter by team, and open the latest records for updates.
                </p>
              </div>
            </div>

            <div className={styles.hrToolbar}>
              <div className={`${styles.filterGroup} ${styles.hrToolbarCard}`}>
                <label htmlFor="nameSearch" className={styles.filterLabel}>Search</label>
                <input
                  id="nameSearch"
                  type="text"
                  className={styles.filterSelect}
                  placeholder="Search by name…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
              {showDepartmentFilter && (
                <div className={`${styles.filterGroup} ${styles.hrToolbarCard}`}>
                  <label htmlFor="departmentFilter" className={styles.filterLabel}>Department</label>
                  <select
                    id="departmentFilter"
                    className={styles.filterSelect}
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                  >
                    <option value="all">All Departments</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {loading && <div className={styles.loading}>Loading appraisals…</div>}

            {!loading && !error && displayAppraisals.length === 0 && (
              <div className={styles.empty}>
                {selectedDepartment === 'all'
                  ? 'No appraisals found.'
                  : 'No staff found for the selected department.'}
              </div>
            )}

            <section className={styles.hrContentPanel}>
              <div className={styles.hrSectionHead}>
                <div>
                  <h3>Assigned Appraisals</h3>
                  <p>Latest appraisal card for each employee in your current view.</p>
                </div>
                <span className={styles.hrSectionPill}>{displayAppraisals.length} live records</span>
              </div>
              {appraisalCards}
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h2>Appraisals — {employee.name} ({ROLE_LABEL[employee.role] || employee.role})</h2>
            <div className={styles.headerActions}>
              <div className={styles.filterGroup}>
                <label htmlFor="nameSearch" className={styles.filterLabel}>Name</label>
                <input
                  id="nameSearch"
                  type="text"
                  className={styles.filterSelect}
                  placeholder="Search by name…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
              {showDepartmentFilter && (
                <div className={styles.filterGroup}>
                  <label htmlFor="departmentFilter" className={styles.filterLabel}>Department</label>
                  <select
                    id="departmentFilter"
                    className={styles.filterSelect}
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                  >
                    <option value="all">All Departments</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(employee?.role === 'appraiser' || employee?.role === 'reviewer' || employee?.role === 'hr') && onOpenMyKra && (
                <button
                  className={styles.navBtn}
                  style={{ background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac' }}
                  onClick={handleOpenLatestMyKra}
                >
                  📄 My KRA
                </button>
              )}
              <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
            </div>
          </div>

          {ratingBanner}
          {error && <div className={styles.error}>{error}</div>}
          {loading && <div className={styles.loading}>Loading appraisals…</div>}

          {!loading && !error && displayAppraisals.length === 0 && (
            <div className={styles.empty}>
              {selectedDepartment === 'all'
                ? 'No appraisals found.'
                : 'No staff found for the selected department.'}
            </div>
          )}

          {appraisalCards}
        </>
      )}

      {isHR && ratingModalOpen && (
        <div className={styles.overlay} onClick={() => setRatingModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Manage Ratings</h3>
              <button className={styles.modalClose} onClick={() => setRatingModalOpen(false)}>×</button>
            </div>
            <p className={styles.modalSub}>
              Choose departments and staff, then apply Show/Hide rating visibility.
            </p>

            <div className={styles.formGrid}>
              <div className={styles.draftCard}>
                <div className={styles.draftTop}>
                  <strong>Department Selection</strong>
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    placeholder="Search department..."
                    value={ratingDepartmentSearch}
                    onChange={(e) => setRatingDepartmentSearch(e.target.value)}
                    disabled={accessUpdating}
                  />
                </div>
                <div className={styles.ratingControlActions}>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    disabled={accessUpdating}
                    onClick={() => setRatingSelectedDepartments(filteredRatingDepartmentOptions)}
                  >
                    Select All
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    disabled={accessUpdating}
                    onClick={() => setRatingSelectedDepartments([])}
                  >
                    Unselect All
                  </button>
                </div>
                <div className={styles.toggleList} style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                  {ratingDepartmentOptions.length === 0 && <div className={styles.modalSub}>No departments available.</div>}
                  {ratingDepartmentOptions.length > 0 && filteredRatingDepartmentOptions.length === 0 && (
                    <div className={styles.modalSub}>No matching departments found.</div>
                  )}
                  {filteredRatingDepartmentOptions.map((departmentName) => (
                    <label key={departmentName} className={styles.toggleRow}>
                      <span className={styles.toggleLabel}>{departmentName}</span>
                      <input
                        type="checkbox"
                        checked={ratingSelectedDepartments.includes(departmentName)}
                        onChange={() => handleToggleRatingDepartment(departmentName)}
                        disabled={accessUpdating}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.draftCard}>
                <div className={styles.draftTop}>
                  <strong>Staff Selection</strong>
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    placeholder="Search staff by name, emp id, or department"
                    value={ratingStaffSearch}
                    onChange={(e) => setRatingStaffSearch(e.target.value)}
                    disabled={accessUpdating}
                  />
                </div>
                <div className={styles.ratingControlActions}>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    disabled={accessUpdating}
                    onClick={() => {
                      const ids = filteredRatingStaffOptions.map((staff) => staff.employeeId);
                      setRatingSelectedStaff((prev) => Array.from(new Set([...prev, ...ids])));
                    }}
                  >
                    Select All
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    disabled={accessUpdating}
                    onClick={() => setRatingSelectedStaff([])}
                  >
                    Unselect All
                  </button>
                </div>
                <div className={styles.toggleList} style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
                  {ratingStaffOptions.length === 0 && <div className={styles.modalSub}>No staff available.</div>}
                  {ratingStaffOptions.length > 0 && filteredRatingStaffOptions.length === 0 && (
                    <div className={styles.modalSub}>No matching staff found.</div>
                  )}
                  {filteredRatingStaffOptions.map((staff) => (
                    <label key={staff.employeeId} className={styles.toggleRow}>
                      <span className={styles.toggleLabel}>
                        {staff.employeeName} ({staff.employeeEmpId || '—'}) • {staff.employeeDepartment}
                      </span>
                      <input
                        type="checkbox"
                        checked={ratingSelectedStaff.includes(staff.employeeId)}
                        onChange={() => handleToggleRatingStaff(staff.employeeId)}
                        disabled={accessUpdating}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setRatingModalOpen(false)} disabled={accessUpdating}>
                Close
              </button>
              <button
                className={styles.navBtn}
                type="button"
                disabled={accessUpdating || appraisals.length === 0}
                onClick={() => handleApplyMarkSectionAccess(false)}
              >
                {accessUpdating ? 'Updating Ratings...' : 'Hide Rating'}
              </button>
              <button
                className={styles.navBtn}
                type="button"
                disabled={accessUpdating || appraisals.length === 0}
                onClick={() => handleApplyMarkSectionAccess(true)}
              >
                {accessUpdating ? 'Updating Ratings...' : 'Show Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className={styles.scrollTopBtn}
        title="Back to top"
        onClick={handleScrollTop}
      >
        ↑
      </button>

      {editModalOpen && selectedAppraisalForEdit && (
        <div className={styles.overlay} onClick={closeEditModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Appraisal for {selectedAppraisalForEdit.employee_name}</h3>
              <button className={styles.modalClose} onClick={closeEditModal}>×</button>
            </div>
            <p className={styles.modalSub}>
              {isHR
                ? 'HR sets the common KRA structure, max marks, and rating weightage for all staff.'
                : 'You can only add or update the content inside the shared HR-framed KRA structure.'}
            </p>

            <div className={styles.formGrid}>
              <div className={styles.draftCard}>
                <div className={styles.draftTop}>
                  <strong>Appraisal Details</strong>
                </div>
                <div className={styles.inputGroup}>
                  <label>Appraisal Type</label>
                  <select name="appraisal_type" value={appraisalMeta.appraisal_type} onChange={handleMetaChange} disabled={!isHR}>
                    {APPRAISAL_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Period From</label>
                  <input name="period_from" type="date" value={appraisalMeta.period_from} onChange={handleMetaChange} disabled={!isHR} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Period To</label>
                  <input name="period_to" type="date" value={appraisalMeta.period_to} onChange={handleMetaChange} disabled={!isHR} />
                </div>
                {isSpecialAppraisalType(appraisalMeta.appraisal_type) && (
                  <div className={styles.inputGroup}>
                    <label>Special Appraisal Details</label>
                    <textarea
                      name="special_appraisal_text"
                      rows="3"
                      value={appraisalMeta.special_appraisal_text}
                      onChange={handleMetaChange}
                      disabled={!isHR}
                      placeholder="Enter the reason or details for this special appraisal"
                    />
                  </div>
                )}
              </div>

              {isHR && (
                <>
                  <div className={styles.draftCard}>
                    <div className={styles.draftTop}>
                      <strong>KRA Step Frame</strong>
                    </div>
                    <div className={styles.toggleList}>
                      {FRAME_STEP_OPTIONS.map((option) => (
                        <label key={option.key} className={styles.toggleRow}>
                          <span className={styles.toggleLabel}>{option.label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(frameConfig.steps[option.key])}
                            onChange={() => handleToggleFrameStep(option.key)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={styles.draftCard}>
                    <div className={styles.draftTop}>
                      <strong>Appraiser Assessment Fields</strong>
                      <button type="button" className={styles.secondaryBtn} onClick={handleAddCustomField}>
                        Add Extra Field
                      </button>
                    </div>
                    <div className={styles.toggleList}>
                      {APPRAISER_FIELD_OPTIONS.map((option) => (
                        <label key={option.key} className={styles.toggleRow}>
                          <span className={styles.toggleLabel}>{option.label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(frameConfig.appraiser_fields[option.key])}
                            onChange={() => handleToggleAppraiserField(option.key)}
                          />
                        </label>
                      ))}
                    </div>

                    {(frameConfig.custom_fields || []).length > 0 && (
                      <div className={styles.formGrid}>
                        {frameConfig.custom_fields.map((field, index) => (
                          <div key={field.key || index} className={styles.customFieldRow}>
                            <input
                              type="text"
                              value={field.label || ''}
                              placeholder={`Extra field ${index + 1}`}
                              onChange={(e) => handleCustomFieldLabelChange(index, e.target.value)}
                            />
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

                  <div className={styles.draftCard}>
                    <div className={styles.draftTop}>
                      <strong>Step Weightage (%)</strong>
                    </div>
                    <div className={styles.formGrid}>
                      {[
                        { key: 'kra_objectives', label: 'KRA Objectives' },
                        { key: 'competencies', label: 'Competencies' },
                        { key: 'behaviour', label: 'Behaviour' },
                      ].map((option) => (
                        <div key={option.key} className={styles.customFieldRow}>
                          <span className={styles.toggleLabel}>{option.label}</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={frameConfig.step_weights?.[option.key] ?? 0}
                            onChange={(e) => handleStepWeightChange(option.key, e.target.value)}
                          />
                        </div>
                      ))}
                      <div className={styles.modalSub}>
                        Total for active scoring steps should be 100%.
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editKras.length === 0 && <p className={styles.modalSub}>No KRAs added yet.</p>}

              {editKras.map((item, index) => (
                <div key={item.id || index} className={styles.draftCard}>
                  <div className={styles.draftTop}>
                    <strong>Edit KRA {index + 1}</strong>
                    {isHR && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemoveEditKra(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Section</label>
                    <select name="section" value={item.section} onChange={(e) => handleEditKraFieldChange(index, e)} disabled={!isHR}>
                      <option value="kra_objectives">KRA Objectives</option>
                      <option value="competencies">Competencies</option>
                      <option value="behaviour">Behaviour</option>
                    </select>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Title</label>
                    <input name="title" value={item.title} onChange={(e) => handleEditKraFieldChange(index, e)} />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Description</label>
                    <textarea name="description" rows="4" value={item.description} onChange={(e) => handleEditKraFieldChange(index, e)} />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Max Mark</label>
                    <input name="max_mark" type="number" min="1" value={item.max_mark} onChange={(e) => handleEditKraFieldChange(index, e)} disabled={!isHR} />
                  </div>
                </div>
              ))}
            </div>

            {editError && <div className={styles.error}>{editError}</div>}
            {editSuccess && <div className={styles.success}>{editSuccess}</div>}

            <div className={styles.modalActions}>
              {isHR && <button className={styles.secondaryBtn} onClick={handleAddEditKra}>Add KRA Row</button>}
              <button className={styles.secondaryBtn} onClick={closeEditModal}>Close</button>
              <button className={styles.editBtn} onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Saving...' : isHR ? 'Save Frame' : 'Save Content'}
              </button>
            </div>
          </div>
        </div>
      )}

      {kraModalOpen && selectedAppraisalForKra && (
        <div className={styles.overlay} onClick={closeKraModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Common KRA Frame for all staff</h3>
              <button className={styles.modalClose} onClick={closeKraModal}>×</button>
            </div>
            <p className={styles.modalSub}>
              Department: {selectedAppraisalForKra.employee_department || '—'}
            </p>

            <div className={styles.formGrid}>
              <div className={styles.draftCard}>
                <div className={styles.draftTop}>
                  <strong>Appraisal Details</strong>
                </div>

                <div className={styles.inputGroup}>
                  <label>Appraisal Type</label>
                  <select name="appraisal_type" value={appraisalMeta.appraisal_type} onChange={handleMetaChange}>
                    {APPRAISAL_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Period From</label>
                  <input name="period_from" type="date" value={appraisalMeta.period_from} onChange={handleMetaChange} />
                </div>

                <div className={styles.inputGroup}>
                  <label>Period To</label>
                  <input name="period_to" type="date" value={appraisalMeta.period_to} onChange={handleMetaChange} />
                </div>

                {isSpecialAppraisalType(appraisalMeta.appraisal_type) && (
                  <div className={styles.inputGroup}>
                    <label>Special Appraisal Details</label>
                    <textarea
                      name="special_appraisal_text"
                      rows="3"
                      value={appraisalMeta.special_appraisal_text}
                      onChange={handleMetaChange}
                      placeholder="Enter the reason or details for this special appraisal"
                    />
                  </div>
                )}
              </div>

              {kraDrafts.map((item, index) => (
                <div key={index} className={styles.draftCard}>
                  <div className={styles.draftTop}>
                    <strong>KRA Item {index + 1}</strong>
                    {kraDrafts.length > 1 && (
                      <button
                        className={styles.removeBtn}
                        onClick={() => handleRemoveKraDraft(index)}
                      >
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
                    <label>Title</label>
                    <input name="title" value={item.title} onChange={(e) => handleKraFieldChange(index, e)} placeholder="Enter KRA title" />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Description</label>
                    <textarea name="description" value={item.description} onChange={(e) => handleKraFieldChange(index, e)} rows="4" placeholder="Enter KRA text" />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Max Mark</label>
                    <input name="max_mark" type="number" min="1" value={item.max_mark} onChange={(e) => handleKraFieldChange(index, e)} placeholder="25" />
                  </div>
                </div>
              ))}
            </div>

            {kraError && <div className={styles.error}>{kraError}</div>}
            {kraSuccess && <div className={styles.success}>{kraSuccess}</div>}

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={handleAddKraDraft}>Add More</button>
              <button className={styles.secondaryBtn} onClick={closeKraModal}>Close</button>
              <button className={styles.primaryBtn} onClick={handleCreateKra} disabled={kraSaving}>
                {kraSaving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
