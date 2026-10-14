import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 11.6, the test of "the workshop") A vehicle drawn from the side (ui/workshop.js), its
// shape what it does. Each line drawn is read as a part of it:
//   - a big closed shape: the body (as long, as high as it was drawn; as wide as it is long)
//   - a small round one low down: a wheel (a pair of them, one each side)
//   - a long flat line at its middle: a wing (it glides; with a propeller or a jet, it flies)
//   - a flat line over its top: a rotor (it is a helicopter)
//   - a line up its nose: a propeller; a small shape at its back: a jet (Shift: faster)
//   - anything else: a line drawn on it (windows, a door, flames: drawn on its sides)
// (a part read wrong is put right on the sheet: a tap on it, and it is the next kind of part).
// What it is follows from its parts: a rotor - a helicopter (game/vehicles.js updateCopter); wings
// and a propeller or a jet - a plane (game/rides.js updatePlane); wheels - it drives (drive, with
// a handling of its own: big wheels hold the road, a long one turns slowly, a heavy one is slow
// off the mark, jets give it a boost, wings let it glide off a ramp). It rides as one of the kinds
// the city has, with a model built from the drawing.

export const PARTS = ['body', 'wheel', 'wing', 'rotor', 'prop', 'jet', 'line'];
export const PART_NAME = { body: 'גוף', wheel: 'גלגל', wing: 'כנף', rotor: 'רוטור', prop: 'מדחף', jet: 'סילון', line: 'קישוט' };
export const PART_CSS = { body: '#1b1430', wheel: '#2e2a3a', wing: '#2f7fd1', rotor: '#6b4bd6', prop: '#d1702f', jet: '#e2335f', line: '#5a4a78' };
export const KIND_NAME = { car: 'מכונית', glider: 'מכונית עם כנפיים', jetcar: 'מכונית סילון', copter: 'מסוק', plane: 'מטוס', still: 'פסל' };
export const COLORS = [
  { css: '#e8333d', c: [0.92, 0.2, 0.24], name: 'אדום' },
  { css: '#ff8a2a', c: [1.0, 0.55, 0.16], name: 'כתום' },
  { css: '#ffd23f', c: [1.0, 0.84, 0.22], name: 'צהוב' },
  { css: '#4ee06a', c: [0.3, 0.86, 0.42], name: 'ירוק' },
  { css: '#33b5ff', c: [0.22, 0.68, 1.0], name: 'כחול' },
  { css: '#7c5cff', c: [0.5, 0.38, 1.0], name: 'סגול' },
  { css: '#ff7cc8', c: [1.0, 0.48, 0.78], name: 'ורוד' },
  { css: '#f4efe4', c: [0.95, 0.93, 0.88], name: 'לבן' },
  { css: '#3a3f4a', c: [0.24, 0.26, 0.3], name: 'שחור' },
];

// ------------------------------------------------------------------ reading the lines
// a stroke's shape: [z, y] points in metres (z forward, y up from the ground)
export function shapeOf(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let len = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    cx += x;
    cy += y;
    if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
  }
  cx /= pts.length;
  cy /= pts.length;
  const w = x1 - x0;
  const h = y1 - y0;
  const size = Math.max(w, h);
  const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  const closed = pts.length > 5 && gap < Math.max(0.3, size * 0.3) && len > size * 2.2;
  // how round: the spread of the distances from its middle
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  let rs = 0;
  let rs2 = 0;
  for (const [x, y] of pts) {
    const d = Math.hypot(x - mx, y - my);
    rs += d;
    rs2 += d * d;
  }
  const r = rs / pts.length;
  const sd = Math.sqrt(Math.max(0, rs2 / pts.length - r * r));
  let area = 0;
  if (closed) for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return { x0, x1, y0, y1, w, h, size, cx, cy, mx, my, r, round: closed && sd < r * 0.22 && w > h * 0.6 && h > w * 0.6, closed, area: Math.abs(area) / 2, len };
}

