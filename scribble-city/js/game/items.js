import * as THREE from 'three';
import { MeshBuilder } from '../render/MeshBuilder.js';
import { StrokeList, BLACK_INK } from '../render/LineBatch.js';
import { COL } from '../world/buildings.js';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * The hero's starting weapon: a big pencil held at the graphite end,
 * swung so the eraser end erases things. Local +z points to the eraser.
 */
export function buildPencilModel(mats) {
  const mb = new MeshBuilder();
  const sl = new StrokeList();
  const r = 0.05;
  const L0 = -0.16;
  const L1 = 0.92;
  const n = 6;
  const ring = (z, rr) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 6;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr, z]);
    }
    return pts;
  };
  const body0 = ring(L0, r);
  const body1 = ring(L1 - 0.14, r);
  const yellow = [0.93, 0.82, 0.45];
  for (let i = 0; i < n; i++) {
    const a0 = body0[i];
    const a1 = body0[(i + 1) % n];
    const b0 = body1[i];
    const b1 = body1[(i + 1) % n];
    const nm = [(a0[0] + a1[0]) / 2 / r, (a0[1] + a1[1]) / 2 / r, 0];
    mb.quad(a1, a0, b0, b1, nm, yellow, [[0, 0], [0.1, 0], [0.1, 1], [0, 1]]);
    sl.seg(a0, b0, { width: 1.6, overshoot: 0.02, wobble: 0.004, color: BLACK_INK });
  }
  sl.poly(body0, true, { width: 1.6, overshoot: 0.01, color: BLACK_INK });
  sl.poly(body1, true, { width: 1.6, overshoot: 0.01, color: BLACK_INK });
  // sharpened wood tip + graphite
  const tipZ = L0 - 0.16;
  for (let i = 0; i < n; i++) {
    const a0 = body0[i];
    const a1 = body0[(i + 1) % n];
    const nm = [(a0[0] + a1[0]) / 2 / r, (a0[1] + a1[1]) / 2 / r, -0.6];
    mb.tri(a0, a1, [0, 0, tipZ], nm, [0.9, 0.8, 0.66], [[0, 0], [0.1, 0], [0.05, 0.1]]);
    sl.seg(a0, [0, 0, tipZ], { width: 1.3, overshoot: 0, color: BLACK_INK });
  }
  sl.seg([0, 0, tipZ + 0.05], [0, 0, tipZ - 0.01], { width: 4, overshoot: 0, color: [0.2, 0.2, 0.24] });
  // ferrule + eraser
  const fer0 = ring(L1 - 0.14, r * 1.06);
  const fer1 = ring(L1 - 0.06, r * 1.06);
  const er1 = ring(L1 + 0.08, r * 1.0);
  for (let i = 0; i < n; i++) {
    const nm = [(fer0[i][0] + fer0[(i + 1) % n][0]) / 2 / r, (fer0[i][1] + fer0[(i + 1) % n][1]) / 2 / r, 0];
    mb.quad(fer0[(i + 1) % n], fer0[i], fer1[i], fer1[(i + 1) % n], nm, COL.metal, [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]]);
    mb.quad(fer1[(i + 1) % n], fer1[i], er1[i], er1[(i + 1) % n], nm, [0.92, 0.66, 0.7], [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]]);
    sl.seg(fer1[i], er1[i], { width: 1.4, overshoot: 0, color: BLACK_INK });
  }
  for (let i = 1; i < n - 1; i++) mb.tri(er1[0], er1[i], er1[i + 1], [0, 0, 1], [0.92, 0.66, 0.7], [[0, 0], [0.1, 0], [0, 0.1]]);
  sl.poly(fer1, true, { width: 1.4, overshoot: 0, color: BLACK_INK });
  sl.poly(er1, true, { width: 1.6, overshoot: 0, color: BLACK_INK });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(mb.build(), mats.itemSurface);
  group.add(mesh);
  const lines = sl.toBatch(mats.itemLine);
  lines.mesh.frustumCulled = false;
  group.add(lines.mesh);
  group.matrixAutoUpdate = false;
  return { group, tip: new THREE.Vector3(0, 0, L1 + 0.08), length: 1.1, lines };
}

