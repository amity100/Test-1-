import { hex } from '../render/materials.js';
import { Facade } from './kit.js';
import { decoBuilding, adQuad, roofBoard } from './deco.js';
import { oceanHotel } from './hotels.js';
import { shopStrip, apartments, mimo, modern, garage, parkingLot, vacantLot, postOffice, diner, museum, condo, house, shifted } from './kits.js';
import { rowYards } from './yards.js';
import { seeded } from './kit.js';
import { rooftopName } from './blocks.js';
import { AD_IDS } from './ads.js';
import { CURB } from './layout.js';

// (v5, ROADMAP 11.2) The avenues behind Ocean Drive, a lot at a time, the way South Beach was
// built: a block's side is cut into lots of 25 and 50 feet, and a building takes one, two or
// three of them. Each avenue has its own mix: Washington Avenue is the main street (one-floor
// rows of shops, two- and three-floor Deco buildings with a shop under the flats, a small hotel,
// a new building of glass, the parking garage, a parking lot, an empty lot behind its fence);
// Collins Avenue is hotels (Deco, streamlined, Miami Modern) with shops between them; Meridian
// Avenue is where people live (garden apartments round their courtyards, a Mediterranean villa, a
// corner store). No two neighbours are the same building; the corners turn onto the cross streets.

const HALF = 7.6; // half a lot: 25 feet
const OPEN = new Set(['lot', 'vacant']);
const LANDMARKS = new Set(['post', 'diner', 'museum']);

// what each building takes (in half lots), whether it may stand on a corner, at most one a row
const KIT = {
  strip: { hw: [2, 3, 4], corner: true },
  deco: { hw: [2, 3], corner: true },
  narrow: { hw: [1], corner: false },
  hotel: { hw: [2, 3], corner: true },
  tall: { hw: [3, 4], corner: true, once: true },
  med: { hw: [2, 3], corner: true },
  mimo: { hw: [2, 3, 4], corner: true },
  modern: { hw: [2, 3, 4], corner: true },
  garage: { hw: [4, 5], corner: true, once: true },
  lot: { hw: [2, 3], corner: false, once: true },
  vacant: { hw: [1, 2], corner: false, once: true },
  apt: { hw: [2, 3], corner: true },
  aptU: { hw: [3, 4], corner: true },
  post: { hw: [4], corner: true, once: true },
  // (v5, ROADMAP 11.2ב: the landmarks of Washington Avenue, world/kits.js)
  diner: { hw: [3], corner: true, once: true },
  museum: { hw: [4], corner: true, once: true },
  // (v5, ROADMAP 11.2ג: a tower of flats standing up out of the low street; a house of its own)
  condo: { hw: [3, 4], corner: true, once: true },
  house: { hw: [2, 3], corner: true },
};

// how often each turns up on each avenue
// (ROADMAP 11.2: about half Deco, a fifth Miami Modern, a fifth Spanish, the rest new and open)
// (v5, ROADMAP 11.2ג: and now and then a tower of flats over them all; houses where people live)
const MIX = {
  washington: { strip: 4, deco: 3, narrow: 1.2, hotel: 1.1, med: 1.4, mimo: 1.4, modern: 1.0, garage: 0.45, lot: 0.9, vacant: 0.35, condo: 0.45 },
  collins: { hotel: 3.2, mimo: 3.0, strip: 1.3, deco: 1.2, modern: 1.1, med: 0.9, garage: 0.4, lot: 0.5, narrow: 0.4, condo: 1.3 },
  meridian: { apt: 3, aptU: 2.4, med: 1.8, mimo: 1.9, deco: 1.4, strip: 0.8, lot: 0.4, vacant: 0.35, condo: 1.2, house: 1.6 },
  west: { apt: 2.2, aptU: 1.4, med: 1.6, mimo: 1.2, deco: 0.8, vacant: 0.3, condo: 2.0, house: 5.0 },
};
// (where people live, the shops are on the corners)
const CORNER_ONLY = { meridian: ['deco', 'strip'], west: ['deco'] };

