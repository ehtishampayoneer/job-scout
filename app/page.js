// app/page.js — the gate.
// Sends the user to the right place:
//   no keys       -> a friendly setup screen
//   not signed in -> /login
//   no profile    -> /onboarding
//   ready         -> /profile
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!supabaseConfigured()) {
    return (
      <SetupNeeded>
        Create a Supabase project, then copy <code>.env.local.example</code> to{" "}
        <code>.env.local</code> and fill in <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
        <code>SUPABASE_SERVICE_ROLE_KEY</code>. Run <code>db/schema.sql</code> in
        the Supabase SQL editor, then restart the dev server.
      </SetupNeeded>
    );
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
  redirect("/profile");
}
