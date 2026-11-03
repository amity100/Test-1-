import * as THREE from 'three';
import { PrologueUI, lilyDrawing } from './ui.js';
import { PrologueVoices } from './voice.js';
import { Shots } from './shots.js';
import { LINES } from './lines.js';
import { WHEEL, STAND, GARAGE_A, GARAGE_B } from './set.js';
import { Pursuer } from './chase.js';
import { RampDraw, Ramp, Jump, rampH } from './ramp.js';
import { civilianLook, kidLook } from '../looks.js';
import { clamp } from '../../core/util.js';

// (v5, ROADMAP 18) THE LAST SUNSET - the game's prologue, directed.
//
// 1. The opening: the camera comes in off the sea at sunset, past the yachts, past the great wheel on
//    the pier, over the beach and the promenade, and down to Danny Cruz. Forty seconds of the city
//    are his before anything is asked; then: meet Lily at the ice cream stand.
// 2. Lily, with her ice cream and her sketchbook. They walk; she sees her uncle's face on a board.
// 3. The wheel against the sunset, full of kids; Danny really looks at it; Lily's drawing of it.
// 4. A strange mark on a stranger's bag, a glimpse; then the wheel is rubbed out - its outline, white,
//    for a blink, and then the sky. Nobody remembers it. Only the two of them. Her question, and his
//    silence.
// 5. The phone; the men waiting by the car park; a punch; into the car.
// 6. The chase through the car park: the way out blocked, up and up to the roof - a dead end.
// 7. The first drawing: a ramp, drawn by the player, growing out of the line into steel.
// 8. The jump: in the air, time all but stopped, the title over the city. The landing, hard.
// 9. Away, and quiet, over the bay. "It was there." The camera draws back over the water; where the
//    wheel stood there is only the evening.
//
// A scene is a script (a generator): it says lines, cuts between shots, gives the player the city
// back and waits for them. What the player does in between is the game's own.

// (on for every new game once all of it is checked through; till then only with ?prologue=1)
export const PROLOGUE_ON = false;
export const GAME_TITLE = '[GAME TITLE]';
export const CREDIT = 'AN AMITAI DAHAN GAME';
const DONE_KEY = 'scribble.prologue.v1';

// the places
const DANNY0 = { x: 17, z: 6, yaw: Math.PI };
const LILY_SEAT = { x: 40.2, z: 233.0, yaw: Math.PI / 2 };
const VIEW = { x: 63.5, z: 238.9 };
const GUYS = [
  { x: 71.0, z: 236.85 },
  { x: 72.3, z: 236.8 },
];
const MAN = { x: 69.6, z: 242.6 };
const GARAGE_IN = { x: 15.5, z: 320 };
const THUG_CAR = { x: 21.5, z: 327.6, yaw: Math.PI };
const THUGS = [
  { x: 18.6, z: 322.2 },
  { x: 19.6, z: 324.6 },
];
const DANNY_CAR = { x: 0.6, z: 326.8, yaw: Math.PI };
const RUNUP = { x: 6.5, z: 320, yaw: -Math.PI / 2 };
const ROOF_A = GARAGE_A.Y[GARAGE_A.Y.length - 1];
const ROOF_B = GARAGE_B.Y[GARAGE_B.Y.length - 1];
const LAND = { x: -72, y: ROOF_B, z0: 317, z1: 323 };
// (on the dry sand south of the pier, looking north-east at it - into the sunset)
const LOOKOUT = { x: 60, z: 298 };
const DARK = [0.1, 0.1, 0.12];

