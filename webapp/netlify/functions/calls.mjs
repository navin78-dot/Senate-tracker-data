// /api/calls — each friend's Senate call: ONE call per person. Saving again replaces the previous call.
// GET returns everyone's current call (plus scores once results exist). POST saves or replaces yours. DELETE removes yours.
// Every change is refused after the deadline in ../lib/rules.mjs.
import { getUser } from "@netlify/identity";
import { store } from "../lib/store.mjs";
import { STATES } from "../lib/model.mjs";
import { HELD_ELSEWHERE } from "../lib/board.mjs";
import { DEADLINE, DEADLINE_TEXT, ADMIN_EMAILS, MAX_MARGIN, NEED, locked, score } from "../lib/rules.mjs";
import { loadResults, ELECTION_DAY_TEXT } from "../lib/results.mjs";

function who(user){ return { id: user.id, name: user.name || user.userMetadata?.full_name || (user.email ? user.email.split("@")[0] : "friend"), picture: user.pictureUrl || null }; }
const r1 = v => Math.round(v * 10) / 10;

export default async (req, context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const s = store();
  const key = "calls/" + user.id;
  const isAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());

  if (req.method === "POST" || req.method === "DELETE") {
    if (locked()) return Response.json({ error: "Calls locked at " + DEADLINE_TEXT + ". No more changes." }, { status: 403 });
  }

  if (req.method === "POST") {
    let body; try { body = await req.json(); } catch { return Response.json({ error: "bad JSON" }, { status: 400 }); }
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
    const rec = { ...who(user), call: { ts: new Date().toISOString(), picks: clean, cal, dems, reps: 100 - dems, verdict: dems >= NEED ? "D" : "R" }, changes: old && old.call ? (old.changes || 0) + 1 : 0, previous: old && old.call ? [...(old.previous || []).slice(-19), old.call] : [] };
    await s.setJSON(key, rec);
    const { previous, ...out } = rec;
    return Response.json({ saved: true, replaced: !!(old && old.call), record: out });
  }

  if (req.method === "DELETE") {
    const rec = await s.get(key, { type: "json" });
    if (!rec || !rec.call) return Response.json({ error: "you have no call to delete" }, { status: 404 });
    await s.delete(key);
    return Response.json({ deleted: true });
  }

  if (req.method === "GET") {
    const [{ blobs }, results] = await Promise.all([s.list({ prefix: "calls/" }), loadResults(s)]);
    const recs = await Promise.all(blobs.map(b => s.get(b.key, { type: "json" })));
    const res = results.states;
    const haveResults = Object.keys(res).length > 0;
    const calls = recs.filter(r => r && r.call).map(r => ({ id: r.id, name: r.name, picture: r.picture, call: r.call, changes: r.changes || 0, score: haveResults ? score(r.call.picks, res, STATES) : null }));
    if (haveResults) calls.sort((a, b) => (b.score.right - a.score.right) || (a.score.err - b.score.err) || (a.call.ts < b.call.ts ? -1 : 1));
    else calls.sort((a, b) => a.call.ts < b.call.ts ? 1 : a.call.ts > b.call.ts ? -1 : 0);
    if (haveResults) { let rank = 0, prevKey = null; calls.forEach((c, i) => { const k = c.score.right + "|" + c.score.err; if (k !== prevKey) { rank = i + 1; prevKey = k; } c.rank = rank; }); }
    const body = { me: user.id, admin: isAdmin, deadline: DEADLINE, deadlineText: DEADLINE_TEXT, locked: locked(), maxMargin: MAX_MARGIN, results: res, resultsUpdated: results.updated, resultsOpen: results.open, electionDayText: ELECTION_DAY_TEXT, calls };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
  }
  return Response.json({ error: "method" }, { status: 405 });
};

export const config = { path: "/api/calls", method: ["GET", "POST", "DELETE"] };
