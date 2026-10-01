import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Input } from '../core/Input';
import type { UI } from '../ui/UI';
import type { Flock } from '../characters/Flock';
import type { CameraRig, ShotFrame } from './CameraRig';
import type { Player } from './Player';
import type { GameAudio } from './GameAudio';
import type { BearActor } from './BearActor';
import { INTRO_CUES, INTRO_SHOTS, introLength, shotStarts, type IntroCue, type IntroShot, type IntroText } from '../content/introScript';
import { narration } from '../content/introNarration';
import { verseArgs } from '../content/sources';
import type { FilmStage, FilmSetHandle, FilmStageSet } from '../film/FilmStage';
import { FilmWorld, HANDOFF } from '../film/FilmWorld';
import { applyHandheld } from '../film/FilmCams';

/**
 * THE OPENING FILM "הַטּוֹב מִמֶּךָּ" (CUT v4, docs/intro-script-v4.md on top of intro-script-v3.md: 59 s, six scenes, no
 * prologue): the player of the shot sheet src/content/introScript.ts. The film opens on the time card over black and
 * comes in ON the shofar at Gilgal (G1); it switches between the Gilgal film set (src/film/FilmStage.ts builds only the
 * sets the sheet uses) and the game world (src/film/FilmWorld.ts: David on his rock, his flock) with engine.setView /
 * restoreWorldView / resetTemporal on every cut, drives the letterbox, depth of field, the film look and the fades,
 * fires the on-screen text (narration from src/content/introNarration.ts, verses ONLY through the catalog helpers),
 * keeps the score locked to the picture, and hands off to gameplay.
 *
 * CUT v4's end (cut6): the last shot D3 'horizon' is a crane from David's shoulder up over his flock and the land; the
 * game's LOGO forms over that panorama on the shot's beats (logo / hebrew / chapter, fading from logoOut: UI.logo,
 * pinned to the film clock), and from `settle` the letterbox retracts and the film look eases off while the crane
 * glides down into exactly the gameplay camera behind him (CameraRig.followFrame) — at the end of the shot the game
 * takes over WITHOUT a cut, a dissolve or black. The skip jumps straight to that hand-off (a short dissolve, the logo
 * over the first seconds of play).
 *
 * Black is drawn by the renderer (post.grade uFade), so the time card sits above it and every dissolve from / into
 * black is a real crossfade of the canvas. Transitions are a pure function of film time (seek-safe): the first shot
 * ('black') holds `hold` s of black under the time card and the picture rises out of it over `fade` s exactly on the
 * shofar beat, the G7 -> D1 'light' cut is a warm white flash centred on the cut (uFade toward look.uFadeColor).
 * Every camera gets the handheld layer of src/film/FilmCams.ts (TAKE_LOOK).
 */
export interface IntroHost {
  engine: Engine;
  ui: UI;
  input: Input;
  audio: GameAudio;
  cam: CameraRig;
  player: Player;
  flock: Flock;
  bear: BearActor;
}

export interface IntroPreloadOptions {
  /** kept for API compatibility (the approved film has one cut) */
  short?: boolean;
  onProgress?: (f: number, label: string) => void;
}

/** the warm white of the light-flash cut G7 -> D1 */
const FLASH_LIGHT = new THREE.Color(1.0, 0.95, 0.84);
const BLACK = new THREE.Color(0, 0, 0);
const smooth01 = (x: number) => {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
};

let stageP: Promise<FilmStage | null> | null = null;
let stageLive: FilmStage | null = null;
let releaseWanted = false;
let progressSink: ((f: number, label: string) => void) | null = null;
let progressF = 0;

const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

interface TextEvent {
  t: number;
  x: IntroText;
}

export class Intro {
  /** playbacks so far */
  static plays = 0;

