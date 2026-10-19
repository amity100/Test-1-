import * as THREE from 'three';
import { makeSurface, srgb, hex, canvasTexture, addLight } from '../../render/materials.js';
import { nextId, canvas } from '../kit.js';
import { palm } from '../palms.js';
import { prism, rectPts } from '../skyline.js';
import { M_AVES, M_STREETS, CAUSEWAYS, deckY, M_BLOCKS, SHORE_X, WEST_X, NORTH_Z, BEACH_Z, SEA_Z, hillsHeight, CURB, PIER_M, JETTY, MARINA } from './plan.js';

// (v5, ROADMAP 11.17) The mainland's ground as it is built at the start, all of it at once (it is
// cheap): the picture of its roads and sidewalks seen from afar, the hills and their letters, the
// two causeways over the bay. The real streets, a tile at a time near you, are world/mainland/
// tiles.js; the buildings world/mainland/blocks.js.

// the picture's extent
export const G0 = { x0: WEST_X - 40, x1: SHORE_X, z0: NORTH_Z - 40, z1: BEACH_Z + 2 };
const ROAD = '#4a4258';
const WALK = '#d9c3b4';
const GRASS = '#86b46e';
const SAND = '#f0d6a4';
const PLAZA = '#e7c9b2';

// one picture of all the mainland's ground: the asphalt, the sidewalks, the parks, the sand
function groundPicture() {
  const W = 1536;
  const H = 2048;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const sx = W / (G0.x1 - G0.x0);
  const sz = H / (G0.z1 - G0.z0);
  const X = (x) => (x - G0.x0) * sx;
  const Z = (z) => (z - G0.z0) * sz;
  const rect = (x0, z0, x1, z1, col) => {
    g.fillStyle = col;
    g.fillRect(X(Math.min(x0, x1)), Z(Math.min(z0, z1)), Math.abs(x1 - x0) * sx + 0.5, Math.abs(z1 - z0) * sz + 0.5);
  };
  // the land, the hills a little greener
  g.fillStyle = '#c8b4a6';
  g.fillRect(0, 0, W, H);
  rect(G0.x0, G0.z0, G0.x1, NORTH_Z + 50, '#9db07c');
  rect(G0.x0, G0.z0, WEST_X + 80, G0.z1, '#9db07c');
  // the sidewalks round every block, and the blocks (their own ground hides this up close)
  for (const a of M_AVES) rect(a.x - a.half - a.walk, a.z0 - 10, a.x + a.half + a.walk, a.z1 + 10, WALK);
  for (const s of M_STREETS) rect(s.x0 - 10, s.z - s.half - s.walk, s.x1 + 10, s.z + s.half + s.walk, WALK);
  for (const b of M_BLOCKS) {
    const R = b.rect;
    const col = b.kind === 'park' || b.kind === 'domino' || b.kind === 'school' ? GRASS : b.kind === 'plaza' ? PLAZA : '#cbb6a8';
    rect(R.x0, R.z0, R.x1, R.z1, col);
  }
  // the bayfront's park, the Point
  rect(M_AVES[0].x + M_AVES[0].half + M_AVES[0].walk, NORTH_Z, SHORE_X, BEACH_Z, GRASS);
  rect(-1060, M_STREETS[12].z + 11, SHORE_X, SEA_Z, GRASS);
  // the roads
  for (const a of M_AVES) {
    rect(a.x - a.half, a.z0 - 6, a.x + a.half, a.z1 + 6, ROAD);
    if (a.median) rect(a.x - a.median / 2, a.z0, a.x + a.median / 2, a.z1, GRASS);
  }
  for (const s of M_STREETS) {
    rect(s.x0 - 7, s.z - s.half, s.x1 + 4, s.z + s.half, ROAD);
    if (s.median) rect(s.x0, s.z - s.median / 2, s.x1, s.z + s.median / 2, GRASS);
  }
  // the beach
  rect(G0.x0, BEACH_Z, -1060, SEA_Z + 30, SAND);
  // a grain over it all, so it is not flat colour from a plane
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,240' : '60,40,60'},${Math.random() * 0.08})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  return canvasTexture(c);
}

