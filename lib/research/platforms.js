// lib/research/platforms.js
// Vetted "do a task, get paid" research + expert-call platforms. Every one is
// TASK-based: once you're matched/accepted you complete a study, interview, or
// consultation and get paid. No bidding, no competition, no "best entry wins".
// Data is curated (these platforms have no public task feeds); `region`/`level`
// drive honest eligibility flags so we never send someone somewhere they can't earn.
export const RESEARCH_PLATFORMS = [
  {
    id: "glg",
    name: "GLG (Gerson Lehrman Group)",
    category: "Expert calls",
    what: "Paid phone/video consultations where companies and investors pay to pick your professional brain.",
    pay: "$100–$1,000 / hour",
    howPaid: "Join once → they match you to relevant calls → you do the call → paid per call.",
    region: "global",
    level: "professional",
    signup: "https://glginsights.com/network-members/",
    note: "Highest pay ceiling here. Never share an employer's confidential info.",
  },
  {
    id: "alphasights",
    name: "AlphaSights",
    category: "Expert calls",
    what: "Short expert consultations for consultants and investors in your area of experience.",
    pay: "$150–$600 / hour",
    howPaid: "Join → matched to calls → complete the call → paid.",
    region: "global",
    level: "professional",
    signup: "https://www.alphasights.com/experts/",
    note: "Great for anyone with real domain/industry experience.",
  },
  {
    id: "guidepoint",
    name: "Guidepoint",
    category: "Expert calls",
    what: "Paid consultations and surveys for professionals across industries.",
    pay: "$100–$400 / hour",
    howPaid: "Join the Advisor network → matched → do the call/survey → paid.",
    region: "global",
    level: "professional",
    signup: "https://www.guidepoint.com/advisors/",
    note: "Slightly lower bar than GLG; broad industries.",
  },
  {
    id: "respondent",
    name: "Respondent.io",
    category: "Research studies",
    what: "Paid research studies and interviews run by companies about products and work.",
    pay: "$50–$750 / session",
    howPaid: "Take a short screener → get matched → do the session → paid.",
    region: "global-west",
    level: "anyone",
    signup: "https://www.respondent.io/",
    note: "Studies skew US/UK, but professional studies pay a lot. Worth a profile.",
  },
  {
    id: "userinterviews",
    name: "User Interviews",
    category: "Research studies",
    what: "User research sessions — give feedback on products, apps, and workflows.",
    pay: "$50–$200 / session",
    howPaid: "Screener → matched → interview → paid (gift card or cash).",
    region: "global-west",
    level: "anyone",
    signup: "https://www.userinterviews.com/",
    note: "Mostly US-targeted, but easy to qualify when a study fits you.",
  },
  {
    id: "wynter",
    name: "Wynter",
    category: "B2B research",
    what: "Fast B2B message/website tests answered by professionals — you give quick expert opinions.",
    pay: "$5–$50 / test (a few minutes)",
    howPaid: "Qualify by role → tests come to you → complete → paid.",
    region: "global",
    level: "professional",
    signup: "https://wynter.com/participants",
    note: "Great fit for anyone with a business/marketing/product/tech role.",
  },
  {
    id: "usertesting",
    name: "UserTesting / Userlytics / Userbrain",
    category: "Usability testing",
    what: "Record yourself using a website or app and speaking your thoughts.",
    pay: "$4–$60 / test",
    howPaid: "Take a qualifier → tests appear → complete → paid (usually within days).",
    region: "global",
    level: "anyone",
    signup: "https://www.usertesting.com/get-paid-to-test",
    note: "One of the most globally accessible. Needs clear spoken English.",
  },
  {
    id: "prolific",
    name: "Prolific",
    category: "Research studies",
    what: "Academic and market research studies — do the study, get paid a fair guaranteed rate.",
    pay: "$6–$15 / hour",
    howPaid: "Available studies appear → you do them → guaranteed pay on approval.",
    region: "oecd",
    level: "anyone",
    signup: "https://www.prolific.com/",
    note: "Purest 'task → guaranteed pay' — BUT eligibility is limited to select (mostly OECD) countries.",
  },
  {
    id: "dscout",
    name: "dscout",
    category: "Mobile research",
    what: "Phone-based research 'missions' — photos, short videos, diary entries about products/behaviour.",
    pay: "$20–$100+ / mission",
    howPaid: "Apply to a mission → selected → complete on your phone → paid.",
    region: "global-west",
    level: "anyone",
    signup: "https://dscout.com/scouts",
    note: "Mostly US, but missions are easy and pay well for the time.",
  },
];

// Honest eligibility read for a user, from their location + how senior they are.
// Returns "good" | "maybe" | "limited" with a one-line reason.
export function eligibilityFor(platform, { location = "", seniorish = false } = {}) {
  const loc = String(location || "").toLowerCase();
  const western = /(united states|usa|u\.s|uk|united kingdom|canada|australia|ireland|new zealand|germany|france|netherlands|spain|italy|sweden|europe)/.test(loc);

  // Region gate.
  if (platform.region === "oecd" && !western) {
    return { level: "limited", why: "Usually limited to US/UK/EU/CA/AU — check if your country is eligible before investing time." };
  }
  if (platform.region === "global-west" && !western) {
    return { level: "maybe", why: "Open globally, but most studies target US/UK participants — you'll qualify for fewer." };
  }
  // Expertise gate.
  if (platform.level === "professional" && !seniorish) {
    return { level: "maybe", why: "Best if you have real professional/industry experience to speak to." };
  }
  return { level: "good", why: "A strong fit for you — worth signing up." };
}
