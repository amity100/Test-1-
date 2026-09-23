import * as THREE from 'three';
import * as TX from '../textures';
import { LAW, type ZoneDef } from '../../core/contracts';
import { CONT, Ctx, PALETTE, V, addProp, box3, col, solid } from './kit';
import { bollard, container, crateStatic, jersey, lampPole } from './parts';
import { BARGE } from './layout';
import { HARBOUR_CRANE } from './structure';
import { YAW, encounter, spawn } from './zonekit';

/**
 * ZONE 1: THE PIER (y 0). A quay 80 x 50 m with sea on three sides. The
 * player starts on a jetty across a 6 m channel.
 *
 *   (a) door        jetty -> quay across the channel (no enemies)
 *   (b) trapdoor    two unaware riflemen chatting at the south quay edge; the
 *                   stepped container stack T stands right above them
 *   (c) returnToSender  a lone rifleman with the harbour office wall behind him
 *   (d) slingshot   a 7.8 m stepped stack S; the warehouse's west wall faces a
 *                   group of three by its door
 *   (e) arena       4 riflemen + a warden around barriers and barrels, a
 *                   container hanging over them from the harbour crane
 */
export function buildPier(ctx: Ctx): ZoneDef {
  const b = ctx.mb;
  const Z = 'pier' as const;

  // ---------------- ground: quay, coping, jetty ----------------
  col(ctx, -40, -3, -50, 40, 0, 0, { tag: 'ground' });
  b.box('paving', -40, -0.25, -50, 40, 0, 0, 0xd8d4cc, 4, { skipBottom: true, ao: 0 });
  b.box('concrete', -40.02, -3.2, -50.02, 40.02, -0.25, 0, 0x8e887e, 3, { skipTop: true, ao: 0 });
  // coping stones + yellow edge line on the three sea sides
  const cope = 0xc9c3b8;
  b.box('concrete', -40.05, -0.25, -50.05, -39.4, 0.012, 0, cope, 1.5, { ao: 0, skipBottom: true });
  b.box('concrete', 39.4, -0.25, -50.05, 40.05, 0.012, 0, cope, 1.5, { ao: 0, skipBottom: true });
  b.box('concrete', -40.05, -0.25, -50.05, 40.05, 0.012, -49.4, cope, 1.5, { ao: 0, skipBottom: true });
  b.box('paint', -39.3, 0, -49.3, -39.15, 0.016, 0, 0xf2c21c, 1, { ao: 0 });
  b.box('paint', 39.15, 0, -49.3, 39.3, 0.016, 0, 0xf2c21c, 1, { ao: 0 });
  b.box('paint', -39.3, 0, -49.3, 39.3, 0.016, -49.15, 0xf2c21c, 1, { ao: 0 });
  // lane markings (walkway) on the quay
  for (let x = -30; x <= 30; x += 6) b.box('paint', x, 0, -30.1, x + 3, 0.014, -29.9, 0xe8e4da, 1, { ao: 0 });
  // tyre fenders on the quay wall
  if (!ctx.mobile) for (let x = -34; x <= 34; x += 8) b.box('metal', x - 0.35, -1.6, -50.35, x + 0.35, -0.3, -50.02, 0x1b1d20, 1, { ao: 0 });

  // jetty (start) across the channel
  col(ctx, 20, -0.6, -66, 32, 0, -56, { tag: 'ground' });
  b.box('wood', 20, -0.22, -66, 32, 0, -56, 0x9a7e62, 2.4, { ao: 0, uvRotate: true });
  b.box('concrete', 20.2, -0.7, -65.8, 31.8, -0.22, -56.2, 0x8a847a, 2, { ao: 0 });
  for (const x of [20.6, 26, 31.4]) for (const z of [-65.4, -61, -56.6]) {
    if (ctx.mobile) b.box('concrete', x - 0.3, -4, z - 0.3, x + 0.3, -0.7, z + 0.3, 0x7d776d, 1);
    else b.cylinder('concrete', V(x, -4, z), V(x, -0.7, z), 0.32, 0x7d776d, 10, 1.5, false);
  }
  b.box('paint', 20.05, 0, -56.3, 31.95, 0.012, -56.12, 0xf2c21c, 1, { ao: 0 });
  // patrol boat moored east of the jetty (visual)
  boat(ctx, 33.9, -61.5);

  // bollards
  for (const x of [-35, -25, -15, -5, 5, 15, 25, 35]) bollard(ctx, x, -49.55);
  for (const z of [-45, -35, -25, -15, -5]) bollard(ctx, 39.55, z);
  for (const z of [-45, -20, -10]) bollard(ctx, -39.55, z);
  for (const x of [21, 31]) bollard(ctx, x, -56.45);

  // ---------------- containers ----------------
  const C = PALETTE.containers;
  // (b) stack T: 40ft + 20ft, the vantage point over the trapdoor pair
  container(ctx, -8, 0, -47.8, true, CONT.L40, C[0]);
  container(ctx, -8, CONT.H, -47.8, true, CONT.L20, C[1]);
  // row R1: a two-high wall that hides (b) from (c)
  container(ctx, -30, 0, -43.3, true, CONT.L40, C[4]);
  container(ctx, -30, CONT.H, -43.3, true, CONT.L40, C[6]);
  container(ctx, -17.6, 0, -43.3, true, CONT.L40, C[2]);
  container(ctx, -17.6, CONT.H, -43.3, true, CONT.L40, C[9]);
  // (d) stack S: 40ft / 20ft / 10ft steps, top 7.77 m at its east end
  container(ctx, -4, 0, -26.2, true, CONT.L40, C[3]);
  container(ctx, 2.13, CONT.H, -26.2, true, CONT.L20, C[8]);
  container(ctx, 5.2, CONT.H * 2, -26.2, true, CONT.L10, C[5]);
  // (e) arena stack CA (height for the arena)
  container(ctx, -30, 0, -15, true, CONT.L40, C[7]);
  container(ctx, -30, CONT.H, -15, true, CONT.L20, C[1]);
  // north-west block (cover + skyline)
  container(ctx, -39.8, 0, -22, false, CONT.L40, C[6]);
  container(ctx, -39.8, CONT.H, -22, false, CONT.L40, C[0]);
  container(ctx, -37.1, 0, -22, false, CONT.L40, C[10]);
  container(ctx, -37.1, CONT.H, -22, false, CONT.L40, C[3]);
  container(ctx, -37.1, CONT.H * 2, -22, false, CONT.L20, C[2]);
  container(ctx, -34.4, 0, -20, false, CONT.L20, C[9]);
  // south-east pair near the channel
  container(ctx, 29, 0, -47, true, CONT.L20, C[5]);
  container(ctx, 29, CONT.H, -47, true, CONT.L20, C[4]);

  // ---------------- buildings ----------------
  // harbour office (the returnToSender wall is its east face, x = -30)
  solid(ctx, 'concrete', -40, 0, -40, -30, 7.5, -24, 0xd9d2c4, 3, { tag: 'building' }, { skipBottom: true });
  for (const y of [1.2, 4.4]) {
    b.box('facade', -40.04, y, -39, -39.9, y + 1.5, -25, 0xffffff, 6, { ao: 0 });
    b.box('facade', -38.8, y, -24.1, -31.2, y + 1.5, -23.96, 0xffffff, 6, { ao: 0 });
    b.box('facade', -38.8, y, -40.04, -31.2, y + 1.5, -39.9, 0xffffff, 6, { ao: 0 });
    b.box('facade', -30.1, y, -38.5, -29.96, y + 1.5, -34.5, 0xffffff, 6, { ao: 0 });
  }
  b.box('metal', -30.08, 0, -27.6, -29.95, 2.3, -26.2, 0x3f5566, 1, { ao: 0.3 });
  b.box('concrete', -40.2, 7.5, -40.2, -29.8, 8.0, -23.8, 0xc8c0b2, 2, { ao: 0 });
  b.box('metal', -37, 8.0, -36, -34.5, 9.4, -33, 0x9aa0a6, 1);
  // warehouse W (its west wall x = 22 faces the slingshot group)
  solid(ctx, 'container', 22, 0, -34, 38, 9, -14, 0x7b8b98, 2.2, { tag: 'building' }, { skipBottom: true });
  b.box('concrete', 21.9, 0, -34.1, 38.1, 0.8, -13.9, 0xb9b2a6, 2, { ao: 0.6 });
  b.box('metal', 21.6, 9, -34.4, 38.4, 9.35, -13.6, 0x4a5058, 2, { ao: 0, under: 0.4 });
  b.box('metal', 27, 0.8, -13.94, 33, 6, -13.84, 0x44505a, 2, { ao: 0.3 });
  b.box('hazard', 26.8, 6, -13.95, 33.2, 6.3, -13.82, 0xffffff, 1, { ao: 0 });
  // gatehouse at the yard gate
  solid(ctx, 'concrete', -12, 0, -5, -6.5, 3.2, -0.6, 0xe4ded2, 2, { tag: 'gatehouse' }, { skipBottom: true });
  b.box('facade', -11.2, 1.1, -5.05, -7.3, 2.4, -4.95, 0xffffff, 6, { ao: 0 });
  b.box('facade', -6.55, 1.1, -4.4, -6.45, 2.4, -1.2, 0xffffff, 6, { ao: 0 });
  b.box('metal', -12.3, 3.2, -5.3, -6.2, 3.45, -0.3, 0x2d3035, 2, { ao: 0 });
  // raised barrier arm
  b.beam('steel', V(-5.6, 1.1, -0.9), V(-1.5, 6.2, -0.9), 0.12, 0.12, 0xe8e4de, 1);
  b.box('metal', -5.9, 0, -1.2, -5.3, 1.2, -0.6, 0xd83a2a, 1);

  // ---------------- arena cover ----------------
  jersey(ctx, -8, -12.5, true);
  jersey(ctx, 3, -15, true);
  jersey(ctx, 12, -12, false);
  jersey(ctx, -16, -6, false);
  jersey(ctx, 0, -8.5, true);
  forklift(ctx, 9.25, -7.85);
  crateStatic(ctx, -16, -13.8, 1.3, 1.25);
  crateStatic(ctx, -4.5, -14.4, 1.2, 1.1, 0, 0xd8c8a8);
  crateStatic(ctx, 24.5, -44, 1.3, 1.2);
  crateStatic(ctx, -22, -46, 1.3, 1.2, 0, 0xcfb894);
  // mooring lines (visual)
  b.beam('metal', V(39.55, 0.5, -35), V(42.3, 0.9, -37), 0.05, 0.05, 0xd8cfa8, 1);
  b.beam('metal', V(39.55, 0.5, -25), V(42.3, 0.9, -23), 0.05, 0.05, 0xd8cfa8, 1);

  // ---------------- barge (moored east) ----------------
  col(ctx, BARGE.x0, -2.5, BARGE.z0, BARGE.x1, 0.5, BARGE.z1, { tag: 'barge' });
  b.box('steel', BARGE.x0, -2.4, BARGE.z0, BARGE.x1, 0.3, BARGE.z1, 0x5a2a22, 2, { ao: 0 });
  b.box('metal', BARGE.x0 + 0.3, 0.3, BARGE.z0 + 0.3, BARGE.x1 - 0.3, 0.5, BARGE.z1 - 0.3, 0x3a3e44, 2, { ao: 0 });
  b.box('steel', BARGE.x0, 0.3, BARGE.z0, BARGE.x1, 0.9, BARGE.z0 + 0.3, 0x1e2226, 1, { ao: 0 });
  b.box('steel', BARGE.x0, 0.3, BARGE.z1 - 0.3, BARGE.x1, 0.9, BARGE.z1, 0x1e2226, 1, { ao: 0 });
  b.box('steel', BARGE.x1 - 0.3, 0.3, BARGE.z0, BARGE.x1, 0.9, BARGE.z1, 0x1e2226, 1, { ao: 0 });
  b.box('steel', BARGE.x0, 0.3, BARGE.z0, BARGE.x0 + 0.3, 0.9, BARGE.z1, 0x1e2226, 1, { ao: 0 });
  container(ctx, 44, 0.5, -42, false, CONT.L40, C[8]);
  container(ctx, 44, 0.5 + CONT.H, -42, false, CONT.L20, C[0]);
  container(ctx, 47.2, 0.5, -40, false, CONT.L20, C[3]);

  // ---------------- decals: shipping-line names on containers, warehouse sign ----------------
  if (!ctx.headless && !ctx.mobile) {
    const names = ['KESSLER', 'NORDLINE', 'OKEANOS', 'HALCYON'];
    const decals: [number, THREE.Vector3, number][] = [
      // [texture, centre, yaw of the face normal]
      [1, V(-1.9, 1.35, -45.33), 0],
      [2, V(-23.9, 3.95, -43.33), Math.PI],
      [0, V(-11.5, 3.95, -43.33), Math.PI],
      [3, V(2.1, 1.35, -26.23), Math.PI],
      [0, V(2.1, 1.35, -23.73), 0],
      [2, V(-24, 1.3, -12.53), 0],
      [3, V(-34.63, 3.9, -12), Math.PI / 2],
      [1, V(-34.63, 6.5, -19), Math.PI / 2],
      [0, V(46.47, 1.8, -36), Math.PI / 2],
      [2, V(32, 1.35, -44.53), 0],
    ];
    names.forEach((n, ti) => {
      const geos = decals.filter((d) => d[0] === ti).map(([, p, yaw]) => new THREE.PlaneGeometry(4.2, 1.05).rotateY(yaw).translate(p.x, p.y, p.z));
      if (!geos.length) return;
      const g = new THREE.BufferGeometry();
      const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
      for (const q of geos) {
        const base = pos.length / 3;
        pos.push(...(q.getAttribute('position').array as Float32Array));
        uv.push(...(q.getAttribute('uv').array as Float32Array));
        nrm.push(...(q.getAttribute('normal').array as Float32Array));
        for (let i = 0; i < q.index!.count; i++) idx.push(base + q.index!.getX(i));
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setIndex(idx);
      const mat = new THREE.MeshStandardMaterial({ map: TX.stencil(n, ti === 0 ? '#f2b21c' : '#ecebe6'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.8, metalness: 0.2 });
      const m = new THREE.Mesh(g, mat);
      m.name = `decals:${n}`;
      m.receiveShadow = true;
      ctx.zoneRoot.add(m);
    });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 1.5),
      new THREE.MeshStandardMaterial({ map: TX.signText('KESSLER LOGISTICS', { w: 1024, h: 128, color: '#f4f0e6', bg: '#1d2a38', font: '900 72px "Arial Black", Impact, sans-serif' }), roughness: 0.6, metalness: 0.2 }),
    );
    sign.position.set(30, 7.5, -13.8);
    ctx.zoneRoot.add(sign);
  }

  // ---------------- lamps ----------------
  lampPole(ctx, -37, -47, 12, V(-20, 0, -38), 0xffd09a, 26, 0.8);
  lampPole(ctx, 37.2, -48, 12, V(18, 0, -36), 0xffd09a, 26, 0.8);
  lampPole(ctx, -37, -3, 12, V(-14, 0, -10), 0xffd09a, 26, 0.8);
  lampPole(ctx, 21, -2.6, 12, V(4, 0, -10), 0xffd09a, 26, 0.8);
  lampPole(ctx, 21, -57.2, 6, V(26, 0, -62), 0xffe2b8, 14, 0.7);

  // ---------------- props ----------------
  const H = HARBOUR_CRANE;
  addProp(ctx, 'container', V(H.trolleyX, 8.5, H.boomZ), V(CONT.L20, CONT.H, CONT.W), { hangFrom: V(H.trolleyX, H.boomY - 0.6, H.boomZ), id: 'pier.hang.container' });
  const barrel = V(0.6, 0.9, 0.6);
  for (const [x, z] of [[-6.1, -11.5], [-5.4, -11.0], [10.6, -10.4], [-3.8, -2.4], [19.6, -11.8], [-18.6, -4.5], [20.8, -19.6], [21.4, -20.3]]) addProp(ctx, 'barrel', V(x, 0, z), barrel, { explosive: true });
  addProp(ctx, 'crate', V(-14.8, 0, -3), V(1.2, 1.2, 1.2));
  addProp(ctx, 'crate', V(5.5, 0, -2.5), V(1.2, 1.2, 1.2), { yaw: 0.4 });

  // ---------------- encounters ----------------
  const encounters = [
    encounter(Z, 'door', box3(20, -1, -66, 32, 6, -56), [], false),
    encounter(
      Z,
      'trapdoor',
      box3(-20, -1, -50, 12, 10, -44),
      [spawn(Z, 'trap.a', 'rifleman', -14, 0, -48.6, YAW.N, 'trap'), spawn(Z, 'trap.b', 'rifleman', -14, 0, -47.3, YAW.S, 'trap')],
      true,
      { pos: V(1, 0, -43), yaw: YAW.N },
    ),
    encounter(Z, 'returnToSender', box3(-6, -1, -43.5, 14, 10, -34), [spawn(Z, 'rts.a', 'rifleman', -27, 0, -32, YAW.E, 'rts')], true, { pos: V(-10, 0, -36.5), yaw: YAW.E }),
    encounter(
      Z,
      'slingshot',
      box3(-12, -1, -33.5, 14, 12, -20),
      [
        spawn(Z, 'sling.a', 'rifleman', 17.2, 0, -25.6, YAW.N, 'sling'),
        spawn(Z, 'sling.b', 'rifleman', 17.2, 0, -24.3, YAW.S, 'sling'),
        spawn(Z, 'sling.c', 'rifleman', 19.8, 0, -31, YAW.N, 'sling', { state: 'patrol', route: [V(19.8, 0, -31), V(19.8, 0, -17.5)], wait: [2.5, 2.5] }),
      ],
      true,
      { pos: V(-2, 0, -21.5), yaw: YAW.N },
    ),
    encounter(
      Z,
      'arena',
      box3(-40, -1, -20, 22, 12, -15.3),
      [
        spawn(Z, 'arena.w', 'warden', -2, 0, -4, YAW.S, 'arena'),
        spawn(Z, 'arena.a', 'rifleman', -12, 0, -9, YAW.W, 'arena', { state: 'patrol', route: [V(-12, 0, -9), V(-20, 0, -9)], wait: [3, 3] }),
        spawn(Z, 'arena.b', 'rifleman', 6, 0, -12, YAW.S, 'arena'),
        spawn(Z, 'arena.c', 'rifleman', 16.5, 0, -7, YAW.S, 'arena'),
        spawn(Z, 'arena.d', 'rifleman', 8, 0, -3, -2.6, 'arena'),
      ],
      true,
      { pos: V(0, 0, -1.5), yaw: YAW.N },
    ),
  ];

  return {
    id: Z,
    nameKey: 'zone.pier.name',
    subKey: 'zone.pier.sub',
    bounds: box3(-70, -6, -80, 80, 40, 0),
    nav: [
      { minX: -40, maxX: 40, minZ: -50, maxZ: 0, floorY: 0 },
      { minX: 20, maxX: 32, minZ: -66, maxZ: -56, floorY: 0 },
      { minX: BARGE.x0, maxX: BARGE.x1, minZ: BARGE.z0, maxZ: BARGE.z1, floorY: 0.5 },
    ],
    playerStart: V(26, 0, -63),
    startYaw: YAW.N,
    killY: LAW.seaY,
    sea: true,
    encounters,
    exit: null,
    challenges: ['pier.1', 'pier.2', 'pier.3'],
  };
}

