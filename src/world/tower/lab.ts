import * as THREE from 'three';
import type { GateDef, HazardDef, LaserDef, RiftEndKind, SpawnDef, ZoneDef } from '../../core/contracts';
import { orientFrame, type RiftFrame } from '../../game/portalMath';
import { Ctx, PALETTE, V, addProp, box3, col, solid } from './kit';
import { crateStatic, railing } from './parts';
import { GLASS_LIFT, LAB_CEIL, LAB_Y, TOWER } from './layout';
import { YAW, encounter, fight, spawn } from './zonekit';
import { glassLift } from './lifts';

export interface LabBuild {
  zone: ZoneDef;
  gates: GateDef[];
  hazards: HazardDef[];
  lasers: LaserDef[];
}

const Y = LAB_Y;

/**
 * ZONE 4: THE LAB (y 60). Kessler's glass-walled rift lab. Two staging rooms
 * (west + east) hold the gates' in-ends; their out-ends open on the arena side
 * of the staging walls. Open facade bays (no glass) at z 28-34 on both sides
 * give the player the void.
 *   hijack (arena, south/centre) -> hall (north-west server hall, a plain
 *   fight, laser gate in the west aisle) -> borrowedGun (north-east gallery
 *   behind a laser curtain, turret guarding the glass lift) -> glass lift to
 *   the roof.
 */
