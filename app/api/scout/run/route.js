// app/api/scout/run/route.js
// User-triggered Scout run ("Run scout now"). Runs as the signed-in user so
// RLS applies; inserts jobs + scores for them.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runScoutForUser } from "@/lib/scout/run";
import { hasAnyProvider } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
// Vercel's Hobby plan hard-caps function execution at 60s (a higher value is
// silently clamped, then the platform kills the function and returns a non-JSON
// error page). The run is engineered to finish well under this: parallel LLM
// scoring, a bounded embedding pool, and parallel source fetches.
export const maxDuration = 60;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  try {
    // Fresh rescan: clear stale, un-actioned matches so the list rebuilds clean
    // with the current sources/filter/scoring. Jobs you already applied to are kept.
    if (body.fresh) {
      const { data: apps } = await supabase.from("applications").select("job_id").eq("user_id", user.id);
      const keep = (apps || []).map((a) => a.job_id).filter(Boolean);
      await supabase.from("job_scores").delete().eq("user_id", user.id);
      let del = supabase.from("jobs").delete().eq("user_id", user.id);
      if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
      await del;
    }

    const result = await runScoutForUser(user.id, supabase, { maxScore: 24 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("scout.run_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Scout run failed. Try again in a moment." }, { status: 500 });
  }
}
