import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#eceaf9] bg-[#faf9ff] px-4 py-3">
      <div className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">{label}</div>
      <div className="mt-1 text-sm font-semibold text-nemilink-navy">{value || "—"}</div>
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
      setMessage("Contact details updated.");
    } catch (err) {
      setError(err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="My Profile"
      subtitle="View your workspace account details and keep your emergency contact up to date."
      actions={
        <Link
          to="/change-password"
          className="rounded-xl border border-[#dcd9f8] bg-white px-4 py-2 text-sm font-semibold text-nemilink-navy transition hover:border-nemilink-navy"
        >
          Change password
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account & Employment Details */}
        <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
          <span className="section-label">WORKSPACE PROFILE</span>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-nemilink-navy">
                {emp?.name || user?.name || user?.email}
              </h2>
              <p className="text-sm text-gray-500">
                {emp?.designation ? `${emp.designation} · ` : ""}
                {user?.email}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                user?.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {user?.is_active ? "Active Account" : "Disabled"}
            </span>
          </div>

          {emp ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoRow label="Employee Code" value={emp.employee_code} />
              <InfoRow label="Role" value={user?.role?.toUpperCase()} />
              <InfoRow label="Department" value={emp.department?.name} />
              <InfoRow
                label="Reporting Manager"
                value={emp.manager ? `${emp.manager.name} (${emp.manager.employee_code})` : "None"}
              />
              <InfoRow label="Joining Date" value={emp.joining_date} />
              <InfoRow label="Probation End Date" value={emp.probation_end_date} />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No employee profile record is linked to this login account yet. Contact HR if this is unexpected.
            </div>
          )}
        </section>

        {/* Editable Contact Info */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <span className="section-label">CONTACT DETAILS</span>
          <h3 className="mt-2 text-lg font-bold text-nemilink-navy">Update contact info</h3>
          <p className="mt-1 text-xs text-gray-500">
            You can update your phone number and emergency contact anytime.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-nemilink-navy" htmlFor="profile-phone">
                Phone number
              </label>
              <input
                id="profile-phone"
                type="text"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={!emp || saving}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-nemilink-navy disabled:bg-gray-50"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-bold text-nemilink-navy"
                htmlFor="profile-emergency"
              >
                Emergency contact
              </label>
              <input
                id="profile-emergency"
                type="text"
                maxLength={255}
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name & phone number"
                disabled={!emp || saving}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-nemilink-navy disabled:bg-gray-50"
              />
            </div>

            {message && (
              <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!emp || saving}
              className="w-full rounded-xl bg-nemilink-coral px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save contact details"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

