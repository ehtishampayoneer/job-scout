// app/api/apply/skip/route.js
// Dismiss a job so the queue moves on. Records a dismissed application so it
// won't resurface.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId;
  if (!jobId) return NextResponse.json({ error: "Missing jobId." }, { status: 400 });

  const { error } = await supabase
    .from("applications")
    .upsert(
      { user_id: user.id, job_id: jobId, status: "dismissed", updated_at: new Date().toISOString() },
      { onConflict: "user_id,job_id" }
    );
  if (error) return NextResponse.json({ error: "Could not skip." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
