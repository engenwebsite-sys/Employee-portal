const fieldClass = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-rose-400";

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
