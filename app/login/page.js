"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("error"); // error | info

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) {
      setMsgType("error");
      setMsg("Enter your email and a password.");
      return;
    }
    setBusy(true);
    setMsg("");
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setMsgType("error");
        setMsg(error.message);
      } else {
        setMsgType("info");
        setMsg("Account created. If email confirmation is on, check your inbox — otherwise sign in now.");
        setMode("signin");
      }
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsgType("error");
      setMsg(error.message);
      setBusy(false);
      return;
    }
    // Signed in — the gate will route to onboarding or profile.
    router.replace("/");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 30 }}>
        <div style={{ marginBottom: 22 }}>
          <Brand />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: -0.4 }}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: "0 0 22px", lineHeight: 1.55 }}>
          Your private job-application copilot. One account, one profile, one you.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)", fontWeight: 500 }}>Email</span>
            <input
              className="field"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)", fontWeight: 500 }}>Password</span>
            <input
              className="field"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {msg && (
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: msgType === "error" ? "var(--bad)" : "var(--good)",
                background: msgType === "error" ? "#fef2f2" : "#ecfdf5",
                border: `1px solid ${msgType === "error" ? "#fecaca" : "#a7f3d0"}`,
                borderRadius: 10,
                padding: "9px 12px",
              }}
            >
              {msg}
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 13.5, color: "var(--fg-muted)", textAlign: "center" }}>
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMsg("");
            }}
            style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, padding: 0 }}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
