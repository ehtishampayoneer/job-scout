// lib/scout/run.js
// The Scout orchestrator for one user:
//   fetch all sources -> hard filter -> dedupe -> batch-upsert jobs ->
//   score only the NEW ones (capped, to respect free-tier LLM limits) -> store.
// Batched DB access keeps it fast; a per-run score cap keeps LLM cost bounded.
import { fetchAllSources } from "./sources";
import { hardFilter } from "./filter";
import { classifyChannel } from "./classify";
import { scoreJob } from "./score";
import { clip } from "./util";
import { embeddingsAvailable, embedTexts, cosine } from "@/lib/embed";
import { logger } from "@/lib/log";

const keyOf = (j) => `${j.source}|${String(j.url).toLowerCase()}`;

export async function runScoutForUser(userId, supabase, { maxJobs = 80, maxScore = 12 } = {}) {
  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("stack").eq("user_id", userId),
  ]);
  if (!profile?.onboarding_complete) return { skipped: "no completed profile" };

  const brief = profileBrief(profile);
  const all = await fetchAllSources();

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

  // Semantic pre-rank (the matching brain): embed the profile and each survivor
  // and order by cosine similarity, so the capped LLM scoring lands on the best
  // fits, not whatever the feeds returned first. Falls back to keyword relevance
  // if embeddings are unavailable (no key / quota).
  let uniq;
  let ranker = "embeddings";
  try {
    if (!embeddingsAvailable() || !survivors.length) throw new Error("embeddings unavailable");
    const texts = survivors.map((j) => `${j.title}. ${clip(j.raw_text || "", 500)}`);
    const vecs = await embedTexts([brief, ...texts]);
    const pv = vecs[0];
    const withSim = survivors.map((j, i) => ({ j, sim: cosine(pv, vecs[i + 1]) }));
    withSim.sort((a, b) => b.sim - a.sim);
    uniq = withSim.slice(0, maxJobs).map((x) => x.j);
  } catch (e) {
    logger.warn("scout.embed_rank_fallback", { error: String(e?.message || e) });
    ranker = "keyword";
    const kw = keywordsFor(profile, projects);
    survivors.sort((a, b) => relevance(b, kw) - relevance(a, kw));
    uniq = survivors.slice(0, maxJobs);
  }

  // Batch upsert jobs (first_seen preserved by the DB default on first insert).
  const rows = uniq.map((j) => ({
    user_id: userId,
    source: j.source,
    url: j.url,
    company: j.company || null,
    title: j.title,
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

  const scoreRows = [];
  for (const { j, id } of toScore) {
    try {
      const s = await scoreJob(j, brief);
      scoreRows.push({
        job_id: id,
        user_id: userId,
        fit_score: s.fit_score,
        why_it_fits: s.why_it_fits,
        trust_score: s.trust_score,
        scam_flags: s.scam_flags,
        status: "new",
      });
    } catch (e) {
      logger.warn("scout.score_failed", { error: String(e?.message || e) });
    }
  }
  if (scoreRows.length) {
    const { error } = await supabase.from("job_scores").insert(scoreRows);
    if (error) logger.warn("scout.scores_insert_failed", { error: error.message });
  }

  return { fetched: all.length, survivors: uniq.length, upserted: rows.length, scored: scoreRows.length, ranker };
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
