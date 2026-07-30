// TEMPORARY end-to-end verification. Runs the FULL scout pipeline (fetch all
// sources incl. aggregators -> filter -> rank -> score -> store) for the account
// using the service-role client, then returns the top scored results. Populates
// the real job list as a side effect. Delete after use.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScoutForUser } from "@/lib/scout/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "b1c832b0-6714-4ba1-af27-0e935511d1ec";

export async function GET() {
  const admin = createAdminClient();
  const started = Date.now();
  let result, error;
  try {
    result = await runScoutForUser(USER, admin, { maxScore: 24 });
  } catch (e) {
    error = String(e?.message || e);
  }

  const { data: top } = await admin
    .from("job_scores")
    .select("fit_score, why_it_fits, jobs(title, company, source, location_raw)")
    .eq("user_id", USER)
    .order("fit_score", { ascending: false })
    .limit(15);

  const bySource = {};
  for (const t of top || []) {
    const s = t.jobs?.source || "?";
    bySource[s] = (bySource[s] || 0) + 1;
  }

  return NextResponse.json({
    elapsedMs: Date.now() - started,
    result,
    error,
    topSourcesInTop15: bySource,
    top: (top || []).map((t) => ({
      fit: t.fit_score,
      title: t.jobs?.title,
      company: t.jobs?.company,
      source: t.jobs?.source,
      loc: t.jobs?.location_raw,
      why: t.why_it_fits,
    })),
  });
}
