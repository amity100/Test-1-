import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';
import { Batch, nextId } from '../world/kit.js';
import { cityMaterials } from '../world/mats.js';
import { srgb } from '../render/materials.js';

// (ROADMAP 8.3, not with ?classic) The street's light things fly when a car hits them: trash cans
// and trash bags, benches, newspaper boxes, mailboxes, the crates in the alleys. The prop leaves
// the drawing at once and a copy of it - its own geometry, taken out of the city's batches by its
// prop id - tumbles away, bounces and comes to rest on its side; hit again, it flies again.
// A hydrant knocked off its pipe sends a column of water up for a while. The police roadblocks
// (game/chase.js) have traffic cones across the road: they fly too.
// And the shop windows break (each pane a prop of its own, world/glass.js): a hard shot, a blast
// or a car driven into one - the glass showers out onto the sidewalk.

const KIND = {
  trash: { mass: 1.0, sound: 'clang' },
  news: { mass: 1.3, sound: 'clang' },
  mailbox: { mass: 2.2, sound: 'clang' },
  bench: { mass: 2.8, sound: 'crash' },
  crate: { mass: 1.6, sound: 'crash' },
  hydrant: { mass: 2.6, sound: 'clang', spray: true },
  cone: { mass: 0.35, sound: 'pop' },
};
const MIN_SPEED = 3.5; // m/s: slower than that, it is a wall as before
const MAX_PIECES = 14;
const REST_T = 40; // seconds a piece lies there before it may go (out of sight)
const SPRAY_T = 18;
const G = 14;
const WATER = [0.72, 0.88, 1.0];
const GLASS = [0.82, 0.92, 1.0];
const GLASS_HI = [1, 1, 1];
const GLASS_EDGE = [0.28, 0.42, 0.62];
const WATER_DARK = [0.36, 0.6, 0.92];
const MIST = [0.86, 0.94, 1.0];
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _axis = new THREE.Vector3();
const CORNERS = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];

export class Knock {
  constructor(game) {
    this.game = game;
    this.pieces = [];
    this.sprays = [];
    this.meshes = null;
    this._near = [];
    this.coneTpl = null;
    this.stats = { knocked: 0, kicks: 0, sprays: 0, cones: 0, panes: 0, extractMs: 0 };
  }

