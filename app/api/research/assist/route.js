// app/api/research/assist/route.js
// Generate a signup application/expert profile for one research platform.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESEARCH_PLATFORMS } from "@/lib/research/platforms";
import { writeResearchApplication } from "@/lib/research/assist";
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

  const body = await request.json().catch(() => ({}));
  const platform = RESEARCH_PLATFORMS.find((p) => p.id === body.platformId);
  if (!platform) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });

  const { data: profile } = await supabase
    .from("profile")
    .select("full_name, headline, summary, strengths, target_roles, location")
    .eq("user_id", user.id)
    .maybeSingle();

  try {
    const result = await writeResearchApplication({ platform, profile: profile || {} });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    }
    logger.error("research.assist_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not write your application. Try again." }, { status: 500 });
  }
}
