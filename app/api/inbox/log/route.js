// app/api/inbox/log/route.js
// Manually log an inbound reply (e.g. paste one you received elsewhere). Runs
// the same record + AI-tag + pipeline-advance path as the webhook, so tracking
// works fully even before the email domain is wired up.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordInbound } from "@/lib/email/inbound";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  if (!b.from && !b.body) return NextResponse.json({ error: "Add at least a sender or a message." }, { status: 400 });

  try {
    const result = await recordInbound(supabase, user.id, {
      from: (b.from || "").trim(),
      to: (b.to || "").trim(),
      subject: (b.subject || "").trim(),
      body: (b.body || "").trim(),
      applicationId: b.applicationId || null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("inbox.log_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "Could not log the reply." }, { status: 500 });
  }
}
