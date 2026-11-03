import * as THREE from 'three';
import { Kit, itemMats, linC } from '../items.js';
import { surfaceVariant } from '../../render/materials.js';
import { clamp } from '../../core/util.js';

// (v5, ROADMAP 18) The first drawing: a ramp off the roof.
//
// Time all but stops; the camera stands off to the side of the roof, the gap and the street far below
// it in the picture, the other car park's roof across the street; a sheet of the notebook is over the
// picture, and a faint dotted line shows the way - from the car to the roof's edge, up. Whatever the
// player draws over it (a line, roughly that way: it is the first drawing of the game, and it is
// forgiving) is laid onto the roof where it was drawn - and grows: the ink line itself first, then
// the deck plates one after another along it, the columns up from the roof under them, the girders,
// the braces, the rails, the hazard stripes at the lip, the hatching - white as the paper, all of it,
// until the colour sweeps along it from the car to the lip and it is a real thing, made of steel,
// strong enough to take a car at speed. The car then flies off it (Jump, below) on a line that lands
// it on the other roof.

const UP = new THREE.Vector3(0, 1, 0);

export class RampDraw {
  // ui: game/prologue/ui.js; spec: { roofY, laneZ, carX, edgeX, landX, camera }
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.on = false;
    this.pts = [];
    this.fails = 0;
  }

  open(spec, done) {
    this.spec = spec;
    this.done = done;
    this.on = true;
    this.pts = [];
    const el = this.ui.drawEl;
    const cv = el.querySelector('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    this.cv = cv;
    this.g = cv.getContext('2d');
    this.dpr = dpr;
    el.classList.add('on');
    // (the mouse let go of the game's camera: it draws now - game/game.js keeps it free while the
    // sheet is up, and does not take it for the pause)
    if (!this.game.touch) this.game.input.releaseLock();
    this.ui.hint('Draw a ramp to jump across<small>גררו קו מהמכונית אל קצה הגג — כלפי מעלה</small>');
    this.t = 0;
    this.drawing = false;
    const P = (e) => [e.clientX * dpr, e.clientY * dpr];
    this.onDown = (e) => {
      if (!this.on) return;
      e.preventDefault();
      this.drawing = true;
      this.pts = [P(e)];
      try {
        el.setPointerCapture(e.pointerId);
      } catch (er) {
        // (not everywhere)
      }
      this.game.audio.play('click', 0.4);
    };
    this.onMove = (e) => {
      if (!this.drawing) return;
      const p = P(e);
      const l = this.pts[this.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 3 * dpr) this.pts.push(p);
    };
    this.onUp = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.finish();
    };
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    // the guide: where a ramp would go, dotted, on the screen
    this.guide = this.guideCurve();
  }

  close() {
    const el = this.ui.drawEl;
    el.classList.remove('on');
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    this.ui.hint(null);
    this.on = false;
  }

  // a world point on the screen (canvas pixels)
  toScreen(x, y, z, out = [0, 0]) {
    const v = new THREE.Vector3(x, y, z).project(this.spec.camera);
    out[0] = ((v.x + 1) / 2) * this.cv.width;
    out[1] = ((1 - v.y) / 2) * this.cv.height;
    return out;
  }

  // a screen point onto the upright plane through the run-up (z = laneZ)
  toWorld(px, py) {
    const cam = this.spec.camera;
    const nx = (px / this.cv.width) * 2 - 1;
    const ny = 1 - (py / this.cv.height) * 2;
    const p = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
    const o = cam.position;
    const d = p.sub(o).normalize();
    if (Math.abs(d.z) < 1e-4) return null;
    const t = (this.spec.laneZ - o.z) / d.z;
    if (t < 0) return null;
    return new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, this.spec.laneZ);
  }

  guideCurve() {
    const s = this.spec;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = s.startX + (s.edgeX - s.startX) * u;
      const y = s.roofY + 0.2 + 4 * Math.pow(u, 1.5);
      pts.push(this.toScreen(x, y, s.laneZ, [0, 0]));
    }
    return pts;
  }

  finish() {
    const P = this.pts;
    let len = 0;
    for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (len < 70 * this.dpr || P.length < 3) {
      // (too short to be a ramp: again, with the way shown plainer)
      this.fails++;
      this.pts = [];
      this.ui.hint('Draw a ramp to jump across<small>קו ארוך יותר: מהמכונית אל הקצה, ולמעלה</small>');
      this.game.audio.play('meh', 0.4);
      return;
    }
    // onto the roof's plane; whatever way it was drawn, it starts at the car's end
    const W = P.map(([x, y]) => this.toWorld(x, y)).filter(Boolean);
    const prof = fitProfile(W, this.spec, this.fails);
    this.close();
    // (and the mouse back to the camera, on this same click)
    if (!this.game.touch) this.game.input.requestLock(true);
    this.done(prof, P.map((p) => [p[0] / this.dpr, p[1] / this.dpr]));
  }

  // every frame while it is open: the guide breathing, the line as it is drawn
  frame(dt) {
    if (!this.on) return;
    this.t += dt;
    const g = this.g;
    const W = this.cv.width;
    const H = this.cv.height;
    g.clearRect(0, 0, W, H);
    // the paper's grain over the picture, faintly
    g.fillStyle = 'rgba(250,245,232,0.08)';
    g.fillRect(0, 0, W, H);
    // the guide
    const a = 0.35 + 0.35 * Math.sin(this.t * 4);
    g.save();
    g.setLineDash([10 * this.dpr, 12 * this.dpr]);
    g.lineDashOffset = -this.t * 40 * this.dpr;
    g.strokeStyle = `rgba(255,255,255,${a})`;
    g.lineWidth = 4 * this.dpr;
    g.lineCap = 'round';
    g.beginPath();
    this.guide.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.restore();
    // its arrowhead at the lip
    const n = this.guide.length;
    const [ex, ey] = this.guide[n - 1];
    const [px, py] = this.guide[n - 3];
    const ang = Math.atan2(ey - py, ex - px);
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.moveTo(ex + Math.cos(ang) * 16 * this.dpr, ey + Math.sin(ang) * 16 * this.dpr);
    g.lineTo(ex + Math.cos(ang + 2.5) * 14 * this.dpr, ey + Math.sin(ang + 2.5) * 14 * this.dpr);
    g.lineTo(ex + Math.cos(ang - 2.5) * 14 * this.dpr, ey + Math.sin(ang - 2.5) * 14 * this.dpr);
    g.fill();
    // the line being drawn: the city's ink, a pass and a lighter second pass
    if (this.pts.length > 1) {
      for (const [w, al] of [[7, 0.95], [3.5, 0.45]]) {
        g.strokeStyle = `rgba(28,24,48,${al})`;
        g.lineWidth = w * this.dpr;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        this.pts.forEach(([x, y], i) => (i ? g.lineTo(x + (al < 0.9 ? 1.5 : 0), y + (al < 0.9 ? -1 : 0)) : g.moveTo(x, y)));
        g.stroke();
      }
    }
  }
}