export function buildLab(ctx: Ctx): LabBuild {
  const b = ctx.mb;
  const Z = 'lab' as const;
  const T = TOWER;
  const C = LAB_CEIL;

  // ---------------- floor, ceiling, light ----------------
  b.box('panel', T.x0, Y, T.z0, T.x1, Y + 0.02, T.z1, 0x4c5660, 2.4, { ao: 0, skipBottom: true });
  b.box('panel', T.x0, C - 0.3, T.z0, T.x1, C, T.z1, 0xb8bcc0, 2.4, { ao: 0, skipTop: true, under: 0 });
  for (const z of [25, 31, 37, 43, 49, 55]) b.box('emissive', -16.5, C - 0.34, z - 0.14, 16.5, C - 0.3, z + 0.14, new THREE.Color(0.9, 0.95, 1.0), 2, { ao: 0 });
  // cyan floor inlay lines (Kessler)
  for (const x of [-11.5, 11.5]) b.box('emissive', x - 0.04, Y + 0.02, 23, x + 0.04, Y + 0.03, 45, new THREE.Color(0.3, 2.2, 2.8), 2, { ao: 0 });
  for (const [x, z] of [[-8, 30], [8, 30], [0, 44], [-9, 52], [9, 52]]) ctx.lamps.push({ pos: V(x, C - 0.35, z), dir: V(0, -1, 0), color: 0xdff4ff, range: 12, angle: 1.05, intensity: 0.7, kind: 'hang' });

  // ---------------- staging rooms (gate in-ends) ----------------
  const wallC = 0xf0f0ee;
  const room = (x0: number, x1: number, side: 1 | -1) => {
    const inner = side > 0 ? x1 : x0; // the arena-facing wall
    const w0 = side > 0 ? x1 - 0.15 : x0, w1 = side > 0 ? x1 : x0 + 0.15;
    solid(ctx, 'panel', w0, Y, 36, w1, C - 0.3, 46, wallC, 2.4, { tag: 'staging', noPortal: true });
    solid(ctx, 'panel', x0, Y, 36, x1, C - 0.3, 36.15, wallC, 2.4, { tag: 'staging', noPortal: true });
    solid(ctx, 'panel', x0, Y, 45.85, x1, C - 0.3, 46, wallC, 2.4, { tag: 'staging', noPortal: true });
    // red staging light strips inside
    b.box('emissive', x0 + 0.3, C - 0.36, 40.8, x1 - 0.3, C - 0.3, 41.2, new THREE.Color(3, 0.3, 0.2), 2, { ao: 0 });
    // hazard band across the room floor
    b.box('hazard', x0 + 0.2, Y + 0.02, 36.3, x1 - 0.2, Y + 0.03, 36.7, 0xffffff, 1, { ao: 0 });
    void inner;
  };
  room(-18, -11, 1);
  room(11, 18, -1);

  const frame = (pos: THREE.Vector3, normal: THREE.Vector3, kind: RiftEndKind): RiftFrame & { kind: RiftEndKind } => ({
    position: pos.clone(),
    quaternion: orientFrame(normal, V(0, 1, 0)),
    width: 1.4,
    height: 2.4,
    kind,
  });
  const wave = (side: 1 | -1, w: number): SpawnDef[] => {
    const x = side < 0 ? -13 : 13;
    const tag = side < 0 ? 'gw' : 'ge';
    const yaw = side < 0 ? YAW.W : YAW.E;
    const mk = (i: number, kind: SpawnDef['kind'], px: number, pz: number) => spawn(Z, `${tag}.${w}.${i}`, kind, px, Y, pz, yaw, tag, { state: 'combat' });
    if (w === 0) return [mk(0, 'rifleman', x, 38.6), mk(1, 'rifleman', x, 43.4)];
    if (w === 1) return [mk(0, 'grenadier', x, 38.6), mk(1, 'rifleman', x + side * 1.5, 41)];
    return [mk(0, 'warden', x, 41), mk(1, 'rifleman', x, 43.4), mk(2, 'rifleman', x, 38.6)];
  };
  const gates: GateDef[] = [
    {
      id: 'lab.gate.west',
      zone: Z,
      inFrame: frame(V(-17.2, Y + 1.2, 41), V(1, 0, 0), 'stand'),
      outFrame: frame(V(-10.93, Y + 1.2, 41), V(1, 0, 0), 'wall'),
      panel: V(-10.4, Y, 38.3),
      waves: [wave(-1, 0), wave(-1, 1), wave(-1, 2)],
    },
    {
      id: 'lab.gate.east',
      zone: Z,
      inFrame: frame(V(17.2, Y + 1.2, 41), V(-1, 0, 0), 'stand'),
      outFrame: frame(V(10.93, Y + 1.2, 41), V(-1, 0, 0), 'wall'),
      panel: V(10.4, Y, 38.3),
      waves: [wave(1, 0), wave(1, 1), wave(1, 2)],
    },
  ];
  for (const g of gates) {
    gateArch(ctx, g.inFrame.position, g.inFrame.quaternion, false);
    gateArch(ctx, g.outFrame.position, g.outFrame.quaternion, true);
    // hijack console on the staging wall beside the out-end
    const s = Math.sign(g.panel.x);
    const wx = s < 0 ? -11 : 11;
    b.box('metal', wx - (s < 0 ? 0 : 0.18), Y + 0.9, g.panel.z - 0.45, wx + (s < 0 ? 0.18 : 0), Y + 1.7, g.panel.z + 0.45, 0x22282e, 1, { ao: 0 });
    b.box('emissive', s < 0 ? wx + 0.18 : wx - 0.19, Y + 1.0, g.panel.z - 0.35, s < 0 ? wx + 0.19 : wx - 0.18, Y + 1.6, g.panel.z + 0.35, new THREE.Color(2.6, 0.5, 0.3), 1, { ao: 0 });
  }

  // ---------------- partitions ----------------
  // z = 46 between the arena and the north halls: doorway (-9..-5), laser door (5..9)
  solid(ctx, 'panel', -11, Y, 45.85, -9, C - 0.3, 46, wallC, 2.4, { tag: 'wall' });
  solid(ctx, 'panel', 9, Y, 45.85, 11, C - 0.3, 46, wallC, 2.4, { tag: 'wall' });
  col(ctx, -5, Y, 45.88, 5, C - 0.3, 45.98, { tag: 'glass' });
  b.box('glass', -5, Y + 0.05, 45.9, 5, C - 0.3, 45.96, 0xffffff, 3, { ao: 0 });
  for (let x = -5; x <= 5.01; x += 2.5) b.box('metal', x - 0.04, Y, 45.86, x + 0.04, C - 0.3, 46, 0x2a3036, 1, { ao: 0 });
  b.box('metal', -5, Y, 45.86, 5, Y + 0.1, 46, 0x2a3036, 1, { ao: 0 });
  // laser door emitters
  for (const x of [4.8, 9]) b.box('metal', x, Y, 45.8, x + 0.2, Y + 2.6, 46.05, 0x22282e, 1, { ao: 0 });
  b.box('hazard', 5, Y + 0.02, 45.6, 9, Y + 0.03, 46.2, 0xffffff, 1, { ao: 0 });
  // x = 0 between the server hall and the gallery: doorway z 50..53
  solid(ctx, 'panel', -0.08, Y, 46, 0.08, C - 0.3, 50, wallC, 2.4, { tag: 'wall' });
  solid(ctx, 'panel', -0.08, Y, 53, 0.08, C - 0.3, T.z1 - 0.12, wallC, 2.4, { tag: 'wall' });

  // ---------------- arena (hijack): reactor, benches, observation deck ----------------
  reactor(ctx, 0, 36);
  const bench = (x0: number, z0: number, x1: number, z1: number) => {
    solid(ctx, 'panel', x0, Y, z0, x1, Y + 1.0, z1, 0xdadcde, 2.4, { tag: 'bench' });
    b.box('metal', x0 - 0.02, Y + 0.95, z0 - 0.02, x1 + 0.02, Y + 1.02, z1 + 0.02, 0x2a3036, 1, { ao: 0 });
    b.box('emissive', x0 + 0.3, Y + 1.02, (z0 + z1) / 2 - 0.2, x0 + 0.9, Y + 1.4, (z0 + z1) / 2 + 0.2, new THREE.Color(0.4, 1.6, 2.2), 1, { ao: 0 });
  };
  bench(-8, 28, -4, 29);
  bench(4, 43, 8, 44);
  bench(-6.5, 39, -3.5, 40);
  bench(5, 32.5, 8.5, 33.5);
  // observation deck (height in the lab) + glass balustrade
  solid(ctx, 'panel', 2, Y, 22.5, 10, Y + 2.6, 26.5, 0xcfd3d6, 2.4, { tag: 'deck' });
  b.box('metal', 2, Y + 2.6, 22.5, 10, Y + 2.62, 26.5, 0x3a4048, 1, { ao: 0 });
  col(ctx, 2, Y + 2.6, 26.35, 7.5, Y + 3.7, 26.5, { seeThrough: true, noPortal: true, tag: 'rail' });
  b.box('glass', 2, Y + 2.62, 26.4, 7.5, Y + 3.6, 26.45, 0xffffff, 2, { ao: 0 });
  b.box('metal', 2, Y + 3.6, 26.36, 7.5, Y + 3.68, 26.5, 0xb0b8c0, 1, { ao: 0 });
  // open facade bays: low railings over the void
  for (const x of [T.x0 + 0.1, T.x1 - 0.1]) {
    railing(ctx, x, 28, x, 34, Y, { color: PALETTE.orange });
    b.box('hazard', x - 0.25, Y + 0.02, 28, x + 0.25, Y + 0.035, 34, 0xffffff, 1, { ao: 0, uvRotate: true });
  }

  // ---------------- north-west server hall (two riflemen) ----------------
  for (const z0 of [49.2, 53.2]) serverRow(ctx, -15, z0, -4, z0 + 1);
  // ---------------- north-east gallery (turret) ----------------
  crateStatic(ctx, 6, 50.5, 1.3, 1.2, Y, 0xd0d4d8);
  crateStatic(ctx, 10.5, 52.5, 1.2, 1.0, Y, 0xd0d4d8);
  crateStatic(ctx, 16, 51.6, 1.3, 1.2, Y, 0xd0d4d8);
  // exit door frame (glass lift)
  b.box('emissive', GLASS_LIFT.cage.x0, Y + 2.9, T.z1 - 0.2, GLASS_LIFT.cage.x1, Y + 3.0, T.z1, new THREE.Color(0.3, 2.4, 3), 1, { ao: 0 });

  // ---------------- props ----------------
  const barrel = V(0.6, 0.9, 0.6);
  for (const [x, z] of [[-9.6, 31.5], [9.2, 36.8], [-2, 55.5], [13.2, 47.4]]) addProp(ctx, 'barrel', V(x, Y, z), barrel, { explosive: true });
  addProp(ctx, 'crate', V(-4.5, Y, 36.4), V(1.2, 1.2, 1.2));

  // ---------------- hazards / lasers ----------------
  const hazards: HazardDef[] = [{ id: 'lab.hazard.trench', zone: Z, kind: 'electric', box: box3(-14, Y, 50.5, -5, Y + 1.2, 52.9), period: 3 }];
  b.box('metal', -14, Y + 0.02, 50.5, -5, Y + 0.035, 52.9, 0x1a1e22, 1, { ao: 0 });
  b.box('emissive', -14, Y + 0.035, 51.62, -5, Y + 0.045, 51.78, new THREE.Color(0.5, 1.4, 3.2), 1, { ao: 0 });
  const lasers: LaserDef[] = [];
  for (const [i, y] of [0.35, 0.9, 1.45, 2.0].entries()) lasers.push({ id: `lab.laser.door.${i}`, zone: Z, from: V(5, Y + y, 45.93), dir: V(1, 0, 0), length: 4 });
  for (const [i, y] of [0.5, 1.3].entries()) lasers.push({ id: `lab.laser.aisle.${i}`, zone: Z, from: V(T.x0 + 0.15, Y + y, 47.6), dir: V(1, 0, 0), length: 2.8 });
  b.box('metal', -15.05, Y, 47.4, -14.85, Y + 1.8, 47.8, 0x22282e, 1, { ao: 0 });

  // ---------------- encounters ----------------
  const encounters = [
    encounter(
      Z,
      'hijack',
      box3(T.x0, Y - 0.5, T.z0, T.x1, C, 30),
      [spawn(Z, 'hijack.w', 'warden', 0, Y, 44, YAW.S, 'hijack'), spawn(Z, 'hijack.a', 'rifleman', -7, Y, 34, YAW.S, 'hijack'), spawn(Z, 'hijack.b', 'rifleman', 7, Y, 30.5, YAW.S, 'hijack')],
      true,
      { pos: V(-7, Y, 44.5), yaw: YAW.N },
    ),
    fight(
      Z,
      'hall',
      box3(T.x0, Y - 0.5, 46.2, -0.2, C, T.z1),
      [spawn(Z, 'hall.a', 'rifleman', -16.5, Y, 51.5, YAW.E, 'hall'), spawn(Z, 'hall.b', 'rifleman', -2, Y, 52, YAW.W, 'hall')],
      true,
      { pos: V(-2, Y, 48), yaw: YAW.E },
    ),
    encounter(
      Z,
      'borrowedGun',
      box3(0.2, Y - 0.5, 46.2, T.x1, C, T.z1),
      [spawn(Z, 'bg.turret', 'turret', 14, Y, 55, -2.4, 'bg', { perch: true }), spawn(Z, 'bg.a', 'rifleman', 4, Y, 55, YAW.S, 'bg'), spawn(Z, 'bg.b', 'rifleman', 15, Y, 49, YAW.W, 'bg')],
      true,
      { pos: V(10, Y, 56.5), yaw: YAW.N },
    ),
  ];

  const exit = glassLift(ctx, 'lab.lift', GLASS_LIFT.cage, GLASS_LIFT.from, GLASS_LIFT.to, encounters.map((e) => e.id), 'crown');

  const zone: ZoneDef = {
    id: Z,
    nameKey: 'zone.lab.name',
    subKey: 'zone.lab.sub',
    bounds: box3(-40, 59.5, 5, 40, 72, 75),
    nav: [
      { minX: T.x0, maxX: T.x1, minZ: T.z0, maxZ: T.z1, floorY: Y },
      { minX: 2, maxX: 10, minZ: 22.5, maxZ: 26.5, floorY: Y + 2.6 },
    ],
    playerStart: V(-3.55, Y, 24),
    startYaw: YAW.N,
    killY: 50,
    sea: false,
    encounters,
    exit,
    challenges: ['lab.1', 'lab.2', 'lab.3'],
  };
  return { zone, gates, hazards, lasers };
}

