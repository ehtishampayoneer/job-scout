// TEMPORARY diagnostic — reports whether the aggregator keys are live on the
// server and whether each aggregator returns data. No secrets exposed. Delete
// after use.
import { NextResponse } from "next/server";
import { themuse, himalayas, jsearch, adzuna, jooble, activeAggregators } from "@/lib/scout/aggregators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function rawJsearchProbe() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return { skipped: "no key" };
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 22000);
  try {
    const res = await fetch("https://jsearch.p.rapidapi.com/search-v2?query=Head%20of%20Product&country=us", {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let jobs = 0;
    try { jobs = JSON.parse(text)?.data?.jobs?.length || 0; } catch {}
    return { httpStatus: res.status, ms: Date.now() - t0, jobs, bodyStart: text.slice(0, 140) };
  } catch (e) {
    return { error: String(e?.name || "") + " " + String(e?.message || e), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const queries = ["Head of Product", "VP of Product"];
  const jsearchRaw = await rawJsearchProbe();
  const [muse, hima, js, adz, joo] = await Promise.all([
    themuse().catch((e) => ({ error: String(e?.message || e) })),
    himalayas().catch((e) => ({ error: String(e?.message || e) })),
    jsearch(queries).catch((e) => ({ error: String(e?.message || e) })),
    adzuna(queries).catch((e) => ({ error: String(e?.message || e) })),
    jooble(queries).catch((e) => ({ error: String(e?.message || e) })),
  ]);
  const n = (r) => (Array.isArray(r) ? r.length : r);
  return NextResponse.json({
    keysPresentOnServer: activeAggregators(),
    counts: { themuse: n(muse), himalayas: n(hima), jsearch: n(js), adzuna: n(adz), jooble: n(joo) },
    jsearchRaw,
    jsearchSample: Array.isArray(js) ? js.slice(0, 3).map((j) => `${j.title} @ ${j.company}`) : js,
  });
}
