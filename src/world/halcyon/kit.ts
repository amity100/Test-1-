import * as THREE from 'three';
import type { Collider } from '../collision';
import { Builder, V, col, rng, solid, type BoxOpts, type Ctx } from '../tower/kit';
import { Instancer } from './instances';
import { DECAL, LEAF } from './textures';
import type { Slab } from './layout';

/** Palette (sRGB), from the city's art direction. */
export const CITY = {
  stone: 0xe8d4b2,
  stoneShade: 0xbca98c,
  trim: 0xe6d5b6,
  rustic: 0xc8b08a,
  paving: 0xe2cfae,
  granite: 0x7e7264,
  iron: 0x20252d,
  frame: 0x2a2f38,
  gilt: 0xc9a24a,
  brass: 0xd2a248,
  bronze: 0x6e5034,
  red: 0x9e1f1c,
  navy: 0x1d2b45,
  cream: 0xeee4cf,
  copper: 0x5e8a7a,
  copperFresh: 0xb87333,
  slate: 0x3a4050,
  leaf: 0xb3261e,
  ivy: 0x3f6b2a,
  wood: 0x7a4a2c,
} as const;

/**
 * One chunk of the city (left, centre, right): its own merged geometry and
 * instances, so the main and shadow cameras cull whole chunks. Every chunk
 * shares the level's collision world, lamps, props and animation list.
 */
export interface CityCtx extends Ctx {
  inst: Instancer;
  /** Far scenery: no shadows, always drawn. */
  far: Builder;
}

/** The three chunks (left x > 22, centre, right x < -12) and the one a point belongs to. */
export interface City {
  L: CityCtx;
  C: CityCtx;
  R: CityCtx;
  at(x: number): CityCtx;
}

// ---------------------------------------------------------------------------
// faces: walls in the planes x = at or z = at, their outward normal n
// ---------------------------------------------------------------------------

/**
 * A wall plane: its origin (a = 0, w = 0 at y = 0), the unit along it (u) and
 * the outward normal (nv), both horizontal. Most walls are axis-aligned
 * (face()); a tangent plane of a drum is tangentFace().
 */
export interface Face {
  o: THREE.Vector3;
  u: THREE.Vector3;
  nv: THREE.Vector3;
  /** Increasing a runs to the viewer's left (texts must then be flipped, quads reversed). */
  flip: boolean;
}

function makeFace(o: THREE.Vector3, u: THREE.Vector3, nv: THREE.Vector3): Face {
  // the viewer's right is (-nv) x up
  const right = V(nv.z, 0, -nv.x);
  return { o, u, nv, flip: right.dot(u) < 0 };
}

/** The wall plane x = at or z = at, looking toward +/- that axis. */
export const face = (axis: 'x' | 'z', at: number, n: 1 | -1): Face => (axis === 'z' ? makeFace(V(0, 0, at), V(1, 0, 0), V(0, 0, n)) : makeFace(V(at, 0, 0), V(0, 0, 1), V(n, 0, 0)));

/** The plane touching a drum of radius r round (cx, cz) at angle t (a = 0 at the touching line). */
export const tangentFace = (cx: number, cz: number, r: number, t: number): Face =>
  makeFace(V(cx + Math.cos(t) * r, 0, cz + Math.sin(t) * r), V(-Math.sin(t), 0, Math.cos(t)), V(Math.cos(t), 0, Math.sin(t)));

/** World point of face-local a (along the wall), y (up), w (out of it). */
export function fp(f: Face, a: number, y: number, w: number) {
  return V(f.o.x + f.u.x * a + f.nv.x * w, y, f.o.z + f.u.z * a + f.nv.z * w);
}

const flipped = (f: Face) => f.flip;
const _bm = new THREE.Matrix4();

/** Box in face-local coordinates (axis-aligned walls give an axis-aligned box). */
export function fbox(b: Builder, key: string, f: Face, a0: number, a1: number, y0: number, y1: number, w0: number, w1: number, color: THREE.ColorRepresentation, uv = 1.2, o: BoxOpts = { ao: 0 }) {
  if (Math.abs(f.u.x) > 0.9999 || Math.abs(f.u.z) > 0.9999) {
    const p = fp(f, a0, y0, w0), q = fp(f, a1, y1, w1);
    b.box(key, p.x, p.y, p.z, q.x, q.y, q.z, color, uv, o);
    return;
  }
  // (a right-handed basis: x along the wall so that x cross up = the normal)
  const s = f.flip ? -1 : 1;
  const x = f.u.clone().multiplyScalar(s);
  const c = fp(f, (a0 + a1) / 2, (y0 + y1) / 2, (w0 + w1) / 2);
  _bm.makeBasis(x, V(0, 1, 0), f.nv).setPosition(c);
  b.obox(key, _bm, Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(w1 - w0), color, uv);
}

/**
 * Quad in the face at offset w, facing out. `uv`: a number = world metres per
 * repeat, or an atlas rect [u0, v0, u1, v1] (read left to right by the viewer).
 */
export function fquad(b: Builder, key: string, f: Face, a0: number, a1: number, y0: number, y1: number, w: number, color: THREE.ColorRepresentation, uv: number | readonly number[] = 2) {
  const P = [fp(f, a0, y0, w), fp(f, a1, y0, w), fp(f, a1, y1, w), fp(f, a0, y1, w)];
  let U: [number, number][];
  if (typeof uv === 'number') U = [[a0 / uv, y0 / uv], [a1 / uv, y0 / uv], [a1 / uv, y1 / uv], [a0 / uv, y1 / uv]];
  else {
    const [u0, v0, u1, v1] = flipped(f) ? [uv[2], uv[1], uv[0], uv[3]] : uv;
    U = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  }
  if (flipped(f)) b.quad(key, P[1], P[0], P[3], P[2], color, [U[1], U[0], U[3], U[2]]);
  else b.quad(key, P[0], P[1], P[2], P[3], color, U);
}

/** Quad with a colour per corner (bottom pair c0, top pair c1). */
function fquadc(b: Builder, key: string, f: Face, a0: number, a1: number, y0: number, y1: number, w: number, c0: THREE.Color, c1: THREE.Color) {
  const P = [fp(f, a0, y0, w), fp(f, a1, y0, w), fp(f, a1, y1, w), fp(f, a0, y1, w)];
  if (flipped(f)) b.quadc(key, [P[1], P[0], P[3], P[2]], [c0, c0, c1, c1]);
  else b.quadc(key, P, [c0, c0, c1, c1]);
}