/** Kessler gate arch around a frame (visual only). `onWall`: mounted flush. */
function gateArch(ctx: Ctx, pos: THREE.Vector3, q: THREE.Quaternion, onWall: boolean) {
  const b = ctx.mb;
  const m = new THREE.Matrix4();
  const place = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, key: string, color: THREE.ColorRepresentation) => {
    m.compose(V(lx, ly, lz).applyQuaternion(q).add(pos), q, V(1, 1, 1));
    b.obox(key, m, sx, sy, sz, color, 1);
  };
  const w = 0.95, h = 1.4;
  const d = onWall ? 0.12 : 0.35;
  const lz = onWall ? -0.05 : 0;
  place(-w - 0.15, 0, lz, 0.3, 2.8, d, 'metal', 0x1e2328);
  place(w + 0.15, 0, lz, 0.3, 2.8, d, 'metal', 0x1e2328);
  place(0, h + 0.1, lz, 2.5, 0.3, d, 'metal', 0x1e2328);
  place(-w, 0, lz + 0.02, 0.06, 2.5, d + 0.02, 'emissive', new THREE.Color(3.2, 0.35, 0.25));
  place(w, 0, lz + 0.02, 0.06, 2.5, d + 0.02, 'emissive', new THREE.Color(3.2, 0.35, 0.25));
  place(0, h - 0.05, lz + 0.02, 1.96, 0.06, d + 0.02, 'emissive', new THREE.Color(3.2, 0.35, 0.25));
  if (!onWall) place(0, -1.15, 0, 2.6, 0.1, 1.4, 'metal', 0x2a3036);
}

