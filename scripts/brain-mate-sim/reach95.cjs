const B = require("./model.cjs"); const V = require("./v4.cjs");
Object.assign(B.BIAS, require("./bias.json")); V.calibrate();
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
const N = 5000, p = (x, n) => (100 * x / n).toFixed(1) + "%";
let top3 = 0, dirAll = 0, dirAllN = 0, dirClear = 0, dirClearN = 0, band = 0, bandN = 0, strongest = 0, strongestTop2 = 0;
// trait z-scores from the test are on a calibrated scale; standardise truth the same way
for (let i = 0; i < N; i++) {
  const t = B.person(); const res = V.classify(V.respond(t), t); const z = res.z;
  if (res.r.slice(0, 3).some(x => x.id === rank(t)[0].id)) top3++;
  t.forEach((tv, k) => { dirAllN++; if (Math.sign(tv) === Math.sign(z[k])) dirAll++;
    if (Math.abs(tv) > 0.7) { dirClearN++; if (Math.sign(tv) === Math.sign(z[k])) dirClear++; }
    bandN++; if (Math.abs((tv) - z[k] * 1.05) < 1.0) band++; });
  const ts = t.map((x, k) => ({ k, x })).sort((a, b) => b.x - a.x), zs = z.map((x, k) => ({ k, x })).sort((a, b) => b.x - a.x);
  if (ts[0].k === zs[0].k) strongest++; if (ts[0].k === zs[0].k || ts[0].k === zs[1].k) strongestTop2++;
}
let ex=0;
console.log(`${process.env.LABEL}`);
console.log(`true archetype in the top-3 mind mix: ${p(top3, N)}`);
console.log(`each trait on the right side of average: all traits ${p(dirAll, dirAllN)} · traits that are clearly high or low (|z|>0.7): ${p(dirClear, dirClearN)}`);
console.log(`each trait within ±1 point of the truth (on a ±2.5 scale): ${p(band, bandN)}`);
console.log(`your single strongest trait named correctly: ${p(strongest, N)} · within your top two: ${p(strongestTop2, N)}`);
