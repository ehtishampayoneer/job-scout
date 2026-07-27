// app/api/inbound/route.js
// Inbound-email webhook. Point your email provider's inbound parse (Resend
// inbound, Postmark, or a Cloudflare Email Worker) at this URL with
// ?key=INBOUND_SECRET. Accepts several common payload shapes.
//
// Because the reply lands under a specific user's application inbox, we resolve
// the owning user from the application it matches; if it matches none, we store
// it against the sole onboarded user (single-user product).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordInbound, matchApplication } from "@/lib/email/inbound";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const secret = process.env.INBOUND_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  const auth = request.headers.get("authorization") || "";
  if (secret) {
    if (key !== secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Never accept unauthenticated inbound mail in production.
    return NextResponse.json({ error: "INBOUND_SECRET is not configured." }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const d = payload.data || payload; // Resend wraps in { data: {...} }
  const from = pick(d.from, d.sender, d["From"]);
  const to = pick(d.to, d.recipient, d["To"]);
  const subject = pick(d.subject, d["Subject"]) || "";
  const body = pick(d.text, d.body, d["text-plain"], d.stripped_text, htmlToText(d.html)) || "";

  if (!from) return NextResponse.json({ error: "no sender" }, { status: 400 });

  const admin = createAdminClient();

  // Resolve the owning user: whoever sent the application this reply matches,
  // else the single onboarded user.
  let userId = null;
  const { data: onboarded } = await admin.from("profile").select("user_id").eq("onboarding_complete", true).limit(2);
  if (onboarded?.length === 1) userId = onboarded[0].user_id;
  else {
    for (const p of onboarded || []) {
      if (await matchApplication(admin, p.user_id, from)) {
        userId = p.user_id;
        break;
      }
    }
    if (!userId && onboarded?.length) userId = onboarded[0].user_id;
  }
  if (!userId) return NextResponse.json({ error: "no user" }, { status: 202 });

  try {
    const result = await recordInbound(admin, userId, { from: addr(from), to: addr(to), subject, body });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("inbound.record_failed", { error: String(err?.message || err) });
    return NextResponse.json({ error: "could not record" }, { status: 500 });
  }
}

function pick(...vals) {
  for (const v of vals) if (v != null && String(v).trim()) return v;
  return "";
}
// Address fields can be strings or {address,name} or arrays of them.
function addr(v) {
  if (!v) return "";
  if (Array.isArray(v)) return addr(v[0]);
  if (typeof v === "object") return v.address || v.email || "";
  return String(v);
}
function htmlToText(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
