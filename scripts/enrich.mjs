// Step 2: Enrich + score.
// For each raw lead: who is this, do they fit the ICP (1-10), what hooks exist.
// Leads under min_fit_score move to data/rejected.
import { loadConfig, chat, listJson, writeJson, moveRecord } from "./lib.mjs";
import fs from "node:fs";
import { DATA } from "./lib.mjs";
import path from "node:path";

const config = loadConfig();
const leads = listJson("leads");
if (!leads.length) {
  console.log("No raw leads to enrich.");
  process.exit(0);
}

for (const lead of leads) {
  let e;
  try {
    e = await chat(
      config,
      [
        {
          role: "system",
          content:
            "You qualify B2B leads. Given a web result, infer who the person/company is " +
            "and score fit against the ICP. Be skeptical: listicles, agencies selling to the " +
            "same ICP, and dead pages score low. Return JSON: " +
            '{"who":"1-2 sentences","fit_score":1-10,"fit_reason":"...",' +
            '"hooks":["specific personalization hooks from the source"],' +
            '"guessed_channel":"email|twitter|linkedin|contact-form|unknown"}',
        },
        {
          role: "user",
          content:
            `ICP:\n${config.icp}\n\nCompany profile (what we sell):\n${config.company_profile}\n\n` +
            `Lead source:\nURL: ${lead.url}\nTitle: ${lead.title}\nExcerpt:\n${lead.snippet}`,
        },
      ],
      { json: true }
    );
  } catch (err) {
    console.error(`Enrich failed for ${lead.id}: ${err.message}`);
    continue;
  }

  const record = { ...lead, ...e, enriched_at: new Date().toISOString() };
  delete record.file;

  if (e.fit_score >= config.limits.min_fit_score) {
    writeJson("enriched", lead.id, record);
    fs.unlinkSync(path.join(DATA("leads"), lead.file));
    console.log(`✅ ${e.fit_score}/10 ${lead.title || lead.url}`);
  } else {
    writeJson("rejected", lead.id, record);
    fs.unlinkSync(path.join(DATA("leads"), lead.file));
    console.log(`❌ ${e.fit_score}/10 ${lead.title || lead.url} — ${e.fit_reason}`);
  }
}
