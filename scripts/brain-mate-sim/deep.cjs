const M = require("./model.cjs");
M.calibrate(); Object.assign(M.BIAS, require("./bias.json"));
const N = 6000; const est = [], tru = [];
let clear = 0, clearHit = 0, clearRe = 0, cusp = 0;
const ROUNDS = Number(process.env.ROUNDS ?? 3);
for (let i = 0; i < N; i++) {
  const t = M.person(); const r = M.rank(t); const margin = r[0].c - r[1].c;
  const ans = M.answer(t); est.push(M.zTraits(ans)); tru.push(t);
  const a = M.classifyAdaptive(ans, t, ROUNDS), b = M.classifyAdaptive(M.answer(t), t, ROUNDS);
  if (a.margin < 0.05) cusp++;
  if (margin > 0.15) { clear++; if (a.top === r[0].id) clearHit++; if (a.top === b.top) clearRe++; }
}
const corr = (k) => { const x = est.map((e) => e[k]), y = tru.map((t) => t[k]); const mx = x.reduce((a, b) => a + b) / N, my = y.reduce((a, b) => a + b) / N; let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < N; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return (sxy / Math.sqrt(sx * sy)).toFixed(2); };
console.log("trait accuracy r:", Object.fromEntries(M.T.map((k, i) => [k, corr(i)])));
console.log(`clear-type people: ${(100 * clear / N).toFixed(0)}% of all · recovered ${(100 * clearHit / clear).toFixed(1)}% · same on retake ${(100 * clearRe / clear).toFixed(1)}%`);
console.log(`results flagged as a cusp: ${(100 * cusp / N).toFixed(1)}%`);
