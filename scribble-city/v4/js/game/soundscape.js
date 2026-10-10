import { WATER_X, PIER, SOUTH_EDGE } from '../world/layout.js';
import { Band, makeSong } from '../core/music.js';

// The sounds of the city (ROADMAP 1.4), made on the spot like every other sound of the game (no
// sound files). Layers that come and go with where you are: the waves along the bay, gulls over
// the water by day, birds in the park by day and crickets at night, the hum of the traffic
// (louder as a car goes by), the murmur of the people around you, music out of an open shop's
// door. Now and then something far off: a siren, a dog, a horn. Your own steps sound like what
// you walk on: the sidewalk, the pier's boards, the park's grass, the beach's sand, a shop's
// floor (and splash in the rain). Every sound comes from its side; under a roof the street is
// muffled.

// (a die of its own: the tests replay the city roll for roll, and its sounds must take none)
let seed = 7331;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// the shops that play music out of their door, and how it goes (core/music.js); the club plays
// its own, loud, out into the street
const SHOP_STYLE = {
  cafe: 'jazz', books: 'jazz', diner: 'jazz', icecream: 'lofi', juice: 'lofi', surf: 'lofi', boutique: 'synth', arcade: 'synth', gym: 'disco',
  music: 'rock', bar: 'rock', pizza: 'rock', tacos: 'rock',
};
const CLUB = 'INK CLUB';
// how loud each layer is at its fullest
const FULL = { waves: 0.12, foam: 0.05, traffic: 0.1, hiss: 0.035, crowd: 0.045, crowd2: 0.02 };
// how often the slow part looks around (seconds)
const LOOK = 0.15;
// the beach's water's edge (the open sea south of the city)
const SEA_Z = SOUTH_EDGE + 40;

export class Soundscape {
  constructor(game) {
    this.game = game;
    this.ready = false;
    this.t = 0;
    this.lv = { waves: 0, birds: 0, crickets: 0, gulls: 0, traffic: 0, crowd: 0 };
    this.wavePh = 0;
    this.wait = { bird: 1, cricket: 1, gull: 3, siren: 25, dog: 12, horn: 9 };
    this.stepK = null;
    this.shop = null;
    this.band = null;
    this.rx = 1;
    this.rz = 0;
  }

  // (the sounds can only start after a tap or a key, the browser's rule: built on first use)
  build() {
    const a = this.game.audio;
    const c = a.ctx;
    this.a = a;
    this.c = c;
    // the street: all of it through one filter that muffles it under a roof
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    this.muffle = c.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 16000;
    this.bus.connect(this.muffle).connect(a.master);
    const loop = (type, freq, q) => {
      const s = c.createBufferSource();
      s.buffer = a.noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0;
      const p = c.createStereoPanner();
      s.connect(f).connect(g).connect(p).connect(this.bus);
      s.start(0, rnd() * 0.9);
      return { g, p, f };
    };
    this.layers = {
      waves: loop('lowpass', 380, 0.4),
      foam: loop('bandpass', 2300, 0.6),
      traffic: loop('lowpass', 240, 0.7),
      hiss: loop('bandpass', 1100, 0.5),
      crowd: loop('bandpass', 620, 1.1),
      crowd2: loop('bandpass', 1350, 2.2),
    };
    // a shop's music (not through the street's filter: you may be in the shop) and your steps
    this.shopOut = c.createGain();
    this.shopOut.gain.value = 0;
    this.shopFilter = c.createBiquadFilter();
    this.shopFilter.type = 'lowpass';
    this.shopFilter.frequency.value = 1400;
    this.shopPan = c.createStereoPanner();
    this.shopFilter.connect(this.shopOut).connect(this.shopPan).connect(a.master);
    this.near = c.createGain();
    this.near.gain.value = 1;
    this.near.connect(a.master);
    this.ready = true;
  }

  update(dt) {
    const a = this.game.audio;
    if (!a.ctx) return;
    if (!this.ready) this.build();
    this.steps();
    // (the slow part looks around a few times a second, paused or not)
    this.t -= Math.max(dt, 1 / 60);
    if (this.t > 0) return;
    this.t = LOOK;
    this.look();
  }

