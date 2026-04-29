import { useState } from "react";
import styles from "./RatingsIndexStep.module.css";
import { getOverallPerformance } from "../../utils/ratingUtils";

export default function RatingsIndexStep({
  mode = "ratings",
  role,
  appraisal = {},
  marks = {},
  onBack,
  onNext,
  onSubmit,
  markAccessOpen = true,
  isLast = false,
}) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const {
    objectivesMetrics,
    competenciesMetrics,
    behaviourMetrics,
    part1Rating,
    part2Rating,
    weightedPart1,
    weightedPart2,
    totalRating,
    memoPenalty,
    netRating,
    ratingBands,
    performanceBand,
  } = getOverallPerformance(appraisal, marks);

  const formulaMode = appraisal?.frame_config?.rating_settings?.formula_mode || 'weighted_average';
  const formulaWeights = appraisal?.frame_config?.rating_settings?.formula_weights || {};
  const formulaExpression = appraisal?.frame_config?.rating_settings?.formula_expression || '';

  const handleContinue = async () => {
    if (!isLast) {
      onNext?.();
      return;
    }
    if (!onSubmit) {
      onNext?.();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit();
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.card}>
        <div className={styles.successMsg}>✓ Appraisal submitted successfully!</div>
      </div>
    );
  }

  const showRatings = mode === "ratings";
  const showIndex = mode === "index";

  return (
    <div className={styles.card}>
      <h2>{showRatings ? "Performance Ratings" : "Index"}</h2>
      <p className={styles.subText}>
        {showRatings
          ? "Configurable rating calculation based on the HR-defined formula."
          : "Performance category mapping based on final net rating."}
      </p>

      {error && <div className={styles.error}>{error}</div>}

      {showRatings && (role === "reviewer" || role === "hr") && (
        <div className={styles.ratingsCard}>
          <h3>Performance Ratings</h3>
          <p className={styles.subText}>
            {formulaMode === 'weighted_average'
              ? `Formula: Appraisee ${formulaWeights.appraisee ?? 0}% + Appraiser ${formulaWeights.appraiser ?? 0}% + Reviewer ${formulaWeights.reviewer ?? 0}%`
              : formulaMode === 'custom_formula'
                ? `Formula: ${formulaExpression}`
                : 'Formula: latest available mark priority is applied'}
          </p>
          <div className={styles.ratingGrid}>
            <div className={styles.ratingRow}>
              <span>KRA Objectives Ratio</span>
              <strong>{objectivesMetrics.score.toFixed(2)} / {objectivesMetrics.max.toFixed(2)} ({part1Rating.toFixed(2)}%)</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>Competencies Ratio</span>
              <strong>{competenciesMetrics.score.toFixed(2)} / {competenciesMetrics.max.toFixed(2)} ({competenciesMetrics.ratio.toFixed(2)}%)</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>Behaviour Ratio</span>
              <strong>{behaviourMetrics.score.toFixed(2)} / {behaviourMetrics.max.toFixed(2)} ({behaviourMetrics.ratio.toFixed(2)}%)</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>KRA Objectives Weighted ({objectivesMetrics.weight.toFixed(0)}%)</span>
              <strong>{weightedPart1.toFixed(2)}</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>Part 2 - Attributes (Rating out of 100)</span>
              <strong>{part2Rating.toFixed(2)}</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>Attributes Weighted ({(competenciesMetrics.weight + behaviourMetrics.weight).toFixed(0)}%)</span>
              <strong>{weightedPart2.toFixed(2)}</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>Total Ratings</span>
              <strong>{totalRating.toFixed(2)}</strong>
            </div>
            <div className={styles.ratingRow}>
              <span>Memo / Warning Deduction</span>
              <strong>{memoPenalty.toFixed(2)}</strong>
            </div>
            <div className={styles.ratingRowNet}>
              <span>Net Ratings</span>
              <strong>{netRating.toFixed(2)}</strong>
            </div>
            <div className={styles.ratingRowFinal}>
              <span>Final Qualifying Ratings</span>
              <strong>{performanceBand}</strong>
            </div>
          </div>
        </div>
      )}

      {showRatings && role !== "reviewer" && role !== "hr" && (
        <div className={styles.infoBox}>Performance Ratings is available only for Reviewer and HR.</div>
      )}

      {showIndex && (
        <div className={styles.ratingsCard}>
          <h3>Index</h3>
          <div className={styles.indexTable}>
            <div className={styles.indexHeader}>Range</div>
            <div className={styles.indexHeader}>Performance Category</div>

            {(ratingBands || []).map((band, index) => {
              const upperBound = index === 0 ? 100 : Math.max(0, (ratingBands[index - 1]?.min ?? 100) - 1);
              const rangeText = `${band.min}% to ${upperBound}%`;

              return [
                <div key={`range-${index}`} className={styles.indexCell}>{rangeText}</div>,
                <div key={`label-${index}`} className={styles.indexCell}>{band.label}</div>,
              ];
            })}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button onClick={onBack}>← Back</button>
        <button
          className={isLast ? styles.submitBtn : ""}
          onClick={handleContinue}
          disabled={loading || (isLast && !markAccessOpen)}
          title={isLast && !markAccessOpen ? "Mark entry has been closed by HR" : undefined}
        >
          {loading ? "Saving…" : isLast ? "Submit Appraisal ✓" : "Next Step →"}
        </button>
      </div>
    </div>
  );
}
