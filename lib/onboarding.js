// lib/onboarding.js
// Hybrid onboarding (spec Step 1), v3.
//
// Two LLM jobs, both honest and grounded:
//   extractFromCv(cvText)  -> one structured draft (basics, links, work history
//                             WITH dates, education, projects) to PRE-FILL a form
//                             the user reviews and corrects. It never has to be
//                             perfect; the user fixes it.
//   draftStory({...})      -> a first-draft project story built ONLY from the
//                             facts we already have, clearly a draft the user
//                             approves or edits. It never invents specifics.
//
// The structured facts (dates, education, links) come from the form, so nothing
// a job application needs gets missed, and nothing is fabricated behind the user.
import { callAI } from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// Draft shape — the single contract shared by extract, the form, and the DB.
// ---------------------------------------------------------------------------
export function emptyDraft() {
  return {
    profile: {
      full_name: "",
      headline: "",
      location: "",
      contact_email: "",
      contact_phone: "",
      summary: "",
      salary_floor_usd: "",
      salary_notes: "",
      target_roles: [],
      acceptable_locations: [],
      visa_status: "",
      tone_notes: "",
      strengths: [],
      weaknesses: [],
      education_note: "",
      links: [], // [{label, url}]
    },
    employment: [], // [{company,title,start_month,start_year,end_month,end_year,is_current,location,summary}]
    education: [], // [{institution,credential,field,start_year,end_year,notes}]
    projects: [], // [{name,one_liner,description,story,stack[],links[]}]
  };
}

// ---------------------------------------------------------------------------
// 1) EXTRACTION — turn a pasted CV into the structured draft.
// ---------------------------------------------------------------------------
const EXTRACT_SYSTEM = `You are an expert career strategist and technical recruiter. You are handed a person's CV or LinkedIn export and you BUILD THEM A BRILLIANT PROFILE: you extract the facts, then you intelligently decide the best senior roles they should target and present them in the strongest honest light. The person should read the result and think "that is exactly me, at my best." Do not make them fill anything in themselves.

Two different jobs, treated differently:

FACTS (never invent): employers, job titles, dates, degrees, and specific project details. Extract only what is clearly in the text. If a fact is not there, leave it empty. Keep their honest framing ("AI work featured at the IV UNESCO Forum" must never become "UNESCO-endorsed").

ANALYSIS (this is where you are smart, using the real evidence):
- "target_roles": DECIDE the 4 to 6 best-fit SENIOR roles/designations this person should aim for, based on their actual experience and level. Never leave this empty. Examples of the register: CTO, Head of AI, VP Engineering, Principal Engineer, Founding Engineer, Director of Engineering, Staff Engineer, Lead AI Architect, Technical Product Leader, Fractional CTO. Choose the ones that genuinely fit THIS person; do not just copy that list.
- "headline": write one sharp, specific headline that captures who they are at their strongest (e.g. "CTO and AI/AR product architect, 16 years shipping end to end").
- "summary": write a compelling, honest, first-person professional summary (3 to 5 sentences) that would make a hiring manager take them seriously. Ground every claim in the CV. This should read brilliantly, not like a form field.
- "strengths": pull 3 to 5 real strengths evidenced by their history.
- "acceptable_locations": infer sensible defaults (for a remote-oriented candidate, include "Remote worldwide"; add specific regions only if the CV signals them).
- "salary_floor_usd": leave null. Salary is calibrated per company later, not here.

Other rules:
- Ignore export noise: lines like "Show all N media", "Thumbnail for ...", "<Company> logo".
- Dates: convert "2024 - Present" to start_year 2024 and is_current true; "Jul 2013 - Jul 2016" to start_month 7 start_year 2013, end_month 7 end_year 2016. Year only means fill the year, leave month null.
- Do not write project stories here (leave "story" blank). Stories are captured separately.
- Plain human prose. No em-dashes, no hashtags, no emoji, no "thrilled/excited".

Return ONLY strict JSON in this exact shape (use [] and "" for anything absent):
{
  "profile": {
    "full_name": "", "headline": "", "location": "", "contact_email": "", "contact_phone": "",
    "summary": "", "salary_floor_usd": null, "salary_notes": "",
    "target_roles": [], "acceptable_locations": [], "visa_status": "", "tone_notes": "",
    "strengths": [], "weaknesses": [], "education_note": "",
    "links": [ {"label": "LinkedIn", "url": "https://..."} ]
  },
  "employment": [
    {"company": "", "title": "", "start_month": null, "start_year": null, "end_month": null, "end_year": null, "is_current": false, "location": "", "summary": ""}
  ],
  "education": [
    {"institution": "", "credential": "", "field": "", "start_year": null, "end_year": null, "notes": ""}
  ],
  "projects": [
    {"name": "", "one_liner": "", "description": "", "story": "", "stack": [], "links": [ {"label": "Live", "url": "https://..."} ]}
  ]
}`;

