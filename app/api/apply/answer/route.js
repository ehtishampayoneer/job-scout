// app/api/apply/answer/route.js
// Draft an honest answer to ONE arbitrary question a company's form asks, using
// the current job/company + the candidate's real profile + the already-generated
// application. Powers the per-application "ask me any form question" assistant.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadCandidate } from "@/lib/apply/context";
import { answerApplicationQuestion } from "@/lib/apply/answer";
import { hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId;
  const question = String(body.question || "").trim();
  if (!jobId || !question) return NextResponse.json({ error: "Missing job or question." }, { status: 400 });
  if (question.length > 1500) return NextResponse.json({ error: "That question is too long." }, { status: 400 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const { profile, projects, employment, education } = await loadCandidate(supabase, user.id);
  const { data: application } = await supabase
    .from("applications")
    .select("note_text, resume_md")
    .eq("user_id", user.id)
    .eq("job_id", jobId)
    .maybeSingle();

  try {
    const { answer } = await answerApplicationQuestion({
      job,
      profile: { ...profile, contact_email: profile.contact_email || user.email },
      projects,
      employment,
      education,
      application,
      question,
    });
    return NextResponse.json({ answer });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    }
    logger.error("apply.answer_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not draft an answer." }, { status: 500 });
  }
}
