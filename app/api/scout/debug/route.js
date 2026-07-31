// TEMPORARY — reports the apply-channel + source breakdown of stored jobs so we
// can see how many email-apply roles actually exist. Delete after use.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USER = "b1c832b0-6714-4ba1-af27-0e935511d1ec";

export async function GET() {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("jobs")
    .select("apply_channel, source, title, company")
    .eq("user_id", USER)
    .limit(1000);

  const byChannel = {};
  const bySource = {};
  const emailSamples = [];
  for (const j of jobs || []) {
    byChannel[j.apply_channel || "?"] = (byChannel[j.apply_channel || "?"] || 0) + 1;
    bySource[j.source || "?"] = (bySource[j.source || "?"] || 0) + 1;
    if (j.apply_channel === "email-apply" && emailSamples.length < 8) {
      emailSamples.push(`${j.title} @ ${j.company} (${j.source})`);
    }
  }

  return NextResponse.json({
    totalStored: (jobs || []).length,
    byChannel,
    bySource,
    emailSamples,
  });
}
