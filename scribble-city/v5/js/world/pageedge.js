import * as THREE from 'three';
import { makeSurface, srgb, canvasTexture, shared } from '../render/materials.js';
import { nextId, canvas, seeded } from './kit.js';
import { PAGE, PAGE_BAND, DESK_Y, groundHeight } from './layout.js';
import { pageUniforms } from '../render/pagedge.js';

// (v5) The whole city is drawn on a page of a notebook, and here is where the page ends.
//
// Out at the very edges of the world - past the beaches, past the hills' crests - the drawing thins
// out to the bare paper (render/pagedge.js: the pens grow lighter, the colouring breaks into its
// strokes, the pencil's construction lines show through, then the ruled lines, the red line of the
// margin, the holes of the binding down the left side). Then the paper ends: its edge, the pages
// under it in a cliff of thin layers, the notebook's cover under them, lying on a desk - its wood
// dim, darker in the page's shadow. The binding's wire comes up through the holes and round the
// edge in big loops. Behind the hills, where only what flies goes, a pencil lies on the desk by
// the corner of the page, and the crumbs of its eraser.
//
// All of it a few draws: the desk, the pages' edge and the cover, the wire, the pencil, the crumbs.
// Nothing moves; what changes with the light is one colour a frame (the paper's, for the ink pass).

const SHEET = 1.4;
const COVER = 2.4;
// (the binding: a loop every 90 m down the left edge, through holes near it)
const COIL_R = 24;
const COIL_GAP = 90;
const COIL_TUBE = 1.5;

export function buildPageEdge(ctx) {
  const P = PAGE;
  const r = seeded(20261103);
  const group = new THREE.Group();
  group.name = 'pageEdge';
  ctx.parent.add(group);
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    geo.computeBoundingSphere();
    group.add(m);
    return m;
  };
  // ---- the desk
  const deskMat = makeSurface({ kind: 'ground', map: woodTexture(), vcolor: true, ang: 0.08, line: 0.35, wash: 0.7, density: 0.75 });
  const deskId = nextId();
  add(deskGeometry(P, deskId), deskMat, 'pageDesk');
  // ---- the pages' edge and the cover under them
  const stackMat = makeSurface({ kind: 'uv', map: stackTexture(), vcolor: true, ang: 1.5708, line: 0.5, wash: 0.82, density: 0.6 });
  add(stackGeometry(P, r), stackMat, 'pageStack');
  // ---- the binding's wire, round the left edge
  const wireMat = makeSurface({ kind: 'cyl', color: srgb(0.78, 0.8, 0.86), gloss: 0.8, line: 0.6, partR: 1.5 });
  const coil = coilGeometry(P);
  add(coil.geo, wireMat, 'pageWire');
  // ---- a pencil by the corner behind the hills, the eraser's crumbs
  const pen = pencilGeometry(P, r, deskId);
  add(pen.geo, makeSurface({ kind: 'box', vcolor: true, gloss: 0.25, line: 0.7, wash: 0.75 }), 'pagePencil');
  // (its shadow: the desk's own wood a little above it, darker - one thing with the desk to the
  // outlines, so no line is drawn round it)
  add(pen.shadow, deskMat, 'pageShadow');
  // ---- the shader's side of it: where the page is, its holes, the paper's colour; and what is
  // printed in the space at the top of the page, by its right-hand corner - DATE and No., their
  // lines waiting to be filled in (render/pagedge.js prints them on the paper)
  const U = pageUniforms;
  U.uPage.value.set(P.x0, P.z0, P.x1, P.z1);
  U.uPageK.value.set(PAGE_BAND, 1, 80, 190);
  U.uPageHole.value.set(coil.holeX, COIL_GAP, coil.holeR, coil.z0);
  {
    const w = 520;
    const h = w / 8;
    U.uPageHead.value = headerTexture();
    U.uPageHeadRect.value.set(P.x1 - 120 - w, P.z0 + 72 - h / 2, P.x1 - 120, P.z0 + 72 + h / 2);
  }
  ctx.pageVerts = 0;
  for (const m of group.children) {
    // (far things, always there: never culled by the chunks' distances)
    m.frustumCulled = true;
    m.userData.noReflect = true;
    ctx.pageVerts += m.geometry.attributes.position.count;
  }
  ctx.pageEdgeUpdate = updatePaper;
  updatePaper();
  return group;
}

