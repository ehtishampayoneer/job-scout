// app/negotiate/page.js — server loader; lists applications to negotiate for.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { NegotiateClient } from "./NegotiateClient";

export const dynamic = "force-dynamic";

export default async function NegotiatePage() {
  if (!supabaseConfigured()) return <SetupNeeded>Add your Supabase keys and restart.</SetupNeeded>;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profile").select("onboarding_complete, salary_floor_usd, salary_notes").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const { data: apps } = await supabase
    .from("applications")
    .select("id, salary_ask, status, jobs(title, company)")
    .eq("user_id", user.id)
    .neq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(100);

  return <NegotiateClient email={user.email} apps={apps || []} profile={profile} />;
}
