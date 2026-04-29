import { useMemo } from "react";
import styles from "./CompetenciesStep.module.css";
import { getFinalMark, getSectionMetrics, getSectionWeight } from "../../utils/ratingUtils";

/**
 * CompetenciesStep
 * Props:
 *   kras    – array of KRA (section=competencies) from API
 *   marks   – { [kraId]: { appraisee_mark, appraiser_mark, reviewer_mark } }
 *   setMarks
 *   role    – "staff" | "appraiser" | "reviewer"
 */
const CompetenciesStep = ({ appraisal = {}, kras = [], marks = {}, setMarks, role = "staff", canEditMarks = true, onBack, onNext }) => {
  const isReviewerView = role === "reviewer" || role === "hr";
  const isAppraiserView = role === "appraiser" || isReviewerView;

  const boxClass = (field) => {
    const isActive =
      canEditMarks && (
        (field === "appraisee" && role === "staff") ||
        (field === "appraiser" && role === "appraiser") ||
        (field === "reviewer" && isReviewerView)
      );
    return `${styles.scoreBox} ${isActive ? styles.activeBox : styles.inactiveBox}`;
  };

  const markField =
    role === "appraiser"
      ? "appraiser_mark"
      : isReviewerView
      ? "reviewer_mark"
      : "appraisee_mark";

  const handleChange = (kraId, value, maxMark) => {
    const num = Math.min(Math.max(Number(value) || 0, 0), Number(maxMark));
    setMarks((prev) => ({
      ...prev,
      [kraId]: { ...(prev[kraId] || {}), [markField]: num },
    }));
  };

  const totals = useMemo(() => {
    let appraisee = 0, appraiser = 0, reviewer = 0;
    kras.forEach((k) => {
      const m = marks[k.id] || {};
      appraisee += Number(m.appraisee_mark) || 0;
      appraiser += Number(m.appraiser_mark) || 0;
      reviewer += Number(m.reviewer_mark) || 0;
    });
    return { appraisee, appraiser, reviewer };
  }, [marks, kras]);

  const sectionWeight = useMemo(
    () => getSectionWeight("competencies", appraisal),
    [appraisal]
  );

  const sectionMetrics = useMemo(
    () => getSectionMetrics(kras, marks, sectionWeight, appraisal),
    [kras, marks, sectionWeight, appraisal]
  );

  if (kras.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>Competencies</h2>
        <p className={styles.subText}>No competency entries found.</p>
        <div className={styles.actions}>
          <button onClick={onBack}>← Back</button>
          <button className={styles.next} onClick={onNext}>Next →</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Competencies</h2>
      <p className={styles.subText}>Enter scores based on defined competencies.</p>

      {!canEditMarks && (
        <p className={styles.subText}>Mark section is hidden by HR. You can still review the step details.</p>
      )}

      {canEditMarks && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryPill}>Appraisee Total: <strong>{totals.appraisee}</strong></div>
          {isAppraiserView && <div className={styles.summaryPill}>Appraiser Total: <strong>{totals.appraiser}</strong></div>}
          {isReviewerView && <div className={styles.summaryPill}>Reviewer Total: <strong>{totals.reviewer}</strong></div>}
          <div className={styles.summaryPill}>Final Score: <strong>{sectionMetrics.score.toFixed(2)}</strong> / {sectionMetrics.max.toFixed(2)}</div>
          <div className={styles.summaryPill}>Ratio: <strong>{sectionMetrics.ratio.toFixed(2)}%</strong></div>
          <div className={styles.summaryPill}>Weighted {sectionWeight}%: <strong>{sectionMetrics.weighted.toFixed(2)}</strong></div>
        </div>
      )}

      <div className={styles.list}>
        {kras.map((kra) => {
          const m = marks[kra.id] || {};
          const hasAnyMark = [
            m.appraisee_mark,
            m.appraiser_mark,
            m.reviewer_mark,
            kra.appraisee_mark,
            kra.appraiser_mark,
            kra.reviewer_mark,
          ].some((value) => value !== null && value !== undefined && value !== "");
          const finalValue = hasAnyMark
            ? getFinalMark(kra, m, appraisal).toFixed(2)
            : "—";
          return (
            <article key={kra.id} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <div>
                  <div className={styles.itemTitle}>{kra.title || `Competency Row ${kra.sl_no ?? 1}`}</div>
                  {!kra.description && <p className={styles.subText}>Appraiser will add the content for this row.</p>}
                  {kra.description && <p className={styles.subText}>{kra.description}</p>}
                </div>
                <div className={styles.maxBadge}>Max: {kra.max_mark}</div>
              </div>

              {canEditMarks && (
                <div className={styles.scoreGrid}>
                  <div className={boxClass("appraisee")}>
                    <label>Appraisee</label>
                    {role === "staff" ? (
                      <input
                        className={styles.scoreInput}
                        type="number"
                        min="0"
                        max={kra.max_mark}
                        value={m.appraisee_mark ?? ""}
                        onChange={(e) => handleChange(kra.id, e.target.value, kra.max_mark)}
                      />
                    ) : (
                      <div className={styles.readScore}>{m.appraisee_mark ?? "—"}</div>
                    )}
                  </div>

                  {isAppraiserView && (
                    <div className={boxClass("appraiser")}>
                      <label>Appraiser</label>
                      {role === "appraiser" ? (
                        <input
                          className={styles.scoreInput}
                          type="number"
                          min="0"
                          max={kra.max_mark}
                          value={m.appraiser_mark ?? ""}
                          onChange={(e) => handleChange(kra.id, e.target.value, kra.max_mark)}
                        />
                      ) : (
                        <div className={styles.readScore}>{m.appraiser_mark ?? "—"}</div>
                      )}
                    </div>
                  )}

                  {isReviewerView && (
                    <div className={boxClass("reviewer")}>
                      <label>Reviewer</label>
                      <input
                        className={styles.scoreInput}
                        type="number"
                        min="0"
                        max={kra.max_mark}
                        value={m.reviewer_mark ?? ""}
                        onChange={(e) => handleChange(kra.id, e.target.value, kra.max_mark)}
                      />
                    </div>
                  )}

                  {isReviewerView && (
                    <div className={`${styles.scoreBox} ${styles.inactiveBox}`}>
                      <label>Final</label>
                      <div className={styles.readScore}>{finalValue}</div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button onClick={onBack}>← Back</button>
        <button className={styles.next} onClick={onNext}>Next →</button>
      </div>
    </div>
  );
};

export default CompetenciesStep;