// ------------------------------------------------------------------ colours and names
// the commercial streets: the first boulevard's pastels and their cousins, a white now and then,
// and now and then a dark front (a tattoo parlour, a bar)
const C_WALLS = ['#fa9e9e', '#85dbcc', '#ffdb7a', '#f5f2f5', '#ffb88f', '#ccb8f2', '#9ed1f2', '#fa8c7a', '#c7eb8c', '#e6b3eb', '#fae8c7', '#73d1db', '#ffc7d1'];
const C_TRIMS = ['#ffffff', '#2fa8a0', '#e8664f', '#5a7fd6', '#f0728f', '#8a6ad8', '#e0b23a', '#3a3a44', '#7fd6d0'];
const DARK_WALLS = ['#2f3a45', '#6e2f3c', '#2f6f6a', '#3b2f4a'];
const BRIGHT_TRIMS = ['#ff3fa4', '#3fe8ff', '#ffe14f', '#ffffff', '#ff6a3f'];
// where people live: the same pastels, a little softer
const R_WALLS = ['#fbb1b1', '#9fe2d6', '#ffe08f', '#ffc6a3', '#d6c6f4', '#b3dbf4', '#fba597', '#d2efa0', '#ebc2ef', '#fbedd2', '#8fd9e1', '#ffd2da'];
const R_TRIMS = ['#ffffff', '#2fa8a0', '#e85a8a', '#5a7fd6', '#d9895a', '#7b55c9', '#3cb8a2', '#f2c94c'];
const R_ACCS = ['#2fa8a0', '#e8664f', '#5a7fd6', '#f0728f', '#e0b23a', '#7b55c9', '#3cb8a2', '#f08a3c'];
const NEONS = ['#ff3fa4', '#3fe8ff', '#ffb43f', '#ff5ad1', '#9b6bff', '#5aff8a', '#ff6a3f', '#ffe14f', '#4f9dff', '#ff4f6a'];
const AWNINGS = ['#2eb8b8', '#fa7390', '#7352b8', '#4cbf99', '#f24d66', '#4d80e6', '#fa9940', '#fad14d', '#d959bf', '#2f3a45'];
const BOX_COLS = ['#16141c', '#1e2a3a', '#2a1a2a', '#f4f1ea'];
// the small hotels of the inland streets: the boulevard's stronger pastels, a white trim
const HOTEL_PALS_IN = [
  { wall: '#fa9e9e', acc: '#ffffff', acc2: '#2fa8a0', neon: '#3fe8ff' },
  { wall: '#85dbcc', acc: '#ffffff', acc2: '#f0728f', neon: '#ff5ad1' },
  { wall: '#ffdb7a', acc: '#2a9fb0', acc2: '#ffffff', neon: '#ff6a3f' },
  { wall: '#ccb8f2', acc: '#7b55c9', acc2: '#ffffff', neon: '#9b6bff' },
  { wall: '#9ed1f2', acc: '#3a5fb8', acc2: '#ffffff', neon: '#4f9dff' },
  { wall: '#ffb88f', acc: '#e8664f', acc2: '#fff4e6', neon: '#ffb43f' },
  { wall: '#ffc7d1', acc: '#e85a8a', acc2: '#7fd6d0', neon: '#ff3fa4' },
  { wall: '#73d1db', acc: '#ffffff', acc2: '#f38aa2', neon: '#3fe8ff' },
  { wall: '#c7eb8c', acc: '#3cb8a2', acc2: '#ffffff', neon: '#5aff8a' },
  { wall: '#f7f4ee', acc: '#33b8b4', acc2: '#f5a3b5', neon: '#3fe8ff' },
];
// the Spanish ones inland: warm stucco in the colours of the street (apricot, salmon, ochre,
// dusty rose, sage), red tiles, dark iron
const MED_PALS_IN = [
  { wall: '#f4b183', acc: '#a8553a', acc2: '#3f6b4f', neon: '#ffb43f' },
  { wall: '#f6bfa0', acc: '#9a4a32', acc2: '#2f4f6f', neon: '#ff6a3f' },
  { wall: '#f9d77e', acc: '#b65a3c', acc2: '#4f7f5f', neon: '#ffe14f' },
  { wall: '#eaa3a3', acc: '#8a3a2a', acc2: '#2f5f4f', neon: '#ff3fa4' },
  { wall: '#c9e3c0', acc: '#a8553a', acc2: '#2f4f6f', neon: '#5aff8a' },
];
// Miami Modern: white, and one bold colour with its pale cousin
const MIMO_PALS = [
  { wall: '#f6f4ef', acc: '#25a6a6', acc2: '#bfe9e6', neon: '#3fe8ff' },
  { wall: '#ffd2b0', acc: '#f0782c', acc2: '#fff1e2', neon: '#ffb43f' },
  { wall: '#d6efbd', acc: '#5aa83a', acc2: '#f4fbe9', neon: '#5aff8a' },
  { wall: '#ffc4d6', acc: '#e84a8a', acc2: '#fff0f5', neon: '#ff5ad1' },
  { wall: '#c2dbf6', acc: '#2f62b8', acc2: '#eef5fd', neon: '#4f9dff' },
  { wall: '#fff0b8', acc: '#e09a20', acc2: '#fffbe8', neon: '#ffe14f' },
  { wall: '#f6f4ef', acc: '#e85a5a', acc2: '#f6c4c4', neon: '#ff6a3f' },
  { wall: '#b8ece6', acc: '#ff6a8a', acc2: '#effcfa', neon: '#ff3fa4' },
];
// the new buildings: white or grey or dark frames, fins of wood or white, a dark band
const MODERN_PALS = [
  { frame: '#f2f2ef', fin: '#b08560', band: '#22262d' },
  { frame: '#e6e8ea', fin: '#ffffff', band: '#2d3440' },
  { frame: '#3a3e46', fin: '#c9a46a', band: '#15171b' },
  { frame: '#f5f3ee', fin: '#7fa9b8', band: '#1f2a33' },
  { frame: '#d9d4cb', fin: '#8a6a4a', band: '#262626' },
];
const CONC = ['#cfccc5', '#bdb9b1', '#d8d3c8', '#c7c9cc'];
const STRIPES = ['#2f6fd0', '#e2a33a', '#d0453a', '#3aa06a', '#8a5ad0'];
const PRICES = ['$20 ALL DAY', '$5 FIRST HOUR', 'PARK $10', 'EVENTS $25'];

