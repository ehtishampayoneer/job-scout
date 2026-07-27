// app/api/scout/run/route.js
// User-triggered Scout run ("Run scout now"). Runs as the signed-in user so
// RLS applies; inserts jobs + scores for them.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runScoutForUser } from "@/lib/scout/run";
import { hasAnyProvider } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  try {
    const result = await runScoutForUser(user.id, supabase, { maxScore: 12 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("scout.run_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Scout run failed. Try again in a moment." }, { status: 500 });
  }
}
