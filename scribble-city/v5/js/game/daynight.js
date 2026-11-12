import * as THREE from 'three';
import { shared, SKY_PENS, setLampK, refreshPen } from '../render/materials.js';
import { STYLE } from '../core/util.js';
import { LOOK_KEY, LOOK_SUN, LOOK_DISC } from '../render/look.js';

// The city's clock (ROADMAP 1.1).
//
// A day is 48 real minutes (set in the menu: 24, 48, 96, or the clock stopped at an hour). The
// sun rises in the south over the beach, goes high over the bay and sets in the north, low over
// the water, standing at 18:18 exactly where it stood in the evening the city was first drawn
// in. At night the moon (full, opposite the sun) lights the streets and casts the shadows, the
// lamps and the neon come on and more windows are lit. Every hour has its own pens for the sky.
//
// Every colour is set in sRGB and turned linear the way the city's own are; at the evening's
// hour everything is exactly as it was before there was a clock.

const RAD = Math.PI / 180;
// the evening the city was drawn in: where the sun stood, and when
const EVENING = new THREE.Vector3(0.3, 0.085, -1).normalize();
const EVENING_H = 18.3;
const RISE_H = 6.0;
const MAX_EL = 60 * RAD;
const NIGHT_EL = 50 * RAD;
const E0 = Math.asin(EVENING.y);
const AZ0 = Math.atan2(EVENING.z, EVENING.x);
// (the sun sets so that at the evening's hour it is as high as it was)
const SET_H = RISE_H + ((EVENING_H - RISE_H) * Math.PI) / (Math.PI - Math.asin(E0 / MAX_EL));
// the moon's light (when it is up and the sun is down)
const MOON = [0.62, 0.7, 1.0];
const MOON_K = 0.42;
const STORE = 'scribble-city-v5-clock';

