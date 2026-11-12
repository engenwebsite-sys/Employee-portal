import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { api } from "../lib/api";

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, emps] = await Promise.all([api("/departments"), api("/employees")]);
      setDepartments(depts);
      setEmployees(emps);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load departments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countsByDept = useMemo(() => {
    const map = {};
    for (const e of employees) {
      if (e.department?.id) {
        map[e.department.id] = (map[e.department.id] || 0) + 1;
      }
    }
    return map;
  }, [employees]);

  async function handleCreate(e) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) {
      setError("Department name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const created = await api("/departments", { method: "POST", body: { name: clean } });
      setDepartments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setMessage(`Department "${created.name}" created.`);
    } catch (err) {
      setError(err.message || "Could not create department.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Departments"
      subtitle="Organizational departments and member headcount"
    >
      <div className="grid gap-3.5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs">
          <h2 className="text-xs font-bold text-slate-900">Add Department</h2>
          <form onSubmit={handleCreate} className="mt-3 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700" htmlFor="dept-name">
                Department Name
              </label>
              <input
                id="dept-name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
              />
            </div>

            {message && (
              <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[#16192e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50 shadow-2xs"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs lg:col-span-2">
          <h2 className="text-xs font-bold text-slate-900">
            Departments ({departments.length})
          </h2>

          {loading ? (
            <p className="mt-4 text-xs text-slate-400">Loading departments...</p>
          ) : departments.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400">No departments created yet.</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{dept.name}</div>
                    <div className="text-[10px] text-slate-400">ID #{dept.id}</div>
                  </div>
                  <span className="rounded bg-white border border-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {countsByDept[dept.id] || 0} members
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
