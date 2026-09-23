import * as THREE from 'three';
import * as TX from '../textures';
import { LAW, type ZoneDef } from '../../core/contracts';
import { CONT, Ctx, PALETTE, V, addProp, box3, col, solid } from './kit';
import { bollard, cabin, container, crateStatic, hoarding, lampPole, scaffold } from './parts';
import { CRANE, HOIST, TOWER } from './layout';
import { YAW, encounter, spawn } from './zonekit';
import { hoistLift } from './lifts';

/**
 * ZONE 2: THE YARD (y 0 - 24). The construction site around the tower base,
 * sea on the west and east edges. A loop around the tower:
 *   cargo (SE, under the tower crane's two loads) -> matador (E, brute by the
 *   water) -> grenade (N, grenadier on the site cabins) -> shield (W, warden
 *   with a rifleman up the scaffold) -> the hoist on the south face.
 */
export function buildYard(ctx: Ctx): ZoneDef {
  const b = ctx.mb;
  const Z = 'yard' as const;

  // ---------------- ground ----------------
  col(ctx, -40, -3, 0, 40, 0, 76, { tag: 'ground' });
  b.box('ground', -40, -0.25, 0, 40, 0, 76, 0xffffff, 6, { skipBottom: true, ao: 0 });
  b.box('concrete', -40.02, -3.2, 0, 40.02, -0.25, 76.02, 0x8e887e, 3, { skipTop: true, ao: 0 });
  const cope = 0xc9c3b8;
  b.box('concrete', -40.05, -0.25, 0, -39.4, 0.012, 76.05, cope, 1.5, { ao: 0, skipBottom: true });
  b.box('concrete', 39.4, -0.25, 0, 40.05, 0.012, 76.05, cope, 1.5, { ao: 0, skipBottom: true });
  b.box('concrete', -40.05, -0.25, 75.4, 40.05, 0.012, 76.05, cope, 1.5, { ao: 0, skipBottom: true });
  b.box('paint', -39.3, 0, 0.5, -39.15, 0.016, 75.3, 0xf2c21c, 1, { ao: 0 });
  b.box('paint', 39.15, 0, 0.5, 39.3, 0.016, 75.3, 0xf2c21c, 1, { ao: 0 });
  // concrete haul road: gate -> tower, and the tower's ground floor slab
  b.box('paving', -6, 0, 0.4, 6, 0.02, TOWER.z0, 0xe8e4dc, 4, { ao: 0, skipBottom: true });
  b.box('paving', -12, 0, 14, -6, 0.02, TOWER.z0, 0xe8e4dc, 4, { ao: 0, skipBottom: true });
  b.box('paving', TOWER.x0 - 1, 0, TOWER.z0, TOWER.x1 + 1, 0.02, TOWER.z1 + 1, 0xd8d4cc, 4, { ao: 0, skipBottom: true });
  for (const z of [4, 10, 16]) b.box('paint', -0.1, 0.02, z, 0.1, 0.03, z + 3, 0xf0ece0, 1, { ao: 0 });

  for (const z of [8, 18, 28, 38, 48, 58, 68]) {
    bollard(ctx, -39.55, z);
    bollard(ctx, 39.55, z);
  }

  // ---------------- site hoarding + gate ----------------
  hoarding(ctx, -40, 0.3, -5.4, 0.3);
  hoarding(ctx, 5.4, 0.3, 40, 0.3);
  hoarding(ctx, -40, 75.7, 40, 75.7);
  for (const x of [-5.2, 5.2]) {
    solid(ctx, 'hazard', x - 0.2, 0, 0.1, x + 0.2, 4.6, 0.5, 0xffffff, 1, { tag: 'gatepost' });
  }
  b.box('steel', -5.4, 4.2, 0.15, 5.4, 4.6, 0.45, PALETTE.kessler, 2, { ao: 0 });
  // swung-open gate leaves
  b.box('metal', 5.45, 0.1, 0.6, 5.55, 2.8, 5.4, 0x5b6470, 1, { ao: 0.3 });
  b.box('metal', -5.55, 0.1, 0.6, -5.45, 2.8, 5.4, 0x5b6470, 1, { ao: 0.3 });
  col(ctx, 5.4, 0, 0.6, 5.6, 2.8, 5.4, { tag: 'gate', seeThrough: true, noPortal: true });
  col(ctx, -5.6, 0, 0.6, -5.4, 2.8, 5.4, { tag: 'gate', seeThrough: true, noPortal: true });
  if (!ctx.headless) {
    // banner over the gate + on the hoarding (pier side)
    const tex = TX.signText('KESSLER THRESHOLD TOWER', { w: 1024, h: 96, color: '#f4f0e6', bg: '#1d2a38', font: '900 58px "Arial Black", Impact, sans-serif' });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 });
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 0.98), mat);
    ban.position.set(0, 4.4, 0.13);
    ban.rotation.y = Math.PI;
    ctx.zoneRoot.add(ban);
    const tex2 = TX.signText('KESSLER  //  AUTHORISED PERSONNEL ONLY', { w: 1024, h: 128, color: '#f2b21c', font: '900 58px "Arial Black", Impact, sans-serif' });
    const mat2 = new THREE.MeshStandardMaterial({ map: tex2, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const x of [-24, 24]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), mat2);
      p.position.set(x, 1.7, 0.2);
      p.rotation.y = Math.PI;
      ctx.zoneRoot.add(p);
    }
  }

  // ---------------- scaffolds ----------------
  // S1: south yard, height for the cargo fight
  scaffold(ctx, { x0: 10, x1: 16, z0: 12, z1: 14.5, y0: 0, levels: [4, 8, 12], bay: '-x', outer: ['-z', '+z', '+x'], net: true });
  // S2: against the podium's west face (a rifleman on the 8 m deck)
  scaffold(ctx, { x0: -23, x1: -19, z0: 24, z1: 36, y0: 0, levels: [4, 8, 12], bay: '+z', outer: ['-x', '-z'], net: true });
  // S3: against the north face (height over the grenade fight)
  scaffold(ctx, { x0: -10, x1: 2, z0: 59, z1: 62, y0: 0, levels: [4, 8, 12], bay: '+x', outer: ['+z', '-x'], net: true });

  // ---------------- site cabins ----------------
  cabin(ctx, -38, 0, 3.5, true, 6, 0xe9e6de);
  cabin(ctx, -38, 2.7, 3.5, true, 6, 0xdad6cc);
  cabin(ctx, -31.6, 0, 3.5, true, 6, 0xe9e6de);
  // north block: the grenadier's roost (roof at 5.4)
  cabin(ctx, -9, 0, 70, true, 6, 0xe4e0d6);
  cabin(ctx, -2.6, 0, 70, true, 6, 0xe9e6de);
  cabin(ctx, 3.8, 0, 70, true, 6, 0xe4e0d6);
  cabin(ctx, -9, 2.7, 70, true, 6, 0xf0ece4);
  cabin(ctx, -2.6, 2.7, 70, true, 6, 0xf0ece4);
  // roof railing on the upper cabins (see-through)
  col(ctx, -9, 5.4, 72.4, 3.4, 6.4, 72.55, { seeThrough: true, noPortal: true, tag: 'rail' });
  b.box('steel', -9, 6.3, 72.4, 3.4, 6.4, 72.55, PALETTE.crane, 1, { ao: 0 });
  for (let x = -9; x <= 3.4; x += 2.07) b.box('steel', x, 5.4, 72.42, x + 0.06, 6.4, 72.52, PALETTE.crane, 1, { ao: 0 });
  // portable toilets
  for (let i = 0; i < 3; i++) solid(ctx, 'container', -38.6 + i * 1.3, 0, 60, -37.4 + i * 1.3, 2.3, 61.2, 0x2a64b8, 1.2, { tag: 'toilet' }, { skipBottom: true });

  // ---------------- materials, trucks, cover ----------------
  const C = PALETTE.containers;
  // storage containers along the west quay
  container(ctx, -39.6, 0, 20, false, CONT.L40, C[1]);
  container(ctx, -39.6, CONT.H, 20, false, CONT.L20, C[6]);
  // site container in the east strip (matador cover)
  container(ctx, 20, 0, 50, true, CONT.L20, C[10]);
  // steel beam stack (cargo area)
  beamStack(ctx, 18, 16, 24, 18);
  beamStack(ctx, -16, 8, -10, 10);
  // rebar bundles (north)
  solid(ctx, 'steel', -16, 0, 64, -10, 0.6, 66, 0x7a4a32, 1, { tag: 'rebar' }, { skipBottom: true });
  for (let i = 0; i < 6; i++) b.box('steel', -16, 0.6, 64.1 + i * 0.3, -10, 0.64, 64.2 + i * 0.3, 0x4a2e22, 1, { ao: 0 });
  // formwork panel stacks (matador cover)
  solid(ctx, 'wood', 20, 0, 46, 23, 1.4, 48.4, 0xd8b068, 1.2, { tag: 'formwork' }, { skipBottom: true });
  solid(ctx, 'wood', 34, 0, 56, 36.4, 1.1, 59, 0xd8b068, 1.2, { tag: 'formwork' }, { skipBottom: true });
  // pipe stack (north-east)
  pipeStack(ctx, 28, 62, 36, 64);
  // brick pallets
  for (const [x, z] of [[14, 70], [15.4, 70], [14.7, 71.4], [-22, 56], [-20.6, 56], [-12, 30], [8, 50]]) crateStatic(ctx, x, z, 1.15, 1.1, 0, 0xc4704a);
  crateStatic(ctx, 16, 6, 1.3, 1.25);
  crateStatic(ctx, -24, 12, 1.3, 1.25);
  crateStatic(ctx, 36, 30, 1.3, 1.25);
  // skip bin
  skip(ctx, 34, 14);
  // cable reels (east strip)
  reel(ctx, 32, 40);
  reel(ctx, 24.5, 42);
  // concrete mixer truck (north-west)
  mixer(ctx, -25.25, 63.4);

  // ---------------- lamps ----------------
  lampPole(ctx, -37, 10, 12, V(-20, 0, 24), 0xffd09a, 26, 0.8);
  lampPole(ctx, 37, 2.5, 12, V(22, 0, 12), 0xffd09a, 26, 0.8);
  lampPole(ctx, -37, 72, 12, V(-16, 0, 62), 0xffd09a, 26, 0.8);
  lampPole(ctx, 37, 72, 12, V(18, 0, 62), 0xffd09a, 26, 0.8);

  // ---------------- props ----------------
  const hookY = CRANE.jibY - 0.35;
  addProp(ctx, 'beamBundle', V(CRANE.x, 10, CRANE.trolleys[0]), V(6, 0.9, 1.3), { hangFrom: V(CRANE.x, hookY, CRANE.trolleys[0]), id: 'yard.hang.beams' });
  addProp(ctx, 'container', V(CRANE.x, 11.5, CRANE.trolleys[1]), V(CONT.L20, CONT.H, CONT.W), { hangFrom: V(CRANE.x, hookY, CRANE.trolleys[1]), id: 'yard.hang.container' });
  const barrel = V(0.6, 0.9, 0.6);
  for (const [x, z] of [[31.2, 10.6], [31.9, 11.3], [22.5, 6.5], [30.5, 44.5], [21.8, 44], [12, 66.5], [12.7, 67.1], [-12, 68], [-28.5, 26.2], [-33, 40.5]]) addProp(ctx, 'barrel', V(x, 0, z), barrel, { explosive: true });
  addProp(ctx, 'crate', V(16, 0, 3.5), V(1.2, 1.2, 1.2));
  addProp(ctx, 'crate', V(-24, 0, 50), V(1.2, 1.2, 1.2), { yaw: 0.3 });

  // ---------------- encounters ----------------
  const encounters = [
    encounter(
      Z,
      'cargo',
      box3(-40, -1, 0.5, 40, 16, 10),
      [
        spawn(Z, 'cargo.a', 'rifleman', CRANE.x - 1.2, 0, CRANE.trolleys[0], YAW.E, 'cargo'),
        spawn(Z, 'cargo.b', 'rifleman', CRANE.x + 0.2, 0, CRANE.trolleys[0], YAW.W, 'cargo'),
        spawn(Z, 'cargo.c', 'rifleman', 22, 0, CRANE.trolleys[1], YAW.E, 'cargo', { state: 'patrol', route: [V(22, 0, 3), V(33, 0, 3)], wait: [2, 2] }),
      ],
      true,
      { pos: V(14, 0, 8), yaw: YAW.N },
    ),
    encounter(
      Z,
      'matador',
      box3(18.5, -1, 16, 40, 16, 58),
      [spawn(Z, 'matador.brute', 'brute', 35, 0, 46, YAW.W, 'matador'), spawn(Z, 'matador.a', 'rifleman', 30, 0, 54, YAW.S, 'matador')],
      true,
      { pos: V(30, 0, 36), yaw: YAW.N },
    ),
    encounter(
      Z,
      'grenade',
      box3(-40, -1, 58.5, 40, 16, 76),
      [
        spawn(Z, 'grenade.g', 'grenadier', 0.4, 5.4, 71.25, YAW.S, 'grenade'),
        spawn(Z, 'grenade.a', 'rifleman', -8, 0, 64, YAW.S, 'grenade'),
        spawn(Z, 'grenade.b', 'rifleman', 10, 0, 65, -2.6, 'grenade'),
      ],
      true,
      { pos: V(-14, 0, 62), yaw: YAW.W },
    ),
    encounter(
      Z,
      'shield',
      box3(-40, -1, 16, -18.5, 16, 58),
      [
        spawn(Z, 'shield.w', 'warden', -30, 0, 46, YAW.N, 'shield'),
        spawn(Z, 'shield.a', 'rifleman', -26, 0, 30, YAW.N, 'shield'),
        spawn(Z, 'shield.b', 'rifleman', -35, 0, 22, YAW.N, 'shield', { state: 'patrol', route: [V(-35, 0, 22), V(-35, 0, 40)], wait: [2, 2] }),
        spawn(Z, 'shield.c', 'rifleman', -21, 8, 30, YAW.W, 'shield'),
      ],
      true,
      { pos: V(-14, 0, 14), yaw: YAW.E },
    ),
  ];

  const exit = hoistLift(ctx, 'yard.hoist', HOIST.cageA, HOIST.aFrom, HOIST.aTo, encounters.filter((e) => e.requireClear).map((e) => e.id), 'skeleton');

  return {
    id: Z,
    nameKey: 'zone.yard.name',
    subKey: 'zone.yard.sub',
    bounds: box3(-70, -6, 0, 70, 23.5, 100),
    nav: [
      { minX: -40, maxX: 40, minZ: 0, maxZ: 76, floorY: 0 },
      { minX: -23, maxX: -19, minZ: 24, maxZ: 36, floorY: 8 },
      { minX: -9, maxX: 3.4, minZ: 70, maxZ: 72.5, floorY: 5.4 },
    ],
    playerStart: V(0, 0, 3),
    startYaw: YAW.N,
    killY: LAW.seaY,
    sea: true,
    encounters,
    exit,
    challenges: ['yard.1', 'yard.2', 'yard.3'],
  };
}

