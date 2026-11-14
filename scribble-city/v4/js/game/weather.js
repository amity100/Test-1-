import * as THREE from 'three';
import { shared } from '../render/materials.js';
import { RainRenderer } from '../render/rain.js';

// The city's weather (ROADMAP 1.2): clear, cloudy, drizzle, rain, a storm with lightning and
// thunder, and fog in the morning. One turns into the next slowly: the clouds come first and the
// rain after them, the rain stops before the sky clears, the puddles fill while it rains and dry
// slowly after. The morning fog lifts as the sun climbs.
//
// The hour (game/daynight.js) gives the colours of the sky and the light; the weather changes
// them (apply, right after the hour's are set). Under a clear sky it changes nothing at all:
// the city looks exactly as the hour has it.

const KINDS = {
  clear: { over: 0, rain: 0, mist: 0, wind: 0.15, dur: [170, 300] },
  cloudy: { over: 0.62, rain: 0, mist: 0, wind: 0.32, dur: [70, 130] },
  drizzle: { over: 0.76, rain: 0.3, mist: 0.12, wind: 0.25, dur: [60, 110] },
  rain: { over: 0.88, rain: 0.7, mist: 0.18, wind: 0.38, dur: [70, 120] },
  storm: { over: 1, rain: 1, mist: 0.24, wind: 0.95, dur: [55, 90] },
  fog: { over: 0.3, rain: 0, mist: 1, wind: 0.05, dur: [70, 120] },
};
export const WEATHER_KINDS = Object.keys(KINDS);

// what may come next, and how likely (the morning fog only forms before nine)
const NEXT = {
  clear: [['cloudy', 3], ['fog', 2.4]],
  cloudy: [['drizzle', 2], ['clear', 1.6], ['rain', 0.9]],
  drizzle: [['rain', 1.5], ['cloudy', 1.2], ['clear', 0.4]],
  rain: [['storm', 0.8], ['drizzle', 1.2], ['cloudy', 1]],
  storm: [['rain', 1.6], ['drizzle', 0.5]],
  fog: [['clear', 1], ['cloudy', 0.5]],
};

const SAY = {
  clear: 'השמיים מתבהרים',
  cloudy: 'עננים מתקבצים מעל העיר',
  drizzle: 'מתחיל לטפטף',
  rain: 'יורד גשם',
  storm: 'סערה! ברקים ורעמים',
  fog: 'ערפל בוקר על העיר',
};

const STORE = 'scribble-city-v4-weather';
const RAD = Math.PI / 180;
const smooth = (x) => x * x * (3 - 2 * x);
const smoothstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

// a colour going grey (keeping how bright it is, times mul, tinted), k of the way
function greyTo(c, k, mul, tint) {
  if (k <= 0) return;
  const l = lum(c) * mul;
  c.r += (l * tint[0] - c.r) * k;
  c.g += (l * tint[1] - c.g) * k;
  c.b += (l * tint[2] - c.b) * k;
}
// (the sky's pens are in sRGB, in Vector3s)
function greyPen(v, k, mul, tint) {
  if (k <= 0) return;
  const l = (0.3 * v.x + 0.59 * v.y + 0.11 * v.z) * mul;
  v.x += (Math.min(1, l * tint[0]) - v.x) * k;
  v.y += (Math.min(1, l * tint[1]) - v.y) * k;
  v.z += (Math.min(1, l * tint[2]) - v.z) * k;
}
// towards a pale grey at least lo bright (the fog)
function paleTo(c, k, lo, tint) {
  if (k <= 0) return;
  const l = Math.max(lum(c) * 1.1, lo);
  c.r += (l * tint[0] - c.r) * k;
  c.g += (l * tint[1] - c.g) * k;
  c.b += (l * tint[2] - c.b) * k;
}
function palePen(v, k, lo, tint) {
  if (k <= 0) return;
  const l = Math.max(0.3 * v.x + 0.59 * v.y + 0.11 * v.z, lo);
  v.x += (Math.min(1, l * tint[0]) - v.x) * k;
  v.y += (Math.min(1, l * tint[1]) - v.y) * k;
  v.z += (Math.min(1, l * tint[2]) - v.z) * k;
}
const COOL = [0.93, 0.97, 1.08];
const STEEL = [0.88, 0.94, 1.12];
const MIST = [0.97, 0.98, 1.01];

