"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { readJson } from "@/lib/readJson";

const FIT = {
  good: { label: "Works for you", color: "var(--good)", bg: "#ecfdf5", bd: "#a7f3d0" },
  maybe: { label: "Worth a try", color: "var(--warn)", bg: "#fffbeb", bd: "#fde68a" },
};

export function TasksClient({ platforms, email }) {
  const [guides, setGuides] = useState({}); // id -> {loading, error, data, open}

  async function getGuide(p) {
    const cur = guides[p.id];
    if (cur?.data) {
      setGuides((g) => ({ ...g, [p.id]: { ...cur, open: !cur.open } }));
      return;
    }
    setGuides((g) => ({ ...g, [p.id]: { loading: true, open: true } }));
    try {
      const res = await fetch("/api/tasks/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformId: p.id }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not build the guide.");
      setGuides((g) => ({ ...g, [p.id]: { data, open: true } }));
    } catch (e) {
      setGuides((g) => ({ ...g, [p.id]: { error: e.message, open: true } }));
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
            <Link href="/research" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Research</Link>
            <Link href="/profile" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Profile</Link>
          </nav>
        </header>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Do it, get paid</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 10px", lineHeight: 1.5 }}>
          Pure <strong>do-a-task → get-paid</strong>. No competition, no bidding, no applying to each task. Sign up once, pass a quick check, then just do tasks and get paid. Job Scout writes you a step-by-step start guide for each.
        </p>
        <div style={{ fontSize: 12.5, color: "var(--fg-muted)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 18, lineHeight: 1.5 }}>
          Honest heads-up: this is <strong>real but modest money</strong> — pocket money to a few hundred a month, not a salary. The best-paying one here is <strong>AI data annotation</strong> (top of the list).
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {platforms.map((p) => {
            const st = guides[p.id] || {};
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
                    <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 3 }}><strong>To start:</strong> {p.gate}</div>
                    {p.note && <div style={{ fontSize: 12.5, color: "var(--fg-subtle)", marginTop: 5, fontStyle: "italic" }}>{p.note}</div>}
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <span className="chip" style={{ color: fit.color, background: fit.bg, borderColor: fit.bd, fontWeight: 600 }}>{fit.label}</span>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6, lineHeight: 1.45 }}>{p.fit.why}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn-primary" style={{ height: 36, padding: "0 16px", fontSize: 13.5, fontWeight: 600 }} onClick={() => getGuide(p)} disabled={st.loading}>
                    {st.loading ? "Writing…" : st.data ? (st.open ? "Hide guide" : "Show guide") : "How to start earning"}
                  </button>
                  <a href={p.signup} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ height: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", fontSize: 13 }}>Sign up ↗</a>
                </div>

                {st.open && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    {st.error && <div style={{ fontSize: 13, color: "var(--bad)" }}>{st.error}</div>}
                    {st.loading && <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Writing your start guide…</div>}
                    {st.data && <Guide data={st.data} />}
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

function Guide({ data }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {data.how_to_start?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", marginBottom: 6 }}>How to start</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 5 }}>
            {data.how_to_start.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{s}</li>)}
          </ol>
        </div>
      )}
      {data.earn_tips?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", marginBottom: 6 }}>Tips to earn more</div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 5 }}>
            {data.earn_tips.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{s}</li>)}
          </ul>
        </div>
      )}
      {data.honest_expectation && (
        <div style={{ fontSize: 13, color: "var(--fg-muted)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
          <strong>Honest expectation:</strong> {data.honest_expectation}
        </div>
      )}
    </div>
  );
}
