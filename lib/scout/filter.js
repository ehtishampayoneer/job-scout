// lib/scout/filter.js
// Hard rules that kill most postings cheaply, BEFORE any LLM cost.
// We are deliberately strict on seniority and remote (the two rules that are
// safe to apply by keyword), and we DO NOT hard-drop on salary here because
// free feeds rarely list it and annual-vs-monthly is ambiguous — salary fit is
// judged later in scoring instead.

const SENIOR =
  /\b(senior|sr\.?|staff|principal|lead|head|director|vp|vice president|chief|cto|founding|architect|manager)\b/i;

// Junior signals that should NOT pass even if "remote".
const JUNIOR = /\b(intern|internship|junior|jr\.?|entry[- ]level|graduate|apprentice|trainee|working student)\b/i;

export function hardFilter(job, profile) {
  const reasons = [];
  const title = String(job.title || "");
  const text = `${title} ${job.raw_text || ""}`.toLowerCase();

  // Seniority: title looks senior, or it matches one of the user's target roles.
  const roleMatch = (profile.target_roles || []).some((r) => r && text.includes(String(r).toLowerCase()));
  if (JUNIOR.test(title) && !SENIOR.test(title)) reasons.push("junior role");
  if (!SENIOR.test(title) && !roleMatch) reasons.push("not senior-level");

  // Remote: explicitly remote, or clearly says remote/worldwide.
  const remote =
    job.location_type === "remote" ||
    /remote|anywhere|worldwide|distributed/i.test(job.location_raw || "") ||
    /\bremote\b/i.test(text);
  if (!remote) reasons.push("not remote");

  return { pass: reasons.length === 0, reasons };
}
