import * as THREE from 'three';
import { blockAt } from '../world/layout.js';

// How the people of the street react to what happens round them (ROADMAP 3.5):
//   onlookers   once a crash, a fight, somebody hurt or a blast is over (and nothing is going
//               off any more), the people near come closer and stand round it at a few metres:
//               some film it with their phones held up, the others just look and say something;
//               after a while they go on their way
//   first aid   somebody hurt is helped: a passer-by kneels beside them until they can go on
//   scuffles    late in the evening by the bars and on the alleys' corners two people now and
//               then start shoving and swinging at each other (and a crowd gathers to film it);
//               one ends up on the ground, the other walks off
//   (calling the police on you was there already: game/police.js)
// The ones who come over are borrowed from the street and given back to it.
// (?classic: nobody reacts beyond running away, as before)

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LOOK_LINES = {
  crash: ['Whoa!', 'Is everyone okay?', 'Did you see that?', 'Ouch, that bumper...', 'Classic.'],
  hurt: ['Oh my god!', 'Somebody call an ambulance!', 'Is he okay?', 'What happened?!'],
  blast: ['What was that?!', 'Is anybody hurt?', 'Unbelievable...', 'Stay back!'],
  fight: ['Fight! Fight!', 'Break it up!', "He's gonna get it!", 'Somebody stop them!', 'Ooh!'],
};
const FIGHT_LINES = ['You wanna go?!', 'Back off!', "Say that again!", 'Come on then!', 'You spilled my drink!', 'Watch it!'];

export class Reactions {
  constructor(game) {
    this.game = game;
    this.incidents = [];
    this.helps = [];
    this.fights = [];
    this.fightT = 40;
    this.aidT = 3;
    // (counted for the tests)
    this.stats = { incidents: 0, onlookers: 0, filming: 0, aid: 0, fights: 0 };
  }

  get most() {
    return this.game.touch ? 3 : 6;
  }

  // something happened at (x, z) worth stopping for ('crash', 'hurt', 'blast', 'fight'); the
  // shooting kind keep people off for a few seconds (danger)
  note(kind, x, z) {
    const game = this.game;
    if (game.classic) return null;
    const danger = kind === 'hurt' || kind === 'blast';
    // (one incident a place: a new note there keeps it going, and a dangerous one scatters its
    // onlookers)
    for (const inc of this.incidents) {
      if (Math.hypot(inc.x - x, inc.z - z) < 14) {
        inc.t = Math.min(inc.t, 1);
        if (danger) {
          inc.calm = game.time + 7;
          this.disperse(inc);
        }
        return inc;
      }
    }
    const inc = { kind, x, z, t: 0, calm: game.time + (danger ? 7 : 1.2), life: 22 + Math.random() * 10, watchers: [], recruitT: 0 };
    this.incidents.push(inc);
    this.stats.incidents++;
    return inc;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    const p = game.anchorPos();
    for (const inc of this.incidents) {
      inc.t += dt;
      if (inc.t > inc.life || Math.hypot(inc.x - p.x, inc.z - p.z) > 120) {
        this.disperse(inc);
        inc.done = true;
        continue;
      }
      if (game.time < inc.calm) continue;
      this.recruit(inc, dt);
      this.watch(inc, dt);
    }
    if (this.incidents.some((i) => i.done)) this.incidents = this.incidents.filter((i) => !i.done);
    this.aidT -= dt;
    if (this.aidT <= 0) {
      this.aidT = 2;
      this.firstAid(p);
    }
    for (const h of this.helps) this.tendAid(h, dt);
    if (this.helps.some((h) => h.done)) this.helps = this.helps.filter((h) => !h.done);
    this.fightT -= dt;
    if (this.fightT <= 0) {
      this.fightT = 25 + Math.random() * 30;
      this.maybeFight(p);
    }
    for (const f of this.fights) this.tendFight(f, dt);
    if (this.fights.some((f) => f.done)) this.fights = this.fights.filter((f) => !f.done);
  }

  free(c) {
    return !c.scripted && !c.ctrl && c.alive && !(c.panicT > 0) && !c.headless && !c.dog && !c.buddy && !c.buddyOf && !c.jog && !c.inside && !c.photo && c.fig.parts.legL > 0.5 && c.fig.parts.legR > 0.5;
  }

