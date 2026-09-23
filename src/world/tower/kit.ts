import * as THREE from 'three';
import type { Collider, CollisionWorld } from '../collision';
import type { LampDef, PropDef, ZoneId } from '../../core/contracts';

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Deterministic PRNG (Park-Miller). */
export function rng(seed: number) {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const box3 = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  new THREE.Box3(V(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), V(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)));

type Bucket = { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] };

export interface BoxOpts {
  skipBottom?: boolean;
  skipTop?: boolean;
  /** Baked contact AO on vertical faces (0 = none, 1 = full). Default 1 for boxes that rest on something. */
  ao?: number;
  /** Height of the AO gradient (m). */
  aoH?: number;
  uvRotate?: boolean;
  /** Uniform darkening of the bottom face (undersides read darker). */
  under?: number;
}

// face table: normal, [u axis, v axis], corners as (0|1) selectors of min/max per axis
const FACES: [number[], number[], number[][]][] = [
  [[1, 0, 0], [2, 1], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
  [[-1, 0, 0], [2, 1], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [[0, 1, 0], [0, 2], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [[0, -1, 0], [0, 2], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
  [[0, 0, -1], [0, 1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Accumulates geometry into one merged mesh per material key. Boxes get
 * world-space UVs (constant texel density) and baked contact AO in vertex
 * colours, so a whole zone renders in ~one draw call per material.
 */
export class Builder {
  private buckets = new Map<string, Bucket>();

  private bucket(key: string) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { pos: [], nrm: [], uv: [], col: [], idx: [] };
      this.buckets.set(key, b);
    }
    return b;
  }

  get vertexCount() {
    let n = 0;
    for (const b of this.buckets.values()) n += b.pos.length / 3;
    return n;
  }

  /** Axis-aligned box with world-space UVs (`uv` = metres per texture repeat). */
  box(key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.ColorRepresentation = 0xffffff, uv = 2, o: BoxOpts = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const b = this.bucket(key);
    const c = _c.set(color);
    const ao = o.ao ?? 1;
    const aoH = o.aoH ?? 1.2;
    const lo = [x0, y0, z0], hi = [x1, y1, z1];
    for (const [n, axes, corners] of FACES) {
      if (o.skipBottom && n[1] === -1) continue;
      if (o.skipTop && n[1] === 1) continue;
      const base = b.pos.length / 3;
      for (const s of corners) {
        const p = [s[0] ? hi[0] : lo[0], s[1] ? hi[1] : lo[1], s[2] ? hi[2] : lo[2]];
        b.pos.push(p[0], p[1], p[2]);
        b.nrm.push(n[0], n[1], n[2]);
        let u = p[axes[0]] / uv, v = p[axes[1]] / uv;
        if (o.uvRotate) [u, v] = [v, u];
        b.uv.push(u, v);
        let shade = 1;
        if (n[1] === 0 && ao > 0) shade = 1 - ao * 0.42 * (1 - THREE.MathUtils.clamp((p[1] - y0) / aoH, 0, 1));
        if (n[1] === -1) shade *= 1 - (o.under ?? 0.25);
        b.col.push(c.r * shade, c.g * shade, c.b * shade);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** Oriented box: `m` places a box of size sx,sy,sz (centred at the local origin). UVs follow the box's own axes. */
  obox(key: string, m: THREE.Matrix4, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation = 0xffffff, uv = 2, shadeBottom = 0.8) {
    const b = this.bucket(key);
    const c = _c.set(color);
    const size = [sx, sy, sz];
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (const [n, axes, corners] of FACES) {
      const base = b.pos.length / 3;
      _n.set(n[0], n[1], n[2]).applyMatrix3(nm).normalize();
      const shade = _n.y < -0.5 ? shadeBottom : 1;
      for (const s of corners) {
        const lp = [(s[0] - 0.5) * sx, (s[1] - 0.5) * sy, (s[2] - 0.5) * sz];
        _v.set(lp[0], lp[1], lp[2]).applyMatrix4(m);
        b.pos.push(_v.x, _v.y, _v.z);
        b.nrm.push(_n.x, _n.y, _n.z);
        b.uv.push((s[axes[0]] * size[axes[0]]) / uv, (s[axes[1]] * size[axes[1]]) / uv);
        b.col.push(c.r * shade, c.g * shade, c.b * shade);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** Box of cross-section w (side) x h (up) running from a to b. */
  beam(key: string, a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: THREE.ColorRepresentation = 0xffffff, uv = 2, up: THREE.Vector3 = _up) {
    const d = _v.subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return;
    const z = d.clone().normalize();
    let x = new THREE.Vector3().crossVectors(up, z);
    if (x.lengthSq() < 1e-6) x = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), z);
    x.normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    _m.makeBasis(x, y, z).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.obox(key, _m.clone(), w, h, len, color, uv);
  }

  /** I-beam (flanges + web) from a to b; `h` is the depth, `w` the flange width. */
  ibeam(key: string, a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: THREE.ColorRepresentation, uv = 2, up: THREE.Vector3 = _up) {
    const d = new THREE.Vector3().subVectors(b, a).normalize();
    let x = new THREE.Vector3().crossVectors(up, d);
    if (x.lengthSq() < 1e-6) x = new THREE.Vector3(1, 0, 0);
    x.normalize();
    const y = new THREE.Vector3().crossVectors(d, x).normalize();
    const t = Math.max(0.03, h * 0.09);
    const off = y.clone().multiplyScalar(h / 2 - t / 2);
    this.beam(key, a.clone().add(off), b.clone().add(off), w, t, color, uv, up);
    this.beam(key, a.clone().sub(off), b.clone().sub(off), w, t, color, uv, up);
    this.beam(key, a, b, Math.max(0.025, w * 0.14), h - t * 2, color, uv, up);
  }

  /** Cylinder between two points. */
  cylinder(key: string, a: THREE.Vector3, b: THREE.Vector3, r: number, color: THREE.ColorRepresentation = 0xffffff, seg = 12, uv = 2, caps = true, r2 = r) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, !caps);
    const uva = g.getAttribute('uv');
    const circ = Math.PI * 2 * Math.max(r, r2);
    for (let i = 0; i < uva.count; i++) uva.setXY(i, (uva.getX(i) * circ) / uv, (uva.getY(i) * len) / uv);
    _q.setFromUnitVectors(_up, d.normalize());
    _m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(_m);
    this.geo(key, g, color);
    g.dispose();
  }

  /** Arbitrary positioned geometry (uses its own UVs, optionally scaled). */
  geo(key: string, g: THREE.BufferGeometry, color: THREE.ColorRepresentation = 0xffffff, uvScale = 1, vertexShade?: (p: THREE.Vector3, n: THREE.Vector3) => number) {
    const b = this.bucket(key);
    const c = new THREE.Color(color);
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const base = b.pos.length / 3;
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      b.pos.push(p.x, p.y, p.z);
      b.nrm.push(n.x, n.y, n.z);
      b.uv.push(uv ? uv.getX(i) * uvScale : 0, uv ? uv.getY(i) * uvScale : 0);
      const s = vertexShade ? vertexShade(p, n) : n.y < -0.5 ? 0.8 : 1;
      b.col.push(c.r * s, c.g * s, c.b * s);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) b.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  }

  /** Transformed copy of a template geometry. */
  geoAt(key: string, g: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.ColorRepresentation = 0xffffff, uvScale = 1) {
    const c = g.clone().applyMatrix4(m);
    this.geo(key, c, color, uvScale);
    c.dispose();
  }

  /** Flat quad (double-sided materials: nets, signs, glass panes). Corners in CCW order. */
  quad(key: string, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.ColorRepresentation = 0xffffff, uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const bk = this.bucket(key);
    const col = _c.set(color);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    const base = bk.pos.length / 3;
    [a, b, c, d].forEach((p, i) => {
      bk.pos.push(p.x, p.y, p.z);
      bk.nrm.push(n.x, n.y, n.z);
      bk.uv.push(uvs[i][0], uvs[i][1]);
      bk.col.push(col.r, col.g, col.b);
    });
    bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Vertical rectangle in a plane of constant x or z (world UVs). */
  panel(key: string, axis: 'x' | 'z', at: number, a0: number, a1: number, y0: number, y1: number, color: THREE.ColorRepresentation = 0xffffff, uv = 2, facing: 1 | -1 = 1) {
    if (axis === 'z') {
      const pts = [V(a0, y0, at), V(a1, y0, at), V(a1, y1, at), V(a0, y1, at)];
      const uvs: [number, number][] = pts.map((p) => [p.x / uv, p.y / uv]);
      if (facing < 0) this.quad(key, pts[1], pts[0], pts[3], pts[2], color, [uvs[1], uvs[0], uvs[3], uvs[2]]);
      else this.quad(key, pts[0], pts[1], pts[2], pts[3], color, uvs);
    } else {
      const pts = [V(at, y0, a1), V(at, y0, a0), V(at, y1, a0), V(at, y1, a1)];
      const uvs: [number, number][] = pts.map((p) => [p.z / uv, p.y / uv]);
      if (facing < 0) this.quad(key, pts[1], pts[0], pts[3], pts[2], color, [uvs[1], uvs[0], uvs[3], uvs[2]]);
      else this.quad(key, pts[0], pts[1], pts[2], pts[3], color, uvs);
    }
  }

  isEmpty() {
    return this.buckets.size === 0;
  }

  build(materials: Record<string, THREE.Material>, opts: { castShadow?: boolean; receiveShadow?: boolean; name?: string; noShadow?: string[] } = {}) {
    const group = new THREE.Group();
    group.name = opts.name ?? 'static';
    for (const [key, b] of this.buckets) {
      if (!b.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mat = materials[key];
      if (!mat) throw new Error(`No material for bucket ${key}`);
      const m = new THREE.Mesh(g, mat);
      const noShadow = opts.noShadow?.includes(key) ?? false;
      m.castShadow = !noShadow && (opts.castShadow ?? true);
      m.receiveShadow = opts.receiveShadow ?? true;
      m.name = `${group.name}:${key}`;
      if ((mat as THREE.Material).transparent) m.renderOrder = 2;
      group.add(m);
    }
    this.buckets.clear();
    return group;
  }
}

/** Everything a zone builder needs. */
export interface Ctx {
  world: CollisionWorld;
  /** The zone's own merged geometry (hidden when the zone is far). */
  mb: Builder;
  /** Always-visible landmark geometry (tower shell, cranes, hoist). */
  shell: Builder;
  zone: ZoneId;
  zoneRoot: THREE.Group;
  shellRoot: THREE.Group;
  mobile: boolean;
  headless: boolean;
  materials: Record<string, THREE.Material>;
  animated: ((t: number) => void)[];
  lamps: LampDef[];
  props: PropDef[];
  /** Blinking aviation lights (merged into one instanced mesh at the end). */
  beacons: { pos: THREE.Vector3; phase: number }[];
}

/** Collider + mesh in one go. */
export function solid(ctx: Ctx, key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.ColorRepresentation, uv = 2, col: Partial<Collider> = {}, mesh: BoxOpts & { shell?: boolean } = {}) {
  const c = ctx.world.add(V(x0, y0, z0), V(x1, y1, z1), col);
  (mesh.shell ? ctx.shell : ctx.mb).box(key, x0, y0, z0, x1, y1, z1, color, uv, mesh);
  return c;
}

/** Collider only. */
export function col(ctx: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, opts: Partial<Collider> = {}) {
  return ctx.world.add(V(x0, y0, z0), V(x1, y1, z1), opts);
}

let propSeq = 0;
export function addProp(ctx: Ctx, kind: PropDef['kind'], pos: THREE.Vector3, size: THREE.Vector3, opts: { yaw?: number; hangFrom?: THREE.Vector3; explosive?: boolean; mass?: number; id?: string } = {}) {
  const id = opts.id ?? `${ctx.zone}.${kind}.${++propSeq}`;
  const vol = size.x * size.y * size.z;
  const density = kind === 'barrel' ? 260 : kind === 'crate' ? 180 : kind === 'container' ? 160 : kind === 'beamBundle' ? 900 : 500;
  const def: PropDef = {
    id,
    kind,
    zone: ctx.zone,
    pos: pos.clone(),
    size: size.clone(),
    yaw: opts.yaw ?? 0,
    mass: opts.mass ?? Math.round(vol * density),
  };
  if (opts.hangFrom) def.hangFrom = opts.hangFrom.clone();
  if (opts.explosive) def.explosive = true;
  ctx.props.push(def);
  return def;
}

export function resetPropSeq() {
  propSeq = 0;
}

/** Standard ISO container sizes. */
export const CONT = { L40: 12.19, L20: 6.06, L10: 2.99, W: 2.44, H: 2.59 };

export const PALETTE = {
  crane: 0xf2b21c,
  craneDark: 0xc98e10,
  orange: 0xf06a1c,
  primer: 0xb4502a,
  steel: 0x8c9196,
  steelDark: 0x3a3e44,
  galv: 0xa9b0b6,
  concrete: 0xc9c2b6,
  concreteDark: 0x9c968c,
  kessler: 0x1d2a38,
  kesslerCyan: 0x39e6ff,
  wood: 0xe0c8a0,
  hoarding: 0x243447,
  white: 0xf2f2f0,
  containers: [0x9e2b25, 0x1f4e79, 0x2e6b3a, 0xc27c1a, 0x6a6e73, 0x7a2f58, 0x2a8a8c, 0xb5a33a, 0x3c5a8a, 0xa34d1f, 0xd8d2c4],
};
