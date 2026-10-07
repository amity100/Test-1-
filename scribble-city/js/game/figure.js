import * as THREE from 'three';
import { LineBatch, BLACK_INK, INK } from '../render/LineBatch.js';
import { makeLineMaterial, makeSpriteMaterial, getSpriteGeometry } from '../render/materials.js';
import { BodyBatch } from '../render/bodies.js';


/**
 * Shared renderer for all stick figures: one dynamic line batch for limbs,
 * plus per-figure billboard sprites (heads, torsos, monster bodies).
 */
export class FigureRenderer {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.mat = makeLineMaterial({ nudge: 0.0012, minWidth: 1.0 });
    this.batch = new LineBatch(9000, this.mat, { dynamic: true });
    this.batch.mesh.renderOrder = 15;
    scene.add(this.batch.mesh);
    this.bodies = new BodyBatch(7000);
    scene.add(this.bodies.mesh);
    this.camPos = new THREE.Vector3();
  }

  begin(camera) {
    this.batch.clear();
    this.bodies.begin(camera, window.innerHeight);
    this.camPos.copy(camera.position);
  }

  line(a, b, color, width, seed, alpha = 1, wobble = 0.02) {
    this.batch.push(a.x, a.y, a.z, b.x, b.y, b.z, color[0], color[1], color[2], alpha, width, seed, 0.03, wobble);
  }

  lineXYZ(ax, ay, az, bx, by, bz, color, width, seed, alpha = 1, wobble = 0.02, overshoot = 0.03) {
    this.batch.push(ax, ay, az, bx, by, bz, color[0], color[1], color[2], alpha, width, seed, overshoot, wobble);
  }

  end() {
    this.batch.commit();
    this.bodies.end();
  }

  makeSprite(rectName, w, h, pivotX = 0.5, pivotY = 0.5) {
    const m = makeSpriteMaterial(this.atlas.texture);
    m.uniforms.uRect.value.set(...this.atlas.rects[rectName]);
    m.uniforms.uSize.value.set(w, h);
    m.uniforms.uPivot.value.set(pivotX, pivotY);
    const mesh = new THREE.Mesh(getSpriteGeometry(), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 14;
    this.scene.add(mesh);
    return mesh;
  }

  setRect(mesh, rectName) {
    mesh.material.uniforms.uRect.value.set(...this.atlas.rects[rectName]);
  }

  // Scribbled contact shadow on the ground.
  shadow(x, y, z, r, seed, alpha = 0.45) {
    const c = INK;
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 2;
      const hw = r * Math.sqrt(Math.max(0, 1 - t * t)) * 0.95;
      this.batch.push(x - hw, y + 0.03, z + t * r * 0.55, x + hw, y + 0.03, z + t * r * 0.55 + 0.05, c[0], c[1], c[2], alpha * 0.8, 1.3, seed + i, 0.02, 0.02);
    }
  }
}

/**
 * Scribble monster rig: a big billboard body with ink legs and claws.
 */
export class MonsterFigure {
  constructor(fr, type, o = {}) {
    this.fr = fr;
    this.type = type;
    this.seed = o.seed || Math.random() * 100;
    const cfg = {
      scrib: { w: 1.9, h: 1.75, cy: 1.05, legs: 3, legLen: 0.75, armLen: 0.9, rect: 'mon_scrib' },
      stalk: { w: 1.25, h: 2.3, cy: 1.85, legs: 1, legLen: 1.0, armLen: 1.4, rect: 'mon_stalk' },
      spike: { w: 1.7, h: 1.65, cy: 1.0, legs: 2, legLen: 0.6, armLen: 0.8, rect: 'mon_spike' },
    }[type];
    this.cfg = cfg;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.phase = Math.random() * 10;
    this.attack = -1;
    this.dead = 0;
    this.visible = true;
    this.body = fr.makeSprite(`${cfg.rect}_front`, cfg.w, cfg.h, 0.5, 0.5);
    this.view = 'front';
    this.holes = 0;
    this.color = BLACK_INK;
    this.center = new THREE.Vector3();
  }

  dispose() {
    this.fr.scene.remove(this.body);
    this.body.material.dispose();
  }

  setVisible(v) {
    this.visible = v;
    this.body.visible = v;
  }

