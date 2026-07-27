// components/DraftPreview.js
// A calm, read-only summary of the profile draft as it fills in during the
// interview. Shared shape with the DB row.
export function DraftPreview({ draft }) {
  const p = draft?.profile || {};
  const projects = draft?.projects || [];
  const filled =
    [p.full_name, p.headline, p.summary, p.salary_floor_usd, p.visa_status].filter(Boolean).length +
    (p.target_roles?.length ? 1 : 0) +
    (p.acceptable_locations?.length ? 1 : 0) +
    (projects.length ? 1 : 0);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--fg-subtle)" }}>
          Your profile so far
        </span>
        <span className="chip" style={{ fontSize: 11.5 }}>{filled}/8</span>
      </div>

      <Line label="Name" value={p.full_name} />
      <Line label="Headline" value={p.headline} />
      <Line label="Based in" value={p.location} />
      <Line label="Salary floor" value={p.salary_floor_usd ? `$${p.salary_floor_usd}/mo` : null} />
      <Line label="Visa" value={p.visa_status} />
      <Chips label="Target roles" items={p.target_roles} />
      <Chips label="Locations" items={p.acceptable_locations} />
      <Chips label="Strengths" items={p.strengths} />

      {p.links && p.links.length > 0 && (
        <div style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
          <Label>Links</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
            {p.links.map((l, i) => (
              <span key={i} className="chip" style={{ fontSize: 11.5, padding: "3px 9px" }}>{l.label}</span>
            ))}
          </div>
        </div>
      )}

      {p.summary && (
        <div style={{ marginTop: 12 }}>
          <Label>Summary</Label>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg)", margin: "4px 0 0" }}>{p.summary}</p>
        </div>
      )}

      {projects.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Label>Projects ({projects.length})</Label>
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {projects.map((pr, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{pr.name}</div>
                {pr.one_liner && (
                  <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.5 }}>{pr.one_liner}</div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {pr.story && pr.story.trim().length > 40 && (
                    <span style={{ fontSize: 11, color: "var(--good)", fontWeight: 600 }}>story ✓</span>
                  )}
                  {pr.links && pr.links.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--fg-subtle)", fontWeight: 600 }}>link ✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{children}</span>;
}

function Line({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
      <Label>{label}</Label>
      <span style={{ fontSize: 13, color: value ? "var(--fg)" : "var(--fg-subtle)", textAlign: "right", maxWidth: "62%" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Chips({ label, items }) {
  if (!items || !items.length) return <Line label={label} value={null} />;
  return (
    <div style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <Label>{label}</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
        {items.map((it, i) => (
          <span key={i} className="chip" style={{ fontSize: 11.5, padding: "3px 9px" }}>{it}</span>
        ))}
      </div>
    </div>
  );
}
