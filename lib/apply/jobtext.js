// lib/apply/jobtext.js
// Company boards are fetched content-LIGHT during scanning (for speed), so a
// stored job's raw_text can be just "Title. Location." — useless for tailoring.
// At APPLY time we fetch the FULL job description so the CV, note, and answers
// actually match the real requirements. Falls back to whatever we stored.
import { fetchJson, stripHtml, clip } from "@/lib/scout/util";

export async function fetchJobDescription(job) {
  const url = String(job.url || "");
  const have = String(job.raw_text || "");
  try {
    // Greenhouse — the big content-light source. Job id is in the URL; the token
    // is the company. The detail API returns the full HTML description.
    if (job.source === "greenhouse" || /greenhouse\.io/.test(url)) {
      const id = url.match(/jobs\/(\d+)/)?.[1];
      const token = job.company;
      if (id && token) {
        const d = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${id}`, { timeout: 8000 });
        const text = stripHtml(d?.content || "");
        if (text.length > have.length) return clip(text, 6000);
      }
    }
    // Lever detail (if the stored text is thin).
    if ((job.source === "lever" || /lever\.co/.test(url)) && have.length < 300) {
      const m = url.match(/lever\.co\/([^/]+)\/([a-f0-9-]+)/i) || url.match(/postings\/([^/]+)\/([a-f0-9-]+)/i);
      if (m) {
        const d = await fetchJson(`https://api.lever.co/v0/postings/${job.company}/${m[2]}?mode=json`, { timeout: 8000 });
        const text = stripHtml(d?.descriptionPlain || d?.description || "");
        if (text.length > have.length) return clip(text, 6000);
      }
    }
  } catch {
    /* fall back to stored text */
  }
  return have;
}
