// Brain-Mate v2 — psychometric simulation. Traits: O I D S E A C H
const T = ["O","I","D","S","E","A","C","H"];
const v = (o) => T.map((k) => o[k] ?? 0);

// ---- archetype prototypes (z-units)
const P = {
  dreamer:    v({O:2, S:-1, E:1, A:1}),
  explorer:   v({O:1.5, I:1, D:-0.5, S:-1.5, E:0.5}),
  creator:    v({O:2, D:1, E:-0.5, H:0.5}),
  maverick:   v({O:0.5, I:1, S:-1, A:1, C:-0.5, H:-2}),
  detective:  v({I:2, D:0.5, S:0.5, E:-1}),
  strategist: v({I:1, D:1, S:2, A:0.5}),
  spark:      v({O:0.5, I:-0.5, S:-1, E:2, A:1}),
  maker:      v({O:0.5, I:-0.5, D:2, S:-1}),
  doer:       v({O:-0.5, D:2, S:1, A:0.5}),
  connector:  v({E:2, C:1, H:0.5}),
  mentor:     v({I:1, E:-0.5, C:2, H:0.5}),
  peacemaker: v({S:0.5, A:-1, C:1, H:2}),
};
const IDS = Object.keys(P);

// ---- item bank
const SCEN = [
  [v({O:1}), v({I:1}), v({D:1}), v({E:1})],
  [v({O:1}), v({I:1}), v({A:1}), v({C:1})],
  [v({A:1,H:-1}), v({I:1}), v({C:1}), v({H:1})],
  [v({O:1}), v({S:1}), v({D:1}), v({E:1})],
  [v({E:1}), v({C:1}), v({E:-1}), v({D:1})],
  [v({O:1}), v({S:1}), v({A:1}), v({C:1})],
  [v({S:1}), v({A:1}), v({E:1}), v({H:1})],
  [v({A:1}), v({H:1}), v({O:1}), v({I:1})],
];
const SWIPE = [v({O:1}), v({I:1}), v({D:1}), v({S:1}), v({E:1}), v({A:1}), v({C:1}), v({H:1}),
  v({O:-1}), v({I:-1}), v({D:-1}), v({S:-1}), v({E:-1}), v({A:-1}), v({C:-1}), v({H:-1})];

const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const norm = (a) => Math.sqrt(dot(a,a));
const cos = (a,b) => dot(a,b)/((norm(a)*norm(b))||1);
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }

// latent with realistic mild correlations
function person(){
  const z = T.map(()=>gauss());
  const t = [...z];
  t[1] += 0.3*z[0];           // I ~ O
  t[3] += 0.4*z[2];           // S ~ D
  t[5] += 0.3*z[4];           // A ~ E
  t[7] += 0.3*z[6] - 0.3*z[5];// H ~ C, ~ -A
  return t;
}
const BETA = Number(process.env.BETA ?? 1.3), NOISE = Number(process.env.NOISE ?? 0.8);
function answer(t){
  const scen = SCEN.map((opts)=>{ const w = opts.map(o=>Math.exp(BETA*dot(o,t)+0.35*gauss())); const s=w.reduce((a,b)=>a+b); let r=Math.random()*s; for(let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i;} return w.length-1; });
  const swipe = SWIPE.map((l)=>{ const x = dot(l,t)/norm(l)+NOISE*gauss(); return x<-0.8?0:x<0?1:x<0.8?2:3; });
  return { scen, swipe };
}
const SW_VAL = [-1.5,-0.5,0.5,1.5];
function rawTraits(a){
  const s = T.map(()=>0), n = T.map(()=>0);
  SCEN.forEach((opts,q)=>{ opts.forEach((o,i)=>{ o.forEach((x,k)=>{ if(x){ n[k]+=Math.abs(x); if(i===a.scen[q]) s[k]+=x*2; } }); }); });
  SWIPE.forEach((l,q)=>{ l.forEach((x,k)=>{ if(x){ n[k]+=Math.abs(x); s[k]+=x*SW_VAL[a.swipe[q]]; } }); });
  return s.map((x,k)=>x/n[k]);
}
let MU=null, SD=null;
function calibrate(N=8000){ const R=[...Array(N)].map(()=>rawTraits(answer(person()))); MU=T.map((_,k)=>R.reduce((s,r)=>s+r[k],0)/N); SD=T.map((_,k)=>Math.sqrt(R.reduce((s,r)=>s+(r[k]-MU[k])**2,0)/N)); module.exports.MU=MU; module.exports.SD=SD; }
const zTraits = (a) => rawTraits(a).map((x,k)=>(x-MU[k])/SD[k]);
const BIAS = Object.fromEntries(Object.keys(P).map(id=>[id,0]));
const rank = (vec) => IDS.map(id=>({id, c: cos(vec, P[id]) + BIAS[id]})).sort((x,y)=>y.c-x.c);
function classify(a, t, duel=true){
  const r = rank(zTraits(a));
  let top = r[0].id, second = r[1].id;
  // the final duel: picks between the two candidates, answered from the true self with noise
  if (duel && r[0].c - r[1].c < 0.12) {
    const d = cos(t,P[top]) - cos(t,P[second]);
    if (Math.random() > 1/(1+Math.exp(-6*d))) [top, second] = [second, top];
  }
  return { top, second, margin: r[0].c - r[1].c, z: zTraits(a) };
}
module.exports = { BIAS, T, P, IDS, SCEN, SWIPE, person, answer, rawTraits, calibrate, zTraits, rank, classify, cos, dot, norm };

// ---- adaptive duels: each duel card contrasts the current top two archetypes on
// the traits where their profiles differ most. Answered from the true self + noise.
function classifyAdaptive(a, t, rounds = 3) {
  const z = zTraits(a);
  const extra = T.map(() => 0);
  const used = new Set();
  let r = rank(z);
  for (let k = 0; k < rounds; k++) {
    r = rank(z.map((x, i) => x + extra[i]));
    let [A, B] = [r[0].id, r[1].id];
    let key = [A, B].sort().join("|");
    if (used.has(key)) { B = r[2].id; key = [A, B].sort().join("|"); }
    used.add(key);
    const diff = P[A].map((x, i) => x - P[B][i]);
    const d = diff.map((x) => x / norm(diff));
    const pA = 1 / (1 + Math.exp(-BETA * 1.4 * dot(d, t) - 0.35 * gauss()));
    const pickA = Math.random() < pA;
    d.forEach((x, i) => (extra[i] += (pickA ? 1 : -1) * 0.45 * x));
  }
  r = rank(z.map((x, i) => x + extra[i]));
  return { top: r[0].id, second: r[1].id, margin: r[0].c - r[1].c };
}
module.exports.classifyAdaptive = classifyAdaptive;
