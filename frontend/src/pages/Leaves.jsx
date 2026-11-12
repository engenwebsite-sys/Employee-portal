import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const TYPE_LABELS = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  earned: "Earned Leave",
  unpaid: "Unpaid Leave",
};

function calcDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const diff = Math.round((e - s) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

export default function Leaves() {
  const { user } = useAuth();
  const canApprove = user?.role === "manager" || user?.role === "hr";

  const [tab, setTab] = useState("my"); // "my" | "approvals"
  const [balances, setBalances] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Apply modal state
  const today = new Date().toISOString().slice(0, 10);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({
    leave_type: "casual",
    start_date: today,
    end_date: today,
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Review modal state
  const [reviewing, setReviewing] = useState(null); // { req, action: "approve" | "reject" }
  const [reviewComment, setReviewComment] = useState("");

  const dayPreview = useMemo(
    () => calcDays(form.start_date, form.end_date),
    [form.start_date, form.end_date]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [api("/leaves/balances"), api("/leaves/my")];
      if (canApprove) {
        const qs = approvalFilter ? `?status=${approvalFilter}` : "";
        requests.push(api(`/leaves/approvals${qs}`));
      }
      const [balData, myData, appData] = await Promise.all(requests);
      setBalances(balData);
      setMyLeaves(myData);
      if (canApprove && appData) setApprovals(appData);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load leave data.");
    } finally {
      setLoading(false);
    }
  }, [canApprove, approvalFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApply(e) {
    e.preventDefault();
    setSubmitting(true);
    setApplyError("");
    try {
      await api("/leaves", {
        method: "POST",
        body: {
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason.trim(),
        },
      });
      setShowApply(false);
      setForm({ leave_type: "casual", start_date: today, end_date: today, reason: "" });
      await loadData();
    } catch (err) {
      setApplyError(err.message || "Could not submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id) {
    try {
      await api(`/leaves/${id}/cancel`, { method: "POST" });
      await loadData();
    } catch (err) {
      setError(err.message || "Could not cancel leave request.");
    }
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewing) return;
    setSubmitting(true);
    try {
      await api(`/leaves/${reviewing.req.id}/${reviewing.action}`, {
        method: "POST",
        body: { comment: reviewComment.trim() || null },
      });
      setReviewing(null);
      setReviewComment("");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not update leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Leaves"
      subtitle="Check your leave balances, apply for time off, and track approvals."
      actions={
        <button
          type="button"
          onClick={() => {
            setApplyError("");
            setShowApply(true);
          }}
          className="rounded-xl bg-nemilink-coral px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
        >
          + Apply Leave
        </button>
      }
    >
      {/* Leave Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <div key={b.leave_type} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
              {b.label}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-nemilink-navy">
                {b.available === null ? "∞" : b.available}
              </span>
              {b.allocated !== null && (
                <span className="text-xs font-semibold text-gray-400">/ {b.allocated} days</span>
              )}
            </div>
            <div className="mt-2 flex gap-3 text-xs text-gray-500">
              <span>Used: {b.used}</span>
              <span>Pending: {b.pending}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setTab("my")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              tab === "my"
                ? "bg-nemilink-lavender text-nemilink-navy"
                : "text-gray-500 hover:text-nemilink-navy"
            }`}
          >
            My Requests ({myLeaves.length})
          </button>
          {canApprove && (
            <button
              type="button"
              onClick={() => setTab("approvals")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab === "approvals"
                  ? "bg-nemilink-lavender text-nemilink-navy"
                  : "text-gray-500 hover:text-nemilink-navy"
              }`}
            >
              Team Approvals ({approvals.length})
            </button>
          )}
        </div>

        {tab === "approvals" && canApprove && (
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="rounded-xl border border-[#dcd9f8] bg-white px-3.5 py-2 text-sm font-semibold text-nemilink-navy outline-none"
          >
            <option value="pending">Pending only</option>
            <option value="">All requests</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {/* Table Section */}
      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading leave requests...</div>
        ) : tab === "my" ? (
          myLeaves.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base font-bold text-nemilink-navy">No leave requests yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Click &quot;+ Apply Leave&quot; when you need time off.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-[#faf9ff] text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                  <tr>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Dates</th>
                    <th className="px-5 py-3.5">Days</th>
                    <th className="px-5 py-3.5">Reason</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myLeaves.map((req) => (
                    <tr key={req.id} className="hover:bg-[#fcfbff]">
                      <td className="px-5 py-3.5 font-bold text-nemilink-navy">
                        {TYPE_LABELS[req.leave_type] || req.leave_type}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {req.start_date} → {req.end_date}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-nemilink-navy">{req.days}</td>
                      <td className="max-w-xs px-5 py-3.5 text-gray-600">
                        <div>{req.reason}</div>
                        {req.review_comment && (
                          <div className="mt-0.5 text-xs text-gray-400">
                            Note: {req.review_comment}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                            STATUS_STYLES[req.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {req.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(req.id)}
                            className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : approvals.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-nemilink-navy">No matching requests</p>
            <p className="mt-1 text-sm text-gray-500">
              There are no team leave requests for this filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-[#faf9ff] text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Dates</th>
                  <th className="px-5 py-3.5">Days</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvals.map((req) => (
                  <tr key={req.id} className="hover:bg-[#fcfbff]">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-nemilink-navy">{req.employee_name}</div>
                      <div className="text-xs text-gray-500">
                        {req.employee_code}
                        {req.department_name ? ` · ${req.department_name}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-nemilink-navy">
                      {TYPE_LABELS[req.leave_type] || req.leave_type}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {req.start_date} → {req.end_date}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-nemilink-navy">{req.days}</td>
                    <td className="max-w-xs px-5 py-3.5 text-gray-600">{req.reason}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                          STATUS_STYLES[req.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {req.status === "pending" ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewComment("");
                              setReviewing({ req, action: "approve" });
                            }}
                            className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewComment("");
                              setReviewing({ req, action: "reject" });
                            }}
                            className="rounded-xl border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {req.reviewed_by_email || "Reviewed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showApply && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xl font-extrabold text-nemilink-navy">Apply for Leave</h2>
              <button
                type="button"
                onClick={() => setShowApply(false)}
                className="rounded-xl px-2.5 py-1 text-sm font-bold text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                  Leave type
                </label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-nemilink-navy"
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                    Start date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-nemilink-navy"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                    End date
                  </label>
                  <input
                    type="date"
                    required
                    min={form.start_date}
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-nemilink-navy"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-nemilink-lavender px-3.5 py-2 text-xs font-bold text-nemilink-navy">
                Duration: {dayPreview} day{dayPreview === 1 ? "" : "s"}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">Reason</label>
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Brief reason for your leave..."
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-nemilink-navy"
                />
              </div>

              {applyError && (
                <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                  {applyError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApply(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || dayPreview < 1}
                  className="rounded-xl bg-nemilink-coral px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold text-nemilink-navy capitalize">
              {reviewing.action} leave request
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {reviewing.req.employee_name} · {TYPE_LABELS[reviewing.req.leave_type]} (
              {reviewing.req.days} day{reviewing.req.days === 1 ? "" : "s"})
            </p>
            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-nemilink-navy">
                  Comment (optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add an optional note..."
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-nemilink-navy"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReviewing(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                    reviewing.action === "approve" ? "bg-emerald-600" : "bg-nemilink-coral"
                  }`}
                >
                  {submitting
                    ? "Saving..."
                    : reviewing.action === "approve"
                    ? "Confirm Approve"
                    : "Confirm Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