// the towers of flats: white or a pale stucco, a colour up the shaft of their stairs
const CONDO_PALS = [
  { wall: '#f4f2ec', acc: '#2fa8a0', neon: '#3fe8ff' },
  { wall: '#eef2f4', acc: '#5a7fd6', neon: '#4f9dff' },
  { wall: '#f6e7d2', acc: '#d9895a', neon: '#ffb43f' },
  { wall: '#fde9e4', acc: '#e85a8a', neon: '#ff5ad1' },
  { wall: '#e8f3ea', acc: '#3cb8a2', neon: '#5aff8a' },
  { wall: '#f2f2ef', acc: '#8a8f99', neon: '#ffffff' },
  { wall: '#fff3cf', acc: '#e0a020', neon: '#ffe14f' },
];
const CONDO_NAMES = ['Bayview Tower', 'Coral Crest', 'The Palm Crest', 'Seabreeze', 'Harbor Light', 'The Isles', 'Sunrise Tower', 'Bay Terrace', 'Aqua Vista', 'The Tropicana', 'Sandpiper', 'Blue Heron'];
const HOUSE_TRIMS = ['#ffffff', '#fff6e6', '#f2efe8', '#fbf1dc'];

const INLAND_HOTELS = ['Hotel Albatross', 'The Seahorse', 'Hotel Bermuda', 'Hotel Coquina', 'The Lagoon', 'Hotel Starlite', 'Hotel Mariposa', 'The Sea Grape', 'The Wavecrest', 'Hotel Cabana', 'Hotel Bimini', 'The Coral Reef', 'Hotel Laguna', 'The Sunbeam', 'Hotel Capri', 'The Pink Flamingo'];
const MIMO_NAMES = ['Sahara', 'Casablanca', 'Sea Isle', 'Golden Sands', 'Thunderbird', 'Castaway', 'Monte Carlo', 'Starliner', 'Bel Air', 'Satellite'];
const MED_NAMES = ['Villa Rosa', 'Casa Grande', 'Hotel Granada', 'The Alhambra', 'Casa Linda', 'Villa Paradiso', 'Hotel Sevilla', 'Casa Del Sol'];
const APT_NAMES = ['The Palms', 'Flamingo Arms', 'Bay Manor', 'Coral Court', 'The Granada', 'Ocean Terrace', 'Bel Aire', 'The Sorrento', 'Lido Court', 'The Carlton', 'Seville Court', 'Pelican Arms', 'The Shoreham', 'Sunset Court', 'The Normandy', 'Tropic Arms', 'Magnolia Court'];

const FONTS = ['Caveat', 'Permanent Marker', 'Rubik', 'Caveat'];
// a name keeps its letters wherever it is written (one place in the neon's texture for it)
function hashOf(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const fontFor = (name) => FONTS[hashOf(name) % FONTS.length];
const scriptFor = (name) => (hashOf(name) % 2 ? 'Caveat' : 'Permanent Marker');

// one of a list, not the one the neighbour has
function pickNot(r, list, not) {
  const ok = list.filter((x) => x !== not);
  return r.pick(ok.length ? ok : list);
}

// the next name of a list (each list goes round in its own order)
function nextName(ctx, key, list) {
  const S = (ctx.sobeNames = ctx.sobeNames || {});
  if (!S[key]) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    S[key] = { a, n: 0 };
  }
  const s = S[key];
  return s.a[s.n++ % s.a.length];
}

// what a shop is (the arcade, where the row has to have it, comes first)
function takeKind(ctx, env) {
  if (env.arcade && !env.arcadeDone) {
    env.arcadeDone = true;
    return 'arcade';
  }
  return ctx.kindDeck();
}

// ------------------------------------------------------------------ the plan of a row
function mixFor(o) {
  const m = { ...MIX[o.street] };
  if (o.type === 'hotels' && o.street === 'collins') m.tall = 1.5;
  if (o.type === 'gang') {
    m.vacant = (m.vacant || 0.3) * 4;
    m.lot = (m.lot || 0.4) * 1.8;
    if (m.hotel) m.hotel *= 0.3;
    if (m.modern) m.modern *= 0.3;
  }
  if (o.type === 'towers') {
    m.modern = (m.modern || 1) * 2.5;
    m.garage = (m.garage || 0.5) * 2;
  }
  if (o.D < 15) {
    delete m.aptU;
    delete m.garage;
    delete m.tall;
    delete m.condo;
    delete m.house;
  }
  // (the towers' block has its own towers; the rows on a square, a market, keep their low fronts)
  if (o.type === 'towers' || o.type === 'plaza' || o.type === 'market') delete m.condo;
  return m;
}

// (v5, ROADMAP 11.2ג) a house may have a house for a neighbour: a street of them is what it is
const SAME_OK = new Set(['house']);

