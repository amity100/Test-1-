import * as THREE from 'three';
import type { Collider } from '../collision';
import { Builder, CONT, Ctx, PALETTE, V, col, solid } from './kit';

type Dir = '+x' | '-x' | '+z' | '-z';

/**
 * Shipping container (static, in a stack). alongX: length runs along +X from x0.
 * Returns its collider (tag 'container').
 */
export function container(ctx: Ctx, x0: number, y0: number, z0: number, alongX: boolean, len: number, color: number, opts: { doors?: 0 | 1 | null; b?: Builder; collider?: boolean } = {}): Collider | null {
  const b = opts.b ?? ctx.mb;
  const W = CONT.W, H = CONT.H;
  const x1 = alongX ? x0 + len : x0 + W;
  const z1 = alongX ? z0 + W : z0 + len;
  const y1 = y0 + H;
  b.box('container', x0 + 0.02, y0, z0 + 0.02, x1 - 0.02, y1 - 0.02, z1 - 0.02, color, 2.4, { skipBottom: true, ao: y0 < 0.1 ? 1 : 0.5 });
  const dark = new THREE.Color(color).multiplyScalar(0.55).getHex();
  const p = 0.16;
  // corner posts + castings
  for (const cx of [x0, x1 - p]) for (const cz of [z0, z1 - p]) b.box('metal', cx, y0, cz, cx + p, y1, cz + p, dark, 2, { ao: 0.4 });
  // top & bottom side rails
  if (alongX) {
    for (const cz of [z0 - 0.01, z1 - 0.1]) {
      b.box('metal', x0, y1 - 0.14, cz, x1, y1, cz + 0.11, dark, 2, { ao: 0 });
      b.box('metal', x0, y0, cz, x1, y0 + 0.16, cz + 0.11, dark, 2, { ao: 0 });
    }
  } else {
    for (const cx of [x0 - 0.01, x1 - 0.1]) {
      b.box('metal', cx, y1 - 0.14, z0, cx + 0.11, y1, z1, dark, 2, { ao: 0 });
      b.box('metal', cx, y0, z0, cx + 0.11, y0 + 0.16, z1, dark, 2, { ao: 0 });
    }
  }
  // door end: locking bars
  const doors = opts.doors === undefined ? 1 : opts.doors;
  if (doors !== null && !ctx.mobile) {
    for (let k = 0; k < 4; k++) {
      const t = 0.35 + k * 0.58;
      if (alongX) {
        const x = doors ? x1 + 0.01 : x0 - 0.05;
        b.box('metal', x, y0 + 0.2, z0 + t, x + 0.04, y1 - 0.2, z0 + t + 0.05, 0x9aa0a6, 2, { ao: 0 });
      } else {
        const z = doors ? z1 + 0.01 : z0 - 0.05;
        b.box('metal', x0 + t, y0 + 0.2, z, x0 + t + 0.05, y1 - 0.2, z + 0.04, 0x9aa0a6, 2, { ao: 0 });
      }
    }
  }
  if (opts.collider === false) return null;
  return col(ctx, x0, y0, z0, x1, y1, z1, { tag: 'container' });
}

/**
 * Railing along an axis-aligned segment at floor height y: yellow tubes,
 * posts, toe board. Collider is see-through and refuses rifts.
 */
