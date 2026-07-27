"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";

function fmtWhen(ts) {
  if (!ts) return "Time not set";
  try {
    return new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return ts;
  }
}

const TAG_COLOR = {
  interview: { fg: "var(--good)", bg: "#ecfdf5", bd: "#a7f3d0" },
  rejection: { fg: "var(--fg-muted)", bg: "var(--surface-2)", bd: "var(--border)" },
  question: { fg: "var(--accent)", bg: "var(--accent-soft)", bd: "#c7d2fe" },
  scam: { fg: "var(--bad)", bg: "#fef2f2", bd: "#fecaca" },
  other: { fg: "var(--fg-muted)", bg: "var(--surface-2)", bd: "var(--border)" },
};

const PIPELINE = [
  { key: "sent", label: "Applied" },
  { key: "responded", label: "Responded" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offers" },
  { key: "rejected", label: "Rejected" },
];

export function InboxClient({ email, apps, emails, interviews = [] }) {
  const router = useRouter();
  const [tab, setTab] = useState("in"); // in | sent | interviews
  const [logging, setLogging] = useState(false);
  const [showLog, setShowLog] = useState(false);

  async function setUpInterview(applicationId) {
    const res = await fetch("/api/interview/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId }),
    });
    const out = await res.json();
    if (res.ok && out.id) router.push(`/interview/${out.id}`);
  }

  const counts = useMemo(() => {
    const c = {};
    for (const a of apps) c[a.status] = (c[a.status] || 0) + 1;
    // "Applied" counts everything that reached at least sent.
    const reachedSent = apps.filter((a) => a.status !== "draft" && a.status !== "dismissed").length;
    return { ...c, sent: reachedSent };
  }, [apps]);

  const inbound = emails.filter((e) => e.direction === "in");
  const outbound = emails.filter((e) => e.direction === "out");
  const list = tab === "in" ? inbound : outbound;

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Nav email={email} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Inbox &amp; pipeline</h1>
          <button className="btn-ghost" style={{ height: 38 }} onClick={() => setShowLog((v) => !v)}>Log a reply</button>
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 18px" }}>
          Every application and reply, tracked in one place. Replies are tagged automatically.
        </p>

        {/* Pipeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
          {PIPELINE.map((s) => (
            <div key={s.key} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{counts[s.key] || 0}</div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {showLog && <LogReply apps={apps} busy={logging} setBusy={setLogging} onDone={() => { setShowLog(false); router.refresh(); }} />}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <Tab active={tab === "in"} onClick={() => setTab("in")}>Inbox ({inbound.length})</Tab>
          <Tab active={tab === "sent"} onClick={() => setTab("sent")}>Sent ({outbound.length})</Tab>
          <Tab active={tab === "interviews"} onClick={() => setTab("interviews")}>Interviews ({interviews.length})</Tab>
        </div>

        {tab === "interviews" ? (
          interviews.length === 0 ? (
            <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6 }}>
              No interviews yet. When a reply is tagged <b>interview</b>, open it and hit <b>Set up interview</b> to schedule it and get a prep brief.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {interviews.map((iv) => {
                const job = iv.jobs || {};
                const upcoming = iv.scheduled_at && new Date(iv.scheduled_at) > new Date();
                return (
                  <Link key={iv.id} href={`/interview/${iv.id}`} className="card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center", textDecoration: "none", color: "inherit" }}>
                    <div style={{ width: 52, textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--fg-subtle)", fontWeight: 700, textTransform: "uppercase" }}>{iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleDateString(undefined, { month: "short" }) : "TBD"}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{iv.scheduled_at ? new Date(iv.scheduled_at).getDate() : "–"}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{job.title || "Interview"}{job.company ? ` · ${job.company}` : ""}</div>
                      <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 2 }}>{fmtWhen(iv.scheduled_at)}{iv.location ? ` · ${iv.location}` : ""}</div>
                    </div>
                    <span className="chip" style={{ textTransform: "capitalize", color: upcoming ? "var(--good)" : "var(--fg-muted)" }}>{iv.status}</span>
                  </Link>
                );
              })}
            </div>
          )
        ) : list.length === 0 ? (
          <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--fg-muted)", fontSize: 14 }}>
            {tab === "in"
              ? "No replies yet. When companies respond, they land here, tagged automatically. You can also Log a reply to test tracking."
              : "Nothing sent yet. Prepare and send applications from the Apply tab."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {list.map((e) => <MailRow key={e.id} email={e} outbound={tab === "sent"} onSetup={setUpInterview} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function MailRow({ email, outbound, onSetup }) {
  const job = email.applications?.jobs;
  const tag = email.ai_tag || "other";
  const c = TAG_COLOR[tag] || TAG_COLOR.other;
  const canSetup = !outbound && tag === "interview" && email.application_id;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{email.subject || "(no subject)"}</div>
        {!outbound && (
          <span className="chip" style={{ color: c.fg, background: c.bg, borderColor: c.bd, textTransform: "capitalize" }}>{tag}</span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 3 }}>
        {outbound ? `To ${email.to_addr || "?"}` : `From ${email.from_addr || "?"}`}
        {job ? ` · ${job.title}${job.company ? ` at ${job.company}` : ""}` : ""}
      </div>
      {email.body && (
        <p style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.5, margin: "8px 0 0", whiteSpace: "pre-wrap", maxHeight: 90, overflow: "hidden" }}>
          {email.body.slice(0, 340)}
        </p>
      )}
      {canSetup && (
        <div style={{ marginTop: 12 }}>
          <button className="btn-primary" style={{ height: 36 }} onClick={() => onSetup(email.application_id)}>Set up interview</button>
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ height: 36, padding: "0 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "1px solid var(--border)", background: active ? "var(--surface-2)" : "transparent", color: active ? "var(--fg)" : "var(--fg-muted)" }}
    >
      {children}
    </button>
  );
}

function LogReply({ apps, busy, setBusy, onDone }) {
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/inbox/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, subject, body, applicationId: applicationId || null }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Could not log.");
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Log a reply</div>
      <input className="field" placeholder="From (e.g. jane@company.com)" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input className="field" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <select className="field" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
        <option value="">Link to an application (optional)</option>
        {apps.filter((a) => a.status !== "draft").map((a) => (
          <option key={a.id} value={a.id}>{a.jobs?.title || "Application"}{a.jobs?.company ? ` — ${a.jobs.company}` : ""}</option>
        ))}
      </select>
      <textarea className="field" style={{ minHeight: 90 }} placeholder="Paste the reply text…" value={body} onChange={(e) => setBody(e.target.value)} />
      {err && <div style={{ fontSize: 13, color: "var(--bad)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" style={{ height: 40 }} onClick={submit} disabled={busy}>{busy ? "Logging…" : "Log & tag"}</button>
      </div>
    </div>
  );
}
