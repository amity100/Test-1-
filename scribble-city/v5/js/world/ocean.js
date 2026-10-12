import * as THREE from 'three';
import { srgb, hex, addLight, mergeMoving } from '../render/materials.js';
import { nextId, Facade, Batch } from './kit.js';
import { fbox, neonSign, adQuad, frontMatrix } from './deco.js';
import { oceanHotel, HOTEL_PALS, MED_PALS, HOTEL_NAMES, TERRACE_NAMES, Shape } from './hotels.js';
import { cinemaFront, clubFront, rooftopName, bench } from './blocks.js';
import { hydrant, trashCan, newsBox, free, streetLamp } from './streets.js';
import { AD_IDS } from './ads.js';
import { palm } from './palms.js';
import { slab } from './ground.js';
import { STREETS, BLOCK_TYPES, blockRect, CURB, WALK_X0, STREET_X0, PROM_X1, PARK_X1, SAND_X0, SAND_TOP, WATER_X, BEACH_WALK, PIER, NORTH_EDGE, SOUTH_EDGE, beachHeight } from './layout.js';

// (v5) Ocean Drive, the way it is: on its west side a row of Art Deco hotels behind their
// terraces, each its own building on its own lot (world/hotels.js); on the sidewalk the cafés'
// umbrellas by the curb, the walk between them and the terraces. Across the street the park
// along the beach: a low wall of coral stone, lawns, coconut palms bent by the wind, the beach
// walk, sea grapes; then the dunes with their sea oats and their fences, the paths over them at
// the end of every street; then the wide beach, its lifeguard towers painted every colour, the
// rows of umbrellas and loungers, the towels; the surf, and the ocean.

const TW = 3.2; // the terraces' depth
const CAFE_X = -5.7; // the middle of the cafés' strip by the curb
const WHITE = srgb(0.98, 0.97, 0.95);
const WOOD = srgb(0.66, 0.48, 0.32);
const CORAL = srgb(0.88, 0.82, 0.7);

// the first boulevard's five, on their own lots (north to south), in the new street
const FIRST = [
  { z0: -96, z1: -74, floors: 4, style: 'streamline', pal: { wall: '#f9d0b0', acc: '#3fb0b8', acc2: '#ffffff', neon: '#9b6bff' }, name: 'Neon Bar', kind: 'bar', awning: srgb(0.95, 0.3, 0.4), font: 'Permanent Marker', cafe: true },
  { z0: -74, z1: -46, floors: 7, style: 'deco', pal: { wall: '#f7f4ee', acc: '#8a6ad8', acc2: '#f5a3b5', neon: '#ff5ad1' }, name: 'Hotel Palms', kind: 'lobby', hotel: true, terrace: true, terraceName: 'Palm Court' },
  { z0: -46, z1: -26, floors: 3, style: 'deco', pal: { wall: '#fbe3a0', acc: '#e8664f', acc2: '#ffffff', neon: '#ffb43f' }, name: 'TACOS 24/7', kind: 'tacos', awning: srgb(0.45, 0.32, 0.72), font: 'Permanent Marker', cafe: true },
  { z0: -26, z1: -2, floors: 5, style: 'streamline', pal: { wall: '#bfe8d8', acc: '#f0728f', acc2: '#ffffff', neon: '#3fe8ff' }, name: 'Bay Cafe', kind: 'cafe', awning: srgb(0.98, 0.45, 0.55), cafe: true },
  { z0: -2, z1: 18, floors: 3, style: 'deco', pal: { wall: '#f9c0c4', acc: '#2fa8a0', acc2: '#ffffff', neon: '#ff3fa4' }, name: 'Sunset Market', kind: 'grocery', awning: srgb(0.18, 0.72, 0.72) },
];
const CINEMA_PAL = { wall: '#f4e6c8', acc: '#c0283c', acc2: '#f2c94c', neon: '#ffd23f' };
const CLUB_PAL = { wall: '#2c2240', acc: '#ff3fa4', acc2: '#3fe8ff', neon: '#ff3fa4' };

