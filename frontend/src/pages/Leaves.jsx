import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200/60",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200/60",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200/60",
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

  const [tab, setTab] = useState("my");
  const [balances, setBalances] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const [reviewing, setReviewing] = useState(null);
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
      setError(err.message || "Failed to load leave records.");
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
    if (!window.confirm("Cancel this leave request?")) return;
    try {
      await api(`/leaves/${id}/cancel`, { method: "POST" });
      await loadData();
    } catch (err) {
      setError(err.message || "Could not cancel request.");
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
      setError(err.message || "Could not update request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Leaves"
      subtitle="Leave balances, applications, and team approvals"
      actions={
        <button
          type="button"
          onClick={() => {
            setApplyError("");
            setShowApply(true);
          }}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          + Apply Leave
        </button>
      }
    >
      {/* Leave Balance Compact Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <div key={b.leave_type} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {b.label}
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">
                {b.available === null ? "∞" : b.available}
              </span>
              {b.allocated !== null && (
                <span className="text-[11px] font-medium text-slate-400">/ {b.allocated} d</span>
              )}
            </div>
            <div className="mt-1.5 flex gap-2 text-[10px] text-slate-400">
              <span>Used: {b.used}</span>
              <span>·</span>
              <span>Pending: {b.pending}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setTab("my")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              tab === "my"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            My Leaves ({myLeaves.length})
          </button>
          {canApprove && (
            <button
              type="button"
              onClick={() => setTab("approvals")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                tab === "approvals"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Approvals ({approvals.length})
            </button>
          )}
        </div>

        {tab === "approvals" && canApprove && (
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="pending">Pending only</option>
            <option value="">All requests</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {/* Table / List Card */}
      <div className="mt-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading leave records...</div>
        ) : tab === "my" ? (
          myLeaves.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-slate-800">No leave requests yet</p>
              <p className="mt-1 text-xs text-slate-400">Click &quot;+ Apply Leave&quot; when you need time off.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2.5">Type</th>
                    <th className="px-3.5 py-2.5">Dates</th>
                    <th className="px-3.5 py-2.5">Days</th>
                    <th className="px-3.5 py-2.5">Reason</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myLeaves.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                        {TYPE_LABELS[req.leave_type] || req.leave_type}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {req.start_date} → {req.end_date}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">{req.days}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-xs">
                        <div>{req.reason}</div>
                        {req.review_comment && (
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            Note: {req.review_comment}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            STATUS_STYLES[req.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {req.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(req.id)}
                            className="rounded px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No team leave requests for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3.5 py-2.5">Employee</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5">Dates</th>
                  <th className="px-3.5 py-2.5">Days</th>
                  <th className="px-3.5 py-2.5">Reason</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvals.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-800">{req.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{req.employee_code}</div>
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                      {TYPE_LABELS[req.leave_type] || req.leave_type}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                      {req.start_date} → {req.end_date}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-800">{req.days}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 max-w-xs">{req.reason}</td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          STATUS_STYLES[req.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      {req.status === "pending" ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewComment("");
                              setReviewing({ req, action: "approve" });
                            }}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewComment("");
                              setReviewing({ req, action: "reject" });
                            }}
                            className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {req.reviewed_by_email || "Done"}
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

      {/* Apply Modal */}
      {showApply && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-bold text-slate-900">Apply for Leave</h2>
              <button
                type="button"
                onClick={() => setShowApply(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-slate-400"
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    required
                    min={form.start_date}
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                Duration: {dayPreview} day{dayPreview === 1 ? "" : "s"}
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Reason</label>
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Reason for taking time off..."
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              {applyError && (
                <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                  {applyError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowApply(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || dayPreview < 1}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-sm font-bold text-slate-900 capitalize">
              {reviewing.action} leave request
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {reviewing.req.employee_name} · {TYPE_LABELS[reviewing.req.leave_type]} (
              {reviewing.req.days} days)
            </p>
            <form onSubmit={handleReviewSubmit} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Note (optional)</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Optional review note..."
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewing(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                    reviewing.action === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting ? "Saving..." : `Confirm ${reviewing.action}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