/** A quad given in the face's right-handed order (counter-clockwise seen from outside when the face isn't flipped). */
export function fq(b: Builder, key: string, f: Face, p: THREE.Vector3[], color: THREE.ColorRepresentation) {
  // (reversed from the same first corner: a fan's triangle keeps its duplicate corner last, so its normal stays defined)
  if (f.flip) b.quad(key, p[0], p[3], p[2], p[1], color);
  else b.quad(key, p[0], p[1], p[2], p[3], color);
}

/** A flat strip of width `wd` from (a0, y0) to (a1, y1) on the face at offset w, facing out. */
export function fstrip(b: Builder, key: string, f: Face, a0: number, y0: number, a1: number, y1: number, wd: number, w: number, color: THREE.ColorRepresentation) {
  const len = Math.hypot(a1 - a0, y1 - y0) || 1;
  const pa = (-(y1 - y0) / len) * (wd / 2), py = ((a1 - a0) / len) * (wd / 2);
  fq(b, key, f, [fp(f, a0 - pa, y0 - py, w), fp(f, a1 - pa, y1 - py, w), fp(f, a1 + pa, y1 + py, w), fp(f, a0 + pa, y0 + py, w)], color);
}

/** A half-disc (arch head) of radius r centred at (a, y), a fan of n triangles facing out. */
export function fanArch(b: Builder, key: string, f: Face, a: number, y: number, r: number, w: number, color: THREE.ColorRepresentation, n: number) {
  const c = fp(f, a, y, w);
  for (let k = 0; k < n; k++) {
    const t0 = Math.PI * (k / n), t1 = Math.PI * ((k + 1) / n);
    const p0 = fp(f, a + Math.cos(t0) * r, y + Math.sin(t0) * r, w), p1 = fp(f, a + Math.cos(t1) * r, y + Math.sin(t1) * r, w);
    fq(b, key, f, [c, p0, p1, p1], color);
  }
}

/** The stone band round an arch head: front ring and the soffit, from radius r to r + t, depth d. */
export function archBand(b: Builder, key: string, f: Face, a: number, y: number, r: number, t: number, d: number, color: THREE.ColorRepresentation, n: number, w0 = 0, soffit = true) {
  const shade = new THREE.Color(color).multiplyScalar(0.8);
  for (let k = 0; k < n; k++) {
    const t0 = Math.PI * (k / n), t1 = Math.PI * ((k + 1) / n);
    const at = (tt: number, rr: number, w: number) => fp(f, a + Math.cos(tt) * rr, y + Math.sin(tt) * rr, w);
    const i0 = at(t0, r, d), i1 = at(t1, r, d), o0 = at(t0, r + t, d), o1 = at(t1, r + t, d);
    fq(b, key, f, [i0, o0, o1, i1], color);
    if (soffit) fq(b, key, f, [at(t1, r, w0), at(t0, r, w0), i0, i1], shade);
  }
}

/** Wall between an arch head and a line above it (the spandrels), from angle 0 to pi. */
export function spandrel(b: Builder, key: string, f: Face, a: number, y: number, r: number, top: number, w: number, color: THREE.ColorRepresentation, n: number) {
  for (let k = 0; k < n; k++) {
    const t0 = Math.PI * (k / n), t1 = Math.PI * ((k + 1) / n);
    const x0 = a + Math.cos(t0) * r, x1 = a + Math.cos(t1) * r;
    fq(b, key, f, [fp(f, x0, y + Math.sin(t0) * r, w), fp(f, x0, top, w), fp(f, x1, top, w), fp(f, x1, y + Math.sin(t1) * r, w)], color);
  }
}

// ---------------------------------------------------------------------------
// windows
// ---------------------------------------------------------------------------

/**
 * arch: an arched sash window; tall: a French window to a balcony; rect: a
 * square-headed one under a hood; small: attic; shop: a big arched café or
 * shop front; door: an arched door under a fan-light; slit: a deco strip
 * window (its height is given); blind: a stone panel where a window would be.
 */
export type WinKind = 'arch' | 'tall' | 'rect' | 'small' | 'shop' | 'door' | 'slit' | 'blind';
const WIN: Record<WinKind, { w: number; h: number; arch: boolean }> = {
  arch: { w: 1.5, h: 2.3, arch: true },
  tall: { w: 1.6, h: 3.0, arch: true },
  rect: { w: 1.4, h: 2.2, arch: false },
  small: { w: 1.2, h: 1.3, arch: false },
  shop: { w: 3.0, h: 2.5, arch: true },
  door: { w: 2.2, h: 2.6, arch: true },
  slit: { w: 0.9, h: 4, arch: false },
  blind: { w: 1.4, h: 2.2, arch: false },
};

export interface WinOpts {
  /** Lit (warm, glowing) or dark (reflects the sky). */
  lit: boolean;
  /** Glow strength (HDR); keep near fights at or below 1.2 so rifts stay the brightest thing. */
  glow?: number;
  mobile: boolean;
  /** Override the kind's size. */
  w?: number;
  h?: number;
  /** An iron balconette in front (tall windows). */
  balcony?: boolean;
  /** Red curtains drawn to the sides. */
  curtains?: boolean;
  /** Stone surround (off for a plain opening). */
  frame?: boolean;
  /** The wall surface sits this far out of the face (a rusticated layer). */
  w0?: number;
}

/** The same plane moved `w` out along its normal. */
export const shiftFace = (f: Face, w: number): Face => ({ ...f, o: V(f.o.x + f.nv.x * w, 0, f.o.z + f.nv.z * w) });

const _lit0 = new THREE.Color(), _lit1 = new THREE.Color();

