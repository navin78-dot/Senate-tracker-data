// The actual results, one entry per race once it is called. Nothing is typed into the site: after Election Day
// Navin asks Claude to scan the called races, the scan is written into RESULTS below, committed and deployed,
// and the leaderboard updates on its own. Until RESULTS_OPEN the Results card on the site is greyed out.
// Shape: { TX: { w: "R", m: 3.4 }, ... }  w = winner's party, m = the winner's margin in points.
export const ELECTION_DAY_TEXT = "Tuesday, November 3";
export const RESULTS_OPEN = "2026-11-04T05:00:00Z";    // midnight Eastern at the end of Election Day (EST)
export const RESULTS_UPDATED = null;                     // ISO time of the last scan, set when RESULTS is filled in
export const RESULTS = {};

export function resultsOpen(now = Date.now()) { return now >= Date.parse(RESULTS_OPEN); }

// Results = the committed scan above, plus anything in the blob key "results" for a race the scan has not covered.
export async function loadResults(s) {
  let blob = null; try { blob = await s.get("results", { type: "json" }); } catch {}
  const states = { ...((blob && blob.states) || {}), ...RESULTS };
  const updated = RESULTS_UPDATED || (blob ? blob.updated : null);
  return { states, updated, open: resultsOpen() };
}
