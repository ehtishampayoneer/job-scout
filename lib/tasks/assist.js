// lib/tasks/assist.js
// A practical, honest "start earning here" guide for one do-task-get-paid
// platform: how to pass the one-time gate, tips to earn well, and a straight
// expectation of the money.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";

const SYSTEM = `You help someone START EARNING on a "do a task, get paid" platform (microtasks, AI data annotation, testing, transcription). Be practical and HONEST — no hype, no false promises of big money.

Return STRICT JSON:
{
  "how_to_start": ["clear step 1 to sign up and pass the one-time gate/assessment", "step 2", "... up to 5 concrete steps"],
  "earn_tips": ["a practical tip to earn more / avoid rejections / pick good tasks on THIS platform", "... 2 to 4 tips"],
  "honest_expectation": "one honest sentence on realistic pay and time — what a normal person actually makes here, no exaggeration"
}

Be specific to the platform. Never promise a salary. If English or a webcam/mic is needed, say so.`;

export async function writeTaskGuide({ platform, location = "" }) {
  const prompt = `PLATFORM
${platform.name} — ${platform.category}. ${platform.what}
Pay: ${platform.pay}
Gate: ${platform.gate}
${location ? `The user is based in: ${location}` : ""}

Write the JSON start guide, honest and practical.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.4, maxTokens: 800 });
  const j = res.json || {};
  return {
    how_to_start: Array.isArray(j.how_to_start) ? j.how_to_start.map((s) => cleanProse(String(s)).trim()).filter(Boolean).slice(0, 5) : [],
    earn_tips: Array.isArray(j.earn_tips) ? j.earn_tips.map((s) => cleanProse(String(s)).trim()).filter(Boolean).slice(0, 4) : [],
    honest_expectation: cleanProse(String(j.honest_expectation || "")).trim(),
  };
}
