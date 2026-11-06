// The test route on the processor (ROADMAP 10.7): the camera driven through the city as the
// pause menu's test drives it, frame by frame, as a phone held sideways runs the game (the touch
// build: the lighter drawing, the mirror every second frame). Each frame is waited for on the
// graphics side before the next, so what is timed is the processor's own work: the game, and the
// sending of the drawing, pass by pass. Also the shaders made ready on the way, and the slowest
// frames with what was slow in them.
//
//   node tools/route.mjs [frames] [dt] [desk]
//     frames: how many (620 at dt 0.1 is the whole route); dt: the seconds of play a frame (0.1:
//     each frame a step of a tenth of a second, the city's life on its own clock); desk: a
//     computer instead of a phone.
import { startServer, launch } from './shot.mjs';

const FR = +(process.argv[2] || 620);
const DT = +(process.argv[3] || 0.1);
const DESK = process.argv[4] === 'desk';

const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 150 }, deviceScaleFactor: 1, isMobile: !DESK, hasTouch: !DESK });
const pg = await ctx.newPage();
await pg.addInitScript((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, 7);
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/v4/index.html?test=1&autostart=1&hour=13`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 300000 });
const out = await pg.evaluate(async ([FR, DT]) => {
  const g = window.__game;
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  window.__frame(20, 1 / 60);
  const perf = g.perf;
  const pipe = g.pipe;
  const r = g.renderer;
  const gl = r.getContext();
  const cur = {};
  const wrap = (obj, name, label) => {
    const f = obj[name].bind(obj);
    obj[name] = (a, b, c) => {
      const t0 = performance.now();
      const x = f(a, b, c);
      cur[label] = (cur[label] || 0) + performance.now() - t0;
      return x;
    };
  };
  wrap(pipe, 'renderShadows', 'P.shadow');
  wrap(pipe, 'renderReflection', 'P.mirror');
  wrap(pipe, 'occlude', 'P.occlude');
  perf.startBench(60, 0);
  perf.toggle(true);
  const rows = [];
  for (let i = 0; i < FR && perf.bench; i++) {
    for (const k in cur) delete cur[k];
    const c0 = perf.bench.compiles;
    window.__frame(1, DT);
    r.setRenderTarget(null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const f = perf.frameMs[perf.frameMs.length - 1];
    rows.push({ i, upd: f.upd, ren: f.ren, calls: f.calls, sys: { ...f.sys, ...cur }, comp: perf.bench ? perf.bench.compiles - c0 : 0 });
  }
  if (perf.bench) perf.endBench();
  perf.toggle(false);
  const N = rows.length;
  const avg = (fn) => rows.reduce((a, x) => a + fn(x), 0) / N;
  const tot = rows.map((x) => x.upd + x.ren).sort((a, b) => a - b);
  const pct = (p) => +tot[Math.min(N - 1, Math.floor(N * p))].toFixed(1);
  const sysAvg = {};
  const sysMax = {};
  for (const x of rows) {
    for (const [k, v] of Object.entries(x.sys)) {
      sysAvg[k] = (sysAvg[k] || 0) + v / N;
      sysMax[k] = Math.max(sysMax[k] || 0, v);
    }
  }
  return {
    frames: N,
    game: +avg((x) => x.upd).toFixed(2),
    draw: +avg((x) => x.ren).toFixed(2),
    calls: Math.round(avg((x) => x.calls)),
    p50: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
    max: pct(1),
    compiles: rows.reduce((a, x) => a + x.comp, 0),
    top: Object.entries(sysAvg).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k} ${v.toFixed(2)} (max ${sysMax[k].toFixed(1)})`),
    slow: rows.slice().sort((a, b) => b.upd + b.ren - (a.upd + a.ren)).slice(0, 8).map((x) => `#${x.i} ${(x.upd + x.ren).toFixed(1)}ms (game ${x.upd.toFixed(1)}, drawing ${x.ren.toFixed(1)}) ` + Object.entries(x.sys).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')),
  };
}, [FR, DT]);
console.log(`the route, ${out.frames} frames of ${DT}s${DESK ? ' (a computer)' : ' (a phone)'}`);
console.log(`processor a frame: game ${out.game} ms, sending the drawing ${out.draw} ms (${out.calls} draws)`);
console.log(`the frame (game + drawing): half under ${out.p50} ms, 90% under ${out.p90}, 99% under ${out.p99}, the slowest ${out.max}`);
console.log(`shaders made ready on the way: ${out.compiles}`);
console.log('the parts (ms a frame, the slowest):');
for (const t of out.top) console.log('  ' + t);
console.log('the slowest frames:');
for (const t of out.slow) console.log('  ' + t);
if (errs.length) console.log('errors:', errs.slice(0, 3));
await browser.close();
server.close();
