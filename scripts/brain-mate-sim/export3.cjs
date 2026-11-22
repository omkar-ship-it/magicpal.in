const B = require("./model.cjs"); const F = require("./final.cjs"); const Cm = require("./cmp.cjs");
Object.assign(B.BIAS, require("./bias.json"));
const N = 20000; const T = B.T;
const people = [...Array(N)].map(() => { const t = B.person(); return { t, a: F.respond(t) }; });
const stat = (R) => { const mu = T.map((_,k)=>R.reduce((s,r)=>s+r[k],0)/R.length); const sd = T.map((_,k)=>Math.sqrt(R.reduce((s,r)=>s+(r[k]-mu[k])**2,0)/R.length)); return [mu, sd]; };
const [MU, SD] = stat(people.map(p => F.raw(p.a))), [MUc, SDc] = stat(people.map(p => F.raw(p.a, "choice"))), [MUl, SDl] = stat(people.map(p => F.raw(p.a, "level")));
const z = (a, only = undefined, mu = MU, sd = SD) => F.raw(a, only).map((x,k) => (x-mu[k])/sd[k]);
// even spread
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
const zs = people.slice(0, 8000).map(p => z(p.a));
for (let it = 0; it < 80; it++) { const n = Object.fromEntries(B.IDS.map(id=>[id,0])); for (const q of zs) n[rank(q)[0].id]++; for (const id of B.IDS) B.BIAS[id] += 0.02*(1/12 - n[id]/zs.length)*12; }
// contradiction threshold: share of players who'd see double-checks
const diffs = people.slice(0, 8000).map(p => { const c = z(p.a, "choice", MUc, SDc), l = z(p.a, "level", MUl, SDl); return Math.max(...c.map((x,k)=>Math.abs(x-l[k]))); });
for (const th of [1.2, 1.5, 1.8, 2.0, 2.2]) console.error(`threshold ${th}: ${(100*diffs.filter(d=>d>=th).length/diffs.length).toFixed(0)}% of players get double-checks`);
// display scales for comparisons: values + Saturday ranking similarity
const VAL = { freedom: ["O"], adventure: ["O","E"], achievement: ["D","A"], influence: ["A"], stability: ["S"], helping: ["C"], fairness: ["C","O"], fun: ["E"] };
const ix = (k) => T.indexOf(k);
const pickV = (t) => Object.entries(VAL).map(([k, ks]) => [k, Math.exp(0.8*ks.reduce((s,x)=>s+t[ix(x)],0)/ks.length + 0.6*(Math.random()*2-1))]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
const jac = (a,b) => { const A=new Set(a); const i=b.filter(x=>A.has(x)).length; return i/new Set([...a,...b]).size; };
const spearman = (o1, o2) => { const pos = (o) => { const p = []; o.forEach((ci, i) => p[ci] = i); return p; }; const p1 = pos(o1), p2 = pos(o2); const m = o1.length; const d2 = p1.reduce((s, x, i) => s + (x - p2[i]) ** 2, 0); return 1 - 6*d2/(m*(m*m-1)); };
const S = people.slice(0, 6000).map(p => ({ z: z(p.a).map(x => Math.max(-2.5, Math.min(2.5, x))), values: pickV(p.t), sat: p.a.rank[0] }));
const sims = [], comps = [];
for (let i = 0; i < 20000; i++) { const a = S[Math.floor(Math.random()*S.length)], b = S[Math.floor(Math.random()*S.length)]; if (a === b) continue;
  sims.push(0.5*Cm.traitSim(a.z, b.z) + 0.3*jac(a.values, b.values) + 0.2*(spearman(a.sat, b.sat)+1)/2); comps.push(Cm.compat(a.z, b.z)); }
const q = (arr) => { const s = [...arr].sort((x,y)=>x-y); return [...Array(21)].map((_,k)=>+s[Math.min(s.length-1, Math.floor(k/20*(s.length-1)))].toFixed(4)); };
const r4 = (a) => a.map(x => +x.toFixed(4));
console.log(JSON.stringify({ MU: r4(MU), SD: r4(SD), MUc: r4(MUc), SDc: r4(SDc), MUl: r4(MUl), SDl: r4(SDl), BIAS: Object.fromEntries(Object.entries(B.BIAS).map(([k,v])=>[k,+v.toFixed(3)])), SIM_Q: q(sims), COMP_Q: q(comps) }));
