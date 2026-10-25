// Claude's call, made Sunday October 25, 2026 in Navin's Cowork thread. It lives in code so nobody can save over it;
// to change it, change this file. Margins are the winner's margin in points; Maine and Alaska are final-round
// ranked-choice margins. "chance" is the chance Claude put on the named winner.
import { STATES } from "./model.mjs";
import { HELD_ELSEWHERE } from "./board.mjs";
import { NEED, score } from "./rules.mjs";

export const CLAUDE_ID = "claude";
export const CLAUDE_CALL = {
  madeAt: "2026-10-25T16:30:00Z",
  note: "Each margin is the middle of Claude's own range for that race, and the winner is whoever that midpoint favors. Not tuned to beat anyone.",
  picks: {
    NC: { w: "D", m: 8,   chance: 95, why: "Ten-point lead and the best-known candidate on the board; two points shaved because North Carolina polls ran four too Democratic in 2020." },
    GA: { w: "D", m: 7,   chance: 92, why: "Eight-point lead, incumbent, weak opponent; Georgia polls undersold Warnock in 2022, so only a one-point shave." },
    NH: { w: "D", m: 7,   chance: 92, why: "Six and a half in the polls; New Hampshire polls missed toward Republicans by nearly eight in 2022, so a little is added, not shaved." },
    MN: { w: "D", m: 5,   chance: 82, why: "Only +3.4 on a thin set of polls, but ten points undecided in a Harris +4 state in a D+8 year mostly breaks her way." },
    MI: { w: "D", m: 2,   chance: 62, why: "+1.9 in the polls; Rogers already lost in a better Republican year; Michigan polls undersold Democrats in 2022 and oversold them in 2024, so it stays near the average." },
    OH: { w: "D", m: 1,   chance: 55, why: "+3.3 in the polls, but Ohio moved four to five points toward Republicans from ten days out in 2022 and 2024; Brown's personal pull keeps him a hair ahead." },
    TX: { w: "D", m: 0.5, chance: 52, why: "A coin flip. Polls +1.5 with two recent ties; Texas polls have been nearly unbiased on average; Paxton is the weaker nominee; the early vote has not separated them." },
    AK: { w: "R", m: 1,   chance: 55, why: "Polls +1.2 for Peltola on five polls, but Alaska has the worst record on the board for overstating Democrats; Peltola's crossover appeal is why it is only one point." },
    ME: { w: "R", m: 2.5, chance: 60, why: "Jackson +1.4 with few undecided, but Maine pollsters have understated Collins in three straight cycles, by 13 points in 2020." },
    IA: { w: "R", m: 4,   chance: 75, why: "Hinson +0.6; Iowa polls ran four to five points too Democratic in 2018, 2020 and 2022, and it is the one race where undecided is not falling." },
    KS: { w: "R", m: 5,   chance: 80, why: "Nearly even in six polls, but Kansas Senate polls missed toward Democrats by 7 in 2020 and 11 in 2014; Trump +16 and an incumbent." }
  }
};

// The same shape as a friend's record in /api/calls, so the page can render it with the others.
export function claudeRecord(results) {
  const picks = {}; for (const st of STATES) picks[st] = { w: CLAUDE_CALL.picks[st].w, m: CLAUDE_CALL.picks[st].m };
  const dems = HELD_ELSEWHERE + STATES.filter(st => picks[st].w === "D").length;
  const res = (results && results.states) || {};
  return {
    id: CLAUDE_ID, name: "Claude", picture: null, isClaude: true, changes: 0,
    call: { ts: CLAUDE_CALL.madeAt, picks, dems, reps: 100 - dems, verdict: dems >= NEED ? "D" : "R" },
    detail: { note: CLAUDE_CALL.note, chance: Object.fromEntries(STATES.map(st => [st, CLAUDE_CALL.picks[st].chance])), why: Object.fromEntries(STATES.map(st => [st, CLAUDE_CALL.picks[st].why])) },
    score: Object.keys(res).length ? score(picks, res, STATES) : null
  };
}
