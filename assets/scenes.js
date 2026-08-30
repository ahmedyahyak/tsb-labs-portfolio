/* ═══════════════════════════════════════════════════════════════════════════
   TSB Labs 3D scenes. No libraries, no build step, no CDN.

   Software perspective projection onto a 2D canvas: rotate, tilt, project,
   depth sort, draw. Two scenes share the orbit control, the projector and the
   sprite cache.

   The geometry is not decoration. Scene one's forms are the capability list.
   Scene two is a real optimisation landscape with real annealing running on
   it, which is the argument the company makes, shown rather than asserted.

   ── why scene one is fitted to a DOM element ─────────────────────────────
   The canvas covers the whole hero, but the structure is projected into the
   rect of #sceneZone, a grid cell that can never overlap the copy. The first
   version centred the scene at 68% of the canvas width, which put particles
   underneath the subheading at laptop widths. Text must never share pixels
   with the scene, and CSS layout is the only thing that can promise that, so
   the scene asks the layout where it is allowed to be.

   ── why spheres are stamped, not drawn ───────────────────────────────────
   A flat disc reads as a dot on a screen; a radial gradient lit from the top
   left reads as a small sphere. Building that gradient 132 times a frame is
   the wrong price, so each colour is rendered once into an offscreen sprite
   and stamped with drawImage, which is cheaper than the flat arcs were.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function token(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function rgbOf(c){
  c = String(c).trim();
  var m = c.match(/^#([0-9a-f]{6})$/i);
  if(m) return [0,2,4].map(function(i){ return parseInt(m[1].substr(i,2),16); });
  m = c.match(/(-?[\d.]+)\D+(-?[\d.]+)\D+(-?[\d.]+)/);
  if(m) return [+m[1], +m[2], +m[3]];
  return [61,110,247];
}
function mix(a, b, t){
  var x=rgbOf(a), y=rgbOf(b);
  return 'rgb('+Math.round(x[0]+(y[0]-x[0])*t)+','+Math.round(x[1]+(y[1]-x[1])*t)+','
               +Math.round(x[2]+(y[2]-x[2])*t)+')';
}

/* One lit sphere, drawn once per colour and stamped ever after.

   Three lights, because one is what makes 3D read as clip art: a key from
   the top left, a cool ground bounce on the shadow side in the ice tone
   (the studio-light touch that says material rather than disc), and a
   tight specular point. All of it costs nothing per frame; it is baked
   into the sprite once. */
function sphereSprite(color){
  var s=document.createElement('canvas'); s.width=64; s.height=64;
  var c=s.getContext('2d');
  var g=c.createRadialGradient(24,22,2,32,32,30);
  g.addColorStop(0,    mix(color,'#ffffff',0.72));
  g.addColorStop(0.30, mix(color,'#ffffff',0.18));
  g.addColorStop(0.66, color);
  g.addColorStop(1,    mix(color,'#05070d',0.62));
  c.fillStyle=g; c.beginPath(); c.arc(32,32,30,0,Math.PI*2); c.fill();
  c.save(); c.beginPath(); c.arc(32,32,30,0,Math.PI*2); c.clip();
  c.globalCompositeOperation='lighter';
  var b=c.createRadialGradient(44,46,2,44,46,20);
  b.addColorStop(0,'rgba(143,180,255,0.30)');
  b.addColorStop(1,'rgba(143,180,255,0)');
  c.fillStyle=b; c.fillRect(0,0,64,64);
  var sp=c.createRadialGradient(22,19,0,22,19,7);
  sp.addColorStop(0,'rgba(255,255,255,0.85)');
  sp.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=sp; c.fillRect(0,0,64,64);
  c.restore();
  return s;
}
/* Depth of field, paid for once. A blurred copy of a sprite is a lens,
   and stamping it is the same price as stamping the sharp one. Browsers
   without ctx.filter quietly stamp the sharp sprite instead, which is
   exactly what this file did before. */
function blurred(sprite, px){
  var s=document.createElement('canvas'); s.width=64; s.height=64;
  var c=s.getContext('2d');
  if(typeof c.filter==='string'){ c.filter='blur('+px+'px)'; }
  c.drawImage(sprite,4,4,56,56);
  return s;
}
function focusSet(color){
  var sharp=sphereSprite(color);
  return [sharp, blurred(sharp,1.6), blurred(sharp,3.4)];
}
/* The soft additive halo behind anything warm. */
function glowSprite(color){
  var s=document.createElement('canvas'); s.width=96; s.height=96;
  var c=s.getContext('2d');
  var g=c.createRadialGradient(48,48,4,48,48,46);
  g.addColorStop(0, mix(color,'#05070d',0.35));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle=g; c.beginPath(); c.arc(48,48,46,0,Math.PI*2); c.fill();
  return s;
}

