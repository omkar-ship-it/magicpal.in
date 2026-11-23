// v4 instrument exactly as it ships: would-you-rather, is-this-you, tough
// calls, prioritise, sliders. Same synthetic respondents as every version.
const B = require("./model.cjs");
const T = B.T; const v = (o) => T.map((k) => o[k] ?? 0); const one = (k, s = 1) => v({ [k]: s });
const dot = B.dot, norm = B.norm;
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const BETA = 1.3;
const WYR = T.map((k) => one(k));
const TEND = T.map((k) => one(k));
const CALLS = [[one("A"),one("C")],[one("H"),one("A")],[one("O"),one("D")],[one("S"),one("E")],[one("I"),one("C")],[one("D"),one("H")]];
const RANK = [[one("D"),one("O"),one("C"),one("E"),one("S")],[one("O"),one("I"),one("A"),one("H"),one("D")],[one("S"),one("E"),one("A"),one("C"),one("H")]];
const SLIDERS = [one("D"),one("S"),one("H"),one("A"),one("E"),one("C")];
const pick = (opts, t) => { const w = opts.map(o => Math.exp(BETA*dot(o,t)+0.35*gauss())); let r=Math.random()*w.reduce((a,b)=>a+b); for (let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i;} return w.length-1; };
function respond(t) {
  return {
    wyr: WYR.map(l => (dot(l,t) + 0.7*gauss()) > 0 ? 1 : 0),
    tend: TEND.map(l => { const x = dot(l,t) + 0.7*gauss(); return x < -0.8 ? 0 : x < 0 ? 1 : x < 0.8 ? 2 : 3; }),
    calls: CALLS.map(o => pick(o, t)),
    rank: RANK.map(cards => cards.map((c, i) => ({ i, u: dot(c,t) + 0.6*gauss() })).sort((a,b) => b.u - a.u).map(x => x.i)),
    sliders: SLIDERS.map(l => Math.max(-1, Math.min(1, (dot(l,t) + 0.7*gauss()) / 2))),
  };
}
function raw(a, only) {
  const s = T.map(()=>0), n = T.map(()=>0);
  const add = (l, val, w=1) => l.forEach((x,k) => { if (x) { n[k] += Math.abs(x)*w; s[k] += x*val*w; } });
  if (only !== "level") {
    a.wyr.forEach((c,q) => add(WYR[q], c ? 1 : -1, 1.2));
    a.calls.forEach((c,q) => CALLS[q].forEach((o,i) => add(o, i===c ? 1 : -1)));
    a.rank.forEach((order,q) => order.forEach((ci,pos) => add(RANK[q][ci], 1.5 - 3*pos/4)));
  }
  if (only !== "choice") {
    a.tend.forEach((c,q) => add(TEND[q], [-1.5,-0.5,0.5,1.5][c], 1.3));
    a.sliders.forEach((x,q) => add(SLIDERS[q], x*1.8, 1.2));
  }
  return s.map((x,k) => n[k] ? x/n[k] : 0);
}
module.exports = { respond, raw };
