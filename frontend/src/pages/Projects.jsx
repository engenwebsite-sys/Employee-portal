import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const STATUS_BADGE = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200/60",
  Completed: "bg-blue-50 text-blue-700 border-blue-200/60",
  Archived: "bg-slate-100 text-slate-500 border-slate-200/60",
};

const DIVISION_BY_DOMAIN = {
  "maargaai.com": "Maarga",
  "nemilink.com": "Nemilink",
};

function DivisionSelect({ value, options, onChange }) {
  return (
    <label className="block font-semibold text-slate-700">
      Division *
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-normal outline-none focus:border-slate-400"
      >
        <option value="" disabled>Select a division</option>
        {options.map((division) => <option key={division} value={division}>{division}</option>)}
      </select>
    </label>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const isHR = user?.role === "hr";
  const ownDivision = DIVISION_BY_DOMAIN[user?.email?.trim().toLowerCase().split("@").at(-1)];
  const canManage = isHR || (user?.role === "manager" && Boolean(ownDivision));
  const divisionOptions = isHR ? Object.values(DIVISION_BY_DOMAIN) : [ownDivision];

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    client: "",
    description: "",
    status: "Active",
    division: "",
  });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(isHR ? "/projects?manage=true" : "/projects", { cache: "no-store" });
      setProjects(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [isHR]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.client && p.client.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [projects, statusFilter, search]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "Active").length;
    const completed = projects.filter((p) => p.status === "Completed").length;
    const onHold = projects.filter((p) => p.status === "On Hold").length;
    return { total, active, completed, onHold };
  }, [projects]);

  function openAdd() {
    setFormData({
      name: "",
      code: "",
      client: "",
      description: "",
      status: "Active",
      division: isHR ? "" : ownDivision,
    });
    setModalError("");
    setShowAddModal(true);
  }

  function openEdit(proj) {
    setEditingProject(proj);
    setFormData({
      name: proj.name,
      code: proj.code || "",
      client: proj.client || "",
      description: proj.description || "",
      status: proj.status || "Active",
      division: proj.division || "",
    });
    setModalError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      await api("/projects", {
        method: "POST",
        body: {
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          client: formData.client.trim() || null,
          description: formData.description.trim() || null,
          status: formData.status,
          division: formData.division,
        },
      });
      setShowAddModal(false);
      await loadProjects();
    } catch (err) {
      setModalError(err.message || "Failed to create project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editingProject) return;
    setSaving(true);
    setModalError("");
    try {
      await api(`/projects/${editingProject.id}`, {
        method: "PATCH",
        body: {
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          client: formData.client.trim() || null,
          description: formData.description.trim() || null,
          status: formData.status,
          division: formData.division,
        },
      });
      setEditingProject(null);
      await loadProjects();
    } catch (err) {
      setModalError(err.message || "Failed to update project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(proj) {
    if (!window.confirm(`Are you sure you want to delete project "${proj.name}"?`)) return;
    try {
      await api(`/projects/${proj.id}`, { method: "DELETE" });
      await loadProjects();
    } catch (err) {
      alert(err.message || "Failed to delete project.");
    }
  }

  return (
    <AppShell
      title="Projects"
      subtitle="Client deliverables, internal initiatives, and active assignments"
      actions={
        canManage ? (
          <button
            type="button"
            onClick={openAdd}
            className="btn-brand-gradient inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <span className="text-sm">+</span>
            <span>Add Project</span>
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* KPI stat summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card-pastel p-3 sm:p-4">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
            <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="card-pastel p-3 sm:p-4">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Active</span>
            <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-700">{stats.active}</p>
          </div>
          <div className="card-pastel p-3 sm:p-4">
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">On Hold</span>
            <p className="mt-1 text-xl sm:text-2xl font-black text-amber-700">{stats.onHold}</p>
          </div>
          <div className="card-pastel p-3 sm:p-4">
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Completed</span>
            <p className="mt-1 text-xl sm:text-2xl font-black text-blue-700">{stats.completed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search by project, code, or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {["all", "Active", "On Hold", "Completed", "Archived"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all capitalize ${
                  statusFilter === st
                    ? "bg-[#16192e] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200/60">
            {error}
          </div>
        )}

        {/* Projects Table */}
        <section className="card-pastel overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading projects...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No projects found. Click "+ Add Project" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3.5 py-2.5">Project Name</th>
                    <th className="px-3.5 py-2.5">Code</th>
                    <th className="px-3.5 py-2.5">Client</th>
                    <th className="px-3.5 py-2.5">Division</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Description</th>
                    {canManage && <th className="px-3.5 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((proj) => (
                    <tr key={proj.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">{proj.name}</td>
                      <td className="px-3.5 py-2.5">
                        {proj.code ? (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 font-semibold">
                            {proj.code}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">{proj.client || "—"}</td>
                      <td className="px-3.5 py-2.5 text-slate-700">{proj.division || "Unassigned"}</td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                            STATUS_BADGE[proj.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {proj.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 max-w-xs truncate" title={proj.description || ""}>
                        {proj.description || "—"}
                      </td>
                      {canManage && (
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(proj)}
                              className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              Edit
                            </button>
                            {isHR && (
                              <button
                                type="button"
                                onClick={() => handleDelete(proj)}
                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-bold text-slate-900">Add New Project</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Vision Engine"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. AIV"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400 uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
                  >
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <DivisionSelect
                value={formData.division}
                options={divisionOptions}
                onChange={(division) => setFormData({ ...formData, division })}
              />

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Client / Product</label>
                <input
                  type="text"
                  placeholder="e.g. Nemilink or Client Name"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of project scope..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              {modalError && (
                <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">{modalError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
                >
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-bold text-slate-900">Edit Project: {editingProject.name}</h2>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Project Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400 uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
                  >
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <DivisionSelect
                value={formData.division}
                options={divisionOptions}
                onChange={(division) => setFormData({ ...formData, division })}
              />

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Client / Product</label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              {modalError && (
                <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">{modalError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
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
          </div>
        </div>
      )}
    </AppShell>
  );
}