// the ramp's shape from the line drawn: where it starts (by the car), its lip (at the roof's edge,
// a little out over the street), how high the lip stands and how it curves up to it - all of it
// from the drawing, kept within what a car can take
export function fitProfile(W, s, fails = 0) {
  let xs = W.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const startX = clamp(maxX, s.edgeX + 9, s.edgeX + 15);
  const lipX = clamp(minX, s.edgeX - 2.5, s.edgeX - 0.5);
  // the height at the lip: the drawing's at its far end, a sensible ramp's if it was drawn down
  const far = W.reduce((a, p) => (p.x < a.x ? p : a), W[0]);
  const near = W.reduce((a, p) => (p.x > a.x ? p : a), W[0]);
  let h = far.y - s.roofY;
  if (!(h > 1)) h = far.y - near.y;
  h = clamp(h, 3.2, 5.4);
  // its curve: how high the drawing is halfway along, for the shape of the kick
  const midX = (startX + lipX) / 2;
  let mid = null;
  let md = Infinity;
  for (const p of W) {
    const d = Math.abs(p.x - midX);
    if (d < md) {
      md = d;
      mid = p;
    }
  }
  let k = mid ? (mid.y - Math.min(near.y, s.roofY + 0.5)) / Math.max(0.5, far.y - Math.min(near.y, s.roofY + 0.5)) : 0.4;
  k = clamp(k, 0.22, 0.6);
  const pow = clamp(Math.log(k) / Math.log(0.5), 0.75, 2.2);
  void fails;
  xs = null;
  return { startX, lipX, h, pow, z: s.laneZ, half: 3.4, roofY: s.roofY };
}

