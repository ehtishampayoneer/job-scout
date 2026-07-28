// lib/apply/generate.js
// Generate a UNIQUELY TAILORED application for one job (spec Step 7):
//   - a salary ask calibrated to THIS company's stage/location/level
//   - the projects/skills reordered to match THIS job
//   - tone matched to the company
//   - a tailored one-page resume, a short human outreach note, and pre-filled
//     answers to the questions this kind of role usually asks.
//
// Writing rules (spec 0.5) are enforced in the prompt AND scrubbed afterward.
// Honesty (spec 0.6): only the candidate's real facts are used; nothing invented.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";

const SYSTEM = `You are the candidate's own hand, writing a job application the way a sharp, senior person actually writes when they respect their own time. It must read like they typed it in five minutes between meetings, not like a cover letter and not like AI.

THE OUTREACH NOTE — this is what gets read or ignored:
- 70 to 130 words. Open with substance, not a greeting-and-intent. NEVER open with "Dear <company> team", "I am writing to apply", "I am reaching out", or "My name is".
- BANNED phrases (never use any): "I am writing to apply", "I would welcome a conversation", "I am confident that", "I am a strong fit", "aligns with", "leverage my experience", "help you scale", "I can hit the ground running", "can start immediately", "thrilled", "excited", "passionate", "as you can see".
- It MUST show one concrete, specific thing about THIS company's actual product or approach that proves the candidate looked, not a restatement of the job title. If the job description gives you nothing specific, anchor on the concrete problem the role solves.
- Lead with the single most relevant proof from the candidate's real work, stated plainly. End with a short, direct line proposing a quick call. One idea per sentence. No lists.

HARD WRITING RULES everywhere (never break):
- Natural, plain, human prose. Short and specific. NO em-dashes. NO hashtags. NO emoji. NO bullet spray in the note.

HONESTY (never break — this is the whole product):
- Use ONLY skills, technologies, tools, metrics, employers, dates, and achievements that appear in the candidate's actual facts below. If it is not in their profile, it does NOT go in the resume, note, or answers. Full stop.
- NEVER add a skill or technology to match the job. If the job wants Kubernetes, GovCloud, observability, a security clearance, or anything the candidate's facts do not show, DO NOT list it. Do not imply it. Position their real, adjacent experience honestly instead, or leave it out.
- NEVER invent a metric or number (user counts, revenue, percentages, team sizes) that is not explicitly in their facts.
- A resume that claims skills the candidate does not have gets fact-checked in the first interview and destroys their credibility. Tailoring means CHOOSING and ORDERING their real strengths, never inventing new ones.
- Keep the candidate's honest framing. "AI work featured at the IV UNESCO Forum" must never become "UNESCO-endorsed".

TAILORING (within honesty — reorder and emphasize, never fabricate):
- Calibrate the salary ask to THIS company's apparent stage, location, and the seniority of the role. If the candidate gave a floor, stay at or above it and move toward their target when the role warrants it. If NO floor is given, infer a realistic, market-appropriate number yourself from the role level, the company, and the market. Give a single clear ask.
- Reorder the resume so the candidate's REAL projects, skills, and experience most relevant to THIS job lead. The skills list must be a subset of their actual skills, never expanded to match the posting.
- Match tone to the company: scrappy and direct for an early startup, more measured for an enterprise.

Return ONLY strict JSON:
{
  "salary_ask": "a single clear ask, e.g. '$5,000 per month' or '$90,000 per year', no paragraph",
  "subject": "a plain, specific email subject line",
  "note_text": "the outreach note, 90 to 160 words, plain human prose, one specific detail about them, ending with a simple invitation to talk",
  "answers": [ {"question": "a question this role's application would ask", "answer": "the candidate's tailored answer in their voice"} ],
  "resume_md": "a tailored one-page resume in Markdown: name and headline, a 2 line summary, most-relevant experience with dates, most-relevant projects, skills, education, and links. Reordered for THIS job."
}`;

// Safety net: strip the cover-letter filler openings if the model still emits
// them, so the note starts with substance.
function stripFiller(s) {
  let t = String(s || "").trim();
  t = t.replace(/^(dear|hi|hello|greetings)\b[^,.\n]{0,40}[,.]\s*/i, "");
  t = t.replace(/^i am writing to apply[^.]*\.\s*/i, "");
  t = t.replace(/^i am reaching out[^.]*\.\s*/i, "");
  t = t.replace(/^my name is[^.]*\.\s*/i, "");
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.trim();
}

export async function generateApplication({ job, score, profile, projects = [], employment = [], education = [], micrositeUrl = null }) {
  const cand = [
    `Name: ${profile.full_name || ""}`,
    profile.headline ? `Headline: ${profile.headline}` : "",
    profile.location ? `Location: ${profile.location}` : "",
    profile.contact_email ? `Email: ${profile.contact_email}` : "",
    micrositeUrl ? `Portfolio page (reference it once, naturally, in the note): ${micrositeUrl}` : "",
    profile.summary ? `Summary: ${clip(profile.summary, 700)}` : "",
    profile.salary_floor_usd ? `Salary floor: $${profile.salary_floor_usd}/month. Target: ${profile.salary_notes || "higher over time"}` : "",
    profile.visa_status ? `Visa/work authorization: ${profile.visa_status}` : "",
    profile.tone_notes ? `Preferred tone: ${profile.tone_notes}` : "",
    profile.education_note ? `Education note: ${profile.education_note}` : "",
    profile.strengths?.length ? `Strengths: ${profile.strengths.join(", ")}` : "",
    profile.links?.length ? `Links: ${profile.links.map((l) => `${l.label} ${l.url}`).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const work = employment
    .map((e) => {
      const dates = [e.start_year ? `${e.start_year}` : "", e.is_current ? "Present" : e.end_year ? `${e.end_year}` : ""].filter(Boolean).join(" to ");
      return `- ${e.title || ""} at ${e.company || ""} (${dates})${e.location ? `, ${e.location}` : ""}: ${clip(e.summary || "", 300)}`;
    })
    .join("\n");

  const proj = projects
    .map((p) => `- ${p.name}: ${clip(p.one_liner || p.description || "", 200)} [${(p.stack || []).join(", ")}]${p.story ? ` Story: ${clip(p.story, 300)}` : ""}${p.links?.length ? ` (${p.links.map((l) => l.url).join(", ")})` : ""}`)
    .join("\n");

  const edu = education
    .map((e) => `- ${[e.credential, e.field].filter(Boolean).join(" ")} ${e.institution ? `at ${e.institution}` : ""} ${[e.start_year, e.end_year].filter(Boolean).join(" to ")}`.trim())
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
Salary listed: ${job.salary_range || "not listed"}
Why it fits (from screening): ${score?.why_it_fits || ""}
Description: ${clip(job.raw_text || "", 2600)}

Write the tailored application JSON now.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.6, maxTokens: 2600 });
  const j = res.json || {};

  const answers = Array.isArray(j.answers)
    ? j.answers
        .filter((a) => a && (a.question || a.answer))
        .slice(0, 8)
        .map((a) => ({ question: cleanProse(String(a.question || "")), answer: cleanProse(String(a.answer || "")) }))
    : [];

  return {
    salary_ask: cleanProse(String(j.salary_ask || "")).slice(0, 120),
    subject: cleanProse(String(j.subject || `Application: ${job.title}`)).slice(0, 200),
    note_text: stripFiller(cleanProse(String(j.note_text || ""))),
    answers,
    resume_md: cleanProse(String(j.resume_md || "")),
    provider: res.provider,
  };
}
