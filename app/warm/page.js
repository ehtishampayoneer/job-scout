// app/warm/page.js — server component. Loads warm targets + the latest learning.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { WarmClient } from "./WarmClient";

export const dynamic = "force-dynamic";

export default async function WarmPage() {
  if (!supabaseConfigured()) return <SetupNeeded>Add your Supabase keys and restart.</SetupNeeded>;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profile").select("onboarding_complete").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const [{ data: targets }, { data: learnings }] = await Promise.all([
    supabase.from("warm_targets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("learnings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
  ]);

  return <WarmClient email={user.email} targets={targets || []} latestLearning={(learnings || [])[0] || null} />;
}