function beamStack(ctx: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const b = ctx.mb;
  col(ctx, x0, 0, z0, x1, 0.9, z1, { tag: 'beams' });
  // timber bearers + three layers of I-beams
  for (const x of [x0 + 0.5, (x0 + x1) / 2, x1 - 0.8]) b.box('wood', x, 0, z0 - 0.1, x + 0.3, 0.15, z1 + 0.1, 0x8a6a4a, 1, { ao: 0.3 });
  const n = Math.max(2, Math.floor((z1 - z0) / 0.42));
  for (let layer = 0; layer < 3; layer++) {
    const y = 0.15 + layer * 0.25;
    for (let i = 0; i < n; i++) {
      const z = z0 + 0.2 + i * ((z1 - z0 - 0.4) / Math.max(1, n - 1));
      if (ctx.mobile) b.box('steel', x0, y, z - 0.15, x1, y + 0.24, z + 0.15, PALETTE.primer, 1.5, { ao: 0 });
      else b.ibeam('steel', V(x0, y + 0.12, z), V(x1, y + 0.12, z), 0.3, 0.24, PALETTE.primer, 1.5);
    }
  }
}

function pipeStack(ctx: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const b = ctx.mb;
  col(ctx, x0, 0, z0, x1, 1.2, z1, { tag: 'pipes' });
  const r = 0.28;
  let row = 0;
  for (let y = r; y < 1.2; y += r * 1.75, row++) {
    for (let z = z0 + r + (row % 2) * r; z <= z1 - r + 1e-3; z += r * 2.05) {
      if (ctx.mobile) b.box('metal', x0, y - r, z - r, x1, y + r, z + r, 0x6d7074, 2, { ao: 0 });
      else b.cylinder('metal', V(x0, y, z), V(x1, y, z), r, 0x6d7074, 12, 2, true);
    }
  }
}

