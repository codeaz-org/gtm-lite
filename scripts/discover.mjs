// Step 1: Discover leads.
// AI turns your company profile + briefs into search queries, Exa finds people.
import { loadConfig, chat, exaSearch, knownIds, leadId, writeJson } from "./lib.mjs";

const config = loadConfig();
const seen = knownIds();

// ponytail: walled gardens never expose an email → cut them here, not after 3 LLM calls.
const UNREACHABLE = /(^|\.)(facebook|instagram|tiktok|youtube|twitter|x|linkedin|reddit|pinterest)\.com$/i;
function reachable(url) {
  try { return !UNREACHABLE.test(new URL(url).hostname); } catch { return false; }
}

const plan = await chat(
  config,
  [
    {
      role: "system",
      content:
        "You generate web search queries for finding B2B outreach leads. " +
        "Return JSON: {\"queries\": [\"...\"]}. Queries should surface PEOPLE " +
        "(profiles, personal sites, blogs, launch posts), not listicles or vendors.",
    },
    {
      role: "user",
      content:
        `Company profile:\n${config.company_profile}\n\nICP:\n${config.icp}\n\n` +
        `Targeted briefs:\n- ${(config.lead_briefs || []).join("\n- ")}\n\n` +
        `Generate ${config.limits.searches_per_run} diverse neural-search queries, ` +
        `each attacking a different angle (a brief, a watering hole, a buying signal).`,
    },
  ],
  { json: true }
);

let added = 0;
for (const query of plan.queries.slice(0, config.limits.searches_per_run)) {
  if (added >= config.limits.max_new_leads_per_run) break;
  console.log(`🔎 ${query}`);
  let results = [];
  try {
    results = await exaSearch(query, config.limits.results_per_search);
  } catch (e) {
    console.error(`  Exa failed: ${e.message}`);
    continue;
  }
  for (const r of results) {
    if (added >= config.limits.max_new_leads_per_run) break;
    if (!reachable(r.url)) { console.log(`  – skip walled-garden: ${r.url}`); continue; }
    const id = leadId(r.url);
    if (seen.has(id)) continue;
    seen.add(id);
    writeJson("leads", id, {
      id,
      url: r.url,
      title: r.title || "",
      snippet: (r.text || "").slice(0, 1500),
      source_query: query,
      discovered_at: new Date().toISOString(),
    });
    added++;
    console.log(`  + ${r.title || r.url}`);
  }
}
console.log(`\nDiscovered ${added} new leads.`);
