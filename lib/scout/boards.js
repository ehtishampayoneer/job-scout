// lib/scout/boards.js
// Which company job boards to pull from Greenhouse and Ashby. These are
// editable via env (comma-separated board tokens). RemoteOK + WeWorkRemotely
// need no config, so the app works even if these are empty or a token is dead
// (dead boards fail gracefully and are skipped).
//
// Greenhouse token = the slug in boards.greenhouse.io/<token>.
// Ashby token      = the slug in jobs.ashbyhq.com/<token>.
function list(envVar, fallback) {
  const raw = process.env[envVar];
  return (raw && raw.trim() ? raw : fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const GREENHOUSE_BOARDS = list("GREENHOUSE_BOARDS", "anthropic,gitlab,figma,discord");
export const ASHBY_BOARDS = list("ASHBY_BOARDS", "openai,ramp,linear,replicate");
// Opt-in company boards (mostly enterprise / lower value for senior-remote-AI),
// so default to empty — add slugs via env when you want to track a company.
export const LEVER_BOARDS = list("LEVER_BOARDS", "");
export const SMARTRECRUITERS_BOARDS = list("SMARTRECRUITERS_BOARDS", "");
