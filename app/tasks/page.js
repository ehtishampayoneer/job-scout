// app/tasks/page.js — "Do it, get paid" directory. Pure task platforms (no
// competition, no bidding), flagged for the user's region.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { SetupNeeded } from "@/components/Brand";
import { TASK_PLATFORMS, taskFit } from "@/lib/tasks/platforms";
import { TasksClient } from "./TasksClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  if (!supabaseConfigured()) {
    return <SetupNeeded>Add your Supabase keys to <code>.env.local</code> and restart.</SetupNeeded>;
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profile").select("location").eq("user_id", user.id).maybeSingle();
  const location = profile?.location || "";

  const rank = { good: 0, maybe: 1 };
  const platforms = TASK_PLATFORMS
    .map((p) => ({ ...p, fit: taskFit(p, { location }) }))
    .sort((a, b) => rank[a.fit.level] - rank[b.fit.level]);

  return <TasksClient platforms={platforms} email={user.email} />;
}
