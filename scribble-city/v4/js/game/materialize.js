import * as THREE from 'three';
import { surfaceVariant } from '../render/materials.js';
import { buildWeaponModel } from './items.js';
import { canopyModel } from './parachute.js';
import { groundHeight, BOUNDS } from '../world/layout.js';

// A drawing turning into the real thing.
//
// The strokes drawn in the air fly to where the thing is going to be and stretch over its
// outline (ui/airdraw.js). The thing appears right there, pressed flat onto the plane of the
// drawing and as white as the paper - only its outlines show, so what you see is still your
// drawing, standing in the street now - then it puffs up into its depth with a boing, and a band
// of light sweeps across it, leaving its real colours behind and throwing sparks off the lines it
// passes. A thing for the hand then flies into the hand; the plaster and the parachute fly to the
// hero (onto the hurt, onto the back).

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _box = new THREE.Box3();
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _sa = new THREE.Vector3();
const _sb = new THREE.Vector3();

// the moments, in seconds from when the strokes land on the thing
const HOLD = 0.16; // the flat drawing, standing there
const SWEEP0 = 0.22; // the colours come in...
const SWEEP1 = 0.98; // ...all of them
const END = 1.08;
const FLY = 0.4; // into the hand (or onto the hero)
// the blueprints are drawn nose (muzzle) to the right; the paper helicopter faces left
const FACE_LEFT = new Set(['copter']);

const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// the box round a thing in its own frame
export function localBox(root, out = new THREE.Box3()) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  out.makeEmpty();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    _box.copy(g.boundingBox).applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld));
    out.union(_box);
  });
  return out;
}

// a matrix part way from a to b (k 0..1), along a little arc
export function blendMatrix(a, b, k, out, arc = 0) {
  a.decompose(_pa, _qa, _sa);
  b.decompose(_pb, _qb, _sb);
  _pa.lerp(_pb, k);
  _pa.y += Math.sin(k * Math.PI) * arc;
  _qa.slerp(_qb, k);
  _sa.lerp(_sb, k);
  return out.compose(_pa, _qa, _sa);
}

// presses everything flat onto the plane dot(p, n) = c, keeping k of its depth
function flattenMatrix(n, c, k, out) {
  const a = 1 - k;
  return out.set(
    1 - a * n.x * n.x, -a * n.x * n.y, -a * n.x * n.z, a * c * n.x,
    -a * n.y * n.x, 1 - a * n.y * n.y, -a * n.y * n.z, a * c * n.y,
    -a * n.z * n.x, -a * n.z * n.y, 1 - a * n.z * n.z, a * c * n.z,
    0, 0, 0, 1,
  );
}

// How a thing stands to be shown: its own origin O, turned by q and scaled by s; the axes of
// the screen there (ax right, ay up, an into the screen, all level); its outline along them.
function makeFrame(camera, O, q, s, box) {
  const an = new THREE.Vector3();
  camera.getWorldDirection(an);
  an.y = 0;
  if (an.lengthSq() < 1e-6) an.set(0, 0, -1);
  an.normalize();
  const ax = new THREE.Vector3().crossVectors(an, UP).normalize();
  const f = { O: O.clone(), q: q.clone(), s, ax, ay: UP.clone(), an, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, n0: Infinity, n1: -Infinity, corners: [] };
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).multiplyScalar(s).applyQuaternion(q);
    f.corners.push(_v.clone().add(O));
    const x = _v.dot(ax);
    const y = _v.dot(UP);
    const n = _v.dot(an);
    f.x0 = Math.min(f.x0, x);
    f.x1 = Math.max(f.x1, x);
    f.y0 = Math.min(f.y0, y);
    f.y1 = Math.max(f.y1, y);
    f.n0 = Math.min(f.n0, n);
    f.n1 = Math.max(f.n1, n);
  }
  f.matrix = new THREE.Matrix4().compose(f.O, f.q, new THREE.Vector3(s, s, s));
  return f;
}

