// GET /api/board — the current board plus history, for signed-in friends only.
import { getUser } from "@netlify/identity";
import { store, latestBoard } from "../lib/store.mjs";
import { SEED_TREND, SEED_RCP } from "../lib/seed.mjs";
import { compact } from "../lib/board.mjs";

export default async (req, context) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const s = store();
  let board;
  try { ({ board } = await latestBoard(s)); }
  catch (e) { return Response.json({ error: "The relay could not be read and there is no cached board yet: " + (e.message || e) }, { status: 503 }); }
  const siteTrend = (await s.get("trend", { type: "json" })) || [];
  if (!siteTrend.some(p => p.ts === board.fetchedAt)) siteTrend.push(compact(board));
  const body = { board, trend: [...SEED_TREND, ...siteTrend], rcpSeed: SEED_RCP, me: { id: user.id, name: user.name || user.userMetadata?.full_name || user.email, picture: user.pictureUrl || null } };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
};

export const config = { path: "/api/board", method: ["GET"] };
