import * as THREE from 'three';
import type { Engine, ViewSpec } from '../core/Engine';
import type { Input } from '../core/Input';
import { shared } from '../core/Shared';
import type { UI } from '../ui/UI';
import type { Flock } from '../characters/Flock';
import type { PalaceSet } from '../palace/PalaceSet';
import type { PalaceCast, CastFocus } from '../palace/cast';
import type { CameraRig, Shot, ShotFrame } from './CameraRig';
import { dolly, orbit, V } from './CameraRig';
import type { Player } from './Player';
import type { GameAudio } from './GameAudio';
import { LAYOUT } from '../world/Layout';
import {
  INTRO_CUES, INTRO_CUES_SHORT, INTRO_SHOTS, introLength,
  type IntroBeat, type IntroCue, type IntroShot, type IntroShotId,
} from '../content/introScript';
import { verseArgs, quoteWithRefHtml } from '../content/sources';

/*
 * The chapter-1 opening film: Bethlehem and Gibeah of Saul, intercut (src/content/introScript.ts).
 *
 *   Intro.preload(engine, { short?, onProgress? })   builds Saul's house (src/palace set + cast) and pre-compiles it for
 *                                                    this post chain. Idempotent; best called behind the loading screen
 *                                                    (main.ts); otherwise the intro calls it itself behind a pre-roll card.
 *   const intro = new Intro(host, { short? })        one playback; Story.intro() drives it:
 *   intro.begin()                                    cinematic state + pre-roll; the film starts when the stage is ready
 *   intro.update(dt)                                 per frame from Story's behaviour (BEFORE CameraRig / engine.render)
 *   intro.done / intro.skipped                       end state; intro.skip() jumps to gameplay
 *   intro.finish()                                   idempotent cleanup (also on a cancelled story run)
 *   Intro.release()                                  disposes the palace set + cast (the intro calls it at the end)
 *
 * Rendering: field shots drive engine.camera through the CameraRig (one endless cinematic "shot" that returns this
 * intro's frame); Gibeah shots render the palace scene through the engine's ONE post chain (engine.setView with the
 * stage's own camera), with dissolves captured from the last shown frame (never through black, except the fade in
 * from black at the very start). TAA is reset on every cut; depth of field follows a face / hand per shot on the tiers
 * that have it; the image is letterboxed to 2.39 by the post chain (captions sit above / below the bars).
 */

export interface IntroHost {
  engine: Engine;
  ui: UI;
  input: Input;
  audio: GameAudio;
  cam: CameraRig;
  player: Player;
  flock: Flock;
}

/** Saul's house, built once per intro playback (disposed after it). */
export interface GibeahStage {
  palace: PalaceSet;
  cast: PalaceCast;
  /** the view's own camera (main.ts keeps writing engine.camera every frame) */
  camera: THREE.PerspectiveCamera;
  view: ViewSpec;
  beats: IntroBeat[];
  loadMs: number;
}

export interface IntroPreloadOptions {
  /** build only what the short cut needs (default: engine.quality.mobile) */
  short?: boolean;
  onProgress?: (f: number, label: string) => void;
}

// ------------------------------------------------------------------------------------------------ stage cache
let stageP: Promise<GibeahStage | null> | null = null;
let stageLive: GibeahStage | null = null;
let releaseWanted = false;
let restoreHooked = false;
let progressSink: ((f: number, label: string) => void) | null = null;
let progressF = 0;

const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Unique Gibeah beats of a cut (what the cast has to be built for). */
function gibeahBeats(cues: readonly IntroCue[]): IntroBeat[] {
  return uniq(cues.filter((c) => c.shot && c.world === 'gibeah').map((c) => c.beat));
}

async function buildStage(engine: Engine, beats: IntroBeat[]): Promise<GibeahStage> {
  const t0 = performance.now();
  const prog = (f: number, label: string) => {
    progressF = f;
    progressSink?.(f, label);
  };
  prog(0.02, 'גִּבְעַת שָׁאוּל');
  const [{ PalaceSet }, { PalaceCast }, { palaceView }] = await Promise.all([
    import('../palace/PalaceSet'), import('../palace/cast'), import('../fx/views'),
  ]);
  const palace = await PalaceSet.create({
    renderer: engine.renderer, quality: engine.quality, tex: engine.tex,
    onProgress: (f) => prog(0.03 + f * 0.22, 'גִּבְעַת שָׁאוּל'),
  });
  const cast = await PalaceCast.create(palace, {
    quality: engine.quality.name, msaa: engine.quality.msaa, beats,
    onProgress: (f) => prog(0.25 + f * 0.55, 'בֵּית שָׁאוּל'),
  });
  engine.enforceTextureBudget(palace.scene);
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.08, 26000);
  camera.name = 'intro:gibeah-camera';
  const base = palaceView(palace, { camera });
  const vh = new THREE.Vector2();
  const view: ViewSpec = {
    ...base,
    // the cast first (poses, hair LOD, character lights), then the set (flames, exposure, sky, shadow framing)
    update: (dt, cam) => {
      cast.update(dt, cam, engine.renderer.getDrawingBufferSize(vh).y);
      palace.update(dt, cam);
    },
  };
  // pre-compile + pre-render both lighting presets (evening hall, morning height): no hitch, no half-lit first frame
  const poses = (list: Shot[]) => list.map((s) => {
    const f = s.at(0.5, s.duration * 0.5);
    return { pos: f.pos.clone(), look: f.look.clone() };
  });
  prog(0.82, 'בֵּית שָׁאוּל');
  if (beats.includes('saul-hall') || beats.includes('hinge')) {
    cast.setBeat(beats.includes('hinge') ? 'hinge' : 'saul-hall');
    await engine.precompileView(view, poses([...cast.beatShots('saul-hall'), palace.shots.detailInserts[0]]));
  }
  prog(0.9, 'גִּבְעַת שָׁאוּל');
  cast.setBeat('saul-court');
  await engine.precompileView(view, poses([palace.shots.establishingExterior, ...cast.beatShots('saul-court'), ...cast.beatShots('saul-portrait')]));
  cast.setBeat(null);
  palace.restoreSharedSun();
  prog(1, '');
  return { palace, cast, camera, view, beats, loadMs: performance.now() - t0 };
}

