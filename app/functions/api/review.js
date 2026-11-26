// Cloudflare Pages Function: POST /api/review
//
// Protection, in the order it runs:
//   1. Turnstile bot check (secret: TURNSTILE_SECRET)
//   2. Per-visitor daily limit and a site-wide daily cap, counted in KV (binding: LITMUS_KV)
//   3. The Claude call (secret: ANTHROPIC_API_KEY)
// Limits come from wrangler.toml [vars]: DAILY_CAP, PER_VISITOR_DAILY.
import { reviewDraft, ReviewError } from "../../lib/review.js";

const MAX_BODY = 200_000;
const TWO_DAYS = 2 * 24 * 60 * 60;

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function passesTurnstile(env, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = await r.json().catch(() => ({}));
  return out.success === true;
}

// KV counters. KV isn't transactional, so under a burst of simultaneous requests a cap can be
// overshot by a few; the Anthropic spend limit is the hard backstop.
async function readCount(kv, key) { return Number((await kv.get(key)) || 0); }
async function writeCount(kv, key, n) { await kv.put(key, String(Math.max(0, n)), { expirationTtl: TWO_DAYS }); }

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY || !env.LITMUS_KV || !env.TURNSTILE_SECRET) {
    console.error("missing config:", { key: !!env.ANTHROPIC_API_KEY, kv: !!env.LITMUS_KV, turnstile: !!env.TURNSTILE_SECRET });
    return json(500, { error: "config", message: "Litmus isn't fully configured yet. Try again later." });
  }
  const dailyCap = Number(env.DAILY_CAP || 100);
  const perVisitor = Number(env.PER_VISITOR_DAILY || 3);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: "too_large", message: "That draft is too long. Paste the main sections only." });
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { return json(400, { error: "bad_request", message: "The request couldn't be read." }); }

  const draft = String(body.draft || "");
  if (draft.trim().length < 80) return json(400, { error: "too_short", message: "Paste a draft of at least a few lines first." });

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await passesTurnstile(env, String(body.turnstileToken || ""), ip))) {
    return json(403, { error: "bot_check", message: "The quick human check didn't pass. Wait a moment, then press Test again." });
  }

  const day = new Date().toISOString().slice(0, 10); // UTC day
  const siteKey = `site:${day}`;
  const visitorKey = `visitor:${day}:${await sha256(ip + "|" + day)}`; // the IP itself is never stored
  const [siteCount, visitorCount] = await Promise.all([readCount(env.LITMUS_KV, siteKey), readCount(env.LITMUS_KV, visitorKey)]);

  if (siteCount >= dailyCap) {
    return json(429, { error: "daily_cap", message: "Litmus has reached today's testing limit. Browsing, the standards and the clips still work. Testing reopens at midnight UTC." });
  }
  if (visitorCount >= perVisitor) {
    return json(429, { error: "visitor_cap", message: `You've used your ${perVisitor} tests for today. Come back tomorrow. Everything else still works.` });
  }

  // Count the attempt before calling Claude, so parallel requests can't slip past the limit.
  await Promise.all([writeCount(env.LITMUS_KV, siteKey, siteCount + 1), writeCount(env.LITMUS_KV, visitorKey, visitorCount + 1)]);
  const refund = () => Promise.all([writeCount(env.LITMUS_KV, siteKey, siteCount), writeCount(env.LITMUS_KV, visitorKey, visitorCount)]).catch(() => {});

  try {
    const report = await reviewDraft(draft, String(body.type || "auto"), { apiKey: env.ANTHROPIC_API_KEY, model: env.LITMUS_MODEL });
    report.quota = { remaining_today: Math.max(0, perVisitor - (visitorCount + 1)), per_day: perVisitor };
    return json(200, report);
  } catch (e) {
    await refund(); // a failed test doesn't use up the visitor's allowance
    if (e instanceof ReviewError) return json(e.status, { error: e.code, message: e.message });
    console.error("review failed:", e);
    return json(502, { error: "upstream_error", message: "The test didn't finish. Run it again." });
  }
}

export const onRequest = () => json(405, { error: "method_not_allowed" });