export class Weather {
  constructor(game) {
    this.game = game;
    const params = game.params;
    this.kind = 'clear';
    // 'auto': the sky decides; or one weather kept (the pause menu)
    this.mode = 'auto';
    try {
      const m = localStorage.getItem(STORE);
      if (m && (m === 'auto' || KINDS[m])) this.mode = m;
    } catch (e) {
      // (no storage)
    }
    // (the tests: a clear sky that stays, unless one is asked for)
    if (params.has('test')) this.mode = 'clear';
    const want = params.get('weather');
    if (want && KINDS[want]) this.mode = want;
    if (this.mode !== 'auto') this.kind = this.mode;
    this.left = KINDS[this.kind].dur[0];
    this.cur = { over: 0, rain: 0, mist: 0, wind: 0.15 };
    this.wet = 0;
    this.windAng = 0.6;
    this.windTo = 0.6;
    this.windDir = new THREE.Vector2(Math.cos(this.windAng), Math.sin(this.windAng));
    this.gust = 0;
    this.windK = 0;
    // the morning fog: how much of it is left as the sun climbs
    this.burn = 1;
    // lightning: the flash on everything, the bolt being drawn, the thunder on its way
    this.flash = 0;
    this.bolt = null;
    this.boltT = 5;
    this.thunder = [];
    this.indoors = false;
    this.indoorT = 0;
    this.rain = new RainRenderer(game);
    this.snap();
  }

  get sky() {
    return KINDS[this.kind];
  }

  // the pause menu: let the sky decide, or keep one weather (it comes at once)
  setMode(mode) {
    if (mode !== 'auto' && !KINDS[mode]) return;
    this.mode = mode;
    try {
      localStorage.setItem(STORE, mode);
    } catch (e) {
      // (no storage: the choice lasts as long as the page)
    }
    if (mode !== 'auto') {
      this.go(mode, true);
      this.snap();
    } else this.left = Math.min(this.left, 40);
  }

  // straight to the weather it is going to (the menu, a test asking for one)
  snap() {
    const K = KINDS[this.kind];
    this.burn = this.fogLeft(this.game.daynight ? this.game.daynight.hour : 12);
    Object.assign(this.cur, { over: K.over, rain: K.rain, mist: K.mist * this.burn, wind: K.wind });
    this.wet = K.rain > 0 ? 1 : 0;
    this.windAng = this.windTo;
  }

  go(kind, quiet = false) {
    if (this.kind === kind) return;
    this.kind = kind;
    const d = KINDS[kind].dur;
    this.left = d[0] + Math.random() * (d[1] - d[0]);
    // a new wind for the new weather
    if (kind !== 'fog') this.windTo = this.windAng + (Math.random() - 0.5) * 2.4;
    const game = this.game;
    if (!quiet && game.state === 'play' && game.hud) game.hud.toast(SAY[kind], 'info', 2.4);
  }

  pickNext() {
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const morning = h >= 3.5 && h < 8.5;
    const opts = NEXT[this.kind].filter((o) => o[0] !== 'fog' || morning);
    let sum = 0;
    for (const o of opts) sum += o[1];
    let r = Math.random() * sum;
    for (const o of opts) {
      r -= o[1];
      if (r <= 0) return o[0];
    }
    return opts[0][0];
  }

