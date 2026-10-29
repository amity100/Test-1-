import * as THREE from 'three';
import { srgb, setLightOwner, showLights, releaseLights } from '../../render/materials.js';
import { Batch, seeded, nextId } from '../kit.js';
import { BoxList } from '../collision.js';
import { sobeRowSteps } from '../sobe.js';
import { buildRoom } from '../rooms.js';
import { park, plaza, alleyGround, court, bench, fountain } from '../blocks.js';
import { palm } from '../palms.js';
import { SHOP_NAMES } from '../blocks.js';
import { M_AVES, M_STREETS, CURB, towersOf } from './plan.js';
import { buildMall, buildStripMall, STORE_NAMES } from './mall.js';
import { buildMegaMall } from './megamall.js';
import { buildLanes } from './lanes.js';
import { buildVenue } from './venues.js';
import { friendStandIn } from '../streets.js';
import { buildPier } from './pier.js';
import { buildBeach, buildPoint, buildBayfront } from './shore.js';
import { buildArena } from './arena.js';
import { HALL_ROW_D, ARCADE, CASINO } from './halls.js';
import '../shops2.js';
import '../homes2.js';
import '../venues2.js';
import { dressSidewalks } from './sidewalks.js';

// (the malls: what is in each - world/mainland/mall.js)
const MALLS = {
  // (v5, ROADMAP 11.30 - 11.32: the mega mall - three halls of five floors under vaults of glass, on
  // three blocks, the arcades over the avenues between them (each side hall builds the one on its
  // side), the dome over the middle one's court, world/mainland/megamall.js; their stores floor by
  // floor, west row and east row. inner: the sides with portals out into an arcade; outer: the side
  // on the street)
  galleria: {
    name: 'DOWNTOWN GALLERIA', heb: 'הגלריה של דאונטאון', font: 'Rubik',
    mega: true, wing: 'center', floors: 5, inner: [-1, 1], outer: 0, dome: true, portalSign: { '-1': 'WEST HALL', 1: 'EAST HALL' }, bank: true, security: true, helipad: true, court: 'fountain',
    stores: {
      L0w: ['fashion', 'shoes', 'electronics', 'jewelry', 'perfume', 'fashion', 'optics', 'sports'],
      L0e: ['fashion', 'phones', 'toys', 'shoes', 'boutique', 'cafe'],
      L1w: ['fashion', 'books', 'sports', 'shoes', 'boutique', 'perfume', 'jewelry', 'music'],
      L1e: ['electronics', 'toys', 'fashion', 'shoes', 'optics', 'phones'],
      L2w: ['arcade', 'music', 'fashion', 'books', 'sports', 'boutique', 'icecream', 'cafe'],
      L2e: ['fashion', 'perfume', 'electronics', 'shoes', 'toys', 'barber'],
      L3w: ['fashion', 'jewelry', 'perfume', 'shoes', 'optics', 'boutique', 'fashion', 'books'],
      L3e: ['sports', 'electronics', 'fashion', 'phones', 'toys', 'music', 'shoes', 'boutique'],
      L4w: ['fashion', 'sports', 'cafe', 'books', 'boutique'],
      L4e: ['perfume', 'electronics', 'icecream', 'shoes', 'barber'],
    },
    food: ['burger', 'tacos', 'noodles', 'pizza', 'sushi', 'juice'],
    street: ['cafe', 'pharmacy', 'juice', 'sushi', 'icecream', 'phones', 'barber', 'flowers', 'cafe', 'optics', 'bagel', 'books'],
    anchor: { name: 'INKWELL & CO', kind: 'fashion', side: 1, floors: 2 },
  },
  galleriaW: {
    name: 'DOWNTOWN GALLERIA', heb: 'הגלריה של דאונטאון', font: 'Rubik',
    mega: true, wing: 'west', floors: 5, inner: [1], outer: -1, arcade: 1, portalSign: { 1: 'GRAND COURT' }, bank: false, security: false, helipad: false, court: 'palms',
    stores: {
      L0w: ['jewelry', 'perfume', 'shoes', 'fashion'],
      L0e: ['fashion', 'boutique', 'optics', 'phones', 'shoes', 'electronics', 'toys', 'cafe'],
      L1w: ['shoes', 'boutique', 'perfume', 'fashion'],
      L1e: ['fashion', 'sports', 'books', 'jewelry', 'music', 'fashion', 'shoes'],
      L2w: ['electronics', 'toys', 'fashion', 'optics'],
      L2e: ['boutique', 'fashion', 'perfume', 'arcade', 'shoes', 'phones', 'sports'],
      L3w: ['fashion', 'books', 'shoes', 'jewelry', 'perfume', 'boutique', 'fashion', 'music'],
      L3e: ['fashion', 'electronics', 'shoes', 'sports', 'optics', 'toys', 'fashion'],
      L4w: ['cafe', 'fashion', 'books', 'icecream', 'boutique'],
      L4e: ['fashion', 'perfume', 'jewelry', 'barber', 'shoes'],
    },
    food: ['sushi', 'noodles', 'pizza', 'cafe', 'tacos', 'icecream'],
    foodSign: 'DINING',
    street: ['cafe', 'flowers', 'books', 'juice', 'optics', 'bagel', 'pharmacy', 'icecream', 'phones', 'cafe', 'barber', 'sushi'],
    anchor: { name: 'BLOOMWELL\'S', kind: 'fashion', side: -1, floors: 3 },
  },
  galleriaE: {
    name: 'DOWNTOWN GALLERIA', heb: 'הגלריה של דאונטאון', font: 'Rubik',
    mega: true, wing: 'east', floors: 5, inner: [-1], outer: 1, arcade: -1, portalSign: { '-1': 'GRAND COURT' }, bank: false, security: false, helipad: false, court: 'fountain',
    stores: {
      L0w: ['fashion', 'jewelry', 'perfume', 'shoes', 'optics', 'boutique', 'phones', 'cafe'],
      L0e: ['shoes', 'fashion', 'perfume'],
      L1w: ['books', 'fashion', 'sports', 'electronics', 'toys', 'shoes', 'music'],
      L1e: ['jewelry', 'boutique', 'fashion'],
      L2w: ['fashion', 'optics', 'arcade', 'perfume', 'shoes', 'sports', 'phones'],
      L2e: ['fashion', 'books', 'electronics', 'toys', 'boutique', 'shoes', 'jewelry'],
      L3w: ['boutique', 'fashion', 'shoes', 'perfume', 'music', 'books', 'sports'],
      L3e: ['electronics', 'fashion', 'toys', 'optics', 'jewelry', 'shoes', 'fashion'],
      L4w: ['icecream', 'fashion', 'barber', 'books', 'cafe'],
      L4e: ['perfume', 'shoes', 'boutique', 'fashion', 'sports'],
    },
    food: ['burger', 'pizza', 'juice', 'noodles', 'tacos', 'icecream'],
    foodSign: 'BAY CAFES',
    anchor: { name: 'NORDSKETCH', kind: 'fashion', side: 1, floors: 2 },
  },
  // (v5, ROADMAP 11.34: the Galleria's lanes across Flagler Street, Via Inkwell - its houses' shops
  // in the order they are built: the west wall's from the food hall north, the east wall's from the
  // doors south, the island's; the food hall's counters, east to west - world/mainland/lanes.js)
  lanes: {
    name: 'VIA INKWELL', heb: 'ויה אינקוול', sign: 'VIA INKWELL', font: 'Rubik',
    stores: ['books', 'flowers', 'jewelry', 'perfume', 'boutique', 'shoes', 'optics', 'toys', 'music', 'fashion',
      'icecream', 'cafe', 'fashion', 'books', 'shoes', 'boutique', 'phones', 'sports', 'jewelry', 'flowers',
      'toys', 'perfume', 'boutique', 'fashion', 'music', 'shoes', 'books', 'optics', 'fashion', 'jewelry'],
    food: ['pizza', 'sushi', 'burger', 'tacos', 'noodles', 'icecream'],
  },
  starlight: {
    name: 'STARLIGHT CENTER', heb: 'מרכז סטארלייט', open: true, wall: '#f6e3d0', trim: '#e0574f', signCol: '#ffe14f', font: 'Permanent Marker',
    stores: ['fashion', 'sports', 'electronics', 'shoes', 'toys', 'perfume', 'fashion', 'jewelry', 'books', 'music', 'arcade', 'fashion', 'boutique', 'cafe'],
    food: ['burger', 'noodles', 'sushi', 'icecream'],
    street: ['diner', 'juice', 'barber', 'pharmacy', 'cafe', 'phones', 'flowers', 'gym'],
  },
  stripmall: { name: 'VALLEY PLAZA', heb: 'ואלי פלאזה', stores: ['grocery', 'pizza', 'laundry', 'pharmacy', 'barber', 'icecream', 'bagel', 'phones', 'cafe'] },
};
// (the clubs and the theatre: world/mainland/venues.js)
const VENUES = {
  '2,3': { kind: 'club', name: 'NEON INK', signCol: '#ff3fa4', strip: '#3fe8ff', wall: '#26232c', mural: true, len: 30, depth: 24 },
  '7,2': { kind: 'club', name: 'BLUE VELVET', signCol: '#4f9dff', strip: '#ff5ad1', wall: '#1e2440', font: 'Caveat', len: 28, depth: 22 },
  '9,3': { kind: 'theatre', name: 'INKWOOD PALACE', show: 'DRAWN TOGETHER', signCol: '#ffe14f', wall: '#7a2a32', len: 34, depth: 26, h: 11 },
};

