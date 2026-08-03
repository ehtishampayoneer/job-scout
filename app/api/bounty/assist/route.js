// app/api/bounty/assist/route.js
// Given a bounty (source + slug), fetch its full description and produce the
// plain-English explainer + winning proposal + how-to, tailored to the user.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBountyDetail } from "@/lib/bounties/sources";
import { assistWithBounty } from "@/lib/bounties/assist";
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
  const { source, ref, title, reward, token, type } = body || {};
  if (!ref || !title) return NextResponse.json({ error: "Missing bounty." }, { status: 400 });

  const [{ data: profile }, detail] = await Promise.all([
    supabase.from("profile").select("full_name, headline, summary, strengths, target_roles").eq("user_id", user.id).maybeSingle(),
    fetchBountyDetail(source || "superteam", ref),
  ]);

  try {
    const result = await assistWithBounty({
      bounty: { title, reward, token, type },
      description: detail?.description || "",
      profile: profile || {},
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    }
    logger.error("bounty.assist_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not analyze this bounty. Try again." }, { status: 500 });
  }
}
