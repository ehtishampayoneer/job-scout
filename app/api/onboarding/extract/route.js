// app/api/onboarding/extract/route.js
// POST { cvText } -> a structured draft to pre-fill the review form.
// Extraction only; the user reviews and corrects everything afterward.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromCv, emptyDraft } from "@/lib/onboarding";
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const cvText = typeof body.cvText === "string" ? body.cvText.slice(0, 24000) : "";

  // No CV pasted (user chose to fill the form from scratch): return a blank draft.
  if (!cvText.trim()) return NextResponse.json({ draft: emptyDraft() });

  if (!hasAnyProvider()) {
    return NextResponse.json(
      { error: "No LLM key is configured. Add a free GEMINI_API_KEY and restart.", draft: emptyDraft() },
      { status: 503 }
    );
  }

  try {
    const { draft } = await extractFromCv(cvText);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      logger.error("extract.ai_failed", { attempts: err.attempts });
      return NextResponse.json(
        { error: "Could not read the CV automatically. You can still fill the form in.", draft: emptyDraft() },
        { status: 502 }
      );
    }
    logger.error("extract.error", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Something went wrong reading the CV.", draft: emptyDraft() }, { status: 500 });
  }
}
