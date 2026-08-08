// Step 3: Draft emails.
// For each qualified lead, write one short personalized email as a Markdown
// file in data/drafts/ — reviewed by a human before anything is sent.
import {
  loadConfig, loadKnowledge, chat, listJson, frontmatter, DATA,
} from "./lib.mjs";
import fs from "node:fs";
import path from "node:path";

const config = loadConfig();
const playbook = loadKnowledge("cold-email.md");
const enriched = listJson("enriched").sort((a, b) => b.fit_score - a.fit_score);

let made = 0;
for (const lead of enriched) {
  if (made >= config.limits.max_drafts_per_run) break;
  const draftPath = path.join(DATA("drafts"), `${lead.id}.md`);
  if (fs.existsSync(draftPath)) continue;

  let d;
  try {
    d = await chat(
      config,
      [
        {
          role: "system",
          content:
            `You write cold outreach emails. Follow this playbook strictly:\n${playbook}\n` +
            `Tone: ${config.email.tone}. Hard limit ${config.email.max_words} words in the body. ` +
            'Return JSON: {"to_hint":"best guess how to reach them","subject":"...","body":"..."}',
        },
        {
          role: "user",
          content:
            `Sender: ${config.project.sender_name}, ${config.project.name} (${config.project.website})\n` +
            `Why we reach out: ${config.email.why_outreach}\n\n` +
            `Lead: ${lead.who}\nFit reason: ${lead.fit_reason}\n` +
            `Personalization hooks:\n- ${(lead.hooks || []).join("\n- ")}\n` +
            `Source: ${lead.url}\n\n` +
            `Write ONE email. Open with the most specific hook. One clear, tiny ask. ` +
            (config.email.include_optout ? `End body with: "${config.email.optout_line}"` : ""),
        },
      ],
      { json: true }
    );
  } catch (err) {
    console.error(`Draft failed for ${lead.id}: ${err.message}`);
    continue;
  }

  fs.writeFileSync(
    draftPath,
    frontmatter(
      {
        id: lead.id,
        to: lead.email || "",   // pre-filled by find_email.mjs; blank = fill manually
        email_source: lead.email_source || "",
        to_hint: d.to_hint,
        subject: d.subject,
        fit_score: lead.fit_score,
        lead_url: lead.url,
        created_at: new Date().toISOString(),
      },
      d.body
    )
  );
  made++;
  console.log(`✉️  drafted [${lead.fit_score}/10] ${d.subject}`);
}
console.log(`\n${made} drafts written to data/drafts/. Review, add the "to" address, and move to data/approved/ to queue for Gmail.`);