// (v5, ROADMAP 11.17) A block of the mainland, built near you: the same kits the island's blocks
// are built with (world/sobe.js, world/kits.js), each district with a mix of its own, a lot at a
// time; then its pens merged a draw at a time. What it adds to the city (its collision boxes, its
// props, lights, shops, hiding spots) is kept with it, taken in when it is shown and let go of
// when it is (live.attach / live.detach).

// how each district builds its rows: which avenue's ways (the street key the kits know) and mix
const MIXES = {
  paintwood: { street: 'washington', mix: { strip: 3, deco: 1.2, garage: 0.8, lot: 1.4, vacant: 1.1, modern: 1.8, narrow: 0.8, apt: 0.6, home: 0.5 } },
  downtown: { street: 'washington', mix: { modern: 3.5, strip: 2, deco: 1.5, garage: 1.2, hotel: 1, mimo: 1, lot: 0.4 } },
  towers: { street: 'washington', mix: { strip: 3, modern: 2, deco: 1 } },
  brickton: { street: 'collins', mix: { modern: 2.5, mimo: 2.2, condo: 1.4, hotel: 1.2, strip: 1, apt: 0.8 } },
  havana: { street: 'washington', mix: { strip: 4, med: 3, deco: 1.4, narrow: 1.2, apt: 0.8, house: 0.6, vacant: 0.3, lot: 0.5 } },
  boulevard: { street: 'washington', mix: { strip: 3, deco: 3, hotel: 1.2, modern: 1.2, mimo: 1.2, garage: 0.6, narrow: 1 } },
  homes: { street: 'meridian', mix: { apt: 3, aptU: 2.2, house: 2.5, med: 1.6, mimo: 1, condo: 0.5, plot: 0.6, home: 1.4 } },
  houses: { street: 'west', mix: { house: 8, apt: 0.6, med: 1.2, plot: 1.4, home: 3 } },
  mansions: { street: 'west', mix: { house: 5, med: 3, plot: 0.8, home: 2.2 } },
  beach: { street: 'washington', mix: { strip: 3, deco: 2, mimo: 1.6, hotel: 1.2, house: 1.2, apt: 1, home: 0.8 } },
};
// which mix a block's rows take, by its kind (and district)
function mixOf(b) {
  switch (b.kind) {
    case 'towers':
    case 'offices':
    case 'condos':
    case 'galleria':
    case 'galleriaW':
    case 'galleriaE':
    case 'lanes':
    case 'dining':
      return MIXES.towers;
    case 'warehouses':
    case 'lofts':
    case 'walls':
    case 'clubs':
      return MIXES.paintwood;
    case 'calle':
      return MIXES.havana;
    case 'boulevard':
    case 'theatres':
    case 'starlight':
    case 'velvet':
      return MIXES.boulevard;
    case 'bungalows':
    case 'apartments':
    case 'villas':
      return b.district === 'havana' ? { street: 'meridian', mix: { house: 4, apt: 2, med: 2, aptU: 1, plot: 0.7, home: 1.8 } } : MIXES.homes;
    case 'houses':
    case 'school':
      return MIXES.houses;
    case 'mansions':
      return MIXES.mansions;
    case 'boardwalk':
      return MIXES.beach;
    case 'mixed':
    default:
      return b.district === 'brickton' ? MIXES.brickton : b.district === 'downtown' ? MIXES.downtown : b.district === 'paintwood' ? MIXES.paintwood : MIXES.boulevard;
  }
}

