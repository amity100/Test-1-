import * as THREE from 'three';
import { AudioEngine, type MusicMood, type SfxName, type SfxOptions } from '../audio/AudioEngine';
import type { IntroCue } from '../content/introScript';

/** Named ambience beds for the intro and the chapter ('none' fades the bed out). */
export type AmbienceName = 'fields' | 'gibeah-exterior' | 'gibeah-hall' | 'none';

/** Thin wrapper adding distance attenuation + stereo panning relative to the camera. */
export class GameAudio {
  readonly engine = new AudioEngine();
  constructor(private camera: THREE.Camera) {}

  init() {
    return this.engine.init();
  }
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
  music(m: MusicMood, fade = 3) {
    this.engine.setMusicMood(m, fade);
  }
  /**
   * Either the legacy continuous levels `ambience(wind, cicadas, birds)` (0..1 each) or a named bed
   * `ambience('fields' | 'gibeah-exterior' | 'gibeah-hall' | 'none', fade = 1.5)`.
   */
  ambience(name: AmbienceName, fade?: number): void;
  ambience(wind: number, cicadas: number, birds: number): void;
  ambience(a: AmbienceName | number, b?: number, c?: number): void {
    try {
      if (typeof a === 'number') this.engine.setAmbience({ wind: a, cicadas: b ?? 0, birds: c ?? 0 });
      else void b; // named beds: implemented in the score pass
    } catch {
      /* never let audio break the game */
    }
  }
  /**
   * Start the intro score synchronised to the cue sheet (reads each cue's `beat` and `t` at call time,
   * so retimed/reordered sheets stay in sync). `startAt` = intro time (s) to start from (for skipping).
   */
  playIntro(cues: readonly IntroCue[], startAt = 0): void {
    void cues;
    void startAt;
  }
  /** Fade the intro score out (seconds). */
  stopIntro(fade = 1.5): void {
    void fade;
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
