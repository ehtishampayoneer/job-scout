// lib/scout/score.js
// LLM fit + trust/scam scoring for one job against the candidate brief.
// One compact JSON call per job. Honest and calibrated, not generous.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "./util";

const SYSTEM = `You are a seasoned technical recruiter. You score, honestly and strictly, how well a specific job fits a specific candidate, and how trustworthy the hiring company looks. Do not be generous; a mediocre match scores in the 40s, not the 70s. Return strict JSON only, no prose around it.`;

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

Score this job for THIS candidate and return JSON exactly:
{
  "fit_score": <int 0-100: role-level match, tech overlap, remote/visa fit, salary realism>,
  "why_it_fits": "<one honest sentence, max 18 words, why it does or does not fit>",
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