// the ramp's surface height at x (0 before its start)
export function rampH(P, x) {
  const u = (P.startX - x) / (P.startX - P.lipX);
  if (u <= 0) return 0;
  return P.h * Math.pow(Math.min(1, u), P.pow);
}

// ------------------------------------------------------------------ the ramp, growing out of the line
export class Ramp {
  constructor(game, P) {
    this.game = game;
    this.P = P;
    this.t = 0;
    this.pieces = [];
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = true;
    game.scene.add(this.root);
    this.build();
    this.grown = false;
  }

  // its floor (a car on it), for the car park it stands on (Garage.extra)
  floorAt(x, z, y) {
    const P = this.P;
    if (!this.solid) return -Infinity;
    if (Math.abs(z - P.z) > P.half || x > P.startX || x < P.lipX) return -Infinity;
    const h = P.roofY + 0.3 + rampH(P, x);
    return h <= y + 1.6 ? h : -Infinity;
  }

  piece(at, delay, fn, grow = 'y', pivot = null) {
    const K = new Kit();
    const M = itemMats();
    fn(K, M);
    const g = K.build({ seed: Math.random() });
    const holder = new THREE.Group();
    const pv = pivot || at;
    holder.position.copy(pv);
    g.position.set(-pv.x, -pv.y, -pv.z);
    g.matrixAutoUpdate = true;
    holder.add(g);
    holder.scale.set(grow === 'x' ? 0.001 : 1, grow === 'y' ? 0.001 : 1, grow === 'all' ? 0.001 : 1);
    if (grow === 'all') holder.scale.setScalar(0.001);
    holder.visible = false;
    this.root.add(holder);
    this.pieces.push({ holder, delay, grow, done: false });
  }