function shuffle(r, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// is z by a crossing (where nothing may stand along the street)?
function nearCross(z, pad) {
  for (const s of STREETS) if (Math.abs(z - s.z) < s.half + s.walk + pad) return true;
  return false;
}

export function buildOceanDrive(ctx) {
  const r = ctx.rng;
  const S = { names: shuffle(r, HOTEL_NAMES.slice()), pals: shuffle(r, HOTEL_PALS.slice()), terraces: shuffle(r, TERRACE_NAMES.slice()), n: 0, p: 0, t: 0 };
  ctx.ocean = { hotels: [] };
  for (let row = 0; row < 5; row++) hotelRow(ctx, row, S);
  sidewalk(ctx);
  park(ctx);
  dunes(ctx);
  beach(ctx);
}

// ------------------------------------------------------------------ the hotels
function hotelRow(ctx, row, S) {
  const r = ctx.rng;
  const R = blockRect(2, row);
  const type = BLOCK_TYPES[row][2];
  const x = R.x1;
  let lots;
  if (type === 'first') lots = FIRST.map((o) => ({ ...o }));
  else {
    lots = [];
    let z = R.z0;
    while (z < R.z1 - 0.1) {
      let w = r.range(17, 29);
      if (R.z1 - (z + w) < 15) w = R.z1 - z;
      lots.push({ z0: z, z1: z + w });
      z += w;
    }
  }
  const n = lots.length;
  const infos = [];
  // (a block of the real street: a couple of Deco towers, a couple of streamlined ones, one older
  // and Spanish; never Spanish on a corner)
  const deck = shuffle(r, ['deco', 'deco', 'streamline', 'streamline', 'med', r() < 0.5 ? 'deco' : 'streamline']);
  for (const k of [0, n - 1]) {
    if (deck[k] !== 'med') continue;
    const j = deck.findIndex((s, q) => s !== 'med' && q > 0 && q < n - 1);
    if (j >= 0) [deck[k], deck[j]] = [deck[j], deck[k]];
  }
  lots.forEach((lot, i) => {
    const L = lot.z1 - lot.z0;
    // (the lots run north to south; a front facing east has its u running north: u = 0 is the
    // south end of the lot)
    const cornerB = i === 0;
    const cornerA = i === n - 1;
    let spec;
    const special = type === 'shops' && i === 1 ? (row === 1 ? 'cinema' : row === 3 ? 'club' : null) : null;
    if (special === 'cinema') {
      spec = { floors: 4, style: 'streamline', pal: CINEMA_PAL, name: 'Bay Cinema', sign: null, kind: 'cinema', awning: false, front: cinemaFront, shop: { kind: 'cinema', name: 'Bay Cinema' } };
    } else if (special === 'club') {
      spec = { floors: 3, style: 'streamline', pal: CLUB_PAL, name: 'INK CLUB', sign: null, kind: 'bar', awning: false, front: clubFront, shop: { kind: 'bar', name: 'INK CLUB' } };
    } else if (type === 'first') {
      spec = { ...lot, shop: { kind: lot.kind, name: lot.name, first: true } };
    } else {
      let style = deck[i % deck.length];
      let floors = style === 'med' ? 3 : r() < 0.6 ? 3 : 4;
      let tall = false;
      if (type === 'hotels' && L >= 22 && r() < 0.5) {
        tall = true;
        style = r() < 0.5 ? 'deco' : 'streamline';
        floors = r.int(7, 10);
      } else if (style !== 'med' && r() < 0.16) floors = 5;
      const name = S.names[S.n++ % S.names.length];
      spec = {
        floors, style, tall, name, kind: 'lobby', hotel: true,
        pal: style === 'med' ? r.pick(MED_PALS) : S.pals[S.p++ % S.pals.length],
        terrace: true,
        terraceName: r() < 0.7 ? S.terraces[S.t++ % S.terraces.length] : null,
        shop: { kind: 'lobby', name },
        balcony: tall ? r() < 0.7 : floors >= 4 && r() < 0.3,
      };
    }
    // a corner building's corner is rounded (most of them), the streamlined ones always
    const corner = cornerA || cornerB;
    const rr = corner && spec.style !== 'med' && (spec.style === 'streamline' || r() < 0.75) ? Math.min(r.range(3.2, 4.8), L / 3.4) : 0;
    spec.L = L;
    spec.D = spec.tall ? 18.2 : r.range(15, 18.2);
    spec.rA = cornerA ? rr : 0;
    spec.rB = cornerB ? rr : 0;
    spec.cornerA = cornerA;
    spec.cornerB = cornerB;
    const f = new Facade(x, lot.z1, 0, -1, 1, 0);
    spec.f = f;
    const info = oceanHotel(ctx, spec);
    if (spec.front) spec.front(ctx, f, L, info, { signCol: spec.pal.neon });
    if (spec.tall && spec.style === 'streamline') rooftopName(ctx, f, L, info.top + 1.4, spec.name, spec.pal.neon);
    if (spec.terrace) terrace(ctx, f, info, spec);
    if (spec.terraceName || spec.cafe) cafes(ctx, f, info, spec);
    info.z0 = lot.z0;
    info.z1 = lot.z1;
    info.spec = spec;
    infos.push(info);
    ctx.ocean.hotels.push(info);
  });
  // where a hotel stands taller than its neighbour, the bare wall over the neighbour's roof
  // carries a big painted ad
  for (let i = 0; i + 1 < infos.length; i++) {
    const A = infos[i];
    const B = infos[i + 1];
    const tall = A.top > B.top ? A : B;
    const low = tall === A ? B : A;
    const free2 = tall.top - low.top - (low.towerTop - low.top);
    if (free2 < 7 || r() < 0.2) continue;
    const D = Math.min(A.D, B.D);
    let w = Math.min(D - 3, 12);
    let h = w / 2;
    if (h > free2 - 2) {
      h = free2 - 2;
      w = h * 2;
    }
    if (w < 7) continue;
    const nz = tall === A ? 1 : -1;
    adQuad(ctx, ctx.M.adWall, x - D * 0.5, low.towerTop + 1.0 + h / 2, A.z1 + nz * 0.04, 0, nz, w, h, r.pick(AD_IDS));
  }
}

// a table on a pedestal with its chairs round it (people sit on them: game/routines.js)
function cafeSet(ctx, x, z, o = {}) {
  const M = ctx.M;
  const r = ctx.rng;
  const id = ctx.objects.begin(ctx, 'cafe', x, z);
  const top = new THREE.CylinderGeometry(o.square ? 0.5 : 0.42, o.square ? 0.5 : 0.42, 0.04, o.square ? 4 : 14);
  if (o.square) top.rotateY(Math.PI / 4);
  top.translate(x, CURB + 0.74, z);
  ctx.B.add(M.propCyl, top, null, nextId(), { color: o.top || WHITE });
  const leg = new THREE.CylinderGeometry(0.04, 0.05, 0.72, 6);
  leg.translate(x, CURB + 0.36, z);
  ctx.B.add(M.propCyl, leg, null, nextId(), { color: srgb(0.2, 0.18, 0.24) });
  const n = o.chairs || 2;
  const chair = o.chair || r.pick([WHITE, srgb(0.2, 0.18, 0.22), WOOD, srgb(0.82, 0.7, 0.5)]);
  for (let k = 0; k < n; k++) {
    const a = (o.a0 || 0) + (k / n) * Math.PI * 2;
    const cx = x + Math.cos(a) * 0.78;
    const cz = z + Math.sin(a) * 0.78;
    const yaw = Math.atan2(x - cx, z - cz);
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, CURB, cz);
    const part = (w, h, d, px, py, pz) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(px, py, pz);
      ctx.B.add(M.prop, g, m, nextId(), { color: chair });
    };
    part(0.42, 0.05, 0.42, 0, 0.45, 0);
    part(0.42, 0.42, 0.05, 0, 0.68, -0.2);
    part(0.04, 0.45, 0.04, -0.18, 0.225, 0.18);
    part(0.04, 0.45, 0.04, 0.18, 0.225, 0.18);
    part(0.04, 0.45, 0.04, -0.18, 0.225, -0.18);
    part(0.04, 0.45, 0.04, 0.18, 0.225, -0.18);
    ctx.seats.push({ x: cx, z: cz, yaw });
  }
  if (o.umbrella) {
    const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.35, 6);
    pole.translate(x, CURB + 1.17, z);
    ctx.B.add(M.propCyl, pole, null, nextId(), { color: WHITE });
    const R = o.square ? 1.55 : 1.25;
    const um = new THREE.ConeGeometry(R, o.square ? 0.42 : 0.5, o.square ? 4 : 8, 1, true);
    if (o.square) um.rotateY(Math.PI / 4);
    um.translate(x, CURB + 2.42, z);
    ctx.B.add(M.awning, um, null, nextId(), { color: o.umbrella });
    if (o.square) {
      // the valance round its edge
      const v = new THREE.CylinderGeometry(R * 0.72, R * 0.72, 0.22, 4, 1, true).rotateY(Math.PI / 4);
      v.translate(x, CURB + 2.1, z);
      ctx.B.add(M.awning, v, null, nextId(), { color: o.valance || WHITE });
    }
  }
  ctx.col.addCircle(x, z, 0.5, 0, 0.8, 'prop');
  ctx.objects.end(ctx, id);
}

