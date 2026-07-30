// lib/scout/run.js
// The Scout orchestrator for one user:
//   fetch all sources -> hard filter -> dedupe -> batch-upsert jobs ->
//   score only the NEW ones (capped, to respect free-tier LLM limits) -> store.
// Batched DB access keeps it fast; a per-run score cap keeps LLM cost bounded.
import { fetchAllSources } from "./sources";
import { hardFilter } from "./filter";
import { classifyChannel } from "./classify";
import { scoreJob } from "./score";
import { clip, fixMojibake, decodeEntities } from "./util";
import { embeddingsAvailable, embedTexts, cosine } from "@/lib/embed";
import { callAI } from "@/lib/ai-router";
import { logger } from "@/lib/log";

const keyOf = (j) => `${j.source}|${String(j.url).toLowerCase()}`;

export async function runScoutForUser(userId, supabase, { maxJobs = 100, maxScore = 20 } = {}) {
  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("stack").eq("user_id", userId),
  ]);
  if (!profile?.onboarding_complete) return { skipped: "no completed profile" };

  // The matching query is not the raw CV — it is a strategist's description of the
  // roles this person should target and would win, so ranking is about strategic
  // fit, not keyword overlap. Falls back to the plain profile brief if the LLM is down.
  const brief = await idealTargetQuery(profile, projects);

  // Search terms for the query-based aggregators (JSearch/Adzuna/Jooble): the
  // candidate's own target roles, so those platforms return jobs that fit them.
  const queries = (profile.target_roles || [])
    .map((r) => String(r || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const all = await fetchAllSources({ queries });

  // Hard filter + dedupe (collect all, rank later).
  const seen = new Set();
  const survivors = [];
  for (const j of all) {
    if (!j.url || !j.title || j.title.trim().length < 3) continue;
    if (!hardFilter(j, profile).pass) continue;
    const k = keyOf(j);
    if (seen.has(k)) continue;
    seen.add(k);
    survivors.push(j);
  }
  if (!survivors.length) return { fetched: all.length, survivors: 0, upserted: 0, scored: 0 };

  // Since the hard filter is deliberately generic (location only), a lot can pass.
  // Bound the pool with a CHEAP, profile-driven keyword pre-rank (keywords come
  // from THIS user's target roles, strengths, and stacks) before the costlier
  // embedding step. This works for any profession — a nurse's keywords rank
  // nursing roles to the top, a developer's rank engineering roles.
  const kw = keywordsFor(profile, projects);
  survivors.sort((a, b) => relevance(b, kw) - relevance(a, kw));
  const pool = survivors.slice(0, 150);

  // Semantic pre-rank (the matching brain): embed the profile and each pooled
  // survivor and order by cosine similarity, so the capped LLM scoring lands on
  // the best fits. Falls back to the keyword order if embeddings are unavailable.
  let uniq;
  let ranker = "embeddings";
  try {
    if (!embeddingsAvailable()) throw new Error("embeddings unavailable");
    const texts = pool.map((j) => `${j.title}. ${clip(j.raw_text || "", 500)}`);
    const vecs = await embedTexts([brief, ...texts]);
    const pv = vecs[0];
    const withSim = pool.map((j, i) => ({ j, sim: cosine(pv, vecs[i + 1]) }));
    withSim.sort((a, b) => b.sim - a.sim);
    uniq = withSim.slice(0, maxJobs).map((x) => x.j);
  } catch (e) {
    logger.warn("scout.embed_rank_fallback", { error: String(e?.message || e) });
    ranker = "keyword";
    uniq = pool.slice(0, maxJobs);
  }

  // Batch upsert jobs (first_seen preserved by the DB default on first insert).
  const rows = uniq.map((j) => ({
    user_id: userId,
    source: j.source,
    url: j.url,
    company: j.company ? fixMojibake(decodeEntities(j.company)) : null,
    title: fixMojibake(decodeEntities(j.title)),
    raw_text: j.raw_text || null,
    salary_range: j.salary_range || null,
    location_type: j.location_type || null,
    location_raw: j.location_raw || null,
    apply_channel: classifyChannel(j).channel,
  }));
  const { data: upserted, error: upErr } = await supabase
    .from("jobs")
    .upsert(rows, { onConflict: "user_id,source,url" })
    .select("id,source,url");
  if (upErr) throw upErr;

  const idByKey = new Map();
  for (const r of upserted || []) idByKey.set(keyOf(r), r.id);
  const jobIds = [...idByKey.values()];

  // Skip anything already scored.
  const { data: existing } = await supabase.from("job_scores").select("job_id").in("job_id", jobIds);
  const scored = new Set((existing || []).map((s) => s.job_id));

  const toScore = uniq
    .map((j) => ({ j, id: idByKey.get(keyOf(j)) }))
    .filter((x) => x.id && !scored.has(x.id))
    .slice(0, maxScore);

  // Score in PARALLEL, not one-at-a-time. Sequential scoring of a full batch
  // easily blows past a serverless function's time limit (Vercel Hobby caps at
  // 60s), which returns a non-JSON error page and crashes the client's parse.
  // The providers' own rate limits + the router's failover keep this safe.
  const scoreRows = [];
  const settled = await Promise.allSettled(
    toScore.map(async ({ j, id }) => {
      const s = await scoreJob(j, brief);
      return { id, s };
    })
  );
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) {
      const { id, s } = r.value;
      scoreRows.push({
        job_id: id,
        user_id: userId,
        fit_score: s.fit_score,
        why_it_fits: s.why_it_fits,
        trust_score: s.trust_score,
        scam_flags: s.scam_flags,
        status: "new",
      });
    } else if (r.status === "rejected") {
      logger.warn("scout.score_failed", { error: String(r.reason?.message || r.reason) });
    }
  }
  if (scoreRows.length) {
    const { error } = await supabase.from("job_scores").insert(scoreRows);
    if (error) logger.warn("scout.scores_insert_failed", { error: error.message });
  }

  return { fetched: all.length, survivors: uniq.length, upserted: rows.length, scored: scoreRows.length, ranker };
}

