// Mission 01 — Blacksite Delta. Geometry, lighting, modules, spawns, and the mission script.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

export const LEVEL1_BOUNDS = { minX: -70, maxX: 70, minZ: -70, maxZ: 70 };

export function buildLevel1(game, b) {
  const L = { modules: b.modules, doors: b.doors, zones: b.zones, interactables: [], spawns: { squad: [], enemies: [], hostages: [] }, power: true, floodlights: [], roomLights: [], emergency: [], name: 'Blacksite Delta' };

  // ================= GROUND =================
  b.plane(0, 0, -50, 140, 34, 'dirt');                // outside, south
  b.plane(0, 0, 8, 140, 92, 'asphalt');               // compound yard
  b.plane(0, 0, 62, 140, 20, 'dirt');                 // outside, north
  b.plane(-60, 0.001, 8, 20, 92, 'dirt'); b.plane(60, 0.001, 8, 20, 92, 'dirt');
  // road markings & wear
  for (let i = 0; i < 6; i++) b.hazardStripe(0, -20 + i * 6, 0.25, 3, 0, 0.012);

  // ================= PERIMETER FENCE =================
  b.fence(-50, -38, -3, -38); b.fence(3, -38, 50, -38);           // south fence with breach
  b.fence(50, -38, 50, 52); b.fence(-50, -38, -50, 52);           // sides
  b.fence(-50, 52, -3, 52); b.fence(3, 52, 50, 52);               // north fence with gate
  // approach cover outside the fence: concrete blocks and a drainage culvert
  b.box(-4.5, 0, -44, 2.4, 1.1, 1.0, 'concreteDark', { yaw: 0.15, material: 'concrete' });
  b.box(5, 0, -46, 2.4, 1.1, 1.0, 'concreteDark', { yaw: -0.2, material: 'concrete' });
  b.box(-9, 0, -49, 1.6, 0.9, 1.6, 'concreteDark', { yaw: 0.6, material: 'concrete' });
  b.cylinder(9, 0, -50, 0.9, 2.2, 'concreteDark', { material: 'concrete', segs: 16 });
  // breach debris
  b.box(-3.6, 0, -37.5, 0.12, 1.4, 1.2, 'steelDark', { yaw: 0.5, material: 'metal', collide: false });
  b.box(3.4, 0, -38.2, 0.12, 0.9, 1.0, 'steelDark', { yaw: -0.7, material: 'metal', collide: false });
  // north gate posts + boom
  b.cylinder(-3.2, 0, 52, 0.25, 3.4, 'steelDark'); b.cylinder(3.2, 0, 52, 0.25, 3.4, 'steelDark');

  // ================= YARD PROPS =================
  b.sandbags(-7, -30, 0, 3.2); b.sandbags(7.5, -29, 0.2, 2.4);
  b.generator(-20, -32, 0.1);
  b.truck(17, -22, 0.25);
  for (let i = 0; i < 5; i++) b.barrel(22 + (i % 3) * 0.7, -30 + Math.floor(i / 3) * 0.7, i % 2 ? 'containerRed' : 'containerBlue');
  b.barrel(-16, -27, 'containerGray'); b.barrel(-16.7, -26.6, 'containerRed');
  b.pallet(-24, -24, 0.3); b.pallet(-25.2, -24.2, 0.1, 0.14); b.crateStack(-27, -28, 0.4, 2);
  // static containers (west yard stack)
  b.box(-34, 0, -24, 6, 2.6, 2.45, 'containerBlue', { yaw: 0.05, material: 'metal' });
  b.box(-34, 2.6, -24.4, 6, 2.6, 2.45, 'containerRed', { yaw: -0.02, material: 'metal' });
  b.box(-34, 0, -30, 6, 2.6, 2.45, 'containerGray', { material: 'metal' });
  // east yard: fuel tank + pipes
  b.cylinder(36, 0, -26, 1.6, 3.2, 'steelDark', { material: 'metal', segs: 20 });
  b.pipe(36, 3.2, -26, 36, 3.6, -26); b.pipe(36, 1.0, -24.4, 36, 1.0, -14, 0.1); b.pipe(36, 1.0, -14, 30, 1.0, -14, 0.1);
  b.hazardStripe(36, -26, 4.2, 4.2, 0, 0.011);
  // static barriers mid-yard
  b.box(8, 0, -2, 2.4, 1.05, 0.5, 'concreteDark', { yaw: 0.2, material: 'concrete' });
  b.box(10.6, 0, -1.6, 2.4, 1.05, 0.5, 'concreteDark', { yaw: 0.2, material: 'concrete' });
  b.sandbags(-6, 22, 0.1, 3);
  b.crateStack(2, 16, 0.2, 3); b.pallet(4, 17, 0.5);
  // light poles (floodlights, powered)
  L.floodlights.push(b.lightPole(-13, -28, 0, -37, { shadow: true, intensity: 1100 }));
  L.floodlights.push(b.lightPole(30, -32, 16, -22, { intensity: 900 }));
  L.floodlights.push(b.lightPole(-40, 4, -20, 6, { intensity: 900 }));
  L.floodlights.push(b.lightPole(44, 6, 24, 4, { shadow: true, intensity: 1000 }));
  L.floodlights.push(b.lightPole(-6, 30, -8, 40, { intensity: 700 }));
  L.floodlights.push(b.lightPole(44, 46, 30, 40, { intensity: 700 }));

  // ================= WAREHOUSE (west) =================
  const WX0 = -42, WX1 = -14, WZ0 = -12, WZ1 = 18, WH = 8;
  b.floor(-28, 3, 28, 30, 'concrete', { y: 0.02, collide: false });
  // walls: east wall with roller-door opening at z=-4 (5m wide, 4m high) and a personnel door at z=10
  b.wallWithOpenings(WX1, WZ0, WX1, WZ1, WH, 0.35, 'corrugated', [{ at: 8, w: 5, h: 4.2 }, { at: 22, w: 1.5, h: 2.4 }], { material: 'metal' });
  b.door(WX1, WZ0 + 22, Math.PI / 2, { width: 1.3, height: 2.3, id: 'wh_east' });
  // south wall with personnel door at x=-20
  b.wallWithOpenings(WX0, WZ0, WX1, WZ0, WH, 0.35, 'corrugated', [{ at: 22, w: 1.5, h: 2.4 }], { material: 'metal' });
  b.door(WX0 + 22, WZ0, 0, { width: 1.3, height: 2.3, id: 'wh_south' });
  // west & north walls, windows high up on the north wall
  b.wall(WX0, WZ0, WX0, WZ1, WH, 0.35, 'corrugated', { material: 'metal' });
  b.wallWithOpenings(WX0, WZ1, WX1, WZ1, WH, 0.35, 'corrugated', [{ at: 8, w: 3, h: 1.4, sill: 5.2 }, { at: 20, w: 3, h: 1.4, sill: 5.2 }], { material: 'metal' });
  // roof (collider so nothing falls in; not climbable from inside)
  b.box(-28, WH, 3, 28.4, 0.3, 30.4, 'steelDark', { material: 'metal', climbable: false });
  b.acUnit(-24, WH + 0.3, 0); b.acUnit(-32, WH + 0.3, 8); b.pipe(-14, 6.5, -6, -14, 6.5, 14, 0.12);
  // roof edge parapet visuals
  b.box(-28, WH + 0.3, WZ1, 28.4, 0.5, 0.3, 'steelDark', { material: 'metal', collide: false });
  b.box(-28, WH + 0.3, WZ0, 28.4, 0.5, 0.3, 'steelDark', { material: 'metal', collide: false });
  // mezzanine along the north wall at 2.8m, 5m deep, with railing on the south edge
  const MZ = 2.8;
  b.floor(-28, 15.5, 28, 5, 'grating', { y: MZ, thick: 0.25 });
  b.box(-28, MZ - 0.6, 13.02, 28, 0.35, 0.08, 'steelDark', { material: 'metal', collide: false }); // edge beam
  for (let x = -40; x <= -16; x += 6) b.box(x, 0, 13.1, 0.25, MZ - 0.25, 0.25, 'steelDark', { material: 'metal' }); // support posts
  b.railing(WX0 + 0.2, 13.05, -22.2, 13.05, MZ); // railing (gap in front of the office door? office spans x -20..-14)
  // static stairs at the west end: from z=7.5 (low) up to z=13 (high), width 1.6, at x=-40.5
  b.stairs(-40.6, 10.2, 1.6, MZ, 5.6, 0, 'steelDark');
  b.railing(-39.8, 7.4, -39.8, 13, 0, 1.0); // side rail (ground level visual)
  // office on the mezzanine east end (x -20..-14, z 13..18): walls with a door facing west
  b.wall(-20, 13, -20, 18, 2.6, 0.2, 'steel', { y: MZ, material: 'metal' });
  const officeDoorWall = b.wallWithOpenings(-20, 13.05, -14.2, 13.05, 2.6, 0.2, 'steel', [{ at: 1.4, w: 1.3, h: 2.3 }], { y: MZ, material: 'metal' });
  b.door(-18.6, 13.05, 0, { width: 1.3, height: 2.3, id: 'office', mat: 'steel' });
  // hmm: office door is on the south face (opening onto the mezzanine walkway)
  b.desk(-16.5, 16.5, 0); b.locker(-15, 14.2, Math.PI / 2);
  b.lamp(-17, MZ + 2.5, 15.5, { kind: 'cool', intensity: 14, distance: 8 });
  // office window (south face, above door row) — a glass pane
  { const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), b.mats.get('glass')); glass.position.set(-15.9, MZ + 1.7, 13.05); b.root.add(glass); }
  // warehouse contents: shelving and crates (static)
  for (let i = 0; i < 3; i++) { b.box(-38, 0, -6 + i * 4, 1.2, 4, 3.2, 'steelDark', { material: 'metal' }); }
  b.crateStack(-33, -8, 0.1, 2); b.crateStack(-31.6, -8.2, 0.3, 1); b.pallet(-30, -8, 0);
  b.crateStack(-22, 10, 0.2, 2); b.pallet(-24, 10.5, 0.8);
  b.barrel(-16.5, -9, 'containerBlue'); b.barrel(-17.2, -9.6, 'containerBlue'); b.barrel(-16.8, -10.3, 'containerGray');
  b.box(-26, 0, -2, 2.4, 1.05, 0.5, 'concreteDark', { yaw: 1.2, material: 'concrete' }); // static barrier on the floor
  // interior lights (warm, hanging)
  for (const [x, z] of [[-34, -4], [-22, -4], [-34, 8], [-22, 8]]) { L.roomLights.push(b.lamp(x, 6.4, z, { intensity: 40, distance: 18, w: 1.4 })); }
  L.roomLights.push(b.lamp(-30, MZ + 2.4, 15.5, { intensity: 18, distance: 10 }));
  // emergency lights (off until the power is cut)
  L.emergency.push(b.lamp(-28, 5.5, 2, { kind: 'red', intensity: 0, distance: 16, w: 0.5 }));

  // ================= GUARD HOUSE (east) =================
  const GX0 = 14, GX1 = 24, GZ0 = -14, GZ1 = -6, GH = 3.4;
  b.floor(19, -10, 10, 8, 'concrete', { y: 0.02, collide: false });
  b.wallWithOpenings(GX0, GZ0, GX0, GZ1, GH, 0.3, 'brick', [{ at: 4, w: 1.4, h: 2.3 }, { at: 1.3, w: 1.2, h: 1.1, sill: 1.1 }, { at: 6.7, w: 1.2, h: 1.1, sill: 1.1 }], { material: 'concrete' });
  b.door(GX0, GZ0 + 4, Math.PI / 2, { width: 1.3, height: 2.3, id: 'guard' });
  b.wallWithOpenings(GX0, GZ1, GX1, GZ1, GH, 0.3, 'brick', [{ at: 5, w: 1.6, h: 1.1, sill: 1.1 }], { material: 'concrete' });
  b.wall(GX1, GZ0, GX1, GZ1, GH, 0.3, 'brick', { material: 'concrete' });
  b.wall(GX0, GZ0, GX1, GZ0, GH, 0.3, 'brick', { material: 'concrete' });
  b.box(19, GH, -10, 10.4, 0.3, 8.4, 'concreteDark', { material: 'concrete', climbable: false });
  b.acUnit(21, GH + 0.3, -9);
  for (const z of [-12, -8]) for (const x of [14, 19]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), b.mats.get('glass')); g.position.set(x === 14 ? 14 : 19, 1.65, x === 14 ? z : -6); g.rotation.y = x === 14 ? Math.PI / 2 : 0; if (x === 19 && z === -12) continue; b.root.add(g); }
  b.desk(21, -11.5, Math.PI / 2); b.locker(22.5, -7, 0); b.locker(21.5, -7, 0); b.table(17, -8, 0);
  L.roomLights.push(b.lamp(19, GH - 0.1, -10, { intensity: 22, distance: 12, kind: 'cool' }));
  L.emergency.push(b.lamp(16, GH - 0.2, -12, { kind: 'red', intensity: 0, distance: 10, w: 0.4 }));
  // fuse box on the north wall (inside)
  b.box(19, 1.0, -6.4, 0.6, 0.8, 0.2, 'steelYellow', { material: 'metal', collide: false });
  { const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), b.mats.get('emissiveGreen')); led.position.set(19.2, 1.7, -6.5); b.root.add(led); L.fuseLed = led; }
  b.zone('guardhouse', 19, -10, 12, 10);

  // ================= CELL BLOCK (north-east) =================
  const CX0 = 8, CX1 = 40, CZ0 = 22, CZ1 = 40, CH = 4;
  b.floor(24, 31, 32, 18, 'concrete', { y: 0.02, collide: false });
  // south wall: main entrance (locked) at x=12
  b.wallWithOpenings(CX0, CZ0, CX1, CZ0, CH, 0.35, 'brickDark', [{ at: 4, w: 1.5, h: 2.4 }, { at: 20, w: 1.4, h: 1.0, sill: 1.6 }], { material: 'concrete' });
  const cellDoor = b.door(CX0 + 4, CZ0, 0, { width: 1.3, height: 2.3, id: 'cell_main', locked: true });
  // west wall with a sealed 3m opening (steel panel module fits in it)
  b.wallWithOpenings(CX0, CZ0, CX0, CZ1, CH, 0.35, 'brickDark', [{ at: 9.5, w: 3.1, h: 2.65 }], { material: 'concrete' });
  b.wall(CX1, CZ0, CX1, CZ1, CH, 0.35, 'brickDark', { material: 'concrete' });
  b.wallWithOpenings(CX0, CZ1, CX1, CZ1, CH, 0.35, 'brickDark', [{ at: 16, w: 1.5, h: 2.4 }], { material: 'concrete' });
  b.door(CX0 + 16, CZ1, 0, { width: 1.3, height: 2.3, id: 'cell_north' });
  b.box(24, CH, 31, 32.4, 0.3, 18.4, 'concreteDark', { material: 'concrete', climbable: false });
  b.acUnit(30, CH + 0.3, 30); b.acUnit(18, CH + 0.3, 34);
  // interior: corridor along the south (z 22..27), cells north of z=27 with bar fronts
  b.wallWithOpenings(CX0, 27, CX1, 27, CH, 0.25, 'concrete', [{ at: 6, w: 1.2, h: 2.2 }, { at: 12, w: 1.2, h: 2.2 }, { at: 18, w: 1.2, h: 2.2 }, { at: 24, w: 1.2, h: 2.2 }, { at: 30, w: 1.2, h: 2.2 }], { material: 'concrete' });
  for (let i = 1; i <= 5; i++) b.wall(CX0 + i * 6, 27, CX0 + i * 6, CZ1, CH, 0.25, 'concrete', { material: 'concrete' });
  // bars on cell fronts (the openings) — cage-like doors, most open, one locked with hostage
  for (let i = 0; i < 5; i++) { const x = CX0 + 6 + i * 6; if (i === 3) continue; b.cage(x, 27.1, 1.2, 0.1, 2.2, { gap: 0.2 }); }
  b.cage(CX0 + 6 + 3 * 6, 27.1, 1.2, 0.1, 2.2, { gap: 0.2 });
  // guard desk near the entrance
  b.desk(16, 24.5, Math.PI); b.locker(9, 24, Math.PI / 2); b.table(30, 24.5, 0);
  for (const x of [12, 22, 32]) L.roomLights.push(b.lamp(x, CH - 0.15, 24.5, { intensity: 22, distance: 12, kind: 'cool' }));
  for (let i = 0; i < 5; i += 2) L.roomLights.push(b.lamp(CX0 + 3 + i * 6, CH - 0.15, 33, { intensity: 12, distance: 9, kind: 'cool', w: 0.6 }));
  L.emergency.push(b.lamp(26, CH - 0.3, 24.5, { kind: 'red', intensity: 0, distance: 16, w: 0.4 }));
  b.zone('cellblock', 24, 31, 34, 20);
  b.zone('cellDoor', 12, 19.5, 8, 5);

  // ================= HELIPAD (north-west) =================
  b.helipad(-26, 40, 6.5);
  // low wall on the south side with gaps
  b.box(-34, 0, 31, 6, 0.9, 0.4, 'concreteDark', { material: 'concrete' }); b.box(-20, 0, 31, 6, 0.9, 0.4, 'concreteDark', { material: 'concrete' });
  b.box(-14.5, 0, 36, 0.4, 0.9, 6, 'concreteDark', { material: 'concrete' });
  b.sandbags(-26, 30.5, 0, 2.4);
  b.zone('lz', -26, 40, 16, 16);
  b.crateStack(-40, 44, 0.3, 2); b.barrel(-41, 36, 'containerRed'); b.barrel(-41.7, 36.5, 'containerRed');

  // ================= MOVABLE MODULES =================
  b.module('barrier', 4, -33, 0, 'bar_breach');
  b.module('barrier', -10, -24, 0, 'bar_yard1');
  b.module('barrier', 12, 8, Math.PI / 2, 'bar_yard2');
  b.module('barrier', -24, -8, Math.PI / 2, 'bar_wh1');
  b.module('barrier', -18, 4, 0, 'bar_wh2');
  b.module('panel', 30, -2, 0, 'panel_yard');
  b.module('panel', 8, 31.5, Math.PI / 2, 'panel_cell');            // seals the cell block west opening
  b.module('container', 31, -8, Math.PI / 2, 'cont_yard');
  b.module('container', -30, -6, 0, 'cont_wh');
  b.module('container', 30, 14, 0.0, 'cont_yard2');
  b.module('crate', -36, -2, 0, 'crate1'); b.module('crate', -34, 0, 0, 'crate2'); b.module('crate', -26, 8, 0, 'crate3');
  b.module('crate', 14, 2, 0, 'crate4');
  b.module('ramp', -22, 2, 0, 'ramp_wh');
  b.module('ramp', 38, 10, Math.PI, 'ramp_yard');
  b.module('catwalk', -6, 12, 0, 'catwalk1');
  b.module('stairs', 4, 8, 0, 'stairs1');

  // ================= ZONES =================
  b.zone('insert', 0, -37, 10, 5);
  b.zone('warehouse', -28, 3, 27, 29);
  b.zone('yardMid', 0, 5, 30, 20);
  b.zone('northGate', 0, 52, 8, 6);

  // ================= SPAWNS =================
  L.spawns.player = { x: 0, z: -57, yaw: 0 };
  L.spawns.squad = [{ x: -2.2, z: -59, yaw: 0, name: 'squad.reyes' }, { x: 2.2, z: -59, yaw: 0, name: 'squad.kovac' }];
  L.spawns.hostages = [{ id: 'A', x: -17, y: MZ, z: 16.5, yaw: Math.PI, name: 'hostage.a' }, { id: 'B', x: 29, z: 34, yaw: Math.PI, name: 'hostage.b' }];
  L.spawns.enemies = [
    // yard
    { x: -9, z: -31, yaw: Math.PI / 2, patrol: [[-9, -31], [-2, -28], [-12, -26]], name: 'Guard' },
    { x: 20, z: -27, yaw: Math.PI, patrol: [[20, -27], [30, -16], [10, -14]] },
    { x: -28, z: -20, yaw: 0, patrol: [[-28, -20], [-20, -16], [-8, -12]] },
    { x: 2, z: 4, yaw: Math.PI, patrol: [[2, 4], [-6, 14], [6, 18]] },
    { x: 12, z: -16, yaw: Math.PI, patrol: [[12, -16], [12, -24]] },
    // warehouse
    { x: -30, z: 0, yaw: Math.PI / 2, patrol: [[-30, 0], [-20, -6], [-34, 6]] },
    { x: -17, z: -4, yaw: -Math.PI / 2, patrol: [] },
    { x: -37, z: 15.5, y: MZ, yaw: Math.PI, patrol: [], accuracy: 0.95 },      // mezzanine gunner
    { x: -24, z: 15.5, y: MZ, yaw: -Math.PI / 2, patrol: [], role: 'officer', name: 'Officer', grenades: 2 }, // outside the office door
    // guard house
    { x: 20, z: -10, yaw: -Math.PI / 2, patrol: [] },
    // cell block
    { x: 14, z: 24.5, yaw: Math.PI / 2, patrol: [[14, 24.5], [36, 24.5]] },
    { x: 33, z: 24, yaw: -Math.PI / 2, patrol: [] },
    { x: 24, z: 35, yaw: Math.PI, patrol: [] },
    // helipad sentry
    { x: -30, z: 36, yaw: Math.PI, patrol: [[-30, 36], [-18, 44], [-36, 46]] },
    // east yard
    { x: 34, z: 4, yaw: Math.PI, patrol: [[34, 4], [40, 16], [26, 20]] },
  ];
  L.reinforcements = { north: { x: 0, z: 56 }, east: { x: 46, z: 0 }, south: { x: 0, z: -44 } };

  // ================= INTERACTABLES =================
  L.interactables.push({
    id: 'power', type: 'power', pos: new THREE.Vector3(19, 0, -7.2), radius: 2.0, holdTime: 1.6, enabled: true,
    prompt: 'hud.interact.power',
    onUse: () => { game.script.cutPower(); },
  });
  L.cellDoor = cellDoor;
  L.mezzanine = MZ;
  return L;
}

