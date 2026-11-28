// (ROADMAP 19.9) Where the processor's time goes with a crowd round the camera: the focused test's 54 people (game/perf.js focusCrowd)
// stood before the camera on the island's boulevard, the city's own people as they are, and the browser's profiler over FRAMES frames:
// self time by function, the biggest listed. NODET: the real clock.     EXTRA="fast=1" node tools/perf/crowdprof.mjs   FRAMES=40 TOP=40
import { open } from './lib.mjs';

process.env.NODET = '1';
const FRAMES = +(process.env.FRAMES || 40);
const TOP = +(process.env.TOP || 40);
const { pg, close } = await open({ frames: 60, dsf: 1, det: false });
await pg.evaluate(async () => {
  const g = window.__game;
  const { folkLook } = await import('./js/game/looks.js');
  g.enemies.spawnT = 1e9;
  const cam = [5, 1.8, 25];
  window.__camOverride = { pos: cam, look: [5, 1.7, -35] };
  g.player.spawn(5, 25, Math.PI);
  const rows = [3.5, 5, 6.5, 8.5, 11, 14, 18, 23, 29];
  const kinds = [0, 6, 13, 21, 30, 41];
  for (const d of rows) {
    const sep = d <= 12 ? 1.0 : d <= 24 ? 1.3 : 1.6;
    kinds.forEach((k, i) => {
      const c = g.civilians.spawnScripted(5 + (i - 2.5) * sep, 25 - d, folkLook(k), { focus: true }, null);
      c.yaw = 0;
    });
  }
  window.__frame(30, 1 / 30);
});
const cdp = await pg.context().newCDPSession(pg);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
const info = await pg.evaluate((n) => {
  const g = window.__game;
  const perf = g.perf;
  perf.toggle(true);
  let upd = 0;
  let ren = 0;
  const sys = {};
  for (let i = 0; i < n; i++) {
    window.__frame(1, 1 / 30);
    const f = perf.frameMs[perf.frameMs.length - 1];
    upd += f.upd;
    ren += f.ren;
    for (const [k, v] of Object.entries(f.sys || {})) sys[k] = (sys[k] || 0) + v;
  }
  perf.toggle(false);
  return { upd: upd / n, ren: ren / n, people: g.civilians.list.length, sys: Object.entries(sys).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`) };
}, FRAMES);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
const fn = new Map();
for (const [id, us] of self) {
  const cf = byId.get(id).callFrame;
  if (['(idle)', '(program)', 'readPixels'].includes(cf.functionName)) continue;
  const k = `${cf.functionName || '(anon)'} ${(cf.url || '').replace(/^.*\/v5\//, '').replace(/^.*\/js\/vendor\//, 'vendor/')}:${cf.lineNumber + 1}`;
  fn.set(k, (fn.get(k) || 0) + us);
}
console.log(`people ${info.people}; a frame: game ${info.upd.toFixed(1)} ms, sending the drawing ${info.ren.toFixed(1)} ms`);
console.log('systems (ms a frame):', info.sys.join(' · '));
for (const [k, v] of [...fn].sort((a, b) => b[1] - a[1]).slice(0, TOP)) console.log(`  ${(v / 1000 / FRAMES).toFixed(2).padStart(7)} ms  ${k}`);
await close();
