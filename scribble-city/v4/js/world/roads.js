import { AVES, STREETS, STREET_X0, WEST_EDGE } from './layout.js';

// The roads as the traffic sees them: a crossing wherever an avenue meets a street, the lanes
// painted on each road, where the cars stop for the lights. (The world draws its traffic lights
// from the same plan, so the poles stand where the cars wait.)
//
// Right-hand traffic. A car going along (dx, dz) has its right at (-dz, dx); its lanes are
// measured from the middle of the road to the right.

export const NA = AVES.length;
export const NS = STREETS.length;
// one turn of the lights (s)
export const CYCLE = 26;

export const NODES = [];
for (let j = 0; j < NS; j++) {
  for (let i = 0; i < NA; i++) {
    const ave = AVES[i];
    const street = STREETS[j];
    NODES.push({ id: NODES.length, i, j, x: ave.x, z: street.z, ave, street, nb: [], signal: false, offset: 0 });
  }
}

export function nodeAt(i, j) {
  return i >= 0 && i < NA && j >= 0 && j < NS ? NODES[j * NA + i] : null;
}

for (const n of NODES) {
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const m = nodeAt(n.i + di, n.j + dj);
    if (m) n.nb.push(m);
  }
  // a crossing with three or four ways has lights; a corner does not need them
  n.signal = n.nb.length >= 3;
  // a green wave down the avenues
  n.offset = (n.i * 5.3 + n.j * 3.1) % CYCLE;
}

// The light for cars coming along an axis ('ns': along an avenue, 'ew': along a street):
// 'g', 'y' or 'r'. The avenues get the longer green.
export function lightAt(n, axis, time) {
  if (!n.signal) return 'g';
  const t = (((time + n.offset) % CYCLE) + CYCLE) % CYCLE;
  if (axis === 'ns') return t < 11 ? 'g' : t < 13.5 ? 'y' : 'r';
  return t >= 14.5 && t < 23 ? 'g' : t >= 23 && t < 25.5 ? 'y' : 'r';
}

// lane offsets (to the right of the middle of the road) for a car going along (dx, dz) on the
// avenue or street through n
export function laneOffsets(n, dx, dz) {
  if (dz !== 0) {
    // Bayview Blvd: one lane south (the curb lane is for parking), two lanes north
    if (n.ave.blvd) return dz > 0 ? [2.0] : [2.1, 6.0];
    return [1.75, 5.25];
  }
  return [1.8];
}

// how far from the middle of the crossing the cars stop (the line before the zebra)
export function stopDist(n, alongZ) {
  if (alongZ) return n.street.half + (n.ave.blvd ? 1.0 : 3.8);
  return n.ave.half + 3.8;
}

// the point of a lane at distance t from the middle of n, along (dx, dz)
export function lanePoint(n, dx, dz, off, t) {
  return [n.x + dx * t - dz * off, n.z + dz * t + dx * off];
}

// every way out of n for a car that came in going (dx, dz): straight on, right, and left only
// where no traffic comes the other way (so nobody turns across anybody)
export function exitsFrom(n, dx, dz) {
  const out = [];
  let straight = false;
  for (const m of n.nb) {
    const ex = Math.sign(m.x - n.x);
    const ez = Math.sign(m.z - n.z);
    if (ex === -dx && ez === -dz) continue; // back the way it came
    if (ex === dx && ez === dz) {
      straight = true;
      out.push({ to: m, dx: ex, dz: ez, turn: 0 });
    } else if (ex === -dz && ez === dx) out.push({ to: m, dx: ex, dz: ez, turn: 1 });
    else out.push({ to: m, dx: ex, dz: ez, turn: -1 });
  }
  return straight ? out.filter((e) => e.turn >= 0) : out;
}

// where the cars park: both curbs of every cross street, the shop curb of the boulevard
export function parkingSpots(rng) {
  const spots = [];
  const gap = 5.8;
  for (const s of STREETS) {
    // between the avenues (clear of the zebras), and the stubs west of Coral Ave
    const xs = [WEST_EDGE - 4, ...AVES.flatMap((a) => (a.blvd ? [STREET_X0 - 4.4] : [a.x - a.half - 4.4, a.x + a.half + 4.4]))];
    for (let k = 0; k < xs.length; k += 2) {
      const x0 = xs[k] + 3;
      const x1 = xs[k + 1] - 3;
      for (const side of [-1, 1]) {
        for (let x = x0; x <= x1; x += gap) {
          if (rng() > 0.5) continue;
          // south curb: they face east (with the traffic beside them), north curb: west
          spots.push({ x: x + rng.range(-0.3, 0.3), z: s.z + side * 4.75, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, alongX: true });
        }
      }
    }
  }
  // the boulevard's curb by the shops (the first boulevard had two here, at -30 and -52)
  for (let z = -380; z < 300; z += gap) {
    let cross = false;
    for (const s of STREETS) if (Math.abs(z - s.z) < s.half + 4) cross = true;
    if (cross || (z > -60 && z < -24) || rng() > 0.38) continue;
    spots.push({ x: -1.55, z, yaw: Math.PI, alongX: false });
  }
  spots.push({ x: -1.55, z: -30, yaw: Math.PI, alongX: false, first: 0 });
  spots.push({ x: -1.55, z: -52, yaw: Math.PI, alongX: false, first: 1 });
  return spots;
}
