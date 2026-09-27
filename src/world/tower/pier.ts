import * as THREE from 'three';
import * as TX from '../textures';
import { LAW, type ZoneDef } from '../../core/contracts';
import { CONT, Ctx, PALETTE, V, addProp, box3, col, solid } from './kit';
import { bollard, container, crateStatic, jersey, lampPole, railing } from './parts';
import { BARGE } from './layout';
import { HARBOUR_CATWALK, HARBOUR_CRANE } from './structure';
import { YAW, encounter, spawn } from './zonekit';

/**
 * ZONE 1: THE PIER (y 0). A quay 80 x 50 m with sea on three sides. The
 * player starts on a jetty across a 6 m channel.
 *
 *   (a) door        jetty -> quay across the channel (no enemies)
 *   (b) trapdoor    two unaware riflemen chatting at the south quay edge; the
 *                   stepped container stack T stands right above them
 *   (c) returnToSender  a lone lookout on the harbour office roof, over the
 *                   container yard: the first man you can't walk to
 *   (d) slingshot   a 7.8 m stepped stack S; the warehouse's west wall faces a
 *                   pair by its door, a sentry on its roof has his back turned
 *   (e) arena       lookouts on stack CA and the crane catwalk, two riflemen in
 *                   cover and a warden, a container hanging over them from the
 *                   harbour crane
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
  // (e) arena stack CA: a flat two-high lookout's stack (5.18), a long jump clear of everything you can climb
  container(ctx, -28.5, 0, -15, true, CONT.L40, C[7]);
  container(ctx, -28.5, CONT.H, -15, true, CONT.L40, C[1]);
  // north-west block (cover + skyline): its stepped top (2.59 / 5.18 / 7.77) is your own high ground over the arena
  container(ctx, -39.8, 0, -22, false, CONT.L40, C[6]);
  container(ctx, -39.8, CONT.H, -22, false, CONT.L40, C[0]);
  container(ctx, -39.8, CONT.H * 2, -18, false, CONT.L20, C[2]);
  container(ctx, -37.1, 0, -22, false, CONT.L40, C[10]);
  container(ctx, -37.1, CONT.H, -22, false, CONT.L40, C[3]);
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
  // the roof is Kessler's lookout over the container yard (returnToSender): the roof you see is the
  // roof you stand on, a guard rail round it (E/W full length, N/S inset: no two runs share a corner
  // post), the plant box as solid cover, the hatch he came up through, a floodlight on the yard
  solid(ctx, 'concrete', -40.2, 7.5, -40.2, -29.8, 8.0, -23.8, 0xc8c0b2, 2, { tag: 'building' }, { ao: 0 });
  plantUnit(ctx, -37, 8.0, -36, -34.5, 9.4, -33);
  railing(ctx, -29.95, -40.05, -29.95, -23.95, 8.0);
  railing(ctx, -40.05, -40.05, -40.05, -23.95, 8.0);
  railing(ctx, -39.97, -40.05, -30.03, -40.05, 8.0);
  railing(ctx, -39.97, -23.95, -30.03, -23.95, 8.0);
  roofHatch(ctx, -38.0, 8.0, -27.8);
  // warehouse W (its west wall x = 22 faces the slingshot group); its roof is a sentry's walk (slingshot)
  solid(ctx, 'container', 22, 0, -34, 38, 9, -14, 0x7b8b98, 2.2, { tag: 'building' }, { skipBottom: true });
  b.box('concrete', 21.9, 0, -34.1, 38.1, 0.8, -13.9, 0xb9b2a6, 2, { ao: 0.6 });
  solid(ctx, 'metal', 21.6, 9, -34.4, 38.4, 9.35, -13.6, 0x4a5058, 2, { tag: 'building' }, { ao: 0, under: 0.4, skipTop: true });
  warehouseRoof(ctx, 21.6, -34.4, 38.4, -13.6, 9.35, [30.05, 35.55]);
  railing(ctx, 21.75, -34.25, 21.75, -13.75, 9.35);
  railing(ctx, 38.25, -34.25, 38.25, -13.75, 9.35);
  railing(ctx, 21.83, -34.25, 38.17, -34.25, 9.35);
  railing(ctx, 21.83, -13.75, 38.17, -13.75, 9.35);
  roofHatch(ctx, 24.5, 9.35, -26.0);
  roofVent(ctx, 27.2, 9.35, -24.0);
  roofVent(ctx, 33.0, 9.35, -18.0);
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
  jersey(ctx, 13, -3.5, true); // the forklift man's fallback, by the gate
  forklift(ctx, 9.25, -7.85);
  crateStatic(ctx, -14.6, -13.8, 1.3, 1.25);
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
      [2, V(-22.5, 1.3, -12.53), 0],
      [3, V(-34.63, 3.9, -12), Math.PI / 2],
      [1, V(-37.33, 6.5, -14.97), Math.PI / 2],
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
  // the office lookout's floodlight on its roof's NE corner, on the container yard
  lampPole(ctx, -31.0, -25.0, 3.2, V(-18, 0, -34), 0xffd09a, 22, 0.6, 8.0);

  // ---------------- props ----------------
  const H = HARBOUR_CRANE;
  addProp(ctx, 'container', V(H.trolleyX, 8.5, H.boomZ), V(CONT.L20, CONT.H, CONT.W), { hangFrom: V(H.trolleyX, H.boomY - 0.6, H.boomZ), id: 'pier.hang.container' });
  const barrel = V(0.6, 0.9, 0.6);
  for (const [x, z] of [[-6.1, -11.5], [-5.4, -11.0], [10.6, -10.4], [-3.8, -2.4], [19.6, -11.8], [-18.6, -4.5], [20.8, -19.6], [21.4, -20.3]]) addProp(ctx, 'barrel', V(x, 0, z), barrel, { explosive: true });
  addProp(ctx, 'crate', V(-14.8, 0, -3), V(1.2, 1.2, 1.2));
  addProp(ctx, 'crate', V(5.5, 0, -2.5), V(1.2, 1.2, 1.2), { yaw: 0.4 });

  // ---------------- encounters ----------------
  // Every man holds ground (DESIGN §5 roles): holders on posts you can't walk to (the office roof,
  // the warehouse roof, stack CA, the crane catwalk), anchors in cover on the fight's floor, the
  // warden pushing inside it.
  const K = HARBOUR_CATWALK;
  const encounters = [
    encounter(Z, 'door', box3(20, -1, -66, 32, 6, -56), [], false),
    encounter(
      Z,
      'trapdoor',
      box3(-20, -1, -50, 12, 10, -44),
      [spawn(Z, 'trap.a', 'rifleman', -14, 0, -48.6, YAW.N, 'trap', { role: 'anchor' }), spawn(Z, 'trap.b', 'rifleman', -14, 0, -47.3, YAW.S, 'trap', { role: 'anchor' })],
      true,
      { pos: V(1, 0, -43), yaw: YAW.N },
    ),
    // the first man you can't walk to: a lookout on the office roof, over the container yard
    encounter(Z, 'returnToSender', box3(-18, -1, -40.5, -4, 10, -28), [spawn(Z, 'rts.a', 'rifleman', -31.2, 8, -34, YAW.E, 'rts', { role: 'holder' })], true, { pos: V(-10, 0, -36.5), yaw: YAW.E }),
    // the pair by the warehouse wall, and a sentry on its roof with his back half-turned (he wakes after the slingshot)
    encounter(
      Z,
      'slingshot',
      box3(-12, -1, -33.5, 14, 12, -20),
      [
        spawn(Z, 'sling.a', 'rifleman', 17.2, 0, -25.6, YAW.N, 'sling', { role: 'anchor' }),
        spawn(Z, 'sling.b', 'rifleman', 17.2, 0, -24.3, YAW.S, 'sling', { role: 'anchor' }),
        spawn(Z, 'sling.c', 'rifleman', 22.6, 9.35, -31, 0.5, 'sling', { role: 'holder' }),
      ],
      true,
      { pos: V(-2, 0, -21.5), yaw: YAW.N },
    ),
    // a lookout on stack CA (west), a sentry on the crane catwalk (east), two riflemen on the jersey
    // line and at the forklift, the warden at the gate
    encounter(
      Z,
      'arena',
      box3(-40, -1, -20, 22, 12, -15.3),
      [
        spawn(Z, 'arena.w', 'warden', -2, 0, -4, YAW.S, 'arena', { role: 'pusher' }),
        spawn(Z, 'arena.a', 'rifleman', -18.5, CONT.H * 2, -13.8, 1.78, 'arena', { role: 'holder' }),
        spawn(Z, 'arena.b', 'rifleman', 0, 0, -7.4, YAW.S, 'arena', { role: 'anchor', state: 'patrol', route: [V(0, 0, -7.4), V(-5, 0, -10)], wait: [3, 3] }),
        spawn(Z, 'arena.c', 'rifleman', 26.3, K.y, -5.8, YAW.W, 'arena', { role: 'holder' }),
        spawn(Z, 'arena.d', 'rifleman', 9.25, 0, -5.8, -2.5, 'arena', { role: 'anchor', fallback: V(13, 0, -2) }),
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
      // the lookouts' posts: office roof, warehouse roof, stack CA, the crane catwalk
      { minX: -40, maxX: -30, minZ: -40, maxZ: -24, floorY: 8 },
      { minX: 21.6, maxX: 38.4, minZ: -34.4, maxZ: -13.6, floorY: 9.35 },
      { minX: -28.5, maxX: -28.5 + CONT.L40, minZ: -15, maxZ: -15 + CONT.W, floorY: CONT.H * 2 },
      { minX: K.x0, maxX: K.x1, minZ: K.z0, maxZ: K.z1, floorY: K.y },
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

/**
 * Roof access hatch centred on (x, z), on a roof at y: a steel curb round a
 * dark shaft, the lid thrown back just past upright on its north hinge and
 * held there by a stay. How a lookout got up; solid (curb and lid).
 */
