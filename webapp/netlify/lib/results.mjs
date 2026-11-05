// The actual results, one entry per race once it is called. Nothing is typed into the site: after Election Day
// Navin asks Claude to scan the called races, the scan is written into RESULTS below, committed and deployed,
// and the leaderboard updates on its own. Until RESULTS_OPEN the Results card on the site is greyed out.
// Shape: { TX: { w: "R", m: 3.4 }, ... }  w = winner's party, m = the winner's margin in points.
export const ELECTION_DAY_TEXT = "Tuesday, November 3";
export const RESULTS_OPEN = "2026-11-04T05:00:00Z";    // midnight Eastern at the end of Election Day (EST)
export const RESULTS_UPDATED = null;                     // ISO time of the last public scan, set when RESULTS is filled in
export const RESULTS = {};

// Preview results: the same shape, but handed only to the admin (friends never receive them), so Navin can see the
// leaderboard before the results are made public. To publish, move entries from RESULTS_PREVIEW into RESULTS above.
// Scan of November 5, 2026, morning: ten races called, Alaska still counting (ranked-choice tabulation expected Nov 18).
// Margins are the leader's margin in points from near-complete counts; Ohio is from the count at 87% reporting.
export const RESULTS_PREVIEW_UPDATED = "2026-11-05T13:30:00Z";
export const RESULTS_PREVIEW = {
  NC: { w: "D", m: 19.6 },   // Cooper
  GA: { w: "D", m: 18.1 },   // Ossoff
  NH: { w: "D", m: 14.3 },   // Pappas
  TX: { w: "D", m: 12.1 },   // Talarico
  MN: { w: "D", m: 10.1 },   // Flanagan
  ME: { w: "D", m: 7.2 },    // Jackson, won on first choices; no ranked-choice round
  MI: { w: "D", m: 7.0 },    // El-Sayed
  KS: { w: "D", m: 4.8 },    // Hamilton
  IA: { w: "D", m: 4.7 },    // Turek
  OH: { w: "D", m: 2.1 }     // Brown
};

export function resultsOpen(now = Date.now()) { return now >= Date.parse(RESULTS_OPEN); }

// Results = the committed scan above, plus anything in the blob key "results" for a race the scan has not covered.
// With admin: true, the preview set is layered in as well (for races not yet public) and the answer says so.
export async function loadResults(s, { admin = false } = {}) {
  let blob = null; try { blob = await s.get("results", { type: "json" }); } catch {}
  const pub = { ...((blob && blob.states) || {}), ...RESULTS };
  let states = pub, updated = RESULTS_UPDATED || (blob ? blob.updated : null), preview = false, previewStates = [];
  if (admin) {
    previewStates = Object.keys(RESULTS_PREVIEW).filter(st => !pub[st]);
    if (previewStates.length) { states = { ...RESULTS_PREVIEW, ...pub }; preview = true; updated = RESULTS_PREVIEW_UPDATED || updated; }
  }
  return { states, updated, open: resultsOpen(), preview, previewStates };
}