// ---------------------------------------------------------------------------
// Mission script: objectives, checkpoints, reinforcements, hints, extraction.
export class Level1Script {
  constructor(game, level) {
    this.game = game; this.level = level;
    this.objectives = { insert: 'active', hostage1: 'pending', hostage2: 'pending', power: 'optional', extract: 'pending', hold: 'pending' };
    this.primary = 'insert';
    this.flags = { power: true, key: false, cellUnlocked: false, waveA: false, waveB: false, lzReached: false, holdStarted: false, complete: false, hintArch: false, hintHeight: false, hintPower: false, hintHostage: false, hintOrder: false, hintGrenade: false, hintVault: false };
    this.holdTime = 0; this.holdDuration = 90; this.nextWave = 0; this.waveCount = 0;
    this.heli = null; this.heliT = 0;
    this.time = 0;
  }

  // ---- power ----
  cutPower() {
    const g = this.game, L = this.level;
    if (!this.flags.power) return;
    this.flags.power = false; L.power = false;
    for (const l of L.floodlights) { l.intensity = 0; if (l.userData.fixture) l.userData.fixture.material = g.mats.get('lightHousing'); }
    for (const l of L.roomLights) { l.intensity = 0; if (l.userData.fixture) l.userData.fixture.material = g.mats.get('lightHousing'); }
    for (const l of L.emergency) { l.intensity = 12; l.userData.fixture.material = g.mats.get('emissiveRed'); }
    if (L.fuseLed) L.fuseLed.material = g.mats.get('emissiveRed');
    L.cellDoor.setLocked(false); this.flags.cellUnlocked = true;
    this.objectives.power = 'done';
    for (const it of L.interactables) if (it.id === 'power') it.enabled = false;
    g.hud.toast(g.t('obj.power') + ' ✓'); g.audio.ui('objective');
    g.architect.addEnergy(30);
    g.emitNoise(new THREE.Vector3(19, 0, -7), 30, g.player, 'radio'); // guards notice the lights going out
    g.checkpoint('power');
    // a couple of cell-block guards come to investigate
    this.spawnReinforcements(2, 'north', new THREE.Vector3(16, 0, -12));
  }