function planRow(r, n, o) {
  const mix = mixFor(o);
  const kinds = Object.keys(mix).filter((k) => mix[k] > 0);
  const cornerOnly = CORNER_ONLY[o.street] || [];
  const pick = (ok) => {
    let sum = 0;
    for (const k of kinds) if (ok(k)) sum += mix[k];
    if (sum <= 0) return null;
    let t = r() * sum;
    let last = null;
    for (const k of kinds) {
      if (!ok(k)) continue;
      last = k;
      t -= mix[k];
      if (t <= 0) return k;
    }
    return last;
  };
  const cornerOk = (k) => KIT[k].corner;
  const north = o.diner ? 'diner' : o.north || pick(cornerOk);
  const south = o.post ? 'post' : o.museum ? 'museum' : pick((k) => cornerOk(k) && k !== north && !(KIT[k].once && k === north));
  const out = [{ kind: north, w: r.pick(KIT[north].hw) }];
  const last = { kind: south, w: r.pick(KIT[south].hw) };
  const used = new Set([north, south]);
  let left = n - out[0].w - last.w;
  let prev = north;
  while (left > 0) {
    // (half a lot left over: mostly the last building takes it, now and then it stays empty)
    if (left === 1 && r() < 0.7) {
      out[out.length - 1].w += 1;
      break;
    }
    const ok = (k) => (k !== prev || SAME_OK.has(k)) && !cornerOnly.includes(k) && !(KIT[k].once && used.has(k)) && KIT[k].hw[0] <= left;
    let k = pick(ok);
    if (!k) {
      out[out.length - 1].w += left;
      break;
    }
    let w = r.pick(KIT[k].hw.filter((x) => x <= left));
    // (the last one before the corner is not the corner's own kind)
    if (w === left && k === south) {
      const k2 = pick((q) => ok(q) && q !== south && KIT[q].hw[0] <= left);
      if (k2) {
        k = k2;
        const fit = KIT[k2].hw.filter((x) => x <= left);
        w = fit.includes(left) ? left : r.pick(fit);
      }
    }
    out.push({ kind: k, w });
    used.add(k);
    prev = k;
    left -= w;
  }
  out.push(last);
  // no two the same side by side: the one in the middle takes another kind that fits its lot
  for (let i = 1; i < out.length; i++) {
    if (out[i].kind !== out[i - 1].kind || SAME_OK.has(out[i].kind)) continue;
    const j = i === out.length - 1 ? i - 1 : i;
    if (j === 0 || LANDMARKS.has(out[j].kind)) continue;
    const a = out[j - 1] ? out[j - 1].kind : null;
    const b = out[j + 1] ? out[j + 1].kind : null;
    const k = pick((q) => q !== a && q !== b && !cornerOnly.includes(q) && !(KIT[q].once && out.some((x) => x.kind === q)) && KIT[q].hw[0] <= out[j].w);
    if (k) out[j].kind = k;
  }
  // (the arcade's row has a row of shops, or a shop under flats, to have it in; not a landmark's lot)
  if (o.arcade && !out.some((x) => x.kind === 'strip' || x.kind === 'deco')) {
    const i = out.findIndex((x) => !LANDMARKS.has(x.kind));
    if (i >= 0) out[i].kind = 'strip';
  }
  return out;
}

