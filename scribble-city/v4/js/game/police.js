import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';

// The Scribble City Police: crimes that somebody sees (or phones in) earn stars; patrol
// cars race to you with the siren on and drop off officers with pen-pistols, big school
// erasers and (from three stars) paint M4s. Break their line of sight and lie low long
// enough and they give up.

const LEVELS = [0.5, 1.8, 3.5, 6, 9]; // heat for each star
const SEARCH_TIME = [0, 14, 20, 28, 38, 50]; // seconds out of sight before they give up
const UNITS = [0, 2, 4, 6, 8, 10]; // officers on the case
const CRIMES = {
  carjack: { heat: 1.0, civ: true },
  steal: { heat: 0.6, civ: true },
  vandal: { heat: 0.25 },
  hurtCiv: { heat: 0.5, civ: true },
  killCiv: { heat: 1.2, civ: true },
  hurtCop: { heat: 0.8, always: true },
  killCop: { heat: 1.8, always: true },
  shoot: { heat: 0.2 },
  killGang: { heat: 0.4 },
  copcar: { heat: 1.8, always: true },
};
// who comes in each car, by stars
const CREWS = [
  null,
  [['cop', 'copEraser'], ['cop', 'cop']],
  [['cop', 'copEraser'], ['cop', 'cop']],
  [['swat', 'cop'], ['swat', 'copEraser']],
  [['swat', 'swat'], ['swat', 'copEraser']],
  [['swat', 'swat'], ['swat', 'copEraser']],
];

const _v = new THREE.Vector3();