// what each stroke is (by itself and by where it is on the body); `fixed` ones keep their type
export function readParts(strokes) {
  const S = strokes.map((s) => ({ s, sh: shapeOf(s.pts) }));
  // the body: the biggest closed shape that is no wheel (and any as big as half of it)
  let main = null;
  for (const o of S) {
    if (o.s.fixed) continue;
    if (o.sh.closed && !(o.sh.round && o.sh.size < 1.4) && o.sh.area > 0.35 && (!main || o.sh.area > main.sh.area)) main = o;
  }
  for (const o of S) if (o.s.fixed && o.s.type === 'body' && (!main || o.sh.area > main.sh.area)) main = o;
  const B = main ? main.sh : null;
  for (const o of S) {
    const { s, sh } = o;
    if (s.fixed) continue;
    s.type = guess(sh, B, o === main);
  }
  return strokes;
}

function guess(sh, B, isMain) {
  if (isMain) return 'body';
  if (!B) return sh.closed && sh.area > 0.35 ? 'body' : sh.round ? 'wheel' : 'line';
  const L = B.w;
  // a wheel: round, its bottom low (on the ground, or under the body's middle)
  if (sh.round && sh.size < 2.4 && sh.y0 < B.y0 + B.h * 0.45) return 'wheel';
  // over the top: a rotor (flat), or a round thing up there too
  if (sh.cy > B.y1 - 0.05 && sh.w > sh.h * 1.8) return 'rotor';
  // a flat line at its side: a wing
  if (sh.w > sh.h * 2.5 && sh.w > L * 0.2 && sh.cy > B.y0 + B.h * 0.15 && sh.cy < B.y1 + 0.1) return 'wing';
  // up its nose: a propeller
  if (sh.h > sh.w * 1.8 && sh.cx > B.x1 - Math.max(0.35, L * 0.12)) return 'prop';
  // at its back, small: a jet
  if (sh.size < Math.max(1.1, L * 0.3) && sh.cx < B.x0 + Math.max(0.5, L * 0.2) && sh.cy > B.y0 - 0.2) return 'jet';
  if (sh.closed && sh.area > Math.max(0.35, B.area * 0.5)) return 'body';
  return 'line';
}

