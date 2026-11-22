const B = require("./model.cjs"); const V = require("./v4.cjs");
Object.assign(B.BIAS, require("./bias.json")); V.calibrate();
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const N = 5000, p = (x, n) => (100 * x / n).toFixed(1) + "%";
// A friend sees you a bit noisily on each trait (self-other agreement r≈0.6 in the literature).
const friend = (t) => t.map(x => 0.75 * x + 0.66 * gauss());
// A week later you're slightly different (state variation), and you play a short check-in.
const later = (t) => t.map(x => 0.92 * x + 0.39 * gauss());
const z = (t) => V.classify(V.respond(t), t).z;
const variants = {
  "one session (redesign as is)": (t) => z(t),
  "+ a friend's 8 sliders": (t) => z(t).map((x, k, a) => 0.7 * x + 0.3 * friend(t)[k] / 0.99),
  "+ a second session a week later": (t) => { const a = z(t), b = z(later(t)); return a.map((x, k) => (x + b[k]) / 2); },
  "+ both": (t) => { const a = z(t), b = z(later(t)), f = friend(t); return a.map((x, k) => 0.35 * x + 0.35 * b[k] + 0.3 * f[k]); },
};
for (const [label, f] of Object.entries(variants)) {
  let exact = 0, top3 = 0, top2 = 0;
  for (let i = 0; i < N; i++) { const t = B.person(); const truth = rank(t)[0].id; const r = rank(f(t)); if (r[0].id === truth) exact++; if (r.slice(0, 2).some(x => x.id === truth)) top2++; if (r.slice(0, 3).some(x => x.id === truth)) top3++; }
  console.log(`${label.padEnd(36)} exact ${p(exact, N)} · in top two ${p(top2, N)} · in top-3 mix ${p(top3, N)}`);
}