  // ---- events ----
  onZoneEnter(id) {
    const g = this.game;
    if (id === 'insert' && this.objectives.insert === 'active') { this.complete('insert'); this.setPrimary('hostage1'); g.checkpoint('insert'); setTimeout(() => g.hint('architect'), 2500); }
    if (id === 'warehouse' && !this.flags.hintHeight) { this.flags.hintHeight = true; g.hint('height'); }
    if (id === 'guardhouse' && !this.flags.hintPower) { this.flags.hintPower = true; g.hint('power'); }
    if (id === 'yardMid' && !this.flags.hintOrder) { this.flags.hintOrder = true; g.hint('order'); }
    if (id === 'lz' && this.objectives.extract === 'active' && !this.flags.lzReached) { this.flags.lzReached = true; }
    if (id === 'cellDoor' && !this.flags.cellUnlocked && !this.flags.hintCell) { this.flags.hintCell = true; g.hint('cellLocked'); }
  }
  onHostageFreed(h) {
    const g = this.game;
    if (h.id === 'A') { this.complete('hostage1'); this.setPrimary(this.objectives.hostage2 === 'done' ? 'extract' : 'hostage2'); g.checkpoint('hostageA'); g.architect.addEnergy(40); if (!this.flags.waveA) { this.flags.waveA = true; this.spawnReinforcements(3, 'north', new THREE.Vector3(-20, 0, 8)); } }
    if (h.id === 'B') { this.complete('hostage2'); this.setPrimary(this.objectives.hostage1 === 'done' ? 'extract' : 'hostage1'); g.checkpoint('hostageB'); g.architect.addEnergy(40); if (!this.flags.waveB) { this.flags.waveB = true; this.spawnReinforcements(3, 'east', new THREE.Vector3(24, 0, 20)); } }
    if (this.objectives.hostage1 === 'done' && this.objectives.hostage2 === 'done') { this.objectives.extract = 'active'; this.setPrimary('extract'); }
    if (!this.flags.hintHostage) { this.flags.hintHostage = true; g.hint('hostage'); }
  }
  onEnemyDeath(e) {
    if (e.role === 'officer' && !this.flags.key) {
      this.flags.key = true;
      if (!this.flags.cellUnlocked) { this.level.cellDoor.setLocked(false); this.flags.cellUnlocked = true; this.game.hud.toast(this.game.t('hud.keyFound')); }
    }
  }

