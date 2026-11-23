// v5 candidate vs v3: which question formats carry the signal.
const B = require("./model.cjs");
const T = B.T; const v = (o) => T.map((k) => o[k] ?? 0); const one = (k, s = 1) => v({ [k]: s });
const dot = B.dot, norm = B.norm;
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
// Validity of each format: how strongly an answer follows the trait. Situational
// story choices are known to be noisier than direct behaviour reports (SJTs vs
// self-report frequency); STORY_V lets us test the user's concern.
const STORY_V = Number(process.env.STORY_V ?? 1), BETA = 1.3;
const STORY = [[one("O"),one("S"),one("E"),one("I")],[one("O"),one("I"),one("A"),one("C")],[one("E"),one("C"),one("E",-1),one("A")],[v({A:1,H:-1}),one("I"),one("C"),one("H")],[one("D"),one("S"),one("O"),one("E")],[one("A"),one("H"),one("O"),one("I")],[one("S"),one("D"),one("C"),one("I")]];
const RANK = [[one("D"),one("O"),one("C"),one("E"),one("S")],[one("O"),one("I"),one("A"),one("H"),one("D")],[one("S"),one("E"),one("A"),one("C"),one("H")]];
const AGREE = [one("O"),one("I"),one("D"),one("S"),one("E"),one("A"),one("C"),one("H"),one("D",-1),one("S",-1),one("E",-1),one("H",-1)];
const SLIDERS = [one("D"),one("S"),one("H"),one("A"),one("E"),one("C")];
// v5 formats
const WYR = T.map((k) => one(k));                       // would-you-rather: two poles of one trait
const FREQ = T.map((k) => one(k));                      // how often, last month: 4 levels
const DILEMMA = [[one("A"),one("C")],[one("H"),one("A")],[one("O"),one("D")],[one("S"),one("E")],[one("I"),one("C")],[one("D"),one("H")]]; // two traits pulled against each other
const pick = (opts, t, beta) => { const w = opts.map(o => Math.exp(beta*dot(o,t)+0.35*gauss())); let r=Math.random()*w.reduce((a,b)=>a+b); for (let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i;} return w.length-1; };
const bin = (l, t, noise = 0.8) => (dot(l,t)/norm(l) + noise*gauss()) > 0 ? 1 : 0;
const lvl = (l, t) => { const x = dot(l,t)/norm(l) + 0.7*gauss(); return x < -0.8 ? 0 : x < 0 ? 1 : x < 0.8 ? 2 : 3; };
const rankOf = (cards, t) => cards.map((c, i) => ({ i, u: dot(c,t) + 0.6*gauss() })).sort((a,b) => b.u - a.u).map(x => x.i);
const VERSION = process.env.VER ?? "v3";
function respond(t) {
  const a = { rank: RANK.map(c => rankOf(c, t)), sliders: SLIDERS.map(l => Math.max(-1, Math.min(1, (dot(l,t) + 0.7*gauss()) / 2))) };
  if (VERSION === "v3") { a.story = STORY.map(o => pick(o, t, BETA * STORY_V)); a.pairs = T.map((_, k) => bin(one(T[k]), t)); a.agree = AGREE.map(l => bin(l, t)); }
  else { a.wyr = WYR.map(l => bin(l, t, 0.7)); a.freq = FREQ.map(l => lvl(l, t)); a.dil = DILEMMA.map(o => pick(o, t, BETA)); }
  return a;
}
function raw(a) {
  const s = T.map(()=>0), n = T.map(()=>0);
  const add = (l, val, w=1) => l.forEach((x,k) => { if (x) { n[k] += Math.abs(x)*w; s[k] += x*val*w; } });
  a.rank.forEach((o,q) => o.forEach((ci,pos) => add(RANK[q][ci], 1.5 - 3*pos/4)));
  a.sliders.forEach((x,q) => add(SLIDERS[q], x*1.8, 1.2));
  if (a.story) { a.story.forEach((c,q) => STORY[q].forEach((o,i) => add(o, i===c ? 2 : 0))); a.pairs.forEach((c,q) => add(one(T[q]), c?1:-1)); a.agree.forEach((c,q) => add(AGREE[q], c?1:-1)); }
  if (a.wyr) { a.wyr.forEach((c,q) => add(WYR[q], c?1:-1, 1.2)); a.freq.forEach((c,q) => add(FREQ[q], [-1.5,-0.5,0.5,1.5][c], 1.3)); a.dil.forEach((c,q) => DILEMMA[q].forEach((o,i) => add(o, i===c ? 1 : -1))); }
  return s.map((x,k) => n[k] ? x/n[k] : 0);
}
let MU, SD;
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) })).sort((x,y)=>y.c-x.c);
const zOf = (a) => raw(a).map((x,k)=>(x-MU[k])/SD[k]);
const pop = [...Array(6000)].map(() => raw(respond(B.person())));
MU = T.map((_,k)=>pop.reduce((s,r)=>s+r[k],0)/pop.length); SD = T.map((_,k)=>Math.sqrt(pop.reduce((s,r)=>s+(r[k]-MU[k])**2,0)/pop.length));
const N = 6000; let clear = 0, hit = 0, re = 0, top3 = 0; const est = [], tru = [];
for (let i = 0; i < N; i++) { const t = B.person(); const tr = rank(t); const z1 = zOf(respond(t)), z2 = zOf(respond(t)); const r1 = rank(z1), r2 = rank(z2);
  if (r1.slice(0,3).some(x=>x.id===tr[0].id)) top3++;
  if (tr[0].c - tr[1].c > 0.15) { clear++; if (r1[0].id === tr[0].id) hit++; if (r1[0].id === r2[0].id) re++; } est.push(z1); tru.push(t); }
const corr=(k)=>{const x=est.map(e=>e[k]),y=tru.map(t=>t[k]);const mx=x.reduce((a,b)=>a+b)/N,my=y.reduce((a,b)=>a+b)/N;let sxy=0,sx=0,sy=0;for(let i=0;i<N;i++){sxy+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return sxy/Math.sqrt(sx*sy);};
const rs = T.map((_,k)=>corr(k)); const p=(x,n)=>(100*x/n).toFixed(1)+"%";
console.log(`${process.env.LABEL.padEnd(44)} trait r ${Math.min(...rs).toFixed(2)}–${Math.max(...rs).toFixed(2)} | clear types ${p(hit,clear)}, retake ${p(re,clear)} | in top-3 ${p(top3,N)}`);
