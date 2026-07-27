// app/interview/[id]/page.js — server loader for one interview + its context.
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { InterviewClient } from "./InterviewClient";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }) {
  if (!supabaseConfigured()) return <SetupNeeded>Add your Supabase keys and restart.</SetupNeeded>;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: iv } = await supabase
    .from("interviews")
    .select("*, jobs(title, company, url, location_type), applications(note_text, salary_ask, answers_json, resume_md, to_email)")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!iv) notFound();

  const { data: profile } = await supabase.from("profile").select("public_token, public_enabled, links").eq("user_id", user.id).maybeSingle();

  return <InterviewClient email={user.email} iv={iv} profile={profile || {}} />;
}
