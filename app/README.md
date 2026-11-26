# Litmus web app

The standalone version of Litmus. It does everything the Claude artifact does, and it can also **play each expert's
clip inline**, starting at the moment they make the point.

```
public/        the site (index.html, the 60 standards, the example result)
functions/api/review.js  Cloudflare Pages function: POST /api/review
wrangler.toml  Cloudflare Pages config
api/review.js  Vercel serverless function: POST /api/review
lib/review.js  calls Claude (claude-opus-5-5) with the standards and returns a structured result
lib/http.js    request handling, input limits and a per-IP rate limit (shared by Vercel and server.js)
server.js      run it anywhere else: serves public/ and the API
```

## Run it locally

```bash
cd app
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start            # http://localhost:8787
```

The site and the embedded clips work without a key; only **Test this draft** needs one.

## Deploy to Cloudflare Pages

The repo is set up for Pages: `public/` is the site, `functions/api/review.js` is the API, and `wrangler.toml` holds
the config.

**Option A: from GitHub (nothing to install locally)**

1. Put this `app` folder in a GitHub repo.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: `npm install`
   - Build output directory: `public`
   - Root directory: `app`, if the folder isn't at the repo root
4. Deploy. Then open **Settings → Variables and Secrets**, add `ANTHROPIC_API_KEY` as a **Secret** for Production,
   and redeploy so the function picks it up.

**Option B: from your terminal**

```bash
cd app
npm install
npx wrangler login
npx wrangler pages deploy
npx wrangler pages secret put ANTHROPIC_API_KEY
```

Optional variable: `LITMUS_MODEL` (default `claude-opus-5-5`).

**Rate limiting on Cloudflare.** The Pages function has no built-in per-visitor limit. Its isolates don't share
memory, so an in-memory counter wouldn't hold. Once the site is on a custom domain in your Cloudflare account, add a
rate-limiting rule under **Security → WAF** for the path `/api/review`. Until then, keep the `*.pages.dev` link
private, or put the site behind **Cloudflare Access** (Zero Trust).

## Deploy to Vercel

1. Push this `app` folder to a GitHub repo (or run `npx vercel` inside it).
2. In Vercel, import the repo. Framework preset: **Other**. No build command. Vercel serves `public/` and turns
   `api/review.js` into a function.
3. Add the environment variable `ANTHROPIC_API_KEY`.
4. Optional: `LITMUS_REVIEWS_PER_HOUR` (default 10 per visitor) and `LITMUS_MODEL` (default `claude-opus-5-5`).

Any Node 20+ host works too: run `npm start` with `PORT` and `ANTHROPIC_API_KEY` set.

## Costs and limits

- Each test is one Claude call: about 6K input tokens (cached after the first call) and 3-6K output tokens.
- Every test is paid from **your** API key, so the per-IP limit is on by default. It lives in memory, so on serverless
  it is per instance and best-effort. For a public launch, add a shared limit (for example Vercel KV or Upstash) or
  put the page behind a sign-in.
- Drafts over 60,000 characters are rejected rather than cut.

## Clips

Clips use YouTube's standard embedded player (`youtube-nocookie.com`). Nothing is downloaded or re-hosted. Each clip
starts 3 seconds before the transcript timestamp. Transcript times can drift from the video by up to a few minutes on
some episodes, so the player has -30s / +30s nudges and an "Open on YouTube" link. If a video's owner has turned off
embedding, the player shows YouTube's own message and the link still works.
