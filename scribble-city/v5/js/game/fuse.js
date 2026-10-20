import * as THREE from 'three';
import { readMark, asType, shapeOf, onItAll } from './fusemark.js';
import { readDrawing, buildDrawn, floatK, wingGlide, rotorLift } from './fusedraw.js';
import { PartPen } from './partpen.js';
import { boxOf, along, pathLen } from './signshape.js';
import { wheelModel, wingModel, rotorModel, jetModel, packModel, springModel, bumperModel, barrelModel, ramModel, sideBladeModel, bladeModel, carArmorModel, vestModel, balloonModel, magnetModel, starModel, boltModel, smokeModel, chuteModel, floatModel, paintOf } from './fusemodel.js';
import { isWater } from './rides.js';
import { KINDS, skinHit } from '../render/cars.js';
import { INKS } from './freeform.js';
import { gunOf } from './partsum.js';
import { HANDLING } from './vehicles.js';
import { groundHeight, WATER_X } from '../world/layout.js';
import { clamp, damp } from '../core/util.js';

// (ROADMAP 11.20) Fusing: a part drawn onto a thing, in one stroke, on the run.
//
// What it is, where it goes and its numbers come from the stroke (game/fusemark.js); the part is
// built as a real one (game/fusemodel.js) and it does on that thing what it does - one rule a part,
// the same on everything:
//   wheel   it rolls        round: fast; teeth: up kerbs and steps; huge: over everything; square: it clunks
//   wing    it glides       the bigger the wing, the longer the glide
//   rotor   it lifts        if the rotor is big enough for what it lifts
//   jet     it pushes       the way it points (out of the back: forward; out of the front: fire)
//   spring  it jumps        more coils, higher
//   barrel  it fires        longer: further and truer; a box of a barrel: a cannon; its ink: what it fires
//   blade   it cuts         at the nose a ram, at the sides knives
//   armor   it holds        more of it covered, more it holds - and heavier
//   balloon it floats       big enough for its weight: it goes up
//   magnet  it pulls        metal to it - cars, guns, coins
// (ROADMAP 11.21) and, each one line drawn out of it:
//   star    star power      ten seconds: nothing hurts it, it smashes through, faster - then it is spent
//   bolt    it zaps         a coil on the roof: who comes near - a gangster, a police car - gets a bolt
//   smoke   it hides        a spiral at its back: chased, it lays ink smoke the police cannot see through
//   chute   it floats down  an arch over it: falling, it opens
//   float   it swims        a long shape low along it: on the water it floats and drives on
// On what is yours (your car, you, your gun) it stays; on others (a police car, a gangster, a man in
// the street) it does its thing for a few seconds and goes.

export const PARTS = {
  wheel: { name: 'גלגל', mark: 'עיגול, נמוך', cost: 8, col: [0.24, 0.24, 0.28] },
  wing: { name: 'כנף', mark: 'צורה צרה או קו — לצד', cost: 10, col: [0.95, 0.93, 0.88] },
  rotor: { name: 'רוטור', mark: 'קו ישר — מעל', cost: 14, col: [0.86, 0.2, 0.18] },
  jet: { name: 'סילון', mark: 'זיגזג של להבה — מאחור', cost: 12, col: [0.82, 0.83, 0.86] },
  spring: { name: 'קפיץ', mark: 'סליל של לולאות — מתחת', cost: 8, col: [0.86, 0.84, 0.3] },
  barrel: { name: 'קנה', mark: 'קו שיוצא ממנו', cost: 12, col: [0.3, 0.33, 0.3] },
  blade: { name: 'להב', mark: 'קשת', cost: 8, col: [0.85, 0.86, 0.9] },
  armor: { name: 'שריון', mark: 'קווקוו — עליו', cost: 10, col: [0.5, 0.52, 0.57] },
  balloon: { name: 'בלון', mark: 'עיגול — מעליו', cost: 10, col: [0.92, 0.2, 0.24] },
  magnet: { name: 'מגנט', mark: 'U', cost: 10, col: [0.86, 0.12, 0.14] },
  star: { name: 'כוכב', mark: 'כוכב — מחוץ לה', cost: 24, col: [1, 0.82, 0.18] },
  bolt: { name: 'ברק', mark: 'ברק (Z) — יוצא ממנה', cost: 14, col: [0.45, 0.78, 1] },
  smoke: { name: 'עשן', mark: 'ספירלה — מאחור', cost: 10, col: [0.55, 0.56, 0.62] },
  chute: { name: 'מצנח', mark: 'קשת ∩ — מעליה', cost: 10, col: [0.95, 0.38, 0.32] },
  float: { name: 'מצופים', mark: 'צורה ארוכה — מתחת, לאורכה', cost: 12, col: [1, 0.55, 0.16] },
  // (ROADMAP 11.22) anything else drawn out of your car: on it as drawn
  deco3: { name: 'קישוט', mark: '', cost: 6, col: [0.94, 0.92, 0.86] },
};
export const PART_ORDER = ['wheel', 'wing', 'rotor', 'jet', 'spring', 'barrel', 'blade', 'armor', 'balloon', 'magnet', 'star', 'bolt', 'smoke', 'chute', 'float'];

// what a part can be put on
const ALLOW = {
  veh: new Set(['wheel', 'wing', 'rotor', 'jet', 'spring', 'barrel', 'blade', 'armor', 'balloon', 'magnet', 'star', 'bolt', 'smoke', 'chute', 'float', 'deco3']),
  hero: new Set(['wheel', 'wing', 'rotor', 'jet', 'spring', 'barrel', 'blade', 'armor', 'balloon', 'magnet', 'star', 'bolt', 'chute']),
  weapon: new Set(['barrel', 'blade', 'spring', 'magnet', 'jet', 'wing', 'armor', 'rotor']),
  car: new Set(['balloon', 'rotor', 'jet', 'spring', 'magnet', 'wheel', 'barrel', 'wing']),
  person: new Set(['balloon', 'rotor', 'jet', 'spring', 'magnet', 'wheel']),
};
const MINE = { star: 'כוכב — רק על מה ששלכם', bolt: 'ברק — רק על מה ששלכם', smoke: 'עשן — רק על הרכב שלכם', chute: 'מצנח — רק על מה ששלכם', float: 'מצופים — רק על הרכב שלכם' };
const WHY_NOT = {
  car: { blade: 'להב — רק על מה ששלכם', armor: 'שריון — רק על מה ששלכם', ...MINE },
  person: { wing: 'כנף על אדם — רק על הגיבור', barrel: 'קנה — רק על מה ששלכם', blade: 'להב — רק על מה ששלכם', armor: 'שריון — רק על מה ששלכם', ...MINE },
  weapon: { wheel: 'גלגל על נשק לא עושה כלום', balloon: 'בלון על נשק לא עושה כלום' },
  hero: { smoke: 'עשן — רק על רכב', float: 'מצופים — רק על רכב' },
};
// (what goes on yours: how many of them)
const MAX_ON_VEH = 8;
// (ROADMAP 11.22) more drawn onto the part just made, over it, within this long (ms): one drawing
// with it - its other half, the lines inside it
const MERGE_MS = 6000;
// (how big a part drawn on it usually is, to its box on screen - the reading's guess at what a
// stroke over two things is meant for)
const SIZE_ON = { veh: 0.4, car: 0.4, hero: 0.3, person: 0.45, weapon: 0.9 };
// (ROADMAP 11.21) the pen out: the city slows right down while you draw - how slow
const SLOW = 0.12;
// (ROADMAP 11.21) a line drawn on a car that is no part stays on it: how many on one car (the oldest
// goes)
const DECOR_MAX = 14;
// (what a part drawn on can be swapped for another on: what is yours - what is on others is gone
// to do its thing at once)
const SWAPS = new Set(['veh', 'hero', 'weapon']);
const MAX_ON_HERO = 3;
const HERO_T = 90;
// (ROADMAP 11.21) the edge under ink on a car: paper white, or dark under a light ink
const EDGE_PAPER = [1, 0.98, 0.93];
const EDGE_DARK = [0.1, 0.09, 0.16];
// (ROADMAP 11.21) star power: how long it lasts; how high floats keep a car on the water
const STAR_T = 10;
const WATER_RIDE = -0.96;
// (the ink each costs: the part's, a little more for a big one)
const INK_EL = [null, null, 'fire', 'blast', 'shock', 'glue', 'water', 'ink', 'bounce', 'tippex', 'light'];

const _m = new THREE.Matrix4();
const _mi = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _cf = new THREE.Vector3();
const UPY = new THREE.Vector3(0, 1, 0);
const fmt = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toString();

export class Fuse {
  constructor(game) {
    this.game = game;
    // the hero's parts: { part, model }
    this.hero = [];
    this.heroFuel = { rotor: 5, jet: 3 };
    // what is done to others, for a while: { kind, ref, part, t0, until, st, model }
    this.others = [];
    this.last = null;
    this.stats = { made: 0, byType: {}, onto: {} };
    this.tagEl = null;
    this.tagT = 0;
    this.tagAt = null;
    this.combosSeen = new Set();
    // (ROADMAP 11.21) the time to draw: the pace things go at now (1: as ever); the camera by the
    // car you drive (0-1), where it stands in the car's frame and its side of it
    this.tk = 1;
    this.sk = 0;
    this.skSpot = [3.2, 3.7, -3.6];
    this.skSide = 1;
    this.slowOn = false;
    // (the part just put on: it grows into place)
    this.justAdded = null;
    // (the city's cars with ink on them)
    this.decorCars = new Set();
    // (the coil's bolts, in flight a moment: { a, b, t0 })
    this.zaps = [];
    this.heroZap = { reach: 7, cool: 0 };
    this.heroChuteOpen = false;
    // (the part just made: how long after it is put on it grows in, ms)
    this.popDelay = 0;
    // (ROADMAP 11.24) in your car: a part said, then drawn - and the parts kept, a tap away
    // (game/partpen.js)
    this.pen = new PartPen(this);
  }

  // ------------------------------------------------------------------ what is on screen, and where
  screen(x, y, z) {
    _v.set(x, y, z).project(this.game.camera);
    return { x: ((_v.x + 1) / 2) * window.innerWidth, y: ((1 - _v.y) / 2) * window.innerHeight, front: _v.z < 1 && _v.z > -1 };
  }

