"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { readJson } from "@/lib/readJson";

const money = (n, token) => (n ? `${Number(n).toLocaleString()} ${token || "USDC"}` : token || "—");
const whenDue = (iso) => {
  if (!iso) return "";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return "closing";
  if (days === 0) return "due today";
  return `${days}d left`;
};

export function BountiesClient({ initialBounties, email }) {
  const [bounties] = useState(initialBounties || []);
  const [query, setQuery] = useState("");
  const [assist, setAssist] = useState({}); // ref -> {loading, error, data, open}

  async function getHelp(b) {
    const cur = assist[b.ref];
    if (cur?.data) {
      setAssist((a) => ({ ...a, [b.ref]: { ...cur, open: !cur.open } }));
      return;
    }
    setAssist((a) => ({ ...a, [b.ref]: { loading: true, open: true } }));
    try {
      const res = await fetch("/api/bounty/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: b.source, ref: b.ref, title: b.title, reward: b.reward, token: b.token, type: b.type }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not analyze.");
      setAssist((a) => ({ ...a, [b.ref]: { data, open: true } }));
    } catch (e) {
      setAssist((a) => ({ ...a, [b.ref]: { error: e.message, open: true } }));
    }
  }

  const q = query.trim().toLowerCase();
  const visible = bounties.filter((b) => !q || `${b.title} ${b.sponsor || ""}`.toLowerCase().includes(q));

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <Brand />
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/jobs" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Job matches</Link>
            <Link href="/research" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Research</Link>
            <Link href="/tasks" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Tasks</Link>
            <Link href="/profile" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Profile</Link>
            <span style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>{email}</span>
          </nav>
        </header>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Bounties</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 10px", lineHeight: 1.5 }}>
          Tasks with the reward <strong>already committed</strong> — but be clear: these are <strong>competitive</strong> (the best submission wins). Your edge is our AI: it explains the task, writes you a <strong>winning proposal</strong>, and does most of the work so you can actually win it.
        </p>
        <div style={{ fontSize: 12.5, color: "var(--fg-muted)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, lineHeight: 1.5 }}>
          Want <strong>do-a-task → get-paid, no competition</strong>? That&apos;s the <Link href="/research" style={{ color: "var(--accent)", fontWeight: 600 }}>Research &amp; Expert Calls</Link> tab — you get paid for studies and calls once you&apos;re matched, no competing.
        </div>

        <input
          className="field"
          style={{ marginBottom: 16 }}
          placeholder="Search bounties by title or sponsor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {visible.length === 0 ? (
          <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--fg-muted)", fontSize: 14 }}>
            {bounties.length === 0 ? "No open bounties right now. Check back shortly." : "Nothing matches that search."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {visible.map((b) => {
              const st = assist[b.ref] || {};
              return (
                <div className="card" key={b.ref} style={{ padding: 18 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 84, textAlign: "center", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "10px 8px" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--good)", lineHeight: 1.1 }}>{b.reward ? Number(b.reward).toLocaleString() : "—"}</div>
                      <div style={{ fontSize: 10, color: "var(--fg-subtle)", fontWeight: 600, marginTop: 2 }}>{b.token || "USDC"}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{b.title} ↗</a>
                      <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
                        {[b.sponsor, b.type, b.source, whenDue(b.deadline)].filter(Boolean).join(" · ")}
                      </div>
                      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn-primary" style={{ height: 36, padding: "0 16px", fontSize: 13.5, fontWeight: 600 }} onClick={() => getHelp(b)} disabled={st.loading}>
                          {st.loading ? "Analyzing…" : st.data ? (st.open ? "Hide help" : "Show help") : "Explain + write my proposal"}
                        </button>
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ height: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", fontSize: 13 }}>Open bounty ↗</a>
                      </div>
                    </div>
                  </div>

                  {st.open && (
                    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                      {st.error && <div style={{ fontSize: 13, color: "var(--bad)" }}>{st.error}</div>}
                      {st.loading && <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Reading the bounty and writing your proposal…</div>}
                      {st.data && <Help data={st.data} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Help({ data }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Block label="What this is (plain English)">{data.what_it_is}</Block>
      {data.can_you_do_it && <Block label="Can you do it?">{data.can_you_do_it}</Block>}
      {data.proposal && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>Your winning proposal</div>
            <button
              className="btn-ghost"
              style={{ height: 30, fontSize: 12 }}
              onClick={() => { try { navigator.clipboard?.writeText(data.proposal); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>{data.proposal}</div>
        </div>
      )}
      {data.approach?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", marginBottom: 6 }}>How to actually do it</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 5 }}>
            {data.approach.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{s}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function Block({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
