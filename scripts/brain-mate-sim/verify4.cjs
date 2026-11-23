// Runs the APP's compiled v4 scoring against the synthetic players.
// APP_DIR=<tsc output of lib/brainMate> node scripts/brain-mate-sim/verify4.cjs
const B = require("./model.cjs");
const R = require(process.env.APP_DIR + "/rounds"), Sc = require(process.env.APP_DIR + "/score"), Cp = require(process.env.APP_DIR + "/compare"), Ar = require(process.env.APP_DIR + "/archetypes");
const T = ["O","I","D","S","E","A","C","H"]; const ix = (k) => T.indexOf(k);
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const PROTO = Object.fromEntries(Object.entries(Ar.ARCHETYPES).map(([id, a]) => [id, T.map((k) => a.profile[k])]));
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0), norm = (a) => Math.sqrt(dot(a,a));
const shuffle = (xs) => xs.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
function play(t) {
  const a = { v: 4, rather: {}, tend: {}, calls: {}, ranks: {}, sliders: {}, values: shuffle(R.VALUES.map(v=>v.id)).slice(0,2), checks: {}, duels: [] };
  for (const x of R.RATHER) a.rather[x.id] = (t[ix(x.trait)] + 0.7*gauss()) > 0 ? 1 : 0;
  for (const x of R.TENDENCIES) { const v = t[ix(x.trait)] + 0.7*gauss(); a.tend[x.id] = v < -0.8 ? 0 : v < 0 ? 1 : v < 0.8 ? 2 : 3; }
  for (const c of R.CALLS) { const wa = Math.exp(1.3*t[ix(c.a.trait)] + 0.35*gauss()), wb = Math.exp(1.3*t[ix(c.b.trait)] + 0.35*gauss()); a.calls[c.id] = Math.random()*(wa+wb) < wa ? "a" : "b"; }
  for (const r of R.RANKS) a.ranks[r.id] = r.cards.map((c) => ({ id: c.id, u: t[ix(c.trait)] + 0.6*gauss() })).sort((x,y)=>y.u-x.u).map(x=>x.id);
  for (const l of R.SLIDERS) a.sliders[l.id] = Math.round(Math.max(-1, Math.min(1, (t[ix(l.trait)] + 0.7*gauss())/2))*100)/100;
  for (const id of Sc.checksNeeded(a)) { const c = R.CHECKS.find((x)=>x.id===id); a.checks[id] = (c.sign*t[ix(c.trait)] + 0.8*gauss()) > 0 ? 1 : 0; }
  for (let k = 0; k < 3; k++) { const c = Sc.nextDuel(a); const diff = PROTO[c.a].map((x,i)=>x-PROTO[c.b][i]); const d = diff.map((x)=>x/norm(diff)); a.duels.push({ a: c.a, b: c.b, pick: Math.random() < 1/(1+Math.exp(-1.3*1.4*dot(d,t)-0.35*gauss())) ? c.a : c.b }); }
  return a;
}
const BIAS = require("./constants5.json").BIAS;
const truth = (t) => Object.entries(PROTO).map(([id,p])=>({ id, c: dot(t,p)/(norm(t)*norm(p)) + BIAS[id] })).sort((x,y)=>y.c-x.c);
const N = 5000, p = (x, n = N) => (100*x/n).toFixed(1)+"%"; let valid=0, clear=0, cHit=0, cRe=0, top3=0, checked=0; const dist={};
for (let i=0;i<N;i++){ const t=B.person(); const tr=truth(t); const a1=play(t), a2=play(t); if (Sc.cleanAnswers(JSON.parse(JSON.stringify(a1)))) valid++; if (Object.keys(a1.checks).length) checked++;
  const r1=Sc.resultFor(a1), r2=Sc.resultFor(a2); dist[r1.archetype]=(dist[r1.archetype]||0)+1; if(r1.mix.some(m=>m.id===tr[0].id))top3++;
  if(tr[0].c-tr[1].c>0.15){clear++; if(r1.archetype===tr[0].id)cHit++; if(r1.archetype===r2.archetype)cRe++;} }
console.log(`server accepts ${p(valid)} · double-checks ${p(checked)} · clear types ${p(cHit,clear)} retake ${p(cRe,clear)} · in top-3 ${p(top3)}`);
const v = Object.values(dist).map(x=>100*x/N); console.log(`spread ${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)}%`);
const out={}; for(let i=0;i<3000;i++){ const c=Cp.compare({name:"A",answers:play(B.person())},{name:"B",answers:play(B.person())}); out[c.outcome]=(out[c.outcome]||0)+1; }
console.log("outcomes:", Object.entries(out).map(([k,v])=>`${k} ${p(v,3000)}`).join(" · "));
const c = Cp.compare({name:"Omkar",answers:play(B.person())},{name:"Eswari",answers:play(B.person())}); console.log("sample:", c.loves.aSees, "|", c.click.join(" | "));