export function farGround(ctx) {
  const tex = groundPicture();
  const mat = makeSurface({ kind: 'ground', map: tex, ang: -0.25, line: 0.35 });
  const geo = new THREE.PlaneGeometry(G0.x1 - G0.x0, G0.z1 - G0.z0).rotateX(-Math.PI / 2);
  geo.translate((G0.x0 + G0.x1) / 2, -0.04, (G0.z0 + G0.z1) / 2);
  const m = new THREE.Mesh(geo, mat);
  m.name = 'mainlandGround';
  m.matrixAutoUpdate = false;
  m.updateMatrix();
  ctx.parent.add(m);
  return m;
}

// ------------------------------------------------------------------ the hills
// north of Hillside Drive and west of Palm Avenue: a sheet of ground lifted by hillsHeight, its
// colour from dry grass to the green of the canyons; the letters stand on the slope over Inkwood
export function buildHills(ctx) {
  const M = ctx.M;
  const sheet = (x0, x1, z0, z1, step) => {
    const nx = Math.ceil((x1 - x0) / step);
    const nz = Math.ceil((z1 - z0) / step);
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const dry = srgb(0.74, 0.66, 0.42);
    const green = srgb(0.42, 0.58, 0.34);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const h = hillsHeight(x, z);
      p.setY(i, h > 0.05 ? h : -0.06);
      const t = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.031) * Math.cos(x * 0.017 - z * 0.04);
      c.copy(dry).lerp(green, t * 0.8);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    ctx.B.add(M.grass, g, null, nextId(), { chunk: 'hills' });
  };
  sheet(WEST_X - 420, SHORE_X + 40, NORTH_Z - 420, -1196, 9);
  sheet(WEST_X - 420, -1878, -1196, SEA_Z + 60, 9);
  // scrub and trees over the slopes (cheap: low cones, far pens)
  const r = ctx.rng;
  for (let i = 0; i < 260; i++) {
    const west = i % 3 === 0;
    const x = west ? r.range(WEST_X - 300, -1900) : r.range(WEST_X - 200, SHORE_X - 60);
    const z = west ? r.range(-1150, SEA_Z - 20) : r.range(NORTH_Z - 300, -1225);
    const h = hillsHeight(x, z);
    if (h < 2) continue;
    const s = r.range(2.2, 5.5);
    const cone = new THREE.ConeGeometry(s, s * r.range(1.2, 2.2), 7);
    cone.translate(x, h + s * 0.8, z);
    ctx.B.add(M.canopy, cone, null, nextId(), { chunk: 'hills', color: srgb(0.34, 0.5, 0.3).multiplyScalar(r.range(0.8, 1.15)) });
  }
  hillLetters(ctx, 'INKWOOD', -1330, -1292);
}

