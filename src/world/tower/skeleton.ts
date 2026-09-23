import type { ZoneDef } from '../../core/contracts';
import { Ctx, PALETTE, V, addProp, box3, col, solid } from './kit';
import { crateStatic, railing, stairs } from './parts';
import { CLIMBS, CRANE, HOIST, SHAFT, STAIRS, TOWER } from './layout';
import { YAW, encounter, spawn } from './zonekit';
import { hoistLift } from './lifts';

/**
 * ZONE 3: THE SKELETON (floors 30 / 36 / 42; 24 is the podium roof and the
 * shaft pit). Open steel floors with the void at every edge, the 3 x 3 m
 * elevator shaft through all of them (rift loops), stairs + scaffold climbs
 * between floors, and the tower crane's cab 6 m off the east face (sniper).
 *   loop (30) -> firingLine (36, sniper in the crane cab) -> arena (42 + 36)
 *   -> hoist B (42 -> 60).
 */
export function buildSkeleton(ctx: Ctx): ZoneDef {
  const b = ctx.mb;
  const Z = 'skeleton' as const;
  const T = TOWER;

  // ---------------- stairs + climbs ----------------
  for (const s of STAIRS) {
    stairs(ctx, s.x, s.z, s.y0, s.y1, '+z', 1.5);
    // guard rails along the long sides of the cut in the slab above
    railing(ctx, s.cut.x0, s.cut.z0, s.cut.x0, s.cut.z1, s.y1);
    railing(ctx, s.cut.x1, s.cut.z0, s.cut.x1, s.cut.z1, s.y1);
    railing(ctx, s.cut.x0, s.cut.z0, s.cut.x1, s.cut.z0, s.y1);
  }
  for (const c of CLIMBS) {
    for (const [p, h] of [[c.p1, 2], [c.p2, 4]] as const) {
      const y = c.y0 + h;
      col(ctx, p.x0, y - 0.12, p.z0, p.x1, y, p.z1, { tag: 'scaffold' });
      b.box('wood', p.x0, y - 0.12, p.z0, p.x1, y, p.z1, 0xcaa878, 2.4, { ao: 0 });
      // shoring legs
      for (const [x, z] of [[p.x0 + 0.1, p.z0 + 0.1], [p.x1 - 0.1, p.z0 + 0.1], [p.x0 + 0.1, p.z1 - 0.1], [p.x1 - 0.1, p.z1 - 0.1]]) {
        b.box('metal', x - 0.03, c.y0, z - 0.03, x + 0.03, y, z + 0.03, PALETTE.galv, 1, { ao: 0 });
      }
      b.beam('metal', V(p.x0 + 0.1, c.y0 + 0.2, p.z0 + 0.1), V(p.x1 - 0.1, y - 0.2, p.z0 + 0.1), 0.04, 0.04, PALETTE.galv, 1);
      b.beam('metal', V(p.x0 + 0.1, c.y0 + 0.2, p.z1 - 0.1), V(p.x1 - 0.1, y - 0.2, p.z1 - 0.1), 0.04, 0.04, PALETTE.galv, 1);
    }
  }

  // ---------------- the shaft: corner posts, rails on two sides, pit ----------------
  for (const y of [30, 36, 42]) {
    railing(ctx, SHAFT.x0 - 0.1, SHAFT.z1 + 0.1, SHAFT.x1 + 0.1, SHAFT.z1 + 0.1, y);
    railing(ctx, SHAFT.x1 + 0.1, SHAFT.z0 - 0.1, SHAFT.x1 + 0.1, SHAFT.z1 + 0.1, y);
  }
  for (const [x, z] of [[SHAFT.x0, SHAFT.z0], [SHAFT.x1, SHAFT.z0], [SHAFT.x0, SHAFT.z1], [SHAFT.x1, SHAFT.z1]]) {
    b.box('steel', x - 0.08, 24, z - 0.08, x + 0.08, 59.7, z + 0.08, PALETTE.steelDark, 1.5, { ao: 0 });
  }
  // pit floor paint (a big target for a floor end)
  b.box('hazard', SHAFT.x0, 24, SHAFT.z0, SHAFT.x1, 24.012, SHAFT.z1, 0xffffff, 1.5, { ao: 0 });

  // ---------------- edge railings (only in places: the void is the weapon) ----------------
  railing(ctx, -18, 22.1, -10.4, 22.1, 30); // west of the hoist landing
  railing(ctx, -1.6, 22.1, 12, 22.1, 30);
  railing(ctx, 18 - 0.1, 40, 18 - 0.1, 58, 36);
  railing(ctx, -18 + 0.1, 22, -18 + 0.1, 34, 36);
  railing(ctx, 6, 58 - 0.1, 18, 58 - 0.1, 42);
  // void-bay edges (partial)
  railing(ctx, 6.1, 46, 6.1, 52, 36);
  railing(ctx, -6.1, 34, -6.1, 40, 42);
  // hoist landing gates where the cages don't stop
  const gate = (x0: number, x1: number, y: number) => railing(ctx, x0, 22.08, x1, 22.08, y, { h: 1.9, color: PALETTE.orange });
  gate(HOIST.cageA.x0, HOIST.cageB.x1, 24);
  gate(HOIST.cageA.x1, HOIST.cageB.x1, 30);
  gate(HOIST.cageA.x0, HOIST.cageB.x1, 36);
  gate(HOIST.cageA.x0, HOIST.cageB.x0, 42);
  gate(HOIST.cageA.x0, HOIST.cageB.x1, 48);
  gate(HOIST.cageA.x0, HOIST.cageB.x1, 54);

  // ---------------- clutter / cover per floor ----------------
  // floor 30 (loop)
  crateStatic(ctx, -10, 36, 1.2, 1.1, 30, 0xc4704a);
  crateStatic(ctx, -8.6, 36.2, 1.2, 1.1, 30, 0xc4704a);
  materialStack(ctx, 8, 33, 11, 35, 30, 1.0);
  materialStack(ctx, -4, 47, -1, 49.4, 30, 1.3);
  cylinders(ctx, 14, 52, 30);
  // floor 36 (firing line)
  materialStack(ctx, -9, 26, -5.6, 28.6, 36, 1.2);
  crateStatic(ctx, 2, 30, 1.3, 1.2, 36);
  materialStack(ctx, -6, 44, -2.6, 46.6, 36, 1.0);
  crateStatic(ctx, -14, 42, 1.3, 1.2, 36, 0xc4704a);
  // floor 42 (arena)
  materialStack(ctx, 1, 26, 4, 28.6, 42, 1.2);
  crateStatic(ctx, -3, 44, 1.3, 1.2, 42);
  materialStack(ctx, 8, 52, 11, 54.6, 42, 1.1);
  crateStatic(ctx, 14, 36, 1.3, 1.2, 42, 0xc4704a);
  cylinders(ctx, -10, 54, 42);
  // work lamps under the slabs
  for (const [x, y, z] of [[-3, 35.3, 30], [9, 41.3, 44], [-9, 47.3, 48]]) {
    ctx.lamps.push({ pos: V(x, y, z), dir: V(0, -1, 0), color: 0xffe0b0, range: 12, angle: 1.0, intensity: 0.6, kind: 'hang' });
    b.box('metal', x - 0.3, y, z - 0.15, x + 0.3, y + 0.2, z + 0.15, 0x2b2f34, 1, { ao: 0 });
  }

  // ---------------- props ----------------
  const barrel = V(0.6, 0.9, 0.6);
  // barrels by the shaft (for loops / cannonballs)
  for (const [x, y, z] of [[6.0, 30, 37], [6.6, 30, 37.8], [-0.8, 30, 34.4], [5.6, 36, 41.2], [-4, 42, 31], [10, 42, 40], [-12.6, 36, 36.4]]) addProp(ctx, 'barrel', V(x, y, z), barrel, { explosive: true });
  addProp(ctx, 'crate', V(-2.2, 30, 40.8), V(1.2, 1.2, 1.2));
  addProp(ctx, 'crate', V(8.5, 36, 36.5), V(1.2, 1.2, 1.2), { yaw: 0.5 });

  // ---------------- encounters ----------------
  const floorBand = (y: number) => box3(T.x0, y - 0.5, T.z0, T.x1, y + 4, T.z1);
  const cab = CRANE.cab;
  const encounters = [
    encounter(
      Z,
      'loop',
      floorBand(30),
      [
        spawn(Z, 'loop.a', 'rifleman', 8, 30, 50, YAW.S, 'loop'),
        spawn(Z, 'loop.b', 'rifleman', -8, 30, 53, 2.6, 'loop'),
        spawn(Z, 'loop.c', 'rifleman', 10, 30, 30, YAW.N, 'loop', { state: 'patrol', route: [V(10, 30, 30), V(10, 30, 44)], wait: [2, 2] }),
      ],
      true,
      { pos: V(-3, 30, 30), yaw: YAW.N },
    ),
    encounter(
      Z,
      'firingLine',
      floorBand(36),
      [
        spawn(Z, 'fl.sniper', 'sniper', (cab.x0 + cab.x1) / 2 - 0.4, CRANE.cabY, (cab.z0 + cab.z1) / 2, YAW.W, 'fl', { perch: true }),
        spawn(Z, 'fl.a', 'rifleman', -10, 36, 30, YAW.E, 'fl'),
        spawn(Z, 'fl.b', 'rifleman', 4, 36, 44, YAW.S, 'fl'),
      ],
      true,
      { pos: V(-15.5, 36, 54), yaw: YAW.S },
    ),
    encounter(
      Z,
      'arena',
      floorBand(42),
      [
        spawn(Z, 'arena.brute', 'brute', 8, 42, 44, YAW.S, 'arena'),
        spawn(Z, 'arena.w1', 'warden', -2, 42, 50, YAW.S, 'arena'),
        spawn(Z, 'arena.w2', 'warden', 4, 42, 30, YAW.N, 'arena'),
        spawn(Z, 'arena.a', 'rifleman', -12, 42, 50, YAW.E, 'arena'),
        spawn(Z, 'arena.b', 'rifleman', -12, 36, 38, YAW.N, 'arena'),
        spawn(Z, 'arena.c', 'rifleman', -4, 36, 26, YAW.N, 'arena'),
      ],
      true,
      { pos: V(-3.5, 42, 24.5), yaw: YAW.S },
    ),
  ];

  const exit = hoistLift(ctx, 'skeleton.hoist', HOIST.cageB, HOIST.bFrom, HOIST.bTo, encounters.filter((e) => e.requireClear).map((e) => e.id), 'lab');

  const layer = (y: number) => ({ minX: T.x0, maxX: T.x1, minZ: T.z0, maxZ: T.z1, floorY: y });
  return {
    id: Z,
    nameKey: 'zone.skeleton.name',
    subKey: 'zone.skeleton.sub',
    bounds: box3(-45, 23.5, 5, 45, 59.5, 75),
    nav: [layer(24), layer(30), layer(36), layer(42), { minX: cab.x0, maxX: cab.x1, minZ: cab.z0, maxZ: cab.z1, floorY: CRANE.cabY }],
    playerStart: V(-8.45, 30, 24.5),
    startYaw: YAW.N,
    killY: 20,
    sea: false,
    encounters,
    exit,
    challenges: ['skeleton.1', 'skeleton.2', 'skeleton.3'],
  };
}