/** One window centred at a along face f, its sill at y. Returns its top (for hoods, keystones). */
export function windowBay(b: Builder, f0: Face, kind: WinKind, a: number, y: number, o: WinOpts) {
  const f = o.w0 ? shiftFace(f0, o.w0) : f0;
  const spec = WIN[kind];
  const w = o.w ?? spec.w, rh = o.h ?? spec.h;
  const r = spec.arch ? w / 2 : 0;
  const hw = w / 2;
  const seg = o.mobile ? 5 : 8;
  const frame = o.frame !== false;
  if (kind === 'blind') {
    fbox(b, 'relief', f, a - hw, a + hw, y, y + rh, 0, 0.05, CITY.stoneShade, 1.2);
    fbox(b, 'relief', f, a - hw - 0.15, a + hw + 0.15, y - 0.14, y, 0, 0.14, CITY.trim);
    return y + rh;
  }
  // glass: a deep amber gradient when lit (bright low, where the lamps are, dark up in the room), sky-grey when dark
  // (same brightness as a cream sheet, more colour: ACES would wash a pale one out to paper)
  const key = o.lit ? 'emissive' : 'windark';
  if (o.lit) {
    const g = o.glow ?? 1.6;
    _lit0.setRGB(1.25 * g, 0.62 * g, 0.2 * g);
    _lit1.setRGB(0.6 * g, 0.27 * g, 0.08 * g);
  } else {
    // (metallic glass: the vertex colour is how much sky it mirrors)
    _lit0.setRGB(0.22, 0.27, 0.33);
    _lit1.setRGB(0.34, 0.41, 0.5);
  }
  const doorLeaf = kind === 'door';
  if (doorLeaf) {
    // panelled double doors under a glowing fan-light
    fbox(b, 'paint', f, a - hw, a + hw, y, y + rh, 0, 0.04, 0x3b2a20, 1);
    fbox(b, 'metal', f, a - 0.03, a + 0.03, y, y + rh, 0.03, 0.07, CITY.gilt, 1);
  } else fquadc(b, key, f, a - hw, a + hw, y, y + rh, 0.02, _lit0, _lit1);
  if (r > 0) fanArch(b, key, f, a, y + rh, r, 0.02, _lit1, seg);
  // a shop's canvas blind drawn over its top quarter: not one bright sheet
  if (o.lit && kind === 'shop') fquad(b, 'paint', f, a - hw, a + hw, y + rh * 0.75, y + rh, 0.026, 0x5a3424);
  if (o.lit && o.curtains && !doorLeaf) {
    const cw = w * 0.2;
    fquad(b, 'paint', f, a - hw, a - hw + cw, y + rh * 0.15, y + rh, 0.028, 0x7a1512);
    fquad(b, 'paint', f, a + hw - cw, a + hw, y + rh * 0.15, y + rh, 0.028, 0x7a1512);
  }
  // iron glazing bars: flat strips just proud of the glass
  const m = CITY.frame;
  const bar = (a0: number, a1: number, y0: number, y1: number) => fquad(b, 'metal', f, a0, a1, y0, y1, 0.035, m, 1);
  if (!o.mobile || kind === 'shop' || kind === 'tall') {
    if (!doorLeaf) bar(a - 0.03, a + 0.03, y, y + rh + r);
    if (spec.arch) bar(a - hw, a + hw, y + rh - 0.03, y + rh + 0.03);
    else if (kind !== 'small' && kind !== 'slit') bar(a - hw, a + hw, y + rh * 0.68, y + rh * 0.68 + 0.05);
    if (kind === 'slit') for (let yy = y + 1.2; yy < y + rh - 0.3; yy += 1.2) bar(a - hw, a + hw, yy, yy + 0.06);
    if (kind === 'shop' && !o.mobile) {
      for (const s of [-1, 1]) bar(a + s * hw * 0.5 - 0.025, a + s * hw * 0.5 + 0.025, y, y + rh);
      bar(a - hw, a + hw, y + rh * 0.45, y + rh * 0.45 + 0.05);
      // fan-light radials
      for (const t of [0.25, 0.75]) fstrip(b, 'metal', f, a, y + rh, a + Math.cos(Math.PI * t) * r, y + rh + Math.sin(Math.PI * t) * r, 0.05, 0.035, m);
    }
  }
  if (!frame) return y + rh + r;
  // stone surround: jambs, the arch band and its keystone (or a lintel and hood), the sill
  const fw = kind === 'shop' || kind === 'door' ? 0.3 : 0.18, d = 0.1;
  // (phones: the jambs are flat strips)
  if (o.mobile) {
    fquad(b, 'relief', f, a - hw - fw, a - hw, y - 0.02, y + rh, d, CITY.trim, 1.2);
    fquad(b, 'relief', f, a + hw, a + hw + fw, y - 0.02, y + rh, d, CITY.trim, 1.2);
  } else {
    fbox(b, 'relief', f, a - hw - fw, a - hw, y - 0.02, y + rh, 0, d, CITY.trim);
    fbox(b, 'relief', f, a + hw, a + hw + fw, y - 0.02, y + rh, 0, d, CITY.trim);
  }
  let top = y + rh;
  if (r > 0) {
    archBand(b, 'relief', f, a, y + rh, r, fw, d, CITY.trim, seg, 0, !o.mobile);
    if (!o.mobile) fbox(b, 'relief', f, a - 0.15, a + 0.15, y + rh + r - 0.04, y + rh + r + fw + 0.14, 0, d + 0.06, 0xeadcc2);
    top = y + rh + r + fw;
  } else {
    fbox(b, 'relief', f, a - hw - fw, a + hw + fw, y + rh, y + rh + fw, 0, d, CITY.trim);
    if (kind === 'rect') fbox(b, 'relief', f, a - hw - fw - 0.12, a + hw + fw + 0.12, y + rh + fw, y + rh + fw + 0.16, 0, d + 0.14, CITY.trim);
    top = y + rh + fw + 0.16;
  }
  if (kind !== 'door' && kind !== 'shop') fbox(b, 'relief', f, a - hw - fw - 0.1, a + hw + fw + 0.1, y - 0.14, y, 0, 0.18, CITY.trim);
  if (o.balcony) ironBalconette(b, f, a - hw - 0.35, a + hw + 0.35, y, 0.55);
  return top;
}

/** A shallow iron balconette: a stone slab on two consoles, railing front and sides. */
export function ironBalconette(b: Builder, f: Face, a0: number, a1: number, y: number, depth: number) {
  fbox(b, 'trim', f, a0, a1, y - 0.16, y, 0, depth, CITY.trim);
  for (const a of [a0 + 0.15, a1 - 0.3]) fbox(b, 'trim', f, a, a + 0.15, y - 0.5, y - 0.16, 0, depth * 0.7, CITY.trim);
  latticeQuad(b, fp(f, a0, y, depth), fp(f, a1, y, depth), 0.9);
  latticeQuad(b, fp(f, a0, y, 0), fp(f, a0, y, depth), 0.9);
  latticeQuad(b, fp(f, a1, y, 0), fp(f, a1, y, depth), 0.9);
}

// ---------------------------------------------------------------------------
// facades
// ---------------------------------------------------------------------------

