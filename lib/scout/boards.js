// lib/scout/boards.js
// Which company job boards to pull. RemoteOK, WeWorkRemotely, Remotive,
// Arbeitnow, Jobicy, and HN Who's-Hiring need no config. On top of those we pull
// a curated set of AI / tech company ATS boards (Greenhouse, Ashby) where senior
// and AI roles actually live. Dead tokens fail gracefully and are skipped.
// Everything is overridable/extendable via env (comma-separated tokens).
function list(envVar, fallback) {
  const raw = process.env[envVar];
  return (raw && raw.trim() ? raw : fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Greenhouse board tokens (boards.greenhouse.io/<token>). Broad tech + AI set.
export const GREENHOUSE_BOARDS = list(
  "GREENHOUSE_BOARDS",
  [
    "anthropic", "scaleai", "databricks", "gitlab", "figma", "discord", "benchling",
    "samsara", "brex", "plaid", "affirm", "coinbase", "dropbox", "robinhood",
    "airtable", "asana", "gusto", "checkr", "flexport", "instacart", "sofi",
    "cruise", "lyft", "pinterest", "twitch", "grammarly", "webflow", "vercel",
  ].join(",")
);

// Ashby job-board tokens (jobs.ashbyhq.com/<token>). AI-startup heavy.
export const ASHBY_BOARDS = list(
  "ASHBY_BOARDS",
  [
    "openai", "ramp", "linear", "replicate", "runway", "elevenlabs", "perplexity",
    "suno", "hex", "posthog", "baseten", "modal", "together", "fireworks",
    "deepgram", "assemblyai", "cohere", "huggingface", "notion", "cursor",
    "mistral", "harvey", "clay", "sierra", "glean",
  ].join(",")
);

// Opt-in (enterprise-heavy, off by default) — add company slugs to track them.
export const LEVER_BOARDS = list("LEVER_BOARDS", "");
export const SMARTRECRUITERS_BOARDS = list("SMARTRECRUITERS_BOARDS", "");
