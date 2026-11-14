import * as THREE from 'three';

// (v5, ROADMAP 13.10) How the city's people take what happens round them - as people do, not as a
// flock. Something happens (a shot, a blast, a punch, a crash, glass breaking, somebody on fire, a
// drawing coming alive): it is an event at a place, loud or not, dangerous or not. Each person near
// enough to hear it, or looking its way with nothing in between, takes it in after a moment of their
// own (sooner the louder it is; later with their eyes on a phone). They start, turn to it, and then
// decide, by their temper (game/minds.js: bold or timid, warm, quick to anger, curious) and by how
// near and how bad it is: they run - along the sidewalk, round the corner, never into a wall - or
// crouch where they are; walk off from it, glancing back; stop and watch from a safe distance, their
// phone up to film; call the police; go over to shout at whoever did it; or look, say a word, and go
// on. Running people make others look, not run: a timid one nearby may follow, the rest turn to see
// what it is. After the fright, they slow down, look back, get their breath, and go about their day -
// away from where it happened.
//
// Events: kind -> how far it is heard, how far it is seen, how bad it is (0..1), how long it lasts,
// how much there is to see in it, and whether it is a crime.
export const EVENTS = {
  shot: { hear: 90, see: 45, danger: 0.85, life: 8, interest: 0.1, crime: true },
  blast: { hear: 160, see: 90, danger: 1, life: 12, interest: 0.45, crime: true },
  assault: { hear: 14, see: 32, danger: 0.4, life: 10, interest: 0.9, crime: true },
  hurt: { hear: 12, see: 30, danger: 0.45, life: 14, interest: 0.6, crime: true },
  crash: { hear: 45, see: 50, danger: 0.25, life: 20, interest: 0.85, crime: false },
  glass: { hear: 28, see: 20, danger: 0.12, life: 6, interest: 0.4, crime: true },
  fire: { hear: 10, see: 35, danger: 0.55, life: 15, interest: 0.55, crime: false },
  // (somebody running away from something: what makes the others look)
  runners: { hear: 9, see: 16, danger: 0.22, life: 6, interest: 0.3, crime: false },
};

const STARTLE = {
  shot: ['Gunshots!', 'Get down!', 'Was that a gun?!', 'Oh my god!', 'Run!'],
  blast: ['What was that?!', 'Oh my god!', 'Get back!', 'Run!'],
  assault: ['Hey!', 'Whoa!', 'Did he just hit him?', 'Oh no...'],
  hurt: ['Oh my god!', 'Is he okay?', 'Somebody help!'],
  crash: ['Whoa!', 'Ouch...', 'Did you see that?'],
  glass: ['Hey!', 'What the...', 'Seriously?'],
  fire: ['Fire!', 'Get away from it!', 'Somebody call 911!'],
  runners: ['What is going on?', 'Why is everybody running?'],
};
const CALL = ['Hello, police? There is a man with a weapon...', 'Yes, I want to report something - right now, on this street.', '911? Somebody is hurt here, please hurry.', 'Police? He is still here. Please come.'];
const CONFRONT = ['Hey! Leave him alone!', 'What is wrong with you?!', 'Back off! I am calling the cops!', 'You think that is funny?!'];
const RECOVER = ['That was close...', 'My heart...', 'Unbelievable.', 'Is it over?', 'I need to sit down.'];

// (what the one with them does too)
const JOIN = new Set(['flee', 'avoid', 'cover', 'cower', 'leave']);
// (ROADMAP 13.12) how far a reaction goes. Something that goes on and gets worse - more shots, more
// blows - is taken in again, and changes what they do only if it takes them further than what they
// are doing already: the one who only looked at the first shot runs at the third
const RANK = { glance: 0, notice: 1, watch: 1, film: 1, recover: 2, call: 2, confront: 2, avoid: 3, leave: 3, cover: 4, cower: 4, flee: 5 };

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _dir = new THREE.Vector3();
let nextId = 1;

export class Brain {
  constructor(game) {
    this.game = game;
    this.events = [];
    this.t = 0;
    this.sayT = 0;
    this.spreadT = 0;
    // (counted for the tests)
    this.stats = { events: 0, perceived: 0, flee: 0, cower: 0, avoid: 0, watch: 0, film: 0, call: 0, confront: 0, glance: 0, startle: 0, recover: 0, planned: 0, blocked: 0, cover: 0, leave: 0, joined: 0, reports: 0, phoned: 0, unreported: 0 };
    // (your crimes somebody saw, waiting for one of them to phone them in: game/police.js crime)
    this.reports = [];
    this.reportT = 0;
  }

  // the civilian's own state of mind for what happens round them
  ai(c) {
    // (seen: each event taken in, and how far it had gone then - game/brain.js event)
    return c.ai || (c.ai = { seen: new Map(), state: null, until: 0, stim: null, ev: null, phase: 0, goal: null, planT: 0, pdx: 0, pdz: 0, lookBackT: 0, arms: false, calmT: 0 });
  }

