import * as THREE from 'three';
import { mulberry32, Simplex2 } from '../core/noise';

const NZ = new Simplex2(4417);

export interface Rect { u0: number; u1: number; v0: number; v1: number }

/**
 * Accumulates indexed triangles with the attributes the palace materials use:
 * position, normal, uv, `aAO` (baked occlusion, 1 = open) and `aDisp` (0..1 weight of the masonry displacement,
 * 0 on edges so tessellated faces of one block never crack apart).
 */
export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  ao: number[] = [];
  disp: number[] = [];
  idx: number[] = [];

  get vertexCount() {
    return this.pos.length / 3;
  }

  vertex(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, ao = 1, disp = 0) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.ao.push(ao);
    this.disp.push(disp);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  /**
   * Planar grid on the rectangle origin + u*U + v*V (u in [u0,u1], v in [v0,v1]) with ~`spacing` metre cells,
   * skipping cells inside `holes`. Normal = U x V. UV = (u, v) * uvScale. `ao(p, n)` bakes occlusion.
   * `dispEdge` = distance (m) over which aDisp ramps from 0 at the rectangle border to 1.
   */
  grid(origin: THREE.Vector3, U: THREE.Vector3, V: THREE.Vector3, r: Rect, spacing: number, uvScale: number, opts: { holes?: Rect[]; ao?: (p: THREE.Vector3, n: THREE.Vector3) => number; dispEdge?: number; jitter?: (p: THREE.Vector3, n: THREE.Vector3, u: number, v: number) => number; uvOffset?: [number, number] } = {}) {
    const n = new THREE.Vector3().crossVectors(U, V).normalize();
    const holes = opts.holes ?? [];
    // cell boundaries: regular steps plus every hole edge (so holes are cut exactly)
    const cuts = (a0: number, a1: number, extra: number[]) => {
      const s = new Set<number>();
      const steps = Math.max(1, Math.round((a1 - a0) / spacing));
      for (let i = 0; i <= steps; i++) s.add(+(a0 + ((a1 - a0) * i) / steps).toFixed(4));
      for (const e of extra) if (e > a0 && e < a1) s.add(+e.toFixed(4));
      return [...s].sort((a, b) => a - b);
    };
    const us = cuts(r.u0, r.u1, holes.flatMap((h) => [h.u0, h.u1]));
    const vs = cuts(r.v0, r.v1, holes.flatMap((h) => [h.v0, h.v1]));
    const ids: number[][] = [];
    const p = new THREE.Vector3();
    const e = opts.dispEdge ?? 0;
    const [ou, ov] = opts.uvOffset ?? [0, 0];
    for (let j = 0; j < vs.length; j++) {
      ids.push([]);
      for (let i = 0; i < us.length; i++) {
        const u = us[i], v = vs[j];
        p.copy(origin).addScaledVector(U, u).addScaledVector(V, v);
        let d = 0;
        if (e > 0) {
          let m = Math.min(u - r.u0, r.u1 - u, v - r.v0, r.v1 - v);
          for (const h of holes) {
            const du = Math.max(h.u0 - u, u - h.u1, 0), dv = Math.max(h.v0 - v, v - h.v1, 0);
            m = Math.min(m, Math.hypot(du, dv));
          }
          d = THREE.MathUtils.smoothstep(m, 0, e);
        }
        if (opts.jitter) p.addScaledVector(n, opts.jitter(p, n, u, v));
        ids[j].push(this.vertex(p, n, (u + ou) * uvScale, (v + ov) * uvScale, opts.ao ? opts.ao(p, n) : 1, d));
      }
    }
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < us.length - 1; i++) {
        const cu = (us[i] + us[i + 1]) / 2, cv = (vs[j] + vs[j + 1]) / 2;
        if (holes.some((h) => cu > h.u0 && cu < h.u1 && cv > h.v0 && cv < h.v1)) continue;
        const a = ids[j][i], b = ids[j][i + 1], c = ids[j + 1][i + 1], d = ids[j + 1][i];
        this.tri(a, b, c);
        this.tri(a, c, d);
      }
    }
  }

  /**
   * Axis-aligned block (world-space centre, size) with every face gridded. `faces` filters faces by name.
   * UVs are metric (1 unit = 1 m * uvScale) so tiling materials keep their scale on any block.
   */
  block(center: THREE.Vector3, size: THREE.Vector3, spacing: number, uvScale: number, opts: { faces?: string; holes?: Partial<Record<string, Rect[]>>; ao?: (p: THREE.Vector3, n: THREE.Vector3) => number; dispEdge?: number } = {}) {
    const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
    const faces = opts.faces ?? 'px nx py ny pz nz';
    const c = center;
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    const mX = X.clone().negate(), mZ = Z.clone().negate();
    const common = { ao: opts.ao, dispEdge: opts.dispEdge };
    // each face: origin at its min corner so that U x V points outward
    if (faces.includes('px')) this.grid(new THREE.Vector3(c.x + hx, c.y - hy, c.z + hz), mZ, Y, { u0: 0, u1: size.z, v0: 0, v1: size.y }, spacing, uvScale, { ...common, holes: opts.holes?.px, uvOffset: [-(c.z + hz), c.y - hy] });
    if (faces.includes('nx')) this.grid(new THREE.Vector3(c.x - hx, c.y - hy, c.z - hz), Z, Y, { u0: 0, u1: size.z, v0: 0, v1: size.y }, spacing, uvScale, { ...common, holes: opts.holes?.nx, uvOffset: [c.z - hz, c.y - hy] });
    if (faces.includes('pz')) this.grid(new THREE.Vector3(c.x - hx, c.y - hy, c.z + hz), X, Y, { u0: 0, u1: size.x, v0: 0, v1: size.y }, spacing, uvScale, { ...common, holes: opts.holes?.pz, uvOffset: [c.x - hx, c.y - hy] });
    if (faces.includes('nz')) this.grid(new THREE.Vector3(c.x + hx, c.y - hy, c.z - hz), mX, Y, { u0: 0, u1: size.x, v0: 0, v1: size.y }, spacing, uvScale, { ...common, holes: opts.holes?.nz, uvOffset: [-(c.x + hx), c.y - hy] });
    if (faces.includes('py')) this.grid(new THREE.Vector3(c.x - hx, c.y + hy, c.z + hz), X, mZ, { u0: 0, u1: size.x, v0: 0, v1: size.z }, spacing, uvScale, { ...common, holes: opts.holes?.py });
    if (faces.includes('ny')) this.grid(new THREE.Vector3(c.x - hx, c.y - hy, c.z - hz), X, Z, { u0: 0, u1: size.x, v0: 0, v1: size.z }, spacing, uvScale, { ...common, holes: opts.holes?.ny });
  }

  /** Merge a THREE geometry (non-indexed or indexed) transformed by `m`, with constant ao / disp. */
  merge(g: THREE.BufferGeometry, m: THREE.Matrix4, ao = 1, disp = 0) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const aoA = g.getAttribute('aAO') as THREE.BufferAttribute | undefined;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const base = this.vertexCount;
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (nor) n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      else n.set(0, 1, 0);
      this.vertex(p, n, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, aoA ? aoA.getX(i) * ao : ao, disp);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
  }

  build(opts: { ao?: boolean; disp?: boolean } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (opts.ao !== false) g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.ao, 1));
    if (opts.disp) g.setAttribute('aDisp', new THREE.Float32BufferAttribute(this.disp, 1));
    const n = this.pos.length / 3;
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * Rough-hewn timber along +X from 0 to `len`: an adzed, slightly irregular chamfered section that wanders and
 * sags a little. UV: u around the section (metres * 1.6), v along the length (metres * 0.8, grain direction).
 */
