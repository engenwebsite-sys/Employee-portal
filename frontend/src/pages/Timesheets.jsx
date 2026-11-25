import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api, downloadFile } from "../lib/api";
import { portalDate } from "../lib/portalDate";

const STATUS_OPTIONS = ["In Progress", "Completed", "Blocked", "N/A"];
const DAY_TYPE_OPTIONS = ["Working Day", "Week Off", "Holiday", "Leave", "Half Day"];
const EMPTY_TASK = { project: "", task_description: "", status: "In Progress", duration_minutes: "" };
const STATUS_STYLE = {
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  "In Progress": "bg-amber-50 text-amber-700 border border-amber-200/60",
  Blocked: "bg-rose-50 text-[#ea384d] border border-rose-200/60",
  "N/A": "bg-slate-100 text-slate-500 border border-slate-200/60",
};

const DAY_TYPE_STYLE = {
  "Working Day": "bg-slate-100 text-slate-700",
  "Week Off": "bg-slate-50 text-slate-400",
  Holiday: "bg-blue-50 text-blue-700",
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

function computeHours(login, logout) {
  if (!login || !logout) return 0;
  const [h1, m1] = login.split(":").map(Number);
  const [h2, m2] = logout.split(":").map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? (diff / 60) : 0;
}

function csvEscape(val) {
  const s = String(val ?? "");
  const text = typeof val === "string" && /^(?:\s*[=+@\-]|[\t\r\n])/.test(s) ? `'${s}` : s;
  return `"${text.replace(/"/g, '""')}"`;
}

function TaskToggle({ tasks, expanded, onToggle }) {
  if (!tasks.length) return <span className="text-slate-400">No tasks</span>;

  const minutes = tasks.reduce((total, task) => total + (task.duration_minutes ?? 0), 0);
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-md py-1 text-left font-semibold text-slate-800 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`size-3.5 shrink-0 ${expanded ? "rotate-90" : ""}`}>
        <path d="m6 4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}{minutes > 0 && ` · ${taskTimeLabel(minutes)}`}</span>
    </button>
  );
}

