import * as THREE from 'three';
import type { ZoneDef } from '../../core/contracts';
import { Builder, Ctx, PALETTE, V, addProp, box3, col, solid } from './kit';
import { crateStatic, girder, lattice, railing } from './parts';
import { beacon } from './structure';
import { GLASS_LIFT, ROOF_Y, TOWER } from './layout';
import { YAW, encounter, spawn } from './zonekit';

export interface CrownBuild {
  zone: ZoneDef;
  helicopter: THREE.Object3D;
  bossArena: { center: THREE.Vector3; radius: number; y: number; blinkPoints: THREE.Vector3[] };
}

const Y = ROOF_Y;

/**
 * ZONE 5: THE CROWN (roof, y 90). Helipad (the boss arena), machine room,
 * HVAC units, a water tank on a stand, a small roof crane with a load over the
 * pad, Voss's helicopter holding off the west edge, and the leap-of-faith
 * beam over the west edge (the sea is 90 m below).
 */
export function buildCrown(ctx: Ctx): CrownBuild {
  const b = ctx.mb;
  const Z = 'crown' as const;
  const T = TOWER;

  // ---------------- roof surface ----------------
  b.box('concrete', T.x0, Y - 0.05, T.z0, T.x1, Y, T.z1, 0xc8c2b6, 3, { ao: 0, skipBottom: true });
  // helipad: painted circle, H, touchdown markings
  const pc = V(0, Y, 38);
  if (!ctx.headless) {
    const ring = new THREE.RingGeometry(9.2, 9.8, ctx.mobile ? 48 : 96);
    ring.rotateX(-Math.PI / 2);
    ring.translate(pc.x, Y + 0.012, pc.z);
    b.geo('paint', ring, 0xf2c21c);
    const disk = new THREE.CircleGeometry(9.2, ctx.mobile ? 48 : 96);
    disk.rotateX(-Math.PI / 2);
    disk.translate(pc.x, Y + 0.008, pc.z);
    b.geo('paint', disk, 0x5d646c);
  }
  // the H
  b.box('paint', pc.x - 2.6, Y, pc.z - 3.5, pc.x - 1.6, Y + 0.018, pc.z + 3.5, 0xf4f2ec, 1, { ao: 0 });
  b.box('paint', pc.x + 1.6, Y, pc.z - 3.5, pc.x + 2.6, Y + 0.018, pc.z + 3.5, 0xf4f2ec, 1, { ao: 0 });
  b.box('paint', pc.x - 1.6, Y, pc.z - 0.5, pc.x + 1.6, Y + 0.018, pc.z + 0.5, 0xf4f2ec, 1, { ao: 0 });
  // pad edge lights
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = pc.x + Math.cos(a) * 10.2, z = pc.z + Math.sin(a) * 10.2;
    b.box('emissive', x - 0.12, Y, z - 0.12, x + 0.12, Y + 0.1, z + 0.12, new THREE.Color(0.4, 2.8, 1.0), 1, { ao: 0 });
  }

  // ---------------- parapet (openings: lift north, leap gap west) ----------------
  const ph = 1.0, pt = 0.35;
  const par = (x0: number, z0: number, x1: number, z1: number) => {
    solid(ctx, 'concrete', x0, Y, z0, x1, Y + ph, z1, 0xd8d2c6, 2, { tag: 'parapet' });
    b.box('metal', x0 - 0.02, Y + ph, z0 - 0.02, x1 + 0.02, Y + ph + 0.06, z1 + 0.02, 0x9aa0a6, 1, { ao: 0 });
  };
  par(T.x0, T.z0, T.x1, T.z0 + pt);
  par(T.x0, T.z1 - pt, GLASS_LIFT.cage.x0, T.z1);
  par(GLASS_LIFT.cage.x1, T.z1 - pt, T.x1, T.z1);
  par(T.x0, T.z0 + pt, T.x0 + pt, 37);
  par(T.x0, 43, T.x0 + pt, T.z1 - pt);
  par(T.x1 - pt, T.z0 + pt, T.x1, T.z1 - pt);
  // glass balustrade on top of the parapet (see-through, no rifts)
  if (!ctx.mobile) {
    for (const [x0, z0, x1, z1] of [[T.x0, T.z0, T.x1, T.z0 + 0.05], [T.x1 - 0.05, T.z0, T.x1, T.z1]] as const) b.box('glass', x0, Y + ph + 0.06, z0, x1, Y + ph + 1.0, z1, 0xffffff, 2, { ao: 0 });
  }

  // ---------------- rooftop structures ----------------
  // machine room (penthouse) NW
  solid(ctx, 'concrete', -16, Y, 47, -8, Y + 4, 56, 0xe2dcd0, 2.5, { tag: 'penthouse' });
  b.box('metal', -16.2, Y + 4, 46.8, -7.8, Y + 4.25, 56.2, 0x3a3e44, 1, { ao: 0 });
  b.box('metal', -8.02, Y, 50, -7.95, Y + 2.3, 51.4, 0x4a5866, 1, { ao: 0.3 });
  b.box('facade', -16.03, Y + 1.6, 48.5, -15.96, Y + 3.2, 54.5, 0xffffff, 6, { ao: 0 });
  // HVAC units NE (step up to the penthouse roof is 2 x 2 m)
  hvac(ctx, 10, 46, 13, 49.5);
  hvac(ctx, 13.6, 46, 16.6, 49.5);
  crateStatic(ctx, -7.3, 47.8, 1.3, 2.0, Y, 0x8a9096);
  // water tank on a stand (SE): stand deck 93.2, climb via the crate step
  solid(ctx, 'steel', 11, Y, 23, 16.6, Y + 3.3, 29, 0x5a6068, 1.5, { tag: 'tankstand' });
  b.box('metal', 10.95, Y + 3.2, 22.95, 16.65, Y + 3.31, 29.05, 0x3a3e44, 1, { ao: 0 });
  col(ctx, 13.3, Y + 3.3, 24.2, 16.3, Y + 6.8, 27.8, { tag: 'tank' });
  if (ctx.mobile) b.box('metal', 13.3, Y + 3.3, 24.2, 16.3, Y + 6.8, 27.8, 0xdad6cc, 2);
  else {
    b.cylinder('metal', V(14.8, Y + 3.3, 26), V(14.8, Y + 6.6, 26), 1.55, 0xdad6cc, 20, 2, true);
    b.cylinder('metal', V(14.8, Y + 6.6, 26), V(14.8, Y + 7.1, 26), 0.2, 0xdad6cc, 20, 2, true, 1.55);
  }
  crateStatic(ctx, 9.9, 25.5, 1.4, 1.7, Y, 0x8a9096);
  railing(ctx, 11, 29, 16.6, 29, Y + 3.3, { h: 1.0 });
  // antenna mast NE
  lattice(b, 16, 56, Y, Y + 14, 0.7, 0xd8dcdf, 0.08, 0.035, 1.4);
  col(ctx, 15.6, Y, 55.6, 16.4, Y + 14, 56.4, { tag: 'antenna', seeThrough: true });
  beacon(ctx, V(16, Y + 14.3, 56));
  beacon(ctx, V(-16, Y + 4.5, 56), 1.3);
  // skylight over the lift lobby (walkable glass)
  b.box('glass', -4, Y, 50, 3, Y + 0.3, 55, 0xffffff, 2, { ao: 0 });
  b.box('metal', -4.05, Y, 49.95, 3.05, Y + 0.32, 50.05, 0x2a3036, 1, { ao: 0 });
  col(ctx, -4, Y, 50, 3, Y + 0.3, 55, { tag: 'skylight' });

  // ---------------- roof crane with a load over the pad ----------------
  const mast = V(-14, Y, 26);
  const jibY = Y + 11.5;
  solid(ctx, 'concrete', mast.x - 1.2, Y, mast.z - 1.2, mast.x + 1.2, Y + 0.8, mast.z + 1.2, 0xbdb6aa, 2, { tag: 'cranebase' });
  lattice(b, mast.x, mast.z, Y + 0.8, jibY, 1.1, PALETTE.crane, 0.12, 0.05, 1.6);
  col(ctx, mast.x - 0.55, Y + 0.8, mast.z - 0.55, mast.x + 0.55, jibY, mast.z + 0.55, { tag: 'crane' });
  const dir = V(12, 0, 8).normalize();
  const tip = mast.clone().setY(jibY).addScaledVector(dir, 15);
  girder(b, mast.clone().setY(jibY), tip, 1.0, 1.1, PALETTE.crane, 0.1, 0.045, 1.6);
  const back = mast.clone().setY(jibY).addScaledVector(dir, -4.5);
  girder(b, mast.clone().setY(jibY), back, 1.2, 0.8, PALETTE.crane, 0.1, 0.045, 1.6);
  b.box('concrete', back.x - 0.9, jibY - 1.4, back.z - 0.9, back.x + 0.9, jibY, back.z + 0.9, 0xa9a397, 1, { ao: 0 });
  b.beam('metal', mast.clone().setY(jibY + 4), tip.clone().setY(jibY + 1.1), 0.04, 0.04, 0x333333, 1);
  b.beam('metal', mast.clone().setY(jibY + 4), back.clone().setY(jibY + 0.8), 0.04, 0.04, 0x333333, 1);
  b.beam('steel', mast.clone().setY(jibY), mast.clone().setY(jibY + 4), 0.2, 0.2, PALETTE.crane, 1);
  beacon(ctx, tip.clone().setY(jibY + 1.4), 0.6);
  const hang = mast.clone().setY(jibY).addScaledVector(dir, 10.5);
  b.box('steel', hang.x - 0.5, jibY - 0.3, hang.z - 0.5, hang.x + 0.5, jibY, hang.z + 0.5, 0x2f3338, 1, { ao: 0 });
  addProp(ctx, 'load', V(hang.x, Y + 5.2, hang.z), V(2.4, 1.6, 2.4), { hangFrom: V(hang.x, jibY - 0.3, hang.z), id: 'crown.hang.load', mass: 4200 });

  // ---------------- leap of faith: a beam out over the west edge ----------------
  solid(ctx, 'steel', T.x0 - 6, Y - 0.3, 39.4, T.x0 + 0.4, Y + 0.12, 40.6, PALETTE.primer, 1.5, { tag: 'leap' });
  b.box('hazard', T.x0 - 6, Y + 0.12, 39.45, T.x0 - 5.6, Y + 0.14, 40.55, 0xffffff, 1, { ao: 0 });

  // ---------------- lamps ----------------
  ctx.lamps.push({ pos: V(-8.2, Y + 3.6, 51.5), dir: V(0.6, -1, -0.5).normalize(), color: 0xffe0b8, range: 16, angle: 0.9, intensity: 0.7, kind: 'wall' });
  ctx.lamps.push({ pos: V(12, Y + 3.2, 22.9), dir: V(-0.4, -1, 0.6).normalize(), color: 0xffe0b8, range: 16, angle: 0.9, intensity: 0.7, kind: 'wall' });

  // ---------------- props ----------------
  const barrel = V(0.6, 0.9, 0.6);
  for (const [x, z] of [[-11, 44], [-10.4, 44.7], [8.5, 31], [-6, 28]]) addProp(ctx, 'barrel', V(x, Y, z), barrel, { explosive: true });

  // ---------------- helicopter: Voss's ride, holding off the west edge ----------------
  const helicopter = buildHelicopter(ctx);
  helicopter.position.set(-34, Y + 7, 40);
  helicopter.rotation.y = Math.PI / 2;
  ctx.shellRoot.add(helicopter);

  // ---------------- boss ----------------
  const blinkPoints = [V(-10, Y, 30), V(8, Y, 29.5), V(-11.5, Y, 42), V(7, Y, 44), V(0, Y, 26), V(-2, Y, 47.5)];
  const bossArena = { center: pc.clone(), radius: 13, y: Y, blinkPoints };
  const encounters = [
    encounter(Z, 'boss', box3(T.x0, Y - 0.5, T.z0, T.x1, Y + 10, T.z1 - 0.8), [spawn(Z, 'voss', 'boss', 0, Y, 29, YAW.N, 'boss', { state: 'combat' })], true, { pos: V(0, Y, 44), yaw: YAW.W }),
    encounter(Z, 'leap', box3(T.x0 - 8, Y - 0.5, 35, T.x0 + 4, Y + 8, 45), [], false),
  ];
  // the boss spawn id is exactly 'voss'
  encounters[0].spawns[0].id = 'voss';

  const zone: ZoneDef = {
    id: Z,
    nameKey: 'zone.crown.name',
    subKey: 'zone.crown.sub',
    bounds: box3(-60, 72, 0, 60, 140, 80),
    nav: [{ minX: T.x0, maxX: T.x1, minZ: T.z0, maxZ: T.z1, floorY: Y }],
    playerStart: V(10, Y, 55.5),
    startYaw: YAW.S,
    killY: 70,
    sea: false,
    encounters,
    exit: null,
    challenges: ['crown.1', 'crown.2', 'crown.3'],
  };
  return { zone, helicopter, bossArena };
}

