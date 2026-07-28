// lib/scout/score.js
// LLM fit + trust/scam scoring for one job against the candidate brief.
// One compact JSON call per job. Honest and calibrated, not generous.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "./util";

const SYSTEM = `You are a pragmatic career advisor scoring a job as an OPPORTUNITY for a specific candidate. The question is NOT "does this title match their dream job" — it is "is this a strong, high-quality opportunity this person can realistically WIN and grow from." Score to maximize their actual outcome, not to match their loftiest title. Return strict JSON only.

How to score fit (0-100):
- Can they clearly do the work (skills, domain, seniority)? A candidate being MORE senior or experienced than the role strictly needs is a MILD PLUS at a good company (they will win it easily and it is a foot in the door), NOT a penalty. Do not mark down for "overqualified" unless the role is genuinely junior or low-level.
- Company quality: a real, reputable company (especially a strong AI or tech company) raises the score; a great company with a merely-good-fit role still beats a perfect-title role at a weak or sketchy company.
- REGION FIT is decisive: can this role actually hire this candidate given where they are and their work authorization? A role that is remote-worldwide or open to their country is a big plus. A role that is US-only / requires local presence / needs a security clearance the candidate lacks / is onsite in a country they are not in should score LOW (25 or below) no matter how well the title matches — they cannot get it.
- Reward roles that are winnable, well-paid enough, and a real step forward.

Calibration: a genuinely strong, winnable role at a good company that can hire this person = 78-92. A solid, realistic opportunity = 65-78. A real mismatch or a role they cannot be hired for = under 45.`;

export async function scoreJob(job, brief) {
  const prompt = `CANDIDATE:
${brief}

JOB:
Title: ${job.title}
Company: ${job.company || "(unknown)"}
Location: ${job.location_raw || "(unknown)"}
Salary listed: ${job.salary_range || "not listed"}
Source: ${job.source}
Description: ${clip(job.raw_text, 2500)}

Score this job as an OPPORTUNITY for THIS candidate and return JSON exactly:
{
  "fit_score": <int 0-100: winnable + high-quality opportunity for them, weighting can-they-do-it, company quality, and REGION/work-authorization fit>,
  "why_it_fits": "<one honest sentence, max 18 words, why it is or is not a strong opportunity for them>",
  "trust_score": <int 0-100: how legitimate the company/posting looks>,
  "scam_flags": ["<short flag>", ...]
}
Lower the trust score for: vague descriptions with no company specifics, upfront-fee or pay-for-training language, requests for money or personal financial details, only a free personal email as contact, or unrealistic pay. Empty array if nothing is suspicious.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.3, maxTokens: 400 });
  const j = res.json || {};
  return {
    fit_score: clampInt(j.fit_score),
    why_it_fits: clip(cleanProse(String(j.why_it_fits || "")), 200),
    trust_score: clampInt(j.trust_score, 50),
    scam_flags: Array.isArray(j.scam_flags) ? j.scam_flags.slice(0, 6).map((x) => clip(String(x), 60)) : [],
  };
}

function clampInt(v, fallback = 0) {
  const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}
