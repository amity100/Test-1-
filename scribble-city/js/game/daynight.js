import * as THREE from 'three';
import { shared, GOLDEN_SUN } from '../render/materials.js';
import { styleAt, styleParams, STYLES, STYLE_LABEL } from '../render/districts.js';

// The magic world's clock and page. A day goes by in a few minutes: golden afternoon, a burning
// sunset, a night where the notebook page turns dark and everything is drawn in glowing gel pen
// (stars, a moon, lit windows, lamps), then a pink dawn. The page also takes the paper of the
// district you stand in: toned paper by the theaters, drafting paper by the banks, a black page
// at the crash site.

const MAGIC_KEY = 'scribble-city-magic';
const CYCLE = 480; // seconds for a whole day
const DAY_PAPER = new THREE.Color(0.968, 0.958, 0.93);
const NIGHT_PAGE = new THREE.Color(0.072, 0.082, 0.155);

const SKY = {
  day: { hz: [1.0, 0.8, 0.56], mid: [1.0, 0.94, 0.86], ze: [0.87, 0.92, 1.03] },
  dusk: { hz: [1.0, 0.64, 0.34], mid: [0.98, 0.6, 0.64], ze: [0.55, 0.52, 0.88] },
  dawn: { hz: [1.0, 0.8, 0.6], mid: [0.98, 0.76, 0.8], ze: [0.76, 0.8, 1.0] },
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (a, peak, b, x) => (x < peak ? smooth(a, peak, x) : 1 - smooth(peak, b, x));
const lerp3 = (out, a, b, t) => out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);

export function savedMagic() {
  try {
    if (localStorage.getItem(MAGIC_KEY) === '0') return false;
  } catch (e) {
    // storage unavailable
  }
  return true;
}

export class DayNight {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.t = 0.2; // start in the afternoon: the sun sets after a minute and a half
    this.mode = 'cycle'; // cycle | day | dusk | night
    this.paper = new THREE.Color().copy(DAY_PAPER);
    this.page = new THREE.Vector4(1, 0, 1, 0);
    this.pageDark = 0;
    this.styleHere = 0;
    this.announced = 0;
    this.night = 0;
    this.bloom = 0;
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this.nightPaper = new THREE.Color().copy(NIGHT_PAGE);
    this._v = new THREE.Vector3();
  }

  // the master switch: off is exactly the original look
  setMagic(on) {
    this.on = on;
    shared.uMagic.value = on ? 1 : 0;
    if (!on) {
      shared.uNight.value = 0;
      shared.uDusk.value = 0;
      shared.uStars.value = 0;
      shared.uSkyPaper.value.copy(DAY_PAPER);
    }
    try {
      localStorage.setItem(MAGIC_KEY, on ? '1' : '0');
    } catch (e) {
      // ignore
    }
    if (this.onChange) this.onChange(on);
  }

  setMode(mode) {
    this.mode = mode;
    const at = { day: 0.2, dusk: 0.43, night: 0.68 }[mode];
    if (at !== undefined) this.t = at;
  }

  get timeName() {
    const t = this.t;
    if (t < 0.36) return 'day';
    if (t < 0.52) return 'dusk';
    if (t < 0.86) return 'night';
    return 'dawn';
  }

  update(dt) {
    if (!this.on) return;
    const game = this.game;
    if (this.mode === 'cycle') this.t = (this.t + dt / CYCLE) % 1;
    const t = this.t;
    // how dark it is, how much the horizon burns
    let night = smooth(0.45, 0.53, t) * (1 - smooth(0.86, 0.94, t));
    const dusk = bump(0.34, 0.43, 0.52, t);
    const dawn = bump(0.86, 0.93, 1.0, t);
    // indoors (the bar) the lights are on
    if (game.inBar) night = 0;
    this.night = night;
    shared.uNight.value = night;
    shared.uDusk.value = Math.max(dusk, dawn * 0.8);
    // sky colours
    const hz = shared.uSkyHorizon.value;
    const mi = shared.uSkyMid.value;
    const ze = shared.uSkyZenith.value;
    const morning = dawn > 0.001 && t > 0.7;
    const to = morning ? SKY.dawn : SKY.dusk;
    const sk = morning ? dawn : dusk;
    lerp3(hz, SKY.day.hz, to.hz, sk);
    lerp3(mi, SKY.day.mid, to.mid, sk);
    lerp3(ze, SKY.day.ze, to.ze, sk);
    // the drawn sun sinks through the sunset; it is up again when the day starts
    const sinking = smooth(0.36, 0.5, t) * (t < 0.7 ? 1 : 0) + (t >= 0.7 ? 1 - smooth(0.93, 1.0, t) : 0);
    const el = Math.asin(GOLDEN_SUN.y) * (1 - sinking) - 0.12 * sinking;
    const az = Math.atan2(GOLDEN_SUN.z, GOLDEN_SUN.x);
    shared.uSunDisc.value.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    // the moon rises in the east as the night falls
    const mt = smooth(0.42, 0.7, t) * (1 - smooth(0.88, 0.98, t));
    const mel = -0.1 + mt * 0.75;
    shared.uMoonDir.value.set(Math.cos(mel) * 0.62, Math.sin(mel), Math.cos(mel) * -0.78).normalize();
    // the page where you stand
    const p = game.anchorPos();
    const here = game.inBar ? 0 : styleAt(p.x, p.z);
    if (here !== this.styleHere) {
      this.styleHere = here;
      if (here && game.state === 'play' && game.time - this.announced > 4) {
        this.announced = game.time;
        game.hud.toast(`דף חדש: ${STYLE_LABEL[STYLES[here]]}`, 'info', 2.2);
      }
    }
    const P = styleParams(here);
    const k = 1 - Math.exp(-dt * 1.6);
    const target = this._c.setRGB(P[0][0], P[0][1], P[0][2]);
    if (here === 0) target.copy(DAY_PAPER);
    this.paper.lerp(target, k);
    const rules = P[4][3];
    const want = [rules === 1 ? 1 : 0, rules === 2 ? 1 : 0, rules === 1 ? 1 : here === 4 ? 0.5 : 0, rules === 3 ? 1 : 0];
    if (here === 4) want[0] = 0.45;
    this.page.x += (want[0] - this.page.x) * k;
    this.page.y += (want[1] - this.page.y) * k;
    this.page.z += (want[2] - this.page.z) * k;
    this.page.w += (want[3] - this.page.w) * k;
    shared.uPage.value.copy(this.page);
    this.pageDark += ((here === 4 ? 1 : 0) - this.pageDark) * k;
    // after dark each artist turns to their own night paper (blueprint blue by the banks...)
    this.nightPaper.lerp(this._c2.setRGB(P[5][0], P[5][1], P[5][2]), k);
    shared.uSkyPaper.value.copy(this.paper).lerp(this.nightPaper, night * (1 - this.pageDark));
    shared.uStars.value = Math.max(smooth(0.45, 1, night), this.pageDark * 0.85);
    // glow (bloom) for the night, and always on the black page
    this.bloom = Math.max(night * 0.95, this.pageDark * 0.75, Math.max(dusk, dawn) * 0.4);
    // headlights on the road in front of the car you drive
    const v = game.player && game.player.inVehicle;
    if (v && night > 0.15 && v.kind !== 'ufo') shared.uCarLight.value.set(v.pos.x, v.pos.z, v.yaw, 1);
    else shared.uCarLight.value.w = 0;
  }
}
