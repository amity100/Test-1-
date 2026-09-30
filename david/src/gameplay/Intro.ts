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
import { FilmWorld } from '../film/FilmWorld';

/**
 * THE OPENING FILM "הַטּוֹב מִמֶּךָּ" (docs/intro-script.md, ≈2:45): the player of the shot sheet
 * src/content/introScript.ts. It switches between the film sets (src/film/FilmStage.ts: the prologue land sets, Gilgal)
 * and the game world (src/film/FilmWorld.ts: Rachel's pillar, Bethlehem, David, the flock, the thicket) with
 * engine.setView / restoreWorldView / resetTemporal on every cut, drives the letterbox, depth of field, the film look
 * and the fades, fires the on-screen text (narration from src/content/introNarration.ts, verses ONLY through the
 * catalog helpers), keeps the score locked to the picture, and hands off to gameplay (David on his rock).
 *
 * Black is drawn by the renderer (post.grade uFade), so the time card and the title sit above it and every
 * dissolve from / into black is a real crossfade of the canvas.
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

/** heading David is given for the first gameplay frame (facing the pasture and the flock) */
const GAMEPLAY_HEADING = 0.46;
/** the sunlit cloud colour the rise dissolves through into Bethlehem (shot 13 -> 14) */
const CLOUD_LIGHT = 0xf2e6cf;

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
  private titleShown = false;
  private skipArmedT = -1;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private tapHandler: ((e: PointerEvent) => void) | null = null;
  private finished = false;
  private black = 1;
  private birdsOff = false;
  private readonly sfxFired = new Set<string>();
  /** ?test=1: on-screen text and the title card run on the FILM clock (contact sheets / slow software rendering) */
  private readonly testClock = params().get('test') === '1';
  /** ?filmkeep=1 (tests): keep every film set resident so the harness can seek backwards */
  private readonly keepSets = params().get('filmkeep') === '1';
  private readonly liveTexts: { el: HTMLElement; start: number; dur: number }[] = [];
  private titleStart = -1;

  constructor(private readonly h: IntroHost, _opts: { short?: boolean } = {}) {
    let t = 0;
    for (const s of INTRO_SHOTS) {
      for (const x of s.text ?? []) this.texts.push({ t: t + x.at, x });
      t += s.dur;
    }
    this.texts.sort((a, b) => a.t - b.t);
    this.world = new FilmWorld({ engine: h.engine, player: h.player, flock: h.flock, bear: h.bear });
  }

  get done() {
    return this.state === 'done';
  }

  /** What is real and what is placeholder on the stage (tests / the report). */
  status(): string[] {
    const s = this.stage;
    if (!s) return ['no film stage (world shots only)'];
    const out: string[] = [];
    for (const n of ['judah', 'coast', 'ramah', 'gilgal'] as FilmStageSet[]) {
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
    if (this.plan[i].shot.id !== 'title' && this.titleShown) {
      // seeking back out of the title (tests)
      this.titleShown = false;
      this.titleStart = -1;
      this.h.ui.titleCard(false);
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
    this.syncTextClock();
  }

  /** tests: pin every film text / title animation to the film clock (wall-clock CSS would run ahead of slow frames) */
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
    if (this.titleShown && this.titleStart >= 0) {
      for (const a of this.h.ui.titleElement.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = Math.max(0, this.t - this.titleStart) * 1000;
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
    this.state = 'done';
    this.skipped = skipped;
    ui.preroll(null);
    ui.skip(false);
    ui.skipHint(false);
    ui.clearFilmText(skipped ? 0.4 : 0.8);
    // skipped while the score plays: it jumps to its own title statement (the sfx('titleHit') below)
    if (!skipped || wasLoading) {
      try {
        audio.stopIntro(skipped ? 1.2 : 2.5);
      } catch {
        /* audio never breaks the game */
      }
    }
    const post = engine.post;
    this.world.leave();
    // SHOT 21 — the game begins: David on his rock, facing the pasture and the flock; the follow camera behind him
    const L = { x: 0.2, z: 2.3 };
    player.place(L.x, L.z, GAMEPLAY_HEADING);
    cam.stop();
    cam.snapBehind(player.heading, 0.15);
    if (skipped) {
      // a clean dissolve from wherever the film was into gameplay (never a black frame), a short title over it
      if (wasLoading) ui.fade(0, 1.2);
      else if (engine.view) engine.restoreWorldView({ crossfade: 0.8 });
      else engine.crossfade(0.8);
      this.setBlack(0);
      ui.titleCard(true);
      audio.sfx('titleHit');
      window.setTimeout(() => ui.titleCard(false), 3800);
    } else {
      // out of the title's black: the picture dissolves in under the fading title
      if (engine.view) engine.restoreWorldView({ crossfade: 2.2 });
      else engine.crossfade(2.2);
      this.setBlack(0);
      window.setTimeout(() => ui.titleCard(false), 250);
    }
    post.setLetterbox(null, skipped ? 0.8 : 2.4);
    post.setFilmLook(this.savedFilm, skipped ? 0.8 : 2.6);
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
      ui.titleCard(false);
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
    return { set: 'world', take: s.set === 'gilgal' || s.set === 'coast' ? 'contrast' : 'bethlehem' };
  }

  private enter(i: number, instant = false) {
    const { engine, audio, ui } = this.h;
    const s = this.plan[i].shot;
    this.idx = i;
    const fade = instant ? 0 : s.cut === 'dissolve' || s.cut === 'match' || s.cut === 'light' || s.cut === 'black' ? s.fade ?? 1.2 : 0;
    const opts = fade > 0 ? { crossfade: fade, through: s.cut === 'light' ? CLOUD_LIGHT : undefined } : {};
    const tk = this.takeOf(s);
    // stage the actors for the new take first (a cut shows them already in place)
    if (tk.set === 'world') this.world.enter(tk.take);
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
    this.setBlack(tk.set === 'black' ? 1 : 0);
    // the new frame is posed before it renders (no frame of the old camera in the new set)
    this.updateShot(0);
    // a set the film has left for good is disposed now (phones: memory)
    if (this.stage && !this.keepSets) {
      for (const n of Object.keys(this.stage.sets) as FilmStageSet[]) {
        if (!this.plan.slice(i).some((p) => p.shot.set === n)) this.stage.release(n);
      }
    }
    // sound design hooks the score does not own (the score keys on the cue sheet itself)
    try {
      if (s.id === 'thicket' && !this.birdsOff) {
        this.birdsOff = true;
        audio.ambience(0.32, 0, 0); // the birds fall silent; only the wind
      }
      if (s.id === 'title' && !this.titleShown) {
        this.titleShown = true;
        this.titleStart = this.plan[i].start;
        ui.clearFilmText(0.2);
        this.liveTexts.length = 0;
        ui.titleCard(true);
        audio.sfx('titleHit');
      }
    } catch {
      /* audio never breaks the film */
    }
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
    if (tk.set === 'world') {
      this.world.tick(tk.take, lt, dt);
      this.world.frame(tk.take, u, lt, this.frame);
      focus = this.world.focus(tk.take, lt);
      cam = this.h.engine.camera;
      camPos = this.frame.pos; // the CameraRig poses the world camera after this update: focus on this frame's lens
    } else if (tk.set === 'stage') {
      const hdl = this.handle(s)!;
      hdl.tick(tk.take, lt, dt);
      if (hdl.frame(tk.take, u, lt, this.f2)) {
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
      focus = hdl.focus(tk.take, lt);
    }
    this.sfx(s, lt);
    if (!post.dofAvailable) return;
    if (focus && cam) {
      const d = Math.max(0.2, focus.point.distanceTo(camPos ?? cam.position));
      post.setDoF({ enabled: true, focusDistance: d, fStop: focus.fStop, focalLength: null, target: null });
    } else if (post.dofSettings.enabled) post.setDoF({ enabled: false, target: null });
  }

  /** one-shot sounds inside shots (breathing in the thicket, the lamb) */
  private sfx(s: IntroShot, lt: number) {
    const fire = (key: string, at: number, fn: () => void) => {
      if (lt >= at && !this.sfxFired.has(key)) {
        this.sfxFired.add(key);
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
    };
    const a = this.h.audio;
    if (s.id === 'thicket') fire('breath', 1.0, () => a.sfx('bearGrowl', { volume: 0.28, pitch: 0.7 }));
    if (s.id === 'eyes') fire('lamb', 0.2, () => a.sfx('lambBleat', { volume: 0.5 }));
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
    if (x.kind === 'verse' && x.quote) {
      const [text, ref] = verseArgs(x.quote);
      el = ui.filmText('verse', text, ref, x.seconds, elapsed, auto);
    } else {
      const ids = x.narration ?? [];
      if (!ids.length) return;
      if (x.kind === 'person') el = ui.filmText('person', narration(ids[0]), ids[1] ? narration(ids[1]) : '', x.seconds, elapsed, auto);
      else el = ui.filmText(x.kind, narration(ids[0]), '', x.seconds, elapsed, auto);
    }
    if (el && this.testClock) this.liveTexts.push({ el, start, dur: x.seconds });
  }

  /** black drawn by the renderer (post grade uFade): texts and the title stay above it */
  private setBlack(v: number) {
    this.black = v;
    const u = this.h.engine.post.grade.uniforms.uFade;
    if (u) u.value = v;
  }
}
