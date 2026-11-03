// (intelligence round) A day of their own. Everybody out in the street is somewhere on a day of their
// own, going somewhere for a reason of their own - not walking round and round the block. By the time
// of day and who they are:
//   - early, to work: a coffee from a cart on the way perhaps, then in at an office's door;
//   - at lunch: out of the office to a cart or a café, and back in again;
//   - errands: the pharmacy, the corner store, the bakery - one shop, then another, then home;
//   - after work: home, in at their own front door;
//   - in the evening: out to eat, then home.
// What they do on the way is what the city's people already do (game/streetlife.js: into a shop and
// out with what they bought, a cart; game/streetsocial.js: in at a door) - what is new is that it is
// theirs, one thing after the other, to real places: the walk takes them there across the
// intersections the short way (game/civilians.js nextCorner: their goal), and they can tell you
// where they are going (game/minds.js lingerLine). Not everybody: some are just out for a walk.
//
// Only near you (where it can be seen): a whole day for somebody across the city is nothing to
// anybody, and costs the phone.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;

// shops for an errand, a lunch, an evening out (game/streetlife.js ITEM: the shops one comes out of
// with something)
const ERRAND = /pharma|market|grocer|corner|deli|bakery|books|flor|hardware|tobac|news|phones|shoe|fashion|boutique|records|toys|perfum|optic|electr/;
const FOOD = /pizza|cafe|coffee|burger|diner|taco|sushi|noodle|deli|bakery|food|grill|bistro|eatery|bar/;

// what they say they are doing, if you ask (game/minds.js lingerLine)
const SAY = {
  work: ['Sorry, I am late for work.', 'Cannot stop - meeting in five minutes.', 'Back to the grind.', 'Work. Always work.'],
  lunch: ['Just grabbing some lunch.', 'Lunch break! Finally.', 'Starving. Do you know a good place around here?'],
  errands: ['Just running some errands.', 'I need to pick up a few things.', 'Groceries, then home.'],
  home: ['Heading home. Long day.', 'Home, finally.', 'Going home - see you around.'],
  out: ['Going out to eat. Want to join?', 'Dinner with friends tonight.', 'Off to meet some people.'],
  walk: ['Just out for a walk.', 'Enjoying the weather.', 'Nowhere special. Just walking.'],
};