  // the things a part could be drawn on now: { kind, ref, M (its frame to the world), D, prio }
  targets() {
    const g = this.game;
    const p = g.player;
    const cam = g.camera.position;
    const out = [];
    const near = (x, z, r) => Math.hypot(x - cam.x, z - cam.z) < r;
    const add = (kind, ref, x, y, z, yaw, D, prio, extra) => {
      const M = new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromAxisAngle(UPY, yaw), _s.set(1, 1, 1));
      out.push({ kind, ref, M, D, prio, ...(extra || {}) });
    };
    for (const v of g.vehicles.list) {
      if (v.dead || v.materializing || !near(v.pos.x, v.pos.z, 80)) continue;
      // (the car you drive - more so with the pen out in it, the camera on it: what is drawn round it
      // is for it, not for the cafe's people behind it. ROADMAP 11.21)
      const own = v === p.inVehicle ? 0.3 + (this.sk > 0.5 ? 0.5 : 0) : 0.08;
      out.push({ ...this.vehTarget(v), prio: own });
    }
    if (p.mode === 'foot') {
      const s = p.fig.scale || 1;
      add('hero', p, p.pos.x, p.pos.y, p.pos.z, p.fig.yaw !== undefined ? p.fig.yaw : p.yaw, { hl: 0.24 * s, hw: 0.32 * s, h: 1.82 * s }, 0.1);
      // (the gun in the hand - not the pencil you draw with)
      const slot = g.weapons.current;
      const wb = slot && !slot.def.bare && slot.def.id !== 'pencil' && slot.model && slot.model.group ? this.weaponBox(slot) : null;
      if (wb) out.push({ kind: 'weapon', ref: slot, M: wb.M, D: wb.D, prio: 0.1 });
    }
    for (const c of g.traffic.list) {
      if (c.gone || c.taken || c.poofT !== undefined || c.spec.kind === 'moto' || !near(c.pos.x, c.pos.z, 75)) continue;
      add('car', c, c.pos.x, c.pos.y || 0, c.pos.z, c.yaw, carDims(c), 0, { wheelR: carWheelR(c), skin: KINDS[c.spec.kind] ? c.spec.kind : null });
    }
    for (const c of g.traffic.parked || []) {
      if (c.taken || c.gone || !near(c.pos.x, c.pos.z, 60)) continue;
      add('car', c, c.pos.x, c.pos.y || 0, c.pos.z, c.yaw, carDims(c), -0.04, { wheelR: carWheelR(c), skin: KINDS[c.spec.kind] ? c.spec.kind : null });
    }
    for (const e of g.enemies.list) {
      if (!e.alive || e.isMonster || !near(e.pos.x, e.pos.z, 50)) continue;
      add('person', e, e.pos.x, e.pos.y, e.pos.z, e.yaw || 0, { hl: 0.24, hw: 0.32, h: e.height || 1.8 }, 0.02);
    }
    for (const c of g.civilians.list) {
      if (!c.alive || c.inside || c.riding || !near(c.pos.x, c.pos.z, 40)) continue;
      add('person', c, c.pos.x, c.pos.y, c.pos.z, c.yaw || 0, { hl: 0.22, hw: 0.3, h: 1.75 * (c.fig.scale || 1) }, 0);
    }
    return out;
  }

  // (ROADMAP 11.23) a car of yours as a thing to draw on: its frame, its size, its paint
  vehTarget(v) {
    const M = new THREE.Matrix4().compose(_p.set(v.pos.x, v.pos.y + (v.fz && v.fz.lift ? v.fz.lift : 0), v.pos.z), _q.setFromAxisAngle(UPY, v.yaw), _s.set(1, 1, 1));
    return { kind: 'veh', ref: v, M, D: vehDims(v), prio: 0.3, wheelR: vehWheelR(v), skin: v.kind === 'car' ? (KINDS[v.carKind] ? v.carKind : 'sedan') : null };
  }

  // the gun in your hand as a box in its own frame (its hand frame: x across, y up, z forward)
  weaponBox(slot) {
    const grp = slot.model.group;
    if (!slot.model.fzBox) {
      const B = new THREE.Box3();
      grp.updateMatrixWorld(true);
      _mi.copy(grp.matrixWorld).invert();
      grp.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(_m.multiplyMatrices(_mi, o.matrixWorld));
        B.union(b);
      });
      if (B.isEmpty()) return null;
      slot.model.fzBox = B;
    }
    const B = slot.model.fzBox;
    const M = grp.matrixWorld.clone().multiply(_m.makeTranslation((B.min.x + B.max.x) / 2, B.min.y - 0.02, (B.min.z + B.max.z) / 2));
    return { M, D: { hl: (B.max.z - B.min.z) / 2 + 0.02, hw: (B.max.x - B.min.x) / 2 + 0.03, h: B.max.y - B.min.y + 0.04 } };
  }

  // a thing's frame as seen on screen (game/fusemark.js reads strokes in it); null off screen
  frameOf(t) {
    const cam = this.game.camera;
    const D = t.D;
    const pts = [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        for (const y of [0, D.h]) {
          _v.set(b * D.hw, y, a * D.hl).applyMatrix4(t.M);
          const q = this.screen(_v.x, _v.y, _v.z);
          if (!q.front) return null;
          pts.push(q);
          x0 = Math.min(x0, q.x);
          x1 = Math.max(x1, q.x);
          y0 = Math.min(y0, q.y);
          y1 = Math.max(y1, q.y);
        }
      }
    }
    if (x1 < 0 || y1 < 0 || x0 > window.innerWidth || y0 > window.innerHeight) return null;
    const Mi = t.M.clone().invert();
    _w.set(0, D.h / 2, 0).applyMatrix4(t.M);
    const dist = _w.distanceTo(cam.position);
    const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / window.innerHeight;
    const c0 = this.screen(_w.x, _w.y, _w.z);
    _v.set(0, D.h / 2 + 1, 0).applyMatrix4(t.M);
    const c1 = this.screen(_v.x, _v.y, _v.z);
    const ul = Math.hypot(c1.x - c0.x, c1.y - c0.y) || 1;
    // the camera's way, in the thing's frame (for what is beside it, level with its middle)
    _cf.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const cfl = _cf.clone().transformDirection(Mi);
    const box = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    const local = (sx, sy) => {
      _d.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
      const o = _o.copy(cam.position).applyMatrix4(Mi);
      const d = _d.transformDirection(Mi);
      // (the box: x within its width, y off the ground up to its top, z its length)
      let tn = -Infinity;
      let tf = Infinity;
      // (the side of it the ray goes in by: [axis, -1 | 1])
      let fa = -1;
      let fs = 0;
      const lo = [-D.hw, 0, -D.hl];
      const hi = [D.hw, D.h, D.hl];
      const oa = [o.x, o.y, o.z];
      const da = [d.x, d.y, d.z];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(da[i]) < 1e-9) {
          if (oa[i] < lo[i] || oa[i] > hi[i]) ok = false;
          continue;
        }
        let a = (lo[i] - oa[i]) / da[i];
        let b = (hi[i] - oa[i]) / da[i];
        let sd = -1;
        if (a > b) {
          [a, b] = [b, a];
          sd = 1;
        }
        if (a > tn) {
          tn = a;
          fa = i;
          fs = sd;
        }
        tf = Math.min(tf, b);
      }
      if (ok && tn <= tf && tf > 0) {
        const tt = Math.max(0, tn);
        return { p: [o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt], hit: true, t: tt, t1: tf, face: fa >= 0 ? [fa, fs] : null, o: oa, d: da };
      }
      // (off it: where the ray passes the plane through its middle, square to the eye)
      const den = d.x * cfl.x + d.y * cfl.y + d.z * cfl.z;
      const tt = Math.abs(den) < 1e-6 ? dist : ((0 - o.x) * cfl.x + (D.h / 2 - o.y) * cfl.y + (0 - o.z) * cfl.z) / den;
      return { p: [o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt], hit: false, o: oa, d: da };
    };
    // (ROADMAP 11.21) a car of the city's kinds: where the ray meets its paint - { p, n } or null
    const skin = t.skin || null;
    const skinAt = skin
      ? (sx, sy) => {
          const r = local(sx, sy);
          return r.hit ? skinHit(skin, r.o, r.d, r.t, r.t1) : null;
        }
      : null;
    return { kind: t.kind, D, dims: D, local, skinAt, perPx, box, up: [(c1.x - c0.x) / ul, (c1.y - c0.y) / ul], dist, wheelR: t.wheelR, view: [cfl.x, cfl.y, cfl.z] };
  }

  // ------------------------------------------------------------------ reading the stroke
  // strokes: the page's (one stroke, [x, y] in the page's units), U: px a unit. Returns
  // { t (the target), F (its frame), m (the mark) } or null
  match(strokes, U) {
    if (strokes.length !== 1) return null;
    const P = strokes[0].map(([x, y]) => [x * U, y * U]);
    if (P.length < 4) return null;
    const B = boxOf(P);
    const S = Math.max(B.w, B.h, 1);
    const a = P[0];
    const b = P[P.length - 1];
    const inBox = (q, bx, m) => q[0] >= bx.x0 - m && q[0] <= bx.x1 + m && q[1] >= bx.y0 - m && q[1] <= bx.y1 + m;
    const cands = [];
    for (const t of this.targets()) {
      const F = this.frameOf(t);
      if (!F) continue;
      const bx = F.box;
      const w = Math.max(10, bx.w);
      const h = Math.max(10, bx.h);
      // (drawn on it or by it: over its box, a little round it, and well above it - for what goes
      // over it)
      if (B.x1 < bx.x0 - w * 0.5 || B.x0 > bx.x1 + w * 0.5 || B.y1 < bx.y0 - h * 1.3 || B.y0 > bx.y1 + h * 0.7) continue;
      const k = S / Math.max(w, h);
      if (k > 2.8 || k < 0.02) continue;
      // (the gun in the hand: only what is drawn out of it - one end on it)
      if (t.kind === 'weapon' && !inBox(a, bx, Math.max(10, w * 0.25)) && !inBox(b, bx, Math.max(10, w * 0.25))) continue;
      // how far off it the stroke is, in the stroke's own size (a balloon over a far man's head is as
      // near him as one over yours is to you)
      const gx = Math.max(0, bx.x0 - B.cx, B.cx - bx.x1);
      const gy = Math.max(0, bx.y0 - B.cy, B.cy - bx.y1);
      const off = Math.hypot(gx, gy) / Math.max(S, Math.min(w, h) * 0.5, 16);
      // (the size a part drawn on it usually is, to it: big on you - you are near - and on a gun)
      const cost = off * 0.6 + Math.abs(Math.log(Math.max(0.05, k) / (SIZE_ON[t.kind] || 0.4))) * 0.3 + F.dist * 0.004 - t.prio - (t.kind === 'weapon' ? 0.5 : 0);
      cands.push({ F, t, cost });
    }
    // what is under the pen: along the stroke, the nearest thing each point's ray meets (one in front
    // of another has the point) - and where the pen went down most of all (a part is drawn out of
    // the thing: a wing from the shoulder, a flame from the back)
    if (cands.length > 1) {
      const Q = along(P, 12);
      Q.unshift(a);
      Q.push(b);
      const own = new Map();
      Q.forEach((q, i) => {
        let best = null;
        let bt = Infinity;
        for (const c of cands) {
          const r = c.F.local(q[0], q[1]);
          if (r.hit && r.t < bt) {
            bt = r.t;
            best = c;
          }
        }
        if (!best) return;
        // (the first point: the pen down; the last: where it lifted)
        const w = i === 0 ? 4 : i === Q.length - 1 ? 1.5 : 1;
        own.set(best, (own.get(best) || 0) + w);
      });
      const tot = Q.length + 3.5;
      for (const c of cands) c.cost -= ((own.get(c) || 0) / tot) * 1.2;
    }
    // (a line that starts on the gun in your hand is the gun's - whatever it crosses after)
    for (const c of cands) if (c.t.kind === 'weapon' && inBox(a, c.F.box, 6)) c.cost -= 2;
    cands.sort((p, q) => p.cost - q.cost);
    // (all on the car you drive: it is the car's - a part of it, or ink on it - not anything's behind
    // it. ROADMAP 11.21)
    const mine = cands.find((c) => c.t.kind === 'veh' && c.t.ref === this.game.player.inVehicle);
    if (mine) {
      const Q = along(P, 24);
      const loc = Q.map(([x, y]) => mine.F.local(x, y));
      // (on its paint all along - or on it all along, a line low along its sill dipping off the paint)
      let onBox = 0;
      for (const o of loc) if (o.hit) onBox++;
      if (onItAll(mine.F, Q, loc) || onBox >= Q.length * 0.9) {
        const m = readMark(P, mine.F);
        return m ? { t: mine.t, F: mine.F, m, P } : null;
      }
    }
    // (a part that cannot go on the nearest thing is for the next one under the pen, not far behind
    // it: a star over your car is your car's, not the man's at the table behind it)
    let first = null;
    for (const c of cands.slice(0, 5)) {
      if (first && c.cost > cands[0].cost + 1.2) break;
      const m = readMark(P, c.F);
      if (!m) continue;
      if (ALLOW[c.t.kind].has(m.type)) return { t: c.t, F: c.F, m, P };
      if (!first) first = { t: c.t, F: c.F, m, P };
    }
    return first;
  }

  // ------------------------------------------------------------------ putting it on
  // M: what match gave, inkI: the pen's ink. true if it went on (false: not enough ink - the
  // stroke is gone either way)
  run(M, inkI = 1) {
    const game = this.game;
    let { t, m } = M;
    // (a barrel drawn on the hero, a gun in his hand: it goes on the gun)
    if (t.kind === 'hero' && m.type === 'barrel') {
      const slot = game.weapons.current;
      if (slot && slot.def.kind === 'gun' && slot.model) {
        const wb = this.weaponBox(slot);
        if (wb) t = { kind: 'weapon', ref: slot, M: wb.M, D: wb.D };
      }
      if (t.kind === 'hero') {
        this.say('קנה — מציירים אותו על נשק שביד', 'bad');
        return false;
      }
    }
    if (!ALLOW[t.kind].has(m.type)) {
      this.say((WHY_NOT[t.kind] && WHY_NOT[t.kind][m.type]) || `${PARTS[m.type].name} לא עושה כאן כלום`, 'bad');
      return false;
    }
    const info = PARTS[m.type];
    const cost = Math.round(info.cost * clamp(0.8 + (m.sizeM || 1) * 0.12, 0.8, 1.5));
    const ink = game.ink;
    if (ink && ink.level < cost) {
      game.hud.toast(`אין מספיק דיו ל${info.name} (צריך ${cost})`, 'bad', 2);
      game.audio.play('meh', 0.5);
      return false;
    }
    const part = { type: m.type, v: m.v, n: m.n, at: m.at, dir: m.dir, ink: inkI, t0: game.time, cost, id: Math.random().toString(36).slice(2, 8) };
    // (star power lasts its while, then it is spent)
    if (m.type === 'star') part.until = game.time + STAR_T;
    let res = null;
    this.justAdded = part;
    if (t.kind === 'veh') res = this.onVehicle(t.ref, part);
    else if (t.kind === 'hero') res = this.onHero(part);
    else if (t.kind === 'weapon') res = this.onWeapon(t.ref, part);
    else if (t.kind === 'car') res = this.onCar(t.ref, part);
    else if (t.kind === 'person') res = this.onPerson(t.ref, part);
    this.justAdded = null;
    if (!res) return false;
    // (ink where it went on)
    if (t.kind === 'veh' && part.at) {
      const v = t.ref;
      const c = Math.cos(v.yaw);
      const sn = Math.sin(v.yaw);
      const [ax, ay, az] = part.at;
      const ik = INKS[inkI];
      game.fx.sparks(v.pos.x + ax * c + az * sn, (v.pos.y || 0) + ay, v.pos.z - ax * sn + az * c, 12, ik && !ik.pencil ? ik.c : PARTS[m.type].col);
    }
    if (ink) ink.spend(cost);
    this.stats.made++;
    this.stats.byType[m.type] = (this.stats.byType[m.type] || 0) + 1;
    this.stats.onto[t.kind] = (this.stats.onto[t.kind] || 0) + 1;
    this.last = { kind: t.kind, ref: t.ref, part, t: game.time, M: { ...M, t, m } };
    // (ROADMAP 11.21: on your car - or, just a drawing after all: the same line as ink on it, a tap
    // away)
    if (t.kind === 'veh' && M.F && M.P) this.last.ink = this.inkLine(M.F, M.P, inkI);
    game.audio.play('magic', 0.45);
    game.audio.play('click', 0.4);
    // (not what was meant? the other parts the same stroke could be, a tap away - on what is yours)
    const alts = SWAPS.has(t.kind) ? (m.alts || []).filter((a) => a !== m.type && ALLOW[t.kind].has(a)).slice(0, 3) : [];
    this.tag(res, t, cost, alts, inkI, !!this.last.ink);
    return true;
  }

  // the part just put on, taken off again (the pen's undo, within a few seconds): its ink back
  undo(quiet = false) {
    const L = this.last;
    if (!L || this.game.time - L.t > 8) return false;
    this.last = null;
    if (L.kind === 'veh') this.removeVeh(L.ref, L.part);
    else if (L.kind === 'hero') this.removeHero(L.part);
    else if (L.kind === 'weapon') this.removeWeapon(L.ref, L.part);
    else if (L.kind === 'decor') {
      const list = this.decorOf({ kind: L.tk, ref: L.ref });
      for (const d of L.ds || [L.d]) {
        const i = list.indexOf(d);
        if (i >= 0) list.splice(i, 1);
      }
      if (L.tk === 'veh' && L.ref.fuse && !L.ref.fuse.parts.length && !list.length) this.buildVeh(L.ref);
    } else return false;
    if (this.game.ink && L.part && L.part.cost) this.game.ink.fill(L.part.cost, 'undo');
    if (!quiet) this.say(L.kind === 'decor' ? 'הקו נמחק' : `${PARTS[L.part.type].name} הוסר`, 'info');
    if (this.tagEl && quiet !== 'keep') this.tagEl.classList.remove('on');
    return true;
  }

  // the part just put on, as another part instead (a tap on the tag's "not that one?"): the same
  // stroke where it was drawn, read as that
  swap(type) {
    const L = this.last;
    if (!L || !L.M || this.game.time - L.t > 8) return false;
    // (ROADMAP 11.22: a drawing on your car - the same lines, where they were drawn, read as that)
    if (L.caps) {
      const r = readDrawing(L.caps, this.drawCtx(L.ref), type);
      if (!r || r.kind !== 'part' || !this.undo('keep')) return false;
      r.alts = [L.part.type, ...(L.alts || [])].filter((a) => a && a !== type && a !== 'decor').slice(0, 3);
      return this.makeDrawn(L.M.t, L.caps, r, L.part.ink);
    }
    const M = L.M;
    const m = asType(type, M.m, M.F);
    if (!m || !this.undo('keep')) return false;
    m.alts = [M.m.type, ...(M.m.alts || [])].filter((a) => a && a !== type);
    // (its line as ink stays the one made when it was drawn: the camera has moved on since)
    const ink = L.ink;
    const ok = this.run({ t: M.t, F: M.F, P: M.P, m }, L.part.ink);
    if (ok && ink && this.last) this.last.ink = ink;
    return ok;
  }

  // ------------------------------------------------------------------ the time to draw (ROADMAP 11.21)
  // the pen out, in play: the city slows right down while you draw (game/game.js update, before
  // anything moves) - rdt the real step. The pace things go at now (1: as ever)
  timeK(rdt, on) {
    const was = this.tk;
    this.tk = damp(this.tk, on ? SLOW : 1, on ? 9 : 5, rdt);
    if (!on && this.tk > 0.995) this.tk = 1;
    if (on && was > 0.95 && this.tk <= 0.95) this.game.audio.play('whoosh', 0.3);
    const slow = this.tk < 0.85;
    if (slow !== this.slowOn && typeof document !== 'undefined') {
      this.slowOn = slow;
      document.body.classList.toggle('fz-slow', slow);
    }
    return this.tk;
  }

  // the camera while you draw on the car you drive: close by it, from behind and a little to its
  // side, held in the car's own frame - it stands still on the screen while the street goes by
  // slowly - and back to behind it after. Over what game/game.js has just set, blended in
  sketchCam(v, rdt) {
    const g = this.game;
    const cam = g.camera;
    const on = !!(g.freedraw && g.freedraw.isOpen) && g.state === 'play';
    const c = Math.cos(v.yaw);
    const sn = Math.sin(v.yaw);
    const D = vehDims(v);
    const lift = (v.fz && v.fz.lift) || 0;
    // (its frame: x to its left, z to its nose)
    const toW = (x, y, z, out) => out.set(v.pos.x + x * c + z * sn, (v.pos.y || 0) + lift + y, v.pos.z - x * sn + z * c);
    // where the camera goes - s: the spot in the car's frame - pulled in before a wall: how much of the
    // way there is clear (0-1)
    const coll = g.world && g.world.collision;
    const place = (s, out) => {
      toW(s[0], s[1], s[2], out);
      toW(0, D.h + 0.3, 0, _o);
      _d.subVectors(out, _o);
      const L = _d.length();
      _d.multiplyScalar(1 / L);
      const hit = coll && coll.raycast ? coll.raycast(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, L + 0.3) : null;
      if (!hit) return 1;
      const t = Math.max(1.4, hit.t - 0.35);
      out.copy(_o).addScaledVector(_d, t);
      return t / L;
    };
    if (on && this.sk < 0.01) {
      // (three quarters from behind and high - over the cafes' umbrellas, the awnings - on the side
      // the camera was already on; else on the other side, straight behind, or right over it: the
      // first clear of walls, or the clearest - never inside the building it was parked by)
      const dx = cam.position.x - v.pos.x;
      const dz = cam.position.z - v.pos.z;
      const sd = dx * c - dz * sn >= 0 ? 1 : -1;
      const w = D.hw + 2.3;
      const spots = [[sd * w, D.h + 2.3, -(D.hl + 1.3)], [-sd * w, D.h + 2.3, -(D.hl + 1.3)], [0, D.h + 2.6, -(D.hl + 2.4)], [0, D.h + 4.2, -0.4]];
      let best = -1;
      for (const s of spots) {
        const k = place(s, _p);
        if (k > best + 0.05) {
          best = k;
          this.skSpot = s;
        }
        if (k >= 0.75) break;
      }
      this.skSide = this.skSpot[0] ? Math.sign(this.skSpot[0]) : sd;
    }
    this.sk = damp(this.sk, on ? 1 : 0, on ? 6 : 4, rdt);
    if (this.sk < 0.003) {
      this.sk = 0;
      return;
    }
    // (three quarters from behind and above: its roof, its side and its tail all in view - all of it
    // to draw on)
    place(this.skSpot, _p);
    toW(0, D.h * 0.42, D.hl * 0.12, _w);
    const e = this.sk * this.sk * (3 - 2 * this.sk);
    _m.lookAt(_p, _w, UPY);
    _q.setFromRotationMatrix(_m);
    cam.position.lerp(_p, e);
    cam.quaternion.slerp(_q, e);
    cam.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ ink on a car (ROADMAP 11.21)
  // a line drawn on a car that is no part stays on it, as it was drawn: ink on the car, going where it
  // goes - until undo, the eraser or a part made of it. strokes: the page's (one), U: px a unit, inkI:
  // its ink. true if it went on something
  stick(strokes, U, inkI = 1) {
    if (strokes.length !== 1) return false;
    const g = this.game;
    const P = strokes[0].map(([x, y]) => [x * U, y * U]);
    if (P.length < 2) return false;
    const B = boxOf(P);
    // on what: what the pen went down on (the nearest), else the car you drive if it is by it
    let best = null;
    let bt = Infinity;
    let own = null;
    for (const t of this.targets()) {
      if (t.kind !== 'veh' && t.kind !== 'car') continue;
      const F = this.frameOf(t);
      if (!F) continue;
      if (t.ref === g.player.inVehicle) own = { t, F };
      const r = F.local(P[0][0], P[0][1]);
      if (r.hit && r.t < bt) {
        bt = r.t;
        best = { t, F, r };
      }
    }
    if (!best) {
      if (!own) return false;
      const bx = own.F.box;
      if (B.x1 < bx.x0 - bx.w * 0.6 || B.x0 > bx.x1 + bx.w * 0.6 || B.y1 < bx.y0 - bx.h * 1.2 || B.y0 > bx.y1 + bx.h * 0.8) return false;
      best = { t: own.t, F: own.F, r: null };
    }
    const { t, F } = best;
    const I = this.inkLine(F, P, inkI, best.r);
    if (g.ink && g.ink.level < I.d.cost) {
      g.hud.toast(`אין מספיק דיו (צריך ${I.d.cost})`, 'bad', 2);
      return false;
    }
    this.putInk(t, F, P, I);
    return true;
  }

  // a line on the screen made ink on a thing: each point where its ray meets the thing's paint (a car
  // of the city's kinds: render/cars.js skinHit) or else its box's side; what is drawn off it goes
  // on in the plane where it first met it. A closed one is filled in, the way a pen fills one: strokes
  // across it. P: screen px, r0: its box where the pen went down (if known) - { d (the ink: pts,
  // fill, c, w, cost), on (how much of it is on it, 0-1), sizeM, S (its shape) }
  inkLine(F, P, inkI, r0 = null) {
    const L = pathLen(P);
    const B = boxOf(P);
    const Q = along(P, clamp(Math.round(L / 8), 6, 48));
    const at = (x, y) => (F.skinAt ? F.skinAt(x, y) : null);
    const sk = Q.map(([x, y]) => at(x, y));
    let n = F.view;
    let q0 = [0, F.D.h / 2, 0];
    const k0 = sk.find(Boolean);
    if (k0) {
      n = k0.n;
      q0 = k0.p;
    } else {
      const r = r0 || F.local(P[0][0], P[0][1]);
      if (r.hit && r.face) {
        n = [0, 0, 0];
        n[r.face[0]] = r.face[1];
        q0 = r.p;
      }
    }
    const LIFT = 0.025;
    let on = 0;
    const proj = (x, y, k) => {
      if (k) {
        on++;
        return [k.p[0] + k.n[0] * LIFT, k.p[1] + k.n[1] * LIFT, k.p[2] + k.n[2] * LIFT];
      }
      const r = F.local(x, y);
      if (!F.skinAt && r.hit) on++;
      const den = r.d[0] * n[0] + r.d[1] * n[1] + r.d[2] * n[2];
      if (Math.abs(den) > 0.1) {
        const tt = ((q0[0] - r.o[0]) * n[0] + (q0[1] - r.o[1]) * n[1] + (q0[2] - r.o[2]) * n[2]) / den;
        if (tt > 0) return [r.o[0] + r.d[0] * tt + n[0] * LIFT, r.o[1] + r.d[1] * tt + n[1] * LIFT, r.o[2] + r.d[2] * tt + n[2] * LIFT];
      }
      return r.p;
    };
    const r3 = (q) => q.map((x) => Math.round(x * 1000) / 1000);
    const r2 = (q) => q.map((x) => Math.round(x * 100) / 100);
    const pts = Q.map(([x, y], i) => r3(proj(x, y, sk[i])));
    const sizeM = Math.max(B.w, B.h) * F.perPx;
    const d = { pts, c: inkI, w: clamp(3 + sizeM * 0.5, 3.2, 5), cost: clamp(Math.round(L * F.perPx * 0.8), 1, 5) };
    const onK = on / Q.length;
    const S = shapeOf(P);
    if (S.closed && Math.min(B.w, B.h) > 16) {
      const fill = [];
      for (const [a, b] of hatch(P, Math.max(7, Math.min(B.w, B.h) / 7))) {
        const k = clamp(Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 22), 1, 4);
        const line = [];
        for (let i = 0; i <= k; i++) {
          const x = a[0] + ((b[0] - a[0]) * i) / k;
          const y = a[1] + ((b[1] - a[1]) * i) / k;
          line.push(r2(proj(x, y, at(x, y))));
        }
        fill.push(line);
      }
      if (fill.length) {
        d.fill = fill;
        d.cost = Math.min(6, d.cost + 1);
      }
    }
    return { d, on: onK, sizeM, S };
  }

  // the ink made of a line (inkLine) put on t: it goes where t goes, its tag offers the parts its
  // shape could be made into
  putInk(t, F, P, I) {
    this.putInks(t, F, [{ P, I }]);
  }

  // lines of ink (inkLine's), one drawing, put on t together (undo takes them off together) - alts:
  // what it could be made into, if known
  putInks(t, F, items, alts = null) {
    const g = this.game;
    const list = this.decorOf(t, true);
    const ds = items.map((o) => o.I.d);
    for (const d of ds) list.push(d);
    if (t.kind === 'car') this.decorCars.add(t.ref);
    while (list.length > (t.kind === 'veh' ? DECOR_MAX : 8)) list.shift();
    if (t.kind === 'veh' && !t.ref.fuse.root) this.buildVeh(t.ref);
    // (ROADMAP 11.23: on your car it costs no ink)
    let cost = 0;
    if (t.kind !== 'veh') for (const d of ds) cost += d.cost;
    if (g.ink && cost) g.ink.spend(cost);
    // (the biggest line: what the tag says of it)
    let main = items[0];
    for (const o of items) if (o.I.sizeM > main.I.sizeM) main = o;
    const { P, I } = main;
    const d = I.d;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const q of d.pts) {
      cx += q[0];
      cy += q[1];
      cz += q[2];
    }
    const k = d.pts.length || 1;
    const m = { c: [cx / k, cy / k, cz / k], sizeM: I.sizeM, inside: I.on };
    // (a little sparkle of its ink where it went on)
    if (t.M) {
      _v.set(m.c[0], m.c[1], m.c[2]).applyMatrix4(t.M);
      const ik = INKS[d.c];
      g.fx.sparks(_v.x, _v.y, _v.z, 7, ik && !ik.pencil ? ik.c : [0.3, 0.3, 0.36]);
    }
    if (!alts) alts = guessParts(I.S, m, F).filter((a) => ALLOW[t.kind].has(a)).slice(0, 3);
    this.last = { kind: 'decor', ref: t.ref, tk: t.kind, d, ds, part: { type: 'decor', cost, ink: d.c }, t: g.time, M: { t, F, P, m }, ink: I };
    g.audio.play('click', 0.35);
    const sticker = ds.some((o) => o.fill);
    this.tag({ part: { type: 'decor' }, name: sticker ? 'מדבקה בדיו' : items.length > 1 ? 'ציור בדיו' : 'קו דיו', rule: t.kind === 'veh' ? 'נשאר עליה כמו שציירתם' : 'נשאר עליה, עד שתיעלם', use: 'אפשר להפוך אותו לחלק:' }, t, cost, alts, d.c);
  }

  // the part just put on, as the line it was drawn as instead (its tag's "just a drawing"): ink on
  // it where it was drawn - its ink back, the line's spent
  toInk() {
    const L = this.last;
    if (!L || !L.ink || this.game.time - L.t > 8) return false;
    if (L.caps) return this.undo('keep') && this.inkCaps(L.M.t, L.caps, L.part.ink, [L.part.type, ...(L.alts || [])]);
    const { t, F, P } = L.M;
    const I = L.ink;
    if (!this.undo('keep')) return false;
    const g = this.game;
    if (g.ink && g.ink.level < I.d.cost) {
      g.hud.toast(`אין מספיק דיו (צריך ${I.d.cost})`, 'bad', 2);
      return false;
    }
    this.putInk(t, F, P, I);
    return true;
  }

  // the ink on a thing: a car of yours (in its fuse), a car of the city's (on it); make: start one
  decorOf(t, make = false) {
    if (t.kind === 'veh') {
      const v = t.ref;
      if (make) v.fuse = v.fuse || { parts: [], root: null, models: [] };
      if (!v.fuse) return [];
      if (make && !v.fuse.decor) v.fuse.decor = [];
      return v.fuse.decor || [];
    }
    const c = t.ref;
    if (make && !c.fzDecor) c.fzDecor = [];
    return c.fzDecor || [];
  }

  // its lines, in its frame M, this frame
  drawDecor(fr, list, M, seed0) {
    for (let k = 0; k < list.length; k++) {
      const d = list[k];
      const col = (INKS[d.c] || INKS[1]).c;
      const w = d.w || 3;
      // (under each line a paper-white edge, as a sticker has - it shows on any paint, on the car's own
      // hatching too; under a light ink, a dark one)
      const edge = col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11 > 0.72 ? EDGE_DARK : EDGE_PAPER;
      const sd = seed0 + k * 97;
      inkRun(fr, d.pts, M, edge, w + 3.2, sd, 0.95);
      // (a closed one: the strokes that fill it, a little thinner)
      if (d.fill) for (let j = 0; j < d.fill.length; j++) inkRun(fr, d.fill[j], M, edge, w * 0.66 + 2.4, sd + 300 + j * 7, 0.9);
      inkRun(fr, d.pts, M, col, w, sd, 1);
      if (d.fill) for (let j = 0; j < d.fill.length; j++) inkRun(fr, d.fill[j], M, col, w * 0.66, sd + 300 + j * 7, 0.92);
    }
  }

  // ------------------------------------------------------------------ drawing on your car (ROADMAP 11.22)
  // a line just drawn in a car, kept as it was seen: each point's ray in the car's frame then, where
  // it met its paint, the camera then - and the same line as ink on it, if that is what it turns out
  // to be. A drawing is a few of these, read together once the pen rests (addDrawing). raw: the
  // page's line, U: px a unit. null if the car is not on the screen
  capture(raw, U, inkI = 1) {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || typeof window === 'undefined') return null;
    const t = this.targets().find((o) => o.kind === 'veh' && o.ref === v);
    const F = t && this.frameOf(t);
    if (!F) return null;
    const P = raw.map(([x, y]) => [x * U, y * U]);
    if (P.length < 2) return null;
    const len = pathLen(P);
    const pts = along(P, clamp(Math.round(len / 6), 4, 64)).map(([x, y]) => {
      const r = F.local(x, y);
      let k = F.skinAt ? F.skinAt(x, y) : null;
      if (!F.skinAt && r.hit && r.face) {
        const n = [0, 0, 0];
        n[r.face[0]] = r.face[1];
        k = { p: r.p, n };
      }
      return { s: [x, y], o: r.o, d: r.d, k, hit: r.hit };
    });
    const cam = g.camera;
    cam.updateMatrixWorld();
    const V = cam.matrixWorldInverse.clone().multiply(t.M);
    // (by your car - on it, out of it, over it - or by something else)
    const bx = F.box;
    const box = boxOf(P);
    const near = !(box.x1 < bx.x0 - bx.w * 0.6 || box.x0 > bx.x1 + bx.w * 0.6 || box.y1 < bx.y0 - bx.h * 1.3 || box.y0 > bx.y1 + bx.h * 0.8);
    return { pts, P, len, box, near, view: F.view, t, F, I: this.inkLine(F, P, inkI), cam: { v: Array.from(V.elements), p: Array.from(cam.projectionMatrix.elements), W: window.innerWidth, H: window.innerHeight } };
  }

  // (ROADMAP 11.24) what a car of yours weighs, as its parts' physics take it (applyVeh)
  vehMass(v) {
    const B = v.fzBase;
    const H0 = (B && B.handling) || (!B && v.handling) || HANDLING[v.kind === 'bike' ? v.model || 'bike' : v.carKind] || HANDLING.sedan;
    let m = H0.mass || 1;
    if (v.fuse && v.fuse.parts.some((p) => p.type === 'armor')) m *= 1.2;
    return m;
  }

  // what game/fusedraw.js needs of a car of yours: its size, its kind, its wheels
  drawCtx(v) {
    const D = vehDims(v);
    const K = v.kind === 'car' ? KINDS[v.carKind] || KINDS.sedan : null;
    return { D, K, r0: vehWheelR(v), spots: vehWheelSpots(v, K, D) };
  }

  // the drawing just made on the car you drive (capture's lines, the pen at rest): what it is - by
  // what it looks like and where it is - made of its own lines where they were drawn; or, all of it
  // on its paint, ink on it. inkI: its ink. true if something went on
  addDrawing(caps, inkI = 1) {
    const g = this.game;
    caps = caps.filter(Boolean);
    if (!caps.length) {
      this.say('ציירו על המכונית, או משהו שיוצא ממנה', 'bad');
      return false;
    }
    const t = caps[caps.length - 1].t;
    const v = t.ref;
    if (v !== g.player.inVehicle || v.dead) return false;
    // (drawn on from the lines of what was just made, a moment after it: more of the same drawing -
    // its other edge, the rest of its outline)
    const L = this.last;
    if (L && L.caps && L.ref === v && performance.now() - L.rt < MERGE_MS && touching(caps, L.caps, 16) && this.undo('keep')) caps = L.caps.concat(caps);
    const r = readDrawing(caps, this.drawCtx(v));
    if (r && r.kind === 'part') return this.makeDrawn(t, caps, r, inkI);
    // (on its paint: ink on it, as drawn - and what it could be made into instead)
    const as = readDrawing(caps, this.drawCtx(v), 'part');
    return this.inkCaps(t, caps, inkI, as && as.kind === 'part' ? [as.type, ...as.alts] : []);
  }

  // a drawing read as a part (r: game/fusedraw.js readDrawing) put on your car
  makeDrawn(t, caps, r, inkI) {
    const g = this.game;
    const v = t.ref;
    const info = PARTS[r.type];
    // (ROADMAP 11.23: drawn on your car, it costs no ink)
    const cost = 0;
    const part = { type: r.type, v: r.v, n: r.n, at: r.at, dir: r.dir, shape: r.shape, face: r.face, ink: inkI, t0: g.time, cost, id: Math.random().toString(36).slice(2, 8) };
    if (r.type === 'star') part.until = g.time + STAR_T;
    this.justAdded = part;
    const res = this.onVehicle(v, part);
    this.justAdded = null;
    if (!res) return false;
    this.stats.made++;
    this.stats.byType[r.type] = (this.stats.byType[r.type] || 0) + 1;
    this.stats.onto.veh = (this.stats.onto.veh || 0) + 1;
    const inkable = caps.some((c) => c.I && c.I.on > 0.3);
    const alts = (r.alts || []).filter((a) => a !== r.type && PARTS[a]).slice(0, 3);
    this.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), caps, box: capsBox(caps), alts, ink: inkable || null, M: { t } };
    const c = Math.cos(v.yaw);
    const sn = Math.sin(v.yaw);
    const [ax, ay, az] = part.at;
    const ik = INKS[inkI];
    g.fx.sparks(v.pos.x + ax * c + az * sn, (v.pos.y || 0) + ay, v.pos.z - ax * sn + az * c, 10, ik && !ik.pencil ? ik.c : info.col);
    g.audio.play('magic', 0.45);
    g.audio.play('click', 0.4);
    this.tag({ ...res, drawn: true }, t, cost, alts, inkI, inkable);
    return true;
  }

  // a drawing that is ink on your car: each line of it on its paint, as drawn (alts: the parts it
  // could be made into, a tap away). true if any went on
  inkCaps(t, caps, inkI, alts = []) {
    const items = caps.filter((c) => c.I && (c.I.on > 0.3 || caps.length > 1));
    if (!items.length) {
      this.say('ציירו על המכונית, או משהו שיוצא ממנה', 'bad');
      return false;
    }
    this.putInks(t, items[0].F, items.map((c) => ({ P: c.P, I: c.I })), alts.filter((a) => PARTS[a] && a !== 'deco3').slice(0, 3));
    this.last.caps = caps;
    this.last.box = capsBox(caps);
    this.last.rt = performance.now();
    this.last.alts = alts;
    return true;
  }

  // ------------------------------------------------------------------ on your car
  onVehicle(v, part) {
    const R = (v.fuse = v.fuse || { parts: [], root: null, models: [] });
    // (one of each, but two guns and three things of your own; a wheel replaces the wheels)
    const same = R.parts.filter((p) => p.type === part.type);
    const keep = part.type === 'barrel' ? 1 : part.type === 'deco3' ? 2 : 0;
    while (same.length > keep) this.removeVeh(v, same.shift(), true);
    if (R.parts.length >= MAX_ON_VEH) this.removeVeh(v, R.parts[0], true);
    R.parts.push(part);
    this.applyVeh(v);
    this.buildVeh(v);
    if (part.type === 'smoke') this.puffBehind(v);
    const st = vehRule(part, v);
    return { part, ...st, combos: this.newCombos(v.fz ? v.fz.combos : []) };
  }

  removeVeh(v, part, quiet = false) {
    const R = v.fuse;
    if (!R) return;
    const i = R.parts.indexOf(part);
    if (i < 0) return;
    R.parts.splice(i, 1);
    this.applyVeh(v);
    this.buildVeh(v);
    if (!quiet) this.game.fx.crumbs(v.pos.x, v.pos.y + 1, v.pos.z, 10, 2);
  }

  // the pencil's eraser rubbed on a car of yours (game/weapons.js meleeHit): the part nearest the
  // eraser comes off (rubbed out: no ink back). true if one did
  rubPart(from, f, reach, tip) {
    const g = this.game;
    let best = null;
    let bd = Infinity;
    for (const v of g.vehicles.list) {
      if (!v.fuse || !(v.fuse.parts.length || (v.fuse.decor && v.fuse.decor.length)) || v === g.player.inVehicle || v.dead) continue;
      const dx = v.pos.x - from.x;
      const dz = v.pos.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + 2.6 || dx * f.x + dz * f.z < 0) continue;
      const c = Math.cos(v.yaw);
      const sn = Math.sin(v.yaw);
      for (const p of v.fuse.parts) {
        const [ax, ay, az] = p.at || [0, 0, 0];
        // (its frame: x to its left, z to its nose)
        const wx = v.pos.x + ax * c + az * sn;
        const wz = v.pos.z - ax * sn + az * c;
        const e = Math.hypot(wx - tip.x, (v.pos.y + ay) - tip.y, wz - tip.z);
        if (e < bd) {
          bd = e;
          best = { v, p, wx, wy: v.pos.y + ay, wz };
        }
      }
      // (and the ink on it: where its line comes nearest)
      for (const dc of v.fuse.decor || []) {
        for (const q of dc.pts) {
          const wx = v.pos.x + q[0] * c + q[2] * sn;
          const wz = v.pos.z - q[0] * sn + q[2] * c;
          const e = Math.hypot(wx - tip.x, (v.pos.y + q[1]) - tip.y, wz - tip.z);
          if (e < bd) {
            bd = e;
            best = { v, dc, wx, wy: v.pos.y + q[1], wz };
          }
        }
      }
    }
    if (!best || bd > 3.2) return false;
    if (best.dc) {
      const list = best.v.fuse.decor;
      list.splice(list.indexOf(best.dc), 1);
      g.fx.crumbs(best.wx, best.wy + 0.2, best.wz, 12, 2);
      this.say('הקו נמחק', 'info');
      if (this.last && this.last.d === best.dc) this.last = null;
      return true;
    }
    this.removeVeh(best.v, best.p, true);
    g.fx.crumbs(best.wx, best.wy + 0.3, best.wz, 18, 2.4);
    this.say(`${PARTS[best.p.type].name} נמחק`, 'info');
    if (this.last && this.last.part === best.p) this.last = null;
    return true;
  }

  // what its parts make of it: v.fz, read by game/vehicles.js (drive, collideWorld, draw) - and
  // the fields drawn vehicles already have (game/drawncar.js), on top of what it had
  applyVeh(v) {
    const R = v.fuse;
    if (!v.fzBase) {
      v.fzBase = {
        handling: v.handling || null, glide: v.glide || 0, jets: v.jets || 0, armor: v.armor || 0, bumper: v.bumper || null, blades: v.blades || null,
        ram: v.ram || null, crush: !!v.crush, stomp: v.stomp || null, safeFall: !!v.safeFall, spaceIsMine: !!v.spaceIsMine, turrets: v.turrets || null,
      };
    }
    const B = v.fzBase;
    const H0 = B.handling || HANDLING[v.kind === 'bike' ? v.model || 'bike' : v.carKind] || HANDLING.sedan;
    const H = { ...H0 };
    const fz = { jetK: 1, step: 0, lift: 0, combos: [] };
    v.glide = B.glide;
    v.jets = B.jets;
    v.armor = B.armor;
    v.bumper = B.bumper;
    v.blades = B.blades;
    v.ram = B.ram;
    v.crush = B.crush;
    v.stomp = B.stomp;
    v.safeFall = B.safeFall;
    v.spaceIsMine = B.spaceIsMine;
    v.turrets = B.turrets ? [...B.turrets] : null;
    v.fuseGuns = false;
    const has = {};
    const r0 = vehWheelR(v);
    for (const p of R.parts) {
      has[p.type] = p;
      const n = p.n;
      if (p.type === 'wheel') {
        const big = p.v === 'big' || p.v === 'bigteeth';
        const teeth = p.v === 'teeth' || p.v === 'bigteeth';
        if (p.v === 'round') {
          H.top *= 1.18;
          H.power *= 1.1;
        } else if (p.v === 'small') {
          H.top *= 0.82;
          H.power *= 1.3;
          H.steer *= 1.2;
        } else if (p.v === 'square') {
          H.top *= 0.45;
          H.power *= 0.7;
          fz.bump = 1;
        }
        if (teeth) {
          H.grip += 1.6;
          H.top *= big ? 1 : 0.92;
          fz.step = Math.max(fz.step, 0.68);
        }
        if (big) {
          const Rw = clamp(n.r, r0 * 1.45, r0 * 2.6);
          fz.lift = Rw - r0;
          fz.step = Math.max(fz.step, clamp(Rw * 1.1, 0.8, 1.4));
          H.top *= 0.9;
          H.power *= 0.92;
          H.grip += 0.8;
          v.crush = true;
          v.safeFall = true;
          fz.wheelR = Rw;
        }
        fz.wheels = { v: p.v, r: big ? fz.wheelR : p.v === 'small' ? r0 * 0.7 : r0 * (teeth ? 1.05 : 1), bumps: n.bumps };
        fz.hideWheels = true;
      } else if (p.type === 'wing') {
        if (p.v === 'spoiler') {
          H.grip += 1.3;
          H.top *= 1.03;
        } else {
          v.glide = Math.max(v.glide, wingGlide(n));
          fz.airCtl = Math.max(fz.airCtl || 0, 0.5);
          fz.wing = clamp((n.span || 1) * (n.chord || 0.5), 0.2, 6);
        }
      } else if (p.type === 'rotor') {
        const span = clamp(n.span || 2, 0.6, 9);
        fz.rotor = rotorLift(n, H.mass);
        fz.rotorSpan = span;
        fz.airCtl = Math.max(fz.airCtl || 0, 1);
      } else if (p.type === 'jet') {
        const k = clamp(0.85 + (n.len || 1) * 0.32, 0.9, 1.9);
        if (p.v === 'front') fz.flame = { range: clamp(6 + (n.len || 1) * 4, 7, 18), cool: 0 };
        else if (p.v === 'under') fz.vtol = { power: clamp(8 + (n.len || 1) * 3, 9, 16), fuel: 2.5, max: 2.5 };
        else {
          v.jets = Math.max(1, v.jets || 0);
          fz.jetK = k;
          fz.thrust = clamp(6 + (n.len || 1) * 4, 7, 16);
        }
      } else if (p.type === 'spring') {
        const coils = n.coils || 4;
        if (p.v === 'bumper') v.bumper = { k: clamp(1.4 + coils * 0.14, 1.5, 2.8) };
        else fz.jump = clamp(6 + coils * 0.85 + (n.len || 0.6) * 1.6, 7, 16);
      } else if (p.type === 'barrel') {
        // (the gun itself: game/partsum.js's, as long and as thick as drawn, of its ink)
        const r = n.thick ? clamp(n.r, 0.11, 0.24) : clamp(n.r || 0.06, 0.04, 0.1);
        p.gun = gunOf({ r, len: clamp(n.len || 1, 0.5, 3), el: INK_EL[p.ink] || undefined });
        v.fuseGuns = true;
      } else if (p.type === 'blade') {
        const len = clamp(n.len || 1, 0.4, 3);
        if (p.v === 'side') v.blades = { side: Math.round(clamp(30 + len * 24, 30, 90)), rear: false };
        else v.ram = { k: clamp(1.6 + len * 0.6, 1.6, 3.4), shield: true };
      } else if (p.type === 'armor') {
        v.armor = Math.max(v.armor, clamp(0.25 + (n.cover || 0.3) * 0.55, 0.25, 0.65));
        H.top *= 0.94;
        H.power *= 0.9;
        H.mass = (H.mass || 1) * 1.2;
      } else if (p.type === 'balloon') {
        const d = clamp(n.d || 1.5, 0.5, 6);
        // (as wide as the car, about: it lifts it - a smaller one only slows its fall)
        fz.balloon = clamp((d * d * d * 0.32) / (H.mass || 1), 0.1, 3);
        fz.balloonD = d;
        fz.airCtl = Math.max(fz.airCtl || 0, 0.6);
      } else if (p.type === 'magnet') {
        fz.magnet = { front: p.v !== 'back', reach: clamp(10 + (n.size || 0.8) * 12, 10, 26) };
      } else if (p.type === 'star') {
        // (ROADMAP 11.21) star power: hardly a scratch, through whatever is in the way, faster
        v.armor = Math.max(v.armor, 0.97);
        v.crush = true;
        H.top *= 1.25;
        H.power *= 1.35;
        fz.star = p;
      } else if (p.type === 'bolt') {
        fz.zap = { reach: clamp(9 + (n.size || 1) * 2, 9, 14), cool: 0.4 };
      } else if (p.type === 'smoke') {
        fz.smoke = { charge: 6, max: 6, next: 0 };
      } else if (p.type === 'chute') {
        fz.chute = { span: clamp(n.span || 3, 2.4, 8) };
        fz.airCtl = Math.max(fz.airCtl || 0, 0.45);
      } else if (p.type === 'float') {
        // (ROADMAP 11.23: long and thick enough for its weight, it holds it up - less, it sinks slower)
        fz.float = { len: clamp(n.len || 3.6, 2, 6), k: p.shape ? floatK(n, H.mass) : 1.2 };
      }
    }
    // the combinations: two parts that make something of each other
    if (has.spring && has.wing && has.spring.v !== 'bumper') {
      fz.jump = (fz.jump || 9) * 1.25;
      v.glide = Math.min(0.9, (v.glide || 0) + 0.1);
      fz.combos.push('eagle');
    }
    if (has.wing && has.jet && has.jet.v === 'back') {
      fz.plane = true;
      fz.combos.push('plane');
    }
    if (has.rotor && has.barrel) fz.combos.push('gunship');
    if (has.balloon && has.barrel) fz.combos.push('sniper');
    if (has.blade && has.blade.v === 'ram' && has.jet && has.jet.v === 'back') {
      if (v.ram) v.ram.k *= 1.5;
      fz.combos.push('ironRam');
    }
    if (has.armor && has.wheel && (has.wheel.v === 'teeth' || has.wheel.v === 'bigteeth')) {
      v.armor = Math.min(0.8, v.armor + 0.12);
      v.crush = true;
      fz.combos.push('tank');
    }
    if (has.wheel && (has.wheel.v === 'big' || has.wheel.v === 'bigteeth') && has.spring) {
      v.stomp = { r: 9, dmg: 70 };
      fz.combos.push('monster');
    }
    v.handling = H;
    v.spaceIsMine = B.spaceIsMine || !!(fz.jump || fz.rotor || fz.balloon || fz.vtol);
    v.fuseUp = !!(fz.jump || fz.rotor >= 1 || fz.balloon >= 1 || fz.vtol);
    v.fz = R.parts.length ? fz : null;
    // (the touch buttons: ▲ to jump, to go up)
    if (v.driver === this.game.player) this.game.upDownKey = null;
  }

  // the models of its parts, in its own frame (a city car's: render/cars.js's; a drawn one's: its
  // group)
  buildVeh(v) {
    const R = v.fuse;
    if (R.root) {
      if (R.root.parent) R.root.parent.remove(R.root);
      R.root = null;
    }
    R.models = [];
    if (!R.parts.length && !(R.decor && R.decor.length)) return;
    const root = new THREE.Group();
    const D = vehDims(v);
    const K = v.kind === 'car' ? KINDS[v.carKind] || KINDS.sedan : null;
    const ink = (p) => INKS[p.ink] || null;
    for (const p of R.parts) {
      const col = paintOf(ink(p), PARTS[p.type].col);
      const fz = v.fz || {};
      // (ROADMAP 11.22: drawn on it - made of its own lines, where they were drawn)
      if (p.shape) {
        const { body, line } = drawnColours(ink(p), v, p.type);
        const ms = buildDrawn(p, { D, K, spots: vehWheelSpots(v, K, D), wheelR: fz.wheels ? fz.wheels.r : null, lift: fz.lift || 0 }, body);
        for (const o of ms) {
          o.m.userData.lineC = line;
          root.add(o.m);
          R.models.push({ p, m: o.m, role: o.role, side: o.side });
        }
        continue;
      }
      if (p.type === 'wheel') {
        const w = fz.wheels;
        const spots = vehWheelSpots(v, K, D);
        for (const s of spots) {
          const m = wheelModel(w.r, p.v, col, w.bumps || 10);
          m.position.set(s.x + Math.sign(s.x) * (p.v === 'big' || p.v === 'bigteeth' ? w.r * 0.25 : 0), w.r - (fz.lift || 0), s.z);
          m.userData.front = s.z > 0;
          root.add(m);
          R.models.push({ p, m, role: 'wheel' });
        }
      } else if (p.type === 'wing') {
        if (p.v === 'spoiler') {
          const m = wingModel(D.hw * 1.8, 0.4, 1, col, 'spoiler');
          m.position.set(0, D.h * 0.62, -D.hl * 0.86);
          if (K) m.position.y = beltAt(K, 0.05) + 0.02;
          root.add(m);
          R.models.push({ p, m, role: 'wing' });
        } else {
          const span = clamp(p.n.span || 1.4, 0.7, 4);
          const chord = clamp(p.n.chord || 0.7, 0.35, 1.6);
          for (const s of [1, -1]) {
            const m = wingModel(span, chord, s, col);
            m.position.set(s * (D.hw - 0.08), K ? beltAt(K, 0.5) - 0.12 : D.h * 0.5, clamp(p.at[2], -D.hl * 0.5, D.hl * 0.4));
            root.add(m);
            R.models.push({ p, m, role: 'wing', side: s });
          }
        }
      } else if (p.type === 'rotor') {
        const m = rotorModel(clamp(p.n.span || 2.5, 1, 9), col);
        m.position.set(0, (K ? K.roofY : D.h) - 0.02, clamp(p.at[2], -D.hl * 0.3, D.hl * 0.3));
        root.add(m);
        R.models.push({ p, m, role: 'rotor' });
      } else if (p.type === 'jet') {
        const m = jetModel(p.n.len || 1, col);
        if (p.v === 'front') {
          m.position.set(0, D.h * 0.32, D.hl + 0.05);
          m.rotation.y = Math.PI;
        } else if (p.v === 'under') {
          m.position.set(0, 0.35, 0);
          m.rotation.x = -Math.PI / 2;
        } else {
          m.position.set(0, K ? Math.max(0.45, K.clear + 0.3) : D.h * 0.35, -D.hl - 0.02);
        }
        root.add(m);
        R.models.push({ p, m, role: 'jet' });
      } else if (p.type === 'spring') {
        if (p.v === 'bumper') {
          const m = bumperModel(D.hw * 1.7, 0.45, p.n.coils || 4, col);
          m.position.set(0, K ? K.clear + 0.22 : D.h * 0.3, D.hl - 0.1);
          root.add(m);
          R.models.push({ p, m, role: 'bumper' });
        } else {
          const m = springModel(p.n.coils || 4, 0.22, clamp(D.hw * 0.32, 0.18, 0.4), col);
          m.position.set(0, 0.02, 0);
          root.add(m);
          R.models.push({ p, m, role: 'spring' });
        }
      } else if (p.type === 'barrel') {
        const kind = p.v === 'turret' ? 'turret' : 'fixed';
        const m = barrelModel(p.n.len || 1.2, p.gun.r, kind, col);
        const roof = K ? K.roofY : D.h;
        if (p.v === 'turret') m.position.set(clamp(p.at[0], -D.hw * 0.4, D.hw * 0.4), roof - 0.04, clamp(p.at[2], -D.hl * 0.45, D.hl * 0.35));
        else if (p.v === 'front') m.position.set(clamp(p.at[0], -D.hw * 0.6, D.hw * 0.6), K ? K.hood.y - 0.05 : D.h * 0.55, K ? K.hood.z : D.hl * 0.6);
        else {
          m.position.set(clamp(p.at[0], -D.hw * 0.6, D.hw * 0.6), K ? beltAt(K, 0.06) - 0.04 : D.h * 0.55, -D.hl * 0.82);
          m.userData.pivot.rotation.y = Math.PI;
        }
        root.add(m);
        R.models.push({ p, m, role: 'barrel' });
      } else if (p.type === 'blade') {
        if (p.v === 'side') {
          for (const s of [1, -1]) {
            const m = sideBladeModel(p.n.len || 1, s);
            m.position.set(s * (D.hw + 0.02), (K ? K.clear : 0.25) + 0.12, -0.2);
            root.add(m);
            R.models.push({ p, m, role: 'blade' });
          }
        } else {
          const m = ramModel(D.hw * 2.15, clamp((p.n.len || 1) * 0.25, 0.25, 0.7));
          m.position.set(0, K ? K.clear - 0.08 : 0.15, D.hl + 0.02);
          if (p.v === 'rear') {
            m.position.z = -D.hl - 0.02;
            m.rotation.y = Math.PI;
          }
          root.add(m);
          R.models.push({ p, m, role: 'blade' });
        }
      } else if (p.type === 'armor') {
        const m = carArmorModel(D, p.n.cover || 0.4, K ? K.clear : 0.25);
        root.add(m);
        R.models.push({ p, m, role: 'armor' });
      } else if (p.type === 'balloon') {
        const m = balloonModel(clamp(p.n.d || 1.6, 0.8, 6), col);
        m.userData.base = new THREE.Vector3(0, (K ? K.roofY : D.h) + 1.4 + (p.n.d || 1.6) * 0.3, clamp(p.at[2], -D.hl * 0.3, D.hl * 0.3));
        m.position.copy(m.userData.base);
        root.add(m);
        R.models.push({ p, m, role: 'balloon' });
      } else if (p.type === 'magnet') {
        const m = magnetModel(clamp(p.n.size || 0.8, 0.5, 1.4));
        const fr = p.v !== 'back';
        m.position.set(0, K ? K.clear + 0.35 : D.h * 0.4, fr ? D.hl + 0.12 : -D.hl - 0.12);
        if (!fr) m.rotation.y = Math.PI;
        root.add(m);
        R.models.push({ p, m, role: 'magnet' });
      } else if (p.type === 'star') {
        const m = starModel(clamp(p.n.size || 1, 0.7, 1.5), col);
        m.position.set(0, (K ? K.roofY : D.h) - 0.02, K ? -0.1 : 0);
        root.add(m);
        R.models.push({ p, m, role: 'star' });
      } else if (p.type === 'bolt') {
        const m = boltModel(clamp(p.n.size || 1, 0.8, 1.4), col);
        m.position.set(0, (K ? K.roofY : D.h) - 0.02, K ? -0.55 : -D.hl * 0.3);
        root.add(m);
        R.models.push({ p, m, role: 'bolt' });
      } else if (p.type === 'smoke') {
        const m = smokeModel(col);
        m.position.set(0, K ? Math.max(0.42, K.clear + 0.22) : D.h * 0.3, -D.hl - 0.02);
        root.add(m);
        R.models.push({ p, m, role: 'smoke' });
      } else if (p.type === 'chute') {
        const m = chuteModel(p.n.span || 3, col);
        m.position.set(0, (K ? K.roofY : D.h) - 0.02, K ? 0.1 : 0);
        root.add(m);
        R.models.push({ p, m, role: 'chute' });
      } else if (p.type === 'float') {
        const m = floatModel(clamp(D.hl * 2 * 0.86, 2, 6), D.hw, col);
        m.position.set(0, 0.2, 0);
        root.add(m);
        R.models.push({ p, m, role: 'float' });
      }
    }
    // (ROADMAP 11.21: the part just put on grows into its place)
    if (this.justAdded) {
      for (const o of R.models) {
        if (o.p !== this.justAdded) continue;
        o.m.userData.popAt = performance.now() + this.popDelay;
        o.m.scale.setScalar(0.02);
      }
    }
    // (a car of the city's: its frame comes from the car batches each frame - place(); a drawn
    // one's group carries it)
    if (v.kind === 'car') {
      root.matrixAutoUpdate = false;
      this.game.scene.add(root);
    } else v.group.add(root);
    R.root = root;
    R.turrets = R.models.filter((o) => o.role === 'barrel').map((o) => {
      const ud = o.m.userData;
      // (a drawn one turns from the way it was drawn, about its foot)
      const yaw0 = ud.yaw0 !== undefined ? ud.yaw0 : o.p.v === 'rear' ? Math.PI : 0;
      return { node: ud.pivot, muzzle: ud.muzzle.clone(), pivot: ud.pivotPt ? ud.pivotPt.clone() : new THREE.Vector3(0, ud.muzzle.y, 0), yaw0, arc: o.p.v === 'turret' ? Math.PI : 0.45, r: ud.r, gun: o.p.gun, yaw: yaw0, cool: 0 };
    });
    if (R.turrets.length) v.turrets = [...(v.fzBase.turrets || []), ...R.turrets];
    // (a gun that turns all the way: rate of fire up on a rotor - the gunship; true as a sniper's
    // on a balloon)
    const fz = v.fz;
    if (fz && fz.combos.includes('gunship')) for (const t of R.turrets) t.gun = { ...t.gun, reload: t.gun.reload * 0.72 };
    if (fz && fz.combos.includes('sniper')) for (const t of R.turrets) t.gun = { ...t.gun, spread: t.gun.spread * 0.4, speed: t.gun.speed * 1.2 };
  }

  // (game/vehicles.js draw: a city car's frame from the car batches) its parts follow it
  place(v, m) {
    const R = v.fuse;
    if (!R || !R.root) return;
    R.root.matrix.copy(m);
    R.root.matrixWorldNeedsUpdate = true;
  }

  // ------------------------------------------------------------------ how your car goes with them
  // (game/vehicles.js drive, before its own: jump on the spring, lift off on the rotor, the balloon)
  preDrive(v, dt, input) {
    const fz = v.fz;
    if (!fz || !input) return;
    const up = input.keys.has('Space') || input.flyUp;
    const press = input.wasPressed('Space') || (input.flyUp && !v.fzUpWas);
    v.fzUpWas = !!input.flyUp;
    if (!v.air && !v.flipped) {
      if (fz.jump && press) {
        v.air = true;
        v.vy = fz.jump;
        v.fzSpringT = this.game.time;
        this.game.audio.play('jump', 0.8);
        this.game.fx.sparks(v.pos.x, v.pos.y + 0.2, v.pos.z, 6, [0.8, 0.8, 0.85]);
        this.game.camRig.addShake(0.15);
      } else if (up && (fz.rotor >= 1 || fz.balloon >= 1 || (fz.vtol && fz.vtol.fuel > 0.3))) {
        v.air = true;
        v.vy = 2.5;
      }
    }
    if (fz.vtol && !v.air) fz.vtol.fuel = Math.min(fz.vtol.max, fz.vtol.fuel + dt * 0.8);
  }

  // in the air (game/vehicles.js drive): the lift of its rotor, its balloon, its jets; steering in
  // the air - returns how much of the fall's pull is left (1: all of it)
  air(v, dt, input) {
    const fz = v.fz;
    if (!fz) return 1;
    const g = this.game;
    const up = !!input && (input.keys.has('Space') || input.flyUp);
    const down = !!input && (input.keys.has('KeyC') || input.flyDown);
    const mv = input ? input.readMove() : { x: 0, y: 0 };
    const boost = !!input && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || (input.pad && input.pad.sprint));
    let pull = 1;
    // (no higher than this over the ground under it)
    const gy = groundHeight(v.pos.x, v.pos.z);
    const ceil = gy + 80;
    let lifting = false;
    if (fz.rotor) {
      if (fz.rotor >= 1) {
        const want = v.pos.y > ceil ? -2 : up ? 5 + Math.min(1.5, fz.rotor - 1) * 3 : down ? -5 : 0;
        v.vy = damp(v.vy, want, 2.6, dt);
        pull = 0;
        lifting = true;
      } else pull = Math.min(pull, 1 - fz.rotor * 0.8);
    }
    if (fz.balloon && !lifting) {
      if (fz.balloon >= 1) {
        const want = v.pos.y > ceil ? -1.5 : up ? 3.2 : down ? -3.2 : 0.35;
        v.vy = damp(v.vy, want, 1.4, dt);
        pull = 0;
        lifting = true;
        // (the wind takes it a little)
        const w = g.weather && g.weather.wind ? g.weather.wind : null;
        if (w) {
          v.vx += (w.x || 0) * 0.3 * dt;
          v.vz += (w.z || 0) * 0.3 * dt;
        }
      } else pull = Math.min(pull, 1 - fz.balloon * 0.8);
    }
    if (fz.vtol && up && fz.vtol.fuel > 0) {
      fz.vtol.fuel -= dt;
      v.vy = Math.min(v.vy + fz.vtol.power * dt * 2.2, 9);
      lifting = true;
      v.fzThrust = 1;
    }
    // wings and a jet: it flies - Shift held keeps it up
    if (fz.plane && boost) {
      v.vy = damp(v.vy, 1.2 + mv.y * 2.5, 1.8, dt);
      pull = 0;
      lifting = true;
    }
    // (ROADMAP 11.21) a parachute: falling fast, it opens - down slowly, gliding on
    if (fz.chute && !lifting) {
      if (!v.fzChute && v.vy < -4.5) {
        v.fzChute = g.time;
        g.audio.play('chute', 0.7);
      }
      if (v.fzChute) {
        v.vy = damp(v.vy, -2.4, 3.5, dt);
        pull = Math.min(pull, 0.08);
      }
    }
    // a jet out of its back pushes it on through the air (Shift)
    if (fz.thrust && boost) {
      v.vx += Math.sin(v.yaw) * fz.thrust * dt;
      v.vz += Math.cos(v.yaw) * fz.thrust * dt;
    }
    // steering through the air: a rotor, a balloon, wings
    const ctl = fz.airCtl || 0;
    if (ctl && input) {
      v.yawRate = damp(v.yawRate, -mv.x * 1.5 * ctl, 3, dt);
      const A = lifting ? (fz.rotor >= 1 ? 9 : fz.balloon >= 1 ? 3.5 : 4) : 2.5;
      v.vx += Math.sin(v.yaw) * mv.y * A * ctl * dt;
      v.vz += Math.cos(v.yaw) * mv.y * A * ctl * dt;
      const cap = fz.plane && boost ? 60 : fz.rotor >= 1 ? 26 : fz.balloon >= 1 ? 12 : 40;
      const sp = Math.hypot(v.vx, v.vz);
      if (sp > cap) {
        v.vx *= cap / sp;
        v.vz *= cap / sp;
      }
      // (ROADMAP 11.23: a rotor holding still in the air stops like a helicopter - over where it
      // is to come down)
      if (lifting && !mv.y) {
        const k = fz.rotor >= 1 ? 1.6 : 0.5;
        v.vx *= Math.exp(-k * dt);
        v.vz *= Math.exp(-k * dt);
      }
    }
    v.fzLifting = lifting;
    return pull;
  }

  // what it stands on: up kerbs and steps (teeth, huge wheels), onto roofs (when it flies)
  floor(v, g) {
    // (ROADMAP 11.21) the sea: a car with no floats goes down in it (sea()); with floats it rides on
    // it - its wheels under, its floats half in, bobbing
    if (v.fzSink) return g - Math.min(1.9, v.fzSink * 1.1);
    const fz = v.fz;
    if (!fz) return g;
    if (fz.float && fz.float.k >= 1) {
      v.fzWet = isWater(v.pos.x, v.pos.z);
      if (v.fzWet) g = WATER_RIDE + Math.sin(this.game.time * 1.7) * 0.04;
    }
    const G = this.game.gadgets;
    if (!G) return g;
    const flies = fz.rotor || fz.balloon || fz.vtol || fz.plane || v.glide;
    const step = fz.step || 0;
    if (!step && !(flies && v.air)) return g;
    const y = v.pos.y + (v.air ? 0.3 : step);
    let f = G.floorAt(v.pos.x, v.pos.z, y);
    // (its nose over a step: up it goes)
    if (step && !v.air) {
      const fx = Math.sin(v.yaw) * (v.halfLen || 2.2) * 0.75;
      const fz2 = Math.cos(v.yaw) * (v.halfLen || 2.2) * 0.75;
      const ahead = G.floorAt(v.pos.x + fx * Math.sign(v.speed || 1), v.pos.z + fz2 * Math.sign(v.speed || 1), y);
      if (ahead > f && ahead - v.pos.y < step) f = Math.max(f, Math.min(ahead, v.pos.y + step * 0.5));
    }
    return Math.max(g, f);
  }

  // (game/vehicles.js hurt) a hard knock can tear a part off - not through armour
  onHurt(v, amount) {
    const R = v.fuse;
    if (!R || !R.parts.length || amount < 22) return;
    const shield = v.armor || 0;
    if (Math.random() > (amount / 120) * (1 - shield * 1.3)) return;
    const loose = R.parts.filter((p) => p.type !== 'armor');
    if (!loose.length) return;
    const p = loose[Math.floor(Math.random() * loose.length)];
    this.removeVeh(v, p);
    if (v.driver === this.game.player) this.say(`ה${PARTS[p.type].name} נתלש מהמכה`, 'bad');
  }

  // ------------------------------------------------------------------ on the hero
  onHero(part) {
    const g = this.game;
    const p = g.player;
    // (one of each; three at most - the oldest goes)
    for (const h of this.hero.filter((h) => h.part.type === part.type)) this.removeHero(h.part, true);
    if (this.hero.length >= MAX_ON_HERO) this.removeHero(this.hero[0].part, true);
    part.until = g.time + (part.type === 'star' ? STAR_T : HERO_T);
    const col = paintOf(INKS[part.ink] || null, PARTS[part.type].col);
    const n = part.n;
    let model = null;
    if (part.type === 'wheel') {
      model = new THREE.Group();
      for (const s of [-1, 1]) {
        const foot = new THREE.Group();
        for (const z of [-0.07, 0.07]) {
          const w = wheelModel(part.v === 'big' ? 0.1 : 0.055, part.v === 'square' ? 'square' : 'round', col);
          w.position.set(0, part.v === 'big' ? 0.1 : 0.055, z);
          foot.add(w);
        }
        foot.userData.side = s;
        model.add(foot);
      }
    } else if (part.type === 'wing') model = this.heroWings(clamp((n.span || 1) * 0.8, 0.7, 1.8), col);
    else if (part.type === 'rotor') model = rotorModel(clamp(n.span || 1.4, 1, 2.4), col);
    else if (part.type === 'jet') model = packModel(n.len || 1, col);
    else if (part.type === 'spring') {
      model = new THREE.Group();
      for (const s of [-1, 1]) {
        const sp = springModel(n.coils || 4, 0.16, 0.07, col);
        sp.userData.side = s;
        model.add(sp);
      }
    } else if (part.type === 'blade') model = bladeModel(clamp(n.len || 0.6, 0.35, 0.9), n.curve || 1.5);
    else if (part.type === 'armor') model = vestModel(n.cover || 0.4);
    else if (part.type === 'balloon') model = balloonModel(clamp(n.d || 0.9, 0.6, 2.4), col);
    else if (part.type === 'magnet') model = magnetModel(0.42);
    else if (part.type === 'star') model = starModel(0.8, col);
    else if (part.type === 'chute') model = chuteModel(4, col);
    if (model) g.scene.add(model);
    const h = { part, model };
    this.hero.push(h);
    // (armour: the vest's, at once)
    if (part.type === 'armor') {
      part.armorAdd = Math.round(clamp(45 + (n.cover || 0.4) * 60, 45, 100));
      p.armor = Math.min(100, (p.armor || 0) + part.armorAdd);
    }
    if (part.type === 'rotor') this.heroFuel.rotor = 5;
    if (part.type === 'jet') this.heroFuel.jet = 3;
    const st = heroRule(part, this.game.touch);
    return { part, ...st, combos: this.newCombos(this.heroCombos()) };
  }

  heroWings(span, col) {
    const g = new THREE.Group();
    for (const s of [1, -1]) {
      const w = wingModel(span, 0.42, s, col);
      w.userData.side = s;
      g.add(w);
    }
    return g;
  }

  removeHero(part, quiet = false) {
    const i = this.hero.findIndex((h) => h.part === part);
    if (i < 0) return;
    const h = this.hero[i];
    if (h.model && h.model.parent) h.model.parent.remove(h.model);
    this.hero.splice(i, 1);
    if (!quiet) {
      const p = this.game.player.pos;
      this.game.fx.crumbs(p.x, p.y + 1, p.z, 8, 1.5);
    }
  }

  heroHas(type) {
    for (const h of this.hero) if (h.part.type === type) return h.part;
    return null;
  }

  heroCombos() {
    const c = [];
    if (this.heroHas('wing') && this.heroHas('jet')) c.push('rocketman');
    if (this.heroHas('spring') && this.heroHas('wing')) c.push('eagleH');
    if (this.heroHas('wheel') && this.heroHas('jet')) c.push('turbo');
    if (this.heroHas('balloon') && this.heroHas('rotor')) c.push('airship');
    return c;
  }

  // (game/player.js) how fast you run on what you have on your feet
  heroSpeedK(sprint) {
    const w = this.heroHas('wheel');
    // (star power: a third faster)
    const star = this.heroHas('star') ? 1.3 : 1;
    if (!w) return star;
    let k = w.v === 'square' ? 0.8 : w.v === 'big' ? 1.4 : w.v === 'small' ? 1.7 : 1.55;
    if (sprint && this.heroHas('jet') && this.heroCombos().includes('turbo')) k *= 1.35;
    return k * star;
  }

  // (game/player.js) how high you jump
  jumpK() {
    const s = this.heroHas('spring');
    let k = s ? clamp(1.45 + (s.n.coils || 4) * 0.11, 1.5, 2.4) : 1;
    if (s && this.heroHas('wing')) k *= 1.15;
    return k;
  }

  heroSafe() {
    return !!(this.heroHas('spring') || this.heroHas('wing') || this.heroHas('balloon') || this.heroHas('rotor') || this.heroHas('chute') || this.heroHas('star'));
  }

  // (game/player.js, in the air) your wings, your rotor, your balloon, your jetpack: true when it
  // set how you fall this frame
  heroAir(p, dt, input) {
    if (!this.hero.length || p.onGround) {
      if (p.onGround) {
        this.heroFuel.rotor = Math.min(5, this.heroFuel.rotor + dt * 1.6);
        this.heroFuel.jet = Math.min(3, this.heroFuel.jet + dt * 1.2);
      }
      return false;
    }
    const up = input.keys.has('Space') || input.flyUp;
    const down = input.keys.has('KeyC') || input.flyDown;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const jet = this.heroHas('jet');
    const rot = this.heroHas('rotor');
    const bal = this.heroHas('balloon');
    const wing = this.heroHas('wing');
    const combos = this.heroCombos();
    this.heroThrust = 0;
    if (jet && up && this.heroFuel.jet > 0) {
      this.heroFuel.jet -= dt * (combos.includes('rocketman') ? 0.35 : 1);
      p.vel.y = Math.min(p.vel.y + 34 * dt, 9);
      p.vel.x += fx * 10 * dt;
      p.vel.z += fz * 10 * dt;
      this.heroThrust = 1;
      return true;
    }
    if (rot && up && this.heroFuel.rotor > 0) {
      this.heroFuel.rotor -= dt * (combos.includes('airship') ? 0.3 : 1);
      p.vel.y = damp(p.vel.y, 4.5, 4, dt);
      return true;
    }
    // (ROADMAP 11.21) a parachute on your back: falling, it opens
    const chute = this.heroHas('chute');
    if (chute && !bal && !down && (this.heroChuteOpen || p.vel.y < -5)) {
      if (!this.heroChuteOpen) this.game.audio.play('chute', 0.6);
      this.heroChuteOpen = true;
      p.vel.y = damp(p.vel.y, -2.2, 4, dt);
      return true;
    }
    if (bal) {
      const big = (bal.n.d || 0.9) >= 1.1;
      p.vel.y = damp(p.vel.y, up && big ? 2.6 : down ? -6 : big ? -0.6 : -2.2, 3, dt);
      return true;
    }
    if (wing && p.vel.y < 0 && !down) {
      const sink = clamp(4.4 - (wing.n.span || 1) * 1.1, 1.6, 4);
      p.vel.y = damp(p.vel.y, -sink, 4, dt);
      p.vel.x += fx * 9 * dt;
      p.vel.z += fz * 9 * dt;
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (sp > 15) {
        p.vel.x *= 15 / sp;
        p.vel.z *= 15 / sp;
      }
      return true;
    }
    if (rot) {
      p.vel.y = damp(p.vel.y, -3, 3, dt);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ on the gun in your hand
  onWeapon(slot, part) {
    if (!slot.fzBase) {
      slot.fzBase = slot.def;
      slot.def = { ...slot.def };
      slot.fz = [];
    }
    for (const q of slot.fz.filter((q) => q.part.type === part.type && part.type !== 'barrel')) this.removeWeapon(slot, q.part, true);
    if (slot.fz.length >= 4) this.removeWeapon(slot, slot.fz[0].part, true);
    const col = paintOf(INKS[part.ink] || null, PARTS[part.type].col);
    let model = null;
    const box = slot.model.fzBox;
    const zf = box ? box.max.z : 0.4;
    const yc = box ? (box.min.y + box.max.y) / 2 : 0.05;
    if (part.type === 'barrel') {
      const k = slot.fz.filter((q) => q.part.type === 'barrel').length;
      const len = clamp(part.n.len || 0.4, 0.2, 0.9);
      model = barrelModel(len, part.n.thick ? 0.06 : 0.022, 'fixed', col);
      model.scale.setScalar(0.42);
      model.position.set(0, (box ? box.min.y : -0.05) - 0.05 - k * 0.06, zf - len * 0.4);
    } else if (part.type === 'blade') {
      model = bladeModel(clamp(part.n.len || 0.4, 0.25, 0.6), part.n.curve || 1.5);
      model.position.set(0, (box ? box.min.y : -0.04) + 0.02, zf - 0.04);
    } else if (part.type === 'spring') {
      model = springModel(part.n.coils || 4, 0.1, 0.035, col);
      model.rotation.x = Math.PI / 2;
      model.position.set(0, yc, zf - 0.02);
    } else if (part.type === 'magnet') {
      model = magnetModel(0.2);
      model.position.set(0, (box ? box.max.y : 0.08) + 0.06, zf - 0.12);
    } else if (part.type === 'jet') {
      model = jetModel(0.5, col);
      model.scale.setScalar(0.35);
      model.position.set(0, yc, box ? box.min.z : -0.2);
    } else if (part.type === 'wing') {
      model = new THREE.Group();
      for (const s of [1, -1]) {
        const w = wingModel(0.22, 0.14, s, col);
        w.position.set(s * 0.03, yc, zf * 0.4);
        model.add(w);
      }
    } else if (part.type === 'armor') {
      model = vestModel(0.2);
      model.scale.set(0.9, 0.7, 0.2);
      model.position.set(0, yc - 0.05, zf * 0.55);
    } else if (part.type === 'rotor') {
      model = rotorModel(0.36, col);
      model.scale.setScalar(0.45);
      model.rotation.x = Math.PI / 2;
      model.position.set(0, yc, zf + 0.02);
    }
    if (model) slot.model.group.add(model);
    slot.fz.push({ part, model });
    this.applyWeapon(slot);
    return { part, ...weaponRule(part, slot.def), combos: [] };
  }

  removeWeapon(slot, part, quiet = false) {
    if (!slot.fz) return;
    const i = slot.fz.findIndex((q) => q.part === part);
    if (i < 0) return;
    const q = slot.fz[i];
    if (q.model && q.model.parent) q.model.parent.remove(q.model);
    slot.fz.splice(i, 1);
    this.applyWeapon(slot);
    if (!quiet) this.game.audio.play('click', 0.4);
  }

  // what its parts make of the gun (game/weapons.js reads its def on every shot)
  applyWeapon(slot) {
    const def = (slot.def = { ...slot.fzBase });
    let barrels = 0;
    for (const { part } of slot.fz) {
      const n = part.n;
      if (part.type === 'barrel') {
        barrels++;
        if ((n.len || 0.3) > 0.45) {
          def.speed = (def.speed || 60) * 1.15;
          def.spread = (def.spread || 0.03) * 0.72;
        }
      } else if (part.type === 'blade') def.bayonet = { damage: Math.round(clamp(30 + (n.len || 0.4) * 60, 30, 70)), range: clamp(2 + (n.len || 0.4), 2, 3.2) };
      else if (part.type === 'spring') def.bounce = Math.max(def.bounce || 0, clamp(2 + Math.round((n.coils || 4) / 3), 2, 5));
      else if (part.type === 'magnet') def.homing = Math.max(def.homing || 0, 2.6);
      else if (part.type === 'jet') {
        def.speed = (def.speed || 60) * 1.45;
        if (def.kind === 'gun') def.radius = Math.max(def.radius || 0, 1.4);
      } else if (part.type === 'wing') {
        def.projectile = 'plane';
        def.homing = Math.max(def.homing || 0, 2.4);
        def.speed = Math.min(def.speed || 34, 34);
        def.gravity = 0;
      } else if (part.type === 'armor') def.parry = Math.max(def.parry || 0, 0.45);
      else if (part.type === 'rotor') def.wind = Math.max(def.wind || 0, 11);
    }
    if (barrels === 1) {
      def.volley = Math.max(def.volley || 1, 2);
      def.rate = (def.rate || 5) * 0.88;
    } else if (barrels >= 2) {
      def.spin = true;
      def.rate = Math.max(def.rate || 5, 9) * 1.25;
    }
  }

  // ------------------------------------------------------------------ on another car: a few seconds
  onCar(c, part) {
    const g = this.game;
    const t = g.time;
    // (one thing at a time on one car)
    if (this.others.some((o) => o.ref === c && o.until > t)) {
      this.say('כבר יש עליה משהו', 'bad');
      return null;
    }
    const st = { phase: 'go', vy: 0, h0: c.pos.y || 0, spin: 0, yaw0: c.yaw };
    let T = 8;
    let rule = '';
    const name = c.police ? 'הניידת' : 'המכונית';
    const v = part.v;
    if (part.type === 'wheel') {
      if (v !== 'square' && v !== 'small') {
        this.say('גלגל רגיל לא משנה לה כלום — ציירו מרובע או קטן', 'bad');
        return null;
      }
      T = 15;
      rule = v === 'square' ? `גלגלים מרובעים: ${name} מקרטעת לאט` : `גלגלים זעירים: ${name} זוחלת`;
    } else if (part.type === 'balloon') {
      const d = clamp(part.n.d || 1.5, 0.6, 6);
      st.top = clamp(4 + d * 2.4, 5, 16);
      T = 9;
      rule = `בלון: ${name} עפה למעלה ל־${T} שניות`;
    } else if (part.type === 'rotor') {
      st.top = clamp(6 + (part.n.span || 2) * 2, 7, 18);
      T = 6;
      rule = `רוטור: ${name} מתרוממת ומסתחררת`;
    } else if (part.type === 'jet') {
      T = 2.6;
      st.dir = part.v === 'front' ? -1 : 1;
      rule = `סילון: ${name} נורית ${st.dir > 0 ? 'קדימה' : 'אחורה'} ומתרסקת`;
    } else if (part.type === 'spring') {
      st.vy = clamp(9 + (part.n.coils || 4) * 0.9, 10, 17);
      st.phase = 'fall';
      T = 4;
      rule = `קפיץ: ${name} מוקפצת לאוויר`;
    } else if (part.type === 'magnet') {
      let best = null;
      let bd = 32;
      for (const o of [...g.traffic.list, ...(g.traffic.parked || [])]) {
        if (o === c || o.gone || o.taken || o.poofT !== undefined) continue;
        const d = Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      st.other = best;
      T = best ? 4 : 8;
      rule = best ? `מגנט: ${name} נמשכת אל המכונית הקרובה — בום` : `מגנט: ${name} נדבקת לכביש`;
    } else if (part.type === 'barrel') {
      T = 20;
      st.cool = 0.6;
      st.gun = gunOf({ r: part.n.thick ? 0.12 : 0.06, len: clamp(part.n.len || 1, 0.6, 2.5), el: INK_EL[part.ink] || undefined });
      rule = `צריח על ${name}: יורה על השוטרים והאויבים ל־${T} שניות`;
    } else if (part.type === 'wing') {
      if (Math.abs(c.speed || 0) < 8) {
        this.say('כנף צריכה מהירות — המכונית הזאת כמעט עומדת', 'bad');
        return null;
      }
      T = 4;
      st.vy = 3;
      st.fwd = Math.max(12, Math.abs(c.speed || 0));
      rule = `כנף: ${name} ממריאה מהכביש`;
    }
    // (its own driving stops: it is the part's now - a police car after you gives up the chase)
    if (part.type !== 'barrel' && part.type !== 'wheel') this.hold(c);
    const o = { kind: 'car', ref: c, part, t0: t, until: t + T, st, model: null };
    o.model = this.carModel(c, part);
    this.others.push(o);
    return { part, rule, nums: '', combos: [] };
  }

  // a car out of the traffic's hands (as game/signs.js stops one)
  hold(c) {
    c.path = null;
    c.stopped = true;
    c.speed = 0;
    if (c.police) {
      c.mode = 'stalled';
      c.siren = false;
    }
  }

  carModel(c, part) {
    const col = paintOf(INKS[part.ink] || null, PARTS[part.type].col);
    const D = carDims(c);
    const K = KINDS[c.spec.kind] || KINDS.sedan;
    let m = null;
    if (part.type === 'balloon') {
      m = new THREE.Group();
      const n = Math.max(1, Math.min(4, Math.round((part.n.d || 1.5) / 0.8)));
      for (let i = 0; i < n; i++) {
        const b = balloonModel(clamp((part.n.d || 1.5) * 0.7, 0.8, 2.6), i % 2 ? paintOf(null, [0.3, 0.55, 0.95]) : col);
        b.position.set((i - (n - 1) / 2) * 0.9, K.roofY + 2.4 + (i % 2) * 0.5, (i % 2 ? 0.4 : -0.4));
        b.userData.base = b.position.clone();
        m.add(b);
      }
    } else if (part.type === 'rotor') {
      m = rotorModel(clamp(part.n.span || 2.5, 1.5, 7), col);
      m.position.set(0, K.roofY - 0.02, 0);
    } else if (part.type === 'jet') {
      m = jetModel(part.n.len || 1, col);
      m.position.set(0, Math.max(0.45, K.clear + 0.3), part.v === 'front' ? D.hl + 0.02 : -D.hl - 0.02);
      if (part.v === 'front') m.rotation.y = Math.PI;
    } else if (part.type === 'spring') {
      m = springModel(part.n.coils || 4, 0.3, 0.3, col);
    } else if (part.type === 'magnet') {
      m = magnetModel(0.7);
      m.position.set(0, K.roofY + 0.1, 0);
    } else if (part.type === 'barrel') {
      m = barrelModel(clamp(part.n.len || 1, 0.6, 2.2), part.n.thick ? 0.12 : 0.06, 'turret', col);
      m.position.set(0, K.roofY - 0.04, 0);
    } else if (part.type === 'wing') {
      m = new THREE.Group();
      for (const s of [1, -1]) {
        const w = wingModel(1.8, 0.8, s, col);
        w.position.set(s * (D.hw - 0.08), beltAt(K, 0.5) - 0.1, 0);
        m.add(w);
      }
    } else if (part.type === 'wheel') {
      m = new THREE.Group();
      const spots = vehWheelSpots(null, K, D);
      const r = part.v === 'square' ? K.r * 1.1 : K.r * 0.55;
      for (const s of spots) {
        const w = wheelModel(r, part.v, col);
        w.position.set(s.x, r, s.z);
        m.add(w);
      }
      c.fuseNoWheels = true;
    }
    if (!m) return null;
    const root = new THREE.Group();
    root.add(m);
    root.matrixAutoUpdate = false;
    this.game.scene.add(root);
    return root;
  }

  // ------------------------------------------------------------------ on a man in the street
  onPerson(e, part) {
    const g = this.game;
    const t = g.time;
    if (this.others.some((o) => o.ref === e && o.until > t)) {
      this.say('כבר יש עליו משהו', 'bad');
      return null;
    }
    const R = g.ragdolls;
    const st = {};
    let T = 6;
    let rule = '';
    const enemy = g.enemies.list.includes(e);
    const fx = Math.sin(e.yaw || 0);
    const fz = Math.cos(e.yaw || 0);
    if (part.type === 'balloon' || part.type === 'rotor') {
      if (!R) return null;
      st.r = R.throw(e, 0, 2, 0);
      st.anchor = new THREE.Vector3().copy(e.fig.j.handR);
      st.rise = part.type === 'rotor' ? 3.2 : 1.8;
      st.top = st.anchor.y + (part.type === 'rotor' ? 9 : 7);
      T = part.type === 'rotor' ? 5 : 8;
      rule = part.type === 'rotor' ? 'רוטור: מתרומם ומסתחרר באוויר' : `בלון: עף למעלה ל־${T} שניות`;
    } else if (part.type === 'jet') {
      if (!R) return null;
      const dx = part.v === 'front' ? -fx : fx;
      const dz = part.v === 'front' ? -fz : fz;
      R.throw(e, dx * 15, 8, dz * 15, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3);
      T = 1;
      rule = 'סילון: נורה מהמקום';
    } else if (part.type === 'spring') {
      if (!R) return null;
      R.throw(e, (Math.random() - 0.5) * 2, clamp(11 + (part.n.coils || 4) * 0.8, 12, 17), (Math.random() - 0.5) * 2, 4, 0, 2);
      T = 1;
      rule = 'קפיץ: מוקפץ גבוה';
    } else if (part.type === 'wheel') {
      if (!R) return null;
      R.throw(e, fx * 6, 1.5, fz * 6, -fz * 6, 0, fx * 6);
      T = 1;
      rule = 'גלגיליות: מחליק ונופל';
    } else if (part.type === 'magnet') {
      if (enemy && e.gunman) {
        e.disarmedT = t + 25;
        if (e.startFlee) e.startFlee();
        // (his gun out of his hand, flying to you: a pen-pistol, a police M4 - game/pickups.js)
        const h = e.fig.j.handR;
        const it = g.pickups ? g.pickups.drop(e.faction === 'police' ? 'm4' : 'pen', h.x, h.y, h.z) : null;
        if (it) {
          const pp = g.player.pos;
          const dx = pp.x - h.x;
          const dz = pp.z - h.z;
          const d = Math.hypot(dx, dz) || 1;
          const T0 = clamp(d / 14, 0.4, 1.4);
          it.vel.set(dx / T0, 8 * T0 * 0.5 + 1, dz / T0);
        }
        st.gun = true;
        T = 1.2;
        rule = 'מגנט: הנשק נתלש לו מהיד — אליכם';
      } else {
        st.pull = true;
        T = 1.6;
        rule = 'מגנט: נמשך אליכם';
      }
    }
    if (enemy && e.say) e.say('hit', 'alarm');
    const o = { kind: 'person', ref: e, part, t0: t, until: t + T, st, model: null };
    o.model = this.personModel(e, part);
    this.others.push(o);
    return { part, rule, nums: '', combos: [] };
  }

  personModel(e, part) {
    const col = paintOf(INKS[part.ink] || null, PARTS[part.type].col);
    let m = null;
    if (part.type === 'balloon') m = balloonModel(clamp(part.n.d || 1, 0.8, 2), col);
    else if (part.type === 'rotor') m = rotorModel(clamp(part.n.span || 1.4, 1, 2.2), col);
    else if (part.type === 'magnet') m = magnetModel(0.4);
    if (!m) return null;
    const root = new THREE.Group();
    root.add(m);
    this.game.scene.add(root);
    return root;
  }

  // ------------------------------------------------------------------ each frame
  update(dt) {
    const g = this.game;
    const t = g.time;
    const p = g.player;
    // what is on you: worn out after its time
    for (const h of this.hero.slice()) if (t > h.part.until || p.mode === 'dead') this.removeHero(h.part, p.mode === 'dead');
    // (the magnet in your hand: the coins, the dropped guns come to you)
    if (this.heroHas('magnet') && p.mode === 'foot') this.pullLoot(p.pos, 14, dt);
    const pv = p.inVehicle;
    if (pv && pv.fz && pv.fz.magnet) this.carMagnet(pv, dt);
    if (pv && pv.fz && pv.fz.flame && g.input) this.flame(pv, dt);
    // (ROADMAP 11.21) a star's power spent; the coil, the smoke pots, the floats
    for (const v of g.vehicles.list) {
      const R = v.fuse;
      if (!R || !R.parts.length) continue;
      const q = R.parts.find((o) => o.until && t > o.until);
      if (q) {
        this.removeVeh(v, q);
        if (v === pv) this.say(`ה${PARTS[q.type].name} נגמר`, 'info');
      }
    }
    if (pv) this.sea(pv, dt);
    this.pen.update(g.realDt || dt);
    if (pv && pv.fz) {
      const fz = pv.fz;
      if (fz.star) {
        this.sparkT = (this.sparkT || 0) - dt;
        if (this.sparkT <= 0) {
          this.sparkT = 0.12;
          const a = Math.random() * Math.PI * 2;
          g.fx.sparks(pv.pos.x + Math.cos(a) * 1.4, (pv.pos.y || 0) + 0.4 + Math.random() * 1.2, pv.pos.z + Math.sin(a) * 1.4, 4, [1, 0.85, 0.25]);
        }
      }
      if (fz.zap) this.zap(pv, fz.zap, dt, false);
      if (fz.smoke) this.smokeOut(pv, fz.smoke, dt);
      if (pv.fzChute && !pv.air) pv.fzChute = 0;
      if (fz.float && pv.fzWet) {
        if (Math.abs(pv.speed) > 14) pv.speed = Math.sign(pv.speed) * 14;
        this.wakeT = (this.wakeT || 0) - dt;
        if (Math.abs(pv.speed) > 2 && this.wakeT <= 0) {
          this.wakeT = 0.1;
          const D = vehDims(pv);
          g.fx.splash(pv.pos.x - Math.sin(pv.yaw) * D.hl, -0.78, pv.pos.z - Math.cos(pv.yaw) * D.hl, 5, 2, [1, 1, 0.98]);
        }
      }
    }
    if (p.mode === 'foot' || p.mode === 'climb') {
      // (star power on you: nothing hurts you while it lasts)
      if (this.heroHas('star')) p.invuln = Math.max(p.invuln || 0, 0.3);
      if (this.heroHas('bolt')) this.zap(p, this.heroZap, dt, true);
    }
    if (p.onGround) this.heroChuteOpen = false;
    // others
    for (let i = this.others.length - 1; i >= 0; i--) {
      const o = this.others[i];
      const done = o.kind === 'car' ? this.stepCar(o, dt) : this.stepPerson(o, dt);
      if (done) {
        if (o.model && o.model.parent) o.model.parent.remove(o.model);
        if (o.kind === 'car') o.ref.fuseNoWheels = false;
        this.others.splice(i, 1);
      }
    }
    // the tag fades (in the time you see go by - not the slowed city's)
    if (this.tagEl && this.tagT > 0) {
      this.tagT -= g.realDt || dt;
      if (this.tagT <= 0) this.tagEl.classList.remove('on');
    }
  }

  // (ROADMAP 11.21) the coil's bolt: who comes at you gets it - a gangster or a policeman after you
  // knocked flat, a police car after you stopped dead (no one else: it crackles). src: your car, or
  // you (hero)
  zap(src, Z, dt, hero) {
    const g = this.game;
    Z.cool -= dt;
    if (Z.cool > 0) return;
    const x = src.pos.x;
    const z = src.pos.z;
    const y = (src.pos.y || 0) + (hero ? 1.5 : vehDims(src).h + 0.6);
    let best = null;
    let bd = Z.reach;
    for (const e of g.enemies.list) {
      if (!e.alive || e.isMonster || !(e.hostile || (e.faction === 'police' && g.police && g.police.hostile))) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < bd) {
        bd = d;
        best = { e, x: e.pos.x, y: e.pos.y + 1.1, z: e.pos.z };
      }
    }
    if (!hero && g.police && g.police.hostile) {
      for (const c of g.traffic.list) {
        if (!c.police || c.gone || c.taken || c.crashed || c.wrecked || c.poofT !== undefined) continue;
        const d = Math.hypot(c.pos.x - x, c.pos.z - z);
        if (d < bd) {
          bd = d;
          best = { c, x: c.pos.x, y: (c.pos.y || 0) + 1, z: c.pos.z };
        }
      }
    }
    if (!best) {
      // (nothing to zap: the ball crackles now and then)
      Z.cool = 0.15;
      Z.idle = (Z.idle || 0) - 0.15;
      if (Z.idle <= 0) {
        Z.idle = 1.6;
        g.fx.sparks(x, y, z, 3, [0.6, 0.85, 1]);
      }
      return;
    }
    Z.cool = hero ? 1.1 : 0.8;
    this.stats.zaps = (this.stats.zaps || 0) + 1;
    this.zaps.push({ a: [x, y, z], b: [best.x, best.y, best.z], t0: g.time });
    g.fx.sparks(best.x, best.y, best.z, 12, [0.6, 0.85, 1]);
    g.audio.play('laser', 0.5);
    if (best.e) {
      _d.set(best.e.pos.x - x, 0, best.e.pos.z - z).normalize();
      g.enemies.damage(best.e, 'torso', 34, new THREE.Vector3(best.x, best.y, best.z), _d.clone(), 'melee');
    } else this.crash(best.c, 16);
  }

  // (ROADMAP 11.21) the sea: a car (or a motorbike) with no floats drawn on it goes down - slower, lower,
  // and out you get, swimming; floats keep it up (floor())
  sea(v, dt) {
    const g = this.game;
    // (ROADMAP 11.23: not on a deck over it - game/mission.js)
    const deck = g.mission ? g.mission.floorAt(v.pos.x, v.pos.z, v.pos.y || 0) > -0.5 : false;
    const wet = !v.air && !v.dead && (v.kind === 'car' || v.kind === 'bike') && !v.drawn && v.pos.x > WATER_X + 3 && isWater(v.pos.x, v.pos.z) && !deck;
    const fl = v.fz && v.fz.float;
    if (!wet || (fl && fl.k >= 1)) {
      v.fzSink = 0;
      return;
    }
    if (!v.fzSink) {
      g.fx.splash(v.pos.x, -0.78, v.pos.z, 26, 4, [0.88, 0.95, 1]);
      g.audio.play('splat', 0.8);
      this.say(fl ? 'המצופים קטנים מדי בשבילה — היא שוקעת לאט' : 'המכונית שוקעת! ציירו לה מצופים — צורה ארוכה נמוך לאורכה', 'bad');
    }
    // (floats too small for it: down slower)
    v.fzSink = (v.fzSink || 0) + dt * (fl ? 1 - 0.7 * clamp(fl.k, 0, 1) : 1);
    v.speed *= Math.exp(-2.2 * dt);
    // (ROADMAP 11.23: the water stops it - it does not drive on along the bottom)
    v.vx *= Math.exp(-3 * dt);
    v.vz *= Math.exp(-3 * dt);
    const M = g.mission;
    if (M && M.holds(v)) return;
    if (v.fzSink > 1.8) {
      g.exitVehicle(true);
      v.dead = true;
      v.removeAt = g.time + 4;
    }
  }

  // (ROADMAP 11.21) the smoke pots: chased (the police after you) and going, it lays ink smoke behind
  // it - six seconds of it, filling up again after
  smokeOut(v, S, dt) {
    const g = this.game;
    const chased = !!(g.police && g.police.level > 0);
    if (!chased || Math.abs(v.speed || 0) < 3 || S.charge <= 0) {
      S.charge = Math.min(S.max, S.charge + dt * 0.5);
      return;
    }
    S.charge -= dt;
    S.next -= dt;
    S.trail = (S.trail || 0) - dt;
    if (S.trail <= 0) {
      S.trail = 0.08;
      const D = vehDims(v);
      g.fx.smoke(v.pos.x - Math.sin(v.yaw) * (D.hl + 0.4), (v.pos.y || 0) + 0.5, v.pos.z - Math.cos(v.yaw) * (D.hl + 0.4), 0.9);
    }
    if (S.next > 0) return;
    S.next = 0.45;
    this.puffBehind(v);
  }

  // a cloud of ink smoke behind it (the police cannot see through it: game/signs.js)
  puffBehind(v) {
    const g = this.game;
    const D = vehDims(v);
    const bx = v.pos.x - Math.sin(v.yaw) * (D.hl + 1.4);
    const bz = v.pos.z - Math.cos(v.yaw) * (D.hl + 1.4);
    if (g.signs) g.signs.puff(bx, bz, 3.2, 7);
    else g.fx.smoke(bx, (v.pos.y || 0) + 0.8, bz, 2.4);
  }

  // a car with something on it, a step: true when it is over
  stepCar(o, dt) {
    const g = this.game;
    const c = o.ref;
    const t = g.time;
    const st = o.st;
    if (c.gone || c.poofT !== undefined || c.taken) return true;
    const type = o.part.type;
    const gy = groundHeight(c.pos.x, c.pos.z) * 0.5;
    const over = t >= o.until;
    if (type === 'wheel') {
      c.speed = Math.min(c.speed || 0, o.part.v === 'square' ? 4 : 6.5);
      if (c.maxSpeed) c.maxSpeed = Math.min(c.maxSpeed, o.part.v === 'square' ? 4 : 6.5);
      if (o.part.v === 'square') c.pos.y = gy + Math.abs(Math.sin(t * 7)) * 0.12;
      if (over) c.pos.y = gy;
      return over;
    }
    if (type === 'barrel') {
      st.cool -= dt;
      if (st.cool <= 0) {
        const tg = this.sentryTarget(c.pos, 40);
        if (tg) {
          st.cool = Math.max(0.25, st.gun.reload);
          this.sentryFire(o, tg);
        } else st.cool = 0.3;
      }
      return over;
    }
    if (type === 'balloon' || type === 'rotor' || type === 'wing') {
      if (st.phase === 'go' && !over) {
        if (type === 'wing') {
          c.pos.x += Math.sin(c.yaw) * st.fwd * dt;
          c.pos.z += Math.cos(c.yaw) * st.fwd * dt;
          st.vy = damp(st.vy, -0.6, 0.8, dt);
          c.pos.y = Math.max(gy, (c.pos.y || 0) + st.vy * dt);
        } else {
          const want = gy + st.top;
          c.pos.y = damp(c.pos.y || 0, want, type === 'rotor' ? 1.1 : 0.55, dt);
          if (type === 'rotor') c.yaw += dt * 3.2;
          // (the wind takes it)
          c.pos.x += Math.sin(t * 0.7 + o.t0) * 0.6 * dt;
          c.pos.z += Math.cos(t * 0.5 + o.t0) * 0.6 * dt;
        }
        return false;
      }
      if (st.phase === 'go') {
        st.phase = 'fall';
        st.vy = 0;
        if (type === 'balloon') {
          g.audio.play('pop', 0.8);
          g.fx.crumbs(c.pos.x, c.pos.y + 3, c.pos.z, 14, 3);
          if (o.model && o.model.parent) o.model.parent.remove(o.model);
          o.model = null;
        }
      }
    }
    if (type === 'jet' && st.phase === 'go') {
      const sp = 34 * st.dir;
      c.pos.x += Math.sin(c.yaw) * sp * dt;
      c.pos.z += Math.cos(c.yaw) * sp * dt;
      c.yaw += Math.sin(t * 9) * 0.25 * dt;
      // (into a wall: it stops dead)
      const col = g.world.collision;
      const hit = col.raycast(c.pos.x, 0.6, c.pos.z, Math.sin(c.yaw) * st.dir, 0, Math.cos(c.yaw) * st.dir, 2.6);
      if (hit || over) {
        st.phase = 'fall';
        st.vy = 0;
        this.crash(c, 40);
        return true;
      }
      return false;
    }
    if (type === 'magnet' && st.phase === 'go') {
      const b = st.other;
      if (!b || b.gone) return over;
      const dx = b.pos.x - c.pos.x;
      const dz = b.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      st.spd = (st.spd || 0) + 18 * dt;
      const step = Math.min(d - 3.4, st.spd * dt);
      if (step > 0) {
        c.pos.x += (dx / d) * step * 0.6;
        c.pos.z += (dz / d) * step * 0.6;
        if (!b.parkedCar) {
          b.pos.x -= (dx / d) * step * 0.4;
          b.pos.z -= (dz / d) * step * 0.4;
          this.hold(b);
        }
      }
      if (d < 3.6 || over) {
        st.phase = 'fall';
        this.crash(c, 45);
        this.crash(b, 45);
        g.audio.play('clang', 0.8);
        return true;
      }
      return false;
    }
    // falling, landing
    if (st.phase === 'fall') {
      st.vy -= 20 * dt;
      c.pos.y = (c.pos.y || 0) + st.vy * dt;
      if (type === 'spring') c.yaw += dt * 1.2;
      if (c.pos.y <= gy) {
        const hit = -st.vy;
        c.pos.y = gy;
        if (hit > 6) this.crash(c, clamp(hit * 4, 20, 90));
        return true;
      }
      return false;
    }
    return over;
  }

  // a car down hard: dented, smoking, stopped - a police car's crew get out (as game/signs.js)
  crash(c, power) {
    const g = this.game;
    c.crashed = true;
    c.hazard = true;
    c.speed = 0;
    if (g.damage && !g.classic) g.damage.hit(c, c.pos.x, 0.8, c.pos.z, power);
    g.fx.smoke(c.pos.x, (c.pos.y || 0) + 0.8, c.pos.z, 1.8);
    g.fx.sparks(c.pos.x, (c.pos.y || 0) + 0.4, c.pos.z, 10, [1.0, 0.8, 0.4]);
    g.audio.play('crash', 0.8);
    if (c.police && c.crew && c.crew.length && g.police.hostile) {
      g.traffic.park(c);
      g.police.deploy(c);
    } else if (!c.parkedCar) c.outT = g.time + 1.2;
  }

  // a man with something on him, a step
  stepPerson(o, dt) {
    const g = this.game;
    const e = o.ref;
    const st = o.st;
    const t = g.time;
    const type = o.part.type;
    if (e.gone || (e.alive === false && !(e.fig && e.fig.rag))) return true;
    const over = t >= o.until;
    if (type === 'balloon' || type === 'rotor') {
      const r = e.fig.rag;
      if (!r) return true;
      if (!over) {
        // (up, the hand on the string; the rest of him hanging under it)
        st.anchor.y = Math.min(st.top, st.anchor.y + st.rise * dt);
        st.anchor.x += Math.sin(t * 0.8 + o.t0) * 0.5 * dt;
        st.anchor.z += Math.cos(t * 0.6 + o.t0) * 0.5 * dt;
        const i = 8 * 3; // (the right hand: game/ragdoll.js KEYS)
        r.p[i] = st.anchor.x;
        r.p[i + 1] = st.anchor.y;
        r.p[i + 2] = st.anchor.z;
        r.q[i] = st.anchor.x;
        r.q[i + 1] = st.anchor.y - st.rise * (1 / 60);
        r.q[i + 2] = st.anchor.z;
        r.t = 0;
        r.done = false;
        r.still = 0;
        if (type === 'rotor') r.push(0, 0, 0, 0, 2.5 * dt * 60 * 0.02, 0);
        return false;
      }
      if (!st.popped) {
        st.popped = true;
        g.audio.play('pop', 0.7);
        g.fx.crumbs(st.anchor.x, st.anchor.y + 1, st.anchor.z, 10, 2);
        if (o.model && o.model.parent) o.model.parent.remove(o.model);
        o.model = null;
        // (a fall from up there hurts a gangster)
        if (g.enemies.list.includes(e) && st.anchor.y - groundHeight(st.anchor.x, st.anchor.z) > 4) e.fzFallT = t + 1.1;
      }
      if (e.fzFallT && t > e.fzFallT) {
        e.fzFallT = 0;
        g.enemies.damage(e, 'torso', 45, e.pos.clone().setY(e.pos.y + 0.5), new THREE.Vector3(0, -1, 0), 'fall');
      }
      return t > o.until + 2;
    }
    if (type === 'magnet') {
      const p = g.player.pos;
      if (st.gun) return over;
      if (st.pull && e.knock) {
        const dx = p.x - e.pos.x;
        const dz = p.z - e.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d > 1.6) e.knock((dx / d) * 9, (dz / d) * 9);
      }
      return over;
    }
    return over;
  }

  // ------------------------------------------------------------------ the magnets, the flames
  // coins and dropped guns come to you
  pullLoot(at, R, dt) {
    const g = this.game;
    if (g.pickups) {
      for (const it of g.pickups.list) {
        const d = Math.hypot(it.pos.x - at.x, it.pos.z - at.z);
        if (d < R && d > 0.5) {
          it.pos.x += ((at.x - it.pos.x) / d) * Math.min(d, 9 * dt);
          it.pos.z += ((at.z - it.pos.z) / d) * Math.min(d, 9 * dt);
        }
      }
    }
    if (g.money && g.money.drops) {
      for (const dd of g.money.drops) {
        const d = Math.hypot(dd.x - at.x, dd.z - at.z);
        if (d < R && d > 0.4) {
          dd.x += ((at.x - dd.x) / d) * Math.min(d, 9 * dt);
          dd.z += ((at.z - dd.z) / d) * Math.min(d, 9 * dt);
        }
      }
    }
  }

  // a magnet on your car: the cars in front of it (behind it) pulled in, stuck to it
  carMagnet(v, dt) {
    const g = this.game;
    const M = v.fz.magnet;
    const s = M.front ? 1 : -1;
    const fx = Math.sin(v.yaw) * s;
    const fz = Math.cos(v.yaw) * s;
    const nose = v.halfLen || 2.3;
    v.fzStuck = v.fzStuck || [];
    for (const c of g.traffic.list) {
      if (c.gone || c.taken || c.poofT !== undefined || c.spec.kind === 'moto') continue;
      const dx = c.pos.x - v.pos.x;
      const dz = c.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along < 0 || along > M.reach || side > 3.2) continue;
      // (pulled in, then held at the nose)
      if (!c.fzMag) {
        c.fzMag = v;
        this.hold(c);
        v.fzStuck.push(c);
      }
    }
    for (let i = v.fzStuck.length - 1; i >= 0; i--) {
      const c = v.fzStuck[i];
      if (c.gone || c.taken || v.fzStuck.length > 3) {
        c.fzMag = null;
        v.fzStuck.splice(i, 1);
        continue;
      }
      const gap = nose + (c.halfLen || 2.3) + 0.3 + i * 4.8;
      const tx = v.pos.x + fx * gap;
      const tz = v.pos.z + fz * gap;
      c.pos.x = damp(c.pos.x, tx, 6, dt);
      c.pos.z = damp(c.pos.z, tz, 6, dt);
      c.yaw = v.yaw + (s < 0 ? 0 : 0);
      c.pos.y = v.pos.y;
      // (C lets them go)
      if (g.input.wasPressed('KeyC') && !v.fz.rotor && !v.fz.balloon) {
        for (const o of v.fzStuck) o.fzMag = null;
        v.fzStuck = [];
        break;
      }
    }
  }

  // a jet out of its nose: a flame-thrower, while the button is held
  flame(v, dt) {
    const g = this.game;
    const F = v.fz.flame;
    F.cool -= dt;
    if (!(g.input.fire || g.input.firePressed) || F.cool > 0) return;
    F.cool = 0.06;
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    const nose = (v.halfLen || 2.3) + 0.9;
    g.weapons.projectiles.push({
      kind: 'paintmg', owner: 'player', x: v.pos.x + fx * nose, y: v.pos.y + 0.6, z: v.pos.z + fz * nose,
      vx: fx * 34 + (Math.random() - 0.5) * 3, vy: 1 + Math.random(), vz: fz * 34 + (Math.random() - 0.5) * 3,
      gravity: -1.5, damage: 9, radius: 0, life: F.range / 34, t: 0, seed: Math.random() * 100, wobble: 0, color: [1.0, 0.5, 0.15], el: 'fire', ignoreCar: v,
    });
    if (Math.random() < 0.3) g.audio.play('whoosh', 0.25);
  }

  // a sentry turret: who it fires at - a gangster, a policeman on foot, a police car after you
  sentryTarget(at, R) {
    const g = this.game;
    let best = null;
    let bd = R;
    for (const e of g.enemies.list) {
      if (!e.alive || (e.faction !== 'police' && e.faction !== 'gang')) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z);
      if (d < bd) {
        bd = d;
        best = { x: e.pos.x, y: e.pos.y + 1.1, z: e.pos.z };
      }
    }
    if (best) return best;
    for (const c of g.traffic.list) {
      if (!c.police || c.mode !== 'pursuit') continue;
      const d = Math.hypot(c.pos.x - at.x, c.pos.z - at.z);
      if (d < bd) {
        bd = d;
        best = { x: c.pos.x, y: 0.8, z: c.pos.z };
      }
    }
    return best;
  }

  sentryFire(o, tg) {
    const g = this.game;
    const c = o.ref;
    const gun = o.st.gun;
    const y0 = (c.pos.y || 0) + (KINDS[c.spec.kind] || KINDS.sedan).roofY + 0.25;
    const dx = tg.x - c.pos.x;
    const dy = tg.y - y0;
    const dz = tg.z - c.pos.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    o.st.aim = Math.atan2(dx, dz);
    const sp = gun.spread || 0.03;
    const vx = dx / d + (Math.random() - 0.5) * sp;
    const vy = dy / d + (Math.random() - 0.5) * sp;
    const vz = dz / d + (Math.random() - 0.5) * sp;
    if (gun.type === 'cannon') g.weapons.spawnShell(c.pos.x, y0, c.pos.z, vx, vy, vz, 'player', gun.dmg, gun.blast, gun.speed, 'shell');
    else g.weapons.projectiles.push({ kind: 'paintmg', owner: 'player', x: c.pos.x + (dx / d) * 1.2, y: y0, z: c.pos.z + (dz / d) * 1.2, vx: vx * gun.speed, vy: vy * gun.speed, vz: vz * gun.speed, gravity: 2, damage: gun.dmg, radius: 0, life: 2, t: 0, seed: Math.random() * 100, wobble: 0, color: [1.0, 0.82, 0.3], el: gun.el });
    g.fx.muzzle(c.pos.x + (dx / d) * 1.2, y0, c.pos.z + (dz / d) * 1.2, gun.type === 'cannon' ? 1.6 : 0.6);
    g.audio.play(gun.type === 'cannon' ? 'cannon' : 'paint', 0.3);
  }

  // ------------------------------------------------------------------ drawing them
  draw(fr, dt) {
    const g = this.game;
    const t = g.time;
    this.fdt = dt || 1 / 60;
    // your car's (a drawn one's group carries them; a city car's frame came in place()): its wheels
    // going round, its rotor, its jet's flame, its spring
    const now = performance.now();
    for (const v of g.vehicles.list) {
      const R = v.fuse;
      if (!R || !R.root) continue;
      // (its frame as it is this frame, not the last: what is drawn from it keeps up at speed)
      if (v.kind === 'car') R.root.updateMatrixWorld(true);
      else if (v.group) v.group.updateMatrixWorld(true);
      const fz = v.fz || {};
      const r0 = (fz.wheels && fz.wheels.r) || 0.34;
      for (const o of R.models) {
        const ud = o.m.userData;
        if (ud.popAt !== undefined) {
          const k = Math.max(0, (now - ud.popAt) / 380);
          if (k >= 1) {
            o.m.scale.setScalar(1);
            delete ud.popAt;
          } else o.m.scale.setScalar(Math.max(0.02, 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2));
        }
        if (o.role === 'wheel' && ud.spin) {
          ud.spin.rotation.x = (v.wheelSpin || 0) * (0.34 / r0);
          o.m.rotation.y = ud.front ? clamp((v.turn || 0) * 0.35, -0.45, 0.45) : 0;
        } else if (o.role === 'rotor' && ud.spin) ud.spin.rotation.y += this.fdt * (v.fzLifting || (v.air && fz.rotor) ? 26 : v.driver ? 6 : 1);
        else if (o.role === 'jet' && ud.flame) {
          const on = v.boosting || (v.fzThrust && v.air) ? 1 : 0;
          v.fzThrust = 0;
          const k = on ? 1.2 + Math.sin(t * 40) * 0.25 : 0.001;
          ud.flame.scale.z = damp(ud.flame.scale.z, k * (o.p.v === 'under' ? 1 : 1.4), 18, this.fdt);
        } else if (o.role === 'spring' && ud.coil) {
          const k = v.fzSpringT && t - v.fzSpringT < 0.35 ? 1 - (t - v.fzSpringT) / 0.35 : 0;
          ud.coil.scale.y = 0.22 + k * 1.3;
        } else if (o.role === 'balloon') {
          o.m.position.y = ud.base.y + Math.sin(t * 1.3) * 0.12;
          o.m.position.x = ud.base.x + Math.sin(t * 0.9) * 0.15;
          // (its string, down to the roof)
          _v.copy(o.m.position).applyMatrix4(R.root.matrixWorld);
          _w.set(ud.base.x * 0.3, ud.base.y - 1.5 - (o.p.n.d || 1.6) * 0.3, ud.base.z).applyMatrix4(R.root.matrixWorld);
          fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, [0.2, 0.2, 0.24], 2.2, 7100, 1, 0.01, 0);
        } else if (o.role === 'star' && ud.spin) {
          ud.spin.rotation.y += this.fdt * 3.2;
          ud.spin.visible = (o.p.until || Infinity) - t > 2.5 || Math.sin(t * 22) > -0.3;
        } else if (o.role === 'chute' && ud.canopy) {
          const open = !!v.fzChute;
          const k = damp(ud.canopy.scale.x, open ? 1 : 0.001, open ? 7 : 5, this.fdt);
          ud.canopy.scale.setScalar(k);
          ud.canopy.visible = k > 0.02;
        } else if (o.role === 'magnet' && fz.magnet && v.fzStuck && v.fzStuck.length) {
          // (its pull, in ink: the lines of its field to what it holds)
          _v.copy(o.m.position).applyMatrix4(R.root.matrixWorld);
          for (const c of v.fzStuck) fr.lineXYZ(_v.x, _v.y + 0.3, _v.z, c.pos.x, (c.pos.y || 0) + 0.8, c.pos.z, [0.85, 0.15, 0.2], 2, 7200, 0.6, 0.04, 0);
        } else if (o.role === 'jet' && ud.dflame) {
          // (ROADMAP 11.22, drawn ones: the flame as drawn, roaring out from its foot as it pushes)
          const on = v.boosting || (v.fzThrust && v.air) ? 1 : 0;
          v.fzThrust = 0;
          ud.dflame.scale.setScalar(damp(ud.dflame.scale.x, on ? 1.14 + Math.sin(t * 40) * 0.1 : 1, 18, this.fdt));
        } else if (o.role === 'dspring' && ud.dcoil) {
          const k = v.fzSpringT && t - v.fzSpringT < 0.35 ? 1 - (t - v.fzSpringT) / 0.35 : 0;
          ud.dcoil.scale.y = 1 + k * 0.9;
        } else if (o.role === 'dballoon') {
          o.m.position.y = ud.base.y + Math.sin(t * 1.3) * 0.1;
          o.m.position.x = ud.base.x + Math.sin(t * 0.9) * 0.08;
          if (ud.stringTo) {
            _v.copy(o.m.position).applyMatrix4(R.root.matrixWorld);
            _w.copy(ud.stringTo).applyMatrix4(R.root.matrixWorld);
            fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, [0.2, 0.2, 0.24], 2.2, 7100, 1, 0.01, 0);
          }
        } else if (o.role === 'dchute' && ud.canopy) {
          // (folded on the roof; falling, it opens as drawn)
          ud.canopy.scale.setScalar(damp(ud.canopy.scale.x, v.fzChute ? 1 : 0.35, v.fzChute ? 7 : 3, this.fdt));
        }
        // (ROADMAP 11.22) a drawn one's own lines, inked on it where they were drawn
        if (ud.lines && ud.lines.length && ud.lineNode.visible) {
          o.m.updateMatrixWorld(true);
          const M = ud.lineNode.matrixWorld;
          for (let j = 0; j < ud.lines.length; j++) inkRun(fr, ud.lines[j], M, ud.lineC || EDGE_DARK, 2.6, 8600 + j * 31, 1);
        }
      }
      if (v.kind !== 'car') R.root.updateMatrix();
      if (R.decor && R.decor.length) this.drawDecor(fr, R.decor, R.root.matrixWorld, 8100);
    }
    // the ink on the city's cars (while they are about)
    for (const c of this.decorCars) {
      if (c.gone || c.taken || c.poofT !== undefined || !c.fzDecor || !c.fzDecor.length) {
        this.decorCars.delete(c);
        continue;
      }
      _e.set(0, c.yaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(c.pos.x, c.pos.y || 0, c.pos.z), _q, _s.set(1, 1, 1));
      this.drawDecor(fr, c.fzDecor, _m, 8300);
    }
    // (ROADMAP 11.21) the coil's bolts: jagged, new kinks each frame
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const zp = this.zaps[i];
      if (t - zp.t0 > 0.22 || t < zp.t0) {
        this.zaps.splice(i, 1);
        continue;
      }
      const [ax, ay, az] = zp.a;
      const [bx, by, bz] = zp.b;
      let x0 = ax;
      let y0 = ay;
      let z0 = az;
      const n = 7;
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        const j = k < n ? 0.45 * Math.sin(f * Math.PI) : 0;
        const x = ax + (bx - ax) * f + (Math.random() - 0.5) * j;
        const y = ay + (by - ay) * f + (Math.random() - 0.5) * j;
        const z = az + (bz - az) * f + (Math.random() - 0.5) * j;
        fr.lineXYZ(x0, y0, z0, x, y, z, [0.78, 0.92, 1], 3.4, 7600 + k, 1, 0.02, 0);
        x0 = x;
        y0 = y;
        z0 = z;
      }
    }
    // (ROADMAP 11.24) where the part being drawn goes, lit; a part's lines glowing in as it comes
    this.pen.draw(fr);
    // the hero's
    if (this.hero.length) this.drawHero(fr);
    // the gun's: its wings, its rotor
    // others
    for (const o of this.others) {
      if (o.kind === 'car' && o.model) {
        const c = o.ref;
        _e.set(0, c.yaw, 0, 'YXZ');
        _q.setFromEuler(_e);
        o.model.matrix.compose(_p.set(c.pos.x, c.pos.y || 0, c.pos.z), _q, _s.set(1, 1, 1));
        o.model.matrixWorldNeedsUpdate = true;
        const m = o.model.children[0];
        if (m && m.userData.spin) m.userData.spin.rotation.y += this.fdt * 24;
        if (o.part.type === 'balloon' && m) {
          for (const b of m.children) {
            b.position.y = b.userData.base.y + Math.sin(t * 1.4 + b.userData.base.x) * 0.15;
            _v.copy(b.position).applyMatrix4(o.model.matrix);
            const K = KINDS[c.spec.kind] || KINDS.sedan;
            _w.set(0, K.roofY, 0).applyMatrix4(o.model.matrix);
            fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, [0.2, 0.2, 0.24], 2, 7300, 1, 0.01, 0);
          }
        }
        if (o.part.type === 'jet' && m && m.userData.flame) m.userData.flame.scale.z = 1.4 + Math.sin(t * 40) * 0.3;
        if (o.part.type === 'barrel' && m && m.userData.pivot && o.st.aim !== undefined) m.userData.pivot.rotation.y = o.st.aim - c.yaw;
        if (o.part.type === 'spring' && m && m.userData.coil) m.userData.coil.scale.y = clamp(0.3 + o.st.vy * 0.08, 0.3, 1.4);
      } else if (o.kind === 'person' && o.model) {
        const st = o.st;
        const m = o.model;
        if (st.anchor) {
          m.position.set(st.anchor.x, st.anchor.y + (o.part.type === 'rotor' ? 0.2 : 1.1), st.anchor.z);
          if (o.part.type === 'balloon') fr.lineXYZ(st.anchor.x, st.anchor.y, st.anchor.z, m.position.x, m.position.y + 0.1, m.position.z, [0.2, 0.2, 0.24], 2, 7400, 1, 0.01, 0);
          const sp = m.children[0] && m.children[0].userData.spin;
          if (sp) sp.rotation.y += this.fdt * 26;
        } else {
          const e = o.ref;
          m.position.set(e.pos.x, e.pos.y + 2.2, e.pos.z);
        }
      }
    }
    // the tag follows what it is about
    if (this.tagEl && this.tagT > 0 && this.tagAt) this.placeTag();
  }

  // the hero's parts, on his body (his joints, this frame)
  drawHero(fr) {
    const g = this.game;
    const p = g.player;
    const fig = p.fig;
    const j = fig.j;
    const show = p.mode === 'foot' || p.mode === 'climb' || p.mode === 'swim';
    const yaw = fig.yaw !== undefined ? fig.yaw : p.yaw;
    const t = g.time;
    for (const h of this.hero) {
      const m = h.model;
      if (!m) continue;
      m.visible = show;
      if (!show) continue;
      const type = h.part.type;
      m.rotation.set(0, yaw, 0);
      if (type === 'wheel') {
        // (a skate under each foot)
        m.position.set(0, 0, 0);
        m.rotation.set(0, 0, 0);
        const roll = Math.hypot(p.vel.x, p.vel.z) * this.fdt * 6;
        for (const foot of m.children) {
          const f = foot.userData.side < 0 ? j.footL : j.footR;
          foot.position.set(f.x, f.y - 0.04, f.z);
          foot.rotation.set(0, yaw, 0);
          for (const w of foot.children) if (w.userData.spin) w.userData.spin.rotation.x += roll;
        }
      } else if (type === 'wing') {
        _v.lerpVectors(j.neck, j.hip, 0.3);
        m.position.set(_v.x - Math.sin(yaw) * 0.16, _v.y, _v.z - Math.cos(yaw) * 0.16);
        const spread = p.onGround ? 0.35 : 1;
        for (const w of m.children) {
          w.rotation.set(0, (1 - spread) * 1.1 * w.userData.side, 0);
          w.scale.setScalar(0.5 + spread * 0.5);
        }
      } else if (type === 'rotor') {
        m.position.set(j.headC.x, j.headC.y + 0.08, j.headC.z);
        const sp = m.userData.spin;
        if (sp) sp.rotation.y += this.fdt * (p.onGround ? 3 : 28);
        m.scale.setScalar(0.62);
      } else if (type === 'jet') {
        _v.lerpVectors(j.neck, j.hip, 0.4);
        m.position.set(_v.x - Math.sin(yaw) * 0.2, _v.y, _v.z - Math.cos(yaw) * 0.2);
        const fl = m.userData.flame;
        if (fl) fl.scale.y = damp(fl.scale.y, this.heroThrust ? 0.9 + Math.sin(t * 40) * 0.2 : 0.001, 20, this.fdt);
      } else if (type === 'spring') {
        m.position.set(0, 0, 0);
        m.rotation.set(0, 0, 0);
        for (const s of m.children) {
          const f = s.userData.side < 0 ? j.footL : j.footR;
          s.position.set(f.x, f.y - (p.onGround ? 0.14 : 0.3), f.z);
          if (s.userData.coil) s.userData.coil.scale.y = p.onGround ? 0.14 : 0.3;
        }
      } else if (type === 'blade') {
        m.position.copy(j.elbowR);
        _v.subVectors(j.handR, j.elbowR).normalize();
        m.quaternion.setFromUnitVectors(_w.set(0, 0, 1), _v);
      } else if (type === 'armor') {
        _v.lerpVectors(j.neck, j.hip, 0.4);
        m.position.copy(_v);
      } else if (type === 'balloon') {
        const hd = j.handL;
        const top = 1.7 + Math.sin(t * 1.3) * 0.08;
        m.position.set(hd.x + Math.sin(t * 0.9) * 0.15, hd.y + top, hd.z);
        fr.lineXYZ(hd.x, hd.y, hd.z, m.position.x, m.position.y + 0.08, m.position.z, [0.2, 0.2, 0.24], 2, 7500, 1, 0.01, 0);
      } else if (type === 'magnet') {
        m.position.copy(j.handL);
        m.rotation.set(-0.4, yaw, 0);
      } else if (type === 'star') {
        m.position.set(j.headC.x, j.headC.y + 0.22, j.headC.z);
        m.scale.setScalar(0.5);
        if (m.userData.spin) {
          m.userData.spin.rotation.y += this.fdt * 3.5;
          m.userData.spin.visible = h.part.until - t > 2.5 || Math.sin(t * 22) > -0.3;
        }
      } else if (type === 'chute') {
        _v.lerpVectors(j.neck, j.hip, 0.25);
        m.position.set(_v.x - Math.sin(yaw) * 0.2, _v.y - 0.1, _v.z - Math.cos(yaw) * 0.2);
        m.scale.setScalar(0.62);
        const cn = m.userData.canopy;
        if (cn) {
          const k = damp(cn.scale.x, this.heroChuteOpen ? 1 : 0.001, 6, this.fdt);
          cn.scale.setScalar(k);
          cn.visible = k > 0.02;
        }
      }
    }
  }

  // ------------------------------------------------------------------ the little card that says what it does
  tag(res, t, cost, alts = [], inkI = 1, canInk = false) {
    if (typeof document === 'undefined') return;
    if (!this.tagEl) {
      const el = document.createElement('div');
      el.id = 'fz-tag';
      el.className = 'fz-tag';
      document.body.appendChild(el);
      this.tagEl = el;
      // (its "not that one?" chips: a finger works them as it touches them, the mouse clicks)
      const pick = (e) => {
        const b = e.target.closest('button[data-a]');
        if (!b || !el.classList.contains('on')) return;
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.a === 'undo') this.undo();
        else if (b.dataset.a === 'ink') this.toInk();
        else this.swap(b.dataset.a);
        // (the pen stays out a while longer - another line may come)
        const fd = this.game.freedraw;
        if (fd && fd.autoShut) fd.autoShut = performance.now() + (fd.autoShutLen || 3800);
      };
      el.addEventListener('pointerdown', pick);
    }
    const ink = res.part.type === 'decor';
    const info = PARTS[res.part.type] || { name: '' };
    const combo = (res.combos || []).map((k) => COMBO_NAME[k]).filter(Boolean);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const dot = ink ? (INKS[inkI] || INKS[1]).css : PART_CSS[res.part.type];
    // (ROADMAP 11.22: on the car you drive - small: its name, what it does, the other things it could
    // be, back to a drawing, away)
    this.tagEl.classList.toggle('mini', t.kind === 'veh');
    if (t.kind === 'veh') {
      const say = [res.rule, res.use].filter(Boolean).join(' · ');
      this.tagEl.innerHTML = `<b><i style="background:${dot}"></i>${esc(res.name || info.name)}${cost ? `<small>−${cost}</small>` : ''}</b>${say ? `<span>${esc(say)}</span>` : ''}${combo.map((c) => `<strong>✦ ${esc(c)}</strong>`).join('')}<div class="fz-alt">${alts.map((a) => `<button data-a="${a}"><i style="background:${PART_CSS[a]}"></i>${esc(PARTS[a].name)}</button>`).join('')}${canInk ? '<button data-a="ink" class="ink">✎ ציור</button>' : ''}<button data-a="undo" class="x">✕</button></div>`;
      this.tagEl.classList.add('on');
      this.tagT = combo.length ? 5 : 4;
      this.tagAt = t;
      this.placeTag();
      if (combo.length) this.game.audio.play('ding', 0.6);
      return;
    }
    this.tagEl.innerHTML = `<b><i style="background:${dot}"></i>${esc(res.name || info.name)}</b><span>${esc(res.rule || '')}</span>${res.nums ? `<em>${esc(res.nums)}</em>` : ''}${res.use ? `<u>${esc(res.use)}</u>` : ''}${combo.map((c) => `<strong>✦ ${esc(c)}</strong>`).join('')}<small>−${cost} דיו</small>${alts.length || ink || canInk ? `<div class="fz-alt">${ink ? '' : 'לא זה?'}${alts.map((a) => `<button data-a="${a}"><i style="background:${PART_CSS[a]}"></i>${esc(PARTS[a].name)}</button>`).join('')}${canInk ? '<button data-a="ink" class="ink">✎ רק ציור</button>' : ''}${ink ? '<button data-a="undo" class="x">✕ למחוק</button>' : ''}</div>` : ''}`;
    this.tagEl.classList.add('on');
    this.tagT = combo.length || alts.length || ink || canInk ? 5 : 3.6;
    this.tagAt = t;
    this.placeTag();
    if (combo.length) this.game.audio.play('ding', 0.6);
  }

  // beside the thing (not over it: what was just drawn over it - a balloon, a rotor - shows)
  placeTag() {
    const t = this.tagAt;
    const el = this.tagEl;
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 80;
    // (ROADMAP 11.22: never over the pen's buttons - a column at the side on a phone, a row below
    // on a computer)
    let xMax = W - w - 8;
    let yMax = Hh - h - 90;
    const tools = this.game.freedraw && this.game.freedraw.isOpen ? document.getElementById('fd-tools') : null;
    if (tools) {
      const r = tools.getBoundingClientRect();
      if (r.width && r.height < r.width * 0.6) yMax = Math.min(yMax, r.top - h - 8);
      else if (r.width && r.left > W / 2) xMax = Math.min(xMax, r.left - w - 8);
    }
    let x = W / 2 - w / 2;
    let y = Hh * 0.3;
    const ref = t.ref;
    const pos = t.kind === 'weapon' ? this.game.player.pos : ref && ref.pos;
    if (pos) {
      const D = t.D || { hw: 0.4, h: 1.8 };
      const yc = (pos.y || 0) + (t.kind === 'veh' && ref.fz && ref.fz.lift ? ref.fz.lift : 0) + (D.h || 1.5) * 0.6;
      const q = this.screen(pos.x, yc, pos.z);
      if (q.front) {
        // (its half width on screen, from the camera's right)
        _cf.set(1, 0, 0).applyQuaternion(this.game.camera.quaternion);
        const r = Math.max(D.hw || 0.4, D.hl || 0.4) * 1.1 + 0.3;
        const e = this.screen(pos.x + _cf.x * r, yc + _cf.y * r, pos.z + _cf.z * r);
        const half = Math.abs(e.x - q.x);
        x = q.x + half + 10 <= xMax ? q.x + half + 10 : q.x - half - 10 - w;
        y = q.y - h * 0.6;
      }
    }
    el.style.left = `${clamp(x, 8, Math.max(8, xMax))}px`;
    el.style.top = `${clamp(y, 56, Math.max(56, yMax))}px`;
  }

  say(text, kind = 'info') {
    this.game.hud.toast(text, kind, 2.2);
    if (kind === 'bad') this.game.audio.play('meh', 0.4);
  }

  // new combinations (once each, as news)
  newCombos(list) {
    const out = [];
    for (const k of list) {
      if (!this.combosSeen.has(k)) {
        this.combosSeen.add(k);
        out.push(k);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ keeping them
  // (game/save.js) what is on a car of yours
  saveVeh(v) {
    const R = v.fuse;
    if (!R || !(R.parts.length || (R.decor && R.decor.length))) return undefined;
    const parts = R.parts.filter((p) => !p.until).map((p) => ({ type: p.type, v: p.v, n: p.n, at: p.at, dir: p.dir, ink: p.ink, cost: p.cost, ...(p.shape ? { shape: p.shape } : {}) }));
    return R.decor && R.decor.length ? { parts, decor: R.decor } : parts;
  }

  loadVeh(v, saved) {
    const list = Array.isArray(saved) ? saved : saved && Array.isArray(saved.parts) ? saved.parts : [];
    const decor = saved && !Array.isArray(saved) && Array.isArray(saved.decor) ? saved.decor : [];
    if (!list.length && !decor.length) return;
    v.fuse = { parts: list.map((p) => ({ ...p, t0: 0, id: Math.random().toString(36).slice(2, 8) })), root: null, models: [], decor };
    this.applyVeh(v);
    this.buildVeh(v);
  }
}

export const PART_CSS = {
  wheel: '#3c3c46', wing: '#e8e2d2', rotor: '#d23a32', jet: '#ff8a2a', spring: '#d6c84a', barrel: '#4c5448', blade: '#c8ccd6', armor: '#7c818c', balloon: '#e8333d', magnet: '#d21f26',
  star: '#ffd02e', bolt: '#5ab8ff', smoke: '#8c8e9c', chute: '#f2604f', float: '#ff8c28', deco3: '#efe9da',
};

export const COMBO_NAME = {
  eagle: 'נשר — קפיצה גבוהה וגלישה ארוכה',
  plane: 'מטוס — באוויר, Shift שומר על גובה',
  gunship: 'מסוק קרב — יורה מהר יותר',
  sniper: 'צלף בשמיים — מדויק פי 2.5',
  ironRam: 'איל ברזל — בהאצה מעיף הכול',
  tank: 'טנק — עולה על הכול ומועך',
  monster: 'מפלצת קופצת — הנחיתה מעיפה את מי שמסביב',
  rocketman: 'איש רקטה — הדלק נגמר לאט פי 3',
  eagleH: 'נשר — קפיצת על וגלישה',
  turbo: 'רולר טורבו — בריצה מהירה פי 1.35',
  airship: 'ספינת אוויר — מרחפים כמעט בלי הגבלה',
};

// (ROADMAP 11.21) a line of ink on a car, point to point in its frame M
function inkRun(fr, pts, M, c, w, seed, a) {
  _v.set(pts[0][0], pts[0][1], pts[0][2]).applyMatrix4(M);
  for (let i = 1; i < pts.length; i++) {
    _w.set(pts[i][0], pts[i][1], pts[i][2]).applyMatrix4(M);
    fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, c, w, seed + i, a, 0.012, 0);
    _v.copy(_w);
  }
}

// (ROADMAP 11.21) strokes across a closed line (screen px): lines at 45 degrees, gap apart, each one
// inside it (even-odd: a star drawn in one go keeps its middle empty) - [[a, b], ...], 18 at most
function hatch(P, gap) {
  const c = Math.SQRT1_2;
  const R = P.map(([x, y]) => [(x + y) * c, (y - x) * c]);
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const q of R) {
    v0 = Math.min(v0, q[1]);
    v1 = Math.max(v1, q[1]);
  }
  gap = Math.max(gap, (v1 - v0) / 18);
  const out = [];
  const n = R.length;
  for (let v = v0 + gap / 2; v < v1 && out.length < 24; v += gap) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const a = R[i];
      const b = R[(i + 1) % n];
      if (a[1] <= v !== b[1] <= v) xs.push(a[0] + ((v - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] < 4) continue;
      out.push([[(xs[i] - v) * c, (xs[i] + v) * c], [(xs[i + 1] - v) * c, (xs[i + 1] + v) * c]]);
    }
  }
  return out;
}

