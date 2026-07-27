// lib/learn/analyze.js
// The learning loop (spec Step 10): read the application funnel and give an
// honest coaching read plus ONE concrete adjustment. If responses are very low
// after many sends, it says plainly there may be a positioning problem rather
// than telling the candidate to apply harder.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";

const SYSTEM = `You are a sharp, honest job-search coach reading a candidate's application funnel. Give a brief read of what the numbers say and ONE concrete adjustment to try next. If many applications have gone out with very few responses, say plainly that this is likely a positioning or targeting problem, and that applying harder is not the fix. Do not pad. No em-dashes, no hashtags, no emoji.

Return strict JSON: {"notes":"2 to 4 sentences","adjustment":"one concrete next action","warning": true or false}
Set warning true only when the data suggests a real positioning problem (for example many sends, near-zero responses).`;

export function computeStats(apps, emails) {
  const byStatus = {};
  for (const a of apps) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  const sent = apps.filter((a) => a.status !== "draft" && a.status !== "dismissed").length;
  const responded = apps.filter((a) => ["responded", "interviewing", "offer"].includes(a.status)).length;
  const interviewing = byStatus.interviewing || 0;
  const offers = byStatus.offer || 0;
  const rejected = byStatus.rejected || 0;
  const replies = emails.filter((e) => e.direction === "in").length;
  const tagCounts = {};
  for (const e of emails.filter((e) => e.direction === "in")) tagCounts[e.ai_tag || "other"] = (tagCounts[e.ai_tag || "other"] || 0) + 1;
  return {
    total_prepared: apps.length,
    sent,
    responded,
    interviewing,
    offers,
    rejected,
    inbound_replies: replies,
    response_rate: sent ? Math.round((responded / sent) * 100) : 0,
    interview_rate: sent ? Math.round((interviewing / sent) * 100) : 0,
    reply_tags: tagCounts,
  };
}

export async function analyzeFunnel(stats) {
  const res = await callAI({
    system: SYSTEM,
    prompt: `Funnel stats: ${JSON.stringify(stats)}\n\nGive the JSON now.`,
    json: true,
    temperature: 0.4,
    maxTokens: 400,
  });
  const j = res.json || {};
  return {
    notes: cleanProse(String(j.notes || "")),
    adjustment: cleanProse(String(j.adjustment || "")),
    warning: Boolean(j.warning),
  };
}
