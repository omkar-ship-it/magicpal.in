// Brain-Mate v5 simulation: 9 traits — Ambition (V) split from Follow-through (D).
// MODE=confusion|margin. TRAITS=8 runs the v4 instrument on the same model for comparison.
const NINE = process.env.TRAITS !== "8";
const T = NINE ? ["O","I","V","D","S","E","A","C","H"] : ["O","I","D","S","E","A","C","H"];
const v = (o) => T.map((k) => o[k] ?? 0); const one = (k) => v({ [k]: 1 });
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), norm=(a)=>Math.sqrt(dot(a,a)), cos=(a,b)=>dot(a,b)/((norm(a)*norm(b))||1);
function gauss(){ let u=0,w=0; while(!u)u=Math.random(); while(!w)w=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); }
const ix = (k) => T.indexOf(k);
function person(){ const z = T.map(()=>gauss()); const t=[...z];
  t[ix("I")] += 0.3*z[ix("O")]; t[ix("S")] += 0.4*z[ix("D")]; t[ix("A")] += 0.3*z[ix("E")];
  t[ix("H")] += 0.3*z[ix("C")] - 0.3*z[ix("A")];
  if (NINE) t[ix("V")] += 0.3*z[ix("O")] + 0.3*z[ix("A")] + 0.2*z[ix("D")];
  return t; }
const PROF = require(process.env.PROFILES ?? "./profiles9.json");
const P = Object.fromEntries(Object.entries(PROF).map(([k,o]) => [k, v(o)])); const IDS = Object.keys(P);
// instrument (mirrors rounds.ts v5)
const WYR = T.map(one), TEND = T.map(one);
const CALLS = [["A","C"],["H","A"],["O","D"],["S","E"],["I","C"],["D","H"],["D","I"], NINE?["V","I"]:["O","I"], ...(NINE?[["V","D"]]:[])].map(p=>p.map(one));
const RANK = [["D","O","C","E","S"],["O","I","A","H","D"],["S","E","A","C","H"]].map(r=>r.map(one));
const SLIDERS = (NINE?["D","S","H","A","E","C","V"]:["D","S","H","A","E","C"]).map(one);
const BETA=1.3;
const pick=(opts,t)=>{const w=opts.map(o=>Math.exp(BETA*dot(o,t)+0.35*gauss()));let r=Math.random()*w.reduce((a,b)=>a+b);for(let i=0;i<w.length;i++){r-=w[i];if(r<=0)return i;}return w.length-1;};
const respond=(t)=>({ wyr: WYR.map(l=>(dot(l,t)+0.7*gauss())>0?1:0),
  tend: TEND.map(l=>{const x=dot(l,t)+0.7*gauss();return x<-0.8?0:x<0?1:x<0.8?2:3;}),
  calls: CALLS.map(o=>pick(o,t)),
  rank: RANK.map(c=>c.map((x,i)=>({i,u:dot(x,t)+0.6*gauss()})).sort((a,b)=>b.u-a.u).map(x=>x.i)),
  sliders: SLIDERS.map(l=>Math.max(-1,Math.min(1,(dot(l,t)+0.7*gauss())/2))) });
function raw(a){ const s=T.map(()=>0), n=T.map(()=>0); const add=(l,val,w=1)=>l.forEach((x,k)=>{if(x){n[k]+=Math.abs(x)*w;s[k]+=x*val*w;}});
  a.wyr.forEach((c,q)=>add(WYR[q],c?1:-1,1.2)); a.calls.forEach((c,q)=>CALLS[q].forEach((o,i)=>add(o,i===c?1:-1)));
  a.rank.forEach((o,q)=>o.forEach((ci,pos)=>add(RANK[q][ci],1.5-3*pos/4)));
  a.tend.forEach((c,q)=>add(TEND[q],[-1.5,-0.5,0.5,1.5][c],1.3)); a.sliders.forEach((x,q)=>add(SLIDERS[q],x*1.8,1.2));
  return s.map((x,k)=>n[k]?x/n[k]:0); }
