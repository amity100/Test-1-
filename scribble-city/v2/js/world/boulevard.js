import * as THREE from 'three';
import { makeSurface, makeSky, srgb, hex, addLight, canvasTexture } from '../render/materials.js';
import { Batch, nextId, canvas, rand } from './kit.js';
import { streetTexture, paverTexture, neonText, paintedSign, roadSign, mural, frondTexture, shopInterior } from './paint.js';
import { buildCars } from './cars.js';

// One boulevard on the water at sunset: Art Deco shops with their neon on the left, palms,
// the wet street with its cars, the promenade, the bay, and the city across it, burning in
// the last of the sun. x: east (the bay), z: south (the camera looks north, -z).

const STREET_X0 = -3;
const STREET_X1 = 13;
const WALK_X0 = -9;
const PROM_X1 = 21;
const Z_FAR = -330;
const Z_NEAR = 90;

// UVs in metres on a box (for the window grids and pavers)
function boxMetres(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const sx = ax > 0.5 ? d : w;
    const sy = ay > 0.5 ? d : h;
    uv.setXY(i, (uv.getX(i) * sx) / tile, (uv.getY(i) * sy) / tile);
  }
  return g;
}

// window grids for the towers far away: the glass in bands (albedo) and the lit ones (emissive)
function towerWindows() {
  const a = canvas(256, 256);
  const e = canvas(256, 256);
  const ga = a.getContext('2d');
  const ge = e.getContext('2d');
  ga.fillStyle = '#e8e2f0';
  ga.fillRect(0, 0, 256, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ga.fillStyle = '#2a2650';
      ga.fillRect(x * 32 + 8, y * 32 + 5, 16, 22);
      const r = Math.random();
      if (r < 0.3) {
        ge.fillStyle = r < 0.08 ? '#ffe2b0' : r < 0.2 ? '#ffb070' : '#ff8f6a';
        ge.fillRect(x * 32 + 8, y * 32 + 5, 16, 22);
      }
    }
  }
  return [canvasTexture(a, { repeat: true }), canvasTexture(e, { repeat: true })];
}

function palmGeometry(height, lean) {
  // a curving, tapering trunk built ring by ring, with the bark's rings in the uv
  const segs = 16;
  const sides = 10;
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean.x * 0.25, height * 0.35, lean.y * 0.25),
    new THREE.Vector3(lean.x * 0.65, height * 0.72, lean.y * 0.65),
    new THREE.Vector3(lean.x, height, lean.y),
  ]);
  const frames = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = 0.32 * (1 - t * 0.45) * (1 + 0.06 * Math.sin(t * 60));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const dx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const dy = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const dz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(c.x + dx * r, c.y + dy * r, c.z + dz * r);
      nor.push(dx, dy, dz);
      uv.push(k / sides, t * height);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * (sides + 1) + k;
      const b = a + sides + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geo: g, top: curve.getPointAt(1) };
}

function frondGeometry(len, width, droop) {
  const g = new THREE.PlaneGeometry(width, len, 1, 12);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / len;
    // out and arching down, the tip folding a little
    const out = Math.sin(t * Math.PI * 0.5) * len * 0.92;
    const down = -droop * t * t * len + Math.sin(t * Math.PI) * len * 0.18;
    const x = p.getX(i) * (1 - t * 0.6);
    p.setXYZ(i, x, down, out);
  }
  g.computeVertexNormals();
  return g;
}

