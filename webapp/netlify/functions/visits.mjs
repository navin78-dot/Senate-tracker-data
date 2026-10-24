// GET /api/visits — the visit log (email, name, time), newest first, plus a per-person summary. Navin only.
import { getUser } from "@netlify/identity";
import { store } from "../lib/store.mjs";
import { ADMIN_EMAILS } from "../lib/rules.mjs";

export default async (req, context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  if (!ADMIN_EMAILS.includes((user.email || "").toLowerCase())) return Response.json({ error: "only Navin can see the visit log" }, { status: 403 });
  const s = store();
  const { blobs } = await s.list({ prefix: "visits/" });
  const keys = blobs.map(b => b.key).sort().reverse().slice(0, 2000);     // newest first; the key starts with the timestamp
  const visits = (await Promise.all(keys.map(k => s.get(k, { type: "json" })))).filter(Boolean);
  const people = {};
  for (const v of visits) { const p = people[v.id] || (people[v.id] = { id: v.id, email: v.email, name: v.name, visits: 0, first: v.ts, last: v.ts }); p.visits++; if (v.ts < p.first) p.first = v.ts; if (v.ts > p.last) p.last = v.ts; if (!p.email && v.email) p.email = v.email; }
  const summary = Object.values(people).sort((a, b) => a.last < b.last ? 1 : -1);
  return new Response(JSON.stringify({ total: blobs.length, visits, summary }), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
};

export const config = { path: "/api/visits", method: ["GET"] };