export function railing(ctx: Ctx, ax: number, az: number, bx: number, bz: number, y: number, opts: { h?: number; color?: number; collider?: boolean; b?: Builder; toe?: boolean } = {}) {
  const b = opts.b ?? ctx.mb;
  const h = opts.h ?? 1.1;
  const c = opts.color ?? PALETTE.crane;
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
  const alongX = x1 - x0 >= z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const t = 0.05;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (const hy of [h, h * 0.52]) {
    if (alongX) b.box('steel', x0, y + hy - t, cz - t, x1, y + hy, cz + t, c, 1, { ao: 0 });
    else b.box('steel', cx - t, y + hy - t, z0, cx + t, y + hy, z1, c, 1, { ao: 0 });
  }
  const n = Math.max(1, Math.round(len / 1.8));
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const px = alongX ? x0 + (x1 - x0) * s : cx, pz = alongX ? cz : z0 + (z1 - z0) * s;
    b.box('steel', px - 0.04, y, pz - 0.04, px + 0.04, y + h, pz + 0.04, c, 1, { ao: 0.3 });
  }
  if (opts.toe !== false) {
    if (alongX) b.box('hazard', x0, y, cz - 0.02, x1, y + 0.15, cz + 0.02, 0xffffff, 1, { ao: 0 });
    else b.box('hazard', cx - 0.02, y, z0, cx + 0.02, y + 0.15, z1, 0xffffff, 1, { ao: 0 });
  }
  if (opts.collider === false) return null;
  const pad = 0.08;
  return col(ctx, alongX ? x0 : cx - pad, y, alongX ? cz - pad : z0, alongX ? x1 : cx + pad, y + h, alongX ? cz + pad : z1, { seeThrough: true, noPortal: true, tag: 'rail' });
}

/**
 * Straight open steel stair from (x, z) at y0 up to y1, climbing in `dir`.
 * Each step is a solid collider from y0 (enemies/players walk it with step-up).
 * Returns the footprint [x0, z0, x1, z1] (for cutting the slab above).
 */
export function stairs(ctx: Ctx, x: number, z: number, y0: number, y1: number, dir: Dir, width = 1.5, b: Builder = ctx.mb) {
  const n = Math.ceil((y1 - y0) / 0.38);
  const rise = (y1 - y0) / n;
  const run = 0.42;
  const sx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0;
  const sz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
  const alongX = sx !== 0;
  const L = n * run;
  const fx0 = alongX ? (sx > 0 ? x : x - L) : x - width / 2;
  const fx1 = alongX ? (sx > 0 ? x + L : x) : x + width / 2;
  const fz0 = alongX ? z - width / 2 : sz > 0 ? z : z - L;
  const fz1 = alongX ? z + width / 2 : sz > 0 ? z + L : z;
  for (let k = 0; k < n; k++) {
    const a = k * run, c = (k + 1) * run;
    const top = y0 + rise * (k + 1);
    let x0: number, x1: number, z0: number, z1: number;
    if (alongX) {
      x0 = sx > 0 ? x + a : x - c;
      x1 = sx > 0 ? x + c : x - a;
      z0 = z - width / 2;
      z1 = z + width / 2;
    } else {
      z0 = sz > 0 ? z + a : z - c;
      z1 = sz > 0 ? z + c : z - a;
      x0 = x - width / 2;
      x1 = x + width / 2;
    }
    col(ctx, x0, y0, z0, x1, top, z1, { tag: 'stair' });
    // tread (grating) + nosing
    b.box('metal', x0, top - 0.06, z0, x1, top, z1, 0x6d7278, 1, { ao: 0 });
    if (alongX) b.box('hazard', sx > 0 ? x1 - 0.06 : x0, top - 0.06, z0, sx > 0 ? x1 : x0 + 0.06, top + 0.005, z1, 0xffffff, 0.5, { ao: 0 });
    else b.box('hazard', x0, top - 0.06, sz > 0 ? z1 - 0.06 : z0, x1, top + 0.005, sz > 0 ? z1 : z0 + 0.06, 0xffffff, 0.5, { ao: 0 });
  }
  // stringers + handrails
  const s0 = V(alongX ? x : x, y0, alongX ? z : z);
  for (const side of [-1, 1]) {
    const off = (width / 2 + 0.05) * side;
    const a = alongX ? V(x, y0 - 0.1, z + off) : V(x + off, y0 - 0.1, z);
    const e = alongX ? V(x + sx * L, y1 - 0.1, z + off) : V(x + off, y1 - 0.1, z + sz * L);
    b.beam('steel', a, e, 0.1, 0.3, PALETTE.orange, 1);
    const ha = a.clone().add(V(0, 1.1, 0)), he = e.clone().add(V(0, 1.1, 0));
    b.beam('steel', ha, he, 0.06, 0.06, PALETTE.crane, 1);
    for (let k = 0; k <= 3; k++) {
      const p = a.clone().lerp(e, k / 3);
      b.box('steel', p.x - 0.03, p.y, p.z - 0.03, p.x + 0.03, p.y + 1.1, p.z + 0.03, PALETTE.crane, 1, { ao: 0 });
    }
  }
  void s0;
  return { x0: fx0, z0: fz0, x1: fx1, z1: fz1, top: y1 };
}

