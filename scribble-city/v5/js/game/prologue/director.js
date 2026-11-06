import * as THREE from 'three';
import { PrologueUI, lilyDrawing, lilyParts } from './ui.js';
import { PrologueVoices } from './voice.js';
import { Shots } from './shots.js';
import { LINES } from './lines.js';
import { WHEEL, STAND, PARK } from './set.js';
import { Pursuer } from './chase.js';
import { RampDraw, Ramp, Jump, Flight, rampH } from './ramp.js';
import { PaintFight } from './paintfight.js';
import { HeldPage } from './page.js';
import { Acting, ACTS } from './acting.js';
import { Comic } from './comic.js';
import { civilianLook, kidLook, roleLook } from '../looks.js';
import { Doodle } from '../doodle.js';
import { Soundscape, airAt } from './soundscape.js';
import { loadTrack, trackBuf, Looper } from './tracks.js';
import { howto as howtoCard } from './howto.js';
import { shared } from '../../render/materials.js';
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

// (on for every new game once all of it is checked through; till then only with ?prologue=1 - on
// since round 13, the player's word: a new game opens with it, the flight in and the how-to)
export const PROLOGUE_ON = true;
// (a working title, until the name is chosen)
export const GAME_TITLE = 'OUTLINE';
// (who made it, under the name - in the player's own language, as the rest of what is put over the
// picture is)
export const CREDIT = 'יוצר: אמיתי דהן';
// (v2, round 13: the prologue told again to everyone who has seen it - it is a new film since; and
// watched in the admin's viewer it never counts as seen: finish)
const DONE_KEY = 'scribble.prologue.v2';
const _pv = new THREE.Vector3();

// the places
const DANNY0 = { x: 17, z: 6, yaw: Math.PI };
const LILY_SEAT = { x: 40.2, z: 233.0, yaw: Math.PI / 2 };
const VIEW = { x: 63.5, z: 238.9 };
// (ROADMAP 18.9: where the wheel stood - its gate on the pier - and the people there who will not
// remember it: scene 4 is asked there)
const SITE = { x: 101.5, z: 242.6 };
const GUYS = [
  { x: 103.0, z: 237.15 },
  { x: 104.3, z: 237.1 },
];
const MAN = { x: 99.2, z: 246.9 };
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

