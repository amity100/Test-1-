import * as THREE from 'three';
import { Batch, nextId } from '../world/kit.js';
import { srgb } from '../render/materials.js';
import { AVES, STREETS, CURB, PROM_X1, STREET_X1, NORTH_EDGE, SOUTH_EDGE, PIER, groundHeight } from '../world/layout.js';
import { copterModel } from './vehicles.js';

// The small life of the city: pigeons pecking on the sidewalks that burst up when you run through
// them or a shot goes off, gulls wheeling over the promenade, boats crossing the bay in the last of
// the sun, a helicopter circling downtown, a blimp drifting over it all with an ad on its side.

const PIGEON = [0.5, 0.52, 0.62];
const PIGEON_HEAD = [0.32, 0.34, 0.44];
const GULL = [0.97, 0.96, 0.95];
const GULL_WING = [0.66, 0.68, 0.76];
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Ambient {
  constructor(game) {
    this.game = game;
    this.flocks = [];
    this.gulls = [];
    this.t = 0;
    this.spawnT = 0;
    const M = game.world.ctx.M;
    // gulls over the bay and the promenade
    for (let i = 0; i < 9; i++) {
      this.gulls.push({
        cx: STREET_X1 + 10 + Math.random() * 60,
        cz: -200 + Math.random() * 380,
        r: 12 + Math.random() * 30,
        y: 14 + Math.random() * 16,
        a: Math.random() * 6.28,
        w: (0.18 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1),
        flap: Math.random() * 6,
        pos: new THREE.Vector3(),
      });
    }
    // boats on the bay
    this.boats = [];
    for (let i = 0; i < 6; i++) this.boats.push(this.makeBoat(M, i));
    // the helicopter over downtown, the blimp over the bay
    const heli = copterModel('good');
    heli.body.scale.setScalar(1.15);
    this.heli = { group: new THREE.Group(), m: heli, a: 0 };
    this.heli.group.add(heli.body);
    game.scene.add(this.heli.group);
    this.blimp = this.makeBlimp(M);
  }

  makeBoat(M, i) {
    const B = new Batch();
    const sail = i % 3 !== 2;
    const hullCol = [srgb(0.98, 0.96, 0.94), srgb(0.95, 0.4, 0.45), srgb(0.2, 0.6, 0.66), srgb(1.0, 0.8, 0.3)][i % 4];
    const len = sail ? 7 : 6;
    // the hull: a box narrowing to a bow
    const hull = new THREE.CylinderGeometry(1.0, 0.7, len, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4);
    hull.scale(1.2, 0.55, 1);
    hull.translate(0, 0.35, 0);
    B.add(M.propPaint, hull, null, nextId(), { color: hullCol });
    B.add(M.prop, new THREE.BoxGeometry(1.4, 0.06, len * 0.7).translate(0, 0.72, -0.2), null, nextId(), { color: srgb(0.7, 0.5, 0.34) });
    if (sail) {
      B.add(M.pole, new THREE.CylinderGeometry(0.05, 0.06, 8, 6).translate(0, 4.6, 0.4), null, nextId(), { color: srgb(0.9, 0.9, 0.92) });
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.1, 0.35, 0, 8.4, 0.38, 0, 1.1, -2.6, 0, 1.1, 0.35, 0, 1.1, -2.6, 0, 8.4, 0.38], 3));
      tri.computeVertexNormals();
      const sc = [srgb(1, 0.98, 0.95), srgb(1, 0.85, 0.9), srgb(0.95, 0.95, 1)][i % 3];
      B.add(M.awning, tri, null, nextId(), { color: sc });
      const jib = new THREE.BufferGeometry();
      jib.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.1, 0.5, 0, 7.6, 0.42, 0, 1.0, 3.1, 0, 1.1, 0.5, 0, 1.0, 3.1, 0, 7.6, 0.42], 3));
      jib.computeVertexNormals();
      B.add(M.awning, jib, null, nextId(), { color: sc });
    } else {
      // a little motor boat: a cabin and a light
      B.add(M.prop, new THREE.BoxGeometry(1.2, 0.8, 1.6).translate(0, 1.1, -0.4), null, nextId(), { color: srgb(0.98, 0.98, 0.98) });
      B.add(M.winGlass, new THREE.BoxGeometry(1.22, 0.36, 0.9).translate(0, 1.2, 0.1), null, nextId());
      B.add(M.lampGlass, new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(0, 1.6, -0.6), null, nextId());
    }
    const group = new THREE.Group();
    B.flush(group, { dynamic: true });
    this.game.scene.add(group);
    // a long slow line across the bay (to and fro)
    const x = PROM_X1 + 40 + Math.random() * 260;
    return {
      group,
      x,
      z: -380 + Math.random() * 560,
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: sail ? 1.6 + Math.random() * 1.4 : 5 + Math.random() * 3,
      bob: Math.random() * 6,
      lane: x,
    };
  }

  makeBlimp(M) {
    const B = new Batch();
    const body = new THREE.SphereGeometry(1, 24, 14);
    body.scale(6, 6, 20);
    B.add(M.propPaint, body, null, nextId(), { color: srgb(0.96, 0.95, 0.97) });
    for (const [rx, ry] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const fin = new THREE.BoxGeometry(rx ? 6 : 0.2, ry ? 6 : 0.2, 5);
      fin.translate(rx * 4, ry * 4, -17);
      B.add(M.prop, fin, null, nextId(), { color: srgb(0.95, 0.35, 0.5) });
    }
    B.add(M.prop, new THREE.BoxGeometry(2.2, 1.4, 6).translate(0, -6.4, 1), null, nextId(), { color: srgb(0.2, 0.6, 0.66) });
    // the ad on both sides
    const A = this.game.world.ctx.atlas;
    if (A) {
      const r = A.rects.ad_cola;
      for (const s of [1, -1]) {
        const w = 22;
        const h = 6;
        const x = s * 6.05;
        const a = [x, -h / 2, s > 0 ? w / 2 : -w / 2];
        const b = [x, -h / 2, s > 0 ? -w / 2 : w / 2];
        const c = [x, h / 2, s > 0 ? -w / 2 : w / 2];
        const d = [x, h / 2, s > 0 ? w / 2 : -w / 2];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(Array(6).fill([s, 0, 0]).flat(), 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[1], r[2], r[3], r[0], r[3]], 2));
        B.add(M.board, g, null, nextId());
      }
    }
    const group = new THREE.Group();
    B.flush(group, { dynamic: true });
    this.game.scene.add(group);
    return { group, a: 0 };
  }

  // pigeons take off from round (x, z)
  scare(pos, r) {
    for (const f of this.flocks) {
      if (f.up) continue;
      if (Math.hypot(f.x - pos.x, f.z - pos.z) < r) this.takeOff(f, pos);
    }
  }

  takeOff(f, from) {
    f.up = true;
    f.upT = 0;
    for (const b of f.birds) {
      const dx = b.x - from.x;
      const dz = b.z - from.z;
      const l = Math.hypot(dx, dz) || 1;
      b.vx = (dx / l) * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2;
      b.vz = (dz / l) * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2;
      b.vy = 3 + Math.random() * 3;
    }
    if (Math.hypot(f.x - this.game.player.pos.x, f.z - this.game.player.pos.z) < 20) this.game.audio.play('flap', 0.6);
  }

  // a flock pecking on a sidewalk near you
  spawnFlock(p) {
    for (let tries = 0; tries < 6; tries++) {
      let x;
      let z;
      const k = Math.random();
      if (k < 0.35 && p.x > -40) {
        x = STREET_X1 + 2 + Math.random() * 5;
        z = p.z + (Math.random() - 0.5) * 80;
      } else if (k < 0.7) {
        const a = AVES[Math.floor(Math.random() * 3)];
        x = a.x + (Math.random() < 0.5 ? -1 : 1) * (a.half + 1.5 + Math.random() * 3);
        z = p.z + (Math.random() - 0.5) * 90;
      } else {
        const s = STREETS[Math.floor(Math.random() * STREETS.length)];
        z = s.z + (Math.random() < 0.5 ? -1 : 1) * (s.half + 1.5 + Math.random() * 3);
        x = p.x + (Math.random() - 0.5) * 90;
      }
      if (z < NORTH_EDGE + 2 || z > SOUTH_EDGE - 2) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 18 || d > 70) continue;
      if (this.game.world.collision.pointInside(x, 0.5, z, 1.0)) continue;
      const birds = [];
      const n = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const bx = x + (Math.random() - 0.5) * 3;
        const bz = z + (Math.random() - 0.5) * 3;
        birds.push({ x: bx, z: bz, y: groundHeight(bx, bz), yaw: Math.random() * 6.28, peck: Math.random() * 5, hop: 0, vx: 0, vy: 0, vz: 0, flap: Math.random() * 6 });
      }
      this.flocks.push({ x, z, birds, up: false, upT: 0 });
      return;
    }
  }

  update(dt) {
    const game = this.game;
    this.t += dt;
    const p = game.anchorPos();
    // pigeons
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.5;
      this.flocks = this.flocks.filter((f) => Math.hypot(f.x - p.x, f.z - p.z) < 95 && !(f.up && f.upT > 6));
      if (this.flocks.length < (game.touch ? 3 : 6)) this.spawnFlock(p);
    }
    const pl = game.player;
    const running = pl.mode === 'foot' && pl.fig.speed > 3.2;
    for (const f of this.flocks) {
      if (!f.up) {
        const d = Math.hypot(f.x - pl.pos.x, f.z - pl.pos.z);
        const v = pl.inVehicle;
        if ((running && d < 6) || d < 2.2 || (v && Math.hypot(f.x - v.pos.x, f.z - v.pos.z) < 9)) this.takeOff(f, pl.inVehicle ? pl.inVehicle.pos : pl.pos);
        for (const b of f.birds) {
          b.peck += dt;
          if (Math.random() < dt * 0.4) b.yaw += (Math.random() - 0.5) * 2;
          if (Math.random() < dt * 0.25) b.hop = 0.25;
          if (b.hop > 0) {
            b.hop -= dt;
            b.x += Math.sin(b.yaw) * dt * 0.8;
            b.z += Math.cos(b.yaw) * dt * 0.8;
          }
        }
      } else {
        f.upT += dt;
        for (const b of f.birds) {
          b.vy -= dt * 1.2;
          b.vy = Math.max(b.vy, 1.4);
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          b.yaw = Math.atan2(b.vx, b.vz);
          b.flap += dt * 18;
        }
      }
    }
    // gulls
    for (const g of this.gulls) {
      g.a += g.w * dt;
      g.flap += dt * (Math.sin(g.a * 3) > 0.6 ? 7 : 0.6);
      g.pos.set(g.cx + Math.cos(g.a) * g.r, g.y + Math.sin(g.a * 2.3) * 1.5, g.cz + Math.sin(g.a) * g.r);
    }
    // boats
    for (const b of this.boats) {
      b.z += b.dir * b.speed * dt;
      if (b.z > 420) b.dir = -1;
      if (b.z < -600) b.dir = 1;
      b.bob += dt;
      b.group.position.set(b.x, -0.8 + Math.sin(b.bob * 1.3) * 0.08, b.z);
      b.group.rotation.set(Math.sin(b.bob * 0.9) * 0.03, b.dir > 0 ? 0 : Math.PI, Math.sin(b.bob * 1.1) * 0.05);
    }
    // the helicopter circling downtown
    const h = this.heli;
    h.a += dt * 0.07;
    const hx = -110 + Math.cos(h.a) * 150;
    const hz = -170 + Math.sin(h.a) * 190;
    h.group.position.set(hx, 62 + Math.sin(h.a * 3) * 4, hz);
    h.group.rotation.set(0.08, Math.atan2(-Math.sin(h.a), Math.cos(h.a)) + Math.PI / 2, -0.12);
    if (h.m.rotor) h.m.rotor.rotation.y += dt * 24;
    if (h.m.tailRotor) h.m.tailRotor.rotation.x += dt * 30;
    // the blimp
    const bl = this.blimp;
    bl.a += dt * 0.012;
    bl.group.position.set(60 + Math.cos(bl.a) * 160, 95, -120 + Math.sin(bl.a) * 260);
    bl.group.rotation.set(0, Math.atan2(-Math.sin(bl.a) * 160, Math.cos(bl.a) * 260) + Math.PI, 0);
  }

  draw() {
    const bodies = this.game.figures.bodies;
    const cam = this.game.camera.position;
    for (const f of this.flocks) {
      if (Math.hypot(f.x - cam.x, f.z - cam.z) > 80) continue;
      for (const b of f.birds) this.pigeon(bodies, b, f.up);
    }
    for (const g of this.gulls) {
      if (g.pos.distanceTo(cam) > 160) continue;
      this.gull(bodies, g);
    }
  }

  pigeon(bodies, b, flying) {
    _f.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    _r.set(_f.z, 0, -_f.x);
    _u.copy(UP);
    const peck = flying ? 0 : Math.max(0, Math.sin(b.peck * 4)) ** 6;
    _c.set(b.x, b.y + 0.13, b.z);
    bodies.blob(_c, _r, _u, _f, 0.085, 0.08, 0.15, PIGEON);
    _c.set(b.x + _f.x * (0.13 + peck * 0.04), b.y + 0.23 - peck * 0.14, b.z + _f.z * (0.13 + peck * 0.04));
    bodies.blob(_c, _r, _u, _f, 0.05, 0.05, 0.055, PIGEON_HEAD);
    // the tail
    _c.set(b.x - _f.x * 0.17, b.y + 0.15, b.z - _f.z * 0.17);
    bodies.blob(_c, _r, _u, _f, 0.05, 0.015, 0.08, PIGEON_HEAD);
    if (flying) this.wings(bodies, b.x, b.y + 0.15, b.z, b.flap, 0.22, PIGEON);
  }

  gull(bodies, g) {
    const dx = -Math.sin(g.a) * g.w;
    const dz = Math.cos(g.a) * g.w;
    const l = Math.hypot(dx, dz) || 1;
    _f.set(dx / l, 0, dz / l);
    _r.set(_f.z, 0, -_f.x);
    _c.copy(g.pos);
    bodies.blob(_c, _r, UP, _f, 0.12, 0.11, 0.3, GULL);
    _c.copy(g.pos).addScaledVector(_f, 0.3).y += 0.05;
    bodies.blob(_c, _r, UP, _f, 0.08, 0.08, 0.1, GULL);
    this.wings(bodies, g.pos.x, g.pos.y + 0.03, g.pos.z, g.flap, 0.62, GULL_WING);
  }

  // two wings out to the sides, beating
  wings(bodies, x, y, z, flap, span, col) {
    const a = Math.sin(flap) * 0.6;
    for (const s of [-1, 1]) {
      const c = Math.cos(a);
      const sn = Math.sin(a);
      // the wing's own frame: out along the side, tilted up and down by the beat
      _u.set(-_r.x * sn * s, c, -_r.z * sn * s);
      const wr = new THREE.Vector3(_r.x * c * s, sn, _r.z * c * s);
      _c.set(x + wr.x * span * 0.5, y + wr.y * span * 0.5, z + wr.z * span * 0.5);
      bodies.blob(_c, wr, _u, _f, span * 0.5, 0.015, span * 0.22, col);
    }
  }
}

void CURB;
void PIER;
