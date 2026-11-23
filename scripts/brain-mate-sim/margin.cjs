// accuracy by how clearly someone is their type, + top-2 hit + norm effect
const B = require("./model.cjs"); const F = require(process.env.INSTR ?? "./final4.cjs"); const T = B.T;
if (process.env.PROFILES) Object.assign(B.P, Object.fromEntries(Object.entries(require(process.env.PROFILES)).map(([k, o]) => [k, T.map((t) => o[t] ?? 0)])));
const pop = [...Array(8000)].map(() => F.raw(F.respond(B.person())));
const MU = T.map((_,k)=>pop.reduce((s,r)=>s+r[k],0)/pop.length), SD = T.map((_,k)=>Math.sqrt(pop.reduce((s,r)=>s+(r[k]-MU[k])**2,0)/pop.length));
const zOf = (r) => r.map((x,k)=>(x-MU[k])/SD[k]);
for (const id of B.IDS) B.BIAS[id] = 0;
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
const zs = pop.map(zOf);
for (let it = 0; it < 80; it++) { const n = Object.fromEntries(B.IDS.map(id=>[id,0])); for (const z of zs) n[rank(z)[0].id]++; for (const id of B.IDS) B.BIAS[id] += 0.02*(1/12 - n[id]/zs.length)*12; }
// trait reliability
const ts=[...Array(5000)].map(()=>B.person()); const ms=ts.map(t=>zOf(F.raw(F.respond(t))));
const r=(a,b)=>{const n=a.length,ma=a.reduce((s,x)=>s+x)/n,mb=b.reduce((s,x)=>s+x)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return c/Math.sqrt(va*vb);};
console.log("trait r:", T.map((k,i)=>`${k} ${r(ts.map(t=>t[i]),ms.map(m=>m[i])).toFixed(2)}`).join(" "));
const bins=[[0.08,0.15],[0.15,0.25],[0.25,0.4],[0.4,9]]; const st=bins.map(()=>({n:0,h:0,h2:0}));
let all={n:0,h:0,h2:0};
for(let i=0;i<30000;i++){const t=B.person();const tr=rank(t);const m=tr[0].c-tr[1].c;const g=rank(zOf(F.raw(F.respond(t))));
 const hit=g[0].id===tr[0].id, h2=hit||g[1].id===tr[0].id; all.n++;all.h+=hit;all.h2+=h2;
 const b=bins.findIndex(([lo,hi])=>m>=lo&&m<hi); if(b>=0){st[b].n++;st[b].h+=hit;st[b].h2+=h2;}}
bins.forEach(([lo,hi],i)=>console.log(`margin ${lo}-${hi}: ${(100*st[i].n/all.n).toFixed(0)}% of people · top1 ${(100*st[i].h/st[i].n).toFixed(0)}% · top2 ${(100*st[i].h2/st[i].n).toFixed(0)}%`));
console.log(`everyone: top1 ${(100*all.h/all.n).toFixed(0)}% top2 ${(100*all.h2/all.n).toFixed(0)}%`);