/**
 * Turn the player's drawing (already aligned to the blueprint's template space) into a
 * thin "cut-out" 3D model: template fills (colored pencil) + the player's own strokes on both sides.
 * Local frame: origin at the anchor, +z = template +x (forward), +y = template -y (up).
 */
export function buildDrawnFlatModel(bp, strokes, mats, o = {}) {
  const k = (bp.scale || 1) / 100;
  const ax = o.anchor ? o.anchor[0] : 50;
  const ay = o.anchor ? o.anchor[1] : 50;
  const th = o.thickness || 0.03;
  const L = (p) => [(p[0] - ax) * k, -(p[1] - ay) * k];
  const mb = new MeshBuilder();
  for (const f of bp.fills) {
    const pts = f.poly.map(L);
    const contour = pts.map(([z, y]) => new THREE.Vector2(z, y));
    if (contour.length > 2 && contour[0].distanceTo(contour[contour.length - 1]) < 1e-4) contour.pop();
    let tris;
    try {
      tris = THREE.ShapeUtils.triangulateShape(contour, []);
    } catch (e) {
      tris = [];
    }
    const col = hexToRgb(f.color);
    for (const [a, b, c] of tris) {
      const A = contour[a];
      const B = contour[b];
      const C = contour[c];
      for (const s of [-1, 1]) {
        const p = (v) => [s * th, v.y, v.x];
        const ccw = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) > 0;
        const order = (s > 0) === ccw ? [A, B, C] : [A, C, B];
        mb.tri(p(order[0]), p(order[1]), p(order[2]), [s, 0, 0], col, [[order[0].x, order[0].y], [order[1].x, order[1].y], [order[2].x, order[2].y]]);
      }
    }
  }
  const sl = new StrokeList();
  const ink = o.color || BLACK_INK;
  let segCount = 0;
  for (const st of strokes) {
    for (let i = 0; i < st.length - 1; i++) {
      const a = L(st[i]);
      const b = L(st[i + 1]);
      for (const s of [-1, 1]) {
        sl.seg([s * th * 1.1, a[1], a[0]], [s * th * 1.1, b[1], b[0]], { width: o.width || 2.2, overshoot: 0.004, wobble: 0.01, color: ink });
        segCount++;
      }
    }
    // tie the two sides together at the stroke ends
    if (st.length > 1) {
      for (const p of [st[0], st[st.length - 1]]) {
        const q = L(p);
        sl.seg([-th * 1.1, q[1], q[0]], [th * 1.1, q[1], q[0]], { width: 1.4, overshoot: 0, color: ink });
      }
    }
  }
  const group = new THREE.Group();
  if (!mb.empty) group.add(new THREE.Mesh(mb.build(), mats.itemSurface));
  const lines = sl.toBatch(mats.itemLine);
  lines.mesh.frustumCulled = false;
  group.add(lines.mesh);
  group.matrixAutoUpdate = false;
  return { group, lines, segCount, toLocal: L };
}

// Reveal animation for freshly drawn items: strokes appear in drawing order.
export function setReveal(lines, t) {
  const n = lines.count;
  const shown = Math.floor(n * Math.min(1, t));
  const col = lines.col;
  for (let i = 0; i < n; i++) col[i * 4 + 3] = i < shown ? 0.95 : 0;
  lines.attrC.clearUpdateRanges();
  lines.attrC.addUpdateRange(0, n * 4);
  lines.attrC.needsUpdate = true;
}

// ------------------------------------------------------------------ police gear (pick-ups)
// Local frame for held items: origin in the hand, +z forward (muzzle / striking end), +y up.

// box with ink edges
function gearBox(mb, sl, x0, y0, z0, x1, y1, z1, color, w = 1.5) {
  mb.box([x0, y0, z0], [x1, y1, z1], { color, bottom: true });
  sl.boxEdges([x0, y0, z0], [x1, y1, z1], { width: w, overshoot: 0.008, wobble: 0.004, color: BLACK_INK });
}

