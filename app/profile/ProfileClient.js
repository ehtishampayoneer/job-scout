"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";

export function ProfileClient({ initialProfile, initialProjects, initialEmployment = [], initialEducation = [], email }) {
  const router = useRouter();
  const [p, setP] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Public microsite state
  const [pubEnabled, setPubEnabled] = useState(!!initialProfile.public_enabled);
  const [pubToken, setPubToken] = useState(initialProfile.public_token || "");
  const [showEmail, setShowEmail] = useState(!!initialProfile.public_show_email);
  const [pubBusy, setPubBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pubUrl = pubToken && typeof window !== "undefined" ? `${window.location.origin}/r/${pubToken}` : "";

  async function publish(enabled, showEmailVal) {
    setPubBusy(true);
    try {
      const res = await fetch("/api/profile/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, showEmail: showEmailVal ?? showEmail }),
      });
      const out = await res.json();
      if (res.ok) {
        setPubToken(out.token);
        setPubEnabled(out.enabled);
      }
    } finally {
      setPubBusy(false);
    }
  }

  function set(field, value) {
    setP((cur) => ({ ...cur, [field]: value }));
  }

  // Conversational profile edits: "add Python to my skills", "change my target
  // roles", "I now need visa sponsorship". Applies + saves, updates the view.
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatReplies, setChatReplies] = useState([]);
  async function updateByChat() {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChatBusy(true);
    try {
      const res = await fetch("/api/profile/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: chatReplies.flatMap((c) => [{ role: "user", content: c.q }, { role: "assistant", content: c.reply }]),
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Could not update.");
      if (out.patch && Object.keys(out.patch).length) setP((cur) => ({ ...cur, ...out.patch }));
      setChatReplies((prev) => [...prev, { q: msg, reply: out.reply }]);
      setChatInput("");
      router.refresh();
    } catch (e) {
      setChatReplies((prev) => [...prev, { q: msg, reply: "⚠️ " + e.message }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: p.full_name,
          headline: p.headline,
          location: p.location,
          contact_email: p.contact_email,
          contact_phone: p.contact_phone,
          education_note: p.education_note,
          summary: p.summary,
          salary_floor_usd: p.salary_floor_usd,
          salary_notes: p.salary_notes,
          visa_status: p.visa_status,
          tone_notes: p.tone_notes,
          target_roles: p.target_roles || [],
          acceptable_locations: p.acceptable_locations || [],
          strengths: p.strengths || [],
          weaknesses: p.weaknesses || [],
          links: p.links || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setEditing(false);
      setNote("Saved.");
      router.refresh();
    } catch (e) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <Brand />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/jobs" className="btn-primary" style={{ height: 38, display: "inline-flex", alignItems: "center" }}>Job matches</a>
            <span style={{ fontSize: 12.5, color: "var(--fg-subtle)", margin: "0 4px" }}>{email}</span>
            <button className="btn-ghost" style={{ height: 38 }} onClick={signOut}>Sign out</button>
          </div>
        </header>

        {/* Update by chat */}
        <div className="card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Update your profile by chat</div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 12, lineHeight: 1.5 }}>
            Just tell Job Scout what to change — e.g. &ldquo;add Figma to my skills&rdquo;, &ldquo;change my target roles to Head of Product and VP Product&rdquo;, &ldquo;I now need visa sponsorship&rdquo;, &ldquo;make my summary shorter&rdquo;.
          </div>
          {chatReplies.map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>You: {c.q}</div>
              <div style={{ fontSize: 13.5, marginTop: 2 }}>{c.reply}</div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="field"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Tell Job Scout what to change…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") updateByChat(); }}
            />
            <button className="btn-primary" style={{ height: 46 }} onClick={updateByChat} disabled={chatBusy || !chatInput.trim()}>
              {chatBusy ? "Updating…" : "Update"}
            </button>
          </div>
        </div>

        {/* Public microsite */}
        <div className="card" style={{ padding: 18, marginBottom: 20, background: pubEnabled ? "var(--accent-soft)" : "var(--surface)", borderColor: pubEnabled ? "#c7d2fe" : "var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Your public page {pubEnabled && <span style={{ color: "var(--good)", fontSize: 12.5 }}>● Live</span>}</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2, maxWidth: 520, lineHeight: 1.5 }}>
                A premium, shareable page that shows your shipped work as proof. Every application can link to it.
              </div>
            </div>
            <button className={pubEnabled ? "btn-ghost" : "btn-primary"} style={{ height: 40 }} onClick={() => publish(!pubEnabled)} disabled={pubBusy}>
              {pubBusy ? "…" : pubEnabled ? "Unpublish" : "Publish my page"}
            </button>
          </div>
          {pubEnabled && pubUrl && (
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input readOnly value={pubUrl} className="field" style={{ flex: 1, minWidth: 220, fontFamily: "var(--font-mono, monospace)", fontSize: 13 }} onFocus={(e) => e.target.select()} />
                <button className="btn-ghost" style={{ height: 46 }} onClick={() => { navigator.clipboard?.writeText(pubUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
                <a className="btn-ghost" style={{ height: 46, display: "inline-flex", alignItems: "center" }} href={pubUrl} target="_blank" rel="noopener noreferrer">Open ↗</a>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--fg-muted)" }}>
                <input type="checkbox" checked={showEmail} onChange={(e) => { setShowEmail(e.target.checked); publish(true, e.target.checked); }} />
                Show my contact email on the public page
              </label>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, margin: 0 }}>Master profile</h1>
          {!editing ? (
            <button className="btn-ghost" style={{ height: 40 }} onClick={() => setEditing(true)}>Edit</button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" style={{ height: 40 }} onClick={() => { setP(initialProfile); setEditing(false); setNote(""); }} disabled={busy}>Cancel</button>
              <button className="btn-primary" style={{ height: 40 }} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          )}
        </div>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 20px" }}>
          The source of truth for every application. Editable anytime.
        </p>
        {note && <div style={{ fontSize: 13, color: note === "Saved." ? "var(--good)" : "var(--bad)", marginBottom: 14 }}>{note}</div>}

        <div className="card" style={{ padding: 22, display: "grid", gap: 16 }}>
          <Field label="Name" value={p.full_name} editing={editing} onChange={(v) => set("full_name", v)} />
          <Field label="Headline" value={p.headline} editing={editing} onChange={(v) => set("headline", v)} />
          <Row>
            <Field label="Based in" value={p.location} editing={editing} onChange={(v) => set("location", v)} half />
            <Field label="Contact email" value={p.contact_email} editing={editing} onChange={(v) => set("contact_email", v)} half />
            <Field label="Phone" value={p.contact_phone} editing={editing} onChange={(v) => set("contact_phone", v)} half />
          </Row>
          <Field label="Summary" value={p.summary} editing={editing} onChange={(v) => set("summary", v)} multiline />
          <Row>
            <Field label="Salary floor (USD/mo)" value={p.salary_floor_usd} editing={editing} onChange={(v) => set("salary_floor_usd", v)} half />
            <Field label="Salary notes" value={p.salary_notes} editing={editing} onChange={(v) => set("salary_notes", v)} half />
          </Row>
          <Field label="Visa status" value={p.visa_status} editing={editing} onChange={(v) => set("visa_status", v)} />
          <Field label="Education note" value={p.education_note} editing={editing} onChange={(v) => set("education_note", v)} />
          <Field label="Tone notes" value={p.tone_notes} editing={editing} onChange={(v) => set("tone_notes", v)} multiline />
          <ArrayField label="Target roles" items={p.target_roles} editing={editing} onChange={(v) => set("target_roles", v)} />
          <ArrayField label="Acceptable locations" items={p.acceptable_locations} editing={editing} onChange={(v) => set("acceptable_locations", v)} />
          <ArrayField label="Strengths" items={p.strengths} editing={editing} onChange={(v) => set("strengths", v)} />
          <ArrayField label="Weaknesses" items={p.weaknesses} editing={editing} onChange={(v) => set("weaknesses", v)} />
          <LinksField label="Links (LinkedIn, GitHub, portfolio)" links={p.links} editing={editing} onChange={(v) => set("links", v)} />
        </div>

        {initialEmployment.length > 0 && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, margin: "26px 0 12px" }}>
              Work history <span style={{ color: "var(--fg-subtle)", fontWeight: 500 }}>({initialEmployment.length})</span>
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {initialEmployment.map((e) => (
                <div key={e.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {e.title}{e.company ? ` · ${e.company}` : ""}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>{dateRange(e)}</div>
                  </div>
                  {e.location && <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 2 }}>{e.location}</div>}
                  {e.summary && <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "8px 0 0" }}>{e.summary}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {initialEducation.length > 0 && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, margin: "26px 0 12px" }}>Education</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {initialEducation.map((e) => (
                <div key={e.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                      {[e.credential, e.field].filter(Boolean).join(" · ") || e.institution}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>
                      {[e.start_year, e.end_year].filter(Boolean).join(" – ")}
                    </div>
                  </div>
                  {e.institution && <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>{e.institution}</div>}
                  {e.notes && <p style={{ fontSize: 13, lineHeight: 1.5, margin: "6px 0 0", color: "var(--fg-muted)" }}>{e.notes}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, margin: "26px 0 12px" }}>
          Projects <span style={{ color: "var(--fg-subtle)", fontWeight: 500 }}>({initialProjects.length})</span>
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          {initialProjects.map((pr) => (
            <div key={pr.id} className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{pr.name}</div>
              {pr.one_liner && <div style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 3 }}>{pr.one_liner}</div>}
              {pr.description && <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "10px 0 0" }}>{pr.description}</p>}
              {pr.story && (
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: "10px 0 0", color: "var(--fg-muted)", borderLeft: "2px solid var(--border)", paddingLeft: 12 }}>
                  {pr.story}
                </p>
              )}
              {pr.stack?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                  {pr.stack.map((s, i) => <span key={i} className="chip" style={{ fontSize: 11.5, padding: "3px 9px" }}>{s}</span>)}
                </div>
              )}
              {Array.isArray(pr.links) && pr.links.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                  {pr.links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                       style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
                      {l.label || "Link"} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {initialProjects.length === 0 && (
            <div className="card" style={{ padding: 18, color: "var(--fg-muted)", fontSize: 13.5 }}>
              No projects captured yet.
            </div>
          )}
        </div>

        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-ghost" style={{ height: 40 }} onClick={() => { router.push("/onboarding"); }}>
            Redo onboarding
          </button>
          <a href="/jobs" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
            View your job matches →
          </a>
        </div>

        <div style={{ marginTop: 26, fontSize: 12.5, color: "var(--fg-subtle)", lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          Job Scout never auto-submits without your tap, never creates accounts or enters passwords, and never solves CAPTCHAs. It prepares; you approve.
        </div>
      </div>
    </main>
  );
}

function Row({ children }) {
  return <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{children}</div>;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(month, year) {
  if (!year) return "";
  return month ? `${MONTHS[month]} ${year}` : `${year}`;
}
function dateRange(e) {
  const start = fmt(e.start_month, e.start_year);
  const end = e.is_current ? "Present" : fmt(e.end_month, e.end_year);
  if (!start && !end) return "";
  return [start || "?", end || "?"].join(" – ");
}

function Field({ label, value, editing, onChange, multiline, half }) {
  return (
    <div style={{ flex: half ? "1 1 220px" : "1 1 auto", minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)", marginBottom: 5 }}>{label}</div>
      {editing ? (
        multiline ? (
          <textarea className="field" style={{ minHeight: 80 }} value={value || ""} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <div style={{ fontSize: 14, lineHeight: 1.55, color: value ? "var(--fg)" : "var(--fg-subtle)", whiteSpace: "pre-wrap" }}>
          {value || "—"}
        </div>
      )}
    </div>
  );
}

function LinksField({ label, links, editing, onChange }) {
  const list = Array.isArray(links) ? links : [];
  if (editing) {
    // One "Label | https://url" per line — simple and paste-friendly.
    const text = list.map((l) => `${l.label || "Link"} | ${l.url}`).join("\n");
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)", marginBottom: 5 }}>{label}</div>
        <textarea
          className="field"
          style={{ minHeight: 70, fontFamily: "var(--font-mono, monospace)", fontSize: 12.5 }}
          value={text}
          placeholder={"LinkedIn | https://linkedin.com/in/you\nGitHub | https://github.com/you"}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((ln) => ln.trim())
                .filter(Boolean)
                .map((ln) => {
                  const idx = ln.indexOf("|");
                  if (idx === -1) return { label: "Link", url: ln.trim() };
                  return { label: ln.slice(0, idx).trim() || "Link", url: ln.slice(idx + 1).trim() };
                })
                .filter((l) => /^https?:\/\//i.test(l.url))
            )
          }
        />
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)", marginBottom: 5 }}>{label}</div>
      {list.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {list.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: 13.5, color: "var(--accent)", fontWeight: 600 }}>
              {l.label || "Link"} ↗
            </a>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "var(--fg-subtle)" }}>—</div>
      )}
    </div>
  );
}

function ArrayField({ label, items, editing, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)", marginBottom: 5 }}>{label}</div>
      {editing ? (
        <input
          className="field"
          value={(items || []).join(", ")}
          onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
          placeholder="Comma separated"
        />
      ) : (items || []).length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((it, i) => <span key={i} className="chip">{it}</span>)}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "var(--fg-subtle)" }}>—</div>
      )}
    </div>
  );
}
