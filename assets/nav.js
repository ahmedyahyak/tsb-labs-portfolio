/* Mobile nav enhancement. The disclosure itself is a <details>, so with
   scripting off the menu still opens and closes; this file only adds the
   parts HTML cannot: Escape closes it, choosing a link closes it, and the
   close gets the 140ms exit the entrance already pays in CSS. Under
   prefers-reduced-motion the close is immediate, matching the entrance. */
(function () {
  var d = document.getElementById('mnav');
  if (!d) return;
  var panel = d.querySelector('nav');

  function shut () {
    if (!d.open) return;
    if (!panel || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.open = false;
      return;
    }
    panel.style.animation = 'mnav-out .14s var(--ease-out) forwards';
    setTimeout(function () {
      panel.style.animation = '';
      d.open = false;
    }, 140);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') shut();
  });
  d.addEventListener('click', function (e) {
    if (e.target.closest('a')) shut();
  });
})();
