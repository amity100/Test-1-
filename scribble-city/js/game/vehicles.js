import * as THREE from 'three';
import { MeshBuilder } from '../render/MeshBuilder.js';
import { StrokeList, BLACK_INK } from '../render/LineBatch.js';
import { BLUEPRINTS, blueprintBounds } from './blueprints.js';
import { hexToRgb, setReveal } from './items.js';
import { groundHeight } from '../world/layout.js';
import { clamp, damp, dampAngle, angleDiff } from '../core/util.js';
import { COL } from '../world/buildings.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const VEH = {
  car: { width: 1.95, hp: 170, len: 2.0 },
  tank: { width: 3.3, hp: 520, len: 3.2 },
  ufo: { width: 0, hp: 480, len: 3.6 },
};

const QUALITY = {
  perfect: { speed: 1.15, accel: 1.2, pull: 0, stall: 0, wobble: 0, hp: 1.3, reload: 0.8 },
  good: { speed: 1, accel: 1, pull: 0, stall: 0, wobble: 0, hp: 1, reload: 1 },
  wonky: { speed: 0.7, accel: 0.7, pull: 0.28, stall: 0.05, wobble: 0.5, hp: 0.8, reload: 1.6 },
  fail: { speed: 0.22, accel: 0.35, pull: 0.6, stall: 0.2, wobble: 1.4, hp: 0.5, reload: 3 },
};

// Extrude a closed polygon given in (z, y) across x0..x1 with the sketch surface attributes.
function extrude(mb, poly, x0, x1, color, seed = 0) {
  const contour = poly.map(([z, y]) => new THREE.Vector2(z, y));
  if (contour.length > 2 && contour[0].distanceTo(contour[contour.length - 1]) < 1e-4) contour.pop();
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) contour.reverse();
  let tris = [];
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch (e) {
    tris = [];
  }
  const P = (x, v) => [x, v.y, v.x];
  for (const [a, b, c] of tris) {
    const A = contour[a];
    const B = contour[b];
    const C = contour[c];
    // +x cap: looking from +x, z goes to the left... keep both windings safe via the normal
    mb.tri(P(x1, A), P(x1, C), P(x1, B), [1, 0, 0], color, [[A.x, A.y], [C.x, C.y], [B.x, B.y]], [0, 3, 3, seed]);
    mb.tri(P(x0, A), P(x0, B), P(x0, C), [-1, 0, 0], color, [[A.x, A.y], [B.x, B.y], [C.x, C.y]], [0, 3, 3, seed]);
  }
  const n = contour.length;
  for (let i = 0; i < n; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % n];
    const ez = b.x - a.x;
    const ey = b.y - a.y;
    const l = Math.hypot(ez, ey) || 1;
    // outward normal for a CCW contour in (z, y): (ey, -ez)
    const nz = ey / l;
    const ny = -ez / l;
    mb.quad(P(x0, a), P(x1, a), P(x1, b), P(x0, b), [0, ny, nz], color, [[0, 0], [x1 - x0, 0], [x1 - x0, l], [0, l]], [0, 3, 3, seed + i]);
  }
}

function wheelGeom(mb, sl, r, w, color) {
  const n = 10;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const nm = [0, (a[1] + b[1]) / 2 / r, (a[0] + b[0]) / 2 / r];
    mb.quad([w / 2, a[1], a[0]], [w / 2, b[1], b[0]], [-w / 2, b[1], b[0]], [-w / 2, a[1], a[0]], nm, color, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    mb.quad([-w / 2, a[1], a[0]], [-w / 2, b[1], b[0]], [w / 2, b[1], b[0]], [w / 2, a[1], a[0]], nm, color, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    for (const s of [-1, 1]) mb.tri([s * w / 2, 0, 0], [s * w / 2, a[1], a[0]], [s * w / 2, b[1], b[0]], [s, 0, 0], COL.darkMetal, [[0, 0], [1, 0], [0, 1]]);
  }
  for (const s of [-1, 1]) {
    sl.poly(pts.map(([z, y]) => [s * (w / 2 + 0.01), y, z]), true, { width: 1.8, overshoot: 0.01, color: BLACK_INK });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      sl.seg([s * (w / 2 + 0.015), Math.sin(a) * r * 0.85, Math.cos(a) * r * 0.85], [s * (w / 2 + 0.015), -Math.sin(a) * r * 0.85, -Math.cos(a) * r * 0.85], { width: 1.3, overshoot: 0, color: BLACK_INK });
    }
  }
}

