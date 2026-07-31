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
const LOW_FIT = 45; // roles below this are hidden behind a "show more" toggle
// The big platforms that force an account (and are where the pay-to-apply /
// gated flows live). We only skip THESE — email, company websites, company ATS
// forms and free boards all stay, since those are perfectly good ways to apply.
const GATED_URL_RE = /linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|monster\.com/i;

export function JobsClient({ initialRows, statusByJob = {}, appliedAtByJob = {} }) {
  const router = useRouter();
  const [rows] = useState(initialRows);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [minFit, setMinFit] = useState(0);
  const [tab, setTab] = useState("matches"); // "matches" | "applied"
  const [query, setQuery] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [hideGated, setHideGated] = useState(false);
  const [dateRange, setDateRange] = useState("all"); // all | today | week

  // Scan only — adds new jobs, never deletes. Repeats are prevented server-side.
  async function runScout() {
    setBusy(true);
    setNote("Scanning job boards and scoring matches…");
    try {
      const res = await fetch("/api/scout/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Scout failed.");
      setNote(
        data.survivors === 0
          ? rows.length
            ? "No new roles this time — your existing matches are below."
            : "Nothing matched yet. Try again shortly, or widen your profile."
          : `Scanned ${data.fetched} postings, added ${data.survivors} new, scored ${data.scored}. Refreshing…`
      );
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Clear only — deletes un-applied matches, does NOT scan. Applied jobs are kept.
  async function clearJobs() {
    if (typeof window !== "undefined" && !window.confirm("Clear all un-applied job matches? Your applied jobs are kept. This does NOT scan for new jobs.")) return;
    setBusy(true);
    setNote("Clearing matches…");
    try {
      const res = await fetch("/api/scout/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearOnly: true }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not clear.");
      setNote("Cleared. Hit Run scout now to fetch fresh jobs.");
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const matchesQuery = (r) => {
    if (!q) return true;
    const j = r.jobs || {};
    return `${j.title || ""} ${j.company || ""}`.toLowerCase().includes(q);
  };
  const isApplied = (r) => APPLIED_STATUSES.includes(statusByJob[r.job_id]);

  // Matches = not yet applied and not skipped. Applied = already submitted.
  const notApplied = rows.filter((r) => !isApplied(r) && statusByJob[r.job_id] !== "dismissed");
  const appliedRows = rows
    .filter(isApplied)
    .sort((a, b) => new Date(appliedAtByJob[b.job_id] || 0) - new Date(appliedAtByJob[a.job_id] || 0));

  // Matches tab: search + min-fit + direct-only, split into strong vs low-fit.
  const matchPool = notApplied
    .filter(matchesQuery)
    .filter((r) => (r.fit_score ?? 0) >= minFit)
    .filter((r) => (hideGated ? !GATED_URL_RE.test(r.jobs?.url || "") : true));
  const strong = matchPool.filter((r) => (r.fit_score ?? 0) >= LOW_FIT);
  const low = matchPool.filter((r) => (r.fit_score ?? 0) < LOW_FIT);

  // Applied tab: search + date range.
  const now = Date.now();
  const inRange = (r) => {
    if (dateRange === "all") return true;
    const t = new Date(appliedAtByJob[r.job_id] || 0).getTime();
    if (!t) return false;
    const days = (now - t) / 86400000;
    return dateRange === "today" ? days < 1 : days < 7;
  };
  const appliedView = appliedRows.filter(matchesQuery).filter(inRange);

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <Brand />
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/profile" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Profile</Link>
            <Link href="/apply" className="btn-ghost" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Apply</Link>
            <button className="btn-ghost" style={{ height: 38 }} onClick={clearJobs} disabled={busy} title="Delete un-applied matches (does NOT scan). Applied jobs are kept.">
              Clear
            </button>
            <button className="btn-primary" style={{ height: 38 }} onClick={runScout} disabled={busy}>
              {busy ? "Scouting…" : "Run scout now"}
            </button>
          </nav>
        </header>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: "0 0 12px" }}>Job matches</h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <TabBtn active={tab === "matches"} onClick={() => setTab("matches")}>To apply ({notApplied.length})</TabBtn>
          <TabBtn active={tab === "applied"} onClick={() => setTab("applied")}>Applied ({appliedRows.length})</TabBtn>
        </div>

        {/* Search */}
        <input
          className="field"
          style={{ marginBottom: 12 }}
          placeholder="Search by company or job title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {note && (
          <div style={{ fontSize: 13, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: "var(--fg-muted)" }}>
            {note}
          </div>
        )}

        {tab === "matches" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                Min fit
                <select className="field" style={{ height: 34, width: "auto", padding: "0 8px" }} value={minFit} onChange={(e) => setMinFit(Number(e.target.value))}>
                  <option value={0}>All</option>
                  <option value={45}>45+</option>
                  <option value={60}>60+</option>
                  <option value={75}>75+</option>
                </select>
              </label>
              <label style={{ fontSize: 12.5, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} title="Hide roles that route through LinkedIn / Indeed / Glassdoor / ZipRecruiter (account required). Keeps email-apply, company websites, ATS forms and free boards.">
                <input type="checkbox" checked={hideGated} onChange={(e) => setHideGated(e.target.checked)} />
                Hide account-gated platforms (LinkedIn, Indeed…)
              </label>
            </div>

            {strong.length === 0 && low.length === 0 ? (
              <div className="card" style={{ padding: 26, textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  {rows.length === 0 ? "No matches yet" : "Nothing matches these filters"}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto 16px" }}>
                  {rows.length === 0
                    ? "Run the scout to scan job boards and company sites for roles that fit your profile."
                    : "Clear the search, lower the minimum fit, or run the scout again for fresh postings."}
                </div>
                {rows.length === 0 && (
                  <button className="btn-primary" onClick={runScout} disabled={busy}>
                    {busy ? "Scouting…" : "Run scout now"}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 12 }}>
                  {strong.map((r) => <JobCard key={r.id} row={r} status={statusByJob[r.job_id]} />)}
                </div>
                {low.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button className="btn-ghost" style={{ height: 36, fontSize: 13 }} onClick={() => setShowLow((v) => !v)}>
                      {showLow ? "Hide" : `Show ${low.length}`} lower-fit role{low.length === 1 ? "" : "s"} (under {LOW_FIT})
                    </button>
                    {showLow && (
                      <div style={{ display: "grid", gap: 12, marginTop: 12, opacity: 0.9 }}>
                        {low.map((r) => <JobCard key={r.id} row={r} status={statusByJob[r.job_id]} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[["all", "All"], ["today", "Today"], ["week", "This week"]].map(([k, label]) => (
                <button
                  key={k}
                  className="chip"
                  onClick={() => setDateRange(k)}
                  style={{ cursor: "pointer", fontWeight: dateRange === k ? 700 : 500, color: dateRange === k ? "var(--fg)" : "var(--fg-muted)", borderColor: dateRange === k ? "var(--fg-muted)" : "var(--border)" }}
                >
                  {label}
                </button>
              ))}
            </div>
            {appliedView.length === 0 ? (
              <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6 }}>
                {appliedRows.length === 0
                  ? "You haven't applied to any roles yet. Open one from the To apply tab and hit Open form & mark applied."
                  : "Nothing in this range or search."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {appliedView.map((r) => <JobCard key={r.id} row={r} status={statusByJob[r.job_id]} appliedAt={appliedAtByJob[r.job_id]} />)}
              </div>
            )}
          </>
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

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 36,
        padding: "0 16px",
        fontSize: 13.5,
        fontWeight: 600,
        borderRadius: 9,
        cursor: "pointer",
        border: "1px solid var(--border)",
        background: active ? "var(--fg)" : "transparent",
        color: active ? "var(--bg)" : "var(--fg-muted)",
      }}
    >
      {children}
    </button>
  );
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function JobCard({ row, status, appliedAt }) {
  const job = row.jobs || {};
  const fit = row.fit_score ?? 0;
  const trust = row.trust_score ?? 0;
  const flags = Array.isArray(row.scam_flags) ? row.scam_flags : [];
  const region = regionNote(job.location_raw);
  const found = whenFound(job.first_seen);
  const applied = APPLIED_STATUSES.includes(status);
  const dismissed = status === "dismissed";
  const appliedLabel = appliedAt ? fmtDate(appliedAt) : null;

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
              <span className="chip" style={{ color: "var(--good)", borderColor: "#a7f3d0", background: "#ecfdf5", fontWeight: 600 }}>
                ✓ Applied{appliedLabel ? ` · ${appliedLabel}` : ""}
              </span>
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
