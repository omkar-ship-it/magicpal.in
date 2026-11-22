const M = require("./model.cjs"); const Cm = require("./cmp.cjs");
M.calibrate(20000); Object.assign(M.BIAS, require("./bias.json"));
const matrix = JSON.parse(require("fs").readFileSync("matrix.json", "utf8"));
// population pairs for display calibration (same generator as people.js)
const [O, I, D, S, E, A, C, H] = [0, 1, 2, 3, 4, 5, 6, 7];
const VALUES = { freedom: [O], adventure: [O, E], achievement: [D, A], influence: [A], stability: [S], helping: [C], fairness: [C, O], fun: [E] };
const TILES = { places: [O], tinkering: [D], art: [O], puzzles: [I], startups: [A, D], sports: [E], people: [E, C], teaching: [C], books: [I, O] };
function pickN(t, table, n) { const w = Object.entries(table).map(([k, ks]) => [k, Math.exp(0.8 * ks.reduce((s, x) => s + t[x], 0) / ks.length + 0.6 * (Math.random() * 2 - 1))]); return w.sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]); }
const jac = (a, b) => { const A_ = new Set(a), B_ = new Set(b); const i = [...A_].filter((x) => B_.has(x)).length; return i / new Set([...a, ...b]).size; };
const ppl = [...Array(4000)].map(() => { const t = M.person(); return { z: M.zTraits(M.answer(t)), values: pickN(t, VALUES, 2), tiles: pickN(t, TILES, 3) }; });
const sims = [], comps = [];
for (let i = 0; i < 20000; i++) { const a = ppl[Math.floor(Math.random() * 4000)], b = ppl[Math.floor(Math.random() * 4000)]; if (a === b) continue;
  sims.push(0.5 * Cm.traitSim(a.z, b.z) + 0.3 * jac(a.values, b.values) + 0.2 * jac(a.tiles, b.tiles)); comps.push(Cm.compat(a.z, b.z)); }
const q = (arr) => { const s = [...arr].sort((x, y) => x - y); return [...Array(21)].map((_, k) => +s[Math.min(s.length - 1, Math.floor(k / 20 * (s.length - 1)))].toFixed(4)); };
const ORDER = ["dreamer","explorer","creator","maverick","detective","strategist","spark","maker","doer","connector","mentor","peacemaker"];
console.log(JSON.stringify({
  MU: M.calibrate && undefined,
}));
const out = {
  mu: M.MU.map(x=>+x.toFixed(4)), sd: M.SD.map(x=>+x.toFixed(4)),
  bias: Object.fromEntries(Object.entries(M.BIAS).map(([k, v]) => [k, +v.toFixed(3)])),
  rows: ORDER.map((a) => ORDER.map((b) => matrix[a + "|" + b]).join(" ")),
  simQ: q(sims), compQ: q(comps),
};
require("fs").writeFileSync("constants.json", JSON.stringify(out, null, 1));
