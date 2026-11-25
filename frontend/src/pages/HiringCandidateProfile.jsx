import { useRef, useState } from "react";

export const fieldClass = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-rose-400";

const positionsByCategory = {
  "Software Engineering": ["Frontend Developer", "Backend Developer", "Full Stack Developer", "Mobile Developer"],
  Design: ["UI/UX Designer", "Product Designer", "Graphic Designer"],
  "QA / Testing": ["Manual Tester", "QA Engineer", "Automation Tester"],
  "Data / AI": ["Data Analyst", "Data Engineer", "AI/ML Engineer"],
  "Product / Business": ["Business Analyst", "Product Manager"],
  "Operations / Support": ["IT Support", "Operations Executive", "HR Executive"],
  Other: [],
};

export function Field({ label, name, defaultValue, options, multiline, ...props }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700">
      {label}
      {options ? (
        <select name={name} defaultValue={defaultValue} className={fieldClass} {...props}>
          {options.map((option) => {
            const { value, text } = typeof option === "string" ? { value: option, text: option } : option;
            return <option key={value} value={value}>{text}</option>;
          })}
        </select>
      ) : multiline ? (
        <textarea name={name} defaultValue={defaultValue} className={fieldClass} rows={3} {...props} />
      ) : (
        <input name={name} defaultValue={defaultValue} className={fieldClass} {...props} />
      )}
    </label>
  );
}

function ProfileSection({ title, children }) {
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CandidateProfileFields({ candidate }) {
  const profile = candidate?.profile;
  const [category, setCategory] = useState(profile?.role_category ?? "");
  const [experience, setExperience] = useState(profile?.experience_type ?? "");
  const [projectLinks, setProjectLinks] = useState(() =>
    (profile?.project_links ?? []).map((project, id) => ({ ...project, id })),
  );
  const nextProjectId = useRef(projectLinks.length);

  return (
    <>
      <ProfileSection title="Contact Details">
        <Field label="Full name" name="name" defaultValue={candidate?.name} required maxLength={150} />
        <Field label="Email" name="email" defaultValue={candidate?.email} type="email" required maxLength={255} />
        <Field label="Phone" name="phone" defaultValue={candidate?.phone} type="tel" maxLength={40} />
        <Field label="Current city / hometown" name="city" defaultValue={profile?.city} maxLength={100} />
      </ProfileSection>
      <ProfileSection title="Role & Skills">
        <Field
          label="Role category" name="role_category" value={category}
          onChange={(event) => setCategory(event.target.value)}
          options={[{ value: "", text: "Select a category" }, ...Object.keys(positionsByCategory)]}
        />
        <Field
          label="Preferred position" name="preferred_position" list="hiring-position-suggestions"
          defaultValue={profile?.preferred_position} placeholder="Select or enter a position" required maxLength={150}
        />
        <datalist id="hiring-position-suggestions">
          {(positionsByCategory[category] ?? Object.values(positionsByCategory).flat()).map((position) => (
            <option value={position} key={position} />
          ))}
        </datalist>
        <Field label="Key skills" name="skills" defaultValue={profile?.skills} placeholder="React, TypeScript" maxLength={500} />
        <Field label="Highest qualification" name="qualification" defaultValue={profile?.qualification} maxLength={150} />
        <Field label="Graduation year" name="graduation_year" defaultValue={profile?.graduation_year} type="number" min={1900} max={2100} />
        <Field label="Source / referral" name="profile_source" defaultValue={profile?.source} maxLength={120} />
      </ProfileSection>
      <ProfileSection title="Experience & CTC">
        <Field
          label="Experience type" name="experience_type" value={experience} required
          onChange={(event) => setExperience(event.target.value)}
          options={[{ value: "", text: "Select experience type" }, "Fresher", "Experienced"]}
        />
        <Field label="Earliest joining date" name="joining_date" defaultValue={profile?.joining_date} type="date" />
        {experience === "Experienced" && (
          <>
            <Field label="Experience years" name="experience_years" defaultValue={profile?.experience_years} type="number" min={0} max={60} />
            <Field label="Experience months" name="experience_months" defaultValue={profile?.experience_months} type="number" min={0} max={11} />
            <Field label="Current / last company" name="company" defaultValue={profile?.company} maxLength={150} />
            <Field label="Current / last designation" name="designation" defaultValue={profile?.designation} maxLength={150} />
            <Field label="Notice period" name="profile_notice" defaultValue={profile?.notice_period} maxLength={80} />
            <Field label="Current / last CTC (₹ LPA)" name="current_ctc_lpa" defaultValue={profile?.current_ctc_lpa} type="number" min="0" max="99999999.99" step="0.01" />
          </>
        )}
        <Field label="Expected CTC (₹ LPA)" name="expected_ctc_lpa" defaultValue={profile?.expected_ctc_lpa} type="number" min="0" max="99999999.99" step="0.01" />
      </ProfileSection>
      <ProfileSection title="Résumé & Links">
        <Field label="Résumé OneDrive link" name="resume_url" defaultValue={candidate?.resume_url} type="url" />
        <Field label="LinkedIn" name="linkedin_url" defaultValue={profile?.linkedin_url} type="url" />
        <Field label="GitHub" name="github_url" defaultValue={profile?.github_url} type="url" />
        <Field label="Portfolio" name="portfolio_url" defaultValue={profile?.portfolio_url} type="url" />
        {projectLinks.map((project) => (
          <div key={project.id} className="grid items-end gap-2 rounded-md bg-slate-50 p-2 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Project name" name="project_name" defaultValue={project.name} required maxLength={120} />
            <Field label="Project link" name="project_url" defaultValue={project.url} type="url" required />
            <button
              type="button" className="rounded-md px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              onClick={() => setProjectLinks((links) => links.filter(({ id }) => id !== project.id))}
            >Remove</button>
          </div>
        ))}
        <button
          type="button" disabled={projectLinks.length >= 12}
          className="w-fit rounded-md px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          onClick={() => {
            const id = nextProjectId.current++;
            setProjectLinks((links) => [...links, { id, name: "", url: "" }]);
          }}
        >+ Add Project Link</button>
      </ProfileSection>
      <div className="sm:col-span-2">
        <Field label="Candidate notes" name="profile_notes" defaultValue={profile?.notes} multiline maxLength={5000} />
      </div>
    </>
  );
}