  addHole(u, v, r) {
    const holes = this.body.material.uniforms.uHoles.value;
    const h = holes[this.holes % holes.length];
    h.set(u, v, r, 1);
    this.holes++;
  }

  update(dt) {
    this.phase += dt * (2 + this.speed * 2.2);
  }

  draw(camPos) {
    if (!this.visible) return;
    const fr = this.fr;
    const cfg = this.cfg;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const bob = Math.sin(this.phase * 2) * 0.06;
    const sink = this.dead * cfg.cy * 0.6;
    const cy = this.pos.y + cfg.cy + bob - sink;
    this.center.set(this.pos.x, cy, this.pos.z);
    this.body.position.copy(this.center);
    const dx = camPos.x - this.pos.x;
    const dz = camPos.z - this.pos.z;
    let d = Math.atan2(dx, dz) - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const view = Math.abs(d) > 2.0 ? 'back' : 'front';
    if (view !== this.view) {
      this.view = view;
      fr.setRect(this.body, `${cfg.rect}_${view}`);
    }
    const c = this.color;
    const alpha = 1 - this.dead;
    const s = this.seed;
    // legs
    const n = cfg.legs;
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        const ph = this.phase + i * 2.1 + (side > 0 ? Math.PI : 0);
        const off = (i - (n - 1) / 2) * 0.45;
        const hx = this.pos.x + r.x * side * cfg.w * 0.28 + f.x * off;
        const hz = this.pos.z + r.z * side * cfg.w * 0.28 + f.z * off;
        const hy = cy - cfg.h * 0.3;
        const step = Math.sin(ph) * 0.3 * Math.min(1, this.speed / 3 + 0.2);
        const lift = Math.max(0, Math.cos(ph)) * 0.25 * Math.min(1, this.speed / 3);
        const kx = hx + r.x * side * 0.35 + f.x * step * 0.5;
        const kz = hz + r.z * side * 0.35 + f.z * step * 0.5;
        const ky = hy - cfg.legLen * 0.4 + lift;
        const fx = hx + r.x * side * 0.45 + f.x * step;
        const fz = hz + r.z * side * 0.45 + f.z * step;
        fr.lineXYZ(hx, hy, hz, kx, ky, kz, c, 3.4, s + i * 7 + side, alpha, 0.05);
        fr.lineXYZ(kx, ky, kz, fx, this.pos.y + 0.03 + lift * 0.3, fz, c, 3.0, s + i * 7 + side + 3, alpha, 0.05);
      }
    }
    // claws
    for (const side of [-1, 1]) {
      const reach = this.attack >= 0 ? Math.sin(Math.min(1, this.attack) * Math.PI) : 0;
      const sx = this.pos.x + r.x * side * cfg.w * 0.42;
      const sz = this.pos.z + r.z * side * cfg.w * 0.42;
      const sy = cy - cfg.h * 0.05;
      const sw = Math.sin(this.phase + (side > 0 ? 0 : Math.PI)) * 0.2;
      const ex = sx + r.x * side * 0.3 + f.x * (0.35 + sw + reach * 0.5);
      const ez = sz + r.z * side * 0.3 + f.z * (0.35 + sw + reach * 0.5);
      const ey = sy - cfg.armLen * 0.35 + reach * 0.3;
      const hx = ex + f.x * (cfg.armLen * 0.5 + reach * 0.6);
      const hz = ez + f.z * (cfg.armLen * 0.5 + reach * 0.6);
      const hy = ey - cfg.armLen * 0.3 + reach * 0.35;
      fr.lineXYZ(sx, sy, sz, ex, ey, ez, c, 3.2, s + 40 + side, alpha, 0.06);
      fr.lineXYZ(ex, ey, ez, hx, hy, hz, c, 2.8, s + 42 + side, alpha, 0.06);
      for (let k = -1; k <= 1; k++) {
        fr.lineXYZ(hx, hy, hz, hx + f.x * 0.22 + r.x * k * 0.1, hy - 0.08 + k * 0.05, hz + f.z * 0.22 + r.z * k * 0.1, c, 2.0, s + 50 + k, alpha, 0.04, 0.01);
      }
    }
    fr.shadow(this.pos.x, this.pos.y, this.pos.z, cfg.w * 0.5, s, 0.4 * alpha);
    this.body.material.uniforms.uErase.value = this.dead;
  }
}