// the evening's pens and colours (as the city has always been)
const P = (a) => a.map((c) => c.slice());
const EVENING_KEY = {
  sun: [1.0, 0.66, 0.4], sunK: 1.75,
  top: [0.42, 0.32, 0.74], mid: [1.0, 0.5, 0.42], hz: [1.0, 0.62, 0.36], glow: [1.0, 0.82, 0.42], bounce: [0.74, 0.52, 0.44], paper: [0.97, 0.94, 0.88],
  fog: 0.0004, bloom: 0.42, exp: 1.0, lamp: 1, lit: 1, stars: 0,
  pens: P(SKY_PENS),
  cloud: [[0.66, 0.44, 0.74], [1.0, 0.72, 0.4]],
  core: [1.0, 0.97, 0.82], ring: [1.0, 0.72, 0.3], sglow: [1.0, 0.75, 0.4],
};
const NIGHT_KEY = {
  sun: [1.0, 0.55, 0.45], sunK: 0,
  top: [0.035, 0.04, 0.13], mid: [0.08, 0.08, 0.24], hz: [0.2, 0.12, 0.3], glow: [0.4, 0.3, 0.55], bounce: [0.2, 0.17, 0.3], paper: [0.3, 0.3, 0.42],
  fog: 0.00055, bloom: 0.8, exp: 1.18, lamp: 1.35, lit: 1.6, stars: 1,
  pens: [
    [0.32, 0.18, 0.45], [0.24, 0.16, 0.48], [0.42, 0.22, 0.46], [0.2, 0.22, 0.42],
    [0.12, 0.12, 0.36], [0.2, 0.12, 0.42], [0.1, 0.16, 0.4], [0.16, 0.1, 0.32],
    [0.05, 0.06, 0.2], [0.08, 0.06, 0.25], [0.04, 0.08, 0.23], [0.1, 0.08, 0.3],
  ],
  cloud: [[0.14, 0.14, 0.28], [0.42, 0.48, 0.7]],
  core: [1.0, 0.97, 0.82], ring: [1.0, 0.72, 0.3], sglow: [1.0, 0.75, 0.4],
};
const DAY_KEY = {
  sun: [1.0, 0.96, 0.88], sunK: 1.9,
  top: [0.3, 0.54, 0.94], mid: [0.55, 0.75, 0.98], hz: [0.84, 0.91, 0.98], glow: [1.0, 0.97, 0.88], bounce: [0.62, 0.6, 0.56], paper: [0.98, 0.97, 0.94],
  fog: 0.0003, bloom: 0.3, exp: 0.92, lamp: 0.1, lit: 0.3, stars: 0,
  pens: [
    [0.86, 0.92, 1.0], [0.72, 0.86, 1.0], [0.96, 0.96, 0.92], [0.76, 0.9, 0.96],
    [0.5, 0.72, 1.0], [0.6, 0.8, 1.0], [0.42, 0.66, 0.96], [0.7, 0.86, 0.98],
    [0.24, 0.48, 0.92], [0.32, 0.56, 0.96], [0.2, 0.42, 0.86], [0.44, 0.62, 0.96],
  ],
  cloud: [[0.84, 0.88, 0.96], [1.0, 1.0, 0.98]],
  core: [1.0, 1.0, 0.96], ring: [1.0, 0.96, 0.78], sglow: [1.0, 0.96, 0.84],
};
// the hours, each with its key (hours between two keys take some of each)
const KEYS = [
  { h: 0, ...NIGHT_KEY },
  { h: 4.6, ...NIGHT_KEY },
  {
    h: 5.4,
    sun: [1.0, 0.7, 0.62], sunK: 0,
    top: [0.18, 0.2, 0.48], mid: [0.5, 0.36, 0.58], hz: [0.92, 0.56, 0.52], glow: [1.0, 0.68, 0.6], bounce: [0.38, 0.34, 0.44], paper: [0.66, 0.64, 0.72],
    fog: 0.0007, bloom: 0.55, exp: 1.08, lamp: 1.1, lit: 1.1, stars: 0.35,
    pens: [
      [1.0, 0.68, 0.55], [0.95, 0.55, 0.58], [0.88, 0.6, 0.72], [1.0, 0.8, 0.66],
      [0.58, 0.42, 0.7], [0.48, 0.38, 0.72], [0.68, 0.42, 0.64], [0.82, 0.55, 0.62],
      [0.22, 0.24, 0.56], [0.28, 0.26, 0.62], [0.2, 0.28, 0.58], [0.36, 0.3, 0.6],
    ],
    cloud: [[0.46, 0.38, 0.56], [1.0, 0.7, 0.62]],
    core: [1.0, 0.98, 0.9], ring: [1.0, 0.75, 0.5], sglow: [1.0, 0.78, 0.6],
  },
  {
    h: 6.3,
    sun: [1.0, 0.74, 0.58], sunK: 1.55,
    top: [0.44, 0.46, 0.82], mid: [1.0, 0.66, 0.68], hz: [1.0, 0.76, 0.56], glow: [1.0, 0.86, 0.66], bounce: [0.7, 0.58, 0.56], paper: [0.97, 0.94, 0.9],
    fog: 0.0008, bloom: 0.46, exp: 1.0, lamp: 0.55, lit: 0.8, stars: 0,
    pens: [
      [1.0, 0.85, 0.6], [1.0, 0.7, 0.6], [1.0, 0.64, 0.68], [1.0, 0.94, 0.84],
      [1.0, 0.64, 0.58], [0.95, 0.56, 0.68], [0.78, 0.58, 0.84], [1.0, 0.76, 0.6],
      [0.5, 0.5, 0.86], [0.68, 0.54, 0.8], [0.4, 0.5, 0.88], [0.84, 0.64, 0.76],
    ],
    cloud: [[0.72, 0.6, 0.76], [1.0, 0.82, 0.66]],
    core: [1.0, 0.98, 0.9], ring: [1.0, 0.78, 0.48], sglow: [1.0, 0.8, 0.58],
  },
  {
    h: 8.3,
    sun: [1.0, 0.9, 0.76], sunK: 1.85,
    top: [0.36, 0.55, 0.9], mid: [0.66, 0.78, 0.95], hz: [0.92, 0.9, 0.86], glow: [1.0, 0.94, 0.8], bounce: [0.66, 0.6, 0.55], paper: [0.98, 0.96, 0.92],
    fog: 0.0005, bloom: 0.34, exp: 0.95, lamp: 0.15, lit: 0.4, stars: 0,
    pens: [
      [0.95, 0.9, 0.78], [0.82, 0.88, 0.98], [1.0, 0.86, 0.72], [0.9, 0.94, 0.98],
      [0.6, 0.76, 0.98], [0.72, 0.8, 0.96], [0.52, 0.7, 0.96], [0.86, 0.86, 0.92],
      [0.3, 0.52, 0.92], [0.38, 0.56, 0.94], [0.26, 0.46, 0.88], [0.5, 0.64, 0.95],
    ],
    cloud: [[0.84, 0.86, 0.94], [1.0, 0.98, 0.92]],
    core: [1.0, 1.0, 0.95], ring: [1.0, 0.93, 0.72], sglow: [1.0, 0.94, 0.78],
  },
  { h: 11, ...DAY_KEY },
  { h: 15, ...DAY_KEY },
  {
    h: 16.9,
    sun: [1.0, 0.84, 0.58], sunK: 1.85,
    top: [0.38, 0.48, 0.88], mid: [0.88, 0.72, 0.66], hz: [1.0, 0.8, 0.52], glow: [1.0, 0.88, 0.6], bounce: [0.72, 0.6, 0.5], paper: [0.98, 0.95, 0.9],
    fog: 0.00036, bloom: 0.36, exp: 0.96, lamp: 0.35, lit: 0.6, stars: 0,
    pens: [
      [1.0, 0.86, 0.52], [1.0, 0.76, 0.46], [1.0, 0.68, 0.5], [1.0, 0.94, 0.8],
      [0.96, 0.72, 0.5], [0.86, 0.6, 0.62], [0.7, 0.62, 0.8], [1.0, 0.8, 0.56],
      [0.42, 0.46, 0.86], [0.6, 0.5, 0.8], [0.36, 0.46, 0.88], [0.8, 0.62, 0.7],
    ],
    cloud: [[0.8, 0.66, 0.74], [1.0, 0.86, 0.6]],
    core: [1.0, 0.98, 0.88], ring: [1.0, 0.85, 0.5], sglow: [1.0, 0.85, 0.55],
  },
  { h: EVENING_H, ...EVENING_KEY },
  {
    h: 19.1,
    sun: [1.0, 0.55, 0.45], sunK: 0,
    top: [0.24, 0.18, 0.52], mid: [0.72, 0.3, 0.5], hz: [0.95, 0.44, 0.38], glow: [0.95, 0.5, 0.45], bounce: [0.48, 0.34, 0.42], paper: [0.78, 0.7, 0.76],
    fog: 0.0005, bloom: 0.58, exp: 1.06, lamp: 1.2, lit: 1.3, stars: 0.25,
    pens: [
      [0.98, 0.55, 0.34], [0.95, 0.42, 0.38], [0.86, 0.36, 0.5], [1.0, 0.7, 0.5],
      [0.8, 0.32, 0.52], [0.62, 0.26, 0.6], [0.5, 0.25, 0.66], [0.9, 0.45, 0.46],
      [0.3, 0.2, 0.6], [0.42, 0.22, 0.6], [0.2, 0.18, 0.52], [0.55, 0.3, 0.62],
    ],
    cloud: [[0.42, 0.28, 0.52], [0.95, 0.5, 0.45]],
    core: [1.0, 0.97, 0.82], ring: [1.0, 0.72, 0.3], sglow: [1.0, 0.75, 0.4],
  },
  { h: 20.2, ...NIGHT_KEY },
  { h: 24, ...NIGHT_KEY },
];

