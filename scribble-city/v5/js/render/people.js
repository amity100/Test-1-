import * as THREE from 'three';
import { makeSurface, srgb, shared, canvasTexture, lin3, mergedSurface, penRow, penPictures, LAYERS, sortDefines } from './materials.js';
import { MAX_HOLES, MAX_OWNERS } from './glsl.js';
import { motion, motionRows, bindMotion, rowsOf } from './motion.js';
import * as HERO from './heroshapes.js';

// The people of the city, drawn like everything else: a body of rounded parts under their clothes
// (the first boulevard's own people: a shaped torso, tapering limbs, a head with a jaw and ears,
// sneakers with white soles, long skirts), and whatever is on their heads or in their hands. Every
// kind of part is one batch for the whole crowd, so a hundred people cost what one does.
//
// The parts are placed from a rig's joints every frame (game/doodle.js), so every pose the game
// knows (walking, running, aiming, sitting, carrying, falling, crawling) carries over.

// ------------------------------------------------------------------ the shapes (the first boulevard's)
const cap = (r, len, segs = 10) => {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, segs);
  g.translate(0, -len / 2, 0); // hangs down from its joint
  return g;
};

// a body part that tapers (thighs, forearms): a lathe from the joint downwards, rounded at both
// ends like a capsule, so two of them meet smoothly at the joint
// (bulge: how much fuller it is a third of the way down - a calf, a forearm's muscle)
function limb(r0, r1, len, segs = 10, bulge = 0) {
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (1 - i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r0), Math.sin(a) * r0));
  }
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * Math.min(1, t * 1.4)), -t * len));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r1), -len - Math.sin(a) * r1));
  }
  return new THREE.LatheGeometry(pts, segs);
}

// the far-off walkers' torso and limbs (PersonRenderer.drawCheap): the same outline in fewer points
function lowTorsoGeo(waist, chest, shoulders, len, hem, boxy = false) {
  const pts = boxy
    ? [
        new THREE.Vector2(0.0001, -hem - 0.01),
        new THREE.Vector2(chest * 1.02, -hem),
        new THREE.Vector2(chest * 1.03, len * 0.72),
        new THREE.Vector2(shoulders, len * 0.86),
        new THREE.Vector2(shoulders * 0.42, len * 1.0),
        new THREE.Vector2(0.0001, len * 1.01),
      ]
    : [
        new THREE.Vector2(0.0001, -hem - 0.01),
        new THREE.Vector2(waist * 1.04, -hem),
        new THREE.Vector2(chest * 0.98, len * 0.6),
        new THREE.Vector2(shoulders, len * 0.86),
        new THREE.Vector2(shoulders * 0.4, len * 1.0),
        new THREE.Vector2(0.0001, len * 1.01),
      ];
  const g = new THREE.LatheGeometry(pts, 8);
  g.scale(1, 1, 0.66);
  return g;
}

function lowLimb(r0, r1, len) {
  const pts = [new THREE.Vector2(0.0001, r0), new THREE.Vector2(r0, 0), new THREE.Vector2(r1, -len), new THREE.Vector2(0.0001, -len - r1)];
  return new THREE.LatheGeometry(pts, 6);
}

// (v5) a short sleeve in as few points as a far limb (and the same layout of triangles)
function lowSleeveGeo(r0, r1, len) {
  const pts = [new THREE.Vector2(0.0001, r0), new THREE.Vector2(r0, 0), new THREE.Vector2(r1, -len), new THREE.Vector2(r1 * 0.82, -len)];
  return new THREE.LatheGeometry(pts, 6);
}

function torsoGeo(waist, chest, shoulders, len, hem = 0, boxy = false) {
  const pts = boxy
    ? [
        new THREE.Vector2(0.0001, -hem - 0.01),
        new THREE.Vector2(chest * 1.02, -hem),
        new THREE.Vector2(chest * 1.04, -hem + 0.03),
        new THREE.Vector2(chest * 1.02, len * 0.4),
        new THREE.Vector2(chest * 1.03, len * 0.72),
        new THREE.Vector2(shoulders, len * 0.86),
        new THREE.Vector2(shoulders * 0.8, len * 0.95),
        new THREE.Vector2(shoulders * 0.42, len * 1.0),
        new THREE.Vector2(0.0001, len * 1.01),
      ]
    : [
        new THREE.Vector2(0.0001, -hem - 0.01),
        new THREE.Vector2(waist * 1.04, -hem),
        new THREE.Vector2(waist, len * 0.2),
        new THREE.Vector2(chest * 0.96, len * 0.55),
        new THREE.Vector2(chest, len * 0.72),
        new THREE.Vector2(shoulders, len * 0.86),
        new THREE.Vector2(shoulders * 0.78, len * 0.95),
        new THREE.Vector2(shoulders * 0.4, len * 1.0),
        new THREE.Vector2(0.0001, len * 1.01),
      ];
  const g = new THREE.LatheGeometry(pts, 18);
  g.scale(1, 1, 0.66); // flatter front to back
  return g;
}

function skirtGeo(top, bottom, len, gap = 0, segs = 16) {
  const pts = [new THREE.Vector2(top, 0.02), new THREE.Vector2(top * 1.05, -len * 0.15), new THREE.Vector2(bottom * 0.92, -len * 0.75), new THREE.Vector2(bottom, -len)];
  // (gap: an opening at the front, like a coat's)
  const g = new THREE.LatheGeometry(pts, segs, gap / 2, Math.PI * 2 - gap);
  g.scale(1, 1, 0.8);
  return g;
}

// a short sleeve: a tube from the shoulder, open at its hem (it flares a little there)
function sleeveGeo(r0, r1, len, segs = 12) {
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (1 - i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r0), Math.sin(a) * r0));
  }
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + (t > 0.85 ? (t - 0.85) * 0.06 : 0), -t * len));
  }
  // (the hem turns inwards a little, so the tube has a lip and no hole to see through)
  pts.push(new THREE.Vector2(r1 * 0.82, -len));
  const g = new THREE.LatheGeometry(pts, segs);
  return g;
}

// clothes, painted flat before they are wrapped round the body: folds, seams, pockets (on white:
// the colour of each garment is its own)
function folds(kind) {
  const w = 256;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  const fold = (x0, y0, x1, y1, a, wid) => {
    g.strokeStyle = `rgba(60, 60, 110, ${a})`;
    g.lineWidth = wid;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + (Math.random() - 0.5) * 30, (y0 + y1) / 2, x1, y1);
    g.stroke();
  };
  if (kind === 'tee' || kind === 'shirt') {
    for (let k = 0; k < 9; k++) {
      const x = Math.random() * w;
      fold(x, h * 0.95, x + (Math.random() - 0.5) * 60, h * (0.35 + Math.random() * 0.3), 0.12 + Math.random() * 0.12, 6 + Math.random() * 10);
    }
    for (let k = 0; k < 4; k++) fold(Math.random() * w, h * 0.12, Math.random() * w, h * 0.2, 0.15, 5);
    g.fillStyle = 'rgba(60, 60, 110, 0.25)';
    g.fillRect(0, 0, w, 7);
    if (kind === 'shirt') {
      g.fillStyle = 'rgba(40, 40, 70, 0.6)';
      for (let y = 30; y < h - 20; y += 34) {
        g.fillRect(2, y, 5, 5);
        g.fillRect(w - 7, y, 5, 5);
      }
      g.fillRect(0, 0, 2, h);
      g.fillRect(w - 2, 0, 2, h);
    }
  } else if (kind === 'cargo') {
    for (let k = 0; k < 7; k++) {
      const x = Math.random() * w;
      fold(x, 0, x + (Math.random() - 0.5) * 30, h, 0.18, 5 + Math.random() * 6);
    }
    g.strokeStyle = 'rgba(30, 30, 40, 0.55)';
    g.lineWidth = 3;
    for (const x of [w * 0.25, w * 0.75]) {
      g.strokeRect(x - 26, h * 0.45, 52, 46);
      g.beginPath();
      g.moveTo(x - 28, h * 0.45 + 12);
      g.lineTo(x + 28, h * 0.45 + 12);
      g.stroke();
    }
  } else if (kind === 'skirt') {
    for (let k = 0; k < 14; k++) {
      const x = (k / 14) * w + Math.random() * 8;
      fold(x, 0, x + (Math.random() - 0.5) * 20, h, 0.14 + Math.random() * 0.1, 4 + Math.random() * 8);
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let k = 0; k < 40; k++) {
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    for (let k = 0; k < 6; k++) {
      const x = Math.random() * w;
      fold(x, 0, x + (Math.random() - 0.5) * 30, h, 0.12, 4 + Math.random() * 6);
    }
  }
  return canvasTexture(c, { repeat: true });
}

// ------------------------------------------------------------------ batches of parts
const _m = new THREE.Matrix4();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
// (for the far-off walkers, drawCheap)
const _cF = new THREE.Vector3();
const _cR = new THREE.Vector3();
const _cJ = { hip: new THREE.Vector3(), neck: new THREE.Vector3(), head: new THREE.Vector3() };
const _cClip = [0, 0, 0, 0];
const _cClip2 = [0, 0, 0, 0];

// ------------------------------------------------------------------ the shapes, in one texture
// Every kind of part is a row of one texture (two texels a point: position and u, normal and v),
// and the whole crowd is drawn in a few draws: an instance says which shape it is, how many points
// it has, which pen draws it, and what it is left out of. Shapes go to the class of their size (a
// shape with fewer points than its class leaves the rest of them empty) and of their side (a
// coat's skirts are seen from inside too).
const CLASS_SIZES = [60, 192, 300, 504, 1020, 1404];
// (v5) Shapes with the same layout of triangles (every limb, every ball, every head of hair...)
// are drawn by their corners instead: each corner of a part is worked out once, not once for
// every triangle it is in (a sixth of the work for the graphics card, the same picture). A
// layout is drawn on its own when that saves enough corners an instance; the small shapes stay
// in their class.
const OWN_LAYOUT = 100;
// (the shapes drawn too rarely for a draw of their own: they stay in their class, unless they
// are alone in it)
const IN_CLASS = new Set(['eye', 'lowPelvis', 'skirt', 'midi', 'coatSkirt', 'lowSkirt', 'lowMidi', 'lowCoatSkirt']);
// left out of: the wet street's mirror (1), the sun's view (2)
const NO_MIRROR = 1;
const NO_SUN = 2;
// (v5) Three kinds of shape. A person near the camera is drawn in the picture in full ('full', the
// picture only) and, for the sun's view and the wet street's mirror, in the simple shapes of the
// far-off walkers ('low' ones on a layer of their own, LAYERS.AUX): the sun's view is a texel of
// 12 cm and the mirror a third of the pixels, smeared, where the two cannot be told apart. Farther
// than lodFar a person is drawn in the simple shapes everywhere, smaller than the detail they
// leave out. The little things anybody may hold or be ('shared': a ball, a tube, a box) are drawn
// once, everywhere.
const SHARED = new Set(['ball', 'tube', 'boxP']);

// (the smart drawing, render/motion.js) where each part of a person was a frame ago: known by the
// person and the order the parts are put down in, the same every frame (a part that was not there
// the last time is where it is now)
const PARTS = 128;
const _seq = new Int32Array(MAX_OWNERS + 2);
const _was = new Map();
function partWas(out, i, m, owner, shape) {
  const o = i * 12;
  let s = null;
  let k = -1;
  if (owner > 0 && owner < _seq.length) {
    k = _seq[owner]++;
    if (k < PARTS) {
      s = _was.get(owner);
      if (!s) {
        s = { m: new Float32Array(PARTS * 12), shape: new Int32Array(PARTS).fill(-1), gen: new Int32Array(PARTS).fill(-9) };
        _was.set(owner, s);
      }
    }
  }
  if (s && s.shape[k] === shape && s.gen[k] >= motion.gen - 1) out.set(s.m.subarray(k * 12, k * 12 + 12), o);
  else rowsOf(m.elements, out, o);
  if (s) {
    rowsOf(m.elements, s.m, k * 12);
    s.shape[k] = shape;
    s.gen[k] = motion.gen;
  }
}

