// Per-archetype accuracy and the main confusions, with the full game
// (all formats + adaptive duel). PROFILES=<file> swaps in candidate profiles.
const B = require("./model.cjs"); const F = require(process.env.INSTR ?? "./final4.cjs");
const T = B.T;
if (process.env.PROFILES) Object.assign(B.P, Object.fromEntries(Object.entries(require(process.env.PROFILES)).map(([k, o]) => [k, T.map((t) => o[t] ?? 0)])));
const dot = B.dot, norm = B.norm;
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
// norms + spread offsets fitted for whatever profiles are in force
const pop = [...Array(8000)].map(() => F.raw(F.respond(B.person())));
const MU = T.map((_,k)=>pop.reduce((s,r)=>s+r[k],0)/pop.length), SD = T.map((_,k)=>Math.sqrt(pop.reduce((s,r)=>s+(r[k]-MU[k])**2,0)/pop.length));
const zOf = (r) => r.map((x,k)=>(x-MU[k])/SD[k]);
for (const id of B.IDS) B.BIAS[id] = 0;
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
const zs = pop.map(zOf);
for (let it = 0; it < 80; it++) { const n = Object.fromEntries(B.IDS.map(id=>[id,0])); for (const z of zs) n[rank(z)[0].id]++; for (const id of B.IDS) B.BIAS[id] += 0.02*(1/12 - n[id]/zs.length)*12; }
function classify(z, t) {
  const add = T.map(()=>0), used = new Set();
  for (let k = 0; k < Number(process.env.DUELS ?? 3); k++) {
    const r = rank(z.map((x,i)=>x+add[i])); let A=r[0].id, Bb=r[1].id; let key=[A,Bb].sort().join("|"); if(used.has(key)){Bb=r[2].id;key=[A,Bb].sort().join("|");} used.add(key);
    const diff = B.P[A].map((x,i)=>x-B.P[Bb][i]); const d = diff.map(x=>x/norm(diff));
    const pick = Math.random() < 1/(1+Math.exp(-1.3*1.4*dot(d,t)-0.35*gauss()));
    d.forEach((x,i)=> add[i] += (pick?1:-1)*0.45*x);
  }
  return rank(z.map((x,i)=>x+add[i]))[0].id;
}
const N = 30000; const conf = {}; const tot = {};
let clear = 0, hit = 0;
for (let i = 0; i < N; i++) {
  const t = B.person(); const tr = rank(t); if (tr[0].c - tr[1].c < 0.08) continue;    // people who genuinely are one type
  const got = classify(zOf(F.raw(F.respond(t))), t); clear++; if (got === tr[0].id) hit++;
  tot[tr[0].id] = (tot[tr[0].id]||0)+1; conf[tr[0].id] ??= {}; conf[tr[0].id][got] = (conf[tr[0].id][got]||0)+1;
}
const rows = B.IDS.map(id => { const c = conf[id] ?? {}; const rec = (c[id]||0)/(tot[id]||1); const miss = Object.entries(c).filter(([k])=>k!==id).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k} ${(100*v/tot[id]).toFixed(0)}%`).join(", "); return { id, rec, miss }; }).sort((a,b)=>a.rec-b.rec);
console.log(`${process.env.LABEL ?? "current"} — overall ${(100*hit/clear).toFixed(1)}%`);
for (const r of rows) console.log(`  ${r.id.padEnd(11)} ${(100*r.rec).toFixed(0).padStart(3)}%   mistaken for: ${r.miss}`);
// how far apart the profiles are: the closest pairs are where mistakes happen
const pairs = []; for (const a of B.IDS) for (const b of B.IDS) if (a < b) pairs.push({ a, b, c: B.cos(B.P[a], B.P[b]) });
console.log("  closest profile pairs:", pairs.sort((x,y)=>y.c-x.c).slice(0,6).map(p=>`${p.a}~${p.b} ${p.c.toFixed(2)}`).join(" · "));
