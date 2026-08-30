/* The photoreal layer for "one build, in section".
 *
 * Same four beats, same scroll track, same captions. The only change is
 * what fills the canvas: Cycles frames instead of the live projector.
 *
 * It is an upgrade, not a replacement, and it proves itself before taking
 * over. scenes.js keeps rendering until this file has a decoded frame in
 * hand; only then does it hand across. If the network is slow, the codec
 * is unsupported, the file is missing, or the browser refuses to decode,
 * the live scene simply carries on and nobody sees a gap. That is why the
 * canvas renderer was worth keeping rather than deleting.
 *
 * Scrubbing a <video> by currentTime is why the encode uses a fixed
 * 12-frame GOP with no B-frames: every twelfth frame is a keyframe and
 * decode order equals display order, so seeking never waits on a reorder.
 */
(function () {
  'use strict';
  var track = document.getElementById('stackTrack');
  var cv = document.getElementById('stack');
  if (!track || !cv) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(min-width:720px)').matches) return;
  /* Never pull 400KB over a connection the user is rationing. */
  var conn = navigator.connection;
  if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;

  var v = document.createElement('video');
  v.src = '/assets/stack.mp4';
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('aria-hidden', 'true');
  /* It must be in the document. A detached video will not reliably load or
     decode, and play() on one can reject outright, so seeked never fires and
     the handover never happens. Found by testing: zero videos in the DOM and
     no handover event. Kept effectively invisible rather than display:none,
     because a display:none video is also allowed not to decode. */
  v.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;' +
                    'pointer-events:none;left:0;top:0';
  (document.querySelector('.stack-pin') || document.body).appendChild(v);

  var ctx = cv.getContext('2d');
  var ready = false, live = false, dur = 0, target = 0, t = 0;

  function measure() {
    var r = track.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    target = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }

  function draw() {
    /* Contain, not cover. The frames are portrait (720x960, sized for the
       hero zone) and this canvas is a landscape viewport, so cover-fit
       scaled by 3.56 and threw away half the composition: measured, only
       2% of the visible canvas held any content and the approval ring was
       cropped out entirely. Contain keeps the whole rendered frame, which
       is the thing worth showing.

       Ratio-matched to the copy: the frame sits right of centre so the
       headline and caption on the left keep clear space, the same balance
       the live renderer used. */
    /* CSS pixels, not backing-store pixels. scenes.js sizes this canvas and
       leaves a devicePixelRatio transform on the context, so coordinates
       computed against cv.width were doubled again and the whole frame
       landed outside the canvas. That is why it measured pure black while
       the video held a good frame: nothing was wrong with the video or the
       decode, the drawing was simply off-screen. */
    var cw = cv.clientWidth, ch = cv.clientHeight;
    var vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !cw) return;
    var s = Math.min(cw / vw, ch / vh) * 0.92;   // 8% breathing room
    var w = vw * s, h = vh * s;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(v, cw * 0.62 - w / 2, (ch - h) / 2, w, h);
  }

  function frame() {
    if (!live) return;
    t += (target - t) * 0.14;               // same playhead easing as the canvas
    var want = t * dur;
    /* Never issue a seek while one is in flight. Setting currentTime every
       frame regardless left the element permanently in `seeking`, so it
       never surfaced a decoded frame and drawImage returned nothing: the
       canvas measured completely black while the video itself held a
       perfectly good frame. One seek at a time, and draw whatever the
       element currently has, which is the previous frame at worst. */
    if (!v.seeking && Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
    draw();
    requestAnimationFrame(frame);
  }

  v.addEventListener('loadedmetadata', function () { dur = v.duration || 0; });
  v.addEventListener('seeked', function () { if (ready) draw(); });

  window.addEventListener('scroll', measure, { passive: true });

  /* Readiness hangs off loadeddata, not seeked.
     The first version waited for a seeked event produced by priming the
     video from 0 to 0.001. That is inside a single frame at 30fps, so the
     browser treats it as a no-op, never fires seeked, and the handover
     silently never happened: the video sat fully loaded at readyState 4
     while currentTime stayed pinned at 0 through every scroll position.
     loadeddata means there is a decoded frame to draw, which is exactly
     the condition that makes the handover safe. */
  function begin() {
    if (ready) return;
    dur = v.duration || 0;
    if (!dur) return;
    ready = true;
    draw();                                                     // paint before claiming the canvas
    window.dispatchEvent(new CustomEvent('stack:video-ready'));  // scenes.js stands down
    measure();
    new IntersectionObserver(function (es) {
      live = es[0].isIntersecting;
      if (live) requestAnimationFrame(frame);
    }, { rootMargin: '200px' }).observe(track);
  }

  v.addEventListener('loadeddata', function () {
    /* iOS will not paint a video into a canvas until it has been played
       once; a muted play/pause satisfies that without anything visible.
       Priming must not block readiness, so begin() runs either way. */
    var p = v.play();
    if (p && p.then) p.then(function () { v.pause(); begin(); }).catch(begin);
    else { try { v.pause(); } catch (e) {} begin(); }
  });
  /* already cached and past loadeddata by the time we attached */
  if (v.readyState >= 2) begin();

  v.addEventListener('error', function () { /* live scene keeps the section */ });
})();