/** Row of server racks with status LEDs (cover). */
function serverRow(ctx: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const b = ctx.mb;
  col(ctx, x0, Y, z0, x1, Y + 2.2, z1, { tag: 'rack' });
  b.box('metal', x0, Y, z0, x1, Y + 2.2, z1, 0x1c2026, 1.2, { ao: 0.4 });
  const n = Math.round((x1 - x0) / 0.62);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.1 + i * 0.62;
    b.box('metal', x, Y + 0.1, z0 - 0.02, x + 0.5, Y + 2.1, z0, 0x2a3038, 1, { ao: 0 });
    b.box('metal', x, Y + 0.1, z1, x + 0.5, Y + 2.1, z1 + 0.02, 0x2a3038, 1, { ao: 0 });
    if (ctx.mobile) continue;
    for (let k = 0; k < 4; k++) {
      const y = Y + 0.5 + k * 0.4;
      const c = (i + k) % 3 === 0 ? new THREE.Color(0.3, 2.6, 0.6) : (i + k) % 3 === 1 ? new THREE.Color(0.3, 1.6, 3) : new THREE.Color(2.4, 1.4, 0.2);
      b.box('emissive', x + 0.05, y, z0 - 0.03, x + 0.12, y + 0.04, z0 - 0.02, c, 1, { ao: 0 });
      b.box('emissive', x + 0.38, y, z1 + 0.02, x + 0.45, y + 0.04, z1 + 0.03, c, 1, { ao: 0 });
    }
  }
}

