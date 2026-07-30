// lib/scout/util.js — shared fetch + text helpers for the Scout sources.

const UA =
  "Mozilla/5.0 (compatible; JobScoutBot/1.0; personal job-search assistant)";

export async function fetchText(url, { timeout = 9000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...headers },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson(url, opts = {}) {
  const txt = await fetchText(url, { headers: { Accept: "application/json" }, ...opts });
  return JSON.parse(txt);
}

// POST JSON and parse a JSON response (for query-based aggregators like Jooble).
export async function postJson(url, body, { timeout = 9000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return JSON.parse(await res.text());
  } finally {
    clearTimeout(t);
  }
}

export function decodeEntities(s) {
  return fixMojibake(
    String(s || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => {
        try {
          return String.fromCharCode(parseInt(n, 10));
        } catch {
          return " ";
        }
      })
  );
}

// Repair UTF-8-read-as-Latin-1 mojibake (common in RemoteOK/feed text), e.g.
// "â€”" -> "—", "â€™" -> "'", and a stray "â" (a mangled dash/bullet) -> "-".
export function fixMojibake(s) {
  return String(s || "")
    .replace(/â€"/g, "—")
    .replace(/â€"/g, "–")
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€¦/g, "…")
    .replace(/â€¢/g, "•")
    .replace(/Â /g, " ")
    .replace(/Â/g, "")
    .replace(/â(?![a-zA-Z])/g, "-"); // leftover lone mangled dash/bullet
}

export function stripHtml(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n) : s;
}

// Rough "is this remote?" from a location string.
export function locType(name) {
  return /remote|anywhere|worldwide|distributed/i.test(String(name || "")) ? "remote" : "onsite";
}
