import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { api } from "../lib/api";

const EMPTY_CREATE = {
  email: "",
  role: "employee",
  temporary_password: "Welcome@123",
  employee_code: "",
  name: "",
  department_id: "",
  designation: "",
  manager_id: "",
  joining_date: new Date().toISOString().slice(0, 10),
  probation_end_date: "",
  phone: "",
  emergency_contact: "",
};

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-2xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl">
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [allManagers, setAllManagers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showInlineDept, setShowInlineDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [addingDept, setAddingDept] = useState(false);
  const [deptAddError, setDeptAddError] = useState("");

  async function handleQuickAddDepartment(isEdit = false) {
    const clean = newDeptName.trim();
    if (!clean) return;
    setAddingDept(true);
    setDeptAddError("");
    try {
      const created = await api("/departments", {
        method: "POST",
        body: { name: clean },
      });
      const updated = [...departments, created].sort((a, b) => a.name.localeCompare(b.name));
      setDepartments(updated);
      if (isEdit) {
        setEditForm((prev) => ({ ...prev, department_id: String(created.id) }));
      } else {
        setCreateForm((prev) => ({ ...prev, department_id: String(created.id) }));
      }
      setNewDeptName("");
      setShowInlineDept(false);
    } catch (err) {
      setDeptAddError(err.message || "Could not create department.");
    } finally {
      setAddingDept(false);
    }
  }

  const loadDirectory = useCallback(async (q, deptId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      if (deptId) params.set("department_id", deptId);
      const qs = params.toString();
      const [emps, depts] = await Promise.all([
        api(`/employees${qs ? `?${qs}` : ""}`),
        api("/departments"),
      ]);
      setEmployees(emps);
      setDepartments(depts);
      if (!q.trim() && !deptId) {
        setAllManagers(emps);
      }
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load employee list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(search, departmentId);
  }, [loadDirectory, search, departmentId]);

  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setModalError("");
    setShowCreate(true);
  }

  function openEdit(emp) {
    setEditing(emp);
    setEditForm({
      employee_code: emp.employee_code || "",
      email: emp.email || "",
      role: emp.role,
      is_active: emp.is_active,
      name: emp.name,
      department_id: emp.department?.id ? String(emp.department.id) : "",
      designation: emp.designation || "",
      manager_id: emp.manager?.id ? String(emp.manager.id) : "",
      joining_date: emp.joining_date || "",
      probation_end_date: emp.probation_end_date || "",
      phone: emp.phone || "",
      emergency_contact: emp.emergency_contact || "",
    });
    setModalError("");
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        email: createForm.email.trim(),
        role: createForm.role,
        temporary_password: createForm.temporary_password,
        employee_code: createForm.employee_code.trim(),
        name: createForm.name.trim(),
        department_id: createForm.department_id ? Number(createForm.department_id) : null,
        designation: createForm.designation.trim() || null,
        manager_id: createForm.manager_id ? Number(createForm.manager_id) : null,
        joining_date: createForm.joining_date,
        probation_end_date: createForm.probation_end_date || null,
        phone: createForm.phone.trim() || null,
        emergency_contact: createForm.emergency_contact.trim() || null,
      };
      await api("/employees", { method: "POST", body: payload });
      setShowCreate(false);
      await loadDirectory(search, departmentId);
    } catch (err) {
      setModalError(err.message || "Could not create employee.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        employee_code: editForm.employee_code.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        is_active: editForm.is_active,
        name: editForm.name.trim(),
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        designation: editForm.designation.trim() || null,
        manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
        joining_date: editForm.joining_date || null,
        probation_end_date: editForm.probation_end_date || null,
        phone: editForm.phone.trim() || null,
        emergency_contact: editForm.emergency_contact.trim() || null,
      };
      await api(`/employees/${editing.id}`, { method: "PATCH", body: payload });
      setEditing(null);
      await loadDirectory(search, departmentId);
    } catch (err) {
      setModalError(err.message || "Could not update employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Employees"
      subtitle="Employee directory, role assignment, and reporting lines"
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="btn-brand-gradient rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1"
        >
          + Add Employee
        </button>
      }
    >
      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or code..."
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
        />
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Responsive Table / Card Container */}
      <div className="card-pastel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading directory...</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-bold text-slate-800">No employees found</p>
            <p className="mt-1 text-xs text-slate-400">
              Try adjusting your search or add a new employee profile.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2.5">Code</th>
                    <th className="px-3.5 py-2.5">Employee</th>
                    <th className="px-3.5 py-2.5">Department</th>
                    <th className="px-3.5 py-2.5">Manager</th>
                    <th className="px-3.5 py-2.5">Role</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {emp.employee_code}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {emp.designation ? `${emp.designation} · ` : ""}
                          {emp.email}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{emp.department?.name || "General"}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{emp.manager?.name || "—"}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            emp.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-rose-50 text-rose-700 border border-rose-200/60"
                          }`}
                        >
                          {emp.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(emp)}
                          className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {employees.map((emp) => (
                <article key={emp.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{emp.name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{emp.employee_code} · {emp.designation || "Member"}</div>
                    </div>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        emp.is_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-rose-50 text-rose-700 border border-rose-200/60"
                      }`}
                    >
                      {emp.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <div className="truncate">{emp.email}</div>
                    <div className="text-slate-400">
                      Dept: <span className="text-slate-700 font-medium">{emp.department?.name || "General"}</span> · Role: <span className="font-semibold uppercase text-slate-700">{emp.role}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => openEdit(emp)}
                      className="rounded-md border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit Profile
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Employee Profile" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateSubmit} className="grid gap-2.5 sm:grid-cols-2 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Employee Code *</label>
              <input
                type="text"
                required
                placeholder="EMP004"
                value={createForm.employee_code}
                onChange={(e) => setCreateForm({ ...createForm, employee_code: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Work Email *</label>
              <input
                type="email"
                required
                placeholder="user@nemilink.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="font-semibold text-slate-700">Department</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineDept(!showInlineDept);
                    setDeptAddError("");
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                >
                  {showInlineDept ? "✕ Cancel" : "+ New Dept"}
                </button>
              </div>

              {showInlineDept && (
                <div className="mb-2 rounded-lg border border-rose-100 bg-rose-50/60 p-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Mechatronics"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
                    />
                    <button
                      type="button"
                      disabled={addingDept || !newDeptName.trim()}
                      onClick={() => handleQuickAddDepartment(false)}
                      className="btn-brand-gradient rounded-md px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {addingDept ? "..." : "Add"}
                    </button>
                  </div>
                  {deptAddError && (
                    <p className="mt-1 text-[10px] font-medium text-rose-700">{deptAddError}</p>
                  )}
                </div>
              )}

              <select
                value={createForm.department_id}
                onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Designation</label>
              <input
                type="text"
                value={createForm.designation}
                onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Reporting Manager</label>
              <select
                value={createForm.manager_id}
                onChange={(e) => setCreateForm({ ...createForm, manager_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {allManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.employee_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Joining Date *</label>
              <input
                type="date"
                required
                value={createForm.joining_date}
                onChange={(e) => setCreateForm({ ...createForm, joining_date: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>

            {modalError && (
              <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 sm:col-span-2">
                {modalError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && editForm && (
        <Modal title={`Edit Profile — ${editing.name} (${editing.employee_code})`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEditSubmit} className="grid gap-2.5 sm:grid-cols-2 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Employee Code *</label>
              <input
                type="text"
                required
                value={editForm.employee_code}
                onChange={(e) => setEditForm({ ...editForm, employee_code: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400 uppercase"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Work Email *</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="font-semibold text-slate-700">Department</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineDept(!showInlineDept);
                    setDeptAddError("");
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                >
                  {showInlineDept ? "✕ Cancel" : "+ New Dept"}
                </button>
              </div>

              {showInlineDept && (
                <div className="mb-2 rounded-lg border border-rose-100 bg-rose-50/60 p-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Mechatronics"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
                    />
                    <button
                      type="button"
                      disabled={addingDept || !newDeptName.trim()}
                      onClick={() => handleQuickAddDepartment(true)}
                      className="btn-brand-gradient rounded-md px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {addingDept ? "..." : "Add"}
                    </button>
                  </div>
                  {deptAddError && (
                    <p className="mt-1 text-[10px] font-medium text-rose-700">{deptAddError}</p>
                  )}
                </div>
              )}

              <select
                value={editForm.department_id}
                onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Designation</label>
              <input
                type="text"
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Reporting Manager</label>
              <select
                value={editForm.manager_id}
                onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {allManagers
                  .filter((m) => m.id !== editing.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.employee_code})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Joining Date *</label>
              <input
                type="date"
                required
                value={editForm.joining_date}
                onChange={(e) => setEditForm({ ...editForm, joining_date: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Probation End Date</label>
              <input
                type="date"
                value={editForm.probation_end_date}
                onChange={(e) => setEditForm({ ...editForm, probation_end_date: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-semibold text-slate-700">Emergency Contact</label>
              <input
                type="text"
                placeholder="Name - Relationship - Phone"
                value={editForm.emergency_contact}
                onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="h-3.5 w-3.5 accent-[#16192e] rounded"
                />
                Active account (uncheck to disable access)
              </label>
            </div>

            {modalError && (
              <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 sm:col-span-2">
                {modalError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