  build() {
    const P = this.P;
    const Y = P.roofY;
    const STEEL = linC(0.62, 0.64, 0.7);
    const DARK = linC(0.2, 0.2, 0.26);
    const PLATE = linC(0.78, 0.76, 0.72);
    const YEL = linC(0.98, 0.8, 0.18);
    const RED = linC(0.88, 0.22, 0.24);
    const INK = linC(0.1, 0.08, 0.16);
    const z = P.z;
    const half = P.half;
    const N = 14;
    const xAt = (u) => P.startX + (P.lipX - P.startX) * u;
    const yAt = (u) => Y + 0.3 + P.h * Math.pow(u, P.pow);
    const span = P.startX - P.lipX;
    // 0: the line itself, in ink, laid on the roof where it was drawn (a fat tube along the deck's
    // middle) - there from the first moment
    {
      const pts = [];
      for (let i = 0; i <= 30; i++) pts.push(new THREE.Vector3(xAt(i / 30), yAt(i / 30) + 0.06, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      this.piece(new THREE.Vector3(P.startX, Y, z), 0, (K, M) => {
        K.add(M.matte, new THREE.TubeGeometry(curve, 60, 0.13, 6, false), INK);
        for (const s of [-1, 1]) {
          const side = curve.points.map((p) => p.clone().setZ(z + s * half));
          K.add(M.matte, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side), 60, 0.07, 5, false), INK);
        }
      }, 'none');
    }
    // 1: the deck plates, one after another from the car to the lip
    for (let i = 0; i < N; i++) {
      const u0 = i / N;
      const u1 = (i + 1) / N;
      const xa = xAt(u0);
      const xb = xAt(u1);
      const ya = yAt(u0);
      const yb = yAt(u1);
      const cx = (xa + xb) / 2;
      const cy = (ya + yb) / 2;
      const len = Math.hypot(xb - xa, yb - ya) + 0.04;
      const pitch = Math.atan2(yb - ya, xb - xa);
      this.piece(new THREE.Vector3(cx, cy, z), 0.15 + i * 0.06, (K, M) => {
        const g = new THREE.BoxGeometry(len, 0.32, half * 2);
        g.rotateZ(pitch);
        g.translate(cx, cy - 0.16, z);
        K.add(M.metal, g, PLATE);
        // the tread on it: raised bars across, and the rivets along its edges
        for (let b = 0; b < 3; b++) {
          const t = (b + 0.5) / 3;
          const bx = xa + (xb - xa) * t;
          const by = ya + (yb - ya) * t;
          const bar = new THREE.BoxGeometry(0.12, 0.06, half * 2 - 0.5);
          bar.translate(bx, by + 0.02, z);
          K.add(M.metal, bar, STEEL);
        }
        for (const s of [-1, 1]) K.box(M.metal, Math.min(xa, xb), Math.min(ya, yb) - 0.32, z + s * half - 0.08, Math.max(xa, xb), Math.max(ya, yb) - 0.0, z + s * half + 0.08, DARK);
      }, 'all');
    }
    // 2: the columns up from the roof under the girders, and the girders along the edges
    for (let i = 0; i <= 8; i++) {
      const u = (i + 0.4) / 8.4;
      const x = xAt(u);
      const top = yAt(u) - 0.3;
      if (top - Y < 0.4) continue;
      for (const s of [-1, 1]) {
        const zz = z + s * (half - 0.35);
        this.piece(new THREE.Vector3(x, Y, zz), 0.5 + i * 0.08, (K, M) => {
          K.box(M.metal, x - 0.18, Y, zz - 0.18, x + 0.18, top, zz + 0.18, STEEL);
          // its foot plate, bolted to the roof
          K.box(M.metal, x - 0.38, Y, zz - 0.38, x + 0.38, Y + 0.08, zz + 0.38, DARK);
        }, 'y', new THREE.Vector3(x, Y, zz));
      }
    }
    for (const s of [-1, 1]) {
      const zz = z + s * (half - 0.35);
      this.piece(new THREE.Vector3(P.startX, Y, zz), 0.7, (K, M) => {
        const pts = [];
        for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(xAt(i / 20), yAt(i / 20) - 0.55, zz));
        K.add(M.metal, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.26, 4, false), STEEL);
      }, 'x', new THREE.Vector3(P.startX, Y, zz));
    }
    // 3: the cross braces between the columns (an X in each bay, both sides), the struts under
    // the lip out over the street
    for (let i = 1; i <= 8; i++) {
      const u0 = (i - 1 + 0.4) / 8.4;
      const u1 = (i + 0.4) / 8.4;
      const x0 = xAt(u0);
      const x1 = xAt(u1);
      const t0 = yAt(u0) - 0.6;
      const t1 = yAt(u1) - 0.6;
      if (t0 - Y < 1.2) continue;
      for (const s of [-1, 1]) {
        const zz = z + s * (half - 0.35);
        this.piece(new THREE.Vector3((x0 + x1) / 2, (Y + t1) / 2, zz), 1.05 + i * 0.07, (K, M) => {
          strut(K, M.metal, [x0, Y + 0.3, zz], [x1, t1, zz], 0.07, DARK);
          strut(K, M.metal, [x0, t0, zz], [x1, Y + 0.3, zz], 0.07, DARK);
        }, 'all');
      }
      // and across, under the deck
      this.piece(new THREE.Vector3(x1, t1, z), 1.15 + i * 0.07, (K, M) => {
        K.box(M.metal, x1 - 0.1, t1 - 0.1, z - half + 0.35, x1 + 0.1, t1 + 0.1, z + half - 0.35, DARK);
      }, 'all');
    }
    const lipTop = yAt(1);
    for (const s of [-1, 1]) {
      const zz = z + s * (half - 0.35);
      this.piece(new THREE.Vector3(P.lipX, lipTop, zz), 1.45, (K, M) => {
        strut(K, M.metal, [P.lipX + 0.2, lipTop - 0.5, zz], [P.lipX + 3.4, Y + 0.2, zz], 0.16, STEEL);
        strut(K, M.metal, [P.lipX + 1.4, lipTop - 0.4, zz], [P.lipX + 3.4, Y + 0.2, zz], 0.1, DARK);
      }, 'all');
    }
    // 4: the rails along the deck's edges, the hazard stripes at the lip, chevrons up the middle
    for (const s of [-1, 1]) {
      const zz = z + s * (half - 0.05);
      this.piece(new THREE.Vector3(P.startX, Y, zz), 1.5, (K, M) => {
        for (let i = 0; i < 12; i++) {
          const u = i / 12;
          const x = xAt(u);
          const y = yAt(u);
          K.box(M.metal, x - 0.05, y, zz - 0.05, x + 0.05, y + 0.75, zz + 0.05, STEEL);
        }
        const pts = [];
        for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(xAt(i / 20), yAt(i / 20) + 0.75, zz));
        K.add(M.metal, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 4, false), STEEL);
      }, 'x', new THREE.Vector3(P.startX, Y, zz));
    }
    this.piece(new THREE.Vector3(P.lipX, lipTop, z), 1.7, (K, M) => {
      const u0 = 0.9;
      const x0 = xAt(u0);
      for (let i = 0; i < 8; i++) {
        const za = z - half + (i * half * 2) / 8;
        const g = new THREE.BoxGeometry(span * 0.1, 0.03, (half * 2) / 8);
        const pitch = Math.atan2(yAt(1) - yAt(u0), P.lipX - x0);
        g.rotateZ(pitch);
        g.translate((x0 + P.lipX) / 2, (yAt(u0) + yAt(1)) / 2 + 0.02, za + half / 8);
        K.add(M.paint, g, i % 2 ? YEL : DARK);
      }
      for (let c = 0; c < 5; c++) {
        const u = 0.12 + c * 0.15;
        const x = xAt(u);
        const y = yAt(u) + 0.03;
        for (const s of [-1, 1]) {
          const g = new THREE.BoxGeometry(0.22, 0.03, 1.5);
          g.rotateY(s * 0.6);
          g.translate(x - 0.4, y, z + s * 0.55);
          K.add(M.paint, g, c % 2 ? YEL : RED);
        }
      }
    }, 'all');
    // 5: the hatching: short dark strokes over its sides and on the deck, as the city is drawn
    this.piece(new THREE.Vector3(P.startX, Y, z), 1.9, (K, M) => {
      for (let i = 0; i < 60; i++) {
        const u = Math.random();
        const x = xAt(u);
        const y = Y + 0.4 + Math.random() * (yAt(u) - Y - 0.6);
        if (y > yAt(u) - 0.5) continue;
        const s = Math.random() < 0.5 ? -1 : 1;
        const g = new THREE.BoxGeometry(0.035, 0.9 + Math.random() * 0.8, 0.035);
        g.rotateZ(0.7);
        g.translate(x, y, z + s * (half + 0.02));
        K.add(M.matte, g, INK);
      }
    }, 'all');
  }

  // growing: each piece in its turn, with a boing; the colour sweep at the end (game/materialize.js
  // does the same for whatever is drawn in the air)
  update(dt) {
    this.t += dt;
    const t = this.t;
    for (const p of this.pieces) {
      if (p.done) continue;
      const k = (t - p.delay) / 0.32;
      if (k <= 0) continue;
      p.holder.visible = true;
      if (p.grow === 'none') {
        p.done = true;
        continue;
      }
      const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3) * Math.cos(k * 4.2);
      const v = Math.max(0.001, e);
      if (p.grow === 'y') p.holder.scale.set(1, v, 1);
      else if (p.grow === 'x') p.holder.scale.set(v, 1, 1);
      else p.holder.scale.setScalar(v);
      if (k >= 1) {
        p.holder.scale.set(1, 1, 1);
        p.done = true;
        if (this.game.audio && Math.random() < 0.5) this.game.audio.play(p.grow === 'y' ? 'clank' : 'poof', 0.25);
      }
    }
    // white as the paper until the end, then the colours sweep from the car to the lip
    if (!this.swept) {
      this.paper(t < 2.1 ? 0 : clamp((t - 2.1) / 0.8, 0, 1));
      if (t >= 2.95) {
        this.swept = true;
        this.unpaper();
        this.solid = true;
        this.grown = true;
      }
    }
  }

  paper(k) {
    const P = this.P;
    if (!this.U) {
      // the sweep runs along -x (from the car's end to the lip)
      this.U = {
        uMatOn: { value: 1 },
        uMatFlat: { value: new THREE.Vector4(0, 1, 0, 0) },
        uMatK: { value: 1 },
        uMatSweep: { value: new THREE.Vector4(-1, 0.25, 0, 0) },
        uMatBand: { value: new THREE.Vector4(0.6, 1, 1.2, 0) },
      };
      this.swaps = [];
      this.copies = new Map();
      this.root.traverse((m) => {
        if (!m.isMesh || !m.material || !m.material.uniforms || !m.material.uniforms.uMatOn) return;
        let c = this.copies.get(m.material);
        if (!c) {
          c = surfaceVariant(m.material, this.U);
          this.copies.set(m.material, c);
        }
        this.swaps.push([m, m.material]);
        m.material = c;
      });
    }
    // along (-1, 0.25, 0): from the car's end (-startX) to beyond the lip
    const d0 = -P.startX + P.roofY * 0.25 - 1;
    const d1 = -P.lipX + (P.roofY + P.h) * 0.25 + 1;
    this.U.uMatSweep.value.w = d0 + (d1 - d0) * k;
  }

  unpaper() {
    if (!this.swaps) return;
    for (const [m, mat] of this.swaps) m.material = mat;
    for (const c of this.copies.values()) c.dispose();
    this.swaps = null;
  }

  dispose() {
    this.unpaper();
    this.game.scene.remove(this.root);
    this.root.traverse((m) => {
      if (m.isMesh) m.geometry.dispose();
    });
  }
}

