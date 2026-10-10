import * as THREE from 'three';
import { KINDS } from '../render/cars.js';

// Damage you can see on the cars (ROADMAP 4.2): the city's traffic, the cars parked along the
// curbs, and the one you drive.
//   dents        where it was hit, the body pressed in (the car's shader moves its skin: two
//                points a car, the deepest; render/glsl.js USE_DENTS)
//   the glass    crazed white after a hard knock, then gone (the dark inside)
//   a tyre       a hit by a wheel lets it down: it sits on its rim and the corner drops
//   the bumper   a hard knock at either end and it comes off, lying in the road
//   smoke        a badly hurt car smokes from under the hood, grey and then black
//   fire         past that it burns (drawn flames), the driver gets out and runs, and a few
//                seconds later it blows up (an explosion like a rocket's: the cars round it get
//                hurt too, and so on)
// Hurt by crashing into them, by shots at the parked ones, by blasts. (?classic: none of it)

const BIG = new Set(['bus', 'truck', 'garbage', 'firetruck']);
const SMOKE_GREY = [0.82, 0.82, 0.85];
const SMOKE_BLACK = [0.22, 0.22, 0.24];
// (brighter than white: they glow)
const FLAME = [[2.6, 2.1, 0.7], [2.4, 1.3, 0.3], [2.2, 0.7, 0.16], [1.6, 0.35, 0.1]];
const FIRE_PUFF = [1.5, 0.62, 0.16];
const BUMPER = [0.07, 0.07, 0.09];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Damage {
  constructor(game) {
    this.game = game;
    this.cars = new Set();
    this.fallen = [];
    this.byBox = null;
    // (counted for the tests)
    this.stats = { dents: 0, cracked: 0, broken: 0, flats: 0, bumpers: 0, fires: 0, booms: 0 };
  }

  // a car's damage, made the first time it is hurt
  of(c) {
    if (!c.dmg) {
      const kind = c.spec ? c.spec.kind : c.carKind;
      c.dmg = { hp: BIG.has(kind) || c.bus ? 170 : 100, d0: null, d1: null, glass: 0, flat: -1, bumper: 0, burning: false, burnT: 0, fuse: 0, burnt: false, puffT: 0 };
    }
    this.cars.add(c);
    return c.dmg;
  }

  // its shape (the cars' table), and how big it is
  shape(c) {
    const kind = c.spec ? c.spec.kind : c.carKind;
    return KINDS[kind] || null;
  }

  // ------------------------------------------------------------------ getting hurt
  // a knock at a point of the world (x, y, z), so hard (a crash's speed in m/s, a shot's
  // damage...); own: the player's car keeps its own count of what it can take
  hit(c, x, y, z, power, own = false) {
    const game = this.game;
    if (game.classic || !c || c.poofT !== undefined || power <= 0) return;
    const K = this.shape(c);
    if (!K) return;
    const D = this.of(c);
    // into the car's own frame (x across, z along: as its shape is drawn)
    const yaw = c.yaw || 0;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const dx = x - c.pos.x;
    const dz = z - c.pos.z;
    const hw = K.W / 2;
    const hl = K.len / 2;
    let lx = dx * cy - dz * sy;
    let lz = dx * sy + dz * cy;
    // (onto its skin: the nearest side)
    if (Math.abs(lx) / hw > Math.abs(lz) / hl) lx = Math.sign(lx) * hw * 0.95;
    else lz = Math.sign(lz) * hl * 0.97;
    lx = clamp(lx, -hw, hw);
    lz = clamp(lz, -hl, hl);
    const ly = clamp(y - (c.pos.y || 0), 0.35, Math.min(1.2, K.glass.R - 0.3));
    this.dent(D, lx, ly, lz, Math.min(0.24, power * 0.011));
    // the glass: crazed, then gone
    if (D.glass < 1 && power > 9) {
      D.glass = 1;
      this.stats.cracked++;
      if (this.near(c, 40)) game.audio.play('jam', 0.25);
    }
    if (D.glass === 1 && (power > 26 || (power > 14 && Math.random() < 0.3))) {
      D.glass = 2;
      this.stats.broken++;
      game.fx.crumbs(x, y + 0.4, z, 14, 2.2, false);
    }
    // a wheel by the knock: let down
    if (D.flat < 0 && power > 8 && Math.random() < 0.55) {
      const L = K.len;
      let wi = -1;
      let bd = 0.8;
      K.wheels.forEach((t, ti) => {
        const wz = t * L - L / 2;
        for (const sd of [-1, 1]) {
          const d = Math.hypot(lz - wz, (lx - sd * hw) * 0.7);
          if (d < bd) {
            bd = d;
            wi = ti * 2 + (sd > 0 ? 1 : 0);
          }
        }
      });
      if (wi >= 0) {
        D.flat = wi;
        this.stats.flats++;
      }
    }
    // the bumper at that end comes off
    const end = lz > hl * 0.8 ? 1 : lz < -hl * 0.8 ? 2 : 0;
    if (end && power > 13 && !(D.bumper & end)) {
      D.bumper |= end;
      this.dropBumper(c, K, end === 1);
    }
    if (!own) {
      D.hp -= power;
      if (D.hp <= 25 && !D.burning && !D.burnt) this.ignite(c);
    }
  }

  // deeper where it was already dented; else a new one (two a car: the deepest stay)
  dent(D, x, y, z, w) {
    this.stats.dents++;
    for (const k of ['d0', 'd1']) {
      const o = D[k];
      if (o && Math.hypot(o[0] - x, o[1] - y, o[2] - z) < 0.75) {
        o[3] = Math.min(0.32, o[3] + w * 0.6);
        return;
      }
    }
    if (!D.d0) D.d0 = [x, y, z, w];
    else if (!D.d1) D.d1 = [x, y, z, w];
    else {
      const k = D.d0[3] < D.d1[3] ? 'd0' : 'd1';
      if (D[k][3] < w) D[k] = [x, y, z, w];
    }
  }

  // a car you drive into another (Traffic.collideVehicle): both dented where they met
  crash(v, c, speed) {
    if (this.game.classic || speed < 3) return;
    const x = (v.pos.x + c.pos.x) / 2;
    const z = (v.pos.z + c.pos.z) / 2;
    this.hit(c, x, 0.7, z, speed * 1.6);
    if (v.kind === 'car') this.hit(v, x, 0.7, z, speed * 1.4, true);
  }

  // your car into a wall (Vehicle.collideWorld): its front, or its back
  wall(v, impact) {
    if (this.game.classic || v.kind !== 'car') return;
    const f = Math.sign(v.speed || 1);
    const x = v.pos.x + Math.sin(v.yaw) * v.halfLen * f;
    const z = v.pos.z + Math.cos(v.yaw) * v.halfLen * f;
    this.hit(v, x, 0.6, z, impact * 1.5, true);
  }

  // a shot into a parked car's box (Weapons.onHit)
  shot(box, hit, power) {
    if (this.game.classic || !box || box.tag !== 'car') return false;
    const c = this.carOfBox(box);
    if (!c) return false;
    this.hit(c, hit.x, hit.y, hit.z, power * 0.7);
    return true;
  }

  carOfBox(box) {
    if (box.data && box.data.car) return box.data.car;
    if (!this.byBox) {
      this.byBox = new Map();
      for (const c of this.game.traffic.parked) if (c.box !== undefined) this.byBox.set(c.box, c);
    }
    const c = this.byBox.get(box.id);
    return c && !c.taken ? c : null;
  }

  // a blast (Traffic.explosion): the side towards it pressed in, the glass gone; close to it,
  // on fire
  blast(c, x, z, radius) {
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    const k = 1 - d / (radius + 1.5);
    if (k <= 0 || c.poofT !== undefined) return;
    const D = this.of(c);
    if (D.burnt) return;
    // (the point of it nearest the blast)
    const l = d || 1;
    this.hit(c, c.pos.x + ((x - c.pos.x) / l) * 3, 0.8, c.pos.z + ((z - c.pos.z) / l) * 3, 14 + 60 * k);
    if (k > 0.45 && !D.burning) this.ignite(c, 1.5 + Math.random() * 2.5);
  }

  // on fire: the driver gets out and runs; it burns, then it blows up
  ignite(c, delay = 0) {
    const game = this.game;
    const D = this.of(c);
    if (D.burning || D.burnt) return;
    // (not too many at once: the rest just smoke)
    let n = 0;
    for (const o of this.cars) if (o.dmg && o.dmg.burning) n++;
    if (n >= 6) return;
    D.burning = true;
    D.burnT = -delay;
    D.fuse = 6 + Math.random() * 4;
    this.stats.fires++;
    if (game.traffic.list.includes(c)) {
      c.stopped = true;
      c.path = null;
      if (c.driver && !c.driverOut) {
        c.driverOut = true;
        game.ejectDriver(c.driver, c.pos, c.yaw, false);
        c.driver = null;
      }
    }
  }

  explode(c) {
    const game = this.game;
    const D = c.dmg;
    D.burnt = true;
    D.burning = false;
    D.glass = 2;
    D.hp = 0;
    this.stats.booms++;
    if (c.kind === 'car' && c.hurt) {
      // your car: as it does when it is done for
      c.hurt(1e6);
      return;
    }
    c.wrecked = true;
    c.path = null;
    if (c.parkedCar) game.traffic.unpark(c);
    // the blast hurts what is round it, and the cars round it (and those may burn in turn)
    game.explosion(c.pos.x, 1.0, c.pos.z, 4.5, 50, 'car');
    game.fx.crumbs(c.pos.x, 1.2, c.pos.z, 30, 5, true);
  }

  // the bumper off that end, into the road
  dropBumper(c, K, front) {
    this.stats.bumpers++;
    const f = front ? 1 : -1;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const out = K.len / 2 + 0.5 + Math.random() * 0.8;
    const side = (Math.random() - 0.5) * 1.2;
    this.fallen.push({
      x: c.pos.x + fx * out * f - fz * side,
      z: c.pos.z + fz * out * f + fx * side,
      yaw: c.yaw + (Math.random() - 0.5) * 1.2,
      len: K.W * 0.85,
      t: 0,
    });
    if (this.fallen.length > 14) this.fallen.shift();
    if (this.near(c, 40)) this.game.audio.play('clang', 0.45);
  }

  // how high the car's top is at t along it (the roof over the cabin, else the body)
  topAt(K, t) {
    if (t > K.glass.tB && t < K.glass.tC) return K.glass.R;
    const b = K.belt;
    for (let i = 1; i < b.length; i++) {
      if (b[i][0] >= t) {
        const k = (t - b[i - 1][0]) / Math.max(1e-6, b[i][0] - b[i - 1][0]);
        return b[i - 1][1] + (b[i][1] - b[i - 1][1]) * k;
      }
    }
    return b[b.length - 1][1];
  }

  near(c, r) {
    const p = this.game.player.pos;
    return Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < r;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || !this.cars.size) return;
    const cam = game.camera.position;
    for (const c of this.cars) {
      const D = c.dmg;
      if (!D || c.gone || c.dead || c.taken || c.poofT !== undefined) {
        // (gone from the street, or driven off by you: the player's car carries its own)
        if (!c.taken) this.cars.delete(c);
        continue;
      }
      const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
      // how hurt: a parked or passing car its own count; yours, what it has left
      const own = c.kind === 'car' && c.maxHp;
      const hurt = own ? 1 - c.hp / c.maxHp : 1 - D.hp / 100;
      if (D.burning) {
        D.burnT += dt;
        if (D.burnT >= D.fuse) {
          this.explode(c);
          continue;
        }
      } else if (own && !D.burnt && c.hp / c.maxHp < 0.18) {
        // (your own car burning: you have a few seconds)
        D.burning = true;
        D.burnT = 0;
        D.fuse = 7;
      }
      if (d > 120) continue;
      // smoke from under the hood: grey, then black; and (on fire) the flames' own
      const K = this.shape(c);
      if (!K) continue;
      const burning = D.burning && D.burnT >= 0;
      if (hurt < 0.5 && !burning && !D.burnt) continue;
      D.puffT -= dt;
      if (D.puffT > 0) continue;
      D.puffT = burning ? 0.12 : D.burnt ? 0.5 : 0.35;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const hood = D.burnt ? 0 : K.len * 0.32;
      const x = c.pos.x + fx * hood + (Math.random() - 0.5) * 0.6;
      const z = c.pos.z + fz * hood + (Math.random() - 0.5) * 0.6;
      const black = burning || D.burnt || hurt > 0.7;
      game.fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x, (burning ? 2.0 : 1.2) + Math.random() * 0.3, z, {
        size: burning ? 1.8 : 1.0, grow: 1.4, life: burning ? 1.8 : 1.3, vy: 1.4, alpha: burning ? 0.85 : 0.6, tint: black ? SMOKE_BLACK : SMOKE_GREY,
      });
      // (and the fire's own: quick orange puffs)
      if (burning) {
        game.fx.sprite('smoke1', x + (Math.random() - 0.5) * 0.8, 1.1 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.8, {
          size: 0.9 + Math.random() * 0.5, grow: 0.6, life: 0.45, vy: 2.4, alpha: 0.9, tint: FIRE_PUFF,
        });
      }
    }
    for (const b of this.fallen) b.t += dt;
  }

  // ------------------------------------------------------------------ drawing
  // the flames over a burning car (pen strokes, flickering), the bumpers lying in the road
  draw(fr) {
    const game = this.game;
    if (game.classic) return;
    const cam = game.camera.position;
    const t = game.time;
    for (const c of this.cars) {
      const D = c.dmg;
      if (!D || !D.burning || D.burnT < 0 || c.gone || c.taken || c.poofT !== undefined) continue;
      const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
      if (d > 110) continue;
      const K = this.shape(c);
      if (!K) continue;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const rx = -fz;
      const rz = fx;
      const grow = Math.min(1, D.burnT / 1.5);
      // (the cabin catches a while after the engine)
      const cabin = Math.min(1, Math.max(0, (D.burnT - 2) / 2));
      const w = Math.max(3, Math.min(16, 260 / Math.max(1, d)));
      // tongues of flame out of the hood, then over the roof, each its own flicker
      const n = 12 + Math.round(12 * cabin);
      for (let i = 0; i < n; i++) {
        const front = i < 12;
        const tt = front ? 0.66 + ((i * 0.61) % 1) * 0.3 : K.glass.tA + ((i * 0.37) % 1) * (K.glass.tD - K.glass.tA);
        const u = tt * K.len - K.len / 2;
        const s = (((i * 0.73) % 1) - 0.5) * K.W * 0.75;
        const top = this.topAt(K, tt);
        const h = (0.8 + 0.9 * Math.abs(Math.sin(t * (7 + i) + i * 1.7))) * (front ? grow : cabin) * (1.15 - Math.abs(s) / K.W);
        if (h < 0.05) continue;
        const bx = c.pos.x + fx * u + rx * s;
        const bz = c.pos.z + fz * u + rz * s;
        const by = top - 0.05;
        const sway = Math.sin(t * 9 + i * 2.3) * 0.15;
        const mx = bx + rx * sway * 0.5;
        const mz = bz + rz * sway * 0.5;
        const col = FLAME[i % FLAME.length];
        fr.lineXYZ(bx, by, bz, mx, by + h * 0.55, mz, col, w * 1.3, 3000 + i, 0.95, 0.03, 0.02);
        fr.lineXYZ(mx, by + h * 0.55, mz, mx + rx * sway, by + h, mz + rz * sway, FLAME[(i + 1) % FLAME.length], w * 0.8, 3100 + i, 0.9, 0.03, 0.02);
      }
    }
    // the bumpers off the cars
    const cars = game.cars;
    if (!cars || !this.fallen.length) return;
    for (const b of this.fallen) {
      if (Math.hypot(b.x - cam.x, b.z - cam.z) > 140) continue;
      _q.setFromAxisAngle(UP, b.yaw);
      _m.compose(_p.set(b.x, 0.07, b.z), _q, _s.set(b.len, 0.13, 0.16));
      cars.trimBox.push(_m, BUMPER, 0);
    }
  }
}
