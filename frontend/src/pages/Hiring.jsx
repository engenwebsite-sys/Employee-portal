import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { api } from "../lib/api";
import { portalDate } from "../lib/portalDate";
import {
  candidateExperience, CandidateProfileDetails, CandidateProfileFields, Field, fieldClass, readCandidateProfile,
} from "./HiringCandidateProfile";

const stages = ["Applied", "Screening", "Interviewing", "Offer", "Joined", "Rejected", "Withdrawn"];
const tabs = ["Overview", "Openings", "Candidates", "Talent Pool", "Interview Schedule"];
const initialData = { openings: [], applications: [], talent_pool: [], managers: [] };
const primary = "btn-brand-gradient rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const danger = "rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50";
const panel = "card-pastel overflow-hidden p-4 sm:p-5";
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
});
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", hourCycle: "h23", hour: "2-digit", minute: "2-digit",
});
const tableHead = "bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500";
const cell = "px-4 py-3";

function interviewDate(value) {
  return dateFormatter.format(new Date(value)) + " IST";
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return portalDate(date) + "T" + clockFormatter.format(date);
}

function Badge({ children }) {
  const color = {
    Open: "bg-emerald-50 text-emerald-800",
    Joined: "bg-emerald-50 text-emerald-800",
    Attended: "bg-emerald-50 text-emerald-800",
    Passed: "bg-emerald-50 text-emerald-800",
    Sent: "bg-emerald-50 text-emerald-800",
    Failed: "bg-rose-50 text-rose-800",
    Rejected: "bg-rose-50 text-rose-800",
    Pending: "bg-amber-50 text-amber-800",
    Scheduled: "bg-sky-50 text-sky-800",
  }[children] || "bg-slate-100 text-slate-700";
  return <span className={"inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold " + color}>{children}</span>;
}

function OpeningForm({ opening, managers }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Job title" name="title" defaultValue={opening?.title} required maxLength={150} />
      <Field label="Division" name="division" defaultValue={opening?.division} required maxLength={80} />
      <Field label="Vacancies" name="vacancies" defaultValue={opening?.vacancies ?? 1} type="number" min={1} max={500} required />
      <Field label="Status" name="status" defaultValue={opening?.status || "Open"} options={["Open", "On Hold", "Closed"]} />
      <Field label="Target joining date" name="target_joining_date" defaultValue={opening?.target_joining_date || ""} type="date" />
      <Field label="Assigned manager" name="manager_id" defaultValue={opening?.manager_id || ""} required options={[
        { value: "", text: "Select a manager" },
        ...managers.map((manager) => ({ value: manager.id, text: manager.name === manager.email ? manager.email : manager.name + " (" + manager.email + ")" })),
      ]} />
      <Field label="HR owner" name="hr_owner_id" defaultValue={opening?.hr_owner_id || ""} options={[
        { value: "", text: opening ? "Keep current owner" : "Use my HR account" },
        ...managers.filter((manager) => manager.role === "hr").map((manager) => ({ value: manager.id, text: manager.email })),
      ]} />
      <div className="sm:col-span-2">
        <Field label="Interview rounds, one per line" name="rounds" defaultValue={(opening?.rounds || ["Screening", "L1", "L2", "HR"]).join("\n")} multiline required />
        <p className="mt-1.5 text-xs text-slate-500">Enter rounds in order. Rounds with interview history can be reordered.</p>
      </div>
    </div>
  );
}

function OpeningSelect({ openings, required, ...props }) {
  return <Field label={required ? "Opening" : "Opening (optional)"} name="opening_id" required={required} options={[
    { value: "", text: required ? "Select an opening" : "Save to Talent Pool" },
    ...openings.filter((opening) => opening.status !== "Closed").map((opening) => ({
      value: opening.id, text: opening.title + " · " + opening.division,
    })),
  ]} {...props} />;
}

