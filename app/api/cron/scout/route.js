// app/api/cron/scout/route.js
// Scheduled Scout (Vercel cron). Runs for every onboarded user using the
// service-role client. Secured by CRON_SECRET (Vercel sends it as a Bearer
// token; a ?key= query param is also accepted for manual testing).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScoutForUser } from "@/lib/scout/run";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  const key = new URL(request.url).searchParams.get("key");
  if (secret) {
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Never leave the scheduled runner open in production.
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profile")
    .select("user_id")
    .eq("onboarding_complete", true);
  if (error) {
    logger.error("cron.profiles_failed", { error: error.message });
    return NextResponse.json({ error: "could not load profiles" }, { status: 500 });
  }

  const results = [];
  for (const p of profiles || []) {
    try {
      results.push({ user: p.user_id, ...(await runScoutForUser(p.user_id, admin)) });
    } catch (e) {
      logger.error("cron.user_failed", { user: p.user_id, error: String(e?.message || e) });
      results.push({ user: p.user_id, error: String(e?.message || e) });
    }
  }
  return NextResponse.json({ ok: true, ran: results.length, results });
}
