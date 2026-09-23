import * as THREE from 'three';
import * as TX from '../textures';
import { Builder, Ctx, PALETTE, V, col, rng } from './kit';
import { girder, lattice } from './parts';
import {
  CORE,
  CRANE,
  GRID_X,
  GRID_Z,
  HOIST,
  LAB_CEIL,
  LAB_Y,
  LOBBY_CEIL,
  PODIUM_TOP,
  R,
  ROOF_Y,
  Rect,
  SKELETON_FLOORS,
  SLAB,
  TOWER,
  CLIMBS,
  STAIRS,
  inRect,
  rectsOverlap,
  slabHoles,
  subtractRects,
} from './layout';

const T = TOWER;

/** Openings in the lab's glass skin. */
export const LAB_OPENINGS = {
  south: [[-5.3, -1.8]] as [number, number][], // hoist B door (x range)
  north: [[8, 12]] as [number, number][], // glass lift door
  west: [[28, 34]] as [number, number][], // open bay to the void (z range)
  east: [[28, 34]] as [number, number][],
};

/**
 * The tower itself plus the big landmarks (hoist mast, tower crane, harbour
 * crane). Meshes go to the shell builder (never hidden); colliders to the world.
 */
export function buildStructure(ctx: Ctx) {
  const b = ctx.shell;
  podium(ctx, b);
  skeleton(ctx, b);
  labBand(ctx, b);
  upperBlock(ctx, b);
  hoistMast(ctx, b);
  towerCrane(ctx, b);
  harbourCrane(ctx, b);
}

// ---------------------------------------------------------------------------
// Podium: open lobby (0 - 5.7) + glazed block to the podium roof (24)
// ---------------------------------------------------------------------------
function podium(ctx: Ctx, b: Builder) {
  // lobby columns
  for (const x of GRID_X) for (const z of GRID_Z) {
    if (inRect(CORE, x, z, 0.4)) continue;
    const s = 0.35;
    col(ctx, x - s, 0, z - s, x + s, LOBBY_CEIL, z + s, { tag: 'column' });
    b.box('concrete', x - s, 0, z - s, x + s, LOBBY_CEIL, z + s, PALETTE.concrete, 2, { skipBottom: true, skipTop: true });
  }
  // core with lift doors on the south face
  col(ctx, CORE.x0, 0, CORE.z0, CORE.x1, LOBBY_CEIL, CORE.z1, { tag: 'core' });
  b.box('concrete', CORE.x0, 0, CORE.z0, CORE.x1, LOBBY_CEIL, CORE.z1, 0xbdb6aa, 2.5, { skipBottom: true, skipTop: true });
  for (const x of [-3, 0.4]) b.box('metal', x, 0, CORE.z0 - 0.04, x + 2.2, 2.6, CORE.z0 + 0.02, 0xa8b0b8, 1, { ao: 0.3 });
  // the podium block
  col(ctx, T.x0, LOBBY_CEIL, T.z0, T.x1, PODIUM_TOP, T.z1, { tag: 'podium' });
  // lobby ceiling slab with a proud edge band
  b.box('concrete', T.x0 - 0.25, LOBBY_CEIL, T.z0 - 0.25, T.x1 + 0.25, 6.3, T.z1 + 0.25, 0xd4cec2, 2, { ao: 0, under: 0.35 });
  // glazed facade 6.3 - 24 with slab bands
  facadeWalls(b, T, 6.3, PODIUM_TOP - 0.3, 0.02);
  for (const y of [12, 18]) b.box('concrete', T.x0 - 0.2, y - 0.2, T.z0 - 0.2, T.x1 + 0.2, y + 0.2, T.z1 + 0.2, 0xd4cec2, 2, { ao: 0, skipTop: false });
  // podium roof slab (the skeleton's floor 24 / shaft pit)
  b.box('concrete', T.x0 - 0.25, PODIUM_TOP - 0.35, T.z0 - 0.25, T.x1 + 0.25, PODIUM_TOP, T.z1 + 0.25, 0xcfc8bc, 3, { ao: 0 });
  // lobby: soffit light strips (keep the ground floor readable in shade)
  if (!ctx.mobile) for (const z of [25, 31, 37, 49, 55]) b.box('emissive', -15, LOBBY_CEIL - 0.04, z - 0.1, 15, LOBBY_CEIL, z + 0.1, new THREE.Color(1.6, 1.45, 1.2), 4, { ao: 0 });
}