// the terrace in front of a hotel: tiles, a low wall round it with a way in at the door, the
// tables (under umbrellas, or under an awning), a string of bulbs, the restaurant's name
function terrace(ctx, f, info, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const pal = spec.pal;
  const L = info.L;
  const u0 = (spec.rA || 0.4) + 0.3;
  const u1 = L - (spec.rB || 0.4) - 0.3;
  const uD = info.uDoor;
  const gap = 1.35;
  if (u1 - u0 < 6) return;
  const acc = hex(pal.acc);
  const wallCol = spec.style === 'med' ? hex(pal.wall) : acc.clone().lerp(WHITE, 0.15);
  // the tiles
  {
    const [mn, mx] = f.box(u0, CURB, 0, u1, CURB + 0.03, TW);
    slab(ctx, M.plaza, mn[0], mx[0], mn[2], mx[2], CURB - 0.02, CURB + 0.025, 3);
  }
  // the low wall and its white cap, its ends turned back to the front
  const wid = nextId();
  const cid = nextId();
  const segs = [[u0, uD - gap], [uD + gap, u1]];
  const colBox = (a0, b0, a1, b1, h) => {
    const [mn, mx] = f.box(a0, 0, b0, a1, h, b1);
    ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], 'prop');
  };
  for (const [a, b] of segs) {
    if (b - a < 0.4) continue;
    fbox(ctx, f, M.wall, a, CURB, TW - 0.24, b, CURB + 0.72, TW, wallCol, wid);
    fbox(ctx, f, M.wall, a - 0.04, CURB + 0.72, TW - 0.3, b + 0.04, CURB + 0.8, TW + 0.05, WHITE, cid);
    colBox(a, TW - 0.25, b, TW + 0.02, CURB + 0.8);
  }
  for (const u of [u0, u1]) {
    fbox(ctx, f, M.wall, u - 0.12, CURB, 0.0, u + 0.12, CURB + 0.72, TW - 0.24, wallCol, wid);
    fbox(ctx, f, M.wall, u - 0.16, CURB + 0.72, 0.0, u + 0.16, CURB + 0.8, TW - 0.24, WHITE, cid);
    colBox(u - 0.12, 0, u + 0.12, TW - 0.24, CURB + 0.8);
  }
  // a pot with a little palm either side of the way in
  for (const s of [-1, 1]) {
    const p = f.p(uD + s * (gap + 0.45), CURB, TW + 0.55);
    const pot = new THREE.CylinderGeometry(0.36, 0.28, 0.62, 10);
    pot.translate(p[0], CURB + 0.31, p[2]);
    ctx.B.add(M.propCyl, pot, null, nextId(), { color: srgb(0.8, 0.46, 0.32) });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const leaf = new THREE.ConeGeometry(0.1, 0.9, 4);
      leaf.rotateZ(0.6);
      leaf.rotateY(a);
      leaf.translate(p[0] + Math.cos(a) * 0.18, CURB + 1.0, p[2] - Math.sin(a) * 0.18);
      ctx.B.add(M.leaf, leaf, null, nextId(), { color: srgb(0.3, 0.62, 0.32) });
    }
    ctx.col.addCircle(p[0], p[2], 0.36, 0, 0.7, 'prop');
  }
  // the tables
  const um = r() < 0.55;
  const umCol = r.pick([acc, WHITE, hex(pal.acc2)]);
  for (const [a, b] of segs) {
    const len = b - a - 1.0;
    const k = Math.floor(len / 2.7);
    for (let i = 0; i < k; i++) {
      const u = a + 0.5 + (len / k) * (i + 0.5);
      const p = f.p(u, CURB, 1.62);
      cafeSet(ctx, p[0], p[2], { chairs: 2, a0: Math.atan2(f.uz, f.ux), umbrella: um ? umCol : null, chair: spec.style === 'med' ? WOOD : null });
    }
  }
  // or an awning over the terrace (not over the door: the canopy is there)
  if (!um) {
    const aw = r.pick([acc, hex(pal.acc2), srgb(0.95, 0.95, 0.92)]);
    const stripe = aw.equals(WHITE) ? acc : WHITE;
    for (const [a, b] of [[u0 + 0.1, uD - 2.5], [uD + 2.5, u1 - 0.1]]) {
      if (b - a < 1.2) continue;
      const n = Math.floor((b - a) / 0.6);
      for (let k = 0; k < n; k++) {
        const u = a + 0.3 + k * ((b - a - 0.6) / Math.max(1, n - 1));
        const g = new THREE.BoxGeometry(TW + 0.1, 0.05, 0.6);
        g.rotateZ(-0.2);
        ctx.B.add(M.awning, g, frontMatrix(f, u, 2.82, TW / 2), nextId(), { color: k % 2 ? stripe : aw });
      }
      fbox(ctx, f, M.awning, a, 2.2, TW - 0.02, b, 2.48, TW + 0.06, aw);
      for (const u of [a + 0.15, b - 0.15]) fbox(ctx, f, M.frame, u - 0.05, CURB + 0.8, TW - 0.16, u + 0.05, 2.25, TW - 0.06, WHITE);
    }
  }
  // a string of bulbs along the front of the terrace
  {
    const bulbCol = srgb(1.0, 0.86, 0.55);
    const span = 3.2;
    for (let a = u0; a < u1 - 0.5; a += span) {
      const b = Math.min(u1, a + span);
      for (let t = 0.08; t < 0.95; t += 0.16) {
        const u = a + (b - a) * t;
        const v = 2.62 - Math.sin(t * Math.PI) * 0.28;
        const p = f.p(u, v, TW - 0.12);
        ctx.B.box(M.bulb, p[0] - 0.05, p[1] - 0.05, p[2] - 0.05, p[0] + 0.05, p[1] + 0.05, p[2] + 0.05, nextId(), { color: bulbCol });
      }
    }
    for (const u of [u0, u1]) fbox(ctx, f, M.frame, u - 0.035, CURB + 0.8, TW - 0.15, u + 0.035, 2.66, TW - 0.08, srgb(0.2, 0.18, 0.24));
    const lp = f.p((u0 + u1) / 2, 2.4, TW - 0.5);
    addLight(lp[0], lp[1], lp[2], 9, bulbCol, 0.7);
  }
  // the restaurant's name in neon on the front of the low wall
  if (spec.terraceName) {
    const [a, b] = segs[0][1] - segs[0][0] > segs[1][1] - segs[1][0] ? segs[0] : segs[1];
    const len = Math.min(b - a - 0.6, 3.0);
    if (len > 1.4) neonSign(ctx, f, spec.terraceName, (a + b) / 2, CURB + 0.42, TW + 0.03, len, hex(pal.neon), { font: r.pick(['Caveat', 'Permanent Marker']), size: 80 });
  }
  // the host's little stand by the way in, the menu on its easel
  {
    const p = f.p(uD + gap + 0.9, CURB, TW + 0.75);
    const id = ctx.objects.begin(ctx, 'stand', p[0], p[2]);
    ctx.B.box(M.prop, p[0] - 0.25, CURB, p[2] - 0.2, p[0] + 0.25, CURB + 1.1, p[2] + 0.2, nextId(), { color: srgb(0.32, 0.22, 0.18) });
    ctx.B.box(M.prop, p[0] - 0.3, CURB + 1.1, p[2] - 0.25, p[0] + 0.3, CURB + 1.16, p[2] + 0.25, nextId(), { color: srgb(0.45, 0.32, 0.24) });
    ctx.col.addCircle(p[0], p[2], 0.3, 0, 1.2, 'prop');
    ctx.objects.end(ctx, id);
    const q = f.p(uD - gap - 0.9, CURB, TW + 0.7);
    const id2 = ctx.objects.begin(ctx, 'sign', q[0], q[2]);
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.62, 0.95, 0.04);
      g.rotateX(s * 0.2);
      // (an easel: two boards leaning on each other, facing along the street)
      g.rotateY(Math.atan2(f.ux, f.uz) + Math.PI / 2);
      g.translate(q[0] + f.nx * s * 0.1, CURB + 0.47, q[2] + f.nz * s * 0.1);
      ctx.B.add(M.prop, g, null, nextId(), { color: s < 0 ? srgb(0.16, 0.22, 0.2) : srgb(0.18, 0.24, 0.22) });
    }
    ctx.objects.end(ctx, id2);
  }
}

