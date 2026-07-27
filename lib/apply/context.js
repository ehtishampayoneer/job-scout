// lib/apply/context.js — load the full candidate context for generation.
export async function loadCandidate(supabase, userId) {
  const [{ data: profile }, { data: projects }, { data: employment }, { data: education }] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("employment").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("education").select("*").eq("user_id", userId).order("sort_order"),
  ]);
  return { profile, projects: projects || [], employment: employment || [], education: education || [] };
}

// Compose the outbound email body: the human note leads, then links, then a
// CLEAN plain-text resume (never raw Markdown, which reads as amateur). Form
// answers are intentionally excluded from a cold email.
export function composeEmailBody({ note_text, resume_md, links }) {
  const parts = [note_text || ""];
  if (Array.isArray(links) && links.length) {
    parts.push(links.map((l) => `${l.label}: ${l.url}`).join("\n"));
  }
  if (resume_md) parts.push("—\n" + markdownToPlain(resume_md));
  return parts.filter(Boolean).join("\n\n").trim();
}

// Render Markdown down to clean, email-safe plain text.
export function markdownToPlain(md) {
  return String(md || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const TERMINAL_STATUSES = ["sent", "responded", "interviewing", "rejected", "offer", "dismissed"];
