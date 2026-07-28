// lib/ai-router.js
// The AI brain. One function the whole app calls: callAI().
// It tries Gemini, then Groq, then OpenRouter, then an optional paid endpoint —
// automatically failing over if one is down, rate-limited, or unconfigured.
//
// Ported (and slimmed) from Marketing Genie. Self-contained: the only local
// dependency is the logger. Models are read from env with sane 2026 defaults,
// so a future deprecation is a one-line env change, not a code change.
//
// NOTE ON COST: Gemini/Groq/OpenRouter all have free tiers — Phase 1 needs no
// paid key. The `paid` provider is an optional last-resort fallback (Anthropic,
// OpenAI, etc.) that stays skipped until you set PAID_LLM_API_KEY.
import { logger } from "@/lib/log";

// ---------------------------------------------------------------------------
// PROVIDER CONFIG  (priority order: 1 = tried first)
// ---------------------------------------------------------------------------
const PROVIDERS = [
  {
    name: "gemini",
    priority: 1,
    apiKey: () => process.env.GEMINI_API_KEY,
    // `gemini-flash-latest` always points at the current free Flash model, so a
    // model rename never breaks us. (`gemini-2.5-flash` was retired for new keys.)
    model: () => process.env.GEMINI_MODEL || "gemini-flash-latest",
    rpm: 15, // free-tier requests/min (soft, proactive guard only)
    call: callGemini,
  },
  {
    name: "groq",
    priority: 2,
    apiKey: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    rpm: 30,
    call: (cfg, payload) =>
      callOpenAICompatible("https://api.groq.com/openai/v1", cfg, payload),
  },
  {
    name: "openrouter",
    priority: 3,
    apiKey: () => process.env.OPENROUTER_API_KEY,
    model: () => process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3.1:free",
    rpm: 20,
    call: (cfg, payload) =>
      callOpenAICompatible("https://openrouter.ai/api/v1", cfg, payload, {
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Job Scout",
      }),
  },
  {
    // PAID FALLBACK — optional last resort. Skipped when PAID_LLM_API_KEY unset.
    // Provider-agnostic: point PAID_LLM_BASE at any OpenAI-compatible endpoint.
    name: "paid",
    priority: 9,
    apiKey: () => process.env.PAID_LLM_API_KEY,
    model: () => process.env.PAID_LLM_MODEL || "gpt-4o-mini",
    rpm: 500,
    call: (cfg, payload) =>
      callOpenAICompatible(process.env.PAID_LLM_BASE || "https://api.openai.com/v1", cfg, payload),
  },
];

// ---------------------------------------------------------------------------
// SOFT RATE-LIMIT / COOLDOWN TRACKER (in-memory, per serverless instance)
// Proactive only ("we just got 429'd, rest it"); the real protection is
// catching provider errors and failing over.
// ---------------------------------------------------------------------------
const cooldowns = new Map(); // providerName -> ms timestamp until which to skip
const hits = new Map();      // providerName -> [timestamps within last 60s]