export class Days {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.stats = { given: 0, walks: 0, steps: 0, shop: 0, cart: 0, door: 0, skipped: 0 };
  }

  update(dt) {
    const game = this.game;
    if (game.classic || !game.civilians || !game.player) return;
    this.t += dt;
    if (this.t < 0.5) return;
    const step = this.t;
    this.t = 0;
    const civs = game.civilians;
    const cam = game.camera.position;
    const h = game.daynight && game.daynight.hour !== undefined ? game.daynight.hour : 12;
    for (const c of civs.list) {
      if (!c.alive || c.inside || c.gone || c.headless) continue;
      const dx = c.pos.x - cam.x;
      const dz = c.pos.z - cam.z;
      if (dx * dx + dz * dz > 90 * 90) continue;
      if (!c.day) {
        // (not the tourists, the youths hanging out, a parent with a child: theirs is their own scene)
        if (civs.plain(c) && !c.jog && c.loop && !c.prom && (!c.role || c.role === 'office' || c.role === 'shopper' || c.role === 'elder')) this.give(c, h);
        continue;
      }
      this.tend(c, step);
    }
  }

  // ------------------------------------------------------------------ a day
  // what this one is out for now, and the places of it
  give(c, h) {
    const office = c.role === 'office';
    let why;
    if (h >= 6.5 && h < 9.8) why = office || chance(0.5) ? 'work' : 'errands';
    else if (h >= 11.6 && h < 14.4) why = office || chance(0.55) ? 'lunch' : 'errands';
    else if (h >= 16.8 && h < 19.3) why = chance(0.6) ? 'home' : 'errands';
    else if (h >= 19.3 || h < 2) why = chance(0.55) ? 'out' : 'home';
    else why = chance(0.65) ? 'errands' : 'walk';
    // (some are just out walking, whatever the hour; a shopper shops; an old man takes his time)
    if (c.role === 'shopper') why = chance(0.8) ? 'errands' : 'home';
    if (c.role === 'elder') why = chance(0.5) ? 'errands' : 'walk';
    if (chance(0.22)) why = 'walk';
    const steps = [];
    if (why === 'work') {
      if (chance(0.4)) {
        const cart = this.cartNear(c);
        if (cart) steps.push(cart);
      }
      const door = this.doorNear(c, 'lobby');
      if (door) steps.push(door);
    } else if (why === 'lunch') {
      const food = chance(0.5) ? this.cartNear(c) || this.shopNear(c, FOOD) : this.shopNear(c, FOOD) || this.cartNear(c);
      if (food) steps.push(food);
      const door = this.doorNear(c, 'lobby');
      if (door) steps.push(door);
    } else if (why === 'errands') {
      const a = this.shopNear(c, ERRAND);
      if (a) steps.push(a);
      const b = chance(0.5) ? this.shopNear(c, ERRAND, a) : null;
      if (b) steps.push(b);
      const door = this.doorNear(c, 'home');
      if (door) steps.push(door);
    } else if (why === 'home') {
      const door = this.doorNear(c, 'home');
      if (door) steps.push(door);
    } else if (why === 'out') {
      const food = this.shopNear(c, FOOD);
      if (food) steps.push(food);
      const door = this.doorNear(c, 'home');
      if (door) steps.push(door);
    }
    if (!steps.length) why = 'walk';
    c.day = { why, steps, i: 0, t: 0, acted: false };
    this.stats.given++;
    if (why === 'walk') this.stats.walks++;
    // (in a hurry to work in the morning; a stroll is a stroll)
    if (why === 'work') c.speed = Math.max(c.speed, 1.45 + Math.random() * 0.25);
    else if (why === 'walk') c.speed = Math.min(c.speed, 1.15 + Math.random() * 0.25);
    this.aim(c);
  }

  // the goal of the walk: the place of the step they are on (game/civilians.js nextCorner)
  aim(c) {
    const S = c.day && c.day.steps[c.day.i];
    c.goal = S ? S.at : null;
    // (critic round: and the way there now - not on to the far corner first, away from it)
    if (c.goal && c.headFor) c.headFor(c.goal);
  }

  next(c) {
    const D = c.day;
    D.i++;
    D.t = 0;
    D.acted = false;
    D.near = undefined;
    this.stats.steps++;
    this.aim(c);
  }

  tend(c, step) {
    const D = c.day;
    const S = D.steps[D.i];
    if (!S) {
      c.goal = null;
      return;
    }
    // (on the way to meet a friend: the meeting is game/streetsocial.js date's - it keeps the goal)
    if (S.kind === 'date') return;
    D.t += step;
    const civs = this.game.civilians;
    if (D.acted) {
      // (taken in hand by the shop, the cart, the door: once they are their own again, the next thing)
      if (civs.plain(c)) this.next(c);
      else if (D.t > 120) this.next(c);
      return;
    }
    // (too long getting there - lost, the way blocked: on to the next thing)
    if (D.t > 150) {
      this.stats.skipped++;
      this.next(c);
      return;
    }
    if (!civs.plain(c)) return;
    // there: on the same sidewalk as the place, and near it
    const d = Math.hypot(S.at.x - c.pos.x, S.at.z - c.pos.z);
    if (d > 9 || !this.sameWalk(c, S.at)) return;
    if (this.act(c, S)) {
      D.acted = true;
      D.t = 0;
    } else if (d < 2.5 || d > (D.near === undefined ? Infinity : D.near) + 1.2) {
      // (closed, full: never mind. (critic round) Past it by now - a shop's door is a few steps
      // off the walk, not often within reach of it: on to the next thing, not to and fro in front
      // of the full shop)
      D.near = undefined;
      this.stats.skipped++;
      this.next(c);
      return;
    }
    D.near = Math.min(D.near === undefined ? Infinity : D.near, d);
  }

  // do the step: into the shop, to the cart, in at the door
  act(c, S) {
    const game = this.game;
    const life = game.streetlife;
    if (S.kind === 'shop' || S.kind === 'cart') {
      const a = life && life.active ? life.active.get(S.s.id) : null;
      if (!a || !a.open || (a.customers || 0) >= 2) return false;
      if (S.kind === 'cart') life.toCart(c, a);
      else life.sendIn(c, a);
      this.stats[S.kind]++;
      return true;
    }
    if (S.kind === 'door') {
      const social = game.crowds && game.crowds.social;
      if (!social || !social.goHome) return false;
      social.goHome(c, S.s);
      this.stats.door++;
      return true;
    }
    return false;
  }

  // the place on the walk they are on (not across the street): the door no further from their
  // sidewalk's line than the sidewalk is wide
  sameWalk(c, p) {
    const L = c.loop;
    if (!L) return false;
    const n = L.length;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const a = L[i];
      const b = L[(i + 1) % n];
      const vx = b[0] - a[0];
      const vz = b[1] - a[1];
      const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / l2));
      const d = Math.hypot(a[0] + vx * t - p.x, a[1] + vz * t - p.z);
      if (d < best) best = d;
    }
    return best < 4.5;
  }

  // ------------------------------------------------------------------ places
  // a shop open now near them (of the kinds re), not `not`; the near ones likelier
  shopNear(c, re, not = null) {
    const life = this.game.streetlife;
    if (!life || !life.active) return null;
    const R = this.game.rhythm;
    const list = [];
    for (const a of life.active.values()) {
      const s = a.shop;
      if (!s || !s.door || s.cart || !a.open || (not && not.s === s)) continue;
      if (!re.test(s.kind || '')) continue;
      if (R && R.open && !R.open(s.kind)) continue;
      const d = Math.hypot(s.door[0] - c.pos.x, s.door[2] - c.pos.z);
      if (d < 6 || d > 110) continue;
      // (their own block's shops first: across the street only now and then, and not far)
      const own = this.sameWalk(c, { x: s.door[0], z: s.door[2] });
      if (!own && d > 60) continue;
      list.push({ s, d: own ? d : d * 2.5 + 20 });
    }
    const p = this.choose(list);
    return p ? { kind: 'shop', s: p.s, at: { x: p.s.door[0], z: p.s.door[2] } } : null;
  }

  cartNear(c) {
    const life = this.game.streetlife;
    if (!life || !life.active) return null;
    const list = [];
    for (const a of life.active.values()) {
      const s = a.shop;
      if (!s || !s.cart || !s.door || !a.open) continue;
      const d = Math.hypot(s.door[0] - c.pos.x, s.door[2] - c.pos.z);
      if (d < 6 || d > 90) continue;
      list.push({ s, d });
    }
    const p = this.choose(list);
    return p ? { kind: 'cart', s: p.s, at: { x: p.s.door[0], z: p.s.door[2] } } : null;
  }

  // a door to go in at: an office's ('lobby') or a home's - facing the street, with its way out. One on
  // their own block's sidewalk: where they live or work is the block they are walking round (a door
  // across the street is a block they would have to find their way round to; game/civilians.js
  // routeTo gets them to a shop over there, a door they would miss as often as not)
  doorNear(c, what) {
    const shops = this.game.world.shops || [];
    const list = [];
    for (const s of shops) {
      if (!s.door) continue;
      if (what === 'home' ? !s.home : s.kind !== 'lobby' || s.home) continue;
      const d = Math.hypot(s.door[0] - c.pos.x, s.door[2] - c.pos.z);
      if (d < 8 || d > 110) continue;
      const n = this.normalOf(s);
      if (!n) continue;
      // (where they turn in at: in front of the door, out past the front yard - game/streetsocial.js
      // goHome walks them in from there)
      const out = 1.6 + (s.yard || 0);
      const at = { x: s.door[0] + n[0] * out, z: s.door[2] + n[1] * out };
      if (!this.sameWalk(c, at)) continue;
      // (critic round: and the door itself on their block - inside their walk round it. The front
      // yard of a house across the street reached out to their walk, and in they went: over the
      // street, through somebody else's garden, and stuck there against its fence)
      if (!this.inWalk(c, s.door[0], s.door[2])) continue;
      list.push({ s, d, n, at });
    }
    const p = this.choose(list);
    if (!p) return null;
    // (game/streetsocial.js goHome: the door's way out to the street)
    if (p.s.nx === undefined) {
      p.s.nx = p.n[0];
      p.s.nz = p.n[1];
    }
    return { kind: 'door', s: p.s, at: p.at };
  }

  // (x, z) inside the walk round their block (a block's walk is a rectangle round it)
  inWalk(c, x, z) {
    const L = c.loop;
    if (!L || L.length !== 4) return true;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of L) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[1]);
      z1 = Math.max(z1, p[1]);
    }
    return x > x0 && x < x1 && z > z0 && z < z1;
  }

  normalOf(s) {
    if (s.nx !== undefined) return [s.nx, s.nz];
    const f = s.room && s.room.facade;
    if (f && f.nx !== undefined) return [f.nx, f.nz];
    return null;
  }

  // one of the places, the nearer the likelier (a weight of 1/d)
  choose(list) {
    if (!list.length) return null;
    let sum = 0;
    for (const p of list) sum += 1 / (p.d + 10);
    let r = Math.random() * sum;
    for (const p of list) {
      r -= 1 / (p.d + 10);
      if (r <= 0) return p;
    }
    return list[list.length - 1];
  }

  // ------------------------------------------------------------------ for what they say
  // what they are doing, said to you
  lineFor(c) {
    const D = c.day;
    if (!D) return null;
    const why = D.steps[D.i] ? D.why : 'walk';
    return pick(SAY[why] || SAY.walk);
  }
}