// ------------------------------------------------------------------ what it is
// design: { strokes: [{ pts, type }], color }. -> { ok, why, kind, base, label, stats, ... }
export function specOf(design) {
  const P = design.strokes;
  const bodies = P.filter((s) => s.type === 'body');
  if (!bodies.length) return { ok: false, why: 'חסר גוף: ציירו צורה סגורה גדולה' };
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let area = 0;
  for (const s of bodies) {
    const sh = shapeOf(s.pts);
    x0 = Math.min(x0, sh.x0);
    x1 = Math.max(x1, sh.x1);
    y0 = Math.min(y0, sh.y0);
    y1 = Math.max(y1, sh.y1);
    area += sh.area || sh.w * sh.h * 0.7;
  }
  const L = x1 - x0;
  const H = y1 - y0;
  if (L < 0.8) return { ok: false, why: 'הגוף קטן מדי (לפחות מטר)' };
  const wheels = P.filter((s) => s.type === 'wheel').map((s) => {
    const sh = shapeOf(s.pts);
    return { z: sh.mx, y: sh.my, r: clamp((sh.w + sh.h) / 4, 0.15, 1.3) };
  });
  const wings = P.filter((s) => s.type === 'wing').map((s) => shapeOf(s.pts));
  const rotors = P.filter((s) => s.type === 'rotor').map((s) => shapeOf(s.pts));
  const props = P.filter((s) => s.type === 'prop').map((s) => shapeOf(s.pts));
  const jets = P.filter((s) => s.type === 'jet').map((s) => shapeOf(s.pts));
  const chord = wings.reduce((a, w) => a + w.w, 0);
  const W = clamp(0.55 + L * 0.24, 0.9, 2.3);
  // its weight (a car's about 1: game/vehicles.js HANDLING)
  const mass = clamp((area * W) / 4.2 + wheels.length * 0.04 + jets.length * 0.08, 0.35, 3.2);
  let kind;
  if (rotors.length) kind = 'copter';
  else if (chord >= L * 0.3 && (props.length || jets.length)) kind = 'plane';
  else if (wheels.length) kind = jets.length ? 'jetcar' : chord > L * 0.2 ? 'glider' : 'car';
  else kind = 'still';
  const base = kind === 'copter' ? 'copter' : kind === 'plane' ? 'plane' : kind === 'still' ? null : 'car';
  const out = { ok: !!base, kind, base, label: KIND_NAME[kind], L, H, W, mass, area, wheels, wings, rotors, props, jets, chord, x0, x1, y0, y1 };
  if (!base) {
    out.why = 'בלי גלגלים, רוטור, או כנפיים עם מדחף - הוא לא יזוז';
    out.stats = { speed: 0, grip: 0, steady: 0, air: 0 };
    return out;
  }
  // the wheels: their size, how far apart; the ground under them
  const rAvg = wheels.length ? wheels.reduce((a, w) => a + w.r, 0) / wheels.length : 0;
  let base0 = 0;
  let base1 = 0;
  if (wheels.length) {
    base0 = Math.min(...wheels.map((w) => w.z));
    base1 = Math.max(...wheels.map((w) => w.z));
  }
  const wheelbase = base1 - base0;
  if (base === 'car') {
    const nW = wheels.length;
    const grip = clamp(4.5 + Math.min(4, nW) * 1.1 + rAvg * 2.2 - (wheelbase < L * 0.35 ? 1.2 : 0), 3.5, 11);
    const top = clamp(26 + jets.length * 5 - mass * 3 + (rAvg > 0.5 ? 2 : 0) - (nW === 1 ? 6 : 0), 12, 42);
    const power = clamp(15 + jets.length * 2.5 - mass * 2.2, 6, 22);
    const steer = clamp(1.9 - L * 0.1 - (wheelbase > 4 ? 0.2 : 0), 0.8, 2.1);
    out.handling = { mass: clamp(mass, 0.5, 3), power, top, grip, slide: clamp(0.8 + grip * 0.03, 0.85, 1.2), steer, roll: clamp(H * 0.45, 0.2, 1.4), pitch: 0.5 };
    out.glide = chord > 0 ? clamp(chord / L, 0.15, 0.75) : 0;
    out.stats = { speed: top / 42, grip: grip / 11, steady: clamp((nW >= 4 ? 0.8 : nW === 3 ? 0.65 : nW === 2 ? 0.45 : 0.2) + (wheelbase / L) * 0.25 - H * 0.05, 0, 1), air: out.glide };
  } else if (base === 'copter') {
    const R = clamp(Math.max(...rotors.map((r) => r.w)) / 2 * 1.4, 1.0, 4.5);
    out.rotorR = R;
    out.q = { speed: clamp(0.65 + R * 0.12 - mass * 0.08, 0.5, 1.35), accel: clamp(0.8 + R * 0.1, 0.7, 1.3) };
    out.stats = { speed: out.q.speed / 1.35, grip: 0.5, steady: clamp(0.4 + R * 0.12, 0, 1), air: 1 };
  } else {
    out.q = { speed: clamp(0.75 + jets.length * 0.18 + props.length * 0.05 - mass * 0.05, 0.6, 1.3), accel: clamp(1.15 + props.length * 0.1 + jets.length * 0.3, 1.0, 1.9) };
    out.stats = { speed: out.q.speed / 1.3, grip: 0.4, steady: clamp(chord / L, 0, 1), air: 1 };
  }
  out.hp = Math.round(clamp(90 + mass * 60 + (base === 'copter' ? 60 : 0), 80, 320));
  out.cost = Math.round(clamp(24 + P.length * 2 + jets.length * 4 + (base === 'copter' ? 14 : base === 'plane' ? 10 : 0), 24, 70));
  return out;
}

// ------------------------------------------------------------------ the model
// the closed outline, simplified; a crossed one: its hull
function outline(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop();
  return crossed(out) ? hull(out) : out;
}

function crossed(P) {
  const n = P.length;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const a = P[i];
    const b = P[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = P[j];
      const d = P[(j + 1) % n];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  }
  return false;
}

function hull(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

const shade = (c, k) => linC(Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k));

function inPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if (P[i][1] > y !== P[j][1] > y && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1] + 1e-9) + P[i][0]) inside = !inside;
  }
  return inside;
}

// a line with no point closer than d to the last
function thin(pts, d) {
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= d) out.push(p);
  }
  if (out.length === 1 && pts.length > 1) out.push(pts[pts.length - 1]);
  return out.slice(0, 40);
}

