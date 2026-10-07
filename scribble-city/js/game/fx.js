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
  splatAt(x, y, z, nx, ny, nz, size, tint) {
    const n = new THREE.Vector3(nx, ny, nz);
    if (n.lengthSq() < 0.5) n.set(0, 1, 0);
    let axis;
    if (Math.abs(n.y) > 0.7) axis = new THREE.Vector3(1, 0, 0);
    else axis = new THREE.Vector3(-n.z, 0, n.x).normalize();
    const up = new THREE.Vector3().crossVectors(n, axis).normalize();
    this.decal(Math.random() < 0.5 ? 'splat0' : 'splat1', x + n.x * 0.03, y + n.y * 0.03, z + n.z * 0.03, size, tint, 0.92, [axis.x, axis.y, axis.z], [up.x, up.y, up.z]);
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
    const keep = [];
    for (const s of this.list) {
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
      sb.add({ x: s.x, y: s.y, z: s.z, w: size * s.aspect, h: size, rect: s.rect, tint: [s.tint[0], s.tint[1], s.tint[2], a], pivot: s.pivot });
    }
    this.list = keep;
    for (const m of this.marks) {
      if (!m.visible) continue;
      sb.add({ x: m.x, y: m.y, z: m.z, w: m.size, h: m.size, rect: this.atlas.rects[m.rect], tint: [1, 1, 1, m.alpha === undefined ? 1 : m.alpha], pivot: [0.5, 0.5] });
    }
    sb.commit();
    if (this.decalsDirty) {
      this.decals.commit();
      this.decalsDirty = false;
    }
    // particles
    const ps = [];
    for (const p of this.particles) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy -= 14 * dt;
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
        figures.lineXYZ(p.x, p.y, p.z, p.x - (p.vx / l) * p.len, p.y - (p.vy / l) * p.len, p.z - (p.vz / l) * p.len, p.color, 1.6, p.seed, fade, 0.01, 0);
      } else {
        const a = p.spin + p.t * 8;
        const dx = Math.cos(a) * p.len;
        const dz = Math.sin(a) * p.len;
        figures.lineXYZ(p.x - dx, p.y, p.z - dz, p.x + dx, p.y + p.len * 0.6, p.z + dz, p.color, 3.2, p.seed, fade, 0.2, 0.01);
      }
    }
    this.particles = ps;
  }
}

export { RED_INK };
