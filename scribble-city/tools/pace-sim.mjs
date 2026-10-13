// The steady pace's decisions (v5/js/game/pace.js PaceControl) against made-up devices: how the
// drawing's resolution and the beat move, frame by frame, and how many frames would come late.
//
//   node tools/pace-sim.mjs            every case, a line each
//   node tools/pace-sim.mjs <case> -v  one case, second by second
//
// A frame's time to the card's end (what the fences measure): the processor's part, and the
// graphics card's work starting a third of the way into it (the pixels' part scales with dyn²).
import { PaceControl } from '../v5/js/game/pace.js';

let seed = 1;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// cpu, gpu (ms at the drawing's own size), pix: the share of the card's work the pixels make;
// load(t): a factor on the card's work at second t; hz: the screen; lo/hi: dyn's limits
const CASES = {
  strongCard: { hz: 60, cpu: 5, gpu: 9, pix: 0.8, mode: 'auto' },
  busyCard: { hz: 60, cpu: 5, gpu: 15, pix: 0.8, mode: 'auto' },
  slowCard60: { hz: 60, cpu: 6, gpu: 24, pix: 0.85, mode: '60' },
  slowCard: { hz: 60, cpu: 6, gpu: 24, pix: 0.85, mode: 'auto' },
  busyCpu: { hz: 60, cpu: 15, gpu: 8, pix: 0.8, mode: 'auto' },
  busyCpu60: { hz: 60, cpu: 15, gpu: 8, pix: 0.8, mode: '60' },
  explosion: { hz: 60, cpu: 6, gpu: 10, pix: 0.8, mode: 'auto', load: (t) => (t > 10 && t < 13 ? 1.7 : 1) },
  phone120: { hz: 120, cpu: 7, gpu: 12, pix: 0.8, mode: 'auto' },
  heatsUp: { hz: 60, cpu: 6, gpu: 10, pix: 0.8, mode: 'auto', load: (t) => 1 + Math.min(1, t / 40) * 0.8 },
  smart: { hz: 60, cpu: 5, gpu: 15, pix: 0.8, mode: 'auto', taa: true, lo: 0.746, hi: 1.49 },
  thirty: { hz: 60, cpu: 6, gpu: 24, pix: 0.85, mode: '30' },
  calmsDown: { hz: 60, cpu: 6, gpu: 20, pix: 0.85, mode: 'auto', load: (t) => (t < 15 ? 1.4 : 0.55) },
};

function run(name, verbose) {
  const k = CASES[name];
  seed = 7;
  const c = new PaceControl();
  c.mode = k.mode;
  c.setRefresh(1000 / k.hz);
  c.setLimits(k.lo || 0.714, k.hi || 1.143, !!k.taa);
  const R = 1000 / k.hz;
  let t = 0;
  let frames = 0;
  let late = 0;
  let dynSum = 0;
  let changes = 0;
  const pending = [];
  const secs = 60;
  let nextSec = 1;
  const beats = {};
  let lastDyn = c.dyn;
  while (t < secs * 1000) {
    const load = k.load ? k.load(t / 1000) : 1;
    const d = c.dyn;
    const gpu = k.gpu * load * (k.pix * d * d + (1 - k.pix));
    const cpu = k.cpu * (0.9 + rnd() * 0.2);
    // (the card's work starting a third of the way into the processor's, the time measured to its
    // end, a little noise and now and then a frame much longer)
    let L = Math.max(cpu, cpu * 0.33 + gpu) * (0.95 + rnd() * 0.1) + (rnd() < 0.01 ? 6 : 0);
    const B = c.N * R;
    c.frame++;
    frames++;
    dynSum += d;
    beats[c.N] = (beats[c.N] || 0) + 1;
    // late: the next frame's refresh is missed
    const lateBy = L > B ? Math.ceil((L - B) / R) : 0;
    pending.push({ n: c.frame, L, cpu, at: t + L + 2 });
    t += (c.N + lateBy) * R;
    if (lateBy) {
      late++;
      c.lateFrame(lateBy);
    }
    while (pending.length && pending[0].at <= t) {
      const f = pending.shift();
      c.measure(f.n, f.L, f.cpu, f.at);
    }
    if (c.dyn !== lastDyn) changes++;
    lastDyn = c.dyn;
    if (verbose && t >= nextSec * 1000) {
      console.log(`${String(nextSec).padStart(3)}s  beat ${(1000 / (c.N * R)).toFixed(0).padStart(3)}/s  dyn ${c.dyn.toFixed(3)}  frame ${c.ema.toFixed(1)}ms (cpu ${c.cpuE.toFixed(1)})  late so far ${late}${c.cpuBound ? '  cpu-bound' : ''}`);
      nextSec++;
    }
  }
  const beatStr = Object.entries(beats)
    .map(([n, f]) => `${(1000 / (n * R)).toFixed(0)}/s ${Math.round((f / frames) * 100)}%`)
    .join(', ');
  console.log(`${name.padEnd(12)} frames ${frames}  late ${((late / frames) * 100).toFixed(2)}%  mean dyn ${(dynSum / frames).toFixed(3)}  last dyn ${c.dyn.toFixed(3)}  size changes ${changes}  beats: ${beatStr}`);
}

const [only, flag] = process.argv.slice(2);
if (only) run(only, flag === '-v');
else for (const name of Object.keys(CASES)) run(name, false);
