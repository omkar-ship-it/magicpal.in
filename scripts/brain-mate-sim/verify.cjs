// Drives the APP's scoring with the simulation's synthetic respondents.
const M = require("./model.cjs");
const { SCENARIOS, STATEMENTS } = require(process.env.APP_DIR + "/rounds");
const { nextDuel, resultFor, cleanAnswers } = require(process.env.APP_DIR + "/score");
const { compare } = require(process.env.APP_DIR + "/compare");
const T = ["O","I","D","S","E","A","C","H"];
const loadVec = (l) => T.map((k) => l[k] ?? 0);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const PROTO = Object.fromEntries(Object.entries(require(process.env.APP_DIR + "/archetypes").ARCHETYPES).map(([id, a]) => [id, T.map((k) => a.profile[k])]));
function play(t) {
  const shuffle = (xs) => xs.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const a = { v: 2, s: {}, t: {}, values: shuffle(["freedom","adventure","achievement","influence","stability","helping","fairness","fun"]).slice(0, 2), tiles: shuffle(["places","tinkering","art","puzzles","startups","sports","people","teaching","books"]).slice(0, 3), duels: [] };
  for (const sc of SCENARIOS) {
    const w = sc.options.map((o) => Math.exp(1.3 * dot(loadVec(o.load), t) + 0.35 * gauss()));
    let r = Math.random() * w.reduce((x, y) => x + y), i = 0; for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
    a.s[sc.id] = sc.options[i].id;
  }
  for (const st of STATEMENTS) { const l = loadVec(st.load); const x = dot(l, t) / norm(l) + 0.8 * gauss(); a.t[st.id] = x < -0.8 ? 0 : x < 0 ? 1 : x < 0.8 ? 2 : 3; }
  for (let k = 0; k < 3; k++) {
    const c = nextDuel(a); const diff = PROTO[c.a].map((x, i) => x - PROTO[c.b][i]); const d = diff.map((x) => x / norm(diff));
    const pA = 1 / (1 + Math.exp(-1.3 * 1.4 * dot(d, t) - 0.35 * gauss()));
    a.duels.push({ a: c.a, b: c.b, pick: Math.random() < pA ? c.a : c.b });
  }
  return a;
}
const trueOf = (t) => Object.entries(PROTO).map(([id, p]) => ({ id, c: dot(t, p) / (norm(t) * norm(p)) + (require("./bias.json")[id]) })).sort((x, y) => y.c - x.c);
const N = 6000, dist = {}; let hit = 0, re = 0, clear = 0, cHit = 0, cRe = 0, valid = 0, cusp = 0;
for (let i = 0; i < N; i++) {
  const t = M.person(); const tr = trueOf(t);
  const a1 = play(t), a2 = play(t);
  if (cleanAnswers(JSON.parse(JSON.stringify(a1)))) valid++;
  const r1 = resultFor(a1), r2 = resultFor(a2);
  dist[r1.archetype] = (dist[r1.archetype] || 0) + 1; if (r1.cusp) cusp++;
  if (r1.archetype === tr[0].id) hit++; if (r1.archetype === r2.archetype) re++;
  if (tr[0].c - tr[1].c > 0.15) { clear++; if (r1.archetype === tr[0].id) cHit++; if (r1.archetype === r2.archetype) cRe++; }
}
const p = (x, n = N) => (100 * x / n).toFixed(1) + "%";
console.log(`server accepts the game's answers: ${p(valid)}`);
console.log(`recovers true archetype ${p(hit)} · same on retake ${p(re)} · clear types: recovered ${p(cHit, clear)}, retake ${p(cRe, clear)} · cusp ${p(cusp)}`);
console.log("spread:", Object.entries(dist).sort().map(([k, v]) => `${k} ${p(v)}`).join(" · "));
const out = {}; for (let i = 0; i < 3000; i++) { const x = play(M.person()), y = play(M.person()); const c = compare({ name: "A", answers: x }, { name: "B", answers: y }); out[c.outcome] = (out[c.outcome] || 0) + 1; }
console.log("outcomes:", Object.entries(out).map(([k, v]) => `${k} ${p(v, 3000)}`).join(" · "));