// the paper's colour as the light falls on it now, for the ink pass (render/pagedge.js) - the way a
// white page lying flat in the sun is lit (render/glsl.js: ambient from the sky, the sun's key light)
const _paper = new THREE.Color();
const _alb = srgb(0.97, 0.955, 0.915);
const _desk = srgb(0.34, 0.22, 0.14);
function updatePaper() {
  const S = shared;
  const sd = S.uSunDir.value;
  let light = Math.min(1, Math.max(0, sd.y * 1.7 + 0.06));
  const oc = S.uOvercast ? S.uOvercast.value : 0;
  if (oc > 0) light = light + (0.62 - light) * oc * 0.85;
  const top = S.uSkyTop.value;
  const sun = S.uSunCol.value;
  // (the paper of the drawing, as an erased spot shows it - render/glsl.js mPaper: its own cream,
  // between its shade and its light, the sky's tint in it and as dim as the hour)
  const day = Math.min(1, Math.max(0.3, 0.32 + 2.2 * (top.r * 0.2126 + top.g * 0.7152 + top.b * 0.0722)));
  const k = (0.6 + 0.4 * light) * day * 0.8;
  const sl = Math.max(1e-3, sun.r * 0.2126 + sun.g * 0.7152 + sun.b * 0.0722);
  _paper.setRGB(1 + (sun.r / sl - 1) * 0.12 * light, 1 + (sun.g / sl - 1) * 0.12 * light, 1 + (sun.b / sl - 1) * 0.12 * light);
  const pap = S.uPaper ? S.uPaper.value : _alb;
  const U = pageUniforms;
  U.uPagePaper.value.setRGB(pap.r * _paper.r * k, pap.g * _paper.g * k, pap.b * _paper.b * k);
  // (the desk deep down in the binding's holes, in the page's shadow)
  U.uPageDesk.value.setRGB(_desk.r * top.r * 0.5, _desk.g * top.g * 0.5, _desk.b * top.b * 0.5);
  // (the haze's colour low down, as render/glsl.js applyFog mixes it: the sky near the horizon, a
  // little of the sun's glow in it, most of the sky's top)
  if (S.uSkyHorizon && S.uSkyMid && S.uSkySun) {
    U.uPageFog.value.copy(S.uSkyHorizon.value).lerp(S.uSkyMid.value, 0.12).lerp(S.uSkySun.value, 0.17).lerp(top, 0.62).multiplyScalar(0.85);
  }
}

// ------------------------------------------------------------------ the desk
// a frame of wood round the page, out to past where the eye reaches; under the page's edge its
// shadow, soft, darkest where the pages stand on it
// (a dim desk: the lamp is on the page; darkest in the page's shadow at its foot - out by ring[i]
// from the page, shade[i])
const DESK_RING = [0, 4, 14, 34, 70, 3200];
const DESK_SHADE = [0.26, 0.36, 0.47, 0.58, 0.68, 0.7];
// the desk's shade at x, z (as its rings have it, in between them as their triangles blend it)
function deskShade(P, x, z) {
  const d = Math.max(P.x0 - x, x - P.x1, P.z0 - z, z - P.z1, 0);
  for (let i = 0; i + 1 < DESK_RING.length; i++) {
    if (d <= DESK_RING[i + 1]) return DESK_SHADE[i] + ((DESK_SHADE[i + 1] - DESK_SHADE[i]) * (d - DESK_RING[i])) / (DESK_RING[i + 1] - DESK_RING[i]);
  }
  return DESK_SHADE[DESK_SHADE.length - 1];
}

function deskGeometry(P, id) {
  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  const y = DESK_Y;
  const ring = DESK_RING;
  const shade = DESK_SHADE;
  // each ring a rectangle round the page, out by ring[i]
  const corners = (d) => [[P.x0 - d, P.z0 - d], [P.x1 + d, P.z0 - d], [P.x1 + d, P.z1 + d], [P.x0 - d, P.z1 + d]];
  const base = new THREE.Color();
  for (let i = 0; i < ring.length; i++) {
    for (const [x, z] of corners(ring[i])) {
      pos.push(x, y, z);
      uv.push(x / 520, z / 520);
      base.setRGB(1, 1, 1).multiplyScalar(shade[i]);
      col.push(base.r, base.g, base.b);
    }
  }
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      // (wound to face up)
      idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(id), 1));
  g.setIndex(idx);
  fixWinding(g, [0, 1, 0]);
  return g;
}