// ------------------------------------------------------------------ the buildings
// a: { f, L, D, sides (fronts round the ends), corner (the ends on a cross street), lot, env }
const BUILD = {
  // a row of shops of one floor
  strip(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, sides, env } = a;
    const dark = r() < (env.type === 'gang' ? 0.3 : 0.12);
    const wallHex = dark ? r.pick(DARK_WALLS) : pickNot(r, C_WALLS, env.prevWall);
    const trimHex = dark ? r.pick(BRIGHT_TRIMS) : pickNot(r, C_TRIMS, wallHex);
    const n = Math.max(1, Math.min(5, Math.round(L / r.range(6.5, 9))));
    const shops = [];
    for (let k = 0; k < n; k++) {
      const kind = takeKind(ctx, env);
      const name = ctx.nameFor(kind);
      shops.push({
        kind,
        name,
        signCol: r.pick(NEONS),
        font: fontFor(name),
        awning: r.pick(['canvas', 'canvas', 'box', 'barrel', 'none']),
        awCol: hex(r.pick(AWNINGS)),
        sign: r() < 0.55 ? 'neon' : 'box',
        boxCol: hex(r.pick(BOX_COLS)),
        // (in the gangs' blocks some of them are closed for good)
        shutter: env.type === 'gang' && n > 1 && k > 0 && kind !== 'arcade' && r() < 0.35,
        w: r.range(0.8, 1.25),
      });
    }
    a.lot.wall = wallHex;
    const info = shopStrip(ctx, { f, L, D, pal: { wall: hex(wallHex), trim: hex(trimHex) }, parapet: r.pick(['flat', 'stepped', 'pylons', 'bands']), shops, sides, back: env.back, ad: r() < 0.6 ? r.pick(AD_IDS) : null });
    // now and then a billboard on the roof, over the avenue
    if (L >= 15 && r() < 0.25) roofBoard(ctx, f, L, info.top, r.pick(AD_IDS));
    return info;
  },

  // two to four floors of Deco over a shop (the boulevard's own building)
  deco(ctx, a, narrow = false) {
    const r = ctx.rng;
    const { f, L, D, sides, env } = a;
    const floors = narrow ? r.int(2, 3) : env.street === 'collins' ? r.int(3, 4) : r.int(2, 4);
    const kind = takeKind(ctx, env);
    const name = ctx.nameFor(kind);
    const wallHex = pickNot(r, env.street === 'meridian' || env.street === 'west' ? R_WALLS : C_WALLS, env.prevWall);
    a.lot.wall = wallHex;
    const info = decoBuilding(ctx, {
      f, L, D, floors, color: hex(wallHex), trim: hex(pickNot(r, C_TRIMS, wallHex)), signCol: r.pick(NEONS), sign: name, signFont: fontFor(name),
      awning: hex(r.pick(AWNINGS)), fin: !narrow && L >= 12 && r() < 0.55, shop: { kind, name }, sides, back: env.back !== false, eyebrow: true, narrow,
    });
    if (!narrow && L >= 15 && floors <= 3 && r() < 0.2) roofBoard(ctx, f, L, info.top, r.pick(AD_IDS));
    return info;
  },

  narrow(ctx, a) {
    return BUILD.deco(ctx, a, true);
  },

  // a small hotel of the thirties (Deco, or streamlined round its corner), or a tall one
  hotel(ctx, a, tall = false) {
    const r = ctx.rng;
    const { f, L, D, corner, env } = a;
    const style = r.pick(['deco', 'deco', 'streamline', 'streamline', 'deco']);
    const floors = tall ? r.int(7, 10) : r() < 0.5 ? 3 : r() < 0.7 ? 4 : 5;
    const name = nextName(ctx, 'hotel', INLAND_HOTELS);
    const pals = HOTEL_PALS_IN.filter((p) => p.wall !== env.prevWall);
    const pal = r.pick(pals.length ? pals : HOTEL_PALS_IN);
    const rr = (corner.a || corner.b) && (style === 'streamline' || r() < 0.7) ? Math.min(r.range(3.2, 4.8), L / 3.4) : 0;
    a.lot.rr = rr;
    a.lot.wall = pal.wall;
    const info = oceanHotel(ctx, {
      f, L, D, floors, style, name, kind: 'lobby', hotel: true, pal, font: fontFor(name), shop: { kind: 'lobby', name },
      balcony: tall ? r() < 0.7 : floors >= 4 && r() < 0.3, rA: corner.a ? rr : 0, rB: corner.b ? rr : 0, cornerA: corner.a, cornerB: corner.b, back: env.back,
    });
    if (tall && style === 'streamline') rooftopName(ctx, f, L, info.top + 1.4, name, pal.neon);
    return info;
  },

  tall(ctx, a) {
    return BUILD.hotel(ctx, a, true);
  },

  // the older ones, Spanish: arches, red tiles, dark iron (a shop under them on the main streets,
  // a little hotel where people live)
  med(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, corner, env } = a;
    const pals = MED_PALS_IN.filter((p) => p.wall !== env.prevWall);
    const pal = r.pick(pals.length ? pals : MED_PALS_IN);
    const home = env.street === 'meridian' || env.street === 'west';
    let spec;
    if (home) {
      const name = nextName(ctx, 'med', MED_NAMES);
      spec = { name, kind: 'lobby', hotel: true, shop: { kind: 'lobby', name }, font: fontFor(name) };
    } else {
      const kind = takeKind(ctx, env);
      const name = ctx.nameFor(kind);
      spec = { name, kind, hotel: false, shop: { kind, name }, awning: hex(r.pick(AWNINGS)), font: fontFor(name) };
    }
    a.lot.wall = pal.wall;
    return oceanHotel(ctx, { f, L, D, floors: r.int(2, 3), style: 'med', pal, cornerA: corner.a, cornerB: corner.b, back: env.back, ...spec });
  },

  // Miami Modern
  mimo(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, sides, env } = a;
    const coll = env.street === 'collins';
    const floors = coll ? r.int(4, 6) : r.int(3, 4);
    const name = nextName(ctx, 'mimo', MIMO_NAMES);
    const pals = MIMO_PALS.filter((p) => p.wall !== env.prevWall);
    const pal = r.pick(pals.length ? pals : MIMO_PALS);
    a.lot.wall = pal.wall;
    return mimo(ctx, { f, L, D, floors, pal, name, kind: 'lobby', font: scriptFor(name), variant: r.pick(['catwalk', 'cheese', 'zigzag']), sides, roofName: coll && floors >= 5 && r() < 0.6, back: env.back });
  },

  // glass and white concrete
  modern(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, sides, env } = a;
    const floors = env.type === 'towers' ? r.int(6, 8) : env.street === 'collins' ? r.int(5, 7) : r.int(4, 6);
    const kind = takeKind(ctx, env);
    const name = ctx.nameFor(kind);
    const p = r.pick(MODERN_PALS);
    a.lot.wall = p.frame;
    return modern(ctx, {
      f, L, D, floors, pal: { frame: hex(p.frame), fin: hex(p.fin), band: hex(p.band) }, name, kind, signCol: r.pick(NEONS), font: fontFor(name),
      variant: r.pick(['grid', 'bands', 'fins']), penthouse: floors >= 5 && r() < 0.5, sides, back: env.back,
    });
  },

  // the parking garage (its stairs' tower on the corner, or on the side of an open lot)
  garage(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, sides, corner, env } = a;
    const shops = [];
    if (L >= 26 && env.street !== 'meridian') {
      const kind = takeKind(ctx, env);
      const name = ctx.nameFor(kind);
      shops.push({ kind, name, signCol: r.pick(NEONS), font: fontFor(name) });
    }
    const tower = corner.a ? 'a' : corner.b ? 'b' : sides.a ? 'a' : sides.b ? 'b' : r() < 0.5 ? 'a' : 'b';
    const conc = r.pick(CONC);
    a.lot.wall = conc;
    return garage(ctx, { f, L, D, decks: r.int(3, 5), pal: { conc: hex(conc), stripe: hex(r.pick(STRIPES)) }, shops, tower, sides, back: env.back });
  },

  lot(ctx, a) {
    const r = ctx.rng;
    const { f, L, D } = a;
    a.lot.wall = null;
    return parkingLot(ctx, { f, L, D, edge: r() < 0.55 ? 'wall' : 'hedge', fill: r.range(0.45, 0.85), price: r.pick(PRICES), wallCol: hex(r.pick(['#f2ece0', '#e8dcc4', '#f6c9c0', '#dcd9d3'])), accent: hex(r.pick(STRIPES)) });
  },

  vacant(ctx, a) {
    const { f, L, D } = a;
    a.lot.wall = null;
    return vacantLot(ctx, { f, L, D, sign: ctx.rng() < 0.6 ? 'forsale' : 'soon' });
  },

  // garden apartments
  apt(ctx, a, plan = 'bar') {
    const r = ctx.rng;
    const { f, L, D, sides, env } = a;
    const wallHex = pickNot(r, R_WALLS, env.prevWall);
    a.lot.wall = wallHex;
    const name = r() < 0.75 ? nextName(ctx, 'apt', APT_NAMES) : null;
    // (Deco with its eyebrows, streamlined with its speed lines, or the plain walk-up; never the
    // same as the neighbour)
    const styles = (plan === 'U' ? ['deco', 'streamline'] : ['deco', 'streamline', 'walkup', 'walkup']).filter((x) => x !== env.prevStyle);
    const style = r.pick(styles);
    a.lot.style = style;
    const walk = style === 'walkup';
    const info = apartments(ctx, {
      f, L, D, floors: walk ? 2 : r.int(2, 3), pal: { wall: hex(wallHex), trim: hex(pickNot(r, R_TRIMS, wallHex)), acc: hex(r.pick(R_ACCS)) }, yard: walk ? r.range(3.7, 4.6) : r.range(2.2, 4.4), plan,
      style, name, font: name ? fontFor(name) : 'Rubik', nameCol: '#ffffff', sides, palms: true, back: env.back,
    });
    a.lot.setback = D - info.D;
    return info;
  },

  aptU(ctx, a) {
    return BUILD.apt(ctx, a, 'U');
  },

  // the post office's rotunda on the corner
  post(ctx, a) {
    a.lot.noWall = true;
    a.lot.wall = '#f7eed1';
    return postOffice(ctx, { f: a.f, L: a.L, D: a.D, corner: a.corner.a ? 'a' : 'b' });
  },

  // (v5, ROADMAP 11.2ב) the silver diner on the corner of 11th, its little lot beside it
  diner(ctx, a) {
    a.lot.noWall = true;
    a.lot.wall = '#cfd4dc';
    return diner(ctx, { f: a.f, L: a.L, D: a.D, corner: a.corner.a ? 'a' : 'b', name: 'Silver Star Diner' });
  },

  // the museum's seven floors of stone on the corner of 9th, its carved door
  museum(ctx, a) {
    a.lot.wall = '#ecdcb8';
    return museum(ctx, { f: a.f, L: a.L, D: a.D, corner: a.corner.a ? 'a' : 'b', sides: a.sides, back: a.env.back });
  },

  // (v5, ROADMAP 11.2ג) a tower of flats standing up out of the low street, the bay's the tallest
  condo(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, sides, env } = a;
    const st = env.street;
    const floors = st === 'west' ? r.int(9, 15) : st === 'collins' ? r.int(8, 12) : st === 'washington' ? r.int(6, 8) : r.int(6, 11);
    const name = nextName(ctx, 'condo', CONDO_NAMES);
    const pals = CONDO_PALS.filter((p) => p.wall !== env.prevWall);
    const p = r.pick(pals.length ? pals : CONDO_PALS);
    a.lot.wall = p.wall;
    return condo(ctx, {
      f, L, D, floors, pal: { wall: hex(p.wall), acc: hex(p.acc) }, neon: p.neon, name, font: r.pick(['Rubik', 'Caveat', 'Rubik']),
      rail: r() < 0.65 ? 'glass' : 'bars', variant: r() < 0.6 ? 'ribbon' : 'checker', sides, back: env.back,
    });
  },

  // a house of its own: its garden round it (world/yards.js), the drive down one side
  house(ctx, a) {
    const r = ctx.rng;
    const { f, L, D, env } = a;
    const wallHex = pickNot(r, R_WALLS, env.prevWall);
    a.lot.wall = wallHex;
    // (the deeper lots by the bay keep a garden behind big enough for a pool)
    const front = r.range(4.0, 5.8);
    const depth = Math.max(7.5, Math.min(D - front - 3.2, D >= 21 ? r.range(8.5, 10.5) : r.range(9, 12)));
    const floors = r() < 0.55 ? 1 : 2;
    const info = house(ctx, {
      f, L, floors, front, depth, pal: { wall: hex(wallHex), trim: hex(r.pick(HOUSE_TRIMS)), acc: hex(r.pick(R_ACCS)) }, drive: L >= 12 ? (r() < 0.5 ? 'a' : 'b') : null,
    });
    // (where it stands on its lot is its own: the setbacks below leave a house alone)
    a.lot.front = front;
    a.lot.back = front + depth;
    return info;
  },
};

