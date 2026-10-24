// Shared read/refresh logic for the board blob store. One store, a few keys:
//   latest            full board for the newest relay snapshot
//   snap/<fetchedAt>  compact trend point per snapshot (written once, onlyIfNew)
//   trend             all compact points, rebuilt incrementally by the scheduled refresh (single writer)
//   calls/<userId>    one friend's profile and the log of every call they saved
import { getStore } from "@netlify/blobs";
import { readRelay, fetchJson } from "./relay.mjs";
import { buildBoard, compact } from "./board.mjs";

export const STORE = "senate-board";
export const STALE_MS = 25*60*1000;

export function store(){ return getStore({ name: STORE, consistency: "strong" }); }

// Returns the latest board, re-reading the relay when the cached one is missing or older than STALE_MS.
export async function latestBoard(s, { force=false } = {}){
  const cached = await s.get("latest", { type: "json" });
  const fresh = cached && (Date.now() - Date.parse(cached.computedAt)) < STALE_MS;
  if (cached && fresh && !force) return { board: cached, refreshed: false };
  let relay;
  try { relay = await readRelay(fetchJson); }
  catch (e) {
    if (cached) return { board: { ...cached, relayError: String(e.message||e) }, refreshed: false };
    throw e;
  }
  if (cached && cached.fetchedAt === relay.fetchedAt) {
    const b = { ...cached, computedAt: new Date().toISOString() };   // nothing new upstream; just mark it checked
    await s.setJSON("latest", b);
    return { board: b, refreshed: false };
  }
  const board = buildBoard(relay, cached);
  await s.setJSON("latest", board);
  await s.setJSON("snap/" + board.fetchedAt, compact(board), { onlyIfNew: true });
  return { board, refreshed: true };
}

// Adds any snap/ points the trend blob lacks. Only the scheduled function calls this.
export async function rebuildTrend(s){
  const trend = (await s.get("trend", { type: "json" })) || [];
  const have = new Set(trend.map(p => p.ts));
  const { blobs } = await s.list({ prefix: "snap/" });
  const missing = blobs.map(b => b.key).filter(k => !have.has(k.slice(5)));
  for (const k of missing) { const p = await s.get(k, { type: "json" }); if (p) trend.push(p); }
  trend.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  if (missing.length) await s.setJSON("trend", trend);
  return { trend, added: missing.length };
}
