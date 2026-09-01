/**
 * Ichilov — the Tel Aviv Sourasky Medical Center, behind Weizmann Street.
 *
 * From the air you find it by one shape: the Sammy Ofer Heart Building, a long
 * white crescent standing on the Weizmann Street side of the campus, every
 * floor slab projecting past the dark glass as a sunshade so the whole thing
 * reads as horizontal stripes, both ends rounded off, and the helipad on its
 * roof with a helicopter on it more nights than not.
 *
 * The crescent curves around the older hospital: the Sourasky main tower in the
 * middle of the courtyard, the long surgical wing along the north edge, the
 * Dana-Dwek children's block in the south-west with its coloured panels, the
 * outpatient slab across the south. They are joined at third and fourth floor
 * by glazed bridges, because at Ichilov you do not go outside to change
 * building. On the street side: the multi-storey car park, and the canopy over
 * the ambulance bay at the emergency entrance, which never goes quiet.
 *
 * Hospitals are almost all window, and at two in the morning half of them are
 * still on — that is most of what is drawn here.
 *
 * Origin is the middle of the campus at ground level. −z is north.
 */

import * as THREE from 'three';
import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** Weizmann Street on the east, the campus roads on the other three sides. */
export const size: Landmark['size'] = { w: 280, h: 66, d: 250 };

const PI = Math.PI;

/**
 * The Heart Building's crescent: centre of curvature, the radius of its centre
 * line, half of its 24 m depth, the angle it starts at and the angle it sweeps.
 * Angles run from north (+z is south here) round towards the east.
 */
const ARC = { x: 10, z: -48, r: 68, half: 12, a0: 0.73, len: 1.82, h: 60 };

const ax = (a: number, r: number): number => ARC.x + Math.sin(a) * r;
const az = (a: number, r: number): number => ARC.z + Math.cos(a) * r;

/** Middle of the rooftop helipad, and the height its skids sit at. */
const PAD = { x: ax(1.567, ARC.r), y: 61.1, z: az(1.567, ARC.r) };

/** A part of something that moves, kept with its offset from that thing. */
interface Part { m: THREE.Mesh; ox: number; oy: number; oz: number }

/**
 * Small lit windows across one flat facade, in the grid a ward floor has.
 * `turn` is the way the wall faces: 0 south, PI north, PI/2 east.
 */
function windows(
  k: Kit, x: number, z: number, turn: number,
  cols: number, gap: number, y0: number, rows: number, rise: number,
  w = 3.4, h = 1.9, off = 0.3,
): void {
  const cx = Math.cos(turn);
  const sx = Math.sin(turn);
  for (let c = 0; c < cols; c++) {
    const d = (c - (cols - 1) / 2) * gap;
    for (let r = 0; r < rows; r++) {
      if (k.rnd() < off) continue;
      k.lit(w, h, x + cx * d, y0 + r * rise, z - sx * d, turn);
    }
  }
}

/**
 * One projecting floor slab of the Heart Building, as a flat ring sector.
 *
 * The kit has no curve, and fifteen 128 m ribbons chopped into boxes would cost
 * hundreds of meshes on a phone, so each band is drawn here as a single arc.
 */
function floorBand(k: Kit, y: number, rIn: number, rOut: number, mat: THREE.Material): void {
  const m = new THREE.Mesh(
    // A little past each end, so the bands carry round on to the round ends.
    new THREE.RingGeometry(rIn, rOut, 32, 1, ARC.a0 - 0.09 - PI / 2, ARC.len + 0.18), mat,
  );
  m.rotation.x = -PI / 2;
  m.position.set(ARC.x, y, ARC.z);
  m.receiveShadow = true;
  k.g.add(m);
}