/** Four facade skins (thin boxes) around a rect between y0 and y1. */
function facadeWalls(b: Builder, r: Rect, y0: number, y1: number, inset = 0) {
  const t = 0.12;
  b.box('facade', r.x0 + inset, y0, r.z0 + inset, r.x1 - inset, y1, r.z0 + inset + t, 0xffffff, 6, { ao: 0 });
  b.box('facade', r.x0 + inset, y0, r.z1 - inset - t, r.x1 - inset, y1, r.z1 - inset, 0xffffff, 6, { ao: 0 });
  b.box('facade', r.x0 + inset, y0, r.z0 + inset, r.x0 + inset + t, y1, r.z1 - inset, 0xffffff, 6, { ao: 0 });
  b.box('facade', r.x1 - inset - t, y0, r.z0 + inset, r.x1 - inset, y1, r.z1 - inset, 0xffffff, 6, { ao: 0 });
}

// ---------------------------------------------------------------------------
// Skeleton: steel frame, decked slabs with holes, no walls
// ---------------------------------------------------------------------------
function skeleton(ctx: Ctx, b: Builder) {
  const cs = 0.18; // half column size
  const colTop = LAB_Y - SLAB;
  for (const x of GRID_X) for (const z of GRID_Z) {
    col(ctx, x - cs, PODIUM_TOP, z - cs, x + cs, colTop, z + cs, { tag: 'column' });
    if (ctx.mobile) b.box('steel', x - cs, PODIUM_TOP, z - cs, x + cs, colTop, z + cs, PALETTE.primer, 1.5, { ao: 0.6 });
    else {
      // H section: flanges along x, web along z
      b.box('steel', x - cs, PODIUM_TOP, z - cs, x + cs, colTop, z - cs + 0.04, PALETTE.primer, 1.5, { ao: 0.6 });
      b.box('steel', x - cs, PODIUM_TOP, z + cs - 0.04, x + cs, colTop, z + cs, PALETTE.primer, 1.5, { ao: 0.6 });
      b.box('steel', x - 0.025, PODIUM_TOP, z - cs + 0.04, x + 0.025, colTop, z + cs - 0.04, PALETTE.primer, 1.5, { ao: 0.6 });
      // base plate
      b.box('metal', x - 0.3, PODIUM_TOP, z - 0.3, x + 0.3, PODIUM_TOP + 0.04, z + 0.3, 0x4a4e54, 1, { ao: 0 });
    }
  }
  for (const y of SKELETON_FLOORS) {
    const holes = slabHoles(y);
    for (const r of subtractRects(T, holes)) {
      col(ctx, r.x0, y - SLAB, r.z0, r.x1, y, r.z1, { tag: 'slab' });
      b.box('concrete', r.x0, y - 0.18, r.z0, r.x1, y, r.z1, 0xcac3b6, 3, { ao: 0, skipBottom: true });
      b.box('container', r.x0, y - SLAB, r.z0, r.x1, y - 0.18, r.z1, 0x9aa0a4, 1.2, { ao: 0, skipTop: true, under: 0.1 });
    }
    // hazard paint around every hole
    for (const h of holes) holeTrim(b, h, y);
  }
  // steel beams under every skeleton slab and the lab slab
  for (const y of [...SKELETON_FLOORS, LAB_Y]) {
    const cuts: Rect[] = [...STAIRS.filter((s) => s.y1 === y).map((s) => s.cut), ...CLIMBS.filter((c) => c.y0 + 6 === y).map((c) => c.cut)];
    const yb = y - SLAB - 0.25;
    for (const z of GRID_Z) for (let i = 0; i < GRID_X.length - 1; i++) {
      const seg = R(GRID_X[i], z - 0.1, GRID_X[i + 1], z + 0.1);
      if (cuts.some((c) => rectsOverlap(seg, c))) continue;
      beamSeg(ctx, b, V(GRID_X[i], yb, z), V(GRID_X[i + 1], yb, z));
    }
    for (const x of GRID_X) for (let i = 0; i < GRID_Z.length - 1; i++) {
      const seg = R(x - 0.1, GRID_Z[i], x + 0.1, GRID_Z[i + 1]);
      if (cuts.some((c) => rectsOverlap(seg, c))) continue;
      beamSeg(ctx, b, V(x, yb, GRID_Z[i]), V(x, yb, GRID_Z[i + 1]));
    }
  }
  // perimeter X-bracing (acts like a see-through wall), a few bays per face
  const braces: [number, number, number, number, number][] = [
    // x0, z0, x1, z1 (bay on a face), floor
    [-18, 34, -18, 40, 30],
    [18, 46, 18, 52, 30],
    [-6, 58, 0, 58, 36],
    [18, 34, 18, 40, 42],
    [-18, 52, -18, 58, 42],
    [6, 58, 12, 58, 48],
    [-18, 28, -18, 34, 48],
  ];
  for (const [x0, z0, x1, z1, y] of braces) {
    const top = y + 6 - SLAB;
    b.beam('steel', V(x0, y, z0), V(x1, top, z1), 0.12, 0.12, PALETTE.steelDark, 1.5);
    b.beam('steel', V(x1, y, z1), V(x0, top, z0), 0.12, 0.12, PALETTE.steelDark, 1.5);
    const pad = 0.1;
    col(ctx, Math.min(x0, x1) - pad, y, Math.min(z0, z1) - pad, Math.max(x0, x1) + pad, top, Math.max(z0, z1) + pad, { seeThrough: true, noPortal: true, tag: 'brace' });
  }
  // safety netting hung on some perimeter bays (visual)
  if (!ctx.headless) {
    const nets: [number, number, number, number, number][] = [
      [-12, 22, -6, 22, 48],
      [0, 22, 12, 22, 54],
      [18, 22, 18, 34, 54],
      [-18, 40, -18, 52, 54],
      [6, 58, 18, 58, 54],
      [18, 52, 18, 58, 36],
    ];
    for (const [x0, z0, x1, z1, y] of nets) {
      const off = x0 === x1 ? (x0 > 0 ? 0.3 : -0.3) : 0;
      const offz = z0 === z1 ? (z0 > 40 ? 0.3 : -0.3) : 0;
      const len = Math.hypot(x1 - x0, z1 - z0), h = 5.4;
      b.quad('net', V(x0 + off, y + 0.3, z0 + offz), V(x1 + off, y + 0.3, z1 + offz), V(x1 + off, y + 0.3 + h, z1 + offz), V(x0 + off, y + 0.3 + h, z0 + offz), 0xffffff, [
        [0, 0],
        [len / 1.6, 0],
        [len / 1.6, h / 1.6],
        [0, h / 1.6],
      ]);
    }
  }
}