// the screen's axes as the drawing is finished, and the turn that shows a thing side on
// (its nose the way the drawing's nose points)
function sideOn(camera, id) {
  const an = new THREE.Vector3();
  camera.getWorldDirection(an);
  an.y = 0;
  an.normalize();
  const ax = new THREE.Vector3().crossVectors(an, UP).normalize();
  const face = FACE_LEFT.has(id) ? -1 : 1;
  const z = ax.clone().multiplyScalar(face);
  const x = new THREE.Vector3().crossVectors(UP, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
  return { an, ax, q, yaw: Math.atan2(z.x, z.z) };
}

// somewhere free in front of the camera for a drawn vehicle, side on, all of it in view (box:
// the vehicle in its own frame, the tank's barrel and the helicopter's blades too). Returns
// where its own origin goes.
function findSpot(game, v, so, box) {
  const cam = game.camera;
  const c = cam.position;
  const p = game.player.pos;
  const halfLen = (box.max.z - box.min.z) / 2 + 0.3;
  const halfWid = (box.max.x - box.min.x) / 2 + 0.25;
  const mid = (box.max.z + box.min.z) / 2;
  const tanX = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
  // its near side far enough for all of it to fit across the screen, and clear of the hero
  const dFit = halfLen / (0.82 * tanX) + halfWid;
  const dHero = (p.x - c.x) * so.an.x + (p.z - c.z) * so.an.z + halfWid + 1.4;
  const d0 = Math.max(dFit, dHero);
  const col = game.world.collision;
  const fx = Math.sin(so.yaw);
  const fz = Math.cos(so.yaw);
  const step = Math.max(0.7, halfLen / 3);
  const others = game.vehicles.list.filter((o) => !o.dead);
  const free = (x, z) => {
    for (const o of others) if (Math.hypot(o.pos.x - x, o.pos.z - z) < halfLen + o.halfLen + 0.6) return false;
    for (let a = -halfLen; a <= halfLen + 1e-3; a += step) {
      for (const b of [-halfWid, 0, halfWid]) {
        const px = x + fx * a + so.an.x * b;
        const pz = z + fz * a + so.an.z * b;
        // on the city's ground (not in the bay), clear of walls and things
        if (px < BOUNDS.minX || pz < BOUNDS.minZ || pz > BOUNDS.maxZ || groundHeight(px, pz) < 0) return false;
        if (col.pointInside(px, 1.0, pz, 0.3)) return false;
      }
    }
    return true;
  };
  for (const dd of [0, 1.5, 3, 5]) {
    for (const side of [0.5, 2, -1.2, 3.8, -2.8]) {
      const x = c.x + so.an.x * (d0 + dd) + so.ax.x * side;
      const z = c.z + so.an.z * (d0 + dd) + so.ax.z * side;
      if (free(x, z)) return { x: x - fx * mid, z: z - fz * mid };
    }
  }
  return null;
}

/**
 * What a drawing is about to become, and where: called as the strokes leave the air.
 * sheet: the air's sheet ({ C: its centre, W, H }). Returns the plan the strokes fly to:
 * { frame, model | vehicle, map(u, v, out) once setDrawing(u0, u1, v0, v1) knows the drawing }
 */
export function planDrawing(game, bp, res, sheet) {
  const so = sideOn(game.camera, bp.id);
  const plan = { bp, grade: res.grade, so };
  if (bp.kind === 'vehicle') {
    const v = game.vehicles.create(bp.id, res.grade, res.score);
    const box = v.kind === 'car' ? game.cars.boxOf(v.carKind) : localBox(v.group);
    const spot = findSpot(game, v, so, box);
    if (spot) v.pos.set(spot.x, v.flies ? 0 : groundHeight(spot.x, spot.z) * 0.5, spot.z);
    else game.vehicles.placeNear(v);
    v.yaw = so.yaw;
    plan.vehicle = v;
    plan.frame = makeFrame(game.camera, v.pos, so.q, 1, box);
  } else {
    // a thing for the hand, the plaster, the parachute: shown first as big as it was drawn, in
    // the air right where it was drawn
    let model;
    if (bp.kind === 'gear') {
      model = { group: canopyModel(res.grade) };
      model.group.matrixAutoUpdate = false;
    } else model = buildWeaponModel(bp.id, res.grade, { seed: res.score });
    const box = localBox(model.group);
    const size = box.getSize(_w);
    const s = THREE.MathUtils.clamp(Math.min((sheet.W * 0.66) / Math.max(0.05, size.z), (sheet.H * 0.66) / Math.max(0.05, size.y)), 0.25, 9);
    const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s).applyQuaternion(so.q);
    const O = sheet.C.clone().sub(centre);
    plan.model = model;
    plan.frame = makeFrame(game.camera, O, so.q, s, box);
  }
  plan.setDrawing = (u0, u1, v0, v1) => {
    const f = plan.frame;
    const du = Math.max(1e-3, u1 - u0);
    const dv = Math.max(1e-3, v1 - v0);
    const mid = (f.n0 + f.n1) / 2;
    plan.map = (u, v, out) =>
      out
        .copy(f.O)
        .addScaledVector(f.ax, f.x0 + ((u - u0) / du) * (f.x1 - f.x0))
        .addScaledVector(f.ay, f.y0 + ((v - v0) / dv) * (f.y1 - f.y0))
        .addScaledVector(f.an, mid);
  };
  return plan;
}

