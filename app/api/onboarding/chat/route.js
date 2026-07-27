// app/api/onboarding/chat/route.js
// One turn of the expert onboarding conversation. Stateless: the client sends
// the CV, transcript, and profile-so-far; we return the expert's next message
// and the updated profile.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatTurn, emptyDraft } from "@/lib/onboarding";
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
  if (!hasAnyProvider()) {
    return NextResponse.json(
      { error: "No LLM key is configured. Add a free GEMINI_API_KEY and restart." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const cvText = typeof body.cvText === "string" ? body.cvText.slice(0, 24000) : "";
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  const draft = body.draft && typeof body.draft === "object" ? body.draft : emptyDraft();

  try {
    const turn = await chatTurn({ cvText, messages, draft });
    return NextResponse.json(turn);
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again in a moment." }, { status: 502 });
    }
    logger.error("onboarding.chat_error", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
