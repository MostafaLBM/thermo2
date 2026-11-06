
const S=[{n:'A',m:1,c:'#e8590c',N:100},{n:'B',m:4,c:'#1c7ed6',N:60}];
const H=4.2,VW=6.4,VH=4.6,OX=.2,OY=.2,TAU=2;
let W=4.5,kT=2.25,sig=0,scaleR=2,cw=4.4,ch=4.1,paused=false,parts=S.map(()=>[]),Pm=[null,null],css={};
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const g=()=>{let u=0;while(!u)u=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*Math.random())};
function add(s){cw=W-sig;ch=H-sig;const sd=Math.sqrt(kT/S[s].m);parts[s].push({x:Math.random()*cw,y:Math.random()*ch,vx:g()*sd,vy:g()*sd})}
function setN(s,n){while(parts[s].length<n)add(s);while(parts[s].length>n)parts[s].pop()}
function reset(){cw=W-sig;ch=H-sig;parts=S.map(()=>[]);S.forEach((s,i)=>setN(i,s.N));Pm=[null,null]}
function ema(dt,imp){const per=2*(W+H),a=Math.min(1,dt/TAU);for(let s=0;s<2;s++){const r=imp[s]/(dt*per);Pm[s]=Pm[s]===null?r:Pm[s]+(r-Pm[s])*a}}
function step(dt){cw=W-sig;ch=H-sig;const imp=[0,0],n=3;for(let k=0;k<n;k++){move(dt/n,imp);collide()}ema(dt,imp)}
function collide(){
  if(sig<=0)return;
  const all=[];for(let s=0;s<2;s++)for(const p of parts[s]){p.s=s;all.push(p)}
  const cs=Math.max(sig,.05),nx=Math.ceil(cw/cs)+2,ny=Math.ceil(ch/cs)+2,hd=new Int32Array(nx*ny).fill(-1),nt=new Int32Array(all.length),s2=sig*sig;
  all.forEach((p,i)=>{p.c=Math.min(nx-1,Math.max(0,Math.floor(p.x/cs)))+nx*Math.min(ny-1,Math.max(0,Math.floor(p.y/cs)));nt[i]=hd[p.c];hd[p.c]=i});
  for(let i=0;i<all.length;i++){const a=all[i],cx=a.c%nx,cy=(a.c-cx)/nx;
    for(let u=Math.max(0,cx-1);u<=Math.min(nx-1,cx+1);u++)for(let w=Math.max(0,cy-1);w<=Math.min(ny-1,cy+1);w++)
      for(let j=hd[u+nx*w];j>=0;j=nt[j]){if(j<=i)continue;const b=all[j],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
        if(d2>=s2)continue;const d=Math.sqrt(d2)||1e-9,ux=dx/d,uy=dy/d,o=(sig-d)/2,ma=S[a.s].m,mb=S[b.s].m;
        a.x-=ux*o;a.y-=uy*o;b.x+=ux*o;b.y+=uy*o;
        const rv=(a.vx-b.vx)*ux+(a.vy-b.vy)*uy;
        if(rv>0){const J=2*rv/(1/ma+1/mb);a.vx-=J/ma*ux;a.vy-=J/ma*uy;b.vx+=J/mb*ux;b.vy+=J/mb*uy}}}
}
function move(dt,imp){const W=cw,H=ch;
  for(let s=0;s<2;s++){const m=S[s].m;
    for(const p of parts[s]){
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.x<0){p.x=-p.x;imp[s]+=2*m*Math.abs(p.vx);p.vx=Math.abs(p.vx)}
      else if(p.x>W){p.x=2*W-p.x;imp[s]+=2*m*Math.abs(p.vx);p.vx=-Math.abs(p.vx)}
      if(p.y<0){p.y=-p.y;imp[s]+=2*m*Math.abs(p.vy);p.vy=Math.abs(p.vy)}
      else if(p.y>H){p.y=2*H-p.y;imp[s]+=2*m*Math.abs(p.vy);p.vy=-Math.abs(p.vy)}
      p.x=Math.min(Math.max(p.x,0),W);p.y=Math.min(Math.max(p.y,0),H);
    }}
  
}
function readCss(){const c=getComputedStyle(document.documentElement);css={box:'#edf1e9',line:'#b5c8c0',wall:'#19363d',fg:'#19363d'}}
function resize(){const d=devicePixelRatio||1;cv.width=cv.clientWidth*d;cv.height=cv.clientHeight*d}
function draw(){
  const sc=cv.width/VW;ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle=css.box;ctx.fillRect(OX*sc,OY*sc,W*sc,H*sc);
  ctx.strokeStyle=css.line;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(OX*sc,OY*sc,VW*sc*0+ (6-0.2*0)*sc-OX*sc*0,H*sc);ctx.setLineDash([]);
  for(let s=0;s<2;s++){ctx.fillStyle=S[s].c;const r=(sig>0?sig/2:.03)*sc;
    for(const p of parts[s]){ctx.beginPath();ctx.arc((OX+sig/2+p.x)*sc,(OY+sig/2+p.y)*sc,r,0,6.2832);ctx.fill()}}
  ctx.strokeStyle=css.wall;ctx.lineWidth=3;ctx.beginPath();
  ctx.moveTo((OX+W)*sc,OY*sc-1);ctx.lineTo((OX+W)*sc,(OY+H)*sc+1);ctx.stroke();
  ctx.lineWidth=2;ctx.strokeRect(OX*sc,OY*sc,W*sc,H*sc);
}
const f=(x,d=2)=>x==null?'–':x.toFixed(d);
function table(){
  const A=W*H,Nt=parts.reduce((a,p)=>a+p.length,0);let sm=0,th=0,h='',bar='';
  const eta=Nt*Math.PI*sig*sig/4/A;
  const id=Math.max(1e-9,Nt*kT/A),r=Pm.reduce((a,b)=>a+(b||0),0)/id;if(r>.9*scaleR)scaleR=Math.ceil(r/.75);else if(r<.4*scaleR)scaleR=Math.max(2,Math.ceil(r/.75));const Pmax=id*scaleR;
  for(let s=0;s<2;s++){const N=parts[s].length,t=N*kT/A,v=N?Pm[s]:0;sm+=v||0;th+=t;
    h+=`<tr><td><span class="dot" style="background:${S[s].c}"></span>${S[s].n} (m=${S[s].m})</td><td>${N}</td><td>${f(Nt?N/Nt:0)}</td><td>${f(v)}</td><td>${f(t)}</td></tr>`;
    bar+=`<i style="width:${100*(v||0)/Pmax}%;background:${S[s].c}"></i>`}
  h+=`<tr class="tot"><td>Total</td><td>${Nt}</td><td>${Nt?'1.00':'–'}</td><td>${f(sm)}</td><td>${f(th)}</td></tr>`;
  document.getElementById('tb').innerHTML=h;
  document.getElementById('bar').innerHTML=bar+`<span class="mk" style="left:${100*th/Pmax}%"></span>`;
  document.getElementById('mP').textContent=f(sm);document.getElementById('mE').textContent=eta.toFixed(3);document.getElementById('mR').textContent=th>0?(sm/th).toFixed(2):'–';
}
// controls
const sl=document.getElementById('sl');
S.forEach((s,i)=>{const r=document.createElement('div');r.className='row';
  r.innerHTML=`<label for="n${i}"><span class="dot" style="background:${s.c}"></span>${s.n} (m=${s.m})</label><input id="n${i}" type="range" min="0" max="1000" value="${s.N}"><output id="o${i}">${s.N}</output>`;
  sl.appendChild(r);
  r.querySelector('input').addEventListener('input',e=>{const n=+e.target.value;setN(i,n);document.getElementById('o'+i).textContent=n})});
