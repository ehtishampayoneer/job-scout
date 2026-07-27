// app/api/interview/draft-reply/route.js
// Draft a short, human scheduling reply to the company (propose your availability
// or confirm a time). The user reviews and sends it.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const SYSTEM = `You write a short, warm, professional scheduling reply to a company that invited the candidate to interview. Plain and human, like the candidate typed it. No em-dashes, no hashtags, no emoji, never "I am thrilled/excited". 40 to 80 words. Thank them briefly, then clearly offer the availability given (or confirm the proposed time), and say you are happy to work around them. Return ONLY the message text.`;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const { data: profile } = await supabase.from("profile").select("full_name").eq("user_id", user.id).maybeSingle();

  const prompt = `Candidate name: ${profile?.full_name || ""}
Your availability to offer (or the time to confirm): ${b.slots || "a few options across the next few days"}
${b.timezone ? `Time zone: ${b.timezone}` : ""}
Write the scheduling reply now.`;

  try {
    const res = await callAI({ system: SYSTEM, prompt, json: false, temperature: 0.6, maxTokens: 300 });
    return NextResponse.json({ ok: true, text: cleanProse(String(res.text || "").trim()) });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) return NextResponse.json({ error: "The AI is busy. Try again shortly." }, { status: 502 });
    return NextResponse.json({ error: "Could not draft the reply." }, { status: 500 });
  }
}