function skip(ctx: Ctx, x: number, z: number) {
  const b = ctx.mb;
  const w = 1.8, l = 3.6, h = 1.5;
  col(ctx, x - l / 2, 0, z - w / 2, x + l / 2, h, z + w / 2, { tag: 'skip' });
  const c = 0xe0a020;
  b.box('steel', x - l / 2, 0, z - w / 2, x + l / 2, 0.2, z + w / 2, c, 1.5);
  b.box('steel', x - l / 2, 0, z - w / 2, x + l / 2, h, z - w / 2 + 0.08, c, 1.5);
  b.box('steel', x - l / 2, 0, z + w / 2 - 0.08, x + l / 2, h, z + w / 2, c, 1.5);
  b.box('steel', x - l / 2, 0, z - w / 2, x - l / 2 + 0.08, h, z + w / 2, c, 1.5);
  b.box('steel', x + l / 2 - 0.08, 0, z - w / 2, x + l / 2, h, z + w / 2, c, 1.5);
  b.box('concrete', x - l / 2 + 0.1, 0.2, z - w / 2 + 0.1, x + l / 2 - 0.1, 0.9, z + w / 2 - 0.1, 0x8a8076, 1, { ao: 0.5 });
}

function reel(ctx: Ctx, x: number, z: number) {
  const b = ctx.mb;
  const r = 0.95, w = 0.9;
  col(ctx, x - w / 2, 0, z - r, x + w / 2, r * 2, z + r, { tag: 'reel' });
  if (ctx.mobile) {
    b.box('wood', x - w / 2, 0, z - r, x + w / 2, r * 2, z + r, 0xb88a58, 1);
    return;
  }
  b.cylinder('wood', V(x - w / 2, r, z), V(x - w / 2 + 0.08, r, z), r, 0xb88a58, 16, 1);
  b.cylinder('wood', V(x + w / 2 - 0.08, r, z), V(x + w / 2, r, z), r, 0xb88a58, 16, 1);
  b.cylinder('metal', V(x - w / 2 + 0.08, r, z), V(x + w / 2 - 0.08, r, z), r * 0.72, 0x1c1d20, 16, 1);
}

