// lib/scout/sources.js
// Job feed adapters. Each returns an array of jobs normalized to:
//   { source, url, company, title, raw_text, salary_range, location_type, location_raw }
// Every source is wrapped so one failing feed never breaks the run.
import { fetchText, fetchJson, stripHtml, clip, locType, decodeEntities } from "./util";
import { GREENHOUSE_BOARDS, ASHBY_BOARDS, LEVER_BOARDS, SMARTRECRUITERS_BOARDS } from "./boards";
import { logger } from "@/lib/log";

const firstStr = (v) => (Array.isArray(v) ? v[0] : v) || "";

export async function fetchAllSources() {
  const groups = await Promise.allSettled([
    remoteok(),
    weworkremotely(),
    remotive(),
    arbeitnow(),
    jobicy(),
    hnWhoIsHiring(),
    greenhouseAll(),
    ashbyAll(),
    leverAll(),
    smartrecruitersAll(),
  ]);
  const jobs = [];
  for (const g of groups) {
    if (g.status === "fulfilled" && Array.isArray(g.value)) jobs.push(...g.value);
    else if (g.status === "rejected") logger.warn("scout.source_failed", { error: String(g.reason?.message || g.reason) });
  }
  return jobs;
}

// --- RemoteOK ------------------------------------------------------------
export async function remoteok() {
  const data = await fetchJson("https://remoteok.com/api");
  const rows = Array.isArray(data) ? data.filter((r) => r && r.id && r.position) : [];
  return rows.map((r) => ({
    source: "remoteok",
    url: r.url || r.apply_url || `https://remoteok.com/l/${r.id}`,
    company: decodeEntities(r.company || "").trim(),
    title: decodeEntities(r.position || "").trim(),
    raw_text: clip(stripHtml(r.description || ""), 4000),
    salary_range: r.salary_min || r.salary_max ? `${r.salary_min || ""}-${r.salary_max || ""}` : null,
    location_type: "remote",
    location_raw: r.location || "Remote",
  }));
}

// --- Remotive (JSON) -----------------------------------------------------
export async function remotive() {
  const data = await fetchJson("https://remotive.com/api/remote-jobs?limit=100");
  return (data?.jobs || []).map((j) => ({
    source: "remotive",
    url: j.url,
    company: decodeEntities(j.company_name || "").trim(),
    title: decodeEntities(j.title || "").trim(),
    raw_text: clip(stripHtml(j.description || ""), 4000),
    salary_range: j.salary || null,
    location_type: locType(j.candidate_required_location || "Remote"),
    location_raw: j.candidate_required_location || "Remote",
  }));
}

// --- Arbeitnow (JSON; EU-heavy, carries a visa-sponsorship flag) ----------
export async function arbeitnow() {
  const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  return (data?.data || []).map((j) => ({
    source: "arbeitnow",
    url: j.url || `https://www.arbeitnow.com/view/${j.slug}`,
    company: decodeEntities(j.company_name || "").trim(),
    title: decodeEntities(j.title || "").trim(),
    raw_text: clip(stripHtml(j.description || "") + (j.visa_sponsorship ? " [Visa sponsorship available]" : ""), 4000),
    salary_range: null,
    location_type: j.remote ? "remote" : locType(j.location || ""),
    location_raw: j.location || (j.remote ? "Remote" : ""),
  }));
}

// --- Jobicy (JSON) -------------------------------------------------------
export async function jobicy() {
  const data = await fetchJson("https://jobicy.com/api/v2/remote-jobs?count=50");
  return (data?.jobs || []).map((j) => {
    const geo = firstStr(j.jobGeo) || "Remote";
    const sal = j.annualSalaryMin || j.annualSalaryMax ? `${j.annualSalaryMin || ""}-${j.annualSalaryMax || ""} ${j.salaryCurrency || ""}`.trim() : null;
    return {
      source: "jobicy",
      url: j.url,
      company: decodeEntities(firstStr(j.companyName) || "").trim(),
      title: decodeEntities(firstStr(j.jobTitle) || "").trim(),
      raw_text: clip(stripHtml(j.jobDescription || j.jobExcerpt || ""), 4000),
      salary_range: sal,
      location_type: locType(geo),
      location_raw: geo,
    };
  });
}

