const B = require("./model.cjs"); const V = require("./v4.cjs");
Object.assign(B.BIAS, require("./bias.json")); V.calibrate();
const rank = (vec) => B.IDS.map(id => ({ id, c: B.cos(vec, B.P[id]) + B.BIAS[id] })).sort((x,y)=>y.c-x.c);
const pop = [...Array(5000)].map(() => V.respond(B.person()));
for (let it = 0; it < 50; it++) { const n = Object.fromEntries(B.IDS.map(id=>[id,0])); for (const a of pop) n[rank(V.zOf(a, []))[0].id]++; for (const id of B.IDS) B.BIAS[id] += 0.02*(1/12 - n[id]/pop.length)*12; }
const N = 6000; let hit=0, re=0, clear=0, cHit=0, cRe=0; const est=[], tru=[], dist={};
for (let i=0;i<N;i++){ const t=B.person(); const tr=rank(t); const a1=V.classify(V.respond(t),t), a2=V.classify(V.respond(t),t); const r1=a1.r[0].id, r2=a2.r[0].id; dist[r1]=(dist[r1]||0)+1;
  if(r1===tr[0].id)hit++; if(r1===r2)re++; if(tr[0].c-tr[1].c>0.15){clear++; if(r1===tr[0].id)cHit++; if(r1===r2)cRe++;} est.push(a1.z); tru.push(t); }
const corr=(k)=>{const x=est.map(e=>e[k]),y=tru.map(t=>t[k]);const mx=x.reduce((a,b)=>a+b)/N,my=y.reduce((a,b)=>a+b)/N;let sxy=0,sx=0,sy=0;for(let i=0;i<N;i++){sxy+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}return sxy/Math.sqrt(sx*sy);};
const rs=B.T.map((_,k)=>corr(k)); const p=(x,n=N)=>(100*x/n).toFixed(1)+"%"; const vals=Object.values(dist).map(x=>100*x/N);
console.log(`${process.env.LABEL} | trait r ${Math.min(...rs).toFixed(2)}–${Math.max(...rs).toFixed(2)} | everyone ${p(hit)} retake ${p(re)} | clear ${p(cHit,clear)} retake ${p(cRe,clear)} | spread ${Math.min(...vals).toFixed(1)}–${Math.max(...vals).toFixed(1)}%`);