/** Concrete mixer truck with a turning drum (drum is its own mesh). */
function mixer(ctx: Ctx, x: number, z: number) {
  const b = ctx.mb;
  const L = 9.5;
  const x0 = x - L / 2;
  col(ctx, x0, 0, z - 1.3, x0 + L, 3.6, z + 1.3, { tag: 'truck' });
  // chassis + wheels
  b.box('metal', x0 + 0.3, 0.55, z - 1.1, x0 + L - 0.2, 1.1, z + 1.1, 0x2b2e33, 1);
  for (const dx of [1.3, 5.6, 7.1, 8.6]) for (const s of [-1, 1]) {
    if (ctx.mobile) b.box('metal', x0 + dx - 0.55, 0, z + s * 1.25 - 0.2, x0 + dx + 0.55, 1.1, z + s * 1.25 + 0.2, 0x151618, 1, { ao: 0 });
    else b.cylinder('metal', V(x0 + dx, 0.55, z + s * 1.0), V(x0 + dx, 0.55, z + s * 1.3), 0.55, 0x151618, 14, 1);
  }
  // cab (front = -x)
  b.box('steel', x0, 0.9, z - 1.25, x0 + 2.4, 3.2, z + 1.25, 0xf0f0ea, 1.5, { ao: 0.3 });
  b.box('facade', x0 - 0.02, 2.0, z - 1.1, x0 + 0.05, 3.0, z + 1.1, 0xffffff, 6, { ao: 0 });
  b.box('steel', x0 - 0.05, 0.9, z - 1.26, x0 + 2.45, 1.3, z + 1.26, PALETTE.orange, 1, { ao: 0 });
  // drum
  const drumG = new THREE.CylinderGeometry(1.1, 1.35, 5.2, ctx.mobile ? 10 : 18, 1, false);
  drumG.rotateZ(Math.PI / 2 - 0.22);
  const drumMat = ctx.materials.steel;
  const drum = new THREE.Mesh(drumG, drumMat);
  // vertex colours: orange drum with a white spiral band
  const pos = drumG.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color(PALETTE.orange), c2 = new THREE.Color(0xf0efe8);
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getY(i));
    const band = Math.sin(a * 2 + pos.getX(i) * 1.6) > 0.55;
    const c = band ? c2 : c1;
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  drumG.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  drum.position.set(x0 + 5.6, 2.45, z);
  drum.castShadow = drum.receiveShadow = true;
  drum.name = 'mixer:drum';
  ctx.zoneRoot.add(drum);
  const axis = new THREE.Vector3(Math.cos(-0.22), Math.sin(-0.22), 0).normalize();
  const q0 = drum.quaternion.clone();
  ctx.animated.push((t) => {
    drum.quaternion.copy(q0).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, t * 0.9));
  });
  // drum cradle + chute
  b.box('metal', x0 + 3.0, 1.1, z - 0.9, x0 + 3.4, 2.8, z + 0.9, 0x3a3e44, 1, { ao: 0 });
  b.box('metal', x0 + 8.2, 1.1, z - 0.6, x0 + 8.6, 3.3, z + 0.6, 0x3a3e44, 1, { ao: 0 });
  b.beam('metal', V(x0 + 8.8, 2.2, z), V(x0 + 9.6, 1.4, z + 0.8), 0.3, 0.12, 0x5a5e62, 1);
}
