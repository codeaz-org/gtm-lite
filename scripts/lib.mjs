import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";

export const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
export const DATA = (d) => path.join(ROOT, "data", d);

export function loadConfig() {
  return yaml.load(fs.readFileSync(path.join(ROOT, "config.yml"), "utf8"));
}

export function loadKnowledge(name) {
  const p = path.join(ROOT, "knowledge", name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export function listJson(dir) {
  const d = DATA(dir);
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) }));
}

export function writeJson(dir, id, obj) {
  fs.writeFileSync(path.join(DATA(dir), `${id}.json`), JSON.stringify(obj, null, 2));
}

export function moveRecord(fromDir, toDir, file) {
  fs.renameSync(path.join(DATA(fromDir), file), path.join(DATA(toDir), file));
}

export function leadId(url) {
  return crypto.createHash("sha1").update(url.toLowerCase()).digest("hex").slice(0, 12);
}

/** Every lead id we've ever seen, across all stages — used for dedupe. */
export function knownIds() {
  const ids = new Set();
  for (const dir of ["leads", "enriched", "drafts", "approved", "sent", "rejected"]) {
    for (const f of fs.readdirSync(DATA(dir))) {
      if (f.endsWith(".json") || f.endsWith(".md")) ids.add(f.replace(/\.(json|md)$/, ""));
    }
  }
  return ids;
}

/** Chat call. config.models.chat is an array of OpenAI-compatible providers, tried in order.
 *  Providers whose api_key_env isn't set are skipped; only a fetched-and-failed provider is a
 *  fallback trigger. Throws only if every configured+keyed provider errors. */
export async function chat(config, messages, { json = false } = {}) {
  const providers = config.models.chat;
  const errors = [];
  for (const p of providers) {
    const key = process.env[p.api_key_env];
    if (!key) { errors.push(`${p.api_key_env} not set`); continue; }
    try {
      const res = await fetch(`${p.base_url}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature: 0.7,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.choices[0].message.content;
      return json ? JSON.parse(text.replace(/```json|```/g, "").trim()) : text;
    } catch (e) {
      errors.push(`${p.model} @ ${p.base_url}: ${e.message}`);
      console.error(`[chat] ${p.model} failed, trying next: ${e.message}`);
    }
  }
  throw new Error(`All chat providers failed:\n  - ${errors.join("\n  - ")}`);
}

/** Exa neural search. Stays within bundled-contents limits (≤10 results, text only). */
export async function exaSearch(query, numResults) {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY not set");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      numResults: Math.min(numResults, 10),
      type: "auto",
      contents: { text: { maxCharacters: 1500 } },
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${await res.text()}`);
  return (await res.json()).results || [];
}

export function frontmatter(meta, body) {
  const fm = Object.entries(meta)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) {
      try { meta[line.slice(0, i).trim()] = JSON.parse(line.slice(i + 1).trim()); }
      catch { meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
    }
  }
  return { meta, body: m[2] };
}