// ------------------------------------------------------------------ (v5, ROADMAP 11.2ג) the yards
// how far a building stands back from the sidewalk (sb), how deep a yard it keeps behind it on the
// alley (by), and a tower how wide a strip of lawn either side of it (ga at u = 0, gb at u = L):
// the shops stay on the sidewalk, their customers walk in off it; the hotels, the towers and the
// flats where people live stand back behind a forecourt or a garden; most keep a yard behind
const MIN_D = { strip: 11, deco: 12, narrow: 11, hotel: 12, tall: 13, med: 11, mimo: 12, modern: 11, apt: 12.5, condo: 11 };
function yardsFor(r, kind, o, L) {
  const home = o.street === 'meridian' || o.street === 'west';
  const coll = o.street === 'collins';
  const may = (p, a, b) => (r() < p ? r.range(a, b) : 0);
  let sb = 0;
  let by = 0;
  let ga = 0;
  let gb = 0;
  if (kind === 'strip') by = may(home ? 0.7 : 0.55, 3, 7);
  else if (kind === 'deco' || kind === 'narrow') by = may(home ? 0.6 : 0.5, 2.5, 6);
  else if (kind === 'hotel') {
    sb = may(coll ? 0.35 : 0.12, 1.6, 3);
    by = may(0.5, 2.5, 5);
  } else if (kind === 'tall') {
    sb = may(0.6, 1.6, 3.5);
    by = may(0.4, 2.5, 4.5);
  } else if (kind === 'med') {
    sb = home ? may(0.65, 1.8, 4) : 0;
    by = may(home ? 0.65 : 0.5, 2.5, 6);
  } else if (kind === 'mimo') {
    sb = may(home ? 0.55 : 0.45, 2, 4.5);
    by = may(0.5, 2, 5);
  } else if (kind === 'modern') by = may(0.4, 2.5, 5);
  else if (kind === 'apt') by = may(0.65, 2.5, 6);
  else if (kind === 'condo') {
    sb = r.range(3, 5.5);
    by = may(0.75, 1.5, 3.5);
    if (L >= 22) {
      const q = r();
      if (q < 0.5) {
        ga = r.range(2, 3.2);
        gb = r.range(2, 3.2);
      } else if (q < 0.72) ga = r.range(2, 3.2);
      else if (q < 0.94) gb = r.range(2, 3.2);
    }
  }
  // (no yard behind a row whose backs are on a square, a market, the motel's lot, the towers)
  if (o.type === 'plaza' || o.type === 'motel' || o.type === 'towers' || o.type === 'market') by = 0;
  // (deep enough to build in: the yard behind gives way first, then the one in front)
  const minD = MIN_D[kind] || 11;
  let over = sb + by - (o.D - minD);
  if (over > 0) {
    const cut = Math.min(by, over);
    by -= cut;
    over -= cut;
    if (over > 0) sb = Math.max(0, sb - over);
  }
  if (by < 1.6) by = 0;
  if (sb < 1.5) sb = 0;
  return { sb, by, ga, gb };
}