function roofHatch(ctx: Ctx, x: number, y: number, z: number) {
  const b = ctx.mb;
  const s = 0.6, h = 0.45, t = 0.1, grey = 0x6b737b, dark = 0x2b2f34;
  col(ctx, x - s, y, z - s, x + s, y + h, z + s, { tag: 'hatch' });
  b.box('metal', x - s, y, z - s, x + s, y + h, z - s + t, grey, 1, { skipBottom: true, ao: 0.4 });
  b.box('metal', x - s, y, z + s - t, x + s, y + h, z + s, grey, 1, { skipBottom: true, ao: 0.4 });
  b.box('metal', x - s, y, z - s + t, x - s + t, y + h, z + s - t, grey, 1, { skipBottom: true, ao: 0.4 });
  b.box('metal', x + s - t, y, z - s + t, x + s, y + h, z + s - t, grey, 1, { skipBottom: true, ao: 0.4 });
  // the shaft, dark a little below the rim
  b.box('metal', x - s + t, y, z - s + t, x + s - t, y + h - 0.06, z + s - t, 0x121416, 1, { skipBottom: true, ao: 0 });
  // the lid: hinged on the north rim, open 106 degrees (leaning back, away from the opening)
  const a = 1.85, L = 2 * s, lt = 0.05;
  const dy = Math.sin(a), dz = -Math.cos(a);
  const hy = y + h, hz = z + s;
  const m = new THREE.Matrix4().makeRotationX(a).setPosition(x, hy + (L / 2) * dy + (lt / 2) * Math.cos(a), hz + (L / 2) * dz + (lt / 2) * Math.sin(a));
  b.obox('metal', m, L, lt, L, grey, 1);
  // hinge knuckles and the stay that holds it
  b.box('metal', x - s + 0.1, hy - 0.03, hz - 0.03, x - s + 0.3, hy + 0.03, hz + 0.03, dark, 1, { ao: 0 });
  b.box('metal', x + s - 0.3, hy - 0.03, hz - 0.03, x + s - 0.1, hy + 0.03, hz + 0.03, dark, 1, { ao: 0 });
  b.beam('metal', V(x + s - 0.08, hy - 0.02, hz - 0.35), V(x + s - 0.08, hy + 0.55 * dy, hz + 0.55 * dz - 0.02), 0.03, 0.03, dark, 1);
  col(ctx, x - s, hy, hz - 0.03, x + s, hy + L * dy + 0.03, hz + L * dz + 0.05, { tag: 'hatch' });
}