// the wood: long grain, wavering, a knot or two, a warm dark brown
function woodTexture() {
  const W = 256;
  const H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a33';
  g.fillRect(0, 0, W, H);
  const r = seeded(9001);
  for (let i = 0; i < 140; i++) {
    const x0 = r() * W;
    const w = 0.6 + r() * 2.4;
    const dark = r() < 0.55;
    g.strokeStyle = dark ? `rgba(48, 30, 20, ${0.25 + r() * 0.35})` : `rgba(150, 110, 78, ${0.15 + r() * 0.25})`;
    g.lineWidth = w;
    g.beginPath();
    const ph = r() * 6.28;
    const amp = 2 + r() * 7;
    for (let y = 0; y <= H; y += 16) {
      const x = x0 + Math.sin(y * 0.012 + ph) * amp + Math.sin(y * 0.041 + ph * 2) * amp * 0.3;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // knots
  for (let k = 0; k < 3; k++) {
    const kx = 30 + r() * (W - 60);
    const ky = 100 + r() * (H - 200);
    for (let j = 7; j > 0; j--) {
      g.strokeStyle = `rgba(40, 24, 16, ${0.12 + j * 0.03})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(kx, ky, j * 3.2, j * 7.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return canvasTexture(c, { repeat: true });
}

// the header's print: DATE and No. and their lines, in the blue-grey of a notebook's printing
function headerTexture() {
  const W = 1024;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const ink = '#6f86a8';
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.font = '700 54px "Rubik", sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText('DATE', 24, 86);
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(190, 90);
  g.lineTo(640, 90);
  g.stroke();
  g.fillText('No.', 700, 86);
  g.beginPath();
  g.moveTo(800, 90);
  g.lineTo(1000, 90);
  g.stroke();
  const t = canvasTexture(c);
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ the pages' edge
// down each side of the page: the top page's own edge, then the pages under it (the same paper,
// in thin layers - none quite in line with the next), the cover at the foot, a little wider
function stackGeometry(P, r) {
  const pos = [];
  const col = [];
  const uv = [];
  const nor = [];
  const ids = [];
  const quad = (a, b, c, d, n, cl, id) => {
    const o = pos.length / 3;
    for (const p of [a, b, c, d]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
      col.push(cl[0], cl[1], cl[2]);
      ids.push(id);
    }
    // (the face's uv: along it in metres, up it in the stack's own layers)
    const along = (p) => (Math.abs(n[0]) > 0.5 ? p[2] : p[0]) / 64;
    const up = (p) => (p[1] - DESK_Y) / (SHEET * 64);
    uv.push(along(a), up(a), along(b), up(b), along(c), up(c), along(d), up(d));
    return o;
  };
  const idx = [];
  const face = (x0, z0, x1, z1, yTop, yBot, n, cl, id) => {
    const o = quad([x0, yBot, z0], [x1, yBot, z1], [x1, yTop, z1], [x0, yTop, z0], n, cl, id);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const top = (x0, z0, x1, z1, y, cl, id) => {
    const o = quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], cl, id);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const paper = [1, 1, 1];
  // the page's own ground at its edge: the sea's level, or the margin's behind the hills
  const yTopAt = (x, z) => (groundHeight(Math.min(P.x1 - 0.5, Math.max(P.x0 + 0.5, x)), Math.min(P.z1 - 0.5, Math.max(P.z0 + 0.5, z))) > -0.5 ? 0.13 : -0.8);
  // each side in pieces (so its top follows the ground: the sea, the margin), its layers stepping
  // in and out a little
  const layers = [];
  let y = 0;
  while (y > DESK_Y + COVER + SHEET * 2) {
    const n = r.int(2, 5);
    const h = Math.min(n * SHEET, y - (DESK_Y + COVER));
    // (each a little out from the one over it, now and then a little in: their edges show from above)
    const k = layers.length;
    layers.push({ y0: y, y1: y - h, off: y === 0 ? 0 : Math.max(0, 0.6 * k + r.range(-1.4, 1.8)), tint: r.range(0.93, 1.0) });
    y -= h;
  }
  layers.push({ y0: y, y1: DESK_Y + COVER, off: r.range(-1, 2), tint: 0.97 });
  const sides = [
    // [a: start corner, b: end corner, normal]
    { a: [P.x0, P.z1], b: [P.x0, P.z0], n: [-1, 0, 0] },
    { a: [P.x1, P.z0], b: [P.x1, P.z1], n: [1, 0, 0] },
    { a: [P.x0, P.z0], b: [P.x1, P.z0], n: [0, 0, -1] },
    { a: [P.x1, P.z1], b: [P.x0, P.z1], n: [0, 0, 1] },
  ];
  for (const s of sides) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const ux = (s.b[0] - s.a[0]) / len;
    const uz = (s.b[1] - s.a[1]) / len;
    const pieces = Math.ceil(len / 60);
    for (let k = 0; k < pieces; k++) {
      const t0 = (k / pieces) * len;
      const t1 = ((k + 1) / pieces) * len;
      const xa = s.a[0] + ux * t0;
      const za = s.a[1] + uz * t0;
      const xb = s.a[0] + ux * t1;
      const zb = s.a[1] + uz * t1;
      const yt = yTopAt((xa + xb) / 2, (za + zb) / 2);
      const id = nextId();
      for (const L of layers) {
        const ya = L.y0 === 0 ? yt : L.y0;
        if (ya <= L.y1) continue;
        // (a layer out a little from the one over it: its own strip of top showing)
        const ox = s.n[0] * L.off;
        const oz = s.n[2] * L.off;
        const c = [paper[0] * L.tint, paper[1] * L.tint, paper[2] * (L.tint - 0.02)];
        face(xa + ox, za + oz, xb + ox, zb + oz, ya, L.y1, s.n, c, id);
        if (L.off > 0.05) top(Math.min(xa, xa + ox), Math.min(za, za + oz), Math.max(xb, xb + ox) + (s.n[2] ? 0 : 0), Math.max(zb, zb + oz), ya, c, id);
      }
      // the cover, under it all: wider by a few metres, its own dark blue
      const co = 13;
      const cc = [0.16, 0.2, 0.42];
      face(xa + s.n[0] * co, za + s.n[2] * co, xb + s.n[0] * co, zb + s.n[2] * co, DESK_Y + COVER, DESK_Y, s.n, cc, id);
      top(Math.min(xa, xa + s.n[0] * co), Math.min(za, za + s.n[2] * co), Math.max(xb, xb + s.n[0] * co), Math.max(zb, zb + s.n[2] * co), DESK_Y + COVER, cc, id);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(ids, 1));
  g.setIndex(idx);
  fixWinding(g);
  return g;
}

// the stack's face: thin layers of paper, each a little different, a fine grey line between them
function stackTexture() {
  const W = 64;
  const H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const r = seeded(4711);
  for (let y = 0; y < H; y += 8) {
    const t = 236 + Math.floor(r() * 16);
    g.fillStyle = `rgb(${t}, ${t - 3}, ${t - 12})`;
    g.fillRect(0, y, W, 8);
    g.fillStyle = `rgba(110, 104, 112, ${0.35 + r() * 0.35})`;
    g.fillRect(0, y + 7, W, 1);
  }
  return canvasTexture(c, { repeat: true });
}

// ------------------------------------------------------------------ the binding
// a loop of wire through each hole near the left edge, round the edge and the pages under it, its
// foot down on the desk; each loop leaning a little along the edge, as a coil's turns do
function coilGeometry(P) {
  const yTop = 0.13;
  const R = COIL_R;
  // (its foot just on the desk, by the cover's edge)
  const cy = DESK_Y + R + 0.3;
  const cx = P.x0 - 2;
  // (each turn leans along the edge, as a coil's do)
  const TILT = 0.12;
  // (where the loop goes down through the paper: the hole's centre, on the page - in from the edge)
  const dx = Math.sqrt(Math.max(1, R * R - (yTop - cy) * (yTop - cy)));
  const holeX = cx - P.x0 + dx * Math.cos(TILT);
  const z0 = P.z0 + 70;
  const parts = [];
  for (let z = z0; z < P.z1 - 50; z += COIL_GAP) {
    const t = new THREE.TorusGeometry(R, COIL_TUBE, 8, 48);
    t.rotateY(TILT);
    t.translate(cx, cy, z);
    parts.push(t);
  }
  const geo = mergeAll(parts);
  return { geo, holeX, holeR: COIL_TUBE * 2.6, z0: z0 - dx * Math.sin(TILT) };
}

// ------------------------------------------------------------------ the pencil, the crumbs
// lying on the desk by the page's corner behind the hills, its point to the page: six faces of
// yellow paint, the ferrule, the pink eraser worn round, the wood sharpened to the lead
function pencilGeometry(P, r, deskId) {
  const parts = [];
  const paint = (g, c) => {
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const lin = (r0, g0, b0) => {
    const c = srgb(r0, g0, b0);
    return [c.r, c.g, c.b];
  };
  const Rp = 34;
  const body = 1500;
  const cone = 150;
  const lead = 46;
  const ferrule = 90;
  const eraser = 70;
  // along +x in its own frame, lying on a face (its flat down: a hexagon's apothem over the desk)
  const yAxis = DESK_Y + Rp * Math.cos(Math.PI / 6);
  // (a six-sided prism along x: one of its faces flat down, as it lies)
  const hex6 = (len, rr, c) => {
    const g = new THREE.CylinderGeometry(rr, rr, len, 6, 1, false);
    g.rotateZ(Math.PI / 2);
    return paint(g, c);
  };
  // the body
  const b = hex6(body, Rp, lin(0.98, 0.78, 0.16));
  b.translate(0, 0, 0);
  parts.push(b);
  // the stripes of darker paint along its edges (thin, a little proud of the faces)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const s = new THREE.BoxGeometry(body, 1.6, 1.6);
    s.translate(0, Math.cos(a) * Rp * 0.995, Math.sin(a) * Rp * 0.995);
    parts.push(paint(s, lin(0.85, 0.6, 0.1)));
  }
  // the wood, sharpened (a cone over six faces), the lead
  const wood = new THREE.ConeGeometry(Rp, cone, 6, 1, true);
  wood.rotateZ(-Math.PI / 2);
  wood.translate(body / 2 + cone / 2, 0, 0);
  parts.push(paint(wood, lin(0.93, 0.78, 0.58)));
  const ld = new THREE.ConeGeometry(Rp * (lead / cone) * 1.05, lead, 12);
  ld.rotateZ(-Math.PI / 2);
  ld.translate(body / 2 + cone - lead / 2 + 2, 0, 0);
  parts.push(paint(ld, lin(0.22, 0.22, 0.26)));
  // the ferrule, its rings, the eraser
  const fe = new THREE.CylinderGeometry(Rp * 1.04, Rp * 1.04, ferrule, 24);
  fe.rotateZ(Math.PI / 2);
  fe.translate(-body / 2 - ferrule / 2, 0, 0);
  parts.push(paint(fe, lin(0.78, 0.78, 0.8)));
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.TorusGeometry(Rp * 1.05, 2.2, 6, 24);
    ring.rotateY(Math.PI / 2);
    ring.translate(-body / 2 - 12 - k * 22, 0, 0);
    parts.push(paint(ring, lin(0.66, 0.66, 0.7)));
  }
  const er = new THREE.CylinderGeometry(Rp * 0.97, Rp * 0.97, eraser, 24);
  er.rotateZ(Math.PI / 2);
  er.translate(-body / 2 - ferrule - eraser / 2 + 6, 0, 0);
  parts.push(paint(er, lin(0.96, 0.56, 0.6)));
  const cap = new THREE.SphereGeometry(Rp * 0.97, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(0.5, 1, 1);
  cap.rotateZ(Math.PI / 2);
  cap.translate(-body / 2 - ferrule - eraser + 6, 0, 0);
  parts.push(paint(cap, lin(0.96, 0.56, 0.6)));
  // into the world: off the corner behind the hills (north and west of the page), its point toward
  // it, a little way out on the desk
  const pencil = mergeAll(parts);
  const ang = Math.atan2(1, 1.6);
  const tipX = P.x0 - 70;
  const tipZ = P.z0 - 40;
  const m = new THREE.Matrix4().makeRotationY(-ang);
  pencil.applyMatrix4(m);
  // (its point at the tip's place)
  const tip = new THREE.Vector3(body / 2 + cone, 0, 0).applyMatrix4(m);
  pencil.translate(tipX - tip.x, yAxis, tipZ - tip.z);
  // the crumbs: rolled bits of eraser on the desk, more by its end, a few by the page's edge
  const crumbs = [];
  const tail = new THREE.Vector3(-body / 2 - ferrule - eraser, 0, 0).applyMatrix4(m);
  const ex = tipX - tip.x + tail.x;
  const ez = tipZ - tip.z + tail.z;
  for (let i = 0; i < 46; i++) {
    const near = i < 30;
    const a = r.range(0, Math.PI * 2);
    const d = near ? r.range(30, 160) : r.range(0, 1);
    const x = near ? ex + Math.cos(a) * d : r.range(P.x0 - 60, P.x0 - 12);
    const z = near ? ez + Math.sin(a) * d : r.range(P.z0 + 20, P.z0 + 900);
    const s = r.range(3, 9);
    const g = new THREE.IcosahedronGeometry(s, 0);
    g.scale(r.range(0.8, 1.5), r.range(0.45, 0.8), r.range(0.8, 1.4));
    g.rotateY(r.range(0, 6.28));
    g.translate(x, DESK_Y + s * 0.4, z);
    crumbs.push(paint(g, r() < 0.7 ? lin(0.92, 0.6, 0.62) : lin(0.7, 0.66, 0.7)));
  }
  // its shadow on the desk, soft: under its length, a little to one side - the desk's own wood (its
  // grain going on through it), only darker, darkest along the middle where the pencil lies on it
  const L = body + cone + ferrule + eraser;
  const sh = new THREE.PlaneGeometry(L * 1.02, Rp * 3.2, 12, 8).rotateX(-Math.PI / 2);
  sh.translate((body / 2 + cone - (-body / 2 - ferrule - eraser)) / 2 - body / 2 - ferrule - eraser - L * 0.01 + Rp * 0.3, 0, Rp * 0.35);
  const local = sh.attributes.position.clone();
  sh.applyMatrix4(m);
  sh.translate(tipX - tip.x, DESK_Y + 0.3, tipZ - tip.z);
  {
    const pa = sh.attributes.position;
    const n = pa.count;
    const c = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const nor = new Float32Array(n * 3);
    // (where the pencil's middle is, in the shadow's own frame)
    const mid = ((body / 2 + cone) + (-body / 2 - ferrule - eraser)) / 2;
    for (let i = 0; i < n; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i);
      const across = Math.abs(local.getZ(i) - Rp * 0.35) / (Rp * 1.6);
      const along = Math.abs(local.getX(i) - mid) / (L / 2);
      const v = 0.34 + 0.66 * Math.min(1, across * across * 1.15 + Math.max(0, along - 0.9) * 10);
      const k = deskShade(P, x, z) * v;
      c.set([k, k, k], i * 3);
      uv[i * 2] = x / 520;
      uv[i * 2 + 1] = z / 520;
      nor[i * 3 + 1] = 1;
    }
    sh.setAttribute('color', new THREE.BufferAttribute(c, 3));
    sh.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sh.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    sh.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(n).fill(deskId), 1));
  }
  const geo = mergeAll([pencil, ...crumbs]);
  return { geo, shadow: sh };
}

// ------------------------------------------------------------------ helpers
function mergeAll(list) {
  let n = 0;
  let ni = 0;
  for (const g of list) {
    const gg = g.index ? g : g;
    n += gg.attributes.position.count;
    ni += gg.index ? gg.index.count : gg.attributes.position.count;
  }
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const ids = new Float32Array(n);
  const idx = new Uint32Array(ni);
  let o = 0;
  let oi = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + c) * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    ids.fill(nextId(), o, o + c);
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + o;
      oi += a.length;
    } else {
      for (let i = 0; i < c; i++) idx[oi + i] = o + i;
      oi += c;
    }
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// every triangle wound to face the way its normal says (or the given up)
function fixWinding(g, up = null) {
  const p = g.attributes.position.array;
  const nr = g.attributes.normal.array;
  const ix = g.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t];
    const b = ix[t + 1];
    const c = ix[t + 2];
    const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const w = up || [nr[a * 3], nr[a * 3 + 1], nr[a * 3 + 2]];
    if (n[0] * w[0] + n[1] * w[1] + n[2] * w[2] < 0) {
      ix[t + 1] = c;
      ix[t + 2] = b;
    }
  }
  g.index.needsUpdate = true;
}