// a fair deck of shop kinds for a block (as the island's: every kind turns up; and the mainland's
// own - the clothes and the shoes, the screens, the burgers and the noodles - along its avenues)
const KIND_W = {
  cafe: 5, pizza: 4, grocery: 3, bagel: 3, icecream: 3, tacos: 2, sushi: 2, falafel: 2, shop: 3, hardware: 2, pharmacy: 2, laundry: 2,
  phones: 2, optics: 2, gym: 2, books: 2, flowers: 2, barber: 4, deli: 2, music: 2, diner: 2, juice: 2, surf: 1, boutique: 2, arcade: 1,
  fashion: 2, shoes: 1, electronics: 1, jewelry: 1, toys: 1, perfume: 1, sports: 1, burger: 2, noodles: 2,
};
// the restaurants' row in Brickton: Maison Plume, where the chef draws each plate, and its
// neighbours
const DINING_W = { gourmet: 3, sushi: 2, pizza: 2, noodles: 2, burger: 1, tacos: 1, cafe: 2, icecream: 1, diner: 1, juice: 1, deli: 1, bagel: 1 };
const MORE_NAMES = {
  gourmet: ['Maison Plume', 'Le Crayon', 'Atelier Nine', 'Graphite'],
  noodles: STORE_NAMES.noodles,
  burger: STORE_NAMES.burger,
};

