// app/bounties/page.js — the Bounty board. Fetches live open bounties (paid
// tasks with committed money) and renders them for the signed-in user.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { fetchBounties } from "@/lib/bounties/sources";
import { BountiesClient } from "./BountiesClient";

export const dynamic = "force-dynamic";

export default async function BountiesPage() {
  if (!supabaseConfigured()) {
    return <SetupNeeded>Add your Supabase keys to <code>.env.local</code> and restart.</SetupNeeded>;
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bounties = await fetchBounties({ take: 60 });
  return <BountiesClient initialBounties={bounties} email={user.email} />;
}
