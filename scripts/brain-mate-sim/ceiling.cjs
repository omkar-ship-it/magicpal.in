// What limits archetype accuracy, and which kinds of accuracy can reach 95%.
const B = require("./model.cjs"); const V = require("./v4.cjs");
Object.assign(B.BIAS, require("./bias.json")); V.calibrate();
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const N = 6000, p = (x, n) => (100 * x / n).toFixed(1) + "%";

// 1. The ceiling: a PERFECT test (no measurement error at all), but people
//    themselves vary a little from week to week (trait retest r = 0.85, the
//    figure for the best long personality inventories).
let same = 0;
for (let i = 0; i < N; i++) { const t = B.person(); const t2 = t.map(x => 0.92 * x + 0.39 * gauss()); if (rank(t)[0].id === rank(t2)[0].id) same++; }
console.log(`perfect test, same archetype two weeks later: ${p(same, N)}`);

// 2. Our v4 design: exact archetype vs "true archetype is in the pair we show"
//    vs confidence-gated (name one archetype only when the result is clear,
//    otherwise show the honest cusp pair).
const rows = [];
for (let i = 0; i < N; i++) { const t = B.person(); const truth = rank(t)[0].id; const r = V.classify(V.respond(t), t).r; rows.push({ truth, top: r[0].id, second: r[1].id, margin: r[0].c - r[1].c }); }
const exact = rows.filter(r => r.top === r.truth).length, pair = rows.filter(r => r.top === r.truth || r.second === r.truth).length;
console.log(`v4 exact archetype: ${p(exact, N)} · true archetype within the two we show: ${p(pair, N)}`);
for (const th of [0.04, 0.08, 0.12, 0.16, 0.2]) {
  const confident = rows.filter(r => r.margin >= th), cusp = rows.filter(r => r.margin < th);
  const ok = confident.filter(r => r.top === r.truth).length + cusp.filter(r => r.top === r.truth || r.second === r.truth).length;
  console.log(`  confidence gate ${th.toFixed(2)}: single archetype for ${p(confident.length, N)} (right ${p(confident.filter(r=>r.top===r.truth).length, confident.length)}) · cusp for ${p(cusp.length, N)} (pair right ${p(cusp.filter(r=>r.top===r.truth||r.second===r.truth).length, cusp.length)}) · what we show is right: ${p(ok, N)}`);
}
