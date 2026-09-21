// Mission 01 — Blacksite Delta. A logistics/detention compound built as a real site: gate house, container yard,
// warehouse with a mezzanine office, control room, armory, cell block, helipad. Guards stand where they can see
// each other, so every kill has a possible witness.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { buildRifle } from '../entities/weapons.js';

export const LEVEL1_BOUNDS = { minX: -70, maxX: 70, minZ: -70, maxZ: 70 };

export function buildLevel1(game, b) {
  const L = { modules: b.modules, doors: b.doors, zones: b.zones, interactables: [], spawns: { enemies: [], hostages: [] }, power: true, floodlights: [], roomLights: [], emergency: [], searchlights: [], zoneLabels: [], roofs: [], name: 'Blacksite Delta' };
  const PI = Math.PI;

  // ================= GROUND =================
  b.plane(0, 0, 8, 96, 88, 'asphalt');                 // compound: x -48..48, z -36..52
  b.plane(0, 0, -50, 140, 28, 'dirt');                  // south of the fence
  b.plane(0, 0, 60, 140, 16, 'dirt');                   // north
  b.plane(-58, 0.001, 8, 20, 88, 'dirt'); b.plane(58, 0.001, 8, 20, 88, 'dirt');
  b.plane(0, 0.006, -42, 8, 12, 'asphalt');             // access road up to the gate
  b.roadLine(-3.8, -36, -3.8, 51, 0.15); b.roadLine(3.8, -36, 3.8, 51, 0.15);
  b.roadLine(0, -34, 0, 50, 0.15, 'paintYellow', 1.5);
  b.roadLine(-12, -8, 46, -8, 0.15, 'paintYellow', 1.5);
  b.roadLine(-12, -11.2, 46, -11.2, 0.15); b.roadLine(-12, -4.8, 46, -4.8, 0.15);
  for (const [x, z] of [[-6, -20], [6, -2], [-6, 14], [6, 30], [20, -8], [-14, 24]]) b.drain(x, z);
  for (const [x, z, r] of [[-20, -24, 1.4], [-8, 10, 1.1], [12, -2, 0.9], [33, -25, 1.6], [-26, -14, 1.0], [2, 20, 1.2]]) b.stain(x, z, r);

  // ================= PERIMETER =================
  b.fence(-48, -36, -30, -36); b.fence(-27, -36, -4, -36); b.fence(4, -36, 48, -36);   // south, with the breach and the gate
  b.fence(48, -36, 48, -10); b.fence(48, -6, 48, 52);
  b.fence(-48, -36, -48, 52);
  b.fence(-48, 52, -4, 52); b.fence(4, 52, 48, 52);
  b.kerb(-4.2, -36, -4.2, 51); b.kerb(4.2, -36, 4.2, 51);
  b.boomGate(-4.6, -35, PI / 2, 8);
  b.cylinder(-4.6, 0, -36, 0.2, 3.6, 'steelDark'); b.cylinder(4.6, 0, -36, 0.2, 3.6, 'steelDark');
  b.booth(8, -32, 0);
  for (const z of [-31, -27, -23]) { b.bollard(-5, z); b.bollard(5, z); }
  b.sandbags(-9, -29, 0.1, 3.0);
  b.sign('BLACKSITE DELTA · RESTRICTED', 0, 3.2, -36.3, 0, 5, 0.7, { bg: '#2b2f36', fg: '#f2d777' });
  b.cylinder(-4.6, 0, 52, 0.2, 3.2, 'steelDark'); b.cylinder(4.6, 0, 52, 0.2, 3.2, 'steelDark');
  b.gateLeaf(-6.4, 53.6, PI / 2 - 0.35, 4); b.gateLeaf(6.4, 53.6, -PI / 2 + 0.35, 4);
  b.cylinder(48, 0, -10, 0.2, 3.2, 'steelDark'); b.cylinder(48, 0, -6, 0.2, 3.2, 'steelDark');
  b.gateLeaf(49.5, -11.4, PI - 0.4, 4);
  // the breach: cut mesh curling back, a culvert and blocks outside for the approach
  b.box(-30.3, 0, -36.2, 0.1, 1.6, 1.1, 'steelDark', { yaw: 0.6, material: 'metal', collide: false });
  b.box(-26.8, 0, -36.3, 0.1, 1.2, 0.9, 'steelDark', { yaw: -0.8, material: 'metal', collide: false });
  b.cylinder(-36, 0, -44, 0.8, 2.6, 'concreteDark', { material: 'concrete', segs: 16 });
  b.box(-31, 0, -43.5, 2.2, 1.0, 1.0, 'concreteDark', { yaw: 0.2, material: 'concrete' });
  b.box(-24.5, 0, -45, 2.2, 1.0, 1.0, 'concreteDark', { yaw: -0.15, material: 'concrete' });
  b.box(-20, 0, -49, 1.6, 0.8, 1.6, 'concreteDark', { yaw: 0.5, material: 'concrete' });
  { const sl = b.watchtower(43, -31, 0, 6); L.searchlights.push({ light: sl, points: [[-24, -33], [-4, -30], [16, -22]], speed: 0.09 }); }

  // ================= CONTAINER YARD (south-west) =================
  b.containerStatic(-40, -28, 0, 'containerBlue'); b.containerStatic(-33, -28, 0, 'containerGray');
  b.containerStatic(-33, -28, 0, 'containerBlue', 2.6);
  b.containerStatic(-40, -19, 0, 'containerGreen');
  b.containerStatic(-26, -28, 0, 'containerRed');
  b.containerStatic(-40, -28, 0, 'containerGreen', 2.6);
  b.containerStatic(-33, -19, 0, 'containerBlue');
  b.containerStatic(-40, -19, 0, 'containerRed', 2.6);
  b.forklift(-25, -19, 0.35);
  b.pallet(-20, -30, 0.2); b.pallet(-21.3, -30.1, 0.4, 0.14); b.crateStack(-18, -31, 0.3, 2);
  b.tireStack(-14, -31, 4); b.cableDrum(-12, -27); b.cableDrum(-12, -25.4, 0.55, 0.3);
  b.sign('YARD 1', -12.9, 2.2, -22, PI / 2, 2, 0.5);
  L.floodlights.push(b.lightPole(-16, -30, -28.5, -35.5, { height: 5.5, intensity: 900, shadow: true }));
  L.floodlights.push(b.lightPole(-30, -12, -30, -24, { height: 7, intensity: 850 }));
  L.floodlights.push(b.lightPole(-7, -31, 0, -38, { height: 7, intensity: 1000, shadow: true }));

  // ================= WAREHOUSE (west) =================
  const WX0 = -46, WX1 = -16, WZ0 = -8, WZ1 = 22, WH = 8, MZ = 2.8;
  b.floor(-31, 7, 30, 30, 'concrete', { y: 0.02, collide: false });
  b.wallWithOpenings(WX1, WZ0, WX1, WZ1, WH, 0.35, 'corrugated', [{ at: 6, w: 4.6, h: 4.6 }, { at: 16, w: 4.6, h: 4.6 }], { material: 'metal' });
  b.wallWithOpenings(WX0, WZ0, WX1, WZ0, WH, 0.35, 'corrugated', [{ at: 24, w: 1.5, h: 2.4 }], { material: 'metal' });
  b.door(WX0 + 24, WZ0, 0, { width: 1.3, height: 2.3, id: 'wh_south' });
  b.wall(WX0, WZ0, WX0, WZ1, WH, 0.35, 'corrugated', { material: 'metal' });
  b.wallWithOpenings(WX0, WZ1, WX1, WZ1, WH, 0.35, 'corrugated', [{ at: 8, w: 3, h: 1.4, sill: 5.2 }, { at: 22, w: 3, h: 1.4, sill: 5.2 }], { material: 'metal' });
  L.roofs.push(b.roof(-31, WH, 7, 30.4, 0.3, 30.4, 'steelDark', { material: 'metal', deco: () => {
    b.box(-31, WH + 0.3, WZ1, 30.4, 0.5, 0.3, 'steelDark', { material: 'metal', collide: false }); b.box(-31, WH + 0.3, WZ0, 30.4, 0.5, 0.3, 'steelDark', { material: 'metal', collide: false });
    b.acUnit(-26, WH + 0.3, 2); b.acUnit(-36, WH + 0.3, 12);
  } }).mesh);
  b.pipe(-16.2, 6.5, -6, -16.2, 6.5, 20, 0.12);
  b.canopy(-12.8, 3, 6, 15, 5.3, 0);
  b.sign('WAREHOUSE 2', -15.8, 6.4, 3, PI / 2, 5.5, 0.8, { bg: '#1f2a33', fg: '#dfe7ee' });
  b.sign('DOCK A', -15.8, 4.9, -2, PI / 2, 1.6, 0.4, { bg: '#c9a227', fg: '#1a1a1a', border: null });
  b.sign('DOCK B', -15.8, 4.9, 8, PI / 2, 1.6, 0.4, { bg: '#c9a227', fg: '#1a1a1a', border: null });
  for (const z of [-2, 8]) { L.roomLights.push(b.lamp(-12.5, 5.1, z, { intensity: 16, distance: 10, w: 0.6 })); for (const dz of [-2.1, 2.1]) b.box(-16.4, 0.4, z + dz, 0.4, 0.4, 0.3, 'rubber', { material: 'concrete', collide: false }); }
  b.racking(-38, -3, 0, 3); b.racking(-38, 3.5, 0, 3); b.racking(-38, 10, 0, 3);
  b.crateStack(-24, -4, 0, 2); b.crateStack(-22.4, -3.4, 0.3, 1);
  b.pallet(-26, -4.5, 0.1); b.pallet(-21, 0, 0.6);
  b.containerStatic(-30, 12.5, 0, 'containerGray');
  b.barrel(-19, 1, 'containerBlue'); b.barrel(-19.7, 0.4, 'containerBlue');
  b.sign('EXIT', -22, 2.6, -7.7, 0, 0.9, 0.3, { bg: '#2f7d32', fg: '#ffffff', border: null });
  // mezzanine along the north wall (z 17..22) at 2.8 m: grating floor, edge beam, posts, railing, office at the east end
  b.floor(-31, 19.5, 30, 5, 'grating', { y: MZ, thick: 0.25 });
  b.box(-31, MZ - 0.6, 17.02, 30, 0.35, 0.08, 'steelDark', { material: 'metal', collide: false });
  for (let x = -40; x <= -18; x += 5.5) b.box(x, 0, 17.15, 0.25, MZ - 0.25, 0.25, 'steelDark', { material: 'metal' });
  b.railing(-43.6, 17.05, -22.2, 17.05, MZ);
  b.staircase(-44.6, 14, 1.5, MZ, 6, 0, { rails: 'right' });
  b.wallWithOpenings(-22, 17.05, -22, 22, 2.6, 0.2, 'steel', [{ at: 2.5, w: 1.3, h: 2.3 }], { y: MZ, material: 'metal' });
  b.door(-22, 19.55, PI / 2, { width: 1.3, height: 2.3, id: 'office', mat: 'steel', y: MZ });
  b.wall(-22, 17.05, -16.2, 17.05, 2.6, 0.2, 'steel', { y: MZ, material: 'metal' });
  { const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), b.mats.get('glass')); glass.position.set(-18.5, MZ + 1.75, 17.05); b.root.add(glass); }
  b.desk(-17.4, 20.9, 0); b.locker(-16.7, 18.2, -PI / 2);
  b.sign('OFFICE', -22.12, MZ + 2.45, 19.55, -PI / 2, 1.2, 0.32, { bg: '#c9a227', fg: '#1a1a1a', border: null });
  for (const [x, z] of [[-38, -2], [-26, -2], [-38, 10], [-26, 10]]) L.roomLights.push(b.lamp(x, 6.4, z, { intensity: 40, distance: 18, w: 1.4 }));
  L.roomLights.push(b.lamp(-32, MZ + 2.4, 19.5, { intensity: 18, distance: 10 }));
  L.roomLights.push(b.lamp(-19, MZ + 2.45, 19.5, { kind: 'cool', intensity: 14, distance: 8 }));
  L.emergency.push(b.lamp(-30, 5.5, 4, { kind: 'red', intensity: 0, distance: 16, w: 0.5 }));
  // dock road east of the warehouse
  b.wedge(-10, 0, 14, 2.4, 2.6, 4.8, 'steelDark', { material: 'metal' });
  b.containerStatic(-8, -7, PI / 2, 'containerGreen');
  b.dumpster(-10, 19.5, 0.1); b.cableDrum(-7.5, 18);
  L.floodlights.push(b.lightPole(-6, 5, -16, 3, { height: 7, intensity: 850 }));

  // ================= CONTROL ROOM (east of the main road) =================
  const GX0 = 12, GX1 = 22, GZ0 = -14, GZ1 = -6, GH = 3.4;
  b.floor(17, -10, 10, 8, 'concrete', { y: 0.02, collide: false });
  b.wallWithOpenings(GX0, GZ0, GX0, GZ1, GH, 0.3, 'brick', [{ at: 4, w: 1.4, h: 2.3 }, { at: 1.3, w: 1.2, h: 1.1, sill: 1.1 }, { at: 6.7, w: 1.2, h: 1.1, sill: 1.1 }], { material: 'concrete' });
  b.door(GX0, GZ0 + 4, PI / 2, { width: 1.3, height: 2.3, id: 'guard' });
  b.wallWithOpenings(GX0, GZ1, GX1, GZ1, GH, 0.3, 'brick', [{ at: 5, w: 1.6, h: 1.1, sill: 1.1 }], { material: 'concrete' });
  b.wall(GX1, GZ0, GX1, GZ1, GH, 0.3, 'brick', { material: 'concrete' });
  b.wall(GX0, GZ0, GX1, GZ0, GH, 0.3, 'brick', { material: 'concrete' });
  L.roofs.push(b.roof(17, GH, -10, 10.4, 0.3, 8.4, 'concreteDark', { material: 'concrete', deco: () => b.acUnit(19, GH + 0.3, -9) }).mesh);
  for (const [gx, gz, ry] of [[12, -12.7, PI / 2], [12, -7.3, PI / 2], [17, -6, 0]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), b.mats.get('glass')); g.position.set(gx, 1.65, gz); g.rotation.y = ry; b.root.add(g); }
  b.desk(19.5, -11.5, PI / 2); b.locker(20.5, -7, 0); b.locker(19.5, -7, 0); b.table(15, -8, 0);
  L.roomLights.push(b.lamp(17, GH - 0.1, -10, { intensity: 22, distance: 12, kind: 'cool' }));
  L.emergency.push(b.lamp(14, GH - 0.2, -12, { kind: 'red', intensity: 0, distance: 10, w: 0.4 }));
  b.box(17, 1.0, -6.4, 0.6, 0.8, 0.2, 'steelYellow', { material: 'metal', collide: false });
  { const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), b.mats.get('emissiveGreen')); led.position.set(17.2, 1.7, -6.5); b.root.add(led); L.fuseLed = led; }
  b.sign('CONTROL', 11.85, 2.9, -10, -PI / 2, 2, 0.45, { bg: '#1f2a33', fg: '#dfe7ee' });
  b.sign('DANGER · HIGH VOLTAGE', 24.3, 1.4, -11, -PI / 2, 1.6, 0.4, { bg: '#c9a227', fg: '#1a1a1a', border: null });
  b.blastWall(23.5, -14, 29, -14, 1.3); b.blastWall(29, -14, 29, -7, 1.3); b.blastWall(23.5, -7, 29, -7, 1.3);
  b.generator(26.3, -10.5, PI / 2); b.pipe(24.5, 0.8, -8, 22.2, 0.8, -8, 0.06);
  b.module('barrier', 8, -19, 0, 'bar_r1'); b.module('barrier', 12.5, -19.5, 0, 'bar_r2'); b.module('barrier', 17, -19, 0, 'bar_r3');
  b.module('barrier', -2, -29, 0.35, 'bar_g1'); b.module('barrier', 2, -25, -0.35, 'bar_g2'); b.module('barrier', -2, -21, 0.35, 'bar_g3');
  b.zone('guardhouse', 17, -10, 12, 10);

  // ================= ARMORY (south-east shed) =================
  b.canopy(37, -26, 14, 12, 4.6, 0);
  b.wall(30, -20, 44, -20, 4.6, 0.3, 'corrugated', { material: 'metal' });
  b.wall(44, -20, 44, -32, 4.6, 0.3, 'corrugated', { material: 'metal' });
  // gun rack against the back wall: three carbines standing in it, ammo boxes below
  b.box(33.5, 0, -21.6, 3.2, 0.12, 0.5, 'steelDark', { material: 'metal' }); b.box(33.5, 1.15, -21.75, 3.2, 0.06, 0.2, 'steelDark', { material: 'metal', collide: false });
  for (const sx of [-1, 1]) b.box(33.5 + sx * 1.55, 0, -21.6, 0.08, 1.4, 0.5, 'steelDark', { material: 'metal', collide: false });
  for (let i = 0; i < 3; i++) { const r = buildRifle(b.mats, 'm4'); r.position.set(32.5 + i * 0.9, 0.75, -21.55); r.rotation.set(-PI / 2 + 0.12, 0, 0); b.root.add(r); }
  for (const [x, z, y] of [[31.2, -22.6, 0], [31.2, -22.6, 0.36], [35.8, -22.7, 0]]) b.box(x, y, z, 0.7, 0.34, 0.45, 'gunPolymer', { material: 'metal', collide: y === 0 });
  b.table(38.5, -28.5, 0); b.locker(43.2, -27.5, -PI / 2); b.locker(43.2, -25.6, -PI / 2);
  b.gasCage(42.2, -22.4, 0); b.tireStack(41.5, -30.5, 3); b.cableDrum(31.2, -29.5, 0.7);
  b.sign('ARMORY', 37, 3.6, -20.2, PI, 3.0, 0.6, { bg: '#1f2a33', fg: '#dfe7ee' });
  b.sign('AUTHORIZED PERSONNEL ONLY', 40.5, 2.6, -20.2, PI, 2.6, 0.4, { bg: '#b3261e', fg: '#ffffff', border: null });
  // fuel point north of the shed
  b.cylinder(40, 0, -14, 1.6, 3.2, 'steelDark', { material: 'metal', segs: 20 });
  b.pipe(40, 3.2, -14, 40, 3.6, -14); b.pipe(40, 1.0, -12.4, 40, 1.0, -8.3, 0.1);
  b.hazardStripe(40, -14, 4.4, 4.4, 0, 0.011);
  b.barrel(37.2, -12.6, 'containerRed'); b.barrel(37.9, -11.9, 'containerRed'); b.barrel(36.9, -11.7, 'containerRed');
  b.sign('FLAMMABLE', 40, 2.2, -15.7, PI, 1.8, 0.45, { bg: '#b3261e', fg: '#ffffff', border: null });
  L.floodlights.push(b.lightPole(28, -16, 37, -25, { height: 7, intensity: 850 }));
  L.roomLights.push(b.lamp(35, 4.4, -25, { intensity: 20, distance: 12, w: 1.0 }));
  b.zone('armory', 37, -26, 16, 14);

  // ================= CELL BLOCK (north-east) =================
  const CX0 = 8, CX1 = 40, CZ0 = 22, CZ1 = 40, CH = 4;
  b.floor(24, 31, 32, 18, 'concrete', { y: 0.02, collide: false });
  b.wallWithOpenings(CX0, CZ0, CX1, CZ0, CH, 0.35, 'brickDark', [{ at: 4, w: 1.5, h: 2.4 }, { at: 20, w: 1.4, h: 1.0, sill: 1.6 }], { material: 'concrete' });
  const cellDoor = b.door(CX0 + 4, CZ0, 0, { width: 1.3, height: 2.3, id: 'cell_main', locked: true });
  b.wall(CX0, CZ0, CX0, CZ1, CH, 0.35, 'brickDark', { material: 'concrete' });
  b.wall(CX1, CZ0, CX1, CZ1, CH, 0.35, 'brickDark', { material: 'concrete' });
  b.wallWithOpenings(CX0, CZ1, CX1, CZ1, CH, 0.35, 'brickDark', [{ at: 16, w: 1.5, h: 2.4 }], { material: 'concrete' });
  b.door(CX0 + 16, CZ1, 0, { width: 1.3, height: 2.3, id: 'cell_north' });
  L.roofs.push(b.roof(24, CH, 31, 32.4, 0.3, 18.4, 'concreteDark', { material: 'concrete' }).mesh);
  b.wallWithOpenings(CX0, 27, CX1, 27, CH, 0.25, 'concrete', [{ at: 3, w: 1.2, h: 2.2 }, { at: 9, w: 1.2, h: 2.2 }, { at: 15, w: 1.2, h: 2.2 }, { at: 21, w: 1.3, h: 2.3 }, { at: 27, w: 1.2, h: 2.2 }], { material: 'concrete' });
  for (let i = 1; i <= 5; i++) b.wall(CX0 + i * 6, 27, CX0 + i * 6, CZ1, CH, 0.25, 'concrete', { material: 'concrete' });
  for (const cx of [11, 17, 23, 35]) b.cage(cx, 27.1, 1.2, 0.1, 2.2, { gap: 0.2 });
  b.door(29, 27, 0, { width: 1.3, height: 2.3, id: 'cell_b', mat: 'steel' });
  for (const cx of [11, 17, 23, 29, 35]) { b.box(cx + 1.6, 0, 37.5, 2.0, 0.5, 0.9, 'concreteDark', { material: 'concrete' }); }
  b.desk(16, 24.5, PI); b.locker(9, 24, PI / 2); b.table(30, 24.5, 0);
  for (const x of [12, 22, 32]) L.roomLights.push(b.lamp(x, CH - 0.15, 24.5, { intensity: 22, distance: 12, kind: 'cool' }));
  for (let i = 0; i < 5; i += 2) L.roomLights.push(b.lamp(CX0 + 3 + i * 6, CH - 0.15, 33, { intensity: 12, distance: 9, kind: 'cool', w: 0.6 }));
  L.emergency.push(b.lamp(26, CH - 0.3, 24.5, { kind: 'red', intensity: 0, distance: 16, w: 0.4 }));
  b.sign('BLOCK C', 12, 3.3, 21.8, PI, 2.2, 0.5, { bg: '#1f2a33', fg: '#dfe7ee' });
  b.sign('NO ENTRY', 14.4, 2.6, 21.8, PI, 1.2, 0.32, { bg: '#b3261e', fg: '#ffffff', border: null });
  // exercise yard (fenced) south of the block, and the repair corner east of it
  b.fence(8, 12, 15, 12, 3, { razor: true }); b.fence(17, 12, 24, 12, 3, { razor: true }); b.fence(8, 12, 8, 22, 3); b.fence(24, 12, 24, 22, 3);
  b.cylinder(15, 0, 12, 0.08, 3.2, 'steelDark'); b.cylinder(17, 0, 12, 0.08, 3.2, 'steelDark');
  b.gateLeaf(18.0, 12.9, PI / 2 - 0.5, 2);
  b.table(12, 18, 0.2); b.sandbags(20, 15, 0.1, 2.4);
  b.mixer(30, 15, 0.4); b.sandPile(34.5, 14, 1.8);
  b.box(38, 0, 16, 1.0, 1.0, 1.0, 'wood', { material: 'wood' }); b.box(38.1, 1.0, 16, 1.0, 1.0, 1.0, 'wood', { yaw: 0.2, material: 'wood' });
  L.floodlights.push(b.lightPole(16, 10, 16, 18, { height: 7, intensity: 750 }));
  b.zone('cellblock', 24, 31, 34, 20); b.zone('cellDoor', 12, 19.5, 8, 5); b.zone('exercise', 16, 17, 16, 10);

  // ================= HELIPAD (north-west) =================
  b.apron(-27, 39, 30, 18, 0.3);
  b.helipad(-27, 39, 6.5, 0.32);
  b.blastWall(-42, 30.2, -34, 30.2, 1.3); b.blastWall(-20, 30.2, -12, 30.2, 1.3);
  b.sandbags(-27, 28.8, 0, 2.4);
  b.windsock(-14, 46);
  b.box(-40, 0.3, 44, 1.4, 1.1, 2.0, 'steelYellow', { yaw: 0.2, material: 'metal' }); b.barrel(-38.4, 43.8, 'containerGray', 0.3);
  b.sign('HELIPAD · H1', -27, 1.9, 29.9, 0, 2.4, 0.5, { bg: '#1f2a33', fg: '#dfe7ee' });
  L.floodlights.push(b.lightPole(-8, 32, -27, 39, { height: 8, intensity: 900, shadow: true }));
  b.zone('lz', -27, 39, 18, 16);

  // ================= ZONES, LABELS, SPAWNS =================
  b.zone('insert', -28.5, -39, 9, 7); b.zone('gate', 0, -30, 16, 12); b.zone('yard', -28, -23, 32, 20);
  b.zone('warehouse', -31, 7, 30, 30); b.zone('yardMid', 0, 4, 30, 24); b.zone('northGate', 0, 52, 8, 6);
  L.zoneLabels = [
    { key: 'zone.breach', x: -28.5, z: -37 }, { key: 'zone.gate', x: 0, z: -31 }, { key: 'zone.yard', x: -28, z: -23 },
    { key: 'zone.warehouse', x: -31, z: 7 }, { key: 'zone.guard', x: 17, z: -10 }, { key: 'zone.armory', x: 37, z: -26 },
    { key: 'zone.cells', x: 24, z: 31 }, { key: 'zone.exercise', x: 16, z: 17 }, { key: 'zone.lz', x: -27, z: 39 },
  ];
  L.spawns.player = { x: -28.5, z: -45, yaw: 0 };
  L.spawns.hostages = [{ id: 'A', x: -18.6, y: MZ, z: 19.6, yaw: PI, name: 'hostage.a' }, { id: 'B', x: 30, z: 34, yaw: PI, name: 'hostage.b' }];
  L.spawns.enemies = [
    { x: 8, z: -32.3, yaw: PI, patrol: [], zone: 'zone.gate' },                                          // booth
    { x: -2, z: -30, yaw: PI, patrol: [[-2.5, -31], [2.5, -31], [0, -24]], zone: 'zone.gate' },          // gate patrol
    { x: -36, z: -24, yaw: PI / 2, patrol: [[-36, -24], [-22, -24], [-22, -15]], zone: 'zone.yard' },    // yard patrol: the tutorial witness
    { x: -22, z: -21, yaw: -PI / 2, patrol: [], zone: 'zone.yard' },                                     // by the forklift: the tutorial kill
    // the pair: they face each other across the warehouse floor, so whoever you take first, the other sees it
    { x: -20, z: 2, yaw: PI / 2, patrol: [], zone: 'zone.warehouse' },                                   // warehouse doors, watching the doors: his back is to the floor
    { x: -33, z: 2, yaw: PI / 2, patrol: [], zone: 'zone.warehouse' },                                   // by the racks, watching the doors man's back
    // the office trio: the gunner watches the walkway and the office door; a patroller walks it; the officer holds the key
    { x: -41, z: 19.5, y: MZ, yaw: PI / 2, patrol: [], accuracy: 0.95, zone: 'zone.warehouse' },         // mezzanine gunner, looking east along the walkway
    { x: -20.6, z: 18.4, y: MZ, yaw: PI / 2, patrol: [], role: 'officer', name: 'officer', grenades: 2, zone: 'zone.warehouse' }, // office
    { x: 17, z: -10, yaw: -PI / 2, patrol: [], zone: 'zone.guard' },                                     // control room
    { x: 10, z: -10, yaw: PI, patrol: [[10, -10], [10, -18]], zone: 'zone.guard' },
    { x: 36, z: -26, yaw: -PI / 2, patrol: [], zone: 'zone.armory' },                                    // armory
    { x: 0, z: -14, yaw: 0, patrol: [[0, -14], [0, 10], [6, 20]], zone: 'zone.gate' },                   // road patrol
    // the cell block four: the two men at the ends of the corridor face each other down its length, a patroller walks it,
    // one stands at the prisoner's cell; the man at the east end wears armour
    { x: 15, z: 24.5, yaw: PI / 2, patrol: [[15, 24.5], [33, 24.5]], zone: 'zone.cells' },               // cell corridor patrol
    { x: 29.5, z: 24.5, yaw: 0, patrol: [], zone: 'zone.cells' },                                        // outside the prisoner's cell
    { x: 11, z: 24.5, yaw: PI / 2, patrol: [], zone: 'zone.cells' },                                     // inside the main door, looking down the corridor
    { x: 16, z: 17, yaw: PI, patrol: [[12, 15], [20, 19]], zone: 'zone.exercise' },                      // exercise yard
    { x: -30, z: 36, yaw: PI, patrol: [[-30, 36], [-18, 44], [-36, 46]], zone: 'zone.lz' },              // helipad sentry
    { x: -32, z: 19.5, y: MZ, yaw: PI / 2, patrol: [[-36, 19.5], [-25.5, 19.5]], zone: 'zone.warehouse' }, // walkway patroller
    { x: 37, z: 24.5, yaw: -1.27, patrol: [], role: 'heavy', name: 'heavy', look: 'heavy', maxHealth: 160, armor: true, accuracy: 0.9, zone: 'zone.cells' }, // east end: armoured, watching the prisoner's door
  ];
  L.reinforcements = { north: { x: 0, z: 55 }, east: { x: 52, z: -8 }, south: { x: 0, z: -42 } };
  L.lz = { x: -27, y: 0.3, z: 39 };
  L.cellDoorPos = { x: 12, y: 0, z: 21 };
  L.powerPos = { x: 17, y: 0, z: -7.2 };
  L.armoryPos = { x: 33.5, y: 0, z: -23.3 };
  // guided first moves: a gateway behind the forklift guard, whose back is to the east
  L.tutorial = { portalPoint: { x: -18.8, y: 0, z: -21 }, target: 3, witness: 2 };

  // ================= INTERACTABLES =================
  L.interactables.push({
    id: 'power', type: 'power', pos: new THREE.Vector3(L.powerPos.x, 0, L.powerPos.z), radius: 2.0, holdTime: 1.6, enabled: true,
    prompt: 'hud.interact.power',
    onUse: () => { game.script.cutPower(); },
  });
  L.interactables.push({
    id: 'armory', type: 'armory', pos: new THREE.Vector3(L.armoryPos.x, 0, L.armoryPos.z), radius: 2.3, holdTime: 1.2, enabled: true,
    prompt: 'hud.interact.armory',
    onUse: (p) => { p.takeRifle(); game.hud.toast(game.t('hud.rifleTaken'), 4000); game.audio.ui('objective'); game.script.onArmory && game.script.onArmory(); },
  });
  L.cellDoor = cellDoor;
  L.mezzanine = MZ;
  L.explosives = b.explosives || [];
  return L;
}