function strut(K, mat, a, b, r, color) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  K.add(mat, g, color);
}

// ------------------------------------------------------------------ the jump
// Off the lip, the car is flown on the line that brings it down on the other roof, whatever speed it
// came up with: the right speed out over the street, the arc, the nose dipping with it; the prologue
// slows the time at the top of the arc (its dt here is the slowed one). Down on the roof it is the
// car's own again, landing hard on its springs.
export class Jump {
  constructor(game, car, P, land) {
    this.game = game;
    this.car = car;
    this.t = 0;
    const lipY = P.roofY + 0.3 + P.h;
    const p = car.pos;
    // (as fast as it came - but within what makes a jump to remember, and lands it)
    const sp = clamp(Math.abs(car.speed || 0), 19, 23);
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    // where it lands: on the far roof, along the way it is going (kept on the clear aisle)
    const D0 = Math.max(10, (p.x - land.x) / Math.max(0.3, -fx));
    const lz = clamp(p.z + fz * D0, land.z0, land.z1);
    const dx = land.x - p.x;
    const dz = lz - p.z;
    const D = Math.hypot(dx, dz);
    this.T = D / sp;
    this.vh = sp;
    this.dir = [dx / D, dz / D];
    this.y0 = Math.max(p.y, lipY);
    this.x0 = p.x;
    this.z0 = p.z;
    this.vy = (land.y - this.y0 + 10 * this.T * this.T) / this.T;
    this.apexT = this.vy / 20;
    this.landY = land.y;
    this.yaw0 = car.yaw;
    this.yaw1 = Math.atan2(dx, dz);
    this.done = false;
    car.air = true;
    car.script = (dt) => this.step(dt);
  }

  get apex() {
    return this.t >= this.apexT;
  }

  step(dt) {
    const v = this.car;
    this.t += dt;
    const t = Math.min(this.t, this.T);
    v.pos.x = this.x0 + this.dir[0] * this.vh * t;
    v.pos.z = this.z0 + this.dir[1] * this.vh * t;
    v.pos.y = this.y0 + this.vy * t - 10 * t * t;
    const vyNow = this.vy - 20 * t;
    // (its nose with the arc, turned onto its line)
    v.bodyPitch = clamp(Math.atan2(vyNow, this.vh) * 0.55, -0.35, 0.3);
    v.yaw = this.yaw0 + (this.yaw1 - this.yaw0) * Math.min(1, t / 0.4);
    v.vx = this.dir[0] * this.vh;
    v.vz = this.dir[1] * this.vh;
    v.speed = this.vh;
    v.speedAbs = this.vh;
    if (this.t >= this.T) {
      // down: its own again, falling the last few centimetres onto its springs
      v.script = null;
      v.pos.y = this.landY + 0.08;
      v.vy = vyNow;
      v.air = true;
      this.done = true;
    }
  }
}
