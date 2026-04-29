import { useState } from "react";
import styles from "./EmployeeInfoStep.module.css";

const KRA_MASTER = [
  {
    id: 1,
    title: "Customer Satisfaction",
    description:
      "Resolve 99% of issues with highest customer satisfaction, adhere to process, manage SLAs, ensure delivery on time and within budget.",
    maxMarks: 25,
  },
  {
    id: 2,
    title: "Effective Communication",
    description:
      "Communicate effectively with stakeholders, explain technical concepts clearly, listen and understand needs.",
    maxMarks: 25,
  },
  {
    id: 3,
    title: "Product Quality",
    description:
      "Ensure quality of product releases to 90%, manage rework to minimum.",
    maxMarks: 25,
  },
  {
    id: 4,
    title: "Innovation & Learning",
    description:
      "Come up with ideas to resolve issues, continuously learn, attend trainings, gain knowledge in HubSpot & Python.",
    maxMarks: 25,
  },
];

const KRAObjectivesStep = ({ onNext, onBack }) => {
  const [scores, setScores] = useState(
    KRA_MASTER.map((kra) => ({
      kraId: kra.id,
      appraiseeScore: "",
      finalRating: 0,
    }))
  );

  const handleScoreChange = (index, value) => {
    const updated = [...scores];
    updated[index].appraiseeScore = value;
    setScores(updated);
  };

  const totalScore = scores.reduce(
    (sum, s) => sum + Number(s.appraiseeScore || 0),
    0
  );

  return (
    <div className={styles.card}>
      <h2>PART 1 – KRA’s (60% Weightage)</h2>
<div className={styles.headerRow}>
  <h2>PART 1 – KRA’s (60% Weightage)</h2>

  <div className={styles.totalScore}>
    Total Score: <strong>{total}</strong> / 100
  </div>
</div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Sl No</th>
            <th>KRA</th>
            <th>Max Marks</th>
            <th>Appraisee</th>
            <th>Final Rating</th>
          </tr>
        </thead>

        <tbody>
          {KRA_MASTER.map((kra, index) => (
            <tr key={kra.id}>
              <td>{kra.id}</td>
              <td>
                <strong>{kra.title}</strong>
                <p>{kra.description}</p>
              </td>
              <td>{kra.maxMarks}</td>
              <td>
                <input
                  type="number"
                  max={kra.maxMarks}
                  value={scores[index].appraiseeScore}
                  onChange={(e) =>
                    handleScoreChange(index, e.target.value)
                  }
                />
              </td>
              <td>{scores[index].finalRating}</td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan="2">Total</td>
            <td>100</td>
            <td>{totalScore}</td>
            <td>-</td>
          </tr>
        </tfoot>
      </table>

      <div className={styles.actions}>
        <button onClick={onBack}>← Back</button>
        <button onClick={onNext}>Next Step →</button>
      </div>
    </div>
  );
};

export default KRAObjectivesStep;