// the cafés' tables under big square umbrellas, on the sidewalk by the curb
function cafes(ctx, f, info, spec) {
  const r = ctx.rng;
  const pal = spec.pal;
  const acc = hex(pal.acc);
  const umCol = spec.awning ? spec.awning : r.pick([acc, srgb(0.95, 0.95, 0.92), hex(pal.acc2)]);
  const val = umCol.equals(WHITE) ? acc : WHITE;
  const L = info.L;
  for (let u = 2.4; u < L - 2.0; u += 4.4) {
    const p = f.p(u, 0, 0);
    const z = p[2];
    if (nearCross(z, 2)) continue;
    if (!free(ctx, CAFE_X, z, 1.7)) continue;
    cafeSet(ctx, CAFE_X, z, { chairs: r() < 0.5 ? 2 : 4, a0: r() < 0.5 ? 0 : Math.PI / 4, umbrella: umCol, valance: val, square: true, top: srgb(0.95, 0.94, 0.9) });
  }
}

// the rest of the sidewalk by the hotels: a hydrant, the trash cans and the newspapers by the
// crossings, a lamp now and then on the hotels' side
function sidewalk(ctx) {
  const r = ctx.rng;
  for (let j = 0; j < STREETS.length; j++) {
    const s = STREETS[j];
    for (const side of [-1, 1]) {
      const z = s.z + side * (s.half + s.walk + 1.6);
      if (z < NORTH_EDGE || z > SOUTH_EDGE) continue;
      const x = STREET_X0 - 0.9;
      if (free(ctx, x, z, 0.5)) trashCan(ctx, x, z);
      if (r() < 0.6 && free(ctx, x, z + side * 1.4, 0.5)) newsBox(ctx, x, z + side * 1.4, -Math.PI / 2);
      if (side > 0 && free(ctx, STREET_X0 - 0.5, z + 4.5, 0.5)) hydrant(ctx, STREET_X0 - 0.5, z + 4.5);
    }
  }
}

// ------------------------------------------------------------------ the park
function park(ctx) {
  const M = ctx.M;
  const r = ctx.rng;
  const z0 = NORTH_EDGE - 50;
  const z1 = SOUTH_EDGE + 4;
  const X0 = PROM_X1;
  const X1 = PARK_X1;
  const [bw0, bw1] = BEACH_WALK;
  const pz0 = PIER.z0 - 3;
  const pz1 = PIER.z1 + 3;
  // the ground under it (the park is a curb high, like the sidewalks)
  ctx.B.box(M.wallSolid, X0, -1.6, z0, X1, CURB - 0.01, z1, nextId(), { color: srgb(0.62, 0.52, 0.42), chunk: 'beach' });
  // the crossings of the park: at the end of every street a paved path to the beach, the pier's
  // plaza; between them the lawns
  const cuts = [];
  for (const s of STREETS) cuts.push([s.z - 2.4, s.z + 2.4]);
  cuts.push([pz0, pz1]);
  cuts.sort((a, b) => a[0] - b[0]);
  const spans = [];
  let z = z0;
  for (const [a, b] of cuts) {
    if (a > z) spans.push([z, a]);
    z = Math.max(z, b);
  }
  if (z < z1) spans.push([z, z1]);
  const grass = (x0, x1, za, zb) => {
    const g = new THREE.PlaneGeometry(x1 - x0, zb - za).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, CURB + 0.01, (za + zb) / 2);
    ctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.5, 0.72, 0.44), chunk: 'beach' });
  };
  for (const [a, b] of spans) {
    // (in pieces along the park, so what is far is not drawn)
    for (let za = a; za < b - 0.1; za += 48) {
      const zb = Math.min(b, za + 48);
      grass(X0 + 0.6, bw0, za, zb);
      grass(bw1, X1, za, zb);
    }
  }
  // the beach walk, all the way along; the paths across; the pier's plaza
  for (let za = z0; za < z1 - 0.1; za += 48) slab(ctx, M.prom, bw0, bw1, za, Math.min(z1, za + 48), CURB - 0.01, CURB + 0.02, 8, { chunk: 'beach' });
  for (const s of STREETS) slab(ctx, M.prom, X0, X1, s.z - 2.4, s.z + 2.4, CURB - 0.01, CURB + 0.02, 8, { chunk: 'beach' });
  slab(ctx, M.plaza, X0, X1, pz0, pz1, CURB - 0.01, CURB + 0.025, 4);
  // a low wall of coral stone along the sidewalk, open at the paths and every so often
  {
    const id = nextId();
    const cap = nextId();
    let a = z0;
    const stops = [...cuts.map((c) => [c[0] - 0.4, c[1] + 0.4])];
    for (let zz = z0 + 40; zz < z1; zz += 44) stops.push([zz, zz + 3]);
    stops.sort((p, q) => p[0] - q[0]);
    const runs = [];
    for (const [s0, s1] of stops) {
      if (s0 > a) runs.push([a, s0]);
      a = Math.max(a, s1);
    }
    if (a < z1) runs.push([a, z1]);
    for (const [s0, s1] of runs) {
      if (s1 - s0 < 1) continue;
      ctx.B.box(M.wall, X0 + 0.05, CURB, s0, X0 + 0.55, CURB + 0.42, s1, id, { color: CORAL });
      ctx.B.box(M.wall, X0 + 0.0, CURB + 0.42, s0, X0 + 0.6, CURB + 0.48, s1, cap, { color: srgb(0.94, 0.9, 0.82) });
      ctx.col.addBox(X0 + 0.05, s0, X0 + 0.55, s1, 0, CURB + 0.48, 'prop');
    }
  }
  // the coconut palms, in twos and threes, bent by the wind
  const inCut = (zz, pad) => cuts.some(([a, b]) => zz > a - pad && zz < b + pad);
  for (let zz = z0 + 6; zz < z1 - 4; zz += r.range(9, 15)) {
    const west = Math.floor(zz / 13) % 2 === 0;
    const xa = west ? X0 + 2.4 : bw1 + 1.4;
    const xb = west ? bw0 - 1.4 : X1 - 2.6;
    const k = r.int(1, 3);
    for (let i = 0; i < k; i++) {
      const x = r.range(xa, xb);
      const z = zz + r.range(-2.5, 2.5);
      if (inCut(z, 2.2) || !free(ctx, x, z, 1.4)) continue;
      palm(ctx, r, x, z, r.range(9, 15.5), { lean: r.range(1.3, 2.1) });
    }
  }
  // sea grapes along the dunes' side
  {
    const leafCols = [srgb(0.2, 0.42, 0.22), srgb(0.26, 0.48, 0.26), srgb(0.3, 0.44, 0.2), srgb(0.36, 0.42, 0.2)];
    for (let zz = z0 + 3; zz < z1 - 2; zz += r.range(4, 8)) {
      if (inCut(zz, 1.8)) continue;
      const x = r.range(X1 - 2.6, X1 - 0.9);
      const id = ctx.objects.begin(ctx, 'bush', x, zz);
      const n = r.int(4, 7);
      for (let i = 0; i < n; i++) {
        const s = r.range(0.4, 0.8);
        const g = new THREE.IcosahedronGeometry(s, 1);
        g.scale(1.25, 0.75, 1.15);
        g.translate(x + r.range(-0.9, 0.9), CURB + s * 0.5 + r.range(0, 0.4), zz + r.range(-1.0, 1.0));
        ctx.B.add(M.leaf, g, null, nextId(), { color: r.pick(leafCols) });
      }
      ctx.col.addCircle(x, zz, 1.0, 0, 1.6, 'prop');
      ctx.objects.end(ctx, id);
    }
  }
  // benches along the beach walk, facing the sea; lamps over it; a shower by the paths
  for (let zz = z0 + 14; zz < z1 - 6; zz += 26) {
    if (inCut(zz, 3)) continue;
    if (free(ctx, bw1 + 0.6, zz, 1.0)) bench(ctx, bw1 + 0.6, zz, Math.PI / 2);
  }
  for (let zz = z0 + 4; zz < z1; zz += 24) {
    if (inCut(zz, 1.2)) continue;
    if (free(ctx, bw0 - 0.5, zz, 0.6)) streetLamp(ctx, bw0 - 0.5, zz, 1, 0, { light: Math.round(zz / 24) % 2 === 0 });
  }
  for (const s of STREETS) {
    const x = X1 - 1.2;
    const zz = s.z + 3.6;
    if (zz > z1 || !free(ctx, x, zz, 0.5)) continue;
    const id = ctx.objects.begin(ctx, 'shower', x, zz);
    const g = new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6);
    g.translate(x, CURB + 1.2, zz);
    ctx.B.add(M.pole, g, null, nextId(), { color: srgb(0.85, 0.86, 0.9) });
    const head = new THREE.CylinderGeometry(0.18, 0.08, 0.12, 8);
    head.translate(x + 0.25, CURB + 2.35, zz);
    ctx.B.add(M.pole, head, null, nextId(), { color: srgb(0.85, 0.86, 0.9) });
    ctx.B.box(M.pole, x, CURB + 2.36, zz - 0.03, x + 0.25, CURB + 2.42, zz + 0.03, nextId(), { color: srgb(0.85, 0.86, 0.9) });
    ctx.col.addCircle(x, zz, 0.15, 0, 2.4, 'pole');
    ctx.objects.end(ctx, id);
    if (free(ctx, x - 1.4, zz - 6.2, 0.5)) trashCan(ctx, x - 1.4, zz - 6.2);
  }
  // the lawns are a park (the city's birds and the grass underfoot know it)
  for (const [a, b] of spans) {
    if (b - a < 20) continue;
    ctx.parks.push({ x0: X0, x1: X1, z0: a, z1: b, cx: (bw1 + X1) / 2, cz: (a + b) / 2, beach: true });
  }
}

