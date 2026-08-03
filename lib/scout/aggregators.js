// lib/scout/aggregators.js
// Cross-platform job aggregators — the answer to "get me everything that's on
// Indeed / LinkedIn / Glassdoor" WITHOUT scraping those hostile sites directly.
//
//   - The Muse & Himalayas are keyless firehoses (fetched every run).
//   - JSearch (Google for Jobs), Adzuna and Jooble are QUERY-BASED aggregators
//     that index Indeed/LinkedIn/Glassdoor/ZipRecruiter and company sites. They
//     need a free API key and a search query, so they run only when their key is
//     configured. Each stays a silent no-op until you paste the key into env.
//
// Every adapter is wrapped so one failing/So one missing key never breaks a run.
import { fetchJson, postJson, stripHtml, clip, decodeEntities, locType } from "./util";
import { logger } from "@/lib/log";

const num = (v, d) => (Number.isFinite(+v) ? +v : d);

// ---------------------------------------------------------------------------
// KEYLESS
// ---------------------------------------------------------------------------

// The Muse — quality company jobs, keyless public API. Firehose (paged).
export async function themuse(pages = 3) {
  const out = [];
  for (let p = 0; p < pages; p++) {
    try {
      const data = await fetchJson(`https://www.themuse.com/api/public/jobs?page=${p}`);
      for (const j of data?.results || []) {
        const locs = (j.locations || []).map((l) => l.name).filter(Boolean);
        const locRaw = locs.join(", ") || "";
        out.push({
          source: "themuse",
          url: j.refs?.landing_page || "",
          company: decodeEntities(j.company?.name || "").trim(),
          title: decodeEntities(j.name || "").trim(),
          raw_text: clip(stripHtml(j.contents || ""), 4000),
          salary_range: null,
          location_type: /flexible|remote/i.test(locRaw) ? "remote" : locType(locRaw),
          location_raw: locRaw,
        });
      }
    } catch (e) {
      logger.warn("scout.themuse_failed", { page: p, error: String(e?.message || e) });
      break;
    }
  }
  return out.filter((j) => j.url && j.title);
}

// Himalayas — large remote-only board, keyless JSON API.
export async function himalayas() {
  try {
    const data = await fetchJson("https://himalayas.app/jobs/api?limit=100");
    return (data?.jobs || [])
      .map((j) => {
        const locRaw = Array.isArray(j.locationRestrictions) && j.locationRestrictions.length
          ? j.locationRestrictions.join(", ")
          : "Remote";
        return {
          source: "himalayas",
          url: j.applicationLink || j.guid || "",
          company: decodeEntities(j.companyName || "").trim(),
          title: decodeEntities(j.title || "").trim(),
          raw_text: clip(stripHtml(j.description || j.excerpt || ""), 4000),
          salary_range: j.minSalary || j.maxSalary ? `${j.minSalary || ""}-${j.maxSalary || ""}` : null,
          location_type: "remote",
          location_raw: locRaw,
        };
      })
      .filter((j) => j.url && j.title);
  } catch (e) {
    logger.warn("scout.himalayas_failed", { error: String(e?.message || e) });
    return [];
  }
}

// ---------------------------------------------------------------------------
// KEY-GATED, QUERY-BASED  (each takes the user's target-role queries)
// ---------------------------------------------------------------------------

// JSearch (RapidAPI) — reads Google for Jobs, which aggregates Indeed, LinkedIn,
// Glassdoor, ZipRecruiter and company sites. The single biggest coverage lever.
export async function jsearch(queries = []) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key || !queries.length) return [];
  const out = [];
  // Free tier is small AND /search-v2 scrapes Google for Jobs live (can be slow),
  // so use only the top query with a generous timeout to avoid a false empty.
  for (const q of queries.slice(0, 1)) {
    try {
      // v5 renamed the search endpoint to /search-v2 and nests results under
      // data.jobs (the old /search returned a flat data array).
      const data = await fetchJson(
        `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(q)}&country=us`,
        { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" }, timeout: 12000 }
      );
      for (const j of data?.data?.jobs || []) {
        const loc = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ");
        out.push({
          source: "jsearch",
          url: j.job_apply_link || j.job_google_link || "",
          company: decodeEntities(j.employer_name || "").trim(),
          title: decodeEntities(j.job_title || "").trim(),
          raw_text: clip(stripHtml(j.job_description || ""), 4000),
          salary_range:
            j.job_min_salary || j.job_max_salary ? `${j.job_min_salary || ""}-${j.job_max_salary || ""}` : null,
          location_type: j.job_is_remote ? "remote" : locType(loc),
          location_raw: j.job_is_remote ? `Remote${loc ? " · " + loc : ""}` : loc,
        });
      }
    } catch (e) {
      logger.warn("scout.jsearch_failed", { q, error: String(e?.message || e) });
    }
  }
  return out.filter((j) => j.url && j.title);
}

