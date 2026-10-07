import * as THREE from 'three';
import { LineBatch, BLACK_INK, INK } from '../render/LineBatch.js';
import { makeLineMaterial, makeSpriteMaterial, getSpriteGeometry } from '../render/materials.js';
import { clamp, lerp, hash1 } from '../core/util.js';

const _v = new THREE.Vector3();

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
    this.camPos = new THREE.Vector3();
  }

  begin(camera) {
    this.batch.clear();
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

// Two-bone IK in 3D: returns the elbow/knee position.
function ik(root, target, l1, l2, pole, out) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const dz = target.z - root.z;
  let d = Math.hypot(dx, dy, dz);
  const maxD = (l1 + l2) * 0.999;
  if (d > maxD) d = maxD;
  if (d < 1e-4) {
    out.copy(root).addScaledVector(pole, l1);
    return out;
  }
  const ux = dx / Math.hypot(dx, dy, dz);
  const uy = dy / Math.hypot(dx, dy, dz);
  const uz = dz / Math.hypot(dx, dy, dz);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // pole projected perpendicular to the root->target axis
  const pd = pole.x * ux + pole.y * uy + pole.z * uz;
  let px = pole.x - ux * pd;
  let py = pole.y - uy * pd;
  let pz = pole.z - uz * pd;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  out.set(root.x + ux * a + px * h, root.y + uy * a + py * h, root.z + uz * a + pz * h);
  return out;
}

const HEAD_SETS = {
  hero: 'head_hero',
  thug: 'head_thug',
  mask: 'head_mask',
  brute: 'head_brute',
  civ0: 'head_civ0',
  civ1: 'head_civ1',
  civ2: 'head_civ2',
};

/**
 * A stick figure: procedural walk / run / jump / aim / melee / sit-and-draw / crawl / dead poses.
 * Body parts can be erased one by one (head, armL, armR, legs, torso).
 */
export class Figure {
  constructor(fr, o = {}) {
    this.fr = fr;
    this.head = o.head || 'hero';
    this.torsoRect = o.torso || null;
    this.scale = o.scale || 1;
    this.color = o.color || BLACK_INK;
    this.width = o.width || 3.2;
    this.seed = o.seed || Math.random() * 100;
    this.bulk = o.bulk || 1;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.phase = 0;
    this.air = false;
    this.aim = 0; // 0 none, 1 one hand, 2 two hands
    this.aimPitch = 0;
    this.melee = -1;
    this.sit = 0;
    this.dead = 0;
    this.crawl = 0;
    this.stagger = 0;
    this.armsUp = 0;
    this.visible = true;
    this.parts = { head: 1, torso: 1, armL: 1, armR: 1, legs: 1 };
    this.j = {};
    for (const k of ['hip', 'neck', 'headC', 'shoulder', 'elbowL', 'elbowR', 'handL', 'handR', 'kneeL', 'kneeR', 'footL', 'footR', 'hipL', 'hipR']) this.j[k] = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(-1, 0, 0);
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.headSprite = fr.makeSprite(`${HEAD_SETS[this.head]}_front`, 0.5 * this.scale * (o.headScale || 1), 0.5 * this.scale * (o.headScale || 1));
    this.headSprite.material.uniforms.uTint.value.setRGB(...(o.headTint || [1, 1, 1]));
    this.torsoSprite = null;
    if (this.torsoRect) {
      this.torsoSprite = fr.makeSprite(this.torsoRect, 0.62 * this.scale * this.bulk, 0.66 * this.scale, 0.5, 1.0);
      this.torsoSprite.material.uniforms.uTint.value.setRGB(...(o.tint || [1, 1, 1]));
    }
    this.headView = '';
  }

  dispose() {
    for (const s of [this.headSprite, this.torsoSprite]) {
      if (!s) continue;
      this.fr.scene.remove(s);
      s.material.dispose();
    }
  }

  setVisible(v) {
    this.visible = v;
    this.headSprite.visible = v && this.parts.head > 0.01;
    if (this.torsoSprite) this.torsoSprite.visible = v && this.parts.torso > 0.01;
  }

  // local (x right, y up, z forward) -> world
  toWorld(x, y, z, out) {
    const s = this.scale;
    out.set(this.pos.x + (this.right.x * x + this.forward.x * z) * s, this.pos.y + y * s, this.pos.z + (this.right.z * x + this.forward.z * z) * s);
    return out;
  }

