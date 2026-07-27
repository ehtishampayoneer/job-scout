// components/Brand.js
// Simple wordmark. Keeps the visual identity consistent across auth + app.
export function Brand({ size = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        aria-hidden
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          fontWeight: 800,
          fontSize: size - 4,
          lineHeight: 1,
        }}
      >
        J
      </span>
      <span style={{ fontWeight: 700, fontSize: size, letterSpacing: -0.4 }}>
        Job Scout
      </span>
    </div>
  );
}

export function SetupNeeded({ children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ maxWidth: 520, padding: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <Brand />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px" }}>
          Almost there — add your keys
        </h1>
        <div style={{ color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </main>
  );
}