  update(dt) {
    const game = this.game;
    const h = game.daynight ? game.daynight.hour : 12;
    // the sky changes its mind now and then (the fog does not outlast the morning)
    if (this.mode === 'auto' && dt > 0) {
      this.left -= dt;
      if (this.left <= 0 || (this.kind === 'fog' && h > 10.4 && h < 20)) this.go(this.pickNext());
    }
    this.burn = this.fogLeft(h);
    const K = KINDS[this.kind];
    const c = this.cur;
    if (dt > 0) {
      // the clouds come before the rain and go after it
      const toward = (v, t, tau) => {
        const n = v + (t - v) * (1 - Math.exp(-dt / tau));
        return Math.abs(n - t) < 1e-4 ? t : n;
      };
      c.over = toward(c.over, K.over, 14);
      const rainT = c.over >= K.over * 0.8 ? K.rain : 0;
      c.rain = toward(c.rain, rainT, rainT > c.rain ? 7 : 4);
      c.mist = toward(c.mist, K.mist * this.burn, 12);
      c.wind = toward(c.wind, K.wind, 8);
      // the puddles fill while it rains, and dry slowly
      if (c.rain > 0.15) this.wet = Math.min(1, this.wet + (dt * c.rain) / 25);
      else this.wet = Math.max(0, this.wet - dt / 140);
      // gusts, and the wind turning round to its new way
      const t = game.time;
      const g = (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 1.13 + 1) * 0.3 + Math.sin(t * 2.9) * 0.2) * 0.3;
      this.gust += (g - this.gust) * Math.min(1, dt * 2);
      let da = this.windTo - this.windAng;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.windAng += da * Math.min(1, dt * 0.06);
      this.windDir.set(Math.cos(this.windAng), Math.sin(this.windAng));
      // lightning in a storm, now and then
      if (this.kind === 'storm' && c.rain > 0.6) {
        this.boltT -= dt;
        if (this.boltT <= 0) {
          this.strike();
          this.boltT = 5 + Math.random() * 9;
        }
      }
      this.updateBolt(dt);
      // the thunder of each bolt, as late as it is far
      for (let i = this.thunder.length - 1; i >= 0; i--) {
        const th = this.thunder[i];
        th.t -= dt;
        if (th.t <= 0) {
          game.audio.thunder(th.vol * (this.indoors ? 0.6 : 1));
          this.thunder.splice(i, 1);
        }
      }
      // under a roof (in a shop): no rain falls in the room, and it sounds far away
      this.indoorT -= dt;
      if (this.indoorT <= 0) {
        this.indoorT = 0.25;
        this.indoors = this.cameraIndoors();
      }
      game.audio.weather(c.rain * (this.indoors ? 0.35 : 1), this.windNow * (this.indoors ? 0.3 : 1));
    }
    // (a strong wind: what it does to the palms and the rain)
    this.windK = smoothstep(0.42, 1.0, this.windNow);
    this.rain.update(c.rain, this.indoors);
  }

  // how much of the morning fog is left at hour h: it thins out between nine and half past ten
  // (a fog kept from the menu stays; the haze of the rain is not the morning's)
  fogLeft(h) {
    if (this.kind !== 'fog' || this.mode === 'fog') return 1;
    return 1 - smoothstep(9, 10.5, h) * (h < 20 ? 1 : 0);
  }

  get windNow() {
    const w = this.cur.wind;
    return Math.max(0, Math.min(1.2, w + this.gust * w));
  }

  // is the camera inside one of the rooms behind the shop fronts?
  cameraIndoors() {
    const game = this.game;
    const shops = game.world.shops;
    if (!shops) return false;
    const p = game.camera.position;
    for (let i = 0; i < shops.length; i++) {
      const R = shops[i].room;
      if (!R || p.y < R.floor - 0.5 || p.y > R.floor + R.height + 0.3) continue;
      if (Math.abs(R.center.x - p.x) > 14 || Math.abs(R.center.z - p.z) > 14) continue;
      if (R.inside(p.x, p.z, 0.1)) return true;
    }
    return false;
  }

  // a bolt of lightning somewhere ahead, far off; its thunder after it
  strike() {
    const game = this.game;
    const cam = game.camera;
    const f = cam.getWorldDirection(this._f || (this._f = new THREE.Vector3()));
    const az = Math.atan2(f.z, f.x) + (Math.random() - 0.5) * 1.1;
    const d = 140 + Math.random() * 160;
    let px = cam.position.x + Math.cos(az) * d;
    let pz = cam.position.z + Math.sin(az) * d;
    let y = 170 + Math.random() * 40;
    // (one bolt in four stays in the clouds: a flash with no stroke)
    const sheet = Math.random() < 0.25;
    const segs = [];
    if (!sheet) {
      const branch = (x0, y0, z0, n) => {
        let bx = x0;
        let by = y0;
        let bz = z0;
        for (let i = 0; i < n && by > 0; i++) {
          const nx = bx + (Math.random() - 0.5) * 16;
          const nz = bz + (Math.random() - 0.5) * 16;
          const ny = by - 8 - Math.random() * 10;
          segs.push([bx, by, bz, nx, Math.max(0, ny), nz, 1]);
          bx = nx;
          by = ny;
          bz = nz;
        }
      };
      while (y > 0) {
        const nx = px + (Math.random() - 0.5) * 18;
        const nz = pz + (Math.random() - 0.5) * 18;
        const ny = y - 9 - Math.random() * 12;
        segs.push([px, y, pz, nx, Math.max(0, ny), nz, 2.2]);
        if (Math.random() < 0.3 && y > 50) branch(nx, ny, nz, 2 + Math.floor(Math.random() * 4));
        px = nx;
        pz = nz;
        y = ny;
      }
    }
    this.bolt = { segs, t: 0, vis: true, seed: Math.random() * 100 };
    this.flash = sheet ? 0.6 : 1;
    this.thunder.push({ t: d / 340 + 0.2, vol: Math.max(0.35, 1 - (d - 140) / 220) });
  }

  updateBolt(dt) {
    let fl = 0;
    const b = this.bolt;
    if (b) {
      b.t += dt;
      // it flickers on and off a couple of times
      b.vis = b.t < 0.09 || (b.t > 0.15 && b.t < 0.24) || (b.t > 0.31 && b.t < 0.4);
      if (b.vis) fl = b.segs.length ? 1 : 0.7;
      if (b.t > 0.45) this.bolt = null;
    }
    this.flash = Math.max(fl * 0.9, this.flash * Math.exp(-dt * 7));
    if (this.flash < 1e-3) this.flash = 0;
  }

  // the bolt, in gel pen: a wide pale glow and a white-hot line (game/figure.js lines)
  draw(fr) {
    const b = this.bolt;
    if (!b || !b.vis || !b.segs.length) return;
    for (let i = 0; i < b.segs.length; i++) {
      const s = b.segs[i];
      // (far off in the rain's haze: bright enough to shine through it)
      fr.lineXYZ(s[0], s[1], s[2], s[3], s[4], s[5], [9, 11, 18], s[6] * 7, b.seed + i, 0.35, 0.01, 0.4);
      fr.lineXYZ(s[0], s[1], s[2], s[3], s[4], s[5], [36, 36, 32], s[6] * 2.4, b.seed + i + 0.5, 1, 0.01, 0.4);
    }
  }

  // how bright the street lamps are at this hour (lamp) in this weather: a dark grey day turns
  // them on, and so does the morning fog
  lamps(dn, lamp) {
    const c = this.cur;
    if (c.over === 0 && c.mist === 0) return lamp;
    const day = smoothstep(-6 * RAD, 12 * RAD, dn.sunEl || 0);
    return Math.max(lamp, (0.5 * c.over + 0.4 * c.rain) * (0.4 + 0.6 * day) + 0.45 * c.mist * day);
  }

  // The weather's change to the hour's colours (called by game/daynight.js right after it has
  // set them, every frame): the sky goes grey, the sun goes behind the clouds, the fog comes in
  apply(dn) {
    const c = this.cur;
    const o = c.over;
    const r = c.rain;
    const m = c.mist;
    const f = this.flash;
    shared.uOvercast.value = o;
    shared.uRain.value = r;
    shared.uWet.value = this.wet;
    shared.uMist.value = m;
    shared.uFlash.value = f;
    shared.uWind.value.set(this.windDir.x, this.windDir.y, this.windK);
    if (o === 0 && m === 0 && f === 0 && r === 0) return;
    const day = smoothstep(-6 * RAD, 12 * RAD, dn.sunEl || 0);
    // the sky: grey, darker the harder it rains (rain clouds are dark); in the fog a pale page
    const grey = 0.8 * o;
    const dark = 1 - 0.3 * r - 0.1 * o;
    greyTo(shared.uSkyTop.value, grey, dark * 0.9, STEEL);
    greyTo(shared.uSkyMid.value, grey, dark, COOL);
    greyTo(shared.uSkyHorizon.value, grey, dark * 1.05, COOL);
    greyTo(shared.uSkySun.value, Math.min(1, grey * 1.1), dark, COOL);
    greyTo(shared.uBounce.value, grey * 0.8, 1 - 0.12 * r, COOL);
    greyTo(shared.uPaper.value, 0.3 * o, 1 - 0.06 * r, COOL);
    const fog = 0.85 * m;
    const lo = 0.12 + 0.55 * day;
    paleTo(shared.uSkyTop.value, fog, lo * 0.9, MIST);
    paleTo(shared.uSkyMid.value, fog, lo, MIST);
    paleTo(shared.uSkyHorizon.value, fog, lo, MIST);
    paleTo(shared.uSkySun.value, fog, lo, MIST);
    paleTo(shared.uBounce.value, fog * 0.6, lo * 0.8, MIST);
    // the pens of the sky and the clouds
    const pens = shared.uSkyPen.value;
    for (let i = 0; i < 12; i++) {
      const band = i < 4 ? 1 : i < 8 ? 0.9 : 0.8;
      greyPen(pens[i], 0.85 * o, dark * band, i < 8 ? COOL : STEEL);
      palePen(pens[i], fog, lo * band * 1.1, MIST);
    }
    greyPen(shared.uCloudC.value[0], 0.9 * o, dark * 0.72, STEEL);
    greyPen(shared.uCloudC.value[1], 0.8 * o, dark * 1.05, COOL);
    palePen(shared.uCloudC.value[0], fog, lo * 0.9, MIST);
    palePen(shared.uCloudC.value[1], fog, lo * 1.05, MIST);
    // the sun behind the clouds (in the fog a pale disc), the moon and the stars too
    shared.uSunCol.value.multiplyScalar((1 - 0.84 * o) * (1 - 0.5 * m));
    shared.uSunDiscK.value *= 1 - smoothstep(0.4, 0.85, o);
    shared.uMoonK.value *= (1 - smoothstep(0.3, 0.75, o)) * (1 - 0.6 * m);
    shared.uStars.value *= (1 - smoothstep(0.15, 0.55, o)) * (1 - m);
    // the haze: thick in the fog, a little in the rain
    shared.uFogDensity.value += m * 0.017 + r * 0.0018 + o * 0.0002;
    // grey weather: more windows are lit (and the lamps come on: lamps)
    shared.uLitK.value += 0.35 * o * day;
    const game = this.game;
    if (game.pipe) {
      // the wet air glows round the lights; a flash lights the whole page
      game.pipe.bloom *= 1 + 0.35 * r;
      game.pipe.exposure *= 1 + 0.1 * f;
    }
  }
}
