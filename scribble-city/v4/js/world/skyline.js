import * as THREE from 'three';
import { srgb, hex } from '../render/materials.js';
import { nextId, boxMetres } from './kit.js';

// Real towers for the skyline across the bay and for downtown: a podium, a shaft (square with
// cut corners, round, or stepped back like the old Art Deco towers), setbacks, and a crown - a
// spire, a lit ring, a slanted top, a pyramid. Their glass carries the window texture in metres
// (one tile: 30 m, eight floors), so every tower has the same floors and windows.

const TILE = 30;

// a prism of the 2D outline pts (x, z), from y0 to y1, its sides' uv in metres / TILE
function prism(pts, y0, y1, cap = true) {
  const pos = [];
  const uv = [];
  const nor = [];
  const n = pts.length;
  let run = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // outward normal of the edge (the outline runs counter-clockwise seen from above, north up)
    const nx = -(b[1] - a[1]) / len;
    const nz = (b[0] - a[0]) / len;
    const u0 = run / TILE;
    const u1 = (run + len) / TILE;
    const v0 = y0 / TILE;
    const v1 = y1 / TILE;
    const quad = [[a[0], y0, a[1], u0, v0], [b[0], y0, b[1], u1, v0], [b[0], y1, b[1], u1, v1], [a[0], y1, a[1], u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const q = quad[k];
      pos.push(q[0], q[1], q[2]);
      uv.push(q[3], q[4]);
      nor.push(nx, 0, nz);
    }
    run += len;
  }
  if (cap) {
    // the roof: a fan from the middle
    let cx = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p[0];
      cz += p[1];
    }
    cx /= n;
    cz /= n;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      pos.push(cx, y1, cz, a[0], y1, a[1], b[0], y1, b[1]);
      uv.push(0, 0, 0, 0, 0, 0);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// turn every triangle of P (a flat list of corners, three by three) to face away from c
function outward(P, c) {
  for (let i = 0; i < P.length; i += 3) {
    const [a, b, d] = [P[i], P[i + 1], P[i + 2]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = [(a[0] + b[0] + d[0]) / 3 - c[0], (a[1] + b[1] + d[1]) / 3 - c[1], (a[2] + b[2] + d[2]) / 3 - c[2]];
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) {
      P[i + 1] = d;
      P[i + 2] = b;
    }
  }
}

// outlines (counter-clockwise from above, x right, z towards you)
function rectPts(cx, cz, w, d, cut = 0) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  if (!cut) return [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
  const c = Math.min(cut, w / 3, d / 3);
  return [[x0 + c, z1], [x1 - c, z1], [x1, z1 - c], [x1, z0 + c], [x1 - c, z0], [x0 + c, z0], [x0, z0 + c], [x0, z1 - c]];
}
function roundPts(cx, cz, rx, rz, n = 20) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -(i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cz - Math.sin(a) * rz]);
  }
  return pts.reverse();
}

/**
 * A tower at (x, z) standing on y0: w x d its footprint, h its height (from y0).
 * o: { mats: [glass materials], steel, neon, crownCol, rand, chunk, style }
 */
