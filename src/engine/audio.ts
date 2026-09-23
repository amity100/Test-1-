import * as THREE from 'three';
import type { AudioAPI, StyleRank, V3 } from '../core/contracts';

/* =============================================================================
 * THRESHOLD audio. Every sound is synthesised with WebAudio at runtime:
 * oscillators, four noise buffers generated once, envelopes. Zero files.
 *
 *   one-shot voices ─► [panner] ─► sfx ─────────────────────┐
 *                      [panner] ─► drive (tanh) ─► sfx      │
 *   sfx ─► verb send ─► 3-delay ring (cheap reverb) ────────┤
 *   music (pad, heartbeat, drums, bass, arp, echo) ─────────┼─► master ─► slow-mo LP ─► comp ─► out
 *   ambience (sea, altitude wind, speed wind, loop whoosh) ─┘                           ▲
 *   ui / meta (tricks, combo bank) ─────────────────────────────────────────────────────┘ (not slowed)
 *
 * Rules: nothing throws into the game (no WebAudio = silent no-ops), the
 * AudioContext is created lazily in unlock(), at most `maxVoices` one-shots
 * play at once (the quietest / nearly finished one is replaced), every kind
 * of sound has a per-area throttle, and every node is disconnected when its
 * voice ends.
 * ========================================================================== */

type Buf = 'white' | 'pink' | 'brown' | 'crackle';
type Bus = 'sfx' | 'drive' | 'ui' | 'music' | 'amb';
/** A connect() target: a node, or a param for modulation. */
type Dest = AudioNode | AudioParam;

interface VoiceOpts {
  /** Panner reference distance (m): full level inside it. */
  ref?: number;
  /** Inverse-model rolloff factor. */
  roll?: number;
  /** Max concurrent voices of this kind (the oldest one is replaced). */
  cap?: number;
  /** Warnings / player feedback: never replaced by quieter sounds. */
  crit?: boolean;
  bus?: Bus;
  /** Throttle: minimum seconds between two of this kind from the same area cell. */
  gap?: number;
  /** Throttle cell size (m). */
  cell?: number;
}

/** Per-kind mixing / limiting rules. */
const O = {
  riftOpen: { ref: 7, gap: 0.08, crit: true },
  riftClose: { ref: 5, gap: 0.08 },
  riftPass: { ref: 5, gap: 0.05, cap: 4 },
  riftCatch: { ref: 6, gap: 0.1, crit: true },
  shear: { ref: 9, gap: 0.1, crit: true, bus: 'drive' },
  hijack: { ref: 7, gap: 0.2, crit: true },
  boltFire: { ref: 6, gap: 0.04, cap: 6 },
  boltWhizz: { ref: 3, gap: 0.06, cap: 3, cell: 2 },
  boltImpact: { ref: 4, gap: 0.03, cap: 6, cell: 2 },
  laserLock: { ref: 14, gap: 0.2, crit: true },
  beamCharge: { ref: 12, gap: 0.4, crit: true },
  beamFire: { ref: 12, gap: 0.15, bus: 'drive' },
  grenadeBounce: { ref: 4, gap: 0.06, cap: 3, cell: 1 },
  explosion: { ref: 14, roll: 0.8, gap: 0.06, cap: 4, bus: 'drive' },
  splash: { ref: 7, gap: 0.08, cap: 4 },
  impact: { ref: 5, gap: 0.05, cap: 5, cell: 1.5 },
  impactBig: { ref: 7, gap: 0.05, cap: 5, cell: 1.5, bus: 'drive' },
  shieldClang: { ref: 6, gap: 0.08, cap: 3 },
  roar: { ref: 12, gap: 0.5, crit: true, bus: 'drive' },
  bladeFinish: { ref: 5, gap: 0.1, crit: true },
  shove: { ref: 4, gap: 0.1 },
  footstep: { ref: 3, gap: 0.07, cap: 4, cell: 1 },
  jump: { ref: 3, gap: 0.12 },
  land: { ref: 4, gap: 0.1 },
  hurt: { gap: 0.1, crit: true },
  ui: { bus: 'ui', gap: 0.03, crit: true },
  meta: { bus: 'ui', crit: true },
  slowEdge: { bus: 'ui', gap: 0.2 },
  sting: { bus: 'music', gap: 1, crit: true },
  horn: { bus: 'amb' },
  clunk: { ref: 5, gap: 0.2 },
  shout: { ref: 6, gap: 0.4, cap: 2 },
} satisfies Record<string, VoiceOpts>;

const RANKS: readonly StyleRank[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
/** Stinger root per rank (D minor pentatonic ladder: A4 C5 D5 F5 G5 A5 D6). */
const TRICK_NOTE = [69, 72, 74, 77, 79, 81, 86];

/**
 * Music: 120 BPM, 16ths, a chord every 2 bars. D minor: Dm - Bb - F - C.
 * root = bass MIDI, pad = 4 pad voices, arp = 7 arpeggio tones (low to high).
 */
const PROG = [
  { root: 38, pad: [50, 57, 62, 65], arp: [62, 65, 69, 72, 74, 77, 81] },
  { root: 34, pad: [50, 53, 58, 62], arp: [58, 62, 65, 69, 70, 74, 77] },
  { root: 41, pad: [48, 57, 60, 65], arp: [60, 65, 69, 72, 77, 81, 84] },
  { root: 36, pad: [48, 55, 60, 64], arp: [60, 64, 67, 72, 74, 76, 79] },
] as const;
const STEP = 0.125;
const BASS_STEPS = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0];
const BASS_OCT = [0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 7, 0];
const ARP = [0, 2, 4, 6, 5, 3, 1, 3, 0, 2, 4, 6, 5, 4, 3, 2];
const BELL_NOTES = [74, 77, 79, 81, 84, 86];

const EPS = 0.0001;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Percussive envelope: linear attack to `peak`, exponential decay to silence at t + dur. */
function perc(p: AudioParam, t: number, peak: number, a: number, dur: number) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(EPS, t + Math.max(dur, a + 0.005));
  p.setValueAtTime(0, t + Math.max(dur, a + 0.005) + 0.001);
}
/** Swell envelope: exponential rise to `peak` at t + a, exponential fall to silence at t + dur. */
function swell(p: AudioParam, t: number, peak: number, a: number, dur: number) {
  p.setValueAtTime(EPS, t);
  p.exponentialRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(EPS, t + dur);
  p.setValueAtTime(0, t + dur + 0.001);
}
/** Exponential glide f0 -> f1 over d seconds (a constant value schedules no automation). */
function glide(p: AudioParam, t: number, f0: number, f1: number, d: number) {
  if (f1 === f0 || d <= 0) {
    p.value = f0;
    return;
  }
  p.setValueAtTime(f0, t);
  p.exponentialRampToValueAtTime(f1, t + d);
}
/** Continuous-control update with a dead-man fade: goes to 0 unless refreshed within `hold` s. */
function keep(p: AudioParam, target: number, t: number, tc: number, hold: number) {
  p.cancelScheduledValues(t);
  p.setTargetAtTime(target, t, tc);
  p.setTargetAtTime(0, t + hold, 0.25);
}
/**
 * k-rate automation: filter coefficients / oscillator frequency update once per
 * 128-frame block instead of per sample while they sweep or are LFO-modulated
 * (a large CPU win on phones; inaudible for these sweeps). No-op where unsupported.
 */
function kr(p: AudioParam) {
  try { p.automationRate = 'k-rate'; } catch { /* unsupported */ }
}
/** connect() to a node or a param (the DOM typings split these into two overloads). */
function link(a: AudioNode, b: Dest) {
  a.connect(b as AudioNode);
}
function place(p: PannerNode, v: V3) {
  if (p.positionX) {
    p.positionX.value = v.x;
    p.positionY.value = v.y;
    p.positionZ.value = v.z;
  } else p.setPosition(v.x, v.y, v.z);
}

class Voice {
  readonly srcs: AudioScheduledSourceNode[] = [];
  readonly nodes: AudioNode[] = [];
  live = 0;
  end = 0;
  dead = false;
  stolen = false;
  constructor(readonly kind: string, readonly out: GainNode, readonly prio: number, readonly t0: number) {}
}

interface Loop {
  g: GainNode;
  p: PannerNode | null;
  nodes: AudioNode[];
  srcs: AudioScheduledSourceNode[];
  /** Params driven by the global slow-mo detune. */
  tuned: AudioParam[];
}

type Handle = { stop(): void; move(v: V3): void };
const NIL_HANDLE: Handle = { stop() {}, move() {} };

export class Audio implements AudioAPI {
  /** The live context (null until unlock(); null forever without WebAudio). */
  ctx: BaseAudioContext | null = null;
  /** Concurrent one-shot limit (set ~16 on low-end phones). */
  maxVoices = 24;
  /** One-shots refused by the limiter (debug). */
  dropped = 0;
  /**
   * EXTRA: how one-shots are spatialised. 'stereo' (default): pan + inverse
   * distance gain computed once from the listener when the sound starts
   * (cheap: best for phones). 'panner': a PannerNode per voice (keeps
   * re-panning while the camera turns; costs more). Loops (hums, lift) always
   * use PannerNodes.
   */
  spatial: 'stereo' | 'panner' = 'stereo';

  private vol = { master: 0.9, music: 1, sfx: 1 };
  private paused = false;

  private out!: GainNode;
  private master!: GainNode;
  private slowLP!: BiquadFilterNode;
  private sfx!: GainNode;
  private driveIn!: GainNode;
  private uiBus!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private verbSend!: GainNode;
  private pitch: ConstantSourceNode | null = null;
  private bufs!: Record<Buf, AudioBuffer>;
  private loopSrc!: Record<'white' | 'pink' | 'brown', AudioBufferSourceNode>;
  private streamDest: MediaStreamAudioDestinationNode | null = null;

  private voices: Voice[] = [];
  private last = new Map<string, number>();
  private lis = new THREE.Vector3();
  private lisR = new THREE.Vector3(1, 0, 0);

  // slow-mo
  private slow = 0;
  private det = 0;
  private rate = 1;
  private slowEdgeT = -10;

  // continuous controls
  private amb: {
    windG: GainNode; windBP: BiquadFilterNode; windLP: BiquadFilterNode; rumbleG: GainNode; gustDepth: GainNode;
    seaG: GainNode; altG: GainNode; altBP: BiquadFilterNode; altGust: GainNode; howlG: GainNode;
  } | null = null;
  private loopW: { g: GainNode; bp: BiquadFilterNode; og: GainNode; o: OscillatorNode; trem: OscillatorNode } | null = null;
  private windT = -1;
  private windS = -1;
  private whooshT = -1;
  private alt = 0;
  private altT = -1;
  private altSet = -999;
  private hums = 0;
  private humLfo: GainNode | null = null;
  private liftLoop: Loop | null = null;
  private trickT = -1;

