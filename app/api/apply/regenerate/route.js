// app/api/apply/regenerate/route.js
// Re-run the tailored generation for a job's DRAFT application (never touches a
// sent one). Lets the user get a fresh take instead of hand-fixing a weak draft.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadCandidate } from "@/lib/apply/context";
import { generateApplication } from "@/lib/apply/generate";
import { fetchJobDescription } from "@/lib/apply/jobtext";
import { classifyChannel } from "@/lib/scout/classify";
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
  if (!b.jobId) return NextResponse.json({ error: "Missing jobId." }, { status: 400 });

  const [{ data: score }, cand] = await Promise.all([
    supabase.from("job_scores").select("*, jobs(*)").eq("user_id", user.id).eq("job_id", b.jobId).maybeSingle(),
    loadCandidate(supabase, user.id),
  ]);
  if (!score?.jobs) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  // Guard: do not regenerate an application that has already been sent.
  const { data: existing } = await supabase.from("applications").select("id,status").eq("user_id", user.id).eq("job_id", b.jobId).maybeSingle();
  if (existing && existing.status !== "draft") {
    return NextResponse.json({ error: "This application was already sent." }, { status: 409 });
  }

  try {
    const job = score.jobs;
    const ch = classifyChannel(job);
    const profile = { ...cand.profile, contact_email: cand.profile.contact_email || user.email };
    const fullText = await fetchJobDescription(job);
    const jobForGen = fullText && fullText.length > (job.raw_text || "").length ? { ...job, raw_text: fullText } : job;
    const gen = await generateApplication({ job: jobForGen, score, profile, projects: cand.projects, employment: cand.employment, education: cand.education });
    await supabase.from("applications").upsert(
      {
        user_id: user.id,
        job_id: b.jobId,
        status: "draft",
        salary_ask: gen.salary_ask,
        subject: gen.subject,
        note_text: gen.note_text,
        answers_json: { answers: gen.answers },
        resume_md: gen.resume_md,
        to_email: ch.email || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    logger.error("apply.regenerate_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not regenerate." }, { status: 500 });
  }
}