const pop=[...Array(8000)].map(()=>raw(respond(person())));
const MU=T.map((_,k)=>pop.reduce((s,r)=>s+r[k],0)/pop.length), SD=T.map((_,k)=>Math.sqrt(pop.reduce((s,r)=>s+(r[k]-MU[k])**2,0)/pop.length));
const zOf=(r)=>r.map((x,k)=>(x-MU[k])/SD[k]);
const BIAS=Object.fromEntries(IDS.map(id=>[id,0]));
const rank=(vec)=>IDS.map(id=>({id,c:cos(vec,P[id])+BIAS[id]})).sort((x,y)=>y.c-x.c);
const zs=pop.map(zOf);
for(let it=0;it<80;it++){const n=Object.fromEntries(IDS.map(id=>[id,0]));for(const z of zs)n[rank(z)[0].id]++;for(const id of IDS)BIAS[id]+=0.02*(1/12-n[id]/zs.length)*12;}
function classify(z,t){ const add=T.map(()=>0), used=new Set();
  for(let k=0;k<3;k++){ const r=rank(z.map((x,i)=>x+add[i])); let A=r[0].id,Bb=r[1].id,key=[A,Bb].sort().join("|"); if(used.has(key)){Bb=r[2].id;key=[A,Bb].sort().join("|");} used.add(key);
    const diff=P[A].map((x,i)=>x-P[Bb][i]); const d=diff.map(x=>x/norm(diff));
    const p=Math.random()<1/(1+Math.exp(-1.3*1.4*dot(d,t)-0.35*gauss())); d.forEach((x,i)=>add[i]+=(p?1:-1)*0.45*x); }
  const r=rank(z.map((x,i)=>x+add[i])); return [r[0].id, r[1].id]; }
module.exports = { T, P, IDS, BIAS, MU, SD, NORM: {MU,SD}, rank, cos, v, raw, respond, person };
if (require.main === module) {
  const corr=(a,b)=>{const n=a.length,ma=a.reduce((s,x)=>s+x)/n,mb=b.reduce((s,x)=>s+x)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return c/Math.sqrt(va*vb);};
  const ts=[...Array(5000)].map(person), ms=ts.map(t=>zOf(raw(respond(t))));
  console.log(`${process.env.LABEL ?? ""}\n  trait r: ` + T.map((k,i)=>`${k} ${corr(ts.map(t=>t[i]),ms.map(m=>m[i])).toFixed(2)}`).join(" "));
  const conf={}, tot={}; let clear=0, hit=0, top2=0;
  for(let i=0;i<30000;i++){ const t=person(); const tr=rank(t); if(tr[0].c-tr[1].c<0.08) continue;
    const [g,g2]=classify(zOf(raw(respond(t))),t); clear++; hit+=g===tr[0].id; top2+=g===tr[0].id||g2===tr[0].id;
    tot[tr[0].id]=(tot[tr[0].id]||0)+1; conf[tr[0].id]??={}; conf[tr[0].id][g]=(conf[tr[0].id][g]||0)+1; }
  console.log(`  overall ${(100*hit/clear).toFixed(1)}% · right type in top two ${(100*top2/clear).toFixed(1)}%`);
  IDS.map(id=>{const c=conf[id]??{};return {id,rec:(c[id]||0)/(tot[id]||1),miss:Object.entries(c).filter(([k])=>k!==id).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,x])=>`${k} ${(100*x/tot[id]).toFixed(0)}%`).join(", ")};})
    .sort((a,b)=>a.rec-b.rec).forEach(r=>console.log(`  ${r.id.padEnd(11)} ${(100*r.rec).toFixed(0).padStart(3)}%   mistaken for: ${r.miss}`));
  const pairs=[]; for(const a of IDS) for(const b of IDS) if(a<b) pairs.push([a,b,cos(P[a],P[b])]);
  console.log("  closest: "+pairs.sort((x,y)=>y[2]-x[2]).slice(0,5).map(p=>`${p[0]}~${p[1]} ${p[2].toFixed(2)}`).join(" · "));
}
