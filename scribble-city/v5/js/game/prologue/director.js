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
import { HeldPistol } from './pistol.js';
import { Acting, ACTS } from './acting.js';
import { Comic } from './comic.js';
import { civilianLook, kidLook, roleLook, roleNth, folkLook } from '../looks.js';
import { FOLK, FOLK_ON } from '../../render/folkspec.js';
import { Doodle } from '../doodle.js';
import { Soundscape, airAt } from './soundscape.js';
import { loadTrack, trackBuf, Looper } from './tracks.js';
import { howto as howtoCard } from './howto.js';
import { shared, flashLight } from '../../render/materials.js';
import { clamp } from '../../core/util.js';
import { Kit, itemMats, linC } from '../items.js';
import { groundHeight } from '../../world/layout.js';
import { seatPlace } from '../vehicles.js';
import { lang, tr } from '../../core/lang.js';
import { objT, markT, thoughtT } from './i18n.js';

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
// (round 21, the player's word: the game is called Beyond the Outline - its first words small over
// the last, big: game/prologue/ui.js title)
export const GAME_TITLE = 'BEYOND THE|OUTLINE';
// (who made it, under the name - in the player's own language, as the rest of what is put over the
// picture is)
export const CREDIT = 'יוצר: אמיתי דהן';
// (round 16: in an English game)
export const CREDIT_EN = 'Created by Amity Dahan';
// (v2, round 13: the prologue told again to everyone who has seen it - it is a new film since; and
// watched in the admin's viewer it never counts as seen: finish)
const DONE_KEY = 'scribble.prologue.v2';

// the places
const DANNY0 = { x: 17, z: 6, yaw: Math.PI };
// (the film's poses - hold, handWay, pose below)
const _hA = new THREE.Vector3();
const _hB = new THREE.Vector3();
const _hC = new THREE.Vector3();
const _hX = new THREE.Vector3();
const _hT = new THREE.Vector3();
const EASES = {
  inout: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
  in: (t) => t * t,
  back: (t) => 1 + 2.70158 * (t - 1) * (t - 1) * (t - 1) + 1.70158 * (t - 1) * (t - 1),
};
const LILY_SEAT = { x: 40.2, z: 233.0, yaw: Math.PI / 2 };
// (a pistol shot's light: ROADMAP 23.18)
const GUN_LIGHT = [1, 0.8, 0.48];
// (a car's lamps: the light they throw, the lamps themselves in the picture)
const LAMP_LIGHT = [0.86, 0.92, 1];
const LAMP_GLARE = [1.9, 1.95, 2.25];
// (ROADMAP 23.18) scene 5's film inside the car park, at the south end of its street floor: their car far down the open floor
// west of his bay, its nose to it; where he and Lily have come to, on their way out, when its lamps come on
const IN_PARK = { car: { x: -175.5, z: 280.7, yaw: Math.PI / 2 }, danny: { x: -158.8, z: 282.4 } };
// (ROADMAP 23) the scenes filmed again, in the game's new look: ?filmlook=0 the film as it was
// (ROADMAP 23.12, stage 3: scene 4 too - nobody remembers)
// (ROADMAP 23.18, stage 4: and scene 5 - the two men, in the car park)
const NEW_LOOK = new Set([2, 3, 4, 5]);
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
// (round 22, the player's word: after the wheel his car not far off, and plain where it is - at the
// curb of Ocean Drive across the park from where the pier comes ashore, in the lane kept for parking,
// its nose to 5th Street; and where the cut after the wheel leaves the two of them, coming off the pier)
const PIER_CAR = { x: -0.9, z: 248.5, yaw: 0 };
const PIER_OFF = { x: 47.5, z: 243.2 };
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

// (the feelings a man does not have with his hands in his pockets)
const TENSE = new Set(['shock', 'scared', 'worried', 'angry', 'shout', 'hurt', 'surprised', 'pleading', 'sad']);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const _fk = new THREE.Vector3();

