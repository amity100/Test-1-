import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import { shared } from '../core/Shared';
import type { ShotFrame } from '../gameplay/CameraRig';
import type { Player } from '../gameplay/Player';
import type { BearActor } from '../gameplay/BearActor';
import { CRADLED, type Flock, type Animal } from '../characters/Flock';
import { CRADLE } from '../characters/DavidModel';
import { LAYOUT } from '../world/Layout';
import { rachelShots, hideTreesNear, type RachelShots } from './land/rachel';
import type { FilmFocus } from './FilmStage';
import { FilmFlock, D4_BLEATS, D3_STAGE, D4_STAGE } from './filmAnimals';
import { drift, portraitLens, takeBeat, takeDur } from './FilmCams';
import { INTRO_SHOTS } from '../content/introScript';

/**
 * The opening film's shots in the GAME WORLD around Bethlehem (CUT v5, docs/intro-script-v5.md): camera takes (lens,
 * framing, motivated moves) and the staging of the chapter's own actors — David (DavidModel.performFilm), his flock
 * (FilmFlock, Flock) and the village. Every timed event is read from the shots' named BEATS in
 * src/content/introScript.ts. Everything is put back by leave() (the game starts right after the film — at the end of
 * D4 without a cut).
 *
 * Takes:
 *   'bethlehem'    P2  (7 s, cut8) Bethlehem on its ridge in the early light: one slow aerial drift toward the village
 *                      from the ESE (the low sun behind the lens' right shoulder: the stone houses, the flat roofs, the
 *                      terraces with olives below, morning smoke from a few roofs); from `flock` a shepherd leads a flock
 *                      out along the terraces (small in the frame). It continues P1's flight through the dissolve.
 *   'rachel-dawn'  P3  (6 s, cut8) Rachel's standing stone by the road at first light: a real low dolly through the grass
 *                      toward the stone (looking north-east, the dawn glow at the right), the shepherd and his flock
 *                      crossing behind it, unobstructed, birds; from `rise` the lens lifts away and climbs, turning to
 *                      the north and tilting down — the map (P4) continues the climb through the dissolve
 *                      (the end view: scratchpad/wf/cut8_notes.md)
 *   (CUT v6: P2 and P3 are no longer in the film — their code stays, unused)
 *   'glimpse:rock' F1  (0.8 s, cut8 wave 5) a flash inside Saul's glory: far behind the boy on his rock, against the low
 *                      sun above the valley — a silhouette, never the face; graded cooler and softer (applyGlimpseGrade)
 *   'glimpse:hand' F2  (0.8 s) a flash: his young hand closing on the staff, sheep passing out of focus below
 *   'figure'       D1  (5.5 s) a slow crane behind David on his rock against the low sun, the flock below
 *   'face'         D2  (4 s) the reveal — the first face of the film: the push-in as he turns into the light
 *   'watch'        D3  (6 s) over his right shoulder, down onto his flock on the slope below (Ps 78:70-71)
 *   'horizon'      D4  (14 s) ONE take with the light behind him: he walks up through his sheep (a hand on a ewe's back),
 *                      kneels to the newborn, gathers it up with both hands under it (its legs hanging, then folding; its
 *                      head turning up to him) and rises under its weight; carries it to its mother under the logo; sets
 *                      it down — it nurses; he turns out over the flock; the lens eases onto the game's camera (HANDOFF)
 *   'vista'            a slow crane over the hills (only as the stand-in for a film set that failed to build)
 *
 * World: +X east, -Z north (+Z south); the chapter's sun is low in the east (LAYOUT SUN: 13 deg, azimuth 100). David's
 * rock is LAYOUT.start (+0.2, +2.3) on the brow of the eastern slope (the ground falls ~0.85 m per m to the east, ~0.3
 * to the south), two boulders behind it to the north-west, a small one 1 m in front of it (SSE), the pasture SSE of it
 * (~47 m, ~15 m lower), Bethlehem on its ridge NW (-260, -330), Rachel's pillar on the path to the town (-150, -198).
 */
export interface FilmWorldHost {
  engine: Engine;
  player: Player;
  flock: Flock;
  bear: BearActor;
  /** D4: the gameplay camera's first frame behind David (CameraRig.followFrame for HANDOFF) — the lens lands on it */
  handoff?: (out: ShotFrame) => ShotFrame;
}

/**
 * The hand-off from the film into play (CUT v5): where D4 leaves David (among his flock, the ewe and her lamb at his
 * side) and his heading (looking out over the flock: the game begins facing it), the follow camera's pitch and the
 * height of its pivot over his feet (main.ts: cam.target = feet + 1.55). Intro.end() places him here (also after a
 * skip); D4's lens lands on CameraRig.followFrame of exactly this.
 */
export const HANDOFF = { x: -1.95, z: 10.2, heading: 0.6, pitch: 0.2, pivotH: 1.55 };

/**
 * D4 'horizon' (cut8, CUT v6 — 14 s): the choreography in world x / z (the ground is the terrain's) and its timing
 * relative to the contract's beats (lamb 0.3 · descend 1.2 · kneel 3.4 · lift 4.0 · logo 5.2 · setDown 9.0 · logoOut 9.8
 * · settle 11.4 · 14.0). Tunable live under ?test=1 (window.__filmWorldCams.d4).
 * The user (wave 5): David must look natural and artistic, busy with his flock — one composed take WITH THE LIGHT BEHIND
 * HIM: the lens stays up the slope on his left (west, az ≈ 250 → 214), looking toward the low sun (the glare at the
 * frame's top left), tracking with his walk, never circling him. He walks slowly up through his sheep, his right hand on
 * a ewe's back, the staff in his left; the newborn bleats; he goes to it, kneels, slides both hands under its chest and
 * belly and lifts it (its legs hanging, then folding; its head turning up to him) to his chest, and rises under its
 * weight; he carries it a few steps along the slope under the logo, kneels to its mother and sets it down — she turns to
 * it, it nurses; he rises and turns out over the flock and the valley (HANDOFF.heading): his own turn puts the lens
 * behind him; from `settle` the lens only eases back onto the game's camera.
 *  - stand:     his place in D3 (on the shoulder of the ridge, his flock on the slope below him)
 *  - start:     D4's first frame: among his sheep, walking slowly up the slope (at `slow` m/s until `descend`)
 *  - guide:     the ewe walking at his right with his hand on her back (the staff in his left): [m to his right, m
 *               ahead]; let go at `guideOff` (she walks on, easing away to her right, and stops to graze)
 *  - touch:     (wave 6) his right hand on her back, after the dissolve: [the reach begins, the palm lands on her wool,
 *               it lifts off] (s; gone by `guideOff`) — a hover above her back, the touch, a stroke along it, the lift
 *  - lamb:      the newborn, fallen behind (it bleats for its mother) — at his front-left when he kneels
 *  - wayDown:   his way up to `kneel1`, beside the lamb
 *  - wayOn:     his way along the slope with the lamb in his arms to `kneel2`, before its mother
 *  - ewe:       the lamb's mother (Flock: lamb.mother), waiting a little up the slope, looking toward it
 */