// ------------------------------------------------------------------ a row
/**
 * One side of a block along an avenue, cut into lots and built.
 * o: { x (the fronts' line), z0, z1 (north to south), side (+1: the fronts face east, -1 west), D
 *   (how deep), street ('washington' | 'collins' | 'meridian' | 'west'), type (the block's),
 *   col, row, rowSide ('west' | 'east': which side of its block the row is), back (the backs on an
 *   alley), post (the post office on the south corner), arcade (the arcade is in this row) }
 * returns the lots (north to south), each with its building's info
 */
export function sobeRow(ctx, o) {
  const r = ctx.rng;
  const len = o.z1 - o.z0;
  const n = Math.max(2, Math.round(len / HALF));
  const unit = len / n;
  const plan = planRow(r, n, o);
  let z = o.z0;
  const lots = plan.map((p) => {
    const lot = { kind: p.kind, za: z, zb: z + p.w * unit };
    z = lot.zb;
    return lot;
  });
  lots[lots.length - 1].zb = o.z1;
  lots.forEach((lot, i) => {
    lot.north = i === 0;
    lot.south = i === lots.length - 1;
    // (a building beside an open lot: windows on that side, or a wall for a painted ad)
    lot.winN = i > 0 && OPEN.has(lots[i - 1].kind) && r() < 0.5;
    lot.winS = i < lots.length - 1 && OPEN.has(lots[i + 1].kind) && r() < 0.5;
  });
  const env = { ...o, prevWall: null, arcadeDone: false };
  // (facing east u runs north, its u = 0 the south end; facing west u runs south)
  const aIsNorth = o.side < 0;
  // (v5, ROADMAP 11.2ג) how far back each stands, the yard it keeps (by dice of the row's own, so
  // the buildings are the ones they were)
  const yr = seeded(5501 + (o.col + 2) * 97 + o.row * 13 + (o.rowSide === 'east' ? 7 : 0));
  for (const lot of lots) {
    const y = yardsFor(yr, lot.kind, o, lot.zb - lot.za);
    // (no strip of lawn on a corner's end: the cross street sees the tower's side wall there)
    if (lot.north) y[aIsNorth ? 'ga' : 'gb'] = 0;
    if (lot.south) y[aIsNorth ? 'gb' : 'ga'] = 0;
    lot.sb = y.sb;
    lot.by = y.by;
    lot.gapA = y.ga;
    lot.gapB = y.gb;
    lot.gapN = aIsNorth ? y.ga : y.gb;
    lot.gapS = aIsNorth ? y.gb : y.ga;
  }
  for (const lot of lots) {
    const L = lot.zb - lot.za;
    const f0 = o.side > 0 ? new Facade(o.x, lot.zb, 0, -1, 1, 0) : new Facade(o.x, lot.za, 0, 1, -1, 0);
    // (the building's own front: in from the lot's ends by its strips of lawn, back from the
    // sidewalk by its forecourt)
    let f = f0;
    if (lot.gapA) {
      const p = f0.p(lot.gapA, 0, 0);
      f = new Facade(p[0], p[2], f0.ux, f0.uz, f0.nx, f0.nz);
    }
    if (lot.sb) f = shifted(f, -lot.sb);
    const Lb = L - lot.gapA - lot.gapB;
    const Dk = o.D - lot.sb - lot.by;
    const sN = lot.north || lot.winN || lot.gapN > 0;
    const sS = lot.south || lot.winS || lot.gapS > 0;
    const sides = { a: aIsNorth ? sN : sS, b: aIsNorth ? sS : sN };
    const corner = { a: aIsNorth ? lot.north : lot.south, b: aIsNorth ? lot.south : lot.north };
    lot.f = f0;
    lot.L = L;
    lot.info = BUILD[lot.kind](ctx, { f, L: Lb, D: Dk, sides, corner, lot, env });
    lot.info.z0 = lot.za;
    lot.info.z1 = lot.zb;
    // where the building stands on its lot: how far back its front is, how far back it reaches
    if (lot.front === undefined) lot.front = lot.sb + (lot.setback || 0);
    if (lot.back === undefined) lot.back = OPEN.has(lot.kind) ? 0 : lot.sb + Dk;
    lot.setback = lot.front;
    // (a lobby back behind its forecourt: the people coming out of it walk on to the sidewalk)
    if (lot.info.shop && lot.front > 0.5) lot.info.shop.yard = lot.front;
    env.prevWall = lot.wall;
    env.prevStyle = lot.style || null;
  }
  partyWalls(ctx, lots, o);
  // (v5, ROADMAP 11.2ג) the forecourts, the gardens, the yards behind, their fences, the trees
  rowYards(ctx, lots, { ...o, alley: o.street !== 'west' });
  // (every lot of the city, for the map and the tests)
  ctx.lots = ctx.lots || [];
  for (const lot of lots) ctx.lots.push({ kind: lot.kind, style: lot.style, x: o.x, side: o.side, D: o.D, z0: lot.za, z1: lot.zb, street: o.street, top: lot.info.top, front: lot.front, back: lot.back, use: lot.use || null, gapN: lot.gapN, gapS: lot.gapS });
  // the ends on the cross streets: where their walls are, for the boards (world/streets.js)
  if (ctx.blockEnds && o.rowSide) {
    for (const [lot, end] of [[lots[0], 'north'], [lots[lots.length - 1], 'south']]) {
      const info = lot.info;
      const uEdge = (end === 'north') === aIsNorth ? 0 : lot.L;
      const back = OPEN.has(lot.kind) ? o.D : lot.back;
      const front = (lot.front || 0) + (lot.rr || 0);
      const p0 = lot.f.p(uEdge, 0, -front);
      const p1 = lot.f.p(uEdge, 0, -back);
      ctx.blockEnds[`${o.col},${o.row},${end},${o.rowSide}`] = { x0: Math.min(p0[0], p1[0]), x1: Math.max(p0[0], p1[0]), top: info.top, wall: !lot.noWall && !OPEN.has(lot.kind), kind: lot.kind };
    }
  }
  return lots;
}