function disposeStage(engine: Engine, s: GibeahStage) {
  if (engine.view === s.view) engine.restoreWorldView();
  s.palace.restoreSharedSun();
  s.cast.dispose();
  s.palace.dispose();
  if (stageLive === s) stageLive = null;
}

// ------------------------------------------------------------------------------------------------ helpers
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const ramp = (u: number, a: number, b: number) => smooth((u - a) / (b - a));

type DofPlan = { fStop: number; maxBlur?: number } | null;

/** Where David stands for a field shot (null: anywhere, he is not in the frame). */
type DavidSpot = 'pasture' | 'rock' | null;

const DAVID_SHOTS: Partial<Record<IntroShotId, DavidSpot>> = {
  'david-staff': 'pasture',
  'david-lamb': 'pasture',
  flock: 'rock',
  'david-portrait': 'rock',
  'david-crane': 'rock',
  title: 'rock',
};

// ------------------------------------------------------------------------------------------------ the film
export class Intro {
  /** playbacks so far (a replay gets the short cut) */
  static plays = 0;

  /**
   * Build Saul's house (set + cast) for the intro and pre-compile it for the engine's post chain. Idempotent: the
   * same promise until Intro.release(). Resolves null if it failed (the intro then plays its Bethlehem shots only).
   * Cost: set 1.3-3 s + cast 6-17 s of main-thread work (headless figures; yields between actors), then pre-renders.
   */
  static preload(engine: Engine, opts: IntroPreloadOptions = {}): Promise<GibeahStage | null> {
    if (opts.onProgress) progressSink = opts.onProgress;
    if (stageP) return stageP;
    releaseWanted = false;
    const short = opts.short ?? engine.quality.mobile;
    const beats = gibeahBeats(short ? INTRO_CUES_SHORT : INTRO_CUES);
    if (!restoreHooked) {
      restoreHooked = true;
      // after a WebGL context loss: the set's sky LUT / environment capture live on the GPU
      engine.onRestore(() => {
        const s = stageLive;
        if (!s) return;
        s.palace.setTimeOfDay(s.palace.timeOfDay);
        if (engine.view !== s.view) s.palace.restoreSharedSun();
      });
    }
    stageP = buildStage(engine, beats).then(
      (s) => {
        if (releaseWanted) {
          disposeStage(engine, s);
          return null;
        }
        stageLive = s;
        return s;
      },
      (e) => {
        console.warn('[intro] Gibeah stage failed; playing the Bethlehem shots only', e);
        stageP = null;
        return null;
      },
    );
    return stageP;
  }

  /** Dispose Saul's house (set + cast): after the intro, or when it is skipped (frees ~30-60 MB of GPU memory). */
  static release(engine: Engine) {
    releaseWanted = true;
    progressSink = null;
    const s = stageLive;
    stageP = null;
    if (s) disposeStage(engine, s);
  }

  readonly short: boolean;
  readonly cues: readonly IntroCue[];
  readonly plan: { shot: IntroShot; start: number }[];
  length: number;
  /** film time (s); negative while the pre-roll waits for the stage */
  t = 0;
  state: 'idle' | 'loading' | 'playing' | 'done' = 'idle';
  skipped = false;

  private stage: GibeahStage | null = null;
  private idx = -1;
  private textIdx = 0;
  private readonly frame: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
  private readonly fieldShots: Partial<Record<IntroShotId, Shot>> = {};
  private readonly sunH = new THREE.Vector3();
  private readonly sunDir = new THREE.Vector3();
  private readonly rock = new THREE.Vector3();
  private readonly pasture = new THREE.Vector3();
  private readonly toTown = new THREE.Vector3();
  private davidAt: DavidSpot = null;
  private davidHeading = { rock: 0, pasture: 0 };
  private readonly dofTarget = new THREE.Vector3();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpD = new THREE.Vector3();
  private lambStaged = false;
  private savedFilm = 0;
  private titleShown = false;
  private skipArmedT = -1;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private tapHandler: ((e: PointerEvent) => void) | null = null;
  private startedAt = 0;
  private amb = '';
  private finished = false;
  /** test hook: seconds of film to fast-forward before starting (?introAt=) */
  startAt = 0;

