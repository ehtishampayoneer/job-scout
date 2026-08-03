// app/api/profile/chat/route.js
// Update the profile by plain-language chat ("add X", "change my target roles",
// "I now need sponsorship"). Applies the edit and saves it.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editProfileFromMessage } from "@/lib/profile/edit";
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

  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Tell me what you'd like to change." }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: "That request is too long." }, { status: 400 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const { data: profile } = await supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "No profile yet." }, { status: 400 });

  try {
    const { patch, reply } = await editProfileFromMessage(profile, message, body.history || []);
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("profile")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
    }
    return NextResponse.json({ reply, patch, changed: Object.keys(patch) });
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json({ error: "The AI is busy (or over quota). Try again shortly." }, { status: 502 });
    }
    logger.error("profile.chat_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not update your profile. Try again." }, { status: 500 });
  }
}