// ---------------------------------------------------------------------------
// Mission script: objectives, guided first moves, checkpoints, the alarm's consequences, extraction.
export class Level1Script {
  constructor(game, level) {
    this.game = game; this.level = level;
    this.objectives = { insert: 'active', hostage1: 'pending', hostage2: 'pending', power: 'optional', extract: 'pending', hold: 'pending' };
    this.primary = 'insert';
    this.flags = { power: true, cellUnlocked: false, lzReached: false, holdStarted: false, complete: false, hintArmory: false, hintHostage: false, hintBody: false, hintQuick: false, hintFocus: false, hintCell: false, hintStranded: false, hintLock: false, hintReporter: false, hintPair: false, hintHeavy: false, waves: 0 };
    this.tutorial = { step: 'wait', t: 0, reporter: null };   // wait → map → place → through → knife → witness → done → finished
    this.holdTime = 0; this.holdDuration = 20; this.nextWave = 0; this.waveCount = 0;
    this.heli = null; this.heliT = 0;
    this.crossings = 0; this.mapOpens = 0;
    this.time = 0;
  }

  // ---- guided first moves ----
  _tutorialStep(step) {
    const g = this.game, L = this.level; this.tutorial.step = step; this.tutorial.t = 0;
    if (step === 'map') g.hud.tutorial('map');
    else if (step === 'place') { g.hud.tutorial('place'); g.tacmap.suggest(L.tutorial.portalPoint); }
    else if (step === 'through') { g.tacmap.clearSuggestion(); g.hud.tutorial('through'); }
    else if (step === 'knife') g.hud.tutorial('knife');
    else if (step === 'witness') g.hud.tutorial('witness');
    else if (step === 'done') { g.hud.tutorial('done'); }
    else if (step === 'finished') { g.hud.tutorial(null); g.tacmap.clearSuggestion(); }
  }
  onMapEnter() { this.mapOpens++; if (this.tutorial.step === 'map') this._tutorialStep('place'); else if (this.tutorial.step === 'place') g_suggest(this); }
  onMapExit() { }
  onPortalOpened() { if (this.tutorial.step === 'place') this._tutorialStep('through'); }
  onPortalTraversal() {
    this.crossings++;
    if (this.tutorial.step === 'through') this._tutorialStep('knife');
    if (this.crossings === 3 && !this.flags.hintFocus && this.tutorial.step === 'finished') { this.flags.hintFocus = true; this.game.hint('focus'); }
  }
  onKnife(target, silent) { if (this.tutorial.step === 'knife' && !target.alive) { this._tutorialStep('done'); this.tutorial.t = 0; this.tutorial.awaitWitness = 3; } }
  onWitness(e, reason) {
    if ((this.tutorial.step === 'done' && this.tutorial.awaitWitness > 0) || this.tutorial.step === 'knife') { this.tutorial.reporter = e; this._tutorialStep('witness'); }
  }
  onAlarm(pos) {
    const g = this.game;
    if (this.tutorial.step === 'witness') this._tutorialStep('finished');
    this.spawnReinforcements(CONFIG.witness.reinforcements, 'north', pos.clone());
  }
  onArmory() { }

