// lib/scout/filter.js
// A GENERIC, cheap pre-filter that works for ANY user and ANY profession — a
// nurse, a designer, a junior developer, a senior CTO. It deliberately makes NO
// assumptions about the user's field or seniority. All of that is decided
// per-user, downstream, by the profile-driven keyword pre-rank, the semantic
// embedding match, and the LLM scorer — every one of which reads the user's own
// profile. The only thing we filter cheaply here is location fit, because that
// is universal (a job you cannot physically/legally take is never a match).
export function hardFilter(job, profile) {
  const reasons = [];
  const title = String(job.title || "").trim();
  if (title.length < 3) return { pass: false, reasons: ["no title"] };

  const jobLoc = `${job.location_raw || ""} ${job.location_type || ""}`.toLowerCase();
  const text = `${title} ${job.raw_text || ""}`.toLowerCase();
  const remote =
    job.location_type === "remote" ||
    /remote|anywhere|worldwide|distributed/i.test(jobLoc) ||
    /\bremote\b/i.test(text);

  // Also accept a job whose location matches one of the USER's own acceptable
  // locations (e.g. they said they're open to "Dubai" or "Berlin" or onsite in
  // their city). Driven by the profile, not a hardcoded assumption.
  const locs = (profile.acceptable_locations || [])
    .map((l) => String(l).toLowerCase().trim())
    .filter((l) => l && !/remote|worldwide|anywhere|global/.test(l));
  const locMatch = locs.some((l) => jobLoc.includes(l) || text.includes(l));

  if (!remote && !locMatch) reasons.push("not remote or in an acceptable location");

  return { pass: reasons.length === 0, reasons };
}
