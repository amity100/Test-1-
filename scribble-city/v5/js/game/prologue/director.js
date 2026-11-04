import * as THREE from 'three';
import { PrologueUI, lilyDrawing } from './ui.js';
import { PrologueVoices } from './voice.js';
import { Shots } from './shots.js';
import { LINES } from './lines.js';
import { WHEEL, STAND, PARK } from './set.js';
import { Pursuer } from './chase.js';
import { RampDraw, Ramp, Jump, rampH } from './ramp.js';
import { HeldPage } from './page.js';
import { Acting, ACTS } from './acting.js';
import { Comic } from './comic.js';
import { civilianLook, kidLook } from '../looks.js';
import { clamp } from '../../core/util.js';

// (v5, ROADMAP 18) THE LAST SUNSET - the game's prologue, directed.
//
// 1. The opening: the camera comes in off the sea at sunset, past the yachts, past the great wheel on
//    the pier, over the beach and the promenade, and down to Danny Cruz. Forty seconds of the city
//    are his before anything is asked; then: meet Lily at the ice cream stand.
// 2. Lily, with her ice cream and her sketchbook. They walk; she sees her uncle's face on a board.
// 3. The wheel against the sunset, full of kids: so high, so many colours, can she go on it too; her
//    drawing of it, held up to him; a boy up there shouting down to his mother. A strange mark on a
//    stranger's bag, a glimpse; something under the evening's sounds; then the wheel is rubbed out,
//    stroke by stroke, as an eraser rubs out a drawing - two and a half seconds - and the sky.
// 4. Nobody remembers it. Only the two of them. Her drawing still has it. Her question, and his
//    silence.
// 5. The phone; the two men waiting by 5th Street Garage, in the middle of the city, the same two to
//    the end; their guns; into the garage and the car, the shots going all round them.
// 6. The chase up through the garage: its long sloping straights, floor after floor, the dark car close
//    behind - to the roof.
// 7. The roof run, a hundred metres straight to the edge over 5th Street: time all but stops, and the
//    first drawing - a ramp, drawn by the player, growing out of the line into steel at the edge.
// 8. The jump: in the air, time all but stopped, the title over the city. The landing, hard.
// 9. Away, and quiet, over the bay. "It was there." The camera draws back over the water; where the
//    wheel stood there is only the evening.
//
// A scene is a script (a generator): it says lines, cuts between shots, gives the player the city
// back and waits for them. What the player does in between is the game's own.

