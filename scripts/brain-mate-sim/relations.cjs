// Power Duo list (best complements first) and the card's clash/opposite line,
// derived from the archetype profiles with the same rules as the table.
const M = require("./model.cjs"); const Cm = require("./cmp.cjs");
const m = JSON.parse(require("fs").readFileSync("matrix.json", "utf8"));
const s = (id) => M.P[id].map((x) => x * 0.8);
function friction(a, b) {
  const A = s(a), B = s(b), p = Cm.parts(A, B), gap = (k) => Math.abs(A[k] - B[k]);
  return Math.max(0, 0.5 - p.lead) * 2 + Math.max(0, 0.7 - p.challenge) * 2 + Math.max(0, Math.min(gap(1), gap(4)) - 1.2) + Math.max(0, gap(3) - 1.6) * (1 - p.role) + Math.max(0, gap(7) - 2) * 0.8;
}
const out = {};
for (const a of M.IDS) {
  const pd = M.IDS.filter((b) => b !== a && m[a + "|" + b] === "PD").map((b) => ({ b, c: Cm.compat(s(a), s(b)) })).sort((x, y) => y.c - x.c).map((x) => x.b);
  const fr = M.IDS.filter((b) => b !== a).map((b) => ({ b, f: friction(a, b) })).sort((x, y) => y.f - x.f);
  const opp = M.IDS.filter((b) => b !== a && !pd.slice(0, 3).includes(b)).map((b) => ({ b, s: Cm.traitSim(s(a), s(b)) })).sort((x, y) => x.s - y.s);
  out[a] = { powerDuo: pd.slice(0, 3), edge: fr[0].f > 0.2 ? { kind: "clash", id: fr[0].b } : { kind: "opposite", id: opp[0].b } };
}
console.log(JSON.stringify(out));
const ORDER = ["dreamer","explorer","creator","maverick","detective","strategist","spark","maker","doer","connector","mentor","peacemaker"];
require("fs").writeFileSync("rows5.json", JSON.stringify(ORDER.map((a) => ORDER.map((b) => a === b ? "BM" : m[a + "|" + b]).join(" "))));
