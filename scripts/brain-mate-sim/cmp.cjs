const M = require("./model.cjs");
const [O, I, D, S, E, A, C, H] = [0, 1, 2, 3, 4, 5, 6, 7];
const clip = (x) => Math.max(0, Math.min(1, x));
const W = [1.5, 1, 0.5, 0.5, 1, 0.5, 1, 1]; // similarity weights: openness, values-adjacent and social traits count most
function traitSim(a, b) { let s = 0, w = 0; a.forEach((x, k) => { s += W[k] * Math.abs(x - b[k]); w += W[k]; }); return clip(1 - s / w / 2.5); }
function parts(a, b) {
  const orient = (z) => (z[O] + z[I]) / 2 - (z[D] + z[S]) / 2;      // + ideas, - execution
  const role = clip(Math.abs(orient(a) - orient(b)) / 2.5);           // complementary roles
  const lead = clip(0.55 + 0.22 * Math.abs(a[A] - b[A]) - 0.3 * Math.max(0, a[A] + b[A] - 1)); // one leads, one supports
  const warmth = clip(1 - Math.abs(a[C] - b[C]) / 3 + 0.1 * Math.max(0, Math.min(a[C], b[C])));  // warmth works best similar
  const structure = clip(1 - Math.abs(a[S] - b[S]) / 3);              // big structure gaps breed friction
  const challenge = clip(1 - 0.6 * Math.max(0, -a[H] - 0.3) * Math.max(0, -b[H] - 0.3)); // only two challengers together clash
  return { role, lead, warmth, structure, challenge };
}
function compat(a, b) { const p = parts(a, b); return 0.3 * p.role + 0.2 * p.lead + 0.2 * p.warmth + 0.15 * p.structure + 0.15 * p.challenge; }
module.exports = { traitSim, compat, parts };

if (require.main === module) {
  // ---------------- archetype-level default matrix, derived
  const ids = M.IDS, code = {};
  const pairs = [];
  for (const a of ids) for (const b of ids) if (a !== b) pairs.push({ a, b, s: traitSim(M.P[a].map(x => x * 0.8), M.P[b].map(x => x * 0.8)), c: compat(M.P[a].map(x => x * 0.8), M.P[b].map(x => x * 0.8)), p: parts(M.P[a].map(x => x * 0.8), M.P[b].map(x => x * 0.8)) });
  const q = (arr, f) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
  const sHi = q(pairs.map(p => p.s), 0.8), sVeryLo = q(pairs.map(p => p.s), 0.2), cHi = q(pairs.map(p => p.c), 0.65);
  for (const p of pairs) {
    // Friction comes from four sources (interpersonal and team-conflict research):
    //  two people who both lead; two who both fight the consensus;
    //  a thinking-style gap (evidence-first and slow-to-warm vs gut-first and
    //  social); an extreme structure gap (planner vs improviser); or a
    //  challenge-vs-harmony gap. A *moderate* structure gap between
    //  complementary roles is the visionary-operator pair: a watch-out, not friction.
    const A_ = M.P[p.a].map(x => x * 0.8), B_ = M.P[p.b].map(x => x * 0.8);
    const gap = (k) => Math.abs(A_[k] - B_[k]);
    const styleGap = gap(1) >= 2 && gap(4) >= 2;
    const planGap = gap(3) >= 2.2 && p.p.role < 0.5;
    const harmonyGap = gap(7) >= 3;
    const peopleClash = p.p.lead < 0.45 || p.p.challenge < 0.6;
    const friction = peopleClash || styleGap || planGap || harmonyGap;
    let k = "GC";
    if (p.s >= sHi && !peopleClash) k = "BM";
    else if (friction) k = "FF";
    else if (p.c >= cHi) k = "PD";
    else if (p.s <= sVeryLo) k = "BC";
    code[p.a + "|" + p.b] = k;
  }
  for (const a of ids) code[a + "|" + a] = "BM";
  const short = { dreamer: "Dr", explorer: "Ex", creator: "Cr", maverick: "Mv", detective: "De", strategist: "St", spark: "Sp", maker: "Mk", doer: "Do", connector: "Co", mentor: "Me", peacemaker: "Pe" };
  console.log("      " + ids.map(i => short[i]).join(" "));
  for (const a of ids) console.log(short[a].padEnd(5) + " " + ids.map(b => code[a + "|" + b]).join(" "));
  const counts = {}; for (const a of ids) for (const b of ids) if (a < b) counts[code[a + "|" + b]] = (counts[code[a + "|" + b]] || 0) + 1;
  console.log("pairs:", counts);
  require("fs").writeFileSync("matrix.json", JSON.stringify(code));
}
