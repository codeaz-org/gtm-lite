// Step 2.5: Find each qualified lead's email address — automatically.
// Strategy (free):
//   1. Scan the text Exa already gave us.
//   2. Fetch the lead's page + common contact paths (/contact, /about) and
//      scan for mailto: links and plain addresses.
//   3. Optional fallback: Hunter.io domain search (free tier: 25 searches/mo)
//      if HUNTER_API_KEY secret is set.
// Result is written into the enriched record as `email` + `email_source`.
import { listJson, writeJson } from "./lib.mjs";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JUNK = /(noreply|no-reply|donotreply|example\.|sentry|wixpress|@.*\.(png|jpg|jpeg|gif|svg|webp|css|js)$|godaddy|cloudflare|schema\.org)/i;

function extract(text) {
  const found = (text || "").match(EMAIL_RE) || [];
  return [...new Set(found.map((e) => e.toLowerCase()))].filter((e) => !JUNK.test(e));
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; gtm-lite)" },
    });
    if (!res.ok) return "";
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text") && !type.includes("html")) return "";
    return (await res.text()).slice(0, 300000);
  } catch { return ""; }
}

async function hunterDomainSearch(domain) {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !domain) return null;
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&limit=3&api_key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.data?.emails?.[0];
    return first ? { email: first.value, source: `hunter (${first.confidence}% conf)` } : null;
  } catch { return null; }
}

const leads = listJson("enriched").filter((l) => !l.email);
if (!leads.length) { console.log("No leads awaiting email discovery."); process.exit(0); }

for (const lead of leads) {
  const domain = domainOf(lead.url);
  let email = null, source = null;

  // 1. Text Exa already fetched
  const fromSnippet = extract(lead.snippet);
  if (fromSnippet.length) { email = fromSnippet[0]; source = "exa snippet"; }

  // 2. Crawl the lead page + common contact paths
  if (!email) {
    const candidates = [lead.url];
    if (domain) {
      for (const p of ["/contact", "/about", "/contact-us", "/about-me"]) {
        candidates.push(`https://${domain}${p}`);
      }
    }
    for (const u of candidates) {
      const text = await fetchText(u);
      const emails = extract(text);
      if (emails.length) {
        // Prefer an address on the lead's own domain
        email = emails.find((e) => domain && e.endsWith(`@${domain}`)) || emails[0];
        source = `scraped ${u}`;
        break;
      }
    }
  }

  // 3. Hunter fallback (optional, free 25/mo)
  if (!email && domain) {
    const h = await hunterDomainSearch(domain);
    if (h) { email = h.email; source = h.source; }
  }

  const record = { ...lead, email: email || "", email_source: source || "not found" };
  delete record.file;
  writeJson("enriched", lead.id, record);
  console.log(email ? `📧 ${email}  (${source})` : `∅  no email found — ${lead.url}`);
}
