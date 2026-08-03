// app/research/page.js — Paid Research & Expert Calls directory. Flags each
// platform's fit for the signed-in user (region + seniority) before they invest time.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { RESEARCH_PLATFORMS, eligibilityFor } from "@/lib/research/platforms";
import { ResearchClient } from "./ResearchClient";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
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
    .select("location, headline, target_roles")
    .eq("user_id", user.id)
    .maybeSingle();

  const location = profile?.location || "";
  const text = `${profile?.headline || ""} ${(profile?.target_roles || []).join(" ")}`.toLowerCase();
  const seniorish = /senior|lead|head|director|vp|vice president|chief|principal|manager|founder|cto|ceo|coo|officer|architect|specialist|consultant/.test(text);

  const rank = { good: 0, maybe: 1, limited: 2 };
  const platforms = RESEARCH_PLATFORMS
    .map((p) => ({ ...p, fit: eligibilityFor(p, { location, seniorish }) }))
    .sort((a, b) => rank[a.fit.level] - rank[b.fit.level]);

  return <ResearchClient platforms={platforms} email={user.email} />;
}