  /**
   * Build the film stage (every film-only set, crowd and actor; lazily imported chunks) and pre-compile it for the
   * engine's post chain. Idempotent until Intro.release(). Resolves null if it failed entirely (the film then plays
   * its game-world shots and black cards only). ?filmcast=0 / ?filmcrowd=0 build without the cast / the crowds.
   */
  static preload(engine: Engine, opts: IntroPreloadOptions = {}): Promise<FilmStage | null> {
    if (opts.onProgress) progressSink = opts.onProgress;
    if (stageP) return stageP;
    releaseWanted = false;
    const p = params();
    stageP = import('../film/FilmStage')
      .then(({ FilmStage }) =>
        FilmStage.load(engine, {
          cast: p.get('filmcast') !== '0',
          crowd: p.get('filmcrowd') !== '0',
          onProgress: (f, label) => {
            progressF = f;
            progressSink?.(f, label);
          },
        }),
      )
      .then(
        (s) => {
          if (releaseWanted) {
            s.dispose();
            return null;
          }
          stageLive = s;
          (window as unknown as Record<string, unknown>).__filmStage = s;
          return s;
        },
        (e) => {
          console.warn('[intro] film stage failed; playing the world shots only', e);
          stageP = null;
          return null;
        },
      );
    return stageP;
  }

  /** Dispose the film stage (after the film, or when it is skipped). */
  static release(engine: Engine) {
    releaseWanted = true;
    progressSink = null;
    const s = stageLive;
    stageLive = null;
    stageP = null;
    if (s) {
      if (engine.view && Object.values(s.sets).some((h) => h && h.view === engine.view)) engine.restoreWorldView();
      s.dispose();
    }
  }

  readonly cues: readonly IntroCue[] = INTRO_CUES;
  readonly plan: { shot: IntroShot; start: number }[] = shotStarts();
  readonly length = introLength(INTRO_CUES);
  /** film time (s) */
  t = 0;
  /** film-time rate (tests: 0 freezes the film clock while frames still render) */
  rate = 1;
  state: 'idle' | 'loading' | 'playing' | 'done' = 'idle';
  skipped = false;
  /** test hook: seconds of film to fast-forward before starting (?introAt=) */
  startAt = 0;

