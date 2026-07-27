// app/profile/page.js — server component. Loads the master profile + projects,
// gates on auth/onboarding, and hands data to the client editor.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_complete) redirect("/onboarding");

  const [{ data: projects }, { data: employment }, { data: education }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("employment").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("education").select("*").eq("user_id", user.id).order("sort_order"),
  ]);

  return (
    <ProfileClient
      initialProfile={profile}
      initialProjects={projects || []}
      initialEmployment={employment || []}
      initialEducation={education || []}
      email={user.email}
    />
  );
}
