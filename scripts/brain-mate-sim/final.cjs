// The final v3 instrument, exactly as it will ship, for calibration export.
const B = require("./model.cjs");
const T = B.T; const v = (o) => T.map((k) => o[k] ?? 0); const one = (k, s = 1) => v({ [k]: s });
const dot = B.dot, norm = B.norm;
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const BETA = 1.3;
const STORY = [
  [one("O"), one("S"), one("E"), one("I")], [one("O"), one("I"), one("A"), one("C")], [one("E"), one("C"), one("E",-1), one("A")],
  [v({A:1,H:-1}), one("I"), one("C"), one("H")], [one("D"), one("S"), one("O"), one("E")], [one("A"), one("H"), one("O"), one("I")], [one("S"), one("D"), one("C"), one("I")],
];
const PAIRS = T.map((k) => one(k));
const RANK = [[one("D"), one("O"), one("C"), one("E"), one("S")], [one("O"), one("I"), one("A"), one("H"), one("D")], [one("S"), one("E"), one("A"), one("C"), one("H")]];
const AGREE = [one("O"), one("I"), one("D"), one("S"), one("E"), one("A"), one("C"), one("H"), one("D",-1), one("S",-1), one("E",-1), one("H",-1)];
const SLIDERS = [one("D"), one("S"), one("H"), one("A"), one("E"), one("C")];
function respond(t) {
  const pick = (opts) => { const w = opts.map(o => Math.exp(BETA*dot(o,t)+0.35*gauss())); let r=Math.random()*w.reduce((a,b)=>a+b); for (let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i;} return w.length-1; };
  const agreeOn = (l) => (dot(l,t)/norm(l) + 0.8*gauss()) > 0 ? 1 : 0;
  return {
    story: STORY.map(pick), pairs: PAIRS.map(agreeOn),
    rank: RANK.map(cards => cards.map((c, i) => ({ i, u: dot(c,t) + 0.6*gauss() })).sort((a,b) => b.u - a.u).map(x => x.i)),
    agree: AGREE.map(agreeOn), sliders: SLIDERS.map(l => Math.max(-1, Math.min(1, (dot(l,t) + 0.7*gauss()) / 2))), agreeOn,
  };
}
function raw(a, only) {
  const s = T.map(()=>0), n = T.map(()=>0);
  const add = (l, val, w=1) => l.forEach((x,k) => { if (x) { n[k] += Math.abs(x)*w; s[k] += x*val*w; } });
  if (only !== "level") { a.story.forEach((c,q) => STORY[q].forEach((o,i) => add(o, i===c ? 2 : 0)));
    a.pairs.forEach((c,q) => add(PAIRS[q], c ? 1 : -1));
    a.rank.forEach((order,q) => { const m = order.length; order.forEach((ci, pos) => add(RANK[q][ci], 1.5 - 3*pos/(m-1))); }); }
  if (only !== "choice") { a.agree.forEach((c,q) => add(AGREE[q], c ? 1 : -1)); a.sliders.forEach((x,q) => add(SLIDERS[q], x*1.8, 1.2)); }
  return s.map((x,k) => n[k] ? x/n[k] : 0);
}
module.exports = { respond, raw, T };
