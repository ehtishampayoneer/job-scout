// TEMPORARY — times the application generation for a specific job so we can see
// whether it fits under 60s and which provider answers. Delete after use.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCandidate } from "@/lib/apply/context";
import { generateApplication } from "@/lib/apply/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "b1c832b0-6714-4ba1-af27-0e935511d1ec";

export async function GET(request) {
  const admin = createAdminClient();
  const jobId = new URL(request.url).searchParams.get("job") || "273eb0b2-0de7-4aa3-9076-7e49315bd6e6";

  const { profile, projects, employment, education } = await loadCandidate(admin, USER);
  const { data: score } = await admin
    .from("job_scores")
    .select("*, jobs(*)")
    .eq("user_id", USER)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!score?.jobs) return NextResponse.json({ error: "job/score not found", jobId });

  const t0 = Date.now();
  try {
    const gen = await generateApplication({ job: score.jobs, score, profile, projects, employment, education });
    return NextResponse.json({
      ms: Date.now() - t0,
      provider: gen.provider,
      salary_ask: gen.salary_ask,
      note_len: (gen.note_text || "").length,
      answers: (gen.answers || []).length,
      resume_len: (gen.resume_md || "").length,
      note_preview: (gen.note_text || "").slice(0, 220),
    });
  } catch (e) {
    return NextResponse.json({ ms: Date.now() - t0, error: String(e?.message || e) });
  }
}
