// v5: the 12×12 default matrix + each archetype's Power Duo list and clash/opposite,
// derived from the APP's nine-trait profiles with the same rules as cmp.cjs / relations.cjs.
// Trait order O I D S E A C H V — V is appended, so every index below is unchanged.
const Ar = require(process.env.APP_DIR + "/archetypes"); const T = Ar.TRAITS;
const ids = ["dreamer","explorer","creator","maverick","detective","strategist","spark","maker","doer","connector","mentor","peacemaker"];
const P = Object.fromEntries(ids.map((id) => [id, T.map((k) => Ar.ARCHETYPES[id].profile[k] * 0.8)]));
const [O, I, D, S, E, A, C, H] = [0, 1, 2, 3, 4, 5, 6, 7];
const clip = (x) => Math.max(0, Math.min(1, x));
const W = [1.5, 1, 0.5, 0.5, 1, 0.5, 1, 1, 1];
const traitSim = (a, b) => { let s = 0, w = 0; a.forEach((x, k) => { s += W[k] * Math.abs(x - b[k]); w += W[k]; }); return clip(1 - s / w / 2.5); };
function parts(a, b) {
  const orient = (z) => (z[O] + z[I]) / 2 - (z[D] + z[S]) / 2;
  return { role: clip(Math.abs(orient(a) - orient(b)) / 2.5), lead: clip(0.55 + 0.22 * Math.abs(a[A] - b[A]) - 0.3 * Math.max(0, a[A] + b[A] - 1)),
    warmth: clip(1 - Math.abs(a[C] - b[C]) / 3 + 0.1 * Math.max(0, Math.min(a[C], b[C]))), structure: clip(1 - Math.abs(a[S] - b[S]) / 3),
    challenge: clip(1 - 0.6 * Math.max(0, -a[H] - 0.3) * Math.max(0, -b[H] - 0.3)) };
}
const compat = (a, b) => { const p = parts(a, b); return 0.3 * p.role + 0.2 * p.lead + 0.2 * p.warmth + 0.15 * p.structure + 0.15 * p.challenge; };
const pairs = []; for (const a of ids) for (const b of ids) if (a !== b) pairs.push({ a, b, s: traitSim(P[a], P[b]), c: compat(P[a], P[b]), p: parts(P[a], P[b]) });
const q = (arr, f) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
const sHi = q(pairs.map(p => p.s), 0.8), sVeryLo = q(pairs.map(p => p.s), 0.2), cHi = q(pairs.map(p => p.c), 0.65);
const code = {};
for (const p of pairs) {
  const gap = (k) => Math.abs(P[p.a][k] - P[p.b][k]);
  const styleGap = gap(I) >= 2 && gap(E) >= 2, planGap = gap(S) >= 2.2 && p.p.role < 0.5, harmonyGap = gap(H) >= 3;
  const peopleClash = p.p.lead < 0.45 || p.p.challenge < 0.6;
  let k = "GC";
  if (p.s >= sHi && !peopleClash) k = "BM"; else if (peopleClash || styleGap || planGap || harmonyGap) k = "FF"; else if (p.c >= cHi) k = "PD"; else if (p.s <= sVeryLo) k = "BC";
  code[p.a + "|" + p.b] = k;
}
function friction(a, b) { const X = P[a], Y = P[b], p = parts(X, Y), gap = (k) => Math.abs(X[k] - Y[k]);
  return Math.max(0, 0.5 - p.lead) * 2 + Math.max(0, 0.7 - p.challenge) * 2 + Math.max(0, Math.min(gap(1), gap(4)) - 1.2) + Math.max(0, gap(3) - 1.6) * (1 - p.role) + Math.max(0, gap(7) - 2) * 0.8; }
const rel = {};
for (const a of ids) {
  const pd = ids.filter((b) => b !== a && code[a + "|" + b] === "PD").map((b) => ({ b, c: compat(P[a], P[b]) })).sort((x, y) => y.c - x.c).map((x) => x.b);
  const fr = ids.filter((b) => b !== a).map((b) => ({ b, f: friction(a, b) })).sort((x, y) => y.f - x.f);
  const opp = ids.filter((b) => b !== a && !pd.slice(0, 3).includes(b)).map((b) => ({ b, s: traitSim(P[a], P[b]) })).sort((x, y) => x.s - y.s);
  // Fewer than three true Power Duos: fill with the best-fitting partners that don't clash.
  const fill = ids.filter((b) => b !== a && !pd.includes(b) && code[a + "|" + b] !== "FF" && code[a + "|" + b] !== "BM" && friction(a, b) <= 0.2).map((b) => ({ b, c: compat(P[a], P[b]) })).sort((x, y) => y.c - x.c).map((x) => x.b);
  pd.push(...fill);
  rel[a] = { powerDuo: pd.slice(0, 3), edge: fr[0].f > 0.2 ? { kind: "clash", id: fr[0].b } : { kind: "opposite", id: opp[0].b } };
}
const rows = ids.map((a) => ids.map((b) => a === b ? "BM" : code[a + "|" + b]).join(" "));
const counts = {}; for (const a of ids) for (const b of ids) if (a < b) counts[code[a + "|" + b]] = (counts[code[a + "|" + b]] || 0) + 1;
console.error(rows.map((r, i) => ids[i].slice(0, 6).padEnd(7) + r).join("\n")); console.error("pairs:", counts);
console.log(JSON.stringify({ rows, rel }));
