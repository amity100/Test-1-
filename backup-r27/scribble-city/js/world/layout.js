// The first district of the scribble city: a Manhattan-like grid.
// x grows to the east, z grows to the south. Avenues run north-south, streets east-west.

export const AVES = [-210, -126, -42, 42, 126, 210];
export const STREETS = [-145, -87, -29, 29, 87, 145];
export const AVE_W = 14;
export const ST_W = 10;
export const SIDEWALK = 4.5;
export const CURB = 0.15;

// Playable bounds (outer sidewalks / promenades included).
export const BOUNDS = { minX: -221.5, maxX: 226.5, minZ: -154.5, maxZ: 159 };
// The Inkwell's interior is built out over the river, past the edge of the map: you only
// ever see it from inside (the street door takes you there).
export const BAR_ZONE = { x0: 258, x1: 292, z0: 228, z1: 262, cx: 275, cz: 245, floor: 0.15 };
export const WATER_EAST_X = 228;
export const WATER_SOUTH_Z = 160.5;

export const AVE_NAMES = ['שדרה 1', 'שדרה 2', 'שדרת השרבוט', 'שדרה 4', 'שדרה 5', 'שדרת הנהר'];
export const STREET_NAMES = ['רחוב 50', 'רחוב 42', 'רחוב 34', 'רחוב 23', 'רחוב 14', 'רחוב המעבורת'];
// Street signs inside the world are in English.
export const AVE_SIGNS = ['1st Ave', '2nd Ave', 'Sketch Ave', '4th Ave', '5th Ave', 'River Dr'];
export const STREET_SIGNS = ['W 50th St', 'W 42nd St', 'W 34th St', 'W 23rd St', 'W 14th St', 'Ferry St'];

// Block types: [bz][bx]
export const BLOCK_TYPES = [
  ['alien', 'loft', 'tower', 'fortress', 'fortress2'],
  ['loft', 'brown', 'park', 'office', 'warehouse'],
  ['brown', 'theater', 'plaza', 'office', 'warehouse'],
  ['brown', 'loft', 'tower', 'tower', 'dealer'],
  ['start', 'brown', 'finance', 'empire', 'ferry'],
];

export const DISTRICT_NAMES = {
  alien: 'אתר ההתרסקות',
  fortress: 'מבצר הכנופיה',
  fortress2: 'מבצר הכנופיה',
  park: 'פארק השרבוטים',
  plaza: 'כיכר הטיימס-שרבוט',
  theater: 'רובע התיאטראות',
  dealer: 'סוכנות המכוניות',
  ferry: 'נמל המעבורת',
  empire: 'מגדל האמפייר',
  finance: 'רובע הבנקים',
  start: 'המחבוא',
  brown: 'שכונת הבראונסטון',
  loft: 'שכונת הלופטים',
  tower: 'מרכז העיר',
  office: 'רובע המשרדים',
  warehouse: 'רציף המחסנים',
};

export function blockRect(bx, bz) {
  return {
    x0: AVES[bx] + AVE_W / 2,
    x1: AVES[bx + 1] - AVE_W / 2,
    z0: STREETS[bz] + ST_W / 2,
    z1: STREETS[bz + 1] - ST_W / 2,
  };
}

export function blockAt(x, z) {
  for (let bx = 0; bx < 5; bx++) {
    for (let bz = 0; bz < 5; bz++) {
      const r = blockRect(bx, bz);
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return { bx, bz, type: BLOCK_TYPES[bz][bx], rect: r };
    }
  }
  return null;
}

// Height of the walkable ground (sidewalk slabs are raised by a curb).
export function groundHeight(x, z) {
  if (x > BAR_ZONE.x0 && x < BAR_ZONE.x1 && z > BAR_ZONE.z0 && z < BAR_ZONE.z1) return BAR_ZONE.floor;
  if (x > BOUNDS.maxX + 2 || z > BOUNDS.maxZ + 2) return -3;
  for (let bx = 0; bx < 5; bx++) {
    const ax0 = AVES[bx] + AVE_W / 2;
    const ax1 = AVES[bx + 1] - AVE_W / 2;
    if (x < ax0 || x > ax1) continue;
    for (let bz = 0; bz < 5; bz++) {
      const z0 = STREETS[bz] + ST_W / 2;
      const z1 = STREETS[bz + 1] - ST_W / 2;
      if (z >= z0 && z <= z1) return CURB;
    }
  }
  // outer sidewalks & promenades
  if (x < AVES[0] - AVE_W / 2) return CURB;
  if (z < STREETS[0] - ST_W / 2) return CURB;
  if (x > AVES[5] + AVE_W / 2) return CURB;
  if (z > STREETS[5] + ST_W / 2) return CURB;
  return 0;
}

export function nearestRoadInfo(x, z) {
  let bestAve = 0;
  let dA = Infinity;
  for (let i = 0; i < AVES.length; i++) {
    const d = Math.abs(x - AVES[i]);
    if (d < dA) {
      dA = d;
      bestAve = i;
    }
  }
  let bestSt = 0;
  let dS = Infinity;
  for (let i = 0; i < STREETS.length; i++) {
    const d = Math.abs(z - STREETS[i]);
    if (d < dS) {
      dS = d;
      bestSt = i;
    }
  }
  return { ave: bestAve, aveDist: dA, street: bestSt, streetDist: dS };
}

export function districtName(x, z) {
  if (x > BAR_ZONE.x0 && x < BAR_ZONE.x1 && z > BAR_ZONE.z0 && z < BAR_ZONE.z1) return 'בר The Inkwell';
  const b = blockAt(x, z);
  if (b) return DISTRICT_NAMES[b.type] || '';
  const r = nearestRoadInfo(x, z);
  if (r.aveDist < AVE_W / 2 + 1) return AVE_NAMES[r.ave];
  if (r.streetDist < ST_W / 2 + 1) return STREET_NAMES[r.street];
  if (x > AVES[5]) return 'טיילת הנהר';
  if (z > STREETS[5]) return 'הטיילת הדרומית';
  return '';
}
