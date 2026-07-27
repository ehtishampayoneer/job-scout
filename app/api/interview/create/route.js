// app/api/interview/create/route.js
// Turn an interview invite into a tracked interview (linked to the application
// we sent), so it gets a schedule and a prep brief.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  if (!b.applicationId) return NextResponse.json({ error: "Missing applicationId." }, { status: 400 });

  const { data: app } = await supabase
    .from("applications")
    .select("id, job_id")
    .eq("id", b.applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  // Reuse an existing interview for this application if present.
  const { data: existing } = await supabase
    .from("interviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("application_id", app.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, id: existing.id, existing: true });

  const { data: row, error } = await supabase
    .from("interviews")
    .insert({ user_id: user.id, application_id: app.id, job_id: app.job_id, status: "proposed" })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not create interview." }, { status: 500 });

  // Move the application forward.
  await supabase.from("applications").update({ status: "interviewing", updated_at: new Date().toISOString() }).eq("id", app.id);

  return NextResponse.json({ ok: true, id: row.id });
}