// where the way goes up through South Pointe Garage, deck by deck (for the marker)
const CLIMB = [
  { lv: 0, x: -30, z: 344 },
  { lv: 1, x: 8, z: 332 },
  { lv: 2, x: -30, z: 344 },
  { lv: 3, x: 8, z: 332 },
];

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class Prologue {
  constructor(game) {
    this.game = game;
    const P = game.params;
    this.param = P && P.has('prologue') ? P.get('prologue') : null;
    let done = false;
    try {
      done = localStorage.getItem(DONE_KEY) === '1';
    } catch (e) {
      done = false;
    }
    this.done = done;
    this.active = false;
    this.locked = false;
    this.holdCam = false;
    this.k = 1; // time scale
    this.kWant = 1;
    this.kRate = 4;
    this.wait = 0;
    this.co = null;
    this.skipT = 0;
    this.ff = false;
    this.cast = {};
    this.zero = { x: 0, y: 0, sprint: false };
    this.auto = null;
  }

  // the prologue plays at the start of a new game (not in the tests, unless asked for)
  wants() {
    const g = this.game;
    if (g.classic || g.lab) return false;
    if (this.param === '0') return false;
    if (this.param) return true;
    if (!PROLOGUE_ON) return false;
    if (g.params.has('test')) return false;
    return !this.done;
  }

  // ------------------------------------------------------------------ start
  begin() {
    const g = this.game;
    this.active = true;
    document.body.classList.add('prologue');
    const lang = g.params.get('subs') === 'en' ? 'en' : 'he';
    this.ui = new PrologueUI(lang);
    this.voices = new PrologueVoices(g, this.ui);
    this.shots = new Shots(g);
    this.voices.load();
    // its pieces of the city (the wheel among them)
    if (g.prolSet) g.prolSet.build();
    this.set = g.prolSet;
    // the evening held at its most beautiful, and the clock moved on by the story
    if (g.daynight) {
      this.dayMin0 = g.daynight.dayMin;
      g.daynight.dayMin = 0;
      g.daynight.hour = 18.12;
    }
    // nothing else of the city's goes off while it is told: no police after the fight, no hints
    this.quiet(true);
    // (bare hands: no pencil over his shoulder in the film)
    const W = g.weapons;
    if (W) {
      const i = W.slots.findIndex((s) => s.def && s.def.bare);
      if (i >= 0) {
        W.fistsTold = true;
        W.select(i);
      }
    }
    import('./score.js')
      .then((m) => {
        this.score = new m.Score(g);
        if (this.wantCue) this.cue(this.wantCue);
      })
      .catch(() => {});
    import('./cast.js')
      .then((m) => {
        this.lilyLookFn = m.lilyLook;
        this.castMod = m;
      })
      .catch(() => {})
      .finally(() => {
        this.castReady = true;
      });
    // (a scene asked for, for a test: ?prologue=s5)
    const m = /^s(\d)$/.exec(this.param || '');
    if (m && +m[1] > 1) {
      this.co = this.prep(+m[1]);
      this.wait = 0;
    } else this.start(1);
  }

  // (for a test from the middle: what the scenes before it would have left)
  *prep(n) {
    const g = this.game;
    yield () => this.castReady;
    this.spawnLily();
    const L = this.cast.lily;
    L.fig.sit = 0;
    L.baseY = 0;
    if (n >= 4) this.spawnPier();
    if (n >= 5) {
      if (this.set) this.set.removeWheel();
      this.putDanny(VIEW.x + 1.3, VIEW.z + 0.5, Math.PI);
      this.put(L, VIEW.x, VIEW.z, Math.PI);
      L.pl.follow = true;
      this.objective('Get to your <b>car</b>', GARAGE_IN.x, GARAGE_IN.z, 'Car park');
    }
    if (n >= 6) {
      // (in the car, the dark car after them)
      this.spawnThugs();
      const v = this.dannyCar;
      this.putDanny(v.pos.x - 1.6, v.pos.z, 0);
      g.enterVehicle(v);
      L.pl.ride = v;
      this.startPursuit();
      this.objective('<b>Lose them</b> - get out of the car park', GARAGE_A.x0 + 1, 320, 'Exit');
      this.cue('chase');
    }
    g.camRig.yaw = Math.PI;
    this.start(n);
  }

  start(n) {
    const S = [null, this.s1, this.s2, this.s3, this.s4, this.s5, this.s6, this.s7, this.s8, this.s9];
    this.sceneN = n;
    this.sceneAt = this.clock || 0;
    this.co = S[n].call(this, true);
    this.wait = 0;
  }

  quiet(on) {
    const g = this.game;
    if (g.police) g.police.hold = on;
    if (g.events) g.events.hold = on;
    g.driveHint = g.driveHint || on;
  }

  // ------------------------------------------------------------------ every frame (unscaled time)
  input(input) {
    if (!this.active) return;
    // hold Enter to skip what is being shown (never the playing)
    const hold = this.holdCam && input.keys.has('Enter');
    this.skipT = hold ? this.skipT + (this.dtR || 0.016) : 0;
    if (this.ui) this.ui.skip(this.holdCam ? Math.min(1, this.skipT / 0.9) : 0);
    if (this.skipT > 0.9 && !this.ff) {
      this.ff = true;
      this.voices.stop();
      this.ui.clearSub();
    }
    if (this.locked) {
      input.fire = false;
      input.firePressed = false;
      input.aim = false;
      for (const k of ['KeyE', 'KeyF', 'KeyQ', 'KeyT', 'KeyG', 'KeyR', 'KeyV', 'Tab', 'KeyM', 'KeyP', 'Space', 'KeyC']) input.pressed.delete(k);
    }
    // (the drawing is not his yet: its first time is the ramp - and out of the car only when the
    // story says)
    for (const k of ['KeyQ', 'KeyT', 'KeyG']) input.pressed.delete(k);
    if (this.game.player.inVehicle) input.pressed.delete('KeyE');
  }

  lock(on) {
    const inp = this.game.input;
    this.locked = on;
    if (on && !this.saveRead) {
      this.saveRead = inp.readMove;
      inp.readMove = () => this.auto || this.zero;
    } else if (!on && this.saveRead) {
      inp.readMove = this.saveRead;
      this.saveRead = null;
      this.auto = null;
    }
  }

  // (how long the scene has been going: the tests' clock)
  get sceneT() {
    return (this.clock || 0) - (this.sceneAt || 0);
  }

  timeK() {
    return this.active ? this.k : 1;
  }

  slow(k, rate = 4) {
    this.kWant = k;
    this.kRate = rate;
  }

  cam(dt) {
    if (!this.active || !this.holdCam) {
      if (this.hidden && this.hidden.size) this.unhide();
      return false;
    }
    const on = this.shots.update(dt);
    if (on) this.clearLens();
    return on;
  }

  // nobody walking right up against the lens in a shot: a passer-by too close to the camera is
  // left out of the picture until they have gone by (the prologue's own people never)
  clearLens() {
    const g = this.game;
    const cp = g.camera.position;
    const H = this.hidden || (this.hidden = new Set());
    const mine = new Set(Object.values(this.cast));
    for (const c of g.civilians.list) {
      if (!c.alive || mine.has(c) || (this.heroes && this.heroes.includes(c))) continue;
      const d = Math.hypot(c.pos.x - cp.x, c.pos.z - cp.z);
      if (d < 2.2 && !H.has(c)) {
        c.fig.setVisible(false);
        H.add(c);
      } else if (d > 3 && H.has(c)) {
        c.fig.setVisible(true);
        H.delete(c);
      }
    }
  }

  unhide() {
    for (const c of this.hidden) if (c.alive && !c.inside) c.fig.setVisible(true);
    this.hidden.clear();
  }

  update(dt) {
    if (!this.active) return;
    this.dtR = dt;
    this.clock = (this.clock || 0) + dt;
    // the time's own pace eased towards what is wanted
    this.k += (this.kWant - this.k) * (1 - Math.exp(-this.kRate * dt));
    if (Math.abs(this.k - this.kWant) < 0.002) this.k = this.kWant;
    this.ui.update(dt);
    if (this.draw && this.draw.on) this.draw.frame(dt);
    if (this.ramp && !this.ramp.grown) this.ramp.update(dt);
    for (const p of this.pursuers || []) p.update(dt * this.k);
    this.watchdog(dt);
    this.tickCast(dt);
    this.tickHeroes();
    this.tickMarker();
    if (this.everyFrame) this.everyFrame(dt);
    // the script: on to its next step once the wait is over
    let guard = 0;
    while (this.co && guard++ < 40) {
      if (typeof this.wait === 'number') {
        this.wait -= this.ff ? 1e9 : dt;
        if (this.wait > 0) break;
      } else if (typeof this.wait === 'function') {
        if (!this.wait()) break;
      }
      const co = this.co;
      const r = co.next();
      // (a scene that started the next one: on with that one, from its start)
      if (this.co !== co) {
        this.wait = 0;
        continue;
      }
      if (r.done) {
        this.co = null;
        break;
      }
      this.wait = r.value === undefined ? 0 : r.value;
      if (typeof this.wait === 'number' && this.wait > 0 && !this.ff) break;
    }
  }

  // ------------------------------------------------------------------ the film's tools
  film(on) {
    this.ui.film(on);
    this.holdCam = on;
    this.lock(on);
    if (!on) {
      this.ff = false;
      this.shots.release();
      const g = this.game;
      // (the game's camera back behind Danny, as the scene left him)
      const p = g.player;
      g.camRig.yaw = p.inVehicle ? p.inVehicle.yaw : p.yaw;
      g.camRig.pitch = -0.1;
      g.hud.show();
    } else this.game.hud.hide();
  }

  shot(s) {
    this.shots.cut(s);
    return s.dur || 3;
  }

  // a line said: its voice, its subtitle, the speaker's mouth; the script waits for it to end
  *say(id, fig = null, after = 0.28) {
    if (this.ff) return;
    const d = this.voices.say(id, fig);
    // (the hands and the face go with the words - one of the city's people talks with them; the
    // one listening turns to whoever speaks)
    const g = this.game;
    const L = LINES[id];
    const c = fig ? Object.values(this.cast).find((q) => q.fig === fig) : null;
    if (c && L && g.civilians.spoke) g.civilians.spoke(c, L.en, /!/.test(L.en) ? 'alarm' : 'talk');
    yield d + after;
  }

  objective(html, x = null, z = null, name = null) {
    this.ui.objective(html);
    const g = this.game;
    if (x !== null && g.gps) g.gps.set(x, z, name || 'Lily');
    else if (g.gps && x === null && html === null) g.gps.clear();
  }

  // the music (game/prologue/score.js): a cue by name, 'stop' to end it; heat for the chase
  cue(name, o = {}) {
    this.wantCue = name;
    const S = this.score;
    if (!S) return;
    try {
      if (name === 'stop') S.stop({ fade: o.fade !== undefined ? o.fade : 2 });
      else S.play(name, { fade: o.fade !== undefined ? o.fade : 1 });
      if (o.heat !== undefined && S.heat) S.heat(o.heat);
    } catch (e) {
      // (the music is a nicety)
    }
  }

  hour(h, rate = 0.02) {
    this.hourWant = h;
    this.hourRate = rate;
  }

  dist(x, z) {
    const g = this.game;
    const a = g.anchorPos();
    return Math.hypot(a.x - x, a.z - z);
  }

  // ------------------------------------------------------------------ people of the prologue
  // somebody in it: one of the city's people, held by the director (where to stand or walk, which
  // way to face, what to look at)
  person(key, x, z, look, o = {}) {
    const g = this.game;
    const c = g.civilians.spawnScripted(x, z, look, this, o.fig || null);
    c.brave = true;
    c.pl = { x, z, speed: 0, face: o.face !== undefined ? o.face : null };
    c.ctrl = (civ) => this.steer(civ);
    if (o.face !== undefined) c.yaw = o.face;
    this.cast[key] = c;
    return c;
  }

  steer(c) {
    const s = c.pl;
    if (!s) return null;
    if (s.ride) return null;
    if (s.follow) {
      // beside Danny, a step behind him on his right (on her own, at his pace)
      const p = this.game.player;
      const f = p.fig.forward;
      const tx = p.pos.x - f.x * 0.9 + f.z * 0.95;
      const tz = p.pos.z - f.z * 0.9 - f.x * 0.95;
      const d = Math.hypot(tx - c.pos.x, tz - c.pos.z);
      if (d < 0.5) {
        c.faceYaw = p.yaw;
        return null;
      }
      c.faceYaw = null;
      const pv = Math.hypot(p.vel.x, p.vel.z);
      return { x: tx, z: tz, speed: clamp(Math.max(pv * (d > 2.5 ? 1.25 : 1), d > 3 ? 3.2 : 1.3), 0.6, p.vel && pv > 4 ? 6.5 : 4.2) };
    }
    const d = Math.hypot(s.x - c.pos.x, s.z - c.pos.z);
    if (s.speed > 0 && d > 0.35) {
      c.faceYaw = null;
      return { x: s.x, z: s.z, speed: s.speed };
    }
    if (s.face !== null && s.face !== undefined) c.faceYaw = s.face;
    return null;
  }

  go(c, x, z, speed = 1.3) {
    if (!c) return;
    c.pl.x = x;
    c.pl.z = z;
    c.pl.speed = speed;
    c.pl.follow = false;
  }

  put(c, x, z, face = null) {
    if (!c) return;
    c.pos.set(x, c.pos.y, z);
    c.pl.x = x;
    c.pl.z = z;
    c.pl.speed = 0;
    c.pl.follow = false;
    if (face !== null) {
      c.pl.face = face;
      c.yaw = face;
      c.faceYaw = face;
    }
  }

  faceTo(c, x, z) {
    if (!c) return;
    const f = Math.atan2(x - c.pos.x, z - c.pos.z);
    c.pl.face = f;
    c.faceYaw = f;
  }

  // an over-the-shoulder camera: behind a (on the far side from b), a little to the side, looking
  // past a's shoulder at b
  ots(a, b, o = {}) {
    const back = o.back !== undefined ? o.back : 0.9;
    const side = o.side !== undefined ? o.side : 0.55;
    const h = o.h !== undefined ? o.h : 1.55;
    return () => {
      const A = a.pos || a;
      const B = b.pos || b;
      const dx = B.x - A.x;
      const dz = B.z - A.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d;
      const uz = dz / d;
      return v3(A.x - ux * back + uz * side, (A.y || 0) + h, A.z - uz * back - ux * side);
    };
  }

  head(c, h) {
    return () => v3(c.pos.x, c.pos.y + h, c.pos.z);
  }

  // before somebody, at their face: dist ahead along where they face, side to their right (+) or
  // left (-), at height h (a kid's face lower)
  faceCam(c, dist = 1.3, side = 0.3, h = null) {
    return () => {
      const yaw = c.yaw || 0;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const hh = h !== null ? h : this.headH(c);
      return v3(c.pos.x + fx * dist - fz * side, c.pos.y + hh, c.pos.z + fz * dist + fx * side);
    };
  }

  // a camera by a car, in its own frame: side +1 Lily's (the passenger's, the right), -1 Danny's; out
  // from it, along it (forwards +), up from its floor - the windows are down: through them
  carSide(v, side, out, h, along = 0) {
    return () => {
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      // (its right: -fz, fx)
      return v3(v.pos.x + fx * along - fz * side * out, (v.pos.y || 0) + h, v.pos.z + fz * along + fx * side * out);
    };
  }

  cabin(v, h = 1.05) {
    return () => v3(v.pos.x, (v.pos.y || 0) + h, v.pos.z);
  }

  headH(c) {
    const j = c.fig && c.fig.j && c.fig.j.head;
    return j ? j.y - c.pos.y : 1.6;
  }

  faceOf(c) {
    return () => {
      const j = c.fig && c.fig.j && c.fig.j.head;
      return j ? v3(j.x, j.y, j.z) : v3(c.pos.x, c.pos.y + 1.6, c.pos.z);
    };
  }

  feel(fig, mood, s = 3) {
    if (fig) fig.feel = { mood, until: this.game.time + s };
  }

  // Danny: placed (between two shots), turned, walked a few steps
  putDanny(x, z, yaw) {
    const p = this.game.player;
    p.pos.set(x, p.pos.y, z);
    p.vel.set(0, 0, 0);
    p.yaw = yaw;
    p.fig.yaw = yaw;
  }

  walkDanny(x, z, speed = 0.45) {
    const g = this.game;
    const p = g.player;
    const dx = x - p.pos.x;
    const dz = z - p.pos.z;
    if (Math.hypot(dx, dz) < 0.4) {
      this.auto = null;
      return true;
    }
    g.camRig.yaw = Math.atan2(dx, dz);
    this.auto = { x: 0, y: speed, sprint: false };
    return false;
  }

  // every frame for the people: Lily in the car with him, the riders, the people on the pier
  tickCast(dt) {
    const g = this.game;
    const L = this.cast.lily;
    if (L && L.pl && L.pl.ride && L.alive) {
      const v = L.pl.ride;
      const S = v.seatOf();
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      L.riding = true;
      L.noCollide = true;
      L.pos.set(v.pos.x + fx * S.u - fz * S.s, (v.pos.y || 0) + S.y, v.pos.z + fz * S.u + fx * S.s);
      L.vel.set(0, 0, 0);
      L.yaw = v.yaw;
      L.faceYaw = v.yaw;
      L.baseY = S.y;
      L.fig.sit = 1;
      // (holding on to her seat)
      L.fig.reachR = null;
    }
    // the clock moved on with the story
    if (this.hourWant && g.daynight) {
      const d = this.hourWant - g.daynight.hour;
      if (Math.abs(d) > 0.0005) g.daynight.hour += Math.sign(d) * Math.min(Math.abs(d), this.hourRate * dt);
    }
    void dt;
  }

  // the marker over where to go, kept on the way up through the car park
  tickMarker() {
    if (!this.climb) return;
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v) return;
    const Y = GARAGE_A.Y;
    let lv = 0;
    for (let k = 0; k < Y.length; k++) if (v.pos.y > Y[k] - 0.6) lv = k;
    if (lv !== this.climbLv) {
      this.climbLv = lv;
      const c = CLIMB[Math.min(lv, CLIMB.length - 1)];
      if (g.gps) g.gps.set(c.x, c.z, 'Roof');
    }
  }

  // the drive can go wrong (the car wrecked, off the roof the wrong way): back to the last good
  // place in it, the car whole again, after a moment of black
  watchdog(dt) {
    const W = this.check;
    if (!W || this.holdCam || this.resetting) return;
    const g = this.game;
    const v = g.player.inVehicle;
    const bad = !v || v.dead || (W.minY !== undefined && v.pos.y < W.minY && !(this.jump && !this.jump.done));
    this.badT = bad ? (this.badT || 0) + dt : 0;
    if (this.badT < 1.6) return;
    this.badT = 0;
    this.resetting = true;
    this.ui.fade(true);
    setTimeout(() => {
      const P = g.player;
      let car = P.inVehicle;
      if (!car || car.dead) {
        if (car) g.exitVehicle(true);
        car = g.vehicles.spawnStock({ kind: 'muscle', color: [0.58, 0.1, 0.12] }, { x: W.x, z: W.z }, W.yaw);
        car.kept = true;
        P.mode = 'foot';
        g.enterVehicle(car);
        this.dannyCar = car;
        if (this.cast.lily) this.cast.lily.pl.ride = car;
        for (const q of this.pursuers || []) q.prey = car;
      }
      car.pos.set(W.x, W.y, W.z);
      car.yaw = W.yaw;
      car.vx = car.vz = car.vy = 0;
      car.speed = 0;
      car.air = false;
      g.camRig.yaw = W.yaw;
      // (the ones after him a little further back than they were)
      for (const q of this.pursuers || []) {
        if (!q.car || !W.back) continue;
        q.car.pos.set(W.back.x, W.y, W.back.z);
        q.car.yaw = W.yaw;
        q.car.vx = q.car.vz = 0;
        q.car.speed = 0;
        q.trail.length = 0;
        q.i = 0;
        q.seed([[W.back.x, W.y, W.back.z], [W.x, W.y, W.z]]);
      }
      this.ui.fade(false);
      this.resetting = false;
    }, 700);
  }

  // ------------------------------------------------------------------ 1. THE CITY
  *s1(first) {
    const g = this.game;
    const P = g.player;
    this.putDanny(DANNY0.x, DANNY0.z, DANNY0.yaw);
    P.pos.y = 0.3;
    this.film(true);
    this.hour(18.2, 0.004);
    this.cue('opening');
    // Lily, waiting at the stand (her look as soon as her sheet is in: game/prologue/cast.js)
    yield () => this.castReady;
    this.spawnLily();
    // in off the sea: past the yachts and the wheel, over the beach and the promenade, down to Danny
    this.shot({
      path: [v3(338, 7, 270), v3(262, 8.5, 268), v3(196, 11, 270), v3(150, 17, 274), v3(96, 26, 236), v3(52, 26, 150), v3(30, 15, 64), v3(19.5, 4.2, 14.5), v3(17.2, 2.6, 9.6)],
      lookPath: [v3(128, 26, 243), v3(128, 26, 243), v3(126, 28, 243), v3(110, 22, 226), v3(40, 10, 160), v3(20, 4, 60), v3(16, 2.5, 10), v3(17, 1.9, 3), v3(17, 1.9, -12)],
      fov: 52,
      fovTo: 58,
      dur: first ? 27 : 1,
      ease: 'soft',
      hand: 0.25,
    });
    yield 26.6;
    // the city, his: no words, no task, for forty seconds
    this.film(false);
    let t = 0;
    yield () => {
      t += this.dtR;
      return t > 40 || this.dist(STAND.x, STAND.z) < 22;
    };
    this.objective('Meet <b>Lily</b> at the ice cream stand', STAND.x, STAND.z, 'Lily');
    yield () => this.dist(LILY_SEAT.x, LILY_SEAT.z) < 8.5 && !g.player.inVehicle;
    this.start(2);
  }

  spawnLily() {
    if (this.cast.lily) return;
    const look = this.lilyLookFn ? this.lilyLookFn() : kidLook(true);
    const L = this.person('lily', LILY_SEAT.x, LILY_SEAT.z, look, { face: LILY_SEAT.yaw });
    L.fig.sit = 1;
    L.baseY = 0.32;
    if (this.castMod && this.castMod.giveIceCream) this.castMod.giveIceCream(L.fig, true);
    if (this.castMod && this.castMod.giveSketchbook) this.castMod.giveSketchbook(L.fig, true);
  }

  // ------------------------------------------------------------------ 2. LILY
  *s2() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.cue('stop', { fade: 3 });
    this.film(true);
    // she looks up from her drawing and sees him coming
    this.putDanny(LILY_SEAT.x - 2.6, LILY_SEAT.z - 1.4, Math.atan2(2.6, 1.4));
    this.faceTo(L, P.pos.x, P.pos.z);
    this.shot({ from: this.ots(P, L, { back: 1.0, side: 0.6, h: 1.45 }), look: this.head(L, 0.85), fov: 36, dur: 4, hand: 0.5 });
    yield 0.6;
    L.fig.sit = 0;
    L.baseY = 0;
    this.feel(L.fig, 'joy', 4);
    yield* this.say('L01', L.fig);
    // over her shoulder: him
    this.shot({ from: () => v3(L.pos.x + 0.9, 1.25, L.pos.z + 0.75), look: () => v3(P.pos.x, 1.55, P.pos.z), fov: 38, dur: 4, hand: 0.5 });
    yield* this.say('D01', P.fig, 0.35);
    this.shot({ from: [LILY_SEAT.x - 1.3, 1.3, LILY_SEAT.z + 3.6], to: [LILY_SEAT.x - 1.5, 1.35, LILY_SEAT.z + 3.3], look: () => v3((L.pos.x + P.pos.x) / 2, 1.15, (L.pos.z + P.pos.z) / 2), fov: 44, dur: 4, hand: 0.5 });
    this.feel(L.fig, 'joy', 3);
    yield* this.say('L02', L.fig, 0.25);
    // (a little smile from him)
    this.feel(P.fig, 'joy', 1.6);
    yield 1.1;
    // the walk: her at his side, the marker on the pier
    L.pl.follow = true;
    this.film(false);
    this.objective('Walk with <b>Lily</b> to the pier', VIEW.x, VIEW.z, 'Pier');
    yield 3.2;
    // the board with her uncle's face on it
    const B = this.set && this.set.boards ? this.set.boards.find((b) => Math.abs(b.z - 255.5) < 1) : null;
    if (B) {
      L.fig.lookAt = v3(B.x, 6.5, B.z);
    }
    yield* this.say('L03', L.fig, 0.3);
    yield* this.say('D02', P.fig, 0.3);
    yield* this.say('L04', L.fig, 0.3);
    yield* this.say('D03', P.fig, 0.1);
    this.feel(L.fig, 'joy', 2.6);
    yield* this.say('L05', L.fig, 0.2);
    L.fig.lookAt = null;
    yield () => this.dist(VIEW.x, VIEW.z) < 4.5;
    this.start(3);
  }

  // ------------------------------------------------------------------ 3. THE WHEEL
  *s3() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    this.hour(18.3, 0.004);
    // the two of them at the railing, the wheel ahead
    this.putDanny(VIEW.x + 1.5, VIEW.z + 0.9, Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z));
    this.put(L, VIEW.x, VIEW.z, Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z));
    this.spawnPier();
    this.voices.bed(true, 0.55);
    // against the sunset: the wheel from the beach, full of people
    this.shot({ from: [76, 2.4, 297], to: [83, 4.2, 289], look: [128, 28, 243], lookTo: [128, 30, 243], fov: 54, fovTo: 49, dur: 6.5, hand: 0.35 });
    yield 1.6;
    yield* this.say('K01', null, 0.6);
    // up close: a gondola going by low, kids at its sill waving
    const gi = this.lowGondola();
    this.heroRiders(gi);
    this.shot({ from: () => this.gondolaCam(gi, -6.5, -1.2, 2.2), look: () => this.gondolaAt(gi, 0, -2.6, 0), fov: 38, dur: 4.5, hand: 0.6 });
    yield 1.2;
    yield* this.say('K02', null, 0.5);
    // the parents down on the pier, waving up at them, filming
    this.shot({ from: [94, 1.7, 251.5], to: [96, 1.9, 250.5], look: [118, 16, 242], fov: 50, dur: 3.6, hand: 0.6 });
    yield 3.4;
    // Lily, at the railing: the two of them from behind, the wheel beyond them
    this.voices.bed(true, 0.35);
    const toW = Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z);
    const ux = Math.sin(toW);
    const uz = Math.cos(toW);
    this.shot({ from: [VIEW.x - ux * 4.4 + uz * 1.7, 1.75, VIEW.z - uz * 4.4 - ux * 1.7], to: [VIEW.x - ux * 3.9 + uz * 1.5, 1.7, VIEW.z - uz * 3.9 - ux * 1.5], look: [VIEW.x + ux * 22, 10, VIEW.z + uz * 22], fov: 44, dur: 3.4, hand: 0.5 });
    L.fig.reachR = v3(WHEEL.x, 30, WHEEL.z);
    this.feel(L.fig, 'joy', 3);
    yield* this.say('L06', L.fig, 0.4);
    L.fig.reachR = null;
    // Danny looks: his face (the camera before him, the wheel behind it); then what he sees, slowly,
    // all of it
    P.fig.lookAt = v3(WHEEL.x, 32, WHEEL.z);
    this.shot({ from: () => v3(P.pos.x + ux * 1.6 - uz * 0.55, P.pos.y + 1.42, P.pos.z + uz * 1.6 + ux * 0.55), to: () => v3(P.pos.x + ux * 1.35 - uz * 0.5, P.pos.y + 1.45, P.pos.z + uz * 1.35 + ux * 0.5), look: this.head(P, 1.68), fov: 32, dur: 2.6, hand: 0.4 });
    yield 2.4;
    this.shot({ from: () => v3(P.pos.x, 1.72, P.pos.z), look: [WHEEL.x, 22, WHEEL.z], lookTo: [WHEEL.x + 2, 40, WHEEL.z - 2], fov: 40, fovTo: 27, dur: 5.5, ease: 'inout', hand: 0.3 });
    yield 5.2;
    // and the player looks too: the camera theirs for a moment (he stays where he is)
    this.holdCam = false;
    this.ui.film(true);
    g.camRig.yaw = Math.atan2(WHEEL.x - P.pos.x, WHEEL.z - P.pos.z);
    g.camRig.pitch = 0.22;
    yield 7;
    this.holdCam = true;
    // the sketchbook: her drawing of it
    this.shot({ from: () => v3(L.pos.x - 0.9, 1.35, L.pos.z - 1.2), look: () => v3(L.pos.x, 0.95, L.pos.z), fov: 40, dur: 2.2, hand: 0.4 });
    yield 1.4;
    this.sketch = this.sketch || lilyDrawing();
    this.ui.sketch(this.sketch);
    yield 1.6;
    yield* this.say('D04', P.fig, 0.3);
    this.ui.sketch(null);
    this.shot({ from: () => v3(VIEW.x + 0.4, 1.3, VIEW.z - 2.8), look: () => v3((L.pos.x + P.pos.x) / 2, 1.2, (L.pos.z + P.pos.z) / 2), fov: 44, dur: 6, hand: 0.4 });
    this.feel(L.fig, 'surprised', 1.6);
    yield* this.say('L07', L.fig, 0.25);
    this.feel(P.fig, 'joy', 2);
    yield* this.say('D05', P.fig, 0.3);
    this.feel(L.fig, 'joy', 3);
    yield 1.2;
    this.start(4);
  }

  // the gondola the camera goes up close to: real people in it (faces, smiles, hands), not the
  // far-off figures the others have
  heroRiders(gi) {
    if (this.heroes) return;
    const S = this.set;
    S.hideRiders(gi, true);
    const face = Math.atan2(-Math.cos(WHEEL.yaw), Math.sin(WHEEL.yaw));
    const mk = (key, look, lx, lz, wave) => {
      const c = this.person(key, VIEW.x, VIEW.z, look, { face });
      c.riding = true;
      c.noCollide = true;
      c.pl.ride = 'wheel';
      c.hero = { gi, lx, lz, wave, ph: Math.random() * 6 };
      this.feel(c.fig, 'joy', 60);
      return c;
    };
    this.heroes = [mk('hk1', kidLook(false), -1.0, -0.55, 1), mk('hk2', kidLook(true), -1.0, 0.55, 1), mk('hp', civilianLook(), 0.25, 0.1, 0)];
  }

  tickHeroes() {
    if (!this.heroes) return;
    const S = this.set;
    if (!S || S.wheelGone || (S.erasing && S.erasing.t > 0)) {
      for (const c of this.heroes) this.game.civilians.remove(c);
      this.heroes = null;
      return;
    }
    const t = this.clock || 0;
    const face = Math.atan2(-Math.cos(WHEEL.yaw), Math.sin(WHEEL.yaw));
    const fx = Math.sin(face);
    const fz = Math.cos(face);
    for (const c of this.heroes) {
      const h = c.hero;
      const p = this.gondolaAt(h.gi, h.lx, -3.4, h.lz);
      c.pos.copy(p);
      c.vel.set(0, 0, 0);
      c.yaw = face;
      c.faceYaw = face;
      if (h.wave && c.fig.j && c.fig.j.head) {
        // (a hand up, waving to somebody down on the pier)
        const hd = c.fig.j.head;
        const w = Math.sin(t * 7 + h.ph) * 0.22;
        c.fig.reachR = c.fig.reachR || new THREE.Vector3();
        c.fig.reachR.set(hd.x + fx * 0.25 - fz * (0.22 + w), hd.y + 0.32, hd.z + fz * 0.25 + fx * (0.22 + w));
      }
    }
  }

  lowGondola() {
    const S = this.set;
    let best = 0;
    let by = Infinity;
    for (let i = 0; i < WHEEL.n; i++) {
      const p = S.gPos[i];
      // going up on the city side, a third of the way up
      const want = -WHEEL.R * 0.45;
      const d = Math.abs(p.y - want) + (p.z > 0 ? 0 : 30);
      if (d < by) {
        by = d;
        best = i;
      }
    }
    return best;
  }

  // a point by gondola i (its frame: x along the axle, -x the city side)
  gondolaAt(i, lx, ly, lz) {
    const S = this.set;
    const o = S.gPos[i];
    return S.toWorld(v3(o.x + lx, o.y + ly, o.z + lz), new THREE.Vector3());
  }

  gondolaCam(i, lx, ly, lz) {
    return this.gondolaAt(i, lx, ly, lz);
  }

  // the people on the pier for the next scenes: the two guys at the railing, the man by them, the
  // man with the bag
  spawnPier() {
    if (this.cast.g1) return;
    const g1 = this.person('g1', GUYS[0].x, GUYS[0].z, civilianLook({ fem: false, kind: 'casual' }), { face: 0.2 });
    const g2 = this.person('g2', GUYS[1].x, GUYS[1].z, civilianLook({ fem: false, kind: 'casual' }), { face: 0.4 });
    const m = this.person('man', MAN.x, MAN.z, civilianLook({ fem: false }), { face: 1.6 });
    for (const c of [g1, g2, m]) {
      c.pl.face = Math.atan2(WHEEL.x - c.pos.x, WHEEL.z - c.pos.z);
      c.fig.lookAt = v3(WHEEL.x, 26, WHEEL.z);
    }
    // (one of them films it on his phone)
    g2.fig.reachR = null;
  }

  // ------------------------------------------------------------------ 4. GONE
  *s4() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const S = this.set;
    // a glance aside: a man going by, a mark on his bag - half a second, from Danny's own eyes
    const bag = this.bagMan();
    this.shot({ from: this.head(P, 1.66), look: () => v3(bag.pos.x, bag.pos.y + 0.95, bag.pos.z), fov: 30, dur: 1.2, hand: 1 });
    P.fig.lookAt = bag.fig.j ? bag.fig.j.hip : null;
    yield 0.55;
    // (it is gone into the people as fast)
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    // Lily, still looking at it, happy; the wheel turning against the sky
    this.voices.bed(true, 0.5);
    this.shot({ from: () => v3(VIEW.x - 3.6, 2.1, VIEW.z + 2.2), look: [WHEEL.x, 27, WHEEL.z], fov: 50, dur: 6, hand: 0.35 });
    this.feel(L.fig, 'joy', 4);
    yield 3.6;
    // and then, without anything before it: rubbed out
    S.erase();
    // (and at once nobody down there is waving up at anything)
    S.forget();
    this.voices.bed(false);
    this.cue('stop', { fade: 0.02 });
    yield 2.2;
    // he does not move
    this.feel(P.fig, 'surprised', 6);
    this.shot({ from: this.faceCam(P, 1.25, 0.3), look: this.faceOf(P), fov: 30, dur: 2.2, hand: 0.3 });
    yield 1.7;
    this.shot({ from: this.faceCam(L, 1.0, -0.25), look: this.faceOf(L), fov: 32, dur: 2.4, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    L.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    yield* this.say('L08', L.fig, 0.9);
    // what he is looking at: the evening, where it was
    this.shot({ from: () => v3(P.pos.x, 1.72, P.pos.z), look: [WHEEL.x, 24, WHEEL.z], lookTo: [WHEEL.x, 26, WHEEL.z], fov: 44, dur: 2.6, hand: 0.25 });
    yield 2.5;
    // nobody else: the parents walk off, the phone goes back in a pocket, the guys chat
    this.shot({ from: [86, 3.2, 247], to: [86.5, 3.4, 246], look: [104, 1.5, 243], fov: 50, dur: 3.2, hand: 0.5 });
    yield 3.0;
    // Danny, at the two guys by the railing
    const g1 = this.cast.g1;
    const g2 = this.cast.g2;
    const M = this.cast.man;
    this.putDanny(GUYS[0].x - 1.5, GUYS[0].z + 0.9, Math.atan2(1.5, -0.9));
    this.faceTo(g1, P.pos.x, P.pos.z);
    g1.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    g2.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    this.feel(P.fig, 'angry', 3);
    this.shot({ from: this.ots(g1, P), look: this.faceOf(P), fov: 40, dur: 3, hand: 0.7 });
    yield* this.say('D06', P.fig, 0.15);
    this.shot({ from: this.ots(P, g1, { h: 1.62 }), look: this.faceOf(g1), fov: 38, dur: 2, hand: 0.6 });
    yield* this.say('G01', g1.fig, 0.15);
    this.shot({ from: this.ots(g1, P), look: this.faceOf(P), fov: 40, dur: 3.5, hand: 0.7 });
    P.fig.reachR = v3(WHEEL.x, 20, WHEEL.z);
    yield* this.say('D07', P.fig, 0.15);
    P.fig.reachR = null;
    this.shot({ from: this.ots(P, g1, { h: 1.62 }), look: this.faceOf(g1), fov: 38, dur: 2.4, hand: 0.6 });
    yield* this.say('G02', g1.fig, 0.2);
    this.shot({ from: this.ots(g1, P), look: this.faceOf(P), fov: 36, dur: 4.5, hand: 0.8 });
    yield* this.say('D08', P.fig, 0.15);
    this.shot({ from: this.ots(P, g1, { h: 1.62, back: 1.3, side: 0.7 }), look: () => v3((g1.pos.x + g2.pos.x) / 2, 1.6, (g1.pos.z + g2.pos.z) / 2), fov: 42, dur: 5, hand: 0.6 });
    yield* this.say('G03', g1.fig, 0.3);
    this.shot({ from: this.ots(g1, P, { back: 0.7, side: 0.4 }), look: this.faceOf(P), fov: 30, dur: 2.2, hand: 0.5 });
    yield* this.say('D09', P.fig, 0.2);
    this.feel(g1.fig, 'surprised', 2);
    this.shot({ from: this.ots(P, g1, { h: 1.62 }), look: this.faceOf(g1), fov: 38, dur: 2.4, hand: 0.6 });
    yield* this.say('G04', g1.fig, 0.4);
    // the other man
    this.putDanny(MAN.x - 1.1, MAN.z - 1.2, Math.atan2(1.1, 1.2));
    this.faceTo(M, P.pos.x, P.pos.z);
    M.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    this.shot({ from: this.ots(M, P), look: this.faceOf(P), fov: 42, dur: 4, hand: 0.7 });
    yield* this.say('D10', P.fig, 0.2);
    this.faceTo(M, WHEEL.x, WHEEL.z);
    M.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    yield 1.0;
    this.faceTo(M, P.pos.x, P.pos.z);
    M.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    this.shot({ from: this.ots(P, M, { h: 1.62 }), look: this.faceOf(M), fov: 36, dur: 3, hand: 0.5 });
    yield* this.say('M01', M.fig, 0.5);
    // all round him, the evening as it was: nobody saw anything
    this.feel(P.fig, 'scared', 4);
    this.shot({ path: [v3(P.pos.x + 3, 2.2, P.pos.z), v3(P.pos.x, 2.4, P.pos.z + 3.2), v3(P.pos.x - 3, 2.6, P.pos.z)], look: () => v3(P.pos.x, 1.5, P.pos.z), fov: 46, dur: 4, ease: 'inout', hand: 0.5 });
    yield 3.8;
    for (const c of [g1, g2, M]) c.fig.lookAt = null;
    // back to her
    this.putDanny(VIEW.x + 1.3, VIEW.z + 0.5, Math.atan2(-1.3, -0.5));
    this.faceTo(L, P.pos.x, P.pos.z);
    L.yaw = L.pl.face;
    L.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    this.shot({ from: this.ots(P, L, { h: 1.45, back: 0.8, side: 0.45 }), look: this.faceOf(L), fov: 34, dur: 3, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    yield* this.say('L09', L.fig, 0.4);
    this.shot({ from: this.ots(L, P, { h: 1.05, back: 0.6, side: 0.3 }), look: this.faceOf(P), fov: 32, dur: 2.2, hand: 0.4 });
    this.feel(P.fig, 'sad', 4);
    yield* this.say('D11', P.fig, 0.5);
    // her drawing: it is still in it
    this.ui.sketch(this.sketch || (this.sketch = lilyDrawing()));
    yield 2.6;
    this.ui.sketch(null);
    this.shot({ from: this.ots(L, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { h: 1.1, back: 0.9, side: 0.4 }), look: [WHEEL.x, 24, WHEEL.z], fov: 46, dur: 1.8, hand: 0.4 });
    L.fig.lookAt = v3(WHEEL.x, 24, WHEEL.z);
    yield 1.8;
    this.ui.sketch(this.sketch);
    yield 1.0;
    this.ui.sketch(null);
    L.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    this.shot({ from: this.faceCam(L, 0.95, -0.22), look: this.faceOf(L), fov: 28, dur: 4.5, hand: 0.3 });
    this.feel(L.fig, 'sad', 8);
    yield* this.say('L10', L.fig, 0.2);
    // the silence: he looks at her, his mouth a little open as if to answer - nothing comes
    this.shot({ from: this.faceCam(P, 1.35, 0.3), to: this.faceCam(P, 1.1, 0.25), look: this.faceOf(P), fov: 26, dur: 3, hand: 0.25 });
    this.feel(P.fig, 'surprised', 2.6);
    yield 2.8;
    // the empty place; the kids' voices come back to him
    this.shot({ from: () => v3(P.pos.x, 1.72, P.pos.z), look: [WHEEL.x, 22, WHEEL.z], lookTo: [WHEEL.x, 24, WHEEL.z], fov: 40, dur: 3.2, hand: 0.2 });
    this.voices.memory(0.42);
    yield 3.1;
    // he swallows; back at her
    this.shot({ from: this.faceCam(P, 1.2, 0.3), look: this.faceOf(P), fov: 28, dur: 2.4, hand: 0.25 });
    this.feel(P.fig, 'sad', 8);
    yield 2.3;
    this.shot({ from: () => { const a = this.ots(L, P, { back: 2.6, side: 1.6, h: 1.35 })(); return a; }, look: () => v3((L.pos.x + P.pos.x) / 2, 1.2, (L.pos.z + P.pos.z) / 2), fov: 40, dur: 9, hand: 0.35 });
    yield* this.say('D12', P.fig, 0.9);
    this.ui.sketch(this.sketch);
    yield 1.2;
    yield* this.say('D13', P.fig, 0.4);
    this.ui.sketch(null);
    yield* this.say('L11', L.fig, 0.5);
    yield* this.say('D14', P.fig, 0.6);
    // his hand out to hers
    P.fig.reachL = L.fig.j ? L.fig.j.handR || null : null;
    yield* this.say('D15', P.fig, 0.4);
    P.fig.reachL = null;
    P.fig.lookAt = null;
    L.fig.lookAt = null;
    L.pl.follow = true;
    this.film(false);
    this.hour(18.42, 0.0035);
    this.objective('Get to your <b>car</b>', GARAGE_IN.x, GARAGE_IN.z, 'Car park');
    this.start(5);
  }

  // the man with the bag: going by behind them, a strange mark on it (something like an eraser,
  // and not), into the people and gone
  bagMan() {
    if (this.cast.bag) return this.cast.bag;
    const g = this.game;
    const P = g.player;
    const f = P.fig.forward;
    // (behind them and to his left, crossing - his bag on the side towards Danny)
    const x0 = P.pos.x - f.x * 3.2 + f.z * 1.5;
    const z0 = P.pos.z - f.z * 3.2 - f.x * 1.5;
    const c = this.person('bag', x0, z0, civilianLook({ fem: false, kind: 'casual' }));
    this.go(c, P.pos.x - f.x * 3.4 - f.z * 10, P.pos.z - f.z * 3.4 + f.x * 10, 1.4);
    if (this.set && this.set.markBag) this.set.markBag(c);
    return c;
  }

  // ------------------------------------------------------------------ 5. WAITING
  *s5() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    // the thugs, and their car by the way in
    this.spawnThugs();
    // the phone, half way there
    yield () => this.dist(GARAGE_IN.x, GARAGE_IN.z) < 70;
    this.phoneRing(true);
    yield 2.4;
    this.phoneRing(false);
    this.ui.call('live', 'BENNY');
    yield* this.say('P01', null, 0.3);
    yield* this.say('D16', P.fig, 0.3);
    yield* this.say('P02', null, 0.3);
    yield* this.say('D17', P.fig, 0.3);
    yield* this.say('P03', null, 0.4);
    this.ui.call('off');
    g.audio.play('click', 0.5);
    // the dark car by the car park, the two men by it
    yield () => this.dist(THUGS[0].x, THUGS[0].z) < 17;
    const t1 = this.cast.t1;
    const t2 = this.cast.t2;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    this.cue('discovery');
    // (where he stopped: a few steps before them)
    const a = Math.atan2(t1.pos.x - P.pos.x, t1.pos.z - P.pos.z);
    this.putDanny(t1.pos.x - Math.sin(a) * 6.5, t1.pos.z - Math.cos(a) * 6.5, a);
    this.put(L, P.pos.x - Math.sin(a) * 1.2 + Math.cos(a) * 0.9, P.pos.z - Math.cos(a) * 1.2 - Math.sin(a) * 0.9, a);
    L.pl.follow = false;
    t1.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    t2.fig.lookAt = P.fig.j ? P.fig.j.head : null;
    this.faceTo(t1, P.pos.x, P.pos.z);
    this.faceTo(t2, P.pos.x, P.pos.z);
    this.shot({ from: () => v3(P.pos.x - Math.sin(a) * 3 + Math.cos(a) * 1.4, 1.8, P.pos.z - Math.cos(a) * 3 - Math.sin(a) * 1.4), look: () => v3(t1.pos.x, 1.3, t1.pos.z), fov: 44, dur: 4, hand: 0.5 });
    this.go(t1, t1.pos.x - Math.sin(a) * 2.5, t1.pos.z - Math.cos(a) * 2.5, 1.2);
    yield* this.say('T01', t1.fig, 0.3);
    // he stops; puts her behind him
    this.put(L, P.pos.x - Math.sin(a) * 1.0 - Math.cos(a) * 0.3, P.pos.z - Math.cos(a) * 1.0 + Math.sin(a) * 0.3, a);
    this.feel(L.fig, 'scared', 20);
    this.feel(P.fig, 'angry', 12);
    this.shot({ from: () => v3(t1.pos.x + Math.cos(a) * 1.0, 1.7, t1.pos.z - Math.sin(a) * 1.0), look: () => v3(P.pos.x, 1.6, P.pos.z), fov: 36, dur: 2.6, hand: 0.5 });
    yield* this.say('D18', P.fig, 0.3);
    this.shot({ from: () => v3(P.pos.x + Math.cos(a) * 0.9, 1.7, P.pos.z - Math.sin(a) * 0.9), look: () => v3(t1.pos.x, 1.6, t1.pos.z), fov: 38, dur: 3.2, hand: 0.5 });
    yield* this.say('T02', t1.fig, 0.25);
    this.shot({ from: () => v3(t1.pos.x + Math.cos(a) * 1.0, 1.7, t1.pos.z - Math.sin(a) * 1.0), look: () => v3(P.pos.x, 1.6, P.pos.z), fov: 34, dur: 3, hand: 0.5 });
    yield* this.say('D19', P.fig, 0.25);
    this.shot({ from: () => v3(P.pos.x + Math.cos(a) * 0.9, 1.7, P.pos.z - Math.sin(a) * 0.9), look: () => v3(t1.pos.x, 1.6, t1.pos.z), fov: 34, dur: 3.2, hand: 0.6 });
    // they come on: one in his way
    this.go(t1, P.pos.x + Math.sin(a) * 1.25, P.pos.z + Math.cos(a) * 1.25, 1.1);
    this.go(t2, P.pos.x + Math.sin(a) * 1.4 + Math.cos(a) * 1.3, P.pos.z + Math.cos(a) * 1.4 - Math.sin(a) * 1.3, 1.2);
    yield* this.say('T03', t1.fig, 0.1);
    // there is no talking it out: a punch, a shove, her hand, the car
    this.shot({ from: () => v3(P.pos.x - Math.cos(a) * 3.2 + Math.sin(a) * 0.6, 1.5, P.pos.z + Math.sin(a) * 3.2 + Math.cos(a) * 0.6), look: () => v3((P.pos.x + t1.pos.x) / 2, 1.4, (P.pos.z + t1.pos.z) / 2), fov: 40, dur: 2.2, hand: 0.9 });
    yield* this.punch(t1, a);
    yield* this.shove(t2, a);
    this.cue('chase');
    // into the car park, to the car - and in
    const v = this.dannyCar;
    this.putDanny(v.pos.x - 1.6, v.pos.z + 0.2, 0);
    this.put(L, v.pos.x + 1.6, v.pos.z + 0.2, 0);
    this.shot({ from: () => v3(v.pos.x - 4.2, 1.4, v.pos.z - 5.5), look: () => v3(v.pos.x, 0.9, v.pos.z), fov: 46, dur: 2, hand: 0.8 });
    yield 0.8;
    g.enterVehicle(v);
    L.pl.ride = v;
    g.audio.play('roar', 0.9);
    this.shot({ from: () => v3(GARAGE_IN.x - 6, 1.3, GARAGE_IN.z + 1.5), look: () => v3(t2.pos.x, 1.3, t2.pos.z), fov: 44, dur: 2.6, hand: 0.9 });
    t2.downT = 0;
    this.go(t2, THUG_CAR.x - 1.5, THUG_CAR.z, 3.5);
    yield* this.say('T04', t2.fig, 0.2);
    // their car comes after them
    this.startPursuit();
    this.check = { x: DANNY_CAR.x, y: GARAGE_A.Y[0], z: 320, yaw: -Math.PI / 2, back: { x: 12, z: 320 } };
    this.film(false);
    this.objective('<b>Lose them</b> - get out of the car park', GARAGE_A.x0 + 1, 320, 'Exit');
    this.start(6);
  }

  spawnThugs() {
    const g = this.game;
    if (!this.thugCar) {
      this.thugCar = g.vehicles.spawnStock({ kind: 'sedan', color: DARK }, { x: THUG_CAR.x, z: THUG_CAR.z }, THUG_CAR.yaw);
      this.thugCar.kept = true;
      this.thugCar.pos.y = 0.15;
    }
    if (!this.dannyCar) {
      this.dannyCar = g.vehicles.spawnStock({ kind: 'muscle', color: [0.58, 0.1, 0.12] }, { x: DANNY_CAR.x, z: DANNY_CAR.z }, DANNY_CAR.yaw);
      this.dannyCar.kept = true;
      this.dannyCar.pos.y = 0.15;
    }
    if (!this.cast.t1) {
      const lk = () => civilianLook({ fem: false, kind: 'street' });
      this.person('t1', THUGS[0].x, THUGS[0].z, lk(), { face: -1.2 });
      this.person('t2', THUGS[1].x, THUGS[1].z, lk(), { face: -1.6 });
    }
  }

  *punch(c, a) {
    const g = this.game;
    const P = g.player;
    const fig = P.fig;
    P.yaw = Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
    fig.yaw = P.yaw;
    g.audio.play('swing', 0.7);
    for (let t = 0; t < 0.36; t += this.dtR || 0.016) {
      fig.punch = Math.min(1, t / 0.36);
      fig.punchSide = 1;
      if (t > 0.16 && !c.hitDone) {
        c.hitDone = true;
        g.audio.play('punch', 1);
        g.camRig.addShake(0.35);
        const h = c.fig.j && c.fig.j.head ? c.fig.j.head : c.pos;
        const F = g.weapons && g.weapons.fists;
        if (F) F.burst(h.x, h.y, h.z, 1.2);
        c.downT = 2.6;
        c.upT = 0;
        c.yaw = a + Math.PI;
        c.vel.set(Math.sin(a) * 3, 0, Math.cos(a) * 3);
        c.dodgeV.set(Math.sin(a) * 2.4, 0, Math.cos(a) * 2.4);
        c.pl.speed = 0;
        c.pl.x = c.pos.x + Math.sin(a) * 1.6;
        c.pl.z = c.pos.z + Math.cos(a) * 1.6;
        this.feel(c.fig, 'hurt', 3);
      }
      yield 0;
    }
    fig.punch = -1;
  }

  *shove(c, a) {
    const g = this.game;
    const P = g.player;
    P.yaw = Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
    P.fig.yaw = P.yaw;
    P.fig.reachR = v3(c.pos.x, 1.3, c.pos.z);
    P.fig.reachL = v3(c.pos.x, 1.3, c.pos.z);
    yield 0.18;
    g.audio.play('block', 0.8);
    const b = Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
    c.dodgeV.set(Math.sin(b) * 3.2, 0, Math.cos(b) * 3.2);
    c.downT = 1.4;
    c.upT = 0;
    this.feel(c.fig, 'hurt', 2);
    yield 0.3;
    P.fig.reachR = null;
    P.fig.reachL = null;
    void a;
  }

  phoneRing(on) {
    const g = this.game;
    if (on) {
      this.ui.call('ring', 'BENNY');
      let n = 0;
      this.ringT = setInterval(() => {
        if (n++ > 6) clearInterval(this.ringT);
        g.audio.play('beep', 0.5);
        setTimeout(() => g.audio.play('beep', 0.45), 160);
      }, 700);
    } else clearInterval(this.ringT);
  }

  startPursuit() {
    const g = this.game;
    const v = this.thugCar;
    const t1 = this.cast.t1;
    const t2 = this.cast.t2;
    // the two of them in it (off the street: their car drives itself here)
    for (const c of [t1, t2]) {
      if (!c) continue;
      // (in their car: out of the street altogether, nothing to run into)
      c.fig.setVisible(false);
      c.pl.ride = v;
      c.noCollide = true;
      c.inside = true;
    }
    const P = new Pursuer(g, v, g.player.inVehicle);
    P.seed([[THUG_CAR.x - 2, 0.15, THUG_CAR.z - 4], [THUG_CAR.x - 6, 0.15, 320.5], [12, 0.15, 320], [6, 0.15, 320]]);
    P.keep = 10;
    this.pursuers = [P];
    this.pursuer = P;
  }

  // ------------------------------------------------------------------ 6. THE CAR PARK
  *s6() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    yield 2.2;
    yield* this.say('L12', L.fig, 0.25);
    yield* this.say('D20', P.fig, 0.25);
    yield* this.say('L13', L.fig, 0.2);
    yield* this.say('D21', P.fig, 0.3);
    // the way out at the far end: a car swings into it
    const v = () => P.inVehicle;
    yield () => v() && v().pos.x < -14 && v().pos.y < 1.5;
    this.blockExit();
    yield 0.6;
    yield* this.say('D22', P.fig, 0.2);
    this.objective('Head <b>up</b> - go for the roof', CLIMB[0].x, CLIMB[0].z, 'Ramp');
    this.climb = true;
    this.climbLv = -1;
    // up and up: on the roof, a dead end
    this.check = { x: -36, y: GARAGE_A.Y[0], z: 344, yaw: Math.PI / 2, back: { x: -36, z: 320 } };
    yield () => v() && v().pos.y > ROOF_A - 0.5;
    this.climb = false;
    yield () => v() && (v().pos.x < -6 || Math.abs(v().speed) < 3) && v().pos.y > ROOF_A - 0.5;
    this.start(7);
  }

  blockExit() {
    const g = this.game;
    const b = g.vehicles.spawnStock({ kind: 'suv', color: DARK }, { x: GARAGE_A.x0 - 12, z: 318 }, Math.PI / 2);
    b.kept = true;
    this.blocker = b;
    const x1 = GARAGE_A.x0 - 2.6;
    let t = 0;
    // in it comes, sliding sideways across the way out, and stops there
    b.script = (dt) => {
      t += dt;
      const k = Math.min(1, t / 0.9);
      const e = 1 - Math.pow(1 - k, 3);
      b.pos.x = GARAGE_A.x0 - 12 + (x1 - (GARAGE_A.x0 - 12)) * e;
      b.pos.z = 318 + 2 * e;
      b.pos.y = 0.15;
      b.yaw = Math.PI / 2 - e * (Math.PI / 2) * 0.95;
      b.speed = (1 - k) * 12;
      if (k >= 1) b.script = null;
    };
    g.audio.play('skid', 0.8);
    this.blockCol = g.world.collision.addBox(x1 - 2.6, 316, x1 + 1.2, 324, -1, 1.8, 'wall');
  }

  // ------------------------------------------------------------------ 7. THE FIRST DRAWING
  *s7() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const v = P.inVehicle || this.dannyCar;
    const Pu = this.pursuer;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    // the car at the far end of the roof's way, facing the edge; the dark car up behind it
    v.speed = 0;
    v.vx = v.vz = 0;
    v.pos.set(RUNUP.x, ROOF_A, RUNUP.z);
    v.yaw = RUNUP.yaw;
    if (Pu) {
      Pu.paused = true;
      const c = Pu.car;
      c.pos.set(GARAGE_A.x1 - 2.4, ROOF_A, 328.2);
      c.yaw = -Math.PI / 2 - 0.65;
      c.vx = c.vz = 0;
      c.speed = 0;
    }
    // ahead: the edge, the street, the roof across
    this.shot({ from: () => v3(v.pos.x + 4.5, ROOF_A + 2.4, v.pos.z + 1.2), look: [-60, ROOF_B + 1, 320], fov: 50, dur: 3, hand: 0.5 });
    yield 2.6;
    // behind: the dark car; one of them out of it with a gun
    const t2 = this.cast.t2;
    const pc = Pu ? Pu.car : null;
    if (t2 && pc) {
      t2.pl.ride = null;
      t2.riding = false;
      t2.inside = false;
      t2.fig.setVisible(true);
      this.put(t2, pc.pos.x - 2.2, pc.pos.z - 1.6, Math.atan2(v.pos.x - pc.pos.x, v.pos.z - pc.pos.z));
      t2.pos.y = ROOF_A;
      t2.baseY = ROOF_A - 0.15;
      t2.fig.reachR = v3(v.pos.x, ROOF_A + 1.2, v.pos.z);
      t2.fig.reachL = v3(v.pos.x, ROOF_A + 1.2, v.pos.z);
      this.gunman = t2;
    }
    this.shot({ from: () => v3(v.pos.x - 1.6, ROOF_A + 1.45, v.pos.z - 1.1), look: () => (pc ? v3(pc.pos.x, ROOF_A + 1.2, pc.pos.z) : v3(20, ROOF_A, 330)), fov: 40, dur: 2.6, hand: 0.6 });
    yield 2.4;
    // Lily
    this.shot({ from: this.carSide(v, 1, 1.9, 1.2, 0.5), look: this.faceOf(L), fov: 34, dur: 3.2, hand: 0.4 });
    yield* this.say('L14', L.fig, 0.4);
    // Danny looks across again: an idea. A crazy one
    this.shot({ from: this.carSide(v, -1, 1.7, 1.35, 0.6), look: this.faceOf(P), fov: 30, dur: 2.2, hand: 0.3 });
    P.fig.lookAt = v3(-80, ROOF_B, 320);
    yield 2.0;
    // time all but stops; the gap; the sheet over it - draw
    this.cue('slowmo');
    this.slow(0.05, 3);
    // (from over the end of the short street, the sun behind: South Pointe's roof on the left, the
    // gap and the street far below in the middle, Pointe West's roof on the right - drawn left to
    // right)
    const camPos = v3(-50, ROOF_A + 11, 296);
    const camLook = v3(-47, ROOF_A - 1.5, 326);
    this.shot({ from: () => v3(v.pos.x + 6, ROOF_A + 4, v.pos.z - 7), to: camPos, look: () => v3(v.pos.x - 8, ROOF_A + 1, v.pos.z), lookTo: camLook, fov: 50, fovTo: 58, dur: 2.2, ease: 'inout', hand: 0.15 });
    yield 2.3;
    this.shot({ from: camPos, look: camLook, fov: 58, dur: 999, hand: 0.05 });
    yield 0.05;
    const cam = g.camera;
    cam.updateMatrixWorld();
    this.draw = new RampDraw(g, this.ui);
    let prof = null;
    this.draw.open({ camera: cam, roofY: ROOF_A, laneZ: RUNUP.z, startX: GARAGE_A.x0 + 12, edgeX: GARAGE_A.x0 }, (p) => {
      prof = p;
    });
    g.audio.play('pageflip', 0.6);
    yield () => !!prof;
    g.audio.play('scribble', 0.8);
    // the line grows into the ramp
    this.ramp = new Ramp(g, prof);
    this.set.garages[0].extra.push(this.ramp);
    this.shot({ from: camPos, to: v3(-44, ROOF_A + 7, 300), look: camLook, lookTo: v3(-38, ROOF_A + 1.5, 321), fov: 58, fovTo: 48, dur: 3.2, ease: 'inout', hand: 0.1 });
    yield () => this.ramp.grown;
    g.audio.play('magic', 0.7);
    yield 0.5;
    // back with them in the car
    this.slow(1, 3);
    this.shot({ from: this.carSide(v, 1, 2.9, 1.45, 1.4), look: this.cabin(v, 1.05), fov: 40, dur: 6, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    yield* this.say('L15', L.fig, 0.3);
    this.feel(P.fig, 'angry', 4);
    yield* this.say('D23', P.fig, 0.2);
    P.fig.lookAt = null;
    // the engine; the player's foot on it
    this.cue('chase', { heat: 1 });
    g.audio.play('roar', 1);
    this.film(false);
    g.camRig.yaw = v.yaw;
    this.objective('<b>Floor it!</b>');
    if (Pu) {
      Pu.paused = false;
      Pu.keep = 6;
    }
    this.shooting = true;
    this.everyFrame = (dt) => this.gunfire(dt);
    this.check = { x: RUNUP.x, y: ROOF_A, z: RUNUP.z, yaw: RUNUP.yaw, minY: ROOF_A - 1.5, back: { x: GARAGE_A.x1 - 3, z: 330 } };
    this.start(8);
  }

  // the man on the roof shooting after them (wide: they are only meant to hurry)
  gunfire(dt) {
    if (!this.shooting || !this.gunman) return;
    const g = this.game;
    this.shotT = (this.shotT || 0.4) - dt;
    if (this.shotT > 0) return;
    this.shotT = 0.35 + Math.random() * 0.5;
    const v = g.player.inVehicle;
    if (!v) return;
    g.audio.play('shotgun', 0.25);
    const x = v.pos.x + (Math.random() - 0.5) * 6;
    const z = v.pos.z + (Math.random() - 0.5) * 4;
    if (g.fx) g.fx.sparks(x, ROOF_A + 0.1, z, 6, [1, 0.85, 0.4]);
  }

  // ------------------------------------------------------------------ 8. THE JUMP
  *s8() {
    const g = this.game;
    const P = g.player;
    const v = () => P.inVehicle;
    const prof = this.ramp.P;
    // up the ramp, over its lip: flown from here
    yield () => v() && v().pos.x < prof.lipX + 0.6 && v().pos.y > ROOF_A + prof.h * 0.6;
    this.objective(null);
    this.shooting = false;
    const car = v();
    const J = new Jump(g, car, prof, LAND);
    this.jump = J;
    if (this.pursuer) this.pursuer.paused = true;
    this.film(true);
    // the rear three-quarters of it leaving the lip, then wide as it hangs over the street
    this.shot({ from: () => v3(car.pos.x + 7, car.pos.y + 1.2, car.pos.z + 5), look: () => v3(car.pos.x, car.pos.y + 0.6, car.pos.z), fov: 50, dur: 1.2, hand: 0.4 });
    yield () => J.apex;
    // the top of the arc: time nearly still; the title in the picture
    this.slow(0.035, 9);
    this.cue('title');
    const c0 = car.pos.clone();
    this.shot({
      path: [v3(c0.x + 5, c0.y + 1, c0.z + 4.5), v3(c0.x + 2, c0.y + 2.2, c0.z + 12), v3(c0.x - 4, c0.y + 4, c0.z + 26)],
      look: () => v3(car.pos.x - 6, car.pos.y - 1.2, car.pos.z - 4),
      fov: 46,
      fovTo: 58,
      dur: 5.4,
      ease: 'inout',
      hand: 0.2,
    });
    yield 0.9;
    // a moment of their faces: Danny on the wheel, Lily holding on
    this.ui.title(true, GAME_TITLE, CREDIT);
    yield 3.4;
    this.ui.title(false);
    yield 0.6;
    // and on: the far roof coming up fast
    this.slow(1, 2.5);
    this.shot({ from: () => v3(car.pos.x + 9, car.pos.y + 3.5, car.pos.z + 7), look: () => v3(LAND.x - 4, ROOF_B, 320), fov: 52, dur: 2.2, hand: 0.6 });
    yield () => J.done;
    // down: hard
    g.camRig.addShake(1.1);
    g.audio.play('crash', 1);
    g.audio.play('skid', 1);
    if (g.fx) {
      for (let i = 0; i < 4; i++) g.fx.sparks(car.pos.x + (Math.random() - 0.5) * 3, car.pos.y + 0.2, car.pos.z + (Math.random() - 0.5) * 2, 12, [1, 0.8, 0.35]);
      g.fx.smoke(car.pos.x, car.pos.y + 0.4, car.pos.z, 2.4);
    }
    // it slews round towards the wall, the tyres screaming, scrubbing off its speed; he fights it
    car.vx *= 0.42;
    car.vz = car.vz * 0.42 + 4;
    car.yawRate = (car.yawRate || 0) + 1.2;
    this.shot({ from: () => v3(car.pos.x - 6, car.pos.y + 2.2, car.pos.z - 7), look: () => v3(car.pos.x, car.pos.y + 0.5, car.pos.z), fov: 48, dur: 1.4, hand: 1 });
    yield 1.2;
    this.film(false);
    g.camRig.yaw = car.yaw;
    this.objective('Get down to the <b>street</b>', -64, 344, 'Street');
    this.check = { x: LAND.x - 4, y: ROOF_B, z: 320, yaw: -Math.PI / 2 };
    this.hour(18.62, 0.004);
    this.start(9);
  }

  // ------------------------------------------------------------------ 9. AWAY, AND QUIET
  *s9() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const v = () => P.inVehicle;
    // out of the second car park into the short street - where the other car is waiting
    if (this.pursuer) this.pursuer.paused = true;
    yield () => v() && v().pos.y < 1 && v().pos.x > GARAGE_B.x1 - 6;
    const b = this.blocker;
    if (b) {
      if (this.blockCol !== undefined) g.world.collision.remove(this.blockCol);
      this.blockCol = undefined;
      const Q = new Pursuer(g, b, v());
      Q.keep = 5;
      Q.seed([[b.pos.x, 0.15, b.pos.z], [-52, 0.15, 330]]);
      this.pursuers = [Q];
      this.pursuer = Q;
    }
    this.objective('<b>Lose them</b>', LOOKOUT.x, LOOKOUT.z, 'Beach');
    this.check = { x: -50, y: 0.15, z: 340, yaw: Math.PI / 2 };
    // they give up once he is far enough away, or out on the sand where they will not follow
    yield () => {
      const car = v();
      const Q = this.pursuer;
      if (!car || !Q || !Q.car) return true;
      const d = Math.hypot(car.pos.x - Q.car.pos.x, car.pos.z - Q.car.pos.z);
      this.loseT = d > 75 || car.pos.x > 46 ? (this.loseT || 0) + this.dtR : 0;
      return this.loseT > 2.5;
    };
    if (this.pursuer) {
      this.pursuer.paused = true;
      this.pursuer.input.handbrake = true;
    }
    this.cue('chase', { heat: 0.2 });
    this.objective('Find somewhere <b>quiet</b>', LOOKOUT.x, LOOKOUT.z, 'Beach');
    yield () => v() && this.dist(LOOKOUT.x, LOOKOUT.z) < 14 && Math.abs(v().speed) < 6;
    // the car stopped; the engine running; his breath
    this.check = null;
    this.objective(null);
    if (g.gps) g.gps.clear();
    const car = v();
    car.ai = null;
    this.film(true);
    this.cue('ending', { fade: 3 });
    this.hour(18.8, 0.01);
    // (stopped where it is)
    car.vx = car.vz = 0;
    car.speed = 0;
    // facing the water, the pier off to the north
    this.shot({ from: this.carSide(car, 1, 2.8, 1.4, 1.2), look: this.cabin(car, 1.05), fov: 40, dur: 30, hand: 0.35 });
    yield 2.4;
    this.feel(L.fig, 'angry', 6);
    yield* this.say('L16', L.fig, 1.3);
    this.feel(P.fig, 'sad', 10);
    yield* this.say('D24', P.fig, 0.6);
    this.feel(L.fig, 'sad', 10);
    yield* this.say('L17', L.fig, 0.5);
    yield* this.say('D25', P.fig, 0.6);
    this.ui.sketch(this.sketch || (this.sketch = lilyDrawing()));
    yield 1.4;
    yield* this.say('L18', L.fig, 0.4);
    yield 0.6;
    yield* this.say('D26', P.fig, 0.3);
    this.ui.sketch(null);
    // a few seconds, nobody saying anything
    yield 3.2;
    // the camera draws back over the water: the bay at the last of the sunset, the city alive - and
    // out there on the pier, the evening where the wheel stood
    const c0 = car.pos.clone();
    this.shot({
      path: [v3(c0.x + 2, c0.y + 1.5, c0.z + 2), v3(c0.x + 12, c0.y + 6, c0.z + 6), v3(c0.x + 30, c0.y + 16, c0.z + 4), v3(c0.x + 48, c0.y + 28, c0.z - 6)],
      lookPath: [v3(c0.x, c0.y + 1, c0.z), v3(c0.x + 20, c0.y + 4, c0.z - 40), v3(WHEEL.x - 4, 18, WHEEL.z + 6), v3(WHEEL.x, 24, WHEEL.z)],
      fov: 46,
      fovTo: 54,
      dur: 15,
      ease: 'inout',
      hand: 0.2,
    });
    yield 13.5;
    this.ui.fade(true);
    yield 2.4;
    this.finish();
  }

  // ------------------------------------------------------------------ the end
  finish() {
    const g = this.game;
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch (e) {
      // (private browsing: it plays again next time)
    }
    this.done = true;
    this.co = null;
    for (const p of this.pursuers || []) p.dispose();
    this.pursuers = [];
    if (this.blockCol !== undefined) g.world.collision.remove(this.blockCol);
    this.voices.stop();
    if (this.score) this.score.stop({ fade: 4 });
    this.slow(1, 20);
    this.k = 1;
    this.film(false);
    this.quiet(false);
    if (g.daynight && this.dayMin0 !== undefined) g.daynight.dayMin = this.dayMin0;
    const L = this.cast.lily;
    // (Lily stays with him for now - and the city is his)
    if (L) L.pl = { follow: true, ride: L.pl && L.pl.ride };
    setTimeout(() => {
      this.ui.fade(false);
      this.ui.objective(null);
      document.body.classList.remove('prologue');
      this.active = false;
    }, 600);
  }
}

void LINES;
void rampH;