// (ROADMAP 11.22) a part drawn on your car: its body and its lines - in the ink it was drawn in, its
// body a little lighter and its lines the ink itself (a light ink: lines dark on it); in pencil or a
// dark ink, what it is made of - a wing of the car's own paint, a flame of fire, a balloon red - its
// lines that ink (light ones on a dark body)
const OWN_PAINT = new Set(['wing', 'blade', 'deco3']);
function drawnColours(ink, v, type) {
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  if (ink && !ink.pencil && lum(ink.c) > 0.3) {
    if (lum(ink.c) > 0.72) return { body: ink.c, line: EDGE_DARK };
    return { body: ink.c.map((x) => x + (1 - x) * 0.42), line: ink.c };
  }
  const body = OWN_PAINT.has(type) && Array.isArray(v.color) ? v.color : type === 'jet' ? [1, 0.62, 0.2] : PARTS[type].col;
  return { body, line: lum(body) < 0.32 ? EDGE_PAPER : ink && !ink.pencil ? ink.c : [0.16, 0.16, 0.22] };
}

// (ROADMAP 11.22) a drawing's box on the screen, all its lines
function capsBox(caps) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of caps) {
    x0 = Math.min(x0, c.box.x0);
    y0 = Math.min(y0, c.box.y0);
    x1 = Math.max(x1, c.box.x1);
    y1 = Math.max(y1, c.box.y1);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// (does a drawing go on from another on the screen - an end of a line of it within px of the other
// where it is off the car: its part, not the paint it came out of)
function touching(A, B, px) {
  for (const a of A) {
    for (const q of [a.pts[0], a.pts[a.pts.length - 1]]) {
      for (const b of B) for (const r of b.pts) if (!r.k && Math.hypot(q.s[0] - r.s[0], q.s[1] - r.s[1]) <= px) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ sizes of things
// (ROADMAP 11.21) what a line that is no part could be made into: the parts its shape is nearest to,
// where it is on the thing (S: fusemark.js shapeOf; m: its middle on it, c [x, y, z])
function guessParts(S, m, F) {
  const D = F.dims;
  const cy = m.c[1];
  const cz = m.c[2];
  const above = cy > D.h * 0.95;
  const low = cy < D.h * 0.35;
  const back = cz < -D.hl * 0.5;
  const front = cz > D.hl * 0.5;
  const out = [];
  const add = (...ts) => {
    for (const t of ts) if (!out.includes(t)) out.push(t);
  };
  if (S.closed) {
    if (S.nx >= 4 || S.nc >= 8) add('star');
    if (above) add('balloon');
    else if (low) add('wheel', 'float');
    add('armor', 'balloon', 'star');
  } else if (Math.abs(S.T.signed) > 8) add('smoke', 'spring');
  else if (S.nc === 2 && S.teeth <= 2) add('bolt', 'jet');
  else if (S.coils >= 1) add('spring', 'jet');
  else if (S.teeth >= 2) add(back ? 'jet' : 'armor', 'jet', 'armor', 'spring');
  else if (S.straight > 0.7) {
    if (above) add('rotor');
    add('barrel', 'wing', 'rotor');
  } else {
    if (front) add('blade');
    if (above) add('balloon');
    add('wing', 'blade', 'magnet', 'jet');
  }
  return out;
}

function vehDims(v) {
  if (v.kind === 'car') {
    const K = KINDS[v.carKind] || KINDS.sedan;
    return { hl: K.len / 2, hw: K.W / 2, h: K.roofY || v.heightM || 1.45 };
  }
  return { hl: v.halfLen || 1.2, hw: v.halfWid || 0.6, h: v.heightM || 1.4 };
}

function carDims(c) {
  const K = KINDS[c.spec.kind] || null;
  if (K) return { hl: K.len / 2, hw: K.W / 2, h: K.roofY || 1.45 };
  return { hl: c.halfLen || 2.3, hw: c.halfWid || 1, h: c.bus ? 3 : 1.5 };
}

function vehWheelR(v) {
  if (v.kind === 'car') return (KINDS[v.carKind] || KINDS.sedan).r;
  if (v.wheels && v.wheels[0] && v.wheels[0].userData && v.wheels[0].userData.r) return v.wheels[0].userData.r;
  return 0.34;
}

function carWheelR(c) {
  return (KINDS[c.spec.kind] || KINDS.sedan).r;
}

// where a car's wheels are, in its frame (render/cars.js build)
function vehWheelSpots(v, K, D) {
  if (K) {
    const out = [];
    for (const t of K.wheels) {
      const z = t * K.len - K.len / 2;
      for (const sd of [-1, 1]) out.push({ x: sd * (K.W / 2 - 0.2), z });
    }
    return out;
  }
  if (v && v.wheels && v.wheels.length) {
    return v.wheels.map((w) => ({ x: w.position.x, z: w.position.z }));
  }
  return [-1, 1].flatMap((sd) => [-0.7, 0.7].map((t) => ({ x: sd * D.hw, z: t * D.hl })));
}

// the height of a car's waist at t (0 its tail, 1 its nose)
function beltAt(K, t) {
  const B = K.belt;
  for (let i = 1; i < B.length; i++) {
    if (t <= B[i][0]) {
      const k = (t - B[i - 1][0]) / Math.max(1e-6, B[i][0] - B[i - 1][0]);
      return B[i - 1][1] + (B[i][1] - B[i - 1][1]) * k;
    }
  }
  return B[B.length - 1][1];
}

// ------------------------------------------------------------------ what each one does, said
function vehRule(p, v) {
  const n = p.n;
  const fz = v.fz || {};
  const H = v.handling || {};
  const t = v.game.touch;
  const SP = t ? '▲' : 'רווח';
  const DN = t ? '▼' : 'C';
  switch (p.type) {
    case 'wheel': {
      const name = { round: 'גלגלי מרוץ', small: 'גלגלים קטנים', teeth: 'גלגלי שיניים', big: 'גלגלי מפלצת', bigteeth: 'גלגלי מפלצת עם שיניים', square: 'גלגלים מרובעים' }[p.v];
      const rule = {
        round: 'מהירות סופית +18%',
        small: 'זינוק חזק וסיבוב חד, מהירות סופית נמוכה',
        teeth: `עולה על מדרכות ומדרגות (עד ${Math.round((fz.step || 0.68) * 100)} ס״מ), אחיזה בשטח`,
        big: `קוטר ${fmt((fz.wheelR || 0.6) * 2)} מ׳: עולה על הכול ומועך מכוניות`,
        bigteeth: 'עולה על הכול, מטפס ומועך',
        square: 'מקרטע ואיטי — עדיף לצייר אותם על מישהו אחר',
      }[p.v];
      return { name, rule, nums: `מהירות סופית ${Math.round(H.top || 0)} מ׳/ש` };
    }
    case 'wing':
      if (p.v === 'spoiler') return { name: 'ספוילר', rule: 'אחיזה בפניות במהירות', nums: `אחיזה ${fmt(H.grip || 0)}` };
      return { name: 'כנפיים', rule: `נופלת לאט פי ${fmt(1 / Math.max(0.1, 1 - v.glide))} וגולשת אחרי קפיצה`, nums: `מוטה ${fmt((n.span || 1) * 2 + (v.halfWid || 1) * 2)} מ׳`, use: 'קופצים מרמפה, מגג או בקפיץ' };
    case 'rotor':
      return fz.rotor >= 1
        ? { name: 'רוטור', rule: 'טסה מעל הפקקים והגגות', nums: `קוטר ${fmt(fz.rotorSpan || 2)} מ׳ · הרמה ×${fmt(fz.rotor)}`, use: `${SP} — למעלה · ${DN} — למטה` }
        : { name: 'רוטור קטן', rule: `קטן מדי בשביל המשקל — רק מאט נפילה. צריך קוטר של ${fmt(Math.sqrt((H.mass || 1) / 0.42))} מ׳`, nums: `קוטר ${fmt(fz.rotorSpan || 1)} מ׳` };
    case 'jet':
      if (p.v === 'front') return { name: 'מבער להבות', rule: 'קליק — אש קדימה', nums: `טווח ${Math.round(fz.flame ? fz.flame.range : 8)} מ׳` };
      if (p.v === 'under') return { name: 'סילון מתחת', rule: 'זינוק אנכי', nums: '2.5 שניות דלק', use: `${SP} — למעלה` };
      // (a phone: its turbo button - or the stick all the way, with the stick in the settings)
      return { name: 'סילון', rule: `האצה: מהירות +${Math.round(40 * (fz.jetK || 1))}%, ובאוויר דוחף קדימה`, nums: `כוח ×${fmt(fz.jetK || 1)}`, use: !t ? 'Shift' : v.game.settings.get('touchDrive') !== 'stick' ? 'כפתור הטורבו' : 'הג׳ויסטיק עד הסוף' };
    case 'spring':
      if (p.v === 'bumper') return { name: 'פגוש קפיץ', rule: 'מי שנפגע מקדימה עף רחוק', nums: `${p.n.coils || 4} סלילים` };
      return { name: 'קפיץ', rule: `קפיצה לגובה ${fmt(((fz.jump || 9) ** 2) / 40)} מ׳`, nums: `${p.n.coils || 4} סלילים`, use: SP };
    case 'barrel': {
      const gun = p.gun;
      const what = gun.type === 'cannon' ? 'תותח' : 'מקלע';
      const where = { turret: 'בצריח שמסתובב אחרי המבט', front: 'יורה קדימה', rear: 'יורה אחורה על מי שרודף' }[p.v];
      return { name: what, rule: where, nums: `טווח ${gun.range} מ׳ · נזק ${gun.dmg}`, use: t ? 'כפתור הירי' : 'קליק' };
    }
    case 'blade':
      return p.v === 'side' ? { name: 'להבי צד', rule: 'חותך את מי שנוסע או עומד לידך', nums: `נזק ${v.blades ? v.blades.side : 40}` } : { name: 'להב חרש', rule: 'מעיף מכוניות ומחסומים מהדרך בלי להיפגע מקדימה', nums: `הדיפה ×${fmt(v.ram ? v.ram.k : 2)}` };
    case 'armor':
      return { name: 'שריון', rule: `סופג ${Math.round((v.armor || 0) * 100)}% מכל פגיעה — וכבד יותר`, nums: `מהירות סופית ${Math.round(H.top || 0)} מ׳/ש` };
    case 'balloon':
      return fz.balloon >= 1 ? { name: 'בלון', rule: 'המכונית מרחפת ושטה ברוח', nums: `קוטר ${fmt(fz.balloonD || 1.5)} מ׳ · עילוי ×${fmt(fz.balloon)}`, use: `${SP} — למעלה · ${DN} — למטה` } : { name: 'בלון קטן', rule: 'קטן מדי להרים אותה — רק מאט נפילה', nums: `קוטר ${fmt(fz.balloonD || 1)} מ׳ · מרים מ־${fmt(Math.cbrt((v.handling ? v.handling.mass : 1.25) / 0.32))} מ׳` };
    case 'magnet':
      return { name: p.v === 'back' ? 'מגנט מאחור' : 'מגנט', rule: p.v === 'back' ? 'מי שנוסע אחריך נדבק ונגרר' : 'מושך מכוניות מקדימה ומדביק אותן לחרטום', nums: `טווח ${Math.round(fz.magnet ? fz.magnet.reach : 12)} מ׳`, use: `${DN} — לשחרר` };
    case 'star':
      return { name: 'כוכב', rule: 'כוח כוכב: שום דבר לא פוגע בה, היא מועכת כל מה שבדרך ומהירה יותר', nums: `${STAR_T} שניות`, use: 'נוסעים על כולם' };
    case 'bolt':
      return { name: 'סליל ברקים', rule: 'מי שמתקרב חוטף ברק — אויבים נופלים, ניידות נעצרות', nums: `טווח ${Math.round(fz.zap ? fz.zap.reach : 10)} מ׳` };
    case 'smoke':
      return { name: 'מסך עשן', rule: 'כשהמשטרה רודפת — ענן דיו מאחור, והם לא רואים דרכו', nums: '6 שניות עשן, ונטען לבד' };
    case 'chute':
      return { name: 'מצנח', rule: 'בנפילה הוא נפתח — יורדים לאט וגולשים', use: 'קופצים מגג, מרמפה או בקפיץ' };
    case 'float':
      // (ROADMAP 11.23: too small for its weight, it sinks - slower)
      return fz.float && fz.float.k < 1
        ? { name: 'מצופים קטנים', rule: 'קטנים מדי בשבילה — במים היא שוקעת לאט. צריך ארוכים ועבים יותר' }
        : { name: 'מצופים', rule: 'נוסעים לתוך הים — והיא צפה ושטה', nums: 'במים עד 14 מ׳/ש' };
    case 'deco3':
      return { name: 'קישוט', rule: 'עליה כמו שציירתם' };
    default:
      return { rule: '' };
  }
}

function heroRule(p, touch) {
  const n = p.n;
  // (the jump: Space, or the phone's jump button)
  const SP = touch ? 'קפיצה' : 'רווח';
  switch (p.type) {
    case 'wheel':
      return { name: p.v === 'square' ? 'גלגיליות מרובעות' : 'רולר', rule: p.v === 'square' ? 'מקרטע — דווקא איטי יותר' : `רצים מהר פי ${fmt(p.v === 'big' ? 1.4 : p.v === 'small' ? 1.7 : 1.55)}`, nums: `${HERO_T} שניות` };
    case 'wing':
      return { name: 'כנפיים', rule: 'בנפילה ובקפיצה — גולשים', nums: `שקיעה ${fmt(clamp(4.4 - (n.span || 1) * 1.1, 1.6, 4))} מ׳/ש`, use: 'קופצים מגובה' };
    case 'rotor':
      return { name: 'כובע רוטור', rule: 'עולים באוויר — 5 שניות, ונטען על הקרקע', use: `מחזיקים ${SP} באוויר` };
    case 'jet':
      return { name: 'תרמיל סילון', rule: 'טסים — 3 שניות דלק, ונטען על הקרקע', use: `קופצים, ומחזיקים ${SP}` };
    case 'spring':
      return { name: 'קפיצים בנעליים', rule: `קפיצה גבוהה פי ${fmt(clamp(1.45 + (n.coils || 4) * 0.11, 1.5, 2.4))} ונחיתה רכה`, nums: `${n.coils || 4} סלילים` };
    case 'blade':
      return { name: 'להב על היד', rule: 'אגרופים חותכים — נזק פי 2.5' };
    case 'armor':
      return { name: 'שריון', rule: `+${p.armorAdd || 60} שריון`, nums: `כיסוי ${Math.round((n.cover || 0.4) * 100)}%` };
    case 'balloon':
      return (n.d || 0.9) >= 1.1 ? { name: 'בלון', rule: 'מרים אתכם — ובנפילה מרחפים', use: `${SP} — למעלה · ${touch ? '▼' : 'C'} — לשחרר` } : { name: 'בלון קטן', rule: 'נופלים לאט כמו נוצה' };
    case 'magnet':
      return { name: 'מגנט ביד', rule: 'כסף, תחמושת ונשקים שנפלו — נמשכים אליכם' };
    case 'star':
      return { name: 'כוכב', rule: 'שום דבר לא פוגע בכם, ורצים מהר יותר', nums: `${STAR_T} שניות` };
    case 'bolt':
      return { name: 'ברק', rule: 'אויב שמתקרב חוטף ברק ונופל', nums: 'טווח 7 מ׳' };
    case 'chute':
      return { name: 'מצנח', rule: 'בנפילה הוא נפתח — נוחתים רך', use: 'קופצים מגובה' };
    default:
      return { rule: '' };
  }
}

function weaponRule(p, def) {
  switch (p.type) {
    case 'barrel':
      return def.spin ? { name: 'קנים נוספים', rule: 'מסתובב כמו מיניגאן' } : { name: 'קנה נוסף', rule: 'שני כדורים בכל לחיצה', nums: (p.n.len || 0) > 0.45 ? 'ארוך: רחוק ומדויק יותר' : '' };
    case 'blade':
      return { name: 'כידון', rule: `דקירה מקרוב: נזק ${def.bayonet ? def.bayonet.damage : 40}` };
    case 'spring':
      return { name: 'קפיץ בקנה', rule: `הקליעים קופצים מהקירות ${def.bounce || 2} פעמים` };
    case 'magnet':
      return { name: 'מגנט על הקנה', rule: 'הקליעים מתכופפים אל האויב' };
    case 'jet':
      return { name: 'קליעי רקטה', rule: 'מהירים פי 1.45 ומתפוצצים' };
    case 'wing':
      return { name: 'כנפיים לקליעים', rule: 'מטוסי נייר שגולשים אל המטרה' };
    case 'armor':
      return { name: 'מגן על הנשק', rule: 'חוסם חצי מכל מכה' };
    case 'rotor':
      return { name: 'מאוורר', rule: 'הודף אויבים אחורה' };
    default:
      return { rule: '' };
  }
}
