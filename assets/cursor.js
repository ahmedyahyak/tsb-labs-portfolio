/* The blueprint cursor.

   TSB's identity is engineering, so the cursor is an instrument, not a
   decoration: a dot that answers instantly, a ring that follows with the
   weight of a damped gauge needle, and over any 3D scene it becomes a
   surveying reticle with live coordinates in the mono face. Over links and
   buttons the ring leans toward the target and opens, which reads as the
   site meeting your hand halfway.

   Discipline, so it stays an instrument and never becomes confetti:
   - fine pointers only; a phone never sees any of this
   - prefers-reduced-motion keeps the dot and kills the trailing physics
   - text fields keep the native I-beam, because editing beats theatre
   - everything is two fixed elements and one rAF; no DOM churn, no trails */
(function () {
  'use strict';
  if (!window.matchMedia('(pointer: fine)').matches) return;
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.createElement('div');
  root.id = 'bpc';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="bpc-dot"></div>' +
    '<div class="bpc-ring"></div>' +
    '<div class="bpc-x"></div><div class="bpc-y"></div>' +
    '<div class="bpc-co"></div>';
  document.body.appendChild(root);
  document.documentElement.classList.add('bpc-on');

  var dot = root.children[0], ring = root.children[1];
  var hx = root.children[2], hy = root.children[3], co = root.children[4];

  var mx = -100, my = -100;          // where the pointer is
  var rx = -100, ry = -100;          // where the ring is
  var mode = 'idle';                 // idle | hot | scene | text
  var hotEl = null;

  var HOT = 'a, button, [role="button"], summary, input[type="submit"], .dot';
  var SCENE = 'canvas.scene, #landscape, #stack';
  var TEXT = 'input:not([type="submit"]), textarea, select, [contenteditable]';

  document.addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    var t = e.target;
    if (t.closest(TEXT)) { mode = 'text'; hotEl = null; }
    else if (t.closest(SCENE)) { mode = 'scene'; hotEl = null; }
    else if ((hotEl = t.closest(HOT))) { mode = 'hot'; }
    else { mode = 'idle'; hotEl = null; }
  }, { passive: true });

  document.addEventListener('pointerdown', function () { root.classList.add('bpc-press'); });
  document.addEventListener('pointerup', function () { root.classList.remove('bpc-press'); });
  document.addEventListener('pointerleave', function () { mode = 'text'; });

  function frame() {
    /* The ring trails on a damped spring; the dot never waits. Under
       reduced motion the ring rides with the dot: present, not animated. */
    var k = REDUCE ? 1 : 0.16;
    var tx = mx, ty = my;
    if (mode === 'hot' && hotEl) {
      /* magnetic: the ring leans 30% of the way into the target's centre */
      var b = hotEl.getBoundingClientRect();
      tx = mx + (b.left + b.width / 2 - mx) * 0.3;
      ty = my + (b.top + b.height / 2 - my) * 0.3;
    }
    rx += (tx - rx) * k; ry += (ty - ry) * k;

    root.className = 'bpc-' + mode + (root.classList.contains('bpc-press') ? ' bpc-press' : '');
    dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
    ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';

    if (mode === 'scene') {
      hx.style.transform = 'translateY(' + my + 'px)';
      hy.style.transform = 'translateX(' + mx + 'px)';
      co.style.transform = 'translate(' + (mx + 16) + 'px,' + (my + 18) + 'px)';
      co.textContent = String(mx).padStart(4, '0') + ' · ' + String(my).padStart(4, '0');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