  constructor(private readonly h: IntroHost, opts: { short?: boolean } = {}) {
    this.short = opts.short ?? (h.engine.quality.mobile || Intro.plays > 0);
    this.cues = this.short ? INTRO_CUES_SHORT : INTRO_CUES;
    const shotCues = this.cues.filter((c) => c.shot);
    this.plan = shotCues.map((c) => ({ shot: INTRO_SHOTS.find((s) => s.id === c.shot)!, start: c.t }));
    this.length = introLength(this.cues);
    // the chapter's sun (the world is on screen now; palace beats overwrite the shared uniforms later)
    this.sunDir.copy(shared.uSunDir.value).normalize();
    this.sunH.set(this.sunDir.x, 0, this.sunDir.z).normalize();
    const L = LAYOUT;
    const g = h.engine.terrain;
    this.rock.set(L.start.x + 0.2, 0, L.start.z + 2.3);
    this.rock.y = g.heightAt(this.rock.x, this.rock.z);
    // on the sunward side of the pasture, the flock grazing between him and the lens
    this.pasture.set(L.pasture.x + this.sunH.x * 5 - this.sunH.z * 2, 0, L.pasture.z + this.sunH.z * 5 + this.sunH.x * 2);
    this.pasture.y = g.heightAt(this.pasture.x, this.pasture.z);
    const sunYaw = Math.atan2(this.sunH.x, this.sunH.z);
    // pasture: facing away from the sun, turned toward the lens (backlit, rim of light on hair and shoulders)
    this.davidHeading.pasture = sunYaw + Math.PI - 0.95;
    // rock: the lens looks past him toward Bethlehem on its ridge (the reference still); he is turned from the lens
    // toward the low sun: the light on his face, eyes on the horizon (16:12)
    this.toTown.set(L.bethlehem.x - this.rock.x, 0, L.bethlehem.z - this.rock.z).normalize();
    // the lens looks a little right of the town: the big boulder by his rock leaves the background, open hills stay
    const lensYaw = Math.atan2(this.toTown.x, this.toTown.z) - 0.45;
    this.toTown.set(Math.sin(lensYaw), 0, Math.cos(lensYaw));
    const toLens = Math.atan2(-this.toTown.x, -this.toTown.z);
    let d = sunYaw - toLens;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.davidHeading.rock = toLens + Math.sign(d || 1) * 0.66;
    this.buildFieldShots();
  }

  get done() {
    return this.state === 'done';
  }

  // ---------------------------------------------------------------------------------------------- lifecycle
  /** Enter the cinematic state and start (pre-roll until Saul's house is ready, then the film). */
  begin() {
    const { engine, ui, cam } = this.h;
    this.state = 'loading';
    Intro.plays++;
    const post = engine.post;
    this.savedFilm = post.look.uFilm.value as number;
    post.setLetterbox(2.39, 0);
    post.setFilmLook(0.85, 0);
    ui.letterbox(true, true);
    ui.fade(1, 0);
    // the field camera: one endless cinematic shot that returns this intro's frame
    cam.playShots([{ duration: 1e9, ease: false, at: () => this.frame }]);
    this.placeDavid('rock');
    this.fieldFrame(this.plan[0]?.shot.id ?? 'judea-dawn', 0, 0);
    this.armSkip();
    const hasGibeah = this.plan.some((p) => p.shot.world === 'gibeah');
    if (!hasGibeah) {
      this.stage = null;
      this.startFilm();
      return;
    }
    Intro.preload(engine, {
      short: this.short,
      onProgress: (f) => ui.preroll('פֶּרֶק רִאשׁוֹן · הָרֹעֶה', f),
    }).then((s) => {
      if (this.state !== 'loading') return;
      this.stage = s;
      this.startFilm();
    });
    ui.preroll('פֶּרֶק רִאשׁוֹן · הָרֹעֶה', progressF);
  }

  private startFilm() {
    const { ui, audio } = this.h;
    ui.preroll(null);
    // without the palace the Gibeah shots are dropped (the film still runs on Bethlehem alone)
    if (!this.stage) {
      const keep = this.plan.filter((p) => p.shot.world === 'field');
      let t = 0;
      this.plan.length = 0;
      for (const p of keep) {
        this.plan.push({ shot: p.shot, start: t });
        t += p.shot.dur;
      }
      this.length = t;
    }
    this.state = 'playing';
    this.startedAt = performance.now();
    this.t = 0;
    this.idx = -1;
    this.textIdx = 0;
    try {
      audio.playIntro(this.cues, 0);
    } catch (e) {
      console.warn('[intro] score', e);
    }
    this.enter(0);
    if (this.startAt > 0) this.seek(this.startAt);
  }

