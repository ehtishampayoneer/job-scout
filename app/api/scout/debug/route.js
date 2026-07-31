// TEMPORARY metrics run — fetch every source, then measure the funnel:
// per-source yield, dedup rate, and the qualified pool. Delete after use.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllSources } from "@/lib/scout/sources";
import { hardFilter } from "@/lib/scout/filter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "b1c832b0-6714-4ba1-af27-0e935511d1ec";
const keyOf = (j) => `${j.source}|${String(j.url).toLowerCase()}`;
const contentKey = (j) => {
  const co = String(j.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ti = String(j.title || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
  return co && ti ? `${co}|${ti}` : null;
};

export async function GET() {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profile").select("*").eq("user_id", USER).maybeSingle();
  const queries = (profile.target_roles || []).map((r) => String(r || "").trim()).filter(Boolean).slice(0, 5);

  const t0 = Date.now();
  const all = await fetchAllSources({ queries });
  const fetchMs = Date.now() - t0;

  // Per-source RAW counts.
  const rawBySource = {};
  for (const j of all) rawBySource[j.source || "?"] = (rawBySource[j.source || "?"] || 0) + 1;

  // Funnel: filter -> url-dedupe -> content-dedupe.
  let passedFilter = 0, urlDupes = 0, contentDupes = 0;
  const seen = new Set(), seenContent = new Set();
  const survivedBySource = {};
  for (const j of all) {
    if (!j.url || !j.title || j.title.trim().length < 3) continue;
    if (!hardFilter(j, profile).pass) continue;
    passedFilter++;
    const k = keyOf(j);
    if (seen.has(k)) { urlDupes++; continue; }
    const ck = contentKey(j);
    if (ck && seenContent.has(ck)) { contentDupes++; continue; }
    seen.add(k);
    if (ck) seenContent.add(ck);
    survivedBySource[j.source || "?"] = (survivedBySource[j.source || "?"] || 0) + 1;
  }
  const survivors = Object.values(survivedBySource).reduce((a, b) => a + b, 0);

  const top5 = Object.entries(survivedBySource).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Current qualified inventory already scored in the DB.
  const { data: scores } = await admin.from("job_scores").select("fit_score").eq("user_id", USER);
  const qualified = (scores || []).filter((s) => (s.fit_score ?? 0) >= 65).length;

  return NextResponse.json({
    queries,
    fetchMs,
    fetched: all.length,
    passedFilter,
    dedupe: {
      urlDuplicatesRemoved: urlDupes,
      crossSourceDuplicatesRemoved: contentDupes,
      dedupRatePct: passedFilter ? Math.round(((urlDupes + contentDupes) / passedFilter) * 100) : 0,
      survivors,
    },
    rawBySource: Object.fromEntries(Object.entries(rawBySource).sort((a, b) => b[1] - a[1])),
    survivedBySource: Object.fromEntries(Object.entries(survivedBySource).sort((a, b) => b[1] - a[1])),
    top5SourcesByYield: top5,
    currentQualifiedInventory: qualified,
  });
}