  // ------------------------------------------------------------------ an event
  // kind (EVENTS); o: { by: 'player' or whoever did it, victim, armed, radius (old callers' reach) }
  event(kind, x, z, o = {}) {
    const E = EVENTS[kind];
    if (!E) return null;
    const game = this.game;
    const now = game.time;
    // (the same thing again at the same place: the event goes on)
    let ev = this.events.find((e) => e.kind === kind && Math.abs(e.x - x) + Math.abs(e.z - z) < 8 && now < e.until);
    if (ev) {
      ev.until = now + E.life;
      ev.last = now;
      ev.n++;
    } else {
      // (sx, sz: what to keep away from - whoever did it, else the place itself)
      ev = { id: nextId++, kind, x, z, sx: o.src ? o.src.x : x, sz: o.src ? o.src.z : z, t: now, last: now, until: now + E.life, n: 1, by: o.by || null, victim: o.victim || null, armed: !!o.armed, danger: E.danger, E };
      this.events.push(ev);
      this.stats.events++;
    }
    // (ROADMAP 13.12) the people of the stores round it - the ones drawn the cheap way, game/shopcrowd.js
    // - hear a shot, a blast, too
    if (E.danger >= 0.8 && game.shopCrowd && game.shopCrowd.alarm) game.shopCrowd.alarm(x, z, E.hear * 0.7);
    const civs = game.civilians;
    if (!civs) return ev;
    const cam = game.camera.position;
    // (who takes it in: near enough to hear it, or looking its way with nothing in between)
    for (const c of civs.list) {
      if (!c.alive || c.inside || c.gone || c.headless || c.dying >= 0 || c.brave) continue;
      // (far from you, the city's people are left as they are)
      if (Math.abs(c.pos.x - cam.x) > 140 || Math.abs(c.pos.z - cam.z) > 140) continue;
      const a = this.ai(c);
      // (taken in already: again only once it has got worse - two more shots, two more blows - and
      // while they are not yet as afraid as it can make them)
      const n0 = a.seen.get(ev.id);
      if (n0 !== undefined && (ev.n < n0 + 2 || a.stim || (RANK[a.state] || 0) >= 4)) continue;
      const dx = x - c.pos.x;
      const dz = z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const victim = o.victim === c;
      const heard = d < E.hear;
      let seen = false;
      if (!heard || d < E.see) {
        if (d < E.see) {
          const f = c.fig ? c.fig.forward : null;
          const ahead = f && d > 0.1 ? (dx * f.x + dz * f.z) / d : 1;
          // (in front of them - their eyes take in more than their face points at - or very near)
          seen = (ahead > -0.25 || d < 6) && this.clear(c.pos.x, c.pos.z, x, z, d);
        }
      }
      if (!victim && !heard && !seen) continue;
      a.seen.set(ev.id, ev.n);
      if (a.seen.size > 24) a.seen.delete(a.seen.keys().next().value);
      // (a moment before it sinks in: the louder, the sooner; busy with a phone, a word, later)
      const busy = (c.fig && c.fig.carry === 'phone' ? 0.45 : 0) + (c.convo ? 0.25 : 0);
      const loud = kind === 'shot' || kind === 'blast';
      const delay = victim ? 0.05 : loud ? 0.15 + Math.random() * 0.35 + d * 0.004 + busy : 0.4 + Math.random() * 0.9 + d * 0.01 + busy;
      a.stim = { ev, at: now + delay, d, seen, heard, victim, again: n0 !== undefined };
      this.stats.perceived++;
    }
    return ev;
  }

