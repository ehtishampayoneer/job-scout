"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

function toLocalInput(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InterviewClient({ email, iv, profile }) {
  const router = useRouter();
  const job = iv.jobs || {};
  const app = iv.applications || {};
  const answers = app.answers_json?.answers || [];

  const [when, setWhen] = useState(toLocalInput(iv.scheduled_at));
  const [location, setLocation] = useState(iv.location || "");
  const [status, setStatus] = useState(iv.status || "proposed");
  const [prep, setPrep] = useState(iv.prep || null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [slots, setSlots] = useState("");

  async function saveSchedule() {
    setBusy("save");
    setNote("");
    try {
      const res = await fetch("/api/interview/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: iv.id, scheduled_at: when ? new Date(when).toISOString() : null, location, status: when ? "scheduled" : status }),
      });
      if (!res.ok) throw new Error("Could not save.");
      setNote("Saved.");
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy("");
    }
  }

  async function makePrep() {
    setBusy("prep");
    setNote("");
    try {
      const res = await fetch("/api/interview/prep", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: iv.id }) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Failed.");
      setPrep(out.prep);
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy("");
    }
  }

  async function draftReply() {
    setBusy("reply");
    try {
      const res = await fetch("/api/interview/draft-reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: iv.id, slots }) });
      const out = await res.json();
      if (res.ok) setReply(out.text || "");
    } finally {
      setBusy("");
    }
  }

  const portfolioUrl = profile.public_enabled && profile.public_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${profile.public_token}` : null;

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Nav email={email} />

        <a href="/inbox" style={{ fontSize: 13, color: "var(--fg-muted)" }}>← Back to inbox</a>
        <h1 style={{ fontSize: 25, fontWeight: 700, letterSpacing: -0.5, margin: "8px 0 2px" }}>{job.title || "Interview"}</h1>
        <div style={{ color: "var(--fg-muted)", fontSize: 14, marginBottom: 18 }}>
          {job.company}{job.url ? <> · <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Job post ↗</a></> : null}
        </div>

        {/* Schedule */}
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Schedule</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "grid", gap: 5, flex: "1 1 220px" }}>
              <span style={{ fontSize: 12, color: "var(--fg-subtle)", fontWeight: 600 }}>Date & time</span>
              <input type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 5, flex: "1 1 220px" }}>
              <span style={{ fontSize: 12, color: "var(--fg-subtle)", fontWeight: 600 }}>Video link / phone / place</span>
              <input className="field" value={location} placeholder="e.g. Google Meet link" onChange={(e) => setLocation(e.target.value)} />
            </label>
            <button className="btn-primary" style={{ height: 46 }} onClick={saveSchedule} disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save"}</button>
          </div>
          {note && <div style={{ fontSize: 12.5, color: note === "Saved." ? "var(--good)" : "var(--bad)", marginTop: 8 }}>{note}</div>}

          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>Draft a scheduling reply</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <input className="field" placeholder="Your availability, e.g. Tue or Wed 3-6pm PKT" value={slots} onChange={(e) => setSlots(e.target.value)} />
              <div><button className="btn-ghost" style={{ height: 38 }} onClick={draftReply} disabled={busy === "reply"}>{busy === "reply" ? "Drafting…" : "Draft reply"}</button></div>
              {reply && <textarea className="field" style={{ minHeight: 90 }} value={reply} onChange={(e) => setReply(e.target.value)} />}
            </div>
          </details>
        </div>

        {/* What we told them */}
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>What we told them</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 12 }}>Stay on this page in the interview. This is exactly what your application said.</div>
          {app.note_text && <Block label="Outreach note">{app.note_text}</Block>}
          {app.salary_ask && <Block label="Salary ask">{app.salary_ask}</Block>}
          {answers.length > 0 && (
            <Block label="Answers we gave">
              {answers.map((a, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.question}</div>
                  <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>{a.answer}</div>
                </div>
              ))}
            </Block>
          )}
          {portfolioUrl && <div style={{ fontSize: 13, marginTop: 8 }}>Portfolio shared: <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600 }}>{portfolioUrl}</a></div>}
          {!app.note_text && !answers.length && <div style={{ fontSize: 13, color: "var(--fg-subtle)" }}>No application content recorded for this one.</div>}
        </div>

        {/* Prep brief */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Prep brief</div>
            <button className="btn-ghost" style={{ height: 38 }} onClick={makePrep} disabled={busy === "prep"}>{busy === "prep" ? "Preparing…" : prep ? "Regenerate brief" : "Prepare brief"}</button>
          </div>

          {!prep ? (
            <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "10px 0 0", lineHeight: 1.6 }}>
              Generate a company-specific brief: what they do, the likely questions, and ideal answers built from your real work and consistent with what we already told them.
            </p>
          ) : (
            <div style={{ marginTop: 14, display: "grid", gap: 18 }}>
              {prep.company_summary && <Block label="About the company">{prep.company_summary}</Block>}
              {prep.role_summary && <Block label="The role">{prep.role_summary}</Block>}
              {prep.talking_points?.length > 0 && (
                <Block label="Make sure to land">
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{prep.talking_points.map((t, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6 }}>{t}</li>)}</ul>
                </Block>
              )}
              {prep.likely_questions?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Likely questions</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {prep.likely_questions.map((q, i) => (
                      <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{q.question}</div>
                        <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6 }}>{q.ideal_answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {prep.watch_outs?.length > 0 && (
                <Block label="Watch out for">
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{prep.watch_outs.map((t, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--warn)" }}>{t}</li>)}</ul>
                </Block>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Block({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  );
}