export async function extractFromCv(cvText = "") {
  const clean = stripNoise(cvText);
  if (!clean) return { draft: emptyDraft(), provider: null };

  const res = await callAI({
    system: EXTRACT_SYSTEM,
    prompt: `CV / pasted text:\n${clean}\n\nExtract the JSON now.`,
    json: true,
    temperature: 0.2,
    maxTokens: 3000,
  });

  return { draft: normalizeDraft(res.json || {}), provider: res.provider };
}

// ---------------------------------------------------------------------------
// 2) STORY DRAFT — grounded, honest first draft for ONE project.
// ---------------------------------------------------------------------------
const STORY_SYSTEM = `You write a short first-draft "story" for one project the user built, so they can approve or edit it rather than write from scratch. Ground it STRICTLY in the facts provided (the description, stack, and role). Do not invent specific metrics, client names, incidents, or outcomes that are not implied by the facts. It is fine to describe a realistic engineering challenge that the described work clearly involved, framed so the user can correct the specifics.

Voice: first person, plain, human. 3 to 5 sentences. Cover, if the facts support it: what was genuinely hard or what broke, the key decision made, and what they would do differently now. No em-dashes, no hashtags, no emoji, no "thrilled/excited", no corporate filler. Return ONLY the story text, no preamble, no quotes.`;

