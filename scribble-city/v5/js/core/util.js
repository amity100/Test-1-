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
const APPROVED = { shopview: true, carlod: true, folklod: false, goodsfar: false, farhide: false, glowlite: false, finallite: false };
export const GFX = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const phone = isTouchDevice() || q.has('low');
  const on = phone && !q.has('oldgfx');
  const part = (name) => on && !q.has('no' + name) && (APPROVED[name] || q.has(name) || q.has('newgfx'));
  return {
    phone,
    on,
    off: false,
    shopView: part('shopview'), // Stage 1: a shop's goods its own walls hide
    carLod: part('carlod'), // Stage 1: a car far off in fewer points
    folkLod: part('folklod'), // Stage 2: the people by their size on the screen
    goodsFar: part('goodsfar'), // Stage 3: a shop's goods from far off
    farHide: part('farhide'), // Stage 3: the island from inside a mall
    glowLite: part('glowlite'), // Stage 4: the glow in five passes
    finalLite: part('finallite'), // Stage 4: the last pass reads the glow once
  };
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