// ------------------------------------------------------------------ the block's own ctx
export function blockCtx(world, b) {
  const c = world.ctx;
  const r = seeded(b.seed);
  const lightOwner = { lights: [] };
  const bctx = {
    B: new Batch(),
    R: new Batch(),
    M: world.mainM,
    col: new BoxList(),
    rng: r,
    wear: seeded(b.seed + 77),
    wearGang: false,
    parent: null,
    oceanDrive: false,
    neon: world.mainNeon,
    signs: [],
    shops: [],
    hideSpots: [],
    alleys: [],
    parks: [],
    courts: [],
    benches: [],
    stands: [],
    plazas: [],
    fountains: [],
    seats: [],
    // (the bus stops on its sidewalks: world/mainland/sidewalks.js, game/routines.js)
    busStops: [],
    markets: [],
    lamps: [],
    billboards: [],
    territories: [],
    occluders: null,
    footprints: [],
    queues: [],
    lots: [],
    atlas: c.atlas,
    posters: c.posters,
    towerMats: c.towerMats,
    lightOwner,
    lightCount: () => lightOwner.lights.length,
    props: [],
    // (v5, ROADMAP 11.18: what is on its rooms' shelves, streamed in when you come near - world/interiors.js)
    stock: [],
    block: b,
    // (the houses drawn on its plots: world/plot.js)
    homes: world.homes || null,
    // (the city's towers as they were drawn, each with what it is solid as: world/mainland/far.js)
    towers: (world.ctx && world.ctx.mainTowers) || null,
  };
  bctx.objects = {
    begin: (cx, kind, x, z) => world.objects.beginLocal(cx, kind, x, z),
    end: (cx, id, data) => world.objects.endLocal(cx, id, data),
  };
  bctx.room = (f, spec) => buildRoom(bctx, f, spec);
  // the block's own deck of shop kinds and names (its dice: the same block is the same every time)
  const deck = [];
  for (const [k, w] of Object.entries(b.kind === 'dining' ? DINING_W : KIND_W)) for (let i = 0; i < w; i++) deck.push(k);
  let cards = [];
  bctx.kindDeck = () => {
    if (!cards.length) {
      cards = deck.slice();
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    return cards.pop();
  };
  const use = new Map();
  bctx.nameFor = (kind) => {
    const list = MORE_NAMES[kind] || SHOP_NAMES[kind] || STORE_NAMES[kind] || ['Shop'];
    const n = (use.get(kind) || 0) + (b.seed % 7);
    use.set(kind, (use.get(kind) || 0) + 1);
    return list[n % list.length];
  };
  bctx.nameUse = use;
  return bctx;
}

// ------------------------------------------------------------------ the rows
// the block's two rows along its avenues (the west row faces the avenue west of it), an alley
// between them; D: how deep a row is
function* rows(bctx, b, o = {}) {
  const R = b.rect;
  const W = R.x1 - R.x0;
  const mx = mixOf(b);
  const D = o.D || Math.min(30, Math.max(17, (W - (o.alley || 12)) / 2));
  const base = { z0: R.z0, z1: R.z1, D, street: mx.street, mix: mx.mix, type: o.type || 'shops', col: 100 + b.col, row: 100 + b.row, back: true };
  bctx.ctxRow = true;
  if (o.west !== false) yield* sobeRowSteps(bctx, { ...base, x: R.x0, side: -1, rowSide: 'west' });
  // (o.eastFrom: something of its own stands at the north end of the east side)
  const ez0 = R.z0 + (o.eastFrom || 0);
  if (o.east !== false && R.z1 - ez0 > 24) yield* sobeRowSteps(bctx, { ...base, z0: ez0, x: R.x1, side: 1, rowSide: 'east' });
  const a = { x0: R.x0 + D, x1: R.x1 - D, z0: R.z0, z1: R.z1, type: b.kind, col: 100 + b.col, row: 100 + b.row };
  if (a.x1 - a.x0 > 4 && o.alleyGround !== false) {
    bctx.alleys.push(a);
    alleyGround(bctx, a);
  }
  yield;
}

// ------------------------------------------------------------------ the kinds of block
function* buildKind(bctx, b) {
  const R = b.rect;
  switch (b.kind) {
    // (the landmarks' own: world/mainland/landmarks.js LANDMARK_CELLS, and the arena's block)
    case 'pier':
      yield* buildPier(bctx, b);
      return;
    case 'beach':
      yield* buildBeach(bctx, b);
      return;
    case 'point':
      yield* buildPoint(bctx, b);
      return;
    case 'bayfront':
      yield* buildBayfront(bctx, b);
      return;
    case 'arena':
      yield* buildArena(bctx, b);
      return;
    case 'park':
    case 'domino':
      park(bctx, R);
      // (DRAW YOURSELF A FRIEND: a stand in the park - game/friend.js)
      friendStandIn(bctx, R);
      yield;
      return;
    case 'plaza':
      plaza(bctx, R);
      friendStandIn(bctx, R);
      yield;
      return;
    case 'galleria':
    case 'galleriaW':
    case 'galleriaE':
    case 'starlight':
      if (MALLS[b.kind].mega) yield* buildMegaMall(bctx, b, MALLS[b.kind]);
      else yield* buildMall(bctx, b, MALLS[b.kind]);
      // (and one in the mall's hall, among the shoppers - not in the mega mall's, full as it is)
      if (bctx.mall && bctx.mall.hall && !bctx.mall.mega) friendStandIn(bctx, bctx.mall.hall, { from: 4, step: 2 });
      return;
    case 'lanes':
      yield* buildLanes(bctx, b, MALLS.lanes);
      return;
    case 'stripmall':
      yield* buildStripMall(bctx, b, MALLS.stripmall);
      return;
    case 'walls': {
      // (ROADMAP 12.5) Paintwood's Walls: the rows on both avenues, less deep, and between their
      // backs a paved yard 30 m across, open to the streets at both ends - for the walls with the
      // murals and, on Art Night, the stage and the crowd (game/artnight.js stands them)
      yield* rows(bctx, b, { alley: YARD_W, alleyGround: false });
      const D = (R.x1 - R.x0 - YARD_W) / 2;
      yardGround(bctx, R.x0 + D, R.x1 - D, R.z0, R.z1);
      bctx.alleys.push({ x0: R.x0 + D, x1: R.x1 - D, z0: R.z0, z1: R.z1, type: 'walls', col: 100 + b.col, row: 100 + b.row });
      yield;
      return;
    }
    case 'arcade': {
      // (ROADMAP 12.7) the district's row on the west avenue; the east part the hall's - its ground
      // here (the hall itself near you: game/arcade.js), its shape for the far view
      yield* rows(bctx, b, { east: false, D: HALL_ROW_D, alleyGround: false });
      yardGround(bctx, R.x0 + HALL_ROW_D, R.x1, R.z0, R.z1);
      const H = ARCADE;
      bctx.footprints.push({ x0: H.xw, z0: H.z0, x1: H.xe, z1: H.z1, top: H.h + 1.2, color: '#2a1840' });
      yield;
      return;
    }
    case 'casino': {
      // (ROADMAP 12.8) PALACE OF INK: the block all paved, palms along its streets; the hall, its
      // tower and its fountains are game/casino.js's, built near you - here their shapes for the far view
      yardGround(bctx, R.x0, R.x1, R.z0, R.z1);
      for (let x = R.x0 + 5; x < R.x1 - 3; x += 9) {
        for (const z of [R.z0 + 3, R.z1 - 3]) palm(bctx, bctx.rng, x, z, 10 + bctx.rng() * 3, { y0: CURB });
      }
      const C = CASINO;
      bctx.footprints.push({ x0: C.xw, z0: C.z0, x1: C.xe, z1: C.z1, top: C.h + 1.4, color: '#efe2c4' });
      const T = C.tower;
      bctx.footprints.push({ x0: C.xw + T.u0, z0: C.z0 + T.v0, x1: C.xw + T.u1, z1: C.z0 + T.v1, top: T.h, color: '#e9dcc0', tower: true });
      yield;
      return;
    }
    case 'clubs':
    case 'theatres': {
      // the venue on the avenue's side at the north end, the district's rows round it
      const v = VENUES[`${b.col},${b.row}`];
      if (!v) break;
      const taken = yield* buildVenue(bctx, b, v);
      yield* rows(bctx, b, { eastFrom: taken });
      return;
    }
    case 'school':
      // the school's fields and its court behind a row of houses
      yield* rows(bctx, b, { east: false, D: 26 });
      court(bctx, R.x0 + 30, R.x1 - 4, R.z0 + 8, R.z0 + 36);
      lawn(bctx, R.x0 + 28, R.x1 - 2, R.z0 + 40, R.z1 - 4);
      yield;
      return;
    case 'towers':
    case 'offices':
    case 'condos':
    case 'dining': {
      // the shops along both avenues under the towers (the towers are always there, built at the
      // start: world/mainland/far.js); a plaza and its fountain where a block has only one
      const ts = towersOf(b);
      yield* rows(bctx, b, { D: 11, alleyGround: false });
      const W = R.x1 - R.x0;
      plazaGround(bctx, R.x0 + 11, R.x1 - 11, R.z0, R.z1);
      if (ts.length < 2) fountain(bctx, R.x0 + W / 2, R.z1 - 22);
      // (each tower solid as it is drawn - its setbacks, its round, its slanted roof: world/skyline.js;
      // one box its foot's size to its full height left walls in the air the aircraft stuck on)
      const built = (bctx.towers || []).filter((q) => q.block === b.id && q.solids && q.solids.length);
      if (built.length) {
        for (const t of built) for (const q of t.solids) bctx.col.addBox(q[0], q[1], q[2], q[3], Math.max(0, q[4]), q[5], 'wall');
      } else for (const t of ts) bctx.col.addBox(t.x - t.w / 2, t.z - t.d / 2, t.x + t.w / 2, t.z + t.d / 2, 0, t.h, 'wall');
      yield;
      return;
    }
    default:
      yield* rows(bctx, b);
  }
}

// (the blocks whose sidewalks are their own: the landmarks', the beach's, the arena's)
const BARE = new Set(['pier', 'beach', 'point', 'bayfront', 'arena']);

function lawn(bctx, x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, CURB + 0.01, (z0 + z1) / 2);
  bctx.B.add(bctx.M.grass, g, null, nextId(), { color: srgb(0.52, 0.8, 0.46) });
}