// Ask the model to reason about the roles this candidate should target and would
// realistically win, and use THAT as the matching query. This is the difference
// between "find jobs with my keywords" and "find the jobs that actually fit me".
async function idealTargetQuery(profile, projects) {
  const base = profileBrief(profile);
  try {
    const stacks = (projects || []).flatMap((p) => p.stack || []).slice(0, 24).join(", ");
    const res = await callAI({
      system:
        "You are a career strategist. Given a candidate, describe in 3 to 4 sentences the IDEAL job roles they should target and would both excel at and realistically win: the role types and seniority, the domain and company stage, and the kind of work. Optimize for best fit and maximum opportunity, grounded strictly in their real experience. Return only the description, no preamble.",
      prompt: `${base}\nProject tech: ${stacks}\n\nDescribe the ideal target roles for this person.`,
      json: false,
      temperature: 0.4,
      maxTokens: 320,
    });
    const t = String(res.text || "").trim();
    return t ? `IDEAL ROLES FOR THIS CANDIDATE: ${t}\n\n${base}` : base;
  } catch {
    return base;
  }
}

// Build a de-duped keyword set from the candidate's roles, headline, strengths,
// and project stacks — the signals of what a relevant job looks like for them.
function keywordsFor(profile, projects) {
  const raw = [
    ...(profile.target_roles || []),
    ...(profile.strengths || []),
    ...(projects || []).flatMap((p) => p.stack || []),
    ...String(profile.headline || "").split(/[\s,/&]+/),
  ];
  const stop = new Set(["and", "the", "of", "ai", "a", "an", "for", "to", "product", "senior", "lead"]);
  const set = new Set();
  for (const w of raw) {
    const t = String(w || "").toLowerCase().trim();
    if (t.length >= 3 && !stop.has(t)) set.add(t);
  }
  return [...set];
}

function relevance(job, kw) {
  const title = String(job.title || "").toLowerCase();
  const text = String(job.raw_text || "").toLowerCase();
  let score = 0;
  for (const k of kw) {
    if (title.includes(k)) score += 3;
    else if (text.includes(k)) score += 1;
  }
  return score;
}

function profileBrief(p) {
  return [
    p.headline ? `Headline: ${p.headline}` : "",
    p.summary ? `Summary: ${clip(p.summary, 700)}` : "",
    p.target_roles?.length ? `Target roles: ${p.target_roles.join(", ")}` : "",
    p.salary_floor_usd ? `Salary floor: $${p.salary_floor_usd}/month. Target: ${p.salary_notes || "higher over time"}` : "",
    p.acceptable_locations?.length ? `Acceptable locations: ${p.acceptable_locations.join(", ")}` : "",
    p.visa_status ? `Visa/work authorization: ${p.visa_status}` : "",
    p.strengths?.length ? `Strengths: ${p.strengths.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
