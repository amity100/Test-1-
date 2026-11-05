import * as THREE from 'three';
import { Kit, itemMats, linC } from '../items.js';
import { letter } from '../../world/letters.js';
import { randomCarSpec } from '../../render/cars.js';

// (prologue, ROADMAP 18) The car park the chase goes up: 5TH STREET GARAGE, in the middle of the
// city on the block between Meridian and Washington Avenues, 5th to 7th Street (the block's own
// buildings are left out of the city for it: world/blocks.js VACANT), and across 5th Street from
// it, on the open ground by the water, the lower one the car lands on: BAYSHORE PARKING.
//
// 5th Street Garage (round 11, the player's word: simple to drive, dark, and far bigger inside):
// six floors over the street floor, 5.9 m apart, each one open hall the whole block across (41 m)
// and long (113 m) - its concrete in shadow, lit by rows of tubes, some dead, some failing. Up from
// each floor a straight ramp, 12 m wide, along one of its long walls (the west wall's going up to the
// south, the east wall's to the north), coming up through an opening in the floor over it; at both
// ends of every floor 30 m of it open from wall to wall, nothing standing in it - the turn. The way
// up: in from 5th Street, north along the east wall, round, up the west ramp to the south, round, up
// the east ramp to the north, and so on - the last one onto the roof at its north end: round, and the
// roof run, straight south for 100 m west of a line of barriers to the edge, 35 m over 5th Street,
// the street the car flies across. Down the middle of every floor, between the ramps, the bays.
//
// Bayshore Parking is lower (its roof 4.8 m under the garage's) and plainer: flat floors, eight of
// them over the street floor, and a straight ramp from each down to the next (13 %, eased at both
// ends), turning at its west end and in a cross aisle in its middle, out onto 5th Street.
//
// Built the way the city is (game/items.js Kit, the city's pens), merged into a few meshes:
// concrete floors that are solid things (a slab with its top, its underside and its edges - a
// floor seen from under it is a ceiling, never nothing), precast panels round the edges, columns,
// beams, the stair and lift towers at the corners; inside, the striplights under every floor,
// the sprinkler mains, the paint (the bays, the arrows, the levels), the cars parked in the bays
// (the city's own, drawn with them: PrologueSet.drawCars). Its floors are the vehicles' (floorAt,
// through PrologueSet) and the collision's (stepped boxes: people walk up them, the camera's
// look stops at them); ceilingAt keeps the camera under them.

// ------------------------------------------------------------------ the plan
// the street floor (a little over the pavers round it)
const Y0 = 0.17;
// floor to floor, a floor's slab, the beams under it, the parapet over it
// (round 11, the player's word: simple to drive, dark, and far bigger inside - every floor one open
// hall the whole width of the block, a straight ramp up from it to the next, six of them to the roof,
// 5.9 m floor to floor. It was two halves of sloping floors, an aisle between parked cars)
const DH = 5.9;
const SLAB = 0.35;
const BEAM = 0.55;
const PAR = 1.05;
// the levels: 0 the street floor .. NDECK the roof (the roof run on it, the edge it flies from)
const NDECK = 6;
const LV = (k) => Y0 + k * DH;

// 5th Street Garage: its ground
const MX0 = -190;
const MX1 = -149;
const MXC = -169.5;
const MZ0 = 176.5;
const MZ1 = 289.5;
// the lanes the ramps are in, along its two long walls, the open middle between them; the ramps
// between RN and RS - north and south of them every floor open from wall to wall (the turns)
const LANE_W = 12;
const WL = [MX0 + 0.3, MX0 + 0.3 + LANE_W];
const EL = [MX1 - 0.3 - LANE_W, MX1 - 0.3];
const RN = 207;
const RS = 259;
const R_EASE = 5;
// ramp k, from floor k up to floor k + 1: the even ones in the west lane going up to the south, the
// odd ones in the east lane going up to the north. Off one, across the open end of the floor, up the
// next: the last onto the roof at its north end, the roof run all of the roof's length to the edge
const RAMPS = Array.from({ length: NDECK }, (_, k) =>
  k % 2 === 0
    ? { k, x0: WL[0], x1: WL[1], xc: (WL[0] + WL[1]) / 2, west: true, zLow: RN, zHigh: RS }
    : { k, x0: EL[0], x1: EL[1], xc: (EL[0] + EL[1]) / 2, west: false, zLow: RS, zHigh: RN },
);
// the columns a span apart along it (in the outer walls, by the ramps, down the middle by them)
const SPAN = 10.4;
// the stair and lift towers at its corners (across, along)
const CORE_W = 5.6;
const CORE_D = 7.4;
// (on the roof, a line of concrete barriers from the north end's turn to the edge: the roof run west
// of them - over Bayshore's roof, the way the car flies)
const ROOF_BAR_X = -176;
// (round 12) the launch deck: the roof run carried on 8 m out past the south face over 5th Street,
// from the west wall to the barriers - the edge the car flies from at its end
const CANT = 8;
const CX0 = MX0 + 0.5;
const CX1 = ROOF_BAR_X + 0.32;
// (round 12, the player's word: no roof across the street to come down on - the car flies off the
// edge into the open, and only a rotor drawn on it in the air holds it up. Bayshore Parking is not
// built; what is below kept for the day it is wanted again)
const LAND_ON = false;
// Bayshore Parking: its ground, its levels, its two aisles, its ramps (from xLow at level lv up
// to xHigh at level lv + 1), the cross aisle in its middle
const LX0 = -250;
const LX1 = -148;
const LZ0 = 314.5;
const LZ1 = 349;
// (round 8: as tall again as the garage it is across the street from - eight floors of 3.8 m, its
// roof 4.8 m under the garage's still)
const LDH = 3.8;
const NLAND = 8;
const LY = Array.from({ length: NLAND + 1 }, (_, k) => Y0 + k * LDH);
const L_AISLE = { N: [319.8, 327.0], S: [337.0, 344.2] };
const L_MID = 332;
// (a ramp from each floor to the next: up west in the north aisle from the even ones, up east in the
// south aisle from the odd ones)
const L_RAMPS = Array.from({ length: NLAND }, (_, lv) => (lv % 2 === 0 ? { lv, aisle: 'N', xLow: -202, xHigh: -236 } : { lv, aisle: 'S', xLow: -236, xHigh: -202 }));
const L_RAMP_EASE = 4;
const L_CROSS = [-202, -188];
// (the middle rows end short of the east wall: the turn at that end)
const L_EAST = -162;
const L_BEAM = 0.5;
// (the gate onto 5th Street in its north wall, on the street floor)
const L_GATE = [-201, -190];

// where the parked cars are kept off: the roof run's way and the edge it flies from, Danny's bay,
// the landing on Bayshore's roof
const KEEP = {
  heroBay: { x: -152.0, z: 279.75 },
  land: { x0: -194, x1: -166, z0: LZ0, z1: LZ1 },
};

// ------------------------------------------------------------------ what the director needs
// The car park as the prologue's director sees it (all in world metres; y the floor's height):
// where the two men wait at the door on 5th Street, Danny's car, the way up floor by floor, the
// roof run and its edge, the roof across the street it lands on and the way down from it.
// (the way in from 5th Street on the street floor, in the east lane; the roof run's line, west of
// the roof's barriers: what the drawn ramp and the jump are worked out along)
const W_AISLE_X = -183;
const E_AISLE_X = -158.7;
export const PARK = {
  name: '5TH STREET GARAGE',
  // the garage's ground, the line between its halves, its levels (the street floor .. the roof
  // run's high end), floor to floor, the slope of its floors
  main: { x0: MX0, x1: MX1, z0: MZ0, z1: MZ1, xc: MXC, zN: RN, zS: RS, levels: Array.from({ length: NDECK + 1 }, (_, k) => LV(k)), floorToFloor: DH, grade: DH / (RS - RN - R_EASE) },
  // (round 11) its ramps ({ k, x0, x1, xc, west, zLow, zHigh }: floor k up to k + 1), its lanes, the
  // middle of each end's turn
  ramps: RAMPS,
  lanes: { W: WL, E: EL },
  turnN: (MZ0 + CORE_D + RN) / 2,
  turnS: (RS + MZ1 - CORE_D) / 2,
  roofBarX: ROOF_BAR_X,
  landing: { name: 'BAYSHORE PARKING', x0: LX0, x1: LX1, z0: LZ0, z1: LZ1, levels: LY.slice(), floorToFloor: LDH, grade: LDH / (34 - L_RAMP_EASE), ramps: L_RAMPS, aisles: L_AISLE, gate: L_GATE },
  // the street door of the stair tower at the corner of 5th Street and Washington Avenue (the
  // way in on foot, through its lobby to the street floor), where the two men wait, which way they
  // face (east, down 5th Street, where Danny comes from)
  door: { x: MX1 - CORE_W / 2, z: MZ1 + 0.1, y: Y0 },
  // (the two men on the sidewalk west of the way in, by their car; Danny stopped 12-14 m from them
  // between the way in and the door, facing them; the sidewalk between them clear: no walls, no
  // street furniture - the camera can stand anywhere on it, the building's face 3 m to the north;
  // his run from there into the way in and round to the driver's door of his car - their shots
  // at him pass through the way in's opening)
  thugs: [{ x: -164.8, z: 293.0 }, { x: -166.6, z: 293.9 }],
  thugsFace: Math.PI / 2,
  dannyStop: { x: -152.5, z: 292.8, yaw: -Math.PI / 2 },
  dannyRun: [[-152.5, 292.8], [-157.5, 289.6], [-157.2, 283.6], [-153.2, 281.6]],
  // their car, at the curb of 5th Street in front of the garage, west of its way in (parked the way
  // that side's traffic goes: west)
  thugCar: { x: -171.5, z: 296.7, yaw: -Math.PI / 2 },
  // the way in for cars, from 5th Street (the entrance lane, under the clearance bar)
  entrance: { x: E_AISLE_X, z: MZ1 + 1.5, y: Y0, yaw: Math.PI },
  // Danny's car: backed into the bay by the stair tower's inner door on the street floor, facing
  // the aisle - out of the bay, right, and up the first straight
  heroCar: { x: KEEP.heroBay.x, z: KEEP.heroBay.z, y: Y0, yaw: -Math.PI / 2 },
  // the way out at the north end (onto 7th Street), and where a car can be thrown across it
  exit: { x: W_AISLE_X, z: MZ0 - 1.5, y: Y0, yaw: Math.PI },
  // the way up, a mark a floor (for the objective's arrow): the middle of the turn a ramp starts
  // from, the ramp's foot; its level (a turn's a little over its floor's, a ramp's foot a third of
  // the way up to the next), a word for it
  route: [
    { x: (EL[0] + EL[1]) / 2, z: MZ1 - 14, y: LV(0), lv: 0, what: 'in' },
    ...RAMPS.map((r) => [
      { x: MXC, z: r.zLow === RN ? (MZ0 + CORE_D + RN) / 2 : (RS + MZ1 - CORE_D) / 2, y: LV(r.k), lv: r.k + 0.05, what: 'turn' },
      { x: r.xc, z: r.zLow, y: LV(r.k), lv: r.k + 0.35, what: 'up' },
    ]).flat(),
    { x: W_AISLE_X, z: MZ0 + 12, y: LV(NDECK), lv: NDECK + 0.05, what: 'roof' },
  ],
  // the roof run: from the north end of the roof, round the turn off the last ramp, straight south
  // west of the barriers to the edge - 100 m and more, all of it flat
  runup: { x: W_AISLE_X, z: MZ0 + 12, y: LV(NDECK), yaw: 0, dir: [0, 1], len: MZ1 + CANT - MZ0 - 12, flatFrom: MZ0 },
  // the edge it flies from: the south face of the west half at the roof run's high end (a
  // parapet 1.05 m high along it, x0..x1), over 5th Street
  edge: { z: MZ1 + CANT, x0: CX0, x1: CX1, x: W_AISLE_X, y: LV(NDECK), parapet: PAR },
  // (the drawn ramp and the jump - game/prologue/ramp.js - are worked out along -x, a lane at one
  // z: the roof run is that turned a quarter round. toLocal(x, z) gives the [x, z] they take, a
  // group turned rotY about y puts what they build back in the world; edgeX, laneZ, carX for
  // RampDraw.open, landX for the landing's x there)
  runFrame: {
    toLocal: (x, z) => [-z, x],
    toWorld: (lx, lz) => [lz, -lx],
    rotY: Math.PI / 2,
    edgeX: -(MZ1 + CANT),
    laneZ: W_AISLE_X,
    roofY: LV(NDECK),
  },
  // where it comes down: Bayshore's roof straight ahead across the street (kept clear: no cars,
  // no lamp posts, no openings), its height; land: a point in it
  land: { x: W_AISLE_X, z: 328, y: LY[NLAND], zone: { x0: KEEP.land.x0, x1: KEEP.land.x1, z0: LZ0 + 1, z1: LZ1 - 1 } },
  // the way down from Bayshore's roof to 5th Street: west along its south aisle, down, round at
  // the west end, down, round in the cross aisle, down, round, down, and out of its gate
  down: [
    { x: -196, z: 340.6, y: LY[NLAND], what: 'ramp' },
    // (round at the west end on the odd floors, in the cross aisle on the even ones)
    ...Array.from({ length: NLAND - 1 }, (_, i) => {
      const k = NLAND - 1 - i;
      return { x: k % 2 === 1 ? -244 : -196, z: 332, y: LY[k], what: 'turn' };
    }),
    { x: -195.5, z: 323.4, y: LY[0], what: 'gate' },
    { x: -195.5, z: 309, y: 0, what: 'street' },
  ],
  // places a camera shows them well from: [where it is, what it looks at]
  shots: {
    // the garage from the corner of 5th and Washington, Danny's way to it
    corner: [[-128, 1.7, 296], [-165, 8, 270]],
    // the door on foot, the two men by it
    door: [[-146, 1.7, 300], [-152, 1.6, 289]],
    // the roof run from behind the car's start, the edge far off
    run: [[W_AISLE_X, LV(NDECK) + 2.4, MZ0 + 4], [W_AISLE_X, LV(NDECK) + 0.5, MZ1]],
    // over the edge: 5th Street below, Bayshore's roof across it
    edge: [[-180.3, LV(NDECK) + 2.1, MZ1 - 21], [-180.3, LY[NLAND] - 1, 332]],
    // from Bayshore's roof up at the edge it comes from
    landing: [[-172, LY[NLAND] + 1.6, 342], [-180.3, LV(NDECK) + 1, MZ1]],
  },
  // the floor under (x, z) for something at height y (the highest floor no more than a step over
  // it), -Infinity off them; the underside of what is over (x, z) for the camera there (Infinity in
  // the open). The vehicles and the camera ask them through PrologueSet
  floorAt: (x, z, y) => parkFloor(x, z, y),
  ceilingAt: (x, z, y) => parkCeiling(x, z, y),
  // floors laid on it later (the ramp drawn on the roof: anything with floorAt(x, z, y))
  extra: [],
  // which level something at (x, y, z) is on, in the garage (0 the street floor .. NDECK the roof
  // run's high end; between two on a slope: 2.4 is two fifths of the way up from 2 to 3); in
  // Bayshore, its level (0 .. NLAND) plus 10; null outside both
  levelAt: (x, z, y) => {
    const m = mainFloor(x, z, y);
    if (m > -Infinity) return (m - Y0) / DH;
    const b = landFloor(x, z, y);
    return b > -Infinity ? 10 + (b - Y0) / LDH : null;
  },
};