  update(dt) {
    const f = this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.right.set(-f.z, 0, f.x);
    const sp = this.speed;
    const stride = sp > 5.5 ? 2.3 : 1.5;
    this.phase += (sp * dt * Math.PI * 2) / stride;
    const A = clamp(sp / 7.5, 0, 1);
    const ph = this.phase;
    const j = this.j;
    const sit = this.sit;
    const dead = this.dead;
    const crawl = this.crawl;

    // hips & spine
    let hipY = 0.93 - Math.abs(Math.sin(ph)) * 0.05 * A + Math.sin(ph * 2) * 0.01;
    hipY = lerp(hipY, 0.38, sit);
    hipY = lerp(hipY, 0.25, crawl);
    const lean = A * 0.12 + (this.aim ? 0.04 : 0) + crawl * 1.2 + sit * 0.12;
    const leanSide = this.stagger * Math.sin(ph * 1.3) * 0.15;
    this.toWorld(0, hipY, 0, j.hip);
    const spine = 0.5;
    const nx = leanSide;
    const ny = hipY + spine * Math.cos(lean);
    const nz = spine * Math.sin(lean);
    this.toWorld(nx, ny, nz, j.neck);
    this.toWorld(nx * 1.2, ny + 0.22 * Math.cos(lean), nz + 0.22 * Math.sin(lean), j.headC);
    this.toWorld(nx, ny - 0.06, nz, j.shoulder);
    this.toWorld(0.08 * this.bulk, hipY, 0, j.hipR);
    this.toWorld(-0.08 * this.bulk, hipY, 0, j.hipL);

    // legs
    const legL = 0.47;
    const legs = [
      [j.hipR, j.kneeR, j.footR, 0],
      [j.hipL, j.kneeL, j.footL, Math.PI],
    ];
    for (const [hipJ, knee, foot, off] of legs) {
      const side = off === 0 ? 1 : -1;
      let th = Math.sin(ph + off) * (0.18 + 0.62 * A);
      let kb = Math.max(0, Math.sin(ph + off - Math.PI * 0.5)) * (0.25 + 0.9 * A) + 0.05;
      if (this.air) {
        th = off === 0 ? 0.55 : -0.25;
        kb = off === 0 ? 1.1 : 0.4;
      }
      if (sit > 0) {
        th = lerp(th, 1.35, sit);
        kb = lerp(kb, 2.4, sit);
      }
      if (crawl > 0) {
        th = lerp(th, -0.2 + Math.sin(ph + off) * 0.3, crawl);
        kb = lerp(kb, 0.3, crawl);
      }
      const hipLocal = side * 0.08 * this.bulk;
      const sx = hipLocal * (1 + sit * 1.4);
      const kx = sx + side * sit * 0.22;
      const ky = hipY - Math.cos(th) * legL;
      const kz = Math.sin(th) * legL;
      this.toWorld(kx, ky, kz, knee);
      const sh = th - kb;
      let fy = ky - Math.cos(sh) * legL;
      const fz = kz + Math.sin(sh) * legL;
      fy = Math.max(fy, 0.02);
      const fx = kx - side * sit * 0.3;
      this.toWorld(fx, fy, fz, foot);
    }

    // arms
    const armU = 0.33;
    const armF = 0.31;
    const swing = (0.15 + 0.7 * A) * (1 - sit);
    const arms = [
      [j.elbowR, j.handR, 1, 0],
      [j.elbowL, j.handL, -1, Math.PI],
    ];
    const aimP = this.aimPitch;
    this.aimDir.set(f.x * Math.cos(aimP), Math.sin(aimP), f.z * Math.cos(aimP));
    for (const [elbow, hand, side, off] of arms) {
      const tgt = _v;
      let useIK = false;
      if (this.aim && (side === 1 || this.aim === 2)) {
        // hands out in front along the aim direction
        const reach = side === 1 ? 0.55 : 0.4;
        tgt.copy(j.shoulder).addScaledVector(this.aimDir, reach * this.scale).addScaledVector(this.right, (side === 1 ? 0.06 : 0.02) * this.scale);
        tgt.y -= 0.06 * this.scale;
        useIK = true;
      } else if (this.melee >= 0 && side === 1) {
        const t = this.melee;
        const a = lerp(-2.2, 1.0, Math.min(1, t * 1.6));
        const lx = Math.sin(a) * 0.62;
        const lz = Math.cos(a) * 0.62;
        this.toWorld(nx + 0.05 + lx * 0.3, ny + 0.05 - Math.min(1, t) * 0.25, nz + lz, tgt);
        useIK = true;
      } else if (sit > 0.5) {
        this.toWorld(side * 0.12, hipY + 0.42, 0.42, tgt);
        useIK = true;
      } else if (crawl > 0.5) {
        const r = Math.sin(ph + off) * 0.3;
        this.toWorld(side * 0.25, 0.05, nz + 0.35 + r, tgt);
        useIK = true;
      } else if (this.armsUp > 0) {
        this.toWorld(side * 0.32, ny + 0.45, nz + 0.25, tgt);
        useIK = true;
      }
      if (useIK) {
        const pole = new THREE.Vector3(this.right.x * side * 0.6, -1, this.right.z * side * 0.6);
        ik(j.shoulder, tgt, armU * this.scale, armF * this.scale, pole, elbow);
        hand.copy(tgt);
      } else {
        const a = -Math.sin(ph + off) * swing;
        const out = 0.12 + (this.stagger ? 0.25 : 0);
        const ex = nx + side * (0.08 + out * 0.5);
        const ey = ny - 0.06 - Math.cos(a) * armU;
        const ez = nz + Math.sin(a) * armU;
        this.toWorld(ex, ey, ez, elbow);
        const b = a + 0.35 + A * 0.5;
        this.toWorld(ex + side * out * 0.4, ey - Math.cos(b) * armF, ez + Math.sin(b) * armF, hand);
      }
    }

    if (dead > 0) {
      // fall over backwards: rotate every joint around the feet line
      const pivot = this.pos;
      const ang = dead * Math.PI * 0.48;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      for (const k in j) {
        const p = j[k];
        const rx = p.x - pivot.x;
        const ry = p.y - pivot.y;
        const rz = p.z - pivot.z;
        const along = rx * f.x + rz * f.z;
        const ny2 = ry * c + along * s;
        const al2 = -ry * s + along * c;
        const perpX = rx - along * f.x;
        const perpZ = rz - along * f.z;
        p.set(pivot.x + perpX + f.x * al2, pivot.y + Math.max(0.05, ny2), pivot.z + perpZ + f.z * al2);
      }
    }
  }

