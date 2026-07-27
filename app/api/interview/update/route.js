// app/api/interview/update/route.js — set the schedule, link, status, or notes.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const STATUSES = ["proposed", "scheduled", "completed", "cancelled"];

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch = {};
  if ("scheduled_at" in b) patch.scheduled_at = b.scheduled_at || null;
  if (typeof b.location === "string") patch.location = b.location.trim() || null;
  if (typeof b.notes === "string") patch.notes = b.notes;
  if (b.status && STATUSES.includes(b.status)) patch.status = b.status;
  if (Array.isArray(b.proposed_slots)) patch.proposed_slots = b.proposed_slots;
  // Setting a time implies it is scheduled (unless explicitly overridden).
  if (patch.scheduled_at && !patch.status) patch.status = "scheduled";
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabase.from("interviews").update(patch).eq("id", b.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
