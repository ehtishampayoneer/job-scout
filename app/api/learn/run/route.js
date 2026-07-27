// app/api/learn/run/route.js — compute the funnel stats and get a coaching read.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeStats, analyzeFunnel } from "@/lib/learn/analyze";
import { hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const [{ data: apps }, { data: emails }] = await Promise.all([
    supabase.from("applications").select("status").eq("user_id", user.id),
    supabase.from("emails").select("direction, ai_tag").eq("user_id", user.id),
  ]);

  const stats = computeStats(apps || [], emails || []);
  let analysis;
  try {
    analysis = await analyzeFunnel(stats);
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    }
    logger.error("learn.analyze_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not analyze." }, { status: 500 });
  }

  const week_of = new Date().toISOString().slice(0, 10);
  await supabase.from("learnings").insert({
    user_id: user.id,
    week_of,
    notes: analysis.notes,
    adjustments: { adjustment: analysis.adjustment, warning: analysis.warning, stats },
  });

  return NextResponse.json({ ok: true, stats, ...analysis });
}
