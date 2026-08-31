# TSB Labs: where this site stands

Updated 2026-08-31, by checking the live site rather than recalling it.

---

## Live and verified

`https://tsb-labs-portfolio.vercel.app`

| Page | State |
|---|---|
| `index.html` | live. Production formation hero, blueprint cursor, scroll narrative |
| `case-studies.html` | **live**, 200, linked from nine pages. Three approved write ups |
| `portfolio.html`, `services.html`, `products.html` | live |
| `research.html`, `work-with-us.html`, `book.html`, `pay.html` | live |

**A correction worth recording:** our own notes said the case studies were
"built but not deployed", and that was repeated into the Madar roadmap without
anyone checking. They have been live the whole time. Fetching the page took ten
seconds and would have prevented the error. **Check the site, do not recall it.**

---

## What was built in the August push

- **The production formation.** Eleven rings of twelve, 132 unique positions,
  counted in node rather than assumed. It replaced a shape with visible gaps
  that Ahmed spotted immediately.
- **The blueprint cursor** across all nine pages. Dot, damped ring, surveying
  reticle over canvases. Fine pointers only; prose keeps a normal I beam.
- **Cursor presence inside the hero**, so the scene reacts to the pointer.
- **Scroll choreography**, with the dissection sequence on the homepage.
- **Visibility gating** via IntersectionObserver, after a claim that the loops
  never ran together turned out to be false when actually measured.
- **Mobile navigation** on all nine pages, and a de-slop pass on the CSS.

### The photoreal render, and why it was reverted

A Blender render was composited into the hero and then **taken out on Ahmed's
call**: the background hurt the page more than the realism helped. He was right,
and the revert commit says so.

Two things were learned and are worth keeping:

- The ground plane lifted the page background from `rgb(5,7,13)` to
  `rgb(71,95,131)`. Removing the floor still left a delta of 48, because AgX and
  exposure lift a linear world colour. **Rendering transparent and compositing
  over the literal page hex brought the delta to 1.**
- The `overlay` filter drops colour tags, so H.264 output came out with
  `color_primaries=unknown` until `setparams` was added to the chain.

The pipeline lives in `render/` if it is ever wanted again.

---

## Stage

**The site is done for now.** It is a portfolio for a studio with real work to
show, the case studies are up with verified numbers, and nothing on it is
blocking a sale.

**The next change should come from a prospect's reaction, not from our own
list.** Redesigning a site nobody has bounced off yet is the most comfortable
way to avoid selling, and TSB Labs has zero external paying customers as of
today. The constraint is not the website.

---

## House rules for this repo

- **Blueprint blue only.** TSB's identity never mixes with Madar copper, AI
  Founder Hub volt, or Devmate red. See `BRAND-HUB/BRAND-KITS.md`.
- **Design audit at 390, 768 and 1440** via `audit.mjs` before claiming any
  layout works. Headless Chrome clamps below 500px, which once made every phone
  check pass falsely.
- **Verify in the browser, not in the diff.** Most bugs in this repo were found
  by looking at the rendered page.

Related, in `~/Projects/jarvis/docs/os/`: `ROADMAP.md` for the sequence,
`ECOSYSTEM.md` for the positioning this site has to carry.
