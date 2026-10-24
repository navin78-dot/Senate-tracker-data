// Senate tracker model, ported from senate_model.py (Sept 5, 2026 rules; two calibrations since Oct 18).
// Inputs: per-race D%, R%, market price; outputs: the four tables under both calibrations and the
// chance Democrats win 8+ of 11, computed exactly (numerical integration over the shared national
// swing + Poisson-binomial over races) instead of the Python script's 400,000-draw Monte Carlo.
export const STATES = ["NC","GA","NH","TX","OH","AK","ME","MI","IA","KS","MN"];
export const NAMES = {NC:"North Carolina",GA:"Georgia",NH:"New Hampshire",TX:"Texas",OH:"Ohio",AK:"Alaska",ME:"Maine",MI:"Michigan",IA:"Iowa",KS:"Kansas",MN:"Minnesota"};
export const DEM = {NC:"Cooper",GA:"Ossoff",NH:"Pappas",TX:"Talarico",OH:"Brown",AK:"Peltola",ME:"Jackson",MI:"El-Sayed",IA:"Turek",KS:"Hamilton",MN:"Flanagan"};
export const REP = {NC:"Whatley",GA:"Collins",NH:"Sununu",TX:"Paxton",OH:"Husted",AK:"Sullivan",ME:"Collins",MI:"Rogers",IA:"Hinson",KS:"Marshall",MN:"Tafoya"};
export const HELD = {OH:"R",TX:"R",AK:"R",ME:"R",NC:"R",IA:"R",KS:"R",MI:"D",NH:"D",GA:"D",MN:"D"};
export const BASELINE = {NC:8.0,GA:7.5,NH:2.0,TX:2.4,OH:2.6,AK:2.0,ME:2.3,MI:2.3,IA:-1.8,KS:-1.5,MN:5.0};
export const MKT_BASE = {NC:92,GA:94,NH:83,TX:51,OH:56,AK:64,ME:70,MI:66,IA:37,KS:27,MN:93};
export const SENATE_MKT_BASE = 50;
export const LEAN24 = {TX:13.68,OH:11.21,AK:13.13,IA:13.21,NC:3.21,GA:2.20,NH:-2.78,MI:1.42,ME:-6.94,KS:16.12,MN:-4.24};
const LEAN_A=0.60, LEAN_B=0.251, FLAT=1.5, FLAT_FW=0.82, LEAN_A_FW=0.33, LEAN_B_FW=0.139;
const STATE_ERR = {AK:8.0,ME:7.2,OH:6.4,MI:6.2,IA:5.8,NC:3.9,GA:0.8,TX:0.5,NH:-0.4,KS:5.4,MN:0.6};
const EARLY = [[2.5,0.8],[7.5,2.0],[12.5,3.1],[17.5,6.1]];
const SHRINK=0.75, SIGMA=5.0, NAT=4.0, IDIO=3.0, NEED=8, HELD_ELSEWHERE=43;

export function r1(v){ return Math.round(v*10+1e-9)/10; }
function bucket(u){ const t=EARLY; if(u<=t[0][0]) return t[0][1]; if(u>=t[t.length-1][0]) return t[t.length-1][1];
  for(let i=0;i<t.length-1;i++){ const [x0,y0]=t[i],[x1,y1]=t[i+1]; if(x0<=u&&u<=x1) return y0+(y1-y0)*(u-x0)/(x1-x0); } return t[t.length-1][1]; }
function governing(st,u){ const b=bucket(u), s=STATE_ERR[st]; return ((s<0)!==(b<0))?s:b; }
function fadeFor(mode,st,u){
  switch(mode){
    case "raw": return 0;
    case "asis": return -SHRINK*governing(st,u);
    case "flat": return -FLAT;
    case "lean": return -(LEAN_A+LEAN_B*LEAN24[st]);
    case "blend": return -(FLAT+(LEAN_A+LEAN_B*LEAN24[st]))/2;
    case "flat_fw": return -FLAT_FW;
    case "lean_fw": return -(LEAN_A_FW+LEAN_B_FW*LEAN24[st]);
    case "blend_fw": return -(FLAT_FW+(LEAN_A_FW+LEAN_B_FW*LEAN24[st]))/2;
  }
  throw new Error("mode "+mode);
}
// standard normal cdf (Abramowitz-Stegun 7.1.26 via erf), accurate to ~1e-7
export function Phi(x){ const t=1/(1+0.3275911*Math.abs(x)/Math.SQRT2); const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x/2); return 0.5*(1+(x<0?-y:y)); }
// P(Democrats win >= NEED of the races) given adjusted margins a[], exactly:
// shared swing n ~ N(0,NAT): integrate over n on a fine grid; given n, race i wins with p_i = Phi((a_i+n)/IDIO),
// independent -> Poisson-binomial DP.
export function controlChance(adj){
  const n=adj.length; let total=0, wsum=0;
  const K=801, lim=6*NAT;
  for(let k=0;k<K;k++){
    const x=-lim+2*lim*k/(K-1); const w=Math.exp(-x*x/(2*NAT*NAT));
    let dp=new Array(n+1).fill(0); dp[0]=1;
    for(let i=0;i<n;i++){ const p=Phi((adj[i]+x)/IDIO); const nd=new Array(n+1).fill(0);
      for(let j=0;j<=i;j++){ nd[j]+=dp[j]*(1-p); nd[j+1]+=dp[j]*p; } dp=nd; }
    let pw=0; for(let j=NEED;j<=n;j++) pw+=dp[j];
    total+=w*pw; wsum+=w;
  }
  return 100*total/wsum;
}
const MODES = ["raw","asis","flat","lean","blend","flat_fw","lean_fw","blend_fw"];
// today: {ST:{d,r,mkt}}, senateMkt: number
export function compute(today, senateMkt){
  const out={races:{}, ctrl:{}, senateMkt, generated:new Date().toISOString()};
  const adjBy={}; MODES.forEach(m=>adjBy[m]=[]);
  for(const st of STATES){
    const {d,r,mkt}=today[st]; const m=r1(d-r), u=r1(100-d-r);
    const row={st,d,r,m,u,mkt,drift:r1(m-BASELINE[st]),mktMove:mkt-MKT_BASE[st],override:(governing(st,u)!==bucket(u)),modes:{}};
    for(const mode of MODES){ const f=fadeFor(mode,st,u); const a=m+f; row.modes[mode]={fade:f,adj:a,win:Phi(a/SIGMA)*100}; adjBy[mode].push(a); }
    out.races[st]=row;
  }
  for(const mode of MODES){ out.ctrl[mode]={chance:controlChance(adjBy[mode]), exp:STATES.reduce((s,st)=>s+out.races[st].modes[mode].win/100,0), dems:HELD_ELSEWHERE+adjBy[mode].filter(a=>a>0).length}; }
  out.ctrl.market=senateMkt; out.ctrl.marketMove=senateMkt-SENATE_MKT_BASE;
  return out;
}
