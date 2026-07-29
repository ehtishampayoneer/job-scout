// lib/readJson.js
// Read a fetch Response as JSON, tolerating the case where the server — or the
// hosting platform itself — returned a NON-JSON body. A Vercel function that
// times out or crashes returns an HTML/text error page (often starting with
// "An error occurred…"), and calling res.json() on that throws the cryptic
// "Unexpected token 'A', \"An error o\"... is not valid JSON". This helper turns
// that into a clean, actionable message instead.
//
// Behaviour:
//   - Valid JSON body (any status): returns the parsed object. Callers keep
//     their own `if (!res.ok) throw new Error(data.error)` handling.
//   - Non-JSON body: throws an Error with a human-friendly .message.
export async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const e = new Error(friendlyMessage(res, text));
    e.status = res.status;
    e.nonJson = true;
    throw e;
  }
}

function friendlyMessage(res, text) {
  const t = String(text || "");
  const timedOut =
    res.status === 504 ||
    res.status === 408 ||
    /time?d?\s*out|timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(t);
  if (timedOut) {
    return "That took too long and the server timed out before finishing. This usually works on a second try — please run it again.";
  }
  if (res.status >= 500 || /an error occurred/i.test(t)) {
    return "The server hit an error and couldn't finish. Please try again in a moment.";
  }
  if (res.status === 413) return "That request was too large. Try a shorter input.";
  return "The server sent an unexpected response. Please try again.";
}
