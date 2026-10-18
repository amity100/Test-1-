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

// (v5, ROADMAP 11.17) A block of the mainland, built near you: the same kits the island's blocks
// are built with (world/sobe.js, world/kits.js), each district with a mix of its own, a lot at a
// time; then its pens merged a draw at a time. What it adds to the city (its collision boxes, its
// props, lights, shops, hiding spots) is kept with it, taken in when it is shown and let go of
// when it is (live.attach / live.detach).

// how each district builds its rows: which avenue's ways (the street key the kits know) and mix
const MIXES = {
  paintwood: { street: 'washington', mix: { strip: 3, deco: 1.2, garage: 0.8, lot: 1.4, vacant: 1.1, modern: 1.8, narrow: 0.8, apt: 0.6 } },
  downtown: { street: 'washington', mix: { modern: 3.5, strip: 2, deco: 1.5, garage: 1.2, hotel: 1, mimo: 1, lot: 0.4 } },
  towers: { street: 'washington', mix: { strip: 3, modern: 2, deco: 1 } },
  brickton: { street: 'collins', mix: { modern: 2.5, mimo: 2.2, condo: 1.4, hotel: 1.2, strip: 1, apt: 0.8 } },
  havana: { street: 'washington', mix: { strip: 4, med: 3, deco: 1.4, narrow: 1.2, apt: 0.8, house: 0.6, vacant: 0.3, lot: 0.5 } },
  boulevard: { street: 'washington', mix: { strip: 3, deco: 3, hotel: 1.2, modern: 1.2, mimo: 1.2, garage: 0.6, narrow: 1 } },
  homes: { street: 'meridian', mix: { apt: 3, aptU: 2.2, house: 2.5, med: 1.6, mimo: 1, condo: 0.5 } },
  houses: { street: 'west', mix: { house: 8, apt: 0.6, med: 1.2 } },
  mansions: { street: 'west', mix: { house: 5, med: 3 } },
  beach: { street: 'washington', mix: { strip: 3, deco: 2, mimo: 1.6, hotel: 1.2, house: 1.2, apt: 1 } },
};
// which mix a block's rows take, by its kind (and district)
function mixOf(b) {
  switch (b.kind) {
    case 'towers':
    case 'offices':
    case 'condos':
    case 'galleria':
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
      return b.district === 'havana' ? { street: 'meridian', mix: { house: 4, apt: 2, med: 2, aptU: 1 } } : MIXES.homes;
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

// a fair deck of shop kinds for a block (as the island's: every kind turns up)
const KIND_W = {
  cafe: 5, pizza: 4, grocery: 3, bagel: 3, icecream: 3, tacos: 2, sushi: 2, falafel: 2, shop: 3, hardware: 2, pharmacy: 2, laundry: 2,
  phones: 2, optics: 2, gym: 2, books: 2, flowers: 2, barber: 4, deli: 2, music: 2, diner: 2, juice: 2, surf: 2, boutique: 2, arcade: 1,
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
    block: b,
  };
  bctx.objects = {
    begin: (cx, kind, x, z) => world.objects.beginLocal(cx, kind, x, z),
    end: (cx, id, data) => world.objects.endLocal(cx, id, data),
  };
  bctx.room = (f, spec) => buildRoom(bctx, f, spec);
  // the block's own deck of shop kinds and names (its dice: the same block is the same every time)
  const deck = [];
  for (const [k, w] of Object.entries(KIND_W)) for (let i = 0; i < w; i++) deck.push(k);
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
    const list = SHOP_NAMES[kind] || ['Shop'];
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
  if (o.east !== false) yield* sobeRowSteps(bctx, { ...base, x: R.x1, side: 1, rowSide: 'east' });
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
    case 'park':
    case 'domino':
      park(bctx, R);
      yield;
      return;
    case 'plaza':
      plaza(bctx, R);
      yield;
      return;
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
    case 'galleria':
    case 'dining': {
      // the shops along both avenues under the towers (the towers are always there, built at the
      // start: world/mainland/far.js); a plaza and its fountain where a block has only one
      const ts = towersOf(b);
      yield* rows(bctx, b, { D: 11, alleyGround: false });
      const W = R.x1 - R.x0;
      plazaGround(bctx, R.x0 + 11, R.x1 - 11, R.z0, R.z1);
      if (ts.length < 2) fountain(bctx, R.x0 + W / 2, R.z1 - 22);
      for (const t of ts) bctx.col.addBox(t.x - t.w / 2, t.z - t.d / 2, t.x + t.w / 2, t.z + t.d / 2, 0, t.h, 'wall');
      yield;
      return;
    }
    default:
      yield* rows(bctx, b);
  }
}

function lawn(bctx, x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, CURB + 0.01, (z0 + z1) / 2);
  bctx.B.add(bctx.M.grass, g, null, nextId(), { color: srgb(0.52, 0.8, 0.46) });
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
  // the pens, merged a draw at a time
  const meshes = yield* bctx.B.flushSteps(group, { static: true, merge: world.merge, steps: true });
  const rooms = yield* bctx.R.flushSteps(group, { static: true, indoor: true, merge: world.merge, steps: true });
  for (const m of rooms) m.renderOrder = 1;
  const cull = [];
  for (const m of rooms) cull.push({ m, r: 55 });
  for (const m of meshes) {
    const pen = m.userData.pens ? m.userData.pens[0] : m.material;
    if (world.smallPens.has(pen)) cull.push({ m, r: world.low ? 110 : 150 });
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
      for (const h of bctx.hideSpots) world.hideSpots.push(h);
      for (const c of cull) world.cullList.push(c);
      group.visible = true;
      world.mainland.show(group, `b${b.id}`);
      world.mainland.onBlock(live, true);
    },
    detach() {
      world.mainland.onBlock(live, false);
      world.mainland.hide(group);
      const col = world.collision;
      col.release(bctx.col.boxes.map((x) => x.id));
      world.objects.releaseLocal(bctx.props);
      releaseLights(bctx.lightOwner);
      for (const s of bctx.shops) world.removeShop(s);
      for (const h of bctx.hideSpots) {
        const k = world.hideSpots.indexOf(h);
        if (k >= 0) world.hideSpots.splice(k, 1);
      }
      for (const c of cull) {
        const k = world.cullList.indexOf(c);
        if (k >= 0) world.cullList.splice(k, 1);
      }
      group.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
  return live;
}

export { M_AVES, M_STREETS };
