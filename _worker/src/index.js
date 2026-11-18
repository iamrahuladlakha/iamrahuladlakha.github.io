// Blog comments API: public read/submit (Turnstile + rate limit, pre-moderated) and a bearer-token admin API.
const POST_RE = /^\/blog\/[a-z0-9-]+\/$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CTRL_RE = /[\u0000-\u0009\u000B-\u001F\u007F]/;
const RATE_MAX = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const AUTHOR_NAME = "Rahul Adlakha";
const PUBLIC_COLS = "id, name, body, created_at, is_author, parent_id";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/comments") return await publicRoute(request, env, url);
      if (url.pathname.startsWith("/admin/")) return await adminRoute(request, env, url);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = { Vary: "Origin" };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return { headers: h, ok: !origin || allowed.includes(origin) };
}

async function publicRoute(request, env, url) {
  const cors = corsHeaders(request, env);
  const reply = (data, status, extra = {}) => json(data, status, { ...cors.headers, ...extra });
  if (request.method === "OPTIONS") {
    if (!cors.ok) return reply({ error: "Origin not allowed" }, 403);
    return new Response(null, {
      status: 204,
      headers: {
        ...cors.headers,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (!cors.ok) return reply({ error: "Origin not allowed" }, 403);
  if (request.method === "GET") {
    const post = url.searchParams.get("post") || "";
    if (!POST_RE.test(post)) return reply({ error: "Invalid post" }, 400);
    const { results } = await env.DB.prepare(
      `SELECT ${PUBLIC_COLS} FROM comments WHERE post = ? AND status = 'approved' ORDER BY created_at, id`
    ).bind(post).all();
    return reply(results, 200, { "Cache-Control": "public, max-age=15" });
  }
  if (request.method === "POST") return submit(request, env, reply);
  return reply({ error: "Method not allowed" }, 405);
}

function clean(value, max, { multiline = false, optional = false } = {}) {
  if (value == null || value === "") return optional ? { value: null } : { error: "required" };
  if (typeof value !== "string") return { error: "invalid" };
  let s = value.replace(/\r\n?/g, "\n").trim();
  if (!s) return optional ? { value: null } : { error: "required" };
  if (s.length > max) return { error: `too long (max ${max})` };
  if (CTRL_RE.test(s) || (!multiline && s.includes("\n"))) return { error: "invalid characters" };
  return { value: s };
}

async function submit(request, env, reply) {
  const raw = await request.text();
  if (raw.length > 16000) return reply({ error: "Request too large" }, 413);
  let data;
  try { data = JSON.parse(raw); } catch { return reply({ error: "Invalid JSON" }, 400); }
  if (!data || typeof data !== "object") return reply({ error: "Invalid JSON" }, 400);
  if (data.website) return reply({ ok: true }, 200);

  if (typeof data.post !== "string" || !POST_RE.test(data.post)) return reply({ error: "Invalid post" }, 400);
  const name = clean(data.name, 60);
  if (name.error) return reply({ error: `Name ${name.error}` }, 400);
  const body = clean(data.body, 2000, { multiline: true });
  if (body.error) return reply({ error: `Comment ${body.error}` }, 400);
  const email = clean(data.email, 120, { optional: true });
  if (email.error || (email.value && !EMAIL_RE.test(email.value))) return reply({ error: "Email invalid" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await verifyTurnstile(env, data.token, ip))) return reply({ error: "Verification failed" }, 403);

  const ipHash = await sha256Hex((env.IP_SALT || "") + ip);
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, since).first("n");
  if (recent >= RATE_MAX) return reply({ error: "Too many comments, try again later" }, 429);

  await env.DB.prepare(
    "INSERT INTO comments (post, name, email, body, status, is_author, parent_id, ip_hash, created_at) VALUES (?, ?, ?, ?, 'pending', 0, NULL, ?, ?)"
  ).bind(data.post, name.value, email.value, body.value, ipHash, new Date().toISOString()).run();
  return reply({ ok: true, pending: true }, 201);
}

async function verifyTurnstile(env, token, ip) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET || "");
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const out = await res.json();
    return out.success === true;
  } catch {
    return false;
  }
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function sha256Hex(text) {
  return [...(await sha256(text))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!env.ADMIN_TOKEN || !header.startsWith("Bearer ")) return false;
  const [a, b] = await Promise.all([sha256(header.slice(7)), sha256(env.ADMIN_TOKEN)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function adminRoute(request, env, url) {
  if (!(await authorized(request, env))) return json({ error: "Unauthorized" }, 401);
  const path = url.pathname;
  if (path === "/admin/comments" && request.method === "GET") {
    const status = url.searchParams.get("status") || "pending";
    if (!["pending", "approved", "all"].includes(status)) return json({ error: "Invalid status" }, 400);
    const where = status === "all" ? "" : "WHERE status = ?";
    const stmt = env.DB.prepare(`SELECT * FROM comments ${where} ORDER BY created_at DESC, id DESC LIMIT 500`);
    const { results } = await (status === "all" ? stmt : stmt.bind(status)).all();
    return json(results);
  }
  const m = path.match(/^\/admin\/comments\/(\d+)(?:\/(approve|reply))?$/);
  if (!m) return json({ error: "Not found" }, 404);
  const id = Number(m[1]);
  const action = m[2] || (request.method === "DELETE" ? "delete" : null);
  if (action === "approve" && request.method === "POST") {
    const r = await env.DB.prepare("UPDATE comments SET status = 'approved' WHERE id = ?").bind(id).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: "Not found" }, 404);
  }
  if (action === "delete") {
    const r = await env.DB.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?").bind(id, id).run();
    return r.meta.changes ? json({ ok: true }) : json({ error: "Not found" }, 404);
  }
  if (action === "reply" && request.method === "POST") {
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const body = clean(data && data.body, 2000, { multiline: true });
    if (body.error) return json({ error: `Reply ${body.error}` }, 400);
    const parent = await env.DB.prepare("SELECT post FROM comments WHERE id = ?").bind(id).first();
    if (!parent) return json({ error: "Not found" }, 404);
    await env.DB.prepare("UPDATE comments SET status = 'approved' WHERE id = ?").bind(id).run();  // a public reply needs a public parent
    const r = await env.DB.prepare(
      "INSERT INTO comments (post, name, email, body, status, is_author, parent_id, ip_hash, created_at) VALUES (?, ?, NULL, ?, 'approved', 1, ?, NULL, ?)"
    ).bind(parent.post, AUTHOR_NAME, body.value, id, new Date().toISOString()).run();
    return json({ ok: true, id: r.meta.last_row_id }, 201);
  }
  return json({ error: "Method not allowed" }, 405);
}