const _ta = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _UP = new THREE.Vector3(0, 1, 0);
// a round rod from a to b ([x, y, z])
function tube(K, mat, a, b, r, color) {
  _ta.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _ta.length();
  if (len < 0.01) return;
  const g = new THREE.CylinderGeometry(r, r, len + r, 7);
  _tq.setFromUnitVectors(_UP, _ta.normalize());
  g.applyQuaternion(_tq);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  K.add(mat, g, color);
}

function wheelModel(M, r, w, rim) {
  const K = new Kit();
  K.add(M.matte, new THREE.TorusGeometry(r * 0.78, r * 0.24, 8, 22).rotateY(Math.PI / 2), linC(0.1, 0.1, 0.13));
  K.add(M.metal, new THREE.CylinderGeometry(r * 0.55, r * 0.55, w, 16).rotateZ(Math.PI / 2), rim);
  K.add(M.matte, new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.25, 10).rotateZ(Math.PI / 2), linC(0.16, 0.16, 0.2));
  for (let k = 0; k < 3; k++) {
    const sp = new THREE.BoxGeometry(w * 1.1, r * 1.0, 0.05);
    sp.rotateX((k / 3) * Math.PI);
    K.add(M.matte, sp, linC(0.2, 0.2, 0.24));
  }
  const g = K.build();
  g.matrixAutoUpdate = true;
  return g;
}

