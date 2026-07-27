"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Section, Text, Row, Tags, LinksInput, Repeater } from "@/components/forms";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY = {
  profile: {
    full_name: "", headline: "", location: "", contact_email: "", contact_phone: "",
    summary: "", salary_floor_usd: "", salary_notes: "", target_roles: [],
    acceptable_locations: [], visa_status: "", tone_notes: "", strengths: [],
    weaknesses: [], education_note: "", links: [],
  },
  employment: [],
  education: [],
  projects: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("intro"); // intro | review
  const [cvText, setCvText] = useState("");
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const P = draft.profile;
  const setProfile = (patch) => setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const setSection = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  async function extract(useCv) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText: useCv ? cvText : "" }),
      });
      const data = await res.json();
      if (data.draft) setDraft({ ...EMPTY, ...data.draft, profile: { ...EMPTY.profile, ...data.draft.profile } });
      if (!res.ok && data.error) setError(data.error);
      setPhase("review");
    } catch (e) {
      setError("Could not read the CV. You can still fill the form in.");
      setPhase("review");
    } finally {
      setBusy(false);
    }
  }

  async function loadExample() {
    try {
      const res = await fetch("/api/onboarding/example");
      const data = await res.json();
      setCvText(data.cv || "");
    } catch {
      setError("Could not load the example.");
    }
  }

  const missing = computeMissing(draft);

  async function save() {
    if (missing.length) {
      setError(`Still needed: ${missing.join(", ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, cvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
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
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", letterSpacing: -0.6 }}>Hand me your CV, I will do the rest</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 20px" }}>
            Paste your CV or LinkedIn and I will read it, write your professional summary, decide the senior roles you
            should be targeting, and build a complete profile for you. You just glance through it and save. Nothing is
            invented, and nothing a job application needs gets missed.
          </p>
          <textarea
            className="field"
            style={{ minHeight: 220, fontSize: 13.5, lineHeight: 1.55 }}
            placeholder="Paste your CV or LinkedIn export here…"
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
            <button className="btn-primary" onClick={() => extract(true)} disabled={busy}>
              {busy ? "Reading your CV…" : "Read my CV & continue"}
            </button>
            <button className="btn-ghost" onClick={() => extract(false)} disabled={busy}>
              Fill the form from scratch
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

  // ---- Review form ----
  return (
    <main style={{ minHeight: "100vh", padding: "22px clamp(12px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <Brand />
          <span className="chip">Review &amp; confirm</span>
        </header>

        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 4px" }}>The profile I built for you</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 18px" }}>
          I read your CV, wrote your summary, and picked the senior roles you should target. Glance through it, tweak anything you want, then save. Only your name, a contact email, and one work entry are required.
        </p>

        {missing.length > 0 && (
          <div style={{ fontSize: 13, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 10, padding: "10px 12px", marginBottom: 14, lineHeight: 1.5 }}>
            Before saving, add: {missing.join(", ")}.
          </div>
        )}
        {error && <ErrorNote text={error} />}

        {/* Basics */}
        <Section title="Basics">
          <Row>
            <Text label="Full name" value={P.full_name} onChange={(v) => setProfile({ full_name: v })} half />
            <Text label="Based in" value={P.location} onChange={(v) => setProfile({ location: v })} half />
          </Row>
          <Text label="Headline" value={P.headline} onChange={(v) => setProfile({ headline: v })} placeholder="e.g. CTO / Head of AI / Founding Engineer" />
          <Row>
            <Text label="Contact email" value={P.contact_email} onChange={(v) => setProfile({ contact_email: v })} type="email" half />
            <Text label="Phone (optional)" value={P.contact_phone} onChange={(v) => setProfile({ contact_phone: v })} half />
          </Row>
          <Text label="Professional summary" value={P.summary} onChange={(v) => setProfile({ summary: v })} multiline />
          <LinksInput label="Links (LinkedIn, GitHub, portfolio)" value={P.links} onChange={(v) => setProfile({ links: v })} />
        </Section>

        {/* Work history */}
        <Section title="Work history" desc="Companies with start and end dates. Job forms always ask for these.">
          <Repeater
            items={draft.employment}
            onChange={(v) => setSection("employment", v)}
            addLabel="Add a role"
            blank={() => ({ company: "", title: "", start_month: null, start_year: null, end_month: null, end_year: null, is_current: false, location: "", summary: "" })}
            render={(job, upd) => (
              <div style={{ display: "grid", gap: 10 }}>
                <Row>
                  <Text label="Title" value={job.title} onChange={(v) => upd({ ...job, title: v })} half />
                  <Text label="Company" value={job.company} onChange={(v) => upd({ ...job, company: v })} half />
                </Row>
                <Row>
                  <MonthYear label="Start" month={job.start_month} year={job.start_year} onChange={(m, y) => upd({ ...job, start_month: m, start_year: y })} />
                  {job.is_current ? (
                    <div style={{ flex: "1 1 200px", alignSelf: "end", color: "var(--fg-muted)", fontSize: 13, paddingBottom: 12 }}>Present</div>
                  ) : (
                    <MonthYear label="End" month={job.end_month} year={job.end_year} onChange={(m, y) => upd({ ...job, end_month: m, end_year: y })} />
                  )}
                </Row>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--fg-muted)" }}>
                  <input type="checkbox" checked={!!job.is_current} onChange={(e) => upd({ ...job, is_current: e.target.checked })} />
                  I currently work here
                </label>
                <Text label="Location (optional)" value={job.location} onChange={(v) => upd({ ...job, location: v })} />
                <Text label="What you built or led here" value={job.summary} onChange={(v) => upd({ ...job, summary: v })} multiline />
              </div>
            )}
          />
        </Section>

        {/* Education */}
        <Section title="Education" desc="Degrees, bootcamps, or self-study. If you have no formal degree, say so in the note.">
          <Text label="Education note" value={P.education_note} onChange={(v) => setProfile({ education_note: v })} placeholder="e.g. No formal CS degree; self-taught over 16 years" />
          <Repeater
            items={draft.education}
            onChange={(v) => setSection("education", v)}
            addLabel="Add education"
            blank={() => ({ institution: "", credential: "", field: "", start_year: null, end_year: null, notes: "" })}
            render={(ed, upd) => (
              <div style={{ display: "grid", gap: 10 }}>
                <Row>
                  <Text label="Institution" value={ed.institution} onChange={(v) => upd({ ...ed, institution: v })} half />
                  <Text label="Credential" value={ed.credential} onChange={(v) => upd({ ...ed, credential: v })} placeholder="BSc, Bootcamp, Self-taught" half />
                </Row>
                <Row>
                  <Text label="Field" value={ed.field} onChange={(v) => upd({ ...ed, field: v })} half />
                  <Text label="Start year" value={ed.start_year ?? ""} onChange={(v) => upd({ ...ed, start_year: v })} half />
                  <Text label="End year" value={ed.end_year ?? ""} onChange={(v) => upd({ ...ed, end_year: v })} half />
                </Row>
              </div>
            )}
          />
        </Section>

        {/* Preferences */}
        <Section title="What you are looking for" desc="I chose these based on your background. Adjust only if you disagree.">
          <Tags label="Roles I recommend you target" value={P.target_roles} onChange={(v) => setProfile({ target_roles: v })} placeholder="CTO, Head of AI, Founding Engineer" />
          <Tags label="Acceptable locations / time zones" value={P.acceptable_locations} onChange={(v) => setProfile({ acceptable_locations: v })} placeholder="Remote worldwide, EU, PST overlap" />
          <Row>
            <Text label="Salary floor (optional)" value={P.salary_floor_usd} onChange={(v) => setProfile({ salary_floor_usd: v })} half hint="Leave blank and Job Scout calibrates a realistic ask for each company automatically. Only set this if you want a hard minimum." />
            <Text label="Salary notes / target" value={P.salary_notes} onChange={(v) => setProfile({ salary_notes: v })} half />
          </Row>
          <Text label="Visa / work authorization" value={P.visa_status} onChange={(v) => setProfile({ visa_status: v })} placeholder="e.g. Valid USA B1/B2; open to relocation with sponsorship" />
          <Text label="Tone for outreach (optional)" value={P.tone_notes} onChange={(v) => setProfile({ tone_notes: v })} />
          <Tags label="Strengths" value={P.strengths} onChange={(v) => setProfile({ strengths: v })} />
          <Tags label="Weaknesses (honest)" value={P.weaknesses} onChange={(v) => setProfile({ weaknesses: v })} />
        </Section>

        {/* Projects */}
        <Section title="Projects" desc="Your shipped work. For the story, write it yourself or let me draft one from the facts for you to approve.">
          <Repeater
            items={draft.projects}
            onChange={(v) => setSection("projects", v)}
            addLabel="Add a project"
            blank={() => ({ name: "", one_liner: "", description: "", story: "", stack: [], links: [] })}
            render={(pr, upd, i) => (
              <div style={{ display: "grid", gap: 10 }}>
                <Text label="Name" value={pr.name} onChange={(v) => upd({ ...pr, name: v })} />
                <Text label="One-liner" value={pr.one_liner} onChange={(v) => upd({ ...pr, one_liner: v })} />
                <Text label="Description" value={pr.description} onChange={(v) => upd({ ...pr, description: v })} multiline />
                <Tags label="Stack" value={pr.stack} onChange={(v) => upd({ ...pr, stack: v })} />
                <LinksInput label="Links (live demo, repo)" value={pr.links} onChange={(v) => upd({ ...pr, links: v })} />
                <StoryField project={pr} profile={P} employment={draft.employment} onChange={(story) => upd({ ...pr, story })} />
              </div>
            )}
          />
        </Section>

        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0 40px", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
          <button className="btn-ghost" onClick={() => setPhase("intro")} disabled={saving}>Back</button>
          {missing.length > 0 && <span style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>{missing.length} required field(s) left</span>}
        </div>
      </div>
    </main>
  );
}

function StoryField({ project, profile, employment, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function draft() {
    if (!project.name) { setErr("Add a project name first."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/onboarding/draft-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, profile, employment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not draft.");
      onChange(data.story || "");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)" }}>
          Story: what broke, the decision, what you'd redo
        </span>
        <button className="btn-ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }} onClick={draft} disabled={busy}>
          {busy ? "Drafting…" : project.story ? "Redraft for me" : "Draft for me"}
        </button>
      </div>
      <textarea className="field" style={{ minHeight: 96 }} value={project.story ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Write it yourself, or click Draft for me and edit what I suggest." />
      {project.story && <span style={{ fontSize: 11.5, color: "var(--fg-subtle)" }}>Drafts are suggestions. Edit anything that is not exactly true before saving.</span>}
      {err && <span style={{ fontSize: 12, color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}

function MonthYear({ label, month, year, onChange }) {
  return (
    <div style={{ flex: "1 1 200px", display: "grid", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)" }}>{label}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <select className="field" style={{ flex: "0 0 90px", height: 46 }} value={month ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null, year)}>
          {MONTHS.map((m, i) => <option key={i} value={i || ""}>{i === 0 ? "Month" : m}</option>)}
        </select>
        <input className="field" style={{ flex: 1 }} inputMode="numeric" placeholder="Year" value={year ?? ""} onChange={(e) => onChange(month, e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : null)} />
      </div>
    </div>
  );
}

function ErrorNote({ text }) {
  return <div style={{ fontSize: 13, color: "var(--bad)", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 12px", margin: "12px 0" }}>{text}</div>;
}

// Client-side mirror of lib/onboarding.missingSlots (kept in sync).
function computeMissing(draft) {
  const p = draft.profile || {};
  const m = [];
  if (!p.full_name?.trim()) m.push("your name");
  if (!p.contact_email?.trim()) m.push("a contact email");
  if (!(draft.employment || []).length) m.push("at least one work-history entry");
  return m;
}
