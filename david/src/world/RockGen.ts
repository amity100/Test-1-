import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise';

/**
 * Procedural limestone rock meshes (runtime, seeded).
 *
 * Judean limestone breaks along bedding planes and joints into rounded blocks and slabs, then dissolves into
 * a knobbly, pitted surface. A mesh starts as an icosphere and gets: a block-ish (superellipsoid) profile,
 * planar bedding / joint cuts, multi-octave 3D noise lumps, optional geometric solution cups (hero rocks),
 * and a buried base. Every vertex also carries `aRock` = (cavity occlusion, height 0..1 in the rock) which the
 * rock material uses for crevice darkening, dust on top and soil staining at the foot. Attribute default
 * (0, 0) means "no occlusion", so meshes without it still render correctly.
 */
export type RockKind = 'boulder' | 'slab' | 'stone' | 'pebble' | 'block';

export interface RockOptions {
  kind?: RockKind;
  detail?: number;
  /** number of geometric solution cups (only meaningful with detail >= 10) */
  pits?: number;
  /** 0..1 how boxy (bedded blocks) vs round */
  blocky?: number;
  /** 0..1 extra karst craggyness: sharp crests, bedding ledges, open fissures (default per kind) */
  crag?: number;
}

// --- small seeded 3D value noise ------------------------------------------------------------------------
function hash3(x: number, y: number, z: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise3(x: number, y: number, z: number, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, s);
  return (
    l(
      l(l(c(0, 0, 0), c(1, 0, 0), ux), l(c(0, 1, 0), c(1, 1, 0), ux), uy),
      l(l(c(0, 0, 1), c(1, 0, 1), ux), l(c(0, 1, 1), c(1, 1, 1), ux), uy),
      uz,
    ) * 2 - 1
  );
}
/** ridged multifractal: sharp crests where the noise crosses zero (weathered, knife-edged karst) */
function ridged3(x: number, y: number, z: number, s: number, oct: number) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(vnoise3(x * f, y * f, z * f, s + i * 23));
    sum += a * r * r;
    norm += a;
    a *= 0.5;
    f *= 2.13;
  }
  return sum / norm;
}
function fbm3(x: number, y: number, z: number, s: number, oct: number) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise3(x * f, y * f, z * f, s + i * 17);
    norm += a;
    a *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}

const SHAPES: Record<RockKind, { scale: [number, number, number]; blocky: number; cuts: number; lump: number; bump: number; base: number; crag: number; cutK: number }> = {
  boulder: { scale: [1.0, 0.72, 0.86], blocky: 0.3, cuts: 4, lump: 0.2, bump: 0.07, base: -0.42, crag: 1.0, cutK: 0.9 },
  slab: { scale: [1.5, 0.45, 1.15], blocky: 0.4, cuts: 3, lump: 0.16, bump: 0.06, base: -0.2, crag: 0.8, cutK: 0.95 },
  block: { scale: [1.0, 0.64, 0.8], blocky: 0.5, cuts: 4, lump: 0.12, bump: 0.05, base: -0.5, crag: 0.6, cutK: 0.95 },
  stone: { scale: [1.0, 0.58, 0.72], blocky: 0.45, cuts: 3, lump: 0.12, bump: 0.04, base: -0.5, crag: 0.35, cutK: 0.9 },
  pebble: { scale: [1.0, 0.55, 0.78], blocky: 0.0, cuts: 0, lump: 0.08, bump: 0.01, base: -0.4, crag: 0, cutK: 0.6 },
};