  /** Jump to film time t (tests / contact sheets): enters the right shot with a hard cut, skips text before it. */
  seek(t: number) {
    if (this.state !== 'playing') return;
    this.t = Math.max(0, Math.min(this.length - 0.01, t));
    let i = 0;
    while (i + 1 < this.plan.length && this.t >= this.plan[i + 1].start) i++;
    if (i !== this.idx) this.enter(i, true);
    while (this.textIdx < this.cues.length && this.cues[this.textIdx].t < this.t - 0.25) this.textIdx++;
    this.h.ui.fade(0, 0);
  }

  /** Per frame (game dt), from Story's behaviour: before the CameraRig and engine.render(). */
  update(dt: number) {
    const { engine, ui } = this.h;
    ui.setBars(engine.post.letterboxBars);
    if (this.state !== 'playing') return;
    this.t += dt;
    while (this.idx + 1 < this.plan.length && this.t >= this.plan[this.idx + 1].start) this.enter(this.idx + 1);
    if (this.t >= this.length) {
      this.end(false);
      return;
    }
    this.fireText();
    const p = this.plan[this.idx];
    const lt = this.t - p.start;
    const u = Math.min(1, lt / p.shot.dur);
    if (p.shot.world === 'field') this.fieldFrame(p.shot.id, u, lt);
    else this.gibeahFrame(p.shot, u, lt);
    this.updateDoF(p.shot, u);
    if (this.skipArmedT >= 0 && performance.now() - this.skipArmedT > 3200) {
      this.skipArmedT = -1;
      ui.skipHint(false);
    }
  }

  /** Jump straight into gameplay (skip button, key / tap). */
  skip() {
    if (this.state === 'done') return;
    this.end(true);
  }

  private end(skipped: boolean) {
    if (this.state === 'done') return;
    const { engine, ui, audio, cam, player } = this.h;
    const wasLoading = this.state === 'loading';
    this.state = 'done';
    this.skipped = skipped;
    ui.preroll(null);
    ui.skip(false);
    ui.skipHint(false);
    try {
      audio.stopIntro(skipped ? 1.2 : 2.5);
    } catch {
      /* audio never breaks the game */
    }
    const post = engine.post;
    if (skipped) {
      ui.hideVerse();
      ui.hideCaption();
      if (wasLoading) ui.fade(0, 1.2);
      else {
        // a clean dissolve from wherever the film was into the gameplay view (never a black frame)
        if (engine.view) engine.restoreWorldView({ crossfade: 0.8 });
        else engine.crossfade(0.8);
      }
      cam.stop();
      this.placeDavid('rock', true);
      cam.snapBehind(player.heading, 0.15);
      // a short title over the start of play
      ui.titleCard(true);
      audio.sfx('titleHit');
      window.setTimeout(() => ui.titleCard(false), 3800);
    } else {
      if (engine.view) engine.restoreWorldView({ crossfade: 1 });
      // let the CameraRig blend from the last crane frame into the follow camera behind David
      cam.snapBehind(player.heading, 0.15);
      cam.skipShots();
      window.setTimeout(() => ui.titleCard(false), 600);
    }
    post.setLetterbox(null, skipped ? 0.8 : 2.2);
    post.setFilmLook(this.savedFilm, skipped ? 0.8 : 2.5);
    post.setDoF({ enabled: false, target: null });
    this.finish();
  }

