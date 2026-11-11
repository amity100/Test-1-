// Small math / random helpers shared by every module.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;

// Frame-rate independent exponential damping.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function dampAngle(a, b, lambda, dt) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.next = mulberry32(seed);
  }
  float(a = 0, b = 1) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.float(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

// Deterministic hash of a number to [0,1).
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function hash2(x, y) {
  return hash1(x * 157.31 + y * 113.97);
}

// 1D smooth value noise.
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u);
}

export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
};

export function isTouchDevice() {
  return (
    (typeof window !== 'undefined' && 'ontouchstart' in window) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
}

// (ROADMAP 19) The phone's own way of drawing: which parts of it are on. Phones only - the same test
// as main.js's `low` (touch, or ?low): a computer draws exactly as it did.
// A part is on by itself only once the owner has approved its pictures (APPROVED, below: set to true
// in the commit that is published after their yes). Until then it is on only when the address asks
// for it - ?<name>, or ?newgfx for all of them - so whatever is published at any moment draws with
// approved parts alone. ?oldgfx: none of it; ?no<name>: all but that part.
// off: all of it switched off for a moment while the game runs (the test route's "as before" stand,
// game/perf.js) - so every part reads its flag where it decides, each frame; what a part builds
// once (lighter shapes) is built when its flag is on and simply not chosen while off is true.
const APPROVED = { shopview: true, carlod: true, folklod: false, glowlite: false, finallite: false, pens2: false, penlite: false, peoplelite: false, roomhide: false, hallmirror: false, hallfar: false };
const LOOK = new Set(['glowlite', 'penlite', 'peoplelite']);
export const GFX = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const phone = isTouchDevice() || q.has('low');
  const on = phone && !q.has('oldgfx');
  // (?newgfx turns on every part that changes no picture; one that changes the look - the glow in five passes - only by
  // its own name, ?glowlite, until the owner has said yes to its pictures)
  // (ROADMAP 19.7, the owner's word: "build what is needed for it to be smooth" - ?fast: the phone's version being built, each
  // round of it on the way to being tried on the phone: every part that changes no picture, and those of this round that do)
  // (ROADMAP 19.13, the owner's word: "build it" - ?lite: the phone's light version, a visible step down: fewer pixels, fewer pens from
  // the middle distance, fewer people and cars, people's simple shapes nearer. It brings every ?fast part with it)
  const lite = phone && !q.has('oldgfx') && q.has('lite');
  const fast = q.has('fast') || lite;
  const part = (name) => on && !q.has('no' + name) && (APPROVED[name] || q.has(name) || ((q.has('newgfx') || fast) && !LOOK.has(name)) || (fast && (name === 'penlite' || name === 'peoplelite')));
  return {
    phone,
    on,
    off: false,
    shopView: part('shopview'), // Stage 1: a shop's goods its own walls hide
    carLod: part('carlod'), // Stage 1: a car far off in fewer points
    folkLod: part('folklod'), // Stage 2: the people by their size on the screen
    // (Stage 3's goodsFar and farHide were tried and not built: ROADMAP 19.3)
    glowLite: part('glowlite'), // Stage 4: the glow in five passes
    finalLite: part('finallite'), // Stage 4: the last pass reads the glow once
    pens2: part('pens2'), // ROADMAP 19.7: the pens in two passes from the start (the same picture; the phone's report: 58 ms instead of 76)
    penLite: part('penlite'), // ROADMAP 19.7: far down a street fewer pens (a change of look, far away)
    hallMirror: part('hallmirror'), // ROADMAP 19.11: deep in Bayview's hall no street mirror (the same picture: the 0.04% and 0.27% seen at first were the far cars' own, there without it too)
    hallFar: part('hallfar'), // ROADMAP 19.12: deep in Bayview's hall the island's far pieces not drawn (far: a sliver through the roof)
    roomHide: part('roomhide'), // ROADMAP 19.10: the shops' rooms behind a front left out where nothing sees into them (the same picture)
    lite,
    peopleLite: part('peoplelite'), // ROADMAP 19.9: people in their simple shapes from 22 m (32 before)
  };
})();

// (GRAPHICS_PLAN.md, ROADMAP 20) The new look, on the opening street: on only when the address asks for it (?look; ?look=0 or ?nolook:
// off). k: how much of it there is where the camera stands now (render/look.js lookFrame, 0..1); off: switched off for a moment while the
// game runs (the tools' before and after)
export const STYLE = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  // (hourK: how much of the look's own evening the clock gives now, 0..1 - game/daynight.js)
  return { on: q.has('look') && q.get('look') !== '0' && !q.has('nolook'), k: 0, off: false, hourK: 1 };
})();

// A tiny pool helper for objects that are recycled often.
export class Pool {
  constructor(factory, size) {
    this.items = [];
    for (let i = 0; i < size; i++) this.items.push(factory(i));
    this.cursor = 0;
  }
  next() {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    return it;
  }
}