  // ---- power (optional) ----
  cutPower() {
    const g = this.game, L = this.level;
    if (!this.flags.power) return;
    this.flags.power = false; L.power = false;
    for (const l of L.floodlights) { l.intensity = 0; if (l.userData.fixture) l.userData.fixture.material = g.mats.get('lightHousing'); if (l.userData.cone) l.userData.cone.visible = false; }
    for (const l of L.roomLights) { l.intensity = 0; if (l.userData.fixture) l.userData.fixture.material = g.mats.get('lightHousing'); }
    for (const l of L.emergency) { l.intensity = 12; l.userData.fixture.material = g.mats.get('emissiveRed'); }
    if (L.fuseLed) L.fuseLed.material = g.mats.get('emissiveRed');
    L.cellDoor.setLocked(false); this.flags.cellUnlocked = true;
    this.objectives.power = 'done';
    for (const it of L.interactables) if (it.id === 'power') it.enabled = false;
    g.hud.toast(g.t('obj.power') + ' ✓'); g.audio.ui('objective');
    g.emitNoise(new THREE.Vector3(L.powerPos.x, 0, L.powerPos.z), 30, g.player, 'radio');
    g.checkpoint('power');
  }

  // ---- events ----
  onZoneEnter(id) {
    const g = this.game;
    if (id === 'insert' && this.objectives.insert === 'active') { this.complete('insert'); this.setPrimary('hostage1'); g.checkpoint('insert'); if (this.tutorial.step === 'wait') this._tutorialStep('map'); }
    if (id === 'armory' && !this.flags.hintArmory) { this.flags.hintArmory = true; g.hint('armory'); }
    if (id === 'warehouse' && !this.flags.hintPair && this.tutorial.step === 'finished') { this.flags.hintPair = true; g.hint('pair'); }
    if (id === 'cellDoor' && !this.flags.cellUnlocked && !this.flags.hintCell) { this.flags.hintCell = true; g.hint('cellLocked'); }
    if (id === 'lz' && this.objectives.extract === 'active' && !this.flags.lzReached) { this.flags.lzReached = true; }
  }
  onHostageFreed(h) {
    const g = this.game;
    if (h.id === 'A') { this.complete('hostage1'); this.setPrimary(this.objectives.hostage2 === 'done' ? 'extract' : 'hostage2'); g.checkpoint('hostageA'); }
    if (h.id === 'B') { this.complete('hostage2'); this.setPrimary(this.objectives.hostage1 === 'done' ? 'extract' : 'hostage1'); g.checkpoint('hostageB'); }
    if (this.objectives.hostage1 === 'done' && this.objectives.hostage2 === 'done') { this.objectives.extract = 'active'; this.setPrimary('extract'); }
    if (!this.flags.hintHostage) { this.flags.hintHostage = true; g.hint('hostage'); }
  }
  onEnemyDeath(e, info) {
    const g = this.game;
    if (e.role === 'officer' && !this.flags.cellUnlocked) { this.level.cellDoor.setLocked(false); this.flags.cellUnlocked = true; }
    if (this.tutorial.step === 'witness' && e === this.tutorial.reporter) { this._tutorialStep('done'); this.tutorial.awaitWitness = 0; }
    if (!this.flags.hintBody && this.tutorial.step === 'finished' && g.stats.kills >= 2) { this.flags.hintBody = true; g.hint('body'); }
  }

