// Shared rules for the Call it page. Change DEADLINE here if Navin moves it.
export const DEADLINE = "2026-11-02T14:00:00Z";   // Monday Nov 2, 2026, 9:00am Eastern (EST; clocks went back Nov 1)
export const DEADLINE_TEXT = "Monday, November 2 at 9:00am ET";
export const ADMIN_EMAILS = ["navin78@gmail.com"];  // who may enter the actual results after each race is called
export const MAX_MARGIN = 40;                        // points; a predicted margin above this is rejected as a typo
export const NEED = 51;                              // Democrats need 51; 50-50 stays Republican (Vance breaks ties)

export function locked(now = Date.now()) { return now >= Date.parse(DEADLINE); }

// A pick is { w: "D"|"R", m: number } — winner and the winner's margin in points. Signed D margin: +m for D, -m for R.
export function signed(p) { return p.w === "D" ? p.m : -p.m; }

// Score one person's call against the results entered so far. Only states with a result count.
// right  = number of called states where the winner matched
// err    = sum of |predicted signed margin - actual signed margin| over called states (tie-breaker, lower is better)
export function score(picks, results, states) {
  let right = 0, err = 0, called = 0; const per = {};
  for (const st of states) {
    const a = results && results[st]; const p = picks && picks[st];
    if (!a || !p) continue;
    called++;
    const ok = p.w === a.w; if (ok) right++;
    const e = Math.abs(signed(p) - signed(a)); err += e;
    per[st] = { ok, err: Math.round(e * 10) / 10 };
  }
  return { right, err: Math.round(err * 10) / 10, called, per };
}
