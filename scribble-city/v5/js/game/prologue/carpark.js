import * as THREE from 'three';
import { Kit, itemMats, linC } from '../items.js';
import { letter } from '../../world/letters.js';
import { randomCarSpec } from '../../render/cars.js';

// (prologue, ROADMAP 18) The car park the chase goes up: 5TH STREET GARAGE, in the middle of the
// city on the block between Meridian and Washington Avenues, 5th to 7th Street (the block's own
// buildings are left out of the city for it: world/blocks.js VACANT), and across 5th Street from
// it, on the open ground by the water, the lower one the car lands on: BAYSHORE PARKING.
//
// 5th Street Garage is the way big downtown car parks are built where the land is long: sloping
// floors. It is two halves side by side, each the length of the block (113 m) and 20 m across, its
// bays along both sides of its aisle; every floor of a half slopes the whole way along (4 %), the
// west half's up to the south, the east half's up to the north, each one a whole storey (3.2 m)
// from one end to the other; at each end the floors are flat for 16.5 m and the two halves meet
// there at one level - the turn. Up is a long straight, a turn at the end, another long straight
// the other way: six of them from the street to the roof. Two ways wind through it, one inside
// the other (a double helix): the way up comes in from 5th Street at the south end and goes north
// up the east half, round, south up the west half, and so on - its last straight is the west
// half's top floor, open to the sky: the roof run, straight and clear for 100 m to the south
// edge, 19.4 m over 5th Street, the street the car flies across. The way down is the other one,
// out at the north end onto 7th Street.
//
// Bayshore Parking is lower (its roof 4.8 m under the garage's) and plainer: flat floors, four of
// them over the street floor, and a straight ramp from each down to the next (12 %, eased at both
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
const DH = 3.2;
const SLAB = 0.3;
const BEAM = 0.5;
const PAR = 1.05;
// the sloping floors of a half (0..5), the levels (0: the street .. 6: the roof run's high end)
const NDECK = 6;
const LV = (k) => Y0 + k * DH;

// 5th Street Garage: its ground, the line between its halves, where the floors slope
const MX0 = -190;
const MX1 = -149;
const MXC = -169.5;
const MZ0 = 176.5;
const MZ1 = 289.5;
const MZN = 193;
const MZS = 273;
// (the roof run's own slope ends sooner: flat for its last 26.5 m, to the edge)
const MZT = 263;
// across a half from its outer wall in: the wall, the bays along it, the aisle, the bays along
// the middle, the gap between the halves (where the columns stand)
const U_OUT = 0.3;
const U_AISLE = 5.7;
const U_IN = 13.7;
const U_MID = 19.1;
// the lines of columns across it (the end ones in the end walls)
const COLZ = [176.8, 184.9, 193, 203, 213, 223, 233, 243, 253, 263, 273, 281.1, 289.2];
// the stair and lift towers at its corners (across, along)
const CORE_W = 5.6;
const CORE_D = 7.4;

// Bayshore Parking: its ground, its levels, its two aisles, its ramps (from xLow at level lv up
// to xHigh at level lv + 1), the cross aisle in its middle
const LX0 = -250;
const LX1 = -148;
const LZ0 = 314.5;
const LZ1 = 349;
const LDH = 3.6;
const LY = [0, 1, 2, 3, 4].map((k) => Y0 + k * LDH);
const L_AISLE = { N: [319.8, 327.0], S: [337.0, 344.2] };
const L_MID = 332;
const L_RAMPS = [
  { lv: 0, aisle: 'N', xLow: -202, xHigh: -236 },
  { lv: 1, aisle: 'S', xLow: -236, xHigh: -202 },
  { lv: 2, aisle: 'N', xLow: -202, xHigh: -236 },
  { lv: 3, aisle: 'S', xLow: -236, xHigh: -202 },
];
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
const W_AISLE_X = MX0 + (U_AISLE + U_IN) / 2;
const E_AISLE_X = MX1 - (U_AISLE + U_IN) / 2;
export const PARK = {
  name: '5TH STREET GARAGE',
  // the garage's ground, the line between its halves, its levels (the street floor .. the roof
  // run's high end), floor to floor, the slope of its floors
  main: { x0: MX0, x1: MX1, z0: MZ0, z1: MZ1, xc: MXC, zN: MZN, zS: MZS, levels: [0, 1, 2, 3, 4, 5, 6].map(LV), floorToFloor: DH, grade: DH / (MZS - MZN) },
  landing: { name: 'BAYSHORE PARKING', x0: LX0, x1: LX1, z0: LZ0, z1: LZ1, levels: LY.slice(), floorToFloor: LDH, grade: LDH / (34 - L_RAMP_EASE) },
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
  // the way up, a mark a floor (for the objective's arrow): each a point in the middle of its aisle
  // or turn, its level (a turn's) or its two (a straight's), a word for it
  route: [
    { x: E_AISLE_X, z: MZ1 - 4, y: LV(0), lv: 0, what: 'in' },
    { x: E_AISLE_X, z: (MZN + MZS) / 2, y: LV(0.5), lv: 0.5, what: 'up' },
    { x: MXC, z: MZ0 + 6, y: LV(1), lv: 1, what: 'turn' },
    { x: W_AISLE_X, z: (MZN + MZS) / 2, y: LV(1.5), lv: 1.5, what: 'up' },
    { x: MXC, z: MZ1 - 6, y: LV(2), lv: 2, what: 'turn' },
    { x: E_AISLE_X, z: (MZN + MZS) / 2, y: LV(2.5), lv: 2.5, what: 'up' },
    { x: MXC, z: MZ0 + 6, y: LV(3), lv: 3, what: 'turn' },
    { x: W_AISLE_X, z: (MZN + MZS) / 2, y: LV(3.5), lv: 3.5, what: 'up' },
    { x: MXC, z: MZ1 - 6, y: LV(4), lv: 4, what: 'turn' },
    { x: E_AISLE_X, z: (MZN + MZS) / 2, y: LV(4.5), lv: 4.5, what: 'up' },
    { x: MXC, z: MZ0 + 6, y: LV(5), lv: 5, what: 'turn' },
    { x: W_AISLE_X, z: MZ0 + 12, y: LV(5), lv: 5, what: 'roof' },
  ],
  // the roof run: from its start (the north end of the west half's top floor, open to the sky)
  // straight south down the aisle to the edge - 100 m and more; the last 26.5 m flat
  runup: { x: W_AISLE_X, z: MZ0 + 6, y: LV(5), yaw: 0, dir: [0, 1], len: MZ1 - MZ0 - 6, flatFrom: MZT },
  // the edge it flies from: the south face of the west half at the roof run's high end (a
  // parapet 1.05 m high along it, x0..x1), over 5th Street
  edge: { z: MZ1, x0: MX0, x1: MXC, x: W_AISLE_X, y: LV(6), parapet: PAR },
  // (the drawn ramp and the jump - game/prologue/ramp.js - are worked out along -x, a lane at one
  // z: the roof run is that turned a quarter round. toLocal(x, z) gives the [x, z] they take, a
  // group turned rotY about y puts what they build back in the world; edgeX, laneZ, carX for
  // RampDraw.open, landX for the landing's x there)
  runFrame: {
    toLocal: (x, z) => [-z, x],
    toWorld: (lx, lz) => [lz, -lx],
    rotY: Math.PI / 2,
    edgeX: -MZ1,
    laneZ: W_AISLE_X,
    roofY: LV(6),
  },
  // where it comes down: Bayshore's roof straight ahead across the street (kept clear: no cars,
  // no lamp posts, no openings), its height; land: a point in it
  land: { x: W_AISLE_X, z: 328, y: LY[4], zone: { x0: KEEP.land.x0, x1: KEEP.land.x1, z0: LZ0 + 1, z1: LZ1 - 1 } },
  // the way down from Bayshore's roof to 5th Street: west along its south aisle, down, round at
  // the west end, down, round in the cross aisle, down, round, down, and out of its gate
  down: [
    { x: -196, z: 340.6, y: LY[4], what: 'ramp' },
    { x: -244, z: 332, y: LY[3], what: 'turn' },
    { x: -196, z: 332, y: LY[2], what: 'turn' },
    { x: -244, z: 332, y: LY[1], what: 'turn' },
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
    run: [[-180.3, LV(5) + 2.4, MZ0 + 2], [-180.3, LV(6) + 0.5, MZ1]],
    // over the edge: 5th Street below, Bayshore's roof across it
    edge: [[-180.3, LV(6) + 2.1, MZ1 - 21], [-180.3, LY[4] - 1, 332]],
    // from Bayshore's roof up at the edge it comes from
    landing: [[-172, LY[4] + 1.6, 342], [-180.3, LV(6) + 1, MZ1]],
  },
  // the floor under (x, z) for something at height y (the highest floor no more than a step over
  // it), -Infinity off them; the underside of what is over (x, z) for the camera there (Infinity in
  // the open). The vehicles and the camera ask them through PrologueSet
  floorAt: (x, z, y) => parkFloor(x, z, y),
  ceilingAt: (x, z, y) => parkCeiling(x, z, y),
  // floors laid on it later (the ramp drawn on the roof: anything with floorAt(x, z, y))
  extra: [],
  // which level something at (x, y, z) is on, in the garage (0 the street floor .. 6 the roof run's
  // high end; between two on a slope: 2.4 is two fifths of the way up from 2 to 3); in Bayshore,
  // its level (0 .. 4) plus 10; null outside both
  levelAt: (x, z, y) => {
    const m = mainFloor(x, z, y);
    if (m > -Infinity) return (m - Y0) / DH;
    const b = landFloor(x, z, y);
    return b > -Infinity ? 10 + (b - Y0) / LDH : null;
  },
};