export function buildBoulevard(scene) {
  const W = { colliders: [], lights: [], neon: [], spawn: new THREE.Vector3(-6, 0.15, 2), paths: [] };
  const batch = new Batch();
  const B = (o) => makeSurface(o);

  // ---------------------------------------------------------------- sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), makeSky());
  sky.frustumCulled = false;
  sky.renderOrder = 100;
  sky.userData.noReflect = false;
  scene.add(sky);

  // ---------------------------------------------------------------- the ground
  const st = new THREE.PlaneGeometry(STREET_X1 - STREET_X0, Z_NEAR - Z_FAR, 1, 1).rotateX(-Math.PI / 2);
  const suv = st.attributes.uv;
  for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i), (suv.getY(i) * (Z_NEAR - Z_FAR)) / 16);
  const street = new THREE.Mesh(st, B({ kind: 'street', map: streetTexture(), refl: true, wet: 0.7, ang: 0.12, line: 0.6, wash: 0.6 }));
  street.position.set((STREET_X0 + STREET_X1) / 2, 0, (Z_NEAR + Z_FAR) / 2);
  scene.add(street);
  const walkTex = paverTexture('#dcc6b6', 'rgba(110, 80, 90, 0.5)');
  const walk = new THREE.Mesh(boxMetres(STREET_X0 - WALK_X0 + 14, 0.15, Z_NEAR - Z_FAR, 8), B({ kind: 'ground', map: walkTex, ang: -0.25, line: 0.6 }));
  walk.position.set((WALK_X0 - 14 + STREET_X0) / 2, 0.075, (Z_NEAR + Z_FAR) / 2);
  scene.add(walk);
  const promTex = paverTexture('#efd7c2', 'rgba(130, 90, 80, 0.45)');
  const prom = new THREE.Mesh(boxMetres(PROM_X1 - STREET_X1, 0.15, Z_NEAR - Z_FAR, 8), B({ kind: 'ground', map: promTex, ang: -0.25, line: 0.6 }));
  prom.position.set((STREET_X1 + PROM_X1) / 2, 0.075, (Z_NEAR + Z_FAR) / 2);
  scene.add(prom);
  // curbs
  const curbM = B({ kind: 'wall', color: srgb(0.78, 0.74, 0.76) });
  batch.box(curbM, STREET_X0 - 0.18, 0, Z_FAR, STREET_X0, 0.17, Z_NEAR);
  batch.box(curbM, STREET_X1, 0, Z_FAR, STREET_X1 + 0.18, 0.17, Z_NEAR);
  // the sea wall and the railing over the water
  const wallM = B({ kind: 'wall', color: srgb(0.86, 0.8, 0.74) });
  batch.box(wallM, PROM_X1, -1.6, Z_FAR, PROM_X1 + 0.6, 0.35, Z_NEAR);
  const railM = B({ kind: 'cyl', color: srgb(0.92, 0.92, 0.94), partR: 0.05, gloss: 0.3 });
  for (let z = Z_FAR; z < Z_NEAR; z += 2.4) {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6);
    g.translate(PROM_X1 - 0.2, 0.15 + 0.52, z);
    batch.add(railM, g);
  }
  for (const y of [0.62, 1.15]) {
    const g = new THREE.CylinderGeometry(0.04, 0.04, Z_NEAR - Z_FAR, 6).rotateX(Math.PI / 2);
    g.translate(PROM_X1 - 0.2, y + 0.15, (Z_NEAR + Z_FAR) / 2);
    batch.add(railM, g);
  }
  W.colliders.push({ type: 'x>', x: PROM_X1 - 0.6 });
  // the bay
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), B({ kind: 'water', color: srgb(0.18, 0.2, 0.42), refl: true, wet: 1, line: 0 }));
  water.position.set(PROM_X1 + 1500, -0.8, -500);
  scene.add(water);
  // the land behind the shops
  const back = new THREE.Mesh(new THREE.PlaneGeometry(400, 1200).rotateX(-Math.PI / 2), B({ kind: 'ground', color: srgb(0.4, 0.32, 0.42), line: 0 }));
  back.position.set(-230, 0.1, -400);
  scene.add(back);

  // ---------------------------------------------------------------- the shops
  const frameM = B({ kind: 'box', color: srgb(0.18, 0.14, 0.24), gloss: 0.15 });
  const winGlass = B({ kind: 'glass', color: srgb(0.24, 0.24, 0.46), gloss: 0.7, lit: 0.42 });
  const fx = WALK_X0; // the facade line
  const shops = [
    { z0: -2, z1: 18, floors: 3, color: srgb(0.98, 0.62, 0.62), trim: srgb(1, 0.95, 0.9), sign: 'Sunset Market', signFont: 'Caveat', signCol: '#ff3fa4', awning: srgb(0.18, 0.72, 0.72) },
    { z0: -26, z1: -2, floors: 5, color: srgb(0.52, 0.86, 0.8), trim: srgb(0.98, 0.96, 0.92), sign: 'Bay Cafe', signFont: 'Caveat', signCol: '#3fe8ff', awning: srgb(0.98, 0.45, 0.55), mural: true },
    { z0: -46, z1: -26, floors: 3, color: srgb(1.0, 0.86, 0.48), trim: srgb(0.98, 0.5, 0.42), sign: 'TACOS 24/7', signFont: 'Permanent Marker', signCol: '#ffb43f', awning: srgb(0.45, 0.32, 0.72) },
    { z0: -74, z1: -46, floors: 7, color: srgb(0.96, 0.95, 0.96), trim: srgb(0.66, 0.55, 0.92), sign: 'Hotel Palms', signFont: 'Caveat', signCol: '#ff5ad1', awning: srgb(0.3, 0.75, 0.6), hotel: true },
    { z0: -96, z1: -74, floors: 4, color: srgb(1.0, 0.72, 0.56), trim: srgb(0.32, 0.72, 0.78), sign: 'Neon Bar', signFont: 'Permanent Marker', signCol: '#9b6bff', awning: srgb(0.95, 0.3, 0.4) },
  ];
  const signs = [];
  shops.forEach((s, si) => {
    const fh = 3.6;
    const h = 4.4 + (s.floors - 1) * fh;
    const z0 = s.z0;
    const z1 = s.z1;
    const wallMat = B({ kind: 'wall', color: s.color, obj: nextId() });
    const trimMat = B({ kind: 'wall', color: s.trim });
    // the body of the building
    batch.box(wallMat, fx - 16, 0.15, z1 - 0.15, fx, 0.15 + h, z0 + 0.15);
    // corner pilasters, the parapet with its stripe, eyebrows over the windows
    batch.box(trimMat, fx - 0.2, 0.15, z0, fx + 0.28, 0.15 + h + 0.6, z0 + 0.7);
    batch.box(trimMat, fx - 0.2, 0.15, z1 - 0.7, fx + 0.28, 0.15 + h + 0.6, z1);
    batch.box(trimMat, fx - 0.2, h - 0.2, z0 + 0.7, fx + 0.22, h + 0.75, z1 - 0.7);
    batch.box(wallMat, fx - 0.2, h + 0.75, z0 + 0.7, fx + 0.06, h + 1.1, z1 - 0.7);
    const deco = B({ kind: 'neon', color: srgb(1, 0.9, 1), emissive: hex(s.signCol).multiplyScalar(2.6), line: 0.4 });
    // a thin neon line along the parapet
    batch.box(deco, fx + 0.22, h + 0.05, z0 + 0.9, fx + 0.32, h + 0.13, z1 - 0.9);
    // an Art Deco fin rising over the middle of the front
    if (!s.hotel) {
      const zc = (z0 + z1) / 2;
      batch.box(trimMat, fx - 1.2, h - 2, zc - 0.9, fx + 0.35, h + 3.2, zc + 0.9);
      batch.box(deco, fx + 0.35, h - 1.8, zc - 0.08, fx + 0.45, h + 3.0, zc + 0.08);
    }
    // upper floors: windows in frames, an eyebrow over each row
    for (let f = 1; f < s.floors; f++) {
      const y0 = 0.15 + 4.4 + (f - 1) * fh + 0.7;
      const y1 = y0 + 1.9;
      batch.box(trimMat, fx, y1 + 0.25, z0 + 0.8, fx + 0.45, y1 + 0.38, z1 - 0.8);
      const n = Math.max(2, Math.floor((z1 - z0 - 2) / 3.1));
      const step = (z1 - z0 - 2) / n;
      for (let k = 0; k < n; k++) {
        const zc = z0 + 1 + step * (k + 0.5);
        if (s.mural && f >= 2 && k > 0 && k < n - 1) continue; // the mural goes here
        const ww = s.hotel && k % 2 ? 0.7 : 1.35;
        const wid = nextId();
        const gw = new THREE.PlaneGeometry(ww, 1.9).rotateY(Math.PI / 2);
        gw.translate(fx + 0.01, (y0 + y1) / 2, zc);
        batch.add(winGlass, gw, null, wid);
        batch.box(frameM, fx, y0 - 0.12, zc - ww / 2 - 0.1, fx + 0.1, y0, zc + ww / 2 + 0.1);
        batch.box(frameM, fx, y1, zc - ww / 2 - 0.1, fx + 0.1, y1 + 0.1, zc + ww / 2 + 0.1);
        batch.box(frameM, fx, y0, zc - ww / 2 - 0.1, fx + 0.1, y1, zc - ww / 2);
        batch.box(frameM, fx, y0, zc + ww / 2, fx + 0.1, y1, zc + ww / 2 + 0.1);
        batch.box(frameM, fx, y0 + 1.1, zc - ww / 2, fx + 0.06, y0 + 1.16, zc + ww / 2);
      }
    }
    // the shop at street level: lit glass, a door, a kick plate, the awning, the neon
    const sg0 = z0 + 1.4;
    const sg1 = z1 - 1.4;
    const door = sg0 + (sg1 - sg0) * 0.72;
    const inside = shopInterior(['market', 'cafe', 'market', 'lobby', 'bar'][si], si + 3);
    const shopM = B({ kind: 'uv', map: inside, emMap: inside, emissive: new THREE.Color(0.75, 0.62, 0.52), uvScale: 7, gloss: 0.3, ang: 1.3, wash: 0.85, density: 0.7 });
    const gs = new THREE.PlaneGeometry(sg1 - sg0, 2.7).rotateY(Math.PI / 2);
    gs.translate(fx + 0.02, 0.15 + 0.55 + 1.35, (sg0 + sg1) / 2);
    batch.add(shopM, gs);
    batch.box(frameM, fx, 0.15, sg0, fx + 0.18, 0.7, sg1);
    for (let z = sg0; z <= sg1 + 0.01; z += (sg1 - sg0) / 4) batch.box(frameM, fx, 0.7, z - 0.06, fx + 0.14, 3.4, z + 0.06);
    batch.box(frameM, fx, 3.4, sg0, fx + 0.14, 3.55, sg1);
    batch.box(frameM, fx, 0.15, door - 0.7, fx + 0.12, 2.9, door + 0.7);
    // awning: a slope of striped canvas
    const aw = B({ kind: 'box', color: s.awning, ang: 1.45 });
    const awStripe = B({ kind: 'box', color: srgb(0.98, 0.96, 0.92), ang: 1.45 });
    const nStripes = Math.floor((sg1 - sg0) / 0.6);
    for (let k = 0; k < nStripes; k++) {
      const za = sg0 + k * 0.6;
      const g = new THREE.BoxGeometry(1.8, 0.05, 0.6);
      g.rotateZ(-0.38);
      g.translate(fx + 0.85, 3.75, za + 0.3);
      batch.add(k % 2 ? awStripe : aw, g);
    }
    batch.box(aw, fx + 1.62, 3.15, sg0, fx + 1.7, 3.5, sg1);
    // the neon sign above the awning, and its glow on the street
    const tex = neonText(s.sign, { font: s.signFont, size: 150, color: s.signCol, w: 1024, h: 256 });
    const sm = B({ kind: 'neon', map: tex, alphaTest: 0.5, emissive: new THREE.Color(2.0, 2.0, 2.0), emMap: tex, line: 0.15, side: THREE.DoubleSide });
    sm.userData.noShadowCast = true;
    const len = Math.min(sg1 - sg0, 9);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(len, len / 4).rotateY(Math.PI / 2), sm);
    sign.position.set(fx + 0.3, 4.55 + (s.floors > 1 ? 0 : 0), (z0 + z1) / 2);
    sign.userData.noShadow = true;
    scene.add(sign);
    signs.push(sign);
    addLight(fx + 2.2, 3.4, (z0 + z1) / 2, 11, hex(s.signCol), 1.3);
    if (s.mural) {
      const mm = B({ kind: 'uv', map: mural(), uvScale: 9, ang: 1.3, wash: 0.8 });
      const mw = (z1 - z0) * 0.62;
      const mh = (s.floors - 2) * fh * 0.95;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh).rotateY(Math.PI / 2), mm);
      m.position.set(fx + 0.03, 0.15 + 4.4 + fh + mh / 2 + 0.3, (z0 + z1) / 2);
      scene.add(m);
    }
    if (s.hotel) {
      // the hotel's tall neon blade, out over the sidewalk
      const blade = B({ kind: 'wall', color: srgb(0.98, 0.96, 0.98) });
      const zc = z1 - 4;
      batch.box(blade, fx, h - 9.5, zc - 0.25, fx + 1.6, h + 1.5, zc + 0.25);
      const vt = neonText('HOTEL', { font: 'Rubik', size: 230, color: '#ff5ad1', w: 1280, h: 320 });
      const vm = B({ kind: 'neon', map: vt, alphaTest: 0.5, emissive: new THREE.Color(2.4, 2.4, 2.4), emMap: vt, line: 0.1, side: THREE.DoubleSide });
      for (const sd of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), vm);
        p.rotation.set(0, sd > 0 ? 0 : Math.PI, Math.PI / 2);
        p.position.set(fx + 0.85, h - 4, zc + sd * 0.27);
        p.userData.noShadow = true;
        scene.add(p);
      }
      addLight(fx + 2.5, h - 4, zc, 14, hex('#ff5ad1'), 1.1);
    }
    W.colliders.push({ type: 'x<', x: fx + 0.35, z0, z1 });
  });

  // further down the boulevard: simpler blocks receding into the haze, lit here and there
  const far = [srgb(0.95, 0.7, 0.75), srgb(0.7, 0.85, 0.9), srgb(0.98, 0.88, 0.7), srgb(0.85, 0.78, 0.98), srgb(0.95, 0.95, 0.95)];
  const farGlass = B({ kind: 'glass', color: srgb(0.24, 0.22, 0.44), gloss: 0.6, lit: 0.5 });
  for (let z = -96, i = 0; z > Z_FAR + 20; i++) {
    const len = rand.range(18, 30);
    const h = rand.range(10, 34);
    const m = B({ kind: 'wall', color: far[i % far.length] });
    batch.box(m, fx - 16, 0.15, z - len + 0.3, fx, 0.15 + h, z - 0.3);
    for (let y = 5; y < h - 2; y += 3.4) {
      for (let zz = z - 2; zz > z - len + 2; zz -= 3) {
        const g = new THREE.PlaneGeometry(1.3, 1.8).rotateY(Math.PI / 2);
        g.translate(fx + 0.02, y, zz);
        batch.add(farGlass, g);
      }
    }
    z -= len;
  }

  // ---------------------------------------------------------------- palms
  const trunkTex = (() => {
    const c = canvas(64, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#a88a72';
    g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = `rgba(70, 50, 40, ${0.3 + Math.random() * 0.3})`;
      g.fillRect(0, y, 64, 2 + Math.random() * 2);
    }
    return canvasTexture(c, { repeat: true });
  })();
  const trunkM = B({ kind: 'cyl', map: trunkTex, partR: 0.3, ang: 0.15 });
  const frondM = B({ kind: 'leaf', map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, uvScale: 5, sway: 0.06, ang: 0.15, line: 0.55 });
  const nutM = B({ kind: 'cyl', color: srgb(0.4, 0.28, 0.16), partR: 0.12 });
  const palm = (x, z, height) => {
    const lean = new THREE.Vector2(rand.range(-1.2, 1.2), rand.range(-0.8, 0.8));
    const { geo, top } = palmGeometry(height, lean);
    const t = new THREE.Mesh(geo, trunkM);
    t.position.set(x, 0.15, z);
    scene.add(t);
    const crown = new THREE.Group();
    crown.position.set(x + top.x, 0.15 + top.y, z + top.z);
    const n = 11;
    for (let k = 0; k < n; k++) {
      const len = rand.range(4.2, 5.6);
      const fm = new THREE.Mesh(frondGeometry(len, 1.25, rand.range(0.5, 0.85)), frondM);
      fm.rotation.set(rand.range(-0.25, 0.1), (k / n) * Math.PI * 2 + rand.range(-0.2, 0.2), 0, 'YXZ');
      crown.add(fm);
    }
    for (let k = 0; k < 5; k++) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), nutM);
      const a = (k / 5) * Math.PI * 2;
      nut.position.set(Math.cos(a) * 0.25, -0.3, Math.sin(a) * 0.25);
      crown.add(nut);
    }
    scene.add(crown);
    W.colliders.push({ type: 'circle', x, z, r: 0.45 });
  };
  for (let z = 6; z > Z_FAR + 30; z -= 13) palm(STREET_X0 - 0.75, z + rand.range(-1, 1), rand.range(9, 12.5));
  for (let z = 12; z > Z_FAR + 30; z -= 11) palm(STREET_X1 + 1.3 + (Math.floor(z / 11) % 2) * 5, z + rand.range(-1.5, 1.5), rand.range(10, 14));

  // ---------------------------------------------------------------- lamps, banners, the road sign
  const poleM = B({ kind: 'cyl', color: srgb(0.16, 0.14, 0.22), partR: 0.1, gloss: 0.25 });
  const lampGlass = B({ kind: 'neon', color: srgb(1, 0.9, 0.7), emissive: srgb(1.0, 0.82, 0.55).multiplyScalar(2.2), line: 0.5 });
  const lamp = (x, z) => {
    const g = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8);
    g.translate(x, 0.15 + 3.25, z);
    batch.add(poleM, g);
    const arm = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6).rotateZ(Math.PI / 2);
    arm.translate(x - 0.75, 6.4, z);
    batch.add(poleM, arm);
    const head = new THREE.CylinderGeometry(0.28, 0.12, 0.45, 8);
    head.translate(x - 1.5, 6.3, z);
    batch.add(lampGlass, head);
    W.colliders.push({ type: 'circle', x, z, r: 0.25 });
  };
  for (let z = 0; z > Z_FAR + 20; z -= 19) lamp(STREET_X1 + 3.8, z);
  addLight(STREET_X1 + 2.3, 5.5, -19, 9, srgb(1, 0.8, 0.55), 0.9);
  // banners on the lamp posts
  const banner = (z, lines, bg, fg) => {
    const tex = paintedSign(lines, { bg, fg, vertical: true, size: 58, w: 256, h: 900 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2), B({ kind: 'uv', map: tex, uvScale: 3, side: THREE.DoubleSide, ang: 1.45, wash: 0.8 }));
    m.rotation.y = Math.PI / 2;
    m.position.set(STREET_X1 + 3.8 - 0.55, 3.9, z);
    scene.add(m);
  };
  banner(-19, ['GOOD', 'PEOPLE', 'BETTER', 'DAYS'], '#f6e9d6', '#2a1a3a');
  banner(-38, ['DREAM', 'BIG'], '#ff5aa5', '#fff3e6');
  // the gantry and the big green sign over the northbound lanes
  const gz = -44;
  const steel = B({ kind: 'box', color: srgb(0.62, 0.62, 0.68), gloss: 0.2 });
  batch.box(steel, STREET_X1 + 0.6, 0.15, gz - 0.2, STREET_X1 + 1.0, 8.4, gz + 0.2);
  batch.box(steel, STREET_X0 + 8.6, 0, gz - 0.2, STREET_X0 + 9.0, 8.4, gz + 0.2);
  batch.box(steel, STREET_X0 + 8.6, 8.0, gz - 0.25, STREET_X1 + 1.0, 8.4, gz + 0.25);
  const signTex = roadSign();
  const rs = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.8), B({ kind: 'uv', map: signTex, emMap: signTex, emissive: new THREE.Color(0.32, 0.32, 0.3), uvScale: 7, ang: 1.4, wash: 0.88, gloss: 0.15 }));
  rs.position.set(STREET_X0 + 12.4, 5.95, gz + 0.3);
  scene.add(rs);
  batch.box(steel, STREET_X0 + 8.5, 3.95, gz + 0.05, STREET_X0 + 16.3, 7.95, gz + 0.28);

  // ---------------------------------------------------------------- across the bay
  const [winAlb, winTex] = towerWindows();
  const towerCols = [srgb(0.26, 0.26, 0.52), srgb(0.4, 0.28, 0.52), srgb(0.22, 0.32, 0.55), srgb(0.48, 0.34, 0.55), srgb(0.32, 0.28, 0.6)];
  const towerMats = towerCols.map((c) => B({ kind: 'uv', color: c, emMap: winTex, map: winAlb, emissive: new THREE.Color(1.3, 1.0, 0.75), uvScale: 6, ang: 1.45, line: 0.6, gloss: 0.55 }));
  const tower = (x, z, w, d, h) => {
    const g = boxMetres(w, h, d, 30);
    g.translate(x, h / 2 - 1, z);
    batch.add(rand.pick(towerMats), g);
    if (h > 120 && rand() < 0.6) {
      const sp = new THREE.CylinderGeometry(0.3, 1.2, h * 0.18, 6);
      sp.translate(x, h + h * 0.09 - 1, z);
      batch.add(steel, sp);
    }
  };
  for (let i = 0; i < 70; i++) {
    const x = rand.range(330, 950);
    const z = rand.range(-1150, 60);
    if (Math.abs(x - -z * 0.305) < 60) continue;
    tower(x, z, rand.range(22, 50), rand.range(22, 50), rand.range(30, 210) * (1 - Math.abs(z + 450) / 1400));
  }
  for (let i = 0; i < 40; i++) {
    const x = rand.range(-260, 260);
    const z = rand.range(-1300, -560);
    // leave a gap where the sun goes down
    if (Math.abs(x - -z * 0.305) < 70) continue;
    tower(x, z, rand.range(26, 56), rand.range(26, 56), rand.range(60, 260));
  }
  // the long bridge over the bay, with its lights
  const deck = B({ kind: 'box', color: srgb(0.72, 0.66, 0.84) });
  const bz = -430;
  batch.box(deck, PROM_X1 + 10, 11, bz - 6, 950, 13.2, bz + 6);
  for (let x = PROM_X1 + 40; x < 950; x += 55) batch.box(deck, x - 2.5, -1, bz - 3, x + 2.5, 11, bz + 3);
  const bl = B({ kind: 'neon', color: srgb(1, 0.85, 0.7), emissive: srgb(1, 0.78, 0.5).multiplyScalar(4), line: 0 });
  for (let x = PROM_X1 + 20; x < 950; x += 11) batch.box(bl, x - 0.35, 13.2, bz + 5.4, x + 0.35, 13.9, bz + 6.1);

  // ---------------------------------------------------------------- cars, the helicopter
  const cars = buildCars(scene, W);
  const heli = buildHeli(scene);

  batch.flush(scene);
  W.signs = signs;
  W.update = (dt, t) => {
    cars.update(dt, t);
    heli.update(dt, t);
    // a neon letter that flickers
    const f = Math.sin(t * 23) * Math.sin(t * 7.3) > 0.82 ? 0.25 : 1;
    if (signs[2]) signs[2].material.uniforms.uEmissive.value.setScalar(2.0 * f);
  };
  // the walkers' lanes: the shops' sidewalk and the promenade
  W.paths = [
    { x0: -8.2, x1: -4.2, z0: -110, z1: 40 },
    { x0: 14.6, x1: 19.6, z0: -140, z1: 40 },
  ];
  W.bounds = { x0: WALK_X0 + 0.45, x1: PROM_X1 - 0.6, z0: Z_FAR + 40, z1: Z_NEAR - 10 };
  return W;
}

