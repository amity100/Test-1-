import { civilianLook, kidLook, elderLook, modest } from './looks.js';

// (v5, ROADMAP 11.35) The people in the mall's other stores. Only the stores nearest you are opened
// by game/streetlife.js - their keeper and their customers whole people (on a phone four, on a
// computer ten when you are in a mall). In every other store of a mall near you there are people
// all the same: its keeper behind the counter, a few customers along its shelves, at its mirror,
// at its tables - drawn the cheap way the crowd down the street is (game/farcrowd.js,
// PersonRenderer.drawCheap: in the same batches as everybody, nothing to bump into). Now and then
// one of them goes over to another shelf, to the mirror, to the counter. When a store is opened
// they give way to its whole people; when you come back they are the same people.

const NEAR = 40;
const KINDS = ['chic', 'street', 'smart', 'summer', 'knit', 'denim', 'casual', 'sporty', 'trench'];
// (how full a store is, by what it sells: the food counters and the cafés busiest)
const BUSY = { cafe: 4, icecream: 4, juice: 3, pizza: 4, sushi: 3, burger: 4, tacos: 3, noodles: 3, fashion: 4, shoes: 3, boutique: 3, toys: 3, phones: 3, electronics: 3, books: 3, sports: 3 };

export class ShopCrowd {
  constructor(game) {
    this.game = game;
    this.byShop = new Map();
    this.shown = [];
    this.t = 0;
    // (counted for the tests)
    this.stats = { stores: 0, people: 0 };
  }

  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar || game.params.has('noshopcrowd')) {
      this.shown = [];
      return;
    }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.5;
      this.pick();
    }
    for (const g of this.shown) for (const w of g.people) this.step(w, g, dt);
  }

  // the stores near you, of the malls near you, that are not open whole
  pick() {
    const game = this.game;
    const ml = game.mallLife;
    const cam = game.camera.position;
    const open = game.streetlife ? game.streetlife.active : null;
    const cands = [];
    if (ml) {
      for (const m of ml.active.keys()) {
        for (const list of [m.stores, m.upStores, m.food]) {
          if (!list) continue;
          for (const s of list) {
            const R = s.room;
            if (!R || !R.browse || (!R.browse.length && !(R.seats && R.seats.length))) continue;
            if (open && open.has(s.id)) continue;
            const d = Math.hypot(s.win[0] - cam.x, s.win[2] - cam.z) + Math.abs((R.floor || 0) - cam.y + 1.6) * 2;
            if (d < NEAR) cands.push([d, s]);
          }
        }
      }
    }
    cands.sort((a, b) => a[0] - b[0]);
    const max = game.touch ? 8 : 22;
    const out = [];
    for (let i = 0; i < Math.min(max, cands.length); i++) out.push(this.crowdOf(cands[i][1]));
    this.shown = out;
    this.stats.stores = out.length;
    this.stats.people = out.reduce((n, g) => n + g.people.length, 0);
  }

  // a store's people: made once (the same ones every time you come by)
  crowdOf(s) {
    let g = this.byShop.get(s);
    if (g) return g;
    const R = s.room;
    const y = R.floor || 0;
    const spots = [...R.browse, ...(R.mirrors || []), ...(R.seats || [])];
    const n = Math.min(spots.length, (BUSY[s.kind] || 2) - (this.game.touch ? 1 : 0) + Math.floor(Math.random() * 2));
    const people = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let k = Math.floor(Math.random() * spots.length);
      for (let t = 0; t < 6 && used.has(k); t++) k = (k + 1) % spots.length;
      if (used.has(k)) break;
      used.add(k);
      const sp = spots[k];
      const r = Math.random();
      const look = r < 0.08 ? kidLook() : r < 0.16 ? elderLook(Math.random() < 0.5) : civilianLook({ kind: KINDS[Math.floor(Math.random() * KINDS.length)] });
      people.push({ look, seed: Math.random() * 100, phase: Math.random() * 6, scale: look.build.height, x: sp.x, y, z: sp.z, yaw: sp.yaw || 0, speed: 0, sit: R.seats && R.seats.includes(sp) ? 1 : 0, at: sp, to: null, t: 4 + Math.random() * 14 });
    }
    // the keeper behind the counter
    if (R.keeper) {
      const look = modest(civilianLook({ kind: 'smart' }));
      people.push({ look, seed: Math.random() * 100, phase: 0, scale: look.build.height, x: R.keeper.x, y, z: R.keeper.z, yaw: R.keeper.yaw || 0, speed: 0, sit: 0, keeper: true, t: 1e9 });
    }
    g = { s, people, spots, used };
    this.byShop.set(s, g);
    return g;
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
    w.yaw = (w.at.yaw || 0) + Math.sin(w.phase * 0.7 + w.seed) * 0.25;
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
    for (const g of this.shown) {
      for (const w of g.people) {
        const dx = w.x - camPos.x;
        const dz = w.z - camPos.z;
        if (dx * dx + dz * dz > NEAR * NEAR * 1.3) continue;
        bodies.drawCheap(w);
      }
    }
  }
}
