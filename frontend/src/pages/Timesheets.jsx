import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const STATUS_OPTIONS = ["In Progress", "Completed", "Blocked", "N/A"];
const DAY_TYPE_OPTIONS = ["Working Day", "Week Off", "Holiday", "Leave", "Half Day"];
const PROJECT_SUGGESTIONS = [
  "Maarga AI",
  "Maarga AI & Elder Care",
  "MaargaAI/CRM-Tool",
  "Nemilink Portal",
  "Internal Tool",
];

const STATUS_STYLE = {
  Completed: "bg-emerald-50 text-emerald-700",
  "In Progress": "bg-amber-50 text-amber-700",
  Blocked: "bg-rose-50 text-rose-700",
  "N/A": "bg-gray-100 text-gray-500",
};

const DAY_TYPE_STYLE = {
  "Working Day": "bg-nemilink-lavender text-nemilink-navy",
  "Week Off": "bg-gray-100 text-gray-600",
  Holiday: "bg-sky-50 text-sky-700",
  Leave: "bg-rose-50 text-rose-700",
  "Half Day": "bg-amber-50 text-amber-700",
};

function formatDayName(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatTime12(hhmm) {
  if (!hhmm) return "—";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${mStr || "00"} ${suffix}`;
}

function csvEscape(val) {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export default function Timesheets() {
  const { user } = useAuth();
  const canViewTeam = user?.role === "manager" || user?.role === "hr";

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const [tab, setTab] = useState("my");
  const [month, setMonth] = useState(currentMonth);
  const [myEntries, setMyEntries] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [teamFilterEmp, setTeamFilterEmp] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState({
    work_date: today,
    login_time: "09:15",
    logout_time: "17:30",
    project: "",
    task_description: "",
    status: "In Progress",
    remarks: "",
    day_type: "Working Day",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [api(`/timesheets/my?month=${month}`)];
      if (canViewTeam) {
        const qs = new URLSearchParams({ month });
        if (teamFilterEmp) qs.set("employee_id", teamFilterEmp);
        reqs.push(api(`/timesheets/team?${qs.toString()}`));
      }
      const [myData, teamData] = await Promise.all(reqs);
      setMyEntries(myData);
      if (canViewTeam && teamData) setTeamEntries(teamData);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load timesheets.");
    } finally {
      setLoading(false);
    }
  }, [month, canViewTeam, teamFilterEmp]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const teamEmployees = useMemo(() => {
    const map = new Map();
    for (const e of teamEntries) {
      if (!map.has(e.employee_id)) {
        map.set(e.employee_id, `${e.employee_name} (${e.employee_code})`);
      }
    }
    return Array.from(map.entries());
  }, [teamEntries]);

  function openNew() {
    setForm({
      work_date: today,
      login_time: "09:15",
      logout_time: "17:30",
      project: "",
      task_description: "",
      status: "In Progress",
      remarks: "",
      day_type: "Working Day",
    });
    setModalError("");
    setShowModal(true);
  }

  function openEdit(entry) {
    setForm({
      work_date: entry.work_date,
      login_time: entry.login_time || "",
      logout_time: entry.logout_time || "",
      project: entry.project || "",
      task_description: entry.task_description || "",
      status: entry.status || "In Progress",
      remarks: entry.remarks || "",
      day_type: entry.day_type || "Working Day",
    });
    setModalError("");
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      await api("/timesheets", {
        method: "POST",
        body: {
          work_date: form.work_date,
          login_time: form.login_time || null,
          logout_time: form.logout_time || null,
          project: form.project.trim() || null,
          task_description: form.task_description,
          status: form.status,
          remarks: form.remarks.trim() || null,
          day_type: form.day_type,
        },
      });
      setShowModal(false);
      await loadData();
    } catch (err) {
      setModalError(err.message || "Could not save timesheet entry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api(`/timesheets/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete entry.");
    }
  }

  function handleExportCsv() {
    const rows = tab === "my" ? myEntries : teamEntries;
    const headers = [
      ...(tab === "team" ? ["Employee Code", "Employee Name"] : []),
      "Date",
      "Day",
      "Login",
      "Logout",
      "Project",
      "Task Description",
      "Status",
      "Remarks / Blockers",
      "Day Type",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    for (const r of rows) {
      lines.push(
        [
          ...(tab === "team" ? [r.employee_code, r.employee_name] : []),
          r.work_date,
          formatDayName(r.work_date),
          formatTime12(r.login_time),
          formatTime12(r.logout_time),
          r.project || "",
          r.task_description || "",
          r.status,
          r.remarks || "",
          r.day_type,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${tab}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeRows = tab === "my" ? myEntries : teamEntries;

  return (
    <AppShell
      title="Daily Timesheet"
      subtitle="Log daily login/logout times, project tasks, status, and blockers."
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-[#dcd9f8] bg-white px-3 py-2 text-sm font-semibold text-nemilink-navy outline-none focus:border-nemilink-navy"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={activeRows.length === 0}
            className="rounded-xl border border-[#dcd9f8] bg-white px-3.5 py-2 text-sm font-bold text-nemilink-navy transition hover:border-nemilink-navy disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-nemilink-coral px-4 py-2 text-sm font-bold text-white transition hover:opacity-95"
          >
            + Log Daily Task
          </button>
        </div>
      }
    >
      {canViewTeam && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setTab("my")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab === "my"
                  ? "bg-nemilink-lavender text-nemilink-navy"
                  : "text-gray-500 hover:text-nemilink-navy"
              }`}
            >
              My Timesheet ({myEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("team")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab === "team"
                  ? "bg-nemilink-lavender text-nemilink-navy"
                  : "text-gray-500 hover:text-nemilink-navy"
              }`}
            >
              Team Timesheets ({teamEntries.length})
            </button>
          </div>

          {tab === "team" && (
            <select
              value={teamFilterEmp}
              onChange={(e) => setTeamFilterEmp(e.target.value)}
              className="rounded-xl border border-[#dcd9f8] bg-white px-3.5 py-2 text-sm font-semibold text-nemilink-navy outline-none"
            >
              <option value="">All team members</option>
              {teamEmployees.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading timesheet entries...</div>
        ) : activeRows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-nemilink-navy">No entries for {month}</p>
            <p className="mt-1 text-sm text-gray-500">
              Click &quot;+ Log Daily Task&quot; to record your daily work.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-[#faf9ff] text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                <tr>
                  {tab === "team" && <th className="px-4 py-3.5">Employee</th>}
                  <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3.5">Day</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Login</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Logout</th>
                  <th className="px-4 py-3.5">Project</th>
                  <th className="px-4 py-3.5 min-w-[260px]">Task Description</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 min-w-[200px]">Remarks / Blockers</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Day Type</th>
                  {tab === "my" && <th className="px-4 py-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 align-top">
                {activeRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#fcfbff]">
                    {tab === "team" && (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-nemilink-navy">{row.employee_name}</div>
                        <div className="text-xs text-gray-400">{row.employee_code}</div>
                      </td>
                    )}
                    <td className="px-4 py-3.5 font-semibold whitespace-nowrap text-nemilink-navy">
                      {row.work_date}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{formatDayName(row.work_date)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {formatTime12(row.login_time)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {formatTime12(row.logout_time)}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-nemilink-navy">
                      {row.project || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-xs leading-relaxed whitespace-pre-line text-gray-700">
                      {row.task_description || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_STYLE[row.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs leading-relaxed whitespace-pre-line text-gray-600">
                      {row.remarks || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          DAY_TYPE_STYLE[row.day_type] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.day_type}
                      </span>
                    </td>
                    {tab === "my" && (
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-xl border border-gray-200 px-2.5 py-1 text-xs font-semibold text-nemilink-navy hover:border-nemilink-navy"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="rounded-xl border border-gray-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xl font-extrabold text-nemilink-navy">Log Daily Timesheet</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl px-2.5 py-1 text-sm font-bold text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Date *</label>
                <input
                  type="date"
                  required
                  value={form.work_date}
                  onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Day Type</label>
                <select
                  value={form.day_type}
                  onChange={(e) => setForm({ ...form, day_type: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                >
                  {DAY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Login Time</label>
                <input
                  type="time"
                  value={form.login_time}
                  onChange={(e) => setForm({ ...form, login_time: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Logout Time</label>
                <input
                  type="time"
                  value={form.logout_time}
                  onChange={(e) => setForm({ ...form, logout_time: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Project</label>
                <input
                  type="text"
                  list="project-suggestions"
                  placeholder="e.g. Maarga AI"
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                />
                <datalist id="project-suggestions">
                  {PROJECT_SUGGESTIONS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                  Task Description
                </label>
                <textarea
                  rows={4}
                  placeholder="- Worked on..."
                  value={form.task_description}
                  onChange={(e) => setForm({ ...form, task_description: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-nemilink-navy"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                  Remarks / Blockers
                </label>
                <textarea
                  rows={2}
                  placeholder="Any blockers or notes..."
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
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
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-nemilink-coral px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

