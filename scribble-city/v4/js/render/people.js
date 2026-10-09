import * as THREE from 'three';
import { makeSurface, srgb, shared, canvasTexture, lin3, mergedSurface, penRow, penPictures } from './materials.js';
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

function skirtGeo(top, bottom, len, gap = 0) {
  const pts = [new THREE.Vector2(top, 0.02), new THREE.Vector2(top * 1.05, -len * 0.15), new THREE.Vector2(bottom * 0.92, -len * 0.75), new THREE.Vector2(bottom, -len)];
  // (gap: an opening at the front, like a coat's)
  const g = new THREE.LatheGeometry(pts, 16, gap / 2, Math.PI * 2 - gap);
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

// ------------------------------------------------------------------ the shapes, in one texture
// Every kind of part is a row of one texture (two texels a point: position and u, normal and v),
// and the whole crowd is drawn in a few draws: an instance says which shape it is, how many points
// it has, which pen draws it, and what it is left out of. Shapes go to the class of their size (a
// shape with fewer points than its class leaves the rest of them empty) and of their side (a
// coat's skirts are seen from inside too).
const CLASS_SIZES = [60, 300, 504, 1020, 1404];
// left out of: the wet street's mirror (1), the sun's view (2)
const NO_MIRROR = 1;
const NO_SUN = 2;

class DrawClass {
  constructor(scene, verts, mat, cap) {
    this.cap = cap;
    this.verts = verts;
    const g = new THREE.BufferGeometry();
    // (the points come from the shapes' texture: these only say how many)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
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
    scene.add(this.mesh);
    this.n = 0;
  }

  push(sh, m, color, owner, part, indoor, clip) {
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
    this.n = 0;
  }
}

// one kind of part: its row in the shapes' texture, its pen, its class
class Shape {
  constructor(geo, pen, cap) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    this.geo = g;
    this.count = g.attributes.position.count;
    this.penMat = pen;
    this.pen = 0;
    this.cap = cap;
    this.row = 0;
    this.flags = 0;
    this.cls = null;
  }

  push(m, color, owner, part, indoor = 0, clip = null) {
    return this.cls.push(this, m, color, owner, part, indoor, clip);
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

const SOLE = [0.95, 0.95, 0.93];
const EYE_WHITE = [0.96, 0.95, 0.92];
const PUPIL = [0.06, 0.05, 0.08];
const MASK_EYE = [0.95, 0.92, 0.85];
const BROW_BALD = [0.2, 0.16, 0.14];
const LIPS_F = [0.72, 0.3, 0.34];
const LIPS_M = [0.45, 0.22, 0.22];

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
      // the shapes of hair, hats and the things people hold (ellipsoids and capsules)
      sphere: P(new THREE.SphereGeometry(1, 14, 10), M.hair, 2048),
      sphereGloss: P(new THREE.SphereGeometry(1, 12, 8), M.gloss, 256),
      tube: P(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), M.hair, 1024),
      ball: P(new THREE.SphereGeometry(1, 10, 6), M.hair, 2048),
      boxP: P(new THREE.BoxGeometry(1, 1, 1), M.box, 512),
    };
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
    // the classes: by side, then by size
    this.classes = [];
    const groups = new Map();
    for (const sh of shapes) {
      const side = sh.penMat === M.coat ? 'back' : 'front';
      const size = CLASS_SIZES.find((n) => n >= sh.count) || sh.count;
      const key = `${side}:${size}`;
      if (!groups.has(key)) groups.set(key, { side, size, list: [] });
      groups.get(key).list.push(sh);
    }
    for (const { side, size, list } of groups.values()) {
      const cap = list.reduce((a, sh) => a + sh.cap, 0);
      const cls = new DrawClass(scene, size, side === 'back' ? back : front, cap);
      for (const sh of list) sh.cls = cls;
      this.classes.push(cls);
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
    capsuleTo(this.p, a, b, Math.max(0.003, r), linC(col), fig.owner + 1, (fig.seed * 0.13 + 0.5) % 1, fig.indoor ? 1 : 0, fig.brgt);
  }

  end() {
    for (const c of this.classes) c.end();
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
      const w = (L.fem ? 0.95 : 1.05) * br * k;
      pool.push(framed(_a, rgt, ax, fwd, w, sy, w * (L.fem ? 1.05 : 1)), topC, own, id(), ind);
      // a jacket's open front over the shirt or the tee under it, a suit's tie
      if (open) {
        const inC = linC(top.shirt || top.inner || [0.92, 0.92, 0.9]);
        _c.lerpVectors(j.hip, j.neck, 0.62).addScaledVector(fwd, 0.118 * br * S);
        p.boxP.push(framed(_c, rgt, ax, fwd, (top.kind === 'suit' ? 0.07 : 0.1) * S, 0.34 * S, 0.012 * S), inC, own, id(), ind);
        if (top.tie) {
          _c.copy(j.neck).lerp(j.hip, 0.3).addScaledVector(fwd, 0.13 * br * S);
          p.boxP.push(framed(_c, rgt, ax, fwd, 0.028 * S, 0.2 * S, 0.012 * S), linC(top.tie), own, id(), ind);
        }
        // the collar standing round the neck
        _c.copy(j.neck).addScaledVector(ax, -0.01 * S);
        p.collar.push(framed(_c, rgt, ax, fwd, k * br, k, k * br * 0.95), topC, own, id(), ind);
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
    const arms = [
      ['armR', j.shoulderR, j.elbowR, j.handR, 1],
      ['armL', j.shoulderL, j.elbowL, j.handL, -1],
    ];
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1) * (puffy ? 1.3 : open ? 1.08 : 1);
    for (const [pn, sh, el, hd] of arms) {
      if (P[pn] < 0.5) continue;
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
      p.jaw.push(framed(_c, hr, hu, hf, hs * 1.05, hs, hs * 1.05), skin, own, headId, ind);
      if (!far) {
        for (const sd of [-1, 1]) {
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
        for (const sd of [-1, 1]) {
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
            p.brow.push(framed(_c, _d, _x, hf, hs * (L.fem ? 0.9 : 1.05), hs * (L.fem ? 0.8 : 1.15), hs), browC, own, id(), ind);
          }
        }
        if (!masked) {
          _c.copy(hc).addScaledVector(hu, -0.012 * hs).addScaledVector(hf, 0.104 * hs);
          p.nose.push(framed(_c, hr, hu, hf, hs, hs, hs), skin, own, headId, ind);
          _c.copy(hc).addScaledVector(hu, -0.056 * hs).addScaledVector(hf, 0.094 * hs);
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