export interface Floor {
  /** Sill height. */
  y: number;
  kind: WinKind;
  /** Chance a window is lit. */
  lit: number;
  balcony?: boolean;
  /** Window height override (slits). */
  h?: number;
  glow?: number;
  /** Chance of a window box of red geraniums under the sill. */
  flowers?: number;
}

export interface FacadeSpec {
  /** Bays (window centres) evenly across a0..a1 at about this spacing. */
  bay: number;
  floors: Floor[];
  /** Cornice line (the top of the wall). */
  top: number;
  /** Rusticated base from `ground` to `base`. */
  ground?: number;
  base?: number;
  /** String courses under these heights. */
  bands?: number[];
  /** No windows centred in these a-ranges (banners, doors). */
  skip?: [number, number][];
  pilasters?: boolean;
  seed: number;
  /** Keep a margin free at each end. */
  margin?: number;
  /** No cornice (a wall that runs on up). */
  noCornice?: boolean;
}

/** Windows, bands, pilasters, a rusticated base and the cornice on one wall face. */
export function facade(ctx: CityCtx, f: Face, a0: number, a1: number, s: FacadeSpec) {
  const b = ctx.mb;
  const r = rng(s.seed);
  const margin = s.margin ?? 1.2;
  const span = a1 - a0 - margin * 2;
  const n = Math.max(1, Math.round(span / s.bay));
  const step = span / n;
  const centres: number[] = [];
  for (let i = 0; i < n; i++) centres.push(a0 + margin + step * (i + 0.5));
  if (s.base !== undefined) {
    const g = s.ground ?? 0;
    fbox(b, 'stone', f, a0, a1, g, s.base, 0, 0.12, CITY.rustic, 3.6, { ao: 0.6 });
    fbox(b, 'trim', f, a0, a1, s.base, s.base + 0.22, 0, 0.18, CITY.trim);
  }
  for (const y of s.bands ?? []) fbox(b, 'trim', f, a0, a1, y - 0.28, y, 0, 0.14, CITY.trim);
  const skip = (a: number) => (s.skip ?? []).some(([p, q]) => a > p && a < q);
  for (const a of centres) {
    if (skip(a)) continue;
    for (const fl of s.floors) {
      const w0 = s.base !== undefined && fl.y < s.base ? 0.12 : 0;
      windowBay(b, f, fl.kind, a, fl.y, { lit: r() < fl.lit, glow: (fl.glow ?? 1.7) * (0.75 + r() * 0.4), mobile: ctx.mobile, balcony: fl.balcony, curtains: r() < 0.3, h: fl.h, w0 });
      if (fl.flowers && r() < fl.flowers) {
        // (on a balconette the geraniums stand on its floor, not in a box under it)
        if (fl.balcony) {
          const p = fp(f, a, fl.y + 0.02, 0.3);
          ctx.inst.add('flowers', p.x, p.y, p.z, Math.atan2(f.nv.x, f.nv.z), 0.75, 1.9);
        } else windowBox(ctx, f, a, fl.y);
      }
    }
  }
  if (s.pilasters) {
    const y0 = s.base !== undefined ? s.base + 0.22 : s.ground ?? 0;
    const y1 = s.top - 0.6;
    for (let i = 0; i <= n; i++) {
      const a = a0 + margin + step * i;
      if (skip(a)) continue;
      fbox(b, 'trim', f, a - 0.28, a + 0.28, y0, y1, 0, 0.14, CITY.trim);
      fbox(b, 'trim', f, a - 0.38, a + 0.38, y1 - 0.4, y1, 0, 0.22, CITY.trim);
    }
  }
  if (!s.noCornice) cornice(b, f, a0, a1, s.top);
}

/** A window box of geraniums on an iron bracket under the sill at (a, y). */
export function windowBox(ctx: CityCtx, f: Face, a: number, y: number) {
  fbox(ctx.mb, 'paint', f, a - 0.75, a + 0.75, y - 0.5, y - 0.2, 0.2, 0.55, 0x2c3a2a, 1);
  const p = fp(f, a, y - 0.22, 0.38);
  ctx.inst.add('flowers', p.x, p.y, p.z, Math.atan2(f.nv.x, f.nv.z), 0.75, 1.9);
}

/**
 * Festival string lights: warm bulbs on a sagging wire from p to q (visual;
 * dim, so the rifts stay the brightest thing).
 */
export function stringLights(b: Builder, p: THREE.Vector3, q: THREE.Vector3, sag: number, spacing = 0.9) {
  const n = Math.max(2, Math.round(p.distanceTo(q) / spacing));
  let prev = p;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const c = p.clone().lerp(q, t);
    c.y -= Math.sin(Math.PI * t) * sag;
    b.beam('metal', prev, c, 0.02, 0.02, CITY.iron, 1);
    if (k < n) b.box('emissive', c.x - 0.06, c.y - 0.16, c.z - 0.06, c.x + 0.06, c.y - 0.04, c.z + 0.06, BULB, 1, { ao: 0 });
    prev = c;
  }
}
const BULB = new THREE.Color(1.3, 0.85, 0.42);

/** Three stepped courses under a wall top (casts the long shadow line of the concept). */
export function cornice(b: Builder, f: Face, a0: number, a1: number, top: number, scale = 1) {
  const e = 0.5 * scale;
  fbox(b, 'trim', f, a0 - e, a1 + e, top - 0.7 * scale, top - 0.42 * scale, 0, 0.16 * scale, CITY.trim);
  fbox(b, 'trim', f, a0 - e, a1 + e, top - 0.42 * scale, top - 0.16 * scale, 0, 0.34 * scale, CITY.trim);
  fbox(b, 'trim', f, a0 - e, a1 + e, top - 0.16 * scale, top + 0.08 * scale, 0, 0.55 * scale, 0xeadcc2);
}

/** A banner on a gilt rod: `which` picks the atlas picture. */
export function bannerOn(b: Builder, f: Face, a: number, halfW: number, y0: number, y1: number, which: 'redBanner' | 'navyBanner' | 'flag', w = 0.08) {
  fquad(b, 'decal', f, a - halfW, a + halfW, y0, y1, w, 0xffffff, DECAL[which]);
  fbox(b, 'metal', f, a - halfW - 0.2, a + halfW + 0.2, y1, y1 + 0.1, w - 0.05, w + 0.05, CITY.gilt, 1);
  for (const s of [-1, 1]) fbox(b, 'metal', f, a + s * (halfW + 0.2) - 0.08, a + s * (halfW + 0.2) + 0.08, y1 - 0.06, y1 + 0.16, w - 0.08, w + 0.08, CITY.gilt, 1);
  fbox(b, 'metal', f, a - 0.05, a + 0.05, y1 + 0.1, y1 + 0.6, 0, w, CITY.iron, 1);
}

