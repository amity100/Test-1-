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
  // (a weak graphics card on a computer, as measured on one: the card 120 ms a frame at the full
  // drawing, the mirror half of what is not the drawing. The card works its queue of frames one
  // after another, the browser holding the animation frames back while two wait on it. weakOld:
  // as it was - the processor timed from the animation frame's stamp (the card's wait in it), the
  // mirror not coming down with the drawing, the floor at 0.7)
  weakOld: { hz: 60, cpu: 15, gpu: 120, pix: 0.53, mode: '30', lo: 0.7, queue: true, stamp: true, old: true },
  weak30: { hz: 60, cpu: 15, gpu: 120, pix: 0.53, mir: 0.39, mode: '30', lo: 0.5, queue: true },
  weakAuto: { hz: 60, cpu: 15, gpu: 120, pix: 0.53, mir: 0.39, mode: 'auto', lo: 0.5, queue: true },
  weaker30: { hz: 60, cpu: 15, gpu: 160, pix: 0.53, mir: 0.39, mode: '30', lo: 0.5, queue: true },
  weakerAuto: { hz: 60, cpu: 15, gpu: 160, pix: 0.53, mir: 0.39, mode: 'auto', lo: 0.5, queue: true },
  weakRecovers: { hz: 60, cpu: 15, gpu: 120, pix: 0.53, mir: 0.39, mode: 'auto', lo: 0.5, queue: true, load: (t) => (t < 20 ? 1 : 0.35) },
  // (the same card, its fixed work smaller: the main drawing and the mirror the pixels' alone)
  weakPix30: { hz: 60, cpu: 15, gpu: 120, pix: 0.56, mir: 0.41, mode: '30', lo: 0.5, queue: true },
  // (the card of the panel in ROADMAP 11.3א, its passes as they were measured at 70%: the main
  // drawing 66.8 ms, the mirror 49.3 at its full share, the rest 3.7 - at the full drawing 189 ms;
  // and the same with a quarter of the main drawing's work not the pixels')
  panel30: { hz: 60, cpu: 15, gpu: 189, pix: 0.72, mir: 0.26, mode: '30', lo: 0.5, queue: true, from: 0.7 },
  panelAuto: { hz: 60, cpu: 15, gpu: 189, pix: 0.72, mir: 0.26, mode: 'auto', lo: 0.5, queue: true, from: 0.7 },
  panelFixed30: { hz: 60, cpu: 15, gpu: 189, pix: 0.54, mir: 0.26, mode: '30', lo: 0.5, queue: true, from: 0.7 },
  // (a phone, gov: its processor and card slow down to fill 62% and 68% of the beat's time, and
  // are no faster than cpu and gpu at their fastest; level: the beat it begins on - the slower
  // one, as after a heavy moment. govOld: without the trials, as it was - 20 a second for good.
  // govWeak: a phone that does not hold 30 - how often the trials come, and what they cost.
  // govCrowd: holds 30 but for a crowd from second 25 to 45)
  govOld: { hz: 60, cpu: 15, gpu: 14, pix: 0.7, mode: '30', gov: true, level: 1, noTrial: true, secs: 120 },
  govPhone: { hz: 60, cpu: 15, gpu: 14, pix: 0.7, mode: '30', gov: true, level: 1, secs: 120 },
  govWeak: { hz: 60, cpu: 24, gpu: 44, pix: 0.7, mode: '30', gov: true, level: 1, secs: 600 },
  govCrowd: { hz: 60, cpu: 15, gpu: 14, pix: 0.7, mode: '30', gov: true, level: 1, secs: 120, load: (t) => (t > 25 && t < 45 ? 2.2 : 1), cpuLoad: true },
};