// ------------------------------------------------------------------ the dunes
function dunes(ctx) {
  const M = ctx.M;
  const r = ctx.rng;
  const z0 = NORTH_EDGE - 50;
  const z1 = SOUTH_EDGE + 2;
  const X0 = PARK_X1;
  const X1 = SAND_X0;
  const crossing = (z) => STREETS.some((s) => Math.abs(z - s.z) < 3.4) || (z > PIER.z0 - 3 && z < PIER.z1 + 3);
  // the sea oats: tufts of long thin blades, straw and green, in pieces along the dunes
  const blades = [srgb(0.78, 0.74, 0.46), srgb(0.62, 0.68, 0.36), srgb(0.84, 0.8, 0.56)];
  for (let za = z0; za < z1; za += 30) {
    const S = new Shape();
    for (let zz = za; zz < Math.min(z1, za + 30); zz += 0.9) {
      if (crossing(zz)) continue;
      for (let k = 0; k < 2; k++) {
        const x = r.range(X0 + 0.6, X1 - 0.4);
        const z = zz + r.range(-0.4, 0.4);
        if (r() < 0.3) continue;
        const y = beachHeight(x, z);
        const n = r.int(4, 7);
        for (let i = 0; i < n; i++) {
          const a = r.range(0, Math.PI * 2);
          const lean = r.range(0.15, 0.45);
          const h = r.range(0.55, 1.15);
          const tx = x + Math.cos(a) * lean * h;
          const tz = z + Math.sin(a) * lean * h;
          const w = 0.035;
          const px = -Math.sin(a) * w;
          const pz = Math.cos(a) * w;
          const A = [x + px, y, z + pz];
          const B = [x - px, y, z - pz];
          const T = [tx, y + h, tz];
          const nn = [Math.cos(a + Math.PI / 2), 0.3, Math.sin(a + Math.PI / 2)];
          S.tri(A, B, T, nn);
          S.tri(B, A, T, nn.map((q, j) => (j === 1 ? q : -q)));
        }
      }
    }
    if (!S.empty) ctx.B.add(M.leaf, S.geo(), null, nextId(), { color: r.pick(blades), chunk: 'beach' });
  }
  // the fences along both edges (posts and a rope), open where the paths cross
  const postCol = srgb(0.6, 0.48, 0.34);
  for (const x of [X0 + 0.35, X1 - 0.35]) {
    let prev = null;
    for (let zz = z0; zz < z1; zz += 2.6) {
      if (crossing(zz) || crossing(zz + 2.6)) {
        prev = null;
        continue;
      }
      const y = beachHeight(x, zz);
      const g = new THREE.CylinderGeometry(0.06, 0.07, 1.0, 5);
      g.translate(x, y + 0.45, zz);
      ctx.B.add(M.pole, g, null, nextId(), { color: postCol });
      if (prev !== null) {
        const len = 2.6;
        const rope = new THREE.CylinderGeometry(0.02, 0.02, len, 4).rotateX(Math.PI / 2);
        rope.translate(x, (y + prev) / 2 + 0.72, zz - len / 2);
        ctx.B.add(M.rail, rope, null, nextId(), { color: srgb(0.9, 0.84, 0.7) });
      }
      prev = y;
    }
  }
  // the paths over the dunes: a boardwalk with its rails, at the end of every street
  for (const s of STREETS) {
    const z = s.z;
    if (z < z0 || z > z1) continue;
    const id = nextId();
    const y0 = beachHeight(X0, z) + 0.06;
    const y1 = beachHeight(X1, z) + 0.06;
    const g = new THREE.BoxGeometry(X1 - X0 + 1.2, 0.1, 3.2);
    g.rotateZ(Math.atan2(y1 - y0, X1 - X0));
    g.translate((X0 + X1) / 2, (y0 + y1) / 2, z);
    const uv = g.attributes.uv;
    const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) / 3, p.getX(i) / 3);
    ctx.B.add(M.deck, g, null, id);
    for (const sd of [-1, 1]) {
      const rid = nextId();
      for (let x = X0; x <= X1 + 0.01; x += (X1 - X0) / 3) {
        const y = y0 + ((y1 - y0) * (x - X0)) / (X1 - X0);
        ctx.B.box(M.frame, x - 0.06, y, z + sd * 1.55 - 0.06, x + 0.06, y + 0.95, z + sd * 1.55 + 0.06, rid, { color: postCol });
      }
      const rl = new THREE.BoxGeometry(Math.hypot(X1 - X0, y1 - y0), 0.08, 0.1);
      rl.rotateZ(Math.atan2(y1 - y0, X1 - X0));
      rl.translate((X0 + X1) / 2, (y0 + y1) / 2 + 0.92, z + sd * 1.55);
      ctx.B.add(M.frame, rl, null, rid, { color: postCol });
    }
  }
}

