"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { readJson } from "@/lib/readJson";

const CHANNEL = {
  "email-apply": { label: "Email apply", cta: "Send application" },
  "direct-form": { label: "Direct form", cta: "Open form & mark applied" },
  "login-wall": { label: "Login wall", cta: "Open posting & mark applied" },
};

export function ApplyClient({ email }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [done, setDone] = useState(false);
  const [doneInfo, setDoneInfo] = useState(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [sending, setSending] = useState(false);

  // Editable fields for the current application.
  const [note, setNote] = useState("");
  const [salary, setSalary] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [answers, setAnswers] = useState([]);

  // Per-application assistant: draft answers to any extra questions a form asks.
  const [askQ, setAskQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState([]);

  const seed = (payload) => {
    const a = payload.application || {};
    setNote(a.note_text || "");
    setSalary(a.salary_ask || "");
    setToEmail(a.to_email || "");
    setAnswers(a.answers_json?.answers || []);
    setAsked([]);
    setAskQ("");
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // If the user came from a specific job card (/apply?job=<id>), focus that
      // job; otherwise pull the next best from the queue.
      const jobParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("job") : null;
      const res = await fetch(`/api/apply/next${jobParam ? `?job=${encodeURIComponent(jobParam)}` : ""}`);
      const payload = await readJson(res);
      if (!res.ok) throw new Error(payload.error || "Could not load.");
      if (payload.done) {
        setDone(true);
        setDoneInfo(payload);
        setData(null);
      } else {
        setDone(false);
        setData(payload);
        seed(payload);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!data) return;
    const channel = data.job.apply_channel;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/apply/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: data.application.id,
          note_text: note,
          salary_ask: salary,
          to_email: toEmail,
          answers,
        }),
      });
      const out = await readJson(res);
      if (!res.ok) throw new Error(out.error || "Could not send.");
      if (out.handoff && out.url) window.open(out.url, "_blank", "noopener");
      setFlash(out.sent ? "Sent. Loading the next one…" : "Marked as applied. Opening the form and loading the next one…");
      setTimeout(() => setFlash(""), 3000);
      // Drop any ?job focus so the next load advances through the queue instead
      // of re-showing the job we just actioned.
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("job")) {
        window.history.replaceState({}, "", "/apply");
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function regenerate() {
    if (!data) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/apply/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: data.job.id }),
      });
      const out = await readJson(res);
      if (!res.ok) throw new Error(out.error || "Could not regenerate.");
      setFlash("Fresh draft ready.");
      setTimeout(() => setFlash(""), 2000);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function skip() {
    if (!data) return;
    setSending(true);
    try {
      await fetch("/api/apply/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: data.job.id }),
      });
      await load();
    } finally {
      setSending(false);
    }
  }

  // Open the company form in a new tab — no marking, no advancing. The user
  // stays on this screen to finish applying, then clicks "I've applied".
  function openFormOnly() {
    if (data?.job?.url) window.open(data.job.url, "_blank", "noopener");
  }

  // Open the user's own Gmail pre-filled — no marking, no advancing.
  function openGmailDraft() {
    if (!data) return;
    const to = toEmail.trim();
    if (!to) {
      setError("Add the recipient email first (the hiring/careers address).");
      return;
    }
    const subject = data.application.subject || `Application: ${data.job.title}`;
    const linksText = (data.profileLinks || []).map((l) => `${l.label}: ${l.url}`).join("\n");
    const body = `${note}\n\n${linksText ? linksText + "\n\n" : ""}(CV attached)`;
    window.open(gmailComposeUrl({ to, subject, body }), "_blank", "noopener");
  }

  // Record this job as applied (AFTER the user actually submitted it) and advance
  // to the next role. Saves any inline edits at the same time.
  async function markAppliedNext() {
    if (!data) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/apply/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: data.application.id, handoff: true, note_text: note, salary_ask: salary, to_email: toEmail, answers }),
      });
      const out = await readJson(res);
      if (!res.ok) throw new Error(out.error || "Could not save.");
      setFlash("Marked as applied. Loading the next one…");
      setTimeout(() => setFlash(""), 2500);
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("job")) {
        window.history.replaceState({}, "", "/apply");
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function askQuestion() {
    const q = askQ.trim();
    if (!q || !data) return;
    setAsking(true);
    setError("");
    try {
      const res = await fetch("/api/apply/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: data.job.id, question: q }),
      });
      const out = await readJson(res);
      if (!res.ok) throw new Error(out.error || "Could not draft an answer.");
      setAsked((prev) => [...prev, { q, a: out.answer }]);
      setAskQ("");
    } catch (e) {
      setError(e.message);
    } finally {
      setAsking(false);
    }
  }

  const wrap = { minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" };
  const inner = { maxWidth: 860, margin: "0 auto" };

  if (loading) {
    return (
      <main style={wrap}><div style={inner}><Nav email={email} />
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
          Preparing your next application…
        </div>
      </div></main>
    );
  }

  if (done) {
    const noStrong = doneInfo?.reason === "no_strong_matches";
    return (
      <main style={wrap}><div style={inner}><Nav email={email} />
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {noStrong ? "No strong matches to apply to" : "You are all caught up"}
          </div>
          <div style={{ color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 470, margin: "0 auto 18px" }}>
            {noStrong
              ? `We hold a fixed quality bar (fit ${doneInfo.minFit}+) so you never spray applications, which damages a senior profile. ${doneInfo.weakWaiting} weaker role(s) are parked, not queued. Run the scout for fresh postings, or sharpen your profile so scoring improves.`
              : "Every strong match has been actioned. Run the scout for fresh roles, then come back to keep applying."}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/jobs" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", height: 44 }}>Back to jobs</a>
            <a href="/profile" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", height: 44 }}>Sharpen profile</a>
          </div>
        </div>
      </div></main>
    );
  }

  // After an error (e.g. the generator timed out) we have no data — show a clean
  // retry instead of crashing on a null destructure.
  if (!data) {
    return (
      <main style={wrap}><div style={inner}><Nav email={email} />
        {error && <Banner kind="bad" text={error} />}
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Could not prepare this application</div>
          <div style={{ color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 460, margin: "0 auto 18px" }}>
            {error || "The tailoring step took too long or hit a snag. This usually works on a second try."}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" style={{ height: 44 }} onClick={load} disabled={loading}>Try again</button>
            <a href="/jobs" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", height: 44 }}>Back to jobs</a>
          </div>
        </div>
      </div></main>
    );
  }

  const { job, score, application, emailConfigured, remaining, profileLinks } = data;
  const channel = CHANNEL[job.apply_channel] || CHANNEL["login-wall"];
  const isEmail = job.apply_channel === "email-apply";
  const canSend = isEmail ? emailConfigured && toEmail : true;
  const APPLIED = ["sent", "responded", "interviewing", "rejected", "offer"];
  const alreadyApplied = APPLIED.includes(application?.status);

  return (
    <main style={wrap}>
      <div style={inner}>
        <Nav email={email} />

        {flash && <Banner kind="good" text={flash} />}
        {error && <Banner kind="bad" text={error} />}
        {alreadyApplied && (
          <div style={{ fontSize: 13, color: "var(--good)", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 12px", marginBottom: 12, lineHeight: 1.5 }}>
            ✓ You already applied to this role. You&apos;re reviewing your submitted application — re-open the form below to finish it, or use the assistant for any remaining questions.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>Apply</h1>
          <span style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>{remaining} in your queue</span>
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: 13.5, margin: "0 0 16px" }}>
          Review and edit, download the CV, then <strong>Open form</strong> to apply on the company site. When you&apos;ve actually submitted, hit <strong>&ldquo;I&apos;ve applied&rdquo;</strong> to log it and load the next one.
        </p>

        {/* Job header */}
        <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 14 }}>
          <FitBadge score={score.fit_score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 17, fontWeight: 700 }}>{job.title} ↗</a>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>
              {[job.company, job.location_type, job.source].filter(Boolean).join(" · ")}
            </div>
            {score.why_it_fits && <p style={{ fontSize: 13.5, margin: "8px 0 0", lineHeight: 1.5 }}>{score.why_it_fits}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <span className="chip">{channel.label}</span>
              <span className="chip" style={{ color: score.trust_score >= 60 ? "var(--good)" : "var(--warn)" }}>Trust {score.trust_score}</span>
              {(score.scam_flags || []).map((f, i) => (
                <span key={i} className="chip" style={{ color: "var(--bad)", borderColor: "#fecaca", background: "#fef2f2" }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Salary ask */}
        <Labeled label="Salary ask (calibrated to this company)">
          <input className="field" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </Labeled>

        {/* Recipient for email-apply */}
        {isEmail && (
          <Labeled label="Send to">
            <input className="field" value={toEmail} placeholder="hiring@company.com" onChange={(e) => setToEmail(e.target.value)} />
            {!emailConfigured && (
              <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 6, lineHeight: 1.5 }}>
                &ldquo;Open in Gmail &amp; mark applied&rdquo; opens this email in your own Gmail, pre-filled and from your real address. Download the CV above, attach it, and hit Send.
              </div>
            )}
          </Labeled>
        )}

        {/* Outreach note */}
        <Labeled label="Outreach note">
          <textarea className="field" style={{ minHeight: 170, lineHeight: 1.6 }} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>

        {/* Answers */}
        {answers.length > 0 && (
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Pre-filled answers</div>
            <div style={{ display: "grid", gap: 12 }}>
              {answers.map((a, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 4 }}>{a.question}</div>
                  <textarea
                    className="field"
                    style={{ minHeight: 64 }}
                    value={a.answer}
                    onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume preview + tailored Word download */}
        {application.resume_md && (
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Tailored resume (specific to this job)</div>
              <a
                href={`/api/apply/resume?jobId=${job.id}`}
                className="btn-ghost"
                style={{ height: 34, display: "inline-flex", alignItems: "center", padding: "0 14px", fontSize: 12.5, fontWeight: 600 }}
              >
                Download .docx
              </a>
            </div>
            <MiniMarkdown text={application.resume_md} />
          </div>
        )}

        {/* Per-application assistant: draft an answer to any other form question */}
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Answer any other question this form asks</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 12, lineHeight: 1.5 }}>
            Paste a question from {job.company || "the company"}&apos;s form. I&apos;ll draft an honest answer using this role, the company, and your profile — ready to paste.
          </div>

          {asked.map((qa, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 5 }}>{qa.q}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>{qa.a}</div>
              <button
                className="btn-ghost"
                style={{ height: 30, marginTop: 6, fontSize: 12 }}
                onClick={() => { try { navigator.clipboard?.writeText(qa.a); setFlash("Copied."); setTimeout(() => setFlash(""), 1500); } catch {} }}
              >
                Copy
              </button>
            </div>
          ))}

          <textarea
            className="field"
            style={{ minHeight: 70, lineHeight: 1.5 }}
            placeholder="e.g. Why do you want to work here? · Are you authorized to work in this country? · What's your biggest achievement?"
            value={askQ}
            onChange={(e) => setAskQ(e.target.value)}
          />
          <button className="btn-primary" style={{ height: 38, marginTop: 8, fontSize: 13.5 }} onClick={askQuestion} disabled={asking || !askQ.trim()}>
            {asking ? "Drafting…" : "Draft answer"}
          </button>
        </div>

        {(profileLinks || []).length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            {profileLinks.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>{l.label} ↗</a>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ position: "sticky", bottom: 0, background: "var(--bg)", padding: "14px 0 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", marginTop: 8 }}>
          {alreadyApplied ? (
            <>
              {/* Already applied: re-open to finish, WITHOUT re-marking. */}
              {isEmail ? (
                <button className="btn-primary" style={{ height: 48, padding: "0 22px", fontSize: 15 }} onClick={openGmailDraft} disabled={!toEmail.trim()}>
                  Re-open in Gmail ↗
                </button>
              ) : job.url ? (
                <button className="btn-primary" style={{ height: 48, padding: "0 26px", fontSize: 15 }} onClick={openFormOnly}>
                  Re-open form ↗
                </button>
              ) : null}
              <a href="/jobs" className="btn-ghost" style={{ height: 48, display: "inline-flex", alignItems: "center" }}>Back to jobs</a>
            </>
          ) : (
            <>
              {/* Step 1: open the form/Gmail (stays on this screen). */}
              {isEmail ? (
                <button className="btn-primary" style={{ height: 48, padding: "0 22px", fontSize: 15 }} onClick={openGmailDraft} disabled={!toEmail.trim()}>
                  Open in Gmail ↗
                </button>
              ) : (
                <button className="btn-primary" style={{ height: 48, padding: "0 26px", fontSize: 15 }} onClick={openFormOnly} disabled={!job.url}>
                  Open form ↗
                </button>
              )}
              {/* Step 2: after actually applying, confirm + advance. */}
              <button
                onClick={markAppliedNext}
                disabled={sending}
                style={{ height: 48, padding: "0 22px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "var(--good)", cursor: "pointer" }}
              >
                {sending ? "Saving…" : "✓ I've applied — next"}
              </button>
              {isEmail && emailConfigured && (
                <button className="btn-ghost" style={{ height: 48 }} onClick={send} disabled={sending || !canSend}>Send from app</button>
              )}
              <button className="btn-ghost" style={{ height: 48 }} onClick={regenerate} disabled={sending}>Regenerate</button>
              <button className="btn-ghost" style={{ height: 48 }} onClick={skip} disabled={sending}>Skip</button>
              {isEmail && !toEmail.trim() && <span style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>Add the recipient email above.</span>}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// Build a Gmail web-compose URL pre-filled with the recipient, subject and body.
// Opens the user's own Gmail so the email sends from their real address.
function gmailComposeUrl({ to, subject, body }) {
  const p = new URLSearchParams({ view: "cm", fs: "1", to: to || "", su: subject || "", body: body || "" });
  return `https://mail.google.com/mail/?${p.toString()}`;
}

function Labeled({ label, children }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Banner({ kind, text }) {
  const c = kind === "good" ? { fg: "var(--good)", bg: "#ecfdf5", bd: "#a7f3d0" } : { fg: "var(--bad)", bg: "#fef2f2", bd: "#fecaca" };
  return <div style={{ fontSize: 13, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>{text}</div>;
}

function FitBadge({ score }) {
  const color = score >= 80 ? "var(--good)" : score >= 60 ? "var(--warn)" : "var(--fg-subtle)";
  const bg = score >= 80 ? "#ecfdf5" : score >= 60 ? "#fffbeb" : "var(--surface-2)";
  return (
    <div style={{ width: 56, height: 56, borderRadius: 12, background: bg, border: "1px solid var(--border)", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 9, color: "var(--fg-subtle)", fontWeight: 600, marginTop: 2 }}>FIT</div>
    </div>
  );
}

// Minimal, safe Markdown renderer (headings, bold, bullets) — no HTML injection.
function MiniMarkdown({ text }) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let list = [];
  const flush = (key) => {
    if (list.length) {
      out.push(<ul key={`ul-${key}`} style={{ margin: "4px 0 8px", paddingLeft: 20 }}>{list}</ul>);
      list = [];
    }
  };
  lines.forEach((raw, i) => {
    const l = raw.trimEnd();
    if (/^#{1,6}\s/.test(l)) {
      flush(i);
      const level = l.match(/^#+/)[0].length;
      const t = l.replace(/^#+\s/, "");
      out.push(
        <div key={i} style={{ fontSize: level <= 1 ? 16 : 13.5, fontWeight: 700, margin: level <= 1 ? "2px 0 6px" : "10px 0 4px" }}>{inline(t)}</div>
      );
    } else if (/^[-*]\s/.test(l)) {
      list.push(<li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{inline(l.replace(/^[-*]\s/, ""))}</li>);
    } else if (!l.trim()) {
      flush(i);
    } else {
      flush(i);
      out.push(<p key={i} style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 6px" }}>{inline(l)}</p>);
    }
  });
  flush("end");
  return <div>{out}</div>;
}

function inline(s) {
  // Bold **text** only; everything else literal.
  const parts = String(s).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
}
