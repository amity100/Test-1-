// The plan of the city. x grows to the east (the bay), z to the south; the camera of the first
// boulevard looks north (-z), into the sunset.
//
// Bayview Blvd is the first boulevard, exactly where it was: its shops' sidewalk at x -9..-3, the
// street -3..13, the promenade 13..21 and the sea wall. Behind the shops the city goes on: three
// avenues inland, six cross streets, blocks of shops with an alley down the middle of each.

export const CURB = 0.15;

// north-south roads, west to east. x: centre, half: half the street, walk: sidewalk width
export const AVES = [
  { x: -204, half: 7, walk: 5, name: 'שדרת האלמוגים', sign: 'Coral Ave' },
  { x: -135, half: 7, walk: 5, name: 'שדרת הפלמינגו', sign: 'Flamingo Ave' },
  { x: -66, half: 7, walk: 5, name: 'שדרת הדקלים', sign: 'Palm Ave' },
  { x: 5, half: 8, walk: 6, name: 'שדרות ביי-ויו', sign: 'Bayview Blvd', blvd: true },
];
export const BLVD = AVES[3];
export const STREET_X0 = -3;
export const STREET_X1 = 13;
export const WALK_X0 = -9;
export const PROM_X1 = 21;

// east-west roads, north to south
export const STREETS = [
  { z: -379, half: 6, walk: 5, name: 'רחוב הצפון', sign: 'North St' },
  { z: -243, half: 6, walk: 5, name: 'רחוב הליים', sign: 'Lime St' },
  { z: -107, half: 6, walk: 5, name: 'רחוב המנגו', sign: 'Mango St' },
  { z: 29, half: 6, walk: 5, name: 'רחוב הקוקוס', sign: 'Coconut St' },
  { z: 165, half: 6, walk: 5, name: 'רחוב הסחלב', sign: 'Orchid St' },
  { z: 301, half: 6, walk: 5, name: 'רחוב המזח', sign: 'Pier St' },
];

// the land of the city (the westernmost row of houses faces Coral Ave from behind it)
export const WEST_EDGE = -238;
export const NORTH_EDGE = STREETS[0].z - STREETS[0].half - STREETS[0].walk; // -390
export const SOUTH_EDGE = STREETS[5].z + STREETS[5].half + STREETS[5].walk; // 312
export const WATER_X = PROM_X1 + 0.6;

export const BOUNDS = { minX: WEST_EDGE + 1, maxX: PROM_X1 - 0.6, minZ: NORTH_EDGE + 1, maxZ: SOUTH_EDGE + 30 };

// the pier out into the bay at the south end, with its wheel
export const PIER = { z0: 236, z1: 250, x0: PROM_X1, x1: 150 };

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
  first: 'השדרה הראשונה',
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

// Height of the walkable ground (sidewalks, blocks and the promenade are raised by a curb).
export function groundHeight(x, z) {
  if (x > WATER_X) {
    if (z > PIER.z0 && z < PIER.z1 && x < PIER.x1) return 0.35;
    return -0.8;
  }
  if (roadAt(x, z)) return 0;
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
  if (x > STREET_X1 && x < PROM_X1 + 1) return 'הטיילת';
  if (x > PROM_X1 && z > PIER.z0 - 2 && z < PIER.z1 + 2) return 'המזח';
  const b = blockAt(x, z);
  if (b) return DISTRICT_NAMES[b.type] || '';
  const r = nearestRoadInfo(x, z);
  const a = AVES[r.ave];
  if (r.aveDist < a.half + a.walk + 0.5) return a.name;
  const s = STREETS[r.street];
  if (r.streetDist < s.half + s.walk + 0.5) return s.name;
  return '';
}
