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

THE OUTREACH NOTE — short, concrete, and about THEM as much as the candidate (70 to 120 words, every sentence earning its place):
- Open with substance. NEVER a greeting-and-intent. NEVER open with "Dear <company> team", "I am writing to apply", "I am reaching out", or "My name is".
- Describe the candidate's most relevant work by WHAT IT ACTUALLY DOES and what was hard, in plain words a hiring manager instantly pictures. NEVER lead with a project's name and NEVER hide behind vague jargon. The reader does not know or care what "HOLOS" or "Marketing Genie" is called; they care what it does. WRONG: "my work on HOLOS required zero-trust data flows and partner enablement". RIGHT: "I built a marketplace where shoppers place a product in their own room in augmented reality at true size before buying, with full seller and admin dashboards." Concrete, visual, and true. If you name a project at all, name it AFTER describing what it does, in passing.
- Show you understand what THIS company actually builds or the problem it solves (prove you looked, do not restate the job title), then connect it to a specific, concrete benefit the candidate would bring THEM: how their real experience helps this company build or grow the exact thing it cares about. Make the value to the company obvious.
- One idea per sentence. No lists. End with a short, direct line proposing a quick call.
- BANNED phrases (never use any): "I am writing to apply", "I would welcome a conversation", "I am confident that", "I am a strong fit", "aligns with", "leverage my experience", "help you scale", "I can hit the ground running", "can start immediately", "thrilled", "excited", "passionate", "as you can see".

HARD WRITING RULES everywhere (never break) — the goal is prose no reader would ever tag as "AI-generated", achieved by being SPECIFIC and REAL, not generic:
- Natural, plain, human prose. NO em-dashes. NO hashtags. NO emoji. NO bullet spray in the note.
- The #1 tell of AI writing is VAGUE COMPETENCE ("proven track record", "results-driven", "passionate about leveraging cutting-edge solutions"). BAN it. Every sentence must carry a concrete, specific detail only THIS candidate could write: a real project and what was hard about it, a real number, a real company, a real decision they made. Specificity is what makes it read human.
- Vary the rhythm. Mix short punchy sentences with a longer one. Do not start consecutive sentences the same way. Do not write in a uniform, list-like cadence.
- Write the way a sharp, busy person actually types: direct, a little imperfect, confident, not polished into corporate mush. Contractions are fine.
- NEVER use: "I am excited/thrilled/passionate", "proven track record", "results-driven", "leverage", "spearheaded", "synergy", "dynamic", "in today's fast-paced", "I am confident that", "align with", "hit the ground running", "wear many hats". These scream template.

HONESTY (never break — this is the whole product):
- Use ONLY skills, technologies, tools, metrics, employers, dates, and achievements that appear in the candidate's actual facts below. If it is not in their profile, it does NOT go in the resume, note, or answers. Full stop.
- NEVER add a skill or technology to match the job. If the job wants Kubernetes, GovCloud, observability, a security clearance, or anything the candidate's facts do not show, DO NOT list it. Do not imply it. Position their real, adjacent experience honestly instead, or leave it out.
- NEVER invent a metric or number (user counts, revenue, percentages, team sizes) that is not explicitly in their facts.
- A resume that claims skills the candidate does not have gets fact-checked in the first interview and destroys their credibility. Tailoring means CHOOSING and ORDERING their real strengths, never inventing new ones.
- Keep the candidate's honest framing. "AI work featured at the IV UNESCO Forum" must never become "UNESCO-endorsed".

TAILORING (within honesty — reorder and emphasize, never fabricate):
- SALARY ASK — anchor to the JOB, not the candidate's self-estimate:
  * If the job posting lists a salary or range ("Salary listed" above), your ask MUST sit inside or at the TOP of that range. NEVER ask for less than the job already offers — if it lists $250k, do NOT suggest $120k just because the candidate's stated target is lower. Leaving the employer's own money on the table is a serious failure. A listed $200k–$260k role gets an ask around $250k+.
  * Only if NO salary is listed do you infer a market rate from the role level, company stage, and location — and even then, aim at the strong end for the seniority, not the candidate's floor.
  * The candidate's stated target/floor is a MINIMUM, never a ceiling. Always move UP toward what the role and market support. Give a single clear ask.
- Reorder the resume so the candidate's REAL projects, skills, and experience most relevant to THIS job lead. The skills list must be a subset of their actual skills, never expanded to match the posting.
- Match tone to the company: scrappy and direct for an early startup, more measured for an enterprise.

THE PRE-FILLED ANSWERS — cover the questions real application forms almost ALWAYS ask, so they are ready to paste, in this order:
1. Work authorization / visa sponsorship — answer TRUTHFULLY from the candidate's location and visa status versus THIS job's country. If they are not a resident of the job's country and would need sponsorship, say so plainly (e.g. "I am based in <country>, not a resident of <job country>; I would need visa sponsorship"). If they are already authorized there, say that. NEVER fudge or imply authorization they do not have — this is the single most disqualifying thing to get wrong.
2. Earliest availability / notice period (if unknown, a reasonable honest default like "available within 2 to 4 weeks").
3. Why this company specifically — grounded in what the company actually does, not the job title.
4. Remote / timezone fit — their location and overlap with the role.
Then add at most one or two genuinely role-specific questions this posting implies. Keep every answer short, specific, honest, and in the candidate's voice.

Return ONLY strict JSON:
{
  "salary_ask": "a single clear ask, e.g. '$5,000 per month' or '$90,000 per year', no paragraph",
  "subject": "a plain, specific email subject line",
  "note_text": "the outreach note per the rules above: substance-first, projects described by what they DO not by name, shows real understanding of the company and a concrete benefit to them, 70 to 120 words",
  "answers": [ {"question": "a question this role's application would ask", "answer": "the candidate's real, specific answer in their voice, describing work by what it did not by project name"} ],
  "resume_md": "a tailored one-page resume in Markdown: name and headline, a 2 line summary, most-relevant experience with dates, then projects where EACH project is one plain line stating what it does and the hard part (not just a name plus a tech list), then a skills list that is a strict subset of the candidate's real skills, education, and links. Reordered for THIS job."
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
