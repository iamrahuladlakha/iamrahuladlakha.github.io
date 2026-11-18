import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startWorker, postComment, admin, publicList, freshIp, ORIGIN } from "./helpers.js";

let w;
before(async () => { w = await startWorker({ port: 8791 }); });
after(() => w && w.stop());

test("post is pending, hidden until approved, then visible without private fields", async () => {
  const res = await postComment(w.base, { name: "  Ada  ", email: "ada@example.com", body: "Line one\nLine two" });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true, pending: true });
  assert.equal((await publicList(w.base)).length, 0);

  const pending = await (await admin(w.base, "/admin/comments?status=pending")).json();
  const row = pending.find((c) => c.body === "Line one\nLine two");
  assert.ok(row);
  assert.equal(row.name, "Ada");
  assert.equal(row.email, "ada@example.com");
  assert.deepEqual(Object.keys(row).sort(), ["body", "created_at", "email", "id", "is_author", "name", "parent_id", "post", "status"]);

  assert.equal((await admin(w.base, `/admin/comments/${row.id}/approve`, { method: "POST" })).status, 200);
  const list = await publicList(w.base);
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ["body", "created_at", "id", "is_author", "name", "parent_id"]);
  assert.equal(list[0].body, "Line one\nLine two");
});

test("public GET sets cache header and rejects bad post path", async () => {
  const ok = await fetch(`${w.base}/comments?post=/blog/test-post/`);
  assert.equal(ok.headers.get("Cache-Control"), "public, max-age=15");
  const bad = await fetch(`${w.base}/comments?post=/etc/passwd`);
  assert.equal(bad.status, 400);
  assert.ok((await bad.json()).error);
});

