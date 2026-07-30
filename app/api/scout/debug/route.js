// TEMPORARY diagnostic — reports whether the aggregator keys are live on the
// server and whether each aggregator returns data. No secrets exposed. Delete
// after use.
import { NextResponse } from "next/server";
import { themuse, himalayas, jsearch, adzuna, jooble, activeAggregators } from "@/lib/scout/aggregators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const queries = ["Head of Product", "VP of Product"];
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
    jsearchSample: Array.isArray(js) ? js.slice(0, 3).map((j) => `${j.title} @ ${j.company}`) : js,
  });
}
