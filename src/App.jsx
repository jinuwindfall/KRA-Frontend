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
import HRShell from "./components/HRShell";
import { getMyAppraisals } from "./api/appraisalApi";
import { pickActiveAppraisal } from "./utils/appraisalSelection";

const HR_PAGE_CONTENT = {
  structure: {
    title: "Common KRA Structure",
    subtitle: "Maintain the shared appraisal structure, sections, targeting rules, and rating setup for staff.",
  },
  downloads: {
    title: "Download Center",
    subtitle: "Preview, filter, and export the latest appraisal documents for the selected staff set.",
  },
  employees: {
    title: "Employees",
    subtitle: "Manage employee records, imports, appraiser mappings, and reviewer assignments from one place.",
  },
  departments: {
    title: "Departments",
    subtitle: "Create, update, and clean up department records inside the HR control panel.",
  },
  memos: {
    title: "Memos",
    subtitle: "Review staff deduction memos and keep memo entries aligned with the appraisal records.",
  },
  "change-password": {
    title: "Change Password",
    subtitle: "Update account credentials without leaving the HR workspace.",
  },
};

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

  const handleOpenMyKra = (appraisalId) => {
    if (typeof appraisalId === "number") {
      setMyAppraisalId(appraisalId);
      return;
    }

    getMyAppraisals()
      .then((list) => {
        const active = pickActiveAppraisal(list);
        if (active?.id) {
          setMyAppraisalId(active.id);
          return;
        }

        alert("No appraisal assigned to you yet.");
      })
      .catch(() => alert("Failed to load your appraisal."));
  };

  // Staff: auto-fetch their appraisal and go straight to the form
  useEffect(() => {
    if (isStaffUser && !selectedAppraisalId) {
      setStaffLoading(true);
      setStaffError("");
      getMyAppraisals()
        .then((list) => {
          const active = pickActiveAppraisal(list);
          if (active?.id) {
            setSelectedAppraisalId(active.id);
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
              getMyAppraisals().then((list) => {
                const active = pickActiveAppraisal(list);
                if (active?.id) setSelectedAppraisalId(active.id);
              }).finally(() => setStaffLoading(false));
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

  const renderPage = () => {
    if (page === "departments") {
      return (
        <DepartmentsPage
          employee={employee}
          onBack={() => setPage("appraisals")}
          embeddedInShell={isHrShellPage}
        />
      );
    }

    if (page === "employees") {
      return (
        <EmployeesPage
          employee={employee}
          onBack={() => setPage("appraisals")}
          embeddedInShell={isHrShellPage}
        />
      );
    }

    if (page === "structure") {
      return (
        <KRAFramePage
          employee={employee}
          onBack={() => setPage("appraisals")}
          onLogout={handleLogout}
          embeddedInShell={isHrShellPage}
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
          embeddedInShell={isHrShellPage}
        />
      );
    }

    if (page === "memos") {
      return (
        <MemoPage
          employee={employee}
          onBack={() => setPage("appraisals")}
          embeddedInShell={isHrShellPage}
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

    return (
      <AppraisalListPage
        employee={employee}
        onSelect={(id) => setSelectedAppraisalId(id)}
        onLogout={handleLogout}
        onNavigate={setPage}
        onOpenMyKra={handleOpenMyKra}
        selectedAppraisalIds={selectedDownloadIds}
        setSelectedAppraisalIds={setSelectedDownloadIds}
      />
    );
  };

  const isHrShellPage = employee?.role === "hr" && Boolean(HR_PAGE_CONTENT[page]);

  if (isHrShellPage) {
    const shellContent = HR_PAGE_CONTENT[page];

    return (
      <HRShell
        employee={employee}
        activePage={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        onOpenMyKra={handleOpenMyKra}
        title={shellContent.title}
        subtitle={shellContent.subtitle}
      >
        {renderPage()}
      </HRShell>
    );
  }

  return renderPage();
}

export default App;

