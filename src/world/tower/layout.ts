/**
 * Kessler Threshold Tower: master coordinates shared by the structure and the
 * zone builders. +X = east, +Z = north (the pier is south, the tower north of
 * it), y up. The sun sets in the west-south-west over open sea.
 */

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export const R = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0, z0, x1, z1 });

/**
 * Direction TO the sun: low (about 15 degrees) over the open sea on the -X side
 * (called "west" in this level), slightly south, so the pier -> tower view is
 * side-lit with long shadows and the roof's leap faces the sunset.
 */
export const SUN_DIR = { x: -0.87, y: 0.27, z: -0.22 };
/** Linear-RGB haze shared by fog, sky horizon and skyline. sRGB hex of the same colour: 0xd4b395. */
export const HAZE_LINEAR = { r: 0.66, g: 0.45, b: 0.3 };

/** Tower footprint (36 x 36 m, centred on (0, 40)). */
export const TOWER = R(-18, 22, 18, 58);
export const GRID_X = [-18, -12, -6, 0, 6, 12, 18];
export const GRID_Z = [22, 28, 34, 40, 46, 52, 58];

export const LOBBY_CEIL = 5.7;
export const PODIUM_TOP = 24;
/** Skeleton slab tops (24 is the podium roof = the shaft pit). */
export const SKELETON_FLOORS = [30, 36, 42, 48, 54];
export const SLAB = 0.3;
export const LAB_Y = 60;
export const LAB_CEIL = 65.7;
export const ROOF_Y = 90;

/** Concrete core in the lobby (ground floor only). */
export const CORE = R(-5, 35, 5, 45);

/** The open elevator shaft: a 3 x 3 m hole through every skeleton slab, pit at 24, top = lab slab underside. */
export const SHAFT = R(1.5, 35.5, 4.5, 38.5);

/** Stairs (flight start x/z at the lower floor, climbing +z). */
export const STAIRS = [
  { id: 'F1', x: 14.25, z: 23.5, y0: 24, y1: 30, cut: R(13.3, 26.3, 15.2, 30.45) },
  { id: 'F2', x: -15.5, z: 45.5, y0: 30, y1: 36, cut: R(-16.45, 48.3, -14.55, 52.45) },
  { id: 'F3', x: 15.5, z: 40.0, y0: 36, y1: 42, cut: R(14.55, 42.8, 16.45, 46.95) },
];

/** Climb towers (landing at y0+2, deck at y0+4 under a cut in the slab above). */
export const CLIMBS = [
  { id: 'C1', y0: 30, p1: R(-17.4, 30, -15.2, 32.2), p2: R(-15.2, 30, -13, 32.2), cut: R(-15.3, 29.9, -12.9, 32.3) },
  { id: 'C2', y0: 36, p1: R(8.6, 30, 10.8, 32.2), p2: R(10.8, 30, 13, 32.2), cut: R(10.7, 29.9, 13.1, 32.3) },
];

/** Missing decking bays (the steel grid stays). */
export const VOID_BAYS: Record<number, Rect[]> = {
  30: [],
  36: [R(6, 46, 18, 58)],
  42: [R(-18, 28, -6, 40)],
  48: [R(6, 22, 18, 34), R(-18, 46, -12, 52)],
  54: [R(-18, 46, -6, 58), R(12, 22, 18, 28)],
};

/** All holes of a skeleton slab (shaft + stair/climb cuts + void bays). */
export function slabHoles(y: number): Rect[] {
  const h: Rect[] = [SHAFT, ...(VOID_BAYS[y] ?? [])];
  for (const s of STAIRS) if (s.y1 === y) h.push(s.cut);
  for (const c of CLIMBS) if (c.y0 + 6 === y) h.push(c.cut);
  return h;
}

/** Construction hoist on the south face: twin cages either side of the mast. */
export const HOIST = {
  mast: R(-6.45, 17.55, -5.55, 18.45),
  cageA: R(-10.2, 17.2, -6.7, 21.85),
  cageB: R(-5.3, 17.2, -1.8, 21.85),
  aFrom: 0.2,
  aTo: 30.2,
  bFrom: 42.2,
  bTo: 60.2,
  top: 70,
};

/** External glass lift on the north face, lab -> roof. */
export const GLASS_LIFT = { cage: R(8, 58.2, 12, 62.2), from: 60.2, to: 90.2 };

/** Tower crane in the yard (east of the tower): mast centre, cab, jib. */
export const CRANE = { x: 27, z: 30, cab: R(23.6, 28.9, 26, 31.1), cabY: 38.5, jibY: 41, jibTip: -6, counterEnd: 44, trolleys: [12, 3] };

/** Land (top y = 0): everything else at sea level is water. */
export const LAND: Rect[] = [
  R(-40, -50, 40, 0), // pier quay
  R(-40, 0, 40, 76), // construction yard
  R(20, -66, 32, -56), // jetty (start)
];
export const BARGE = R(42, -46, 52, -16);

export function inRect(r: Rect, x: number, z: number, pad = 0) {
  return x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
}

export function rectsOverlap(a: Rect, b: Rect, eps = 1e-6) {
  return a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps;
}

/** base minus holes, as a small set of non-overlapping rectangles (grid split + merge). */
export function subtractRects(base: Rect, holes: Rect[]): Rect[] {
  const hs = holes.map((h) => R(Math.max(base.x0, h.x0), Math.max(base.z0, h.z0), Math.min(base.x1, h.x1), Math.min(base.z1, h.z1))).filter((h) => h.x1 > h.x0 && h.z1 > h.z0);
  const xs = [...new Set([base.x0, base.x1, ...hs.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b);
  const zs = [...new Set([base.z0, base.z1, ...hs.flatMap((h) => [h.z0, h.z1])])].sort((a, b) => a - b);
  const filled = (i: number, j: number) => {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    return !hs.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
  };
  // strips per row
  let strips: Rect[] = [];
  for (let j = 0; j < zs.length - 1; j++) {
    let i = 0;
    while (i < xs.length - 1) {
      if (!filled(i, j)) {
        i++;
        continue;
      }
      let k = i;
      while (k + 1 < xs.length - 1 && filled(k + 1, j)) k++;
      strips.push(R(xs[i], zs[j], xs[k + 1], zs[j + 1]));
      i = k + 1;
    }
  }
  // merge vertically when x-spans match
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let a = 0; a < strips.length; a++) {
      for (let c = 0; c < strips.length; c++) {
        if (a === c) continue;
        const A = strips[a], C = strips[c];
        if (Math.abs(A.x0 - C.x0) < 1e-6 && Math.abs(A.x1 - C.x1) < 1e-6 && Math.abs(A.z1 - C.z0) < 1e-6) {
          strips[a] = R(A.x0, A.z0, A.x1, C.z1);
          strips.splice(c, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  strips = strips.filter((s) => s.x1 - s.x0 > 1e-3 && s.z1 - s.z0 > 1e-3);
  return strips;
}