/** Build one rock geometry (indexed, smooth normals, `aRock` attribute). Roughly unit sized, base near y<0. */
export function rockGeometry(seed: number, opts: RockOptions = {}) {
  const kind = opts.kind ?? 'boulder';
  const S = SHAPES[kind];
  const detail = opts.detail ?? 5;
  const rnd = mulberry32(seed * 7919 + 13);
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const blocky = opts.blocky ?? S.blocky * (0.75 + rnd() * 0.5);
  const sx = S.scale[0] * (0.85 + rnd() * 0.3), sy = S.scale[1] * (0.85 + rnd() * 0.3), sz = S.scale[2] * (0.85 + rnd() * 0.3);
  // bedding / joint planes (unit normals, offsets)
  const cuts: { n: THREE.Vector3; d: number; k: number }[] = [];
  for (let c = 0; c < S.cuts; c++) {
    const nrm = c === 0
      ? new THREE.Vector3((rnd() - 0.5) * 0.35, 1, (rnd() - 0.5) * 0.35) // bedding plane on top
      : new THREE.Vector3(Math.cos(rnd() * 6.283), (rnd() - 0.5) * 0.5, Math.sin(rnd() * 6.283));
    nrm.normalize();
    // joint faces are near-planar breaks (sharp edges), the bedding top a little softer
    cuts.push({ n: nrm, d: (c === 0 ? 0.6 : 0.62) + rnd() * 0.25, k: c === 0 ? 0.7 + rnd() * 0.2 : S.cutK * (0.85 + rnd() * 0.15) });
  }
  // karst detail: open fissures through the rock (solution-widened joints) and bedding ledges on the flanks
  const crag = (opts.crag ?? S.crag) * (detail >= 4 ? 1 : detail >= 3 ? 0.5 : 0.2);
  const fissures: { n: THREE.Vector3; d: number; w: number; depth: number }[] = [];
  const nf = crag > 0.3 && kind !== 'pebble' ? 1 + Math.floor(rnd() * (detail >= 8 ? 3 : 2)) : 0;
  for (let i = 0; i < nf; i++) {
    const a = rnd() * 6.283;
    fissures.push({ n: new THREE.Vector3(Math.cos(a), (rnd() - 0.5) * 0.6, Math.sin(a)).normalize(), d: (rnd() - 0.5) * 0.9, w: 0.035 + rnd() * 0.05, depth: 0.08 + rnd() * 0.1 });
  }
  const ledgeF = 3.5 + rnd() * 3, ledgePh = rnd() * 10;
  // geometric solution cups (on the upper half)
  const pitCount = opts.pits ?? 0;
  const pits: { c: THREE.Vector3; r: number; d: number }[] = [];
  // pits come in nests (as on the reference boulders): most cluster around a few centres on the upper half
  const nests = [0, 1, 2].map(() => new THREE.Vector3(rnd() * 2 - 1, 0.2 + rnd() * 0.8, rnd() * 2 - 1).normalize());
  for (let i = 0; i < pitCount; i++) {
    const c = rnd() < 0.7
      ? nests[i % 3].clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.7)).normalize()
      : new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.2 - 0.2, rnd() * 2 - 1).normalize();
    pits.push({ c, r: 0.04 + Math.pow(rnd(), 2.0) * 0.12, d: 0.05 + rnd() * 0.08 });
  }
  const v = new THREE.Vector3();
  const s = seed * 31 + 7;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i); // unit sphere direction
    const dir = v.clone();
    // superellipsoid-ish: push toward the cube surface
    const m = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const cubeR = 1 / m;
    let r = 1 + (Math.min(cubeR, 1.45) - 1) * blocky * 0.85;
    // large lumps, medium knobs, fine roughness
    r *= 1 + S.lump * fbm3(dir.x * 1.2 + s, dir.y * 1.2, dir.z * 1.2, seed, 3);
    // bulbous, cauliflower-like dissolution lumps (the look of weathered Judean limestone)
    r *= 1 + S.lump * 0.45 * Math.pow(Math.max(0, fbm3(dir.x * 2.4 - s, dir.y * 2.4, dir.z * 2.4 + s, seed + 3, 2) + 0.15), 0.8);
    r *= 1 + S.bump * fbm3(dir.x * 4.3, dir.y * 4.3 + s, dir.z * 4.3, seed + 5, 3);
    if (crag > 0) {
      // knife-edged crests and hollows (ridged noise), strongest on the upper, exposed half
      const cr = ridged3(dir.x * 2.6 + s, dir.y * 2.6, dir.z * 2.6 - s, seed + 9, detail >= 8 ? 4 : 3);
      r *= 1 + crag * 0.16 * (cr - 0.55) * (0.6 + 0.4 * Math.max(0, dir.y));
      // bedding ledges: stepped recesses on the flanks (horizontal strata of the Judean limestone)
      const side = 1 - Math.min(1, Math.abs(dir.y) * 1.4);
      const lt = dir.y * ledgeF + ledgePh + 0.35 * fbm3(dir.x * 1.7, dir.y, dir.z * 1.7, seed + 11, 2);
      const fr = lt - Math.floor(lt);
      r *= 1 - crag * 0.07 * side * THREE.MathUtils.smoothstep(fr, 0.62, 0.9);
    }
    v.copy(dir).multiplyScalar(r);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    // planar cuts flatten the rock into facets (rounded where the plane meets the body)
    for (const c of cuts) {
      const t = v.dot(c.n) - c.d * (c.n.y > 0.8 ? sy : Math.max(sx, sz) * 0.8);
      if (t > 0) v.addScaledVector(c.n, -t * c.k * (0.55 + 0.45 * Math.min(1, t * 4)));
    }
    // open fissures: V-grooves along joint planes
    for (const f of fissures) {
      const d = Math.abs(dir.dot(f.n) - f.d);
      if (d < f.w) {
        const q = 1 - d / f.w;
        v.multiplyScalar(1 - f.depth * crag * q * q);
      }
    }
    // solution cups
    for (const p of pits) {
      const ang = dir.distanceTo(p.c);
      if (ang < p.r) {
        const q = ang / p.r;
        v.multiplyScalar(1 - p.d * (1 - q * q) * (1 - q * q) * 1.4);
      }
    }
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // buried base: squash everything below the base line
  const baseY = S.base * sy * 1.2;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    if (y < baseY) pos.setY(i, baseY + (y - baseY) * 0.25);
  }
  g.computeVertexNormals();
  // cavity occlusion from the 1-ring (concave -> occluded) + height fraction
  const idx = g.index!;
  const sum = new Float32Array(n * 3);
  const cnt = new Float32Array(n);
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    for (const [p, q] of [[a, b], [b, c], [c, a], [b, a], [c, b], [a, c]]) {
      sum[p * 3] += pos.getX(q); sum[p * 3 + 1] += pos.getY(q); sum[p * 3 + 2] += pos.getZ(q);
      cnt[p]++;
    }
  }
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const rock = new Float32Array(n * 2);
  // average edge length for normalisation
  const edge = 2.2 / (detail + 1);
  const y0 = Math.max(minY, baseY), y1 = maxY;
  for (let i = 0; i < n; i++) {
    const ax = sum[i * 3] / cnt[i] - pos.getX(i), ay = sum[i * 3 + 1] / cnt[i] - pos.getY(i), az = sum[i * 3 + 2] / cnt[i] - pos.getZ(i);
    const concave = (ax * nor.getX(i) + ay * nor.getY(i) + az * nor.getZ(i)) / edge;
    let occ = THREE.MathUtils.clamp(concave * 2.2, 0, 0.7);
    // the underside is always darker (faces the ground)
    occ = Math.max(occ, THREE.MathUtils.clamp(-nor.getY(i) * 0.35, 0, 0.35));
    rock[i * 2] = occ;
    rock[i * 2 + 1] = THREE.MathUtils.clamp((pos.getY(i) - y0) / Math.max(1e-3, y1 - y0), 0, 1);
  }
  g.setAttribute('aRock', new THREE.BufferAttribute(rock, 2));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Triangle count helper for budgeting. */
export function triCount(g: THREE.BufferGeometry) {
  return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
}