  // world position of the current primary objective (for the HUD marker)
  objectiveMarker() {
    const g = this.game, L = this.level, p = this.primary;
    if (p === 'insert') return { x: -28.5, y: 0, z: -37 };
    if (p === 'hostage1') { const h = g.hostages.find((x) => x.id === 'A'); return h && h.alive ? h.pos : null; }
    if (p === 'hostage2') { const h = g.hostages.find((x) => x.id === 'B'); return h && h.alive ? h.pos : null; }
    if (p === 'extract' || p === 'hold') return L.lz;
    return null;
  }
  complete(id) { this.objectives[id] = 'done'; this.game.hud.toast(this.game.t('obj.' + id) + ' ✓'); this.game.audio.ui('objective'); }
  setPrimary(id) { this.primary = id; if (this.objectives[id] === 'pending') this.objectives[id] = 'active'; this.game.hud.setObjective(this.game.t('obj.' + id), this.objectives.power === 'optional' ? this.game.t('obj.power') : null); }

  spawnReinforcements(n, gate, target) {
    const g = this.game, p = this.level.reinforcements[gate];
    for (let i = 0; i < n; i++) {
      const e = g.spawnEnemy({ x: p.x + (i - 1) * 1.6, z: p.z + (i % 2) * 1.5, yaw: Math.atan2(target.x - p.x, target.z - p.z), patrol: [], grenades: 1, zone: 'zone.gate' });
      e.state = 'search'; e.investigate = target.clone(); e.lastKnown.copy(target); e.searchUntil = g.time + 60; e.alertLevel = 2;
    }
    g.audio.ui('alert');
  }