// ------------------------------------------------------------------ the beach
// the lifeguards' towers: every one painted its own way (as on the real beach), on stilts, a
// ramp up the back, a deck to the sea with its rail, a roof of its own shape, a flag
const TOWER_COLS = [
  ['#ff7eb6', '#ffe14f', '#3fb8c8'], ['#5ec8f0', '#ffffff', '#ff7a5c'], ['#ffd23f', '#8a5cd0', '#ffffff'],
  ['#7fe0b0', '#ff5a8a', '#ffffff'], ['#ff9a3c', '#3a6fd8', '#ffe8c0'], ['#c08af0', '#ffe14f', '#50c8b8'],
  ['#ff5a6a', '#ffffff', '#3fb0e0'], ['#50d0c0', '#ffb43f', '#ffffff'],
];
function lifeguardTower(ctx, x, z, k) {
  const M = ctx.M;
  const r = ctx.rng;
  const [c0, c1, c2] = TOWER_COLS[k % TOWER_COLS.length].map(hex);
  const y = beachHeight(x, z);
  const H = 2.3;
  const id = ctx.objects.begin(ctx, 'tower', x, z);
  // the stilts and their cross braces
  const legCol = srgb(0.92, 0.92, 0.94);
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
    const g = new THREE.CylinderGeometry(0.1, 0.12, H, 6);
    g.translate(x + dx, y + H / 2, z + dz);
    ctx.B.add(M.pole, g, null, nextId(), { color: legCol });
    ctx.col.addCircle(x + dx, z + dz, 0.15, 0, y + H, 'pole');
  }
  // the deck all round and the hut on it
  ctx.B.box(M.prop, x - 1.9, y + H, z - 1.9, x + 2.4, y + H + 0.16, z + 1.9, nextId(), { color: c1 });
  const hid = nextId();
  ctx.B.box(M.prop, x - 1.5, y + H + 0.16, z - 1.4, x + 1.0, y + H + 2.3, z + 1.4, hid, { color: c0 });
  // stripes or chevrons on its sides
  const style = r.int(0, 2);
  if (style === 0) {
    for (let v = 0.4; v < 2.0; v += 0.55) ctx.B.box(M.prop, x - 1.52, y + H + 0.16 + v, z - 1.42, x + 1.02, y + H + 0.16 + v + 0.22, z + 1.42, nextId(), { color: c2 });
  } else if (style === 1) {
    for (let u = -1.2; u < 1.3; u += 0.6) ctx.B.box(M.prop, x - 1.52, y + H + 0.16, z + u, x + 1.02, y + H + 2.3, z + u + 0.24, nextId(), { color: c2 });
  } else {
    ctx.B.box(M.prop, x - 1.52, y + H + 0.16, z - 1.42, x + 1.02, y + H + 0.8, z + 1.42, nextId(), { color: c2 });
  }
  // its windows to the sea and up and down the beach
  ctx.B.box(M.winGlass, x + 1.0, y + H + 1.1, z - 1.0, x + 1.03, y + H + 2.0, z + 1.0, nextId());
  ctx.B.box(M.winGlass, x - 1.1, y + H + 1.1, z - 1.43, x + 0.6, y + H + 2.0, z - 1.4, nextId());
  ctx.B.box(M.winGlass, x - 1.1, y + H + 1.1, z + 1.4, x + 0.6, y + H + 2.0, z + 1.43, nextId());
  // the rail round the deck in front
  const rail = srgb(0.97, 0.97, 0.97);
  const rid = nextId();
  ctx.B.box(M.frame, x + 2.34, y + H + 0.16, z - 1.9, x + 2.42, y + H + 1.1, z + 1.9, rid, { color: rail });
  for (const s of [-1, 1]) ctx.B.box(M.frame, x + 1.0, y + H + 1.02, z + s * 1.86 - 0.04, x + 2.42, y + H + 1.1, z + s * 1.86 + 0.04, rid, { color: rail });
  // the roof
  const roof = r.int(0, 3);
  const rc = c1.clone();
  if (roof === 0) {
    ctx.B.box(M.awning, x - 1.9, y + H + 2.3, z - 1.9, x + 2.5, y + H + 2.48, z + 1.9, nextId(), { color: rc });
  } else if (roof === 1) {
    const g = new THREE.CylinderGeometry(2.1, 2.1, 3.9, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
    g.scale(1, 0.45, 1);
    g.translate(x + 0.2, y + H + 2.3, z);
    ctx.B.add(M.awning, g, null, nextId(), { color: rc });
  } else if (roof === 2) {
    const g = new THREE.ConeGeometry(2.6, 1.3, 4).rotateY(Math.PI / 4);
    g.translate(x + 0.1, y + H + 2.3 + 0.65, z);
    ctx.B.add(M.awning, g, null, nextId(), { color: rc });
  } else {
    const g = new THREE.BoxGeometry(4.6, 0.16, 4.1);
    g.rotateZ(-0.22);
    g.translate(x + 0.3, y + H + 2.75, z);
    ctx.B.add(M.awning, g, null, nextId(), { color: rc });
  }
  // the ramp down the back to the sand
  {
    const len = Math.hypot(4.2, H + 0.1);
    const g = new THREE.BoxGeometry(len, 0.08, 1.1);
    g.rotateZ(Math.atan2(H + 0.1, 4.2));
    g.translate(x - 1.9 - 2.1, y + (H + 0.16) / 2, z + 0.6);
    ctx.B.add(M.prop, g, null, nextId(), { color: srgb(0.85, 0.82, 0.76) });
  }
  // the flag on its pole (the colour of the sea today)
  {
    const g = new THREE.CylinderGeometry(0.03, 0.03, 3.0, 5);
    g.translate(x + 2.3, y + H + 1.5, z + 1.8);
    ctx.B.add(M.pole, g, null, nextId(), { color: rail });
    const flag = r.pick([srgb(0.98, 0.85, 0.2), srgb(0.95, 0.25, 0.25), srgb(0.6, 0.3, 0.75)]);
    ctx.B.box(M.awning, x + 2.32, y + H + 2.3, z + 1.8, x + 2.36, y + H + 2.95, z + 2.75, nextId(), { color: flag });
  }
  ctx.col.addBox(x - 1.9, z - 1.9, x + 2.4, z + 1.9, y + H, y + H + 2.5, 'prop');
  ctx.hideSpots.push({ x, z, r: 1.4, kind: 'tower' });
  ctx.objects.end(ctx, id);
}

