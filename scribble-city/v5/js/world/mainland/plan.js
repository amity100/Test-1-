// (v5, ROADMAP 11.17) The mainland across the bay: the plan of it, and nothing built yet.
//
// The island (South Beach) is where the city began. Across the bay, to the west, the city goes on
// the way Miami does: the two causeways from 15th and 5th Street land at the bayfront, where
// downtown's towers stand over the water, Brickton's south of them, the painted warehouses of the
// mural district north of them; Little Havana and Calle Ocho behind downtown; and then the city
// turns into Los Angeles: Inkwood under its hills and the big letters on them, Bel Crest's
// mansions and Velvet Drive, the houses of Sun Valley, and the south coast's beach with its
// boardwalk and canals. x grows to the east, z to the south, as on the island.
//
// Everything here is plain numbers: where the roads and the blocks are, what each district is,
// which block is a mall or a club; world/mainland/*.js build it, a block at a time, near you.

// (its own dice, the same as world/kit.js seeded(): the plan imports nothing, so a test can read it)
function seeded(seed) {
  let s = seed;
  const f = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

export const CURB = 0.15;
// (the city as it was, the island alone: ?island=1)
export const MAINLAND_ON = !(typeof location !== 'undefined' && /[?&]island=1(&|$)/.test(location.search));
// the bay's west shore, the bayfront boulevard along it
export const SHORE_X = -650;
// the hills close the city to the north and to the west, the ocean to the south
export const WEST_X = -1960;
export const NORTH_Z = -1250;
export const BEACH_Z = 552;
export const SEA_Z = 642;
// the island's own edge (world/layout.js WEST_EDGE): where the causeways come ashore over there
export const ISLAND_X = -238;

// north-south: x, half the road, the sidewalk, from z0 to z1 (west of the bayfront, east to west)
const AVE_X = [-700, -790, -880, -970, -1060, -1150, -1240, -1330, -1420, -1510, -1600, -1690, -1780, -1870];
const AVE_NAMES = [
  ['שדרות המפרץ', 'Bayfront Blvd'],
  ['שדרות מיאמי', 'Miami Ave'],
  ['השדרה השנייה', '2nd Ave'],
  ['שדרות הנמל', 'Harbor Ave'],
  ['שדרות הנהר', 'River Ave'],
  ['שדרות קורל וויי', 'Coral Way'],
  ['שדרות לה ז\'ון', 'Le Jeune Ave'],
  ['שדרות ויין', 'Vine Ave'],
  ['שדרות ווסטרן', 'Western Ave'],
  ['שדרות לה בריאה', 'La Brea Ave'],
  ['שדרות פיירפקס', 'Fairfax Ave'],
  ['שדרות קרסנט', 'Crescent Ave'],
  ['שדרות קניון', 'Canyon Ave'],
  ['שדרות הדקלים', 'Palm Ave'],
];
// east-west: z, from x0 to x1 (north to south; 15th and 5th Street come over the causeways)
const STREET_Z = [-1195, -1059, -923, -787, -651, -515, -379, -243, -107, 29, 165, 301, 437, 540];
const STREET_NAMES = [
  ['דרך הגבעות', 'Hillside Dr'],
  ['רחוב פרנקלין', 'Franklin St'],
  ['רחוב 36', '36th St'],
  ['שדרות אינקווד', 'Inkwood Blvd'],
  ['רחוב 29', '29th St'],
  ['רחוב 20', '20th St'],
  ['דרך הגשר', 'Causeway Blvd'],
  ['רחוב 11', 'NE 11th St'],
  ['שדרות השקיעה', 'Sunset Blvd'],
  ['רחוב פלאגלר', 'Flagler St'],
  ['קאייה אוצ\'ו', 'Calle Ocho'],
  ['רחוב 5', '5th St'],
  ['רחוב 13 דרום', 'SW 13th St'],
  ['טיילת החוף', 'Ocean Front Walk'],
];

export const M_AVES = AVE_X.map((x, i) => ({
  i,
  x,
  half: i === 0 ? 10 : 7,
  walk: i === 0 ? 6 : 5,
  z0: STREET_Z[0],
  // (south of SW 13th the bayfront is the Point's park; the rest go on down to the beach)
  z1: i <= 2 ? STREET_Z[12] : STREET_Z[13],
  name: AVE_NAMES[i][0],
  sign: AVE_NAMES[i][1],
  // the bayfront boulevard has palms down the middle
  median: i === 0 ? 3 : 0,
  // (its lanes, to the right of the middle: two each way either side of the palms)
  lanes: i === 0 ? [3.4, 6.9] : null,
}));
export const M_STREETS = STREET_Z.map((z, j) => {
  const wide = j === 3 || j === 8;
  return {
    j,
    z,
    half: wide ? 9 : 6,
    walk: wide ? 6 : 5,
    // (the causeways' streets go on to the shore; the others start at the bayfront boulevard;
    // the beach road begins west of the Point)
    x0: AVE_X[AVE_X.length - 1],
    x1: j === 6 || j === 11 ? SHORE_X : j === 13 ? AVE_X[3] : AVE_X[0],
    name: STREET_NAMES[j][0],
    sign: STREET_NAMES[j][1],
    median: wide ? 2.4 : 0,
    lanes: wide ? [3.05, 6.45] : null,
  };
});

// the causeways over the bay: from the island's 15th and 5th Street to the mainland's shore. The
// Venetian rises in a long hump over the channel (the boats pass under it), its two towers and
// their cables over it; the MacArthur stays low, a small hump in the middle
export const CAUSEWAYS = [
  { z: -379, half: 6, x0: SHORE_X, x1: ISLAND_X - 24, mid: -456, rise: 0, run: 182, name: 'גשר ונציאן', sign: 'Venetian Causeway', towers: [-405, -507] },
  { z: 301, half: 6, x0: SHORE_X, x1: ISLAND_X - 24, mid: -456, rise: 0, run: 150, name: 'גשר מקארתור', sign: 'MacArthur Causeway', towers: null },
];

// the height of a causeway's deck at x (0 at both shores)
export function deckY(c, x) {
  const t = 1 - Math.abs(x - c.mid) / c.run;
  if (t <= 0) return 0;
  return c.rise * t * t * (3 - 2 * t);
}

// the districts: where they are, what they are called (Hebrew for the map, English on the signs)
export const DISTRICTS = [
  { id: 'paintwood', x0: -1060, x1: SHORE_X, z0: NORTH_Z, z1: -651, name: 'רובע הציורים', sign: 'Paintwood' },
  { id: 'downtown', x0: -1060, x1: SHORE_X, z0: -651, z1: 29, name: 'דאונטאון', sign: 'Downtown' },
  { id: 'brickton', x0: -1060, x1: SHORE_X, z0: 29, z1: SEA_Z, name: 'בריקטון', sign: 'Brickton' },
  { id: 'havana', x0: -1420, x1: -1060, z0: -243, z1: 437, name: 'ליטל הוואנה', sign: 'Little Havana' },
  { id: 'inkwood', x0: -1600, x1: -1060, z0: NORTH_Z, z1: -243, name: 'אינקווד', sign: 'Inkwood' },
  { id: 'belcrest', x0: WEST_X, x1: -1600, z0: NORTH_Z, z1: -243, name: 'בל קרסט', sign: 'Bel Crest' },
  { id: 'valley', x0: WEST_X, x1: -1420, z0: -243, z1: 437, name: 'עמק השמש', sign: 'Sun Valley' },
  { id: 'beach', x0: WEST_X, x1: -1060, z0: 437, z1: SEA_Z, name: 'חוף פליסייד', sign: 'Palisade Beach' },
];
const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
export function districtOf(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return null;
}

// ------------------------------------------------------------------ the blocks
// col: between avenue col (east) and col + 1 (west); row: between street row and row + 1
export function mBlockRect(col, row) {
  const a = M_AVES[col];
  const b = M_AVES[col + 1];
  const s = M_STREETS[row];
  const t = M_STREETS[row + 1];
  return {
    x0: b.x + b.half + b.walk,
    x1: a.x - a.half - a.walk,
    z0: s.z + s.half + s.walk,
    z1: t.z - t.half - t.walk,
  };
}

// the special blocks (by col,row): the malls, the parks, the clubs' street, the arena
// (everything else is the district's own mix, world/mainland/blocks.js)
const SPECIAL = {
  // downtown: the arena on the bay, the Galleria (a mall over three blocks, its halls of five floors
  // under vaults of glass, the arcades over Miami Avenue and Second Avenue between them, the dome over
  // the middle one's court - ROADMAP 11.31, 11.32), the park with the stage
  '0,7': 'arena',
  '0,8': 'galleriaE',
  '1,8': 'galleria',
  '2,8': 'galleriaW',
  // (and across Flagler Street from its middle hall, under a canopy of glass, its lanes: Via
  // Inkwell - ROADMAP 11.34, world/mainland/lanes.js)
  '1,9': 'lanes',
  '2,9': 'plaza',
  // Paintwood: the walls with the murals round their yard; the clubs on 29th Street
  '1,2': 'walls',
  '2,3': 'clubs',
  // Brickton: the restaurants' row, the park by the river
  '1,10': 'dining',
  '2,11': 'park',
  // Little Havana: Domino Park and the theatre on Calle Ocho
  '5,9': 'domino',
  // Inkwood: the arcade on the boulevard (ROADMAP 12.7: its hall on the block's east part,
  // game/arcade.js)
  '7,1': 'arcade',
  // Inkwood: the Starlight Center (a mall round an open court) and the theatres on the boulevard
  '6,3': 'starlight',
  '7,2': 'theatres',
  '9,3': 'theatres',
  // Sun Valley: the school, the strip mall with the supermarket, the park
  '11,8': 'school',
  '9,9': 'stripmall',
  '12,10': 'park',
  // Bel Crest: Velvet Drive's boutiques
  '11,4': 'velvet',
  '12,4': 'velvet',
};

// (the specials that came after the plan was first drawn: ROADMAP 11.31, 11.32, the Galleria's west
// and east halls; 11.34, its lanes)
const LATE = new Set(['2,8', '0,8', '1,9']);

// what each district builds where nothing special stands (the kinds of world/mainland/blocks.js)
const DISTRICT_MIX = {
  paintwood: ['warehouses', 'warehouses', 'lofts', 'mixed'],
  downtown: ['towers', 'towers', 'towers', 'offices'],
  brickton: ['towers', 'condos', 'condos', 'mixed'],
  havana: ['calle', 'calle', 'bungalows', 'bungalows'],
  inkwood: ['boulevard', 'mixed', 'bungalows', 'apartments'],
  belcrest: ['mansions', 'mansions', 'villas'],
  valley: ['houses', 'houses', 'houses', 'apartments'],
  beach: ['boardwalk'],
};

export const M_BLOCKS = [];
{
  const r = seeded(20261117);
  for (let row = 0; row < M_STREETS.length - 1; row++) {
    for (let col = 0; col < M_AVES.length - 1; col++) {
      const rect = mBlockRect(col, row);
      const cx = (rect.x0 + rect.x1) / 2;
      const cz = (rect.z0 + rect.z1) / 2;
      const d = districtOf(cx, cz);
      // (the Point south of SW 13th: the park on the water, not blocks)
      if (!d || (row >= 12 && col <= 2)) continue;
      // (a special added since the plan was first drawn still throws the district's dice, so that
      // every block after it comes out as it always has)
      const key = `${col},${row}`;
      let kind = SPECIAL[key];
      if (!kind || LATE.has(key)) {
        const k = r.pick(DISTRICT_MIX[d.id]);
        kind = kind || k;
      }
      M_BLOCKS.push({ id: M_BLOCKS.length, col, row, rect, cx, cz, district: d.id, kind, seed: 7000 + col * 131 + row * 17 });
    }
  }
}
// (ROADMAP 11.32) what stands over the avenues either side of the Galleria's middle block - its
// arcades, the length of the block (world/mainland/megamall.js): nothing tall stands under them on
// the sidewalks
export const M_SPANS = (() => {
  const b = M_BLOCKS.find((q) => q.kind === 'galleria');
  if (!b) return [];
  const z0 = b.rect.z0 + 1;
  const z1 = b.rect.z1 - 1;
  return [{ x0: b.rect.x0 - 24, x1: b.rect.x0, z0, z1 }, { x0: b.rect.x1, x1: b.rect.x1 + 24, z0, z1 }];
})();
export const underSpan = (x, z, m = 0) => M_SPANS.some((s) => x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m);

export function mBlockAt(x, z) {
  const col = colOf(x);
  const row = rowOf(z);
  if (col < 0 || row < 0) return null;
  for (const b of M_BLOCKS) if (b.col === col && b.row === row) return x >= b.rect.x0 && x <= b.rect.x1 && z >= b.rect.z0 && z <= b.rect.z1 ? b : null;
  return null;
}
// which column / row of blocks x / z is in (-1 outside)
function colOf(x) {
  for (let i = 0; i + 1 < M_AVES.length; i++) if (x <= M_AVES[i].x && x > M_AVES[i + 1].x) return i;
  return -1;
}
function rowOf(z) {
  for (let j = 0; j + 1 < M_STREETS.length; j++) if (z >= M_STREETS[j].z && z < M_STREETS[j + 1].z) return j;
  return -1;
}

// ------------------------------------------------------------------ the places
// the places the city is known for: where they are (their block), what they are
export const PLACES = [
  { id: 'marina', kind: 'mall', name: 'Marina Market', heb: 'מרינה מרקט', at: [-668, -330] },
  // (mega: the giant one, world/mainland/megamall.js - the map shows it big, at any zoom; at its dome,
  // in the middle of its three blocks)
  { id: 'galleria', kind: 'mall', mega: true, name: 'Downtown Galleria', heb: 'הגלריה של דאונטאון', block: '1,8', at: [-835, -37] },
  { id: 'lanes', kind: 'mall', name: 'Via Inkwell', heb: 'ויה אינקוול — הסמטאות של הגלריה', block: '1,9', at: [-835, 97] },
  { id: 'starlight', kind: 'mall', name: 'Starlight Center', heb: 'מרכז סטארלייט', block: '6,3' },
  { id: 'valleyplaza', kind: 'mall', name: 'Valley Plaza', heb: 'ואלי פלאזה', block: '9,9' },
  { id: 'neonink', kind: 'club', name: 'NEON INK', heb: 'מועדון ניאון אינק', block: '2,3' },
  { id: 'velvet', kind: 'club', name: 'BLUE VELVET', heb: 'מועדון בלו ולווט', block: '7,2' },
  { id: 'plume', kind: 'gourmet', name: 'Maison Plume', heb: 'מזון פלום', block: '1,10' },
  { id: 'arena', kind: 'arena', name: 'Bayfront Arena', heb: 'ארנת המפרץ', block: '0,7' },
  { id: 'palace', kind: 'theatre', name: 'Inkwood Palace', heb: 'תיאטרון אינקווד פאלאס', block: '9,3' },
  // (ROADMAP 12.7: the hall on the block's east part, its doors on the avenue - world/mainland/halls.js)
  { id: 'arcade', kind: 'arcade', name: 'INK ARCADE', heb: 'ארקייד INK ARCADE', at: [-1346, -991] },
  { id: 'sign', kind: 'landmark', name: 'INKWOOD', heb: 'השלט על הגבעה', at: [-1330, -1300] },
  { id: 'observatory', kind: 'landmark', name: 'Inkwood Observatory', heb: 'מצפה הכוכבים', at: [-1160, -1300] },
  { id: 'lighthouse', kind: 'landmark', name: 'Point Lighthouse', heb: 'המגדלור של הלשון', at: [-760, 690] },
  { id: 'pier', kind: 'landmark', name: 'Palisade Pier', heb: 'המזח של פליסייד', at: [-1430, 700] },
  { id: 'pointpark', kind: 'park', name: 'South Point Park', heb: 'פארק הלשון', at: [-810, 500] },
];
export function placeBlock(p) {
  if (!p.block) return null;
  const [c, r] = p.block.split(',').map(Number);
  return M_BLOCKS.find((b) => b.col === c && b.row === r) || null;
}

// ------------------------------------------------------------------ the ground
// the hills rise north of Hillside Drive and west of Palm Avenue (their crest the city's edge)
export function hillsHeight(x, z) {
  let h = 0;
  const n = -1212 - z;
  if (n > 0) h = Math.max(h, (1 - Math.exp(-n / 38)) * (70 + 18 * Math.sin(x * 0.011) + 9 * Math.sin(x * 0.031 + 1.7)));
  const w = -1884 - x;
  if (w > 0) h = Math.max(h, (1 - Math.exp(-w / 30)) * (55 + 14 * Math.sin(z * 0.013 + 0.4) + 8 * Math.sin(z * 0.041)));
  return h;
}

// on the mainland at all (and not the bay or the island)?
export function inMainland(x, z) {
  return x < SHORE_X + 2 && x > WEST_X - 200 && z > NORTH_Z - 200 && z < SEA_Z + 200;
}

// the avenue / street the point is on (the asphalt), or null
function aveIndex(x) {
  // (the avenues are 90 m apart west of the bayfront)
  const k = Math.round((AVE_X[0] - x) / 90);
  if (k < 0 || k >= AVE_X.length) return -1;
  return k;
}
function streetIndex(z) {
  const k = Math.round((z - STREET_Z[0]) / 136);
  if (k < 0) return -1;
  if (k >= STREET_Z.length - 1) return Math.abs(z - STREET_Z[STREET_Z.length - 1]) < Math.abs(z - STREET_Z[STREET_Z.length - 2]) ? STREET_Z.length - 1 : STREET_Z.length - 2;
  return k;
}
export function mRoadAt(x, z) {
  const i = aveIndex(x);
  if (i >= 0) {
    const a = M_AVES[i];
    if (Math.abs(x - a.x) < a.half && z > a.z0 - M_STREETS[0].half && z < a.z1 + 9) return { ave: a };
  }
  const j = streetIndex(z);
  if (j >= 0) {
    const s = M_STREETS[j];
    if (Math.abs(z - s.z) < s.half && x > s.x0 - 7 && x < s.x1 + (s.x1 === SHORE_X ? 4 : 10)) return { street: s };
  }
  for (const c of CAUSEWAYS) if (Math.abs(z - c.z) < c.half && x >= c.x0 && x <= c.x1) return { causeway: c };
  return null;
}
export function mOnRoad(x, z) {
  return mRoadAt(x, z) !== null;
}

// ------------------------------------------------------------------ the landmarks on the water
// Palisade Pier, off the end of Western Avenue into the ocean the way Santa Monica's goes out from
// Colorado: a walk of planks high over the sand (a ramp up to it from the boardwalk), the
// carousel's plaza by its start, the amusement park on its wide part out over the water (the big
// wheel, the coaster), and its head at the end for the fishermen. world/mainland/landmarks.js
export const PIER_M = {
  x: -1420,
  deck: 1.4,
  // (the ramp: from the boardwalk's sidewalk up to the deck)
  ramp: [551, 567],
  // the walk (its shops along the east rail), the carousel's plaza, the amusement park, the head
  parts: [
    { x0: -1430, x1: -1402, z0: 551, z1: 806 },
    { x0: -1454, x1: -1430, z0: 571, z1: 603 },
    { x0: -1480, x1: -1430, z0: 628, z1: 728 },
    { x0: -1446, x1: -1394, z0: 774, z1: 808 },
  ],
};
// The Point's jetty: a path on a wall of rocks from the beach out to the lighthouse on its round
// foot at the end
export const JETTY = { x: -760, half: 2.2, z0: 556, z1: 684, top: 1.3, light: [-760, 690], r: 7.5, foot: 1.45 };

// The Marina Market's docks, out into the bay from the sea wall where the Venetian comes ashore: a
// dock along the wall, fingers out from it, the boats in the slips between them
export const MARINA = (() => {
  const z0 = -362;
  const z1 = -296;
  const fingers = [-350, -338, -326, -314];
  const docks = [{ x0: SHORE_X, x1: SHORE_X + 5, z0: z0 + 1, z1: z1 - 1 }];
  for (const zf of fingers) docks.push({ x0: SHORE_X + 5, x1: SHORE_X + 25, z0: zf - 1, z1: zf + 1 });
  const slips = [];
  for (let i = 0; i + 1 < fingers.length; i++) for (const dz of [3.8, 8.2]) slips.push([SHORE_X + 15, fingers[i] + dz]);
  return { z0, z1, deck: CURB + 0.3, docks, slips };
})();

export function onPier(x, z) {
  for (const r of PIER_M.parts) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  return false;
}
// the height of the pier's deck or the jetty's path at (x, z) (null off them)
export function pierHeight(x, z) {
  if (z >= PIER_M.ramp[0] - 0.01 && onPier(x, z)) {
    const [r0, r1] = PIER_M.ramp;
    if (z < r1) return CURB + ((PIER_M.deck - CURB) * (z - r0)) / (r1 - r0);
    return PIER_M.deck;
  }
  const J = JETTY;
  if (z > J.z0 && z < J.z1 + 1 && Math.abs(x - J.x) < J.half) return CURB + ((J.top - CURB) * Math.min(1, (z - J.z0) / 14));
  const d = Math.hypot(x - J.light[0], z - J.light[1]);
  if (d < J.r) return J.foot;
  if (x > SHORE_X - 0.5 && z > MARINA.z0 && z < MARINA.z1) for (const r of MARINA.docks) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return MARINA.deck;
  return null;
}

// the walkable ground of the mainland and the bay (the island's is world/layout.js's own)
export function mainlandHeight(x, z) {
  // the causeways over the bay
  for (let k = 0; k < CAUSEWAYS.length; k++) {
    const c = CAUSEWAYS[k];
    if (Math.abs(z - c.z) < c.half + 1.2 && x >= c.x0 - 2 && x <= c.x1 + 26) return deckY(c, x) + (Math.abs(z - c.z) < c.half ? 0 : CURB);
  }
  // the pier and the jetty over the sea, the marina's docks over the bay
  if (z > BEACH_Z - 1.5 || (x > SHORE_X - 0.5 && z > MARINA.z0 && z < MARINA.z1)) {
    const ph = pierHeight(x, z);
    if (ph !== null) return ph;
  }
  // the bay
  if (x > SHORE_X) return -0.8;
  if (z > BEACH_Z) {
    if (z > SEA_Z) return -0.8;
    return CURB - ((CURB + 0.8) * (z - BEACH_Z)) / (SEA_Z - BEACH_Z);
  }
  if (mOnRoad(x, z)) return 0;
  const h = hillsHeight(x, z);
  return h > CURB ? h : CURB;
}

export function mDistrictName(x, z) {
  const d = districtOf(x, z);
  if (z > BEACH_Z && d) return 'החוף';
  if (x > SHORE_X - 45 && x <= SHORE_X && z < BEACH_Z) return 'חזית המפרץ';
  for (const c of CAUSEWAYS) if (Math.abs(z - c.z) < 20 && x > SHORE_X && x < ISLAND_X) return c.name;
  const r = mRoadAt(x, z);
  if (r && r.ave) return r.ave.name;
  if (r && r.street) return r.street.name;
  return d ? d.name : '';
}

export { DISTRICT_BY_ID };

// ------------------------------------------------------------------ the towers
// where a block of towers has them (downtown's tallest in the middle of it, by the bay; Brickton's
// a little lower; the condos lower still): [{ x, z, w, d, h, style, podium }] standing on the block
const TOWER_KINDS = { towers: 1, offices: 1, condos: 1, dining: 1 };
export function towersOf(b) {
  if (!TOWER_KINDS[b.kind]) return [];
  const r = seeded(b.seed * 7 + 3);
  r();
  const R = b.rect;
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const out = [];
  // (how tall: downtown peaks round Flagler and Sunset by the bay, and falls away to the west)
  const peak = b.district === 'downtown' ? 1 - Math.min(1, Math.abs(b.cz + 200) / 420) : b.district === 'brickton' ? 0.55 - Math.min(0.4, Math.abs(b.cz - 200) / 600) : 0.2;
  const bay = 1 - Math.min(1, (SHORE_X - b.cx) / 420);
  const tall = (lo, hi) => lo + (hi - lo) * Math.min(1, Math.max(0, peak * 0.75 + bay * 0.35 + (r() - 0.5) * 0.35));
  const styles = ['cut', 'cut', 'rect', 'round', 'deco', 'slant'];
  if (b.kind === 'dining') {
    // one tower over the restaurants' low building, at its north end
    out.push({ x: (R.x0 + R.x1) / 2, z: R.z0 + 20, w: 26, d: 24, h: tall(70, 150), style: 'cut', podium: false });
    return out;
  }
  const n = b.kind === 'condos' ? (r() < 0.5 ? 1 : 2) : 2;
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : k === 0 ? 0.27 : 0.73;
    const w = Math.min(W - 18, 22 + r() * 12);
    const d = Math.min(D / n - 12, w * (0.8 + r() * 0.5));
    const h = b.kind === 'condos' ? tall(45, 120) : b.kind === 'offices' ? tall(55, 140) : tall(80, 250);
    out.push({ x: R.x0 + W / 2 + (r() - 0.5) * (W - w - 16) * 0.6, z: R.z0 + D * t, w, d, h, style: r.pick ? r.pick(styles) : styles[0], podium: true });
  }
  return out;
}