export function readCandidateProfile(form) {
  const optional = (name) => String(form.get(name) ?? "").trim() || null;
  const number = (name) => {
    const value = optional(name);
    return value === null ? null : Number(value);
  };
  const projectUrls = form.getAll("project_url");
  return {
    city: optional("city"),
    role_category: optional("role_category"),
    preferred_position: optional("preferred_position"),
    skills: optional("skills"),
    qualification: optional("qualification"),
    graduation_year: number("graduation_year"),
    source: optional("profile_source"),
    experience_type: optional("experience_type"),
    experience_years: number("experience_years"),
    experience_months: number("experience_months"),
    company: optional("company"),
    designation: optional("designation"),
    notice_period: optional("profile_notice"),
    current_ctc_lpa: optional("current_ctc_lpa"),
    expected_ctc_lpa: optional("expected_ctc_lpa"),
    joining_date: optional("joining_date"),
    linkedin_url: optional("linkedin_url"),
    github_url: optional("github_url"),
    portfolio_url: optional("portfolio_url"),
    project_links: form.getAll("project_name").map((name, index) => ({
      name: String(name).trim(), url: String(projectUrls[index]).trim(),
    })),
    notes: optional("profile_notes"),
  };
}

export function candidateExperience(profile) {
  if (!profile) return "";
  const years = profile.experience_years;
  const months = profile.experience_months;
  if (profile.experience_type !== "Experienced" || (years == null && months == null)) {
    return profile.experience_type;
  }
  return [
    years != null && (years + (years === 1 ? " year" : " years")),
    months != null && (months + (months === 1 ? " month" : " months")),
  ].filter(Boolean).join(" ");
}

function ctcLabel(value) {
  return value == null ? null : "₹" + value + " LPA";
}

export function CandidateProfileDetails({ candidate }) {
  const profile = candidate.profile;
  const rows = [
    ["Email", candidate.email], ["Phone", candidate.phone], ["Current city / hometown", profile?.city],
    ["Preferred position", profile?.preferred_position], ["Role category", profile?.role_category],
    ["Key skills", profile?.skills], ["Highest qualification", profile?.qualification],
    ["Graduation year", profile?.graduation_year], ["Source / referral", profile?.source],
    ["Experience", candidateExperience(profile)], ["Company", profile?.company],
    ["Current / last designation", profile?.designation], ["Notice period", profile?.notice_period],
    ["Current / last CTC", ctcLabel(profile?.current_ctc_lpa)], ["Expected CTC", ctcLabel(profile?.expected_ctc_lpa)],
    ["Earliest joining date", profile?.joining_date], ["Candidate notes", profile?.notes],
  ];
  const links = [
    ["Résumé", candidate.resume_url], ["LinkedIn", profile?.linkedin_url],
    ["GitHub", profile?.github_url], ["Portfolio", profile?.portfolio_url],
    ...(profile?.project_links ?? []).map(({ name, url }) => [name, url]),
  ].filter(([, url]) => url);

  return (
    <div className="space-y-3">
      <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {rows.filter(([, value]) => value != null && value !== "").map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold text-slate-700">{label}</dt>
            <dd className="mt-1 break-words whitespace-pre-wrap text-slate-600">{value}</dd>
          </div>
        ))}
      </dl>
      {links.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">
        {links.map(([label, url], index) => (
          <li key={index}><a
            className="inline-block rounded-md border border-slate-200 px-2.5 py-1.5 text-rose-700 hover:bg-rose-50"
            target="_blank" rel="noreferrer" href={url}
          >{label}</a></li>
        ))}
      </ul>}
    </div>
  );
}