// the vehicle's own frame (game/vehicles.js): x across (+x its left), y up, z forward, on the
// ground at y = 0. Returns what game/vehicles.js needs of a model.
export function buildModel(design, spec) {
  const M = itemMats();
  const col = linC(design.color[0], design.color[1], design.color[2]);
  const dark = shade(design.color, 0.45);
  const light = shade(design.color, 1.25);
  const ink = linC(0.07, 0.06, 0.1);
  const W = spec.W;
  const zc = (spec.x0 + spec.x1) / 2;
  // what touches the ground: the wheels' bottoms (else the body's)
  let floor = spec.y0;
  if (spec.wheels.length) floor = Math.min(...spec.wheels.map((w) => w.y - w.r));
  const Z = (z) => z - zc;
  const Y = (y) => y - floor;
  const K = new Kit();
  // the body: the outline drawn, as wide as it is long; its edges rounded off
  for (const s of design.strokes) {
    if (s.type !== 'body') continue;
    const o = outline(s.pts);
    if (o.length < 3) continue;
    const shape = new THREE.Shape(o.map(([z, y]) => new THREE.Vector2(Z(z), Y(y))));
    const bev = Math.min(0.08, W * 0.06);
    const g = new THREE.ExtrudeGeometry(shape, { depth: W - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
    // (shape x - forward - to z; its depth across, centred)
    g.rotateY(-Math.PI / 2);
    g.translate(W / 2 - bev, 0, 0);
    K.add(M.paint, g, col);
  }
  // the lines drawn on it, on both its sides (and the outline's own dark edge)
  const lineOn = (pts, w, c, out = 0.02) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dz = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dz, dy);
      if (len < 0.01) continue;
      for (const sx of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.03, w, len + w * 0.6);
        g.rotateX(-Math.atan2(dy, dz));
        g.translate(sx * (W / 2 + out), Y((a[1] + b[1]) / 2), Z((a[0] + b[0]) / 2));
        K.add(M.matte, g, c);
      }
    }
  };
  // (a line on the body is drawn on both its sides; one off it - a tail, an aerial, skids under
  // it - is a rod of its own: two under it, one anywhere else)
  const outl = design.strokes.filter((s) => s.type === 'body').map((s) => outline(s.pts));
  const onBody = (p) => outl.some((o) => inPoly(p[0], p[1], o));
  const rod = (pts, x, r, c) => {
    const P = thin(pts, 0.06);
    for (let i = 1; i < P.length; i++) {
      const a = [x, Y(P[i - 1][1]), Z(P[i - 1][0])];
      const b = [x, Y(P[i][1]), Z(P[i][0])];
      tube(K, M.matte, a, b, r, c);
    }
  };
  for (const s of design.strokes) {
    if (s.type !== 'line') continue;
    const inside = s.pts.filter(onBody).length / s.pts.length;
    if (inside >= 0.6) lineOn(s.pts, 0.06, ink);
    else if (Math.max(...s.pts.map((p) => p[1])) < spec.y0 + 0.15) for (const x of [-W * 0.35, W * 0.35]) rod(s.pts, x, 0.05, dark);
    else rod(s.pts, 0, 0.07, dark);
  }
  // wings: flat across, as deep as drawn; in the body's colour, the tips darker
  const parts = { wheels: [], jetsAt: [] };
  for (const s of design.strokes) {
    if (s.type !== 'wing') continue;
    const sh = shapeOf(s.pts);
    const span = clamp(sh.w * 2.4, 2.2, 9);
    K.box(M.paint, -span / 2, Y(sh.cy) - 0.05, Z(sh.x0), span / 2, Y(sh.cy) + 0.05, Z(sh.x1), light);
    K.box(M.matte, -span / 2 - 0.02, Y(sh.cy) - 0.06, Z(sh.x0), -span / 2 + 0.25, Y(sh.cy) + 0.06, Z(sh.x1), dark);
    K.box(M.matte, span / 2 - 0.25, Y(sh.cy) - 0.06, Z(sh.x0), span / 2 + 0.02, Y(sh.cy) + 0.06, Z(sh.x1), dark);
    parts.span = Math.max(parts.span || 0, span);
  }
  // jets: a tube out of its back, the glow at its end
  for (const s of design.strokes) {
    if (s.type !== 'jet') continue;
    const sh = shapeOf(s.pts);
    const r = clamp(sh.size / 2, 0.15, 0.6);
    const z1 = Z(Math.max(sh.x1, spec.x0 + 0.2));
    const z0 = Z(sh.x0) - 0.2;
    K.cyl(M.metal, r, r * 0.8, z0, z1, linC(0.55, 0.56, 0.62), { y: Y(sh.cy), segs: 12 });
    K.cyl(M.glow, r * 0.62, r * 0.62, z0 - 0.04, z0 + 0.02, linC(1.0, 0.55, 0.2), { y: Y(sh.cy), segs: 12 });
    parts.jetsAt.push([0, Y(sh.cy), z0 - 0.1]);
  }
  const body = K.build({ seed: 0.42 });
  body.matrixAutoUpdate = true;
  // the wheels: a pair each, turning
  for (const w of spec.wheels) {
    for (const sx of [-1, 1]) {
      const g = wheelModel(M, w.r, Math.min(0.42, w.r * 0.7), light);
      g.position.set(sx * (W / 2 + Math.min(0.42, w.r * 0.7) / 2 + 0.02), Y(w.y), Z(w.z));
      body.add(g);
      parts.wheels.push(g);
    }
  }
  // the rotor: over its top, on a mast
  let rotor = null;
  if (spec.rotors.length) {
    const r = spec.rotors[0];
    const R = spec.rotorR || 2;
    const y = Y(Math.max(r.cy, spec.y1 + 0.2));
    const Rk = new Kit();
    Rk.box(M.matte, -0.09, -0.04, -R, 0.09, 0.04, R, ink);
    Rk.box(M.matte, -R, -0.04, -0.09, R, 0.04, 0.09, ink);
    Rk.cyl(M.metal, 0.14, 0.14, -0.08, 0.1, linC(0.5, 0.5, 0.55), { axis: 'y', segs: 10 });
    rotor = Rk.build();
    rotor.matrixAutoUpdate = true;
    rotor.position.set(0, y, Z(r.cx));
    body.add(rotor);
    const mast = new Kit();
    mast.cyl(M.metal, 0.07, 0.07, Y(spec.y1) - 0.1, y, linC(0.4, 0.4, 0.45), { axis: 'y', segs: 8 });
    const mg = mast.build();
    mg.position.set(0, 0, Z(r.cx));
    mg.updateMatrix();
    body.add(mg);
  }
  // the propeller: on its nose, turning about the way it goes
  let prop = null;
  if (spec.props.length) {
    const p = spec.props[0];
    const R = clamp(p.h / 2, 0.35, 1.6);
    const Pk = new Kit();
    Pk.box(M.matte, -0.07, -R, -0.03, 0.07, R, 0.03, ink);
    Pk.cyl(M.metal, 0.12, 0.05, -0.05, 0.2, linC(0.6, 0.6, 0.65), { segs: 10 });
    prop = Pk.build();
    prop.matrixAutoUpdate = true;
    prop.position.set(0, Y(p.cy), Z(Math.max(p.x1, spec.x1)) + 0.08);
    body.add(prop);
  }
  // where the rider sits: on its top, about its middle (out of it from the chest up)
  const top = Y(spec.y1);
  const seatY = Math.max(Y(spec.y0) + 0.5, top - 0.55);
  const seatZ = clamp(-spec.L * 0.08, -1.2, 0);
  const halfWid = Math.max(W / 2 + 0.3, (parts.span || 0) / 2);
  return {
    body,
    wheels: parts.wheels,
    prop: prop || new THREE.Object3D(),
    rotor: rotor || new THREE.Object3D(),
    tailRotor: new THREE.Object3D(),
    jetsAt: parts.jetsAt,
    pose: 'pilot',
    seatAt: [0, seatY + 0.5, seatZ],
    bar: [0, seatY + 0.95, seatZ + 0.55],
    grip: 0.22,
    halfLen: Math.max(0.8, spec.L / 2),
    halfWid,
    heightM: Math.max(1.2, top + 0.6),
    radius: clamp(spec.L * 0.42, 0.9, 3.2),
    circles: [-spec.L * 0.3, 0, spec.L * 0.3],
    circleR: clamp(W / 2, 0.5, 1.1),
    span: parts.span || W,
  };
}

