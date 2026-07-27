// app/api/onboarding/draft-story/route.js
// POST { project, profile, employment } -> { story }
// A grounded first-draft story for ONE project, for the user to approve/edit.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftStory } from "@/lib/onboarding";
import { hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!hasAnyProvider()) {
    return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body.project?.name) {
    return NextResponse.json({ error: "Add a project name first." }, { status: 400 });
  }

  try {
    const { story } = await draftStory({
      project: body.project,
      profile: body.profile || {},
      employment: Array.isArray(body.employment) ? body.employment : [],
    });
    return NextResponse.json({ story });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy. Try again in a moment." }, { status: 502 });
    }
    logger.error("draft_story.error", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not draft the story." }, { status: 500 });
  }
}