function hvac(ctx: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const b = ctx.mb;
  solid(ctx, 'metal', x0, Y, z0, x1, Y + 2.0, z1, 0xc8ccd0, 1.5, { tag: 'hvac' });
  b.box('metal', x0 - 0.05, Y + 0.3, z0 - 0.05, x1 + 0.05, Y + 1.4, z0, 0x5a6068, 1, { ao: 0 });
  if (ctx.mobile) return;
  const cx = (x0 + x1) / 2;
  for (const cz of [z0 + (z1 - z0) * 0.3, z0 + (z1 - z0) * 0.72]) {
    b.cylinder('metal', V(cx, Y + 2.0, cz), V(cx, Y + 2.08, cz), 0.8, 0x2b2f34, 16, 1);
    b.box('metal', cx - 0.75, Y + 2.08, cz - 0.03, cx + 0.75, Y + 2.1, cz + 0.03, 0x9aa0a6, 1, { ao: 0 });
  }
}

/** Kessler helicopter (hull, cockpit glass, tail, skids, rotors). Rotors spin in `animated`. */
function buildHelicopter(ctx: Ctx) {
  const g = new THREE.Group();
  g.name = 'helicopter';
  const b = new Builder();
  const hull = 0x1d2a38, stripe = PALETTE.orange;
  // fuselage from stacked boxes + a rounded nose
  b.box('steel', -1.1, 0.9, -2.4, 1.1, 2.7, 2.2, hull, 2, { ao: 0 });
  b.box('steel', -0.95, 2.7, -1.6, 0.95, 3.1, 1.6, hull, 2, { ao: 0 });
  b.box('steel', -1.12, 1.35, -2.4, 1.12, 1.55, 2.2, stripe, 1, { ao: 0 });
  const nose = new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  nose.rotateX(Math.PI / 2);
  nose.scale(1, 0.82, 1.5);
  nose.translate(0, 1.8, 2.2);
  b.geo('glass', nose, 0xffffff);
  const noseLow = new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  noseLow.rotateX(Math.PI / 2);
  noseLow.scale(1, 0.82, 1.2);
  noseLow.translate(0, 1.8, 2.2);
  b.geo('steel', noseLow, hull);
  // tail boom + fin + stabiliser
  b.cylinder('steel', V(0, 2.3, -2.4), V(0, 2.55, -8.2), 0.5, hull, 12, 2, true, 0.22);
  b.box('steel', -0.08, 2.4, -8.6, 0.08, 4.0, -7.6, hull, 1, { ao: 0 });
  b.box('steel', -1.4, 2.5, -7.6, 1.4, 2.6, -7.0, hull, 1, { ao: 0 });
  b.box('steel', -0.1, 3.3, -8.55, 0.1, 3.9, -7.9, stripe, 1, { ao: 0 });
  // skids
  for (const s of [-1, 1]) {
    b.cylinder('metal', V(s * 1.2, 0.1, -2.2), V(s * 1.2, 0.1, 2.4), 0.07, 0x2b2f34, 8, 1);
    b.beam('metal', V(s * 1.2, 0.1, -1.2), V(s * 0.9, 0.95, -1.0), 0.08, 0.08, 0x2b2f34, 1);
    b.beam('metal', V(s * 1.2, 0.1, 1.4), V(s * 0.9, 0.95, 1.2), 0.08, 0.08, 0x2b2f34, 1);
  }
  // rotor mast
  b.cylinder('metal', V(0, 3.1, 0.2), V(0, 3.6, 0.2), 0.16, 0x2b2f34, 10, 1);
  const body = b.build(ctx.materials, { name: 'heli' });
  g.add(body);
  // rotors (own meshes so they can spin)
  const rb = new Builder();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationY(a).setPosition(0, 0, 0);
    const blade = new THREE.BoxGeometry(5.4, 0.05, 0.32).translate(2.7, 0, 0).applyMatrix4(m);
    rb.geo('metal', blade, 0x22262a);
  }
  const rotor = rb.build(ctx.materials, { name: 'rotor' });
  rotor.position.set(0, 3.62, 0.2);
  g.add(rotor);
  const tb = new Builder();
  tb.box('metal', -0.04, -0.7, -0.09, 0.04, 0.7, 0.09, 0x22262a, 1, { ao: 0 });
  const tail = tb.build(ctx.materials, { name: 'tailrotor' });
  tail.position.set(0.18, 3.1, -8.1);
  g.add(tail);
  // nav lights
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) }));
  red.position.set(-1.15, 1.6, 0);
  const grn = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 5, 0.6) }));
  grn.position.set(1.15, 1.6, 0);
  g.add(red, grn);
  g.userData.rotor = rotor;
  g.userData.tailRotor = tail;
  ctx.animated.push((t) => {
    rotor.rotation.y = t * 22;
    tail.rotation.x = t * 40;
  });
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
