// (GTA IV) The patrol car on its rounds (game/police.js keeps one cruising round you when nothing
// is going on; game/traffic.js spawnPatrol: slower than the traffic, a look at the street as it
// goes) now and then pulls somebody over: the lights on the roof come on (no siren), the car in
// front of it signals, eases over to the curb and stops, its hazards going, and the patrol car
// stops behind it. An officer gets out, walks up to the driver's window, a word through it, the
// pad out for the ticket, a word back; back to the patrol car, in. The car pulls out first, the
// lights go off, and the patrol goes on its way.
//
// The officer is one of the street's people while out of the car (a scripted one, game/civilians.js);
// if anything happens (shots, the officer hurt, the car stopped taken or gone, you wanted) it is
// called off and everybody goes about their business. (?classic: none of it - game/fleet.js)

import { copLook } from './looks.js';
import { laneOffsets, stopDist } from '../world/roads.js';
import { randomCarSpec } from '../render/cars.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DECEL = 3.6;
const COP_OPEN = ['License and registration, please.', 'Evening. Know why I stopped you?', 'Engine off, please.', 'Hands where I can see them.'];
const DRIVER = ['Was I speeding, officer?', "I'm late for work...", 'Is there a problem?', 'It was yellow, I swear!'];
const COP_CLOSE = ['Taillight is out. Get it fixed.', "I'll let you off with a warning.", 'Drive safe, now.', 'Here is your ticket. Have a good one.'];

export class Patrol {
  constructor(fleet) {
    this.fleet = fleet;
    this.game = fleet.game;
    this.stats = { stops: 0, done: 0, called: 0 };
  }

  get traffic() {
    return this.game.traffic;
  }

  // a patrol car on its rounds (Fleet.update, now and then): somebody to pull over?
  look(c) {
    const game = this.game;
    if (c.tstop || !c.crew || !c.crew.length || c.mode !== 'patrol' || !c.path || c.wrecked) return;
    if ((c.tstopCool || 0) > game.time || (game.police && (game.police.hostile || game.police.level > 0))) return;
    if (!this.fleet.near(c, 140) || Math.random() > 0.3) return;
    const T = this.ahead(c);
    if (T) this.start(c, T);
  }

