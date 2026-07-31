// lib/scout/boards.js
// Which company job boards to pull. RemoteOK, WeWorkRemotely, Remotive,
// Arbeitnow, Jobicy, and HN Who's-Hiring need no config. On top of those we pull
// a curated set of company ATS boards (Greenhouse, Ashby, Lever, SmartRecruiters)
// where senior, AI, and remote roles actually live.
//
// EVERY slug below was VERIFIED live (returned real jobs) by the probe — no
// guessed tokens. Dead tokens still fail gracefully. Extend/override via env
// (comma-separated tokens).
function list(envVar, fallback) {
  const raw = process.env[envVar];
  return (raw && raw.trim() ? raw : fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Greenhouse board tokens (boards.greenhouse.io/<token>). Verified: 59 boards.
export const GREENHOUSE_BOARDS = list(
  "GREENHOUSE_BOARDS",
  [
    "databricks", "stripe", "datadog", "mongodb", "okta", "samsara", "brex", "cloudflare", "verkada", "oscar",
    "elastic", "remotecom", "pinterest", "scaleai", "fivetran", "reddit", "gitlab", "airbnb", "twilio", "affirm",
    "clickhouse", "lyft", "coinbase", "flexport", "asana", "robinhood", "instacart", "postman", "oura", "gusto",
    "vercel", "faire", "sofi", "duolingo", "hightouch", "chime", "twitch", "mercury", "checkr", "newrelic",
    "attentive", "discord", "amplitude", "airtable", "launchdarkly", "cockroachlabs", "dropbox", "webflow",
    "pagerduty", "squarespace", "calendly", "typeform", "planetscale", "doximity", "circleci", "netlify",
    "lattice", "masterclass", "calm",
  ].join(",")
);

// Ashby job-board tokens (jobs.ashbyhq.com/<token>). Verified: 43 boards.
export const ASHBY_BOARDS = list(
  "ASHBY_BOARDS",
  [
    "openai", "harvey", "elevenlabs", "sierra", "cohere", "ramp", "cursor", "notion", "langchain", "replit",
    "perplexity", "deepgram", "suno", "baseten", "writer", "supabase", "fireworks", "gamma", "modal", "astronomer",
    "braintrust", "linear", "anyscale", "midjourney", "coder", "warp", "llamaindex", "character", "lightning",
    "pika", "plane", "posthog", "railway", "ideogram", "pinecone", "unstructured", "neon", "prefect",
    "materialize", "runway", "deepnote", "windmill", "weaviate",
  ].join(",")
);

// Lever company boards (api.lever.co/v0/postings/<token>). Verified: 4 boards.
export const LEVER_BOARDS = list("LEVER_BOARDS", ["gopuff", "shieldai", "zoox", "ro"].join(","));

// SmartRecruiters company boards. Verified: 4 boards.
export const SMARTRECRUITERS_BOARDS = list(
  "SMARTRECRUITERS_BOARDS",
  ["AveryDennison", "Experian", "Visa", "WeWork"].join(",")
);
