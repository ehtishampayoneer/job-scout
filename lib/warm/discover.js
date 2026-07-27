// lib/warm/discover.js
// For a strong-fit company, find the best PERSON to reach (an engineer who could
// refer, via GitHub) and draft a personalized, human intro to them. Falls back
// to a company-level intro (aimed at the founder/hiring lead) when no specific
// person is found.
import { callAI } from "@/lib/ai-router";
import { cleanProse } from "@/lib/onboarding";
import { clip } from "@/lib/scout/util";
import { findPeopleAtCompany } from "./people";

const PERSON_SYSTEM = `You write a short, human intro message from one senior engineer to another at a company the sender wants to work with. The goal is a genuine conversation that could lead to a referral. It must read like the sender typed it, plain and specific, not a template.

Rules: no em-dashes, no hashtags, no emoji, never "I am thrilled/excited", no flattery. 60 to 100 words. Reference one concrete point of overlap between the sender's real work and this company or this person's work. Be respectful of their time and make a light, specific ask (a quick chat, or whether they would be open to pointing you to the right person). Use only true facts about the sender.

Return strict JSON: {"why":"one line on why this person is a strong warm path","draft_message":"the intro"}`;

const COMPANY_SYSTEM = `You write a short, human note the sender can send to a company's founder or hiring lead (found via LinkedIn or the team page) to open a conversation that could lead to a role or referral. Plain, specific, like the sender typed it.

Rules: no em-dashes, no hashtags, no emoji, never "I am thrilled/excited", no flattery. 60 to 100 words. Name one concrete point of overlap between the sender's real work and this company. End with a light ask to connect. Use only true facts.

Return strict JSON: {"why":"one line on why this company is a strong warm target","draft_message":"the intro"}`;

function candidateBrief(profile, projects) {
  const who = [profile.headline, profile.summary && clip(profile.summary, 400)].filter(Boolean).join(". ");
  const proj = (projects || []).slice(0, 4).map((p) => `${p.name}: ${clip(p.one_liner || p.description || "", 120)}`).join("; ");
  return { who, proj };
}

export async function discoverWarmTarget({ company, profile, projects = [] }) {
  const { who, proj } = candidateBrief(profile, projects);
  const people = await findPeopleAtCompany(company, 1);
  const person = people[0] || null;

  if (person) {
    const prompt = `SENDER: ${who}\nSENDER'S SHIPPED WORK: ${proj}\nTARGET PERSON: ${person.person_name}, an engineer at ${company}${person.bio ? ` (bio: ${clip(person.bio, 160)})` : ""}. They contribute to ${person.repo}.\nWrite the JSON now.`;
    const res = await callAI({ system: PERSON_SYSTEM, prompt, json: true, temperature: 0.7, maxTokens: 420 });
    const j = res.json || {};
    return {
      kind: "person",
      name: company,
      person_name: person.person_name,
      person_role: person.person_role,
      person_url: person.person_url,
      channel: person.channel,
      contact: person.contact,
      source_url: person.source_url,
      why: cleanProse(String(j.why || `An engineer at ${company} who could refer you.`)).slice(0, 200),
      draft_message: cleanProse(String(j.draft_message || "")),
    };
  }

  // Fallback: company-level intro aimed at the founder / hiring lead.
  const prompt = `SENDER: ${who}\nSENDER'S SHIPPED WORK: ${proj}\nTARGET COMPANY: ${company}\nWrite the JSON now.`;
  const res = await callAI({ system: COMPANY_SYSTEM, prompt, json: true, temperature: 0.7, maxTokens: 420 });
  const j = res.json || {};
  return {
    kind: "company",
    name: company,
    person_name: null,
    person_role: "Founder or hiring lead",
    person_url: null,
    channel: "linkedin",
    contact: null,
    source_url: null,
    why: cleanProse(String(j.why || "")).slice(0, 200),
    draft_message: cleanProse(String(j.draft_message || "")),
  };
}
