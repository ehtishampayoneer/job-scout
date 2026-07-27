// lib/warm/people.js
// Find real people at a target company from PUBLIC data — GitHub orgs and their
// top contributors (engineers who could refer you). Never scrapes hostile sites
// or LinkedIn. Gated on GITHUB_TOKEN (free) for a usable rate limit; without it,
// callers fall back to company-level outreach.
import { logger } from "@/lib/log";

export function githubAvailable() {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "User-Agent": "JobScoutBot",
    },
  });
  if (!res.ok) throw new Error(`gh ${res.status} ${path}`);
  return res.json();
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Resolve a company name to a confident GitHub org login.
async function findOrg(company) {
  const target = norm(company);
  if (!target) return null;
  // Direct hit first (many orgs match their name slug).
  const slug = String(company).trim().toLowerCase().replace(/\s+/g, "");
  try {
    const org = await gh(`/orgs/${encodeURIComponent(slug)}`);
    if (org?.login) return org.login;
  } catch {
    /* fall through to search */
  }
  try {
    const found = await gh(`/search/users?q=${encodeURIComponent(company)}+type:org&per_page=5`);
    for (const it of found?.items || []) {
      if (norm(it.login).includes(target) || target.includes(norm(it.login))) return it.login;
    }
  } catch (e) {
    logger.warn("warm.gh_search_failed", { company, error: String(e?.message || e) });
  }
  return null;
}

// Return up to `limit` real engineers at the company, enriched with public
// contact signals. Empty array if nothing confident is found.
export async function findPeopleAtCompany(company, limit = 1) {
  if (!githubAvailable()) return [];
  try {
    const org = await findOrg(company);
    if (!org) return [];
    // The org-repos endpoint can't sort by stars, so use the search API to get
    // the company's FLAGSHIP repo — its contributors are the core engineers.
    const search = await gh(`/search/repos?q=org:${encodeURIComponent(org)}+fork:false&sort=stars&order=desc&per_page=1`);
    const top = (search?.items || [])[0];
    if (!top) return [];
    const contributors = await gh(`/repos/${org}/${top.name}/contributors?per_page=8`);
    const people = [];
    for (const c of (contributors || []).filter((c) => c.type === "User").slice(0, 5)) {
      if (people.length >= limit) break;
      try {
        const u = await gh(`/users/${c.login}`);
        people.push({
          person_name: u.name || u.login,
          person_role: "Engineer",
          person_url: u.html_url,
          channel: "github",
          contact: u.email || (u.twitter_username ? `@${u.twitter_username}` : u.blog || null),
          bio: u.bio || "",
          source_url: `https://github.com/${org}/${top.name}`,
          repo: top.name,
          org,
        });
      } catch {
        /* skip this user */
      }
    }
    return people;
  } catch (e) {
    logger.warn("warm.find_people_failed", { company, error: String(e?.message || e) });
    return [];
  }
}
