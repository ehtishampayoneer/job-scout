// app/api/profile/publish/route.js
// Publish / unpublish the candidate microsite. User-initiated only (they decide
// whether it gets a URL). Generates an unguessable token on first publish.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = await request.json().catch(() => ({}));

  const { data: current } = await supabase.from("profile").select("public_token").eq("user_id", user.id).maybeSingle();
  const token = current?.public_token || crypto.randomBytes(9).toString("base64url");

  const patch = { public_token: token, updated_at: new Date().toISOString() };
  if (typeof b.enabled === "boolean") patch.public_enabled = b.enabled;
  if (typeof b.showEmail === "boolean") patch.public_show_email = b.showEmail;

  const { error } = await supabase.from("profile").update(patch).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update your page." }, { status: 500 });

  return NextResponse.json({ ok: true, token, enabled: patch.public_enabled ?? current?.public_enabled ?? false });
}
