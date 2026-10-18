// The plan of the city. x grows to the east (the ocean), z to the south; the camera at the start
// looks north (-z), up Ocean Drive, into the sunset.
//
// (v5) The city by the ocean, the way Miami Beach is laid out: Ocean Drive along the beach, its
// hotels on the west side behind their terraces (the fronts at x -15, the sidewalk -15..-3), the
// street -3..13, the sidewalk on the park side 13..21, then the park (lawns, palms, the beach walk)
// to 43, the dunes to 52, the sand down to the water at 108. Behind the hotels the city goes on:
// Collins Ave, Washington Ave, Meridian Ave, and the numbered streets across them.

import { MAINLAND_ON, mainlandHeight, mDistrictName, CAUSEWAYS } from './mainland/plan.js';

export const CURB = 0.15;

// north-south roads, west to east. x: centre, half: half the street, walk: sidewalk width
export const AVES = [
  { x: -204, half: 7, walk: 5, name: 'שדרות מרידיאן', sign: 'Meridian Ave' },
  { x: -135, half: 7, walk: 5, name: 'שדרות וושינגטון', sign: 'Washington Ave' },
  { x: -66, half: 7, walk: 5, name: 'שדרות קולינס', sign: 'Collins Ave' },
  { x: 5, half: 8, walk: 6, name: 'אושן דרייב', sign: 'Ocean Dr', blvd: true },
];
export const BLVD = AVES[3];
export const STREET_X0 = -3;
export const STREET_X1 = 13;
// (v5) the hotels' fronts: their terraces and the sidewalk before them, 12 m to the curb
export const WALK_X0 = -15;
// the sidewalk on the park side ends here, and the park begins
export const PROM_X1 = 21;
// the park ends at the dunes, the dunes at the sand, the sand at the water
export const PARK_X1 = 43;
export const SAND_X0 = 52;
export const SAND_TOP = 0.3;
// the beach walk through the park
export const BEACH_WALK = [31, 35.5];

// east-west roads, north to south
export const STREETS = [
  { z: -379, half: 6, walk: 5, name: 'רחוב 15', sign: '15th St' },
  { z: -243, half: 6, walk: 5, name: 'רחוב 13', sign: '13th St' },
  { z: -107, half: 6, walk: 5, name: 'רחוב 11', sign: '11th St' },
  { z: 29, half: 6, walk: 5, name: 'רחוב 9', sign: '9th St' },
  { z: 165, half: 6, walk: 5, name: 'רחוב 7', sign: '7th St' },
  { z: 301, half: 6, walk: 5, name: 'רחוב 5', sign: '5th St' },
];

// the land of the city (the westernmost row of houses faces Coral Ave from behind it)
export const WEST_EDGE = -238;
export const NORTH_EDGE = STREETS[0].z - STREETS[0].half - STREETS[0].walk; // -390
export const SOUTH_EDGE = STREETS[5].z + STREETS[5].half + STREETS[5].walk; // 312
export const WATER_X = 108;

export const BOUNDS = { minX: WEST_EDGE + 1, maxX: WATER_X - 1, minZ: NORTH_EDGE + 1, maxZ: SOUTH_EDGE + 30 };

// the pier out over the beach and into the ocean at the south end, with its wheel
export const PIER = { z0: 236, z1: 250, x0: PARK_X1, x1: 232 };

// what each block is: rows north to south, columns west to east (between the avenues)
export const BLOCK_TYPES = [
  ['gang', 'towers', 'hotels'],
  ['motel', 'plaza', 'shops'],
  ['shops', 'park', 'first'],
  ['gang', 'shops', 'shops'],
  ['shops', 'market', 'hotels'],
];

export const DISTRICT_NAMES = {
  gang: 'הסמטאות',
  towers: 'מרכז העיר',
  hotels: 'שדרת המלונות',
  motel: 'מוטל הכוכב',
  plaza: 'כיכר המזרקה',
  shops: 'רובע החנויות',
  park: 'פארק הדקלים',
  first: 'אושן דרייב',
  market: 'השוק',
  west: 'הקצה המערבי',
};

// the land between two avenues and two streets (sidewalks not included)
export function blockRect(col, row) {
  const a = AVES[col];
  const b = AVES[col + 1];
  const s = STREETS[row];
  const t = STREETS[row + 1];
  return {
    x0: a.x + a.half + a.walk,
    x1: b.blvd ? WALK_X0 : b.x - b.half - b.walk,
    z0: s.z + s.half + s.walk,
    z1: t.z - t.half - t.walk,
  };
}

// the houses west of Coral Ave
export function westRect(row) {
  const a = AVES[0];
  const s = STREETS[row];
  const t = STREETS[row + 1];
  return { x0: WEST_EDGE, x1: a.x - a.half - a.walk, z0: s.z + s.half + s.walk, z1: t.z - t.half - t.walk };
}

export function blockAt(x, z) {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const r = blockRect(col, row);
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return { col, row, type: BLOCK_TYPES[row][col], rect: r };
    }
    const w = westRect(row);
    if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return { col: -1, row, type: 'west', rect: w };
  }
  return null;
}

