import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';
import { flashLight } from '../render/materials.js';
import { firefighterLook } from './looks.js';

// (ROADMAP 8.4, not with ?classic) Fire.
//   - what burns: trash cans and bags, benches, newspaper boxes, the crates and the dumpsters in
//     the alleys, the palms (their crowns), the bushes, the market's stalls. A blast sets what is
//     round it alight and leaves the street burning a while; a burning car sets alight what is
//     next to it. Fire spreads: a burning thing catches what stands close by.
//   - a fire burns a while and dies; what burnt is gone (crumbled away, a black scorch on the
//     ground). Water puts it out: a hydrant's jet, the fire engine's hoses; rain makes it short.
//   - standing in it hurts; people run from it.
//   - the fire engine: when something has been burning a while, one comes, siren wailing, the
//     shortest way through the streets; it pulls up, two firefighters get out with a hose and put
//     the fire out, and back in, and off it goes.

const BURN = {
  trash: { t: 14, h: 1.2, r: 0.45 },
  bench: { t: 16, h: 0.9, r: 0.9 },
  news: { t: 10, h: 1.1, r: 0.35 },
  crate: { t: 14, h: 1.6, r: 0.65 },
  dumpster: { t: 26, h: 1.6, r: 1.0 },
  tree: { t: 22, h: 2.6, r: 1.7, crown: true },
  bush: { t: 9, h: 1.3, r: 0.9 },
  stand: { t: 18, h: 2.0, r: 1.4 },
};
const MAX_FIRES = 14;
const SPREAD_T = 1.25;
const CATCH = 0.3; // the chance at each spread of what is near
const PATCH_T = 7; // a blast's burning debris on the ground
const ENGINE_AFTER = 5; // seconds of fire before the engine is called
const STOP_D = 14; // the engine pulls up this far from the fire
const HOSE_REACH = 10; // the crew's water reaches this far (from as near as they get)
const HOSE_T = 5.5;
const FLAME = [[1.0, 0.86, 0.3], [1.0, 0.55, 0.12], [0.95, 0.3, 0.08], [1.0, 0.95, 0.6]];
const SMOKE_BLACK = [0.12, 0.11, 0.14];
const FIRE_PUFF = [1.0, 0.62, 0.2];
const FIRE_LIGHT = [1.0, 0.55, 0.2];
const SCORCH = [0.08, 0.07, 0.08];
const WATER = [0.72, 0.88, 1.0];
const WATER_DARK = [0.36, 0.6, 0.92];
const HOSE = [0.82, 0.16, 0.14];
const ENGINE = { kind: 'firetruck', color: [0.86, 0.1, 0.12], extra: 'fire', siren: true, emergency: true };
const _v = new THREE.Vector3();
const _pt = [0, 0];

export class Fire {
  constructor(game) {
    this.game = game;
    this.fires = [];
    this.spreadT = 0;
    this.engine = null;
    this.engineT = 0;
    this.hurtT = 0;
    this._near = [];
    this.flow = null; // the way to the fire on foot (world.nav), for the crew
    this.stats = { lit: 0, spread: 0, out: 0, burnt: 0, engines: 0, hosed: 0 };
  }

  // ------------------------------------------------------------------ catching fire
  burning(o) {
    return this.fires.some((f) => f.o === o);
  }

  // a prop alight (if it burns at all)
  ignite(o) {
    const B = BURN[o.kind];
    if (!B || o.state !== 'here' || this.burning(o) || this.fires.length >= MAX_FIRES) return null;
    const x = (o.x0 + o.x1) / 2;
    const z = (o.z0 + o.z1) / 2;
    const y = B.crown ? Math.max(1, o.y1 - 2.6) : groundHeight(x, z);
    const f = { o, x, y, z, h: B.h, r: B.r, t: 0, life: B.t * (0.85 + Math.random() * 0.3), crown: !!B.crown };
    this.fires.push(f);
    this.stats.lit++;
    return f;
  }

  // burning debris on the ground (a blast)
  patch(x, z, life = PATCH_T) {
    if (this.fires.length >= MAX_FIRES) return null;
    const f = { o: null, x, y: groundHeight(x, z), z, h: 0.7, r: 0.6, t: 0, life: life * (0.8 + Math.random() * 0.4), crown: false };
    this.fires.push(f);
    return f;
  }

