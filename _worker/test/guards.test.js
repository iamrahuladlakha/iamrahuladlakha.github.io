// Worker runs with special config: a local fake siteverify (hostname/action/outage), a short IP_SALT, a full queue.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { startWorker, postComment, admin } from "./helpers.js";

// Fake siteverify: the token picks the answer.
const answers = {
  ok: { success: true, hostname: "localhost", action: "comment" },
  "ok-prod": { success: true, hostname: "iamrahuladlakha.github.io", action: "comment" },
  "bad-host": { success: true, hostname: "evil.example", action: "comment" },
  "bad-action": { success: true, hostname: "localhost", action: "login" },
  fail: { success: false, "error-codes": ["invalid-input-response"] },
};
const fake = createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const token = (raw.match(/name="response"\r\n\r\n([^\r]*)/) || [])[1];
    if (token === "drop") return req.socket.destroy();
    if (token === "down") { res.writeHead(502); return res.end("bad gateway"); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(answers[token] || answers.fail));
  });
});

let mock, short, paused;
before(async () => {
  await new Promise((r) => fake.listen(8796, "127.0.0.1", r));
  const pendingRows = Array.from({ length: 201 }, (_, i) =>
    `('/blog/flood/', 'n${i}', NULL, 'b', 'pending', 0, NULL, 'h', '2000-01-01T00:00:00.000Z')`).join(",");
  [mock, short, paused] = await Promise.all([
    startWorker({ port: 8793, turnstileSecret: "real-looking-secret", vars: { SITEVERIFY_URL: "http://127.0.0.1:8796/siteverify" } }),
    startWorker({ port: 8794, vars: { IP_SALT: "too-short" } }),
    startWorker({ port: 8795, seed: `INSERT INTO comments (post, name, email, body, status, is_author, parent_id, ip_hash, created_at) VALUES ${pendingRows};` }),
  ]);
});
after(() => { [mock, short, paused].forEach((w) => w && w.stop()); fake.close(); });

const count = async (w) => (await (await admin(w.base, "/admin/comments?status=all")).json()).length;

test("siteverify hostname must be one of ALLOWED_ORIGINS and action must be 'comment'", async () => {
  assert.equal((await postComment(mock.base, { token: "ok" })).status, 201);
  assert.equal((await postComment(mock.base, { token: "ok-prod" })).status, 201);
  assert.equal((await postComment(mock.base, { token: "bad-host" })).status, 403);
  assert.equal((await postComment(mock.base, { token: "bad-action" })).status, 403);
  assert.equal((await postComment(mock.base, { token: "fail" })).status, 403);
  assert.equal(await count(mock), 2);
});

test("siteverify outage gives 503, not 403", async () => {
  for (const token of ["drop", "down"]) {
    const res = await postComment(mock.base, { token });
    assert.equal(res.status, 503, token);
    assert.deepEqual(await res.json(), { error: "Spam check unavailable, try again" });
  }
  assert.equal(await count(mock), 2);
});

test("missing or short IP_SALT refuses to store (500)", async () => {
  const res = await postComment(short.base);
  assert.equal(res.status, 500);
  assert.equal(await count(short), 0);
});

test("more than 200 pending comments pauses new posts (503)", async () => {
  const res = await postComment(paused.base);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "Comments are temporarily paused" });
  assert.equal(await count(paused), 201);
});