// where a building stands taller than its neighbour (or beside an open lot), the bare side wall
// carries a big painted ad, the way the side walls of a real city do
function partyWalls(ctx, lots, o) {
  const r = ctx.rng;
  for (let i = 0; i + 1 < lots.length; i++) {
    const A = lots[i];
    const B = lots[i + 1];
    const ta = A.info.towerTop || A.info.top;
    const tb = B.info.towerTop || B.info.top;
    const tall = ta > tb ? A : B;
    const low = tall === A ? B : A;
    if (tall.kind === 'post' || OPEN.has(tall.kind)) continue;
    // (a tower standing free of its neighbour has windows on that side, not a wall for an ad)
    if ((tall === A ? A.gapS : B.gapN) > 0) continue;
    // (the tall one's side has windows there: no ad over them; a garage's has none)
    if (tall.kind !== 'garage' && ((tall === A && A.winS) || (tall === B && B.winN))) continue;
    const open = OPEN.has(low.kind);
    const lowTop = open ? CURB + 1.4 : Math.max(ta, tb) === ta ? tb + 1.3 : ta + 1.3;
    const free = tall.info.top - lowTop;
    if (free < 6.5 || r() < (open ? 0.15 : 0.35)) continue;
    // the wall's depth: from behind the tall one's yard to its back
    const w0 = (tall.front || 0) + 1.5;
    const w1 = (tall.back || o.D) - 1.5;
    let w = Math.min(w1 - w0, 12);
    let h = w / 2;
    if (h > free - 1.2) {
      h = free - 1.2;
      w = h * 2;
    }
    if (w < 6) continue;
    // (the shared wall is the south end of A, the north end of B)
    const z = A.zb;
    const nz = tall === A ? 1 : -1;
    const ax = o.x - o.side * (w0 + w1) * 0.5;
    adQuad(ctx, ctx.M.adWall, ax, lowTop + 0.6 + h / 2, z + nz * 0.04, 0, nz, w, h, r.pick(AD_IDS));
  }
}