  // music
  private mus: {
    pad: OscillatorNode[]; sub: OscillatorNode; padF: BiquadFilterNode; pump: GainNode; padG: GainNode;
    tenG: GainNode; driveG: GainNode; highG: GainNode; bells: GainNode; arpF: BiquadFilterNode; stingG: GainNode;
  } | null = null;
  private mTen = 0;
  private mCmb = 0;
  private lv = { pad: 1, ten: 0, drv: 0, hi: 0 };
  private musT = -1;
  private step = 0;
  private nextT = -1;
  private hornT = 25;
  private gustT = 8;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Call from a user gesture (click / touch / key). Safe to call on every gesture. */
  unlock(): void {
    if (this.ctx) {
      this.resume();
      return;
    }
    let ctx: AudioContext;
    try {
      if (typeof window === 'undefined') return;
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    try {
      this.build(ctx);
    } catch {
      this.ctx = null;
      try { ctx.close().catch(() => {}); } catch { /* ignore */ }
      return;
    }
    try {
      // iOS: a sound started inside the gesture unlocks output.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start(0);
    } catch { /* ignore */ }
    this.resume();
  }

  private resume() {
    try {
      const c = this.ctx as AudioContext | null;
      if (!c || c.state === 'running' || typeof c.resume !== 'function') return;
      const r = c.resume() as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch { /* ignore */ }
  }

  /**
   * EXTRA: adopt an existing context instead of creating one (an
   * OfflineAudioContext for tests / offline renders, or a shared context).
   * Returns false if a context is already attached or the build failed.
   */
  useContext(ctx: BaseAudioContext): boolean {
    if (this.ctx) return false;
    try {
      this.build(ctx);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /** EXTRA: master / music / sfx volume (0..1). */
  setVolume(master: number, music?: number, sfx?: number): void {
    this.vol.master = clamp01(master);
    if (music !== undefined) this.vol.music = clamp01(music);
    if (sfx !== undefined) this.vol.sfx = clamp01(sfx);
    this.applyVolumes(0.05);
  }

  /** EXTRA: pause menu: ambience fades out, music ducks and dulls. UI sounds stay. */
  setPaused(p: boolean): void {
    this.paused = p;
    this.applyVolumes(0.15);
  }

  /** EXTRA: a MediaStream of the final mix (add it as an audio track to clip recordings). */
  mediaStream(): MediaStream | null {
    try {
      if (this.streamDest) return this.streamDest.stream;
      const c = this.ctx as AudioContext | null;
      if (!c || typeof c.createMediaStreamDestination !== 'function') return null;
      this.streamDest = c.createMediaStreamDestination();
      this.out.connect(this.streamDest);
      return this.streamDest.stream;
    } catch {
      return null;
    }
  }

  /** EXTRA: debug counters. */
  stats(): { voices: number; hums: number; dropped: number; state: string } {
    const t = this.ctx ? this.ctx.currentTime : 0;
    let n = 0;
    for (const v of this.voices) if (!v.stolen && v.end > t) n++;
    return { voices: n, hums: this.hums, dropped: this.dropped, state: this.ctx ? this.ctx.state : 'none' };
  }

  private applyVolumes(tc: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      this.out.gain.setTargetAtTime(this.vol.master, t, tc);
      this.sfx.gain.setTargetAtTime(this.vol.sfx, t, tc);
      this.uiBus.gain.setTargetAtTime(0.9 * this.vol.sfx, t, tc);
      this.musicBus.gain.setTargetAtTime(0.3 * this.vol.music * (this.paused ? 0.35 : 1), t, tc);
      this.ambBus.gain.setTargetAtTime(this.paused ? 0 : 0.9 * this.vol.sfx, t, tc);
      if (this.paused) this.slowLP.frequency.setTargetAtTime(900, t, tc);
      else this.slowLP.frequency.setTargetAtTime(20000 * Math.pow(0.06, this.slow), t, tc);
    } catch { /* ignore */ }
  }

  private build(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const sr = ctx.sampleRate;

    // Noise buffers, generated once.
    const mk = (secs: number, fill: (d: Float32Array) => void) => {
      const b = ctx.createBuffer(1, Math.floor(sr * secs), sr);
      fill(b.getChannelData(0));
      return b;
    };
    this.bufs = {
      white: mk(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }),
      pink: mk(2, (d) => {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < d.length; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.16;
          b6 = w * 0.115926;
        }
      }),
      brown: mk(2, (d) => {
        let b = 0;
        for (let i = 0; i < d.length; i++) {
          b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          d[i] = b * 3.2;
        }
      }),
      crackle: mk(1, (d) => {
        let env = 0, sgn = 1;
        for (let i = 0; i < d.length; i++) {
          if (Math.random() < 0.004) { env = 0.4 + Math.random() * 0.6; sgn = Math.random() < 0.5 ? -1 : 1; }
          d[i] = sgn * env * (0.5 + 0.5 * Math.random());
          env *= 0.86;
        }
      }),
    };

    // Output chain.
    this.out = ctx.createGain();
    this.out.gain.value = this.vol.master;
    this.out.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -9;
    comp.knee.value = 6;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(this.out);
    this.slowLP = ctx.createBiquadFilter();
    kr(this.slowLP.frequency);
    kr(this.slowLP.Q);
    this.slowLP.type = 'lowpass';
    this.slowLP.frequency.value = 20000;
    this.slowLP.Q.value = 0.7;
    this.slowLP.connect(comp);
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.slowLP);
    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = 0.9 * this.vol.sfx;
    this.uiBus.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.vol.sfx;
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.3 * this.vol.music;
    this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.9 * this.vol.sfx;
    this.ambBus.connect(this.master);

    // Drive bus: soft tanh saturation for heavy hits (explosions, roar, big impacts).
    this.driveIn = ctx.createGain();
    this.driveIn.gain.value = 1.6;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2);
    }
    shaper.curve = curve;
    const driveOut = ctx.createGain();
    driveOut.gain.value = 0.62;
    this.driveIn.connect(shaper).connect(driveOut).connect(this.sfx);

    // Cheap reverb: diffused 3-delay feedback ring, darkened each pass.
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.16;
    this.sfx.connect(this.verbSend);
    const vin = ctx.createGain();
    vin.channelCount = 1;
    vin.channelCountMode = 'explicit';
    this.verbSend.connect(vin);
    const pre = ctx.createBiquadFilter();
    kr(pre.frequency);
    kr(pre.Q);
    pre.type = 'lowpass';
    pre.frequency.value = 3600;
    const ap1 = ctx.createBiquadFilter();
    kr(ap1.frequency);
    kr(ap1.Q);
    ap1.type = 'allpass';
    ap1.frequency.value = 640;
    const ap2 = ctx.createBiquadFilter();
    kr(ap2.frequency);
    kr(ap2.Q);
    ap2.type = 'allpass';
    ap2.frequency.value = 1750;
    vin.connect(pre).connect(ap1).connect(ap2);
    const times = [0.0731, 0.1093, 0.1471];
    const ds = times.map((dt) => {
      const d = ctx.createDelay(0.5);
      d.delayTime.value = dt;
      ap2.connect(d);
      return d;
    });
    const merge = ctx.createChannelMerger(2);
    for (let i = 0; i < 3; i++) {
      const fb = ctx.createGain();
      fb.gain.value = 0.58;
      const damp = ctx.createBiquadFilter();
      kr(damp.frequency);
      kr(damp.Q);
      damp.type = 'lowpass';
      damp.frequency.value = 2600;
      ds[i].connect(damp).connect(fb).connect(ds[(i + 1) % 3]);
      if (i !== 1) ds[i].connect(merge, 0, 0);
      if (i !== 0) ds[i].connect(merge, 0, 1);
    }
    const vout = ctx.createGain();
    vout.gain.value = 0.55;
    merge.connect(vout).connect(this.master);

    // Global slow-mo pitch (cents) for long-lived oscillators.
    try {
      this.pitch = ctx.createConstantSource();
      this.pitch.offset.value = 0;
      this.pitch.start();
    } catch {
      this.pitch = null;
    }

    // Shared LFO for rift hums.
    const hl = ctx.createOscillator();
    kr(hl.frequency);
    kr(hl.detune);
    hl.frequency.value = 0.45;
    this.humLfo = ctx.createGain();
    this.humLfo.gain.value = 70;
    hl.connect(this.humLfo);
    hl.start();

    this.buildAmbience(ctx);
    this.buildMusic(ctx);
  }

  private loopNoise(ctx: BaseAudioContext, b: Buf): AudioBufferSourceNode {
    const s = ctx.createBufferSource();
    s.buffer = this.bufs[b];
    s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  private buildAmbience(ctx: BaseAudioContext) {
    const white = this.loopNoise(ctx, 'white');
    const pink = this.loopNoise(ctx, 'pink');
    const brown = this.loopNoise(ctx, 'brown');
    this.loopSrc = { white, pink, brown };
    const G = (v: number) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const F = (type: BiquadFilterType, f: number, q = 0.7) => {
      const n = ctx.createBiquadFilter();
      kr(n.frequency);
      kr(n.Q);
      n.type = type; n.frequency.value = f; n.Q.value = q;
      return n;
    };
    const lfo = (f: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      kr(o.frequency);
      kr(o.detune);
      o.frequency.value = f;
      const g = G(depth);
      o.connect(g).connect(target);
      o.start();
      return g;
    };

    // Speed wind: hiss + low rumble, both through a gust modulator.
    const gust = G(1);
    gust.connect(this.ambBus);
    const windBP = F('bandpass', 400, 0.6);
    const windLP = F('lowpass', 1200);
    const windG = G(0);
    white.connect(windBP).connect(windLP).connect(windG).connect(gust);
    const rumbleLP = F('lowpass', 160);
    const rumbleG = G(0);
    brown.connect(rumbleLP).connect(rumbleG).connect(gust);
    const gustDepth = lfo(0.63, 0, gust.gain);
    const o2 = ctx.createOscillator();
    kr(o2.frequency);
    kr(o2.detune);
    o2.frequency.value = 1.71;
    o2.connect(gustDepth);
    o2.start();

    // Harbour sea wash (fades as you climb).
    const seaSwell = G(1);
    lfo(0.11, 0.4, seaSwell.gain);
    const seaG = G(0.075);
    brown.connect(F('lowpass', 520)).connect(seaSwell);
    const foam = G(0.18);
    white.connect(F('bandpass', 1500, 0.5)).connect(foam).connect(seaSwell);
    seaSwell.connect(seaG).connect(this.ambBus);

    // High-altitude wind bed + a resonant howl near the roof.
    const altBP = F('bandpass', 380, 0.9);
    const altGust = G(1);
    const altG = G(0.015);
    pink.connect(altBP).connect(altGust).connect(altG).connect(this.ambBus);
    lfo(0.07, 120, altBP.frequency);
    const howlBP = F('bandpass', 820, 14);
    lfo(0.13, 90, howlBP.frequency);
    const howlG = G(0);
    pink.connect(howlBP).connect(howlG).connect(altGust);

    this.amb = { windG, windBP, windLP, rumbleG, gustDepth, seaG, altG, altBP, altGust, howlG };
  }

  // ---------------------------------------------------------------------------
  // Voice engine
  // ---------------------------------------------------------------------------

  private bus(b: Bus | undefined): AudioNode {
    switch (b) {
      case 'drive': return this.driveIn;
      case 'ui': return this.uiBus;
      case 'music': return this.mus ? this.mus.stingG : this.musicBus;
      case 'amb': return this.ambBus;
      default: return this.sfx;
    }
  }

  /** Throttle: false if a sound of `kind` played in the same cell less than `gap` s ago. */
  private gate(kind: string, pos: V3 | null, gap: number, cell: number, t: number): boolean {
    let key = kind;
    if (pos) key += ':' + Math.round(pos.x / cell) + ',' + Math.round(pos.y / cell) + ',' + Math.round(pos.z / cell);
    const prev = this.last.get(key);
    if (prev !== undefined && t - prev < gap && t >= prev) return false;
    this.last.set(key, t);
    if (this.last.size > 400) {
      for (const [k, v] of this.last) if (t - v > 2 || v > t) this.last.delete(k);
    }
    return true;
  }

  /** Voice limiter: may replace a quieter / nearly finished voice. */
  private admit(kind: string, prio: number, cap: number, t: number): boolean {
    const vs = this.voices;
    let active = 0, same = 0;
    let oldestSame: Voice | null = null, victim: Voice | null = null, vScore = Infinity;
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i];
      if (v.end < t - 3) { this.free(v); continue; } // onended never came
      if (v.stolen || v.end <= t) continue;
      active++;
      if (v.kind === kind) {
        same++;
        if (!oldestSame || v.t0 < oldestSame.t0) oldestSame = v;
      }
      const s = v.prio * Math.min(1, (v.end - t) / 0.25);
      if (s < vScore || (s === vScore && victim && v.t0 < victim.t0)) { vScore = s; victim = v; }
    }
    if (same >= cap && oldestSame) {
      this.kill(oldestSame, t);
      return true;
    }
    if (active < this.maxVoices) return true;
    if (!victim || vScore >= prio) { this.dropped++; return false; }
    this.kill(victim, t);
    return true;
  }

  /** Fade a voice out fast and stop its sources (freed on their onended). */
  private kill(v: Voice, t: number) {
    if (v.stolen) return;
    v.stolen = true;
    try { v.out.gain.cancelScheduledValues(t); v.out.gain.setTargetAtTime(0, t, 0.006); } catch { /* ignore */ }
    for (const s of v.srcs) { try { s.stop(t + 0.04); } catch { /* not started / already stopped */ } }
    v.end = t + 0.04;
  }

  private free(v: Voice) {
    if (v.dead) return;
    v.dead = true;
    for (const n of v.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    v.nodes.length = 0;
    v.srcs.length = 0;
    const i = this.voices.indexOf(v);
    if (i >= 0) {
      this.voices[i] = this.voices[this.voices.length - 1];
      this.voices.pop();
    }
  }

  /**
   * Play a one-shot. `vol` is the voice level (the build works in ~0..1
   * units inside it). The build gets the voice and its start time.
   */
  private one(kind: string, pos: V3 | null, vol: number, o: VoiceOpts, build: (v: Voice, t: number) => void): void {
    const ctx = this.ctx;
    if (!ctx || vol <= 0) return;
    let v: Voice | null = null;
    try {
      const now = ctx.currentTime;
      if (o.gap && !this.gate(kind, pos, o.gap, o.cell ?? 3, now)) return;
      const ref = o.ref ?? 5, roll = o.roll ?? 1;
      let att = 1, pan = 0;
      if (pos) {
        const L = this.lis, R = this.lisR;
        const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!Number.isFinite(d)) return; // bad position from the caller
        if (d > ref) att = ref / (ref + roll * (Math.min(d, 400) - ref));
        if (d > 0.05) pan = ((dx * R.x + dy * R.y + dz * R.z) / d) * Math.min(1, d / 1.5) * 0.9;
      }
      if (vol * att < 0.004) return; // inaudible: don't spend CPU
      const prio = vol * att * (o.crit ? 8 : 1);
      if (!this.admit(kind, prio, o.cap ?? 99, now)) return;
      const g = ctx.createGain();
      g.gain.value = vol;
      v = new Voice(kind, g, prio, now);
      v.nodes.push(g);
      const dest = this.bus(o.bus);
      if (pos && this.spatial === 'stereo' && typeof ctx.createStereoPanner === 'function') {
        const sp = ctx.createStereoPanner();
        sp.pan.value = pan;
        g.gain.value = vol * att;
        g.connect(sp);
        sp.connect(dest);
        v.nodes.push(sp);
      } else if (pos) {
        const p = ctx.createPanner();
        p.panningModel = 'equalpower';
        p.distanceModel = 'inverse';
        p.refDistance = ref;
        p.rolloffFactor = roll;
        p.maxDistance = 400;
        place(p, pos);
        g.connect(p);
        p.connect(dest);
        v.nodes.push(p);
      } else g.connect(dest);
      this.voices.push(v);
      build(v, now + 0.005);
      if (v.live === 0) this.free(v);
    } catch {
      if (v) {
        this.kill(v, ctx.currentTime);
        this.free(v);
      }
    }
  }

  private src(v: Voice, s: AudioScheduledSourceNode, t0: number, t1: number, offset?: number) {
    if (offset !== undefined) (s as AudioBufferSourceNode).start(t0, offset);
    else s.start(t0);
    s.stop(t1);
    v.srcs.push(s);
    v.nodes.push(s);
    v.live++;
    if (t1 > v.end) v.end = t1;
    s.onended = () => {
      if (--v.live <= 0) this.free(v);
    };
  }

  private gainN(v: Voice, dest: Dest, val = 1): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = val;
    link(g, dest);
    v.nodes.push(g);
    return g;
  }

  private filt(v: Voice, dest: AudioNode, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const n = this.ctx!.createBiquadFilter();
    kr(n.frequency);
    kr(n.Q);
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.connect(dest);
    v.nodes.push(n);
    return n;
  }

  private osc(v: Voice, dest: Dest, type: OscillatorType, f: number, t0: number, t1: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    kr(o.frequency);
    kr(o.detune);
    o.type = type;
    // Anchor at t0 so later ramps on this frequency start from the note, not from context time 0.
    o.frequency.setValueAtTime(f, t0);
    o.detune.value = this.det;
    link(o, dest);
    this.src(v, o, t0, t1);
    return o;
  }

  private noise(v: Voice, dest: AudioNode, b: Buf, t0: number, t1: number, rate = 1): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    const buf = this.bufs[b];
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate * this.rate;
    s.connect(dest);
    this.src(v, s, t0, t1, Math.random() * (buf.duration - 0.05));
    return s;
  }

  /** Oscillator with a pitch glide and a percussive envelope. */
  private tone(v: Voice, dest: AudioNode, type: OscillatorType, t: number, f0: number, f1: number, gl: number,
    peak: number, a: number, dur: number): OscillatorNode {
    const g = this.gainN(v, dest, 0);
    perc(g.gain, t, peak, a, dur);
    const o = this.osc(v, g, type, f0, t, t + dur + 0.02);
    glide(o.frequency, t, f0, f1, gl);
    return o;
  }

  /** Filtered noise with a filter sweep f0 -> f1 (over `sweep` s) and a percussive envelope. */
  private hiss(v: Voice, dest: AudioNode, b: Buf, type: BiquadFilterType, t: number, f0: number, f1: number, q: number,
    peak: number, a: number, dur: number, sweep = dur): BiquadFilterNode {
    const g = this.gainN(v, dest, 0);
    perc(g.gain, t, peak, a, dur);
    const f = this.filt(v, g, type, f0, q);
    glide(f.frequency, t, f0, f1, sweep);
    this.noise(v, f, b, t, t + dur + 0.02);
    return f;
  }

  /** Inharmonic partials (metal, glass, bells). */
  private ring(v: Voice, dest: AudioNode, t: number, freqs: readonly number[], amps: readonly number[], decay: number, bend = 1) {
    for (let i = 0; i < freqs.length; i++) {
      const d = decay * (1 - i * 0.12);
      this.tone(v, dest, 'sine', t, freqs[i], freqs[i] * bend, d, amps[i], 0.001, Math.max(0.04, d));
    }
  }

  /** Deep swell used by rift opens / big moments. */
  private thoom(v: Voice, t: number, f: number, peak: number, dur: number) {
    const g = this.gainN(v, v.out, 0);
    swell(g.gain, t, peak, 0.09, dur);
    const o = this.osc(v, g, 'sine', f * 0.8, t, t + dur + 0.05);
    o.frequency.setValueAtTime(f * 0.8, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
  }

  // ---------------------------------------------------------------------------
  // Listener, intensity, altitude, slow-mo (per-frame safe)
  // ---------------------------------------------------------------------------

  /** Per frame. Moves the WebAudio listener to the camera. */
  updateListener(cam: THREE.Camera): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      cam.getWorldPosition(_p);
      cam.getWorldQuaternion(_q);
      _f.set(0, 0, -1).applyQuaternion(_q);
      _u.set(0, 1, 0).applyQuaternion(_q);
      this.lis.copy(_p);
      this.lisR.crossVectors(_f, _u).normalize();
      const l = ctx.listener, t = ctx.currentTime;
      if (l.positionX) {
        l.positionX.setTargetAtTime(_p.x, t, 0.02);
        l.positionY.setTargetAtTime(_p.y, t, 0.02);
        l.positionZ.setTargetAtTime(_p.z, t, 0.02);
        l.forwardX.setTargetAtTime(_f.x, t, 0.02);
        l.forwardY.setTargetAtTime(_f.y, t, 0.02);
        l.forwardZ.setTargetAtTime(_f.z, t, 0.02);
        l.upX.setTargetAtTime(_u.x, t, 0.02);
        l.upY.setTargetAtTime(_u.y, t, 0.02);
        l.upZ.setTargetAtTime(_u.z, t, 0.02);
      } else {
        l.setPosition(_p.x, _p.y, _p.z);
        l.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
      }
    } catch { /* ignore */ }
  }

  /**
   * Per frame. tension 0..1 (enemies suspicious / searching), combat 0..1
   * (fight intensity), dt = real seconds. Drives the adaptive music and the
   * ambient events. Combat rises fast and falls slowly.
   */
  setIntensity(tension: number, combat: number, dt: number): void {
    const ctx = this.ctx;
    const m = this.mus;
    if (!ctx || !m) return;
    try {
      const d = Math.min(Math.max(dt || 0, 0), 0.25);
      const ten = clamp01(tension), cmb = clamp01(combat);
      this.mTen += (ten - this.mTen) * Math.min(1, d * 0.8);
      this.mCmb += (cmb - this.mCmb) * Math.min(1, d * (cmb > this.mCmb ? 1.8 : 0.2));
      const lv = this.lv;
      lv.drv = smooth(0.04, 0.4, this.mCmb);
      lv.hi = smooth(0.6, 0.92, this.mCmb);
      lv.ten = clamp01(this.mTen * 1.2) * (1 - lv.drv);
      lv.pad = 1 - 0.55 * lv.drv;
      const t = ctx.currentTime;
      if (t - this.musT > 0.1 || this.musT > t) {
        this.musT = t;
        m.padG.gain.setTargetAtTime(0.5 * lv.pad, t, 0.6);
        m.tenG.gain.setTargetAtTime(0.9 * lv.ten, t, 0.6);
        m.driveG.gain.setTargetAtTime(0.8 * lv.drv, t, 0.5);
        m.highG.gain.setTargetAtTime(lv.hi, t, 0.5);
        m.padF.frequency.setTargetAtTime(650 + 900 * this.mTen + 1800 * this.mCmb, t, 0.8);
      }
      this.schedule(t);
      this.ambientEvents(d, t);
    } catch { /* ignore */ }
  }

  /** Per frame. Player height (m): calm sea at the pier, wind and howl on the roof (90 m). */
  setAltitude(y: number): void {
    const ctx = this.ctx, a = this.amb;
    if (!ctx || !a) return;
    this.alt = y;
    const t = ctx.currentTime;
    if (this.altT <= t && (t - this.altT < 0.1 || (Math.abs(y - this.altSet) < 0.75 && t - this.altT < 0.5))) return;
    this.altSet = y;
    this.altT = t;
    try {
      const h = smooth(6, 92, y);
      a.seaG.gain.setTargetAtTime(0.075 * (1 - smooth(8, 45, y)), t, 0.8);
      a.altG.gain.setTargetAtTime(0.015 + 0.16 * h, t, 0.8);
      a.altBP.frequency.setTargetAtTime(380 + 520 * h, t, 0.8);
      a.howlG.gain.setTargetAtTime(0.12 * smooth(45, 95, y), t, 0.8);
    } catch { /* ignore */ }
  }

  /** Per frame. 0..1 bullet time: lowpass + slight pitch-down of the whole mix (UI excluded). */
  setSlowmo(amount: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const a = clamp01(amount || 0);
    if (Math.abs(a - this.slow) < 0.01 && !(a === 0 && this.slow !== 0)) return;
    const prev = this.slow;
    this.slow = a;
    try {
      const t = ctx.currentTime;
      if (!this.paused) this.slowLP.frequency.setTargetAtTime(20000 * Math.pow(0.06, a), t, 0.07);
      this.slowLP.Q.setTargetAtTime(0.7 + 0.6 * a, t, 0.07);
      this.det = -170 * a;
      this.rate = Math.pow(2, this.det / 1200);
      if (this.pitch) this.pitch.offset.setTargetAtTime(this.det, t, 0.07);
      this.verbSend.gain.setTargetAtTime(0.16 + 0.2 * a, t, 0.1);
      if (t - this.slowEdgeT > 0.25) {
        if (prev < 0.3 && a >= 0.3) { this.slowEdgeT = t; this.timeShift(true); }
        else if (prev >= 0.3 && a < 0.3) { this.slowEdgeT = t; this.timeShift(false); }
      }
    } catch { /* ignore */ }
  }

  /** Bullet-time in/out cue: a dropping "vwoom" in, a quick rising snap out. */
  private timeShift(into: boolean) {
    this.one('slowEdge', null, 0.22, O.slowEdge, (v, t) => {
      if (into) {
        this.tone(v, v.out, 'sine', t, 420, 95, 0.35, 0.55, 0.01, 0.45);
        this.hiss(v, v.out, 'pink', 'lowpass', t, 3000, 300, 1, 0.5, 0.03, 0.4);
      } else {
        this.tone(v, v.out, 'sine', t, 140, 520, 0.14, 0.4, 0.005, 0.18);
        this.hiss(v, v.out, 'white', 'bandpass', t, 700, 4200, 1.2, 0.35, 0.05, 0.16, 0.14);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Rifts
  // ---------------------------------------------------------------------------

  /** Deep "thoom" swell; entrance = warm orange, exit = cold crystalline blue, gate = harsh red. */
  riftOpen(pos: V3, which: 'entrance' | 'exit' | 'gate'): void {
    this.one('riftOpen:' + which, pos, 0.36, O.riftOpen, (v, t) => {
      this.thoom(v, t, which === 'gate' ? 42 : 48, 0.9, 1.0);
      this.hiss(v, v.out, 'brown', 'lowpass', t, 250, 1100, 1.2, 0.5, 0.12, 0.8, 0.25);
      if (which === 'entrance') {
        // Warm: detuned saw major chord behind a closing lowpass + faint ember crackle.
        const lp = this.filt(v, v.out, 'lowpass', 2200, 1.2);
        lp.frequency.setValueAtTime(600, t);
        lp.frequency.exponentialRampToValueAtTime(2000, t + 0.12);
        lp.frequency.exponentialRampToValueAtTime(500, t + 1.1);
        for (const m of [50, 57, 62, 66]) {
          const f = mtof(m);
          this.tone(v, lp, 'sawtooth', t, f * 0.5, f, 0.1, 0.13, 0.06, 1.1);
        }
        this.tone(v, lp, 'sawtooth', t, mtof(50) * 0.503, mtof(50) * 1.006, 0.1, 0.12, 0.06, 1.0);
        this.hiss(v, v.out, 'crackle', 'bandpass', t + 0.05, 1800, 1200, 0.8, 0.25, 0.05, 0.6);
      } else if (which === 'exit') {
        // Cold: glassy bell partials, detuned pairs for shimmer, and an airy glint.
        const base = 1318.5;
        this.ring(v, v.out, t + 0.02, [base, base * 2.01, base * 2.76, base * 4.07], [0.14, 0.08, 0.07, 0.04], 1.3);
        this.ring(v, v.out, t + 0.04, [base * 1.004], [0.09], 1.0);
        this.tone(v, v.out, 'sine', t, 660, 1320, 0.15, 0.1, 0.02, 0.6);
        this.hiss(v, v.out, 'white', 'bandpass', t, 9000, 5000, 6, 0.3, 0.03, 0.5);
      } else {
        // Harsh red: tritone saw cluster, ring-modulated at 34 Hz.
        const bp = this.filt(v, v.out, 'bandpass', 900, 1.4);
        const am = this.gainN(v, bp, 0.5);
        const mod = this.osc(v, am.gain, 'square', 34, t, t + 1.0);
        mod.frequency.linearRampToValueAtTime(22, t + 0.9);
        const env = this.gainN(v, am, 0);
        perc(env.gain, t, 0.5, 0.05, 0.95);
        for (const f of [110, 155.6, 57, 221]) this.osc(v, env, 'sawtooth', f, t, t + 1.0);
        this.hiss(v, v.out, 'crackle', 'highpass', t, 2500, 2500, 0.7, 0.3, 0.01, 0.5);
      }
    });
  }

  /** Implosion: a sucked-in sweep that cuts off, then a soft pop. */
  riftClose(pos: V3): void {
    this.one('riftClose', pos, 0.45, O.riftClose, (v, t) => {
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(EPS, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.16);
      g.gain.linearRampToValueAtTime(0, t + 0.19);
      const bp = this.filt(v, g, 'bandpass', 3200, 1.6);
      glide(bp.frequency, t, 3200, 280, 0.19);
      this.noise(v, bp, 'white', t, t + 0.2);
      this.tone(v, v.out, 'triangle', t, 700, 70, 0.2, 0.35, 0.01, 0.22);
      this.tone(v, v.out, 'sine', t + 0.19, 95, 40, 0.14, 0.7, 0.004, 0.2);
    });
  }

  /** Continuous hum of an open rift end. Handle: stop() fades it, move() follows a moving end (per-frame safe). */
  hum(pos: V3): Handle {
    const ctx = this.ctx;
    if (!ctx || this.hums >= 8) return NIL_HANDLE;
    try {
      const t = ctx.currentTime;
      const nodes: AudioNode[] = [];
      const srcs: OscillatorNode[] = [];
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 2;
      p.rolloffFactor = 1.6;
      p.maxDistance = 200;
      place(p, pos);
      p.connect(this.sfx);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(0.07, t, 0.2);
      g.connect(p);
      const f = ctx.createBiquadFilter();
      kr(f.frequency);
      kr(f.Q);
      f.type = 'lowpass';
      f.frequency.value = 320;
      f.Q.value = 3;
      f.connect(g);
      if (this.humLfo) this.humLfo.connect(f.frequency);
      const base = 55 * rnd(0.97, 1.03);
      for (const [type, fr, lvl] of [['sawtooth', base, 1], ['sine', base * 2.008, 0.8], ['sine', base * 4.02, 0.25]] as const) {
        const o = ctx.createOscillator();
        kr(o.frequency);
        kr(o.detune);
        o.type = type;
        o.frequency.value = fr;
        const og = ctx.createGain();
        og.gain.value = lvl;
        o.connect(og).connect(f);
        if (this.pitch) this.pitch.connect(o.detune);
        o.start(t);
        srcs.push(o);
        nodes.push(o, og);
      }
      nodes.push(f, g, p);
      this.hums++;
      let alive = true;
      let lx = pos.x, ly = pos.y, lz = pos.z;
      return {
        stop: () => {
          if (!alive) return;
          alive = false;
          this.hums--;
          try {
            const c = this.ctx!, tt = c.currentTime;
            g.gain.cancelScheduledValues(tt);
            g.gain.setTargetAtTime(0, tt, 0.07);
            for (const o of srcs) o.stop(tt + 0.45);
            srcs[0].onended = () => {
              try { this.humLfo?.disconnect(f.frequency); } catch { /* ignore */ }
              for (const o of srcs) { try { this.pitch?.disconnect(o.detune); } catch { /* ignore */ } }
              for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } }
            };
          } catch { /* ignore */ }
        },
        move: (v: V3) => {
          if (!alive) return;
          const dx = v.x - lx, dy = v.y - ly, dz = v.z - lz;
          if (dx * dx + dy * dy + dz * dz < 0.0025) return;
          lx = v.x; ly = v.y; lz = v.z;
          try {
            if (p.positionX) {
              const tt = this.ctx!.currentTime;
              p.positionX.setTargetAtTime(v.x, tt, 0.03);
              p.positionY.setTargetAtTime(v.y, tt, 0.03);
              p.positionZ.setTargetAtTime(v.z, tt, 0.03);
            } else p.setPosition(v.x, v.y, v.z);
          } catch { /* ignore */ }
        },
      };
    } catch {
      return NIL_HANDLE;
    }
  }

  /** Doppler-ish swoosh as something crosses; louder, brighter and shorter with speed (m/s). */
  riftPass(pos: V3, speed: number): void {
    const s = clamp01((speed || 0) / 40);
    this.one('riftPass', pos, 0.3 + 0.45 * s, O.riftPass, (v, t) => {
      const dur = 0.55 - 0.25 * s;
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(EPS, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(EPS, t + dur);
      const bp = this.filt(v, g, 'bandpass', 1500, 1.4);
      glide(bp.frequency, t, 1400 + 3600 * s, 300 + 400 * s, dur);
      this.noise(v, bp, 'white', t, t + dur + 0.02);
      const f0 = 420 + 900 * s;
      const tg = this.gainN(v, v.out, 0);
      tg.gain.setValueAtTime(EPS, t);
      tg.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.35);
      tg.gain.exponentialRampToValueAtTime(EPS, t + dur);
      const o = this.osc(v, tg, 'sine', f0, t, t + dur + 0.02);
      o.frequency.setValueAtTime(f0 * 1.15, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + dur);
      if (s > 0.45) this.tone(v, v.out, 'sine', t + dur * 0.35, 130, 48, 0.12, 0.5 * s, 0.004, 0.18);
    });
  }

  /** Something hit a CATCH door: suction sweep up, abrupt cut, wet gulp. */
  riftCatch(pos: V3): void {
    this.one('riftCatch', pos, 0.55, O.riftCatch, (v, t) => {
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(EPS, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.2);
      g.gain.linearRampToValueAtTime(0, t + 0.22);
      const bp = this.filt(v, g, 'bandpass', 400, 2);
      glide(bp.frequency, t, 400, 3200, 0.22);
      this.noise(v, bp, 'white', t, t + 0.23);
      this.tone(v, v.out, 'sine', t + 0.21, 300, 70, 0.12, 0.7, 0.003, 0.22);
      this.hiss(v, v.out, 'white', 'bandpass', t + 0.21, 620, 380, 9, 0.35, 0.003, 0.12);
      this.tone(v, v.out, 'sine', t + 0.21, 60, 38, 0.2, 0.5, 0.005, 0.3);
    });
  }

  /**
   * Per frame while something loops through the pair. A rising looping whoosh
   * whose pitch follows speed (m/s). Throttled internally; fades by itself
   * ~0.25 s after the last call.
   */
  loopWhoosh(speed: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      if (t - this.whooshT < 0.04 && this.whooshT <= t) return;
      this.whooshT = t;
      if (!this.loopW) this.loopW = this.buildWhoosh(ctx);
      const w = this.loopW;
      const sp = Math.min(Math.max(speed || 0, 0), 45);
      const s = sp / 40;
      keep(w.g.gain, 0.1 + 0.3 * s, t, 0.05, 0.25);
      w.bp.frequency.setTargetAtTime(260 + sp * 75, t, 0.06);
      w.o.frequency.setTargetAtTime(170 + sp * 24, t, 0.06);
      w.og.gain.setTargetAtTime(0.05 + 0.12 * s, t, 0.06);
      w.trem.frequency.setTargetAtTime(2.5 + sp * 0.3, t, 0.1);
    } catch { /* ignore */ }
  }

  private buildWhoosh(ctx: BaseAudioContext) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.sfx);
    // tremolo "wub" whose rate follows speed (rotation feel)
    const tremG = ctx.createGain();
    tremG.gain.value = 0.75;
    tremG.connect(g);
    const trem = ctx.createOscillator();
    kr(trem.frequency);
    kr(trem.detune);
    trem.frequency.value = 4;
    const td = ctx.createGain();
    td.gain.value = 0.25;
    trem.connect(td).connect(tremG.gain);
    trem.start();
    const bp = ctx.createBiquadFilter();
    kr(bp.frequency);
    kr(bp.Q);
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 2.2;
    this.loopSrc.white.connect(bp);
    bp.connect(tremG);
    const og = ctx.createGain();
    og.gain.value = 0.05;
    og.connect(tremG);
    const o = ctx.createOscillator();
    kr(o.frequency);
    kr(o.detune);
    o.type = 'sine';
    o.frequency.value = 300;
    if (this.pitch) this.pitch.connect(o.detune);
    o.connect(og);
    o.start();
    return { g, bp, og, o, trem };
  }

  /** GUILLOTINE: crystalline slice + sub drop. */
  shear(pos: V3): void {
    this.one('shear', pos, 0.75, O.shear, (v, t) => {
      this.hiss(v, v.out, 'white', 'highpass', t, 5200, 5200, 0.7, 0.55, 0.001, 0.09);
      this.hiss(v, v.out, 'white', 'bandpass', t, 9500, 2400, 3, 0.45, 0.002, 0.16, 0.12);
      this.ring(v, v.out, t + 0.005, [2217, 3319, 4889, 6451], [0.12, 0.1, 0.07, 0.05], 0.75, 0.97);
      this.tone(v, v.out, 'sine', t, 115, 26, 0.6, 0.9, 0.004, 0.7);
      this.hiss(v, v.out, 'crackle', 'bandpass', t + 0.02, 3000, 1500, 0.8, 0.3, 0.005, 0.25);
    });
  }

  /** Gate hijacked: glitchy digital zap, then a rising power-up. */
  hijack(pos: V3): void {
    this.one('hijack', pos, 0.45, O.hijack, (v, t) => {
      const bp = this.filt(v, v.out, 'bandpass', 1400, 0.9);
      const gate = this.gainN(v, bp, 0);
      const o = this.osc(v, gate, 'square', 400, t, t + 0.46);
      const ng = this.gainN(v, v.out, 0);
      const hp = this.filt(v, ng, 'highpass', 2200, 0.7);
      this.noise(v, hp, 'white', t, t + 0.46, 0.5);
      for (let i = 0; i < 15; i++) {
        const tt = t + i * 0.03;
        o.frequency.setValueAtTime(rnd(160, 2600), tt);
        gate.gain.setValueAtTime(Math.random() < 0.7 ? rnd(0.25, 0.5) : 0, tt);
        ng.gain.setValueAtTime(Math.random() < 0.4 ? rnd(0.1, 0.3) : 0, tt);
      }
      gate.gain.setValueAtTime(0, t + 0.45);
      ng.gain.setValueAtTime(0, t + 0.45);
      const lp = this.filt(v, v.out, 'lowpass', 5000, 2);
      this.tone(v, lp, 'sawtooth', t + 0.44, 200, 3200, 0.2, 0.35, 0.005, 0.3);
      this.tone(v, v.out, 'sine', t + 0.44, 70, 140, 0.2, 0.6, 0.01, 0.35);
    });
  }

  // ---------------------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------------------

  /** Snappy energy shot (not gunpowder). Same-area shots throttled to 1 per 40 ms. */
  boltFire(pos: V3): void {
    this.one('boltFire', pos, 0.55, O.boltFire, (v, t) => {
      const k = rnd(0.94, 1.06);
      const lp = this.filt(v, v.out, 'lowpass', 5200, 1);
      this.tone(v, lp, 'square', t, 2000 * k, 240 * k, 0.085, 0.35, 0.001, 0.13);
      this.tone(v, v.out, 'sine', t, 1200 * k, 420 * k, 0.12, 0.2, 0.001, 0.16);
      this.tone(v, v.out, 'sine', t, 190, 62, 0.07, 0.8, 0.002, 0.11);
      this.hiss(v, v.out, 'white', 'highpass', t, 2600, 2600, 0.7, 0.35, 0.001, 0.03);
    });
  }

  /** A bolt passing close to the listener. */
  boltWhizz(pos: V3): void {
    this.one('boltWhizz', pos, 0.9, O.boltWhizz, (v, t) => {
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(EPS, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.07);
      g.gain.exponentialRampToValueAtTime(EPS, t + 0.22);
      const bp = this.filt(v, g, 'bandpass', 2600, 2.2);
      glide(bp.frequency, t, 3000, 1100, 0.22);
      this.noise(v, bp, 'white', t, t + 0.23);
      const tg = this.gainN(v, v.out, 0);
      tg.gain.setValueAtTime(EPS, t);
      tg.gain.exponentialRampToValueAtTime(0.14, t + 0.07);
      tg.gain.exponentialRampToValueAtTime(EPS, t + 0.2);
      const o = this.osc(v, tg, 'sine', 2300, t, t + 0.22);
      glide(o.frequency, t, 2300, 1250, 0.2);
    });
  }

  /** Spark crack; charged adds a cyan shimmer. */
  boltImpact(pos: V3, charged: boolean): void {
    this.one('boltImpact', pos, charged ? 0.95 : 0.9, O.boltImpact, (v, t) => {
      this.hiss(v, v.out, 'white', 'highpass', t, 3200, 3200, 0.7, 0.55, 0.001, 0.04);
      this.hiss(v, v.out, 'crackle', 'bandpass', t, 4200, 2600, 0.8, 0.45, 0.002, 0.14);
      this.tone(v, v.out, 'triangle', t, 1500, 650, 0.04, 0.18, 0.001, 0.05);
      if (charged) {
        this.tone(v, v.out, 'sine', t + 0.01, 2100, 4400, 0.25, 0.12, 0.01, 0.4);
        this.ring(v, v.out, t + 0.015, [2637, 3520, 5274, 7040], [0.08, 0.07, 0.05, 0.03], 0.45, 1.02);
      }
    });
  }

  /** Laser lock warning: three rising beeps then a rising tone (~0.6 s). Very readable, never dropped. */
  laserLock(pos: V3): void {
    this.one('laserLock', pos, 0.5, O.laserLock, (v, t) => {
      const bp = this.filt(v, v.out, 'bandpass', 1600, 0.8);
      const f = [1050, 1250, 1500];
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.11;
        const g = this.gainN(v, bp, 0);
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.4, tt + 0.004);
        g.gain.setValueAtTime(0.4, tt + 0.06);
        g.gain.linearRampToValueAtTime(0, tt + 0.07);
        this.osc(v, g, 'square', f[i], tt, tt + 0.075);
        this.osc(v, g, 'sine', f[i] * 2, tt, tt + 0.075);
      }
      const tt = t + 0.33;
      const g = this.gainN(v, bp, 0);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.4, tt + 0.01);
      g.gain.setValueAtTime(0.4, tt + 0.25);
      g.gain.linearRampToValueAtTime(0, tt + 0.28);
      const o = this.osc(v, g, 'square', 1500, tt, tt + 0.29);
      glide(o.frequency, tt, 1500, 2200, 0.27);
    });
  }

  /** Sniper / laser beam telegraph: a building whine over 1.2 s. */
  beamCharge(pos: V3): void {
    this.one('beamCharge', pos, 1.3, O.beamCharge, (v, t) => {
      const dur = 1.2;
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t + dur);
      const tremG = this.gainN(v, g, 0.65);
      const lfo = this.osc(v, this.gainN(v, tremG.gain, 0.35), 'square', 6, t, t + dur);
      lfo.frequency.exponentialRampToValueAtTime(30, t + dur);
      const bp = this.filt(v, tremG, 'bandpass', 400, 4);
      glide(bp.frequency, t, 400, 3400, dur);
      const o1 = this.osc(v, bp, 'sawtooth', 180, t, t + dur);
      glide(o1.frequency, t, 180, 1700, dur);
      const sg = this.gainN(v, tremG, 0.25);
      const o2 = this.osc(v, sg, 'sine', 360, t, t + dur);
      glide(o2.frequency, t, 360, 3400, dur);
    });
  }

  /** The beam itself: big sizzling zap (~0.35 s) with a sub hit. */
  beamFire(pos: V3): void {
    this.one('beamFire', pos, 0.65, O.beamFire, (v, t) => {
      const sustain = (g: GainNode, peak: number) => {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.01);
        g.gain.setValueAtTime(peak, t + 0.33);
        g.gain.exponentialRampToValueAtTime(EPS, t + 0.6);
      };
      const ng = this.gainN(v, v.out, 0);
      sustain(ng, 0.5);
      this.noise(v, this.filt(v, ng, 'bandpass', 3200, 0.6), 'white', t, t + 0.62);
      const cg = this.gainN(v, v.out, 0);
      sustain(cg, 0.55);
      this.noise(v, this.filt(v, cg, 'highpass', 1500, 0.7), 'crackle', t, t + 0.62, 1.3);
      const hg = this.gainN(v, v.out, 0);
      sustain(hg, 0.3);
      const lp = this.filt(v, hg, 'lowpass', 1800, 2);
      this.osc(v, lp, 'sawtooth', 95, t, t + 0.62);
      this.osc(v, lp, 'sawtooth', 97.5, t, t + 0.62);
      this.tone(v, v.out, 'sine', t, 230, 42, 0.25, 0.9, 0.003, 0.4);
      this.tone(v, v.out, 'square', t, 3200, 280, 0.12, 0.18, 0.001, 0.14);
    });
  }

  /** Metallic clink. */
  grenadeBounce(pos: V3): void {
    this.one('grenadeBounce', pos, 0.5, O.grenadeBounce, (v, t) => {
      const k = rnd(0.94, 1.07);
      this.ring(v, v.out, t, [2350 * k, 3790 * k, 5210 * k], [0.3, 0.2, 0.12], 0.2);
      this.hiss(v, v.out, 'white', 'lowpass', t, 900, 900, 0.7, 0.35, 0.001, 0.04);
    });
  }

  /** Layered boom: crack, body, sub and a long tail. size ~0.5 (small) .. 2 (huge); barrels ~1. */
  explosion(pos: V3, size: number): void {
    const k = Math.min(Math.max(size || 1, 0.3), 2.5);
    this.one('explosion', pos, 0.6 + 0.2 * Math.min(k, 1.5), O.explosion, (v, t) => {
      const sq = Math.sqrt(k);
      this.hiss(v, v.out, 'white', 'lowpass', t, 7000, 1400, 0.7, 0.8, 0.001, 0.14, 0.08);
      this.hiss(v, v.out, 'brown', 'lowpass', t, 2200, 160, 0.9, 1.0, 0.004, 1.1 * sq, 0.8 * sq);
      this.tone(v, v.out, 'sine', t, 78 / sq, 26, 0.7, 1.0, 0.003, 0.9 * sq);
      this.hiss(v, v.out, 'pink', 'lowpass', t + 0.02, 1000, 180, 0.8, 0.35, 0.06, 2.2 * sq, 2 * sq);
      if (k > 0.8) this.hiss(v, v.out, 'crackle', 'bandpass', t + 0.12, 2600, 1400, 0.8, 0.25, 0.02, 0.7 * sq);
    });
  }

  /** Water hit; size ~0.5 (bolt / small prop) .. 2 (brute / container). */
  splash(pos: V3, size: number): void {
    const k = Math.min(Math.max(size || 1, 0.2), 2.5);
    this.one('splash', pos, 0.35 + 0.25 * Math.min(k, 1.5), O.splash, (v, t) => {
      this.hiss(v, v.out, 'white', 'lowpass', t, 3000, 700, 0.8, 0.8, 0.004, 0.2 + 0.08 * k);
      this.hiss(v, v.out, 'pink', 'bandpass', t + 0.02, 1100, 600, 0.5, 0.4, 0.04, 0.8 * Math.sqrt(k));
      this.tone(v, v.out, 'sine', t, 95, 45, 0.2, 0.4 * Math.min(k, 1.5), 0.004, 0.25);
      const n = 3 + Math.round(2 * Math.min(k, 1.5));
      for (let i = 0; i < n; i++) {
        const tt = t + 0.04 + Math.random() * 0.35 * Math.sqrt(k);
        const f = rnd(320, 900);
        this.tone(v, v.out, 'sine', tt, f, f * 1.9, 0.05, 0.08, 0.004, 0.07);
      }
    });
  }

  /** Body thud scaled by impact speed (m/s); a big crunch at >= 12 m/s. */
  impact(pos: V3, speed: number): void {
    const sp = speed || 0;
    if (sp < 1.5) return;
    const s = clamp01(sp / 20);
    const big = sp >= 12;
    this.one(big ? 'impactBig' : 'impact', pos, 0.2 + 0.6 * s, big ? O.impactBig : O.impact, (v, t) => {
      this.hiss(v, v.out, 'brown', 'lowpass', t, 500 + 900 * s, 250, 0.8, 1.0, 0.002, 0.14 + 0.18 * s);
      this.tone(v, v.out, 'sine', t, 125, 44, 0.16, 0.8, 0.002, 0.2 + 0.1 * s);
      if (big) {
        this.hiss(v, v.out, 'crackle', 'bandpass', t, 1500, 900, 0.7, 0.7, 0.002, 0.24);
        this.hiss(v, v.out, 'white', 'highpass', t, 1900, 1900, 0.7, 0.5, 0.001, 0.035);
        this.tone(v, v.out, 'sine', t, 62, 28, 0.4, 0.8, 0.003, 0.45);
      }
    });
  }

  /** Warden shield hit: metallic clang. */
  shieldClang(pos: V3): void {
    this.one('shieldClang', pos, 0.55, O.shieldClang, (v, t) => {
      const k = rnd(0.97, 1.03);
      this.ring(v, v.out, t, [410 * k, 1020 * k, 1683 * k, 2530 * k, 3690 * k], [0.25, 0.2, 0.15, 0.1, 0.07], 0.9);
      this.ring(v, v.out, t, [413 * k, 1027 * k], [0.12, 0.1], 0.7);
      this.hiss(v, v.out, 'white', 'bandpass', t, 3000, 2000, 1, 0.5, 0.001, 0.06);
      this.tone(v, v.out, 'triangle', t, 190, 140, 0.2, 0.3, 0.002, 0.22);
    });
  }

  /** Brute charge telegraph (~1.1 s): formant growl over a low wobbling saw. */
  roar(pos: V3): void {
    this.one('roar', pos, 0.36, O.roar, (v, t) => {
      const dur = 1.15;
      const env = this.gainN(v, v.out, 0);
      env.gain.setValueAtTime(EPS, t);
      env.gain.exponentialRampToValueAtTime(0.9, t + 0.15);
      env.gain.setValueAtTime(0.9, t + 0.8);
      env.gain.exponentialRampToValueAtTime(EPS, t + dur);
      // growl texture: amplitude roughness at ~32 Hz
      const rough = this.gainN(v, env, 0.7);
      this.osc(v, this.gainN(v, rough.gain, 0.3), 'square', 31, t, t + dur);
      const lp = this.filt(v, rough, 'lowpass', 900, 1.5);
      const saw = this.osc(v, lp, 'sawtooth', 62, t, t + dur);
      saw.frequency.setValueAtTime(58, t);
      saw.frequency.linearRampToValueAtTime(86, t + 0.35);
      saw.frequency.linearRampToValueAtTime(54, t + dur);
      this.osc(v, this.gainN(v, saw.frequency, 5), 'sine', 7, t, t + dur);
      const saw2 = this.osc(v, lp, 'sawtooth', 91, t, t + dur);
      saw2.frequency.linearRampToValueAtTime(128, t + 0.35);
      saw2.frequency.linearRampToValueAtTime(80, t + dur);
      // one noise source through three moving formants ("aah-rr")
      let src: AudioBufferSourceNode | null = null;
      for (const [f0, f1, q, lvl] of [[480, 720, 5, 1.1], [1100, 1250, 6, 0.8], [2500, 2600, 7, 0.35]] as const) {
        const bp = this.filt(v, this.gainN(v, rough, lvl), 'bandpass', f0, q);
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f1, t + 0.4);
        bp.frequency.linearRampToValueAtTime(f0 * 0.9, t + dur);
        if (!src) src = this.noise(v, bp, 'pink', t, t + dur);
        else src.connect(bp);
      }
    });
  }

  /** FINISH: blade whoosh, a metallic shing and the hit (lands ~0.12 s in, under the hitstop). */
  bladeFinish(pos: V3): void {
    this.one('bladeFinish', pos, 0.85, O.bladeFinish, (v, t) => {
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(EPS, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.1);
      g.gain.exponentialRampToValueAtTime(EPS, t + 0.22);
      const bp = this.filt(v, g, 'bandpass', 900, 2);
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(5200, t + 0.1);
      bp.frequency.exponentialRampToValueAtTime(1500, t + 0.22);
      this.noise(v, bp, 'white', t, t + 0.23);
      this.ring(v, v.out, t + 0.05, [3150, 4730, 6310], [0.09, 0.07, 0.05], 0.4, 1.01);
      const h = t + 0.12;
      this.tone(v, v.out, 'sine', h, 150, 48, 0.2, 0.9, 0.002, 0.24);
      this.hiss(v, v.out, 'crackle', 'bandpass', h, 1500, 1000, 0.8, 0.6, 0.002, 0.14);
      this.hiss(v, v.out, 'white', 'highpass', h, 2500, 2500, 0.7, 0.5, 0.001, 0.05);
    });
  }

  /** SHOVE: air whoomp. */
  shove(pos: V3): void {
    this.one('shove', pos, 0.55, O.shove, (v, t) => {
      const g = this.gainN(v, v.out, 0);
      g.gain.setValueAtTime(EPS, t);
      g.gain.exponentialRampToValueAtTime(0.8, t + 0.05);
      g.gain.exponentialRampToValueAtTime(EPS, t + 0.3);
      const lp = this.filt(v, g, 'lowpass', 250, 1.2);
      lp.frequency.setValueAtTime(250, t);
      lp.frequency.exponentialRampToValueAtTime(950, t + 0.05);
      lp.frequency.exponentialRampToValueAtTime(280, t + 0.3);
      this.noise(v, lp, 'brown', t, t + 0.31);
      this.tone(v, v.out, 'sine', t, 105, 52, 0.2, 0.7, 0.01, 0.24);
      this.hiss(v, v.out, 'white', 'bandpass', t, 1300, 600, 1, 0.15, 0.02, 0.2);
    });
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  /** Footstep; loud 0..1 (walk .. sprint / heavy), metal = steel deck vs concrete. */
  footstep(pos: V3, loud: number, metal = false): void {
    const l = clamp01(loud || 0);
    this.one('footstep', pos, 0.3 + 0.35 * l, O.footstep, (v, t) => {
      if (metal) {
        this.hiss(v, v.out, 'white', 'bandpass', t, 2300 * rnd(0.9, 1.1), 1800, 4, 0.5, 0.001, 0.09);
        const k = rnd(0.95, 1.05);
        this.ring(v, v.out, t, [690 * k, 1730 * k, 2710 * k], [0.18, 0.12, 0.06], 0.16);
        this.hiss(v, v.out, 'brown', 'lowpass', t, 260, 260, 0.7, 0.6, 0.002, 0.07);
      } else {
        this.hiss(v, v.out, 'white', 'lowpass', t, 1500 + Math.random() * 700, 900, 0.8, 0.7, 0.002, 0.055);
        this.hiss(v, v.out, 'brown', 'lowpass', t, 220, 220, 0.7, 1.1, 0.003, 0.075);
        this.hiss(v, v.out, 'crackle', 'highpass', t + 0.01, 2800, 2800, 0.7, 0.25, 0.002, 0.05);
      }
    });
  }

  /** Jump push-off: cloth whoosh + a small gauntlet blip. */
  jump(pos: V3): void {
    this.one('jump', pos, 0.6, O.jump, (v, t) => {
      this.hiss(v, v.out, 'white', 'bandpass', t, 1300, 2800, 1.2, 0.4, 0.02, 0.17);
      this.hiss(v, v.out, 'brown', 'lowpass', t, 320, 320, 0.7, 0.6, 0.003, 0.07);
      this.tone(v, v.out, 'sine', t, 320, 560, 0.08, 0.08, 0.005, 0.1);
    });
  }

  /** Landing thud scaled by speed (m/s); crunch above 14. */
  land(pos: V3, speed: number): void {
    const sp = speed || 0;
    if (sp < 1) return;
    const s = clamp01(sp / 18);
    this.one('land', pos, 0.25 + 0.5 * s, O.land, (v, t) => {
      this.hiss(v, v.out, 'brown', 'lowpass', t, 400 + 900 * s, 220, 0.8, 1.0, 0.002, 0.1 + 0.2 * s);
      this.tone(v, v.out, 'sine', t, 110, 45, 0.15, 0.7, 0.002, 0.16 + 0.12 * s);
      this.hiss(v, v.out, 'white', 'bandpass', t, 1800, 900, 1, 0.15 + 0.2 * s, 0.002, 0.07);
      if (sp > 14) {
        this.hiss(v, v.out, 'crackle', 'bandpass', t, 1400, 900, 0.7, 0.6, 0.002, 0.3);
        this.tone(v, v.out, 'sine', t, 60, 28, 0.35, 0.6, 0.003, 0.45);
      }
    });
  }

  /** Player took damage (non-positional). */
  hurt(): void {
    this.one('hurt', null, 0.5, O.hurt, (v, t) => {
      this.tone(v, v.out, 'sine', t, 155, 50, 0.18, 0.9, 0.002, 0.22);
      const lp = this.filt(v, v.out, 'lowpass', 1300, 1.2);
      this.tone(v, lp, 'sawtooth', t, 230, 85, 0.22, 0.3, 0.003, 0.26);
      this.hiss(v, v.out, 'white', 'bandpass', t, 1900, 1200, 1, 0.45, 0.001, 0.07);
      this.tone(v, v.out, 'sine', t + 0.02, 3400, 3350, 0.5, 0.035, 0.02, 0.6);
    });
  }

  /**
   * Per frame. Continuous wind by the player's speed (m/s): silent below ~7,
   * a roar with buffeting at 30+. Fades by itself if calls stop (pause).
   */
  wind(speed: number): void {
    const ctx = this.ctx, a = this.amb;
    if (!ctx || !a) return;
    try {
      const t = ctx.currentTime;
      const s = clamp01(((speed || 0) - 7) / 23);
      if (t - this.windT < 0.05 && Math.abs(s - this.windS) < 0.08 && this.windT <= t) return;
      if (s === 0 && this.windS === 0 && t - this.windT < 0.3 && this.windT <= t) return;
      this.windT = t;
      this.windS = s;
      keep(a.windG.gain, 0.42 * Math.pow(s, 1.4), t, 0.08, 0.5);
      keep(a.rumbleG.gain, 0.65 * s * s, t, 0.1, 0.5);
      a.windBP.frequency.setTargetAtTime(350 + 1700 * s, t, 0.1);
      a.windLP.frequency.setTargetAtTime(900 + 5600 * s, t, 0.1);
      a.gustDepth.gain.setTargetAtTime(0.28 * s * s, t, 0.2);
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Meta
  // ---------------------------------------------------------------------------

  /** Trick stinger: pitch and brightness rise with rank D..SSS. Several in one frame cascade. */
  trick(rank: StyleRank, points: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const r = Math.max(0, RANKS.indexOf(rank));
    const now = ctx.currentTime;
    const start = Math.max(now, this.trickT + 0.08);
    if (start - now > 0.45) return;
    this.trickT = start;
    const vol = 0.3 + 0.12 * clamp01((points || 0) / 800);
    this.one('trick', null, vol, O.meta, (v, t0) => {
      const t = Math.max(t0, start);
      const base = TRICK_NOTE[r];
      const lp = this.filt(v, v.out, 'lowpass', 1600 + r * 1200, 1 + r * 0.2);
      const type: OscillatorType = r < 2 ? 'triangle' : r < 4 ? 'square' : 'sawtooth';
      const seq = r >= 4 ? [0, 7, 12] : [0, 7];
      for (let i = 0; i < seq.length; i++) {
        const tt = t + i * 0.055;
        const f = mtof(base + seq[i]);
        const last = i === seq.length - 1;
        this.tone(v, lp, type, tt, f, f, 0, last ? 0.32 : 0.24, 0.003, last ? 0.45 + r * 0.06 : 0.12);
        if (r >= 4) this.tone(v, lp, type, tt, f * 1.005, f * 1.005, 0, 0.14, 0.003, last ? 0.4 : 0.1);
        this.tone(v, v.out, 'sine', tt, f * 2, f * 2, 0, last ? 0.14 : 0.08, 0.002, last ? 0.35 : 0.1);
      }
      if (r >= 3) this.hiss(v, v.out, 'white', 'highpass', t + 0.05, 6000, 9000, 0.7, 0.14, 0.01, 0.3);
      if (r >= 5) {
        this.tone(v, v.out, 'sine', t, 110, 55, 0.3, 0.45, 0.003, 0.4);
        const f3 = mtof(base + 16);
        this.tone(v, lp, 'triangle', t + 0.11, f3, f3, 0, 0.12, 0.01, 0.5);
      }
      if (r === 6) {
        for (let i = 0; i < 4; i++) {
          const f = mtof(base + 12 + [0, 7, 12, 19][i]);
          this.tone(v, v.out, 'sine', t + 0.16 + i * 0.035, f, f, 0, 0.07, 0.002, 0.35);
        }
      }
    });
  }

  /** Combo cash-in: a strummed open chord, low boom, ka-ching and a sparkle run (bigger with points). */
  comboBank(points: number): void {
    const s = clamp01(Math.log10(Math.max(points || 0, 100)) / 4 - 0.25);
    const k = 0.4 + 0.6 * s;
    this.one('comboBank', null, 0.32 + 0.12 * k, O.meta, (v, t) => {
      const lp = this.filt(v, v.out, 'lowpass', 500, 1.1);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.exponentialRampToValueAtTime(5200, t + 0.22);
      lp.frequency.exponentialRampToValueAtTime(1800, t + 1.4);
      const chord = [50, 57, 62, 66, 69, 76];
      const dur = 1.0 + 0.8 * k;
      for (let i = 0; i < chord.length; i++) {
        const f = mtof(chord[i]);
        const tt = t + i * 0.022;
        this.tone(v, lp, 'sawtooth', tt, f, f, 0, 0.1, 0.008, dur);
        this.tone(v, lp, 'sawtooth', tt, f * 1.0045, f * 1.0045, 0, 0.08, 0.008, dur);
      }
      this.tone(v, v.out, 'sine', t, 73.4, 55, 0.6, 0.6, 0.005, 0.8);
      this.ring(v, v.out, t, [2794, 4186, 5588], [0.12, 0.08, 0.05], 0.3);
      this.ring(v, v.out, t + 0.09, [3136, 4699, 6272], [0.12, 0.08, 0.05], 0.4);
      const run = [74, 78, 81, 86, 90, 93, 98, 102];
      const n = 3 + Math.round(5 * k);
      for (let i = 0; i < n; i++) {
        const f = mtof(run[i]);
        this.tone(v, v.out, 'sine', t + 0.12 + i * 0.03, f, f, 0, 0.07, 0.002, 0.3);
        this.tone(v, v.out, 'triangle', t + 0.12 + i * 0.03, f * 0.5, f * 0.5, 0, 0.04, 0.002, 0.2);
      }
    });
  }

  /** UI feedback (not slowed by bullet time). */
  ui(kind: 'click' | 'confirm' | 'deny' | 'pickup' | 'objective' | 'clip' | 'shutter'): void {
    this.one('ui:' + kind, null, 0.35, O.ui, (v, t) => {
      const seq = (notes: number[], type: OscillatorType, gap: number, peak: number, dur: number) => {
        for (let i = 0; i < notes.length; i++) this.tone(v, v.out, type, t + i * gap, notes[i], notes[i], 0, peak, 0.004, dur);
      };
      switch (kind) {
        case 'click':
          this.tone(v, v.out, 'sine', t, 1300, 900, 0.03, 0.4, 0.001, 0.05);
          this.hiss(v, v.out, 'white', 'highpass', t, 4000, 4000, 0.7, 0.2, 0.001, 0.015);
          break;
        case 'confirm': seq([660, 990], 'triangle', 0.06, 0.45, 0.18); break;
        case 'deny': {
          const lp = this.filt(v, v.out, 'lowpass', 1200, 1);
          this.tone(v, lp, 'square', t, 220, 220, 0, 0.3, 0.004, 0.09);
          this.tone(v, lp, 'square', t + 0.09, 165, 165, 0, 0.3, 0.004, 0.14);
          break;
        }
        case 'pickup':
          seq([520, 780], 'sine', 0.05, 0.45, 0.16);
          this.tone(v, v.out, 'sine', t + 0.05, 1560, 1560, 0, 0.1, 0.002, 0.2);
          break;
        case 'objective': seq([523, 659, 784, 1046], 'triangle', 0.07, 0.4, 0.3); break;
        case 'clip':
          // "rec" chime: rising two-tone + a projector flutter
          seq([880, 1320], 'sine', 0.08, 0.45, 0.22);
          for (let i = 0; i < 4; i++) this.hiss(v, v.out, 'white', 'bandpass', t + 0.18 + i * 0.045, 3200, 3200, 3, 0.25, 0.001, 0.02);
          break;
        case 'shutter':
          this.hiss(v, v.out, 'white', 'highpass', t, 2200, 2200, 0.7, 0.8, 0.001, 0.02);
          this.hiss(v, v.out, 'brown', 'lowpass', t, 500, 500, 0.7, 0.6, 0.001, 0.04);
          this.tone(v, v.out, 'sine', t + 0.01, 2600, 2400, 0.05, 0.08, 0.001, 0.05);
          this.hiss(v, v.out, 'white', 'bandpass', t + 0.075, 3500, 3500, 1.5, 0.6, 0.001, 0.025);
          break;
      }
    });
  }

  /** Lift / hoist motor loop at pos. on=true starts it (again = follow pos, per-frame safe); on=false stops it with a clunk. */
  lift(pos: V3, on: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const L = this.liftLoop;
      if (on) {
        if (L) {
          const p = L.p;
          if (p && p.positionX) {
            const t = ctx.currentTime;
            p.positionX.setTargetAtTime(pos.x, t, 0.05);
            p.positionY.setTargetAtTime(pos.y, t, 0.05);
            p.positionZ.setTargetAtTime(pos.z, t, 0.05);
          } else if (p) p.setPosition(pos.x, pos.y, pos.z);
          return;
        }
        this.liftLoop = this.buildLift(ctx, pos);
        this.clunk(pos);
      } else if (L) {
        this.liftLoop = null;
        const t = ctx.currentTime;
        L.g.gain.cancelScheduledValues(t);
        L.g.gain.setTargetAtTime(0, t, 0.12);
        for (const s of L.srcs) s.stop(t + 0.7);
        L.srcs[0].onended = () => {
          for (const p of L.tuned) { try { this.pitch?.disconnect(p); } catch { /* ignore */ } }
          for (const n of L.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
        };
        this.clunk(pos);
      }
    } catch { /* ignore */ }
  }

  private buildLift(ctx: BaseAudioContext, pos: V3): Loop {
    const t = ctx.currentTime;
    const nodes: AudioNode[] = [];
    const srcs: AudioScheduledSourceNode[] = [];
    const tuned: AudioParam[] = [];
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 4;
    p.rolloffFactor = 1.2;
    place(p, pos);
    p.connect(this.sfx);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(0.2, t, 0.25);
    g.connect(p);
    const lp = ctx.createBiquadFilter();
    kr(lp.frequency);
    kr(lp.Q);
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    lp.Q.value = 2;
    lp.connect(g);
    for (const [type, f, lvl] of [['sawtooth', 50, 0.6], ['square', 100.7, 0.25], ['sine', 150, 0.3]] as const) {
      const o = ctx.createOscillator();
      kr(o.frequency);
      kr(o.detune);
      o.type = type;
      o.frequency.setValueAtTime(f * 0.5, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.9);
      const og = ctx.createGain();
      og.gain.value = lvl;
      o.connect(og).connect(lp);
      if (this.pitch) { this.pitch.connect(o.detune); tuned.push(o.detune); }
      o.start(t);
      srcs.push(o);
      nodes.push(o, og);
    }
    // servo whine
    const bp = ctx.createBiquadFilter();
    kr(bp.frequency);
    kr(bp.Q);
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 5;
    const wg = ctx.createGain();
    wg.gain.value = 0.25;
    const n = ctx.createBufferSource();
    n.buffer = this.bufs.white;
    n.loop = true;
    n.connect(bp).connect(wg).connect(g);
    n.start(t, Math.random());
    srcs.push(n);
    nodes.push(lp, g, p, bp, wg, n);
    return { g, p, nodes, srcs, tuned };
  }

  private clunk(pos: V3) {
    this.one('clunk', pos, 0.5, O.clunk, (v, t) => {
      this.hiss(v, v.out, 'brown', 'lowpass', t, 700, 250, 0.8, 0.9, 0.002, 0.18);
      this.ring(v, v.out, t, [180, 470, 1130], [0.3, 0.15, 0.06], 0.3);
    });
  }

  /** Musical stings: alert (combat starts), zone (new zone title), boss, victory. */
  sting(kind: 'alert' | 'zone' | 'boss' | 'victory'): void {
    this.one('sting:' + kind, null, 0.5, O.sting, (v, t) => {
      switch (kind) {
        case 'alert': {
          // "dun-DUN": Dm stab then a tense Eb stab, sub boom, noise hit
          const stab = (tt: number, notes: number[], peak: number) => {
            const lp = this.filt(v, v.out, 'lowpass', 3200, 2);
            lp.frequency.setValueAtTime(3200, tt);
            lp.frequency.exponentialRampToValueAtTime(500, tt + 0.5);
            for (const m of notes) {
              const f = mtof(m);
              this.tone(v, lp, 'sawtooth', tt, f, f, 0, peak, 0.005, 0.8);
              this.tone(v, lp, 'sawtooth', tt, f * 1.006, f * 1.006, 0, peak * 0.8, 0.005, 0.7);
            }
          };
          stab(t, [38, 50, 57, 62, 65], 0.09);
          stab(t + 0.2, [39, 51, 58, 63, 66], 0.11);
          this.tone(v, v.out, 'sine', t + 0.2, 70, 30, 0.6, 0.8, 0.003, 0.8);
          this.hiss(v, v.out, 'white', 'lowpass', t + 0.2, 5000, 800, 0.7, 0.35, 0.002, 0.4);
          break;
        }
        case 'zone': {
          const lp = this.filt(v, v.out, 'lowpass', 600, 0.9);
          lp.frequency.setValueAtTime(600, t);
          lp.frequency.exponentialRampToValueAtTime(2600, t + 1.2);
          lp.frequency.exponentialRampToValueAtTime(900, t + 3);
          for (const m of [50, 57, 64, 66, 69]) {
            const f = mtof(m);
            for (const [type, dt] of [['sawtooth', 1], ['triangle', 1.004]] as const) {
              const g = this.gainN(v, lp, 0);
              swell(g.gain, t, 0.08, 0.7, 3);
              this.osc(v, g, type, f * dt, t, t + 3.05);
            }
          }
          this.ring(v, v.out, t + 0.35, [mtof(81), mtof(88)], [0.1, 0.06], 1.8);
          this.tone(v, v.out, 'sine', t, 36.7, 36.7, 0, 0.5, 0.4, 2.2);
          break;
        }
        case 'boss': {
          const lp = this.filt(v, v.out, 'lowpass', 300, 2);
          lp.frequency.setValueAtTime(300, t);
          lp.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
          lp.frequency.exponentialRampToValueAtTime(250, t + 3.4);
          for (const f of [36.7, 38.9, 55, 73.4, 77.8]) {
            const g = this.gainN(v, lp, 0);
            swell(g.gain, t, 0.22, 0.25, 3.5);
            this.osc(v, g, 'sawtooth', f, t, t + 3.55);
          }
          this.tone(v, v.out, 'sine', t, 90, 26, 1.2, 1.0, 0.003, 1.6);
          this.hiss(v, v.out, 'pink', 'lowpass', t, 6000, 400, 0.7, 0.6, 0.003, 2.2, 1.5);
          this.ring(v, v.out, t + 0.05, [mtof(86), mtof(87), mtof(93)], [0.06, 0.06, 0.04], 2.2);
          break;
        }
        case 'victory': {
          const lp = this.filt(v, v.out, 'lowpass', 2800, 1);
          const fan = [62, 66, 69, 74];
          for (let i = 0; i < fan.length; i++) {
            const f = mtof(fan[i]);
            const tt = t + i * 0.12;
            const last = i === fan.length - 1;
            this.tone(v, lp, 'sawtooth', tt, f, f, 0, 0.14, 0.01, last ? 2.2 : 0.2);
            this.tone(v, lp, 'sawtooth', tt, f * 1.005, f * 1.005, 0, 0.1, 0.01, last ? 2.0 : 0.18);
          }
          const tc = t + 0.36;
          for (const m of [50, 57, 62, 66]) {
            const f = mtof(m);
            this.tone(v, lp, 'triangle', tc, f, f, 0, 0.14, 0.02, 2.2);
          }
          for (let i = 0; i < 6; i++) {
            const f = mtof([86, 90, 93, 98, 93, 98][i]);
            this.tone(v, v.out, 'sine', tc + 0.1 + i * 0.07, f, f, 0, 0.06, 0.002, 0.5);
          }
          this.tone(v, v.out, 'sine', tc, 73.4, 73.4, 0, 0.5, 0.01, 1.4);
          this.hiss(v, v.out, 'white', 'highpass', tc, 5000, 5000, 0.7, 0.2, 0.003, 1.4);
          break;
        }
      }
    });
  }

  /** EXTRA: enemy shout / radio bark cue (EnemyHooks.sound 'shout'): squelchy chatter + beep. */
  shout(pos: V3): void {
    this.one('shout', pos, 0.8, O.shout, (v, t) => {
      const bp = this.filt(v, v.out, 'bandpass', 1500, 2.5);
      const g = this.gainN(v, bp, 0);
      for (let i = 0; i < 9; i++) g.gain.setValueAtTime(Math.random() < 0.75 ? rnd(0.2, 0.6) : 0, t + i * 0.05);
      g.gain.setValueAtTime(0, t + 0.45);
      this.noise(v, g, 'white', t, t + 0.46);
      const vg = this.gainN(v, bp, 0);
      perc(vg.gain, t, 0.3, 0.02, 0.42);
      const saw = this.osc(v, vg, 'sawtooth', 160, t, t + 0.44);
      for (let i = 0; i < 6; i++) saw.frequency.setValueAtTime(rnd(130, 230), t + i * 0.07);
      this.tone(v, v.out, 'sine', t + 0.46, 1400, 1400, 0, 0.12, 0.002, 0.08);
    });
  }

  // ---------------------------------------------------------------------------
  // Music engine
  // ---------------------------------------------------------------------------

  private buildMusic(ctx: BaseAudioContext) {
    const G = (v: number, dest: Dest) => { const g = ctx.createGain(); g.gain.value = v; link(g, dest); return g; };
    const bus = this.musicBus;
    const stingG = G(1.3, bus);
    // Pad (calm bed): 4 detuned saws + a sub sine, slow filter drift, sidechain pump.
    const padG = G(0.5, bus);
    const pump = G(1, padG);
    const padF = ctx.createBiquadFilter();
    kr(padF.frequency);
    kr(padF.Q);
    padF.type = 'lowpass';
    padF.frequency.value = 650;
    padF.Q.value = 0.8;
    padF.connect(pump);
    const drift = ctx.createOscillator();
    kr(drift.frequency);
    kr(drift.detune);
    drift.frequency.value = 0.06;
    drift.connect(G(220, padF.frequency));
    drift.start();
    const ch = PROG[0];
    const pad: OscillatorNode[] = [];
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      kr(o.frequency);
      kr(o.detune);
      o.type = 'sawtooth';
      o.frequency.value = mtof(ch.pad[i]);
      o.detune.value = i % 2 ? 7 : -7;
      if (this.pitch) this.pitch.connect(o.detune);
      o.connect(G(0.12, padF));
      o.start();
      pad.push(o);
    }
    const sub = ctx.createOscillator();
    kr(sub.frequency);
    kr(sub.detune);
    sub.frequency.value = mtof(ch.root + 12);
    if (this.pitch) this.pitch.connect(sub.detune);
    sub.connect(G(0.16, pump));
    sub.start();
    // Layers.
    const tenG = G(0, bus);
    const driveG = G(0, bus);
    const highG = G(0, bus);
    // Echo (dotted 8th) for arp + bells.
    const dl = ctx.createDelay(1);
    dl.delayTime.value = 0.375;
    const dlf = ctx.createBiquadFilter();
    kr(dlf.frequency);
    kr(dlf.Q);
    dlf.type = 'lowpass';
    dlf.frequency.value = 2400;
    const fb = G(0.34, dl);
    const echoSend = G(0.45, dl);
    dl.connect(dlf).connect(fb);
    dlf.connect(G(0.55, bus));
    // Arp: dry through the high layer, wet through the echo.
    const arpF = ctx.createBiquadFilter();
    kr(arpF.frequency);
    kr(arpF.Q);
    arpF.type = 'lowpass';
    arpF.frequency.value = 2600;
    arpF.Q.value = 3;
    arpF.connect(highG);
    arpF.connect(echoSend);
    // Calm bells: dry with the pad, wet through the echo.
    const bells = G(1, padG);
    bells.connect(echoSend);
    this.mus = { pad, sub, padF, pump, padG, tenG, driveG, highG, bells, arpF, stingG };
  }

  /** Lookahead scheduler: fills the next ~180 ms of 16th steps. */
  private schedule(now: number) {
    if (this.nextT < now - 0.25 || this.nextT > now + 1) this.nextT = now + 0.05;
    let guard = 0;
    while (this.nextT < now + 0.18 && guard++ < 8) {
      this.musicStep(this.step, this.nextT);
      this.step++;
      this.nextT += STEP;
    }
  }

  private musicStep(step: number, t: number) {
    const m = this.mus!;
    const st = step % 16, bar = Math.floor(step / 16);
    const ci = Math.floor(bar / 2) % 4;
    const ch = PROG[ci];
    const lv = this.lv;
    if (st === 0 && bar % 2 === 0) {
      for (let i = 0; i < 4; i++) m.pad[i].frequency.setTargetAtTime(mtof(ch.pad[i]), t, 0.3);
      m.sub.frequency.setTargetAtTime(mtof(ch.root + 12), t, 0.3);
    }
    // Tension: ticking 8ths + a heartbeat.
    if (lv.ten > 0.03) {
      if (st % 2 === 0) this.mNoise(m.tenG, 'white', 'highpass', t, 6500, 0.7, st % 4 === 0 ? 0.12 : 0.06, 0.001, 0.03);
      if (st === 0 || st === 3) this.mTone(m.tenG, 'sine', t, 62, 40, 0.1, st === 0 ? 0.55 : 0.4, 0.004, 0.22);
    }
    // Drive: kick, snare, hats, bass.
    if (lv.drv > 0.02) {
      const four = lv.hi > 0.25;
      const kick = four ? st % 4 === 0 || st === 10 : st === 0 || st === 3 || st === 8 || st === 11;
      if (kick) {
        this.mTone(m.driveG, 'sine', t, 150, 44, 0.09, 0.95, 0.002, 0.3);
        this.mNoise(m.driveG, 'white', 'highpass', t, 3500, 0.7, 0.12, 0.001, 0.012);
        const dip = 1 - 0.5 * lv.drv;
        m.pump.gain.setValueAtTime(1, t);
        m.pump.gain.linearRampToValueAtTime(dip, t + 0.012);
        m.pump.gain.setTargetAtTime(1, t + 0.02, 0.09);
      }
      if (st === 4 || st === 12) {
        this.mNoise(m.driveG, 'white', 'bandpass', t, 1900, 0.6, 0.5, 0.001, 0.2);
        this.mTone(m.driveG, 'triangle', t, 200, 160, 0.06, 0.3, 0.001, 0.09);
      }
      if (st % 2 === 0) this.mNoise(m.driveG, 'white', 'highpass', t, 7500, 0.7, st % 4 === 2 ? 0.16 : 0.08, 0.001, 0.045);
      if (BASS_STEPS[st]) this.mBass(m.driveG, t, mtof(ch.root + BASS_OCT[st]), 0.3);
    }
    // High energy: arp, 16th hats, open hats, fills, crash.
    if (lv.hi > 0.02) {
      const f = mtof(ch.arp[ARP[st]] + 12);
      this.mTone(m.arpF, 'square', t, f, f, 0, 0.09, 0.002, 0.12);
      if (st % 2 === 1) this.mNoise(m.highG, 'white', 'highpass', t, 8000, 0.7, 0.06, 0.001, 0.03);
      if (st === 6 || st === 14) this.mNoise(m.highG, 'white', 'highpass', t, 6000, 0.7, 0.1, 0.002, 0.22);
      if (bar % 4 === 3 && st >= 12) this.mNoise(m.highG, 'white', 'bandpass', t, 2100, 0.6, 0.18 + (st - 12) * 0.06, 0.001, 0.12);
      if (bar % 4 === 0 && st === 0) this.mNoise(m.highG, 'white', 'highpass', t, 4200, 0.7, 0.22, 0.003, 1.3);
    }
    // Calm: occasional glassy bell with echo.
    if (lv.drv < 0.15 && st % 4 === 0 && Math.random() < 0.09) {
      const f = mtof(BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)]);
      const peak = 0.11 * (1 - lv.drv);
      this.mTone(m.bells, 'sine', t, f, f, 0, peak, 0.004, 1.8);
      this.mTone(m.bells, 'sine', t, f * 2.76, f * 2.76, 0, peak * 0.25, 0.002, 0.7);
    }
  }

  /** Fire-and-forget music oscillator note (not voice-limited). */
  private mTone(dest: AudioNode, type: OscillatorType, t: number, f0: number, f1: number, gl: number, peak: number, a: number, dur: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    perc(g.gain, t, peak, a, dur);
    g.connect(dest);
    const o = ctx.createOscillator();
    kr(o.frequency);
    kr(o.detune);
    o.type = type;
    glide(o.frequency, t, f0, f1, gl);
    o.detune.value = this.det;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  private mNoise(dest: AudioNode, b: Buf, type: BiquadFilterType, t: number, f: number, q: number, peak: number, a: number, dur: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    perc(g.gain, t, peak, a, dur);
    g.connect(dest);
    const fl = ctx.createBiquadFilter();
    kr(fl.frequency);
    kr(fl.Q);
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    fl.connect(g);
    const s = ctx.createBufferSource();
    const buf = this.bufs[b];
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = this.rate;
    s.connect(fl);
    s.start(t, Math.random() * (buf.duration - 0.05));
    s.stop(t + dur + 0.02);
    s.onended = () => { s.disconnect(); fl.disconnect(); g.disconnect(); };
  }

  private mBass(dest: AudioNode, t: number, f: number, peak: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    perc(g.gain, t, peak, 0.004, 0.2);
    g.connect(dest);
    const lp = ctx.createBiquadFilter();
    kr(lp.frequency);
    kr(lp.Q);
    lp.type = 'lowpass';
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(1300, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.14);
    lp.connect(g);
    const o = ctx.createOscillator();
    kr(o.frequency);
    kr(o.detune);
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = this.det;
    o.connect(lp);
    o.start(t);
    o.stop(t + 0.22);
    o.onended = () => { o.disconnect(); lp.disconnect(); g.disconnect(); };
  }

  // ---------------------------------------------------------------------------
  // Ambient events (driven from setIntensity: no timers)
  // ---------------------------------------------------------------------------

  private ambientEvents(d: number, t: number) {
    this.hornT -= d;
    if (this.hornT <= 0) {
      this.hornT = rnd(45, 95);
      if (this.alt < 35 && !this.paused) this.horn();
    }
    this.gustT -= d;
    if (this.gustT <= 0) {
      this.gustT = rnd(5, 12);
      const a = this.amb;
      if (a && this.alt > 20) {
        const h = smooth(20, 90, this.alt);
        a.altGust.gain.setTargetAtTime(1 + 1.2 * h, t, 0.7);
        a.altGust.gain.setTargetAtTime(1, t + rnd(1.2, 2.5), 1.1);
      }
    }
  }

  /** Distant ship horn across the harbour. */
  private horn() {
    this.one('horn', null, 0.16, O.horn, (v, t) => {
      const lp = this.filt(v, v.out, 'lowpass', 380, 1);
      for (const f of [73, 110.5]) {
        const g = this.gainN(v, lp, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.8);
        g.gain.setValueAtTime(0.5, t + 3.2);
        g.gain.linearRampToValueAtTime(0, t + 5);
        this.osc(v, g, 'sawtooth', f, t, t + 5.1);
      }
    });
  }
}

const _p = new THREE.Vector3();
const _f = new THREE.Vector3();
const _u = new THREE.Vector3();
const _q = new THREE.Quaternion();
