// /api/calls — each friend's Senate call: ONE call per person. Saving again replaces the previous call.
// GET returns everyone's current call (plus scores once results exist). POST saves or replaces yours. DELETE removes yours.
// Every change to the original call is refused after the deadline in ../lib/rules.mjs. A separate "day before" call
// (POST with kind: "dayBefore") is open in the DAYBEFORE window there and never replaces the original.
import { getUser } from "@netlify/identity";
import { store } from "../lib/store.mjs";
import { STATES } from "../lib/model.mjs";
import { HELD_ELSEWHERE } from "../lib/board.mjs";
import { DEADLINE, DEADLINE_TEXT, ADMIN_EMAILS, MAX_MARGIN, NEED, locked, score, DAYBEFORE_OPEN, DAYBEFORE_CLOSE, DAYBEFORE_TEXT, dayBeforeOpen } from "../lib/rules.mjs";
import { loadResults, ELECTION_DAY_TEXT } from "../lib/results.mjs";
import { claudeRecord, CLAUDE_ID } from "../lib/claude-call.mjs";
import { readSettings } from "./settings.mjs";

function who(user){ return { id: user.id, name: user.name || user.userMetadata?.full_name || (user.email ? user.email.split("@")[0] : "friend"), picture: user.pictureUrl || null }; }
const r1 = v => Math.round(v * 10) / 10;

