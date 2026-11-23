// Real people have ambition whether or not we ask about it. Generate 9-trait people,
// take their true type from the 9-trait definitions, then score them with
// (a) today's 8-trait questions + 8-trait definitions, (b) the 9-trait set.
process.env.TRAITS = "9"; const N9 = require("./sim9.cjs");
delete require.cache[require.resolve("./sim9.cjs")]; process.env.TRAITS = "8"; process.env.PROFILES = "./profiles7b.json"; const O8 = require("./sim9.cjs");
const drop = (t) => t.filter((_, i) => N9.T[i] !== "V");
const z = (S, r) => r.map((x,k)=>(x-S.MU[k])/S.SD[k]);
const res = {}; 
for (let i = 0; i < 40000; i++) {
  const t = N9.person(); const tr = N9.rank(t); if (tr[0].c - tr[1].c < 0.08) continue; const id = tr[0].id;
  const a = O8.rank(z(O8, O8.raw(O8.respond(drop(t)))))[0].id, b = N9.rank(z(N9, N9.raw(N9.respond(t))))[0].id;
  res[id] ??= { n:0, a:0, b:0, am:{} }; const r = res[id]; r.n++; r.a += a===id; r.b += b===id; if (a!==id) r.am[a]=(r.am[a]||0)+1;
}
console.log("true type     today's questions          with Ambition (9 traits)   (no tie-break rounds)");
for (const [id, r] of Object.entries(res).sort((x,y)=>x[1].a/x[1].n-y[1].a/y[1].n)) { const m = Object.entries(r.am).sort((x,y)=>y[1]-x[1])[0];
  console.log(`  ${id.padEnd(11)} ${(100*r.a/r.n).toFixed(0).padStart(3)}% (often → ${m?m[0]:"-"})`.padEnd(42) + `${(100*r.b/r.n).toFixed(0).padStart(3)}%`); }
