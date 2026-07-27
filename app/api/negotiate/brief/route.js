// app/api/negotiate/brief/route.js
// Generate a negotiation brief for an application (or a free-form role), with an
// optional offer number on the table.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateNegotiationBrief } from "@/lib/negotiate/brief";
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
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const b = await request.json().catch(() => ({}));

  const { data: profile } = await supabase
    .from("profile")
    .select("salary_floor_usd, salary_notes, acceptable_locations, visa_status, headline")
    .eq("user_id", user.id)
    .maybeSingle();

  let job = {};
  let application = {};
  if (b.applicationId) {
    const { data: app } = await supabase
      .from("applications")
      .select("salary_ask, jobs(title, company, source, location_type, salary_range, raw_text)")
      .eq("id", b.applicationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (app) {
      application = { salary_ask: app.salary_ask };
      job = app.jobs || {};
    }
  } else {
    job = {
      title: (b.title || "").slice(0, 160),
      company: (b.company || "").slice(0, 120),
      salary_range: (b.salary_range || "").slice(0, 80),
      raw_text: (b.jobText || "").slice(0, 4000),
    };
  }

  try {
    const brief = await generateNegotiationBrief({ job, application, profile: profile || {}, offer: (b.offer || "").slice(0, 80) });
    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    logger.error("negotiate.brief_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not build the brief." }, { status: 500 });
  }
}