/** A sign plate from the atlas (row k of SIGNS). */
export function signOn(b: Builder, f: Face, a0: number, a1: number, y0: number, y1: number, k: number, w = 0.1) {
  fbox(b, 'trim', f, a0 - 0.12, a1 + 0.12, y0 - 0.12, y1 + 0.12, 0, w - 0.01, CITY.trim);
  fquad(b, 'decal', f, a0, a1, y0, y1, w, 0xffffff, DECAL.sign(k));
}

/** A striped café awning from the wall at height y, reaching `depth` out and `drop` down. */
export function awning(b: Builder, f: Face, a0: number, a1: number, y: number, depth: number, drop: number) {
  // solid festival red with a gilt fringe (the concept's; stripes read as candy at a distance)
  const c = 0xa8281f;
  const A = fp(f, a0, y, 0), B = fp(f, a1, y, 0), C = fp(f, a1, y - drop, depth), D = fp(f, a0, y - drop, depth);
  const Lo = fp(f, a0, y - drop - 0.3, depth), Ro = fp(f, a1, y - drop - 0.3, depth);
  const Lf = fp(f, a0, y - drop - 0.38, depth), Rf = fp(f, a1, y - drop - 0.38, depth);
  fq(b, 'paint', f, [D, C, B, A], c);
  fq(b, 'paint', f, [A, B, C, D], new THREE.Color(c).multiplyScalar(0.6));
  fq(b, 'paint', f, [Lo, Ro, C, D], c);
  fq(b, 'paint', f, [Lf, Rf, Ro, Lo], CITY.gilt);
  for (const a of [a0 + 0.1, a1 - 0.1]) b.beam('metal', fp(f, a, y - drop * 0.1 - 0.9, 0), fp(f, a, y - drop, depth), 0.04, 0.04, CITY.iron, 1);
}

// ---------------------------------------------------------------------------
// ground, stairs, rails
// ---------------------------------------------------------------------------

/** A walkable slab: stone sides (rusticated scale), a paved top (world UVs). */
export function slab(ctx: CityCtx, s: Slab, side: number = CITY.rustic, top: number = CITY.paving) {
  const { r } = s;
  // (a slab raised off the ground shows its underside: the café arcade's ceiling)
  solid(ctx, 'stone', r.x0, s.bottom, r.z0, r.x1, s.top, r.z1, side, 3.6, { tag: `ground:${s.id}` }, { skipTop: true, skipBottom: s.bottom < 0, ao: 0.4, under: 0.35 });
  ctx.mb.quad('paving', V(r.x0, s.top, r.z1), V(r.x1, s.top, r.z1), V(r.x1, s.top, r.z0), V(r.x0, s.top, r.z0), top, [
    [r.x0 / 2.4, r.z1 / 2.4],
    [r.x1 / 2.4, r.z1 / 2.4],
    [r.x1 / 2.4, r.z0 / 2.4],
    [r.x0 / 2.4, r.z0 / 2.4],
  ]);
}

/** A flat inlay on the ground (granite bands, rings): a hair above the paving. */
export function inlay(b: Builder, x0: number, z0: number, x1: number, z1: number, y: number, color: THREE.ColorRepresentation = CITY.granite) {
  b.quad('paint', V(x0, y + 0.004, z1), V(x1, y + 0.004, z1), V(x1, y + 0.004, z0), V(x0, y + 0.004, z0), color);
}

/**
 * Stone stair filling an exact footprint: `n` treads from `from` to `to` along
 * `along`, the first tread's top one rise past y0 and the last at y1, each a
 * solid block from `base` to its top (walked with step-up, like stairs()).
 * The cross axis spans w0..w1. Nosings catch the light.
 */
export function stoneStair(ctx: CityCtx, tag: string, along: 'x' | 'z', from: number, to: number, w0: number, w1: number, y0: number, y1: number, n: number, base: number, color: number = CITY.trim) {
  const run = (to - from) / n, rise = (y1 - y0) / n;
  const out: Collider[] = [];
  for (let k = 0; k < n; k++) {
    const a = from + run * k, b = from + run * (k + 1);
    const top = y0 + rise * (k + 1);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const tone = k % 2 ? color : new THREE.Color(color).multiplyScalar(0.97).getHex();
    if (along === 'x') out.push(solid(ctx, 'trim', lo, base, w0, hi, top, w1, tone, 1.2, { tag }, { ao: 0.25, aoH: Math.abs(rise) * 0.9, skipBottom: true }));
    else out.push(solid(ctx, 'trim', w0, base, lo, w1, top, hi, tone, 1.2, { tag }, { ao: 0.25, aoH: Math.abs(rise) * 0.9, skipBottom: true }));
    // a slim darker line under each nosing (reads as the shadowed riser top)
    // (the nosing faces down the flight: the side toward the lower tread)
    const nose = rise > 0 ? a : b;
    if (along === 'x') ctx.mb.box('relief', nose - 0.01, top - 0.05, w0, nose + 0.01, top - 0.02, w1, 0x9c8e74, 1, { ao: 0 });
    else ctx.mb.box('relief', w0, top - 0.05, nose - 0.01, w1, top - 0.02, nose + 0.01, 0x9c8e74, 1, { ao: 0 });
  }
  return out;
}

/** A railing panel between two points at floor height (alpha-cut iron from the atlas' top half). */
export function latticeQuad(b: Builder, p: THREE.Vector3, q: THREE.Vector3, h: number, half: 'rail' | 'baluster' = 'rail', y0 = 0) {
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  const u1 = len / 2;
  const [v0, v1] = half === 'rail' ? [0.5, 1] : [0, 0.5];
  b.quad('lattice', V(p.x, p.y + y0, p.z), V(q.x, q.y + y0, q.z), V(q.x, q.y + h, q.z), V(p.x, p.y + h, p.z), 0xffffff, [
    [0, v0],
    [u1, v0],
    [u1, v1],
    [0, v1],
  ]);
}

