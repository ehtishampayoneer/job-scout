// app/api/apply/next/route.js
// The engine behind the Apply Copilot queue. Returns the next job that needs
// action (highest fit, not yet sent/dismissed), generating a tailored draft
// application the first time it is surfaced. Cached as an applications row so
// re-viewing does not regenerate.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadCandidate, TERMINAL_STATUSES } from "@/lib/apply/context";
import { generateApplication } from "@/lib/apply/generate";
import { classifyChannel } from "@/lib/scout/classify";
import { hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { emailConfigured } from "@/lib/email/resend";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const origin = process.env.APP_URL || new URL(request.url).origin;

  const { profile, projects, employment, education } = await loadCandidate(supabase, user.id);
  if (!profile?.onboarding_complete) return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });

  const [{ data: apps }, { data: scores }] = await Promise.all([
    supabase.from("applications").select("*").eq("user_id", user.id),
    supabase.from("job_scores").select("*, jobs(*)").eq("user_id", user.id).order("fit_score", { ascending: false }).limit(60),
  ]);

  // Anti-spray: only surface genuinely strong matches in the apply queue.
  // The fit bar is fixed; volume floats (spec rule 7). Tunable via env.
  const MIN_FIT = parseInt(process.env.APPLY_MIN_FIT, 10) || 70;

  const appByJob = new Map((apps || []).map((a) => [a.job_id, a]));
  const actionable = (scores || []).filter((s) => {
    const a = appByJob.get(s.job_id);
    return s.jobs && (!a || !TERMINAL_STATUSES.includes(a.status));
  });
  const queue = actionable.filter((s) => (s.fit_score ?? 0) >= MIN_FIT);

  if (!queue.length) {
    // Distinguish "nothing left" from "nothing strong enough to be worth applying".
    const weakWaiting = actionable.length;
    return NextResponse.json({
      done: true,
      remaining: 0,
      minFit: MIN_FIT,
      weakWaiting,
      reason: weakWaiting ? "no_strong_matches" : "caught_up",
      emailConfigured: emailConfigured(),
    });
  }

  const top = queue[0];
  const job = top.jobs;
  let application = appByJob.get(top.job_id) || null;

  if (!application) {
    if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });
    try {
      const ch = classifyChannel(job);
      // Never generate a contactless application: fall back to the account email.
      // If the microsite is published, weave its link into the outreach + email.
      const micrositeUrl = profile.public_enabled && profile.public_token ? `${origin}/r/${profile.public_token}` : null;
      const candProfile = { ...profile, contact_email: profile.contact_email || user.email };
      if (micrositeUrl) {
        const links = Array.isArray(candProfile.links) ? candProfile.links : [];
        if (!links.some((l) => l.url === micrositeUrl)) candProfile.links = [{ label: "Portfolio", url: micrositeUrl }, ...links];
      }
      const gen = await generateApplication({ job, score: top, profile: candProfile, projects, employment, education, micrositeUrl });
      const { data: saved, error } = await supabase
        .from("applications")
        .upsert(
          {
            user_id: user.id,
            job_id: top.job_id,
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
        )
        .select("*")
        .maybeSingle();
      if (error) throw error;
      application = saved;
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
      }
      logger.error("apply.generate_failed", { error: String(err?.message || err) });
      return NextResponse.json({ error: "Could not prepare this application." }, { status: 500 });
    }
  }

  return NextResponse.json({
    remaining: queue.length,
    emailConfigured: emailConfigured(),
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      url: job.url,
      source: job.source,
      location_type: job.location_type,
      apply_channel: job.apply_channel,
    },
    score: { fit_score: top.fit_score, trust_score: top.trust_score, why_it_fits: top.why_it_fits, scam_flags: top.scam_flags },
    application,
    profileLinks: profile.links || [],
  });
}
