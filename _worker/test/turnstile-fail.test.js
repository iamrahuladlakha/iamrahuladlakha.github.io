// Second Worker run with Turnstile's always-fail test secret: a well-formed token must be rejected.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startWorker, postComment, admin } from "./helpers.js";

let w;
before(async () => { w = await startWorker({ port: 8792, turnstileSecret: "2x0000000000000000000000000000000AA" }); });
after(() => w && w.stop());

test("bad Turnstile token gets 403 and stores nothing", async () => {
  const res = await postComment(w.base, { body: "should fail" });
  assert.equal(res.status, 403);
  assert.ok((await res.json()).error);
  assert.equal((await (await admin(w.base, "/admin/comments?status=all")).json()).length, 0);
});