export default async (req, context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const s = store();
  const key = "calls/" + user.id;
  const isAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());

  if (req.method === "DELETE") {
    if (locked()) return Response.json({ error: "Calls locked at " + DEADLINE_TEXT + ". No more changes." }, { status: 403 });
  }

  if (req.method === "POST") {
    if (user.id === CLAUDE_ID) return Response.json({ error: "that id is reserved for Claude's call" }, { status: 400 });   // belt and braces; Identity ids never look like this
    let body; try { body = await req.json(); } catch { return Response.json({ error: "bad JSON" }, { status: 400 }); }
    const kind = body && body.kind === "dayBefore" ? "dayBefore" : "call";
    if (kind === "call" && locked()) return Response.json({ error: "Calls locked at " + DEADLINE_TEXT + ". No more changes." }, { status: 403 });
    if (kind === "dayBefore" && !dayBeforeOpen()) return Response.json({ error: "The day-before call is open " + DAYBEFORE_TEXT + "." }, { status: 403 });
    const picks = body && body.picks;
    if (!picks || typeof picks !== "object") return Response.json({ error: "picks missing" }, { status: 400 });
    const clean = {};
    for (const st of STATES) {
      const p = picks[st];
      if (!p || (p.w !== "D" && p.w !== "R")) return Response.json({ error: "every race needs a winner; " + st + " is missing" }, { status: 400 });
      const m = Number(p.m);
      if (!Number.isFinite(m) || m < 0 || m > MAX_MARGIN) return Response.json({ error: st + ": the margin must be a number of points between 0 and " + MAX_MARGIN }, { status: 400 });
      clean[st] = { w: p.w, m: r1(m) };
    }
    const cal = body.cal === "fw" ? "fw" : body.cal === "sept" ? "sept" : null;   // which rules the person had the board on when they saved
    const dems = HELD_ELSEWHERE + STATES.filter(st => clean[st].w === "D").length;
    const old = await s.get(key, { type: "json" });
    const entry = { ts: new Date().toISOString(), picks: clean, cal, dems, reps: 100 - dems, verdict: dems >= NEED ? "D" : "R" };
    if (kind === "dayBefore") {
      // Keeps the original call untouched; a person may add a day-before call even without an original one.
      const rec = { ...(old || { call: null, changes: 0, previous: [] }), ...who(user), dayBefore: entry, dayBeforeChanges: old && old.dayBefore ? (old.dayBeforeChanges || 0) + 1 : 0 };
      await s.setJSON(key, rec);
      const { previous, ...out } = rec;
      return Response.json({ saved: true, kind, replaced: !!(old && old.dayBefore), record: out });
    }
    const rec = { ...(old || {}), ...who(user), call: entry, changes: old && old.call ? (old.changes || 0) + 1 : 0, previous: old && old.call ? [...(old.previous || []).slice(-19), old.call] : [] };
    await s.setJSON(key, rec);
    const { previous, ...out } = rec;
    return Response.json({ saved: true, kind, replaced: !!(old && old.call), record: out });
  }

  if (req.method === "DELETE") {
    const rec = await s.get(key, { type: "json" });
    if (!rec || !rec.call) return Response.json({ error: "you have no call to delete" }, { status: 404 });
    if (rec.dayBefore) { const { call, changes, previous, ...rest } = rec; await s.setJSON(key, { ...rest, call: null, changes: 0, previous: [] }); }   // keep the day-before call
    else await s.delete(key);
    return Response.json({ deleted: true });
  }

  if (req.method === "GET") {
    const [{ blobs }, results] = await Promise.all([s.list({ prefix: "calls/" }), loadResults(s)]);
    const recs = await Promise.all(blobs.map(b => s.get(b.key, { type: "json" })));
    const res = results.states;
    const haveResults = Object.keys(res).length > 0;
    const calls = recs.filter(r => r && (r.call || r.dayBefore) && r.id !== CLAUDE_ID).map(r => ({ id: r.id, name: r.name, picture: r.picture, call: r.call || null, changes: r.changes || 0,
      dayBefore: r.dayBefore || null, dayBeforeChanges: r.dayBeforeChanges || 0,
      score: haveResults && r.call ? score(r.call.picks, res, STATES) : null, dayBeforeScore: haveResults && r.dayBefore ? score(r.dayBefore.picks, res, STATES) : null }));
    // Claude's call lives in code (../lib/claude-call.mjs) and is not subject to the deadline. Friends see it only once the admin
    // turns the showClaude switch on; the admin always sees it, flagged hiddenFromFriends while the switch is off.
    const settings = await readSettings(s);
    const showClaude = settings.showClaude === true;
    if (showClaude || isAdmin) {
      const c = claudeRecord(results);
      c.hiddenFromFriends = !showClaude;
      calls.push(c);
    }
    const latest = c => (c.dayBefore && (!c.call || c.dayBefore.ts > c.call.ts)) ? c.dayBefore.ts : (c.call ? c.call.ts : "");
    // People without an original call (day-before only) have no score and sort last on the leaderboard.
    if (haveResults) calls.sort((a, b) => ((b.score ? b.score.right : -1) - (a.score ? a.score.right : -1)) || ((a.score ? a.score.err : 1e9) - (b.score ? b.score.err : 1e9)) || (latest(a) < latest(b) ? -1 : 1));
    else calls.sort((a, b) => latest(a) < latest(b) ? 1 : latest(a) > latest(b) ? -1 : 0);
    if (haveResults) { let rank = 0, prevKey = null; calls.forEach((c, i) => { if (!c.score) return; const k = c.score.right + "|" + c.score.err; if (k !== prevKey) { rank = i + 1; prevKey = k; } c.rank = rank; }); }
    const body = { me: user.id, admin: isAdmin, deadline: DEADLINE, deadlineText: DEADLINE_TEXT, locked: locked(), maxMargin: MAX_MARGIN, results: res, resultsUpdated: results.updated, resultsOpen: results.open, electionDayText: ELECTION_DAY_TEXT, showClaude, dayBeforeOpen: dayBeforeOpen(), dayBeforeOpensAt: DAYBEFORE_OPEN, dayBeforeClosesAt: DAYBEFORE_CLOSE, dayBeforeText: DAYBEFORE_TEXT, calls };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
  }
  return Response.json({ error: "method" }, { status: 405 });
};

export const config = { path: "/api/calls", method: ["GET", "POST", "DELETE"] };
