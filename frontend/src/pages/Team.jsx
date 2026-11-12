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
      subtitle="Direct reportees assigned to you in the organization."
      actions={
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team member..."
          className="w-64 rounded-xl border border-[#dcd9f8] bg-white px-3.5 py-2 text-sm outline-none focus:border-nemilink-navy"
        />
      }
    >
      {error && (
        <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Loading team members...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="text-base font-bold text-nemilink-navy">No team members found</p>
          <p className="mt-1 text-sm text-gray-500">
            {team.length === 0
              ? "You currently have no direct reportees assigned."
              : "Try clearing your search filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp) => (
            <article key={emp.id} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold tracking-wider text-nemilink-coral uppercase">
                    {emp.employee_code}
                  </span>
                  <h2 className="mt-0.5 text-lg font-bold text-nemilink-navy">{emp.name}</h2>
                  <p className="text-xs text-gray-500">{emp.designation || "Team Member"}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    emp.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {emp.is_active ? "Active" : "Disabled"}
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Email</dt>
                  <dd className="truncate font-medium text-nemilink-navy">{emp.email}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Department</dt>
                  <dd className="font-medium text-nemilink-navy">{emp.department?.name || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Phone</dt>
                  <dd className="font-medium text-nemilink-navy">{emp.phone || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Joining Date</dt>
                  <dd className="font-medium text-nemilink-navy">{emp.joining_date}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