/** Pallet of construction material wrapped in plastic (cover). */
function materialStack(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, h: number) {
  const b = ctx.mb;
  col(ctx, x0, y, z0, x1, y + h, z1, { tag: 'material' });
  b.box('wood', x0, y, z0, x1, y + 0.15, z1, 0x9a7a52, 1, { ao: 0.3 });
  b.box('concrete', x0 + 0.05, y + 0.15, z0 + 0.05, x1 - 0.05, y + h, z1 - 0.05, 0xb8b4ac, 0.8, { ao: 0.4 });
  b.box('steel', x0 + 0.03, y + h * 0.55, z0 + 0.03, x1 - 0.03, y + h * 0.55 + 0.05, z1 - 0.03, 0x2a64b8, 1, { ao: 0 });
}

/** Rack of gas cylinders (cover). */
function cylinders(ctx: Ctx, x: number, z: number, y: number) {
  const b = ctx.mb;
  solid(ctx, 'metal', x - 1.2, y, z - 0.4, x + 1.2, y + 1.5, z + 0.4, 0x3a3e44, 1, { tag: 'cylinders' }, { skipBottom: true });
  if (ctx.mobile) return;
  for (let i = 0; i < 6; i++) {
    const cx = x - 1.0 + i * 0.4;
    b.cylinder('metal', V(cx, y + 1.5, z - 0.5), V(cx, y + 1.65, z - 0.5), 0.12, i % 2 ? 0xd83a2a : 0x2a64b8, 8, 1);
  }
}
