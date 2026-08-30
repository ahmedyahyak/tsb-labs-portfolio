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

  var ctx = cv.getContext('2d');
  var ready = false, live = false, dur = 0, target = 0, t = 0;

  function measure() {
    var r = track.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    target = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }

  function draw() {
    /* cover-fit: the canvas is viewport-shaped, the frames are portrait */
    var cw = cv.width, ch = cv.height;
    var vw = v.videoWidth, vh = v.videoHeight;
    if (!vw) return;
    var s = Math.max(cw / vw, ch / vh);
    var w = vw * s, h = vh * s;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(v, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function frame() {
    if (!live) return;
    t += (target - t) * 0.14;               // same playhead easing as the canvas
    var want = t * dur;
    if (Math.abs(v.currentTime - want) > 0.008) v.currentTime = want;
    draw();
    requestAnimationFrame(frame);
  }

  v.addEventListener('loadedmetadata', function () { dur = v.duration || 0; });
  /* seeked fires once the requested frame is genuinely decoded, which is
     the only honest signal that the handover is safe */
  v.addEventListener('seeked', function () {
    if (ready) { draw(); return; }
    ready = true;
    window.dispatchEvent(new CustomEvent('stack:video-ready'));  // scenes.js stands down
    measure();
    new IntersectionObserver(function (es) {
      live = es[0].isIntersecting;
      if (live) requestAnimationFrame(frame);
    }, { rootMargin: '200px' }).observe(track);
  });

  window.addEventListener('scroll', measure, { passive: true });

  v.addEventListener('loadeddata', function () {
    /* iOS will not paint a video into a canvas until it has been played
       once; a muted play/pause satisfies that without anything visible. */
    var p = v.play();
    if (p && p.then) p.then(function () { v.pause(); v.currentTime = 0.001; })
                     .catch(function () { v.currentTime = 0.001; });
    else { v.pause(); v.currentTime = 0.001; }
  });

  v.addEventListener('error', function () { /* live scene keeps the section */ });
})();