  // the city's batches that carry prop ids (found once)
  cityMeshes() {
    if (this.meshes) return this.meshes;
    this.meshes = [];
    this.game.world.group.traverse((m) => {
      if (m.isMesh && m.geometry.attributes.aObj && m.geometry.index) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        this.meshes.push(m);
      }
    });
    return this.meshes;
  }

  // ------------------------------------------------------------------ a prop's own geometry
  // where each prop's corners and triangles are in a batch (worked out once a batch: a prop's
  // parts went in one after another, so its corners are one run and its triangles another)
  rangesOf(m) {
    if (m.userData.objRanges) return m.userData.objRanges;
    const g = m.geometry;
    const ob = g.attributes.aObj.array;
    const map = new Map();
    for (let i = 0; i < ob.length; i++) {
      const id = ob[i];
      if (!id) continue;
      const r = map.get(id);
      if (r) r.v1 = i;
      else map.set(id, { v0: i, v1: i, t0: -1, t1: -1 });
    }
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const r = map.get(ob[idx[i]]);
      if (!r) continue;
      if (r.t0 < 0) r.t0 = i;
      r.t1 = i;
    }
    m.userData.objRanges = map;
    return map;
  }

  // every part of prop o, out of the batches it was merged into: one mesh per pen, round its middle
  extract(o) {
    const t0 = performance.now();
    const cx = (o.x0 + o.x1) / 2;
    const cz = (o.z0 + o.z1) / 2;
    const found = [];
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const m of this.cityMeshes()) {
      const bs = m.geometry.boundingSphere;
      // (the batch's sphere is in the batch's own space: the city's batches are not moved)
      if (Math.hypot(bs.center.x - cx, bs.center.z - cz) > bs.radius + 2) continue;
      const r = this.rangesOf(m).get(o.id);
      if (!r) continue;
      const g = m.geometry;
      const ob = g.attributes.aObj.array;
      const first = r.v0;
      const last = r.v1;
      const P = g.attributes.position.array;
      for (let i = first; i <= last; i++) {
        if (ob[i] !== o.id) continue;
        const y = P[i * 3 + 1];
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      found.push({ m, first, last, t0: r.t0, t1: r.t1 });
    }
    if (!found.length) return null;
    const cy = (y0 + y1) / 2;
    const meshes = [];
    let hx = 0.1;
    let hz = 0.1;
    for (const { m, first, last, t0: ta, t1: tb } of found) {
      const g = m.geometry;
      const ob = g.attributes.aObj.array;
      const map = new Int32Array(last - first + 1).fill(-1);
      let n = 0;
      for (let i = first; i <= last; i++) if (ob[i] === o.id) map[i - first] = n++;
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) {
        const k = attr.itemSize;
        const src = attr.array;
        const dst = new src.constructor(n * k);
        for (let i = first; i <= last; i++) {
          const j = map[i - first];
          if (j < 0) continue;
          for (let c = 0; c < k; c++) dst[j * k + c] = src[i * k + c];
        }
        if (name === 'position') {
          for (let j = 0; j < n; j++) {
            dst[j * 3] -= cx;
            dst[j * 3 + 1] -= cy;
            dst[j * 3 + 2] -= cz;
            hx = Math.max(hx, Math.abs(dst[j * 3]));
            hz = Math.max(hz, Math.abs(dst[j * 3 + 2]));
          }
        }
        // (no longer the prop the eraser masks, nor a frond in the breeze)
        if (name === 'aObj' || name === 'aSway') dst.fill(0);
        geo.setAttribute(name, new THREE.BufferAttribute(dst, k));
      }
      const idx = g.index.array;
      const tri = [];
      for (let i = Math.max(0, ta); i <= tb; i += 3) {
        const a = idx[i] - first;
        if (a < 0 || a > last - first || map[a] < 0) continue;
        const b = idx[i + 1] - first;
        const c = idx[i + 2] - first;
        if (b < 0 || c < 0 || b > last - first || c > last - first || map[b] < 0 || map[c] < 0) continue;
        tri.push(map[a], map[b], map[c]);
      }
      geo.setIndex(tri);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, m.material);
      mesh.layers.mask = m.layers.mask;
      mesh.userData.pens = m.userData.pens;
      meshes.push(mesh);
    }
    this.stats.extractMs = Math.max(this.stats.extractMs, performance.now() - t0);
    return { meshes, at: new THREE.Vector3(cx, cy, cz), half: new THREE.Vector3(hx, (y1 - y0) / 2, hz) };
  }

  piece(kind, meshes, at, half, q = null) {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    for (const m of meshes) {
      m.matrixAutoUpdate = false;
      group.add(m);
    }
    this.game.scene.add(group);
    const p = { kind, mass: KIND[kind].mass, group, pos: at.clone(), q: q ? q.clone() : new THREE.Quaternion(), vel: new THREE.Vector3(), ang: new THREE.Vector3(), half, t: 0, rest: true, restT: 0, r: Math.max(half.x, half.z) };
    this.pieces.push(p);
    this.place(p);
    while (this.pieces.length > MAX_PIECES) {
      // (the oldest one lying still goes first)
      const old = this.pieces.find((q) => q.rest && q.kind !== 'cone') || this.pieces[0];
      this.drop(old);
    }
    return p;
  }

  drop(p) {
    this.game.scene.remove(p.group);
    for (const m of p.group.children) {
      // (the cones share one geometry)
      if (m.geometry !== (this.coneTpl && this.coneTpl.geo)) m.geometry.dispose();
    }
    const i = this.pieces.indexOf(p);
    if (i >= 0) this.pieces.splice(i, 1);
  }

  place(p) {
    p.group.matrix.compose(p.pos, p.q, _s);
    p.group.matrixWorldNeedsUpdate = true;
  }

  // ------------------------------------------------------------------ hit by a car
  // (game/vehicles.js collideWorld, before the walls: what flies is no wall)
  sweep(v) {
    const sp = Math.abs(v.speed);
    if (sp < MIN_SPEED || v.flies || v.kind === 'boat' || v.kind === 'plane') return;
    const game = this.game;
    const f = v.fwd;
    const L = (v.halfLen || 2.2) + 0.45;
    const W = (v.halfWid || 1) + 0.4;
    const inside = (x, z, r) => {
      const dx = x - v.pos.x;
      const dz = z - v.pos.z;
      return Math.abs(dx * f.x + dz * f.z) < L + r && Math.abs(dx * f.z - dz * f.x) < W + r;
    };
    for (const o of game.world.objects.within(v.pos.x, v.pos.z, L + 1, this._near)) {
      if (!KIND[o.kind]) continue;
      if (!inside((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, 0.2)) continue;
      this.knock(o, v);
    }
    for (const p of this.pieces) {
      if (p.kickT > game.time || !inside(p.pos.x, p.pos.z, p.r * 0.5)) continue;
      if (p.pos.y - groundHeight(p.pos.x, p.pos.z) > 1.6) continue;
      this.launch(p, v);
      this.stats.kicks++;
      game.audio.play(KIND[p.kind].sound, 0.35);
    }
  }

  knock(o, v) {
    const game = this.game;
    const K = KIND[o.kind];
    const got = this.extract(o);
    // (out of the drawing at once, and its collision with it)
    game.world.objects.remove(o, false);
    if (!got) return;
    const p = this.piece(o.kind, got.meshes, got.at, got.half);
    this.launch(p, v);
    this.stats.knocked++;
    game.audio.play(K.sound, Math.min(1, 0.4 + Math.abs(v.speed) / 25));
    game.fx.crumbs(got.at.x, got.at.y, got.at.z, 8, 2.5);
    // (the car feels it: a bench more than a cone)
    v.speed *= 1 - Math.min(0.25, 0.045 * K.mass);
    if (K.mass > 2 && v.hurt) v.hurt(K.mass * 1.2);
    if (K.spray) this.spray(got.at.x, groundHeight(got.at.x, got.at.z), got.at.z);
  }

  launch(p, v) {
    const s = Math.abs(v.speed);
    const sg = Math.sign(v.speed) || 1;
    const fx = v.fwd.x * sg;
    const fz = v.fwd.z * sg;
    // ahead of the bumper, and off to the side it was on
    const dx = p.pos.x - v.pos.x;
    const dz = p.pos.z - v.pos.z;
    const side = Math.sign(-dx * fz + dz * fx) || (Math.random() < 0.5 ? -1 : 1);
    const k = 1 / Math.sqrt(p.mass);
    const push = s * (1.05 + Math.random() * 0.3) * Math.min(1.3, k);
    const out = s * (0.18 + Math.random() * 0.2) * k;
    p.vel.set(fx * push - fz * side * out, 1.6 + s * 0.22 * k + Math.random() * 1.2, fz * push + fx * side * out);
    p.ang.set((Math.random() - 0.5) * s * 0.9 * k, (Math.random() - 0.5) * 6 * k, (Math.random() - 0.5) * s * 0.9 * k);
    p.rest = false;
    p.restT = 0;
    p.t = 0;
    p.kickT = this.game.time + 0.35;
    p.pos.y += 0.05;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    const col = game.world.collision;
    const cam = game.camera.position;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.t += dt;
      if (!p.rest) {
        p.vel.y -= G * dt;
        p.pos.addScaledVector(p.vel, dt);
        const w = p.ang.length();
        if (w > 1e-4) {
          _axis.copy(p.ang).multiplyScalar(1 / w);
          _q.setFromAxisAngle(_axis, w * dt);
          p.q.premultiply(_q);
        }
        // the walls: off them it bounces
        _p.set(p.pos.x, p.pos.y - p.half.y, p.pos.z);
        const res = col.resolveCylinder(_p, Math.max(0.15, p.r * 0.7), p.half.y * 2, 0.3);
        if (res.hitWall) {
          p.pos.x = _p.x;
          p.pos.z = _p.z;
          const vn = p.vel.x * res.nx + p.vel.z * res.nz;
          if (vn < 0) {
            p.vel.x -= 1.5 * vn * res.nx;
            p.vel.z -= 1.5 * vn * res.nz;
            p.ang.multiplyScalar(0.7);
          }
        }
        // the ground: the lowest corner of its box touches it
        const g = Math.max(groundHeight(p.pos.x, p.pos.z), res.floor > -Infinity && res.floor < p.pos.y ? res.floor : -Infinity);
        const low = this.lowest(p);
        if (p.pos.y + low < g) {
          p.pos.y = g - low;
          if (p.vel.y < -2.2) {
            p.vel.y *= -0.3;
            p.vel.x *= 0.72;
            p.vel.z *= 0.72;
            p.ang.multiplyScalar(0.62);
            if (p.t > 0.15 && Math.random() < 0.7) game.audio.play(p.kind === 'cone' ? 'pop' : 'clang', 0.18);
          } else {
            p.vel.y = Math.max(0, p.vel.y);
            const fr = Math.exp(-5 * dt);
            p.vel.x *= fr;
            p.vel.z *= fr;
            p.ang.multiplyScalar(Math.exp(-4 * dt));
            if (p.vel.lengthSq() < 0.05 && p.ang.lengthSq() < 0.04) {
              p.rest = true;
              p.vel.set(0, 0, 0);
              p.ang.set(0, 0, 0);
            }
          }
        }
        this.place(p);
      } else {
        p.restT += dt;
        // (long still and out of sight, or far behind: gone; a cone waits for its roadblock)
        const d = Math.hypot(p.pos.x - cam.x, p.pos.z - cam.z);
        if (p.kind !== 'cone' && ((p.restT > REST_T && d > 45) || d > 160)) this.drop(p);
        else if (p.kind === 'cone' && p.block && p.block.gone && d > 70) this.drop(p);
      }
    }
    this.updateSprays(dt);
  }

  // the lowest point of a piece's box as it is turned, from its middle
  lowest(p) {
    let low = Infinity;
    for (const c of CORNERS) {
      _v.set(c[0] * p.half.x, c[1] * p.half.y, c[2] * p.half.z).applyQuaternion(p.q);
      if (_v.y < low) low = _v.y;
    }
    return low;
  }

  // ------------------------------------------------------------------ the hydrant's water
  spray(x, y, z) {
    this.sprays.push({ x, y, z, t: 0, hissT: 0 });
    this.stats.sprays++;
    while (this.sprays.length > 4) this.sprays.shift();
  }

  updateSprays(dt) {
    const game = this.game;
    const fx = game.fx;
    const cam = game.camera.position;
    for (let i = this.sprays.length - 1; i >= 0; i--) {
      const s = this.sprays[i];
      s.t += dt;
      if (s.t > SPRAY_T) {
        this.sprays.splice(i, 1);
        continue;
      }
      // (weaker at the end)
      const k = s.t < SPRAY_T - 4 ? 1 : (SPRAY_T - s.t) / 4;
      const d = Math.hypot(s.x - cam.x, s.z - cam.z);
      if (d > 90) continue;
      // the jet: streaks of water going up and falling back, a mist round the top, the splashes
      s.acc = (s.acc || 0) + dt * 75 * k;
      for (; s.acc >= 1; s.acc--) {
        if (fx.particles.length > 420) fx.particles.shift();
        const a = Math.random() * Math.PI * 2;
        const sp = 0.3 + Math.random() * 1.1;
        fx.particles.push({ x: s.x, y: s.y + 0.35, z: s.z, vx: Math.cos(a) * sp, vy: (7.2 + Math.random() * 2.6) * (0.6 + 0.4 * k), vz: Math.sin(a) * sp, life: 1.3 + Math.random() * 0.4, t: 0, len: 0.3 + Math.random() * 0.25, color: Math.random() < 0.6 ? WATER : WATER_DARK, seed: Math.random() * 50, spin: 0, streak: true, wide: 6 });
      }
      if (Math.random() < dt * 7 * k) fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', s.x + (Math.random() - 0.5) * 0.6, s.y + 1.2 + Math.random() * 1.8, s.z + (Math.random() - 0.5) * 0.6, { size: 0.9, grow: 1.5, life: 1.1, vy: 1.2, alpha: 0.5, tint: MIST });
      if (Math.random() < dt * 8 * k) fx.splash(s.x + (Math.random() - 0.5) * 1.8, s.y + 0.05, s.z + (Math.random() - 0.5) * 1.8, 4, 1.8, WATER);
      if ((s.hissT -= dt) <= 0 && d < 40) {
        s.hissT = 0.9;
        game.audio.hiss(1.0, 0.1 * k * Math.max(0.2, 1 - d / 40), 2600, 0.7);
      }
    }
  }

  // the jet's core: a few wavy strokes of water straight up from the broken pipe
  draw(fr) {
    const t = this.game.time;
    for (const s of this.sprays) {
      const k = s.t < SPRAY_T - 4 ? 1 : Math.max(0, (SPRAY_T - s.t) / 4);
      if (k <= 0) continue;
      const top = s.y + 0.3 + 2.9 * k;
      for (let j = 0; j < 4; j++) {
        let px = s.x;
        let py = s.y + 0.3;
        let pz = s.z;
        for (let i = 1; i <= 6; i++) {
          const y = s.y + 0.3 + ((top - s.y - 0.3) * i) / 6;
          const w = 0.03 + 0.05 * (i / 6);
          const nx = s.x + Math.sin(t * 9 + i * 1.7 + j * 2.1) * w;
          const nz = s.z + Math.cos(t * 8 + i * 1.3 + j * 1.6) * w;
          fr.lineXYZ(px, py, pz, nx, y, nz, j % 2 ? WATER : WATER_DARK, 6.5 - j, 7700 + j * 7 + i, 0.85, 0.01, 0);
          px = nx;
          py = y;
          pz = nz;
        }
      }
    }
  }

  // ------------------------------------------------------------------ the shop windows
  // the pane (still whole) at a point on a shop front
  paneAt(x, y, z) {
    const G = this.game.world.glass;
    if (!G) return null;
    const objs = this.game.world.objects.list;
    for (const p of G) {
      if (Math.abs(p.x - x) > 9 || Math.abs(p.z - z) > 9) continue;
      const o = objs[p.id];
      if (!o || o.state !== 'here') continue;
      const u = p.f.toU(x, z);
      const w = p.f.toW(x, z);
      if (u < p.u0 - 0.25 || u > p.u1 + 0.25 || y < p.y0 - 0.3 || y > p.y1 + 0.2 || Math.abs(w) > 0.8) continue;
      return p;
    }
    return null;
  }

  glassHit(x, y, z) {
    const p = this.paneAt(x, y, z);
    return p ? this.shatter(p) : false;
  }

  // a blast: every pane round it
  blast(x, y, z, r) {
    const G = this.game.world.glass;
    if (!G) return;
    const objs = this.game.world.objects.list;
    for (const p of G) {
      if (Math.hypot(p.x - x, p.z - z) > r) continue;
      const o = objs[p.id];
      if (o && o.state === 'here') this.shatter(p);
    }
  }

  shatter(p) {
    const game = this.game;
    const o = game.world.objects.list[p.id];
    if (!o || o.state !== 'here') return false;
    game.world.objects.remove(o, false);
    // the glass, out of the frame and down onto the sidewalk
    const fx = game.fx;
    const f = p.f;
    for (let i = 0; i < 64; i++) {
      if (fx.particles.length > 420) fx.particles.shift();
      const u = p.u0 + Math.random() * (p.u1 - p.u0);
      const y = p.y0 + 0.15 + Math.random() * (p.y1 - p.y0 - 0.3);
      const at = f.p(u, y, 0.12);
      const out = 0.4 + Math.random() * 2.6;
      const r = Math.random();
      fx.particles.push({ x: at[0], y, z: at[2], vx: f.nx * out + (Math.random() - 0.5) * 1.4, vy: Math.random() * 1.8, vz: f.nz * out + (Math.random() - 0.5) * 1.4, life: 0.8 + Math.random() * 0.8, t: 0, len: 0.1 + Math.random() * 0.15, color: r < 0.4 ? GLASS_EDGE : r < 0.7 ? GLASS : GLASS_HI, seed: Math.random() * 50, spin: Math.random() * 12 });
    }
    const mid = f.p((p.u0 + p.u1) / 2, 1.9, 0.15);
    fx.sprite('fx_impact', mid[0], mid[1], mid[2], { size: 1.4, grow: 0.9, life: 0.22 });
    const cam = game.camera.position;
    const d = Math.hypot(p.x - cam.x, p.z - cam.z);
    if (d < 70) game.audio.play('glass', Math.max(0.25, 1 - d / 70));
    this.stats.panes++;
    // (whoever is near jumps; a broken window is vandalism)
    game.civilians.panic(new THREE.Vector3(p.x, 0, p.z), 10);
    if (game.onCrime) game.onCrime('vandal', p.x, p.z);
    return true;
  }

  // ------------------------------------------------------------------ the roadblocks' cones
  cone(x, z, block) {
    const T = this.coneTpl || (this.coneTpl = this.makeCone());
    if (!T) return null;
    const meshes = T.parts.map((m) => {
      const c = new THREE.Mesh(m.geometry, m.material);
      c.layers.mask = m.layers.mask;
      return c;
    });
    const p = this.piece('cone', meshes, new THREE.Vector3(x, groundHeight(x, z) + T.half.y, z), T.half.clone());
    p.block = block;
    this.stats.cones++;
    return p;
  }

  // a cone drawn with the props' own pen, once (the pen the city's batches draw it with):
  // orange, a white band, a black foot
  makeCone() {
    const M = cityMaterials();
    let src = null;
    for (const m of this.cityMeshes()) {
      if (m.userData.pens && m.userData.pens.includes(M.propCyl)) {
        src = m;
        break;
      }
    }
    if (!src) return null;
    const B = new Batch();
    const add = (geo, y, col) => {
      geo.translate(0, y - 0.33, 0);
      B.add(M.propCyl, geo, null, nextId(), { color: col, chunk: 'cone' });
    };
    add(new THREE.CylinderGeometry(0.035, 0.17, 0.62, 12), 0.35, srgb(1.0, 0.36, 0.06));
    add(new THREE.CylinderGeometry(0.106, 0.126, 0.11, 12), 0.38, srgb(0.96, 0.96, 0.94));
    add(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0.02, srgb(0.12, 0.12, 0.14));
    const parts = B.flush(new THREE.Group(), { merge: (mat) => (mat === M.propCyl ? src.material : null) });
    for (const m of parts) m.layers.mask = src.layers.mask;
    return { parts, geo: parts[0] ? parts[0].geometry : null, half: new THREE.Vector3(0.21, 0.33, 0.21) };
  }
}