// n-sided prism along z (pens, barrels)
function gearPrism(mb, sl, cx, cy, z0, z1, r, color, n = 6, w = 1.3) {
  const ring = (z) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
    return pts;
  };
  const A = ring(z0);
  const B = ring(z1);
  for (let i = 0; i < n; i++) {
    const a0 = A[i];
    const a1 = A[(i + 1) % n];
    const b0 = B[i];
    const b1 = B[(i + 1) % n];
    const nm = [(a0[0] + a1[0]) / 2 - cx, (a0[1] + a1[1]) / 2 - cy, 0];
    const l = Math.hypot(nm[0], nm[1]) || 1;
    mb.quad(a1, a0, b0, b1, [nm[0] / l, nm[1] / l, 0], color, [[0, 0], [0.05, 0], [0.05, 0.2], [0, 0.2]]);
  }
  for (let i = 1; i < n - 1; i++) {
    mb.tri(A[0], A[i + 1], A[i], [0, 0, -1], color, [[0, 0], [0.05, 0], [0, 0.05]]);
    mb.tri(B[0], B[i], B[i + 1], [0, 0, 1], color, [[0, 0], [0.05, 0], [0, 0.05]]);
  }
  sl.poly(A, true, { width: w, overshoot: 0.004, color: BLACK_INK });
  sl.poly(B, true, { width: w, overshoot: 0.004, color: BLACK_INK });
  sl.seg(A[0], B[0], { width: w, overshoot: 0.01, color: BLACK_INK });
  sl.seg(A[Math.floor(n / 2)], B[Math.floor(n / 2)], { width: w, overshoot: 0.01, color: BLACK_INK });
}

function finishGear(mb, sl, mats, extra) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(mb.build(), mats.itemSurface));
  const lines = sl.toBatch(mats.itemLine);
  lines.mesh.frustumCulled = false;
  group.add(lines.mesh);
  group.matrixAutoUpdate = false;
  return { group, lines, ...extra };
}

export const PEN_BLUE = [0.2, 0.36, 0.78];

/** A police pen-pistol: a fat ballpoint for a barrel on a moulded grip; shoots blue ink. */
export function buildPenGunModel(mats) {
  const mb = new MeshBuilder();
  const sl = new StrokeList();
  const clear = [0.85, 0.9, 0.95];
  gearBox(mb, sl, -0.022, -0.13, -0.05, 0.022, 0.0, 0.015, [0.16, 0.18, 0.24]); // grip
  gearPrism(mb, sl, 0, 0.03, -0.07, 0.2, 0.026, clear, 6); // see-through barrel
  gearPrism(mb, sl, 0, 0.03, -0.06, 0.17, 0.008, PEN_BLUE, 4, 1); // ink tube inside
  gearPrism(mb, sl, 0, 0.03, 0.2, 0.26, 0.02, PEN_BLUE, 6); // cap ring
  gearPrism(mb, sl, 0, 0.03, -0.11, -0.07, 0.012, PEN_BLUE, 6); // clicker
  // metal tip
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    mb.tri([Math.cos(a0) * 0.02, 0.03 + Math.sin(a0) * 0.02, 0.26], [Math.cos(a1) * 0.02, 0.03 + Math.sin(a1) * 0.02, 0.26], [0, 0.03, 0.31], [Math.cos(a0), Math.sin(a0), 0.4], COL.metal, [[0, 0], [0.02, 0], [0.01, 0.05]]);
  }
  sl.seg([0.02, 0.03, 0.26], [0, 0.03, 0.31], { width: 1.3, overshoot: 0, color: BLACK_INK });
  sl.seg([-0.02, 0.03, 0.26], [0, 0.03, 0.31], { width: 1.3, overshoot: 0, color: BLACK_INK });
  // pocket clip and trigger
  sl.seg([0.03, 0.06, -0.06], [0.03, 0.06, 0.1], { width: 2.2, overshoot: 0, color: PEN_BLUE });
  sl.poly([[0, -0.01, 0.0], [0, -0.05, 0.02], [0, -0.06, 0.05]], false, { width: 2, overshoot: 0, color: BLACK_INK });
  return finishGear(mb, sl, mats, { muzzle: new THREE.Vector3(0, 0.03, 0.33), length: 0.4 });
}

