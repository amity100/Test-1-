import * as THREE from 'three';
import { makeSurface, srgb, shared, canvasTexture, lin3, mergedSurface, penRow, penPictures, LAYERS, sortDefines, flashLight } from './materials.js';
import { MAX_HOLES, MAX_OWNERS } from './glsl.js';
import { motion, motionRows, bindMotion, rowsOf } from './motion.js';
import * as HERO from './heroshapes.js';
import { HeroArt, FolkAtlas } from './heroart.js';
import { HeroLines } from './herolines.js';
import { FOLK, FOLK_ON, FOLK_PHONE, SKINS, hexRGB } from './folkspec.js';
import { folkBody, eyeGeo, faceEx, exprMoves, EXPR, EYE } from './folkshapes.js';
import { folkTone, folkBeard } from './folkink.js';
import { Portrait } from './portrait.js';
import { GFX } from '../core/util.js';
import { lightOf, lodLevel, LOD_HEAD, LOD_BODY } from './lod.js';

// The people of the city, drawn like everything else: a body of rounded parts under their clothes
// (the first boulevard's own people: a shaped torso, tapering limbs, a head with a jaw and ears,
// sneakers with white soles, long skirts), and whatever is on their heads or in their hands. Every
// kind of part is one batch for the whole crowd, so a hundred people cost what one does.
//
// The parts are placed from a rig's joints every frame (game/doodle.js), so every pose the game
// knows (walking, running, aiming, sitting, carrying, falling, crawling) carries over.

// ------------------------------------------------------------------ the shapes (the first boulevard's)

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
// (characters round) a neck: its points twisted and bent with the head in the graphics card - its move
// (render/neckbend.js) in its instance's iClip (render/glsl.js)
const NECK_FLAG = 8;
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

// (ROADMAP 13.7) one of the city's people being drawn: their tile in the pictures' atlases (render/
// heroart.js FolkAtlas, 1 up) and their face's moves this frame (render/folkshapes.js EXPR) - set by
// drawFolk before their parts are put down
const _fTile = [0];
const _fEw = new Float32Array(8);
// (ROADMAP 14.1) the portraits (render/portrait.js): which of the city's people are drawn near as a
// portrait is - for now one of them (FOLK 2, Sal: sixty-three, no glasses over his eyes, the years
// in his face), the prototype - and how near
const PORTRAIT_KINDS = new Set([2]);
// (characters round) every kind of the city's people drawn as a portrait near the camera - each its
// own face (?portrait=sal: Sal's alone, as before)
const portraitKind = (k) => (PORTRAIT_MODE === 'sal' ? PORTRAIT_KINDS.has(k) : k >= 0 && k < FOLK.length);
// (?portrait=off: none; ?portrait=hide: made, never shown - for the tests)
const PORTRAIT_MODE = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('portrait') : null;
// (characters round) near enough for a face to show its drawing - a face 80 pixels high on the screen
// and more (PORTRAIT_NEAR; out below 68 - no flicker at the edge). Smaller, its strokes and its eyes
// are a dark fuzz on it: the same face then in the city's way of drawing, its ink lines clear at any
// size. Coming in and going out over a quarter of a second, never a pop
// (characters round 2: out only below 60 - a face held at about the edge does not go back and forth;
// coming in and going out over two fifths of a second)
const PORTRAIT_NEAR = 80;
const PORTRAIT_FAR = 60;
const PORTRAIT_FADE = 0.4;
// (the face lab's held face - fig.__portrait - or one of the story's own people, whose face is theirs
// near or far, never handed over or faded in after a cut: fig.keepPortrait - round 14, Lily's face dark
// for a third of a second after every cut that brought her near)
const heldFace = (f) => !!(f && (f.__portrait || f.keepPortrait));
// (its own outlines inside it - round the eyes, the lips, under the jaw - from this many pixels high)
// (characters round 3: 190 drew them as dark rims and specks round the eyes of a face across the
// street - 290, where they are whole lines; out below 245)
const PORTRAIT_LINES = 290;
// (in the street too, not only the face lab's - game/facelab.js)
const PORTRAIT_STREET = true;
// (ROADMAP 14.9) a phone's: how many drawn so at once, and how many kept made
const PORTRAIT_PHONE = 3;
const PORTRAIT_PHONE_KEEP = 10;
const _mP = new THREE.Matrix4();
// (a frame framed by a body's right, up and forward is a mirror's: turned round as DrawClass.push
// turns the people's parts)
function unmirror(m) {
  const e = m.elements;
  if (e[0] * (e[5] * e[10] - e[6] * e[9]) - e[4] * (e[1] * e[10] - e[2] * e[9]) + e[8] * (e[1] * e[6] - e[2] * e[5]) < 0) {
    e[0] = -e[0];
    e[1] = -e[1];
    e[2] = -e[2];
  }
  return m;
}
// a portrait's picture of the face, flat (its colours and features alone), drawn off the game's
// thread by the same helper as everybody's pictures (render/heroworker.js)
let portraitHelper = null;
const portraitWait = new Map();
function paintPortrait(k, cb, w = 1024) {
  if (!portraitHelper) {
    portraitHelper = new Worker(window.__gameBase ? new URL('js/render/heroworker.js', window.__gameBase) : new URL('./heroworker.js', import.meta.url), { type: 'module' });
    portraitHelper.onmessage = (e) => {
      const f = portraitWait.get(e.data.folk);
      if (e.data.err) console.warn('portrait picture', e.data.err);
      // (a picture that could not be painted: none - and the painter on to the next)
      if (f && (e.data.bmp || e.data.err)) {
        portraitWait.delete(e.data.folk);
        f(e.data.bmp || null);
      }
    };
  }
  portraitWait.set(k, cb);
  portraitHelper.postMessage({ art: 'portrait', folk: k, name: 'face', i: 0, w, h: Math.round((w * 0.37) / 0.19), seed: 7, blink: false, flat: true });
}
// (a move's weight, -1..1, in a byte: 0 exactly 128)
const byteOf = (a) => Math.round(Math.max(-1, Math.min(1, a)) * 127) + 128;
// (ROADMAP 19.2, GFX.folkLod) a part in the version its person's size on the screen asks for: 0 the full shape,
// 1 and 2 the lighter ones over the same corners (render/lod.js); a part that has none is drawn as it is
const lite = (sh, lv) => (lv > 0 && sh.lods ? sh.lods[lv < sh.lods.length ? lv : sh.lods.length - 1] : sh);
// (what of the city's people may have lighter versions: their own parts, and the hands and soles of the hero's
// kind they wear - drawFolk)
const LIGHTABLE = /^folk\d+_|^(heroHandR|heroHandL|heroGripR|heroGripL|heroSole)$/;

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
    // (ROADMAP 19.8: an instance's own four numbers of each kind - iX, iClip, iS and a face's moves iE - side by side in one
    // buffer, sent up to the card in one piece a frame instead of three or four: on a phone each sending is a step of its own for the
    // browser, and the people's classes were half of the frame's. The same numbers, the same picture)
    // (phones only, GFX.on: a computer keeps its four buffers as they were)
    const expr = !!(mat.defines && mat.defines.USE_EXPR !== undefined);
    this.W = expr ? 16 : 12;
    const one = GFX.on;
    this.ib = new THREE.InstancedInterleavedBuffer(new Float32Array(one ? cap * this.W : 4), one ? this.W : 4, 1).setUsage(THREE.DynamicDrawUsage);
    const at = (o) => (one ? new THREE.InterleavedBufferAttribute(this.ib, 4, o) : new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    if (!one) this.W = 0;
    this.iX = at(0);
    this.iClip = at(4);
    this.iS = at(8);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', this.iClip);
    g.setAttribute('iS', this.iS);
    // (ROADMAP 13.7: a face's moves - the city's people's pen; two to a number, render/glsl.js)
    this.iE = null;
    if (expr) {
      this.iE = at(12);
      g.setAttribute('iE', this.iE);
    }
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
    // (one buffer, the four side by side - a phone; or each its own, o its place in each - a computer)
    const W = this.W;
    const o = W ? i * W : i * 4;
    const B = W ? this.ib.array : this.iX.array;
    const Bc = W ? B : this.iClip.array;
    const Bs = W ? B : this.iS.array;
    const oc = W ? o + 4 : o;
    const os = W ? o + 8 : o;
    B[o] = owner;
    B[o + 1] = part;
    B[o + 2] = indoor;
    B[o + 3] = 0;
    if (clip) {
      Bc[oc] = clip[0];
      Bc[oc + 1] = clip[1];
      Bc[oc + 2] = clip[2];
      Bc[oc + 3] = clip[3];
    } else Bc[oc] = Bc[oc + 1] = Bc[oc + 2] = Bc[oc + 3] = 0;
    Bs[os] = sh.row;
    Bs[os + 1] = sh.count;
    Bs[os + 2] = sh.pen;
    // (the city's people's: whose pictures, and a face's moves - ROADMAP 13.7)
    let fl = sh.flags;
    if (sh.atlas) {
      fl += 16 * _fTile[0];
      if (sh.expr && this.iE) {
        fl += 4;
        const Be = W ? B : this.iE.array;
        const oe = W ? o + 12 : o;
        for (let q = 0; q < 4; q++) Be[oe + q] = byteOf(_fEw[q * 2]) + 256 * byteOf(_fEw[q * 2 + 1]);
      }
    }
    Bs[os + 3] = fl;
    return i;
  }

  end() {
    this.mesh.count = this.n;
    // (nothing of this class on the screen: no draw call at all)
    this.mesh.visible = this.n > 0;
    const n = Math.max(1, this.n);
    // (round 22b: the list, and each attribute's range, made once - a new array and a new range object
    // each a frame, for every kind of figure, were garbage a phone stopped to sweep up)
    const ats = this._ats || (this._ats = this.W ? [this.mesh.instanceMatrix, this.mesh.instanceColor, this.ib] : [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX, this.iClip, this.iS, ...(this.iE ? [this.iE] : [])]);
    for (let i = 0; i < ats.length; i++) {
      const at = ats[i];
      const rg = at._rg || (at._rg = { start: 0, count: 0 });
      rg.start = 0;
      rg.count = n * (at.isInterleavedBuffer ? at.stride : at.itemSize);
      at.clearUpdateRanges();
      at.updateRanges.push(rg);
      at.needsUpdate = true;
    }
    if (motion.on && this.n && !this.aux) {
      this.motionBase = motionRows(this.prev, this.n);
      this.motionGen = motion.gen;
    }
    this.n = 0;
  }
}

// one kind of part: where it starts in the shapes' texture, its pen, its class
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
    // (ROADMAP 13.7: one of the city's people's - drawn with their tile of the atlases; a face that
    // moves)
    this.atlas = false;
    this.expr = false;
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

// (round 17: his fist's way on from the wrist, round the pencil - drawHero)
const _gw = new THREE.Vector3();
const _hRef = new THREE.Vector3();