  // the direction of (x, z) from you, -1 left .. 1 right
  panTo(x, z) {
    const cam = this.game.camera.position;
    const dx = x - cam.x;
    const dz = z - cam.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) return 0;
    return Math.max(-1, Math.min(1, ((dx * this.rx + dz * this.rz) / d) * 0.85));
  }

  set(layer, v, pan, tau = 0.6) {
    const L = this.layers[layer];
    const t = this.c.currentTime;
    L.g.gain.setTargetAtTime(v * FULL[layer], t, tau);
    if (pan !== undefined) L.p.pan.setTargetAtTime(pan, t, 0.4);
  }

  look() {
    const game = this.game;
    const c = this.c;
    const now = c.currentTime;
    const cam = game.camera.position;
    const f = game.camera.getWorldDirection(this._f || (this._f = cam.clone()));
    const fl = Math.hypot(f.x, f.z) || 1;
    this.rx = -f.z / fl;
    this.rz = f.x / fl;
    const w = game.weather;
    const rain = w ? w.cur.rain : 0;
    const indoors = w ? w.indoors : false;
    const dn = game.daynight;
    const el = dn ? dn.sunEl || 0 : 0.1;
    const day = smoothstep(-0.07, 0.1, el);
    // the whole street: quieter in the menu, muffled under a roof
    const playing = game.state === 'play';
    this.bus.gain.setTargetAtTime(playing ? 1 : game.state === 'title' ? 0.6 : 0.3, now, 0.5);
    this.muffle.frequency.setTargetAtTime(indoors ? 650 : 16000, now, 0.25);
    // ---- the bay: waves breaking along the sea wall (from the east), the open sea past the beach
    const toBay = Math.max(0, WATER_X - cam.x);
    const toSea = Math.max(0, SEA_Z - cam.z);
    const dWater = Math.min(toBay, toSea);
    const water = 1 - smoothstep(3, 75, dWater);
    const waterPan = cam.x > WATER_X ? 0 : toBay <= toSea ? this.panTo(cam.x + 30, cam.z) : this.panTo(cam.x, cam.z + 30);
    this.wavePh += LOOK / 7.5;
    const swell = Math.pow(Math.sin(Math.PI * (this.wavePh % 1)), 2);
    this.set('waves', water * (0.35 + 0.65 * swell), waterPan, 0.5);
    this.set('foam', water * Math.pow(swell, 4), waterPan, 0.3);
    // ---- the park: birds by day, crickets at night (not in the rain)
    let dPark = Infinity;
    let pk = null;
    for (const p of game.world.parks || []) {
      const dx = Math.max(p.x0 - cam.x, 0, cam.x - p.x1);
      const dz = Math.max(p.z0 - cam.z, 0, cam.z - p.z1);
      const d = Math.hypot(dx, dz);
      if (d < dPark) {
        dPark = d;
        pk = p;
      }
    }
    const park = 1 - smoothstep(0, 45, dPark);
    const dry = 1 - Math.min(1, rain * 1.2);
    // (the palms of the promenade have their birds too)
    this.lv.birds = Math.max(park, 0.3 * water) * day * dry;
    this.lv.crickets = park * (1 - day) * dry;
    this.lv.gulls = water * day * (1 - 0.7 * rain);
    const parkPan = pk ? this.panTo(pk.cx, pk.cz) : 0;
    // ---- the traffic: a hum, louder as cars go by (from where they are), tyres on the road
    let tr = 0;
    let tx = 0;
    let tz = 0;
    for (const car of game.traffic.list) {
      if (car.wrecked) continue;
      const dx = car.pos.x - cam.x;
      const dz = car.pos.z - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 90 * 90) continue;
      const k = (0.15 + 0.85 * Math.min(1, Math.abs(car.speed) / 10)) / (1 + d2 / 81);
      tr += k;
      tx += dx * k;
      tz += dz * k;
    }
    const traffic = Math.min(1, tr * 1.3);
    const trafficPan = tr > 0 ? this.panTo(cam.x + tx / tr, cam.z + tz / tr) : 0;
    this.set('traffic', traffic, trafficPan, 0.35);
    this.set('hiss', traffic * (0.4 + 0.6 * Math.min(1, rain * 2)), trafficPan, 0.35);
    // ---- people: their murmur, from where they are (fewer words in the rain)
    let pp = 0;
    let px = 0;
    let pz = 0;
    for (const p of game.civilians.list) {
      if (p.inside || !p.alive) continue;
      const dx = p.pos.x - cam.x;
      const dz = p.pos.z - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 30 * 30) continue;
      const k = 1 / (1 + d2 / 49);
      pp += k;
      px += dx * k;
      pz += dz * k;
    }
    const crowd = Math.min(1, pp / 3) * (1 - 0.5 * rain);
    const crowdPan = pp > 0 ? this.panTo(cam.x + px / pp, cam.z + pz / pp) : 0;
    const wob = 0.75 + 0.25 * Math.sin(now * 0.9) * Math.sin(now * 0.37 + 1);
    this.set('crowd', crowd * wob, crowdPan, 0.5);
    this.set('crowd2', crowd * (1.2 - wob), crowdPan, 0.4);
    // ---- now and then: a bird's song, a cricket, a gull, something far off
    const W = this.wait;
    for (const k in W) W[k] -= LOOK;
    if (this.lv.birds > 0.05 && W.bird <= 0) {
      W.bird = (0.5 + rnd() * 2) / (0.3 + this.lv.birds);
      this.chirp(this.lv.birds, Math.max(-1, Math.min(1, parkPan + (rnd() - 0.5) * 0.8)));
    }
    if (this.lv.crickets > 0.05 && W.cricket <= 0) {
      W.cricket = 0.6 + rnd() * 1.4;
      this.cricket(this.lv.crickets, Math.max(-1, Math.min(1, parkPan + (rnd() - 0.5) * 0.9)));
    }
    if (this.lv.gulls > 0.1 && W.gull <= 0) {
      W.gull = 5 + rnd() * 10;
      this.gull(this.lv.gulls, waterPan);
    }
    if (W.siren <= 0) {
      // (more of them at night)
      W.siren = (30 + rnd() * 50) * (0.55 + 0.45 * day);
      if (!game.police || !game.police.hostile) this.farSiren(rnd() * 2 - 1);
    }
    if (W.dog <= 0) {
      W.dog = 15 + rnd() * 30;
      this.bark(0.25 + 0.3 * rnd(), rnd() * 2 - 1);
    }
    if (traffic > 0.25 && W.horn <= 0) {
      W.horn = 8 + rnd() * 18;
      this.horn(traffic, trafficPan);
    }
    this.shopMusic(cam, now);
  }

  // ------------------------------------------------------------------ music out of a shop
  shopMusic(cam, now) {
    const game = this.game;
    let best = null;
    let bd = 34;
    const R = game.rhythm;
    for (const s of game.streetlife.active.values()) {
      const kind = s.shop.kind;
      if (SHOP_STYLE[kind] === undefined || !s.open || (R && !R.open(kind))) continue;
      const club = s.shop.name === CLUB;
      // (the club is heard from across the street; a shop from its door)
      const d = Math.hypot(s.shop.door[0] - cam.x, s.shop.door[2] - cam.z) * (club ? 0.5 : 1);
      if (d < bd && d < 17) {
        bd = d;
        best = s;
      }
    }
    const inRoom = best && best.room && best.room.inside(cam.x, cam.z, 0.2);
    const club = best && best.shop.name === CLUB;
    const vol = best ? (inRoom ? 0.32 : (club ? 0.34 : 0.22) * (1 - smoothstep(4, 17, bd))) : 0;
    this.shopOut.gain.setTargetAtTime(vol, now, 0.6);
    this.shopFilter.frequency.setTargetAtTime(inRoom ? 4000 : club ? 900 : 1300, now, 0.3);
    if (best) this.shopPan.pan.setTargetAtTime(inRoom ? 0 : this.panTo(best.shop.door[0], best.shop.door[2]), now, 0.3);
    if (!this.band) this.band = new Band(this.c, this.shopFilter, this.a.noise);
    if (best && best !== this.shop) {
      // (each shop its own song, the same one every time you come by)
      this.shop = best;
      this.band.play(makeSong(club ? 'disco' : SHOP_STYLE[best.shop.kind], 500 + best.shop.id), now + 0.05);
    }
    if (!best && this.shop && this.shopOut.gain.value < 0.002) {
      // (it went on a moment as it faded, then stopped)
      this.shop = null;
      this.band.stop();
    }
    this.band.update(now);
  }

  // ------------------------------------------------------------------ now and then
  blip(type, f0, f1, dur, vol, pan, at = 0, out = this.bus) {
    const c = this.c;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  rustle(dur, vol, freq, q, type, pan, at = 0, out = this.bus) {
    const c = this.c;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.a.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.01, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    s.connect(f).connect(g).connect(p).connect(out);
    s.start(t, rnd() * 0.9);
    s.stop(t + dur + 0.05);
  }

  // a little bird: two to five quick notes, up and down
  chirp(k, pan) {
    const n = 2 + Math.floor(rnd() * 4);
    const base = 2600 + rnd() * 2200;
    const v = 0.018 * (0.4 + 0.6 * k);
    for (let i = 0; i < n; i++) {
      const f = base * (1 + (rnd() - 0.5) * 0.25);
      this.blip('sine', f, f * (rnd() < 0.5 ? 1.35 : 0.75), 0.06 + rnd() * 0.05, v, pan, i * (0.09 + rnd() * 0.06));
    }
  }

  // a cricket: three short trills
  cricket(k, pan) {
    const f = 4300 + rnd() * 500;
    for (let i = 0; i < 3; i++) this.blip('sine', f, f * 0.98, 0.035, 0.008 * (0.4 + 0.6 * k), pan, i * 0.065);
  }

  // a gull over the water: kee-ow, kee-ow
  gull(k, pan) {
    const f = 1300 + rnd() * 400;
    for (let i = 0; i < 2; i++) this.blip('triangle', f, f * 0.62, 0.32, 0.016 * k, pan, i * 0.42);
  }

  // a siren far away, somewhere in the city: wailing, faint, behind the buildings
  farSiren(pan) {
    const c = this.c;
    const t = c.currentTime;
    const dur = 5 + rnd() * 4;
    const o = c.createOscillator();
    o.type = 'triangle';
    const sw = 0.5 + rnd() * 0.3;
    for (let k = 0; k <= Math.ceil(dur / sw); k++) o.frequency.setValueAtTime(k % 2 ? 940 : 600, t + k * sw);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.012, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    o.connect(f).connect(g).connect(p).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  bark(v, pan) {
    this.blip('sawtooth', 520, 260, 0.09, 0.03 * v, pan);
    this.rustle(0.08, 0.04 * v, 900, 1.5, 'bandpass', pan);
    this.blip('sawtooth', 500, 240, 0.08, 0.025 * v, pan, 0.17);
  }

  horn(k, pan) {
    const v = 0.03 * (0.4 + 0.6 * k);
    const len = rnd() < 0.5 ? 0.16 : 0.42;
    this.blip('square', 420, 410, len, v, pan);
    this.blip('square', 520, 510, len, v * 0.7, pan);
  }

  // ------------------------------------------------------------------ your steps
  // (each time a foot comes down: twice a stride of the walk)
  steps() {
    const p = this.game.player;
    const fig = p.fig;
    if (p.mode !== 'foot' || p.inVehicle || !p.onGround || !fig || fig.speed < 0.7 || this.game.state !== 'play') {
      this.stepK = null;
      return;
    }
    const k = Math.floor(fig.phase / Math.PI);
    if (this.stepK === null || k === this.stepK) {
      this.stepK = k;
      return;
    }
    this.stepK = k;
    this.footstep(this.surface(p.pos.x, p.pos.z), fig.speed, k & 1 ? 0.12 : -0.12);
  }

  surface(x, z) {
    const w = this.game.weather;
    if (w && w.indoors) return 'floor';
    if (x > WATER_X - 0.3 && z > PIER.z0 && z < PIER.z1) return 'deck';
    if (z > SOUTH_EDGE + 4) return 'sand';
    for (const pk of this.game.world.parks || []) if (x > pk.x0 && x < pk.x1 && z > pk.z0 && z < pk.z1) return 'grass';
    return 'hard';
  }

  footstep(surf, speed, pan) {
    const v = 0.05 + 0.04 * Math.min(1, speed / 6);
    const out = this.near;
    if (surf === 'deck') {
      // the pier's boards: a hollow knock
      this.blip('triangle', 190, 130, 0.09, v * 0.9, pan, 0, out);
      this.rustle(0.04, v * 0.5, 800, 1, 'bandpass', pan, 0, out);
    } else if (surf === 'grass') {
      this.rustle(0.13, v * 0.55, 3100, 0.7, 'bandpass', pan, 0, out);
    } else if (surf === 'sand') {
      this.rustle(0.11, v * 0.8, 900, 0.8, 'lowpass', pan, 0, out);
      this.rustle(0.05, v * 0.25, 4200, 1, 'highpass', pan, 0.02, out);
    } else {
      // the sidewalk (a shop's floor is brighter)
      this.rustle(0.035, v * 0.8, surf === 'floor' ? 3300 : 2500, 1.2, 'bandpass', pan, 0, out);
      this.blip('sine', 120, 70, 0.05, v * 0.55, pan, 0, out);
      const w = this.game.weather;
      // (and in the puddles)
      if (surf === 'hard' && w && w.wet > 0.3) this.rustle(0.08, v * 0.7 * w.wet, 1500, 0.8, 'bandpass', pan, 0.01, out);
    }
  }
}
