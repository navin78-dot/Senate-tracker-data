// Turns one relay read into the board the page shows, under both calibrations.
import { compute, STATES, NAMES, DEM, REP, HELD, BASELINE, MKT_BASE, SENATE_MKT_BASE, LEAN24, r1 } from "./model.mjs";

export const HELD_ELSEWHERE = 43;   // Democratic seats not among the 11 races
export const CAL = { sept: { ctrl: "blend", label: "September rules" }, fw: { ctrl: "blend_fw", label: "Last 3 weeks rules" } };

// Fallback inputs when a state's RCP or Polymarket file is unreadable: the previous board's values, flagged.
export function buildBoard(relay, previous){
  const problems=[...(relay.problems||[])];
  const today={}, carried=[];
  for(const st of STATES){
    const r=relay.races[st]||{}; const prev=previous?.races?.[st];
    let d=r.d, rr=r.r, mkt=r.mkt;
    if(!(d>0&&rr>0)){ if(prev){ d=prev.d; rr=prev.r; carried.push(st+" polls"); } else throw new Error("no RCP numbers for "+st+" and nothing to carry"); }
    if(!(mkt>=0)){ if(prev){ mkt=prev.mkt; carried.push(st+" market"); } else { mkt=MKT_BASE[st]; carried.push(st+" market (baseline)"); } }
    today[st]={d, r:rr, mkt};
  }
  let senateMkt=relay.senateMkt;
  if(!(senateMkt>=0)){ senateMkt=previous?.senateMkt ?? SENATE_MKT_BASE; carried.push("Senate control market"); }
  const o=compute(today, senateMkt);
  const races={};
  for(const st of STATES){
    const r=relay.races[st]||{}; const x=o.races[st];
    races[st]={
      st, name:NAMES[st], dem:DEM[st], rep:REP[st], held:HELD[st], trump24:LEAN24[st],
      d:x.d, r:x.r, m:x.m, u:x.u, mkt:x.mkt, mktBase:MKT_BASE[st], mktVolume:r.mktVolume??null, window:r.window||null,
      baseline:BASELINE[st], drift:x.drift, override:x.override,
      polls:(r.polls||[]).map(p=>({...p, m:r1(p.d-p.r)})), totalListed:r.totalListed??null, arithmeticOk:r.arithmeticOk??null,
      raw:{adj:x.m, win:Math.round(x.modes.raw.win)},
      T1:{fade:r1(x.modes.asis.fade), adj:r1(x.modes.asis.adj), win:Math.round(x.modes.asis.win)},
      sept:{fade:r1(x.modes.blend.fade), adj:r1(x.modes.blend.adj), win:Math.round(x.modes.blend.win), flat:r1(x.modes.flat.adj), lean:r1(x.modes.lean.adj)},
      fw:{fade:r1(x.modes.blend_fw.fade), adj:r1(x.modes.blend_fw.adj), win:Math.round(x.modes.blend_fw.win), flat:r1(x.modes.flat_fw.adj), lean:r1(x.modes.lean_fw.adj)}
    };
  }
  const seats=k=>{ const dems=HELD_ELSEWHERE+STATES.filter(st=>races[st][k].adj>0).length; return {dems, reps:100-dems}; };
  const expSeats=mode=>r1(HELD_ELSEWHERE+o.ctrl[mode].exp);
  return {
    fetchedAt:relay.fetchedAt, computedAt:new Date().toISOString(), problems, carried, failedFetches:relay.failedFetches||[],
    senateMkt, senateMktBase:SENATE_MKT_BASE,
    ctrl:{
      raw:Math.round(o.ctrl.raw.chance), T1:Math.round(o.ctrl.asis.chance), T2:Math.round(o.ctrl.flat.chance), T3:Math.round(o.ctrl.lean.chance), T4:Math.round(o.ctrl.blend.chance),
      T2fw:Math.round(o.ctrl.flat_fw.chance), T3fw:Math.round(o.ctrl.lean_fw.chance), T4fw:Math.round(o.ctrl.blend_fw.chance),
      sept:Math.round(o.ctrl.blend.chance), fw:Math.round(o.ctrl.blend_fw.chance), market:senateMkt,
      exact:{raw:o.ctrl.raw.chance, sept:o.ctrl.blend.chance, fw:o.ctrl.blend_fw.chance}
    },
    seats:{ raw:seats("raw"), sept:seats("sept"), fw:seats("fw"), expected:{raw:expSeats("raw"), sept:expSeats("blend"), fw:expSeats("blend_fw")}, need:51, heldElsewhere:HELD_ELSEWHERE },
    races
  };
}

// One compact trend point per relay snapshot.
export function compact(b){
  const states={}; for(const st of STATES){ const r=b.races[st]; states[st]={m:r.m, mkt:r.mkt, sept:r.sept.adj, fw:r.fw.adj}; }
  return { ts:b.fetchedAt, label:null, raw:b.ctrl.raw, T1:b.ctrl.T1, T2:b.ctrl.T2, T3:b.ctrl.T3, T4:b.ctrl.T4, mkt:b.senateMkt, T4fw:b.ctrl.T4fw, src:"site", states };
}