// ------------------------------------------------------------------ its floors
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// how far up its storey a floor of the garage is at z (0 at its low end, 1 at its high end): the
// west half's rise to the south, the east half's to the north
function riseOf(h, j, z) {
  if (h === 'W') return clamp01((z - MZN) / ((j === NDECK - 1 ? MZT : MZS) - MZN));
  return clamp01((MZS - z) / (MZS - MZN));
}
// floor j of half h at z
function deckY(h, j, z) {
  return Y0 + (j + riseOf(h, j, z)) * DH;
}
// where a floor's slope turns (its profile's corners along z)
function deckKnots(h, j) {
  return [MZ0, MZN, h === 'W' && j === NDECK - 1 ? MZT : MZS, MZ1];
}
// which of the two ways a floor is part of: 'up' (the climb: the east half's even floors, the west
// half's odd ones) or 'down'; and which way along z it is driven
const wayOf = (h, j) => ((h === 'E') === (j % 2 === 0) ? 'up' : 'down');
const flowOf = (h, j) => (h === 'W' ? 1 : -1) * (wayOf(h, j) === 'up' ? 1 : -1);
// x a distance u in from a half's outer wall
const hx = (h, u) => (h === 'W' ? MX0 + u : MX1 - u);
const halfOf = (x) => (x < MXC ? 'W' : 'E');

function mainFloor(x, z, y) {
  if (x < MX0 || x > MX1 || z < MZ0 || z > MZ1) return -Infinity;
  const h = halfOf(x);
  const lim = y + 1.1;
  // (the street floor where the first floor is a storey up over it: under the west half's south
  // end, under the east half's north end)
  let best = (h === 'W' && z >= MZS) || (h === 'E' && z <= MZN) ? Y0 : -Infinity;
  for (let j = 0; j < NDECK; j++) {
    const d = deckY(h, j, z);
    if (d > lim) break;
    if (d > best) best = d;
  }
  return best;
}

