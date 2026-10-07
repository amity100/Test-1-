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
