// lib/scout/filter.js
// A GENERIC, cheap pre-filter that works for ANY user and ANY profession — a
// nurse, a designer, a junior developer, a senior CTO. It makes NO assumptions
// about field or seniority (that is decided downstream by the profile-driven
// keyword pre-rank, the semantic embedding match, and the LLM scorer). The one
// universal thing we filter here is location fit — a job you cannot physically
// or legally take is never a match.
//
// IMPORTANT: location is judged ONLY from the job's structured location fields
// (location_type + location_raw), never from the free-text description. Job
// descriptions routinely mention "remote" or a country name in passing ("our
// US customers", "occasional remote days"), which used to leak onsite roles
// into a remote-only search — that was the bug that surfaced onsite San
// Francisco roles for a remote candidate.
export function hardFilter(job, profile) {
  const reasons = [];
  const title = String(job.title || "").trim();
  if (title.length < 3) return { pass: false, reasons: ["no title"] };

  const jobLoc = `${job.location_raw || ""} ${job.location_type || ""}`.toLowerCase();

  const remote =
    job.location_type === "remote" ||
    /\b(remote|anywhere|worldwide|distributed|global|flexible)\b/.test(jobLoc);

  // An ONSITE role only passes if its location matches somewhere the candidate
  // can actually be: a specific place they listed as acceptable, or where they
  // live. We split multi-word profile values into place tokens and drop generic
  // words so "Remote (Global)" or "Pakistan (remote, with US/CAN travel visa)"
  // don't turn into meaningless matches.
  const places = [...(profile.acceptable_locations || []), profile.location || ""]
    .flatMap((l) => String(l).toLowerCase().split(/[,/()]+/))
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && !GENERIC.has(l) && !/^(with|and|the)\b/.test(l));
  const locMatch = places.some((l) => jobLoc.includes(l));

  if (!remote && !locMatch) reasons.push("onsite in a location the candidate can't take");

  return { pass: reasons.length === 0, reasons };
}

// Words that are not real place tokens (so they never create false location
// matches when we split up a free-text profile field).
const GENERIC = new Set([
  "remote", "worldwide", "anywhere", "global", "with", "and", "the", "visa",
  "travel", "onsite", "on-site", "hybrid", "flexible", "based", "open",
]);
