import styles from "./EmployeeInfoStep.module.css";

/**
 * EmployeeInfoStep – now reads data from the API (appraisal + employee).
 * Shows all fields as read-only.
 */
const EmployeeInfoStep = ({ appraisal = {}, employee = {}, onNext }) => {
  const infoFields = [
    { label: "Employee / Appraisee Name", value: appraisal.employee_name || employee.name || "—" },
    { label: "Employee ID", value: appraisal.employee_emp_id || employee.emp_id || "—" },
    { label: "Designation", value: appraisal.employee_designation || employee.designation || "—" },
    { label: "Department", value: appraisal.employee_department || employee.department || "—" },
    { label: "HoD / Appraiser", value: appraisal.appraiser_name || employee.appraiser_name || "—" },
    { label: "Reviewer", value: appraisal.reviewer_name || employee.reviewer_name || "—" },
    { label: "Type of Appraisal", value: appraisal.appraisal_type || "—" },
    { label: "Appraisal Period", value: `${appraisal.period_from || "—"} to ${appraisal.period_to || "—"}` },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.headerBlock}>
        <h2 className={styles.title}>Employee Information</h2>
        <p className={styles.subtitle}>Appraisal details for this period.</p>
      </div>

      <div className={styles.grid}>
        {infoFields.map(({ label, value }) => (
          <div key={label} className={styles.readOnlyField}>
            <span className={styles.fieldLabel}>{label}</span>
            <span className={styles.fieldValue}>{value}</span>
          </div>
        ))}
      </div>

      <button className={styles.nextBtn} onClick={onNext}>
        Next Step →
      </button>
    </div>
  );
};

export default EmployeeInfoStep;