export interface ScaffoldOpts {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Ground / base level. */
  y0: number;
  /** Deck heights above y0. */
  levels: number[];
  /** Side of the climbing bay (landings at level - 2). */
  bay: Dir;
  bayW?: number;
  /** Outer sides that get guard rails + netting. */
  outer: Dir[];
  net?: boolean;
  shell?: boolean;
}

/**
 * Scaffold tower with deck levels and a climbing bay of half-landings (every
 * step is 2 m: always within a mantle). Decks are colliders you can stand on;
 * guard rails are see-through, no-rift colliders on the outer sides.
 */
export function scaffold(ctx: Ctx, o: ScaffoldOpts) {
  const b = o.shell ? ctx.shell : ctx.mb;
  const bw = o.bayW ?? 2.2;
  const { x0, x1, z0, z1, y0 } = o;
  // bay rectangle
  let bx0 = x0, bx1 = x1, bz0 = z0, bz1 = z1;
  if (o.bay === '+x') (bx0 = x1), (bx1 = x1 + bw);
  if (o.bay === '-x') (bx0 = x0 - bw), (bx1 = x0);
  if (o.bay === '+z') (bz0 = z1), (bz1 = z1 + bw);
  if (o.bay === '-z') (bz0 = z0 - bw), (bz1 = z0);
  // keep the bay short along the tower (a 2.4 m landing)
  if (o.bay === '+x' || o.bay === '-x') bz1 = Math.min(bz1, bz0 + 2.6);
  else bx1 = Math.min(bx1, bx0 + 2.6);
  const deckC = 0xcaa878;
  const top = y0 + Math.max(...o.levels);
  for (const L of o.levels) {
    const y = y0 + L;
    col(ctx, x0, y - 0.12, z0, x1, y, z1, { tag: 'scaffold' });
    b.box('wood', x0, y - 0.12, z0, x1, y, z1, deckC, 2.4, { ao: 0, uvRotate: true });
    // landing half a level below, in the bay
    const ly = y - 2;
    col(ctx, bx0, ly - 0.12, bz0, bx1, ly, bz1, { tag: 'scaffold' });
    b.box('wood', bx0, ly - 0.12, bz0, bx1, ly, bz1, deckC, 2.4, { ao: 0 });
    // toe boards on outer sides
    for (const side of o.outer) {
      if (side === '+x') b.box('wood', x1 - 0.03, y, z0, x1, y + 0.15, z1, 0xe8c040, 2, { ao: 0 });
      if (side === '-x') b.box('wood', x0, y, z0, x0 + 0.03, y + 0.15, z1, 0xe8c040, 2, { ao: 0 });
      if (side === '+z') b.box('wood', x0, y, z1 - 0.03, x1, y + 0.15, z1, 0xe8c040, 2, { ao: 0 });
      if (side === '-z') b.box('wood', x0, y, z0, x1, y + 0.15, z0 + 0.03, 0xe8c040, 2, { ao: 0 });
    }
    // guard rails (visual tubes + one see-through collider per side)
    for (const side of o.outer) {
      const [ax, az, ex, ez] = side === '+x' ? [x1, z0, x1, z1] : side === '-x' ? [x0, z0, x0, z1] : side === '+z' ? [x0, z1, x1, z1] : [x0, z0, x1, z0];
      for (const hy of [0.5, 1.0]) b.beam('metal', V(ax, y + hy, az), V(ex, y + hy, ez), 0.05, 0.05, PALETTE.galv, 1);
      const pad = 0.06;
      col(ctx, Math.min(ax, ex) - pad, y, Math.min(az, ez) - pad, Math.max(ax, ex) + pad, y + 1.05, Math.max(az, ez) + pad, { seeThrough: true, noPortal: true, tag: 'rail' });
    }
  }
  // standards (vertical tubes) on a ~2.4 m grid, including the bay
  const tube = (x: number, z: number) => {
    if (ctx.mobile) b.box('metal', x - 0.03, y0, z - 0.03, x + 0.03, top + 1.1, z + 0.03, PALETTE.galv, 1, { ao: 0 });
    else b.cylinder('metal', V(x, y0, z), V(x, top + 1.1, z), 0.03, PALETTE.galv, 6, 1, false);
  };
  const xs = spread(Math.min(x0, bx0), Math.max(x1, bx1), 2.5);
  const zs = spread(Math.min(z0, bz0), Math.max(z1, bz1), 2.5);
  for (const x of xs) for (const z of zs) {
    const inMain = x >= x0 - 0.01 && x <= x1 + 0.01 && z >= z0 - 0.01 && z <= z1 + 0.01;
    const inBay = x >= bx0 - 0.01 && x <= bx1 + 0.01 && z >= bz0 - 0.01 && z <= bz1 + 0.01;
    const edge = x === xs[0] || x === xs[xs.length - 1] || z === zs[0] || z === zs[zs.length - 1];
    if ((inMain || inBay) && edge) tube(x, z);
  }
  // base plates
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    b.box('metal', x - 0.15, y0, z - 0.15, x + 0.15, y0 + 0.03, z + 0.15, 0x555a60, 1, { ao: 0 });
    col(ctx, x - 0.06, y0, z - 0.06, x + 0.06, top + 1.1, z + 0.06, { seeThrough: true, noPortal: true, tag: 'scaffold' });
  }
  // ledgers + diagonal braces on the outer faces
  const lvls = [0, ...o.levels];
  for (const side of o.outer) {
    const [ax, az, ex, ez] = side === '+x' ? [x1, z0, x1, z1] : side === '-x' ? [x0, z0, x0, z1] : side === '+z' ? [x0, z1, x1, z1] : [x0, z0, x1, z0];
    for (let i = 0; i < lvls.length - 1; i++) {
      const ya = y0 + lvls[i] + 0.2, yb = y0 + lvls[i + 1] - 0.1;
      b.beam('metal', V(ax, ya, az), V(ex, yb, ez), 0.045, 0.045, PALETTE.galv, 1);
    }
    if (o.net && !ctx.headless) {
      const off = side === '+x' ? 0.12 : side === '-x' ? -0.12 : 0;
      const offz = side === '+z' ? 0.12 : side === '-z' ? -0.12 : 0;
      const len = Math.hypot(ex - ax, ez - az);
      const hgt = top + 1.1 - y0;
      b.quad('net', V(ax + off, y0 + 1.5, az + offz), V(ex + off, y0 + 1.5, ez + offz), V(ex + off, y0 + hgt, ez + offz), V(ax + off, y0 + hgt, az + offz), 0xffffff, [
        [0, 0],
        [len / 1.6, 0],
        [len / 1.6, (hgt - 1.5) / 1.6],
        [0, (hgt - 1.5) / 1.6],
      ]);
    }
  }
  return { bay: { x0: bx0, x1: bx1, z0: bz0, z1: bz1 }, top };
}

