// lib/email/inbound.js — shared logic to record + tag an inbound reply and
// advance the matching application. Used by the webhook and the manual "log a
// reply" action so both behave identically.
import { tagEmail, statusForTag } from "@/lib/email/tag";

const domainOf = (addr) => String(addr || "").split("@")[1]?.toLowerCase().replace(/>$/, "").trim() || "";

// Best-effort match of a reply to an application the user already sent.
export async function matchApplication(supabase, userId, fromAddr) {
  const from = String(fromAddr || "").toLowerCase();
  if (!from) return null;
  const { data: sent } = await supabase
    .from("applications")
    .select("id, to_email, sent_at")
    .eq("user_id", userId)
    .not("to_email", "is", null)
    .order("sent_at", { ascending: false })
    .limit(200);
  if (!sent?.length) return null;
  // Exact address, then same domain.
  const exact = sent.find((a) => String(a.to_email).toLowerCase() === from);
  if (exact) return exact.id;
  const dom = domainOf(from);
  const byDomain = dom && sent.find((a) => domainOf(a.to_email) === dom);
  return byDomain?.id || null;
}

export async function recordInbound(supabase, userId, { from, to, subject, body, applicationId }) {
  const appId = applicationId || (await matchApplication(supabase, userId, from));

  // Tag with the LLM (best effort; store 'other' if the AI is unavailable).
  let tag = "other";
  let reason = "";
  try {
    const t = await tagEmail({ from, subject, body });
    tag = t.tag;
    reason = t.reason;
  } catch {
    /* leave as other */
  }

  const { data: row, error } = await supabase
    .from("emails")
    .insert({
      user_id: userId,
      application_id: appId,
      direction: "in",
      from_addr: from || null,
      to_addr: to || null,
      subject: subject || null,
      body: body || null,
      ai_tag: tag,
      received_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;

  // Advance the application's pipeline status (never downgrade a real outcome).
  if (appId && tag !== "scam") {
    const next = statusForTag(tag);
    const { data: app } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
    if (app && rank(next) > rank(app.status)) {
      await supabase.from("applications").update({ status: next, updated_at: new Date().toISOString() }).eq("id", appId);
    }
  }

  return { emailId: row?.id, applicationId: appId, tag, reason };
}

// Pipeline ordering so an inbound reply only moves an application forward.
function rank(status) {
  return { draft: 0, sent: 1, responded: 2, interviewing: 3, offer: 4, rejected: 2, dismissed: 0 }[status] ?? 0;
}