/** Rooftop vent unit centred on (x, z), on a roof at y: a steel box on a dark curb, a louvred top. Solid. */
function roofVent(ctx: Ctx, x: number, y: number, z: number) {
  const b = ctx.mb;
  const s = 0.6, h = 1.0, dark = 0x2b2f34;
  col(ctx, x - s, y, z - s, x + s, y + h + 0.09, z + s, { tag: 'vent' });
  b.box('metal', x - s, y, z - s, x + s, y + h, z + s, 0x8d949b, 1, { skipBottom: true, ao: 0.5 });
  b.box('metal', x - s - 0.05, y, z - s - 0.05, x + s + 0.05, y + 0.12, z + s + 0.05, 0x3a3e44, 1, { skipBottom: true, ao: 0 });
  b.box('metal', x - s + 0.08, y + h, z - s + 0.08, x + s - 0.08, y + h + 0.03, z + s - 0.08, dark, 1, { skipBottom: true, ao: 0 });
  for (const k of [-0.3, 0, 0.3]) b.box('metal', x - s + 0.12, y + h + 0.03, z + k - 0.06, x + s - 0.12, y + h + 0.09, z + k + 0.06, dark, 1, { skipBottom: true, ao: 0 });
}

/**
 * The warehouse roof (the slingshot sentry's walk), over its solid cap:
 * profiled steel sheeting in the cladding's own corrugation (ribs running
 * north-south), a dark flashing round the edge under the guard rail, and runs
 * of roof lights at x = each of `lights`: three pale sheets of the same profile
 * on dark kerbs (clear of the hatch, the vents and the sentry's post). The
 * sheeting is flush with the collider top (the roof you see is the roof you
 * stand on); the flashing and the lights stand a few mm proud.
 */