/** The rift reactor: plinth, spinning rings and a glowing core. */
function reactor(ctx: Ctx, x: number, z: number) {
  const b = ctx.mb;
  col(ctx, x - 2.2, Y, z - 2.2, x + 2.2, Y + 3.8, z + 2.2, { tag: 'reactor' });
  b.box('metal', x - 2.2, Y, z - 2.2, x + 2.2, Y + 0.6, z + 2.2, 0x22282e, 1.5, { ao: 0.4 });
  b.box('metal', x - 1.6, Y + 0.6, z - 1.6, x + 1.6, Y + 0.9, z + 1.6, 0x3a4048, 1.5, { ao: 0 });
  b.box('emissive', x - 2.22, Y + 0.45, z - 2.22, x + 2.22, Y + 0.5, z + 2.22, new THREE.Color(0.3, 2.4, 3), 1, { ao: 0 });
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) b.box('metal', x + dx - 0.12, Y + 0.9, z + dz - 0.12, x + dx + 0.12, Y + 3.8, z + dz + 0.12, 0x2a3036, 1, { ao: 0 });
  b.box('metal', x - 1.7, Y + 3.8, z - 1.7, x + 1.7, Y + 4.1, z + 1.7, 0x2a3036, 1, { ao: 0 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.2, 3.8) }));
  core.position.set(x, Y + 2.35, z);
  ctx.zoneRoot.add(core);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.9, roughness: 0.25, envMap: (ctx.materials.metal as THREE.MeshStandardMaterial).envMap, emissive: new THREE.Color(0.05, 0.3, 0.4) });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.15 + i * 0.22, 0.06, 8, ctx.mobile ? 24 : 48), ringMat);
    r.position.copy(core.position);
    ctx.zoneRoot.add(r);
    rings.push(r);
  }
  ctx.animated.push((t) => {
    rings[0].rotation.set(t * 0.9, t * 0.5, 0);
    rings[1].rotation.set(-t * 0.6, 0, t * 0.8);
    const s = 1 + Math.sin(t * 3.1) * 0.06;
    core.scale.setScalar(s);
  });
}