/** Stone newel (0.44 m square) with a brass cap: the mark of an edge. */
export function newel(b: Builder, x: number, z: number, y: number, h = 1.25) {
  b.box('trim', x - 0.22, y, z - 0.22, x + 0.22, y + h - 0.12, z + 0.22, CITY.trim, 1.2, { ao: 0.3 });
  b.box('metal', x - 0.26, y + h - 0.12, z - 0.26, x + 0.26, y + h, z + 0.26, CITY.brass, 1, { ao: 0 });
}

/** 1.1 m wrought-iron railing along an axis-aligned line at floor height y (see-through, refuses rifts). */
export function rail(ctx: CityCtx, x0: number, z0: number, x1: number, z1: number, y: number, h = 1.1, o: { newels?: boolean } = {}) {
  const t = 0.12;
  const b = ctx.mb;
  const alongX = Math.abs(z1 - z0) < 1e-6;
  const lo = alongX ? Math.min(x0, x1) : Math.min(z0, z1), hi = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const P = (a: number, yy: number) => (alongX ? V(a, yy, z0) : V(x0, yy, a));
  latticeQuad(b, P(lo, y), P(hi, y), h - 0.06);
  // a moulded top rail and a post every 2 m (stone newels at the ends of long runs)
  if (alongX) b.box('iron', lo, y + h - 0.07, z0 - 0.045, hi, y + h, z0 + 0.045, CITY.iron, 1, { ao: 0 });
  else b.box('iron', x0 - 0.045, y + h - 0.07, lo, x0 + 0.045, y + h, hi, CITY.iron, 1, { ao: 0 });
  const n = Math.max(1, Math.round((hi - lo) / (ctx.mobile ? 4 : 2)));
  for (let i = 0; i <= n; i++) {
    const a = lo + ((hi - lo) * i) / n;
    const p = P(a, y);
    b.box('iron', p.x - 0.035, y, p.z - 0.035, p.x + 0.035, y + h, p.z + 0.035, CITY.iron, 1, { ao: 0, skipBottom: true });
  }
  if (o.newels ?? hi - lo > 5) {
    const m = Math.max(1, Math.round((hi - lo) / 8));
    for (let i = 0; i <= m; i++) {
      const p = P(lo + ((hi - lo) * i) / m, y);
      newel(b, p.x, p.z, y);
    }
  }
  if (alongX) return col(ctx, lo, y, z0 - t / 2, hi, y + h, z0 + t / 2, { seeThrough: true, noPortal: true, tag: 'rail' });
  return col(ctx, x0 - t / 2, y, lo, x0 + t / 2, y + h, hi, { seeThrough: true, noPortal: true, tag: 'rail' });
}

/** A railing that follows a stair's pitch (visual): from (p) to (q), both at nosing height. */
export function slopedRail(b: Builder, p: THREE.Vector3, q: THREE.Vector3, h = 1.1) {
  latticeQuad(b, p, q, h - 0.06);
  b.beam('iron', V(p.x, p.y + h - 0.035, p.z), V(q.x, q.y + h - 0.035, q.z), 0.09, 0.07, CITY.iron, 1);
  b.beam('trim', V(p.x, p.y - 0.25, p.z), V(q.x, q.y - 0.25, q.z), 0.22, 0.5, CITY.trim, 1.2);
}

/** Stone balustrade (visual): plinth, balusters from the atlas, a moulded rail, newels every ~4 m. */
export function balustrade(b: Builder, x0: number, z0: number, x1: number, z1: number, y: number, h = 1.0, mobile = false) {
  const alongX = Math.abs(z1 - z0) < 1e-6;
  const lo = alongX ? Math.min(x0, x1) : Math.min(z0, z1), hi = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const box = (a0: number, a1: number, y0: number, y1: number, hw: number, c: number) => {
    if (alongX) b.box('trim', a0, y0, z0 - hw, a1, y1, z0 + hw, c, 1.2, { ao: 0 });
    else b.box('trim', x0 - hw, y0, a0, x0 + hw, y1, a1, c, 1.2, { ao: 0 });
  };
  box(lo, hi, y, y + 0.22, 0.2, CITY.trim);
  box(lo, hi, y + h - 0.14, y + h, 0.22, 0xeadcc2);
  if (mobile) box(lo, hi, y + 0.22, y + h - 0.14, 0.12, CITY.stoneShade);
  else latticeQuad(b, alongX ? V(lo, y, z0) : V(x0, y, lo), alongX ? V(hi, y, z0) : V(x0, y, hi), h - 0.14, 'baluster', 0.22);
  const m = Math.max(1, Math.round((hi - lo) / 4));
  for (let i = 0; i <= m; i++) {
    const a = lo + ((hi - lo) * i) / m;
    box(a - 0.2, a + 0.2, y, y + h + 0.08, 0.24, CITY.trim);
  }
}

/** A low solid stone parapet (easy to jump over; portals may not open on it). */
export function parapet(ctx: CityCtx, x0: number, z0: number, x1: number, z1: number, y: number, h: number) {
  const c = solid(ctx, 'trim', x0, y, z0, x1, y + h, z1, CITY.trim, 1.2, { tag: 'parapet', noPortal: true }, { ao: 0 });
  ctx.mb.box('metal', x0 - 0.02, y + h, z0 - 0.02, x1 + 0.02, y + h + 0.04, z1 + 0.02, CITY.brass, 1, { ao: 0 });
  return c;
}

/** Static cover block centred at (x, z) resting on y (collider + a plain mesh). */
export function cover(ctx: CityCtx, tag: string, x: number, z: number, sx: number, sz: number, h: number, y = 0, color: number = CITY.stoneShade, key = 'trim') {
  return solid(ctx, key, x - sx / 2, y, z - sz / 2, x + sx / 2, y + h, z + sz / 2, color, 1.2, { tag }, { ao: 0.5 });
}

/** Collider-only cover (its look is drawn by the caller). */
export function coverCol(ctx: CityCtx, tag: string, x: number, z: number, sx: number, sz: number, h: number, y = 0) {
  return col(ctx, x - sx / 2, y, z - sz / 2, x + sx / 2, y + h, z + sz / 2, { tag });
}

// ---------------------------------------------------------------------------
// street furniture
// ---------------------------------------------------------------------------