function warehouseRoof(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, lights: number[]) {
  const b = ctx.mb;
  const e = 0.3, fl = 0x3a3e44, t = y + 0.012;
  b.box('container', x0 + e, y - 0.02, z0 + e, x1 - e, y, z1 - e, 0x6b7681, 2.2, { ao: 0, skipBottom: true });
  b.box('metal', x0, y - 0.02, z0, x1, t, z0 + e, fl, 1, { ao: 0, skipBottom: true });
  b.box('metal', x0, y - 0.02, z1 - e, x1, t, z1, fl, 1, { ao: 0, skipBottom: true });
  b.box('metal', x0, y - 0.02, z0 + e, x0 + e, t, z1 - e, fl, 1, { ao: 0, skipBottom: true });
  b.box('metal', x1 - e, y - 0.02, z0 + e, x1, t, z1 - e, fl, 1, { ao: 0, skipBottom: true });
  // three sheets per run between the purlins, 2.8 m in from the south edge and 3 m from the north
  const a0 = z0 + 2.8, a1 = z1 - 3.0, gap = 0.9, len = (a1 - a0 - 2 * gap) / 3;
  for (const cx of lights) {
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * (len + gap), c = a + len;
      b.box('metal', cx - 0.6, y, a - 0.05, cx + 0.6, y + 0.03, c + 0.05, fl, 1, { ao: 0, skipBottom: true });
      b.box('container', cx - 0.55, y + 0.03, a, cx + 0.55, y + 0.045, c, 0xb4c0bd, 2.2, { ao: 0, skipBottom: true });
    }
  }
}

/**
 * The office roof's plant unit (the lookout's cover; solid, the box x0..x1,
 * y..y1, z0..z1): a galvanised casing on a dark base frame under a drip cap,
 * louvred intakes down both long sides (the east one faces the container
 * yard), two fan guards on top, an access panel with a warning band on its
 * south end, an isolator on its north. All of it inside the collider but the
 * fan shrouds' 10 cm lip.
 */