export const D4 = {
  stand: [-7.85, 10.65],
  start: [-2.2, 14.55],
  slow: 0.5,
  guide: [0.43, 0.3],
  guideOff: 2.6,
  touch: [0.7, 1.15, 2.1],
  lamb: [-2.61, 11.67],
  wayDown: [[-2.3, 13.4]],
  kneel1: [-2.4, 12.25],
  wayOn: [[-2.2, 11.2]],
  kneel2: [HANDOFF.x, HANDOFF.z],
  ewe: [-1.11, 9.2],
  /** the lamb set down this far in front of him */
  setDownD: 0.62,
  /** seconds relative to the beats: the walk up ends at kneel + d1 (slow until descend + d0); he kneels at kneel + k1;
   *  the hands slide under the lamb over [lift + r0, lift]; it rises to his chest over [lift, lift + l1]; he stands up
   *  under its weight from lift + u1; the walk on runs [lift + w0, setDown + w1]; he kneels at setDown + k2; the lamb is
   *  lowered over [setDown + s0, setDown + s1], let go at setDown + s2; he rises at setDown + u2; his gaze goes out over
   *  the flock at settle + g0 */
  d0: 0, d1: -0.2, k1: -0.2, r0: -0.45, l1: 1.0, u1: 1.15, w0: 2.1, w1: -0.55, k2: -0.55, s0: -0.25, s1: 0.15, s2: 0.3, u2: 0.75, g0: -1.2,
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** (wave 6) the stroke on the guide ewe's back, in her body bone's frame (rig units): x toward him (her left), z from
 *  behind the withers back along her spine, `y` the back's top if a ray misses; `wool` her wool's outer shell over the
 *  body mesh on her back, `press` how far the palm sinks into it (m) */
const EWE_STROKE = { x: 0.06, z0: 0.05, z1: -0.1, n: 5, y: 0.19, wool: 0.016, press: 0.008 };
const smooth = (u: number) => u * u * (3 - 2 * u);
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ss = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;

interface Path {
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
  fov: [number, number];
  ease: boolean;
}

/** heading (DavidModel / Player convention: forward = (sin h, 0, cos h)) of a horizontal direction */
const headingOf = (d: THREE.Vector3) => Math.atan2(d.x, d.z);

/** Tunable numbers of the world takes (window.__filmWorldCams under ?test=1). */
export const WORLD_CAM = {
  // P2 (cut8): the aerial drift toward Bethlehem from the ESE: `head` the lens' heading (deg: -120 = WNW, the sun behind
  // its right shoulder), `d0`-`d1` its distance from the village centre (m), `h0`-`h1` its height over the ground under
  // it, the look at `lookH` m over the centre's ground (`lookD` m beyond it), a slow crab `side` m to the right, the bank
  // `roll` (deg) easing out of P1's turn; the shepherd and his flock on the terraces: their walk starts `flockD` m from
  // the centre toward the lens and `flockSide` m to its side, along the contour at `walk` m/s
  bethlehem: { head: -120, d0: 335, d1: 210, h0: 135, h1: 58, lookH: 4, lookD: 20, side0: 0, side1: 18, fov0: 41, fov1: 37, roll0: -3, roll1: 0, yaw0: 15, yawT: 1.25, flockD: 118, flockSide: -26, walk: 1.0, exp: 1.04 },
  // P3 (cut8 on cut4's composition): the low dolly toward the stone along the dawn axis (`axis` < 0: the low sun's
  // heading turned `axisTurn` rad south, so the sun disc stands just beside the stone), `back` m before the pillar,
  // `side` m to the right of the axis, `h` m over the ground (just over the grass tops: the drove reads over them); the
  // look `lookFar` m beyond the pillar, `lookRight` m to the right, `lookH` m up. The shepherd leads his flock out along
  // the shepherds' path from the town to the pasture (LAYOUT.path runs just behind the stone): from `walkFrom` to
  // `walkTo` (x east, z south of the pillar, m) at `walk` m/s — behind the stone, left to right, on the bare path (the
  // grass pressed round them). From beats.rise the crane: up `riseH` m (log-height, k `riseK` /s) and back over the road south of the stone
  // (`riseTo` + the height / tan pitch: the stone stays ahead, below), turning to `riseHead` (deg: 180 = north) and
  // tilting down to `risePitch` (deg) by `riseAt` s
  rachel: { axis: -1, axisTurn: -0.12, back0: 11.6, back1: 6.8, side0: -1.3, side1: -0.7, h0: 1.45, h1: 1.35, lookFar: 34, lookRight: 6.5, lookH: 1.75, fov0: 31, fov1: 27.5, walkFrom: [2.5, -7.0], walkTo: [22, 20], walk: 1.05, exp: 0.88, riseH: 160, riseK: 3.0, riseTo: [0, 0], riseHead: 180, risePitch: -58, riseFov: 40, riseAt: 5.6 },
  // D1: the orbit / crane behind David (azimuth from his back, radius, height above his feet)
  figure: { az0: 48, az1: 58, r0: 3.3, r1: 3.8, h0: 1.5, h1: 1.85, lookAhead1: 12, lookDown1: 2.4, lookMix0: 0.08, lookMix1: 0.2, headH: 1.55, fov0: 34, fov1: 37, exp: 0.86 },
  // D2 (cut4): the push-in on the face, BACKLIT (see frame('face'))
  face: { az: -15, d0: 3.0, d1: 2.1, side0: 0.16, side1: 0.08, lookSide: 0.26, fov0: 21, fov1: 17.5, turnDur: 1.7, turnAz: 72 },
  // D3 (cut8): over his right shoulder from behind and a little above — `heading` (rad) of his gaze (the flock below),
  // the lens `back` m behind his feet, `right` m to his right, `up` m over his feet, drifting slowly (0 -> 1 over the
  // shot); the look `lookD` m out along his gaze, `lookDown` m under his feet; the lens
  watch: { heading: 0.3, back0: 2.0, back1: 1.85, right0: 0.72, right1: 0.56, up0: 2.0, up1: 1.95, lookD: 14, lookDown0: 3.0, lookDown1: 3.15, fov0: 48, fov1: 46, fStopFlock: 5.6, fStopHim: 3.2 },
  // D4 (cut8): the follow lens in David's frame — keys [t (shot s), az (deg: the lens' heading seen from his feet; his
  // left side ≈ 107, behind him ≈ 197), r (m), h (m over his feet), yaw bias (deg, + = the frame turns left), pitch bias
  // (deg, + = up: sky for the logo), fov]; the look aims at the action (framing point) plus the biases; the last key is
  // the gameplay camera itself (added at run time) — every channel a C1 monotone cubic, still at both ends.
  // (wave 5) WITH THE LIGHT BEHIND HIM: the lens up the slope on his left (west, az 250), looking toward the low sun (its
  // glare at the frame's top left), tracking with his walk — never circling him: his left side as he walks up through his
  // sheep, close and low for the gathering (his hands under the lamb, its head turning up to him), back and up as he
  // rises and carries it under the logo (the lockup above him), his left side as he sets it down by its mother; his own
  // turn to the hand-off heading puts the lens behind him, and from `settle` it eases back onto the game's camera (az 214)
  horizon: {
    keys: [
      [0, 250, 3.9, 2.1, 0, 0, 40],
      [1.2, 249, 3.7, 2.05, 0, 0, 40],
      [3.0, 246, 3.0, 1.9, 0, -2, 40],
      [3.9, 244, 2.6, 1.8, 0, -3, 38],
      [5.0, 243, 2.7, 1.85, 0, -2, 38],
      [6.2, 245, 3.2, 2.1, 0, 3, 40],
      [7.4, 245, 3.4, 2.2, 0, 4.5, 40],
      [8.5, 242, 3.4, 2.3, 0, 4.5, 41],
      [9.6, 236, 3.4, 2.4, 0, 2.5, 43],
      [11.4, 224, 3.5, 2.4, 0, 0, 48],
    ] as [number, number, number, number, number, number, number][],
    // depth of field: on him / the lamb; everything sharp before the hand-off (the game's camera has none)
    fStop0: 3.2, fStop1: 5.6,
  },
  d4: D4,
  // (wave 5, review) F1 'glimpse:rock' (0.8 s flash): the boy from behind, LARGE, standing on the crest of the ridge
  // above his rock (`at` m from it away from the sun, where the land falls away toward the valley and the low sun), facing
  // the sun; the lens close behind him (`dist0`→`dist1` m, the sun's line turned `azOff` deg so the disc stands beside
  // his head), `h` m over its own ground (about his waist), tilted up `pitchUp` deg: the sky fills the upper frame — a
  // silhouette with a rim of light, never the face
  glimpseRock: { at: 12, dist0: 3.15, dist1: 2.9, azOff: 7, h: 0.95, pitchUp: 5, fov: 52, fStop: 2.8 },
  // F2 'glimpse:hand' (0.8 s flash): close behind-left of his staff hand, `d0`→`d1` m, looking past it along his gaze
  // (the flock out of focus below); the fingers close on the staff at `close` s
  glimpseHand: { d0: 0.72, d1: 0.6, left: 0.22, up: 0.18, ahead: 0.25, fov: 30, fStop: 1.4, close: 0.22 },
  // F1 / F2: graded a touch cooler and softer than Gilgal (a memory, a premonition): highlight warmth + `warm`,
  // saturation × `sat`, contrast × `contrast`, desaturation + `desat`, vignette + `vignette`, exposure × `exp`
  glimpseGrade: { warm: -0.09, sat: 0.74, contrast: 0.88, desat: 0.1, vignette: 0.1, exp: 0.92 },
};

export class FilmWorld {
  readonly takes = new Set(['bethlehem', 'rachel-dawn', 'glimpse:rock', 'glimpse:hand', 'figure', 'face', 'watch', 'horizon', 'vista']);
  private readonly paths: Record<string, Path> = {};
  private readonly rachel: RachelShots | null;
  private readonly ground: (x: number, z: number) => number;
  private readonly rock = new THREE.Vector3();
  private readonly sunH = new THREE.Vector3();
  /** David's gaze over the land (between the low sun and the pasture) */
  private readonly viewDir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly faceCam = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tmp3 = new THREE.Vector3();
  /** P3: the pillar, its top, the view axis (toward the dawn), the line the flock crosses on */
  private readonly pillar = new THREE.Vector3();
  private readonly pillarTop = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly axisR = new THREE.Vector3();
  private readonly crossA = new THREE.Vector3();
  private readonly crossB = new THREE.Vector3();
  /** P3 birds (cut4): small dark silhouettes crossing the dawn sky behind Rachel's stone */
  private birds: { group: THREE.Group; mat: THREE.SpriteMaterial; tex: THREE.Texture; list: { s: THREE.Sprite; ph: number; k: number }[] } | null = null;
  private saved: { a: Animal; pos: THREE.Vector3; heading: number; ai: boolean; state: Animal['state'] }[] = [];
  private staged = '';
  /** world exposure before the film's per-take multipliers (-1 = not captured) */
  private exposure0 = -1;
  private expK = 1;
  /** restores the vegetation cleared for a composition (P3: the cypresses round the pillar, the corridor to the flock) */
  private restoreTrees: (() => void) | null = null;
  /** the flock staged inside a lens' view (anim: src/film/filmAnimals.ts) */
  private readonly ff: FilmFlock;
  private readonly stageCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 5000);
  /** D4: the lens' channels and the hand-off frame they land on */
  private readonly hand: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 52, roll: 0 };
  private readonly craneKeys: number[][] = [];
  /** where David's feet are (his settled position on the rock: the game's physics may have nudged him) */
  private readonly feet = new THREE.Vector3();
  /** D4: David's two walks (centripetal Catmull-Rom through the way points, world, y = 0) */
  private walk1: THREE.CatmullRomCurve3 | null = null;
  private walk2: THREE.CatmullRomCurve3 | null = null;
  /** D3 / D4: the key animals (the newborn's mother, the extra lambs and their ewes, the goat on the rock, the rams) */
  private cast: { ewe: Animal | null; lambs: Animal[]; nurseEwe: Animal | null; goat: Animal | null; guide: Animal | null } = { ewe: null, lambs: [], nurseEwe: null, goat: null, guide: null };
  /** D4: where the newborn is in the story (seek-safe: re-derived from the shot time every frame) */
  private lambPhase: 'ground' | 'arms' | 'free' = 'ground';
  private readonly lambFrom = new THREE.Matrix4();
  private readonly lambCenter = new THREE.Vector3();
  private lastD4 = -1;
  /** (wave 6) frames left to reset the model's dynamics after a cut-in / teleport */
  private resetFrames = 0;
  /** D2: where his eyes go down to — his flock on the slope below the rock (toward D3's view) */
  private readonly flockBelow = new THREE.Vector3();
  private lastWatch = -1;
  /** P2: the shepherd's walk along the terraces (start, direction) and morning smoke from a few roofs (film only) */
  private readonly p2Walk = { start: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0) };
  private smoke: { points: THREE.Points; dispose: () => void; setPixelScale: (h: number, fov: number) => void } | null = null;
  private smokeP: Promise<void> | null = null;
  /** sound of the D4 bleats: false = the score plays them (score6), FilmWorld only animates the heads */
  static bleatSound = false;

  constructor(private readonly h: FilmWorldHost) {
    const g = h.engine.terrain;
    this.ground = (x, z) => g.heightAt(x, z);
    const G = (x: number, z: number, up = 0) => V(x, this.ground(x, z) + up, z);
    const L = LAYOUT;
    this.rock.copy(G(L.start.x + 0.2, L.start.z + 2.3));
    const sd = shared.uSunDir.value as THREE.Vector3;
    this.sunH.set(sd.x, 0, sd.z).normalize();
    const toPasture = V(L.pasture.x - this.rock.x, 0, L.pasture.z - this.rock.z).normalize();
    this.viewDir.copy(this.sunH).multiplyScalar(0.45).addScaledVector(toPasture, 0.55).normalize();
    this.side.set(-this.viewDir.z, 0, this.viewDir.x); // to David's right (viewed from behind)
    // P3: staged only when the sheet films it
    const filmsRachel = INTRO_SHOTS.some((s) => s.set === 'world' && s.take === 'rachel-dawn');
    let rs: RachelShots | null = null;
    if (filmsRachel) {
      try {
        rs = rachelShots(this.ground, h.engine.village.rachelPillar);
      } catch (e) {
        console.warn('[film] rachel shots', e);
      }
    }
    this.rachel = rs;
    this.pillar.copy(h.engine.village.rachelPillar);
    this.pillar.y = this.ground(this.pillar.x, this.pillar.z);
    this.pillarTop.copy(rs?.anchors.pillarTop ?? this.pillar.clone().add(V(0, 2.25, 0)));
    this.setRachelAxis();
    if (filmsRachel) {
      this.buildRachelCross();
      try {
        this.buildBirds();
      } catch (e) {
        console.warn('[film] birds', e);
      }
    }
    this.ff = new FilmFlock(h.flock, this.ground);
    this.feet.copy(this.rock);
    this.buildPaths();
    this.buildWalks();
    this.buildP2Walk();
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') {
      const w = window as unknown as Record<string, unknown>;
      w.__filmWorldCams = WORLD_CAM;
      w.__cradle = CRADLE;
      w.__cradled = CRADLED;
      w.__filmWorld = this;
    }
  }

  /** P3's view axis (WORLD_CAM.rachel.axis deg, or < 0: toward the dawn — the sun's heading turned a little south, so
   *  the sun disc stands beside the stone, not behind it) and its right */
  private setRachelAxis() {
    const c = WORLD_CAM.rachel;
    if (c.axis >= 0) this.axis.set(Math.sin(c.axis * DEG), 0, Math.cos(c.axis * DEG));
    else this.axis.copy(this.sunH).applyAxisAngle(V(0, 1, 0), c.axisTurn).normalize();
    this.axisR.set(-this.axis.z, 0, this.axis.x);
  }

  /** P3: the shepherd's way out along the shepherds' path behind the stone (from the town toward the pasture) */
  private buildRachelCross() {
    const c = WORLD_CAM.rachel;
    const P = this.pillar;
    this.crossB.set(P.x + c.walkFrom[0], 0, P.z + c.walkFrom[1]);
    this.crossA.set(P.x + c.walkTo[0], 0, P.z + c.walkTo[1]);
  }

  private path(pos: THREE.Vector3[], look: THREE.Vector3[], fov: [number, number], ease = true): Path {
    for (const p of pos) p.y = Math.max(p.y, this.ground(p.x, p.z) + 0.35);
    return { pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'), look: new THREE.CatmullRomCurve3(look, false, 'centripetal'), fov, ease };
  }

  private buildPaths() {
    const L = LAYOUT;
    const G = (x: number, z: number, up = 0) => V(x, this.ground(x, z) + up, z);
    const beth = G(L.bethlehem.x, L.bethlehem.z, 14);
    const pasture = G(L.pasture.x, L.pasture.z, 1.2);
    this.paths.vista = this.path(
      [G(430, 150, 260), G(300, 118, 150), G(170, 88, 62)],
      [beth.clone(), beth.clone().lerp(pasture, 0.25), beth.clone().lerp(pasture, 0.62)],
      [44, 38],
    );
    const ta = THREE.MathUtils.degToRad(WORLD_CAM.face.turnAz);
    this.faceCam.copy(this.rock).add(V(Math.sin(ta) * 40, 1.7, Math.cos(ta) * 40));
    // (wave 6) D2's look down: the slope below toward D3's flock (south-south-west of the rock, ~14 m out, below him)
    {
      const st = WORLD_CAM.d4.stand, hd = WORLD_CAM.watch.heading;
      const fx = st[0] + Math.sin(hd) * 11, fz = st[1] + Math.cos(hd) * 11;
      this.flockBelow.set(fx, this.ground(fx, fz) + 0.4, fz);
    }
  }

  /** D4: his walk down to the lamb and his walk on to its mother (world x / z) */
  private buildWalks() {
    const d = WORLD_CAM.d4;
    const P = (p: number[]) => V(p[0], 0, p[1]);
    this.walk1 = new THREE.CatmullRomCurve3([P(d.start), ...d.wayDown.map(P), P(d.kneel1)], false, 'centripetal');
    this.walk2 = new THREE.CatmullRomCurve3([P(d.kneel1), ...d.wayOn.map(P), P(d.kneel2)], false, 'centripetal');
  }

  /** P2: the shepherd's walk along a terrace (along the contour, crossing the view) */
  private buildP2Walk() {
    const c = WORLD_CAM.bethlehem;
    const B = LAYOUT.bethlehem;
    const a = c.head * DEG;
    const f = V(Math.sin(a), 0, Math.cos(a));
    const r = V(-f.z, 0, f.x);
    const s = V(B.x, 0, B.z).addScaledVector(f, -c.flockD).addScaledVector(r, c.flockSide);
    // along the contour: perpendicular to the slope's gradient, the side that crosses toward the frame's centre
    const e = 1.5;
    const gx = this.ground(s.x + e, s.z) - this.ground(s.x - e, s.z), gz = this.ground(s.x, s.z + e) - this.ground(s.x, s.z - e);
    const dir = V(-gz, 0, gx);
    if (dir.lengthSq() < 1e-6) dir.copy(r);
    dir.normalize();
    if (dir.dot(r) * Math.sign(-c.flockSide || 1) < 0) dir.negate();
    this.p2Walk.start.copy(s);
    this.p2Walk.dir.copy(dir);
  }

  /** Camera of a world take at normalised u — false for an unknown take. */
  frame(take: string, u: number, t: number, out: ShotFrame): boolean {
    const uu = clamp01(u);
    const e = drift(uu);
    out.roll = 0;
    switch (take) {
      case 'bethlehem': {
        // P2 — one slow aerial drift toward the village (a long glide on P1's heading, sinking a little, a slow crab to
        // the right so the houses turn against the hills behind them), the bank easing out of P1's turn
        const c = WORLD_CAM.bethlehem;
        const B = LAYOUT.bethlehem;
        const a = c.head * DEG;
        const fx = Math.sin(a), fz = Math.cos(a), rx = -fz, rz = fx;
        // (cut7's P1 ends faster, higher and still turning right: the glide decelerates — 25 % linear, 75 % ease-out —
        // the town comes from 15 deg right of the centre to the centre over the dissolve, the bank levels out)
        const eo = 0.25 * uu + 0.75 * (1 - (1 - uu) * (1 - uu));
        const d = lerp(c.d0, c.d1, eo), sd = lerp(c.side0, c.side1, e);
        out.pos.set(B.x - fx * d + rx * sd, 0, B.z - fz * d + rz * sd);
        out.pos.y = this.ground(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, eo);
        const ty = c.yaw0 * DEG * (1 - smooth(clamp01(t / c.yawT)));
        const lx = B.x + fx * c.lookD - out.pos.x, lz = B.z + fz * c.lookD - out.pos.z;
        const cy = Math.cos(ty), sy = Math.sin(ty);
        out.look.set(out.pos.x + lx * cy + lz * sy, 0, out.pos.z - lx * sy + lz * cy);
        out.look.y = this.ground(B.x, B.z) + c.lookH;
        out.fov = lerp(c.fov0, c.fov1, e);
        out.roll = lerp(c.roll0, c.roll1, smooth(clamp01(t / 1.6))) * DEG;
        return true;
      }
      case 'rachel-dawn':
        this.rachelFrame(t, out);
        return true;
      case 'glimpse:rock': {
        // F1 (wave 5, review): close behind him on the crest, against the sky and the low sun — a slight push
        const c = WORLD_CAM.glimpseRock;
        const C = this.crestSpot(this.tmp);
        const a = Math.atan2(this.sunH.x, this.sunH.z) + Math.PI + c.azOff * DEG;
        const dd = lerp(c.dist0, c.dist1, smooth(uu));
        out.pos.set(C.x + Math.sin(a) * dd, 0, C.z + Math.cos(a) * dd);
        out.pos.y = Math.max(this.ground(out.pos.x, out.pos.z) + c.h, C.y + 0.75);
        const dx = C.x - out.pos.x, dz = C.z - out.pos.z, dh = Math.hypot(dx, dz) || 1;
        out.look.set(out.pos.x + (dx / dh) * 10, out.pos.y + 10 * Math.tan(c.pitchUp * DEG), out.pos.z + (dz / dh) * 10);
        out.fov = c.fov;
        out.roll = 0.006;
        return true;
      }
      case 'glimpse:hand': {
        // F2 (wave 5): his staff hand, close, from behind-left; past it, down the slope, his flock out of focus
        const c = WORLD_CAM.glimpseHand;
        const hand = this.handOf(this.tmp2);
        const D = this.viewDir, Lx = D.z, Lz = -D.x; // his left (viewed from behind: -side)
        const dd = lerp(c.d0, c.d1, smooth(uu));
        out.pos.set(hand.x - D.x * dd + Lx * c.left, hand.y + c.up, hand.z - D.z * dd + Lz * c.left);
        out.look.set(hand.x + D.x * c.ahead, hand.y + 0.02, hand.z + D.z * c.ahead);
        out.fov = c.fov;
        out.roll = -0.01;
        return true;
      }
      case 'figure': {
        const c = WORLD_CAM.figure;
        const az = THREE.MathUtils.degToRad(lerp(c.az0, c.az1, e));
        const back = this.tmp.copy(this.viewDir).negate();
        back.applyAxisAngle(V(0, 1, 0), az);
        const r = lerp(c.r0, c.r1, e);
        out.pos.copy(this.rock).addScaledVector(back, r);
        out.pos.y = Math.max(this.ground(out.pos.x, out.pos.z) + 0.6, this.rock.y + lerp(c.h0, c.h1, e));
        const shoulders = this.tmp2.copy(this.rock).add(V(0, c.headH, 0));
        const valley = this.rock.clone().addScaledVector(this.viewDir, c.lookAhead1);
        valley.y = this.ground(valley.x, valley.z) + 1.0;
        valley.y = Math.max(valley.y, this.rock.y - c.lookDown1);
        out.look.copy(shoulders).lerp(valley, lerp(c.lookMix0, c.lookMix1, ss(0.15, 1, uu)));
        const settle = 1 - ss(0, 0.85, t);
        out.look.y += 3.2 * settle * settle;
        out.fov = lerp(c.fov0, c.fov1, e);
        out.roll = -0.012 + 0.018 * e;
        return true;
      }
      case 'face': {
        const c = WORLD_CAM.face;
        const fa = THREE.MathUtils.degToRad(c.az);
        const camDir = this.tmp.set(Math.sin(fa), 0, Math.cos(fa));
        const fs = this.tmp2.set(-camDir.z, 0, camDir.x);
        const head = V(this.rock.x, this.rock.y + 1.56, this.rock.z);
        out.pos.copy(head).addScaledVector(camDir, lerp(c.d0, c.d1, e)).addScaledVector(fs, lerp(c.side0, c.side1, e));
        out.pos.y += lerp(-0.05, -0.02, e);
        out.look.copy(head).addScaledVector(fs, c.lookSide);
        out.look.y += 0.05 + 0.015 * e;
        out.fov = lerp(c.fov0, c.fov1, e);
        return true;
      }
      case 'watch': {
        // D3 — over his right shoulder from behind and a little above, looking down his gaze at the flock on the slope;
        // a slow drift out to the right and down (the flock opens beside him), never round him
        const c = WORLD_CAM.watch;
        const hd = c.heading, fx = Math.sin(hd), fz = Math.cos(hd), rx = -fz, rz = fx;
        const st = WORLD_CAM.d4.stand;
        const F = this.tmp.set(st[0], this.ground(st[0], st[1]), st[1]); // (wave 6) his stand: he walks out of the lens
        const b = lerp(c.back0, c.back1, e), r = lerp(c.right0, c.right1, e);
        out.pos.set(F.x - fx * b + rx * r, F.y + lerp(c.up0, c.up1, e), F.z - fz * b + rz * r);
        out.pos.y = Math.max(out.pos.y, this.ground(out.pos.x, out.pos.z) + 0.6);
        out.look.set(F.x + fx * c.lookD, F.y - lerp(c.lookDown0, c.lookDown1, e), F.z + fz * c.lookD);
        out.fov = lerp(c.fov0, c.fov1, e);
        out.roll = -0.006 + 0.01 * e;
        return true;
      }
      case 'horizon':
        this.horizonFrame(t, out);
        return true;
    }
    const p = this.paths[take];
    if (!p) return false;
    const pe = p.ease ? e : uu;
    p.pos.getPoint(pe, out.pos);
    p.look.getPoint(pe, out.look);
    out.fov = p.fov[0] + (p.fov[1] - p.fov[0]) * pe;
    return true;
  }

  /**
   * P3 at shot second t: the low dolly toward the stone, then from beats.rise the crane — up (log-height: a constant
   * perceptual climb, still climbing at the cut and on into the dissolve), back, turning to the north and tilting down
   * onto the stone and the road. Defined past the shot's end (the live dissolve into the map keeps it moving).
   */
  private rachelFrame(t: number, out: ShotFrame) {
    const c = WORLD_CAM.rachel;
    const T = takeDur('rachel-dawn', 6), rise = takeBeat('rachel-dawn', 'rise', 4);
    const P = this.pillar;
    // the dolly over the whole shot's ground part (it keeps drifting into the rise)
    const ed = drift(clamp01(t / T));
    const lx = P.x - this.axis.x * lerp(c.back0, c.back1, ed) + this.axisR.x * lerp(c.side0, c.side1, ed);
    const lz = P.z - this.axis.z * lerp(c.back0, c.back1, ed) + this.axisR.z * lerp(c.side0, c.side1, ed);
    const gy = this.ground(lx, lz) + lerp(c.h0, c.h1, ed);
    const look = this.tmp3.copy(P).addScaledVector(this.axis, c.lookFar).addScaledVector(this.axisR, c.lookRight);
    look.y = this.pillarTop.y + c.lookH - 2.25 + 0.25 * ed;
    // the crane: w = 0 on the ground, 1 at riseAt (and after); the height law is log-linear in time with its rate easing
    // in from 0 at `rise` (k(t) = riseK * smooth ramp) so the lift-off is gentle and the climb at the cut is constant-rate
    const ramp = 0.8;
    const tc = t - rise;
    const lnk = tc <= 0 ? 0 : tc < ramp ? (c.riseK * tc * tc) / (2 * ramp) : c.riseK * (tc - ramp / 2);
    const lnEnd = c.riseK * (T - rise - ramp / 2);
    const hEnd = c.riseH;
    // h(t) = h(ground) * exp(lnk) scaled so that it reaches riseH at T: h = h0 * exp(lnk - lnEnd) * riseH / h0 ... with a
    // floor at the ground lens: the rise adds height above the dolly's own
    const hRise = tc <= 0 ? 0 : Math.max(0, hEnd * Math.exp(lnk - lnEnd) - hEnd * Math.exp(-lnEnd));
    const w = ss(rise + 0.1, c.riseAt, t);
    // over to the road south of the stone as it rises (the pull-back grows with the height, so the lens ends due south of
    // the stone on the line pitched `risePitch` down onto it)
    const mv = smooth(clamp01((t - rise) / (c.riseAt - rise + 0.6)));
    const pull = c.riseTo[1] + hRise / Math.tan(-c.risePitch * DEG);
    out.pos.set(lerp(lx, P.x + c.riseTo[0], mv), gy + hRise, lerp(lz, P.z + pull, mv));
    // the look: from the dolly's look (into the dawn) onto the stone as the crane rises — a pan that follows the stone
    // round to the north (the stone stays in the frame; at the end: heading north, pitch = risePitch)
    out.look.copy(look).lerp(this.tmp2.set(P.x, P.y, P.z), smooth(w));
    void wrap;
    out.fov = lerp(lerp(c.fov0, c.fov1, ed), c.riseFov, smooth(w));
    out.roll = 0.012 * Math.sin(Math.min(1, t / T) * 2.4) * (1 - w);
  }

  // ---------------------------------------------------------------------------------------------- D4 'horizon'
  /** the gameplay camera's first frame behind David at the hand-off (the player gives CameraRig.followFrame) */
  private handoffFrame(): ShotFrame {
    const f = this.hand;
    if (this.h.handoff) return this.h.handoff(f);
    const yaw = HANDOFF.heading + Math.PI, cp = Math.cos(HANDOFF.pitch), sp = Math.sin(HANDOFF.pitch);
    const pivot = this.tmp2.set(HANDOFF.x, this.ground(HANDOFF.x, HANDOFF.z) + HANDOFF.pivotH, HANDOFF.z);
    const dir = V(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp);
    f.pos.copy(pivot).addScaledVector(dir, 3.6);
    f.look.copy(pivot).addScaledVector(dir, -4);
    f.fov = 52;
    f.roll = 0;
    return f;
  }

  /** D4: where David is at shot second t (the choreography: seek-safe, a pure function of t) */
  private d4Pose(t: number, out: { pos: THREE.Vector3; heading: number; speed: number; phase: string }) {
    const d = WORLD_CAM.d4;
    const b = (k: string, f: number) => takeBeat('horizon', k, f);
    const desc = b('descend', 1.2), kneel = b('kneel', 3.4), lift = b('lift', 4.0), setDown = b('setDown', 9.0);
    const w1a = desc + d.d0, w1b = kneel + d.d1, w2a = lift + d.w0, w2b = setDown + d.w1;
    const c1 = this.walk1!, c2 = this.walk2!;
    const lamb = this.tmp.set(d.lamb[0], 0, d.lamb[1]);
    const ewe = this.tmp2.set(d.ewe[0], 0, d.ewe[1]);
    if (t < w2a) {
      // (wave 5) already walking at the cut: slowly up through his sheep (`slow` m/s, his hand on a ewe's back) until
      // `descend`, then on to the lamb (a Hermite profile: from that pace to a standstill beside it)
      const L1 = c1.getLength();
      const s0 = d.slow * Math.max(0, w1a);
      let dist = d.slow * Math.max(0, t), v = d.slow;
      if (t > w1a) {
        const T2 = Math.max(0.3, w1b - w1a), u = clamp01((t - w1a) / T2), R = Math.max(0, L1 - s0), m0 = d.slow * T2;
        dist = s0 + (-2 * u * u * u + 3 * u * u) * R + (u * u * u - 2 * u * u + u) * m0;
        v = t < w1b ? ((-6 * u * u + 6 * u) * R + (3 * u * u - 4 * u + 1) * m0) / T2 : 0;
      }
      const sN = clamp01(dist / L1);
      c1.getPointAt(sN, out.pos);
      out.speed = Math.max(0, v);
      const tan = c1.getTangentAt(Math.min(0.999, Math.max(0.001, sN)), this.tmp3);
      const toLamb = Math.atan2(lamb.x - out.pos.x, lamb.z - out.pos.z);
      // walking: along his way; arriving: he turns to the lamb and kneels facing it
      const hTan = Math.atan2(tan.x, tan.z);
      out.heading = hTan + wrap(toLamb - hTan) * ss(w1b - 0.45, w1b + 0.15, t);
      out.phase = t < w1a ? 'flock' : t < w1b ? 'walk1' : 'kneel1';
      return out;
    }
    // the carry: a calm, even pace with the weight in his arms (no hurry), to the ewe
    const u = clamp01((t - w2a) / (w2b - w2a));
    const ps = 0.6 * u + 0.4 * smoother(u);
    c2.getPointAt(ps, out.pos);
    out.speed = t > w2a && t < w2b ? ((0.6 + 0.4 * 30 * u * u * (u - 1) * (u - 1)) / (w2b - w2a)) * c2.getLength() : 0;
    const tan = c2.getTangentAt(Math.min(0.999, Math.max(0.001, ps)), this.tmp3);
    const hTan = Math.atan2(tan.x, tan.z);
    const toEwe = Math.atan2(ewe.x - out.pos.x, ewe.z - out.pos.z);
    const toLamb = Math.atan2(lamb.x - d.kneel1[0], lamb.z - d.kneel1[1]);
    let hd = toLamb + wrap(hTan - toLamb) * ss(w2a - 0.5, w2a + 0.4, t);
    hd = hd + wrap(toEwe - hd) * ss(w2b - 0.6, w2b + 0.1, t);
    hd = hd + wrap(HANDOFF.heading - hd) * ss(setDown + d.u2 + 0.15, setDown + d.u2 + 1.55, t);
    out.heading = hd;
    out.phase = t < w2b ? 'walk2' : t < setDown + d.u2 ? 'kneel2' : 'stand';
    return out;
  }
  private readonly d4p = { pos: new THREE.Vector3(), heading: 0, speed: 0, phase: '' };
  /** D4: his look target and the lamb's place (own vectors: the model reads them after this tick) */
  private readonly lookV = new THREE.Vector3();
  private readonly lambV = new THREE.Vector3();

  /** D4: the point the lens frames (his head and the lamb, the lamb in his arms, the ewe and her lamb, the flock) */
  private d4Subject(t: number, P: THREE.Vector3, out: THREE.Vector3) {
    const d = WORLD_CAM.d4;
    const b = (k: string, f: number) => takeBeat('horizon', k, f);
    const desc = b('descend', 1.2), lift = b('lift', 4.0), setDown = b('setDown', 9.0), settle = b('settle', 11.4);
    const head = this.tmp3.set(P.x, P.y + 1.45, P.z);
    out.copy(head);
    // among his sheep: his chest and his hand on the ewe's back
    out.y -= 0.3 * (1 - ss(desc - 0.3, desc + 0.8, t));
    // the lamb (he goes to it; the gathering framed between his face and his hands)
    const lamb = V(d.lamb[0], 0, d.lamb[1]);
    lamb.y = this.ground(lamb.x, lamb.z) + 0.35;
    const wLamb = 0.45 * ss(desc - 0.4, desc + 1.2, t) * (1 - ss(lift + 0.3, lift + 1.3, t));
    out.lerp(lamb, wLamb);
    // with the lamb in his arms: his chest
    out.y -= 0.2 * ss(lift, lift + 1.2, t) * (1 - ss(setDown - 0.4, setDown + 0.6, t));
    // the ewe and her lamb at her flank
    const ewe = V(d.ewe[0], 0, d.ewe[1]);
    ewe.y = this.ground(ewe.x, ewe.z) + 0.5;
    out.lerp(ewe, 0.38 * ss(setDown - 0.8, setDown + 0.6, t) * (1 - ss(settle - 1.6, settle, t)));
    return out;
  }

  /** D4 at shot second t: the follow lens' channels in David's frame, landing on the gameplay camera at the end */
  private horizonFrame(t: number, out: ShotFrame) {
    const T = takeDur('horizon', 18);
    if (t >= T - 1e-3) {
      const f = this.handoffFrame();
      out.pos.copy(f.pos);
      out.look.copy(f.look);
      out.fov = f.fov ?? 52;
      out.roll = 0;
      return;
    }
    const K = this.craneKeysNow();
    const tt = Math.max(0, t);
    const pose = this.d4Pose(tt, this.d4p);
    const P = pose.pos;
    P.y = this.ground(P.x, P.z);
    // the lens round his feet (az / r / h channels); near the end the frame of the hand-off itself (David's final feet)
    const az = crane(K, 1, tt) * DEG, r = crane(K, 2, tt), hh = crane(K, 3, tt);
    out.pos.set(P.x + Math.sin(az) * r, P.y + hh, P.z + Math.cos(az) * r);
    // (wave 5) over the straw (≈0.7 m) until it settles onto the game's camera
    const gy = this.ground(out.pos.x, out.pos.z) + lerp(1.0, 0.45, ss(takeBeat('horizon', 'settle', 11.4), T - 0.4, tt));
    if (out.pos.y < gy) out.pos.y = gy;
    // the look: at the action's framing point, turned by the biases (sky for the logo, the subject off-centre)
    const S = this.d4Subject(tt, P, this.tmp2);
    const dx = S.x - out.pos.x, dy = S.y - out.pos.y, dz = S.z - out.pos.z;
    let yaw = Math.atan2(dx, dz) + crane(K, 4, tt) * DEG;
    let pitch = Math.atan2(dy, Math.hypot(dx, dz)) + crane(K, 5, tt) * DEG;
    // from `settle` the look eases into the hand-off frame's own (its keys carry the position)
    const settle = takeBeat('horizon', 'settle', 14.6);
    const k = smoother(clamp01((tt - settle) / (T - settle)));
    if (k > 0) {
      const f = this.handoffFrame();
      const fy = Math.atan2(f.look.x - f.pos.x, f.look.z - f.pos.z);
      const fp = Math.atan2(f.look.y - f.pos.y, Math.hypot(f.look.x - f.pos.x, f.look.z - f.pos.z));
      yaw = yaw + wrap(fy - yaw) * k;
      pitch = lerp(pitch, fp, k);
    }
    out.look.set(out.pos.x + Math.sin(yaw) * Math.cos(pitch) * 30, out.pos.y + Math.sin(pitch) * 30, out.pos.z + Math.cos(yaw) * Math.cos(pitch) * 30);
    out.fov = crane(K, 6, tt);
    out.roll = 0.01 * Math.sin(Math.min(1, tt / 9) * Math.PI) * (1 - ss(settle - 1.5, settle, tt));
  }

  /** D4: the lens keys with the hand-off frame as the last one (in David's final frame) */
  private craneKeysNow(): number[][] {
    const K = this.craneKeys;
    const base = WORLD_CAM.horizon.keys;
    K.length = 0;
    for (const k of base) K.push(k.slice());
    const T = takeDur('horizon', 18);
    const f = this.handoffFrame();
    const Fx = HANDOFF.x, Fz = HANDOFF.z, Fy = this.ground(Fx, Fz);
    const dx = f.pos.x - Fx, dz = f.pos.z - Fz;
    const last = base[base.length - 1];
    const near = (deg: number, ref: number) => ref + ((((deg - ref) % 360) + 540) % 360) - 180;
    K.push([T, near(Math.atan2(dx, dz) / DEG, last[1]), Math.hypot(dx, dz), f.pos.y - Fy, 0, 0, f.fov ?? 52]);
    return K;
  }

  // ---------------------------------------------------------------------------------------------- staging
  /** Stage the world for a take (on the cut into it). */
  enter(take: string) {
    const { player } = this.h;
    const m = player.model;
    m.resetDynamics();
    // (wave 6) the cloth and the sling's cords settle from the NEW place: reset again on the take's first two frames
    // (the first re-init still sees the skeleton's matrices from before the teleport — the cords were stretched across
    // the frame at D4's cut-in)
    this.resetFrames = 2;
    this.eweLine = null;
    if (take === 'rachel-dawn' || take === 'bethlehem') {
      const key = take === 'rachel-dawn' ? 'rachel' : 'bethlehem';
      if (this.staged !== key) {
        this.unstage();
        this.staged = key;
        if (take === 'rachel-dawn') {
          // visual-bible 3.10: no cypress by the tomb; and nothing between the lens and the crossing flock (director-
          // notes-v5 P3: "seen, not hidden by bushes") — cleared for the take only, put back when the film leaves
          this.clearRachelCorridor();
          const dir = this.tmp2.copy(this.crossA).sub(this.crossB).setY(0).normalize();
          this.placeShepherd(0);
          try {
            this.ff.stageFollow(() => this.h.player.pos, dir, { count: 11, back: [1.4, 9.0], spread: 1.6 });
          } catch (e) {
            console.warn('[film] P3 flock', e);
          }
        } else {
          // P2: the shepherd and his flock on a terrace (small in the frame), the morning smoke from a few roofs
          this.placeP2Shepherd(0);
          try {
            this.ff.stageFollow(() => this.h.player.pos, this.p2Walk.dir, { count: 14, back: [2.0, 11], spread: 3.5 });
          } catch (e) {
            console.warn('[film] P2 flock', e);
          }
          this.startSmoke();
        }
      }
      m.performFilm(null);
      m.hold = 'none';
      m.lookTarget = null;
      this.expK = take === 'rachel-dawn' ? WORLD_CAM.rachel.exp : WORLD_CAM.bethlehem.exp;
      return;
    }
    // David and the flock: everything back near the pasture
    if (this.staged === 'rachel' || this.staged === 'bethlehem') this.unstage();
    this.hideBear();
    if (take === 'watch' || take === 'horizon') {
      // D3 / D4 (wave 5: a staging each — D4 is among his sheep, a cut later): David above his flock / walking through it
      const key = take === 'watch' ? 'end3' : 'end4';
      if (this.staged !== key) {
        if (this.staged !== 'end3' && this.staged !== 'end4') this.unstage();
        this.staged = key;
        if (take === 'watch') this.placeDavid(WORLD_CAM.watch.heading, WORLD_CAM.d4.stand);
        else {
          const p0 = this.d4Pose(0, this.d4p);
          this.placeDavid(p0.heading, [p0.pos.x, p0.pos.z]);
        }
        this.stageEnd(take);
      }
      if (take === 'watch') this.placeDavid(WORLD_CAM.watch.heading, WORLD_CAM.d4.stand);
      this.lastD4 = -1;
      this.expK = 1;
      return;
    }
    if (take === 'figure' || take === 'face' || take === 'vista' || take === 'glimpse:rock' || take === 'glimpse:hand') {
      // F1: on the crest above his rock, facing the low sun; the others on his rock
      if (take === 'glimpse:rock') {
        const C = this.crestSpot(this.tmp);
        this.placeDavid(Math.atan2(this.sunH.x, this.sunH.z), [C.x, C.z]);
      } else this.placeDavid();
      if (this.staged !== 'david') {
        this.unstage();
        this.staged = 'david';
        this.saveFlock(); // (wave 5) the game's own places first (F2 moves a few sheep itself)
        this.stageFlockInView();
      }
      this.expK = take === 'figure' ? WORLD_CAM.figure.exp : 1;
    }
  }

  /** undo the current staging (flock, vegetation, the lamb, smoke) */
  private unstage() {
    if (!this.staged) return;
    this.ff.restore();
    this.restoreFlock();
    this.putTreesBack();
    this.stopSmoke();
    this.releaseLamb(false);
    this.staged = '';
  }

  /** P3: the shepherd on the crossing line behind the stone at shot second t (frame right -> left toward the stone) */
  private placeShepherd(t: number) {
    const A = this.crossA, B = this.crossB;
    const dir = this.tmp.set(A.x - B.x, 0, A.z - B.z);
    dir.normalize();
    const w = WORLD_CAM.rachel.walk;
    const s = 4.0 + w * t;
    this.movePlayer(B.x + dir.x * s, B.z + dir.z * s, Math.atan2(dir.x, dir.z), w);
  }

  /** P2: the shepherd walking his terrace (from beats.flock; before it he stands at the head of his flock) */
  private placeP2Shepherd(t: number) {
    const c = WORLD_CAM.bethlehem;
    const go = Math.max(0, t - takeBeat('bethlehem', 'flock', 2.2) + 1.2);
    const s = go * c.walk;
    const W = this.p2Walk;
    this.movePlayer(W.start.x + W.dir.x * s, W.start.z + W.dir.z * s, Math.atan2(W.dir.x, W.dir.z), go > 0 ? c.walk : 0);
  }

  /** move David without the teleport reset of Player.place (the cloth and hair keep simulating): Player.update syncs */
  private movePlayer(x: number, z: number, heading: number, speed: number) {
    const p = this.h.player;
    if (Math.hypot(p.pos.x - x, p.pos.z - z) > 3) p.place(x, z, heading);
    p.pos.x = x;
    p.pos.z = z;
    p.pos.y = this.ground(x, z);
    p.heading = heading;
    p.speed = speed;
  }

  /** one spare grass pusher (3-5; gameplay uses 0-2) at x / z, radius r */
  private setPusher(k: number, x: number, z: number, r: number) {
    const pu = shared.uPushers.value as THREE.Vector4[];
    if (pu.length > k) pu[k].set(x, this.ground(x, z), z, r);
  }

  /** D3 / D4: the grass pressed round the newborn (on the ground) and round its ewe / the nursing pair */
  private pushFamily() {
    const lamb = this.h.flock.lamb;
    if (lamb.state !== 'carried') this.setPusher(3, lamb.position.x, lamb.position.z, 1.3);
    else this.setPusher(3, 0, 0, 0);
    const e = this.cast.ewe;
    if (e) this.setPusher(4, e.position.x, e.position.z, 1.4);
    const n = this.cast.nurseEwe;
    if (n && (this.staged === 'end3' || this.staged === 'end4')) this.setPusher(5, n.position.x, n.position.z, 1.3);
  }

  /** spare grass pushers 3-5 back to rest (gameplay uses 0-2) */
  private clearPushers() {
    const pu = shared.uPushers.value as THREE.Vector4[];
    for (let k = 3; k < Math.min(6, pu.length); k++) pu[k].set(0, -999, 0, 0);
  }

  /** the grass right in front of a low lens pressed down (pushers 3-5): no flat blades across the lens */
  private pushGrassAtLens(dir: THREE.Vector3) {
    const pu = shared.uPushers.value as THREE.Vector4[];
    if (pu.length < 6) return;
    const cp = this.h.engine.camera.position;
    for (let k = 0; k < 3; k++) {
      const x = cp.x + dir.x * (0.9 + 1.3 * k), z = cp.z + dir.z * (0.9 + 1.3 * k);
      pu[3 + k].set(x, this.ground(x, z), z, 1.7);
    }
  }

  /** The film leaves the world for a film set / black: the world's own exposure comes back first. */
  suspend() {
    this.restoreGlimpseGrade();
    this.h.player.model.filmGripOpen = false;
    this.restoreExposure();
  }

  /** Per frame (world takes): the actors' performance. `t` = shot seconds. */
  tick(take: string, t: number, dt: number) {
    const { player } = this.h;
    const m = player.model;
    if (take !== 'glimpse:rock' && take !== 'glimpse:hand') {
      this.restoreGlimpseGrade();
      m.filmGripOpen = false;
    }
    if (this.resetFrames > 0) {
      this.resetFrames--;
      m.resetDynamics();
    }
    this.setExposure(this.expK);
    this.tickBirds(take, t);
    switch (take) {
      case 'bethlehem': {
        this.clearPushers();
        this.placeP2Shepherd(t);
        m.speed = player.speed;
        this.ff.tick(t, dt, this.h.engine.camera);
        this.tickSmoke();
        return;
      }
      case 'rachel-dawn': {
        this.placeShepherd(t);
        // the grass pressed in front of the lens, round the shepherd and through his drove (they read over the straw)
        const cp = this.h.engine.camera.position;
        this.setPusher(3, cp.x + this.axis.x * 1.3, cp.z + this.axis.z * 1.3, 1.7);
        this.setPusher(4, player.pos.x, player.pos.z, 1.5);
        const dw = this.tmp.copy(this.crossB).sub(this.crossA).setY(0).normalize();
        this.setPusher(5, player.pos.x + dw.x * 4, player.pos.z + dw.z * 4, 2.6);
        m.speed = WORLD_CAM.rachel.walk;
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      }
      case 'glimpse:rock':
      case 'glimpse:hand':
        // F1 / F2 (wave 5): the boy of D1, seen only in flashes; the grade cooler and softer (restored on the next cut)
        this.clearPushers();
        m.performFilm('back', 1.2 + t, { wind: 2.4 });
        m.filmGripOpen = take === 'glimpse:hand' && t < WORLD_CAM.glimpseHand.close;
        if (take === 'glimpse:hand') this.passingSheep(t);
        this.applyGlimpseGrade();
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      case 'figure':
        this.clearPushers();
        // (wave 6) at `turn` a lamb bleats below and he begins to turn his head into the light — D2 continues the same turn
        m.performFilm('back', t, { look: this.faceCam, turnAt: takeBeat('figure', 'turn', 5.0), turnDur: WORLD_CAM.face.turnDur });
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      case 'face':
        this.clearPushers();
        // (wave 6) the turn begun in D1 at its `turn` beat continues across the cut at the same speed (a cut on action);
        // at `lookDown` his eyes go down to his flock on the slope below (D3 is what he sees)
        m.performFilm('reveal', t, {
          look: this.faceCam,
          turnAt: takeBeat('face', 'turn', 0.1) - 0.1 - (takeDur('figure', 5.5) - takeBeat('figure', 'turn', 5.0)),
          turnDur: WORLD_CAM.face.turnDur,
          offLens: 0,
          lookDownAt: takeBeat('face', 'lookDown', 3.3),
          lookDown: this.flockBelow,
        });
        this.ff.tick(t, dt, this.h.engine.camera);
        return;
      case 'watch': {
        // D3: on his rock, watching his flock below (the head following it), the wind in his curls; the cast lives.
        // (wave 6) from `walk` he starts down the slope toward them (the dissolve into D4 rides his steps)
        const wk = takeBeat('watch', 'walk', 6.2);
        if (t > wk) {
          const st = WORLD_CAM.d4.stand, wh0 = WORLD_CAM.watch.heading;
          const tau = t - wk, v1 = 0.85, ramp = 0.6;
          const dist = tau < ramp ? (v1 * tau * tau) / (2 * ramp) : v1 * (tau - ramp / 2);
          this.movePlayer(st[0] + Math.sin(wh0) * dist, st[1] + Math.cos(wh0) * dist, wh0, v1 * Math.min(1, tau / ramp));
          m.hold = 'none';
          m.speed = player.speed;
        } else if (this.lastWatch > wk) this.placeDavid(WORLD_CAM.watch.heading, WORLD_CAM.d4.stand);
        this.lastWatch = t;
        this.feet.copy(player.pos);
        // the grass pressed round the newborn on the rocks and the nursing pair (they read over the straw), and in
        // front of the lens
        this.pushFamily();
        const cp = this.h.engine.camera.position, wh = WORLD_CAM.watch.heading;
        this.setPusher(5, cp.x + Math.sin(wh) * 1.3, cp.z + Math.cos(wh) * 1.3, 1.6);
        m.performFilm('watch', t, { gaze: this.flockGaze(), wind: 1.7 });
        this.ff.tick(t, dt, this.h.engine.camera);
        this.tickCast(-1, t, dt);
        return;
      }
      case 'horizon':
        this.clearPushers();
        this.tickD4(t, dt);
        this.pushFamily();
        return;
      case 'vista':
        m.performFilm('wide', t);
        return;
    }
  }

  /** D3: where his flock grazes, as a turn of his head (rad, + = to his left) from his facing */
  private flockGaze(): number {
    const list = this.ff.animals;
    if (!list.length) return 0.1;
    let x = 0, z = 0;
    for (const a of list) {
      x += a.position.x;
      z += a.position.z;
    }
    x = x / list.length - this.feet.x;
    z = z / list.length - this.feet.z;
    const d = Math.atan2(x, z) - WORLD_CAM.watch.heading;
    return Math.atan2(Math.sin(d), Math.cos(d));
  }

  // ---------------------------------------------------------------------------------------------- D3 / D4 staging
  /**
   * D3 + D4 (one staging, the cut between them is continuous): David on his rock; below him the newborn lamb alone on
   * the rocks (flock.lamb), its mother waiting further down (its ewe: flock.lamb.mother), a ewe with a lamb nursing at
   * her flank, a ewe with her lamb, a goat on a boulder, the two rams, and the rest of the flock grazing on the slope in
   * D3's lens (FilmFlock.stageInView, line of sight).
   */
  private stageEnd(take: string) {
    const { flock } = this.h;
    const d = WORLD_CAM.d4;
    const S = D3_STAGE;
    this.saveFlock();
    this.feet.copy(this.h.player.pos);
    const lamb = flock.lamb;
    const ewe = lamb.mother ?? flock.animals.find((a) => a.kind === 'sheep') ?? null;
    const sheep = flock.animals.filter((a) => a.kind === 'sheep' && a !== ewe);
    const used: Animal[] = [lamb];
    const put = (a: Animal, x: number, z: number, heading: number, perch = 0) => {
      a.position.set(x, this.ground(x, z) + perch, z);
      a.perch = perch;
      a.heading = heading;
      a.aiEnabled = false;
      a.state = 'graze';
      a.manualSpeed = 0;
      a.nurse = null;
      a.object.position.copy(a.position);
      used.push(a);
    };
    // the newborn on the rocks below his rock, and its mother further down looking up the slope toward it
    if (lamb.state === 'carried') this.releaseLamb(true);
    put(lamb, d.lamb[0], d.lamb[1], Math.atan2(d.kneel1[0] - d.lamb[0], d.kneel1[1] - d.lamb[1]) - Math.PI / 2);
    (lamb as unknown as { graze: number }).graze = 0;
    this.lambPhase = 'ground';
    if (ewe) put(ewe, d.ewe[0], d.ewe[1], Math.atan2(d.kneel2[0] - d.ewe[0], d.kneel2[1] - d.ewe[1]) + 0.5);
    const S4 = D4_STAGE;
    const forD4 = take === 'horizon';
    // "ewes and their lambs": two more lambs born to two ewes (kept in the game's flock afterwards)
    const lambs = this.ensureLambs(sheep);
    const [ewB, ewC] = [lambs[0]?.mother ?? null, lambs[1]?.mother ?? null];
    const SN = forD4 ? S4.nurse : S.nurse, SE = forD4 ? S4.ewe2 : S.ewe2, SG = forD4 ? S4.goat : S.goatRock, SR = forD4 ? S4.rams : S.rams;
    if (ewB && lambs[0]) {
      put(ewB, SN[0], SN[1], SN[2]);
      put(lambs[0], SN[0] + 0.6, SN[1] - 0.4, SN[2] + Math.PI);
      lambs[0].nurse = ewB;
      lambs[0].nurseFor = 1e9;
    }
    if (ewC && lambs[1]) {
      put(ewC, SE[0], SE[1], SE[2]);
      put(lambs[1], SE[0] + 0.9, SE[1] + 0.5, SE[2] - 0.5);
    }
    // a goat on a boulder (a rock collider with a top: its flat top)
    const goat = flock.animals.find((a) => a.kind === 'goat' && !used.includes(a)) ?? null;
    if (goat) {
      // on the rock's top (the world's placed rocks: the low limestone slabs have no collider)
      const placed = (this.h.engine as unknown as { rocks?: { placed?: { x: number; z: number; s: number; h: number }[] } }).rocks?.placed ?? [];
      const pr = placed.find((r) => Math.hypot(r.x - SG[0], r.z - SG[1]) < 1.2);
      if (pr) put(goat, pr.x, pr.z, SG[2], Math.max(0, pr.h - 0.05));
      else put(goat, SG[0], SG[1], SG[2]);
    }
    // the rams
    const rams = flock.animals.filter((a) => a.kind === 'ram' && !used.includes(a));
    SR.forEach((r, i) => {
      if (rams[i]) put(rams[i], r[0], r[1], r[2]);
    });
    // D4: the ewe walking at his right, his hand on her back (tickCast walks her) — (wave 6) the biggest free ewe that
    // mothers no lamb (her back nearer his hand)
    let guide: Animal | null = null;
    if (forD4) {
      const mothers = flock.animals.filter((a) => a.kind === 'lamb').map((a) => a.mother);
      for (const a of flock.animals) {
        if (a.kind !== 'sheep' || used.includes(a) || mothers.includes(a)) continue;
        if (!guide || a.size > guide.size) guide = a;
      }
      guide ??= flock.animals.find((a) => a.kind === 'sheep' && !used.includes(a)) ?? null;
      if (guide) {
        const g = this.guidePos(0, this.guideV);
        put(guide, g.x, g.z, this.guideHeading);
      }
    }
    this.cast = { ewe, lambs, nurseEwe: ewB, goat, guide };
    // (v9 review) the bush 3.5 m below his stand filled D3's frame: hidden for D3 / D4 (put back when the film leaves —
    // at the hand-off it is just outside the game camera's view)
    if (!this.restoreTrees) {
      try {
        const sc = this.h.engine.scene;
        const r = hideTreesNear(sc, V(-8.9, 0, 14.2), 3.0, ['olive', 'oak', 'terebinth', 'cypress', 'bush']);
        this.restoreTrees = r;
      } catch (e) {
        console.warn('[film] D3 bush', e);
      }
    }
    if (forD4) {
      // D4: the rest of the flock round him in the lens (the light behind them), clear of his way and of the lamb's spots
      const cam4 = this.stageLens('horizon', 2.0);
      const lensTrack: THREE.Vector3[] = [], herTrack: THREE.Vector3[] = [];
      const fr = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
      for (const tl of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12.5]) {
        this.horizonFrame(tl, fr);
        lensTrack.push(fr.pos.clone());
        herTrack.push(this.d4Pose(tl, this.d4p).pos.clone());
      }
      this.d4Pose(0, this.d4p);
      const segs = [d.start, ...d.wayDown, d.kneel1, ...d.wayOn, d.kneel2, d.lamb, d.ewe];
      const avoid = (x: number, z: number) => {
        for (let i = 0; i + 1 < 6; i++) {
          const a = segs[i], c = segs[i + 1];
          const vx = c[0] - a[0], vz = c[1] - a[1], L2 = vx * vx + vz * vz || 1;
          const u = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2));
          if (Math.hypot(x - a[0] - vx * u, z - a[1] - vz * u) < 1.1) return true;
        }
        if (Math.hypot(x - d.lamb[0], z - d.lamb[1]) < 1.4 || Math.hypot(x - d.ewe[0], z - d.ewe[1]) < 1.6) return true;
        for (let i = 0; i < lensTrack.length; i++) {
          // nothing right in front of the lens, nor between it and him
          const L = lensTrack[i], P = herTrack[i];
          if (Math.hypot(x - L.x, z - L.z) < 3.4) return true;
          const vx = P.x - L.x, vz = P.z - L.z, L2 = vx * vx + vz * vz || 1;
          const u = Math.max(0, Math.min(1, ((x - L.x) * vx + (z - L.z) * vz) / L2));
          if (Math.hypot(x - L.x - vx * u, z - L.z - vz * u) < 1.3) return true;
        }
        return false;
      };
      try {
        this.ff.stageInView(cam4, this.feet, { near: 4.0, far: 18, max: 11, clear: 0.12, spacing: 1.5, yMin: -0.8, minFrom: this.feet, minDist: 1.2, maxDist: 12, avoid, exclude: used.concat(guide ? [guide] : []), sheepFirst: true, walk: 0.12 });
      } catch (e) {
        console.warn('[film] D4 flock staging', e);
      }
      return;
    }
    // the rest of the flock in D3's lens: on the slope below him, in sight, 8-32 m from him
    const cam = this.stageLens('watch', 3.5);
    try {
      const rocks = (x: number, y: number, z: number) => this.h.engine.colliders.solidAt(x, y, z, 0.05);
      // (v9 review: 10-15 animals within 6-20 m on the slope below and beside him, readable at 640x360)
      const sector: [number, number] = [WORLD_CAM.watch.heading - 0.6, WORLD_CAM.watch.heading + 0.55];
      let n = this.ff.stageInView(cam, this.feet, { near: 5, far: 24, max: 9, clear: 0.1, spacing: 1.7, yMin: -0.75, minFrom: this.feet, minDist: 6, maxDist: 20, sector, maxY: this.feet.y - 0.8, lineOfSight: true, solid: rocks, exclude: used, sheepFirst: true });
      if (n < 6) n = this.ff.stageInView(cam, this.feet, { near: 5, far: 30, max: 9, clear: 0.1, spacing: 1.6, yMin: -0.75, minFrom: this.feet, minDist: 6, maxDist: 24, maxY: this.feet.y - 0.5, exclude: used, sheepFirst: true });
      void n;
    } catch (e) {
      console.warn('[film] D3 flock staging', e);
    }
    this.lambPhase = 'ground';
  }

  /** the two extra lambs and their ewes (created once; they stay in the game's flock — "ewes and their lambs") */
  private ensureLambs(sheep: Animal[]): Animal[] {
    const { flock } = this.h;
    const have = flock.animals.filter((a) => a.kind === 'lamb' && a !== flock.lamb);
    const S = D3_STAGE;
    while (have.length < S.extraLambs && sheep.length > have.length) {
      const mother = sheep[(have.length * 5 + 3) % sheep.length];
      if (have.some((l) => l.mother === mother)) break;
      have.push(flock.addLamb(mother));
    }
    return have;
  }

  /** D3 / D4: the key animals' life (t: D4 shot seconds, or -1 in D3 with t3 = D3 shot seconds) */
  private tickCast(t: number, t3: number, dt: number) {
    const { flock } = this.h;
    const c = this.cast;
    const lamb = flock.lamb;
    void dt;
    // the goat on its rock: it stands and looks about (no walking off the top)
    if (c.goat) {
      c.goat.manualSpeed = 0;
      c.goat.state = 'graze';
      (c.goat as unknown as { graze: number }).graze = 0;
    }
    if (t < 0) {
      // D3: the newborn on the rocks, nosing about, a little apart from the flock; its mother grazing below
      if (lamb.state !== 'carried') {
        lamb.state = 'walk';
        lamb.manualSpeed = t3 > 2 && t3 < 2.6 ? 0.2 : 0;
        (lamb as unknown as { graze: number }).graze = 0.4;
      }
      if (c.ewe) {
        c.ewe.state = 'graze';
        c.ewe.manualSpeed = 0;
      }
      return;
    }
    // D4: the ewe at his side (his hand on her back), then grazing where she stopped
    const g = c.guide;
    if (g) {
      const gp = this.guidePos(t, this.guideV);
      g.aiEnabled = false;
      g.position.copy(gp);
      g.object.position.copy(gp);
      g.heading = this.guideHeading;
      g.state = this.guideSpeed > 0.02 ? 'walk' : 'graze';
      g.manualSpeed = this.guideSpeed;
    }
    // D4: the bleats (heads up, mouths open: the score plays the sounds — FilmWorld.bleatSound), on crossings
    for (const b of D4_BLEATS) {
      if (this.lastD4 < b.t && t >= b.t && t - b.t < 0.25) {
        const a = b.who === 'lamb' ? lamb : c.ewe;
        if (!a) continue;
        if (FilmWorld.bleatSound) a.bleat(b.v);
        else (a as unknown as { bleatT: number }).bleatT = 0.75;
      }
    }
    // the ewe: grazing, her head up and toward the lamb when it bleats, a few steps up toward him as he brings it,
    // then she stands for it (Flock: suckled) and turns to sniff it
    const ewe = c.ewe;
    if (ewe && !ewe.suckled) {
      const al = ewe as unknown as { alert: number; alertDir: number; graze: number };
      const toward = this.d4Lamb(this.tmp3);
      al.alertDir = Math.atan2(toward.x - ewe.position.x, toward.z - ewe.position.z);
      al.alert = t > 0.55 ? 1 : 0;
      const sd = takeBeat('horizon', 'setDown', 11.2);
      const step = t > sd - 2.9 && t < sd - 2.1;
      ewe.state = step ? 'walk' : 'graze';
      ewe.manualSpeed = step ? 0.35 : 0;
      if (step) ewe.heading = al.alertDir;
      al.graze = t > 0.55 ? 0 : 1;
    }
  }

  /** where the newborn is now (world) */
  private d4Lamb(out: THREE.Vector3) {
    const lamb = this.h.flock.lamb;
    if (lamb.state === 'carried') return lamb.object.getWorldPosition(out);
    return out.copy(lamb.position);
  }

  /** D4 per frame: David's walk, kneels and the cradle; the lamb; the cast */
  private tickD4(t: number, dt: number) {
    const { player, flock } = this.h;
    const m = player.model;
    const d = WORLD_CAM.d4;
    const b = (k: string, f: number) => takeBeat('horizon', k, f);
    const lamb0 = b('lamb', 0.3), kneel = b('kneel', 3.4), lift = b('lift', 4.0), setDown = b('setDown', 9.0), settle = b('settle', 11.4);
    const T = takeDur('horizon', 14);
    const pose = this.d4Pose(t, this.d4p);
    this.movePlayer(pose.pos.x, pose.pos.z, pose.heading, pose.speed);
    this.feet.copy(player.pos);
    // the holds: walking through his sheep (the staff in his hand) · kneeling to the lamb · the cradle · kneeling to set
    // it down · standing (the game's idle)
    const kneel1 = t >= kneel + d.k1 && t < lift + d.u1;
    const kneel2 = t >= setDown + d.k2 && t < setDown + d.u2;
    const carrying = t >= lift + d.u1 && t < setDown + d.k2;
    m.performFilm('gather', t, { releaseAt: settle, endAt: T, wind: 1.6 });
    m.hold = kneel1 || kneel2 ? 'kneel' : carrying ? 'cradle' : 'none';
    m.speed = player.speed;
    // (wave 5) the gathering, with weight and care: both hands slide under its chest and belly (the trunk bends over it),
    // it comes up level and in to his chest (the legs hanging, then folding under it), a breath with it held close, then
    // he rises under its weight (the chest back, the head down to it); set down: lowered, the legs reaching for the
    // ground, the hands let go
    const reachIn = ss(lift + d.r0, lift - 0.02, t), reachOut = 1 - ss(setDown + d.s2, setDown + d.s2 + 0.45, t);
    m.cradleReach = Math.min(reachIn, reachOut);
    m.cradleBend = Math.max(
      // (the bend only once the knee is down: no jackknife from straight legs)
      ss(kneel + d.k1 + 0.6, lift + 0.1, t) * (1 - ss(lift + 0.35, lift + d.l1, t)),
      ss(setDown + d.k2 + 0.2, setDown + d.s0 + 0.25, t) * (1 - ss(setDown + d.s2, setDown + d.u2 + 0.3, t)),
    );
    const rise = lift + d.u1;
    m.cradleEffort = Math.max(0.55 * ss(lift, lift + 0.45, t) * (1 - ss(lift + 0.7, rise, t)), ss(rise - 0.1, rise + 0.45, t) * (1 - ss(rise + 0.8, rise + 1.5, t)));
    m.staffCrookW = ss(kneel + d.k1 - 0.15, kneel + d.k1 + 0.45, t) * (1 - ss(setDown + d.u2 + 0.1, setDown + d.u2 + 0.75, t));
    // his right palm resting ON the wool of the ewe walking at his side (the staff in his left): it rides her back's bob
    // and sway and strokes it a little, then lifts off as he goes to the lamb (wave 6: measured on her mesh — never into
    // her)
    // (wave 6) after the dissolve: the reach (the hand comes up from its swing to a hand's breadth over her back), the
    // touch (it settles onto the wool), a stroke back along her back as they walk, the lift (up off the wool, then back
    // to its swing)
    const guide = this.cast.guide;
    const [tR, tC, tL] = d.touch;
    const wHand = guide ? ss(tR, tC - 0.05, t) * (1 - ss(tL + 0.12, d.guideOff, t)) : 0;
    const hover = 0.075 * (1 - ss(tC - 0.28, tC, t)) + 0.085 * ss(tL, tL + 0.32, t);
    m.filmHandR = null;
    m.filmHandRW = 0;
    if (guide && wHand > 0.001) {
      const c = this.ewePalm(guide, ss(tC - 0.1, tL + 0.15, t), hover);
      c.w = wHand;
      m.filmPalm.R = c;
    } else m.filmPalm.R = null;
    this.syncLamb(t);
    // where he looks: out over his flock as he walks · the lamb (from its bleat) · the lamb in his arms · his way and its
    // mother, with a look down to the lamb · the lamb at her flank · out over his flock and the valley
    const look = this.lookV;
    const lambW = this.d4Lamb(this.lambV);
    lambW.y += 0.3;
    const over = V(player.pos.x + Math.sin(HANDOFF.heading) * 14, player.pos.y - 2.4, player.pos.z + Math.cos(HANDOFF.heading) * 14);
    if (t < lamb0 + 0.55) m.lookTarget = look.copy(over);
    else if (t < rise + 0.9) {
      m.lookTarget = look.copy(lambW);
      // (wave 6) a glance down at the ewe as his hand comes onto her back, then on to the lamb
      const g = guide ? ss(tR - 0.1, tC - 0.1, t) * (1 - ss(tC + 0.4, tC + 0.85, t)) : 0;
      if (g > 0.001) look.lerp(this.tmp3.copy(guide!.position).setY(guide!.position.y + 0.55), 0.7 * g);
    }
    else if (t < setDown + d.u2 + 0.9) {
      const glance = ss(rise + 1.7, rise + 2.0, t) * (1 - ss(rise + 2.6, rise + 2.9, t));
      const ewe = V(d.ewe[0], this.ground(d.ewe[0], d.ewe[1]) + 0.55, d.ewe[1]);
      const ahead = V(player.pos.x + Math.sin(pose.heading) * 6, player.pos.y - 0.6, player.pos.z + Math.cos(pose.heading) * 6);
      ahead.lerp(ewe, ss(lift + d.w0 + 0.6, setDown - 0.9, t));
      if (t > setDown + d.k2 - 0.2) ahead.copy(lambW);
      m.lookTarget = look.copy(ahead).lerp(lambW, glance * 0.85);
    } else {
      m.lookTarget = look.copy(lambW).lerp(over, ss(settle + d.g0, settle + d.g0 + 1.4, t));
      if (t > settle + 1.2) m.lookTarget = null;
    }
    this.ff.tick(t, dt, this.h.engine.camera);
    this.tickCast(t, t, dt);
    this.lastD4 = t;
    void flock;
  }
  private readonly handV = new THREE.Vector3();
  // (wave 6) contacts measured on the animals' meshes
  private readonly ray = new THREE.Raycaster();
  private readonly palmE = { point: new THREE.Vector3(), normal: new THREE.Vector3(), fingers: new THREE.Vector3(), w: 0 };
  /** the stroke line on the guide ewe's back: surface points and normals in her body bone's frame (sampled once a take) */
  private eweLine: { a: Animal; pts: THREE.Vector3[]; ns: THREE.Vector3[] } | null = null;

  /** the animal's posed body meshes (not the wool shells) */
  private bodyMeshes(a: Animal): THREE.Object3D[] {
    const ms = (a as unknown as { meshes: THREE.SkinnedMesh[] }).meshes.filter((x) => !x.geometry.getAttribute('aShell'));
    const vis = ms.filter((x) => x.visible);
    return vis.length ? vis : ms;
  }

  /**
   * D4: his right palm on the walking ewe's back — ON her wool, on the near side of her spine behind the withers; `s`
   * (0..1) strokes it back along her back, `hover` (m) holds it off the wool. The surface: rays down onto her posed body
   * mesh along the stroke, once a take, kept in her body bone's frame (so the hand rides her bob and sway); her wool's
   * outer shell lies ≈ EWE_STROKE.wool over that mesh on her back (Flock's shells: L·t along the normal, L·droop·t² down,
   * L 0.028, droop 0.5); the palm presses EWE_STROKE.press into it.
   */
  private ewePalm(e: Animal, s: number, hover: number) {
    const c = this.palmE;
    const B = (e as unknown as { bones: THREE.Bone[] }).bones[0];
    B.updateWorldMatrix(true, true);
    const K = EWE_STROKE;
    let line = this.eweLine;
    if (!line || line.a !== e) {
      line = this.eweLine = { a: e, pts: [], ns: [] };
      const inv = this.tmpM.copy(B.matrixWorld).invert();
      const down = this.tmp3.setFromMatrixColumn(B.matrixWorld, 1).normalize().negate();
      const meshes = this.bodyMeshes(e);
      for (let i = 0; i < K.n; i++) {
        const z = K.z0 + ((K.z1 - K.z0) * i) / (K.n - 1);
        this.ray.set(B.localToWorld(this.tmp2.set(K.x, 0.6, z)), down);
        this.ray.far = 1.2;
        let hit: THREE.Intersection | undefined;
        try {
          hit = this.ray.intersectObjects(meshes, false)[0];
        } catch (err) {
          console.warn('[film] ewe back', err);
        }
        const p = hit ? hit.point.clone() : B.localToWorld(V(K.x, K.y, z));
        const n = hit?.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : down.clone().negate();
        if (n.dot(down) > -0.3) n.copy(down).negate();
        line.pts.push(p.applyMatrix4(inv));
        line.ns.push(n.transformDirection(inv));
      }
    }
    const f = clamp01(s) * (K.n - 1), i = Math.min(K.n - 2, Math.floor(f)), u = f - i;
    c.point.lerpVectors(line.pts[i], line.pts[i + 1], u).applyMatrix4(B.matrixWorld);
    c.normal.lerpVectors(line.ns[i], line.ns[i + 1], u).transformDirection(B.matrixWorld);
    c.point.addScaledVector(c.normal, K.wool - K.press + hover);
    // the fingers spread over her back, away from him and a little forward (along the forearm)
    const h = e.heading;
    c.fingers.set(-Math.cos(h) + Math.sin(h) * 0.45, 0, Math.sin(h) + Math.cos(h) * 0.45).normalize();
    return c;
  }
  private readonly tmpM = new THREE.Matrix4();

  /** the outside of the lamb's belly wool in its body-centre frame (m, < 0): a ray up from the ground under it */
  private measureBelly(lamb: Animal): number {
    try {
      lamb.object.updateWorldMatrix(true, true);
      const rc = (lamb as unknown as { rig: { center: number[] } }).rig.center;
      const cy = lamb.object.position.y + rc[1] * lamb.size;
      this.ray.set(this.tmp2.set(lamb.position.x, lamb.position.y + 0.02, lamb.position.z), V(0, 1, 0));
      this.ray.far = 0.6;
      const hit = this.ray.intersectObjects(this.bodyMeshes(lamb), false)[0];
      if (hit && hit.point.y < cy) return hit.point.y - cy - 0.022; // + its wool (the shells: ≈1.8 cm + droop)
    } catch (e) {
      console.warn('[film] lamb belly', e);
    }
    return -0.145;
  }
  private readonly guideV = new THREE.Vector3();
  private readonly gp = { pos: new THREE.Vector3(), heading: 0, speed: 0, phase: '' };
  private guideHeading = 0;
  private guideSpeed = 0;
  /** D4: the ewe walking at his left with his hand on her back (seek-safe); after he lets go she walks on a step and
   *  stops to graze */
  private guidePos(t: number, out: THREE.Vector3): THREE.Vector3 {
    const d = WORLD_CAM.d4;
    const p = this.d4Pose(Math.min(t, d.guideOff), this.gp);
    const h = p.heading, fx = Math.sin(h), fz = Math.cos(h);
    out.set(p.pos.x - Math.cos(h) * d.guide[0] + fx * d.guide[1], 0, p.pos.z + Math.sin(h) * d.guide[0] + fz * d.guide[1]);
    // (wave 6) let go: she walks on at his pace, slowing to a stop over 1.8 s and easing off to her right (away from him,
    // clear of his kneel), then grazes
    const v0 = p.speed, T = 1.8;
    const tau = Math.min(Math.max(0, t - d.guideOff), T);
    const turn = -0.6 * ss(0, 1.4, tau);
    const run = v0 * (tau - (tau * tau) / (2 * T));
    out.x += Math.sin(h + turn * 0.5) * run;
    out.z += Math.cos(h + turn * 0.5) * run;
    out.y = this.ground(out.x, out.z);
    this.guideHeading = h + turn;
    this.guideSpeed = t < d.guideOff ? p.speed : v0 * Math.max(0, 1 - tau / T);
    return out;
  }
  private readonly lookFaceV = new THREE.Vector3();

  /**
   * D4: the newborn lamb's state from the shot time (seek-safe): on the ground at its spot (bleating, looking at him as
   * he comes) · in his arms (Flock 'arms', DavidModel.cradle: lifted from the ground to his chest and carried) · set
   * down at its mother's side and gone to her flank to nurse (Flock nurse).
   */
  private syncLamb(t: number) {
    const { flock, player } = this.h;
    const m = player.model;
    const lamb = flock.lamb;
    const d = WORLD_CAM.d4;
    const lift = takeBeat('horizon', 'lift', 4.0), setDown = takeBeat('horizon', 'setDown', 9.0);
    const want = t < lift + d.r0 - 0.1 ? 'ground' : t < setDown + d.s2 ? 'arms' : 'free';
    if (want !== this.lambPhase) {
      if (want === 'ground') {
        this.releaseLamb(true);
        lamb.nurse = null;
        lamb.position.set(d.lamb[0], this.ground(d.lamb[0], d.lamb[1]), d.lamb[1]);
        lamb.object.position.copy(lamb.position);
        // (wave 5/6) standing side-on to where he will kneel, its left toward him and its head to his left — as it will lie
        // in his arms (no spin at the lift)
        lamb.heading = Math.atan2(d.kneel1[0] - d.lamb[0], d.kneel1[1] - d.lamb[1]) - Math.PI / 2;
      } else if (want === 'arms') {
        lamb.nurse = null;
        // its pose where it stands (the cradle blends from it)
        const L0 = V(d.lamb[0], this.ground(d.lamb[0], d.lamb[1]), d.lamb[1]);
        const toHim = Math.atan2(d.kneel1[0] - L0.x, d.kneel1[1] - L0.z) - Math.PI / 2;
        this.lambFrom.compose(L0, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), toHim), V(lamb.size, lamb.size, lamb.size));
        // (wave 6) where its belly's wool really is (measured on its mesh while it stands): his palms go there, not
        // through it
        const belly = this.measureBelly(lamb);
        lamb.setCarried('arms');
        const rc = (lamb as unknown as { rig: { center: number[] } }).rig.center;
        this.lambCenter.set(rc[0], rc[1], rc[2]);
        m.cradle = { obj: lamb.object, center: this.lambCenter, from: this.lambFrom, lift: 0, belly };
      } else {
        this.releaseLamb(true);
        // let go at its mother's side: it goes to her flank and nurses
        if (this.cast.ewe) {
          lamb.nurse = this.cast.ewe;
          lamb.nurseFor = 1e9;
        }
      }
      this.lambPhase = want;
    }
    if (want === 'ground') {
      // alone on the rocks: it bleats (tickCast), its head turns to him as he comes, a hesitant step
      const al = lamb as unknown as { alert: number; alertDir: number; graze: number };
      lamb.aiEnabled = false;
      lamb.state = 'graze';
      lamb.manualSpeed = 0;
      al.graze = 0;
      al.alert = t > takeBeat('horizon', 'lamb', 0.3) + 0.6 ? 1 : 0.4;
      al.alertDir = Math.atan2(player.pos.x - lamb.position.x, player.pos.z - lamb.position.z);
    } else if (want === 'arms' && m.cradle) {
      // lifted with him as he rises; lowered at its mother's side (the ground pose there, facing her)
      const up = ss(lift, lift + d.l1, t);
      const down = ss(setDown + d.s0, setDown + d.s1, t);
      // (wave 5) alive in his hands: the legs hang and paddle as it leaves the ground and fold as it comes to his chest;
      // they reach for the ground as it is set down; it looks up at his face, then about; toward its mother at the end
      lamb.cradleFold = ss(lift + 0.3, lift + d.l1 + 0.15, t) * (1 - ss(setDown + d.s0 - 0.1, setDown + d.s1 - 0.1, t));
      lamb.cradleStir = 0.7 * (1 - ss(lift + 0.45, lift + d.l1 + 0.3, t)) + 0.5 * ss(setDown + d.s0 - 0.2, setDown + d.s1, t);
      const face = m.human?.sockets?.eyeL;
      if (t < lift + d.u1 + 0.6 && face) lamb.cradleLook = face.getWorldPosition(this.lookFaceV);
      else if (t > setDown - 1.0 && this.cast.ewe) lamb.cradleLook = this.lookFaceV.copy(this.cast.ewe.position).setY(this.cast.ewe.position.y + 0.55);
      else lamb.cradleLook = null;
      if (down > 0) {
        const fw = V(d.ewe[0] - d.kneel2[0], 0, d.ewe[1] - d.kneel2[1]).normalize();
        const L1 = V(d.kneel2[0] + fw.x * d.setDownD, 0, d.kneel2[1] + fw.z * d.setDownD);
        L1.y = this.ground(L1.x, L1.z);
        const sideOn = Math.atan2(fw.x, fw.z) + Math.PI / 2;
        this.lambFrom.compose(L1, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), sideOn), V(lamb.size, lamb.size, lamb.size));
      }
      m.cradle.lift = Math.min(up, 1 - down);
    }
  }

  /** the newborn back on its feet in the flock's own space (from his arms: where it is) */
  private releaseLamb(snap: boolean) {
    const { flock, player } = this.h;
    const lamb = flock.lamb;
    const m = player.model;
    if (m.cradle) m.cradle = null;
    m.cradleReach = 0;
    m.cradleBend = 0;
    m.cradleEffort = 0;
    m.staffCrookW = 0;
    m.filmHandR = null;
    m.filmHandRW = 0;
    m.filmPalm.R = null;
    m.filmPalm.L = null;
    lamb.cradleFold = 1;
    lamb.cradleStir = 0;
    lamb.cradleLook = null;
    if (lamb.state === 'carried' && lamb.carryMode === 'arms') {
      if (lamb.object.parent !== flock.group) flock.group.attach(lamb.object);
      lamb.setCarried('none');
      lamb.aiEnabled = false;
      lamb.manualSpeed = 0;
      if (snap) lamb.state = 'graze';
    }
  }

  // ---------------------------------------------------------------------------------------------- focus, subject
  /**
   * The composition's subject of a world take, where it differs from the focus point (phones in portrait re-aim their
   * narrow lens toward it — Intro.portrait). null = use the focus point.
   */
  subject(take: string, out: THREE.Vector3): THREE.Vector3 | null {
    if (take === 'figure') return out.copy(this.rock).add(V(0, 1.35, 0));
    if (take === 'glimpse:rock') return this.crestSpot(out).add(V(0, 1.25, 0));
    if (take === 'glimpse:hand') return this.handOf(out);
    if (take === 'watch') return out.copy(this.feet).add(V(0, 0.4, 0)).addScaledVector(V(Math.sin(WORLD_CAM.watch.heading), 0, Math.cos(WORLD_CAM.watch.heading)), 4.5).setY(this.feet.y + 0.2);
    if (take === 'horizon') return out.copy(this.feet).add(V(0, 1.1, 0));
    if (take === 'bethlehem') return out.set(LAYOUT.bethlehem.x, this.ground(LAYOUT.bethlehem.x, LAYOUT.bethlehem.z) + 6, LAYOUT.bethlehem.z);
    return null;
  }

  /** DoF target of a world take. */
  focus(take: string, t: number): FilmFocus | null {
    const m = this.h.player.model;
    const eye = (out: THREE.Vector3) => {
      const s = m.human?.sockets?.eyeL;
      if (s) return s.getWorldPosition(out);
      return out.copy(this.feet).add(V(0, 1.58, 0));
    };
    switch (take) {
      case 'figure': {
        const p = eye(this.tmp);
        const far = this.tmp2.copy(this.rock).addScaledVector(this.viewDir, 14);
        return { point: p.lerp(far, 0.35 * ss(1.5, 4, t)), fStop: 4 };
      }
      case 'face':
        return { point: eye(this.tmp), fStop: 1.8 };
      case 'glimpse:rock':
        return { point: this.crestSpot(this.tmp).add(V(0, 1.3, 0)), fStop: WORLD_CAM.glimpseRock.fStop };
      case 'glimpse:hand':
        return { point: this.handOf(this.tmp), fStop: WORLD_CAM.glimpseHand.fStop };
      case 'watch': {
        // on the flock below (the nursing ewe), racking back to him at beats.rack
        const c = WORLD_CAM.watch;
        const rack = takeBeat('watch', 'rack', 5.2);
        const k = ss(rack - 0.1, rack + 0.9, t);
        const fl = this.tmp2.set(D3_STAGE.nurse[0], this.ground(D3_STAGE.nurse[0], D3_STAGE.nurse[1]) + 0.5, D3_STAGE.nurse[1]);
        return { point: fl.lerp(eye(this.tmp), k), fStop: lerp(c.fStopFlock, c.fStopHim, k) };
      }
      case 'horizon': {
        // on him (and the lamb in his arms); the stop closes over the settle so nothing is soft at the hand-off
        const c = WORLD_CAM.horizon;
        const T = takeDur('horizon', 18), st = takeBeat('horizon', 'settle', 14.6);
        const p = eye(this.tmp);
        if (t < takeBeat('horizon', 'lift', 5)) p.lerp(this.d4Lamb(this.tmp2), 0.4 * ss(0.4, 1.4, t));
        return { point: p, fStop: lerp(c.fStop0, c.fStop1, ss(1, 6, t)) * (1 + 9 * ss(st, T - 0.4, t)) };
      }
      case 'rachel-dawn':
        return { point: this.tmp.copy(this.pillar).add(V(0, 1.4, 0)), fStop: lerp(5.6, 16, ss(takeBeat('rachel-dawn', 'rise', 4), 6, t)) };
      case 'bethlehem':
        return null;
      default:
        return null;
    }
  }

  private placeDavid(heading = headingOf(this.viewDir), at?: number[]) {
    const { player } = this.h;
    const x = at ? at[0] : this.rock.x, z = at ? at[1] : this.rock.z;
    if (Math.hypot(player.pos.x - x, player.pos.z - z) > 0.3 || Math.abs(player.heading - heading) > 1e-3) {
      player.place(x, z, heading);
    }
    this.feet.copy(player.pos);
    player.speed = 0;
    const m = player.model;
    m.hold = 'hero';
    m.staffMode = 'plant';
    m.lookTarget = null;
  }

  private saveFlock() {
    if (this.saved.length) return;
    for (const a of this.h.flock.animals) this.saved.push({ a, pos: a.position.clone(), heading: a.heading, ai: a.aiEnabled, state: a.state });
  }
  private restoreFlock() {
    for (const s of this.saved) {
      if (s.a.state === 'carried') continue;
      s.a.position.copy(s.pos);
      s.a.heading = s.heading;
      s.a.aiEnabled = s.ai;
      s.a.manualSpeed = 0;
      s.a.state = 'graze';
      s.a.perch = 0;
      s.a.nurse = null;
    }
    this.saved.length = 0;
  }

  /** a stand-in camera at a take's frame (for staging the flock in the lens) — on a phone in portrait the lens the viewer
   *  really has (Intro.portrait / FilmCams.portraitLens) */
  private stageLens(take: string, t: number) {
    const f = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 36, roll: 0 };
    this.frame(take, t / takeDur(take, 6), t, f);
    const el = this.h.engine.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight) || 16 / 9;
    if (aspect < 0.95) portraitLens(f, this.subject(take, this.tmp2) ?? null, aspect, 1);
    const c = this.stageCam;
    c.aspect = aspect < 0.95 ? aspect : Math.max(1.25, this.h.engine.camera.aspect || 16 / 9);
    c.fov = f.fov ?? 36;
    c.position.copy(f.pos);
    c.lookAt(f.look);
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    return c;
  }

  /** D1-D2: the flock grazing and walking below David INSIDE the D1 lens' first frame (FilmFlock.stageInView) */
  private stageFlockInView() {
    const c = this.stageLens('figure', 1.5);
    try {
      let n = this.ff.stageInView(c, this.rock, { near: 7, far: 30, max: 14 });
      if (n < 6) n = this.ff.stageInView(c, this.rock, { near: 9, far: 70, max: 14, clear: 0.15, yMin: -0.68 });
      if (n > 0) return;
    } catch (e) {
      console.warn('[film] flock staging', e);
    }
    this.stageFlockBelow();
  }

  /** fallback: the flock grazing and walking on the slope below David along his gaze */
  private stageFlockBelow() {
    const { flock } = this.h;
    this.saveFlock();
    const D = this.viewDir, S = this.side;
    flock.animals.forEach((a, i) => {
      if (a.state === 'carried') return;
      const f = 15 + ((i * 29) % 23) + (i % 3) * 2.5;
      const s = (((i * 53) % 29) - 14) * 1.1;
      const x = this.rock.x + D.x * f + S.x * s, z = this.rock.z + D.z * f + S.z * s;
      a.position.set(x, this.ground(x, z), z);
      a.heading = Math.atan2(D.x, D.z) + (((i * 17) % 11) - 5) * 0.32;
      a.aiEnabled = false;
      const walks = i % 3 === 1;
      a.state = walks ? 'walk' : 'graze';
      a.manualSpeed = walks ? 0.28 + (i % 4) * 0.05 : 0;
    });
  }

  /** the bear is never in the film (CUT v4: it is seen only after play begins) */
  private hideBear() {
    const { bear } = this.h;
    bear.model.eyeShine = 0;
    bear.model.darkness = 0;
    if (bear.visible) bear.visible = false;
  }

  // ---------------------------------------------------------------------------------------------- P3 vegetation, birds
  /** P3: the cypresses round the pillar (visual-bible 3.10) and every tree / bush in the corridor between the lens and
   *  the crossing flock (director-notes-v5 P3: the flock seen, not hidden by bushes) — put back when the film leaves */
  private clearRachelCorridor() {
    if (this.restoreTrees) return;
    const c = WORLD_CAM.rachel;
    const restores: (() => void)[] = [];
    try {
      const sc = this.h.engine.scene;
      // (no cypress anywhere near the tomb in the frame: visual-bible 3.10 — a later, ornamental planting)
      restores.push(hideTreesNear(sc, this.h.engine.village.rachelPillar, 40));
      const kinds = ['olive', 'oak', 'terebinth', 'cypress', 'bush'];
      // along the lens' track and past the stone to the crossing line, a little wider toward the frame's right
      for (const d of [-c.back0 + 1.5, -c.back0 * 0.5, 0, 4, 9, 14]) {
        const p = this.pillar.clone().addScaledVector(this.axis, d).addScaledVector(this.axisR, d > 0 ? 3.5 : 0.8);
        restores.push(hideTreesNear(sc, p, d > 0 ? 9 : 5.5, kinds));
      }
      // the crane lifts beside the lens and turns north over the road: nothing in its way on that side
      for (const [d, l, r] of [[-c.back1, -6, 7], [-c.back0, -6, 7], [-2, -11, 7]]) {
        const p = this.pillar.clone().addScaledVector(this.axis, d).addScaledVector(this.axisR, l);
        restores.push(hideTreesNear(sc, p, r, kinds));
      }
    } catch (e) {
      console.warn('[film] hideTreesNear', e);
    }
    this.restoreTrees = () => {
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
    };
  }

  private buildBirds() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(28,22,18,1)';
    x.beginPath();
    x.moveTo(2, 9);
    x.quadraticCurveTo(18, 6, 30, 17);
    x.quadraticCurveTo(32, 21, 34, 17);
    x.quadraticCurveTo(46, 6, 62, 9);
    x.quadraticCurveTo(46, 12, 35, 22);
    x.quadraticCurveTo(32, 27, 29, 22);
    x.quadraticCurveTo(18, 12, 2, 9);
    x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0x5a4c40, transparent: true, depthWrite: false, fog: false });
    const group = new THREE.Group();
    group.name = 'film:birds';
    const list: { s: THREE.Sprite; ph: number; k: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.3, 0.15, 1);
      sp.position.set(0, -500, 0);
      group.add(sp);
      list.push({ s: sp, ph: (i * 0.37) % 1, k: i });
    }
    this.h.engine.scene.add(group);
    try {
      this.h.engine.renderer.compile(group, this.h.engine.camera, this.h.engine.scene);
    } catch {
      /* a later first render compiles it */
    }
    group.visible = false;
    this.birds = { group, mat, tex, list };
  }

  /** Birds per take (t = shot seconds): P3 a loose line of five crossing the dawn sky behind the stone, high. */
  private tickBirds(take: string, t: number) {
    const b = this.birds;
    if (!b) return;
    const on = take === 'rachel-dawn';
    b.group.visible = on;
    if (!on) return;
    for (const { s, ph, k } of b.list) {
      const flap = 0.5 + 0.5 * Math.sin((t * 9.5 + ph * 6.28) * (1 + k * 0.07));
      const P = this.pillar;
      const d = 30 + ((k * 7) % 11), lat = 14 - t * (5.2 + (k % 3) * 0.6) + k * 2.2;
      s.position.copy(P).addScaledVector(this.axis, d).addScaledVector(this.axisR, lat);
      s.position.y = this.pillarTop.y + 7 + ((k * 5) % 6) + 0.6 * Math.sin(t * 1.3 + k);
      s.scale.set(0.42, 0.42 * (0.25 + 0.75 * flap) * 0.5, 1);
      s.visible = k < 5;
    }
  }

  // ---------------------------------------------------------------------------------------------- P2 smoke
  /** P2: thin morning smoke from a few roofs (the bread ovens' fires: Village.smokeSources) — film only, lazily built */
  private startSmoke() {
    if (this.smoke || this.smokeP) return;
    const src = this.h.engine.village.smokeSources;
    if (!src.length) return;
    this.smokeP = import('../palace/palaceFx')
      .then(({ Smoke }) => {
        this.smokeP = null;
        if (this.staged !== 'bethlehem') return;
        const tier = this.h.engine.quality.name;
        const list = src.slice(0, tier === 'low' ? 5 : 9).map((p, i) => ({ pos: p, rate: 1, size: 3.2 + (i % 3) * 0.8, height: 16 + (i % 4) * 3, dark: 0.08 }));
        const s = new Smoke(list, tier === 'low' ? 14 : 26);
        s.uniforms.uWind.value.set(0.35, 0.15);
        s.uniforms.uLife.value = 11;
        s.points.name = 'film:smoke';
        this.h.engine.scene.add(s.points);
        this.smoke = s;
      })
      .catch((e) => {
        this.smokeP = null;
        console.warn('[film] smoke', e);
      });
  }
  private tickSmoke() {
    const s = this.smoke;
    if (!s) return;
    const cam = this.h.engine.camera;
    s.setPixelScale(this.h.engine.renderer.domElement.height || 720, cam.fov);
  }
  private stopSmoke() {
    const s = this.smoke;
    this.smoke = null;
    if (!s) return;
    s.points.removeFromParent();
    s.dispose();
  }

  /** F1: his spot on the crest of the ridge above his rock (away from the sun: the land falls away in front of him) */
  private crestSpot(out: THREE.Vector3): THREE.Vector3 {
    const at = WORLD_CAM.glimpseRock.at;
    out.set(this.rock.x - this.sunH.x * at, 0, this.rock.z - this.sunH.z * at);
    out.y = this.ground(out.x, out.z);
    return out;
  }

  /** F2: three sheep walking across behind his hand, a few metres down the slope (out of focus) — seek-safe */
  private passingSheep(t: number) {
    const { flock } = this.h;
    const list = flock.animals.filter((a) => a.kind === 'sheep' && a.state !== 'carried' && a !== flock.lamb && a !== flock.lamb.mother).slice(-3);
    if (!list.length) return;
    this.saveFlock();
    const hand = this.handOf(this.tmp3);
    const D = this.viewDir, S = this.side;
    const lanes = [[4.6, -1.6], [5.6, -0.2], [6.8, -2.6]];
    list.forEach((a, i) => {
      const [f, s0] = lanes[i];
      const sd = s0 + 0.55 * t;
      const x = hand.x + D.x * f + S.x * sd, z = hand.z + D.z * f + S.z * sd;
      a.aiEnabled = false;
      a.position.set(x, this.ground(x, z), z);
      a.object.position.copy(a.position);
      a.heading = Math.atan2(S.x, S.z);
      a.state = 'walk';
      a.manualSpeed = 0.55;
    });
  }

  /** F2: his staff hand (world) */
  private handOf(out: THREE.Vector3): THREE.Vector3 {
    const j = (this.h.player.model as unknown as { j?: Record<string, THREE.Object3D> }).j;
    if (j?.hdL) return j.hdL.getWorldPosition(out);
    return out.copy(this.rock).add(V(0, 1.05, 0)).addScaledVector(this.side, -0.3);
  }

  /** F1 / F2: the flashes' grade over the current one (saved once, given back by restoreGlimpseGrade) */
  private glimpse0: { warm: number; sat: number; contrast: number; desat: number; vignette: number } | null = null;
  private applyGlimpseGrade() {
    const u = this.h.engine.post.grade.uniforms;
    if (!this.glimpse0) this.glimpse0 = { warm: u.uWarm.value, sat: u.uSaturation.value, contrast: u.uContrast.value, desat: u.uDesat.value, vignette: u.uVignette.value };
    const g = WORLD_CAM.glimpseGrade, s0 = this.glimpse0;
    u.uWarm.value = s0.warm + g.warm;
    u.uSaturation.value = s0.sat * g.sat;
    u.uContrast.value = s0.contrast * g.contrast;
    u.uDesat.value = Math.min(1, s0.desat + g.desat);
    u.uVignette.value = s0.vignette + g.vignette;
    this.setExposure(this.expK * g.exp);
  }
  private restoreGlimpseGrade() {
    const s0 = this.glimpse0;
    if (!s0) return;
    const u = this.h.engine.post.grade.uniforms;
    u.uWarm.value = s0.warm;
    u.uSaturation.value = s0.sat;
    u.uContrast.value = s0.contrast;
    u.uDesat.value = s0.desat;
    u.uVignette.value = s0.vignette;
    this.glimpse0 = null;
  }

  /** world exposure × k (k = 1 restores the world's own) */
  private setExposure(k: number) {
    const r = this.h.engine.renderer;
    if (this.exposure0 < 0) this.exposure0 = r.toneMappingExposure;
    r.toneMappingExposure = this.exposure0 * k;
  }

  private restoreExposure() {
    if (this.exposure0 < 0) return;
    this.h.engine.renderer.toneMappingExposure = this.exposure0;
    this.exposure0 = -1;
  }

  private putTreesBack() {
    const r = this.restoreTrees;
    this.restoreTrees = null;
    try {
      r?.();
    } catch (e) {
      console.warn('[film] restore trees', e);
    }
  }

  /**
   * Put the world back for gameplay. `handoff` = the film ended on D4 without a cut: David stays where D4 left him, the
   * staged flock stays where it grazes and the game's flock AI takes it over from there (the pasture moves to where they
   * are: no animal walks off), the lamb keeps nursing a few seconds; otherwise (a skip: under the dissolve) the flock is
   * re-staged round David's hand-off place the same way. Either way the game's flock keeps its two new lambs.
   */
  leave(handoff = false) {
    const { player, flock, bear } = this.h;
    this.clearPushers();
    this.stopSmoke();
    const ended = this.staged === 'end3' || this.staged === 'end4';
    if (handoff && ended) {
      this.ff.release();
    } else {
      // (a skip, or the film left from elsewhere) the end's staging round the hand-off place, at once
      this.ff.restore();
      this.restoreFlock();
      this.putTreesBack();
      this.staged = '';
      this.releaseLamb(true);
      this.unstage();
      this.stageForPlay();
    }
    this.putTreesBack();
    this.restoreGlimpseGrade();
    player.model.filmGripOpen = false;
    this.restoreExposure();
    this.releaseLamb(false);
    player.model.performFilm(null);
    player.model.hold = 'none';
    player.model.lookTarget = null;
    player.model.cradle = null;
    player.model.cradleReach = player.model.cradleBend = player.model.staffCrookW = 0;
    this.saved.length = 0;
    // the flock's own AI from where it grazes now: the pasture round them
    const c = this.tmp.set(0, 0, 0);
    let n = 0;
    for (const a of flock.animals) {
      if (a.state === 'carried') continue;
      a.aiEnabled = true;
      a.manualSpeed = 0;
      a.perch = 0;
      if (a.state === 'walk') a.state = 'graze';
      c.add(a.position);
      n++;
    }
    if (n) {
      c.multiplyScalar(1 / n);
      flock.pastureCenter.set(c.x, c.y, c.z);
      flock.setPasture(c, Math.max(flock.pastureRadius, 22));
    }
    // the nursing lambs go on nursing a little while, then follow their mothers
    for (const a of flock.animals) if (a.nurse) a.nurseFor = Math.min(a.nurseFor, 6 + (a.id % 3) * 2);
    const lamb = flock.lamb as unknown as { alert: number };
    lamb.alert = 0;
    bear.visible = false;
    bear.speed = 0;
    bear.model.lookTarget = null;
    bear.model.eyeShine = 0;
    bear.model.darkness = 0;
    if (this.birds) {
      this.birds.group.removeFromParent();
      this.birds.mat.dispose();
      this.birds.tex.dispose();
      this.birds = null;
    }
    this.staged = '';
  }

  /** after a skip: the end's flock round David's hand-off place (no camera: the stage for play) */
  private stageForPlay() {
    const { flock } = this.h;
    const S = D3_STAGE;
    const sheep = flock.animals.filter((a) => a.kind === 'sheep' && a !== flock.lamb.mother);
    const lambs = this.ensureLambs(sheep);
    const d = WORLD_CAM.d4;
    const place = (a: Animal, x: number, z: number, h: number) => {
      a.position.set(x, this.ground(x, z), z);
      a.heading = h;
      a.object.position.copy(a.position);
      a.state = 'graze';
    };
    const ewe = flock.lamb.mother;
    if (ewe) place(ewe, d.ewe[0], d.ewe[1], HANDOFF.heading + 2.6);
    const lamb = flock.lamb;
    if (lamb.state !== 'carried') {
      place(lamb, d.ewe[0] - 0.4, d.ewe[1] - 0.3, HANDOFF.heading);
      if (ewe) {
        lamb.nurse = ewe;
        lamb.nurseFor = 6;
      }
    }
    lambs.forEach((l, i) => {
      if (l.mother) place(l, l.mother.position.x + 0.7, l.mother.position.z + 0.5, HANDOFF.heading + i);
    });
    // the rest grazing on the slope below and round him (deterministic scatter, 5-26 m)
    let k = 0;
    for (const a of flock.animals) {
      if (a === lamb || a === ewe || lambs.includes(a) || a.state === 'carried') continue;
      const ang = HANDOFF.heading - 1.2 + ((k * 0.61803) % 1) * 2.4;
      const r = 6 + ((k * 0.381966) % 1) * 20;
      place(a, HANDOFF.x + Math.sin(ang) * r, HANDOFF.z + Math.cos(ang) * r, ang + (k % 5) * 0.9);
      k++;
    }
    void S;
  }
}

/** C1 monotone cubic through keys[i][0] (time) -> keys[i][c] (Fritsch-Butland tangents: no overshoot), still at the
 *  first and the last key — the lens channels */
function crane(keys: readonly number[][], c: number, t: number): number {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][c];
  if (t >= keys[n - 1][0]) return keys[n - 1][c];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const slope = (k: number) => (keys[k + 1][c] - keys[k][c]) / (keys[k + 1][0] - keys[k][0]);
  const tan = (k: number) => {
    if (k <= 0 || k >= n - 1) return 0;
    const a = slope(k - 1), b = slope(k);
    if (a * b <= 0) return 0;
    const h0 = keys[k][0] - keys[k - 1][0], h1 = keys[k + 1][0] - keys[k][0];
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const t0 = keys[i][0], hh = keys[i + 1][0] - t0, s = (t - t0) / hh;
  const v0 = keys[i][c], v1 = keys[i + 1][c], m0 = tan(i) * hh, m1 = tan(i + 1) * hh;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1;
}
