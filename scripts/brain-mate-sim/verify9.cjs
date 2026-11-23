// End-to-end check of a compiled app (v4 or v5) against people who have all
// nine traits. "Truth" is always the v5 definitions — what each type means.
// APP_DIR=<app under test> TRUTH_DIR=<compiled v5> node verify9.cjs
const P9 = require("./people9.cjs");             // people in v5 trait order
const APP = process.env.APP_DIR, TRUTH = process.env.TRUTH_DIR;
const Sc = require(APP + "/score"), Ar = require(APP + "/archetypes"), R = require(APP + "/rounds"), Cp = require(APP + "/compare");
const Ar5 = require(TRUTH + "/archetypes"); const T5 = Ar5.TRAITS, T = Ar.TRAITS;
const BIAS5 = require("./constants9.json").BIAS;
const IDS = Object.keys(Ar5.ARCHETYPES); const dot = P9.dot, norm = P9.norm;
const PROTO5 = Object.fromEntries(IDS.map((id) => [id, T5.map((k) => Ar5.ARCHETYPES[id].profile[k])]));
const truth = (t) => IDS.map((id) => ({ id, c: dot(t, PROTO5[id]) / (norm(t) * norm(PROTO5[id])) + BIAS5[id] })).sort((x, y) => y.c - x.c);
// the app under test sees only the traits it asks about
const view = (t) => T.map((k) => t[T5.indexOf(k)]);
function gauss(){ return P9.gauss(); }
const ix = (k) => T.indexOf(k);
function play(t5) {
  const t = view(t5); const PROTO = Object.fromEntries(IDS.map((id) => [id, T.map((k) => Ar.ARCHETYPES[id].profile[k])]));
  const a = { v: Sc.VERSION, rather: {}, tend: {}, calls: {}, ranks: {}, sliders: {}, values: R.VALUES.map((v) => [Math.random(), v.id]).sort((p, q) => p[0] - q[0]).slice(0, 2).map((p) => p[1]), checks: {}, duels: [] };
  for (const x of R.RATHER) a.rather[x.id] = (t[ix(x.trait)] + 0.7*gauss()) > 0 ? 1 : 0;
  for (const x of R.TENDENCIES) { const v = t[ix(x.trait)] + 0.7*gauss(); a.tend[x.id] = v < -0.8 ? 0 : v < 0 ? 1 : v < 0.8 ? 2 : 3; }
  for (const c of R.CALLS) { const wa = Math.exp(1.3*t[ix(c.a.trait)] + 0.35*gauss()), wb = Math.exp(1.3*t[ix(c.b.trait)] + 0.35*gauss()); a.calls[c.id] = Math.random()*(wa+wb) < wa ? "a" : "b"; }
  for (const r of R.RANKS) a.ranks[r.id] = r.cards.map((c) => ({ id: c.id, u: t[ix(c.trait)] + 0.6*gauss() })).sort((x,y)=>y.u-x.u).map(x=>x.id);
  for (const l of R.SLIDERS) a.sliders[l.id] = Math.round(Math.max(-1, Math.min(1, (t[ix(l.trait)] + 0.7*gauss())/2))*100)/100;
  for (const id of Sc.checksNeeded(a)) { const c = R.CHECKS.find((x)=>x.id===id); a.checks[id] = (c.sign*t[ix(c.trait)] + 0.8*gauss()) > 0 ? 1 : 0; }
  for (let k = 0; k < 3; k++) { const c = Sc.nextDuel(a); const diff = PROTO[c.a].map((x,i)=>x-PROTO[c.b][i]); const d = diff.map((x)=>x/norm(diff)); a.duels.push({ a: c.a, b: c.b, pick: Math.random() < 1/(1+Math.exp(-1.3*1.4*dot(d,t)-0.35*gauss())) ? c.a : c.b }); }
  return a;
}
const N = Number(process.env.N ?? 12000); const per = {}; let clear = 0, hit = 0, top2 = 0, re = 0, valid = 0, checked = 0; const dist = {};
for (let i = 0; i < N; i++) {
  const t = P9.person(); const tr = truth(t); const a1 = play(t), a2 = play(t);
  if (Sc.cleanAnswers(JSON.parse(JSON.stringify(a1)))) valid++; if (Object.keys(a1.checks).length) checked++;
  const r1 = Sc.resultFor(a1), r2 = Sc.resultFor(a2); dist[r1.archetype] = (dist[r1.archetype] || 0) + 1;
  if (tr[0].c - tr[1].c < 0.08) continue;
  const id = tr[0].id; clear++; per[id] ??= { n: 0, h: 0, miss: {} }; per[id].n++;
  if (r1.archetype === id) { hit++; per[id].h++; } else per[id].miss[r1.archetype] = (per[id].miss[r1.archetype] || 0) + 1;
  if (r1.mix.slice(0, 2).some((m) => m.id === id)) top2++; if (r1.archetype === r2.archetype) re++;
}
const f = (x, n) => (100 * x / n).toFixed(1) + "%";
console.log(`${process.env.LABEL}: right type ${f(hit, clear)} · in top two ${f(top2, clear)} · same type on a retake ${f(re, clear)} · server accepts ${f(valid, N)} · double-checked ${f(checked, N)}`);
const sp = Object.values(dist).map((x) => 100 * x / N); console.log(`  spread of results across the 12: ${Math.min(...sp).toFixed(1)}–${Math.max(...sp).toFixed(1)}%`);
console.log("  " + Object.entries(per).sort((x, y) => x[1].h / x[1].n - y[1].h / y[1].n).map(([id, r]) => { const m = Object.entries(r.miss).sort((x, y) => y[1] - x[1])[0]; return `${id} ${f(r.h, r.n)}${m ? ` (→${m[0]} ${f(m[1], r.n)})` : ""}`; }).join("\n  "));
if (process.env.OUTCOMES) { const out = {}; const Pl = (t) => ({ name: "A", answers: play(t) }); for (let i = 0; i < 3000; i++) { const c = Cp.compare(Pl(P9.person()), { ...Pl(P9.person()), name: "B" }); out[c.outcome] = (out[c.outcome] || 0) + 1; }
  console.log("  outcomes:", Object.entries(out).map(([k, v]) => `${k} ${f(v, 3000)}`).join(" · ")); }
