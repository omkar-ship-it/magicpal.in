// v4: story + this-or-that + prioritise (push up/down) + agree/don't + sliders
//     + adaptive double-checks + duel. Same respondent model as v2/v3.
const B = require("./model.cjs");
const T = B.T; const v = (o) => T.map((k) => o[k] ?? 0);
const dot = B.dot, norm = B.norm;
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const BETA = 1.3;
const one = (k, s = 1) => v({ [k]: s });
const STORY = [
  [one("O"), one("S"), one("E"), one("I")], [one("O"), one("I"), one("A"), one("C")], [one("E"), one("C"), one("E",-1), one("A")],
  [v({A:1,H:-1}), one("I"), one("C"), one("H")], [one("D"), one("S"), one("O"), one("E")], [one("A"), one("H"), one("O"), one("I")], [one("S"), one("D"), one("C"), one("I")],
];
const PAIRS = T.map((k) => one(k));
// Prioritise: rank 5 cards, 3 rounds; every trait appears at least once, most twice.
const RANK = [
  [one("O"), one("D"), one("C"), one("E"), one("S")],
  [one("I"), one("A"), one("H"), one("D"), one("O")],
  [one("S"), one("E"), one("A"), one("C"), one("I"), ].concat(process.env.RANK6 ? [one("H")] : []),
];
const AGREE = (n) => { const out = []; for (let i = 0; i < n; i++) { const k = T[i % 8]; out.push(one(k, i % 2 === 0 ? 1 : (Math.floor(i / 8) % 2 ? 1 : -1))); } return out; };
const AGREE_N = Number(process.env.AGREE ?? 16);
const AGREES = AGREE(AGREE_N);
const SLIDERS = [one("D"), one("S"), one("H",-1), one("A"), one("E"), one("C")];
const CHECKS = Number(process.env.CHECKS ?? 6);
const MODE = process.env.MODE ?? "v4";

const CARELESS = Number(process.env.CARELESS ?? 0);
const rnd = (n) => Math.floor(Math.random()*n);
function respond(t) {
  const pick = (opts) => { if (Math.random() < CARELESS) return rnd(opts.length); const w = opts.map(o => Math.exp(BETA*dot(o,t)+0.35*gauss())); let r=Math.random()*w.reduce((a,b)=>a+b); for (let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i;} return w.length-1; };
  const agreeOn = (l) => Math.random() < CARELESS ? rnd(2) : (dot(l,t)/norm(l) + 0.8*gauss()) > 0 ? 1 : 0;
  return {
    story: STORY.map(pick),
    pairs: PAIRS.map(agreeOn),
    rank: RANK.map(cards => cards.map((c, i) => ({ i, u: Math.random() < CARELESS ? gauss()*2 : dot(c,t) + 0.6*gauss() })).sort((a,b) => b.u - a.u).map(x => x.i)),
    agree: AGREES.map(agreeOn),
    sliders: SLIDERS.map(l => Math.random() < CARELESS ? Math.random()*2-1 : Math.max(-1, Math.min(1, (dot(l,t) + 0.7*gauss()) / 2))),
    agreeOn,
  };
}
function raw(a, extra, only) {
  const s = T.map(()=>0), n = T.map(()=>0);
  const add = (l, val, w=1) => l.forEach((x,k) => { if (x) { n[k] += Math.abs(x)*w; s[k] += x*val*w; } });
  if (!only || only === 'choice') a.story.forEach((c,q) => STORY[q].forEach((o,i) => add(o, i===c ? 2 : 0)));
  if (!only || only === 'choice') a.pairs.forEach((c,q) => add(PAIRS[q], c ? 1 : -1));
  if (!only || only === 'choice') a.rank.forEach((order,q) => { const m = order.length; order.forEach((ci, pos) => add(RANK[q][ci], 1.5 - 3*pos/(m-1), 1)); });
  if (!only || only === 'level') a.agree.forEach((c,q) => add(AGREES[q], c ? 1 : -1));
  if (!only || only === 'level') a.sliders.forEach((x,q) => add(SLIDERS[q], x*1.8, 1.2));
  if (!only) for (const e of extra) add(e.l, e.c ? 1 : -1, 1.5);
  return s.map((x,k) => n[k] ? x/n[k] : 0);
}
let MU, SD;
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
function zOf(a, extra) { return raw(a, extra).map((x,k) => (x-MU[k])/SD[k]); }
const TARGET = process.env.TARGET ?? "contradiction";
let MUc, SDc, MUl, SDl;
/** Adaptive double-checks. "contradiction": re-ask the traits where the choice-style
 *  answers and the level-style answers disagree most. "split": the traits that
 *  separate the current top two archetypes. */
function doubleChecks(a) {
  const extra = [];
  if (TARGET === "contradiction") {
    const zc = raw(a, [], 'choice').map((x,k)=>(x-MUc[k])/SDc[k]), zl = raw(a, [], 'level').map((x,k)=>(x-MUl[k])/SDl[k]);
    const order = T.map((key,i)=>({ key, i, d: Math.abs(zc[i]-zl[i]) })).sort((x,y)=>y.d-x.d);
    for (let k = 0; k < CHECKS; k++) { const c = order[Math.floor(k/2) % order.length]; const l = one(c.key, k % 2 ? -1 : 1); extra.push({ k: c.i, l, c: a.agreeOn(l) }); }
    return extra;
  }
  for (let k = 0; k < CHECKS; k++) {
    const r = rank(zOf(a, extra)); const A = B.P[r[0].id], Bb = B.P[r[1].id];
    const asked = extra.map(e => e.k);
    const cand = T.map((key,i) => ({ key, i, d: Math.abs(A[i]-Bb[i]) - 0.6*asked.filter(x=>x===i).length })).sort((x,y)=>y.d-x.d)[0];
    const l = one(cand.key, k % 2 ? -1 : 1);
    extra.push({ k: cand.i, l, c: a.agreeOn(l) });
  }
  return extra;
}
function stats(R){ const N=R.length; const mu=T.map((_,k)=>R.reduce((s,r)=>s+r[k],0)/N); const sd=T.map((_,k)=>Math.sqrt(R.reduce((s,r)=>s+(r[k]-mu[k])**2,0)/N)); return [mu,sd]; }
function calibrate(N=6000){ const A=[...Array(N)].map(()=>respond(B.person())); [MU,SD]=stats(A.map(a=>raw(a,[]))); [MUc,SDc]=stats(A.map(a=>raw(a,[],'choice'))); [MUl,SDl]=stats(A.map(a=>raw(a,[],'level'))); }
function classify(a, t) {
  const extra = CHECKS ? doubleChecks(a) : [];
  const zz = zOf(a, extra), add = T.map(()=>0), used = new Set();
  for (let k = 0; k < Number(process.env.DUELS ?? 3); k++) {
    const r = rank(zz.map((x,i)=>x+add[i])); let A=r[0].id, Bb=r[1].id; let key=[A,Bb].sort().join("|"); if(used.has(key)){Bb=r[2].id;key=[A,Bb].sort().join("|");} used.add(key);
    const diff = B.P[A].map((x,i)=>x-B.P[Bb][i]); const d = diff.map(x=>x/norm(diff));
    const pick = Math.random() < 1/(1+Math.exp(-1.3*1.4*dot(d,t)-0.35*gauss()));
    d.forEach((x,i)=> add[i] += (pick?1:-1)*0.45*x);
  }
  return { r: rank(zz.map((x,i)=>x+add[i])), z: zz };
}
module.exports = { respond, raw, calibrate, classify, zOf };