  private stage: FilmStage | null = null;
  private readonly world: FilmWorld;
  private idx = -1;
  private readonly texts: TextEvent[] = [];
  private textIdx = 0;
  /** the frame the CameraRig shows while the game world is on screen */
  private readonly frame: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
  private readonly f2: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };
  private savedFilm = 0;
  private skipArmedT = -1;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private tapHandler: ((e: PointerEvent) => void) | null = null;
  private finished = false;
  private black = 1;
  private readonly sfxFired = new Set<string>();
  /** ?test=1: on-screen text and the title card run on the FILM clock (contact sheets / slow software rendering) */
  private readonly testClock = params().get('test') === '1';
  /** ?filmkeep=1 (tests): keep every film set resident so the harness can seek backwards */
  private readonly keepSets = params().get('filmkeep') === '1';
  private readonly liveTexts: { el: HTMLElement; start: number; dur: number }[] = [];
  /** D3 (CUT v4): film times of the logo's beats and of the settle (the hand-off begins); -1 = the sheet has no logo shot */
  private readonly logoAt: number = -1;
  private readonly logoBeats = { hebrew: 1, chapter: 2, out: 4.4, outDur: 1.6 };
  private readonly settleAt: number = -1;
  private logoShown = false;
  private settled = false;
  private readonly handPivot = new THREE.Vector3();

  constructor(private readonly h: IntroHost, _opts: { short?: boolean } = {}) {
    let t = 0;
    for (const s of INTRO_SHOTS) {
      for (const x of s.text ?? []) this.texts.push({ t: t + x.at, x });
      t += s.dur;
    }
    this.texts.sort((a, b) => a.t - b.t);
    // the logo shot (D3): its beats from the contract
    const d3 = this.plan.find((p) => p.shot.take === 'horizon');
    if (d3) {
      const b = d3.shot.beats ?? {};
      const logo = b.logo ?? 3.6, out = b.logoOut ?? 8.0;
      this.logoAt = d3.start + logo;
      this.logoBeats = { hebrew: (b.hebrew ?? 4.6) - logo, chapter: (b.chapter ?? 5.6) - logo, out: out - logo, outDur: Math.max(0.6, Math.min(1.8, d3.shot.dur - out - 0.3)) };
      this.settleAt = d3.start + (b.settle ?? 8.0);
    }
    // D3 lands on the gameplay camera's first frame behind David (the follow camera's own geometry and collision)
    this.world = new FilmWorld({
      engine: h.engine, player: h.player, flock: h.flock, bear: h.bear,
      handoff: (out) => h.cam.followFrame(this.handPivot.copy(h.player.pos).setY(h.player.pos.y + HANDOFF.pivotH), HANDOFF.heading, HANDOFF.pitch, out),
    });
  }

  get done() {
    return this.state === 'done';
  }

  /** What is real and what is placeholder on the stage (tests / the report): the film sets the sheet uses. */
  status(): string[] {
    const s = this.stage;
    if (!s) return ['no film stage (world shots only)'];
    const out: string[] = [];
    const used = [...new Set(this.plan.map((p) => p.shot.set))].filter((n): n is FilmStageSet => n !== 'black' && n !== 'world');
    for (const n of used) {
      const hdl = s.sets[n];
      out.push(`${n}: ${hdl ? (hdl.status.length ? hdl.status.join('; ') : 'set') : 'released or missing'}`);
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------- lifecycle
  /** Enter the cinematic state; start the film as soon as the stage is ready (pre-roll card until then). */
  begin() {
    const { engine, ui, cam } = this.h;
    this.state = 'loading';
    Intro.plays++;
    const post = engine.post;
    this.savedFilm = post.look.uFilm.value as number;
    post.setLetterbox(2.39, 0);
    post.setFilmLook(0.85, 0);
    this.setBlack(1);
    ui.letterbox(true, true);
    ui.filmMode(true);
    ui.fade(1, 0);
    // the world camera: one endless cinematic shot that returns this film's frame
    cam.playShots([{ duration: 1e9, ease: false, at: () => this.frame }]);
    this.armSkip();
    if (params().get('skip') === '1') {
      this.end(true);
      return;
    }
    const label = narration('chapterTitle');
    Intro.preload(engine, { onProgress: (f) => ui.preroll(label, f) }).then((s) => {
      if (this.state !== 'loading') return;
      this.stage = s;
      this.startFilm();
    });
    if (this.state === 'loading') ui.preroll(label, progressF);
  }

  private startFilm() {
    const { ui, audio } = this.h;
    ui.preroll(null);
    this.state = 'playing';
    this.t = 0;
    this.idx = -1;
    this.textIdx = 0;
    // black is drawn by the renderer from here on (the HTML fade would cover the time card)
    this.setBlack(1);
    ui.fade(0, 0.05);
    try {
      audio.playIntro(this.cues, 0);
    } catch (e) {
      console.warn('[intro] score', e);
    }
    this.enter(0);
    if (this.startAt > 0) this.seek(this.startAt);
  }

  /** Jump to film time t (tests / contact sheets): a hard cut into the right shot; text of earlier shots skipped. */
  seek(t: number) {
    if (this.state !== 'playing') return;
    this.t = Math.max(0, Math.min(this.length - 0.01, t));
    let i = 0;
    while (i + 1 < this.plan.length && this.t >= this.plan[i + 1].start) i++;
    this.h.ui.clearFilmText(0);
    this.liveTexts.length = 0;
    // the logo and the hand-off of D3 are functions of film time (seeking back out of them: tests)
    if (this.logoShown && this.t < this.logoAt) {
      this.logoShown = false;
      this.h.ui.logo(false);
    }
    if (this.settled && this.t < this.settleAt) {
      this.settled = false;
      this.h.engine.post.setLetterbox(2.39, 0);
      this.h.engine.post.setFilmLook(0.85, 0);
    }
    if (i !== this.idx) this.enter(i, true);
    this.textIdx = 0;
    while (this.textIdx < this.texts.length && this.texts[this.textIdx].t < this.t - 0.05) {
      // text that is still on screen at t is shown again, part-way through its animation
      const e = this.texts[this.textIdx];
      if (e.t + e.x.seconds > this.t + 0.2) this.showText(e.x, e.t, this.t - e.t);
      this.textIdx++;
    }
    this.updateShot(0);
    this.logoClock(true);
    this.syncTextClock();
  }

  /**
   * D3: the logo over the panorama (turned on at `logo`, every part of it pinned to the film clock — the lockup never
   * runs ahead of a slow picture) and the hand-off's start at `settle`: the letterbox retracts and the film look eases off
   * over the glide, so both are gone when the game's camera takes over at the end of the shot. `jump` = after a seek.
   */
  private logoClock(jump = false) {
    if (this.logoAt < 0) return;
    const { ui, engine } = this.h;
    if (!this.logoShown && this.t >= this.logoAt) {
      this.logoShown = true;
      ui.logo(true, this.logoBeats);
    }
    if (this.logoShown) ui.logoAt(this.t - this.logoAt);
    if (!this.settled && this.t >= this.settleAt) {
      this.settled = true;
      const left = Math.max(0, this.length - this.t);
      const post = engine.post;
      post.setLetterbox(null, jump ? left : Math.max(0.3, left));
      post.setFilmLook(this.savedFilm, Math.max(0.3, left));
    }
  }

  /** tests: pin every film text animation to the film clock (wall-clock CSS would run ahead of slow frames) */
  private syncTextClock() {
    if (!this.testClock) return;
    for (let k = this.liveTexts.length - 1; k >= 0; k--) {
      const x = this.liveTexts[k];
      const el = this.t - x.start;
      if (el > x.dur + 0.3 || !x.el.isConnected) {
        x.el.remove();
        this.liveTexts.splice(k, 1);
        continue;
      }
      for (const a of x.el.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = Math.max(0, el) * 1000;
      }
    }
  }

  /** Per frame (game dt), from Story's behaviour: before the CameraRig and engine.render(). */
  update(dt: number) {
    const { engine, ui } = this.h;
    ui.setBars(engine.post.letterboxBars);
    if (this.state !== 'playing') return;
    this.t += dt * this.rate;
    // the score runs on the audio clock: keep it locked to the picture (loading / shader hitches, slow frames)
    try {
      this.h.audio.syncIntro(this.t);
    } catch {
      /* ignore */
    }
    while (this.idx + 1 < this.plan.length && this.t >= this.plan[this.idx + 1].start) this.enter(this.idx + 1);
    if (this.t >= this.length) {
      this.end(false);
      return;
    }
    this.fireText();
    this.updateShot(dt);
    this.logoClock();
    this.syncTextClock();
    if (this.skipArmedT >= 0 && performance.now() - this.skipArmedT > 3200) {
      this.skipArmedT = -1;
      ui.skipHint(false);
    }
  }

  /** Jump straight into gameplay (skip button, Enter / Esc, a second key / tap). */
  skip() {
    if (this.state === 'done') return;
    this.end(true);
  }

  private end(skipped: boolean) {
    if (this.state === 'done') return;
    const { engine, ui, audio, cam, player } = this.h;
    const wasLoading = this.state === 'loading';
    // the film ran to its end on D3: the crane has landed on the gameplay camera — the game takes over without a cut
    const handoff = !skipped && this.plan[this.idx]?.shot.take === 'horizon';
    this.state = 'done';
    this.skipped = skipped;
    ui.preroll(null);
    ui.skip(false);
    ui.skipHint(false);
    ui.clearFilmText(skipped ? 0.4 : 0.8);
    // the score hands over to the game's pastoral music by itself at the end of D3 (score5: stopIntro is absorbed
    // there); skipped while the score plays, it jumps to its logo statement (the sfx('titleHit') below)
    if (!skipped || wasLoading) {
      try {
        audio.stopIntro(skipped ? 1.2 : 2.5);
      } catch {
        /* audio never breaks the game */
      }
    }
    const post = engine.post;
    this.world.leave(handoff);
    // the game begins: David on his rock facing the pasture and the flock (HANDOFF), the follow camera behind him. At the
    // hand-off he already stands there (D3 placed him; the game's physics may have settled him a few cm: not moved again)
    const L = { x: 0.2, z: 2.3 };
    if (!handoff || Math.hypot(player.pos.x - L.x, player.pos.z - L.z) > 0.4 || Math.abs(player.heading - HANDOFF.heading) > 1e-3) {
      player.place(L.x, L.z, HANDOFF.heading);
    }
    cam.stop();
    cam.snapBehind(HANDOFF.heading, HANDOFF.pitch);
    if (skipped) {
      // the skip jumps to the hand-off: a clean dissolve from wherever the film was into the gameplay camera (never a
      // black frame), the game's logo over the first seconds of play
      if (wasLoading) ui.fade(0, 1.2);
      else if (engine.view) engine.restoreWorldView({ crossfade: 0.8 });
      else engine.crossfade(0.8);
      // (on the score's logo statement after a skip: the answer under דָּוִד at +1.0 s, the chapter pluck at +2.0 s)
      ui.logo(true, { hebrew: 1.0, chapter: 2.0, out: 4.4, outDur: 1.2 });
      audio.sfx('titleHit');
      window.setTimeout(() => ui.logo(false), 6000);
      post.setLetterbox(null, 0.8);
      post.setFilmLook(this.savedFilm, 0.8);
    } else {
      if (engine.view) engine.restoreWorldView();
      ui.logo(false);
      // (normally already retracted / eased off over the glide since `settle`)
      if (!this.settled) {
        post.setLetterbox(null, 0.6);
        post.setFilmLook(this.savedFilm, 0.6);
      }
    }
    this.setBlack(0, BLACK);
    post.setDoF({ enabled: false, target: null });
    this.finish();
  }

  /** Idempotent cleanup (also runs when the story restarts during the film). */
  finish() {
    if (this.finished) return;
    this.finished = true;
    const { engine, ui } = this.h;
    if (this.state !== 'done') {
      this.state = 'done';
      this.world.leave();
      if (engine.view) engine.restoreWorldView();
      engine.post.setLetterbox(null, 0);
      engine.post.setFilmLook(this.savedFilm, 0);
      engine.post.setDoF({ enabled: false, target: null });
      this.setBlack(0);
      ui.preroll(null);
      ui.logo(false);
      ui.clearFilmText(0);
    }
    ui.setBars(null);
    ui.filmMode(false);
    if (this.keyHandler) removeEventListener('keydown', this.keyHandler, true);
    if (this.tapHandler) ui.root.ownerDocument.removeEventListener('pointerdown', this.tapHandler, true);
    this.keyHandler = null;
    this.tapHandler = null;
    Intro.release(engine);
    this.stage = null;
    try {
      this.h.audio.ambience('fields', 2);
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------------------------------------- skipping
  /** Skip button: one click. Enter / Esc: at once. Any other key / tap: the first shows the hint, the second skips. */
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
  private handle(s: IntroShot): FilmSetHandle | null {
    if (s.set === 'black' || s.set === 'world') return null;
    return this.stage?.sets[s.set] ?? null;
  }

  /** the take actually played: a missing film set falls back to a world vista (the cut still keeps its timing) */
  private takeOf(s: IntroShot): { set: 'black' | 'world' | 'stage'; take: string } {
    if (s.set === 'black') return { set: 'black', take: s.take };
    if (s.set === 'world') return { set: 'world', take: s.take };
    if (this.handle(s)) return { set: 'stage', take: s.take };
    return { set: 'world', take: 'vista' };
  }

  private enter(i: number, instant = false) {
    const { engine, audio, ui } = this.h;
    const s = this.plan[i].shot;
    this.idx = i;
    // dissolves crossfade the canvas; 'black' and 'light' are drawn by the grade (fadeState), 'smash' is a cut to black
    const fade = instant ? 0 : s.cut === 'dissolve' || s.cut === 'match' ? s.fade ?? 0.8 : 0;
    const opts = fade > 0 ? { crossfade: fade } : {};
    const tk = this.takeOf(s);
    // stage the actors for the new take first (a cut shows them already in place); leaving the world gives it back
    // its own exposure before a film set's view saves it
    if (tk.set === 'world') this.world.enter(tk.take);
    else this.world.suspend();
    const hdl = tk.set === 'stage' ? this.handle(s) : null;
    if (hdl) hdl.enter(tk.take);
    if (tk.set === 'black') {
      // black shots keep whatever view is bound; the renderer draws black
      engine.resetTemporal();
    } else if (hdl) {
      if (engine.view !== hdl.view) engine.setView(hdl.view, opts);
      else engine.resetTemporal(opts);
    } else if (engine.view) engine.restoreWorldView(opts);
    else engine.resetTemporal(opts);
    this.applyFade();
    // the new frame is posed before it renders (no frame of the old camera in the new set)
    this.updateShot(0);
    // a set the film has left for good is disposed now (phones: memory)
    if (this.stage && !this.keepSets) {
      for (const n of Object.keys(this.stage.sets) as FilmStageSet[]) {
        if (!this.plan.slice(i).some((p) => p.shot.set === n)) this.stage.release(n);
      }
    }
    // (CUT v4: no title card — the logo forms over D3's panorama on its beats: logoClock; the score keys its hit itself)
    void audio;
    void ui;
  }

  /** camera, actors and depth of field of the current shot */
  private updateShot(dt: number) {
    const p = this.plan[this.idx];
    if (!p) return;
    const s = p.shot;
    const lt = Math.max(0, this.t - p.start);
    const u0 = Math.min(1, lt / s.dur);
    const span = s.span ?? [0, 1];
    const u = span[0] + (span[1] - span[0]) * u0;
    // time inside the take: the span's offset + real seconds (the Gilgal blocking runs on shot seconds)
    const tk = this.takeOf(s);
    const post = this.h.engine.post;
    let focus: { point: THREE.Vector3; fStop: number } | null = null;
    let cam: THREE.PerspectiveCamera | null = null;
    let camPos: THREE.Vector3 | null = null;
    this.applyFade();
    if (tk.set === 'world') {
      this.world.tick(tk.take, lt, dt);
      this.world.frame(tk.take, u, lt, this.frame);
      applyHandheld(tk.take, lt, this.t, this.frame);
      focus = this.world.focus(tk.take, lt);
      // phones in portrait: re-aim toward the shot's subject (D1: David, not the valley his focus racks into); D3 lets go
      // of it over the glide (the last frame is the game's own camera)
      const keep = tk.take === 'horizon' && this.settleAt >= 0 ? 1 - smooth01((this.t - this.settleAt) / Math.max(0.1, this.length - this.settleAt - 0.1)) : 1;
      this.portrait(this.frame, this.world.subject(tk.take, this.pv3) ?? focus?.point ?? null, keep);
      cam = this.h.engine.camera;
      camPos = this.frame.pos; // the CameraRig poses the world camera after this update: focus on this frame's lens
    } else if (tk.set === 'stage') {
      const hdl = this.handle(s)!;
      hdl.tick(tk.take, lt, dt);
      focus = hdl.focus(tk.take, lt);
      if (hdl.frame(tk.take, u, lt, this.f2)) {
        applyHandheld(tk.take, lt, this.t, this.f2);
        this.portrait(this.f2, focus?.point ?? null);
        const c = hdl.camera;
        c.position.copy(this.f2.pos);
        c.up.set(0, 1, 0);
        c.lookAt(this.f2.look);
        if (this.f2.roll) c.rotateZ(this.f2.roll);
        const fov = this.f2.fov ?? 40;
        if (Math.abs(c.fov - fov) > 1e-4) {
          c.fov = fov;
          c.updateProjectionMatrix();
        }
        c.updateMatrixWorld();
        cam = c;
      }
    }
    this.sfx(s, lt);
    if (!post.dofAvailable) return;
    if (focus && cam) {
      const d = Math.max(0.2, focus.point.distanceTo(camPos ?? cam.position));
      post.setDoF({ enabled: true, focusDistance: d, fStop: focus.fStop, focalLength: null, target: null });
    } else if (post.dofSettings.enabled) post.setDoF({ enabled: false, target: null });
  }

  /**
   * Phones in portrait: the shots are composed for a 2.39 frame, and the lens keeps its vertical angle, so a tall
   * screen would show only the middle quarter of the composition (the subject on a third is lost). The lens widens
   * to keep ~45 % of the horizontal coverage and turns toward the take's focus point (by design the subject: eyes,
   * the fist, the stone, the lamb).
   */
  private portrait(f: ShotFrame, subject: THREE.Vector3 | null, keep = 1) {
    const el = this.h.engine.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    if (!(aspect < 0.95) || keep <= 0) return;
    const fov = f.fov ?? 40;
    const k = 1 + (Math.min(2.6, Math.max(1, (0.45 * 2.39) / aspect)) - 1) * keep;
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * k);
    f.fov = Math.min(78, THREE.MathUtils.radToDeg(2 * half));
    if (subject) {
      // re-aim horizontally toward the subject (keep the shot's tilt)
      const d = this.pv.copy(f.look).sub(f.pos);
      const dist = d.length();
      const s = this.pv2.copy(subject).sub(f.pos);
      const sd = s.length();
      if (dist > 1e-4 && sd > 0.3) {
        d.multiplyScalar(1 / dist);
        s.multiplyScalar(1 / sd);
        d.lerp(s, 0.6 * keep).normalize();
        f.look.copy(f.pos).addScaledVector(d, dist);
      }
    }
  }
  private readonly pv = new THREE.Vector3();
  private readonly pv2 = new THREE.Vector3();
  private readonly pv3 = new THREE.Vector3();

  /** one-shot sounds inside shots (CUT v4: none — the score keys everything to the beats; the hook's sounds moved to
   *  the bear's attack in gameplay, src/gameplay/BearHook.ts) */
  private sfx(s: IntroShot, lt: number) {
    void s;
    void lt;
    void this.sfxFired;
  }

  private fireText() {
    while (this.textIdx < this.texts.length && this.t >= this.texts[this.textIdx].t) {
      const e = this.texts[this.textIdx++];
      this.showText(e.x, e.t, 0);
    }
  }

  /** one text event (started at film time `start`; `elapsed` s of it already played: seek) */
  private showText(x: IntroText, start: number, elapsed: number) {
    const { ui } = this.h;
    const auto = !this.testClock;
    let el: HTMLElement | null = null;
    const o = {
      side: x.side,
      v: x.v,
      lines: x.lines,
      gold: x.gold,
      stagger: x.stagger,
      refAfter: x.refAfter,
      // speech-synced words: shot seconds -> seconds from the text's start
      words: x.words ? x.words.map((w) => Math.max(0, w.t - x.at)) : undefined,
    };
    if (x.kind === 'verse' && x.quote) {
      const [text, ref] = verseArgs(x.quote);
      el = ui.filmText('verse', text, ref, x.seconds, elapsed, auto, o);
    } else {
      const ids = x.narration ?? [];
      if (!ids.length) return;
      if (x.kind === 'person') el = ui.filmText('person', narration(ids[0]), ids[1] ? narration(ids[1]) : '', x.seconds, elapsed, auto, o);
      else el = ui.filmText(x.kind, narration(ids[0]), '', x.seconds, elapsed, auto, o);
    }
    if (el && this.testClock) this.liveTexts.push({ el, start, dur: x.seconds });
  }

  /** black drawn by the renderer (post grade uFade): texts and the title stay above it */
  private setBlack(v: number, color: THREE.Color = BLACK) {
    this.black = v;
    const post = this.h.engine.post;
    const u = post.grade.uniforms.uFade;
    if (u) u.value = v;
    const c = post.look.uFadeColor;
    if (c && !(c.value as THREE.Color).equals(color)) (c.value as THREE.Color).copy(color);
  }

  /**
   * The grade's fade for film time t (pure: seek-safe): out of black at the start, the warm light-flash across the
   * 'light' cut (half before it, half after), black on 'black' shots.
   */
  private fadeState(): { v: number; color: THREE.Color } {
    const p = this.plan[this.idx];
    if (!p) return { v: 1, color: BLACK };
    const s = p.shot;
    const lt = this.t - p.start;
    if (s.set === 'black') return { v: 1, color: BLACK };
    if (s.cut === 'black') {
      const hold = s.hold ?? 0.3, f = s.fade ?? 1.2;
      return { v: 1 - smooth01((lt - hold) / f), color: BLACK };
    }
    // the flash: the second half after a 'light' cut ...
    if (s.cut === 'light') {
      const half = (s.fade ?? 0.6) / 2;
      if (lt < half * 1.25) return { v: 1 - smooth01(lt / (half * 1.25)), color: FLASH_LIGHT };
    }
    // ... and the first half before it (at the end of the previous shot)
    const next = this.plan[this.idx + 1];
    if (next && next.shot.cut === 'light') {
      const half = (next.shot.fade ?? 0.6) / 2;
      const to = next.start - this.t;
      if (to < half * 0.8) return { v: smooth01(1 - to / (half * 0.8)), color: FLASH_LIGHT };
    }
    return { v: 0, color: BLACK };
  }

  private applyFade() {
    const f = this.fadeState();
    this.setBlack(f.v, f.color);
  }
}