function beamSeg(ctx: Ctx, b: Builder, a: THREE.Vector3, e: THREE.Vector3) {
  if (ctx.mobile) b.beam('steel', a, e, 0.2, 0.5, PALETTE.primer, 1.5);
  else b.ibeam('steel', a, e, 0.24, 0.5, PALETTE.primer, 1.5);
}

function holeTrim(b: Builder, h: Rect, y: number) {
  const w = 0.14, t = 0.012;
  b.box('hazard', h.x0 - w, y, h.z0 - w, h.x1 + w, y + t, h.z0, 0xffffff, 0.8, { ao: 0, skipBottom: true });
  b.box('hazard', h.x0 - w, y, h.z1, h.x1 + w, y + t, h.z1 + w, 0xffffff, 0.8, { ao: 0, skipBottom: true });
  b.box('hazard', h.x0 - w, y, h.z0, h.x0, y + t, h.z1, 0xffffff, 0.8, { ao: 0, skipBottom: true, uvRotate: true });
  b.box('hazard', h.x1, y, h.z0, h.x1 + w, y + t, h.z1, 0xffffff, 0.8, { ao: 0, skipBottom: true, uvRotate: true });
}

// ---------------------------------------------------------------------------
// Lab band (60 - 65.7): slab + glass skin with a few openings
// ---------------------------------------------------------------------------
function labBand(ctx: Ctx, b: Builder) {
  col(ctx, T.x0, LAB_Y - SLAB, T.z0, T.x1, LAB_Y, T.z1, { tag: 'slab' });
  b.box('concrete', T.x0 - 0.3, LAB_Y - SLAB - 0.1, T.z0 - 0.3, T.x1 + 0.3, LAB_Y + 0.05, T.z1 + 0.3, 0xd8d2c6, 3, { ao: 0, under: 0.3 });
  // cyan Kessler light line under the lab slab edge
  b.box('emissive', T.x0 - 0.32, LAB_Y - SLAB - 0.1, T.z0 - 0.32, T.x1 + 0.32, LAB_Y - SLAB - 0.02, T.z1 + 0.32, new THREE.Color(0.25, 1.4, 1.8), 4, { ao: 0 });
  const t = 0.12;
  const y0 = LAB_Y, y1 = LAB_CEIL;
  const glassRun = (axis: 'x' | 'z', at: number, from: number, to: number, openings: [number, number][]) => {
    // split the run around openings
    const cuts = openings.slice().sort((a, c) => a[0] - c[0]);
    let s = from;
    const segs: [number, number][] = [];
    for (const [o0, o1] of cuts) {
      if (o0 > s) segs.push([s, o0]);
      s = Math.max(s, o1);
    }
    if (s < to) segs.push([s, to]);
    for (const [a, c] of segs) {
      if (axis === 'z') {
        col(ctx, a, y0, at - t / 2, c, y1, at + t / 2, { tag: 'glass' });
        b.box('glass', a, y0 + 0.08, at - 0.03, c, y1 - 0.05, at + 0.03, 0xffffff, 3, { ao: 0 });
      } else {
        col(ctx, at - t / 2, y0, a, at + t / 2, y1, c, { tag: 'glass' });
        b.box('glass', at - 0.03, y0 + 0.08, a, at + 0.03, y1 - 0.05, c, 0xffffff, 3, { ao: 0 });
      }
      // mullions every 1.5 m + head / sill
      const n = Math.max(1, Math.round((c - a) / 1.5));
      for (let i = 0; i <= n; i++) {
        const p = a + ((c - a) * i) / n;
        if (axis === 'z') b.box('metal', p - 0.04, y0, at - 0.07, p + 0.04, y1, at + 0.07, 0x2a3036, 1, { ao: 0 });
        else b.box('metal', at - 0.07, y0, p - 0.04, at + 0.07, y1, p + 0.04, 0x2a3036, 1, { ao: 0 });
      }
      if (axis === 'z') {
        b.box('metal', a, y0, at - 0.08, c, y0 + 0.1, at + 0.08, 0x2a3036, 1, { ao: 0 });
        b.box('metal', a, y1 - 0.12, at - 0.08, c, y1, at + 0.08, 0x2a3036, 1, { ao: 0 });
        b.box('metal', a, y0 + 2.9, at - 0.06, c, y0 + 2.98, at + 0.06, 0x2a3036, 1, { ao: 0 });
      } else {
        b.box('metal', at - 0.08, y0, a, at + 0.08, y0 + 0.1, c, 0x2a3036, 1, { ao: 0 });
        b.box('metal', at - 0.08, y1 - 0.12, a, at + 0.08, y1, c, 0x2a3036, 1, { ao: 0 });
        b.box('metal', at - 0.06, y0 + 2.9, a, at + 0.06, y0 + 2.98, c, 0x2a3036, 1, { ao: 0 });
      }
    }
  };
  glassRun('z', T.z0 + t / 2, T.x0, T.x1, LAB_OPENINGS.south);
  glassRun('z', T.z1 - t / 2, T.x0, T.x1, LAB_OPENINGS.north);
  glassRun('x', T.x0 + t / 2, T.z0 + t, T.z1 - t, LAB_OPENINGS.west);
  glassRun('x', T.x1 - t / 2, T.z0 + t, T.z1 - t, LAB_OPENINGS.east);
}

