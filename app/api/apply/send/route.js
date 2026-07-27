// app/api/apply/send/route.js
// The one-tap Send. For email-apply jobs it sends the prepared email via Resend
// (the spec's no-browser, tap-Send experience) and logs it. For direct-form /
// login-wall it records the hand-off so the user finishes on the company site.
//
// Optional edits (note/answers/salary) can be passed and are saved before send.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { composeEmailBody } from "@/lib/apply/context";
import { sendEmail, emailConfigured, inboxAddress } from "@/lib/email/resend";
import { cleanProse } from "@/lib/onboarding";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const appId = body.applicationId;
  if (!appId) return NextResponse.json({ error: "Missing applicationId." }, { status: 400 });

  const { data: app } = await supabase
    .from("applications")
    .select("*, jobs(*)")
    .eq("id", appId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  // Apply any inline edits from the review screen.
  const patch = { updated_at: new Date().toISOString() };
  if (typeof body.note_text === "string") patch.note_text = cleanProse(body.note_text);
  if (typeof body.salary_ask === "string") patch.salary_ask = body.salary_ask.slice(0, 120);
  if (Array.isArray(body.answers)) patch.answers_json = { answers: body.answers };
  if (typeof body.to_email === "string") patch.to_email = body.to_email.trim() || null;

  const channel = app.jobs?.apply_channel || "login-wall";
  const merged = { ...app, ...patch };

  if (channel === "email-apply") {
    const to = merged.to_email;
    if (!to) return NextResponse.json({ error: "No recipient email was found in this posting. Add one or use the hand-off." }, { status: 422 });
    if (!emailConfigured()) {
      return NextResponse.json(
        { needsSetup: true, error: "Email sending is not set up yet. Add RESEND_API_KEY and APPLICATION_FROM_EMAIL to send." },
        { status: 503 }
      );
    }
    const answers = merged.answers_json?.answers || [];
    const { data: profile } = await supabase.from("profile").select("links").eq("user_id", user.id).maybeSingle();
    const text = composeEmailBody({ note_text: merged.note_text, resume_md: merged.resume_md, answers, links: profile?.links || [] });
    try {
      await sendEmail({ to, subject: merged.subject || `Application: ${app.jobs?.title}`, text, replyTo: inboxAddress() });
    } catch (err) {
      logger.error("apply.send_failed", { error: String(err?.message || err) });
      return NextResponse.json({ error: `Could not send: ${String(err?.message || err).slice(0, 160)}` }, { status: 502 });
    }
    await supabase.from("emails").insert({
      user_id: user.id,
      application_id: appId,
      direction: "out",
      from_addr: process.env.APPLICATION_FROM_EMAIL,
      to_addr: to,
      subject: merged.subject,
      body: text,
      ai_tag: null,
      received_at: new Date().toISOString(),
    });
    await supabase.from("applications").update({ ...patch, status: "sent", sent_at: new Date().toISOString() }).eq("id", appId);
    return NextResponse.json({ ok: true, sent: true });
  }

  // direct-form / login-wall: record the hand-off; the user finishes on-site.
  await supabase.from("applications").update({ ...patch, status: "sent", sent_at: new Date().toISOString() }).eq("id", appId);
  return NextResponse.json({ ok: true, handoff: true, url: app.jobs?.url || null });
}
