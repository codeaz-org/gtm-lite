// Run: node scripts/test_chat_fallback.mjs
// Stubs fetch and asserts chat() skips missing keys, retries on error, returns first success.
import assert from "node:assert/strict";
import { chat } from "./lib.mjs";

const cfg = {
  models: {
    chat: [
      { base_url: "https://a.test/v1", api_key_env: "KEY_A", model: "a" },
      { base_url: "https://b.test/v1", api_key_env: "KEY_B", model: "b" },
      { base_url: "https://c.test/v1", api_key_env: "KEY_C", model: "c" },
    ],
  },
};

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return handler(url, opts);
  };
  return calls;
}
const ok = (text) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content: text } }] }),
});
const err = (status, text) => ({ ok: false, status, text: async () => text });

// 1. Missing keys → all fail with a clear error.
delete process.env.KEY_A; delete process.env.KEY_B; delete process.env.KEY_C;
stubFetch(() => { throw new Error("should not be called"); });
await assert.rejects(chat(cfg, [{ role: "user", content: "hi" }]), /All chat providers failed/);

// 2. Only KEY_B set → skips A, hits B, returns.
process.env.KEY_B = "xxx";
const calls2 = stubFetch(() => ok("from B"));
assert.equal(await chat(cfg, [{ role: "user", content: "hi" }]), "from B");
assert.equal(calls2.length, 1);
assert.match(calls2[0].url, /b\.test/);

// 3. All keys set, A errors → falls back to B.
process.env.KEY_A = "xxx"; process.env.KEY_C = "xxx";
const calls3 = stubFetch((url) => url.includes("a.test") ? err(429, "rate limited") : ok("from B"));
assert.equal(await chat(cfg, [{ role: "user", content: "hi" }]), "from B");
assert.equal(calls3.length, 2);

// 4. JSON mode strips ```json fences.
const calls4 = stubFetch(() => ok("```json\n{\"x\":1}\n```"));
assert.deepEqual(await chat(cfg, [{ role: "user", content: "hi" }], { json: true }), { x: 1 });
assert.equal(calls4[0].body.response_format.type, "json_object");

console.log("ok");