// ---------------------------------------------------------------------------
// Upper block (65.7 - 90): glazed, top storey still being clad; KESSLER sign
// ---------------------------------------------------------------------------
function upperBlock(ctx: Ctx, b: Builder) {
  col(ctx, T.x0, LAB_CEIL, T.z0, T.x1, ROOF_Y, T.z1, { tag: 'tower' });
  const r = rng(515);
  const faces: { axis: 'x' | 'z'; at: number; out: number }[] = [
    { axis: 'z', at: T.z0, out: -1 },
    { axis: 'z', at: T.z1, out: 1 },
    { axis: 'x', at: T.x0, out: -1 },
    { axis: 'x', at: T.x1, out: 1 },
  ];
  const t = 0.12;
  for (const f of faces) {
    for (let fl = 66; fl < ROOF_Y; fl += 6) {
      for (let i = 0; i < 6; i++) {
        const a = (f.axis === 'z' ? T.x0 : T.z0) + i * 6, c = a + 6;
        const y0 = fl, y1 = fl + 6;
        const unfinished = fl === 84 && (f.out > 0 ? r() < 0.55 : r() < 0.3);
        if (!unfinished) {
          if (f.axis === 'z') b.box('facade', a, y0, f.at - (f.out > 0 ? t : 0), c, y1, f.at + (f.out < 0 ? t : 0), 0xffffff, 6, { ao: 0 });
          else b.box('facade', f.at - (f.out > 0 ? t : 0), y0, a, f.at + (f.out < 0 ? t : 0), y1, c, 0xffffff, 6, { ao: 0 });
        } else {
          // bare bay: dark interior, a column, safety net outside
          const d = 0.6;
          if (f.axis === 'z') b.box('concrete', a, y0, f.at - f.out * d - 0.05, c, y1, f.at - f.out * d + 0.05, 0x3a3834, 3, { ao: 0 });
          else b.box('concrete', f.at - f.out * d - 0.05, y0, a, f.at - f.out * d + 0.05, y1, c, 0x3a3834, 3, { ao: 0 });
          if (!ctx.headless) {
            const o = f.out * 0.25;
            const pts = f.axis === 'z' ? [V(a, y0 + 0.4, f.at + o), V(c, y0 + 0.4, f.at + o), V(c, y1 - 0.2, f.at + o), V(a, y1 - 0.2, f.at + o)] : [V(f.at + o, y0 + 0.4, a), V(f.at + o, y0 + 0.4, c), V(f.at + o, y1 - 0.2, c), V(f.at + o, y1 - 0.2, a)];
            b.quad('net', pts[0], pts[1], pts[2], pts[3], 0xffffff, [
              [0, 0],
              [6 / 1.6, 0],
              [6 / 1.6, 5.4 / 1.6],
              [0, 5.4 / 1.6],
            ]);
          }
        }
      }
    }
  }
  // slab edge bands every storey + a heavier crown band
  for (const y of [66, 72, 78, 84]) b.box('concrete', T.x0 - 0.2, y - 0.25, T.z0 - 0.2, T.x1 + 0.2, y + 0.15, T.z1 + 0.2, 0xd8d2c6, 2, { ao: 0 });
  b.box('concrete', T.x0 - 0.35, ROOF_Y - 0.6, T.z0 - 0.35, T.x1 + 0.35, ROOF_Y + 0.02, T.z1 + 0.35, 0xe0dace, 2, { ao: 0, under: 0.3 });
  // KESSLER sign on the south face (lit)
  if (!ctx.headless) {
    const tex = TX.signText('KESSLER', { w: 1024, h: 192, color: '#e8fbff' });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.6, 2.2, 2.4), depthWrite: false, toneMapped: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.9), mat);
    sign.position.set(0, 80.9, T.z0 - 0.35);
    sign.rotation.y = Math.PI;
    sign.name = 'sign:kessler';
    ctx.shellRoot.add(sign);
    const sign2 = sign.clone();
    sign2.position.set(T.x0 - 0.35, 80.9, 40);
    sign2.rotation.y = -Math.PI / 2;
    ctx.shellRoot.add(sign2);
  }
}

