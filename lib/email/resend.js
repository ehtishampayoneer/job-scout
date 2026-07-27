// lib/email/resend.js
// Real outbound email via Resend. Sending goes out from your dedicated
// application address (APPLICATION_FROM_EMAIL) with replies routed to your
// inbox (APPLICATION_INBOX) so inbound parsing can thread them.
//
// If Resend is not configured yet, callers get EMAIL_NOT_CONFIGURED and the UI
// shows a setup notice — the same pattern as the Supabase setup gate.
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.APPLICATION_FROM_EMAIL);
}

export function inboxAddress() {
  return process.env.APPLICATION_INBOX || process.env.APPLICATION_FROM_EMAIL || null;
}

export async function sendEmail({ to, subject, text, replyTo }) {
  if (!emailConfigured()) {
    const e = new Error("Email sending is not configured. Add RESEND_API_KEY and APPLICATION_FROM_EMAIL.");
    e.code = "EMAIL_NOT_CONFIGURED";
    throw e;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.APPLICATION_FROM_EMAIL,
      to: [to],
      subject,
      text,
      reply_to: replyTo || inboxAddress() || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const e = new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}