/** A paint M4: rifle silhouette with a paint canister for a magazine; sprays paint balls. */
export function buildM4Model(mats, paint = [0.95, 0.35, 0.6]) {
  const mb = new MeshBuilder();
  const sl = new StrokeList();
  const dark = [0.26, 0.27, 0.31];
  gearBox(mb, sl, -0.03, -0.02, -0.12, 0.03, 0.06, 0.2, dark); // receiver
  gearBox(mb, sl, -0.025, -0.05, -0.36, 0.025, 0.05, -0.12, [0.33, 0.33, 0.36]); // stock
  gearBox(mb, sl, -0.022, -0.12, -0.06, 0.022, -0.02, 0.0, dark); // grip
  gearBox(mb, sl, -0.032, -0.01, 0.2, 0.032, 0.05, 0.38, [0.36, 0.37, 0.4]); // handguard
  gearPrism(mb, sl, 0, 0.02, 0.38, 0.6, 0.012, dark, 6); // barrel
  gearBox(mb, sl, -0.012, 0.06, -0.02, 0.012, 0.1, 0.14, dark); // carry handle / sight
  // paint canister magazine with drips
  gearPrism(mb, sl, 0, -0.1, 0.03, 0.13, 0.045, paint, 8);
  sl.seg([0.046, -0.1, 0.06], [0.046, -0.16, 0.06], { width: 3, overshoot: 0, color: paint });
  sl.seg([-0.046, -0.12, 0.1], [-0.046, -0.18, 0.1], { width: 2.4, overshoot: 0, color: paint });
  // paint splats on the body
  sl.seg([0.031, 0.03, 0.05], [0.031, 0.0, 0.1], { width: 4, overshoot: 0, color: paint });
  sl.seg([-0.031, 0.02, -0.25], [-0.031, -0.02, -0.2], { width: 3.4, overshoot: 0, color: [0.3, 0.6, 0.9] });
  return finishGear(mb, sl, mats, { muzzle: new THREE.Vector3(0, 0.02, 0.62), length: 0.95 });
}

export const ERASER_PINK = [0.93, 0.5, 0.56];
export const ERASER_BLUE = [0.36, 0.48, 0.82];

/** The big two-tone school eraser (the kind that comes on its own, not on a pencil). */
export function buildBigEraserModel(mats) {
  const mb = new MeshBuilder();
  const sl = new StrokeList();
  const w = 0.075;
  const h = 0.045;
  gearBox(mb, sl, -w, -h, -0.02, w, h, 0.17, ERASER_PINK, 1.8);
  gearBox(mb, sl, -w, -h, 0.17, w, h, 0.34, ERASER_BLUE, 1.8);
  // paper sleeve band with a scribbled brand
  gearBox(mb, sl, -w - 0.004, -h - 0.004, 0.12, w + 0.004, h + 0.004, 0.22, [0.96, 0.95, 0.9], 1.3);
  for (let i = 0; i < 4; i++) sl.seg([-0.04 + i * 0.022, h + 0.006, 0.14 + (i % 2) * 0.03], [-0.03 + i * 0.022, h + 0.006, 0.19 - (i % 2) * 0.03], { width: 1.4, overshoot: 0, color: ERASER_BLUE });
  // worn, rounded corner smudges
  sl.seg([w, h, 0.32], [w, -h, 0.33], { width: 2.6, overshoot: 0, color: [0.55, 0.55, 0.62], alpha: 0.5 });
  return finishGear(mb, sl, mats, { tip: new THREE.Vector3(0, 0, 0.34), length: 0.38 });
}