  // the car in front in its lane, a little way on, that may be pulled over
  ahead(c) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    let best = null;
    let bd = 42;
    for (const o of this.traffic.list) {
      if (o === c || !this.fair(o)) continue;
      const dx = o.pos.x - c.pos.x;
      const dz = o.pos.z - c.pos.z;
      const along = dx * fx + dz * fz;
      if (along < 9 || along > bd) continue;
      if (Math.abs(dx * fz - dz * fx) > 1.3 || Math.sin(o.yaw) * fx + Math.cos(o.yaw) * fz < 0.95) continue;
      bd = along;
      best = o;
    }
    return best;
  }

  // (a car that can be pulled over: an ordinary one, driving, on its way somewhere)
  fair(o) {
    const k = o.spec.kind;
    return (
      o.mode === 'drive' && !!o.path && !!o.driver && !o.police && !o.bus && !o.emergency && !o.garbage && !o.delivery && !o.pickup && !o.fare && !o.drop &&
      o.dropT === undefined && !o.pulled && !o.wrecked && !o.stopped && !o.crashed && !o.tail && !o.lineStop && o.poofT === undefined && k !== 'moto' && k !== 'truck' && k !== 'garbage'
    );
  }

  // (for the tests: the patrol car c pulls over the car in front of it now, if there is one)
  debugStop(c) {
    const T = this.ahead(c);
    if (T) this.start(c, T);
    return T;
  }

  // (for the tests: a patrol car out of sight of you, an ordinary car a little way in front of it
  // in its lane - and the one pulled over by the other)
  debugStage() {
    const tr = this.traffic;
    const c = tr.spawnPatrol();
    const g = c && c.path && c.path.gates[0];
    if (!g || g.off === undefined) return null;
    const along = (c.pos.x - g.from.x) * g.dx + (c.pos.z - g.from.z) * g.dz;
    const len = Math.abs(g.node.x - g.from.x) + Math.abs(g.node.z - g.from.z);
    const t = along + 16;
    if (t > len - stopDist(g.node, g.dz !== 0) - 10) return { c, T: null };
    const offs = laneOffsets(g.from, g.dx, g.dz);
    let li = 0;
    for (let i = 0; i < offs.length; i++) if (Math.abs(offs[i] - g.off) < 0.3) li = i;
    const nc = tr.newCar(randomCarSpec());
    tr.placeOnEdge(nc, g.from, g.node, li, t);
    tr.list.push(nc);
    this.start(c, nc);
    return { c, T: nc };
  }

  start(c, T) {
    c.tstop = { T, phase: 'follow', t: 0, cop: null, ctrl: null, go: { x: 0, z: 0, speed: 0 } };
    c.lights = true;
    T.pulled = { by: c, phase: 'notice', t: 0, run: 0, left: 0 };
    this.stats.stops++;
    if (this.fleet.near(c, 50)) this.game.audio.play('radio', 0.35);
  }

  // ------------------------------------------------------------------ how fast (Fleet.want)
  // the car pulled over: a moment to notice the lights, the signal, over to the curb, stopped
  wantPulled(T, dt) {
    const P = T.pulled;
    P.t += dt;
    if (P.phase === 'notice') {
      if (P.t < 1.1) return Infinity;
      P.phase = 'pull';
      P.left = Math.max(9, (T.speed * T.speed) / (2 * 2.4));
      T.pull = true;
      T.pullTo = this.traffic.curbRoom(T, P.left);
    }
    if (P.phase === 'pull') {
      P.run += T.speed * dt;
      T.sig2 = -1;
      const dist = P.left - P.run;
      if (dist < 0.8 && T.speed < 0.3) {
        P.phase = 'stopped';
        T.hazard = true;
      }
      return dist < 0.4 ? 0 : Math.sqrt(2 * DECEL * Math.max(0, dist)) * 0.8;
    }
    if (P.phase === 'stopped') return 0;
    // (let go: out into the lane again, the left signal on)
    if (P.phase === 'go') {
      T.sig2 = 1;
      if (P.t > 3.2) T.pulled = null;
      return P.t < 0.8 ? 0 : Infinity;
    }
    return Infinity;
  }

  // the patrol car: behind it all the way (Traffic.ahead keeps it a car's gap back), over to the
  // curb behind it, stopped there till it is done; then on its way
  wantPolice(c, dt) {
    const S = c.tstop;
    const T = S.T;
    if (S.phase === 'follow') {
      if (T.pulled && T.pulled.phase === 'stopped' && c.speed < 0.25) {
        S.phase = 'out';
        S.t = 0;
      } else if (T.pulled && T.pulled.phase !== 'notice' && !c.pull) {
        c.pull = true;
        c.pullTo = Math.min(T.pullTo || 0, this.traffic.curbRoom(c, 6));
      }
      return Infinity;
    }
    if (S.phase === 'leave') {
      c.sig2 = 1;
      return S.t < 2.4 ? 0 : Infinity;
    }
    return 0;
  }

  // ------------------------------------------------------------------ every frame (Fleet.update)
  tend(c, dt) {
    const S = c.tstop;
    const T = S.T;
    const game = this.game;
    const civs = game.civilians;
    S.t += dt;
    // (called off: the car gone or wrecked, you wanted, the officer hurt or frightened)
    const gone = !T || T.gone || T.poofT !== undefined || T.wrecked || this.traffic.list.indexOf(T) < 0 || !T.pulled || T.pulled.by !== c;
    const hot = game.police && (game.police.hostile || game.police.level > 0);
    const cop = S.cop;
    const lost = cop && (!cop.alive || cop.panicT > 0 || civs.list.indexOf(cop) < 0 || cop.ctrl !== S.ctrl);
    if (S.phase !== 'leave' && (gone || hot || lost || c.mode !== 'patrol' || S.t > 70)) {
      this.callOff(c);
      return;
    }
    if (S.phase === 'out' && S.t > 0.8) {
      // the officer out of the driver's door
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const x = c.pos.x + fx * 0.2 + fz * (c.halfWid + 0.5);
      const z = c.pos.z + fz * 0.2 - fx * (c.halfWid + 0.5);
      const crew = c.crew[0];
      const w = civs.spawnScripted(x, z, crew.look || copLook(), this);
      w.noCollide = true;
      w.speed = 1.3;
      w.yaw = c.yaw;
      S.cop = w;
      S.phase = 'walk';
      S.t = 0;
      S.ctrl = (me, dt2) => this.officer(c, me, dt2);
      w.ctrl = S.ctrl;
      if (this.fleet.near(c, 40)) game.audio.play('radio', 0.4);
    } else if (S.phase === 'leave' && S.t > 3) {
      c.tstop = null;
      c.lights = false;
      c.pull = false;
      c.hazard = false;
      c.tstopCool = game.time + 70 + Math.random() * 80;
      this.stats.done++;
    }
  }

  // the officer's walk up to the window and back (game/civilians.js ctrl)
  officer(c, me, dt) {
    const S = c.tstop;
    if (!S) return null;
    const T = S.T;
    const game = this.game;
    const f = me.fig;
    S.pt = (S.pt || 0) + dt;
    const tx = Math.sin(T.yaw);
    const tz = Math.cos(T.yaw);
    // (the driver's window: the car's left, by the front seat)
    const wx = T.pos.x + tx * -0.1 + tz * (T.halfWid + 0.55);
    const wz = T.pos.z + tz * -0.1 - tx * (T.halfWid + 0.55);
    const near = Math.hypot(me.pos.x - game.player.pos.x, me.pos.z - game.player.pos.z) < 26;
    const o = S.go;
    if (S.phase === 'walk') {
      if (Math.hypot(me.pos.x - wx, me.pos.z - wz) < 0.4 || S.pt > 14) {
        S.phase = 'talk';
        S.pt = 0;
        S.said = 0;
        return null;
      }
      o.x = wx;
      o.z = wz;
      o.speed = 1.3;
      return o;
    }
    if (S.phase === 'talk') {
      // a look in at the window, a word, the pad out for the ticket, a word back
      me.faceYaw = T.yaw - Math.PI / 2;
      if (!S.look) S.look = T.pos.clone();
      S.look.set(T.pos.x + tz * 0.3, 1.1, T.pos.z - tx * 0.3);
      f.lookAt = S.look;
      if (S.said === 0 && S.pt > 0.4) {
        S.said = 1;
        if (near) game.bubbles.say(me, pick(COP_OPEN));
      } else if (S.said === 1 && S.pt > 3.2) {
        S.said = 2;
        if (near) game.bubbles.say(this.traffic.driverAnchor(T), pick(DRIVER));
        f.carry = 'book';
      } else if (S.said === 2 && S.pt > 7.5) {
        S.said = 3;
        if (near) game.bubbles.say(me, pick(COP_CLOSE));
      } else if (S.said === 3 && S.pt > 9.5) {
        f.carry = null;
        f.lookAt = null;
        S.phase = 'back';
        S.pt = 0;
        // (the car stopped is let go: it pulls out first)
        if (T.pulled) {
          T.pulled.phase = 'go';
          T.pulled.t = 0;
          T.pull = false;
          T.hazard = false;
        }
      }
      return null;
    }
    if (S.phase === 'back') {
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const dx = c.pos.x + fx * 0.2 + fz * (c.halfWid + 0.5);
      const dz = c.pos.z + fz * 0.2 - fx * (c.halfWid + 0.5);
      if (Math.hypot(me.pos.x - dx, me.pos.z - dz) < 0.5 || S.pt > 14) {
        game.civilians.remove(me);
        S.cop = null;
        S.phase = 'leave';
        S.t = 0;
        c.pull = false;
        return null;
      }
      o.x = dx;
      o.z = dz;
      o.speed = 1.4;
      return o;
    }
    return null;
  }

  // everybody about their business
  callOff(c) {
    const S = c.tstop;
    if (!S) return;
    const T = S.T;
    const civs = this.game.civilians;
    if (T && T.pulled && T.pulled.by === c) {
      T.pulled = null;
      T.pull = false;
      T.hazard = false;
    }
    const w = S.cop;
    if (w && civs.list.indexOf(w) >= 0) {
      w.fig.carry = null;
      w.fig.lookAt = null;
      // (back in the car, if it is still there to get into; or off on foot)
      if (w.alive && w.panicT <= 0 && this.traffic.list.indexOf(c) >= 0) civs.remove(w);
      else {
        if (w.ctrl === S.ctrl) civs.release(w);
        w.scripted = false;
        civs.rejoin(w);
      }
    }
    c.tstop = null;
    c.lights = false;
    c.pull = false;
    c.tstopCool = this.game.time + 60;
    this.stats.called++;
  }

  // a car leaving the traffic (Fleet.forget): what it was part of called off
  forget(c) {
    if (c.tstop) this.callOff(c);
    if (c.pulled && c.pulled.by && c.pulled.by.tstop) this.callOff(c.pulled.by);
  }
}
