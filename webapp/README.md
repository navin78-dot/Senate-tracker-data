# Senate 2026 board — the friends web app

A small Netlify site that shows Navin's Senate forecast to friends and lets each of them save a call.

What it does
- Reads the relay repo (github.com/navin78-dot/Senate-tracker-data) every 30 minutes, server side, and recomputes the board from the same September 5 rules the chat board uses: RealClearPolitics averages in, the fade, the chance Democrats win 8 of 11. Both calibrations (September rules, Last 3 weeks rules) are computed every time; the visitor picks which one to look at.
- Pages: Board (headline chance, market, the eleven races with seat counts), Trend (headline over time, polling lead per race), Races (one card per race with the polls RealClearPolitics is counting), Call it (each friend picks 11 winners, saves with a timestamp, every version kept).
- Everything is behind Google sign-in (Netlify Identity). Nobody sees the board or the calls without signing in.

Folder
- public/index.html — the whole page (HTML, CSS, JS in one file). public/identity.js is the browser copy of @netlify/identity, built by `npm run build`; it is committed so Netlify needs no build step.
- netlify/functions/board.mjs — GET /api/board: the current board plus history. Re-reads the relay if the cached copy is older than 25 minutes.
- netlify/functions/calls.mjs — GET and POST /api/calls: everyone's calls, and saving a new version.
- netlify/functions/refresh.mjs — runs every 30 minutes (UTC cron), stores a new snapshot when the relay has one, extends the trend.
- netlify/lib/model.mjs — the model: tables, fades, win chances, and the control chance computed exactly (numerical integration) instead of the chat board's 400,000 simulated draws. Constants are the fixed ones from senate_model.py; do not edit them.
- netlify/lib/relay.mjs — reads the relay files the same way read_relay.py does.
- netlify/lib/board.mjs — turns one relay read into the board the page shows.
- netlify/lib/store.mjs — the Netlify Blobs store "senate-board": keys latest, snap/<time>, trend, calls/<userId>.
- netlify/lib/seed.mjs — history exported from the chat board on October 24 (TREND rows since September 19, RCP leads since September 5) so the Trend page starts with the past.

One-time setup (Navin, about ten minutes)
1. Put this folder in a GitHub repository (for example navin78-dot/senate-board). Easiest: on github.com create an empty repo, then "Add file → Upload files" and drag everything in this folder except node_modules. Or start a Claude Code task with the new repo selected and attach the zip.
2. In Netlify, open the project "senate-board" (https://app.netlify.com/projects/senate-board) → Project configuration → Build & deploy → Link to a Git repository → pick the repo. Build command: leave empty. Publish directory: public. Functions directory: netlify/functions (netlify.toml already says so). Netlify installs package.json dependencies and bundles the functions itself.
3. Turn on sign-in: https://app.netlify.com/projects/senate-board/identity → Enable Identity. Then Registration → External providers → add Google (Netlify's default app is fine; no Google Cloud setup). Registration preferences: Open means anyone with the link can sign in with any Google account; Invite only means you enter friends' Gmail addresses under Identity → Users → Invite users and only they can get in.
4. Open https://senate-board.netlify.app, sign in with Google, check the four pages, save a test call.

Call it rules (changed Oct 24, evening)
- One call per person. Saving again replaces the earlier call (the server keeps the last 20 replaced calls under "previous" in the person's blob, but the page shows only the current call).
- Every race takes a winner and the winner's margin in points (0 to 40, one decimal).
- Deadline: Monday, November 2, 2026, 9:00am ET (netlify/lib/rules.mjs, DEADLINE = "2026-11-02T14:00:00Z"). After it, saves and deletes are refused by the server and the page shows everything locked. To move it, edit that one line and push.
- Scoring: as Navin enters each result (Call it page, "Enter the results", visible only to the emails in ADMIN_EMAILS in rules.mjs), everyone is scored: one point per called race where the winner matched; ties broken by total margin error, the sum over called races of |predicted signed margin - actual signed margin| (D margins positive, R negative). The leaderboard replaces the plain list once at least one result exists. Results live in the blob key "results".
- Visit log: every /api/board call by a signed-in person writes visits/<timestamp>_<userId> with their email and name. /api/visits (admin only) returns the log newest first plus a per-person summary; the Call it page has a "Who has been to the site" card for the admin. Logging starts when this version is deployed; nothing earlier was recorded.

Day to day
- Nothing to do. The site re-reads the relay on its own. If the relay fails, the page shows the previous copy and says so.
- Blobs can be inspected in the Netlify dashboard under Data & Storage → Blobs → senate-board. A friend's calls live under calls/<their user id>.
- To change wording, edit public/index.html and push; Netlify redeploys.

What is not on this site
- Tables 1 to 3, the disagreement grid, the ledger and the fade tests stay on the chat board. The site shows Table 4 (the board of record) under both calibrations, and the raw and market comparisons.
- The chat board stays the board of record. The site's headline is computed exactly rather than by simulation, so it can differ from the chat board by about a point on an unlucky day; on October 24 it matched (40 / 49 / 59 / 67).
