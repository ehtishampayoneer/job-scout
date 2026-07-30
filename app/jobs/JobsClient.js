"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { readJson } from "@/lib/readJson";

const CHANNEL_LABEL = {
  "email-apply": "Email apply",
  "direct-form": "Direct form",
  "login-wall": "Login wall",
};

const APPLIED_STATUSES = ["sent", "responded", "interviewing", "rejected", "offer"];

export function JobsClient({ initialRows, statusByJob = {} }) {
  const router = useRouter();
  const [rows] = useState(initialRows);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [minFit, setMinFit] = useState(0);

  async function runScout(fresh = false) {
    // Coerce to a real boolean: if a button is ever wired as onClick={runScout},
    // `fresh` would be a click Event, and JSON.stringify would throw on the DOM
    // node's circular references. This guarantees we only ever send true/false.
    const isFresh = fresh === true;
    setBusy(true);
    setNote(isFresh ? "Clearing old matches and rescanning 50+ boards…" : "Scanning job boards and scoring matches…");
    try {
      const res = await fetch("/api/scout/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fresh: isFresh }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Scout failed.");
      setNote(
        data.survivors === 0
          ? "No senior remote roles matched right now. Try again later."
          : `Scanned ${data.fetched} postings, ${data.survivors} passed filters, scored ${data.scored} (ranked by ${data.ranker || "fit"}). Refreshing…`
      );
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  const visible = rows.filter((r) => (r.fit_score ?? 0) >= minFit);

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <Brand />
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/profile" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Profile</Link>
            <Link href="/apply" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Apply</Link>
            <button className="btn-ghost" style={{ height: 38 }} onClick={() => runScout(true)} disabled={busy} title="Wipe stale matches and rescan all sources fresh">
              Clear &amp; rescan
            </button>
            <button className="btn-primary" style={{ height: 38 }} onClick={() => runScout(false)} disabled={busy}>
              {busy ? "Scouting…" : "Run scout now"}
            </button>
          </nav>
        </header>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 4px" }}>Job matches</h1>
          {rows.length > 0 && (
            <label style={{ fontSize: 12.5, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 8 }}>
              Min fit
              <select className="field" style={{ height: 34, width: "auto", padding: "0 8px" }} value={minFit} onChange={(e) => setMinFit(Number(e.target.value))}>
                <option value={0}>All</option>
                <option value={60}>60+</option>
                <option value={75}>75+</option>
                <option value={85}>85+</option>
              </select>
            </label>
          )}
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 16px" }}>
          Ranked by how well each role fits you. Scout runs automatically every few hours; hit Run scout now to fetch immediately.
        </p>

        {note && (
          <div style={{ fontSize: 13, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: "var(--fg-muted)" }}>
            {note}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="card" style={{ padding: 26, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {rows.length === 0 ? "No matches yet" : "Nothing at this fit level"}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto 16px" }}>
              {rows.length === 0
                ? "Run the scout to scan RemoteOK, WeWorkRemotely, and company boards for senior remote roles that fit your profile."
                : "Lower the minimum fit filter, or run the scout again for fresh postings."}
            </div>
            {rows.length === 0 && (
              <button className="btn-primary" onClick={() => runScout(false)} disabled={busy}>
                {busy ? "Scouting…" : "Run scout now"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {visible.map((r) => (
              <JobCard key={r.id} row={r} status={statusByJob[r.job_id]} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function whenFound(ts) {
  if (!ts) return "";
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (days <= 0) return "found today";
  if (days === 1) return "found 1 day ago";
  return `found ${days} days ago`;
}
// Flag roles that look region-restricted (US-only etc.) — matters when applying from abroad.
function regionNote(loc) {
  const l = String(loc || "").toLowerCase();
  if (/worldwide|anywhere|global/.test(l)) return { text: "Remote worldwide", good: true };
  if (/\b(us|u\.s\.|usa|united states|us[- ]only|americas|north america)\b/.test(l)) return { text: "US-region only", good: false };
  if (/\b(eu|europe|emea|uk|united kingdom)\b/.test(l)) return { text: "Europe-region", good: false };
  return null;
}

function JobCard({ row, status }) {
  const job = row.jobs || {};
  const fit = row.fit_score ?? 0;
  const trust = row.trust_score ?? 0;
  const flags = Array.isArray(row.scam_flags) ? row.scam_flags : [];
  const region = regionNote(job.location_raw);
  const found = whenFound(job.first_seen);
  const applied = APPLIED_STATUSES.includes(status);
  const dismissed = status === "dismissed";

  return (
    <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "flex-start" }}>
      <FitBadge score={fit} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>
            {job.title} ↗
          </a>
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>
          {[job.company, job.location_raw || job.location_type, job.source, found].filter(Boolean).join(" · ")}
        </div>
        {row.why_it_fits && (
          <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "9px 0 0", color: "var(--fg)" }}>{row.why_it_fits}</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11, alignItems: "center" }}>
          {job.apply_channel && <span className="chip">{CHANNEL_LABEL[job.apply_channel] || job.apply_channel}</span>}
          {region && (
            <span className="chip" title="Where this role can hire" style={{ color: region.good ? "var(--good)" : "var(--warn)" }}>
              {region.text}
            </span>
          )}
          <span className="chip" title="How legitimate the company/posting looks" style={{ color: trust >= 60 ? "var(--good)" : trust >= 40 ? "var(--warn)" : "var(--bad)" }}>
            Trust {trust}
          </span>
          {flags.map((f, i) => (
            <span key={i} className="chip" style={{ color: "var(--bad)", borderColor: "#fecaca", background: "#fef2f2" }}>{f}</span>
          ))}
        </div>
        <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {applied ? (
            <>
              <span className="chip" style={{ color: "var(--good)", borderColor: "#a7f3d0", background: "#ecfdf5", fontWeight: 600 }}>✓ Applied</span>
              <Link href={`/apply?job=${job.id}`} style={{ fontSize: 12.5, color: "var(--fg-muted)", fontWeight: 600 }}>View application →</Link>
            </>
          ) : (
            <Link
              href={`/apply?job=${job.id}`}
              className="btn-primary"
              style={{ height: 36, display: "inline-flex", alignItems: "center", padding: "0 16px", fontSize: 13.5, fontWeight: 600 }}
            >
              Apply with copilot →
            </Link>
          )}
          {dismissed && <span className="chip" style={{ color: "var(--fg-subtle)" }}>Skipped</span>}
        </div>
      </div>
    </div>
  );
}

function FitBadge({ score }) {
  const color = score >= 80 ? "var(--good)" : score >= 60 ? "var(--warn)" : "var(--fg-subtle)";
  const bg = score >= 80 ? "#ecfdf5" : score >= 60 ? "#fffbeb" : "var(--surface-2)";
  return (
    <div style={{ width: 56, height: 56, borderRadius: 12, background: bg, border: `1px solid var(--border)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 9, color: "var(--fg-subtle)", fontWeight: 600, letterSpacing: 0.3, marginTop: 2 }}>FIT</div>
    </div>
  );
}
