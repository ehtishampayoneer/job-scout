// app/inbox/page.js — server component. Loads the pipeline + both mail views.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  if (!supabaseConfigured()) return <SetupNeeded>Add your Supabase keys and restart.</SetupNeeded>;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profile").select("onboarding_complete").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const [{ data: apps }, { data: emails }, { data: interviews }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, sent_at, salary_ask, jobs(title, company)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("emails")
      .select("*, applications(jobs(title, company))")
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(200),
    supabase
      .from("interviews")
      .select("id, status, scheduled_at, location, application_id, jobs(title, company)")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
  ]);

  return <InboxClient email={user.email} apps={apps || []} emails={emails || []} interviews={interviews || []} />;
}
