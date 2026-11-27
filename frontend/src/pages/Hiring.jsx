import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { api } from "../lib/api";
import { portalDate } from "../lib/portalDate";
import { candidateExperience, CandidateProfileDetails, Field } from "./HiringCandidateProfile";

const tabs = ["Openings", "Candidates"];
const stages = ["Applied", "Screening", "Tests", "Interviewing", "Offer", "Joined", "Not Shortlisted", "Rejected", "Withdrawn"];
const decisions = ["In Process", "Hired", "Not Hired", "Candidate Refusal"];
const sources = ["LinkedIn", "Job Portal", "Referral", "Direct", "Other"];
const noValue = { value: "", text: "Select" };
const initialData = { domains: [], openings: [], applications: [], talent_pool: [] };
const primary = "btn-brand-gradient rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const danger = "rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50";
const cell = "px-3 py-3 align-top";
const shortDate = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const interviewDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

function displayDate(value) {
  return value ? shortDate.format(new Date(value)) : "—";
}

function Badge({ value }) {
  if (!value) return "—";
  const colors = {
    Open: "bg-emerald-50 text-emerald-800",
    Hired: "bg-emerald-50 text-emerald-800",
    Joined: "bg-emerald-50 text-emerald-800",
    "On Hold": "bg-amber-50 text-amber-800",
    "In Process": "bg-amber-50 text-amber-800",
    Interviewing: "bg-sky-50 text-sky-800",
    "Not Hired": "bg-rose-50 text-rose-800",
    "Not Shortlisted": "bg-rose-50 text-rose-800",
    "Candidate Refusal": "bg-rose-50 text-rose-800",
    Rejected: "bg-rose-50 text-rose-800",
  }[value] || "bg-slate-100 text-slate-700";
  return <span className={"inline-block rounded-md px-2 py-1 text-xs font-semibold " + colors}>{value}</span>;
}

