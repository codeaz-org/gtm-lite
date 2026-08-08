// Step 4: Push approved emails to Gmail as DRAFTS.
// Nothing is ever sent automatically — you hit send from your own inbox.
// Requires secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, parseFrontmatter, DATA, moveRecord } from "./lib.mjs";

const config = loadConfig();
const dir = DATA("approved");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
if (!files.length) {
  console.log("No approved drafts to push.");
  process.exit(0);
}

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);
oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oauth2 });

for (const file of files) {
  const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), "utf8"));
  if (!meta.to) {
    console.log(`⏭  ${file}: no "to" address set — skipping (fill it in to queue).`);
    continue;
  }
  const raw = Buffer.from(
    [
      `From: ${config.project.sender_name} <${config.project.sender_email}>`,
      `To: ${meta.to}`,
      `Subject: ${meta.subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      body.trim(),
    ].join("\r\n")
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  try {
    await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    });
    moveRecord("approved", "sent", file);
    console.log(`📬 Gmail draft created: ${meta.subject} → ${meta.to}`);
  } catch (e) {
    console.error(`Failed for ${file}: ${e.message}`);
  }
}