  complete(id) { this.objectives[id] = 'done'; this.game.hud.toast(this.game.t('obj.' + id) + ' ✓'); this.game.audio.ui('objective'); }
  setPrimary(id) { this.primary = id; if (this.objectives[id] === 'pending') this.objectives[id] = 'active'; this.game.hud.setObjective(this.game.t('obj.' + id), this.objectives.power === 'optional' ? this.game.t('obj.power') : null); }

  spawnReinforcements(n, gate, target) {
    const g = this.game, p = this.level.reinforcements[gate];
    for (let i = 0; i < n; i++) {
      const e = g.spawnEnemy({ x: p.x + (i - 1) * 1.6, z: p.z + (i % 2) * 1.5, yaw: Math.atan2(target.x - p.x, target.z - p.z), patrol: [], grenades: 1 });
      e.state = 'search'; e.investigate = target.clone(); e.lastKnown.copy(target); e.searchUntil = g.time + 40; e.alertLevel = 1;
    }
    g.hud.toast(g.t('hud.wave')); g.audio.ui('alert');
  }

  update(dt) {
    const g = this.game, L = this.level;
    this.time += dt;
    // extraction logic
    if (this.objectives.extract === 'active') {
      const zone = L.zones.lz;
      const hostagesIn = g.hostages.filter((h) => h.alive && zone.contains(h.pos)).length;
      const playerIn = zone.contains(g.player.pos);
      if (hostagesIn === g.hostages.filter((h) => h.alive).length && playerIn && !this.flags.holdStarted) {
        this.flags.holdStarted = true; this.objectives.extract = 'done'; this.objectives.hold = 'active'; this.setPrimary('hold');
        this.holdTime = 0; this.nextWave = 6; this.waveCount = 0;
        for (const h of g.hostages) if (h.alive) h.state = 'extracted';
        g.checkpoint('lz'); g.architect.addEnergy(60);
        g.hud.toast(g.t('obj.extract') + ' ✓'); g.audio.ui('objective');
      }
    }
    if (this.objectives.hold === 'active') {
      this.holdTime += dt;
      this.nextWave -= dt;
      const remaining = Math.max(0, this.holdDuration - this.holdTime);
      g.hud.setTimer(remaining);
      if (this.nextWave <= 0 && remaining > 12 && this.waveCount < 4) {
        this.waveCount++; this.nextWave = 22;
        const gate = this.waveCount % 2 ? 'north' : 'east';
        this.spawnReinforcements(3 + (this.waveCount > 2 ? 1 : 0), gate, new THREE.Vector3(-26, 0, 40));
      }
      // helicopter arrives
      if (remaining < 25 && !this.heli) this.spawnHeli();
      if (this.heli) this.updateHeli(dt, remaining);
      if (remaining <= 0 && !this.flags.complete) {
        const zone = L.zones.lz;
        const ok = zone.contains(g.player.pos);
        if (ok) { this.flags.complete = true; this.objectives.hold = 'done'; g.hud.setTimer(null); g.missionComplete(); }
        else g.hud.setObjective(g.t('obj.hold'), null);
      }
    }
    // hints on first grenade opportunity / vault
    if (!this.flags.hintGrenade && g.player.grenades > 0 && this.time > 90 && g.enemies.some((e) => e.alive && e.state === 'combat')) { this.flags.hintGrenade = true; g.hint('grenade'); }
    // hostages killed → fail
    for (const h of g.hostages) if (!h.alive && !this.flags.failed) { this.flags.failed = true; g.missionFailed('hostage'); }
  }