function TrackerTable({ label, columns, children, empty, minWidth }) {
  return (
    <div className="card-pastel overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className={"w-full text-left text-sm text-slate-700 " + minWidth}>
        <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>{columns.map((column) => <th key={column} className="px-3 py-3" scope="col">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {empty ? <tr><td colSpan={columns.length} className="p-5 text-slate-500">{empty}</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
}

function OpeningDomainField({ domains, initialValue, onAdd, busy }) {
  const [domain, setDomain] = useState(() =>
    domains.find((name) => name.toLowerCase() === initialValue?.toLowerCase()) || initialValue || "",
  );
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matches = domains.filter((name) => name.toLowerCase().includes(normalizedQuery));

  function selectDomain(name) {
    setDomain(name);
    setExpanded(false);
    setAdding(false);
    setQuery("");
    setError("");
  }

  async function addDomain() {
    const name = newName.trim();
    if (!name || busy) return;
    setError("");
    try {
      selectDomain(await onAdd(name));
    } catch (failure) {
      setError(failure.message || "Could not add the domain.");
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      if (adding) addDomain();
    } else if (event.key === "Escape" && expanded && !busy) {
      event.preventDefault();
      setExpanded(false);
      setAdding(false);
      event.currentTarget.querySelector("button")?.focus();
    }
  }

  return (
    <div className="min-w-0" onKeyDown={handleKeyDown}>
      <label htmlFor="opening-domain" className="mb-1.5 block text-xs font-semibold text-slate-700">Domain</label>
      <input type="hidden" name="domain" value={domain} />
      <button id="opening-domain" type="button" disabled={busy} aria-expanded={expanded} aria-controls="opening-domain-options"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-rose-400"
        onClick={() => { setExpanded(!expanded); setAdding(false); setError(""); }}>
        <span className={domain ? "" : "text-slate-500"}>{domain || "Select a domain"}</span>
        <span aria-hidden="true" className="text-slate-500">{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded && (
        <div id="opening-domain-options" className="mt-1 space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {adding ? (
            <div className="space-y-2">
              <Field label="New domain name" value={newName} onChange={(event) => setNewName(event.target.value)}
                disabled={busy} maxLength={80} autoFocus />
              {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={primary} disabled={busy || !newName.trim()} onClick={addDomain}>Save domain</button>
                <button type="button" className={secondary} disabled={busy} onClick={() => setAdding(false)}>Back to domains</button>
              </div>
            </div>
          ) : (
            <>
              <Field label="Search domains" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name" autoFocus />
              {matches.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto">
                  {matches.map((name) => (
                    <li key={name}>
                      <button type="button" aria-pressed={domain === name}
                        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 aria-pressed:bg-rose-50 aria-pressed:text-rose-800"
                        onClick={() => selectDomain(name)}>{name}</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-2 py-1 text-xs text-slate-500">No matching domains.</p>}
              <button type="button" className={secondary}
                onClick={() => { setNewName(query.trim()); setError(""); setAdding(true); }}>+ Add Domain</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OpeningForm({ opening, domains, onAddDomain, busy }) {
  const today = portalDate();
  const earliest = opening?.closing_date && opening.closing_date < today ? opening.closing_date : today;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Company" name="division" defaultValue={opening?.division} required maxLength={80} />
      <OpeningDomainField domains={domains} initialValue={opening?.domain} onAdd={onAddDomain} busy={busy} />
      <Field label="Role" name="title" defaultValue={opening?.title} required minLength={2} maxLength={150} />
      <Field label="Experience required" name="experience_required" defaultValue={opening?.experience_required}
        placeholder="e.g. Fresher or 3+ years" required maxLength={120} />
      <Field label="Closing date (IST)" name="closing_date" defaultValue={opening?.closing_date} min={earliest} type="date" required />
    </div>
  );
}

function OpeningSelect({ openings, required = false, ...props }) {
  return (
    <Field label="Job opening" name="opening_id" required={required} options={[
      { value: "", text: required ? "Select an opening" : "No opening yet" },
      ...openings.map((opening) => ({ value: opening.id, text: "#" + opening.id + " · " + opening.division + " · " + opening.title })),
    ]} {...props} />
  );
}

function CandidateForm({ row, openings }) {
  const [openingId, setOpeningId] = useState("");
  const [source, setSource] = useState(row?.source || "");
  const editing = Boolean(row);
  const linked = Boolean(row?.application || openingId);
  const originalSource = row?.source;
  const sourceOptions = originalSource && !sources.includes(originalSource) ? [...sources, originalSource] : sources;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Candidate name" name="name" defaultValue={row?.candidate.name} required maxLength={150} />
      {editing ? (
        row.application
          ? <Field label="Role applied for" defaultValue={row.role} readOnly />
          : <Field label="Role" name="role" defaultValue={row.role} required maxLength={150} />
      ) : <OpeningSelect openings={openings} value={openingId} onChange={(event) => setOpeningId(event.target.value)} />}
      {!editing && !linked && <Field label="Role" name="role" required maxLength={150} />}
      <Field label="Experience" name="experience" defaultValue={row?.experience} placeholder="e.g. Fresher or 3 years"
        required={!editing} maxLength={120} />
      <Field label="Source" name="source" value={source} onChange={(event) => setSource(event.target.value)} options={[noValue, ...sourceOptions]} />
      {source === "Referral" && <Field label="Referred by" name="referred_by" defaultValue={row?.referredBy} maxLength={150} />}
      <Field label="Applied date" name="applied_on" defaultValue={editing ? row.appliedOn : portalDate()} type="date" />
      {linked && (
        <>
          <Field label="Selection phase" name="stage" defaultValue={row?.application?.stage || "Applied"} options={stages} />
          <Field label="Decision" name="decision" defaultValue={row?.application?.decision || ""} options={[noValue, ...decisions]} />
          <Field label="Decision date" name="decision_on" defaultValue={row?.application?.decision_on} type="date" />
        </>
      )}
      <div className="sm:col-span-2">
        <Field label="Comments" name="notes" defaultValue={row?.comments} multiline maxLength={5000} />
      </div>
    </div>
  );
}

function candidateRow(candidate, application, opening) {
  const profile = candidate.profile;
  const details = application ?? candidate.intake ?? {
    experience: candidateExperience(profile), source: profile?.source, notes: profile?.notes,
  };
  return {
    candidate, application, opening,
    role: opening?.title ?? candidate.intake?.role ?? candidate.profile?.preferred_position,
    experience: details.experience,
    source: details.source,
    referredBy: details.referred_by,
    appliedOn: details.applied_on,
    comments: details.notes,
  };
}

function CandidateHistory({ row }) {
  const interviews = row.application?.interviews ?? [];
  return (
    <div className="space-y-4">
      {(row.candidate.profile || row.candidate.email || row.candidate.phone || row.candidate.resume_url) &&
        <CandidateProfileDetails candidate={row.candidate} />}
      {interviews.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-slate-900">Interviews</h3>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3">
            {interviews.map((interview) => (
              <li key={interview.id} className="space-y-1 py-3 text-sm">
                <p className="font-semibold text-slate-800">{interview.round_name}</p>
                <p>{interviewDate.format(new Date(interview.starts_at))} IST · {interview.attendance} · {interview.result}</p>
                {interview.feedback && <p className="whitespace-pre-wrap break-words text-slate-600">{interview.feedback}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Hiring() {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("Candidates");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await api("/hiring", { signal, cache: "no-store" }));
    } catch (error) {
      if (!signal?.aborted) setLoadError(error.message || "Could not load hiring records.");
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
  const openingsWithApplications = new Set(data.applications.map((application) => application.opening_id));
  const today = portalDate();
  const acceptingCandidates = data.openings.filter((opening) =>
    opening.status === "Open" && (!opening.closing_date || opening.closing_date >= today),
  );
  const query = search.trim().toLowerCase();
  const rows = [
    ...data.applications.map((application) => candidateRow(application.candidate, application, openingById.get(application.opening_id))),
    ...data.talent_pool.map((candidate) => candidateRow(candidate)),
  ].filter((row) => [row.candidate.name, row.opening?.division, row.opening?.domain, row.role, row.source, row.referredBy]
    .some((value) => value?.toLowerCase().includes(query)));

  function showDialog(next) {
    setFormError("");
    setDialog(next);
  }

  async function addOpeningDomain(name) {
    setBusy(true);
    try {
      const saved = await api("/hiring/domains", { method: "POST", body: { name } });
      setData((current) => ({
        ...current,
        domains: [...new Set([...(current.domains ?? []), saved.name])].sort((a, b) => a.localeCompare(b)),
      }));
      return saved.name;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const read = (name) => String(form.get(name) ?? "").trim();
    const optional = (name) => read(name) || null;
    setFormError("");
    setBusy(true);
    try {
      if (dialog.type === "opening") {
        const opening = dialog.opening;
        const domain = read("domain");
        if (!domain) throw new Error("Select or add a domain.");
        await api(opening ? "/hiring/openings/" + opening.id : "/hiring/openings", {
          method: opening ? "PUT" : "POST",
          body: {
            title: read("title"), division: read("division"), domain,
            experience_required: read("experience_required"), closing_date: read("closing_date"),
          },
        });
        setTab("Openings");
      } else if (dialog.type === "candidate") {
        const row = dialog.row;
        const candidate = { name: read("name") };
        const openingId = Number(read("opening_id"));
        const tracking = {
          experience: optional("experience"), source: optional("source"), referred_by: optional("referred_by"),
          applied_on: optional("applied_on"), notes: optional("notes"),
        };
        if (row?.application || openingId) {
          const application = row?.application;
          await api(application ? "/hiring/applications/" + application.id : "/hiring/applications", {
            method: application ? "PUT" : "POST",
            body: {
              ...(!application && { opening_id: openingId }),
              candidate, ...tracking, stage: read("stage"), decision: optional("decision"), decision_on: optional("decision_on"),
            },
          });
        } else {
          await api(row ? "/hiring/candidates/" + row.candidate.id : "/hiring/candidates", {
            method: row ? "PUT" : "POST", body: { ...candidate, intake: { role: read("role"), ...tracking } },
          });
        }
        setTab("Candidates");
        setSearch("");
      } else if (dialog.type === "link") {
        await api("/hiring/candidates/" + dialog.row.candidate.id + "/applications", {
          method: "POST", body: { opening_id: Number(read("opening_id")) },
        });
      } else if (dialog.type === "close") {
        await api("/hiring/openings/" + dialog.opening.id + "/close", { method: "POST" });
      } else if (dialog.type === "deleteOpening") {
        const openingId = dialog.opening.id;
        await api("/hiring/openings/" + openingId, { method: "DELETE" });
        setData((current) => ({
          ...current, openings: current.openings.filter((opening) => opening.id !== openingId),
        }));
      } else if (dialog.type === "delete") {
        const candidateId = dialog.row.candidate.id;
        await api("/hiring/candidates/" + candidateId, { method: "DELETE" });
        setData((current) => ({
          ...current, talent_pool: current.talent_pool.filter((candidate) => candidate.id !== candidateId),
        }));
      }
      setDialog(null);
      await load();
    } catch (error) {
      setFormError(error.message || "Could not update the hiring record.");
    } finally {
      setBusy(false);
    }
  }

  const dialogTitle = dialog && {
    opening: dialog.opening ? "Edit opening" : "New opening",
    candidate: dialog.row ? "Edit candidate" : "Add candidate",
    close: "Close opening",
    deleteOpening: "Delete opening",
    delete: "Delete candidate",
    link: "Link candidate to an opening",
    history: "Candidate history",
  }[dialog.type];
  const destructive = ["close", "deleteOpening", "delete"].includes(dialog?.type);

  return (
    <AppShell title="Hiring" actions={
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} onClick={() => load()} disabled={loading || busy}>Refresh</button>
        <button type="button" className={secondary} onClick={() => showDialog({ type: "candidate" })} disabled={loading || busy}>+ Add Candidate</button>
        <button type="button" className={primary} onClick={() => showDialog({ type: "opening" })} disabled={loading || busy}>+ New Opening</button>
      </div>
    }>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Hiring views" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {tabs.map((view) => (
              <button key={view} type="button" aria-pressed={view === tab} onClick={() => setTab(view)}
                className={"rounded-lg px-3 py-2 text-xs font-semibold " + (view === tab ? "btn-brand-gradient text-white" : "text-slate-600 hover:bg-slate-50")}>
                {view}
              </button>
            ))}
          </nav>
          {tab === "Candidates" && (
            <label className="w-full sm:w-72">
              <span className="sr-only">Search candidates</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, company, or role"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          )}
        </div>
        {loadError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</p>}
        {loading ? <p role="status" className="p-4 text-sm text-slate-500">Loading hiring records…</p> : tab === "Openings" ? (
          <TrackerTable label="Job openings" minWidth="min-w-[780px]" empty={!data.openings.length && "No job openings yet."}
            columns={["Job ID", "Company", "Domain", "Role", "Experience Required", "Closing Date", "Status", "Actions"]}>
            {data.openings.map((opening) => (
              <tr key={opening.id}>
                <td className={cell + " whitespace-nowrap"}>#{opening.id}</td>
                <td className={cell}>{opening.division}</td>
                <td className={cell}>{opening.domain || "—"}</td>
                <td className={cell + " font-semibold text-slate-900"}>{opening.title}</td>
                <td className={cell}>{opening.experience_required || "—"}</td>
                <td className={cell + " whitespace-nowrap"}>{displayDate(opening.closing_date)}</td>
                <td className={cell}><Badge value={opening.status} /></td>
                <td className={cell}>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={secondary} onClick={() => showDialog({ type: "opening", opening })}>Edit</button>
                    {opening.status !== "Closed" && (
                      <button type="button" className={danger} onClick={() => showDialog({ type: "close", opening })}>Close Opening</button>
                    )}
                    {!openingsWithApplications.has(opening.id) && (
                      <button type="button" className={danger} aria-label={"Delete opening " + opening.title}
                        onClick={() => showDialog({ type: "deleteOpening", opening })}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </TrackerTable>
        ) : (
          <TrackerTable label="Candidate tracker" minWidth="min-w-[1080px]" empty={!rows.length && (query ? "No matching candidates." : "No candidates yet.")}
            columns={["Job ID", "Company", "Role Applied For", "Candidate Name", "Experience", "Source", "Applied Date", "Selection Phase", "Decision", "Decision Date", "Comments", "Actions"]}>
            {rows.map((row) => {
              const { application, candidate, opening } = row;
              const hasHistory = candidate.profile || candidate.email || candidate.phone || candidate.resume_url || application?.interviews.length;
              return (
                <tr key={application ? "application-" + application.id : "candidate-" + candidate.id}>
                  <td className={cell + " whitespace-nowrap"}>{opening ? "#" + opening.id : "—"}</td>
                  <td className={cell}>{opening?.division || "—"}</td>
                  <td className={cell}>{row.role || "—"}</td>
                  <td className={cell + " font-semibold text-slate-900"}>{candidate.name}</td>
                  <td className={cell}>{row.experience || "—"}</td>
                  <td className={cell}>{row.source || "—"}{row.referredBy && <div className="text-xs text-slate-500">{row.referredBy}</div>}</td>
                  <td className={cell + " whitespace-nowrap"}>{displayDate(row.appliedOn)}</td>
                  <td className={cell}><Badge value={application?.stage || "Talent Pool"} /></td>
                  <td className={cell}><Badge value={application?.decision} /></td>
                  <td className={cell + " whitespace-nowrap"}>{displayDate(application?.decision_on)}</td>
                  <td className={cell}><p className="min-w-24 max-w-56 whitespace-pre-wrap break-words">{row.comments || "—"}</p></td>
                  <td className={cell}>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={secondary} onClick={() => showDialog({ type: "candidate", row })}>Edit</button>
                      {Boolean(hasHistory) && <button type="button" className={secondary} onClick={() => showDialog({ type: "history", row })}>History</button>}
                      {!application && acceptingCandidates.length > 0 && (
                        <button type="button" className={secondary} onClick={() => showDialog({ type: "link", row })}>Link</button>
                      )}
                      {!application && <button type="button" className={danger} onClick={() => showDialog({ type: "delete", row })}>Delete</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </TrackerTable>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-2 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="hiring-dialog-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <header className="mb-4 flex justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 id="hiring-dialog-title" className="font-bold text-slate-900">{dialogTitle}</h2>
              <button type="button" aria-label="Close dialog" onClick={() => setDialog(null)} disabled={busy}
                className="rounded px-2 text-slate-500 hover:bg-slate-100">×</button>
            </header>
            {dialog.type === "history" ? <CandidateHistory row={dialog.row} /> : (
              <form onSubmit={submit} className="space-y-4">
                {dialog.type === "opening" && (
                  <OpeningForm opening={dialog.opening} domains={data.domains ?? []} onAddDomain={addOpeningDomain} busy={busy} />
                )}
                {dialog.type === "candidate" && <CandidateForm row={dialog.row} openings={acceptingCandidates} />}
                {dialog.type === "link" && <OpeningSelect openings={acceptingCandidates} required />}
                {dialog.type === "close" && (
                  <p className="text-sm text-slate-700">Close <strong>{dialog.opening.title}</strong> at {dialog.opening.division}?</p>
                )}
                {dialog.type === "deleteOpening" && (
                  <p className="text-sm text-slate-700">
                    Permanently delete <strong>{dialog.opening.title}</strong> at {dialog.opening.division}?
                  </p>
                )}
                {dialog.type === "delete" && (
                  <p className="text-sm text-slate-700">Permanently delete <strong>{dialog.row.candidate.name}</strong> from the Talent Pool?</p>
                )}
                {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className={secondary} disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
                  <button type="submit" className={destructive ? danger : primary} disabled={busy}>
                    {busy ? "Saving…" : destructive ? dialogTitle : "Save"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