function spread(a: number, b: number, step: number) {
  const n = Math.max(1, Math.round((b - a) / step));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/** Concrete jersey barrier (cover). */
export function jersey(ctx: Ctx, x: number, z: number, alongX: boolean, len = 3, y = 0) {
  const w = 0.6, h = 0.85;
  const [x0, x1, z0, z1] = alongX ? [x - len / 2, x + len / 2, z - w / 2, z + w / 2] : [x - w / 2, x + w / 2, z - len / 2, z + len / 2];
  const c = col(ctx, x0, y, z0, x1, y + h, z1, { tag: 'barrier' });
  const b = ctx.mb;
  // tapered profile: wide base, narrow top
  b.box('concrete', x0, y, z0, x1, y + 0.3, z1, 0xd6d0c4, 1.5, { skipBottom: true });
  const i = 0.14;
  b.box('concrete', alongX ? x0 : x0 + i, y + 0.3, alongX ? z0 + i : z0, alongX ? x1 : x1 - i, y + h, alongX ? z1 - i : z1, 0xd6d0c4, 1.5, { ao: 0.3 });
  b.box('hazard', alongX ? x0 : x0 + i - 0.01, y + 0.5, alongX ? z0 + i - 0.01 : z0, alongX ? x1 : x1 - i + 0.01, y + 0.68, alongX ? z1 - i + 0.01 : z1, 0xffffff, 1, { ao: 0 });
  return c;
}

/** Static wooden crate / pallet stack. */
export function crateStatic(ctx: Ctx, x: number, z: number, s = 1.3, h = 1.2, y = 0, tint = 0xffffff) {
  const c = col(ctx, x - s / 2, y, z - s / 2, x + s / 2, y + h, z + s / 2, { tag: 'crate' });
  const b = ctx.mb;
  b.box('wood', x - s / 2 + 0.04, y, z - s / 2 + 0.04, x + s / 2 - 0.04, y + h - 0.02, z + s / 2 - 0.04, tint, 1.2, { skipBottom: true });
  const f = 0.09;
  const dk = new THREE.Color(tint).multiplyScalar(0.72).getHex();
  // frame edges
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = x + (ax * s) / 2, pz = z + (az * s) / 2;
    b.box('wood', px - f / 2 * (ax > 0 ? 2 : 0), y, pz - f / 2 * (az > 0 ? 2 : 0), px + f / 2 * (ax < 0 ? 2 : 0), y + h, pz + f / 2 * (az < 0 ? 2 : 0), dk, 1.2, { ao: 0.5 });
  }
  b.box('wood', x - s / 2, y + h - f, z - s / 2, x + s / 2, y + h, z + s / 2, dk, 1.2, { ao: 0 });
  b.box('wood', x - s / 2, y, z - s / 2, x + s / 2, y + f, z + s / 2, dk, 1.2, { ao: 0 });
  return c;
}

