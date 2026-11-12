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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-xl font-extrabold text-nemilink-navy">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2.5 py-1 text-sm font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700"
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
      setError(err.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDirectory(search, departmentId);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, departmentId, loadDirectory]);

  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setModalError("");
    setShowCreate(true);
  }

  function openEdit(emp) {
    setEditing(emp);
    setEditForm({
      role: emp.role,
      is_active: emp.is_active,
      name: emp.name,
      department_id: emp.department?.id ? String(emp.department.id) : "",
      designation: emp.designation || "",
      manager_id: emp.manager?.id ? String(emp.manager.id) : "",
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
        role: editForm.role,
        is_active: editForm.is_active,
        name: editForm.name.trim(),
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        designation: editForm.designation.trim() || null,
        manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
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
      subtitle="Manage employee directory, roles, reporting managers, and account status."
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-nemilink-coral px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
        >
          + Add Employee
        </button>
      }
    >
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or employee code..."
          className="min-w-[240px] flex-1 rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-nemilink-navy"
        />
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-nemilink-navy"
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
        <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-nemilink-navy">No employees found</p>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or click "+ Add Employee" to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-[#faf9ff] text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Manager</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#fcfbff]">
                    <td className="px-5 py-3.5 font-bold text-nemilink-coral">
                      {emp.employee_code}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-nemilink-navy">{emp.name}</div>
                      <div className="text-xs text-gray-500">
                        {emp.designation ? `${emp.designation} · ` : ""}
                        {emp.email}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{emp.department?.name || "—"}</td>
                    <td className="px-5 py-3.5 text-gray-600">{emp.manager?.name || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-nemilink-lavender px-2.5 py-0.5 text-xs font-bold text-nemilink-navy uppercase">
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          emp.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {emp.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(emp)}
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-nemilink-navy transition hover:border-nemilink-navy"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Employee" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Full name *</label>
              <input
                type="text"
                required
                minLength={2}
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Employee code *</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={20}
                placeholder="EMP-004"
                value={createForm.employee_code}
                onChange={(e) => setCreateForm({ ...createForm, employee_code: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Work email *</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Temporary password *
              </label>
              <input
                type="text"
                required
                minLength={8}
                value={createForm.temporary_password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, temporary_password: e.target.value })
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Department</label>
              <select
                value={createForm.department_id}
                onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
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
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Designation</label>
              <input
                type="text"
                value={createForm.designation}
                onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Reporting manager
              </label>
              <select
                value={createForm.manager_id}
                onChange={(e) => setCreateForm({ ...createForm, manager_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
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
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Joining date *</label>
              <input
                type="date"
                required
                value={createForm.joining_date}
                onChange={(e) => setCreateForm({ ...createForm, joining_date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Probation end date
              </label>
              <input
                type="date"
                value={createForm.probation_end_date}
                onChange={(e) =>
                  setCreateForm({ ...createForm, probation_end_date: e.target.value })
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Phone</label>
              <input
                type="text"
                maxLength={20}
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Emergency contact
              </label>
              <input
                type="text"
                maxLength={255}
                value={createForm.emergency_contact}
                onChange={(e) =>
                  setCreateForm({ ...createForm, emergency_contact: e.target.value })
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>

            {modalError && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 sm:col-span-2">
                {modalError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-nemilink-coral px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Employee"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && editForm && (
        <Modal title={`Edit ${editing.name} (${editing.employee_code})`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEditSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Full name *</label>
              <input
                type="text"
                required
                minLength={2}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Department</label>
              <select
                value={editForm.department_id}
                onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
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
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Designation</label>
              <input
                type="text"
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Reporting manager
              </label>
              <select
                value={editForm.manager_id}
                onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
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
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Probation end date
              </label>
              <input
                type="date"
                value={editForm.probation_end_date}
                onChange={(e) => setEditForm({ ...editForm, probation_end_date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">Phone</label>
              <input
                type="text"
                maxLength={20}
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                Emergency contact
              </label>
              <input
                type="text"
                maxLength={255}
                value={editForm.emergency_contact}
                onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-nemilink-navy">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="h-4 w-4 accent-nemilink-coral"
                />
                Account is active (uncheck to disable sign-in)
              </label>
            </div>

            {modalError && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 sm:col-span-2">
                {modalError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-nemilink-coral px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
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

