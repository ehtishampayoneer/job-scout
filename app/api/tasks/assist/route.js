// app/api/tasks/assist/route.js
// Generate a practical "start earning here" guide for one task platform.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TASK_PLATFORMS } from "@/lib/tasks/platforms";
import { writeTaskGuide } from "@/lib/tasks/assist";
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
  const platform = TASK_PLATFORMS.find((p) => p.id === body.platformId);
  if (!platform) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });

  const { data: profile } = await supabase.from("profile").select("location").eq("user_id", user.id).maybeSingle();

  try {
    const result = await writeTaskGuide({ platform, location: profile?.location || "" });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    }
    logger.error("tasks.assist_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not write the guide. Try again." }, { status: 500 });
  }
}