  // a blast (game/game.js explosion): what burns round it is alight, and the ground a while
  blast(x, z, radius) {
    const objs = this.game.world.objects;
    for (const o of objs.within(x, z, radius * 0.9, this._near)) if (BURN[o.kind] && Math.random() < 0.8) this.ignite(o);
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius * 0.5;
      this.patch(x + Math.cos(a) * d, z + Math.sin(a) * d);
    }
  }

  // water on it (a hydrant's jet, the fire engine's hose): what burns within r goes out
  douse(x, z, r) {
    let n = 0;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (Math.hypot(f.x - x, f.z - z) > r + f.r) continue;
      this.fires.splice(i, 1);
      this.game.fx.sprite('smoke0', f.x, f.y + f.h * 0.6, f.z, { size: 1.6, grow: 1.6, life: 1.4, vy: 1.6, alpha: 0.7, tint: [0.85, 0.86, 0.9] });
      this.stats.out++;
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    // (a burning car sets alight what is next to it: game/damage.js)
    const D = game.damage;
    this.spreadT -= dt;
    const spread = this.spreadT <= 0;
    if (spread) this.spreadT = SPREAD_T;
    if (spread && D && D.cars) {
      for (const c of D.cars) {
        const d = c.dmg;
        if (!d || !d.burning || d.burnT < 1 || c.gone) continue;
        for (const o of game.world.objects.within(c.pos.x, c.pos.z, 3.2, this._near)) if (BURN[o.kind] && Math.random() < CATCH) this.ignite(o) && this.stats.spread++;
      }
    }
    if (!this.fires.length) {
      this.updateEngine(dt);
      return;
    }
    // (a hydrant's water on it, game/knock.js: out it goes)
    if (game.knock) for (const s of game.knock.sprays) this.douse(s.x, s.z, 2.6);
    const rain = game.weather && game.weather.cur ? game.weather.cur.rain || 0 : 0;
    const cam = game.camera.position;
    const P = game.player;
    const pp = P.inVehicle ? P.inVehicle.pos : P.pos;
    // (the nearest one lights the street)
    let near = null;
    let nd = 60;
    this.hurtT -= dt;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      // (in the rain it burns out sooner)
      f.t += dt * (1 + rain * 1.5);
      if (f.o && f.o.state !== 'here') {
        this.fires.splice(i, 1);
        continue;
      }
      if (f.t >= f.life) {
        this.burnOut(f);
        this.fires.splice(i, 1);
        continue;
      }
      const d = Math.hypot(f.x - cam.x, f.z - cam.z);
      if (d < nd) {
        nd = d;
        near = f;
      }
      // the fire's own smoke and sparks
      if (d < 120 && Math.random() < dt * 9) {
        game.fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', f.x + (Math.random() - 0.5) * f.r, f.y + f.h + Math.random() * 0.4, f.z + (Math.random() - 0.5) * f.r, { size: 1.2 + f.r, grow: 1.5, life: 1.8, vy: 1.6, alpha: 0.75, tint: SMOKE_BLACK });
        if (Math.random() < 0.5) game.fx.sprite('smoke1', f.x + (Math.random() - 0.5) * f.r, f.y + f.h * 0.4, f.z + (Math.random() - 0.5) * f.r, { size: 0.7 + f.r * 0.5, grow: 0.6, life: 0.45, vy: 2.4, alpha: 0.9, tint: FIRE_PUFF });
      }
      // too close: it burns you
      if (this.hurtT <= 0 && !P.inVehicle && P.mode !== 'dead' && Math.hypot(pp.x - f.x, pp.z - f.z) < f.r + 0.5 && Math.abs(pp.y - f.y) < 2) {
        this.hurtT = 0.45;
        P.hurt(4, f.x, f.z, null, 'fire', null);
      }
      // it spreads: what stands close by catches
      if (spread) {
        for (const o of game.world.objects.within(f.x, f.z, f.r + (f.crown ? 3 : 2), this._near)) {
          if (o !== f.o && BURN[o.kind] && Math.random() < CATCH && this.ignite(o)) this.stats.spread++;
        }
        // (and a car parked or stopped right by it)
        if (D && Math.random() < 0.35) {
          for (const c of game.traffic.list) {
            if (c.gone || Math.hypot(c.pos.x - f.x, c.pos.z - f.z) > f.r + 2.4) continue;
            D.ignite(c, 1 + Math.random() * 2);
          }
        }
        game.civilians.panic(_v.set(f.x, 0, f.z), 9);
      }
    }
    if (near) flashLight(near.x, near.y + near.h * 0.6, near.z, 9, FIRE_LIGHT, 1.3 + 0.45 * Math.sin(game.time * 13) + 0.25 * Math.sin(game.time * 29));
    this.updateEngine(dt);
  }

  // burnt out: what burnt crumbles away, black on the ground where it stood
  burnOut(f) {
    const game = this.game;
    if (f.o && f.o.state === 'here') {
      game.world.objects.remove(f.o, true);
      this.stats.burnt++;
    }
    const gy = groundHeight(f.x, f.z);
    game.fx.splatAt(f.x, gy + 0.02, f.z, 0, 1, 0, 0.9 + f.r, SCORCH);
    game.fx.crumbs(f.x, f.y + 0.4, f.z, 12, 2, true);
  }

  // ------------------------------------------------------------------ the fire engine
  updateEngine(dt) {
    const game = this.game;
    const T = game.traffic;
    const E = this.engine;
    if (!E) {
      // (a fire burning a while, near you, and no engine on its way: one is called)
      const P = game.player;
      const pp = P.inVehicle ? P.inVehicle.pos : P.pos;
      const f = this.fires.find((q) => q.t > ENGINE_AFTER && Math.hypot(q.x - pp.x, q.z - pp.z) < 150);
      this.engineT -= dt;
      if (!f || this.engineT > 0 || !T) return;
      this.engineT = 20;
      const c = T.spawnCar(new THREE.Vector3(f.x, 0, f.z), 60, 130, { ...ENGINE }, { anywhere: true, toward: true, respond: { x: f.x, z: f.z } });
      if (!c) return;
      this.engine = { c, f, state: 'drive', t: 0, crew: [], ahead: Infinity, checkT: 0, stuckT: 0 };
      this.stats.engines++;
      game.hud.toast('כבאית בדרך!', 'info', 2.2);
      return;
    }
    const c = E.c;
    E.t += dt;
    // (gone from the street, or too long: forget it)
    if (c.gone || T.list.indexOf(c) < 0 || E.t > 150) {
      this.dismiss(E);
      return;
    }
    const d = Math.hypot(c.pos.x - c.respond.x, c.pos.z - c.respond.z);
    if (E.state === 'drive') {
      // (the fire it came for is out: the nearest one still burning, or home)
      if (!this.fires.includes(E.f)) {
        const f = this.fires.find((q) => Math.hypot(q.x - c.respond.x, q.z - c.respond.z) < 30);
        if (f) E.f = f;
        else return this.leave(E);
      }
      // close enough, or as close as its way brings it (what is left of the way gets no nearer)
      if ((E.checkT -= dt) <= 0) {
        E.checkT = 0.4;
        E.ahead = this.nearestAhead(c, E.f);
      }
      E.stuckT = c.speed < 0.5 ? E.stuckT + dt : 0;
      if (d < STOP_D || (d < 60 && E.ahead > d - 1.5) || (d < 45 && E.stuckT > 6)) {
        E.state = 'stop';
        E.t = 0;
      } else if (E.stuckT > 14) {
        // (stuck far off: another one is called)
        this.dismiss(E);
        this.engineT = 2;
      }
      return;
    }
    // stopped: it waits, the crew get out with the hose
    c.brakeT = 0.25;
    if (E.state === 'stop' && c.speed < 0.4) {
      E.state = 'hose';
      E.t = 0;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        const a = game.civilians.spawnScripted(c.pos.x - fz * side * 1.6 - fx * 1.2, c.pos.z + fx * side * 1.6 - fz * 1.2, firefighterLook(), this);
        a.speed = 2.6;
        // (they walk up to the fire, not away from it)
        a.brave = true;
        const crew = { a, hose: 0 };
        a.ctrl = () => crew.goal || null;
        E.crew.push(crew);
      }
    }
    if (E.state === 'back') {
      // (each to the engine's side, and in; or after a while, gone anyway)
      let out = 0;
      for (const cr of E.crew) {
        const a = cr.a;
        if (!a.alive || a.owner !== this) continue;
        a.fig.reachR = null;
        const tx = c.pos.x;
        const tz = c.pos.z;
        if (Math.hypot(a.pos.x - tx, a.pos.z - tz) > 2.4) {
          cr.goal = { x: tx, z: tz, speed: 3.2 };
          out++;
        }
      }
      if (!out || E.t > 14) this.go(E);
      return;
    }
    if (E.state === 'hose') {
      const f = E.f;
      // (the way there on foot, round the walls: worked out once a fire)
      const nav = game.world.nav;
      if (nav && E.flowFor !== f) {
        E.flowFor = f;
        if (!this.flow || this.flow.length !== nav.w * nav.h) this.flow = new Float32Array(nav.w * nav.h);
        nav.flowFrom(f.x, f.z, 60, this.flow);
      }
      let alive = 0;
      for (const [i, cr] of E.crew.entries()) {
        const a = cr.a;
        if (!a.alive || a.owner !== this) continue;
        alive++;
        // up to the fire (one a little behind the other), and the water on it
        const dx = f.x - a.pos.x;
        const dz = f.z - a.pos.z;
        const dd = Math.hypot(dx, dz) || 1;
        if (!cr.at) {
          // (there, or as near as the way lets them and the water reaches from there)
          if (dd < cr.best - 0.2 || cr.best === undefined) {
            cr.best = dd;
            cr.stuckT = 0;
          } else cr.stuckT = (cr.stuckT || 0) + dt;
          if (dd < 4.6 + i * 1.6 || (cr.stuckT > 2 && dd < HOSE_REACH)) cr.at = true;
        }
        if (!cr.at) {
          const dir = nav && this.flow ? nav.descend(this.flow, a.pos.x, a.pos.z) : null;
          cr.goal = dir ? { x: a.pos.x + dir[0] * 2, z: a.pos.z + dir[1] * 2, speed: 3.2 } : { x: f.x, z: f.z, speed: 3.2 };
        } else {
          cr.at = true;
          cr.goal = null;
          a.faceYaw = Math.atan2(dx, dz);
          cr.hose += dt;
          a.fig.reachR = a.fig.reachR || new THREE.Vector3();
          a.fig.reachR.set(a.pos.x + (dx / dd) * 0.6, a.pos.y + 1.2, a.pos.z + (dz / dd) * 0.6);
        }
      }
      // (nobody left to hold the hose, or they cannot get to it: back in)
      if (!alive || E.t > 45) return this.leave(E);
      // (the water: out it goes, the fire and what burns round it)
      if (E.crew.some((cr) => cr.hose > HOSE_T)) {
        const n = this.douse(f.x, f.z, 4.5);
        if (n) this.stats.hosed += n;
        const next = this.fires.find((q) => Math.hypot(q.x - f.x, q.z - f.z) < 25);
        if (next) {
          E.f = next;
          for (const cr of E.crew) {
            cr.at = false;
            cr.hose = 0;
            cr.best = undefined;
          }
          E.t = 0;
        } else this.leave(E);
      }
    }
  }

  // back to the engine, in, and off it goes
  leave(E) {
    if (E.state === 'back' || E.state === 'drive') {
      if (E.state === 'drive') this.go(E);
      return;
    }
    E.state = 'back';
    E.t = 0;
  }

  go(E) {
    const game = this.game;
    for (const cr of E.crew) if (cr.a.alive && cr.a.owner === this) game.civilians.remove(cr.a);
    E.crew = [];
    const c = E.c;
    c.respond = null;
    c.brakeT = 0;
    // (the job done: the siren off, back to the station at an ordinary pace)
    c.siren = false;
    this.engine = null;
  }

  dismiss(E) {
    for (const cr of E.crew) if (cr.a.alive && cr.a.owner === this) this.game.civilians.remove(cr.a);
    E.c.respond = null;
    E.c.siren = false;
    this.engine = null;
  }

  // how near to the fire what is left of the engine's way comes (the next 90 m of it)
  nearestAhead(c, f) {
    const P = c.path;
    if (!P || !P.len) return Infinity;
    let best = Infinity;
    const end = Math.min(P.len, c.s + 90);
    for (let s = c.s; s <= end; s += 3) {
      P.sample(s, _pt);
      const d = Math.hypot(_pt[0] - f.x, _pt[1] - f.z);
      if (d < best) best = d;
    }
    return best;
  }

  // ------------------------------------------------------------------ drawing
  // the flames (pen strokes, flickering), the hoses and their water
  draw(fr) {
    const game = this.game;
    const cam = game.camera.position;
    const t = game.time;
    for (const f of this.fires) {
      const d = Math.hypot(f.x - cam.x, f.z - cam.z);
      if (d > 130) continue;
      const w = Math.max(3, Math.min(18, 300 / Math.max(1, d)));
      const grow = Math.min(1, f.t / 1.2) * Math.min(1, (f.life - f.t) / 3);
      const n = f.crown ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + i * 0.37;
        const rr = f.r * (0.25 + ((i * 0.61) % 1) * 0.75);
        const bx = f.x + Math.cos(a) * rr;
        const bz = f.z + Math.sin(a) * rr;
        const by = f.y + (f.crown ? ((i * 0.43) % 1) * 1.2 : 0.05);
        const h = f.h * (0.55 + 0.6 * Math.abs(Math.sin(t * (7 + (i % 5)) + i * 1.7))) * grow;
        if (h < 0.05) continue;
        const sway = Math.sin(t * 9 + i * 2.3) * 0.18;
        const mx = bx + sway * 0.5;
        const mz = bz - sway * 0.3;
        fr.lineXYZ(bx, by, bz, mx, by + h * 0.55, mz, FLAME[i % FLAME.length], w * 1.3, 8000 + i, 0.95, 0.03, 0.02);
        fr.lineXYZ(mx, by + h * 0.55, mz, mx + sway, by + h, mz + sway * 0.4, FLAME[(i + 1) % FLAME.length], w * 0.8, 8100 + i, 0.9, 0.03, 0.02);
      }
    }
    const E = this.engine;
    if (!E || E.state !== 'hose') return;
    const c = E.c;
    for (const cr of E.crew) {
      const a = cr.a;
      if (!a.alive || !cr.at) continue;
      const h = a.fig.reachR;
      if (!h) continue;
      // the hose from the engine's side to the hands
      const sx = c.pos.x;
      const sz = c.pos.z;
      const mx = (sx + h.x) / 2;
      const mz = (sz + h.z) / 2;
      fr.lineXYZ(sx, 0.9, sz, mx, 0.08, mz, HOSE, 5, 8200, 1, 0.02, 0);
      fr.lineXYZ(mx, 0.08, mz, h.x, h.y - 0.1, h.z, HOSE, 5, 8201, 1, 0.02, 0);
      // and the water, an arc onto the fire
      const f = E.f;
      let px = h.x;
      let py = h.y;
      let pz = h.z;
      for (let k = 1; k <= 8; k++) {
        const u = k / 8;
        const nx = h.x + (f.x - h.x) * u + Math.sin(t * 11 + k) * 0.05;
        const nz = h.z + (f.z - h.z) * u + Math.cos(t * 10 + k) * 0.05;
        const ny = h.y + (f.y + f.h * 0.4 - h.y) * u + Math.sin(u * Math.PI) * 1.1;
        fr.lineXYZ(px, py, pz, nx, ny, nz, k % 2 ? WATER : WATER_DARK, 6, 8210 + k, 0.85, 0.01, 0);
        px = nx;
        py = ny;
        pz = nz;
      }
      if (Math.random() < 0.3) game.fx.splash(f.x, f.y + 0.2, f.z, 3, 1.8, WATER);
    }
  }
}