export function skyscraper(ctx, x, z, w, d, h, o) {
  const r = o.rand;
  const add = (mat, g, color) => ctx.B.add(mat, g, null, nextId(), { chunk: o.chunk, ...(color ? { color } : {}) });
  const glass = r.pick(o.mats);
  const y0 = o.y0 || 0;
  const style = o.style || r.pick(['cut', 'cut', 'rect', 'round', 'deco', 'deco', 'slant']);
  // the podium
  if (o.podium !== false && h > 70) {
    const ph = r.range(10, 18);
    add(glass, prism(rectPts(x, z, w * 1.25, d * 1.25), y0 - 1, y0 + ph));
  }
  let top = y0 + h;
  if (style === 'round') {
    const g = prism(roundPts(x, z, w / 2, d / 2, 22), y0 - 1, top);
    add(glass, g);
    // a ring of light near the top, a mast
    add(o.neon, prism(roundPts(x, z, w / 2 + 0.25, d / 2 + 0.25, 22), top - 6, top - 5.2, false), o.crownCol);
    add(o.steel, prism(roundPts(x, z, w * 0.3, d * 0.3, 10), top, top + 6), srgb(0.75, 0.74, 0.8));
    top += 6;
  } else if (style === 'deco') {
    // stepped back three or four times as it rises (the old Art Deco towers)
    const steps = r.int(3, 4);
    let yy = y0 - 1;
    let ww = w;
    let dd = d;
    for (let s = 0; s < steps; s++) {
      const hh = s === 0 ? h * 0.55 : (h * 0.45) / (steps - 1);
      add(glass, prism(rectPts(x, z, ww, dd, ww * 0.08), yy, yy + hh));
      // a band of trim at each setback
      add(o.steel, prism(rectPts(x, z, ww + 0.6, dd + 0.6, ww * 0.08), yy + hh - 0.6, yy + hh), o.trimCol);
      yy += hh;
      ww *= 0.74;
      dd *= 0.74;
    }
    top = yy;
    // the spire
    const sh = h * r.range(0.15, 0.3);
    const sp = new THREE.CylinderGeometry(0.25, Math.min(ww, dd) * 0.18, sh, 6);
    sp.translate(x, top + sh / 2, z);
    add(o.steel, sp, srgb(0.85, 0.82, 0.9));
    top += sh;
  } else if (style === 'slant') {
    // a slab with its roof cut on a slant
    const pts = rectPts(x, z, w, d);
    add(glass, prism(pts, y0 - 1, top - w * 0.4));
    const g = new THREE.BufferGeometry();
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const yb = top - w * 0.4;
    const P = [
      // the slanted roof (high on the east side)
      [x0, yb, z1], [x1, top, z1], [x1, top, z0], [x0, yb, z1], [x1, top, z0], [x0, yb, z0],
      // the triangles at the ends
      [x0, yb, z1], [x1, yb, z1], [x1, top, z1], [x1, yb, z0], [x0, yb, z0], [x1, top, z0],
      // the east wall up to the high edge
      [x1, yb, z1], [x1, yb, z0], [x1, top, z0], [x1, yb, z1], [x1, top, z0], [x1, top, z1],
    ];
    outward(P, [x, (yb + top) / 2, z]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(P.length * 2).fill(0), 2));
    g.computeVertexNormals();
    add(o.steel, g, o.trimCol);
  } else {
    // square (or with cut corners), a setback near the top, a crown
    const cut = style === 'cut' ? Math.min(w, d) * r.range(0.12, 0.22) : 0;
    const hb = h * r.range(0.7, 0.86);
    add(glass, prism(rectPts(x, z, w, d, cut), y0 - 1, y0 + hb));
    add(o.steel, prism(rectPts(x, z, w + 0.5, d + 0.5, cut), y0 + hb - 0.8, y0 + hb), o.trimCol);
    const w2 = w * r.range(0.7, 0.85);
    const d2 = d * r.range(0.7, 0.85);
    add(glass, prism(rectPts(x, z, w2, d2, cut * 0.8), y0 + hb, top));
    const crown = r.pick(['ring', 'mast', 'pyramid', 'ring']);
    if (crown === 'ring') {
      add(o.neon, prism(rectPts(x, z, w2 + 0.3, d2 + 0.3, cut * 0.8), top - 3, top - 2.3, false), o.crownCol);
      add(o.steel, prism(rectPts(x, z, w2 * 0.5, d2 * 0.5), top, top + 4), srgb(0.6, 0.6, 0.68));
      top += 4;
    } else if (crown === 'mast') {
      const sh = r.range(12, 28);
      const sp = new THREE.CylinderGeometry(0.2, 0.9, sh, 6);
      sp.translate(x, top + sh / 2, z);
      add(o.steel, sp, srgb(0.82, 0.8, 0.88));
      top += sh;
    } else {
      const ph = Math.min(w2, d2) * 0.6;
      const py = new THREE.ConeGeometry(Math.min(w2, d2) * 0.62, ph, 4, 1);
      py.rotateY(Math.PI / 4);
      py.translate(x, top + ph / 2, z);
      add(o.steel, py, o.trimCol);
      top += ph;
    }
  }
  return top;
}

// the city across the bay: towers from the water's edge back to the horizon, tallest in the
// middle, a gap where the sun goes down; and the bridge over the bay
export function buildSkyline(ctx, rand, mats) {
  const r = rand;
  const o = {
    mats,
    steel: ctx.M.steel,
    neon: ctx.M.neon,
    rand: r,
    chunk: 'skyline',
    trimCol: srgb(0.86, 0.82, 0.92),
    crownCol: hex('#ff5ad1'),
  };
  const crowns = ['#ff5ad1', '#3fe8ff', '#ffb43f', '#9b6bff', '#ffe14f'].map(hex);
  const placed = [];
  const free = (x, z, rr) => {
    for (const p of placed) if (Math.hypot(p[0] - x, p[1] - z) < p[2] + rr + 6) return false;
    return true;
  };
  const one = (x, z, w, d, h) => {
    const rr = Math.max(w, d) * 0.65;
    if (!free(x, z, rr)) return;
    placed.push([x, z, rr]);
    o.crownCol = r.pick(crowns);
    skyscraper(ctx, x, z, w, d, h, o);
  };
  // across the bay (east): a dense waterfront and taller towers behind it
  for (let i = 0; i < 150; i++) {
    const x = r.range(300, 980);
    const z = r.range(-1150, 80);
    if (Math.abs(x - -z * 0.305) < 60) continue;
    const mid = 1 - Math.min(1, Math.abs(z + 420) / 900);
    const back = Math.min(1, (x - 300) / 500);
    const h = r.range(35, 90) + r.range(40, 200) * mid * (0.5 + back * 0.6);
    const w = r.range(18, 34);
    one(x, z, w, w * r.range(0.75, 1.3), h);
  }
  // north, beyond the end of the boulevard
  for (let i = 0; i < 70; i++) {
    const x = r.range(-280, 280);
    const z = r.range(-1350, -560);
    if (Math.abs(x - -z * 0.305) < 70) continue;
    const w = r.range(20, 38);
    one(x, z, w, w * r.range(0.75, 1.3), r.range(60, 270));
  }
  bridge(ctx, r);
}

