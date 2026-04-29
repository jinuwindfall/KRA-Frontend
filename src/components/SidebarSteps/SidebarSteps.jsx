import styles from "./SidebarSteps.module.css";

const SidebarSteps = ({
  steps,
  currentStep,
  completedSteps = [],
  onStepClick,
  onClose,
}) => {
  return (
    <aside className={styles.sidebar}>
      {onClose && (
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      )}

      <div className={styles.logo}>KRA</div>

      <ul className={styles.steps}>
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(index);
          const isLocked =
            index > Math.max(...completedSteps, currentStep);

          return (
            <li
              key={step}
              className={`${styles.stepItem} ${
                isLocked ? styles.disabled : ""
              }`}
              onClick={() => !isLocked && onStepClick(index)}
            >
              <div className={styles.circle}>
                {isCompleted ? "✔" : index + 1}
              </div>

              <span
                className={`${styles.label} ${
                  isActive ? styles.activeLabel : ""
                }`}
              >
                {step}
                {isLocked && <span className={styles.lock}> 🔒</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default SidebarSteps;