/** Bollard (mooring post). */
export function bollard(ctx: Ctx, x: number, z: number, y = 0) {
  const b = ctx.mb;
  if (ctx.mobile) b.box('metal', x - 0.2, y, z - 0.2, x + 0.2, y + 0.55, z + 0.2, 0x1e2126, 1);
  else {
    b.cylinder('metal', V(x, y, z), V(x, y + 0.5, z), 0.2, 0x1e2126, 10, 1, true, 0.17);
    b.cylinder('metal', V(x, y + 0.5, z), V(x, y + 0.6, z), 0.26, 0x1e2126, 10, 1, true);
  }
  col(ctx, x - 0.22, y, z - 0.22, x + 0.22, y + 0.4, z + 0.22, { tag: 'bollard' });
}

/** Floodlight mast with a LampDef aimed at `aim`. */
export function lampPole(ctx: Ctx, x: number, z: number, h: number, aim: THREE.Vector3, color = 0xffc98a, range = 24, intensity = 0.9, y = 0) {
  const b = ctx.mb;
  b.box('metal', x - 0.12, y, z - 0.12, x + 0.12, y + h, z + 0.12, 0x4a4f55, 1, { ao: 0.5 });
  b.box('concrete', x - 0.4, y, z - 0.4, x + 0.4, y + 0.35, z + 0.4, 0xbab4a8, 1);
  const head = V(x, y + h, z);
  const dir = aim.clone().sub(head).normalize();
  // fixture: a flat box turned to the aim direction
  const m = new THREE.Matrix4().lookAt(head, head.clone().add(dir), V(0, 1, 0)).setPosition(head.clone().addScaledVector(dir, 0.1));
  b.obox('metal', m, 0.9, 0.55, 0.25, 0x2b2f34, 1);
  b.box('metal', x - 0.5, y + h - 0.15, z - 0.05, x + 0.5, y + h - 0.05, z + 0.05, 0x2b2f34, 1, { ao: 0 });
  col(ctx, x - 0.15, y, z - 0.15, x + 0.15, y + h, z + 0.15, { tag: 'pole', seeThrough: true, noPortal: true });
  ctx.lamps.push({ pos: head.clone().addScaledVector(dir, 0.3), dir, color, range, angle: 0.7, intensity, kind: 'pole' });
}