export function hewnBeam(len: number, w: number, h: number, seed: number, segs = 0, sag = 0) {
  const rnd = mulberry32(seed);
  const n = segs || Math.max(2, Math.round(len / 0.35));
  const ch = Math.min(w, h) * (0.12 + rnd() * 0.12); // chamfer (the log's rounded wane)
  const sect: [number, number][] = [
    [-w / 2 + ch, -h / 2], [w / 2 - ch, -h / 2], [w / 2, -h / 2 + ch], [w / 2, h / 2 - ch],
    [w / 2 - ch, h / 2], [-w / 2 + ch, h / 2], [-w / 2, h / 2 - ch], [-w / 2, -h / 2 + ch],
  ];
  const ring = sect.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const per: number[] = [0];
  for (let i = 1; i <= ring; i++) {
    const a = sect[i - 1], b = sect[i % ring];
    per.push(per[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const s0 = seed * 0.37;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * len;
    const wobY = NZ.noise(s0, x * 0.35) * 0.03 * len * 0.1 - Math.sin(Math.PI * t) * sag;
    const wobZ = NZ.noise(s0 + 11, x * 0.3) * 0.025 * len * 0.1;
    const tw = NZ.noise(s0 + 23, x * 0.2) * 0.05;
    const sw = 1 + NZ.noise(s0 + 31, x * 0.6) * 0.06;
    for (let k = 0; k <= ring; k++) {
      const [sy, sz] = sect[k % ring];
      const bump = 1 + NZ.noise(s0 + k * 3.1, x * 2.2) * 0.035;
      const yy = (sy * Math.cos(tw) - sz * Math.sin(tw)) * sw * bump;
      const zz = (sy * Math.sin(tw) + sz * Math.cos(tw)) * sw * bump;
      pos.push(x, yy + wobY, zz + wobZ);
      uv.push(per[k] * 1.6 + seed * 0.13, x * 0.8);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * (ring + 1) + k, b = a + 1, c = a + ring + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps
  for (const [i, flip] of [[0, true], [n, false]] as [number, boolean][]) {
    const base = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < ring; k++) {
      const o = (i * (ring + 1) + k) * 3;
      cx += pos[o]; cy += pos[o + 1]; cz += pos[o + 2];
    }
    pos.push(cx / ring, cy / ring, cz / ring);
    uv.push(0.5, 0.5);
    for (let k = 0; k < ring; k++) {
      const o = (i * (ring + 1) + k) * 3;
      pos.push(pos[o], pos[o + 1], pos[o + 2]);
      uv.push(0.5 + sect[k][0] * 2, 0.5 + sect[k][1] * 2);
    }
    for (let k = 0; k < ring; k++) {
      const a = base + 1 + k, b = base + 1 + ((k + 1) % ring);
      if (flip) idx.push(base, a, b);
      else idx.push(base, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Round pole (ceiling joist / spear shaft) along +X, slightly crooked. UV: u around, v along. */
export function pole(len: number, r0: number, r1: number, seed: number, radial = 8, crooked = 0.03) {
  const n = Math.max(2, Math.round(len / 0.4));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(t * len, NZ.noise(seed, t * 3) * crooked * len * 0.3, NZ.noise(seed + 9, t * 3) * crooked * len * 0.3));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, n * 2, 1, radial, false);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2);
    curve.getPointAt(t, c);
    const r = THREE.MathUtils.lerp(r0, r1, t) * (1 + NZ.noise(seed + 3, t * 8) * 0.06);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r);
      pos.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
      uv.setXY(k, (j / radial) * Math.max(0.5, r * 6.3) * 1.6, t * len * 0.8);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Wheel-thrown vessel from a profile [radius, height] (metres), with a clay-texture UV (u around, v up). */
export function vessel(profile: [number, number][], radial = 20) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
  const g = new THREE.LatheGeometry(pts, radial);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, pos.getY(i) * 3.2);
  return g;
}

/** Distance-based ambient occlusion of a point inside an axis-aligned room (floor / ceiling / walls). */
export function roomAO(p: THREE.Vector3, n: THREE.Vector3, room: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, extra?: (p: THREE.Vector3, n: THREE.Vector3) => number) {
  let ao = 1;
  const planes: [number, THREE.Vector3][] = [
    [p.y - room.y0, new THREE.Vector3(0, 1, 0)],
    [room.y1 - p.y, new THREE.Vector3(0, -1, 0)],
    [p.x - room.x0, new THREE.Vector3(1, 0, 0)],
    [room.x1 - p.x, new THREE.Vector3(-1, 0, 0)],
    [p.z - room.z0, new THREE.Vector3(0, 0, 1)],
    [room.z1 - p.z, new THREE.Vector3(0, 0, -1)],
  ];
  for (const [d, pn] of planes) {
    if (n.dot(pn) > 0.7) continue; // the surface itself
    const facing = 1 - Math.abs(n.dot(pn)) * 0.4;
    ao *= 1 - 0.55 * Math.exp(-Math.max(0, d) / 0.45) * facing;
  }
  if (extra) ao *= extra(p, n);
  return Math.max(0.12, ao);
}
