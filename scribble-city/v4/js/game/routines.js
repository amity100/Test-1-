import { civilianLook } from './looks.js';
import { groundHeight } from '../world/layout.js';

// Everyday life on the street (ROADMAP 3.1). The benches, the bus stops and the café tables on
// the plaza are used:
//   a bench    somebody with the paper, a book, a coffee, an apple or an ice cream, on the phone,
//              or two friends talking; after a while they get up and walk on, and now and then
//              somebody passing sits down. Nobody sits in the rain.
//   a bus stop people wait on its bench or by its sign, looking down the road; when the bus stops
//              they get on, somebody gets off and walks away. In the rain the shelter fills up.
//   the plaza  coffee at the tables round the fountain.
// Only the places near you are lived in (a handful of them, fewer on a phone); the people on them
// come from the street (or were there already when you came by) and go back to it.
//
// (?classic: none of this, the street exactly as it was: the "same picture" check)

const RANGE = 58;
const LET_GO = 80;
const CHAT = ['Did you see that?', 'No way!', 'Ha! True.', 'And then what?', 'Exactly.', 'I know, right?', 'Same here.', 'Seriously?', 'Love this spot.', 'Look at the sky.'];
const PHONE = ['Uh-huh.', "I'm on my way.", 'Yeah, yeah.', 'Call you back!', 'No, the other one.', 'Love you too.', "I'm at the stop."];
const WAIT = ['Where is that bus?', 'Late again.', '...', 'Any minute now.'];

function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}