// ---------------------------------------------------------------------------
// Construction hoist mast (south face)
// ---------------------------------------------------------------------------
function hoistMast(ctx: Ctx, b: Builder) {
  const m = HOIST.mast;
  const cx = (m.x0 + m.x1) / 2, cz = (m.z0 + m.z1) / 2;
  col(ctx, m.x0, 0, m.z0, m.x1, HOIST.top, m.z1, { tag: 'hoist' });
  b.box('concrete', m.x0 - 0.4, 0, m.z0 - 0.4, m.x1 + 0.4, 0.2, m.z1 + 0.4, 0xbfb8ab, 2, { skipBottom: true });
  lattice(b, cx, cz, 0.2, HOIST.top, 0.9, PALETTE.crane, 0.12, 0.05, 1.5);
  // rack rails on both sides
  for (const x of [m.x0 - 0.06, m.x1 + 0.06]) b.box('metal', x - 0.04, 0.2, cz - 0.15, x + 0.04, HOIST.top, cz + 0.15, 0x3a3e44, 1, { ao: 0 });
  // wall ties to the slab edges
  for (let y = 6; y < HOIST.top; y += 6) {
    b.beam('steel', V(cx, y, m.z1), V(cx - 1.5, y, T.z0), 0.1, 0.1, PALETTE.crane, 1);
    b.beam('steel', V(cx, y, m.z1), V(cx + 1.5, y, T.z0), 0.1, 0.1, PALETTE.crane, 1);
  }
  // mast head + beacon
  b.box('steel', m.x0 - 0.3, HOIST.top, m.z0 - 0.3, m.x1 + 0.3, HOIST.top + 0.8, m.z1 + 0.3, PALETTE.crane, 1, { ao: 0 });
  // ground enclosure (mesh fence) around the base, open toward the tower
  for (const [x0, x1] of [[HOIST.cageA.x0 - 0.4, HOIST.cageB.x1 + 0.4]]) {
    b.box('metal', x0, 0, HOIST.cageA.z0 - 0.5, x1, 1.1, HOIST.cageA.z0 - 0.45, 0x5a6068, 1, { ao: 0 });
  }
}