// --- Hacker News "Who is hiring?" (Algolia API) --------------------------
// The monthly thread by user 'whoishiring' is a goldmine of startup/remote roles.
export async function hnWhoIsHiring() {
  const search = await fetchJson(
    "https://hn.algolia.com/api/v1/search?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=6"
  );
  const story = (search?.hits || []).find((h) => /who is hiring/i.test(h.title || ""));
  if (!story) return [];
  const item = await fetchJson(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
  const kids = (item?.children || []).filter((c) => c && c.text && !c.dead && !c.deleted).slice(0, 80);
  return kids
    .map((c) => {
      const text = stripHtml(c.text);
      const parts = text.split("|").map((s) => s.trim());
      const company = parts.length > 1 ? parts[0].slice(0, 80) : "";
      const title = parts.length > 1 ? parts[1].slice(0, 120) : text.split(/[.\n]/)[0].slice(0, 120);
      return {
        source: "hn",
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        company,
        title: title || text.slice(0, 80),
        raw_text: clip(text, 4000),
        salary_range: null,
        location_type: /\bremote\b/i.test(text) ? "remote" : "onsite",
        location_raw: /\bremote\b/i.test(text) ? "Remote" : "",
      };
    })
    .filter((j) => j.title && j.title.length > 3);
}

// --- WeWorkRemotely (RSS) ------------------------------------------------
export async function weworkremotely() {
  const cats = [
    "remote-programming-jobs",
    "remote-devops-sysadmin-jobs",
    "remote-management-and-finance-jobs",
    "remote-product-jobs",
  ];
  const out = [];
  for (const c of cats) {
    try {
      const xml = await fetchText(`https://weworkremotely.com/categories/${c}.rss`);
      out.push(...parseRss(xml));
    } catch (e) {
      logger.warn("scout.wwr_cat_failed", { cat: c, error: String(e?.message || e) });
    }
  }
  return out;
}

function parseRss(xml) {
  const items = [];
  for (const block of String(xml).split(/<item>/).slice(1)) {
    const seg = block.split(/<\/item>/)[0];
    const title = rssTag(seg, "title");
    const link = rssTag(seg, "link");
    if (!title || !link) continue;
    const desc = rssTag(seg, "description");
    const region = rssTag(seg, "region") || rssTag(seg, "category");
    let company = "";
    let role = title;
    const idx = title.indexOf(":");
    if (idx > -1) {
      company = title.slice(0, idx).trim();
      role = title.slice(idx + 1).trim();
    }
    const loc = stripHtml(region) || "Remote";
    items.push({
      source: "weworkremotely",
      url: link.trim(),
      company,
      title: role,
      raw_text: clip(stripHtml(desc), 4000),
      salary_range: null,
      location_type: locType(loc),
      location_raw: loc,
    });
  }
  return items;
}

function rssTag(s, name) {
  const m = s.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

// --- Greenhouse (public board JSON) --------------------------------------
export async function greenhouseAll() {
  const out = [];
  for (const token of GREENHOUSE_BOARDS) {
    try {
      const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
      for (const j of data?.jobs || []) {
        if (!j.title || !j.absolute_url) continue;
        const loc = j.location?.name || "";
        out.push({
          source: "greenhouse",
          url: j.absolute_url,
          company: token,
          title: decodeEntities(j.title).trim(),
          raw_text: clip(stripHtml(j.content || ""), 4000),
          salary_range: null,
          location_type: locType(loc),
          location_raw: loc,
        });
      }
    } catch (e) {
      logger.warn("scout.greenhouse_failed", { token, error: String(e?.message || e) });
    }
  }
  return out;
}

// --- Ashby (public job-board JSON) ---------------------------------------
export async function ashbyAll() {
  const out = [];
  for (const org of ASHBY_BOARDS) {
    try {
      const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${org}?includeCompensation=true`);
      for (const j of data?.jobs || []) {
        if (!j.title) continue;
        const loc = j.locationName || j.location || (j.isRemote ? "Remote" : "");
        out.push({
          source: "ashby",
          url: j.jobUrl || j.applyUrl || "",
          company: org,
          title: decodeEntities(j.title).trim(),
          raw_text: clip(stripHtml(j.descriptionHtml || j.descriptionPlain || ""), 4000),
          salary_range: j.compensation?.compensationTierSummary || null,
          location_type: j.isRemote ? "remote" : locType(loc),
          location_raw: loc,
        });
      }
    } catch (e) {
      logger.warn("scout.ashby_failed", { org, error: String(e?.message || e) });
    }
  }
  return out.filter((j) => j.url);
}

// --- Lever (opt-in company boards) ---------------------------------------
export async function leverAll() {
  const out = [];
  for (const c of LEVER_BOARDS) {
    try {
      const data = await fetchJson(`https://api.lever.co/v0/postings/${c}?mode=json`);
      for (const j of Array.isArray(data) ? data : []) {
        if (!j.text) continue;
        const loc = j.categories?.location || "";
        out.push({
          source: "lever",
          url: j.hostedUrl || j.applyUrl || "",
          company: c,
          title: decodeEntities(j.text).trim(),
          raw_text: clip(stripHtml(j.descriptionPlain || j.description || ""), 4000),
          salary_range: null,
          location_type: /remote/i.test(j.workplaceType || "") ? "remote" : locType(loc),
          location_raw: loc,
        });
      }
    } catch (e) {
      logger.warn("scout.lever_failed", { c, error: String(e?.message || e) });
    }
  }
  return out.filter((j) => j.url);
}

// --- SmartRecruiters (opt-in company boards) -----------------------------
export async function smartrecruitersAll() {
  const out = [];
  for (const c of SMARTRECRUITERS_BOARDS) {
    try {
      const data = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${c}/postings?limit=100`);
      for (const j of data?.content || []) {
        if (!j.name) continue;
        const loc = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", ");
        out.push({
          source: "smartrecruiters",
          url: `https://jobs.smartrecruiters.com/${c}/${j.id}`,
          company: decodeEntities(c),
          title: decodeEntities(j.name).trim(),
          raw_text: clip(`${j.name}. ${loc}. ${j.typeOfEmployment?.label || ""}`, 4000),
          salary_range: null,
          location_type: j.location?.remote ? "remote" : locType(loc),
          location_raw: loc,
        });
      }
    } catch (e) {
      logger.warn("scout.sr_failed", { c, error: String(e?.message || e) });
    }
  }
  return out.filter((j) => j.url);
}
