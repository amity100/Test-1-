// (ROADMAP 19.8) Where the processor's time of a frame goes, function by function: the browser's own profiler over FRAMES frames of the
// game at a place (lib.mjs; NODET: the real clock), self time added up by function and by file, the biggest listed. The graphics card here
// is a program on the processor too (SwiftShader) but in its own process: what is counted is the page's own code - the game's and three.js's.
//   WHERE=island EXTRA="fast=1" node tools/perf/cpuprof.mjs        FRAMES=30  TOP=40
import { open } from './lib.mjs';

process.env.NODET = process.env.NODET || '1';
const FRAMES = +(process.env.FRAMES || 30);
const TOP = +(process.env.TOP || 40);
const { pg, where, close } = await open({ frames: +(process.env.WARM || 10), dsf: +(process.env.DSF || 2.625), det: false });
const cdp = await pg.context().newCDPSession(pg);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
const t = await pg.evaluate((n) => {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) window.__frame(1, 1 / 30);
  return performance.now() - t0;
}, FRAMES);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) || 0) + (dt[i] || 0));
const fn = new Map();
const file = new Map();
let total = 0;
for (const [id, us] of self) {
  const n = byId.get(id);
  const cf = n.callFrame;
  const url = (cf.url || '').replace(/^.*\/v5\//, '');
  const k = `${cf.functionName || '(anon)'} ${url}:${cf.lineNumber + 1}`;
  if (cf.functionName === '(idle)' || cf.functionName === '(program)') continue;
  total += us;
  fn.set(k, (fn.get(k) || 0) + us);
  const f = url || cf.functionName;
  file.set(f, (file.get(f) || 0) + us);
}
console.log(`${where}: ${FRAMES} frames, ${(t / FRAMES).toFixed(1)} ms a frame of wall time; sampled ${(total / 1000 / FRAMES).toFixed(1)} ms a frame of the page's code`);
console.log('by file:');
for (const [k, v] of [...file].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${(v / 1000 / FRAMES).toFixed(2).padStart(7)} ms  ${k}`);
console.log('by function (self time):');
for (const [k, v] of [...fn].sort((a, b) => b[1] - a[1]).slice(0, TOP)) console.log(`  ${(v / 1000 / FRAMES).toFixed(2).padStart(7)} ms  ${k}`);
await close();