const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const smoothstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

// two keys mixed into one (the look's hour is laid over it)
const NUMS = ['sunK', 'fog', 'bloom', 'exp', 'lamp', 'lit', 'stars'];
const COLS = ['sun', 'top', 'mid', 'hz', 'glow', 'bounce', 'paper', 'core', 'ring', 'sglow'];
function mixKey(A, B, k, out) {
  for (const n of NUMS) out[n] = lerp(A[n], B[n], k);
  for (const c of COLS) out[c] = [lerp(A[c][0], B[c][0], k), lerp(A[c][1], B[c][1], k), lerp(A[c][2], B[c][2], k)];
  out.pens = A.pens.map((p, i) => [lerp(p[0], B.pens[i][0], k), lerp(p[1], B.pens[i][1], k), lerp(p[2], B.pens[i][2], k)]);
  out.cloud = A.cloud.map((p, i) => [lerp(p[0], B.cloud[i][0], k), lerp(p[1], B.cloud[i][1], k), lerp(p[2], B.cloud[i][2], k)]);
  return out;
}

// the sun's height (radians, below 0 at night) and its direction at hour h
export function sunAt(h, out) {
  // (only when it is out of the day: 18.3 must stay 18.3 exactly)
  if (h < 0 || h >= 24) h = ((h % 24) + 24) % 24;
  let el;
  if (h >= RISE_H && h <= SET_H) el = MAX_EL * Math.sin((Math.PI * (h - RISE_H)) / (SET_H - RISE_H));
  else {
    const n = 24 - (SET_H - RISE_H);
    const t = (h > SET_H ? h - SET_H : h + 24 - SET_H) / n;
    el = -NIGHT_EL * Math.sin(Math.PI * t);
  }
  const az = AZ0 - (h - EVENING_H) * (Math.PI / 12);
  if (h === EVENING_H) out.copy(EVENING);
  else out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
  return el;
}

