import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function StatCard({ label, value, hint, to, badgeColor = "bg-slate-100 text-slate-700" }) {
  const content = (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs transition hover:border-slate-300">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        {hint && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold ${badgeColor}`}>
            {hint}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-lg sm:text-2xl font-extrabold tracking-tight text-[#16192e] truncate">
        {value}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="no-underline">
      {content}
    </Link>
  ) : (
    content
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const emp = user?.employee;
  const displayName = emp?.name || user?.name || user?.email;

  const [stats, setStats] = useState({
    totalEmployees: null,
    activeEmployees: null,
    departments: null,
    teamCount: null,
  });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (user?.role === "hr") {
          const [emps, depts, team] = await Promise.all([
            api("/employees"),
            api("/departments"),
            api("/manager/team"),
          ]);
          if (!active) return;
          setStats({
            totalEmployees: emps.length,
            activeEmployees: emps.filter((e) => e.is_active).length,
            departments: depts.length,
            teamCount: team.length,
          });
        } else if (user?.role === "manager") {
          const team = await api("/manager/team");
          if (!active) return;
          setStats((prev) => ({ ...prev, teamCount: team.length }));
        }
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user?.role]);

  return (
    <AppShell
      title={`Hello, ${displayName.split(" ")[0]}`}
      subtitle={
        emp
          ? `${emp.designation || "Member"} · ${emp.department?.name || "General"} · ${emp.employee_code}`
          : "Workspace overview"
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/timesheets"
            className="rounded-lg bg-[#16192e] px-3 py-1.5 text-xs font-semibold text-white no-underline transition hover:bg-slate-900 shadow-2xs"
          >
            + Log Timesheet
          </Link>
          <Link
            to="/leaves"
            className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 no-underline transition hover:bg-slate-50"
          >
            Apply Leave
          </Link>
        </div>
      }
    >
      {/* Stat Grid - Compact and Responsive */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {user?.role === "hr" && (
          <>
            <StatCard
              label="Employees"
              value={stats.totalEmployees ?? "—"}
              hint="Directory"
              to="/employees"
              badgeColor="bg-slate-100 text-slate-700"
            />
            <StatCard
              label="Active"
              value={stats.activeEmployees ?? "—"}
              hint="Enabled"
              to="/employees"
              badgeColor="bg-emerald-50 text-emerald-700 border border-emerald-200/60"
            />
            <StatCard
              label="Departments"
              value={stats.departments ?? "—"}
              hint="Manage"
              to="/departments"
              badgeColor="bg-rose-50 text-[#ea384d] border border-rose-200/60"
            />
            <StatCard
              label="My Team"
              value={stats.teamCount ?? "—"}
              hint="Direct"
              to="/team"
              badgeColor="bg-amber-50 text-amber-700 border border-amber-200/60"
            />
          </>
        )}

        {user?.role === "manager" && (
          <>
            <StatCard
              label="Direct Reportees"
              value={stats.teamCount ?? "—"}
              hint="Team"
              to="/team"
              badgeColor="bg-rose-50 text-[#ea384d] border border-rose-200/60"
            />
            <StatCard
              label="Employee Code"
              value={emp?.employee_code || "—"}
              hint="My Code"
              to="/profile"
            />
            <StatCard
              label="Department"
              value={emp?.department?.name || "—"}
              to="/profile"
            />
            <StatCard
              label="Probation End"
              value={emp?.probation_end_date || "—"}
              to="/profile"
            />
          </>
        )}

        {user?.role === "employee" && (
          <>
            <StatCard
              label="Employee Code"
              value={emp?.employee_code || "—"}
              hint={emp?.department?.name || "General"}
              to="/profile"
              badgeColor="bg-rose-50 text-[#ea384d] border border-rose-200/60"
            />
            <StatCard
              label="Reporting Manager"
              value={emp?.manager ? emp.manager.name : "None"}
              to="/profile"
            />
            <StatCard
              label="Joined"
              value={emp?.joining_date || "—"}
              to="/profile"
            />
            <StatCard
              label="Probation End"
              value={emp?.probation_end_date || "—"}
              to="/profile"
            />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="mt-3.5 grid gap-3 lg:grid-cols-3">
        {/* Quick Links Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-900">Workspace Essentials</span>
            <span className="text-[10px] text-slate-400 font-medium">Quick access</span>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <Link
              to="/timesheets"
              className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 no-underline transition hover:border-slate-200 hover:bg-slate-50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200/80 text-slate-700">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
                  <path strokeWidth="1.75" d="M12 7v5l3 2" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900">Daily Timesheet</div>
                <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                  Log your daily work, login/logout, and project blockers.
                </div>
              </div>
            </Link>

            <Link
              to="/leaves"
              className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 no-underline transition hover:border-slate-200 hover:bg-slate-50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200/80 text-slate-700">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.75" />
                  <path strokeWidth="1.75" d="M16 3v4M8 3v4M3 10h18" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900">Leave Management</div>
                <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                  Check available balances and apply for time off.
                </div>
              </div>
            </Link>

            <Link
              to="/profile"
              className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 no-underline transition hover:border-slate-200 hover:bg-slate-50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200/80 text-slate-700">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="8" r="4" strokeWidth="1.75" />
                  <path strokeWidth="1.75" d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900">My Profile</div>
                <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                  Update phone number and emergency contacts.
                </div>
              </div>
            </Link>

            {(user?.role === "manager" || user?.role === "hr") && (
              <Link
                to="/team"
                className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3 no-underline transition hover:border-slate-200 hover:bg-slate-50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200/80 text-slate-700">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="9" cy="8" r="3.5" strokeWidth="1.75" />
                    <path strokeWidth="1.75" d="M2.5 19.5c1.3-3 3.8-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900">Team Management</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                    Review team members and direct reportees.
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Company Summary / Profile Sidebar */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs">
          <div>
            <div className="text-xs font-bold text-slate-900">Account Summary</div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Email</span>
                <span className="font-semibold text-slate-700 truncate max-w-[170px]">{user?.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Role</span>
                <span className="font-semibold text-slate-700 capitalize">{user?.role}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-400">Sign-in</span>
                <span className="font-semibold text-slate-700">Microsoft SSO</span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 rounded-lg bg-rose-50/50 border border-rose-100/70 p-2.5 text-[11px] text-slate-600 leading-relaxed">
            Need profile updates or role changes? Contact HR Admin at <span className="font-semibold text-[#ea384d]">raja@nemilink.com</span>.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
