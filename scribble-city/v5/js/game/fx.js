import * as THREE from 'three';
import { SpriteBatch } from '../render/SpriteBatch.js';
import { RED_INK } from '../render/LineBatch.js';

const CRUMB_COLORS = [[0.86, 0.55, 0.62], [0.75, 0.42, 0.5], [0.55, 0.55, 0.6]];

/**
 * Visual effects: billboard sprites (impacts, explosions, smoke, marks), surface decals
 * (paint splats, eraser smudges) and little line particles (eraser crumbs, debris, sparks).
 */
export class Effects {
  constructor(game) {
    this.game = game;
    const atlas = game.atlas;
    this.atlas = atlas;
    this.sprites = new SpriteBatch(220, atlas.texture, { dynamic: true, transparent: true });
    this.sprites.mesh.renderOrder = 30;
    game.scene.add(this.sprites.mesh);
    this.decals = new SpriteBatch(180, atlas.texture, { dynamic: true, transparent: true, polygonOffset: true });
    this.decals.mesh.renderOrder = 5;
    game.scene.add(this.decals.mesh);
    this.list = [];
    this.decalList = [];
    this.decalCursor = 0;
    this.particles = [];
    this.marks = []; // persistent markers (eyes over hiding spots, "!" over enemies)
    // (ROADMAP 11.43) rings drawn round a blast, growing out from it
    this.rings = [];
  }

  sprite(rect, x, y, z, o = {}) {
    if (this.list.length > 200) this.list.shift();
    const s = {
      rect: this.atlas.rects[rect],
      x, y, z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      size: o.size || 1,
      grow: o.grow !== undefined ? o.grow : 0.6,
      life: o.life || 0.5,
      t: 0,
      tint: o.tint || [1, 1, 1],
      alpha: o.alpha !== undefined ? o.alpha : 1,
      gravity: o.gravity || 0,
      aspect: o.aspect || 1,
      fadeIn: o.fadeIn || 0,
      pivot: o.pivot || [0.5, 0.5],
    };
    this.list.push(s);
    return s;
  }

  impact(x, y, z, scale = 1) {
    this.sprite('fx_impact', x, y, z, { size: 0.9 * scale, grow: 0.8, life: 0.22 });
  }

  muzzle(x, y, z, scale = 1) {
    this.sprite('muzzle', x, y, z, { size: 0.55 * scale, grow: 0.4, life: 0.08 });
  }