function run(name, verbose) {
  const k = CASES[name];
  seed = 7;
  const c = new PaceControl();
  c.mode = k.mode;
  c.setRefresh(1000 / k.hz);
  // (from: the resolution the free pace had come to, where the steady one begins - game/pace.js)
  if (k.from) c.want = k.from;
  c.setLimits(k.lo || 0.714, k.hi || 1.143, !!k.taa);
  c.governed = !!k.gov && !k.noTrial;
  if (k.level) {
    c.level = k.level;
    c.N = c.choices[c.level];
  }
  const R = 1000 / k.hz;
  let t = 0;
  let frames = 0;
  let late = 0;
  let dynSum = 0;
  let changes = 0;
  const pending = [];
  const secs = k.secs || 60;
  let nextSec = 1;
  const beats = {};
  let lastDyn = c.dyn;
  let gpuFree = 0;
  const onCard = [];
  while (t < secs * 1000) {
    const load = k.load ? k.load(t / 1000) : 1;
    const d = c.dyn;
    // (mir: the mirror's share of the card's work - with the lighter frames at two thirds of its
    // size, then half; the old one did not come down with the drawing at all)
    const mir = k.mir || 0;
    const mk = c.lite >= 2 ? 0.25 : c.lite >= 1 ? 0.45 : 1;
    const mirror = k.old ? 0.39 : mir * d * d * mk;
    let gpu = k.gpu * load * (k.pix * d * d + mirror + (1 - k.pix - (k.old ? 0.39 : mir)));
    let cpu = k.cpu * (k.cpuLoad ? 1 + (load - 1) * 0.6 : 1) * (0.9 + rnd() * 0.2);
    // (gov: what is measured is the slowed-down frame; a frame is late only if it would be at the
    // phone's fastest - a frame running long, and the processor and the card speed up for it)
    let cap = 0;
    if (k.gov) {
      cap = Math.max(cpu, cpu * 0.33 + gpu) * (0.95 + rnd() * 0.1) + (rnd() < 0.01 ? 6 : 0);
      cpu = Math.max(cpu, 0.62 * c.N * (1000 / k.hz));
      gpu = Math.max(gpu, 0.68 * c.N * (1000 / k.hz));
    }
    // (the card's work starting a third of the way into the processor's, the time measured to its
    // end, a little noise and now and then a frame much longer)
    let L = Math.max(cpu, cpu * 0.33 + gpu) * (0.95 + rnd() * 0.1) + (rnd() < 0.01 ? 6 : 0);
    if (k.queue) {
      // (the browser holds the animation frame back while two frames wait on the card: this one
      // begins when the older of them is done, at the refresh after it)
      while (onCard.length && onCard[0] <= t) onCard.shift();
      let start = t;
      if (onCard.length >= 2) {
        const free = onCard[onCard.length - 2];
        start = Math.max(t, Math.ceil(free / R) * R);
        while (onCard.length && onCard[0] <= start) onCard.shift();
      }
      const wait = start - t;
      t = start;
      const g0 = Math.max(t + cpu * 0.33, gpuFree);
      gpuFree = g0 + gpu * (0.95 + rnd() * 0.1);
      onCard.push(gpuFree);
      L = gpuFree - t;
      // (timed from the animation frame's stamp, as it was: the wait for it counted in too)
      if (k.stamp) cpu += wait + Math.min(gpu, 25);
    }
    const B = c.N * R;
    c.frame++;
    frames++;
    dynSum += d;
    beats[c.N] = (beats[c.N] || 0) + 1;
    // late: the next frame's refresh is missed
    const Ll = k.gov ? cap : L;
    if (k.gov) L = Math.max(L, cap);
    const lateBy = Ll > B ? Math.ceil((Ll - B) / R) : 0;
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
      console.log(`${String(nextSec).padStart(3)}s  beat ${(1000 / (c.N * R)).toFixed(0).padStart(3)}/s  dyn ${c.dyn.toFixed(3)}  lite ${c.lite}  frame ${c.ema.toFixed(1)}ms (cpu ${c.cpuE.toFixed(1)})  late so far ${late}${c.cpuBound ? '  cpu-bound' : ''}`);
      nextSec++;
    }
  }
  const beatStr = Object.entries(beats)
    .map(([n, f]) => `${(1000 / (n * R)).toFixed(0)}/s ${Math.round((f / frames) * 100)}%`)
    .join(', ');
  console.log(`${name.padEnd(12)} frames ${frames}  late ${((late / frames) * 100).toFixed(2)}%  mean dyn ${(dynSum / frames).toFixed(3)}  last dyn ${c.dyn.toFixed(3)}  lite ${c.lite}  size changes ${changes}  beats: ${beatStr}`);
}

const [only, flag] = process.argv.slice(2);
if (only) run(only, flag === '-v');
else for (const name of Object.keys(CASES)) run(name, false);