  draw(camPos, alphaMul = 1) {
    if (!this.visible) return;
    const fr = this.fr;
    const j = this.j;
    const c = this.color;
    const w = this.width;
    const P = this.parts;
    const s = this.seed;
    if (P.torso > 0.01) fr.line(j.hip, j.neck, c, w * 1.05, s, P.torso * alphaMul);
    if (P.legs > 0.01) {
      fr.line(j.hipR, j.kneeR, c, w, s + 1, P.legs * alphaMul);
      fr.line(j.kneeR, j.footR, c, w, s + 2, P.legs * alphaMul);
      fr.line(j.hipL, j.kneeL, c, w, s + 3, P.legs * alphaMul);
      fr.line(j.kneeL, j.footL, c, w, s + 4, P.legs * alphaMul);
      if (this.bulk > 1.05) fr.line(j.hipL, j.hipR, c, w, s + 13, P.legs * alphaMul);
    }
    if (P.armR > 0.01) {
      fr.line(j.shoulder, j.elbowR, c, w * 0.95, s + 5, P.armR * alphaMul);
      fr.line(j.elbowR, j.handR, c, w * 0.95, s + 6, P.armR * alphaMul);
    }
    if (P.armL > 0.01) {
      fr.line(j.shoulder, j.elbowL, c, w * 0.95, s + 7, P.armL * alphaMul);
      fr.line(j.elbowL, j.handL, c, w * 0.95, s + 8, P.armL * alphaMul);
    }
    if (P.head < 0.99 && P.head > -1) {
      // neck stump scribble when the head is gone
      const nk = j.neck;
      fr.lineXYZ(nk.x - 0.05, nk.y + 0.02, nk.z, nk.x + 0.05, nk.y + 0.08, nk.z, c, w * 0.7, s + 9, (1 - P.head) * alphaMul);
      fr.lineXYZ(nk.x + 0.05, nk.y + 0.02, nk.z, nk.x - 0.04, nk.y + 0.09, nk.z, c, w * 0.6, s + 10, (1 - P.head) * alphaMul);
    }
    fr.shadow(this.pos.x, this.pos.y, this.pos.z, 0.45 * this.scale * this.bulk, s, 0.4 * alphaMul);

    // head sprite: choose front / side / back by view angle
    const hs = this.headSprite;
    hs.visible = P.head > 0.01;
    if (hs.visible) {
      hs.position.copy(j.headC);
      const dx = camPos.x - j.headC.x;
      const dz = camPos.z - j.headC.z;
      const toCamYaw = Math.atan2(dx, dz);
      let d = toCamYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const ad = Math.abs(d);
      let view = 'front';
      let flip = 0;
      if (this.dead > 0.5) view = 'front';
      else if (ad > 2.3) view = 'back';
      else if (ad > 0.75) {
        view = 'side';
        flip = d > 0 ? 1 : 0;
      }
      const key = `${view}${flip}`;
      if (key !== this.headView) {
        this.headView = key;
        this.fr.setRect(hs, `${HEAD_SETS[this.head]}_${view}`);
        hs.material.uniforms.uFlip.value = flip;
      }
      hs.material.uniforms.uErase.value = 1 - P.head;
    }
    const ts = this.torsoSprite;
    if (ts) {
      ts.visible = P.torso > 0.01;
      if (ts.visible) {
        ts.position.copy(j.neck);
        ts.position.y += 0.02 * this.scale;
        const dx = camPos.x - j.neck.x;
        const dz = camPos.z - j.neck.z;
        const toCamYaw = Math.atan2(dx, dz);
        const side = Math.abs(Math.cos(toCamYaw - this.yaw));
        const u = ts.material.uniforms;
        u.uSize.value.set(0.62 * this.scale * this.bulk * (0.55 + 0.45 * side), 0.66 * this.scale * (1 - this.sit * 0.25));
        u.uErase.value = 1 - P.torso;
        if (this.dead > 0.5 || this.crawl > 0.5) {
          ts.position.lerpVectors(j.neck, j.hip, 0.1);
        }
      }
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