function CandidateForm({ application, poolCandidate, openings }) {
  const [openingId, setOpeningId] = useState("");
  const candidate = application?.candidate ?? poolCandidate;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!candidate && openings.some((opening) => opening.status !== "Closed") && (
        <OpeningSelect openings={openings} value={openingId} onChange={(event) => setOpeningId(event.target.value)} />
      )}
      <CandidateProfileFields candidate={candidate} />
      {(application || openingId) && <ApplicationFields application={application} />}
    </div>
  );
}

function ApplicationFields({ application }) {
  const applicationFields = [
    ["Source", "source", 120], ["Experience", "experience", 120],
    ["Notice period", "notice_period", 80], ["Expected CTC", "expected_ctc", 80],
  ];
  return (
    <>
      {application && applicationFields.some(([, name]) => application[name]) && (
        <details className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Existing application details</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {applicationFields.map(([label, name, maxLength]) => (
              <Field key={name} label={label} name={name} defaultValue={application[name]} maxLength={maxLength} />
            ))}
          </div>
        </details>
      )}
      <Field label="Stage" name="stage" defaultValue={application?.stage || "Applied"} options={stages} />
      <div className="sm:col-span-2">
        <Field label="Next action" name="next_action" defaultValue={application?.next_action || ""} maxLength={250} />
      </div>
      <div className="sm:col-span-2">
        <Field label="Application notes" name="notes" defaultValue={application?.notes || ""} multiline maxLength={5000} />
      </div>
    </>
  );
}

function ScheduleForm({ opening, interview, round }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Interview round" name="round_name" defaultValue={interview?.round_name || round} options={interview ? [interview.round_name] : opening.rounds} required />
      </div>
      <Field label="Start time (IST)" name="starts_at" defaultValue={localDateTime(interview?.starts_at)} type="datetime-local" required />
      <Field label="End time (IST)" name="ends_at" defaultValue={localDateTime(interview?.ends_at)} type="datetime-local" required />
      <div className="sm:col-span-2">
        <Field label="Teams or meeting link" name="meeting_url" defaultValue={interview?.meeting_url || ""} type="url" />
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2">Interview email goes to {opening.hr_owner_email} and {opening.manager_email}.</p>
    </div>
  );
}

function ReviewForm({ interview }) {
  const [attendance, setAttendance] = useState(interview.attendance);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Attendance" name="attendance" value={attendance} onChange={(event) => setAttendance(event.target.value)}
        options={interview.attendance === "Cancelled" ? ["Cancelled"] : [interview.attendance, "Attended", "No Show", "Cancelled"].filter((value, index, list) => list.indexOf(value) === index)} />
      <Field label="Result" name="result" key={attendance === "Attended" ? "attended" : "pending"}
        defaultValue={attendance === "Attended" ? interview.result : "Pending"} options={attendance === "Attended" ? ["Pending", "Passed", "Failed", "On Hold"] : ["Pending"]} />
      <div className="sm:col-span-2">
        <Field label="Interview feedback" name="feedback" defaultValue={interview.feedback || ""} multiline maxLength={5000} />
      </div>
    </div>
  );
}

