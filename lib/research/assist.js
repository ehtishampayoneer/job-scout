// lib/research/assist.js
// Write a compelling, HONEST signup application / expert profile for a given
// research or expert-network platform, using the candidate's real background.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You write a candidate's application to JOIN a paid research or expert-network platform (like GLG, Respondent, User Interviews). The goal is to get them accepted so they can start doing paid tasks (calls, studies). Ground everything in their REAL background.

Return STRICT JSON:
{
  "bio": "A strong, specific expert bio / 'about you' for the signup profile — 60 to 110 words, first person, concrete about their real experience and the topics they can credibly speak to. No corporate filler, no em-dashes, no emoji.",
  "expertise_tags": ["short topic/skill tags this platform should match them on", "... up to 8, drawn from their real experience"],
  "tips": ["2 to 4 short, practical tips to get accepted and matched to well-paid tasks on THIS platform"]
}

Rules: never invent titles, employers, or expertise they do not have. Make them sound credible using only real facts. Be specific, not generic.`;

export async function writeResearchApplication({ platform, profile }) {
  const cand = [
    profile.full_name ? `Name: ${profile.full_name}` : "",
    profile.headline ? `Headline: ${profile.headline}` : "",
    profile.summary ? `Summary: ${clip(profile.summary, 600)}` : "",
    profile.strengths?.length ? `Strengths: ${profile.strengths.join(", ")}` : "",
    profile.target_roles?.length ? `Roles/expertise: ${profile.target_roles.join(", ")}` : "",
    profile.location ? `Location: ${profile.location}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `PLATFORM
${platform.name} — ${platform.category}. ${platform.what}
How it works: ${platform.howPaid}

CANDIDATE
${cand || "(sparse profile)"}

Write the JSON application now, tuned to what ${platform.name} looks for.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.5, maxTokens: 900 });
  const j = res.json || {};
  return {
    bio: cleanProse(String(j.bio || "")).trim(),
    expertise_tags: Array.isArray(j.expertise_tags) ? j.expertise_tags.map((t) => cleanProse(String(t)).trim()).filter(Boolean).slice(0, 8) : [],
    tips: Array.isArray(j.tips) ? j.tips.map((t) => cleanProse(String(t)).trim()).filter(Boolean).slice(0, 4) : [],
  };
}
