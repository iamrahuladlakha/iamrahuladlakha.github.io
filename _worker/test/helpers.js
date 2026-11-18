// Starts `wrangler dev --local` on a fresh temp D1 with the schema applied; returns { base, stop }.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", ".bin", "wrangler");
export const ADMIN = "test-admin-token";
export const ORIGIN = "http://localhost:4000";

export const ORIGINS = "https://iamrahuladlakha.github.io,http://localhost:4000,http://127.0.0.1:4000";

// vars: extra/overriding Worker vars; seed: SQL run on the fresh DB before start.
export async function startWorker({ port, turnstileSecret = "1x0000000000000000000000000000000AA", vars = {}, seed }) {
  const dir = mkdtempSync(join(tmpdir(), "blog-comments-"));
  const d1 = (args) => execFileSync(wrangler, ["d1", "execute", "blog-comments", "--local", "--persist-to", dir, ...args],
    { cwd: root, stdio: "ignore" });
  d1(["--file", "schema.sql"]);
  if (seed) { const f = join(dir, "seed.sql"); writeFileSync(f, seed); d1(["--file", f]); }
  const all = { TURNSTILE_SECRET: turnstileSecret, ADMIN_TOKEN: ADMIN, IP_SALT: "test-salt-0123456789", ALLOWED_ORIGINS: ORIGINS, ...vars };
  const proc = spawn(wrangler, ["dev", "--local", "--port", String(port), "--persist-to", dir, "--show-interactive-dev-session=false",
    ...Object.entries(all).flatMap(([k, v]) => ["--var", `${k}:${v}`])],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { await fetch(base + "/"); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
    if (i === 119) throw new Error("wrangler dev did not start:\n" + log);
  }
  const stop = () => {
    try { process.kill(-proc.pid, "SIGTERM"); } catch {}
    rmSync(dir, { recursive: true, force: true });
  };
  return { base, stop };
}

let ipSeq = 0;
export function freshIp() { ipSeq += 1; return `203.0.113.${ipSeq}`; }

export function postComment(base, fields = {}, { ip = freshIp(), origin = ORIGIN } = {}) {
  const payload = { post: "/blog/test-post/", name: "Ada", email: "", body: "Hello", website: "", token: "XXXX.DUMMY.TOKEN.XXXX", ...fields };
  const headers = { "Content-Type": "application/json", "CF-Connecting-IP": ip };
  if (origin) headers.Origin = origin;
  return fetch(base + "/comments", { method: "POST", headers, body: JSON.stringify(payload) });
}

export function admin(base, path, { method = "GET", body, token = ADMIN } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers["Content-Type"] = "application/json";
  return fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
}

export async function publicList(base, post = "/blog/test-post/") {
  const res = await fetch(`${base}/comments?post=${encodeURIComponent(post)}`, { headers: { Origin: ORIGIN } });
  return res.json();
}