// ------------------------------------------------------------------ its floors

// ramp r's floor at z (null off it): eased in and out over its first and last metres
function mainRampY(r, z) {
  const L = Math.abs(r.zHigh - r.zLow);
  const t = ((z - r.zLow) / (r.zHigh - r.zLow)) * L;
  if (t < 0 || t > L) return null;
  const y0 = LV(r.k);
  const T = R_EASE;
  const g = DH / (L - T);
  if (t < T) return y0 + (g * t * t) / (2 * T);
  if (t > L - T) {
    const u = L - t;
    return y0 + DH - (g * u * u) / (2 * T);
  }
  return y0 + g * (T / 2) + g * (t - T);
}
// floor k's opening, where the ramp from the floor under it comes up through it
function mainHole(k, x, z) {
  if (k < 1 || k > NDECK) return false;
  const r = RAMPS[k - 1];
  return x > r.x0 && x < r.x1 && z > RN && z < RS;
}
// in one of the corners' towers
function inCore(x, z, pad = 0) {
  const cx = x < MX0 + CORE_W + pad || x > MX1 - CORE_W - pad;
  const cz = z < MZ0 + CORE_D + pad || z > MZ1 - CORE_D - pad;
  return cx && cz;
}

function mainFloor(x, z, y) {
  // (the launch deck, out past the south face at the roof's height)
  if (z > MZ1 && z <= MZ1 + CANT && x > CX0 && x < CX1) return LV(NDECK) <= y + 1.1 ? LV(NDECK) : -Infinity;
  if (x < MX0 || x > MX1 || z < MZ0 || z > MZ1) return -Infinity;
  const lim = y + 1.1;
  let best = -Infinity;
  for (let k = 0; k <= NDECK; k++) {
    const h = LV(k);
    if (h > lim) break;
    if (!mainHole(k, x, z)) best = h;
  }
  for (const r of RAMPS) {
    if (x < r.x0 || x > r.x1) continue;
    const h = mainRampY(r, z);
    if (h !== null && h <= lim && h > best) best = h;
  }
  return best;
}

// the underside of the lowest floor of the garage over (x, z) more than 0.6 m over y (its beams'
// underside), Infinity in the open
function mainCeilAt(x, z, y) {
  for (let k = 1; k <= NDECK; k++) {
    const under = LV(k) - SLAB - BEAM;
    if (under < y + 0.6) continue;
    if (!mainHole(k, x, z)) return under;
  }
  return Infinity;
}

// Bayshore: the ramp's floor at x (null off it): eased in and out over its first and last metres
function rampY(r, x) {
  const L = Math.abs(r.xHigh - r.xLow);
  const t = ((x - r.xLow) / (r.xHigh - r.xLow)) * L;
  if (t < 0 || t > L) return null;
  const y0 = LY[r.lv];
  const H = LY[r.lv + 1] - y0;
  const T = L_RAMP_EASE;
  const g = H / (L - T);
  if (t < T) return y0 + (g * t * t) / (2 * T);
  if (t > L - T) {
    const u = L - t;
    return y0 + H - (g * u * u) / (2 * T);
  }
  return y0 + g * (T / 2) + g * (t - T);
}
function landHole(k, x, z) {
  for (const r of L_RAMPS) {
    if (r.lv + 1 !== k) continue;
    const a = L_AISLE[r.aisle];
    if (z > a[0] && z < a[1] && x > Math.min(r.xLow, r.xHigh) && x < Math.max(r.xLow, r.xHigh)) return true;
  }
  return false;
}
function landFloor(x, z, y) {
  if (!LAND_ON) return -Infinity;
  if (x < LX0 || x > LX1 || z < LZ0 || z > LZ1) return -Infinity;
  const lim = y + 1.1;
  let best = -Infinity;
  for (let k = 0; k < LY.length; k++) {
    if (LY[k] > lim) break;
    if (!landHole(k, x, z) && LY[k] > best) best = LY[k];
  }
  for (const r of L_RAMPS) {
    const a = L_AISLE[r.aisle];
    if (z < a[0] || z > a[1]) continue;
    const h = rampY(r, x);
    if (h !== null && h <= lim && h > best) best = h;
  }
  return best;
}
function landCeilAt(x, z, y) {
  for (let k = 1; k < LY.length; k++) {
    const under = LY[k] - SLAB - L_BEAM;
    if (under < y + 0.6) continue;
    if (!landHole(k, x, z)) return under;
  }
  return Infinity;
}

function parkFloor(x, z, y) {
  let best = mainFloor(x, z, y);
  const b = landFloor(x, z, y);
  if (b > best) best = b;
  for (const e of PARK.extra) {
    const h = e.floorAt(x, z, y);
    if (h <= y + 1.1 && h > best) best = h;
  }
  return best;
}

// the camera keeps under the floors over it - not only the one over the car, but those it may swing
// under behind it (a slope's lower end, the edge of the floor over a turn, an opening): looked for
// round the car out to where the camera goes, each the less binding the further off it is
const RING = [[0, 0]];
for (const r of [2.5, 5, 7]) for (let i = 0; i < 8; i++) RING.push([Math.cos((i * Math.PI) / 4) * r, Math.sin((i * Math.PI) / 4) * r]);
function parkCeiling(x, z, y) {
  // (outside them it is the camera's own look, stopped by their floors' edges, that keeps it out)
  const inMain = x > MX0 - 1 && x < MX1 + 1 && z > MZ0 - 1 && z < MZ1 + 1;
  const inLand = LAND_ON && x > LX0 - 1 && x < LX1 + 1 && z > LZ0 - 1 && z < LZ1 + 1;
  if (!inMain && !inLand) return Infinity;
  let c = Infinity;
  for (const [dx, dz] of RING) {
    const sx = x + dx;
    const sz = z + dz;
    const soft = Math.hypot(dx, dz) * 0.22;
    let u = Infinity;
    if (inMain && sx > MX0 && sx < MX1 && sz > MZ0 && sz < MZ1) u = mainCeilAt(sx, sz, y);
    else if (inLand && sx > LX0 && sx < LX1 && sz > LZ0 && sz < LZ1) u = landCeilAt(sx, sz, y);
    if (u + soft < c) c = u + soft;
  }
  return c;
}

// ------------------------------------------------------------------ shapes of its own
// a growing list of triangles, each face turned the way it looks (a closed solid made of them
// is seen from every side)
class Tris {
  constructor() {
    this.p = [];
  }

  // a, b, c, d round a face; out: a direction it looks
  quad(a, b, c, d, out) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) this.p.push(...a, ...b, ...c, ...a, ...c, ...d);
    else this.p.push(...a, ...c, ...b, ...a, ...d, ...c);
  }

  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.computeVertexNormals();
    return g;
  }
}

// a solid along an axis ('z': its profile runs along z, it is as wide as a0..a1 in x; 'x': the
// other way round), its top through the points prof [[s, y], ...] (s increasing), its underside
// bot(s, y) under each of them
function prism(axis, prof, a0, a1, bot) {
  const T = new Tris();
  const P = axis === 'z' ? (s, y, a) => [a, y, s] : (s, y, a) => [s, y, a];
  const out = (dS, dY, dA) => (axis === 'z' ? [dA, dY, dS] : [dS, dY, dA]);
  const b = prof.map(([s, y]) => bot(s, y));
  for (let i = 0; i + 1 < prof.length; i++) {
    const [s0, y0] = prof[i];
    const [s1, y1] = prof[i + 1];
    T.quad(P(s0, y0, a0), P(s0, y0, a1), P(s1, y1, a1), P(s1, y1, a0), out(0, 1, 0));
    T.quad(P(s0, b[i], a0), P(s0, b[i], a1), P(s1, b[i + 1], a1), P(s1, b[i + 1], a0), out(0, -1, 0));
    T.quad(P(s0, b[i], a0), P(s0, y0, a0), P(s1, y1, a0), P(s1, b[i + 1], a0), out(0, 0, -1));
    T.quad(P(s0, b[i], a1), P(s0, y0, a1), P(s1, y1, a1), P(s1, b[i + 1], a1), out(0, 0, 1));
  }
  const n = prof.length - 1;
  T.quad(P(prof[0][0], b[0], a0), P(prof[0][0], prof[0][1], a0), P(prof[0][0], prof[0][1], a1), P(prof[0][0], b[0], a1), out(-1, 0, 0));
  T.quad(P(prof[n][0], b[n], a0), P(prof[n][0], prof[n][1], a0), P(prof[n][0], prof[n][1], a1), P(prof[n][0], b[n], a1), out(1, 0, 0));
  return T.geo();
}

// paint on a floor: a flat quad (its corners [x, z] round it, each at the height of the floor
// there): two triangles, not a box's twelve
function paintQuad(K, mat, color, c, hAt, lift = 0.02) {
  const T = new Tris();
  const v = c.map(([x, z]) => [x, hAt(x, z) + lift, z]);
  T.quad(v[0], v[1], v[2], v[3], [0, 1, 0]);
  K.add(mat, T.geo(), color);
}
// a strip of paint from (x0, z0) to (x1, z1), w wide
function paintLine(K, mat, color, x0, z0, x1, z1, w, hAt, lift) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const L = Math.hypot(dx, dz) || 1;
  const px = (-dz / L) * (w / 2);
  const pz = (dx / L) * (w / 2);
  paintQuad(K, mat, color, [[x0 + px, z0 + pz], [x1 + px, z1 + pz], [x1 - px, z1 - pz], [x0 - px, z0 - pz]], hAt, lift);
}
// words painted on a floor, read by whoever drives along (fx, fz): their foot towards them
function paintWord(K, mat, color, text, size, cx, cz, fx, fz, hAt, lift = 0.022) {
  const rx = -fz;
  const rz = fx;
  letter(text, size, (a0, b0, a1, b1) => {
    const p = (a, b) => [cx + rx * a + fx * (b - size / 2), cz + rz * a + fz * (b - size / 2)];
    paintQuad(K, mat, color, [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)], hAt, lift);
  });
}
// an arrow painted on a floor, pointing along (fx, fz)
function paintArrow(K, mat, color, cx, cz, fx, fz, hAt, len = 4.2) {
  paintLine(K, mat, color, cx - fx * len * 0.5, cz - fz * len * 0.5, cx + fx * len * 0.12, cz + fz * len * 0.12, 0.28, hAt, 0.022);
  const tx = cx + fx * len * 0.5;
  const tz = cz + fz * len * 0.5;
  const bx = cx + fx * len * 0.08;
  const bz = cz + fz * len * 0.08;
  const rx = -fz;
  const rz = fx;
  const T = new Tris();
  const v = [[tx, tz], [bx + rx * 0.75, bz + rz * 0.75], [bx - rx * 0.75, bz - rz * 0.75]].map(([x, z]) => [x, hAt(x, z) + 0.022, z]);
  T.p.push(...v[0], ...v[1], ...v[2]);
  const g = T.geo();
  if (g.attributes.normal.getY(0) < 0) T.p = [...v[0], ...v[2], ...v[1]];
  K.add(mat, T.geo(), color);
}
// words on a wall facing (nx, nz) (one of the four ways), their foot at height y, centred at
// (cx, cz), d out from it: a flat face a stroke (the paint, the lit letters on a board - only ever
// seen from in front)
function wallWord(K, mat, color, text, size, cx, y, cz, nx, nz, d = 0.03) {
  const rx = nz;
  const rz = -nx;
  const T = new Tris();
  const len = letter(text, size, (a0, b0, a1, b1) => {
    const p = (a, b) => [cx + rx * a + nx * d, y + b, cz + rz * a + nz * d];
    T.quad(p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1), [nx, 0, nz]);
  });
  if (T.p.length) K.add(mat, T.geo(), color);
  return len;
}