/** Roads, kerbs, the gardens in the courtyard and the trees along the street. */
function ground(k: Kit): void {
  k.slab(280, 250, M.concrete, 0, 0);
  // Weizmann Street down the east side, with its pavement and kerbs.
  k.slab(20, 250, M.asphalt, 128, 0, 0.06);
  k.slab(8, 250, M.sand, 114, 0, 0.09);
  k.box(0.4, 0.35, 250, M.concrete, 118.1, 0.18, 0);
  k.box(0.4, 0.35, 250, M.concrete, 137.9, 0.18, 0);
  // Service roads: behind the main tower, and up the west boundary.
  k.slab(210, 11, M.asphalt, -30, -70, 0.07);
  k.slab(11, 150, M.asphalt, -108, 0, 0.07);
  // The ambulance drive in off the street, and the car park entry.
  k.slab(40, 13, M.asphalt, 95, 8, 0.08);
  k.slab(16, 15, M.asphalt, 111, 74, 0.08);
  // Garden in the crook of the crescent, and the paved forecourt.
  k.slab(52, 28, M.green, 12, 2, 0.1);
  k.slab(30, 26, M.green, -100, 34, 0.1);
  k.slab(32, 26, M.sand, -32, 4, 0.11);

  // Palms on the pavement, ficus in the courtyard.
  k.tree(114, -62, 1.6);
  k.tree(114, 6, 1.6);
  k.tree(114, 88, 1.5);
  k.tree(16, -6);
  k.tree(30, 12);
  // Two street lamps over the pavement.
  for (const z of [-40, 46]) {
    k.cyl(0.14, 0.2, 9, M.metal, 5, 116, 4.5, z);
    k.lamp(0.5, 116, 9.3, z, 0xffd9a0);
  }
  // Parked at the kerb and on the forecourt.
  k.box(2, 1.4, 4.6, M.metal, 112, 0.8, -20);
  k.box(2, 1.4, 4.6, M.metal, 112, 0.8, 24);
  k.box(2, 1.4, 4.6, M.metal, -102, 0.8, 30);
}

/**
 * The Sammy Ofer Heart Building: fifteen banded floors on a curve, rounded at
 * both ends, helipad on the roof. Returns the lights that blink.
 */
function heart(k: Kit): { pad: THREE.Mesh[]; beacons: THREE.Mesh[] } {
  const n = 10;
  const seg = ARC.len / n;
  // The body, as chords of the arc: dark glass between the white slabs.
  for (let i = 0; i < n; i++) {
    const a = ARC.a0 + (i + 0.5) * seg;
    const b = k.box(14.8, ARC.h, ARC.half * 2, M.glass, ax(a, ARC.r), ARC.h / 2, az(a, ARC.r));
    b.rotation.y = a;
  }
  // Both ends are drums, which is what gives the building its nose.
  for (const a of [ARC.a0, ARC.a0 + ARC.len]) {
    k.cyl(ARC.half, ARC.half, ARC.h + 0.6, M.glass, 12, ax(a, ARC.r), (ARC.h + 0.6) / 2, az(a, ARC.r));
  }
  // Fourteen floor slabs, each running the whole 128 m of the curve.
  for (let f = 0; f < 14; f++) floorBand(k, 5.4 + f * 3.9, 54, 82.4, M.plaster);
  // Roof deck inside the crowning cornice.
  floorBand(k, 60.15, 56.5, 79.5, M.roof);
  floorBand(k, 60.5, 76.5, 82.4, M.plaster);

  // Ward windows in the glass, five bays across and four levels up the curve.
  for (let c = 0; c < 5; c++) {
    const a = ARC.a0 + (c + 0.5) * (ARC.len / 5);
    for (const y of [11.3, 26.9, 42.5, 54.2]) {
      if (k.rnd() < 0.12) continue;
      k.lit(22, 2.4, ax(a, 80.6), y, az(a, 80.6), a);
    }
  }
  // The entrance, on the concave side facing the old hospital, under a canopy.
  const ca = ARC.a0 + ARC.len / 2;
  for (let c = 0; c < 4; c++) {
    const a = ARC.a0 + (c + 0.5) * (ARC.len / 4);
    k.lit(17, 6, ax(a, 55.4), 4.4, az(a, 55.4), a + PI);
  }
  const can = k.box(30, 0.7, 11, M.metal, ax(ca, ARC.r - ARC.half - 5), 6.4, az(ca, ARC.r - ARC.half - 5));
  can.rotation.y = ca;
  k.cyl(0.24, 0.24, 6.4, M.metal, 6, ax(ca, ARC.r - ARC.half - 9), 3.2, az(ca, ARC.r - ARC.half - 9));

  // Plant on the north half of the roof: chillers and the tanks.
  for (let i = 0; i < 3; i++) {
    const a = ARC.a0 + ARC.len * (0.74 + i * 0.09);
    const p = k.box(9, 3.4, 12, M.metal, ax(a, ARC.r), 61.9, az(a, ARC.r));
    p.rotation.y = a;
  }

  // The helipad: painted circle, an H, and lights round the edge.
  k.cyl(11.6, 11.6, 0.9, M.dark, 18, PAD.x, 60.6, PAD.z);
  k.cyl(10.6, 10.6, 0.24, M.plaster, 18, PAD.x, 61.05, PAD.z);
  k.cyl(9.4, 9.4, 0.3, M.dark, 18, PAD.x, 61.08, PAD.z);
  for (const [w, h, dx] of [[1.5, 7, -2.6], [1.5, 7, 2.6], [3.7, 1.5, 0]]) {
    const bar = k.lit(w, h, PAD.x + dx, 61.2, PAD.z);
    bar.rotation.x = -PI / 2;
  }
  const pad: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    pad.push(k.lamp(0.34, PAD.x + Math.sin(a) * 11.9, 61.3, PAD.z + Math.cos(a) * 11.9, 0x7dffb0));
  }
  // Windsock, further along the roof from the pad.
  k.cyl(0.1, 0.14, 5, M.metal, 5, ax(1.33, 60), 62.6, az(1.33, 60));
  k.cyl(0.3, 0.9, 2.4, M.canvas, 6, ax(1.33, 60) + 1.4, 64.8, az(1.33, 60)).rotation.z = PI / 2;

  // Obstruction lights on the two ends of the roof.
  const beacons = [
    k.lamp(0.6, ax(ARC.a0, ARC.r), 61.6, az(ARC.a0, ARC.r)),
    k.lamp(0.6, ax(ARC.a0 + ARC.len, ARC.r), 61.6, az(ARC.a0 + ARC.len, ARC.r)),
  ];
  return { pad, beacons };
}

