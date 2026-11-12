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
    <AppShell title="Departments" subtitle="Organize teams and view headcount across departments.">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <span className="section-label">NEW DEPARTMENT</span>
          <h2 className="mt-2 text-lg font-bold text-nemilink-navy">Add department</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-nemilink-navy" htmlFor="dept-name">
                Department name
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
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-nemilink-navy"
              />
            </div>

            {message && (
              <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-nemilink-coral px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create department"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">DIRECTORY</span>
              <h2 className="mt-1 text-lg font-bold text-nemilink-navy">
                All departments ({departments.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-gray-500">Loading departments...</p>
          ) : departments.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">No departments created yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between rounded-2xl border border-[#eceaf9] bg-[#faf9ff] px-4 py-3.5"
                >
                  <div>
                    <div className="font-bold text-nemilink-navy">{dept.name}</div>
                    <div className="text-xs text-gray-500">ID #{dept.id}</div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-nemilink-navy shadow-xs">
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