/* Pointer drag orbits the scene; releasing lets the spin carry and decay.
   pan-y at the CSS level keeps vertical swipes scrolling the page on touch. */
function orbit(cv, st, onFirstDrag){
  var down=false, px=0, py=0, first=true, mouse=false;
  cv.addEventListener('pointerdown', function(e){
    down=true; cv.classList.add('drag'); mouse = e.pointerType==='mouse';
    try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    px=e.clientX; py=e.clientY;
    if(first){ first=false; onFirstDrag && onFirstDrag(); }
  });
  cv.addEventListener('pointermove', function(e){
    if(!down) return;
    st.ang  -= (e.clientX-px)*0.006;
    if(mouse) st.tilt = Math.max(-0.45, Math.min(1.15, st.tilt + (e.clientY-py)*0.004));
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
function sizer(cv, ctx, onFit){
  var s = {w:0, h:0};
  function fit(){
    var dpr = Math.min(window.devicePixelRatio||1, 2);
    s.w = cv.clientWidth; s.h = cv.clientHeight;
    cv.width  = Math.round(s.w*dpr);
    cv.height = Math.round(s.h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    onFit && onFit();
  }
  fit();
  window.addEventListener('resize', fit, {passive:true});
  return s;
}

/* ── Scene one: the venture assembling itself ──────────────────────────── */
function ventureScene(cv){
  var ctx=cv.getContext('2d'), N=132, R=52;
  var zone=document.getElementById('sceneZone');
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
    /* 5^3 fills 125 of the 132. The old code wrapped the last seven back
       onto occupied cells, which doubled seven nodes invisibly. Now they
       orbit the lattice on a tilted ring: a cube being studied, which is
       what frontier work is. */
    {name:'Frontier computing', at:function(i){
      var n=5, g=R*0.42;
      if(i<125){
        var x=i%n, y=Math.floor(i/n)%n, z=Math.floor(i/(n*n));
        return [(x-(n-1)/2)*g, (y-(n-1)/2)*g, (z-(n-1)/2)*g];
      }
      var a=(i-125)/7*Math.PI*2, rr=R*0.92;
      return [Math.cos(a)*rr, Math.sin(a)*rr*0.38, Math.sin(a)*rr*0.80];
    }},
    /* Eleven rings of twelve: 132 exactly, no holes and no stray floater.
       The old grid packed 33 nodes into 36 slots, so every layer shipped
       with three gaps and the formula stranded one node alone above the
       stack. The waisted profile is deliberate: a straight tube reads as a
       pipe, a machined taper reads as a turbine, and production is the
       machine that runs. */
    {name:'Systems in production', at:function(i){
      var ring=Math.floor(i/12), k=i%12;
      var y=(ring-5)*R*0.24;
      var waist=0.62+0.38*Math.abs(ring-5)/5;      // narrow middle, flared ends
      var rr=R*0.66*waist;
      var a=(k/12)*Math.PI*2 + ring*0.26;          // each ring turned slightly
      return [Math.cos(a)*rr, y, Math.sin(a)*rr];
    }}
  ];

  var P=[], i;
  for(i=0;i<N;i++) P.push({x:(Math.random()-0.5)*R*3, y:(Math.random()-0.5)*R*3,
                            z:(Math.random()-0.5)*R*3, tx:0, ty:0, tz:0, wait:0});
  var form=0, HOLD=4200, tSwitch=0, pinned=false;
  var st={ang:-0.5, tilt:0.12, spin:0, scroll:0, drift:0};
  var heroLive=true;

  /* The cursor is a presence in the scene, not just a control. Nodes inside
     its radius are pushed along the view plane; the same lerp that morphs
     the forms then pulls them home, so the structure parts around the hand
     and heals behind it. No extra physics loop, no springs to tune: the
     easing that already exists is the spring. */
  var cursor={x:-1e4, y:-1e4, on:false};
  cv.addEventListener('pointermove', function(e){
    var r=cv.getBoundingClientRect();
    cursor.x=e.clientX-r.left; cursor.y=e.clientY-r.top; cursor.on=true;
  }, {passive:true});
  cv.addEventListener('pointerleave', function(){ cursor.on=false; cursor.x=-1e4; cursor.y=-1e4; });

  /* Scroll turns the machine. The page position is read once per scroll
     event, never per frame, and enters the projection as extra rotation and
     a slower vertical drift, so scrolling past the hero visibly rotates the
     structure while it lags the page like a heavy object would. */
  var pageY=0;
  window.addEventListener('scroll', function(){ pageY=window.scrollY||0; }, {passive:true});

  /* Where the layout says the scene may live, in canvas coordinates. */
  var Z={cx:0, cy:0, focal:400};
  function readZone(){
    if(!zone){ Z.cx=S.w*0.5; Z.cy=S.h*0.5; Z.focal=Math.min(S.w,S.h)*1.0; return; }
    var zr=zone.getBoundingClientRect(), cr=cv.getBoundingClientRect();
    Z.cx = zr.left - cr.left + zr.width/2;
    Z.cy = zr.top  - cr.top  + zr.height/2;
    /* 1.05 was polite and read as an ornament. 1.34 makes the structure a
       counterweight to the headline; the forms above were re-fitted so the
       widest state still clears the zone at this focal length. */
    Z.focal = Math.min(zr.width, zr.height) * 1.34;
  }
  var S=sizer(cv,ctx,readZone);
  var nameEl=document.getElementById('formName'), dotsEl=document.getElementById('dots');
  var cBlue=token('--blue')||'#3d6ef7', cIce=token('--ice')||'#8fb4ff',
      cWarm=token('--warm')||'#e08a52';
  var SPH_B=focusSet(cBlue), SPH_W=focusSet(cWarm);
  var GLOW_W=glowSprite(cWarm), GLOW_B=glowSprite(cBlue);
  /* The lattice is graded by depth in colour as well as alpha: near links
     lean toward ice, far links sink toward the void. Three strokes cover
     it; mixing per link per frame would not survive the O(N²) loop. */
  var LK_NEAR=mix(cBlue,cIce,0.45), LK_MID=cBlue, LK_FAR=mix(cBlue,'#05070d',0.38);

  /* Light travelling the lattice. A structure whose edges carry packets
     reads as a system doing work; a static lattice reads as a diagram.
     Budgeted: at most seven alive, spawned only when a real link exists,
     and none at all under reduced motion. */
  var pulses=[];
  function spawnPulse(now){
    if(REDUCE || pulses.length>=7) return;
    var L2=Math.pow(R*0.46,2);
    for(var tries=0;tries<12;tries++){
      var a=(Math.random()*N)|0, b=(Math.random()*N)|0;
      if(a===b) continue;
      var dx=P[a].x-P[b].x, dy=P[a].y-P[b].y, dz=P[a].z-P[b].z;
      if(dx*dx+dy*dy+dz*dz>L2) continue;
      pulses.push({a:a, b:b, t:0, v:0.0011+Math.random()*0.0009});
      return;
    }
  }

  function retarget(){
    var f=FORMS[form], k, now=performance.now();
    for(k=0;k<N;k++){
      var q=f.at(k,k/(N-1));
      P[k].tx=q[0]; P[k].ty=q[1]; P[k].tz=q[2];
      /* The wave. Everything arriving at once reads as a video cut; a 30 to
         80ms stagger per design motion rules, spread along the index, makes
         the form assemble across half a second instead. */
      P[k].wait = now + (k/N)*520;
    }
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
    var A=st.ang+st.scroll;
    var ca=Math.cos(A), sa=Math.sin(A);
    var x=p.x*ca-p.z*sa, z0=p.x*sa+p.z*ca;
    var ct=Math.cos(st.tilt), stl=Math.sin(st.tilt);
    var y=p.y*ct-z0*stl, z=p.y*stl+z0*ct;
    var tz=z+205, f=Z.focal/Math.max(tz,1);
    return {X:Z.cx+x*f, Y:Z.cy+y*f+st.drift, s:f, z:tz};
  }
  function draw(){
    var a, b;
    ctx.clearRect(0,0,S.w,S.h);

    /* A contact shadow under the mass. Weight is what separates an object in
       a room from a pattern on a wall, and it costs one gradient. Tinted
       toward the ground's own blue black, never flat black. */
    var gw=Z.focal*0.62, gy=Z.cy+Z.focal*0.42;
    var g=ctx.createRadialGradient(Z.cx,gy,gw*0.06,Z.cx,gy,gw);
    g.addColorStop(0,'rgba(9,13,26,0.55)');
    g.addColorStop(1,'rgba(9,13,26,0)');
    ctx.save(); ctx.translate(Z.cx,gy); ctx.scale(1,0.22); ctx.translate(-Z.cx,-gy);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(Z.cx,gy,gw,0,Math.PI*2); ctx.fill();
    ctx.restore();

    var pts=[]; for(a=0;a<N;a++){ pts.push(proj(P[a]));
      /* screen position cached for the cursor field in the physics step */
      P[a]._sx=pts[a].X; P[a]._sy=pts[a].Y; }

    /* Links faded, thinned and now tinted by their own depth, so the
       lattice has a near side and a far side instead of reading as a flat
       net. */
    var L2=Math.pow(R*0.46,2);
    for(a=0;a<N;a++) for(b=a+1;b<N;b++){
      var dx=P[a].x-P[b].x, dy=P[a].y-P[b].y, dz=P[a].z-P[b].z, d2=dx*dx+dy*dy+dz*dz;
      if(d2>L2) continue;
      var depth=Math.min(1,(pts[a].s+pts[b].s)*0.5*205/Z.focal*1.35);
      ctx.strokeStyle = depth>0.86 ? LK_NEAR : (depth>0.6 ? LK_MID : LK_FAR);
      ctx.globalAlpha=(1-d2/L2)*0.34*depth;
      ctx.lineWidth=0.55+depth*0.75;
      ctx.beginPath(); ctx.moveTo(pts[a].X,pts[a].Y); ctx.lineTo(pts[b].X,pts[b].Y); ctx.stroke();
    }

    /* Depth of field. The focal plane sits at the structure's centre; a
       node's distance from it picks the sharp, soft or softer sprite. The
       camera acquires a lens for the price of an array index. */
    var ord=pts.map(function(p,ix){return {p:p,ix:ix};}).sort(function(m,n){return n.p.z-m.p.z;});
    for(a=0;a<ord.length;a++){
      var o=ord[a], warm=(o.ix%17===0);
      var r=Math.max(1.8, 2.9*o.p.s);
      var off=Math.abs(o.p.z-205), fi = off<30 ? 0 : (off<72 ? 1 : 2);
      /* Nodes near the cursor wake up: a touch larger, fully lit, and the
         blur is overridden to sharp, as though the hand carries focus. */
      var near=0;
      if(cursor.on){
        var ndx=o.p.X-cursor.x, ndy=o.p.Y-cursor.y, nd2=ndx*ndx+ndy*ndy;
        if(nd2<12100){ near=1-Math.sqrt(nd2)/110; r*=1+near*0.4; fi=0; }
      }
      ctx.globalAlpha=Math.max(0.20+near*0.5, Math.min(1, o.p.s*205/Z.focal*1.6));
      if(warm){
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=Math.min(0.65, o.p.s*205/Z.focal*0.9);
        ctx.drawImage(GLOW_W, o.p.X-r*4, o.p.Y-r*4, r*8, r*8);
        ctx.restore();
        ctx.globalAlpha=Math.max(0.25, Math.min(1, o.p.s*205/Z.focal*1.6));
      }else if(o.p.z<172){
        /* the nearest blue nodes carry a faint bloom of their own, so the
           front of the structure feels lit rather than merely close */
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=0.16;
        ctx.drawImage(GLOW_B, o.p.X-r*3, o.p.Y-r*3, r*6, r*6);
        ctx.restore();
        ctx.globalAlpha=Math.max(0.25, Math.min(1, o.p.s*205/Z.focal*1.6));
      }
      ctx.drawImage((warm?SPH_W:SPH_B)[fi], o.p.X-r, o.p.Y-r, r*2, r*2);
    }

    /* The packets. Additive ice light moving node to node, with a short
       tail; they ride between the lattice and the spheres. */
    if(pulses.length){
      ctx.save(); ctx.globalCompositeOperation='lighter';
      for(a=pulses.length-1;a>=0;a--){
        var pu=pulses[a], pa=pts[pu.a], pb=pts[pu.b];
        for(var kk=0;kk<3;kk++){
          var tt=pu.t-kk*0.055; if(tt<0) continue;
          var X=pa.X+(pb.X-pa.X)*tt, Y=pa.Y+(pb.Y-pa.Y)*tt;
          var ss=(pa.s+(pb.s-pa.s)*tt)*205/Z.focal;
          ctx.globalAlpha=(0.5-kk*0.16)*Math.min(1,ss*1.4);
          ctx.drawImage(GLOW_B, X-5, Y-5, 10, 10);
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  var last=0;
  function frame(ts){
    if(!heroLive) return;                    // the observer restarts us
    if(!last){ last=ts; tSwitch=ts; }
    var dt=Math.min(ts-last,50); last=ts;
    /* Reduced motion holds one composed formation instead of flying 132
       nodes through space every four seconds. The dots stay live, so the
       capability list is still explorable on intent, which is the
       informative part. Found in expert review, 2026-08-30. */
    if(!pinned && !REDUCE && ts-tSwitch>HOLD){ form=(form+1)%FORMS.length; retarget(); tSwitch=ts; }
    var now=performance.now();
    var e=REDUCE?0.14:0.062;
    /* View-plane axes, so a screen-space push lands in world space no
       matter which way the scene is turned. */
    var A=st.ang+st.scroll, ca=Math.cos(A), sa=Math.sin(A);
    var ct=Math.cos(st.tilt), stl=Math.sin(st.tilt);
    var RAD=110, RAD2=RAD*RAD;
    for(var k=0;k<N;k++){ var p=P[k];
      if(!REDUCE && cursor.on && p._sx!==undefined){
        var cdx=p._sx-cursor.x, cdy=p._sy-cursor.y, cd2=cdx*cdx+cdy*cdy;
        if(cd2<RAD2 && cd2>0.01){
          var cd=Math.sqrt(cd2), cf=(1-cd/RAD); cf=cf*cf*2.4;
          var ux=cdx/cd, uy=cdy/cd;
          p.x += ( ux*ca - uy*sa*stl)*cf;
          p.z += (-ux*sa - uy*ca*stl)*cf;
          p.y += ( uy*ct)*cf;
        }
      }
      if(!REDUCE && now<p.wait) continue;
      p.x+=(p.tx-p.x)*e; p.y+=(p.ty-p.y)*e; p.z+=(p.tz-p.z)*e; }
    if(!REDUCE){
      st.ang += dt*0.00006 + st.spin; st.spin*=0.94;
      st.scroll = pageY*0.0011;          // the machine turns as the page moves
      st.drift  = pageY*0.16;            // and lags it, like something heavy
    }
    /* packets advance, die at arrival, and are replaced on a slow clock */
    for(var pi=pulses.length-1;pi>=0;pi--){
      pulses[pi].t += pulses[pi].v*dt;
      if(pulses[pi].t>1) pulses.splice(pi,1);
    }
    if(now-lastPulse>640){ spawnPulse(now); lastPulse=now; }
    readZone();
    draw(); requestAnimationFrame(frame);
  }
  var lastPulse=0;
  var hint=document.getElementById('heroHint');
  orbit(cv, st, function(){ if(hint) hint.classList.add('gone'); });
  retarget();
  /* The loop runs only while the hero can be seen. Without this gate the
     O(N²) link pass burned every frame from the fold to the footer,
     including the whole time the dissection was pinned, which made the
     "the two loops never run at once" assumption false. Same pattern as
     stackScene, which had it right from the start. */
  var running=false;
  new IntersectionObserver(function(es){
    heroLive=es[0].isIntersecting;
    if(heroLive && !running){ running=true; last=0; requestAnimationFrame(frame); }
    if(!heroLive) running=false;
  },{rootMargin:'200px'}).observe(cv);
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

  /* The surface is filled, not wireframed. Each quad's colour carries three
     signals at once: depth into the valley (toward blue), height on a ridge
     (toward ice), and proximity to the one global minimum (toward warm), so
     the answer the walkers are missing is visibly warm before any walker
     finds it. Shading is precomputed because the terrain never changes; only
     the projection does. */
  var C_INK, C_BLUE, C_ICE, C_WARM;
  var quads=[];
  function shade(){
    C_INK  = token('--ink') ||'#0a0d15';
    C_BLUE = token('--blue')||'#3d6ef7';
    C_ICE  = token('--ice') ||'#8fb4ff';
    C_WARM = token('--warm')||'#e08a52';
    quads=[];
    var bw=WELLS[0];
    /* One directional light over the terrain, fixed at the top left like
       the sphere sprites' key. Each quad's normal comes from its two edge
       vectors, and the lambert term sculpts the slopes: lit faces climb
       toward ice, shadowed faces sink toward the void. This is what turns
       a colour ramp into relief, and it is all paid here, once, because
       the terrain never changes; only the projection does. */
    var LX=-0.48, LY=0.78, LZ=-0.40;
    var ln=Math.sqrt(LX*LX+LY*LY+LZ*LZ); LX/=ln; LY/=ln; LZ/=ln;
    for(var i=0;i<M;i++) for(var j=0;j<M;j++){
      var h=(mesh[i][j].h+mesh[i+1][j].h+mesh[i][j+1].h+mesh[i+1][j+1].h)/4;
      var cx=(mesh[i][j].x+mesh[i+1][j+1].x)/2, cy=(mesh[i][j].y+mesh[i+1][j+1].y)/2;
      var depth=Math.max(0,-h);                    // 0 flat .. ~1 deepest
      var ridge=Math.max(0,h)*1.6;
      var dx=cx-bw.x, dy=cy-bw.y;
      var best=Math.exp(-(dx*dx+dy*dy)/0.05);      // near the true answer
      /* normal of the quad in (x, h, y) space, from its edge vectors */
      var e1x=2/M, e1h=mesh[i+1][j].h-mesh[i][j].h;
      var e2y=2/M, e2h=mesh[i][j+1].h-mesh[i][j].h;
      var nx=-e1h*e2y, nyy=e1x*e2y, nz=-e1x*e2h;
      var nl=Math.sqrt(nx*nx+nyy*nyy+nz*nz)||1;
      var lam=Math.max(0,(nx*LX+nyy*LY+nz*LZ)/nl);  // 0 shadow .. 1 facing
      var col=mix(C_INK, C_BLUE, 0.10+depth*0.72);
      col=mix(col,'#05070d',(1-lam)*0.42);
      if(lam>0.86) col=mix(col, C_ICE, (lam-0.86)*2.2);
      if(ridge>0.02) col=mix(col, C_ICE, Math.min(0.30,ridge));
      if(best>0.05)  col=mix(col, C_WARM, best*0.55*depth);
      quads.push({i:i, j:j, fill:col, line:mix(col,C_ICE,0.16)});
    }
    GL_W=glowSprite(C_WARM);
  }
  var GL_W;
  shade();

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
      T:0.42, done:false, good:false, hist:[] });
    report();
  }
  function step(){
    for(var i=0;i<walkers.length;i++){
      var w=walkers[i]; if(w.done) continue;
      var g=grad(w.x,w.y);
      w.hist.push(w.x, w.y);
      if(w.hist.length>28) w.hist.splice(0, w.hist.length-28);
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
  var pulse=0;
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
    ctx.clearRect(0,0,S.w,S.h);
    var i, j, g=[];
    for(i=0;i<=M;i++){ g[i]=[];
      for(j=0;j<=M;j++) g[i][j]=proj(mesh[i][j].x, mesh[i][j].h, mesh[i][j].y); }

    /* Painter's order: quads sorted far to near every frame, because the
       viewer can drag the terrain to any angle. */
    for(i=0;i<quads.length;i++){
      var q=quads[i];
      q.z=(g[q.i][q.j].z+g[q.i+1][q.j].z+g[q.i][q.j+1].z+g[q.i+1][q.j+1].z)/4;
    }
    quads.sort(function(m,n){ return n.z-m.z; });
    var strokeToo = S.w>=640;
    for(i=0;i<quads.length;i++){
      var q2=quads[i];
      var p00=g[q2.i][q2.j], p10=g[q2.i+1][q2.j], p11=g[q2.i+1][q2.j+1], p01=g[q2.i][q2.j+1];
      var depth=Math.max(0.35, Math.min(1,(340-q2.z)/170));
      ctx.globalAlpha=0.92*depth;
      ctx.fillStyle=q2.fill;
      ctx.beginPath();
      ctx.moveTo(p00.X,p00.Y); ctx.lineTo(p10.X,p10.Y);
      ctx.lineTo(p11.X,p11.Y); ctx.lineTo(p01.X,p01.Y);
      ctx.closePath(); ctx.fill();
      if(strokeToo){
        ctx.globalAlpha=0.5*depth;
        ctx.strokeStyle=q2.line; ctx.lineWidth=0.5; ctx.stroke();
      }
    }
    ctx.globalAlpha=1;

    /* The true answer, marked before anyone finds it: a pulsing ring over
       the deepest well, resting on a soft warm bloom so the valley itself
       appears lit from within. Ring grammar for the mark, additive light
       for the atmosphere. */
    var bw=WELLS[0], bp=proj(bw.x, f(bw.x,bw.y), bw.y);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=0.30+Math.sin(pulse)*0.10;
    ctx.drawImage(GL_W, bp.X-34, bp.Y-30, 68, 60);
    ctx.restore();
    ctx.strokeStyle=C_WARM;
    ctx.globalAlpha=0.55+Math.sin(pulse)*0.25;
    ctx.lineWidth=1.5;
    var rr=7+Math.sin(pulse)*2;
    ctx.beginPath(); ctx.arc(bp.X,bp.Y,rr*bp.s*0.45+5,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;

    /* Trails first, then walkers, so every search path reads as a path. */
    for(i=0;i<walkers.length;i++){
      var w=walkers[i];
      if(w.hist.length>=4){
        ctx.strokeStyle=w.good?C_WARM:C_ICE;
        ctx.lineWidth=1;
        for(var k=2;k<w.hist.length;k+=2){
          var pa=proj(w.hist[k-2], f(w.hist[k-2],w.hist[k-1]), w.hist[k-1]);
          var pb=proj(w.hist[k],   f(w.hist[k],  w.hist[k+1]), w.hist[k+1]);
          ctx.globalAlpha=(k/w.hist.length)*0.34;
          ctx.beginPath(); ctx.moveTo(pa.X,pa.Y); ctx.lineTo(pb.X,pb.Y); ctx.stroke();
        }
      }
    }
    for(i=0;i<walkers.length;i++){
      var w2=walkers[i], p=proj(w2.x, f(w2.x,w2.y), w2.y), hot=w2.done && w2.good;
      if(hot){
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=0.4;
        ctx.drawImage(GL_W, p.X-11, p.Y-11, 22, 22);
        ctx.restore();
      }
      ctx.globalAlpha=w2.done?(hot?1:0.55):0.95;
      ctx.fillStyle=hot?C_WARM:C_ICE;
      ctx.beginPath(); ctx.arc(p.X,p.Y,hot?4.2:2.8,0,Math.PI*2); ctx.fill();
      if(hot){
        ctx.strokeStyle=C_WARM; ctx.globalAlpha=0.35;
        ctx.beginPath(); ctx.arc(p.X,p.Y,7.5,0,Math.PI*2); ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  }
  var last=0, acc=0, landLive=true, landRunning=false;
  function frame(ts){
    if(!landLive){ landRunning=false; return; }
    if(!last) last=ts;
    var dt=Math.min(ts-last,50); last=ts;
    acc+=dt; if(acc>16){ step(); acc=0; }
    if(!REDUCE) pulse+=dt*0.004;
    if(!REDUCE){ st.ang += dt*0.00004 + st.spin; st.spin*=0.94; }
    draw(); requestAnimationFrame(frame);
  }
  orbit(cv, st);
  var again=document.getElementById('reseed');
  if(again) again.addEventListener('click', seed);
  seed();
  /* same visibility gate as the other scenes: no annealing for nobody */
  new IntersectionObserver(function(es){
    landLive=es[0].isIntersecting;
    if(landLive && !landRunning){ landRunning=true; last=0; requestAnimationFrame(frame); }
  },{rootMargin:'200px'}).observe(cv);
}

/* ── Scene three: one build, in section ─────────────────────────────────
   The scroll-driven dissection. A five plate stack, drawn live with the
   same projection math as the hero, scrubbed against how far its track has
   been scrolled. Live rendering instead of a frame sequence because the
   asset weight is zero, a palette change is a token edit, and the playhead
   can ease against scroll instead of snapping between frames.

   Four beats: closed and turning; the plates separate and name themselves;
   the access and audit plate takes the only warm light on the page; closed
   again, with the legend left standing. The pin never fights the scroll:
   the page moves at full speed and only the playhead eases. */
function stackScene(cv){
  if(REDUCE || !window.matchMedia('(min-width:720px)').matches) return;
  var track=document.getElementById('stackTrack');
  var head=document.getElementById('stackHead'), cap=document.getElementById('stackCap');
  var legend=document.getElementById('stackLegend');
  var lis=legend?[].slice.call(legend.children):[];
  if(!track) return;
  var ctx=cv.getContext('2d');
  var S=sizer(cv,ctx);

  var C_INK=token('--ink')||'#0a0d15', C_RAISE=token('--raise')||'#0f1421',
      C_BLUE=token('--blue')||'#3d6ef7', C_ICE=token('--ice')||'#8fb4ff',
      C_WARM=token('--warm')||'#e08a52', C_VOID=token('--void')||'#05070d';

  /* plate order is top to bottom: interface down to infrastructure */
  var PW=126, PD=88, PH=7, GATE=3;
  var BEATS=[
    ['Delivered as one system.',
     'This is what you are handed: a running application, and nothing about it left exposed.'],
    ['It has five parts. Always the same five.',
     'Interface, service layer, data, access and audit, infrastructure. Named, so nothing hides.'],
    ['One plate holds the keys.',
     'A human approval on anything irreversible, and an audit trail under all of it.'],
    ['Closed again. Handed over.',
     'Reassembled, documented, and running in accounts with your name on them.']
  ];
  var beatShown=-1;

  var t=0, target=0, ang=-0.62, live=false;
  function smooth(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); }

  function measure(){
    var r=track.getBoundingClientRect();
    var span=r.height-window.innerHeight;
    target=span>0 ? Math.max(0,Math.min(1,-r.top/span)) : 0;
  }
  window.addEventListener('scroll', measure, {passive:true});
  measure();

  function proj(x,y,z){
    var ca=Math.cos(ang), sa=Math.sin(ang);
    var rx=x*ca-z*sa, rz=x*sa+z*ca;
    var tl=0.42, ct=Math.cos(tl), stl=Math.sin(tl);
    var ry=y*ct-rz*stl, rzz=y*stl+rz*ct;
    var tz=rzz+300, f=Math.min(S.w,S.h)*1.05/Math.max(tz,1);
    return {X:S.w*0.52+rx*f, Y:S.h*0.55+ry*f, z:tz};
  }

  function quad(a,b,c,d,fill,alpha){
    ctx.globalAlpha=alpha; ctx.fillStyle=fill;
    ctx.beginPath(); ctx.moveTo(a.X,a.Y); ctx.lineTo(b.X,b.Y);
    ctx.lineTo(c.X,c.Y); ctx.lineTo(d.X,d.Y); ctx.closePath(); ctx.fill();
  }

  function draw(){
    ctx.clearRect(0,0,S.w,S.h);
    /* Separation begins at 0.08, not 0.22: the old head left ~53vh of
       scroll with a closed, apparently stuck stack. ~19vh of establishing
       beat, then motion. The gate window is untouched. */
    var sep=smooth((t-0.08)/0.22)*(1-smooth((t-0.75)/0.20));   // open, then close
    var gate=smooth((t-0.48)/0.10)*(1-smooth((t-0.76)/0.10));  // the warm beat
    var gap=PH+1.5+sep*30;

    /* contact shadow, the same grammar as the hero */
    var gy=S.h*0.55+Math.min(S.w,S.h)*0.30, gw=Math.min(S.w,S.h)*0.42;
    var g=ctx.createRadialGradient(S.w*0.52,gy,gw*0.06,S.w*0.52,gy,gw);
    g.addColorStop(0,'rgba(9,13,26,0.5)'); g.addColorStop(1,'rgba(9,13,26,0)');
    ctx.save(); ctx.translate(S.w*0.52,gy); ctx.scale(1,0.2); ctx.translate(-S.w*0.52,-gy);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(S.w*0.52,gy,gw,0,Math.PI*2); ctx.fill();
    ctx.restore();

    /* plates far to near so the nearer ones paint over */
    var order=[0,1,2,3,4].map(function(i){
      var y=(i-2)*gap;
      return {i:i, y:y, c:proj(0,y,0)};
    }).sort(function(m,n){ return n.c.z-m.c.z; });

    for(var q=0;q<order.length;q++){
      var pl=order[q], i=pl.i, y=pl.y;
      var hot=(i===GATE)?gate:0;
      var x0=-PW/2, x1=PW/2, z0=-PD/2, z1=PD/2;
      var yT=y-PH/2, yB=y+PH/2;
      var p=[proj(x0,yT,z0),proj(x1,yT,z0),proj(x1,yT,z1),proj(x0,yT,z1),
             proj(x0,yB,z0),proj(x1,yB,z0),proj(x1,yB,z1),proj(x0,yB,z1)];
      var top=mix(C_RAISE,C_ICE,0.05+hot*0.05);
      var sideA=mix(C_INK,C_VOID,0.25), sideB=mix(C_INK,C_VOID,0.45);
      /* two sides face the camera at this yaw; draw both, top last */
      quad(p[4],p[5],p[1],p[0],sideA,0.95);
      quad(p[5],p[6],p[2],p[1],sideB,0.95);
      quad(p[0],p[1],p[2],p[3],top,0.97);
      /* edges: blue hairline, or warm at the gate's moment */
      ctx.globalAlpha=0.65+hot*0.35;
      ctx.strokeStyle=hot>0.02?mix(C_BLUE,C_WARM,hot):C_BLUE;
      ctx.lineWidth=hot>0.02?1.4:0.8;
      ctx.beginPath(); ctx.moveTo(p[0].X,p[0].Y); ctx.lineTo(p[1].X,p[1].Y);
      ctx.lineTo(p[2].X,p[2].Y); ctx.lineTo(p[3].X,p[3].Y); ctx.closePath(); ctx.stroke();
      /* the approval ring, drawn on the gate plate as it takes the light */
      if(hot>0.03){
        var rc=proj(0,yT,0), rr=Math.max(8,26*hot);
        ctx.globalAlpha=hot*0.9; ctx.strokeStyle=C_WARM; ctx.lineWidth=1.5;
        ctx.save(); ctx.translate(rc.X,rc.Y); ctx.scale(1,0.42);
        ctx.beginPath(); ctx.arc(0,0,rr,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      /* Corner markers were cut in expert review: they claimed the
         vocabulary of measurement with nothing measured. The hairline
         edges and the machined taper already say precision. */
    }
    ctx.globalAlpha=1;
  }

  function captions(){
    var b = t<0.10?0 : t<0.48?1 : t<0.76?2 : 3;
    if(b!==beatShown){
      beatShown=b;
      if(head) head.textContent=BEATS[b][0];
      if(cap)  cap.textContent =BEATS[b][1];
    }
    for(var i=0;i<lis.length;i++){
      if(t>0.14+i*0.045) lis[i].classList.add('on');   // lit once, left standing
    }
  }

  /* If the Cycles frames load, they take the canvas and this renderer
     stands down. Until then, and forever if they never arrive, the live
     scene is the section. The captions and the legend stay here either
     way: they are DOM, and they belong to the section rather than to
     whichever renderer is filling the canvas. */
  var handedOver=false;
  window.addEventListener('stack:video-ready', function(){ handedOver=true; });

  var last=0;
  function frame(ts){
    if(!live) return;
    if(!last) last=ts;
    var dt=Math.min(ts-last,50); last=ts;
    t += (target-t)*0.14;
    ang += dt*0.00005;
    if(!handedOver) draw();
    captions();
    requestAnimationFrame(frame);
  }
  /* the loop runs only while the track is on screen */
  new IntersectionObserver(function(es){
    var on=es[0].isIntersecting;
    if(on && !live){ live=true; last=0; requestAnimationFrame(frame); }
    if(!on) live=false;
  },{rootMargin:'120px'}).observe(track);
}

document.addEventListener('DOMContentLoaded', function(){
  var a=document.getElementById('venture');   if(a) ventureScene(a);
  var b=document.getElementById('landscape'); if(b) landscapeScene(b);
  var c=document.getElementById('stack');     if(c) stackScene(c);
});
})();
