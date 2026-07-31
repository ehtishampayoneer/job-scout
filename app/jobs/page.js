// app/jobs/page.js — server component. Loads the user's scored jobs, ranked.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { JobsClient } from "./JobsClient";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  if (!supabaseConfigured()) {
    return <SetupNeeded>Add your Supabase keys to <code>.env.local</code> and restart.</SetupNeeded>;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("onboarding_complete")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const [{ data: rows }, { data: apps }] = await Promise.all([
    supabase
      .from("job_scores")
      .select("*, jobs(*)")
      .eq("user_id", user.id)
      .order("fit_score", { ascending: false })
      .limit(200),
    supabase.from("applications").select("job_id, status, sent_at, updated_at").eq("user_id", user.id),
  ]);

  const statusByJob = {};
  const appliedAtByJob = {};
  for (const a of apps || []) {
    statusByJob[a.job_id] = a.status;
    appliedAtByJob[a.job_id] = a.sent_at || a.updated_at || null;
  }

  return <JobsClient initialRows={rows || []} statusByJob={statusByJob} appliedAtByJob={appliedAtByJob} />;
}
