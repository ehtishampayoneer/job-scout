// app/api/onboarding/complete/route.js
// Finalize onboarding: write the master profile, work history, education, and
// projects. All writes run as the signed-in user (RLS enforces ownership).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeDraft, missingSlots } from "@/lib/onboarding";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

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

  const draft = normalizeDraft(body.draft || {});
  const cvText = typeof body.cvText === "string" ? body.cvText.slice(0, 24000) : null;

  // Enforce the same required fields the form validates, server-side.
  const missing = missingSlots(draft);
  if (missing.length) {
    return NextResponse.json({ error: `Still needed: ${missing.join(", ")}.`, missing }, { status: 422 });
  }

  const { profile } = draft;
  // 1) Master profile (one row per user).
  const { error: pErr } = await supabase.from("profile").upsert(
    {
      user_id: user.id,
      full_name: profile.full_name,
      headline: profile.headline || null,
      location: profile.location || null,
      contact_email: profile.contact_email || null,
      contact_phone: profile.contact_phone || null,
      summary: profile.summary || null,
      salary_floor_usd: profile.salary_floor_usd || null,
      salary_notes: profile.salary_notes || null,
      target_roles: profile.target_roles,
      acceptable_locations: profile.acceptable_locations,
      visa_status: profile.visa_status || null,
      tone_notes: profile.tone_notes || null,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      education_note: profile.education_note || null,
      links: profile.links,
      raw_cv: cvText,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (pErr) {
    logger.error("complete.profile_failed", { error: pErr.message });
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }

  // 2) Replace child collections (idempotent: wipe this user's rows, re-insert).
  await Promise.all([
    supabase.from("employment").delete().eq("user_id", user.id),
    supabase.from("education").delete().eq("user_id", user.id),
    supabase.from("projects").delete().eq("user_id", user.id),
  ]);

  const insertions = [];
  if (draft.employment.length) {
    insertions.push(
      supabase.from("employment").insert(
        draft.employment.map((e, i) => ({ user_id: user.id, ...e, sort_order: i }))
      )
    );
  }
  if (draft.education.length) {
    insertions.push(
      supabase.from("education").insert(
        draft.education.map((e, i) => ({ user_id: user.id, ...e, sort_order: i }))
      )
    );
  }
  if (draft.projects.length) {
    insertions.push(
      supabase.from("projects").insert(
        draft.projects.map((p, i) => ({
          user_id: user.id,
          name: p.name,
          one_liner: p.one_liner || null,
          description: p.description || null,
          story: p.story || null,
          stack: p.stack,
          links: p.links,
          sort_order: i,
        }))
      )
    );
  }

  const results = await Promise.all(insertions);
  const failed = results.find((r) => r.error);
  if (failed) {
    logger.error("complete.children_failed", { error: failed.error.message });
    return NextResponse.json({ error: "Saved your profile, but some details failed to save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
