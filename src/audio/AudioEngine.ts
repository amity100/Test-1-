import * as THREE from 'three';

export type SfxName =
  | 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'sniper' | 'rocket'
  | 'explosion' | 'hit' | 'hurt' | 'kill' | 'headshot' | 'reload' | 'empty'
  | 'footstep' | 'jump' | 'land' | 'grapple' | 'grappleMiss' | 'ricochet' | 'bounce'
  | 'captureTick' | 'captureDone' | 'alarm' | 'roundStart' | 'roundEnd' | 'countdown'
  | 'uiClick' | 'uiHover' | 'place' | 'erase' | 'pickup' | 'switch' | 'spawn' | 'victory';

export interface PlayOpts {
  pos?: THREE.Vector3;
  volume?: number;
  pitch?: number;
}

type MusicState = 'off' | 'menu' | 'build' | 'battle' | 'podium';

/** Fully procedural Web Audio engine: synthesised SFX with distance/pan, plus ambient music layers. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private reverb!: ConvolverNode;
  private reverbGain!: GainNode;
  private listenerPos = new THREE.Vector3();
  private listenerRight = new THREE.Vector3(1, 0, 0);
  private musicState: MusicState = 'off';
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private lastStep = 0;
  sfxVolume = 0.8;
  musicVolume = 0.5;
  private started = false;

  get ready(): boolean {
    return this.started;
  }

  /** Must be called from a user gesture. */
  init(): void {
    if (this.started) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);
    // Noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Simple synthetic reverb
    this.reverb = ctx.createConvolver();
    const rl = ctx.sampleRate * 1.6;
    const ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < rl; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.8) * 0.5;
    }
    this.reverb.buffer = ir;
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.22;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
    this.started = true;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (!this.ctx) return;
    this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(music * (this.musicState === 'off' ? 0 : 1), this.ctx.currentTime, 0.1);
  }

  setListener(pos: THREE.Vector3, right: THREE.Vector3): void {
    this.listenerPos.copy(pos);
    this.listenerRight.copy(right);
  }

  private spatial(pos: THREE.Vector3 | undefined, maxDist: number): { gain: number; pan: number } {
    if (!pos) return { gain: 1, pan: 0 };
    const d = pos.distanceTo(this.listenerPos);
    const gain = Math.max(0, 1 - d / maxDist) ** 1.4;
    const dx = pos.x - this.listenerPos.x;
    const dz = pos.z - this.listenerPos.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const pan = Math.max(-1, Math.min(1, ((dx * this.listenerRight.x + dz * this.listenerRight.z) / len) * Math.min(1, d / 4)));
    return { gain, pan };
  }

  private out(vol: number, pan: number, reverbAmt = 0.3): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(this.sfxGain);
    if (reverbAmt > 0) {
      const rg = ctx.createGain();
      rg.gain.value = reverbAmt;
      p.connect(rg);
      rg.connect(this.reverb);
    }
    return g;
  }

  private noiseBurst(out: AudioNode, t: number, dur: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1, freqEnd?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private tone(out: AudioNode, t: number, dur: number, gain: number, type: OscillatorType, f0: number, f1?: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name: SfxName, opts: PlayOpts = {}): void {
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pitch = opts.pitch ?? 1;
    const maxDist = name === 'explosion' ? 160 : name === 'sniper' || name === 'rocket' ? 140 : name === 'footstep' ? 18 : 90;
    const sp = this.spatial(opts.pos, maxDist);
    if (sp.gain <= 0.001) return;
    const vol = (opts.volume ?? 1) * sp.gain;
    switch (name) {
      case 'pistol': {
        const o = this.out(vol * 0.55, sp.pan, 0.35);
        this.noiseBurst(o, t, 0.12, 1.0, 'bandpass', 1800 * pitch, 0.7, 500);
        this.tone(o, t, 0.08, 0.6, 'square', 220 * pitch, 60);
        break;
      }
      case 'smg': {
        const o = this.out(vol * 0.42, sp.pan, 0.3);
        this.noiseBurst(o, t, 0.08, 1.0, 'bandpass', 2400 * pitch, 0.8, 700);
        this.tone(o, t, 0.05, 0.5, 'square', 300 * pitch, 90);
        break;
      }
      case 'rifle': {
        const o = this.out(vol * 0.55, sp.pan, 0.4);
        this.noiseBurst(o, t, 0.13, 1.0, 'bandpass', 1500 * pitch, 0.6, 400);
        this.tone(o, t, 0.09, 0.7, 'sawtooth', 180 * pitch, 50);
        break;
      }
      case 'shotgun': {
        const o = this.out(vol * 0.8, sp.pan, 0.5);
        this.noiseBurst(o, t, 0.28, 1.0, 'lowpass', 2500 * pitch, 0.5, 300);
        this.tone(o, t, 0.18, 0.9, 'sawtooth', 120 * pitch, 35);
        break;
      }
      case 'sniper': {
        const o = this.out(vol * 0.85, sp.pan, 0.6);
        this.noiseBurst(o, t, 0.35, 1.0, 'bandpass', 1200 * pitch, 0.5, 200);
        this.tone(o, t, 0.25, 0.8, 'sawtooth', 140 * pitch, 30);
        this.tone(o, t + 0.02, 0.4, 0.2, 'sine', 900 * pitch, 400);
        break;
      }
      case 'rocket': {
        const o = this.out(vol * 0.7, sp.pan, 0.5);
        this.noiseBurst(o, t, 0.5, 0.9, 'lowpass', 900 * pitch, 0.7, 2500);
        this.tone(o, t, 0.3, 0.5, 'sawtooth', 90 * pitch, 160);
        break;
      }
      case 'explosion': {
        const o = this.out(vol * 1.0, sp.pan, 0.7);
        this.noiseBurst(o, t, 1.1, 1.0, 'lowpass', 1800, 0.6, 80);
        this.tone(o, t, 0.6, 1.0, 'sine', 90, 25);
        this.tone(o, t, 0.25, 0.6, 'square', 60, 20);
        break;
      }
      case 'hit': {
        const o = this.out(vol * 0.35, 0, 0);
        this.tone(o, t, 0.06, 0.8, 'square', 1400, 900);
        break;
      }
      case 'headshot': {
        const o = this.out(vol * 0.45, 0, 0.1);
        this.tone(o, t, 0.08, 0.8, 'square', 1900, 1200);
        this.tone(o, t + 0.04, 0.12, 0.5, 'sine', 2600, 1800);
        break;
      }
      case 'hurt': {
        const o = this.out(vol * 0.5, sp.pan, 0.2);
        this.noiseBurst(o, t, 0.15, 0.8, 'lowpass', 600, 1, 200);
        this.tone(o, t, 0.12, 0.5, 'sawtooth', 160, 90);
        break;
      }
      case 'kill': {
        const o = this.out(vol * 0.5, 0, 0.2);
        this.tone(o, t, 0.12, 0.6, 'square', 660, 660);
        this.tone(o, t + 0.1, 0.18, 0.6, 'square', 990, 990);
        break;
      }
      case 'reload': {
        const o = this.out(vol * 0.4, sp.pan, 0.2);
        this.noiseBurst(o, t, 0.05, 0.6, 'highpass', 3000, 1);
        this.tone(o, t + 0.05, 0.05, 0.4, 'square', 500, 300);
        this.noiseBurst(o, t + 0.35, 0.06, 0.7, 'highpass', 2500, 1);
        this.tone(o, t + 0.36, 0.06, 0.5, 'square', 700, 400);
        break;
      }
      case 'empty': {
        const o = this.out(vol * 0.35, 0, 0);
        this.tone(o, t, 0.04, 0.5, 'square', 800, 500);
        break;
      }
      case 'switch': {
        const o = this.out(vol * 0.35, 0, 0.1);
        this.noiseBurst(o, t, 0.06, 0.5, 'highpass', 2000, 1);
        this.tone(o, t + 0.03, 0.05, 0.3, 'square', 400, 600);
        break;
      }
      case 'footstep': {
        const o = this.out(vol * 0.3, sp.pan, 0.15);
        this.noiseBurst(o, t, 0.09, 0.8, 'lowpass', 500 * pitch, 1, 150);
        break;
      }
      case 'jump': {
        const o = this.out(vol * 0.25, sp.pan, 0.1);
        this.noiseBurst(o, t, 0.12, 0.6, 'lowpass', 800, 1, 300);
        break;
      }
      case 'land': {
        const o = this.out(vol * 0.5, sp.pan, 0.2);
        this.noiseBurst(o, t, 0.18, 0.9, 'lowpass', 400, 1, 100);
        this.tone(o, t, 0.1, 0.5, 'sine', 80, 40);
        break;
      }
      case 'grapple': {
        const o = this.out(vol * 0.5, sp.pan, 0.2);
        this.noiseBurst(o, t, 0.25, 0.6, 'bandpass', 900, 2, 3000);
        this.tone(o, t, 0.2, 0.4, 'sawtooth', 200, 700);
        break;
      }
      case 'grappleMiss': {
        const o = this.out(vol * 0.3, 0, 0.1);
        this.tone(o, t, 0.12, 0.4, 'sawtooth', 300, 120);
        break;
      }
      case 'ricochet': {
        const o = this.out(vol * 0.3, sp.pan, 0.3);
        this.tone(o, t, 0.15, 0.4, 'sine', 3000 * pitch, 800);
        this.noiseBurst(o, t, 0.06, 0.4, 'highpass', 4000, 1);
        break;
      }
      case 'bounce': {
        const o = this.out(vol * 0.35, sp.pan, 0.3);
        this.tone(o, t, 0.08, 0.5, 'square', 500 * pitch, 250);
        break;
      }
      case 'captureTick': {
        const o = this.out(vol * 0.35, 0, 0.1);
        this.tone(o, t, 0.08, 0.5, 'sine', 880 * pitch, 880 * pitch);
        break;
      }
      case 'captureDone': {
        const o = this.out(vol * 0.7, 0, 0.4);
        for (let i = 0; i < 4; i++) this.tone(o, t + i * 0.09, 0.3, 0.5, 'square', [523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.01);
        break;
      }
      case 'alarm': {
        const o = this.out(vol * 0.4, 0, 0.3);
        this.tone(o, t, 0.25, 0.5, 'square', 700, 700);
        this.tone(o, t + 0.28, 0.25, 0.5, 'square', 520, 520);
        break;
      }
      case 'roundStart': {
        const o = this.out(vol * 0.7, 0, 0.5);
        this.tone(o, t, 0.5, 0.6, 'sawtooth', 110, 110, 0.05);
        this.tone(o, t, 0.5, 0.4, 'square', 220, 220, 0.05);
        this.tone(o, t + 0.3, 0.9, 0.6, 'sawtooth', 165, 165, 0.05);
        this.noiseBurst(o, t, 0.6, 0.5, 'lowpass', 1200, 0.5, 200);
        break;
      }
      case 'roundEnd': {
        const o = this.out(vol * 0.6, 0, 0.5);
        this.tone(o, t, 0.6, 0.5, 'square', 392, 392, 0.02);
        this.tone(o, t + 0.2, 0.7, 0.5, 'square', 523, 523, 0.02);
        this.tone(o, t + 0.4, 1.0, 0.6, 'sawtooth', 659, 659, 0.02);
        break;
      }
      case 'countdown': {
        const o = this.out(vol * 0.5, 0, 0.2);
        this.tone(o, t, 0.15, 0.6, 'square', 660 * pitch, 660 * pitch);
        break;
      }
      case 'uiClick': {
        const o = this.out(vol * 0.3, 0, 0);
        this.tone(o, t, 0.06, 0.6, 'square', 900, 600);
        break;
      }
      case 'uiHover': {
        const o = this.out(vol * 0.12, 0, 0);
        this.tone(o, t, 0.04, 0.5, 'sine', 1400, 1400);
        break;
      }
      case 'place': {
        const o = this.out(vol * 0.35, 0, 0.15);
        this.tone(o, t, 0.07, 0.6, 'square', 420 * pitch, 300 * pitch);
        this.noiseBurst(o, t, 0.05, 0.4, 'highpass', 2500, 1);
        break;
      }
      case 'erase': {
        const o = this.out(vol * 0.35, 0, 0.15);
        this.noiseBurst(o, t, 0.12, 0.7, 'lowpass', 1200, 1, 300);
        break;
      }
      case 'pickup': {
        const o = this.out(vol * 0.45, 0, 0.2);
        this.tone(o, t, 0.1, 0.5, 'sine', 700, 1200);
        this.tone(o, t + 0.08, 0.15, 0.5, 'sine', 1200, 1600);
        break;
      }
      case 'spawn': {
        const o = this.out(vol * 0.4, 0, 0.4);
        this.noiseBurst(o, t, 0.5, 0.4, 'bandpass', 400, 3, 3000);
        this.tone(o, t, 0.4, 0.3, 'sine', 300, 900);
        break;
      }
      case 'victory': {
        const o = this.out(vol * 0.7, 0, 0.5);
        const notes = [523, 659, 784, 1046, 784, 1046, 1318];
        notes.forEach((f, i) => this.tone(o, t + i * 0.14, 0.35, 0.5, i % 2 ? 'square' : 'sawtooth', f, f, 0.01));
        break;
      }
    }
  }

  /** Footsteps rate-limited per entity speed. */
  footstep(pos: THREE.Vector3, volume = 1): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastStep < 0.28) return;
    this.lastStep = t;
    this.play('footstep', { pos, volume, pitch: 0.85 + Math.random() * 0.3 });
  }

  music(state: MusicState): void {
    if (state === this.musicState) return;
    this.musicState = state;
    if (!this.ctx) return;
    this.stopMusic();
    if (state === 'off') {
      this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      return;
    }
    this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.8);
    this.startMusic(state);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.musicNodes) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* ignore */
      }
      n.disconnect();
    }
    this.musicNodes = [];
  }

  private startMusic(state: MusicState): void {
    const ctx = this.ctx!;
    // Pad: detuned saws through a lowpass, slow chord changes.
    const pad = ctx.createGain();
    pad.gain.value = state === 'battle' ? 0.06 : 0.09;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = state === 'battle' ? 900 : 600;
    pad.connect(lp);
    lp.connect(this.musicGain);
    lp.connect(this.reverb);
    const chords: number[][] = state === 'battle' ? [[55, 82.4, 110, 164.8], [58.3, 87.3, 116.5, 174.6], [49, 73.4, 98, 146.8], [61.7, 92.5, 123.5, 185]] : [[65.4, 98, 130.8, 196], [58.3, 87.3, 116.5, 174.6], [73.4, 110, 146.8, 220], [61.7, 92.5, 123.5, 185]];
    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 4; i++) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = chords[0][i];
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        o.connect(g);
        g.connect(pad);
        o.start();
        oscs.push(o);
        this.musicNodes.push(o, g);
      }
    }
    this.musicNodes.push(pad, lp);
    let chord = 0;
    const step = (): void => {
      chord = (chord + 1) % chords.length;
      const t = ctx.currentTime;
      oscs.forEach((o, idx) => o.frequency.setTargetAtTime(chords[chord][Math.floor(idx / 2)], t, 0.6));
    };
    // Battle: add a pulse
    if (state === 'battle') {
      let beat = 0;
      this.musicTimer = window.setInterval(() => {
        const t = ctx.currentTime;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        g.connect(this.musicGain);
        // kick
        if (beat % 2 === 0) this.tone(g, t, 0.18, 0.7, 'sine', 120, 40);
        // hat
        this.noiseBurst(g, t + (beat % 2 ? 0.0 : 0.25), 0.04, 0.12, 'highpass', 6000, 1);
        if (beat % 8 === 7) step();
        beat++;
      }, 500);
    } else {
      this.musicTimer = window.setInterval(step, state === 'menu' ? 6000 : 5000);
    }
  }
}

export const audio = new AudioEngine();
