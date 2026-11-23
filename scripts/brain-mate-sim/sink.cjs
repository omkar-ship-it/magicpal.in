// Among people whose imagination stands out, how are they spread across the
// three imagination archetypes? A "sink" archetype swallows most of them.
const B = require("./model.cjs"); const F = require("./final4.cjs");
const C = require("./constants4.json"); Object.assign(B.BIAS, C.BIAS);
const T = B.T, MU = C.MU, SD = C.SD;
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
const counts = {}; let n = 0;
const trueCounts = {};
for (let i = 0; i < 40000; i++) {
  const t = B.person(); if (t[0] < 1) continue;           // imagination clearly high
  n++; const z = F.raw(F.respond(t)).map((x,k)=>(x-MU[k])/SD[k]);
  const r = rank(z)[0].id; counts[r] = (counts[r]||0)+1;
  const tr = rank(t)[0].id; trueCounts[tr] = (trueCounts[tr]||0)+1;
}
const pct = (o) => Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`${k} ${(100*v/n).toFixed(0)}%`).join(" · ");
console.log(`imaginative people (n=${n}) — assigned: ${pct(counts)}`);
console.log(`                         — true nearest: ${pct(trueCounts)}`);
// the 'warm founder' profile from the screenshot
const me = [1.6, 1.5, -0.6, -0.8, 0, -1, 1.5, 0];
console.log("Omkar-like profile:", rank(me).slice(0,4).map(x=>`${x.id} ${x.c.toFixed(2)}`).join(" · "));
