import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import {
  adjustEmployeeLeave,
  api,
  getAssetUrl,
  getEmployeeLeaveDetail,
  getEmployeeLeaveSummaries,
} from "../lib/api";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200/60",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200/60",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200/60",
};

const TYPE_LABELS = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  unpaid: "Unpaid Leave",
  earned: "Earned Leave",
};

function calcWorkingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default function Leaves() {
  const { user } = useAuth();
  const canApprove = user?.role === "manager" || user?.role === "hr";
  const isHr = user?.role === "hr";

  const [tab, setTab] = useState("my");
  const [balances, setBalances] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState("pending");
  const [employeeSummaries, setEmployeeSummaries] = useState([]);
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [empDetail, setEmpDetail] = useState(null);
  const [loadingEmpDetail, setLoadingEmpDetail] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    type: "add",
    days: 1,
    leave_type: "casual",
    reason: "",
  });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [adjustSuccess, setAdjustSuccess] = useState("");
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
    () => calcWorkingDays(form.start_date, form.end_date),
    [form.start_date, form.end_date]
  );

  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employeeSummaries;
    const q = empSearch.toLowerCase();
    return employeeSummaries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        (e.department_name && e.department_name.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q))
    );
  }, [employeeSummaries, empSearch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [api("/leaves/balances"), api("/leaves/my")];
      if (canApprove) {
        const qs = approvalFilter ? `?status=${approvalFilter}` : "";
        requests.push(api(`/leaves/approvals${qs}`));
        requests.push(getEmployeeLeaveSummaries());
      }
      const [balData, myData, appData, empData] = await Promise.all(requests);
      setBalances(balData);
      setMyLeaves(myData);
      if (canApprove && appData) setApprovals(appData);
      if (canApprove && empData) setEmployeeSummaries(empData);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load leave records.");
    } finally {
      setLoading(false);
    }
  }, [canApprove, approvalFilter]);

  async function openEmpModal(empId) {
    setSelectedEmpId(empId);
    setEmpDetail(null);
    setLoadingEmpDetail(true);
    setAdjustError("");
    setAdjustSuccess("");
    setAdjustForm({ type: "add", days: 1, leave_type: "casual", reason: "" });
    try {
      const data = await getEmployeeLeaveDetail(empId);
      setEmpDetail(data);
    } catch (err) {
      setAdjustError(err.message || "Failed to load employee details.");
    } finally {
      setLoadingEmpDetail(false);
    }
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    if (!selectedEmpId) return;
    setAdjustSubmitting(true);
    setAdjustError("");
    setAdjustSuccess("");
    try {
      const numDays = Math.abs(parseInt(adjustForm.days, 10) || 1);
      const finalDays = adjustForm.type === "deduct" ? -numDays : numDays;
      await adjustEmployeeLeave(selectedEmpId, {
        days: finalDays,
        leave_type: adjustForm.leave_type,
        reason: adjustForm.reason.trim(),
      });
      setAdjustSuccess(
        `Successfully ${finalDays > 0 ? "added +" : "deducted "}${Math.abs(
          finalDays
        )} day(s) leave balance!`
      );
      setAdjustForm({ type: "add", days: 1, leave_type: "casual", reason: "" });
      // Reload current modal detail and list summary
      const [updatedDetail, updatedSummaries] = await Promise.all([
        getEmployeeLeaveDetail(selectedEmpId),
        getEmployeeLeaveSummaries(),
      ]);
      setEmpDetail(updatedDetail);
      setEmployeeSummaries(updatedSummaries);
      // Also refresh balances
      const balData = await api("/leaves/balances");
      setBalances(balData);
    } catch (err) {
      setAdjustError(err.message || "Failed to adjust leave balance.");
    } finally {
      setAdjustSubmitting(false);
    }
  }

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
      subtitle="Annual leave balances (10 CL + 2 SL accrued 1/mo), applications, and team approvals"
      actions={
        <button
          type="button"
          onClick={() => {
            setApplyError("");
            setShowApply(true);
          }}
          className="btn-brand-gradient rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1"
        >
          + Apply Leave
        </button>
      }
    >
      {/* Leave Balance Compact Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {balances.map((b) => (
          <div key={b.leave_type} className="card-pastel-interactive p-3 sm:p-3.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {b.label}
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-extrabold text-[#1d2c55]">
                {b.available === null ? "∞" : b.available}
              </span>
              {b.allocated !== null && (
                <span className="text-[10.5px] font-medium text-slate-400">
                  / {b.allocated} d (Accrued: {b.accrued ?? 0} d)
                </span>
              )}
            </div>
            <div className="mt-1 flex gap-2 text-[10px] text-slate-400 font-medium">
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
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setTab("my")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              tab === "my"
                ? "btn-brand-gradient shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            My Leaves ({myLeaves.length})
          </button>
          {canApprove && (
            <button
              type="button"
              onClick={() => setTab("approvals")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                tab === "approvals"
                  ? "btn-brand-gradient shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Approvals ({approvals.length})
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              onClick={() => setTab("employees")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                tab === "employees"
                  ? "btn-brand-gradient shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Employee Balances ({employeeSummaries.length})
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

        {tab === "employees" && canApprove && (
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by employee, code, dept..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs outline-none focus:border-slate-400"
            />
          </div>
        )}
      </div>

      {/* Table / List Card */}
      <div className="mt-3 card-pastel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading leave records...</div>
        ) : tab === "my" ? (
          myLeaves.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-bold text-slate-800">No leave requests yet</p>
              <p className="mt-1 text-xs text-slate-400">Click &quot;+ Apply Leave&quot; when you need time off.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
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
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                          {req.days}
                          {req.requires_hr_approval && (
                            <span className="ml-1.5 rounded bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 text-[9px] font-semibold">
                              3+ days (HR)
                            </span>
                          )}
                        </td>
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

              {/* Mobile Card List */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {myLeaves.map((req) => (
                  <article key={req.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">
                        {TYPE_LABELS[req.leave_type] || req.leave_type}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                          STATUS_STYLES[req.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{req.start_date} → {req.end_date}</span>
                      <span className="font-bold text-slate-800">
                        {req.days} day{req.days === 1 ? "" : "s"}
                        {req.requires_hr_approval && (
                          <span className="ml-1 text-[9px] text-purple-700 font-normal">
                            (HR approval)
                          </span>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                      {req.reason}
                    </p>

                    {req.review_comment && (
                      <div className="text-[11px] text-slate-400 italic">
                        Note: {req.review_comment}
                      </div>
                    )}

                    {req.status === "pending" && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleCancel(req.id)}
                          className="rounded-md border border-rose-200/80 bg-rose-50/50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100/60"
                        >
                          Cancel Request
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )
        ) : tab === "approvals" ? (
          approvals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No team leave requests for this filter.
          </div>
        ) : (
          <>
            {/* Desktop Table for Approvals */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2.5">Employee</th>
                    <th className="px-3.5 py-2.5">Type</th>
                    <th className="px-3.5 py-2.5">Dates</th>
                    <th className="px-3.5 py-2.5">Days</th>
                    <th className="px-3.5 py-2.5">Reason &amp; Conflicts</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvals.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-800">{req.employee_name}</div>
                        <div className="text-[10px] text-slate-400">{req.employee_code} · {req.department_name || "General"}</div>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                        {TYPE_LABELS[req.leave_type] || req.leave_type}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                        {req.start_date} → {req.end_date}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">
                        {req.days}
                        {req.requires_hr_approval && (
                          <div className="text-[9.5px] font-bold text-purple-700">3+ d (HR Only)</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-sm">
                        <div>{req.reason}</div>
                        {req.team_conflicts && req.team_conflicts.length > 0 && (
                          <div className="mt-1 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-1 text-[10px] text-amber-800">
                            <span className="font-bold">⚠️ Team Conflict:</span>{" "}
                            {req.team_conflicts.map((c) => c.split(" · ")[0]).join(", ")} is on leave
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
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        {req.status === "pending" ? (
                          <div className="inline-flex items-center gap-1.5">
                            {req.requires_hr_approval && !isHr ? (
                              <span className="rounded bg-purple-50 border border-purple-200 text-purple-700 px-2 py-1 text-[10px] font-bold">
                                HR Approval Needed
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewComment("");
                                  setReviewing({ req, action: "approve" });
                                }}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setReviewComment("");
                                setReviewing({ req, action: "reject" });
                              }}
                              className="rounded border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
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

            {/* Mobile Card List for Approvals */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {approvals.map((req) => (
                <article key={req.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{req.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{req.employee_code} · {TYPE_LABELS[req.leave_type]}</div>
                    </div>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                        STATUS_STYLES[req.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{req.start_date} → {req.end_date}</span>
                    <span className="font-bold text-slate-800">
                      {req.days} days
                      {req.requires_hr_approval && (
                        <span className="ml-1 text-[9px] text-purple-700 font-bold">(HR Only)</span>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                    {req.reason}
                  </p>

                  {req.team_conflicts && req.team_conflicts.length > 0 && (
                    <div className="rounded-md bg-amber-50 border border-amber-200/80 p-2 text-[10.5px] text-amber-800">
                      <span className="font-bold">⚠️ Team Conflict:</span>{" "}
                      {req.team_conflicts.map((c) => c.split(" · ")[0]).join(", ")} is also on leave
                    </div>
                  )}

                  {req.status === "pending" && (
                    <div className="flex justify-end items-center gap-2 pt-1">
                      {req.requires_hr_approval && !isHr ? (
                        <span className="rounded bg-purple-50 border border-purple-200 text-purple-700 px-2 py-1 text-[10px] font-bold">
                          HR Approval Needed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewComment("");
                            setReviewing({ req, action: "approve" });
                          }}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setReviewComment("");
                          setReviewing({ req, action: "reject" });
                        }}
                        className="rounded-md border border-rose-200/80 bg-rose-50/50 px-2.5 py-1 text-[11px] font-semibold text-rose-600"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )) : (
          /* Employee Balances Tab */
          filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No employee records found matching &quot;{empSearch}&quot;.
            </div>
          ) : (
            <>
              {/* Desktop Employee Balances Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="px-3.5 py-2.5">Employee</th>
                      <th className="px-3.5 py-2.5">Department</th>
                      <th className="px-3.5 py-2.5">Joined Date</th>
                      <th className="px-3.5 py-2.5 text-center">Accrued</th>
                      <th className="px-3.5 py-2.5 text-center">Adjustments</th>
                      <th className="px-3.5 py-2.5 text-center">Taken</th>
                      <th className="px-3.5 py-2.5 text-center">Pending</th>
                      <th className="px-3.5 py-2.5 text-center">Available Balance</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.employee_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {emp.avatar_url ? (
                              <img
                                src={getAssetUrl(emp.avatar_url)}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                                className="h-7 w-7 rounded-full object-cover shrink-0 border border-slate-200"
                              />
                            ) : (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                                {emp.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{emp.name}</span>
                                {emp.email === user?.email && (
                                  <span className="rounded bg-rose-50 border border-rose-200 text-rose-600 px-1.5 py-0.2 text-[9.5px] font-bold">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {emp.employee_code} {emp.designation ? `· ${emp.designation}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-medium">
                          {emp.department_name || "General"}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                          {emp.joining_date || "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-800">
                          {emp.accrued} d
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          {emp.adjustments !== 0 ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                                emp.adjustments > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : "bg-rose-50 text-rose-700 border border-rose-200/60"
                              }`}
                            >
                              {emp.adjustments > 0 ? `+${emp.adjustments}` : emp.adjustments} d
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">0 d</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                          {emp.used} d
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-semibold text-amber-600">
                          {emp.pending > 0 ? `${emp.pending} d` : "0"}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-black ${
                              emp.available > 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-500 border border-slate-200/60"
                            }`}
                          >
                            {emp.available} day{emp.available === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openEmpModal(emp.employee_id)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition-all"
                          >
                            View &amp; Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Employee Balances Cards */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {filteredEmployees.map((emp) => (
                  <div key={emp.employee_id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {emp.employee_code} · {emp.department_name || "General"}
                        </div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-black ${
                          emp.available > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {emp.available} d left
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center text-[10px] bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block">Accrued</span>
                        <span className="font-bold text-slate-700">{emp.accrued} d</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Adjusted</span>
                        <span className="font-bold text-slate-700">
                          {emp.adjustments > 0 ? `+${emp.adjustments}` : emp.adjustments} d
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Taken</span>
                        <span className="font-bold text-slate-700">{emp.used} d</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Pending</span>
                        <span className="font-bold text-amber-600">{emp.pending} d</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => openEmpModal(emp.employee_id)}
                        className="w-full text-center rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        View Details &amp; Adjust Leave
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>

      {/* Apply Modal - Bottom Sheet on Mobile */}
      {showApply && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl">
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

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
                  <option value="casual">Casual Leave (10/yr · Accrues 1/mo)</option>
                  <option value="sick">Sick Leave (2/yr · Accrues 1/mo)</option>
                  <option value="unpaid">Unpaid Leave (Loss of Pay · Unlimited)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => {
                      const next = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        start_date: next,
                        end_date: prev.end_date < next ? next : prev.end_date,
                      }));
                    }}
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

              <div className="flex flex-col gap-1 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    Duration: {dayPreview} working day{dayPreview === 1 ? "" : "s"}
                  </span>
                  {dayPreview >= 3 && (
                    <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 text-[9.5px]">
                      Requires HR Approval (3+ days)
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-slate-400 font-normal">
                  🌿 Excludes weekends (Sat &amp; Sun). Only working days are deducted.
                </div>
                {dayPreview === 0 && form.start_date && form.end_date && (
                  <div className="text-[11px] text-amber-700 font-medium pt-1">
                    ⚠️ Selected range falls entirely on weekends (Sat/Sun). Leave is only required for working days.
                  </div>
                )}
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
                <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 leading-relaxed">
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
                  className="btn-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal - Bottom Sheet on Mobile */}
      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xl">
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <h2 className="text-sm font-bold text-slate-900 capitalize">
              {reviewing.action} leave request
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {reviewing.req.employee_name} · {TYPE_LABELS[reviewing.req.leave_type]} (
              {reviewing.req.days} days)
            </p>

            {/* Team conflict alert inside modal */}
            {reviewing.req.team_conflicts && reviewing.req.team_conflicts.length > 0 && (
              <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-900">
                  <span>⚠️</span> Team Leave Conflict Detected:
                </div>
                <div className="text-[11px] space-y-0.5">
                  {reviewing.req.team_conflicts.map((c, i) => (
                    <div key={i}>• {c}</div>
                  ))}
                </div>
                <div className="text-[10px] text-amber-700 pt-0.5">
                  Please verify adequate team coverage before deciding.
                </div>
              </div>
            )}

            {/* HR 3+ days rule alert */}
            {reviewing.req.requires_hr_approval && (
              <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 p-2 text-[11px] text-purple-800 font-medium">
                📌 Request is for 3 or more days. HR Admin approval is required by company policy.
              </div>
            )}

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
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-2xs"
                      : "bg-[#ff3366] hover:bg-rose-700 shadow-2xs"
                  }`}
                >
                  {submitting ? "Saving..." : `Confirm ${reviewing.action}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Detail & Adjust Modal */}
      {selectedEmpId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                {empDetail?.summary?.avatar_url ? (
                  <img
                    src={getAssetUrl(empDetail.summary.avatar_url)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#16192e] to-[#2a2f4c] text-xs font-black text-white">
                    {empDetail?.summary?.name?.slice(0, 2).toUpperCase() || "EM"}
                  </div>
                )}
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {empDetail?.summary?.name || "Loading..."}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {empDetail?.summary?.employee_code} · {empDetail?.summary?.department_name || "General"}
                    {empDetail?.summary?.designation ? ` · ${empDetail.summary.designation}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEmpId(null);
                  setEmpDetail(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {loadingEmpDetail || !empDetail ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading leave details...</div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Accrual Explanation Banner */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>🗓️ Monthly Accrual Calculation ({new Date().getFullYear()})</span>
                  </div>
                  <div className="mt-1 text-[11px] text-blue-700 leading-relaxed">
                    Joined on <strong>{empDetail.summary.joining_date || "Start of Year"}</strong>.
                    Active period this calendar year: <strong>{empDetail.summary.accrued} month(s)</strong> worked
                    → <strong>{empDetail.summary.accrued} day(s) accrued</strong> (1 day / month).
                  </div>
                </div>

                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Accrued</span>
                    <div className="mt-0.5 text-lg font-extrabold text-slate-800">{empDetail.summary.accrued} d</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Adjustments</span>
                    <div className="mt-0.5 text-lg font-extrabold text-slate-800">
                      {empDetail.summary.adjustments > 0 ? `+${empDetail.summary.adjustments}` : empDetail.summary.adjustments} d
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Taken (Used)</span>
                    <div className="mt-0.5 text-lg font-extrabold text-slate-800">{empDetail.summary.used} d</div>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-2.5 text-center">
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase">Available</span>
                    <div className="mt-0.5 text-lg font-extrabold text-emerald-700">{empDetail.summary.available} d</div>
                  </div>
                </div>

                {/* Balances by Category */}
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Category Breakdown</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {empDetail.balances.map((b) => (
                      <div key={b.leave_type} className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-700">{b.label}</div>
                        <div className="mt-1 flex items-baseline justify-between text-xs">
                          <span className="text-slate-400">Available:</span>
                          <span className="font-extrabold text-[#1d2c55]">{b.available === null ? "∞" : `${b.available} d`}</span>
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-between text-[10.5px] text-slate-500">
                          <span>Used / Pending:</span>
                          <span>{b.used} / {b.pending} d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HR Adjustment Form */}
                {isHr && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold text-slate-900">
                        ⚡ Quick Leave Adjustment (HR Admin Only)
                      </h3>
                      <span className="text-[10.5px] text-slate-400 font-medium">Comp-off, bonus, or deduction</span>
                    </div>

                    <form onSubmit={handleAdjustSubmit} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Action Type</label>
                          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setAdjustForm({ ...adjustForm, type: "add" })}
                              className={`flex-1 py-1 text-center text-xs font-bold rounded-md transition-all ${
                                adjustForm.type === "add"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              + Credit
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdjustForm({ ...adjustForm, type: "deduct" })}
                              className={`flex-1 py-1 text-center text-xs font-bold rounded-md transition-all ${
                                adjustForm.type === "deduct"
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              - Deduct
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Days</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            required
                            value={adjustForm.days}
                            onChange={(e) => setAdjustForm({ ...adjustForm, days: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                          <select
                            value={adjustForm.leave_type}
                            onChange={(e) => setAdjustForm({ ...adjustForm, leave_type: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-slate-400"
                          >
                            <option value="casual">Casual Leave</option>
                            <option value="sick">Sick Leave</option>
                            <option value="earned">Earned Leave</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Reason / Audit Note <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          minLength={3}
                          maxLength={500}
                          placeholder="e.g. Comp-off for Sunday release, Opening balance adjustment..."
                          value={adjustForm.reason}
                          onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-slate-400"
                        />
                      </div>

                      {adjustError && (
                        <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                          {adjustError}
                        </div>
                      )}

                      {adjustSuccess && (
                        <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 font-semibold">
                          {adjustSuccess}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={adjustSubmitting}
                          className="btn-brand-gradient rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
                        >
                          {adjustSubmitting ? "Applying..." : "Apply Adjustment"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Adjustments History */}
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Adjustment Audit Log ({empDetail.adjustments.length})
                  </h3>
                  {empDetail.adjustments.length === 0 ? (
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-center text-xs text-slate-400">
                      No manual adjustments have been made for this employee.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white max-h-48 overflow-y-auto">
                      {empDetail.adjustments.map((adj) => (
                        <div key={adj.id} className="p-2.5 text-xs flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                  adj.days > 0
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : "bg-rose-50 text-rose-700 border border-rose-200/60"
                                }`}
                              >
                                {adj.days > 0 ? `+${adj.days}` : adj.days} day(s)
                              </span>
                              <span className="font-semibold text-slate-800 capitalize">
                                {adj.leave_type} Leave
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">{adj.reason}</div>
                          </div>
                          <div className="text-right text-[10px] text-slate-400">
                            <div>{adj.adjusted_by_name ? `By ${adj.adjusted_by_name}` : "By HR Admin"}</div>
                            <div>{adj.created_at ? new Date(adj.created_at).toLocaleDateString() : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
