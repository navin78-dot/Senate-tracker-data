// /api/calls — each friend's Senate call. GET returns everyone's latest call and full history; POST saves a new version.
import { getUser } from "@netlify/identity";
import { store } from "../lib/store.mjs";
import { STATES } from "../lib/model.mjs";
import { HELD_ELSEWHERE } from "../lib/board.mjs";

const NEED = 51;   // 50-50 goes to the Republicans (Vice President Vance breaks the tie)

function who(user){ return { id: user.id, name: user.name || user.userMetadata?.full_name || (user.email ? user.email.split("@")[0] : "friend"), picture: user.pictureUrl || null }; }

export default async (req, context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const s = store();
  const key = "calls/" + user.id;

  if (req.method === "POST") {
    let body; try { body = await req.json(); } catch { return Response.json({ error: "bad JSON" }, { status: 400 }); }
    const picks = body && body.picks;
    if (!picks || typeof picks !== "object") return Response.json({ error: "picks missing" }, { status: 400 });
    const clean = {};
    for (const st of STATES) { const v = picks[st]; if (v !== "D" && v !== "R") return Response.json({ error: "every race needs a D or R pick; " + st + " is missing" }, { status: 400 }); clean[st] = v; }
    const dems = HELD_ELSEWHERE + STATES.filter(st => clean[st] === "D").length;
    const rec = (await s.get(key, { type: "json" })) || { ...who(user), log: [] };
    Object.assign(rec, who(user));
    const prev = rec.log.length ? rec.log[rec.log.length - 1] : null;
    const changed = prev ? STATES.filter(st => prev.picks[st] !== clean[st]) : STATES.slice();
    if (prev && !changed.length) return Response.json({ saved: false, reason: "same as your last call", record: rec });
    const note = typeof body.note === "string" ? body.note.slice(0, 140) : "";
    rec.log.push({ ts: new Date().toISOString(), picks: clean, dems, reps: 100 - dems, verdict: dems >= NEED ? "D" : "R", changed, note });
    await s.setJSON(key, rec);
    return Response.json({ saved: true, record: rec });
  }

  if (req.method === "GET") {
    const { blobs } = await s.list({ prefix: "calls/" });
    const recs = await Promise.all(blobs.map(b => s.get(b.key, { type: "json" })));
    const calls = recs.filter(Boolean).map(r => ({ id: r.id, name: r.name, picture: r.picture, log: r.log }));
    calls.sort((a, b) => { const ta = a.log[a.log.length-1]?.ts || "", tb = b.log[b.log.length-1]?.ts || ""; return ta < tb ? 1 : ta > tb ? -1 : 0; });
    return new Response(JSON.stringify({ me: user.id, calls }), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
  }
  return Response.json({ error: "method" }, { status: 405 });
};

export const config = { path: "/api/calls", method: ["GET", "POST"] };
