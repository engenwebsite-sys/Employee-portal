import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function InfoCell({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-xs font-bold text-slate-800">{value || "—"}</div>
    </div>
  );
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const emp = user?.employee;

  const [phone, setPhone] = useState(emp?.phone || "");
  const [emergencyContact, setEmergencyContact] = useState(emp?.emergency_contact || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPhone(emp?.phone || "");
    setEmergencyContact(emp?.emergency_contact || "");
  }, [emp?.phone, emp?.emergency_contact]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api("/me", {
        method: "PATCH",
        body: {
          phone: phone.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
        },
      });
      await refreshUser();
      setMessage("Contact details updated successfully.");
    } catch (err) {
      setError(err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="My Profile"
      subtitle="Workspace account details and contact preferences"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Workspace Account Details */}
        <section className="card-pastel p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {emp?.name || user?.name || user?.email}
              </h2>
              <p className="text-xs text-slate-400">
                {emp?.designation ? `${emp.designation} · ` : ""}
                {user?.email}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                user?.is_active
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  : "bg-rose-50 text-rose-700 border border-rose-200/60"
              }`}
            >
              {user?.is_active ? "Active" : "Disabled"}
            </span>
          </div>

          {emp ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <InfoCell label="Employee Code" value={emp.employee_code} />
              <InfoCell label="Role" value={user?.role?.toUpperCase()} />
              <InfoCell label="Department" value={emp.department?.name || "General"} />
              <InfoCell
                label="Reporting Manager"
                value={emp.manager ? `${emp.manager.name} (${emp.manager.employee_code})` : "None"}
              />
              <InfoCell label="Joining Date" value={emp.joining_date} />
              <InfoCell label="Probation End" value={emp.probation_end_date} />
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              No employee profile record is linked to this account yet.
            </div>
          )}
        </section>

        {/* Contact info update */}
        <section className="card-pastel p-4">
          <h3 className="text-xs font-bold text-slate-900">Contact Details</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Keep your phone and emergency contact current.
          </p>

          <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700" htmlFor="profile-phone">
                Phone Number
              </label>
              <input
                id="profile-phone"
                type="text"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={!emp || saving}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-slate-400 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label
                className="mb-1 block font-semibold text-slate-700"
                htmlFor="profile-emergency"
              >
                Emergency Contact
              </label>
              <input
                id="profile-emergency"
                type="text"
                maxLength={255}
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name & contact number"
                disabled={!emp || saving}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-slate-400 disabled:bg-slate-50"
              />
            </div>

            {message && (
              <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!emp || saving}
              className="w-full rounded-lg bg-[#16192e] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50 shadow-2xs"
            >
              {saving ? "Saving..." : "Save Contact Info"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