/** Ornate iron street lamp with a lantern (a LampDef lighting down). */
export function streetLamp(ctx: CityCtx, x: number, z: number, y: number, o: { h?: number; color?: number; range?: number; intensity?: number; collide?: boolean } = {}) {
  const h = o.h ?? 4.4;
  const I = ctx.inst;
  I.add('lampBase', x, y, z);
  I.add('lampShaft', x, y + 0.55, z, 0, h - 0.55 - 0.62);
  I.add('lampHead', x, y + h - 0.62, z);
  I.add('lampGlass', x, y + h - 0.62, z);
  if (o.collide !== false) col(ctx, x - 0.12, y, z - 0.12, x + 0.12, y + h, z + 0.12, { tag: 'pole', seeThrough: true, noPortal: true });
  ctx.lamps.push({ pos: V(x, y + h - 0.3, z), dir: V(0, -1, 0), color: o.color ?? 0xffc47a, range: o.range ?? 12, angle: 1.0, intensity: o.intensity ?? 0.55, kind: 'pole' });
}

/** A lantern hanging on a chain from `top` down to `y` (its glass centre about 0.65 below y). */
export function hangLantern(ctx: CityCtx, x: number, z: number, top: number, y: number, lamp?: { color?: number; range?: number; intensity?: number }) {
  const I = ctx.inst;
  if (top > y) I.add('chain', x, y, z, 0, top - y);
  I.add('lanternHang', x, y, z);
  I.add('lanternGlass', x, y, z);
  if (lamp) ctx.lamps.push({ pos: V(x, y - 0.6, z), dir: V(0, -1, 0), color: lamp.color ?? 0xffd8a8, range: lamp.range ?? 10, angle: 1.0, intensity: lamp.intensity ?? 0.6, kind: 'hang' });
}

const MAPLE = [0xffffff, 0xffc8a0, 0xffe0c8, 0xffb080];

/** A stone planter with a red maple or a green lime (the box is cover). */
export function planter(ctx: CityCtx, x: number, z: number, s: number, h: number, y: number, seed = 1) {
  const c = col(ctx, x - s / 2, y, z - s / 2, x + s / 2, y + h, z + s / 2, { tag: 'planter' });
  const b = ctx.mb;
  const hs = s / 2;
  b.box('trim', x - hs, y, z - hs, x + hs, y + h - 0.12, z + hs, CITY.trim, 1.2, { ao: 0.5, skipTop: true });
  b.box('trim', x - hs - 0.08, y + h - 0.14, z - hs - 0.08, x + hs + 0.08, y + h, z + hs + 0.08, 0xeadcc2, 1.2, { ao: 0 });
  b.box('paint', x - hs + 0.1, y + h - 0.2, z - hs + 0.1, x + hs - 0.1, y + h - 0.08, z + hs - 0.1, 0x3a2a1e, 1, { ao: 0 });
  const sc = s / 2.4;
  ctx.inst.add('treeTrunk', x, y + h - 0.1, z, seed * 1.7, 0.9 + sc * 0.2, 0.9 + sc * 0.2);
  // (mostly red maples, every third a green lime)
  if (seed % 3 === 2) ctx.inst.add('treeGreen', x, y + h - 0.1, z, seed * 2.3, 0.85 + sc * 0.25, 0.8 + sc * 0.3);
  else ctx.inst.add('treeCrown', x, y + h - 0.1, z, seed * 2.3, 0.85 + sc * 0.25, 0.8 + sc * 0.3, MAPLE[seed % MAPLE.length]);
  return c;
}

/** A park bench (collider: seat height) facing `yaw`. */
export function bench(ctx: CityCtx, x: number, z: number, y: number, yaw: number) {
  ctx.inst.add('benchWood', x, y, z, yaw);
  ctx.inst.add('benchIron', x, y, z, yaw);
  const along = Math.abs(Math.sin(yaw)) > 0.5;
  const hx = along ? 0.3 : 0.9, hz = along ? 0.9 : 0.3;
  return col(ctx, x - hx, y, z - hz, x + hx, y + 0.5, z + hz, { tag: 'bench' });
}

/** A gilt bollard (0.6 m): the mark of a deliberate throw edge. */
export function bollard(ctx: CityCtx, x: number, z: number, y: number) {
  ctx.inst.add('bollard', x, y, z);
}

/** A bistro table with chairs and, optionally, a striped parasol. */
export function cafeSet(ctx: CityCtx, x: number, z: number, y: number, o: { chairs?: number; parasol?: boolean; yaw?: number } = {}) {
  const I = ctx.inst;
  I.add('cafeTable', x, y, z);
  // (phones: tables and parasols, no chairs)
  const n = ctx.mobile ? 0 : o.chairs ?? 2, yaw = o.yaw ?? 0;
  for (let k = 0; k < n; k++) {
    const a = yaw + (k / n) * Math.PI * 2;
    I.add('chair', x + Math.sin(a) * 0.72, y, z + Math.cos(a) * 0.72, a + Math.PI);
  }
  if (o.parasol) I.add('parasol', x, y, z, yaw);
}

/**
 * A stack of oxblood and tan steamer trunks with brass corners; a thin orange
 * trim glows (never brighter than a rift). Not navy: a Kessler rifleman beside
 * one must stand out from it.
 */
export function trunks(ctx: CityCtx, x: number, z: number, sx: number, sz: number, h: number, y = 0, seed = 1) {
  const c = col(ctx, x - sx / 2, y, z - sz / 2, x + sx / 2, y + h, z + sz / 2, { tag: 'trunks' });
  const b = ctx.mb;
  const r = rng(seed * 31 + 7);
  let yy = y;
  const layers = h > 1.55 ? 3 : 2;
  for (let k = 0; k < layers; k++) {
    const th = k === layers - 1 ? y + h - yy : (h / layers) * (0.9 + r() * 0.2);
    const inset = k === 0 ? 0 : 0.04 + r() * 0.06;
    const x0 = x - sx / 2 + inset, x1 = x + sx / 2 - inset, z0 = z - sz / 2 + inset * 0.5, z1 = z + sz / 2 - inset * 0.5;
    const leather = k % 2 ? 0x5b2f22 : 0x7a4a2e;
    b.box('paint', x0, yy, z0, x1, yy + th - 0.01, z1, leather, 1, { ao: 0.2 });
    // brass corners and wooden slats, the glowing trim line
    if (!ctx.mobile) for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box('metal', cx - 0.05, yy, cz - 0.05, cx + 0.05, yy + th - 0.01, cz + 0.05, CITY.brass, 1, { ao: 0 });
    b.box('paint', x0 - 0.01, yy + th * 0.3, z0 - 0.01, x1 + 0.01, yy + th * 0.36, z1 + 0.01, 0x3a2518, 1, { ao: 0 });
    b.box('emissive', x0 - 0.012, yy + th * 0.62, z0 - 0.012, x1 + 0.012, yy + th * 0.64, z1 + 0.012, new THREE.Color(0.8, 0.35, 0.1), 1, { ao: 0 });
    yy += th;
  }
  return c;
}