// (round 20, the player's word: Danny's and Lily's legs stuck out under the car as it flew - seen from
// below, out through its floor. Sat in a car - game/traffic.js seat, the prologue's Lily - the legs are
// the car's floor's: not drawn; from its side the door hides them all the same)
function inCar(fig) {
  return !!fig.seatedAt && performance.now() - fig.seatedAt < 160;
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
const _mNk = new THREE.Matrix4();
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

// ------------------------------------------------------------------ a face (ROADMAP 13.7)
// How one of the city's people's face is this moment: its moves (render/folkshapes.js EXPR - the jaw,
// a smile, the mouth's corners down, the brows up, the brows down, each eye shut, the mouth wide)
// into _fEw, eased from what it was towards what they feel - their own look at rest (their spec's
// expr), fear running from danger (fig.mood 'scared'), pain, anger in a fight, joy dancing - with
// the words they say (fig.talk: the jaw and the lips at a speaker's pace), and blinking now and
// then. Their eyes look about: at you when you are near and in front of them, else here and there.
// Returns where (gaze: the iris's [x, y] on the ball for the lines, and its [yaw, pitch]).
const MOODS = {
  //        jaw   smile down  up    frown shutR shutL wide
  scared: [0.42, 0, 0.35, 1, 0, 0, 0, 0.25],
  hurt: [0.3, 0, 0.6, 0.2, 0.9, 0.55, 0.55, 0.15],
  angry: [0.12, 0, 0.75, 0, 1, 0.12, 0.12, 0.2],
  joy: [0.38, 1, 0, 0.35, 0, 0.15, 0.15, 0],
  sad: [0, 0, 1, 0.55, 0, 0.1, 0.1, 0],
  surprised: [0.5, 0, 0, 1, 0, 0, 0, 0],
  dead: [0.22, 0, 0.3, 0, 0, 1, 1, 0],
  // (v5, ROADMAP 18: the prologue's people as they speak - a laugh, a shout, a smirk, teasing, tender,
  // worried, pleading, shocked)
  laugh: [0.55, 1, 0, 0.45, 0, 0.42, 0.42, 0],
  shout: [0.72, 0, 0.35, 0.15, 0.95, 0.12, 0.12, 0.3],
  smirk: [0.04, 0.45, 0, 0.12, 0.1, 0.12, 0.05, 0],
  tease: [0.12, 0.75, 0, 0.5, 0, 0.3, 0.08, 0],
  tender: [0.03, 0.5, 0, 0.3, 0, 0.12, 0.12, 0],
  worried: [0.06, 0, 0.5, 0.85, 0.35, 0, 0, 0.1],
  pleading: [0.18, 0.25, 0.15, 1, 0, 0, 0, 0.15],
  shock: [0.88, 0, 0.25, 1, 0, 0, 0, 0.85],
};
const REST = { neutral: 0, soft: 0.3, half: 0.4, smile: 0.62, laugh: 0.8 };
// (ROADMAP 13.11) a line's mouth, worked out once, as people's mouths go and not a shape a letter: the
// jaw by syllables - open at each vowel, half-closing between them, shut for an m, a b, a p, at rest at
// a comma or a stop - the lips on their own track, rounded for an o, a u, a w from a sound or two
// before it (lips get ready early), spread for an e, an i; both eased from one sound into the next.
// Returns [jaw, lips] for each letter.
const V_JAW = { a: 0.5, e: 0.32, i: 0.22, o: 0.4, u: 0.2, y: 0.22 };
const V_LIP = { a: 0.04, e: 0.24, i: 0.32, o: -0.5, u: -0.72, y: 0.28 };
function mouthTrack(text, loud) {
  const n = text.length;
  const t = text.toLowerCase();
  const jaw = new Float32Array(n + 2);
  const lip = new Float32Array(n + 2);
  const shut = new Uint8Array(n + 2);
  let word = 0;
  for (let i = 0; i < n; i++) {
    const ch = t[i];
    const v = V_JAW[ch];
    if (v !== undefined) {
      // (the first vowel of a word said a little stronger; each syllable a little its own)
      const k = (word === 0 ? 1.12 : 1) * (0.9 + 0.2 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1) * (loud ? 1.35 : 1);
      jaw[i] = v * k;
      lip[i] = V_LIP[ch];
      word++;
    } else if (ch === 'm' || ch === 'b' || ch === 'p') {
      shut[i] = 1;
    } else if (ch === 'f' || ch === 'v') jaw[i] = 0.05;
    else if (ch === 'w' || ch === 'q') {
      jaw[i] = 0.1;
      lip[i] = -0.65;
    } else if (ch === 'h' || ch === 'r' || ch === 'l') jaw[i] = 0.18;
    else if (ch >= 'a' && ch <= 'z') jaw[i] = 0.1;
    else if (ch === ' ' || ch === '-' || ch === "'") {
      jaw[i] = 0.08;
      word = 0;
    } else {
      // (a comma, a stop: the mouth at rest a moment)
      jaw[i] = 0;
      word = 0;
    }
  }
  // the jaw eased across its neighbours (it goes from syllable to syllable, not letter to letter)
  const J = new Float32Array(n + 2);
  for (let i = 0; i < n; i++) J[i] = jaw[Math.max(0, i - 1)] * 0.22 + jaw[i] * 0.56 + jaw[Math.min(n - 1, i + 1)] * 0.22;
  // the lips: rounding reaches back two sounds and on one; spreading, one each way
  const L = Float32Array.from(lip);
  for (let i = 0; i < n; i++) {
    const v = lip[i];
    if (v < -0.3) {
      if (i > 1) L[i - 2] = Math.min(L[i - 2], v * 0.45);
      if (i > 0) L[i - 1] = Math.min(L[i - 1], v * 0.8);
      L[i + 1] = Math.min(L[i + 1], v * 0.7);
    } else if (v > 0.15) {
      if (i > 0 && L[i - 1] > -0.1) L[i - 1] = Math.max(L[i - 1], v * 0.5);
      if (L[i + 1] > -0.1) L[i + 1] = Math.max(L[i + 1], v * 0.5);
    }
  }
  // (shut means shut: the lips together for an m, a b, a p, whatever is round them)
  for (let i = 0; i < n; i++) if (shut[i]) J[i] = 0;
  const out = new Float32Array((n + 2) * 2);
  for (let i = 0; i < n + 2; i++) {
    out[i * 2] = J[i];
    out[i * 2 + 1] = L[i];
  }
  return out;
}
const _want = new Float32Array(8);
// (round 24) how open the mouth is at this moment of the line, from the voice's own loudness
// (game/prologue/voice.js envOf): -1 where there is none (no recording - the letters say it)
function voiceJaw(say) {
  const E = say && say.env;
  if (!E || !E.a || !E.a.length) return -1;
  const tt = (performance.now() / 1000 - say.atT) * E.rate;
  if (tt < 0) return 0;
  const i = Math.floor(tt);
  if (i >= E.a.length - 1) return i >= E.a.length + 4 ? -1 : 0;
  const f = tt - i;
  return E.a[i] + (E.a[i + 1] - E.a[i]) * f;
}
const _gaze = [0, 0, 0, 0];
// (v5, ROADMAP 18) the hero's face this moment (render/heroart.js EXPRS): his mouth open and shut with
// the words he says, at the voice's pace (the same syllables as anybody's: mouthTrack), and what he
// feels - or null, his face as it is drawn
function heroFace(fig, t) {
  const mood = fig.mood || (fig.feel && fig.feel.until > t ? fig.feel.mood : null);
  const say = fig.say;
  let jaw = -1;
  if (say && !say.done && !say.wait) {
    const n = say.text.length;
    const p = say.at + ((say.real ? performance.now() / 1000 : t) - say.atT) * say.cps;
    if (p > n + 1) say.done = true;
    else if (p >= 0) {
      const tr = say.track || (say.track = mouthTrack(say.text, say.tone === 'alarm' || say.text.indexOf('!') >= 0));
      jaw = tr[Math.min(n + 1, Math.floor(p)) * 2];
      // (round 24: the voice's own syllables, not the letters' - those trembled)
      const vj = voiceJaw(say);
      if (vj >= 0) jaw = vj * 0.62;
    }
  }
  const glad = mood === 'joy' || mood === 'laugh' || mood === 'smirk' || mood === 'tender' || mood === 'tease';
  const mad = mood === 'angry' || mood === 'shout';
  const fear = mood === 'surprised' || mood === 'scared' || mood === 'shock';
  const low = mood === 'sad' || mood === 'worried' || mood === 'hurt' || mood === 'pleading';
  if (jaw >= 0) {
    if (jaw > 0.3) return mood === 'laugh' ? 'laugh' : glad ? 'smileTalk' : mad ? 'shout' : fear ? 'surprised' : low ? 'worriedTalk' : 'talk2';
    if (jaw > 0.1) return glad ? 'smileTalk' : mad ? 'angryTalk' : low ? 'worriedTalk' : 'talk1';
  }
  if (mood === 'laugh') return 'laugh';
  if (glad) return 'smile';
  if (mood === 'shout') return 'shout';
  if (mad) return 'angry';
  if (fear) return 'surprised';
  if (low) return 'worried';
  return null;
}
const _eyeR = new THREE.Matrix4();
const _eyeT = new THREE.Matrix4();
const _eyeM = new THREE.Matrix4();
const _eyeE = new THREE.Euler();
function faceOf(fig, F, t, cam) {
  let st = fig._face;
  if (!st) {
    st = fig._face = { w: new Float32Array(8), last: t, blinkAt: t + 0.5 + Math.random() * 3, blinkT: -1, yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, glanceAt: t + Math.random() * 2, talkPh: Math.random() * 9 };
  }
  const dt = Math.min(0.1, Math.max(0, t - st.last));
  st.last = t;
  // what they feel
  _want.fill(0);
  const rest = REST[F.spec.expr] || 0;
  _want[1] = rest;
  // (what they feel: what is happening to them, else what they are saying - game/voices.js say)
  let mood = fig.mood || (fig.feel && fig.feel.until > t ? fig.feel.mood : null);
  if (fig.dead > 0) mood = 'dead';
  else if (!mood) {
    if (fig.flail > 0 || fig.armsUp > 0.3 || fig.surrender > 0) mood = 'scared';
    else if (fig.recoil > 0.2 || fig.stagger > 0) mood = 'hurt';
    else if (fig.punch >= 0 || fig.kick >= 0 || fig.guard > 0.3) mood = 'angry';
    else if (fig.dance > 0.3) mood = 'joy';
  }
  if (mood && MOODS[mood]) {
    const M = MOODS[mood];
    // (v5, round 13: a child's face startled or afraid opens its mouth a little - not a grown man's
    // gape, the lips pulled wide over the teeth: spec.moodMouthK, the feeling's jaw and wide mouth; its
    // words still move it as they do)
    const mk = F.spec.moodMouthK !== undefined ? F.spec.moodMouthK : 1;
    for (let e = 0; e < 8; e++) _want[e] = Math.max(e === 1 ? 0 : _want[e], e === 0 || e === 7 ? M[e] * mk : M[e]);
    // (no smile at rest under a feeling that has none of its own)
    if (!(M[1] > 0)) _want[1] = 0;
  }
  // (ROADMAP 13.8) the words said: each sound's mouth, read off the line at the voice's pace - the jaw
  // dropped for an a, the lips wide for an e or an i, rounded for an o or a u, shut for an m, a b or a
  // p - and the brows with what is said (a question, a shout)
  const say = fig.say;
  let saying = false;
  if (say && !say.done && mood !== 'dead') {
    // (no voice after all: the words on their own)
    if (say.wait && t - say.atT > 1.2) {
      say.wait = false;
      say.at = 0;
      say.atT = t;
    }
    const n = say.text.length;
    const p = say.wait ? -1 : say.at + ((say.real ? performance.now() / 1000 : t) - say.atT) * say.cps;
    if (p > n + 1) say.done = true;
    else if (p >= 0) {
      saying = true;
      const tr = say.track || (say.track = mouthTrack(say.text, say.tone === 'alarm' || say.text.indexOf('!') >= 0));
      const i = Math.min(n + 1, Math.floor(p));
      const j = Math.min(n + 1, i + 1);
      const f0 = p - Math.floor(p);
      // (eased from one sound into the next)
      const f = f0 * f0 * (3 - 2 * f0);
      const ja = tr[i * 2];
      const wa = tr[i * 2 + 1];
      // (round 15, the player's word: Lily's mouth hardly moved as she talked - spec.talkK, her words'
      // own mouth bigger; her startled one kept small: moodMouthK)
      const tk = F.spec.talkK || 1;
      // (round 24, the player's word: mouths that hardly moved, or only trembled - read off the letters
      // a character at a time, a mouth jumped twenty times a second. Opened now by the voice itself,
      // syllable by syllable as it is heard, a little parted all through the words; the letters only
      // shape the lips, wide or round, and that only as far as the mouth is open)
      const vj = voiceJaw(say);
      if (vj >= 0) {
        const jw = vj > 0.03 ? 0.05 + vj * 0.6 : vj * 1.5;
        _want[0] = Math.max(_want[0], Math.min(1, jw * Math.min(1.35, tk)));
        _want[7] = Math.max(-1, Math.min(1, (wa + (tr[j * 2 + 1] - wa) * f) * Math.min(1, vj * 1.6)));
        fig.speakNod = jw;
      } else {
        _want[0] = Math.max(_want[0], Math.min(1, (ja + (tr[j * 2] - ja) * f) * tk));
        _want[7] = Math.max(-1, Math.min(1, (wa + (tr[j * 2 + 1] - wa) * f) * (tk > 1 ? 1 + (tk - 1) * 0.6 : 1)));
        fig.speakNod = ja + (tr[j * 2] - ja) * f;
      }
      // (the brows with what is stressed: a little up on the strong syllables)
      if (ja > 0.42) _want[3] = Math.max(_want[3], (ja - 0.42) * 0.9);
      // (a smile at rest gives way to the words; joy keeps it - and whatever feeling has a smile in it)
      if (!(mood && MOODS[mood] && MOODS[mood][1] > 0)) _want[1] = Math.min(_want[1], 0.15);
      const end = p / Math.max(1, n);
      const q = say.text.indexOf('?') >= 0;
      const x = say.text.indexOf('!') >= 0;
      if (q) _want[3] = Math.max(_want[3], 0.25 + 0.4 * end);
      if (x) _want[3] = Math.max(_want[3], 0.55);
      if (say.tone === 'alarm') _want[3] = Math.max(_want[3], 0.8);
    }
  }
  if (!say || say.done) fig.say = null;
  if (!saying) fig.speakNod = 0;
  // the words, when only that they are said is known: the jaw and the lips going at a speaker's pace,
  // in syllables and the gaps between words
  if (fig.talk && !saying && mood !== 'dead') {
    st.talkPh += dt;
    const p = st.talkPh;
    const syl = Math.max(0, Math.sin(p * 13.5) * 0.6 + Math.sin(p * 7.3 + 1.1) * 0.4);
    const gap = Math.sin(p * 2.1) > -0.55 ? 1 : 0.15;
    _want[0] = Math.max(_want[0], 0.08 + 0.32 * syl * gap);
    _want[7] = Math.max(_want[7], 0.25 * Math.max(0, Math.sin(p * 5.1 + 0.4)) * gap);
  }
  // eased towards it: the jaw quick, the rest a little slower
  const w = st.w;
  for (let e = 0; e < 8; e++) w[e] += (_want[e] - w[e]) * Math.min(1, dt * (e === 0 || e === 7 ? 18 : 7));
  // a blink now and then (now and then two)
  if (st.blinkT < 0 && t > st.blinkAt && mood !== 'dead') {
    st.blinkT = 0;
    st.blinkAt = t + (Math.random() < 0.15 ? 0.32 : 2 + Math.random() * 4.5);
  }
  for (let e = 0; e < 8; e++) _fEw[e] = w[e];
  if (st.blinkT >= 0) {
    st.blinkT += dt;
    const b = st.blinkT < 0.07 ? st.blinkT / 0.07 : Math.max(0, 1 - (st.blinkT - 0.07) / 0.1);
    if (st.blinkT > 0.17) st.blinkT = -1;
    _fEw[5] = Math.max(_fEw[5], b);
    _fEw[6] = Math.max(_fEw[6], b);
  }
  // where they look: where their head is turned to (fig.lookAt - whoever they listen to, what they
  // do, you when they notice you: the eyes get there first, the head after - game/doodle.js); else
  // a glance here and there, now and then, mostly ahead. (ROADMAP 13.10: never a stare at you for
  // its own sake)
  let lookYou = false;
  const at = fig.lookAt;
  // (characters round) the rig's eyes (game/doodle.js turnHead, placeHead): one look for the eyes,
  // the head and the chest - the eyes there first, then held on it exactly as the head comes round
  // (no lag, no overshoot); a blink with a long look round, now and then
  const rig = fig.gazeOn !== undefined;
  if (rig) {
    lookYou = true;
    st.toYaw = mood === 'dead' ? 0 : fig.eyeYaw;
    st.toPitch = mood === 'dead' ? 0 : fig.eyePitch;
    if (fig.blinkKick) {
      fig.blinkKick = false;
      if (st.blinkT < 0 && mood !== 'dead') st.blinkT = 0;
    }
  } else if (at && mood !== 'dead') {
    const hc = fig.j.headC;
    const dx = at.x - hc.x;
    const dy = at.y - hc.y;
    const dz = at.z - hc.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 0.05) {
      // (in the head's own frame: across, up, ahead)
      const ax = (dx * fig.hr.x + dy * fig.hr.y + dz * fig.hr.z) / d;
      const ay = (dx * fig.hu.x + dy * fig.hu.y + dz * fig.hu.z) / d;
      const az = (dx * fig.hf.x + dy * fig.hf.y + dz * fig.hf.z) / d;
      if (az > 0.35) {
        st.toYaw = Math.max(-0.45, Math.min(0.45, Math.atan2(ax, az)));
        st.toPitch = Math.max(-0.3, Math.min(0.3, Math.atan2(ay, az)));
        lookYou = true;
      }
    }
  }
  if (!lookYou && t > st.glanceAt) {
    st.glanceAt = t + 0.6 + Math.random() * 2.2;
    const r = Math.random();
    st.toYaw = r < 0.55 ? (Math.random() - 0.5) * 0.08 : (Math.random() - 0.5) * 0.55;
    st.toPitch = r < 0.55 ? 0 : (Math.random() - 0.6) * 0.25;
  }
  if (mood === 'dead') st.toYaw = st.toPitch = 0;
  // (round 17, the player's word: Lily's eyes white, or black, now and then - looking up at her father
  // or at the wheel, the eyes alone turned so far that the iris was all under the upper lid, and the
  // white of the eye was what was left - lit, white; in its shade, a black oval. As far as eyes turn
  // with the iris still in the opening: up 0.18, down 0.28, to the side 0.42 - the head does the rest,
  // game/doodle.js turnHead)
  st.toYaw = Math.max(-0.42, Math.min(0.42, st.toYaw));
  st.toPitch = Math.max(-0.28, Math.min(0.18, st.toPitch));
  // (the eyes jump to where they look - quick, as eyes do; the rig's are where they are)
  const k = rig ? 1 : Math.min(1, dt * 22);
  st.yaw += (st.toYaw - st.yaw) * k;
  st.pitch += (st.toPitch - st.pitch) * k;
  // (characters round) the lids go with the eyes: down over them as they look down (no white above
  // the iris), the brows up a little as they look up
  if (mood !== 'dead') {
    const lid = Math.min(0.45, Math.max(0, -st.pitch * 1.1));
    _fEw[5] = Math.max(_fEw[5], lid);
    _fEw[6] = Math.max(_fEw[6], lid);
    if (st.pitch > 0.1) _fEw[3] = Math.min(1, _fEw[3] + (st.pitch - 0.1) * 0.6);
  }
  // (the lines are in the head's mirrored frame: towards its right is down its x)
  _gaze[0] = -Math.sin(st.yaw) * EYE.r;
  // (the tests: a face held as asked)
  if (fig.__ew) for (let e = 0; e < 8; e++) _fEw[e] = fig.__ew[e];
  _gaze[1] = Math.sin(st.pitch) * EYE.r;
  _gaze[2] = st.yaw;
  _gaze[3] = st.pitch;
  return _gaze;
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
    // (v5, ROADMAP 13.1) the hero's own pens: his face, hair, jacket, trousers and boots each a drawing
    // of their own (render/heroart.js), turned over a dozen times a second (drawHero)
    const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0 && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const art = (this.heroArt = new HeroArt(touch));
    const HP = (o) => {
      const m = S(o);
      m.userData.heroPen = true;
      return m;
    };
    Object.assign(this.mats, {
      // (his face and his neck: the drawing and his lines alone, none of the city's pens over them)
      heroFace: HP({ kind: 'skin', partR: 0.06, map: art.first('face'), wash: 1, density: 0, ang: 1.0 }),
      heroHair: HP({ kind: 'cyl', partR: 0.1, map: art.first('hair'), wash: 0.95, density: 0.5 }),
      heroJacket: HP({ kind: 'paint', partR: 0.09, gloss: 0.12, map: art.first('jacket'), wash: 0.95, density: 0.55 }),
      heroPants: HP({ kind: 'cyl', partR: 0.09, map: art.first('pants'), wash: 0.95, density: 0.55 }),
      heroBoots: HP({ kind: 'paint', partR: 0.05, gloss: 0.1, map: art.first('boots'), wash: 0.95, density: 0.55 }),
    });
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
      // (characters round: from inside the head down into the body, in the neck's own frame -
      // render/neckbend.js - so that it turns and bends with the head)
      neck: P(HERO.genericNeckGeo(), M.skin),
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
      // (ROADMAP 13.1: drawn in his own pens, the pictures of render/heroart.js; ROADMAP 13.6: his hands,
      // ears and soles the city's people's drawn as he is too - drawFolk)
      heroHead: P(HERO.heroHeadGeo(), M.heroFace, 4),
      heroHair: P(HERO.heroHairGeo(), M.heroHair, 4),
      heroLocks: P(HERO.heroLocksGeo(), M.heroHair, 4),
      heroNeck: P(HERO.heroNeckGeo(), M.heroFace, 4),
      heroEarR: P(HERO.heroEarGeo(1), M.skin, 16),
      heroEarL: P(HERO.heroEarGeo(-1), M.skin, 16),
      heroBand: P(HERO.heroBandGeo(), M.heroJacket, 4),
      heroTorso: P(HERO.heroTorsoGeo(), M.heroJacket, 8),
      heroZip: P(HERO.heroZipGeo(), M.heroJacket, 4),
      heroTee: P(HERO.heroTeeGeo(), M.heroPants, 4),
      heroWelt: P(HERO.heroWeltGeo(), M.heroJacket, 4),
      heroPelvis: P(HERO.heroPelvisGeo(), M.heroPants, 4),
      heroUpper: P(HERO.heroUpperGeo(), M.heroJacket, 8),
      heroFore: P(HERO.heroForeGeo(), M.heroJacket, 8),
      // (round 16: the city's people's hands are these too - drawFolk - 16 of them were full in a crowd
      // of thirty, and the rest had none)
      heroHandR: P(HERO.heroHandGeo(false), M.skin, 192),
      // (round 17: his right hand closed round what he holds - fig.grip, game/weapons.js)
      heroGripR: P(HERO.heroHandGeo(false, 0.05), M.skin, 8),
      heroHandL: P(HERO.heroHandGeo(true), M.skin, 192),
      // (round 25: and the left closed round what it holds - fig.gripL: Lily's page by its edge)
      heroGripL: P(HERO.heroHandGeo(true, 0.05), M.skin, 8),
      heroThigh: P(HERO.heroThighGeo(), M.heroPants, 8),
      heroShin: P(HERO.heroShinGeo(), M.heroPants, 8),
      heroShoe: P(HERO.heroShoeGeo(), M.heroBoots, 8),
      heroSole: P(HERO.heroSoleGeo(), M.box, 384),
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
    // (v5, ROADMAP 13.6) the city's people drawn as the hero is (render/folkspec.js FOLK): each their own
    // body (render/folkshapes.js), pictures and lines - drawFolk. (ROADMAP 13.7) All of them in one
    // atlas of pictures (render/heroart.js FolkAtlas) and five pens of it, so that however many of
    // them are about, their parts are drawn in a handful of draws; phones fewer of them
    this.touch = touch;
    this.folkLines = 0;
    // (ROADMAP 14.9: 72 kinds of them, a phone 36; characters round 2: and the people at work - all
    // of them on a computer, a phone the first of each work's - render/folkspec.js FOLK_PHONE)
    const nK = touch ? FOLK_PHONE : FOLK.length;
    FOLK_ON.n = nK;
    const A = (this.atlas = new FolkAtlas(touch, nK));
    const FP = (o, name) => {
      const m = S({ ...o, map: A.tex[name] });
      m.userData.folk = true;
      m.vertexColors = false;
      return m;
    };
    this.folkPens = {
      face: FP({ kind: 'skin', partR: 0.06, wash: 1, density: 0, ang: 1.0 }, 'face'),
      hair: FP({ kind: 'cyl', partR: 0.1, wash: 0.95, density: 0.5 }, 'hair'),
      top: FP({ kind: 'paint', partR: 0.09, gloss: 0.08, wash: 0.95, density: 0.55 }, 'jacket'),
      bottom: FP({ kind: 'cyl', partR: 0.09, wash: 0.95, density: 0.55 }, 'pants'),
      shoes: FP({ kind: 'paint', partR: 0.05, gloss: 0.14, wash: 0.95, density: 0.55 }, 'boots'),
    };
    // (their eyes: the same on every head, each turning in its socket to look - drawFolk)
    for (const [name, sd] of [['folkEyeR', 1], ['folkEyeL', -1]]) {
      this.p[name] = P(eyeGeo(sd), this.folkPens.face, 6 * nK);
      this.p[name].atlas = true;
    }
    // (ROADMAP 19.2: a phone's, for the people far off: the same eyes as a ball of 10 by 8)
    if (GFX.folkLod) {
      for (const [name, sd] of [['folkEyeR1', 1], ['folkEyeL1', -1]]) {
        this.p[name] = P(eyeGeo(sd, 10, 8), this.folkPens.face, 6 * nK);
        this.p[name].atlas = true;
      }
    }
    this.folk = Array.from({ length: nK }, (_, k) => this.folkKind(FOLK[k], k, touch, P));
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
    for (const k of ['eye', 'eyeWhite', 'brow', 'nose', 'mouth', 'ear', 'heroEarR', 'heroEarL', 'sole', 'pocket']) this.p[k].flags = NO_MIRROR | NO_SUN;
    // (and the jacket's cloth round a neck's foot: bent and turned with it - render/heroshapes.js neckbandGeo)
    for (const k of Object.keys(this.p)) if (k === 'neck' || k === 'heroNeck' || k === 'heroBand' || /^folk\d+_(neck|band)$/.test(k)) this.p[k].flags |= NECK_FLAG;
    // (v5, ROADMAP 13.1) the hero's lines, over his body (render/herolines.js)
    this.heroLines = new HeroLines(touch);
    // (their drawings turned over once a frame, however many of one of them there are: end counts)
    this.frameNo = 0;
    this.buildShapes(scene);
    // eraser holes and fading per person
    this.owners = new Array(MAX_OWNERS).fill(false);
    this.holeTex = shared.uHoles.value;
    this.dirty = false;
  }

  // (v5, ROADMAP 13.6) one of the city's people drawn as the hero is: their body's shapes (in the
  // city's people's pens: their pictures are their tile of the atlases - ROADMAP 13.7), their lines,
  // where their ears and eyes are on their head
  folkKind(spec, k, touch, P) {
    const pens = this.folkPens;
    const body = folkBody(k);
    const G = body.parts;
    // (the shoes: the hero's shape, in their own pictures)
    G.shoe = HERO.heroShoeGeo();
    const PEN = { head: 'face', neck: 'face', hair: 'hair', locks: 'hair', fall: 'hair', bun: 'hair', tail: 'hair', tee: 'bottom', pelvis: 'bottom', thigh: 'bottom', shin: 'bottom', skirt: 'bottom', shoe: 'shoes' };
    const TWO = new Set(['upper', 'fore', 'thigh', 'shin', 'shoe']);
    const sh = {};
    for (const [name, geo] of Object.entries(G)) {
      // (glasses: thin metal, in the city's gloss pen)
      const pen = name === 'glasses' ? this.mats.gloss : pens[PEN[name] || 'top'];
      const s = (sh[name] = this.p[`folk${k}_${name}`] = P(geo, pen, TWO.has(name) ? 12 : 6));
      s.atlas = name !== 'glasses';
      // (the face: it moves - render/folkshapes.js EXPR)
      s.expr = name === 'head';
    }
    // their lines (render/herolines.js): their head and hair, their body's rows, in their colours
    const Ln = body.lines;
    const dark = (list) => list.map(hexRGB).reduce((a, c) => (c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a));
    const inkOf = (o) => {
      const d = dark(o.dark);
      const hi = (o.light || o.mid).map(hexRGB);
      while (hi.length < 3) hi.push(hi[hi.length - 1]);
      return { ink: d.map((v) => v * 0.45), dark: d.map((v) => v * 0.22), hi: hi.slice(0, 3) };
    };
    const kit = {
      sdf: Ln.sdf, headR: Ln.headR, hairEdge: Ln.hairEdge, hairThick: Ln.hairThick, locks: Ln.locks, fem: !!spec.fem,
      tone: (x, y) => folkTone(x, y, spec.fem, spec.shape),
      beard: (x, y) => folkBeard(x, y, spec.beard),
      beardInk: spec.beardCol ? dark(spec.beardCol).map((v) => v * 0.8) : null,
      rows: Ln.rows, skirt: Ln.skirt, neckSurf: Ln.neckSurf,
      // (their real head's face, and how they look: render/folkshapes.js surfaceOf, folkspec.js expr)
      facePt: Ln.facePt, faceEx, mono: !!spec.eyes.mono,
      smile: { neutral: 0, soft: 0.35, half: 0.5, smile: 0.85, laugh: 1 }[spec.expr] || 0, half: spec.expr === 'half', gape: spec.gape || 0,
      top: inkOf(spec.top), bottom: inkOf(spec.bottom),
      hair: dark(spec.hair.dark).map((v) => v * 0.6), hairHi: hexRGB(spec.hair.light[0]),
    };
    const B = { thick: 0, ...(spec.body || {}) };
    return {
      k, spec, sh,
      lines: new HeroLines(touch, kit, 0.5),
      // (where their eyes are in their head: they turn there to look - drawFolk)
      eyes: body.eyes,
      // (their ears' lobes on their head: render/folkshapes.js)
      lobes: body.lobes,
      // (a thick neck or a slender one; a heavy body's girth)
      neck: (spec.shape && spec.shape.neck) || 1,
      girth: 1 + Math.max(0, B.thick) * 0.6,
      glasses: spec.glasses ? linC(spec.glasses.col) : null,
      // (the hands in the face's warmth: a flat colour reads paler than its drawing)
      skin: linC(SKINS[spec.skin].rgb.map((v, i) => v * [0.92, 0.84, 0.8][i])),
      // (a fair face's drawing a little deeper in the hall's bright light)
      face: { fair: [0.9, 0.86, 0.84], light: [0.94, 0.91, 0.89] }[spec.skin] || PAPER_W,
      sole: linC(spec.shoes.sole),
      watch: spec.acc.watch ? linC(hexRGB(spec.acc.watch)) : null,
      earring: spec.acc.earrings ? linC(hexRGB(spec.acc.earrings)) : null,
      // (long hair over the ears: no earrings seen)
      earsOn: spec.hair.style !== 'long',
      // (ROADMAP 18: what is worn in the hair - a clip, beads, a feather - in their colours)
      bits: body.bits ? body.bits.map((b) => ({ ...b, col: linC(hexRGB(b.col)) })) : null,
    };
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
    // (v5, ROADMAP 13.1) the hero's pens, their five pictures in a draw of their own: drawHero turns
    // them over (HERO_PICS: their order)
    const hero = (this.heroMat = mergedSurface(M.heroJacket, { vcolor: false, pictures: penPictures(HERO_PICS.map((k) => M[k])), pull: true }));
    // (ROADMAP 13.6: and the city's people drawn as he is, theirs - ROADMAP 13.7: all of them in one,
    // their pictures atlases, their faces moving)
    const FPn = this.folkPens;
    const folkMat = (this.folkMat = mergedSurface(FPn.top, { vcolor: false, pictures: penPictures(['face', 'hair', 'top', 'bottom', 'shoes'].map((n) => FPn[n])), pull: true }));
    folkMat.defines.USE_ATLAS = '';
    folkMat.defines.USE_EXPR = '';
    folkMat.uniforms.uAtlas = { value: Array.from({ length: 5 }, () => new THREE.Vector4(this.atlas.cols, this.atlas.rows, 0, 0)) };
    folkMat.uniforms.uExprBase = { value: 0 };
    folkMat.uniforms.uExprN = { value: 0 };
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
    const sideOf = (sh) => `${sh.penMat.userData.folk ? 'folk' : sh.penMat === M.coat ? 'back' : sh.penMat.userData.heroPen ? 'hero' : 'front'}-${sh.lod}`;
    const classOf = (sh) => CLASS_SIZES.find((n) => n >= sh.count) || sh.count;
    const byCorners = (sh) => {
      sh.layout = layoutOf(sh.igeo);
      sh.geo = sh.igeo;
      sh.count = sh.layout.corners;
    };
    const names = new Map(Object.entries(this.p).map(([k, v]) => [v, k]));
    for (const sh of shapes) {
      sh.layout = null;
      // (a face that moves is always drawn by its corners: its moves are its points' - USE_EXPR)
      if (sh.igeo && ((!IN_CLASS.has(names.get(sh)) && classOf(sh) - sh.igeo.attributes.position.count >= OWN_LAYOUT) || sh.expr)) byCorners(sh);
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
    for (const sh of shapes) wide = Math.max(wide, sh.count);
    // the texture: two texels a point, the shapes one after another, row after row (ROADMAP 13.7: a
    // shape where it starts - a real head is longer than any row the graphics card is sure to have)
    const W = Math.min(wide * 2, 4096);
    let at = 0;
    for (const sh of shapes) {
      sh.row = at;
      at += sh.count * 2;
      sh.pen = penRow(sh.penMat);
    }
    // (then the faces' moves: a texel a point, each move after the last - render/folkshapes.js)
    const X = exprMoves();
    const exprBase = at;
    at += X.n * EXPR.length;
    folkMat.uniforms.uExprBase.value = exprBase;
    folkMat.uniforms.uExprN.value = X.n;
    const rows = Math.ceil(at / W);
    const data = new Float32Array(W * rows * 4);
    for (let t = 0; t < X.n * EXPR.length; t++) {
      const o = (exprBase + t) * 4;
      data[o] = X.d[t * 3];
      data[o + 1] = X.d[t * 3 + 1];
      data[o + 2] = X.d[t * 3 + 2];
    }
    for (const sh of shapes) {
      const g = sh.geo;
      const pos = g.attributes.position.array;
      const nor = g.attributes.normal.array;
      const uv = g.attributes.uv ? g.attributes.uv.array : null;
      for (let v = 0; v < sh.count; v++) {
        const o = (sh.row + v * 2) * 4;
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
    const tex = new THREE.DataTexture(data, W, rows, THREE.RGBAFormat, THREE.FloatType);
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
      if (!groups.has(key)) groups.set(key, { side, size, index: L ? L.index : null, layout: L || null, list: [] });
      groups.get(key).list.push(sh);
    }
    // (ROADMAP 13.11) the faces drawn near: their insides too, dark - all that is seen of them is the
    // throat, through the open mouth, whatever a head's own shape does to it (render/glsl.js FOLK_HEAD)
    const headMat = folkMat.clone();
    headMat.uniforms = folkMat.uniforms;
    headMat.userData = folkMat.userData;
    headMat.defines = { ...folkMat.defines, FOLK_HEAD: '' };
    headMat.side = THREE.DoubleSide;
    for (const { side, size, index, layout, list } of groups.values()) {
      const cap = list.reduce((a, sh) => a + sh.cap, 0);
      const heads = side === 'folk-full' && list.every((sh) => sh.expr);
      const mat = heads ? headMat : side.startsWith('folk') ? folkMat : side.startsWith('back') ? back : side.startsWith('hero') ? hero : front;
      const cls = new DrawClass(scene, size, mat, cap, index);
      if (side.endsWith('-full')) {
        // (the picture alone: not on the mirror's layer, and left out of the sun's view)
        cls.mesh.layers.set(LAYERS.MIRRORLESS);
        cls.mesh.userData.noShadow = true;
      }
      for (const sh of list) sh.cls = cls;
      this.classes.push(cls);
      // (ROADMAP 19.2, GFX.folkLod) the same shapes in fewer triangles over the same corners, for a person small on the
      // screen (render/lod.js): a twin of each shape, reading its row, count, pen and flags from it, drawn by a class of
      // its own with the lighter list. The same materials: no shader is made. A head's second one is drawn on one side
      // only (beyond 11 m an open mouth is two pixels), the first as the full head is
      if (GFX.folkLod && layout && side.endsWith('-full') && list.some((sh) => LIGHTABLE.test(names.get(sh)))) {
        const lights = lightOf(layout);
        if (lights) {
          for (const sh of list) sh.lods = [sh];
          lights.forEach((idx, li) => {
            const lc = new DrawClass(scene, size, heads && li > 0 ? folkMat : mat, cap, idx);
            lc.mesh.layers.set(LAYERS.MIRRORLESS);
            lc.mesh.userData.noShadow = true;
            this.classes.push(lc);
            for (const sh of list) {
              const t = Object.create(sh);
              t.cls = lc;
              sh.lods.push(t);
            }
          });
        }
      }
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

  // (ROADMAP 19.2, GFX.folkLod) where this frame is seen from: how many pixels a metre is on the screen at a metre's
  // distance - the drawing's height over twice the tangent of half the field of view (0: not a perspective camera, or
  // not set yet - whole shapes)
  view(cam, heightPx) {
    this.ppmK = cam && cam.isPerspectiveCamera && heightPx > 0 ? heightPx / (2 * Math.tan((cam.fov * Math.PI) / 360)) : 0;
  }

  begin() {
    // (ROADMAP 13.7: the city's people's pictures that came this frame - their smaller copies; and the
    // strokes their lines may have this frame, all of them together)
    if (this.atlas.renderer) this.atlas.update();
    this.folkLines = this.touch ? 1600 : 4200;
    // (ROADMAP 14.1) the portraits hidden until somebody is drawn with one again: each kind's to
    // whoever of them was nearest the camera last frame (the face lab's, always)
    if (this.portraits) {
      // (ROADMAP 14.9) on a phone the three nearest of last frame's alone, for the frames' sake (the
      // face lab's always): the others the city's way until one of the three goes
      if (this.touch) {
        const near = [];
        for (const P of this.portraits.values()) {
          // (characters round 2: one showing keeps its place unless another is clearly nearer - a
          // third nearer - so two at about the same distance do not take turns)
          P.rank = P.nextD * (P.allow ? 0.67 : 1);
          P.allow = false;
          if (P.next) near.push(P);
        }
        near.sort((a, b) => a.rank - b.rank);
        for (let i = 0; i < near.length && i < PORTRAIT_PHONE; i++) near[i].allow = true;
      }
      // (the fades on the game's clock)
      const now = shared.uTime.value;
      const fdt = Math.min(0.1, Math.max(0, now - (this._fadeAt === undefined ? now : this._fadeAt)));
      this._fadeAt = now;
      for (const P of this.portraits.values()) {
        if (P.mesh) P.mesh.visible = false;
        // (characters round 2) somebody else of the kind nearer now, and whoever has it still drawn:
        // theirs goes back to the city's way first, over the fade - the next one's comes in after it
        // has, never one face popping out as another pops in
        P.handing = !!(P.next && P.owner && P.next !== P.owner && P.ownerSeen && !heldFace(P.next) && P.fade > 0.02);
        if (!P.handing) {
          if (P.next !== P.owner) {
            P.fresh = true;
            // (somebody new: theirs comes in from nothing - the face lab's at once)
            P.fade = heldFace(P.next) ? 1 : 0;
            P.fadeTo = 1;
          }
          P.owner = P.next;
        } else P.fadeTo = 0;
        P.ownerSeen = false;
        P.next = null;
        P.nextD = Infinity;
        if (P.fade === undefined) P.fade = 0;
        if (P.fadeTo === undefined) P.fadeTo = 1;
        const step = fdt / PORTRAIT_FADE;
        P.fade = P.fadeTo > P.fade ? Math.min(P.fadeTo, P.fade + step) : Math.max(P.fadeTo, P.fade - step);
      }
      this.stepPortraits();
    }
  }

  // (ROADMAP 14.1) somebody near enough to be drawn as a portrait (render/portrait.js): one a kind,
  // the nearest - the face lab's whatever its distance (game/facelab.js, fig.__portrait)
  portraitFor(fig, k, camDist) {
    // (on a phone too, since ROADMAP 14.9 - a few at a time: begin)
    if (PORTRAIT_MODE === 'off' || !portraitKind(k) || fig.dead > 0 || fig.parts.head < 0.5 || fig.__noPortrait) return null;
    let P0 = this.portraits && this.portraits.get(k);
    // (round 17, the player's word: Lily's eyes and mouth black now and then) a held face's portrait -
    // the story's own people, render/people.js heldFace - is theirs alone: nobody else of the kind takes
    // it while they are off the screen, to be handed back over frames of the city's way of drawing
    if (P0 && P0.keeper && P0.keeper !== fig && !heldFace(fig)) return null;
    const mine = !!P0 && P0.owner === fig;
    if (mine) P0.ownerSeen = true;
    // (the face's height on the screen, in its pixels - from how far the head is, not the feet: near,
    // the two are far apart)
    const cam = this.cam;
    const sh = this.atlas.renderer ? this.atlas.renderer.domElement.height : 720;
    const hd = cam && fig.j && fig.j.headC ? cam.position.distanceTo(fig.j.headC) : camDist;
    const px = cam && cam.isPerspectiveCamera ? (0.12 * sh) / (Math.max(0.3, hd) * Math.tan((cam.fov * Math.PI) / 360)) : 166 / Math.max(0.3, hd);
    // (ROADMAP 18.9: the film's own people - Lily - from a smaller face on: fig.portraitPx)
    const near = fig.portraitPx || PORTRAIT_NEAR;
    const inRange = heldFace(fig) || (PORTRAIT_STREET && px > (mine ? Math.min(PORTRAIT_FAR, near * 0.75) : near));
    // (ROADMAP 14.9: a phone makes a face a little at a time - a few seconds: begun while they are
    // still coming, two or three times as far, so that it is there by the time they are near)
    if (!P0 && this.touch && PORTRAIT_STREET && px > PORTRAIT_NEAR * 0.38 && !(this.portraitQueue && this.portraitQueue.length > 1)) P0 = this.makePortrait(k);
    // (going out: still theirs while it fades, unless somebody else of the kind comes near)
    if (!inRange && !(mine && P0.fade > 0.01)) return null;
    const P = P0 || this.makePortrait(k);
    if (heldFace(fig)) P.keeper = fig;
    // (somebody near whose face is still being made, or painted: theirs next)
    if (!P.ready) {
      for (const Q of [this.portraitQueue, this.paintQueue]) {
        const i = Q ? Q.indexOf(P) : -1;
        if (i > 0) {
          Q.splice(i, 1);
          Q.unshift(P);
        }
      }
    }
    // (characters round 2: the one who has it keeps it unless another of the kind is a third nearer)
    const d = heldFace(fig) ? -1 : (inRange ? camDist : 1e5 + camDist) * (mine ? 0.67 : 1);
    if (d < P.nextD) {
      P.nextD = d;
      P.next = fig;
    }
    // (round 17: a held face's own at once, the moment it is drawn again - after a cut, back on the
    // screen - never a frame of the city's way first)
    if (P.ready && P.owner !== fig && heldFace(fig)) {
      P.owner = fig;
      P.fresh = true;
      P.handing = false;
      P.fade = 1;
      P.fadeTo = 1;
    }
    if (!(P.ready && P.owner === fig)) return null;
    // (a phone's: only the nearest few - P.allow, begin; the one already showing fades out)
    if (this.touch && !heldFace(fig) && !P.allow && !(P.fade > 0.01)) return null;
    P.usedAt = shared.uTime.value;
    P.fadeTo = inRange && !P.handing && (!this.touch || heldFace(fig) || P.allow) ? 1 : 0;
    // (how big the face is on the screen: the face's own ink going as the portrait's pencil comes in -
    // drawFolk)
    P.px = px;
    // (its own outlines - round the eyes, the lips, under the jaw - only while it is big enough on the
    // screen for them to be drawn whole: smaller, broken specks over it; its outline alone then)
    const big = px > (P.lineBig ? PORTRAIT_LINES - 45 : PORTRAIT_LINES);
    if (big !== P.lineBig) P.setLines((P.lineBig = big));
    return P;
  }

  // a kind's portrait: its head and its muscles' moves made now, its picture painted off the game's
  // thread (render/heroworker.js), drawn once it has come
  makePortrait(k) {
    if (!this.portraits) this.portraits = new Map();
    // (ROADMAP 14.9: a phone keeps a few - the one nobody has had longest let go for a new one)
    if (this.touch && this.portraits.size >= PORTRAIT_PHONE_KEEP) {
      let old = null;
      for (const Q of this.portraits.values()) {
        // (round 17: nor a held face's - Lily's - ever: made again, it is the city's way for seconds)
        if (!Q.ready || Q.owner || Q.next || Q === this.painting || Q.k === 2 || Q.keeper) continue;
        if (!old || (Q.usedAt || 0) < (old.usedAt || 0)) old = Q;
      }
      if (old) {
        this.portraits.delete(old.k);
        old.dispose();
      }
    }
    // (characters round: made a little at a time, a few milliseconds a frame - stepPortraits - so no
    // frame of the game stops for a face; drawn once it and its picture are both there)
    const P = new Portrait(k, k, LAYERS.MIRRORLESS, true);
    P.usedAt = shared.uTime.value;
    P.next = null;
    P.nextD = Infinity;
    P.onReady = (q) => this.scene.add(q.mesh);
    this.portraits.set(k, P);
    (this.portraitQueue || (this.portraitQueue = [])).push(P);
    // (its picture painted off the game's thread - one at a time, whoever is wanted near first)
    (this.paintQueue || (this.paintQueue = [])).push(P);
    this.pumpPaint();
    return P;
  }

  // (ROADMAP 14.1) the portraits made while the city is still being put together: their heads, their
  // muscles' moves and their pictures cost a few tenths of a second once - then, not when somebody
  // first comes near in play
  warmPortraits() {
    if (PORTRAIT_MODE === 'off' || !PORTRAIT_STREET || this.touch) return;
    // (Sal's first - he comes over at the start - then every kind of the city's people, a little a frame)
    const ks = [2];
    // (characters round 2: the people at work theirs when they are first near - not all of them made
    // ahead: a few dozen more faces in the memory for nothing)
    for (let k = 0; k < FOLK.length; k++) if (k !== 2 && portraitKind(k) && !FOLK[k].role) ks.push(k);
    for (const k of ks) if (!(this.portraits && this.portraits.get(k))) this.makePortrait(k);
  }

  // (characters round) the next face's picture to the painter (render/heroworker.js), when it is free
  pumpPaint() {
    if (this.painting || !this.paintQueue || !this.paintQueue.length) return;
    const P = this.paintQueue.shift();
    this.painting = P;
    paintPortrait(
      P.k,
      (bmp) => {
        this.painting = null;
        this.pumpPaint();
        if (!bmp || PORTRAIT_MODE === 'hide') return;
        // (the picture's rows top first, as a canvas has them - a picture of this kind goes onto the
        // graphics card as it is, never turned - and the face's v from the chin up: turned over first)
        createImageBitmap(bmp, { imageOrientation: 'flipY' }).then((up) => {
          bmp.close();
          P.setPicture(up);
        });
      },
      // (the street's faces at half the close look's picture: a face a few metres off needs no more)
      P.k === 2 ? 1024 : 512,
    );
  }

  // (characters round) the faces being made: a few milliseconds of it a frame
  stepPortraits() {
    const Q = this.portraitQueue;
    if (!Q || !Q.length) return;
    if (Q[0].step(this.touch ? 2 : 4)) Q.shift();
  }

  // (the graphics card's: the city's people's pictures are written straight into their atlases)
  setRenderer(r) {
    this.atlas.renderer = r;
    setTimeout(() => this.warmPortraits(), 1500);
  }

  // a plain ellipsoid at c in the frame (r, u, f) (the birds of the city, little things in the air)
  blob(c, r, u, f, sx, sy, sz, col) {
    this.p.ball.push(framed(c, r, u, f, sx, sy, sz), linC(col), 0, 0.5, 0);
  }

  // a pen line of the old notebook, as a thin rod (a cane, an umbrella's pole, a gold chain)
  rod(a, b, r, col, fig) {
    capsuleTo(this.p, a, b, Math.max(0.003, r), linC(col), fig.owner + 1, (fig.seed * 0.13 + 0.5) % 1, fig.indoor === 'casino' ? 4 : fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0, fig.brgt);
  }

  end() {
    for (const c of this.classes) c.end();
    this.frameNo++;
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
    // (a crowd indoors: 1 a room under its lamps, 3 a dark hall under its neon - the arcade -, 4 the
    // casino's floor)
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
      // (v5, ROADMAP 18: one hand up, waving from side to side - to somebody down on the pier, or
      // up in the big wheel; or a phone held up in front of the face, filming)
      const wv = ai === 0 ? w.wave || 0 : 0;
      const fm = ai === 0 && !wv ? w.film || 0 : 0;
      if (wv > 0) {
        a += (Math.PI - 0.62 - a) * wv;
        b += (Math.PI - 0.3 - b) * wv;
      }
      if (fm > 0) {
        a += (1.0 - a) * fm;
        b += (2.35 - b) * fm;
      }
      const wx = wv ? Math.sin(w.pump || 0) * 0.16 * wv : fm ? -0.12 * fm : 0;
      const sx = side * (sw + 0.02 + cheer * 0.05);
      at(_a, sx, ny - 0.07, nz);
      const ey = ny - 0.07 - Math.cos(a) * armU;
      const ez = nz + Math.sin(a) * armU;
      at(_b, sx + side * (cheer * 0.06 + wv * 0.08), ey, ez);
      at(_c, sx + side * (0.02 + cheer * 0.1 + wv * 0.12) + wx, ey - Math.cos(b) * armF, ez + Math.sin(b) * armF);
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
    // (round 25: whole hands or not, as last drawn - drawFolk; game/carry.js fullHands)
    fig._fullHands = false;
    // (ROADMAP 19.9, GFX.peopleLite - the phone version: the simple shapes from 22 m instead of 32; a person there is some
    // twenty pixels high. A person who has a distance of their own - the film's - keeps it)
    // (ROADMAP 21, the light version: liteCap - the four nearest in full, never the simple shapes nearer than 6 m: game/civilians.js draw)
    if (camDist > (fig.lodFar || (GFX.peopleLite && !GFX.off ? Math.min(GFX.lite ? this.liteCap || 15 : 22, this.lodFar) : this.lodFar))) {
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
    if (fig.look.folk !== undefined) {
      this.drawFolk(fig, camDist);
      return;
    }
    const L = fig.look;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor === 'casino' ? 4 : fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
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
      // the neck: from under the head down into the body, turned and bent as the head is (the rig's
      // - game/doodle.js placeHead, render/neckbend.js); as thick as theirs
      const hsN = fig.headScale * S;
      const gN = (0.98 * 1.18 * Math.max(1, bulk * 0.9)) / fig.headScale;
      framed(fig.neckO, fig.neckR, fig.neckU, fig.neckF, hsN * gN, hsN, hsN * gN, _mH);
      p.neck.push(_mH, skin, own, fig.headId, ind, fig.neckD);
    }
    if (P.pelvis > 0.5) {
      // (characters round: the pelvis in its own frame, the hips' - not turned with the chest)
      const prgt = fig.prgt;
      const pfwd = fig.pfwd;
      _a.copy(j.hip).addScaledVector(ax, 0.02 * S);
      const pc = longSkirt ? skirtC : botC;
      (longSkirt || midi ? p.pelvisSkirt : cargo ? p.pelvis : p.pelvis).push(framed(_a, prgt, ax, pfwd, k * bulk * (L.fem ? 1.06 : 1), k, k * bulk), pc, own, id(), ind);
      if (midi && P.torso > 0.5 && fig.sit < 0.3) {
        // a midi skirt, swinging a little as she walks
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        const sw = Math.sin(fig.phase) * 0.06 * Math.min(1, fig.speed / 1.4);
        _c.copy(pfwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
        p.midi.push(framed(_a, prgt, _c, _d.crossVectors(prgt, _c), k * bulk, k * (1 - fig.crouch * 0.4), k * bulk), botC, own, id(), ind);
      }
      if (longSkirt && P.torso > 0.5) {
        // a long skirt from the waist to the ankles; sitting, it drapes over the knees
        const sit = fig.sit;
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        _b.copy(_a).addScaledVector(ax, -1);
        const kk = k * bulk;
        if (sit < 0.3) {
          const sw = Math.sin(fig.phase) * 0.05 * Math.min(1, fig.speed / 1.4);
          _c.copy(pfwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
          p.skirt.push(framed(_a, prgt, _c, _d.crossVectors(prgt, _c), kk, k * (1 - fig.crouch * 0.4), kk), skirtC, own, id(), ind);
        } else {
          p.skirt.push(framed(_a, prgt, ax, pfwd, kk, k * 0.32, kk), skirtC, own, id(), ind);
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
      if (P[LEG_PART[li]] < 0.5 || inCar(fig)) continue;
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
            // (characters round: the pupils where the eyes look - they lead, the head follows)
            if (!masked) _c.addScaledVector(hr, Math.sin(fig.eyeYaw || 0) * 0.011 * hs).addScaledVector(hu, Math.sin(fig.eyePitch || 0) * 0.008 * hs);
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

  // (v5, ROADMAP 11.29, 13.1) The hero, in a body of his own (render/heroshapes.js) and drawings of
  // his own (render/heroink.js), on the same rig as everyone: a carved head with his face drawn on
  // it, his tousled hair, a leather jacket open over his shirt and chain, cargo trousers, boots, a
  // watch, hands with fingers - the drawings turned over a dozen times a second, so he is redrawn in
  // front of you; after dark the city's neon on him. Another colour bought for his jacket or his
  // trousers tints their drawing; a hat, glasses and what he holds come as for anybody.
  drawHero(fig) {
    const L = fig.look;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor === 'casino' ? 4 : fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
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
    // (v5, ROADMAP 13.1) the drawing turned over: a little more of it drawn, and which of it is on
    // the page now - his face redrawn a dozen times a second
    const art = this.heroArt;
    art.step();
    art.frame(performance.now() / 1000, _heroTex, heroFace(fig, shared.uTime.value));
    const U = this.heroMat.uniforms;
    for (let i = 0; i < 5; i++) U[`uMapS${i}`].value = _heroTex[HERO_SET[i]];
    // his jacket in its drawing's own colours; another colour (the shops', a splash of paint) tints it
    let topCol = top.armor && top.under ? top.under : top.color;
    if (fig.paintT > 0) {
      const t = Math.min(1, fig.paintT / 2.5) * 0.7;
      topCol = topCol.map((v, i) => v + (fig.paintColor[i] - v) * t);
    }
    const jC = heroTint(fig, topCol, HERO_LEATHER, '_hjt');
    const jeansC = heroTint(fig, L.bottom.color, HERO_JEANS, '_hpt');
    const skin = linC(L.skin);
    const white = PAPER_W;
    fig.headId = (seed * 7.77 + 0.31) % 1;
    // (a leather jacket's bulk over the shoulders and the arms)
    const bw = k * Math.max(0.92, bulk * 0.96) * 1.07;
    // his light after dark, as his drawing has him: the city's neon on him - warm pink on the side
    // towards you, its cyan on the other (two small lights of his own, with him); the light his lines
    // are drawn by (the sun by day, that pink after dark), and the edge of colour
    const cam = this.camPos;
    const sun = shared.uSunCol.value;
    const dark = fig.indoor ? 1 : Math.max(0, Math.min(1, 1 - (sun.r + sun.g + sun.b) / 1.4));
    _hx.set(cam ? cam.x - fig.pos.x : 0, 0, cam ? cam.z - fig.pos.z : 1);
    if (_hx.lengthSq() < 1e-4) _hx.set(0, 0, 1);
    _hx.normalize();
    _hz.set(_hx.z, 0, -_hx.x);
    if (cam && dark > 0.05) {
      flashLight(fig.pos.x + _hx.x * 1.0 + _hz.x * 0.75, fig.pos.y + 1.95 * S, fig.pos.z + _hx.z * 1.0 + _hz.z * 0.75, 2.6, _keyC, 1.25 * dark);
      flashLight(fig.pos.x - _hx.x * 0.25 - _hz.x * 1.0, fig.pos.y + 1.45 * S, fig.pos.z - _hx.z * 0.25 - _hz.z * 1.0, 2.4, _rimC, 1.5 * dark);
    }
    const sd = shared.uSunDir.value;
    _hL.set(_hx.x + _hz.x * 0.75, 0.65, _hx.z + _hz.z * 0.75).normalize().multiplyScalar(dark).addScaledVector(sd, 1 - dark).normalize();
    _hR.set(-_hx.x * 0.25 - _hz.x, 0.15, -_hx.z * 0.25 - _hz.z).normalize();
    const HL = this.heroLines;
    // ---- the jacket open over the shirt; its edges, the flaps of its pockets; its cloth round the neck
    let sy = 1;
    let tid = 0;
    if (P.torso > 0.5) {
      sy = Math.max(0.3, _b.subVectors(j.neck, j.hip).length()) / 0.5;
      framed(j.hip, rgt, ax, fwd, bw, sy, bw, _mH);
      // (its part's id kept: the jacket's cloth round his neck is the same part - heroBand below)
      tid = id();
      p.heroTorso.push(_mH, jC, own, tid, ind);
      HL.set('torso', 'torso', _mH);
      p.heroZip.push(_mH, jC, own, id(), ind);
      p.heroWelt.push(_mH, jC, own, id(), ind);
      p.heroTee.push(_mH, white, own, id(), ind);
      if (top.armor) {
        // (the vest of notebook covers, over the jacket)
        _c.copy(j.hip).addScaledVector(ax, 0.07 * S);
        p.heroTorso.push(framed(_c, rgt, ax, fwd, bw * 1.09, sy * 0.8, bw * 1.15), linC(top.color), own, id(), ind);
      }
      // the neck, from under the back of the skull down into the collar (its own drawing: the ink
      // draws the jaw's line over it). (characters round) In its own frame under his head, twisted and
      // bent as his head is turned - the rig's (game/doodle.js placeHead, render/neckbend.js) - its
      // lines with it
      const hs = fig.headScale * S;
      const gN = (0.98 * 1.16 * Math.max(1, bulk * 0.92)) / fig.headScale;
      framed(fig.neckO, fig.neckR, fig.neckU, fig.neckF, hs * gN, hs, hs * gN, _mH);
      p.heroNeck.push(_mH, white, own, fig.headId, ind, fig.neckD);
      // (characters round 3) no collar of its own: the jacket's leather carried on up round the
      // neck's foot and turned in onto it - made on his neck, bent and turned with it, the jacket's
      // part (render/heroshapes.js heroBandGeo)
      p.heroBand.push(_mH, jC, own, tid, ind, fig.neckD);
      HL.set('neck', 'neck', _mH, null, null, false, fig.neckD);
      // his chain: round the neck and down onto the shirt, link by link
      const cid = (seed * 3.1 + 0.7) % 1;
      for (let i = 0; i + 1 < _chain.length; i++) {
        const a0 = _chain[i];
        const a1 = _chain[i + 1];
        _a.copy(j.hip).addScaledVector(rgt, a0[0] * bw).addScaledVector(ax, a0[1] * sy).addScaledVector(fwd, a0[2] * bw);
        _x.copy(j.hip).addScaledVector(rgt, a1[0] * bw).addScaledVector(ax, a1[1] * sy).addScaledVector(fwd, a1[2] * bw);
        capsuleTo(p, _a, _x, 0.0028 * S, linC(CHAIN), own, cid, ind, rgt);
      }
    }
    if (P.pelvis > 0.5) {
      p.heroPelvis.push(framed(j.hip, fig.prgt, ax, fig.pfwd, bw, k, bw), jeansC, own, id(), ind);
      HL.set('pelvis', 'pelvis', _m);
    }
    // ---- arms in their sleeves, the hands; the watch on the left wrist
    const arms = fig._armJ || (fig._armJ = [[j.shoulderR, j.elbowR, j.handR], [j.shoulderL, j.elbowL, j.handL]]);
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1);
    for (let ai = 0; ai < 2; ai++) {
      if (P[ARM_PART[ai]] < 0.5) continue;
      const sh = arms[ai][0];
      const el = arms[ai][1];
      const hd = arms[ai][2];
      const armId = id();
      p.heroUpper.push(along(sh, el, 0.31, armK * 1.1, fwd), jC, own, armId, ind);
      HL.set(ai ? 'upperL' : 'upperR', 'upper', _m);
      p.heroFore.push(along(el, hd, 0.29, armK * 1.08, fwd), jC, own, armId, ind);
      HL.set(ai ? 'foreL' : 'foreR', 'fore', _m);
      _c.subVectors(hd, el).normalize();
      _d.copy(hd).addScaledVector(_c, 0.19 * S);
      // (round 17: holding the pencil - fig.grip, its way across the fist: game/weapons.js pencilGrip -
      // the hand closed round it and turned to it)
      const grip = ai === 0 ? fig.grip : null;
      if (grip) {
        // (bent at the wrist to lie square across it, as weapons.js put the pencil in it)
        _gw.copy(_c).addScaledVector(grip, -_c.dot(grip));
        if (_gw.lengthSq() > 1e-6) _d.copy(hd).addScaledVector(_gw.normalize(), 0.19 * S);
      }
      (ai === 0 ? (grip ? p.heroGripR : p.heroHandR) : p.heroHandL).push(along(hd, _d, 0.19, k, grip || fwd), skin, own, id(), ind);
      if (ai === 1) {
        // (a steel watch on a leather strap, just out of the cuff: its face on the back of the wrist)
        _a.copy(hd).addScaledVector(_c, -0.025 * S);
        _x.copy(rgt).multiplyScalar(-1).addScaledVector(_c, rgt.dot(_c)).normalize();
        _z.crossVectors(_c, _x).normalize();
        p.sphere.push(framed(_a, _x, _c, _z, 0.037 * S, 0.012 * S, 0.034 * S), linC(WATCH), own, id(), ind);
        _a.addScaledVector(_x, 0.03 * S);
        p.boxP.push(framed(_a, _c, _x, _z, 0.026 * S, 0.008 * S, 0.026 * S), linC(DIAL), own, id(), ind);
      }
    }
    // ---- the legs in cargo trousers, the boots
    const legs = fig._legJ || (fig._legJ = [[j.hipR, j.kneeR, j.footR, j.toeR], [j.hipL, j.kneeL, j.footL, j.toeL]]);
    const legK = k * Math.max(1, bulk * 0.9) * (fig.limbs || 1);
    for (let li = 0; li < 2; li++) {
      if (P[LEG_PART[li]] < 0.5 || inCar(fig)) continue;
      const hp = legs[li][0];
      const kn = legs[li][1];
      const ft = legs[li][2];
      const to = legs[li][3];
      const legId = id();
      p.heroThigh.push(along(hp, kn, 0.47, legK, fwd), jeansC, own, legId, ind);
      HL.set(li ? 'thighL' : 'thighR', 'thigh', _m);
      p.heroShin.push(along(kn, ft, 0.47, legK, fwd), jeansC, own, legId, ind);
      HL.set(li ? 'shinL' : 'shinR', 'shin', _m);
      _z.subVectors(to, ft);
      _z.y = 0;
      if (_z.lengthSq() < 1e-6) _z.copy(fwd);
      _z.normalize();
      _x.crossVectors(UP, _z).normalize();
      _c.copy(ft).addScaledVector(_z, 0.05 * S);
      _c.y = Math.max(_c.y - 0.02 * S, fig.pos.y + 0.04);
      framed(_c, _x, UP, _z, k, k, k, _mH);
      p.heroShoe.push(_mH, white, own, id(), ind);
      p.heroSole.push(_mH, linC(HERO_SOLE), own, id(), ind);
    }
    // ---- the head: the carved one, his face drawn on it, his hair and its locks, his ears
    if (P.head > 0.5) {
      const hs = fig.headScale * S;
      const hr = fig.hr;
      const hu = fig.hu;
      const hf = fig.hf;
      // (set lower on the neck than the rig's head: a short, strong neck, under a real jaw)
      const hc = _hcH.copy(j.headC).addScaledVector(hu, -0.058 * hs);
      p.heroHead.push(framed(hc, hr, hu, hf, hs, hs, hs), white, own, fig.headId, ind);
      HL.set('head', 'head', _m);
      const hat = L.hat && L.hat.kind;
      if (L.hair && L.hair.style !== 'none' && hat !== 'skimask') {
        framed(hc, hr, hu, hf, hs, hs, hs, _mH);
        p.heroHair.push(_mH, white, own, id(), ind);
        // (under a hat, the locks on top would come through it)
        if (!hat) p.heroLocks.push(_mH, white, own, id(), ind);
      }
      if (hat !== 'skimask') {
        const P3 = (x, y, z) => _c.copy(hc).addScaledVector(hr, x * hs).addScaledVector(hu, y * hs).addScaledVector(hf, z * hs);
        for (let sd = -1; sd <= 1; sd += 2) {
          // (an ear lies close against the head, leaning back a little; one drawing with the head -
          // ROADMAP 13.5: its rim, its bowl, its lobe, render/heroshapes.js heroEarGeo)
          P3(sd * 0.0735, -0.003, -0.016);
          _d.copy(hu).addScaledVector(hf, -0.22).normalize();
          _x.crossVectors(_d, hr).normalize();
          (sd > 0 ? p.heroEarR : p.heroEarL).push(framed(_c, hr, _d, _x, hs, hs, hs), skin, own, fig.headId, ind);
        }
        if (L.face && L.face.glasses === 'shades') {
          P3(0, 0.019, 0.092);
          p.boxP.push(framed(_c, hr, hu, hf, hs * 0.118, hs * 0.024, hs * 0.008), linC(SHADES), own, id(), ind);
        }
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
    // ---- his lines over all of it (render/herolines.js)
    if (this.lines && cam) {
      const ctx = _hCtx;
      ctx.cam = cam;
      ctx.L = _hL;
      ctx.Lr = _hR;
      ctx.dark = dark;
      ctx.t = performance.now() / 1000;
      ctx.dist = Math.hypot(cam.x - j.headC.x, cam.y - j.headC.y, cam.z - j.headC.z);
      HL.draw(this.lines, ctx);
    }
  }

  // (v5, ROADMAP 13.6) One of the city's people drawn as the hero is (render/folkspec.js): their own
  // body (render/folkshapes.js), their pictures turned over as his are, their lines - on the rig any
  // of the city's people walk, sit and turn on, in any pose of theirs
  drawFolk(fig, camDist) {
    const L = fig.look;
    const F = this.folk[L.folk];
    const fem = !!F.spec.fem;
    const q = F.sh;
    const j = fig.j;
    const P = fig.parts;
    const p = this.p;
    const own = fig.owner + 1;
    const ind = fig.indoor === 'casino' ? 4 : fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
    const S = fig.scale;
    const k = S * 0.98;
    const bulk = fig.bulk;
    const seed = (fig.seed % 1) * 0.37 + 0.11;
    _part[0] = seed;
    const id = nextPart;
    const ax = fig.ax;
    const rgt = fig.brgt;
    const fwd = fig.bfwd;
    // (ROADMAP 13.7: their pictures - their tile of the atlases, drawn the first time they are about -
    // and how their face is this frame)
    this.atlas.want(L.folk, camDist);
    _fTile[0] = L.folk + 1;
    // (on the game's clock: a face slows with the game, and stops when it stops)
    const now = shared.uTime.value;
    const gaze = faceOf(fig, F, now, this.camPos);
    const white = PAPER_W;
    const skin = F.skin;
    fig.headId = (seed * 7.77 + 0.31) % 1;
    const bw = k * Math.max(0.92, bulk * 0.96) * (fem ? 1.02 : 1.05) * F.girth;
    const HL = F.lines;
    const dress = !!q.skirt;
    // ---- (ROADMAP 19.2, GFX.folkLod) how many triangles their shapes have: by how many pixels a metre of them is on the
    // screen - the head from its own distance, the rest of them from their hips' (render/lod.js; each version kept until its
    // line is passed by 8%). Whole shapes for a person with a hole rubbed in them or being rubbed out (their holes and fade
    // are worked out on the surface, on every triangle of it), and in the film where a shot asks for it (fig.lodFull)
    let lvH = 0;
    let lvB = 0;
    if (GFX.folkLod && !GFX.off && this.ppmK > 0 && this.camPos && !fig.lodFull && !(fig.dissolve > 0) && !(fig.holes && fig.holes.length)) {
      const sc = this.ppmK * S;
      lvH = fig._lodH = lodLevel(sc / Math.max(0.5, this.camPos.distanceTo(j.headC)), LOD_HEAD, fig._lodH || 0);
      lvB = fig._lodB = lodLevel(sc / Math.max(0.5, this.camPos.distanceTo(j.hip)), LOD_BODY, fig._lodB || 0);
    } else if (fig._lodH || fig._lodB) fig._lodH = fig._lodB = 0;
    // ---- the jacket worn open, what is under it, its collar; the neck
    if (P.torso > 0.5) {
      const sy = Math.max(0.3, _b.subVectors(j.neck, j.hip).length()) / 0.5;
      framed(j.hip, rgt, ax, fwd, bw, sy, bw, _mH);
      // (its part's id kept: the jacket's cloth round the neck is the same part - q.band below)
      const tid = id();
      lite(q.torso, lvB).push(_mH, white, own, tid, ind);
      HL.set('torso', 'torso', _mH);
      lite(q.zip, lvB).push(_mH, white, own, id(), ind);
      lite(q.tee, lvB).push(_mH, white, own, id(), ind);
      if (q.welt) lite(q.welt, lvB).push(_mH, white, own, id(), ind);
      // (ROADMAP 18: a hoodie's hood, down on the back)
      if (q.hood) lite(q.hood, lvB).push(_mH, white, own, id(), ind);
      // (characters round) the neck: the head's own edge carried on down into the collar
      // (render/folkshapes.js neckOf), twisted and bent as the head is turned - the rig's (game/
      // doodle.js placeHead, render/neckbend.js); its lines with it
      const hs = fig.headScale * S;
      framed(fig.neckO, fig.neckR, fig.neckU, fig.neckF, hs, hs, hs, _mH);
      // (a face drawn as a portrait draws its neck itself, in one skin with it: the same picture,
      // the same pencil and light, no outline where they meet - render/portrait.js, part 7)
      const portN = P.head > 0.5 ? this.portraitFor(fig, L.folk, camDist) : null;
      if (portN && portN.neckN) {
        _mNk.copy(_mH);
        portN.neckD.fromArray(fig.neckD);
        fig.__neckP = portN;
      } else fig.__neckP = null;
      if (!(portN && portN.neckN) || portN.fade < 0.999) lite(q.neck, lvB).push(_mH, F.face, own, fig.headId, ind, fig.neckD);
      // (characters round 3) no collar of its own: the jacket's cloth carried on up round the neck's
      // foot and turned in onto it - made on their own neck, bent and turned with it, the jacket's part
      // (render/heroshapes.js neckbandGeo); round a neck the portrait draws too
      lite(q.band, lvB).push(_mH, white, own, tid, ind, fig.neckD);
      HL.set('neck', 'neck', _mH, null, null, false, fig.neckD);
    }
    // ---- the seat, and a dress's skirt from the waist over the thighs
    if (P.pelvis > 0.5) {
      framed(j.hip, fig.prgt, ax, fig.pfwd, bw, k, bw, _mH);
      lite(q.pelvis, lvB).push(_mH, white, own, id(), ind);
      HL.set('pelvis', 'pelvis', _mH);
      if (dress) {
        lite(q.skirt, lvB).push(_mH, white, own, id(), ind);
        HL.set('skirt', 'skirt', _mH);
      }
    }
    // ---- the arms in their sleeves, the hands; a watch on the left wrist
    const arms = fig._armJ || (fig._armJ = [[j.shoulderR, j.elbowR, j.handR], [j.shoulderL, j.elbowL, j.handL]]);
    const armK = k * Math.max(1, bulk * 0.85) * (fig.limbs || 1);
    // (round 25: drawn with whole hands that close round what they hold - game/carry.js fullHands)
    fig._fullHands = true;
    fig._handK = 0.98 * (fem ? 0.88 : 1);
    for (let ai = 0; ai < 2; ai++) {
      if (P[ARM_PART[ai]] < 0.5) continue;
      const sh = arms[ai][0];
      const el = arms[ai][1];
      const hd = arms[ai][2];
      const armId = id();
      lite(q.upper, lvB).push(along(sh, el, 0.31, armK * 1.08, fwd), white, own, armId, ind);
      HL.set(ai ? 'upperL' : 'upperR', 'upper', _m);
      lite(q.fore, lvB).push(along(el, hd, 0.29, armK * 1.06, fwd), white, own, armId, ind);
      HL.set(ai ? 'foreL' : 'foreR', 'fore', _m);
      _c.subVectors(hd, el).normalize();
      _d.copy(hd).addScaledVector(_c, (fem ? 0.17 : 0.19) * S);
      // (round 24, the player's word: Lily's hands unnatural as she drew, the pencils part of her hand -
      // her right hand now closed round her pencil as the hero's is round his: fig.grip, the way the
      // pencil lies across the fist - game/prologue/page.js; bent at the wrist to lie square across it)
      // (round 25, the player's word: her hands through what she held, the ice cream and the page, and
      // maybe the wrong way round - the left closed round the page's edge too, fig.gripL; an ice cream's
      // cone upright in the fist, thumb up - game/carry.js puts it in the fist's hollow (fullHands))
      const held = ai === 0 ? fig.carry : fig.carryL;
      const grip = (ai === 0 ? fig.grip : fig.gripL) || (held === 'icecream' ? UP : null);
      if (grip) {
        _gw.copy(_c).addScaledVector(grip, -_c.dot(grip));
        if (_gw.lengthSq() > 1e-6) _d.copy(hd).addScaledVector(_gw.normalize(), (fem ? 0.17 : 0.19) * S);
      }
      // (an open hand reaching out in front: its thumb up - turned by the body's front alone, the
      // hand along it had no way round to turn, and a hand reaching forward came out any way round)
      let hRef = grip || fwd;
      if (!grip) {
        const dd = Math.abs(_c.dot(fwd));
        if (dd > 0.55) {
          const b = Math.min(1, (dd - 0.55) / 0.3);
          hRef = _hRef.copy(fwd).multiplyScalar(1 - b).addScaledVector(UP, b).normalize();
        }
      }
      lite(ai === 0 ? (grip ? p.heroGripR : p.heroHandR) : grip ? p.heroGripL : p.heroHandL, lvB).push(along(hd, _d, 0.19, k * (fem ? 0.88 : 1), hRef), skin, own, id(), ind);
      if (ai === 1 && F.watch) {
        _a.copy(hd).addScaledVector(_c, -0.025 * S);
        _x.copy(rgt).multiplyScalar(-1).addScaledVector(_c, rgt.dot(_c)).normalize();
        _z.crossVectors(_c, _x).normalize();
        p.sphere.push(framed(_a, _x, _c, _z, 0.036 * S, 0.011 * S, 0.033 * S), F.watch, own, id(), ind);
        _a.addScaledVector(_x, 0.029 * S);
        p.boxP.push(framed(_a, _c, _x, _z, 0.024 * S, 0.008 * S, 0.024 * S), linC(DIAL), own, id(), ind);
      }
    }
    // ---- the legs, the shoes (a dress: the legs bare under it)
    const legs = fig._legJ || (fig._legJ = [[j.hipR, j.kneeR, j.footR, j.toeR], [j.hipL, j.kneeL, j.footL, j.toeL]]);
    const legK = k * Math.max(1, bulk * 0.9) * (fig.limbs || 1);
    const fk = k * (fem ? 0.9 : 1);
    for (let li = 0; li < 2; li++) {
      if (P[LEG_PART[li]] < 0.5 || inCar(fig)) continue;
      const hp = legs[li][0];
      const kn = legs[li][1];
      const ft = legs[li][2];
      const to = legs[li][3];
      const legId = id();
      lite(q.thigh, lvB).push(along(hp, kn, 0.47, legK, fwd), white, own, legId, ind);
      if (!dress) HL.set(li ? 'thighL' : 'thighR', 'thigh', _m);
      lite(q.shin, lvB).push(along(kn, ft, 0.47, legK, fwd), white, own, legId, ind);
      if (!dress) HL.set(li ? 'shinL' : 'shinR', 'shin', _m);
      _z.subVectors(to, ft);
      _z.y = 0;
      if (_z.lengthSq() < 1e-6) _z.copy(fwd);
      _z.normalize();
      _x.crossVectors(UP, _z).normalize();
      _c.copy(ft).addScaledVector(_z, 0.05 * S);
      _c.y = Math.max(_c.y - 0.02 * S, fig.pos.y + 0.04);
      framed(_c, _x, UP, _z, fk, fk, fk, _mH);
      lite(q.shoe, lvB).push(_mH, white, own, id(), ind);
      lite(p.heroSole, lvB).push(_mH, F.sole, own, id(), ind);
    }
    // ---- the head: its face drawn on it, the hair (its cap, its locks, a fall of it, a bun), the ears
    // (characters round 2: under a ski mask none of it - the mask is the rig's own shape, over the
    // head - and under a hat no locks or bun to come through it)
    const hatK = L.hat && L.hat.kind;
    if (P.head > 0.5 && hatK !== 'skimask') {
      const hs = fig.headScale * S;
      const hr = fig.hr;
      const hu = fig.hu;
      const hf = fig.hf;
      const hc = _hcH.copy(j.headC).addScaledVector(hu, -0.058 * hs);
      // (ROADMAP 14.1) near: the face drawn as a portrait is (render/portrait.js) - its muscles' moves,
      // its teeth, its eyes, shaded by the light; the hair, the glasses and the ears as ever
      const port = this.portraitFor(fig, L.folk, camDist);
      if (port) {
        unmirror(framed(hc, hr, hu, hf, hs, hs, hs, _mP));
        const fdt = Math.min(0.1, Math.max(0, now - (port.lastT || now)));
        port.lastT = now;
        let mood = fig.mood || (fig.feel && fig.feel.until > now ? fig.feel.mood : null);
        if (fig.dead > 0) mood = 'dead';
        else if (!mood) {
          if (fig.flail > 0 || fig.armsUp > 0.3 || fig.surrender > 0) mood = 'scared';
          else if (fig.recoil > 0.2 || fig.stagger > 0) mood = 'hurt';
          else if (fig.punch >= 0 || fig.kick >= 0 || fig.guard > 0.3) mood = 'angry';
        }
        port.update(fdt, _fEw, mood, fig.__portrait || null, fig.say && !fig.say.done ? fig.say.tone : null, gaze);
        port.place(_mP);
        // (its neck: from the neck's frame into the head's - render/portrait.js part 7)
        // (no neck drawn for them this frame - their body hidden: none under the portrait either)
        if (port.neckToHead) {
          if (fig.__neckP === port) port.neckToHead.copy(_mP).invert().multiply(_mNk);
          else port.neckToHead.makeScale(0, 0, 0);
        }
        fig.__neckP = null;
        // (characters round 2) the face's own ink - its outline, its features, its shading - kept over
        // the portrait while it is small on the screen and going as the portrait's own pencil comes in
        // (render/glsl.js PORTRAIT gDet: as the face grows from 80 to 170 of the drawing's pixels): at
        // no size, and at no moment of its coming in, is the face without its lines
        HL.set('head', 'head', _mP, _fEw, gaze, port.fade * Math.max(0, Math.min(1, ((port.px || 0) - 95) / 110)));
      }
      // (the city's way of drawing the face - under the portrait while it comes in or goes)
      if (!port || port.fade < 0.999) {
        lite(q.head, lvH).push(framed(hc, hr, hu, hf, hs, hs, hs), F.face, own, fig.headId, ind);
        if (!port) HL.set('head', 'head', _m, _fEw, gaze);
      }
      framed(hc, hr, hu, hf, hs, hs, hs, _mH);
      lite(q.hair, lvB).push(_mH, white, own, id(), ind);
      if (q.locks && !hatK) lite(q.locks, lvB).push(_mH, white, own, id(), ind);
      if (q.fall) lite(q.fall, lvB).push(_mH, white, own, id(), ind);
      if (q.bun && !hatK) lite(q.bun, lvB).push(_mH, white, own, id(), ind);
      if (q.tail) lite(q.tail, lvB).push(_mH, white, own, id(), ind);
      if (q.glasses) q.glasses.push(_mH, F.glasses, own, id(), ind);
      // (their eyes in their sockets, each turned to where they look. The head's frame is drawn
      // mirrored - DrawClass.push - and the eyes' with it: each in the mirror's place)
      _eyeR.makeRotationFromEuler(_eyeE.set(-gaze[3], gaze[2], 0, 'YXZ'));
      for (let e = 0; e < (port && port.fade >= 0.999 ? 0 : 2); e++) {
        const c = F.eyes[e];
        _eyeT.makeTranslation(-c[0], c[1], c[2]).multiply(_eyeR);
        _eyeM.multiplyMatrices(_mH, _eyeT);
        (lvH > 0 && p.folkEyeR1 ? (e ? p.folkEyeL1 : p.folkEyeR1) : e ? p.folkEyeL : p.folkEyeR).push(_eyeM, F.face, own, fig.headId, ind);
      }
      // (their ears are their head's; earrings at the lobes)
      if (F.earsOn && F.earring) {
        for (const v of F.lobes) {
          _c.copy(hc).addScaledVector(hr, v[0] * hs).addScaledVector(hu, v[1] * hs).addScaledVector(hf, v[2] * hs);
          p.sphere.push(framed(_c, hr, hu, hf, 0.0055 * hs, 0.008 * hs, 0.0055 * hs), F.earring, own, id(), ind);
        }
      }
      // (ROADMAP 18) what is worn in the hair - a clip, beads on a braid, a feather (render/
      // folkshapes.js hairBits): in the head's frame (its x towards their left, as the lobes'), each a
      // small shape in its colour
      if (F.bits && !hatK) {
        for (const b of F.bits) {
          _c.copy(hc).addScaledVector(hr, b.c[0] * hs).addScaledVector(hu, b.c[1] * hs).addScaledVector(hf, b.c[2] * hs);
          _x.copy(hr).multiplyScalar(b.x[0]).addScaledVector(hu, b.x[1]).addScaledVector(hf, b.x[2]);
          _y.copy(hr).multiplyScalar(b.y[0]).addScaledVector(hu, b.y[1]).addScaledVector(hf, b.y[2]);
          _z.copy(hr).multiplyScalar(b.z[0]).addScaledVector(hu, b.z[1]).addScaledVector(hf, b.z[2]);
          p.sphere.push(framed(_c, _x, _y, _z, b.r[0] * hs, b.r[1] * hs, b.r[2] * hs), b.col, own, id(), ind);
        }
      }
    }
    // ---- what they hold (the rig's own shapes; their hair is their own, above)
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
    // ---- their lines over all of it (render/herolines.js), near enough to be seen
    const cam = this.camPos;
    if (this.lines && cam) {
      const sun = shared.uSunCol.value;
      const dark = fig.indoor ? 1 : Math.max(0, Math.min(1, 1 - (sun.r + sun.g + sun.b) / 1.4));
      _hx.set(cam.x - fig.pos.x, 0, cam.z - fig.pos.z);
      if (_hx.lengthSq() < 1e-4) _hx.set(0, 0, 1);
      _hx.normalize();
      _hz.set(_hx.z, 0, -_hx.x);
      const sd = shared.uSunDir.value;
      _fL.set(_hx.x + _hz.x * 0.75, 0.65, _hx.z + _hz.z * 0.75).normalize().multiplyScalar(dark).addScaledVector(sd, 1 - dark).normalize();
      _fR.set(-_hx.x * 0.25 - _hz.x, 0.15, -_hx.z * 0.25 - _hz.z).normalize();
      const ctx = _fCtx;
      ctx.cam = cam;
      ctx.L = _fL;
      ctx.Lr = _fR;
      ctx.dark = dark;
      ctx.t = performance.now() / 1000;
      // (farther than this, their pictures alone)
      ctx.dist = camDist < 9 ? Math.hypot(cam.x - j.headC.x, cam.y - j.headC.y, cam.z - j.headC.z) : 99;
      // (ROADMAP 13.7: however many of them are near, the frame's lines are shared out - the nearer,
      // the more of them; the hero's always his)
      ctx.budget = Math.min(Math.round(HL.budget * Math.min(1, (3.4 / Math.max(1, ctx.dist)) ** 0.7)), this.folkLines);
      ctx.used = 0;
      if (ctx.budget > 40) HL.draw(this.lines, ctx);
      this.folkLines -= ctx.used;
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
    const ind = fig.indoor === 'casino' ? 4 : fig.indoor === 'club' ? 3 : fig.indoor ? 1 : 0;
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
      const prgt = fig.prgt;
      const pfwd = fig.pfwd;
      p.lowPelvis.put(aux, framed(_a, prgt, ax, pfwd, k * bulk * (L.fem ? 1.06 : 1), k, k * bulk), longSkirt ? skirtC : botC, own, id(), ind);
      if (midi && P.torso > 0.5 && fig.sit < 0.3) {
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        const sw = Math.sin(fig.phase) * 0.06 * Math.min(1, fig.speed / 1.4);
        _c.copy(pfwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
        p.lowMidi.put(aux, framed(_a, prgt, _c, _d.crossVectors(prgt, _c), k * bulk, k * (1 - fig.crouch * 0.4), k * bulk), botC, own, id(), ind);
      }
      if (longSkirt && P.torso > 0.5) {
        _a.copy(j.hip).addScaledVector(ax, 0.05 * S);
        const kk = k * bulk;
        if (fig.sit < 0.3) {
          const sw = Math.sin(fig.phase) * 0.05 * Math.min(1, fig.speed / 1.4);
          _c.copy(pfwd).multiplyScalar(Math.sin(sw)).addScaledVector(ax, Math.cos(sw));
          p.lowSkirt.put(aux, framed(_a, prgt, _c, _d.crossVectors(prgt, _c), kk, k * (1 - fig.crouch * 0.4), kk), skirtC, own, id(), ind);
        } else {
          p.lowSkirt.put(aux, framed(_a, prgt, ax, pfwd, kk, k * 0.32, kk), skirtC, own, id(), ind);
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
      if (P[LEG_PART[li]] < 0.5 || inCar(fig)) continue;
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
// (v5, ROADMAP 13.1) the hero's pictures in the order of his draw's pens; what is drawn in them is
// drawn in their own colours (white: the picture as it is); his chain, his watch
const HERO_PICS = ['heroFace', 'heroHair', 'heroJacket', 'heroPants', 'heroBoots'];
const HERO_SET = ['face', 'hair', 'jacket', 'pants', 'boots'];
const PAPER_W = [1, 1, 1];
const HERO_LEATHER = [0.2, 0.15, 0.13];
const HERO_JEANS = [0.14, 0.14, 0.16];
const HERO_SOLE = [0.62, 0.6, 0.58];
const CHAIN = [0.78, 0.78, 0.8];
const WATCH = [0.1, 0.09, 0.09];
const DIAL = [0.72, 0.72, 0.75];
const _heroTex = {};
const _keyC = new THREE.Color(1.0, 0.62, 0.68);
const _hx = new THREE.Vector3();
const _hz = new THREE.Vector3();
const _hL = new THREE.Vector3();
const _hR = new THREE.Vector3();
const _hCtx = { cam: null, L: null, Lr: null, dark: 0, t: 0, dist: 0 };
// (ROADMAP 13.6: the city's people's drawn as he is - drawFolk)
const _fCtx = { cam: null, L: null, Lr: null, dark: 0, t: 0, dist: 0 };
const _fL = new THREE.Vector3();
const _fR = new THREE.Vector3();
const _rimC = new THREE.Color(0.32, 0.82, 1.0);
const _chain = HERO.heroChainPts();
const _hc = new THREE.Vector3();
const _hr = new THREE.Vector3();
const _hu = new THREE.Vector3();
// (v5, ROADMAP 13.1) his drawing's own colours, or tinted towards another colour he wears (bought, or
// splashed with paint): the colour over the drawing's own, in linear light, kept while it is the same
function heroTint(fig, col, own, key) {
  if (fig[key + 'Of'] !== col) {
    fig[key + 'Of'] = col;
    const same = Math.abs(col[0] - own[0]) + Math.abs(col[1] - own[1]) + Math.abs(col[2] - own[2]) < 0.02;
    const a = lin3(col[0], col[1], col[2]);
    const b = lin3(own[0], own[1], own[2]);
    fig[key] = same ? PAPER_W : [0, 1, 2].map((i) => Math.min(4, a[i] / Math.max(1e-3, b[i])));
  }
  return fig[key];
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