/** Portable site cabin (office container) with a window strip and door. */
export function cabin(ctx: Ctx, x0: number, y0: number, z0: number, alongX: boolean, len = 6, color = 0xe9e6de): Collider {
  const W = 2.5, H = 2.7;
  const x1 = alongX ? x0 + len : x0 + W, z1 = alongX ? z0 + W : z0 + len;
  const b = ctx.mb;
  const c = col(ctx, x0, y0, z0, x1, y0 + H, z1, { tag: 'cabin' });
  b.box('container', x0, y0 + 0.1, z0, x1, y0 + H, z1, color, 2.4, { skipBottom: true, ao: y0 < 0.1 ? 1 : 0.4 });
  // frame
  const fr = 0x2d3237;
  b.box('metal', x0 - 0.03, y0 + H - 0.18, z0 - 0.03, x1 + 0.03, y0 + H, z1 + 0.03, fr, 2, { ao: 0 });
  b.box('metal', x0 - 0.03, y0, z0 - 0.03, x1 + 0.03, y0 + 0.18, z1 + 0.03, fr, 2, { ao: 0 });
  // windows on the long sides
  const wy0 = y0 + 1.1, wy1 = y0 + 2.0;
  const n = Math.max(1, Math.floor(len / 2.2));
  for (let i = 0; i < n; i++) {
    const a = (len / n) * (i + 0.2), e = (len / n) * (i + 0.8);
    if (alongX) {
      b.box('facade', x0 + a, wy0, z0 - 0.04, x0 + e, wy1, z0 + 0.02, 0xa0b4c8, 6, { ao: 0 });
      b.box('facade', x0 + a, wy0, z1 - 0.02, x0 + e, wy1, z1 + 0.04, 0xa0b4c8, 6, { ao: 0 });
    } else {
      b.box('facade', x0 - 0.04, wy0, z0 + a, x0 + 0.02, wy1, z0 + e, 0xa0b4c8, 6, { ao: 0 });
      b.box('facade', x1 - 0.02, wy0, z0 + a, x1 + 0.04, wy1, z0 + e, 0xa0b4c8, 6, { ao: 0 });
    }
  }
  // door on the +end
  if (alongX) b.box('metal', x1 - 0.02, y0 + 0.2, z0 + 0.7, x1 + 0.04, y0 + 2.2, z0 + 1.6, 0x5a6470, 1, { ao: 0 });
  else b.box('metal', x0 + 0.7, y0 + 0.2, z1 - 0.02, x0 + 1.6, y0 + 2.2, z1 + 0.04, 0x5a6470, 1, { ao: 0 });
  return c;
}

