import { useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api, deleteAvatar, getAssetUrl, uploadAvatar } from "../lib/api";

function initialsFor(nameOrEmail) {
  const text = (nameOrEmail || "U").trim();
  const parts = text.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

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

  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    setPhone(emp?.phone || "");
    setEmergencyContact(emp?.emergency_contact || "");
  }, [emp?.phone, emp?.emergency_contact]);

  async function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image size must be less than 5MB.");
      return;
    }
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch (err) {
      setAvatarError(err.message || "Failed to upload photo.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAvatar() {
    if (!window.confirm("Remove profile photo?")) return;
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      await deleteAvatar();
      await refreshUser();
    } catch (err) {
      setAvatarError(err.message || "Failed to remove photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

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
        <section className="card-pastel p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              {/* Avatar with Camera Icon */}
              <div className="relative group shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarSelect}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
                {emp?.avatar_url ? (
                  <img
                    src={getAssetUrl(emp.avatar_url)}
                    alt={emp.name || "Profile"}
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-slate-100"
                  />
                ) : (
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-tr from-[#16192e] to-[#2a2f4c] text-lg sm:text-xl font-black text-white shadow-sm ring-2 ring-slate-100">
                    {initialsFor(emp?.name || user?.email)}
                  </div>
                )}

                {/* Camera upload badge */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Upload profile photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 transition-transform active:scale-95"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>

              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {emp?.name || user?.name || user?.email}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {emp?.designation ? `${emp.designation} · ` : ""}
                  {user?.email}
                </p>

                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
                  >
                    {uploadingAvatar ? "Uploading..." : emp?.avatar_url ? "Change Photo" : "Upload Photo"}
                  </button>
                  {emp?.avatar_url && (
                    <button
                      type="button"
                      onClick={handleDeleteAvatar}
                      disabled={uploadingAvatar}
                      className="text-[11px] font-medium text-slate-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {avatarError && (
                  <p className="mt-1 text-[10.5px] font-medium text-rose-600">{avatarError}</p>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  user?.is_active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    : "bg-rose-50 text-rose-700 border border-rose-200/60"
                }`}
              >
                {user?.is_active ? "Active Member" : "Disabled"}
              </span>
            </div>
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
              className="w-full btn-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Contact Info"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
