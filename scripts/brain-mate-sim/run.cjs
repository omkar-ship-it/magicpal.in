const M = require("./model.cjs");
M.calibrate(); Object.assign(M.BIAS, require("./bias.json"));
const N = 6000, dist = {}, truth = {}; let hit = 0, hit2 = 0, retest = 0, retestDuel = 0;
for (let i = 0; i < N; i++) {
  const t = M.person();
  const trueId = M.rank(t)[0].id;
  const R = process.env.ROUNDS === undefined ? null : Number(process.env.ROUNDS); const cl = (x) => R === null ? M.classify(x, t) : M.classifyAdaptive(x, t, R); const a = cl(M.answer(t)), b = cl(M.answer(t));
  dist[a.top] = (dist[a.top] || 0) + 1; truth[trueId] = (truth[trueId] || 0) + 1;
  if (a.top === trueId) hit++;
  if (a.top === trueId || a.second === trueId) hit2++;
  if (a.top === b.top) retest++;
}
const pct = (x) => (100 * x / N).toFixed(1) + "%";
console.log("recovers true archetype:", pct(hit), "| true one in top two:", pct(hit2), "| same result on retake:", pct(retest));
console.log("spread (measured):", Object.fromEntries(M.IDS.map((id) => [id, pct(dist[id] || 0)])));
console.log("spread (true):", Object.fromEntries(M.IDS.map((id) => [id, pct(truth[id] || 0)])));
let mind = 9, pair = ""; for (const a of M.IDS) for (const b of M.IDS) if (a < b) { const c = M.cos(M.P[a], M.P[b]); if (1 - c < mind) { mind = 1 - c; pair = a + "~" + b + " cos " + c.toFixed(2); } }
console.log("closest prototype pair:", pair);