/** The old Sourasky main building: fourteen ward floors over a clinic podium. */
function mainTower(k: Kit): void {
  k.box(84, 9, 44, M.concrete, -45, 4.5, -40);
  k.box(74, 47, 34, M.plaster, -45, 32.5, -40);
  k.box(76, 1.4, 36, M.metal, -45, 56.7, -40);
  // Lift overrun, air handling, and the water tanks every roof here carries.
  k.box(16, 4, 10, M.metal, -66, 59.4, -44);
  k.box(9, 5.2, 8, M.concrete, -30, 60, -34);
  k.cyl(2.2, 2.2, 3.6, M.metal, 8, -48, 59.2, -50);
  k.cyl(2.2, 2.2, 3.6, M.metal, 8, -42, 59.2, -50);

  // Wards, south to the courtyard and north over the service road.
  windows(k, -45, -22.9, 0, 4, 15, 13, 4, 9.5);
  windows(k, -45, -57.1, PI, 3, 19, 14, 3, 11);
  // Reception and the outpatient hall along the front of the podium.
  k.lit(30, 5.4, -45, 5, -17.9);
  k.lit(18, 5.4, -70, 5, -17.9);
  // The hospital's name on the parapet, floodlit.
  k.lit(22, 2.8, -45, 56.4, -23.1);
  k.lamp(0.45, -57, 54.2, -23.4, 0xffc27a);
  k.lamp(0.45, -33, 54.2, -23.4, 0xffc27a);
}

/** Dana-Dwek children's hospital: a ten-storey block of coloured panels. */
function childrens(k: Kit): void {
  k.box(54, 8, 50, M.concrete, -58, 4, 30);
  k.box(46, 32, 44, M.plaster, -58, 24, 30);
  k.box(48, 1.2, 46, M.metal, -58, 40.6, 30);
  k.box(10, 3.6, 8, M.metal, -66, 42.4, 22);
  // Entrance canopy on the south side, with the lit doors under it.
  k.box(16, 0.6, 7, M.metal, -58, 5.6, 56);
  k.lit(12, 4.6, -58, 3.2, 55.4);
  windows(k, -58, 52.1, 0, 4, 10, 12, 3, 9);
  windows(k, -34.9, 30, PI / 2, 2, 12, 14, 3, 9);
  // The coloured cladding panels the children's block is known for.
  const panel = [0x7fd4ff, 0xffd166, 0xff8fa3, 0x9be89b];
  for (let i = 0; i < 4; i++) {
    k.lamp(0.7, -70 + i * 8, 18 + i * 5, 52.3, panel[i]);
  }
}

/** The long surgical wing along the north edge, six floors. */
function northWing(k: Kit): void {
  k.box(100, 26, 26, M.plaster, -45, 13, -95);
  k.box(102, 1.2, 28, M.metal, -45, 26.7, -95);
  k.box(12, 3, 8, M.metal, -75, 28.2, -95);
  k.cyl(2.2, 2.2, 3, M.metal, 8, -20, 28.2, -92);
  windows(k, -45, -81.9, 0, 5, 18, 5, 3, 7);
  windows(k, -45, -108.1, PI, 3, 20, 6, 2, 8);
}

