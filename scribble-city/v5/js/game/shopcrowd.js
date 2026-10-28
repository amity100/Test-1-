import { civilianLook, kidLook, elderLook, shopkeeperLook } from './looks.js';
import { groundHeight } from '../world/layout.js';

// (v5, ROADMAP 11.35) The people in the stores that are not open whole. Only the shops nearest you
// are opened by game/streetlife.js - their keeper and their customers whole people (on a phone
// three or four, on a computer six, ten in a mall). In every other shop near you there are people
// all the same: its keeper behind the counter, a few customers along its shelves, at its mirror,
// at its tables - drawn the cheap way the crowd down the street is (game/farcrowd.js,
// PersonRenderer.drawCheap: in the same batches as everybody, nothing to bump into). Now and then
// one of them goes over to another shelf, to the mirror, to the counter.
//
// (ROADMAP 11.45) Every shop near you - the street's as well as the malls', and the seller at a
// stand - and nobody comes or goes when a shop is opened: its whole people are these same people,
// where they stand, in what they wear (game/streetlife.js OpenShop, take); when it is let go of,
// they are these again, where they had got to (giveBack). The way a walker of the far crowd
// becomes a whole one and back (game/farcrowd.js).

const NEAR = 75;
const NEAR_PHONE = 55;
// (once shown, a shop's people stay until it is this much further: no flicker at the edge)
const OUT = 10;
const KINDS = ['chic', 'street', 'smart', 'summer', 'knit', 'denim', 'casual', 'sporty', 'trench'];
// (how full a store is, by what it sells: the food counters and the cafés busiest)
const BUSY = { cafe: 4, icecream: 4, juice: 3, pizza: 4, sushi: 3, burger: 4, tacos: 3, noodles: 3, fashion: 4, shoes: 3, boutique: 3, toys: 3, phones: 3, electronics: 3, books: 3, sports: 3 };
// (the places that run an evening or a scene of their own, game/venuelife.js and the friends'
// stand: their own people, theirs to bring)
const OWN = new Set(['bar', 'club', 'cinema', 'theatre', 'lobby', 'friends', 'barber']);

export class ShopCrowd {
  constructor(game) {
    this.game = game;
    this.byShop = new Map();
    this.shown = [];
    this.shownSet = new Set();
    this.t = 0;
    // (counted for the tests)
    this.stats = { stores: 0, people: 0, taken: 0, given: 0 };
  }