class DrawClass {
  // index: the shared layout of triangles of the shapes drawn by their corners (or none); aux: the
  // sun's view's and the mirror's own (no smart drawing's motion)
  constructor(scene, verts, mat, cap, index = null, aux = false) {
    this.cap = cap;
    this.verts = verts;
    this.aux = aux;
    const g = new THREE.BufferGeometry();
    // (the points come from the shapes' texture: these only say how many)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    if (index) g.setIndex(new THREE.BufferAttribute(verts > 65535 ? Uint32Array.from(index) : Uint16Array.from(index), 1));
    this.iX = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iClip = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iS = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', this.iClip);
    g.setAttribute('iS', this.iS);
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.userData.dynamic = true;
    // (v5: the people are drawn before the city: the street and the walls behind them are then
    // left out where they are covered, instead of drawn and drawn over. The same picture)
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
    this.n = 0;
    // (the smart drawing: where each part was a frame ago)
    mat.defines.USE_PREV = '';
    sortDefines(mat);
    this.prev = aux ? null : new Float32Array(cap * 12);
    this.motionBase = 0;
    this.motionGen = -1;
    if (!aux) bindMotion(this.mesh, this);
  }

  push(sh, m, color, owner, part, indoor, clip) {
    if (this.n >= this.cap) return -1;
    // (v5, ROADMAP 11.29) A part framed by a body's right, up and forward is framed in a mirror: that
    // frame is left-handed (forward = up x right), and every such part was drawn inside out - the
    // side towards the camera left out, the far side seen from within, a body you saw through, lit
    // from behind. Every kind of part is the same mirrored left to right, so the frame's right is
    // turned round: the very same shape, its triangles facing out.
    const e = m.elements;
    if (e[0] * (e[5] * e[10] - e[6] * e[9]) - e[4] * (e[1] * e[10] - e[2] * e[9]) + e[8] * (e[1] * e[6] - e[2] * e[5]) < 0) {
      e[0] = -e[0];
      e[1] = -e[1];
      e[2] = -e[2];
    }
    const i = this.n++;
    m.toArray(this.mesh.instanceMatrix.array, i * 16);
    if (motion.on && !this.aux) partWas(this.prev, i, m, owner, sh.row);
    const c = this.mesh.instanceColor.array;
    c[i * 3] = color[0];
    c[i * 3 + 1] = color[1];
    c[i * 3 + 2] = color[2];
    const x = this.iX.array;
    x[i * 4] = owner;
    x[i * 4 + 1] = part;
    x[i * 4 + 2] = indoor;
    x[i * 4 + 3] = 0;
    const k = this.iClip.array;
    if (clip) {
      k[i * 4] = clip[0];
      k[i * 4 + 1] = clip[1];
      k[i * 4 + 2] = clip[2];
      k[i * 4 + 3] = clip[3];
    } else k[i * 4] = k[i * 4 + 1] = k[i * 4 + 2] = k[i * 4 + 3] = 0;
    const S = this.iS.array;
    S[i * 4] = sh.row;
    S[i * 4 + 1] = sh.count;
    S[i * 4 + 2] = sh.pen;
    S[i * 4 + 3] = sh.flags;
    return i;
  }

  end() {
    this.mesh.count = this.n;
    // (nothing of this class on the screen: no draw call at all)
    this.mesh.visible = this.n > 0;
    const n = Math.max(1, this.n);
    for (const at of [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX, this.iClip, this.iS]) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, n * at.itemSize);
      at.needsUpdate = true;
    }
    if (motion.on && this.n && !this.aux) {
      this.motionBase = motionRows(this.prev, this.n);
      this.motionGen = motion.gen;
    }
    this.n = 0;
  }
}

// one kind of part: its row in the shapes' texture, its pen, its class
class Shape {
  constructor(geo, pen, cap) {
    // (its corners and their triangles, kept for drawing it by its corners)
    this.igeo = geo.index ? geo : null;
    const g = geo.index ? geo.toNonIndexed() : geo;
    this.geo = g;
    this.count = g.attributes.position.count;
    this.penMat = pen;
    this.pen = 0;
    this.cap = cap;
    this.row = 0;
    this.flags = 0;
    this.cls = null;
    // (v5) 'full', 'low' or 'shared' (SHARED); a low shape's draws for the sun's view and the mirror
    this.lod = 'full';
    this.auxCls = null;
  }

  push(m, color, owner, part, indoor = 0, clip = null) {
    return this.cls.push(this, m, color, owner, part, indoor, clip);
  }

  // (aux: into the sun's view's and the mirror's own draws)
  put(aux, m, color, owner, part, indoor = 0, clip = null) {
    return (aux ? this.auxCls : this.cls).push(this, m, color, owner, part, indoor, clip);
  }
}

// drawCheap's joints: x across, y up, z ahead of the walker _aw (scale _aS) in its frame (_cR, _cF)
let _aw = null;
// (v5: numbers kept in arrays, not in variables of the module: a number put in one of those is a
// new object every time, garbage for the phone to clear)
const _aS = new Float64Array([1]);
function atW(out, x, y, z) {
  const S = _aS[0];
  return out.set(_aw.x + (_cR.x * x + _cF.x * z) * S, _aw.y + y * S, _aw.z + (_cR.z * x + _cF.z * z) * S);
}

// a matrix that takes a part hanging down its local -y from a joint at a to b, as thick as k
function along(a, b, len0, k, side, out = _m) {
  _y.subVectors(a, b);
  let L = _y.length();
  if (L < 1e-5) {
    _y.set(0, 1, 0);
    L = len0;
  } else _y.divideScalar(L);
  _x.copy(side);
  _x.addScaledVector(_y, -_x.dot(_y));
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _x.normalize();
  _z.crossVectors(_x, _y);
  const sy = L / len0;
  out.set(_x.x * k, _y.x * sy, _z.x * k, a.x, _x.y * k, _y.y * sy, _z.y * k, a.y, _x.z * k, _y.z * sy, _z.z * k, a.z, 0, 0, 0, 1);
  return out;
}

// a part at c in the frame (r, u, f) (unit axes), scaled (sx, sy, sz)
function framed(c, r, u, f, sx, sy, sz, out = _m) {
  out.set(r.x * sx, u.x * sy, f.x * sz, c.x, r.y * sx, u.y * sy, f.y * sz, c.y, r.z * sx, u.z * sy, f.z * sz, c.z, 0, 0, 0, 1);
  return out;
}

const SOLE = [0.95, 0.95, 0.93];
const TEE = [0.93, 0.93, 0.91];
const IRIS = [0.16, 0.11, 0.08];
const SHADES = [0.05, 0.05, 0.07];
const _mH = new THREE.Matrix4();
const _hcH = new THREE.Vector3();
const EYE_WHITE = [0.96, 0.95, 0.92];
const PUPIL = [0.06, 0.05, 0.08];
const MASK_EYE = [0.95, 0.92, 0.85];
const BROW_BALD = [0.2, 0.16, 0.14];
const LIPS_F = [0.72, 0.3, 0.34];
const LIPS_M = [0.45, 0.22, 0.22];

// (the parts each arm and leg belongs to, and the running part id of the person being drawn)
const ARM_PART = ['armR', 'armL'];
const LEG_PART = ['legR', 'legL'];
const _part = new Float64Array(1);
const nextPart = () => (_part[0] = (_part[0] + 0.1173) % 1);

// the tops that are worn open over another layer
const OPEN = new Set(['suit', 'blazer', 'jacket', 'denim', 'bomber', 'cardigan', 'overshirt', 'trench', 'coat']);

const L3 = (c) => lin3(c[0], c[1], c[2]);
const lc = new Map();
function linC(c) {
  // (colours of looks are sRGB arrays: the linear colour is kept on the array itself, out of
  // sight of copies and saves; one made on the fly is looked up by value, to a thousandth)
  let v = c._lin;
  if (v) return v;
  const key = Math.round(c[0] * 1000) * 1e8 + Math.round(c[1] * 1000) * 1e4 + Math.round(c[2] * 1000);
  v = lc.get(key);
  if (!v) {
    v = L3(c);
    lc.set(key, v);
  }
  Object.defineProperty(c, '_lin', { value: v, writable: true });
  return v;
}