  update(dt) {
    // a freed prisoner left behind (you gated away and closed the gateway): tell the player how to fetch him
    if (!this.flags.hintStranded) {
      const g = this.game, far = g.hostages.find((h) => h.alive && h.state === 'freed' && h.pos.distanceTo(g.player.pos) > 18);
      this._strandedT = far && !g.portals.active ? (this._strandedT || 0) + dt : 0;
      if (this._strandedT > 5) {
        // stranded only when he has no walking route to you (a partial path ends short of you)
        const path = g.nav.findPath(far.pos, g.player.pos);
        if (!path || path[path.length - 1].distanceTo(g.player.pos) > 4) { this.flags.hintStranded = true; g.hint('stranded'); }
        else this._strandedT = -10;
      }
    }
    const g = this.game, L = this.level;
    this.time += dt;
    const tut = this.tutorial; tut.t += dt;
    // the lock: taught the first time a guard can be locked after the tutorial, and again when a reporter can be
    if (tut.step === 'finished' && g.player.lockTarget) {
      if (!this.flags.hintLock) { this.flags.hintLock = true; g.hint('lock'); }
      else if (!this.flags.hintReporter && g.player.lockTarget.report.active) { this.flags.hintReporter = true; g.hint('reporter'); }
      else if (!this.flags.hintHeavy && g.player.lockTarget.armor) { this.flags.hintHeavy = true; g.hint('heavy'); }
    }
    if (tut.step === 'done') { if (tut.awaitWitness > 0) tut.awaitWitness -= dt; if (tut.t > 7 && !(tut.awaitWitness > 0)) this._tutorialStep('finished'); }
    if (tut.step === 'witness' && (!tut.reporter || !tut.reporter.alive || !tut.reporter.report.active)) { if (g.alarm) this._tutorialStep('finished'); else this._tutorialStep('done'); }
    if (tut.step === 'knife' && tut.t > 40) this._tutorialStep('finished');
    if (tut.step === 'finished' && !this.flags.hintQuick && this.mapOpens >= 3) { this.flags.hintQuick = true; g.hint('quick'); }
    // extraction: everyone on the pad, then the helicopter comes in
    if (this.objectives.extract === 'active') {
      const zone = L.zones.lz;
      const alive = g.hostages.filter((h) => h.alive);
      const hostagesIn = alive.filter((h) => zone.contains(h.pos)).length;
      if (hostagesIn === alive.length && zone.contains(g.player.pos) && !this.flags.holdStarted) {
        this.flags.holdStarted = true; this.objectives.extract = 'done'; this.objectives.hold = 'active'; this.setPrimary('hold');
        this.holdTime = 0; this.nextWave = 4; this.waveCount = 0;
        for (const h of alive) h.state = 'extracted';
        g.checkpoint('lz');
        g.hud.toast(g.t('obj.extract') + ' ✓'); g.audio.ui('objective');
        this.spawnHeli();
      }
    }
    if (this.objectives.hold === 'active') {
      this.holdTime += dt; this.nextWave -= dt;
      const remaining = Math.max(0, this.holdDuration - this.holdTime);
      g.hud.setTimer(remaining);
      if (g.alarm && this.nextWave <= 0 && remaining > 8 && this.waveCount < 2) { this.waveCount++; this.nextWave = 10; this.spawnReinforcements(3, this.waveCount % 2 ? 'north' : 'east', new THREE.Vector3(L.lz.x, 0, L.lz.z)); }
      if (this.heli) this.updateHeli(dt, remaining);
      if (remaining <= 0 && !this.flags.complete) {
        if (L.zones.lz.contains(g.player.pos)) { this.flags.complete = true; this.objectives.hold = 'done'; g.hud.setTimer(null); g.missionComplete(); }
      }
    }
    for (const h of g.hostages) if (!h.alive && !this.flags.failed) { this.flags.failed = true; g.missionFailed('hostage'); }
  }

