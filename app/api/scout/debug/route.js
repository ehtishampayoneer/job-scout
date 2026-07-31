// TEMPORARY scoring diagnostic — ranks the eligible pool, scores the top ~45 in
// parallel, and reports the fit distribution + samples so we can judge whether
// the scorer is too strict or just under-fed. Delete after use.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCandidate } from "@/lib/apply/context";
import { fetchAllSources } from "@/lib/scout/sources";
import { hardFilter } from "@/lib/scout/filter";
import { scoreJob } from "@/lib/scout/score";
import { clip } from "@/lib/scout/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "b1c832b0-6714-4ba1-af27-0e935511d1ec";
const keyOf = (j) => `${j.source}|${String(j.url).toLowerCase()}`;
const contentKey = (j) => {
  const co = String(j.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ti = String(j.title || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
  return co && ti ? `${co}|${ti}` : null;
};
const SENIORITY = ["chief","head","vp","vice president","director","officer","cto","cpo","principal","staff","manager","lead"];

export async function GET() {
  const admin = createAdminClient();
  const { profile } = await loadCandidate(admin, USER);
  const queries = (profile.target_roles || []).map((r) => String(r).trim()).filter(Boolean).slice(0, 5);

  const all = await fetchAllSources({ queries });
  const seen = new Set(), seenC = new Set();
  const survivors = [];
  let hybridFlexDropped = 0;
  for (const j of all) {
    if (!j.url || !j.title || j.title.trim().length < 3) continue;
    if (!hardFilter(j, profile).pass) {
      const t = `${j.location_raw || ""} ${j.location_type || ""}`.toLowerCase();
      if (/hybrid|flexible/.test(t)) hybridFlexDropped++;
      continue;
    }
    const k = keyOf(j); if (seen.has(k)) continue;
    const ck = contentKey(j); if (ck && seenC.has(ck)) continue;
    seen.add(k); if (ck) seenC.add(ck);
    survivors.push(j);
  }

  // Rank by target-role vocabulary + seniority (mirrors production pre-rank).
  const roleWords = [...new Set(queries.flatMap((r) => r.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 2 && !["and","the","of","for","to","a","an"].includes(w)))];
  const level = SENIORITY.filter((s) => queries.join(" | ").toLowerCase().includes(s));
  const rel = (j) => {
    const title = (j.title || "").toLowerCase();
    let s = roleWords.filter((w) => title.includes(w)).length * 3;
    if (level.some((x) => title.includes(x))) s += 6;
    return s;
  };
  survivors.sort((a, b) => rel(b) - rel(a));
  const toScore = survivors.slice(0, 36);

  const brief = [
    profile.headline && `Headline: ${profile.headline}`,
    profile.summary && `Summary: ${clip(profile.summary, 500)}`,
    profile.target_roles?.length && `Target roles: ${profile.target_roles.join(", ")}`,
    profile.location && `Location: ${profile.location}`,
    profile.visa_status && `Work authorization: ${profile.visa_status}`,
    profile.acceptable_locations?.length && `Acceptable locations: ${profile.acceptable_locations.join(", ")}`,
  ].filter(Boolean).join("\n");

  // Score in small chunks to respect free-tier LLM rate limits (firing all at
  // once got every call 429'd).
  const scored = [];
  let firstError = null;
  for (let i = 0; i < toScore.length; i += 8) {
    const chunk = toScore.slice(i, i + 8);
    const settled = await Promise.allSettled(chunk.map((j) => scoreJob(j, brief).then((s) => ({ j, s }))));
    for (const r of settled) {
      if (r.status === "fulfilled") scored.push(r.value);
      else if (!firstError) firstError = String(r.reason?.message || r.reason).slice(0, 200);
    }
  }

  const fits = scored.map((x) => x.s.fit_score);
  const atLeast = (n) => fits.filter((f) => f >= n).length;
  const label = (x) => `[${x.s.fit_score}] ${x.j.title} @ ${x.j.company} [${x.j.location_raw || x.j.location_type}] (${x.j.source}) — ${x.s.why_it_fits}`;

  return NextResponse.json({
    eligiblePool: survivors.length,
    scoredSample: scored.length,
    firstError,
    thresholdCounts_inSample: { ">=50": atLeast(50), ">=55": atLeast(55), ">=60": atLeast(60), ">=65": atLeast(65) },
    projectedIfWholePoolScored: {
      note: "extrapolated from the sample's qualify-rate across the full eligible pool",
      atLeast65: Math.round((atLeast(65) / (scored.length || 1)) * survivors.length),
      atLeast60: Math.round((atLeast(60) / (scored.length || 1)) * survivors.length),
      atLeast55: Math.round((atLeast(55) / (scored.length || 1)) * survivors.length),
    },
    hybridOrFlexibleDropped: hybridFlexDropped,
    samples_40to65: scored.filter((x) => x.s.fit_score >= 40 && x.s.fit_score < 65).slice(0, 10).map(label),
    samples_above65: scored.filter((x) => x.s.fit_score >= 65).slice(0, 5).map(label),
  });
}
