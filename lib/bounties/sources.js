// lib/bounties/sources.js
// Bounty sources — paid TASKS with money already deposited (not competitions in
// spirit: the reward is committed up front). Phase 1: Superteam Earn (verified
// live, USDC/USDG stablecoin rewards). More adapters slot in the same way.
import { fetchJson, stripHtml, clip } from "@/lib/scout/util";
import { logger } from "@/lib/log";

const EARN = "https://earn.superteam.fun/api";

// List open bounties across all sources, normalized to one shape.
export async function fetchBounties({ take = 60 } = {}) {
  const groups = await Promise.allSettled([superteam(take)]);
  const out = [];
  for (const g of groups) {
    if (g.status === "fulfilled" && Array.isArray(g.value)) out.push(...g.value);
  }
  // Highest reward first.
  return out.sort((a, b) => (b.reward || 0) - (a.reward || 0));
}

async function superteam(take) {
  try {
    const data = await fetchJson(`${EARN}/listings?take=${take}`, { timeout: 12000 });
    const items = Array.isArray(data) ? data : data?.data || [];
    return items
      .filter((j) => j.slug && j.title && (!j.status || j.status === "OPEN"))
      .map((j) => ({
        source: "superteam",
        ref: j.slug,
        url: `https://earn.superteam.fun/listings/${j.type || "bounty"}/${j.slug}`,
        title: String(j.title).trim(),
        reward: Number(j.rewardAmount) || null,
        token: j.token || "USDC",
        type: j.type || "bounty",
        deadline: j.deadline || null,
        sponsor: j.sponsor?.name || null,
      }));
  } catch (e) {
    logger.warn("bounty.superteam_failed", { error: String(e?.message || e) });
    return [];
  }
}

// Full description for one bounty (for the AI explain/proposal/approach).
export async function fetchBountyDetail(source, slug) {
  if (source !== "superteam") return null;
  try {
    const d = await fetchJson(`${EARN}/listings/details/${slug}`, { timeout: 12000 });
    return {
      title: d.title || "",
      description: clip(stripHtml(d.description || ""), 3500),
      eligibility: Array.isArray(d.eligibility) ? d.eligibility.map((e) => e.question || e).join("; ") : stripHtml(String(d.eligibility || "")),
      reward: Number(d.rewardAmount) || null,
      token: d.token || "USDC",
      usdValue: d.usdValue || null,
    };
  } catch (e) {
    logger.warn("bounty.detail_failed", { slug, error: String(e?.message || e) });
    return null;
  }
}