// the Walls' yard (ROADMAP 12.5): its pavers, nothing on them (what stands there: game/artnight.js)
export const YARD_W = 30;
function yardGround(bctx, x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, CURB + 0.012, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
  bctx.B.add(bctx.M.plaza, g, null, nextId());
}

function plazaGround(bctx, x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, CURB + 0.012, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
  bctx.B.add(bctx.M.plaza, g, null, nextId());
  // palms in planters along it
  for (let z = z0 + 8; z < z1 - 6; z += 16) palm(bctx, bctx.rng, x0 + 3, z, 9 + bctx.rng() * 3, { y0: CURB });
  for (let z = z0 + 16; z < z1 - 6; z += 16) bench(bctx, x1 - 2.5, z, -Math.PI / 2);
}

// ------------------------------------------------------------------ build, show, let go
/**
 * The block's build: a generator (a lot a step, a draw a step). Returns its live object:
 * { group, attach(), detach(), shops, ... } - attach shows it (one frame: its meshes, its boxes,
 * props, lights, shops into the city), detach lets all of it go.
 */
export function* buildMBlock(world, b) {
  const bctx = blockCtx(world, b);
  const group = new THREE.Group();
  group.name = `block ${b.col},${b.row}`;
  group.visible = false;
  bctx.parent = group;
  // (everything made now is the block's: its lights, its props)
  setLightOwner(bctx.lightOwner);
  try {
    const it = buildKind(bctx, b);
    for (;;) {
      setLightOwner(bctx.lightOwner);
      const r = it.next();
      setLightOwner(null);
      if (r.done) break;
      yield;
    }
  } finally {
    setLightOwner(null);
  }
  // (v5, ROADMAP 11.18) the things on its sidewalks
  if (!BARE.has(b.kind)) {
    setLightOwner(bctx.lightOwner);
    try {
      dressSidewalks(bctx, b);
    } finally {
      setLightOwner(null);
    }
    yield;
  }
  // the pens, merged a draw at a time
  // (a phone: each pen of the block in one draw, not one in each 96 m of it - a phone feels every
  // draw more than a little more drawn off the screen; the small things and the rooms stay as they
  // are, to go with the distance)
  const whole = world.low ? { max: 60000, ok: (pens) => !pens.some((p) => world.smallPens.has(p)) } : null;
  const meshes = yield* bctx.B.flushSteps(group, { static: true, merge: world.merge, steps: true, whole });
  const rooms = yield* bctx.R.flushSteps(group, { static: true, indoor: true, merge: world.merge, steps: true });
  for (const m of rooms) m.renderOrder = 1;
  const cull = [];
  // (a phone: the rooms in sight nearer - a mall's stores past 65 m are their windows' light)
  for (const m of rooms) cull.push({ m, r: bctx.mall ? (world.low ? 65 : 90) : world.low ? 45 : 55 });
  for (const m of meshes) {
    const pen = m.userData.pens ? m.userData.pens[0] : m.material;
    if (world.smallPens.has(pen)) cull.push({ m, r: world.low ? 85 : 150 });
  }
  const live = {
    group,
    block: b,
    bctx,
    shops: bctx.shops,
    verts: bctx.B.vcount + bctx.R.vcount,
    attach() {
      const col = world.collision;
      for (const box of bctx.col.boxes) col.adopt(box);
      world.objects.adoptLocal(bctx.props);
      showLights(bctx.lightOwner, true);
      for (const s of bctx.shops) world.addShop(s);
      // (the plots to draw a home on: game/friend.js)
      if (bctx.plots) for (const p of bctx.plots) world.plots.push(p);
      if (bctx.queues && bctx.queues.length) {
        world.queues = world.queues || [];
        for (const q of bctx.queues) world.queues.push(q);
        world.queuesVer = (world.queuesVer || 0) + 1;
      }
      for (const h of bctx.hideSpots) world.hideSpots.push(h);
      for (const c of cull) world.cullList.push(c);
      // (what turns while it is here - the carousel; the ways people stroll on it - the pier, the
      // beach, the promenades: game/civilians.js)
      if (bctx.anims) for (const f of bctx.anims) world.anims.push(f);
      if (bctx.walks) for (const w of bctx.walks) world.walks.push(w);
      if (bctx.carousel) world.carousel = bctx.carousel;
      // (the arena: its floor is indoors, and the game on it - game/arenagame.js)
      if (bctx.arena) {
        world.arena = bctx.arena;
        world.indoorAreas.push(bctx.arena.hall);
      }
      // (v5, ROADMAP 11.34: the walls that hide what is behind them - render/occlusion.js)
      if (bctx.occBoxes && world.occluders) for (const q of bctx.occBoxes) world.occluders.push(q);
      // (a mall: its hall is indoors for the weather, and its people's - game/mall.js)
      if (bctx.mall) {
        world.malls.push(bctx.mall);
        if (!bctx.mall.open && !bctx.mall.strip) for (const a of bctx.mall.indoor || [bctx.mall.hall]) world.indoorAreas.push(a);
      }
      group.visible = true;
      world.mainland.show(group, `b${b.id}`);
      if (world.interiors) world.interiors.addAll(bctx.stock);
      // (where people can walk in it: world/collision.js NavGrid, a row a frame)
      if (world.nav && world.nav.queueRefresh) world.nav.queueRefresh(b.rect.x0 - 2, b.rect.z0 - 2, b.rect.x1 + 2, b.rect.z1 + 2);
      world.mainland.onBlock(live, true);
    },
    detach() {
      world.mainland.onBlock(live, false);
      world.mainland.hide(group);
      if (bctx.occBoxes && world.occluders) {
        for (const q of bctx.occBoxes) {
          const k = world.occluders.indexOf(q);
          if (k >= 0) world.occluders.splice(k, 1);
        }
      }
      if (world.interiors) world.interiors.removeAll(bctx.stock);
      const col = world.collision;
      col.release(bctx.col.boxes.map((x) => x.id));
      if (world.nav && world.nav.queueRefresh) world.nav.queueRefresh(b.rect.x0 - 2, b.rect.z0 - 2, b.rect.x1 + 2, b.rect.z1 + 2);
      world.objects.releaseLocal(bctx.props);
      releaseLights(bctx.lightOwner);
      for (const s of bctx.shops) world.removeShop(s);
      if (bctx.plots) {
        for (const p of bctx.plots) {
          const k = world.plots.indexOf(p);
          if (k >= 0) world.plots.splice(k, 1);
        }
      }
      if (bctx.queues && bctx.queues.length && world.queues) {
        for (const q of bctx.queues) {
          const k = world.queues.indexOf(q);
          if (k >= 0) world.queues.splice(k, 1);
        }
        world.queuesVer = (world.queuesVer || 0) + 1;
      }
      for (const h of bctx.hideSpots) {
        const k = world.hideSpots.indexOf(h);
        if (k >= 0) world.hideSpots.splice(k, 1);
      }
      for (const c of cull) {
        const k = world.cullList.indexOf(c);
        if (k >= 0) world.cullList.splice(k, 1);
      }
      if (bctx.anims) {
        for (const f of bctx.anims) {
          const k = world.anims.indexOf(f);
          if (k >= 0) world.anims.splice(k, 1);
        }
      }
      if (bctx.carousel && world.carousel === bctx.carousel) world.carousel = null;
      if (bctx.arena) {
        if (world.arena === bctx.arena) world.arena = null;
        const k = world.indoorAreas.indexOf(bctx.arena.hall);
        if (k >= 0) world.indoorAreas.splice(k, 1);
      }
      if (bctx.walks) {
        for (const w of bctx.walks) {
          const k = world.walks.indexOf(w);
          if (k >= 0) world.walks.splice(k, 1);
        }
      }
      if (bctx.mall) {
        let k = world.malls.indexOf(bctx.mall);
        if (k >= 0) world.malls.splice(k, 1);
        for (const a of bctx.mall.indoor || [bctx.mall.hall]) {
          k = world.indoorAreas.indexOf(a);
          if (k >= 0) world.indoorAreas.splice(k, 1);
        }
      }
      group.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
  return live;
}

export { M_AVES, M_STREETS };
