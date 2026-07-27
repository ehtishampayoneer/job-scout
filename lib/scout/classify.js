// lib/scout/classify.js
// Decide how the user will apply — this drives the Phase 3 experience:
//   email-apply   -> a real email is in the post; one-tap Send later.
//   direct-form   -> a public ATS form we could POST to (Greenhouse/Ashby/Lever).
//   login-wall    -> LinkedIn/Indeed/Workday etc.; hand off as a pre-filled package.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function classifyChannel(job) {
  const url = String(job.url || "").toLowerCase();
  const text = String(job.raw_text || "");
  const email = (text.match(EMAIL_RE) || [])[0] || null;

  // A hiring-looking email address in the post => email-apply.
  const hiringEmail = email && /(apply|jobs?|careers?|hiring|hr|recruit|talent|hello|team|work|contact)@/i.test(email);
  if (hiringEmail) return { channel: "email-apply", email };

  if (job.source === "greenhouse" || job.source === "ashby" || /greenhouse\.io|ashbyhq|lever\.co/i.test(url)) {
    return { channel: "direct-form", email: null };
  }
  if (/linkedin\.com|indeed\.com|workday|glassdoor|ziprecruiter/i.test(url)) {
    return { channel: "login-wall", email: null };
  }
  if (email) return { channel: "email-apply", email };

  // RemoteOK / WWR listings usually link to a company page with a form.
  return { channel: job.source === "remoteok" || job.source === "weworkremotely" ? "direct-form" : "login-wall", email: null };
}
