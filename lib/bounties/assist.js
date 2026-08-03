// lib/bounties/assist.js
// For one bounty + the candidate's profile, produce: a plain-English explainer,
// an honest can-you-do-it read, a punchy winning proposal, and concrete steps.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You help a job seeker WIN a paid bounty (a task with real money already committed). Given the bounty and the candidate's real profile, produce four things — honest, concrete, and genuinely useful.

Return STRICT JSON:
{
  "what_it_is": "Explain in plain, simple words what this bounty actually asks for and what a finished, winning submission looks like — as if explaining to a smart beginner. 3 to 5 short sentences. Strip the jargon.",
  "can_you_do_it": "One honest line: is this realistically doable for THIS candidate, alone or with AI help? If it needs a skill they lack, name what they'd lean on (AI, learning, a template).",
  "proposal": "A short, punchy pitch the candidate submits to win the bounty: why they are a strong fit (grounded ONLY in their real profile) and their concrete approach. Confident, specific, human. 90 to 140 words. No corporate filler, no em-dashes, no emoji.",
  "approach": ["concrete step 1 to actually complete it", "step 2", "... up to 6 steps, and say plainly where AI does the heavy lifting"]
}

Rules: never claim skills or experience the candidate does not have. If they would rely on AI for part of it, say so plainly. Be practical, not fluffy.`;

export async function assistWithBounty({ bounty, description, profile }) {
  const cand = [
    profile.full_name ? `Name: ${profile.full_name}` : "",
    profile.headline ? `Headline: ${profile.headline}` : "",
    profile.summary ? `Summary: ${clip(profile.summary, 500)}` : "",
    profile.strengths?.length ? `Strengths: ${profile.strengths.join(", ")}` : "",
    profile.target_roles?.length ? `Target roles: ${profile.target_roles.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `BOUNTY
Title: ${bounty.title}
Reward: ${bounty.reward || "?"} ${bounty.token || ""}
Type: ${bounty.type || "bounty"}
Full description:
${clip(description || "(no description available — infer from the title)", 3200)}

CANDIDATE
${cand || "(sparse profile)"}

Produce the JSON now.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.5, maxTokens: 1200 });
  const j = res.json || {};
  return {
    what_it_is: cleanProse(String(j.what_it_is || "")).trim(),
    can_you_do_it: cleanProse(String(j.can_you_do_it || "")).trim(),
    proposal: cleanProse(String(j.proposal || "")).trim(),
    approach: Array.isArray(j.approach) ? j.approach.map((s) => cleanProse(String(s)).trim()).filter(Boolean).slice(0, 6) : [],
  };
}