// Adzuna — huge multi-country aggregator. Free app_id + app_key.
// Runs every (country x query) combo IN PARALLEL with a recency window, so more
// countries/keywords don't add latency. Countries + query breadth are capped to
// protect the free quota; onsite roles in non-remote-friendly markets are
// dropped downstream by the location filter, so this mostly widens real reach.
export async function adzuna(queries = []) {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key || !queries.length) return [];
  // Metrics showed 8 countries yielded ~0 REMOTE survivors (Adzuna country search
  // returns mostly local onsite roles, filtered out for a remote seeker). Default
  // to the English remote-friendly markets to conserve quota; override via env.
  const countries = (process.env.ADZUNA_COUNTRIES || "us,gb,ca,au")
    .split(",").map((c) => c.trim()).filter(Boolean);
  const qs = queries.slice(0, 3);
  const days = process.env.ADZUNA_MAX_DAYS_OLD || "21";

  const tasks = [];
  for (const country of countries) {
    for (const q of qs) {
      const url =
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${id}&app_key=${key}` +
        `&results_per_page=50&what=${encodeURIComponent(q)}&max_days_old=${days}&content-type=application/json`;
      tasks.push(
        fetchJson(url, { timeout: 10000 })
          .then((data) =>
            (data?.results || []).map((j) => {
              const loc = j.location?.display_name || "";
              return {
                source: "adzuna",
                url: j.redirect_url || "",
                company: decodeEntities(j.company?.display_name || "").trim(),
                title: decodeEntities(j.title || "").trim(),
                raw_text: clip(stripHtml(j.description || ""), 4000),
                salary_range: j.salary_min || j.salary_max ? `${j.salary_min || ""}-${j.salary_max || ""}` : null,
                location_type: locType(loc),
                location_raw: loc,
              };
            })
          )
          .catch((e) => {
            logger.warn("scout.adzuna_failed", { country, q, error: String(e?.message || e) });
            return [];
          })
      );
    }
  }
  const results = await Promise.all(tasks);
  return results.flat().filter((j) => j.url && j.title);
}

// Jooble — cross-platform aggregator. Free key, POST API. Multi-keyword, parallel.
export async function jooble(queries = []) {
  const key = process.env.JOOBLE_KEY;
  if (!key || !queries.length) return [];
  const tasks = queries.slice(0, 4).map((q) =>
    postJson(`https://jooble.org/api/${key}`, { keywords: q, location: "remote" }, { timeout: 10000 })
      .then((data) =>
        (data?.jobs || []).map((j) => {
          const company = decodeEntities(j.company || "").trim();
          const title = decodeEntities(j.title || "").trim();
          return {
            source: "jooble",
            // Jooble's own link is a gated tracking redirect that often shows
            // "requires local presence" even for remote roles. Route to a Google
            // search for the exact role so the user reaches the REAL, applyable
            // posting (company site / LinkedIn / Indeed).
            url: `https://www.google.com/search?q=${encodeURIComponent(`"${title}" ${company} job apply`)}`,
            company,
            title,
            raw_text: clip(stripHtml(j.snippet || ""), 4000),
            salary_range: j.salary || null,
            location_type: locType(j.location || ""),
            location_raw: j.location || "",
          };
        })
      )
      .catch((e) => {
        logger.warn("scout.jooble_failed", { q, error: String(e?.message || e) });
        return [];
      })
  );
  const results = await Promise.all(tasks);
  return results.flat().filter((j) => j.url && j.title);
}

// Convenience: which key-gated aggregators are currently active.
export function activeAggregators() {
  return {
    jsearch: !!process.env.RAPIDAPI_KEY,
    adzuna: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jooble: !!process.env.JOOBLE_KEY,
  };
}
