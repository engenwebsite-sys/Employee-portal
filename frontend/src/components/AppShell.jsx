import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Brand from "./Brand";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { employee: "Employee", manager: "Manager", hr: "HR Admin" };

function Icon({ name, className = "h-4 w-4 shrink-0" }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "profile":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5" />
        </svg>
      );
    case "timesheets":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "leaves":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "team":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 19.5c1.3-3 3.8-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M17.5 15c2 .4 3.5 1.7 4 4" />
        </svg>
      );
    case "employees":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      );
    case "departments":
      return (
        <svg {...props}>
          <path d="M12 3 3 8l9 5 9-5-9-5Z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 18l9 5 9-5" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    default:
      return null;
  }
}

function navItemsFor(role) {
  const items = [
    { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/timesheets", label: "Timesheets", icon: "timesheets" },
    { to: "/leaves", label: "Leaves", icon: "leaves" },
    { to: "/profile", label: "Profile", icon: "profile" },
  ];
  if (role === "manager" || role === "hr") {
    items.push({ to: "/team", label: "Team", icon: "team" });
  }
  if (role === "hr") {
    items.push({ to: "/employees", label: "Employees", icon: "employees" });
    items.push({ to: "/departments", label: "Departments", icon: "departments" });
  }
  return items;
}

function initialsFor(nameOrEmail) {
  const text = (nameOrEmail || "U").trim();
  const parts = text.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

export default function AppShell({ title, subtitle, actions, children }) {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [switchingRole, setSwitchingRole] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem("nemilink_rail_expanded") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("nemilink_rail_expanded", expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  const navItems = navItemsFor(user?.role);
  const displayName = user?.employee?.name || user?.name || user?.email;
  const initials = initialsFor(displayName);

  return (
    <div className="flex min-h-dvh bg-[#f8f9fb] text-slate-800 antialiased">
      {/* Desktop Rail */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col justify-between border-r border-slate-200/80 bg-white py-3.5 transition-all duration-150 md:flex ${
          expanded ? "w-52 px-3" : "w-16 items-center px-2"
        }`}
      >
        <div className="flex w-full flex-col gap-4">
          {/* Brand header */}
          <div
            className={`flex items-center ${
              expanded ? "justify-between px-1" : "justify-center"
            }`}
          >
            <NavLink to="/dashboard" className="no-underline">
              <Brand compact={!expanded} />
            </NavLink>

            {expanded && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                title="Collapse sidebar"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />
              </button>
            )}
          </div>

          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="Expand sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="chevron" className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Navigation */}
          <nav className="flex w-full flex-col gap-1" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={!expanded ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg text-xs font-semibold no-underline transition ${
                    expanded ? "px-3 py-2" : "h-9 w-9 justify-center p-0"
                  } ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon name={item.icon} />
                {expanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom sign out */}
        <div className="flex w-full flex-col border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={logout}
            title={!expanded ? "Sign out" : undefined}
            className={`flex items-center gap-2.5 rounded-lg text-xs font-semibold text-rose-600 transition hover:bg-rose-50 ${
              expanded ? "px-3 py-2" : "h-9 w-9 justify-center p-0"
            }`}
          >
            <Icon name="logout" />
            {expanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xs">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <NavLink to="/dashboard" className="no-underline md:hidden">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                  N
                </span>
              </NavLink>
              {title && (
                <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                  {title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2">
              {user?.is_super_admin && (
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                  <span className="hidden text-[10px] font-semibold text-slate-400 sm:inline uppercase">
                    Role
                  </span>
                  <select
                    value={user.role}
                    disabled={switchingRole}
                    onChange={async (e) => {
                      const next = e.target.value;
                      setSwitchingRole(true);
                      try {
                        await switchRole(next);
                        navigate("/dashboard", { replace: true });
                      } finally {
                        setSwitchingRole(false);
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="hr">HR</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
              )}

              <NavLink
                to="/profile"
                className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-1 no-underline transition hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden text-xs font-semibold text-slate-700 sm:inline">
                  {displayName}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {ROLE_LABEL[user?.role] || user?.role}
                </span>
              </NavLink>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
          {(subtitle || actions) && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Bottom Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 px-1 py-1.5 backdrop-blur md:hidden"
        aria-label="Mobile"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold no-underline transition ${
                isActive ? "text-slate-900" : "text-slate-400"
              }`
            }
          >
            <Icon name={item.icon} className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
