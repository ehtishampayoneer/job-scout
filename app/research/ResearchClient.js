"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { readJson } from "@/lib/readJson";

const FIT = {
  good: { label: "Good fit for you", color: "var(--good)", bg: "#ecfdf5", bd: "#a7f3d0" },
  maybe: { label: "Worth a try", color: "var(--warn)", bg: "#fffbeb", bd: "#fde68a" },
  limited: { label: "Likely limited", color: "var(--fg-subtle)", bg: "var(--surface-2)", bd: "var(--border)" },
};

export function ResearchClient({ platforms, email }) {
  const [apps, setApps] = useState({}); // id -> {loading, error, data, open}

  async function writeApp(p) {
    const cur = apps[p.id];
    if (cur?.data) {
      setApps((a) => ({ ...a, [p.id]: { ...cur, open: !cur.open } }));
      return;
    }
    setApps((a) => ({ ...a, [p.id]: { loading: true, open: true } }));
    try {
      const res = await fetch("/api/research/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformId: p.id }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not write it.");
      setApps((a) => ({ ...a, [p.id]: { data, open: true } }));
    } catch (e) {
      setApps((a) => ({ ...a, [p.id]: { error: e.message, open: true } }));
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <Brand />
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/jobs" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Job matches</Link>
            <Link href="/bounties" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Bounties</Link>
            <Link href="/tasks" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Tasks</Link>
            <Link href="/profile" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Profile</Link>
            <span style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>{email}</span>
          </nav>
        </header>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Paid Research & Expert Calls</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 18px", lineHeight: 1.5 }}>
          Get paid to share your knowledge — a study, an interview, or an expert call. <strong>No competition, no bidding</strong>: once you're matched, you do the task and get paid. Sign up to the ones that fit you (flagged below), and Job Scout writes your application.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {platforms.map((p) => {
            const st = apps[p.id] || {};
            const fit = FIT[p.fit.level] || FIT.maybe;
            return (
              <div className="card" key={p.id} style={{ padding: 18 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</span>
                      <span className="chip">{p.category}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 5, lineHeight: 1.5 }}>{p.what}</div>
                    <div style={{ fontSize: 13, marginTop: 7 }}><strong>Pay:</strong> {p.pay}</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 3 }}><strong>How you get paid:</strong> {p.howPaid}</div>
                    {p.note && <div style={{ fontSize: 12.5, color: "var(--fg-subtle)", marginTop: 5, fontStyle: "italic" }}>{p.note}</div>}
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <span className="chip" style={{ color: fit.color, background: fit.bg, borderColor: fit.bd, fontWeight: 600 }}>{fit.label}</span>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6, lineHeight: 1.45 }}>{p.fit.why}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn-primary" style={{ height: 36, padding: "0 16px", fontSize: 13.5, fontWeight: 600 }} onClick={() => writeApp(p)} disabled={st.loading}>
                    {st.loading ? "Writing…" : st.data ? (st.open ? "Hide application" : "Show application") : "Write my application"}
                  </button>
                  <a href={p.signup} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ height: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", fontSize: 13 }}>Sign up ↗</a>
                </div>

                {st.open && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    {st.error && <div style={{ fontSize: 13, color: "var(--bad)" }}>{st.error}</div>}
                    {st.loading && <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Writing your application from your profile…</div>}
                    {st.data && <AppView data={st.data} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function AppView({ data }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {data.bio && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>Your expert bio (paste into signup)</div>
            <button className="btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => { try { navigator.clipboard?.writeText(data.bio); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>{data.bio}</div>
        </div>
      )}
      {data.expertise_tags?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", marginBottom: 6 }}>Expertise tags to select</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {data.expertise_tags.map((t, i) => <span key={i} className="chip">{t}</span>)}
          </div>
        </div>
      )}
      {data.tips?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", marginBottom: 6 }}>Tips to get accepted & matched</div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 5 }}>
            {data.tips.map((t, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