/** Outpatients and the clinics, a five-storey slab across the south. */
function southBlock(k: Kit): void {
  k.box(120, 20, 24, M.plaster, -10, 10, 96);
  k.box(122, 1.2, 26, M.metal, -10, 20.7, 96);
  // A canvas run over the queue outside the clinic doors.
  k.box(60, 0.4, 5, M.canvas, -10, 5.2, 82.4);
  k.box(10, 3, 7, M.metal, 30, 22.2, 96);
  windows(k, -10, 83.9, PI, 4, 25, 5, 3, 6);
  windows(k, -10, 108.1, 0, 3, 24, 6, 2, 7);
}

/** Five open decks of car park on the street, with the ramp up the middle. */
function carPark(k: Kit): void {
  for (let d = 0; d < 5; d++) {
    k.slab(46, 40, M.concrete, 88, 76, 0.3 + d * 3.6);
  }
  k.box(6, 15.5, 11, M.concrete, 66.5, 7.8, 76);
  k.box(6, 15.5, 11, M.concrete, 109.5, 7.8, 76);
  for (const x of [67, 109]) for (const z of [57, 95]) k.box(0.9, 15, 0.9, M.concrete, x, 7.5, z);
  const ramp = k.box(8, 0.5, 26, M.concrete, 88, 8.6, 76);
  ramp.rotation.x = 0.26;
  // The strip lights under each deck, seen from the street side.
  for (let d = 0; d < 4; d++) k.lit(42, 1.6, 88, 1.6 + d * 3.6, 55.9, PI);
  k.box(2, 1.4, 4.6, M.metal, 78, 15.4, 66);
  k.box(2, 1.4, 4.6, M.metal, 96, 15.4, 84);
  k.lamp(0.4, 88, 16.4, 56, 0xffd9a0);
}

/**
 * The emergency entrance: a canopy over the ambulance bay, the department
 * behind it, and the sign nobody has trouble finding. Returns the ambulance
 * that comes and goes.
 */
function emergency(k: Kit): Part[] {
  k.box(30, 15, 24, M.plaster, 84, 7.5, 30);
  k.box(28, 0.9, 16, M.metal, 84, 6.4, 8);
  for (const x of [71, 97]) for (const z of [1.5, 14.5]) k.cyl(0.3, 0.3, 6, M.metal, 6, x, 3, z);
  // Under-canopy light, and the doors of the department behind.
  const under = k.lit(24, 12, 84, 5.8, 8);
  under.rotation.x = PI / 2;
  k.lit(20, 5, 84, 3.2, 17.9);
  // The sign over the doors, lit red.
  k.lit(8, 2.4, 84, 10.4, 17.9);
  k.lamp(0.4, 79, 10.4, 17.6);
  k.lamp(0.4, 89, 10.4, 17.6);
  windows(k, 84, 17.9, 0, 4, 7, 12.4, 1, 0, 2.6, 1.6, 0.2);
  // Two ambulances waiting in the bay.
  for (const x of [74, 86]) {
    k.box(2.5, 2.7, 6.2, M.plaster, x, 1.4, 8);
    k.lamp(0.26, x, 2.95, 6.2, 0x4fd2ff);
  }
  // And one on its way in off the street, so it lies along the drive.
  return [
    { m: k.box(6.2, 2.7, 2.5, M.plaster, 0, 1.4, 0), ox: 0, oy: 0, oz: 0 },
    { m: k.box(2.4, 1, 2.2, M.dark, 0, 2.2, 0), ox: -2.4, oy: 0.85, oz: 0 },
    { m: k.lamp(0.3, 0, 0, 0, 0xff5470), ox: 0.4, oy: 1.55, oz: -0.7 },
    { m: k.lamp(0.3, 0, 0, 0, 0x4fd2ff), ox: 0.4, oy: 1.55, oz: 0.7 },
  ];
}

/** The glazed bridges — at Ichilov you change building without going out. */
function bridges(k: Kit): void {
  k.box(74, 5.4, 8, M.glass, 29, 13.2, -40);
  k.lit(68, 2.2, 29, 13.4, -36.1);
  k.box(9, 5.4, 26, M.glass, -60, 13.2, -70);
  k.lit(22, 2.2, -55.6, 13.4, -70, PI / 2);
  k.box(9, 5, 30, M.glass, -50, 12, -4);
  k.lit(26, 2, -45.6, 12.2, -4, PI / 2);
}