// a beach umbrella stuck in the sand (stripes of two colours), its shadow on a towel or two
function beachUmbrella(ctx, x, z, c0, c1, o = {}) {
  const M = ctx.M;
  const y = beachHeight(x, z);
  const id = ctx.objects.begin(ctx, 'umbrella', x, z);
  const tilt = o.tilt || 0;
  const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 5);
  pole.rotateX(tilt);
  pole.translate(x, y + 1.1, z);
  ctx.B.add(M.pole, pole, null, nextId(), { color: WHITE });
  const n = 8;
  const R = o.R || 1.3;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    const top = [0, 0.45, 0];
    const A = [Math.cos(a0) * R, 0, Math.sin(a0) * R];
    const B = [Math.cos(a1) * R, 0, Math.sin(a1) * R];
    g.setAttribute('position', new THREE.Float32BufferAttribute([...top, ...B, ...A, ...top, ...A, ...B], 3));
    g.computeVertexNormals();
    g.rotateX(tilt);
    g.translate(x, y + 2.15, z);
    ctx.B.add(M.awning, g, null, nextId(), { color: k % 2 ? c1 : c0 });
  }
  ctx.objects.end(ctx, id);
}

// a lounger: a white frame, a cushion, its back up
function lounger(ctx, x, z, col) {
  const M = ctx.M;
  const y = beachHeight(x, z);
  const id = nextId();
  ctx.B.box(M.prop, x - 0.95, y + 0.25, z - 0.32, x + 0.45, y + 0.33, z + 0.32, id, { color: WHITE });
  ctx.B.box(M.prop, x - 0.92, y + 0.33, z - 0.28, x + 0.4, y + 0.4, z + 0.28, nextId(), { color: col });
  const g = new THREE.BoxGeometry(0.75, 0.08, 0.6);
  g.rotateZ(0.75);
  g.translate(x - 1.15, y + 0.6, z);
  ctx.B.add(M.prop, g, null, nextId(), { color: col });
  for (const dx of [-0.9, 0.4]) for (const dz of [-0.28, 0.28]) ctx.B.box(M.prop, x + dx - 0.03, y, z + dz - 0.03, x + dx + 0.03, y + 0.27, z + dz + 0.03, id, { color: WHITE });
}

// a towel on the sand (people sit on it, facing the sea)
function towel(ctx, x, z, col, col2) {
  const M = ctx.M;
  const y = beachHeight(x, z);
  ctx.B.box(M.court, x - 0.5, y + 0.005, z - 0.95, x + 0.5, y + 0.03, z + 0.95, nextId(), { color: col });
  ctx.B.box(M.court, x - 0.5, y + 0.03, z - 0.95, x + 0.5, y + 0.035, z - 0.65, nextId(), { color: col2 });
  ctx.seats.push({ x: x - 0.2, z, yaw: Math.PI / 2, beach: true });
}