// (on for every new game once all of it is checked through; till then only with ?prologue=1)
export const PROLOGUE_ON = false;
// (a working title, until the name is chosen)
export const GAME_TITLE = 'OUTLINE';
// (who made it, under the name - in the player's own language, as the rest of what is put over the
// picture is)
export const CREDIT = 'יוצר: אמיתי דהן';
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
// (5th Street Garage, inland on the block of 5th to 7th Street, and Bayshore Parking across 5th
// Street from it - game/prologue/carpark.js PARK: where the two men wait and where Danny stops, his
// car, the way up, the roof run and its edge, the roof across the street, the way down)
const GARAGE_IN = { x: PARK.dannyStop.x, z: PARK.dannyStop.z };
const THUG_CAR = PARK.thugCar;
const THUGS = PARK.thugs;
const DANNY_CAR = PARK.heroCar;
const RUNUP = PARK.runup;
// (the roof run's own frame: the drawing, the ramp and the jump are worked out along -x in it)
const RUNF = PARK.runFrame;
const ROOF = RUNF.roofY;
// (game/prologue/ramp.js wants the run's frame: x along it, z across)
const loc = (x, z) => RUNF.toLocal(x, z);
const wld = (lx, y, lz) => {
  const [x, z] = RUNF.toWorld(lx, lz);
  return new THREE.Vector3(x, y, z);
};
// (the game's camera, looking down the roof as it is drawn on: its pitch - shallow enough that the
// edge sixty metres off, and the roof across the street past it, stand well inside the picture)
const DRAW_PITCH = -0.22;
// where the jump comes down: Bayshore's roof across the street, in the run's frame
const LAND = { x: loc(PARK.land.x, PARK.land.z)[0], y: PARK.land.y, z0: PARK.land.zone.x0, z1: PARK.land.zone.x1, frame: RUNF };
// (on the dry sand south of the pier, looking north-east at it - into the sunset)
const LOOKOUT = { x: 60, z: 298 };
const DARK = [0.1, 0.1, 0.12];

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
    // (how each line is acted: the hands, the face, the head, the listener - game/prologue/acting.js)
    this.acting = new Acting(g);
    // (the action's comic moments: impact frames, speed lines, sound words - game/prologue/comic.js)
    this.comic = new Comic(g, this.ui.root);
    this.voices.load();
    // its pieces of the city (the wheel among them)
    if (g.prolSet) g.prolSet.build();
    this.set = g.prolSet;
    // (Lily's drawing, the page itself: made now, its picture sent to the graphics card now - not
    // the moment she holds it up)
    const page = this.lilyPage();
    if (g.renderer && g.renderer.initTexture) g.renderer.initTexture(page.tex);
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
    if (n >= 4) {
      this.spawnPier();
      if (this.set) this.set.removeWheel();
    }
    if (n >= 4 && n < 5) {
      this.putDanny(VIEW.x + 1.5, VIEW.z + 0.9, Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z));
      this.put(L, VIEW.x, VIEW.z, Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z));
    }
    if (n >= 5) {
      // (her ice cream long gone by now)
      if (L.fig.carry === 'icecream') L.fig.carry = null;
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
      this.objective('<b>Lose them</b> - up through the car park', PARK.route[1].x, PARK.route[1].z, 'Up');
      this.climb = true;
      this.climbI = -1;
      this.cue('chase');
    }
    if (n >= 7) {
      // (at the start of the roof run, the dark car coming round the turn behind)
      const v = this.dannyCar;
      v.pos.set(RUNUP.x, RUNUP.y + 0.05, RUNUP.z);
      v.yaw = RUNUP.yaw;
      v.speed = 0;
      const c = this.pursuer && this.pursuer.car;
      if (c) {
        c.pos.set(PARK.main.xc - 4, RUNUP.y + 0.05, RUNUP.z - 3);
        c.yaw = -Math.PI / 2;
        this.pursuer.trail.length = 0;
        this.pursuer.i = 0;
        this.pursuer.seed([[c.pos.x, c.pos.y, c.pos.z], [RUNUP.x, RUNUP.y, RUNUP.z]]);
      }
      this.climb = false;
    }
    g.camRig.yaw = n >= 6 && this.dannyCar ? this.dannyCar.yaw : Math.PI;
    this.start(n);
  }

  start(n) {
    const S = [null, this.s1, this.s2, this.s3, this.s4, this.s5, this.s6, this.s7, this.s8, this.s9];
    // (the place's own echo for its voices: the pier and the beach, the street, the car's cabin)
    const SPACE = [null, 'open', 'open', 'open', 'open', 'street', 'car', 'car', 'car', 'car'];
    if (this.voices.space) this.voices.space(SPACE[n]);
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
    // (the ear where the camera is; every voice from its speaker's head)
    if (this.voices.update) this.voices.update(dt, this.game.camera);
    if (this.draw && (this.draw.on || this.draw.settle)) this.draw.frame(dt);
    if (this.ramp && !this.ramp.grown) this.ramp.update(dt);
    for (const p of this.pursuers || []) p.update(dt * this.k);
    this.watchdog(dt);
    this.tickCast(dt);
    this.tickHeroes();
    if (this.page) this.page.update();
    this.acting.update(dt);
    this.comic.update(dt);
    this.tickGuns(dt);
    // (Danny walking somewhere in a shot, on his own feet - or running)
    if (this.walkTo && this.walkDanny(this.walkTo.x, this.walkTo.z, this.walkTo.speed, this.walkTo.sprint)) this.walkTo = null;
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
    // (the city's chatter over people's heads: none in the film, and what was up, gone)
    const B = this.game.bubbles;
    if (B) {
      B.hold = on;
      if (on && B.clear) B.clear();
    }
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
    const g = this.game;
    const L = LINES[id];
    // (the hands, the face and the head go with the words, beat by beat - and whoever it is said to
    // takes it as it lands: everybody looking at the speaker)
    if (fig && ACTS[id]) {
      const all = [g.player.fig, ...Object.values(this.cast).map((q) => q.fig), ...(this.heroes || []).map((q) => q.fig)];
      const listeners = all.filter((f) => f && f !== fig && fig.j && f.lookAt === fig.j.headC);
      this.acting.play(fig, id, d, listeners);
    } else {
      // (a line with no acting of its own: one of the city's people talks with their hands as they do)
      const c = fig ? Object.values(this.cast).find((q) => q.fig === fig) : null;
      if (c && L && g.civilians.spoke) g.civilians.spoke(c, L.en, /!/.test(L.en) ? 'alarm' : 'talk');
    }
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
  // from it, along it (forwards +), up from its floor - the windows are down: through them (a face
  // through a side window from no more than ~0.4 m ahead of the seat: further forward, the
  // windscreen's pillar is across it)
  carSide(v, side, out, h, along = 0) {
    return () => {
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      // (its right: -fz, fx)
      return v3(v.pos.x + fx * along - fz * side * out, (v.pos.y || 0) + h, v.pos.z + fz * along + fx * side * out);
    };
  }

  // a camera inside a car, in its own frame: x to its left (the driver's side), y up from the seats'
  // floor, u forward of the front seats' line - in under the roof, behind the windscreen, looking back
  // at the faces in front (a car's dialogue shot: no pillar across them, nothing but the cabin round)
  inCar(v, x, y, u) {
    return () => {
      const S = v.seatOf ? v.seatOf() : { u: -0.25, y: 0 };
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const uu = S.u + u;
      // (its left: (fz, -fx); its forward: (fx, fz))
      return v3(v.pos.x + fz * x + fx * uu, (v.pos.y || 0) + S.y + y, v.pos.z - fx * x + fz * uu);
    };
  }

  cabin(v, h = 1.05) {
    return () => v3(v.pos.x, (v.pos.y || 0) + h, v.pos.z);
  }

  // where somebody's head is: the middle of it, as their figure is posed this frame (sitting in a
  // car, a child, bending) - until it has been posed once, where a grown-up's head would be
  headJ(c) {
    const j = c.fig && c.fig.j && c.fig.j.headC;
    return j && (j.x !== 0 || j.y !== 0 || j.z !== 0) ? j : null;
  }

  headH(c) {
    const j = this.headJ(c);
    return j ? j.y - c.pos.y : 1.6;
  }

  faceOf(c) {
    return () => {
      const j = this.headJ(c);
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

  walkDanny(x, z, speed = 0.45, sprint = false) {
    const g = this.game;
    const p = g.player;
    const dx = x - p.pos.x;
    const dz = z - p.pos.z;
    if (Math.hypot(dx, dz) < 0.4) {
      this.auto = null;
      return true;
    }
    g.camRig.yaw = Math.atan2(dx, dz);
    this.auto = { x: 0, y: speed, sprint };
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
      // (on a booster cushion, as a child of her size rides: her face over the door, in the window)
      const boost = L.fig.scale && L.fig.scale < 0.9 ? 0.22 : 0;
      L.pos.set(v.pos.x + fx * S.u - fz * S.s, (v.pos.y || 0) + S.y + boost, v.pos.z + fz * S.u + fx * S.s);
      L.vel.set(0, 0, 0);
      L.yaw = v.yaw;
      L.faceYaw = v.yaw;
      L.baseY = S.y + boost;
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

  // the marker over where to go, kept on the way up through the car park: the next mark of the way
  // up (game/prologue/carpark.js PARK.route) above the level the car is on
  tickMarker() {
    if (this.descend) return this.tickDown();
    if (!this.climb) return;
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v) return;
    const lv = PARK.levelAt(v.pos.x, v.pos.z, v.pos.y + 0.3);
    if (lv === null || lv >= 10) return;
    const R = PARK.route;
    let i = R.findIndex((c) => c.lv > lv + 0.3);
    if (i < 0) i = R.length - 1;
    if (i !== this.climbI) {
      this.climbI = i;
      if (g.gps) g.gps.set(R[i].x, R[i].z, i === R.length - 1 ? 'Roof' : 'Up');
      // (and a wreck from here on starts again at the foot of this straight: the turn it came round)
      const t = R[i - 1];
      if (t && t.what === 'turn') {
        const north = t.z < (PARK.main.zN + PARK.main.zS) / 2;
        this.check = { x: R[i].x, y: t.y + 0.05, z: north ? PARK.main.zN - 1.5 : PARK.main.zS + 1.5, yaw: north ? 0 : Math.PI, back: { x: t.x, z: t.z } };
      }
    }
  }

  // the marker down through Bayshore Parking: the next of its way down (PARK.down) below the level
  // the car is on
  tickDown() {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v) return;
    const lv = PARK.levelAt(v.pos.x, v.pos.z, v.pos.y + 0.3);
    if (lv === null || lv < 10) return;
    const D = PARK.down;
    const k = lv - 10;
    // (the ramp off the roof, the turn on each level under it, the gate, the street)
    const i = k > 3.7 ? 0 : k > 2.7 ? 1 : k > 1.7 ? 2 : k > 0.7 ? 3 : 4;
    if (i !== this.downI) {
      this.downI = i;
      if (g.gps) g.gps.set(D[i].x, D[i].z, i >= 4 ? 'Street' : 'Down');
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
    // (the shops' insides round Danny are built at their ordinary pace while the camera is far off
    // over the city - not rushed in, a frame's worth at a time, while the film flies in:
    // world/mainland/stream.js calm)
    const I = g.world && g.world.interiors;
    if (I && I.stream) I.stream.calm = true;
    // in off the sea: past the yachts and the wheel, low over the beach and along the promenade, down
    // to Danny. (Low: from up high the whole city is in the picture at once - more than a phone can
    // draw smoothly; down here the nearest of it hides the rest, and it is the promenade's evening
    // that is seen, its people, its palms)
    this.shot({
      path: [v3(338, 7, 270), v3(262, 8.5, 268), v3(196, 10, 270), v3(150, 13, 272), v3(96, 12.5, 232), v3(56, 10, 150), v3(31, 7.5, 64), v3(19.5, 4.2, 14.5), v3(17.2, 2.6, 9.6)],
      lookPath: [v3(128, 26, 243), v3(128, 26, 243), v3(126, 27, 243), v3(110, 18, 226), v3(42, 6, 160), v3(21, 3.2, 60), v3(16, 2.4, 10), v3(17, 1.9, 3), v3(17, 1.9, -12)],
      fov: 52,
      fovTo: 58,
      dur: first ? 27 : 1,
      ease: 'soft',
      hand: 0.25,
    });
    yield 26.6;
    if (I && I.stream) I.stream.calm = false;
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
    this.shot({ from: this.ots(P, L, { back: 1.0, side: 0.6, h: 1.45 }), look: this.faceOf(L), fov: 36, dur: 4, hand: 0.5 });
    yield 0.6;
    L.fig.sit = 0;
    L.baseY = 0;
    L.fig.lookAt = P.fig.j.headC;
    this.feel(L.fig, 'joy', 4);
    yield* this.say('L01', L.fig);
    // over her shoulder: him - and from here on the two of them look at each other as they talk
    P.fig.lookAt = L.fig.j.headC;
    this.shot({ from: () => v3(L.pos.x + 0.9, 1.25, L.pos.z + 0.75), look: this.faceOf(P), fov: 38, dur: 4, hand: 0.5 });
    yield* this.say('D01', P.fig, 0.3);
    // the two of them: a giggle first - then she teases him
    this.shot({ from: [LILY_SEAT.x - 1.3, 1.3, LILY_SEAT.z + 3.6], to: [LILY_SEAT.x - 1.5, 1.35, LILY_SEAT.z + 3.3], look: () => v3((L.pos.x + P.pos.x) / 2, 1.15, (L.pos.z + P.pos.z) / 2), fov: 44, dur: 5, hand: 0.5 });
    this.feel(L.fig, 'joy', 4);
    yield* this.say('LG1', L.fig, 0.12);
    yield* this.say('L02', L.fig, 0.25);
    // (a little smile from him)
    this.feel(P.fig, 'joy', 1.8);
    yield 0.8;
    // her uncle, up on a board by the way onto the pier: she sees him - and runs over to it
    const B = this.lilyBoard();
    L.fig.lookAt = v3(B.x, B.cy, B.z);
    this.feel(L.fig, 'surprised', 1.0);
    yield 0.45;
    this.feel(L.fig, 'joy', 12);
    this.go(L, B.lx, B.lz, 3.4);
    P.fig.lookAt = L.fig.j.headC;
    this.shot({ from: this.ots(P, L, { back: 1.3, side: 0.5, h: 1.72 }), look: this.faceOf(L), fov: 42, dur: 1.6, hand: 0.6 });
    yield 1.25;
    // (cut) the board, the camera rising to it as she gets there and points up at him
    this.put(L, B.lx + B.nx * 6, B.lz + B.nz * 6, B.face);
    this.go(L, B.lx, B.lz, 3.4);
    this.putDanny(B.lx + B.nx * 11 - B.rx * 1.2, B.lz + B.nz * 11 - B.rz * 1.2, B.face);
    this.walkTo = { x: B.dx, z: B.dz, speed: 0.5 };
    this.shot({
      path: [v3(B.x + B.nx * 12.9 + B.rx * 0.3, 1.0, B.z + B.nz * 12.9 + B.rz * 0.3), v3(B.x + B.nx * 11.6 - B.rx * 0.8, 1.6, B.z + B.nz * 11.6 - B.rz * 0.8), v3(B.x + B.nx * 10.5 - B.rx * 1.6, 2.2, B.z + B.nz * 10.5 - B.rz * 1.6)],
      look: this.faceOf(L),
      lookTo: v3(B.x + B.nx * 0.4, B.cy - 1.6, B.z + B.nz * 0.4),
      fov: 42,
      fovTo: 50,
      dur: 6.4,
      ease: 'swoop',
      hand: 0.3,
    });
    yield () => Math.hypot(L.pos.x - B.lx, L.pos.z - B.lz) < 0.6 || this.shots.t > 2.4;
    L.fig.reachR = v3(B.x - B.rx * 2, B.cy + 0.6, B.z - B.rz * 2);
    yield* this.say('L03', L.fig, 0.4);
    yield () => this.shots.t > 5.4;
    // the two of them under it, small, the board over them: he looks up at his brother's face
    this.shot({ from: v3(B.lx + B.nx * 5.4 - B.rx * 1.5, 0.85, B.lz + B.nz * 5.4 - B.rz * 1.5), to: v3(B.lx + B.nx * 5.0 - B.rx * 1.4, 0.9, B.lz + B.nz * 5.0 - B.rz * 1.4), look: v3(B.x + B.nx, 4.5, B.z + B.nz), fov: 52, dur: 8, hand: 0.35 });
    L.fig.reachR = null;
    P.fig.lookAt = v3(B.x, B.cy, B.z);
    yield 0.5;
    this.feel(P.fig, 'neutral', 3);
    yield* this.say('D02', P.fig, 0.25);
    // she turns to him
    L.fig.lookAt = P.fig.j.headC;
    this.faceTo(L, P.pos.x, P.pos.z);
    yield* this.say('L04', L.fig, 0.2);
    // his face: deadpan, an eye on the board, then on her
    this.walkTo = null;
    P.yaw = Math.atan2(L.pos.x - P.pos.x, L.pos.z - P.pos.z) * 0.5 + B.face * 0.5;
    P.fig.yaw = P.yaw;
    this.shot({ from: this.faceCam(P, 1.3, 0.35), look: this.faceOf(P), fov: 32, dur: 3.2, hand: 0.35 });
    P.fig.lookAt = v3(B.x, B.cy, B.z);
    yield 0.35;
    yield* this.say('D03', P.fig, 0.05);
    P.fig.lookAt = L.fig.j.headC;
    // and she laughs - a real laugh (over his shoulder)
    this.shot({ from: this.ots(P, L, { back: 0.7, side: 0.42, h: 1.58 }), look: this.faceOf(L), fov: 34, dur: 2.6, hand: 0.4 });
    this.feel(L.fig, 'joy', 3);
    this.feel(P.fig, 'joy', 3);
    yield* this.say('L05', L.fig, 0.4);
    L.fig.lookAt = null;
    P.fig.lookAt = null;
    // the walk: her at his side, the marker on the pier
    L.pl.follow = true;
    this.film(false);
    this.objective('Walk with <b>Lily</b> to the pier', VIEW.x, VIEW.z, 'Pier');
    yield () => this.dist(VIEW.x, VIEW.z) < 4.5;
    this.start(3);
  }

  // Lily's board: her uncle's face on it, on the way out onto the pier, facing the stand - where it is
  // (x, z its foot; cy the middle of the picture), which way it faces (n) and its left (r, seen from
  // the front); where she stands under it (lx, lz) and where he comes to beside her (dx, dz)
  lilyBoard() {
    if (this.boardB) return this.boardB;
    const b = (this.set && this.set.boards && this.set.boards.find((q) => Math.abs(q.z - 257.1) < 1)) || { x: 44.4, z: 257.1, nx: -0.45, nz: -0.89, w: 9, leg: 3.4 };
    const n = Math.hypot(b.nx, b.nz);
    const nx = b.nx / n;
    const nz = b.nz / n;
    const B = { x: b.x, z: b.z, nx, nz, rx: nz, rz: -nx, cy: 0.15 + b.leg + b.w / 4 };
    B.lx = b.x + nx * 4.4;
    B.lz = b.z + nz * 4.4;
    B.dx = B.lx + nx * 0.5 - B.rx * 1.05;
    B.dz = B.lz + nz * 0.5 - B.rz * 1.05;
    B.face = Math.atan2(-nx, -nz);
    this.boardB = B;
    return B;
  }

  // ------------------------------------------------------------------ 3. THE WHEEL
  // The wheel against the sunset; Lily at the railing - so high, so many colours, can she go on it
  // too; her drawing of it, held up to him; a kid up there shouting down to his mother. A few seconds
  // more of it. Then something under the sounds of the evening that should not be there - and the
  // wheel is rubbed out, stroke by stroke, kids and all, in two and a half seconds.
  *s3() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const S = this.set;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    this.hour(18.3, 0.004);
    const toW = Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z);
    const ux = Math.sin(toW);
    const uz = Math.cos(toW);
    // the two of them at the railing, the wheel ahead
    this.putDanny(VIEW.x + 1.5, VIEW.z + 0.9, toW);
    this.put(L, VIEW.x, VIEW.z, toW);
    this.spawnPier();
    if (this.voices.bedAt) this.voices.bedAt(WHEEL.x, 32, WHEEL.z);
    this.voices.bed(true, 1.1);
    // against the sunset: the wheel from the beach, full of people
    this.shot({ from: [76, 2.4, 297], to: [80, 3.6, 292], look: [128, 28, 243], lookTo: [128, 29, 243], fov: 54, fovTo: 50, dur: 4.6, hand: 0.35 });
    yield 4.2;
    // Lily at the railing: up at it, her arm up at it - so high!
    this.voices.bed(true, 0.9);
    const W0 = v3(WHEEL.x, 34, WHEEL.z);
    L.fig.lookAt = W0;
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    L.fig.reachR = v3(WHEEL.x, 44, WHEEL.z);
    this.shot({ from: [VIEW.x - ux * 2.3 - uz * 1.3, 0.95, VIEW.z - uz * 2.3 + ux * 1.3], to: [VIEW.x - ux * 1.9 - uz * 1.15, 1.0, VIEW.z - uz * 1.9 + ux * 1.15], look: [WHEEL.x, 31, WHEEL.z], fov: 50, dur: 4.2, hand: 0.4 });
    this.feel(L.fig, 'surprised', 2.4);
    yield 0.3;
    yield* this.say('L19', L.fig, 0.15);
    // its lights, its colours
    L.fig.reachR = null;
    this.feel(L.fig, 'joy', 6);
    this.shot({ from: [VIEW.x + ux * 0.2 + uz * 1.3, 1.2, VIEW.z + uz * 0.2 - ux * 1.3], look: [WHEEL.x, 21, WHEEL.z], lookTo: [WHEEL.x, 27, WHEEL.z], fov: 23, fovTo: 20, dur: 3.4, hand: 0.25 });
    yield* this.say('L20', L.fig, 0.25);
    // to him: can she go on it too? please? (a step to him, his hand in hers, tugging at it)
    const near = { x: P.pos.x - (P.pos.x - L.pos.x) * 0.55, z: P.pos.z - (P.pos.z - L.pos.z) * 0.55 };
    this.put(L, near.x, near.z, Math.atan2(P.pos.x - near.x, P.pos.z - near.z));
    // (and he turns to her: from here they talk face to face)
    P.yaw = Math.atan2(near.x - P.pos.x, near.z - P.pos.z);
    P.fig.yaw = P.yaw;
    L.fig.lookAt = P.fig.j.headC;
    P.fig.lookAt = L.fig.j.headC;
    L.fig.reachL = P.fig.j.handR;
    {
      // (from the side of the two of them, close: her face up to his)
      const mx = (L.pos.x + P.pos.x) / 2;
      const mz = (L.pos.z + P.pos.z) / 2;
      const dx = P.pos.x - L.pos.x;
      const dz = P.pos.z - L.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      // (on their north side, where the pier is open)
      const sg = dx / dl > 0 ? -1 : 1;
      const px = (-dz / dl) * sg;
      const pz = (dx / dl) * sg;
      this.shot({ from: [mx + px * 2.9, 1.25, mz + pz * 2.9], to: [mx + px * 2.7, 1.27, mz + pz * 2.7], look: [mx, 1.15, mz], fov: 47, dur: 3.6, hand: 0.4 });
    }
    yield* this.say('L21', L.fig, 0.25);
    L.fig.reachL = null;
    // him, warm
    this.shot({ from: this.faceCam(P, 1.25, 0.3), look: this.faceOf(P), fov: 30, dur: 2.4, hand: 0.3 });
    this.feel(P.fig, 'joy', 2.4);
    yield* this.say('D27', P.fig, 0.3);
    // her drawing of it: the page out of her sketchbook, held up to him
    const page = this.lilyPage();
    page.hold(L.fig, () => P.fig.j.headC, 'show');
    // (from his eyes: the page held up to him, her face over it)
    this.shot({ from: () => { const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z); const f = P.fig.forward; return v3(h.x + f.x * 0.12, h.y - 0.02, h.z + f.z * 0.12); }, look: () => v3((page.at.x * 2 + L.fig.j.headC.x) / 3, (page.at.y * 2 + L.fig.j.headC.y) / 3, (page.at.z * 2 + L.fig.j.headC.z) / 3), fov: 42, dur: 3.2, hand: 0.35 });
    this.feel(L.fig, 'joy', 3);
    yield 0.35;
    yield* this.say('L06', L.fig, 0.3);
    // he takes his time over it
    P.fig.lookAt = page.at;
    this.shot({ from: this.ots(L, P, { back: 0.55, side: 0.3, h: 1.05 }), look: this.faceOf(P), fov: 34, dur: 2.4, hand: 0.35 });
    yield 0.45;
    P.fig.lookAt = L.fig.j.headC;
    yield* this.say('D04', P.fig, 0.2);
    // not bad?!
    page.hold(L.fig, () => P.fig.j.headC, 'low');
    this.shot({ from: this.faceCam(L, 1.05, -0.42), look: this.faceOf(L), fov: 32, dur: 1.8, hand: 0.35 });
    this.feel(L.fig, 'surprised', 1.4);
    yield* this.say('L07', L.fig, 0.2);
    // the two of them, laughing
    this.shot({ from: () => v3(VIEW.x + 0.4, 1.3, VIEW.z - 2.8), look: () => v3((L.pos.x + P.pos.x) / 2, 1.2, (L.pos.z + P.pos.z) / 2), fov: 44, dur: 3.4, hand: 0.4 });
    this.feel(P.fig, 'joy', 3);
    this.feel(L.fig, 'joy', 6);
    yield* this.say('D05', P.fig, 0.1);
    page.hold(L.fig, null, 'hug');
    yield 0.7;
    page.release();
    L.fig.lookAt = W0;
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    this.faceTo(L, WHEEL.x, WHEEL.z);
    // up there: a boy at his gondola's sill, waving, shouting down to his mother - and the camera
    // drawing back from him until the whole wheel is in it again
    const gi = this.lowGondola();
    this.heroRiders(gi);
    const kid = this.heroes[0];
    this.voices.bed(true, 1.2);
    this.shot({ from: () => this.gondolaCam(gi, -3.0, -2.25, -0.6), to: () => this.gondolaCam(gi, -17, -7.5, 4.5), look: () => this.headJ(kid) || this.gondolaAt(gi, -1.0, -2.3, -0.55), lookTo: () => this.gondolaAt(gi, 0, -4, 0), fov: 28, fovTo: 46, dur: 6.2, ease: 'inout', hand: 0.45 });
    yield 0.5;
    yield* this.say('K01', kid.fig, 0.9);
    yield* this.say('K02', null, 0.4);
    yield () => this.shots.t > 5.6;
    // a few seconds more of it: the two of them at the railing, the wheel turning against the sky
    this.voices.bed(true, 1.0);
    const wide = () => this.shot({ from: [VIEW.x - ux * 3.8 - uz * 0.6, 1.5, VIEW.z - uz * 3.8 + ux * 0.6], to: [VIEW.x - ux * 3.2 - uz * 0.55, 1.55, VIEW.z - uz * 3.2 + ux * 0.55], look: [WHEEL.x, 23.5, WHEEL.z], fov: 47, dur: 9, ease: 'lin', hand: 0.3 });
    wide();
    yield 2.0;
    // (a glance aside: a man going by, a mark on his bag - from Danny's own eyes, and gone)
    const bag = this.bagMan();
    this.shot({ from: this.head(P, 1.66), look: () => v3(bag.pos.x, bag.pos.y + 0.95, bag.pos.z), fov: 30, dur: 1.2, hand: 1 });
    P.fig.lookAt = bag.fig.j ? bag.fig.j.hip : null;
    yield 0.6;
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    wide();
    yield 1.4;
    // something under the evening's sounds that should not be there
    g.audio.play('dread', 1);
    yield 1.7;
    // and it is rubbed out
    g.audio.play('gone', 1);
    S.erase();
    // (the kids' voices going as they go)
    yield () => {
      const e = S.erasing;
      if (e && e.total) this.voices.bed(true, 1.0 * Math.max(0, 1 - (e.k || 0) * 1.15));
      return !S.erasing;
    };
    this.voices.bed(false);
    this.cue('stop', { fade: 0.02 });
    // (and at once nobody down there is waving up at anything)
    S.forget();
    yield 0.7;
    // he does not move
    this.feel(P.fig, 'surprised', 8);
    this.shot({ from: this.faceCam(P, 1.25, 0.3), to: this.faceCam(P, 1.1, 0.27), look: this.faceOf(P), fov: 30, dur: 2.3, hand: 0.25 });
    yield 2.0;
    this.feel(L.fig, 'scared', 8);
    L.fig.lookAt = P.fig.j.headC;
    this.faceTo(L, P.pos.x, P.pos.z);
    // (the two of them from the side, close: her face up to his)
    this.shot({ from: () => v3(VIEW.x + 0.6, 1.25, VIEW.z - 2.3), look: () => v3((L.pos.x * 2 + P.pos.x) / 3, 1.15, (L.pos.z * 2 + P.pos.z) / 3), fov: 36, dur: 2.6, hand: 0.4 });
    yield 0.4;
    yield* this.say('L08', L.fig, 0.7);
    // where it was: the evening - and the kids' voices, far off, coming back to him
    this.shot({ from: () => v3(P.pos.x, 1.72, P.pos.z), look: [WHEEL.x, 22, WHEEL.z], lookTo: [WHEEL.x, 25, WHEEL.z], fov: 44, fovTo: 40, dur: 3.6, hand: 0.2 });
    this.voices.memory(0.42);
    yield 3.4;
    this.start(4);
  }

  // Lily's drawing, the page itself in her hands (made ready with the rest: game/prologue/page.js)
  lilyPage() {
    if (!this.page) this.page = new HeldPage(this.game, this.sketch || (this.sketch = lilyDrawing()));
    return this.page;
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
    if (!S || S.wheelGone) {
      for (const c of this.heroes) this.game.civilians.remove(c);
      this.heroes = null;
      return;
    }
    // (rubbed out with their gondola: each of them as the eraser comes over them)
    if (S.erasing) {
      for (const c of this.heroes) {
        if (!c.gone && S.rubbedAt(c.pos) > 0.6) {
          c.gone = true;
          c.fig.setVisible(false);
        }
      }
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
      const hd = this.headJ(c);
      if (h.wave && hd) {
        // (a hand up, waving to somebody down on the pier)
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
    this.film(true);
    // nobody else: the parents walk off, the phone goes back in a pocket, the guys chat
    this.shot({ from: [86, 3.2, 247], to: [86.5, 3.4, 246], look: [104, 1.5, 243], fov: 50, dur: 3.2, hand: 0.5 });
    yield 3.0;
    // Danny, at the two guys by the railing
    const g1 = this.cast.g1;
    const g2 = this.cast.g2;
    const M = this.cast.man;
    this.putDanny(GUYS[0].x - 1.5, GUYS[0].z + 0.9, Math.atan2(1.5, -0.9));
    this.faceTo(g1, P.pos.x, P.pos.z);
    g1.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    g2.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
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
    M.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.shot({ from: this.ots(M, P), look: this.faceOf(P), fov: 42, dur: 4, hand: 0.7 });
    yield* this.say('D10', P.fig, 0.2);
    this.faceTo(M, WHEEL.x, WHEEL.z);
    M.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    yield 1.0;
    this.faceTo(M, P.pos.x, P.pos.z);
    M.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
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
    L.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.shot({ from: this.ots(P, L, { h: 1.45, back: 0.8, side: 0.45 }), look: this.faceOf(L), fov: 34, dur: 3, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    yield* this.say('L09', L.fig, 0.4);
    this.shot({ from: this.ots(L, P, { h: 1.05, back: 0.6, side: 0.3 }), look: this.faceOf(P), fov: 32, dur: 2.2, hand: 0.4 });
    this.feel(P.fig, 'sad', 4);
    yield* this.say('D11', P.fig, 0.5);
    // her drawing: she holds it up against where it stood - in it, it is still there
    const page = this.lilyPage();
    this.faceTo(L, WHEEL.x, WHEEL.z);
    L.fig.lookAt = page.at;
    page.hold(L.fig, null, 'read');
    this.shot({ from: this.ots(L, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { h: 0.95, back: 0.6, side: 0.3 }), look: () => v3(page.at.x + (WHEEL.x - L.pos.x) * 0.05, page.at.y + 0.5, page.at.z + (WHEEL.z - L.pos.z) * 0.05), fov: 44, dur: 3.2, hand: 0.35 });
    yield 2.0;
    // past it: nothing
    this.shot({ from: this.ots(L, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { h: 1.12, back: 0.55, side: 0.28 }), look: () => v3(page.at.x, page.at.y, page.at.z), lookTo: [WHEEL.x, 20, WHEEL.z], fov: 40, fovTo: 44, dur: 2.2, hand: 0.35 });
    L.fig.lookAt = v3(WHEEL.x, 24, WHEEL.z);
    yield 2.0;
    page.hold(L.fig, null, 'hug');
    this.faceTo(L, P.pos.x, P.pos.z);
    L.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
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
    yield* this.say('D12', P.fig, 0.6);
    // his hands over hers, on the page: keep it
    P.fig.reachL = page.at;
    P.fig.reachR = page.at;
    yield 0.6;
    yield* this.say('D13', P.fig, 0.4);
    yield* this.say('L11', L.fig, 0.5);
    yield* this.say('D14', P.fig, 0.6);
    P.fig.reachR = null;
    // his hand out to hers
    P.fig.reachL = L.fig.j ? L.fig.j.handR || null : null;
    yield* this.say('D15', P.fig, 0.4);
    P.fig.reachL = null;
    page.release();
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
    // the two men, their car at the curb of 5th Street, Danny's in its bay inside the garage
    this.spawnThugs();
    // the phone, half way there
    yield () => this.dist(GARAGE_IN.x, GARAGE_IN.z) < 90;
    this.phoneRing(true);
    yield 2.4;
    this.phoneRing(false);
    this.ui.call('live', 'BENNY');
    // (the phone out of his pocket and to his ear, walking on)
    P.fig.carry = 'phone';
    g.audio.play('click', 0.4);
    yield* this.say('P01', null, 0.3);
    yield* this.say('D16', P.fig, 0.3);
    yield* this.say('P02', null, 0.3);
    yield* this.say('D17', P.fig, 0.3);
    yield* this.say('P03', null, 0.4);
    this.ui.call('off');
    g.audio.play('click', 0.5);
    P.fig.carry = null;
    // the garage's door on 5th Street: the dark car at the curb, the two men by it - the same two from
    // here to the end: the one who talks (t1), the one beside him (t2)
    yield () => this.dist(GARAGE_IN.x, GARAGE_IN.z) < 15 || this.dist(THUGS[0].x, THUGS[0].z) < 16;
    const t1 = this.cast.t1;
    const t2 = this.cast.t2;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    this.cue('discovery');
    // (where it happens - game/prologue/carpark.js PARK: Danny stopped on the sidewalk between the way in
    // and the door, the two of them twelve metres off by their car, the sidewalk open between them;
    // Lily at his back)
    const D = PARK.dannyStop;
    const T = THUGS[0];
    const tx = T.x - D.x;
    const tz = T.z - D.z;
    const tl = Math.hypot(tx, tz) || 1;
    const ux = tx / tl;
    const uz = tz / tl;
    const a = Math.atan2(ux, uz);
    this.putDanny(D.x, D.z, a);
    this.put(L, D.x - ux * 1.1 - uz * 0.6, D.z - uz * 1.1 + ux * 0.6, a);
    L.pl.follow = false;
    const S1 = THUGS[0];
    const S2 = THUGS[1];
    this.put(t1, S1.x, S1.z, a + Math.PI);
    this.put(t2, S2.x, S2.z, a + Math.PI);
    for (const c of [t1, t2]) {
      c.downT = 0;
      c.upT = 0;
      c.fig.lookAt = P.fig.j.headC;
    }
    // over their shoulders: him and Lily, small, at the door of the car park - they have been waiting
    // for him
    this.shot({ from: () => v3(t1.pos.x + ux * 2.2 - uz * 1.1, 1.75, t1.pos.z + uz * 2.2 + ux * 1.1), look: () => v3(P.pos.x, 1.3, P.pos.z), fov: 40, dur: 3.6, hand: 0.5 });
    this.go(t1, S1.x - ux * 2.0, S1.z - uz * 2.0, 1.0);
    yield 0.5;
    yield* this.say('T01', t1.fig, 0.3);
    // he stops; puts her behind him
    this.put(L, P.pos.x - ux * 1.0 + uz * 0.25, P.pos.z - uz * 1.0 - ux * 0.25, a);
    L.fig.lookAt = t1.fig.j.headC;
    this.feel(L.fig, 'scared', 30);
    this.feel(P.fig, 'angry', 14);
    P.fig.lookAt = t1.fig.j.headC;
    // (from behind the two of them: Danny, Lily at his back - and the two men down the sidewalk)
    this.shot({ from: () => v3(P.pos.x - ux * 2.6 + uz * 0.9, 1.7, P.pos.z - uz * 2.6 - ux * 0.9), look: () => v3(t1.pos.x, 1.35, t1.pos.z), fov: 38, dur: 2.6, hand: 0.5 });
    yield* this.say('D18', P.fig, 0.3);
    this.shot({ from: () => v3(P.pos.x - ux * 0.9 + uz * 0.55, 1.68, P.pos.z - uz * 0.9 - ux * 0.55), look: this.faceOf(t1), fov: 26, dur: 3.2, hand: 0.5 });
    yield* this.say('T02', t1.fig, 0.25);
    this.shot({ from: () => v3(t1.pos.x + ux * 1.0 - uz * 0.5, 1.72, t1.pos.z + uz * 1.0 + ux * 0.5), look: this.faceOf(P), fov: 26, dur: 3, hand: 0.5 });
    yield* this.say('D19', P.fig, 0.25);
    // the other one moves out to the side - slowly, his hand inside his jacket (towards the curb: the
    // building's face is on the other side)
    this.go(t2, S2.x - ux * 1.5 + uz * 1.4, S2.z - uz * 1.5 - ux * 1.4, 0.8);
    this.shot({ from: () => v3(P.pos.x - ux * 1.6 + uz * 1.2, 1.5, P.pos.z - uz * 1.6 - ux * 1.2), look: () => v3((t1.pos.x + t2.pos.x) / 2, 1.4, (t1.pos.z + t2.pos.z) / 2), fov: 30, dur: 3.4, hand: 0.6 });
    yield* this.say('T03', t1.fig, 0.25);
    // wrong answer: the guns
    this.shot({ from: () => v3(t1.pos.x - ux * 1.5 + uz * 1.4, 1.05, t1.pos.z - uz * 1.5 - ux * 1.4), look: this.faceOf(t1), fov: 34, dur: 2.0, hand: 0.6 });
    this.armThug(t1, P);
    g.audio.play('click', 0.6);
    this.comic.impact(this.headJ(t1) || t1.pos, 0.1);
    yield 0.2;
    yield* this.say('T05', t1.fig, 0.05);
    this.armThug(t2, P);
    // him: the car, now
    this.shot({ from: this.faceCam(P, 1.4, 0.35), look: this.faceOf(P), fov: 34, dur: 1.6, hand: 0.8 });
    this.feel(P.fig, 'scared', 3);
    yield* this.say('D28', P.fig, 0.0);
    // they fire - from down the sidewalk, the shots going all round the two of them as they run in
    // through the way in and round to the car
    this.firing = { at: () => P.pos, t: 0.15 };
    this.feel(L.fig, 'scared', 10);
    const v = this.dannyCar;
    const run = PARK.dannyRun;
    // (Lily ahead of him, to the far door: round the car's nose)
    this.lilyRun = [[run[1][0] - 0.4, run[1][1] + 0.3], [run[2][0] + 0.2, run[2][1] - 1.5], [v.pos.x - 3.1, v.pos.z - 2.0], [v.pos.x - 0.4, v.pos.z - 1.75]];
    this.lilyRunI = 0;
    const lilyNext = () => {
      const q = this.lilyRun && this.lilyRun[this.lilyRunI];
      if (q) this.go(L, q[0], q[1], 4.4);
    };
    lilyNext();
    // (inside the car park looking out through the way in: the two of them coming in at a run, the
    // men's muzzle flashes out on the sidewalk beyond - drawn on twos, the speed lines in)
    // (from the aisle by the car's nose, west of it: the way in straight ahead, the two of them coming
    // in through it at a run and round to the car on the left, the men out on the sidewalk beyond)
    const inside = v3(v.pos.x - 6.4, 1.45, v.pos.z - 0.7);
    this.shot({ from: inside, to: v3(inside.x + 0.3, 1.35, inside.z + 0.9), look: () => v3((P.pos.x + L.pos.x) / 2, 1.0, (P.pos.z + L.pos.z) / 2), fov: 50, dur: 3.2, hand: 1, step: 12 });
    this.comic.lines(null, 1.6, 0.8);
    for (let i = 1; i < run.length; i++) {
      this.walkTo = { x: run[i][0], z: run[i][1], speed: 1, sprint: true };
      let t = 0;
      yield () => {
        t += this.dtR;
        // (Lily on along her own way, a point at a time)
        const q = this.lilyRun && this.lilyRun[this.lilyRunI];
        if (q && Math.hypot(L.pos.x - q[0], L.pos.z - q[1]) < 0.7 && this.lilyRunI < this.lilyRun.length - 1) {
          this.lilyRunI++;
          lilyNext();
        }
        return !this.walkTo || Math.hypot(P.pos.x - run[i][0], P.pos.z - run[i][1]) < 0.75 || t > 3.5;
      };
    }
    this.walkTo = null;
    // (and his feet off the pedal: the run's forward push must not carry into the car)
    this.auto = null;
    this.lilyRun = null;
    // in, and the engine
    g.enterVehicle(v);
    L.pl.ride = v;
    g.audio.play('roar', 1);
    // (from the way in, past the two men coming to it with their guns up: the car starting in its bay)
    this.go(t1, run[1][0] - 3.5, run[1][1] + 2.4, 2.2);
    this.go(t2, run[1][0] - 5.2, run[1][1] + 3.6, 2.2);
    this.shot({ from: () => v3(t1.pos.x - uz * 0.9 - ux * 1.2, 1.6, t1.pos.z + ux * 0.9 - uz * 1.2), look: () => v3(v.pos.x, 0.9, v.pos.z), fov: 42, dur: 2.2, hand: 1 });
    this.comic.word('VROOOM!', v3(v.pos.x, 1.4, v.pos.z), { fill: '#ff6f3a', burst: '#ffd23f', size: 0.1, life: 1.0 });
    yield 0.4;
    yield* this.say('T06', t2.fig, 0.1);
    // their car comes after them; the guns still going as they run back to it
    this.firing = null;
    this.disarmThug(t1);
    this.disarmThug(t2);
    this.cue('chase');
    this.startPursuit();
    this.check = { x: DANNY_CAR.x, y: DANNY_CAR.y + 0.05, z: DANNY_CAR.z, yaw: DANNY_CAR.yaw, back: { x: PARK.entrance.x, z: PARK.entrance.z + 4 } };
    this.film(false);
    g.camRig.yaw = v.yaw;
    this.objective('<b>Lose them</b> - up through the car park', PARK.route[1].x, PARK.route[1].z, 'Up');
    this.climb = true;
    this.climbI = -1;
    this.start(6);
  }

  // a man drawing his gun: his arm up and out at whoever (by), the gun in his hand drawn each frame
  armThug(c, by) {
    const G = this.gunmen || (this.gunmen = []);
    if (!G.find((q) => q.c === c)) G.push({ c, by, t: 0, next: 0.3 + Math.random() * 0.4 });
  }

  disarmThug(c) {
    if (!this.gunmen) return;
    this.gunmen = this.gunmen.filter((q) => q.c !== c);
    if (c.fig) {
      c.fig.aim = 0;
      c.fig.aimYaw = 0;
      c.fig.aimPitch = 0;
    }
  }

  // every frame: the guns in their hands, aimed; and while they fire, the shots - a flash at the
  // muzzle, the crack carried over the floor, the bullet's hit near the two of them (never on them):
  // sparks off the concrete, a car's window
  tickGuns(dt) {
    const G = this.gunmen;
    if (!G || !G.length) return;
    const g = this.game;
    const fr = g.figures;
    for (const q of G) {
      const f = q.c.fig;
      if (!f || !f.j || !q.c.alive) continue;
      const B = q.by.pos || q.by;
      const yaw = Math.atan2(B.x - q.c.pos.x, B.z - q.c.pos.z);
      f.aim = 1;
      let dy = yaw - f.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      f.aimYaw = dy;
      f.aimPitch = Math.atan2((B.y || 0) + 1.0 - f.j.handR.y, Math.hypot(B.x - q.c.pos.x, B.z - q.c.pos.z));
      const h = f.j.handR;
      const d = f.aimDir;
      if (fr && h.lengthSq() > 0) {
        // (a pistol: its slide along the aim, its grip down in the hand)
        fr.lineXYZ(h.x - d.x * 0.03, h.y - d.y * 0.03 + 0.025, h.z - d.z * 0.03, h.x + d.x * 0.2, h.y + d.y * 0.2 + 0.025, h.z + d.z * 0.2, [0.06, 0.06, 0.08], 6, 900 + q.c.id, 1, 0.004, 0);
        fr.lineXYZ(h.x, h.y + 0.02, h.z, h.x - d.x * 0.02, h.y - 0.1, h.z - d.z * 0.02, [0.06, 0.06, 0.08], 5, 901 + q.c.id, 1, 0.004, 0);
      }
      if (!this.firing) continue;
      q.next -= dt;
      if (q.next > 0) continue;
      q.next = 0.38 + Math.random() * 0.55;
      const mx = h.x + d.x * 0.24;
      const my = h.y + d.y * 0.24 + 0.025;
      const mz = h.z + d.z * 0.24;
      if (g.fx) {
        g.fx.muzzle(mx, my, mz, 0.8);
        g.fx.flash(mx, my, mz, 1.6);
      }
      const cam = g.camera.position;
      const far = Math.hypot(mx - cam.x, mz - cam.z);
      g.audio.play('pistol', Math.max(0.25, Math.min(1, 9 / Math.max(3, far))));
      this.bangs = (this.bangs || 0) + 1;
      if (this.bangs <= 3 && this.comic) this.comic.word(this.bangs === 2 ? 'BLAM!' : 'BANG!', v3(mx, my + 0.3, mz), { fill: '#fff4d6', burst: '#ff3b4f', size: 0.075, life: 0.55 });
      // where it goes: a metre or three wide of them, low
      const at = this.firing.at();
      const ang = Math.random() * Math.PI * 2;
      const r = 1.1 + Math.random() * 2;
      const hx = at.x + Math.cos(ang) * r;
      const hz = at.z + Math.sin(ang) * r;
      const v = this.dannyCar;
      const nearCar = v && Math.hypot(hx - v.pos.x, hz - v.pos.z) < 2.6 && Math.random() < 0.45;
      const hy = nearCar ? 1.1 + Math.random() * 0.3 : 0.05 + Math.random() * 0.2;
      if (g.fx) {
        g.fx.sparks(hx, hy, hz, 7, [1, 0.85, 0.45]);
        g.fx.impact(hx, hy, hz, 0.7);
        if (!nearCar) g.fx.crumbs(hx, hy, hz, 6, 2.2, true);
      }
      g.audio.play(nearCar ? 'glass' : 'ricochet', nearCar ? 0.35 : 0.6);
    }
  }

  spawnThugs() {
    const g = this.game;
    if (!this.thugCar) {
      // (at the curb, its nose to the way in: they mean to follow him in)
      this.thugCar = g.vehicles.spawnStock({ kind: 'sedan', color: DARK }, { x: THUG_CAR.x, z: THUG_CAR.z }, Math.PI / 2);
      this.thugCar.kept = true;
      this.thugCar.pos.y = 0.15;
    }
    if (!this.dannyCar) {
      this.dannyCar = g.vehicles.spawnStock({ kind: 'muscle', color: [0.58, 0.1, 0.12] }, { x: DANNY_CAR.x, z: DANNY_CAR.z }, DANNY_CAR.yaw);
      this.dannyCar.kept = true;
      this.dannyCar.pos.y = DANNY_CAR.y;
    }
    if (!this.cast.t1) {
      const lk = () => civilianLook({ fem: false, kind: 'street' });
      this.person('t1', THUGS[0].x, THUGS[0].z, lk(), { face: PARK.thugsFace });
      this.person('t2', THUGS[1].x, THUGS[1].z, lk(), { face: PARK.thugsFace });
    }
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
    // (along the curb to the way in, and in after him)
    const E = PARK.entrance;
    P.seed([[THUG_CAR.x + 4, 0.17, THUG_CAR.z - 0.4], [E.x - 3, 0.17, E.z + 4.2], [E.x, 0.17, E.z + 0.8], [E.x, 0.17, E.z - 7]]);
    P.keep = 10;
    this.pursuers = [P];
    this.pursuer = P;
  }

  // ------------------------------------------------------------------ 6. THE CAR PARK
  *s6() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const v = () => P.inVehicle;
    const lvOf = (c) => {
      const lv = c ? PARK.levelAt(c.pos.x, c.pos.z, c.pos.y + 0.3) : null;
      return lv === null || lv >= 10 ? -1 : lv;
    };
    yield 2.2;
    yield* this.say('L12', L.fig, 0.25);
    yield* this.say('D20', P.fig, 0.25);
    yield* this.say('L13', L.fig, 0.2);
    yield* this.say('D21', P.fig, 0.3);
    // up and up: the way up has no way out but the roof - half way, the dark car still on them
    yield () => lvOf(v()) >= 2.4;
    yield* this.say('D22', P.fig, 0.2);
    // the roof run: the west half's top floor, open to the sky, heading south to the edge
    yield () => {
      const c = v();
      return !!c && lvOf(c) >= 4.9 && c.pos.x < PARK.main.xc && c.pos.z > RUNUP.z + 6;
    };
    this.climb = false;
    this.start(7);
  }

  // ------------------------------------------------------------------ 7. THE FIRST DRAWING
  *s7() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const v = () => P.inVehicle;
    const Pu = this.pursuer;
    // a hundred metres straight to the edge, the sky over it, 5th Street under it and Bayshore's roof
    // across; the dark car on the turn behind them - and the one in it with the gun out of its window
    this.objective('<b>Floor it!</b>', PARK.edge.x, PARK.edge.z, 'Edge');
    if (g.gps) g.gps.clear();
    if (Pu) Pu.keep = 5;
    this.gunman = this.cast.t2 || null;
    this.shooting = true;
    this.everyFrame = (dt) => this.gunfire(dt);
    this.check = { x: RUNUP.x, y: RUNUP.y + 0.05, z: RUNUP.z + 6, yaw: RUNUP.yaw, back: { x: PARK.main.xc - 4, z: RUNUP.z - 2 } };
    yield* this.say('L14', L.fig, 0.2);
    // sixty metres short of the edge: time all but stops
    yield () => {
      const c = v();
      return !!c && c.pos.z > PARK.edge.z - 62 && c.pos.x < PARK.main.xc;
    };
    const car = v();
    this.shooting = false;
    this.objective(null);
    this.cue('slowmo');
    // (all but stopped: the car still going, a few centimetres a second - nothing to drift from under
    // the camera while the line is drawn)
    this.slow(0.015, 8);
    g.audio.play('whoosh', 0.75);
    this.ui.vignette(true);
    this.film(true);
    // Danny's eyes on the edge, the roof across the street: an idea. A crazy one
    P.fig.lookAt = v3(PARK.land.x, PARK.land.y, PARK.land.z);
    this.shot({ from: this.inCar(car, 0.02, 1.2, 0.5), look: this.faceOf(P), fov: 44, dur: 1.6, hand: 0.25 });
    yield 1.5;
    // the camera pulls back out of his window, round behind the car and up - to where the game's own
    // camera is, behind it, looking down the roof to its edge - and from there it is the player's: the
    // black bars go, and the first drawing of the game is drawn the way every drawing in it is: on
    // the live picture, from where the player is, over the roof ahead
    const rig = g.camRig;
    rig.yaw = car.yaw;
    rig.pitch = DRAW_PITCH;
    rig.curDist = 8.5;
    rig.curLift = 0;
    rig.curShoulder = 0;
    rig.update(0, car.pos, { dist: 8.5, height: 3.1, shoulder: 0 });
    const gp = g.camera.position.clone();
    const cp = Math.cos(DRAW_PITCH);
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const gl = gp.clone().add(v3(fx * cp * 30, Math.sin(DRAW_PITCH) * 30, fz * cp * 30));
    // (the car's left, Danny's side: (fz, -fx))
    const at = (side, along, up) => v3(car.pos.x + fx * along + fz * side, car.pos.y + up, car.pos.z + fz * along - fx * side);
    this.shot({
      path: [this.shots.lastPos.clone(), at(3.0, -0.4, 1.9), at(2.6, -5.2, 4.2), gp],
      lookPath: [this.shots.lastLook.clone(), at(0.2, 4, 1.2), at(0, 16, 0.8), gl],
      fov: this.shots.lastFov,
      fovTo: rig.baseFov,
      dur: 2.6,
      ease: 'inout',
      hand: 0.12,
    });
    yield 2.6;
    // the player's: the game's camera (exactly where the shot left it), the bars away, the screen to
    // draw on - the roof's own way, along -x in its frame
    this.shots.release();
    this.holdCam = false;
    this.drawing = true;
    this.ui.film(false);
    g.hud.show();
    rig.yaw = car.yaw;
    rig.pitch = DRAW_PITCH;
    const [cx, cz] = loc(car.pos.x, car.pos.z);
    this.draw = new RampDraw(g, this.ui);
    let prof = null;
    this.draw.open({ camera: g.camera, roofY: ROOF, laneZ: cz, carX: cx, edgeX: RUNF.edgeX, frame: RUNF, floorY: (x, z) => PARK.floorAt(x, z, ROOF + 2) }, (p) => {
      prof = p;
    });
    g.audio.play('pageflip', 0.5);
    // (a heart in the slowed time while the line is drawn)
    let beat = 0.3;
    yield () => {
      beat -= this.dtR || 0.016;
      if (beat <= 0) {
        beat = 1.05;
        g.audio.play('heartbeat', 0.9);
      }
      return !!prof;
    };
    this.drawing = false;
    g.audio.play('scribble', 0.8);
    // the film again: the line lies down on the roof, and grows into the ramp while the camera swings
    // round it - up off the roof, along its side as it goes up, out past its lip over the street, and
    // round to look back up it at the car (the points in the run's frame: wld)
    this.film(true);
    this.ramp = new Ramp(g, prof);
    PARK.extra.push(this.ramp);
    this.draw.settleTo(this.ramp.inkLine());
    const R = prof;
    const Y = ROOF;
    const S = R.startX;
    const Lp = R.lipX;
    const rz = R.z;
    const H = R.h;
    const mid = (S + Lp) / 2;
    const cam = g.camera;
    const c0 = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    // (round its side in the low sun and out past its lip over the street: the whole of it from there,
    // the lip near, the car small at the far end of the roof)
    this.shot({
      path: [c0, wld(S + 5, Y + 5.6, rz - 6), wld(mid + 3, Y + 3.0, rz - 11.5), wld(Lp + 1, Y + 2.6, rz - 12.5), wld(Lp - 6.5, Y + H + 0.6, rz - 10.5)],
      lookPath: [c0.clone().addScaledVector(dir, 25), wld(S - 3, Y + 0.8, rz), wld(mid, Y + H * 0.4, rz), wld(Lp + 3, Y + H * 0.75, rz), wld(mid + 4, Y + H * 0.45, rz + 0.5)],
      arc: true,
      fov: cam.fov,
      fovTo: 48,
      dur: 6.2,
      ease: 'swoop',
      hand: 0.12,
    });
    yield () => this.ramp.grown;
    g.audio.play('magic', 0.7);
    yield () => this.shots.done;
    yield 0.3;
    // back with them in the car, the time still held: Lily, at her open window, staring at what is in
    // front of them; Danny, his hands on the wheel
    L.fig.lookAt = this.headJ(P);
    this.shot({ from: this.inCar(car, -0.02, 1.14, 0.52), look: this.faceOf(L), fov: 50, dur: 2.4, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    yield* this.say('L15', L.fig, 0.2);
    this.shot({ from: this.inCar(car, -0.04, 1.2, 0.5), look: this.faceOf(P), fov: 46, dur: 2.0, hand: 0.35 });
    this.feel(P.fig, 'angry', 4);
    yield* this.say('D23', P.fig, 0.1);
    P.fig.lookAt = null;
    // the engine; the time its own again; the player's foot on it, all the way to the lip
    this.cue('chase', { heat: 1 });
    g.audio.play('roar', 1);
    this.slow(1, 2.5);
    this.ui.vignette(false);
    this.film(false);
    g.camRig.yaw = car.yaw;
    this.objective('<b>Floor it!</b> - up the ramp');
    if (Pu) {
      Pu.paused = false;
      Pu.keep = 6;
    }
    this.shooting = true;
    this.check = { x: RUNUP.x, y: RUNUP.y + 0.05, z: RUNUP.z + 6, yaw: RUNUP.yaw, minY: ROOF - 3.5, back: { x: PARK.main.xc - 4, z: RUNUP.z - 2 } };
    this.start(8);
  }

  // the man in the dark car shooting after them (wide: they are only meant to hurry)
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
    if (g.fx) g.fx.sparks(x, v.pos.y + 0.1, z, 6, [1, 0.85, 0.4]);
  }

  // ------------------------------------------------------------------ 8. THE JUMP
  *s8() {
    const g = this.game;
    const P = g.player;
    const v = () => P.inVehicle;
    const prof = this.ramp.P;
    // up the ramp, over its lip: flown from here (along -x in the run's frame)
    yield () => v() && loc(v().pos.x, v().pos.z)[0] < prof.lipX + 0.6 && v().pos.y > ROOF + prof.h * 0.6;
    this.objective(null);
    this.shooting = false;
    const car = v();
    const J = new Jump(g, car, prof, LAND);
    this.jump = J;
    // (the dark car behind: on its brakes, stopped on the roof short of the ramp)
    const Pc = this.pursuer && this.pursuer.car;
    if (Pc) {
      Pc.vx *= 0.3;
      Pc.vz *= 0.3;
      Pc.speed = (Pc.speed || 0) * 0.3;
    }
    // (a point a way off from the car, by the run's frame: along it, across it, up)
    const off = (c, along, side, up) => {
      const [dx, dz] = RUNF.toWorld(along, side);
      return v3(c.pos.x + dx, c.pos.y + up, c.pos.z + dz);
    };
    // (off the lip: the picture struck for an instant, then the air streaming past)
    this.comic.impact(car.pos, 0.09);
    this.comic.lines(null, 1.4, 1);
    if (this.pursuer) this.pursuer.paused = true;
    this.film(true);
    // the rear three-quarters of it leaving the lip, then wide as it hangs over the street
    this.shot({ from: () => off(car, 7, 5, 1.2), look: () => v3(car.pos.x, car.pos.y + 0.6, car.pos.z), fov: 50, dur: 1.2, hand: 0.4 });
    yield () => J.apex;
    // the top of the arc: time nearly still; the title in the picture
    this.slow(0.035, 9);
    this.cue('title');
    // (the camera swings out from behind its rear quarter to its side, low over the street - the car
    // in the top half of the picture against the towers and the sunset, the title under it)
    const c0 = { pos: car.pos.clone() };
    this.shot({
      path: [off(c0, 4.5, 3.5, 0.6), off(c0, 1.5, 9, -1.2), off(c0, -3, 14, -3.2)],
      look: () => off(car, -1.5, 0, -2.2),
      fov: 44,
      fovTo: 54,
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
    this.shot({ from: () => off(car, 9, 7, 3.5), look: () => v3(PARK.land.x, PARK.land.y, PARK.land.z + 4), fov: 52, dur: 2.2, hand: 0.6 });
    yield () => J.done;
    // down: hard
    g.camRig.addShake(1.1);
    g.audio.play('crash', 1);
    g.audio.play('skid', 1);
    this.comic.impact(car.pos, 0.1);
    this.comic.word('CRASH!', v3(car.pos.x, car.pos.y + 1.6, car.pos.z), { fill: '#ffd23f', burst: '#ff4f6a', size: 0.11, life: 0.9 });
    this.comic.word('SKRRRT', off(car, 3, 1, 0.6), { fill: '#fff4d6', burst: '#3fc6c0', size: 0.06, life: 1.1, tilt: -0.2 });
    if (g.fx) {
      for (let i = 0; i < 4; i++) g.fx.sparks(car.pos.x + (Math.random() - 0.5) * 3, car.pos.y + 0.2, car.pos.z + (Math.random() - 0.5) * 2, 12, [1, 0.8, 0.35]);
      g.fx.smoke(car.pos.x, car.pos.y + 0.4, car.pos.z, 2.4);
    }
    // it slews round, the tyres screaming, scrubbing off its speed; he fights it (sideways: across the
    // run, in its frame)
    {
      const [sx, sz] = RUNF.toWorld(0, 3);
      car.vx = car.vx * 0.3 + sx;
      car.vz = car.vz * 0.3 + sz;
    }
    car.yawRate = (car.yawRate || 0) + 1.2;
    this.shot({ from: () => off(car, -6, -7, 2.2), look: () => v3(car.pos.x, car.pos.y + 0.5, car.pos.z), fov: 48, dur: 1.4, hand: 1 });
    yield 1.2;
    this.film(false);
    g.camRig.yaw = car.yaw;
    this.objective('Get down to the <b>street</b>', PARK.down[0].x, PARK.down[0].z, 'Street');
    this.descend = true;
    this.downI = -1;
    this.check = { x: PARK.land.x, y: PARK.land.y + 0.05, z: PARK.land.z, yaw: 0 };
    this.hour(18.62, 0.004);
    this.start(9);
  }

  // ------------------------------------------------------------------ 9. AWAY, AND QUIET
  *s9() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const v = () => P.inVehicle;
    // down Bayshore's ramps; on its street floor - the dark car comes round the block onto 5th Street
    if (this.pursuer) this.pursuer.paused = true;
    yield () => {
      const c = v();
      const lv = c ? PARK.levelAt(c.pos.x, c.pos.z, c.pos.y + 0.3) : null;
      return !!c && ((lv !== null && lv >= 10 && lv < 10.5) || c.pos.y < 1);
    };
    const b = this.thugCar;
    if (b && !b.dead) {
      // (they came down the other way and round: on 5th Street west of the gate, coming east)
      b.pos.set(PARK.landing.x0 + 14, 0.15, PARK.landing.z0 - 6.5);
      b.yaw = Math.PI / 2;
      b.vx = b.vz = 0;
      b.speed = 0;
      const Q = this.pursuer && this.pursuer.car === b ? this.pursuer : new Pursuer(g, b, v());
      Q.prey = v();
      Q.paused = false;
      Q.keep = 5;
      Q.trail.length = 0;
      Q.i = 0;
      const G = PARK.down[PARK.down.length - 1];
      Q.seed([[b.pos.x, 0.15, b.pos.z], [G.x - 6, 0.15, G.z - 1.5], [G.x, 0.15, G.z]]);
      this.pursuers = [Q];
      this.pursuer = Q;
    }
    yield () => v() && v().pos.y < 1 && v().pos.z < PARK.landing.z0 - 1;
    this.descend = false;
    this.objective('<b>Lose them</b>', LOOKOUT.x, LOOKOUT.z, 'Beach');
    this.check = { x: PARK.down[PARK.down.length - 1].x, y: 0.15, z: PARK.down[PARK.down.length - 1].z - 1, yaw: Math.PI / 2 };
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
    this.shot({ from: this.carSide(car, 1, 2.3, 1.85, 1.0), look: this.cabin(car, 0.95), fov: 42, dur: 30, hand: 0.35 });
    yield 2.4;
    this.feel(L.fig, 'angry', 6);
    yield* this.say('L16', L.fig, 1.3);
    this.feel(P.fig, 'sad', 10);
    yield* this.say('D24', P.fig, 0.6);
    this.feel(L.fig, 'sad', 10);
    yield* this.say('L17', L.fig, 0.5);
    yield* this.say('D25', P.fig, 0.6);
    // her drawing on her knees: she looks at it
    const page = this.lilyPage();
    page.hold(L.fig, null, 'read');
    L.fig.lookAt = page.at;
    yield 1.4;
    yield* this.say('L18', L.fig, 0.4);
    yield 0.6;
    L.fig.lookAt = P.fig.j.headC;
    yield* this.say('D26', P.fig, 0.3);
    page.hold(L.fig, null, 'hug');
    L.fig.lookAt = null;
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
    this.drawing = false;
    if (this.acting) this.acting.clear();
    if (this.comic) this.comic.clear();
    if (this.page) {
      this.page.dispose();
      this.page = null;
    }
    if (this.draw && this.draw.on) this.draw.close();
    this.ui.vignette(false);
    for (const p of this.pursuers || []) p.dispose();
    this.pursuers = [];
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
