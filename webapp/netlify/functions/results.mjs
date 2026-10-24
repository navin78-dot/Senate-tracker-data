// /api/results — the actual results, entered by Navin as each race is called. Everyone signed in can read them;
// only the admin emails in ../lib/rules.mjs can write. Body for POST: { states: { TX: { w: "R", m: 3.4 }, ... } } (partial is fine);
// a state sent as null is removed (in case a call is retracted).
import { getUser } from "@netlify/identity";
import { store } from "../lib/store.mjs";
import { STATES } from "../lib/model.mjs";
import { ADMIN_EMAILS, MAX_MARGIN } from "../lib/rules.mjs";

export default async (req, context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const s = store();
  if (req.method === "GET") {
    const r = await s.get("results", { type: "json" });
    return Response.json({ states: (r && r.states) || {}, updated: r ? r.updated : null });
  }
  if (req.method === "POST") {
    if (!ADMIN_EMAILS.includes((user.email || "").toLowerCase())) return Response.json({ error: "only Navin can enter results" }, { status: 403 });
    let body; try { body = await req.json(); } catch { return Response.json({ error: "bad JSON" }, { status: 400 }); }
    const cur = (await s.get("results", { type: "json" })) || { states: {} };
    const states = { ...cur.states };
    for (const [st, v] of Object.entries(body.states || {})) {
      if (!STATES.includes(st)) continue;
      if (v === null) { delete states[st]; continue; }
      const m = Number(v.m);
      if ((v.w !== "D" && v.w !== "R") || !Number.isFinite(m) || m < 0 || m > MAX_MARGIN) return Response.json({ error: st + ": winner must be D or R and margin a number of points between 0 and " + MAX_MARGIN }, { status: 400 });
      states[st] = { w: v.w, m: Math.round(m * 10) / 10 };
    }
    const rec = { states, updated: new Date().toISOString(), by: user.email };
    await s.setJSON("results", rec);
    return Response.json({ saved: true, states, updated: rec.updated });
  }
  return Response.json({ error: "method" }, { status: 405 });
};

export const config = { path: "/api/results", method: ["GET", "POST"] };
