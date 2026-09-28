import * as THREE from 'three';
import { AudioEngine, type MusicMood, type SfxName, type SfxOptions } from '../audio/AudioEngine';

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
  ambience(wind: number, cicadas: number, birds: number) {
    this.engine.setAmbience({ wind, cicadas, birds });
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
