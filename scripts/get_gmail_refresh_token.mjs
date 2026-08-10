// One-shot: get a Gmail refresh token for gtm-lite.
// Usage:
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/get_gmail_refresh_token.mjs
// Opens Google's consent screen in your browser, catches the redirect on
// http://localhost:53682, prints the refresh token. Add it to .env as
// GMAIL_REFRESH_TOKEN. Nothing is stored on disk.
import http from "node:http";
import { google } from "googleapis";

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;
if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.");
  process.exit(1);
}

const REDIRECT = "http://localhost:53682";
const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, REDIRECT);

const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",             // force refresh_token even on repeat runs
  scope: ["https://www.googleapis.com/auth/gmail.compose"],
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) { res.end("no code"); return; }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.end("Got it. You can close this tab.");
    console.log("\n✅  GMAIL_REFRESH_TOKEN=" + tokens.refresh_token + "\n");
    if (!tokens.refresh_token) console.log("(no refresh_token returned — revoke access at myaccount.google.com/permissions and rerun)");
    server.close();
  } catch (e) {
    res.end("error: " + e.message);
    console.error(e);
    server.close();
  }
});

server.listen(53682, () => {
  console.log("→ Open this URL in the SAME browser profile as your test-user Gmail:\n\n" + url + "\n");
});
