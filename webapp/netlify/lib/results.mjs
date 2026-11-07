// The actual results, one entry per race once it is called. Nothing is typed into the site: after Election Day
// Navin asks Claude to scan the called races, the scan is written into RESULTS below, committed and deployed,
// and the leaderboard updates on its own. Until RESULTS_OPEN the Results card on the site is greyed out.
// Shape: { TX: { w: "R", m: 3.4 }, ... }  w = winner's party, m = the winner's margin in points.
export const ELECTION_DAY_TEXT = "Tuesday, November 3";
export const RESULTS_OPEN = "2026-11-04T05:00:00Z";    // midnight Eastern at the end of Election Day (EST)
// Published to friends on November 6, 2026 (evening ET). Ten races; Alaska is added when called. Stage of count noted per race.
export const RESULTS_UPDATED = "2026-11-07T13:30:00Z";
export const RESULTS = {
  NC: { w: "D", m: 19.6 },   // Cooper
  GA: { w: "D", m: 18.1 },   // Ossoff
  NH: { w: "D", m: 13.7 },   // Pappas; NBC tally Nov 6 (55.9–42.2), later than the 90% AP snapshot that gave 14.3
  TX: { w: "D", m: 12.1 },   // Talarico
  MN: { w: "D", m: 10.1 },   // Flanagan
  ME: { w: "D", m: 6.3 },    // Jackson, won on first choices, no ranked-choice round; NBC at 93.6% (53.1–46.8), earlier 93% gave 6.4
  MI: { w: "D", m: 7.0 },    // El-Sayed
  KS: { w: "D", m: 4.9 },    // Hamilton; Kansas Secretary of State unofficial count, all 4,168 precincts (556,414 to 503,230)
  IA: { w: "D", m: 4.7 },    // Turek
  OH: { w: "D", m: 4.8 }     // Brown; Ohio Secretary of State final unofficial count, 50.0–45.2 per NBC (was 2.1 at 87% reporting)
};

// Preview results: the same shape, but handed only to the admin (friends never receive them), so Navin can see the
// leaderboard before the results are made public. To publish, move entries from RESULTS_PREVIEW into RESULTS above.
// First scan November 5, 2026; refreshed by the twice-daily scan. Ten races called, Alaska still counting (ranked-choice
// tabulation expected Nov 18). Margins are the leader's margin in points from the most complete count found; stage noted per race.
export const RESULTS_PREVIEW_UPDATED = null;
export const RESULTS_PREVIEW = {};

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