/**
 * A leaf card from four corners (bottom-left, bottom-right, top-right, top-left
 * as seen from its front), an atlas rect, a normal per corner (a crown's cards
 * take the crown's outward normals, so both sides light alike). `twoSided`
 * adds the reversed winding (the material is front-sided).
 */
export function leafCard(b: Builder, p: THREE.Vector3[], n: THREE.Vector3[], uv: readonly number[], color: THREE.ColorRepresentation, twoSided: boolean, shade: (p: THREE.Vector3) => number = () => 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((q) => [q.x, q.y, q.z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n.flatMap((q) => [q.x, q.y, q.z]), 3));
  const [u0, v0, u1, v1] = uv;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setIndex(twoSided ? [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  b.geo('foliage', g, color, 1, (q) => shade(q));
  g.dispose();
}

/** Ivy spilling over an edge at height y and down the wall under it: alpha-cut trails along a line, a hair off the wall (visual). */
export function ivy(ctx: CityCtx, x0: number, z0: number, x1: number, z1: number, y: number, drop: number, out: THREE.Vector3, seed = 1) {
  if (ctx.mobile) return;
  const b = ctx.mb;
  const r = rng(seed * 13 + 5);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.1));
  // (the viewer's right, facing the wall)
  const right = V(-out.z, 0, out.x).multiplyScalar(-1);
  const nn = [out, out, out, out];
  for (let k = 0; k < n; k++) {
    if (r() < 0.25) continue;
    const t = (k + r() * 0.7) / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const d = drop * (0.35 + r() * 0.65);
    const w = 1.0 + r() * 0.8;
    const off = 0.05 + r() * 0.04;
    const c = V(x + out.x * off, 0, z + out.z * off);
    const top = y + 0.2 + r() * 0.15;
    const P = (s: number, yy: number) => V(c.x + right.x * s, yy, c.z + right.z * s);
    // (a strip of the atlas' ivy half about as wide as the card, at a random place along it)
    const u = r() * 0.7;
    const tint = new THREE.Color().setHSL(0.26 + r() * 0.05, 0.3, 0.8 + r() * 0.2);
    leafCard(b, [P(-w / 2, top - d), P(w / 2, top - d), P(w / 2, top), P(-w / 2, top)], nn, [u, LEAF.ivy[1], u + w * 0.12, LEAF.ivy[3]], tint, false);
  }
}

/** A round column with a square plinth and capital (visual; its collider is the caller's box). */
export function column(b: Builder, x: number, z: number, y0: number, y1: number, r: number, mobile: boolean) {
  const s = r + 0.06;
  b.box('trim', x - s, y0, z - s, x + s, y0 + 0.35, z + s, CITY.trim, 1.2, { ao: 0.4 });
  b.cylinder('trim', V(x, y0 + 0.35, z), V(x, y1 - 0.45, z), r * 0.86, CITY.trim, mobile ? 8 : 14, 1.2, false, r * 0.78);
  b.cylinder('trim', V(x, y1 - 0.45, z), V(x, y1 - 0.3, z), r * 0.95, 0xeadcc2, mobile ? 8 : 14, 1.2, false, r * 0.8);
  b.box('trim', x - s - 0.05, y1 - 0.3, z - s - 0.05, x + s + 0.05, y1, z + s + 0.05, 0xeadcc2, 1.2, { ao: 0 });
}

/**
 * A dome: a drum, a cap of `h` over radius r (copper, gilt or glass), ribs
 * (none on phones unless asked for), gilt ring bands, a lantern and a finial.
 */
export function dome(b: Builder, x: number, z: number, y: number, r: number, h: number, o: { key?: string; color?: number; ribs?: number; bands?: number; lantern?: number; mobile?: boolean; drum?: number } = {}) {
  const seg = o.mobile ? 12 : 24;
  const drum = o.drum ?? 0;
  if (drum > 0) {
    b.cylinder('trim', V(x, y, z), V(x, y + drum, z), r, CITY.trim, seg, 2, false);
    b.cylinder('trim', V(x, y + drum - 0.3, z), V(x, y + drum, z), r + 0.25, 0xeadcc2, seg, 2, true);
  }
  const y0 = y + drum;
  const cap = new THREE.SphereGeometry(r, seg, o.mobile ? 5 : 9, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1).translate(x, y0, z);
  b.geo(o.key ?? 'paint', cap, o.color ?? CITY.copper, 1, (p, n) => 0.7 + 0.3 * n.y);
  cap.dispose();
  const ribs = o.ribs ?? (o.mobile ? 0 : 8);
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2;
    let prev = V(x + Math.cos(a) * r * 1.01, y0, z + Math.sin(a) * r * 1.01);
    for (let i = 1; i <= 4; i++) {
      const t = (i / 4) * (Math.PI / 2) * 0.96;
      const p = V(x + Math.cos(a) * Math.cos(t) * r * 1.01, y0 + Math.sin(t) * h * 1.01, z + Math.sin(a) * Math.cos(t) * r * 1.01);
      b.beam('metal', prev, p, 0.14, 0.1, CITY.gilt, 1);
      prev = p;
    }
  }
  // (ring bands at even heights up the cap)
  const bands = o.bands ?? 0;
  for (let k = 1; k <= bands; k++) {
    const f = k / (bands + 1);
    const ring = new THREE.TorusGeometry(r * Math.sqrt(1 - f * f) * 1.01, 0.11, 4, seg * 2).rotateX(Math.PI / 2).translate(x, y0 + f * h, z);
    b.geo('metal', ring, CITY.gilt);
    ring.dispose();
  }
  const lr = o.lantern ?? r * 0.18;
  const top = y0 + h * 0.98;
  b.cylinder('trim', V(x, top, z), V(x, top + lr * 2, z), lr, CITY.trim, 8, 1, false);
  b.cylinder('metal', V(x, top + lr * 2, z), V(x, top + lr * 2.9, z), lr * 1.2, CITY.gilt, 8, 1, true, 0.05);
  b.cylinder('metal', V(x, top + lr * 2.9, z), V(x, top + lr * 4.4, z), 0.06, CITY.gilt, 6, 1, true, 0.01);
  return top + lr * 4.4;
}