// the long bridge over the bay: a deck on piers, two great towers and the cables between them,
// lights along it all
function bridge(ctx, r) {
  void r;
  const M = ctx.M;
  const deckCol = srgb(0.72, 0.66, 0.84);
  const towerCol = srgb(0.86, 0.5, 0.62);
  const cableCol = srgb(0.92, 0.88, 0.95);
  const bz = -430;
  const x0 = 31;
  const x1 = 950;
  const add = (mat, g, color) => ctx.B.add(mat, g, null, nextId(), { chunk: 'bridge', ...(color ? { color } : {}) });
  const box = (mat, a0, b0, c0, a1, b1, c1, color) => ctx.B.box(mat, a0, b0, c0, a1, b1, c1, nextId(), { color, chunk: 'bridge' });
  box(M.wallSolid, x0, 11, bz - 7, x1, 13.2, bz + 7, deckCol);
  box(M.wallSolid, x0, 13.2, bz - 7, x1, 14.2, bz - 6.6, deckCol);
  box(M.wallSolid, x0, 13.2, bz + 6.6, x1, 14.2, bz + 7, deckCol);
  for (let x = x0 + 30; x < x1; x += 60) box(M.wallSolid, x - 3, -2, bz - 4, x + 3, 11, bz + 4, deckCol);
  // where it comes ashore: a ramp down into the north of the city
  box(M.wallSolid, x0 - 10, 0, bz - 7, x0 + 1, 13.6, bz + 7, srgb(0.78, 0.7, 0.88));
  // the two towers: legs either side of the deck, joined by beams
  const towers = [300, 640];
  const TH = 92;
  for (const tx of towers) {
    for (const s of [-1, 1]) {
      const leg = prism(rectPts(tx, bz + s * 8.5, 5, 3.2), -2, TH, true);
      add(M.wallSolid, leg, towerCol);
    }
    for (const y of [24, 58, TH - 4]) box(M.wallSolid, tx - 2.2, y, bz - 8.5, tx + 2.2, y + 3.4, bz + 8.5, towerCol);
    // a light at the top of each leg
    for (const s of [-1, 1]) box(M.bridgeLight, tx - 0.6, TH, bz + s * 8.5 - 0.6, tx + 0.6, TH + 1.2, bz + s * 8.5 + 0.6);
  }
  // the main cables: from the shore over the towers and down to the far end, sagging between
  const pts = [[x0 + 20, 16], [towers[0], TH - 1], [(towers[0] + towers[1]) / 2, 22], [towers[1], TH - 1], [x1 - 40, 16]];
  const yAt = (x) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [xa, ya] = pts[i];
      const [xb, yb] = pts[i + 1];
      if (x >= xa && x <= xb) {
        const t = (x - xa) / (xb - xa);
        // between the towers the cable hangs in a curve; outside them it runs nearly straight
        if (i === 1) return ya + (pts[2][1] - ya) * Math.sin(t * Math.PI * 0.5);
        if (i === 2) return pts[2][1] + (yb - pts[2][1]) * (1 - Math.cos(t * Math.PI * 0.5));
        return ya + (yb - ya) * t;
      }
    }
    return 16;
  };
  for (const s of [-1, 1]) {
    const zc = bz + s * 8.5;
    let px = pts[0][0];
    let py = yAt(px);
    for (let x = px + 6; x <= pts[4][0]; x += 6) {
      const y = yAt(x);
      const len = Math.hypot(x - px, y - py);
      const g = new THREE.BoxGeometry(len, 0.6, 0.6);
      g.rotateZ(Math.atan2(y - py, x - px));
      g.translate((x + px) / 2, (y + py) / 2, zc);
      add(M.steel, g, cableCol);
      // the hangers down to the deck
      if (y > 18 && Math.round(x / 6) % 2 === 0) box(M.steel, x - 0.12, 14, zc - 0.12, x + 0.12, y, zc + 0.12, cableCol);
      px = x;
      py = y;
    }
    // lights strung along the cable
    for (let x = pts[0][0] + 6; x < pts[4][0]; x += 18) {
      const y = yAt(x);
      box(M.bridgeLight, x - 0.5, y + 0.3, zc - 0.5, x + 0.5, y + 1.1, zc + 0.5);
    }
  }
  // and the lamps along the deck
  for (let x = x0 + 10; x < x1; x += 11) box(M.bridgeLight, x - 0.35, 14.2, bz + 6.1, x + 0.35, 14.9, bz + 6.8);
}

export { prism, rectPts, roundPts, boxMetres };