export async function draftStory({ project = {}, profile = {}, employment = [] } = {}) {
  const facts = [
    `Project: ${project.name || "(unnamed)"}`,
    project.one_liner ? `One-liner: ${project.one_liner}` : "",
    project.description ? `Description: ${project.description}` : "",
    project.stack?.length ? `Stack: ${project.stack.join(", ")}` : "",
    profile.headline ? `Their role/level: ${profile.headline}` : "",
    employment?.length ? `Context: ${employment.slice(0, 2).map((e) => `${e.title} at ${e.company}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await callAI({
    system: STORY_SYSTEM,
    prompt: `Facts about the project:\n${facts}\n\nWrite the first-draft story now.`,
    json: false,
    temperature: 0.7,
    maxTokens: 400,
  });

  return { story: cleanProse(String(res.text || "").trim()), provider: res.provider };
}

// ---------------------------------------------------------------------------
// Completion gating — what a real application needs before we call it done.
// ---------------------------------------------------------------------------
export function missingSlots(draft) {
  const p = draft?.profile || {};
  const miss = [];
  // Only the things the system genuinely cannot infer for you. Target roles,
  // locations, salary, and visa are recommended/calibrated automatically, so
  // they never block saving.
  if (!p.full_name) miss.push("your name");
  if (!p.contact_email) miss.push("a contact email");
  if (!(draft?.employment || []).length) miss.push("at least one work-history entry");
  return miss;
}

// ---------------------------------------------------------------------------
// 3) THE EXPERT CONVERSATION — the onboarding chat.
// The candidate hands over a CV; a top career strategist reviews it, advises on
// strategy, asks sharp questions, and shapes a perfect profile together.
// ---------------------------------------------------------------------------
const CONSULTANT_SYSTEM = `You are an elite career strategist and technical recruiter, personally advising ONE senior candidate you were hired by. You are NOT a form and NOT a generic chatbot. You talk like a sharp, warm expert: direct, specific, genuinely useful, a little opinionated.

You receive the candidate's CV, the profile built so far, and the conversation. You are building a perfect professional profile WITH them, through conversation.

YOUR FIRST MESSAGE must do three things, in a natural short paragraph (not a list):
1. An honest read of their CV: what is genuinely strong, and what is missing, thin, or working against them. Be real and specific, not flattering.
2. Your strategic take: the roles you would target, the markets or countries that give them the best odds, and a realistic salary range, each with a one-line reason.
3. Then ONE focused question to go deeper.

EVERY LATER MESSAGE:
- Absorb their answer into the profile (via the patch).
- React like an expert first (a quick opinion, a suggestion, a reframe), then ask the ONE next most useful question.
- Over the conversation, draw out: the real story behind their top 2 to 3 projects (what was hard or broke, the key decision, what they would redo), their constraints and preferences (locations, remote vs relocation, visa, timing, salary expectations), and anything the CV left unclear.
- If an answer is vague or weak, push ONCE for a concrete specific, then move on. Never loop. Never fabricate to fill a gap.
- Keep advising: if you see stronger positioning, a better role, or a smarter market, say so plainly.

FINISHING: when you have their name, a contact email, at least one real role with dates, a couple of genuine project stories, and a clear target, set "complete" to true and give a short, confident sign-off: tell them the profile is ready and that you will now go find and prepare tailored applications for them.

HONESTY: never invent employers, dates, degrees, or achievements. Strategy and framing are yours; facts are theirs.
WRITING: plain, human, sharp. No em-dashes, no hashtags, no emoji, never "thrilled/excited", no corporate filler. Keep replies to 2 to 6 sentences.

Return ONLY strict JSON:
{
  "reply": "what you say now: your expert take and AT MOST ONE question",
  "complete": false,
  "patch": {
    "profile": { any of: full_name, headline, location, contact_email, contact_phone, summary, salary_notes, visa_status, tone_notes, education_note, target_roles(string[]), acceptable_locations(string[]), strengths(string[]), weaknesses(string[]) },
    "links": [ {"label":"","url":""} ],
    "projects": [ {"name":"","one_liner":"","description":"","story":"","stack":[],"links":[]} ],
    "employment": [ {"company":"","title":"","start_year":null,"end_year":null,"is_current":false,"location":"","summary":""} ],
    "education": [ {"institution":"","credential":"","field":"","start_year":null,"end_year":null} ]
  }
}
Only include in the patch what changed or was newly learned this turn. The system merges it into the profile, so never resend the whole thing.`;

export async function chatTurn({ cvText = "", messages = [], draft = emptyDraft() }) {
  const current = normalizeDraft(draft);
  const isFirst = !messages.some((m) => m.role === "assistant");
  const transcript = messages.map((m) => `${m.role === "user" ? "CANDIDATE" : "YOU"}: ${stripNoise(m.content)}`).join("\n");

  const prompt = [
    "CANDIDATE CV (may be blank if they started from scratch):",
    stripNoise(cvText) || "(none)",
    "",
    "PROFILE BUILT SO FAR (read-only; send only a patch of changes):",
    JSON.stringify(current),
    "",
    "CONVERSATION SO FAR:",
    transcript || "(none yet)",
    "",
    isFirst
      ? "This is your FIRST message. Review the CV, give your strategic take, and ask your first question."
      : "Continue: absorb their latest answer into the patch, react, and ask the next single question (or finish if the profile is strong).",
    "",
    "Respond with the JSON object only.",
  ].join("\n");

  const res = await callAI({ system: CONSULTANT_SYSTEM, prompt, json: true, temperature: 0.6, maxTokens: 3000 });
  const out = res.json || {};
  const merged = mergePatch(current, out.patch || {});
  const reply = cleanProse(String(out.reply || "").trim()) || "Tell me a bit more about what you are looking for.";
  return { reply, complete: Boolean(out.complete), draft: merged, provider: res.provider };
}

// Deterministic merge so nothing the candidate said is ever lost.
export function mergePatch(draft, patch) {
  const base = normalizeDraft(draft);
  if (!patch || typeof patch !== "object") return base;
  const pp = patch.profile || {};

  for (const k of ["full_name", "headline", "location", "contact_email", "contact_phone", "visa_status", "tone_notes", "education_note", "salary_notes"]) {
    if (typeof pp[k] === "string" && pp[k].trim()) base.profile[k] = pp[k].trim();
  }
  if (typeof pp.summary === "string" && pp.summary.trim()) base.profile.summary = cleanProse(pp.summary.trim());
  if (pp.salary_floor_usd != null && pp.salary_floor_usd !== "") {
    const n = num(pp.salary_floor_usd);
    if (n) base.profile.salary_floor_usd = n;
  }
  for (const k of ["target_roles", "acceptable_locations", "strengths", "weaknesses"]) {
    if (pp[k] != null) base.profile[k] = unionArr(base.profile[k], arr(pp[k]));
  }
  base.profile.links = unionLinks(base.profile.links, patch.links || pp.links);

  if (Array.isArray(patch.projects)) {
    for (const raw of patch.projects) {
      if (!raw?.name || !String(raw.name).trim()) continue;
      const inc = normProject(raw);
      const key = projKey(inc.name);
      const ex = base.projects.find((x) => projKey(x.name) === key);
      if (ex) {
        ex.one_liner = ex.one_liner || inc.one_liner;
        ex.description = ex.description || inc.description;
        if (inc.story) ex.story = inc.story;
        ex.stack = unionArr(ex.stack, inc.stack);
        ex.links = unionLinks(ex.links, inc.links);
      } else if (inc.one_liner || inc.description || inc.story || inc.stack.length) {
        base.projects.push(inc);
      }
    }
  }
  if (Array.isArray(patch.employment) && patch.employment.length) {
    base.employment = patch.employment.map(normJob).filter((e) => e.company || e.title);
  }
  if (Array.isArray(patch.education) && patch.education.length) {
    base.education = patch.education.map(normEdu).filter((e) => e.institution || e.credential || e.field);
  }
  return base;
}

function unionArr(a, b) {
  const seen = new Set();
  const out = [];
  for (const x of [...(a || []), ...(b || [])]) {
    const s = String(x || "").trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}
function unionLinks(a, b) {
  return links([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
}
function projKey(name) {
  return String(name || "").toLowerCase().split(/\s[—–-]\s|:/)[0].trim();
}

// ---------------------------------------------------------------------------
// Normalization — coerces any loose object (from the LLM or the form) into the
// clean draft shape used everywhere. Never throws.
// ---------------------------------------------------------------------------
export function normalizeDraft(draft) {
  const base = emptyDraft();
  const p = draft?.profile || {};
  base.profile = {
    full_name: str(p.full_name),
    headline: str(p.headline),
    location: str(p.location),
    contact_email: str(p.contact_email),
    contact_phone: str(p.contact_phone),
    summary: p.summary ? cleanProse(String(p.summary)) : "",
    salary_floor_usd: num(p.salary_floor_usd) || "",
    salary_notes: str(p.salary_notes),
    target_roles: arr(p.target_roles),
    acceptable_locations: arr(p.acceptable_locations),
    visa_status: str(p.visa_status),
    tone_notes: str(p.tone_notes),
    strengths: arr(p.strengths),
    weaknesses: arr(p.weaknesses),
    education_note: str(p.education_note),
    links: links(p.links),
  };
  base.employment = Array.isArray(draft?.employment)
    ? draft.employment.filter((e) => e && (e.company || e.title)).map(normJob)
    : [];
  base.education = Array.isArray(draft?.education)
    ? draft.education.filter((e) => e && (e.institution || e.credential || e.field)).map(normEdu)
    : [];
  base.projects = Array.isArray(draft?.projects)
    ? draft.projects.filter((x) => x && x.name && String(x.name).trim()).map(normProject)
    : [];
  return base;
}

function normJob(e) {
  return {
    company: str(e.company),
    title: str(e.title),
    start_month: intOrNull(e.start_month),
    start_year: intOrNull(e.start_year),
    end_month: intOrNull(e.end_month),
    end_year: intOrNull(e.end_year),
    is_current: Boolean(e.is_current),
    location: str(e.location),
    summary: e.summary ? cleanProse(String(e.summary)) : "",
  };
}
function normEdu(e) {
  return {
    institution: str(e.institution),
    credential: str(e.credential),
    field: str(e.field),
    start_year: intOrNull(e.start_year),
    end_year: intOrNull(e.end_year),
    notes: str(e.notes),
  };
}
function normProject(x) {
  return {
    name: String(x.name || "").trim(),
    one_liner: str(x.one_liner),
    description: str(x.description),
    story: x.story ? cleanProse(String(x.story)) : "",
    stack: arr(x.stack),
    links: links(x.links),
  };
}

// ---------------------------------------------------------------------------
// Writing-rule guardrail + tiny helpers
// ---------------------------------------------------------------------------
export function cleanProse(text) {
  if (!text) return text;
  return String(text)
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/#/g, "")
    .replace(/\bI['’]?m (thrilled|excited|delighted)\b/gi, "I would be glad")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function str(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}
function num(v) {
  if (v == null || v === "") return "";
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : "";
}
function intOrNull(v) {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function arr(v) {
  const list = Array.isArray(v) ? v : typeof v === "string" && v.trim() ? v.split(",") : [];
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const s = String(x || "").trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}
function links(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const seen = new Set();
  for (const l of v) {
    const url = typeof l === "string" ? l : l?.url;
    if (!url || !/^https?:\/\//i.test(String(url).trim())) continue;
    const u = String(url).trim();
    const key = u.toLowerCase().replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const label = typeof l === "object" && l?.label ? String(l.label).trim() : labelFromUrl(u);
    out.push({ label: label || "Link", url: u });
  }
  return out;
}
function labelFromUrl(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    if (h.includes("linkedin")) return "LinkedIn";
    if (h.includes("github")) return "GitHub";
    return h;
  } catch {
    return "Link";
  }
}

// Strip LinkedIn-export noise so pastes don't bloat or mislead the model.
export function stripNoise(text) {
  if (!text) return "";
  return String(text)
    .split(/\r?\n/)
    .filter((ln) => {
      const l = ln.trim();
      if (!l) return true;
      if (/^show all \d+ media$/i.test(l)) return false;
      if (/^thumbnail for /i.test(l)) return false;
      if (/\slogo$/i.test(l) && l.split(/\s+/).length <= 4) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Neutral example CV so anyone can try the flow (not tied to one real person).
// ---------------------------------------------------------------------------
export const EXAMPLE_CV = `Alex Rivera
Berlin, Germany
alex.rivera@example.com | +49 30 1234567
Senior software engineer and technical lead, 12 years across web platforms and applied machine learning.

EXPERIENCE
Lead Engineer, Northwind Labs (Remote) — Mar 2021 to Present
Led a team of six building a real-time analytics platform used by 40 enterprise customers. Owned architecture, hiring, and delivery.

Senior Software Engineer, Kite Systems, Amsterdam — Jun 2017 to Feb 2021
Built the payments service and the internal experimentation platform. Introduced service-level objectives and on-call practices.

Software Engineer, BrightForge, London — Aug 2013 to May 2017
Full-stack product work on a logistics SaaS. Shipped the first mobile app and the public API.

EDUCATION
BSc Computer Science, University of Manchester, 2009 to 2013

PROJECTS
Pulse — an open-source real-time metrics library. Stack: TypeScript, Rust, WebSockets.
Fieldnote — a note-taking app with offline sync. Stack: React Native, SQLite, CRDTs.

LINKS
LinkedIn: https://www.linkedin.com/in/example
GitHub: https://github.com/example

LOOKING FOR
Remote-first senior or lead engineering roles. Open to relocation within the EU. Holds an EU passport.`;
