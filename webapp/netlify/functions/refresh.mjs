// Scheduled: every 30 minutes (UTC), re-read the relay, store a new snapshot if there is one, extend the trend.
import { store, latestBoard, rebuildTrend } from "../lib/store.mjs";

export default async (req) => {
  const s = store();
  let note;
  try { const { board, refreshed } = await latestBoard(s, { force: true }); note = (refreshed ? "new snapshot " : "unchanged snapshot ") + board.fetchedAt; }
  catch (e) { note = "relay read failed: " + (e.message || e); }
  const { added } = await rebuildTrend(s);
  console.log("refresh:", note, "| trend points added:", added);
};

export const config = { schedule: "*/30 * * * *" };
