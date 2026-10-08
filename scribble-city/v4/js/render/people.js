import * as THREE from 'three';
import { makeSurface, srgb, shared, canvasTexture, lin3 } from './materials.js';
import { MAX_HOLES, MAX_OWNERS } from './glsl.js';

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
function limb(r0, r1, len, segs = 10) {
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (1 - i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r0), Math.sin(a) * r0));
  }
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, -t * len));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (Math.PI / 2) * (i / 4);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r1), -len - Math.sin(a) * r1));
  }
  return new THREE.LatheGeometry(pts, segs);
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

function skirtGeo(top, bottom, len) {
  const pts = [new THREE.Vector2(top, 0.02), new THREE.Vector2(top * 1.05, -len * 0.15), new THREE.Vector2(bottom * 0.92, -len * 0.75), new THREE.Vector2(bottom, -len)];
  const g = new THREE.LatheGeometry(pts, 16);
  g.scale(1, 1, 0.8);
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

class Pool {
  constructor(scene, geo, mat, cap = 512) {
    this.cap = cap;
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.aId) g.setAttribute('aId', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    this.iX = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iClip = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', this.iClip);
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.userData.dynamic = true;
    scene.add(this.mesh);
    this.n = 0;
  }

  push(m, color, owner, part, indoor = 0, clip = null) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    m.toArray(this.mesh.instanceMatrix.array, i * 16);
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
    return i;
  }

  end() {
    this.mesh.count = this.n;
    const n = Math.max(1, this.n);
    for (const at of [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX, this.iClip]) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, n * at.itemSize);
      at.needsUpdate = true;
    }
    this.n = 0;
  }
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

const L3 = (c) => lin3(c[0], c[1], c[2]);
const lc = new Map();
function linC(c) {
  // (colours of looks are sRGB arrays; cached by value)
  const key = `${c[0].toFixed(3)},${c[1].toFixed(3)},${c[2].toFixed(3)}`;
  let v = lc.get(key);
  if (!v) {
    v = L3(c);
    lc.set(key, v);
  }
  return v;
}

