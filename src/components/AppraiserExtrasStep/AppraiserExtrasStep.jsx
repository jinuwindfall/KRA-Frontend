import styles from "./AppraiserExtrasStep.module.css";
import { normalizeFrameConfig } from "../../utils/frameConfig";

/**
 * AppraiserExtrasStep
 * Appraiser-only step: strong/weak areas, training needs, growth prospects.
 */
export default function AppraiserExtrasStep({ data = {}, setData, frameConfig, readOnly = false, onBack, onNext }) {
  const set = (field, value) => { if (!readOnly) setData((prev) => ({ ...prev, [field]: value })); };
  const normalizedConfig = normalizeFrameConfig(frameConfig);
  const enabledFields = normalizedConfig.appraiser_fields;
  const customFields = normalizedConfig.custom_fields || [];
  const showTraining = ["training_need_a", "training_need_b", "training_need_c"].some(
    (key) => enabledFields[key]
  );
  const showGrowth =
    enabledFields.eligible_for_confirmation ||
    enabledFields.considered_for_additional_responsibilities;
  const setCustomField = (key, value) =>
    set("extra_appraiser_data", {
      ...(data.extra_appraiser_data || {}),
      [key]: value,
    });

  return (
    <div className={styles.card}>
      <h2>Appraiser Assessment</h2>
      {readOnly
        ? <p className={styles.subText}>This section is filled by the appraiser. Shown here for reference.</p>
        : <p className={styles.subText}>Fill in the HR-framed assessment fields for this appraisal.</p>
      }

      {!Object.values(enabledFields).some(Boolean) && customFields.length === 0 && (
        <p className={styles.subText}>HR has not enabled any extra assessment fields for this appraisal.</p>
      )}

      {(enabledFields.strong_areas || enabledFields.weak_areas) && (
        <div className={styles.section}>
          <h3>Performance Areas</h3>
          <div className={styles.row}>
            {enabledFields.strong_areas && (
              <div className={styles.field}>
                <label>Strong Areas</label>
                <textarea
                  rows={4}
                  placeholder="Key strengths observed…"
                  value={data.strong_areas || ""}
                  readOnly={readOnly}
                  onChange={(e) => set("strong_areas", e.target.value)}
                />
              </div>
            )}
            {enabledFields.weak_areas && (
              <div className={styles.field}>
                <label>Areas for Improvement</label>
                <textarea
                  rows={4}
                  placeholder="Areas needing development…"
                  value={data.weak_areas || ""}
                  readOnly={readOnly}
                  onChange={(e) => set("weak_areas", e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showTraining && (
        <div className={styles.section}>
          <h3>Training Needs for the Year</h3>
          {["a", "b", "c"].map((key) => {
            const fieldKey = `training_need_${key}`;
            if (!enabledFields[fieldKey]) return null;
            return (
              <div className={styles.field} key={key}>
                <label>Training Need {key.toUpperCase()}</label>
                <input
                  type="text"
                  placeholder={`Training need ${key.toUpperCase()}…`}
                  value={data[fieldKey] || ""}
                  readOnly={readOnly}
                  onChange={(e) => set(fieldKey, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      {(showGrowth || customFields.length > 0) && (
        <div className={styles.section}>
          <h3>Growth Prospects</h3>

          {enabledFields.eligible_for_confirmation && (
            <div className={styles.field}>
              <label>Eligible for Confirmation?</label>
              <div className={styles.radioGroup}>
                {[
                  { label: "Yes", value: true },
                  { label: "No", value: false },
                  { label: "Not Applicable", value: null },
                ].map(({ label, value }) => (
                  <label key={label}>
                    <input
                      type="radio"
                      name="eligible_for_confirmation"
                      checked={data.eligible_for_confirmation === value}
                      disabled={readOnly}
                      onChange={() => set("eligible_for_confirmation", value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {enabledFields.considered_for_additional_responsibilities && (
            <div className={styles.field}>
              <label>Considered for Additional Responsibilities?</label>
              <div className={styles.radioGroup}>
                {[
                  { label: "Yes", value: true },
                  { label: "No", value: false },
                  { label: "Not Applicable", value: null },
                ].map(({ label, value }) => (
                  <label key={label}>
                    <input
                      type="radio"
                      name="considered_for_additional_responsibilities"
                      checked={data.considered_for_additional_responsibilities === value}
                      disabled={readOnly}
                      onChange={() => set("considered_for_additional_responsibilities", value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {customFields.length > 0 && (
            <>
              {customFields.map((field) => (
                <div className={styles.field} key={field.key}>
                  <label>{field.label}</label>
                  {field.type === "radio" ? (
                    <div className={styles.radioGroup}>
                      {[
                        { label: "Yes", value: "Yes" },
                        { label: "No", value: "No" },
                        { label: "Not Applicable", value: "N/A" },
                      ].map(({ label, value }) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name={field.key}
                            checked={(data.extra_appraiser_data?.[field.key] ?? "") === value}
                            disabled={readOnly}
                            onChange={() => setCustomField(field.key, value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : field.type === "checkbox" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(data.extra_appraiser_data?.[field.key])}
                        disabled={readOnly}
                        onChange={(e) => setCustomField(field.key, e.target.checked)}
                      />
                      {data.extra_appraiser_data?.[field.key] ? "Yes" : "No"}
                    </label>
                  ) : (
                    <input
                      type="text"
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                      value={data.extra_appraiser_data?.[field.key] || ""}
                      readOnly={readOnly}
                      onChange={(e) => setCustomField(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button onClick={onBack}>← Back</button>
        <button onClick={onNext}>Next Step →</button>
      </div>
    </div>
  );
}