export class PersonRenderer {
  constructor(scene) {
    this.scene = scene;
    // (line 0.97 marks a person for the ink: their outlines, but no seams at the joints)
    const S = (o) => makeSurface({ line: 0.97, ...o });
    // the pens of the people (the first boulevard's): skin, cloth with folds, plain cloth, shoes
    this.mats = {
      skin: S({ kind: 'skin', partR: 0.06 }),
      tee: S({ kind: 'cyl', map: folds('tee'), partR: 0.16 }),
      shirt: S({ kind: 'cyl', map: folds('shirt'), partR: 0.16 }),
      cargo: S({ kind: 'cyl', map: folds('cargo'), partR: 0.09 }),
      skirt: S({ kind: 'cyl', map: folds('skirt'), partR: 0.25 }),
      plain: S({ kind: 'cyl', map: folds('plain'), partR: 0.09 }),
      coat: S({ kind: 'cyl', map: folds('skirt'), partR: 0.2, side: THREE.DoubleSide }),
      hair: S({ kind: 'cyl', partR: 0.1 }),
      box: S({ kind: 'box' }),
      gloss: S({ kind: 'paint', partR: 0.05, gloss: 0.8 }),
      dark: S({ kind: 'box' }),
    };
    for (const m of Object.values(this.mats)) m.vertexColors = false;
    const P = (geo, mat, n = 512) => new Shape(geo, mat, n);
    const M = this.mats;
    // canonical parts (a person of 1.78 m: k = 1)
    this.p = {
      torsoFit: P(torsoGeo(0.15, 0.19, 0.205, 0.54, 0.04, false), M.shirt),
      torsoTee: P(torsoGeo(0.15, 0.19, 0.205, 0.54, 0.14, true), M.tee),
      torsoPlain: P(torsoGeo(0.15, 0.19, 0.205, 0.54, 0.04, false), M.plain),
      torsoBoxy: P(torsoGeo(0.15, 0.19, 0.205, 0.54, 0.1, true), M.plain),
      pelvis: P(new THREE.SphereGeometry(0.17, 12, 8).scale(1.05, 0.72, 0.78), M.plain),
      pelvisSkirt: P(new THREE.SphereGeometry(0.17, 12, 8).scale(1.05, 0.72, 0.78), M.skirt),
      upperSkin: P(limb(0.056, 0.045, 0.29), M.skin),
      upperShirt: P(limb(0.056, 0.045, 0.29), M.shirt),
      foreSkin: P(limb(0.045, 0.031, 0.26, 10, 0.006), M.skin),
      foreShirt: P(limb(0.045, 0.034, 0.26), M.shirt),
      sleeveTee: P(sleeveGeo(0.08, 0.07, 0.15), M.tee),
      ballTee: P(new THREE.SphereGeometry(0.07, 12, 8), M.tee),
      hand: P(new THREE.SphereGeometry(0.05, 10, 8).scale(0.75, 1.3, 0.6), M.skin),
      thigh: P(limb(0.082, 0.064, 0.45), M.plain),
      thighCargo: P(limb(0.1, 0.082, 0.45), M.cargo),
      thighSkin: P(limb(0.082, 0.064, 0.45), M.skin),
      shin: P(limb(0.062, 0.046, 0.43, 10, 0.008), M.plain),
      shinCargo: P(limb(0.082, 0.078, 0.43), M.cargo),
      shinSkin: P(limb(0.06, 0.042, 0.43, 10, 0.012), M.skin),
      pocket: P(new THREE.BoxGeometry(0.06, 0.12, 0.1), M.cargo),
      shoe: P(new THREE.CapsuleGeometry(0.052, 0.15, 4, 10).rotateX(Math.PI / 2).scale(1, 0.72, 1), M.box),
      sole: P(new THREE.BoxGeometry(0.105, 0.025, 0.26), M.box),
      neck: P(cap(0.05, 0.13), M.skin),
      head: P(new THREE.SphereGeometry(0.1, 18, 14), M.skin),
      jaw: P(new THREE.SphereGeometry(0.075, 12, 8).scale(1, 0.8, 1.05), M.skin),
      ear: P(new THREE.SphereGeometry(0.025, 8, 6).scale(0.5, 1, 0.8), M.skin),
      eye: P(new THREE.SphereGeometry(0.012, 6, 4), M.dark),
      // the face: the whites of the eyes, brows, a nose, a mouth
      eyeWhite: P(new THREE.SphereGeometry(0.017, 8, 6).scale(1, 0.62, 0.5), M.box),
      brow: P(new THREE.BoxGeometry(0.036, 0.0075, 0.012), M.box),
      nose: P(new THREE.SphereGeometry(0.016, 8, 6).scale(0.8, 1.6, 1.15), M.skin),
      mouth: P(new THREE.BoxGeometry(0.038, 0.008, 0.01), M.box),
      skirt: P(skirtGeo(0.17, 0.3, 0.86), M.skirt),
      // a midi skirt (below the knee, boots under it)
      midi: P(skirtGeo(0.17, 0.25, 0.58), M.skirt),
      // a coat's skirts (to the knee, open in front) and wide-leg trousers
      coatSkirt: P(skirtGeo(0.18, 0.27, 0.62, 0.7), M.coat),
      thighWide: P(limb(0.1, 0.098, 0.45), M.plain),
      shinWide: P(limb(0.098, 0.122, 0.43), M.plain),
      collar: P(new THREE.TorusGeometry(0.075, 0.028, 6, 14).rotateX(Math.PI / 2), M.plain),
      // (v5, ROADMAP 11.29) the hero's own body (render/heroshapes.js): one of him, so a few each
      heroHead: P(HERO.heroHeadGeo(), M.skin, 4),
      heroHair: P(HERO.heroHairGeo(), M.hair, 4),
      heroFade: P(HERO.heroFadeGeo(), M.hair, 4),
      heroNeck: P(HERO.heroNeckGeo(), M.skin, 4),
      heroCollar: P(HERO.heroCollarGeo(), M.plain, 4),
      heroTorso: P(HERO.heroTorsoGeo(), M.plain, 8),
      heroHem: P(HERO.heroHemGeo(), M.plain, 4),
      heroZip: P(HERO.heroZipGeo(), M.box, 4),
      heroTee: P(HERO.heroTeeGeo(), M.tee, 4),
      heroWelt: P(HERO.heroWeltGeo(), M.box, 4),
      heroPelvis: P(HERO.heroPelvisGeo(), M.cargo, 4),
      heroUpper: P(HERO.heroUpperGeo(), M.plain, 8),
      heroFore: P(HERO.heroForeGeo(), M.plain, 8),
      heroCuff: P(HERO.heroCuffGeo(), M.plain, 8),
      heroHandR: P(HERO.heroHandGeo(false), M.skin, 4),
      heroHandL: P(HERO.heroHandGeo(true), M.skin, 4),
      heroThigh: P(HERO.heroThighGeo(), M.cargo, 8),
      heroShin: P(HERO.heroShinGeo(), M.cargo, 8),
      heroShoe: P(HERO.heroShoeGeo(), M.box, 8),
      heroSole: P(HERO.heroSoleGeo(), M.box, 8),
      // the shapes of hair, hats and the things people hold (ellipsoids and capsules)
      sphere: P(new THREE.SphereGeometry(1, 14, 10), M.hair, 2048),
      sphereGloss: P(new THREE.SphereGeometry(1, 12, 8), M.gloss, 256),
      tube: P(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), M.hair, 1024),
      ball: P(new THREE.SphereGeometry(1, 10, 6), M.hair, 2048),
      boxP: P(new THREE.BoxGeometry(1, 1, 1), M.box, 512),
      // the far-off walkers' parts (game/farcrowd.js): the same sizes, a fifth of the points
      lowTorsoTee: P(lowTorsoGeo(0.15, 0.19, 0.205, 0.54, 0.14), M.tee),
      lowTorsoPlain: P(lowTorsoGeo(0.15, 0.19, 0.205, 0.54, 0.04), M.plain),
      lowPelvis: P(new THREE.SphereGeometry(0.17, 8, 5).scale(1.05, 0.72, 0.78), M.plain),
      lowUpper: P(lowLimb(0.056, 0.045, 0.29), M.plain),
      lowUpperSkin: P(lowLimb(0.056, 0.045, 0.29), M.skin),
      lowFore: P(lowLimb(0.045, 0.034, 0.26), M.plain),
      lowForeSkin: P(lowLimb(0.045, 0.031, 0.26), M.skin),
      lowThigh: P(lowLimb(0.085, 0.066, 0.45), M.plain),
      lowShin: P(lowLimb(0.064, 0.048, 0.43), M.plain),
      lowShinSkin: P(lowLimb(0.06, 0.042, 0.43), M.skin),
      lowHead: P(new THREE.SphereGeometry(0.1, 8, 6), M.skin),
      lowNeck: P(lowLimb(0.05, 0.05, 0.13), M.skin),
      lowSphere: P(new THREE.SphereGeometry(1, 8, 6), M.hair, 512),
      lowShoe: P(new THREE.CapsuleGeometry(0.052, 0.15, 1, 6).rotateX(Math.PI / 2).scale(1, 0.72, 1), M.box),
      lowSkirt: P(skirtGeo(0.17, 0.3, 0.86, 0, 8), M.skirt),
      lowMidi: P(skirtGeo(0.17, 0.25, 0.58, 0, 8), M.skirt),
      // (v5) the rest of a whole person in simple shapes (PersonRenderer.drawLow), each like its
      // detailed one in size, in the layouts of triangles above (no draws of their own)
      lowTorsoBoxy: P(lowTorsoGeo(0.15, 0.19, 0.205, 0.54, 0.1, true), M.plain),
      lowTorsoTeeBoxy: P(lowTorsoGeo(0.15, 0.19, 0.205, 0.54, 0.14, true), M.tee),
      lowHand: P(new THREE.SphereGeometry(0.05, 8, 6).scale(0.75, 1.3, 0.6), M.skin),
      lowJaw: P(new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.8, 1.05), M.skin),
      lowThighWide: P(lowLimb(0.1, 0.098, 0.45), M.plain),
      lowShinWide: P(lowLimb(0.098, 0.122, 0.43), M.plain),
      lowThighCargo: P(lowLimb(0.1, 0.082, 0.45), M.cargo),
      lowShinCargo: P(lowLimb(0.082, 0.078, 0.43), M.cargo),
      lowSleeve: P(lowSleeveGeo(0.08, 0.07, 0.15), M.tee),
      lowCoatSkirt: P(skirtGeo(0.18, 0.27, 0.62, 0, 8), M.plain),
    };
    for (const [k, sh] of Object.entries(this.p)) sh.lod = SHARED.has(k) ? 'shared' : k.startsWith('low') ? 'low' : 'full';
    // (farther than this a person is drawn in the simple shapes in the picture too: game.js sets
    // it for a phone and a computer)
    this.lodFar = 40;
    // (the pen strokes over a whole person - a chain, a hood's strings, a logo: game/doodle.js
    // drawDetails - within this far)
    this.detailFar = 60;
    // (the little things of a face, the soles and the pockets are inside the shadow of what they
    // are on: the sun's view leaves them out; and in the wet street's mirror, at half the pixels
    // and smeared, they are not there either)
    for (const k of ['eye', 'eyeWhite', 'brow', 'nose', 'mouth', 'ear', 'sole', 'pocket']) this.p[k].flags = NO_MIRROR | NO_SUN;
    this.buildShapes(scene);
    // eraser holes and fading per person
    this.owners = new Array(MAX_OWNERS).fill(false);
    this.holeTex = shared.uHoles.value;
    this.dirty = false;
  }

  // every shape into the texture, every shape into its class (a draw each)
  buildShapes(scene) {
    const M = this.mats;
    const shapes = Object.values(this.p);
    // the pens: the folds of the cloth are five pictures in one pen; the coat (seen from inside
    // too) has its own
    const front = mergedSurface(M.plain, { vcolor: false, pictures: penPictures([M.tee, M.shirt, M.cargo, M.skirt, M.plain]), pull: true });
    const coatPics = penPictures([M.coat]);
    const back = mergedSurface(M.coat, { vcolor: false, pictures: [coatPics[0], coatPics[0], coatPics[0], coatPics[0], coatPics[0]], pull: true });
    // (v5) the shapes drawn by their corners (OWN_LAYOUT): their row of the texture holds their
    // corners, and they share a draw with the shapes of the same layout of triangles
    const layouts = [];
    const layoutOf = (ig) => {
      const corners = ig.attributes.position.count;
      const ix = ig.index.array;
      let L = layouts.find((l) => l.corners === corners && l.index.length === ix.length && l.index.every((v, i) => v === ix[i]));
      if (!L) {
        L = { corners, index: Array.from(ix), id: layouts.length };
        layouts.push(L);
      }
      return L;
    };
    // (by side, and by kind: 'full' shapes are drawn in the picture alone, 'low' ones everywhere
    // and again, for those drawn in full, in the sun's view and the mirror alone)
    const sideOf = (sh) => `${sh.penMat === M.coat ? 'back' : 'front'}-${sh.lod}`;
    const classOf = (sh) => CLASS_SIZES.find((n) => n >= sh.count) || sh.count;
    const byCorners = (sh) => {
      sh.layout = layoutOf(sh.igeo);
      sh.geo = sh.igeo;
      sh.count = sh.layout.corners;
    };
    const names = new Map(Object.entries(this.p).map(([k, v]) => [v, k]));
    for (const sh of shapes) {
      sh.layout = null;
      if (sh.igeo && !IN_CLASS.has(names.get(sh)) && classOf(sh) - sh.igeo.attributes.position.count >= OWN_LAYOUT) byCorners(sh);
    }
    // (a class left with the shapes of one layout only: drawn by their corners, for nothing)
    const rest = new Map();
    for (const sh of shapes) {
      if (sh.layout) continue;
      const k = `${sideOf(sh)}:${classOf(sh)}`;
      if (!rest.has(k)) rest.set(k, []);
      rest.get(k).push(sh);
    }
    for (const list of rest.values()) {
      if (!list.every((sh) => sh.igeo)) continue;
      const L0 = layoutOf(list[0].igeo);
      if (list.every((sh) => layoutOf(sh.igeo) === L0)) list.forEach(byCorners);
    }
    for (const sh of shapes) sh.igeo = null;
    let wide = 0;
    shapes.forEach((sh, i) => {
      sh.row = i;
      sh.pen = penRow(sh.penMat);
      wide = Math.max(wide, sh.count);
    });
    // the texture: a row a shape, two texels a point
    const W = wide * 2;
    const data = new Float32Array(W * shapes.length * 4);
    for (const sh of shapes) {
      const g = sh.geo;
      const pos = g.attributes.position.array;
      const nor = g.attributes.normal.array;
      const uv = g.attributes.uv ? g.attributes.uv.array : null;
      for (let v = 0; v < sh.count; v++) {
        const o = (sh.row * W + v * 2) * 4;
        data[o] = pos[v * 3];
        data[o + 1] = pos[v * 3 + 1];
        data[o + 2] = pos[v * 3 + 2];
        data[o + 3] = uv ? uv[v * 2] : 0;
        data[o + 4] = nor[v * 3];
        data[o + 5] = nor[v * 3 + 1];
        data[o + 6] = nor[v * 3 + 2];
        data[o + 7] = uv ? uv[v * 2 + 1] : 0;
      }
      sh.geo = null;
    }
    const tex = new THREE.DataTexture(data, W, shapes.length, THREE.RGBAFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    shared.uShapes.value = tex;
    // the classes: by side, then by layout (drawn by corners) or by size
    this.classes = [];
    const groups = new Map();
    for (const sh of shapes) {
      const side = sideOf(sh);
      const L = sh.layout;
      const size = L ? L.corners : CLASS_SIZES.find((n) => n >= sh.count) || sh.count;
      const key = L ? `${side}:L${L.id}` : `${side}:${size}`;
      if (!groups.has(key)) groups.set(key, { side, size, index: L ? L.index : null, list: [] });
      groups.get(key).list.push(sh);
    }
    for (const { side, size, index, list } of groups.values()) {
      const cap = list.reduce((a, sh) => a + sh.cap, 0);
      const mat = side.startsWith('back') ? back : front;
      const cls = new DrawClass(scene, size, mat, cap, index);
      if (side.endsWith('-full')) {
        // (the picture alone: not on the mirror's layer, and left out of the sun's view)
        cls.mesh.layers.set(LAYERS.MIRRORLESS);
        cls.mesh.userData.noShadow = true;
      }
      for (const sh of list) sh.cls = cls;
      this.classes.push(cls);
      if (side.endsWith('-low')) {
        const aux = new DrawClass(scene, size, mat, cap, index, true);
        aux.mesh.layers.set(LAYERS.AUX);
        for (const sh of list) sh.auxCls = aux;
        this.classes.push(aux);
      }
    }
  }

  allocOwner() {
    for (let i = 0; i < MAX_OWNERS; i++) {
      if (!this.owners[i]) {
        this.owners[i] = true;
        this.clearOwner(i);
        return i;
      }
    }
    return -1;
  }

  releaseOwner(i) {
    if (i < 0) return;
    this.owners[i] = false;
    this.clearOwner(i);
  }

  clearOwner(i) {
    const d = this.holeTex.image.data;
    d.fill(0, i * (MAX_HOLES + 1) * 4, (i + 1) * (MAX_HOLES + 1) * 4);
    this.dirty = true;
  }

  setHole(owner, i, x, y, z, r) {
    if (owner < 0) return;
    const d = this.holeTex.image.data;
    const k = (owner * (MAX_HOLES + 1) + i) * 4;
    if (d[k] === x && d[k + 1] === y && d[k + 2] === z && d[k + 3] === r) return;
    d[k] = x;
    d[k + 1] = y;
    d[k + 2] = z;
    d[k + 3] = r;
    this.dirty = true;
  }

  setDissolve(owner, v) {
    if (owner < 0) return;
    const d = this.holeTex.image.data;
    const k = (owner * (MAX_HOLES + 1) + MAX_HOLES) * 4;
    if (d[k] === v) return;
    d[k] = v;
    this.dirty = true;
  }

  begin() {}

  // a plain ellipsoid at c in the frame (r, u, f) (the birds of the city, little things in the air)
  blob(c, r, u, f, sx, sy, sz, col) {
    this.p.ball.push(framed(c, r, u, f, sx, sy, sz), linC(col), 0, 0.5, 0);
  }

  // a pen line of the old notebook, as a thin rod (a cane, an umbrella's pole, a gold chain)
  rod(a, b, r, col, fig) {
    capsuleTo(this.p, a, b, Math.max(0.003, r), linC(col), fig.owner + 1, (fig.seed * 0.13 + 0.5) % 1, fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0, fig.brgt);
  }

  end() {
    for (const c of this.classes) c.end();
    // (the next frame's parts counted from the first again)
    _seq.fill(0);
    if (this.dirty) {
      this.holeTex.needsUpdate = true;
      this.dirty = false;
    }
  }

  // ------------------------------------------------------------------ somebody far off
  // A walker far down the street, cheaply (game/farcrowd.js): the body, the head with its hair
  // or hat, the arms and legs swinging with the walk, the shoes; no face, nothing held. The same
  // pens and the same proportions as a whole person, so the one becomes the other unnoticed.
  // w: { x, y, z, yaw, phase, speed, look, scale } (and, for a crowd in its seats - the arena's,
  // game/arenagame.js - sit: 1 seated, 0 on their feet; cheer: 1 both arms up, pumping with pump)
  drawCheap(w) {
    const L = w.look;
    const p = this.p;
    const S = w.scale;
    const k = S * 0.98;
    const fem = L.fem;
    const bulk = L.build.bulk;
    const fx = Math.sin(w.yaw);
    const fz = Math.cos(w.yaw);
    const F = _cF.set(fx, 0, fz);
    const R = _cR.set(-fz, 0, fx);
    const A = Math.min(1, w.speed / 7.5);
    const ph = w.phase;
    const J = _cJ;
    // the joints (the rig's walk, game/doodle.js, without the rig)
    _aw = w;
    _aS[0] = S;
    const at = atW;
    const sit = w.sit || 0;
    const cheer = w.cheer || 0;
    const hipY = 0.93 - Math.abs(Math.sin(ph)) * 0.05 * A - 0.46 * sit;
    const lean = A * 0.12;
    at(J.hip, 0, hipY, 0);
    const ny = hipY + 0.5 * Math.cos(lean);
    const nz = 0.5 * Math.sin(lean);
    at(J.neck, 0, ny, nz);
    const hOff = 0.1 + 0.12 * L.build.head;
    at(J.head, 0, ny + hOff, nz + hOff * Math.sin(lean));
    const sw = (fem ? 0.15 : 0.17) * Math.max(0.9, bulk * 0.96);
    const hw = (fem ? 0.095 : 0.085) * bulk;
    const own = 0;
    // (a crowd indoors: 1 a room under its lamps, 3 a dark hall under its neon - the arcade)
    const ind = w.indoor || 0;
    const seed = (w.seed % 1) * 0.37 + 0.11;
    const bodyId = seed;
    const armId = (seed + 0.31) % 1;
    const headId = (seed + 0.62) % 1;
    const top = L.top;
    const bot = L.bottom;
    const skin = linC(L.skin);
    const topC = linC(top.color);
    const botC = linC(bot.color);
    const longSkirt = bot.kind === 'skirt' || bot.kind === 'dress' || top.kind === 'dress';
    const midi = bot.kind === 'midi';
    const tee = top.kind === 'tee' || top.kind === 'tank' || top.kind === 'polo';
    const sleeves = top.sleeves || (tee ? 'short' : 'long');
    const open = OPEN.has(top.kind);
    const br = Math.max(0.9, bulk * 0.96) * (top.kind === 'puffer' ? 1.14 : 1);
    // the torso and the hips
    _a.copy(J.hip).addScaledVector(UP, 0.04 * S);
    const sy = Math.max(0.2, _b.subVectors(J.neck, _a).length()) / 0.5;
    const pool = tee && top.kind !== 'tank' ? p.lowTorsoTee : p.lowTorsoPlain;
    const tw = (fem ? 0.95 : 1.05) * br * k;
    pool.push(framed(_a, R, UP, F, tw, sy, tw * (fem ? 1.05 : 1)), topC, own, bodyId, ind);
    _a.copy(J.hip).addScaledVector(UP, 0.02 * S);
    p.lowPelvis.push(framed(_a, R, UP, F, k * bulk * (fem ? 1.06 : 1), k, k * bulk), longSkirt && top.kind === 'dress' ? topC : botC, own, bodyId, ind);
    if (longSkirt) {
      _a.copy(J.hip).addScaledVector(UP, 0.05 * S);
      p.lowSkirt.push(framed(_a, R, UP, F, k * bulk, k, k * bulk), top.kind === 'dress' ? topC : botC, own, bodyId, ind);
    } else if (midi) {
      _a.copy(J.hip).addScaledVector(UP, 0.05 * S);
      p.lowMidi.push(framed(_a, R, UP, F, k * bulk, k, k * bulk), botC, own, bodyId, ind);
    }
    // the neck and the head, its hair or hat
    const hs = L.build.head * S;
    _c.copy(J.head).addScaledVector(UP, -0.06 * S);
    p.lowNeck.push(along(_c, J.neck, 0.13, k * 1.18, R), skin, own, headId, ind);
    p.lowHead.push(framed(J.head, R, UP, F, 0.98 * hs, 1.14 * hs, 1.06 * hs), skin, own, headId, ind);
    const hair = L.hair && L.hair.style !== 'none' ? linC(L.hair.color) : null;
    if (L.hat) {
      _c.copy(J.head).addScaledVector(UP, 0.05 * hs);
      const cl = _cClip;
      cl[0] = 0;
      cl[1] = -1;
      cl[2] = 0;
      cl[3] = -(J.head.y + 0.02 * hs);
      p.lowSphere.push(framed(_c, R, UP, F, 0.118 * hs, 0.1 * hs, 0.122 * hs), linC(L.hat.color), own, headId, ind, cl);
    } else if (hair) {
      const cl = _cClip;
      cl[0] = 0;
      cl[1] = -1;
      cl[2] = 0;
      cl[3] = -(J.head.y + 0.03 * hs);
      _c.copy(J.head).addScaledVector(F, -0.008 * hs);
      p.lowSphere.push(framed(_c, R, UP, F, 0.11 * hs, 0.125 * hs, 0.116 * hs), hair, own, headId, ind, cl);
    }
    if (hair && /long|ponytail|braids|curly|afro|bob/.test(L.hair.style)) {
      // down the back of the head
      const cl = _cClip2;
      cl[0] = F.x;
      cl[1] = 0;
      cl[2] = F.z;
      cl[3] = J.head.x * F.x + J.head.z * F.z - 0.02 * hs;
      const long = /long|braids/.test(L.hair.style);
      _c.copy(J.head).addScaledVector(F, -0.05 * hs).addScaledVector(UP, long ? -0.08 * hs : -0.02 * hs);
      p.lowSphere.push(framed(_c, R, UP, F, 0.11 * hs, (long ? 0.17 : 0.11) * hs, 0.08 * hs), hair, own, headId, ind, cl);
    }
    // the arms, swinging
    const armU = 0.31;
    const armF = 0.29;
    const swing = 0.15 + 0.7 * A;
    const armK = k * Math.max(1, bulk * 0.85) * (open ? 1.08 : 1);
    const shortS = sleeves === 'short' && !fem;
    const noS = sleeves === 'none' && !fem;
    for (let ai = 0; ai < 2; ai++) {
      const side = ai === 0 ? 1 : -1;
      const off = ai === 0 ? 0 : Math.PI;
      let a = -Math.sin(ph + off) * swing;
      let b = a + 0.35 + A * 0.5;
      if (sit > 0) {
        // (the hands on the knees)
        a += (0.42 - a) * sit;
        b += (1.25 - b) * sit;
      }
      if (cheer > 0) {
        // (up, pumping, a little out to the sides)
        const up = Math.PI - 0.32 + Math.sin((w.pump || 0) + ai * 0.9) * 0.22;
        a += (up - a) * cheer;
        b += (up + 0.12 - b) * cheer;
      }
      const sx = side * (sw + 0.02 + cheer * 0.05);
      at(_a, sx, ny - 0.07, nz);
      const ey = ny - 0.07 - Math.cos(a) * armU;
      const ez = nz + Math.sin(a) * armU;
      at(_b, sx + side * cheer * 0.06, ey, ez);
      at(_c, sx + side * (0.02 + cheer * 0.1), ey - Math.cos(b) * armF, ez + Math.sin(b) * armF);
      (shortS || noS ? p.lowUpperSkin : p.lowUpper).push(along(_a, _b, 0.29, armK, F), shortS || noS ? skin : topC, own, armId, ind);
      (shortS || noS ? p.lowForeSkin : p.lowFore).push(along(_b, _c, 0.26, armK, F), shortS || noS ? skin : topC, own, armId, ind);
    }
    // the legs, the shoes
    const legL = 0.47 * (L.build.legs || 1);
    const legK = k * Math.max(1, bulk * 0.9);
    const shoeC = linC(L.boots || L.shoes);
    const wide = bot.kind === 'wide';
    const cargo = bot.kind === 'baggy' || bot.kind === 'cargo';
    const shorts = bot.kind === 'shorts';
    for (let li = 0; li < 2; li++) {
      const off = li === 0 ? 0 : Math.PI;
      const sx = (li === 0 ? 1 : -1) * hw;
      let th = Math.sin(ph + off) * (0.18 + 0.62 * A);
      let kb = Math.max(0, Math.sin(ph + off - Math.PI * 0.5)) * (0.25 + 0.9 * A) + 0.05;
      if (sit > 0) {
        // (in a seat: the thighs out in front, the shins down to the floor)
        th += (1.45 - th) * sit;
        kb += (1.45 - kb) * sit;
      }
      at(_a, sx, hipY, 0);
      const ky = hipY - Math.cos(th) * legL;
      const kz = Math.sin(th) * legL;
      at(_b, sx, ky, kz);
      const sh = th - kb;
      const fy = Math.max(ky - Math.cos(sh) * legL, 0.04);
      const fz2 = kz + Math.sin(sh) * legL;
      at(_c, sx, fy, fz2);
      // (wide and cargo trousers a little wider)
      const tk = wide || cargo ? 1.2 : 1;
      if (midi) p.lowShin.push(along(_b, _c, 0.43, legK * 1.06, F), shoeC, own, bodyId, ind);
      else if (!longSkirt) {
        p.lowThigh.push(along(_a, _b, 0.45, legK * tk, F), botC, own, bodyId, ind);
        (shorts ? p.lowShinSkin : p.lowShin).push(along(_b, _c, 0.43, legK * tk, F), shorts ? skin : botC, own, bodyId, ind);
      }
      _d.copy(_c).addScaledVector(F, 0.05 * S);
      _d.y = Math.max(_d.y - 0.02 * S, w.y + 0.035);
      p.lowShoe.push(framed(_d, R, UP, F, k, k, k), shoeC, own, bodyId, ind);
    }
  }

  // ------------------------------------------------------------------ one person
  // fig: a Doodle (its joints, its look, its body frames); camDist: how far from the camera
  draw(fig, camDist) {
    if (camDist > this.lodFar) {
      this.drawLow(fig, false);
      return;
    }
    this.drawFull(fig, camDist);
    this.drawLow(fig, true);
  }

  // in full, in the picture
  drawFull(fig, camDist) {
    if (fig.look.heroModel) {
      this.drawHero(fig);
      return;
    }
    const L = fig.look;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
    const S = fig.scale;
    const k = S * 0.98;
    const bulk = fig.bulk;
    const seed = (fig.seed % 1) * 0.37 + 0.11;
    _part[0] = seed;
    const id = nextPart;
    const ax = fig.ax;
    const rgt = fig.brgt;
    const fwd = fig.bfwd;
    const far = camDist > 55;
    const top = L.top;
    const bot = L.bottom;
    const skin = linC(L.skin);
    let topCol = top.color;
    if (fig.paintT > 0) {
      const t = Math.min(1, fig.paintT / 2.5) * 0.7;
      topCol = topCol.map((v, i) => v + (fig.paintColor[i] - v) * t);
    }
    const topC = linC(topCol);
    const botC = linC(bot.color);
    const longSkirt = bot.kind === 'skirt' || bot.kind === 'dress' || top.kind === 'dress';
    const midi = bot.kind === 'midi';
    const skirtC = top.kind === 'dress' ? topC : botC;
    const bootC = linC(L.boots || L.shoes);
    const tee = top.kind === 'tee' || top.kind === 'tank' || top.kind === 'polo';
    const sleeves = top.sleeves || (tee ? 'short' : 'long');
    const cargo = bot.kind === 'baggy' || bot.kind === 'cargo';
    const wide = bot.kind === 'wide';
    const shorts = bot.kind === 'shorts';
    // jackets and coats: open in front over what is under them
    const open = OPEN.has(top.kind);
    const puffy = top.kind === 'puffer';
    const br = Math.max(0.9, bulk * 0.96) * (puffy ? 1.14 : 1);
    fig.headId = (seed * 7.77 + 0.31) % 1;

    // ---- the torso and the hips
    if (P.torso > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.04 * S);
      const len = Math.max(0.2, _b.subVectors(j.neck, _a).length());
      const sy = len / 0.5;
      const pool = tee && top.kind !== 'tank' ? p.torsoTee : top.kind === 'shirt' || top.kind === 'blouse' || top.kind === 'dress' ? p.torsoFit : open || top.kind === 'hoodie' || top.kind === 'track' || top.kind === 'sweatshirt' ? p.torsoBoxy : p.torsoPlain;
      const w = (L.fem ? 0.95 : 1.05) * br * k * (L.hero ? 1.05 : 1);
      pool.push(framed(_a, rgt, ax, fwd, w, sy, w * (L.fem ? 1.05 : 1)), topC, own, id(), ind);
      // a jacket's open front over the shirt or the tee under it, a suit's tie (on the torso's front:
      // 0.195 across, 0.66 of it deep, in the torso's own scale)
      if (open) {
        const inC = linC(top.shirt || top.inner || [0.92, 0.92, 0.9]);
        const front = 0.129 * w * (L.fem ? 1.05 : 1);
        _c.lerpVectors(j.hip, j.neck, 0.62).addScaledVector(fwd, front + 0.002 * S);
        p.boxP.push(framed(_c, rgt, ax, fwd, (top.kind === 'suit' ? 0.07 : 0.1) * S, 0.34 * S, 0.012 * S), inC, own, id(), ind);
        if (top.tie) {
          _c.copy(j.neck).lerp(j.hip, 0.3).addScaledVector(fwd, front + 0.008 * S);
          p.boxP.push(framed(_c, rgt, ax, fwd, 0.028 * S, 0.2 * S, 0.012 * S), linC(top.tie), own, id(), ind);
        }
        // the collar standing round the neck
        _c.copy(j.neck).addScaledVector(ax, -0.01 * S);
        p.collar.push(framed(_c, rgt, ax, fwd, k * br, k, k * br * 0.95), topC, own, id(), ind);
        if (L.hero && !far) heroJacket(p, fig, j, rgt, ax, fwd, S, br, front, topC, own, id, ind);
        // a coat goes on down to the knees, open in front
        if ((top.kind === 'trench' || top.kind === 'coat') && P.pelvis > 0.5 && fig.sit < 0.3) {
          _c.copy(j.hip).addScaledVector(ax, 0.06 * S);
          const sw = Math.sin(fig.phase) * 0.05 * Math.min(1, fig.speed / 1.4);
          _d.copy(fwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
          p.coatSkirt.push(framed(_c, rgt, _d, _x.crossVectors(rgt, _d), k * br, k, k * br), topC, own, id(), ind);
        }
      } else if (top.kind === 'hoodie' || top.kind === 'sweatshirt' || top.kind === 'polo') {
        _c.copy(j.neck).addScaledVector(ax, -0.015 * S);
        p.collar.push(framed(_c, rgt, ax, fwd, k * br * 0.9, k * 0.8, k * br * 0.85), topC, own, id(), ind);
      }
      // the neck
      _c.copy(j.headC).addScaledVector(fig.hu, -0.06 * S);
      p.neck.push(along(_c, j.neck, 0.13, k * 1.18 * Math.max(1, bulk * 0.9), rgt), skin, own, fig.headId, ind);
    }
    if (P.pelvis > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.02 * S);
      const pc = longSkirt ? skirtC : botC;
      (longSkirt || midi ? p.pelvisSkirt : cargo ? p.pelvis : p.pelvis).push(framed(_a, rgt, ax, fwd, k * bulk * (L.fem ? 1.06 : 1), k, k * bulk), pc, own, id(), ind);
      if (midi && P.torso > 0.5 && fig.sit < 0.3) {
        // a midi skirt, swinging a little as she walks
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        const sw = Math.sin(fig.phase) * 0.06 * Math.min(1, fig.speed / 1.4);
        _c.copy(fwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
        p.midi.push(framed(_a, rgt, _c, _d.crossVectors(rgt, _c), k * bulk, k * (1 - fig.crouch * 0.4), k * bulk), botC, own, id(), ind);
      }
      if (longSkirt && P.torso > 0.5) {
        // a long skirt from the waist to the ankles; sitting, it drapes over the knees
        const sit = fig.sit;
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        _b.copy(_a).addScaledVector(ax, -1);
        const kk = k * bulk;
        if (sit < 0.3) {
          const sw = Math.sin(fig.phase) * 0.05 * Math.min(1, fig.speed / 1.4);
          _c.copy(fwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
          p.skirt.push(framed(_a, rgt, _c, _d.crossVectors(rgt, _c), kk, k * (1 - fig.crouch * 0.4), kk), skirtC, own, id(), ind);
        } else {
          p.skirt.push(framed(_a, rgt, ax, fwd, kk, k * 0.32, kk), skirtC, own, id(), ind);
          _c.lerpVectors(j.kneeL, j.kneeR, 0.5);
          _d.lerpVectors(j.footL, j.footR, 0.5);
          // over the lap to the knees, and from the knees down to the ankles
          _b.copy(j.hip).addScaledVector(fwd, 0.04 * S);
          capsuleTo(p, _b, _c, 0.19 * kk, skirtC, own, id(), ind, rgt);
          capsuleTo(p, _c, _d, 0.17 * kk, skirtC, own, id(), ind, rgt);
        }
      }
    }
    // ---- arms
    // (the joints never change: their lists are made once)
    const arms = fig._armJ || (fig._armJ = [[j.shoulderR, j.elbowR, j.handR], [j.shoulderL, j.elbowL, j.handL]]);
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1) * (puffy ? 1.3 : open ? 1.08 : 1);
    for (let ai = 0; ai < 2; ai++) {
      if (P[ARM_PART[ai]] < 0.5) continue;
      const sh = arms[ai][0];
      const el = arms[ai][1];
      const hd = arms[ai][2];
      const shortS = sleeves === 'short' && !L.fem;
      const noS = sleeves === 'none' && !L.fem;
      const upperSkin = shortS || noS;
      // (one arm in one sleeve is one drawn shape: the upper arm and the forearm share their
      // id, so the ink draws its outline, not a doll's joints)
      const armId = id();
      (upperSkin ? p.upperSkin : p.upperShirt).push(along(sh, el, 0.29, armK, fwd), upperSkin ? skin : topC, own, armId, ind);
      if (shortS) {
        const slId = id();
        p.sleeveTee.push(along(sh, el, 0.29, armK * 0.98, fwd, _m), topC, own, slId, ind);
        // (the sleeve reaches a bit more than half way)
        p.ballTee.push(framed(sh, rgt, ax, fwd, armK * br, armK * br, armK * br), topC, own, slId, ind);
      }
      const foreSkin = shortS || noS || L.rolled || top.rolled;
      (foreSkin ? p.foreSkin : p.foreShirt).push(along(el, hd, 0.26, armK, fwd), foreSkin ? skin : topC, own, foreSkin === upperSkin ? armId : id(), ind);
      _c.subVectors(hd, el).normalize();
      _d.copy(hd).addScaledVector(_c, 0.035 * S);
      p.hand.push(along(_d, _a.copy(_d).addScaledVector(_c, 0.05), 0.05, k, fwd), skin, own, id(), ind);
      // (the hero's sleeves end in a cuff, a band a shade darker round the wrist)
      if (L.hero && !far && !foreSkin) {
        _a.copy(hd).addScaledVector(_c, -0.03 * S);
        _x.crossVectors(_c, fwd);
        if (_x.lengthSq() < 1e-6) _x.copy(rgt);
        _x.normalize();
        _z.crossVectors(_x, _c);
        p.sphere.push(framed(_a, _x, _c, _z, 0.043 * armK, 0.02 * S, 0.043 * armK), heroDark(fig, topC), own, id(), ind);
      }
    }
    // ---- legs
    const legs = fig._legJ || (fig._legJ = [[j.hipR, j.kneeR, j.footR, j.toeR], [j.hipL, j.kneeL, j.footL, j.toeL]]);
    const legK = k * Math.max(1, bulk * 0.9) * (fig.limbs || 1);
    const shoeC = linC(L.shoes);
    for (let li = 0; li < 2; li++) {
      if (P[LEG_PART[li]] < 0.5) continue;
      const hp = legs[li][0];
      const kn = legs[li][1];
      const ft = legs[li][2];
      const to = legs[li][3];
      const sx = li === 0 ? 1 : -1;
      const legId = id();
      if (midi) {
        // under a midi skirt: the boots (and over the knees when she sits)
        if (fig.sit > 0.3 || fig.crawl > 0.3 || fig.dead > 0.3) p.thigh.push(along(hp, kn, 0.45, legK * 1.15, fwd), botC, own, legId, ind);
        p.shin.push(along(kn, ft, 0.43, legK * 1.06, fwd), bootC, own, id(), ind);
      } else if (!longSkirt || fig.sit > 0.3 || fig.crawl > 0.3 || fig.dead > 0.3) {
        (wide ? p.thighWide : cargo ? p.thighCargo : p.thigh).push(along(hp, kn, 0.45, legK, fwd), longSkirt ? skirtC : botC, own, legId, ind);
        if (cargo && !far) {
          _c.lerpVectors(hp, kn, 0.55).addScaledVector(rgt, sx * 0.085 * S);
          p.pocket.push(framed(_c, rgt, _d.subVectors(hp, kn).normalize(), fwd, k, k, k), botC, own, id(), ind);
        }
        (shorts ? p.shinSkin : wide ? p.shinWide : cargo ? p.shinCargo : p.shin).push(along(kn, ft, 0.43, legK, fwd), shorts ? skin : longSkirt ? skirtC : botC, own, shorts ? id() : legId, ind);
      }
      // a sneaker: a rounded sole and a toe, pointing where the foot points
      _z.subVectors(to, ft);
      _z.y = 0;
      if (_z.lengthSq() < 1e-6) _z.copy(fwd);
      _z.normalize();
      _x.crossVectors(UP, _z).normalize();
      _c.copy(ft).addScaledVector(_z, 0.05 * S);
      _c.y = Math.max(_c.y - 0.02 * S, fig.pos.y + 0.035);
      p.shoe.push(framed(_c, _x, UP, _z, k, k, k), shoeC, own, id(), ind);
      // (the hero's boots: a shaft up over the ankle, the jeans' hem over it)
      if (L.hero && !far && !midi && !longSkirt && !shorts) {
        _a.copy(ft).addScaledVector(UP, 0.01 * S);
        _b.subVectors(kn, ft).normalize();
        _b.multiplyScalar(0.15 * S).add(ft);
        capsuleTo(p, _a, _b, 0.056 * legK, shoeC, own, id(), ind, rgt);
      }
      if (!far) {
        _c.y -= 0.032 * S;
        p.sole.push(framed(_c, _x, UP, _z, k, k, k), linC(SOLE), own, id(), ind);
      }
    }
    // ---- the head (the first boulevard's: a skull, a jaw, ears, two eyes)
    if (P.head > 0.5) {
      const hs = fig.headScale * S;
      const hc = j.headC;
      const hr = fig.hr;
      const hu = fig.hu;
      const hf = fig.hf;
      // (the skull, the jaw, the nose and the neck are one drawn face: one id between them)
      const headId = fig.headId !== undefined ? fig.headId : id();
      p.head.push(framed(hc, hr, hu, hf, 1.0 * hs * 0.98, 1.14 * hs * 1.0, 1.0 * hs * 1.06), skin, own, headId, ind);
      _c.copy(hc).addScaledVector(hu, -0.065 * hs).addScaledVector(hf, 0.03 * hs);
      p.jaw.push(framed(_c, hr, hu, hf, hs * (L.hero ? 1.13 : 1.05), hs * (L.hero ? 1.04 : 1), hs * 1.05), skin, own, headId, ind);
      if (!far) {
        for (let sd = -1; sd <= 1; sd += 2) {
          _c.copy(hc).addScaledVector(hr, sd * 0.1 * hs).addScaledVector(hf, -0.005 * hs);
          p.ear.push(framed(_c, hr, hu, hf, hs, hs, hs), skin, own, id(), ind);
        }
        const masked = L.hat && L.hat.kind === 'skimask';
        const shades = L.face && L.face.glasses === 'shades';
        if (!L._brow || L._browOf !== L.hair) {
          L._browOf = L.hair;
          L._brow = L.hair && L.hair.style !== 'none' ? L.hair.color.map((v) => v * 0.8) : BROW_BALD;
        }
        const browC = linC(L._brow);
        for (let sd = -1; sd <= 1; sd += 2) {
          if (!shades) {
            _c.copy(hc).addScaledVector(hr, sd * 0.036 * hs).addScaledVector(hu, 0.02 * hs).addScaledVector(hf, 0.098 * hs);
            if (!masked) p.eyeWhite.push(framed(_c, hr, hu, hf, hs, hs, hs), linC(EYE_WHITE), own, id(), ind);
            _c.addScaledVector(hf, 0.006 * hs);
            p.eye.push(framed(_c, hr, hu, hf, hs * (masked ? 1.3 : 0.8), hs * (masked ? 1.3 : 0.8), hs * 0.8), linC(masked ? MASK_EYE : PUPIL), own, id(), ind);
          }
          if (!masked) {
            // the brows, a little apart and a little tilted
            _c.copy(hc).addScaledVector(hr, sd * 0.038 * hs).addScaledVector(hu, 0.047 * hs).addScaledVector(hf, 0.096 * hs);
            _d.copy(hr).addScaledVector(hu, -sd * 0.12).normalize();
            _x.crossVectors(hf, _d).normalize();
            p.brow.push(framed(_c, _d, _x, hf, hs * (L.fem ? 0.9 : L.hero ? 1.15 : 1.05), hs * (L.fem ? 0.8 : L.hero ? 1.7 : 1.15), hs), browC, own, id(), ind);
          }
        }
        if (!masked) {
          _c.copy(hc).addScaledVector(hu, -0.012 * hs).addScaledVector(hf, 0.104 * hs);
          p.nose.push(framed(_c, hr, hu, hf, hs * (L.hero ? 1.1 : 1), hs * (L.hero ? 1.12 : 1), hs * (L.hero ? 1.15 : 1)), skin, own, headId, ind);
          _c.copy(hc).addScaledVector(hu, -0.056 * hs).addScaledVector(hf, 0.11 * hs);
          p.mouth.push(framed(_c, hr, hu, hf, hs, hs, hs), linC(L.fem ? LIPS_F : LIPS_M), own, id(), ind);
        }
      }
    }
    // ---- hair, hats, beards, held things: the rig's own shapes
    const shapes = fig.shapes;
    for (let i = fig.dressFrom || 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (!s.dress || P[s.part === 'pelvis' ? 'pelvis' : s.part] < 0.5) continue;
      const col = linC(s.col);
      if (s.type === 0) capsuleTo(p, _a.copy(s.c).sub(s.y), _b.copy(s.c).add(s.y), s.x.x, col, own, id(), ind, rgt, s.clip);
      else {
        _m.set(s.x.x, s.y.x, s.z.x, s.c.x, s.x.y, s.y.y, s.z.y, s.c.y, s.x.z, s.y.z, s.z.z, s.c.z, 0, 0, 0, 1);
        (s.gloss ? p.sphereGloss : p.sphere).push(_m, col, own, id(), ind, s.clip);
      }
    }
  }

  // (v5, ROADMAP 11.29) The hero, in a body of his own (render/heroshapes.js), on the same rig as
  // everyone: a carved head, his short hair, a bomber jacket over a white tee, jeans, sneakers, hands
  // with fingers. What he wears keeps its colours (the jacket takes the top's, the jeans the
  // bottom's, the sneakers the shoes'); a hat, glasses and what he holds come as for anybody.
  drawHero(fig) {
    const L = fig.look;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
    const S = fig.scale;
    const k = S * 0.98;
    const bulk = fig.bulk;
    const seed = (fig.seed % 1) * 0.37 + 0.11;
    _part[0] = seed;
    const id = nextPart;
    const ax = fig.ax;
    const rgt = fig.brgt;
    const fwd = fig.bfwd;
    const top = L.top;
    let topCol = top.armor && top.under ? top.under : top.color;
    if (fig.paintT > 0) {
      const t = Math.min(1, fig.paintT / 2.5) * 0.7;
      topCol = topCol.map((v, i) => v + (fig.paintColor[i] - v) * t);
    }
    const jC = linC(topCol);
    const ribC = heroDark(fig, jC);
    const teeC = linC(top.inner || top.shirt || TEE);
    const jeansC = linC(L.bottom.color);
    const shoeC = linC(L.shoes);
    const skin = linC(L.skin);
    fig.headId = (seed * 7.77 + 0.31) % 1;
    const bw = k * Math.max(0.92, bulk * 0.96);
    // ---- the jacket, and the tee in its collar
    if (P.torso > 0.5) {
      const sy = Math.max(0.3, _b.subVectors(j.neck, j.hip).length()) / 0.5;
      framed(j.hip, rgt, ax, fwd, bw, sy, bw, _mH);
      p.heroTorso.push(_mH, jC, own, id(), ind);
      p.heroHem.push(_mH, ribC, own, id(), ind);
      p.heroZip.push(_mH, ZIP, own, id(), ind);
      p.heroWelt.push(_mH, ribC, own, id(), ind);
      p.heroTee.push(_mH, teeC, own, id(), ind);
      _c.copy(j.neck).addScaledVector(ax, -0.004 * S).addScaledVector(fwd, -0.004 * S);
      p.heroCollar.push(framed(_c, rgt, ax, fwd, k * 1.03, k, k * 1.03), ribC, own, id(), ind);
      if (top.armor) {
        // (the vest of notebook covers, over the jacket)
        _c.copy(j.hip).addScaledVector(ax, 0.07 * S);
        p.heroTorso.push(framed(_c, rgt, ax, fwd, bw * 1.09, sy * 0.8, bw * 1.15), linC(top.color), own, id(), ind);
      }
      // the neck, from under the back of the skull down into the collar
      const hs = fig.headScale * S;
      _c.copy(j.headC).addScaledVector(fig.hu, -0.055 * hs).addScaledVector(fig.hf, -0.018 * hs);
      _d.copy(j.neck).addScaledVector(ax, -0.03 * S).addScaledVector(fwd, -0.008 * S);
      // (its own drawing: the ink draws the jaw's line over it)
      p.heroNeck.push(along(_c, _d, 0.17, k * Math.max(1, bulk * 0.92), rgt), skin, own, id(), ind);
    }
    if (P.pelvis > 0.5) p.heroPelvis.push(framed(j.hip, rgt, ax, fwd, bw, k, bw), jeansC, own, id(), ind);
    // ---- arms in their sleeves, the cuffs, the hands
    const arms = fig._armJ || (fig._armJ = [[j.shoulderR, j.elbowR, j.handR], [j.shoulderL, j.elbowL, j.handL]]);
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1);
    for (let ai = 0; ai < 2; ai++) {
      if (P[ARM_PART[ai]] < 0.5) continue;
      const sh = arms[ai][0];
      const el = arms[ai][1];
      const hd = arms[ai][2];
      const armId = id();
      p.heroUpper.push(along(sh, el, 0.31, armK, fwd), jC, own, armId, ind);
      p.heroFore.push(along(el, hd, 0.29, armK, fwd), jC, own, armId, ind);
      p.heroCuff.push(along(el, hd, 0.29, armK, fwd), ribC, own, id(), ind);
      _c.subVectors(hd, el).normalize();
      _d.copy(hd).addScaledVector(_c, 0.19 * S);
      (ai === 0 ? p.heroHandR : p.heroHandL).push(along(hd, _d, 0.19, k, fwd), skin, own, id(), ind);
    }
    // ---- the legs in jeans, the sneakers
    const legs = fig._legJ || (fig._legJ = [[j.hipR, j.kneeR, j.footR, j.toeR], [j.hipL, j.kneeL, j.footL, j.toeL]]);
    const legK = k * Math.max(1, bulk * 0.9) * (fig.limbs || 1);
    for (let li = 0; li < 2; li++) {
      if (P[LEG_PART[li]] < 0.5) continue;
      const hp = legs[li][0];
      const kn = legs[li][1];
      const ft = legs[li][2];
      const to = legs[li][3];
      const legId = id();
      p.heroThigh.push(along(hp, kn, 0.47, legK, fwd), jeansC, own, legId, ind);
      p.heroShin.push(along(kn, ft, 0.47, legK, fwd), jeansC, own, legId, ind);
      _z.subVectors(to, ft);
      _z.y = 0;
      if (_z.lengthSq() < 1e-6) _z.copy(fwd);
      _z.normalize();
      _x.crossVectors(UP, _z).normalize();
      _c.copy(ft).addScaledVector(_z, 0.05 * S);
      _c.y = Math.max(_c.y - 0.02 * S, fig.pos.y + 0.04);
      framed(_c, _x, UP, _z, k, k, k, _mH);
      p.heroShoe.push(_mH, shoeC, own, id(), ind);
      p.heroSole.push(_mH, linC(SOLE), own, id(), ind);
    }
    // ---- the head: the carved one, his hair, ears, eyes under their lids, brows, the line of the lips
    if (P.head > 0.5) {
      const hs = fig.headScale * S;
      const hr = fig.hr;
      const hu = fig.hu;
      const hf = fig.hf;
      // (set a little lower on the neck than the rig's head: a shorter neck, under a real jaw)
      const hc = _hcH.copy(j.headC).addScaledVector(hu, -0.028 * hs);
      p.heroHead.push(framed(hc, hr, hu, hf, hs, hs, hs), skin, own, fig.headId, ind);
      if (L.hair && L.hair.style !== 'none') {
        // (the top kept longer, the sides and the back faded close: the skin a little through them)
        const hairC = linC(L.hair.color);
        framed(hc, hr, hu, hf, hs, hs, hs, _mH);
        p.heroHair.push(_mH, hairC, own, id(), ind);
        p.heroFade.push(_mH, heroFadeC(fig, hairC, skin), own, fig.headId, ind);
      }
      if (!L.hat || L.hat.kind !== 'skimask') {
        const P3 = (x, y, z) => _c.copy(hc).addScaledVector(hr, x * hs).addScaledVector(hu, y * hs).addScaledVector(hf, z * hs);
        for (let sd = -1; sd <= 1; sd += 2) {
          // (an ear lies close against the head, leaning back a little; one drawing with the head)
          P3(sd * 0.071, 0.0, -0.014);
          _d.copy(hu).addScaledVector(hf, -0.28).normalize();
          _x.crossVectors(_d, hr).normalize();
          p.ear.push(framed(_c, hr, _d, _x, hs * 0.5, hs * 1.08, hs * 0.72), skin, own, fig.headId, ind);
        }
        const shades = L.face && L.face.glasses === 'shades';
        if (!L._brow || L._browOf !== L.hair) {
          L._browOf = L.hair;
          L._brow = L.hair && L.hair.style !== 'none' ? L.hair.color.map((v) => v * 0.8) : BROW_BALD;
        }
        const browC = linC(L._brow);
        for (let sd = -1; sd <= 1; sd += 2) {
          if (!shades) {
            P3(sd * 0.031, 0.018, 0.074);
            p.eyeWhite.push(framed(_c, hr, hu, hf, hs * 0.735, hs * 0.75, hs * 1.06), linC(EYE_WHITE), own, id(), ind);
            P3(sd * 0.031, 0.0165, 0.0815);
            p.eye.push(framed(_c, hr, hu, hf, hs * 0.38, hs * 0.4, hs * 0.25), linC(IRIS), own, id(), ind);
            // the upper lid, over the top of the eye: a level, steady look
            P3(sd * 0.031, 0.0238, 0.0772);
            p.nose.push(framed(_c, hr, hu, hf, hs * 1.14, hs * 0.18, hs * 0.47), skin, own, fig.headId, ind);
          }
          // a brow along the ridge, its inner end a little lower
          P3(sd * 0.033, 0.0355, 0.0875);
          _d.copy(hr).multiplyScalar(sd).addScaledVector(hu, 0.13).normalize();
          _x.copy(hu).addScaledVector(_d, -hu.dot(_d)).normalize();
          p.sphere.push(framed(_c, _d, _x, hf, hs * 0.019, hs * 0.0042, hs * 0.0055), browC, own, id(), ind);
        }
        if (shades) {
          P3(0, 0.019, 0.092);
          p.boxP.push(framed(_c, hr, hu, hf, hs * 0.118, hs * 0.024, hs * 0.008), linC(SHADES), own, id(), ind);
        }
        P3(0, -0.0525, 0.1);
        p.boxP.push(framed(_c, hr, hu, hf, hs * 0.036, hs * 0.0024, hs * 0.006), linC(LIPS_M), own, id(), ind);
      }
    }
    // ---- a hat, what he holds (the rig's own shapes; his hair is his own, above)
    const shapes = fig.shapes;
    for (let i = fig.dressFrom || 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (!s.dress || s.hairCut || P[s.part === 'pelvis' ? 'pelvis' : s.part] < 0.5) continue;
      const col = linC(s.col);
      if (s.type === 0) capsuleTo(p, _a.copy(s.c).sub(s.y), _b.copy(s.c).add(s.y), s.x.x, col, own, id(), ind, rgt, s.clip);
      else {
        _m.set(s.x.x, s.y.x, s.z.x, s.c.x, s.x.y, s.y.y, s.z.y, s.c.y, s.x.z, s.y.z, s.z.z, s.c.z, 0, 0, 0, 1);
        (s.gloss ? p.sphereGloss : p.sphere).push(_m, col, own, id(), ind, s.clip);
      }
    }
  }

  // (v5) A person in the simple shapes, on their own rig: their pose, what they wear and what they
  // hold, as drawFull draws them, without the little things of a face. In the picture too when far
  // away (aux false); for somebody drawn in full, only in the sun's view and the mirror (aux true:
  // what is drawn everywhere anyway, the shared shapes, is not drawn again)
  drawLow(fig, aux) {
    const L = fig.look;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
    const S = fig.scale;
    const k = S * 0.98;
    const bulk = fig.bulk;
    const seed = (fig.seed % 1) * 0.37 + 0.11;
    _part[0] = seed;
    const id = nextPart;
    const ax = fig.ax;
    const rgt = fig.brgt;
    const fwd = fig.bfwd;
    const top = L.top;
    const bot = L.bottom;
    const skin = linC(L.skin);
    let topCol = top.color;
    if (fig.paintT > 0) {
      const t = Math.min(1, fig.paintT / 2.5) * 0.7;
      topCol = topCol.map((v, i) => v + (fig.paintColor[i] - v) * t);
    }
    const topC = linC(topCol);
    const botC = linC(bot.color);
    const longSkirt = bot.kind === 'skirt' || bot.kind === 'dress' || top.kind === 'dress';
    const midi = bot.kind === 'midi';
    const skirtC = top.kind === 'dress' ? topC : botC;
    const bootC = linC(L.boots || L.shoes);
    const tee = top.kind === 'tee' || top.kind === 'tank' || top.kind === 'polo';
    const sleeves = top.sleeves || (tee ? 'short' : 'long');
    const cargo = bot.kind === 'baggy' || bot.kind === 'cargo';
    const wide = bot.kind === 'wide';
    const shorts = bot.kind === 'shorts';
    const open = OPEN.has(top.kind);
    const puffy = top.kind === 'puffer';
    const br = Math.max(0.9, bulk * 0.96) * (puffy ? 1.14 : 1);
    fig.headId = (seed * 7.77 + 0.31) % 1;

    // ---- the torso and the hips
    if (P.torso > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.04 * S);
      const len = Math.max(0.2, _b.subVectors(j.neck, _a).length());
      const sy = len / 0.5;
      const pool = tee && top.kind !== 'tank' ? p.lowTorsoTeeBoxy : open || top.kind === 'hoodie' || top.kind === 'track' || top.kind === 'sweatshirt' ? p.lowTorsoBoxy : p.lowTorsoPlain;
      const w = (L.fem ? 0.95 : 1.05) * br * k;
      pool.put(aux, framed(_a, rgt, ax, fwd, w, sy, w * (L.fem ? 1.05 : 1)), topC, own, id(), ind);
      if (open) {
        if (!aux) {
          const inC = linC(top.shirt || top.inner || [0.92, 0.92, 0.9]);
          _c.lerpVectors(j.hip, j.neck, 0.62).addScaledVector(fwd, 0.118 * br * S);
          p.boxP.push(framed(_c, rgt, ax, fwd, (top.kind === 'suit' ? 0.07 : 0.1) * S, 0.34 * S, 0.012 * S), inC, own, id(), ind);
          if (top.tie) {
            _c.copy(j.neck).lerp(j.hip, 0.3).addScaledVector(fwd, 0.13 * br * S);
            p.boxP.push(framed(_c, rgt, ax, fwd, 0.028 * S, 0.2 * S, 0.012 * S), linC(top.tie), own, id(), ind);
          }
        }
        if ((top.kind === 'trench' || top.kind === 'coat') && P.pelvis > 0.5 && fig.sit < 0.3) {
          _c.copy(j.hip).addScaledVector(ax, 0.06 * S);
          const sw = Math.sin(fig.phase) * 0.05 * Math.min(1, fig.speed / 1.4);
          _d.copy(fwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
          p.lowCoatSkirt.put(aux, framed(_c, rgt, _d, _x.crossVectors(rgt, _d), k * br, k, k * br), topC, own, id(), ind);
        }
      }
      _c.copy(j.headC).addScaledVector(fig.hu, -0.06 * S);
      p.lowNeck.put(aux, along(_c, j.neck, 0.13, k * 1.18 * Math.max(1, bulk * 0.9), rgt), skin, own, fig.headId, ind);
    }
    if (P.pelvis > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.02 * S);
      p.lowPelvis.put(aux, framed(_a, rgt, ax, fwd, k * bulk * (L.fem ? 1.06 : 1), k, k * bulk), longSkirt ? skirtC : botC, own, id(), ind);
      if (midi && P.torso > 0.5 && fig.sit < 0.3) {
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        const sw = Math.sin(fig.phase) * 0.06 * Math.min(1, fig.speed / 1.4);
        _c.copy(fwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
        p.lowMidi.put(aux, framed(_a, rgt, _c, _d.crossVectors(rgt, _c), k * bulk, k * (1 - fig.crouch * 0.4), k * bulk), botC, own, id(), ind);
      }
      if (longSkirt && P.torso > 0.5) {
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        const kk = k * bulk;
        if (fig.sit < 0.3) {
          const sw = Math.sin(fig.phase) * 0.05 * Math.min(1, fig.speed / 1.4);
          _c.copy(fwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
          p.lowSkirt.put(aux, framed(_a, rgt, _c, _d.crossVectors(rgt, _c), kk, k * (1 - fig.crouch * 0.4), kk), skirtC, own, id(), ind);
        } else {
          p.lowSkirt.put(aux, framed(_a, rgt, ax, fwd, kk, k * 0.32, kk), skirtC, own, id(), ind);
          if (!aux) {
            _c.lerpVectors(j.kneeL, j.kneeR, 0.5);
            _d.lerpVectors(j.footL, j.footR, 0.5);
            _b.copy(j.hip).addScaledVector(fwd, 0.04 * S);
            capsuleTo(p, _b, _c, 0.19 * kk, skirtC, own, id(), ind, rgt);
            capsuleTo(p, _c, _d, 0.17 * kk, skirtC, own, id(), ind, rgt);
          }
        }
      }
    }
    // ---- arms
    const arms = fig._armJ || (fig._armJ = [[j.shoulderR, j.elbowR, j.handR], [j.shoulderL, j.elbowL, j.handL]]);
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1) * (puffy ? 1.3 : open ? 1.08 : 1);
    for (let ai = 0; ai < 2; ai++) {
      if (P[ARM_PART[ai]] < 0.5) continue;
      const sh = arms[ai][0];
      const el = arms[ai][1];
      const hd = arms[ai][2];
      const shortS = sleeves === 'short' && !L.fem;
      const noS = sleeves === 'none' && !L.fem;
      const upperSkin = shortS || noS;
      const armId = id();
      (upperSkin ? p.lowUpperSkin : p.lowUpper).put(aux, along(sh, el, 0.29, armK, fwd), upperSkin ? skin : topC, own, armId, ind);
      if (shortS) p.lowSleeve.put(aux, along(sh, el, 0.29, armK * 0.98, fwd, _m), topC, own, id(), ind);
      const foreSkin = shortS || noS || L.rolled || top.rolled;
      (foreSkin ? p.lowForeSkin : p.lowFore).put(aux, along(el, hd, 0.26, armK, fwd), foreSkin ? skin : topC, own, foreSkin === upperSkin ? armId : id(), ind);
      _c.subVectors(hd, el).normalize();
      _d.copy(hd).addScaledVector(_c, 0.035 * S);
      p.lowHand.put(aux, along(_d, _a.copy(_d).addScaledVector(_c, 0.05), 0.05, k, fwd), skin, own, id(), ind);
    }
    // ---- legs
    const legs = fig._legJ || (fig._legJ = [[j.hipR, j.kneeR, j.footR, j.toeR], [j.hipL, j.kneeL, j.footL, j.toeL]]);
    const legK = k * Math.max(1, bulk * 0.9) * (fig.limbs || 1);
    const shoeC = linC(L.shoes);
    for (let li = 0; li < 2; li++) {
      if (P[LEG_PART[li]] < 0.5) continue;
      const hp = legs[li][0];
      const kn = legs[li][1];
      const ft = legs[li][2];
      const to = legs[li][3];
      const legId = id();
      if (midi) {
        if (fig.sit > 0.3 || fig.crawl > 0.3 || fig.dead > 0.3) p.lowThigh.put(aux, along(hp, kn, 0.45, legK * 1.15, fwd), botC, own, legId, ind);
        p.lowShin.put(aux, along(kn, ft, 0.43, legK * 1.06, fwd), bootC, own, id(), ind);
      } else if (!longSkirt || fig.sit > 0.3 || fig.crawl > 0.3 || fig.dead > 0.3) {
        (wide ? p.lowThighWide : cargo ? p.lowThighCargo : p.lowThigh).put(aux, along(hp, kn, 0.45, legK, fwd), longSkirt ? skirtC : botC, own, legId, ind);
        (shorts ? p.lowShinSkin : wide ? p.lowShinWide : cargo ? p.lowShinCargo : p.lowShin).put(aux, along(kn, ft, 0.43, legK, fwd), shorts ? skin : longSkirt ? skirtC : botC, own, shorts ? id() : legId, ind);
      }
      _z.subVectors(to, ft);
      _z.y = 0;
      if (_z.lengthSq() < 1e-6) _z.copy(fwd);
      _z.normalize();
      _x.crossVectors(UP, _z).normalize();
      _c.copy(ft).addScaledVector(_z, 0.05 * S);
      _c.y = Math.max(_c.y - 0.02 * S, fig.pos.y + 0.035);
      p.lowShoe.put(aux, framed(_c, _x, UP, _z, k, k, k), shoeC, own, id(), ind);
    }
    // ---- the head (no face: smaller than a pixel from where this is drawn)
    if (P.head > 0.5) {
      const hs = fig.headScale * S;
      const hc = j.headC;
      const hr = fig.hr;
      const hu = fig.hu;
      const hf = fig.hf;
      p.lowHead.put(aux, framed(hc, hr, hu, hf, 1.0 * hs * 0.98, 1.14 * hs * 1.0, 1.0 * hs * 1.06), skin, own, fig.headId, ind);
      _c.copy(hc).addScaledVector(hu, -0.065 * hs).addScaledVector(hf, 0.03 * hs);
      p.lowJaw.put(aux, framed(_c, hr, hu, hf, hs * 1.05, hs, hs * 1.05), skin, own, fig.headId, ind);
    }
    // ---- hair, hats, beards, held things: the rig's own shapes (its capsules are shared)
    const shapes = fig.shapes;
    for (let i = fig.dressFrom || 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (!s.dress || P[s.part === 'pelvis' ? 'pelvis' : s.part] < 0.5) continue;
      if (s.type === 0) {
        if (!aux) capsuleTo(p, _a.copy(s.c).sub(s.y), _b.copy(s.c).add(s.y), s.x.x, linC(s.col), own, id(), ind, rgt, s.clip);
      } else {
        _m.set(s.x.x, s.y.x, s.z.x, s.c.x, s.x.y, s.y.y, s.z.y, s.c.y, s.x.z, s.y.z, s.z.z, s.c.z, 0, 0, 0, 1);
        p.lowSphere.put(aux, _m, linC(s.col), own, id(), ind, s.clip);
      }
    }
  }
}

