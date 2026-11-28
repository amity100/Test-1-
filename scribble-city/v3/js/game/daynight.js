import * as THREE from 'three';
import { shared } from '../render/materials.js';

// The city's clock. The sun keeps to the same quarter of the sky (low over the river to the
// north-east), rising and sinking through the day: a clear blue noon, the long golden hour, the
// burning sunset the city was drawn in, a violet night of neon, lit windows and lamps, a pink
// dawn. By default the clock stands still at the sunset; it can be set going in the menu.

const MAGIC_KEY = 'scribble-city-time';
const CYCLE = 600; // seconds for a whole day

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
// the palette of each hour: sun (colour, strength, elevation), sky (top, middle, horizon, the
// glow around the sun), the light thrown back by the street, haze, glow, exposure
const KEYS = [
  { t: 0.0, name: 'dawn', el: 0.07, sun: [1.0, 0.72, 0.6], sunK: 1.45, top: [0.5, 0.5, 0.84], mid: [1.0, 0.68, 0.72], hz: [1.0, 0.78, 0.6], glow: [1.0, 0.9, 0.7], bounce: [0.7, 0.58, 0.6], fog: 0.0016, dusk: 0.85, night: 0, bloom: 0.42, exp: 1.0 },
  { t: 0.08, name: 'day', el: 0.62, sun: [1.0, 0.94, 0.82], sunK: 1.85, top: [0.33, 0.52, 0.92], mid: [0.58, 0.74, 0.98], hz: [0.86, 0.9, 0.96], glow: [1.0, 0.96, 0.84], bounce: [0.64, 0.6, 0.58], fog: 0.0011, dusk: 0, night: 0, bloom: 0.3, exp: 0.94 },
  { t: 0.24, name: 'day', el: 0.62, sun: [1.0, 0.94, 0.82], sunK: 1.85, top: [0.33, 0.52, 0.92], mid: [0.58, 0.74, 0.98], hz: [0.86, 0.9, 0.96], glow: [1.0, 0.96, 0.84], bounce: [0.64, 0.6, 0.58], fog: 0.0011, dusk: 0, night: 0, bloom: 0.3, exp: 0.94 },
  { t: 0.32, name: 'golden', el: 0.24, sun: [1.0, 0.8, 0.52], sunK: 1.85, top: [0.4, 0.46, 0.86], mid: [0.9, 0.7, 0.66], hz: [1.0, 0.76, 0.48], glow: [1.0, 0.88, 0.58], bounce: [0.74, 0.58, 0.48], fog: 0.0013, dusk: 0.5, night: 0, bloom: 0.36, exp: 0.97 },
  { t: 0.38, name: 'dusk', el: 0.085, sun: [1.0, 0.66, 0.4], sunK: 1.75, top: [0.42, 0.32, 0.74], mid: [1.0, 0.5, 0.42], hz: [1.0, 0.62, 0.36], glow: [1.0, 0.82, 0.42], bounce: [0.74, 0.52, 0.44], fog: 0.0016, dusk: 1, night: 0, bloom: 0.42, exp: 1.0 },
  { t: 0.5, name: 'dusk', el: 0.085, sun: [1.0, 0.66, 0.4], sunK: 1.75, top: [0.42, 0.32, 0.74], mid: [1.0, 0.5, 0.42], hz: [1.0, 0.62, 0.36], glow: [1.0, 0.82, 0.42], bounce: [0.74, 0.52, 0.44], fog: 0.0016, dusk: 1, night: 0, bloom: 0.42, exp: 1.0 },
  { t: 0.56, name: 'night', el: 0.03, sun: [0.6, 0.4, 0.5], sunK: 0.4, top: [0.16, 0.1, 0.36], mid: [0.5, 0.2, 0.42], hz: [0.72, 0.3, 0.36], glow: [0.8, 0.4, 0.4], bounce: [0.36, 0.24, 0.36], fog: 0.0014, dusk: 0.5, night: 0.75, bloom: 0.6, exp: 1.08 },
  { t: 0.62, name: 'night', el: 0.03, sun: [0.3, 0.3, 0.5], sunK: 0.0, top: [0.05, 0.05, 0.18], mid: [0.12, 0.09, 0.3], hz: [0.3, 0.15, 0.36], glow: [0.4, 0.3, 0.5], bounce: [0.2, 0.16, 0.3], fog: 0.0012, dusk: 0, night: 1, bloom: 0.75, exp: 1.12 },
  { t: 0.88, name: 'night', el: 0.03, sun: [0.3, 0.3, 0.5], sunK: 0.0, top: [0.05, 0.05, 0.18], mid: [0.12, 0.09, 0.3], hz: [0.3, 0.15, 0.36], glow: [0.4, 0.3, 0.5], bounce: [0.2, 0.16, 0.3], fog: 0.0012, dusk: 0, night: 1, bloom: 0.75, exp: 1.12 },
  { t: 0.95, name: 'dawn', el: 0.03, sun: [0.9, 0.6, 0.6], sunK: 0.8, top: [0.3, 0.3, 0.66], mid: [0.8, 0.52, 0.62], hz: [1.0, 0.66, 0.56], glow: [1.0, 0.8, 0.66], bounce: [0.5, 0.42, 0.48], fog: 0.0016, dusk: 0.6, night: 0.35, bloom: 0.5, exp: 1.04 },
  { t: 1.0, name: 'dawn', el: 0.07, sun: [1.0, 0.72, 0.6], sunK: 1.45, top: [0.5, 0.5, 0.84], mid: [1.0, 0.68, 0.72], hz: [1.0, 0.78, 0.6], glow: [1.0, 0.9, 0.7], bounce: [0.7, 0.58, 0.6], fog: 0.0016, dusk: 0.85, night: 0, bloom: 0.42, exp: 1.0 },
];
const AT = { dawn: 0.0, day: 0.16, golden: 0.32, dusk: 0.44, night: 0.75 };

