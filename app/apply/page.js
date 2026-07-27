// app/apply/page.js — server gate; the queue is driven client-side.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { ApplyClient } from "./ApplyClient";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  if (!supabaseConfigured()) return <SetupNeeded>Add your Supabase keys and restart.</SetupNeeded>;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profile").select("onboarding_complete").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_complete) redirect("/onboarding");
  return <ApplyClient email={user.email} />;
}