function isCoolingDown(name) {
  const until = cooldowns.get(name);
  return until && Date.now() < until;
}
function coolDown(name, seconds = 30) {
  cooldowns.set(name, Date.now() + seconds * 1000);
}
function underSoftLimit(name, rpm) {
  const now = Date.now();
  const recent = (hits.get(name) || []).filter((t) => now - t < 60_000);
  hits.set(name, recent);
  return recent.length < rpm;
}
function recordHit(name) {
  const arr = hits.get(name) || [];
  arr.push(Date.now());
  hits.set(name, arr);
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------
/**
 * Call the AI brain. Tries every configured provider in order until one works.
 *
 * @param {Object} opts
 * @param {string}   opts.prompt          The user/task message. (required)
 * @param {string}   [opts.system]        System instruction / persona.
 * @param {boolean}  [opts.json=false]    Ask the model to return strict JSON.
 * @param {number}   [opts.temperature=0.7]
 * @param {number}   [opts.maxTokens=2048]
 * @param {string[]} [opts.only]          Restrict to these provider names.
 * @returns {Promise<{text:string, json:any|null, provider:string, model:string, latencyMs:number, attempts:Array}>}
 * @throws {AllProvidersFailedError} when every provider fails or is unconfigured.
 */
export async function callAI(opts = {}) {
  const {
    prompt,
    system = "",
    json = false,
    temperature = 0.7,
    maxTokens = 2048,
    only = null,
  } = opts;

  if (!prompt || typeof prompt !== "string") {
    throw new Error("callAI: `prompt` (string) is required.");
  }

  const payload = { prompt, system, json, temperature, maxTokens };
  const attempts = [];

  const ordered = [...PROVIDERS]
    .filter((p) => (only ? only.includes(p.name) : true))
    .sort((a, b) => a.priority - b.priority);

  for (const provider of ordered) {
    const key = provider.apiKey();
    const model = provider.model();

    if (!key) {
      attempts.push({ provider: provider.name, skipped: "no_api_key" });
      continue;
    }
    if (isCoolingDown(provider.name)) {
      attempts.push({ provider: provider.name, skipped: "cooling_down" });
      continue;
    }
    if (!underSoftLimit(provider.name, provider.rpm)) {
      attempts.push({ provider: provider.name, skipped: "soft_rate_limit" });
      continue;
    }

    const started = Date.now();
    try {
      recordHit(provider.name);
      // Retry transient network errors AND short-lived rate limits (429) with a
      // backoff — a per-minute rate limit usually clears in a second or two, so
      // give the working provider a second chance before failing over to a
      // possibly-weaker one. Only 5xx / hard errors fail straight over.
      const text = await retry(
        () => provider.call({ apiKey: key, model }, payload),
        { tries: 3, retryOn: (e) => !e?.status || e.status === 429, baseDelayMs: 1200 }
      );
      const clean = stripText(text);
      const parsed = json ? safeParseJSON(clean) : null;
      if (json && parsed === null) {
        // Replied, but not with usable JSON — fall through to the next provider.
        throw httpError(422, "invalid_json");
      }
      const latencyMs = Date.now() - started;
      return { text: clean, json: parsed, provider: provider.name, model, latencyMs, attempts };
    } catch (err) {
      const status = err?.status;
      if (status === 429 || (status >= 500 && status < 600)) {
        coolDown(provider.name, status === 429 ? 60 : 20);
      }
      attempts.push({
        provider: provider.name,
        error: err?.message || "unknown",
        status: status || null,
      });
      logger.warn("ai.provider.error", {
        provider: provider.name,
        status: status || null,
        error: String(err?.message || "").slice(0, 160),
      });
      // continue to next provider
    }
  }

  logger.error("ai.all_providers_failed", { attempts });
  throw new AllProvidersFailedError(attempts);
}

export class AllProvidersFailedError extends Error {
  constructor(attempts) {
    super("All AI providers failed or were unavailable. Check that at least one LLM API key is set.");
    this.name = "AllProvidersFailedError";
    this.attempts = attempts;
  }
}

/** True when at least one provider has an API key configured. */
export function hasAnyProvider() {
  return PROVIDERS.some((p) => !!p.apiKey());
}

// ---------------------------------------------------------------------------
// PROVIDER ADAPTERS
// ---------------------------------------------------------------------------
async function callGemini({ apiKey, model }, { prompt, system, json, temperature, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw httpError(res.status, await safeBody(res));

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  if (!text) throw httpError(502, "Gemini returned empty content");
  return text;
}

async function callOpenAICompatible(baseUrl, { apiKey, model }, { prompt, system, json, temperature, maxTokens }, extraHeaders = {}) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  // We deliberately do NOT use the providers' strict `response_format: json_object`
  // mode — Groq in particular rejects its own valid JSON with `json_validate_failed`,
  // which caused intermittent total failures. Instead we ask for JSON in the prompt
  // and parse it ourselves with a tolerant parser (safeParseJSON). Far more reliable.
  const userContent = json ? `${prompt}\n\nReturn ONLY the JSON object. No prose, no markdown code fences.` : prompt;
  messages.push({ role: "user", content: userContent });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw = await safeBody(res);
    // Groq's strict JSON mode sometimes returns 400 `json_validate_failed` even
    // though the model DID produce valid JSON — it hands that text back in
    // `error.failed_generation`. Salvage it rather than throwing the turn away.
    if (json && res.status === 400) {
      try {
        const fg = JSON.parse(raw)?.error?.failed_generation;
        if (typeof fg === "string" && fg.trim()) return fg;
      } catch {
        /* fall through to the normal error */
      }
    }
    throw httpError(res.status, raw);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw httpError(502, "Provider returned empty content");
  return text;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
async function retry(fn, { tries = 2, retryOn = () => true, baseDelayMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === tries - 1 || !retryOn(e)) throw e;
      // Rate limits need a real pause; network blips clear fast.
      const delay = e?.status === 429 ? baseDelayMs * (i + 1) : 250 * (i + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function httpError(status, detail) {
  const e = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  e.status = status;
  return e;
}

async function safeBody(res) {
  try {
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
}

function stripText(text) {
  // Remove accidental ```json ... ``` fences some models add around output.
  return String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/[\{\[][\s\S]*[\}\]]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
