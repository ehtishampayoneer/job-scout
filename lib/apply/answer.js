// lib/apply/answer.js
// Answer ONE arbitrary question a company's application form asks, grounded in
// the candidate's real facts, this specific job/company, and the tailored
// materials already generated. Same honesty rules as the application generator.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You are the candidate's own hand, answering ONE question from a job application form. Write exactly what they would paste into the box: honest, specific, plain-spoken, and grounded strictly in their real facts and this job/company.

RULES (never break):
- Use ONLY the candidate's real facts below. NEVER invent skills, tools, metrics, employers, or experience to fit the question. If the question probes something they lack, say so honestly and pivot to their real, adjacent strength.
- Work authorization, visa, relocation, salary, notice period: answer TRUTHFULLY from their stated location, visa status, and preferences versus THIS job's country. Never imply authorization they do not have. If they would need sponsorship, say so plainly.
- Natural, human prose. Short and direct. NO em-dashes, NO hashtags, NO emoji, NO corporate filler ("thrilled", "passionate", "I am confident that", "leverage", "hit the ground running").
- Describe their work by WHAT IT DID, not by project name or jargon.
- Match length to the question: a yes/no or logistics question gets one or two sentences; an open "why/tell us" question gets one tight, concrete paragraph. Never pad.

Return ONLY the answer text, ready to paste. No preamble, no surrounding quotes, do not restate the question.`;

export async function answerApplicationQuestion({ job, profile, projects = [], employment = [], education = [], application = null, question }) {
  const cand = [
    `Name: ${profile.full_name || ""}`,
    profile.headline ? `Headline: ${profile.headline}` : "",
    profile.location ? `Location: ${profile.location}` : "",
    profile.visa_status ? `Visa/work authorization: ${profile.visa_status}` : "",
    profile.salary_notes ? `Salary expectation: ${profile.salary_notes}` : "",
    profile.summary ? `Summary: ${clip(profile.summary, 700)}` : "",
    profile.strengths?.length ? `Strengths: ${profile.strengths.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const work = employment
    .map((e) => {
      const dates = [e.start_year || "", e.is_current ? "Present" : e.end_year || ""].filter(Boolean).join(" to ");
      return `- ${e.title || ""} at ${e.company || ""} (${dates}): ${clip(e.summary || "", 260)}`;
    })
    .join("\n");

  const proj = projects
    .map((p) => `- ${p.name}: ${clip(p.one_liner || p.description || "", 200)} [${(p.stack || []).join(", ")}]`)
    .join("\n");

  const edu = education
    .map((e) => `- ${[e.credential, e.field].filter(Boolean).join(" ")} ${e.institution ? `at ${e.institution}` : ""}`.trim())
    .join("\n");

  const prompt = `CANDIDATE
${cand}

WORK HISTORY
${work || "(none provided)"}

PROJECTS
${proj || "(none provided)"}

EDUCATION
${edu || profile.education_note || "(none provided)"}

THE JOB
Title: ${job.title}
Company: ${job.company || "(unknown)"}
Location: ${job.location_raw || job.location_type || ""}
Description: ${clip(job.raw_text || "", 1600)}
${application?.note_text ? `\nOUTREACH NOTE ALREADY WRITTEN (keep the answer consistent with its tone and claims):\n${clip(application.note_text, 700)}\n` : ""}
THE QUESTION THIS FORM ASKS:
${question}

Write the candidate's honest, ready-to-paste answer now.`;

  const res = await callAI({ system: SYSTEM, prompt, json: false, temperature: 0.5, maxTokens: 500 });
  return { answer: cleanProse(String(res.text || "").trim()) };
}