export class PersonRenderer {
  constructor(scene) {
    this.scene = scene;
    const S = (o) => makeSurface({ ...o });
    // the pens of the people (the first boulevard's): skin, cloth with folds, plain cloth, shoes
    this.mats = {
      skin: S({ kind: 'skin', partR: 0.06 }),
      tee: S({ kind: 'cyl', map: folds('tee'), partR: 0.16 }),
      shirt: S({ kind: 'cyl', map: folds('shirt'), partR: 0.16 }),
      cargo: S({ kind: 'cyl', map: folds('cargo'), partR: 0.09 }),
      skirt: S({ kind: 'cyl', map: folds('skirt'), partR: 0.25 }),
      plain: S({ kind: 'cyl', map: folds('plain'), partR: 0.09 }),
      hair: S({ kind: 'cyl', partR: 0.1 }),
      box: S({ kind: 'box' }),
      gloss: S({ kind: 'paint', partR: 0.05, gloss: 0.8 }),
      dark: S({ kind: 'box' }),
    };
    for (const m of Object.values(this.mats)) m.vertexColors = false;
    const P = (geo, mat, n = 512) => new Pool(scene, geo, mat, n);
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
      foreSkin: P(limb(0.045, 0.034, 0.26), M.skin),
      foreShirt: P(limb(0.045, 0.034, 0.26), M.shirt),
      sleeveTee: P(limb(0.085, 0.078, 0.21), M.tee),
      ballTee: P(new THREE.SphereGeometry(0.07, 12, 8), M.tee),
      hand: P(new THREE.SphereGeometry(0.05, 10, 8).scale(0.75, 1.3, 0.6), M.skin),
      thigh: P(limb(0.082, 0.064, 0.45), M.plain),
      thighCargo: P(limb(0.1, 0.082, 0.45), M.cargo),
      thighSkin: P(limb(0.082, 0.064, 0.45), M.skin),
      shin: P(limb(0.062, 0.05, 0.43), M.plain),
      shinCargo: P(limb(0.082, 0.078, 0.43), M.cargo),
      shinSkin: P(limb(0.062, 0.05, 0.43), M.skin),
      pocket: P(new THREE.BoxGeometry(0.06, 0.12, 0.1), M.cargo),
      shoe: P(new THREE.CapsuleGeometry(0.052, 0.15, 4, 10).rotateX(Math.PI / 2).scale(1, 0.72, 1), M.box),
      sole: P(new THREE.BoxGeometry(0.105, 0.025, 0.26), M.box),
      neck: P(cap(0.05, 0.13), M.skin),
      head: P(new THREE.SphereGeometry(0.1, 18, 14), M.skin),
      jaw: P(new THREE.SphereGeometry(0.075, 12, 8).scale(1, 0.8, 1.05), M.skin),
      ear: P(new THREE.SphereGeometry(0.025, 8, 6).scale(0.5, 1, 0.8), M.skin),
      eye: P(new THREE.SphereGeometry(0.012, 6, 4), M.dark),
      skirt: P(skirtGeo(0.17, 0.3, 0.86), M.skirt),
      // the shapes of hair, hats and the things people hold (ellipsoids and capsules)
      sphere: P(new THREE.SphereGeometry(1, 14, 10), M.hair, 2048),
      sphereGloss: P(new THREE.SphereGeometry(1, 12, 8), M.gloss, 256),
      tube: P(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), M.hair, 1024),
      ball: P(new THREE.SphereGeometry(1, 10, 6), M.hair, 2048),
      boxP: P(new THREE.BoxGeometry(1, 1, 1), M.box, 512),
    };
    // eraser holes and fading per person
    this.owners = new Array(MAX_OWNERS).fill(false);
    this.holeTex = shared.uHoles.value;
    this.dirty = false;
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

  // a pen line of the old notebook, as a thin rod (a cane, an umbrella's pole, a gold chain)
  rod(a, b, r, col, fig) {
    capsuleTo(this.p, a, b, Math.max(0.003, r), linC(col), fig.owner + 1, (fig.seed * 0.13 + 0.5) % 1, fig.indoor ? 1 : 0, fig.brgt);
  }

  end() {
    for (const p of Object.values(this.p)) p.end();
    if (this.dirty) {
      this.holeTex.needsUpdate = true;
      this.dirty = false;
    }
  }

  // ------------------------------------------------------------------ one person
  // fig: a Doodle (its joints, its look, its body frames); near: how close to the camera
  draw(fig, camDist) {
    const L = fig.look;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor ? 1 : 0;
    const S = fig.scale;
    const k = S * 0.98;
    const bulk = fig.bulk;
    const seed = (fig.seed % 1) * 0.37 + 0.11;
    let part = seed;
    const id = () => (part = (part + 0.1173) % 1);
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
    const skirtC = top.kind === 'dress' ? topC : botC;
    const tee = top.kind === 'tee' || top.kind === 'tank';
    const sleeves = top.sleeves || (tee ? 'short' : 'long');
    const cargo = bot.kind === 'baggy' || bot.kind === 'cargo';
    const shorts = bot.kind === 'shorts';
    const br = Math.max(0.9, bulk * 0.96);

    // ---- the torso and the hips
    if (P.torso > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.04 * S);
      const len = Math.max(0.2, _b.subVectors(j.neck, _a).length());
      const sy = len / 0.5;
      const pool = tee && top.kind !== 'tank' ? p.torsoTee : top.kind === 'shirt' || top.kind === 'blouse' || top.kind === 'dress' ? p.torsoFit : top.kind === 'hoodie' || top.kind === 'jacket' || top.kind === 'suit' || top.kind === 'blazer' || top.kind === 'track' ? p.torsoBoxy : p.torsoPlain;
      const w = (L.fem ? 0.95 : 1.05) * br * k;
      pool.push(framed(_a, rgt, ax, fwd, w, sy, w * (L.fem ? 1.05 : 1)), topC, own, id(), ind);
      // a jacket's open front, a suit's shirt and tie
      if (top.kind === 'suit' || top.kind === 'blazer' || top.kind === 'jacket') {
        _c.lerpVectors(j.hip, j.neck, 0.7).addScaledVector(fwd, 0.118 * bulk * S);
        p.boxP.push(framed(_c, rgt, ax, fwd, 0.07 * S, 0.24 * S, 0.012 * S), linC(top.shirt || top.inner || [0.92, 0.92, 0.9]), own, id(), ind);
        if (top.tie) {
          _c.addScaledVector(fwd, 0.01 * S).addScaledVector(ax, -0.02 * S);
          p.boxP.push(framed(_c, rgt, ax, fwd, 0.028 * S, 0.2 * S, 0.012 * S), linC(top.tie), own, id(), ind);
        }
      }
      // the neck
      _c.copy(j.headC).addScaledVector(fig.hu, -0.06 * S);
      p.neck.push(along(_c, j.neck, 0.13, k * Math.max(1, bulk * 0.9), rgt), skin, own, id(), ind);
    }
    if (P.pelvis > 0.5) {
      _a.copy(j.hip).addScaledVector(ax, 0.02 * S);
      const pc = longSkirt ? skirtC : botC;
      (longSkirt ? p.pelvisSkirt : cargo ? p.pelvis : p.pelvis).push(framed(_a, rgt, ax, fwd, k * bulk * (L.fem ? 1.06 : 1), k, k * bulk), pc, own, id(), ind);
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
    const arms = [
      ['armR', j.shoulderR, j.elbowR, j.handR, 1],
      ['armL', j.shoulderL, j.elbowL, j.handL, -1],
    ];
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1);
    for (const [pn, sh, el, hd] of arms) {
      if (P[pn] < 0.5) continue;
      const shortS = sleeves === 'short' && !L.fem;
      const noS = sleeves === 'none' && !L.fem;
      const upperSkin = shortS || noS;
      (upperSkin ? p.upperSkin : p.upperShirt).push(along(sh, el, 0.29, armK, fwd), upperSkin ? skin : topC, own, id(), ind);
      if (shortS) {
        p.sleeveTee.push(along(sh, el, 0.29, armK * 0.98, fwd, _m), topC, own, id(), ind);
        // (the sleeve reaches a bit more than half way)
        p.ballTee.push(framed(sh, rgt, ax, fwd, armK * br, armK * br, armK * br), topC, own, id(), ind);
      }
      const foreSkin = shortS || noS || L.rolled || top.rolled;
      (foreSkin ? p.foreSkin : p.foreShirt).push(along(el, hd, 0.26, armK, fwd), foreSkin ? skin : topC, own, id(), ind);
      _c.subVectors(hd, el).normalize();
      _d.copy(hd).addScaledVector(_c, 0.035 * S);
      p.hand.push(along(_d, _a.copy(_d).addScaledVector(_c, 0.05), 0.05, k, fwd), skin, own, id(), ind);
    }
    // ---- legs
    const legs = [
      ['legR', j.hipR, j.kneeR, j.footR, j.toeR, 1],
      ['legL', j.hipL, j.kneeL, j.footL, j.toeL, -1],
    ];
    const legK = k * Math.max(1, bulk * 0.9) * (fig.limbs || 1);
    const shoeC = linC(L.shoes);
    for (const [pn, hp, kn, ft, to, sx] of legs) {
      if (P[pn] < 0.5) continue;
      if (!longSkirt || fig.sit > 0.3 || fig.crawl > 0.3 || fig.dead > 0.3) {
        (cargo ? p.thighCargo : p.thigh).push(along(hp, kn, 0.45, legK, fwd), longSkirt ? skirtC : botC, own, id(), ind);
        if (cargo && !far) {
          _c.lerpVectors(hp, kn, 0.55).addScaledVector(rgt, sx * 0.085 * S);
          p.pocket.push(framed(_c, rgt, _d.subVectors(hp, kn).normalize(), fwd, k, k, k), botC, own, id(), ind);
        }
        (shorts ? p.shinSkin : cargo ? p.shinCargo : p.shin).push(along(kn, ft, 0.43, legK, fwd), shorts ? skin : longSkirt ? skirtC : botC, own, id(), ind);
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
      if (!far) {
        _c.y -= 0.032 * S;
        p.sole.push(framed(_c, _x, UP, _z, k, k, k), linC([0.95, 0.95, 0.93]), own, id(), ind);
      }
    }
    // ---- the head (the first boulevard's: a skull, a jaw, ears, two eyes)
    if (P.head > 0.5) {
      const hs = fig.headScale * S;
      const hc = j.headC;
      const hr = fig.hr;
      const hu = fig.hu;
      const hf = fig.hf;
      p.head.push(framed(hc, hr, hu, hf, 1.0 * hs * 1.06, 1.14 * hs * 1.06, 1.0 * hs * 1.12), skin, own, id(), ind);
      _c.copy(hc).addScaledVector(hu, -0.065 * hs).addScaledVector(hf, 0.03 * hs);
      p.jaw.push(framed(_c, hr, hu, hf, hs * 1.05, hs, hs * 1.05), skin, own, id(), ind);
      if (!far) {
        for (const sd of [-1, 1]) {
          _c.copy(hc).addScaledVector(hr, sd * 0.1 * hs).addScaledVector(hf, -0.005 * hs);
          p.ear.push(framed(_c, hr, hu, hf, hs, hs, hs), skin, own, id(), ind);
        }
        const masked = L.hat && L.hat.kind === 'skimask';
        if (!(L.face && L.face.glasses === 'shades')) {
          for (const sd of [-1, 1]) {
            _c.copy(hc).addScaledVector(hr, sd * 0.038 * hs).addScaledVector(hu, 0.02 * hs).addScaledVector(hf, 0.104 * hs);
            p.eye.push(framed(_c, hr, hu, hf, hs * (masked ? 1.3 : 1), hs * (masked ? 1.3 : 1), hs), masked ? linC([0.95, 0.92, 0.85]) : linC([0.06, 0.05, 0.08]), own, id(), ind);
          }
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
}

// a capsule from a to b, radius r: a tube and two balls
const _q = new THREE.Vector3();
const _w = new THREE.Vector3();
const _mc = new THREE.Matrix4();
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