// ---------------------------------------------------------------------------
// Tower crane (yard, east of the tower): its cab is the skeleton's sniper nest
// ---------------------------------------------------------------------------
function towerCrane(ctx: Ctx, b: Builder) {
  const { x, z } = CRANE;
  const cy = CRANE.jibY;
  // footing
  col(ctx, x - 2.2, 0, z - 2.2, x + 2.2, 1.2, z + 2.2, { tag: 'footing' });
  b.box('concrete', x - 2.2, 0, z - 2.2, x + 2.2, 1.2, z + 2.2, 0xbdb5a8, 2, { skipBottom: true });
  // mast
  col(ctx, x - 1, 1.2, z - 1, x + 1, CRANE.cabY - 0.3, z + 1, { tag: 'crane' });
  lattice(b, x, z, 1.2, CRANE.cabY - 0.3, 2, PALETTE.crane, 0.2, 0.08, 2.2);
  // slewing unit
  col(ctx, x - 1.3, CRANE.cabY - 0.3, z - 1.3, x + 1.3, cy, z + 1.3, { tag: 'crane' });
  b.box('steel', x - 1.3, CRANE.cabY - 0.3, z - 1.3, x + 1.3, cy, z + 1.3, PALETTE.crane, 2, { ao: 0 });
  b.box('metal', x - 1.4, CRANE.cabY + 0.6, z - 1.4, x + 1.4, CRANE.cabY + 0.9, z + 1.4, 0x2b2f34, 2, { ao: 0 });
  // operator cab (sniper perch): floor collider, roof collider, back wall; open front (west)
  const c = CRANE.cab;
  col(ctx, c.x0, CRANE.cabY - 0.3, c.z0, c.x1, CRANE.cabY, c.z1, { tag: 'cab' });
  b.box('metal', c.x0, CRANE.cabY - 0.3, c.z0, c.x1, CRANE.cabY, c.z1, 0x3a3e44, 1, { ao: 0 });
  col(ctx, c.x0, CRANE.cabY + 2.4, c.z0, c.x1, CRANE.cabY + 2.6, c.z1, { tag: 'cab' });
  b.box('steel', c.x0 - 0.05, CRANE.cabY + 2.4, c.z0 - 0.05, c.x1 + 0.05, CRANE.cabY + 2.6, c.z1 + 0.05, PALETTE.crane, 1, { ao: 0 });
  // side walls (lower solid, upper glazed frame) + posts
  for (const zz of [c.z0, c.z1 - 0.08]) {
    b.box('steel', c.x0, CRANE.cabY, zz, c.x1, CRANE.cabY + 1.0, zz + 0.08, PALETTE.crane, 1, { ao: 0 });
    b.box('glass', c.x0 + 0.1, CRANE.cabY + 1.0, zz, c.x1, CRANE.cabY + 2.4, zz + 0.06, 0xffffff, 2, { ao: 0 });
  }
  col(ctx, c.x0, CRANE.cabY, c.z0, c.x1, CRANE.cabY + 1.0, c.z0 + 0.08, { tag: 'cab' });
  col(ctx, c.x0, CRANE.cabY, c.z1 - 0.08, c.x1, CRANE.cabY + 1.0, c.z1, { tag: 'cab' });
  for (const zz of [c.z0, c.z1 - 0.1]) b.box('steel', c.x0, CRANE.cabY, zz, c.x0 + 0.1, CRANE.cabY + 2.4, zz + 0.1, PALETTE.crane, 1, { ao: 0 });
  // jib (south) + counter-jib (north)
  const jibA = V(x, cy, z + 1), jibB = V(x, cy, CRANE.jibTip);
  girder(b, jibA, jibB, 1.6, 1.8, PALETTE.crane, 0.14, 0.06, 2.0);
  col(ctx, x - 0.8, cy, CRANE.jibTip, x + 0.8, cy + 0.3, z - 1.3, { tag: 'jib' });
  girder(b, V(x, cy, z - 1), V(x, cy, CRANE.counterEnd), 2.0, 1.2, PALETTE.crane, 0.14, 0.06, 2.0);
  col(ctx, x - 1, cy, z + 1.3, x + 1, cy + 0.3, CRANE.counterEnd, { tag: 'jib' });
  b.box('steel', x - 1, cy, z + 1.3, x + 1, cy + 0.12, CRANE.counterEnd, 0x6b7076, 1, { ao: 0 });
  // counterweights + machinery
  for (let i = 0; i < 4; i++) b.box('concrete', x - 1.1, cy - 2.2, CRANE.counterEnd - 3.2 + i * 0.8, x + 1.1, cy, CRANE.counterEnd - 2.5 + i * 0.8, 0xa9a397, 1, { ao: 0 });
  b.box('steel', x - 1.0, cy + 0.12, z + 4, x + 1.0, cy + 1.6, z + 7, 0x3a3e44, 1, { ao: 0 });
  // tower head + pendants
  const apex = V(x, cy + 8, z);
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) b.beam('steel', V(x + dx, cy, z + dz), apex, 0.16, 0.16, PALETTE.crane, 1);
  b.beam('metal', apex, V(x, cy + 1.8, z - 22), 0.05, 0.05, 0x333333, 1);
  b.beam('metal', apex, V(x, cy + 1.8, CRANE.jibTip + 0.5), 0.05, 0.05, 0x333333, 1);
  b.beam('metal', apex, V(x, cy + 1.2, CRANE.counterEnd - 0.5), 0.05, 0.05, 0x333333, 1);
  // trolleys + hook blocks (the loads are props; the game draws the cables)
  for (const tz of CRANE.trolleys) {
    b.box('steel', x - 0.9, cy - 0.35, tz - 0.8, x + 0.9, cy, tz + 0.8, 0x2f3338, 1, { ao: 0 });
  }
  // beacons
  beacon(ctx, V(x, cy + 8.3, z));
  beacon(ctx, V(x, cy + 2.0, CRANE.jibTip + 0.3));
  beacon(ctx, V(x, cy + 1.4, CRANE.counterEnd));
  // name plate
  b.box('steel', x - 0.05, cy + 0.4, z - 12, x + 0.05, cy + 1.6, z - 4, PALETTE.kessler, 1, { ao: 0 });
}