// the big white letters on the hill, each on its scaffold of legs (made of strokes: box by box)
const STROKES = {
  I: [[0.5, 0, 0.5, 1]],
  N: [[0.1, 0, 0.1, 1], [0.1, 1, 0.9, 0], [0.9, 0, 0.9, 1]],
  K: [[0.12, 0, 0.12, 1], [0.12, 0.45, 0.92, 1], [0.35, 0.62, 0.92, 0]],
  W: [[0, 1, 0.22, 0], [0.22, 0, 0.5, 0.75], [0.5, 0.75, 0.78, 0], [0.78, 0, 1, 1]],
  O: 'ring',
  D: 'd',
};
function hillLetters(ctx, word, cx, cz) {
  const M = ctx.M;
  const H = 11;
  const Wl = 8.4;
  const gap = 2.6;
  const T = 1.5;
  const white = srgb(0.98, 0.97, 0.94);
  const total = word.length * Wl + (word.length - 1) * gap;
  const add = (g) => ctx.B.add(M.wallSolid, g, null, nextId(), { chunk: 'hills', color: white });
  const stroke = (x0, y0, x1, y1, zc, base) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const g = new THREE.BoxGeometry(len + T * 0.6, T, 0.6);
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
    g.translate((x0 + x1) / 2, base + (y0 + y1) / 2, zc);
    add(g);
  };
  for (let i = 0; i < word.length; i++) {
    const x0 = cx - total / 2 + i * (Wl + gap);
    const xm = x0 + Wl / 2;
    // each letter sits on the slope where it is, tilted back a little, facing the city
    const zc = cz + (i % 2 ? 0.8 : -0.6);
    const base = hillsHeight(xm, zc) + 1.2;
    const L = word[i];
    const s = STROKES[L];
    if (s === 'ring' || s === 'd') {
      const seg = 14;
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2;
        const a1 = ((k + 1) / seg) * Math.PI * 2;
        if (s === 'd' && Math.cos((a0 + a1) / 2) < -0.2) continue;
        const ox = s === 'd' ? x0 + 1.1 : xm;
        const rx = s === 'd' ? Wl - 1.6 : Wl / 2 - T / 2;
        const px0 = ox + Math.cos(a0) * (s === 'd' ? rx * 0.92 : rx);
        const px1 = ox + Math.cos(a1) * (s === 'd' ? rx * 0.92 : rx);
        const py0 = H / 2 + Math.sin(a0) * (H / 2 - T / 2);
        const py1 = H / 2 + Math.sin(a1) * (H / 2 - T / 2);
        stroke(px0, py0, px1, py1, zc, base);
      }
      if (s === 'd') stroke(x0 + 1.1, 0, x0 + 1.1, H, zc, base);
    } else {
      for (const [a, b, c, d] of s) stroke(x0 + a * Wl, b * H, x0 + c * Wl, d * H, zc, base);
    }
    // the legs and braces behind it, down into the hill
    const steel = srgb(0.36, 0.34, 0.38);
    for (const lx of [x0 + 1, x0 + Wl - 1]) {
      const g = new THREE.BoxGeometry(0.3, H + 1.6, 0.3);
      g.translate(lx, base + H / 2 - 1.2, zc - 1.6);
      ctx.B.add(M.steel, g, null, nextId(), { chunk: 'hills', color: steel });
    }
    const brace = new THREE.BoxGeometry(Wl - 1.6, 0.25, 0.25);
    brace.translate(xm, base + H * 0.55, zc - 1.6);
    ctx.B.add(M.steel, brace, null, nextId(), { chunk: 'hills', color: steel });
    // lit at night from below
    addLight(xm, base + 1, zc + 4, 16, srgb(1, 0.95, 0.85), 0.9);
  }
}