  spawnHeli() {
    const g = this.game, L = this.level;
    const grp = new THREE.Group();
    const m = g.mats;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 7), m.get('steelDark')); body.castShadow = true; grp.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), m.get('steelDark')); nose.position.set(0, 0, 3.5); nose.scale.set(1, 0.9, 1.2); grp.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 6), m.get('steelDark')); tail.position.set(0, 0.4, -6); grp.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.2), m.get('steelDark')); fin.position.set(0, 1.3, -8.6); grp.add(fin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8), m.get('gunmetal')); mast.position.set(0, 1.5, 0); grp.add(mast);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.04, 32), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.35 })); rotor.position.set(0, 1.9, 0); grp.add(rotor);
    const skids = [new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 5), m.get('gunmetal')), new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 5), m.get('gunmetal'))]; skids[0].position.set(-1.1, -1.6, 0); skids[1].position.set(1.1, -1.6, 0); grp.add(...skids);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), m.get('glass')); glass.position.set(0, 0.5, 3.8); grp.add(glass);
    const nav = new THREE.PointLight(0xff3020, 30, 20); nav.position.set(0, 0.5, -8); grp.add(nav);
    const spot = new THREE.SpotLight(0xffffff, 1500, 80, 0.5, 0.6, 1.5); spot.position.set(0, -1.2, 2); spot.target.position.set(0, -30, 6); grp.add(spot); grp.add(spot.target);
    grp.position.set(L.lz.x, 70, L.lz.z - 70); g.scene.add(grp);
    this.heli = { grp, rotor, spot, nav, t: 0 };
  }
  updateHeli(dt, remaining) {
    const h = this.heli, L = this.level; h.t += dt;
    h.rotor.rotation.y += dt * 30;
    const k = THREE.MathUtils.clamp((this.holdDuration - remaining) / (this.holdDuration - 2), 0, 1);
    const e = 1 - Math.pow(1 - k, 2);
    h.grp.position.set(L.lz.x + Math.sin(h.t * 0.7) * 0.6, 70 - e * 65.7, L.lz.z - 70 + e * 70);
    h.grp.rotation.z = Math.sin(h.t * 0.9) * 0.03; h.grp.rotation.x = (1 - e) * 0.15;
    h.nav.intensity = Math.sin(h.t * 8) > 0 ? 30 : 0;
    this.game.audio.heli(h.grp.position, 1);
    this.game.heliDown = k > 0.95;
  }

  snapshot() { return { objectives: { ...this.objectives }, primary: this.primary, flags: { ...this.flags }, holdTime: this.holdTime, waveCount: this.waveCount, nextWave: this.nextWave, tutorial: this.tutorial.step, crossings: this.crossings, mapOpens: this.mapOpens }; }
  restore(s) {
    this.objectives = { ...s.objectives }; this.primary = s.primary; this.flags = { ...s.flags, failed: false, complete: false, holdStarted: false };
    if (this.objectives.hold === 'active') { this.objectives.hold = 'pending'; this.objectives.extract = 'active'; this.primary = 'extract'; }
    this.holdTime = 0; this.waveCount = s.waveCount; this.nextWave = s.nextWave; this.crossings = s.crossings || 0; this.mapOpens = s.mapOpens || 0;
    const st = s.tutorial;
    this.tutorial = { step: st === 'wait' ? 'wait' : (st === 'map' || st === 'place' || st === 'through' || st === 'knife') ? 'map' : 'finished', t: 0, reporter: null };
    this.game.tacmap.clearSuggestion(); this.game.hud.tutorial(this.tutorial.step === 'map' ? 'map' : null);
    if (this.heli) { this.game.scene.remove(this.heli.grp); this.heli = null; }
    if (!this.flags.power) { const L = this.level, g = this.game; L.power = false; for (const l of L.floodlights) { l.intensity = 0; if (l.userData.cone) l.userData.cone.visible = false; if (l.userData.fixture) l.userData.fixture.material = g.mats.get('lightHousing'); } for (const l of L.roomLights) { l.intensity = 0; if (l.userData.fixture) l.userData.fixture.material = g.mats.get('lightHousing'); } for (const l of L.emergency) { l.intensity = 12; l.userData.fixture.material = g.mats.get('emissiveRed'); } if (L.fuseLed) L.fuseLed.material = g.mats.get('emissiveRed'); }
    this.level.cellDoor.setLocked(!this.flags.cellUnlocked);
    for (const it of this.level.interactables) if (it.id === 'power') it.enabled = this.flags.power;
    this.setPrimary(this.primary);
    this.game.hud.setTimer(null);
  }
}
function g_suggest(script) { script.game.tacmap.suggest(script.level.tutorial.portalPoint); }