function beach(ctx) {
  const M = ctx.M;
  const r = ctx.rng;
  // (the beach goes on north, past where you can walk, as far as you can see)
  const z0 = NORTH_EDGE - 610;
  const z1 = SOUTH_EDGE + 40;
  const X0 = PARK_X1 - 0.2;
  const X1 = WATER_X + 26;
  // ---- the sand: a sheet following the ground (the dunes, the slope to the water and on under
  // it), in pieces along the beach
  const DX = 1.5;
  const DZ = 3;
  for (let za = z0; za < z1 - 0.1; za += 90) {
    const zb = Math.min(z1, za + 90);
    const nx = Math.ceil((X1 - X0) / DX);
    const nz = Math.ceil((zb - za) / DZ);
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= nz; j++) {
      const z = za + ((zb - za) * j) / nz;
      for (let i = 0; i <= nx; i++) {
        const x = X0 + ((X1 - X0) * i) / nx;
        let y = beachHeight(Math.max(x, X0 + 0.21), z);
        if (x > WATER_X) y = SAND_TOP - ((SAND_TOP + 0.8) * (x - SAND_X0)) / (WATER_X - SAND_X0);
        pos.push(x, y - 0.005, z);
        uv.push(x / 6, -z / 6);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + nx + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    ctx.B.add(M.sand, g, null, nextId(), { chunk: 'beach' });
  }
  // ---- the wet sand along the water, darker
  for (let za = z0; za < z1 - 0.1; za += 90) {
    const zb = Math.min(z1, za + 90);
    const S = new Shape();
    const up = [0, 1, 0];
    for (let z = za; z < zb - 0.01; z += DZ) {
      const z2 = Math.min(zb, z + DZ);
      const xa = WATER_X - 9;
      const xb = WATER_X + 0.4;
      const h = (x) => SAND_TOP - ((SAND_TOP + 0.8) * (x - SAND_X0)) / (WATER_X - SAND_X0) + 0.012;
      S.quad([xa, h(xa), z], [xb, h(xb), z], [xb, h(xb), z2], [xa, h(xa), z2], up);
    }
    ctx.B.add(M.grass, S.geo(), null, nextId(), { color: srgb(0.8, 0.68, 0.5), chunk: 'beach' });
  }
  // ---- the lifeguard towers, at the end of every street and between
  const spots = [];
  for (let j = 0; j < STREETS.length; j++) {
    spots.push(STREETS[j].z + 6);
    if (j + 1 < STREETS.length) spots.push((STREETS[j].z + STREETS[j + 1].z) / 2);
  }
  spots.push(NORTH_EDGE - 30);
  const towers = spots.filter((z) => !(z > PIER.z0 - 14 && z < PIER.z1 + 14)).sort((a, b) => a - b);
  towers.forEach((z, k) => lifeguardTower(ctx, 72 + r.range(-3, 3), z, k));
  // ---- the umbrellas and loungers you rent, in neat rows near each tower
  const rentals = [[srgb(0.2, 0.42, 0.8), WHITE], [srgb(0.98, 0.82, 0.22), WHITE], [srgb(0.15, 0.62, 0.62), srgb(0.98, 0.96, 0.9)]];
  towers.forEach((tz, k) => {
    const [c0, c1] = rentals[k % rentals.length];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z = tz + s * (9 + i * 4.4);
        if (z > PIER.z0 - 4 && z < PIER.z1 + 4) continue;
        for (const x of [84, 90.5]) {
          beachUmbrella(ctx, x, z, c0, c1, { R: 1.25 });
          lounger(ctx, x - 0.2, z - 0.9, c0);
          lounger(ctx, x - 0.2, z + 0.9, c0);
        }
      }
    }
  });
  // ---- the towels, the umbrellas of the people who came with their own, a cooler, a ball
  const towelCols = [srgb(0.95, 0.35, 0.45), srgb(0.3, 0.6, 0.95), srgb(0.98, 0.8, 0.25), srgb(0.5, 0.82, 0.55), srgb(0.75, 0.45, 0.85), srgb(0.98, 0.6, 0.3), srgb(0.95, 0.95, 0.92)];
  const umCols = [srgb(0.98, 0.42, 0.55), srgb(0.25, 0.7, 0.9), srgb(0.98, 0.78, 0.25), srgb(0.55, 0.85, 0.5), srgb(0.7, 0.45, 0.9), srgb(0.98, 0.55, 0.3)];
  for (let z = NORTH_EDGE + 6; z < SOUTH_EDGE; z += r.range(5, 11)) {
    if (z > PIER.z0 - 3 && z < PIER.z1 + 3) continue;
    if (r() < 0.35) continue;
    const x = r.range(60, 100);
    if (towers.some((t) => Math.abs(t - z) < 4 && Math.abs(x - 72) < 5)) continue;
    const k = r.int(1, 2);
    for (let i = 0; i < k; i++) {
      const tc = r.pick(towelCols);
      towel(ctx, x + i * 1.2, z + r.range(-0.3, 0.3), tc, r.pick(towelCols));
    }
    if (r() < 0.6) beachUmbrella(ctx, x + 0.6, z - 1.4, r.pick(umCols), WHITE, { tilt: r.range(-0.15, 0.15), R: 1.15 });
    if (r() < 0.3) {
      const y = beachHeight(x - 0.9, z + 1.4);
      ctx.B.box(M.prop, x - 1.2, y, z + 1.15, x - 0.6, y + 0.42, z + 1.65, nextId(), { color: r.pick([srgb(0.2, 0.5, 0.85), srgb(0.9, 0.25, 0.25), WHITE]) });
    }
    if (r() < 0.15) {
      const g = new THREE.SphereGeometry(0.2, 10, 6);
      const y = beachHeight(x + 1.5, z);
      g.translate(x + 1.5, y + 0.2, z);
      ctx.B.add(M.propCyl, g, null, nextId(), { color: r.pick([srgb(0.98, 0.3, 0.3), srgb(0.98, 0.85, 0.2), srgb(0.3, 0.6, 0.95)]) });
    }
  }
  // ---- two volleyball nets
  for (const z of [-170, 95]) {
    const x = 64;
    const y = beachHeight(x, z);
    const id = ctx.objects.begin(ctx, 'net', x, z);
    for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
      g.translate(x, y + 1.3, z + s * 4.6);
      ctx.B.add(M.pole, g, null, nextId(), { color: WHITE });
      ctx.col.addCircle(x, z + s * 4.6, 0.1, 0, 2.6, 'pole');
    }
    const nid = nextId();
    ctx.B.box(M.frame, x - 0.02, y + 2.32, z - 4.6, x + 0.02, y + 2.42, z + 4.6, nid, { color: WHITE });
    ctx.B.box(M.frame, x - 0.02, y + 1.62, z - 4.6, x + 0.02, y + 1.66, z + 4.6, nid, { color: WHITE });
    for (let zz = z - 4.4; zz <= z + 4.41; zz += 0.4) ctx.B.box(M.frame, x - 0.01, y + 1.66, zz - 0.01, x + 0.01, y + 2.32, zz + 0.01, nid, { color: srgb(0.2, 0.2, 0.24) });
    // the court's lines in the sand
    for (const s of [-1, 1]) ctx.B.box(M.court, x - 4.5, y + 0.02, z + s * 8 - 0.04, x + 4.5, y + 0.03, z + s * 8 + 0.04, nextId(), { color: srgb(0.2, 0.4, 0.85) });
    ctx.objects.end(ctx, id);
  }
  // ---- surfboards stuck in the sand by a few of the towers
  const boardCols = [srgb(0.98, 0.45, 0.6), srgb(0.3, 0.75, 0.9), srgb(0.98, 0.85, 0.3), srgb(0.95, 0.95, 0.92), srgb(0.5, 0.85, 0.55)];
  towers.forEach((tz, k) => {
    if (k % 3 !== 1) return;
    for (let i = 0; i < 3; i++) {
      const x = 67 + i * 0.7;
      const z = tz - 3.2;
      const y = beachHeight(x, z);
      const g = new THREE.SphereGeometry(0.3, 10, 8);
      g.scale(1, 3.6, 0.22);
      g.rotateZ(0.12 * (i - 1));
      g.translate(x, y + 0.85, z);
      ctx.B.add(M.propCyl, g, null, nextId(), { color: boardCols[(k + i) % boardCols.length] });
    }
  });
  // ---- the surf: lines of foam that come in and go out again
  surf(ctx, z0, z1);
}

// the foam on the waves, in its own meshes (they move: world/city.js update)
function surf(ctx, z0, z1) {
  const M = ctx.M;
  const B = new Batch();
  const lines = [];
  for (let k = 0; k < 3; k++) {
    for (let za = z0; za < z1; za += 90) {
      const zb = Math.min(z1, za + 90);
      const S = new Shape();
      const up = [0, 1, 0];
      const off = k * 4.5;
      const w = 0.5 + k * 0.25;
      for (let z = za; z < zb - 0.01; z += 2) {
        const zz = Math.min(zb, z + 2);
        const wob = (q) => Math.sin(q * 0.05 + k * 2.1) * 0.7 + Math.sin(q * 0.013 + k) * 1.3;
        const xa = WATER_X + off + wob(z);
        const xb = WATER_X + off + wob(zz);
        S.quad([xa, 0, z], [xa + w, 0, z], [xb + w, 0, zz], [xb, 0, zz], up);
      }
      B.add(M.grass, S.geo(), null, nextId(), { color: srgb(0.9, 0.94, 0.97), chunk: `surf${k}` });
    }
    const g = new THREE.Group();
    g.position.y = -0.78;
    ctx.parent.add(g);
    B.flush(g, { dynamic: true, merge: mergeMoving });
    for (const m of g.children) m.userData.noReflect = true;
    lines.push({ g, k });
  }
  ctx.surf = { lines, t: 0 };
}

// the waves come in, break and slide back
export function rollSurf(s, dt) {
  s.t += dt;
  for (const l of s.lines) {
    const ph = s.t * 0.55 - l.k * 1.3;
    l.g.position.x = Math.sin(ph) * 2.2 - 1.2;
    l.g.position.y = -0.78 + Math.max(0, Math.sin(ph)) * 0.06;
  }
}
