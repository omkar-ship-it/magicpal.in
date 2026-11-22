const M = require("./model.cjs");
M.calibrate();
// Fit a small per-archetype offset so each lands near 1/12 of real players.
const pop = [...Array(8000)].map(() => M.zTraits(M.answer(M.person())));
for (let it = 0; it < 60; it++) {
  const n = Object.fromEntries(M.IDS.map((id) => [id, 0]));
  for (const z of pop) n[M.rank(z)[0].id]++;
  for (const id of M.IDS) M.BIAS[id] += 0.02 * (1 / 12 - n[id] / pop.length) * 12;
}
const n = Object.fromEntries(M.IDS.map((id) => [id, 0]));
for (const z of pop) n[M.rank(z)[0].id]++;
console.log("offsets:", JSON.stringify(Object.fromEntries(M.IDS.map((id) => [id, +M.BIAS[id].toFixed(3)]))));
console.log("spread:", Object.fromEntries(M.IDS.map((id) => [id, (100 * n[id] / pop.length).toFixed(1) + "%"])));
require("fs").writeFileSync("bias.json", JSON.stringify(M.BIAS));
