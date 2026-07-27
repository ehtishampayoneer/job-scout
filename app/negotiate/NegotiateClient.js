"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";

export function NegotiateClient({ email, apps, profile }) {
  const [applicationId, setApplicationId] = useState(apps[0]?.id || "");
  const [freeform, setFreeform] = useState(apps.length === 0);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobText, setJobText] = useState("");
  const [offer, setOffer] = useState("");
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setBusy(true);
    setErr("");
    setBrief(null);
    try {
      const body = freeform
        ? { title, company, jobText, offer }
        : { applicationId, offer };
      const res = await fetch("/api/negotiate/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Failed.");
      setBrief(out.brief);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Nav email={email} />

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Negotiation</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 18px", lineHeight: 1.55 }}>
          A defensible ask range from the posting, the company's stage, the role, and the market, so you do not leave cash on the table. These are informed estimates, not live market data.
        </p>

        <div className="card" style={{ padding: 18, marginBottom: 16, display: "grid", gap: 12 }}>
          {apps.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, color: "var(--fg-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                <input type="radio" checked={!freeform} onChange={() => setFreeform(false)} /> An application
              </label>
              <label style={{ fontSize: 13, color: "var(--fg-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                <input type="radio" checked={freeform} onChange={() => setFreeform(true)} /> Enter a role manually
              </label>
            </div>
          )}

          {!freeform && apps.length > 0 ? (
            <select className="field" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.jobs?.title || "Role"}{a.jobs?.company ? ` — ${a.jobs.company}` : ""}{a.salary_ask ? ` (asked ${a.salary_ask})` : ""}</option>
              ))}
            </select>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input className="field" style={{ flex: "1 1 200px" }} placeholder="Role title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input className="field" style={{ flex: "1 1 200px" }} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <textarea className="field" style={{ minHeight: 90 }} placeholder="Paste the job description (helps gauge stage and scale)…" value={jobText} onChange={(e) => setJobText(e.target.value)} />
            </div>
          )}

          <input className="field" placeholder="Their offer, if any (e.g. $5,000/month). Leave blank to prep your ask." value={offer} onChange={(e) => setOffer(e.target.value)} />
          <div><button className="btn-primary" style={{ height: 44 }} onClick={generate} disabled={busy}>{busy ? "Working…" : "Get my number"}</button></div>
          {err && <div style={{ fontSize: 13, color: "var(--bad)" }}>{err}</div>}
        </div>

        {brief && (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="card" style={{ padding: 20, background: "var(--accent-soft)", borderColor: "#c7d2fe" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 0.5 }}>Recommended ask</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6, margin: "6px 0 4px" }}>{brief.ask_range}</div>
              {brief.anchor && <div style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>Anchor: {brief.anchor}</div>}
            </div>

            {brief.reasoning && <Sec title="Why this range">{brief.reasoning}</Sec>}
            {brief.counter_script && <Sec title="What to say">{brief.counter_script}</Sec>}

            {brief.scenarios?.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>If they say…</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {brief.scenarios.map((s, i) => (
                    <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{s.situation}</div>
                      <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6 }}>{s.response}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {brief.watch_outs?.length > 0 && (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Watch out for</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{brief.watch_outs.map((w, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--warn)" }}>{w}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Sec({ title, children }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  );
}
