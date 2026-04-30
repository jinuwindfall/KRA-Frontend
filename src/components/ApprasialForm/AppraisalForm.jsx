import { useState, useEffect, useMemo } from "react";
import SidebarSteps from "../SidebarSteps/SidebarSteps";
import EmployeeInfoStep from "../EmployeeInfoStep/EmployeeInfoStep";
import KRAObjectivesStep from "../KRAObjectivesStep/KRAObjectivesStep";
import CompetenciesStep from "../CompetenciesStep/CompetenciesStep";
import BehaviourStep from "../BehaviourStep/BehaviourStep";
import AppraiserExtrasStep from "../AppraiserExtrasStep/AppraiserExtrasStep";
import RemarksStep from "../RemarksStep/RemarksStep";
import RatingsIndexStep from "../RatingsIndexStep/RatingsIndexStep";
import { getAppraisal, patchAppraisal, patchKRA } from "../../api/appraisalApi";
import { normalizeFrameConfig } from "../../utils/frameConfig";
import styles from "./AppraisalForm.module.css";

function buildMarksState(kras) {
  const state = {};
  kras.forEach((k) => {
    state[k.id] = {
      appraisee_mark: k.appraisee_mark,
      appraiser_mark: k.appraiser_mark,
      reviewer_mark:  k.reviewer_mark,
    };
  });
  return state;
}