// a little repeatable dice
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ the colours
// (round 11: dark - the concrete gone grey-brown in the shadow, the ramps a little lighter)
const CONC_TOP = linC(0.4, 0.395, 0.4);
const CONC_RAMP = linC(0.46, 0.45, 0.45);
const CONC_ROOF = linC(0.54, 0.53, 0.54);
const CONC_UNDER = linC(0.3, 0.295, 0.31);
const CONC_COL = linC(0.56, 0.55, 0.53);
const PANEL = linC(0.58, 0.57, 0.55);
const BASE = linC(0.5, 0.47, 0.46);
const FILL = linC(0.55, 0.54, 0.55);
const STEEL = linC(0.66, 0.68, 0.72);
const DARK = linC(0.2, 0.2, 0.24);
const INK = linC(0.12, 0.11, 0.15);
const WHITE = linC(0.96, 0.96, 0.93);
const YEL = linC(0.98, 0.8, 0.2);
const RED = linC(0.86, 0.16, 0.16);
const GREEN = linC(0.2, 0.85, 0.45);
const LAMP = linC(0.92, 1, 0.96);
const BLUE_P = linC(0.1, 0.34, 0.78);
const STAIN = linC(0.4, 0.39, 0.41);
const STAIN_D = linC(0.31, 0.3, 0.33);
const GLASS = linC(0.42, 0.58, 0.72);
// each level its colour (the street floor slate, then red, orange, yellow, green, blue; the roof
// violet), on its columns, its signs, its band round the outside
// (a colour and a name for each level, the street's to the roof run's high end - NDECK + 1 of them)
const LEVEL_C = [[0.46, 0.55, 0.68], [0.86, 0.24, 0.26], [0.97, 0.55, 0.18], [0.98, 0.8, 0.2], [0.32, 0.72, 0.42], [0.2, 0.7, 0.72], [0.26, 0.5, 0.88], [0.62, 0.38, 0.84], [0.9, 0.36, 0.62]].map(([r, g, b]) => linC(r, g, b));
const LEVEL_NAME = Array.from({ length: NDECK + 1 }, (_, k) => (k === 0 ? 'G' : k === NDECK ? 'R' : String(k)));

