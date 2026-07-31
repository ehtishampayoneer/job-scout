"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { DraftPreview } from "@/components/DraftPreview";
import { readJson } from "@/lib/readJson";

const STORAGE_KEY = "jobscout_onboarding_v1";

const EMPTY_DRAFT = {
  profile: {
    full_name: "", headline: "", location: "", contact_email: "", contact_phone: "",
    summary: "", salary_floor_usd: "", salary_notes: "", target_roles: [],
    acceptable_locations: [], visa_status: "", tone_notes: "", strengths: [],
    weaknesses: [], education_note: "", links: [],
  },
  employment: [], education: [], projects: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("intro"); // intro | chat
  const [cvText, setCvText] = useState("");
  const [messages, setMessages] = useState([]); // {role, content}
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // Persist onboarding progress locally so an interruption (a phone call, a tab
  // switch, an accidental refresh) never wipes the conversation. Restored on
  // mount; cleared only when onboarding is saved/completed.
  const restored = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.phase) setPhase(s.phase);
        if (typeof s.cvText === "string") setCvText(s.cvText);
        if (Array.isArray(s.messages)) setMessages(s.messages);
        if (s.draft) setDraft(s.draft);
        if (s.assessment) setAssessment(s.assessment);
        if (typeof s.complete === "boolean") setComplete(s.complete);
      }
    } catch {
      /* ignore corrupt/absent storage */
    }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return; // don't overwrite saved state before restoring
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ phase, cvText, messages, draft, assessment, complete }));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [phase, cvText, messages, draft, assessment, complete]);

  async function chat(nextMessages, seedDraft) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, messages: nextMessages, draft: seedDraft ?? draft }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      if (data.draft) setDraft(data.draft);
      if (data.assessment) setAssessment(data.assessment);
      setComplete(Boolean(data.complete));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function start(useCv) {
    setPhase("chat");
    setBusy(true);
    setError("");
    let seed = EMPTY_DRAFT;
    try {
      if (useCv && cvText.trim()) {
        const res = await fetch("/api/onboarding/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvText }),
        });
        const data = await readJson(res);
        if (data.draft) {
          seed = { ...EMPTY_DRAFT, ...data.draft, profile: { ...EMPTY_DRAFT.profile, ...data.draft.profile } };
          setDraft(seed);
        }
      }
    } catch {
      /* extraction is best-effort; the chat still works */
    }
    await chat([], seed);
  }

  async function retry() {
    if (busy) return;
    // Re-run the last turn: the opening (no messages) reseeds from the draft,
    // otherwise re-send the existing transcript.
    await chat(messages, messages.length === 0 ? draft : undefined);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    await chat(next);
  }

  async function loadExample() {
    try {
      const res = await fetch("/api/onboarding/example");
      const data = await readJson(res);
      setCvText(data.cv || "");
    } catch {
      setError("Could not load the example.");
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, cvText }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not save.");
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
      router.replace("/profile");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  // ---- Intro ----
  if (phase === "intro") {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ width: "100%", maxWidth: 680, padding: 30 }}>
          <div style={{ marginBottom: 20 }}><Brand /></div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", letterSpacing: -0.6 }}>
            Let us talk through your career
          </h1>
          <p style={{ color: "var(--fg-muted)", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 20px" }}>
            Paste your CV and I will read it like a career strategist you hired. I will tell you what is strong, what is
            missing, which roles and markets give you the best odds, and a realistic salary, then ask a few sharp
            questions so we build a profile that genuinely represents you. After that I go find and prepare tailored
            applications for you.
          </p>
          <textarea
            className="field"
            style={{ minHeight: 200, fontSize: 13.5, lineHeight: 1.55 }}
            placeholder="Paste your CV or LinkedIn export here…"
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
            <button className="btn-primary" onClick={() => start(true)} disabled={busy || !cvText.trim()}>
              {busy ? "Reading…" : "Review my CV"}
            </button>
            <button className="btn-ghost" onClick={() => start(false)} disabled={busy}>
              I will just talk it through
            </button>
            <button onClick={loadExample} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, fontSize: 13.5, marginLeft: "auto" }}>
              Load example CV
            </button>
          </div>
          {error && <ErrorNote text={error} />}
        </div>
      </main>
    );
  }

  // ---- Chat ----
  return (
    <main style={{ minHeight: "100vh", padding: "20px clamp(12px, 4vw, 40px)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <Brand />
          <span className="chip">Building your profile</span>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)", gap: 18, alignItems: "start" }} className="ob-grid">
          <section className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", minHeight: 460 }}>
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.content} />)}
              {busy && <Bubble role="assistant" text="…" typing />}
              {error && (
                <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                  <ErrorNote text={error} />
                  <button className="btn-primary" style={{ height: 38 }} onClick={retry} disabled={busy}>Retry</button>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: 14 }}>
              {complete ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5, color: "var(--fg-muted)", flex: 1, minWidth: 180 }}>
                    Your profile is ready. Review it on the right, then save.
                  </div>
                  <button className="btn-ghost" onClick={() => setComplete(false)} disabled={saving}>Keep talking</button>
                  <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save & continue"}</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea
                    className="field"
                    style={{ minHeight: 46, maxHeight: 140, flex: 1 }}
                    placeholder="Type your answer…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    disabled={busy}
                  />
                  <button className="btn-primary" onClick={send} disabled={busy || !input.trim()}>Send</button>
                </div>
              )}
            </div>
          </section>

          <aside style={{ position: "sticky", top: 20, display: "grid", gap: 12 }}>
            {assessment && assessment.score != null && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--fg-subtle)" }}>Profile strength</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: assessment.score >= 85 ? "var(--good)" : assessment.score >= 60 ? "var(--warn)" : "var(--fg)" }}>{assessment.score}<span style={{ fontSize: 12, color: "var(--fg-subtle)", fontWeight: 600 }}>/100</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ width: `${assessment.score}%`, height: "100%", background: assessment.score >= 85 ? "var(--good)" : assessment.score >= 60 ? "var(--warn)" : "var(--accent)" }} />
                </div>
                {assessment.gaps?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-subtle)", marginBottom: 6 }}>I still want to strengthen</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {assessment.gaps.map((g, i) => <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{g}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <DraftPreview draft={draft} />
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .ob-grid { grid-template-columns: 1fr !important; }
          .ob-grid aside { position: static !important; }
        }
      `}</style>
    </main>
  );
}

function Bubble({ role, text, typing }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "84%", padding: "11px 14px", borderRadius: 14, fontSize: 14.5, lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          background: isUser ? "var(--accent)" : "var(--surface-2)",
          color: isUser ? "var(--accent-fg)" : "var(--fg)",
          border: isUser ? "none" : "1px solid var(--border)",
          borderBottomRightRadius: isUser ? 4 : 14,
          borderBottomLeftRadius: isUser ? 14 : 4,
          fontStyle: typing ? "italic" : "normal",
          opacity: typing ? 0.7 : 1,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ErrorNote({ text }) {
  return <div style={{ fontSize: 13, color: "var(--bad)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 12px" }}>{text}</div>;
}
