// lib/log.js
// Tiny structured logger. Serverless-friendly: everything goes to stdout/stderr
// as one JSON line so Vercel log search works. No external dependency.
function emit(level, msg, data) {
  const line = { level, msg, ...(data ? { data } : {}), t: new Date().toISOString() };
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  try {
    out(JSON.stringify(line));
  } catch {
    out(`[${level}] ${msg}`);
  }
}

export const logger = {
  info: (msg, data) => emit("info", msg, data),
  warn: (msg, data) => emit("warn", msg, data),
  error: (msg, data) => emit("error", msg, data),
};