// (round 17: the rotor drawn in the air - Prologue.rotor) a drawing's lines (screen px) spread from
// their middle till its longer side is at least px long - at most three times as big
function spreadTo(strokes, px) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const L of strokes) {
    for (const q of L || []) {
      x0 = Math.min(x0, q[0]);
      x1 = Math.max(x1, q[0]);
      y0 = Math.min(y0, q[1]);
      y1 = Math.max(y1, q[1]);
    }
  }
  const side = Math.max(x1 - x0, y1 - y0);
  if (!(side > 0) || side >= px) return strokes;
  const k = Math.min(3, px / side);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return strokes.map((L) => (L ? L.map((q) => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k, ...q.slice(2)]) : L));
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
    this.lookNew = !(P && P.get('filmlook') === '0');
    this.twosOn = !(P && P.get('twos') === '0');
    // (?look=0: the painted look without the film's light and colour - to compare the two)
    this.lookOn = !(P && P.get('look') === '0');
  }

  // the prologue plays at the start of a new game (not in the tests, unless asked for). (round 22b,
  // the player's word: a new game always begins with the story - its opening, its song, its how-to -
  // even in a browser where it was played to the end before: that one went straight to the city and
  // its old welcome, and looked like the game of before. Finished once, a saved game still carries on
  // in the city: game.js continueGame)
  wants() {
    const g = this.game;
    if (g.classic || g.lab) return false;
    if (this.param === '0') return false;
    if (this.param) return true;
    if (!PROLOGUE_ON) return false;
    if (g.params.has('test')) return false;
    return true;
  }

  // ------------------------------------------------------------------ start
  begin() {
    const g = this.game;
    this.active = true;
    document.body.classList.add('prologue');
    // (ROADMAP 18.9: everything the pen can make open while it is told - a helicopter, wings, a turbo
    // on the car, every weapon - whatever the settings say: the game's own again after, finish)
    if (g.setAllOpen) g.setAllOpen(true);
    // (round 15, game/drawlock.js: a new player's short list - a few weapons, a few rides, each drawn
    // by hand before it is theirs - till the jump off the roof; not for a scene from the jump on)
    {
      const sN = /^s(\d)$/.exec(this.param || '');
      if (g.album && g.album.setEarly) g.album.setEarly(!(sN && +sN[1] >= 8));
    }
    // (round 16: the language chosen on the start screen - core/lang.js; ?subs= as before)
    const sp = g.params.get('subs');
    const subs = sp === 'en' || sp === 'he' ? sp : lang();
    this.ui = new PrologueUI(subs);
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
    L.baseY = 0;
    if (n >= 4) {
      this.spawnPier();
      if (this.set) {
        this.set.removeWheel();
        // (round 23: the parents who waved up at their kids by its gate gone on their way, as they went
        // in the story - started from here, they stood there still waving at nothing, one at the
        // shoulder of the two guys Danny asks)
        if (this.set.forget) this.set.forget();
        for (const b of this.set.below || []) {
          if (!b.walkTo) continue;
          b.x = b.walkTo.x;
          b.z = b.walkTo.z;
          b.walkDelay = 0;
          b.speed = 0;
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
    }
    if (n === 5) {
      // (round 22: coming off the pier, his car across the park at the curb)
      const car = this.parkPierCar();
      this.putDanny(PIER_OFF.x, PIER_OFF.z + 0.55, -Math.PI / 2);
      this.put(L, PIER_OFF.x + 0.4, PIER_OFF.z - 0.75, -Math.PI / 2);
      this.objective('Get to your <b>car</b>', car.pos.x, car.pos.z, 'Car');
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
    g.camRig.yaw = n >= 6 && this.dannyCar ? this.dannyCar.yaw : n === 5 ? -Math.PI / 2 : Math.PI;
    this.start(n);
  }

  start(n) {
    const S = [null, this.s1, this.s2, this.s3, this.s4, this.s5, this.s6, this.s7, this.s8, this.s9];
    // (the place's own echo for its voices: the pier and the beach, the street, the car's cabin)
    const SPACE = [null, 'open', 'open', 'open', 'open', 'street', 'car', 'car', 'car', 'car'];
    if (this.voices.space) this.voices.space(SPACE[n]);
    this.dropHolds();
    if (this.game.player) this.game.player.filmCrouch = 0;
    this.sceneN = n;
    // (ROADMAP 23: the scenes filmed again in the game's own look - render/look.js lookFrame, tickLook below)
    this.newLook = NEW_LOOK.has(n) && this.lookNew;
    if (this.comic) this.comic.dark = !!this.newLook;
    this.sketching = false;
    this.stillHands = false;
    // (round 18: the cars locked only on the way to his own - s5 sets it)
    this.carOnly = null;
    // (round 23: hellos to passers-by back, whatever a scene left off; and no set kept clear but the
    // scene's own)
    this.noHello = false;
    this.setZone = null;
    // (ROADMAP 23.18: no gun left in a hand from a scene played before - game/prologue/pistol.js)
    if (this.gunmen) {
      for (const q of this.gunmen) {
        if (q.gun) q.gun.hide(q.c.fig);
        if (q.c.fig) q.c.fig.aim = 0;
      }
      this.gunmen = [];
    }
    this.gunsInside = false;
    // (ROADMAP 23.19: a machine gun can be drawn on the car while they are after him - game/drawlock.js chaseGear)
    this.chaseGun = n === 6 || n === 7;
    // (and the car park's lamps only through the chase: tickLamps)
    if (n < 6 || n > 8) this.lamps = null;
    this.sceneAt = this.clock || 0;
    // (round 17: a place marked for the scene before is not this one's)
    this.unbeacon();
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
    if (this.game.player.inVehicle && (this.sceneN || 0) >= 5) {
      // (round 18: down after the flight, E asks to get out - s9 ends the flight on it)
      if (this.sceneN === 9 && !this.holdCam && input.pressed.has('KeyE')) this.outAsked = true;
      input.pressed.delete('KeyE');
    }
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
    const cp = g.camera.position;
    const H = this.hidden || (this.hidden = new Set());
    // (ROADMAP 23.12: the film's own passers-by - the pier's crowd, the evening's strollers - are passers-by here too: one of them
    // going by a hand's breadth from the lens was half the picture)
    const mine = new Set();
    for (const [key, c] of Object.entries(this.cast)) if (!/^(crowd|eve)\d/.test(key)) mine.add(c);
    // (ROADMAP 18.9: and nobody of the city's between the camera and whoever the shot is on - a
    // passer-by on his phone across half of the thugs' scene: from the camera to well short of its
    // subject, in front of it, out of the picture until they are past)
    const S = this.shots;
    const fx = S.lastLook.x - cp.x;
    const fz = S.lastLook.z - cp.z;
    const fd = Math.hypot(fx, fz) || 1;
    const reach = Math.min(4.5, Math.max(2.2, fd * 0.8));
    for (const c of g.civilians.list) {
      if (!c.alive || mine.has(c) || (this.heroes && this.heroes.includes(c))) continue;
      const dx = c.pos.x - cp.x;
      const dz = c.pos.z - cp.z;
      const d = Math.hypot(dx, dz);
      const ahead = (dx * fx + dz * fz) / (fd * (d || 1));
      const inWay = d < 2.2 || (d < reach && ahead > 0.55);
      if (inWay && !H.has(c)) {
        c.fig.setVisible(false);
        H.add(c);
      } else if (!inWay && d > 2.6 && H.has(c)) {
        c.fig.setVisible(true);
        H.delete(c);
      }
    }
  }

  unhide() {
    for (const c of this.hidden) if (c.alive && !c.inside) c.fig.setVisible(true);
    this.hidden.clear();
  }

  // (cast round 8) the two of them together while the player has the game - not in the film's shots, which place every look
  // themselves: she looks up at her father every few seconds, glad, and he down at her now and then when he has stopped. A look is
  // only taken while nothing else has their heads (a line, a scene), and given back
  company(dt) {
    const L = this.cast && this.cast.lily;
    const P = this.game.player;
    const C = this._co || (this._co = { her: 2, him: 5, herOn: 0, himOn: 0 });
    const lf = L && L.fig;
    const pf = P && P.fig;
    if (!lf || !pf || !lf.j || !pf.j) return;
    const hers = pf.j.headC;
    const his = lf.j.headC;
    const near = !this.holdCam && Math.hypot(L.pos.x - P.pos.x, L.pos.z - P.pos.z) < 4.5 && !(pf.ride > 0) && !pf.aim;
    if (!near) {
      // (only a look this gave is taken back: a shot of the film that turns her eyes to him sets the very same point - and this,
      // every frame of the shot, took it away again. Found in ROADMAP 23: her eyes were never on him in the film)
      if (C.herOn > 0 && lf.lookAt === hers) lf.lookAt = null;
      if (C.himOn > 0 && pf.lookAt === his) pf.lookAt = null;
      C.herOn = C.himOn = 0;
      return;
    }
    if (C.herOn > 0) {
      C.herOn -= dt;
      if (C.herOn <= 0 && lf.lookAt === hers) lf.lookAt = null;
    } else if ((C.her -= dt) <= 0 && !lf.lookAt && !(lf.say && !lf.say.done)) {
      lf.lookAt = hers;
      C.herOn = 1.4 + Math.random() * 2.2;
      C.her = 3 + Math.random() * 5;
      if (!lf.feel || lf.feel.until < this.game.time) lf.feel = { mood: 'tender', until: this.game.time + C.herOn + 0.6 };
    }
    if (C.himOn > 0) {
      C.himOn -= dt;
      if ((C.himOn <= 0 || pf.speed > 2.5) && pf.lookAt === his) pf.lookAt = null;
    } else if ((C.him -= dt) <= 0 && !pf.lookAt && pf.speed < 1.2 && !(pf.say && !pf.say.done)) {
      pf.lookAt = his;
      C.himOn = 1.2 + Math.random() * 1.6;
      C.him = 5 + Math.random() * 7;
      if (!pf.feel || pf.feel.until < this.game.time) pf.feel = { mood: 'tender', until: this.game.time + C.himOn + 0.4 };
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
    this.company(dt);
    this.tickHolds();
    // (ROADMAP 23.11: a man afraid, or set against somebody, does not stand with his hands in his pockets - game/doodle.js
    // noPocket, for as long as the feeling the film gave him lasts)
    {
      const pf = this.game.player && this.game.player.fig;
      if (pf) pf.noPocket = (pf.tenseUntil || 0) > this.game.time;
    }
    this.tickExtras(dt);
    // (the cars and their paint on the game's own step - the script and its film on the real time,
    // round 13: game.js rawK)
    const dtG = Math.min(dt, this.game.realDt || dt);
    for (const p of this.pursuers || []) p.update(dtG * this.k);
    if (this.fight) this.fight.update(dtG * this.k);
    this.watchdog(dt);
    this.tickCast(dt);
    this.tickBeacon(dt);
    this.tickHeroes();
    this.tickLook();
    this.tickAir(dt);
    if (this.page) this.page.update();
    this.acting.update(dt);
    this.comic.update(dt);
    this.tickGuns(dt);
    this.tickLamps(dt);
    // (Danny walking somewhere in a shot, on his own feet - or running)
    if (this.walkTo && this.walkDanny(this.walkTo.x, this.walkTo.z, this.walkTo.speed, this.walkTo.sprint)) this.walkTo = null;
    this.tickMarker();
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
      // (round 17: the gang's rifles - game/prologue/paintfight.js bang)
      loadTrack(A.ctx, 'sfx/shot_a.mp3');
      loadTrack(A.ctx, 'sfx/shot_b.mp3');
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
    // (ROADMAP 23.10: not in the scenes filmed in the game's own look - their people move at the picture's own rate. On twos a
    // hand going to a shoulder went there in four jumps, and whoever was put somewhere on a cut stood a frame as they had been)
    Doodle.twos.on = film && this.twosOn && !this.newLook;
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
    const story = (this.sceneN || 0) >= 2 && film && !this.newLook;
    // (ROADMAP 23: in the new look the brush is the lens's depth - what is behind the one the shot is on laid in broader, calmer
    // strokes, the more the closer the shot: wide, the street as the game draws it)
    const S0 = this.shots;
    const focus0 = film && S0 && S0.on ? clamp(S0.focus !== null && S0.focus !== undefined ? S0.focus : S0.lastPos.distanceTo(S0.lastLook), 1.2, 90) : 30;
    const closeK = clamp((7 - focus0) / 4.5, 0, 1);
    pipe.paintWant = this.paintOn && story ? 1 : this.paintOn && this.newLook && film ? 0.25 + 0.75 * closeK : 0;
    // (ROADMAP 23.9: a shot's own word for it - paint: a held picture painted whole, its people too: render/pipeline.js uPaintAll)
    const paintS = film && this.newLook && this.shots && this.shots.on && this.shots.shot ? this.shots.shot.paint || 0 : 0;
    if (paintS > 0) pipe.paintWant = Math.max(pipe.paintWant, paintS);
    {
      const L0 = pipe.look;
      if (L0) L0.paintAll = (L0.paintAll || 0) + (paintS - (L0.paintAll || 0)) * Math.min(1, (this.dtR || 0.016) * 5);
    }
    // (and the film's own key light on its people: from the camera's side - the shot's keySide, +1 its right - and above)
    {
      const fk = shared.uFilmKey.value;
      const Sh0 = film && S0 && S0.on ? S0.shot : null;
      if (this.newLook && film && Sh0 && Sh0.key !== 0) {
        const cam = g.camera;
        const e = cam.matrixWorld.elements;
        const sd = Sh0.keySide !== undefined ? Sh0.keySide : 1;
        // (the camera's right, its up, and back towards it)
        _fk.set(e[0] * 0.75 * sd + e[4] * 0.45 + e[8] * 0.5, e[1] * 0.75 * sd + e[5] * 0.45 + e[9] * 0.5, e[2] * 0.75 * sd + e[6] * 0.45 + e[10] * 0.5).normalize();
        fk.set(_fk.x, _fk.y, _fk.z, Sh0.key !== undefined ? Sh0.key : 0.85);
      } else fk.w = 0;
    }
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
      const e = 1 - Math.exp(-(this.dtR || 0.016) * 0.6);
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
      // (round 23: more of it on a face the shot asks it for: fill)
      const Sh = this.shots && this.shots.on ? this.shots.shot : null;
      LK.fill = film ? (Sh && Sh.fill !== undefined ? Sh.fill : 0.85) : 0;
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
      if (pipe.exposure !== undefined) pipe.exposure *= this.expK;
    } else if (LK && this.newLook && film) {
      // (ROADMAP 23: a shot in the game's own look - its light, its colour and its pens are render/look.js's; the film adds only
      // what a camera on people needs: a light on a face against the evening, a line of light round them, a little grain)
      const Sh = this.shots && this.shots.on ? this.shots.shot : null;
      Object.assign(LK, { rim: Sh && Sh.rim !== undefined ? Sh.rim : 0.75, grain: 0.02, personW: 1.15, comic: 0, mis: 0, fill: Sh && Sh.fill !== undefined ? Sh.fill : 0.35 });
      shared.uPenDens.value = 1;
    } else if (LK) {
      Object.assign(LK, { rim: 0, grade: 0, grain: 0, personW: 1, comic: 0, mis: 0, fill: 0 });
      shared.uPenDens.value = 1;
    }
    const S = this.shots;
    if (film && S && S.on) pipe.paintFocus = clamp(S.focus !== null && S.focus !== undefined ? S.focus : S.lastPos.distanceTo(S.lastLook), 1.2, 90);
    else if (P && P.pos) pipe.paintFocus = clamp(g.camera.position.distanceTo(P.pos), 1.5, 30);
    // (round 9, the film's language: the whip's smear, the moment's colour behind them - eased in and
    // out - and a lens that is shallow when the shot asks for it: dof)
    if (LK) {
      LK.smear = film && S && S.on ? S.smear || 0 : 0;
      const ew = film ? this.emoteWant || 0 : 0;
      const ek = 1 - Math.exp(-(this.dtR || 0.016) * (ew > (LK.emote || 0) ? 7 : 3));
      LK.emote = (LK.emote || 0) + (ew - (LK.emote || 0)) * ek;
      if (LK.emote < 0.002) LK.emote = 0;
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
      // (the new look's lens: a broader brush behind a close shot)
      if (this.newLook && film) pipe.paintR[1] = 3.2 + 4.5 * close + 6 * dofK;
      // (a painted still: the brush broad everywhere)
      const pS = film && this.newLook && S && S.on && S.shot ? S.shot.paint || 0 : 0;
      if (pS > 0) {
        pipe.paintR[0] = Math.max(pipe.paintR[0], 2.6 * pS);
        pipe.paintR[1] = Math.max(pipe.paintR[1], 5.5 * pS);
      }
    }
  }

  // ------------------------------------------------------------------ the film's tools
  film(on) {
    const was = !!this.holdCam;
    if (!on) {
      for (const f of this.shaded || []) f.filmShade = 0;
      this.shaded = null;
    }
    this.ui.film(on, !!this.newLook);
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
    // (round 23, the review: the passers-by of the city kept off the set while a scene is played on it
    // - one stood at Danny's shoulder through the whole of his talk with the two guys, the back of his
    // bald head across Danny's face; another, in a builder's hard hat, among the thugs. Taken away on a
    // cut, where nobody sees them go: setZone)
    if (this.setZone) this.clearZone();
    // (ROADMAP 23.6: s.shade - the people this shot keeps dark: whoever's back is to the lens in a shot over their shoulder)
    for (const f of this.shaded || []) f.filmShade = 0;
    this.shaded = s.shade || null;
    for (const f of this.shaded || []) f.filmShade = 1;
    this.shots.cut(s);
    // (round 11: a moment's colour gone with the shot it was in - not bleeding into the next)
    const LK = this.game.pipe && this.game.pipe.look;
    if (LK && !this.emoteWant && LK.emote) LK.emote = 0;
    return s.dur || 3;
  }

  // (round 23) the city's people out of the ring the scene is played in (setZone: { x, z, r }) - not the
  // story's own, its extras either: their scene lets them go in its own time
  clearZone() {
    const Z = this.setZone;
    const g = this.game;
    const C = g.civilians;
    if (!Z || !C || !C.list) return;
    for (const c of C.list.slice()) {
      if (c.gone || c.riding || c.owner === this) continue;
      if (Math.hypot(c.pos.x - Z.x, c.pos.z - Z.z) >= Z.r) continue;
      // (let go by whatever had them - a group talking, a bench, a busker - and out of the city at
      // once, on this very cut: the city takes its gone away only four times a second, and they would
      // be in the new shot's first frames)
      if (c.owner && C.release) C.release(c);
      C.remove(c);
    }
  }

  // (ROADMAP 18.9) how to play what comes now: its card (game/prologue/howto.js) - kept up while the
  // player is at it (life 0), or for life seconds; a newer card, or the film, takes it away
  howto(key, life = 0) {
    // (round 22: on a phone, whether a car is driven by the buttons - ◀ ▶ and the pedals - or the stick:
    // the cards say the one on the screen)
    const g = this.game;
    const o = howtoCard(key, g.touch, g.touch && !(g.settings && g.settings.get && g.settings.get('touchDrive') === 'stick'));
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
  // (ROADMAP 23.9: k - how far: less than all of it, the world still there under the colour, cooled and darkened)
  emote(col = null, k = 1) {
    this.emoteWant = col ? k : 0;
    if (col) this.emoteCol = col;
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
    // (ROADMAP 23.9: the held picture lit as the shot was - its key, its rim, its lens carried over: cut anew with none of
    // them, the light on a face changed as its name came up)
    S.cut({ ...this.heldSpec(), from: S.lastPos.clone(), look: S.lastLook.clone(), fov: S.lastFov, dur: life + 1, hand: 0 });
    g.audio.play('whoosh', 0.55);
    if (this.score && this.score.under) this.score.under(life, 0.45);
    this.comic.card({ ...o, life });
    yield life + 0.04;
    this.k = this.kWant = k0 || 1;
  }

  // what of the shot on now a held picture keeps: its light and its lens, none of its moves
  heldSpec() {
    const sh = this.shots && this.shots.shot;
    const o = {};
    if (sh) for (const key of ['key', 'keySide', 'rim', 'fill', 'dof', 'focus', 'shade', 'roll']) if (sh[key] !== undefined) o[key] = sh[key];
    return o;
  }

  // (ROADMAP 23.9) the picture held and painted whole - an old anime's "postcard memory": the shot stopped where it is, the
  // brush over all of it, its people too, for life seconds; then on
  *paintedStill(life = 1.4) {
    if (this.ff) return;
    const S = this.shots;
    const k0 = this.kWant;
    this.k = this.kWant = 0.0002;
    S.cut({ ...this.heldSpec(), from: S.lastPos.clone(), look: S.lastLook.clone(), fov: S.lastFov, dur: life + 1, hand: 0, paint: 1 });
    if (this.score && this.score.under) this.score.under(life, 0.6);
    yield life;
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
      // (this.stillHands: the scene keeps its people's hands where its shots have them - acting.js play's `still`)
      this.acting.play(fig, id, d, listeners, !!this.stillHands);
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
    // (round 16: shown in the language chosen - Hebrew for a Hebrew game, i18n.js; the English kept
    // as its key, the autopilot's)
    this.ui.objective(objT(html));
    const g = this.game;
    if (x !== null && g.gps) g.gps.set(x, z, markT(name || 'Lily'));
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
    // (round 11: the story's people drawn in full further off than the street's - on a phone too:
    // render/people.js draw)
    if (c.fig) c.fig.lodFar = 85;
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
    this.carry(c.fig, x - c.pos.x, z - c.pos.z);
    c.pos.set(x, c.pos.y, z);
    c.pl.x = x;
    c.pl.z = z;
    c.pl.speed = 0;
    c.pl.follow = false;
    if (face !== null) {
      c.pl.face = face;
      c.yaw = face;
      c.faceYaw = face;
      if (c.fig) c.fig.yaw = face;
    }
    this.repose(c.fig);
  }

  faceTo(c, x, z) {
    if (!c) return;
    const f = Math.atan2(x - c.pos.x, z - c.pos.z);
    c.pl.face = f;
    c.faceYaw = f;
  }

  // (ROADMAP 23) a hand held somewhere from frame to frame - on a shoulder, round a neck, open for a hug: fn gives the place each
  // frame (the rig's reachR / reachL, game/doodle.js), until unhold
  // (ROADMAP 23, the film's poses) With o, the hand is posed as a hand is - the owner's word: hands "come out the wrong way round,
  // twisted". o.palm: where its palm faces; o.fingers: where its fingers point (else on from the forearm, as far as the palm's way
  // lets them); o.on: fn gives the point the PALM is laid on (the wrist is worked back from it); o.grip: closed, round what it
  // holds or cups; o.pole: the elbow's way; o.ease: the time it takes to get there from where the hand is (0.32 s) - and let go
  // (unhold), it goes back down as slowly. Each of them a vector or a function giving one. Without o: the wrist on the point, at
  // once, the hand as it goes on from the forearm (as the scenes not yet filmed again have it).
  hold(fig, side, fn, o = null) {
    const sideK = side === 'R' ? 'R' : 'L';
    this.unhold(fig, side, 0);
    const hs = this.holds || (this.holds = []);
    // (a hand let go and still on its way down: taken from where it is)
    for (let i = hs.length - 1; i >= 0; i--) if (hs[i].rel && hs[i].fig === fig && hs[i].relSide === sideK) hs.splice(i, 1);
    const hd = fig.j && fig.j['hand' + sideK];
    const sh = fig.j && fig.j['shoulder' + sideK];
    if (o && (o.ease === undefined || o.ease > 0.08)) this.cloth(fig, 0.8, 0.2 + (o.ease === undefined ? 0.32 : o.ease) * 0.4);
    hs.push({ fig, side, fn, o, ai: sideK === 'R' ? 0 : 1, v: v3(0, 0, 0), rel0: o && hd && sh ? hd.clone().sub(sh) : null, t: 0, f: v3(0, 0, 1), n: v3(0, 1, 0), F: v3(0, 0, 1), N: v3(0, 1, 0), pole: v3(0, -1, 0) });
  }

  // let go: at once (ease 0, or a hand held the old way), or the hand going back down to its side over ease seconds
  unhold(fig, side = null, ease = 0.3) {
    if (!this.holds) return;
    const out = [];
    this.holds = this.holds.filter((h) => {
      const m = h.fig === fig && !h.tick && (!side || h.side === side);
      if (m) out.push(h);
      return !m;
    });
    for (const h of out) {
      const key = 'reach' + h.side;
      if (!h.o || !(ease > 0) || fig[key] !== h.v) {
        if (fig[key] === h.v) fig[key] = null;
        if (h.o) this.handFree(fig, h.side);
        continue;
      }
      // (down to where an arm hangs: under the shoulder, a little out and ahead)
      const from = h.v.clone();
      const sg = h.ai === 0 ? 1 : -1;
      const F0 = h.F.clone();
      const N0 = h.N.clone();
      const had = !!h.o.palm;
      let t = 0;
      this.holds.push({
        fig,
        side: 'rel',
        rel: true,
        relSide: h.side,
        tick: (dt) => {
          t = Math.min(1, t + dt / ease);
          const e = t * t * (3 - 2 * t);
          const sh = fig.j['shoulder' + h.side];
          const S = fig.scale || 1;
          const fy = fig.yaw || 0;
          _hA.set(sh.x + fig.right.x * sg * 0.06 * S + Math.sin(fy) * 0.07 * S, sh.y - 0.55 * S, sh.z + fig.right.z * sg * 0.06 * S + Math.cos(fy) * 0.07 * S);
          h.v.lerpVectors(from, _hA, e);
          fig[key] = h.v;
          if (had) this.handWay(fig, h, F0, N0, 1 - e);
          if (t >= 1) {
            fig[key] = null;
            this.handFree(fig, h.side);
            return false;
          }
          return true;
        },
      });
    }
  }

  // a hand back to its own way: on from its forearm, open, the elbow down and out
  handFree(fig, side) {
    const ai = side === 'R' ? 0 : 1;
    if (fig.handF) fig.handF[ai] = fig.handN[ai] = null;
    if (fig.handGrip) fig.handGrip[ai] = 0;
    fig['pole' + (side === 'R' ? 'R' : 'L')] = null;
  }

  // the hand's way this frame: k of the way from how a hand goes on from its forearm (thumb ahead) to fingers f, palm n
  handWay(fig, h, f, n, k) {
    const el = fig.j['elbow' + h.side];
    const hd = fig.j['hand' + h.side];
    _hC.subVectors(hd, el);
    if (_hC.lengthSq() < 1e-8) _hC.set(0, -1, 0);
    _hC.normalize();
    if (k < 1) {
      const fy = fig.yaw || 0;
      _hX.set(Math.sin(fy), 0, Math.cos(fy));
      _hX.addScaledVector(_hC, -_hX.dot(_hC));
      if (_hX.lengthSq() < 0.04) _hX.set(0, 1, 0).addScaledVector(_hC, -_hC.y);
      _hX.normalize();
      // (the hand's own palm as it hangs: the right one's to the left of its thumb, the left one's to the right)
      if (h.ai === 0) _hB.crossVectors(_hX, _hC);
      else _hB.crossVectors(_hC, _hX);
      h.F.copy(_hC).lerp(f, k).normalize();
      h.N.copy(_hB).lerp(n, k).normalize();
    } else {
      h.F.copy(f);
      h.N.copy(n);
    }
    fig.handF[h.ai] = h.F;
    fig.handN[h.ai] = h.N;
  }

  tickHolds() {
    if (!this.holds || !this.holds.length) return;
    const dt = this.dtR || 0.016;
    for (const h of [...this.holds]) {
      if (h.tick) {
        if (h.tick(dt) === false) {
          const i = this.holds.indexOf(h);
          if (i >= 0) this.holds.splice(i, 1);
        }
        continue;
      }
      const q = h.fn();
      if (!q) continue;
      const fig = h.fig;
      const o = h.o;
      if (!o) {
        h.v.copy(q);
        fig['reach' + h.side] = h.v;
        continue;
      }
      const val = (x) => (typeof x === 'function' ? x() : x);
      h.t += dt;
      const dur = o.ease === undefined ? 0.32 : o.ease;
      const k0 = dur > 0 ? Math.min(1, h.t / dur) : 1;
      const k = k0 * k0 * (3 - 2 * k0);
      const S = (fig.scale || 1) * (fig._handK || 1);
      let n = null;
      if (o.palm) {
        n = h.n.copy(val(o.palm)).normalize();
        if (o.fingers) h.f.copy(val(o.fingers)).normalize();
        else {
          const el = fig.j['elbow' + h.side];
          const hd = fig.j['hand' + h.side];
          _hC.subVectors(hd, el).normalize();
          h.f.copy(_hC).addScaledVector(n, -_hC.dot(n));
          if (h.f.lengthSq() < 0.03) h.f.set(0, 1, 0).addScaledVector(n, -n.y);
          h.f.normalize();
        }
      }
      // (the wrist: from the point the palm is laid on, back along the fingers and off what it lies on)
      _hT.copy(q);
      if (o.on && n) _hT.addScaledVector(h.f, -0.078 * S).addScaledVector(n, -0.016 * S);
      if (k < 1 && h.rel0) {
        const sh = fig.j['shoulder' + h.side];
        _hA.copy(sh).add(h.rel0);
        h.v.lerpVectors(_hA, _hT, k);
      } else h.v.copy(_hT);
      fig['reach' + h.side] = h.v;
      if (n) this.handWay(fig, h, h.f, n, k);
      if (fig.handGrip) fig.handGrip[h.ai] = o.grip && k > 0.5 ? 1 : 0;
      if (o.pole) fig['pole' + h.side] = h.pole.copy(val(o.pole));
    }
  }

  // (ROADMAP 23) the body's own pose eased to what is asked - game/doodle.js: fLean (forward from the hips, radians), fSide (to a
  // side, metres at the neck), fTwist (the shoulders turned), fHipY (the hips up or down), headTilt (the head to a shoulder) - over
  // dur seconds; ease: 'inout', 'out', 'in', 'back' (a little past it and back - a body settling). A later pose takes over the parts
  // it names
  pose(fig, to, dur = 0.5, ease = 'inout') {
    const hs = this.holds || (this.holds = []);
    for (const h of hs) if (h.poseOf === fig) for (const key in to) delete h.to[key];
    const from = {};
    for (const key in to) from[key] = fig[key] || 0;
    const E = EASES[ease] || EASES.inout;
    if (dur > 0.08) this.cloth(fig, 0.6, 0.18 + dur * 0.3);
    const mine = { ...to };
    let t = 0;
    hs.push({
      fig,
      side: 'pose',
      poseOf: fig,
      to: mine,
      tick: (dt) => {
        t = dur > 0 ? Math.min(1, t + dt / dur) : 1;
        const e = E(t);
        for (const key in mine) fig[key] = from[key] + (mine[key] - from[key]) * e;
        return t < 1;
      },
    });
  }

  // every hold and pose of the film dropped at once, and its people as they stand by themselves
  dropHolds() {
    const figs = new Set();
    for (const h of this.holds || []) figs.add(h.fig);
    if (this.game.player) figs.add(this.game.player.fig);
    for (const c of Object.values(this.cast || {})) if (c && c.fig) figs.add(c.fig);
    for (const h of [...(this.holds || [])]) if (!h.tick) this.unhold(h.fig, null, 0);
    this.holds = [];
    for (const fig of figs) {
      if (!fig || !fig.handF) continue;
      fig.reachR = fig.reachL = null;
      this.handFree(fig, 'R');
      this.handFree(fig, 'L');
      fig.fLean = fig.fSide = fig.fTwist = fig.fHipY = fig.headTilt = 0;
      fig.filmShade = 0;
    }
    this.shaded = null;
  }

  // one of the story's people moved a step - back out of a hug - still facing as they were: eased over dur seconds (walking it,
  // they turn to where they walk)
  // (ROADMAP 23.9: legs - the legs take the step: a pace back or aside on the screen, not a slide)
  glide(c, x, z, dur = 0.5, legs = false) {
    const x0 = c.pos.x;
    const z0 = c.pos.z;
    const d = Math.hypot(x - x0, z - z0);
    let t = 0;
    if (legs) this.cloth(c.fig, 0.5);
    (this.holds || (this.holds = [])).push({
      fig: c.fig,
      side: 'glide',
      tick: (dt) => {
        t = Math.min(1, t + dt / dur);
        const e = t * t * (3 - 2 * t);
        c.pos.x = x0 + (x - x0) * e;
        c.pos.z = z0 + (z - z0) * e;
        c.pl.x = c.pos.x;
        c.pl.z = c.pos.z;
        c.pl.speed = 0;
        if (legs) c.stepSp = t < 1 ? Math.max(0.7, (d / dur) * 1.2) : 0;
        return t < 1;
      },
    });
  }

  // (ROADMAP 23.9) cloth heard as somebody of the film moves: by how near the lens is (game/prologue/soundscape.js rustle)
  cloth(fig, k = 1, dur = 0.22) {
    if (this.ff || !this.holdCam || !this.air || !this.air.rustle || !fig || !fig.j) return;
    const A = this.game.audio;
    if (!A || !A.ctx) return;
    const d = this.game.camera.position.distanceTo(fig.j.neck || fig.j.hip);
    if (d > 9) return;
    const kk = k * Math.max(0.12, 1 - d / 9);
    this.air.rustle(A.ctx.currentTime, dur, kk);
    if (this.airLog) this.airLog.push([this.clock || 0, 'rustle', dur, kk]);
  }

  // Danny down on a knee (game/player.js filmCrouch) - flip: his left knee the one that is down
  kneel(k, flip = false) {
    const p = this.game.player;
    p.filmCrouch = k;
    if (k) p.fig.crouchFlip = !!flip;
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
    if (!fig) return;
    fig.feel = { mood, until: this.game.time + s };
    fig.tenseUntil = TENSE.has(mood) ? this.game.time + s : 0;
  }

  // Danny: placed (between two shots), turned, walked a few steps
  // (round 18, the player's word) on the way to his own car the game lets him into no other - carOnly:
  // the one car he may get into now (game.js enterTarget), set from 'Get to your car' till he is in it;
  // null, any
  mayBoard(v) {
    return !this.carOnly || v === this.carOnly;
  }

  // the words for a car by him he may not take now - or null
  notYours() {
    if (!this.carOnly) return null;
    const g = this.game;
    const P = g.player;
    if (P.mode !== 'foot') return null;
    const v = g.vehicles.nearest(P.pos, 3.2);
    if (v && v === this.carOnly) return null;
    if (!v && !g.traffic.nearestDoor(P.pos, 1.7)) return null;
    // (round 22: his car is the red one at the curb by the pier now, not one in the car park)
    return tr('לא את זו - המכונית של דני היא האדומה', "Not this one - Danny's car is the red one");
  }

  // (round 18, the player's word: the two men came to talk to Danny, and it was a car they talked to)
  // out of whatever he is in before a film - and a car that is not one of the story's taken out of its
  // picture, not left in the street between him and them
  outOfCar() {
    const g = this.game;
    const P = g.player;
    const v = P.inVehicle;
    if (!v) return;
    g.exitVehicle(true);
    const L = this.cast.lily;
    if (L && L.pl && L.pl.ride === v) L.pl.ride = null;
    if (v === this.dannyCar || v === this.thugCar || v.kept) return;
    const i = g.vehicles.list.indexOf(v);
    if (i < 0) return;
    v.dispose();
    g.vehicles.list.splice(i, 1);
    if (g.damage && g.damage.cars) g.damage.cars.delete(v);
  }

  // (round 22) his car where he left it before the evening began: at the curb of Ocean Drive by the pier
  parkPierCar() {
    const g = this.game;
    if (this.dannyCar) return this.dannyCar;
    const v = g.vehicles.spawnStock({ kind: 'muscle', color: [0.58, 0.1, 0.12] }, { x: PIER_CAR.x, z: PIER_CAR.z }, PIER_CAR.yaw);
    v.kept = true;
    v.pos.y = groundHeight(PIER_CAR.x, PIER_CAR.z);
    // (not blown up on the way, whatever it runs into: he needs it at the car park)
    v.keepAlive = () => {
      v.hp = Math.max(v.hp, v.maxHp * 0.3);
    };
    this.dannyCar = v;
    return v;
  }

  // (round 22) Lily out of the car she rode in, on her feet beside it (or where she is put after)
  lilyOut() {
    const L = this.cast.lily;
    if (!L || !L.pl) return;
    // (ROADMAP 23.18: also when the car she rode in has let her go already - outOfCar takes her ride away with Danny's, and
    // this then left her as she had been in it: sitting, at a seat's height, wherever she was put next. Found in scene 5:
    // Lily sat in the air beside him across the car park's floor)
    // (and whatever she was left as: out of a car she is on her feet - called only as she gets out of one)
    const c = L.pl.ride;
    L.pl.ride = null;
    L.riding = false;
    L.noCollide = false;
    L.baseY = 0;
    L.fig.sit = 0;
    L.fig.ones = false;
    if (c && c.pos) this.put(L, c.pos.x - Math.cos(c.yaw) * 1.3, c.pos.z + Math.sin(c.yaw) * 1.3, c.yaw);
  }

  // (ROADMAP 23.10) somebody of the film put somewhere else on a cut: their joints taken along at once. The rig sets them where
  // the body is only on its next step - and whatever was worked out from them in the same instant (a lens on a face, a hand laid
  // on a shoulder) was worked out from where they had stood: a first frame from nine metres off, a hand in the air
  carry(fig, dx, dz) {
    if (!fig || !fig.j || (!dx && !dz)) return;
    for (const key in fig.j) {
      const q = fig.j[key];
      if (q && q.isVector3) {
        q.x += dx;
        q.z += dz;
      }
    }
  }

  putDanny(x, z, yaw) {
    const p = this.game.player;
    this.carry(p.fig, x - p.pos.x, z - p.pos.z);
    p.pos.set(x, p.pos.y, z);
    p.vel.set(0, 0, 0);
    p.yaw = yaw;
    p.fig.yaw = yaw;
    this.repose(p.fig);
  }

  // (and their body set where they now are, facing as they now face, at once: this very frame's picture is of them there)
  repose(fig) {
    if (!this.holdCam || !this.newLook || !fig || !fig.update || fig.rag) return;
    fig.update(1e-4);
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
    this.seatCast();
    void dt;
    // the clock moved on with the story
    if (this.hourWant && g.daynight) {
      const d = this.hourWant - g.daynight.hour;
      if (Math.abs(d) > 0.0005) g.daynight.hour += Math.sign(d) * Math.min(Math.abs(d), this.hourRate * dt);
    }
  }

  // (round 20, the player's word: Lily stuck out under the car as it flew - she was put in her seat
  // after the city's people were moved, by where the car had been: a frame behind it, half a metre
  // under it as it climbed. game/game.js calls this right after the cars move, as Danny is seated)
  seatCast() {
    if (!this.active) return;
    // (round 25: the men at their cars' windows put where their cars are now, before they are posed -
    // game/prologue/paintfight.js placeShooters)
    if (this.fight && this.fight.shooters && this.fight.shooters.length) this.fight.placeShooters(this.game.player.inVehicle, true);
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
      // (round 24: in the body as it is drawn, and never with her head through its roof: the cushion
      // lowered as far as it asks - game/vehicles.js seatPlace)
      if (v.bodyPose) seatPlace(v, L.fig, -S.s, S.y + boost, S.u, L.pos);
      else L.pos.set(v.pos.x + fx * S.u - fz * S.s, (v.pos.y || 0) + S.y + boost, v.pos.z + fz * S.u + fx * S.s);
      L.vel.set(0, 0, 0);
      L.yaw = v.yaw;
      L.faceYaw = v.yaw;
      L.baseY = S.y + boost - (L.fig.seatDrop || 0);
      L.fig.sit = 1;
      L.fig.seatedAt = performance.now();
      // (holding on to her seat)
      L.fig.reachR = null;
    }
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
    // (ROADMAP 23.20: over a bridge into the west wing, or up its own ramp onto a floor of it: one of theirs is waiting there)
    if (PARK.wing && v.pos.x < PARK.main.x0 - 3 && Math.abs(lv - k) < 0.03) this.armWing(k, v.pos.z < (PARK.main.zN + PARK.main.zS) / 2);
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

  // (ROADMAP 23.20) theirs in the west wing: one waiting, dark, in its aisle on a floor he comes onto - at the far end of it
  // from where he came in, nose to him
  armWing(k, fromNorth) {
    const F = this.fight;
    const W = PARK.wing;
    if (!F || !W || k < 1 || k > W.top) return;
    const A = this.armedW || (this.armedW = new Map());
    if (A.has(k)) return;
    const M = PARK.main;
    const z = fromNorth ? M.zS - 14 : M.zN + 14;
    A.set(k, [F.spawn(W.aisleX, M.levels[k], z, fromNorth ? Math.PI : 0, { mode: 'wait', wake: 36, lv: k, keep: 9, color: (k + 2) % 4 })]);
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
        // (and the wing's: whichever of them still wait are let go - one is put out again when he comes onto a floor of it)
        if (this.armedW) {
          for (const list of this.armedW.values()) for (const e of list) if (F.enemies.includes(e) && e.mode === 'wait') F.remove(e);
          this.armedW.clear();
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
    if (first) this.thought('ערב אחד רגיל. רק אני והיא.', 2.8);
    yield 3.7;
    if (I && I.stream) I.stream.calm = false;
    // the city, his - and the game showing him round it (ROADMAP 18.9): a few things to do, each
    // told plainly, then Lily
    this.film(false);
    yield* this.tutorial();
    this.objective('Meet <b>Lily</b> at the ice cream stand', STAND.x, STAND.z, 'Lily');
    this.howto('lily', 14);
    // (round 17: the place by her stand, marked - reached anywhere in it)
    this.beacon(LILY_SEAT.x - 2.2, LILY_SEAT.z - 1.2, 3);
    // (in a car by her: out of it to meet her)
    let outTold = false;
    yield () => {
      const near = this.dist(LILY_SEAT.x, LILY_SEAT.z) < 30;
      if (near && g.player.inVehicle && !outTold) {
        outTold = true;
        this.ui.card(lang() === 'en'
          ? { title: 'Out of the car', say: 'You are here! Lily is met on foot - park by the stand.', lines: [[g.touch ? 'Car button' : 'E', 'get out of the car']] }
          : { title: 'יוצאים מהמכונית', say: 'הגעתם! את לילי פוגשים ברגל - חנו ליד הדוכן.', lines: [[g.touch ? 'כפתור הרכב' : 'E', 'לצאת מהמכונית']] });
      }
      if (outTold && !g.player.inVehicle) this.ui.card(null);
      return this.dist(LILY_SEAT.x, LILY_SEAT.z) < 8.5 && !g.player.inVehicle;
    };
    this.unbeacon();
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
    // (round 15, the player's word: no how-to cards over the screen, no steps to follow - only: walk
    // round the city and look at it; and then: break into a car and take it)
    // 1. walk round, look at it
    this.objective('Walk around the <b>city</b> - take a look at it');
    const p0 = P.pos.clone();
    yield () => {
      t += this.dtR;
      return t > 24 || (t > 9 && P.pos.distanceTo(p0) > 30);
    };
    yield 0.6;
    // 2. a car: the nearest one parked - his window smashed, in, away (game.js beginEntry)
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
      this.objective('Break into a <b>car</b> and take it', car ? car.pos.x : null, car ? car.pos.z : null, 'Car');
      t = 0;
      let gpsT = 0;
      yield () => {
        t += this.dtR;
        gpsT += this.dtR;
        if (gpsT > 1.5) {
          gpsT = 0;
          const c2 = parked();
          // (sent to another only when the nearest is another - its marker's click once)
          if (c2 && c2 !== car && g.gps) g.gps.set(c2.pos.x, c2.pos.z, 'Car');
          car = c2 || car;
        }
        return !!P.inVehicle || t > 90;
      };
      if (g.gps) g.gps.clear();
      yield 0.5;
    }
    // 4. drive it
    if (P.inVehicle) {
      this.objective('<b>Drive</b> - get a feel for it');
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
    // (round 15: a weapon or a ride from the short list, drawn for real - till one is made, or a while)
    // (round 17, the player's word: in the car, no stepping out - the pen draws on the car, the turbo
    // first of its things, and the game shows on the screen how a turbo is drawn: a flame out of its
    // back. Whatever is drawn while the turbo is what is chosen is the turbo. On foot, the short list)
    const DRAW_FOOT = 'Open the pen and <b>draw</b> a weapon or a ride';
    const DRAW_CAR = 'Open the pen and draw a <b>turbo</b> on the car';
    this.objective(P.inVehicle ? DRAW_CAR : DRAW_FOOT);
    this.howto(P.inVehicle ? 'draw' : 'drawFoot');
    {
      const F = g.freedraw;
      const pen = g.fuse && g.fuse.pen;
      const made = () => (F && F.stats && F.stats.made ? Object.values(F.stats.made).reduce((a, b) => a + b, 0) : 0) + (P.inVehicle && P.inVehicle.fuse ? P.inVehicle.fuse.parts.length : 0);
      let m0 = made();
      let car = P.inVehicle;
      let tm = -1;
      let penWas = false;
      let teach = null;
      t = 0;
      yield () => {
        t += this.dtR;
        // (in or out of a car: what is counted from changes with it)
        if (P.inVehicle !== car) {
          car = P.inVehicle;
          if (tm < 0) m0 = made();
          if (tm < 0) {
            this.objective(car ? DRAW_CAR : DRAW_FOOT);
            this.howto(car ? 'draw' : 'drawFoot');
          }
        }
        // (the pen out on the car: its things, the turbo's first - chosen each time it comes out)
        const onCar = !!(car && F && F.isOpen && pen && pen.isOpen);
        if (onCar && !penWas && pen.cat !== 'func') {
          pen.cat = 'func';
          pen.uiSig = '';
          pen.legSig = '';
          pen.showRow();
          pen.showLegend();
          if (F.info) F.info();
        }
        penWas = onCar;
        const teaching = onCar && pen.cat === 'func' && tm < 0;
        if (pen) pen.force = teaching ? 'turbo' : pen.force === 'turbo' ? null : pen.force;
        if (teaching && !teach) teach = this.teachTurbo(car);
        else if (!teaching && teach) {
          teach.remove();
          teach = null;
        }
        if (teach) teach.update(!!(F.cur || (F.group && F.group.length)));
        if (tm < 0 && made() > m0) tm = t;
        // (made: a breath to see it come to life; left be, it goes on all the same after a while)
        return (tm >= 0 && t > tm + 2.5 && !(F && F.isOpen)) || (tm >= 0 && t > tm + 6) || t > 90;
      };
      if (teach) teach.remove();
      if (pen && pen.force === 'turbo') pen.force = null;
    }
    this.howto(null);
    this.objective(null);
    yield 0.4;
  }

  // (ROADMAP 23) Gino behind his counter: one of the story's own people, drawn as they are - in place of the stand's plain figure
  // (ROADMAP 23.9, the owner's word: the people seen in the film "fixed - not somebody else every time it is played", and the
  // world round a scene alive.) The evening's own people round the stand and the pier's gate: the same eight every time, each
  // of the city's drawn people chosen by a rule (the nth woman, the nth man of the list), each with something to do. A couple at
  // the pier's railing, looking out at the sea and talking; two on the bench by the gate; a man at the far railing with his
  // phone; a woman buying at Gino's counter; two walking out along the pier to the wheel, slowly, and back.
  // the nth woman, or man, of the city's drawn people (grown, not one of the people at work): the same one every time
  folkNth(fem, n) {
    let k = -1;
    for (let i = 6; i < 36 && i < FOLK.length; i++) {
      const F = FOLK[i];
      if (!F || F.role || !!F.fem !== fem || F.age < 20) continue;
      if (++k === n) return i;
    }
    return fem ? 3 : 1;
  }

  spawnExtras() {
    if (this.extras) return;
    this.extras = [];
    const pickNth = (fem, n) => this.folkNth(fem, n);
    const sea = v3(60, 1.2, 190);
    const mk = (key, fem, n, x, z, yaw, o = {}) => {
      const c = this.person(key, x, z, folkLook(pickNth(fem, n)), { face: yaw });
      c.yaw = yaw;
      c.fig.yaw = yaw;
      c.extra = { ...o, t: Math.abs(Math.sin(n * 7.3 + x)) * 4 };
      if (o.carry) c.fig.carry = o.carry;
      if (o.look) c.fig.lookAt = o.look;
      if (o.sit) {
        c.fig.sit = 1;
        c.baseY = o.sit;
        c.noCollide = true;
      }
      this.extras.push(c);
      return c;
    };
    // (a couple at the pier's north railing, a little out from the gate: looking out, talking)
    const a1 = mk('x1', true, 0, 56.0, 236.75, Math.PI, { look: sea, talk: 0 });
    const a2 = mk('x2', false, 0, 56.85, 236.8, Math.PI, { look: sea, talk: 1 });
    a1.extra.with = a2;
    a2.extra.with = a1;
    // (two on the bench by the gate, north side)
    const b1 = mk('x3', false, 1, 53.25, 237.3, 0, { sit: 0.12, talk: 0 });
    const b2 = mk('x4', true, 1, 54.1, 237.3, 0, { sit: 0.12, talk: 1 });
    b1.extra.with = b2;
    b2.extra.with = b1;
    // (a man at the south railing with his phone)
    mk('x5', false, 2, 66.2, 249.0, 0, { carry: 'phone' });
    // (a woman at Gino's counter)
    const V = this.cast.vendor;
    if (V) {
      const cx = V.pos.x + Math.sin(V.yaw) * 1.5;
      const cz = V.pos.z + Math.cos(V.yaw) * 1.5;
      const b = mk('x6', true, 2, cx, cz, V.yaw + Math.PI, { talk: 0 });
      b.fig.lookAt = V.fig.j.headC;
      V.fig.lookAt = b.fig.j.headC;
      b.extra.with = V;
      V.extra = { talk: 1, with: b, t: 2 };
      this.extras.push(V);
    }
    // (two out along the pier to the wheel and back, side by side, in no hurry)
    const w1 = mk('x7', true, 3, 70, 244.2, Math.PI / 2, { walk: [[70, 244.2], [112, 244.6]], speed: 0.85 });
    const w2 = mk('x8', false, 3, 70, 245.1, Math.PI / 2, { walk: [[70, 245.1], [112, 245.5]], speed: 0.85 });
    w1.extra.i = w2.extra.i = 1;
    for (const c of this.extras) if (c.fig) c.fig.lodFar = 70;
  }

  // their evening, a few times a second: who of a pair is talking now (the other listening, a look between them now and then),
  // the walkers on to the end of their way and back
  tickExtras(dt) {
    if (!this.extras) return;
    this.extraT = (this.extraT || 0) - dt;
    if (this.extraT > 0) return;
    const step = 0.3;
    this.extraT = step;
    for (const c of this.extras) {
      const E = c.extra;
      if (!E || c.gone || !c.fig) continue;
      E.t += step;
      if (E.with && E.talk !== undefined) {
        // (turns of about four seconds: the one whose turn it is talks, the other's eyes on them)
        const mine = Math.floor(E.t / 4.2) % 2 === E.talk;
        c.fig.talk = mine && Math.sin(E.t * 0.9) > -0.6;
        if (!E.look) c.fig.lookAt = E.with.fig && E.with.fig.j ? E.with.fig.j.headC : null;
        else c.fig.lookAt = !mine && Math.sin(E.t * 0.5 + E.talk) > 0.2 && E.with.fig && E.with.fig.j ? E.with.fig.j.headC : E.look;
      }
      if (E.walk) {
        const q = E.walk[E.i];
        if (Math.hypot(c.pos.x - q[0], c.pos.z - q[1]) < 0.8) {
          E.i = 1 - E.i;
          const n = E.walk[E.i];
          this.go(c, n[0], n[1], E.speed || 0.9);
        } else if (!(c.pl.speed > 0)) this.go(c, q[0], q[1], E.speed || 0.9);
      }
    }
  }

  spawnVendor() {
    if (this.cast.vendor || !this.set || !this.set.staff || !this.set.staff.length) return;
    const look = this.castMod && this.castMod.vendorLook ? this.castMod.vendorLook() : null;
    if (!look) return;
    const st = this.set.staff[0];
    const V = this.person('vendor', st.x, st.z, look, { face: st.yaw || 0 });
    // (inside his stand: its walls are not his to be pushed out of)
    V.noCollide = true;
    V.pos.set(st.x, V.pos.y, st.z);
    V.fig.portraitPx = 40;
    V.fig.keepPortrait = true;
    V.fig.nearOk = true;
    this.set.staff.length = 0;
  }

  spawnLily() {
    this.spawnVendor();
    if (this.cast.lily) return;
    const look = this.lilyLookFn ? this.lilyLookFn() : kidLook(true);
    const L = this.person('lily', LILY_SEAT.x, LILY_SEAT.z, look, { face: LILY_SEAT.yaw });
    // (her drawn face in the film's middle shots too, not only close: render/people.js portraitFor)
    L.fig.portraitPx = 40;
    // (round 15: her face hers near and far - never handed to the city's simple face, dark with black
    // eyes, for a moment after a cut that brought her near: render/people.js keepPortrait)
    L.fig.keepPortrait = true;
    // (round 17: her face made now, while she is still far off - and kept hers: render/people.js
    // keeper - so that it is there, whole, the first moment she is seen, on a phone too)
    const B = this.game.figures && this.game.figures.bodies;
    const k = look && look.folk;
    if (B && B.makePortrait && k >= 0 && !(B.portraits && B.portraits.get(k))) B.makePortrait(k).keeper = L.fig;
    // (drawn however close the camera comes - over her shoulder onto her page: game/doodle.js nearOk)
    L.fig.nearOk = true;
    L.fig.sit = 1;
    L.baseY = 0.32;
    if (this.castMod && this.castMod.giveIceCream) this.castMod.giveIceCream(L.fig, true);
    if (this.castMod && this.castMod.giveSketchbook) this.castMod.giveSketchbook(L.fig, true);
    // (and the evening's own people round her: the same every time)
    this.spawnExtras();
  }

  // ------------------------------------------------------------------ 2. LILY
  // (ROADMAP 18.9: staged again from the comic's panels that worked - each face from in front, head and
  // shoulders, nobody's back of the head across it; everybody looking at whoever speaks, and at what
  // is happening)
  *s2() {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    // (every line said with the face and the head: the hands are where each shot has them)
    this.stillHands = true;
    this.objective(null);
    if (g.gps) g.gps.clear();
    // (round 17, the player's word: the disturbing music only from the moment they look up at the kids in the wheel's gondolas,
    // scene 3. Till then the wheel's own tune: its music box's waltz - score.js Wheel)
    this.cue('wheel', { fade: 0.6 });
    this.film(true);
    // (ROADMAP 23.8, the owner's word on the meeting as the storyboard had it, 23.7: the embrace "too emotional" and not natural;
    // the drawn word, the lines of her run, the panel's gutter, the colour round them, her sketchbook's pages, the board gone
    // black and white - "childish... this is a crime game in the end, it is meant to be grown-up", its scenes "very grown-up, made
    // for a deep story". So: none of them. A father and his daughter meet as people do who saw each other this morning - she
    // comes over, he stays on his feet, a hand through her hair; and what is between him and the man on the board is in his face
    // when he looks at it, not in an effect. The picture tells it: where they stand, the lens, the light.)
    // THE STAGE, measured from above and looked round from it eight ways: her stool is in under the stand's sunshade, among its
    // poles and its sign - no lens has room there. He stands out on the open promenade, eight metres south of it and clear of the
    // pier's gate (M). From there each of the scene's pictures has its own way to look: north the sea and the low sun, east the
    // giant wheel through the gate, south her uncle's board, west the hotels' lights. He faces north - the sun on his face; she,
    // come to him, has it behind her, in her curls.
    //   u: from his mark to her stool; w: the west of that line. at(along, west, up from the ground); dir: a way, the same
    const S = LILY_SEAT;
    const M = { x: 38.4, z: 240.6 };
    const ul = Math.hypot(S.x - M.x, S.z - M.z) || 1;
    const ux = (S.x - M.x) / ul;
    const uz = (S.z - M.z) / ul;
    const wx = uz;
    const wz = -ux;
    const yawU = Math.atan2(ux, uz);
    const yawL = Math.atan2(-ux, -uz);
    let G = 0.15;
    const at = (f, sd = 0, y = 0) => v3(M.x + ux * f + wx * sd, G + y, M.z + uz * f + wz * sd);
    const dir = (a, b, y = 0) => v3(ux * a + wx * b, y, uz * a + wz * b);
    const hd = (c) => this.headJ(c) || v3(c.pos.x, G + 1.15, c.pos.z);
    const far = (c, q) => Math.hypot(c.pos.x - q.x, c.pos.z - q.z);
    const B = this.lilyBoard();
    const W0 = v3(WHEEL.x, 30, WHEEL.z);
    // (nobody but the story's own people on it: a passer-by a step from the lens was a giant's leg across the picture)
    // (ROADMAP 23.9: and wide - whoever is seen behind them, far off, is one of the evening's own eight: spawnExtras)
    this.spawnExtras();
    this.setZone = { x: 46, z: 240, r: 30 };
    // him: still out of the picture, down the promenade. Her: on her stool, turned to the wheel
    {
      const d0 = at(-4.4, 0.7);
      this.putDanny(d0.x, d0.z, yawU);
      G = P.pos.y;
    }
    this.walkTo = null;
    this.auto = null;
    this.put(L, S.x, S.z, Math.atan2(WHEEL.x - S.x, WHEEL.z - S.z));
    L.fig.sit = 1;
    L.baseY = 0.32;
    if (this.castMod) this.castMod.giveIceCream(L.fig, false);
    L.fig.lookAt = W0;
    P.fig.lookAt = null;

    // 1. THE EVENING: her alone at the stand, small, waiting; the giant wheel in front of her. Quiet
    this.shot({ from: v3(37.25, G + 0.72, 233.95), to: v3(37.0, G + 0.9, 234.05), look: v3(57.1, G + 2.6, 232.3), lookTo: v3(57.1, G + 3.1, 232.2), fov: 41, fovTo: 39, dur: 4.6, ease: 'out', hand: 0.12, key: 0.5, keySide: -1, rim: 1 });
    yield 0.5;
    // (where, and when: typed into the corner)
    if (!this.ff) this.comic.stamp(['Sunset Pier', '6:40 PM'], { life: 2.9 });
    yield 3.1;

    // 2. HE COMES across the promenade: a long lens from by her table. He sees her - and his name, the picture held
    this.walkTo = { x: M.x, z: M.z, speed: 0.4 };
    P.fig.lookAt = v3(S.x, G + 0.9, S.z);
    this.shot({ from: at(5.4, -0.9, 0.9), look: () => v3(P.pos.x, G + 0.98, P.pos.z), fov: 16.5, fovTo: 15.5, dur: 4, hand: 0.2, key: 0.85, keySide: -1, dof: 1 });
    yield 1.25;
    this.feel(P.fig, 'smirk', 8);
    yield 0.55;
    yield* this.freezeCard({ name: 'DANNY', tag: 'her dad - it is complicated', col: '#4fa3d8', at: () => hd(P), life: 1.7, lead: true });
    yield 0.55;

    // 3. SHE SEES HIM: off her stool, a step out from under the stand - her face, the sea and the low sun behind her. Her name
    L.fig.sit = 0;
    L.baseY = 0;
    if (L.fig.carryL === 'sketchbook') L.fig.carryL = null;
    {
      const a = at(5.4);
      this.put(L, a.x, a.z, yawL);
    }
    L.fig.lookAt = P.fig.j.headC;
    this.feel(L.fig, 'joy', 9);
    this.shot({ from: () => { const h = hd(L); return v3(h.x - 0.98, h.y, h.z + 0.92); }, look: () => { const h = hd(L); return v3(h.x + 0.13, h.y - 0.01, h.z); }, fov: 17.5, fovTo: 16.5, dur: 3, hand: 0.2, key: 0.6, keySide: -1, rim: 1.2, dof: 1 });
    yield 0.6;
    yield* this.freezeCard({ name: 'LILY', tag: 'age 9 - draws everything she sees', col: '#f2b630', at: () => hd(L), life: 1.7 });
    yield 0.2;
    const l01 = this.say('L01', L.fig, 0.05);
    const l01w = l01.next().value || 0;
    yield Math.min(0.9, l01w);

    // 4. SHE COMES OVER TO HIM, he waits for her: the two of them from the west, low, the giant wheel behind them
    this.walkTo = null;
    this.auto = null;
    this.putDanny(M.x, M.z, yawU);
    P.fig.lookAt = L.fig.j.headC;
    const meet = at(0.55, 0.04);
    {
      const a = at(3.1);
      this.put(L, a.x, a.z, yawL);
    }
    this.go(L, meet.x, meet.z, 2.5);
    this.shot({ from: at(1.9, 4.9, 0.5), to: at(0.7, 4.2, 0.56), look: at(1.7, 0, 0.92), lookTo: at(0.3, 0, 1.0), fov: 31, fovTo: 28, dur: 3, ease: 'inout', hand: 0.18, key: 0.8, keySide: -1, rim: 1.1 });
    {
      const t0 = this.clock;
      yield () => far(L, meet) < 0.16 || this.clock - t0 > 2.2;
    }
    this.put(L, meet.x, meet.z, yawL);
    L.fig.lookAt = P.fig.j.headC;
    // (he bends his head to her, a little: a tall man and a small girl)
    this.pose(P.fig, { fLean: 0.07, headTilt: 0.06 }, 0.45, 'out');
    yield 0.5;

    // 5. HIS LINE, over her curls: dry - and far behind him, soft, the board he has not looked at yet
    this.shot({
      from: () => { const l = hd(L); return v3(l.x + ux * 0.86 - wx * 0.46, l.y + 0.2, l.z + uz * 0.86 - wz * 0.46); },
      to: () => { const l = hd(L); return v3(l.x + ux * 0.8 - wx * 0.43, l.y + 0.2, l.z + uz * 0.8 - wz * 0.43); },
      look: () => { const h = hd(P); return v3(h.x, h.y - 0.05, h.z); },
      fov: 27, dur: 4, hand: 0.15, key: 1, keySide: 1, dof: 1, shade: [L.fig],
    });
    yield 0.35;
    yield* this.say('D01', P.fig, 0.12);

    // 6. A GIGGLE, his hand through her curls: the two of them from the west again, nearer - the giant wheel behind them
    // (ROADMAP 23.8: it was from by his hip, over his arm - his body a black shape across four tenths of the picture, her face
    // turned away up at him. Two people a step apart are seen from the side; each alone, from in front)
    this.shot({ from: at(0.2, 3.5, 0.98), to: at(0.24, 3.25, 1.0), look: at(0.27, 0, 1.12), fov: 27, dur: 4, hand: 0.15, key: 0.8, keySide: -1, rim: 1.1 });
    this.feel(L.fig, 'laugh', 1.6);
    this.feel(P.fig, 'joy', 4);
    this.pose(P.fig, { fLean: 0.17 }, 0.4, 'out');
    {
      // (his right hand down onto her head, the palm on it, the fingers back over it - and a rub, this way and that)
      const t0 = this.clock;
      this.hold(P.fig, 'R', () => {
        const q = L.fig.j.headC;
        const hs = (L.fig.headScale || 1) * (L.fig.scale || 1);
        const rub = Math.sin((this.clock - t0) * 13) * 0.014 * Math.max(0, Math.min(1, (this.clock - t0 - 0.35) * 4)) * Math.max(0, 1 - (this.clock - t0 - 0.35) / 1.4);
        return v3(q.x - ux * 0.02 + wx * rub, q.y + 0.125 * hs, q.z - uz * 0.02 + wz * rub);
      }, { on: true, palm: v3(0, -1, 0), fingers: dir(0.95, 0.1, -0.1), pole: dir(-0.3, -0.9, -0.2), ease: 0.36 });
    }
    yield 0.3;
    yield* this.say('LG1', L.fig, 0.1);
    // (and she ducks out from under his hand, a step back from him - his hand let go, him up straight)
    {
      const q = at(1.1, 0.04);
      this.glide(L, q.x, q.z, 0.5, true);
    }
    this.unhold(P.fig, 'R', 0.45);
    this.pose(P.fig, { fLean: 0.07 }, 0.5, 'inout');
    yield 0.6;

    // 6b. HER ANSWER: her face, from in front of him at her own height - the sea and the last of the sun behind her
    this.unhold(P.fig, 'R', 0);
    L.fig.lookAt = P.fig.j.headC;
    this.feel(L.fig, 'tease', 5);
    this.shot({
      from: () => { const l = hd(L); return v3(l.x - ux * 0.95 + wx * 0.26, l.y + 0.03, l.z - uz * 0.95 + wz * 0.26); },
      to: () => { const l = hd(L); return v3(l.x - ux * 0.89 + wx * 0.24, l.y + 0.03, l.z - uz * 0.89 + wz * 0.24); },
      look: () => { const l = hd(L); return v3(l.x - wx * 0.04, l.y + 0.01, l.z - wz * 0.04); },
      fov: 24, dur: 4, hand: 0.15, key: 0.6, keySide: -1, rim: 1.2, dof: 1,
    });
    yield 0.2;
    yield* this.say('L02', L.fig, 0.15);
    // (and past him she has seen something)
    L.fig.lookAt = v3(B.x, B.cy, B.z);
    this.feel(L.fig, 'surprised', 1.2);
    yield 0.6;

    // 7. WHAT SHE HAS SEEN: her uncle, on a board over the promenade - the lens going in on him, slowly, as she asks
    this.shot({ from: v3(M.x + 1.6, G + 1.5, M.z + 1.2), to: v3(M.x + 2.0, G + 1.6, M.z + 2.4), look: v3(B.x, B.cy - 0.55, B.z), fov: 19, fovTo: 15.5, dur: 4, ease: 'inout', hand: 0.1, key: 0 });
    yield 0.4;
    yield* this.say('L03', L.fig, 0.3);

    // 8. HIM, turned to it: his eyes, and nothing in them. A second and a half of that, before he says anything
    this.unhold(P.fig, null, 0);
    this.unhold(L.fig, null, 0);
    this.pose(P.fig, { fLean: 0, fHipY: 0, fSide: 0, headTilt: 0 }, 0.01);
    const pb = { x: B.x + B.nx * 8.2, z: B.z + B.nz * 8.2 };
    this.putDanny(pb.x, pb.z, B.face);
    this.put(L, pb.x - B.rx * 0.5, pb.z - B.rz * 0.5, B.face);
    const top = v3(B.x, B.cy + 0.4, B.z);
    P.fig.lookAt = top;
    L.fig.lookAt = top;
    P.fig.feel = null;
    L.fig.feel = null;
    // (his eyes, come up to it: the picture shut down to a strip across them, and gone cold round him)
    this.emote([0.1, 0.17, 0.34], 0.72);
    if (!this.ff) this.comic.strip(1.5, { h: 0.3, slant: -0.06 });
    {
      // (on his eyes themselves, wherever his head has them: a little under the head's middle, at its front)
      const eyes = () => {
        const f = P.fig;
        const hs = (f.headScale || 1) * (f.scale || 1);
        const h = f.j.headC;
        return v3(h.x + f.hu.x * -0.045 * hs + f.hf.x * 0.08 * hs, h.y + f.hu.y * -0.045 * hs + f.hf.y * 0.08 * hs, h.z + f.hu.z * -0.045 * hs + f.hf.z * 0.08 * hs);
      };
      // (where the lens is, taken from where he stands - his head's joint is still where he stood a moment ago, on this cut)
      const hy = G + 1.66;
      this.shot({ from: v3(pb.x - B.nx * 1.0 + B.rx * 0.3, hy - 0.1, pb.z - B.nz * 1.0 + B.rz * 0.3), to: v3(pb.x - B.nx * 0.93 + B.rx * 0.28, hy - 0.1, pb.z - B.nz * 0.93 + B.rz * 0.28), look: eyes, fov: 11.5, dur: 2, hand: 0.05, key: 1, keySide: -1, fill: 0, rim: 0.4, dof: 1 });
    }
    yield 1.5;
    // (and him, as he finds something to say: the cold going out of it)
    this.emote(null);
    this.shot({ from: () => { const h = hd(P); return v3(h.x + 1.5, h.y - 0.18, h.z + 0.64); }, to: () => { const h = hd(P); return v3(h.x + 1.32, h.y - 0.17, h.z + 0.57); }, look: () => { const h = hd(P); return v3(h.x, h.y - 0.01, h.z); }, fov: 22, dur: 5, hand: 0.12, keySide: 1, dof: 1 });
    yield 0.5;
    const d02 = this.say('D02', P.fig, 0.25);
    const d02w = d02.next().value || 0;
    yield Math.min(1.5, d02w * 0.45);

    // 9. THE TWO OF THEM UNDER IT, small - his hand on her shoulder - for the rest of his line
    // (his hand laid on her near shoulder from above: the palm down, the fingers over it to its front)
    this.hold(P.fig, 'L', () => { const sh = L.fig.j.shoulderR; return v3(sh.x + B.rx * 0.01, sh.y + 0.05, sh.z + B.rz * 0.01); }, { on: true, palm: v3(0, -1, 0), fingers: v3(-B.rx * 0.75 - B.nx * 0.6, -0.25, -B.rz * 0.75 - B.nz * 0.6), pole: v3(B.rx * 0.2 + B.nx * 0.5, -0.8, B.rz * 0.2 + B.nz * 0.5), ease: 0.01 });
    this.feel(P.fig, 'smirk', 6);
    this.shot({ from: v3(pb.x + B.nx * 5.4 + B.rx * 0.9, G + 0.26, pb.z + B.nz * 5.4 + B.rz * 0.9), to: v3(pb.x + B.nx * 5.0 + B.rx * 0.8, G + 0.34, pb.z + B.nz * 5.0 + B.rz * 0.8), look: v3(B.x, B.cy - 1.9, B.z), fov: 30, dur: 4, hand: 0.12, key: 0.5, keySide: 1 });
    yield Math.max(0.6, d02w - Math.min(1.5, d02w * 0.45));

    // 10. HER, up at him - from her own height: is he everybody's boss, then?
    L.yaw = Math.atan2(B.rx - B.nx, B.rz - B.nz);
    L.fig.yaw = L.yaw;
    L.fig.lookAt = P.fig.j.headC;
    P.fig.lookAt = L.fig.j.headC;
    this.feel(L.fig, 'tease', 5);
    this.shot({ from: () => { const l = hd(L); return v3(l.x - 0.3, l.y + 0.24, l.z + 1.22); }, look: () => { const l = hd(L); return v3(l.x - 0.03, l.y, l.z); }, fov: 23, fovTo: 22, dur: 3, hand: 0.15, key: 0.6, keySide: -1, rim: 1.2, dof: 1, shade: [P.fig] });
    yield 0.25;
    yield* this.say('L04', L.fig, 0.2);

    // 11. THE TWO OF THEM from in front: his answer, an eye on the board - and she laughs. He does not, quite: his eyes go
    // back up to it
    P.yaw = B.face - 0.42;
    P.fig.yaw = P.yaw;
    P.fig.lookAt = top;
    // (ROADMAP 23.11, the owner's word: "Danny's arm is crooked here" - his hand was still held on her shoulder from the shot
    // before, and as the two of them turned from each other the arm went out to it at full stretch. Off her shoulder on the cut:
    // his arms his own again, as he stands)
    this.unhold(P.fig, null, 0);
    this.shot({ from: v3(pb.x - B.nx * 3.0 - B.rx * 0.25, G + 0.9, pb.z - B.nz * 3.0 - B.rz * 0.25), to: v3(pb.x - B.nx * 2.6 - B.rx * 0.25, G + 0.92, pb.z - B.nz * 2.6 - B.rz * 0.25), look: v3(pb.x - B.rx * 0.27, G + 1.06, pb.z - B.rz * 0.27), fov: 30, dur: 6, hand: 0.12, keySide: -1 });
    yield 0.25;
    const d03 = this.say('D03', P.fig, 0.05);
    const d03w = d03.next().value || 0;
    yield Math.min(1.2, d03w);
    P.fig.lookAt = L.fig.j.headC;
    yield Math.max(0, d03w - 1.2);
    this.feel(L.fig, 'laugh', 3);
    this.feel(P.fig, 'smirk', 1.2);
    this.pose(L.fig, { fLean: -0.06 }, 0.3, 'back');
    const l05 = this.say('L05', L.fig, 0.4);
    const l05w = l05.next().value || 2.6;
    yield Math.min(1.3, l05w * 0.5);
    P.fig.lookAt = top;
    P.fig.feel = null;
    yield Math.max(0.5, l05w * 0.62 - 1.3);

    // 12. ON, onto the pier, her hand in his: the giant wheel ahead of them
    this.unhold(P.fig, null, 0);
    this.unhold(L.fig, null, 0);
    this.pose(L.fig, { fLean: 0 }, 0.01);
    {
      // (at the pier's gate, the walk out along it still ahead of them: the game's own walk to the wheel starts here)
      const F = { x: 47.6, z: 242.7 };
      const fd = Math.hypot(WHEEL.x - F.x, WHEEL.z - F.z) || 1;
      const ex = (WHEEL.x - F.x) / fd;
      const ez = (WHEEL.z - F.z) / fd;
      // (his right: she is on that side, her left hand in his right)
      const rx = -ez;
      const rz = ex;
      const yaw = Math.atan2(ex, ez);
      this.putDanny(F.x, F.z, yaw);
      this.put(L, F.x + rx * 0.62, F.z + rz * 0.62, yaw);
      const hands = () => v3(P.pos.x + rx * 0.31, P.pos.y + 0.79, P.pos.z + rz * 0.31);
      // (his hand round hers: his palm to her and a little back, his fingers down; hers up into it, her palm to him)
      this.hold(P.fig, 'R', () => { const q = hands(); return v3(q.x - rx * 0.015, q.y + 0.065, q.z - rz * 0.015); }, { palm: v3(rx * 0.9 - ex * 0.3, 0, rz * 0.9 - ez * 0.3), fingers: v3(rx * 0.2, -1, rz * 0.2), grip: true, ease: 0.01 });
      this.hold(L.fig, 'L', () => { const q = hands(); return v3(q.x + rx * 0.035, q.y, q.z + rz * 0.035); }, { palm: v3(-rx * 0.9 - ex * 0.2, 0.1, -rz * 0.9 - ez * 0.2), fingers: v3(-rx * 0.75, -0.6, -rz * 0.75), pole: v3(-ex * 0.5 + rx * 0.3, -0.8, -ez * 0.5 + rz * 0.3), ease: 0.01 });
      L.fig.lookAt = W0;
      P.fig.lookAt = W0;
      this.feel(L.fig, 'joy', 6);
      const gp = P.pos.y;
      this.shot({ from: v3(F.x - ex * 3.7 - rx * 0.1, gp + 0.34, F.z - ez * 3.7 - rz * 0.1), to: v3(F.x - ex * 3.3 - rx * 0.1, gp + 0.4, F.z - ez * 3.3 - rz * 0.1), look: v3(F.x + ex * 30, gp + 10.1, F.z + ez * 30), fov: 42, dur: 4, hand: 0.12, key: 0.4, keySide: -1, rim: 1 });
      yield 2.3;
      // (and held, painted: the last of the evening as it was)
      yield* this.paintedStill(1.5);
    }
    this.unhold(P.fig, null, 0);
    this.unhold(L.fig, null, 0);
    this.setZone = null;
    this.stillHands = false;
    L.fig.lookAt = null;
    P.fig.lookAt = null;
    if (this.castMod && this.castMod.giveSketchbook) this.castMod.giveSketchbook(L.fig, true);
    // the walk: her at his side, the marker on the pier
    L.pl.follow = true;
    this.film(false);
    this.objective('Walk with <b>Lily</b> to the pier', VIEW.x, VIEW.z, 'Pier');
    this.howto('pier', 8);
    // (round 17, the player's word: the very place it goes on from, marked there - and anywhere in the
    // ring is there)
    this.beacon(VIEW.x, VIEW.z, 2.8);
    yield () => this.dist(VIEW.x, VIEW.z) < 5;
    this.unbeacon();
    // (round 18, the player's word: there, at the giant wheel - the frightening music from the moment
    // it is seen, and a few seconds his, to walk about and look at it, before the film takes it up)
    this.cue('thriller', { fade: 1.0 });
    this.ui.card(null);
    this.objective('Look at the <b>giant wheel</b>');
    if (g.gps) g.gps.clear();
    yield 6;
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
    // (ROADMAP 23.10: the scene in the game's own look and the film's grown-up tone. Nobody of the city's within a few steps of
    // where the two of them stand: a passer-by's arm was across the edge of her close shots)
    this.spawnExtras();
    this.setZone = { x: VIEW.x, z: VIEW.z, r: 7.5 };
    const toW = Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z);
    const ux = Math.sin(toW);
    const uz = Math.cos(toW);
    // (to the wheel: u; to her right, where he stands: (-uz, ux))
    const rx = -uz;
    const rz = ux;
    // (her ice cream finished on the way: her hands free for her drawing)
    if (this.castMod && this.castMod.giveIceCream) this.castMod.giveIceCream(L.fig, false);
    // (ROADMAP 23.10: and her sketchbook in her bag till she sits down to draw - in her hand it came up under her chin with her
    // plea, its spiral and its stickers a clutter in her close shot)
    if (this.castMod && this.castMod.giveSketchbook) this.castMod.giveSketchbook(L.fig, false);
    // the two of them at the railing, the wheel ahead (he on her right)
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, toW);
    this.put(L, VIEW.x, VIEW.z, toW);
    this.spawnPier();
    // (round 18, the player's word: the frightening music from the moment the giant wheel is seen - on
    // from the pier, s2; begun here only if it is not: score.js play keeps a cue that is on)
    this.cue('thriller', { fade: 1.2 });
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
    // (round 23, the review: a step to his side - from straight behind them a lamp's pole stood across
    // the wheel)
    this.shot({ from: [VIEW.x - ux * 5.6 + rx * 1.1, 0.95, VIEW.z - uz * 5.6 + rz * 1.1], to: [VIEW.x - ux * 5.0 + rx * 1.15, 0.98, VIEW.z - uz * 5.0 + rz * 1.15], look: [WHEEL.x, 22, WHEEL.z], lookTo: [WHEEL.x, 23, WHEEL.z], fov: 52, dur: 3.6, hand: 0.35 });
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
      this.shot({ from: A.from, to: Bn.from, look: A.look, fov: 36, dur: 3.0, hand: 0.25, dof: 1, fill: 1.1 });
    }
    // (round 23, the review: no longer the world behind her sunk into gold - a yellow fog where the
    // colours and the lights she is talking about should be. The evening behind her as it is, and
    // the lights themselves on the cut after her words)
    yield 0.2;
    yield* this.say('L20', L.fig, 0.1);
    // (what she sees: the lights - round 23: from between the two of them, clear of the lamp's pole
    // that stood across the middle of it)
    this.shot({ from: [VIEW.x + ux * 0.3 + rx * 0.6, 1.3, VIEW.z + uz * 0.3 + rz * 0.6], look: [WHEEL.x, 36, WHEEL.z], lookTo: [WHEEL.x, 42, WHEEL.z], fov: 23, fovTo: 20, dur: 2.0, hand: 0.25 });
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
      this.shot({ from: [mx - ux * 3.4, 1.15, mz - uz * 3.4], to: [mx - ux * 3.1, 1.17, mz - uz * 3.1], look: [mx, 1.22, mz], fov: 40, dur: 3.2, hand: 0.35 });
    }
    yield 0.15;
    // (round 10: her pleading face, an anime's - in close on her eyes, the world behind her pink)
    // (ROADMAP 23.10: said with her face - the line's own gesture, her hands up under her chin, was a pale shape of fingers at
    // the lens in her close shot)
    this.stillHands = true;
    const pl = this.say('L21', L.fig, 0.25);
    const plw = pl.next().value || 0;
    this.stillHands = false;
    yield Math.min(1.1, plw * 0.4);
    // (round 23, the review: the pier behind her, softened - not a pink wall: the pink is kept for the
    // story's great moments)
    // (ROADMAP 23.10: her hand down for it - reaching for his, it came straight at the lens: a pale shape under her chin)
    L.fig.reachL = null;
    this.shot({ ...this.single(L, P, { dist: 0.75, side: 0.22, up: -0.05, drop: 0.06 }), fov: 30, dur: 2.2, hand: 0.25, dof: 1 });
    yield Math.max(0.4, plw - Math.min(1.1, plw * 0.4));
    // him, warm: from her side, below
    this.shot({ ...this.single(P, L, { dist: 1.4, side: -0.36, up: -0.3, drop: 0.12 }), fov: 34, dur: 2.6, hand: 0.3 });
    this.feel(P.fig, 'joy', 2.6);
    yield* this.say('D27', P.fig, 0.3);
    // (ROADMAP 18.9) she will draw it: her sketchbook out, at the railing, the page against it - and
    // she starts, the wheel first. Her drawing comes as she draws it (game/prologue/ui.js lilyDrawing k)
    const page = this.lilyPage();
    // (round 15: the shapes in pencil now, while he is away; its colours when he is back - lilyParts)
    const LP = lilyParts();
    let drawK = 0.004;
    const drawOn = () => page.draw(lilyDrawing, drawK);
    // (ROADMAP 18.9: sitting on a bench a step back from the railing, her sketchbook on her knees, the
    // pencil going - the player's word: she sits, and she is seen drawing)
    const bx = VIEW.x - ux * 1.1;
    const bz = VIEW.z - uz * 1.1;
    if (this.set && this.set.bench) this.set.bench(bx, L.pos.y || 0, bz, toW);
    // (round 23: her head's height standing, before she is moved - her figure is posed where she now is
    // only on the film's next drawing, so the shot of her on the bench is worked out from the bench)
    const standH = this.headH(L);
    const groundL = L.pos.y || 0;
    // (ROADMAP 23.11, the owner's word: "she must be seen going from standing to sitting on the bench - not all at once there".
    // The two of them from the wheel's side - where she is later seen getting up from it, the one place a lamp post is not in
    // front of her: she steps back to the bench, the wheel still in her eyes, and sits; then her sketchbook is out on her knees)
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, toW);
    P.fig.lookAt = L.fig.j.headC;
    L.fig.lookAt = W0;
    this.feel(L.fig, 'joy', 8);
    this.shot({ from: [VIEW.x + ux * 3.6 + rx * 0.6, 1.5, VIEW.z + uz * 3.6 + rz * 0.6], to: [VIEW.x + ux * 3.35 + rx * 0.6, 1.5, VIEW.z + uz * 3.35 + rz * 0.6], look: [VIEW.x - ux * 0.5 + rx * 0.45, 1.05, VIEW.z - uz * 0.5 + rz * 0.45], fov: 40, dur: 3.4, hand: 0.3, keySide: 1 });
    yield 0.3;
    this.glide(L, bx, bz, 0.95, true);
    yield 0.95;
    {
      let st = 0;
      this.cloth(L.fig, 0.8, 0.4);
      this.everyFrame = (dt) => {
        st += dt;
        const k = Math.min(1, st / 0.6);
        const e = k * k * (3 - 2 * k);
        L.fig.sit = e;
        L.baseY = 0.3 * e;
      };
      yield 0.6;
      this.everyFrame = null;
    }
    this.put(L, bx, bz, toW);
    L.fig.sit = 1;
    L.baseY = 0.3;
    page.hold(L.fig, null, 'draw');
    drawOn();
    L.fig.lookAt = page.at;
    P.fig.lookAt = v3(WHEEL.x, 26, WHEEL.z);
    yield 0.75;
    page.hold(L.fig, null, 'draw');
    drawOn();
    L.fig.lookAt = page.at;
    P.fig.lookAt = v3(WHEEL.x, 26, WHEEL.z);
    this.feel(L.fig, 'joy', 8);
    {
      // (her at it, in profile from her left, her face and the page; he beside her, at the wheel)
      // (round 23, the review: from where her head is on the bench - worked out from where it was, the
      // camera stood by him, his head off the top of the picture and her small on the bench beyond)
      const h = v3(bx, groundL + 0.3 + Math.max(0.6, standH - 0.42), bz);
      this.shot({ from: [h.x - rx * 1.55 + ux * 0.35, h.y - 0.02, h.z - rz * 1.55 + uz * 0.35], to: [h.x - rx * 1.4 + ux * 0.3, h.y - 0.01, h.z - rz * 1.4 + uz * 0.3], look: [h.x + rx * 0.2, h.y - 0.14, h.z + rz * 0.2], fov: 42, dur: 3.0, hand: 0.25 });
    }
    // (she looks up at it and down at her page, as one who draws from the thing does)
    this.sketching = true;
    this.everyFrame = (dt) => {
      // (round 16: the outline, then her colours - the most of them done while he is away, the last
      // strokes left for when he is back)
      drawK = Math.min(0.965, drawK + dt * (drawK < LP.outline ? 0.012 : 0.03));
      drawOn();
      const tt = this.clock || 0;
      L.fig.lookAt = Math.sin(tt * 1.3) > 0.35 ? W0 : page.at;
    };
    yield 2.6;
    // (over her shoulder: the first lines of it on her page - and the wheel itself beyond it)
    // (ROADMAP 23.10: the page in it - the lens looked over it at the wheel, and showed her curls and his sleeve)
    this.shot({ from: () => v3(page.at.x - ux * 0.12 + rx * 0.62, page.at.y + 0.5, page.at.z - uz * 0.12 + rz * 0.62), look: () => v3(page.at.x - rx * 0.04, page.at.y, page.at.z - rz * 0.04), fov: 40, dur: 2.2, hand: 0.15, key: 0.7, keySide: 1 });
    yield 2.0;
    // a man along the pier, by the wheel's gate - on his shirt, over his heart, a mark that is
    // something like an eraser, and not one. Danny sees it; the man turns his head to him
    const man = this.markMan();
    // (ROADMAP 23.11, the owner's word: no mark; "he should look towards Danny for a moment and then look away". The evening's
    // people are round him from the first picture of him - walking; he is not. He is looking at Danny)
    const crowd = this.crowdAhead(man);
    this.faceTo(man, P.pos.x, P.pos.z);
    man.pl.speed = 0;
    man.fig.lookAt = P.fig.j.headC;
    const mh = () => this.headJ(man) || v3(man.pos.x, (man.pos.y || 0) + 1.7, man.pos.z);
    P.fig.lookAt = man.fig.j && man.fig.j.headC ? man.fig.j.headC : mh();
    g.audio.play('dread', 0.6);
    {
      const ph = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      // (from just beside his eyes, long: the people going by - and one of them stood still among them, his face this way)
      this.shot({ from: [ph.x - rx * 0.2, ph.y - 0.05, ph.z - rz * 0.2], look: () => { const h = mh(); return v3(h.x, h.y - 0.12, h.z); }, fov: 17, fovTo: 10.5, dur: 2.3, ease: 'in', hand: 0.6 });
    }
    // (Danny's heart, the picture's edges closing in on each beat - inside his head)
    if (this.comic && this.comic.pulse) this.comic.pulse(4, { per: 0.78, k: 0.7, vol: 0.65 });
    yield 2.2;
    // (his face, from Danny's side and nearer: he holds the look a breath too long - then his eyes go away from it, and his head
    // after them. Nothing is said, and nothing on him says it)
    {
      const h = mh();
      const nx = P.pos.x - h.x;
      const nz = P.pos.z - h.z;
      const nd = Math.hypot(nx, nz) || 1;
      const sx = -nz / nd;
      const sz = nx / nd;
      this.shot({ from: v3(h.x + (nx / nd) * 2.7 + sx * 0.45, h.y - 0.04, h.z + (nz / nd) * 2.7 + sz * 0.45), to: v3(h.x + (nx / nd) * 2.45 + sx * 0.4, h.y - 0.04, h.z + (nz / nd) * 2.45 + sz * 0.4), look: () => mh(), fov: 19, dur: 2.4, hand: 0.35, dof: 1, fill: 1.1 });
      yield 1.0;
      man.fig.lookAt = v3(h.x - sx * 5 + (nx / nd) * 1.5, h.y - 0.5, h.z - sz * 5 + (nz / nd) * 1.5);
      yield 0.95;
    }
    // his face: what was that
    this.feel(P.fig, 'worried', 4);
    this.shot({ ...this.single(P, man, { dist: 1.35, side: -0.4, up: -0.14, drop: 0.08 }), fov: 30, dur: 1.8, hand: 0.3, dof: 1 });
    yield 1.3;
    // (and he goes: turned, and off along the pier into them - not slowly)
    man.fig.lookAt = null;
    this.go(man, man.pos.x + 4.5, 244.6, 2.2);
    {
      const ph = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      this.shot({ from: [ph.x - rx * 0.22, ph.y - 0.03, ph.z - rz * 0.22], look: () => { const h = mh(); return v3(h.x, h.y - 0.35, h.z); }, fov: 20, fovTo: 23, dur: 1.6, hand: 0.6 });
    }
    yield 1.3;
    // (round 23, the review: the film's last picture from where the game's own camera takes over -
    // behind him and over his shoulder, along the pier the way the man went; the hand-over not felt,
    // where it was a swing from his face round his head)
    {
      const fx = Math.sin(P.yaw);
      const fz = Math.cos(P.yaw);
      const back = (k, up, side) => v3(P.pos.x - fx * k - fz * side, (P.pos.y || 0) + up, P.pos.z - fz * k + fx * side);
      this.shot({ from: back(3.6, 2.0, 0.42), to: back(4.3, 2.06, 0.4), look: v3(P.pos.x + fx * 9, (P.pos.y || 0) + 1.15, P.pos.z + fz * 9), fov: 50, dur: 1.2, ease: 'out', hand: 0.3 });
    }
    yield 1.05;
    // (the player's: after him - he walks off along the pier, unhurried; a few steps on, he is rubbed
    // out where he walks)
    this.film(false);
    // (round 16, the player's word: not sent to wander about - the pier searched, some 18 seconds of
    // it: he walks off fast into the people coming the other way and is lost in them; the player runs
    // this way and that among them looking; then he is gone, and back to Lily. No marker on him)
    this.objective('Where did he go? <b>Look for him</b> on the pier');
    man.fig.lookAt = null;
    // (round 23, the review: no "say hello" to whoever is nearest while he looks for the man)
    this.noHello = true;
    {
      const t0 = g.time;
      yield* this.loseInCrowd(man, crowd);
      // (and a few seconds of looking for him among them after he is gone - fourteen in all at the least)
      const t1 = g.time;
      yield () => g.time - t1 > 4.5 && g.time - t0 > 14;
    }
    this.noHello = false;
    // back to her - she is on the last of it
    this.objective('He is <b>gone</b>. Go back to <b>Lily</b>', L.pos.x, L.pos.z, 'Lily');
    // (round 17: where she is, marked round her)
    this.beacon(L.pos.x, L.pos.z, 1.9);
    yield () => Math.hypot(P.pos.x - L.pos.x, P.pos.z - L.pos.z) < 3.4;
    this.outOfCar();
    this.unbeacon();
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    // (round 16, the player's word: no colouring scene with the camera going round her - as he comes
    // back she puts the very last strokes on her drawing of the wheel, and shows it to her dad. One
    // steady picture: the two of them and the page)
    {
      const dX = bx + rx * 0.95 - ux * 0.55;
      const dZ = bz + rz * 0.95 - uz * 0.55;
      this.putDanny(dX, dZ, Math.atan2(bx - dX, bz - dZ));
      P.fig.lookAt = page.at;
      page.follow = true;
      this.feel(L.fig, 'joy', 8);
      // (whatever was left of it: only the last of it now - her name and the heart under it)
      drawK = Math.max(drawK, 0.93);
      const k0 = drawK;
      let ft = 0;
      this.everyFrame = (dt) => {
        ft += dt;
        drawK = Math.min(1, k0 + (1 - k0) * Math.min(1, ft / 2.4));
        drawOn();
        L.fig.lookAt = page.tipW;
      };
      // (from her right and a little in front, a little above: her bent over the page, the pencil going
      // in her hand, him come up behind at the side - held still; the page itself is seen as she turns
      // it to him, next)
      const h = this.headJ(L) || v3(L.pos.x, 1.1, L.pos.z);
      this.shot({ from: [h.x + rx * 1.55 + ux * 0.75, h.y + 0.2, h.z + rz * 1.55 + uz * 0.75], look: [(page.at.x + h.x) / 2, (page.at.y + h.y) / 2, (page.at.z + h.z) / 2], fov: 40, dur: 3.2, hand: 0.05 });
      yield () => drawK >= 1;
      yield 0.5;
    }
    this.everyFrame = null;
    this.sketching = false;
    page.follow = false;
    page.still = true;
    drawK = 1;
    drawOn();
    // (round 24, the player's word: a jump - drawing one moment, holding it up to him the next. Now
    // the last stroke done, her pencil lifted, she looks up at him and beams; then up off the bench
    // with the page to her chest, the steps over to him - and only then held up to him)
    L.fig.lookAt = P.fig.j.headC;
    this.feel(L.fig, 'joy', 8);
    yield 0.85;
    // (the two of them, him whole at the side of the picture, her getting up off the bench with the page
    // to her chest and coming to him - towards us. Nine places tried in the picture: from her left a
    // lamp post stood in front of her; nearer, his head was off the top of it; this one clear)
    this.putDanny(VIEW.x + rx * 1.3, VIEW.z + rz * 1.3, Math.atan2(-rx, -rz));
    P.fig.lookAt = L.fig.j.headC;
    this.shot({ from: [VIEW.x + ux * 3.6 + rx * 0.6, 1.6, VIEW.z + uz * 3.6 + rz * 0.6], to: [VIEW.x + ux * 3.35 + rx * 0.6, 1.6, VIEW.z + uz * 3.35 + rz * 0.6], look: [VIEW.x - ux * 0.5 + rx * 0.45, 1.18, VIEW.z - uz * 0.5 + rz * 0.45], fov: 40, dur: 3.2, hand: 0.3 });
    page.hold(L.fig, null, 'hug');
    {
      let st = 0;
      const y0 = L.baseY || 0;
      this.everyFrame = (dt) => {
        st += dt;
        const k = Math.min(1, st / 0.55);
        const e = k * k * (3 - 2 * k);
        L.fig.sit = 1 - e;
        L.baseY = y0 * (1 - e);
      };
      yield 0.55;
      this.everyFrame = null;
      L.fig.sit = 0;
      L.baseY = 0;
    }
    // (her walk stops a third of a metre short of where it is going: aimed that much past the place,
    // and a couple of seconds at most)
    {
      const lx = VIEW.x + rx * 0.4;
      const lz = VIEW.z + rz * 0.4;
      const ddx = lx - L.pos.x;
      const ddz = lz - L.pos.z;
      const dl = Math.hypot(ddx, ddz) || 1;
      const ox = lx + (ddx / dl) * 0.3;
      const oz = lz + (ddz / dl) * 0.3;
      this.go(L, ox, oz, 1.1);
      let wt = 0;
      this.everyFrame = (dt) => {
        wt += dt;
      };
      yield () => wt > 2.4 || Math.hypot(L.pos.x - ox, L.pos.z - oz) < 0.4;
      this.everyFrame = null;
      // (stopped where she is, turning to him - not snapped round)
      L.pl.x = L.pos.x;
      L.pl.z = L.pos.z;
      L.pl.speed = 0;
      this.faceTo(L, P.pos.x, P.pos.z);
    }
    // she cannot wait to show him: the page held up to him - the page, and her face over it
    page.hold(L.fig, () => P.fig.j.headC, 'show');
    L.fig.lookAt = P.fig.j.headC;
    P.fig.lookAt = page.at;
    this.feel(L.fig, 'joy', 4);
    yield 0.45;
    {
      // (ROADMAP 23.10: from his own eyes - down at the page she holds up to him, her face over it. The lens was put a step
      // from the page towards him, and that was inside his jacket: a black picture)
      const hD = this.headJ(P) || v3(P.pos.x, (P.pos.y || 0) + 1.7, P.pos.z);
      const hL = () => this.headJ(L) || v3(L.pos.x, (L.pos.y || 0) + 1.2, L.pos.z);
      const dx = L.pos.x - P.pos.x;
      const dz = L.pos.z - P.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const eye = v3(hD.x + (dx / d) * 0.1, hD.y - 0.02, hD.z + (dz / d) * 0.1);
      this.shot({ from: eye, to: v3(eye.x + (dx / d) * 0.06, eye.y - 0.03, eye.z + (dz / d) * 0.06), look: () => { const h = hL(); const pa = page.at; return v3(pa.x * 0.6 + h.x * 0.4, pa.y * 0.6 + h.y * 0.4, pa.z * 0.6 + h.z * 0.4); }, fov: 44, dur: 3.0, hand: 0.2, key: 0.9, keySide: -1 });
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
    // (round 23, the review: the snap in and the comic's lines, the pier behind her - the pink kept for
    // the story's great moments)
    if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(L), 1.2, 0.8);
    yield* this.say('L07', L.fig, 0.2);
    // the two of them, laughing: from the wheel's side, the city behind them
    // (round 23, the review: his punchline near enough to read their faces - and her drawing between
    // them; from four metres off they were small, and the joke fell flat)
    {
      const mx = (L.pos.x + P.pos.x) / 2;
      const mz = (L.pos.z + P.pos.z) / 2;
      this.shot({ from: [mx + ux * 2.3 - rx * 0.45, 1.36, mz + uz * 2.3 - rz * 0.45], to: [mx + ux * 2.1 - rx * 0.4, 1.36, mz + uz * 2.1 - rz * 0.4], look: [mx, 1.28, mz], fov: 42, dur: 3.4, hand: 0.35 });
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
    // (round 17, the player's word: as they look up at the kids, the kids are heard: the boy calling
    // down to his mother, and all of them up there, 'Mom, look!', 'we're so high!', from the wheel,
    // till it is gone - voice.js bed; round 18: the frightening music on since the wheel was seen)
    this.cue('thriller', { fade: 1.2 });
    this.voices.bedAt(WHEEL.x, 30, WHEEL.z);
    this.voices.bed(true, 0.9);
    if (kid && kid.fig) this.say('K01', kid.fig, 0).next();
    this.shot({ from: () => this.gondolaCam(gi, -3.0, -2.25, -0.12), to: () => this.gondolaCam(gi, -17, -7.5, 4.5), look: () => this.headJ(kid) || this.gondolaAt(gi, -1.0, -2.3, 0), lookTo: () => this.gondolaAt(gi, 0, -4, 0), fov: 20, fovTo: 46, dur: 4.4, ease: 'inout', hand: 0.45 });
    yield 4.2;
    // the two of them at the railing from behind, the wheel turning against the sky - and under the
    // evening something that should not be there: the waltz winding down, out of tune, and the
    // unease growing under it (game/prologue/score.js unease)
    const wideFrom = [VIEW.x - ux * 4.2 + rx * 1.9, 1.1, VIEW.z - uz * 4.2 + rz * 1.9];
    const wideTo = [VIEW.x - ux * 3.9 + rx * 1.85, 1.12, VIEW.z - uz * 3.9 + rz * 1.85];
    // (ROADMAP 23.11, the owner's word - "the most important of all": from the kids on the wheel to the whole wheel for a second
    // to its erasing was "too quick, as if they were waiting for it. A few moments first - curiosity in the air, a real tension,
    // something bad happening - and only then is it rubbed out". Some ten seconds of it, without a word:)
    // a. down here an evening like any other: she waves back up at them; he watches her do it
    {
      const mx = (L.pos.x + P.pos.x) / 2;
      const mz = (L.pos.z + P.pos.z) / 2;
      const gy = P.pos.y || 0;
      const t0 = g.time;
      this.feel(L.fig, 'joy', 5);
      this.feel(P.fig, 'tender', 3.4);
      L.fig.lookAt = W0;
      P.fig.lookAt = L.fig.j.headC;
      // (her left hand, the one away from him: up beside her head, its palm to the wheel, side to side)
      this.hold(L.fig, 'L', () => {
        const h = this.headJ(L) || v3(L.pos.x, gy + 1.1, L.pos.z);
        const sw = Math.sin((g.time - t0) * 8.5) * 0.05;
        return v3(h.x - rx * (0.2 + sw) + ux * 0.1, h.y + 0.15, h.z - rz * (0.2 + sw) + uz * 0.1);
      }, { palm: v3(ux, 0.1, uz), fingers: v3(-rx * 0.15, 1, -rz * 0.15), ease: 0.3 });
      this.shot({ from: [mx + ux * 2.5 + rx * 0.7, gy + 0.98, mz + uz * 2.5 + rz * 0.7], to: [mx + ux * 2.3 + rx * 0.62, gy + 1.0, mz + uz * 2.3 + rz * 0.62], look: [mx, gy + 1.06, mz], fov: 36, dur: 3.2, hand: 0.25, key: 0.8, keySide: 1 });
      yield 2.7;
    }
    // b. the wheel over the two of them, turning - and the evening's sound thinning out from under it: the pier, the children's
    // voices; his heart
    P.fig.lookAt = v3(WHEEL.x, 30, WHEEL.z);
    this.shot({ from: wideFrom, to: wideTo, look: [WHEEL.x, 24, WHEEL.z], fov: 50, dur: 6, ease: 'lin', hand: 0.3 });
    yield 1.1;
    this.airDip = 0.6;
    this.voices.bed(true, 0.55);
    yield 0.9;
    this.airDip = 0.3;
    this.voices.bed(true, 0.28);
    if (this.comic && this.comic.pulse) this.comic.pulse(8, { per: 0.92, k: 0.5, vol: 0.5 });
    yield 0.9;
    // c. he has felt it first: the smile gone from his face, his eyes on the top of it
    this.feel(P.fig, 'worried', 8);
    {
      const A = this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.3, side: -0.24, up: -0.14, drop: 0.0 });
      const Bn = this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.05, side: -0.2, up: -0.12, drop: 0.0 });
      this.shot({ from: A.from, to: Bn.from, look: A.look, fov: 30, dur: 2.4, hand: 0.2, dof: 0.8, fill: 1.1 });
    }
    yield 2.2;
    // d. what he sees, from his eyes, long: up there, for a blink, a piece of it is not there. And is. And another
    {
      const ph = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const up = v3(WHEEL.x, WHEEL.deck + WHEEL.hubUp + 22, WHEEL.z);
      this.shot({ from: [ph.x, ph.y, ph.z], look: up, fov: 13.5, fovTo: 12, dur: 2.2, hand: 0.5 });
      this.airDip = 0.16;
      this.voices.bed(true, 0.14);
      yield 0.8;
      if (S.glitch) S.glitch(4, 25, 3.4, true);
      g.audio.play('dread', 0.3);
      yield 0.13;
      if (S.glitch) S.glitch(4, 25, 3.4, false);
      yield 0.55;
      if (S.glitch) S.glitch(-11, 20.5, 2.6, true);
      yield 0.1;
      if (S.glitch) S.glitch(-11, 20.5, 2.6, false);
      yield 0.5;
    }
    // e. her: the hand comes down; she looks at him - and up, where he is looking
    this.unhold(L.fig, 'L', 0.5);
    this.feel(L.fig, 'worried', 8);
    L.fig.lookAt = P.fig.j.headC;
    this.shot({ ...this.single(L, P, { dist: 1.0, side: 0.3, up: -0.05, drop: 0.06 }), fov: 30, dur: 2.2, hand: 0.2, dof: 1, shade: [P.fig] });
    yield 0.9;
    L.fig.lookAt = W0;
    yield 0.8;
    // f. the whole of it once more, in all but silence - and there, at its top, it begins
    this.airDip = 0.1;
    this.voices.bed(true, 0.1);
    this.shot({ from: wideTo, to: [wideTo[0] + ux * 0.25, wideTo[1] + 0.02, wideTo[2] + uz * 0.25], look: [WHEEL.x, 24, WHEEL.z], fov: 50, fovTo: 47, dur: 4, ease: 'lin', hand: 0.2 });
    yield 1.3;
    // it begins to be rubbed out, at the top: no eraser seen, only what it does (game/prologue/set.js:
    // the paper coming through where it goes, its crumbs, its rub; the comic's marks round it) - row
    // after row, seven seconds; their eyes on it as it goes
    const tip = S.eraser ? S.eraser.pos : W0;
    L.fig.lookAt = tip;
    P.fig.lookAt = tip;
    // (round 23, the review: the shock on his face from the moment it begins - set only as his close
    // came, the face in it was still on its way there, all but blank)
    // (ROADMAP 23.11, the owner's word: "shock - not dolls with all but the same face": what cannot be, on both of them - his
    // own drawn face for it, render/heroart.js shock; her gentle face's limits lifted for it, faceFull)
    this.feel(P.fig, 'shock', 16);
    L.fig.faceFull = 1;
    S.erase();
    // (and under the procedural rubs, the recorded one: a great eraser on paper, the whole of it)
    this.rubRec = this.sample('sfx/erase_rub.mp3', 0.4);
    // (the pier still far away under it; the children's voices back, a little - still laughing up there)
    this.airDip = 0.22;
    this.voices.bed(true, 0.5);
    const C = this.comic;
    if (C && S.eraser) C.rub(S.eraser);
    const et = () => (S.erasing ? S.erasing.t : 99);
    const X = S.eraser;
    const onX = (dy = 0) => () => (X ? v3((X.pos.x + WHEEL.x) / 2, X.pos.y + dy, (X.pos.z + WHEEL.z) / 2) : v3(WHEEL.x, 40, WHEEL.z));
    // (close on it, the camera after it: the top gondolas' colours going to paper, the crumbs)
    // (round 9: the frame tilting as it goes on - nothing is right any more)
    // (the first second of it from where they stand, the picture not moving: it is happening, and nothing has cut away to say so)
    yield () => et() > 0.95;
    this.shot({ from: [VIEW.x + ux * 0.2 - rx * 1.3, 1.2, VIEW.z + uz * 0.2 - rz * 1.3], look: onX(-5), fov: 30, fovTo: 27, dur: 1.6, hand: 0.45, roll: 0, rollTo: 0.09 });
    // (ROADMAP 23.10: no drawn sound word over it - the owner's word: childish. What it does is seen, and heard)
    yield () => et() > 2.0;
    // her: it cannot be - her mouth open, the page against her
    this.feel(L.fig, 'shock', 14);
    page.hold(L.fig, null, 'hug');
    if (C) C.rub(null);
    // (round 9: in on her eyes - an anime's close, the world behind her gone soft)
    {
      const A = this.single(L, v3(WHEEL.x, 1.1, WHEEL.z), { dist: 0.9, side: 0.16, up: -0.04, drop: -0.06 });
      const B = this.single(L, v3(WHEEL.x, 1.1, WHEEL.z), { dist: 0.62, side: 0.12, up: -0.03, drop: -0.06 });
      this.shot({ from: A.from, to: B.from, look: A.look, fov: 26, dur: 1.4, hand: 0.35, dof: 1 });
    }
    yield () => et() > 3.0;
    // him: what is it doing
    // (round 23, the review: pushed further in on him, his face lit - the moment's whole weight on it;
    // fear on it, not the mild surprise his 'shock' gave)
    {
      const A = this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.3, side: -0.2, up: -0.16, drop: -0.02 });
      const B = this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 0.9, side: -0.16, up: -0.12, drop: -0.02 });
      this.shot({ from: A.from, to: B.from, look: A.look, fov: 32, dur: 1.6, hand: 0.4, roll: -0.02, rollTo: -0.1, dof: 0.7, fill: 1.15 });
    }
    yield () => et() > 4.5;
    // the whole of it from behind them: half of it gone, going on down it
    // (round 9: from high over the pier - the people under it, not one of them looking up)
    this.shot({ from: [VIEW.x - ux * 9 + rx * 6, 9.5, VIEW.z - uz * 9 + rz * 6], to: [VIEW.x - ux * 8.4 + rx * 5.6, 10.2, VIEW.z - uz * 8.4 + rz * 5.6], look: [WHEEL.x, 14, WHEEL.z], fov: 54, dur: 1.4, ease: 'lin', hand: 0.3, roll: 0.06 });
    if (C && X) C.rub(X);
    yield () => et() > 5.3;
    // (and what it is now on both their faces: fear)
    this.feel(P.fig, 'scared', 10);
    this.feel(L.fig, 'scared', 10);
    // the two of them from in front and below, close: she has come to him and holds on to his arm with
    // both hands; his arm across in front of her
    {
      // (ROADMAP 23.10: tucked in against his side, his arm round her shoulders, his hand on her far one; her hand in his jacket.
      // His arm went out to a point in front of her, straight as a rail, and the two of them were small in the picture)
      this.put(L, VIEW.x + rx * 0.93, VIEW.z + rz * 0.93, toW);
      const mx = (L.pos.x + P.pos.x) / 2;
      const mz = (L.pos.z + P.pos.z) / 2;
      const gy = P.pos.y || 0;
      this.shot({ from: [mx + ux * 2.15 + rx * 0.25, gy + 0.72, mz + uz * 2.15 + rz * 0.25], to: [mx + ux * 1.95 + rx * 0.22, gy + 0.74, mz + uz * 1.95 + rz * 0.22], look: [mx, gy + 1.12, mz], fov: 38, dur: 1.4, hand: 0.4, key: 0.9, keySide: 1 });
      if (C) C.rub(null);
      this.pose(P.fig, { fSide: -0.03, fLean: 0.04 }, 0.3, 'out');
      this.hold(P.fig, 'L', () => { const sh = L.fig.j.shoulderL; return v3(sh.x - rx * 0.01, sh.y + 0.05, sh.z - rz * 0.01); }, { on: true, palm: v3(0, -1, 0), fingers: v3(ux * 0.6 - rx * 0.35, -0.7, uz * 0.6 - rz * 0.35), pole: v3(-ux * 0.6 - rx * 0.2, -0.75, -uz * 0.6 - rz * 0.2), ease: 0.25 });
      this.hold(L.fig, 'R', () => { const h = P.fig.j.hip; return v3(h.x - rx * 0.17 + ux * 0.1, h.y + 0.2, h.z - rz * 0.17 + uz * 0.1); }, { palm: v3(rx, 0, rz), fingers: v3(ux * 0.4 + rx * 0.5, 0.75, uz * 0.4 + rz * 0.5), grip: true, ease: 0.25 });
    }
    yield () => et() > 6.25;
    // (the last of it: the bottom gondolas going)
    // (round 23, the review: from over the railing - from under it, the last gondolas were behind it,
    // and the eraser's marks drawn where they were lay over the railing, as if it was rubbed out)
    this.shot({ from: [VIEW.x + ux * 0.2 - rx * 1.3, 2.35, VIEW.z + uz * 0.2 - rz * 1.3], look: onX(2), fov: 32, dur: 1.1, hand: 0.5, roll: 0.05, rollTo: 0.12, whip: 0.22 });
    if (C && X) C.rub(X);
    yield () => et() > 7.0;
    // as it goes: a comic's page, for a moment - where it was; her face; his (their arms down: the
    // panels their faces alone)
    if (C) C.rub(null);
    L.fig.reachR = null;
    L.fig.reachL = null;
    P.fig.reachL = null;
    this.unhold(P.fig, null, 0);
    this.unhold(L.fig, null, 0);
    this.pose(P.fig, { fSide: 0, fLean: 0 }, 0.01);
    if (C && C.page) {
      C.page([
        [[0.015, 0.03], [0.39, 0.03], [0.355, 0.97], [0.015, 0.97]],
        [[0.405, 0.03], [0.69, 0.03], [0.655, 0.97], [0.37, 0.97]],
        [[0.705, 0.03], [0.985, 0.03], [0.985, 0.97], [0.67, 0.97]],
      ]);
      this.shot({ from: wideFrom, look: [WHEEL.x, 24, WHEEL.z], fov: 46, dur: 1, hand: 0.3 });
      C.panel(0, { u: 0.56, v: 0.42 });
      yield 0.4;
      this.shot({ ...this.single(L, v3(WHEEL.x, 1.1, WHEEL.z), { dist: 1.0, side: 0.12, up: -0.2, drop: -0.05 }), fov: 38, dur: 1, hand: 0.3, shade: [P.fig] });
      C.panel(1, { u: 0.5, v: 0.48 });
      yield 0.4;
      this.shot({ ...this.single(P, v3(WHEEL.x, 1.7, WHEEL.z), { dist: 1.3, side: -0.12, up: -0.22, drop: -0.04 }), fov: 36, dur: 1, hand: 0.3 });
      C.panel(2, { u: 0.5, v: 0.48 });
      yield 0.6;
    }
    yield () => !S.erasing;
    if (C && C.endPage) C.endPage(0.01);
    // gone: the air rushing in where it stood; a flash of white as the last of it goes
    g.audio.play('gone', 1);
    this.flash(0.22, '#fffaf0');
    if (this.rubRec) {
      try {
        this.rubRec.stop();
      } catch (e) {
        // (over already)
      }
      this.rubRec = null;
    }
    this.sample('sfx/gone_whoosh.mp3', 0.9);
    this.airDip = 1;
    // (round 17: and the kids' voices with it - cut dead)
    this.voices.bed(false);
    // (round 9, the player's word: not silence once it is gone - round 16: the thriller's piece goes on
    // under it, the same, unbroken, to the car)
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
      this.emote([0.5, 0.07, 0.09], 0.8);
      this.sample('sfx/sting.mp3', 0.75);
      if (C && C.focus) C.focus(() => this.headJ(P), 1.6, 1);
    }
    yield 0.75;
    const d29 = this.say('D29', P.fig, 0.1);
    const d29w = d29.next().value || 4.5;
    // (inside his head: it was there - a flash of it as it was, white, gone)
    yield 0.9;
    // (ROADMAP 23.11, the owner's word: "Danny's face a little longer - a second and a half, two - before her reaction": held on
    // him, nearer, as the words come out of him)
    {
      const A2 = this.single(P, wv, { dist: 1.0, side: -0.2, up: -0.1, drop: 0.03 });
      const B2 = this.single(P, wv, { dist: 0.84, side: -0.17, up: -0.08, drop: 0.03 });
      this.shot({ from: A2.from, to: B2.from, look: A2.look, fov: 30, dur: 2.2, hand: 0.3, dof: 1, fill: 1.1 });
      // (and she, out from his side: a step along the railing towards where it stood, while the picture is on him - so that the
      // one over her shoulder after it is over hers, not his back across it, and her close shot hers alone: against him, his
      // arm and coat were a third of it)
      this.glide(L, VIEW.x + rx * 0.1, VIEW.z + rz * 0.1, 1.2, true);
    }
    yield 1.9;
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
    this.emote([0.1, 0.16, 0.36], 0.74);
    {
      const LA = this.single(L, wv, { dist: 0.8, side: -0.16, up: 0.0, drop: 0.05 });
      const LB = this.single(L, wv, { dist: 0.62, side: -0.12, up: 0.0, drop: 0.05 });
      // (ROADMAP 23.10: him, at her side, kept dark - his bare arm was a lit orange shape at the edge of her close shot)
      this.shot({ from: LA.from, to: LB.from, look: LA.look, fov: 30, dur: 1.8, hand: 0.35, dof: 1, shade: [P.fig] });
    }
    yield Math.max(0.2, d29w - 3.45 - 1.9 - 0.2);
    L.fig.faceFull = 0.6;
    const l22 = this.say('L22', L.fig, 0.1);
    const l22w = l22.next().value || 5;
    // (round 23, the review: the whole of her line on her face - it went on over an empty promenade,
    // and over her small at the back of the next picture; the evening that goes on round them after
    // it, without words)
    yield Math.max(1.4, l22w + 0.55);
    this.emote(null);
    // (and all round them the evening goes on: along the pier people strolling, eating, laughing - not
    // one of them looking up. That is what is wrong)
    this.shot({ from: [VIEW.x + rx * 1.6 - ux * 0.5, 1.55, VIEW.z + rz * 1.6 - uz * 0.5], to: [VIEW.x + rx * 1.8 - ux * 0.8, 1.55, VIEW.z + rz * 1.8 - uz * 0.8], look: [VIEW.x - ux * 14 + rx * 2, 1.3, VIEW.z - uz * 14 + rz * 2], fov: 44, dur: 2.0, hand: 0.3, roll: -0.05, rollTo: -0.09 });
    yield 1.6;
    L.fig.lookAt = null;
    // (round 13: him through them, to where it stood - stressed, looking round, asking: seen, not
    // walked by the player)
    this.setZone = null;
    L.fig.faceFull = 0;
    yield* this.searchMontage();
    this.start(4);
  }

  // (round 13) a thought: words in someone's head, as an anime puts them - in a box at the top of the
  // picture, in brackets, slanting, held a moment, gone (the spoken words stay under it, below)
  thought(text, life = 1.8) {
    if (this.ff || typeof document === 'undefined') return;
    if (!document.getElementById('pro-thought-css')) {
      const st = document.createElement('style');
      st.id = 'pro-thought-css';
      st.textContent = '.pro-thought{position:fixed;z-index:58;left:50%;top:15%;max-width:min(560px,86vw);padding:8px 18px 10px;background:rgba(14,10,26,.72);border:2px solid rgba(255,248,236,.55);border-radius:14px 10px 15px 9px;color:#fff8ec;font:italic 600 clamp(17px,3.2vw,26px)/1.25 "Rubik",system-ui,sans-serif;direction:rtl;text-align:center;pointer-events:none;box-shadow:0 0 0 4px rgba(14,10,26,.25);opacity:0}.pro-thought.film{top:auto;bottom:22%;background:none;border:0;box-shadow:none;border-radius:0;letter-spacing:.02em;text-shadow:0 2px 12px rgba(8,6,16,.95),0 0 4px rgba(8,6,16,.9),0 0 2px rgba(8,6,16,.9)}';
      document.head.appendChild(st);
    }
    const el = document.createElement('div');
    // (ROADMAP 23.12: in the film's new look a thought is a line of it - italic, over the picture, no bubble round it)
    el.className = this.newLook ? 'pro-thought film' : 'pro-thought';
    // (round 16: in the language chosen - i18n.js)
    const said = thoughtT(text);
    el.textContent = `(${said})`;
    el.style.direction = /[\u0590-\u05ff]/.test(said) ? 'rtl' : 'ltr';
    document.body.appendChild(el);
    // (on the film's own clock, as everything in it: tickThoughts - a paused game holds it)
    (this.thoughts || (this.thoughts = [])).push({ el, t: 0, life });
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

  // (round 17, the player's word: where the story goes on from marked in the world, not only by the
  // map's dot - 'players could look for an hour'): a ring of light on the ground there, as big as the
  // place it begins in, and an arrow over it, bobbing; gone in the film, and once it is reached
  beacon(x, z, r = 3, h = 1.6) {
    this.unbeacon();
    const g = this.game;
    const col = g.world && g.world.collision;
    let y = groundHeight(x, z);
    // (a floor a little over the ground only - not the top of a lamp or a bench over the place)
    const hit = col && col.raycast ? col.raycast(x, y + 1.2, z, 0, -1, 0, 3) : null;
    if (hit && hit.y > y - 0.5 && hit.y < y + 1.1) y = hit.y;
    const yel = linC(1, 0.8, 0.18);
    const M = itemMats();
    const K = new Kit();
    K.torus(M.glow, r, 0.08, 0, 0, 0, yel, Math.PI / 2);
    K.torus(M.glow, r * 0.58, 0.05, 0, 0, 0, yel, Math.PI / 2);
    const ring = K.build({ seed: 0.31 });
    ring.traverse((q) => (q.matrixAutoUpdate = true));
    ring.position.set(x, y + 0.07, z);
    g.scene.add(ring);
    // (over it, on the screen, an arrow pointing down at it, bobbing: yellow inked dark round its
    // edge - a glowing one in the world was lost against the sunset's own yellow)
    const el = document.createElement('div');
    el.className = 'pro-beacon';
    el.innerHTML = '<svg viewBox="-24 -34 48 50"><path d="M-11 -32 H11 V-8 H21 L0 14 L-21 -8 H-11 Z" fill="#ffd23f" stroke="#1b1430" stroke-width="4" stroke-linejoin="round"/></svg>';
    if (!document.getElementById('pro-beacon-css')) {
      const st = document.createElement('style');
      st.id = 'pro-beacon-css';
      st.textContent = '.pro-beacon{position:fixed;left:0;top:0;width:44px;height:46px;margin:-46px 0 0 -22px;z-index:40;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.5));will-change:transform}.pro-beacon svg{width:100%;height:100%;overflow:visible}.pro-beacon.off{display:none}';
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
    this.beaconR = { ring, el, t: 0, x, y, z, r, h };
  }

  unbeacon() {
    const B = this.beaconR;
    if (!B) return;
    if (B.ring.parent) B.ring.parent.remove(B.ring);
    B.ring.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    B.el.remove();
    this.beaconR = null;
  }

  tickBeacon(dt) {
    const B = this.beaconR;
    if (!B) return;
    B.t += dt;
    B.ring.scale.setScalar(1 + Math.sin(B.t * 3.2) * 0.04);
    B.ring.visible = B.film || !this.holdCam;
    // (the arrow where the place is on the screen, a little over it - not behind the camera)
    const cam = this.game.camera;
    const q = v3(B.x, B.y + (B.h || 1.6), B.z).project(cam);
    const on = (B.film || !this.holdCam) && q.z < 1 && Math.abs(q.x) < 1.05 && Math.abs(q.y) < 1.05;
    B.el.classList.toggle('off', !on);
    if (on) {
      const sx = ((q.x + 1) / 2) * window.innerWidth;
      const sy = ((1 - q.y) / 2) * window.innerHeight - Math.abs(Math.sin(B.t * 3.4)) * 10;
      B.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
  }

  // (round 13) inside his head, a flash: the wheel as it was a moment ago - white, the picture of it
  // over the empty sky, gone in a breath (comic.js flash, the wheel's own picture: memory)
  memoryFlash(soft = false) {
    const g = this.game;
    // (round 17, the player's word: and the kids on it remembered with it - their calls, 'Mom, look at
    // me!', 'Dad, look how high we are!', inside his head: voice.js memory)
    if (this.voices && this.voices.memory) this.voices.memory(soft ? 0.4 : 0.55);
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
    // (ROADMAP 23.12, stage 3 - the owner's word: "when he is in a panic and goes and asks people what the hell happened to the
    // wheel - at a very, very high level: the people, how they look, how they move, everything". Some sixteen seconds, without a
    // word heard: he runs into the evening's people - the same ones every time - and stops three of them. A man, his hand on
    // the man's shoulder: the man's hands come up between them and he steps back. A mother: her hand goes to her child, the child
    // behind her, a shake of her head, and round him. A couple: he shrugs, she smiles at him, not at Danny. And from high over
    // the pier, him stood in the middle of it and all of them going by)
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const toS = Math.atan2(SITE.x - P.pos.x, SITE.z - P.pos.z);
    const fx = Math.sin(toS);
    const fz = Math.cos(toS);
    // (his right, as he goes)
    const rx = -fz;
    const rz = fx;
    const x0 = P.pos.x;
    const z0 = P.pos.z;
    const at = (a, sd) => [x0 + fx * a + rx * sd, z0 + fz * a + rz * sd];
    const gy = P.pos.y || 0;
    const hd = (c) => this.headJ(c) || v3(c.pos.x, (c.pos.y || 0) + 1.6, c.pos.z);
    // (Lily after him)
    if (L) L.pl.follow = true;
    // ---- the people on his way: strolling this way along the pier towards the town, and the five he stops
    const ks = this.crowdLooks();
    const men = ks.filter((k) => !FOLK[k].role && !FOLK[k].fem);
    const women = ks.filter((k) => !FOLK[k].role && FOLK[k].fem);
    const kids = ks.filter((k) => FOLK[k].role === 'kid');
    const all = [];
    const mk = (key, k, a, sd) => {
      const [x, z] = at(a, sd);
      const q = this.person(key, x, z, folkLook(k), { face: toS + Math.PI });
      q.noCollide = true;
      if (q.fig) q.fig.lodFar = 85;
      all.push([q, key]);
      return q;
    };
    [[4.5, -2.3], [6.8, 2.0], [12.2, 2.7], [13.8, -2.6], [15.4, 1.4], [20.6, -2.2], [22.4, 2.5], [29, -2.4], [31, 1.3], [34, -0.6]].forEach(([a, sd], i) => {
      const pool = i % 2 ? women : men;
      const q = mk('eve' + i, pool.length > 3 ? pool[2 + ((i >> 1) % (pool.length - 2))] : ks[(i * 3 + 1) % ks.length], a, sd);
      this.go(q, q.pos.x - fx * 70, q.pos.z - fz * 70, 0.95 + (i % 3) * 0.15);
    });
    // (at the railings till he comes to each of them: stood in the middle of the pier, the first of them was between him and the
    // long lens ahead of him, his back across the picture)
    const A1 = mk('ask1', men.length ? men[0] : ks[0], 10.1, -3.1);
    const A2 = mk('ask2', women.length ? women[0] : ks[1 % ks.length], 18.5, 3.0);
    const K2 = kids.length ? mk('ask2k', kids[0], 18.55, 3.6) : null;
    const A3 = mk('ask3', men.length > 1 ? men[1] : ks[2 % ks.length], 26.6, -3.3);
    const B3 = mk('ask3b', women.length > 1 ? women[1] : ks[3 % ks.length], 26.6, -2.6);
    // (inside his head: the world gone far off and muffled, only his heart loud - till he shouts at the
    // two at the railing, scene 4: core/audio.js muffle, comic.js pulse)
    if (g.audio.muffle) {
      g.audio.muffle(true);
      this.muffled = true;
    }
    if (this.comic && this.comic.pulse) this.comic.pulse(20, { per: 0.78, k: 0.55, vol: 0.85 });
    const mouth = (text, dur, tone = 'talk') => ({ text, tone, at: 0, atT: performance.now() / 1000, real: true, cps: text.length / dur, wait: false, done: false });
    const sky = v3(WHEEL.x, 20, WHEEL.z);
    // ---- 1. from far ahead of him, long: running at us through them - their backs going by, close and soft
    this.feel(P.fig, 'scared', 20);
    this.walkTo = { x: x0 + fx * 8.6, z: z0 + fz * 8.6, speed: 1, sprint: true };
    this.shot({ from: v3(x0 + fx * 16.5 + rx * 0.7, gy + 1.45, z0 + fz * 16.5 + rz * 0.7), look: () => { const h = hd(P); return v3(h.x, h.y - 0.12, h.z); }, fov: 14.5, fovTo: 16.5, dur: 2.6, hand: 0.8, dof: 1 });
    {
      let t = 0;
      yield () => {
        t += this.dtR || 1 / 30;
        // (his head this way and that as he goes)
        P.fig.lookAt = v3(P.pos.x + fx * 6 + rx * Math.sin(t * 3.4) * 5, 1.6, P.pos.z + fz * 6 + rz * Math.sin(t * 3.4) * 5);
        return t > 2.3;
      };
    }
    // ---- 2. his eyes, close: from one side to the other
    {
      this.shot({ from: () => { const h = hd(P); return v3(h.x + fx * 0.78, h.y - 0.03, h.z + fz * 0.78); }, look: () => { const h = hd(P); return v3(h.x, h.y - 0.035, h.z); }, fov: 30, dur: 0.9, hand: 0.25 });
      const h = hd(P);
      P.fig.lookAt = v3(h.x + rx * 5, h.y, h.z + rz * 5);
      yield 0.42;
      P.fig.lookAt = v3(h.x - rx * 5, h.y, h.z - rz * 5);
      yield 0.42;
    }
    this.walkTo = null;
    this.auto = null;
    // ---- 3. the first of them: his hand on the man's shoulder, the other at the sky. From the side, the two of them whole:
    // the man's hands come up between them, and he steps back out of the hand
    {
      this.putDanny(...at(8.95, -0.05), toS);
      this.put(A1, ...at(10.05, -0.2), toS + Math.PI);
      A1.fig.lookAt = P.fig.j.headC;
      P.fig.lookAt = A1.fig.j && A1.fig.j.headC ? A1.fig.j.headC : hd(A1);
      this.hold(P.fig, 'L', () => { const sh = A1.fig.j.shoulderR; return v3(sh.x - fx * 0.02, sh.y + 0.05, sh.z - fz * 0.02); }, { on: true, palm: v3(0, -1, 0), fingers: v3(fx * 0.8 - rx * 0.3, -0.3, fz * 0.8 - rz * 0.3), pole: v3(-rx * 0.6 - fx * 0.2, -0.75, -rz * 0.6 - fz * 0.2), ease: 0.16 });
      this.acting.play(P.fig, 'XD1', 1.5);
      P.fig.say = mouth('The wheel! Where did it go?!', 1.3, 'alarm');
      const mx = (P.pos.x + A1.pos.x) / 2;
      const mz = (P.pos.z + A1.pos.z) / 2;
      this.shot({ from: v3(mx - rx * 3.1 - fx * 0.3, gy + 1.42, mz - rz * 3.1 - fz * 0.3), to: v3(mx - rx * 2.9 - fx * 0.2, gy + 1.42, mz - rz * 2.9 - fz * 0.2), look: v3(mx, gy + 1.38, mz), fov: 32, dur: 2.6, hand: 0.7, roll: 0.04 });
      yield 0.95;
      this.acting.play(A1.fig, 'XBACK', 1.5);
      this.unhold(P.fig, 'L', 0.3);
      const [bx, bz] = at(10.85, -0.35);
      this.glide(A1, bx, bz, 0.5, true);
      yield 0.85;
      // (and round him, on his way)
      A1.fig.lookAt = null;
      this.go(A1, A1.pos.x - fx * 70 - rx * 1.3, A1.pos.z - fz * 70 - rz * 1.3, 1.5);
      yield 0.6;
    }
    // ---- 4. a mother and her child, over his shoulder: what he says to them with both his hands; her hand to the child, the
    // child in behind her, her head: no. And round him, quickly
    {
      this.putDanny(...at(17.3, 0.3), toS);
      this.put(A2, ...at(18.5, 0.25), toS + Math.PI);
      if (K2) this.put(K2, ...at(18.55, 0.9), toS + Math.PI);
      for (const q of [A2, K2]) if (q) q.fig.lookAt = P.fig.j.headC;
      P.fig.lookAt = A2.fig.j && A2.fig.j.headC ? A2.fig.j.headC : hd(A2);
      this.acting.play(P.fig, 'XD2', 1.7);
      P.fig.say = mouth('Did you see that?! The wheel!', 1.4, 'alarm');
      this.shot({ from: this.ots(P, A2, { back: 0.75, side: 0.45, h: 1.6 }), look: () => { const h = hd(A2); return v3(h.x + rx * 0.2, h.y - 0.22, h.z + rz * 0.2); }, fov: 36, dur: 2.5, hand: 0.6, roll: -0.05, dof: 0.6 });
      yield 0.7;
      this.feel(A2.fig, 'worried', 3);
      if (K2) {
        // (her hand on the child's shoulder, and the child drawn round behind her)
        this.hold(A2.fig, 'L', () => { const sh = K2.fig.j.shoulderR; return v3(sh.x, sh.y + 0.04, sh.z); }, { on: true, palm: v3(0, -1, 0), fingers: v3(rx * 0.7 - fx * 0.3, -0.5, rz * 0.7 - fz * 0.3), ease: 0.2 });
        this.feel(K2.fig, 'surprised', 3);
        const [kx, kz] = at(19.15, 0.55);
        this.glide(K2, kx, kz, 0.6, true);
      }
      this.acting.play(A2.fig, 'XNO', 1.2);
      yield 1.0;
      this.unhold(A2.fig, null, 0.2);
      for (const q of [A2, K2]) {
        if (!q) continue;
        q.fig.lookAt = null;
        this.go(q, q.pos.x - fx * 70 + rx * 1.6, q.pos.z - fz * 70 + rz * 1.6, 1.7);
      }
      yield 0.75;
    }
    // ---- 5. round him where he stands and turns, his hands open: the pier, the people, going round him - faster
    {
      this.putDanny(...at(21.6, 0), toS);
      const c0 = P.pos.clone();
      let a0 = toS + Math.PI;
      let sp = 1.4;
      this.acting.play(P.fig, 'XD4', 2.0);
      this.shot({
        from: () => {
          const dt = this.dtR || 1 / 30;
          sp += dt * 1.3;
          a0 += dt * sp;
          return v3(c0.x + Math.sin(a0) * 2.5, gy + 1.68, c0.z + Math.cos(a0) * 2.5);
        },
        look: () => { const h = hd(P); return v3(h.x, h.y - 0.2, h.z); },
        fov: 44,
        dur: 1.9,
        hand: 0.4,
        roll: 0.05,
        rollTo: -0.07,
      });
      let t = 0;
      yield () => {
        t += this.dtR || 1 / 30;
        P.yaw = toS + Math.sin(t * 3) * 1.2;
        P.fig.yaw = P.yaw;
        P.fig.lookAt = v3(P.pos.x + Math.sin(P.yaw) * 6, 1.7, P.pos.z + Math.cos(P.yaw) * 6);
        return t > 1.8;
      };
    }
    // ---- 6. a couple, over his other shoulder: back at the sky over his shoulder, and at them; the man shrugs; she smiles -
    // at her man, not at him. They go on
    {
      this.putDanny(...at(25.4, 0), toS);
      this.put(A3, ...at(26.6, -0.38), toS + Math.PI);
      this.put(B3, ...at(26.6, 0.36), toS + Math.PI);
      A3.fig.lookAt = P.fig.j.headC;
      B3.fig.lookAt = P.fig.j.headC;
      P.fig.lookAt = A3.fig.j && A3.fig.j.headC ? A3.fig.j.headC : hd(A3);
      this.acting.play(P.fig, 'XD3', 1.6);
      P.fig.say = mouth('It was right there! The wheel!', 1.4, 'alarm');
      this.shot({ from: this.ots(P, A3, { back: 0.8, side: -0.5, h: 1.62 }), look: () => { const a = hd(A3); const b = hd(B3); return v3((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.1, (a.z + b.z) / 2); }, fov: 38, dur: 2.5, hand: 0.6, roll: 0.05, dof: 0.6 });
      yield 0.9;
      this.acting.play(A3.fig, 'XSHRUG', 1.3);
      yield 0.45;
      B3.fig.lookAt = A3.fig.j.headC;
      this.feel(B3.fig, 'smirk', 3);
      yield 0.4;
      A3.fig.lookAt = B3.fig.j.headC;
      this.feel(A3.fig, 'joy', 3);
      yield 0.5;
      for (const q of [A3, B3]) {
        q.fig.lookAt = null;
        this.go(q, q.pos.x - fx * 70 - rx * 1.5, q.pos.z - fz * 70 - rz * 1.5, 1.3);
      }
      yield 0.35;
    }
    // ---- 7. from high over the pier: him stood in the middle of it, turned after them - and all of them going by, not one
    // looking up at where it was. Her, come up beside him
    {
      P.yaw = toS + Math.PI * 0.85;
      P.fig.yaw = P.yaw;
      P.fig.lookAt = v3(P.pos.x - fx * 8, 1.5, P.pos.z - fz * 8);
      P.fig.say = null;
      this.feel(P.fig, 'scared', 6);
      this.shot({ from: v3(P.pos.x + fx * 5.2 + rx * 1.5, gy + 4.9, P.pos.z + fz * 5.2 + rz * 1.5), to: v3(P.pos.x + fx * 6.4 + rx * 1.8, gy + 6.0, P.pos.z + fz * 6.4 + rz * 1.8), look: v3(P.pos.x - fx * 0.6, gy + 1.0, P.pos.z - fz * 0.6), fov: 38, dur: 2.6, ease: 'lin', hand: 0.3, roll: -0.04 });
      yield 0.5;
      this.thought('זה לא יכול להיות.', 1.7);
      yield 1.9;
    }
    // (the world back, loud, at once - he shouts at the two at the railing: scene 4)
    if (g.audio.muffle) {
      g.audio.muffle(false);
      this.muffled = false;
    }
    if (this.comic) this.comic.pu = null;
    this.acting.stop(P.fig);
    for (const [q, key] of all) {
      if (q.fig) q.fig.lookAt = null;
      this.letGo(q, key);
    }
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
    const mk = (key, look, lx, lz, wave, scale = 1) => {
      const c = this.person(key, VIEW.x, VIEW.z, look, { face, fig: scale !== 1 ? { scale } : null });
      c.riding = true;
      c.noCollide = true;
      c.fig.ones = true;
      c.pl.ride = 'wheel';
      c.hero = { gi, lx, lz, wave, ph: Math.random() * 6 };
      this.feel(c.fig, 'joy', 60);
      return c;
    };
    // (the two kids at the sill; their parent no longer beside them - from the camera's side his back
    // filled half the picture)
    // (each in the middle of a pane - the window's bars are at +-0.5 across it, set.js gondolaParts:
    // stood behind one, a bar ran down the middle of the face)
    // (round 23, the review: the boy who shouts down to his mother a boy - the city's drawn "kid" read
    // as a grown man at the lens's closeness: a child's build, big head, round face, and smaller)
    // (round 25, the player's word: they were simple shapes, a doll's - now two of the city's drawn
    // people, children: Theo and Maya, render/folkspec.js WHEEL_KIDS - game/prologue/cast.js)
    const theo = this.castMod && this.castMod.wheelKidLook ? this.castMod.wheelKidLook(0) : null;
    const maya = this.castMod && this.castMod.wheelKidLook ? this.castMod.wheelKidLook(1) : null;
    if (theo && maya) {
      this.heroes = [mk('hk1', theo, -1.0, 0.0, 1), mk('hk2', maya, -1.0, 0.95, 1)];
      return;
    }
    const boy = civilianLook({ fem: false, kind: 'casual', build: 'chibi', pen: 'fineliner' });
    boy.face.beard = null;
    boy.face.lips = null;
    boy.face.eyes = 'oval';
    boy.face.mouth = 'smile';
    boy.top = { kind: 'tee', color: [0.95, 0.5, 0.18], sleeves: 'short' };
    boy.hat = null;
    boy.acc = [];
    this.heroes = [mk('hk1', boy, -1.0, 0.0, 1, 0.82), mk('hk2', kidLook(true), -1.0, 0.95, 1)];
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
    // (ROADMAP 23.9, the owner's word: the film's people fixed, "not somebody else every time it is played" - the two at the
    // railing and the man he asks were whoever the city dealt)
    const g1 = this.person('g1', GUYS[0].x, GUYS[0].z, folkLook(this.folkNth(false, 4)), { face: 0.2 });
    const g2 = this.person('g2', GUYS[1].x, GUYS[1].z, folkLook(this.folkNth(false, 5)), { face: 0.4 });
    const m = this.person('man', MAN.x, MAN.z, folkLook(this.folkNth(false, 6)), { face: 1.6 });
    for (const c of [g1, g2, m]) {
      c.pl.face = Math.atan2(WHEEL.x - c.pos.x, WHEEL.z - c.pos.z);
      c.fig.lookAt = v3(WHEEL.x, 26, WHEEL.z);
    }
    // (people out for the evening, as they are: one with his phone, the other his coffee - ROADMAP 18.9)
    g2.fig.reachR = null;
    // (round 15, the player's word: nothing in their hands - the coffee cup sank into the hand that held
    // it, and the phone with it)
    g2.fig.carry = null;
    g1.fig.carry = null;
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
    // (ROADMAP 18.9) nobody remembers it - the evening's air as it always is, the picture a little off
    // true; round 16, the player's word: not the calm tune here - the thriller's piece goes on
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
    // (round 23, the review: the passers-by off the set - SITE to the guys, and where Lily stands -
    // shot clears it on every cut)
    this.setZone = { x: GUYS[0].x - 0.9, z: GUYS[0].z + 2.4, r: 6.5 };
    this.faceTo(g1, P.pos.x, P.pos.z);
    g1.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    g2.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    // (ROADMAP 23.12: two men at a railing of an evening, not two posts - the one he talks to with his weight back off him,
    // the other half turned away, a shoulder to it all)
    this.pose(g1.fig, { fLean: -0.07, fSide: 0.03 }, 0.01);
    this.pose(g2.fig, { fLean: -0.03, fTwist: 0.34, fSide: -0.04 }, 0.01);
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
    // (round 23, the review: over his shoulder, his pointing arm in the picture - the sky alone, with a
    // lamp in it, did not say where the wheel had stood)
    {
      const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const dx = WHEEL.x - h.x;
      const dz = WHEEL.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d;
      const uz = dz / d;
      // (behind him, over his right shoulder - his right arm the one pointing)
      const fr = v3(h.x - ux * 0.75 - uz * 0.32, h.y + 0.12, h.z - uz * 0.75 + ux * 0.32);
      this.shot({ from: fr, to: fr.clone().add(v3(-ux * 0.12, 0.02, -uz * 0.12)), look: [WHEEL.x, 5.5, WHEEL.z], lookTo: [WHEEL.x, 9, WHEEL.z], fov: 50, dur: 2.2, hand: 0.4, roll: 0.04 });
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
      this.faceTo(g1, P.pos.x, P.pos.z);
      this.faceTo(g2, P.pos.x, P.pos.z);
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
    this.faceTo(M, WHEEL.x, WHEEL.z);
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
      this.emote([0.5, 0.07, 0.09], 0.8);
      this.sample('sfx/sting.mp3', 0.55);
      if (this.comic && this.comic.pulse) this.comic.pulse(3, { per: 0.85, k: 0.8, vol: 0.75 });
    }
    // (ROADMAP 23.18: and the man goes on his way, off towards the town - his line said, while the picture is still on Danny's
    // face: by the time the camera comes round the front of Danny he is a back going away past him. He stood on where he had
    // answered, between Danny and the lens: the side of his head across the bottom of the picture, the thought's words over
    // his face)
    {
      const all = Math.max(2.6, m01w - 0.9);
      const said = Math.min(all, Math.max(0.6, m01w - 0.9));
      yield said;
      M.fig.lookAt = null;
      this.go(M, MAN.x - 36, MAN.z - 2.2, 1.45);
      yield Math.max(1.3, all - said);
    }
    this.emote(null);
    // all round him, the evening as it was: nobody saw anything (round 13: and in his head)
    this.feel(P.fig, 'scared', 4);
    this.thought('אני משתגע?', 2.2);
    // (round 23, the review: round the front of him, his face in it the whole way, ending on it - the
    // circle went round behind him, and ended on the crowd from above)
    {
      const fy = P.yaw;
      const at = (a, r, y) => v3(P.pos.x + Math.sin(fy + a) * r, (P.pos.y || 0) + y, P.pos.z + Math.cos(fy + a) * r);
      this.shot({ path: [at(0.85, 2.4, 2.05), at(0.3, 2.1, 1.95), at(-0.25, 1.8, 1.85)], look: () => { const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z); return v3(h.x, h.y - 0.12, h.z); }, fov: 40, dur: 4, ease: 'inout', hand: 0.5, roll: 0.09 });
    }
    yield 3.8;
    for (const c of [g1, g2, M]) c.fig.lookAt = null;
    // back to her (where she stands, by where it was)
    this.putDanny(L.pos.x + 1.3, L.pos.z + 0.5, Math.atan2(-1.3, -0.5));
    // (ROADMAP 23.18: the two of them alone with it - the city's people off this part of the pier (setZone), and the evening's
    // own strollers, the film's, put on along it on this cut: a pair of them walked through between the two of them and the
    // lens as he took her hands on the page)
    this.setZone = { x: L.pos.x, z: L.pos.z, r: 9 };
    for (const key of Object.keys(this.cast)) {
      if (!/^(eve|ask|crowd)\d/.test(key)) continue;
      const c = this.cast[key];
      if (!c || !c.pos || !c.pl || Math.hypot(c.pos.x - L.pos.x, c.pos.z - L.pos.z) > 11) continue;
      // (towards the town, where they were going: 14 to 22 m on, at the pier's sides)
      const on = 14 + ((key.charCodeAt(key.length - 1) * 37) % 9);
      const dx = (c.pl.x || c.pos.x) - c.pos.x;
      const dz = (c.pl.z || c.pos.z) - c.pos.z;
      const sp = c.pl.speed;
      this.put(c, L.pos.x - on, c.pos.z, null);
      c.pl.x = c.pos.x + dx;
      c.pl.z = c.pos.z + dz;
      c.pl.speed = sp;
    }
    this.faceTo(L, P.pos.x, P.pos.z);
    L.yaw = L.pl.face;
    L.fig.lookAt = P.fig.j ? P.fig.j.headC : null;
    // (round 23, the review: from her other side - the railing no longer across her, the set cleared of
    // the people at its edge)
    this.shot({ ...this.single(L, P, { dist: 1.05, side: -0.46, up: -0.04, drop: 0.07 }), fov: 34, dur: 3, hand: 0.4 });
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
    // (round 23, the review: the story's own picture of it - over her shoulder, from above her head,
    // the page whole and sharp in front, her drawn wheel in it; the empty evening where it stood behind
    // it, soft. Held; then the lens lets the page go soft and the empty sky comes sharp: in her drawing
    // it is there, out there it is not. One shot - before, two, from behind her head, the page small,
    // then cut off by the tilt up)
    {
      // (where the page will be held, worked out from where she stands and faces - the page itself is
      // put there on the next frame; its last place was another scene's)
      const fr = this.ots(L, { pos: v3(WHEEL.x, 0, WHEEL.z) }, { h: 1.42, back: 0.95, side: 0.4 })();
      const dx = WHEEL.x - L.pos.x;
      const dz = WHEEL.z - L.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d;
      const uz = dz / d;
      const paEst = v3(L.pos.x + ux * 0.42, (L.pos.y || 0) + 1.4, L.pos.z + uz * 0.42);
      const pa = () => (page.at && page.at.distanceTo(paEst) < 0.8 ? page.at : paEst);
      const near = fr.distanceTo(paEst);
      this.shot({ from: fr, to: fr.clone().lerp(paEst, 0.06), look: () => { const q = pa(); return v3(q.x + ux * 2.2, q.y + 0.3, q.z + uz * 2.2); }, fov: 44, dur: 4.4, ease: 'soft', hand: 0.2, focus: [near, 40], focusDur: 4.2, dof: 1 });
    }
    // (round 10: in it, it is still there - the drawing lit; round 13: against the evening's own sky,
    // not a field of gold - the gold field is laid over all but the people, and the page went under it:
    // in no picture of it was the drawing ever seen)
    // (ROADMAP 23.12: no gold flash over it - the picture says it: her wheel on the page, the empty sky behind it)
    yield 2.4;
    // past it: nothing
    L.fig.lookAt = v3(WHEEL.x, 24, WHEEL.z);
    yield 1.8;
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
    // (round 23, the review: past his shoulder, the edge of his head dark at the side of the picture -
    // him looking at it, not a sky anywhere; a little shorter)
    {
      const h = this.headJ(P) || v3(P.pos.x, 1.7, P.pos.z);
      const dx = WHEEL.x - h.x;
      const dz = WHEEL.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d;
      const uz = dz / d;
      const fr = v3(h.x - ux * 0.62 + uz * 0.3, h.y + 0.06, h.z - uz * 0.62 - ux * 0.3);
      this.shot({ from: fr, to: fr.clone().add(v3(ux * 0.1, 0.01, uz * 0.1)), look: [WHEEL.x, 6, WHEEL.z], lookTo: [WHEEL.x, 8.5, WHEEL.z], fov: 44, dur: 2.9, hand: 0.2 });
    }
    // (round 16: no waltz remembered over it - the thriller's piece alone)
    // (round 13: and in his head the picture of it, coming up over the empty sky and going)
    yield 0.5;
    this.memoryFlash(true);
    yield 2.3;
    // he swallows; back at her
    this.shot({ ...this.single(P, L, { dist: 1.35, side: -0.34, up: -0.22, drop: 0.11 }), fov: 30, dur: 2.4, hand: 0.25 });
    this.feel(P.fig, 'sad', 8);
    yield 2.3;
    // (round 23, the review: no longer nine seconds of one picture from behind them for the whole of
    // it - the two of them, the camera coming in as he answers and takes her hands on the page; then
    // her "why?" on her face, his on his - the thought over him - and the two of them as they go)
    {
      const a = this.ots(L, P, { back: 2.6, side: 1.6, h: 1.35 })();
      const b = this.ots(L, P, { back: 1.85, side: 1.2, h: 1.3 })();
      this.shot({ from: a, to: b, look: v3((L.pos.x + P.pos.x) / 2, 1.2, (L.pos.z + P.pos.z) / 2), fov: 40, dur: 4.6, ease: 'inout', hand: 0.35 });
    }
    yield* this.say('D12', P.fig, 0.6);
    // his hands over hers, on the page: keep it
    // (ROADMAP 23.12: a hand to each side of the page she holds to her - on hers; both hands went to one point in the middle
    // of it, wrists crossed)
    {
      const dx = L.pos.x - P.pos.x;
      const dz = L.pos.z - P.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const sx = -dz / d;
      const sz = dx / d;
      const sideOf = (k) => () => v3(page.at.x + sx * 0.12 * k - (dx / d) * 0.05, page.at.y - 0.02, page.at.z + sz * 0.12 * k - (dz / d) * 0.05);
      // (ROADMAP 23.18: (sx, sz) is his RIGHT - up x ahead is a body's left. His right hand had the left side and his left the
      // right: wrists crossed again. Each hand to its own side, its palm in towards the page)
      this.hold(P.fig, 'L', sideOf(-1), { palm: v3(sx * 0.8 + dx / d * 0.4, -0.2, sz * 0.8 + dz / d * 0.4), fingers: v3(dx / d * 0.8, -0.35, dz / d * 0.8), ease: 0.35 });
      this.hold(P.fig, 'R', sideOf(1), { palm: v3(-sx * 0.8 + dx / d * 0.4, -0.2, -sz * 0.8 + dz / d * 0.4), fingers: v3(dx / d * 0.8, -0.35, dz / d * 0.8), ease: 0.35 });
    }
    yield 0.6;
    yield* this.say('D13', P.fig, 0.4);
    L.fig.lookAt = P.fig.j.headC;
    this.shot({ ...this.single(L, P, { dist: 1.0, side: 0.4, up: -0.04, drop: 0.07 }), fov: 32, dur: 1.6, hand: 0.25 });
    yield* this.say('L11', L.fig, 0.2);
    // (round 13: what he does not say to her - in his head)
    this.shot({ ...this.single(P, L, { dist: 1.3, side: -0.36, up: -0.18, drop: 0.11 }), fov: 30, dur: 3.2, hand: 0.25, fill: 1.1 });
    this.thought('כי זו ההוכחה היחידה שהוא היה.', 2.4);
    yield 1.3;
    yield* this.say('D14', P.fig, 0.6);
    this.unhold(P.fig, null, 0.3);
    // his hand out to hers
    P.fig.reachL = L.fig.j ? L.fig.j.handR || null : null;
    {
      const t2 = this.two(P, L, { dist: 2.6, h: 1.25, lookH: 1.25 });
      this.shot({ from: t2.from(), to: t2.from(0.2), look: t2.look(), fov: 42, dur: 2.4, hand: 0.35 });
    }
    yield* this.say('D15', P.fig, 0.4);
    P.fig.reachL = null;
    page.release();
    P.fig.lookAt = null;
    L.fig.lookAt = null;
    L.pl.follow = true;
    // (round 22, the player's word: his car not far off, and plain where it is - a cut on, the two of
    // them coming off the pier, and over their shoulders across the park his car at the curb, the arrow
    // over it)
    const car = this.parkPierCar();
    this.putDanny(PIER_OFF.x, PIER_OFF.z + 0.55, -Math.PI / 2);
    this.put(L, PIER_OFF.x + 0.4, PIER_OFF.z - 0.75, -Math.PI / 2);
    this.beacon(car.pos.x, car.pos.z, 3.1, 2.9);
    // (the arrow over it seen in the film too, these two shots)
    this.beaconR.film = true;
    this.objective('Get to your <b>car</b>', car.pos.x, car.pos.z, 'Car');
    // over their shoulders, high enough to see over the park's hedges: the road across the park, the
    // arrow over the car
    this.shot({ from: v3(PIER_OFF.x + 4.4, 4.2, PIER_OFF.z + 2.0), to: v3(PIER_OFF.x + 3.8, 4.0, PIER_OFF.z + 1.7), look: v3(car.pos.x, 1.0, car.pos.z), fov: 24, dur: 2.0, hand: 0.25 });
    yield 1.9;
    // the car itself, from the lane it is parked in, in front of it (not the sidewalk: its palms in the
    // way): the red one, at the curb, the arrow bobbing over it
    this.shot({ from: v3(car.pos.x - 1.4, 2.3, car.pos.z + 10.0), to: v3(car.pos.x - 1.2, 2.2, car.pos.z + 9.2), look: v3(car.pos.x + 0.1, 1.45, car.pos.z + 0.3), fov: 38, dur: 2.2, hand: 0.2 });
    yield 2.1;
    if (this.beaconR) this.beaconR.film = false;
    this.film(false);
    // (behind him, looking the way he is to go)
    g.camRig.yaw = -Math.PI / 2;
    // (round 16: the thriller's piece with them on the way, to the car)
    this.hour(18.42, 0.0035);
    this.howto('tocar', 9);
    this.start(5);
  }

  // (ROADMAP 18.9) the man with the mark on his shirt: along the pier ahead of them, crossing it
  // slowly towards the wheel's gate (the mark: game/prologue/set.js markShirt)
  markMan() {
    if (this.cast.mark) return this.cast.mark;
    const toW = Math.atan2(WHEEL.x - VIEW.x, WHEEL.z - VIEW.z);
    const ux = Math.sin(toW);
    const uz = Math.cos(toW);
    const x = VIEW.x + ux * 14 - uz * 2.5;
    const z = VIEW.z + uz * 14 + ux * 2.5;
    // (ROADMAP 18.9: a face of his own, nobody else's in the city - render/folkspec.js 'marked')
    const c = this.person('mark', x, z, roleLook('marked') || civilianLook({ fem: false, kind: 'casual' }), { face: Math.atan2(-ux, -uz) });
    // (ROADMAP 23.11, the owner's word: "no eraser's mark on his shirt - it gives it away. Only a man a little out of place, with
    // a plainly odd look when Danny looks at him": nothing on his chest now. What he is, is his own - grey hair combed back over
    // a long pale face, all in black among an evening's holiday colours - and that he stands still where everybody walks)
    c.fig.portraitPx = 60;
    return c;
  }

  // (ROADMAP 23.11, the owner's word: the film's people "fixed - not somebody else every time") the pier's evening crowd, the
  // same people every time: the city's drawn people this computer made, but for the ones already about the stand and the pier's
  // end, with the children, a courier, a busker, a painter and the shops' people off work among them
  crowdLooks() {
    const used = new Set();
    for (let n = 0; n < 4; n++) used.add(this.folkNth(true, n));
    for (let n = 0; n < 7; n++) used.add(this.folkNth(false, n));
    const out = [];
    for (let k = 6; k < FOLK_ON.n && k < FOLK.length; k++) {
      const F = FOLK[k];
      if (!F || used.has(k)) continue;
      if (F.role ? ['kid', 'courier', 'busker', 'painter', 'staff'].includes(F.role) : F.age >= 16) out.push(k);
    }
    return out;
  }

  // (round 13) the evening's crowd along the pier, made beyond him towards the wheel's gate - out of
  // the camera's sight, it on Danny's face - walking this way, the pier's whole width of them, at
  // their own paces, some in twos
  crowdAhead(man) {
    const g = this.game;
    // (the player's word: a very big crowd - drawn in full only as near as the city's own people are,
    // not as far as the story's: fig.lodFar)
    // (ROADMAP 23.11: the same people in the same places every time - a rule's numbers, not the dice; thicker, going both ways
    // along the pier, and here and there three of them stood talking: what a man can be lost behind)
    const ks = this.crowdLooks();
    const n = Math.min(g.touch ? 28 : 38, Math.max(12, ks.length));
    const list = [];
    let seed = 7;
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rnd = (a, b) => a + R() * (b - a);
    // (dealt out so that no two alike are side by side)
    const order = ks.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const knots = [[man.pos.x + 8.5, 246.3], [man.pos.x + 15.5, 240.2], [man.pos.x + 23, 245.6]];
    for (let i = 0; i < n; i++) {
      const k = order[i % order.length];
      const kn = i < 9 ? knots[Math.floor(i / 3)] : null;
      // (a knot: three stood in a ring, facing its middle; the rest strung along the pier from behind him to the wheel's gate)
      const x = kn ? kn[0] + Math.cos((i % 3) * 2.1) * 0.75 : man.pos.x + rnd(-5, 31);
      const z = kn ? kn[1] + Math.sin((i % 3) * 2.1) * 0.75 : rnd(238.8, 247.6);
      if (!kn && Math.hypot(x - man.pos.x, z - man.pos.z) < 1.6) continue;
      const q = this.person('crowd' + i, x, z, folkLook(k), { face: kn ? Math.atan2(kn[0] - x, kn[1] - z) : -Math.PI / 2 });
      q.noCollide = true;
      // (drawn in full as far as the story's people are while the film's long lens is on them - as plain far-off shapes they were
      // white dolls across the picture; once the player has him, a phone's as near only as the city's own: loseInCrowd)
      if (q.fig) q.fig.lodFar = 85;
      if (kn) q.knot = kn;
      else if (R() < 0.7) {
        // (on along the pier, past the railing and its gate and off it, spreading out onto the
        // promenade - back to the town; a little across as they go)
        this.go(q, rnd(26, 36), z + rnd(-7, 4), rnd(1.05, 1.45));
      } else this.go(q, 118, Math.max(239, Math.min(247.4, z + rnd(-2, 2))), rnd(0.95, 1.3));
      list.push(q);
    }
    return list;
  }

  // (round 13, the player's word) lost in the crowd: he walks on along the pier - forward, into the
  // people coming the other way, this way and that between them, quicker now; and the moment one of
  // them is between him and the camera, deep enough in them, he is not there any more (or at the
  // latest, where nobody is looking). They walk on past, and are let go of further along
  *loseInCrowd(c, crowd) {
    // (ROADMAP 23.11, the owner's word: "he should really run among the people, and be hard for the player to find: at first the
    // player sees him, but very quickly he is gone among them all, running; and if the player comes really close, he goes in
    // between a few people and is truly gone". He walks off, fast - and runs: from side to side of the pier behind whoever is
    // ahead of him, heads turning after him. Hidden from the picture by somebody and far enough off, he is out of sight for a
    // breath or two and seen again further on, between people, twice or three times; near the end of the pier, or with Danny
    // on his heels, he goes behind the nearest of them - and does not come out)
    const g = this.game;
    const cam = g.camera;
    const P = g.player;
    const alive = () => crowd.filter((q) => q.alive);
    let t = 0;
    let shown = true;
    let hideT = 0;
    let glimpses = 0;
    let duck = null;
    const tc = new THREE.Vector3();
    const tq = new THREE.Vector3();
    const seen = () => {
      tq.set(c.pos.x, c.pos.y + 1.2, c.pos.z).project(cam);
      return tq.z < 1 && Math.abs(tq.x) < 1.05 && Math.abs(tq.y) < 1.05;
    };
    // (somebody between him and the camera)
    const hidden = () => {
      tc.set(c.pos.x, c.pos.y + 1.25, c.pos.z).sub(cam.position);
      const dc = tc.length();
      tc.normalize();
      for (const q of crowd) {
        if (!q.alive) continue;
        tq.set(q.pos.x, q.pos.y + 1.15, q.pos.z).sub(cam.position);
        const dq = tq.length();
        if (dq < dc - 0.4 && tq.normalize().dot(tc) > Math.cos(0.07)) return true;
      }
      return false;
    };
    // (his next few steps: behind whoever is ahead of him and to the other side - or, nobody there, across the pier)
    let side = 1;
    const next = () => {
      let best = null;
      for (const q of alive()) {
        const dx = q.pos.x - c.pos.x;
        if (dx < 2.5 || dx > 8 || (q.pos.z - 243) * side < 0) continue;
        if (!best || dx < best.pos.x - c.pos.x) best = q;
      }
      side = -side;
      if (best) return [best.pos.x + 1.1, Math.max(239.2, Math.min(247.2, best.pos.z + (best.pos.z > 243 ? 0.5 : -0.5)))];
      return [c.pos.x + 5, side > 0 ? 246.2 : 239.8];
    };
    let wp = [c.pos.x + 4.5, 244.6];
    this.go(c, wp[0], wp[1], 2.2);
    if (g.touch) for (const q of crowd) if (q.fig) q.fig.lodFar = 0;
    const END = 110;
    while (t < 22) {
      const dt = this.dtR || 1 / 30;
      const dP = Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
      const run = t > 1.1 ? (dP < 9 ? 5.2 : 4.4) : 2.2;
      const hid = hidden();
      if (duck) {
        // (behind them: gone the moment they are between him and whoever looks)
        this.go(c, duck[0], duck[1], 3.6);
        if (hid || !seen() || (duck.t += dt) > 1.6) break;
      } else {
        if (Math.hypot(c.pos.x - wp[0], c.pos.z - wp[1]) < 1.1) wp = next();
        this.go(c, wp[0], wp[1], run);
        // (heads turn after a man running through them)
        for (const q of crowd) {
          if (!q.alive || !q.fig) continue;
          const d = Math.hypot(q.pos.x - c.pos.x, q.pos.z - c.pos.z);
          if (shown && d < 2.4 && !(q.turnT > 0)) {
            q.turnT = 1.5;
            q.fig.lookAt = c.fig.j.headC;
            q.fig.feel = { mood: 'surprised', until: g.time + 0.9 };
          } else if (q.turnT > 0 && (q.turnT -= dt) <= 0) q.fig.lookAt = null;
        }
        // (Danny on his heels, or the pier's end: in behind the nearest of them, away from the camera)
        if ((t > 2.2 && dP < 3.4) || c.pos.x > END || t > 17 || glimpses >= 3) {
          let near = null;
          let nd = 1e9;
          for (const q of alive()) {
            const d = Math.hypot(q.pos.x - c.pos.x, q.pos.z - c.pos.z);
            if (d < nd && d > 0.4) {
              nd = d;
              near = q;
            }
          }
          if (near) {
            const ax = near.pos.x - cam.position.x;
            const az = near.pos.z - cam.position.z;
            const al = Math.hypot(ax, az) || 1;
            duck = [near.pos.x + (ax / al) * 0.9, near.pos.z + (az / al) * 0.9];
            duck.t = 0;
          } else break;
        } else if (shown && hid && dP > 9 && t > 2.4) {
          // (out of sight behind somebody, far enough: not there for a breath or two)
          shown = false;
          hideT = 1.5 + ((glimpses * 0.37) % 1) * 0.9;
          c.fig.setVisible(false);
        } else if (!shown && (hideT -= dt) <= 0 && (hid || !seen())) {
          // (and there again, further on, between them)
          shown = true;
          glimpses++;
          c.fig.setVisible(true);
        }
      }
      yield 0.001;
      t += dt;
    }
    for (const q of crowd) if (q.alive && q.fig && q.turnT > 0) q.fig.lookAt = null;
    g.civilians.remove(c);
    delete this.cast.mark;
    // (the knots break up and go their ways; all of them walk on, and each is let go of once off the camera's picture and well
    // away - not before: twenty-six seconds after, they were gone from beside Lily's bench in front of him)
    crowd.forEach((q, i) => {
      if (q.alive && q.knot) this.go(q, i % 2 ? 30 : 118, q.pos.z, 1.15);
      this.letGo(q, 'crowd' + i);
    });
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
    // (round 22: his car at the curb by the pier - made first, so that the car park's bay stays empty)
    const own = this.parkPierCar();
    this.spawnThugs();
    // (round 18, the player's word: 'Get to your car' - his own, and no other on the way)
    this.carOnly = own;
    // (round 22, the player's word: the car close by and plain where; in it, Lily beside him, and driven
    // to the car park on 5th Street - where the men looking for him are)
    if (P.inVehicle !== own) {
      if (!this.beaconR) this.beacon(own.pos.x, own.pos.z, 3.1, 2.9);
      yield () => P.inVehicle === own;
    }
    this.unbeacon();
    // (round 23, the review: the walk-to-the-car card gone once he is in it - it stayed up the whole
    // drive)
    this.howTok = (this.howTok || 0) + 1;
    this.ui.card(null);
    L.pl.follow = false;
    L.pl.ride = own;
    g.audio.play('click', 0.35);
    this.objective('Drive to the <b>car park</b> on 5th Street', GARAGE_IN.x, GARAGE_IN.z, 'Car park');
    // the phone, on the way
    {
      let t = 0;
      yield () => {
        t += this.dtR;
        return t > 3.2 || this.dist(GARAGE_IN.x, GARAGE_IN.z) < 120;
      };
    }
    this.phoneRing(true);
    yield 2.4;
    this.phoneRing(false);
    this.ui.call('live', lang() === 'en' ? 'BENNY' : 'בני');
    // (the phone out of his pocket and to his ear - round 22: at the wheel, driving on)
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
    this.thought('לא עכשיו. לא כשהיא איתי.', 2.4);
    // the garage's door on 5th Street: the dark car at the curb, the two men by it - the same two from
    // here to the end: the one who talks (t1), the one beside him (t2)
    yield () => this.dist(GARAGE_IN.x, GARAGE_IN.z) < 24 || this.dist(THUGS[0].x, THUGS[0].z) < 22;
    // (round 23, the review: his thought gone before the film takes up - it went on over its first
    // picture, the men's backs and the street)
    yield () => !(this.thoughts && this.thoughts.length);
    // (ROADMAP 23.18: in the new look the film is inside the car park - s5Inside)
    if (this.thugsInside) {
      yield* this.s5Inside(own);
      return;
    }
    // (round 18: whatever he came in, he meets them on his feet. Round 22: he has driven here - the car
    // left in its bay inside, the two of them come out of the car park's door onto the sidewalk, and
    // the men are there)
    this.outOfCar();
    this.lilyOut();
    own.pos.set(DANNY_CAR.x, DANNY_CAR.y, DANNY_CAR.z);
    own.yaw = DANNY_CAR.yaw;
    own.vx = own.vz = own.vy = 0;
    own.speed = 0;
    own.air = false;
    own.hp = own.maxHp;
    own.keepAlive = null;
    const t1 = this.cast.t1;
    const t2 = this.cast.t2;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    // (round 16: the thriller's piece ends here, at the car)
    this.cue('stop', { fade: 2.5 });
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
    // (round 23, the review: the city's passers-by off the sidewalk between them - one in a builder's
    // hard hat, with a lamp, stood among the two men and was one of them)
    this.setZone = { x: (D.x + T.x) / 2, z: (D.z + T.z) / 2, r: tl / 2 + 7 };
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
    // (round 23, the review: on a longer lens - the two of them at the door were specks; and the men
    // come right up to him, five metres off, to say it: from twelve, in the picture over his shoulder
    // they were small down the sidewalk while their close-ups had them on him)
    this.shot({ from: () => v3(t1.pos.x + ux * 2.2 - uz * 1.1, 1.75, t1.pos.z + uz * 2.2 + ux * 1.1), look: () => v3(P.pos.x, 1.3, P.pos.z), fov: 27, dur: 2.2, hand: 0.5 });
    this.go(t1, D.x + ux * 5.0, D.z + uz * 5.0, 1.35);
    this.go(t2, S2.x - ux * (tl - 5.9), S2.z - uz * (tl - 5.9), 1.35);
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
    yield* this.freezeCard({ name: 'VINCE & BRUNO', tag: 'they want something back', col: '#d23a32', at: () => this.headJ(t1), lead: true });
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
    this.shot({ from: () => v3(P.pos.x - ux * 2.6 + uz * 0.9, 1.7, P.pos.z - uz * 2.6 - ux * 0.9), look: () => v3(t1.pos.x, 1.35, t1.pos.z), fov: 38, dur: 2.6, hand: 0.5 });
    yield* this.say('D18', P.fig, 0.3);
    this.shot({ ...this.single(t1, P, { dist: 1.6, side: -0.42, up: -0.15, drop: 0.14 }), fov: 34, dur: 3.2, hand: 0.5 });
    yield* this.say('T02', t1.fig, 0.25);
    // (round 23, the review: her, once - behind him, looking past his arm at them)
    this.shot({ ...this.single(L, t1, { dist: 0.9, side: 0.5, up: 0.02, drop: 0.06 }), fov: 30, dur: 1.3, hand: 0.45, dof: 1 });
    yield 1.15;
    // (Danny, Lily at his back behind his shoulder)
    this.shot({ ...this.single(P, t1, { dist: 1.75, side: 0.5, up: -0.28, drop: 0.16 }), fov: 36, dur: 3, hand: 0.5 });
    yield* this.say('D19', P.fig, 0.25);
    // the other one moves out to the side - slowly, his hand inside his jacket (towards the curb: the
    // building's face is on the other side)
    this.go(t2, t2.pos.x + uz * 1.4 - ux * 0.3, t2.pos.z - ux * 1.4 - uz * 0.3, 0.8);
    this.shot({ from: () => v3(P.pos.x - ux * 1.6 + uz * 1.2, 1.5, P.pos.z - uz * 1.6 - ux * 1.2), look: () => v3((t1.pos.x + t2.pos.x) / 2, 1.4, (t1.pos.z + t2.pos.z) / 2), fov: 30, dur: 3.4, hand: 0.6 });
    // (round 23, the review: the threat said on his face, from below - it was said over the wide, no
    // face in it; the wide first, the other one going out to the side)
    yield 1.3;
    this.shot({ ...this.single(t1, P, { dist: 1.35, side: -0.36, up: -0.34, drop: 0.08 }), fov: 32, dur: 2.6, hand: 0.45, fill: 1.1 });
    yield* this.say('T03', t1.fig, 0.25);
    // (round 9: the stand-off, as a western has it and an anime cuts it - his eyes, theirs, close and
    // still, the sound of the street gone under it; then the guns)
    {
      const eyes = (who, at, side) => {
        const h = this.headJ(who) || v3(who.pos.x, 1.6, who.pos.z);
        const dx = at.pos.x - who.pos.x;
        const dz = at.pos.z - who.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        // (round 11: a little further off and lower - at 0.55 m and the head's middle the strips held
        // hair, or nothing)
        return { from: v3(h.x + (dx / d) * 0.72 + (-dz / d) * side, h.y - 0.01, h.z + (dz / d) * 0.72 + (dx / d) * side), look: v3(h.x, h.y - 0.02, h.z) };
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
        this.shot({ from: E[i].from, to: E[i].from.clone().lerp(E[i].look, 0.08), look: E[i].look, fov: 24, dur: 0.8, hand: 0.1, dof: 1 });
        // (his eyes lower in the picture than theirs: he is the taller, his head's middle higher over them)
        if (C5 && C5.panel) C5.panel(i, { u: 0.5, v: i === 0 ? 0.62 : 0.5, zoom: 2.3 });
        g.audio.play('heartbeat', 0.55);
        yield i < 2 ? 0.62 : 0.8;
      }
      if (C5 && C5.endPage) C5.endPage(0.08);
      this.airDip = 1;
    }
    // wrong answer: the guns - from low beside the line of his arm, the gun big in the picture, his face
    // over it (a kick as they come up)
    // (round 23, the review: from his other side, nearer and lower - the gun and the hand on it clear,
    // where a striped post stood in the middle of the picture)
    this.shot({ from: () => v3(t1.pos.x - ux * 1.7 - uz * 0.85, 1.08, t1.pos.z - uz * 1.7 + ux * 0.85), look: () => { const h = this.headJ(t1) || v3(t1.pos.x, 1.6, t1.pos.z); return v3(h.x - ux * 0.45, h.y - 0.36, h.z - uz * 0.45); }, fov: 38, dur: 2.0, hand: 0.6, shake: 0.08, roll: 0.05 });
    this.armThug(t1, P);
    g.audio.play('click', 0.6);
    this.flash(0.12, '#ffffff');
    this.comic.impact(this.headJ(t1) || t1.pos, 0.1);
    yield 0.2;
    yield* this.say('T05', t1.fig, 0.05);
    this.armThug(t2, P);
    // him: the car, now
    this.shot({ ...this.single(P, t1, { dist: 1.5, side: 0.4, up: -0.15, drop: 0.12 }), fov: 36, dur: 1.6, hand: 0.8, roll: -0.06 });
    this.feel(P.fig, 'scared', 3);
    this.emote([0.5, 0.06, 0.08]);
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
    const inside = v3(run[1][0] - 1.4, 1.25, run[1][1] - 6.5);
    this.walkTo = { x: run[1][0], z: run[1][1], speed: 1, sprint: true };
    this.shot({ from: inside, to: v3(inside.x, 1.2, inside.z - 0.6), look: () => v3((P.pos.x + L.pos.x) / 2, 1.15, (P.pos.z + L.pos.z) / 2), fov: 42, dur: 1.8, hand: 1, step: 12 });
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
    // (and his feet off the pedal: the run's forward push must not carry into the car)
    this.auto = null;
    this.lilyRun = null;
    // in, and the engine
    this.carOnly = null;
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
      this.shot({ from: v3(v.pos.x - 3.4, 1.05, v.pos.z - 6.5), look: v3((v.pos.x + E.x) / 2, 0.95, (v.pos.z + E.z) / 2), fov: 52, dur: 2.2, hand: 1 });
    }
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
    this.howto('climb', 10);
    this.climb = true;
    this.climbI = -1;
    this.start(6);
  }

  // (ROADMAP 23.18, the owner's word: the thugs' scene far more polished) Scene 5's film, inside the car park: he drives in and
  // parks; the two of them start across the dark floor towards the way out - and down the far end of it a car's lamps come on.
  // Two men get out into their own light and come up the floor at them. The same words, in the same order; the guns, the run
  // back to his car under them, the engine. (The film as it was, out on the sidewalk: s5 below, when the new look is off.)
  *s5Inside(own) {
    const g = this.game;
    const P = g.player;
    const L = this.cast.lily;
    const t1 = this.cast.t1;
    const t2 = this.cast.t2;
    const TC = this.thugCar;
    const Y = DANNY_CAR.y;
    const E = PARK.entrance;
    this.objective(null);
    if (g.gps) g.gps.clear();
    this.film(true);
    // (round 16: the thriller's piece ends here, at the car)
    this.cue('stop', { fade: 2.5 });
    this.cue('discovery');
    this.gunsInside = true;
    this.setZone = { x: -166, z: 280, r: 32 };
    // (their car where it has been waiting, dark; the two of them in it)
    TC.pos.set(IN_PARK.car.x, Y, IN_PARK.car.z);
    TC.yaw = IN_PARK.car.yaw;
    TC.vx = TC.vz = TC.vy = 0;
    TC.speed = 0;
    // ("inside": the city's people code shows whoever is in the camera's view again every frame - game/civilians.js - and the
    // two of them stood by their car in the dark before its doors had opened)
    for (const c of [t1, t2]) {
      c.inside = true;
      c.fig.setVisible(false);
    }
    // (the four of them drawn whole from as far as this floor is long: a phone draws people further than a dozen metres as
    // plain dolls, and Danny at his car was one from across the floor)
    for (const f of [P.fig, L.fig, t1.fig, t2.fig]) f.lodFar = 85;
    // ---- 0. in from the street: his car through the way in, its lamps down the dark floor - seen from inside
    own.pos.set(E.x, Y, E.z + 4.5);
    own.yaw = Math.PI;
    own.vx = 0;
    own.vz = -5.2;
    own.vy = 0;
    own.speed = 5.2;
    own.air = false;
    own.hp = own.maxHp;
    own.keepAlive = null;
    this.lamps = [{ car: own, k: 1, want: 1 }];
    this.shot({ from: v3(E.x + 4.4, Y + 0.8, E.z - 15.5), to: v3(E.x + 4.1, Y + 0.86, E.z - 16.3), look: () => v3(own.pos.x, Y + 0.75, own.pos.z), fov: 36, dur: 2.6, hand: 0.35, key: 0, fill: 0.12 });
    g.audio.play('roar', 0.3);
    {
      let t = 0;
      yield () => {
        t += this.dtR;
        // (rolled in up the lane, slowing)
        const sp = 5.2 * Math.max(0.3, 1 - Math.max(0, t - 1.2) / 1.5);
        own.yaw = Math.PI;
        own.speed = sp;
        own.vx = 0;
        own.vz = -sp;
        return t > 2.25;
      };
    }
    // ---- 1. in his bay, the engine off: out, the doors shut; the two of them across the floor towards the way out
    this.outOfCar();
    this.lilyOut();
    own.pos.set(DANNY_CAR.x, Y, DANNY_CAR.z);
    own.yaw = DANNY_CAR.yaw;
    own.vx = own.vz = own.vy = 0;
    own.speed = 0;
    own.air = false;
    this.lamps = [];
    // (from him to them: west, down the floor)
    const D = IN_PARK.danny;
    const ux = -1;
    const uz = 0;
    const a = Math.atan2(ux, uz);
    const door = { x: own.pos.x + Math.cos(own.yaw) * 1.3, z: own.pos.z - Math.sin(own.yaw) * 1.3 };
    this.putDanny(door.x - 1.0, door.z + 0.2, a);
    this.put(L, own.pos.x - 3.2, own.pos.z - 0.3, a);
    L.pl.follow = false;
    L.fig.lookAt = null;
    P.fig.lookAt = null;
    this.feel(P.fig, 'worried', 8);
    g.audio.play('punch', 0.55);
    this.shot({ from: v3(D.x - 4.6, Y + 0.48, D.z + 2.3), to: v3(D.x - 4.2, Y + 0.52, D.z + 2.15), look: () => v3((P.pos.x + L.pos.x) / 2, Y + 0.95, (P.pos.z + L.pos.z) / 2), fov: 30, dur: 3.3, hand: 0.3, key: 0.5 });
    this.walkTo = { x: D.x, z: D.z, speed: 1 };
    this.go(L, D.x + 0.3, D.z - 0.95, 1.3);
    yield 0.35;
    g.audio.play('punch', 0.45);
    yield 2.0;
    // ---- 2. lamps: a car's, down the far end of the floor, full on the two of them
    this.lamps = [{ car: TC, k: 0, want: 1 }];
    g.audio.play('switch', 0.8);
    g.audio.play('roar', 0.28);
    this.walkTo = null;
    this.feel(P.fig, 'surprised', 2.6);
    this.feel(L.fig, 'scared', 60);
    P.fig.lookAt = v3(TC.pos.x, Y + 0.8, TC.pos.z);
    L.fig.lookAt = v3(TC.pos.x, Y + 0.8, TC.pos.z);
    // (his hand up against the light: before his brow, its palm to the lamps, the fingers up and in. His left is +z here)
    this.hold(
      P.fig,
      'R',
      () => {
        const h = this.headJ(P) || v3(P.pos.x, Y + 1.7, P.pos.z);
        return v3(h.x + ux * 0.27, h.y + 0.05, h.z - 0.07);
      },
      { palm: v3(ux, -0.1, 0), fingers: v3(0, 0.78, 0.6), ease: 0.28 },
    );
    yield 0.25;
    // (from behind the two of them, dark against it: the two lamps, and the doors)
    this.shot({ from: v3(D.x + 3.3, Y + 1.32, D.z - 0.55), to: v3(D.x + 2.9, Y + 1.32, D.z - 0.5), look: v3(TC.pos.x + 2.4, Y + 0.95, TC.pos.z + 0.3), fov: 34, dur: 3.6, hand: 0.4, key: 0, fill: 0, rim: 1, shade: [P.fig, L.fig] });
    yield 0.9;
    g.audio.play('punch', 0.6);
    for (const [c, sd] of [[t1, 1], [t2, -1]]) {
      this.put(c, TC.pos.x + 0.5, TC.pos.z + sd * 1.3, a + Math.PI);
      c.inside = false;
      c.fig.setVisible(true);
      c.downT = 0;
      c.upT = 0;
      c.fig.lookAt = P.fig.j.headC;
      // (ROADMAP 18.9: men who have come to hurt him - and their faces say so, from the first moment)
      this.feel(c.fig, 'angry', 90);
    }
    yield 0.45;
    g.audio.play('punch', 0.5);
    // (up the floor at them, heavy: the one who talks, the big one a step behind and out to his side)
    this.go(t1, D.x + ux * 5.2, D.z + 0.1, 1.15);
    this.go(t2, D.x + ux * 6.7, D.z + 1.55, 1.15);
    yield 2.0;
    this.unhold(P.fig, 'R', 0.45);
    // ---- 3. the two of them coming, from low down in front of them, their lamps behind them
    this.shot({
      from: () => v3((t1.pos.x + t2.pos.x) / 2 - ux * 3.3 + uz * 0.5, Y + 0.6, (t1.pos.z + t2.pos.z) / 2 - uz * 3.3 - 0.5),
      to: () => v3((t1.pos.x + t2.pos.x) / 2 - ux * 2.7 + uz * 0.4, Y + 0.66, (t1.pos.z + t2.pos.z) / 2 - uz * 2.7 - 0.4),
      look: () => v3(t1.pos.x * 0.6 + t2.pos.x * 0.4, Y + 1.42, t1.pos.z * 0.6 + t2.pos.z * 0.4),
      fov: 40,
      dur: 2.8,
      ease: 'lin',
      hand: 0.5,
      key: 0.3,
      rim: 1,
    });
    yield 1.1;
    // (ROADMAP 18.9: their card, the two of them held as they come)
    yield* this.freezeCard({ name: 'VINCE & BRUNO', tag: 'they want something back', col: '#d23a32', at: () => this.headJ(t1), lead: true });
    this.shot({ ...this.single(t1, P, { dist: 2.0, side: -0.5, up: -0.22, drop: 0.25 }), fov: 36, dur: 2.8, hand: 0.5, key: 0.95, fill: 0.6, rim: 1 });
    yield 0.1;
    yield* this.say('T01', t1.fig, 0.3);
    // he puts her behind him: his arm back and out before her, she in behind his shoulder
    L.fig.lookAt = t1.fig.j.headC;
    this.feel(P.fig, 'angry', 20);
    P.fig.lookAt = t1.fig.j.headC;
    this.glide(L, P.pos.x - ux * 0.95 + 0.0, P.pos.z - 0.32, 0.7, true);
    // (his left hand: down and back at his side, its palm back to her, the fingers down)
    this.hold(
      P.fig,
      'L',
      () => {
        const s = P.fig.j.shoulderL;
        return v3(s.x - ux * 0.2, s.y - 0.44, s.z + 0.2);
      },
      { palm: v3(-ux, -0.1, 0), fingers: v3(-ux * 0.25, -0.9, 0.3), ease: 0.4 },
    );
    // (from behind the two of them: Danny, Lily at his back - and the two men in their lamps down the floor)
    this.shot({ from: () => v3(P.pos.x - ux * 2.7 + 0.0, Y + 1.55, P.pos.z - 1.0), look: () => v3(t1.pos.x, Y + 1.3, t1.pos.z), fov: 38, dur: 2.6, hand: 0.5, key: 0.25, rim: 1 });
    yield* this.say('D18', P.fig, 0.3);
    // (Vince, nearer: into his face)
    this.go(t1, D.x + ux * 2.6, D.z + 0.05, 1.0);
    this.shot({ ...this.single(t1, P, { dist: 1.6, side: -0.42, up: -0.15, drop: 0.14 }), fov: 34, dur: 3.2, hand: 0.5, key: 0.6, rim: 1 });
    yield* this.say('T02', t1.fig, 0.25);
    // (round 23, the review: her, once - behind him, looking past his arm at them)
    this.shot({ ...this.single(L, t1, { dist: 0.9, side: 0.5, up: 0.02, drop: 0.06 }), fov: 30, dur: 1.3, hand: 0.45, dof: 1, key: 0.7 });
    yield 1.15;
    // (Danny, the lamps' light on him, Lily at his back behind his shoulder)
    this.shot({ ...this.single(P, t1, { dist: 1.75, side: 0.5, up: -0.28, drop: 0.16 }), fov: 36, dur: 3, hand: 0.5, key: 0.7 });
    yield* this.say('D19', P.fig, 0.25);
    // the other one moves out to the side, slowly, his hand inside his jacket: between them and the way out
    this.go(t2, D.x + ux * 3.4, D.z + 3.3, 0.8);
    this.shot({ from: () => v3(P.pos.x - ux * 1.7 + 0.0, Y + 1.32, P.pos.z - 1.25), look: () => v3((t1.pos.x + t2.pos.x) / 2, Y + 1.38, (t1.pos.z + t2.pos.z) / 2), fov: 32, dur: 3.4, hand: 0.6, key: 0.3, rim: 1 });
    yield 1.4;
    this.shot({ ...this.single(t1, P, { dist: 1.35, side: -0.36, up: -0.34, drop: 0.08 }), fov: 32, dur: 2.6, hand: 0.45, fill: 0.8, key: 0.7, rim: 1 });
    yield* this.say('T03', t1.fig, 0.25);
    // (round 9: the stand-off, as a western has it and an anime cuts it - his eyes, theirs, close and still, the sound of the
    // place gone under it; then the guns)
    {
      const eyes = (who, at, side) => {
        const h = this.headJ(who) || v3(who.pos.x, Y + 1.6, who.pos.z);
        const dx = at.pos.x - who.pos.x;
        const dz = at.pos.z - who.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        return { from: v3(h.x + (dx / d) * 0.72 + (-dz / d) * side, h.y - 0.01, h.z + (dz / d) * 0.72 + (dx / d) * side), look: v3(h.x, h.y - 0.02, h.z) };
      };
      this.airDip = 0.35;
      const C5 = this.comic;
      const strips = [
        [[0.015, 0.03], [0.985, 0.03], [0.985, 0.31], [0.015, 0.33]],
        [[0.015, 0.35], [0.985, 0.33], [0.985, 0.64], [0.015, 0.66]],
        [[0.015, 0.68], [0.985, 0.66], [0.985, 0.97], [0.015, 0.97]],
      ];
      if (C5 && C5.page) C5.page(strips);
      const EY = [eyes(t1, P, 0.06), eyes(P, t1, -0.06), eyes(L, t1, 0.05)];
      for (let i = 0; i < 3; i++) {
        this.shot({ from: EY[i].from, to: EY[i].from.clone().lerp(EY[i].look, 0.08), look: EY[i].look, fov: 24, dur: 0.8, hand: 0.1, dof: 1, key: 0.8 });
        if (C5 && C5.panel) C5.panel(i, { u: 0.5, v: i === 0 ? 0.62 : 0.5, zoom: 2.3 });
        g.audio.play('heartbeat', 0.55);
        yield i < 2 ? 0.62 : 0.8;
      }
      if (C5 && C5.endPage) C5.endPage(0.08);
      this.airDip = 1;
    }
    // wrong answer: the gun - from low beside the line of his arm, the gun big in the picture, his face over it
    this.shot({ from: () => v3(t1.pos.x - ux * 1.55 - uz * 0.85, Y + 1.12, t1.pos.z - uz * 1.55 - 0.8), look: () => { const h = this.headJ(t1) || v3(t1.pos.x, Y + 1.6, t1.pos.z); return v3(h.x - ux * 0.45, h.y - 0.36, h.z - uz * 0.45); }, fov: 38, dur: 2.0, hand: 0.6, shake: 0.08, roll: 0.05, key: 0.75, rim: 1 });
    this.armThug(t1, P);
    g.audio.play('click', 0.6);
    this.flash(0.12, '#ffffff');
    this.comic.impact(this.headJ(t1) || t1.pos, 0.1);
    yield 0.2;
    yield* this.say('T05', t1.fig, 0.05);
    this.armThug(t2, P);
    // him: the car, now
    this.unhold(P.fig, null, 0.15);
    this.shot({ ...this.single(P, t1, { dist: 1.5, side: 0.4, up: -0.15, drop: 0.12 }), fov: 36, dur: 1.6, hand: 0.8, roll: -0.06, key: 0.75 });
    this.feel(P.fig, 'scared', 3);
    this.emote([0.5, 0.06, 0.08], 0.7);
    yield* this.say('D28', P.fig, 0.0);
    this.emote(null);
    // ---- the run back to his car, under their guns: four pictures of it
    this.firing = { at: () => P.pos, t: 0.15 };
    this.feel(L.fig, 'scared', 10);
    P.fig.lookAt = null;
    L.fig.lookAt = null;
    const v = own;
    // (Lily ahead of him, round the car's nose to the far door)
    const lilyWay = [[v.pos.x - 3.0, v.pos.z + 0.5], [v.pos.x - 3.05, v.pos.z - 1.0], [v.pos.x - 0.5, v.pos.z - 1.5]];
    let li = 0;
    const lilyGo = () => {
      while (li < lilyWay.length && Math.hypot(L.pos.x - lilyWay[li][0], L.pos.z - lilyWay[li][1]) < 0.7) li++;
      if (li < lilyWay.length) this.go(L, lilyWay[li][0], lilyWay[li][1], 4.6);
    };
    lilyGo();
    this.walkTo = { x: door.x, z: door.z, speed: 1, sprint: true };
    // (1: from by his car - the two of them at us across the floor, the flashes behind them)
    // (from before the car's nose, on its far side from the tower: beside it the lens was inside the tower's wall)
    this.shot({ from: v3(v.pos.x - 3.9, Y + 0.9, v.pos.z - 1.7), to: v3(v.pos.x - 4.2, Y + 0.86, v.pos.z - 1.5), look: () => v3((P.pos.x + L.pos.x) / 2, Y + 1.05, (P.pos.z + L.pos.z) / 2), fov: 44, dur: 1.3, hand: 1, shake: 0.1, key: 0.6 });
    this.comic.lines(null, 1.2, 0.8);
    {
      let t = 0;
      yield () => {
        t += this.dtR;
        lilyGo();
        return t > 1.15;
      };
    }
    // (2: the tower's wall by his door - their shots in the concrete beside him as he gets to it)
    {
      const wx = door.x - 0.7;
      const wz = PARK.main.z1 - 7.42;
      this.shot({ from: v3(door.x - 3.3, Y + 1.25, door.z - 0.35), look: () => v3(P.pos.x * 0.5 + wx * 0.5, Y + 1.3, P.pos.z * 0.4 + wz * 0.6), fov: 40, dur: 1.0, hand: 1, shake: 0.14, key: 0.7 });
      let t = 0;
      let n = 0;
      yield () => {
        t += this.dtR;
        lilyGo();
        if (n < 3 && t > 0.12 + n * 0.22) {
          const hx = wx - 0.5 + n * 0.55;
          const hy = Y + 1.15 + (n % 2) * 0.4;
          if (g.fx) {
            g.fx.sparks(hx, hy, wz, 9, [1, 0.85, 0.45]);
            g.fx.impact(hx, hy, wz, 0.8);
            g.fx.crumbs(hx, hy, wz - 0.05, 8, 2.6, true);
          }
          flashLight(hx, hy, wz - 0.2, 5, GUN_LIGHT, 2.2);
          g.audio.play('ricochet', 0.7);
          n++;
        }
        return t > 0.85 || (Math.hypot(P.pos.x - door.x, P.pos.z - door.z) < 0.9 && t > 0.6);
      };
    }
    // (3: in - the doors, the engine, its lamps)
    this.putDanny(door.x, door.z, v.yaw);
    this.put(L, v.pos.x - Math.cos(v.yaw) * 1.3, v.pos.z + Math.sin(v.yaw) * 1.3, v.yaw);
    this.walkTo = null;
    // (and his feet off the pedal: the run's forward push must not carry into the car)
    this.auto = null;
    this.carOnly = null;
    g.enterVehicle(v);
    L.pl.ride = v;
    g.audio.play('punch', 0.6);
    g.audio.play('roar', 1);
    this.lamps = [{ car: TC, k: 1, want: 1 }, { car: v, k: 0, want: 1 }];
    // (the two men up the floor after them, their guns up)
    this.go(t1, v.pos.x - 7.5, v.pos.z + 1.6, 2.4);
    this.go(t2, v.pos.x - 8.5, v.pos.z + 4.4, 2.4);
    this.firing = { at: () => v.pos, t: 0.15 };
    // (from low before its nose: the car in its bay, its lamps on into the lens)
    this.shot({ from: v3(v.pos.x - 5.6, Y + 0.5, v.pos.z - 1.9), to: v3(v.pos.x - 5.2, Y + 0.52, v.pos.z - 1.7), look: v3(v.pos.x - 0.6, Y + 0.85, v.pos.z), fov: 44, dur: 1.5, hand: 1, shake: 0.1, key: 0.4 });
    this.comic.word('VROOOM!', v3(v.pos.x - 0.4, Y + 1.75, v.pos.z), { fill: '#ff6f3a', burst: '#ffd23f', size: 0.11, life: 1.1 });
    yield 1.25;
    // (4: the big one, his gun up after them)
    this.shot({ ...this.single(t2, v3(v.pos.x, Y + 1.2, v.pos.z), { dist: 1.7, side: 0.45, up: -0.2, drop: 0.14 }), fov: 36, dur: 2.0, hand: 0.9, shake: 0.06, key: 0.7, rim: 1 });
    yield* this.say('T06', t2.fig, 0.1);
    // their car comes after them
    this.firing = null;
    this.disarmThug(t1);
    this.disarmThug(t2);
    this.cue('chase');
    this.startPursuit();
    this.check = { x: DANNY_CAR.x, y: DANNY_CAR.y + 0.05, z: DANNY_CAR.z, yaw: DANNY_CAR.yaw, back: { x: PARK.entrance.x, z: PARK.entrance.z + 4 } };
    for (const f of [P.fig, L.fig, t1.fig, t2.fig]) f.lodFar = 0;
    this.film(false);
    g.camRig.yaw = v.yaw;
    this.objective('<b>Lose them</b> - up through the car park', PARK.route[1].x, PARK.route[1].z, 'Up');
    this.howto('climb', 10);
    this.climb = true;
    this.climbI = -1;
    this.start(6);
  }

  // (ROADMAP 23.19) what his car's gun turns to in the chase (game/vehicles.js drawnGuns): the nearest of theirs after him -
  // within 55 m, on his floor or the ramp to it - a little ahead of where it is, by how fast it goes. null: none of them
  // (the gun then as it is in the game: where he looks)
  gunAim(me) {
    const F = this.fight;
    if (!this.chaseGun || !F || !F.enemies.length || this.holdCam) return null;
    let best = null;
    let bd = 55;
    for (const e of F.enemies) {
      const c = e.car;
      if (!c || c.dead || e.mode !== 'chase' || e.outT > 0) continue;
      const d = Math.hypot(c.pos.x - me.pos.x, c.pos.z - me.pos.z);
      if (d < bd && Math.abs((c.pos.y || 0) - (me.pos.y || 0)) < 4.5) {
        bd = d;
        best = c;
      }
    }
    if (!best) return null;
    const lead = bd / 95;
    const A = this._gunAim || (this._gunAim = v3(0, 0, 0));
    return A.set(best.pos.x + (best.vx || 0) * lead, (best.pos.y || 0) + 0.75, best.pos.z + (best.vz || 0) * lead);
  }

  // (ROADMAP 23.18) a car's lamps lit in the dark of the car park: their light on the floor ahead of it and on whoever stands in
  // it (render/materials.js flashLight - a light of the moment, given again each frame), and the two lamps themselves bright
  // in the picture. this.lamps: [{ car, k (how far on), want }]. In the film three lights down the beam; in play one.
  tickLamps(dt) {
    const LS = this.lamps;
    if (!LS || !LS.length) return;
    const g = this.game;
    const film = !!this.holdCam;
    for (const q of LS) {
      const c = q.car;
      if (!c || c.dead || !c.pos) continue;
      q.k += ((q.want === undefined ? 1 : q.want) - q.k) * Math.min(1, dt * 9);
      if (q.k < 0.02) continue;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const y = c.pos.y;
      const nose = c.halfLen || 2.3;
      // (down the floor: weak, and from over a head's height - on the concrete, not on a shirt front. At a chest's height and
      // full strength a white shirt in it burned out to a glowing sheet, and the eyes over it to two white lamps)
      flashLight(c.pos.x + fx * (nose + 2.6), y + 0.9, c.pos.z + fz * (nose + 2.6), 9, LAMP_LIGHT, 1.5 * q.k);
      if (film) {
        flashLight(c.pos.x + fx * (nose + 8.5), y + 2.9, c.pos.z + fz * (nose + 8.5), 12, LAMP_LIGHT, 0.6 * q.k);
        flashLight(c.pos.x + fx * (nose + 15), y + 2.9, c.pos.z + fz * (nose + 15), 11, LAMP_LIGHT, 0.4 * q.k);
      }
      if (g.fx) {
        for (const sd of [-1, 1]) {
          g.fx.sprite('fx_impact', c.pos.x + fx * (nose + 0.03) - fz * 0.62 * sd, y + 0.64, c.pos.z + fz * (nose + 0.03) + fx * 0.62 * sd, { size: (film ? 0.8 : 0.55) * q.k, grow: 0, life: 0.085, tint: LAMP_GLARE });
        }
      }
    }
  }

  // a man drawing his gun: his arm up and out at whoever (by), the gun in his hand drawn each frame
  armThug(c, by) {
    const G = this.gunmen || (this.gunmen = []);
    if (!G.find((q) => q.c === c)) G.push({ c, by, t: 0, next: 0.3 + Math.random() * 0.4 });
  }

  disarmThug(c) {
    if (!this.gunmen) return;
    for (const q of this.gunmen) if (q.c === c && q.gun) q.gun.hide(c.fig);
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
      // (ROADMAP 23.18: a pistol that is a thing, in a fist closed round its grip - game/prologue/pistol.js. It was three pen
      // lines from his wrist: a slide, a grip, a glint)
      if (!q.gun) q.gun = new HeldPistol(g);
      const held = h.lengthSq() > 0 && q.gun.place(f, d);
      // (a shot's light on what is round it, three frames of it: the concrete, their faces)
      if (q.lit > 0) {
        q.lit -= dt;
        flashLight(q.gun.muzzle.x, q.gun.muzzle.y, q.gun.muzzle.z, 9, GUN_LIGHT, 3.2 * Math.max(0.3, q.lit / 0.09));
      }
      if (!this.firing || !held) continue;
      q.next -= dt;
      if (q.next > 0) continue;
      q.next = 0.38 + Math.random() * 0.55;
      const mx = q.gun.muzzle.x;
      const my = q.gun.muzzle.y;
      const mz = q.gun.muzzle.z;
      q.lit = 0.09;
      if (g.fx) {
        g.fx.muzzle(mx, my, mz, 0.8);
        g.fx.flash(mx, my, mz, 1.6);
      }
      const cam = g.camera.position;
      const far = Math.hypot(mx - cam.x, mz - cam.z);
      const loud = Math.max(0.25, Math.min(1, 9 / Math.max(3, far)));
      // (under the car park's concrete: the recorded shot, a crack and its echo off the walls - the chase's own, game/prologue/
      // paintfight.js; out on the street the short one)
      if (this.gunsInside) this.sample(Math.random() < 0.7 ? 'sfx/shot_a.mp3' : 'sfx/shot_b.mp3', 1.15 * loud);
      else g.audio.play('pistol', loud);
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
      // (ROADMAP 23.18: in the new look they wait for him inside, dark, down the far end of the street floor from his bay -
      // s5Inside; as the film was, at the curb)
      this.thugsInside = !!this.lookNew;
      const at = this.thugsInside ? IN_PARK.car : THUG_CAR;
      this.thugCar = g.vehicles.spawnStock({ kind: 'sedan', color: DARK }, { x: at.x, z: at.z }, Math.PI / 2);
      this.thugCar.kept = true;
      this.thugCar.pos.y = this.thugsInside ? DANNY_CAR.y : 0.15;
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
      // (round 16, the player's word: always the same people - each the first face of its kind, not
      // whichever of them the city had used least: looks.js roleNth)
      const lk = (role) => roleNth(role, 0) || civilianLook({ fem: false, kind: 'street' });
      const a = this.person('t1', THUGS[0].x, THUGS[0].z, lk('mob'), { face: PARK.thugsFace });
      const b = this.person('t2', THUGS[1].x, THUGS[1].z, lk('bouncer'), { face: PARK.thugsFace });
      // (and two more of theirs, for the windows of their other cars in the car park - the same two
      // every time: game/prologue/paintfight.js placeShooters)
      for (const [key, role] of [['g3', 'eraser'], ['g4', 'biker']]) {
        const c = this.person(key, THUGS[1].x, THUGS[1].z + 3, lk(role), { face: PARK.thugsFace });
        c.fig.setVisible(false);
        c.pl.ride = 'car';
        c.noCollide = true;
        c.inside = true;
      }
      // (their drawn faces in the film's middle shots, as Lily's: ROADMAP 18.9)
      a.fig.portraitPx = 46;
      b.fig.portraitPx = 46;
      // (in their car, inside, till its doors open: s5Inside)
      if (this.thugsInside) {
        for (const [c, sd] of [[a, 1], [b, -1]]) {
          this.put(c, IN_PARK.car.x + 0.5, IN_PARK.car.z + sd * 1.3, Math.PI / 2);
          c.inside = true;
          c.fig.setVisible(false);
        }
      }
    }
  }

  phoneRing(on) {
    const g = this.game;
    if (on) {
      this.ui.call('ring', lang() === 'en' ? 'BENNY' : 'בני');
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
    // (round 16: the men at the windows, seen - always these three: paintfight.js placeShooters)
    this.fight.shooters = [this.cast.t2, this.cast.g3, this.cast.g4].filter(Boolean).map((c) => ({ c, e: null, shown: false, tip: null }));
    for (const sh of this.fight.shooters) sh.c.pl.ride = sh.c.pl.ride || 'car';
    // (his car never blown up in it: caught instead - game/vehicles.js hurt)
    if (this.dannyCar) this.dannyCar.keepAlive = () => this.caught();
    const E = PARK.entrance;
    // (ROADMAP 23.18: from inside - down the floor to his bay and after him up the lane)
    const seed = this.thugsInside
      ? [[IN_PARK.car.x + 6, 0.17, IN_PARK.car.z], [DANNY_CAR.x - 9, 0.17, DANNY_CAR.z - 1.5], [DANNY_CAR.x - 5.5, 0.17, DANNY_CAR.z - 8]]
      : [[THUG_CAR.x + 4, 0.17, THUG_CAR.z - 0.4], [E.x - 3, 0.17, E.z + 4.2], [E.x, 0.17, E.z + 0.8], [E.x, 0.17, E.z - 7]];
    // (from inside they are twenty metres from his bay: a breath before they come, as when they came in from the street)
    const e = this.fight.add(v, { keep: 10, catchUp: true, color: 0, fireT: this.thugsInside ? 4.5 : 2.5, seed, hold: this.thugsInside ? 2.4 : 0 });
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
    // (ROADMAP 23.19: and he can shoot back - a machine gun drawn on the car)
    this.howto('gun', 14);
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
    // (round 23, the review: her question - said as he floored it - on her face while it lasts, not on
    // his)
    if (L.fig.say && !L.fig.say.done) {
      L.fig.lookAt = this.headJ(P);
      this.shot({ from: this.inCar(car, -0.3, 1.0, 0.7), look: this.faceOf(L), fov: 40, dur: 1.4, hand: 0.25 });
      let lt = 0;
      yield () => {
        lt += this.dtR || 1 / 30;
        return lt > 1.4 || !L.fig.say || L.fig.say.done;
      };
    }
    // (round 10: the idea lighting up his face - the world behind him gone hot orange, the lines in)
    this.shot({ from: this.inCar(car, 0.02, 1.2, 0.5), look: this.faceOf(P), fov: 44, dur: 1.6, hand: 0.25 });
    this.emote([1.0, 0.45, 0.12]);
    if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(P), 1.4, 0.7);
    yield 1.5;
    this.emote(null);
    // (round 18, the player's word: no pencil in his hand - it looked odd. From outside his open
    // window, his eyes on the roof's edge, a beat; then it is the player's, to draw - and the giant
    // pencil out of the sky draws what is drawn)
    this.shot({
      from: this.inCar(car, 1.75, 1.3, 0.75),
      look: () => {
        const h = this.headJ(P) || v3(car.pos.x, (car.pos.y || 0) + 1.2, car.pos.z);
        return v3(h.x + Math.sin(car.yaw) * 0.7, h.y - 0.05, h.z + Math.cos(car.yaw) * 0.7);
      },
      fov: 46,
      dur: 1.4,
      hand: 0.25,
    });
    yield 1.1;
    // (round 23, the review: how high it is - from the parapet at the edge, down to 5th Street eight
    // floors under and the far side across it, the lens closing in; before, the roof's edge and the
    // skyline said nothing of the drop)
    {
      const E = PARK.edge;
      // (from out over 5th Street, a little above the roof, looking back at its edge: the parapet at
      // the top of the picture, the face of the building going down and down under it, the street at
      // its foot - and the camera drifting out, the drop growing)
      this.shot({ from: v3(E.x + 6, E.y + 6, E.z + 14), to: v3(E.x + 6.6, E.y + 6.3, E.z + 15.4), look: v3(E.x, E.y - 8.7, E.z), fov: 56, fovTo: 60, dur: 1.6, ease: 'inout', hand: 0.25, roll: 0.04 });
      g.audio.play('whoosh', 0.35);
      yield 1.5;
    }
    // (round 18, the player's word: really drawing a ramp - not a line along the roof seen from behind,
    // where its height cannot be drawn: the camera out of his window and round to the side of the
    // roof run, the car on it and the edge, and the ramp drawn as one draws a ramp - its slope, up from
    // the roof by the car to the edge. What is drawn is its height and its curve)
    const [cx, cz] = loc(car.pos.x, car.pos.z);
    // (centred on where the ramp goes: from 17 m short of the edge to over it)
    const sideMid = RUNF.edgeX + 7.5;
    const lw = (x, y, z) => {
      const [wx, wz] = RUNF.toWorld(x, z);
      return v3(wx, y, wz);
    };
    const sideCam = lw(sideMid, ROOF + 4.6, cz + 25);
    const sideLook = lw(sideMid, ROOF + 2.6, cz);
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const at = (side, along, up) => v3(car.pos.x + fx * along + fz * side, car.pos.y + up, car.pos.z + fz * along - fx * side);
    // (round 23: from his window again, after the edge - and out round to the side)
    const winFrom = this.inCar(car, 1.75, 1.3, 0.75)();
    const hW = this.headJ(P) || v3(car.pos.x, (car.pos.y || 0) + 1.2, car.pos.z);
    const winLook = v3(hW.x + Math.sin(car.yaw) * 0.7, hW.y - 0.05, hW.z + Math.cos(car.yaw) * 0.7);
    this.shot({
      path: [winFrom, at(2.2, -1.5, 4.5), lw(cx - 12, ROOF + 9, cz + 16), sideCam],
      lookPath: [winLook, at(0, 6, 1.0), lw(sideMid, ROOF + 2, cz), sideLook],
      fov: 46,
      fovTo: 50,
      dur: 2.8,
      ease: 'inout',
      hand: 0.1,
    });
    yield 2.8;
    // the player's: held there, the bars away, the screen to draw on
    this.shot({ from: sideCam, look: sideLook, fov: 50, dur: 600, hand: 0 });
    this.drawing = true;
    this.ui.film(false);
    g.hud.show();
    this.draw = new RampDraw(g, this.ui);
    let prof = null;
    this.draw.open({ camera: g.camera, roofY: ROOF, laneZ: cz, carX: cx, edgeX: RUNF.edgeX, frame: RUNF, side: true, floorY: (x, z) => PARK.floorAt(x, z, ROOF + 2) }, (p) => {
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
    // (round 8, the player's word: far off at the roof's edge a giant pencil coming down out of the
    // sky to draw what was drawn, line by line - game/prologue/ramp.js buildSketch; round 18's: and
    // no pencil in his hand - the picture goes straight to it, on a long lens from over the car)
    {
      // (the giant one comes down as the picture cuts to it)
      this.ramp.t = -0.1;
      this.shot({ from: wld(R.startX + 18, Y + 6.2, rz + 3.5), look: wld(R.startX - 5, Y + 1.6, rz), fov: 30, dur: 2.1, hand: 0.2 });
      g.audio.play('whoosh', 0.5);
      let tt = 0;
      let said = false;
      yield () => {
        tt += this.dtR || 0.016;
        // (and as its point touches the roof, the scratch of it, in letters)
        if (!said && this.ramp.t > 0.5 && this.comic && this.ramp.sketch) {
          said = true;
          const w = this.ramp.sketch.localToWorld(this.ramp.strokes[0].pts[0].clone());
          this.comic.word('SKRITCH!', v3(w.x, w.y + 2.5, w.z), { fill: '#ffd23f', burst: '#1b1430', size: 0.075, life: 1.3, tilt: 0.15 });
        }
        return tt >= 1.9;
      };
      P.fig.holdUpR = null;
      if (g.weapons) g.weapons.filmPencil = null;
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
    // (round 23, the review: from in front of her own side, low - the sky and the city behind her; from
    // the middle, a black board's back stood by her head. Six places tried, this the clean one)
    this.shot({ from: this.inCar(car, -0.3, 1.0, 0.7), look: this.faceOf(L), fov: 40, dur: 2.4, hand: 0.4 });
    this.feel(L.fig, 'scared', 6);
    yield* this.say('L15', L.fig, 0.2);
    this.shot({ from: this.inCar(car, -0.04, 1.2, 0.5), look: this.faceOf(P), fov: 46, dur: 2.0, hand: 0.35 });
    this.feel(P.fig, 'angry', 4);
    yield* this.say('D23', P.fig, 0.1);
    P.fig.lookAt = null;
    // the engine; the time its own again; the player's foot on it, all the way to the lip
    this.cue('chase', { heat: 1 });
    g.audio.play('roar', 1);
    // (round 23, the review: the last picture from behind the car, where the game's camera takes over -
    // the ramp ahead of it at the end of the roof - so the player has it before him from the first
    // moment; it was a close of his head inside the car, swung out through the roof)
    {
      const fx2 = Math.sin(car.yaw);
      const fz2 = Math.cos(car.yaw);
      const back = (k, up) => v3(car.pos.x - fx2 * k, (car.pos.y || 0) + up, car.pos.z - fz2 * k);
      this.shot({ from: back(5.6, 2.3), to: back(6.4, 2.45), look: v3(car.pos.x + fx2 * 12, (car.pos.y || 0) + 1.1, car.pos.z + fz2 * 12), fov: 54, dur: 1.2, ease: 'out', hand: 0.3 });
      yield 1.0;
    }
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
    // (round 16: the gunfire is theirs from the windows - paint, heard as shots: paintfight.js - not
    // sparks of nothing besides it)
    if (this.fight) return;
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
    // (round 15: the jump off the roof - the short list is over, the rest of the pen opens)
    if (g.album && g.album.setEarly) g.album.setEarly(false);
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
    // (round 17, the player's word: the title as it was - at the top of the jump, a second off the lip -
    // only on the screen longer)
    // the rear three-quarters of it leaving the lip
    this.shot({ from: () => off(car, 7, 5, 1.2), look: () => v3(car.pos.x, car.pos.y + 0.6, car.pos.z), fov: 50, dur: 1.4, hand: 0.4, shake: 0.12, roll: 0.08, rollTo: 0.02 });
    this.flash(0.1, '#ffffff');
    yield () => J.apex;
    // the title: at the top of it the time all but stopped, the camera drawing round and up and away -
    // the game's name and who made it, five seconds of it
    // (round 24, the player's word: longer - six seconds more at least - and the camera's turn round
    // the car a whole one, a film's: in from behind its tail, round its side low under it, up over it
    // and down again ahead of it, the sky and the street far under it wheeling past; the name and who
    // made it up the whole way round, the title's music played through twice under it)
    this.slow(0.022, 9);
    this.cue('title');
    {
      const c0 = { pos: car.pos.clone() };
      const pts = [];
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        // (round the car from behind it, a whole turn and a little more; nearer at its sides, further
        // over it; low under it on the way round, high over it after, and level at the end)
        const a = Math.PI * (1.12 + 2.15 * k);
        const R = 7.5 + 2.2 * Math.sin(k * Math.PI) - 1.2 * k;
        const up = 0.4 - 2.4 * Math.sin(Math.min(1, k * 2) * Math.PI) * (k < 0.5 ? 1 : 0) + 3.2 * Math.sin(Math.max(0, k * 2 - 1) * Math.PI) * (k >= 0.5 ? 1 : 0);
        pts.push(off(c0, Math.cos(a) * R, Math.sin(a) * R, up));
      }
      // (the turn carried along with the car as it flies on - round where it is, not where it was;
      // while the name is up the look goes under the car, so that it rides over the name, not behind
      // it - before and after, on the car itself)
      const tc0 = this.clock || 0;
      const sm = (a, b, x) => {
        const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return k * k * (3 - 2 * k);
      };
      const under = () => {
        const tt = (this.clock || 0) - tc0;
        return sm(0.3, 1.2, tt) * (1 - sm(10.3, 11.4, tt));
      };
      this.shot({ path: pts, arc: true, rel: () => car.pos, look: () => off(car, 0, 0, 0.2 - 1.7 * under()), fov: 46, fovTo: 52, dur: 12.8, ease: 'inout', hand: 0.12, roll: 0.05, rollTo: -0.06 });
    }
    yield 1.0;
    this.ui.title(true, GAME_TITLE, lang() === 'en' ? CREDIT_EN : CREDIT);
    yield 9.6;
    this.ui.title(false);
    yield 1.6;
    // and then the game's again: the time its own, the car falling as a car falls, its way on fading -
    // seen from behind it, the ground coming up. Her voice
    J.fall();
    this.slow(0.8, 6);
    this.film(false);
    g.camRig.yaw = car.yaw;
    if (L) {
      this.feel(L.fig, 'scared', 4);
      this.say('L08', L.fig, 0.1).next();
    }
    // (round 18, the player's word: the ground really seen coming at them - and only then, at the last
    // second, him thinking, and the idea: a rotor; then the player draws it)
    yield () => J.alt < 36 || J.t > 60;
    this.film(true);
    this.slow(0.3, 8);
    {
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      // (its left, Danny's side: (fz, -fx))
      // behind it and over it, looking down the way it falls: the water, the street's end, coming up
      this.shot({ from: () => v3(car.pos.x - fx * 7 + fz * 1.5, car.pos.y + 3.2, car.pos.z - fz * 7 - fx * 1.5), look: () => v3(car.pos.x + fx * 9, car.pos.y - 7, car.pos.z + fz * 9), fov: 56, dur: 2.0, hand: 0.5, shake: 0.1 });
      this.comic.lines(null, 1.6, 1);
      g.audio.play('whoosh', 0.8);
      yield 0.5;
      // then low over the water beside where it is coming down: the car dropping at us, the surface
      // under it close
      // (far out to its side and low: the car and the surface under it both in the picture - the gap
      // between them closing)
      const gx = car.pos.x + fx * 20 + fz * 24;
      const gz = car.pos.z + fz * 20 - fx * 24;
      this.shot({ from: v3(gx, 4, gz), look: () => v3(car.pos.x, 4 + (car.pos.y - 4) * 0.45, car.pos.z), fov: 64, dur: 3, hand: 0.6, shake: 0.05 });
      if (L) this.feel(L.fig, 'scared', 4);
    }
    // just before it hits: the time all but stops - him thinking: what flies?
    // (round 17: a few metres more over the street than before - time to draw, however slowly)
    yield () => J.alt < 12 || J.t > 60;
    this.slow(0.012, 14);
    this.feel(P.fig, 'angry', 3);
    {
      // (from outside his window, close: the car nose down, and inside it was all car)
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      const face = () => this.headJ(P) || v3(car.pos.x, car.pos.y + 1.3, car.pos.z);
      this.shot({
        from: () => {
          const h = face();
          return v3(h.x + fz * 0.95 + fx * 0.85, h.y + 0.14, h.z - fx * 0.95 + fz * 0.85);
        },
        look: () => {
          const h = face();
          return v3(h.x, h.y - 0.02, h.z);
        },
        fov: 32,
        dur: 3,
        hand: 0.15,
        dof: 1,
      });
    }
    if (this.comic && this.comic.focus) this.comic.focus(() => this.headJ(P), 1.4, 0.9);
    this.thought('תחשוב... מה עף?', 1.5);
    yield 1.4;
    // and the idea, at the last second: a rotor
    this.flash(0.18, '#fffaf0');
    this.emote([1.0, 0.86, 0.45]);
    this.feel(P.fig, 'surprised', 1.2);
    this.thought('רוטור!', 1.2);
    g.audio.play('magic', 0.5);
    yield 1.0;
    this.emote(null);
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
    // (round 23, the review: no flash of white over it - with the sun ahead and the drawing's paper
    // going, the first second of the flight was a white wash, the car and its rotor lost in it)
    this.comic.word('WHUP-WHUP!', v3(car.pos.x, car.pos.y + 2.2, car.pos.z), { fill: '#ffd23f', burst: '#ff4f8b', size: 0.085, life: 1.2, tilt: -0.12 });
    this.slow(1, 3);
    this.cue('chase', { heat: 0.3 });
    this.objective('Fly to the <b>beach</b> - set down on the sand', LOOKOUT.x, LOOKOUT.z, 'Beach');
    this.howto('fly', 12);
    this.hour(18.62, 0.004);
    this.start(9);
  }

  // (round 12) the rotor, drawn on the car in the air - the game's own car pen (game/partpen.js,
  // game/fuse.js): the camera close on the car from behind and over it, the pen out on it.
  // (round 17, the player's word: 'just a line is silly - draw it the way the game draws a rotor on a
  // car') the pen's own rotor, as it is drawn in the game: an X over the roof (game/itemcat.js rotor -
  // 'an X or a helicopter'), the drawing itself the rotor's blades on a mast over the roof, turning
  // (game/itemlook.js rotor). Whatever is drawn here is the rotor; drawn small, made big enough to
  // carry the car. A pencil over the car draws the X, and the hub in its middle, again and again till
  // the player draws
  *rotor(car) {
    const g = this.game;
    const fd = g.freedraw;
    const pen = g.fuse && g.fuse.pen;
    // (the car in the middle of the picture from behind and over it, the sky over its roof to draw on -
    // held there, steady, as it hangs: the pen's own camera put by - game/fuse.js sketchCam)
    if (g.fuse) g.fuse.camHeld = true;
    // (round 25, the player's word: from straight behind it, into the sunset, the falling car was a
    // black shape tipped on its nose - nothing to read; a crooked angle. Now from in front of it and to
    // its side, low and level with it: the whole car in profile falling nose first, its wheels, the
    // horizon level and the city's towers behind it - six places tried in the picture, this the clear
    // one; the side the sun is on, chosen once, as it begins)
    const sun = shared.uSunDir.value;
    const sideSun = Math.sin(car.yaw + Math.PI / 2) * sun.x + Math.cos(car.yaw + Math.PI / 2) * sun.z >= 0 ? 1 : -1;
    const back = () => {
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      const rx = Math.sin(car.yaw + Math.PI / 2) * sideSun;
      const rz = Math.cos(car.yaw + Math.PI / 2) * sideSun;
      return v3(car.pos.x + fx * 5.5 + rx * 6.0, car.pos.y + 1.2, car.pos.z + fz * 5.5 + rz * 6.0);
    };
    // (the car a little under the middle, the sky over its roof clear - the pen's rows of things put
    // away: the rotor is chosen already, and on a phone they covered the picture)
    this.shot({ from: back, look: () => v3(car.pos.x, car.pos.y + 1.0, car.pos.z), fov: 44, dur: 600, hand: 0 });
    if (!document.getElementById('pro-rotor-css')) {
      const st = document.createElement('style');
      st.id = 'pro-rotor-css';
      st.textContent = 'body.pro-rotor .pp-legend, body.pro-rotor .pp-row, body.pro-rotor .pp-slots, body.pro-rotor #fd-hint, body.pro-rotor .pp-live, body.pro-rotor .pp-tip { display: none !important; }';
      document.head.appendChild(st);
    }
    document.body.classList.add('pro-rotor');
    this.ui.film(false);
    g.hud.show();
    // (round 17: the time all but stopped while it is drawn - a slow hand's half a minute is a few
    // metres of the fall)
    // (round 24, the player's word: not all the time in the world - slowed, but falling: a few seconds
    // to draw it in (more on a phone), the time left seen, the ground coming; too slow, and the car
    // comes down - and it is tried again from the fall)
    this.slow(0.005, 20);
    this.drawingRotor = true;
    this.howto('rotor', 0);
    const J = this.jump;
    const snap = J ? { t: J.t, vyNow: J.vyNow, y: J.y, sp: J.sp, dist: J.dist, g: J.g, yaw: car.yaw, x: car.pos.x, z: car.pos.z } : null;
    const LIMIT = g.touch ? 20 : 15;
    const alt0 = J ? Math.max(2, J.alt) : 10;
    // (the pen's own make, for this drawing: drawn small, the lines spread from their middle till the
    // rotor is a helicopter's - about four metres across at the car - then made as ever)
    if (pen) {
      const mk = Object.getPrototypeOf(pen).make;
      pen.make = (strokes, inkI, caps) => {
        const o = pen.own();
        const per = o && o.F ? o.F.perPx : 0;
        return mk.call(pen, per > 0 ? spreadTo(strokes, 3.9 / per) : strokes, inkI, caps);
      };
    }
    let teach = this.teachRotor(car);
    const has = () => !!(car.fz && car.fz.rotor > 0);
    // (an X is two strokes: after the first, the pen waits for the second a little longer than it
    // waits for the rest of a drawing - game/partpen.js PEN_REST)
    let waited = false;
    for (let tries = 0; ; tries++) {
    let left = LIMIT;
    let failed = false;
    this.rotorClock(true, 1, tries);
    yield () => {
      if (has()) return true;
      // (the time left, on the film's own clock; the fall paced to it - the ground there as it runs out)
      left -= this.dtR || 1 / 30;
      this.rotorClock(true, Math.max(0, left / LIMIT), tries);
      if (J) {
        const vy = Math.max(2, Math.abs(J.vyNow || 0));
        const want = Math.max(0, J.alt - 1.2) / (vy * Math.max(0.5, left));
        this.slow(clamp(want, 0.0015, 0.09) * Math.min(1, alt0 / 4), 30);
      }
      if (left <= 0) {
        failed = true;
        return true;
      }
      if (fd && fd.group) {
        if (fd.group.length === 1 && !fd.cur && !waited) {
          fd.groupAt = Math.max(fd.groupAt || 0, performance.now() + 1700);
          waited = true;
        } else if (!fd.group.length) waited = false;
      }
      if (fd && !fd.isOpen && g.player.inVehicle === car) fd.show();
      // (the pen's things, the rotor of them chosen - whatever it is read as: game/partpen.js force)
      if (pen && fd && fd.isOpen) {
        if (pen.cat !== 'func') {
          pen.cat = 'func';
          pen.legSig = '';
          if (pen.showLegend) pen.showLegend();
        }
        pen.force = 'rotor';
      }
      teach.update(!!(fd && (fd.cur || (fd.group && fd.group.length))));
      return false;
    };
    this.rotorClock(false);
    if (!failed) break;
    // (too slow: the pen shut, the time its own - it comes down, hard; black; and from the fall again)
    teach.remove();
    if (fd && fd.isOpen) fd.close();
    this.ui.card(null);
    this.slow(1, 40);
    yield () => !J || J.alt < 1.4;
    g.audio.play('boom', 1);
    if (g.fx && g.fx.boom) g.fx.boom(car.pos.x, car.pos.y, car.pos.z, 3);
    if (g.camRig && g.camRig.addShake) g.camRig.addShake(0.7);
    this.flash(0.25, '#ffffff');
    this.slow(0.05, 20);
    yield 0.5;
    this.ui.fade(true, 0.35);
    this.thought(tr('המכונית התרסקה... ציירו את הרוטור מהר יותר!', 'It crashed... draw the rotor faster!'), 2.4);
    yield 1.1;
    if (J && snap) {
      Object.assign(J, { t: snap.t, vyNow: snap.vyNow, y: snap.y, sp: snap.sp, dist: snap.dist, g: snap.g });
      car.yaw = snap.yaw;
      car.pos.set(snap.x, snap.y, snap.z);
      car.vy = snap.vyNow;
      if (car.fuse && car.fuse.parts) car.fuse.parts = car.fuse.parts.filter((q) => q.type !== 'rotor');
    }
    this.slow(0.005, 40);
    this.ui.fade(false, 0.45);
    this.howto('rotor', 0);
    teach = this.teachRotor(car);
    waited = false;
    yield 0.3;
    }
    teach.remove();
    if (pen) {
      delete pen.make;
      pen.force = null;
    }
    document.body.classList.remove('pro-rotor');
    if (g.fuse) g.fuse.camHeld = false;
    // (whatever its size as drawn, a helicopter's lift - the story's)
    {
      const R = car.fuse;
      const rp = R && R.parts ? R.parts.find((q) => q.type === 'rotor') : null;
      if (rp && g.fuse && g.fuse.applyVeh) {
        rp.n = { ...(rp.n || {}), span: Math.max((rp.n && rp.n.span) || 0, 4.2) };
        g.fuse.applyVeh(car);
      }
    }
    car.fz.rotor = Math.max(car.fz.rotor || 0, 1.3);
    car.fz.airCtl = Math.max(car.fz.airCtl || 0, 1);
    car.fuseUp = true;
    if (fd && fd.isOpen) fd.close();
    this.drawingRotor = false;
    this.ui.card(null);
  }

  // (round 24) the time left to draw the rotor in, big at the top of the screen: what to do, the bar
  // of time going, red as it runs out (on: shown; k: the share left; tries: how many falls before)
  rotorClock(on, k = 1, tries = 0) {
    if (typeof document === 'undefined') return;
    let el = this.rotorEl;
    if (!on) {
      if (el) el.remove();
      this.rotorEl = null;
      return;
    }
    if (!el) {
      if (!document.getElementById('pro-rclock-css')) {
        const st = document.createElement('style');
        st.id = 'pro-rclock-css';
        st.textContent = '.pro-rclock{position:fixed;z-index:59;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);width:min(520px,70vw);padding:7px 14px 9px;background:rgba(14,10,26,.82);border:2px solid #ffd23f;border-radius:14px;color:#fff8ec;font:700 clamp(14px,2.4vw,19px)/1.25 "Rubik",system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.45)}.pro-rclock .bar{height:8px;margin-top:6px;border-radius:5px;background:rgba(255,255,255,.18);overflow:hidden}.pro-rclock .bar i{display:block;height:100%;background:#ffd23f;border-radius:5px;transition:width .1s linear}.pro-rclock.low{border-color:#ff4f6a}.pro-rclock.low .bar i{background:#ff4f6a}.pro-rclock.low .t{animation:prc .5s infinite}@keyframes prc{50%{opacity:.45}}';
        document.head.appendChild(st);
      }
      el = this.rotorEl = document.createElement('div');
      el.className = 'pro-rclock';
      el.innerHTML = '<div class="t"></div><div class="bar"><i></i></div>';
      document.body.appendChild(el);
    }
    const he = lang() !== 'en';
    const sec = Math.ceil(k * (this.game.touch ? 20 : 15));
    const what = tries ? (he ? 'שוב! ציירו X מעל הגג - מהר' : 'Again! Draw an X over the roof - fast') : he ? 'ציירו רוטור (X) מעל הגג - לפני שהמכונית מתרסקת!' : 'Draw a rotor (an X) over the roof - before the car crashes!';
    el.dir = he ? 'rtl' : 'ltr';
    el.querySelector('.t').textContent = `${what} · ${sec}`;
    el.querySelector('i').style.width = `${(k * 100).toFixed(1)}%`;
    el.classList.toggle('low', k < 0.34);
  }

  // where on the screen the rotor goes: a box over the car's roof, about as tall as it is wide, an X
  // four metres across drawn in it (the car pen reads a drawing as seen from over the car - game/
  // itemlook.js rotor - so an X square on the screen is a rotor's two blades square across each
  // other; a flat one, two blades nearly side by side): its corners ([x, y] px - top left, top right,
  // bottom right, bottom left) and its middle
  rotorBox(car) {
    const cam = this.game.camera;
    const H = (car.heightM || 1.45) + 0.85;
    // (round 25: across the picture, at the car - not across the car: seen from its side, that was
    // nothing wide on the screen. The camera's own right, level)
    cam.updateMatrixWorld();
    const ce = cam.matrixWorld.elements;
    const cl = Math.hypot(ce[0], ce[2]) || 1;
    const rx = ce[0] / cl;
    const rz = ce[2] / cl;
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    const px = (a) => {
      const q = v3(car.pos.x + rx * a, car.pos.y + H, car.pos.z + rz * a).project(cam);
      return [((q.x + 1) / 2) * W, ((1 - q.y) / 2) * Hh];
    };
    const m = px(0);
    const L = px(-1.95);
    const R = px(1.95);
    // (half its width: two metres at the car, as the screen has it - within reason)
    const hw = Math.max(60, Math.min(W * 0.3, Math.hypot(R[0] - L[0], R[1] - L[1]) / 2));
    const hh = hw * 0.8;
    // (over the roof, its foot a little above it, never off the top of the screen - round 25: nor
    // under the bar of time there)
    const cy = Math.max(hh + 100, m[1] - hh * 0.55);
    const c = [[m[0] - hw, cy - hh], [m[0] + hw, cy - hh], [m[0] + hw, cy + hh], [m[0] - hw, cy + hh]];
    return { c, m: [m[0], cy] };
  }

  // (round 17) the pencil that shows how a turbo is drawn on the car: a flame out of its back - its
  // outline drawn from the tail out and round, as the pen's own picture of it (game/itemcat.js turbo),
  // its dashes left behind - a breath, and again; gone while the player draws
  teachTurbo(car) {
    const g = this.game;
    const NS = 'http://www.w3.org/2000/svg';
    const el = document.createElement('div');
    el.className = 'pro-teach';
    el.innerHTML = '<svg><path class="tl"/><g class="tp"><path d="M12 2h38v12H12z" fill="#ffd23f" stroke="#1b1430" stroke-width="2"/><path d="M50 2h8v12h-8z" fill="#ff7ab8" stroke="#1b1430" stroke-width="2"/><path d="M12 2L1.5 8 12 14z" fill="#f3d7a8" stroke="#1b1430" stroke-width="2" stroke-linejoin="round"/><path d="M1.5 8l4.5-2.6v5.2z" fill="#1b1430"/></g></svg>';
    if (!document.getElementById('pro-teach-css')) {
      const st = document.createElement('style');
      st.id = 'pro-teach-css';
      st.textContent = '.pro-teach{position:fixed;inset:0;z-index:60;pointer-events:none;transition:opacity .25s}.pro-teach.off{opacity:0}.pro-teach svg{width:100%;height:100%;overflow:visible}.pro-teach .tl{fill:none;stroke:#fff8ec;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:14 12;filter:drop-shadow(0 0 4px #1b1430)}';
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
    const line = el.querySelector('.tl');
    const pen = el.querySelector('.tp');
    // (the flame's outline, from its foot round to its tip and back - the pen's own icon, its foot at
    // 12,22 and its tip up at 13,2 - sampled once)
    const shape = document.createElementNS(NS, 'path');
    shape.setAttribute('d', 'M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z');
    const probe = document.createElementNS(NS, 'svg');
    probe.style.cssText = 'position:fixed;width:0;height:0;visibility:hidden';
    probe.appendChild(shape);
    document.body.appendChild(probe);
    const N = 64;
    const P0 = [];
    const len = shape.getTotalLength();
    for (let i = 0; i <= N; i++) {
      const q = shape.getPointAtLength((i / N) * len);
      P0.push([q.x - 12, q.y - 22]);
    }
    probe.remove();
    const t0 = performance.now();
    const LOOP = 2.6;
    this.turboPts = null;
    return {
      update: (drawing) => {
        el.classList.toggle('off', drawing);
        const cam = g.camera;
        const C = g.fuse && g.fuse.drawCtx ? g.fuse.drawCtx(car) : null;
        const D = C ? C.D : null;
        const hl = D && D.hl ? D.hl : 2.2;
        const fx = Math.sin(car.yaw);
        const fz = Math.cos(car.yaw);
        const W = window.innerWidth;
        const Hh = window.innerHeight;
        const px = (k, up) => {
          const q = v3(car.pos.x - fx * k, car.pos.y + up, car.pos.z - fz * k).project(cam);
          return [((q.x + 1) / 2) * W, ((1 - q.y) / 2) * Hh];
        };
        // (round 23, the review: its foot on the car itself - on the back of its boot, where the drawn
        // turbo goes - not in the air beyond its tail, where it stood over the pavement beside it)
        const deck = C && C.K ? Math.max(0.6, (C.K.clear || 0.25) + 0.55) : 0.7;
        const tail = px(hl - 0.25, deck);
        const out = px(hl + 1.3, 0.6);
        const mid = px(0, 0.55);
        // (out of the back of it as the screen has it - mostly to the side, a little down at most:
        // seen from behind and over it, straight back is down the screen, into the pen's own rows)
        let dx = out[0] - tail[0];
        const dy0 = out[1] - tail[1];
        if (Math.abs(dx) < 20) dx = (tail[0] - mid[0] || -1) * 3;
        const sx = Math.sign(dx) || -1;
        const sl = Math.max(-0.5, Math.min(0.35, dy0 / Math.max(1, Math.abs(dx))));
        // (a turbo's size at the car - what is drawn is what is made, game/partpen.js nOf)
        const L = Math.max(70, Math.min(130, Math.hypot(dx, dy0)));
        let ux = sx / Math.hypot(1, sl);
        let uy = sl / Math.hypot(1, sl);
        // (and clear of the pen's rows at the foot of the screen)
        if (tail[1] + uy * L > Hh - 190) {
          uy = Math.min(uy, 0) - 0.15;
          const n2 = Math.hypot(ux, uy);
          ux /= n2;
          uy /= n2;
        }
        void ux;
        // (round 21, the player's word: the very shape the pen's list shows for the turbo - its flame
        // upright, its tip up, not turned on its side: standing on the car's tail as the screen has it)
        const k = L / 20;
        // (above the pen's list and its rows, whatever is under it: seen whole)
        let top = Hh - 190;
        for (const q of document.querySelectorAll('.pp-legend, .pp-row, .pp-slots, .fd-tools')) {
          const r = q.getBoundingClientRect();
          if (r.height > 0 && r.width > 0 && r.top > Hh * 0.35) top = Math.min(top, r.top - 14);
        }
        const by = Math.min(tail[1], top);
        const bx = Math.max(L * 0.6, Math.min(W - L * 0.6, tail[0]));
        const pts = P0.map(([x, y]) => [bx + x * k, by + y * k]);
        this.turboPts = pts;
        const tt = ((performance.now() - t0) / 1000) % LOOP;
        const kk = Math.max(0, Math.min(1, tt / 1.6));
        const n = Math.max(1, Math.round(kk * N));
        let d = '';
        for (let i = 0; i <= n; i++) d += `${i ? 'L' : 'M'}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
        line.setAttribute('d', d);
        const tip = pts[n];
        pen.setAttribute('transform', `translate(${tip[0].toFixed(1)} ${tip[1].toFixed(1)}) rotate(-38) translate(-2 -8) scale(1.4)`);
      },
      remove: () => {
        el.remove();
        this.turboPts = null;
      },
    };
  }

  // the pencil that shows how: over the car's roof the X drawn - one stroke corner to corner, the other
  // across it, then a little ring in its middle, their dashes left behind - a breath, and again; gone
  // while the player draws
  teachRotor(car) {
    const el = document.createElement('div');
    el.className = 'pro-teach';
    el.innerHTML = '<svg><path class="tl"/><path class="tl"/><path class="tl"/><g class="tp"><path d="M12 2h38v12H12z" fill="#ffd23f" stroke="#1b1430" stroke-width="2"/><path d="M50 2h8v12h-8z" fill="#ff7ab8" stroke="#1b1430" stroke-width="2"/><path d="M12 2L1.5 8 12 14z" fill="#f3d7a8" stroke="#1b1430" stroke-width="2" stroke-linejoin="round"/><path d="M1.5 8l4.5-2.6v5.2z" fill="#1b1430"/></g></svg>';
    if (!document.getElementById('pro-teach-css')) {
      const st = document.createElement('style');
      st.id = 'pro-teach-css';
      st.textContent = '.pro-teach{position:fixed;inset:0;z-index:60;pointer-events:none;transition:opacity .25s}.pro-teach.off{opacity:0}.pro-teach svg{width:100%;height:100%;overflow:visible}.pro-teach .tl{fill:none;stroke:#fff8ec;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:14 12;filter:drop-shadow(0 0 4px #1b1430)}';
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
    const lines = [...el.querySelectorAll('.tl')];
    const pen = el.querySelector('.tp');
    const t0 = performance.now();
    // (the first stroke 0.8 s, the pencil lifted, the second 0.8 s, the ring 0.6 s, a breath)
    const SEG = [[0, 0.8], [1.0, 1.8], [2.0, 2.6]];
    const LOOP = 3.4;
    return {
      update: (drawing) => {
        el.classList.toggle('off', drawing);
        const { c, m } = this.rotorBox(car);
        const t = ((performance.now() - t0) / 1000) % LOOP;
        const seg = [[c[0], c[2]], [c[1], c[3]]];
        const r = Math.max(10, Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) * 0.07);
        let tip = null;
        for (let i = 0; i < 2; i++) {
          const [a, b] = seg[i];
          const k = Math.max(0, Math.min(1, (t - SEG[i][0]) / (SEG[i][1] - SEG[i][0])));
          const x = a[0] + (b[0] - a[0]) * k;
          const y = a[1] + (b[1] - a[1]) * k;
          lines[i].setAttribute('d', k > 0 ? `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}` : '');
          if (t >= SEG[i][0] && t <= SEG[i][1] + 0.1) tip = [x, y];
        }
        // (the ring round the middle, from its top)
        const kr = Math.max(0, Math.min(1, (t - SEG[2][0]) / (SEG[2][1] - SEG[2][0])));
        if (kr > 0) {
          const n = Math.max(2, Math.ceil(kr * 24));
          let d = '';
          for (let i = 0; i <= n; i++) {
            const a = -Math.PI / 2 + (i / n) * kr * Math.PI * 2;
            d += `${i ? 'L' : 'M'}${(m[0] + Math.cos(a) * r).toFixed(1)} ${(m[1] + Math.sin(a) * r).toFixed(1)}`;
          }
          lines[2].setAttribute('d', d);
          if (t <= SEG[2][1] + 0.1) {
            const a = -Math.PI / 2 + kr * Math.PI * 2;
            tip = [m[0] + Math.cos(a) * r, m[1] + Math.sin(a) * r];
          }
        } else lines[2].setAttribute('d', '');
        // (between the strokes the pencil lifted, waiting where the next begins)
        if (!tip) tip = t < SEG[1][0] ? c[1] : t < SEG[2][0] ? [m[0], m[1] - r] : c[0];
        pen.setAttribute('transform', `translate(${tip[0].toFixed(1)} ${tip[1].toFixed(1)}) rotate(-38) translate(-2 -8) scale(1.4)`);
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
    // (round 18, the player's word: down from the flight there was no getting out of the car. Down on
    // the ground and stopped: E is his - the flight ends there and then, wherever it came down - and
    // stopped on the sand anywhere near the beach is the beach)
    this.outAsked = false;
    let still = 0;
    let told = false;
    let highT = 0;
    yield () => {
      const c = v();
      if (!c) return false;
      // (a car on a rotor hangs on it a hand over the ground, and is in the air all the while: near
      // the ground and slow is down)
      const over = c.pos.y - groundHeight(c.pos.x, c.pos.z);
      const low = !c.air || over < 3.5;
      const down = low && Math.abs(c.speed || 0) < 6;
      still = down ? still + (this.dtR || 1 / 30) : 0;
      this.canOut = down && still > 0.4;
      if (down && still > 0.4 && !told) {
        told = true;
        this.ui.plainHint(tr('<span dir="rtl">E - לצאת מהמכונית</span>', 'E - get out of the car'));
      }
      if (!down && told) {
        told = false;
        this.ui.hint(null);
      }
      // (round 24, the player's word: while it flies, small, how to bring it down - C, or ▼ on a phone)
      const flying = !low;
      // (not over the flying card while it is up: the same corner - C is on it already)
      const H = this.ui.hintEl;
      const cardUp = !!H && H.classList.contains('card') && H.classList.contains('on');
      if (flying && !told && highT <= 0 && !cardUp && this.flyHint !== 1) {
        this.flyHint = 1;
        this.ui.plainHint(tr('<span dir="rtl">' + (g.touch ? '▼' : 'C') + ' - לנחות</span>', (g.touch ? '▼' : 'C') + ' - land'));
      } else if (!flying && this.flyHint === 1) {
        this.flyHint = 0;
        if (!told && highT <= 0) this.ui.hint(null);
      }
      if (this.outAsked && down) {
        // (set down where it is)
        c.air = false;
        c.vy = 0;
        c.pos.y = Math.max(c.pos.y - over, c.pos.y - 3.5);
        return true;
      }
      if (this.outAsked && !down) {
        // (too high, or still going: how to come down)
        highT = 2.6;
        this.flyHint = 0;
        this.ui.plainHint(tr('<span dir="rtl">כדי לצאת: נחתו קודם</span><small>' + (g.touch ? '▼ למטה, ועצרו' : 'C למטה, ועצרו') + '</small>', 'To get out: land first<small dir="ltr">' + (g.touch ? '▼ down, and stop' : 'C down, and stop') + '</small>'));
        told = false;
      }
      this.outAsked = false;
      if (highT > 0) {
        highT -= this.dtR || 1 / 30;
        if (highT <= 0) this.ui.hint(null);
      }
      const d = this.dist(LOOKOUT.x, LOOKOUT.z);
      return down && (d < 45 || (still > 1.2 && d < 140));
    };
    this.ui.hint(null);
    this.canOut = false;
    this.outAsked = false;
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
    // (round 23, the review: its rotor still now it is down - turning, it smeared into a white cloud
    // behind her in every close in the car; game/fuse.js, rotorStill)
    car.rotorStill = true;
    // facing the water, the pier off to the north - from outside, the two of them in it, still
    // (round 23, the review: the whole car on the sand, the sea behind it, and in on them - from close
    // by its door, the dark of its side filled the picture and their faces were not in it)
    this.shot({ from: this.carSide(car, 1, 6.6, 2.5, 2.6), to: this.carSide(car, 1, 4.4, 1.9, 1.4), look: this.cabin(car, 1.0), fov: 42, dur: 3.0, ease: 'inout', hand: 0.35 });
    yield 2.6;
    // (ROADMAP 18.9: the talk in the car not one long picture from outside - in under the roof, each
    // face as it speaks and as it listens)
    const onD = (o = {}) => this.shot({ from: this.inCar(car, -0.1, 1.18, 0.52), look: this.faceOf(P), fov: 40, dur: 6, hand: 0.25, ...o });
    // (round 23, the review: hers from a little lower and nearer his side - the evening sky behind her,
    // not a sign's black back)
    const onL = (o = {}) => this.shot({ from: this.inCar(car, -0.3, 1.0, 0.7), look: this.faceOf(L), fov: 40, dur: 6, hand: 0.25, ...o });
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
    // (round 23, the review: closer for the hard one - three times the same picture of him before)
    this.shot({ from: this.inCar(car, -0.06, 1.16, 0.4), look: this.faceOf(P), fov: 30, dur: 6, hand: 0.25, fill: 1.1 });
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
    // (round 23, the review: the closing beat of the whole of it on the drawing itself - over her
    // shoulder, down onto her knees: the wheel she drew, the only thing that says it was there. From in
    // front, the page's back was all there was of it, blank white)
    {
      // (she turns it to him: his look at it, from beside his eyes - the picture to us as it is to him.
      // From behind or over her it was its blank back, or its edge)
      page.hold(L.fig, () => P.fig.j.headC, 'show');
      const eyeD = () => this.headJ(P) || v3(car.pos.x, (car.pos.y || 0) + 1.2, car.pos.z);
      const from = () => {
        const e = eyeD();
        const q = page.at;
        const d = e.distanceTo(q) || 1;
        return v3(q.x + ((e.x - q.x) / d) * 0.52, q.y + ((e.y - q.y) / d) * 0.52 + 0.04, q.z + ((e.z - q.z) / d) * 0.52);
      };
      this.shot({ from, look: () => page.at, fov: 44, dur: 3.4, hand: 0.1, dof: 1, focus: [0.52, 0.52] });
    }
    yield* this.say('L18', L.fig, 0.4);
    L.fig.lookAt = P.fig.j.headC;
    // (his answer in profile, through his window, the evening's sea beyond him)
    this.shot({ from: this.carSide(car, -1, 1.35, 1.22, 0.15), look: this.faceOf(P), fov: 34, dur: 4, hand: 0.25, fill: 1.1 });
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
    // (round 20, the player's word: on a phone there was no getting out after it - the end of the film
    // is the two of them out of the car, on their feet on the sand, the city his)
    if (g.player.inVehicle) {
      const c = g.player.inVehicle;
      g.exitVehicle(true);
      if (L && L.pl && L.pl.ride === c) {
        L.pl.ride = null;
        L.riding = false;
        L.noCollide = false;
        L.baseY = 0;
        L.fig.sit = 0;
        L.fig.ones = false;
        this.put(L, g.player.pos.x + Math.cos(c.yaw) * 1.2, g.player.pos.z - Math.sin(c.yaw) * 1.2, c.yaw);
      }
    }
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
    this.carOnly = null;
    this.canOut = false;
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
    if (g.album && g.album.setEarly) g.album.setEarly(false);
    if (g.weapons) g.weapons.filmPencil = null;
    this.unbeacon();
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
    // (round 23, the review: the game's buttons and map kept away while the screen is still black at
    // the end - they came up over the black before the picture did; with the picture now)
    const black = !!this.ui.blackOn;
    if (black) document.body.classList.add('prologue-film');
    setTimeout(() => {
      this.ui.fade(false);
      this.ui.objective(null);
      if (black) document.body.classList.remove('prologue-film');
      document.body.classList.remove('prologue');
      this.active = false;
    }, 600);
  }
}

void LINES;
void rampH;
void DRAW_PITCH;