export class Police {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.level = 0;
    this.seenT = -100;
    this.searchT = 0;
    this.searching = false;
    this.lastSeen = new THREE.Vector3();
    this.reports = [];
    this.dispatchT = 0;
    this.patrolT = 4;
    this.crimeT = {};
  }

  get hostile() {
    return this.level > 0;
  }

  reset() {
    this.heat = 0;
    this.level = 0;
    this.searchT = 0;
    this.reports = [];
    this.game.hud.setWanted(0, false);
  }

  // ------------------------------------------------------------------ crimes and witnesses
  crime(kind, x, z) {
    const c = CRIMES[kind];
    if (!c) return;
    const t = this.game.time;
    // one shooting spree / punch-up counts once a second
    if (this.crimeT[kind] > t) return;
    this.crimeT[kind] = t + 0.9;
    const w = this.witnesses(x, z);
    if (c.always || w.cop) {
      this.addHeat(c.heat, x, z, true);
    } else if (c.civ && w.civ) {
      // somebody pulls out a phone; erase them first and the call never happens
      this.reports.push({ t: t + 2.5 + Math.random() * 2, heat: c.heat * 0.8, x, z, by: w.civ });
      if (Math.random() < 0.6) this.game.bubbles.say(w.civ, pick(['I\'m calling the cops!', 'Police!!', 'Somebody call 911!']), 'alarm');
    }
  }

  witnesses(x, z) {
    const game = this.game;
    const col = game.world.collision;
    let cop = null;
    let civ = null;
    for (const e of game.enemies.list) {
      if (e.faction !== 'police' || !e.alive || e.headless) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < 45 && col.lineOfSight(e.pos.x, e.pos.y + 1.6, e.pos.z, x, 1.2, z)) {
        cop = e;
        break;
      }
    }
    if (!cop) {
      for (const c of game.traffic.list) {
        if (!c.police || !c.crew || !c.crew.length) continue;
        const d = Math.hypot(c.pos.x - x, c.pos.z - z);
        if (d < 40 && col.lineOfSight(c.pos.x, 1.3, c.pos.z, x, 1.2, z)) {
          cop = c;
          break;
        }
      }
    }
    for (const c of game.civilians.list) {
      if (!c.alive || c.headless || c.inside) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d > 1.5 && d < 28 && col.lineOfSight(c.pos.x, c.pos.y + 1.6, c.pos.z, x, 1.2, z)) {
        civ = c;
        break;
      }
    }
    return { cop, civ };
  }

  addHeat(h, x, z, seen) {
    const before = this.level;
    this.heat += h;
    let lv = 0;
    for (let i = 0; i < LEVELS.length; i++) if (this.heat >= LEVELS[i]) lv = i + 1;
    this.level = Math.max(this.level, lv);
    if (seen) {
      this.seenT = this.game.time;
      this.lastSeen.set(x, 0, z);
    }
    if (this.level > before) {
      const hud = this.game.hud;
      const msg = this.level === 1 ? 'המשטרה מחפשת אותך!' : this.level >= 4 ? 'יחידת מחק מיוחדת בדרך!' : 'עוד ניידות בדרך!';
      hud.toast(msg, 'bad', 2.4);
      this.dispatchT = Math.min(this.dispatchT, 1);
      // the patrol car already around comes for you
      for (const c of this.game.traffic.list) if (c.police && c.mode === 'patrol') c.mode = 'pursuit';
    }
    this.game.hud.setWanted(this.level, false);
  }

  // where the police think you are
  target() {
    const p = this.game.player;
    return this.game.time - this.seenT < 2 ? (p.inVehicle ? p.inVehicle.pos : p.pos) : this.lastSeen;
  }

  requestBackup() {
    this.dispatchT = Math.min(this.dispatchT, 2);
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    const t = game.time;
    if (this.reports.length) {
      for (const r of this.reports) {
        if (t < r.t) continue;
        r.done = true;
        if (r.by && r.by.alive && !r.by.headless) {
          this.addHeat(r.heat, r.x, r.z, false);
          if (this.level > 0 && t - this.seenT > 2) this.lastSeen.set(r.x, 0, r.z);
          game.hud.toast('מישהו התקשר למשטרה…', 'info', 2);
        }
      }
      this.reports = this.reports.filter((r) => !r.done);
    }
    this.updatePatrols(dt);
    if (this.level <= 0) {
      game.audio.siren(0);
      return;
    }
    // can any officer see you right now?
    const p = game.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    let seen = false;
    for (const e of game.enemies.list) {
      if (e.faction === 'police' && e.alive && e.sees) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      const col = game.world.collision;
      for (const c of game.traffic.list) {
        if (!c.police || c.mode !== 'pursuit') continue;
        const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z);
        if (d < 45 && !(p.hidden && d > 4) && col.lineOfSight(c.pos.x, 1.4, c.pos.z, pp.x, pp.y + 1.2, pp.z)) {
          seen = true;
          break;
        }
      }
    }
    if (seen) {
      this.seenT = t;
      this.lastSeen.copy(pp);
      // over the radio: every unit learns where you are
      this.radioT = (this.radioT || 0) - dt;
      if (this.radioT <= 0) {
        this.radioT = 1;
        for (const e of game.enemies.list) {
          if (e.faction !== 'police' || !e.alive || e.headless) continue;
          e.squad.lastKnown.copy(pp);
          e.squad.knowT = t;
          if (e.state !== 'combat' && e.state !== 'flee' && e.joinT < 0) e.joinT = t + 0.6 + Math.random() * 1.2;
        }
      }
    }
    const searching = t - this.seenT > 3;
    if (searching) this.searchT += dt * (p.hidden ? 2 : 1);
    else this.searchT = 0;
    if (searching !== this.searching) {
      this.searching = searching;
      game.hud.setWanted(this.level, searching);
    }
    if (this.searchT > SEARCH_TIME[this.level]) {
      this.clear();
      return;
    }
    // send cars until enough officers are on the case
    this.dispatchT -= dt;
    if (this.dispatchT <= 0) {
      this.dispatchT = Math.max(3, 8 - this.level);
      let active = 0;
      for (const e of game.enemies.list) if (e.faction === 'police' && e.alive && e.state !== 'flee') active++;
      for (const c of game.traffic.list) if (c.police && c.crew) active += c.crew.length;
      if (active < UNITS[this.level]) this.dispatch();
    }
    // the siren of the nearest car on the way
    let near = Infinity;
    for (const c of game.traffic.list) {
      if (c.police && c.siren) near = Math.min(near, Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z));
    }
    game.audio.siren(near < 120 ? 1 - near / 120 : 0);
  }

  // keep a patrol car cruising around when nothing is going on
  updatePatrols(dt) {
    const game = this.game;
    this.patrolT -= dt;
    if (this.patrolT > 0) return;
    this.patrolT = 6;
    const has = game.traffic.list.some((c) => c.police);
    if (!has && this.level === 0) game.traffic.spawnPatrol();
  }

  dispatch() {
    const game = this.game;
    const p = game.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    const nav = game.world.nav;
    const col = game.world.collision;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 70 + Math.random() * 40;
      const x = pp.x + Math.cos(a) * r;
      const z = pp.z + Math.sin(a) * r;
      if (!nav.walkable(x, z) || groundHeight(x, z) > 0.05) continue; // on the road
      if (col.lineOfSight(pp.x, pp.y + 1.6, pp.z, x, 1.4, z)) continue;
      const crews = CREWS[this.level];
      const crew = crews[Math.floor(Math.random() * crews.length)];
      const car = game.traffic.spawnPolice(x, z, Math.atan2(pp.x - x, pp.z - z), crew);
      if (car) return car;
    }
    return null;
  }

  // the car pulled up: officers jump out on both sides and take it from here
  deploy(car) {
    const game = this.game;
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const rx = -fz;
    const rz = fx;
    const T = this.target();
    car.crew.forEach((m, i) => {
      const side = i === 0 ? -1 : 1;
      const x = car.pos.x + fx * -0.3 + rx * side * 1.8;
      const z = car.pos.z + fz * -0.3 + rz * side * 1.8;
      if (m.fig) m.fig.dispose();
      const e = game.enemies.spawnOfficer(m.type, x, z, m.look, T);
      e.yaw = car.yaw;
    });
    car.crew = [];
    car.mode = 'parked';
  }

  clear() {
    const game = this.game;
    this.heat = 0;
    this.level = 0;
    this.searchT = 0;
    this.searching = false;
    game.hud.setWanted(0, false);
    game.hud.toast('המשטרה ויתרה — איבדו אותך', 'good', 2.6);
    for (const e of game.enemies.list) {
      if (e.faction !== 'police' || !e.alive) continue;
      e.setState('return');
      e.home.copy(e.pos);
      e.target.copy(e.pos);
      if (Math.random() < 0.5) e.say('giveup');
    }
    for (const c of game.traffic.list) if (c.police) c.mode = c.crew && c.crew.length ? 'patrol' : 'leave';
    game.audio.siren(0);
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export { _v };