  /** Idempotent cleanup (also runs when the story restarts during the intro). */
  finish() {
    if (this.finished) return;
    this.finished = true;
    const { engine, ui, player } = this.h;
    if (this.state !== 'done') {
      this.state = 'done';
      if (engine.view) engine.restoreWorldView();
      engine.post.setLetterbox(null, 0);
      engine.post.setFilmLook(this.savedFilm, 0);
      engine.post.setDoF({ enabled: false, target: null });
      ui.preroll(null);
      ui.titleCard(false);
    }
    ui.setBars(null);
    if (this.keyHandler) removeEventListener('keydown', this.keyHandler, true);
    if (this.tapHandler) ui.root.ownerDocument.removeEventListener('pointerdown', this.tapHandler, true);
    this.keyHandler = null;
    this.tapHandler = null;
    const lamb = this.h.flock.lamb;
    if (!lamb.aiEnabled && lamb.state !== 'carried') lamb.aiEnabled = true;
    player.model.hold = 'none';
    player.model.mood = null;
    player.model.lookTarget = null;
    Intro.release(engine);
    this.stage = null;
    try {
      this.h.audio.ambience('fields', 2);
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------------------------------------- skipping
  /** Skip button: one click. Any key / tap: the first shows the skip button + hint, the second (within 3 s) skips. */
  private armSkip() {
    const { ui, input } = this.h;
    ui.skip(true);
    ui.onSkip = () => this.skip();
    const t0 = performance.now();
    const poke = () => {
      if (performance.now() - t0 < 700 || this.state === 'done') return; // the start click itself
      if (this.skipArmedT >= 0) this.skip();
      else {
        this.skipArmedT = performance.now();
        ui.skipHint(true, input.isTouch);
      }
    };
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key) || /^F\d+$/.test(e.key)) return;
      if (e.key === 'Enter' || e.key === 'Escape') {
        if (performance.now() - t0 > 700) this.skip();
        return;
      }
      poke();
    };
    this.tapHandler = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest && el.closest('button')) return; // the skip button handles itself
      poke();
    };
    addEventListener('keydown', this.keyHandler, true);
    ui.root.ownerDocument.addEventListener('pointerdown', this.tapHandler, true);
  }

  // ---------------------------------------------------------------------------------------------- shots
  private enter(i: number, instant = false) {
    const { engine, audio } = this.h;
    const prev = this.idx >= 0 ? this.plan[this.idx].shot : null;
    const s = this.plan[i].shot;
    this.idx = i;
    const cont = s.cut === 'cut' && prev && continuous(prev.id, s.id);
    const fade = instant || s.cut === 'cut' || s.cut === 'black' ? 0 : s.fade ?? 1.2;
    const through = s.cut === 'light' ? 0xf4dcae : undefined;
    const opts = fade > 0 ? { crossfade: fade, through } : {};
    if (s.cut === 'black' && !instant) this.h.ui.fade(0, s.fade ?? 2.5);
    const stage = this.stage;
    if (s.world === 'gibeah' && stage) {
      if (!prev || prev.beat !== s.beat || prev.world !== 'gibeah' || instant) stage.cast.setBeat(s.beat, 0);
      this.gibeahFrame(s, 0, 0);
      if (engine.view !== stage.view) engine.setView(stage.view, opts);
      else engine.resetTemporal(opts);
    } else {
      if (engine.view) engine.restoreWorldView(opts);
      else if (!cont) engine.resetTemporal(opts);
      this.fieldFrame(s.id, 0, 0);
      if (!cont) this.h.player.model.resetDynamics?.();
    }
    // David / lamb for this shot or, while he is off screen, for the next shot that shows him
    this.stageDavid(i);
    // Saul's evening hall: switch the set's light while Bethlehem is on screen, compile anything new off-screen
    this.preStageGibeah(i);
    const amb = s.world === 'field' ? 'fields' : s.beat === 'saul-hall' || s.beat === 'hinge' ? 'gibeah-hall' : 'gibeah-exterior';
    if (amb !== this.amb) {
      this.amb = amb;
      try {
        audio.ambience(amb as 'fields' | 'gibeah-exterior' | 'gibeah-hall', fade > 0 ? fade : 0.8);
      } catch {
        /* ignore */
      }
    }
    if (s.id === 'title' && !this.titleShown) {
      this.titleShown = true;
      this.h.ui.hideVerse();
      this.h.ui.titleCard(true);
      audio.sfx('titleHit');
    }
  }

  private fireText() {
    const { ui } = this.h;
    while (this.textIdx < this.cues.length && this.t >= this.cues[this.textIdx].t) {
      const c = this.cues[this.textIdx++];
      if (c.shot) continue;
      // text of a dropped (Gibeah) shot is not shown over Bethlehem
      if (!this.plan.some((p) => p.shot.beat === c.beat && c.t >= p.start - 0.01 && c.t < p.start + p.shot.dur + 0.01)) continue;
      if (c.caption) {
        const sub = c.caption.sub;
        ui.caption(c.caption.title, typeof sub === 'object' ? quoteWithRefHtml(sub.quote) : sub ?? '', c.seconds ?? 5);
      }
      if (c.verse) ui.verse(...verseArgs(c.verse), c.seconds ?? 5);
    }
  }

  /** Put David (and the lamb) where the current or next David shot needs them, only while he is off screen. */
  private stageDavid(i: number) {
    const cur = this.plan[i].shot;
    const curSpot = cur.world === 'field' ? DAVID_SHOTS[cur.id] ?? null : null;
    const onScreen = curSpot !== null && cur.id !== 'flock';
    let want: DavidSpot = curSpot;
    // on screen he only moves when the film was sought straight into his shot (tests)
    if (onScreen && curSpot && curSpot !== this.davidAt) this.placeDavid(curSpot);
    if (!onScreen) {
      for (let k = i + 1; k < this.plan.length; k++) {
        const s = this.plan[k].shot;
        const spot = s.world === 'field' ? DAVID_SHOTS[s.id] ?? null : null;
        if (spot) {
          want = spot;
          break;
        }
      }
      if (want && want !== this.davidAt) this.placeDavid(want);
    }
    // the lamb: held in place for its close shot (placed while off screen, just before), then back to the flock AI
    const lamb = this.h.flock.lamb;
    if (cur.id === 'david-lamb' || this.plan[i + 1]?.shot.id === 'david-lamb') this.stageLamb();
    else if (!lamb.aiEnabled && lamb.state !== 'carried') lamb.aiEnabled = true;
  }

  private placeDavid(spot: Exclude<DavidSpot, null>, force = false) {
    if (this.davidAt === spot && !force) return;
    const { player } = this.h;
    const p = spot === 'rock' ? this.rock : this.pasture;
    player.place(p.x, p.z, spot === 'rock' ? this.davidHeading.rock : this.davidHeading.pasture);
    player.speed = 0;
    const m = player.model;
    m.hold = 'hero';
    m.staffMode = 'plant';
    m.lookTarget = null;
    m.mood = spot === 'rock' ? 'neutral' : null;
    this.davidAt = spot;
  }

  /** The white lamb a few metres from David on the lens side (the knee-height shot through the flock). */
  private stageLamb() {
    const lamb = this.h.flock.lamb;
    if (lamb.state === 'carried') return;
    const d = this.pasture;
    const side = this.tmpA.set(-this.sunH.z, 0, this.sunH.x);
    const x = d.x - this.sunH.x * 3.4 + side.x * 0.7;
    const z = d.z - this.sunH.z * 3.4 + side.z * 0.7;
    if (this.lambStaged) return;
    this.lambStaged = true;
    lamb.position.set(x, this.h.engine.terrain.heightAt(x, z), z);
    lamb.heading = Math.atan2(side.x, side.z);
    lamb.state = 'graze';
    lamb.aiEnabled = false;
    lamb.manualSpeed = 0;
  }

  /** Before an evening Gibeah shot: stage its beat now (sky / lamps rebuilt off screen) and compile anything new. */
  private preStageGibeah(i: number) {
    const stage = this.stage;
    const cur = this.plan[i].shot;
    if (!stage || cur.world !== 'field') return;
    const next = this.plan[i + 1]?.shot;
    if (!next || next.world !== 'gibeah') return;
    const evening = (b: IntroBeat) => b === 'saul-hall' || b === 'hinge';
    if (evening(next.beat) !== (stage.palace.timeOfDay === 'evening')) {
      // (both presets were pre-compiled by the preload: the rebuilt light shafts reuse the cached programs)
      stage.cast.setBeat(next.beat, 0);
      stage.palace.restoreSharedSun(); // the world is on screen: keep the chapter's sun in the shared uniforms
    }
  }

  // ---------------------------------------------------------------------------------------------- Gibeah cameras
  private gibeahFrame(s: IntroShot, u: number, lt: number) {
    const stage = this.stage;
    if (!stage) return;
    const { palace, cast, camera } = stage;
    let f: ShotFrame | null = null;
    const stretch = (shot: Shot) => {
      const e = shot.ease !== false ? smooth(u) : u;
      return shot.at(e, lt * (shot.duration / s.dur));
    };
    switch (s.id) {
      case 'gibeah-aerial': f = stretch(palace.shots.establishingExterior); break;
      case 'tamarisk-walls': f = stretch(palace.shots.tamariskAndWalls); break;
      case 'court': f = stretch(cast.shots.court); break;
      case 'court-hand': f = this.courtHand(cast, u); break;
      case 'saul-portrait': f = stretch(cast.shots.portrait); break;
      case 'warriors-line': f = stretch(cast.shots.warriorsLine); break;
      case 'warriors-saul': f = stretch(cast.shots.warriorsSaul); break;
      case 'hall-lamp': f = stretch(palace.shots.detailInserts[0]); break;
      case 'hall': f = stretch(cast.shots.hall); break;
      case 'hinge': f = stretch(cast.shots.robeCorner); break;
      default: f = stretch(palace.shots.establishingExterior);
    }
    camera.position.copy(f.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(f.look);
    if (f.roll) camera.rotateZ(f.roll);
    const fov = f.fov ?? 40;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  /** Insert: the king's fist on the spear shaft, tilting up the shaft to the bronze head (22:6 "his spear in his hand"). */
  private courtHand(cast: PalaceCast, u: number): ShotFrame {
    const hand = cast.focus('saulHand', this.tmpA);
    const tip = cast.focus('spear', this.tmpB);
    const yaw = cast.actors.saul.root.rotation.y;
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
    const right = V(-fwd.z, 0, fwd.x); // the king's right (lens on his right front, outside the spear)
    const e = smooth(u);
    const pos = hand.clone().addScaledVector(fwd, 1.0 - e * 0.15).addScaledVector(right, 0.62).add(V(0, -0.1 + e * 0.45, 0));
    const look = hand.clone().lerp(tip, 0.05 + e * 0.42);
    // keep the shaft in the left third: aim a little right of it
    look.addScaledVector(right, 0.1);
    return { pos, look, fov: 30 - e * 3 };
  }

  // ---------------------------------------------------------------------------------------------- Bethlehem cameras
  private buildFieldShots() {
    const L = LAYOUT;
    const g = (x: number, z: number, up: number) => V(x, this.h.engine.terrain.heightAt(x, z) + up, z);
    const B = L.bethlehem;
    const R = L.rachel;
    this.fieldShots['judea-dawn'] = dolly(8, V(640, 150, 560), V(360, 92, 330), V(-120, 20, -200), V(-220, 20, -290), 40, 36);
    this.fieldShots.bethlehem = dolly(7, g(B.x + 205, B.z + 150, 18), g(B.x + 150, B.z + 95, 13), g(B.x, B.z, 16), g(B.x - 10, B.z - 10, 14), 40, 36);
    this.fieldShots.rachel = dolly(5.8, g(R.x + 14, R.z + 9, 2.2), g(R.x + 7, R.z + 4.6, 1.9), g(R.x, R.z, 2.6), g(R.x - 30, R.z - 40, 10), 38, 34);
  }

  private fieldFrame(id: IntroShotId, u: number, lt: number) {
    const out = this.frame;
    const { player, flock } = this.h;
    const m = player.model;
    const e = smooth(u);
    const set = (pos: THREE.Vector3, look: THREE.Vector3, fov: number) => {
      out.pos.copy(pos);
      out.look.copy(look);
      out.fov = fov;
      out.roll = 0;
    };
    const pre = this.fieldShots[id];
    if (pre) {
      const f = pre.at(pre.ease !== false ? e : u, lt);
      set(f.pos, f.look, f.fov ?? 40);
      return;
    }
    const D = player.pos;
    const sun = this.sunH;
    const side = this.tmpA.set(-sun.z, 0, sun.x); // 90 degrees left of the sun direction
    switch (id) {
      case 'david-staff': {
        // MATCH from the king's fist on the spear: the shepherd's hand on the staff in the same place of the frame;
        // then back and up: David alone among the flock, the low sun behind him (rim light)
        const hand = this.staffHand(this.tmpB);
        const camYaw = Math.atan2(sun.x, sun.z) + Math.PI - 0.45;
        const away = V(Math.sin(camYaw), 0, Math.cos(camYaw));
        const r = 1.05 + e * 5.2;
        const pos = hand.clone().addScaledVector(away, r).add(V(0, -0.05 + e * 0.35, 0));
        pos.y = Math.max(pos.y, this.h.engine.terrain.heightAt(pos.x, pos.z) + 1.25);
        const head = m.j.head.getWorldPosition(V(0, 0, 0));
        const look = hand.clone().lerp(head.add(V(0, -0.35, 0)), ramp(u, 0.12, 0.8));
        const camRight = V(-away.z, 0, away.x).negate();
        look.addScaledVector(camRight, 0.13 * r * (1 - 0.6 * e) * this.lateral());
        set(pos, look, 30 + e * 7);
        break;
      }
      case 'david-lamb': {
        // the lamb in the foreground, David soft behind it against the low sun; the lens lifts into the sun
        const lamb = flock.lamb.position;
        const dir = this.tmpB.set(lamb.x - D.x, 0, lamb.z - D.z);
        if (dir.lengthSq() < 0.01) dir.set(-sun.x, 0, -sun.z);
        dir.normalize();
        const pos = V(lamb.x, lamb.y, lamb.z).addScaledVector(dir, 2.9 - e * 0.7).addScaledVector(side, 0.45).add(V(0, 1.2 + e * 0.15, 0));
        pos.y = Math.max(pos.y, this.h.engine.terrain.heightAt(pos.x, pos.z) + 1.1);
        const lookLamb = V(lamb.x, lamb.y + 0.45, lamb.z);
        const head = m.j.head.getWorldPosition(V(0, 0, 0));
        const look = lookLamb.lerp(head.add(V(0, -0.5, 0)), 0.35 + 0.35 * ramp(u, 0.25, 0.6));
        // last third: tilt into the sun (the match dissolve to the lamp flame)
        const sunLook = pos.clone().addScaledVector(this.sunDir, 30);
        look.lerp(sunLook, ramp(u, 0.68, 1) * 0.9);
        set(pos, look, 34 - e * 4);
        break;
      }
      case 'flock': {
        const c = flock.lamb.position;
        const a = Math.atan2(-sun.x, -sun.z) + 0.6 + u * 0.5;
        const r = 5.2 - u * 1.4;
        const px = c.x + Math.sin(a) * r, pz = c.z + Math.cos(a) * r;
        const py = Math.max(c.y + 1.35 + u * 0.15, this.h.engine.terrain.heightAt(px, pz) + 1.2);
        set(V(px, py, pz), V(c.x, c.y + 0.4, c.z), 32);
        break;
      }
      case 'david-portrait': {
        // the mirror of Saul's portrait: the same low-angle push from medium to close, but the young face in the open
        // light, and behind him the stone town on its ridge (the reference still)
        const head = m.j.head.getWorldPosition(this.tmpB);
        const to = this.toTown;
        const camRight = V(-to.z, 0, to.x); // screen right: David in the left third, looking into the open frame
        const r = 3.4 - e * 1.5;
        const pos = head.clone().addScaledVector(to, -r).addScaledVector(camRight, -0.25).add(V(0, -0.72 + e * 0.3, 0));
        const look = head.clone().add(V(0, -0.1 + e * 0.06, 0)).addScaledVector(camRight, 0.12 * r * this.lateral());
        set(pos, look, 31 - e * 6);
        break;
      }
      case 'david-crane':
      case 'title': {
        // one continuous crane across both shots: up behind him to reveal the land he looks over
        const a = this.plan.find((p) => p.shot.id === 'david-crane');
        const b = this.plan.find((p) => p.shot.id === 'title');
        const t0 = a ? a.start : b ? b.start : 0;
        const t1 = b ? b.start + b.shot.dur : a ? a.start + a.shot.dur : 1;
        const k = smooth((this.t - t0) / Math.max(0.1, t1 - t0));
        const hd = player.heading;
        const fwd = V(Math.sin(hd), 0, Math.cos(hd));
        const right = V(-fwd.z, 0, fwd.x);
        const base = this.rock;
        const pos = base.clone().addScaledVector(fwd, -(2.4 + k * 7.5)).addScaledVector(right, 0.9 + k * 2.2).add(V(0, 1.75 + k * 6.2, 0));
        const look = base.clone().addScaledVector(fwd, 30 + k * 70).add(V(0, 1.3 - k * 5, 0));
        set(pos, look, 42 + k * 8);
        break;
      }
      default: {
        set(V(620, 140, 230), V(-100, 30, -150), 42);
      }
    }
  }

  /** Off-centre framing scale: full on landscape screens, nearly centred on a portrait phone (narrow lens). */
  private lateral() {
    return Math.min(1, Math.max(0.2, this.h.engine.camera.aspect / 1.78));
  }

  /** World position of the hand that holds the staff (the one nearer the staff's grip). */
  private staffHand(out: THREE.Vector3) {
    const m = this.h.player.model;
    const grip = m.staffProp.grip.getWorldPosition(this.tmpC);
    const l = m.handSocketL.getWorldPosition(out);
    const dl = l.distanceToSquared(grip);
    const r = m.handSocketR.getWorldPosition(this.tmpD);
    return dl <= r.distanceToSquared(grip) ? out : out.copy(r);
  }

  // ---------------------------------------------------------------------------------------------- focus
  private updateDoF(s: IntroShot, u: number) {
    const post = this.h.engine.post;
    if (!post.dofAvailable) return;
    const plan = DOF[s.id] ?? null;
    if (!plan) {
      if (post.dofSettings.enabled) post.setDoF({ enabled: false, target: null });
      return;
    }
    const t = this.dofTarget;
    const stage = this.stage;
    const m = this.h.player.model;
    const cf = (n: CastFocus) => (stage ? stage.cast.focus(n, t) : t);
    switch (s.id) {
      case 'court': case 'saul-portrait': case 'hall': case 'warriors-saul': cf('saulFace'); break;
      case 'warriors-line': cf('abner'); break;
      case 'court-hand': {
        cf('saulHand');
        const tip = stage ? stage.cast.focus('spear', this.tmpB) : t;
        t.lerp(tip, ramp(u, 0.35, 0.9) * 0.6);
        break;
      }
      case 'hinge': {
        cf('robeCorner');
        const face = stage ? stage.cast.focus('saulFace', this.tmpB) : t;
        t.lerp(face, ramp(u, 0.45, 0.8));
        break;
      }
      case 'hall-lamp': if (stage) t.copy(stage.palace.anchors.detailTargets.lamp); break;
      case 'david-staff': {
        this.staffHand(t);
        const head = m.j.head.getWorldPosition(this.tmpB);
        t.lerp(head, ramp(u, 0.2, 0.7));
        break;
      }
      case 'david-lamb': {
        const l = this.h.flock.lamb.position;
        t.set(l.x, l.y + 0.35, l.z);
        const head = m.j.head.getWorldPosition(this.tmpB);
        t.lerp(head, ramp(u, 0.25, 0.6));
        break;
      }
      case 'flock': {
        const l = this.h.flock.lamb.position;
        t.set(l.x, l.y + 0.35, l.z);
        break;
      }
      case 'david-portrait': m.j.head.getWorldPosition(t); break;
      default: break;
    }
    post.setDoF({ enabled: true, target: t, fStop: plan.fStop, focalLength: null, maxBlur: plan.maxBlur ?? 0.018 });
  }
}

/** consecutive shots that are one camera move (no cut, no TAA reset) */
function continuous(a: IntroShotId, b: IntroShotId) {
  return a === 'david-crane' && b === 'title';
}

const DOF: Partial<Record<IntroShotId, DofPlan>> = {
  court: { fStop: 2.8 },
  'court-hand': { fStop: 2.2, maxBlur: 0.02 },
  'saul-portrait': { fStop: 2.0, maxBlur: 0.02 },
  'warriors-line': { fStop: 4 },
  'warriors-saul': { fStop: 2.8 },
  'hall-lamp': { fStop: 1.8, maxBlur: 0.022 },
  hall: { fStop: 2.4 },
  hinge: { fStop: 2.0, maxBlur: 0.02 },
  'david-staff': { fStop: 2.4, maxBlur: 0.02 },
  'david-lamb': { fStop: 2.0, maxBlur: 0.022 },
  flock: { fStop: 3.5 },
  'david-portrait': { fStop: 2.2, maxBlur: 0.02 },
};