export class DayNight {
  constructor(game) {
    this.game = game;
    const params = game.params;
    // minutes for a whole day (0: the clock stands still)
    this.dayMin = 48;
    this.hour = 17.6;
    // (v5, ROADMAP 12.3) the days gone by since the game began (day 0 a Thursday: the weekend's
    // festival on the first night out)
    this.day = 0;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    } catch (e) {
      saved = null;
    }
    if (saved && typeof saved.day === 'number') this.day = saved.day;
    if (saved && typeof saved.dayMin === 'number') {
      this.dayMin = saved.dayMin;
      if (saved.dayMin === 0 && typeof saved.hour === 'number') this.hour = saved.hour;
    }
    // (for the tests: the evening, standing still, unless an hour is asked for)
    if (params.has('test')) {
      this.dayMin = 0;
      this.hour = EVENING_H;
    }
    if (params.has('hour')) this.hour = parseFloat(params.get('hour')) || 0;
    if (params.has('daymin')) this.dayMin = parseFloat(params.get('daymin')) || 0;
    if (params.has('day')) this.day = parseInt(params.get('day'), 10) || 0;
    this.sun = new THREE.Vector3();
    this.moon = new THREE.Vector3();
    this.key = KEYS[0];
    this._c = new THREE.Color();
    this.lampGlass = null;
    this.lampBase = null;
    this.lampK = -1;
    this.update(0);
  }

  // the clock: running (a day in this many minutes) or standing still (0)
  setDayLength(min) {
    this.dayMin = min;
    this.save();
  }

  setHour(h) {
    this.hour = h < 0 || h >= 24 ? ((h % 24) + 24) % 24 : h;
    this.save();
    this.update(0);
  }

  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ dayMin: this.dayMin, hour: this.hour, day: this.day }));
    } catch (e) {
      // (no storage: the settings last as long as the page)
    }
  }

  // "18:24"
  get clock() {
    const m = Math.floor(this.hour * 60) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  // (ROADMAP 12.3) the day of the week: 0 Sunday .. 6 Saturday
  get weekday() {
    return (this.day + 4) % 7;
  }

  // how dark it is (0 day .. 1 night): for the life of the city
  get night() {
    return Math.min(1, this.stars || 0);
  }

  update(dt) {
    if (this.dayMin > 0 && dt > 0) {
      this.hour += (dt / (this.dayMin * 60)) * 24;
      if (this.hour >= 24) {
        this.hour -= 24;
        this.day++;
        this.save();
      }
    }
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const A = KEYS[i];
    const B = KEYS[i + 1];
    const k = smooth(Math.min(1, Math.max(0, (h - A.h) / Math.max(1e-6, B.h - A.h))));
    this.key = k < 0.5 ? A : B;
    // (ROADMAP 20: the look's own hour over the clock's, by how much of the look there is here - render/look.js)
    let KA = A;
    let KB = B;
    let kk = k;
    // (the owner's word: the game has its morning, noon and evening - under the look too. The look's own hour is the evening's: all of
    // it from five to half past seven, none before half past three or after half past eight; the rest of the day and the night keep
    // the clock's colours, drawn in the look's pens and its wet street)
    const hk = smoothstep(15.5, 17.0, h) * (1 - smoothstep(19.5, 20.5, h));
    STYLE.hourK = hk;
    const lk = STYLE.k * hk;
    if (lk > 0.001) {
      KA = mixKey(A, B, k, this._mk || (this._mk = {}));
      KB = LOOK_KEY;
      kk = lk;
    }
    const c = this._c;
    // a colour of the hour, linear (as the city's own srgb())
    const col = (u, a, b, s = 1) => {
      c.setRGB(lerp(a[0], b[0], kk), lerp(a[1], b[1], kk), lerp(a[2], b[2], kk), THREE.SRGBColorSpace);
      u.value.copy(c);
      if (s !== 1) u.value.multiplyScalar(s);
    };
    // (sRGB as it is: the sky's shader turns it)
    const raw = (v, a, b) => v.set(lerp(a[0], b[0], kk), lerp(a[1], b[1], kk), lerp(a[2], b[2], kk));
    // the sun, the moon (full, across the sky from the sun) and which of them gives the light
    let el = sunAt(h, this.sun);
    // (not while the opening story runs: its light comes from where its own evening has it, in the film and in the player's own
    // time between its scenes alike - the shadows do not swing round at every cut)
    if (lk > 0.001 && !(this.game.prologue && this.game.prologue.active)) {
      this.sun.lerp(LOOK_SUN, lk).normalize();
      el = Math.asin(this.sun.y);
    }
    this.moon.copy(this.sun).negate();
    this.sunEl = el;
    const sunUp = smoothstep(-0.5 * RAD, 3 * RAD, el);
    const moonUp = smoothstep(4 * RAD, 14 * RAD, -el);
    if (sunUp > 0) {
      shared.uSunDir.value.copy(this.sun);
      col(shared.uSunCol, KA.sun, KB.sun, lerp(KA.sunK, KB.sunK, kk) * sunUp);
    } else {
      shared.uSunDir.value.copy(this.moon);
      shared.uSunCol.value.setRGB(MOON[0], MOON[1], MOON[2], THREE.SRGBColorSpace).multiplyScalar(MOON_K * moonUp);
    }
    shared.uSunDisc.value.copy(this.sun);
    if (lk > 0.001 && sunUp > 0 && !(this.game.prologue && this.game.prologue.active)) shared.uSunDisc.value.lerp(LOOK_DISC, lk).normalize();
    shared.uSunDiscK.value = smoothstep(-3 * RAD, -0.5 * RAD, el);
    // the sky, the light thrown back by the street, the page, the haze
    col(shared.uSkyTop, KA.top, KB.top);
    col(shared.uSkyMid, KA.mid, KB.mid);
    col(shared.uSkyHorizon, KA.hz, KB.hz);
    col(shared.uSkySun, KA.glow, KB.glow);
    col(shared.uBounce, KA.bounce, KB.bounce);
    col(shared.uPaper, KA.paper, KB.paper);
    shared.uFogDensity.value = lerp(KA.fog, KB.fog, kk);
    const pens = shared.uSkyPen.value;
    for (let p = 0; p < 12; p++) raw(pens[p], KA.pens[p], KB.pens[p]);
    raw(shared.uCloudC.value[0], KA.cloud[0], KB.cloud[0]);
    raw(shared.uCloudC.value[1], KA.cloud[1], KB.cloud[1]);
    raw(shared.uSunCore.value, KA.core, KB.core);
    raw(shared.uSunRing.value, KA.ring, KB.ring);
    raw(shared.uSunGlow.value, KA.sglow, KB.sglow);
    // the night: stars, the moon, lamps, lit windows
    this.stars = lerp(KA.stars, KB.stars, kk);
    shared.uStars.value = this.stars;
    shared.uMoonDir.value.copy(this.moon);
    shared.uMoonK.value = Math.min(1, this.stars * 1.5) * smoothstep(-1 * RAD, 2 * RAD, -el);
    shared.uLitK.value = lerp(KA.lit, KB.lit, kk);
    const game = this.game;
    // (a dark grey day turns the lamps on: game/weather.js)
    let lamp = lerp(KA.lamp, KB.lamp, kk);
    if (game.weather) lamp = game.weather.lamps(this, lamp);
    setLampK(lamp);
    this.setLampGlass(lamp);
    if (game.pipe) {
      game.pipe.bloom = lerp(KA.bloom, KB.bloom, kk);
      game.pipe.exposure = lerp(KA.exp, KB.exp, kk);
      // the shadows follow the light (in steps: render/pipeline.js)
      game.pipe.setShadowDir(shared.uSunDir.value);
    }
    // the weather changes what the hour has set (grey skies, the fog)
    if (game.weather) game.weather.apply(this);
  }

  // the street lamps' glass: dark by day, bright at night (one row of the pens' table)
  setLampGlass(k) {
    if (!this.lampGlass) {
      const M = this.game.world && this.game.world.ctx && this.game.world.ctx.M;
      if (!M || !M.lampGlass) return;
      this.lampGlass = M.lampGlass;
      this.lampBase = M.lampGlass.uniforms.uEmissive.value.clone();
    }
    if (Math.abs(k - this.lampK) < 0.01) return;
    this.lampK = k;
    this.lampGlass.uniforms.uEmissive.value.copy(this.lampBase).multiplyScalar(k);
    refreshPen(this.lampGlass);
  }
}
