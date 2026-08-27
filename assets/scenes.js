/* ═══════════════════════════════════════════════════════════════════════════
   TSB Labs 3D scenes. No libraries, no build step, no CDN.

   Software perspective projection onto a 2D canvas: rotate, tilt, project,
   depth sort, draw. Two scenes share the orbit control and the projector.

   The geometry is not decoration. Scene one's forms are the capability list.
   Scene two is a real optimisation landscape with real annealing running on
   it, which is the argument the company makes, shown rather than asserted.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function token(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* Pointer drag orbits the scene; releasing lets the spin carry and decay. */
function orbit(cv, st, onFirstDrag){
  var down=false, px=0, py=0, first=true;
  cv.addEventListener('pointerdown', function(e){
    down=true; cv.classList.add('drag');
    try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    px=e.clientX; py=e.clientY;
    if(first){ first=false; onFirstDrag && onFirstDrag(); }
  });
  cv.addEventListener('pointermove', function(e){
    if(!down) return;
    st.ang  -= (e.clientX-px)*0.006;
    st.tilt  = Math.max(-0.45, Math.min(1.15, st.tilt + (e.clientY-py)*0.004));
    st.spin  = -(e.clientX-px)*0.0004;
    px=e.clientX; py=e.clientY;
  });
  function up(e){
    down=false; cv.classList.remove('drag');
    try{ cv.releasePointerCapture(e.pointerId); }catch(_){}
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}

/* Keeps the backing store matched to CSS pixels and the device ratio. */
function sizer(cv, ctx){
  var s = {w:0, h:0};
  function fit(){
    var dpr = Math.min(window.devicePixelRatio||1, 2);
    s.w = cv.clientWidth; s.h = cv.clientHeight;
    cv.width  = Math.round(s.w*dpr);
    cv.height = Math.round(s.h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  fit();
  window.addEventListener('resize', fit, {passive:true});
  return s;
}

/* ── Scene one: the venture assembling itself ──────────────────────────── */
function ventureScene(cv){
  var ctx=cv.getContext('2d'), N=132, R=52;
  var FORMS=[
    {name:'Quantum optimisation', at:function(i,t){
      var a=t*Math.PI*6, s=(i%2)?1:-1, r=R*0.55;
      return [Math.cos(a)*r*s, (t-0.5)*R*2.5, Math.sin(a)*r*s]; }},
    {name:'Advanced AI systems', at:function(i,t){
      var u=t*Math.PI*14, v=i*2.399963, Rr=R*0.78, rr=R*0.30;
      return [(Rr+rr*Math.cos(v))*Math.cos(u), rr*Math.sin(v), (Rr+rr*Math.cos(v))*Math.sin(u)]; }},
    {name:'Autonomous systems', at:function(i,t){
      var y=1-2*t, r=Math.sqrt(Math.max(0,1-y*y)), th=i*2.399963;
      return [Math.cos(th)*r*R*0.92, y*R*0.92, Math.sin(th)*r*R*0.92]; }},
    {name:'Frontier computing', at:function(i){
      var n=5, x=i%n, y=Math.floor(i/n)%n, z=Math.floor(i/(n*n))%n, g=R*0.42;
      return [(x-(n-1)/2)*g, (y-(n-1)/2)*g, (z-(n-1)/2)*g]; }},
    {name:'Systems in production', at:function(i,t){
      var L=Math.floor(t*4), k=i%33, c=6;
      return [((k%c)-2.5)*R*0.30, (L-1.5)*R*0.52, (Math.floor(k/c)-2.5)*R*0.30]; }}
  ];

  var P=[], i;
  for(i=0;i<N;i++) P.push({x:(Math.random()-0.5)*R*3, y:(Math.random()-0.5)*R*3,
                            z:(Math.random()-0.5)*R*3, tx:0, ty:0, tz:0});
  var form=0, HOLD=4200, tSwitch=0, pinned=false;
  var st={ang:-0.5, tilt:0.12, spin:0};
  var S=sizer(cv,ctx);
  var nameEl=document.getElementById('formName'), dotsEl=document.getElementById('dots');

  function retarget(){
    var f=FORMS[form], k;
    for(k=0;k<N;k++){ var q=f.at(k,k/(N-1)); P[k].tx=q[0]; P[k].ty=q[1]; P[k].tz=q[2]; }
    if(nameEl) nameEl.textContent=f.name;
    if(dotsEl) dotsEl.innerHTML = FORMS.map(function(g,n){
      return '<button class="dot'+(n===form?' on':'')+'" data-k="'+n+
             '" type="button" aria-label="Show '+g.name+'"></button>'; }).join('');
  }
  if(dotsEl) dotsEl.addEventListener('click', function(e){
    var k=e.target && e.target.getAttribute('data-k');
    if(k===null||k===undefined) return;
    form=+k; retarget(); tSwitch=performance.now(); pinned=true;
  });

  function proj(p){
    var ca=Math.cos(st.ang), sa=Math.sin(st.ang);
    var x=p.x*ca-p.z*sa, z0=p.x*sa+p.z*ca;
    var ct=Math.cos(st.tilt), stl=Math.sin(st.tilt);
    var y=p.y*ct-z0*stl, z=p.y*stl+z0*ct;
    var tz=z+205, f=760/Math.max(tz,1);
    return {X:S.w*0.68+x*f, Y:S.h*0.50+y*f, s:f, z:tz};
  }
  function draw(){
    var cB=token('--blue')||'#3d6ef7', cW=token('--warm')||'#e08a52', a, b;
    ctx.clearRect(0,0,S.w,S.h);
    var pts=[]; for(a=0;a<N;a++) pts.push(proj(P[a]));
    ctx.lineWidth=1; ctx.strokeStyle=cB;
    var L2=Math.pow(R*0.46,2);
    for(a=0;a<N;a++) for(b=a+1;b<N;b++){
      var dx=P[a].x-P[b].x, dy=P[a].y-P[b].y, dz=P[a].z-P[b].z, d2=dx*dx+dy*dy+dz*dz;
      if(d2>L2) continue;
      ctx.globalAlpha=(1-d2/L2)*0.30*Math.min(1,pts[a].s*1.4);
      ctx.beginPath(); ctx.moveTo(pts[a].X,pts[a].Y); ctx.lineTo(pts[b].X,pts[b].Y); ctx.stroke();
    }
    var ord=pts.map(function(p,ix){return {p:p,ix:ix};}).sort(function(m,n){return n.p.z-m.p.z;});
    for(a=0;a<ord.length;a++){
      var o=ord[a];
      ctx.globalAlpha=Math.max(0.18, Math.min(1, o.p.s*1.6));
      ctx.fillStyle=(o.ix%17===0)?cW:cB;
      ctx.beginPath(); ctx.arc(o.p.X,o.p.Y,Math.max(1.1,2.0*o.p.s),0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  var last=0;
  function frame(ts){
    if(!last){ last=ts; tSwitch=ts; }
    var dt=Math.min(ts-last,50); last=ts;
    if(!pinned && ts-tSwitch>HOLD){ form=(form+1)%FORMS.length; retarget(); tSwitch=ts; }
    var e=REDUCE?0.14:0.055;
    for(var k=0;k<N;k++){ var p=P[k];
      p.x+=(p.tx-p.x)*e; p.y+=(p.ty-p.y)*e; p.z+=(p.tz-p.z)*e; }
    if(!REDUCE){ st.ang += dt*0.00006 + st.spin; st.spin*=0.94; }
    draw(); requestAnimationFrame(frame);
  }
  var hint=document.getElementById('heroHint');
  orbit(cv, st, function(){ if(hint) hint.classList.add('gone'); });
  retarget(); requestAnimationFrame(frame);
}

/* ── Scene two: an optimisation landscape, solved badly on purpose ─────── */
function landscapeScene(cv){
  var ctx=cv.getContext('2d');
  /* One deep global minimum and five shallower traps. */
  var WELLS=[
    {x: 0.30, y:-0.22, d:1.00, w:0.10},
    {x:-0.55, y: 0.35, d:0.62, w:0.09},
    {x: 0.62, y: 0.55, d:0.55, w:0.08},
    {x:-0.30, y:-0.62, d:0.68, w:0.09},
    {x:-0.72, y:-0.18, d:0.44, w:0.07},
    {x: 0.05, y: 0.72, d:0.50, w:0.08}
  ];
  function f(x,y){
    var v=(x*x+y*y)*0.28;
    for(var i=0;i<WELLS.length;i++){
      var w=WELLS[i], dx=x-w.x, dy=y-w.y;
      v -= w.d*Math.exp(-(dx*dx+dy*dy)/w.w);
    }
    return v;
  }
  function grad(x,y){
    var h=1e-3;
    return [(f(x+h,y)-f(x-h,y))/(2*h), (f(x,y+h)-f(x,y-h))/(2*h)];
  }
  var M=30, mesh=[], a, b;
  for(a=0;a<=M;a++){ mesh[a]=[];
    for(b=0;b<=M;b++){ var x=-1+2*a/M, y=-1+2*b/M; mesh[a][b]={x:x,y:y,h:f(x,y)}; } }

  var walkers=[], settled=0, found=0;
  var elW=document.getElementById('sW'), elS=document.getElementById('sS'), elB=document.getElementById('sB');
  function report(){
    if(elW) elW.textContent=walkers.length;
    if(elS) elS.textContent=settled;
    if(elB) elB.textContent=found;
  }
  function seed(){
    walkers=[]; settled=0; found=0;
    for(var i=0;i<26;i++) walkers.push({
      x:(Math.random()*2-1)*0.92, y:(Math.random()*2-1)*0.92,
      T:0.42, done:false, good:false });
    report();
  }
  function step(){
    for(var i=0;i<walkers.length;i++){
      var w=walkers[i]; if(w.done) continue;
      var g=grad(w.x,w.y);
      w.x -= g[0]*0.030 + (Math.random()-0.5)*w.T*0.06;
      w.y -= g[1]*0.030 + (Math.random()-0.5)*w.T*0.06;
      w.x = Math.max(-1, Math.min(1, w.x));
      w.y = Math.max(-1, Math.min(1, w.y));
      w.T *= 0.994;
      if(w.T < 0.045){
        w.done=true; settled++;
        var bw=WELLS[0], dx=w.x-bw.x, dy=w.y-bw.y;
        if(dx*dx+dy*dy < 0.045){ w.good=true; found++; }
        report();
      }
    }
  }

  var st={ang:-0.72, tilt:0.62, spin:0}, SC=86;
  var S=sizer(cv,ctx);
  function proj(x,h,y){
    var px=x*SC, pz=y*SC, py=-h*SC*0.92;
    var ca=Math.cos(st.ang), sa=Math.sin(st.ang);
    var rx=px*ca-pz*sa, rz=px*sa+pz*ca;
    var ct=Math.cos(st.tilt), stl=Math.sin(st.tilt);
    var ry=py*ct-rz*stl, rzz=py*stl+rz*ct;
    var tz=rzz+250, q=560/Math.max(tz,1);
    return {X:S.w*0.5+rx*q, Y:S.h*0.54+ry*q, s:q, z:tz};
  }
  function draw(){
    var cB=token('--blue')||'#3d6ef7', cW=token('--warm')||'#e08a52', i, j;
    ctx.clearRect(0,0,S.w,S.h);
    var g=[];
    for(i=0;i<=M;i++){ g[i]=[];
      for(j=0;j<=M;j++) g[i][j]=proj(mesh[i][j].x, mesh[i][j].h, mesh[i][j].y); }
    ctx.strokeStyle=cB; ctx.lineWidth=1;
    for(i=0;i<=M;i++) for(j=0;j<M;j++){
      ctx.globalAlpha=Math.min(0.5, 0.06 + Math.max(0,-mesh[i][j].h)*0.30);
      ctx.beginPath(); ctx.moveTo(g[i][j].X,g[i][j].Y); ctx.lineTo(g[i][j+1].X,g[i][j+1].Y); ctx.stroke();
      if(i<M){ ctx.beginPath(); ctx.moveTo(g[i][j].X,g[i][j].Y); ctx.lineTo(g[i+1][j].X,g[i+1][j].Y); ctx.stroke(); }
    }
    ctx.globalAlpha=1;
    for(i=0;i<walkers.length;i++){
      var w=walkers[i], p=proj(w.x, f(w.x,w.y), w.y), hot=w.done && w.good;
      ctx.fillStyle=hot?cW:cB;
      ctx.globalAlpha=w.done?(hot?1:0.5):0.95;
      if(hot){ ctx.shadowColor=cW; ctx.shadowBlur=12; }
      ctx.beginPath(); ctx.arc(p.X,p.Y,hot?4.2:3,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
  }
  var last=0, acc=0;
  function frame(ts){
    if(!last) last=ts;
    var dt=Math.min(ts-last,50); last=ts;
    acc+=dt; if(acc>16){ step(); acc=0; }
    if(!REDUCE){ st.ang += dt*0.00004 + st.spin; st.spin*=0.94; }
    draw(); requestAnimationFrame(frame);
  }
  orbit(cv, st);
  var again=document.getElementById('reseed');
  if(again) again.addEventListener('click', seed);
  seed(); requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', function(){
  var a=document.getElementById('venture');   if(a) ventureScene(a);
  var b=document.getElementById('landscape'); if(b) landscapeScene(b);
});
})();
