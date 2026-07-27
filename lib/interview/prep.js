// lib/interview/prep.js
// Generate a company-specific interview prep brief. Crucially, it is grounded in
// what we ACTUALLY told the company in the application (the note, answers, salary
// ask), so the candidate's talk track stays on the same page as their pitch.
// Honesty: only real facts; ideal answers reinforce what was already claimed.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You are an interview coach preparing a specific candidate for a specific interview. You are given the job, what the candidate ALREADY told this company in their application, and the candidate's real background. Produce a tight, honest prep brief. The "ideal answers" MUST stay consistent with what the candidate already told this company (never contradict the application) and must use only true facts about the candidate.

No em-dashes, no hashtags, no emoji, no filler. Be concrete and specific to THIS role.

Return ONLY strict JSON:
{
  "company_summary": "3 to 4 sentences on what the company does and why it matters, from the job text",
  "role_summary": "2 to 3 sentences on the role and what they most want",
  "likely_questions": [ {"question": "a question they are likely to ask", "ideal_answer": "how the candidate should answer, in their voice, using their real work, 2 to 4 sentences"} ],
  "talking_points": ["the strongest things the candidate should make sure to land"],
  "watch_outs": ["honest risks to manage, e.g. framing a gap"]
}
Give 6 to 8 likely_questions covering behavioral, technical, and role-fit.`;

export async function generatePrep({ job, application, profile, projects = [] }) {
  const told = [
    application?.note_text ? `Outreach note we sent: ${clip(application.note_text, 700)}` : "",
    application?.salary_ask ? `Salary ask we stated: ${application.salary_ask}` : "",
    application?.answers_json?.answers?.length
      ? `Answers we gave: ${application.answers_json.answers.map((a) => `${a.question} -> ${a.answer}`).join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const cand = [
    `Candidate: ${profile.full_name}, ${profile.headline || ""}`,
    profile.summary ? `Summary: ${clip(profile.summary, 500)}` : "",
    profile.strengths?.length ? `Strengths: ${profile.strengths.join(", ")}` : "",
    profile.weaknesses?.length ? `Honest weaknesses: ${profile.weaknesses.join(", ")}` : "",
    profile.education_note ? `Education note: ${profile.education_note}` : "",
    projects?.length ? `Projects: ${projects.map((p) => `${p.name} (${clip(p.one_liner || "", 80)})`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `THE JOB
Title: ${job.title}
Company: ${job.company || "(unknown)"}
Description: ${clip(job.raw_text || "", 2400)}

WHAT WE ALREADY TOLD THIS COMPANY (stay consistent with this)
${told || "(nothing recorded)"}

THE CANDIDATE
${cand}

Write the prep brief JSON now.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.4, maxTokens: 2200 });
  const j = res.json || {};
  const arr = (v) => (Array.isArray(v) ? v.map((x) => cleanProse(String(x))).filter(Boolean) : []);
  return {
    company_summary: cleanProse(String(j.company_summary || "")),
    role_summary: cleanProse(String(j.role_summary || "")),
    likely_questions: Array.isArray(j.likely_questions)
      ? j.likely_questions
          .filter((q) => q && (q.question || q.ideal_answer))
          .slice(0, 10)
          .map((q) => ({ question: cleanProse(String(q.question || "")), ideal_answer: cleanProse(String(q.ideal_answer || "")) }))
      : [],
    talking_points: arr(j.talking_points),
    watch_outs: arr(j.watch_outs),
    generated_at: new Date().toISOString(),
  };
}