  get near() {
    return this.game.touch ? NEAR_PHONE : NEAR;
  }

  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar || game.params.has('noshopcrowd')) {
      this.shown = [];
      this.shownSet.clear();
      return;
    }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.5;
      this.pick();
    }
    const open = game.streetlife ? game.streetlife.active : null;
    for (const g of this.shown) {
      if (open && open.has(g.s.id)) continue;
      for (const w of g.people) this.step(w, g, dt);
    }
  }

  // a shop whose people are drawn here: a room with places to stand or sit in (not a home, not a
  // place with an evening of its own), or a stand with its seller
  ok(s) {
    if (s.home || s.shut || OWN.has(s.kind)) return false;
    const R = s.room;
    if (!R) return !!(s.stand && s.keeper);
    if (!R.browse || (R.marks && R.marks.host)) return false;
    return !!(R.browse.length || (R.seats && R.seats.length));
  }

  // the shops near you that are not open whole
  pick() {
    const game = this.game;
    const p = game.anchorPos();
    const open = game.streetlife ? game.streetlife.active : null;
    const R0 = game.rhythm;
    const near = this.near;
    const cands = [];
    for (const s of game.world.shops || []) {
      // (closed at this hour: dark, nobody in it - game/rhythm.js)
      if ((R0 && !R0.open(s.kind)) || !this.ok(s)) continue;
      // (the mega mall's floors one over another: the shops on your own floor first)
      const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z) + Math.abs(s.door[1] - p.y) * 2.5;
      if (d < near + (this.shownSet.has(s) ? OUT : 0)) cands.push([d, s]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    const max = game.touch ? 12 : 30;
    const out = [];
    for (let i = 0; i < Math.min(max, cands.length); i++) out.push(this.crowdOf(cands[i][1]));
    this.shown = out;
    this.shownSet = new Set(out.map((g) => g.s));
    const drawn = out.filter((g) => !(open && open.has(g.s.id)));
    this.stats.stores = drawn.length;
    this.stats.people = drawn.reduce((n, g) => n + g.people.length, 0);
    // (the people of shops long left behind: forgotten, made afresh if you ever come back)
    if (this.byShop.size > 400) {
      for (const s of [...this.byShop.keys()]) if (!this.shownSet.has(s) && Math.hypot(s.door[0] - p.x, s.door[2] - p.z) > 300) this.byShop.delete(s);
    }
  }

  // where somebody stands in a shop: its floor (a store up on a floor of a mall, as
  // game/civilians.js spawnScripted lifts its people)
  yAt(s, x, z) {
    const R = s.room;
    return groundHeight(x, z) + (R && R.floor > 1.5 ? R.floor - 0.15 : 0);
  }

  // a shop's people: made once (the same ones every time you come by)
  crowdOf(s) {
    let g = this.byShop.get(s);
    if (g) return g;
    const R = s.room;
    const spots = R ? [...R.browse, ...(R.mirrors || []), ...(R.seats || [])] : [];
    const people = [];
    if (R) {
      const n = Math.min(spots.length, (BUSY[s.kind] || 2) - (this.game.touch ? 1 : 0) + Math.floor(Math.random() * 2));
      const used = new Set();
      for (let i = 0; i < n; i++) {
        let k = Math.floor(Math.random() * spots.length);
        for (let t = 0; t < 6 && used.has(k); t++) k = (k + 1) % spots.length;
        if (used.has(k)) break;
        used.add(k);
        const sp = spots[k];
        const r = Math.random();
        const look = r < 0.08 ? kidLook() : r < 0.16 ? elderLook(Math.random() < 0.5) : civilianLook({ kind: KINDS[Math.floor(Math.random() * KINDS.length)] });
        people.push(this.person(s, look, sp.x, sp.z, sp.yaw || 0, { sit: R.seats && R.seats.includes(sp) ? 1 : 0, at: sp, t: 4 + Math.random() * 14 }));
      }
    }
    // the café's tables out on the sidewalk, somebody with a coffee at each (game/streetlife.js seat)
    const T = s.spots && s.spots.tables;
    if (T) for (let i = 0; i < Math.min(T.length, this.game.touch ? 1 : T.length); i++) people.push(this.atTable(s, i, civilianLook(), Math.random() < 0.5 ? 1 : -1));
    // the keeper behind the counter, or at the stand: the one the shop has when it is opened
    const keeperLook = shopkeeperLook(s.kind, s.fem);
    const k = this.keeperSpot(s);
    if (k) people.push(this.person(s, keeperLook, k.x, k.z, k.yaw, { keeper: true, t: 1e9 }));
    g = { s, people, spots, keeperLook };
    this.byShop.set(s, g);
    return g;
  }

  keeperSpot(s) {
    const R = s.room;
    if (R && R.keeper) return { x: R.keeper.x, z: R.keeper.z, yaw: R.keeper.yaw || 0 };
    return s.keeper ? { x: s.keeper[0], z: s.keeper[2], yaw: s.face || 0 } : null;
  }

  // at a table out on the sidewalk, on its side (1 or -1), turned to it
  atTable(s, i, look, side) {
    const tb = s.spots.tables[i];
    const x = tb.x + s.rx * side * 0.72;
    const z = tb.z + s.rz * side * 0.72;
    return this.person(s, look, x, z, Math.atan2(-s.rx * side, -s.rz * side), { sit: 1, table: i, side, t: 1e9 });
  }

  person(s, look, x, z, yaw, o = {}) {
    return { look, seed: Math.random() * 100, phase: Math.random() * 6, scale: look.build.height, x, y: this.yAt(s, x, z), z, yaw, speed: 0, sit: 0, at: null, to: null, t: 0, ...o };
  }

  // (ROADMAP 11.45) a shop opened whole (game/streetlife.js OpenShop): its people as they are now,
  // to be its whole ones - { keeperLook, people: [{ look, x, z, yaw, sit, at, to }] (inside),
  // tables: [{ look, table, side }] (out on the sidewalk) } - or null
  take(s) {
    const g = this.byShop.get(s);
    if (!g) return null;
    this.stats.taken++;
    return { keeperLook: g.keeperLook, people: g.people.filter((w) => !w.keeper && w.table === undefined), tables: g.people.filter((w) => w.table !== undefined) };
  }

  // (ROADMAP 11.45) a shop let go of: its people go on here as they were - list: [{ look, x, z,
  // yaw, sit, spot }] (the ones still inside) and [{ look, table, side }] (at its tables outside),
  // keeperLook (its keeper's)
  giveBack(s, list, keeperLook) {
    if (!this.ok(s)) return;
    const R = s.room;
    const spots = R ? [...R.browse, ...(R.mirrors || []), ...(R.seats || [])] : [];
    const people = [];
    for (const v of list) {
      if (v.table !== undefined && s.spots && s.spots.tables && s.spots.tables[v.table]) people.push(this.atTable(s, v.table, v.look, v.side));
    }
    for (const v of R ? list : []) {
      if (v.table !== undefined) continue;
      const at = v.spot && spots.includes(v.spot) ? v.spot : null;
      // (walking somewhere in the store: on to a place to stand)
      const free = !at ? spots.filter((sp) => !(R.seats || []).includes(sp) && !people.some((w) => w.at === sp || w.to === sp)) : null;
      const to = free && free.length ? free[Math.floor(Math.random() * free.length)] : null;
      if (!at && !to) continue;
      people.push(this.person(s, v.look, v.x, v.z, v.yaw, { sit: at && v.sit ? 1 : 0, at: at || to, to: at ? null : to, t: 4 + Math.random() * 12 }));
    }
    const k = this.keeperSpot(s);
    const kl = keeperLook || (this.byShop.get(s) || {}).keeperLook || shopkeeperLook(s.kind, s.fem);
    if (k) people.push(this.person(s, kl, k.x, k.z, k.yaw, { keeper: true, t: 1e9 }));
    this.byShop.set(s, { s, people, spots, keeperLook: kl });
    this.stats.given++;
    // (shown from the next look round: the shop is still open whole until then)
    this.t = 0;
  }

  // a customer: stands a while at a shelf (a step this way and that, a look along it), then goes over
  // to another place in the store
  step(w, g, dt) {
    if (w.keeper || w.sit) return;
    if (w.to) {
      const dx = w.to.x - w.x;
      const dz = w.to.z - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        w.at = w.to;
        w.to = null;
        w.speed = 0;
        w.yaw = w.at.yaw || w.yaw;
        w.t = 5 + Math.random() * 14;
        return;
      }
      const v = Math.min(d, 1.0 * dt);
      w.x += (dx / d) * v;
      w.z += (dz / d) * v;
      w.yaw = Math.atan2(dx, dz);
      w.speed = 1.0;
      w.phase += (dt * Math.PI * 2) / 1.5;
      return;
    }
    // (shifting the weight, the head turning along the shelf)
    w.phase += dt * 0.6;
    w.yaw = ((w.at && w.at.yaw) || 0) + Math.sin(w.phase * 0.7 + w.seed) * 0.25;
    w.t -= dt;
    if (w.t > 0) return;
    // to a free place in the store (not a seat)
    const free = g.spots.filter((sp) => !g.people.some((o) => o !== w && (o.at === sp || o.to === sp)) && !(g.s.room.seats || []).includes(sp));
    if (!free.length) {
      w.t = 6;
      return;
    }
    w.to = free[Math.floor(Math.random() * free.length)];
  }

  draw(camPos) {
    if (!this.shown.length) return;
    const bodies = this.game.figures.bodies;
    const open = this.game.streetlife ? this.game.streetlife.active : null;
    const far = (this.near + OUT) * (this.near + OUT);
    for (const g of this.shown) {
      // (open whole: its people are the whole ones now)
      if (open && open.has(g.s.id)) continue;
      for (const w of g.people) {
        const dx = w.x - camPos.x;
        const dz = w.z - camPos.z;
        if (dx * dx + dz * dz > far) continue;
        bodies.drawCheap(w);
      }
    }
  }
}