function plantUnit(ctx: Ctx, x0: number, y: number, z0: number, x1: number, y1: number, z1: number) {
  const b = ctx.mb;
  col(ctx, x0, y, z0, x1, y1, z1, { tag: 'plant' });
  const galv = 0xa9b0b6, shade = 0x8d949b, dark = 0x24282d, frame = 0x3a3e44, i = 0.04;
  const cx = (x0 + x1) / 2, seg = ctx.mobile ? 10 : 16;
  b.box('steel', x0, y, z0, x1, y + 0.14, z1, frame, 1, { skipBottom: true, ao: 0.5 });
  b.box('metal', x0 + i, y + 0.14, z0 + i, x1 - i, y1 - 0.08, z1 - i, galv, 1, { skipBottom: true, skipTop: true, ao: 0.25 });
  b.box('metal', x0, y1 - 0.08, z0, x1, y1, z1, shade, 1, { ao: 0 });
  // louvred intakes on the long (x) sides: a dark opening, its frame, blades every 0.11 m
  const za = z0 + 0.35, zb = z1 - 0.35, ya = y + 0.32, yb = y1 - 0.26;
  for (const s of [-1, 1]) {
    const face = s < 0 ? x0 + i : x1 - i;
    /** A box on this side, from w0 to w1 out of the casing face. */
    const side = (w0: number, w1: number, p0: number, p1: number, q0: number, q1: number, c: number) =>
      b.box('metal', face + s * w0, p0, q0, face + s * w1, p1, q1, c, 1, { ao: 0 });
    side(0, 0.004, ya, yb, za, zb, dark);
    side(0, 0.04, ya - 0.05, ya, za - 0.05, zb + 0.05, shade);
    side(0, 0.04, yb, yb + 0.05, za - 0.05, zb + 0.05, shade);
    side(0, 0.04, ya, yb, za - 0.05, za, shade);
    side(0, 0.04, ya, yb, zb, zb + 0.05, shade);
    for (let q = ya + 0.07; q < yb - 0.02; q += 0.11) side(0.004, 0.035, q - 0.022, q + 0.012, za, zb, galv);
  }
  // fan guards on top: a shroud, the dark well, three blades on a hub, a bar guard over them
  for (const zc of [z0 + 0.75, z1 - 0.75]) {
    const r = 0.55;
    b.cylinder('metal', V(cx, y1, zc), V(cx, y1 + 0.1, zc), r + 0.04, frame, seg, 1, false);
    b.cylinder('metal', V(cx, y1, zc), V(cx, y1 + 0.02, zc), r, dark, seg, 1, true);
    b.cylinder('metal', V(cx, y1 + 0.02, zc), V(cx, y1 + 0.07, zc), 0.09, frame, 8, 1, true);
    for (let k = 0; k < 3; k++) {
      const t = (k * 2 * Math.PI) / 3 + 0.4;
      b.beam('metal', V(cx, y1 + 0.045, zc), V(cx + Math.cos(t) * (r - 0.05), y1 + 0.045, zc + Math.sin(t) * (r - 0.05)), 0.14, 0.012, shade, 1);
    }
    for (let d = -0.4; d <= 0.41; d += 0.2) {
      const h = Math.sqrt(r * r - d * d);
      b.box('metal', cx - h, y1 + 0.085, zc + d - 0.012, cx + h, y1 + 0.1, zc + d + 0.012, frame, 1, { ao: 0 });
    }
    b.box('metal', cx - 0.012, y1 + 0.075, zc - r, cx + 0.012, y1 + 0.085, zc + r, frame, 1, { ao: 0 });
  }
  // the access panel on the south end (handles, a warning band) and the isolator on the north
  const s0 = z0 + i;
  b.box('metal', cx - 0.62, y + 0.26, s0 - 0.015, cx + 0.62, y1 - 0.2, s0, shade, 1, { ao: 0 });
  for (const hx of [cx - 0.5, cx + 0.5]) b.box('metal', hx - 0.03, y + 0.62, s0 - 0.035, hx + 0.03, y + 0.82, s0 - 0.015, dark, 1, { ao: 0 });
  b.box('hazard', cx - 0.3, y1 - 0.42, s0 - 0.02, cx + 0.3, y1 - 0.3, s0 - 0.015, 0xffffff, 1, { ao: 0 });
  const n0 = z1 - i;
  b.box('metal', cx + 0.45, y + 0.55, n0, cx + 0.8, y + 0.95, n0 + 0.035, frame, 1, { ao: 0 });
  b.box('metal', cx + 0.6, y + 0.14, n0, cx + 0.65, y + 0.55, n0 + 0.03, dark, 1, { ao: 0 });
  b.box('hazard', cx + 0.5, y + 0.84, n0 + 0.035, cx + 0.75, y + 0.9, n0 + 0.04, 0xffffff, 1, { ao: 0 });
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
