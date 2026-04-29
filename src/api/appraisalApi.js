const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'https://kra-backend-p404.onrender.com'
).replace(/\/$/, '');

function authTokenHeaders() {
  const token = localStorage.getItem('kra_token') || '';
  if (!token) return {};
  return {
    Authorization: `Token ${token}`,
  };
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...authTokenHeaders(),
  };
}

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const fieldError = Object.values(err).find((v) => typeof v === 'string' || Array.isArray(v));
    const fieldMessage = Array.isArray(fieldError) ? fieldError.join(', ') : fieldError;
    throw new Error(err.detail || err.error || fieldMessage || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function login(username, password) {
  const res = await fetch(`${BASE}/employees/api/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handle(res);
}

export async function resetPassword(username, emp_id, new_password) {
  const res = await fetch(`${BASE}/employees/api/reset-password/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, emp_id, new_password }),
  });
  return handle(res);
}

export async function changePassword(current_password, new_password) {
  const res = await fetch(`${BASE}/employees/api/change-password/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ current_password, new_password }),
  });
  return handle(res);
}

export async function getMyAppraisals() {
  const res = await fetch(`${BASE}/appraisals/api/appraisals/my/`, {
    headers: authTokenHeaders(),
  });
  return handle(res);
}

export async function getAllAppraisals() {
  const res = await fetch(`${BASE}/appraisals/api/appraisals/`, {
    headers: authTokenHeaders(),
  });
  return handle(res);
}

export async function getAppraisal(id) {
  const res = await fetch(`${BASE}/appraisals/api/appraisals/${id}/`, {
    headers: authTokenHeaders(),
  });
  return handle(res);
}

export async function createKRA(data) {
  const res = await fetch(`${BASE}/appraisals/api/kras/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function patchAppraisal(id, data) {
  const res = await fetch(`${BASE}/appraisals/api/appraisals/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function patchKRA(id, data) {
  const res = await fetch(`${BASE}/appraisals/api/kras/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function deleteKRA(id) {
  const res = await fetch(`${BASE}/appraisals/api/kras/${id}/`, {
    method: 'DELETE',
    headers: authTokenHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Request failed (${res.status})`);
  }
  return true;
}

// ── KRA Template ──

export async function getKRATemplate() {
  const res = await fetch(`${BASE}/appraisals/api/kra-template/`, {
    headers: authTokenHeaders(),
  });
  return handle(res);
}

export async function saveKRATemplate(frame_config, rows) {
  const res = await fetch(`${BASE}/appraisals/api/kra-template/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ frame_config, rows }),
  });
  return handle(res);
}

// ── Departments ──

export async function getDepartments() {
  const res = await fetch(`${BASE}/employees/api/departments/`, {
    headers: authTokenHeaders(),
  });
  return handle(res);
}

export async function createDepartment(name) {
  const res = await fetch(`${BASE}/employees/api/departments/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  return handle(res);
}

export async function deleteDepartment(id) {
  const res = await fetch(`${BASE}/employees/api/departments/${id}/`, {
    method: 'DELETE',
    headers: authTokenHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Request failed (${res.status})`);
  }
  return true;
}

export async function updateDepartment(id, name) {
  const res = await fetch(`${BASE}/employees/api/departments/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  return handle(res);
}

// ── Employees ──

export async function getEmployees() {
  const firstRes = await fetch(`${BASE}/employees/api/employees/`, {
    headers: authTokenHeaders(),
  });
  const firstData = await handle(firstRes);

  // Supports both plain array and paginated ({ results, next }) responses.
  if (Array.isArray(firstData)) {
    return firstData;
  }

  if (firstData && Array.isArray(firstData.results)) {
    const allEmployees = [...firstData.results];
    let nextUrl = firstData.next;

    while (nextUrl) {
      const nextRes = await fetch(nextUrl, {
        headers: authTokenHeaders(),
      });
      const nextData = await handle(nextRes);
      if (!nextData || !Array.isArray(nextData.results)) break;

      allEmployees.push(...nextData.results);
      nextUrl = nextData.next;
    }

    return allEmployees;
  }

  return [];
}

export async function createEmployee(data) {
  const res = await fetch(`${BASE}/employees/api/employees/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function patchEmployee(id, data) {
  const res = await fetch(`${BASE}/employees/api/employees/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function deleteEmployee(id) {
  const res = await fetch(`${BASE}/employees/api/employees/${id}/`, {
    method: 'DELETE',
    headers: authTokenHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Request failed (${res.status})`);
  }
  return true;
}

export async function importEmployees(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/employees/api/employees/import/`, {
    method: 'POST',
    headers: authTokenHeaders(),
    body: formData,
  });
  return handle(res);
}

// ── Reviewer / Appraiser Departments ──

export async function setReviewerDepartments(employeeId, departmentIds) {
  const res = await fetch(`${BASE}/employees/api/employees/${employeeId}/reviewer-departments/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ department_ids: departmentIds }),
  });
  return handle(res);
}

export async function setAppraiserDepartments(employeeId, departmentIds) {
  const res = await fetch(`${BASE}/employees/api/employees/${employeeId}/appraiser-departments/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ department_ids: departmentIds }),
  });
  return handle(res);
}

export async function getDepartmentManagers(departmentId) {
  const res = await fetch(`${BASE}/employees/api/department-managers/?department_id=${departmentId}`, {
    headers: authTokenHeaders(),
  });
  return handle(res);
}