const smooth = (x) => x * x * (3 - 2 * x);
const mixA = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function savedMagic() {
  return true;
}

export class DayNight {
  constructor(game) {
    this.game = game;
    this.on = true;
    let mode = 'dusk';
    try {
      mode = localStorage.getItem(MAGIC_KEY) || 'dusk';
    } catch (e) {
      // storage unavailable
    }
    this.mode = AT[mode] !== undefined || mode === 'cycle' ? mode : 'dusk';
    this.t = AT[this.mode] !== undefined ? AT[this.mode] : AT.dusk;
    this.night = 0;
    this.bloom = 0.42;
    this.pageDark = 0;
    this.az = Math.atan2(-1, 0.3); // the sun's quarter of the sky (as in the first drawing)
    this._c = new THREE.Color();
    this.update(0);
  }

  // (the original edition's switch for its plain look; this edition is always drawn this way)
  setMagic() {
    this.on = true;
  }

  setMode(mode) {
    this.mode = mode;
    if (AT[mode] !== undefined) this.t = AT[mode];
    try {
      localStorage.setItem(MAGIC_KEY, mode);
    } catch (e) {
      // ignore
    }
  }

  get timeName() {
    return this.key.name;
  }

  update(dt) {
    const game = this.game;
    if (this.mode === 'cycle') this.t = (this.t + dt / CYCLE) % 1;
    const t = this.t;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const A = KEYS[i];
    const B = KEYS[i + 1];
    const k = smooth(Math.min(1, Math.max(0, (t - A.t) / Math.max(1e-6, B.t - A.t))));
    this.key = k < 0.5 ? A : B;
    const mix = (a, b) => a + (b - a) * k;
    const set = (u, a, b, s = 1) => {
      const c = mixA(a, b, k);
      u.value.copy(srgb(c[0], c[1], c[2])).multiplyScalar(s);
    };
    // indoors (the bar) the lights are on whatever the hour
    let night = mix(A.night, B.night);
    if (game && game.inBar) night = 0;
    this.night = night;
    shared.uNight.value = night;
    shared.uDusk.value = mix(A.dusk, B.dusk);
    shared.uStars.value = Math.min(1, night * 1.2);
    set(shared.uSunCol, A.sun, B.sun, mix(A.sunK, B.sunK));
    set(shared.uSkyTop, A.top, B.top);
    set(shared.uSkyMid, A.mid, B.mid);
    set(shared.uSkyHorizon, A.hz, B.hz);
    set(shared.uSkySun, A.glow, B.glow);
    set(shared.uBounce, A.bounce, B.bounce);
    shared.uFogDensity.value = mix(A.fog, B.fog);
    const el = mix(A.el, B.el);
    shared.uSunDir.value.set(Math.cos(el) * Math.cos(this.az), Math.sin(el), Math.cos(el) * Math.sin(this.az)).normalize();
    shared.uSunDisc.value.copy(shared.uSunDir.value);
    // the moon over the city at night, in the south-east
    shared.uMoonDir.value.set(0.55, 0.42, 0.72).normalize();
    this.bloom = mix(A.bloom, B.bloom);
    this.exposure = mix(A.exp, B.exp);
    if (game && game.pipe) {
      game.pipe.bloom = this.bloom;
      game.pipe.exposure = this.exposure;
    }
    // headlights on the road in front of the car you drive
    const v = game && game.player && game.player.inVehicle;
    if (v && night > 0.15 && !v.flies) shared.uCarLight.value.set(v.pos.x, v.pos.z, v.yaw, 1);
    else shared.uCarLight.value.w = 0;
  }
}
