import styles from "./RemarksStep.module.css";

/**
 * RemarksStep – role-specific remarks.
 * Props:
 *   role     – "staff" | "appraiser" | "reviewer" | "hr"
 *   appraisal – full appraisal object (for showing read-only remarks from other roles)
 *   remarks  – { employee_remarks, appraiser_remarks, reviewer_remarks, mgmt_hr_remarks }
 *   setRemarks
 *   onBack
 *   onNext
 */
export default function RemarksStep({ role, appraisal = {}, marks = {}, remarks = {}, setRemarks, onBack, onNext }) {

  const set = (field, value) => setRemarks((prev) => ({ ...prev, [field]: value }));

  return (
    <div className={styles.card}>
      <h2>Remarks</h2>
      <p className={styles.subText}>Add your remarks and continue to the next step.</p>

      {/* Employee remarks – editable by staff, read-only for others */}
      <div className={styles.field}>
        <label>Appraisee Remarks</label>
        <textarea
          rows={4}
          placeholder="Employee's comments…"
          value={remarks.employee_remarks || ""}
          readOnly={role !== "staff"}
          onChange={(e) => role === "staff" && set("employee_remarks", e.target.value)}
        />
      </div>

      <hr className={styles.divider} />

      {/* Appraiser remarks – editable by appraiser, read-only for others */}
      {(role === "appraiser" || role === "reviewer" || role === "hr") && (
        <div className={styles.field}>
          <label>Appraiser Remarks</label>
          <textarea
            rows={4}
            placeholder="Appraiser's comments…"
            value={remarks.appraiser_remarks || ""}
            readOnly={role !== "appraiser"}
            onChange={(e) => role === "appraiser" && set("appraiser_remarks", e.target.value)}
          />
        </div>
      )}

      {/* Reviewer remarks – editable by reviewer, visible to HR as read-only */}
      {(role === "reviewer" || role === "hr") && (
        <div className={styles.field}>
          <label>Reviewer Remarks</label>
          <textarea
            rows={4}
            placeholder="Reviewer's comments…"
            value={remarks.reviewer_remarks || ""}
            readOnly={role !== "reviewer"}
            onChange={(e) => role === "reviewer" && set("reviewer_remarks", e.target.value)}
          />
        </div>
      )}

      {/* Management / HR remarks – editable by HR only */}
      {role === "hr" && (
        <div className={styles.field}>
          <label>Management / HR Remarks</label>
          <textarea
            rows={4}
            placeholder="Management or HR comments…"
            value={remarks.mgmt_hr_remarks || ""}
            onChange={(e) => set("mgmt_hr_remarks", e.target.value)}
          />
        </div>
      )}

      <div className={styles.actions}>
        <button onClick={onBack}>← Back</button>
        <button onClick={onNext}>Next Step →</button>
      </div>
    </div>
  );
}
