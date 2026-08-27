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

   ── why this drives Chrome over CDP ──────────────────────────────────────
   This used to render with `--window-size=390,1300 --dump-dom`. Chrome will
   not open a window narrower than 500px, in either headless mode, so it
   silently rendered the phone column at 500px instead. Every "390 clean"
   this tool ever printed was really a 500 clean, and the narrowest width the
   site claimed to support was never actually tested. Verify with:
     chrome --headless --window-size=390,800 --dump-dom <page that prints
     window.innerWidth>   →   500

   Emulation.setDeviceMetricsOverride sets a true layout viewport at any
   width, so 390 now means 390. Node 22 ships a global WebSocket, so speaking
   CDP directly costs no dependencies.

   Two things fell out of the change: the whole run shares one browser rather
   than spawning 27, and the probe is evaluated against the real page instead
   of a `_audit_*.html` copy written next to it, so a crash can no longer
   leave temp files behind in the repo.
   ═══════════════════════════════════════════════════════════════════════════ */
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTHS = [390, 768, 1440];
const ROOT = process.cwd();
/* Port 0 lets the OS pick a free one. It was hardcoded, which meant two
   copies of this tool running at once, one per repo, collided on the same
   port and the second died with EADDRINUSE mid audit. */
let PORT = 0;

/* Runs inside the page. Returns the findings object. Identical rules to
   before: own-text nodes only, WCAG 4.5 for body copy and 3.0 for large or
   large-and-bold, background resolved by walking up to the first painted
   ancestor. */
const PROBE = `(async () => {
  await new Promise(r => setTimeout(r, 1200));
  function lum(c){var m=c.match(/[\\d.]+/g);if(!m)return null;
    var v=m.slice(0,3).map(function(x){x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});
    return .2126*v[0]+.7152*v[1]+.0722*v[2];}
  function bgOf(el){while(el){var b=getComputedStyle(el).backgroundColor;
    if(b&&b!=='rgba(0, 0, 0, 0)'&&b!=='transparent')return b;el=el.parentElement;}
    return getComputedStyle(document.body).backgroundColor;}
  var out={overflow:0,tiny:[],contrast:[],clipped:[],width:window.innerWidth},seen={};
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
  return out;
})()`;

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

/* ── the smallest CDP client that does the job ──────────────────────────── */
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.waiters = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method) {
        this.waiters = this.waiters.filter((w) => {
          if (w.method === m.method && (!w.sessionId || w.sessionId === m.sessionId)) { w.resolve(m.params); return false; }
          return true;
        });
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  once(method, sessionId, ms = 15000) {
    return new Promise((resolve) => {
      const w = { method, sessionId, resolve };
      this.waiters.push(w);
      setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); resolve(null); }, ms);
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome(profile) {
  /* Same reasoning as the HTTP port above: 0 lets the OS choose, so two audits
     running at once cannot fight over one debugging port. Chrome writes the
     port it settled on into DevToolsActivePort in the profile directory. */
  const proc = spawn(CHROME, ['--headless', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    try {
      const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      const j = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      if (j.webSocketDebuggerUrl) return { proc, wsUrl: j.webSocketDebuggerUrl };
    } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('Chrome did not expose a debugging port');
}

async function measure(cdp, url, width) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 1300, deviceScaleFactor: 1, mobile: false }, sessionId);
    const loaded = cdp.once('Page.loadEventFired', sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);
    await loaded;
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate',
      { expression: PROBE, awaitPromise: true, returnByValue: true }, sessionId);
    if (exceptionDetails) return null;
    return result.value;
  } catch { return null; }
  finally { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); }
}

const only = process.argv[2];
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('_'))
  .map((f) => f.replace('.html', ''))
  .filter((p) => !only || p === only);

server.listen(0, async () => {
  PORT = server.address().port;
  const profile = mkdtempSync(join(tmpdir(), 'audit-chrome-'));
  let chrome, cdp, fails = 0;
  try {
    chrome = await launchChrome(profile);
    const ws = new WebSocket(chrome.wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    cdp = new CDP(ws);

    for (const page of pages) {
      for (const w of WIDTHS) {
        const r = await measure(cdp, `http://localhost:${PORT}/${page}.html`, w);
        if (!r) { console.log(`  ${page.padEnd(16)} ${String(w).padEnd(5)} probe failed`); fails++; continue; }
        const bits = [];
        /* If the viewport is not the width we asked for the numbers mean
           nothing, so say so rather than printing a clean line. */
        if (r.width !== w) bits.push(`VIEWPORT IS ${r.width}px, NOT ${w}px`);
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
    }
    console.log(`\n  ${fails} page/width combinations have findings`);
  } finally {
    /* Chrome keeps writing to the profile as it shuts down, so wait for the
       process to actually exit before deleting it, then let rm retry. */
    try { await cdp?.send('Browser.close'); } catch { chrome?.proc.kill(); }
    if (chrome?.proc && chrome.proc.exitCode === null) {
      await Promise.race([
        new Promise((r) => chrome.proc.once('exit', r)),
        sleep(5000).then(() => chrome.proc.kill()),
      ]);
    }
    server.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  process.exit(fails ? 1 : 0);
});
