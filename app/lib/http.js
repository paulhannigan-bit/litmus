// Shared request handler for POST /api/review (used by server.js and api/review.js).
// review.js (and the Anthropic SDK) load on the first test, so the static site runs even before `npm install`.
class ReviewError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
let reviewMod;
async function review(draft, type) {
  reviewMod ??= await import("./review.js");
  return reviewMod.reviewDraft(draft, type);
}
const isReviewError = (e) => e instanceof ReviewError || (reviewMod && e instanceof reviewMod.ReviewError);

const MAX_BODY = 200_000; // bytes
const WINDOW_MS = 60 * 60 * 1000;
const PER_WINDOW = Number(process.env.LITMUS_REVIEWS_PER_HOUR || 10);
const hits = new Map(); // ip -> timestamps; best-effort, per server instance

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) { hits.set(ip, recent); return true; }
  recent.push(now); hits.set(ip, recent);
  return false;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel pre-parses JSON
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new ReviewError("too_large", "That draft is too long. Paste the main sections only.", 413);
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new ReviewError("bad_request", "The request couldn't be read.", 400); }
}

export async function handleReview(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return send(res, 429, { error: "rate_limited", message: "You've run a lot of tests in the last hour. Try again later." });
  try {
    const { draft, type } = await readJson(req);
    if (String(draft || "").trim().length < 80) throw new ReviewError("too_short", "Paste a draft of at least a few lines first.");
    const report = await review(String(draft || ""), String(type || "auto"));
    return send(res, 200, report);
  } catch (e) {
    if (isReviewError(e)) return send(res, e.status, { error: e.code, message: e.message });
    if (e && e.code === "ERR_MODULE_NOT_FOUND") return send(res, 500, { error: "config", message: "Litmus isn't set up yet: run npm install." });
    console.error("review failed:", e);
    return send(res, 502, { error: "upstream_error", message: "The test didn't finish. Run it again." });
  }
}
