// Cloudflare Pages Function: POST /api/review
// Set ANTHROPIC_API_KEY as an encrypted variable in the Pages project (Settings > Variables and Secrets).
import { reviewDraft, ReviewError } from "../../lib/review.js";

const MAX_BODY = 200_000;

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json(500, { error: "config", message: "Litmus isn't configured yet (missing API key)." });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: "too_large", message: "That draft is too long. Paste the main sections only." });
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { return json(400, { error: "bad_request", message: "The request couldn't be read." }); }

  const draft = String(body.draft || "");
  if (draft.trim().length < 80) return json(400, { error: "too_short", message: "Paste a draft of at least a few lines first." });

  try {
    const report = await reviewDraft(draft, String(body.type || "auto"), { apiKey: env.ANTHROPIC_API_KEY, model: env.LITMUS_MODEL });
    return json(200, report);
  } catch (e) {
    if (e instanceof ReviewError) return json(e.status, { error: e.code, message: e.message });
    console.error("review failed:", e);
    return json(502, { error: "upstream_error", message: "The test didn't finish. Run it again." });
  }
}

export const onRequest = () => json(405, { error: "method_not_allowed" });