  borrow(c) {
    c.scripted = true;
    c.owner = this;
    c.goal = null;
    c.ctrl = (civ) => civ.goal;
  }

  giveBack(c) {
    if (c.owner !== this) return;
    const f = c.fig;
    f.reachR = null;
    f.reachL = null;
    f.crouch = 0;
    f.sit = 0;
    f.dead = 0;
    f.melee = -1;
    f.punch = -1;
    c.baseY = 0;
    c.goal = null;
    if (c.filming === 'took') f.carry = null;
    c.filming = undefined;
    this.game.civilians.release(c);
    c.scripted = false;
    this.game.civilians.rejoin(c);
  }

  // ------------------------------------------------------------------ onlookers
  recruit(inc, dt) {
    inc.recruitT -= dt;
    if (inc.recruitT > 0 || inc.watchers.length >= this.most || inc.t > inc.life - 8) return;
    inc.recruitT = 0.8 + Math.random();
    let best = null;
    let bd = 28;
    for (const c of this.game.civilians.list) {
      if (!this.free(c)) continue;
      const d = Math.hypot(c.pos.x - inc.x, c.pos.z - inc.z);
      if (d < bd && d > 3) {
        bd = d;
        best = c;
      }
    }
    if (!best) return;
    this.borrow(best);
    // a place on a loose ring round it, on the side they came from
    const a = Math.atan2(best.pos.x - inc.x, best.pos.z - inc.z) + (Math.random() - 0.5) * 0.8;
    const r = 4 + Math.random() * 2.5;
    let sx = inc.x + Math.sin(a) * r;
    let sz = inc.z + Math.cos(a) * r;
    // (not out in the road if it can be helped: then nearer the sidewalk they stood on)
    if (!blockAt(sx, sz) && blockAt(best.pos.x, best.pos.z)) {
      sx = (sx + best.pos.x) / 2;
      sz = (sz + best.pos.z) / 2;
    }
    best.goal = { x: sx, z: sz, speed: best.speed * 1.15 };
    best.watchT = 0;
    best.sayT = 2 + Math.random() * 6;
    inc.watchers.push(best);
    this.stats.onlookers++;
  }