// ------------------------------------------------------------------ into the city
// a drawn vehicle at (x, z), facing yaw: one of the city's kinds, with the drawing's model and
// handling (null: it is no vehicle)
export function spawnDrawn(game, design, x, z, yaw) {
  const spec = specOf(design);
  if (!spec.ok) return null;
  const V = game.vehicles;
  const v = V.create(spec.base === 'car' ? 'bike' : spec.base, 'good', 90);
  // (its own model instead of the kind's)
  v.group.remove(v.body);
  v.body.traverse((m) => m.geometry && m.geometry.dispose());
  const m = buildModel(design, spec);
  Object.assign(v, m);
  v.group.add(v.body);
  v.model = 'drawn';
  v.drawn = { strokes: design.strokes.map((s) => ({ type: s.type, pts: s.pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]) })), color: design.color.slice() };
  v.spec = spec;
  v.seat = true;
  v.label = design.name || spec.label;
  v.maxHp = spec.hp;
  v.hp = spec.hp;
  v.leanK = 0.25;
  v.muzzleLocal = null;
  if (spec.base === 'car') {
    v.handling = spec.handling;
    v.glide = spec.glide;
    v.jets = spec.jets.length;
  } else {
    v.q = Object.assign({}, v.q, spec.q);
    v.jets = spec.jets.length;
  }
  v.flies = spec.base === 'copter' || spec.base === 'plane';
  v.camOpt = { dist: clamp(spec.L * 1.3 + 3.2, 5.5, 14), height: clamp(spec.H + 1.4, 2.3, 5), shoulder: 0, fovMul: 1 };
  v.pos.set(x, v.flies ? 0 : Math.max(0, groundHeight(x, z) * 0.5), z);
  v.yaw = yaw;
  if (spec.base === 'copter') v.alt = 1.05;
  v.reveal = 0;
  V.add(v);
  return v;
}

// the rider's view of it while it goes: the jets' flames when it boosts (game/workshop.js update)
export function jetFlames(game, v, dt) {
  if (!v.jetsAt || !v.jetsAt.length || !(v.boosting || (v.kind === 'plane' && (v.thr || 0) > 0.6))) return;
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  for (const j of v.jetsAt) {
    if (Math.random() > dt * 40) continue;
    const x = v.pos.x + fz * j[0] + fx * j[2];
    const z = v.pos.z - fx * j[0] + fz * j[2];
    game.fx.sparks(x, v.pos.y + j[1], z, 2, [1.0, 0.6, 0.2]);
  }
}