/** Hoarding (site fence panels, 3 m) along an axis-aligned line; solid collider. */
export function hoarding(ctx: Ctx, ax: number, az: number, bx: number, bz: number, h = 3, color = PALETTE.hoarding) {
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
  const alongX = x1 - x0 >= z1 - z0;
  const t = 0.08;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const b = ctx.mb;
  if (alongX) {
    b.box('wood', x0, 0, cz - t, x1, h, cz + t, color, 2.4, { skipBottom: true });
    b.box('hazard', x0, h - 0.25, cz - t - 0.01, x1, h - 0.05, cz + t + 0.01, 0xffffff, 1, { ao: 0 });
  } else {
    b.box('wood', cx - t, 0, z0, cx + t, h, z1, color, 2.4, { skipBottom: true });
    b.box('hazard', cx - t - 0.01, h - 0.25, z0, cx + t + 0.01, h - 0.05, z1, 0xffffff, 1, { ao: 0 });
  }
  const len = alongX ? x1 - x0 : z1 - z0;
  const n = Math.max(1, Math.round(len / 2.4));
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const px = alongX ? x0 + (x1 - x0) * s : cx, pz = alongX ? cz : z0 + (z1 - z0) * s;
    b.box('metal', px - 0.06, 0, pz - 0.06, px + 0.06, h + 0.05, pz + 0.06, 0x3a3f45, 1, { ao: 0.4 });
    // ballast block feet
    if (!ctx.mobile) b.box('concrete', px - (alongX ? 0.2 : 0.45), 0, pz - (alongX ? 0.45 : 0.2), px + (alongX ? 0.2 : 0.45), 0.2, pz + (alongX ? 0.45 : 0.2), 0xb8b0a4, 1);
  }
  return col(ctx, alongX ? x0 : cx - t, 0, alongX ? cz - t : z0, alongX ? x1 : cx + t, h, alongX ? cz + t : z1, { tag: 'hoarding' });
}

/** Tall lattice (4 chords + zig-zag bracing), from y0 to y1, square side s centred on (x, z). */
export function lattice(b: Builder, x: number, z: number, y0: number, y1: number, s: number, color: number, chord = 0.16, brace = 0.07, step = 2.2) {
  const h = s / 2;
  const corners: [number, number][] = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (const [cx, cz] of corners) b.box('steel', x + cx - chord / 2, y0, z + cz - chord / 2, x + cx + chord / 2, y1, z + cz + chord / 2, color, 1.5, { ao: 0 });
  const n = Math.max(1, Math.round((y1 - y0) / step));
  const dy = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const ya = y0 + i * dy, yb = ya + dy;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k];
      const [bx, bz] = corners[(k + 1) % 4];
      const flip = (i + k) % 2 === 0;
      b.beam('steel', V(x + ax, flip ? ya : yb, z + az), V(x + bx, flip ? yb : ya, z + bz), brace, brace, color, 1);
      b.beam('steel', V(x + ax, ya, z + az), V(x + bx, ya, z + bz), brace, brace, color, 1);
    }
  }
}

/** Horizontal triangular lattice girder from a to b (crane jibs). */
export function girder(b: Builder, a: THREE.Vector3, e: THREE.Vector3, w: number, h: number, color: number, chord = 0.14, brace = 0.06, step = 2.0) {
  const d = new THREE.Vector3().subVectors(e, a);
  const len = d.length();
  const f = d.clone().normalize();
  let side = new THREE.Vector3().crossVectors(V(0, 1, 0), f);
  if (side.lengthSq() < 1e-6) side = V(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(f, side).normalize();
  const L = side.clone().multiplyScalar(w / 2), U = up.clone().multiplyScalar(h);
  const b0 = [a.clone().add(L), a.clone().sub(L), a.clone().add(U)];
  const b1 = [e.clone().add(L), e.clone().sub(L), e.clone().add(U)];
  for (let k = 0; k < 3; k++) b.beam('steel', b0[k], b1[k], chord, chord, color, 1.5);
  const n = Math.max(1, Math.round(len / step));
  for (let i = 0; i < n; i++) {
    const p0 = b0.map((p, k) => p.clone().lerp(b1[k], i / n));
    const p1 = b0.map((p, k) => p.clone().lerp(b1[k], (i + 1) / n));
    b.beam('steel', p0[0], p0[1], brace, brace, color, 1);
    b.beam('steel', p0[0], p1[2], brace, brace, color, 1);
    b.beam('steel', p0[1], p1[2], brace, brace, color, 1);
    b.beam('steel', p1[2], p1[0], brace, brace, color, 1);
  }
}
