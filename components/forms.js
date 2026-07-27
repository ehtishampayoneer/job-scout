"use client";
// components/forms.js — small, reusable form primitives shared by onboarding
// and the profile editor. Plain and consistent with globals.css.

export function Section({ title, desc, children, right }) {
  return (
    <section className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: desc ? 4 : 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>{title}</h2>
        {right}
      </div>
      {desc && <p style={{ color: "var(--fg-muted)", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>{desc}</p>}
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

export function Text({ label, value, onChange, placeholder, multiline, type = "text", half, hint }) {
  return (
    <label style={{ display: "grid", gap: 5, flex: half ? "1 1 200px" : "1 1 auto", minWidth: 0 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)" }}>{label}</span>}
      {multiline ? (
        <textarea className="field" style={{ minHeight: 78 }} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="field" type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span style={{ fontSize: 11.5, color: "var(--fg-subtle)" }}>{hint}</span>}
    </label>
  );
}

export function Row({ children }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>;
}

// Comma-separated tags -> string[]
export function Tags({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)" }}>{label}</span>}
      <input
        className="field"
        value={(value || []).join(", ")}
        placeholder={placeholder || "Comma separated"}
        onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
      />
    </label>
  );
}

// "Label | https://url" per line -> [{label,url}]
export function LinksInput({ label, value, onChange }) {
  const text = (value || []).map((l) => `${l.label || "Link"} | ${l.url}`).join("\n");
  return (
    <label style={{ display: "grid", gap: 5 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)" }}>{label}</span>}
      <textarea
        className="field"
        style={{ minHeight: 68, fontFamily: "var(--font-mono, monospace)", fontSize: 12.5 }}
        value={text}
        placeholder={"LinkedIn | https://linkedin.com/in/you\nGitHub | https://github.com/you"}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((ln) => ln.trim())
              .filter(Boolean)
              .map((ln) => {
                const i = ln.indexOf("|");
                return i === -1
                  ? { label: "Link", url: ln.trim() }
                  : { label: ln.slice(0, i).trim() || "Link", url: ln.slice(i + 1).trim() };
              })
              .filter((l) => /^https?:\/\//i.test(l.url))
          )
        }
      />
    </label>
  );
}

// Generic add/remove list.
export function Repeater({ items, onChange, blank, render, addLabel }) {
  const list = Array.isArray(items) ? items : [];
  const update = (i, next) => onChange(list.map((it, idx) => (idx === i ? next : it)));
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, blank()]);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {list.map((item, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, position: "relative" }}>
          <button
            onClick={() => remove(i)}
            title="Remove"
            style={{ position: "absolute", top: 10, right: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, width: 26, height: 26, color: "var(--fg-muted)", lineHeight: 1 }}
          >
            ×
          </button>
          {render(item, (next) => update(i, next), i)}
        </div>
      ))}
      <button className="btn-ghost" style={{ height: 42, justifySelf: "start" }} onClick={add}>
        + {addLabel}
      </button>
    </div>
  );
}