export class Routines {
  constructor(game) {
    this.game = game;
    this.places = [];
    this.scanT = 0;
    this.sitT = 4;
    this.waitT = 3;
    const w = game.world;
    // a bench: two seats side by side, facing where the bench faces
    for (const b of w.benches || []) {
      const fx = Math.sin(b.yaw);
      const fz = Math.cos(b.yaw);
      const seats = [-0.42, 0.42].map((u) => ({ x: b.x + fz * u + fx * 0.04, z: b.z - fx * u + fz * 0.04, yaw: b.yaw, who: null }));
      this.places.push({ kind: 'bench', x: b.x, z: b.z, yaw: b.yaw, seats, stands: [], active: false });
    }
    // a bus stop: its bench's three seats, and two places to stand by the sign, facing the road
    const stops = w.busStops || [];
    for (const st of stops) {
      const fx = Math.sin(st.yaw);
      const fz = Math.cos(st.yaw);
      const at = (u, v) => ({ x: st.x + fz * u + fx * v, z: st.z - fx * u + fz * v, yaw: st.yaw, who: null });
      const seats = (w.seats || []).filter((s) => s.bus && Math.hypot(s.x - st.x, s.z - st.z) < 2.5).map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, who: null }));
      this.places.push({ kind: 'bus', stop: st, x: st.x, z: st.z, yaw: st.yaw, seats, stands: [at(2.0, 0.35), at(2.6, 0.1)], active: false });
    }
    // the plaza's café tables: the chairs round each table
    const cafe = (w.seats || []).filter((s) => !s.bus);
    const tables = [];
    for (const s of cafe) {
      let t = tables.find((o) => Math.hypot(o.x - s.x, o.z - s.z) < 2.2);
      if (!t) {
        t = { x: s.x, z: s.z, list: [] };
        tables.push(t);
      }
      t.list.push(s);
    }
    for (const t of tables) {
      const seats = t.list.map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, who: null }));
      this.places.push({ kind: 'cafe', x: t.x, z: t.z, yaw: 0, seats, stands: [], active: false });
    }
    this.people = new Set();
    // (counted for the tests: who got on a bus, who got off)
    this.boarded = 0;
    this.alighted = 0;
  }

  get budget() {
    return this.game.touch ? 4 : 8;
  }

  // (at most this many people on the benches and at the stops round you: each one costs a
  // little every frame)
  get most() {
    return this.game.touch ? 6 : 12;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    const p = game.anchorPos();
    const R = game.rhythm;
    const rain = game.weather ? game.weather.cur.rain : 0;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.7;
      // the places round you (the nearest few), the rest let go
      const near = [];
      for (const pl of this.places) {
        const d = Math.hypot(pl.x - p.x, pl.z - p.z);
        if (d < RANGE) near.push([d, pl]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const want = new Set(near.slice(0, this.budget).map((n) => n[1]));
      for (const pl of this.places) {
        if (!pl.active) continue;
        const d = Math.hypot(pl.x - p.x, pl.z - p.z);
        if (!want.has(pl) && d > LET_GO) this.letGo(pl);
      }
      for (const pl of want) {
        if (pl.active) continue;
        pl.active = true;
        this.fill(pl, R, rain);
      }
    }
    // somebody passing sits down / comes to wait for the bus
    this.sitT -= dt;
    if (this.sitT <= 0) {
      this.sitT = 2.5 + Math.random() * 3;
      this.invite(rain);
    }
    // the buses: who gets on, who gets off
    this.waitT -= dt;
    if (this.waitT <= 0) {
      this.waitT = 0.4;
      this.buses();
    }
    for (const pl of this.places) if (pl.active) this.tend(pl, dt, rain);
  }

  // a place you just came near: some of it is taken already
  fill(pl, R, rain) {
    const busy = (R ? R.people : 1) * (this.game.daynight && this.game.daynight.hour > 21.5 ? 0.5 : 1);
    if (pl.kind === 'bus') {
      const n = Math.random() < busy * (rain > 0.2 ? 1 : 0.75) ? 1 + Math.floor(Math.random() * (rain > 0.2 ? 4 : 2.6)) : 0;
      const spots = [...pl.seats, ...pl.stands].sort(() => Math.random() - 0.5);
      for (let i = 0; i < n && i < spots.length; i++) this.sitNew(pl, spots[i], 'wait');
      return;
    }
    if (rain > 0.15) return;
    if (pl.kind === 'cafe') {
      if (Math.random() < 0.55 * busy) {
        const n = Math.min(pl.seats.length, 1 + Math.floor(Math.random() * 2.2));
        for (let i = 0; i < n; i++) this.sitNew(pl, pl.seats[i], n > 1 ? 'chat' : 'cafe');
      }
      return;
    }
    const r = Math.random();
    if (r < 0.2 * busy) {
      this.sitNew(pl, pl.seats[0], 'chat');
      this.sitNew(pl, pl.seats[1], 'chat');
    } else if (r < 0.55 * busy) this.sitNew(pl, pl.seats[Math.random() < 0.5 ? 0 : 1], null);
  }

  // let a place go: its people go with it (it is far from you)
  letGo(pl) {
    pl.active = false;
    for (const s of [...pl.seats, ...pl.stands]) {
      if (s.who) {
        const v = s.who;
        s.who = null;
        if (v.c && v.c.owner === this) this.game.civilians.remove(v.c);
        this.people.delete(v);
      }
    }
  }

  // somebody already there when you came by
  sitNew(pl, spot, what) {
    if (!spot || spot.who || this.people.size >= this.most) return null;
    const c = this.game.civilians.spawnScripted(spot.x, spot.z, civilianLook(), this);
    c.pos.set(spot.x, groundHeight(spot.x, spot.z), spot.z);
    c.yaw = spot.yaw;
    c.noCollide = true;
    const v = this.take(pl, spot, c, what, true);
    v.t = Math.random() * v.stay * 0.7;
    return v;
  }

  // the spot is somebody's: what they do there (and for how long)
  take(pl, spot, c, what, already) {
    const sitting = pl.seats.includes(spot);
    // (sitting or waiting still: far away their pose is redrawn less often, Civilians.update)
    c.still = true;
    const v = { pl, spot, c, sitting, phase: already ? 'at' : 'go', t: 0, own: already, talkT: 2 + Math.random() * 6, biteT: 2 + Math.random() * 4 };
    if (!what) what = pick(['paper', 'book', 'coffee', 'phone', 'apple', 'icecream', 'idle', 'idle']);
    if (pl.kind === 'bus') what = Math.random() < 0.45 ? 'phone' : Math.random() < 0.3 ? 'paper' : 'wait';
    if (pl.kind === 'cafe' && what !== 'chat') what = Math.random() < 0.7 ? 'coffee' : 'icecream';
    v.what = what;
    v.stay = pl.kind === 'bus' ? 1e9 : what === 'chat' ? 50 + Math.random() * 80 : 35 + Math.random() * 110;
    const f = c.fig;
    if (!c.fig.carry) {
      f.carry = what === 'paper' ? 'newspaper' : what === 'book' ? 'book' : what === 'coffee' ? 'coffee' : what === 'phone' ? 'phone' : what === 'apple' ? 'apple' : what === 'icecream' ? 'icecream' : f.carry;
    }
    if (pl.kind === 'cafe' && what === 'chat' && !f.carry) f.carry = 'coffee';
    spot.who = v;
    c.ctrl = (civ, dt) => this.step(v, dt);
    this.people.add(v);
    return v;
  }

  // ------------------------------------------------------------------ the people on them
  step(v, dt) {
    const c = v.c;
    v.t += dt;
    const s = v.spot;
    if (v.phase === 'go') {
      const d = Math.hypot(c.pos.x - s.x, c.pos.z - s.z);
      if (v.t > 25) {
        this.done(v, false);
        return null;
      }
      if (d < (v.sitting ? 0.9 : 0.35)) {
        v.phase = 'at';
        v.t = 0;
        c.noCollide = true;
      } else return { x: s.x, z: s.z, speed: c.speed };
    }
    if (v.phase === 'board') {
      const d = Math.hypot(c.pos.x - v.door.x, c.pos.z - v.door.z);
      if (d < 0.7 || v.t > 9) {
        this.boarded++;
        this.done(v, true);
        return null;
      }
      return { x: v.door.x, z: v.door.z, speed: c.speed * 1.2 };
    }
    // at the spot
    c.faceYaw = s.yaw;
    if (v.sitting) {
      c.pos.x += (s.x - c.pos.x) * Math.min(1, dt * 8);
      c.pos.z += (s.z - c.pos.z) * Math.min(1, dt * 8);
      c.fig.sit = Math.min(1, c.fig.sit + dt * 3);
    }
    const f = c.fig;
    // a sip, a bite
    if (f.carry === 'coffee' || f.carry === 'apple' || f.carry === 'icecream') {
      v.biteT -= dt;
      if (v.biteT < 0) {
        f.drinkT = Math.min(1, -v.biteT / 1.1);
        if (v.biteT < -1.1) {
          v.biteT = 3 + Math.random() * 6;
          f.drinkT = -1;
        }
      }
    }
    // a word now and then (the friends answer each other)
    v.talkT -= dt;
    if (v.talkT < 0) {
      v.talkT = v.what === 'chat' ? 4 + Math.random() * 6 : 9 + Math.random() * 14;
      const near = Math.hypot(c.pos.x - this.game.player.pos.x, c.pos.z - this.game.player.pos.z) < 22;
      if (near && this.game.bubbles) {
        if (v.what === 'chat') this.game.bubbles.say(c, pick(CHAT));
        else if (v.what === 'phone') this.game.bubbles.say(c, pick(PHONE));
        else if (v.pl.kind === 'bus' && Math.random() < 0.4) this.game.bubbles.say(c, pick(WAIT));
      }
    }
    // waiting for the bus: a look down the road now and then
    if (v.pl.kind === 'bus' && !v.sitting) c.faceYaw = s.yaw + Math.sin(v.t * 0.35) * 0.9;
    if (v.t > v.stay) this.done(v, false);
    return null;
  }

  // up and away: back to the street (or into the bus)
  done(v, gone) {
    const c = v.c;
    if (v.spot.who === v) v.spot.who = null;
    this.people.delete(v);
    if (!c) return;
    if (gone) {
      this.game.civilians.remove(c);
      return;
    }
    const keep = c.fig.carry;
    c.still = false;
    this.game.civilians.release(c);
    // (back to being one of the street's own: counted with them, sent home with them)
    c.scripted = false;
    this.game.civilians.rejoin(c);
    c.fig.carry = keep;
    c.carryUntil = this.game.time + 30;
  }

  // keep a place's people in order: the hurt or the frightened leave it, the rain sends the bench
  // sitters home
  tend(pl, dt, rain) {
    for (const s of pl.seats.concat(pl.stands)) {
      const v = s.who;
      if (!v) continue;
      const c = v.c;
      if (!c.alive || c.panicT > 0 || c.headless || c.ctrl === null) {
        s.who = null;
        this.people.delete(v);
        if (c.alive && c.ctrl) {
          this.game.civilians.release(c);
          c.scripted = false;
          this.game.civilians.rejoin(c);
        } else c.fig.sit = 0;
        continue;
      }
      if (rain > 0.25 && pl.kind !== 'bus' && v.phase === 'at' && Math.random() < dt * 0.4) this.done(v, false);
    }
  }

  // somebody walking past takes a free seat (or comes to wait for the bus)
  invite(rain) {
    const game = this.game;
    const free = [];
    for (const pl of this.places) {
      if (!pl.active) continue;
      if (rain > 0.15 && pl.kind !== 'bus') continue;
      const spots = pl.kind === 'bus' ? pl.seats.concat(pl.stands) : pl.seats;
      for (const s of spots) if (!s.who) free.push([pl, s]);
    }
    if (!free.length || this.people.size >= this.most) return;
    const [pl, s] = free[Math.floor(Math.random() * free.length)];
    // (only now and then: a city's benches are not all full)
    const taken = pl.seats.filter((o) => o.who).length + pl.stands.filter((o) => o.who).length;
    if (pl.kind !== 'bus' && taken >= 1 && Math.random() < 0.7) return;
    let best = null;
    let bd = 16;
    for (const c of game.civilians.list) {
      if (c.scripted || c.ctrl || !c.alive || c.panicT > 0 || c.headless || c.dog || c.buddy || c.buddyOf || c.jog) continue;
      if (c.fig.parts.legL < 0.5 || c.fig.parts.legR < 0.5) continue;
      const d = Math.hypot(c.pos.x - s.x, c.pos.z - s.z);
      if (d < bd && d > 1.5) {
        bd = d;
        best = c;
      }
    }
    if (!best) return;
    best.scripted = true;
    best.owner = this;
    this.take(pl, s, best, best.fig.carry === 'phone' ? 'phone' : null, false);
  }

  // a bus at a stop: its waiters get on, somebody gets off
  buses() {
    const game = this.game;
    const T = game.traffic;
    if (!T) return;
    for (const car of T.list) {
      if (!car.bus || !(car.dwell > 0) || !car.lastStop || car.served === car.lastStop) continue;
      const pl = this.places.find((o) => o.stop === car.lastStop);
      if (!pl || !pl.active) continue;
      car.served = car.lastStop;
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      // the front door, on the curb side (the car's right)
      const door = { x: car.pos.x + fx * (car.halfLen - 1.4) - fz * 1.5, z: car.pos.z + fz * (car.halfLen - 1.4) + fx * 1.5 };
      for (const s of pl.seats.concat(pl.stands)) {
        const v = s.who;
        if (!v || v.phase !== 'at') continue;
        if (Math.random() < 0.15) continue;
        v.phase = 'board';
        v.c.still = false;
        v.t = 0;
        v.door = door;
        v.c.fig.sit = 0;
        v.c.noCollide = false;
        v.c.fig.drinkT = -1;
      }
      // off the bus and away along the sidewalk
      const n = Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 2) : 0;
      for (let i = 0; i < n; i++) {
        const c = game.civilians.spawnScripted(door.x, door.z, civilianLook(), null);
        c.yaw = car.yaw + Math.PI / 2;
        game.civilians.release(c);
        c.scripted = false;
        this.alighted++;
        c.pos.x += (Math.random() - 0.5) * 0.6;
        c.pos.z += (Math.random() - 0.5) * 0.6;
        game.civilians.rejoin(c);
      }
    }
  }
}