// on a road (and which): the asphalt is at 0, everything else is a curb higher
export function roadAt(x, z) {
  if (z > NORTH_EDGE && z < SOUTH_EDGE) {
    for (const a of AVES) if (Math.abs(x - a.x) < a.half) return { ave: a };
  }
  if (x > WEST_EDGE && x < STREET_X0) {
    for (const s of STREETS) if (Math.abs(z - s.z) < s.half) return { street: s };
  }
  return null;
}

// on a road at all? (roadAt without the answer: asked for every walker every frame)
function onRoad(x, z) {
  if (z > NORTH_EDGE && z < SOUTH_EDGE) {
    for (let i = 0; i < AVES.length; i++) if (Math.abs(x - AVES[i].x) < AVES[i].half) return true;
  }
  if (x > WEST_EDGE && x < STREET_X0) {
    for (let i = 0; i < STREETS.length; i++) if (Math.abs(z - STREETS[i].z) < STREETS[i].half) return true;
  }
  return false;
}

// (v5) how much of the dunes stands at z: none where a path crosses them (at the end of every
// street, and at the pier)
function duneK(z) {
  let k = 1;
  for (let i = 0; i < STREETS.length; i++) {
    const t = (Math.abs(z - STREETS[i].z) - 2.6) / 3;
    if (t < k) k = t;
  }
  const tp = (Math.max(PIER.z0 - 2 - z, z - PIER.z1 - 2)) / 3;
  if (tp < k) k = tp;
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  return k * k * (3 - 2 * k);
}

// the ground east of the park's sidewalk: the park (a curb high), the dunes between their fences,
// the sand sloping down to the water
export function beachHeight(x, z) {
  if (x <= PARK_X1) return CURB;
  if (x < SAND_X0) {
    const t = (x - PARK_X1) / (SAND_X0 - PARK_X1);
    const amp = 0.62 + 0.26 * Math.sin(z * 0.11) + 0.14 * Math.sin(z * 0.37 + 1.3);
    return CURB + (SAND_TOP - CURB) * t + Math.sin(t * Math.PI) * amp * duneK(z);
  }
  return SAND_TOP - ((SAND_TOP + 0.8) * (x - SAND_X0)) / (WATER_X - SAND_X0);
}

// (v5, ROADMAP 11.17) on one of the causeways' decks (or the ground they come ashore on)?
function onCauseway(z) {
  for (let i = 0; i < CAUSEWAYS.length; i++) if (Math.abs(z - CAUSEWAYS[i].z) < CAUSEWAYS[i].half + 1.2) return true;
  return false;
}

// Height of the walkable ground (sidewalks, blocks and the park are raised by a curb).
export function groundHeight(x, z) {
  // (v5, ROADMAP 11.17: the bay, the causeways over it and the mainland: world/mainland/plan.js)
  if (MAINLAND_ON && x < WEST_EDGE - 2 && (x < WEST_EDGE - 30 || onCauseway(z))) return mainlandHeight(x, z);
  if (x > PROM_X1) {
    if (z > PIER.z0 && z < PIER.z1 && x > PIER.x0 && x < PIER.x1) return 0.35;
    if (x > WATER_X) return -0.8;
    return beachHeight(x, z);
  }
  if (onRoad(x, z)) return 0;
  return CURB;
}

export function nearestRoadInfo(x, z) {
  let ave = 0;
  let dA = Infinity;
  for (let i = 0; i < AVES.length; i++) {
    const d = Math.abs(x - AVES[i].x);
    if (d < dA) {
      dA = d;
      ave = i;
    }
  }
  let street = 0;
  let dS = Infinity;
  for (let i = 0; i < STREETS.length; i++) {
    const d = Math.abs(z - STREETS[i].z);
    if (d < dS) {
      dS = d;
      street = i;
    }
  }
  return { ave, aveDist: dA, street, streetDist: dS };
}

export function districtName(x, z) {
  if (MAINLAND_ON && x < WEST_EDGE - 20) return mDistrictName(x, z);
  if (x > PIER.x0 - 1 && z > PIER.z0 - 2 && z < PIER.z1 + 2) return 'המזח';
  if (x > PARK_X1 && x < WATER_X + 40) return 'החוף';
  if (x > PROM_X1 && x <= PARK_X1) return 'פארק החוף';
  if (x > WALK_X0 - 24 && x < PROM_X1 + 1 && z > NORTH_EDGE - 20 && z < SOUTH_EDGE + 20) return 'אושן דרייב';
  const b = blockAt(x, z);
  if (b) return DISTRICT_NAMES[b.type] || '';
  const r = nearestRoadInfo(x, z);
  const a = AVES[r.ave];
  if (r.aveDist < a.half + a.walk + 0.5) return a.name;
  const s = STREETS[r.street];
  if (r.streetDist < s.half + s.walk + 0.5) return s.name;
  return '';
}
