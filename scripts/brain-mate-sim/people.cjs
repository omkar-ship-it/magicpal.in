const M = require("./model.cjs"); const Cm = require("./cmp.cjs");
M.calibrate(); Object.assign(M.BIAS, require("./bias.json"));
const matrix = JSON.parse(require("fs").readFileSync("matrix.json", "utf8"));
const [O, I, D, S, E, A, C, H] = [0, 1, 2, 3, 4, 5, 6, 7];
const VALUES = { freedom: [O], adventure: [O, E], achievement: [D, A], influence: [A], stability: [S], helping: [C], fairness: [C, O], fun: [E] };
const TILES = { places: [O], tinkering: [D], art: [O], puzzles: [I], startups: [A, D], sports: [E], people: [E, C], teaching: [C], books: [I, O] };
function pickN(t, table, n) { const w = Object.entries(table).map(([k, ks]) => [k, Math.exp(0.8 * ks.reduce((s, x) => s + t[x], 0) / ks.length + 0.6 * (Math.random() * 2 - 1))]); return w.sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]); }
const jac = (a, b) => { const A_ = new Set(a), B_ = new Set(b); const i = [...A_].filter((x) => B_.has(x)).length; return i / new Set([...a, ...b]).size; };
function player() { const t = M.person(); const ans = M.answer(t); return { z: M.zTraits(ans), arche: M.classifyAdaptive(ans, t, 3).top, values: pickN(t, VALUES, 2), tiles: pickN(t, TILES, 3) }; }
const people = [...Array(3000)].map(player);
const raw = []; for (let i = 0; i < 6000; i++) { const a = people[i % 3000], b = people[(i * 7 + 13) % 3000]; if (a === b) continue;
  raw.push({ a, b, s: 0.5 * Cm.traitSim(a.z, b.z) + 0.3 * jac(a.values, b.values) + 0.2 * jac(a.tiles, b.tiles), c: Cm.compat(a.z, b.z), p: Cm.parts(a.z, b.z) }); }
// Display = position among all pairs, stretched to 32–98 (percentile calibration).
const toDisplay = (arr, key) => { const s = arr.map((x) => x[key]).sort((x, y) => x - y); return (v) => 32 + Math.round(66 * s.findIndex((x) => x >= v) / s.length); };
const dS = toDisplay(raw, "s"), dC = toDisplay(raw, "c");
const out = {}; let agree = 0, comparable = 0;
for (const r of raw) {
  const sim = dS(r.s), comp = dC(r.c), def = matrix[r.a.arche + "|" + r.b.arche];
  const peopleClash = r.p.lead < 0.45 || r.p.challenge < 0.6;
  let o;
  if (sim >= 84 && !peopleClash) o = "BM";
  else if (peopleClash && comp < 72) o = "FF";
  else if (comp >= 80 && comp > sim) o = "PD";
  else if (sim < 45 && comp < 50) o = "BC";
  else if (sim < 52 && comp >= 50 && comp < 80) o = "FF";
  else if (def !== "GC") o = def;
  else o = comp - sim >= 0 ? "PD" : sim >= 70 ? "BM" : "FF";
  out[o] = (out[o] || 0) + 1;
  if (def !== "GC") { comparable++; if (def === o) agree++; }
}
const n = raw.length;
console.log("outcome mix:", Object.fromEntries(Object.entries(out).map(([k, v]) => [k, (100 * v / n).toFixed(0) + "%"])));
console.log(`person-level result matches the archetype default: ${(100 * agree / comparable).toFixed(0)}% (where a default exists)`);
