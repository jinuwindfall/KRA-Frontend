import { useState, useEffect } from "react";
import "./app.css";
import LoginPage from "./pages/LoginPage";
import AppraisalListPage from "./pages/AppraisalListPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import EmployeesPage from "./pages/EmployeesPage";
import KRAFramePage from "./pages/KRAFramePage";
import DownloadPage from "./pages/DownloadPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import MemoPage from "./pages/MemoPage";
import AppraisalForm from "./components/ApprasialForm/AppraisalForm";
import { getMyAppraisals } from "./api/appraisalApi";

function App() {
  const [employee, setEmployee] = useState(() => {
    try {
      const saved = localStorage.getItem("kra_employee");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState("appraisals"); // 'appraisals' | 'departments' | 'employees' | 'memos' | 'structure' | 'downloads'
  const [selectedAppraisalId, setSelectedAppraisalId] = useState(null);
  const [myAppraisalId, setMyAppraisalId] = useState(null); // own appraisal for appraiser/reviewer/hr
  const [selectedDownloadIds, setSelectedDownloadIds] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const isStaffUser = employee?.role === "staff" || employee?.role === "employee";

  const handleLogin = (emp) => setEmployee(emp);

  const handleLogout = () => {
    localStorage.removeItem("kra_token");
    localStorage.removeItem("kra_employee");
    setEmployee(null);
    setSelectedAppraisalId(null);
    setPage("appraisals");
  };

  // Staff: auto-fetch their appraisal and go straight to the form
  useEffect(() => {
    if (isStaffUser && !selectedAppraisalId) {
      setStaffLoading(true);
      setStaffError("");
      getMyAppraisals()
        .then((list) => {
          if (list.length > 0) {
            setSelectedAppraisalId(list[0].id);
          } else {
            setStaffError("No appraisal assigned to you yet.");
          }
        })
        .catch((err) => setStaffError(err.message))
        .finally(() => setStaffLoading(false));
    }
  }, [isStaffUser, selectedAppraisalId]);

  if (!employee) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Staff — go directly to form
  if (isStaffUser) {
    if (page === "change-password") {
      return (
        <ChangePasswordPage
          employee={employee}
          onBack={() => setPage("appraisals")}
          onLogout={handleLogout}
        />
      );
    }
    if (staffLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f4f6f8" }}>
          <p>Loading your appraisal…</p>
        </div>
      );
    }
    if (staffError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f4f6f8", gap: "1rem" }}>
          <p style={{ color: "#b91c1c" }}>{staffError}</p>
          <button onClick={handleLogout} style={{ padding: "8px 20px", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer" }}>Logout</button>
        </div>
      );
    }
    if (selectedAppraisalId) {
      return (
        <AppraisalForm
          appraisalId={selectedAppraisalId}
          employee={employee}
          onBack={() => setPage("appraisals")}
        />
      );
    }
    // Staff "home" — show appraisal button + change password
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f4f6f8", gap: "1rem" }}>
        <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>Welcome, {employee.name}</p>
        {selectedAppraisalId === null && !staffLoading && (
          <button
            onClick={() => {
              setStaffLoading(true);
              import("./api/appraisalApi").then(({ getMyAppraisals }) => {
                getMyAppraisals().then(list => {
                  if (list.length > 0) setSelectedAppraisalId(list[0].id);
                }).finally(() => setStaffLoading(false));
              });
            }}
            style={{ padding: "10px 24px", borderRadius: "6px", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" }}
          >
            Open My Appraisal
          </button>
        )}
        <button onClick={handleLogout} style={{ padding: "8px 20px", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer" }}>Logout</button>
      </div>
    );
  }

  // Appraiser / Reviewer — full appraisal form when one is selected
  if (myAppraisalId) {
    return (
      <AppraisalForm
        appraisalId={myAppraisalId}
        employee={employee}
          viewAsRole="staff"
        onBack={() => setMyAppraisalId(null)}
      />
    );
  }

  // Appraiser / Reviewer — full appraisal form when one is selected
  if (selectedAppraisalId) {
    return (
      <AppraisalForm
        appraisalId={selectedAppraisalId}
        employee={employee}
        onBack={() => setSelectedAppraisalId(null)}
      />
    );
  }

  // Departments page
  if (page === "departments") {
    return (
      <DepartmentsPage
        employee={employee}
        onBack={() => setPage("appraisals")}
      />
    );
  }

  // Employees page
  if (page === "employees") {
    return (
      <EmployeesPage
        employee={employee}
        onBack={() => setPage("appraisals")}
      />
    );
  }

  if (page === "structure") {
    return (
      <KRAFramePage
        employee={employee}
        onBack={() => setPage("appraisals")}
        onLogout={handleLogout}
      />
    );
  }

  if (page === "downloads") {
    return (
      <DownloadPage
        employee={employee}
        onBack={() => setPage("appraisals")}
        onLogout={handleLogout}
        selectedAppraisalIds={selectedDownloadIds}
        setSelectedAppraisalIds={setSelectedDownloadIds}
      />
    );
  }

  if (page === "memos") {
    return (
      <MemoPage
        employee={employee}
        onBack={() => setPage("appraisals")}
      />
    );
  }

  if (page === "change-password") {
    return (
      <ChangePasswordPage
        employee={employee}
        onBack={() => setPage("appraisals")}
        onLogout={handleLogout}
      />
    );
  }

  // Default: Appraisal list
  return (
    <AppraisalListPage
      employee={employee}
      onSelect={(id) => setSelectedAppraisalId(id)}
      onLogout={handleLogout}
      onNavigate={setPage}
      onOpenMyKra={setMyAppraisalId}
      selectedAppraisalIds={selectedDownloadIds}
      setSelectedAppraisalIds={setSelectedDownloadIds}
    />
  );
}

export default App;

