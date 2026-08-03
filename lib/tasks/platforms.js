// lib/tasks/platforms.js
// Pure "do a task, get paid" platforms — NO competition, NO bidding, NO per-task
// application. After a one-time signup/qualification you simply see tasks, do
// them, and get paid per task/hour. Honest about pay + the one-time gate + region.
export const TASK_PLATFORMS = [
  {
    id: "dataannotation",
    name: "DataAnnotation.tech",
    category: "AI training",
    what: "Rate and improve AI answers, write examples, check code and writing. Do tasks, paid per hour.",
    pay: "$10–$20 / hour",
    gate: "One-time application + a writing/reasoning assessment. Once accepted you just do tasks — no competition.",
    region: "global-west",
    signup: "https://www.dataannotation.tech/",
    note: "Highest-paying pure do→paid work right now. Acceptance can be selective; strong written English helps a lot.",
  },
  {
    id: "outlier",
    name: "Outlier (Scale AI)",
    category: "AI training",
    what: "Train AI models — rank answers, write prompts, review code, in your area of knowledge.",
    pay: "$10–$30 / hour",
    gate: "One-time skill assessment. Then tasks come to you — no competing.",
    region: "global-west",
    signup: "https://outlier.ai/",
    note: "Pays more for subject-matter expertise (coding, STEM, writing).",
  },
  {
    id: "toloka",
    name: "Toloka",
    category: "Microtasks + labeling",
    what: "Small tasks and data-labeling — categorize, verify, transcribe, moderate.",
    pay: "$2–$8 / hour",
    gate: "Free signup + quick per-project qualifications. Then do tasks, get paid.",
    region: "global",
    signup: "https://toloka.ai/tolokers/",
    note: "One of the most globally accessible — works well outside the US.",
  },
  {
    id: "clickworker",
    name: "Clickworker",
    category: "Microtasks",
    what: "Text creation/review, categorization, surveys, data checks.",
    pay: "$2–$9 / hour",
    gate: "Free signup + a short assessment to unlock more tasks.",
    region: "global",
    signup: "https://www.clickworker.com/clickworker-crowd/",
    note: "Global. More tasks unlock as you complete the profile + assessments.",
  },
  {
    id: "microworkers",
    name: "Microworkers",
    category: "Microtasks",
    what: "Tiny paid jobs — sign-ups, searches, data entry, verification.",
    pay: "$1–$5 / hour",
    gate: "Free signup. Do tasks, get paid once you hit the small payout threshold.",
    region: "global",
    signup: "https://www.microworkers.com/",
    note: "Very accessible worldwide; pay is small but instant-ish.",
  },
  {
    id: "remotasks",
    name: "Remotasks",
    category: "Data labeling",
    what: "Image/LiDAR/text annotation for AI (boxes, tags, transcriptions).",
    pay: "$2–$10 / hour",
    gate: "Free signup + training courses to unlock paid tasks.",
    region: "global",
    signup: "https://www.remotasks.com/",
    note: "Global. Earnings scale as you pass more training modules.",
  },
  {
    id: "usertesting",
    name: "UserTesting / Userbrain",
    category: "Usability testing",
    what: "Record yourself using a website/app and speaking your thoughts aloud.",
    pay: "$4–$60 / test",
    gate: "One-time sample test to qualify. Then tests appear — do them, get paid.",
    region: "global",
    signup: "https://www.usertesting.com/get-paid-to-test",
    note: "Needs clear spoken English + a mic. Higher pay per task than microwork.",
  },
  {
    id: "transcription",
    name: "Rev / GoTranscript",
    category: "Transcription",
    what: "Type out audio/video into text, or add captions.",
    pay: "$0.30–$1.10 / audio minute",
    gate: "One-time transcription test. Then pick available files, do them, get paid.",
    region: "global",
    signup: "https://www.gotranscript.com/transcription-jobs",
    note: "Global (strong English required). Pick files that fit your speed.",
  },
  {
    id: "appen",
    name: "Appen",
    category: "Data tasks",
    what: "Search evaluation, data collection, categorization, short AI tasks.",
    pay: "$3–$14 / hour",
    gate: "Free signup + project qualifications.",
    region: "global",
    signup: "https://connect.appen.com/qrp/public/home",
    note: "Global. Project availability varies by language/region.",
  },
];

// Region-only eligibility flag (these are open to anyone skill-wise).
export function taskFit(platform, { location = "" } = {}) {
  const loc = String(location || "").toLowerCase();
  const western = /(united states|usa|u\.s|uk|united kingdom|canada|australia|ireland|new zealand|germany|france|netherlands|europe)/.test(loc);
  if (platform.region === "global-west" && !western) {
    return { level: "maybe", why: "Open worldwide but hiring skews US/UK/CA — worth applying, acceptance can be selective." };
  }
  return { level: "good", why: "Works globally — you can start here." };
}
