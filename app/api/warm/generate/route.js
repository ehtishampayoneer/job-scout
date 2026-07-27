// app/api/warm/generate/route.js
// Surface warm targets from the highest-fit companies the Scout has found and
// draft a human intro for each.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverWarmTarget } from "@/lib/warm/discover";
import { hasAnyProvider, AllProvidersFailedError } from "@/lib/ai-router";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!hasAnyProvider()) return NextResponse.json({ error: "No LLM key configured." }, { status: 503 });

  const [{ data: profile }, { data: projects }, { data: scores }, { data: existing }] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("projects").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("job_scores").select("fit_score, jobs(company)").eq("user_id", user.id).gte("fit_score", 55).order("fit_score", { ascending: false }).limit(60),
    supabase.from("warm_targets").select("name").eq("user_id", user.id),
  ]);
  if (!profile?.onboarding_complete) return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });

  const have = new Set((existing || []).map((w) => (w.name || "").toLowerCase()));
  const companies = [];
  for (const s of scores || []) {
    const c = s.jobs?.company;
    if (!c || have.has(c.toLowerCase())) continue;
    if (companies.includes(c)) continue;
    companies.push(c);
    if (companies.length >= 6) break;
  }
  if (!companies.length) {
    return NextResponse.json({ ok: true, added: 0, message: "No new strong-fit companies to reach yet. Run the scout for more matches first." });
  }

  const rows = [];
  for (const company of companies) {
    try {
      const t = await discoverWarmTarget({ company, profile, projects: projects || [] });
      if (t.draft_message) rows.push({ user_id: user.id, status: "new", ...t });
    } catch (e) {
      if (e instanceof AllProvidersFailedError) break;
      logger.warn("warm.draft_failed", { company, error: String(e?.message || e) });
    }
  }
  if (rows.length) await supabase.from("warm_targets").insert(rows);
  return NextResponse.json({ ok: true, added: rows.length });
}
