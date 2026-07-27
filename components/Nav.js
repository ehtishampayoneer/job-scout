"use client";
// components/Nav.js — shared top navigation across the app.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";

const LINKS = [
  { href: "/jobs", label: "Jobs" },
  { href: "/apply", label: "Apply" },
  { href: "/inbox", label: "Inbox" },
  { href: "/negotiate", label: "Offers" },
  { href: "/warm", label: "Warm" },
  { href: "/profile", label: "Profile" },
];

export function Nav({ email }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Link href="/jobs"><Brand /></Link>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href !== "/jobs" && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "7px 12px",
                  borderRadius: 9,
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  background: active ? "var(--surface-2)" : "transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {email && <span style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>{email}</span>}
        <button className="btn-ghost" style={{ height: 36 }} onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
