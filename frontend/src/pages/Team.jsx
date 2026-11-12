import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { api } from "../lib/api";

export default function Team() {
  const [team, setTeam] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api("/manager/team")
      .then((data) => {
        if (active) {
          setTeam(data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load team.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return team;
    return team.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q) ||
        (e.department?.name || "").toLowerCase().includes(q)
    );
  }, [team, search]);

  return (
    <AppShell
      title="My Team"
      subtitle="Direct reportees and team directory"
      actions={
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team member..."
          className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
        />
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-400">
          Loading team members...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-8 text-center">
          <p className="text-sm font-bold text-slate-800">No team members found</p>
          <p className="mt-1 text-xs text-slate-400">
            {team.length === 0
              ? "You currently have no direct reportees assigned."
              : "Try clearing your search query."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp) => (
            <article
              key={emp.id}
              className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    {emp.employee_code}
                  </span>
                  <h2 className="text-xs font-bold text-slate-900">{emp.name}</h2>
                  <p className="text-[11px] text-slate-500">{emp.designation || "Member"}</p>
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

              <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Email</dt>
                  <dd className="truncate font-medium text-slate-700">{emp.email}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Department</dt>
                  <dd className="font-medium text-slate-700">{emp.department?.name || "General"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Phone</dt>
                  <dd className="font-medium text-slate-700">{emp.phone || "—"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