  spawnHeli() {
    const g = this.game;
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
    grp.position.set(-26, 70, -30); g.scene.add(grp);
    this.heli = { grp, rotor, spot, nav, t: 0 };
  }
  updateHeli(dt, remaining) {
    const h = this.heli; h.t += dt;
    h.rotor.rotation.y += dt * 30;
    const k = THREE.MathUtils.clamp((25 - remaining) / 20, 0, 1);
    const e = 1 - Math.pow(1 - k, 2);
    h.grp.position.set(-26 + Math.sin(h.t * 0.7) * 0.6, 70 - e * 66, -30 + e * 70);
    h.grp.rotation.z = Math.sin(h.t * 0.9) * 0.03; h.grp.rotation.x = (1 - e) * 0.15;
    h.nav.intensity = Math.sin(h.t * 8) > 0 ? 30 : 0;
    this.game.audio.heli(h.grp.position, 1);
    this.game.heliDown = k > 0.95;
  }

  snapshot() { return { objectives: { ...this.objectives }, primary: this.primary, flags: { ...this.flags }, holdTime: this.holdTime, waveCount: this.waveCount, nextWave: this.nextWave }; }
  restore(s) {
    this.objectives = { ...s.objectives }; this.primary = s.primary; this.flags = { ...s.flags, failed: false, complete: false };
    this.holdTime = s.holdTime; this.waveCount = s.waveCount; this.nextWave = s.nextWave;
    if (this.heli) { this.game.scene.remove(this.heli.grp); this.heli = null; }
    if (!this.flags.power) { const L = this.level, g = this.game; L.power = false; for (const l of L.floodlights) l.intensity = 0; for (const l of L.roomLights) l.intensity = 0; for (const l of L.emergency) l.intensity = 12; }
    this.level.cellDoor.setLocked(!this.flags.cellUnlocked);
    for (const it of this.level.interactables) if (it.id === 'power') it.enabled = this.flags.power;
    this.setPrimary(this.primary);
    this.game.hud.setTimer(this.objectives.hold === 'active' ? Math.max(0, this.holdDuration - this.holdTime) : null);
  }
}