test("honeypot returns ok and stores nothing", async () => {
  const before = (await (await admin(w.base, "/admin/comments?status=all")).json()).length;
  const res = await postComment(w.base, { website: "http://spam.example", body: "buy now" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const all = await (await admin(w.base, "/admin/comments?status=all")).json();
  assert.equal(all.length, before);
});

test("validation errors return 400", async () => {
  const cases = [
    { post: "/blog/Bad Slug/" },
    { post: "/notblog/x/" },
    { name: "" },
    { name: "   " },
    { name: "x".repeat(61) },
    { name: "two\nlines" },
    { body: "" },
    { body: "x".repeat(2001) },
    { body: "bell\u0007" },
    { body: "hidden\u200Bspace" },
    { body: "bidi \u202Eoverride" },
    { name: "tab\tname" },
    { name: "zero\u200Bwidth" },
    { name: "Rahul Adlakha" },
    { name: "  rahul   ADLAKHA " },
    { email: "not-an-email" },
    { email: "a@b.c" + "x".repeat(120) },
  ];
  for (const fields of cases) {
    const res = await postComment(w.base, fields);
    assert.equal(res.status, 400, JSON.stringify(fields));
    assert.ok((await res.json()).error);
  }
  const reserved = await postComment(w.base, { name: "Rahul  adlakha" });
  assert.equal((await reserved.json()).error, "That name is reserved");
  const bad = await fetch(w.base + "/comments", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: "{nope" });
  assert.equal(bad.status, 400);
  assert.equal((await postComment(w.base, { body: "col1\tcol2\nnext line" })).status, 201);
  assert.equal((await postComment(w.base, { body: "x".repeat(2000), name: "x".repeat(60) })).status, 201);
});

test("POST needs a JSON Content-Type and a body of at most 16 KiB", async () => {
  const send = (headers, body) => fetch(w.base + "/comments", { method: "POST", headers: { Origin: ORIGIN, ...headers }, body, duplex: "half" });
  const ok = JSON.stringify({ post: "/blog/test-post/", name: "Ada", body: "hi", token: "XXXX.DUMMY.TOKEN.XXXX" });
  assert.equal((await send({ "Content-Type": "text/plain" }, ok)).status, 415);
  assert.equal((await send({}, ok)).status, 415);
  const big = JSON.stringify({ post: "/blog/test-post/", name: "Ada", body: "x".repeat(17000) });
  assert.equal((await send({ "Content-Type": "application/json" }, big)).status, 413);
  const stream = new ReadableStream({  // no Content-Length: chunked upload must still be capped
    start(c) { for (let i = 0; i < 20; i++) c.enqueue(new TextEncoder().encode("x".repeat(1024))); c.close(); },
  });
  const chunked = await send({ "Content-Type": "application/json" }, stream);
  assert.equal(chunked.status, 413);
  assert.ok((await chunked.json()).error);
});

test("missing Turnstile token is rejected", async () => {
  assert.equal((await postComment(w.base, { token: "" })).status, 403);
});

test("rate limit: 4th comment from one IP in 10 minutes gets 429", async () => {
  const ip = freshIp();
  for (let i = 0; i < 3; i++) assert.equal((await postComment(w.base, { body: `rl ${i}` }, { ip })).status, 201);
  const res = await postComment(w.base, { body: "rl 3" }, { ip });
  assert.equal(res.status, 429);
  assert.ok((await res.json()).error);
  assert.equal((await postComment(w.base, { body: "other ip" })).status, 201);
});

test("IPv6 rate limit covers the whole /64", async () => {
  const same = ["2001:db8:77:1::1", "2001:0DB8:0077:0001:aaaa::5", "2001:db8:77:1:ffff:ffff:ffff:ffff"];
  for (const ip of same) assert.equal((await postComment(w.base, {}, { ip })).status, 201, ip);
  assert.equal((await postComment(w.base, {}, { ip: "2001:db8:77:1:1:2:3:4" })).status, 429);
  assert.equal((await postComment(w.base, {}, { ip: "2001:db8:77:2::1" })).status, 201);
});

test("admin routes require the bearer token", async () => {
  assert.equal((await admin(w.base, "/admin/comments", { token: null })).status, 401);
  assert.equal((await admin(w.base, "/admin/comments", { token: "wrong" })).status, 401);
  assert.equal((await admin(w.base, "/admin/comments/1/approve", { method: "POST", token: null })).status, 401);
  assert.equal((await admin(w.base, "/admin/comments/1", { method: "DELETE", token: "x" })).status, 401);
  assert.equal((await admin(w.base, "/admin/comments?status=bogus")).status, 400);
});

test("replying to a pending comment approves the parent", async () => {
  await postComment(w.base, { post: "/blog/reply-pending/", body: "still pending" });
  const [q] = await (await admin(w.base, "/admin/comments?status=pending")).json().then((r) => r.filter((c) => c.post === "/blog/reply-pending/"));
  assert.equal((await publicList(w.base, "/blog/reply-pending/")).length, 0);
  assert.equal((await admin(w.base, `/admin/comments/${q.id}/reply`, { method: "POST", body: { body: "answer" } })).status, 201);
  const list = await publicList(w.base, "/blog/reply-pending/");
  assert.equal(list.length, 2);
  assert.ok(list.some((c) => c.id === q.id));
});

test("author reply is approved, badged, threaded; delete removes it", async () => {
  await postComment(w.base, { post: "/blog/reply-post/", body: "question?" });
  const [q] = await (await admin(w.base, "/admin/comments?status=pending")).json().then((r) => r.filter((c) => c.post === "/blog/reply-post/"));
  await admin(w.base, `/admin/comments/${q.id}/approve`, { method: "POST" });
  const res = await admin(w.base, `/admin/comments/${q.id}/reply`, { method: "POST", body: { body: "answer." } });
  assert.equal(res.status, 201);
  const list = await publicList(w.base, "/blog/reply-post/");
  assert.equal(list.length, 2);
  const r = list.find((c) => c.parent_id === q.id);
  assert.equal(r.is_author, 1);
  assert.equal(r.name, "Rahul Adlakha");
  assert.equal(r.body, "answer.");
  assert.equal((await admin(w.base, "/admin/comments/999999/reply", { method: "POST", body: { body: "x" } })).status, 404);
  assert.equal((await admin(w.base, `/admin/comments/${q.id}/reply`, { method: "POST", body: { body: "" } })).status, 400);

  assert.equal((await admin(w.base, `/admin/comments/${q.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await publicList(w.base, "/blog/reply-post/")).length, 0);
  assert.equal((await admin(w.base, `/admin/comments/${q.id}`, { method: "DELETE" })).status, 404);
});

test("CORS: allowed origin echoed, disallowed origin refused", async () => {
  const ok = await fetch(`${w.base}/comments?post=/blog/test-post/`, { headers: { Origin: ORIGIN } });
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(ok.headers.get("Vary"), /Origin/);

  const pre = await fetch(`${w.base}/comments`, { method: "OPTIONS", headers: { Origin: "https://iamrahuladlakha.github.io", "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "https://iamrahuladlakha.github.io");
  assert.match(pre.headers.get("Access-Control-Allow-Methods"), /POST/);

  const evil = "https://evil.example";
  const g = await fetch(`${w.base}/comments?post=/blog/test-post/`, { headers: { Origin: evil } });
  assert.equal(g.headers.get("Access-Control-Allow-Origin"), null);
  const p = await fetch(`${w.base}/comments`, { method: "OPTIONS", headers: { Origin: evil, "Access-Control-Request-Method": "POST" } });
  assert.equal(p.status, 403);
  assert.equal(p.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await postComment(w.base, {}, { origin: evil })).status, 403);

  const a = await admin(w.base, "/admin/comments");
  assert.equal(a.headers.get("Access-Control-Allow-Origin"), null);
});

test("unknown routes are JSON 404", async () => {
  const res = await fetch(w.base + "/nope");
  assert.equal(res.status, 404);
  assert.match(res.headers.get("Content-Type"), /application\/json/);
});