export default function Hiring() {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryId, setRetryId] = useState(null);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      setData(await api("/hiring", { signal, cache: "no-store" }));
    } catch (err) {
      if (!signal?.aborted) setLoadError(err.message || "Could not load hiring records.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openingById = new Map(data.openings.map((opening) => [opening.id, opening]));
  const selected = data.applications.find((application) => application.id === selectedId);
  const selectedOpening = selected && openingById.get(selected.opening_id);
  const interviews = data.applications.flatMap((application) => application.interviews.map((interview) => ({
    ...interview, application, opening: openingById.get(application.opening_id),
  }))).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const today = portalDate();
  const todayCount = interviews.filter((interview) => interview.attendance === "Scheduled" && portalDate(new Date(interview.starts_at)) === today).length;
  const pending = interviews.filter((interview) => interview.attendance === "Attended" && (interview.result === "Pending" || !interview.feedback)).length;
  const candidates = data.applications.filter((application) => [
    application.candidate.name, application.candidate.email, openingById.get(application.opening_id)?.title, application.stage,
  ].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())));
  const upcoming = interviews.filter((interview) => interview.attendance === "Scheduled" && Date.parse(interview.ends_at) >= Date.now());
  const hasCandidateOpening = data.openings.some((opening) => opening.status !== "Closed");
  const openVacancies = data.openings.filter((opening) => opening.status === "Open").reduce((total, opening) => {
    const joined = data.applications.filter((application) => application.opening_id === opening.id && application.stage === "Joined").length;
    return total + Math.max(0, opening.vacancies - joined);
  }, 0);

  function openDialog(next) {
    setFormError("");
    setDialog(next);
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const read = (key) => String(form.get(key) ?? "").trim();
    const optional = (key) => read(key) || null;
    setBusy(true);
    setFormError("");
    try {
      if (dialog.type === "opening") {
        await api(dialog.opening ? "/hiring/openings/" + dialog.opening.id : "/hiring/openings", {
          method: dialog.opening ? "PUT" : "POST",
          body: {
            title: read("title"), division: read("division"), vacancies: Number(read("vacancies")),
            status: read("status"), target_joining_date: optional("target_joining_date"),
            manager_id: Number(read("manager_id")), hr_owner_id: read("hr_owner_id") ? Number(read("hr_owner_id")) : null,
            rounds: read("rounds").split(/\r?\n/).map((round) => round.trim()).filter(Boolean),
          },
        });
        setTab("Openings");
      } else if (dialog.type === "candidate") {
        const candidate = {
          name: read("name"), email: read("email"), phone: optional("phone"), resume_url: optional("resume_url"),
          profile: readCandidateProfile(form),
        };
        if (!dialog.application && !read("opening_id")) {
          await api(dialog.poolCandidate ? "/hiring/candidates/" + dialog.poolCandidate.id : "/hiring/candidates", {
            method: dialog.poolCandidate ? "PUT" : "POST",
            body: candidate,
          });
          setTab("Talent Pool");
        } else {
          const result = await api(dialog.application ? "/hiring/applications/" + dialog.application.id : "/hiring/applications", {
            method: dialog.application ? "PUT" : "POST",
            body: {
              ...(!dialog.application ? { opening_id: Number(read("opening_id")) } : {}),
              candidate, stage: read("stage"),
              source: optional("source"), experience: optional("experience"),
              notice_period: optional("notice_period"), expected_ctc: optional("expected_ctc"),
              next_action: optional("next_action"), notes: optional("notes"),
            },
          });
          setSearch("");
          setSelectedId(result.id);
          setTab("Candidates");
        }
      } else if (dialog.type === "delete") {
        const candidateId = dialog.poolCandidate.id;
        await api("/hiring/candidates/" + candidateId, { method: "DELETE" });
        setData((current) => ({
          ...current,
          talent_pool: current.talent_pool.filter((candidate) => candidate.id !== candidateId),
        }));
      } else if (dialog.type === "link") {
        const result = await api("/hiring/candidates/" + dialog.poolCandidate.id + "/applications", {
          method: "POST",
          body: { opening_id: Number(read("opening_id")) },
        });
        setSearch("");
        setSelectedId(result.id);
        setTab("Candidates");
      } else if (dialog.type === "schedule") {
        await api("/hiring/applications/" + dialog.application.id + "/interviews", {
          method: "PUT",
          body: {
            round_name: read("round_name"), starts_at: read("starts_at") + ":00+05:30",
            ends_at: read("ends_at") + ":00+05:30", meeting_url: optional("meeting_url"),
          },
        });
      } else {
        await api("/hiring/interviews/" + dialog.interview.id + "/review", {
          method: "PUT",
          body: { attendance: read("attendance"), result: read("result"), feedback: optional("feedback") },
        });
      }
      setDialog(null);
      await load();
    } catch (err) {
      setFormError(err.message || (dialog.type === "delete" ? "Could not delete the candidate." : "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  async function retryEmail(notificationId) {
    setRetryId(notificationId);
    try {
      await api("/hiring/notifications/" + notificationId + "/retry", { method: "POST" });
      await load();
    } catch (err) {
      setLoadError(err.message || "Could not retry email.");
    } finally {
      setRetryId(null);
    }
  }

  const deletingCandidate = dialog?.type === "delete";
  const dialogTitle = dialog && {
    delete: "Delete candidate",
    opening: dialog.opening ? "Edit opening" : "New opening",
    candidate: dialog.application ? "Edit candidate application" : dialog.poolCandidate ? "Edit candidate" : "Add candidate",
    link: "Link candidate to opening",
    profile: dialog.poolCandidate?.name,
    schedule: dialog.interview ? "Reschedule interview" : "Schedule interview",
    review: "Record interview outcome",
  }[dialog.type];

  return (
    <AppShell title="Hiring" subtitle="Manage openings, candidates, and interviews" actions={
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} onClick={() => load()} disabled={loading}>Refresh</button>
        <button type="button" className={secondary} onClick={() => openDialog({ type: "candidate" })} disabled={loading}>+ Add Candidate</button>
        <button type="button" className={primary} onClick={() => openDialog({ type: "opening" })} disabled={loading}>+ New Opening</button>
      </div>
    }>
      <div className="space-y-4">
        <nav aria-label="Hiring views" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {tabs.map((view) => (
            <button key={view} type="button" aria-pressed={view === tab} onClick={() => setTab(view)}
              className={"rounded-lg px-3 py-2 text-xs font-semibold " + (view === tab ? "btn-brand-gradient text-white" : "text-slate-600 hover:bg-slate-50")}>
              {view}
            </button>
          ))}
        </nav>
        {loadError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</p>}
        {loading ? <p className={panel}>Loading hiring records…</p> : tab === "Overview" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Open Vacancies", openVacancies],
                ["Applications", data.applications.length],
                ["Interviews Today", todayCount],
                ["Feedback Pending", pending],
              ].map(([label, count]) => (
                <div key={label} className={panel}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900">{count}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={panel}>
                <h2 className="mb-3 font-semibold text-slate-900">Candidate Pipeline</h2>
                <ul className="divide-y divide-slate-100">
                  {stages.map((stage) => <li className="flex justify-between py-2 text-sm" key={stage}>
                    <span>{stage}</span><span className="font-semibold">{data.applications.filter((application) => application.stage === stage).length}</span>
                  </li>)}
                </ul>
              </section>
              <section className={panel}>
                <h2 className="mb-3 font-semibold text-slate-900">Upcoming Interviews</h2>
                {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming interviews.</p>}
                <ul className="divide-y divide-slate-100">
                  {upcoming.slice(0, 5).map((interview) => <li key={interview.id} className="py-2 text-sm">
                    <div className="font-semibold">{interview.application.candidate.name} · {interview.round_name}</div>
                    <div className="text-xs text-slate-500">{interviewDate(interview.starts_at)}</div>
                  </li>)}
                </ul>
              </section>
            </div>
          </>
        ) : tab === "Openings" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.openings.length === 0 && <p className={panel}>No hiring openings yet.</p>}
            {data.openings.map((opening) => {
              const applications = data.applications.filter((application) => application.opening_id === opening.id);
              return (
                <section className={panel} key={opening.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h2 className="font-semibold text-slate-900">{opening.title}</h2><p className="text-xs text-slate-500">{opening.division} · {opening.vacancies} vacancies</p></div>
                    <Badge>{opening.status}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div>HR owner · {opening.hr_owner_email}</div>
                    <div>Assigned manager · {opening.manager_email}</div>
                    {opening.target_joining_date && <div>Target joining · {opening.target_joining_date}</div>}
                  </div>
                  <p className="mt-3 break-words text-sm text-slate-700">{opening.rounds.join(" → ")}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-600">{applications.length} applications · {applications.filter((application) => application.stage === "Joined").length} joined</span>
                    <button className={secondary} type="button" onClick={() => openDialog({ type: "opening", opening })}>Edit Opening</button>
                  </div>
                </section>
              );
            })}
          </div>
        ) : tab === "Talent Pool" ? (
          <section className={panel}>
            <h2 className="mb-3 font-semibold text-slate-900">Talent Pool</h2>
            {data.talent_pool.length === 0 && <p className="text-sm text-slate-500">No candidates waiting for an opening.</p>}
            <ul className="divide-y divide-slate-100">
              {data.talent_pool.map((candidate) => (
                <li key={candidate.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 break-words text-sm">
                    <div className="font-semibold">{candidate.name}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {[candidate.profile?.preferred_position, candidate.profile?.city, candidateExperience(candidate.profile)].filter(Boolean).join(" · ") || candidate.email}
                    </div>
                    {candidate.resume_url && <a className="mt-1 inline-block text-xs text-rose-700 underline" target="_blank" rel="noreferrer" href={candidate.resume_url}>Open résumé</a>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondary} onClick={() => openDialog({ type: "profile", poolCandidate: candidate })}>View Profile</button>
                    <button type="button" className={secondary} onClick={() => openDialog({ type: "candidate", poolCandidate: candidate })}>Edit</button>
                    {hasCandidateOpening ? (
                      <button type="button" className={secondary} onClick={() => openDialog({ type: "link", poolCandidate: candidate })}>Link to Opening</button>
                    ) : <span className="self-center text-xs text-slate-500">Waiting for an opening</span>}
                    <button type="button" className={danger} aria-label={"Delete " + candidate.name}
                      onClick={() => openDialog({ type: "delete", poolCandidate: candidate })}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : tab === "Candidates" ? (
          <div className="space-y-4">
            <label className="sr-only" htmlFor="candidate-search">Search candidates</label>
            <input id="candidate-search" className={fieldClass + " max-w-md"} placeholder="Search name, email, role, or stage" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="card-pastel overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className={tableHead}><tr>{["Candidate", "Opening", "Stage", "Next Interview", "Action"].map((label) => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((application) => {
                    const next = application.interviews.find((interview) => interview.attendance === "Scheduled");
                    return (
                      <tr key={application.id} className={application.id === selectedId ? "bg-rose-50/30" : ""}>
                        <td className={cell}><div className="font-semibold">{application.candidate.name}</div><div className="text-xs text-slate-500">{application.candidate.email}</div></td>
                        <td className={cell}>{openingById.get(application.opening_id)?.title}</td>
                        <td className={cell}><Badge>{application.stage}</Badge></td>
                        <td className={cell + " whitespace-nowrap text-xs"}>{next ? interviewDate(next.starts_at) : "—"}</td>
                        <td className={cell}><button className={secondary} type="button" onClick={() => setSelectedId(application.id)}>View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {candidates.length === 0 && <p className="p-4 text-sm text-slate-500">No matching candidates.</p>}
            </div>
            {selected && selectedOpening && (
              <section className={panel}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900">{selected.candidate.name}</h2>
                    <p className="text-xs text-slate-500">{selectedOpening.title} · {selected.interviews.filter((interview) => interview.attendance === "Attended").length} of {selectedOpening.rounds.length} rounds attended</p>
                  </div>
                  <button className={secondary} type="button" onClick={() => openDialog({ type: "candidate", application: selected })}>Edit Application</button>
                </div>
                <CandidateProfileDetails candidate={selected.candidate} />
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                  {[
                    ["Application source", selected.source], ["Reported experience", selected.experience],
                    ["Application notice period", selected.notice_period], ["Application expected CTC", selected.expected_ctc],
                    ["Next action", selected.next_action], ["Application notes", selected.notes],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label}><dt className="font-semibold text-slate-700">{label}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-slate-600">{value}</dd></div>
                  ))}
                </dl>
                <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-900">Interview Rounds</h3>
                <ol className="divide-y divide-slate-100">
                  {selectedOpening.rounds.map((round) => {
                    const interview = selected.interviews.find((item) => item.round_name === round);
                    const canSchedule = selectedOpening.status !== "Closed" && !["Joined", "Rejected", "Withdrawn"].includes(selected.stage);
                    return (
                      <li key={round} className="flex flex-wrap items-start justify-between gap-2 py-3 text-xs">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{round}</span>
                            <Badge>{interview?.attendance || "Yet to Schedule"}</Badge>
                            {interview?.attendance === "Attended" && <Badge>{interview.result}</Badge>}
                          </div>
                          {interview && <div className="text-slate-500">{interviewDate(interview.starts_at)}</div>}
                          {interview?.feedback && <p className="break-words whitespace-pre-wrap text-slate-700">{interview.feedback}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canSchedule && interview?.attendance !== "Attended" && <button className={secondary} type="button" onClick={() => openDialog({
                            type: "schedule", application: selected, opening: selectedOpening, interview, round,
                          })}>{interview ? "Reschedule" : "Schedule"}</button>}
                          {interview && <button className={secondary} type="button" onClick={() => openDialog({ type: "review", interview })}>Record Outcome</button>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        ) : (
          <section className={panel}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Interview Schedule</h2>
              <span className="text-xs text-slate-500">India Standard Time</span>
            </div>
            {interviews.length === 0 && <p className="text-sm text-slate-500">Schedule a round from a candidate’s application.</p>}
            <ul className="divide-y divide-slate-100">
              {interviews.map((interview) => {
                const latest = interview.notifications[0];
                return (
                  <li className="flex flex-wrap justify-between gap-3 py-3" key={interview.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">{interview.application.candidate.name}</span>
                        <Badge>{interview.attendance}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{interview.opening?.title} · {interview.round_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{interviewDate(interview.starts_at)} – {clockFormatter.format(new Date(interview.ends_at))} IST{portalDate(new Date(interview.ends_at)) !== portalDate(new Date(interview.starts_at)) && " · " + portalDate(new Date(interview.ends_at))}</p>
                      {interview.meeting_url && interview.attendance !== "Cancelled" && <a className="mt-1 inline-block text-xs text-rose-700 underline" target="_blank" rel="noreferrer" href={interview.meeting_url}>Open meeting link</a>}
                      {latest && <div className="mt-2 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5"><span>{latest.event} email</span><Badge>{latest.status}</Badge></div>
                        {latest.error && <p className="text-rose-800">{latest.error}</p>}
                      </div>}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <button className={secondary} type="button" onClick={() => { setSearch(""); setSelectedId(interview.application.id); setTab("Candidates"); }}>View Candidate</button>
                      {latest && ["Failed", "Pending"].includes(latest.status) && <button className={secondary} type="button" onClick={() => retryEmail(latest.id)} disabled={retryId === latest.id}>{retryId === latest.id ? "Retrying…" : "Retry Email"}</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-2 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="hiring-dialog-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 id="hiring-dialog-title" className="font-bold text-slate-900">{dialogTitle}</h2>
              <button type="button" aria-label="Close hiring form" onClick={() => setDialog(null)} disabled={busy} className="rounded px-2 text-slate-500 hover:bg-slate-100">×</button>
            </div>
            {dialog.type === "profile" ? (
              <CandidateProfileDetails candidate={dialog.poolCandidate} />
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {dialog.type === "opening" && <OpeningForm opening={dialog.opening} managers={data.managers} />}
                {dialog.type === "candidate" && <CandidateForm application={dialog.application} poolCandidate={dialog.poolCandidate} openings={data.openings} />}
                {dialog.type === "link" && <OpeningSelect openings={data.openings} required />}
                {dialog.type === "schedule" && <ScheduleForm opening={dialog.opening} interview={dialog.interview} round={dialog.round} />}
                {dialog.type === "review" && <ReviewForm interview={dialog.interview} />}
                {deletingCandidate && (
                  <p className="text-sm text-slate-700">
                    Permanently delete <strong>{dialog.poolCandidate.name}</strong> ({dialog.poolCandidate.email}) from the Talent Pool?
                  </p>
                )}
                {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className={secondary} disabled={busy} onClick={() => setDialog(null)}>{deletingCandidate ? "Cancel" : "Close"}</button>
                  {deletingCandidate ? (
                    <button type="submit" className={danger} disabled={busy}>{busy ? "Deleting…" : "Delete candidate"}</button>
                  ) : (
                    <button type="submit" className={primary} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                  )}
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