function buildHeli(scene) {
  const g = new THREE.Group();
  const body = makeSurface({ kind: 'paint', color: srgb(0.15, 0.15, 0.22), gloss: 0.5 });
  const glass = makeSurface({ kind: 'glass', color: srgb(0.3, 0.35, 0.6), gloss: 0.9, lit: 0 });
  const cab = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), body);
  cab.scale.set(1, 0.8, 1.6);
  g.add(cab);
  const win = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), glass);
  win.position.set(0, 0.2, -1.0);
  win.rotation.x = -1.0;
  g.add(win);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 5, 8).rotateX(Math.PI / 2), body);
  tail.position.set(0, 0.2, 3.2);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.25), body);
  rotor.position.set(0, 1.2, 0);
  g.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  rotor.add(rotor2);
  const skid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3), body);
  for (const sx of [-0.8, 0.8]) {
    const s = skid.clone();
    s.position.set(sx, -1.2, 0);
    g.add(s);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), makeSurface({ kind: 'neon', color: srgb(1, 0.2, 0.2), emissive: new THREE.Color(6, 0.4, 0.4) }));
  beacon.position.set(0, -0.8, 1);
  g.add(beacon);
  g.traverse((o) => {
    if (o.isMesh) o.userData.noShadow = true;
  });
  scene.add(g);
  return {
    update(dt, t) {
      const a = t * 0.06;
      g.position.set(48 + Math.cos(a) * 34, 40 + Math.sin(t * 0.3) * 2, -105 + Math.sin(a) * 22);
      g.rotation.set(0.12, -a + Math.PI, 0.18);
      rotor.rotation.y = t * 25;
      beacon.visible = Math.sin(t * 6) > 0.3;
    },
  };
}
