// lib/profile/edit.js
// Apply a plain-language edit to the candidate's profile ("add Python to my
// skills", "change my target roles to X and Y", "make my summary shorter",
// "I now need visa sponsorship"). Returns a field patch (complete new values,
// so add/remove/reword all work) plus a short human confirmation.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";

const TEXT_FIELDS = ["headline", "summary", "location", "contact_email", "contact_phone", "salary_notes", "visa_status", "tone_notes", "education_note"];
const LIST_FIELDS = ["target_roles", "acceptable_locations", "strengths", "weaknesses"];

const SYSTEM = `You maintain a job candidate's profile. The user asks, in plain language, to change something. Apply exactly what they ask.

Return STRICT JSON:
{
  "patch": { ONLY the fields that should change, each set to its COMPLETE new value. For list fields return the FULL new array AFTER the change (so adding, removing, or rewording all work). For text fields return the full new text. },
  "reply": "one short, warm, human sentence confirming exactly what changed"
}

Rules:
- Change ONLY what the user asked; never touch other fields.
- HONESTY: never invent experience, skills, or facts the user did not state. If they ask to add something, add it as they said it.
- Keep the candidate's own voice. No corporate filler, no em-dashes, no emoji.
- Editable TEXT fields: headline, summary, location, contact_email, contact_phone, salary_notes, visa_status, tone_notes, education_note.
- Editable LIST fields: target_roles, acceptable_locations, strengths, weaknesses.
- If they ask to change work history, projects, or education, return "patch": {} and in the reply tell them to edit that section directly with the Edit button.
- Cap strengths, weaknesses, and target_roles at 6 items each.`;

export async function editProfileFromMessage(profile, message, history = []) {
  const current = JSON.stringify(
    {
      headline: profile.headline, summary: profile.summary, location: profile.location,
      contact_email: profile.contact_email, contact_phone: profile.contact_phone,
      salary_notes: profile.salary_notes, visa_status: profile.visa_status,
      tone_notes: profile.tone_notes, education_note: profile.education_note,
      target_roles: profile.target_roles, acceptable_locations: profile.acceptable_locations,
      strengths: profile.strengths, weaknesses: profile.weaknesses,
    },
    null, 2
  );
  const convo = (history || []).slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
  const prompt = `CURRENT PROFILE:\n${current}\n\n${convo ? `RECENT CONVERSATION:\n${convo}\n\n` : ""}USER REQUEST:\n${message}\n\nReturn the JSON patch + reply.`;

  const res = await callAI({ system: SYSTEM, prompt, json: true, temperature: 0.3, maxTokens: 900 });
  const j = res.json || {};
  const raw = j.patch && typeof j.patch === "object" ? j.patch : {};

  const patch = {};
  for (const k of TEXT_FIELDS) {
    if (typeof raw[k] === "string") patch[k] = cleanProse(raw[k]).trim();
  }
  for (const k of LIST_FIELDS) {
    if (Array.isArray(raw[k])) {
      patch[k] = raw[k].map((x) => cleanProse(String(x)).trim()).filter(Boolean).slice(0, k === "acceptable_locations" ? 8 : 6);
    }
  }
  return { patch, reply: cleanProse(String(j.reply || "Done.")).trim() };
}
