// The steady pace (v5/js/game/pace.js) in a real browser loop, against a graphics card made busy on
// purpose: tools/pace-synth.html draws a picture whose cost is its pixels times k (and a mirror at
// half the size, mir times as costly a pixel), the processor busy cpu ms a frame. In software
// (SwiftShader) a frame of the city takes seconds, too long for the beat's own logic to run.
//
//   node tools/pace-synth.mjs <outLog> [k=60] [cpu=8] [mir=1.44] [phases=free:3,30:20,auto:20] [throttle=1]
//
// throttle: no animation frame while two frames wait on the card, as a browser with a real card
// does (0: as the software one does, its queue growing to seconds).
// phases: mode:seconds, one after another (free at the free pace's lowest resolution, 0.7). Each
// second: frames drawn and late, the screen's refresh as measured, the beat, the resolution, the
// lighter frames, the frame's time to the card's end, and the time between frames.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './shot.mjs';

const [outLog, K = '60', CPU = '8', MIR = '1.44', PHASE = 'free:3,30:20,auto:20', THROTTLE = '1'] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = path.join(repo, decodeURIComponent(u.pathname));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await launch();
const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
pg.on('pageerror', (e) => errors.push(e.message));
pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await pg.goto(`http://127.0.0.1:${port}/tools/pace-synth.html?k=${K}&cpu=${CPU}&mir=${MIR}&throttle=${THROTTLE}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 });
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const t1 = await pg.evaluate(() => [window.__time1(1), window.__time1(1), window.__time1(0.7), window.__time1(0.5)].map((v) => +v.toFixed(1)));
log(`one frame to the card's end at 100% (twice), 70%, 50%: ${t1.join(', ')} ms`);
const sample = async (secs, label) => {
  for (let s = 0; s < secs; s++) {
    const r = await pg.evaluate(async () => {
      const a = window.__frames.length;
      await new Promise((res) => setTimeout(res, 1000));
      const f = window.__frames.slice(a);
      const pc = window.__pace;
      const c = pc.ctl;
      return { n: f.length, late: f.filter((x) => x[2] > 0).length, iv: f.map((x) => Math.round(x[1])), R: +c.R.toFixed(2), N: c.N, dyn: +window.__pipe.dyn.toFixed(3), lite: c.lite, share: window.__pipe.reflShare, ema: +c.ema.toFixed(1), cpu: +c.cpuE.toFixed(1), cpuBound: c.cpuBound, calib: pc.calib, line: pc.line() };
    });
    log(`${label} ${String(s + 1).padStart(2)}s: frames ${r.n} late ${r.late} | R ${r.R} N ${r.N} dyn ${r.dyn} lite ${r.lite} share ${r.share} ema ${r.ema} cpu ${r.cpu}${r.cpuBound ? ' CPU-BOUND' : ''}${r.calib ? ' calib ' + r.calib : ''} | iv ${r.iv.join(' ')}`);
    if (s === secs - 1) log(`${label} line: ${r.line}`);
  }
};
// phases: mode:seconds, comma separated (free at the free pace's lowest resolution, 0.7)
for (const ph of PHASE.split(',')) {
  const [m, secs] = ph.split(':');
  await pg.evaluate((m) => {
    if (m === 'free') { window.__pipe.scale = 0.7; window.__pace.setMode('free'); }
    else window.__pace.setMode(m);
  }, m);
  await sample(+secs, m.padEnd(4));
}
log('errors ' + JSON.stringify(errors.slice(0, 5)));
fs.writeFileSync(outLog, out.join('\n') + '\n');
await browser.close();
server.close();