// the underside of the lowest floor of the garage over (x, z) more than 0.6 m over y (its beams'
// underside), Infinity in the open
function mainCeilAt(h, z, y) {
  for (let j = 0; j < NDECK; j++) {
    const under = deckY(h, j, z) - SLAB - BEAM;
    if (under >= y + 0.6) return under;
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
  const inLand = x > LX0 - 1 && x < LX1 + 1 && z > LZ0 - 1 && z < LZ1 + 1;
  if (!inMain && !inLand) return Infinity;
  let c = Infinity;
  const h0 = halfOf(x);
  for (const [dx, dz] of RING) {
    const sx = x + dx;
    const sz = z + dz;
    const soft = Math.hypot(dx, dz) * 0.22;
    let u = Infinity;
    if (inMain && sx > MX0 && sx < MX1 && sz > MZ0 && sz < MZ1) {
      // (in the slopes the other half's floors are beside the car, not over it)
      const h = halfOf(sx);
      if (h === h0 || sz <= MZN || sz >= MZS) u = mainCeilAt(h, sz, y);
    } else if (inLand && sx > LX0 && sx < LX1 && sz > LZ0 && sz < LZ1) u = landCeilAt(sx, sz, y);
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

// a floor's profile from s0 to s1: through its corners (knots) between, its height fn(s)
function profile(fn, s0, s1, knots, lift = 0) {
  const ss = [s0, ...knots.filter((k) => k > s0 + 1e-6 && k < s1 - 1e-6), s1];
  return ss.map((s) => [s, fn(s) + lift]);
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
const CONC_TOP = linC(0.66, 0.65, 0.64);
const CONC_ROOF = linC(0.58, 0.57, 0.58);
const CONC_UNDER = linC(0.6, 0.59, 0.61);
const CONC_COL = linC(0.82, 0.8, 0.76);
const PANEL = linC(0.88, 0.86, 0.82);
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
const LEVEL_C = [[0.46, 0.55, 0.68], [0.86, 0.24, 0.26], [0.97, 0.55, 0.18], [0.98, 0.8, 0.2], [0.32, 0.72, 0.42], [0.26, 0.5, 0.88], [0.62, 0.38, 0.84]].map(([r, g, b]) => linC(r, g, b));
const LEVEL_NAME = ['G', '1', '2', '3', '4', '5', 'R'];

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
    this.landShell(KL, M);
    this.landInside(KLI, M);
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
      { x0: MX0, z0: MZ0, x1: MX1, z1: MZ1, top: LV(6), color: new THREE.Color(0.86, 0.84, 0.8), trim: new THREE.Color(0.1, 0.34, 0.78) },
      { x0: LX0, z0: LZ0, x1: LX1, z1: LZ1, top: LY[LY.length - 1], color: new THREE.Color(0.86, 0.84, 0.8), trim: new THREE.Color(0.22, 0.62, 0.7) },
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
      nav.queueRefresh(LX0 - 2, LZ0 - 2, LX1 + 2, LZ1 + 2);
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
      const h = halfOf(x);
      for (let j = 0; j < NDECK; j++) {
        const d = deckY(h, j, z);
        const bot = j === 0 && (h === 'W' ? z < MZS : z > MZN) ? 0 : d - SLAB;
        if (y > bot && y < d) return `main ${h}${j}`;
      }
    }
    if (x > LX0 && x < LX1 && z > LZ0 && z < LZ1) {
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
  mainShell(K, M) {
    const wall = this.wall;
    // the street floor where it is not the first floors' (the west half's south end, the east
    // half's north end), and round the stair towers
    K.box(M.matte, MX0 + 0.05, 0.02, MZS, MXC, Y0 - 0.004, MZ1 - 0.05, CONC_TOP);
    K.box(M.matte, MXC, 0.02, MZ0 + 0.05, MX1 - 0.05, Y0 - 0.004, MZN, CONC_TOP);
    for (const h of ['W', 'E']) {
      // (the floors' outer edges and ends a little behind the panels round them)
      const xo = hx(h, 0.05);
      const xi = MXC;
      const xa = Math.min(xo, xi);
      const xb = Math.max(xo, xi);
      for (let j = 0; j < NDECK; j++) {
        const f = (z) => deckY(h, j, z);
        const kn = deckKnots(h, j);
        const top = j === NDECK - 1 ? CONC_ROOF : CONC_TOP;
        if (j === 0) {
          // the first floor rises off the street: solid under its slope (the ground filled up to
          // it), a slab over the street floor where it is a storey up
          const zf = h === 'W' ? [MZ0 + 0.05, MZS] : [MZN, MZ1 - 0.05];
          const zs = h === 'W' ? [MZS, MZ1 - 0.05] : [MZ0 + 0.05, MZN];
          K.add(M.matte, prism('z', profile(f, zf[0], zf[1], kn), xa, xb, () => 0.02), FILL);
          K.add(M.matte, prism('z', profile(f, zs[0], zs[1], kn), xa, xb, (s, y) => y - SLAB), top);
          // (the fill's face to the street floor's end, under the slab: a wall)
          const zw = h === 'W' ? MZS : MZN;
          const zt = zw + (h === 'W' ? -0.3 : 0.3);
          wall(xa, Math.min(zw, zt), xb, Math.max(zw, zt), Y0 - 0.3, LV(1) - SLAB);
        } else K.add(M.matte, prism('z', profile(f, MZ0 + 0.05, MZ1 - 0.05, kn), xa, xb, (s, y) => y - SLAB), top);
        // its underside's beams across, at the lines of columns (not over the filled ground)
        for (const z of COLZ.slice(1, -1)) {
          if (j === 0 && (h === 'W' ? z < MZS + 1 : z > MZN - 1)) continue;
          const y = f(z) - SLAB;
          K.box(M.matte, h === 'W' ? xa + 0.2 : xa, y - BEAM, z - 0.22, h === 'W' ? xb : xb - 0.2, y, z + 0.22, CONC_UNDER);
        }
        // the edge beam along the middle, under the floor's edge where the halves part
        const zA = j === NDECK - 1 ? MZ0 : MZN;
        const zB = j === NDECK - 1 ? MZ1 : MZS;
        if (j > 0) K.add(M.matte, prism('z', profile(f, zA, zB, kn, -SLAB), h === 'W' ? MXC - 0.32 : MXC, h === 'W' ? MXC : MXC + 0.32, (s, y) => y - BEAM * 0.8), CONC_UNDER);
        // the precast panels round its outer edge (the slab's edge behind them), the level's band
        // painted along them outside
        const xp0 = h === 'W' ? MX0 : MX1 - 0.25;
        const xp1 = h === 'W' ? MX0 + 0.25 : MX1;
        // (the first floor's, along the street, a darker stone: the building's base)
        K.add(M.matte, prism('z', profile(f, MZ0 + 0.01, MZ1 - 0.01, kn, PAR), xp0, xp1, (s, y) => (j === 0 ? 0.02 : y - PAR - SLAB - 0.22)), j === 0 ? BASE : PANEL);
        const xb0 = h === 'W' ? MX0 - 0.02 : MX1;
        K.add(M.paint, prism('z', profile(f, MZ0 + CORE_D, MZ1 - CORE_D, kn, PAR - 0.14), xb0, xb0 + 0.02, (s, y) => y - 0.2), LEVEL_C[j]);
        for (let z = MZ0; z < MZ1 - 0.01; z += 8) {
          const z1 = Math.min(MZ1, z + 8);
          wall(Math.min(xp0, xp1) - 0.05, z, Math.max(xp0, xp1) + 0.05, z1, Math.min(f(z), f(z1)) - 0.3, Math.max(f(z), f(z1)) + PAR);
        }
        // the level, big, painted on the panels outside near each end (the floor's level there)
        for (const zz of [MZ0 + CORE_D + 1.6, MZ1 - CORE_D - (h === 'E' ? 4.6 : 1.6)]) {
          const lv = Math.round((f(zz) - Y0) / DH);
          if (lv < 1) continue;
          wallWord(K, M.paint, LEVEL_C[lv], LEVEL_NAME[lv], 0.72, h === 'W' ? MX0 - 0.02 : MX1 + 0.02, f(zz) + 0.1, zz, h === 'W' ? -1 : 1, 0, 0.01);
        }
        // the floor's edge where the halves part (the other half's floor a little higher or lower
        // there): a curb, a steel rail on posts. (A top floor's all along it but at its low end: there
        // the other half's floor below it comes up to the same level - the last turn, open: the west
        // half's is the turn onto the roof run at the north end, the east half's the way down's
        // first turn at the south end)
        const zrA = j === NDECK - 1 && h === 'W' ? MZN : zA;
        const zrB = j === NDECK - 1 && h === 'E' ? MZS : zB;
        const xc0 = h === 'W' ? MXC - 0.32 : MXC;
        const xc1 = h === 'W' ? MXC : MXC + 0.32;
        K.add(M.matte, prism('z', profile(f, zrA, zrB, kn, 0.42), xc0, xc1, (s, y) => y - 0.05), CONC_COL);
        const xr = h === 'W' ? MXC - 0.16 : MXC + 0.16;
        K.add(M.metal, prism('z', profile(f, zrA, zrB, kn, 1.06), xr - 0.04, xr + 0.04, (s, y) => y - 0.08), YEL);
        K.add(M.metal, prism('z', profile(f, zrA, zrB, kn, 0.76), xr - 0.04, xr + 0.04, (s, y) => y - 0.06), STEEL);
        for (let z = zrA + 2.5; z < zrB - 1; z += 5) {
          if (COLZ.some((c) => Math.abs(c - z) < 0.6)) continue;
          K.box(M.metal, xr - 0.035, f(z) + 0.42, z - 0.035, xr + 0.035, f(z) + 1.06, z + 0.035, STEEL);
        }
        for (let z = zrA; z < zrB - 0.01; z += 4) {
          const z1 = Math.min(zrB, z + 4);
          wall(xc0 - 0.05, z, xc1 + 0.05, z1, Math.min(f(z), f(z1)) - 0.3, Math.max(f(z), f(z1)) + 1.1);
        }
        // the floor for whoever walks on it (and for the camera's look, and a bullet): in steps
        this.slabSteps(h === 'W' ? xa + 0.25 : xa, h === 'W' ? xb : xb - 0.25, j, h, f);
      }
    }
    // ---- the end walls: at each end the two halves' floors meet at one level - a panel across
    // both at each (not over the ways in and out on the street floor)
    for (const [zz, nz, end] of [[MZ0, 1, 'N'], [MZ1, -1, 'S']]) {
      for (let k = 0; k <= NDECK; k++) {
        const y = LV(k);
        // which halves have a floor at this level at this end
        // (the roof run's high end is the west half's at the south end; the other top floor's the
        // east half's at the north end)
        const parts = k < 6 ? [[MX0, MXC], [MXC, MX1]] : end === 'N' ? [[MXC, MX1]] : [[MX0, MXC]];
        for (const [xa, xb] of parts) {
          // the way in (the south end, the east aisle) and out (the north end, the west aisle)
          const gaps = [];
          if (k === 0 && end === 'S' && xa === MXC) gaps.push([hx('E', U_IN) - 0.3, hx('E', U_AISLE) + 0.2], [hx('E', CORE_W), MX1]);
          if (k === 0 && end === 'N' && xa === MX0) gaps.push([hx('W', U_AISLE) - 0.2, hx('W', U_IN) + 0.3]);
          let x = xa;
          const runs = [];
          for (const [g0, g1] of gaps) {
            runs.push([x, g0]);
            x = g1;
          }
          runs.push([x, xb]);
          for (const [r0, r1] of runs) {
            if (r1 - r0 < 0.05) continue;
            const z0 = zz;
            const z1 = zz + nz * 0.25;
            const top = k === 0 ? y + PAR + 0.25 : y + PAR;
            K.box(M.matte, r0, k === 0 ? 0.02 : y - SLAB - 0.22, Math.min(z0, z1), r1, top, Math.max(z0, z1), k === 0 ? BASE : PANEL);
            K.box(M.paint, r0, top - 0.34, Math.min(z0, z0 - nz * 0.02), r1, top - 0.14, Math.max(z0, z0 - nz * 0.02), LEVEL_C[k]);
            wall(r0, Math.min(z0, z1) - 0.05, r1, Math.max(z0, z1) + 0.05, y - 0.3, top);
          }
        }
      }
    }
    // ---- the columns: in the outer walls at every line, along the middle where the halves part,
    // in the end walls; each all the way up (the floors pass round them)
    const roofAt = (h, z) => deckY(h, NDECK - 1, z);
    for (const z of COLZ) {
      for (const h of ['W', 'E']) {
        const x = hx(h, 0.3);
        const top = roofAt(h, z) + PAR;
        K.box(M.matte, x - 0.3, 0.02, z - 0.3, x + 0.3, top, z + 0.3, CONC_COL);
        wall(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, top, 'pole');
      }
      if (z >= MZN - 0.01 && z <= MZS + 0.01) {
        const top = Math.max(roofAt('W', z), roofAt('E', z)) - SLAB;
        K.box(M.matte, MXC - 0.36, 0.02, z - 0.36, MXC + 0.36, top, z + 0.36, CONC_COL);
        wall(MXC - 0.36, z - 0.36, MXC + 0.36, z + 0.36, 0, top, 'pole');
      }
    }
    for (const zz of [MZ0 + 0.3, MZ1 - 0.3]) {
      for (const x of [hx('W', U_IN + 0.3), MXC, hx('E', U_IN + 0.3)]) {
        const top = (Math.abs(x - MXC) < 0.5 ? Math.max(roofAt('W', zz), roofAt('E', zz)) : roofAt(halfOf(x), zz)) + PAR;
        K.box(M.matte, x - 0.3, 0.02, zz - 0.3, x + 0.3, top, zz + 0.3, CONC_COL);
        wall(x - 0.3, zz - 0.3, x + 0.3, zz + 0.3, 0, top, 'pole');
      }
    }
    // ---- the roof: the parapets' steel rail over them, lamp posts along the outer walls and the
    // middle (none in the roof run's aisle)
    for (const h of ['W', 'E']) {
      const f = (z) => deckY(h, NDECK - 1, z);
      const kn = deckKnots(h, NDECK - 1);
      const xr = hx(h, 0.12);
      K.add(M.metal, prism('z', profile(f, MZ0 + CORE_D, MZ1 - CORE_D, kn, PAR + 0.38), xr - 0.05, xr + 0.05, (s, y) => y - 0.07), STEEL);
      for (let z = MZ0 + CORE_D + 1; z < MZ1 - CORE_D; z += 2.5) K.box(M.metal, xr - 0.03, f(z) + PAR, z - 0.03, xr + 0.03, f(z) + PAR + 0.38, z + 0.03, STEEL);
      // (on the parapet's line, and in the gap by the middle: clear of the bays; each its arm out
      // over the bays beside it)
      for (const [u, arm] of [[0.12, 1], [U_MID + 0.45, -1]]) {
        for (let z = MZ0 + 14; z < MZ1 - 8; z += 21) {
          const x = hx(h, u);
          const y = f(z);
          const ax = x + (h === 'W' ? 1 : -1) * arm * 1.4;
          K.cyl(M.metal, 0.07, 0.1, y, y + 6.2, DARK, { axis: 'y', x, z, segs: 6 });
          K.box(M.metal, Math.min(x, ax) - 0.05, y + 6.1, z - 0.06, Math.max(x, ax) + 0.05, y + 6.2, z + 0.06, DARK);
          K.box(M.paint, ax - 0.32, y + 6.0, z - 0.2, ax + 0.32, y + 6.12, z + 0.2, DARK);
          K.box(M.glow, ax - 0.27, y + 5.97, z - 0.15, ax + 0.27, y + 6.0, z + 0.15, LAMP);
          wall(x - 0.12, z - 0.12, x + 0.12, z + 0.12, y, y + 6.2, 'pole');
        }
      }
    }
  }

  // the floor's slab in boxes for the collision: flat ends whole, the slope in steps (each a little
  // under the floor's top: a step of 8 cm every 2 m - walked up like a slope)
  slabSteps(xa, xb, j, h, f) {
    const wall = this.wall;
    const kn = deckKnots(h, j);
    const parts = j === 0 ? (h === 'W' ? [[MZS, MZ1]] : [[MZ0, MZN]]) : [[MZ0, MZ1]];
    for (const [z0, z1] of parts) {
      let z = z0;
      while (z < z1 - 1e-6) {
        // (a flat stretch whole; a sloping one 2 m at a time)
        let ze = Math.min(z1, z + 2);
        const flatTo = kn.find((k) => k > z + 1e-6) || z1;
        if (Math.abs(f(z) - f(Math.min(z1, flatTo))) < 1e-4) ze = Math.min(z1, flatTo);
        const lo = Math.min(f(z), f(ze));
        const hi = Math.max(f(z), f(ze));
        wall(xa, z, xb, ze, hi - SLAB + 0.02, lo, 'floor');
        z = ze;
      }
    }
    if (j === 0) {
      // (and the filled ground under the first slope: the street floor's ends, walked onto)
      const zf = h === 'W' ? [MZ0, MZS] : [MZN, MZ1];
      let z = zf[0];
      while (z < zf[1] - 1e-6) {
        let ze = Math.min(zf[1], z + 2);
        if (Math.abs(f(z) - f(ze)) < 1e-4) ze = h === 'W' ? MZN : zf[1];
        if (ze <= z) ze = Math.min(zf[1], z + 2);
        wall(xa, z, xb, ze, 0, Math.min(f(z), f(ze)), 'floor');
        z = ze;
      }
    }
  }

  // ------------------------------------------------------------------ the stair and lift towers
  // One at each corner, the height of the garage there and a storey over its roof (the stair's
  // head, the lift's machine room); a glazed slot up the faces to the street, the P on top; at
  // every level a door to the stair and the lift's doors, EXIT over them in green. The one at 5th
  // Street and Washington Avenue is the way in on foot: its street door, the canopy over it, the
  // pay machine by it.
  mainCores(K, M) {
    const wall = this.wall;
    this.cores = [];
    for (const [h, end] of [['W', 'N'], ['E', 'N'], ['W', 'S'], ['E', 'S']]) {
      const xo = hx(h, 0);
      const xi = hx(h, CORE_W);
      const zo = end === 'N' ? MZ0 : MZ1;
      const zi = end === 'N' ? MZ0 + CORE_D : MZ1 - CORE_D;
      const x0 = Math.min(xo, xi);
      const x1 = Math.max(xo, xi);
      const z0 = Math.min(zo, zi);
      const z1 = Math.max(zo, zi);
      const roof = deckY(h, NDECK - 1, (z0 + z1) / 2);
      const top = Math.max(roof + 3.6, LV(6) + 2.8);
      const nx = h === 'W' ? -1 : 1;
      const nz = end === 'N' ? -1 : 1;
      // (the one at 5th and Washington is hollow on the street floor: its lobby, the way in on foot)
      const lobby = h === 'E' && end === 'S';
      const LT = Y0 + 2.9;
      K.box(M.matte, x0, lobby ? LT : 0.02, z0, x1, top, z1, CONC_COL);
      K.box(M.paint, x0 - 0.04, top - 1.4, z0 - 0.04, x1 + 0.04, top - 0.2, z1 + 0.04, BLUE_P);
      K.box(M.matte, x0 - 0.15, top, z0 - 0.15, x1 + 0.15, top + 0.25, z1 + 0.15, PANEL);
      wall(x0, z0, x1, z1, lobby ? LT : 0, top);
      if (lobby) this.lobby(K, M, x0, x1, z0, z1, LT);
      // the glazed slot up its street faces (the stair's landings behind it)
      const gx = xo + nx * 0.03;
      K.box(M.glass, Math.min(gx, gx + nx * 0.04), 1.0, (z0 + z1) / 2 - 1.2, Math.max(gx, gx + nx * 0.04), top - 1.8, (z0 + z1) / 2 + 1.2, GLASS);
      const gz = zo + nz * 0.03;
      K.box(M.glass, (x0 + x1) / 2 - 1.0, lobby ? LT + 0.4 : 1.0, Math.min(gz, gz + nz * 0.04), (x0 + x1) / 2 + 1.0, top - 1.8, Math.max(gz, gz + nz * 0.04), GLASS);
      for (let y = LV(1) - 0.2; y < top - 2; y += DH) {
        K.box(M.matte, Math.min(gx, gx + nx * 0.06), y, (z0 + z1) / 2 - 1.25, Math.max(gx, gx + nx * 0.06), y + 0.18, (z0 + z1) / 2 + 1.25, CONC_COL);
        K.box(M.matte, (x0 + x1) / 2 - 1.05, y, Math.min(gz, gz + nz * 0.06), (x0 + x1) / 2 + 1.05, y + 0.18, Math.max(gz, gz + nz * 0.06), CONC_COL);
      }
      // the P, lit, on its street faces up top
      for (const [cx, cz, fx, fz] of [[xo + nx * 0.06, (z0 + z1) / 2, nx, 0], [(x0 + x1) / 2, zo + nz * 0.06, 0, nz]]) {
        wallWord(K, M.glow, WHITE, 'P', 0.95, cx, top - 1.27, cz, fx, fz, 0.05);
      }
      // the doors at each level on its face to the aisle: the stair's (with its little window), the
      // lift's (steel, two leaves, its call button), EXIT over them
      const fx = xi + (h === 'W' ? 0.02 : -0.02);
      const levels = [];
      for (let k = 0; k <= NDECK; k++) {
        const y = LV(k);
        // (the floor at this corner at this level: the half's floors at this end, or its street floor)
        const has = k === 0 || (end === 'N' ? (h === 'W' ? k <= 5 : k >= 1) : h === 'W' ? k >= 1 : k <= 5);
        if (has) levels.push(k);
      }
      for (const k of levels) {
        if (lobby && k === 0) continue;
        const y = LV(k);
        const s = h === 'W' ? 1 : -1;
        const dz = end === 'N' ? 1 : -1;
        const zc = (z0 + z1) / 2;
        K.box(M.paint, fx, y, zc - dz * 2.6, fx + s * 0.06, y + 2.15, zc - dz * 1.6, linC(0.32, 0.4, 0.5));
        K.box(M.glass, fx + s * 0.06, y + 1.3, zc - dz * 2.35, fx + s * 0.08, y + 1.8, zc - dz * 1.85, GLASS);
        K.box(M.metal, fx, y, zc + dz * 0.3 - 0.8, fx + s * 0.06, y + 2.2, zc + dz * 0.3 + 0.8, linC(0.76, 0.78, 0.82));
        K.box(M.matte, fx + s * 0.06, y, zc + dz * 0.3 - 0.01, fx + s * 0.07, y + 2.2, zc + dz * 0.3 + 0.01, DARK);
        K.box(M.glow, fx + s * 0.06, y + 1.05, zc + dz * 0.3 + dz * 1.05 - 0.05, fx + s * 0.08, y + 1.15, zc + dz * 0.3 + dz * 1.05 + 0.05, linC(1, 0.85, 0.4));
        K.box(M.paint, fx + s * 0.02, y + 2.3, zc - dz * 2.9, fx + s * 0.08, y + 2.6, zc - dz * 1.3, linC(0.06, 0.28, 0.14));
        wallWord(K, M.glow, GREEN, 'EXIT', 0.17, fx + s * 0.08, y + 2.37, zc - dz * 2.1, s, 0, 0.02);
        // the level, big, on the tower beside the doors, in its colour
        K.box(M.paint, fx + s * 0.02, y + 0.9, zc + dz * 1.6, fx + s * 0.05, y + 2.5, zc + dz * 3.4, LEVEL_C[k]);
        wallWord(K, M.paint, WHITE, LEVEL_NAME[k], 1.1, fx + s * 0.05, y + 1.15, zc + dz * 2.5, s, 0, 0.03);
      }
      this.cores.push({ h, end, x0, x1, z0, z1, top, levels });
    }
    // the way in on foot at 5th Street and Washington: the street door, its canopy, the pay machine
    const c = this.cores.find((q) => q.h === 'E' && q.end === 'S');
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
    // the pay machine on the sidewalk side of the door, its screen lit
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
    const ey = LV(4) + 0.5;
    const ez = (MZ0 + MZ1) / 2;
    K.box(M.matte, MX1 + 0.25, ey - 0.35, ez - lenS / 2 - 0.7, MX1 + 0.4, ey + hS + 0.35, ez + lenS / 2 + 0.7, DARK);
    wallWord(K, M.glow, linC(1, 0.92, 0.7), name, hS, MX1 + 0.4, ey, ez, 1, 0, 0.08);
    // the blade at the corner of 5th and Washington: PARKING down it, a big P at its head, lit
    const bx = MX1 + 0.9;
    const bz = MZ1 - CORE_D - 1.6;
    const b0 = LV(1);
    const b1 = LV(6) + 2.2;
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
    for (const [x, z0, z1] of [[E_AISLE_X, MZ1, 295], [W_AISLE_X, 171, MZ0], [(L_GATE[0] + L_GATE[1]) / 2, 307, LZ0]]) {
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
  // what makes it a real one, floor by floor: the paint (the bays and their numbers, the aisle's
  // edges, the arrows of its way, SLOW and the level at the turns, the hatching round the towers'
  // doors and the noses of the middle), the wheel stops, oil stains, tyre marks round the turns,
  // the drains at the foot of each slope; under each floor the striplights over the aisle and the
  // bays, the red sprinkler main and its heads, the grey conduit; the columns' hazard paint and
  // steel corner guards, the level on them; convex mirrors at the turns; at the way in the
  // barrier, the ticket machine and its island; at the way out the pay-on-exit machine
  mainInside(K, M) {
    const rng = mulberry(4242);
    this.bays = [];
    for (const h of ['W', 'E']) {
      for (let j = 0; j < NDECK; j++) this.deckInside(K, M, h, j, rng);
      this.pocketInside(K, M, h, rng);
    }
    this.turns(K, M, rng);
    this.wayIn(K, M);
  }

  // the bays of a floor: [{ x, z, nx (the way into it), w, row }] - along its outer wall the whole
  // way (between the towers), along the middle only where it slopes
  baysOf(h, j) {
    const out = [];
    const s = h === 'W' ? 1 : -1;
    const rows = [['out', U_OUT, U_AISLE, MZ0 + CORE_D, MZ1 - CORE_D], ['in', U_IN, U_MID, MZN + 0.4, MZS - 0.4]];
    for (const [row, u0, u1, za, zb] of rows) {
      const zs = [za, ...COLZ.filter((z) => z > za + 0.5 && z < zb - 0.5), zb];
      for (let i = 0; i + 1 < zs.length; i++) {
        const span = zs[i + 1] - zs[i];
        if (span < 2.3) continue;
        const n = Math.max(1, Math.round(span / 2.5));
        const w = span / n;
        for (let k = 0; k < n; k++) {
          const zc = zs[i] + w * (k + 0.5);
          // (the way into the bay: from the aisle towards the wall it backs onto)
          const into = row === 'out' ? -s : s;
          out.push({ h, j, row, x: hx(h, (u0 + u1) / 2), z: zc, w, u0, u1, nx: into, za: zc - w / 2, zb: zc + w / 2 });
        }
      }
    }
    return out;
  }

  deckInside(K, M, h, j, rng) {
    const f = (x, z) => deckY(h, j, z);
    const fz = (z) => deckY(h, j, z);
    const kn = deckKnots(h, j);
    const s = h === 'W' ? 1 : -1;
    const flow = flowOf(h, j);
    const roof = j === NDECK - 1;
    const lvl = j;
    const bays = this.baysOf(h, j);
    // ---- the bays: their lines, a number at the mouth of every other one, wheel stops along the
    // wall, stains where cars stand
    let n = 1;
    const zone = (z) => 'ABCDEFGHIJKL'[Math.max(0, Math.min(11, Math.floor((z - MZ0) / 10)))];
    for (const b of bays) {
      const xa = hx(h, b.u0);
      const xb = hx(h, b.u1);
      // (each line once: a bay's far line is the next one's near line, but for the last of a run)
      const next = bays[bays.indexOf(b) + 1];
      for (const z of next && next.row === b.row && Math.abs(next.za - b.zb) < 0.01 ? [b.za] : [b.za, b.zb]) paintLine(K, M.paint, WHITE, xa, z, xb, z, 0.1, f, 0.02);
      const mouthU = b.row === 'out' ? b.u1 - 0.45 : b.u0 + 0.45;
      if (n % 2 === 1 && !roof) paintWord(K, M.paint, WHITE, `${zone(b.z)}${String(n).padStart(2, '0')}`, 0.3, hx(h, mouthU), b.z, b.nx, 0, f);
      const backU = b.row === 'out' ? b.u0 + 0.75 : b.u1 - 0.75;
      if (b.row === 'out' && n % 2 === 0) {
        const bx = hx(h, backU);
        const y = fz(b.z);
        K.box(M.matte, bx - 0.12, y, b.z - 0.85, bx + 0.12, y + 0.13, b.z + 0.85, linC(0.72, 0.7, 0.66));
        for (const [z0, z1] of [[b.z - 0.85, b.z - 0.55], [b.z + 0.55, b.z + 0.85]]) paintQuad(K, M.paint, YEL, [[bx - 0.12, z0], [bx + 0.12, z0], [bx + 0.12, z1], [bx - 0.12, z1]], () => y + 0.13, 0.004);
      }
      if (rng() < 0.45) {
        const sx = hx(h, (b.u0 + b.u1) / 2 + (rng() - 0.5) * 1.6);
        const sz = b.z + (rng() - 0.5) * 0.9;
        const r = 0.25 + rng() * 0.45;
        const T = new Tris();
        const c = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          c.push([sx + Math.cos(a) * r * (0.8 + rng() * 0.4), sz + Math.sin(a) * r * (0.8 + rng() * 0.4)]);
        }
        const yc = fz(sz) + 0.014;
        for (let i = 0; i < 7; i++) {
          const p = c[i];
          const q = c[(i + 1) % 7];
          T.p.push(sx, yc, sz, q[0], fz(q[1]) + 0.014, q[1], p[0], fz(p[1]) + 0.014, p[1]);
        }
        K.add(M.matte, T.geo(), rng() < 0.5 ? STAIN : STAIN_D);
      }
      b.n = n;
      this.bays.push(b);
      n++;
    }
    // the aisle's edges (yellow, along it)
    for (const u of [U_AISLE + 0.12, U_IN - 0.12]) {
      const x = hx(h, u);
      const pts = profile(fz, MZ0 + (u < 8 ? CORE_D : 16), MZ1 - (u < 8 ? CORE_D : 16), kn);
      for (let i = 0; i + 1 < pts.length; i++) paintLine(K, M.paint, YEL, x, pts[i][0], x, pts[i + 1][0], 0.1, f, 0.02);
    }
    // the arrows of its way down the aisle; UP or EXIT painted once on it; its level
    const ax = hx(h, (U_AISLE + U_IN) / 2);
    for (let z = MZN + 6; z < MZS - 4; z += 20) paintArrow(K, M.paint, WHITE, ax, z, 0, flow, f);
    const wz = flow > 0 ? MZN + 16 : MZS - 16;
    paintWord(K, M.paint, WHITE, wayOf(h, j) === 'up' ? (roof ? 'ROOF' : 'UP') : 'EXIT', 1.1, ax, wz, 0, flow, f);
    // the drain across the aisle at the foot of the slope (the low end), a joint across the middle
    const dz0 = h === 'W' ? MZN + 0.6 : MZS - 0.6;
    paintQuad(K, M.metal, linC(0.2, 0.2, 0.23), [[hx(h, U_AISLE), dz0 - 0.18], [hx(h, U_IN), dz0 - 0.18], [hx(h, U_IN), dz0 + 0.18], [hx(h, U_AISLE), dz0 + 0.18]], f, 0.008);
    for (let i = 0; i < 16; i++) {
      const xx = hx(h, U_AISLE + 0.25 + i * 0.5);
      paintLine(K, M.metal, linC(0.38, 0.38, 0.42), xx, dz0 - 0.14, xx, dz0 + 0.14, 0.05, f, 0.012);
    }
    paintLine(K, M.metal, linC(0.44, 0.45, 0.48), hx(h, 0.3), 233, hx(h, U_MID), 233, 0.1, f, 0.006);
    // ---- under the floor over this one: its striplights, the sprinkler main, the conduit
    if (!roof) this.ceilingKit(K, M, h, j + 1, rng);
    // ---- the columns at this floor: hazard paint round their feet, the steel guards at their
    // corners, a plate with the level facing the aisle; an extinguisher now and then
    const LC = LEVEL_C[lvl];
    COLZ.forEach((z, i) => {
      const y = fz(z);
      const xo = hx(h, 0.3);
      K.box(M.paint, xo - 0.31, y, z - 0.31, xo + 0.31, y + 0.9, z + 0.31, YEL);
      for (let b = 0; b < 2; b++) K.box(M.paint, xo - 0.315, y + 0.15 + b * 0.36, z - 0.315, xo + 0.315, y + 0.3 + b * 0.36, z + 0.315, INK);
      if (z < MZN - 0.01 || z > MZS + 0.01) return;
      // (the middle ones: each half paints its own side)
      const xs = MXC - s * 0.37;
      K.box(M.paint, Math.min(xs, MXC), y, z - 0.37, Math.max(xs, MXC), y + 1.1, z + 0.37, YEL);
      for (let b = 0; b < 3; b++) K.box(M.paint, Math.min(xs - s * 0.005, MXC), y + 0.12 + b * 0.34, z - 0.375, Math.max(xs - s * 0.005, MXC), y + 0.26 + b * 0.34, z + 0.375, INK);
      for (const dz of [-0.37, 0.37]) K.box(M.metal, xs - 0.04, y, z + dz - 0.04, xs + 0.04, y + 1.3, z + dz + 0.04, STEEL);
      const px = xs - s * 0.02;
      K.box(M.paint, Math.min(px, px - s * 0.03), y + 1.5, z - 0.32, Math.max(px, px - s * 0.03), y + 2.25, z + 0.32, LC);
      wallWord(K, M.paint, WHITE, LEVEL_NAME[lvl], 0.48, px - s * 0.03, y + 1.62, z, -s, 0, 0.02);
      if ((i + j) % 3 === 0) {
        const ex = px - s * 0.12;
        K.box(M.paint, ex - 0.11, y + 0.95, z + 0.45, ex + 0.11, y + 1.42, z + 0.65, RED);
        K.box(M.paint, ex - 0.13, y + 1.47, z + 0.42, ex + 0.13, y + 1.58, z + 0.68, WHITE);
      }
    });
  }

  // under floor jj of half h (over floor jj - 1): the striplights in their housings (lit) over the
  // aisle and over each row of bays, the red sprinkler main along the aisle, its heads; the conduit
  ceilingKit(K, M, h, jj, rng) {
    const fz = (z) => deckY(h, jj, z) - SLAB;
    const kn = deckKnots(h, jj);
    const z0 = jj === 0 ? (h === 'W' ? MZS : MZ0) : MZ0;
    const z1 = jj === 0 ? (h === 'W' ? MZ1 : MZN) : MZ1;
    const lines = [[(U_AISLE + U_IN) / 2, 5], [(U_OUT + U_AISLE) / 2 + 0.6, 10], [(U_IN + U_MID) / 2, 10]];
    for (const [u, step] of lines) {
      if (u > U_IN && jj === 0) continue;
      const x = hx(h, u);
      for (let z = z0 + 4; z < z1 - 2; z += step) {
        if (u > U_IN && (z < MZN || z > MZS)) continue;
        if (COLZ.some((c) => Math.abs(c - z) < 0.5)) continue;
        const y = fz(z) - BEAM + 0.12;
        K.box(M.paint, x - 0.14, y - 0.06, z - 0.7, x + 0.14, y, z + 0.7, WHITE);
        K.box(M.glow, x - 0.07, y - 0.09, z - 0.62, x + 0.07, y - 0.06, z + 0.62, LAMP);
      }
    }
    // the sprinkler main (a square red pipe following the floor) and its heads
    const xp = hx(h, U_AISLE + 1.4);
    K.add(M.metal, prism('z', profile(fz, z0 + 0.5, z1 - 0.5, kn, -0.62), xp - 0.06, xp + 0.06, (s, y) => y - 0.12), RED);
    for (let z = z0 + 2; z < z1 - 1; z += 4.2) {
      const y = fz(z) - 0.74;
      K.box(M.metal, xp - 0.05, y - 0.16, z - 0.05, xp + 0.05, y, z + 0.05, linC(0.85, 0.7, 0.3));
    }
    const xc = hx(h, U_OUT + 0.25);
    K.add(M.metal, prism('z', profile(fz, z0 + 0.5, z1 - 0.5, kn, -0.2), xc - 0.04, xc + 0.04, (s, y) => y - 0.08), linC(0.56, 0.57, 0.62));
    void rng;
  }

  // the street floor's ends under the first slope: the west half's at the south end (by the way
  // in), the east half's at the north end - bays along the outer wall, the lights over them
  pocketInside(K, M, h, rng) {
    const f = () => Y0;
    const za = h === 'W' ? MZS + 0.5 : MZ0 + CORE_D;
    const zb = h === 'W' ? MZ1 - CORE_D : MZN - 0.5;
    const zs = [za, ...COLZ.filter((z) => z > za + 0.5 && z < zb - 0.5), zb];
    for (let i = 0; i + 1 < zs.length; i++) {
      const span = zs[i + 1] - zs[i];
      if (span < 2.3) continue;
      const n = Math.max(1, Math.round(span / 2.5));
      const w = span / n;
      for (let k = 0; k < n; k++) {
        const z = zs[i] + w * (k + 0.5);
        for (const zz of [z - w / 2, z + w / 2]) paintLine(K, M.paint, WHITE, hx(h, U_OUT), zz, hx(h, U_AISLE), zz, 0.1, f, 0.02);
        this.bays.push({ h, j: -1, row: 'out', x: hx(h, (U_OUT + U_AISLE) / 2), z, w, u0: U_OUT, u1: U_AISLE, nx: h === 'W' ? -1 : 1, za: z - w / 2, zb: z + w / 2, n: 90 + i * 4 + k });
      }
    }
    // the floor over it: its lights, its pipes
    this.ceilingKit(K, M, h, 0, rng);
    // the hatched end of the fill under the first slope: no way on
    const zw = h === 'W' ? MZS : MZN;
    const nz = h === 'W' ? 1 : -1;
    for (let i = 0; i < 9; i++) {
      const u0 = U_AISLE + i * 0.9;
      paintLine(K, M.paint, YEL, hx(h, u0), zw + nz * 0.3, hx(h, u0 + 0.9), zw + nz * 1.6, 0.18, f, 0.02);
    }
    for (let i = 0; i < 8; i++) {
      const xa = hx(h, U_AISLE + i * 1.6);
      const xb = hx(h, U_AISLE + i * 1.6 + 0.8);
      K.box(M.paint, Math.min(xa, xb), Y0 + 0.1, Math.min(zw, zw + nz * 0.02), Math.max(xa, xb), Y0 + 1.2, Math.max(zw, zw + nz * 0.02), i % 2 ? INK : YEL);
    }
    void rng;
  }

  // the turns at the ends: SLOW on the floor coming into them, a sweep of arrows round them, tyre
  // marks, the nose of the middle hatched, a convex mirror on its column; the level painted big on
  // the end wall; a sign hung over the turn with the level on it
  turns(K, M, rng) {
    const R = (E_AISLE_X - W_AISLE_X) / 2;
    for (const [end, zEnd, nz] of [['N', MZ0, 1], ['S', MZ1, -1]]) {
      const zNose = end === 'N' ? MZN : MZS;
      for (let k = 1; k <= 5; k++) {
        const y = LV(k);
        const f = () => y;
        // (the way up turns here on the odd levels at the north end, the even ones at the south)
        const up = end === 'N' ? k % 2 === 1 : k % 2 === 0;
        // round the nose: p(a) = (MXC + R cos a, zNose - nz R sin a), a from 0 (the east aisle) to
        // pi (the west one); the way up goes from east to west at the north end, west to east at
        // the south end
        const P = (a, r = R) => [MXC + Math.cos(a) * r, zNose - nz * Math.sin(a) * r];
        const inc = (end === 'N') === up;
        for (let i = 1; i < 5; i++) {
          const a = (i / 5) * Math.PI;
          const [px, pz] = P(a);
          const tx = -Math.sin(a) * (inc ? 1 : -1);
          const tz = -nz * Math.cos(a) * (inc ? 1 : -1);
          paintArrow(K, M.paint, WHITE, px, pz, tx, tz, f, 3.2);
        }
        // tyre marks swept round it
        for (let t = 0; t < 3; t++) {
          const r = R + (rng() - 0.5) * 2.5;
          const a0 = rng() * 0.5;
          const a1 = Math.PI - rng() * 0.5;
          for (let i = 0; i < 12; i++) {
            const p0 = P(a0 + ((a1 - a0) * i) / 12, r);
            const p1 = P(a0 + ((a1 - a0) * (i + 0.85)) / 12, r);
            paintLine(K, M.matte, linC(0.25, 0.24, 0.27), p0[0], p0[1], p1[0], p1[1], 0.2, f, 0.009);
          }
        }
        // SLOW on the floor coming into it (the way up: the east half's into the north end, the
        // west half's into the south end; the way down the other way round), read as it comes
        const hIn = up === (end === 'N') ? 'E' : 'W';
        const jIn = hIn === 'E' ? (end === 'N' ? k - 1 : k) : end === 'N' ? k : k - 1;
        const zs = zNose + nz * 3.2;
        const fin = (x, z) => deckY(hIn, jIn, z);
        paintWord(K, M.paint, WHITE, 'SLOW', 0.95, hx(hIn, (U_AISLE + U_IN) / 2), zs, 0, -nz, fin);
        for (let i = 0; i < 8; i++) {
          const z0 = zs + nz * (2.2 + i * 0.25);
          paintLine(K, M.paint, i % 2 ? INK : YEL, hx(hIn, U_AISLE + 0.4), z0, hx(hIn, U_IN - 0.4), z0, 0.25, fin, 0.02);
        }
        // the nose of the middle: hatched on the turn's side, a mirror on its column
        for (let i = 0; i < 6; i++) paintLine(K, M.paint, YEL, MXC - 1.3 + i * 0.5, zNose - nz * 0.5, MXC - 0.8 + i * 0.5, zNose - nz * 2.4, 0.16, f, 0.021);
        const mz = zNose - nz * 0.45;
        K.box(M.metal, MXC - 0.03, y + 2.0, Math.min(zNose, mz), MXC + 0.03, y + 2.06, Math.max(zNose, mz), STEEL);
        K.sphere(M.glass, 0.36, MXC, y + 2.05, mz - nz * 0.05, linC(0.75, 0.82, 0.9), 1, 1, 0.35, 10);
        K.add(M.paint, new THREE.TorusGeometry(0.36, 0.035, 4, 14).translate(MXC, y + 2.05, mz - nz * 0.05), linC(0.95, 0.5, 0.15));
        // (a camera over the mirror, watching the turn, its little red light)
        K.box(M.metal, MXC - 0.05, y + 2.55, Math.min(zNose, mz), MXC + 0.05, y + 2.62, Math.max(zNose, mz), STEEL);
        K.box(M.paint, MXC - 0.11, y + 2.47, mz - 0.19, MXC + 0.11, y + 2.66, mz + 0.19, WHITE);
        K.box(M.glass, MXC - 0.07, y + 2.5, mz - nz * 0.19 - 0.02, MXC + 0.07, y + 2.62, mz - nz * 0.19 + 0.02, DARK);
        K.box(M.glow, MXC + 0.07, y + 2.62, mz - 0.03, MXC + 0.1, y + 2.65, mz, RED);
        // the signs hung over each aisle where it comes off its slope into the turn, under the beams
        // of the floor over it: the level in its colour, both faces
        for (const h of ['W', 'E']) {
          // (none where that half has no floor over this level at this end: the roof)
          const over = end === 'N' ? (h === 'W' ? k + 1 <= 5 : k + 1 <= 6) : h === 'W' ? k + 1 <= 6 : k + 1 <= 5;
          if (!over) continue;
          const ax = hx(h, (U_AISLE + U_IN) / 2);
          const sz = zNose - nz * 1.2;
          const sy = LV(k + 1) - SLAB - BEAM - 0.02;
          for (const sx of [ax - 1.4, ax + 1.4]) K.box(M.metal, sx - 0.02, sy - 0.1, sz - 0.02, sx + 0.02, sy + 0.02, sz + 0.02, STEEL);
          K.box(M.paint, ax - 1.7, sy - 0.48, sz - 0.04, ax + 1.7, sy - 0.1, sz + 0.04, LEVEL_C[k]);
          for (const sd of [-1, 1]) wallWord(K, M.paint, WHITE, `LEVEL ${LEVEL_NAME[k]}`, 0.24, ax, sy - 0.41, sz + sd * 0.04, 0, sd, 0.01);
        }
        // the level, big, on the end wall's inside, in its colour
        const wz = zEnd + nz * 0.26;
        K.box(M.paint, MXC - 2.4, y + 1.55, Math.min(wz, wz + nz * 0.02), MXC + 2.4, y + 2.75, Math.max(wz, wz + nz * 0.02), LEVEL_C[k]);
        wallWord(K, M.paint, WHITE, `LEVEL ${LEVEL_NAME[k]}`, 0.6, MXC, y + 1.85, wz + nz * 0.02, 0, nz, 0.02);
      }
    }
  }

  // the way in on the street floor at the south end: the barrier (up) and the ticket machine on its
  // island, a booth; the way out at the north end: its barrier and the pay-on-exit machine
  wayIn(K, M) {
    const wall = this.wall;
    for (const [h, zEnd, nz] of [['E', MZ1, -1], ['W', MZ0, 1]]) {
      const iz = zEnd + nz * 5.5;
      // (on the driver's side: both ways are driven north, so the aisle's west edge)
      const ix = Math.min(hx(h, U_AISLE), hx(h, U_IN)) + 0.7;
      const s = 1;
      K.box(M.matte, ix - s * 0.7, Y0, iz - 1.6, ix + s * 0.7, Y0 + 0.16, iz + 1.6, linC(0.75, 0.73, 0.7));
      for (const dz of [-1.6, 1.6]) K.box(M.paint, ix - 0.7, Y0 + 0.16, iz + dz - 0.08, ix + 0.7, Y0 + 0.17, iz + dz + 0.08, YEL);
      K.box(M.paint, ix - 0.3, Y0 + 0.16, iz + nz * 0.6 - 0.25, ix + 0.3, Y0 + 1.55, iz + nz * 0.6 + 0.25, BLUE_P);
      K.box(M.glow, ix - s * 0.31, Y0 + 1.05, iz + nz * 0.6 - 0.18, ix - s * 0.32, Y0 + 1.35, iz + nz * 0.6 + 0.18, linC(0.5, 0.9, 1));
      const bx = ix;
      const bz = iz - nz * 0.9;
      K.box(M.paint, bx - 0.22, Y0 + 0.16, bz - 0.22, bx + 0.22, Y0 + 1.15, bz + 0.22, linC(0.95, 0.75, 0.15));
      // (the arm, up: striped red and white)
      for (let i = 0; i < 6; i++) K.box(M.paint, bx - 0.05, Y0 + 1.15 + i * 0.5, bz - 0.05, bx + 0.05, Y0 + 1.65 + i * 0.5, bz + 0.05, i % 2 ? WHITE : RED);
      wall(Math.min(ix - s * 0.7, ix + s * 0.7), iz - 1.6, Math.max(ix - s * 0.7, ix + s * 0.7), iz + 1.6, 0, Y0 + 1.55, 'prop');
    }
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
      const roof = b.j === NDECK - 1;
      const top = b.j >= 4;
      if (rng() > (roof ? 0.42 : top ? 0.55 : 0.68)) continue;
      const y = b.j < 0 ? Y0 : deckY(b.h, b.j, b.z);
      // (Danny's bay and the bays either side of it empty, on his floor: room at both doors)
      if (Math.abs(y - Y0) < 1 && Math.hypot(b.x - KEEP.heroBay.x, b.z - KEEP.heroBay.z) < 3.6) continue;
      // (nose in, towards the wall it backs onto; now and then backed in)
      const back = rng() < 0.2;
      const yaw = (b.nx > 0) !== back ? Math.PI / 2 : -Math.PI / 2;
      const off = b.nx * 0.25;
      const gz = b.j < 0 ? 0 : (deckY(b.h, b.j, b.z + 0.5) - deckY(b.h, b.j, b.z - 0.5));
      put(this.main.parked, b.x + off, b.z, y, yaw, 0, gz);
    }
    for (const b of this.landBays) {
      if (rng() > (b.k === LY.length - 1 ? 0.35 : 0.62)) continue;
      if (b.k === LY.length - 1 && b.x > KEEP.land.x0 && b.x < KEEP.land.x1) continue;
      const yaw = b.into > 0 ? 0 : Math.PI;
      put(this.land.parked, b.x, b.z + b.into * 0.2, LY[b.k], rng() < 0.2 ? yaw + Math.PI : yaw, 0, 0);
    }
  }
}