/**
 * A vehicle built from the player's drawing: the template's colored shapes are extruded
 * into a solid "cut-out", and the player's own strokes are drawn on both sides.
 */
class Vehicle {
  constructor(mgr, kind, grade, score, aligned) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.kind = kind;
    this.grade = grade;
    this.score = score;
    this.q = QUALITY[grade];
    this.bp = BLUEPRINTS[kind];
    this.cfg = VEH[kind];
    this.maxHp = Math.round(this.cfg.hp * this.q.hp);
    this.hp = this.maxHp;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.speedAbs = 0;
    this.vy = 0;
    this.alt = 0;
    this.turretYaw = 0;
    this.reload = 0;
    this.wheelSpin = 0;
    this.time = 0;
    this.reveal = 0;
    this.dead = false;
    this.driver = null;
    this.radius = kind === 'tank' ? 2.4 : kind === 'ufo' ? 3.6 : 1.6;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = true;
    this.build(aligned);
    mgr.game.scene.add(this.group);
  }

  // template (x right, y down) -> local (z forward, y up), bottom of the drawing on the ground
  build(aligned) {
    const bp = this.bp;
    const k = bp.scale / 100;
    const b = blueprintBounds(bp);
    const cx = (b.x0 + b.x1) / 2;
    const by = b.y1;
    const L = (p) => [(p[0] - cx) * k, (by - p[1]) * k];
    this.toLocal = L;
    const mats = this.game.mats;
    const mb = new MeshBuilder();
    const sl = new StrokeList();
    const W = this.cfg.width;
    if (this.kind === 'ufo') return this.buildUfo(aligned, L, k);
    const wheels = (bp.wheels || []).map(([x, y, r]) => ({ c: L([x, y]), r: r * k }));
    // extrude template fills (except wheels which become real wheels)
    bp.fills.forEach((f, i) => {
      const isWheel = wheels.some((w) => {
        const cc = L([f.poly[0][0], f.poly[0][1]]);
        return Math.hypot(cc[0] - w.c[0], cc[1] - w.c[1]) < w.r * 1.3 && f.poly.length > 8;
      });
      if (isWheel) return;
      const col = hexToRgb(f.color);
      let x0 = -W / 2;
      let x1 = W / 2;
      if (this.kind === 'car' && i > 0) {
        // windows: thin panels just outside the body
        x0 = -W / 2 - 0.02;
        x1 = W / 2 + 0.02;
      }
      if (this.kind === 'tank') {
        if (i === 2) { x0 = -W * 0.32; x1 = W * 0.32; } // turret
        if (i === 3) { x0 = -0.18; x1 = 0.18; } // barrel
        if (i === 4) { x0 = -0.03; x1 = 0.03; } // flag
      }
      const target = this.kind === 'tank' && (i === 2 || i === 3 || i === 4) ? 'turret' : 'body';
      const builder = target === 'turret' ? (this.turretMB || (this.turretMB = new MeshBuilder())) : mb;
      extrude(builder, f.poly.map(L), x0, x1, col, i * 7);
    });
    // player strokes on both sides; strokes that trace a wheel go onto that wheel
    const wheelStrokes = wheels.map(() => []);
    const bodyStrokes = [];
    const turretStrokes = [];
    const turretBox = this.kind === 'tank' ? { z0: L([28, 0])[0], z1: L([100, 0])[0], y0: L([0, 46])[1], y1: L([0, 0])[1] } : null;
    for (const st of aligned) {
      const pts = st.map(L);
      let assigned = false;
      wheels.forEach((w, wi) => {
        if (assigned) return;
        const inside = pts.filter(([z, y]) => Math.hypot(z - w.c[0], y - w.c[1]) < w.r * 1.6).length;
        if (inside / pts.length > 0.75) {
          wheelStrokes[wi].push(pts.map(([z, y]) => [z - w.c[0], y - w.c[1]]));
          assigned = true;
        }
      });
      if (assigned) continue;
      if (turretBox) {
        const inT = pts.filter(([z, y]) => y > turretBox.y0 && z > turretBox.z0).length;
        if (inT / pts.length > 0.7) {
          turretStrokes.push(pts);
          continue;
        }
      }
      bodyStrokes.push(pts);
    }
    const strokeSides = (list, slx, halfW) => {
      for (const pts of list) {
        for (let i = 0; i < pts.length - 1; i++) {
          for (const s of [-1, 1]) slx.seg([s * (halfW + 0.03), pts[i][1], pts[i][0]], [s * (halfW + 0.03), pts[i + 1][1], pts[i + 1][0]], { width: 2.4, overshoot: 0.01, wobble: 0.01, color: BLACK_INK });
        }
        if (pts.length > 2) {
          for (const p of [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]]) slx.seg([-(halfW + 0.03), p[1], p[0]], [halfW + 0.03, p[1], p[0]], { width: 1.5, overshoot: 0.02, color: BLACK_INK });
        }
      }
    };
    strokeSides(bodyStrokes, sl, W / 2);
    // sketch the extrusion edges of the main shapes so the vehicle reads from any angle
    const edgeFills = this.kind === 'tank' ? [0, 1] : [0];
    for (const fi of edgeFills) {
      const poly = bp.fills[fi].poly.map(L);
      const step = Math.max(1, Math.floor(poly.length / 14));
      for (let i = 0; i < poly.length; i += step) {
        const [z, y] = poly[i];
        sl.seg([-W / 2, y, z], [W / 2, y, z], { width: 1.8, overshoot: 0.06, wobble: 0.01, color: BLACK_INK });
      }
      for (let i = 0; i < poly.length - 1; i++) {
        for (const s of [-1, 1]) sl.seg([s * W / 2, poly[i][1], poly[i][0]], [s * W / 2, poly[i + 1][1], poly[i + 1][0]], { width: 1.2, overshoot: 0.02, color: BLACK_INK, alpha: 0.55 });
      }
    }
    // lights, plate and bumpers
    {
      const body = bp.fills[0].poly.map(L);
      let zmin = Infinity;
      let zmax = -Infinity;
      let ymin = Infinity;
      for (const [z, y] of body) {
        zmin = Math.min(zmin, z);
        zmax = Math.max(zmax, z);
        ymin = Math.min(ymin, y);
      }
      const ring = (x, y, z, r, color, width) => {
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, z]);
        }
        sl.poly(pts, true, { width, overshoot: 0.01, color });
      };
      const ly = ymin + (this.kind === 'tank' ? 0.9 : 0.42);
      for (const s of [-1, 1]) {
        ring(s * W * 0.33, ly, zmin - 0.02, 0.09, [0.72, 0.12, 0.12], 3.2);
        ring(s * W * 0.33, ly, zmax + 0.02, 0.1, [0.85, 0.7, 0.2], 3.2);
      }
      if (this.kind === 'car') {
        sl.poly([[-0.32, ly - 0.12, zmin - 0.03], [0.32, ly - 0.12, zmin - 0.03], [0.32, ly + 0.06, zmin - 0.03], [-0.32, ly + 0.06, zmin - 0.03]], true, { width: 1.6, overshoot: 0.02, color: BLACK_INK });
        sl.seg([-W / 2, ymin + 0.18, zmin - 0.04], [W / 2, ymin + 0.18, zmin - 0.04], { width: 3, overshoot: 0.05, color: BLACK_INK });
        sl.seg([-W / 2, ymin + 0.18, zmax + 0.04], [W / 2, ymin + 0.18, zmax + 0.04], { width: 3, overshoot: 0.05, color: BLACK_INK });
        for (let k = -2; k <= 2; k++) sl.seg([k * 0.12, ly - 0.1, zmax + 0.03], [k * 0.12, ly + 0.1, zmax + 0.03], { width: 1.2, overshoot: 0, color: BLACK_INK });
      }
    }
    this.body = new THREE.Group();
    this.group.add(this.body);
    if (!mb.empty) this.body.add(new THREE.Mesh(mb.build(), mats.itemSurface));
    this.lines = sl.toBatch(mats.itemLine);
    this.lines.mesh.frustumCulled = false;
    this.body.add(this.lines.mesh);
    // turret (tank)
    if (this.kind === 'tank') {
      const tsl = new StrokeList();
      strokeSides(turretStrokes, tsl, W * 0.32);
      const pivot = L(bp.anchors.turret);
      this.turret = new THREE.Group();
      this.turret.position.set(0, 0, pivot[0]);
      const inner = new THREE.Group();
      inner.position.set(0, 0, -pivot[0]);
      if (this.turretMB && !this.turretMB.empty) inner.add(new THREE.Mesh(this.turretMB.build(), mats.itemSurface));
      this.turretLines = tsl.toBatch(mats.itemLine);
      this.turretLines.mesh.frustumCulled = false;
      inner.add(this.turretLines.mesh);
      this.turret.add(inner);
      this.body.add(this.turret);
      this.muzzleLocal = new THREE.Vector3(0, L(bp.anchors.muzzle)[1], L(bp.anchors.muzzle)[0]);
    }
    // wheels
    this.wheels = [];
    wheels.forEach((w, wi) => {
      const wmb = new MeshBuilder();
      const wsl = new StrokeList();
      const ww = this.kind === 'tank' ? 0.5 : 0.32;
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * (W / 2 - ww / 2 + 0.02), w.c[1], w.c[0]);
        this.body.add(g);
        this.wheels.push(g);
      }
      wheelGeom(wmb, wsl, w.r * 0.95, ww, COL.black);
      for (const pts of wheelStrokes[wi]) {
        for (let i = 0; i < pts.length - 1; i++) {
          wsl.seg([ww / 2 + 0.04, pts[i][1], pts[i][0]], [ww / 2 + 0.04, pts[i + 1][1], pts[i + 1][0]], { width: 2.4, overshoot: 0, color: BLACK_INK });
          wsl.seg([-ww / 2 - 0.04, pts[i][1], pts[i][0]], [-ww / 2 - 0.04, pts[i + 1][1], pts[i + 1][0]], { width: 2.4, overshoot: 0, color: BLACK_INK });
        }
      }
      const geo = wmb.build();
      const wl = wsl.toBatch(mats.itemLine);
      for (const g of this.wheels.slice(-2)) {
        g.add(new THREE.Mesh(geo, mats.itemSurface));
        const lm = new THREE.Mesh(wl.geometry, mats.itemLine);
        lm.frustumCulled = false;
        lm.renderOrder = 10;
        g.add(lm);
      }
    });
    const bbox = blueprintBounds(bp);
    this.halfLen = ((bbox.x1 - bbox.x0) * k) / 2;
    this.halfWid = W / 2;
    this.heightM = (bbox.y1 - bbox.y0) * k;
  }

  buildUfo(aligned, L, k) {
    const mats = this.game.mats;
    const bp = this.bp;
    const mb = new MeshBuilder();
    const sl = new StrokeList();
    // saucer: lathe of an ellipse ring; dome: half ellipsoid
    const R = 44 * k;
    const T = 11 * k;
    const n = 24;
    const prof = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI;
      prof.push([Math.cos(a) * R, Math.sin(a) * T]);
    }
    const yc = L([0, 46])[1];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      for (let j = 0; j < prof.length - 1; j++) {
        const [r0, y0] = prof[j];
        const [r1, y1] = prof[j + 1];
        const p = (r, y, a) => [Math.cos(a) * r, yc + y, Math.sin(a) * r];
        const nm = [Math.cos((a0 + a1) / 2) * (y1 - y0), -(r1 - r0) * 0.3, Math.sin((a0 + a1) / 2) * (y1 - y0)];
        const l = Math.hypot(...nm) || 1;
        mb.quad(p(r0, y0, a0), p(r0, y0, a1), p(r1, y1, a1), p(r1, y1, a0), [nm[0] / l, nm[1] / l, nm[2] / l], [0.8, 0.82, 0.86], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 3, 3, i]);
      }
    }
    const DR = 20 * k;
    const DH = 25 * k;
    const ytop = L([0, 41])[1];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      for (let j = 0; j < 6; j++) {
        const t0 = (j / 6) * (Math.PI / 2);
        const t1 = ((j + 1) / 6) * (Math.PI / 2);
        const p = (t, a) => [Math.cos(a) * Math.cos(t) * DR, ytop + Math.sin(t) * DH, Math.sin(a) * Math.cos(t) * DR];
        const nm = [Math.cos(a0) * Math.cos(t0), Math.sin(t0), Math.sin(a0) * Math.cos(t0)];
        mb.quad(p(t0, a0), p(t0, a1), p(t1, a1), p(t1, a0), nm, [0.82, 0.92, 0.93], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 3, 3, 40 + i]);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sl.seg([Math.cos(a) * R, yc, Math.sin(a) * R], [Math.cos(a + Math.PI / 6) * R, yc, Math.sin(a + Math.PI / 6) * R], { width: 2.2, color: BLACK_INK });
      sl.seg([Math.cos(a) * DR, ytop, Math.sin(a) * DR], [Math.cos(a + Math.PI / 6) * DR, ytop, Math.sin(a + Math.PI / 6) * DR], { width: 1.8, color: BLACK_INK });
    }
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.spinner = new THREE.Group();
    this.body.add(this.spinner);
    this.spinner.add(new THREE.Mesh(mb.build(), mats.itemSurface));
    const ringLines = sl.toBatch(mats.itemLine);
    ringLines.mesh.frustumCulled = false;
    this.spinner.add(ringLines.mesh);
    // the player's drawing: a camera-facing "cut-out" so it always reads like the drawing
    const fsl = new StrokeList();
    for (const st of aligned) {
      const pts = st.map(L);
      for (let i = 0; i < pts.length - 1; i++) fsl.seg([pts[i][0], pts[i][1], 0], [pts[i + 1][0], pts[i + 1][1], 0], { width: 2.8, overshoot: 0.01, wobble: 0.01, color: BLACK_INK });
    }
    this.facing = new THREE.Group();
    this.lines = fsl.toBatch(mats.itemLine);
    this.lines.mesh.frustumCulled = false;
    this.facing.add(this.lines.mesh);
    this.body.add(this.facing);
    this.wheels = [];
    this.halfLen = R;
    this.halfWid = R;
    this.heightM = 3.2;
    this.beamOn = false;
  }

  dispose() {
    this.game.scene.remove(this.group);
  }

  hurt(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.game.hud.hurtFlash();
    this.game.audio.play('clang', 0.5);
    if (this.hp <= 0) this.destroy();
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    const game = this.game;
    game.fx.boom(this.pos.x, this.pos.y + 1, this.pos.z, 6);
    game.audio.play('boom');
    game.camRig.addShake(0.6);
    if (this.driver) {
      game.exitVehicle(true);
      game.player.hurt(20, this.pos.x, this.pos.z);
    }
    this.removeAt = game.time + 0.2;
  }

  // forward unit vector
  get fwd() {
    return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  update(dt) {
    this.time += dt;
    if (this.reveal < 1) {
      this.reveal = Math.min(1, this.reveal + dt / 0.8);
      setReveal(this.lines, this.reveal);
      const s = 0.2 + 0.8 * Math.min(1, this.reveal * 1.4);
      this.group.scale.setScalar(s);
    }
    const input = this.driver ? this.game.input : null;
    if (this.kind === 'car') this.updateCar(dt, input);
    else if (this.kind === 'tank') this.updateTank(dt, input);
    else this.updateUfo(dt, input);
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, 0);
    if (this.kind === 'ufo') {
      this.spinner.rotation.y += dt * (0.6 + this.speedAbs * 0.05);
      const cam = this.game.camera.position;
      const a = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z) - this.yaw;
      this.facing.rotation.y = a;
      const wob = this.q.wobble;
      this.body.rotation.z = Math.sin(this.time * 2.1) * 0.04 + Math.sin(this.time * 5.3) * 0.08 * wob;
      this.body.rotation.x = Math.sin(this.time * 1.7) * 0.03 + Math.cos(this.time * 4.1) * 0.06 * wob;
    } else {
      this.wheelSpin += (this.speed * dt) / 0.4;
      for (const w of this.wheels) w.rotation.x = this.wheelSpin * (this.grade === 'fail' ? 0.6 : 1) + (this.grade === 'fail' ? Math.sin(this.time * 9) * 0.4 : 0);
      if (this.grade === 'fail' || this.grade === 'wonky') {
        this.body.position.y = Math.abs(Math.sin(this.wheelSpin * 2)) * 0.06 * this.q.wobble * Math.min(1, this.speedAbs / 3);
        this.body.rotation.z = Math.sin(this.time * 7) * 0.02 * this.q.wobble * Math.min(1, this.speedAbs / 2);
      }
    }
  }

  collideWorld(dt) {
    // three circles along the body
    const col = this.game.world.collision;
    const f = this.fwd.clone();
    let hit = false;
    let impact = 0;
    const offs = this.kind === 'tank' ? [-2, 0, 2] : [-1.2, 0, 1.2];
    const r = this.kind === 'tank' ? 1.7 : 1.0;
    for (const o of offs) {
      const p = new THREE.Vector3(this.pos.x + f.x * o, this.pos.y + 0.2, this.pos.z + f.z * o);
      const before = p.clone();
      const res = col.resolveCylinder(p, r, 1.5, 0.45);
      if (res.hitWall) {
        hit = true;
        this.pos.x += p.x - before.x;
        this.pos.z += p.z - before.z;
        const along = Math.abs(f.x * res.nx + f.z * res.nz);
        impact = Math.max(impact, Math.abs(this.speed) * along);
      }
    }
    if (hit) {
      if (impact > 7) {
        this.hurt(impact * 1.6);
        this.game.fx.sprite('fx_crash', this.pos.x + f.x * this.halfLen, this.pos.y + 1, this.pos.z + f.z * this.halfLen, { size: 2.2, life: 0.4 });
        this.game.camRig.addShake(Math.min(0.6, impact * 0.03));
        this.game.audio.play('crash', Math.min(1, impact / 20));
      }
      this.speed *= impact > 4 ? -0.25 : 0.85;
    }
    // other vehicles
    for (const v of this.mgr.list) {
      if (v === this || v.dead) continue;
      const dx = this.pos.x - v.pos.x;
      const dz = this.pos.z - v.pos.z;
      const d = Math.hypot(dx, dz);
      const rr = this.radius + v.radius - 0.6;
      if (d < rr && d > 1e-3) {
        this.pos.x += (dx / d) * (rr - d) * 0.5;
        this.pos.z += (dz / d) * (rr - d) * 0.5;
        this.speed *= 0.7;
      }
    }
    this.game.traffic.collideVehicle(this);
  }

  runOver() {
    if (Math.abs(this.speed) < 3 && !(this.kind === 'tank' && Math.abs(this.speed) > 1)) return;
    const game = this.game;
    const f = this.fwd;
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      const dx = e.pos.x - this.pos.x;
      const dz = e.pos.z - this.pos.z;
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (Math.abs(along) < this.halfLen + 0.4 && side < this.halfWid + 0.4) {
        game.enemies.damage(e, 'torso', 999, e.pos.clone().setY(e.pos.y + 1), f.clone(), 'run');
        game.fx.sprite('fx_crash', e.pos.x, e.pos.y + 1, e.pos.z, { size: 1.6, life: 0.35 });
        if (this.kind === 'car') this.hurt(4);
      }
    }
    game.civilians.dodge(this.pos, f, this.halfLen + 1.5, this.halfWid + 1.2, this.speed);
  }

  updateCar(dt, input) {
    const q = this.q;
    let throttle = 0;
    let steer = 0;
    let brake = false;
    if (input) {
      const mv = input.readMove();
      throttle = mv.y;
      steer = -mv.x;
      brake = input.keys.has('Space');
      if (q.stall && Math.random() < q.stall * dt * 3) this.stall = 0.6 + Math.random();
    }
    if (this.stall > 0) {
      this.stall -= dt;
      throttle *= 0.1;
      if (Math.random() < dt * 4) this.game.fx.smoke(this.pos.x - Math.sin(this.yaw) * 2, this.pos.y + 0.6, this.pos.z - Math.cos(this.yaw) * 2, 0.8);
    }
    const maxF = 27 * q.speed;
    const maxR = 9 * q.speed;
    const acc = 15 * q.accel;
    if (throttle > 0) this.speed += acc * throttle * dt * (this.speed < 0 ? 2.2 : 1);
    else if (throttle < 0) this.speed += acc * throttle * dt * (this.speed > 0 ? 2.2 : 0.8);
    else this.speed = damp(this.speed, 0, 0.9, dt);
    if (brake) this.speed = damp(this.speed, 0, 4, dt);
    this.speed = clamp(this.speed, -maxR, maxF);
    const turn = (steer + (input ? q.pull * Math.sign(this.speed || 1) * 0.5 : 0)) * clamp(Math.abs(this.speed) / 6, 0, 1) * (brake ? 2.0 : 1.35) * Math.sign(this.speed || 1);
    this.yaw += turn * dt;
    const f = this.fwd;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z) * 0.5, 12, dt);
    this.speedAbs = Math.abs(this.speed);
    this.collideWorld(dt);
    this.runOver();
    if (input) this.game.audio.engine(this.speedAbs / maxF, 'car');
  }

  updateTank(dt, input) {
    const q = this.q;
    let throttle = 0;
    let turn = 0;
    if (input) {
      const mv = input.readMove();
      throttle = mv.y;
      turn = -mv.x;
    }
    const maxF = 11 * q.speed;
    this.speed = damp(this.speed, throttle * maxF, 1.6 * q.accel, dt);
    this.yaw += turn * 1.05 * dt * (this.grade === 'fail' ? 0.4 : 1) + (input ? q.pull * 0.2 * dt : 0);
    const f = this.fwd;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z) * 0.5, 12, dt);
    this.speedAbs = Math.abs(this.speed);
    this.collideWorld(dt);
    this.runOver();
    // turret follows the camera
    if (input) {
      let want = this.game.camRig.yaw - this.yaw;
      if (this.grade === 'fail') want = Math.sin(this.time * 0.7) * 2.5;
      else if (this.grade === 'wonky') want += Math.sin(this.time * 2.3) * 0.25;
      this.turretYaw = dampAngle(this.turretYaw, want, this.grade === 'wonky' ? 2 : 4, dt);
      this.turret.rotation.y = this.turretYaw;
      this.reload -= dt;
      if ((input.fire || input.firePressed) && this.reload <= 0) this.fireCannon();
      this.game.audio.engine(0.3 + this.speedAbs / 12, 'tank');
    }
  }

  fireCannon() {
    const game = this.game;
    this.reload = 1.6 * this.q.reload;
    this.turret.updateMatrixWorld(true);
    const m = this.muzzleLocal.clone();
    const mw = m.clone();
    this.turret.children[0].localToWorld(mw);
    const aim = game.weapons.aimPoint;
    const dir = aim.clone().sub(mw).normalize();
    if (this.grade === 'fail') {
      dir.set(Math.sin(this.yaw + this.turretYaw), 0.3, Math.cos(this.yaw + this.turretYaw)).normalize();
      game.weapons.spawnShell(mw.x, mw.y, mw.z, dir.x, dir.y, dir.z, 'player', 60, 3, 9);
    } else {
      const spread = this.grade === 'wonky' ? 0.06 : 0.008;
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      game.weapons.spawnShell(mw.x, mw.y, mw.z, dir.x, dir.y, dir.z, 'player', this.grade === 'perfect' ? 260 : 200, this.grade === 'perfect' ? 8.5 : 7, 48);
    }
    game.fx.muzzle(mw.x, mw.y, mw.z, 3);
    game.fx.smoke(mw.x, mw.y, mw.z, 2);
    game.audio.play('cannon');
    game.camRig.addShake(0.45);
    game.enemies.noise(this.pos, 60);
    this.speed -= 1.5;
  }

  updateUfo(dt, input) {
    const q = this.q;
    const game = this.game;
    let ax = 0;
    let az = 0;
    let up = 0;
    if (input) {
      const mv = input.readMove();
      const cy = game.camRig.yaw;
      const fx = Math.sin(cy);
      const fz = Math.cos(cy);
      ax = fx * mv.y - fz * mv.x;
      az = fz * mv.y + fx * mv.x;
      if (input.keys.has('Space')) up += 1;
      if (input.keys.has('KeyC') || input.keys.has('ControlLeft') || input.keys.has('ShiftLeft')) up -= 1;
      this.yaw = dampAngle(this.yaw, cy, 1.5, dt);
    }
    const maxS = 24 * q.speed;
    this.vx = damp(this.vx || 0, ax * maxS, 1.6 * q.accel, dt);
    this.vz = damp(this.vz || 0, az * maxS, 1.6 * q.accel, dt);
    const maxAlt = this.grade === 'fail' ? 1.2 : 70;
    this.vy = damp(this.vy, up * 9, 3, dt);
    if (!this.driver) this.vy = damp(this.vy, (6 - this.alt) * 0.8, 1, dt);
    this.alt = clamp(this.alt + this.vy * dt, 1.0, maxAlt);
    if (q.wobble) {
      this.vx += Math.sin(this.time * 1.3) * q.wobble * 1.5 * dt;
      this.vz += Math.cos(this.time * 1.1) * q.wobble * 1.5 * dt;
      if (this.grade === 'fail') this.alt = 1 + Math.abs(Math.sin(this.time * 3)) * 1.2;
    }
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    const g = Math.max(0, groundHeight(this.pos.x, this.pos.z));
    this.pos.y = g + this.alt - 1.0;
    this.speedAbs = Math.hypot(this.vx, this.vz);
    // collide with buildings as a disc
    const col = game.world.collision;
    const p = new THREE.Vector3(this.pos.x, this.pos.y + 0.3, this.pos.z);
    const res = col.resolveCylinder(p, 3.2, 1.8, 0);
    if (res.hitWall) {
      this.pos.x = p.x;
      this.pos.z = p.z;
      this.vx *= 0.3;
      this.vz *= 0.3;
    }
    // erase beam
    this.beamOn = !!(input && input.fire);
    if (this.beamOn) {
      const flicker = this.grade === 'wonky' ? Math.sin(this.time * 17) > 0 : true;
      const power = this.grade === 'perfect' ? 120 : this.grade === 'good' ? 90 : this.grade === 'wonky' ? 60 : 12;
      if (flicker) this.beam(dt, power);
      game.audio.engine(1, 'beam');
    } else if (input) game.audio.engine(0.35 + this.speedAbs / 30, 'ufo');
  }

  beam(dt, power) {
    const game = this.game;
    const fr = game.figures;
    const gx = this.pos.x;
    const gz = this.pos.z;
    const top = this.pos.y + 0.6;
    const g = Math.max(0.15, groundHeight(gx, gz));
    const r = 4.2;
    // beam cone drawn as wavy ink lines
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + this.time * 2;
      fr.lineXYZ(gx + Math.cos(a) * 1.2, top, gz + Math.sin(a) * 1.2, gx + Math.cos(a) * r, g + 0.05, gz + Math.sin(a) * r, [0.3, 0.62, 0.32], 2.2, i + this.time, 0.7, 0.04, 0);
    }
    for (let k = 0; k < 3; k++) {
      const y = g + ((this.time * 6 + k * 2) % (top - g));
      const rr = 1.2 + (r - 1.2) * (1 - (y - g) / (top - g));
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pts.push([gx + Math.cos(a) * rr, y, gz + Math.sin(a) * rr]);
      }
      for (let i = 0; i < 12; i++) fr.lineXYZ(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2], [0.3, 0.62, 0.32], 1.6, k * 3 + i, 0.6, 0.02, 0);
    }
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - gx, e.pos.z - gz);
      if (d < r) {
        const pt = new THREE.Vector3(e.pos.x, e.pos.y + 1 + Math.random(), e.pos.z);
        if (Math.random() < dt * 8) {
          const part = e.isMonster ? 'body' : ['head', 'armL', 'armR', 'legs', 'torso'][Math.floor(Math.random() * 5)];
          game.enemies.damage(e, part, power * 0.25, pt, null, 'beam');
          game.fx.sprite('fx_zap', pt.x, pt.y, pt.z, { size: 1.2, life: 0.18 });
        }
      }
    }
  }
}

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(kind, grade, score, aligned) {
    const game = this.game;
    const v = new Vehicle(this, kind, grade, score, aligned);
    // place in front of the player, on free ground
    const p = game.player.pos;
    const f = game.player.fig.forward;
    const tries = [4.5, 6, 3.5, 8];
    let placed = false;
    for (const d of tries) {
      for (const side of [0, 1, -1, 2, -2]) {
        const ang = Math.atan2(f.x, f.z) + side * 0.6;
        const x = p.x + Math.sin(ang) * d;
        const z = p.z + Math.cos(ang) * d;
        const hit = game.world.collision.pointInside(x, 1.0, z, v.radius * 0.8);
        if (!hit) {
          v.pos.set(x, kind === 'ufo' ? 0 : groundHeight(x, z) * 0.5, z);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) v.pos.set(p.x + f.x * 4, 0, p.z + f.z * 4);
    v.yaw = game.player.yaw;
    if (kind === 'ufo') v.alt = 3;
    this.list.push(v);
    // keep at most 3 drawn vehicles around
    while (this.list.length > 3) {
      const old = this.list.find((o) => !o.driver);
      if (!old) break;
      old.dispose();
      this.list.splice(this.list.indexOf(old), 1);
    }
    game.fx.smoke(v.pos.x, v.pos.y + 1, v.pos.z, 3);
    game.fx.crumbs(v.pos.x, v.pos.y + 1, v.pos.z, 20, 4);
    return v;
  }

  update(dt) {
    const keep = [];
    for (const v of this.list) {
      v.update(dt);
      if (v.dead && this.game.time > v.removeAt) {
        v.dispose();
        continue;
      }
      keep.push(v);
    }
    this.list = keep;
  }

  nearest(pos, maxD) {
    let best = null;
    let bd = maxD;
    for (const v of this.list) {
      if (v.dead) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) - v.radius;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  // push walkers out of vehicle footprints (oriented boxes)
  pushOut(p, r) {
    this.game.traffic.pushOut(p, r);
    for (const v of this.list) {
      if (v.dead || v.kind === 'ufo') continue;
      const dx = p.x - v.pos.x;
      const dz = p.z - v.pos.z;
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const hl = v.halfLen + r;
      const hw = v.halfWid + r;
      if (Math.abs(along) < hl && Math.abs(side) < hw && p.y < v.pos.y + v.heightM) {
        const pa = hl - Math.abs(along);
        const ps = hw - Math.abs(side);
        if (pa < ps) {
          const s = Math.sign(along) || 1;
          p.x += fx * pa * s;
          p.z += fz * pa * s;
        } else {
          const s = Math.sign(side) || 1;
          p.x += fz * ps * s;
          p.z -= fx * ps * s;
        }
      }
    }
  }
}

export { angleDiff, _q, UP };