  // nothing solid between two points on the ground (eye height), d apart
  clear(ax, az, bx, bz, d) {
    const col = this.game.world && this.game.world.collision;
    if (!col || d < 2) return true;
    const hit = col.raycast(ax, 1.5, az, bx - ax, 0, bz - az, d - 0.5);
    return !hit;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || !game.civilians) return;
    const now = game.time;
    this.events = this.events.filter((e) => now < e.until + 30);
    this.t += dt;
    const step = this.t;
    if (step < 0.1) return;
    this.t = 0;
    for (const c of game.civilians.list) {
      const a = c.ai;
      if (!a) continue;
      if (!c.alive || c.dying >= 0) {
        c.ai = null;
        continue;
      }
      // what they took in sinks in
      if (a.stim && now >= a.stim.at) {
        const s = a.stim;
        a.stim = null;
        this.react(c, a, s);
      }
      this.tend(c, a, step);
    }
    // running people make the others nearby look - and some of them follow
    this.spreadT -= step;
    if (this.spreadT <= 0) {
      this.spreadT = 0.5;
      this.spread();
    }
    this.reportT -= step;
    if (this.reportT <= 0) {
      this.reportT = 1;
      if (this.reports.length) this.callers();
    }
  }

  // ------------------------------------------------------------------ deciding
  react(c, a, s) {
    const game = this.game;
    const ev = s.ev;
    const E = ev.E;
    const m = game.minds ? game.minds.of(c) : { bold: 0.5, warm: 0.5, temper: 0.5, curious: 0.5, chatty: 0.5 };
    const now = game.time;
    if (c.scripted && !c.mgr) return;
    // how bad it is for them: how bad it is, how near (the edge of what is heard or seen counts for
    // little), whether they only heard it, whether it was done to them, a weapon in it, and who did it
    const range = Math.max(E.hear, E.see);
    const near = clamp(1 - s.d / range, 0, 1);
    let threat = ev.danger * Math.pow(near, 0.7) * (s.seen ? 1 : 0.8) * (ev.armed ? 1.35 : 1) * Math.min(1.6, 1 + (ev.n - 1) * 0.12);
    if (s.victim) threat = Math.max(threat, 0.75);
    // (right by it - a fist fight an arm's length off, a car crashing in front of them: a fright
    // whatever it is; further off, something to look at)
    else if ((ev.kind === 'assault' || ev.kind === 'hurt') && s.d < 4.5) threat = Math.max(threat, 0.62);
    else if (ev.kind === 'crash' && s.d < 7) threat = Math.max(threat, 0.72);
    if (ev.by === 'player' && game.minds) threat *= 1 + 0.2 * game.minds.dread;
    // their fear of it: the timid more, the bold less - and what they already are (running, afraid)
    const fear = threat * (1.35 - m.bold * 0.8) + (a.state === 'flee' ? 0.2 : 0) + (Math.random() - 0.5) * 0.12;
    const curiosity = m.curious * E.interest * (1 - Math.min(1, threat * 1.4));
    const dx = ev.x - c.pos.x;
    const dz = ev.z - c.pos.z;
    // (startled first, by anything loud or near: a flinch, the head to it)
    const loud = ev.kind === 'shot' || ev.kind === 'blast' || ev.kind === 'glass' || s.d < 6;
    if (loud && !s.victim && c.fig) {
      c.fig.recoil = Math.max(c.fig.recoil, 0.35);
      this.stats.startle++;
    }
    this.look(c, ev.x, 1.2, ev.z, 1.2 + Math.random());
    // (where it happened - whoever did it - to keep away from, for a while)
    c.fearX = ev.sx !== undefined ? ev.sx : ev.x;
    c.fearZ = ev.sz !== undefined ? ev.sz : ev.z;
    a.ev = ev;
    // ---- what they do
    const crime = E.crime && ev.by;
    // (in a shop, a café, a mall store: there is the door, and little room for anything else - and
    // it happened either in here, or out in the street: seen through the window, heard through the
    // wall)
    const room = c.exitRoom && c.ctrl ? c.exitRoom : null;
    const out = !!(room && room.inside && !room.inside(ev.x, ev.z, 0.3));
    // (up on a floor of the mega mall: nowhere to run that their feet can take them)
    const up = (c.baseY || 0) > 1;
    let act = 'glance';
    if (s.follow) act = s.act;
    else if (s.victim) act = m.bold > 0.8 && m.temper > 0.6 && !ev.armed ? 'confront' : 'flee';
    else if (fear > 0.62) {
      // shots: down where they are (the timid, very near), or behind the nearest car or wall until it
      // goes quiet - or run. (Somebody a scene holds in its place - at a table, in a group - is not
      // taken off behind a car by it: they run, or get down)
      if (ev.kind === 'shot' && s.d < 14 && m.bold < 0.3 && Math.random() < 0.55) act = 'cower';
      else if (ev.kind === 'shot' && !room && (!c.ctrl || c.buddyOf) && s.d < 32 && Math.random() < 0.72 - m.bold * 0.3 && this.cover(c, a, ev)) act = 'cover';
      else act = 'flee';
    } else if (fear > 0.4) act = 'avoid';
    else if (crime && m.bold > 0.82 && m.temper > 0.65 && ev.kind === 'assault' && !ev.armed && s.d < 12) act = 'confront';
    else if (crime && m.warm > 0.6 && s.d > 5 && Math.random() < 0.2) act = 'call';
    else if (curiosity > 0.3 && s.d < 40) act = m.bold > 0.45 && Math.random() < 0.55 ? 'film' : 'watch';
    // (ROADMAP 13.12) what they would do, before what they are in the middle of has its say - the one
    // with them goes by this
    const want = act;
    // (hit while something holds them - at a table, in a shop: not a word back from there, but away)
    if (s.victim && act === 'confront' && c.ctrl) act = 'flee';
    if (room) {
      // in a shop: what happens out in the street is kept out - down behind the shelves, the counter,
      // and stay in (nobody runs out of the door into it); what happens in here, out of the door, at a
      // walk or running. Whoever would have stood and watched stops what they are doing and turns to
      // it a while, then goes on with it
      if (out && act === 'flee') act = 'cower';
      else if (act === 'avoid') act = out ? 'notice' : 'leave';
      else if (act === 'confront' || act === 'watch' || act === 'film' || act === 'glance') act = 'notice';
    } else if (up) {
      if (act === 'flee' || act === 'cover') act = 'cower';
      else if (act === 'avoid' || act === 'confront') act = 'notice';
    } else if (c.ctrl) {
      // (held by what they are doing - at a table, in a group, shopping in the mall: they stop and
      // turn to it; walking with a friend, they keep with the friend. Running, or getting down,
      // still takes them out of it)
      if (act === 'avoid') act = c.buddyOf ? 'glance' : 'notice';
      else if (act === 'confront') act = 'notice';
    }
    // (more of the same - or something else while they are in the middle of a reaction, the people
    // running past the one behind the car: only what takes them further than what they are doing
    // already. The one with them, and the one it is done to, go by it whatever)
    if (!s.follow && !s.victim && (s.again || (a.state && a.state !== 'glance')) && (RANK[act] || 0) <= (RANK[a.state] || 0)) return;
    // (with somebody - a partner, a friend: they go where the other goes, do what the other does)
    a.with = s.follow || null;
    a.want = want;
    this.start(c, a, act, ev, m, threat);
    // (frightened off: not straight back to it for a look - game/reactions.js, Brain.busy)
    if ((RANK[a.state] || 0) >= 3) a.fled = now;
    // the one they are with does the same, a moment after
    const mate = c.buddy || c.buddyOf;
    const jact = act === 'notice' || act === 'glance' ? want : act;
    if (!s.follow && mate && JOIN.has(jact) && mate.alive && !mate.gone && !mate.headless) this.join(mate, c, jact, ev);
    // a word, now and then (one at a time round there)
    if (!s.follow && now > this.sayT && Math.random() < (loud ? 0.4 : 0.25) * (0.5 + m.chatty)) {
      this.sayT = now + 1.4;
      const line = act === 'confront' ? null : pick(STARTLE[ev.kind] || STARTLE.crash);
      if (line && game.voices) game.voices.say(c, `[${fear > 0.5 ? 'scared' : 'surprised'}] ${line}`, fear > 0.5 ? 'alarm' : 'plain');
    }
    void dx;
    void dz;
  }

  start(c, a, act, ev, m, threat) {
    const game = this.game;
    const now = game.time;
    this.end(c, a);
    a.state = act;
    a.phase = 0;
    a.goal = null;
    a.planT = 0;
    this.stats[act] = (this.stats[act] || 0) + 1;
    switch (act) {
      case 'flee': {
        // (how long: how bad it was, how timid they are)
        const T = 5 + threat * 9 + (1 - m.bold) * 4;
        c.panicT = T;
        a.until = now + T;
        // (most run as people run; a few with their arms up) - after a moment frozen, taking it in
        a.arms = m.bold < 0.25 && Math.random() < 0.5;
        // (each their own pace: not a crowd running as one)
        a.pace = 0.82 + Math.random() * 0.3;
        a.fleeT = 0;
        a.startle = ev.victim === c ? 0.15 : 0.25 + Math.random() * 0.45;
        a.lookBackT = 1.5 + Math.random() * 2;
        break;
      }
      case 'cower':
        c.cowerT = 3 + Math.random() * 4;
        a.until = now + c.cowerT;
        a.t0 = now;
        break;
      case 'avoid':
        c.avoidT = 5 + Math.random() * 5;
        a.until = now + c.avoidT;
        a.lookBackT = 1 + Math.random() * 1.5;
        break;
      case 'watch':
      case 'film':
        if (!game.reactions || !game.reactions.enlist(c, ev, act === 'film')) {
          a.state = 'glance';
          a.until = now + 2;
        } else a.until = now + 40;
        break;
      case 'call':
        // (the phone out, a number, the line: it gets through a few seconds in - game/police.js)
        c.callT = 7 + Math.random() * 4;
        a.until = now + c.callT;
        a.said = false;
        a.through = now + 3.6 + Math.random() * 1.5;
        for (const r of this.reports) if (!r.done && !r.caller && Math.abs(r.x - c.pos.x) + Math.abs(r.z - c.pos.z) < 90) r.caller = c;
        break;
      case 'cover': {
        // (bent low, to the place behind it; down there until it goes quiet)
        const j = a.with && a.with.coverAt;
        if (j) {
          // (next to the one they are with)
          const ox = j.x - c.fearX;
          const oz = j.z - c.fearZ;
          const l = Math.hypot(ox, oz) || 1;
          a.cover = { x: j.x - (oz / l) * 0.85, z: j.z + (ox / l) * 0.85 };
        }
        if (!a.cover) {
          a.state = null;
          this.start(c, a, 'flee', ev, m, threat);
          return;
        }
        c.coverAt = a.cover;
        c.coverT = 40;
        a.t0 = now;
        a.until = now + 40;
        a.peekT = 1 + Math.random() * 2;
        break;
      }
      case 'leave':
        // (the shop, the café: out of the door, not running - game/streetlife.js)
        if (c.owner && c.owner.sendOut && c.owner.sendOut(c)) a.until = now + 25;
        else {
          // (nowhere they can be sent out of: they stop, and take it in)
          a.state = null;
          this.start(c, a, 'notice', ev, m, threat);
          return;
        }
        break;
      case 'notice':
        // (ROADMAP 13.12) stopped by it: what they were doing waits while they turn to it and take it
        // in - then on with it (game/civilians.js). The hand that was at a shelf, a cup at the lips,
        // comes down
        // (a look round at it, for what would have been a glance in the open: they are standing, and
        // it may be behind them)
        c.noticeT = a.want === 'glance' ? 1.3 + Math.random() * 1.2 : 2.5 + Math.random() * 2.5;
        a.until = now + c.noticeT;
        if (ev && ev.x !== undefined) this.look(c, ev.x, 1.2, ev.z, c.noticeT);
        if (c.fig) {
          c.fig.reachR = null;
          c.fig.holdUp = 0;
          c.fig.drinkT = -1;
          c.fig.feel = { mood: threat > 0.3 ? 'scared' : 'surprised', until: now + c.noticeT * 0.8 };
        }
        break;
      case 'confront':
        c.confrontT = 6 + Math.random() * 4;
        a.until = now + c.confrontT;
        a.said = false;
        break;
      default:
        a.until = now + 2;
    }
  }

  // done with whatever it was
  end(c, a) {
    const f = c.fig;
    if (a.state === 'cower' || a.state === 'cover') c.crouchW = 0;
    if ((a.state === 'call' || a.state === 'film') && f && a.phone) {
      if (f.carry === 'phone' && a.phone === 'took') f.carry = null;
      f.reachR = null;
    }
    if (a.state === 'flee' && f) f.armsUp = 0;
    for (const r of this.reports) if (r.caller === c) r.caller = null;
    a.phone = null;
    a.cover = null;
    c.coverT = 0;
    c.coverAt = null;
    c.cowerT = 0;
    c.avoidT = 0;
    c.callT = 0;
    c.confrontT = 0;
    c.noticeT = 0;
  }

  // the head (and with it the eyes) to a point for a while - eased, render/people.js and game/doodle.js
  look(c, x, y, z, secs) {
    if (!c.fig) return;
    const a = this.ai(c);
    const v = a.lookV || (a.lookV = new THREE.Vector3());
    v.set(x, (c.pos.y || 0) + y, z);
    c.glanceAt = v;
    c.glanceUntil = this.game.time + secs;
    // (ROADMAP 13.12) and away from whatever their scene had them looking at - the shelf, the menu,
    // the friend talking: a shot, a blow, is looked at (Civilian.social)
    c.glanceHard = c.glanceUntil;
  }

  // ------------------------------------------------------------------ doing it
  tend(c, a, dt) {
    const game = this.game;
    const now = game.time;
    const f = c.fig;
    if (!a.state || !f) return;
    switch (a.state) {
      case 'flee':
        if (!(c.panicT > 0)) {
          // (out of breath, it sinks in: slower, a look back, a word)
          a.state = 'recover';
          a.until = now + 3 + Math.random() * 3;
          f.armsUp = 0;
          c.stopT = 1.5 + Math.random() * 2;
          this.look(c, c.fearX, 1.2, c.fearZ, 1.5);
          this.stats.recover++;
          // (and then on with their day - away from it, not back past it: Brain.resume)
          this.resume(c);
          // (far enough: the phone out, to call it in - as many do, once they are safe)
          const m = game.minds ? game.minds.of(c) : null;
          a.callAfter = !!(m && this.pending(c.pos.x, c.pos.z, 120) && m.warm > 0.3 && Math.random() < 0.55);
          if (now > this.sayT && Math.random() < 0.35 && game.voices) {
            this.sayT = now + 2;
            game.voices.say(c, `[scared] ${pick(RECOVER)}`);
          }
        }
        break;
      case 'recover':
        if (now > a.until) {
          a.state = null;
          if (a.callAfter && !c.ctrl && this.pending(c.pos.x, c.pos.z, 120)) this.start(c, a, 'call', a.ev || { x: c.fearX, z: c.fearZ }, game.minds ? game.minds.of(c) : { bold: 0.5 }, 0.3);
          a.callAfter = false;
        }
        break;
      case 'avoid':
        // (walked off from it far enough; or taken into something else on the way - then it is that)
        if (!(c.avoidT > 0) || c.ctrl) {
          if (c.ctrl) c.avoidT = 0;
          a.state = null;
          this.resume(c);
        }
        break;
      case 'notice':
        if (!(c.noticeT > 0)) a.state = null;
        break;
      case 'cover': {
        const ev = a.ev;
        const p = game.player.pos;
        const dp = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
        const cv = c.coverAt;
        const at = cv && Math.hypot(cv.x - c.pos.x, cv.z - c.pos.z) < 0.6;
        // (a look over it, now and then)
        if (at && (a.peekT -= dt) <= 0) {
          a.peekT = 1.4 + Math.random() * 2.6;
          this.look(c, c.fearX, 1.4, c.fearZ, 0.6 + Math.random() * 0.5);
        }
        // it has gone quiet a while; whoever it is comes their way; too long down there: up and away
        const quiet = this.quiet(c);
        const near = ev && ev.by === 'player' && dp < 6;
        if ((quiet && now - a.t0 > 2.5) || near || now - a.t0 > 30 || (!at && now - a.t0 > 7)) {
          const m = game.minds ? game.minds.of(c) : { bold: 0.5 };
          if (quiet && !near && dp > 18 && Math.random() < 0.35) {
            this.end(c, a);
            a.state = 'recover';
            a.until = now + 3 + Math.random() * 2;
            c.stopT = 2;
            a.callAfter = !!(this.pending(c.pos.x, c.pos.z, 120) && (m.warm || 0) > 0.35 && Math.random() < 0.6);
            this.stats.recover++;
            this.resume(c);
          } else this.start(c, a, 'flee', ev || { x: c.fearX, z: c.fearZ }, m, 0.55);
        }
        break;
      }
      case 'leave':
        if (now > a.until || !c.ctrl || c.owner === null) {
          a.state = null;
          // (out of the door: on along the sidewalk, away from it)
          this.resume(c);
        }
        break;
      case 'cower':
        if (!(c.cowerT > 0)) {
          // down until it goes quiet (not much longer than half a minute); then up, and away from it.
          // In a shop, up a floor of the mall: up, and on with what they were doing - or, in a shop,
          // out of the door now it is over
          const ev = a.ev;
          if (!this.quiet(c) && now - (a.t0 || now) < 25) {
            c.cowerT = 1.2 + Math.random() * 1.5;
            break;
          }
          const stay = (c.exitRoom && c.ctrl) || (c.baseY || 0) > 1;
          this.end(c, a);
          a.state = null;
          const m = game.minds ? game.minds.of(c) : { bold: 0.3 };
          if (!stay) this.start(c, a, 'flee', ev || { x: c.fearX, z: c.fearZ }, m, 0.5);
          else if (c.exitRoom && Math.random() < 0.5) this.start(c, a, 'leave', ev || { x: c.fearX, z: c.fearZ }, m, 0.3);
        }
        break;
      case 'call':
        if (c.callT > 0) {
          // the phone to the ear, the eyes on it
          if (!a.phone) {
            a.phone = f.carry === 'phone' ? 'had' : f.carry ? null : 'took';
            if (a.phone === 'took') f.carry = 'phone';
          }
          if (a.phone) {
            const v = a.ear || (a.ear = new THREE.Vector3());
            f.toWorld(0.11, 1.62, 0.04, v);
            f.reachR = v;
          }
          if (!a.said && c.callT < 5.5 && game.voices) {
            a.said = true;
            game.voices.say(c, `[scared] ${pick(CALL)}`);
          }
          // (through to the police: what they saw of yours is reported - game/police.js)
          if (a.through && now > a.through) {
            a.through = 0;
            this.phoned(c);
          }
          if (a.ev && (a.lookT = (a.lookT || 0) - dt) <= 0) {
            a.lookT = 1.5 + Math.random() * 2;
            this.look(c, a.ev.x, 1.2, a.ev.z, 1.2);
          }
        } else {
          this.end(c, a);
          a.state = null;
        }
        break;
      case 'confront':
        if (c.confrontT > 0 && !c.ctrl) {
          const p = game.player.pos;
          const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
          f.feel = { mood: 'angry', until: now + 1 };
          this.look(c, p.x, 1.6, p.z, 0.6);
          if (!a.said && d < 9 && game.voices) {
            a.said = true;
            game.voices.sayToYou(c, `[angry] ${pick(CONFRONT)}`, 'alarm');
          }
          // (you come at them, or a weapon comes out: they think better of it)
          const w = game.weapons;
          const armed = !!(w && w.current && w.current.def && w.current.def.kind === 'gun');
          if (d < 1.8 || armed) {
            this.end(c, a);
            this.start(c, a, 'flee', a.ev || { x: p.x, z: p.z }, game.minds ? game.minds.of(c) : { bold: 0.5 }, 0.6);
          }
        } else {
          this.end(c, a);
          a.state = null;
        }
        break;
      case 'watch':
      case 'film':
        // (the onlookers' own: game/reactions.js; when they let them go, done)
        if (c.owner !== game.reactions || now > a.until) a.state = null;
        break;
      default:
        if (now > a.until) a.state = null;
    }
  }

  // ------------------------------------------------------------------ where to: running, walking off
  // the next point of somebody running from c.fearX, c.fearZ (fast: away, along the sidewalk where
  // it goes away, round the corner, through the open where the ground is open - never into a wall);
  // walking off (avoid), the same at a walk. Returns { x, z, speed } (game/civilians.js)
  fleeGoal(c, dt, walk = false) {
    const a = this.ai(c);
    a.fleeT = (a.fleeT || 0) + dt;
    a.planT -= dt;
    // (running with the one they are with: at their side, not off on their own)
    const w = a.with;
    if (w && w !== c && w.alive && !w.gone && !w.headless && w.ai && w.ai.with !== c && (walk ? w.avoidT > 0 : w.panicT > 0)) {
      const wl = Math.hypot(w.vel.x, w.vel.z);
      const fx = wl > 0.3 ? w.vel.x / wl : Math.sin(w.yaw);
      const fz = wl > 0.3 ? w.vel.z / wl : Math.cos(w.yaw);
      const side = a.side || (a.side = Math.random() < 0.5 ? -1 : 1);
      const gx = w.pos.x + fx * 0.6 + fz * side * 0.7;
      const gz = w.pos.z + fz * 0.6 - fx * side * 0.7;
      const gap = Math.hypot(gx - c.pos.x, gz - c.pos.z);
      // (and stopping when they stop, a beat after - not running on alone once the other has
      // stopped)
      if (walk) c.avoidT = w.avoidT + 0.2;
      else c.panicT = w.panicT + 0.2;
      if (c.fig) c.fig.armsUp = 0;
      return { x: gx, z: gz, speed: Math.min(walk ? 3 : 6.4, Math.max(wl, walk ? 1.4 : 3) + gap * 0.9) };
    }
    // (the first moment: still, the head to it - then off)
    if (!walk && a.fleeT < (a.startle || 0)) return { x: c.pos.x, z: c.pos.z, speed: 0 };
    const px = c.pos.x;
    const pz = c.pos.z;
    const ax = px - c.fearX;
    const az = pz - c.fearZ;
    const dFear = Math.hypot(ax, az) || 1;
    if (!a.goal || a.planT <= 0 || Math.hypot(a.goal.x - px, a.goal.z - pz) < 1.3) this.plan(c, a, ax / dFear, az / dFear);
    // how fast: a sprint at first, slower the further off and the longer at it; walking off, a brisk
    // walk
    const far = clamp((dFear - 25) / 30, 0, 1);
    let speed = (walk ? 2.2 + (1 - far) * 0.6 : (a.fleeT < 4 ? 5.6 : 4.4) * (1 - far * 0.55)) * (a.pace || 1);
    if (c.role === 'elder') speed *= 0.65;
    // a look back over the shoulder now and then
    a.lookBackT -= dt;
    if (a.lookBackT <= 0) {
      a.lookBackT = (walk ? 1.6 : 2.4) + Math.random() * 2.5;
      this.look(c, c.fearX, 1.2, c.fearZ, walk ? 0.9 : 0.6);
    }
    if (c.fig) c.fig.armsUp = !walk && a.arms ? 1 : 0;
    const g = a.goal;
    return { x: g.x, z: g.z, speed };
  }

  plan(c, a, ux, uz) {
    this.stats.planned++;
    a.planT = 0.55 + Math.random() * 0.25;
    const px = c.pos.x;
    const pz = c.pos.z;
    const col = this.game.world && this.game.world.collision;
    let best = null;
    let bs = -1e9;
    const pdx = a.pdx;
    const pdz = a.pdz;
    const consider = (dx, dz, len, bonus) => {
      // (open ahead? the first thing in the way, at chest height)
      let room = len;
      if (col) {
        const hit = col.raycast(px, 1.1, pz, dx, 0, dz, len);
        if (hit) room = hit.t;
      }
      if (room < 1.6) {
        this.stats.blocked++;
        return;
      }
      let s = (dx * ux + dz * uz) * 2 + (dx * pdx + dz * pdz) * 0.7 + bonus - (1 - room / len) * 1.6;
      // (not back past the danger)
      const tx = px + dx * room * 0.8;
      const tz = pz + dz * room * 0.8;
      const dd = Math.hypot(tx - c.fearX, tz - c.fearZ);
      if (dd < Math.hypot(px - c.fearX, pz - c.fearZ)) s -= 1.2;
      if (s > bs) {
        bs = s;
        best = { x: tx, z: tz, dx, dz };
      }
    };
    // along their own sidewalk, either way round the block: the corners ahead and behind
    const L = c.loop;
    if (L && L.length > 1 && typeof c.target === 'number') {
      const n = L.length;
      for (const k of [c.target, (c.target - c.dir + n) % n]) {
        const q = L[k];
        if (!q) continue;
        const dx = q[0] - px;
        const dz = q[1] - pz;
        const l = Math.hypot(dx, dz);
        if (l > 2.5) consider(dx / l, dz / l, Math.min(l, 14), 0.55);
      }
    }
    // and the open ground all round
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      consider(Math.sin(ang), Math.cos(ang), 9, 0);
    }
    if (!best) {
      // (hemmed in: back the way they came)
      best = { x: px + ux * 2, z: pz + uz * 2, dx: ux, dz: uz };
    }
    a.goal = best;
    a.pdx = best.dx;
    a.pdz = best.dz;
  }

  // ------------------------------------------------------------------ the one they are with
  // b does what lead does, a moment after (and keeps with them)
  join(b, lead, act, ev) {
    const a = this.ai(b);
    if (b.inside) return;
    if (a.state === act) {
      // (ROADMAP 13.12) the other one took it in first and is at it already, on their own: from now
      // on the two of them go together - not each their own way down the street
      if (!a.with && !(lead.ai && lead.ai.with === b)) a.with = lead;
      return;
    }
    a.seen.set(ev.id, ev.n || 1);
    a.stim = { ev, at: this.game.time + 0.15 + Math.random() * 0.3, d: Math.hypot(b.pos.x - ev.x, b.pos.z - ev.z), seen: true, heard: true, victim: false, follow: lead, act };
    this.stats.joined++;
  }

  // (ROADMAP 13.12) gone quiet round c: no shot, no blast - nothing dangerous - heard there in the last
  // few seconds (the same shooting, or the one who does it on the move, a new place every few shots)
  quiet(c) {
    const now = this.game.time;
    for (const e of this.events) {
      if (e.danger < 0.5 || now - (e.last || e.t) > 3.5) continue;
      if (Math.hypot(e.x - c.pos.x, e.z - c.pos.z) < e.E.hear) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ (ROADMAP 13.12) after it
  // Over the fright: on with their day from where they are now. On the sidewalk they are on - the
  // nearest one, if they ran across the road or round the corner onto another - and the way along it
  // that takes them further from where it happened, not back past it. Off the sidewalk (out in the
  // road, across a square) with something in the way of the corner they make for: back onto the
  // sidewalk first, the short way (game/civilians.js via)
  resume(c) {
    if (c.ctrl || c.scripted || !c.loop || !c.mgr || c.fearX === undefined || !c.alive) return;
    const px = c.pos.x;
    const pz = c.pos.z;
    const fx = c.fearX;
    const fz = c.fearZ;
    if (!c.prom && c.loop.length > 2 && c.mgr.nearestBlock) {
      const nb = c.mgr.nearestBlock(px, pz);
      if (nb[0] !== 'prom' && (nb[0] !== c.col || nb[1] !== c.row)) c.setBlock(nb[0], nb[1], false);
    }
    const L = c.loop;
    const n = L.length;
    // (the nearest stretch of it, and the nearest point on that)
    let leg = 0;
    let bd = Infinity;
    let qx = px;
    let qz = pz;
    for (let i = 0; i < (n === 2 ? 1 : n); i++) {
      const A = L[i];
      const B = L[(i + 1) % n];
      const dx = B[0] - A[0];
      const dz = B[1] - A[1];
      const t = clamp(((px - A[0]) * dx + (pz - A[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const x = A[0] + dx * t;
      const z = A[1] + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < bd) {
        bd = d;
        leg = i;
        qx = x;
        qz = z;
      }
    }
    // (an end of it: how much it leads away from where it happened - less if the way there passes
    // close by it)
    const ux = px - fx;
    const uz = pz - fz;
    const ul = Math.hypot(ux, uz) || 1;
    const away = (k) => {
      const dx = L[k][0] - qx;
      const dz = L[k][1] - qz;
      const l = Math.hypot(dx, dz) || 1;
      const t = clamp(((fx - qx) * dx + (fz - qz) * dz) / (l * l), 0, 1);
      return (dx * ux + dz * uz) / (l * ul) - (Math.hypot(qx + dx * t - fx, qz + dz * t - fz) < 10 ? 1 : 0);
    };
    if (n === 2) c.target = away(1) >= away(0) ? 1 : 0;
    else if (away((leg + 1) % n) >= away(leg)) {
      c.dir = 1;
      c.target = (leg + 1) % n;
    } else {
      c.dir = -1;
      c.target = leg;
    }
    c.crossing = false;
    c.crossOK = false;
    c.crossNode = undefined;
    // (not back to the shop window they were looking in when it happened)
    if (c.browse) {
      if (c.fig && c.fig.lookAt === c.browse.look) c.fig.lookAt = null;
      c.browse = null;
    }
    c.via = null;
    if (bd > 2) {
      const T = L[c.target];
      const d = Math.hypot(T[0] - px, T[1] - pz);
      const col = this.game.world && this.game.world.collision;
      if (col && d > 1 && col.raycast(px, 1.0, pz, (T[0] - px) / d, 0, (T[1] - pz) / d, d)) c.via = { x: qx, z: qz, until: this.game.time + 20 };
    }
  }

  // (ROADMAP 13.12) for whoever would take somebody for something of their own - the onlookers, the
  // first aid (game/reactions.js), a word in passing (Civilians.plain): not while they are in the
  // middle of a reaction, nor straight back to where they ran from
  busy(c) {
    const a = c.ai;
    if (!a) return false;
    if (a.state && a.state !== 'glance') return true;
    return this.game.time - (a.fled !== undefined ? a.fled : -99) < 45;
  }

  // ------------------------------------------------------------------ cover
  // somewhere near to get down behind - a parked car, a wall, a corner, a kiosk - with it between
  // them and whoever is shooting (sets a.cover; false: nowhere near)
  cover(c, a, ev) {
    const game = this.game;
    const col = game.world && game.world.collision;
    const sx = ev.sx !== undefined ? ev.sx : ev.x;
    const sz = ev.sz !== undefined ? ev.sz : ev.z;
    const px = c.pos.x;
    const pz = c.pos.z;
    const d0 = Math.hypot(px - sx, pz - sz);
    let best = null;
    let bs = 1e9;
    const tryAt = (x, z, car) => {
      const dx = x - px;
      const dz = z - pz;
      const d = Math.hypot(dx, dz);
      if (d > 9) return;
      const ds = Math.hypot(x - sx, z - sz);
      // (not nearer to him than they are)
      if (ds < 5 || ds < d0 - 2) return;
      // (there is a way there)
      if (col && d > 0.6 && col.raycast(px, 1.0, pz, dx / d, 0, dz / d, d)) return;
      // (and it hides them, crouched)
      if (!car) {
        if (!col) return;
        const hit = col.raycast(sx, 0.85, sz, (x - sx) / ds, 0, (z - sz) / ds, ds - 0.25);
        if (!hit || ds - hit.t > 2.2) return;
      }
      const sc = d - Math.min(ds, 40) * 0.1 + (car ? -0.4 : 0);
      if (sc < bs) {
        bs = sc;
        best = { x, z };
      }
    };
    // behind the cars standing still near them
    const T = game.traffic;
    if (T) {
      for (const v of T.list.concat(T.parked || [])) {
        if (!v || !v.pos || Math.abs(v.pos.x - px) > 11 || Math.abs(v.pos.z - pz) > 11 || Math.abs(v.speed || 0) > 0.6 || v.dead) continue;
        const vx = v.pos.x - sx;
        const vz = v.pos.z - sz;
        const l = Math.hypot(vx, vz) || 1;
        // (the far side of it, as far as the car is long that way)
        const along = Math.abs((vx / l) * Math.sin(v.yaw || 0) + (vz / l) * Math.cos(v.yaw || 0));
        const r = 1.45 + along * 1.35;
        tryAt(v.pos.x + (vx / l) * r, v.pos.z + (vz / l) * r, true);
      }
    }
    // behind walls, corners, kiosks round them
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      for (const r of [1.8, 3.5, 6]) tryAt(px + Math.sin(ang) * r, pz + Math.cos(ang) * r, false);
    }
    if (!best) return false;
    a.cover = best;
    return true;
  }

  // ------------------------------------------------------------------ the police (game/police.js)
  // a crime of yours that somebody saw: it reaches the police only once one of them has phoned it
  // in - and not if they are stopped first, or nobody who saw it is left to call
  report(heat, x, z) {
    const now = this.game.time;
    this.stats.reports++;
    const r = this.reports.find((q) => !q.done && Math.abs(q.x - x) + Math.abs(q.z - z) < 40);
    if (r) {
      r.heat += heat;
      r.until = Math.max(r.until, now + 35);
      return r;
    }
    const n = { x, z, heat, t: now, until: now + 35, done: false, caller: null };
    this.reports.push(n);
    return n;
  }

  // a report of yours waiting near x, z
  pending(x, z, r) {
    return this.reports.some((q) => !q.done && Math.abs(q.x - x) + Math.abs(q.z - z) < r);
  }

  // c got through: everything of yours waiting round there is reported
  phoned(c) {
    const police = this.game.police;
    for (const r of this.reports) {
      if (r.done || Math.abs(r.x - c.pos.x) + Math.abs(r.z - c.pos.z) > 130) continue;
      r.done = true;
      this.stats.phoned++;
      if (police && police.phoned) police.phoned(r.heat, r.x, r.z);
    }
  }

  // nobody calling yet: one who saw it, who is not running for their life, takes out their phone
  callers() {
    const game = this.game;
    const now = game.time;
    for (const r of this.reports) {
      if (r.done) continue;
      if (now > r.until) {
        // (nobody called: everybody who saw it was stopped, ran, or let it go)
        r.done = true;
        this.stats.unreported++;
        continue;
      }
      if (r.caller && r.caller.alive && r.caller.ai && r.caller.ai.state === 'call') continue;
      r.caller = null;
      if (now - r.t < 6) continue;
      let best = null;
      let bd = 60;
      for (const c of game.civilians.list) {
        const a = c.ai;
        if (!a || !c.alive || c.inside || c.headless || c.ctrl || c.panicT > 0 || c.downT > 0 || c.brave) continue;
        if (a.state && a.state !== 'glance' && a.state !== 'avoid' && a.state !== 'recover') continue;
        // (somebody who saw it done - not one who only saw people running from there)
        if (!a.ev || !a.ev.E || !a.ev.E.crime || Math.abs(a.ev.x - r.x) + Math.abs(a.ev.z - r.z) > 40) continue;
        const d = Math.hypot(c.pos.x - r.x, c.pos.z - r.z);
        if (d > 5 && d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        const a = this.ai(best);
        this.end(best, a);
        this.start(best, a, 'call', a.ev, game.minds ? game.minds.of(best) : { bold: 0.5 }, 0.3);
      }
    }
    if (this.reports.length > 8) this.reports = this.reports.filter((r) => !r.done);
  }

  // ------------------------------------------------------------------ the ones who see others run
  spread() {
    const game = this.game;
    const civs = game.civilians.list;
    const now = game.time;
    for (const r of civs) {
      if (!(r.panicT > 0) || !r.alive || !r.ai || r.ai.state !== 'flee' || r.ai.fleeT > 5) continue;
      // (one ripple a runner, a few people each)
      if (r.ai.rippled) continue;
      r.ai.rippled = true;
      const ev = { id: `run${r.ai.ev ? r.ai.ev.id : 0}`, kind: 'runners', x: r.fearX, z: r.fearZ, t: now, until: now + 6, n: 1, by: null, armed: false, danger: EVENTS.runners.danger, E: EVENTS.runners };
      let n = 0;
      for (const c of civs) {
        if (c === r || !c.alive || c.inside || c.panicT > 0 || c.brave || c.headless) continue;
        const dx = c.pos.x - r.pos.x;
        const dz = c.pos.z - r.pos.z;
        const d = Math.abs(dx) + Math.abs(dz);
        if (d > 14) continue;
        const a = this.ai(c);
        if (a.seen.has(ev.id) || a.stim) continue;
        a.seen.set(ev.id, 1);
        a.stim = { ev, at: now + 0.3 + Math.random() * 0.8, d: Math.hypot(c.pos.x - ev.x, c.pos.z - ev.z), seen: true, heard: false, victim: false };
        if (++n >= 4) break;
      }
    }
  }
}
