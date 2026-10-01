import * as THREE from 'three';
import { AudioEngine, type BedName, type MusicMood, type SfxName, type SfxOptions } from '../audio/AudioEngine';
import type { IntroCue } from '../content/introScript';

/** Named ambience beds for the intro and the chapter ('none' fades the bed out). */
export type AmbienceName = BedName;

/** Thin wrapper adding distance attenuation + stereo panning relative to the camera. */
export class GameAudio {
  readonly engine = new AudioEngine();
  constructor(private camera: THREE.Camera) {}

  init() {
    return this.engine.init();
  }
  /**
   * One-shot sound. The bear's hook (Story.bearAttack, CUT v4): 'birdsScatter' when the birds fly up out of the bushes
   * (wings + alarm calls, ≈2 s), 'eyesSting' when the eyes open in the dark (a low, dark sting with the bear's breath).
   */
  sfx(name: SfxName, opts?: SfxOptions) {
    try {
      this.engine.sfx(name, opts);
    } catch {
      /* never let audio break the game */
    }
  }
  /** Positional one-shot: volume by distance, pan by screen side. */
  at(name: SfxName, pos: THREE.Vector3, volume = 1, pitch = 1, maxDist = 60) {
    const cam = this.camera;
    const d = cam.position.distanceTo(pos);
    if (d > maxDist) return;
    const att = Math.min(1, 3 / Math.max(3, d)) * (1 - d / maxDist) ** 0.5;
    const local = pos.clone().applyMatrix4(tmpM.copy(cam.matrixWorld).invert());
    const pan = THREE.MathUtils.clamp(local.x / Math.max(2, Math.abs(local.z) + Math.abs(local.x)), -0.9, 0.9);
    this.sfx(name, { volume: volume * att, pitch, pan });
  }
  /**
   * Crossfade the music to a mood. 'hush' (the bear's hook: the birds fall silent) also turns the ambience to the
   * 'hush' bed — the pastoral and the birds fall away into the wind, a low drone and a slow heartbeat — until
   * 'tension' takes over. 'pastoral' asked for while the opening film's score is ending waits for the score's own
   * hand-off (it starts the pastoral on its bar line).
   */
  music(m: MusicMood, fade = 3) {
    this.engine.setMusicMood(m, fade);
  }
  /**
   * Either the legacy continuous levels `ambience(wind, cicadas, birds)` (0..1 each) or a named bed
   * `ambience('fields' | 'dawn' | 'gibeah-exterior' | 'gibeah-hall' | 'heights' | 'coast' | 'gilgal' | 'hush' | 'none', fade = 1.5)`.
   * While the opening film's score plays it owns the ambience: legacy level calls are ignored then, and a named
   * call takes the ambience over from the score.
   */
  ambience(name: AmbienceName, fade?: number): void;
  ambience(wind: number, cicadas: number, birds: number): void;
  ambience(a: AmbienceName | number, b?: number, c?: number): void {
    try {
      if (typeof a === 'number') this.engine.setAmbience({ wind: a, cicadas: b ?? 0, birds: c ?? 0 });
      else this.engine.setAmbienceBed(a, b ?? 1.5);
    } catch {
      /* never let audio break the game */
    }
  }
  /**
   * Start the score + sound design of the opening film, synchronised to its shot sheet (reads each shot cue's
   * `cue`, `set`, `t`, `shot`, `dur`, `cut`, `fade`, `beats` and `slowmo`, and the text cues' times and `words`, at
   * call time — every hit is keyed to the named beats of the sheet, so a retimed sheet stays in sync). `startAt` = film
   * time (s) to start from. The score plays its own warm hit ON the logo (D3 `logo`; a sfx('titleHit') at that moment
   * is absorbed; one made early — a skip — jumps the score to its logo statement). At the end of the last shot the
   * score hands over to the game's pastoral music by itself, on its own bar line (CUT v4: no silence, no seam): a
   * stopIntro() or music('pastoral') at that moment is absorbed, its last chord rings out. While it plays,
   * music('title') is ignored and any other music(mood) ends it with that fade. The ambience bed follows the cues
   * automatically until you call ambience(name) yourself. Call syncIntro(filmClock) every frame.
   */
  playIntro(cues: readonly IntroCue[], startAt = 0): void {
    try { this.engine.playIntro(cues, startAt); } catch { /* never let audio break the game */ }
  }
  /** Fade the intro score out (seconds); at its hand-off (the end of the film) its last chord rings out instead. */
  stopIntro(fade = 1.5): void {
    try { this.engine.stopIntro(fade); } catch { /* ignore */ }
  }
  /** Report the film clock (s) every frame: the score re-locks when it drifts > 0.1 s (hitches, stalls). */
  syncIntro(t: number): void {
    try { this.engine.syncIntro(t); } catch { /* ignore */ }
  }
  /** Force the light (phone) voicing, e.g. from engine.quality.name === 'low'. Auto-detected otherwise. */
  setLite(on: boolean): void {
    this.engine.setLite(on);
  }
  slingSpin(active: boolean, power: number) {
    this.engine.slingSpin(active, power);
  }
  slowMo(a: number) {
    this.engine.setSlowMotion(a);
  }
  update(dt: number) {
    this.engine.update(dt);
  }
  setVolume(v: number) {
    this.engine.setMasterVolume(v);
  }
}

const tmpM = new THREE.Matrix4();
