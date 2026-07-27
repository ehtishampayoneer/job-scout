// app/api/warm/update/route.js — update a warm target's status or message.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "reached", "replied", "dismissed"];

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch = {};
  if (b.status && STATUSES.includes(b.status)) patch.status = b.status;
  if (typeof b.draft_message === "string") patch.draft_message = b.draft_message;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabase.from("warm_targets").update(patch).eq("id", b.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
