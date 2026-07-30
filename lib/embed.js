// lib/embed.js
// The matching brain. Embeds text with Gemini's free text-embedding-004 model
// and compares with cosine similarity, so the Scout ranks jobs by SEMANTIC fit
// to the candidate (not keyword overlap) before spending LLM calls on scoring.
//
// Batched (up to 100 per request) so ranking 80 jobs costs ~1 API call.
import { logger } from "@/lib/log";

// `gemini-embedding-001` is the current model available on new keys
// (text-embedding-004 is retired for new users). Override via EMBEDDING_MODEL.
const MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-001";

export function embeddingsAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Embed an array of strings -> array of vectors (same order). Throws on failure
// so callers can fall back to keyword ranking.
export async function embedTexts(texts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no embedding key");

  // Split into 100-item batches and run them in PARALLEL. Doing them
  // sequentially on a large pool is a leading cause of the whole Scout run
  // overrunning the serverless time limit. Each batch also has a hard timeout so
  // a slow embedding model can't stall the run — it throws, and the caller falls
  // back to the instant keyword ranking instead.
  const batches = [];
  for (let i = 0; i < texts.length; i += 100) batches.push(texts.slice(i, i + 100));

  const results = await Promise.all(batches.map((batch) => embedBatch(batch, key)));
  const out = results.flat();

  if (out.length !== texts.length) {
    logger.warn("embed.count_mismatch", { got: out.length, want: texts.length });
  }
  return out;
}

async function embedBatch(batch, key, timeout = 16000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${key}`;
  const body = {
    requests: batch.map((t) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text: String(t || "").slice(0, 2000) }] },
    })),
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      throw new Error(`embed ${res.status}: ${b.slice(0, 160)}`);
    }
    const data = await res.json();
    return (data.embeddings || []).map((e) => e.values || []);
  } finally {
    clearTimeout(timer);
  }
}

export function cosine(a, b) {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