// a capsule from a to b, radius r: a tube and two balls
const _q = new THREE.Vector3();
const _w = new THREE.Vector3();
const _mc = new THREE.Matrix4();
// (v5, ROADMAP 11.29) the hero drawn with more care than the passers-by. His jacket: the lapels
// laid back from the collar in a V, a strong shoulder line, the zip's metal down both front edges,
// slanted pockets at the hips. (Drawn in the same pens as everyone, so he is of the same world.)
const ZIP = lin3(0.62, 0.58, 0.5);
const _hc = new THREE.Vector3();
const _hr = new THREE.Vector3();
const _hu = new THREE.Vector3();
function heroFadeC(fig, hairC, skin) {
  if (fig._hfOf !== hairC || fig._hfSk !== skin) {
    fig._hfOf = hairC;
    fig._hfSk = skin;
    fig._hfC = [hairC[0] * 0.55 + skin[0] * 0.45, hairC[1] * 0.55 + skin[1] * 0.45, hairC[2] * 0.55 + skin[2] * 0.45];
  }
  return fig._hfC;
}
function heroDark(fig, topC) {
  if (fig._hjOf !== topC) {
    fig._hjOf = topC;
    fig._hjDark = [topC[0] * 0.62, topC[1] * 0.62, topC[2] * 0.62];
  }
  return fig._hjDark;
}
function heroJacket(p, fig, j, rgt, ax, fwd, S, br, front, topC, own, id, ind) {
  const dark = heroDark(fig, topC);
  for (let sd = -1; sd <= 1; sd += 2) {
    // a lapel: from the collar, out at the shoulder, down to the middle of the chest
    _hc.lerpVectors(j.hip, j.neck, 0.79).addScaledVector(rgt, sd * 0.062 * br * S).addScaledVector(fwd, front + 0.006 * S);
    _hu.copy(ax).addScaledVector(rgt, sd * 0.36).normalize();
    _hr.crossVectors(_hu, fwd).normalize();
    p.boxP.push(framed(_hc, _hr, _hu, fwd, 0.052 * S, 0.17 * S, 0.016 * S), topC, own, id(), ind);
    // the zip down the front edge
    _hc.lerpVectors(j.hip, j.neck, 0.43).addScaledVector(rgt, sd * 0.054 * S).addScaledVector(fwd, front + 0.004 * S);
    p.boxP.push(framed(_hc, rgt, ax, fwd, 0.009 * S, 0.26 * S, 0.012 * S), ZIP, own, id(), ind);
    // a slanted pocket at the hip
    _hc.lerpVectors(j.hip, j.neck, 0.16).addScaledVector(rgt, sd * 0.105 * br * S).addScaledVector(fwd, front - 0.004 * S);
    _hr.copy(rgt).addScaledVector(ax, sd * 0.7).normalize();
    _hu.crossVectors(fwd, _hr).normalize();
    p.boxP.push(framed(_hc, _hr, _hu, fwd, 0.085 * S, 0.014 * S, 0.022 * S), dark, own, id(), ind);
    // the shoulder: the jacket's seam set square over the arm
    _hc.copy(sd > 0 ? j.shoulderR : j.shoulderL).addScaledVector(ax, 0.012 * S);
    p.sphere.push(framed(_hc, rgt, ax, fwd, 0.066 * br * S, 0.05 * S, 0.068 * br * S), topC, own, id(), ind);
  }
}

function capsuleTo(p, a, b, r, col, own, part, ind, side, clip = null) {
  _q.subVectors(b, a);
  const L = _q.length();
  if (L > 1e-4) {
    _q.divideScalar(L);
    _w.copy(side).addScaledVector(_q, -side.dot(_q));
    if (_w.lengthSq() < 1e-6) _w.set(1, 0, 0);
    _w.normalize();
    const zx = _w.y * _q.z - _w.z * _q.y;
    const zy = _w.z * _q.x - _w.x * _q.z;
    const zz = _w.x * _q.y - _w.y * _q.x;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const cz = (a.z + b.z) / 2;
    _mc.set(_w.x * r, _q.x * L, zx * r, cx, _w.y * r, _q.y * L, zy * r, cy, _w.z * r, _q.z * L, zz * r, cz, 0, 0, 0, 1);
    p.tube.push(_mc, col, own, part, ind, clip);
  }
  _mc.makeScale(r, r, r).setPosition(a);
  p.ball.push(_mc, col, own, part, ind, clip);
  _mc.makeScale(r, r, r).setPosition(b);
  p.ball.push(_mc, col, own, part, ind, clip);
}

export { srgb };
