import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Brand from "./Brand";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { employee: "Employee", manager: "Manager", hr: "HR" };

function Icon({ name, className = "h-5 w-5 shrink-0" }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
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
    case "leaves":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "timesheets":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
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
    case "password":
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
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
    { to: "/profile", label: "My Profile", icon: "profile" },
    { to: "/timesheets", label: "Timesheets", icon: "timesheets" },
    { to: "/leaves", label: "Leaves", icon: "leaves" },
  ];
  if (role === "manager" || role === "hr") {
    items.push({ to: "/team", label: "My Team", icon: "team" });
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
      /* ignore storage errors */
    }
  }, [expanded]);

  const navItems = navItemsFor(user?.role);
  const displayName = user?.employee?.name || user?.name || user?.email;
  const initials = initialsFor(displayName);

  return (
    <div className="flex min-h-dvh bg-nemilink-lavender text-[#252941]">
      {/* Desktop Collapsible Icon Rail */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col justify-between border-r border-[#e5e3fa] bg-white/95 py-4 backdrop-blur transition-all duration-200 md:flex ${
          expanded ? "w-60 px-3.5" : "w-[74px] items-center px-2.5"
        }`}
      >
        <div className="flex w-full flex-col gap-5">
          {/* Brand + Collapse toggle */}
          <div
            className={`flex items-center ${
              expanded ? "justify-between px-1" : "flex-col gap-3"
            }`}
          >
            <NavLink to="/dashboard" className="no-underline" title="Nemilink Workspace">
              {expanded ? (
                <Brand />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nemilink-lavender text-lg font-black tracking-tight text-nemilink-navy">
                  N<span className="text-nemilink-coral">.</span>
                </span>
              )}
            </NavLink>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#e6e8f0] text-gray-500 transition hover:border-nemilink-navy hover:text-nemilink-navy"
            >
              <Icon
                name="chevron"
                className={`h-4 w-4 transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Primary Nav */}
          <nav className="flex w-full flex-col gap-1.5" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={!expanded ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold no-underline transition ${
                    expanded ? "justify-start" : "justify-center"
                  } ${
                    isActive
                      ? "bg-nemilink-navy text-white shadow-xs"
                      : "text-gray-500 hover:bg-nemilink-lavender hover:text-nemilink-navy"
                  }`
                }
              >
                <Icon name={item.icon} />
                {expanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Account Actions */}
        <div className="flex w-full flex-col gap-1.5 border-t border-[#f0effc] pt-3">
          <NavLink
            to="/change-password"
            title={!expanded ? "Change password" : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold no-underline transition ${
                expanded ? "justify-start" : "justify-center"
              } ${
                isActive
                  ? "bg-nemilink-lavender text-nemilink-navy"
                  : "text-gray-500 hover:bg-gray-50 hover:text-nemilink-navy"
              }`
            }
          >
            <Icon name="password" />
            {expanded && <span className="truncate">Password</span>}
          </NavLink>

          <button
            type="button"
            onClick={logout}
            title={!expanded ? "Sign out" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-nemilink-coral transition hover:bg-rose-50 ${
              expanded ? "justify-start" : "justify-center"
            }`}
          >
            <Icon name="logout" />
            {expanded && <span className="truncate">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {/* Minimal Topbar */}
        <header className="sticky top-0 z-30 border-b border-[#e5e3fa] bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <NavLink to="/dashboard" className="no-underline md:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-nemilink-lavender text-base font-black text-nemilink-navy">
                  N<span className="text-nemilink-coral">.</span>
                </span>
              </NavLink>
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-wider text-nemilink-coral uppercase">
                  Nemilink Workspace
                </div>
                {title && (
                  <div className="truncate text-base font-extrabold text-nemilink-navy sm:text-lg">
                    {title}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.is_super_admin && (
                <label className="flex items-center gap-1.5 rounded-xl border border-[#dcd9f8] bg-[#faf9ff] px-2.5 py-1.5 text-xs font-bold text-nemilink-navy">
                  <span className="hidden text-[10px] tracking-wider text-nemilink-coral uppercase sm:inline">
                    View as
                  </span>
                  <select
                    aria-label="Switch active role"
                    value={user.role}
                    disabled={switchingRole}
                    onChange={async (e) => {
                      const nextRole = e.target.value;
                      setSwitchingRole(true);
                      try {
                        await switchRole(nextRole);
                        navigate("/dashboard", { replace: true });
                      } finally {
                        setSwitchingRole(false);
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-nemilink-navy outline-none"
                  >
                    <option value="hr">HR / Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </label>
              )}

              <NavLink
                to="/profile"
                className="flex items-center gap-2.5 rounded-2xl border border-[#ebe9fa] bg-[#faf9ff] px-3 py-1.5 no-underline transition hover:border-nemilink-navy"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nemilink-navy text-xs font-bold text-white">
                  {initials}
                </span>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-bold text-nemilink-navy">{displayName}</div>
                  <div className="text-[10px] font-semibold text-gray-400">
                    {ROLE_LABEL[user?.role] || user?.role}
                  </div>
                </div>
              </NavLink>

              <button
                type="button"
                onClick={logout}
                className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-nemilink-coral hover:bg-rose-50 md:hidden"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">
          {(subtitle || actions) && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Bottom Dock */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#e5e3fa] bg-white/95 px-2 py-2 backdrop-blur md:hidden"
        aria-label="Mobile"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] font-bold no-underline transition ${
                isActive ? "text-nemilink-navy" : "text-gray-400"
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label.replace("My ", "")}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
