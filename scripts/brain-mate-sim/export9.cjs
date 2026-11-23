// Fits v5's constants by running the app's compiled scoring on synthetic players.
// APP_DIR=<tsc output> node export9.cjs > constants9.json
const P9 = require("./people9.cjs"); const APP = process.env.APP_DIR;
const Sc = require(APP + "/score"), Ar = require(APP + "/archetypes"), Cp = require(APP + "/compare");
const T = P9.T, N = 20000, IDS = Object.keys(Ar.ARCHETYPES);
const people = [...Array(N)].map(() => { const t = P9.person(); return { t, a: P9.base(t) }; });
const raw = (a, part) => Sc.rawScores(a, part).map((x) => x ?? 0);
const stat = (R) => { const mu = T.map((_,k)=>R.reduce((s,r)=>s+r[k],0)/R.length); const sd = T.map((_,k)=>Math.sqrt(R.reduce((s,r)=>s+(r[k]-mu[k])**2,0)/R.length)); return [mu, sd]; };
const [MU, SD] = stat(people.map(p => raw(p.a, "all"))), [MUc, SDc] = stat(people.map(p => raw(p.a, "choice"))), [MUl, SDl] = stat(people.map(p => raw(p.a, "level")));
const z = (a, part = "all", mu = MU, sd = SD) => raw(a, part).map((x,k) => (x-mu[k])/sd[k]);
const PROTO = Object.fromEntries(IDS.map((id) => [id, T.map((k) => Ar.ARCHETYPES[id].profile[k])]));
const cos = (a,b) => P9.dot(a,b)/((P9.norm(a)*P9.norm(b))||1);
const BIAS = Object.fromEntries(IDS.map((id) => [id, 0]));
const rank = (vec) => IDS.map(id => ({ id, c: cos(vec, PROTO[id]) + BIAS[id] })).sort((x,y)=>y.c-x.c);
const zs = people.slice(0, 8000).map(p => z(p.a));
for (let it = 0; it < 80; it++) { const n = Object.fromEntries(IDS.map(id=>[id,0])); for (const q of zs) n[rank(q)[0].id]++; for (const id of IDS) BIAS[id] += 0.02*(1/12 - n[id]/zs.length)*12; }
const diffs = people.slice(0, 8000).map(p => { const c = z(p.a, "choice", MUc, SDc), l = z(p.a, "level", MUl, SDl); return Math.max(...c.map((x,k)=>Math.abs(x-l[k]))); });
let CONTRADICTION = 1.7; for (const th of [1.5, 1.6, 1.7, 1.8, 1.9, 2.0]) { const share = diffs.filter(d=>d>=th).length/diffs.length; console.error(`threshold ${th}: ${(100*share).toFixed(0)}% get double-checks`); if (share <= 0.27 && CONTRADICTION === 1.7 && th >= 1.5) CONTRADICTION = th; }
const spearman = (o1, o2) => { const d2 = o1.reduce((s, id, i) => s + (i - o2.indexOf(id)) ** 2, 0); return 1 - 6*d2/(5*24); };
const jac = (a,b) => { const A=new Set(a); const i=b.filter(x=>A.has(x)).length; return i/new Set([...a,...b]).size; };
const clip = (x) => Math.max(0, Math.min(1, x));
const tr = (v) => Object.fromEntries(T.map((k,i) => [k, Math.max(-2.5, Math.min(2.5, v[i]))]));
const S = people.slice(0, 6000).map(p => ({ z: tr(z(p.a)), values: p.a.values, sat: p.a.ranks.r1 }));
const sims = [], comps = [];
for (let i = 0; i < 20000; i++) { const a = S[Math.floor(Math.random()*S.length)], b = S[Math.floor(Math.random()*S.length)]; if (a === b) continue;
  sims.push(0.5*Cp.traitSimilarity(a.z, b.z) + 0.3*jac(a.values, b.values) + 0.2*(spearman(a.sat, b.sat)+1)/2);
  const p = Cp.fitParts(a.z, b.z); comps.push(0.3*p.role + 0.2*p.lead + 0.2*p.warmth + 0.15*p.structure + 0.15*p.challenge); }
const q = (arr) => { const s = [...arr].sort((x,y)=>x-y); return [...Array(21)].map((_,k)=>+s[Math.min(s.length-1, Math.floor(k/20*(s.length-1)))].toFixed(4)); };
const r4 = (a) => a.map(x => +x.toFixed(4));
console.log(JSON.stringify({ MU: r4(MU), SD: r4(SD), MUc: r4(MUc), SDc: r4(SDc), MUl: r4(MUl), SDl: r4(SDl), CONTRADICTION, BIAS: Object.fromEntries(Object.entries(BIAS).map(([k,v])=>[k,+v.toFixed(3)])), SIM_Q: q(sims), COMP_Q: q(comps) }));
