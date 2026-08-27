/* ═══════════════════════════════════════════════════════════════════════════
   Design audit. Mobile, tablet and desktop, every page, every time.

   House standard: 390 (phone), 768 (tablet), 1440 (desktop). A page is not
   finished until it passes at all three. Eyeballing one width is how a site
   ends up scrolling sideways on a phone while looking perfect on a laptop.

   What it measures, in the real browser, not from the source:
     · horizontal overflow of the document
     · elements clipped inside their own box
     · text under 12px
     · text below the WCAG contrast floor for its size

   Run:  node audit.mjs            all pages, all widths
         node audit.mjs services   one page
   ═══════════════════════════════════════════════════════════════════════════ */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTHS = [390, 768, 1440];
const ROOT = process.cwd();
const PORT = 8991;

const PROBE = `
<script>
window.addEventListener('load',function(){setTimeout(function(){
  function lum(c){var m=c.match(/[\\d.]+/g);if(!m)return null;
    var v=m.slice(0,3).map(function(x){x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});
    return .2126*v[0]+.7152*v[1]+.0722*v[2];}
  function bgOf(el){while(el){var b=getComputedStyle(el).backgroundColor;
    if(b&&b!=='rgba(0, 0, 0, 0)'&&b!=='transparent')return b;el=el.parentElement;}
    return getComputedStyle(document.body).backgroundColor;}
  var out={overflow:0,tiny:[],contrast:[],clipped:[]},seen={};
  var de=document.documentElement;
  out.overflow=Math.max(0,de.scrollWidth-de.clientWidth);
  document.querySelectorAll('body *').forEach(function(el){
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||!el.getClientRects().length)return;
    var txt=(el.textContent||'').trim();
    var own=Array.from(el.childNodes).some(function(n){return n.nodeType===3&&n.textContent.trim();});
    if(own&&txt){
      var fs=parseFloat(cs.fontSize);
      if(fs<12){var k='t'+fs+txt.slice(0,18);if(!seen[k]){seen[k]=1;
        out.tiny.push(fs.toFixed(1)+'px  "'+txt.slice(0,40)+'"');}}
      var f=lum(cs.color),b=lum(bgOf(el));
      if(f!==null&&b!==null){
        var r=(Math.max(f,b)+.05)/(Math.min(f,b)+.05);
        var big=fs>=24||(fs>=18.66&&parseInt(cs.fontWeight)>=700);
        var need=big?3:4.5;
        if(r<need){var k2='c'+txt.slice(0,18);if(!seen[k2]){seen[k2]=1;
          out.contrast.push(r.toFixed(2)+':1 need '+need+'  "'+txt.slice(0,40)+'"');}}}
    }
    if(el.scrollWidth>el.clientWidth+2&&cs.overflowX!=='auto'&&cs.overflowX!=='scroll'&&cs.overflow!=='hidden'){
      var k3='o'+(el.className&&el.className.baseVal===undefined?el.className:el.tagName);
      if(!seen[k3]){seen[k3]=1;
        var nm=(typeof el.className==='string'&&el.className)||el.tagName;
        out.clipped.push(nm+'  overflows by '+(el.scrollWidth-el.clientWidth)+'px');}}
  });
  document.title='AUDIT'+JSON.stringify(out);
},1000);});
</script>`;

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
               '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  try {
    const body = readFileSync(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});

function render(url, width) {
  return new Promise((resolve) => {
    const c = spawn(CHROME, ['--headless', '--disable-gpu', `--window-size=${width},1300`,
      '--virtual-time-budget=7000', '--dump-dom', url]);
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.on('close', () => {
      const m = out.match(/<title>AUDIT(.*?)<\/title>/s);
      if (!m) return resolve(null);
      try {
        resolve(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')));
      } catch { resolve(null); }
    });
  });
}

const only = process.argv[2];
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('_'))
  .map((f) => f.replace('.html', ''))
  .filter((p) => !only || p === only);

server.listen(PORT, async () => {
  let fails = 0;
  for (const page of pages) {
    const src = readFileSync(join(ROOT, `${page}.html`), 'utf8');
    const tmp = join(ROOT, `_audit_${page}.html`);
    writeFileSync(tmp, src.replace('</body>', `${PROBE}</body>`));
    for (const w of WIDTHS) {
      const r = await render(`http://localhost:${PORT}/_audit_${page}.html`, w);
      if (!r) { console.log(`  ${page.padEnd(16)} ${String(w).padEnd(5)} probe failed`); continue; }
      const bits = [];
      if (r.overflow) bits.push(`PAGE SCROLLS SIDEWAYS by ${r.overflow}px`);
      if (r.clipped.length) bits.push(`clipped: ${r.clipped[0]}`);
      if (r.tiny.length) bits.push(`${r.tiny.length} under 12px`);
      if (r.contrast.length) bits.push(`${r.contrast.length} under contrast floor`);
      if (bits.length) fails++;
      console.log(`  ${page.padEnd(16)} ${String(w).padEnd(5)} ${bits.length ? bits.join(' | ') : 'clean'}`);
      if (process.env.VERBOSE && bits.length) {
        [...r.clipped, ...r.tiny.slice(0, 6), ...r.contrast.slice(0, 6)]
          .forEach((x) => console.log(`        ${x}`));
      }
    }
    unlinkSync(tmp);
  }
  console.log(`\n  ${fails} page/width combinations have findings`);
  server.close();
  process.exit(fails ? 1 : 0);
});