// ------------------------------------------------------------------ the car park
export class CarPark {
  constructor(game) {
    this.game = game;
    this.built = false;
    this.cols = [];
    this.groups = [];
    // the two buildings as the set's drawing of the parked cars sees them: their ground (s), their
    // parked cars ({ x, y, z, yaw, tilt, roll, spec })
    this.main = { s: { x0: MX0, x1: MX1, z0: MZ0, z1: MZ1 }, parked: [] };
    this.land = { s: { x0: LX0, x1: LX1, z0: LZ0, z1: LZ1 }, parked: [] };
    this.parts = [this.main, this.land];
    this.tris = 0;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const M = itemMats();
    const col = this.game.world.collision;
    this.wall = (x0, z0, x1, z1, y0, y1, tag = 'wall') => this.cols.push(col.addBox(x0, z0, x1, z1, y0, y1, tag));
    // the garage's structure and its street; what is inside it (shown near it only); Bayshore
    const KS = new Kit();
    const KI = new Kit();
    const KL = new Kit();
    const KLI = new Kit();
    this.mainShell(KS, M);
    this.mainCores(KS, M);
    this.mainSigns(KS, M);
    this.street(KS, M);
    this.mainInside(KI, M);
    this.facade(KS, M);
    this.details(KI, M);
    if (LAND_ON) {
      this.landShell(KL, M);
      this.landInside(KLI, M);
    } else this.landBays = [];
    this.parkCars();
    // (what is inside each - the paint, the lights, the pipes, the signs - is drawn near it only,
    // and not for the sun: its shadows are the floors')
    this.near = [];
    for (const [K, seed, name, inside] of [[KS, 0.21, 'shell', false], [KI, 0.47, 'inside', true], [KL, 0.63, 'landing', false], [KLI, 0.71, 'landing-inside', true]]) {
      const g = K.build({ seed });
      g.name = `carpark-${name}`;
      for (const m of g.children) {
        // (each draws only when it is in the picture: Kit's meshes are drawn wherever they are)
        m.frustumCulled = true;
        if (inside) m.userData.noShadow = true;
        this.tris += m.geometry.attributes.position.count / 3;
      }
      g.updateMatrix();
      this.game.scene.add(g);
      this.groups.push(g);
      if (inside) this.near.push({ g, s: name === 'inside' ? this.main.s : this.land.s });
    }
    // (on the city's map, and on the minimap's picture of the city - drawn before these were built)
    const w = this.game.world;
    const fp = [
      { x0: MX0, z0: MZ0, x1: MX1, z1: MZ1, top: LV(NDECK), color: new THREE.Color(0.86, 0.84, 0.8), trim: new THREE.Color(0.1, 0.34, 0.78) },
      ...(LAND_ON ? [{ x0: LX0, z0: LZ0, x1: LX1, z1: LZ1, top: LY[LY.length - 1], color: new THREE.Color(0.86, 0.84, 0.8), trim: new THREE.Color(0.22, 0.62, 0.7) }] : []),
    ];
    if (w.footprints) w.footprints.push(...fp);
    const hud = this.game.hud;
    if (hud && hud.mapCanvas && hud.mapOrigin) {
      const g = hud.mapCanvas.getContext('2d');
      const px = hud.mapPx || 1;
      const [ox, oz] = hud.mapOrigin;
      g.setTransform(px, 0, 0, px, 0, 0);
      g.strokeStyle = '#1b1430';
      g.lineWidth = 1;
      g.fillStyle = '#c9c4d6';
      for (const f of fp) {
        g.fillRect(f.x0 + ox, f.z0 + oz, f.x1 - f.x0, f.z1 - f.z0);
        g.strokeRect(f.x0 + ox + 0.5, f.z0 + oz + 0.5, f.x1 - f.x0 - 1, f.z1 - f.z0 - 1);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.clearWays();
    // (what pedestrians and the police find their way round)
    const nav = this.game.world.nav;
    if (nav && nav.queueRefresh) {
      nav.queueRefresh(MX0 - 2, MZ0 - 2, MX1 + 2, MZ1 + 2);
      if (LAND_ON) nav.queueRefresh(LX0 - 2, LZ0 - 2, LX1 + 2, LZ1 + 2);
    }
  }

  // the city's things in the way of its ways in and out: the street furniture on the sidewalks
  // they cross (taken out as a prop is when it is rubbed out, at once), the cars parked at the curb
  // before them and where the two men's car stops
  clearWays() {
    const g = this.game;
    const w = g.world;
    // (the sidewalk along the front on 5th Street from the two men's car to Washington Avenue -
    // the ways in on foot and by car - the way out onto 7th Street, Bayshore's gate)
    const walks = [[PARK.thugCar.x - 4.5, MZ1, MX1 + 2, 295.6], [W_AISLE_X - 4.8, 170.4, W_AISLE_X + 4.8, MZ0], [L_GATE[0] - 0.5, 306.4, L_GATE[1] + 0.5, LZ0]];
    const curbs = [[E_AISLE_X - 7, 294, E_AISLE_X + 7, 301], [W_AISLE_X - 7, 165, W_AISLE_X + 7, 172], [L_GATE[0] - 3, 301, L_GATE[1] + 3, 308], [PARK.thugCar.x - 4.5, 294, PARK.thugCar.x + 4.5, 299.5]];
    const hit = (r, x0, z0, x1, z1) => x1 > r[0] && x0 < r[2] && z1 > r[1] && z0 < r[3];
    this.cleared = { props: 0, cars: 0 };
    const O = w.objects;
    if (O && O.list && w.nav) {
      for (const o of O.list) {
        if (!o || o.state !== 'here' || !o.boxes.length) continue;
        if (!walks.some((r) => hit(r, o.x0, o.z0, o.x1, o.z1))) continue;
        O.remove(o);
        this.cleared.props++;
      }
    }
    const gone = (c) => curbs.some((r) => hit(r, c.x - 1, c.z - 1, c.x + 1, c.z + 1));
    // (out of the lists in place: whoever holds them holds the same ones)
    const T = g.traffic;
    if (T && T.parked) {
      for (let i = T.parked.length - 1; i >= 0; i--) {
        const c = T.parked[i];
        if (!gone(c)) continue;
        if (c.box !== undefined) w.collision.remove(c.box);
        T.parked.splice(i, 1);
        this.cleared.cars++;
      }
    }
    if (w.parked) for (let i = w.parked.length - 1; i >= 0; i--) if (gone(w.parked[i])) w.parked.splice(i, 1);
  }

  floorAt(x, z, y) {
    return parkFloor(x, z, y);
  }

  ceilingAt(x, z, y) {
    return parkCeiling(x, z, y);
  }

  // (for the tests) is (x, y, z) inside one of the floors' slabs - where a camera would see nothing
  // of it?
  inSlab(x, y, z) {
    if (x > MX0 && x < MX1 && z > MZ0 && z < MZ1) {
      for (let k = 1; k <= NDECK; k++) if (y > LV(k) - SLAB && y < LV(k) && !mainHole(k, x, z)) return `main L${k}`;
    }
    if (LAND_ON && x > LX0 && x < LX1 && z > LZ0 && z < LZ1) {
      for (let k = 1; k < LY.length; k++) if (y > LY[k] - SLAB && y < LY[k] && !landHole(k, x, z)) return `land L${k}`;
    }
    return null;
  }

  // what is inside them is drawn near them only
  update() {
    if (!this.near) return;
    const c = this.game.camera.position;
    const far = this.game.touch ? 140 : 220;
    for (const { g, s } of this.near) {
      const dx = Math.max(s.x0 - c.x, 0, c.x - s.x1);
      const dz = Math.max(s.z0 - c.z, 0, c.z - s.z1);
      g.visible = Math.hypot(dx, dz) < far;
    }
    // (round 11: the failing tubes - on, off, a stutter, on for a while)
    if (this.flick) {
      const s = this.main.s;
      const near = Math.hypot(Math.max(s.x0 - c.x, 0, c.x - s.x1), Math.max(s.z0 - c.z, 0, c.z - s.z1)) < far;
      const t = performance.now() / 1000;
      for (const f of this.flick) {
        if (t > f.next) {
          f.on = !f.on;
          f.next = t + (f.on ? (Math.random() < 0.35 ? 1 + Math.random() * 3 : 0.05 + Math.random() * 0.2) : 0.04 + Math.random() * 0.16);
        }
        f.g.visible = near && f.on;
      }
    }
  }

  dispose() {
    const g = this.game;
    for (const o of this.groups) {
      g.scene.remove(o);
      o.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    }
    this.groups = [];
    this.near = null;
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.built = false;
  }

  // ------------------------------------------------------------------ 5th Street Garage: its body
  // (round 11) every floor one open hall the width of the block, its slab whole but for the opening
  // the ramp from under it comes up through; the ramps solid wedges on their floors, a parapet along
  // both their sides; the outer walls' panels; the columns in the outer walls, by the ramps and down
  // the middle beside them - none in the turns at the ends, open from wall to wall
  mainShell(K, M) {
    const wall = this.wall;
    K.box(M.matte, MX0, 0.02, MZ0, MX1, Y0 - 0.004, MZ1, CONC_TOP);
    for (let k = 1; k <= NDECK; k++) {
      const y = LV(k);
      const r = RAMPS[k - 1];
      const pieces = [[MX0, MZ0, MX1, RN], [MX0, RS, MX1, MZ1], [MX0, RN, r.x0, RS], [r.x1, RN, MX1, RS]];
      for (const [a0, b0, a1, b1] of pieces) {
        if (a1 - a0 < 0.01) continue;
        K.box(M.matte, a0, y - SLAB, b0, a1, y, b1, k === NDECK ? CONC_ROOF : CONC_TOP);
        wall(a0, b0, a1, b1, y - SLAB + 0.02, y, 'floor');
      }
      // round the opening: a parapet along its inner side and across its low end (its high end is
      // the way on, its outer side the building's wall)
      const xi = r.west ? r.x1 : r.x0 - 0.3;
      K.box(M.matte, xi, y, RN, xi + 0.3, y + PAR, RS, PANEL);
      K.box(M.paint, xi - 0.01, y + PAR - 0.28, RN, xi + 0.31, y + PAR - 0.08, RS, YEL);
      wall(xi, RN, xi + 0.3, RS, y - 0.3, y + PAR);
      const zl = r.zLow === RN ? RN - 0.3 : RS;
      K.box(M.matte, r.x0, y, zl, r.x1, y + PAR, zl + 0.3, PANEL);
      K.box(M.paint, r.x0, y + PAR - 0.28, zl - 0.01, r.x1, y + PAR - 0.08, zl + 0.31, YEL);
      wall(r.x0, zl, r.x1, zl + 0.3, y - 0.3, y + PAR);
      // the beams under it across, a span apart (not over the opening)
      for (let z = MZ0 + SPAN; z < MZ1 - 1; z += SPAN) {
        const runs = z > RN && z < RS ? [[MX0 + 0.3, r.x0], [r.x1, MX1 - 0.3]] : [[MX0 + 0.3, MX1 - 0.3]];
        for (const [xa, xb] of runs) if (xb - xa > 0.5) K.box(M.matte, xa, y - SLAB - BEAM, z - 0.25, xb, y - SLAB, z + 0.25, CONC_UNDER);
      }
    }
    // ---- the ramps: solid on their floors, eased at both ends; a parapet along both their sides
    for (const r of RAMPS) {
      const z0 = Math.min(r.zLow, r.zHigh);
      const z1 = Math.max(r.zLow, r.zHigh);
      const f = (z) => mainRampY(r, Math.max(z0, Math.min(z1, z)));
      const pts = [];
      for (let z = z0; z < z1 - 1e-6; z += z - z0 < R_EASE + 0.5 || z1 - z < R_EASE + 1.5 ? 1 : 7) pts.push([z, f(z)]);
      pts.push([z1, f(z1)]);
      const base = LV(r.k);
      K.add(M.matte, prism('z', pts, r.x0 + 0.02, r.x1 - 0.02, () => base), CONC_RAMP);
      for (const xa of [r.x0 + 0.02, r.x1 - 0.26]) {
        K.add(M.matte, prism('z', pts.map(([z, yy]) => [z, yy + PAR]), xa, xa + 0.24, () => base), PANEL);
        K.add(M.paint, prism('z', pts.map(([z, yy]) => [z, yy + PAR - 0.06]), xa - 0.01, xa + 0.25, (s, yy) => yy - 0.22), YEL);
        for (let z = z0; z < z1 - 1e-6; z += 2) {
          const ze = Math.min(z1, z + 2);
          wall(xa, z, xa + 0.24, ze, base - 0.3, Math.max(f(z), f(ze)) + PAR);
        }
      }
      // (its slab for walkers and the camera's look, in steps)
      for (let z = z0; z < z1 - 1e-6; z += 1.2) {
        const ze = Math.min(z1, z + 1.2);
        wall(r.x0, z, r.x1, ze, base - 0.3, Math.min(f(z), f(ze)), 'floor');
      }
    }
    // ---- the outer walls, each level: precast panels a parapet high (on the roof the edge's own),
    // the band in the garage's blue; the way in on the street floor from 5th Street, the way out onto
    // 7th Street shut
    for (let k = 0; k <= NDECK; k++) {
      const y = LV(k);
      const top = y + (k === NDECK ? PAR : 1.3);
      const bot = k === 0 ? 0.02 : y - SLAB - 0.15;
      for (const [zz, nz] of [[MZ0, -1], [MZ1, 1]]) {
        const runs = k === 0 && nz > 0 ? [[MX0, E_AISLE_X - 4.4], [E_AISLE_X + 4.4, MX1]] : k === NDECK && nz > 0 ? [[MX0, CX0], [CX1, MX1]] : [[MX0, MX1]];
        for (const [x0, x1] of runs) {
          const za = Math.min(zz, zz - nz * 0.25);
          const zb = Math.max(zz, zz - nz * 0.25);
          K.box(M.matte, x0, bot, za, x1, top, zb, PANEL);
          K.box(M.paint, x0, top - 0.36, Math.min(zz, zz + nz * 0.02), x1, top - 0.14, Math.max(zz, zz + nz * 0.02), BLUE_P);
          wall(x0, za - 0.05, x1, zb + 0.05, y - 0.3, top);
        }
      }
      for (const [xx, nx] of [[MX0, -1], [MX1, 1]]) {
        const xa = Math.min(xx, xx - nx * 0.25);
        const xb = Math.max(xx, xx - nx * 0.25);
        K.box(M.matte, xa, bot, MZ0, xb, top, MZ1, PANEL);
        K.box(M.paint, Math.min(xx, xx + nx * 0.02), top - 0.36, MZ0, Math.max(xx, xx + nx * 0.02), top - 0.14, MZ1, BLUE_P);
        wall(xa - 0.05, MZ0, xb + 0.05, MZ1, y - 0.3, top);
      }
    }
    // (the way out onto 7th Street: its roller shutter down)
    K.box(M.metal, W_AISLE_X - 4.4, 0.02, MZ0 - 0.32, W_AISLE_X + 4.4, LV(1) - SLAB - BEAM, MZ0 - 0.2, linC(0.36, 0.37, 0.4));
    for (let i = 0; i < 17; i++) K.box(M.metal, W_AISLE_X - 4.4, 0.25 + i * 0.27, MZ0 - 0.36, W_AISLE_X + 4.4, 0.29 + i * 0.27, MZ0 - 0.3, DARK);
    wall(W_AISLE_X - 4.4, MZ0 - 0.4, W_AISLE_X + 4.4, MZ0 + 0.3, 0, LV(1) - SLAB - BEAM);
    // ---- the columns
    const topIn = LV(NDECK) - SLAB;
    const col = (x, z, y1, w = 0.42) => {
      K.box(M.matte, x - w, 0.02, z - w, x + w, y1, z + w, CONC_COL);
      wall(x - w, z - w, x + w, z + w, 0, y1, 'pole');
    };
    this.colsAt = [];
    for (let z = MZ0 + SPAN; z < MZ1 - 1; z += SPAN) {
      for (const x of [MX0 + 0.42, MX1 - 0.42]) if (!inCore(x, z, 0.5)) col(x, z, LV(NDECK) + PAR);
    }
    for (let z = RN + 1.6; z < RS - 1; z += SPAN) {
      for (const x of [WL[1] + 0.75, EL[0] - 0.75]) {
        col(x, z, topIn);
        this.colsAt.push([x, z]);
      }
    }
    for (let z = RN + 6.8; z < RS - 6; z += SPAN) {
      col(MXC, z, topIn, 0.38);
      this.colsAt.push([MXC, z]);
    }
    // ---- the roof: the run's barriers, its lamp posts (none over the run)
    const RY = LV(NDECK);
    for (let z = RN + 1; z < MZ1 - 0.5; z += 3.05) {
      const ze = Math.min(MZ1 - 0.3, z + 2.95);
      K.box(M.matte, ROOF_BAR_X - 0.32, RY, z, ROOF_BAR_X + 0.32, RY + 0.86, ze, linC(0.8, 0.79, 0.76));
      K.box(M.paint, ROOF_BAR_X - 0.33, RY + 0.55, z, ROOF_BAR_X + 0.33, RY + 0.7, ze, RED);
      wall(ROOF_BAR_X - 0.32, z, ROOF_BAR_X + 0.32, ze, RY - 0.2, RY + 0.86);
    }
    for (let z = MZ0 + 14; z < MZ1 - 8; z += 17) {
      for (const x of [MX1 - 1.2, MXC]) {
        if (x === MXC && z > RN - 4 && z < RS + 4) continue;
        K.cyl(M.metal, 0.07, 0.1, RY, RY + 6, DARK, { axis: 'y', x, z, segs: 6 });
        K.box(M.paint, x - 0.32, RY + 5.85, z - 0.2, x + 0.32, RY + 6.0, z + 0.2, DARK);
        K.box(M.glow, x - 0.27, RY + 5.82, z - 0.15, x + 0.27, RY + 5.85, z + 0.15, LAMP);
        wall(x - 0.12, z - 0.12, x + 0.12, z + 0.12, RY, RY + 6, 'pole');
      }
    }
  }

  // ------------------------------------------------------------------ (round 12) its skin and its lights
  // The player's word: far more real, and impressive. Its four faces screened in fins of bronze
  // aluminium, floor to floor, close set, deeper and shallower by turns - the evening through them in
  // slats; every floor's edge a band of concrete with a line of warm light under it, so that at dusk
  // the whole of it is drawn in lines of light; the stair towers clad in dark glass, their landings
  // lit; planters on the floors' edges along Washington Avenue, green spilling over; and the launch
  // deck - the roof run carried on out over 5th Street, glass along its sides, the edge the car flies
  // from
  facade(K, M) {
    const wall = this.wall;
    const FIN = linC(0.72, 0.6, 0.42);
    const FIN_D = linC(0.58, 0.47, 0.32);
    const BAND = linC(0.66, 0.64, 0.6);
    const LED = linC(1, 0.84, 0.58);
    const LED_C = linC(0.5, 0.92, 1);
    const sides = [
      { a0: MZ0, a1: MZ1, fixed: MX0, n: -1, axis: 'x' },
      { a0: MZ0, a1: MZ1, fixed: MX1, n: 1, axis: 'x' },
      { a0: MX0, a1: MX1, fixed: MZ0, n: -1, axis: 'z' },
      { a0: MX0, a1: MX1, fixed: MZ1, n: 1, axis: 'z' },
    ];
    // (a box out from a face: along a0..a1 on it, d0..d1 out from it, y0..y1)
    const onFace = (sd, a0, a1, d0, d1, y0, y1, mat, col) => {
      const f0 = sd.fixed + sd.n * d0;
      const f1 = sd.fixed + sd.n * d1;
      if (sd.axis === 'x') K.box(mat, Math.min(f0, f1), y0, a0, Math.max(f0, f1), y1, a1, col);
      else K.box(mat, a0, y0, Math.min(f0, f1), a1, y1, Math.max(f0, f1), col);
    };
    const inCoreSpan = (sd, a) => (sd.axis === 'x' ? a < MZ0 + CORE_D + 0.2 || a > MZ1 - CORE_D - 0.2 : a < MX0 + CORE_W + 0.2 || a > MX1 - CORE_W - 0.2);
    for (let k = 0; k <= NDECK; k++) {
      const y = LV(k);
      // ---- the slab's edge: its band, and the light under it (not the street floor's)
      if (k > 0) {
        for (const sd of sides) {
          const runs = k === NDECK && sd.axis === 'z' && sd.n > 0 ? [[sd.a0, CX0], [CX1, sd.a1]] : [[sd.a0, sd.a1]];
          for (const [a0, a1] of runs) {
            onFace(sd, a0, a1, -0.05, 0.16, y - SLAB - 0.18, y + 0.04, M.matte, BAND);
            onFace(sd, a0, a1, 0.02, 0.12, y - SLAB - 0.24, y - SLAB - 0.18, M.glow, k === NDECK ? LED_C : LED);
          }
        }
      }
      if (k === NDECK) continue;
      // ---- the fins, floor to floor (over the panels' top to the next band)
      const yb = y + 1.3;
      const yt = LV(k + 1) - SLAB - 0.24;
      for (const sd of sides) {
        let i = 0;
        for (let a = sd.a0 + 0.45; a < sd.a1 - 0.3; a += 0.62, i++) {
          if (inCoreSpan(sd, a)) continue;
          // (none over the way in, nor the door from the street)
          if (k === 0 && sd.axis === 'z' && sd.n > 0 && a > E_AISLE_X - 4.8 && a < E_AISLE_X + 4.8) continue;
          const deep = i % 3 === 0 ? 0.46 : i % 3 === 1 ? 0.3 : 0.22;
          onFace(sd, a - 0.03, a + 0.03, 0.04, 0.04 + deep, k === 0 ? 2.6 : yb, yt, M.metal, i % 3 === 0 ? FIN : FIN_D);
        }
        // (a rail along their tops and their feet, holding them)
        onFace(sd, sd.a0 + 0.2, sd.a1 - 0.2, 0.04, 0.12, yt - 0.08, yt, M.metal, FIN_D);
      }
      // ---- planters on its edge along Washington Avenue, green spilling over (not on the street floor)
      if (k > 0) {
        const rng = mulberry(500 + k);
        for (let z = MZ0 + CORE_D + 4; z < MZ1 - CORE_D - 3; z += 9.2) {
          const x0 = MX1 + 0.12;
          K.box(M.matte, x0, y + 0.05, z - 1.6, x0 + 0.55, y + 0.62, z + 1.6, linC(0.36, 0.34, 0.32));
          for (let j = 0; j < 5; j++) {
            const r = 0.28 + rng() * 0.22;
            K.sphere(M.matte, r, x0 + 0.3 + rng() * 0.25, y + 0.55 - j * 0.32, z - 1.3 + rng() * 2.6, linC(0.16 + rng() * 0.1, 0.42 + rng() * 0.16, 0.2), 1, 1.3, 1, 7);
          }
        }
      }
    }
    // ---- the launch deck: its slab out over the street, glass along its sides and across its end,
    // the light under its edge
    const RY = LV(NDECK);
    const z0 = MZ1;
    const z1 = MZ1 + CANT;
    K.box(M.matte, CX0, RY - SLAB - 0.25, z0, CX1, RY, z1, CONC_ROOF);
    // (its underside tapering into the face: a deep beam on each side)
    for (const x of [CX0, CX1 - 0.5]) K.add(M.matte, prism('z', [[z0, RY - SLAB - 0.25], [z1, RY - SLAB - 0.25]], x, x + 0.5, (s) => RY - SLAB - 0.25 - 1.6 * (1 - (s - z0) / CANT)), CONC_UNDER);
    wall(CX0, z0, CX1, z1, RY - SLAB - 0.2, RY, 'floor');
    for (const [xa, xb] of [[CX0, CX0 + 0.08], [CX1 - 0.08, CX1]]) {
      K.box(M.glass, xa, RY, z0, xb, RY + PAR, z1, linC(0.6, 0.78, 0.86));
      K.box(M.metal, xa - 0.02, RY + PAR, z0, xb + 0.02, RY + PAR + 0.06, z1, STEEL);
      wall(xa, z0, xb, z1, RY - 0.3, RY + PAR);
    }
    K.box(M.glass, CX0, RY, z1 - 0.08, CX1, RY + PAR, z1, linC(0.6, 0.78, 0.86));
    K.box(M.metal, CX0, RY + PAR, z1 - 0.1, CX1, RY + PAR + 0.06, z1 + 0.02, STEEL);
    wall(CX0, z1 - 0.25, CX1, z1, RY - 0.3, RY + PAR);
    K.box(M.glow, CX0, RY - SLAB - 0.31, z1 - 0.06, CX1, RY - SLAB - 0.25, z1 + 0.02, LED_C);
    for (const x of [CX0, CX1]) K.box(M.glow, x - 0.04, RY - SLAB - 0.31, z0, x + 0.04, RY - SLAB - 0.25, z1, LED_C);
    // (the run painted out to its end: the edge's hatching)
    for (let i = 0; i < 7; i++) {
      const xa = CX0 + 0.6 + i * ((CX1 - CX0 - 1.2) / 7);
      K.box(M.paint, xa, RY + 0.005, z1 - 1.6, xa + (CX1 - CX0 - 1.2) / 14, RY + 0.02, z1 - 0.3, i % 2 ? INK : YEL);
    }
  }

  // ------------------------------------------------------------------ (round 12) what a real one has inside
  // On every floor: speed bumps at the foot of each ramp; wheel stops in the bays; the oil's stains
  // and the tyres' black arcs in the turns; a duct and a cable tray along the ceiling down the middle;
  // a convex mirror and a camera at each turn; a fire extinguisher on a column now and then; the
  // columns' numbers; charging posts at a few bays
  details(K, M) {
    const rng = mulberry(8080);
    const STAIN = linC(0.22, 0.21, 0.23);
    const TYRE = linC(0.12, 0.11, 0.13);
    const DUCT = linC(0.56, 0.58, 0.6);
    const TRAY = linC(0.42, 0.43, 0.46);
    const EXT = linC(0.86, 0.12, 0.1);
    const EV = linC(0.18, 0.7, 0.42);
    for (let k = 0; k <= NDECK; k++) {
      const y = LV(k);
      const flat = () => y;
      const r = k < NDECK ? RAMPS[k] : null;
      // ---- the speed bump at the ramp's foot
      if (r) {
        const up = Math.sign(r.zHigh - r.zLow);
        const zb = r.zLow - up * 3.2;
        for (let i = 0; i < 8; i++) {
          const xa = r.x0 + 0.5 + i * ((r.x1 - r.x0 - 1) / 8);
          K.box(M.paint, xa, y, zb - 0.22, xa + (r.x1 - r.x0 - 1) / 8, y + 0.07, zb + 0.22, i % 2 ? INK : YEL);
        }
      }
      // ---- wheel stops in the bays, stains under some
      for (const b of this.bays) {
        if (b.k !== k) continue;
        const fx = Math.sin(b.yaw);
        const wx = b.x + fx * 1.9;
        K.box(M.matte, wx - 0.1, y, b.z - 0.85, wx + 0.1, y + 0.12, b.z + 0.85, linC(0.62, 0.6, 0.56));
        if (rng() < 0.35) K.cyl(M.paint, 0.35 + rng() * 0.4, 0.35 + rng() * 0.4, y + 0.004, y + 0.012, STAIN, { axis: 'y', x: b.x + (rng() - 0.5) * 1.2, z: b.z + (rng() - 0.5) * 1.4, segs: 10 });
        // (a charging post at a few, on the street floor and the first)
        if (k <= 1 && rng() < 0.12) {
          const px = b.x + fx * 2.6;
          K.box(M.paint, px - 0.15, y, b.z - 0.15, px + 0.15, y + 1.35, b.z + 0.15, linC(0.9, 0.92, 0.9));
          K.box(M.glow, px - 0.16, y + 1.0, b.z - 0.1, px + 0.16, y + 1.18, b.z + 0.1, EV);
        }
      }
      // ---- the tyres' black arcs and the oil in the turns
      for (const zc of [(MZ0 + CORE_D + RN) / 2, (RS + MZ1 - CORE_D) / 2]) {
        for (let j = 0; j < 3; j++) {
          const R0 = 6 + rng() * 5;
          const cx = MXC + (rng() - 0.5) * 8;
          const a0 = rng() * Math.PI;
          let px = cx + Math.cos(a0) * R0;
          let pz = zc + Math.sin(a0) * R0 * 0.6;
          for (let s = 1; s <= 6; s++) {
            const a = a0 + s * 0.28;
            const nx = cx + Math.cos(a) * R0;
            const nz = zc + Math.sin(a) * R0 * 0.6;
            if (!inCore(nx, nz, 0.5) && nz > MZ0 + 0.5 && nz < MZ1 - 0.5) paintLine(K, M.paint, TYRE, px, pz, nx, nz, 0.22, flat, 0.012);
            px = nx;
            pz = nz;
          }
        }
        for (let j = 0; j < 4; j++) K.cyl(M.paint, 0.3 + rng() * 0.6, 0.3 + rng() * 0.6, y + 0.004, y + 0.011, STAIN, { axis: 'y', x: MXC + (rng() - 0.5) * 26, z: zc + (rng() - 0.5) * 12, segs: 9 });
      }
      if (k === NDECK) continue;
      const cy = LV(k + 1) - SLAB - BEAM;
      // ---- a duct and a cable tray along the ceiling, down the middle beside the bays
      K.box(M.metal, MXC - 7.6, cy - 0.62, RN - 4, MXC - 6.4, cy - 0.02, RS + 4, DUCT);
      for (let z = RN - 4; z < RS + 4; z += 6) K.box(M.metal, MXC - 7.7, cy - 0.66, z, MXC - 6.3, cy - 0.6, z + 0.12, linC(0.4, 0.42, 0.45));
      K.box(M.metal, MXC + 6.4, cy - 0.3, RN - 4, MXC + 7.2, cy - 0.24, RS + 4, TRAY);
      // ---- at each turn a convex mirror on the column by the ramp, and a camera
      for (const [zc, side] of [[RN - 1, -1], [RS + 1, 1]]) {
        for (const x of [WL[1] + 0.75, EL[0] - 0.75]) {
          K.cyl(M.metal, 0.03, 0.03, y + 2.0, y + 2.6, STEEL, { axis: 'y', x, z: zc, segs: 5 });
          K.sphere(M.glass, 0.42, x, y + 2.75, zc + side * 0.1, linC(0.7, 0.78, 0.86), 1, 1, 0.35, 10);
          K.cyl(M.paint, 0.46, 0.46, zc + side * 0.02, zc + side * 0.07, linC(0.95, 0.6, 0.1), { x, y: y + 2.75, segs: 12 });
        }
        K.box(M.paint, MXC - 0.15, cy - 0.32, zc - 0.12, MXC + 0.15, cy - 0.12, zc + 0.24, linC(0.14, 0.14, 0.16));
        K.box(M.glow, MXC - 0.03, cy - 0.27, zc + side * 0.25 - 0.02, MXC + 0.03, cy - 0.21, zc + side * 0.25 + 0.02, RED);
      }
      // ---- a fire extinguisher on a column now and then; the columns' numbers
      let ci = 0;
      for (const [x, z] of this.colsAt) {
        ci++;
        const side = x < MXC ? 1 : -1;
        const fx = x + side * 0.46;
        if (ci % 3 === k % 3) {
          K.box(M.paint, fx - 0.02, y + 0.9, z - 0.18, fx + side * 0.2, y + 1.55, z + 0.18, EXT);
          K.box(M.paint, fx + side * 0.2, y + 1.6, z - 0.16, fx + side * 0.22, y + 1.8, z + 0.16, linC(0.95, 0.95, 0.92));
        }
        wallWord(K, M.paint, WHITE, `${LEVEL_NAME[k]}${ci}`, 0.32, x + side * 0.43, y + 2.2, z, side, 0, 0.012);
      }
    }
  }

  // the stair and lift towers at its four corners, up past the roof; at each floor on the face to the
  // hall the stair's door, EXIT over it, the floor's number big beside it in its colour; the one at
  // 5th and Washington hollow on the street floor - its lobby, the way in on foot
  mainCores(K, M) {
    const wall = this.wall;
    this.cores = [];
    const top = LV(NDECK) + 3.4;
    for (const [west, north] of [[true, true], [false, true], [true, false], [false, false]]) {
      const x0 = west ? MX0 : MX1 - CORE_W;
      const x1 = west ? MX0 + CORE_W : MX1;
      const z0 = north ? MZ0 : MZ1 - CORE_D;
      const z1 = north ? MZ0 + CORE_D : MZ1;
      const lobby = !west && !north;
      const LT = Y0 + 2.9;
      // (round 12: clad in dark glass, its landings lit behind it - a line of light half way up each
      // floor, round its two street faces)
      K.box(M.glass, x0, lobby ? LT : 0.02, z0, x1, top, z1, linC(0.2, 0.27, 0.36));
      K.box(M.paint, x0 - 0.04, top - 1.4, z0 - 0.04, x1 + 0.04, top - 0.2, z1 + 0.04, BLUE_P);
      for (let k = 0; k < NDECK; k++) {
        const ly = LV(k) + DH * 0.55;
        const ox = west ? x0 - 0.03 : x1;
        const oz = north ? z0 - 0.03 : z1;
        K.box(M.glow, ox, ly, z0 + 0.2, ox + 0.03, ly + 0.07, z1 - 0.2, linC(1, 0.88, 0.66));
        K.box(M.glow, x0 + 0.2, ly, oz, x1 - 0.2, ly + 0.07, oz + 0.03, linC(1, 0.88, 0.66));
      }
      K.box(M.matte, x0 - 0.15, top, z0 - 0.15, x1 + 0.15, top + 0.25, z1 + 0.15, PANEL);
      wall(x0, z0, x1, z1, lobby ? LT : 0, top);
      if (lobby) this.lobby(K, M, x0, x1, z0, z1, LT);
      const ox = west ? x0 : x1;
      const oz = north ? z0 : z1;
      const nx = west ? -1 : 1;
      const nz = north ? -1 : 1;
      wallWord(K, M.glow, WHITE, 'P', 0.95, ox + nx * 0.06, top - 1.27, (z0 + z1) / 2, nx, 0, 0.05);
      wallWord(K, M.glow, WHITE, 'P', 0.95, (x0 + x1) / 2, top - 1.27, oz + nz * 0.06, 0, nz, 0.05);
      // (on the face to the hall)
      const fx = west ? x1 + 0.02 : x0 - 0.02;
      const s = west ? 1 : -1;
      const zc = (z0 + z1) / 2;
      for (let k = 0; k <= NDECK; k++) {
        if (lobby && k === 0) continue;
        const y = LV(k);
        K.box(M.paint, Math.min(fx, fx + s * 0.06), y, zc - 2.4, Math.max(fx, fx + s * 0.06), y + 2.15, zc - 1.4, linC(0.32, 0.36, 0.42));
        K.box(M.paint, Math.min(fx, fx + s * 0.08), y + 2.3, zc - 2.7, Math.max(fx, fx + s * 0.08), y + 2.6, zc - 1.1, linC(0.06, 0.28, 0.14));
        wallWord(K, M.glow, GREEN, 'EXIT', 0.17, fx + s * 0.08, y + 2.37, zc - 1.9, s, 0, 0.02);
        K.box(M.paint, Math.min(fx, fx + s * 0.05), y + 0.7, zc + 0.2, Math.max(fx, fx + s * 0.05), y + 3.1, zc + 3.2, LEVEL_C[k]);
        wallWord(K, M.paint, WHITE, LEVEL_NAME[k], 1.6, fx + s * 0.05, y + 1.05, zc + 1.7, s, 0, 0.03);
      }
      this.cores.push({ west, north, x0, x1, z0, z1, top });
    }
    // the way in on foot at 5th Street and Washington: the street door, its canopy, the pay machine
    const c = this.cores.find((q) => !q.west && !q.north);
    const dx = (c.x0 + c.x1) / 2;
    const dz = c.z1 + 0.02;
    for (const sd of [-1, 1]) {
      // (its two leaves slid open, behind the side lights)
      K.box(M.glass, dx + sd * 1.15, Y0, dz, dx + sd * 2.2, Y0 + 2.4, dz + 0.05, GLASS);
      K.box(M.metal, dx + sd * 1.1 - 0.05, Y0, dz, dx + sd * 1.1 + 0.05, Y0 + 2.5, dz + 0.08, STEEL);
    }
    K.box(M.metal, dx - 1.2, Y0 + 2.4, dz, dx + 1.2, Y0 + 2.5, dz + 0.08, STEEL);
    K.box(M.paint, dx - 1.8, Y0 + 2.9, dz, dx + 1.8, Y0 + 3.15, dz + 1.6, BLUE_P);
    K.box(M.glow, dx - 1.6, Y0 + 2.88, dz + 0.3, dx + 1.6, Y0 + 2.9, dz + 1.3, LAMP);
    wallWord(K, M.glow, WHITE, 'PARKING', 0.16, dx, Y0 + 2.94, dz + 1.62, 0, 1, 0.02);
    const px = dx - 2.1;
    K.box(M.paint, px - 0.35, Y0, dz + 0.05, px + 0.35, Y0 + 1.65, dz + 0.5, BLUE_P);
    K.box(M.glow, px - 0.2, Y0 + 1.2, dz + 0.5, px + 0.2, Y0 + 1.45, dz + 0.52, linC(0.55, 0.9, 1));
    K.box(M.metal, px - 0.25, Y0 + 0.8, dz + 0.5, px + 0.25, Y0 + 1.0, dz + 0.53, STEEL);
    wallWord(K, M.paint, WHITE, 'PAY', 0.12, px, Y0 + 1.5, dz + 0.51, 0, 1, 0.01);
    this.wall(px - 0.35, dz, px + 0.35, dz + 0.5, 0, Y0 + 1.65, 'prop');
  }

  // the lobby of the tower at 5th and Washington, on the street floor: walls round it with the door
  // from the street in the south one and the door into the garage in the west one; inside the
  // lift's doors, a flight of stairs up along the east wall, the light, a pay machine, the floor's
  // level on the wall
  lobby(K, M, x0, x1, z0, z1, LT) {
    const wall = this.wall;
    const T = 0.22;
    const WL = linC(0.86, 0.85, 0.82);
    const dx = (x0 + x1) / 2;
    const dz = (z0 + z1) / 2 - 0.6;
    const piece = (a0, a1, b0, b1, y0 = 0.02, y1 = LT) => {
      K.box(M.matte, a0, y0, b0, a1, y1, b1, WL);
      if (y0 < 0.5) wall(a0, b0, a1, b1, 0, y1);
    };
    piece(x1 - T, x1, z0, z1);
    piece(x0, x1, z0, z0 + T);
    piece(x0, dx - 1.1, z1 - T, z1);
    piece(dx + 1.1, x1, z1 - T, z1);
    piece(dx - 1.1, dx + 1.1, z1 - T, z1, Y0 + 2.4, LT);
    piece(x0, x0 + T, z0, dz - 1.0);
    piece(x0, x0 + T, dz + 1.0, z1);
    piece(x0, x0 + T, dz - 1.0, dz + 1.0, Y0 + 2.3, LT);
    K.box(M.matte, x0, LT - 0.12, z0, x1, LT, z1, CONC_UNDER);
    K.box(M.paint, dx - 0.7, LT - 0.18, dz - 0.15, dx + 0.7, LT - 0.12, dz + 0.15, WHITE);
    K.box(M.glow, dx - 0.62, LT - 0.21, dz - 0.07, dx + 0.62, LT - 0.18, dz + 0.07, LAMP);
    // the lift (its doors in the north wall, the call button), the stairs up the east wall
    K.box(M.metal, dx - 0.8, Y0, z0 + T, dx + 0.8, Y0 + 2.2, z0 + T + 0.05, linC(0.76, 0.78, 0.82));
    K.box(M.matte, dx - 0.01, Y0, z0 + T, dx + 0.01, Y0 + 2.2, z0 + T + 0.06, DARK);
    K.box(M.glow, dx + 1.0, Y0 + 1.05, z0 + T, dx + 1.1, Y0 + 1.17, z0 + T + 0.07, linC(1, 0.85, 0.4));
    for (let i = 0; i < 8; i++) {
      const sz = z0 + T + 0.3 + i * 0.3;
      K.box(M.matte, x1 - T - 1.3, Y0, sz, x1 - T, Y0 + 0.18 * (i + 1), sz + 0.3, CONC_COL);
    }
    K.box(M.metal, x1 - T - 1.35, Y0 + 0.9, z0 + T + 0.3, x1 - T - 1.3, Y0 + 0.95 + 1.44, z0 + T + 2.7, STEEL);
    wall(x1 - T - 1.3, z0 + T + 0.3, x1 - T, z0 + T + 2.7, 0, Y0 + 1.5);
    // the pay machine inside, by the west door; the level on the wall over the lift
    K.box(M.paint, x0 + T, Y0, z0 + T + 0.3, x0 + T + 0.45, Y0 + 1.6, z0 + T + 1.0, BLUE_P);
    K.box(M.glow, x0 + T + 0.45, Y0 + 1.15, z0 + T + 0.45, x0 + T + 0.47, Y0 + 1.4, z0 + T + 0.85, linC(0.55, 0.9, 1));
    wall(x0 + T, z0 + T + 0.3, x0 + T + 0.45, z0 + T + 1.0, 0, Y0 + 1.6, 'prop');
    K.box(M.paint, dx - 0.5, Y0 + 2.3, z0 + T, dx + 0.5, Y0 + 2.75, z0 + T + 0.03, LEVEL_C[0]);
    wallWord(K, M.paint, WHITE, 'G', 0.32, dx, Y0 + 2.37, z0 + T + 0.03, 0, 1, 0.02);
    // the frame of the door into the garage, EXIT over it inside
    for (const sz of [dz - 1.0, dz + 1.0]) K.box(M.metal, x0 - 0.04, Y0, sz - 0.05, x0 + T + 0.04, Y0 + 2.3, sz + 0.05, STEEL);
    K.box(M.paint, x0 + T, Y0 + 2.4, dz - 0.6, x0 + T + 0.05, Y0 + 2.7, dz + 0.6, linC(0.06, 0.28, 0.14));
    wallWord(K, M.glow, GREEN, 'EXIT', 0.17, x0 + T + 0.05, Y0 + 2.47, dz, 1, 0, 0.02);
  }

  // ------------------------------------------------------------------ its name, the big P
  mainSigns(K, M) {
    // the name along the south face over the way in (lit letters on a dark board), and up the east
    // face on Washington Avenue
    const name = PARK.name;
    const hS = 1.25;
    const lenS = letter(name, hS, () => {});
    const sx = (MXC + MX1) / 2;
    const sy = LV(1) + 0.4;
    K.box(M.matte, sx - lenS / 2 - 0.6, sy - 0.3, MZ1 + 0.25, sx + lenS / 2 + 0.6, sy + hS + 0.3, MZ1 + 0.4, DARK);
    wallWord(K, M.glow, linC(1, 0.92, 0.7), name, hS, sx, sy, MZ1 + 0.4, 0, 1, 0.08);
    const ey = LV(Math.round(NDECK * 0.66)) + 0.5;
    const ez = (MZ0 + MZ1) / 2;
    K.box(M.matte, MX1 + 0.25, ey - 0.35, ez - lenS / 2 - 0.7, MX1 + 0.4, ey + hS + 0.35, ez + lenS / 2 + 0.7, DARK);
    wallWord(K, M.glow, linC(1, 0.92, 0.7), name, hS, MX1 + 0.4, ey, ez, 1, 0, 0.08);
    // the blade at the corner of 5th and Washington: PARKING down it, a big P at its head, lit
    const bx = MX1 + 0.9;
    const bz = MZ1 - CORE_D - 1.6;
    const b0 = LV(1);
    const b1 = LV(NDECK) + 2.2;
    K.box(M.paint, bx - 0.25, b0, bz - 1.2, bx + 0.25, b1, bz + 1.2, BLUE_P);
    K.box(M.metal, MX1 - 0.02, b0 + 0.6, bz - 0.15, bx - 0.25, b0 + 0.9, bz + 0.15, STEEL);
    K.box(M.metal, MX1 - 0.02, b1 - 1.2, bz - 0.15, bx - 0.25, b1 - 0.9, bz + 0.15, STEEL);
    for (const s of [-1, 1]) {
      const fx = bx + s * 0.25;
      wallWord(K, M.glow, WHITE, 'P', 1.9, fx, b1 - 2.6, bz, s, 0, 0.06);
      const word = 'PARKING';
      for (let i = 0; i < word.length; i++) wallWord(K, M.glow, linC(1, 0.95, 0.75), word[i], 1.0, fx, b1 - 4.6 - i * 1.55, bz, s, 0, 0.05);
    }
    for (const s of [-1, 1]) K.box(M.glow, bx - 0.27, b0, bz + s * 1.2 - 0.03, bx + 0.27, b1, bz + s * 1.2 + 0.03, linC(0.5, 0.85, 1));
    // over the ways in and out: the words on the end walls
    const ix = E_AISLE_X;
    K.box(M.paint, ix - 3.6, LV(1) - SLAB - 0.22 - 0.02, MZ1 + 0.25, ix + 3.6, LV(1) - SLAB + 0.1, MZ1 + 0.3, linC(0.12, 0.42, 0.24));
    wallWord(K, M.glow, WHITE, 'ENTRANCE', 0.3, ix, LV(1) - SLAB - 0.2, MZ1 + 0.3, 0, 1, 0.02);
    const ox = W_AISLE_X;
    K.box(M.paint, ox - 2.4, LV(1) - SLAB - 0.24, MZ0 - 0.3, ox + 2.4, LV(1) - SLAB + 0.1, MZ0 - 0.25, linC(0.62, 0.12, 0.12));
    wallWord(K, M.glow, WHITE, 'EXIT', 0.3, ox, LV(1) - SLAB - 0.2, MZ0 - 0.3, 0, -1, 0.02);
  }

  // ------------------------------------------------------------------ the street round it
  // The ways in and out across the sidewalks (dropped curbs, the paving cut for them), the
  // clearance bar out over the way in on its posts, a strip of planting along its long sides with a
  // low wall, and Bayshore's gate to 5th Street
  street(K, M) {
    const wall = this.wall;
    const APRON = linC(0.7, 0.69, 0.67);
    for (const [x, z0, z1] of [[E_AISLE_X, MZ1, 295], [W_AISLE_X, 171, MZ0], ...(LAND_ON ? [[(L_GATE[0] + L_GATE[1]) / 2, 307, LZ0]] : [])]) {
      K.box(M.matte, x - 4.2, 0.02, z0, x + 4.2, 0.158, z1, APRON);
      for (let i = 0; i < 6; i++) {
        const zz = z0 + ((z1 - z0) * (i + 0.5)) / 6;
        K.box(M.paint, x - 4.2, 0.158, zz - 0.04, x + 4.2, 0.16, zz + 0.04, linC(0.6, 0.59, 0.58));
      }
    }
    // the clearance bar over the way in, hung from its frame on the sidewalk
    const bz = MZ1 + 2.2;
    const x0 = E_AISLE_X - 4.4;
    const x1 = E_AISLE_X + 4.4;
    for (const x of [x0, x1]) {
      K.box(M.metal, x - 0.1, 0.15, bz - 0.1, x + 0.1, 3.1, bz + 0.1, YEL);
      for (let i = 0; i < 4; i++) K.box(M.metal, x - 0.105, 0.4 + i * 0.7, bz - 0.105, x + 0.105, 0.75 + i * 0.7, bz + 0.105, INK);
      wall(x - 0.12, bz - 0.12, x + 0.12, bz + 0.12, 0, 3.1, 'pole');
    }
    K.box(M.metal, x0, 2.9, bz - 0.06, x1, 3.0, bz + 0.06, STEEL);
    for (const x of [x0 + 1.2, x1 - 1.2]) K.box(M.metal, x - 0.015, 2.35, bz - 0.015, x + 0.015, 2.9, bz + 0.015, STEEL);
    for (let i = 0; i < 10; i++) {
      const xa = x0 + 0.4 + (i * (x1 - x0 - 0.8)) / 10;
      K.box(M.paint, xa, 2.12, bz - 0.09, xa + (x1 - x0 - 0.8) / 10, 2.35, bz + 0.09, i % 2 ? INK : YEL);
    }
    wallWord(K, M.paint, WHITE, 'MAX HEADROOM 2.1M', 0.13, E_AISLE_X, 2.17, bz + 0.1, 0, 1, 0.01);
    // the tariff board by the way in, on its two posts against the wall, lit from over it
    const tx = E_AISLE_X - 7.2;
    const tz = MZ1 + 0.18;
    for (const sx of [tx - 1.1, tx + 1.1]) {
      K.box(M.metal, sx - 0.05, 0.15, tz - 0.05, sx + 0.05, 2.45, tz + 0.05, DARK);
      wall(sx - 0.07, tz - 0.07, sx + 0.07, tz + 0.07, 0, 2.45, 'pole');
    }
    K.box(M.paint, tx - 1.3, 0.75, tz, tx + 1.3, 2.45, tz + 0.08, BLUE_P);
    K.box(M.paint, tx - 1.22, 0.83, tz + 0.08, tx + 1.22, 1.62, tz + 0.09, WHITE);
    wallWord(K, M.paint, WHITE, 'P', 0.62, tx - 0.72, 1.72, tz + 0.08, 0, 1, 0.02);
    wallWord(K, M.paint, WHITE, 'PUBLIC', 0.22, tx + 0.32, 2.05, tz + 0.08, 0, 1, 0.02);
    wallWord(K, M.paint, WHITE, 'PARKING', 0.22, tx + 0.32, 1.74, tz + 0.08, 0, 1, 0.02);
    wallWord(K, M.paint, BLUE_P, 'OPEN 24 HRS', 0.15, tx, 1.38, tz + 0.09, 0, 1, 0.02);
    wallWord(K, M.paint, INK, '1 HR $4', 0.15, tx, 1.14, tz + 0.09, 0, 1, 0.02);
    wallWord(K, M.paint, INK, 'DAY $18', 0.15, tx, 0.9, tz + 0.09, 0, 1, 0.02);
    K.box(M.metal, tx - 0.6, 2.45, tz + 0.04, tx + 0.6, 2.5, tz + 0.5, DARK);
    K.box(M.glow, tx - 0.5, 2.43, tz + 0.3, tx + 0.5, 2.45, tz + 0.45, LAMP);
    // the planting along the long sides (the avenues' sidewalks), a low wall round it, shrubs
    const rng = mulberry(77);
    for (const [xa, xb] of [[MX0 - 1.9, MX0 - 0.1], [MX1 + 0.1, MX1 + 1.9]]) {
      K.box(M.matte, xa, 0.02, MZ0 + 9, xb, 0.55, MZ1 - 12, linC(0.72, 0.7, 0.66));
      K.box(M.matte, xa + 0.15, 0.55, MZ0 + 9.15, xb - 0.15, 0.6, MZ1 - 12.15, linC(0.35, 0.28, 0.22));
      wall(xa, MZ0 + 9, xb, MZ1 - 12, 0, 0.6, 'prop');
      for (let z = MZ0 + 10; z < MZ1 - 13; z += 1.6 + rng() * 0.8) {
        const r = 0.45 + rng() * 0.3;
        K.sphere(M.matte, r, (xa + xb) / 2 + (rng() - 0.5) * 0.4, 0.6 + r * 0.55, z, linC(0.2 + rng() * 0.1, 0.48 + rng() * 0.12, 0.28), 1, 0.75, 1, 7);
      }
    }
  }

  // ------------------------------------------------------------------ inside the garage
  // what is inside it, floor by floor (round 11: dark - the concrete's own grey gone to shadow, lit
  // by its tubes, a fifth of them dead and some failing, the turns under sodium's orange): under every
  // floor its lights, the sprinkler main, the beams' shadows; on it the way painted (the arrows round
  // the turn, UP and the floor it goes to at the foot of each ramp, a red light there), the floor's
  // number big at its turn, the bays down the middle, the columns' hazard paint
  mainInside(K, M) {
    const rng = mulberry(4242);
    this.bays = [];
    // (the failing tubes, three lots of them, each blinking its own way: update)
    const FK = [new Kit(), new Kit(), new Kit()];
    const SODIUM = linC(1, 0.6, 0.24);
    const COLD = linC(0.82, 0.95, 1);
    for (let k = 0; k <= NDECK; k++) {
      const y = LV(k);
      const flat = () => y;
      // ---- under the floor over this one: the lights, the sprinkler main
      if (k < NDECK) {
        const ly = LV(k + 1) - SLAB - 0.1;
        const open = RAMPS[k];
        for (const x of [(WL[0] + WL[1]) / 2, MXC - 5.2, MXC + 5.2, (EL[0] + EL[1]) / 2]) {
          for (let z = MZ0 + SPAN * 0.5; z < MZ1 - 2; z += SPAN) {
            if (x > open.x0 && x < open.x1 && z > RN && z < RS) continue;
            if (inCore(x, z, 0.6)) continue;
            const turn = z < RN || z > RS;
            const r = rng();
            K.box(M.metal, x - 0.78, ly - 0.08, z - 0.14, x + 0.78, ly + 0.08, z + 0.14, DARK);
            if (r < 0.2) continue;
            const kit = r < 0.33 ? FK[Math.floor(rng() * 3)] : K;
            kit.box(M.glow, x - 0.7, ly - 0.11, z - 0.07, x + 0.7, ly - 0.08, z + 0.07, turn ? SODIUM : COLD);
          }
        }
        for (const x of [(WL[0] + WL[1]) / 2 + 3.5, (EL[0] + EL[1]) / 2 - 3.5]) {
          if (x > open.x0 && x < open.x1) continue;
          K.cyl(M.metal, 0.07, 0.07, MZ0 + CORE_D + 0.5, MZ1 - CORE_D - 0.5, RED, { x, y: ly + 0.12, segs: 6 });
        }
      }
      // ---- the columns' hazard paint at their feet (the ones inside)
      if (k < NDECK) {
        for (const [x, z] of this.colsAt) {
          const w = MXC === x ? 0.4 : 0.44;
          for (let i = 0; i < 4; i++) K.box(M.paint, x - w, y + i * 0.3, z - w, x + w, y + (i + 1) * 0.3, z + w, i % 2 ? INK : YEL);
        }
      }
      // ---- the way, painted: in from the ramp below (or the street) along one lane, round the turn
      // at the end the next ramp starts from, up it
      const r = k < NDECK ? RAMPS[k] : null;
      const north = r ? r.zLow === RN : true;
      const dA = north ? -1 : 1;
      const zEdge = north ? RN - 5 : RS + 5;
      const zMid = north ? (MZ0 + CORE_D + RN) / 2 : (RS + MZ1 - CORE_D) / 2;
      const upWest = r ? r.west : true;
      const xIn = upWest ? (EL[0] + EL[1]) / 2 : (WL[0] + WL[1]) / 2;
      const xUp = upWest ? (WL[0] + WL[1]) / 2 : (EL[0] + EL[1]) / 2;
      const fx = upWest ? -1 : 1;
      paintArrow(K, M.paint, WHITE, xIn, zEdge, 0, dA, flat, 5.5);
      paintArrow(K, M.paint, WHITE, xIn + fx * 4, zMid, fx * 0.7, dA * 0.7, flat, 5);
      paintArrow(K, M.paint, WHITE, MXC, zMid - dA * 2, fx, 0, flat, 6);
      paintArrow(K, M.paint, WHITE, xUp - fx * 4, zMid, fx * 0.7, -dA * 0.7, flat, 5);
      paintArrow(K, M.paint, WHITE, xUp, zEdge, 0, -dA, flat, 5.5);
      // (the floor's number, big, in the turn, in its colour)
      paintWord(K, M.paint, LEVEL_C[k], LEVEL_NAME[k], 3.4, MXC, zMid + dA * 4.5, 0, -dA, flat, 0.021);
      if (r) {
        // UP and the floor it goes to, at the ramp's foot; a red light on the wall by it; over it, the
        // board
        paintWord(K, M.paint, YEL, 'UP ' + LEVEL_NAME[k + 1], 1.5, r.xc, r.zLow - dA * -2.5, 0, -dA, flat, 0.023);
        const wx = r.west ? MX0 + 0.27 : MX1 - 0.27;
        K.box(M.glow, wx - 0.08, y + 0.9, r.zLow - 0.3, wx + 0.08, y + 1.22, r.zLow + 0.3, RED);
        const by = LV(k + 1) - SLAB - BEAM - 0.15;
        if (k + 1 <= NDECK) {
          K.box(M.paint, r.xc - 3, by - 1.05, r.zLow - 0.08, r.xc + 3, by, r.zLow + 0.08, linC(0.08, 0.1, 0.14));
          for (const sd of [-1, 1]) wallWord(K, M.glow, linC(1, 0.85, 0.3), 'UP ' + LEVEL_NAME[k + 1], 0.62, r.xc, by - 0.86, r.zLow + sd * 0.09, 0, sd, 0.02);
        }
      }
      // ---- the bays down the middle, nose to nose either side of its line (not on the roof's run)
      const rowZ0 = RN + 3.2;
      const rowZ1 = RS - 3.2;
      for (const [xb, face] of [[MXC - 2.75, Math.PI / 2], [MXC + 2.75, -Math.PI / 2]]) {
        const xo = xb < MXC ? MXC - 5.5 : MXC + 5.5;
        for (let z = rowZ0; z <= rowZ1 + 1e-6; z += 2.7) {
          paintLine(K, M.paint, WHITE, Math.min(xo, MXC), z - 1.35, Math.max(xo, MXC), z - 1.35, 0.1, flat, 0.021);
          if (z + 2.7 > rowZ1 + 1e-6) paintLine(K, M.paint, WHITE, Math.min(xo, MXC), z + 1.35, Math.max(xo, MXC), z + 1.35, 0.1, flat, 0.021);
          if (this.colsAt.some(([cx, cz]) => cx === MXC && Math.abs(cz - z) < 1.6)) continue;
          this.bays.push({ k, x: xb, z, yaw: face });
        }
      }
    }
    // (the failing tubes, each lot its own mesh)
    this.flick = FK.map((F, i) => {
      const g = F.build({ seed: 0.31 + i * 0.1 });
      for (const m of g.children) {
        m.frustumCulled = true;
        m.userData.noShadow = true;
      }
      g.name = 'carpark-flicker';
      g.updateMatrix();
      this.game.scene.add(g);
      this.groups.push(g);
      return { g, t: 0, next: 0.5 + i * 0.7, on: true };
    });
  }

  // ------------------------------------------------------------------ Bayshore Parking
  landShell(K, M) {
    const wall = this.wall;
    const BAND = linC(0.22, 0.62, 0.7);
    // ---- the floors: the street floor's slab whole; each one over it in pieces round the
    // openings of the ramps up to it
    K.box(M.matte, LX0, 0.02, LZ0, LX1, Y0 - 0.004, LZ1, CONC_TOP);
    for (let k = 1; k < LY.length; k++) {
      const y = LY[k];
      const holes = L_RAMPS.filter((r) => r.lv + 1 === k).map((r) => ({ x0: Math.min(r.xLow, r.xHigh), x1: Math.max(r.xLow, r.xHigh), z0: L_AISLE[r.aisle][0], z1: L_AISLE[r.aisle][1], r }));
      const xs = [LX0, LX1, ...holes.flatMap((q) => [q.x0, q.x1])].sort((a, b) => a - b);
      const zs = [LZ0, LZ1, ...holes.flatMap((q) => [q.z0, q.z1])].sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i++) {
        for (let jz = 0; jz + 1 < zs.length; jz++) {
          if (xs[i + 1] - xs[i] < 0.01 || zs[jz + 1] - zs[jz] < 0.01) continue;
          const cx = (xs[i] + xs[i + 1]) / 2;
          const cz = (zs[jz] + zs[jz + 1]) / 2;
          if (holes.some((q) => cx > q.x0 && cx < q.x1 && cz > q.z0 && cz < q.z1)) continue;
          K.box(M.matte, xs[i], y - SLAB, zs[jz], xs[i + 1], y, zs[jz + 1], k === LY.length - 1 ? CONC_ROOF : CONC_TOP);
          wall(xs[i], zs[jz], xs[i + 1], zs[jz + 1], y - SLAB + 0.02, y, 'floor');
        }
      }
      // round each opening: a wall along both its sides and over the ramp's low end (the high
      // end is the way on)
      for (const q of holes) {
        for (const zz of [q.z0, q.z1]) {
          const za = zz === q.z0 ? zz - 0.3 : zz;
          K.box(M.matte, q.x0, y, za, q.x1, y + PAR, za + 0.3, PANEL);
          K.box(M.paint, q.x0, y + PAR - 0.25, za - 0.01, q.x1, y + PAR - 0.1, za + 0.31, YEL);
          wall(q.x0, za, q.x1, za + 0.3, y - 0.3, y + PAR);
        }
        const lowX = q.r.xLow;
        const xa = lowX === q.x0 ? lowX - 0.3 : lowX;
        K.box(M.matte, xa, y, q.z0, xa + 0.3, y + PAR, q.z1, PANEL);
        K.box(M.paint, xa - 0.01, y + PAR - 0.25, q.z0, xa + 0.31, y + PAR - 0.1, q.z1, YEL);
        wall(xa, q.z0, xa + 0.3, q.z1, y - 0.3, y + PAR);
      }
      // the beams under it across, every bay (not over the openings)
      if (k < LY.length) {
        for (let x = LX0 + 8.5; x < LX1 - 1; x += 8.5) {
          for (const [za, zb] of [[LZ0 + 0.3, L_AISLE.N[0]], [L_AISLE.N[0], L_AISLE.N[1]], [L_AISLE.N[1], L_AISLE.S[0]], [L_AISLE.S[0], L_AISLE.S[1]], [L_AISLE.S[1], LZ1 - 0.3]]) {
            if (landHole(k, x, (za + zb) / 2)) continue;
            K.box(M.matte, x - 0.22, y - SLAB - L_BEAM, za, x + 0.22, y - SLAB, zb, CONC_UNDER);
          }
        }
      }
    }
    // ---- the ramps: their slabs, eased at both ends; the curb along each side; solid under them
    for (const r of L_RAMPS) {
      const a = L_AISLE[r.aisle];
      const x0 = Math.min(r.xLow, r.xHigh);
      const x1 = Math.max(r.xLow, r.xHigh);
      const pts = [];
      for (let x = x0; x <= x1 + 1e-6; x += x - x0 < L_RAMP_EASE || x1 - x < L_RAMP_EASE + 1 ? 1 : 26) pts.push([x, rampY(r, Math.min(x, x1))]);
      if (pts[pts.length - 1][0] < x1 - 1e-6) pts.push([x1, rampY(r, x1)]);
      K.add(M.matte, prism('x', pts, a[0] + 0.02, a[1] - 0.02, (s, y) => LY[r.lv] + 0.0), CONC_TOP);
      // (the arrows down it, its way written at its top)
      const dir = Math.sign(r.xLow - r.xHigh);
      const f = (x) => rampY(r, Math.max(x0, Math.min(x1, x)));
      for (const t of [0.3, 0.6]) paintArrow(K, M.paint, WHITE, x0 + (x1 - x0) * t, (a[0] + a[1]) / 2, dir, 0, (x) => f(x), 3.4);
      // the low curb along both sides of it
      const curb = pts.map(([x, y]) => [x, y + 0.22]);
      for (const zz of [a[0] + 0.02, a[1] - 0.32]) K.add(M.matte, prism('x', curb, zz, zz + 0.3, (s, y) => y - 0.27), CONC_COL);
      // and a wall along both its sides, the height of a parapet over it, so nothing drives off it
      const side = pts.map(([x, y]) => [x, y + PAR]);
      for (const zz of [a[0] - 0.02, a[1] - 0.2]) {
        K.add(M.matte, prism('x', side, zz, zz + 0.22, (s, y) => LY[r.lv] + 0.0), PANEL);
      }
      for (let x = x0; x < x1 - 1e-6; x += 2) {
        const xe = Math.min(x1, x + 2);
        for (const zz of [a[0] - 0.02, a[1] - 0.2]) wall(x, zz, xe, zz + 0.22, LY[r.lv] - 0.3, Math.max(f(x), f(xe)) + PAR);
      }
      // collision: its slab for walkers, in steps; the fill's sides
      for (let x = x0; x < x1 - 1e-6; x += 1.2) {
        const xe = Math.min(x1, x + 1.2);
        const lo = Math.min(f(x), f(xe));
        const hi = Math.max(f(x), f(xe));
        wall(x, a[0], xe, a[1], LY[r.lv] - 0.3, lo, 'floor');
        void hi;
      }
    }
    // ---- the outer walls (precast panels, the band), each level; the gate on the street floor
    for (let k = 0; k < LY.length; k++) {
      const y = LY[k];
      const top = y + PAR;
      const bot = k === 0 ? 0.02 : y - SLAB - 0.22;
      for (const [zz, nz] of [[LZ0, 1], [LZ1, -1]]) {
        const runs = k === 0 && nz > 0 ? [[LX0, L_GATE[0]], [L_GATE[1], LX1]] : [[LX0, LX1]];
        for (const [x0, x1] of runs) {
          K.box(M.matte, x0, bot, Math.min(zz, zz + nz * 0.25), x1, top, Math.max(zz, zz + nz * 0.25), PANEL);
          K.box(M.paint, x0, top - 0.34, Math.min(zz, zz - nz * 0.02), x1, top - 0.14, Math.max(zz, zz - nz * 0.02), BAND);
          wall(x0, Math.min(zz, zz + nz * 0.25) - 0.05, x1, Math.max(zz, zz + nz * 0.25) + 0.05, y - 0.3, top);
        }
      }
      for (const [xx, nx] of [[LX0, 1], [LX1, -1]]) {
        K.box(M.matte, Math.min(xx, xx + nx * 0.25), bot, LZ0, Math.max(xx, xx + nx * 0.25), top, LZ1, PANEL);
        K.box(M.paint, Math.min(xx, xx - nx * 0.02), top - 0.34, LZ0, Math.max(xx, xx - nx * 0.02), top - 0.14, LZ1, BAND);
        wall(Math.min(xx, xx + nx * 0.25) - 0.05, LZ0, Math.max(xx, xx + nx * 0.25) + 0.05, LZ1, y - 0.3, top);
      }
    }
    // ---- the columns: along the outer walls, down the middle between the bays (not in the cross
    // aisle, nor in the turn at the west end)
    const top = LY[LY.length - 1];
    for (let x = LX0 + 0.3; x <= LX1 - 0.2; x += 8.5) {
      for (const z of [LZ0 + 0.3, LZ1 - 0.3]) {
        // (none in the gate: a deep beam spans it)
        if (z < L_MID && x > L_GATE[0] - 0.4 && x < L_GATE[1] + 0.4) continue;
        K.box(M.matte, x - 0.3, 0.02, z - 0.3, x + 0.3, top + PAR, z + 0.3, CONC_COL);
        wall(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, top + PAR, 'pole');
      }
    }
    for (let x = -236; x <= L_EAST + 0.5; x += 8.5) {
      if (x > L_CROSS[0] - 0.5 && x < L_CROSS[1] + 0.5) continue;
      K.box(M.matte, x - 0.32, 0.02, L_MID - 0.32, x + 0.32, top - SLAB, L_MID + 0.32, CONC_COL);
      wall(x - 0.32, L_MID - 0.32, x + 0.32, L_MID + 0.32, 0, top - SLAB, 'pole');
    }
    // ---- its stair towers at the two corners on 5th Street; its name over the gate; the P
    for (const [x0, x1] of [[LX0, LX0 + 6], [LX1 - 6, LX1]]) {
      const z0 = LZ0;
      const z1 = LZ0 + 5.2;
      const ct = top + 3.4;
      K.box(M.matte, x0, 0.02, z0, x1, ct, z1, CONC_COL);
      K.box(M.paint, x0 - 0.04, ct - 1.3, z0 - 0.04, x1 + 0.04, ct - 0.2, z1 + 0.04, BAND);
      K.box(M.glass, (x0 + x1) / 2 - 1.0, 1.0, z0 - 0.04, (x0 + x1) / 2 + 1.0, ct - 1.7, z0, GLASS);
      wallWord(K, M.glow, WHITE, 'P', 0.9, (x0 + x1) / 2, ct - 1.22, z0 - 0.05, 0, -1, 0.05);
      wall(x0, z0, x1, z1, 0, ct);
      for (let k = 0; k < LY.length; k++) {
        const y = LY[k];
        K.box(M.paint, (x0 + x1) / 2 - 0.5, y, z1, (x0 + x1) / 2 + 0.5, y + 2.1, z1 + 0.06, linC(0.32, 0.4, 0.5));
        K.box(M.paint, (x0 + x1) / 2 - 0.7, y + 2.25, z1, (x0 + x1) / 2 + 0.7, y + 2.55, z1 + 0.08, linC(0.06, 0.28, 0.14));
        wallWord(K, M.glow, GREEN, 'EXIT', 0.17, (x0 + x1) / 2, y + 2.32, z1 + 0.08, 0, 1, 0.02);
      }
    }
    K.box(M.matte, L_GATE[0] - 0.4, LY[1] - SLAB - 0.75, LZ0, L_GATE[1] + 0.4, LY[1] - SLAB, LZ0 + 0.5, CONC_UNDER);
    const name = PARK.landing.name;
    const hN = 1.1;
    const lenN = letter(name, hN, () => {});
    const nx = (L_GATE[0] + L_GATE[1]) / 2 + 22;
    K.box(M.matte, nx - lenN / 2 - 0.5, LY[1] + 0.35, LZ0 - 0.4, nx + lenN / 2 + 0.5, LY[1] + 0.35 + hN + 0.5, LZ0 - 0.26, DARK);
    wallWord(K, M.glow, linC(0.6, 0.95, 1), name, hN, nx, LY[1] + 0.6, LZ0 - 0.4, 0, -1, 0.08);
    K.box(M.paint, L_GATE[0] + 0.5, LY[1] - SLAB - 0.5, LZ0 - 0.3, L_GATE[1] - 0.5, LY[1] - SLAB - 0.05, LZ0 - 0.25, linC(0.12, 0.42, 0.24));
    wallWord(K, M.glow, WHITE, 'IN  OUT', 0.3, (L_GATE[0] + L_GATE[1]) / 2, LY[1] - SLAB - 0.42, LZ0 - 0.3, 0, -1, 0.02);
    // the roof's lamp posts (none over the landing)
    for (let x = LX0 + 10; x < LX1 - 4; x += 17) {
      if (x > KEEP.land.x0 - 2 && x < KEEP.land.x1 + 2) continue;
      for (const z of [LZ0 + 1.2, LZ1 - 1.2]) {
        K.cyl(M.metal, 0.07, 0.1, top, top + 6, DARK, { axis: 'y', x, z, segs: 6 });
        K.box(M.paint, x - 0.32, top + 5.85, z - 0.2, x + 0.32, top + 6.0, z + 0.2, DARK);
        K.box(M.glow, x - 0.27, top + 5.82, z - 0.15, x + 0.27, top + 5.85, z + 0.15, LAMP);
        wall(x - 0.12, z - 0.12, x + 0.12, z + 0.12, top, top + 6, 'pole');
      }
    }
  }

  landInside(K, M) {
    const rng = mulberry(9191);
    this.landBays = [];
    // the bays of each floor: along the outer walls, back to back down the middle (not in the
    // ramps' aisles, the cross aisle, the turn at the west end)
    for (let k = 0; k < LY.length; k++) {
      const y = LY[k];
      const f = () => y;
      const rows = [
        { z0: LZ0 + 0.3, z1: L_AISLE.N[0], into: -1, x0: LX0 + 6.5, x1: LX1 - 6.5 },
        { z0: L_AISLE.N[1], z1: L_MID, into: 1, x0: -236, x1: L_EAST },
        { z0: L_MID, z1: L_AISLE.S[0], into: -1, x0: -236, x1: L_EAST },
        { z0: L_AISLE.S[1], z1: LZ1 - 0.3, into: 1, x0: LX0 + 0.4, x1: LX1 - 0.4 },
      ];
      for (const row of rows) {
        let n = 0;
        // (the aisle it opens onto, and whether on this floor that aisle is a ramp, or its opening,
        // between the ramps' ends: no way into a bay there)
        const aisle = row.z1 <= L_AISLE.N[0] + 0.01 || (row.z0 >= L_AISLE.N[1] - 0.01 && row.z1 <= L_MID + 0.01) ? 'N' : 'S';
        const blocked = L_RAMPS.some((r) => r.aisle === aisle && (r.lv === k || r.lv + 1 === k));
        for (let x = row.x0; x + 2.5 <= row.x1 + 1e-6; x += 2.5) {
          if (x + 2.5 > L_CROSS[0] && x < L_CROSS[1]) continue;
          if (blocked && x + 2.5 > -236 && x < -202) continue;
          paintLine(K, M.paint, WHITE, x, row.z0, x, row.z1, 0.1, f, 0.02);
          paintLine(K, M.paint, WHITE, x + 2.5, row.z0, x + 2.5, row.z1, 0.1, f, 0.02);
          const b = { k, x: x + 1.25, z: (row.z0 + row.z1) / 2, into: row.into, z0: row.z0, z1: row.z1, n: n++ };
          // (no bay over a ramp's fill: its aisle's sides only)
          this.landBays.push(b);
          if (rng() < 0.4) {
            const sx = b.x + (rng() - 0.5) * 0.8;
            const sz = b.z + (rng() - 0.5) * 1.5;
            const r = 0.3 + rng() * 0.4;
            paintQuad(K, M.matte, rng() < 0.5 ? STAIN : STAIN_D, [[sx - r, sz - r * 0.7], [sx + r, sz - r * 0.8], [sx + r * 0.9, sz + r * 0.7], [sx - r * 0.8, sz + r * 0.6]], f, 0.012);
          }
        }
      }
      // the aisles' arrows (the way down: west in the south aisle on the floors whose ramp down is
      // there, and so on), the level painted at the turns
      for (const [ak, a] of Object.entries(L_AISLE)) {
        const zc = (a[0] + a[1]) / 2;
        for (let x = -184; x < LX1 - 8; x += 16) paintArrow(K, M.paint, WHITE, x, zc, ak === 'S' ? -1 : 1, 0, f, 3.6);
      }
      paintWord(K, M.paint, WHITE, `LEVEL ${k === 0 ? 'G' : k === LY.length - 1 ? 'R' : k}`, 0.9, -244, L_MID, 1, 0, f);
      // the lights under the floor over it, the sprinkler main
      if (k < LY.length - 1) {
        const uy = LY[k + 1] - SLAB - L_BEAM + 0.12;
        for (const zc of [(L_AISLE.N[0] + L_AISLE.N[1]) / 2, (L_AISLE.S[0] + L_AISLE.S[1]) / 2, (LZ0 + L_AISLE.N[0]) / 2, (L_AISLE.S[1] + LZ1) / 2]) {
          for (let x = LX0 + 4.2; x < LX1 - 2; x += 8.5) {
            if (landHole(k + 1, x, zc)) continue;
            K.box(M.paint, x - 0.7, uy - 0.06, zc - 0.14, x + 0.7, uy, zc + 0.14, WHITE);
            K.box(M.glow, x - 0.62, uy - 0.09, zc - 0.07, x + 0.62, uy - 0.06, zc + 0.07, LAMP);
          }
        }
        for (const zp of [L_AISLE.N[0] + 1.2, L_AISLE.S[0] + 1.2]) {
          K.box(M.metal, LX0 + 0.5, uy - 0.62 + 0.4, zp - 0.06, LX1 - 0.5, uy - 0.5 + 0.4, zp + 0.06, RED);
        }
      }
    }
    // the gate's barrier (up) on the street floor, its machine
    const gx = (L_GATE[0] + L_GATE[1]) / 2;
    const iz = LZ0 + 3.2;
    K.box(M.matte, L_GATE[1] - 1.2, Y0, iz - 1.4, L_GATE[1] + 0.2, Y0 + 0.16, iz + 1.4, linC(0.75, 0.73, 0.7));
    K.box(M.paint, L_GATE[1] - 0.8, Y0 + 0.16, iz - 0.25, L_GATE[1] - 0.3, Y0 + 1.5, iz + 0.25, BLUE_P);
    for (let i = 0; i < 5; i++) K.box(M.paint, L_GATE[1] - 0.6, Y0 + 1.5 + i * 0.5, iz + 0.6, L_GATE[1] - 0.5, Y0 + 2.0 + i * 0.5, iz + 0.7, i % 2 ? WHITE : RED);
    this.wall(L_GATE[1] - 1.2, iz - 1.4, L_GATE[1] + 0.2, iz + 1.4, 0, Y0 + 1.5, 'prop');
    void gx;
  }

  // ------------------------------------------------------------------ the cars in the bays
  parkCars() {
    const rng = mulberry(31337);
    const spec = () => {
      let s = randomCarSpec(rng);
      for (let k = 0; k < 4 && (s.taxi || s.kind === 'van'); k++) s = randomCarSpec(rng);
      if (s.taxi) s = { kind: 'sedan', color: [0.7, 0.72, 0.76] };
      return s;
    };
    const put = (list, x, z, y, yaw, gx, gz) => {
      // (a car on a slope sits on it: tilted along it, rolled across it)
      const fx = Math.sin(yaw);
      const fzz = Math.cos(yaw);
      const along = gx * fx + gz * fzz;
      const across = gx * fzz - gz * fx;
      list.push({ x, y, z, yaw, tilt: -Math.atan(along), roll: Math.atan(across), spec: spec() });
      this.wall(x - (Math.abs(fx) > 0.5 ? 2.2 : 0.95), z - (Math.abs(fx) > 0.5 ? 0.95 : 2.2), x + (Math.abs(fx) > 0.5 ? 2.2 : 0.95), z + (Math.abs(fx) > 0.5 ? 0.95 : 2.2), y, y + 1.4, 'prop');
    };
    for (const b of this.bays) {
      if (rng() > (b.k === NDECK ? 0.3 : 0.55)) continue;
      // (nose in to the middle line; now and then backed in)
      const back = rng() < 0.2;
      put(this.main.parked, b.x, b.z, LV(b.k), back ? b.yaw + Math.PI : b.yaw, 0, 0);
    }
    for (const b of this.landBays) {
      if (rng() > (b.k === LY.length - 1 ? 0.35 : 0.62)) continue;
      if (b.k === LY.length - 1 && b.x > KEEP.land.x0 && b.x < KEEP.land.x1) continue;
      const yaw = b.into > 0 ? 0 : Math.PI;
      put(this.land.parked, b.x, b.z + b.into * 0.2, LY[b.k], rng() < 0.2 ? yaw + Math.PI : yaw, 0, 0);
    }
  }
}
