import * as THREE from 'three';
import { groundHeight, AVES, STREETS, WEST_EDGE } from '../world/layout.js';
import { NODES } from '../world/roads.js';

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
  // (knocked out cold in a fist fight: ROADMAP 5.4)
  koCop: { heat: 1.2, always: true },
  koCiv: { heat: 0.8, civ: true },
  shoot: { heat: 0.2 },
  killGang: { heat: 0.4 },
  copcar: { heat: 1.8, always: true },
  // (the drawn key, ROADMAP 9.2: a car opened with it - only the police think anything of it; a
  // shop's alarm going off; its till emptied)
  quietSteal: { heat: 0.6 },
  alarm: { heat: 1.0, always: true },
  burglary: { heat: 0.8, civ: true },
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

// (v5, ROADMAP 11.17) where something is, the way the radio says it: the corner of the nearest
// avenue and street (the island's or the mainland's)
function cornerName(x, z) {
  let best = null;
  let bd = Infinity;
  for (const n of NODES) {
    const d = Math.abs(n.x - x) + Math.abs(n.z - z);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best ? `${best.ave.name} פינת ${best.street.name}` : 'במרכז העיר';
}
const dirName = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'מזרחה' : 'מערבה') : dz > 0 ? 'דרומה' : 'צפונה');

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
      if (before === 0) this.radio(`מוקד לכל הניידות: דיווח על חשוד, ${cornerName(x, z)}.`, true);
      else if (this.level === 3) this.radio('מוקד: יחידה מיוחדת מצטרפת למרדף. זהירות.', true);
      else if (this.level >= 4) this.radio('מוקד: כל הכוחות, החשוד מסוכן. מחסומים בכל הצירים.', true);
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

  // (ROADMAP 6.2) the helicopter's light on you (game/heli.js): as good as an officer seeing you
  spotted() {
    this.airT = this.game.time;
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
    // (roadblocks ahead of you in a car: ROADMAP 6.1, game/chase.js)
    if (game.chase) game.chase.update(dt);
    if (this.level <= 0) {
      game.audio.siren(0);
      return;
    }
    // can any officer see you right now?
    const p = game.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    let seen = false;
    // (down under the waves in a drawn submarine: nobody sees you - ROADMAP 11.8)
    const under = !!(p.inVehicle && p.inVehicle.submerged);
    for (const e of game.enemies.list) {
      if (!under && e.faction === 'police' && e.alive && e.sees) {
        seen = true;
        break;
      }
    }
    // (ROADMAP 11.15: a ride that is hard to see - silent, in its ink - is seen only from closer:
    // game/combos.js)
    const sv = p.inVehicle;
    const far = 45 * (sv && sv.stealth ? sv.stealth : 1);
    if (!seen && !under) {
      const col = game.world.collision;
      for (const c of game.traffic.list) {
        if (!c.police || c.mode !== 'pursuit') continue;
        const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z);
        // (a police car sees in front of it, ROADMAP 6.4)
        if (d < far && !(p.hidden && d > 4) && (!game.lose || game.lose.carSees(c, pp, d)) && !(game.signs && game.signs.clouds.length && game.signs.blocks(c.pos.x, c.pos.z, pp.x, pp.z)) && col.lineOfSight(c.pos.x, 1.4, c.pos.z, pp.x, pp.y + 1.2, pp.z)) {
          seen = true;
          break;
        }
      }
    }
    if (!seen && !under && this.airT !== undefined && t - this.airT < 0.2) seen = true;
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
    // (in another car or other clothes they give up sooner: ROADMAP 6.4)
    // (ROADMAP 11.15: one that goes everywhere - in the water, in the air - they lose sooner:
    // game/combos.js)
    const lostK = sv && sv.escape && (sv.flies || sv.kind === 'boat' || sv.submerged) ? sv.escape : 1;
    if (searching) this.searchT += dt * (p.hidden ? 2 : 1) * (game.lose ? game.lose.searchMul : 1) * lostK;
    else this.searchT = 0;
    if (searching !== this.searching) {
      this.searching = searching;
      game.hud.setWanted(this.level, searching);
      // (v5, ROADMAP 11.17) lost: the cars close the corners round where you were last seen; found
      // again: everybody on the radio knows where
      if (searching) {
        this.radio(`איבדנו קשר עין ליד ${cornerName(this.lastSeen.x, this.lastSeen.z)}. סוגרים את האזור.`);
        this.cordon();
      } else {
        this.radio(`ניידת ${10 + Math.floor(Math.random() * 40)}: יש קשר עין! ${cornerName(pp.x, pp.z)}.`);
        for (const c of game.traffic.list) if (c.police) c.cordon = null;
      }
    }
    if (searching) this.tips(dt, pp);
    else if (p.inVehicle && this.level > 0) {
      // (after you in a car: the way you are going, on the radio)
      this.carT = (this.carT || 4) - dt;
      if (this.carT <= 0) {
        this.carT = 9 + Math.random() * 5;
        const v = p.inVehicle;
        const sg = Math.sign(v.speed || 1);
        if (Math.abs(v.speed || 0) > 4) this.radio(`החשוד ברכב, נוסע ${dirName(Math.sin(v.yaw) * sg, Math.cos(v.yaw) * sg)}, ${cornerName(v.pos.x, v.pos.z)}.`);
      }
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
      // (you driving off: the officers left far behind on foot are out of it, ROADMAP 6.1)
      const away = game.chase && game.chase.quarry() ? 60 : Infinity;
      for (const e of game.enemies.list) if (e.faction === 'police' && e.alive && e.state !== 'flee' && Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z) < away) active++;
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
    // (v5, ROADMAP 11.17) up the roads to you, from round a corner (the island's or the mainland's)
    {
      const crews = CREWS[this.level];
      const sp = game.traffic.roadSpot(pp, 65, 125, pp);
      if (sp) {
        const crew = crews[Math.floor(Math.random() * crews.length)];
        const car = game.traffic.spawnPolice(sp.x, sp.z, sp.yaw, crew);
        if (car) return car;
      }
    }
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

  // (v5, ROADMAP 11.17) the police radio, in the subtitles (one line every few seconds at most)
  radio(text, force = false) {
    const game = this.game;
    const t = game.time;
    if (!force && t - (this.radioAt || -99) < 4) return;
    this.radioAt = t;
    if (game.audio) game.audio.play('radio', 0.6);
    if (game.hud && game.hud.subtitles !== false && game.voices && game.voices.subtitle) game.voices.subtitle(`קשר משטרתי — ${text}`);
  }

  // where you were last seen, boxed in: each car on the case to a corner round it (and parked
  // there across the road, its officers searching from there - game/traffic.js updatePolice)
  cordon() {
    const game = this.game;
    const L = this.lastSeen;
    const corners = NODES.filter((n) => {
      const d = Math.hypot(n.x - L.x, n.z - L.z);
      return d > 25 && d < 130;
    }).sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z));
    let k = 0;
    for (const c of game.traffic.list) {
      if (!c.police || c.mode !== 'pursuit' || !c.crew || !c.crew.length) continue;
      const n = corners[k++];
      if (!n) break;
      c.cordon = new THREE.Vector3(n.x, 0, n.z);
    }
  }

  // somebody in the street saw where you went, and says so (not in a disguise: game/lose.js)
  tips(dt, pp) {
    const game = this.game;
    this.tipT = (this.tipT === undefined ? 4 : this.tipT) - dt;
    if (this.tipT > 0) return;
    this.tipT = 6 + Math.random() * 4;
    if (game.lose && game.lose.disguised) return;
    if (game.player.hidden) return;
    const col = game.world.collision;
    let who = null;
    for (const c of game.civilians.list) {
      if (!c.alive || c.headless || c.inside || c.ctrl || c.scripted || c.panicT > 0) continue;
      const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z);
      if (d > 3 && d < 26 && col.lineOfSight(c.pos.x, c.pos.y + 1.6, c.pos.z, pp.x, pp.y + 1.2, pp.z)) {
        who = c;
        break;
      }
    }
    if (!who || Math.random() < 0.4) return;
    who.faceYaw = Math.atan2(pp.x - who.pos.x, pp.z - who.pos.z);
    game.bubbles.say(who, pick(['Officer! Over there!', 'That way! That way!', 'I saw them, right there!', 'Police! Here!']), 'alarm');
    const x = pp.x + (Math.random() - 0.5) * 8;
    const z = pp.z + (Math.random() - 0.5) * 8;
    game.inkwell.after(1.4, () => {
      if (!this.hostile || !who.alive) return;
      this.lastSeen.set(x, 0, z);
      this.searchT = Math.max(0, this.searchT - 6);
      for (const e of game.enemies.list) if (e.faction === 'police' && e.alive && !e.headless) e.squad.lastKnown.set(x, 0, z);
      this.radio(`מוקד: עד ראייה מדווח על החשוד, ${cornerName(x, z)}.`);
      this.cordon();
    });
  }

  clear() {
    const game = this.game;
    this.heat = 0;
    this.level = 0;
    this.searchT = 0;
    this.searching = false;
    game.hud.setWanted(0, false);
    game.hud.toast('המשטרה ויתרה — איבדו אותך', 'good', 2.6);
    this.radio('מוקד: מבטלים את החיפוש. כל הניידות חוזרות לסיור.', true);
    for (const c of game.traffic.list) if (c.police) c.cordon = null;
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