function TaskCards({ tasks }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {tasks.map((task, index) => (
        <li key={index} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 text-slate-600">
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="break-words font-semibold text-slate-800">{task.project || "General"}</div>
            <span
              className={`max-w-32 break-words rounded-md px-2 py-0.5 text-right text-[10px] font-semibold ${
                STATUS_STYLE[task.status] || STATUS_STYLE["N/A"]
              }`}
            >
              {task.status}
            </span>
          </div>
          <div className="whitespace-pre-wrap break-words leading-relaxed">{task.task_description || "—"}</div>
          {task.duration_minutes > 0 && (
            <div className="mt-2 text-[11px] text-slate-500">{taskTimeLabel(task.duration_minutes)}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function taskTimeLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours && `${hours} hr`, remainder && `${remainder} min`].filter(Boolean).join(" ");
}

function TimesheetActions({ date, onEdit, onDelete }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Edit timesheet for ${date}`}
        title="Edit timesheet"
        onClick={onEdit}
        className="inline-flex size-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 sm:size-8"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M16 4l4 4M4 20l4.5-1 12-12a2.8 2.8 0 0 0-4-4l-12 12L4 20Z" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`Delete timesheet for ${date}`}
        title="Delete timesheet"
        onClick={onDelete}
        className="inline-flex size-11 items-center justify-center rounded-md hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:size-8"
      >
        <img src={`${import.meta.env.BASE_URL}timesheet-delete.png`} alt="" className="size-4" />
      </button>
    </div>
  );
}

export default function Timesheets() {
  const { user } = useAuth();
  const canViewTeam = user?.role === "manager" || user?.role === "hr";

  const today = portalDate();
  const currentMonth = today.slice(0, 7);

  const [tab, setTab] = useState("my");
  const [expandedEntries, setExpandedEntries] = useState(() => new Set());
  const [month, setMonth] = useState(currentMonth);
  const [myEntries, setMyEntries] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [teamFilterEmp, setTeamFilterEmp] = useState("");
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState("");
  const [showInlineProject, setShowInlineProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [projectAddError, setProjectAddError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const recordsRequest = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState({
    work_date: today,
    login_time: "09:15",
    logout_time: "17:30",
    entry_id: null,
    tasks: [{ ...EMPTY_TASK }],
    remarks: "",
    day_type: "Working Day",
  });

  const loadData = useCallback(async ({ showLoading = true } = {}) => {
    recordsRequest.current?.abort();
    const controller = new AbortController();
    recordsRequest.current = controller;
    const { signal } = controller;
    setLoading(showLoading);
    setError("");
    try {
      const reqs = [api(`/timesheets/my?month=${month}`, { signal })];
      if (canViewTeam) {
        const qs = new URLSearchParams({ month });
        if (teamFilterEmp) qs.set("employee_id", teamFilterEmp);
        reqs.push(api(`/timesheets/team?${qs.toString()}`, { signal }));
      }
      const [myData, teamData] = await Promise.all(reqs);
      if (signal.aborted) return;
      setMyEntries(myData);
      if (canViewTeam && teamData) setTeamEntries(teamData);
    } catch (err) {
      if (!signal.aborted) setError(err.message || "Failed to load timesheets.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [month, canViewTeam, teamFilterEmp]);

  useEffect(() => {
    loadData();
    return () => recordsRequest.current?.abort();
  }, [loadData]);

  useEffect(() => {
    if (!showModal) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function loadProjects() {
      setLoadingProjects(true);
      setProjectLoadError("");
      setProjects([]);
      try {
        const data = await api("/projects?status=Active", { signal, cache: "no-store" });
        if (!signal.aborted) setProjects(data);
      } catch {
        if (!signal.aborted) setProjectLoadError("Could not load projects. Reopen the form to retry.");
      } finally {
        if (!signal.aborted) setLoadingProjects(false);
      }
    }

    loadProjects();
    return () => controller.abort();
  }, [showModal, user?.email]);

  async function handleQuickAddProject(e) {
    if (e) e.preventDefault();
    const clean = newProjectName.trim();
    if (!clean) return;
    setAddingProject(true);
    setProjectAddError("");
    try {
      const created = await api("/projects", {
        method: "POST",
        body: { name: clean, status: "Active" },
      });
      setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => {
        const firstEmpty = prev.tasks.findIndex((task) => !task.project);
        const tasks = firstEmpty >= 0
          ? prev.tasks.map((task, index) => index === firstEmpty ? { ...task, project: created.name } : task)
          : prev.tasks.length < 25 ? [...prev.tasks, { ...EMPTY_TASK, project: created.name }] : prev.tasks;
        return { ...prev, tasks };
      });
      setNewProjectName("");
      setShowInlineProject(false);
    } catch (err) {
      setProjectAddError(err.message || "Failed to add project.");
    } finally {
      setAddingProject(false);
    }
  }

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
    const existing = myEntries.find((entry) => entry.work_date === today);
    if (existing) {
      openEdit(existing);
      return;
    }
    setForm({
      work_date: today,
      login_time: "09:15",
      logout_time: "17:30",
      entry_id: null,
      tasks: [{ ...EMPTY_TASK }],
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
      entry_id: entry.id,
      expected_updated_at: entry.updated_at,
      tasks: entry.tasks.length ? entry.tasks.map((task) => ({
        ...task, project: task.project ?? "", duration_minutes: task.duration_minutes ?? "",
      })) : [{ ...EMPTY_TASK }],
      remarks: entry.remarks || "",
      day_type: entry.day_type || "Working Day",
    });
    setModalError("");
    setShowModal(true);
  }

  function updateTask(index, changes) {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...changes } : task),
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      const saved = await api("/timesheets", {
        method: "POST",
        body: {
          work_date: form.work_date,
          login_time: form.login_time || null,
          logout_time: form.logout_time || null,
          entry_id: form.entry_id,
          expected_updated_at: form.expected_updated_at,
          tasks: form.tasks
            .filter((task) => task.project || task.task_description.trim() || task.duration_minutes || task.status !== "In Progress")
            .map((task) => ({
              ...task, project: task.project || null,
              duration_minutes: task.duration_minutes === "" ? null : Number(task.duration_minutes),
            })),
          remarks: form.remarks.trim() || null,
          day_type: form.day_type,
        },
      });
      const savedMonth = saved.work_date.slice(0, 7);
      recordsRequest.current?.abort();
      setMyEntries((entries) => [
        saved,
        ...entries.filter((entry) => entry.id !== saved.id && entry.work_date.startsWith(savedMonth)),
      ].sort((a, b) => b.work_date.localeCompare(a.work_date)));
      setTab("my");
      setShowModal(false);
      if (savedMonth === month) {
        void loadData({ showLoading: false });
      } else {
        setTeamEntries([]);
        setMonth(savedMonth);
      }
    } catch (err) {
      setModalError(err.message || "Failed to save entry.");
      if (err.status === 409) void loadData({ showLoading: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this timesheet entry?")) return;
    try {
      await api(`/timesheets/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete entry.");
    }
  }

  function handleExportCsv() {
    const rows = tab === "my" ? myEntries : teamEntries;
    if (rows.length === 0) return;

    const headers = [
      ...(tab === "team" ? ["Employee Code", "Employee Name"] : []),
      "Date",
      "Day",
      "Login Time",
      "Logout Time",
      "Project",
      "Task Description",
      "Status",
      "Task Time (minutes)",
      "Remarks",
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
          r.tasks.map((task) => task.project || "—").join("\n"),
          r.tasks.map((task) => task.task_description || "—").join("\n"),
          r.tasks.length ? r.tasks.map((task) => task.status).join("\n") : r.status,
          r.tasks.map((task) => task.duration_minutes ?? "—").join("\n"),
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

  const [exportingExcel, setExportingExcel] = useState(false);

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const qs = new URLSearchParams({ month });
      if (tab === "team" && teamFilterEmp) {
        qs.set("employee_id", teamFilterEmp);
      }
      await downloadFile(`/timesheets/export-excel?${qs.toString()}`, `Daily_Task_${month}.xlsx`);
    } catch (err) {
      alert(err.message || "Failed to download Excel timesheet.");
    } finally {
      setExportingExcel(false);
    }
  }

  function toggleEntryTasks(entryId) {
    setExpandedEntries((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  const activeRows = tab === "my" ? myEntries : teamEntries;

  // Monthly summary calculations
  const totalLoggedDays = activeRows.length;
  const totalHours = useMemo(() => {
    let sum = 0;
    for (const r of activeRows) {
      sum += computeHours(r.login_time, r.logout_time);
    }
    return sum.toFixed(1);
  }, [activeRows]);
  const tasks = activeRows.flatMap((row) => row.tasks);
  const completedTasks = tasks.filter((task) => task.status === "Completed").length;
  const activeTasks = tasks.filter((task) => task.status === "In Progress" || task.status === "Blocked").length;

  return (
    <AppShell
      title="Daily Timesheet"
      subtitle="Log daily hours, project milestones, and blockers"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMyEntries([]);
              setTeamEntries([]);
              setMonth(e.target.value);
              setLoading(true);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100/80 transition-colors disabled:opacity-50"
            title="Download official company template Excel (.xlsx)"
          >
            <svg className="h-3.5 w-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{exportingExcel ? "Exporting..." : "Export Excel (.xlsx)"}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={activeRows.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={openNew}
            className="btn-brand-gradient rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1"
          >
            + Log Daily Task
          </button>
        </div>
      }
    >
      {/* Monthly Summary Cards (Pastel Minimalist with Elevated Shadows) */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
        <div className="card-pastel-interactive bg-gradient-to-br from-white via-white to-blue-50/50 p-3 sm:p-3.5 border-blue-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Entries Logged
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
              📅
            </span>
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-[#1d2c55]">
            {totalLoggedDays} <span className="text-xs font-semibold text-slate-400">days</span>
          </div>
        </div>

        <div className="card-pastel-interactive bg-gradient-to-br from-white via-white to-indigo-50/50 p-3 sm:p-3.5 border-indigo-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Attendance Hours
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold">
              ⏱️
            </span>
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-[#1d2c55]">
            {totalHours} <span className="text-xs font-semibold text-slate-400">hrs</span>
          </div>
        </div>

        <div className="card-pastel-interactive bg-gradient-to-br from-white via-white to-emerald-50/50 p-3 sm:p-3.5 border-emerald-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Completed
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
              ✓
            </span>
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-600">
            {completedTasks}
          </div>
        </div>

        <div className="card-pastel-interactive bg-gradient-to-br from-white via-white to-rose-50/50 p-3 sm:p-3.5 border-rose-100/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              In Progress / Blocked
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-[#ff3366] text-xs font-bold">
              ⚡
            </span>
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-[#ff3366]">
            {activeTasks}
          </div>
        </div>
      </div>

      {canViewTeam && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setTab("my")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                tab === "my"
                  ? "btn-brand-gradient shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              My Timesheet ({myEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("team")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                tab === "team"
                  ? "btn-brand-gradient shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Team Timesheets ({teamEntries.length})
            </button>
          </div>

          {tab === "team" && (
            <select
              value={teamFilterEmp}
              onChange={(e) => setTeamFilterEmp(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
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
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Responsive Card/Table Wrapper */}
      <div className="card-pastel overflow-hidden">
        {loading && (tab === "team" || activeRows.length === 0) ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading timesheet records...</div>
        ) : activeRows.length === 0 ? (
          <div className="p-10 sm:p-14 text-center bg-gradient-to-b from-white to-slate-50/50">
            <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200/80 shadow-xs text-2xl animate-pulse-glow">
              📋
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">No timesheet records for {month}</h3>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Keep your daily hours, achievements, and blockers organized in one place.
            </p>
            <button
              type="button"
              onClick={openNew}
              className="mt-4 inline-flex items-center gap-1.5 btn-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all"
            >
              + Log Today&apos;s Task
            </button>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <tr>
                    {tab === "team" && <th className="px-3.5 py-2.5">Employee</th>}
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Date</th>
                    <th className="px-3.5 py-2.5">Day</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Hours</th>
                    <th className="min-w-32 px-3.5 py-2.5">Tasks</th>
                    <th className="px-3.5 py-2.5 min-w-[180px]">Remarks</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Type</th>
                    {tab === "my" && <th className="w-24 px-3.5 py-2.5 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeRows.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="align-middle hover:bg-slate-50/60 transition-colors">
                        {tab === "team" && (
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{row.employee_name}</div>
                            <div className="text-[10px] text-slate-400">{row.employee_code}</div>
                          </td>
                        )}
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                          {row.work_date}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-400">{formatDayName(row.work_date)}</td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 text-[11px]">
                          {formatTime12(row.login_time)} - {formatTime12(row.logout_time)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <TaskToggle
                            tasks={row.tasks}
                            expanded={expandedEntries.has(row.id)}
                            onToggle={() => toggleEntryTasks(row.id)}
                          />
                        </td>
                        <td className="px-3.5 py-2.5 leading-relaxed whitespace-pre-line text-slate-500 text-[11px]">
                          {row.remarks || "—"}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${
                              DAY_TYPE_STYLE[row.day_type] || "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.day_type}
                          </span>
                        </td>
                        {tab === "my" && (
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <TimesheetActions
                              date={row.work_date}
                              onEdit={() => openEdit(row)}
                              onDelete={() => handleDelete(row.id)}
                            />
                          </td>
                        )}
                      </tr>
                      {row.tasks.length > 0 && expandedEntries.has(row.id) && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="px-3.5 py-3">
                            <TaskCards tasks={row.tasks} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Clean & Compact on phones) */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {activeRows.map((row) => (
                <article key={row.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs">
                      {row.work_date}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-500">
                      {formatDayName(row.work_date)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    {tab === "team" && <span className="font-semibold text-slate-800">{row.employee_name}</span>}
                    <span className="shrink-0 text-slate-400 font-medium">
                      {formatTime12(row.login_time)} - {formatTime12(row.logout_time)}
                    </span>
                  </div>

                  <TaskToggle
                    tasks={row.tasks}
                    expanded={expandedEntries.has(row.id)}
                    onToggle={() => toggleEntryTasks(row.id)}
                  />
                  {row.tasks.length > 0 && expandedEntries.has(row.id) && <TaskCards tasks={row.tasks} />}

                  {row.remarks && (
                    <div className="rounded-lg bg-rose-50/50 border border-rose-100/80 p-2 text-[11px] text-[#ea384d]">
                      <span className="font-semibold">Blockers:</span> {row.remarks}
                    </div>
                  )}

                  {tab === "my" && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {row.day_type}
                      </span>
                      <TimesheetActions
                        date={row.work_date}
                        onEdit={() => openEdit(row)}
                        onDelete={() => handleDelete(row.id)}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal - Bottom Sheet on Mobile / Centered on Desktop */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl">
            {/* Mobile drag handle */}
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-bold text-slate-900">{form.entry_id ? "Edit Daily Timesheet" : "Log Daily Timesheet"}</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Date *</label>
                <input
                  type="date"
                  required
                  value={form.work_date}
                  readOnly={form.entry_id !== null}
                  onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Day Type</label>
                <select
                  value={form.day_type}
                  onChange={(e) => setForm({ ...form, day_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
                >
                  {DAY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Login Time</label>
                <input
                  type="time"
                  value={form.login_time}
                  onChange={(e) => setForm({ ...form, login_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Logout Time</label>
                <input
                  type="time"
                  value={form.logout_time}
                  onChange={(e) => setForm({ ...form, logout_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Tasks</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineProject(!showInlineProject);
                      setProjectAddError("");
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    {showInlineProject ? "✕ Cancel" : "+ Add Project"}
                  </button>
                </div>

                {showInlineProject && (
                  <div className="mb-2 rounded-lg border border-rose-100 bg-rose-50/60 p-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="New project name..."
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        disabled={loadingProjects || addingProject || !newProjectName.trim()}
                        onClick={handleQuickAddProject}
                        className="btn-brand-gradient rounded-md px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        {addingProject ? "..." : "Add"}
                      </button>
                    </div>
                    {projectAddError && (
                      <p className="mt-1 text-[10px] font-medium text-rose-700">{projectAddError}</p>
                    )}
                  </div>
                )}

                {projectLoadError && (
                  <p role="alert" className="mt-1 text-[10px] font-medium text-rose-700">{projectLoadError}</p>
                )}
              </div>

              {form.tasks.map((task, index) => (
                <fieldset key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:col-span-2 sm:grid-cols-3">
                  <legend className="px-1 font-semibold text-slate-700">Task {index + 1}</legend>
                  <label className="space-y-1 font-semibold">
                    Project
                    <select
                      className="block w-full rounded-lg border border-slate-200 bg-white p-1.5 font-normal"
                      value={task.project}
                      onChange={(e) => updateTask(index, { project: e.target.value })}
                    >
                      <option value="">{loadingProjects ? "Loading projects…" : "Select a project"}</option>
                      {task.project && !projects.some((project) => project.name === task.project) && (
                        <option value={task.project}>{task.project}</option>
                      )}
                      {projects.map((project) => (
                        <option key={project.id} value={project.name}>{project.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 font-semibold">
                    Status
                    <select
                      className="block w-full rounded-lg border border-slate-200 bg-white p-1.5 font-normal"
                      value={task.status}
                      onChange={(e) => updateTask(index, { status: e.target.value })}
                    >
                      {!STATUS_OPTIONS.includes(task.status) && <option>{task.status}</option>}
                      {STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 font-semibold">
                    Time spent (min, optional)
                    <input
                      type="number" min="1" max="1440" step="1"
                      className="block w-full rounded-lg border border-slate-200 p-1.5 font-normal"
                      value={task.duration_minutes}
                      onChange={(e) => updateTask(index, { duration_minutes: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 font-semibold sm:col-span-3">
                    Task Description
                    <textarea
                      rows={2} maxLength={5000}
                      className="block w-full rounded-lg border border-slate-200 p-1.5 font-normal"
                      value={task.task_description}
                      onChange={(e) => updateTask(index, { task_description: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="justify-self-start font-semibold text-rose-600"
                    onClick={() => setForm((prev) => ({
                      ...prev, tasks: prev.tasks.filter((_, taskIndex) => taskIndex !== index),
                    }))}
                  >
                    Remove task
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="justify-self-start font-semibold text-rose-600 disabled:opacity-50 sm:col-span-2"
                disabled={form.tasks.length >= 25}
                onClick={() => setForm((prev) => ({ ...prev, tasks: [...prev.tasks, { ...EMPTY_TASK }] }))}
              >
                + Add Task
              </button>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-semibold text-slate-700">Remarks / Blockers</label>
                <textarea
                  rows={2}
                  placeholder="Blockers or awaiting review notes..."
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              {modalError && (
                <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 sm:col-span-2">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-brand-gradient rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
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
