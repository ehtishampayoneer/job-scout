// app/api/interview/prep/route.js — generate (and cache) the prep brief.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePrep } from "@/lib/interview/prep";
import { hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data: iv } = await supabase
    .from("interviews")
    .select("id, application_id, job_id, applications(*), jobs(*)")
    .eq("id", b.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!iv?.jobs) return NextResponse.json({ error: "Interview or job not found." }, { status: 404 });

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("projects").select("*").eq("user_id", user.id).order("sort_order"),
  ]);

  try {
    const prep = await generatePrep({ job: iv.jobs, application: iv.applications, profile, projects: projects || [] });
    await supabase.from("interviews").update({ prep, updated_at: new Date().toISOString() }).eq("id", b.id);
    return NextResponse.json({ ok: true, prep });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    logger.error("interview.prep_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not prepare the brief." }, { status: 500 });
  }
}