const AppraisalForm = ({ appraisalId, employee, onBack, viewAsRole }) => {
  const resolvedRole = viewAsRole || employee?.role || "staff";
  const role = resolvedRole === "employee" ? "staff" : resolvedRole;

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Appraisal data
  const [appraisal, setAppraisal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // KRA marks — { [kraId]: { appraisee_mark, appraiser_mark, reviewer_mark } }
  const [marks, setMarks] = useState({});

  // Appraiser-specific extras
  const [extras, setExtras] = useState({
    strong_areas: "",
    weak_areas: "",
    training_need_a: "",
    training_need_b: "",
    training_need_c: "",
    eligible_for_confirmation: null,
    considered_for_additional_responsibilities: null,
    extra_appraiser_data: {},
  });

  // Remarks
  const [remarks, setRemarks] = useState({
    employee_remarks: "",
    appraiser_remarks: "",
    reviewer_remarks: "",
    mgmt_hr_remarks: "",
  });

  // Fetch appraisal on mount
  useEffect(() => {
    setLoading(true);
    getAppraisal(appraisalId)
      .then((data) => {
        setAppraisal(data);
        setMarks(buildMarksState(data.kras || []));
        setExtras({
          strong_areas: data.strong_areas || "",
          weak_areas: data.weak_areas || "",
          training_need_a: data.training_need_a || "",
          training_need_b: data.training_need_b || "",
          training_need_c: data.training_need_c || "",
          eligible_for_confirmation: data.eligible_for_confirmation,
          considered_for_additional_responsibilities: data.considered_for_additional_responsibilities,
          extra_appraiser_data: data.extra_appraiser_data || {},
        });
        setRemarks({
          employee_remarks: data.employee_remarks || "",
          appraiser_remarks: data.appraiser_remarks || "",
          reviewer_remarks: data.reviewer_remarks || "",
          mgmt_hr_remarks: data.mgmt_hr_remarks || "",
        });
      })
      .catch((err) => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [appraisalId]);

  const krasBySection = (section) =>
    (appraisal?.kras || []).filter((k) => k.section === section);

  const frameConfig = useMemo(
    () => normalizeFrameConfig(appraisal?.frame_config),
    [appraisal?.frame_config]
  );
  const isHR = role === "hr";
  const markAccessOpen = Boolean(appraisal?.mark_entry_access_open);
  const appraisalStatus = appraisal?.status || "Draft";

  // Mark visibility is controlled by HR toggle (plus always visible for HR).
  const canViewMarks = role === "hr" || markAccessOpen;

  // Whether the current role has already submitted
  const alreadySubmitted =
    (role === "staff" && appraisalStatus !== "Draft") ||
    (role === "appraiser" && ["Appraiser Reviewed", "Reviewed"].includes(appraisalStatus)) ||
    (role === "reviewer" && appraisalStatus === "Reviewed");
  const steps = useMemo(() => {
    const configuredSteps = ["Employee Info"];

    if (frameConfig.steps.kra_objectives) configuredSteps.push("KRA Objectives");
    if (frameConfig.steps.competencies) configuredSteps.push("Competencies");
    if (frameConfig.steps.behaviour) configuredSteps.push("Behaviour");
    if ((role === "appraiser" || role === "reviewer" || role === "hr") && frameConfig.steps.appraiser_details) {
      configuredSteps.push("Appraiser Details");
    }
    if (frameConfig.steps.remarks) configuredSteps.push("Remarks");
    if ((role === "reviewer" || role === "hr") && frameConfig.steps.performance_ratings) {
      configuredSteps.push("Performance Ratings");
    }

    configuredSteps.push("Index");
    return configuredSteps;
  }, [frameConfig, role]);
  // canEditMarks: HR toggle controls access for all roles, except users who already submitted.
  const canEditMarks = markAccessOpen && !alreadySubmitted;

  useEffect(() => {
    setCurrentStep((prev) => Math.min(prev, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  const goNext = () => {
    setCompletedSteps((prev) =>
      prev.includes(currentStep) ? prev : [...prev, currentStep]
    );
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const autoSaveAndGoBack = async () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    // Silent background save on back navigation too
    setSaving(true);
    try {
      await saveMarks();
      await patchAppraisal(appraisalId, buildAppraisalPatch(false));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  // Save marks + remarks/extras for the current role (no status change)
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const markField =
    role === "appraiser"
      ? "appraiser_mark"
      : role === "reviewer" || role === "hr"
      ? "reviewer_mark"
      : "appraisee_mark";

  const buildAppraisalPatch = (withStatus) => {
    if (role === "staff") {
      return {
        employee_remarks: remarks.employee_remarks,
        ...(withStatus ? { status: "Submitted" } : {}),
      };
    }
    if (role === "appraiser") {
      return {
        appraiser_remarks: remarks.appraiser_remarks,
        ...extras,
        ...(withStatus ? { status: "Appraiser Reviewed" } : {}),
      };
    }
    if (role === "reviewer") {
      return {
        reviewer_remarks: remarks.reviewer_remarks,
        mgmt_hr_remarks: remarks.mgmt_hr_remarks,
        ...(withStatus ? { status: "Reviewed" } : {}),
      };
    }
    if (role === "hr") {
      return { mgmt_hr_remarks: remarks.mgmt_hr_remarks };
    }
    return {};
  };

  const saveMarks = async () => {
    const allKras = appraisal?.kras || [];
    await Promise.all(
      allKras.map((kra) => {
        const m = marks[kra.id] || {};
        const newVal = m[markField];
        if (newVal !== undefined && newVal !== null) {
          return patchKRA(kra.id, { [markField]: newVal });
        }
        return Promise.resolve();
      })
    );
  };

  const autoSaveAndGoNext = async () => {
    setCompletedSteps((prev) =>
      prev.includes(currentStep) ? prev : [...prev, currentStep]
    );
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
    // Silent background save — doesn't block navigation
    setSaving(true);
    try {
      await saveMarks();
      await patchAppraisal(appraisalId, buildAppraisalPatch(false));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await saveMarks();
      await patchAppraisal(appraisalId, buildAppraisalPatch(false));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSaveError("");
    try {
      await saveMarks();
      await patchAppraisal(appraisalId, buildAppraisalPatch(true));
      // Refresh appraisal to update status
      const updated = await getAppraisal(appraisalId);
      setAppraisal(updated);
    } catch (err) {
      setSaveError(err.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingMsg}>Loading appraisal…</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorMsg}>{fetchError}</div>
        <button onClick={onBack} className={styles.backLink}>← Back to list</button>
      </div>
    );
  }

  const currentStepName = steps[currentStep];
  const showFormBackButton =
    Boolean(onBack) && (role !== "staff" || employee?.role !== "staff");

  const handleLogout = () => {
    localStorage.removeItem("kra_token");
    localStorage.removeItem("kra_employee");
    window.location.reload();
  };

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        {showFormBackButton && (
          <button className={styles.topBackBtn} onClick={onBack}>← Back</button>
        )}
        <span className={styles.topTitle}>Performance Appraisal</span>
      </div>

      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        {showFormBackButton && (
          <button className={styles.mobileBackBtn} onClick={onBack}>← Back</button>
        )}
        <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>☰</button>
        <span>Performance Appraisal</span>
      </div>

      <div className={styles.wrapper}>
        {/* Sidebar */}
        <div className={`${styles.sidebarWrapper} ${sidebarOpen ? styles.open : ""}`}>
          <SidebarSteps
            steps={steps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            userName={employee?.name || employee?.emp_id}
            onLogout={handleLogout}
            onStepClick={(index) => {
              const maxAllowed = Math.max(...completedSteps, currentStep);
              if (index <= maxAllowed) {
                setCurrentStep(index);
                setSidebarOpen(false);
              }
            }}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div
            className={`${styles.accessStatusBadge} ${markAccessOpen ? styles.accessEnabled : styles.accessDisabled}`}
          >
            Rating Section: {markAccessOpen ? "Open" : "Hidden by HR"}
            {saving && <span style={{ marginLeft: 12, fontSize: '0.78rem', color: '#6366f1', fontWeight: 600 }}>💾 Auto-saving…</span>}
            {saveSuccess && !saving && <span style={{ marginLeft: 12, fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>✔ Saved</span>}
          </div>

          {/* Workflow status banner */}
          {!canViewMarks && role !== "hr" && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: '0.9rem', color: '#92400e', fontWeight: 500 }}>
              ⏳ Rating section is currently hidden. Ask HR to enable "Show Rating Section".
            </div>
          )}

          {alreadySubmitted && role !== "hr" && (
            <div style={{ background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: '0.9rem', color: '#065f46', fontWeight: 500 }}>
              ✅ You have submitted this appraisal. No further edits are allowed.
            </div>
          )}

          {/* Step 0 – Employee Info */}
          {currentStepName === "Employee Info" && (
            <EmployeeInfoStep
              appraisal={appraisal}
              employee={employee}
              onNext={goNext}
            />
          )}

          {/* Step 1 – KRA Objectives */}
          {currentStepName === "KRA Objectives" && (
            <KRAObjectivesStep
              title="KRA Objectives"
              appraisal={appraisal}
              kras={krasBySection("kra_objectives")}
              marks={marks}
              setMarks={setMarks}
              role={role}
              canEditMarks={canEditMarks}
              onBack={autoSaveAndGoBack}
              onNext={autoSaveAndGoNext}
            />
          )}

          {/* Step 2 – Competencies */}
          {currentStepName === "Competencies" && (
            <CompetenciesStep
              appraisal={appraisal}
              kras={krasBySection("competencies")}
              marks={marks}
              setMarks={setMarks}
              role={role}
              canEditMarks={canEditMarks}
              onBack={autoSaveAndGoBack}
              onNext={autoSaveAndGoNext}
            />
          )}

          {/* Step 3 – Behaviour */}
          {currentStepName === "Behaviour" && (
            <BehaviourStep
              appraisal={appraisal}
              kras={krasBySection("behaviour")}
              marks={marks}
              setMarks={setMarks}
              role={role}
              canEditMarks={canEditMarks}
              onBack={autoSaveAndGoBack}
              onNext={autoSaveAndGoNext}
            />
          )}

          {/* Step 4 – Appraiser Extras (appraiser only) */}
          {currentStepName === "Appraiser Details" && (role === "appraiser" || role === "reviewer" || role === "hr") && (
            <AppraiserExtrasStep
              data={extras}
              setData={setExtras}
              frameConfig={frameConfig}
              readOnly={role !== "appraiser"}
              onBack={role === "appraiser" ? autoSaveAndGoBack : goBack}
              onNext={role === "appraiser" ? autoSaveAndGoNext : goNext}
            />
          )}

          {currentStepName === "Remarks" && (
            <RemarksStep
              role={role}
              appraisal={appraisal}
              marks={marks}
              remarks={remarks}
              setRemarks={setRemarks}
              onBack={autoSaveAndGoBack}
              onNext={autoSaveAndGoNext}
            />
          )}

          {currentStepName === "Performance Ratings" && (
            <RatingsIndexStep
              mode="ratings"
              role={role}
              appraisal={appraisal}
              marks={marks}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {currentStepName === "Index" && (
            <RatingsIndexStep
              mode="index"
              role={role}
              appraisal={appraisal}
              marks={marks}
              onBack={autoSaveAndGoBack}
              onSubmit={!alreadySubmitted ? handleSubmit : undefined}
              markAccessOpen={markAccessOpen}
              isLast
            />
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default AppraisalForm;
