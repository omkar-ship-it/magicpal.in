// Re-align the imagination archetypes with the brief's own words, then check
// the warm-founder profile, the spread, and how far the derived matrix moves.
const B = require("./model.cjs"); const F = require("./final4.cjs");
const C = require("./constants4.json");
const T = B.T; const v = (o) => T.map((k) => o[k] ?? 0);
const NEW = process.env.NEW !== "0";
if (NEW) {
  B.P.dreamer = v({ O: 2, D: 0.5, S: -0.5, E: 0.3, A: 0.5 });          // imaginative, ambitious, future-oriented
  B.P.creator = v({ O: 2, D: 0.8, E: 0.3, C: 0.3, H: 0.3 });           // creative, expressive, inventive
  B.P.explorer = v({ O: 1.5, I: 1.2, D: -0.5, S: -1.5, E: 0.5 });      // curious, adventurous, open-minded
}
const MU = C.MU, SD = C.SD;
const zOf = (a) => F.raw(a).map((x,k)=>(x-MU[k])/SD[k]);
// refit the spread offsets for these profiles
for (const id of B.IDS) B.BIAS[id] = 0;
const pop = [...Array(8000)].map(() => zOf(F.respond(B.person())));
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
for (let it = 0; it < 80; it++) { const n = Object.fromEntries(B.IDS.map(id=>[id,0])); for (const z of pop) n[rank(z)[0].id]++; for (const id of B.IDS) B.BIAS[id] += 0.02*(1/12 - n[id]/pop.length)*12; }
const me = [1.6, 1.5, -0.6, -0.8, 0, -1, 1.5, 0];
console.log(`${NEW ? "brief-aligned" : "current"} profiles — Omkar-like:`, rank(me).slice(0,4).map(x=>`${x.id} ${x.c.toFixed(2)}`).join(" · "));
const visionary = [1.8, 0.3, 0.5, -0.5, 0.4, 0.2, 0.6, 0]; // imaginative, a bit driven, warm, not bossy
console.log("   collaborative visionary:", rank(visionary).slice(0,3).map(x=>`${x.id} ${x.c.toFixed(2)}`).join(" · "));
const maker = [1.7, 0, 0.9, 0, 0.3, 0, 0.4, 0.3];             // imaginative and finishes things
console.log("   creative finisher:", rank(maker).slice(0,3).map(x=>`${x.id} ${x.c.toFixed(2)}`).join(" · "));
// accuracy + spread with the real respondent model
let clear = 0, hit = 0, re = 0; const dist = {};
for (let i = 0; i < 5000; i++) { const t = B.person(); const tr = rank(t); const r1 = rank(zOf(F.respond(t)))[0].id, r2 = rank(zOf(F.respond(t)))[0].id; dist[r1] = (dist[r1]||0)+1;
  if (tr[0].c - tr[1].c > 0.15) { clear++; if (r1 === tr[0].id) hit++; if (r1 === r2) re++; } }
const vals = Object.values(dist).map(x => x/50);
console.log(`   clear types ${(100*hit/clear).toFixed(1)}% · retake ${(100*re/clear).toFixed(1)}% · spread ${Math.min(...vals).toFixed(1)}–${Math.max(...vals).toFixed(1)}%  (no duel)`);
require("fs").writeFileSync(NEW ? "bias5.json" : "bias4b.json", JSON.stringify(Object.fromEntries(Object.entries(B.BIAS).map(([k,x])=>[k,+x.toFixed(3)]))));