// (round 14) where each stroke begins in a recording of rubbing: the peaks of its loudness, 10 ms at a
// time, at least 60 ms apart and over 45% of the loudest
function strokesOf(b) {
  const d = b.getChannelData(0);
  const W = Math.max(1, Math.round(b.sampleRate / 100));
  const env = [];
  for (let i = 0; i + W < d.length; i += W) {
    let q = 0;
    for (let k = i; k < i + W; k++) q += d[k] * d[k];
    env.push(Math.sqrt(q / W));
  }
  let mx = 0;
  for (const v of env) mx = Math.max(mx, v);
  const out = [];
  for (let i = 3; i < env.length - 3; i++) {
    let top = true;
    for (let k = i - 3; k <= i + 3; k++) if (env[k] > env[i]) top = false;
    if (top && env[i] > 0.45 * mx && (!out.length || i * 0.01 - out[out.length - 1] > 0.06)) out.push(i * 0.01);
  }
  return out;
}

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
    // (the admin's film viewer - ui/admin.js: a scene chosen, and played by itself if asked)
    this.autopilot = null;
    this.wantAuto = false;
    this.objKey = '';
    // (ROADMAP 18.9) the film's look: painted behind its people (render/pipeline.js PAINT_FRAG), its
    // people on twos (game/doodle.js) - ?paint=0, ?twos=0 without them
    this.paintOn = !(P && P.get('paint') === '0');
    this.twosOn = !(P && P.get('twos') === '0');
    // (?look=0: the painted look without the film's light and colour - to compare the two)
    this.lookOn = !(P && P.get('look') === '0');
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
    // (ROADMAP 18.9: everything the pen can make open while it is told - a helicopter, wings, a turbo
    // on the car, every weapon - whatever the settings say: the game's own again after, finish)
    if (g.setAllOpen) g.setAllOpen(true);
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
    // (watched again by its maker after it was played: the wheel back up for the scenes it is in)
    const S = this.set;
    if (this.admin && S && S.wheelGone && S.buildWheel && !(m && +m[1] >= 4)) {
      S.wheelGone = false;
      S.buildWheel();
    }
    if (this.wantAuto) {
      import('./autopilot.js')
        .then((am) => {
          if (this.active) this.autopilot = new am.Autopilot(this);
        })
        .catch(() => {});
    }
    if (m && +m[1] > 1) {
      this.co = this.prep(+m[1]);
      this.wait = 0;
    } else {
      // (from black: the first moments of a new game make the street's people, begin the shops'
      // insides near him, send the film's pieces up to the graphics card - a few heavy frames,
      // behind black; then the evening fades in, s1)
      this.ui.black();
      this.start(1);
    }
  }

  // (for a test from the middle: what the scenes before it would have left)
  *prep(n) {
    const g = this.game;
    yield () => this.castReady;
    this.spawnLily();
    const L = this.cast.lily;
    L.fig.sit = 0;
    this.repose(L);
    L.baseY = 0;
    if (n >= 4) {
      this.spawnPier();
      if (this.set) this.set.removeWheel();
      // (round 14: and the people who were under it gone on their way along the pier, as they have in
      // the film by now - started here, they stood waving at the empty sky, one of them across every
      // single of Danny's scene: set.js forget)
      const S = this.set;
      if (S && S.forget) {
        S.forget();
        for (const b of S.below || []) {
          if (!b.walkTo) continue;
          b.x = b.walkTo.x;
          b.z = b.walkTo.z;
          b.speed = 0;
          b.walkDelay = 0;
        }
      }
    }
    if (n >= 4 && n < 5) {
      this.putDanny(SITE.x + 1.5, SITE.z + 0.9, Math.atan2(WHEEL.x - SITE.x, WHEEL.z - SITE.z));
      this.put(L, SITE.x, SITE.z, Math.atan2(WHEEL.x - SITE.x, WHEEL.z - SITE.z));
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
    this.sketching = false;
    this.sceneAt = this.clock || 0;
    // (round 13: the world never left muffled - searchMontage - into a scene after it)
    if (this.muffled && this.game.audio.muffle) {
      this.game.audio.muffle(false);
      this.muffled = false;
    }
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
    if (this.autopilot) this.autopilot.tick(this.dtR || 0.016);
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
    // (ROADMAP 18.9: the drawing is his from the start - the trial's players are to have all of it -
    // in the player's own hands; in the film, the keys wait as all the others do, above)
    // (out of the car whenever he likes before the chase - the city is his, and Lily is met on foot;
    // in the chase, only when the story says)
    if (this.game.player.inVehicle && (this.sceneN || 0) >= 5) input.pressed.delete('KeyE');
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
      if ((this.hidden && this.hidden.size) || this.hidP || (this.emoteHid && this.emoteHid.size)) this.unhide();
      return false;
    }
    // (round 14: a split screen's panels, each its own camera - the frames dealt out to them in turn,
    // each panel drawn every third: cyclePanels)
    const C = this.cycle;
    if (C) {
      const pg = this.comic && this.comic.pg;
      const live = C.on.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (pg && live.length) {
        C.k = live[(live.indexOf(C.k) + 1) % live.length] ?? live[0];
        const S = C.S[C.k];
        S.update(dt * live.length);
        pg.cur = C.k;
        this.activeShots = S;
        this.clearLens();
        return true;
      }
    }
    const on = this.shots.update(dt);
    if (on) this.clearLens();
    return on;
  }

  // (round 14) a split screen: its cameras, one a panel (the comic's page already up) - each its own
  // shot, on its own clock
  cyclePanels(specs) {
    this.cycle = { S: specs.map((sp) => { const s = new Shots(this.game); s.cut(sp); return s; }), k: -1, on: specs.map(() => false) };
  }

  // (after the game's own camera has been put where it wants to be this frame: from the film's
  // last picture to there, eased - the nearer and the less turned, the quicker; a long way off,
  // a cut. game/game.js calls it after the camera rig.)
  blendCam(dt) {
    const B = this.blend;
    if (!B) return;
    if (this.holdCam || !this.active) {
      this.blend = null;
      return;
    }
    const cam = this.game.camera;
    if (B.dur === undefined) {
      const d = B.pos.distanceTo(cam.position);
      const a = B.q.angleTo(cam.quaternion);
      B.dur = d > 28 ? 0 : clamp(0.6 + d * 0.04 + a * 0.3, 0.6, 1.5);
    }
    B.t += dt;
    if (B.t >= B.dur) {
      this.blend = null;
      return;
    }
    const u = B.t / B.dur;
    const k = u * u * u * (u * (u * 6 - 15) + 10);
    const gp = this._bp || (this._bp = new THREE.Vector3());
    const gq = this._bq || (this._bq = new THREE.Quaternion());
    gp.copy(cam.position);
    gq.copy(cam.quaternion);
    // (round him, not through him: from the film's picture of his face to the game's behind his back
    // the straight way went through his head - ROADMAP 18.9. Round the middle of him instead: the
    // distance out from him, the height, and the angle round him each eased on its own, the shorter
    // way round)
    const P = this.game.player;
    const H = this._bh || (this._bh = new THREE.Vector3());
    H.set(P.pos.x, P.pos.y + 1.2, P.pos.z);
    const ax = B.pos.x - H.x;
    const az = B.pos.z - H.z;
    const bx = gp.x - H.x;
    const bz = gp.z - H.z;
    const ra = Math.hypot(ax, az);
    const rb = Math.hypot(bx, bz);
    if (ra > 0.2 && rb > 0.2 && ra < 12 && rb < 12) {
      const a0 = Math.atan2(az, ax);
      let da = Math.atan2(bz, bx) - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const r = Math.max(ra + (rb - ra) * k, 0.9);
      const a = a0 + da * k;
      cam.position.set(H.x + Math.cos(a) * r, B.pos.y + (gp.y - B.pos.y) * k, H.z + Math.sin(a) * r);
    } else cam.position.lerpVectors(B.pos, gp, k);
    cam.quaternion.slerpQuaternions(B.q, gq, k);
    const f = B.fov + (cam.fov - B.fov) * k;
    if (Math.abs(f - cam.fov) > 0.01) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }

  // nobody walking right up against the lens in a shot: a passer-by too close to the camera is
  // left out of the picture until they have gone by (the prologue's own people never)
  clearLens() {
    const g = this.game;
    const cam = g.camera;
    const cp = cam.position;
    const H = this.hidden || (this.hidden = new Set());
    const keyOf = this._keyOf || (this._keyOf = new Map());
    keyOf.clear();
    for (const k in this.cast) keyOf.set(this.cast[k], k);
    // (ROADMAP 18.9: and nobody of the city's between the camera and whoever the shot is on - a
    // passer-by on his phone across half of the thugs' scene: from the camera to well short of its
    // subject, in front of it, out of the picture until they are past)
    const S = this.activeShots || this.shots;
    const fx = S.lastLook.x - cp.x;
    const fz = S.lastLook.z - cp.z;
    const fd = Math.hypot(fx, fz) || 1;
    const reach = Math.min(4.5, Math.max(2.2, fd * 0.8));
    // (round 14) and the picture itself: nobody who is not one of the story's walking in front of
    // whoever the shot is on anywhere across it, and in a close shot nobody just beside or behind them
    // either (a passer-by's white torso over a third of her close-up, a woman in red across the two of
    // them at the railing) - the pier's own groups and strollers too; in a moment's colour (emote, its
    // keep) nobody in it but whose moment it is: the field held only her, not the crowd lit in it
    const fd3 = S.lastLook.distanceTo(cp);
    const close = fd3 < 4.2;
    // (round 14: a shot whose people are its point - the evening going on, him among them: crowd)
    const crowdShot = !!(S.shot && S.shot.crowd);
    const keep = this.emoteWant && this.emoteKeep ? this.emoteKeep : null;
    cam.updateMatrixWorld();
    const inPic = (c, m) => {
      _pv.set(c.pos.x, c.pos.y + 1.1, c.pos.z).applyMatrix4(cam.matrixWorldInverse);
      if (_pv.z > -0.15) return false;
      _pv.applyMatrix4(cam.projectionMatrix);
      return Math.abs(_pv.x) < m && Math.abs(_pv.y) < m + 0.25;
    };
    for (const c of g.civilians.list) {
      if (!c.alive) continue;
      const key = keyOf.get(c);
      const extra = !key || /^(eve|grp|tour)/.test(key);
      const star = !extra || !!c.star || !!(this.heroes && this.heroes.includes(c));
      const dx = c.pos.x - cp.x;
      const dz = c.pos.z - cp.z;
      const d = Math.hypot(dx, dz);
      const m = H.has(c) ? 1.5 : 1.3;
      let inWay = false;
      let why = 0;
      if (keep && !keep.has(c) && inPic(c, m)) {
        inWay = true;
        why = 1;
      } else if (!star && crowdShot) {
        inWay = d < 0.9;
      } else if (!star) {
        const ahead = (dx * fx + dz * fz) / (fd * (d || 1));
        inWay = d < 2.2 || (d < reach && ahead > 0.55);
        // (in front of the subject only where they would be big in the picture - near the camera: a
        // far shot's crowd is its point, the group he goes into, the evening going on)
        if (!inWay && ((d < fd3 - 0.4 && d < 6) || (close && d < fd3 + 1.6)) && inPic(c, m)) {
          inWay = true;
          why = 1;
        }
      }
      if (inWay && !H.has(c)) {
        c.fig.filmHide = true;
        c._hidWhy = why;
        H.add(c);
      } else if (!inWay && H.has(c) && (d > 2.6 || c._hidWhy)) {
        c.fig.filmHide = false;
        H.delete(c);
      }
    }
    // (Danny too, out of a moment that is somebody else's)
    const P = g.player;
    const hideP = !!(keep && P && P.fig && !keep.has(P) && inPic(P, 1.4));
    if (hideP !== !!this.hidP) {
      P.fig.setVisible(!hideP);
      this.hidP = hideP;
    }
  }

  unhide() {
    for (const c of this.hidden) if (c.fig) c.fig.filmHide = false;
    this.hidden.clear();
    if (this.emoteHid && this.emoteHid.size) {
      for (const c of this.emoteHid) if (c.fig) c.fig.filmHide = false;
      this.emoteHid.clear();
    }
    if (this.hidP) {
      this.hidP = false;
      if (this.game.player.fig) this.game.player.fig.setVisible(true);
    }
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
    // (the cars and their paint on the game's own step - the script and its film on the real time,
    // round 13: game.js rawK)
    const dtG = Math.min(dt, this.game.realDt || dt);
    for (const p of this.pursuers || []) p.update(dtG * this.k);
    if (this.fight) this.fight.update(dtG * this.k);
    this.watchdog(dt);
    this.tickCast(dt);
    this.tickHeroes();
    this.tickAir(dt);
    if (this.page) this.page.update();
    this.acting.update(dt);
    // (the film's look and its comic sheet: after the camera has moved this frame - lateFrame)
    this._late = dt;
    this.tickGuns(dt);
    // (Danny walking somewhere in a shot, on his own feet - or running)
    if (this.walkTo && this.walkDanny(this.walkTo.x, this.walkTo.z, this.walkTo.speed, this.walkTo.sprint)) this.walkTo = null;
    this.tickMarker();
    this.tickCrowds(this.dtR ? Math.min(dt, this.game.realDt || dt) : dt);
    this.tickLeaving(dt);
    this.tickThoughts(dt);
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
    // (whoever the script put somewhere, turned, sat down or stood up just now: posed so before the
    // camera is set from them - snapPoses)
    this.snapPoses();
  }

  // (round 14) after the camera has been put where the film or the player has it this frame
  // (game.js, after camera.updateMatrixWorld): the film's look - its paint, its grade, a moment's
  // colour - and its comic sheet, drawn over the world where the camera now is. Both came before the
  // script's step and the camera: a cut's first frame had the last shot's rub marks over it, and the
  // game's look for a moment at the start of a film
  lateFrame() {
    if (!this.active) {
      if (this.game.extrasOff) this.game.extrasOff = false;
      return;
    }
    if (this._late === null || this._late === undefined) return;
    const dt = this._late;
    this._late = null;
    // (round 14: a moment's colour holds only whose moment it is - the city's own extras out of it too)
    this.game.extrasOff = !!(this.holdCam && this.emoteWant && this.emoteKeep);
    this.isolate();
    this.tickLook();
    // (round 14: the story's people's quick hands smeared as they go - in the film only: comic.js)
    if (this.holdCam) {
      const F = this._smF || (this._smF = []);
      F.length = 0;
      const P = this.game.player;
      if (P && P.fig && !P.inVehicle) F.push(P.fig);
      for (const k of ['lily', 'mark', 'man', 'g1', 'g2', 't1', 't2']) {
        const c = this.cast[k];
        if (c && c.alive && c.fig && !c.pl?.ride) F.push(c.fig);
      }
      this.comic.smearFigs = F;
    } else this.comic.smearFigs = null;
    this.comic.update(dt);
  }

  // (round 14) a moment's colour (emote, its keep) holds only whose moment it is: everybody else in the
  // picture out of it while it lasts - worked out here, the last thing before the frame is drawn, the
  // camera where it is now, so that nothing of the frame puts them back in it; back when it is over
  isolate() {
    const g = this.game;
    const keep = this.holdCam && this.emoteWant && this.emoteKeep ? this.emoteKeep : null;
    const EH = this.emoteHid || (this.emoteHid = new Set());
    if (keep) {
      const cam = g.camera;
      for (const c of g.civilians.list) {
        if (!c.alive || !c.fig || keep.has(c)) continue;
        _pv.set(c.pos.x, c.pos.y + 1.0, c.pos.z).applyMatrix4(cam.matrixWorldInverse);
        if (_pv.z > -0.1) continue;
        _pv.applyMatrix4(cam.projectionMatrix);
        if (Math.abs(_pv.x) > 1.45 || Math.abs(_pv.y) > 1.6) continue;
        if (!c.fig.filmHide) {
          c.fig.filmHide = true;
          EH.add(c);
        }
      }
    } else if (EH.size) {
      for (const c of EH) if (c.fig && !(this.hidden && this.hidden.has(c))) c.fig.filmHide = false;
      EH.clear();
    }
  }

  // (round 14) whoever was put somewhere, turned, sat down or stood up between two shots: posed so at
  // once. On twos (Doodle.twos) a figure standing still is posed anew only twelve times a second: put
  // elsewhere at a cut, it stood where it was two or three frames more - and the camera, set from its
  // head, with it (shots that settled into place in their first frames, people that jumped to theirs).
  // And at a cut, the story's people standing still turned already the way they are to face, looking
  // already where they look - never seen turning to it in a shot's first frames (faceTo(c, x, z, true):
  // a turn that is to be seen)
  repose(c) {
    if (c) (this.snapQ || (this.snapQ = new Set())).add(c);
  }

  snapPoses() {
    const Q = this.snapQ || (this.snapQ = new Set());
    const g = this.game;
    const P = g.player;
    if (this.cutNow) {
      this.cutNow = false;
      const t = this.clock || 0;
      for (const c of Object.values(this.cast)) {
        if (!c || !c.alive || !c.fig) continue;
        const still = !c.vel || Math.hypot(c.vel.x, c.vel.z) < 0.2;
        if (still && c.faceYaw !== null && c.faceYaw !== undefined && !(c.turnUntil > t)) c.yaw = c.faceYaw;
        if (!(c.turnUntil > t)) c.fig.lookSnap = true;
        c.fig.armSnap = true;
        Q.add(c);
      }
      for (const c of this.heroes || []) {
        if (c.fig) c.fig.armSnap = true;
        Q.add(c);
      }
      if (P && P.fig) {
        P.fig.lookSnap = true;
        P.fig.armSnap = true;
        Q.add(P);
      }
    }
    if (!Q.size) return;
    // (her page too, where her hands now hold it - held up a moment ago, hugged now: placed before her
    // arms are posed to it, and again after)
    const pg = this.page && this.page.fig && this.page.grp && this.page.grp.visible ? this.page : null;
    if (pg) pg.update();
    for (const c of [...Q]) this.reposeNow(c);
    if (pg) pg.update();
    Q.clear();
  }

  // (posed now as it stands: where it is, how it faces, sitting or standing - before anything is
  // worked out from where its head is: headJ asks for it)
  reposeNow(c) {
    if (this.snapQ) this.snapQ.delete(c);
    const f = c && c.fig;
    const P = this.game.player;
    if (!f || !f.update || f.rag || (c === P && P.inVehicle)) return;
    f.yaw = c.yaw;
    f.twoN = -1;
    f.update(0);
  }

  // (ROADMAP 18.9) the evening's air under all of it (game/prologue/soundscape.js): its levels from
  // where the ear is - the film's camera, or Danny in the player's hands - a few times a second; a gull
  // now and then near the sea; Danny's steps and Lily's, by their strides, on the pier's boards or on
  // stone. What is played is kept (airLog) for a film made of the game to play it again
  tickAir(dt) {
    const g = this.game;
    const A = g.audio;
    if (!A || !A.ctx || !A.fx) return;
    if (!this.air) {
      this.air = new Soundscape(A.ctx, A.fx, A.noise);
      this.airClass = Soundscape;
      // (the recorded crowd and sea under it, once they are in: game/prologue/tracks.js)
      const air = this.air;
      Promise.all([loadTrack(A.ctx, 'sfx/crowd_loop.mp3'), loadTrack(A.ctx, 'sfx/sea_loop.mp3')]).then(([cr, se]) => air.useLoops(cr, se));
      loadTrack(A.ctx, 'sfx/erase_rub.mp3');
      loadTrack(A.ctx, 'sfx/pencil_sketch.mp3');
      loadTrack(A.ctx, 'sfx/sting.mp3');
      loadTrack(A.ctx, 'sfx/gone_whoosh.mp3');
      this.airT = 0;
      this.gullT = 3 + Math.random() * 4;
      this.steps = {};
    }
    const c = A.ctx;
    const now = c.currentTime;
    const ear = this.holdCam ? g.camera.position : g.player.pos;
    this.airT -= dt;
    if (this.airT <= 0) {
      this.airT = 0.25;
      const a = airAt(g, ear);
      // (ROADMAP 18.9: under the music at its height - the wheel going - the evening's air a step back,
      // never gone: airDip)
      const dip = this.airDip !== undefined ? this.airDip : 1;
      a.sea *= dip;
      a.crowd *= dip;
      a.city *= dip;
      this.air.levels(now, a.sea, a.crowd, a.city);
      if (this.airLog) this.airLog.push([this.clock || 0, 'lv', a.sea, a.crowd, a.city]);
      this.airSea = a.sea;
    }
    this.gullT -= dt;
    if (this.gullT <= 0) {
      this.gullT = 4 + Math.random() * 7;
      if ((this.airSea || 0) > 0.3) {
        const pan = Math.random() * 1.6 - 0.8;
        const vol = 0.4 + Math.random() * 0.5;
        this.air.gull(now, vol, pan);
        if (this.airLog) this.airLog.push([this.clock || 0, 'gull', vol, pan]);
      }
    }
    // (Lily drawing - this.sketching: her pencil on the page, strokes and the gaps between them, heard
    // only near her)
    const Ly = this.cast.lily;
    // (round 9, the player's word: too loud, and not a pencil - a pencil on paper, recorded, soft,
    // round and round while she draws, heard only near her: sfx/pencil_sketch.mp3)
    {
      const d = Ly ? Math.hypot(Ly.pos.x - ear.x, Ly.pos.z - ear.z) : 99;
      const want = this.sketching && Ly && d < 7 ? 0.32 * Math.max(0.15, 1 - d / 7) : 0;
      // (for the tests' film of it: the level heard, as it changes)
      if (this.airLog && Math.abs(want - (this.pencilLogged || 0)) > 0.02) {
        this.pencilLogged = want;
        this.airLog.push([this.clock || 0, 'pencil', want]);
      }
      const buf = trackBuf('sfx/pencil_sketch.mp3');
      if (want > 0 && buf && !this.pencilLoop) {
        const gN = c.createGain();
        gN.gain.value = 0;
        gN.connect(this.air.out);
        this.pencilLoop = { g: gN, L: new Looper(c, buf, gN, { a: 0, b: buf.duration, x: 0.4 }) };
      }
      const pl = this.pencilLoop;
      if (pl) {
        pl.L.pump(now);
        pl.g.gain.setTargetAtTime(want, now, 0.25);
        if (!this.sketching) {
          pl.L.stop(now + 1);
          setTimeout(() => pl.g.disconnect(), 1500);
          this.pencilLoop = null;
        }
      }
    }
    // steps: each time a stride's foot comes down (its phase past a half turn), heard from the ear
    const P = g.player;
    const L = this.cast.lily;
    for (const [key, who, k] of [['d', P, 1], ['l', L, 0.6]]) {
      const f = who && who.fig;
      if (!f || (who === P && P.inVehicle) || (who === L && L.riding)) continue;
      const sp = Math.hypot((who.vel && who.vel.x) || 0, (who.vel && who.vel.z) || 0) || f.speed || 0;
      const n = Math.floor((f.phase || 0) / Math.PI);
      const was = this.steps[key];
      this.steps[key] = n;
      if (was === undefined || n === was || sp < 0.4) continue;
      const d = Math.hypot(who.pos.x - ear.x, who.pos.z - ear.z);
      if (d > 18) continue;
      const wood = who.pos.z > 234 && who.pos.z < 252 && who.pos.x > 30;
      const kk = k * Math.max(0.15, 1 - d / 18) * Math.min(1.3, 0.6 + sp * 0.12);
      this.air.step(now, wood, kk);
      if (this.airLog) this.airLog.push([this.clock || 0, 'step', wood ? 1 : 0, kk]);
    }
  }

  // a recorded sound (game/prologue/tracks.js) played once into the game's own sounds, if it is in;
  // kept in the air's log too, for a film made of the game
  sample(path, vol = 1) {
    const A = this.game.audio;
    const b = trackBuf(path);
    if (!A || !A.ctx || !A.fx || !b || A.enabled === false) return null;
    const c = A.ctx;
    const s = c.createBufferSource();
    s.buffer = b;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(g).connect(A.fx);
    s.start();
    s.onended = () => g.disconnect();
    if (this.airLog) this.airLog.push([this.clock || 0, 'sample', path, vol]);
    return s;
  }

  // (ROADMAP 18.9) the look of the film while it plays: what is behind its people painted, as by a
  // brush - the brush wider away from where the camera looks - and its people drawn twelve times a
  // second (in the film only: in the player's hands they move as they always do)
  tickLook() {
    const g = this.game;
    const film = !!this.holdCam;
    Doodle.twos.on = film && this.twosOn;
    Doodle.twos.n = Math.floor((this.clock || 0) * 12);
    const P = g.player;
    if (P && P.fig) P.fig.ones = !!P.inVehicle;
    const pipe = g.pipe;
    if (!pipe) return;
    // (the painted look the whole prologue through - in the player's own hands too, between the
    // scenes: one film, the walk to her and to the wheel in it. Where it looks: the film's shot, or
    // the player)
    // (ROADMAP 18.9: from the moment he meets her - the flight in and the city's tour as the game
    // looks: the film's own look is the story's)
    // (and only while it is the film: the player's own walks and drives between its scenes look as the
    // game does - ROADMAP 18.9, the player's word)
    const story = (this.sceneN || 0) >= 2 && film;
    pipe.paintWant = this.paintOn && story ? 1 : 0;
    // (and its light and colour: the people inked bolder and lit round their edge, the shadows cool
    // and the lights warm, a grain - more of all of it while it is filmed; render/pipeline.js look)
    const LK = pipe.look;
    if (LK && this.paintOn && this.lookOn && story) {
      LK.rim = film ? 0.9 : 0.6;
      LK.grade = 1;
      LK.grain = film ? 0.03 : 0.02;
      LK.personW = film ? 1.7 : 1.3;
      // (and the pens over everything fewer: its colours laid on flat, painted - render/glsl.js)
      shared.uPenDens.value = 0.3;
      // (the colour of the story: the evening golden - and once the wheel is gone, the warmth out of
      // it, the light a little lower, colder, until they leave the pier: ROADMAP 18.9)
      // (each scene its own colour - a colour script: the flight in and the city golden, meeting her a
      // candy pink, the wheel gold again, the chase on harder teal and orange)
      const n = this.sceneN || 0;
      const after = !!(this.set && this.set.wheelGone) && n <= 4;
      const want = after
        ? [[0.7, 0.84, 1.27], [1.0, 0.97, 0.95], 0.9]
        : n <= 1
          ? [[0.76, 0.88, 1.16], [1.15, 0.98, 0.76], 1]
          : n === 2
            ? [[0.84, 0.82, 1.17], [1.14, 0.95, 0.88], 1]
            : n >= 5
              ? [[0.7, 0.9, 1.25], [1.13, 0.96, 0.8], 1]
              : [[0.74, 0.9, 1.2], [1.13, 0.97, 0.8], 1];
      // (round 14: a film begun - the cut into it - with its whole look at once: the game's for a
      // moment, easing into the film's, was the first half second of every one of them)
      const e = this.lookSnap ? 1 : 1 - Math.exp(-(this.dtR || 0.016) * 0.6);
      for (let i = 0; i < 3; i++) {
        LK.shadowT[i] += (want[0][i] - LK.shadowT[i]) * e;
        LK.lightT[i] += (want[1][i] - LK.lightT[i]) * e;
      }
      // (round 8, the player's word: a comic book, not a painting - its print over the film: a few flat
      // tones, the shadows in its dots, the ink's black, and far off the plates out of register;
      // the dots in the shadows' own colour, deeper: render/pipeline.js comicPrint)
      LK.comic = film ? 1 : 0;
      LK.mis = film ? 1.8 : 0;
      // (round 11: their own key light when the sun is behind them - faces against the sunset were
      // black: render/pipeline.js uFill)
      // (round 14: more of it where a scene asks - fillK: the street's stand-off against the sunset)
      LK.fill = film ? 0.85 * (this.fillK || 1) : 0;
      for (let i = 0; i < 3; i++) LK.dotInk[i] = 0.34 * Math.pow(LK.shadowT[i], 1.6);
      // (on the day's own light, set every frame before this: a share of it - round 11: and in the
      // film inside the dark car park, more of it, its faces to be read)
      let wantExp = want[2];
      if (film) {
        const cp = g.camera.position;
        const lvC = PARK.levelAt(cp.x, cp.z, cp.y);
        if (lvC !== null && lvC < 10 && PARK.ceilingAt(cp.x, cp.z, cp.y) < Infinity) wantExp *= 1.4;
      }
      this.expK = (this.expK || 1) + (wantExp - (this.expK || 1)) * (film ? Math.min(1, e * 8) : e);
      if (this.lookSnap) pipe.paintSnap = true;
      if (pipe.exposure !== undefined) pipe.exposure *= this.expK;
    } else if (LK) {
      Object.assign(LK, { rim: 0, grade: 0, grain: 0, personW: 1, comic: 0, mis: 0, fill: 0 });
      shared.uPenDens.value = 1;
    }
    const S = this.activeShots || this.shots;
    if (film && S && S.on) pipe.paintFocus = clamp(S.focus !== null && S.focus !== undefined ? S.focus : S.lastPos.distanceTo(S.lastLook), 1.2, 90);
    else if (P && P.pos) pipe.paintFocus = clamp(g.camera.position.distanceTo(P.pos), 1.5, 30);
    // (round 9, the film's language: the whip's smear, the moment's colour behind them - eased in and
    // out - and a lens that is shallow when the shot asks for it: dof)
    if (LK) {
      LK.smear = film && S && S.on ? S.smear || 0 : 0;
      const ew = film ? this.emoteWant || 0 : 0;
      // (round 14: cut in, not dissolved - and off quickly)
      if (ew > (LK.emote || 0)) LK.emote = ew;
      else LK.emote = (LK.emote || 0) + (ew - (LK.emote || 0)) * (1 - Math.exp(-(this.dtR || 0.016) * 10));
      if (LK.emote < 0.01) LK.emote = 0;
      if (this.emoteCol) LK.emoteCol = this.emoteCol;
    }
    // (a long lens's shallow depth on every close shot, unless the shot says: dof)
    const near0 = film ? clamp((5 - pipe.paintFocus) / 3.5, 0, 1) : 0;
    const dofK = film && S && S.on && S.shot ? (S.shot.dof !== undefined ? S.shot.dof : 0.45 * near0) : 0;
    // (ROADMAP 18.9: a lens's depth in the film - close on a face, what is behind it painted broader
    // and softer, the face kept sharp; wide, the brush as it was)
    // (round 8: a narrower brush - the paint only flattens what is behind them into the comic's
    // colours, its print does the rest; not smeared)
    if (pipe.paintR) {
      const close = film ? clamp((5 - pipe.paintFocus) / 3.5, 0, 1) : 0;
      pipe.paintR[0] = 1.5 - 0.2 * close;
      pipe.paintR[1] = 2.8 + 2.2 * close + 7 * dofK;
    }
    this.lookSnap = false;
  }

  // ------------------------------------------------------------------ the film's tools
  film(on) {
    const was = !!this.holdCam;
    if (on && !was) this.lookSnap = true;
    this.ui.film(on);
    // (no how-to card over the film)
    if (on) {
      this.howTok = (this.howTok || 0) + 1;
      this.ui.card(null);
    }
    // (in the film his hands are bare, whatever he drew and took up in his own time - ROADMAP 18.9)
    if (on) {
      const W = this.game.weapons;
      const i = W && W.slots ? W.slots.findIndex((q) => q.def && q.def.bare) : -1;
      if (i >= 0 && W.index !== i) {
        W.fistsTold = true;
        W.select(i);
      }
    }
    this.holdCam = on;
    this.lock(on);
    // (walked by the film, nothing catches him: game/player.js ghost)
    this.game.player.ghost = on;
    // (the city's chatter over people's heads: none while the prologue is told - the film and the
    // player's part of it alike, ROADMAP 18.9 - and what was up, gone)
    const B = this.game.bubbles;
    if (B) {
      B.hold = true;
      if (on && B.clear) B.clear();
    }
    if (!on) {
      const skipped = this.ff;
      this.ff = false;
      // (the film's last picture held, and the game's camera eased in from it - not a jump: blendCam;
      // skipped through, straight back)
      const cam = this.game.camera;
      if (was && !skipped) this.blend = { pos: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov, t: 0, dur: undefined };
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
    this.cutNow = true;
    if (this.comic && this.comic.cutSmears) this.comic.cutSmears();
    // (round 11: a moment's colour gone with the shot it was in - not bleeding into the next)
    const LK = this.game.pipe && this.game.pipe.look;
    if (LK && !this.emoteWant && LK.emote) LK.emote = 0;
    return s.dur || 3;
  }

  // (ROADMAP 18.9) how to play what comes now: its card (game/prologue/howto.js) - kept up while the
  // player is at it (life 0), or for life seconds; a newer card, or the film, takes it away
  howto(key, life = 0) {
    const o = howtoCard(key, this.game.touch);
    const tok = (this.howTok = (this.howTok || 0) + 1);
    if (!o || this.ff) {
      this.ui.card(null);
      return;
    }
    this.ui.card(o);
    if (life > 0) {
      setTimeout(() => {
        if (this.howTok === tok) this.ui.card(null);
      }, life * 1000);
    }
  }

  // (ROADMAP 18.9) a freeze frame, as the animated films bring their people in: the world held still
  // and the camera with it, a card over it (game/prologue/comic.js card: a slab, the name, who they
  // are) - a whoosh, the music let down under it - and then on again, from the next shot
  // (round 9) the anime's moment of feeling: what is behind them sunk into a colour and the dark, them
  // lit (render/pipeline.js uEmote) - on, or off (null)
  // (round 14: on at once, as an anime's colour cuts in, and quickly off; keep - whose moment it is, a
  // figure or a few: nobody else in it, clearLens)
  emote(col = null, keep = null) {
    this.emoteWant = col ? 1 : 0;
    if (col) this.emoteCol = col;
    this.emoteKeep = col && keep ? new Set(Array.isArray(keep) ? keep : [keep]) : null;
  }

  // (round 9) a flash of light over the picture, a cut's punch (comic.js flash)
  flash(life = 0.16, col = '#ffffff', a = 0.9) {
    if (this.comic && this.comic.flash) this.comic.flash(life, col, a);
  }

  *freezeCard(o) {
    if (this.ff || !this.comic) return;
    const g = this.game;
    const S = this.shots;
    const life = o.life || 1.9;
    const k0 = this.kWant;
    this.k = this.kWant = 0.0002;
    S.cut({ from: S.lastPos.clone(), look: S.lastLook.clone(), fov: S.lastFov, dur: life + 1, hand: 0 });
    g.audio.play('whoosh', 0.55);
    if (this.score && this.score.under) this.score.under(life, 0.45);
    this.comic.card({ ...o, life });
    yield life + 0.04;
    this.k = this.kWant = k0 || 1;
  }

  // a line said: its voice, its subtitle, the speaker's mouth; the script waits for it to end
  *say(id, fig = null, after = 0.28) {
    if (this.ff) return;
    const d = this.voices.say(id, fig);
    const g = this.game;
    const L = LINES[id];
    // (the music let down under the words: game/prologue/score.js under)
    if (this.score && this.score.under) this.score.under(d);
    // (the hands, the face and the head go with the words, beat by beat - and whoever it is said to
    // takes it as it lands: everybody looking at the speaker)
    if (fig && ACTS[id]) {
      const all = [g.player.fig, ...Object.values(this.cast).map((q) => q.fig), ...(this.heroes || []).map((q) => q.fig)];
      const listeners = all.filter((f) => f && f !== fig && fig.j && f.lookAt === fig.j.headC);
      this.acting.play(fig, id, d, listeners, this.voices.buf && this.voices.buf.get(id));
    } else {
      // (a line with no acting of its own: one of the city's people talks with their hands as they do)
      const c = fig ? Object.values(this.cast).find((q) => q.fig === fig) : null;
      if (c && L && g.civilians.spoke) g.civilians.spoke(c, L.en, /!/.test(L.en) ? 'alarm' : 'talk');
    }
    // (round 10, the player's word: the talk quicker - the next thing a moment before this one's last
    // breath has died, the pause after it shorter)
    yield d * 0.94 + after * 0.4;
  }

  objective(html, x = null, z = null, name = null) {
    this.objKey = html || '';
    this.ui.objective(html);
    const g = this.game;
    if (x !== null && g.gps) g.gps.set(x, z, name || 'Lily');
    else if (g.gps && x === null && html === null) g.gps.clear();
  }

  // the music (game/prologue/score.js): a cue by name, 'stop' to end it; heat for the chase
  cue(name, o = {}) {
    // (round 14: a sting - the marked man's notes - over whatever plays, at its own level; not the
    // music that is wanted from here on)
    const sting = name === 'mark';
    if (!sting) this.wantCue = name;
    const S = this.score;
    if (!S) return;
    try {
      if (name === 'stop') S.stop({ fade: o.fade !== undefined ? o.fade : 2 });
      else S.play(name, { fade: o.fade !== undefined ? o.fade : 1, ...(o.vol !== undefined ? { vol: o.vol } : {}) });
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
    // (round 11: the story's people drawn in full further off than the street's - on a phone too:
    // render/people.js draw)
    if (c.fig) c.fig.lodFar = 85;
    c.pl = { x, z, speed: 0, face: o.face !== undefined ? o.face : null };
    c.ctrl = (civ) => this.steer(civ);
    // (round 14: the story's own people drawn however close the camera comes - not the crowds:
    // game/doodle.js inCamera)
    if (c.fig && !/^(eve|grp|tour)/.test(key)) c.fig.nearOk = true;
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
    this.repose(c);
  }

  // (round 14: turned there at once - between shots, or at a cut; a turn that is to be seen, turn:
  // round over a moment, the cut after it not taking it from them)
  faceTo(c, x, z, turn = false) {
    if (!c) return;
    const f = Math.atan2(x - c.pos.x, z - c.pos.z);
    c.pl.face = f;
    c.faceYaw = f;
    if (turn) c.turnUntil = (this.clock || 0) + 2.5;
    else {
      c.turnUntil = 0;
      c.yaw = f;
      this.repose(c);
    }
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

  // (ROADMAP 18.9) a clean single: c's face from in front of them, a little to one side - their head
  // and shoulders, nobody's back of the head across it. at: whom (a figure) or what (a point) they face;
  // dist from the face, side to their right (+) or left (-), up from the eyes; the look a little below
  // them (drop: the face in the upper third, the shoulders in). Worked out every frame from where they
  // are: { from, look } for a shot
  single(c, at, o = {}) {
    const dist0 = o.dist !== undefined ? o.dist : 1.3;
    const side0 = o.side !== undefined ? o.side : 0.45;
    const up = o.up !== undefined ? o.up : -0.04;
    const drop = o.drop !== undefined ? o.drop : 0.1;
    const fig = at && !at.isVector3;
    const frame = () => {
      const h = this.headJ(c) || v3(c.pos.x, c.pos.y + 1.6, c.pos.z);
      const A = at ? (at.isVector3 ? at : this.headJ(at) || at.pos) : null;
      let ux = A ? A.x - h.x : Math.sin(c.yaw || 0);
      let uz = A ? A.z - h.z : Math.cos(c.yaw || 0);
      const d = Math.hypot(ux, uz) || 1;
      ux /= d;
      uz /= d;
      // (the one they talk to near them, their head at the camera's height: the camera never as far
      // as them - in front of their head it would be the back of it across the picture - but nearer,
      // and more to the side. A child's head well under it, a grown-up's well over: past them)
      let dist = dist0;
      let side = side0;
      if (fig && dist > d * 0.6 && Math.abs(A.y - (h.y + up)) < 0.3) {
        dist = d * 0.6;
        side = Math.sign(side0 || 1) * Math.max(Math.abs(side0), 0.6);
      }
      return { h, ux, uz, dist, side };
    };
    return {
      // (their right: -uz, ux)
      from: () => {
        const { h, ux, uz, dist, side } = frame();
        return v3(h.x + ux * dist - uz * side, h.y + up, h.z + uz * dist + ux * side);
      },
      look: () => {
        const { h, ux, uz, side } = frame();
        return v3(h.x - uz * side * 0.12, h.y - drop, h.z + ux * side * 0.12);
      },
    };
  }

  // (ROADMAP 18.9) the two of them side by side in the picture, in profile to each other: from the side
  // of the line between them (sgn which side; along it towards b, +), dist away, at height h over
  // their feet; looking at the middle of them at lookH. As they are now: from(k) a little nearer
  // (k metres), for a slow push in
  two(a, b, o = {}) {
    const dist = o.dist !== undefined ? o.dist : 3.2;
    const h = o.h !== undefined ? o.h : 1.2;
    const lh = o.lookH !== undefined ? o.lookH : h;
    const sgn = o.sgn || 1;
    const along = o.along || 0;
    const A = a.pos;
    const B = b.pos;
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d;
    const uz = dz / d;
    const mx = (A.x + B.x) / 2;
    const mz = (A.z + B.z) / 2;
    const y0 = Math.min(A.y || 0, B.y || 0);
    return {
      from: (k = 0) => v3(mx - uz * (dist - k) * sgn + ux * along, y0 + h, mz + ux * (dist - k) * sgn + uz * along),
      look: () => v3(mx, y0 + lh, mz),
    };
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
    // (round 14: put somewhere, turned, sat down since it was last posed: posed so first - a shot
    // worked out from the head where it had been missed her, the camera on an empty bench)
    if (this.snapQ && this.snapQ.size && this.snapQ.has(c)) this.reposeNow(c);
    const j = c.fig && c.fig.j && c.fig.j.headC;
    return j && (j.x !== 0 || j.y !== 0 || j.z !== 0) ? j : null;
  }

  // (round 13) what somebody sees: from just in front of their eyes towards a place (x, z) - not from
  // inside their head, where a lock of their own hair hung across the sky as a great paper tube
  eyeOf(c, to, fwd = 0.3) {
    return () => {
      const h = this.headJ(c) || v3(c.pos.x, c.pos.y + 1.7, c.pos.z);
      const dx = to.x - h.x;
      const dz = to.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      return v3(h.x + (dx / d) * fwd, h.y + 0.04, h.z + (dz / d) * fwd);
    };
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
    this.repose(p);
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
      // (moving with the car: not on twos in it)
      L.fig.ones = true;
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
    }
    // (round 11: come onto a floor - a wreck, or caught, starts again from here on where it came onto
    // it, the top of the ramp from the floor under it; and theirs on the floor over it put out to wait)
    const k = Math.round(lv);
    if (k >= 1 && Math.abs(lv - k) < 0.03 && k > (this.checkLv || 0)) {
      const r = PARK.ramps[k - 1];
      if (r) {
        const up = Math.sign(r.zHigh - r.zLow);
        const y = PARK.main.levels[k];
        this.check = { x: r.xc, y: y + 0.05, z: r.zHigh + up * 5, yaw: up > 0 ? 0 : Math.PI, back: { x: r.xc, y: y - 1.4, z: r.zHigh - up * 12 } };
      }
      this.checkLv = k;
      this.armFloor(k + 1);
      // (a floor further up: a breath - a little of the car's strength back)
      v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.12);
    }
  }

  // (round 11) theirs on floor k, waiting in the dark for him (game/prologue/paintfight.js): out of
  // the end of the bays down the middle into the turn as he comes round it; in the corner of the turn
  // by the tower, nose out across it; at the top of the ramp up from here, nose down it, coming down
  // at him as he gets to its foot
  armFloor(k) {
    const F = this.fight;
    const R = PARK.ramps;
    if (!F || k < 0 || k >= R.length) return;
    const A = this.armed || (this.armed = new Map());
    if (A.has(k)) return;
    const M = PARK.main;
    const y = M.levels[k];
    const r = R[k];
    const north = r.zLow === M.zN;
    const list = [];
    // (out at him, then after him - a car's length or two behind, not across his way)
    const at = (x, yy, z, yaw, o) => list.push(F.spawn(x, yy, z, yaw, { mode: 'wait', wake: 30, lv: k, keep: 9, ...o }));
    if (k !== 2 && k !== 4) at(M.xc, y, north ? M.zN - 2.5 : M.zS + 2.5, north ? Math.PI : 0, { color: k % 4 });
    if (k === 3 || k === 5) at(r.west ? M.x0 + 9 : M.x1 - 9, y, north ? M.z0 + 4.5 : M.z1 - 4.5, r.west ? Math.PI / 2 : -Math.PI / 2, { wake: 34, color: (k + 1) % 4 });
    // (from the floor over it: beside the top of the ramp up from here, swinging in behind him as he
    // comes up it - round 11: not nose down the ramp at him, head on in its lane: the two stuck there)
    if (k === 2 || k === 4) {
      const up = Math.sign(r.zHigh - r.zLow);
      const sx = r.west ? 1 : -1;
      at(M.xc + sx * 1.5, M.levels[k + 1], r.zHigh + up * 9, r.west ? -Math.PI / 2 : Math.PI / 2, { wakeAt: { x: r.xc, z: (r.zLow + r.zHigh) / 2 + up * 10, y: M.levels[k] + M.floorToFloor * 0.6, r: 12 }, color: 2 });
    }
    A.set(k, list);
  }

  // caught: too much paint on the car - they have him. A beat of it, and back to where he came onto
  // this floor (resetToCheck)
  caught() {
    if (this.resetting || this.caughtNow) return;
    const g = this.game;
    this.caughtNow = true;
    g.audio.play('fail', 0.7);
    const v = g.player.inVehicle;
    if (v && this.comic && this.comic.word) this.comic.word('CAUGHT!', v3(v.pos.x, v.pos.y + 2, v.pos.z), { fill: '#ff4f8b', burst: '#1b1430', size: 0.12, life: 1.1 });
    if (this.fight) this.fight.on = false;
    this.slow(0.2, 14);
    setTimeout(() => {
      this.slow(1, 14);
      this.caughtNow = false;
      this.resetToCheck();
    }, 950);
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
    this.resetToCheck();
  }

  resetToCheck() {
    const W = this.check;
    if (!W || this.resetting) return;
    const g = this.game;
    this.resetting = true;
    this.ui.fade(true);
    setTimeout(() => {
      const P = g.player;
      let car = P.inVehicle;
      if (!car || car.dead) {
        if (car) g.exitVehicle(true);
        car = g.vehicles.spawnStock({ kind: 'muscle', color: [0.58, 0.1, 0.12] }, { x: W.x, z: W.z }, W.yaw);
        car.kept = true;
        if (this.fight) car.keepAlive = () => this.caught();
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
      // (round 11: whole again - the paint off it)
      car.hp = car.maxHp;
      g.camRig.yaw = W.yaw;
      // (the one after him a little further back than it was)
      const main = this.pursuer;
      if (main && main.car && W.back) {
        const q = main;
        q.car.pos.set(W.back.x, W.back.y !== undefined ? W.back.y : W.y, W.back.z);
        q.car.yaw = W.yaw;
        q.car.vx = q.car.vz = 0;
        q.car.speed = 0;
        q.trail.length = 0;
        q.i = 0;
        q.seed([[W.back.x, W.y, W.back.z], [W.x, W.y, W.z]]);
      }
      // (round 11: the others after him gone; those waiting on this floor waiting again)
      if (this.autopilot && this.autopilot.onReset) this.autopilot.onReset(this.checkLv || 0);
      const F = this.fight;
      if (F) {
        F.reset();
        F.on = true;
        for (const e of F.enemies.slice()) if (e.own && e.mode === 'chase') F.remove(e);
        const k = this.checkLv || 0;
        if (this.armed && this.armed.has(k)) {
          for (const e of this.armed.get(k)) if (F.enemies.includes(e)) F.remove(e);
          this.armed.delete(k);
        }
        if (this.climb) this.armFloor(k);
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
    // (behind the black it opens in: the shops' insides round him built now, all at once - nobody
    // sees the frame it takes - so that nothing of them is left to build while the film flies in;
    // before the music, which a long frame would trip)
    const I = g.world && g.world.interiors;
    if (I && this.ui.blackOn) I.fill(P.pos.x, P.pos.z, 1500, P.pos.y);
    this.film(true);
    this.hour(18.2, 0.004);
    this.cue('opening');
    // Lily, waiting at the stand (her look as soon as her sheet is in: game/prologue/cast.js)
    yield () => this.castReady;
    this.spawnLily();
    // (and whatever is still to come of them is built at its ordinary pace while the camera is far
    // off over the city - not rushed in, a frame's worth at a time: world/mainland/stream.js calm)
    if (I && I.stream) I.stream.calm = true;
    // in off the sea: past the yachts and the wheel, low over the beach and along the promenade, down
    // to Danny. (Low: from up high the whole city is in the picture at once - more than a phone can
    // draw smoothly; down here the nearest of it hides the rest, and it is the promenade's evening
    // that is seen, its people, its palms)
    this.shot({
      path: [v3(262, 8.5, 268), v3(196, 10, 270), v3(150, 13, 272), v3(96, 12.5, 232), v3(56, 10, 150), v3(31, 7.5, 64), v3(19.5, 4.2, 14.5), v3(17.2, 2.6, 9.6)],
      lookPath: [v3(128, 26, 243), v3(126, 27, 243), v3(110, 18, 226), v3(42, 6, 160), v3(21, 3.2, 60), v3(16, 2.4, 10), v3(17, 1.9, 3), v3(17, 1.9, -12)],
      fov: 52,
      fovTo: 58,
      // (ROADMAP 18.9: shorter - 17 seconds, not 27: the sea's first stretch left out, the wheel the
      // first thing it flies past)
      dur: first ? 17 : 1,
      ease: 'soft',
      hand: 0.25,
    });
    // (out of the black it began in: once the first heavy frames are behind it, over the open sea)
    if (this.ui.blackOn) {
      yield 0.9;
      this.ui.fade(false, 1.6);
      yield 12.4;
    } else yield 13.3;
    // (round 13: as it comes down to him, what is in his head this evening - the film's first thought;
    // its last word is his too, at the end: yeah, it was there)
    if (first) this.thought('TH1', 2.8);
    yield 3.7;
    if (I && I.stream) I.stream.calm = false;
    // the city, his - and the game showing him round it (ROADMAP 18.9): a few things to do, each
    // told plainly, then Lily
    this.film(false);
    yield* this.tutorial();
    this.objective('Meet <b>Lily</b> at the ice cream stand', STAND.x, STAND.z, 'Lily');
    this.howto('lily', 14);
    // (in a car by her: out of it to meet her)
    let outTold = false;
    yield () => {
      const near = this.dist(LILY_SEAT.x, LILY_SEAT.z) < 30;
      if (near && g.player.inVehicle && !outTold) {
        outTold = true;
        this.ui.card({ title: 'יוצאים מהמכונית', say: 'הגעתם! את לילי פוגשים ברגל - חנו ליד הדוכן.', lines: [[g.touch ? 'כפתור הרכב' : 'E', 'לצאת מהמכונית']] });
      }
      if (outTold && !g.player.inVehicle) this.ui.card(null);
      return this.dist(LILY_SEAT.x, LILY_SEAT.z) < 8.5 && !g.player.inVehicle;
    };
    this.ui.card(null);
    this.start(2);
  }

  // (ROADMAP 18.9) the game showing the player round, between the flight in and Lily: walk and look
  // round; a shop - walk in; a car - take it; drive it. Each told on a card (what, and how: its
  // keys), each done when it is done or let go after a while, in the order it is done in. No drawing
  // yet: the first time is on the roof, in the chase (scene 7)
  *tutorial() {
    const g = this.game;
    const P = g.player;
    let t = 0;
    // 1. walk, look round
    this.objective('<b>Explore</b> the city');
    this.howto('explore');
    const p0 = P.pos.clone();
    yield () => {
      t += this.dtR;
      return t > 14 || (t > 4 && P.pos.distanceTo(p0) > 16);
    };
    this.howto(null);
    yield 0.6;
    // 2. a shop: in through its door
    if (!P.inVehicle) {
      this.objective('Walk into a <b>shop</b>');
      this.howto('shop');
      t = 0;
      let inside = false;
      yield () => {
        t += this.dtR;
        if (P.indoor && !inside) {
          inside = true;
          t = Math.max(t, 22);
          this.howto('inside');
        }
        return t > (inside ? 30 : 26) || !!P.inVehicle;
      };
      this.howto(null);
      yield 0.6;
    }
    // 3. a car: the nearest one parked, his
    const parked = () => {
      let best = null;
      let bd = 1e9;
      // (the traffic's parked cars: game/curbs.js, Traffic.parked)
      for (const c of (g.traffic && g.traffic.parked) || []) {
        if (!c.parkedCar || c.gone || c.wrecked) continue;
        const d = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      return best;
    };
    if (!P.inVehicle) {
      let car = parked();
      this.objective('Take a <b>car</b>', car ? car.pos.x : null, car ? car.pos.z : null, 'Car');
      this.howto('car');
      t = 0;
      let gpsT = 0;
      yield () => {
        t += this.dtR;
        gpsT += this.dtR;
        if (gpsT > 1.5) {
          gpsT = 0;
          car = parked();
          if (car && g.gps) g.gps.set(car.pos.x, car.pos.z, 'Car');
        }
        return !!P.inVehicle || t > 60;
      };
      this.howto(null);
      if (g.gps) g.gps.clear();
      yield 0.5;
    }
    // 4. drive it
    if (P.inVehicle) {
      this.objective('<b>Drive</b> - get a feel for it');
      this.howto('drive');
      const q0 = P.pos.clone();
      t = 0;
      yield () => {
        t += this.dtR;
        return t > 18 || (t > 6 && P.pos.distanceTo(q0) > 140);
      };
      this.howto(null);
      yield 0.5;
    }
    // 5. the pen: open, everything in it open (begin: setAllOpen) - till it has been opened and put
    // away again, or a while has gone by
    this.objective('<b>Draw</b> something - it comes to life');
    this.howto('draw');
    {
      const F = g.freedraw;
      let opened = false;
      t = 0;
      yield () => {
        t += this.dtR;
        // (left open, it goes on all the same after a while: the pen is the player's, not the tour's)
        if (F && F.isOpen) {
          opened = true;
          return t > 45;
        }
        return (opened && t > 3) || t > 30;
      };
    }
    this.howto(null);
    this.objective(null);
    yield 0.4;
  }

  spawnLily() {
    if (this.cast.lily) return;
    const look = this.lilyLookFn ? this.lilyLookFn() : kidLook(true);
    const L = this.person('lily', LILY_SEAT.x, LILY_SEAT.z, look, { face: LILY_SEAT.yaw });
    // (her drawn face in the film's middle shots too, not only close: render/people.js portraitFor)
    L.fig.portraitPx = 40;
    // (round 14: her face hers near and far - never handed to her at a cut and faded in, the city's
    // simple face dark in its place a third of a second: render/people.js keepPortrait)
    L.fig.keepPortrait = true;
    L.fig.sit = 1;
    this.repose(L);
    L.baseY = 0.32;
    if (this.castMod && this.castMod.giveIceCream) this.castMod.giveIceCream(L.fig, true);
    L.fig.coneLow = true;
    if (this.castMod && this.castMod.giveSketchbook) this.castMod.giveSketchbook(L.fig, true);
  }

  // ------------------------------------------------------------------ 2. LILY
  // (ROADMAP 18.9: staged again from the comic's panels that worked - each face from in front, head and
  // shoulders, nobody's back of the head across it; everybody looking at whoever speaks, and at what
  // is happening)
  *s2() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    this.objective(null);
    if (g.gps) g.gps.clear();
    // (round 11, the player's word: the music cute but very tense from the first sight of the wheel -
    // score.js FILES.tense - and on through the pier)
    this.cue('tense', { fade: 3 });
    this.film(true);
    // she looks up from her drawing and sees him coming: from behind him, low, her at the stand in the
    // evening ahead of him - he walks the last steps into it
    // (round 14: up to her - a step from her, not three metres off: the two of them in one picture)
    const meet = { x: LILY_SEAT.x - 1.3, z: LILY_SEAT.z - 0.75 };
    this.putDanny(LILY_SEAT.x - 5.2, LILY_SEAT.z - 2.5, Math.atan2(2.6, 1.1));
    this.faceTo(L, meet.x, meet.z);
    L.fig.lookAt = null;
    // (round 11: first, what the story is about - the giant wheel against the evening, over her
    // shoulder as she sits looking at it, the music box's tune going under it as it comes up: cute,
    // and wrong)
    {
      const W0 = v3(WHEEL.x, 30, WHEEL.z);
      this.faceTo(L, WHEEL.x, WHEEL.z);
      L.fig.lookAt = W0;
      // (round 14: over her other shoulder - from the right one a white pole stood across the wheel)
      this.shot({ from: this.ots(L, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { h: 1.0, back: 0.75, side: -0.32 }), look: W0, lookTo: v3(WHEEL.x, 31.5, WHEEL.z), fov: 40, fovTo: 33, dur: 3.6, ease: 'inout', hand: 0.15 });
      // (round 13, the player's word: a second or two of the cute tune - then over, slowly, into the
      // dread: score.js dread)
      yield 1.5;
      this.cue('dread', { fade: 5 });
      yield 1.8;
      this.faceTo(L, meet.x, meet.z);
      L.fig.lookAt = null;
    }
    // (round 11: the crane down to her from over the sand cut - the wheel over her shoulder is where we
    // are now; straight on to him coming)
    this.walkTo = { x: meet.x, z: meet.z, speed: 0.4 };
    // (ROADMAP 18.9: behind his shoulder as he walks the last steps - her ahead of him at the stand,
    // looking up; before, from far off across a café table, he was not in it)
    // (round 14: from behind her - him coming to her, his face in the evening's light; from behind
    // him it was his dark back, a tree's trunk across a third of it, and her too far to be read)
    this.shot({
      from: this.ots(L, P, { back: 0.7, side: -0.4, h: 1.04 }),
      look: () => { const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z); return v3(h.x, h.y - 0.08, h.z); },
      fov: 36,
      dur: 4.6,
      hand: 0.4,
    });
    yield 1.6;
    // (ROADMAP 18.9: her face as she sees him - not small at the stand behind his back - and her card)
    L.fig.lookAt = P.fig.j.headC;
    this.feel(L.fig, 'joy', 5);
    this.shot({ ...this.single(L, P, { dist: 1.05, side: 0.38, up: 0.0, drop: 0.05 }), fov: 34, dur: 3.2, hand: 0.3 });
    yield 0.3;
    yield* this.say('L01', L.fig, 0.1);
    yield* this.freezeCard({ name: 'LILY', tag: 'age 9 - draws everything she sees', col: '#f2b630', at: () => this.headJ(L), side: -1 });
    // (and him as she sees him, coming the last steps to her: from where she sits, a little over her
    // shoulder, up at him)
    this.shot({
      from: () => { const h = this.headJ(L) || v3(L.pos.x, 1.0, L.pos.z); const dx = P.pos.x - h.x; const dz = P.pos.z - h.z; const d = Math.hypot(dx, dz) || 1; return v3(h.x - (dx / d) * 0.35 + (dz / d) * 0.22, h.y + 0.06, h.z - (dz / d) * 0.35 - (dx / d) * 0.22); },
      look: () => { const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z); return v3(h.x, h.y - 0.25, h.z); },
      fov: 38,
      dur: 3,
      hand: 0.35,
    });
    yield () => !this.walkTo || this.shots.t > 4.0;
    // (on the cut: where he was going - and she is up off her stool: she sat at the stand from the
    // start of the game, and nothing stood her up again; she walked and ran sitting - ROADMAP 18.9)
    this.walkTo = null;
    this.auto = null;
    L.fig.sit = 0;
    this.repose(L);
    L.baseY = 0;
    this.putDanny(meet.x, meet.z, Math.atan2(L.pos.x - meet.x, L.pos.z - meet.z));
    this.faceTo(L, meet.x, meet.z);
    // him, from her side and from below: a father as his kid sees him
    P.fig.lookAt = L.fig.j.headC;
    // (round 14: from his lit side - from the other, he was a dark shape against a pink wall)
    this.shot({ ...this.single(P, L, { dist: 1.3, side: 0.42, up: -0.12, drop: 0.1 }), fov: 36, dur: 3.4, hand: 0.3 });
    yield 0.2;
    yield* this.say('D01', P.fig, 0.15);
    yield* this.freezeCard({ name: 'DANNY', tag: 'her dad - it is complicated', col: '#4fa3d8', at: () => this.headJ(P), side: 1 });
    // her: a giggle - then she teases him
    // (round 10: the anime's cute moment - in on her, the world behind her gone a warm pink)
    {
      const A = this.single(L, P, { dist: 1.15, side: 0.42, up: 0.02, drop: 0.07 });
      const Bn = this.single(L, P, { dist: 0.85, side: 0.34, up: 0.02, drop: 0.07 });
      this.shot({ from: A.from, to: Bn.from, look: A.look, fov: 34, dur: 3.0, hand: 0.3, dof: 1 });
    }
    this.feel(L.fig, 'joy', 4);
    this.emote([0.95, 0.5, 0.62], L);
    yield* this.say('LG1', L.fig, 0.1);
    this.emote(null);
    yield* this.say('L02', L.fig, 0.2);
    // (and he smiles, the two of them)
    // (round 11: near enough to read their faces - wide, they were specks by the stand)
    // (round 14: over his shoulder at her, teasing him - her face in the evening's light; the two of
    // them side on were two dark shapes against the sky at the picture's edges)
    this.shot({ from: this.ots(P, L, { back: 1.05, side: 0.66, h: 1.5 }), look: () => { const h = this.headJ(L) || v3(L.pos.x, 1.1, L.pos.z); return v3(h.x, h.y - 0.12, h.z); }, fov: 38, dur: 2.2, hand: 0.4 });
    this.feel(P.fig, 'joy', 1.8);
    yield 0.6;
    // her uncle, up on a board by the way onto the pier: she sees him - and runs over to it
    const B = this.lilyBoard();
    L.fig.lookAt = v3(B.x, B.cy, B.z);
    this.feel(L.fig, 'surprised', 1.0);
    yield 0.45;
    this.feel(L.fig, 'joy', 12);
    this.go(L, B.lx, B.lz, 3.4);
    P.fig.lookAt = L.fig.j.headC;
    yield 0.9;
    // (cut) the board, the camera rising to it - she is there already, pointing up at him (round 11:
    // the run not seen - cut on it, as an animated film does: the run was a doll's)
    this.put(L, B.lx + B.rx * 0.55, B.lz + B.rz * 0.55, B.face);
    this.putDanny(B.lx - B.rx * 0.6 + B.nx * 0.4, B.lz - B.rz * 0.6 + B.nz * 0.4, B.face);
    // (round 14: his feet stopped too - walkTo alone left this.auto walking him on)
    this.walkTo = null;
    this.auto = null;
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
    L.fig.reachR = v3(B.x - B.rx * 2, B.cy + 0.6, B.z - B.rz * 2);
    yield 2.4;
    // (ROADMAP 18.9: the board seen, then her face as she asks - not a speck under it for her line)
    // (round 14: her arm down again - held up, from below her ice cream was over her mouth)
    L.fig.reachR = null;
    L.fig.lookAt = v3(B.x, B.cy, B.z);
    // (round 14: from low, up at her as she looks up at it - the evening's sky and its palms over her)
    this.shot({ ...this.single(L, v3(B.x, B.cy, B.z), { dist: 0.95, side: -0.5, up: -0.22, drop: -0.08 }), fov: 38, dur: 3.2, hand: 0.35 });
    yield* this.say('L03', L.fig, 0.4);
    // his answer over the board itself, from below, beside him: the face that wants the city
    L.fig.reachR = null;
    this.walkTo = null;
    this.auto = null;
    this.putDanny(B.lx - B.rx * 0.6 + B.nx * 0.4, B.lz - B.rz * 0.6 + B.nz * 0.4, B.face);
    this.put(L, B.lx + B.rx * 0.55, B.lz + B.rz * 0.55, B.face);
    const top = v3(B.x, B.cy + 0.4, B.z);
    P.fig.lookAt = top;
    L.fig.lookAt = top;
    {
      const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      this.shot({ from: v3(h.x + B.nx * 1.3 - B.rx * 0.9, h.y - 0.4, h.z + B.nz * 1.3 - B.rz * 0.9), to: v3(h.x + B.nx * 1.45 - B.rx * 1.0, h.y - 0.45, h.z + B.nz * 1.45 - B.rz * 1.0), look: v3(B.x - B.rx * 1.2, B.cy + 0.3, B.z - B.rz * 1.2), fov: 46, dur: 4, hand: 0.3 });
    }
    this.feel(P.fig, 'smirk', 5);
    const d02 = this.say('D02', P.fig, 0.25);
    const d02w = d02.next().value || 0;
    yield 2.0;
    // (and on him, as he says it: the board, then her)
    // (round 14: level with him, from his lit side - from below it was his dark face against the sky)
    this.shot({ ...this.single(P, top, { dist: 1.25, side: 0.55, up: 0.0, drop: 0.12 }), fov: 36, dur: 3.2, hand: 0.3 });
    yield Math.max(0, d02w - 2.0);
    // she turns to him (round 14: turned on the cut to her - not turning through its first frames)
    this.faceTo(L, P.pos.x, P.pos.z);
    L.fig.lookAt = P.fig.j.headC;
    P.fig.lookAt = L.fig.j.headC;
    this.shot({ ...this.single(L, P, { dist: 1.05, side: 0.5, up: -0.04, drop: 0.07 }), fov: 34, dur: 2.6, hand: 0.3 });
    yield 0.25;
    yield* this.say('L04', L.fig, 0.2);
    // his face: deadpan, an eye on the board, then on her
    P.yaw = Math.atan2(L.pos.x - P.pos.x, L.pos.z - P.pos.z) * 0.5 + B.face * 0.5;
    P.fig.yaw = P.yaw;
    // (round 10: a dry beat - pushed in on his deadpan face, the frame a little tilted)
    {
      // (round 14: not from under his chin - a little below his eyes)
      const A = this.single(P, L, { dist: 1.5, side: -0.42, up: -0.13, drop: 0.1 });
      const Bn = this.single(P, L, { dist: 1.15, side: -0.36, up: -0.11, drop: 0.1 });
      this.shot({ from: A.from, to: Bn.from, look: A.look, fov: 34, dur: 3.0, hand: 0.25, roll: 0, rollTo: -0.05, dof: 0.8 });
    }
    P.fig.lookAt = top;
    yield 0.2;
    const d03 = this.say('D03', P.fig, 0.05);
    const d03w = d03.next().value || 0;
    yield Math.min(1.2, d03w);
    P.fig.lookAt = L.fig.j.headC;
    yield Math.max(0, d03w - 1.2);
    // and she laughs - a real laugh: the two of them, the board over them
    this.feel(L.fig, 'joy', 3);
    this.feel(P.fig, 'joy', 3);
    // (round 11: the comic's page ON her laugh - it came before it, in silence: him as the laugh
    // starts, her at its height, then the two of them wide as it trails off)
    const l05 = this.say('L05', L.fig, 0.4);
    const l05w = l05.next().value || 2.6;
    const C2 = this.comic;
    let used = 0;
    if (C2 && C2.page) {
      C2.page([
        [[0.015, 0.03], [0.48, 0.03], [0.46, 0.97], [0.015, 0.97]],
        [[0.5, 0.03], [0.985, 0.03], [0.985, 0.97], [0.48, 0.97]],
      ]);
      this.shot({ ...this.single(P, L, { dist: 1.2, side: -0.36, up: -0.18, drop: 0.12 }), fov: 34, dur: 1, hand: 0.2 });
      C2.panel(0, { u: 0.5, v: 0.46 });
      this.sample('sfx/gone_whoosh.mp3', 0.22);
      yield 0.55;
      this.shot({ ...this.single(L, P, { dist: 0.95, side: 0.4, up: 0.02, drop: 0.07 }), fov: 34, dur: 1, hand: 0.2 });
      C2.panel(1, { u: 0.5, v: 0.46 });
      yield 0.85;
      if (C2.endPage) C2.endPage(0.18);
      used = 1.4;
    }
    const two1 = this.two(P, L, { dist: 2.5, h: 1.12, lookH: 1.28, sgn: -1 });
    this.shot({ from: two1.from(), to: two1.from(0.25), look: two1.look(), fov: 44, dur: 2.8, hand: 0.3 });
    yield Math.max(0.6, l05w - used + 0.3);
    L.fig.lookAt = null;
    P.fig.lookAt = null;
    // the walk: her at his side, the marker on the pier
    L.pl.follow = true;
    this.film(false);
    this.objective('Walk with <b>Lily</b> to the pier', VIEW.x, VIEW.z, 'Pier');
    this.howto('pier', 8);
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
    // (to the wheel: u; to her right, where he stands: (-uz, ux))
    const rx = -uz;
    const rz = ux;
    // (her ice cream finished on the way: her hands free for her drawing)
    if (this.castMod && this.castMod.giveIceCream) this.castMod.giveIceCream(L.fig, false);
    // the two of them at the railing, the wheel ahead (he on her right)
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, toW);
    this.put(L, VIEW.x, VIEW.z, toW);
    this.spawnPier();
    // (round 14: the pier full of the evening's people, in groups - the man's crowd to hide in)
    this.crowdGroups();
    // (ROADMAP 18.9: no kids' voices - the wheel's life heard as its music; round 11: the music box's
    // waltz cute but tense, on from her stand - score.js FILES.tense - and so not begun again here)
    this.cue('dread', { fade: 2.5 });
    // against the sunset: the wheel from the beach, full of people
    this.shot({ from: [76, 2.4, 297], to: [80, 3.6, 292], look: [128, 28, 243], lookTo: [128, 29, 243], fov: 54, fovTo: 50, dur: 4.6, hand: 0.35 });
    // (round 13: this picture of it kept - the memory that flashes in his head once it is gone)
    yield 2.0;
    if (this.comic && this.comic.keepNext) this.comic.keepNext();
    yield 2.2;
    // the two of them small at the railing from behind and low, the wheel over them: so high!
    const W0 = v3(WHEEL.x, 34, WHEEL.z);
    L.fig.lookAt = W0;
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    L.fig.reachR = v3(WHEEL.x, 44, WHEEL.z);
    this.shot({ from: [VIEW.x - ux * 5.6, 0.95, VIEW.z - uz * 5.6], to: [VIEW.x - ux * 5.0 + rx * 0.05, 0.98, VIEW.z - uz * 5.0 + rz * 0.05], look: [WHEEL.x, 22, WHEEL.z], lookTo: [WHEEL.x, 23, WHEEL.z], fov: 52, dur: 3.6, hand: 0.35 });
    this.feel(L.fig, 'surprised', 2.4);
    yield 0.3;
    yield* this.say('L19', L.fig, 0.15);
    // her face, from in front and below, turned up to it: its lights, its colours
    L.fig.reachR = null;
    this.feel(L.fig, 'joy', 6);
    // (round 10: wonder - pushed in on her, the world behind her gone gold, the lights in her eyes)
    {
      const A = this.single(L, W0, { dist: 1.15, side: 0.38, up: -0.24, drop: -0.02 });
      const Bn = this.single(L, W0, { dist: 0.85, side: 0.32, up: -0.2, drop: -0.02 });
      this.shot({ from: A.from, to: Bn.from, look: A.look, fov: 36, dur: 3.0, hand: 0.25, dof: 1 });
    }
    this.emote([1.0, 0.72, 0.3], L);
    yield 0.2;
    yield* this.say('L20', L.fig, 0.1);
    this.emote(null);
    // (what she sees: the lights)
    this.shot({ from: [VIEW.x + ux * 0.2 - rx * 1.3, 1.2, VIEW.z + uz * 0.2 - rz * 1.3], look: [WHEEL.x, 21, WHEEL.z], lookTo: [WHEEL.x, 27, WHEEL.z], fov: 23, fovTo: 20, dur: 2.0, hand: 0.25 });
    yield 1.8;
    // to him: can she go on it too? please? (a step to him, his hand in hers, tugging at it) - the two of
    // them from behind and low, the wheel between them
    const near = { x: VIEW.x + rx * 0.45, z: VIEW.z + rz * 0.45 };
    this.put(L, near.x, near.z, Math.atan2(P.pos.x - near.x, P.pos.z - near.z));
    // (and he turns to her: from here they talk face to face)
    P.yaw = Math.atan2(near.x - P.pos.x, near.z - P.pos.z);
    P.fig.yaw = P.yaw;
    L.fig.lookAt = P.fig.j.headC;
    P.fig.lookAt = L.fig.j.headC;
    L.fig.reachL = P.fig.j.handR;
    {
      const mx = (near.x + P.pos.x) / 2;
      const mz = (near.z + P.pos.z) / 2;
      // (round 14: low behind them, the whole wheel over the two of them - and held: her asking is the
      // shot; from eye height it was two small figures under half a wheel, a second and a quarter)
      this.shot({ from: [mx - ux * 2.4, 0.85, mz - uz * 2.4], to: [mx - ux * 2.2, 0.86, mz - uz * 2.2], look: [mx + ux * 2, 2.2, mz + uz * 2], fov: 48, dur: 3.6, hand: 0.35 });
    }
    yield 0.15;
    // (round 10: her pleading face, an anime's - in close on her eyes, the world behind her pink)
    const pl = this.say('L21', L.fig, 0.25);
    const plw = pl.next().value || 0;
    yield Math.min(1.9, plw * 0.55);
    this.shot({ ...this.single(L, P, { dist: 0.7, side: 0.2, up: -0.05, drop: 0.06 }), fov: 30, dur: 2.2, hand: 0.25, dof: 1 });
    this.emote([1.0, 0.55, 0.7], L);
    yield Math.max(0.6, plw - Math.min(1.9, plw * 0.55));
    this.emote(null);
    L.fig.reachL = null;
    // him, warm: from her side, below
    this.shot({ ...this.single(P, L, { dist: 1.4, side: -0.36, up: -0.3, drop: 0.12 }), fov: 34, dur: 2.6, hand: 0.3 });
    this.feel(P.fig, 'joy', 2.6);
    yield* this.say('D27', P.fig, 0.3);
    // (ROADMAP 18.9) she will draw it: her sketchbook out, at the railing, the page against it - and
    // she starts, the wheel first. Her drawing comes as she draws it (game/prologue/ui.js lilyDrawing k)
    const page = this.lilyPage();
    // (round 14: her time over the page - the wheel's lines and its gondolas while he is away; the
    // colours, the sky, the sea, her name, when he comes back and sees her at it: lilyParts)
    const LP = lilyParts();
    let drawK = 0;
    const drawOn = () => page.draw(lilyDrawing, drawK);
    // (ROADMAP 18.9: sitting on a bench a step back from the railing, her sketchbook on her knees, the
    // pencil going - the player's word: she sits, and she is seen drawing)
    const bx = VIEW.x - ux * 1.1;
    const bz = VIEW.z - uz * 1.1;
    if (this.set && this.set.bench) this.set.bench(bx, L.pos.y || 0, bz, toW);
    this.put(L, bx, bz, toW);
    L.fig.sit = 1;
    this.repose(L);
    L.baseY = 0.3;
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, toW);
    page.hold(L.fig, null, 'draw');
    // (her coloured pencil on the page where the colour goes on: page.js follow)
    page.follow = true;
    drawOn();
    L.fig.lookAt = page.at;
    P.fig.lookAt = v3(WHEEL.x, 26, WHEEL.z);
    this.feel(L.fig, 'joy', 8);
    {
      // (her at it, in profile from her left, her face and the page; he beside her, at the wheel)
      const h = this.headJ(L) || v3(L.pos.x, 1.1, L.pos.z);
      this.shot({ from: [h.x - rx * 1.5 + ux * 0.35, h.y - 0.05, h.z - rz * 1.5 + uz * 0.35], to: [h.x - rx * 1.35 + ux * 0.3, h.y - 0.04, h.z - rz * 1.35 + uz * 0.3], look: [h.x + rx * 0.2, h.y - 0.12, h.z + rz * 0.2], fov: 38, dur: 3.0, hand: 0.25 });
    }
    // (she looks up at it and down at her page, as one who draws from the thing does)
    this.sketching = true;
    this.everyFrame = (dt) => {
      // (the wheel's lines and its gondolas, at a child's pace; then a while over the same lines again,
      // her pencil not on a new one: follow off)
      const cap = LP.sky - 0.001;
      drawK = Math.min(cap, drawK + dt * 0.0105);
      page.follow = drawK < cap;
      drawOn();
      const tt = this.clock || 0;
      L.fig.lookAt = Math.sin(tt * 1.3) > 0.35 ? W0 : page.tipW;
    };
    yield 2.6;
    // (over her shoulder: the first lines of it on her page - and the wheel itself beyond it)
    // (round 14: on her page first - its first lines under her pencil - then up from it to the wheel
    // itself: the page had been below the picture, the camera over it looking past it)
    this.shot({ from: () => v3(page.at.x - ux * 0.5 + rx * 0.32, page.at.y + 0.42, page.at.z - uz * 0.5 + rz * 0.32), look: () => page.at.clone(), lookTo: () => v3(page.at.x + ux * 8, page.at.y + 3.6, page.at.z + uz * 8), fov: 40, dur: 2.4, ease: 'inout', hand: 0.2 });
    yield 2.0;
    // (round 14, the player's word) the man: Danny feels it and looks round - behind them, among the
    // evening's people, a man standing still, looking at him; on his shirt, over his heart, a mark that
    // is something like an eraser, and not one
    const man = this.markMan(VIEW.x - ux * 11 + rx * 3.4, VIEW.z - uz * 11 + rz * 3.4);
    this.faceTo(man, P.pos.x, P.pos.z);
    man.pl.speed = 0;
    if (P.fig.j) man.fig.lookAt = P.fig.j.headC;
    // (him, from in front, the wheel behind him: his eyes go, then his head)
    {
      const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      this.shot({ from: [h.x + ux * 1.3 - rx * 0.3, h.y - 0.1, h.z + uz * 1.3 - rz * 0.3], to: [h.x + ux * 1.15 - rx * 0.27, h.y - 0.09, h.z + uz * 1.15 - rz * 0.27], look: [h.x, h.y - 0.05, h.z], fov: 34, dur: 1.5, hand: 0.2 });
    }
    yield 0.45;
    P.fig.lookAt = man.fig.j && man.fig.j.headC ? man.fig.j.headC : v3(man.pos.x, 1.6, man.pos.z);
    yield 0.95;
    // (round, facing him)
    P.yaw = Math.atan2(man.pos.x - P.pos.x, man.pos.z - P.pos.z);
    P.fig.yaw = P.yaw;
    g.audio.play('dread', 0.8);
    {
      const ph = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const fx0 = Math.sin(P.yaw);
      const fz0 = Math.cos(P.yaw);
      // (from just beside his eyes, long: the man among the people, and then only his chest)
      this.shot({ from: [ph.x + fx0 * 0.25 + fz0 * 0.2, ph.y - 0.05, ph.z + fz0 * 0.25 - fx0 * 0.2], look: () => { const j = man.fig.j; return j && j.neck ? v3(j.neck.x, j.neck.y - 0.12, j.neck.z) : v3(man.pos.x, 1.35, man.pos.z); }, fov: 16, fovTo: 9, dur: 2.0, ease: 'in', hand: 0.6 });
    }
    // (ROADMAP 18.9: the anime's focus lines rushing in at him as the lens closes on him; round 13:
    // and Danny's heart, the picture's edges closing in on each beat - inside his head)
    if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(man), 2.0, 0.7);
    if (this.comic && this.comic.pulse) this.comic.pulse(3, { per: 0.78, k: 0.85, vol: 0.7 });
    yield 2.0;
    // (ROADMAP 18.9: and the mark itself, close - a cut in to it on his chest, held a breath, pushing in:
    // what it is the picture's to say, not anybody's words)
    const SH = this.set && this.set.shirt;
    if (SH && SH.grp) {
      const mp = () => SH.grp.position;
      const fx = Math.sin(man.yaw);
      const fz = Math.cos(man.yaw);
      // (round 14: the moment he is known - his own few notes, and the world round the mark gone to
      // crimson and the dark, only him in it: the two-tone world of a film's moment of recognition)
      this.cue('mark');
      this.emote([0.6, 0.04, 0.08], man);
      this.shot({ from: () => v3(mp().x + fx * 0.8 + fz * 0.12, mp().y - 0.06, mp().z + fz * 0.8 - fx * 0.12), to: () => v3(mp().x + fx * 0.62 + fz * 0.08, mp().y - 0.04, mp().z + fz * 0.62 - fx * 0.08), look: () => v3(mp().x, mp().y + 0.02, mp().z), fov: 34, fovTo: 30, dur: 1.4, ease: 'in', hand: 0.3 });
      yield 1.35;
    }
    // (his face: what was that)
    this.emote(null);
    this.feel(P.fig, 'worried', 4);
    this.shot({ ...this.single(P, man, { dist: 1.35, side: 0.34, up: -0.18, drop: 0.08 }), fov: 32, dur: 1.5, hand: 0.35 });
    // (and along the pier from the town a tour's whole group coming this way, behind its guide - the
    // man turns from Danny and walks off fast, straight into them; they close round him)
    const tour = this.tourGroup(man);
    yield 1.3;
    man.fig.lookAt = null;
    {
      const ph = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const fx0 = Math.sin(P.yaw);
      const fz0 = Math.cos(P.yaw);
      const from = v3(ph.x + fx0 * 0.3 - fz0 * 0.35, ph.y - 0.02, ph.z + fz0 * 0.3 + fx0 * 0.35);
      // (round 14: a long lens on him from Danny's eyes - him among them, then them closing round him;
      // at 30 he and the group were specks across a plaza)
      this.shot({ from, look: () => v3(man.pos.x, man.pos.y + 1.2, man.pos.z), fov: 13, fovTo: 11, dur: 3.2, hand: 0.45 });
    }
    {
      let t = 0;
      yield () => {
        t += this.dtR || 1 / 30;
        const c = tour.c;
        this.go(man, c.x, c.z, 2.3);
        return t > 3.0 || (t > 1.8 && Math.hypot(man.pos.x - c.x, man.pos.z - c.z) < 1.0);
      };
    }
    // (the player's: where did he go - he is in among them somewhere, and he does not mean to be found)
    this.film(false);
    this.objective('Where did he go? <b>Find him</b> in the crowd');
    if (g.gps) g.gps.clear();
    this.howto('follow', 9);
    yield* this.hideAndSeek(man);
    this.objective(null);
    // (round 14, the player's word: back with her, and the drawing done in front of us - her coloured
    // pencils, the colours going on under them, the sky, the sun, the sea, her name; not a drawing that
    // is just there)
    this.film(true);
    // (the tour's group done with its walking: gathered round its guide along the north railing, out of
    // the way of the wheel and the two of them - the shots to come look along the pier)
    if (this.crowds && this.crowds.tour) {
      const T = this.crowds.tour;
      T.goal = { x: 86, z: 246.3 };
      T.speed = 0.9;
      // (there already if nobody sees: not marching through the next shots)
      T.c.x = T.goal.x;
      T.c.z = T.goal.z;
      for (const q of T.members) {
        if (!q.alive) continue;
        const [ox, oz] = T.offs[q.tourI];
        this.put(q, T.c.x + ox, T.c.z + oz, Math.atan2(-ox, -oz));
      }
    }
    {
      const fx = Math.sin(L.yaw || toW);
      const fz = Math.cos(L.yaw || toW);
      // (her right: (-fz, fx))
      // (over the page from her right side and above it - clear of her head and her hair)
      const camOver = () => v3(page.at.x - fx * 0.12 - fz * 0.38, page.at.y + 0.5, page.at.z - fz * 0.12 + fx * 0.38);
      // (him a few steps off along the pier, coming back to her)
      const d0x = bx - ux * 6.5 + rx * 2.4;
      const d0z = bz - uz * 6.5 + rz * 2.4;
      this.putDanny(d0x, d0z, Math.atan2(bx - d0x, bz - d0z));
      P.fig.lookAt = null;
      drawK = Math.max(drawK, LP.sky);
      page.follow = true;
      // (a part of it in each shot: the sky in the first, the sun, the sea and the pier, her name)
      const segs = [[LP.sky, LP.sun, 3.0], [LP.sun, LP.sea, 1.9], [LP.sea, LP.name, 2.7], [LP.name, 1, 1.8]];
      let si = 0;
      let st = 0;
      this.everyFrame = (dt) => {
        if (si < segs.length) {
          const sg = segs[si];
          st += dt;
          const f = Math.min(1, st / sg[2]);
          drawK = sg[0] + (sg[1] - sg[0]) * f;
          if (f >= 1) {
            si++;
            st = 0;
          }
        }
        drawOn();
        L.fig.lookAt = page.tipW;
      };
      this.feel(L.fig, 'joy', 12);
      // 1. close over her shoulder: the sky going on under her pencil, band by band
      this.shot({ from: camOver, look: () => page.tipW.clone().lerp(page.at, 0.35), fov: 30, dur: 3.0, hand: 0.12, dof: 0.6 });
      yield 3.0;
      // 2. her face, low and in front of her: all of her in it
      this.shot({ ...this.single(L, W0, { dist: 0.85, side: 0.26, up: -0.2, drop: 0.03 }), fov: 34, dur: 1.9, hand: 0.2 });
      yield 1.9;
      // 3. from the wheel's side, wide: her on the bench colouring, and him coming back along the pier
      this.walkTo = { x: VIEW.x + rx * 1.3, z: VIEW.z + rz * 1.3, speed: 0.42 };
      // (round 14: in front of her, at her - her colouring big in the picture, and over her shoulder,
      // behind her, him coming back along the pier to her; from the wheel's side far off he was a speck)
      {
        const hl = () => this.headJ(L) || v3(L.pos.x, 1.0, L.pos.z);
        this.shot({
          from: () => { const h = hl(); return v3(h.x + ux * 1.55 + rx * 0.55, h.y + 0.12, h.z + uz * 1.55 + rz * 0.55); },
          look: () => { const h = hl(); const p = this.headJ(P) || v3(P.pos.x, 1.6, P.pos.z); return v3(h.x * 0.84 + p.x * 0.16, h.y - 0.05, h.z * 0.84 + p.z * 0.16); },
          fov: 44,
          dur: 2.7,
          hand: 0.25,
        });
      }
      yield 2.7;
      // 4. close: her name, the last of it
      // (round 14: held on the page, where her name goes - not after the pencil's point as it leaves it)
      {
        const off = page.tipW.clone().sub(page.at).multiplyScalar(0.55);
        this.shot({ from: () => camOver().lerp(page.at.clone().add(off), 0.25), look: () => page.at.clone().add(off), fov: 28, dur: 1.8, hand: 0.1, dof: 0.7 });
      }
      yield 1.8;
      // (his walk stopped where it is: walkTo alone left his feet going - this.auto - and he walked off
      // out of the next shots)
      this.walkTo = null;
      this.auto = null;
    }
    this.everyFrame = null;
    this.sketching = false;
    drawK = 1;
    drawOn();
    page.follow = false;
    // she cannot wait to show him: up off the bench, the page held up to him - the page, and her face
    // over it
    L.fig.sit = 0;
    this.repose(L);
    L.baseY = 0;
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, Math.atan2(-rx, -rz));
    this.put(L, VIEW.x + rx * 0.4, VIEW.z + rz * 0.4, Math.atan2(rx, rz));
    page.hold(L.fig, () => P.fig.j.headC, 'show');
    L.fig.lookAt = P.fig.j.headC;
    P.fig.lookAt = page.at;
    this.feel(L.fig, 'joy', 4);
    yield 0.5;
    {
      const pa = page.at;
      const hD = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const dx = hD.x - pa.x;
      const dz = hD.z - pa.z;
      const d = Math.hypot(dx, dz) || 1;
      this.shot({ from: [pa.x + (dx / d) * 0.85, pa.y + 0.3, pa.z + (dz / d) * 0.85], to: [pa.x + (dx / d) * 0.72, pa.y + 0.28, pa.z + (dz / d) * 0.72], look: [pa.x, pa.y + 0.14, pa.z], fov: 44, dur: 3.0, hand: 0.3 });
    }
    yield 0.2;
    yield* this.say('L06', L.fig, 0.3);
    // he takes his time over it
    this.feel(P.fig, 'smirk', 3);
    this.shot({ ...this.single(P, L, { dist: 1.4, side: 0.36, up: -0.3, drop: 0.12 }), fov: 34, dur: 2.4, hand: 0.3 });
    yield 0.5;
    P.fig.lookAt = L.fig.j.headC;
    yield* this.say('D04', P.fig, 0.2);
    // not bad?!
    page.hold(L.fig, () => P.fig.j.headC, 'low');
    // (round 10: an anime's comic outrage - a snap in on her, the lines; round 11: in her own colour,
    // the pink of every one of her moments - red is the danger's only)
    {
      const A = this.single(L, P, { dist: 1.3, side: 0.52, up: -0.03, drop: 0.08 });
      const Bn = this.single(L, P, { dist: 0.75, side: 0.36, up: -0.02, drop: 0.08 });
      this.shot({ from: A.from, to: Bn.from, look: A.look, fov: 34, dur: 0.3, ease: 'out', hand: 0.2, shake: 0.03 });
    }
    this.feel(L.fig, 'surprised', 1.4);
    this.emote([1.0, 0.36, 0.62], L);
    if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(L), 1.2, 0.8);
    yield* this.say('L07', L.fig, 0.2);
    this.emote(null);
    // the two of them, laughing: from the wheel's side, the city behind them
    {
      const mx = (L.pos.x + P.pos.x) / 2;
      const mz = (L.pos.z + P.pos.z) / 2;
      // (far enough and high enough for his head with hers: it went off the top of the picture)
      // (round 14: nearer - the two of them big enough for their faces, his head still in it)
      this.shot({ from: [mx + ux * 2.9 + rx * 0.5, 1.3, mz + uz * 2.9 + rz * 0.5], to: [mx + ux * 2.65 + rx * 0.46, 1.3, mz + uz * 2.65 + rz * 0.46], look: [mx, 1.32, mz], fov: 44, dur: 3.4, hand: 0.35 });
    }
    this.feel(P.fig, 'joy', 3);
    this.feel(L.fig, 'joy', 6);
    yield* this.say('D05', P.fig, 0.1);
    page.hold(L.fig, null, 'hug');
    yield 0.7;
    page.release();
    // both of them back to the railing, at the wheel
    this.put(L, VIEW.x, VIEW.z, toW);
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, toW);
    L.fig.lookAt = W0;
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    // up there: a boy at his gondola's sill, waving down to his mother (seen, not heard - the waltz
    // over it), the camera drawing back until the whole wheel is in it again
    const gi = this.lowGondola();
    this.heroRiders(gi);
    const kid = this.heroes[0];
    // (ROADMAP 18.9: the unease from here - under the boy waving, the waltz going wrong - so that it
    // has grown through all of it by the time the wheel is gone: score.js FILES.unease)
    // (round 13: the dread on under it all, unbroken, till the wheel is gone - no new music here)
    this.shot({ from: () => this.gondolaCam(gi, -3.0, -2.25, -0.12), to: () => this.gondolaCam(gi, -17, -7.5, 4.5), look: () => this.headJ(kid) || this.gondolaAt(gi, -1.0, -2.3, 0), lookTo: () => this.gondolaAt(gi, 0, -4, 0), fov: 20, fovTo: 46, dur: 4.4, ease: 'inout', hand: 0.45 });
    yield 4.2;
    // the two of them at the railing from behind, the wheel turning against the sky - and under the
    // evening something that should not be there: the waltz winding down, out of tune, and the
    // unease growing under it (game/prologue/score.js unease)
    const wideFrom = [VIEW.x - ux * 4.2 + rx * 1.9, 1.1, VIEW.z - uz * 4.2 + rz * 1.9];
    const wideTo = [VIEW.x - ux * 3.9 + rx * 1.85, 1.12, VIEW.z - uz * 3.9 + rz * 1.85];
    this.shot({ from: wideFrom, to: wideTo, look: [WHEEL.x, 24, WHEEL.z], fov: 50, dur: 6, ease: 'lin', hand: 0.3 });
    yield 2.4;
    // it begins to be rubbed out, at the top: no eraser seen, only what it does (game/prologue/set.js:
    // the paper coming through where it goes, its crumbs, its rub; the comic's marks round it) - row
    // after row, seven seconds; their eyes on it as it goes
    const tip = S.eraser ? S.eraser.pos : W0;
    L.fig.lookAt = tip;
    P.fig.lookAt = tip;
    // (round 14, the player's word - the wheel's sound with what is seen: each stroke of the eraser heard
    // as it turns, a stroke of the recorded rub on it (set.js onRub, rubGrain) - the recording played
    // whole had a rhythm of its own and rubbed on after the eraser had stopped; and the moment it is
    // gone, on the very frame it goes: set.js onGone, goneNow)
    S.onRub = () => this.rubGrain();
    S.onGone = () => this.goneNow();
    S.erase();
    this.airDip = 0.5;
    const C = this.comic;
    if (C && S.eraser) C.rub(S.eraser);
    const et = () => (S.erasing ? S.erasing.t : 99);
    const X = S.eraser;
    const onX = (dy = 0) => () => (X ? v3((X.pos.x + WHEEL.x) / 2, X.pos.y + dy, (X.pos.z + WHEEL.z) / 2) : v3(WHEEL.x, 40, WHEEL.z));
    // (close on it, the camera after it: the top gondolas' colours going to paper, the crumbs)
    // (round 9: the frame tilting as it goes on - nothing is right any more)
    this.shot({ from: [VIEW.x + ux * 0.2 - rx * 1.3, 1.2, VIEW.z + uz * 0.2 - rz * 1.3], look: onX(-5), fov: 30, fovTo: 27, dur: 1.6, hand: 0.45, roll: 0, rollTo: 0.09 });
    if (C && X) C.word('SHHHK!', v3(X.pos.x, X.pos.y + 9, X.pos.z), { life: 0.9, size: 0.085, fill: '#fffaf0', burst: '#ff6f9a', tilt: -0.16 });
    yield () => et() > 1.4;
    // her: it cannot be - her mouth open, the page against her
    this.feel(L.fig, 'scared', 14);
    page.hold(L.fig, null, 'hug');
    if (C) C.rub(null);
    // (round 9: in on her eyes - an anime's close, the world behind her gone soft)
    {
      const A = this.single(L, v3(WHEEL.x, 1.1, WHEEL.z), { dist: 0.9, side: 0.16, up: -0.04, drop: -0.06 });
      const B = this.single(L, v3(WHEEL.x, 1.1, WHEEL.z), { dist: 0.62, side: 0.12, up: -0.03, drop: -0.06 });
      this.shot({ from: A.from, to: B.from, look: A.look, fov: 26, dur: 1.4, hand: 0.35, dof: 1 });
    }
    yield () => et() > 2.6;
    // him: what is it doing
    this.feel(P.fig, 'shock', 14);
    {
      const A = this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.5, side: -0.2, up: -0.22, drop: -0.02 });
      const B = this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.15, side: -0.18, up: -0.2, drop: -0.02 });
      this.shot({ from: A.from, to: B.from, look: A.look, fov: 36, dur: 1.4, hand: 0.4, roll: -0.02, rollTo: -0.1, dof: 0.7 });
    }
    yield () => et() > 3.8;
    // the whole of it from behind them: half of it gone, going on down it
    // (round 9: from high over the pier - the people under it, not one of them looking up)
    this.shot({ from: [VIEW.x - ux * 9 + rx * 6, 9.5, VIEW.z - uz * 9 + rz * 6], to: [VIEW.x - ux * 8.4 + rx * 5.6, 10.2, VIEW.z - uz * 8.4 + rz * 5.6], look: [WHEEL.x, 14, WHEEL.z], fov: 54, dur: 1.4, ease: 'lin', hand: 0.3, roll: 0.06 });
    if (C && X) C.rub(X);
    yield () => et() > 5.0;
    // (round 14: the comic's page now, while the last third of it goes - where it is going, her face,
    // his - and then the last of it seen to go, on the screen, not behind the page as it was)
    if (C) C.rub(null);
    if (C && C.page) {
      C.page([
        [[0.015, 0.03], [0.39, 0.03], [0.355, 0.97], [0.015, 0.97]],
        [[0.405, 0.03], [0.69, 0.03], [0.655, 0.97], [0.37, 0.97]],
        [[0.705, 0.03], [0.985, 0.03], [0.985, 0.97], [0.67, 0.97]],
      ]);
      this.shot({ from: wideFrom, look: [WHEEL.x, 14, WHEEL.z], fov: 46, dur: 1, hand: 0.3 });
      C.panel(0, { u: 0.56, v: 0.5 });
      yield 0.38;
      this.shot({ ...this.single(L, v3(WHEEL.x, 1.1, WHEEL.z), { dist: 1.0, side: 0.12, up: -0.2, drop: -0.05 }), fov: 38, dur: 1, hand: 0.3 });
      C.panel(1, { u: 0.5, v: 0.48 });
      yield 0.36;
      this.shot({ ...this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.3, side: -0.12, up: -0.22, drop: -0.04 }), fov: 36, dur: 1, hand: 0.3 });
      C.panel(2, { u: 0.5, v: 0.48 });
      yield 0.42;
      if (C.endPage) C.endPage(0.1);
    }
    // the last of it, from behind them at the railing: its bottom going, row after row - and gone, the
    // flash and the rush of air on the very frame (goneNow)
    // (round 14: in on the last of it - its last gondolas big enough to be seen go; from beside him,
    // his back at the edge of it - from behind him his back stood over where it went)
    this.shot({ from: [VIEW.x - ux * 4.2 + rx * 3.4, 1.15, VIEW.z - uz * 4.2 + rz * 3.4], look: [WHEEL.x, 9, WHEEL.z], lookTo: [WHEEL.x, 11, WHEEL.z], fov: 27, dur: 2.4, hand: 0.25, roll: 0.03, rollTo: 0.07 });
    if (C && X) C.rub(X);
    if (C && X) C.word('SHHHHK!', v3(X.pos.x, X.pos.y + 6, X.pos.z), { life: 0.8, size: 0.075, fill: '#fffaf0', burst: '#ff6f9a', tilt: 0.18 });
    yield () => !S.erasing;
    if (C) C.rub(null);
    // (and at once nobody down there is waving up at anything)
    S.forget();
    L.fig.reachR = null;
    L.fig.reachL = null;
    P.fig.reachL = null;
    // (ROADMAP 18.9: the moment it is gone, on his face - in fast and close, an impact frame, the focus
    // lines; then hers)
    this.feel(L.fig, 'shock', 8);
    this.feel(P.fig, 'shock', 8);
    P.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    L.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    // (round 13, the player's word: the reactions at once - not seconds of pictures first, then the
    // words. Him, the instant it is gone: in on his face, the dolly zoom, red, the sting - and his
    // words a breath after it; over him, where it stood, from her eyes; her, cold - and hers as his end)
    const wv = v3(WHEEL.x, 1.7, WHEEL.z);
    {
      const A = this.single(P, wv, { dist: 0.95, side: 0.14, up: -0.06, drop: 0.04 });
      const B = this.single(P, wv, { dist: 2.6, side: 0.3, up: -0.12, drop: 0.06 });
      this.shot({ from: A.from, to: B.from, look: A.look, fov: 44, vertigo: true, dur: 1.9, ease: 'inout', hand: 0.1, shake: 0.05 });
      if (C && C.impact) C.impact(this.headJ(P), 0.1);
      this.emote([0.55, 0.08, 0.1], P);
      this.sample('sfx/sting.mp3', 0.75);
      if (C && C.focus) C.focus(() => this.headJ(P), 1.6, 1);
    }
    yield 0.75;
    const d29 = this.say('D29', P.fig, 0.1);
    const d29w = d29.next().value || 4.5;
    // (inside his head: it was there - a flash of it as it was, white, gone)
    yield 0.9;
    this.emote(null);
    this.memoryFlash();
    // (over her shoulder, the lens on her - then pulled out to where it stood: the empty sky sharp)
    {
      const h = this.headJ(L) || v3(L.pos.x, 1.1, L.pos.z);
      const fr = v3(h.x - ux * 0.75 + rx * 0.35, h.y + 0.12, h.z - uz * 0.75 + rz * 0.35);
      const far = fr.distanceTo(v3(WHEEL.x, 24, WHEEL.z));
      this.shot({ from: fr, to: fr.clone().add(v3(-ux * 0.15, 0.02, -uz * 0.15)), look: [WHEEL.x, 22, WHEEL.z], fov: 42, dur: 2.0, hand: 0.15, focus: [0.8, far], focusDur: 1.2, dof: 1 });
    }
    yield 1.8;
    // (her: in on her eyes, the colour behind her gone cold - her words as his end)
    this.emote([0.12, 0.16, 0.42], L);
    {
      const LA = this.single(L, wv, { dist: 0.8, side: -0.16, up: 0.0, drop: 0.05 });
      const LB = this.single(L, wv, { dist: 0.62, side: -0.12, up: 0.0, drop: 0.05 });
      this.shot({ from: LA.from, to: LB.from, look: LA.look, fov: 30, dur: 1.8, hand: 0.35, dof: 1 });
    }
    yield Math.max(0.2, d29w - 3.45 - 0.2);
    const l22 = this.say('L22', L.fig, 0.1);
    const l22w = l22.next().value || 5;
    yield 1.4;
    this.emote(null);
    // (and all round them the evening goes on: along the pier people strolling, eating, laughing - not
    // one of them looking up. That is what is wrong)
    // (round 14: at them - the pier's groups along its north railing, talking, and beyond them the sky
    // where it stood, empty; the look along the pier the other way was an empty plaza)
    this.shot({ crowd: true, from: [VIEW.x + ux * 2.5 + rx * 2.4, 1.55, VIEW.z + uz * 2.5 + rz * 2.4], to: [VIEW.x + ux * 3.4 + rx * 2.6, 1.55, VIEW.z + uz * 3.4 + rz * 2.6], look: [VIEW.x + ux * 22 + rx * 8, 1.9, VIEW.z + uz * 22 + rz * 8], fov: 42, dur: Math.max(2.2, l22w - 1.2), hand: 0.3 });
    yield Math.max(1.4, l22w - 1.4);
    L.fig.lookAt = null;
    // (round 13: him through them, to where it stood - stressed, looking round, asking: seen, not
    // walked by the player)
    yield* this.searchMontage();
    this.start(4);
  }

  // (round 14) the moment the wheel is gone, on the very frame the last of it goes (set.js onGone): a
  // flash of white, the air rushing in where it stood, and the dread - not silence: score.js shock
  goneNow() {
    const g = this.game;
    if (this.comic && this.comic.endPage) this.comic.endPage(0.01);
    // (round 14: and where the last of it was, a puff of the eraser's crumbs - drawn, pale, gone)
    if (this.comic && this.comic.puff) this.comic.puff(v3(WHEEL.x, WHEEL.deck + 5, WHEEL.z), { n: 10, size: 9, life: 1.2, col: '#f4e6ee', ink: '#5a4462', spread: 2.4, dir: [0, -0.8], seed: 3 });
    g.audio.play('gone', 1);
    this.flash(0.22, '#fffaf0');
    this.sample('sfx/gone_whoosh.mp3', 0.9);
    this.airDip = 1;
    this.cue('shock', { fade: 0.4 });
  }

  // (round 14) a stroke of the eraser heard as it is seen: on each turn of its rub (set.js onRub) a
  // stroke of the recorded rub - from one of the recording's own strokes, a little under a fifth of a
  // second of it, in and out softly - so the rubbing heard is the rubbing seen, stroke for stroke
  rubGrain() {
    const A = this.game.audio;
    const b = trackBuf('sfx/erase_rub.mp3');
    if (!A || !A.ctx || !A.fx || !b || A.enabled === false) return;
    if (!this.rubOn) this.rubOn = strokesOf(b);
    const on = this.rubOn;
    if (!on.length) return;
    this.rubI = ((this.rubI || 0) + 1 + Math.floor(Math.random() * 3)) % on.length;
    const c = A.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = b;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.01);
    g.gain.setTargetAtTime(0, t + 0.11, 0.035);
    s.connect(g).connect(A.fx);
    s.start(t, Math.max(0, on[this.rubI] - 0.02), 0.3);
    s.onended = () => g.disconnect();
  }

  // (round 13) a thought: words in someone's head, as an anime puts them - in a box at the top of the
  // picture, in brackets, slanting, held a moment, gone (the spoken words stay under it, below)
  // (round 13) what is in his head: (round 14, the player's word) not in brackets, not in a box - the
  // words alone over the picture, slanted, as a thought is written; and heard: whispered in his own
  // voice, his lips still (lines.js TH1-TH6), the music let down under it. Returns how long it is
  thought(id, life = 1.8) {
    if (this.ff || typeof document === 'undefined') return 0;
    const Ln = LINES[id];
    const text = Ln ? Ln.he : id;
    if (!document.getElementById('pro-thought-css')) {
      const st = document.createElement('style');
      st.id = 'pro-thought-css';
      st.textContent = '.pro-thought{position:fixed;z-index:58;left:50%;top:13%;max-width:min(620px,88vw);color:#fff8ec;font:italic 600 clamp(18px,3.4vw,28px)/1.25 "Rubik",system-ui,sans-serif;letter-spacing:.01em;direction:rtl;text-align:center;pointer-events:none;text-shadow:0 0 2px rgba(10,6,20,.95),0 1px 3px rgba(10,6,20,.9),0 0 14px rgba(10,6,20,.75),0 0 28px rgba(10,6,20,.45);opacity:0}';
      document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.className = 'pro-thought';
    el.textContent = text;
    document.body.appendChild(el);
    let dur = 0;
    if (Ln && this.voices && this.voices.say) {
      dur = this.voices.say(id, null, { sub: false, gain: 0.8 }) || Ln.dur;
      if (this.score && this.score.under) this.score.under(dur, 0.5);
    }
    life = Math.max(life, dur + 0.55);
    // (on the film's own clock, as everything in it: tickThoughts - a paused game holds it)
    (this.thoughts || (this.thoughts = [])).push({ el, t: 0, life });
    return life;
  }

  clearThoughts() {
    for (const q of this.thoughts || []) q.el.remove();
    this.thoughts = [];
  }

  tickThoughts(dt) {
    if (!this.thoughts || !this.thoughts.length) return;
    this.thoughts = this.thoughts.filter((q) => {
      q.t += dt;
      const k = q.t / q.life;
      if (k >= 1) {
        q.el.remove();
        return false;
      }
      // (in a little bigger and settling, held, up a touch and out)
      const a = k < 0.12 ? k / 0.12 : k > 0.82 ? (1 - k) / 0.18 : 1;
      const sc = k < 0.12 ? 0.92 + 0.08 * (k / 0.12) : 1;
      const up = k > 0.82 ? -6 * ((k - 0.82) / 0.18) : 0;
      q.el.style.opacity = a.toFixed(3);
      q.el.style.transform = `translateX(-50%) translateY(${up.toFixed(1)}px) rotate(-1.5deg) scale(${sc.toFixed(3)})`;
      return true;
    });
  }

  // (round 13) inside his head, a flash: the wheel as it was a moment ago - white, the picture of it
  // over the empty sky, gone in a breath (comic.js flash, the wheel's own picture: memory)
  memoryFlash(soft = false) {
    const g = this.game;
    // (soft: no white - the picture of it coming up slowly over what is there now, as a memory does,
    // and fading: round 13, the empty place in scene 4, her question in the car at the end)
    if (soft) {
      if (this.comic && this.comic.memory) this.comic.memory(2.4, 0.42);
      return;
    }
    this.flash(0.22, '#fff6e8');
    if (this.comic && this.comic.memory) this.comic.memory(0.55);
    g.audio.play('whoosh', 0.35);
  }

  // (round 13, the player's word) him going among the people to where it stood, asking - frightened,
  // looking round: from in front of him as he pushes through them, the camera with him; his eyes going
  // from one side to the other; round him as he turns where he stands, the pier going round; their
  // faces - eating, talking, smiling, nobody has seen a thing - and in his head, what he will not say
  *searchMontage() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const toS = Math.atan2(SITE.x - P.pos.x, SITE.z - P.pos.z);
    const fx = Math.sin(toS);
    const fz = Math.cos(toS);
    // (Lily after him)
    if (L) L.pl.follow = true;
    this.walkTo = { x: SITE.x - fx * 4, z: SITE.z - fz * 4, speed: 1, sprint: false };
    // (the evening's people on his way: strolling this way along the pier, in twos and alone - he
    // goes through them, and asks two of them. The crowd the man went into has gone by to the town)
    const eve = [];
    for (let i = 0; i < 7; i++) {
      const along = 3.5 + i * 1.9 + Math.random() * 1.2;
      const side = (i % 2 ? 1 : -1) * (0.9 + Math.random() * 2.4);
      const x = P.pos.x + fx * along + fz * side;
      const z = P.pos.z + fz * along - fx * side;
      const q = this.person('eve' + i, x, z, i === 3 ? kidLook(true) : civilianLook(), { face: toS + Math.PI });
      q.noCollide = true;
      if (q.fig) q.fig.lodFar = 0;
      this.go(q, x - fx * 40, z - fz * 40, 0.95 + Math.random() * 0.35);
      eve.push(q);
      this.letGo(q, 'eve' + i);
    }
    // (inside his head: the world gone far off and muffled, only his heart loud - till he shouts at the
    // two at the railing, scene 4: core/audio.js muffle, comic.js pulse)
    if (g.audio.muffle) {
      g.audio.muffle(true);
      this.muffled = true;
    }
    if (this.comic && this.comic.pulse) this.comic.pulse(9, { per: 0.8, k: 0.55, vol: 0.85 });
    // ---- 1. from in front, waist up, going backwards with him: the people going by between
    this.feel(P.fig, 'scared', 9);
    this.shot({ crowd: true, from: () => v3(P.pos.x + fx * 2.6 + fz * 0.4, 1.55, P.pos.z + fz * 2.6 - fx * 0.4), look: () => v3(P.pos.x, 1.45, P.pos.z), fov: 40, dur: 2.4, hand: 0.9 });
    {
      let t = 0;
      yield () => {
        t += this.dtR || 1 / 30;
        // (his head this way and that as he goes)
        P.fig.lookAt = v3(P.pos.x + fx * 6 + fz * Math.sin(t * 2.6) * 5, 1.6, P.pos.z + fz * 6 - fx * Math.sin(t * 2.6) * 5);
        return t > 2.2;
      };
    }
    this.thought('TH2', 1.6);
    // ---- 2. his eyes, close: from one side to the other (the camera going with him as he walks -
    // still, he walked into it)
    {
      const hd = () => this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      // (on his eyes, a little under them: the face, not the hair)
      this.shot({ from: () => { const h = hd(); return v3(h.x + fx * 0.78, h.y - 0.03, h.z + fz * 0.78); }, look: () => { const h = hd(); return v3(h.x, h.y - 0.035, h.z); }, fov: 30, dur: 0.9, hand: 0.2 });
      const h = hd();
      P.fig.lookAt = v3(h.x + fz * 5, h.y, h.z - fx * 5);
      yield 0.45;
      P.fig.lookAt = v3(h.x - fz * 5, h.y, h.z + fx * 5);
      yield 0.45;
    }
    // ---- (round 14) and three at once - a split screen, each its own camera and all of them alive:
    // his eyes going from face to face, the faces going by him (what he sees, long), and Lily behind
    // him, frightened (cyclePanels)
    if (this.comic && this.comic.page && L) {
      const C = this.comic;
      const hd = () => this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const hl = () => this.headJ(L) || v3(L.pos.x, 1.1, L.pos.z);
      C.page([
        [[0.015, 0.03], [0.33, 0.03], [0.312, 0.97], [0.015, 0.97]],
        [[0.346, 0.03], [0.664, 0.03], [0.646, 0.97], [0.328, 0.97]],
        [[0.68, 0.03], [0.985, 0.03], [0.985, 0.97], [0.662, 0.97]],
      ]);
      let sw = 0;
      this.cyclePanels([
        { from: () => { const h = hd(); return v3(h.x + fx * 0.62, h.y - 0.02, h.z + fz * 0.62); }, look: () => { const h = hd(); return v3(h.x, h.y - 0.03, h.z); }, fov: 30, dur: 4, hand: 0.25, crowd: true },
        { from: () => { const h = hd(); return v3(h.x + fx * 0.32 - fz * 0.12, h.y, h.z + fz * 0.32 + fx * 0.12); }, look: () => { const h = hd(); sw += this.dtR || 1 / 30; return v3(h.x + fx * 9 + fz * Math.sin(sw * 1.4) * 3.5, h.y - 0.15, h.z + fz * 9 - fx * Math.sin(sw * 1.4) * 3.5); }, fov: 20, dur: 4, hand: 0.7, crowd: true },
        // (in front of her as she comes after him - her face; from behind her it was the back of her head)
        { from: () => { const h = hl(); return v3(h.x + fx * 0.95 + fz * 0.25, h.y + 0.02, h.z + fz * 0.95 - fx * 0.25); }, look: () => { const h = hl(); return v3(h.x, h.y - 0.04, h.z); }, fov: 32, dur: 4, hand: 0.4, crowd: true },
      ]);
      this.feel(L.fig, 'scared', 6);
      L.fig.lookAt = P.fig.j.headC;
      g.audio.play('whoosh', 0.35);
      C.panel(0, { zoom: 1.5 });
      this.cycle.on[0] = true;
      const h0 = hd();
      P.fig.lookAt = v3(h0.x + fz * 5, h0.y, h0.z - fx * 5);
      yield 0.3;
      C.panel(1, { zoom: 1.3 });
      this.cycle.on[1] = true;
      g.audio.play('whoosh', 0.3);
      yield 0.3;
      C.panel(2, { zoom: 1.5 });
      this.cycle.on[2] = true;
      g.audio.play('whoosh', 0.3);
      P.fig.lookAt = v3(h0.x - fz * 5, h0.y, h0.z + fx * 5);
      yield 0.8;
      P.fig.lookAt = v3(h0.x + fx * 6, h0.y - 0.1, h0.z + fz * 6);
      yield 0.8;
      this.cycle = null;
      this.activeShots = null;
      if (C.endPage) C.endPage(0.12);
    }
    // ---- 3. round him where he stops and turns: the pier, the people, going round him
    this.walkTo = null;
    this.auto = null;
    {
      const c0 = P.pos.clone();
      let a0 = toS + Math.PI;
      this.shot({
        crowd: true,
        from: () => {
          a0 += (this.dtR || 1 / 30) * 1.6;
          return v3(c0.x + Math.sin(a0) * 2.6, 1.7, c0.z + Math.cos(a0) * 2.6);
        },
        look: () => v3(P.pos.x, 1.5, P.pos.z),
        fov: 46,
        dur: 2.0,
        hand: 0.4,
        roll: 0.06,
        rollTo: -0.08,
      });
      let t = 0;
      yield () => {
        t += this.dtR || 1 / 30;
        P.yaw = toS + Math.sin(t * 3) * 1.2;
        P.fig.yaw = P.yaw;
        return t > 1.9;
      };
    }
    // ---- 4. (round 13, the player's word) asking them: to one of them and to another, his hand up at
    // where it stood, his mouth going - not a word of it heard through his heart; their faces: a smile,
    // a shrug. Nobody has seen a thing (the evening's crowd, crowdAhead, going by: the film's own
    // people, c.pl - the city's would walk on)
    const not = new Set([L, this.cast.g1, this.cast.g2, this.cast.man, this.cast.mark, this.cast.bag, ...(this.heroes || [])].filter(Boolean));
    const near = g.civilians.list
      .filter((c) => c.alive && c.fig && c.pl && !c.inside && !c.riding && !not.has(c) && Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) < 16)
      .sort((a, b) => Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) - Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z))
      .slice(0, 2);
    const mouth = (text, dur, tone = 'talk') => ({ text, tone, at: 0, atT: performance.now() / 1000, real: true, cps: text.length / dur, wait: false, done: false });
    const ASK = ['The wheel! Where did it go?!', 'Did you see that?! The wheel!'];
    for (let i = 0; i < near.length; i++) {
      const c = near[i];
      // (they stop for him; he is at them)
      c.pl.x = c.pos.x;
      c.pl.z = c.pos.z;
      c.pl.speed = 0;
      this.faceTo(c, P.pos.x, P.pos.z);
      // (the one he asks: in the picture, whatever keeps the pier's people out of a close shot)
      c.star = true;
      P.yaw = Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
      P.fig.yaw = P.yaw;
      if (P.fig.j) c.fig.lookAt = P.fig.j.headC;
      P.fig.lookAt = c.fig.j && c.fig.j.headC ? c.fig.j.headC : v3(c.pos.x, 1.6, c.pos.z);
      P.fig.reachR = v3(WHEEL.x, 20, WHEEL.z);
      P.fig.say = mouth(ASK[i % 2], 1.3, 'alarm');
      // (over his shoulder at them, tilted - they do not stand in his world any more: his shoulder and
      // his hand at where it stood, their face)
      // (round 14: over his left shoulder - his pointing arm on the far side of him, not his sleeve
      // across half the picture; nearer the one he asks)
      this.shot({ from: this.ots(P, c, { back: 0.62, side: i ? -0.38 : -0.46, h: 1.62 }), look: () => { const h = this.headJ(c); return h ? v3(h.x, h.y - 0.08, h.z) : v3(c.pos.x, 1.5, c.pos.z); }, fov: 31, dur: 1.6, hand: 0.6, roll: i ? -0.07 : 0.07 });
      yield 0.85;
      // (a smile, a shrug: what wheel?)
      this.feel(c.fig, 'joy', 3);
      c.fig.say = mouth('What wheel?', 0.7);
      if (g.civilians.spoke) g.civilians.spoke(c, 'What wheel?', 'talk');
      yield 0.75;
      P.fig.reachR = null;
      c.fig.lookAt = null;
      // (on their way again, along the pier to the town)
      this.go(c, 40 + Math.random() * 4, c.pos.z, 1.2);
    }
    // (the world back, loud, at once - he shouts at the two at the railing: scene 4)
    if (g.audio.muffle) {
      g.audio.muffle(false);
      this.muffled = false;
    }
    if (this.comic) this.comic.pu = null;
    // (on to where it stood: the two by the railing there - start of scene 4)
    this.putDanny(SITE.x - fx * 2.2, SITE.z - fz * 2.2, toS);
    if (L) this.put(L, SITE.x - fx * 3.4 + fz * 0.8, SITE.z - fz * 3.4 - fx * 0.8, toS);
    P.fig.lookAt = null;
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
      c.fig.ones = true;
      c.pl.ride = 'wheel';
      c.hero = { gi, lx, lz, wave, ph: Math.random() * 6 };
      this.feel(c.fig, 'joy', 60);
      // (round 14: his face his own from the first frame he is seen - it was dark half a second while
      // his drawn face came in: render/people.js keepPortrait)
      c.fig.keepPortrait = true;
      c.fig.portraitPx = 40;
      return c;
    };
    // (the two kids at the sill; their parent no longer beside them - from the camera's side his back
    // filled half the picture)
    // (each in the middle of a pane - the window's bars are at +-0.5 across it, set.js gondolaParts:
    // stood behind one, a bar ran down the middle of the face)
    this.heroes = [mk('hk1', kidLook(false), -1.0, 0.0, 1), mk('hk2', kidLook(true), -1.0, 0.95, 1)];
    // (round 14: in their gondola from the shot's first frame - it was empty, and they came in at the
    // next)
    this.tickHeroes();
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
          c.fig.filmHide = true;
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
    // (people out for the evening, as they are: one with his phone, the other his coffee - ROADMAP 18.9)
    g2.fig.reachR = null;
    g2.fig.carry = 'phone';
    g1.fig.carry = 'coffee';
  }

  // ------------------------------------------------------------------ 4. GONE
  *s4() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    this.film(true);
    // (she stays where she has come to, by where it stood, while he goes from one to the next - not at
    // his heels: following him, she was behind him when he turned back to her, and the camera on her
    // side of him saw the back of his head)
    if (L) this.put(L, L.pos.x, L.pos.z, Math.atan2(WHEEL.x - L.pos.x, WHEEL.z - L.pos.z));
    // (round 14: the evening's groups off on their ways - where it stood, only the few)
    this.dropCrowds();
    // (ROADMAP 18.9) nobody remembers it - a dream gone wrong: the wheel's own waltz half as fast and
    // flat (score.js surreal), the evening's air as it always is, the picture a little off true
    this.cue('surreal', { fade: 2 });
    // the evening as it was, where it stood: people strolling, the end of the pier open to the sky -
    // nothing there, and nobody looking
    // (round 13: short - he has come through the people to it already, the search seen)
    this.shot({ from: [86, 3.2, 247], to: [88, 3.0, 245.5], look: [104, 1.5, 243], lookTo: [112, 5, 243], fov: 50, dur: 2.2, hand: 0.4 });
    yield 1.7;
    // Danny, at the two guys by the railing
    // (ROADMAP 18.9: the camera on his left, the guys' on their right - his right arm, waving and pointing
    // at where the wheel was, no longer coming at the lens across the picture)
    const g1 = this.cast.g1;
    const g2 = this.cast.g2;
    const M = this.cast.man;
    this.putDanny(GUYS[0].x - 1.5, GUYS[0].z + 0.9, Math.atan2(1.5, -0.9));
    this.faceTo(g1, P.pos.x, P.pos.z);
    g1.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    g2.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.feel(P.fig, 'angry', 3);
    this.feel(g1.fig, 'joy', 30);
    this.feel(g2.fig, 'joy', 30);
    // (him tilted one way, them the other: they do not stand in the same world)
    this.shot({ ...this.single(P, g1, { dist: 1.55, side: -0.42, up: -0.1 }), fov: 36, dur: 3, hand: 0.7, roll: 0.07 });
    yield* this.say('D06', P.fig, 0.15);
    this.shot({ ...this.single(g1, P, { dist: 1.55, side: 0.42, up: -0.1 }), fov: 36, dur: 2, hand: 0.4, roll: -0.05 });
    yield* this.say('G01', g1.fig, 0.15);
    this.shot({ ...this.single(P, g1, { dist: 1.55, side: -0.42, up: -0.1 }), fov: 36, dur: 2.2, hand: 0.7, roll: 0.08 });
    P.fig.reachR = v3(WHEEL.x, 20, WHEEL.z);
    const d07 = this.say('D07', P.fig, 0.15);
    const d07w = d07.next().value || 0;
    yield 1.6;
    // (where he points: the evening, nothing in it)
    {
      const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      // (round 14: the end of the pier where it stood - its empty boards, the sea past them - and up
      // from there into the sky it filled: nothing; at the sky alone it was a lamp and some pink)
      // (over his left shoulder - his arm pointing there leading the eye; from his own eyes his hand was
      // a great fist across a corner of the picture)
      this.shot({ from: this.ots(P, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { back: 0.35, side: -0.34, h: 1.66 }), look: [WHEEL.x, 2.6, WHEEL.z], lookTo: [WHEEL.x, 12, WHEEL.z], fov: 34, dur: 2.2, ease: 'inout', hand: 0.4, roll: 0.04 });
    }
    g1.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    g2.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    yield Math.max(0.3, d07w - 1.6);
    P.fig.reachR = null;
    // (they look where he points, and back at him, smiling)
    g1.fig.lookAt = P.fig.j.headC;
    g2.fig.lookAt = P.fig.j.headC;
    this.shot({ ...this.single(g1, P, { dist: 1.55, side: 0.42, up: -0.1 }), fov: 36, dur: 2.4, hand: 0.4, roll: -0.06 });
    yield* this.say('G02', g1.fig, 0.2);
    // (him: closer as he says it)
    {
      const A = this.single(P, g1, { dist: 1.6, side: -0.4, up: -0.1 });
      const B = this.single(P, g1, { dist: 1.15, side: -0.34, up: -0.08 });
      this.shot({ from: A.from, to: B.from, look: A.look, fov: 34, dur: 6.8, ease: 'lin', hand: 0.8, roll: 0.1 });
    }
    yield* this.say('D08', P.fig, 0.15);
    // the two of them, laughing it off together
    {
      const mx = (g1.pos.x + g2.pos.x) / 2;
      const mz = (g1.pos.z + g2.pos.z) / 2;
      const dx = mx - P.pos.x;
      const dz = mz - P.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      // (far enough back for the two of them, heads and all: past his shoulder, off to his side)
      this.shot({ from: [P.pos.x - (dx / d) * 0.35 + (dz / d) * 1.05, 1.62, P.pos.z - (dz / d) * 0.35 - (dx / d) * 1.05], look: [mx, 1.5, mz], fov: 40, dur: 4, hand: 0.5, roll: -0.07 });
      this.faceTo(g1, P.pos.x, P.pos.z, true);
      this.faceTo(g2, P.pos.x, P.pos.z, true);
    }
    yield* this.say('G03', g1.fig, 0.1);
    // (round 13: the joke that is not one, as a comic's page - the two of them grinning, the one who
    // said it, and him, under them, the whole of its width)
    {
      const C = this.comic;
      if (C && C.page) {
        this.feel(g1.fig, 'laugh', 3);
        this.feel(g2.fig, 'joy', 3);
        this.feel(P.fig, 'shock', 3);
        C.page([
          [[0.015, 0.03], [0.5, 0.03], [0.47, 0.47], [0.015, 0.47]],
          [[0.515, 0.03], [0.985, 0.03], [0.985, 0.47], [0.485, 0.47]],
          [[0.015, 0.5], [0.985, 0.5], [0.985, 0.97], [0.015, 0.97]],
        ]);
        // (the two of them together, past his shoulder - one in front of the other from a single's place)
        {
          const mx = (g1.pos.x + g2.pos.x) / 2;
          const mz = (g1.pos.z + g2.pos.z) / 2;
          const dx = mx - P.pos.x;
          const dz = mz - P.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          this.shot({ from: [P.pos.x - (dx / d) * 0.2 + (dz / d) * 0.9, 1.6, P.pos.z - (dz / d) * 0.2 - (dx / d) * 0.9], look: [mx, 1.52, mz], fov: 32, dur: 1, hand: 0.3 });
        }
        C.panel(0, { u: 0.5, v: 0.42 });
        yield 0.45;
        // (the one who said it, close)
        this.shot({ ...this.single(g1, P, { dist: 1.3, side: 0.42, up: -0.1 }), fov: 32, dur: 1, hand: 0.3 });
        C.panel(1, { u: 0.5, v: 0.42, zoom: 1.15 });
        yield 0.45;
        this.shot({ ...this.single(P, g1, { dist: 1.2, side: -0.3, up: -0.06 }), fov: 30, dur: 1.2, hand: 0.3 });
        C.panel(2, { u: 0.5, v: 0.42 });
        yield 0.7;
        if (C.endPage) C.endPage(0.15);
      }
    }
    this.shot({ ...this.single(P, g1, { dist: 1.3, side: -0.34, up: -0.08 }), fov: 32, dur: 2.2, hand: 0.5, roll: 0.12 });
    yield* this.say('D09', P.fig, 0.2);
    this.feel(g1.fig, 'surprised', 2);
    this.shot({ ...this.single(g1, P, { dist: 1.55, side: 0.42, up: -0.1 }), fov: 36, dur: 2.4, hand: 0.4, roll: -0.06 });
    yield* this.say('G04', g1.fig, 0.4);
    // the other man
    this.putDanny(MAN.x - 1.1, MAN.z - 1.2, Math.atan2(1.1, 1.2));
    this.faceTo(M, P.pos.x, P.pos.z);
    M.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.feel(P.fig, 'worried', 6);
    this.shot({ ...this.single(P, M, { dist: 1.6, side: 0.42, up: -0.1 }), fov: 36, dur: 4, hand: 0.7, roll: 0.06 });
    yield* this.say('D10', P.fig, 0.2);
    this.faceTo(M, WHEEL.x, WHEEL.z, true);
    M.fig.lookAt = v3(WHEEL.x, 20, WHEEL.z);
    yield 1.0;
    this.faceTo(M, P.pos.x, P.pos.z);
    M.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.shot({ ...this.single(M, P, { dist: 1.55, side: -0.42, up: -0.1 }), fov: 36, dur: 1.4, hand: 0.3, roll: -0.04 });
    const m01 = this.say('M01', M.fig, 0.5);
    const m01w = m01.next().value || 0;
    yield 0.9;
    // (and the ground goes from under him: the camera drawing back from him as it closes in on him,
    // so that he stays where he is and the world behind him rushes away - his face, in profile)
    {
      const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const dx = M.pos.x - P.pos.x;
      const dz = M.pos.z - P.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const sx = -dz / d;
      const sz = dx / d;
      this.feel(P.fig, 'shock', 6);
      this.shot({ from: [h.x + sx * 1.1, h.y - 0.05, h.z + sz * 1.1], to: [h.x + sx * 3.4, h.y - 0.05, h.z + sz * 3.4], look: [h.x, h.y - 0.08, h.z], fov: 50, fovTo: 17.5, dur: 3.2, ease: 'inout', hand: 0.2 });
      if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(P), 3.0, 0.55);
      // (round 10: and the world behind him gone into the red and the dark - an anime's moment - and
      // the sting with it)
      this.emote([0.5, 0.06, 0.1], P);
      this.sample('sfx/sting.mp3', 0.55);
      if (this.comic && this.comic.pulse) this.comic.pulse(3, { per: 0.85, k: 0.8, vol: 0.75 });
    }
    yield Math.max(2.6, m01w - 0.9);
    this.emote(null);
    // all round him, the evening as it was: nobody saw anything (round 13: and in his head)
    this.feel(P.fig, 'scared', 4);
    this.thought('TH3', 2.2);
    this.shot({ path: [v3(P.pos.x + 3, 2.2, P.pos.z), v3(P.pos.x, 2.4, P.pos.z + 3.2), v3(P.pos.x - 3, 2.6, P.pos.z)], look: () => v3(P.pos.x, 1.5, P.pos.z), fov: 46, dur: 4, ease: 'inout', hand: 0.5, roll: 0.09 });
    yield 3.8;
    for (const c of [g1, g2, M]) c.fig.lookAt = null;
    // back to her (where she stands, by where it was)
    this.putDanny(L.pos.x + 1.3, L.pos.z + 0.5, Math.atan2(-1.3, -0.5));
    this.faceTo(L, P.pos.x, P.pos.z);
    L.yaw = L.pl.face;
    L.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.shot({ ...this.single(L, P, { dist: 1.05, side: 0.5, up: -0.04, drop: 0.07 }), fov: 34, dur: 3, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    yield* this.say('L09', L.fig, 0.4);
    this.shot({ ...this.single(P, L, { dist: 1.4, side: -0.36, up: -0.3, drop: 0.12 }), fov: 34, dur: 2.2, hand: 0.4 });
    this.feel(P.fig, 'sad', 4);
    yield* this.say('D11', P.fig, 0.5);
    // her drawing: she holds it up against where it stood - in it, it is still there
    const page = this.lilyPage();
    this.faceTo(L, WHEEL.x, WHEEL.z);
    // (turned to it at the cut, not still turning through the shot: the page goes where she faces, and
    // it went out of the picture)
    L.yaw = L.pl.face;
    L.faceYaw = L.pl.face;
    L.fig.lookAt = page.at;
    // (round 13: held up high against the sky, the camera low behind her shoulder - the drawing over
    // the empty evening where it stood; before, her head was across it and the page was not seen)
    page.hold(L.fig, null, 'up');
    // (round 14: the page the picture - from just behind her head, the drawing big against the empty
    // sky; low behind her shoulder her head and arm were most of it, the page small in a corner)
    {
      const behind = () => {
        const h = this.headJ(L) || v3(L.pos.x, 1.1, L.pos.z);
        const dx = WHEEL.x - h.x;
        const dz = WHEEL.z - h.z;
        const d = Math.hypot(dx, dz) || 1;
        return v3(h.x - (dx / d) * 0.38 - (dz / d) * 0.62, h.y + 0.1, h.z - (dz / d) * 0.38 + (dx / d) * 0.62);
      };
      this.shot({ from: behind, look: () => page.at.clone(), fov: 30, dur: 3.2, hand: 0.25, dof: 0.6 });
    }
    // (round 10: in it, it is still there - the drawing lit; round 13: against the evening's own sky,
    // not a field of gold - the gold field is laid over all but the people, and the page went under it:
    // in no picture of it was the drawing ever seen)
    this.flash(0.5, '#ffe2a0', 0.45);
    yield 2.2;
    // past it: nothing
    this.shot({ from: this.ots(L, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { h: 1.12, back: 0.55, side: 0.28 }), look: () => v3(page.at.x, page.at.y, page.at.z), lookTo: [WHEEL.x, 20, WHEEL.z], fov: 40, fovTo: 44, dur: 2.2, hand: 0.35 });
    L.fig.lookAt = v3(WHEEL.x, 24, WHEEL.z);
    yield 2.0;
    page.hold(L.fig, null, 'hug');
    this.faceTo(L, P.pos.x, P.pos.z);
    L.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    this.shot({ ...this.single(L, P, { dist: 1.0, side: -0.4, up: -0.03, drop: 0.07 }), fov: 32, dur: 4.5, hand: 0.3 });
    this.feel(L.fig, 'sad', 8);
    yield* this.say('L10', L.fig, 0.2);
    // the silence: he looks at her, his mouth a little open as if to answer - nothing comes
    this.shot({ ...this.single(P, L, { dist: 1.45, side: 0.34, up: -0.22, drop: 0.11 }), fov: 30, dur: 3, hand: 0.25 });
    this.feel(P.fig, 'surprised', 2.6);
    yield 2.8;
    // the empty place; the wheel's tune comes back to him, far off (ROADMAP 18.9: not the kids'
    // voices - the waltz remembered: game/prologue/score.js memory)
    this.shot({ from: this.eyeOf(P, WHEEL), look: [WHEEL.x, 22, WHEEL.z], lookTo: [WHEEL.x, 24, WHEEL.z], fov: 40, dur: 3.2, hand: 0.2 });
    this.cue('memory');
    // (round 13: and in his head the picture of it, coming up over the empty sky and going)
    yield 0.5;
    this.memoryFlash(true);
    yield 2.6;
    // he swallows; back at her
    this.shot({ ...this.single(P, L, { dist: 1.35, side: -0.34, up: -0.22, drop: 0.11 }), fov: 30, dur: 2.4, hand: 0.25 });
    this.feel(P.fig, 'sad', 8);
    yield 2.3;
    this.shot({ from: () => { const a = this.ots(L, P, { back: 2.6, side: 1.6, h: 1.35 })(); return a; }, look: () => v3((L.pos.x + P.pos.x) / 2, 1.2, (L.pos.z + P.pos.z) / 2), fov: 40, dur: 9, hand: 0.35 });
    yield* this.say('D12', P.fig, 0.6);
    // his hands over hers, on the page: keep it
    // (round 14: the beats of it each its own picture - ten seconds of one wide shot, the two of them
    // small, held all of it: their hands on the page, her face asking, his not answering, and then off)
    P.fig.reachL = page.at;
    P.fig.reachR = page.at;
    {
      const pa = () => page.at.clone();
      // (over his shoulder: the page held to her, facing him - his hands coming onto it, her face over it;
      // from her side the page was edge on, the boards all of it)
      this.shot({ from: this.ots(P, L, { back: 0.55, side: 0.4, h: 1.3 }), look: () => pa().add(v3(0, 0.12, 0)), fov: 34, dur: 2.6, hand: 0.2, dof: 0.6 });
    }
    yield 0.6;
    yield* this.say('D13', P.fig, 0.4);
    this.shot({ ...this.single(L, P, { dist: 0.95, side: 0.36, up: -0.02, drop: 0.07 }), fov: 32, dur: 2.4, hand: 0.25 });
    yield* this.say('L11', L.fig, 0.2);
    // (round 13: what he does not say to her - in his head)
    // (round 14: heard whole before the next thing is said - on his face, close, as he does not say it)
    this.shot({ ...this.single(P, L, { dist: 1.1, side: -0.3, up: -0.12, drop: 0.1 }), to: this.single(P, L, { dist: 0.95, side: -0.28, up: -0.11, drop: 0.1 }).from, fov: 28, dur: 3.6, hand: 0.2, dof: 1 });
    yield Math.max(1.3, this.thought('TH4', 2.4) - 0.7);
    yield* this.say('D14', P.fig, 0.6);
    P.fig.reachR = null;
    // his hand out to hers
    P.fig.reachL = L.fig.j ? L.fig.j.handR || null : null;
    this.shot({ from: () => { const a = this.ots(L, P, { back: 2.6, side: 1.6, h: 1.35 })(); return a; }, look: () => v3((L.pos.x + P.pos.x) / 2, 1.2, (L.pos.z + P.pos.z) / 2), fov: 40, dur: 9, hand: 0.35 });
    yield* this.say('D15', P.fig, 0.4);
    P.fig.reachL = null;
    page.release();
    P.fig.lookAt = null;
    L.fig.lookAt = null;
    L.pl.follow = true;
    this.film(false);
    // (the dream's waltz out as they go: the evening's air only, on the way)
    this.cue('stop', { fade: 4 });
    this.hour(18.42, 0.0035);
    this.objective('Get to your <b>car</b>', GARAGE_IN.x, GARAGE_IN.z, 'Car park');
    this.howto('tocar', 9);
    this.start(5);
  }

  // (ROADMAP 18.9) the man with the mark on his shirt: along the pier ahead of them, crossing it
  // slowly towards the wheel's gate (the mark: game/prologue/set.js markShirt)
  markMan(px = null, pz = null) {
    if (this.cast.mark) return this.cast.mark;
    const toW = Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z);
    const ux = Math.sin(toW);
    const uz = Math.cos(toW);
    const x = px !== null ? px : VIEW.x + ux * 14 - uz * 2.5;
    const z = pz !== null ? pz : VIEW.z + uz * 14 + ux * 2.5;
    // (ROADMAP 18.9: a face of his own, nobody else's in the city - render/folkspec.js 'marked')
    const c = this.person('mark', x, z, roleLook('marked') || civilianLook({ fem: false, kind: 'casual' }), { face: Math.atan2(-ux, -uz) });
    if (this.set && this.set.markShirt) this.set.markShirt(c);
    c.fig.portraitPx = 60;
    c.fig.keepPortrait = true;
    return c;
  }

  // (round 14) the evening's people on the pier, in groups as people are: at the railings looking at
  // the sea, taking pictures, chatting by the wheel's gate - spread along it, none of them just where
  // the two of them stand. Each a member of its group, round its middle, turned to it; their own
  // looks, the city's. On a phone fewer of them
  crowdGroups() {
    if (this.crowds) return this.crowds;
    const g = this.game;
    const few = !!g.touch;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const C = (this.crowds = { groups: [], all: [] });
    const at = [
      [80, 247.2, 6, 'sea'],
      [74.5, 246.6, 5, 'talk'],
      [95, 244.2, 6, 'talk'],
      [50.5, 246, 5, 'talk'],
      [111, 246.8, 5, 'sea'],
      [88, 239.8, 4, 'talk'],
    ];
    let id = 0;
    for (const [x, z, n0, how] of at) {
      const n = few ? Math.max(3, n0 - 2) : n0;
      const G = { c: { x, z }, r: 1.1 + n * 0.12, members: [], moving: false };
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
        const rr = G.r * rnd(0.75, 1.1);
        const px = how === 'sea' ? x + (i - (n - 1) / 2) * 0.75 : x + Math.cos(a) * rr;
        const pz = how === 'sea' ? z + rnd(-0.3, 0.4) : z + Math.sin(a) * rr;
        const face = how === 'sea' ? 0 : Math.atan2(x - px, z - pz);
        const q = this.person('grp' + id++, px, pz, i % 6 === 4 ? kidLook(i % 2 === 0) : civilianLook(), { face });
        q.noCollide = true;
        if (q.fig) q.fig.lodFar = 0;
        if (how === 'sea' && i % 3 === 1) q.fig.carry = 'phone';
        q.grp = G;
        G.members.push(q);
        C.all.push(q);
      }
      C.groups.push(G);
    }
    return C;
  }

  // (round 14) a tour's group along the pier from the town behind its guide, the guide's hand up -
  // made a few metres beyond the man, walking this way at a stroll, on along the pier towards the
  // wheel and back: the crowd the man walks into
  tourGroup(man) {
    const C = this.crowdGroups();
    if (C.tour) return C.tour;
    const g = this.game;
    const n = g.touch ? 9 : 13;
    const toW = Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z);
    const ux = Math.sin(toW);
    const uz = Math.cos(toW);
    // (along the pier's middle, two metres clear of Danny where it goes by him)
    const c = { x: man.pos.x - ux * 7, z: Math.max(242.6, Math.min(245.4, man.pos.z - uz * 7 + 0.6)) };
    const G = { c, r: 1.9, members: [], moving: true, dir: 1, x0: 45, x1: 118, speed: 0.55, offs: [] };
    for (let i = 0; i <= n; i++) {
      const guide = i === 0;
      const row = guide ? -1.3 : Math.floor((i - 1) / 4);
      const col = guide ? 0 : ((i - 1) % 4) - 1.5;
      const ox = -row * 0.85 + (Math.random() - 0.5) * 0.25;
      const oz = col * 0.8 + (Math.random() - 0.5) * 0.25;
      G.offs.push([ox, oz]);
      const q = this.person('tour' + i, c.x + ox, c.z + oz, i % 5 === 3 ? kidLook(i % 2 === 0) : civilianLook(), { face: Math.PI / 2 });
      q.noCollide = true;
      if (q.fig) q.fig.lodFar = 0;
      q.grp = G;
      q.tourI = i;
      if (guide) q.guide = true;
      G.members.push(q);
      C.all.push(q);
    }
    C.groups.push(G);
    C.tour = G;
    return G;
  }

  // (round 14) the evening's groups break up and go their ways along the pier to the town - each let go
  // of once out of the picture and far off (letGo): by where the wheel stood, the questions are asked
  // of the few who are there
  dropCrowds() {
    const C = this.crowds;
    if (!C) return;
    this.crowds = null;
    for (const q of C.all) {
      if (!q.alive) continue;
      q.fig.reachR = null;
      this.go(q, 26 + Math.random() * 10, Math.max(238.8, Math.min(247.5, q.pos.z + (Math.random() - 0.5) * 4)), 1.05 + Math.random() * 0.35);
      const key = Object.keys(this.cast).find((k) => this.cast[k] === q);
      this.letGo(q, key);
    }
  }

  // every frame: the tour walking (its people in their places round its middle, the guide in front,
  // her hand up), the rest at their ease
  tickCrowds(dt) {
    const C = this.crowds;
    if (!C) return;
    const T = C.tour;
    if (T) {
      if (T.goal) {
        // (to a place of its own along the north railing, and there it stays, round its guide)
        const dx = T.goal.x - T.c.x;
        const dz = T.goal.z - T.c.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          const st = Math.min(d, T.speed * dt);
          T.c.x += (dx / d) * st;
          T.c.z += (dz / d) * st;
          T.dir = dx >= 0 ? 1 : -1;
        }
      } else {
        T.c.x += T.dir * T.speed * dt;
        if (T.c.x > T.x1) T.dir = -1;
        if (T.c.x < T.x0) T.dir = 1;
      }
      for (const q of T.members) {
        if (!q.alive) continue;
        const [ox, oz] = T.offs[q.tourI];
        const tx = T.c.x + ox * T.dir;
        const tz = T.c.z + oz;
        this.go(q, tx, tz, Math.min(1.6, T.speed + Math.hypot(tx - q.pos.x, tz - q.pos.z) * 0.8));
        if (q.guide && q.fig && q.fig.j && q.fig.j.headC) {
          q.fig.reachR = q.fig.reachR || new THREE.Vector3();
          q.fig.reachR.set(q.pos.x + T.dir * 0.1, q.fig.j.headC.y + 0.45, q.pos.z + 0.15);
        }
      }
    }
  }

  // (round 14, the player's word) the search: a minute and more - he is among the people and does not
  // mean to be found. Hidden in a group on its far side from Danny, moving with it; come near him, or
  // look at him a moment, and he is off - quick, through the people, to another group, and wherever
  // nobody sees him on the way he is there already. Now and then, when he has not been seen a while,
  // he lets himself be seen - at the edge of a group across the way, looking at Danny - and is off
  // again as Danny comes. Never caught. Past the minute, hidden and out of the picture, he is gone
  // for good: nobody sees him go
  *hideAndSeek(man) {
    const g = this.game;
    const P = g.player;
    const cam = g.camera;
    const C = this.crowdGroups();
    const MIN = 62;
    const MAX = 80;
    const st = { t: 0, G: C.tour || C.groups[0], mode: 'hide', modeT: 0, seenT: 0, lastSeen: 0, unseenSince: 0, gone: false, goneT: 0, msgT: 0, to: null, side: Math.random() < 0.5 ? 1 : -1 };
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const dist = () => Math.hypot(P.pos.x - man.pos.x, P.pos.z - man.pos.z);
    // (seen: his head or chest in the picture, and nobody between him and the camera there - where he
    // is, or where he would be)
    const visible = (x = man.pos.x, z = man.pos.z) => {
      if (!man.alive) return false;
      for (const h of [1.55, 1.15]) {
        A.set(x, man.pos.y + h, z).project(cam);
        if (A.z > 1 || Math.abs(A.x) > 0.96 || Math.abs(A.y) > 0.96) continue;
        B.set(x, man.pos.y + h, z).sub(cam.position);
        const dm = B.length();
        B.divideScalar(dm);
        let occ = false;
        for (const q of C.all) {
          if (!q.alive) continue;
          const ox = q.pos.x - cam.position.x;
          const oz = q.pos.z - cam.position.z;
          const oy = q.pos.y + h - cam.position.y;
          const al = ox * B.x + oy * B.y + oz * B.z;
          if (al < 0.4 || al > dm - 0.35) continue;
          const px = ox - B.x * al;
          const pz = oz - B.z * al;
          if (px * px + pz * pz < 0.09) {
            occ = true;
            break;
          }
        }
        if (!occ) return true;
      }
      return false;
    };
    // (inside a group, on its side away from Danny)
    const slotIn = (G) => {
      const dx = G.c.x - P.pos.x;
      const dz = G.c.z - P.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      return { x: G.c.x + (dx / d) * G.r * 0.35 + (-dz / d) * st.side * 0.3, z: G.c.z + (dz / d) * G.r * 0.35 + (dx / d) * st.side * 0.3 };
    };
    // (at its edge towards Danny: to be seen)
    const edgeOf = (G) => {
      const dx = P.pos.x - G.c.x;
      const dz = P.pos.z - G.c.z;
      const d = Math.hypot(dx, dz) || 1;
      return { x: G.c.x + (dx / d) * (G.r + 0.5), z: G.c.z + (dz / d) * (G.r + 0.5) };
    };
    const onPic = (x, z) => {
      A.set(x, 1.2, z).project(cam);
      return A.z < 1 && Math.abs(A.x) < 0.8 && Math.abs(A.y) < 0.9;
    };
    // (where to go: another group, the further from Danny the better - or, to be seen, one across the
    // way that is in his picture, not too near nor too far)
    const pick = (toBeSeen) => {
      let best = null;
      let bs = -1e9;
      for (const G of C.groups) {
        if (G === st.G) continue;
        const d = Math.hypot(G.c.x - P.pos.x, G.c.z - P.pos.z);
        let sc;
        if (toBeSeen) sc = onPic(G.c.x, G.c.z) && d > 13 && d < 30 ? 50 - Math.abs(d - 20) : -1e6;
        else sc = d > 11 ? d + Math.random() * 6 : -1e6;
        if (sc > bs) {
          bs = sc;
          best = G;
        }
      }
      return bs > -1e5 ? best : null;
    };
    const say = (h, life = 2.6) => {
      this.objective(h);
      st.msgT = life;
    };
    const FIND = 'Where did he go? <b>Find him</b> in the crowd';
    let wasVis = false;
    for (;;) {
      const dt = this.dtR || 1 / 30;
      st.t += dt;
      st.modeT += dt;
      if (st.msgT > 0 && (st.msgT -= dt) <= 0) this.objective(st.gone ? null : FIND);
      if (st.gone) {
        st.goneT += dt;
        if (st.goneT > 3.5) break;
        yield 0.001;
        continue;
      }
      const vis = visible();
      const dP = dist();
      if (vis) {
        st.seenT += dt;
        // (seen again after a while: his heart, and the line)
        if (!wasVis && st.t - st.lastSeen > 4) {
          if (this.comic && this.comic.pulse) this.comic.pulse(1, { k: 0.4, vol: 0.55 });
          // (round 14: his notes again, softer - he is known by them now)
          this.cue('mark', { vol: 0.55 });
          say('There he is! <b>Catch him</b>', 2.2);
        }
        st.lastSeen = st.t;
      } else st.seenT = 0;
      wasVis = vis;
      // (gone for good: past the minute, in among a group, out of the picture a while)
      if ((st.t > MIN && !vis && st.t - st.lastSeen > 1.2) || (st.t > MAX && !vis)) {
        if (this.set && this.set.shirt && this.set.shirt.c === man) this.set.shirt.grp.visible = false;
        g.civilians.remove(man);
        delete this.cast.mark;
        st.gone = true;
        say("He's <b>gone</b>...", 3.2);
        continue;
      }
      if (st.mode === 'hide') {
        const sl = slotIn(st.G);
        this.go(man, sl.x, sl.z, 1.5);
        man.fig.lookAt = null;
        if (dP < 8.5 || (vis && st.seenT > 1.1 && dP < 24)) {
          st.to = pick(false);
          if (st.to) {
            st.mode = 'flee';
            st.modeT = 0;
            st.side = -st.side;
          }
        } else if (!vis && st.t - st.lastSeen > 13 && st.t < MIN - 4) {
          // (let himself be seen: across the way, in a group there - from behind them, where nobody sees
          // him come, out to its edge, looking at him)
          const G = pick(true);
          const sl = G ? slotIn(G) : null;
          if (G && !visible(sl.x, sl.z)) {
            this.put(man, sl.x, sl.z, null);
            st.G = G;
            st.mode = 'peek';
            st.modeT = 0;
          }
        }
      } else if (st.mode === 'peek') {
        const e = edgeOf(st.G);
        this.go(man, e.x, e.z, 1.2);
        if (Math.hypot(man.pos.x - e.x, man.pos.z - e.z) < 0.4) this.faceTo(man, P.pos.x, P.pos.z, true);
        if (P.fig.j) man.fig.lookAt = P.fig.j.headC;
        if (st.modeT > 4.5 || dP < 12 || (vis && st.seenT > 1.6)) {
          st.to = pick(false);
          st.mode = st.to ? 'flee' : 'hide';
          st.modeT = 0;
        }
      } else if (st.mode === 'flee') {
        man.fig.lookAt = null;
        const sl = slotIn(st.to);
        this.go(man, sl.x, sl.z, dP < 5 ? 3.8 : 2.6);
        // (wherever nobody sees him on the way, he is there already)
        if (!vis && st.modeT > 0.35 && !onPic(sl.x, sl.z)) this.put(man, sl.x, sl.z, null);
        if (Math.hypot(man.pos.x - sl.x, man.pos.z - sl.z) < 0.9) {
          st.G = st.to;
          st.mode = 'hide';
          st.modeT = 0;
        }
      }
      yield 0.001;
    }
  }

  // (round 13) somebody of the film's let go of where nobody sees it: once off the picture and 45 m
  // from him (tickLeaving) - till then the evening's people round him, the wheel's going and his
  // search among them
  letGo(c, key) {
    if (!c) return;
    (this.leaving || (this.leaving = [])).push({ c, key, t: 0 });
  }

  tickLeaving(dt) {
    if (!this.leaving || !this.leaving.length) return;
    const g = this.game;
    const cam = g.camera;
    const P = g.player;
    const q = this.tqL || (this.tqL = new THREE.Vector3());
    this.leaving = this.leaving.filter((e) => {
      const c = e.c;
      e.t += dt;
      if (!c.alive) return false;
      q.set(c.pos.x, c.pos.y + 1, c.pos.z).project(cam);
      const onPic = q.z < 1 && Math.abs(q.x) < 1.15 && Math.abs(q.y) < 1.15;
      const far = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) > 45;
      if ((far && !onPic) || e.t > 180) {
        g.civilians.remove(c);
        if (e.key && this.cast[e.key] === c) delete this.cast[e.key];
        return false;
      }
      return true;
    });
  }

  // (ROADMAP 18.9) somebody rubbed out where they stand: from their heart outwards, the rub's sound,
  // its crumbs, the comic's marks on them - and gone (game/doodle.js dissolve)
  *rubOut(c) {
    const g = this.game;
    const C = this.comic;
    const src = { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), along: new THREE.Vector3(1, 0, 0), on: true, w: 1.3 };
    c.pl.speed = 0;
    if (C) C.rub(src);
    const crumbs = [[0.62, 0.6, 0.62], [0.85, 0.62, 0.66], [0.96, 0.95, 0.92], [0.98, 0.45, 0.62]];
    let t = 0;
    let n = -1;
    while (t < 1.5) {
      const j = c.fig.j;
      src.pos.set(c.pos.x, j && j.neck ? j.neck.y - 0.28 : c.pos.y + 1.2, c.pos.z);
      c.fig.dissolve = Math.min(1, t / 1.3);
      const q = Math.floor(t * 7);
      if (q !== n) {
        n = q;
        g.audio.play('rub', 1.2);
        if (g.fx) g.fx.spray(src.pos.x, src.pos.y, src.pos.z, 0, -0.2, 0, 7, 3, crumbs, { bits: true, len: 0.5, life: 1.1, cone: 1.2 });
      }
      yield 0.001;
      t += this.dtR || 1 / 30;
    }
    if (C) C.rub(null);
    if (this.set && this.set.shirt && this.set.shirt.c === c) this.set.shirt.grp.visible = false;
    g.civilians.remove(c);
    delete this.cast.mark;
  }

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
    // (round 13: and what he thinks, looking back at her)
    // (round 14: over, and gone, before the cut to the street - not a third text over its first shot)
    yield Math.max(0.6, this.thought('TH5', 2.0) - 0.15);
    this.clearThoughts();
    // the garage's door on 5th Street: the dark car at the curb, the two men by it - the same two from
    // here to the end: the one who talks (t1), the one beside him (t2)
    yield () => this.dist(GARAGE_IN.x, GARAGE_IN.z) < 15 || this.dist(THUGS[0].x, THUGS[0].z) < 16;
    const t1 = this.cast.t1;
    const t2 = this.cast.t2;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    this.cue('discovery');
    // (round 14: their faces against the sunset read - more of the people's own key light here)
    this.fillK = 1.45;
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
      // (ROADMAP 18.9: men who have come to hurt him - and their faces say so, from the first moment)
      this.feel(c.fig, 'angry', 90);
    }
    // over their shoulders: him and Lily, small, at the door of the car park - they have been waiting
    // for him
    // (round 14: from their side of it, low at the curb - him coming, in the light, watched; over their
    // shoulders the striped post by the way in stood across the middle of the picture)
    // (round 14: from where they wait for him, low on the street side, four and a half metres short of
    // him - his face in the light, Lily at his back, the two men behind the camera, still to be seen:
    // set from the stop, not from the man, who stood fourteen metres off)
    this.shot({ from: v3(D.x + ux * 4.5 + uz * 1.6, 1.05, D.z + uz * 4.5 - ux * 1.6), look: () => v3(P.pos.x, 1.25, P.pos.z), fov: 36, dur: 2.2, hand: 0.5 });
    this.go(t1, S1.x - ux * 2.0, S1.z - uz * 2.0, 1.0);
    this.go(t2, S2.x - ux * 1.6, S2.z - uz * 1.6, 1.0);
    yield 1.6;
    // (ROADMAP 18.9: the two of them, both, coming at him - from low down in front of them, looking up:
    // the big one a step behind the one who talks; whoever speaks is the one the picture is on)
    this.shot({
      from: () => v3((t1.pos.x + t2.pos.x) / 2 - ux * 3.1 + uz * 0.5, 0.75, (t1.pos.z + t2.pos.z) / 2 - uz * 3.1 - ux * 0.5),
      to: () => v3((t1.pos.x + t2.pos.x) / 2 - ux * 2.5 + uz * 0.4, 0.8, (t1.pos.z + t2.pos.z) / 2 - uz * 2.5 - ux * 0.4),
      look: () => v3(t1.pos.x * 0.6 + t2.pos.x * 0.4, 1.45, t1.pos.z * 0.6 + t2.pos.z * 0.4),
      fov: 40,
      dur: 2.8,
      ease: 'lin',
      hand: 0.5,
    });
    yield 1.0;
    // (ROADMAP 18.9: their card, the two of them held as they come)
    yield* this.freezeCard({ name: 'VINCE & BRUNO', tag: 'they want something back', col: '#d23a32', at: () => this.headJ(t1), side: -1 });
    this.shot({ ...this.single(t1, P, { dist: 2.0, side: -0.5, up: -0.22, drop: 0.25 }), fov: 36, dur: 2.8, hand: 0.5 });
    yield 0.1;
    yield* this.say('T01', t1.fig, 0.3);
    // he stops; puts her behind him
    this.put(L, P.pos.x - ux * 1.0 + uz * 0.25, P.pos.z - uz * 1.0 - ux * 0.25, a);
    L.fig.lookAt = t1.fig.j.headC;
    this.feel(L.fig, 'scared', 30);
    this.feel(P.fig, 'angry', 14);
    P.fig.lookAt = t1.fig.j.headC;
    // (from behind the two of them: Danny, Lily at his back - and the two men down the sidewalk)
    // (round 14: his face as he says it - from behind him it was his dark back by the striped post, the
    // two of them specks down the sidewalk)
    this.shot({ ...this.single(P, t1, { dist: 1.5, side: 0.45, up: -0.15, drop: 0.12 }), fov: 36, dur: 2.6, hand: 0.5 });
    yield* this.say('D18', P.fig, 0.3);
    this.shot({ ...this.single(t1, P, { dist: 1.6, side: -0.42, up: -0.15, drop: 0.14 }), fov: 34, dur: 3.2, hand: 0.5 });
    yield* this.say('T02', t1.fig, 0.25);
    // (Danny, Lily at his back behind his shoulder)
    this.shot({ ...this.single(P, t1, { dist: 1.75, side: 0.5, up: -0.28, drop: 0.16 }), fov: 36, dur: 3, hand: 0.5 });
    yield* this.say('D19', P.fig, 0.25);
    // the other one moves out to the side - slowly, his hand inside his jacket (towards the curb: the
    // building's face is on the other side)
    this.go(t2, S2.x - ux * 1.5 + uz * 1.4, S2.z - uz * 1.5 - ux * 1.4, 0.8);
    // (round 14: the threat close on him - it was said in a wide down the sidewalk, the two of them
    // specks; the other one going out to the side behind him)
    this.shot({ ...this.single(t1, P, { dist: 1.2, side: -0.5, up: -0.12, drop: 0.12 }), fov: 32, dur: 3.4, hand: 0.6 });
    yield* this.say('T03', t1.fig, 0.25);
    // (round 9: the stand-off, as a western has it and an anime cuts it - his eyes, theirs, close and
    // still, the sound of the street gone under it; then the guns)
    {
      // (round 14: worked out every frame from where their head is now - set once, a man still coming
      // walked out of his own strip, the street in it)
      const eyes = (who, at, side) => {
        const fr = () => {
          const h = this.headJ(who) || v3(who.pos.x, 1.6, who.pos.z);
          const dx = at.pos.x - who.pos.x;
          const dz = at.pos.z - who.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          return { h, ux: dx / d, uz: dz / d };
        };
        // (round 11: a little further off and lower - at 0.55 m and the head's middle the strips held
        // hair, or nothing)
        return {
          from: () => { const { h, ux, uz } = fr(); return v3(h.x + ux * 0.72 - uz * side, h.y + 0.02, h.z + uz * 0.72 + ux * side); },
          look: () => { const { h } = fr(); return v3(h.x, h.y + 0.02, h.z); },
        };
      };
      this.airDip = 0.35;
      // (round 11: the western's three strips, one over the other, each slammed in on a heartbeat -
      // his eyes, Danny's, Lily's behind him - the page torn away by the guns)
      const C5 = this.comic;
      const strips = [
        [[0.015, 0.03], [0.985, 0.03], [0.985, 0.31], [0.015, 0.33]],
        [[0.015, 0.35], [0.985, 0.33], [0.985, 0.64], [0.015, 0.66]],
        [[0.015, 0.68], [0.985, 0.66], [0.985, 0.97], [0.015, 0.97]],
      ];
      if (C5 && C5.page) C5.page(strips);
      const E = [eyes(t1, P, 0.06), eyes(P, t1, -0.06), eyes(L, t1, 0.05)];
      for (let i = 0; i < 3; i++) {
        const Ei = E[i];
        this.shot({ from: Ei.from, to: () => Ei.from().lerp(Ei.look(), 0.08), look: Ei.look, fov: 24, dur: 0.8, hand: 0.1, dof: 1 });
        // (round 14: each strip on the eyes - lower for him, it was his jaw in the dark and a bit of
        // pavement)
        if (C5 && C5.panel) C5.panel(i, { u: 0.5, v: 0.5, zoom: 2.3 });
        g.audio.play('heartbeat', 0.55);
        yield i < 2 ? 0.62 : 0.8;
      }
      if (C5 && C5.endPage) C5.endPage(0.08);
      this.airDip = 1;
    }
    // wrong answer: the guns - from low beside the line of his arm, the gun big in the picture, his face
    // over it (a kick as they come up)
    // (round 14: from his other side, nearer - the two of them and the gun against the sky; from this
    // side the striped post stood in front of it all)
    this.shot({ from: () => v3(t1.pos.x - ux * 1.6 - uz * 0.75, 1.25, t1.pos.z - uz * 1.6 + ux * 0.75), look: () => { const h = this.headJ(t1) || v3(t1.pos.x, 1.6, t1.pos.z); return v3(h.x - ux * 0.3, h.y - 0.28, h.z - uz * 0.3); }, fov: 38, dur: 2.0, hand: 0.6, shake: 0.08, roll: 0.05 });
    this.armThug(t1, P);
    g.audio.play('click', 0.6);
    this.flash(0.12, '#ffffff');
    // (round 14: the anime's impact - the gun up and the world held on it a beat, the frame in two
    // inks, then on with a snap; not a smooth slow-down)
    this.comic.impact(this.headJ(t1) || t1.pos, 0.24);
    this.k = this.kWant = 0.0002;
    yield 0.24;
    this.k = this.kWant = 1;
    yield* this.say('T05', t1.fig, 0.05);
    this.armThug(t2, P);
    // him: the car, now
    this.shot({ ...this.single(P, t1, { dist: 1.5, side: 0.4, up: -0.15, drop: 0.12 }), fov: 36, dur: 1.6, hand: 0.8, roll: -0.06 });
    this.feel(P.fig, 'scared', 3);
    this.emote([0.5, 0.06, 0.08], P);
    yield* this.say('D28', P.fig, 0.0);
    this.emote(null);
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
    // (round 11: the run seen for a beat only - from just inside the way in, the two of them bursting
    // through it at us under the gunfire - and cut on it, to the car: the long run in the dark was
    // specks and dolls' legs)
    this.walkTo = { x: run[1][0], z: run[1][1], speed: 1, sprint: true };
    // (round 14: after them as they run for it, low behind him, the way in ahead of them and the shots
    // going by - from inside it, its wall was half the picture and they came into it at its last frame)
    {
      const rx0 = run[1][0] - P.pos.x;
      const rz0 = run[1][1] - P.pos.z;
      const rl = Math.hypot(rx0, rz0) || 1;
      const fx = rx0 / rl;
      const fz = rz0 / rl;
      this.shot({ from: () => v3(P.pos.x - fx * 2.3 + fz * 0.55, 1.35, P.pos.z - fz * 2.3 - fx * 0.55), look: () => v3(P.pos.x + fx * 3, 1.1, P.pos.z + fz * 3), fov: 48, dur: 1.8, hand: 1, step: 12, shake: 0.06 });
    }
    this.comic.lines(null, 1.4, 0.8);
    {
      let t = 0;
      yield () => {
        t += this.dtR;
        return Math.hypot(P.pos.x - run[1][0], P.pos.z - run[1][1]) < 1.2 || t > 1.6;
      };
    }
    // (at the car: at its doors, in)
    this.putDanny(v.pos.x + Math.cos(v.yaw) * 1.3, v.pos.z - Math.sin(v.yaw) * 1.3, v.yaw);
    this.put(L, v.pos.x - Math.cos(v.yaw) * 1.3, v.pos.z + Math.sin(v.yaw) * 1.3, v.yaw);
    this.walkTo = null;
    this.auto = null;
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
    // (round 11: from inside, low, the car in its bay with its lights coming on and the two men at the
    // way in behind it - from the sidewalk the new car park's wall hid it)
    {
      const E = PARK.entrance;
      // (round 14: the car itself in the picture - it was cut by its edge)
      this.shot({ from: v3(v.pos.x - 3.4, 1.05, v.pos.z - 6.5), look: v3(v.pos.x * 0.68 + E.x * 0.32, 0.95, v.pos.z * 0.68 + E.z * 0.32), fov: 52, dur: 2.2, hand: 1 });
    }
    this.comic.word('VROOOM!', v3(v.pos.x, 1.4, v.pos.z), { fill: '#ff6f3a', burst: '#ffd23f', size: 0.1, life: 1.0 });
    // (round 14: and the smoke off its back tyres, drawn)
    {
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      for (const sd of [-1, 1]) this.comic.puff(v3(v.pos.x - fx * 1.5 + fz * 0.8 * sd, 0.35, v.pos.z - fz * 1.5 - fx * 0.8 * sd), { n: 7, size: 1.1, life: 1.0, col: '#e2dcd2', spread: 1.5, dir: [0, -0.6], seed: 20 + sd });
    }
    yield 0.4;
    yield* this.say('T06', t2.fig, 0.1);
    // their car comes after them; the guns still going as they run back to it
    this.firing = null;
    this.disarmThug(t1);
    this.disarmThug(t2);
    this.fillK = 1;
    this.cue('chase');
    this.startPursuit();
    this.check = { x: DANNY_CAR.x, y: DANNY_CAR.y + 0.05, z: DANNY_CAR.z, yaw: DANNY_CAR.yaw, back: { x: PARK.entrance.x, z: PARK.entrance.z + 4 } };
    this.film(false);
    g.camRig.yaw = v.yaw;
    this.objective('<b>Lose them</b> - up through the car park', PARK.route[1].x, PARK.route[1].z, 'Up');
    this.howto('climb', 10);
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
        // (a pistol: its slide along the aim, its grip down in the hand - drawn as a comic draws one, a
        // little bigger than life and black, a grey glint along its top: read at a glance across the
        // sidewalk, ROADMAP 18.9)
        fr.lineXYZ(h.x - d.x * 0.05, h.y - d.y * 0.05 + 0.03, h.z - d.z * 0.05, h.x + d.x * 0.27, h.y + d.y * 0.27 + 0.03, h.z + d.z * 0.27, [0.04, 0.04, 0.06], 10, 900 + q.c.id, 1, 0.003, 0);
        fr.lineXYZ(h.x, h.y + 0.025, h.z, h.x - d.x * 0.035, h.y - 0.13, h.z - d.z * 0.035, [0.04, 0.04, 0.06], 8, 901 + q.c.id, 1, 0.003, 0);
        fr.lineXYZ(h.x - d.x * 0.03, h.y - d.y * 0.03 + 0.05, h.z - d.z * 0.03, h.x + d.x * 0.24, h.y + d.y * 0.24 + 0.05, h.z + d.z * 0.24, [0.62, 0.64, 0.7], 2.5, 902 + q.c.id, 1, 0.003, 0);
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
      // (round 14: a drawn puff of the shot's smoke at the muzzle; its word only where it is near and
      // in the picture - not over a far figure)
      if (this.comic && this.comic.puff) this.comic.puff(v3(mx, my, mz), { n: 4, size: 0.5, life: 0.55, col: '#ece6dc', dir: [0, -0.9], spread: 0.6, seed: this.bangs });
      const sa = this.comic && far < 14 ? this.comic.at(v3(mx, my, mz)) : null;
      if (this.bangs <= 3 && sa && sa[0] > 0.12 && sa[0] < 0.88 && sa[1] > 0.15 && sa[1] < 0.85) this.comic.word(this.bangs === 2 ? 'BLAM!' : 'BANG!', v3(mx, my + 0.3, mz), { fill: '#fff4d6', burst: '#ff3b4f', size: 0.075, life: 0.55 });
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
      // (ROADMAP 18.9: men who have come to hurt him, and look it - the one who talks in a dark suit,
      // his hair combed back; the other one big, in black, his head shaved: render/folkspec.js 'mob',
      // 'bouncer')
      const lk = (role) => roleLook(role) || civilianLook({ fem: false, kind: 'street' });
      const a = this.person('t1', THUGS[0].x, THUGS[0].z, lk('mob'), { face: PARK.thugsFace });
      const b = this.person('t2', THUGS[1].x, THUGS[1].z, lk('bouncer'), { face: PARK.thugsFace });
      // (their drawn faces in the film's middle shots, as Lily's: ROADMAP 18.9)
      a.fig.portraitPx = 46;
      b.fig.portraitPx = 46;
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
    // (round 11: the fight through the car park - theirs after him, theirs waiting for him, the paint:
    // game/prologue/paintfight.js. Their car the first, along the curb to the way in and in after him,
    // never left far behind - game/prologue/chase.js catchUpNow - its man at the window with the gun)
    if (!this.fight) this.fight = new PaintFight(this);
    // (his car never blown up in it: caught instead - game/vehicles.js hurt)
    if (this.dannyCar) this.dannyCar.keepAlive = () => this.caught();
    const E = PARK.entrance;
    const e = this.fight.add(v, { keep: 10, catchUp: true, color: 0, fireT: 2.5, seed: [[THUG_CAR.x + 4, 0.17, THUG_CAR.z - 0.4], [E.x - 3, 0.17, E.z + 4.2], [E.x, 0.17, E.z + 0.8], [E.x, 0.17, E.z - 7]] });
    this.pursuers = [e.Q];
    this.pursuer = e.Q;
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
    // (round 11: theirs waiting on the street floor and the first floor up; a wreck - or caught -
    // before the first floor starts again in his bay)
    if (!this.check) this.check = { x: DANNY_CAR.x, y: DANNY_CAR.y + 0.05, z: DANNY_CAR.z, yaw: DANNY_CAR.yaw, back: { x: PARK.entrance.x, z: PARK.entrance.z + 4 } };
    this.checkLv = 0;
    this.armFloor(0);
    this.armFloor(1);
    yield 2.2;
    yield* this.say('L12', L.fig, 0.25);
    yield* this.say('D20', P.fig, 0.25);
    yield* this.say('L13', L.fig, 0.2);
    yield* this.say('D21', P.fig, 0.3);
    // up and up: the way up has no way out but the roof - half way, the dark car still on them
    // (round 8's car park is eight floors, not six: its levels from PARK - the roof run the top floor)
    // (round 11: the roof the top level - round the turn at its north end off the last ramp, and into
    // the run west of its barriers, heading south)
    const TOP = PARK.main.levels.length - 1;
    yield () => lvOf(v()) >= TOP * 0.5;
    yield* this.say('D22', P.fig, 0.2);
    yield () => {
      const c = v();
      return !!c && lvOf(c) >= TOP - 0.05 && c.pos.x < PARK.roofBarX && c.pos.z > PARK.main.zN - 3;
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
    this.howto('floor', 6);
    if (g.gps) g.gps.clear();
    if (Pu) Pu.keep = 5;
    this.gunman = this.cast.t2 || null;
    // (round 11: the paint from their window - game/prologue/paintfight.js - not the sparks of before;
    // the others stopped where they are: the roof is the first car's and his)
    if (this.fight) {
      this.fight.halt();
      this.fight.on = true;
    }
    this.check = { x: RUNUP.x, y: RUNUP.y + 0.05, z: RUNUP.z + 6, yaw: RUNUP.yaw, back: { x: PARK.main.xc - 4, z: RUNUP.z - 2 } };
    // (said as he floors it - not waited for: out of the turn fast, he is at the sixty metres before
    // she has finished it, and the edge does not wait)
    this.say('L14', L.fig, 0.2).next();
    // sixty metres short of the edge: time all but stops
    yield () => {
      const c = v();
      return !!c && c.pos.z > PARK.edge.z - 62 && c.pos.x < PARK.main.xc;
    };
    const car = v();
    this.shooting = false;
    if (this.fight) this.fight.on = false;
    // (where they are now they stay: no bringing them up while he draws and takes the jump)
    if (Pu) Pu.catchUp = false;
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
    // (round 10: the idea lighting up his face - the world behind him gone hot orange, the lines in)
    this.shot({ from: this.inCar(car, 0.02, 1.2, 0.5), look: this.faceOf(P), fov: 44, dur: 1.6, hand: 0.25 });
    this.emote([1.0, 0.45, 0.12], P);
    if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(P), 1.4, 0.7);
    yield 1.5;
    this.emote(null);
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
      // (up and back more than out to the side: three metres out it went through whatever stood
      // beside the car - the stairs' tower, a wall - ROADMAP 18.9)
      path: [this.shots.lastPos.clone(), at(1.0, -1.2, 2.3), at(0.7, -5.2, 4.0), gp],
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
    // (round 8, the player's word: he takes out his pencil and draws it from where he sits - over his
    // shoulder, his hand up with it at the windscreen, and far off at the roof's edge a giant one
    // coming down out of the sky to draw what his draws, line by line: game/prologue/ramp.js
    // buildSketch. The lines rush in round his hand, an anime's moment)
    {
      const fig = P.fig;
      const was = fig.carry;
      fig.carry = 'pencil';
      const hand = new THREE.Vector3();
      const aim = () => {
        const St = car.seatOf ? car.seatOf() : { u: -0.25, y: 0 };
        const fx = Math.sin(car.yaw);
        const fz = Math.cos(car.yaw);
        const u = St.u + 0.55;
        // (out in front of him at the height of his eyes, at the windscreen: pointing the way)
        hand.set(car.pos.x + fx * u + fz * 0.25, (car.pos.y || 0) + St.y + 1.25, car.pos.z + fz * u - fx * 0.25);
        fig.holdUpR = hand;
        return hand;
      };
      aim();
      // (the giant pencil comes down as his goes up: it lands as the picture cuts to it)
      this.ramp.t = -1.3;
      // his: from outside his open window, at his side - his face, and his arm up with the pencil
      // pointed out ahead at the roof's edge; the lines rushing in round his hand
      this.shot({ from: this.inCar(car, 1.75, 1.3, 0.75), look: () => aim().clone().lerp(this.headJ(P) || hand, 0.4), fov: 44, dur: 1.6, hand: 0.3 });
      if (this.comic && this.comic.focus) this.comic.focus(() => aim(), 1.4, 0.65);
      g.audio.play('whoosh', 0.5);
      let tt = 0;
      let said = false;
      let cut = false;
      yield () => {
        aim();
        tt += this.dtR || 0.016;
        // then far off at the roof's edge, on a long lens from over the car: the giant one, down out
        // of the sky, and drawing
        if (!cut && tt >= 1.6) {
          cut = true;
          this.shot({ from: wld(R.startX + 18, Y + 6.2, rz + 3.5), look: wld(R.startX - 5, Y + 1.6, rz), fov: 30, dur: 1.5, hand: 0.2 });
        }
        // (and as its point touches the roof, the scratch of it, in letters)
        if (!said && this.ramp.t > 0.5 && this.comic && this.ramp.sketch) {
          said = true;
          const w = this.ramp.sketch.localToWorld(this.ramp.strokes[0].pts[0].clone());
          this.comic.word('SKRITCH!', v3(w.x, w.y + 2.5, w.z), { fill: '#ffd23f', burst: '#1b1430', size: 0.075, life: 1.3, tilt: 0.15 });
        }
        return tt >= 3.1;
      };
      fig.holdUpR = null;
      fig.carry = was;
    }
    const cam = g.camera;
    // (and out of the car: from beside it, behind, the lines going on far ahead)
    const c0 = wld(S + 14, Y + 3.4, rz - 7.5);
    const dir = wld(mid, Y + 1.2, rz).sub(c0).normalize();
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
    this.howto('ramp', 6);
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
    // (round 12, the player's word: off the lip it flies - far out and high, and there is no roof
    // across the street to come down on: only a rotor drawn on it in the air will hold it up)
    const J = new Flight(g, car, prof);
    this.jump = J;
    this.flight = J;
    const L = this.cast.lily;
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
    // the rear three-quarters of it leaving the lip, then wide as it soars out over the street
    this.shot({ from: () => off(car, 7, 5, 1.2), look: () => v3(car.pos.x, car.pos.y + 0.6, car.pos.z), fov: 50, dur: 1.4, hand: 0.4, shake: 0.12, roll: 0.08, rollTo: 0.02 });
    this.flash(0.1, '#ffffff');
    yield () => J.apex;
    // the top of the arc: time nearly still; the title in the picture
    this.slow(0.03, 9);
    this.cue('title');
    // (the camera swings out from behind its rear quarter to its side, low under it - the car high in
    // the picture against the towers and the sunset, the title under it)
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
    this.ui.title(true, GAME_TITLE, CREDIT);
    yield 3.4;
    this.ui.title(false);
    yield 0.4;
    // and under it: nothing - the street far down, the open ground to the water. From below, the car
    // hanging against the sky; her voice
    this.shot({ from: () => off(car, 3, -6, -8), look: () => v3(car.pos.x, car.pos.y + 0.4, car.pos.z), fov: 46, dur: 2.4, hand: 0.25, roll: -0.06 });
    if (L) {
      this.feel(L.fig, 'scared', 4);
      yield* this.say('L08', L.fig, 0.3);
    } else yield 1.2;
    // (round 13: the idea, an anime's - in on his eyes in the stopped time, the light in them, the lines
    // rushing in; in his head: what flies? - and white)
    {
      this.feel(P.fig, 'angry', 3);
      this.shot({ from: this.inCar(car, -0.05, 1.2, 0.56), to: this.inCar(car, -0.05, 1.2, 0.5), look: this.faceOf(P), fov: 28, dur: 1.7, hand: 0.15, dof: 1 });
      this.emote([1.0, 0.86, 0.45], P);
      if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(P), 1.5, 0.9);
      this.thought('TH6', 1.8);
      yield 1.45;
      this.flash(0.18, '#fffaf0');
      this.emote(null);
    }
    // the second drawing: a rotor, on the car in the air
    yield* this.rotor(car);
    // (its rotor turning: its own again in the air, held up where it is)
    J.release();
    this.jump = null;
    this.check = null;
    // (the game's camera eased in from the drawing's - film(false))
    this.film(false);
    g.camRig.yaw = car.yaw;
    g.audio.play('magic', 0.8);
    this.flash(0.08, '#fff4d6');
    this.comic.word('WHUP-WHUP!', v3(car.pos.x, car.pos.y + 2.2, car.pos.z), { fill: '#ffd23f', burst: '#ff4f8b', size: 0.085, life: 1.2, tilt: -0.12 });
    this.slow(1, 3);
    this.cue('chase', { heat: 0.3 });
    this.objective('Fly to the <b>beach</b> - set down on the sand', LOOKOUT.x, LOOKOUT.z, 'Beach');
    this.howto('fly', 12);
    this.hour(18.62, 0.004);
    this.start(9);
  }

  // (round 12) the rotor, drawn on the car in the air - the game's own part pen (game/partpen.js,
  // game/fuse.js): the camera the player's, close on the car; the pen out on it, the rotor chosen;
  // and a pencil over the roof drawing a straight line across it, again and again, till the player
  // draws - whatever is drawn there is the rotor
  *rotor(car) {
    const g = this.game;
    const fd = g.freedraw;
    // (the car in the middle of the picture from behind and over it, the sky over its roof to draw on -
    // held there, steady, as it hangs: the pen's own camera put by - game/fuse.js sketchCam)
    if (g.fuse) g.fuse.camHeld = true;
    const back = () => {
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      return v3(car.pos.x - fx * 7.5, car.pos.y + 3.2, car.pos.z - fz * 7.5);
    };
    // (the car a little under the middle, the sky over its roof clear - the pen's rows of parts put
    // away: the rotor is chosen already, and on a phone they covered the picture)
    this.shot({ from: back, look: () => v3(car.pos.x, car.pos.y + 2.1, car.pos.z), fov: 50, dur: 600, hand: 0 });
    if (!document.getElementById('pro-rotor-css')) {
      const st = document.createElement('style');
      st.id = 'pro-rotor-css';
      st.textContent = 'body.pro-rotor .pp-legend, body.pro-rotor .pp-row, body.pro-rotor .pp-slots, body.pro-rotor #fd-hint { display: none !important; }';
      document.head.appendChild(st);
    }
    document.body.classList.add('pro-rotor');
    this.ui.film(false);
    g.hud.show();
    this.drawingRotor = true;
    this.howto('rotor', 0);
    const teach = this.teachRotor(car);
    const has = () => !!(car.fz && car.fz.rotor > 0);
    let t = 0;
    yield () => {
      t += this.dtR || 0.016;
      if (has()) return true;
      if (fd && !fd.isOpen && g.player.inVehicle === car) {
        fd.show();
        if (g.fuse && g.fuse.pen && g.fuse.pen.choosePar) g.fuse.pen.choosePar('rotor');
      }
      teach.update(!!(fd && (fd.cur || (fd.group && fd.group.length))));
      return false;
    };
    teach.remove();
    document.body.classList.remove('pro-rotor');
    if (g.fuse) g.fuse.camHeld = false;
    // (whatever its size, big enough to hold the car up - the story's)
    car.fz.rotor = Math.max(car.fz.rotor || 0, 1.3);
    car.fz.airCtl = Math.max(car.fz.airCtl || 0, 1);
    car.fuseUp = true;
    if (fd && fd.isOpen) fd.close();
    this.drawingRotor = false;
    this.ui.card(null);
  }

  // where on the screen the rotor goes: a line across over the car's roof, its two ends ([x, y] px)
  rotorLine(car) {
    const cam = this.game.camera;
    const H = (car.heightM || 1.45) + 0.85;
    const rx = Math.cos(car.yaw);
    const rz = -Math.sin(car.yaw);
    const a = v3(car.pos.x - rx * 1.9, car.pos.y + H, car.pos.z - rz * 1.9).project(cam);
    const b = v3(car.pos.x + rx * 1.9, car.pos.y + H, car.pos.z + rz * 1.9).project(cam);
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    const P0 = [((a.x + 1) / 2) * W, ((1 - a.y) / 2) * Hh];
    const P1 = [((b.x + 1) / 2) * W, ((1 - b.y) / 2) * Hh];
    return P0[0] <= P1[0] ? [P0, P1] : [P1, P0];
  }

  // the pencil that shows how: over the car's roof, a straight line drawn across it from one side to
  // the other, its dashes left behind it, again and again - gone while the player draws
  teachRotor(car) {
    const el = document.createElement('div');
    el.className = 'pro-teach';
    el.innerHTML = '<svg><line class="tl"/><g class="tp"><path d="M12 2h38v12H12z" fill="#ffd23f" stroke="#1b1430" stroke-width="2"/><path d="M50 2h8v12h-8z" fill="#ff7ab8" stroke="#1b1430" stroke-width="2"/><path d="M12 2L1.5 8 12 14z" fill="#f3d7a8" stroke="#1b1430" stroke-width="2" stroke-linejoin="round"/><path d="M1.5 8l4.5-2.6v5.2z" fill="#1b1430"/></g></svg>';
    if (!document.getElementById('pro-teach-css')) {
      const st = document.createElement('style');
      st.id = 'pro-teach-css';
      st.textContent = '.pro-teach{position:fixed;inset:0;z-index:60;pointer-events:none;transition:opacity .25s}.pro-teach.off{opacity:0}.pro-teach svg{width:100%;height:100%;overflow:visible}.pro-teach .tl{stroke:#fff8ec;stroke-width:6;stroke-linecap:round;stroke-dasharray:14 12;filter:drop-shadow(0 0 4px #1b1430)}';
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
    const line = el.querySelector('.tl');
    const pen = el.querySelector('.tp');
    const t0 = performance.now();
    return {
      update: (drawing) => {
        el.classList.toggle('off', drawing);
        const [[x0, y0], [x1, y1]] = this.rotorLine(car);
        // (1.5 s across, a breath at the end, again)
        const k = Math.min(1, ((performance.now() - t0) % 2000) / 1500);
        const x = x0 + (x1 - x0) * k;
        const y = y0 + (y1 - y0) * k;
        line.setAttribute('x1', x0);
        line.setAttribute('y1', y0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', y);
        pen.setAttribute('transform', `translate(${x} ${y}) rotate(-38) translate(-2 -8) scale(1.4)`);
      },
      remove: () => el.remove(),
    };
  }

  // ------------------------------------------------------------------ 9. AWAY, AND QUIET
  *s9() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const v = () => P.inVehicle;
    // (round 12: flown to the beach on its rotor - the dark car left on the roof behind - and set down on
    // the sand near the water: the ending)
    if (this.pursuer) {
      this.pursuer.paused = true;
      this.pursuer.input.handbrake = true;
    }
    this.descend = false;
    yield () => {
      const c = v();
      return !!c && !c.air && this.dist(LOOKOUT.x, LOOKOUT.z) < 45 && Math.abs(c.speed || 0) < 6;
    };
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
    // facing the water, the pier off to the north - from outside, the two of them in it, still
    this.shot({ from: this.carSide(car, 1, 2.3, 1.85, 1.0), to: this.carSide(car, 1, 2.0, 1.75, 0.8), look: this.cabin(car, 0.95), fov: 42, dur: 9, hand: 0.35 });
    yield 2.4;
    // (ROADMAP 18.9: the talk in the car not one long picture from outside - in under the roof, each
    // face as it speaks and as it listens)
    const onD = (o = {}) => this.shot({ from: this.inCar(car, -0.1, 1.18, 0.52), look: this.faceOf(P), fov: 40, dur: 6, hand: 0.25, ...o });
    const onL = (o = {}) => this.shot({ from: this.inCar(car, 0.1, 1.12, 0.52), look: this.faceOf(L), fov: 42, dur: 6, hand: 0.25, ...o });
    this.feel(L.fig, 'angry', 6);
    L.fig.lookAt = P.fig.j.headC;
    onL();
    yield* this.say('L16', L.fig, 0.9);
    this.feel(P.fig, 'sad', 10);
    onD();
    yield* this.say('D24', P.fig, 0.6);
    this.feel(L.fig, 'sad', 10);
    onL();
    yield* this.say('L17', L.fig, 0.5);
    onD({ fov: 36 });
    yield* this.say('D25', P.fig, 0.6);
    // her drawing on her knees: she looks at it - the two of them, the page between
    const page = this.lilyPage();
    page.hold(L.fig, null, 'read');
    L.fig.lookAt = page.at;
    // (the two faces and the page under them: looking between their heads, a little low)
    const fD = this.faceOf(P);
    const fL = this.faceOf(L);
    const mid = () => {
      const a = typeof fD === 'function' ? fD() : fD;
      const b = typeof fL === 'function' ? fL() : fL;
      return v3((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.14, (a.z + b.z) / 2);
    };
    this.shot({ from: this.inCar(car, 0, 1.24, 0.62), look: mid, fov: 60, dur: 6, hand: 0.25 });
    yield 1.4;
    yield* this.say('L18', L.fig, 0.4);
    L.fig.lookAt = P.fig.j.headC;
    onD({ fov: 34 });
    // (round 13: in his head, the picture of it - there, coming up and going; and then his answer)
    this.memoryFlash(true);
    yield 1.3;
    yield* this.say('D26', P.fig, 0.3);
    page.hold(L.fig, null, 'hug');
    L.fig.lookAt = null;
    // a few seconds, nobody saying anything: outside again, from her side, the water past them
    this.shot({ from: this.carSide(car, -1, 2.6, 1.6, -0.6), look: this.cabin(car, 1.0), fov: 40, dur: 4, hand: 0.3 });
    yield 3.2;
    // the camera draws back over the water: the bay at the last of the sunset, the city alive - and
    // out there on the pier, the evening where the wheel stood
    const c0 = car.pos.clone();
    this.shot({
      path: [v3(c0.x + 3.6, c0.y + 2.6, c0.z + 3.2), v3(c0.x + 12, c0.y + 6, c0.z + 6), v3(c0.x + 30, c0.y + 16, c0.z + 4), v3(c0.x + 48, c0.y + 28, c0.z - 6)],
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
  // (the admin's film viewer: scene n (1..9) at the next start, played by itself if auto)
  watch(n, auto) {
    this.param = n > 1 ? 's' + n : '1';
    this.admin = true;
    this.wantAuto = !!auto;
  }

  finish() {
    const g = this.game;
    // (a thought still up: gone with the film)
    for (const q of this.thoughts || []) q.el.remove();
    this.thoughts = [];
    if (this.muffled && g.audio.muffle) {
      g.audio.muffle(false);
      this.muffled = false;
    }
    if (this.autopilot) {
      this.autopilot.stop();
      this.autopilot = null;
    }
    if (g.setAllOpen && g.settings) g.setAllOpen(!!g.settings.v.allOpen);
    try {
      // (watched as a film, scene by scene, in the admin's viewer: not played - a new game still
      // opens with it)
      if (!this.admin) localStorage.setItem(DONE_KEY, '1');
    } catch (e) {
      // (private browsing: it plays again next time)
    }
    this.done = true;
    this.co = null;
    this.drawing = false;
    Doodle.twos.on = false;
    if (g.bubbles) g.bubbles.hold = false;
    // (the evening's air let go quietly: the game's own from here)
    if (this.air && g.audio && g.audio.ctx) this.air.levels(g.audio.ctx.currentTime, 0, 0, 0);
    if (g.pipe) {
      g.pipe.paintWant = 0;
      if (g.pipe.paintR) g.pipe.paintR = [2.2, 5.5];
      Object.assign(g.pipe.look, { rim: 0, grade: 0, grain: 0, personW: 1, fill: 0 });
    }
    shared.uPenDens.value = 1;
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
    if (this.fight) {
      this.fight.dispose();
      this.fight = null;
    }
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
