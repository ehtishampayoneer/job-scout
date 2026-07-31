// TEMPORARY — probes a large candidate list across all four ATS and returns only
// the slugs that actually return live jobs, sorted by yield. Delete after use.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GREENHOUSE = [
  // known-good
  "stripe","datadog","mongodb","cloudflare","elastic","reddit","twilio","gitlab","clickhouse","coinbase",
  "asana","postman","okta","faire","chime","amplitude","attentive","airtable","launchdarkly","dropbox",
  "pagerduty","squarespace","calendly","planetscale","circleci","netlify","lattice","airbnb","duolingo","discord","robinhood",
  // candidates
  "brex","benchling","samsara","gusto","checkr","flexport","instacart","sofi","grammarly","webflow","vercel","scaleai",
  "databricks","affirm","pinterest","twitch","lyft","cruise","hashicorp","confluent","snyk","newrelic","retool","rippling",
  "deel","gong","zapier","loom","miro","box","docusign","sentry","cockroachlabs","dbtlabs","fivetran","hightouch","rudderstack",
  "canva","atlassian","automattic","doximity","verkada","ironclad","vanta","drata","mercury","remitly","wealthsimple","nubank",
  "mercadolibre","gojek","grab","coursera","chegg","remotecom","oyster","multiplier","whoop","oura","calm","headspace",
  "masterclass","ro","hims","cedar","oscar","sourcegraph","render","anyscale","typeform","segment",
];
const ASHBY = [
  // known-good
  "openai","ramp","linear","replicate","runway","elevenlabs","perplexity","suno","hex","posthog","baseten","modal",
  "together","fireworks","deepgram","assemblyai","cohere","huggingface","notion","cursor","mistral","harvey","clay",
  "sierra","glean","braintrust","anyscale","midjourney",
  // candidates
  "character","wandb","langchain","pinecone","weaviate","writer","jasper","descript","stability","fal","humanloop",
  "contextual","tome","gamma","luma","leonardoai","scale","adept","xai","pika","ideogram","lightning","outerbounds",
  "unstructured","llamaindex","chroma","qdrant","zilliz","patronus","arize","comet","dagster","prefect","astronomer",
  "mode","deepnote","appsmith","windmill","tinybird","materialize","singlestore","neon","supabase","turso","xata",
  "railway","flyio","deno","replit","codesandbox","gitpod","coder","raycast","height","shortcut","plane","warp","vercel","ramp",
];
const LEVER = [
  "plaid","leadgenius","kickstarter","eventbrite","quora","gocardless","revolut","monzo","wise","match","upstart",
  "cargurus","talkdesk","kong","fetch","sourcegraph","replit","voleon","anduril","shieldai","applied-intuition","nuro",
  "aurora","motional","zoox","embark","kodiak","wayve","pony","netlify","brex","ramp","attentive","lattice","benchling",
  "mixpanel","segment","twitch","hims","ro","nubank","gopuff","faire",
];
const SMARTRECRUITERS = [
  "Visa","Bosch","Ubisoft","IKEA","Biogen","WeWork","PublicisGroupe","Skechers","AveryDennison","MarleySpoon","Capgemini",
  "Atos","Siemens","Bayer","Adidas","Allianz","Safran","Orange","Sanofi","Danaher","McDonalds","Experian","Equinix",
  "Twilio","Square","Deloitte","KPMG","Accenture","Ericsson","Nokia","Spotify","BoozAllen",
];

async function probe(url, count, timeout = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return 0;
    return count(await res.json());
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}
async function testGroup(slugs, urlFn, countFn) {
  const results = await Promise.all(slugs.map(async (s) => [s, await probe(urlFn(s), countFn)]));
  const working = results.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return {
    workingCount: working.length,
    totalJobs: working.reduce((a, [, n]) => a + n, 0),
    slugsCsv: working.map(([s]) => s).join(","),
    working: Object.fromEntries(working),
  };
}

export async function GET() {
  const [gh, ash, lev, sr] = await Promise.all([
    testGroup(GREENHOUSE, (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`, (d) => (d?.jobs || []).length),
    testGroup(ASHBY, (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`, (d) => (d?.jobs || []).length),
    testGroup(LEVER, (s) => `https://api.lever.co/v0/postings/${s}?mode=json`, (d) => (Array.isArray(d) ? d.length : 0)),
    testGroup(SMARTRECRUITERS, (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100`, (d) => (d?.content || []).length),
  ]);
  return NextResponse.json({ greenhouse: gh, ashby: ash, lever: lev, smartrecruiters: sr });
}