export class Materialize {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  get busy() {
    return this.list.length > 0;
  }

  /**
   * o: { frame, pts (points along the strokes, in the world), root (a Kit-built thing: its
   *      surfaces get their own copies for the moment), car (a drawn car of the car batches),
   *      held (a weapon slot: flies into the hand), toHero: 'chest' | 'back', onArrive, vehicle,
   *      onReal (all its colours in) }
   */
  begin(o) {
    const f = o.frame;
    const r = { ...o, t: 0, done: false, flags: {} };
    // the sweep: from the lower left of the thing to its upper right, as you'd colour it in
    r.dir = f.ax.clone().addScaledVector(f.ay, 0.35).normalize();
    let d0 = Infinity;
    let d1 = -Infinity;
    for (const c of f.corners) {
      const d = c.dot(r.dir);
      d0 = Math.min(d0, d);
      d1 = Math.max(d1, d);
    }
    const size = Math.max(f.x1 - f.x0, f.y1 - f.y0);
    r.band = THREE.MathUtils.clamp(size * 0.06, 0.05, 0.4);
    r.d0 = d0 - r.band;
    r.d1 = d1 + r.band;
    r.size = size;
    r.flatC = f.O.dot(f.an) + (f.n0 + f.n1) / 2;
    r.U = {
      uMatOn: { value: 1 },
      uMatFlat: { value: new THREE.Vector4(f.an.x, f.an.y, f.an.z, r.flatC) },
      uMatK: { value: 0.03 },
      uMatSweep: { value: new THREE.Vector4(r.dir.x, r.dir.y, r.dir.z, r.d0) },
      uMatBand: { value: new THREE.Vector4(r.band, 1, 1, 0) },
    };
    if (o.root) {
      r.swaps = [];
      const copies = new Map();
      o.root.traverse((m) => {
        if (!m.isMesh || !m.material || !m.material.uniforms || !m.material.uniforms.uMatOn) return;
        let c = copies.get(m.material);
        if (!c) {
          c = surfaceVariant(m.material, r.U);
          copies.set(m.material, c);
        }
        r.swaps.push([m, m.material]);
        m.material = c;
      });
      r.copies = [...copies.values()];
    }
    if (o.car) {
      r.carRV = { pre: new THREE.Matrix4(), sweep: [r.dir.x, r.dir.y, r.dir.z, r.d0], band: r.band };
      o.car.mat = r;
    }
    if (o.vehicle) o.vehicle.materializing = true;
    // the strokes' points, in the order the sweep reaches them (the sparks fly off them)
    r.pts = (o.pts || []).map((p) => ({ p, d: p.dot(r.dir) })).sort((a, b) => a.d - b.d);
    // the moment the strokes land on it: a burst of twinkles along them
    for (let i = 0; i < Math.min(14, r.pts.length); i++) {
      const q = r.pts[Math.floor(Math.random() * r.pts.length)].p;
      this.game.fx.twinkle(q.x, q.y, q.z, THREE.MathUtils.clamp(size * 0.06, 0.1, 0.4), [1, 0.86, 0.45], 0.35);
    }
    this.list.push(r);
    this.apply(r, 0);
    return r;
  }

  update(dt) {
    if (!this.list.length) return;
    for (const r of this.list) {
      r.t += dt;
      this.apply(r, dt);
    }
    this.list = this.list.filter((r) => !r.done);
  }

