// lib/email/tag.js — classify one inbound reply and map it to a pipeline status.
import { callAI } from "@/lib/ai-router";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You classify a single inbound email reply to a job application into exactly ONE tag. Be decisive. Return strict JSON only:
{"tag":"interview|rejection|question|scam|other","reason":"a few words"}
- interview: they want to talk, schedule a call, or move to next steps.
- rejection: they are declining or not moving forward.
- question: they ask for information, a task, or clarification.
- scam: suspicious. Asks for money, fees, training payment, bank or personal financial details, or is clearly fake.
- other: autoreplies, acknowledgements, anything else.`;

const ALLOWED = ["interview", "rejection", "question", "scam", "other"];

export async function tagEmail({ from = "", subject = "", body = "" }) {
  const res = await callAI({
    system: SYSTEM,
    prompt: `From: ${from}\nSubject: ${subject}\n\n${clip(body, 2200)}\n\nClassify now.`,
    json: true,
    temperature: 0.1,
    maxTokens: 120,
  });
  const t = res.json?.tag;
  return {
    tag: ALLOWED.includes(t) ? t : "other",
    reason: String(res.json?.reason || "").slice(0, 80),
  };
}

// A reply always means they responded; interview/rejection advance further.
export function statusForTag(tag) {
  if (tag === "interview") return "interviewing";
  if (tag === "rejection") return "rejected";
  return "responded";
}