  watch(inc, dt) {
    const game = this.game;
    const p = game.player.pos;
    for (const c of inc.watchers) {
      if (c.owner !== this) continue;
      // (frightened off: back to the street, running)
      if (c.panicT > 0 || !c.alive) {
        this.giveBack(c);
        continue;
      }
      if (c.goal && Math.hypot(c.pos.x - c.goal.x, c.pos.z - c.goal.z) < 0.5) c.goal = null;
      if (c.goal) continue;
      c.faceYaw = Math.atan2(inc.x - c.pos.x, inc.z - c.pos.z);
      c.watchT += dt;
      // the phone out, held up to film it (half of them)
      if (c.filming === undefined) {
        c.filming = Math.random() < 0.5 ? (c.fig.carry === 'phone' ? 'had' : c.fig.carry ? null : 'took') : null;
        if (c.filming === 'took') c.fig.carry = 'phone';
        if (c.filming) {
          c.film = new THREE.Vector3();
          this.stats.filming++;
        }
      }
      if (c.filming) {
        c.fig.toWorld(0.07, 1.47, 0.34, c.film);
        c.fig.reachR = c.film;
      }
      c.sayT -= dt;
      if (c.sayT <= 0) {
        c.sayT = 7 + Math.random() * 9;
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 22 && game.bubbles) game.bubbles.say(c, pick(LOOK_LINES[inc.kind] || LOOK_LINES.crash));
      }
    }
  }

  disperse(inc) {
    for (const c of inc.watchers) this.giveBack(c);
    inc.watchers = [];
  }

  // ------------------------------------------------------------------ first aid
  // somebody hurt (a leg rubbed out) and over the fright gets a passer-by kneeling beside them
  firstAid(p) {
    const game = this.game;
    if (this.helps.length >= (game.touch ? 1 : 2)) return;
    for (const v of game.civilians.list) {
      if (v.scripted || v.ctrl || !v.alive || v.headless || v.panicT > 0 || v.helped || v.inside) continue;
      const hurt = v.fig.parts.legL < 0.5 || v.fig.parts.legR < 0.5 || v.fig.parts.armL < 0.5 || v.fig.parts.armR < 0.5;
      if (!hurt || Math.hypot(v.pos.x - p.x, v.pos.z - p.z) > 50) continue;
      let best = null;
      let bd = 30;
      for (const c of game.civilians.list) {
        if (c === v || !this.free(c)) continue;
        const d = Math.hypot(c.pos.x - v.pos.x, c.pos.z - v.pos.z);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (!best) return;
      v.helped = true;
      this.borrow(v);
      this.borrow(best);
      // the hurt one sits down on the sidewalk; the helper comes and kneels
      v.fig.sit = 1;
      v.baseY = -0.42;
      const h = { v, c: best, t: 0, said: false };
      this.helps.push(h);
      this.stats.aid++;
      this.note('hurt', v.pos.x, v.pos.z).calm = game.time + 2;
      return;
    }
  }

  tendAid(h, dt) {
    const { v, c } = h;
    h.t += dt;
    const gone = !v.alive || !c.alive || v.owner !== this || c.owner !== this || v.panicT > 0 || c.panicT > 0;
    if (gone || h.t > 26) {
      this.giveBack(v);
      this.giveBack(c);
      v.fig.stagger = v.fig.parts.legL < 0.5 || v.fig.parts.legR < 0.5 ? 0.6 : 0;
      h.done = true;
      return;
    }
    const fx = v.fig.right.x;
    const fz = v.fig.right.z;
    const tx = v.pos.x + fx * 0.75;
    const tz = v.pos.z + fz * 0.75;
    if (Math.hypot(c.pos.x - tx, c.pos.z - tz) > 0.4 && h.t < 15) {
      c.goal = { x: tx, z: tz, speed: c.speed * 1.4 };
      return;
    }
    c.goal = null;
    c.faceYaw = Math.atan2(v.pos.x - c.pos.x, v.pos.z - c.pos.z);
    c.fig.crouch = 1;
    c.fig.reachR = v.fig.j.shoulderR;
    v.faceYaw = Math.atan2(c.pos.x - v.pos.x, c.pos.z - v.pos.z);
    if (!h.said) {
      h.said = true;
      const p = this.game.player.pos;
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 22) this.game.bubbles.say(c, pick(["Don't move, I've got you.", 'Help is on the way!', 'Breathe... you\'re okay.', 'Can you hear me?']));
    }
    if (h.t > 22) {
      c.fig.crouch = 0;
      v.fig.sit = 0;
      v.baseY = 0;
    }
  }

  // ------------------------------------------------------------------ scuffles
  // late in the evening by the bars, on the alleys' corners: two people at each other
  maybeFight(p) {
    const game = this.game;
    const h = game.daynight ? game.daynight.hour : 12;
    if (this.fights.length || !(h > 20 || h < 2)) return;
    const at = blockAt(p.x, p.z);
    const lively = (game.world.queues || []).some((q) => Math.hypot(q.door[0] - p.x, q.door[1] - p.z) < 60);
    if (!lively && !(at && at.type === 'gang')) return;
    if (Math.random() < 0.5) return;
    this.startFight(p);
  }

  // two walkers near each other (and near you), out of the way of the traffic
  startFight(p) {
    const civs = this.game.civilians;
    const cand = civs.list.filter((c) => this.free(c) && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 35 && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 6);
    for (const a of cand) {
      for (const b of cand) {
        if (a === b || Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 9) continue;
        return this.fight(a, b);
      }
    }
    return null;
  }

  // a and b square up, shove and swing in turns, one ends up down
  fight(a, b) {
    this.borrow(a);
    this.borrow(b);
    const mx = (a.pos.x + b.pos.x) / 2;
    const mz = (a.pos.z + b.pos.z) / 2;
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    a.goal = { x: mx - (dx / l) * 0.55, z: mz - (dz / l) * 0.55, speed: 2.2 };
    b.goal = { x: mx + (dx / l) * 0.55, z: mz + (dz / l) * 0.55, speed: 2.2 };
    const f = { a, b, x: mx, z: mz, t: 0, swingT: 2.2, turn: 0, phase: 'square' };
    this.fights.push(f);
    this.stats.fights++;
    // a crowd for it (no danger: they come at once)
    const inc = this.note('fight', mx, mz);
    if (inc) inc.calm = this.game.time + 1.5;
    return f;
  }

  tendFight(f, dt) {
    const { a, b } = f;
    const game = this.game;
    f.t += dt;
    const broken = !a.alive || !b.alive || a.owner !== this || b.owner !== this || a.panicT > 0 || b.panicT > 0;
    if (broken || f.t > 30) {
      this.giveBack(a);
      this.giveBack(b);
      f.done = true;
      return;
    }
    const p = game.player.pos;
    const near = Math.hypot(f.x - p.x, f.z - p.z) < 25;
    if (f.phase === 'square') {
      if (a.goal && Math.hypot(a.pos.x - a.goal.x, a.pos.z - a.goal.z) < 0.4) a.goal = null;
      if (b.goal && Math.hypot(b.pos.x - b.goal.x, b.pos.z - b.goal.z) < 0.4) b.goal = null;
      a.faceYaw = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      b.faceYaw = Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (f.t > 2.5) {
        f.phase = 'swing';
        f.t = 0;
        if (near) game.bubbles.say(a, pick(FIGHT_LINES), 'alarm');
      }
      return;
    }
    if (f.phase === 'swing') {
      a.faceYaw = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      b.faceYaw = Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      f.swingT -= dt;
      const who = f.turn % 2 ? b : a;
      const other = f.turn % 2 ? a : b;
      // the swing: the arm round, the other one rocked back a step (not with ?classic: a real punch,
      // one hand then the other, and the head snaps back: ROADMAP 5.4)
      const fists = !game.classic;
      if (f.swingT < 0.6 && f.swingT > 0) {
        if (fists) {
          who.fig.punch = Math.min(1, (0.6 - f.swingT) * 1.7);
          who.fig.punchSide = f.turn % 4 < 2 ? 1 : -1;
        } else who.fig.melee = (0.6 - f.swingT) * 1.5;
      }
      if (f.swingT <= 0) {
        who.fig.melee = -1;
        if (fists) {
          who.fig.punch = -1;
          other.fig.recoil = 1;
          other.fig.recoilSide = f.turn % 4 < 2 ? -1 : 1;
        }
        const ux = other.pos.x - who.pos.x;
        const uz = other.pos.z - who.pos.z;
        const ul = Math.hypot(ux, uz) || 1;
        other.pos.x += (ux / ul) * 0.25;
        other.pos.z += (uz / ul) * 0.25;
        other.fig.stagger = 1;
        if (near) game.audio.play('punch', 0.4);
        if (near && Math.random() < 0.5) game.bubbles.say(other, pick(FIGHT_LINES), 'alarm');
        f.turn++;
        f.swingT = 0.9 + Math.random() * 0.8;
        // (and back in, close again)
        other.goal = { x: f.x + (ux / ul) * 0.55, z: f.z + (uz / ul) * 0.55, speed: 1.2 };
      } else if (f.swingT < 0.5) {
        a.fig.stagger = 0;
        b.fig.stagger = 0;
      }
      if (f.turn >= 6) {
        // down goes one of them; the other walks off
        f.phase = 'down';
        f.t = 0;
        f.loser = Math.random() < 0.5 ? a : b;
        f.winner = f.loser === a ? b : a;
        f.loser.fig.dead = 0.9;
        f.loser.goal = null;
        if (near) game.audio.play('punch', 0.6);
        if (near) game.bubbles.say(f.winner, pick(['Stay down!', "Don't mess with me.", 'Had enough?']), 'alarm');
      }
      return;
    }
    // down
    if (f.t > 1.5 && f.winner.owner === this) this.giveBack(f.winner);
    if (f.t > 5) {
      const k = Math.max(0, 0.9 - (f.t - 5) * 0.6);
      f.loser.fig.dead = k;
      if (k <= 0) {
        if (near) game.bubbles.say(f.loser, pick(['Ow...', 'Okay, okay...', 'My nose...']));
        f.loser.fig.stagger = 0.5;
        this.giveBack(f.loser);
        f.done = true;
      }
    }
  }
}
