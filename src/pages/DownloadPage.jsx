import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getAllAppraisals, getEmployees } from '../api/appraisalApi';
import { normalizeFrameConfig } from '../utils/frameConfig';
import { getFinalMark, getOverallPerformance, getSectionWeight } from '../utils/ratingUtils';
import styles from './DownloadPage.module.css';

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

function toDisplayValue(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function formatMonthYear(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function getAppraisalMeta(appraisal = {}) {
  const frame = normalizeFrameConfig(appraisal?.frame_config);
  const options = frame?.appraisal_options || {};

  return {
    appraisalType: appraisal?.appraisal_type || options.default_type || '—',
    periodFrom: appraisal?.period_from || options.period_from || '',
    periodTo: appraisal?.period_to || options.period_to || '',
  };
}

function getDisplayAppraisals(appraisals = []) {
  const grouped = new Map();

  const getMeta = (item) => {
    const meta = getAppraisalMeta(item);
    return {
      periodTo: meta.periodTo ? new Date(meta.periodTo).getTime() : 0,
      appraisalType: `${meta.appraisalType || ''}`,
      id: Number(item?.id) || 0,
    updatedAt: item?.updated_at ? new Date(item.updated_at).getTime() : 0,
    kraCount: Array.isArray(item?.kras) ? item.kras.length : 0,
    };
  };

  appraisals.forEach((appraisal) => {
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
        currentMeta.kraCount > existingMeta.kraCount) ||
      (currentMeta.periodTo === existingMeta.periodTo &&
        currentMeta.updatedAt === existingMeta.updatedAt &&
        currentMeta.kraCount === existingMeta.kraCount &&
        currentMeta.appraisalType > existingMeta.appraisalType) ||
      (currentMeta.periodTo === existingMeta.periodTo &&
        currentMeta.updatedAt === existingMeta.updatedAt &&
        currentMeta.kraCount === existingMeta.kraCount &&
        currentMeta.appraisalType === existingMeta.appraisalType &&
        currentMeta.id > existingMeta.id);

    grouped.set(key, {
      ...(shouldReplace ? appraisal : existing),
      recordCount: (existing.recordCount || 1) + 1,
    });
  });

  return Array.from(grouped.values());
}

function SectionTable({ partTitle, sectionTitle, items, appraisal }) {
  if (!items.length) return null;

  return (
    <div className={styles.pdfChunk} data-pdf-chunk="true">
      <div className={styles.partHeader}>{partTitle}</div>
      <div className={styles.tableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Sl No</th>
              <th>{sectionTitle}</th>
              <th>MAX MARKS</th>
              <th>APPRAISEE</th>
              <th>APPRAISER</th>
              <th>REVIEWER</th>
              <th>FINAL RATINGS</th>
            </tr>
          </thead>
          <tbody>
            {items.map((kra, index) => {
              const hasAnyMark = [kra.appraisee_mark, kra.appraiser_mark, kra.reviewer_mark].some(
                (value) => value !== null && value !== undefined && value !== ''
              );

              return (
                <tr key={kra.id || `${sectionTitle}-${index}`}>
                  <td className={styles.scoreCell}>{kra.sl_no ?? index + 1}</td>
                  <td className={styles.objectiveCell}>
                    <strong>{kra.title || `${sectionTitle} ${index + 1}`}</strong>
                    {kra.description ? `: ${kra.description}` : ''}
                  </td>
                  <td className={styles.scoreCell}>{Number(kra.max_mark) || 0}</td>
                  <td className={styles.scoreCell}>{kra.appraisee_mark ?? ''}</td>
                  <td className={styles.scoreCell}>{kra.appraiser_mark ?? ''}</td>
                  <td className={styles.scoreCell}>{kra.reviewer_mark ?? ''}</td>
                  <td className={styles.scoreCell}>
                    {hasAnyMark ? Number(getFinalMark(kra, {}, appraisal)).toFixed(2) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoSection({ title, rows }) {
  return (
    <div className={`${styles.sectionBlock} ${styles.pdfChunk}`} data-pdf-chunk="true">
      <div className={styles.sectionHeader}>{title}</div>
      <div className={styles.infoRows}>
        {rows.map(([label, value], index) => (
          <div key={`${title}-${label}-${index}`} className={styles.infoRow}>
            <span className={styles.infoLabel}>{label}</span>
            <span className={styles.infoValue}>{toDisplayValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppraisalPreview({ appraisal, employeeMap, exportFields, pdfMode = false }) {
  if (!appraisal) {
    return <div className={styles.emptyState}>No appraisal data available for preview.</div>;
  }

  const employeeRecord = employeeMap.get(appraisal.employee);
  const appraiserRecord = employeeMap.get(employeeRecord?.appraiser);
  const reviewerRecord = employeeMap.get(employeeRecord?.reviewer);
  const overall = getOverallPerformance(appraisal, {});
  const customFields = appraisal?.frame_config?.custom_fields || [];
  const extraAppraiserData = appraisal?.extra_appraiser_data || {};
  const ratingSettings = appraisal?.frame_config?.rating_settings || {};
  const appraisalMeta = getAppraisalMeta(appraisal);
  const formulaMode = ratingSettings?.formula_mode || 'custom_formula';
  const formulaText = formulaMode === 'custom_formula'
    ? (ratingSettings?.formula_expression || '')
    : formulaMode === 'weighted_average'
      ? `Appraisee ${ratingSettings?.formula_weights?.appraisee ?? 0}% + Appraiser ${ratingSettings?.formula_weights?.appraiser ?? 0}% + Reviewer ${ratingSettings?.formula_weights?.reviewer ?? 0}%`
      : 'Latest available mark priority';

  return (
    <div className={`${styles.previewCard} ${pdfMode ? styles.pdfPage : ''}`} data-pdf-page="true">
      <div className={`${styles.previewHeader} ${styles.pdfChunk}`} data-pdf-chunk="true">Performance Appraisal Rating Form</div>
      <div className={styles.previewBody}>
        {exportFields.employee_details && (
          <div className={styles.pdfChunk} data-pdf-chunk="true">
            <div className={styles.headerGrid}>
              <div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Employee / Appraisee Name:</span>
                  <span className={styles.detailValue}>{appraisal.employee_name || '—'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>HoD / Appraiser Name:</span>
                  <span className={styles.detailValue}>{appraisal.appraiser_name || employeeRecord?.appraiser_name || '—'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Reviewer Name:</span>
                  <span className={styles.detailValue}>{appraisal.reviewer_name || employeeRecord?.reviewer_name || '—'}</span>
                </div>
              </div>

              <div className={styles.metaGrid}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>EMP ID</span>
                  <span className={styles.metaValue}>{appraisal.employee_emp_id || '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Desig</span>
                  <span className={styles.metaValue}>{appraisal.employee_designation || employeeRecord?.designation || '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Dept</span>
                  <span className={styles.metaValue}>{appraisal.employee_department || '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Status</span>
                  <span className={styles.metaValue}>{appraisal.status || '—'}</span>
                </div>
              </div>
            </div>

            <div className={styles.typeRow}>
              <span className={styles.typeTitle}>Type of Appraisal:</span>
              <span className={`${styles.typeBadge} ${styles.typeActive}`}>
                {appraisalMeta.appraisalType || '—'}
              </span>
            </div>

            <div className={styles.periodBar}>
              <span>Appraisal Period (m/y):</span>
              <span>From: {formatMonthYear(appraisalMeta.periodFrom)}</span>
              <span>To: {formatMonthYear(appraisalMeta.periodTo)}</span>
            </div>
          </div>
        )}

        {exportFields.kra_objectives && (
          <SectionTable
            partTitle={`PART 1 - KRA's (${Math.round(getSectionWeight('kra_objectives', appraisal))}% Weightage)`}
            sectionTitle="3 KRA's + 1 Capability Goal"
            items={(appraisal.kras || []).filter((kra) => kra.section === 'kra_objectives')}
            appraisal={appraisal}
          />
        )}

        {exportFields.competencies && (
          <SectionTable
            partTitle={`PART 2 - COMPETENCIES (${Math.round(getSectionWeight('competencies', appraisal))}% Weightage)`}
            sectionTitle="Competencies"
            items={(appraisal.kras || []).filter((kra) => kra.section === 'competencies')}
            appraisal={appraisal}
          />
        )}

        {exportFields.behaviour && (
          <SectionTable
            partTitle={`PART 3 - BEHAVIOUR (${Math.round(getSectionWeight('behaviour', appraisal))}% Weightage)`}
            sectionTitle="Behaviour"
            items={(appraisal.kras || []).filter((kra) => kra.section === 'behaviour')}
            appraisal={appraisal}
          />
        )}

        {exportFields.appraiser_assessment && (
          <InfoSection
            title="APPRAISER ASSESSMENT"
            rows={[
              ['Strong Areas', appraisal.strong_areas],
              ['Weak Areas', appraisal.weak_areas],
              ['Training Need A', appraisal.training_need_a],
              ['Training Need B', appraisal.training_need_b],
              ['Training Need C', appraisal.training_need_c],
              ['Eligible for Confirmation', appraisal.eligible_for_confirmation],
              ['Additional Responsibilities', appraisal.considered_for_additional_responsibilities],
              ...customFields.map((field, index) => [field.label || `Extra Field ${index + 1}`, extraAppraiserData[field.key]]),
            ]}
          />
        )}

        {exportFields.remarks && (
          <InfoSection
            title="REMARKS"
            rows={[
              ['Employee Remarks', appraisal.employee_remarks],
              ['Appraiser Remarks', appraisal.appraiser_remarks],
              ['Reviewer Remarks', appraisal.reviewer_remarks],
              ['MGMT / HR Remarks', appraisal.mgmt_hr_remarks],
            ]}
          />
        )}

        {exportFields.performance_ratings && (
          <InfoSection
            title="PERFORMANCE RATINGS"
            rows={[
              ['KRA Objectives Ratio', `${overall.part1Rating.toFixed(2)}%`],
              ['Competencies Ratio', `${overall.competenciesMetrics.ratio.toFixed(2)}%`],
              ['Behaviour Ratio', `${overall.behaviourMetrics.ratio.toFixed(2)}%`],
              ['KRA Objectives Weighted', overall.weightedPart1.toFixed(2)],
              ['Attributes Weighted', overall.weightedPart2.toFixed(2)],
              ['Total Ratings', overall.totalRating.toFixed(2)],
              ['Memo / Warning Deduction', overall.memoPenalty.toFixed(2)],
              ['Net Ratings', overall.netRating.toFixed(2)],
              ['Final Qualifying Ratings', overall.performanceBand],
            ]}
          />
        )}
      </div>
    </div>
  );
}

export default function DownloadPage({
  employee,
  onBack,
  selectedAppraisalIds = [],
  setSelectedAppraisalIds,
  embeddedInShell = false,
}) {
  const [appraisals, setAppraisals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  const [summaryExporting, setSummaryExporting] = useState(false);
  const [exportFields, setExportFields] = useState(DEFAULT_EXPORT_FIELDS);
  const [pdfAppraisals, setPdfAppraisals] = useState([]);
  const [staffNameSearch, setStaffNameSearch] = useState('');
  const pdfContainerRef = useRef(null);

  const isHR = employee?.role === 'hr';

  useEffect(() => {
    Promise.all([getAllAppraisals(), getEmployees()])
      .then(([appraisalList, employeeList]) => {
        setAppraisals(appraisalList);
        setEmployees(employeeList);
      })
      .catch((err) => setError(err.message || 'Failed to load download data.'))
      .finally(() => setLoading(false));
  }, []);

  const displayAppraisals = useMemo(() => getDisplayAppraisals(appraisals), [appraisals]);

  const employeeMap = useMemo(
    () => new Map(employees.map((item) => [item.id, item])),
    [employees]
  );

  const selectedAppraisals = useMemo(
    () => displayAppraisals.filter((item) => selectedAppraisalIds.includes(item.id)),
    [displayAppraisals, selectedAppraisalIds]
  );

  const previewAppraisal = selectedAppraisals[0] || displayAppraisals[0] || null;

  const handleToggleExportField = (key) => {
    if (!isHR) return;

    setExportFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleAppraisalSelection = (appraisalId) => {
    setSelectedAppraisalIds?.((prev = []) =>
      prev.includes(appraisalId)
        ? prev.filter((id) => id !== appraisalId)
        : [...prev, appraisalId]
    );
  };

  const handleSelectAllStaff = () => {
    setSelectedAppraisalIds?.(displayAppraisals.map((item) => item.id));
  };

  const handleClearSelection = () => {
    setSelectedAppraisalIds?.([]);
  };

  const waitForPdfRender = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const handleExportAppraisals = async (targetAppraisals, label) => {
    if (!isHR) return;

    if (!targetAppraisals.length) {
      setError(label === 'selected'
        ? 'Select at least one staff to download the PDF.'
        : 'No staff appraisals available to download.');
      return;
    }

    if (!Object.values(exportFields).some(Boolean)) {
      setError('Choose at least one field to download.');
      return;
    }

    setExporting(true);
    setExportProgressText('Starting PDF export...');
    setError('');

    try {
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const usableWidth = pageWidth - margin * 2;
      const bottomLimit = pageHeight - margin;
      const sectionGap = 10;
      const canvasScale = targetAppraisals.length > 15 ? 1.4 : targetAppraisals.length > 8 ? 1.6 : 2;
      let hasPdfContent = false;

      for (let index = 0; index < targetAppraisals.length; index += 1) {
        const appraisal = targetAppraisals[index];
        const employeeName = appraisal.employee_name || `Staff ${index + 1}`;
        setExportProgressText(`Preparing PDF... ${index + 1}/${targetAppraisals.length} (${employeeName})`);

        // Render one appraisal at a time to avoid locking up the browser for large exports.
        setPdfAppraisals([appraisal]);
        await waitForPdfRender();

        const pageNode = pdfContainerRef.current?.querySelector('[data-pdf-page="true"]');
        if (!pageNode) {
          continue;
        }

        const chunkNodes = Array.from(pageNode.querySelectorAll('[data-pdf-chunk="true"]'));
        let cursorY = margin;

        if (hasPdfContent) {
          pdf.addPage();
        }

        for (const chunkNode of chunkNodes) {
          const canvas = await html2canvas(chunkNode, {
            scale: canvasScale,
            useCORS: true,
            backgroundColor: '#ffffff',
            windowWidth: pageNode.scrollWidth,
          });

          const imgData = canvas.toDataURL('image/png');
          const imgHeight = (canvas.height * usableWidth) / canvas.width;

          if (cursorY + imgHeight > bottomLimit) {
            pdf.addPage();
            cursorY = margin;
          }

          pdf.addImage(imgData, 'PNG', margin, cursorY, usableWidth, imgHeight);
          cursorY += imgHeight + sectionGap;
        }

        hasPdfContent = true;
      }

      if (!hasPdfContent) {
        throw new Error('Nothing available to export.');
      }

      const fileSuffix = new Date().toISOString().slice(0, 10);
      pdf.save(`kra_forms_${label}_${fileSuffix}.pdf`);
    } catch (err) {
      setError(err.message || 'Failed to download the KRA PDF.');
    } finally {
      setPdfAppraisals([]);
      setExporting(false);
      setExportProgressText('');
    }
  };

  const handleExportSummary = async (targetAppraisals, label) => {
    if (!isHR) return;

    if (!targetAppraisals.length) {
      setError(label === 'selected'
        ? 'Select at least one staff to download the summary.'
        : 'No staff appraisals available to download summary.');
      return;
    }

    if (!Object.values(exportFields).some(Boolean)) {
      setError('Choose at least one field to download summary.');
      return;
    }

    setSummaryExporting(true);
    setError('');

    try {
      const XLSX = await import('xlsx');
      const headers = ['Employee Name'];

      if (exportFields.employee_details) {
        headers.push('EMP ID', 'Department', 'Designation', 'Appraisal Type', 'Period From', 'Period To', 'Status');
      }
      if (exportFields.kra_objectives) {
        headers.push('KRA Goals Count', 'KRA Ratio %', 'KRA Weighted');
      }
      if (exportFields.competencies) {
        headers.push('Competencies Count', 'Competencies Ratio %');
      }
      if (exportFields.behaviour) {
        headers.push('Behaviour Goals Count', 'Behaviour Ratio %');
      }
      if (exportFields.appraiser_assessment) {
        headers.push('Strong Areas', 'Weak Areas', 'Eligible for Confirmation');
      }
      if (exportFields.remarks) {
        headers.push('Employee Remarks', 'Appraiser Remarks', 'Reviewer Remarks', 'MGMT / HR Remarks');
      }
      if (exportFields.performance_ratings) {
        headers.push('Total Rating', 'Memo / Warning Deduction', 'Net Rating', 'Performance Band');
      }

      const rows = [headers];

      targetAppraisals.forEach((appraisal) => {
        const appraisalMeta = getAppraisalMeta(appraisal);
        const overall = getOverallPerformance(appraisal, {});
        const kras = appraisal.kras || [];
        const objectives = kras.filter((item) => item.section === 'kra_objectives');
        const competencies = kras.filter((item) => item.section === 'competencies');
        const behaviour = kras.filter((item) => item.section === 'behaviour');

        const row = [appraisal.employee_name || '—'];

        if (exportFields.employee_details) {
          row.push(
            appraisal.employee_emp_id || '—',
            appraisal.employee_department || '—',
            appraisal.employee_designation || employeeMap.get(appraisal.employee)?.designation || '—',
            appraisalMeta.appraisalType || '—',
            appraisalMeta.periodFrom || '—',
            appraisalMeta.periodTo || '—',
            appraisal.status || '—'
          );
        }

        if (exportFields.kra_objectives) {
          row.push(
            objectives.length,
            `${overall.part1Rating.toFixed(2)}%`,
            overall.weightedPart1.toFixed(2)
          );
        }

        if (exportFields.competencies) {
          row.push(
            competencies.length,
            `${overall.competenciesMetrics.ratio.toFixed(2)}%`
          );
        }

        if (exportFields.behaviour) {
          row.push(
            behaviour.length,
            `${overall.behaviourMetrics.ratio.toFixed(2)}%`
          );
        }

        if (exportFields.appraiser_assessment) {
          row.push(
            toDisplayValue(appraisal.strong_areas),
            toDisplayValue(appraisal.weak_areas),
            toDisplayValue(appraisal.eligible_for_confirmation)
          );
        }

        if (exportFields.remarks) {
          row.push(
            toDisplayValue(appraisal.employee_remarks),
            toDisplayValue(appraisal.appraiser_remarks),
            toDisplayValue(appraisal.reviewer_remarks),
            toDisplayValue(appraisal.mgmt_hr_remarks)
          );
        }

        if (exportFields.performance_ratings) {
          row.push(
            overall.totalRating.toFixed(2),
            overall.memoPenalty.toFixed(2),
            overall.netRating.toFixed(2),
            overall.performanceBand
          );
        }

        rows.push(row);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet['!cols'] = headers.map((header) => ({
        wch: Math.max(14, String(header).length + 4),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'KRA Summary');

      const fileSuffix = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `kra_summary_${label}_${fileSuffix}.xlsx`);
    } catch (err) {
      setError(err.message || 'Failed to download KRA summary.');
    } finally {
      setSummaryExporting(false);
    }
  };

  const content = (
    <>
      {!embeddedInShell && (
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
        </div>
      )}

      <div className={styles.infoBanner}>
        The preview and the PDF now follow the same template. Field selection is reflected immediately in the design.
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Loading download options…</div>}

      {!loading && (
        <div className={styles.layout}>
          <div>
            <AppraisalPreview
              appraisal={previewAppraisal}
              employeeMap={employeeMap}
              exportFields={exportFields}
            />
          </div>

          <div className={styles.sidePane}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Download Actions</h3>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => handleExportAppraisals(displayAppraisals, 'all')}
                  disabled={!isHR || exporting || displayAppraisals.length === 0}
                >
                  {exporting ? (exportProgressText || 'Preparing PDF…') : 'Download All Staff PDF'}
                </button>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => handleExportAppraisals(selectedAppraisals, 'selected')}
                  disabled={!isHR || exporting || selectedAppraisals.length === 0}
                >
                  Download Selected Staff PDF
                </button>
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Summary Download Actions</h3>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => handleExportSummary(displayAppraisals, 'all')}
                  disabled={!isHR || summaryExporting || displayAppraisals.length === 0}
                >
                  {summaryExporting ? 'Preparing Summary…' : 'Download All Staff Summary'}
                </button>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => handleExportSummary(selectedAppraisals, 'selected')}
                  disabled={!isHR || summaryExporting || selectedAppraisals.length === 0}
                >
                  Download Selected Staff Summary
                </button>
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>
                Selected Staff <span className={styles.selectedCount}>({selectedAppraisalIds.length})</span>
              </h3>
              <div className={styles.buttonRow}>
                <button type="button" className={styles.secondaryBtn} onClick={handleSelectAllStaff}>
                  Select All Staff
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={handleClearSelection}>
                  Clear Selection
                </button>
              </div>

              <div style={{ padding: '0.75rem 0 0.75rem 0' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔍 Search by Name
                </label>
                <input
                  type="text"
                  placeholder="Type a name to filter…"
                  value={staffNameSearch}
                  onChange={(e) => setStaffNameSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '2px solid #667eea',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    background: '#f7f8ff',
                    color: '#2d3748',
                    boxShadow: '0 1px 4px rgba(102,126,234,0.15)',
                  }}
                />
              </div>

              <div className={styles.checkboxList}>
                {displayAppraisals.filter((item) =>
                  !staffNameSearch.trim() ||
                  (item.employee_name || '').toLowerCase().includes(staffNameSearch.trim().toLowerCase())
                ).length > 0 ? (
                  displayAppraisals.filter((item) =>
                    !staffNameSearch.trim() ||
                    (item.employee_name || '').toLowerCase().includes(staffNameSearch.trim().toLowerCase())
                  ).map((item) => {
                    const itemMeta = getAppraisalMeta(item);
                    return (
                      <label key={item.id} className={styles.checkRow}>
                        <span>
                          <span className={styles.checkLabel}>{item.employee_name}</span>
                          <span className={styles.checkMeta}>{item.employee_department || '—'} • {itemMeta.appraisalType || 'Annual'}</span>
                        </span>
                        <input
                          className={styles.checkInput}
                          type="checkbox"
                          checked={selectedAppraisalIds.includes(item.id)}
                          onChange={() => handleToggleAppraisalSelection(item.id)}
                        />
                      </label>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>No staff found.</div>
                )}
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Choose Fields for Download</h3>
              <div className={styles.checkboxList}>
                {EXPORT_FIELD_OPTIONS.map((option) => (
                  <label key={option.key} className={styles.checkRow}>
                    <span className={styles.checkLabel}>{option.label}</span>
                    <input
                      className={styles.checkInput}
                      type="checkbox"
                      checked={Boolean(exportFields[option.key])}
                      disabled={!isHR}
                      onChange={() => handleToggleExportField(option.key)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.pdfHiddenContainer} ref={pdfContainerRef}>
        {pdfAppraisals.map((appraisal) => (
          <AppraisalPreview
            key={`pdf-${appraisal.id}`}
            appraisal={appraisal}
            employeeMap={employeeMap}
            exportFields={exportFields}
            pdfMode
          />
        ))}
      </div>

    </>
  );

  return embeddedInShell ? content : <div className={styles.page}>{content}</div>;
}
