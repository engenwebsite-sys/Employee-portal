import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function StatCard({ label, value, hint, to }) {
  const content = (
    <div className="rounded-3xl bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-nemilink-navy">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block no-underline">
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
        /* non-blocking summary */
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user?.role]);

  return (
    <AppShell
      title={`Welcome, ${displayName}`}
      subtitle={
        emp
          ? `${emp.designation || "Workspace Member"} · ${emp.department?.name || "No department"} · ${emp.employee_code}`
          : "Your Nemilink workspace overview."
      }
      actions={
        user?.role === "hr" ? (
          <Link
            to="/employees"
            className="rounded-xl bg-nemilink-coral px-4 py-2.5 text-sm font-bold text-white no-underline transition hover:opacity-95"
          >
            Manage Employees
          </Link>
        ) : (
          <Link
            to="/profile"
            className="rounded-xl bg-nemilink-coral px-4 py-2.5 text-sm font-bold text-white no-underline transition hover:opacity-95"
          >
            View My Profile
          </Link>
        )
      }
    >
      {/* Role-specific summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {user?.role === "hr" && (
          <>
            <StatCard
              label="Total Employees"
              value={stats.totalEmployees ?? "—"}
              hint="Click to open directory"
              to="/employees"
            />
            <StatCard
              label="Active Accounts"
              value={stats.activeEmployees ?? "—"}
              hint="Enabled for sign-in"
              to="/employees"
            />
            <StatCard
              label="Departments"
              value={stats.departments ?? "—"}
              hint="Manage departments"
              to="/departments"
            />
            <StatCard
              label="Direct Reportees"
              value={stats.teamCount ?? "—"}
              hint="View my team"
              to="/team"
            />
          </>
        )}

        {user?.role === "manager" && (
          <>
            <StatCard
              label="Direct Reportees"
              value={stats.teamCount ?? "—"}
              hint="View your team members"
              to="/team"
            />
            <StatCard
              label="Employee Code"
              value={emp?.employee_code || "—"}
              hint={emp?.department?.name || "Department"}
              to="/profile"
            />
            <StatCard
              label="Joining Date"
              value={emp?.joining_date || "—"}
              hint="Profile details"
              to="/profile"
            />
            <StatCard
              label="Probation Ends"
              value={emp?.probation_end_date || "—"}
              hint="Review schedule"
              to="/profile"
            />
          </>
        )}

        {user?.role === "employee" && (
          <>
            <StatCard
              label="Employee Code"
              value={emp?.employee_code || "—"}
              hint={emp?.designation || "Designation"}
              to="/profile"
            />
            <StatCard
              label="Department"
              value={emp?.department?.name || "—"}
              hint={emp?.manager ? `Manager: ${emp.manager.name}` : "No manager assigned"}
              to="/profile"
            />
            <StatCard
              label="Joining Date"
              value={emp?.joining_date || "—"}
              hint="Workspace start date"
              to="/profile"
            />
            <StatCard
              label="Probation Ends"
              value={emp?.probation_end_date || "—"}
              hint="Update contact info"
              to="/profile"
            />
          </>
        )}
      </div>

      {/* Quick Actions & Upcoming Modules */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <span className="section-label">QUICK ACTIONS</span>
          <h2 className="mt-2 text-lg font-bold text-nemilink-navy">Workspace essentials</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              to="/profile"
              className="rounded-2xl border border-[#eceaf9] bg-[#faf9ff] p-4 no-underline transition hover:border-nemilink-navy"
            >
              <div className="font-bold text-nemilink-navy">My Profile</div>
              <div className="mt-1 text-xs text-gray-500">
                View your details & update phone / emergency contact.
              </div>
            </Link>
            <Link
              to="/change-password"
              className="rounded-2xl border border-[#eceaf9] bg-[#faf9ff] p-4 no-underline transition hover:border-nemilink-navy"
            >
              <div className="font-bold text-nemilink-navy">Security</div>
              <div className="mt-1 text-xs text-gray-500">
                Change your workspace password anytime.
              </div>
            </Link>
            {(user?.role === "manager" || user?.role === "hr") && (
              <Link
                to="/team"
                className="rounded-2xl border border-[#eceaf9] bg-[#faf9ff] p-4 no-underline transition hover:border-nemilink-navy"
              >
                <div className="font-bold text-nemilink-navy">My Team</div>
                <div className="mt-1 text-xs text-gray-500">
                  Check your direct reportees and contact details.
                </div>
              </Link>
            )}
            {user?.role === "hr" && (
              <Link
                to="/employees"
                className="rounded-2xl border border-[#eceaf9] bg-[#faf9ff] p-4 no-underline transition hover:border-nemilink-navy"
              >
                <div className="font-bold text-nemilink-navy">Employees & Departments</div>
                <div className="mt-1 text-xs text-gray-500">
                  Onboard new employees, update roles, and manage teams.
                </div>
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <span className="section-label">NEXT MODULES</span>
          <h2 className="mt-2 text-lg font-bold text-nemilink-navy">Coming up in Nemilink</h2>
          <p className="mt-1 text-sm text-gray-500">
            Attendance tracking and leave management will appear here once their backend endpoints are added.
          </p>
          <div className="mt-4 space-y-3">
            <Link
              to="/timesheets"
              className="flex items-center justify-between rounded-2xl border border-[#eceaf9] bg-[#faf9ff] px-4 py-3 no-underline transition hover:border-nemilink-navy"
            >
              <div>
                <div className="text-sm font-bold text-nemilink-navy">Attendance &amp; Timesheets</div>
                <div className="text-xs text-gray-500">Daily check-in/out and work logs</div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                Active
              </span>
            </Link>
            <Link
              to="/leaves"
              className="flex items-center justify-between rounded-2xl border border-[#eceaf9] bg-[#faf9ff] px-4 py-3 no-underline transition hover:border-nemilink-navy"
            >
              <div>
                <div className="text-sm font-bold text-nemilink-navy">Leave Management</div>
                <div className="text-xs text-gray-500">Leave balances, requests & approvals</div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                Active
              </span>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
