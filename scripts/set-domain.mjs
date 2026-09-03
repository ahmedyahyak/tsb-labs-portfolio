/* ═══════════════════════════════════════════════════════════════════════════
   The canonical host, in one place, changed in one command.

   The site's own address was written into eight files by hand: the JSON-LD
   `url` on four pages, the README twice, STATUS.md once. Nothing declared a
   canonical URL at all, so search engines and link previews were left to guess
   which host a page really lives on, and a move to a real domain meant grepping
   for a string and hoping.

   Now `domain.json` holds the answer and this rewrites everything from it.

   Run:  node scripts/set-domain.mjs                    check, changes nothing
         node scripts/set-domain.mjs https://tsb.example  move to that host

   The check mode exits non-zero on drift, so it can gate a deploy.

   ── what it will not touch ────────────────────────────────────────────────
   Only the site's own host is rewritten. `ahmedyahyak.com`, the Calendly link,
   the Devmate and Luqma URLs and every other outbound link are left exactly as
   they are, because they belong to somebody else's DNS.

   DOMAIN.md is excluded too. It discusses the old host as prose, in sentences
   about what the site runs on today and why, and search-and-replacing a
   narrative turns it into a lie. That file is edited by hand or not at all.

   ── noindex pages ─────────────────────────────────────────────────────────
   book.html, pay.html and brand/index.html carry `<meta name="robots"
   content="noindex">`. They stay out of the sitemap, because listing a page you
   have asked not to be indexed is a contradiction a crawler will report. They
   still get `og:url`, since both are sent to clients directly and a link
   preview without a URL is a worse first impression than no preview.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, 'domain.json');

/* Files that mention the site's own host in a way that should follow it. */
const PROSE = ['README.md', 'STATUS.md'];

const read = f => readFileSync(join(ROOT, f), 'utf8');
const write = (f, s) => writeFileSync(join(ROOT, f), s);

/* Every page, and the path it answers on. index.html is the root, and a
   directory index is its directory: /brand/index.html and /brand/ are the same
   page, and declaring the longer one canonical splits the two apart. */
function pages() {
  const html = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
  if (existsSync(join(ROOT, 'brand', 'index.html'))) html.push('brand/index.html');
  return html.map(file => {
    const path = file === 'index.html' ? '/'
      : file.endsWith('/index.html') ? `/${file.slice(0, -'index.html'.length)}`
      : `/${file}`;
    const body = read(file);
    return { file, path, body, indexable: !/<meta name="robots" content="noindex">/.test(body) };
  });
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Puts the two tags in the head, or corrects them if they are already there.
   They go after og:type where there is one so the Open Graph block stays
   together, and after the title otherwise, which every page has. */
function tag(body, { path, indexable }, host) {
  const canonical = `<link rel="canonical" href="${host}${path}">`;
  const ogUrl = `<meta property="og:url" content="${host}${path}">`;

  body = body.replace(/^<link rel="canonical"[^>]*>\n/m, '')
             .replace(/^<meta property="og:url"[^>]*>\n/m, '');

  const block = (indexable ? [canonical, ogUrl] : [ogUrl]).join('\n') + '\n';
  const anchor = /^<meta property="og:type"[^>]*>\n/m.test(body)
    ? /^<meta property="og:type"[^>]*>\n/m
    : /^<title>.*<\/title>\n/m;

  return body.replace(anchor, m => m + block);
}

function sitemap(list, host) {
  const urls = list.filter(p => p.indexable)
    .map(p => `  <url><loc>${host}${p.path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const robots = host => `User-agent: *\nAllow: /\n\nSitemap: ${host}/sitemap.xml\n`;

/* ── run ──────────────────────────────────────────────────────────────────── */

const current = JSON.parse(read('domain.json')).canonical.replace(/\/$/, '');
const target = (process.argv[2] || '').replace(/\/$/, '');

if (target && !/^https:\/\/[a-z0-9.-]+$/i.test(target)) {
  console.error(`not a host this will accept: ${target}`);
  console.error('expected something like https://tsblabs.example, https only, no path');
  process.exit(2);
}

const host = target || current;
const list = pages();

if (!target) {
  /* Check mode. Reports drift rather than fixing it, so that a deploy gate and
     a migration are never the same command run by accident. */
  const problems = [];
  for (const p of list) {
    const want = tag(p.body, p, host);
    if (want !== p.body) problems.push(`${p.file}: canonical or og:url missing or wrong`);
  }
  /* Only the site's own host is in scope. An earlier version of this check
     swept every *.vercel.app URL it found and reported thermarolls and
     tsb-os-demo as drift, which are other people's deployments and none of
     this script's business. What actually goes wrong is domain.json being
     edited without the migration being run, and that shows up as prose that
     no longer names the canonical host at all. */
  for (const f of PROSE) {
    if (!read(f).includes(host)) problems.push(`${f}: never names the canonical host`);
  }
  for (const [f, want] of [['sitemap.xml', sitemap(list, host)], ['robots.txt', robots(host)]]) {
    if (!existsSync(join(ROOT, f)) || read(f) !== want) problems.push(`${f}: missing or stale`);
  }

  console.log(`canonical host: ${host}`);
  console.log(`${list.length} pages, ${list.filter(p => p.indexable).length} indexable`);
  if (problems.length) {
    console.error(`\n${problems.length} problem${problems.length > 1 ? 's' : ''}:`);
    for (const p of problems) console.error(`  · ${p}`);
    console.error('\nfix with: node scripts/set-domain.mjs ' + host);
    process.exit(1);
  }
  console.log('clean');
  process.exit(0);
}

let touched = 0;
for (const p of list) {
  const next = tag(p.body, p, host).split(current).join(host);
  if (next !== p.body) { write(p.file, next); touched++; }
}
for (const f of PROSE) {
  const before = read(f), next = before.split(current).join(host);
  if (next !== before) { write(f, next); touched++; }
}
write('sitemap.xml', sitemap(list, host));
write('robots.txt', robots(host));
writeFileSync(CONFIG, JSON.stringify({ canonical: host }, null, 2) + '\n');

console.log(`canonical host: ${current} → ${host}`);
console.log(`${touched} file${touched === 1 ? '' : 's'} rewritten, sitemap.xml and robots.txt regenerated`);
console.log('\nDOMAIN.md was left alone on purpose. Read it and update the prose by hand.');
console.log('Then load the new host in a browser and check the certificate.');