export function build(k: Kit): void {
  ground(k);
  const roof = heart(k);
  mainTower(k);
  childrens(k);
  northWing(k);
  southBlock(k);
  carPark(k);
  const amb = emergency(k);
  bridges(k);

  // The helicopter, nose to the south-west: it comes in over the city from the
  // north, sits on the roof, and carries on the same way out. Parts are built
  // underground and flown into place by the tick.
  const YAW = 2.79;
  const sy = Math.sin(YAW);
  const cy = Math.cos(YAW);
  const heli: Part[] = [
    { m: k.box(2.8, 2.4, 7.2, M.plaster, 0, -60, 0), ox: 0, oy: 1.6, oz: 0 },
    { m: k.box(0.7, 0.7, 5.6, M.plaster, 0, -60, 0), ox: sy * 5.8, oy: 2.2, oz: cy * 5.8 },
    { m: k.lamp(0.26, 0, -60, 0, 0xff5470), ox: sy * 8.4, oy: 3.4, oz: cy * 8.4 },
    { m: k.lit(2.2, 1.1, 0, -60, 0, PI + YAW), ox: -sy * 3.6, oy: 2, oz: -cy * 3.6 },
  ];
  heli[0].m.rotation.y = YAW;
  heli[1].m.rotation.y = YAW;
  const rotor = k.box(13.6, 0.12, 0.9, M.metal, 0, -60, 0);

  // Traffic on Weizmann Street: south on the far lanes, north on the near.
  const cars = Array.from({ length: 4 }, (_, i) => {
    const south = i % 2 === 0;
    return {
      m: k.lamp(0.5, south ? 132 : 124, 0.9, 0, south ? 0xff5470 : 0xffe0a8),
      base: k.rnd() * 250,
      v: south ? 22 + k.rnd() * 8 : -(20 + k.rnd() * 8),
    };
  });

  k.onTick((t, st) => {
    // Obstruction lights on the crescent, together once the place is ours.
    const period = st.mine ? 1.2 : 2;
    for (let i = 0; i < roof.beacons.length; i++) {
      const b = (t + (st.mine ? 0 : i * 0.5)) % period;
      roof.beacons[i].visible = !st.dark && b < period * 0.4;
    }
    // Pad edge lights: steady when the pad is live, a slow pulse otherwise.
    const on = !st.dark && (st.mine || t % 3 < 2.1);
    for (const l of roof.pad) l.visible = on;

    // Sixty-four seconds: in from the north, twenty-six on the pad, out south.
    const p = t % 64;
    let hx = PAD.x; let hy = PAD.y; let hz = PAD.z; let flying = true;
    if (p < 16) {
      const u = (p / 16) ** 0.7;
      hx = PAD.x + (1 - u) * 60; hz = PAD.z - (1 - u) * 165; hy = PAD.y + (1 - u) * 95;
    } else if (p >= 42 && p < 58) {
      const u = ((p - 42) / 16) ** 1.4;
      hx = PAD.x - u * 45; hz = PAD.z + u * 150; hy = PAD.y + u * 95;
    } else if (p >= 58) {
      flying = false;
    }
    for (const part of heli) {
      part.m.visible = flying;
      part.m.position.set(hx + part.ox, hy + part.oy, hz + part.oz);
    }
    // Cabin light off with the power, tail light strobing.
    heli[3].m.visible = flying && !st.dark;
    heli[2].m.visible = flying && !st.dark && t % 1 < 0.5;
    rotor.visible = flying;
    rotor.position.set(hx, hy + 3.3, hz);
    rotor.rotation.y = t * 11;

    // The ambulance turns in off Weizmann, waits at the bay, then goes out.
    const ab = t % 44;
    const abx = ab < 9 ? 118 - (ab / 9) * 23 : ab < 30 ? 95 : 95 + ((ab - 30) / 9) * 30;
    for (const part of amb) {
      part.m.visible = ab < 39;
      part.m.position.set(abx + part.ox, 1.4 + part.oy, 8 + part.oz);
    }
    // Blues and twos while it is running, dark once it is parked up.
    const running = ab < 9 || ab > 28;
    amb[2].m.visible = running && !st.dark && t % 0.8 < 0.4;
    amb[3].m.visible = running && !st.dark && t % 0.8 >= 0.4;

    for (const c of cars) {
      c.m.position.z = ((((c.base + t * c.v) % 250) + 250) % 250) - 125;
    }
  });
}
