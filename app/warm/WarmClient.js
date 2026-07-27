"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

export function WarmClient({ email, targets, latestLearning }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  async function findTargets() {
    setBusy("warm");
    setNote("");
    try {
      const res = await fetch("/api/warm/generate", { method: "POST" });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Failed.");
      setNote(out.added ? `Added ${out.added} warm targets. Refreshing…` : out.message || "No new targets right now.");
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy("");
    }
  }

  async function runLearning() {
    setBusy("learn");
    setNote("");
    try {
      const res = await fetch("/api/learn/run", { method: "POST" });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Failed.");
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy("");
    }
  }

  const active = targets.filter((t) => t.status !== "dismissed");
  const adj = latestLearning?.adjustments || {};

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Nav email={email} />

        {/* Learning / positioning panel */}
        <div className="card" style={{ padding: 20, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Weekly read</h2>
            <button className="btn-ghost" style={{ height: 36 }} onClick={runLearning} disabled={busy === "learn"}>
              {busy === "learn" ? "Analyzing…" : "Run analysis"}
            </button>
          </div>
          {latestLearning ? (
            <div style={{ marginTop: 12 }}>
              {adj.warning && (
                <div style={{ fontSize: 13, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: "10px 12px", marginBottom: 10, lineHeight: 1.5 }}>
                  Positioning warning: the numbers suggest a targeting or positioning problem, not a volume problem. Applying harder is not the fix.
                </div>
              )}
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>{latestLearning.notes}</p>
              {adj.adjustment && (
                <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: "var(--fg)" }}>
                  <strong>Try next:</strong> {adj.adjustment}
                </p>
              )}
              {adj.stats && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 12.5, color: "var(--fg-muted)" }}>
                  <span>Sent {adj.stats.sent}</span>
                  <span>Responded {adj.stats.responded}</span>
                  <span>Interviewing {adj.stats.interviewing}</span>
                  <span>Response rate {adj.stats.response_rate}%</span>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--fg-subtle)", marginTop: 10 }}>Last run {latestLearning.week_of}</div>
            </div>
          ) : (
            <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "10px 0 0", lineHeight: 1.6 }}>
              Once you have applications out, run an analysis for an honest read on what is converting and one concrete adjustment.
            </p>
          )}
        </div>

        {/* Warm channel */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Warm outreach</h1>
          <button className="btn-primary" style={{ height: 40 }} onClick={findTargets} disabled={busy === "warm"}>
            {busy === "warm" ? "Finding…" : "Find warm targets"}
          </button>
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 16px" }}>
          People and companies worth reaching directly. A warm intro converts far better than a cold application.
        </p>

        {note && (
          <div style={{ fontSize: 13, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: "var(--fg-muted)" }}>
            {note}
          </div>
        )}

        {active.length === 0 ? (
          <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6 }}>
            No warm targets yet. Run the scout to find strong-fit companies, then click Find warm targets to draft intros.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {active.map((t) => <WarmCard key={t.id} target={t} onChange={() => router.refresh()} />)}
          </div>
        )}
      </div>
    </main>
  );
}

function WarmCard({ target, onChange }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status) {
    setBusy(true);
    try {
      await fetch("/api/warm/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, status }),
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(target.draft_message || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  const person = target.person_name;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          {person ? (
            <>
              {person} <span style={{ color: "var(--fg-muted)", fontWeight: 500, fontSize: 14 }}>· {target.person_role || "Engineer"} at {target.name}</span>
            </>
          ) : (
            <>{target.name} <span style={{ color: "var(--fg-muted)", fontWeight: 500, fontSize: 14 }}>· reach the founder or hiring lead</span></>
          )}
        </div>
        <span className="chip" style={{ textTransform: "capitalize" }}>{target.status}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
        {target.channel && <span className="chip" style={{ fontSize: 11.5, textTransform: "capitalize" }}>via {target.channel}</span>}
        {target.person_url && (
          <a href={target.person_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>Profile ↗</a>
        )}
        {target.contact && <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{target.contact}</span>}
      </div>
      {target.why && <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 8, lineHeight: 1.5 }}>{target.why}</div>}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {target.draft_message}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn-primary" style={{ height: 36 }} onClick={copy}>{copied ? "Copied" : "Copy message"}</button>
        <button className="btn-ghost" style={{ height: 36 }} onClick={() => setStatus("reached")} disabled={busy}>Mark reached</button>
        <button className="btn-ghost" style={{ height: 36 }} onClick={() => setStatus("dismissed")} disabled={busy}>Dismiss</button>
      </div>
    </div>
  );
}
