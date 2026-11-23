// Synthetic players for v5, in the APP's trait order (O I D S E A C H V),
// answering the APP's real question bank. Shared by export9 and verify9.
const APP = process.env.APP_DIR; const R = require(APP + "/rounds"), Ar = require(APP + "/archetypes");
const T = Ar.TRAITS; const ix = (k) => T.indexOf(k);
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
function person(){ const z = T.map(()=>gauss()); const t=[...z];
  t[ix("I")] += 0.3*z[ix("O")]; t[ix("S")] += 0.4*z[ix("D")]; t[ix("A")] += 0.3*z[ix("E")];
  t[ix("H")] += 0.3*z[ix("C")] - 0.3*z[ix("A")]; t[ix("V")] += 0.3*z[ix("O")] + 0.3*z[ix("A")] + 0.2*z[ix("D")];
  return t; }
const shuffle = (xs) => xs.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const VAL = { freedom: ["O"], adventure: ["O","E"], achievement: ["V","A"], influence: ["A"], stability: ["S"], helping: ["C"], fairness: ["C","O"], fun: ["E"] };
const values = (t) => Object.entries(VAL).map(([k, ks]) => [k, Math.exp(0.8*ks.reduce((s,x)=>s+t[ix(x)],0)/ks.length + 0.6*(Math.random()*2-1))]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
/** Everything except the double-checks and duels (those need the fitted scorer). */
function base(t) {
  const a = { v: 5, rather: {}, tend: {}, calls: {}, ranks: {}, sliders: {}, values: values(t), checks: {}, duels: [] };
  for (const x of R.RATHER) a.rather[x.id] = (t[ix(x.trait)] + 0.7*gauss()) > 0 ? 1 : 0;
  for (const x of R.TENDENCIES) { const v = t[ix(x.trait)] + 0.7*gauss(); a.tend[x.id] = v < -0.8 ? 0 : v < 0 ? 1 : v < 0.8 ? 2 : 3; }
  for (const c of R.CALLS) { const wa = Math.exp(1.3*t[ix(c.a.trait)] + 0.35*gauss()), wb = Math.exp(1.3*t[ix(c.b.trait)] + 0.35*gauss()); a.calls[c.id] = Math.random()*(wa+wb) < wa ? "a" : "b"; }
  for (const r of R.RANKS) a.ranks[r.id] = r.cards.map((c) => ({ id: c.id, u: t[ix(c.trait)] + 0.6*gauss() })).sort((x,y)=>y.u-x.u).map(x=>x.id);
  for (const l of R.SLIDERS) a.sliders[l.id] = Math.round(Math.max(-1, Math.min(1, (t[ix(l.trait)] + 0.7*gauss())/2))*100)/100;
  return a;
}
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0), norm = (a) => Math.sqrt(dot(a,a));
/** The full game, with the app's own double-checks and adaptive duels. */
function play(t, Sc) {
  const a = base(t); const PROTO = Object.fromEntries(Object.entries(Ar.ARCHETYPES).map(([id, x]) => [id, T.map((k) => x.profile[k])]));
  for (const id of Sc.checksNeeded(a)) { const c = R.CHECKS.find((x)=>x.id===id); a.checks[id] = (c.sign*t[ix(c.trait)] + 0.8*gauss()) > 0 ? 1 : 0; }
  for (let k = 0; k < Sc.DUEL_COUNT; k++) { const c = Sc.nextDuel(a); const diff = PROTO[c.a].map((x,i)=>x-PROTO[c.b][i]); const d = diff.map((x)=>x/norm(diff)); a.duels.push({ a: c.a, b: c.b, pick: Math.random() < 1/(1+Math.exp(-1.3*1.4*dot(d,t)-0.35*gauss())) ? c.a : c.b }); }
  return a;
}
module.exports = { T, ix, person, base, play, gauss, dot, norm };