// ------------------------------------------------------------------ the causeways
// a deck that follows deckY over the bay: its asphalt along x, the curbs and the low walls either
// side of it, piers down into the water, lamps; the Venetian's two towers and their cables
export function buildCauseways(ctx) {
  const M = ctx.M;
  const deckCol = srgb(0.8, 0.76, 0.86);
  const wallCol = srgb(0.9, 0.87, 0.92);
  const STEP = 6;
  for (const c of CAUSEWAYS) {
    const chunk = `cause${c.z}`;
    const xs = [];
    for (let x = c.x0; x < c.x1; x += STEP) xs.push(x);
    xs.push(c.x1 + 18);
    // the asphalt: one strip, its corners lifted to the deck
    {
      const pos = [];
      const uv = [];
      const nor = [];
      const z0 = c.z - c.half;
      const z1 = c.z + c.half;
      for (let i = 0; i + 1 < xs.length; i++) {
        const xa = xs[i];
        const xb = xs[i + 1];
        const ya = deckY(c, xa);
        const yb = deckY(c, xb);
        const q = [[xa, ya, z1], [xb, yb, z1], [xb, yb, z0], [xa, ya, z0]];
        for (const k of [0, 1, 2, 0, 2, 3]) {
          pos.push(...q[k]);
          uv.push((q[k][2] - z0) / (z1 - z0), q[k][0] / 16);
          nor.push(0, 1, 0);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      ctx.B.add(M.street, g, null, nextId(), { chunk });
    }
    // the body under it, the walls along it, a pier every 30 m, a lamp every 24
    for (let i = 0; i + 1 < xs.length; i++) {
      const xa = xs[i];
      const xb = xs[i + 1];
      const y = (deckY(c, xa) + deckY(c, xb)) / 2;
      const over = xa < -262;
      if (over) ctx.B.box(M.wallSolid, xa, y - 1.4, c.z - c.half - 1.2, xb, y - 0.02, c.z + c.half + 1.2, nextId(), { chunk, color: deckCol });
      for (const s of [-1, 1]) {
        const zi = c.z + s * (c.half + 0.6);
        // (a sidewalk of a curb along each side, then the low wall)
        ctx.B.box(M.wallSolid, xa, y - 0.02, Math.min(zi, c.z + s * c.half), xb, y + CURB, Math.max(zi, c.z + s * c.half), nextId(), { chunk, color: wallCol });
        ctx.B.box(M.wallSolid, xa, y + CURB, c.z + s * (c.half + 0.6), xb, y + 1.05, c.z + s * (c.half + 1.2), nextId(), { chunk, color: wallCol });
        ctx.col.addBox(xa, Math.min(c.z + s * (c.half + 0.6), c.z + s * (c.half + 1.6)), xb, Math.max(c.z + s * (c.half + 0.6), c.z + s * (c.half + 1.6)), y - 1, y + 1.3, 'wall');
      }
    }
    for (let x = c.x0 + 15; x < -270; x += 30) {
      const y = deckY(c, x);
      ctx.B.box(M.wallSolid, x - 1.6, -2.5, c.z - c.half + 1, x + 1.6, y - 1.3, c.z + c.half - 1, nextId(), { chunk, color: deckCol });
    }
    for (let x = c.x0 + 8; x < c.x1; x += 24) {
      for (const s of [-1, 1]) {
        const y = deckY(c, x);
        const z = c.z + s * (c.half + 0.9);
        const pole = new THREE.CylinderGeometry(0.08, 0.1, 7, 8);
        pole.translate(x, y + 1.05 + 3.5, z);
        ctx.B.add(M.pole, pole, null, nextId(), { chunk, color: srgb(0.5, 0.48, 0.56) });
        ctx.B.box(M.bridgeLight, x - 0.5, y + 8.0, z - 0.25, x + 0.5, y + 8.35, z + 0.25, nextId(), { chunk });
        if ((x - c.x0) % 48 < 24) addLight(x, y + 7.6, c.z + s * c.half * 0.5, 14, srgb(1, 0.85, 0.62), 0.8);
      }
    }
    // the MacArthur: royal palms along its walls, the way it is lined over there
    if (!c.towers) {
      for (let x = c.x0 + 20; x < -280; x += 16) {
        for (const s of [-1, 1]) palm(ctx, ctx.rng, x + (s > 0 ? 8 : 0), c.z + s * (c.half + 2.6), 10 + ctx.rng() * 3, { y0: deckY(c, x) - 1.4 });
      }
      continue;
    }
    // the Venetian's towers: two legs either side of the deck joined by beams, cables fanning down
    const towerCol = srgb(0.86, 0.5, 0.62);
    const cableCol = srgb(0.92, 0.88, 0.95);
    const TH = 62;
    for (const tx of c.towers) {
      const yd = deckY(c, tx);
      for (const s of [-1, 1]) {
        ctx.B.add(M.wallSolid, prism(rectPts(tx, c.z + s * (c.half + 2.6), 3.6, 2.4), -2.5, yd + TH, true), null, nextId(), { chunk, color: towerCol });
        ctx.B.box(M.bridgeLight, tx - 0.5, yd + TH, c.z + s * (c.half + 2.6) - 0.5, tx + 0.5, yd + TH + 1, c.z + s * (c.half + 2.6) + 0.5, nextId(), { chunk });
      }
      for (const y of [yd + 16, yd + 36, yd + TH - 3]) ctx.B.box(M.wallSolid, tx - 1.4, y, c.z - c.half - 2.6, tx + 1.4, y + 2.4, c.z + c.half + 2.6, nextId(), { chunk, color: towerCol });
      // the stays: from the top of the tower down to the deck on both sides, a fan of them
      for (const s of [-1, 1]) {
        const zc = c.z + s * (c.half + 2.6);
        for (let k = 1; k <= 7; k++) {
          for (const dir of [-1, 1]) {
            const ex = tx + dir * k * 11;
            const ey = deckY(c, ex) + 1.2;
            const sy = yd + TH - 4 - k * 2.2;
            const len = Math.hypot(ex - tx, ey - sy);
            const g = new THREE.BoxGeometry(len, 0.22, 0.22);
            g.rotateZ(Math.atan2(ey - sy, ex - tx));
            g.translate((ex + tx) / 2, (ey + sy) / 2, zc);
            ctx.B.add(M.steel, g, null, nextId(), { chunk, color: cableCol });
          }
        }
      }
    }
  }
}

// ------------------------------------------------------------------ the shore
// the bay's sea wall along the mainland (its cap, a railing on it), the beach on the south coast
// sloping into the ocean, and the walls you cannot pass: the hills, the ocean, the bay
export function buildShore(ctx) {
  const M = ctx.M;
  const chunk = 'shore';
  const cap = srgb(0.88, 0.85, 0.8);
  const rail = srgb(0.92, 0.92, 0.95);
  const gaps = CAUSEWAYS.map((c) => [c.z - c.half - 1.4, c.z + c.half + 1.4]);
  // (and the marina's: its dock along the wall is the way out onto the water; under it only a low
  // wall keeps the swimmers off)
  const mg = [MARINA.docks[0].z0, MARINA.docks[0].z1];
  gaps.push(mg);
  gaps.sort((a, b) => a[0] - b[0]);
  ctx.col.addBox(SHORE_X - 0.1, mg[0], SHORE_X + 40, mg[1], -2, MARINA.deck - 0.3, 'bound');
  const runs = [];
  let z = NORTH_Z;
  for (const [a, b] of gaps) {
    runs.push([z, a]);
    z = b;
  }
  runs.push([z, BEACH_Z]);
  for (const [z0, z1] of runs) {
    // (in pieces of 96 m: each is culled with its own bounds)
    for (let a = z0; a < z1; a += 96) {
      const b = Math.min(z1, a + 96);
      ctx.B.box(M.wallSolid, SHORE_X - 0.1, -1.2, a, SHORE_X + 0.6, CURB + 0.3, b, nextId(), { chunk, color: cap });
      for (const y of [0.62, 1.12]) {
        const g = new THREE.CylinderGeometry(0.04, 0.04, b - a, 6).rotateX(Math.PI / 2);
        g.translate(SHORE_X + 0.25, CURB + 0.3 + y, (a + b) / 2);
        ctx.B.add(M.rail, g, null, nextId(), { chunk, color: rail });
      }
      for (let zz = a + 1.2; zz < b; zz += 2.4) {
        const g = new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6);
        g.translate(SHORE_X + 0.25, CURB + 0.3 + 0.57, zz);
        ctx.B.add(M.rail, g, null, nextId(), { chunk, color: rail });
      }
      ctx.col.addBox(SHORE_X - 0.1, a, SHORE_X + 40, b, -2, 30, 'bound');
    }
  }
  // the beach: from the boardwalk's edge down into the water, its wet sand darker
  {
    const x0 = WEST_X - 30;
    const x1 = SHORE_X;
    const g = new THREE.PlaneGeometry(x1 - x0, SEA_Z + 20 - BEACH_Z, 60, 8).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (BEACH_Z + SEA_Z + 20) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const zz = p.getZ(i);
      const t = Math.max(0, Math.min(1, (zz - BEACH_Z) / (SEA_Z - BEACH_Z)));
      p.setY(i, zz > SEA_Z ? -0.8 - (zz - SEA_Z) * 0.05 : CURB - (CURB + 0.8) * t);
      uv.setXY(i, p.getX(i) / 6, -zz / 6);
    }
    g.computeVertexNormals();
    ctx.B.add(M.sand, g, null, nextId(), { chunk });
  }
  // the walls: the hills to the north and west (their foot), the ocean beyond the surf
  ctx.col.addBox(WEST_X - 200, NORTH_Z - 300, SHORE_X + 40, -1213, -2, 120, 'bound');
  ctx.col.addBox(WEST_X - 200, -1213, -1889, SEA_Z + 40, -2, 120, 'bound');
  // (the ocean's wall stops short of the pier and the jetty: under them only a low one, below
  // their decks, keeps the swimmers off - you walk out over it; world/mainland/landmarks.js)
  const gaps2 = [[PIER_M.parts[2].x0 - 1, PIER_M.parts[3].x1 + 1, PIER_M.deck - 0.4], [JETTY.x - JETTY.r - 0.5, JETTY.x + JETTY.r + 0.5, JETTY.top - 0.4]].sort((a, b) => a[0] - b[0]);
  let gx = -1889;
  for (const [a, b, low] of gaps2) {
    ctx.col.addBox(gx, SEA_Z + 1, a, SEA_Z + 60, -2, 30, 'bound');
    ctx.col.addBox(a, SEA_Z + 1, b, SEA_Z + 60, -2, low, 'bound');
    gx = b;
  }
  ctx.col.addBox(gx, SEA_Z + 1, SHORE_X + 40, SEA_Z + 60, -2, 30, 'bound');
}

export { hex };
