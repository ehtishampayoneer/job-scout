// lib/negotiate/brief.js
// The negotiation brain. Triangulates a defensible ASK RANGE from four signals:
//   1) the posting's own range (if any)   2) company stage/scale
//   3) role type + seniority               4) market/location reality
// against the candidate's floor and target. Honest: this is an informed estimate
// from market knowledge + captured data, not a live proprietary salary feed.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You are a sharp compensation negotiation coach for a senior candidate. Give honest, defensible guidance, not fantasy numbers and not timid ones. Your job is to stop the candidate leaving money on the table while keeping the ask winnable.

How to set the number:
- Anchor on the posting's stated range if given. If none, estimate from the company's stage and scale, the role type and seniority, and the market and location.
- Account for location reality: a US-remote role, an EU role, and a location-adjusted global rate differ a lot. Be realistic about a remote candidate's leverage, but do not lowball a strong senior operator.
- Keep the ask at or above the candidate's floor, and push toward or above their target when the role and company justify it.
- Recommend a RANGE plus a single anchor number, never one naive figure.

Be explicit that these are informed estimates, not exact market data.

No em-dashes, no hashtags, no emoji, no filler. Return ONLY strict JSON:
{
  "ask_range": "e.g. '$7,000 to $9,000 per month' or '$120k to $150k per year'",
  "anchor": "the single number to open with and why in a few words",
  "reasoning": "3 to 5 sentences: how stage, level, market, and the posting produced this range",
  "counter_script": "exactly what to say when they ask your expectation, or after they give a number",
  "scenarios": [ {"situation": "e.g. They lowball / They ask your number first / They say we can't go higher / Offer is equity heavy", "response": "what to say"} ],
  "watch_outs": ["honest cautions"]
}`;

export async function generateNegotiationBrief({ job = {}, application = {}, profile = {}, offer = "" }) {
  const ctx = [
    `Role: ${job.title || "(unknown)"}`,
    `Company: ${job.company || "(unknown)"}`,
    job.source ? `Source (stage hint): ${job.source}` : "",
    job.location_type ? `Location type: ${job.location_type}` : "",
    job.salary_range ? `Posting salary/range: ${job.salary_range}` : "Posting salary: not listed",
    application?.salary_ask ? `What we already asked for in the application: ${application.salary_ask}` : "",
    offer ? `THEIR OFFER on the table: ${offer}` : "No offer number yet (preparing the ask).",
    "",
    `Candidate floor: ${profile.salary_floor_usd ? `$${profile.salary_floor_usd}/month` : "unknown"}`,
    profile.salary_notes ? `Candidate salary notes/target: ${profile.salary_notes}` : "",
    profile.acceptable_locations?.length ? `Candidate acceptable locations: ${profile.acceptable_locations.join(", ")}` : "",
    profile.visa_status ? `Visa/relocation: ${profile.visa_status}` : "",
    profile.headline ? `Candidate level: ${profile.headline}` : "",
    "",
    `Job description (for stage/scale signal): ${clip(job.raw_text || "", 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await callAI({ system: SYSTEM, prompt: `${ctx}\n\nProduce the negotiation brief JSON now.`, json: true, temperature: 0.4, maxTokens: 1600 });
  const j = res.json || {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    ask_range: cleanProse(String(j.ask_range || "")),
    anchor: cleanProse(String(j.anchor || "")),
    reasoning: cleanProse(String(j.reasoning || "")),
    counter_script: cleanProse(String(j.counter_script || "")),
    scenarios: arr(j.scenarios)
      .filter((s) => s && (s.situation || s.response))
      .slice(0, 6)
      .map((s) => ({ situation: cleanProse(String(s.situation || "")), response: cleanProse(String(s.response || "")) })),
    watch_outs: arr(j.watch_outs).map((x) => cleanProse(String(x))).filter(Boolean),
  };
}