/** Yellow forklift (static cover). */
function forklift(ctx: Ctx, x: number, z: number) {
  const b = ctx.mb;
  col(ctx, x - 0.65, 0, z - 1.35, x + 0.65, 2.2, z + 1.35, { tag: 'forklift' });
  b.box('steel', x - 0.6, 0.35, z - 1.0, x + 0.6, 1.3, z + 1.1, 0xe8a818, 1, { ao: 0.5 });
  b.box('steel', x - 0.6, 0.35, z + 0.6, x + 0.6, 1.6, z + 1.3, 0x2b2e33, 1, { ao: 0.5 });
  // cage
  for (const [dx, dz] of [[-0.55, -0.6], [0.5, -0.6], [-0.55, 0.5], [0.5, 0.5]]) b.box('steel', x + dx, 1.3, z + dz, x + dx + 0.06, 2.2, z + dz + 0.06, 0x2b2e33, 1, { ao: 0 });
  b.box('steel', x - 0.6, 2.15, z - 0.65, x + 0.6, 2.2, z + 0.6, 0x2b2e33, 1, { ao: 0 });
  // mast + forks toward -z
  b.box('metal', x - 0.5, 0.1, z - 1.25, x + 0.5, 2.6, z - 1.1, 0x3a3e44, 1, { ao: 0 });
  b.box('metal', x - 0.4, 0.1, z - 2.3, x - 0.25, 0.18, z - 1.1, 0x3a3e44, 1, { ao: 0 });
  b.box('metal', x + 0.25, 0.1, z - 2.3, x + 0.4, 0.18, z - 1.1, 0x3a3e44, 1, { ao: 0 });
  for (const dz of [-0.7, 0.8]) for (const dx of [-0.62, 0.62]) {
    if (ctx.mobile) b.box('metal', x + dx - 0.12, 0, z + dz - 0.35, x + dx + 0.12, 0.7, z + dz + 0.35, 0x151618, 1, { ao: 0 });
    else b.cylinder('metal', V(x + dx - 0.12, 0.35, z + dz), V(x + dx + 0.12, 0.35, z + dz), 0.35, 0x151618, 12, 1);
  }
}

/** Small patrol boat (the player's ride in), visual only. */
function boat(ctx: Ctx, x: number, z: number) {
  const b = ctx.mb;
  b.box('steel', x - 1.2, -1.5, z - 3.5, x + 1.2, 0.3, z + 2.4, 0x1c2733, 2, { ao: 0 });
  const m = new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(x, -0.6, z - 3.5);
  b.obox('steel', m, 1.7, 1.8, 1.7, 0x1c2733, 2);
  b.box('steel', x - 1.25, 0.1, z - 3.6, x + 1.25, 0.35, z + 2.5, 0xe8e4dc, 1, { ao: 0 });
  b.box('steel', x - 0.9, 0.3, z - 0.8, x + 0.9, 1.5, z + 1.2, 0xe8e4dc, 1, { ao: 0 });
  b.box('facade', x - 0.92, 0.9, z - 0.85, x + 0.92, 1.4, z - 0.6, 0xffffff, 6, { ao: 0 });
  b.box('steel', x - 0.2, 1.5, z + 0.2, x + 0.2, 2.6, z + 0.5, 0x2b2f34, 1, { ao: 0 });
}