  apply(r, dt) {
    const g = this.game;
    const t = r.t;
    // its depth: flat for a moment, then it puffs up with a boing (a bit too much, then settles)
    const ti = t - HOLD;
    const k = ti <= 0 ? 0.03 : 1 - 0.97 * Math.exp(-ti * 10) * Math.cos(ti * 16);
    const front = r.d0 + (r.d1 - r.d0) * smooth((t - SWEEP0) / (SWEEP1 - SWEEP0));
    r.U.uMatK.value = Math.max(0.03, k);
    r.U.uMatSweep.value.w = front;
    const f = r.frame;
    if (r.carRV) {
      flattenMatrix(f.an, r.flatC, Math.max(0.03, k), r.carRV.pre);
      r.carRV.sweep[3] = front;
    }
    if (!r.flags.poof && t >= HOLD) {
      r.flags.poof = true;
      g.audio.play('poof');
    }
    // sparks off the lines the band of light is passing
    if (dt > 0 && t > SWEEP0 && t < SWEEP1 + 0.05 && r.pts.length) {
      const lo = this.lowerBound(r.pts, front - r.band);
      const hi = this.lowerBound(r.pts, front + r.band);
      const n = Math.min(hi - lo, Math.max(1, Math.round(dt * 70)));
      for (let i = 0; i < n; i++) {
        const q = r.pts[lo + Math.floor(Math.random() * (hi - lo))].p;
        if (Math.random() < 0.6) g.fx.twinkle(q.x, q.y, q.z, THREE.MathUtils.clamp(r.size * 0.07, 0.12, 0.5), Math.random() < 0.7 ? [1, 0.82, 0.4] : [0.6, 0.86, 1]);
        else g.fx.glints(q.x, q.y, q.z, 2, Math.random() < 0.5 ? [1, 0.88, 0.5] : [0.7, 0.9, 1]);
      }
    }
    if (!r.flags.tada && t >= SWEEP1) {
      r.flags.tada = true;
      g.audio.play('tada');
      const c = _v.copy(f.O).addScaledVector(f.ax, (f.x0 + f.x1) / 2).addScaledVector(f.ay, (f.y0 + f.y1) / 2).addScaledVector(f.an, (f.n0 + f.n1) / 2);
      g.fx.confetti(c.x, c.y + r.size * 0.1, c.z, r.vehicle ? 36 : 18, r.vehicle ? 4.5 : 2.6);
      for (let i = 0; i < (r.vehicle ? 7 : 4); i++) {
        g.fx.twinkle(c.x + (Math.random() - 0.5) * (f.x1 - f.x0), c.y + (Math.random() - 0.3) * (f.y1 - f.y0), c.z + (Math.random() - 0.5) * 0.6, THREE.MathUtils.clamp(r.size * 0.12, 0.18, 0.8), [1, 0.9, 0.55], 0.6);
      }
      if (r.vehicle && !r.vehicle.flies) {
        // it settles on the street: a puff of dust round its wheels
        const v = r.vehicle;
        g.fx.crumbs(v.pos.x, v.pos.y + 0.2, v.pos.z, 18, 3);
        for (const sd of [-1, 1]) g.fx.smoke(v.pos.x + Math.sin(v.yaw) * v.halfLen * sd, v.pos.y + 0.3, v.pos.z + Math.cos(v.yaw) * v.halfLen * sd, 1.2);
        g.camRig.addShake(0.12);
      }
    }
    if (!r.flags.real && t >= END) {
      // all real now: its own surfaces back
      r.flags.real = true;
      this.restore(r);
    }
    if (r.held || r.toHero) this.fly(r, t);
    else if (r.flags.real) r.done = true;
  }

  // a held thing: hangs where it was drawn, then into the hand
  fly(r, t) {
    const k = smooth((t - (END - 0.12)) / FLY);
    if (r.held) {
      const pr = r.held.present;
      if (pr) pr.k = k;
      if (k >= 1) {
        delete r.held.present;
        r.done = true;
      }
      return;
    }
    // the plaster flies onto the hero, the parachute onto the back: smaller and smaller
    const g = this.game;
    const p = g.player;
    const j = p.fig.j;
    const to = _w.copy(j.neck).lerp(j.hip, 0.38);
    if (r.toHero === 'back') to.addScaledVector(p.fig.forward, -0.22);
    const target = _m.compose(to, r.frame.q, _sa.set(0.04, 0.04, 0.04));
    const root = r.root;
    blendMatrix(r.frame.matrix, target, k, root.matrix, 0.4);
    root.matrixWorldNeedsUpdate = true;
    if (k >= 1) {
      g.scene.remove(root);
      g.fx.twinkle(to.x, to.y, to.z, 0.5, [1, 0.9, 0.6], 0.5);
      g.fx.glints(to.x, to.y, to.z, 6, [1, 0.9, 0.55]);
      if (r.onArrive) r.onArrive();
      r.done = true;
    }
  }

  restore(r) {
    if (r.onReal) r.onReal();
    if (r.swaps) {
      for (const [m, mat] of r.swaps) m.material = mat;
      for (const c of r.copies) c.dispose();
      r.swaps = null;
    }
    if (r.car && r.car.mat === r) r.car.mat = null;
    if (r.vehicle) r.vehicle.materializing = false;
  }

  lowerBound(arr, d) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].d < d) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