  boom(x, y, z, radius) {
    this.sprite('fx_boom', x, y + radius * 0.3, z, { size: radius * 1.4, grow: 0.9, life: 0.55 });
    if (this.game.ambient) this.game.ambient.scare({ x, z }, radius * 6 + 10);
    for (let i = 0; i < 6; i++) {
      this.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + (Math.random() - 0.5) * radius, y + Math.random() * radius * 0.6, z + (Math.random() - 0.5) * radius, {
        size: radius * (0.5 + Math.random() * 0.5), grow: 1.2, life: 1.4 + Math.random(), vy: 1.2, alpha: 0.85,
      });
    }
    this.crumbs(x, y + 0.5, z, 40, radius * 1.4, true);
    this.decal('splat1', x, 0.17, z, radius * 1.3, [0.55, 0.55, 0.6], 0.55, [1, 0, 0], [0, 0, -1]);
  }

  smoke(x, y, z, size = 1.4) {
    this.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x, y, z, { size, grow: 1.1, life: 1.2, vy: 0.9, alpha: 0.8 });
  }

  mark(rect, x, y, z, size = 0.7, life = 1) {
    return this.sprite(rect, x, y, z, { size, grow: 0.15, life, fadeIn: 0.1 });
  }

  // flat decal on a surface with normal n (right & up give the orientation)
  decal(rect, x, y, z, size, tint, alpha, axis, up) {
    const i = this.decalCursor % this.decals.capacity;
    this.decalCursor++;
    const rot = Math.random() * Math.PI * 2;
    // rotate axis/up around their normal for variety
    const ax = new THREE.Vector3(...axis);
    const uv = new THREE.Vector3(...up);
    const nrm = new THREE.Vector3().crossVectors(ax, uv).normalize();
    ax.applyAxisAngle(nrm, rot);
    uv.applyAxisAngle(nrm, rot);
    const o = { x, y, z, w: size, h: size, rect: this.atlas.rects[rect], tint: [tint[0], tint[1], tint[2], alpha], axis: [ax.x, ax.y, ax.z], up: [uv.x, uv.y, uv.z], pivot: [0.5, 0.5] };
    if (i >= this.decals.count) this.decals.add(o);
    else this.decals.set(i, o);
    this.decalsDirty = true;
  }

  // splat on whichever surface a projectile hit (normal from the ray cast)
  splatAt(x, y, z, nx, ny, nz, size, tint, rect = null) {
    const n = new THREE.Vector3(nx, ny, nz);
    if (n.lengthSq() < 0.5) n.set(0, 1, 0);
    let axis;
    if (Math.abs(n.y) > 0.7) axis = new THREE.Vector3(1, 0, 0);
    else axis = new THREE.Vector3(-n.z, 0, n.x).normalize();
    const up = new THREE.Vector3().crossVectors(n, axis).normalize();
    this.decal(rect || (Math.random() < 0.5 ? 'splat0' : 'splat1'), x + n.x * 0.03, y + n.y * 0.03, z + n.z * 0.03, size, tint, 0.92, [axis.x, axis.y, axis.z], [up.x, up.y, up.z]);
  }

  // eraser crumbs & debris (line particles)
  crumbs(x, y, z, n = 10, speed = 3, dark = false) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 420) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, z,
        vx: Math.cos(a) * sp * (1 - up * 0.5), vy: 1.5 + up * sp, vz: Math.sin(a) * sp * (1 - up * 0.5),
        life: 0.8 + Math.random() * 0.9, t: 0,
        len: 0.05 + Math.random() * 0.08,
        color: dark ? [0.25, 0.25, 0.3] : CRUMB_COLORS[Math.floor(Math.random() * CRUMB_COLORS.length)],
        seed: Math.random() * 50,
        spin: Math.random() * 10,
      });
    }
  }

  // bits of coloured paper fluttering down (the paper planes go off in confetti)
  confetti(x, y, z, n = 30, speed = 5) {
    const COLS = [[0.95, 0.3, 0.35], [0.98, 0.78, 0.2], [0.3, 0.6, 0.95], [0.4, 0.82, 0.45], [0.86, 0.45, 0.9], [0.98, 0.97, 0.93]];
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 420) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.8);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * sp, vy: 2 + Math.random() * speed, vz: Math.sin(a) * sp,
        life: 1.6 + Math.random() * 1.4, t: 0, len: 0.06 + Math.random() * 0.05,
        color: COLS[Math.floor(Math.random() * COLS.length)], seed: Math.random() * 50, spin: Math.random() * 10, flutter: true,
      });
    }
  }

  // drops of something wet thrown up and out (correction fluid, paint)
  splash(x, y, z, n = 20, speed = 4, color = [1, 1, 0.98]) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 420) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const sp = speed * (0.35 + Math.random() * 0.8);
      this.particles.push({
        x, y, z,
        vx: Math.cos(a) * sp * (1 - up * 0.4), vy: 2 + up * sp * 0.9, vz: Math.sin(a) * sp * (1 - up * 0.4),
        life: 0.6 + Math.random() * 0.7, t: 0, len: 0.08 + Math.random() * 0.1,
        color, seed: Math.random() * 50, spin: 0, streak: true, wide: 4,
      });
    }
  }

  // (ROADMAP 11.43) drops, bits or flakes thrown one way - out of a muzzle, off what was hit - in a
  // cone round (dx, dy, dz). color: one, or a list to pick from. o: { cone (its half-width),
  // len, wide, life, grav: false (straight on: a mist), bits (tumbling bits, not streaks),
  // flutter (paper) }
  spray(x, y, z, dx, dy, dz, n, speed, color, o = {}) {
    const cone = o.cone === undefined ? 0.3 : o.cone;
    const cols = Array.isArray(color[0]) ? color : null;
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 420) this.particles.shift();
      const sp = speed * (0.5 + Math.random() * 0.7);
      const vx = dx + (Math.random() - 0.5) * cone * 2;
      const vy = dy + (Math.random() - 0.5) * cone * 2;
      const vz = dz + (Math.random() - 0.5) * cone * 2;
      const l = Math.hypot(vx, vy, vz) || 1;
      this.particles.push({
        x, y, z, vx: (vx / l) * sp, vy: (vy / l) * sp, vz: (vz / l) * sp,
        life: (o.life || 0.45) * (0.7 + Math.random() * 0.6), t: 0, len: (o.len || 0.12) * (0.6 + Math.random() * 0.8),
        color: cols ? cols[Math.floor(Math.random() * cols.length)] : color, seed: Math.random() * 50, spin: Math.random() * 10,
        streak: !o.bits && !o.flutter, wide: o.wide || 3, noGrav: o.grav === false, drag: o.grav === false ? 4 : 0, flutter: !!o.flutter,
      });
    }
  }

  // (ROADMAP 11.43) lines shooting out of a blast every way, the way a comic draws one
  // (life: how long the lines last - a firework's longer, game/festival.js)
  burst(x, y, z, n, speed, color, len = 0.9, life = 0.4) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 420) this.particles.shift();
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const b = (Math.random() - 0.3) * 0.9;
      const sp = speed * (0.7 + Math.random() * 0.5);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp, vz: Math.sin(a) * Math.cos(b) * sp,
        life: life + Math.random() * 0.15, t: 0, len: len * (0.7 + Math.random() * 0.6), color, seed: Math.random() * 50, spin: 0,
        streak: true, wide: 5, noGrav: true, drag: 2.5,
      });
    }
  }

  // (ROADMAP 11.43) a ring on the ground round a blast, from r0 out to r1 as it fades (life: s)
  ring(x, y, z, r0, r1, life, color, width = 4) {
    if (this.rings.length > 8) this.rings.shift();
    this.rings.push({ x, y, z, r0, r1, life, t: 0, color, width, seed: Math.random() * 50 });
  }

  // (ROADMAP 11.43) the moment it goes off: a light brighter than the page
  flash(x, y, z, size, tint = [1.7, 1.7, 1.6]) {
    this.sprite('fx_impact', x, y, z, { size, grow: 0.5, life: 0.14, tint });
  }

  sparks(x, y, z, n = 6, color = [0.1, 0.1, 0.14]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * 1.2 - 0.2;
      const sp = 3 + Math.random() * 4;
      this.particles.push({ x, y, z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp, vz: Math.sin(a) * Math.cos(b) * sp, life: 0.25 + Math.random() * 0.2, t: 0, len: 0.25, color, seed: Math.random() * 50, spin: 0, streak: true });
    }
  }

  update(dt, figures) {
    // sprites
    const sb = this.sprites;
    sb.count = 0;
    // (two lists in turn, and one sprite description filled for each: nothing new every frame)
    const keep = this._keep || (this._keep = []);
    keep.length = 0;
    const list = this.list;
    const o = _spr;
    for (let si = 0; si < list.length; si++) {
      const s = list[si];
      s.t += dt;
      if (s.t >= s.life) continue;
      keep.push(s);
      s.vy -= s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const k = s.t / s.life;
      const size = s.size * (1 + s.grow * k);
      let a = s.alpha * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      if (s.fadeIn > 0 && s.t < s.fadeIn) a *= s.t / s.fadeIn;
      o.x = s.x;
      o.y = s.y;
      o.z = s.z;
      o.w = size * s.aspect;
      o.h = size;
      o.rect = s.rect;
      o.tint[0] = s.tint[0];
      o.tint[1] = s.tint[1];
      o.tint[2] = s.tint[2];
      o.tint[3] = a;
      o.pivot = s.pivot;
      sb.add(o);
    }
    this._keep = list;
    this.list = keep;
    const marks = this.marks;
    for (let mi = 0; mi < marks.length; mi++) {
      const m = marks[mi];
      if (!m.visible) continue;
      o.x = m.x;
      o.y = m.y;
      o.z = m.z;
      o.w = m.size;
      o.h = m.size;
      o.rect = this.atlas.rects[m.rect];
      o.tint[0] = 1;
      o.tint[1] = 1;
      o.tint[2] = 1;
      o.tint[3] = m.alpha === undefined ? 1 : m.alpha;
      o.pivot = PIVOT_MID;
      sb.add(o);
    }
    sb.commit();
    if (this.decalsDirty) {
      this.decals.commit();
      this.decalsDirty = false;
    }
    // particles
    const ps = this._ps || (this._ps = []);
    ps.length = 0;
    const parts = this.particles;
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      p.t += dt;
      if (p.t >= p.life) continue;
      if (p.flutter) {
        // paper drifts: air holds it up, it rocks from side to side
        p.vy -= 4 * dt;
        p.vy = Math.max(p.vy, -1.1);
        p.vx *= Math.exp(-2.5 * dt);
        p.vz *= Math.exp(-2.5 * dt);
        p.x += Math.sin(p.t * 6 + p.seed) * 0.8 * dt;
      } else if (!p.noGrav) p.vy -= 14 * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.17) {
        p.y = 0.17;
        p.vy *= -0.25;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      ps.push(p);
      const fade = 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
      if (p.streak) {
        const l = Math.hypot(p.vx, p.vy, p.vz) || 1;
        figures.lineXYZ(p.x, p.y, p.z, p.x - (p.vx / l) * p.len, p.y - (p.vy / l) * p.len, p.z - (p.vz / l) * p.len, p.color, p.wide || 1.6, p.seed, fade, 0.01, 0);
      } else {
        const a = p.spin + p.t * 8;
        const dx = Math.cos(a) * p.len;
        const dz = Math.sin(a) * p.len;
        figures.lineXYZ(p.x - dx, p.y, p.z - dz, p.x + dx, p.y + p.len * 0.6, p.z + dz, p.color, 3.2, p.seed, fade, 0.2, 0.01);
      }
    }
    this._ps = parts;
    this.particles = ps;
    // (ROADMAP 11.43) the rings round a blast: drawn in pieces round, growing out fast and then
    // slower, thinner and paler as they go
    const rings = this.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      const R = rings[i];
      R.t += dt;
      if (R.t >= R.life) {
        rings.splice(i, 1);
        continue;
      }
      const k = R.t / R.life;
      const r = R.r0 + (R.r1 - R.r0) * (1 - (1 - k) * (1 - k));
      const N = 24;
      for (let j = 0; j < N; j++) {
        const a0 = (j / N) * Math.PI * 2;
        const a1 = ((j + 1.15) / N) * Math.PI * 2;
        figures.lineXYZ(R.x + Math.cos(a0) * r, R.y, R.z + Math.sin(a0) * r, R.x + Math.cos(a1) * r, R.y, R.z + Math.sin(a1) * r, R.color, R.width * (1 - k * 0.6), R.seed + j, 1 - k, 0.04, 0);
      }
    }
  }
}

// the one sprite description the sprites and marks are filled into in turn
const _spr = { x: 0, y: 0, z: 0, w: 0, h: 0, rect: null, tint: [1, 1, 1, 1], pivot: null };
const PIVOT_MID = [0.5, 0.5];

export { RED_INK };
