import * as THREE from 'three';
import { groundHeight, CURB } from '../world/layout.js';

// The animals of the city besides the pigeons and the gulls (game/ambient.js) (ROADMAP 3.7):
//   cats in the alleys   sitting on the dumpsters' lids or by the walls, washing, the tail going;
//                        some walking along the alley. Come close (or run, or shoot) and they
//                        are off down the alley and gone; now and then a meow. At night their
//                        eyes shine.
//   birds in the park    little brown ones hopping and pecking on the lawns, chirping; they fly
//                        off over the palms when you come near (or a shot goes off).
// Only round you. (?classic: neither)

// (each with its muzzle and whiskers: pale on the dark ones)
const CAT_COLORS = [
  { body: [0.92, 0.56, 0.24], dark: [0.72, 0.38, 0.14], muzzle: [0.98, 0.88, 0.74], whisk: [0.98, 0.96, 0.92] },
  { body: [0.13, 0.12, 0.14], dark: [0.07, 0.07, 0.08], muzzle: null, whisk: [0.85, 0.85, 0.85] },
  { body: [0.58, 0.58, 0.62], dark: [0.4, 0.4, 0.45], muzzle: [0.88, 0.88, 0.9], whisk: [0.97, 0.97, 0.97] },
  { body: [0.95, 0.94, 0.91], dark: [0.82, 0.8, 0.76], muzzle: null, whisk: [0.35, 0.33, 0.32] },
  { body: [0.85, 0.75, 0.6], dark: [0.45, 0.32, 0.22], muzzle: [0.97, 0.93, 0.86], whisk: [0.3, 0.25, 0.2] },
];
const CAT_EYE = [0.72, 0.8, 0.28];
const PUPIL = [0.04, 0.04, 0.04];
const NOSE = [0.9, 0.52, 0.56];
const BIRD = [0.55, 0.42, 0.3];
const BIRD_DARK = [0.36, 0.27, 0.2];
const BIRD_BELLY = [0.86, 0.8, 0.7];
const BEAK = [0.28, 0.24, 0.18];
const EYES = [0.85, 1, 0.45];
const _wh = [0, 0, 0];
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _w = new THREE.Vector3();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Animals {
  constructor(game) {
    this.game = game;
    this.cats = [];
    this.flocks = [];
    this.spots = null;
    this.t = 0;
    this.meowT = 6;
    // (counted for the tests)
    this.stats = { cats: 0, fled: 0, flocks: 0, flew: 0 };
  }

  // where cats like to be: the dumpsters' lids, and the foot of the alleys' walls
  setup() {
    const w = this.game.world;
    this.spots = [];
    for (const a of w.alleys || []) {
      w.collision.forEachIn(a.x0, a.z0, a.x1, a.z1, (b) => {
        // (a dumpster: 1.6 by 2.0, its lid at 1.48)
        if (Math.abs(b.x1 - b.x0 - 1.6) < 0.05 && Math.abs(b.z1 - b.z0 - 2.0) < 0.05 && Math.abs(b.y1 - (CURB + 1.33)) < 0.05) {
          this.spots.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, y: b.y1, alley: a, top: true, box: b });
        }
        return false;
      });
      for (let z = a.z0 + 8; z < a.z1 - 8; z += 14) {
        for (const x of [a.x0 + 0.5, a.x1 - 0.5]) this.spots.push({ x, z, y: null, alley: a, top: false });
      }
    }
  }

  // (somewhere you would see it appear: near, and in front of the camera)
  seen(x, z, near) {
    const cam = this.game.camera.position;
    const dx = x - cam.x;
    const dz = z - cam.z;
    const d = Math.hypot(dx, dz);
    if (d > near) return false;
    const f = this.game.camera.getWorldDirection(_v);
    return (dx * f.x + dz * f.z) / (d || 1) > 0.45;
  }

  // how dark it is, 0 (day) .. 1 (night)
  get night() {
    const d = this.game.daynight;
    return d ? d.night : 0;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    if (!this.spots) this.setup();
    const p = game.anchorPos();
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1.5;
      this.cats = this.cats.filter((c) => !c.gone && Math.hypot(c.x - p.x, c.z - p.z) < 90);
      if (this.cats.length < (game.touch ? 2 : 4)) this.newCat(p);
      this.flocks = this.flocks.filter((f) => !(f.up && f.upT > 5) && Math.hypot(f.x - p.x, f.z - p.z) < 80);
      if (this.flocks.length < (game.touch ? 1 : 3)) this.newFlock(p);
    }
    for (const c of this.cats) this.cat(c, dt);
    for (const f of this.flocks) this.birds(f, dt);
    // now and then one of them says something
    this.meowT -= dt;
    if (this.meowT <= 0) {
      this.meowT = 9 + Math.random() * 16;
      let best = null;
      let bd = 22;
      for (const c of this.cats) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < bd && c.state !== 'flee') {
          bd = d;
          best = c;
        }
      }
      if (best) game.audio.play('meow', 0.5 * (1 - bd / 22));
    }
  }

  // a shot, a bang, people running: the cats and the birds round there are off
  scare(pos, radius) {
    const r = Math.min(radius, 30);
    for (const c of this.cats) {
      if (c.state !== 'flee' && Math.hypot(c.x - pos.x, c.z - pos.z) < r) this.flee(c, pos);
    }
    for (const f of this.flocks) {
      if (!f.up && Math.hypot(f.x - pos.x, f.z - pos.z) < r) this.flyUp(f, pos, Math.hypot(f.x - this.game.player.pos.x, f.z - this.game.player.pos.z));
    }
  }

  // ------------------------------------------------------------------ cats
  newCat(p) {
    const near = this.spots.filter((s) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      return d > 14 && d < 60 && (!s.box || s.box.alive) && !this.seen(s.x, s.z, 30) && !this.cats.some((c) => c.spot === s);
    });
    if (!near.length) return;
    // (on a dumpster's lid as often as not)
    const tops = near.filter((s) => s.top);
    const pool = tops.length && Math.random() < 0.5 ? tops : near;
    const s = pool[Math.floor(Math.random() * pool.length)];
    const a = s.alley;
    const walking = !s.top && Math.random() < 0.35;
    const x = s.top ? s.x + (Math.random() - 0.5) * 0.8 : s.x;
    const z = s.z + (s.top ? (Math.random() - 0.5) * 1.2 : 0);
    const cat = {
      spot: s,
      x,
      z,
      y: s.top ? s.y : groundHeight(x, z),
      yaw: Math.random() * 6.28,
      state: walking ? 'walk' : 'sit',
      dir: Math.random() < 0.5 ? 1 : -1,
      col: CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)],
      t: Math.random() * 10,
      speed: 0,
      wash: 0,
      alley: a,
      fx: (a.x0 + a.x1) / 2,
      gone: false,
      leap: 0,
    };
    if (!walking && !s.top) cat.yaw = s.x < (a.x0 + a.x1) / 2 ? Math.PI / 2 : -Math.PI / 2;
    this.cats.push(cat);
    this.stats.cats++;
  }

  cat(c, dt) {
    const game = this.game;
    const pl = game.player;
    const pp = pl.inVehicle ? pl.inVehicle.pos : pl.pos;
    const d = Math.hypot(pp.x - c.x, pp.z - c.z);
    c.t += dt;
    const running = pl.mode === 'foot' && pl.fig.speed > 3.2;
    if (c.state !== 'flee' && (d < 3.5 || (running && d < 7) || (pl.inVehicle && d < 9))) this.flee(c, pp);
    // (the dumpster under it gone: down it comes, and away)
    else if (c.state !== 'flee' && c.spot.box && !c.spot.box.alive && c.y > 0.5) this.flee(c, pp);
    if (c.state === 'sit') {
      c.speed = 0;
      // now and then a wash, now and then a look round
      c.wash = Math.max(0, Math.sin(c.t * 0.35)) > 0.92 ? 1 : 0;
      if (Math.sin(c.t * 0.21) > 0.97) c.yaw += dt * 0.6;
      return;
    }
    const a = c.alley;
    if (c.state === 'walk') {
      c.speed = 0.55;
      c.yaw = c.dir > 0 ? 0 : Math.PI;
      c.z += c.dir * c.speed * dt;
      if (c.z > a.z1 - 3 || c.z < a.z0 + 3) {
        c.dir = -c.dir;
        // (and a sit at the end, now and then)
        if (Math.random() < 0.4) c.state = 'sit';
      }
      c.y = groundHeight(c.x, c.z);
      return;
    }
    // fleeing: down off the lid in a leap, then a run along the alley and round the corner at
    // its end, along the sidewalk by the wall; gone once you can't see it any more
    c.fleeT += dt;
    if (c.leap > 0) {
      c.leap -= dt;
      const k = 1 - Math.max(0, c.leap) / 0.45;
      c.x += (c.fx - c.x) * Math.min(1, dt * 4);
      c.y = c.spot.y * (1 - k) + groundHeight(c.x, c.z) * k + Math.sin(k * Math.PI) * 0.3;
      return;
    }
    c.speed = 4.2;
    if (!c.out) {
      c.yaw = c.dir > 0 ? 0 : Math.PI;
      c.z += c.dir * c.speed * dt;
      c.x += (c.fx + (c.x < c.fx ? -1 : 1) * 0.6 - c.x) * Math.min(1, dt * 2);
      const end = c.dir > 0 ? a.z1 + 1.2 : a.z0 - 1.2;
      if ((c.z - end) * c.dir >= 0) {
        c.z = end;
        c.out = pp.x > c.x ? -1 : 1;
      }
    } else {
      c.yaw = c.out > 0 ? Math.PI / 2 : -Math.PI / 2;
      c.x += c.out * c.speed * dt;
    }
    c.y = groundHeight(c.x, c.z);
    if (c.fleeT > 20 || (c.fleeT > 1.5 && !this.seen(c.x, c.z, 28))) c.gone = true;
  }

  // off, away from it, down the alley
  flee(c, from) {
    c.state = 'flee';
    c.dir = c.z > from.z ? 1 : -1;
    c.fleeT = 0;
    if (c.y > 0.5) c.leap = 0.45;
    this.stats.fled++;
    const p = this.game.player.pos;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < 14) this.game.audio.play('meow', 0.35);
  }

  // ------------------------------------------------------------------ birds in the park
  newFlock(p) {
    for (const pk of this.game.world.parks || []) {
      if (Math.hypot(pk.cx - p.x, pk.cz - p.z) > 90) continue;
      for (let tries = 0; tries < 6; tries++) {
        // on a lawn (one of the three quarters that have grass)
        const q = Math.floor(Math.random() * 3);
        const x = q === 1 ? pk.cx + 3 + Math.random() * (pk.x1 - pk.cx - 6) : pk.x0 + 3 + Math.random() * (pk.cx - pk.x0 - 6);
        const z = q === 2 ? pk.cz + 3 + Math.random() * (pk.z1 - pk.cz - 6) : pk.z0 + 3 + Math.random() * (pk.cz - pk.z0 - 6);
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < 12 || d > 60 || this.seen(x, z, 30)) continue;
        if (this.game.world.collision.pointInside(x, 0.5, z, 0.8)) continue;
        const birds = [];
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const bx = x + (Math.random() - 0.5) * 2.5;
          const bz = z + (Math.random() - 0.5) * 2.5;
          birds.push({ x: bx, z: bz, y: groundHeight(bx, bz), yaw: Math.random() * 6.28, peck: Math.random() * 5, hop: 0, vx: 0, vy: 0, vz: 0, flap: Math.random() * 6 });
        }
        this.flocks.push({ x, z, birds, up: false, upT: 0, chirpT: 1 + Math.random() * 3 });
        this.stats.flocks++;
        return;
      }
    }
  }

  // up into the palms, away from it
  flyUp(f, from, d) {
    f.up = true;
    f.upT = 0;
    for (const b of f.birds) {
      const dx = b.x - from.x;
      const dz = b.z - from.z;
      const l = Math.hypot(dx, dz) || 1;
      b.vx = (dx / l) * (2.5 + Math.random() * 2);
      b.vz = (dz / l) * (2.5 + Math.random() * 2);
      b.vy = 3.5 + Math.random() * 2.5;
    }
    this.stats.flew++;
    if (d < 16) this.game.audio.play('flap', 0.4);
  }

  birds(f, dt) {
    const game = this.game;
    const pl = game.player;
    const pp = pl.inVehicle ? pl.inVehicle.pos : pl.pos;
    const d = Math.hypot(f.x - pp.x, f.z - pp.z);
    const running = pl.mode === 'foot' && pl.fig.speed > 3.2;
    if (!f.up && (d < 4.5 || (running && d < 8) || (pl.inVehicle && d < 10))) this.flyUp(f, pp, d);
    if (!f.up) {
      f.chirpT -= dt;
      if (f.chirpT <= 0) {
        f.chirpT = 2 + Math.random() * 5;
        if (d < 16) game.audio.play('chirp', 0.5 * (1 - d / 16));
      }
      for (const b of f.birds) {
        b.peck += dt;
        if (Math.random() < dt * 0.6) b.yaw += (Math.random() - 0.5) * 2.5;
        if (Math.random() < dt * 0.5) b.hop = 0.18;
        if (b.hop > 0) {
          b.hop -= dt;
          b.x += Math.sin(b.yaw) * dt * 0.9;
          b.z += Math.cos(b.yaw) * dt * 0.9;
        }
      }
      return;
    }
    f.upT += dt;
    for (const b of f.birds) {
      b.vy = Math.max(b.vy - dt * 0.8, 1.6);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.yaw = Math.atan2(b.vx, b.vz);
      b.flap += dt * 26;
    }
  }

  // ------------------------------------------------------------------ drawing
  draw(fr) {
    const game = this.game;
    if (game.classic || !this.spots) return;
    const bodies = game.figures.bodies;
    const cam = game.camera.position;
    const night = this.night;
    for (const c of this.cats) {
      if (Math.hypot(c.x - cam.x, c.z - cam.z) > 70) continue;
      this.drawCat(bodies, fr, c, night);
    }
    for (const f of this.flocks) {
      if (Math.hypot(f.x - cam.x, f.z - cam.z) > 70) continue;
      for (const b of f.birds) this.drawBird(bodies, b, f.up);
    }
  }

  // a cat: the body, the head and its ears, the tail going, four legs (walking or tucked)
  drawCat(bodies, fr, c, night) {
    _f.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    _r.set(_f.z, 0, -_f.x);
    const col = c.col.body;
    const sitting = c.state === 'sit' && c.leap <= 0;
    const run = c.speed > 2;
    const ph = c.t * (run ? 14 : 6);
    const y = c.y;
    // the body: upright when it sits, long when it walks
    if (sitting) {
      _c.set(c.x - _f.x * 0.04, y + 0.15, c.z - _f.z * 0.04);
      _u.copy(UP).addScaledVector(_f, 0.35).normalize();
      _w.crossVectors(_u, _r);
      bodies.blob(_c, _r, _u, _w, 0.085, 0.15, 0.09, col);
      // the haunches
      _c.set(c.x - _f.x * 0.08, y + 0.07, c.z - _f.z * 0.08);
      bodies.blob(_c, _r, UP, _f, 0.1, 0.07, 0.11, col);
      // the front paws
      for (const s of [-1, 1]) {
        _c.set(c.x + _f.x * 0.07 + _r.x * s * 0.04, y + 0.05, c.z + _f.z * 0.07 + _r.z * s * 0.04);
        bodies.blob(_c, _r, UP, _f, 0.022, 0.05, 0.025, col);
      }
    } else {
      const bob = run ? Math.abs(Math.sin(ph)) * 0.03 : 0;
      _c.set(c.x, y + 0.2 + bob, c.z);
      bodies.blob(_c, _r, UP, _f, 0.075, 0.075, 0.2, col);
      for (let i = 0; i < 4; i++) {
        const front = i < 2 ? 1 : -1;
        const s = i % 2 ? 1 : -1;
        const sw = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * (run ? 0.09 : 0.05);
        _c.set(c.x + _f.x * (front * 0.13 + sw) + _r.x * s * 0.045, y + 0.08, c.z + _f.z * (front * 0.13 + sw) + _r.z * s * 0.045);
        bodies.blob(_c, _r, UP, _f, 0.022, 0.085, 0.024, col);
      }
    }
    // the head (a wash: down to the paw)
    const hy = sitting ? (c.wash ? 0.24 : 0.31) : 0.27;
    const hf = sitting ? 0.05 : 0.22;
    _c.set(c.x + _f.x * hf, y + hy, c.z + _f.z * hf);
    bodies.blob(_c, _r, UP, _f, 0.06, 0.055, 0.058, col);
    const hx = _c.x;
    const hyy = _c.y;
    const hz = _c.z;
    for (const s of [-1, 1]) {
      _c.set(hx + _r.x * s * 0.032, hyy + 0.05, hz + _r.z * s * 0.032);
      bodies.blob(_c, _r, UP, _f, 0.018, 0.03, 0.012, c.col.dark);
    }
    // the face: a pale muzzle (on some), the eyes with their slits, a pink nose; and the whiskers
    // when you are close enough to see them
    const cam = this.game.camera.position;
    const dc = Math.hypot(cam.x - hx, cam.y - hyy, cam.z - hz);
    if (dc < 25) {
      const washing = sitting && c.wash;
      if (c.col.muzzle) {
        _c.set(hx + _f.x * 0.04, hyy - 0.02, hz + _f.z * 0.04);
        bodies.blob(_c, _r, UP, _f, 0.03, 0.022, 0.024, c.col.muzzle);
      }
      if (!washing) {
        for (const s of [-1, 1]) {
          _c.set(hx + _f.x * 0.047 + _r.x * s * 0.024, hyy + 0.012, hz + _f.z * 0.047 + _r.z * s * 0.024);
          bodies.blob(_c, _r, UP, _f, 0.012, 0.012, 0.008, CAT_EYE);
          _c.set(hx + _f.x * 0.053 + _r.x * s * 0.024, hyy + 0.012, hz + _f.z * 0.053 + _r.z * s * 0.024);
          bodies.blob(_c, _r, UP, _f, 0.0035, 0.011, 0.004, PUPIL);
        }
      }
      _c.set(hx + _f.x * 0.062, hyy - 0.006, hz + _f.z * 0.062);
      bodies.blob(_c, _r, UP, _f, 0.008, 0.006, 0.005, NOSE);
      if (dc < 6) {
        // (the pen's stroke shines by itself: dimmed with the dark)
        const dim = 1 - 0.75 * night;
        _wh[0] = c.col.whisk[0] * dim;
        _wh[1] = c.col.whisk[1] * dim;
        _wh[2] = c.col.whisk[2] * dim;
        for (const s of [-1, 1]) {
          for (const k of [-1, 0, 1]) {
            const ax = hx + _f.x * 0.055 + _r.x * s * 0.016;
            const az = hz + _f.z * 0.055 + _r.z * s * 0.016;
            fr.lineXYZ(ax, hyy - 0.016, az, ax + _r.x * s * 0.07 + _f.x * 0.012, hyy - 0.016 + k * 0.011, az + _r.z * s * 0.07 + _f.z * 0.012, _wh, 1, 1300 + s * 3 + k, 0.85, 0.002, 0);
          }
        }
      }
    }
    // the tail: a curve of three, swinging
    const sw = Math.sin(c.t * (sitting ? 1.4 : 3)) * (sitting ? 0.35 : 0.2);
    for (let i = 1; i <= 3; i++) {
      const k = i / 3;
      const back = sitting ? 0.14 + k * 0.1 : 0.22 + k * 0.12;
      _c.set(c.x - _f.x * back + _r.x * Math.sin(sw * k * 2) * 0.12, y + (sitting ? 0.04 + k * 0.02 : 0.22 + k * 0.08), c.z - _f.z * back + _r.z * Math.sin(sw * k * 2) * 0.12);
      bodies.blob(_c, _r, UP, _f, 0.02, 0.02, 0.05, i === 3 ? c.col.dark : col);
    }
    // at night the eyes shine back at you
    if (night > 0.4 && !(sitting && c.wash)) {
      const vx = cam.x - hx;
      const vz = cam.z - hz;
      if (vx * _f.x + vz * _f.z > 0) {
        const wpx = Math.max(2, Math.min(5, 40 / dc));
        for (const s of [-1, 1]) {
          const ex = hx + _f.x * 0.056 + _r.x * s * 0.024;
          const ez = hz + _f.z * 0.056 + _r.z * s * 0.024;
          fr.lineXYZ(ex - _r.x * 0.006, hyy + 0.012, ez - _r.z * 0.006, ex + _r.x * 0.006, hyy + 0.012, ez + _r.z * 0.006, EYES, wpx, 1200 + s, Math.min(1, (night - 0.4) * 2.5), 0.001, 0);
        }
      }
    }
  }

  // a little brown bird (on the lawn, pecking; or off, its wings going)
  drawBird(bodies, b, flying) {
    _f.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    _r.set(_f.z, 0, -_f.x);
    const peck = flying ? 0 : Math.max(0, Math.sin(b.peck * 5)) ** 6;
    _c.set(b.x, b.y + 0.07, b.z);
    bodies.blob(_c, _r, UP, _f, 0.045, 0.04, 0.075, BIRD);
    _c.set(b.x + _f.x * 0.01, b.y + 0.055, b.z + _f.z * 0.01);
    bodies.blob(_c, _r, UP, _f, 0.035, 0.028, 0.05, BIRD_BELLY);
    _c.set(b.x + _f.x * (0.065 + peck * 0.02), b.y + 0.11 - peck * 0.06, b.z + _f.z * (0.065 + peck * 0.02));
    bodies.blob(_c, _r, UP, _f, 0.028, 0.028, 0.03, BIRD);
    // the beak, and the tail cocked up behind
    _c.set(_c.x + _f.x * 0.03, _c.y - 0.004 - peck * 0.01, _c.z + _f.z * 0.03);
    bodies.blob(_c, _r, UP, _f, 0.008, 0.007, 0.014, BEAK);
    _w.set(_f.x * 0.9, 0.42, _f.z * 0.9);
    _u.set(-_f.x * 0.42, 0.9, -_f.z * 0.42);
    _c.set(b.x - _f.x * 0.085, b.y + 0.095, b.z - _f.z * 0.085);
    bodies.blob(_c, _r, _u, _w, 0.026, 0.007, 0.045, BIRD_DARK);
    if (flying) {
      const a = Math.sin(b.flap) * 0.7;
      for (const s of [-1, 1]) {
        const c = Math.cos(a);
        const sn = Math.sin(a);
        _u.set(-_r.x * sn * s, c, -_r.z * sn * s);
        _w.set(_r.x * c * s, sn, _r.z * c * s);
        _c.set(b.x + _w.x * 0.06, b.y + 0.08 + _w.y * 0.06, b.z + _w.z * 0.06);
        bodies.blob(_c, _w, _u, _f, 0.06, 0.008, 0.035, BIRD);
      }
    }
  }
}