/** Blinking red aviation light. */
export function beacon(ctx: Ctx, p: THREE.Vector3, phase = 0) {
  ctx.beacons.push({ pos: p.clone(), phase: phase + p.x * 0.37 + p.z * 0.11 });
}

/** All beacons as one instanced draw; blinking = per-instance scale. */
export function buildBeacons(beacons: { pos: THREE.Vector3; phase: number }[], animated: ((t: number) => void)[]) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.3) }), Math.max(1, beacons.length));
  m.name = 'beacons';
  m.frustumCulled = false;
  const on = new THREE.Matrix4(), off = new THREE.Matrix4().makeScale(0, 0, 0);
  const state: boolean[] = beacons.map(() => true);
  beacons.forEach((b, i) => m.setMatrixAt(i, on.makeTranslation(b.pos.x, b.pos.y, b.pos.z)));
  animated.push((t) => {
    let dirty = false;
    beacons.forEach((b, i) => {
      const v = Math.sin(t * 2.6 + b.phase) > 0.2;
      if (v === state[i]) return;
      state[i] = v;
      m.setMatrixAt(i, v ? on.makeTranslation(b.pos.x, b.pos.y, b.pos.z) : off);
      dirty = true;
    });
    if (dirty) m.instanceMatrix.needsUpdate = true;
  });
  return m;
}

// ---------------------------------------------------------------------------
// Harbour gantry crane (pier, east quay): its back-reach carries a container
// over the pier arena.
// ---------------------------------------------------------------------------
export const HARBOUR_CRANE = { legsX: [28, 38], legsZ: [-12, -2], boomY: 24, boomZ: -7, backX: 12, outX: 74, trolleyX: 17 };

