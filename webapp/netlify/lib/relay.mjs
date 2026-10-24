// Reads Navin's relay repo (github.com/navin78-dot/Senate-tracker-data) the same way read_relay.py does:
// the RCP average row of each state's polling_data.json, the counted polls under it, Polymarket prices
// matched by the Democrat's name, and the Senate-control price = "Democrats Sweep" + "D Senate, R House".
import { STATES, DEM } from "./model.mjs";

const RAW = "https://raw.githubusercontent.com/navin78-dot/Senate-tracker-data/main/";

export function r1(v){ return Math.round(Number(v)*10+1e-9)/10; }
export function r0(v){ return Math.round(Number(v)+1e-9); }

export function parseRcp(json){
  const rows=json.poll; const avg=rows[0];
  if(!avg || avg.type!=="rcp_average") throw new Error("no rcp_average row");
  const dem=avg.candidate.find(c=>c.affiliation==="Democrat"), rep=avg.candidate.find(c=>c.affiliation==="Republican");
  if(!dem||!rep) throw new Error("average row missing a D or R candidate");
  const counted=rows.slice(1).filter(x=>x.type==="poll_rcp_avg");
  const di=avg.candidate.indexOf(dem), ri=avg.candidate.indexOf(rep);
  const md=counted.reduce((s,x)=>s+Number(x.candidate[di].value),0)/counted.length;
  const mr=counted.reduce((s,x)=>s+Number(x.candidate[ri].value),0)/counted.length;
  return {
    d:Number(dem.value), r:Number(rep.value), dName:dem.name, rName:rep.name, window:avg.date,
    arithmeticOk: r1(md)===Number(dem.value) && r1(mr)===Number(rep.value),
    polls: counted.map(x=>({pollster:x.pollster, date:x.date, end:x.data_end_date, sample:x.sampleSize, d:Number(x.candidate[di].value), r:Number(x.candidate[ri].value)})),
    totalListed: rows.length-1
  };
}

export function parsePolymarket(json, st){
  if(!Array.isArray(json)||!json.length) return null;
  const ev=json[0]; const want=DEM[st].toLowerCase();
  for(const mk of ev.markets||[]){
    const t=(mk.groupItemTitle||mk.question||"").toLowerCase();
    if(t.includes(want) && mk.outcomePrices){
      const pr=typeof mk.outcomePrices==="string"?JSON.parse(mk.outcomePrices):mk.outcomePrices;
      return {price:r0(Number(pr[0])*100), volume:Number(mk.volume||0), updatedAt:ev.updatedAt, title:mk.groupItemTitle||mk.question};
    }
  }
  return null;
}

export function parseControl(json){
  const c=json[0]; const g={};
  for(const m of c.markets||[]){ const pr=typeof m.outcomePrices==="string"?JSON.parse(m.outcomePrices):m.outcomePrices; if(pr) g[m.groupItemTitle||""]=Number(pr[0]); }
  const sweep=g["Democrats Sweep"]||0, split=g["D Senate, R House"]||0;
  return {price:r0((sweep+split)*100), sweep, split, updatedAt:c.updatedAt};
}

// load(path) -> parsed JSON. In production it is a fetch of raw.githubusercontent.com; tests pass a file reader.
export async function readRelay(load){
  const man=await load("data/manifest.json");
  const out={fetchedAt:man.fetched_at_utc, failedFetches:Object.entries(man.items).filter(([k,v])=>!v.ok).map(([k])=>k), races:{}, problems:[]};
  await Promise.all(STATES.map(async st=>{
    const race={};
    try{ Object.assign(race, parseRcp(await load(`data/latest/rcp/${st}.json`))); }
    catch(e){ out.problems.push(`${st}: RCP file unreadable (${e.message})`); }
    try{ const pm=parsePolymarket(await load(`data/latest/polymarket/${st}.json`), st); if(pm){ race.mkt=pm.price; race.mktVolume=pm.volume; race.mktUpdated=pm.updatedAt; } else out.problems.push(`${st}: no Polymarket market matched ${DEM[st]}`); }
    catch(e){ out.problems.push(`${st}: Polymarket file unreadable (${e.message})`); }
    out.races[st]=race;
  }));
  try{ const c=parseControl(await load("data/latest/polymarket/CONTROL.json")); out.senateMkt=c.price; out.controlUpdated=c.updatedAt; }
  catch(e){ out.problems.push("CONTROL: Polymarket control file unreadable ("+e.message+")"); }
  return out;
}

export async function fetchJson(path){
  const res=await fetch(RAW+path, {headers:{"cache-control":"no-cache"}});
  if(!res.ok) throw new Error(`${res.status} fetching ${path}`);
  return res.json();
}
