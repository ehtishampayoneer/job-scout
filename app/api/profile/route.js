// app/api/profile/route.js
// GET  -> the signed-in user's master profile + projects.
// PUT  -> update editable profile fields (the master profile is editable anytime).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanProse } from "@/lib/onboarding";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("projects").select("*").eq("user_id", user.id).order("sort_order"),
  ]);

  return NextResponse.json({ profile: profile || null, projects: projects || [] });
}

const EDITABLE = [
  "full_name", "headline", "location", "summary", "salary_notes",
  "visa_status", "tone_notes", "contact_email", "contact_phone", "education_note",
];
const EDITABLE_ARRAYS = ["target_roles", "acceptable_locations", "strengths", "weaknesses"];

export async function PUT(request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const patch = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) {
    if (k in body) {
      const v = body[k];
      patch[k] = typeof v === "string" ? (k === "summary" ? cleanProse(v) : v.trim()) || null : v;
    }
  }
  for (const k of EDITABLE_ARRAYS) {
    if (k in body) {
      const v = body[k];
      patch[k] = Array.isArray(v)
        ? v.map((x) => String(x).trim()).filter(Boolean)
        : String(v || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    }
  }
  if ("salary_floor_usd" in body) {
    const n = Number(String(body.salary_floor_usd).replace(/[^0-9.]/g, ""));
    patch.salary_floor_usd = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if ("links" in body) {
    patch.links = Array.isArray(body.links)
      ? body.links
          .map((l) => ({ label: String(l?.label || "Link").trim(), url: String(l?.url || "").trim() }))
          .filter((l) => /^https?:\/\//i.test(l.url))
      : [];
  }

  const { error } = await supabase.from("profile").update(patch).eq("user_id", user.id);
  if (error) {
    logger.error("profile.update_failed", { error: error.message });
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