function harbourCrane(ctx: Ctx, b: Builder) {
  const H = HARBOUR_CRANE;
  const c = 0x2f6fa8; // harbour blue
  const hi = 0xe8ecef;
  for (const x of H.legsX) for (const z of H.legsZ) {
    col(ctx, x - 0.6, 0, z - 0.6, x + 0.6, H.boomY, z + 0.6, { tag: 'crane' });
    b.box('steel', x - 0.6, 0.5, z - 0.6, x + 0.6, H.boomY, z + 0.6, c, 2, { ao: 0.4 });
    // bogies on the rails
    b.box('metal', x - 0.8, 0, z - 1.0, x + 0.8, 0.9, z + 1.0, 0x2b2f34, 1);
  }
  // rails
  for (const x of H.legsX) b.box('metal', x - 0.12, 0, -13.8, x + 0.12, 0.03, -0.3, 0x5a5e62, 1, { ao: 0 });
  // portal beams + sill beams
  for (const z of H.legsZ) b.box('steel', H.legsX[0] - 0.7, H.boomY - 2, z - 0.7, H.legsX[1] + 0.7, H.boomY, z + 0.7, c, 2, { ao: 0 });
  for (const x of H.legsX) {
    b.box('steel', x - 0.5, 9, H.legsZ[0], x + 0.5, 10, H.legsZ[1], c, 2, { ao: 0 });
    b.box('steel', x - 0.6, H.boomY - 2, H.legsZ[0], x + 0.6, H.boomY, H.legsZ[1], c, 2, { ao: 0 });
  }
  // boom (two box girders)
  for (const dz of [-1.3, 1.3]) {
    b.box('steel', H.backX, H.boomY, H.boomZ + dz - 0.35, H.outX, H.boomY + 1.8, H.boomZ + dz + 0.35, hi, 2, { ao: 0, under: 0.35 });
  }
  col(ctx, H.backX, H.boomY, H.boomZ - 1.65, H.outX, H.boomY + 1.8, H.boomZ + 1.65, { tag: 'boom' });
  // machinery house + cab
  col(ctx, 25, H.boomY + 1.8, H.boomZ - 2.5, 37, H.boomY + 5, H.boomZ + 2.5, { tag: 'crane' });
  b.box('steel', 25, H.boomY + 1.8, H.boomZ - 2.5, 37, H.boomY + 5, H.boomZ + 2.5, hi, 2, { ao: 0 });
  b.box('steel', 25, H.boomY + 1.2, H.boomZ - 2.5, 37, H.boomY + 1.8, H.boomZ + 2.5, c, 2, { ao: 0 });
  b.box('steel', 40, H.boomY - 3, H.boomZ - 1.2, 43, H.boomY, H.boomZ + 1.2, hi, 1, { ao: 0 });
  b.box('facade', 42.9, H.boomY - 2.6, H.boomZ - 1.0, 43.05, H.boomY - 0.6, H.boomZ + 1.0, 0xffffff, 6, { ao: 0 });
  // A-frame apex + forestays
  const apexL = V(33, H.boomY + 16, H.boomZ - 1.3), apexR = V(33, H.boomY + 16, H.boomZ + 1.3);
  for (const ap of [apexL, apexR]) {
    b.beam('steel', V(28, H.boomY + 1.8, ap.z), ap, 0.5, 0.5, c, 1);
    b.beam('steel', V(38, H.boomY + 1.8, ap.z), ap, 0.5, 0.5, c, 1);
    b.beam('metal', ap, V(H.outX - 1, H.boomY + 1.8, ap.z), 0.08, 0.08, 0x333333, 1);
    b.beam('metal', ap, V(56, H.boomY + 1.8, ap.z), 0.08, 0.08, 0x333333, 1);
    b.beam('metal', ap, V(H.backX + 1, H.boomY + 1.8, ap.z), 0.08, 0.08, 0x333333, 1);
  }
  b.beam('steel', apexL, apexR, 0.4, 0.4, c, 1);
  // trolley over the arena
  b.box('steel', H.trolleyX - 1.5, H.boomY - 0.6, H.boomZ - 1.6, H.trolleyX + 1.5, H.boomY, H.boomZ + 1.6, 0x2f3338, 1, { ao: 0 });
  beacon(ctx, V(33, H.boomY + 16.4, H.boomZ));
  beacon(ctx, V(H.outX - 0.5, H.boomY + 2.1, H.boomZ));
}