const Tv=document.getElementById('Tv'),Wv=document.getElementById('Wv');
Tv.textContent=kT.toFixed(2);Wv.textContent=W.toFixed(1);
document.getElementById('T').addEventListener('input',e=>{const n=+e.target.value,k=Math.sqrt(n/kT);
  parts.forEach(a=>a.forEach(p=>{p.vx*=k;p.vy*=k}));kT=n;Tv.textContent=n.toFixed(2)});
document.getElementById('W').addEventListener('input',e=>{const n=+e.target.value,k=(n-sig)/(W-sig);
  parts.forEach(a=>a.forEach(p=>{p.x*=k}));W=n;Wv.textContent=n.toFixed(1)});
const Dv=document.getElementById('Dv');Dv.textContent=sig.toFixed(2);
document.getElementById('D').addEventListener('input',e=>{const n=+e.target.value,kx=(W-n)/(W-sig),ky=(H-n)/(H-sig);
  parts.forEach(a=>a.forEach(p=>{p.x*=kx;p.y*=ky}));sig=n;Dv.textContent=n.toFixed(2)});
document.getElementById('pp').onclick=e=>{paused=!paused;e.target.textContent=paused?'Resume':'Pause'};
document.getElementById('rs').onclick=()=>{location.reload()};
for(const range of document.querySelectorAll('input[type=range]')){
  const number=document.createElement('input');number.type='number';
  for(const key of ['min','max','step']) if(range.hasAttribute(key)) number.setAttribute(key,range.getAttribute(key));
  number.value=range.value;number.setAttribute('aria-label',range.labels[0].textContent+' numeric entry');
  range.after(number);
  range.addEventListener('input',()=>{number.value=range.value;Pm=[null,null]});
  number.addEventListener('change',()=>{if(!number.validity.valid||number.value===''){number.value=range.value;return}range.value=number.value;range.dispatchEvent(new Event('input'))});
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',readCss);
addEventListener('resize',resize);
readCss();resize();reset();
let last=performance.now(),tt=0;
function loop(t){const dt=Math.min((t-last)/1000,1/30);last=t;
  if(!paused&&dt>0)step(dt);draw();tt+=dt;if(tt>.2){tt=0;table()}
  requestAnimationFrame(loop)}
requestAnimationFrame(loop);
