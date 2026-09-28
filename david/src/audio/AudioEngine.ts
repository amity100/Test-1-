/**
 * DAVID — procedural audio engine (Web Audio API, zero audio files).
 *
 * Everything is synthesized at runtime: a generative cinematic score (kinnor/lyre via
 * Karplus-Strong, low strings, formant choir, frame drums & taiko, shofar, ney flute),
 * golden-hour ambience (wind, cicadas, birds) and all gameplay SFX.
 *
 * Signal flow
 *
 *   mood composers ─► moodFader ─► musicIn ─► musicDuck ──────────┐
 *   world sfx ──┐                                                 │
 *   ambience ───┴─► worldIn ─► slow-mo lowpass ───────────────────┤
 *   ui / cinematic sfx ─► uiIn ───────────────────────────────────┤
 *   sends ─► hallIn ─► convolver (generated IR) ──────────────────┤
 *   sends ─► echoIn ─► ping-pong "valley" echo ───────────────────┤
 *                                                                 ▼
 *              sum ─► glue compressor ─► master ─► mute ─► limiter ─► soft clip ─► out
 *
 * One-shot voices are built from short-lived nodes that are stopped at their end time and
 * disconnected by a periodic sweeper; music is scheduled ahead on the AudioContext clock.
 */

// ============================================================================
// Public types
// ============================================================================

export type MusicMood = 'silence' | 'title' | 'pastoral' | 'tension' | 'battle' | 'victory';

export type SfxName =
  | 'footstep' | 'footstepRun' | 'slingRelease' | 'stoneHit' | 'stoneHitBear' | 'jarShatter'
  | 'sheepBleat' | 'lambBleat' | 'goatBleat' | 'bearRoar' | 'bearGrowl' | 'bearHurt' | 'bearDeath'
  | 'staffHit' | 'whoosh' | 'grab' | 'davidHurt' | 'davidEffort' | 'pickup' | 'uiObjective'
  | 'uiConfirm' | 'heartbeat' | 'impactBoom' | 'dodge' | 'titleHit' | 'shepherdCall' | 'shepherdWhistle';

/** volume 0..1 (default 1), pitch multiplier (default 1; slight randomization is added), pan -1..1 */
export interface SfxOptions { volume?: number; pitch?: number; pan?: number; }

export interface AmbienceLevels { wind?: number; cicadas?: number; birds?: number; }

// ============================================================================
// Small helpers
// ============================================================================

const TAU = Math.PI * 2;
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const expLerp = (a: number, b: number, t: number): number => a * Math.pow(b / a, t);
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randi = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
const chance = (p: number): boolean => Math.random() < p;
const white = (): number => Math.random() * 2 - 1;
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/** Pitch class relative to D (D = 0). */
const pcOf = (m: number): number => (((m - 2) % 12) + 12) % 12;
const fin = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

type Curve = NonNullable<WaveShaperNode['curve']>;
type NoiseKind = 'white' | 'pink' | 'brown';

/** Linear attack then exponential decay. Returns the time the voice is ~-60 dB. */
function perc(p: AudioParam, t: number, a: number, peak: number, tau: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(0, t + a, tau);
  return t + a + tau * 7;
}

/** Piecewise-linear automation: pts are [fractionOfDur, value]. */
function contour(p: AudioParam, t: number, dur: number, pts: ReadonlyArray<readonly [number, number]>, scale = 1): void {
  p.setValueAtTime(pts[0][1] * scale, t);
  for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1] * scale, t + pts[i][0] * dur);
}

/**
 * Click-free glide from whatever the param is doing now (used for crossfades/ducks).
 * setTargetAtTime always starts from the true current value; a linear ramp would start
 * from the previous *event*, which jumps when that event finished long ago. ~98% at `dur`.
 */
function rampTo(p: AudioParam, v: number, at: number, dur: number): void {
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(at);
  else p.cancelScheduledValues(at);
  p.setTargetAtTime(v, at, Math.max(0.005, dur / 4));
}

/** Smooth 1-D value noise in [0,1]. */
class SmoothNoise {
  private readonly v: number[] = [];
  constructor(private readonly n = 64) {
    for (let i = 0; i < n; i++) this.v.push(Math.random());
  }
  at(x: number): number {
    const i = Math.floor(x);
    const f = x - i;
    const a = this.v[((i % this.n) + this.n) % this.n];
    const b = this.v[(((i + 1) % this.n) + this.n) % this.n];
    return a + (b - a) * f * f * (3 - 2 * f);
  }
}

// ============================================================================
// Music theory
// ============================================================================

type ChordName = 'Dm' | 'D' | 'Eb' | 'F' | 'G' | 'Gm' | 'A' | 'Am' | 'Bb' | 'Bm' | 'C' | 'Cm' | 'Em';
/** Chord pitch classes relative to D, root first. */
const CHORDS: Record<ChordName, readonly number[]> = {
  Dm: [0, 3, 7], D: [0, 4, 7], Eb: [1, 5, 8], F: [3, 7, 10], G: [5, 9, 0], Gm: [5, 8, 0],
  A: [7, 11, 2], Am: [7, 10, 2], Bb: [8, 0, 3], Bm: [9, 0, 4], C: [10, 2, 5], Cm: [10, 1, 5], Em: [2, 5, 9],
};

const SCALES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  freygish: [0, 1, 4, 5, 7, 8, 10], // D Eb F# G A Bb C
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

/** All midi notes in [lo, hi] belonging to the chord, ascending. */
function voicing(pcs: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(pcOf(m))) out.push(m);
  return out;
}
/** Lowest midi >= lo whose pitch class is the chord root. */
function rootIn(pcs: readonly number[], lo: number): number {
  let m = lo;
  while (pcOf(m) !== pcs[0]) m++;
  return m;
}
function scaleNotes(scale: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (scale.includes(pcOf(m))) out.push(m);
  return out;
}
function degToMidi(scale: readonly number[], base: number, deg: number): number {
  const o = Math.floor(deg / 7);
  return base + scale[((deg % 7) + 7) % 7] + 12 * o;
}
function snapToChord(sc: readonly number[], idx: number, pcs: readonly number[]): number {
  for (let d = 0; d < sc.length; d++) {
    for (const j of [idx - d, idx + d]) if (j >= 0 && j < sc.length && pcs.includes(pcOf(sc[j]))) return j;
  }
  return idx;
}
const lyrePan = (m: number): number => clamp((m - 66) / 22, -0.55, 0.55);

type Vowel = 'ah' | 'oh' | 'oo' | 'eh';
const VOWELS: Record<Vowel, readonly [number, number, number]> = {
  ah: [720, 1120, 2600],
  oh: [520, 860, 2450],
  oo: [340, 800, 2300],
  eh: [560, 1800, 2550],
};

// ============================================================================
// Offline DSP — used to bake one-shot buffers (drums, footsteps, lyre strings, IR ...)
// ============================================================================

type BQType = 'lp' | 'hp' | 'bp' | 'peak';

/** RBJ biquad for sample-by-sample processing in JS. */
class BQ {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(type: BQType, f: number, q: number, sr: number, db = 0) {
    const w = (TAU * clamp(f, 5, sr * 0.49)) / sr;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const A = Math.pow(10, db / 40);
    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = -2 * cs, a2 = 1;
    switch (type) {
      case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a2 = 1 - al; break;
      case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a2 = 1 - al; break;
      case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a2 = 1 - al; break;
      case 'peak': b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a2 = 1 - al / A; break;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Create a buffer, fill it, peak-normalize and fade the tail. */
function bake(
  ctx: BaseAudioContext, seconds: number, channels: number,
  fill: (d: Float32Array[], sr: number, len: number) => void, peak = 0.9, rate = 0,
): AudioBuffer {
  const sr = rate || ctx.sampleRate;
  const len = Math.max(16, Math.floor(seconds * sr));
  const buf = ctx.createBuffer(channels, len, sr);
  const d: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) d.push(buf.getChannelData(ch));
  fill(d, sr, len);
  let m = 0;
  for (const a of d) {
    for (let i = 0; i < len; i++) {
      const v = a[i];
      if (!Number.isFinite(v)) a[i] = 0;
      else if (Math.abs(v) > m) m = Math.abs(v);
    }
  }
  const g = peak > 0 && m > 0 ? peak / m : 1;
  const fo = Math.min(len, Math.floor(sr * 0.008));
  for (const a of d) {
    if (g !== 1) for (let i = 0; i < len; i++) a[i] *= g;
    for (let i = 0; i < fo; i++) a[len - 1 - i] *= i / fo;
  }
  return buf;
}

/** Loopable noise (tail cross-faded into head so looping never clicks). RMS ~0.25. */
function bakeNoise(ctx: BaseAudioContext, kind: NoiseKind, seconds: number, channels: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(seconds * sr);
  const xf = Math.floor(sr * 0.2);
  const buf = ctx.createBuffer(channels, len, sr);
  for (let ch = 0; ch < channels; ch++) {
    const raw = new Float32Array(len + xf);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = white();
      if (kind === 'white') raw[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last;
      }
    }
    let ss = 0;
    for (let i = 0; i < raw.length; i++) ss += raw[i] * raw[i];
    const g = 0.25 / Math.sqrt(ss / raw.length || 1);
    const out = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      out[i] = (i < xf ? raw[i] * Math.sqrt(i / xf) + raw[len + i] * Math.sqrt(1 - i / xf) : raw[i]) * g;
    }
  }
  return buf;
}

/** Stereo reverb impulse: decaying noise whose high end dies faster (air absorption). */
function bakeImpulse(ctx: BaseAudioContext, seconds: number, pre: number): AudioBuffer {
  return bake(ctx, seconds + pre, 2, (d, sr, len) => {
    const p0 = Math.floor(pre * sr);
    const kD = Math.exp(-6.9 / (seconds * sr)), kA = Math.exp(-1 / (0.008 * sr));
    for (let ch = 0; ch < 2; ch++) {
      const y = d[ch];
      let lp = 0, a = 0, comp = 1, eD = 1, eA = 1;
      for (let i = p0; i < len; i++) {
        if ((i - p0) % 64 === 0) { // air absorption: the high end dies faster
          const u = (i - p0) / sr / seconds;
          const fc = 250 + 8500 * Math.pow(0.08, u);
          a = Math.exp((-TAU * fc) / sr);
          comp = Math.sqrt((1 + a) / (1 - a));
        }
        lp = (1 - a) * white() + a * lp;
        y[i] = lp * comp * eD * (1 - eA);
        eD *= kD; eA *= kA;
      }
      for (let k = 0; k < 12; k++) { // a few early reflections
        const t = rand(0.008, 0.08);
        const i = p0 + Math.floor(t * sr);
        if (i + 2 < len) {
          const v = (chance(0.5) ? 1 : -1) * rand(0.5, 1.2) * (1 - t / 0.1);
          y[i] += v; y[i + 1] += v * 0.5; y[i + 2] += v * 0.2;
        }
      }
    }
  }, 0.9);
}

/** Short band-passed noise grains (gravel, grit, crackle). */
function addGrains(
  y: Float32Array, sr: number, count: number, t0: number, spread: number,
  fLo: number, fHi: number, aLo: number, aHi: number, lLo: number, lHi: number, decay: number,
  yR?: Float32Array,
): void {
  for (let k = 0; k < count; k++) {
    const dt = Math.pow(Math.random(), 1.5) * spread;
    const s0 = Math.floor((t0 + dt) * sr);
    const gl = Math.max(8, Math.floor(rand(lLo, lHi) * sr));
    const bq = new BQ('bp', rand(fLo, fHi), rand(0.9, 2.2), sr);
    const amp = rand(aLo, aHi) * Math.exp(-dt / decay) * 3.5;
    const pan = Math.random();
    for (let i = 0; i < gl; i++) {
      const j = s0 + i;
      if (j >= y.length) break;
      const v = bq.run(white()) * Math.sin((Math.PI * i) / gl) * amp;
      if (yR) { y[j] += v * (1 - pan); yR[j] += v * pan; } else y[j] += v;
    }
  }
}

type DrumKind = 'dum' | 'tek' | 'ka' | 'taiko' | 'boom';

/** Cheap tanh-like soft saturation (Padé), for baking. */
const sat = (x: number): number => {
  const c = x < -3 ? -3 : x > 3 ? 3 : x;
  return (c * (27 + c * c)) / (27 + 9 * c * c);
};

/** Per-sample multiplier giving exp(-t/tau) decay (cheap envelopes for baking). */
const dk = (tau: number, sr: number): number => Math.exp(-1 / (tau * sr));

function bakeDrum(ctx: BaseAudioContext, kind: DrumKind): AudioBuffer {
  switch (kind) {
    case 'dum': { // frame drum (tof) low stroke
      const f0 = rand(62, 74), sw = rand(45, 65), dec = rand(0.18, 0.26), sl = rand(900, 1400);
      return bake(ctx, 0.75, 1, (d, sr, len) => {
        const y = d[0]; const nl = new BQ('lp', sl, 0.7, sr);
        const kS = dk(0.026, sr), kB = dk(dec, sr), k2 = dk(0.06, sr), kN = dk(0.012, sr), kA = dk(0.0012, sr);
        let eS = 1, eB = 1, e2 = 1, eN = 1, eA = 1, p1 = 0, p2 = 0;
        for (let i = 0; i < len; i++) {
          const f = f0 + sw * eS;
          p1 += (TAU * f) / sr; p2 += (TAU * f * 1.58) / sr;
          const v = Math.sin(p1) * eB + 0.3 * Math.sin(p2) * e2 + nl.run(white()) * 1.6 * eN;
          y[i] = sat(1.5 * v * (1 - eA));
          eS *= kS; eB *= kB; e2 *= k2; eN *= kN; eA *= kA;
        }
      });
    }
    case 'tek': // rim stroke
    case 'ka': { // soft ghost stroke
      const tek = kind === 'tek';
      const fb = tek ? rand(2600, 3600) : rand(1800, 2500), fr = tek ? rand(400, 470) : rand(320, 380);
      return bake(ctx, tek ? 0.25 : 0.18, 1, (d, sr, len) => {
        const y = d[0]; const bp = new BQ('bp', fb, tek ? 1.3 : 1.0, sr); const hp = new BQ('hp', tek ? 250 : 200, 0.7, sr);
        const kN = dk(tek ? 0.018 : 0.011, sr), k1 = dk(tek ? 0.035 : 0.02, sr), k2 = dk(0.02, sr), kA = dk(tek ? 0.0004 : 0.0005, sr);
        let eN = 1, e1 = 1, e2 = 1, eA = 1;
        const w1 = (TAU * fr) / sr, w2 = (TAU * fr * 2.72) / sr;
        for (let i = 0; i < len; i++) {
          const v = bp.run(white()) * (tek ? 2.6 : 2) * eN + (tek ? 0.45 : 0.3) * Math.sin(w1 * i) * e1
            + (tek ? 0.2 * Math.sin(w2 * i) * e2 : 0);
          y[i] = hp.run(v * (1 - eA));
          eN *= kN; e1 *= k1; e2 *= k2; eA *= kA;
        }
      });
    }
    case 'taiko': { // big drum: pitched membrane modes + shell resonance + stick
      const f0 = rand(58, 66), sw = rand(60, 90), dec = rand(0.36, 0.48);
      return bake(ctx, 1.8, 1, (d, sr, len) => {
        const y = d[0]; const th = new BQ('lp', 420, 0.8, sr); const st = new BQ('bp', 1800, 0.9, sr);
        const shell = new BQ('bp', rand(230, 290), 2.5, sr);
        const kS = dk(0.035, sr), kB = dk(dec, sr), k2 = dk(0.2, sr), k3 = dk(0.1, sr), kT = dk(0.035, sr), kK = dk(0.005, sr),
          kH = dk(0.07, sr), kA = dk(0.0018, sr);
        let eS = 1, eB = 1, e2 = 1, e3 = 1, eT = 1, eK = 1, eH = 1, eA = 1, p1 = 0, p2 = 0, p3 = 0;
        for (let i = 0; i < len; i++) {
          const w = (TAU * (f0 + sw * eS)) / sr;
          p1 += w; p2 += w * 1.51; p3 += w * 2.28;
          const n = white();
          const v = Math.sin(p1) * eB + 0.45 * Math.sin(p2) * e2 + 0.22 * Math.sin(p3) * e3
            + th.run(n) * 3 * eT + st.run(n) * 0.6 * eK + shell.run(n) * 4 * eH;
          y[i] = sat(1.7 * v * (1 - eA));
          eS *= kS; eB *= kB; e2 *= k2; e3 *= k3; eT *= kT; eK *= kK; eH *= kH; eA *= kA;
        }
      }, 0.95, 24000);
    }
    case 'boom': { // cinematic sub impact
      return bake(ctx, 3.6, 1, (d, sr, len) => {
        const y = d[0];
        const l1 = new BQ('lp', 160, 0.7, sr), l2 = new BQ('lp', 160, 0.7, sr), hp = new BQ('hp', 700, 0.7, sr);
        const kS = dk(0.14, sr), kB = dk(1.0, sr), kR = dk(0.6, sr), kC = dk(0.02, sr), kA = dk(0.003, sr);
        let eS = 1, eB = 1, eR = 1, eC = 1, eA = 1, p = 0;
        for (let i = 0; i < len; i++) {
          p += (TAU * (27 + 58 * eS)) / sr;
          const n = white();
          const v = Math.sin(p) * eB + l2.run(l1.run(n)) * 7 * eR + hp.run(n) * 0.5 * eC;
          y[i] = sat(1.3 * v * (1 - eA));
          eS *= kS; eB *= kB; eR *= kR; eC *= kC; eA *= kA;
        }
      }, 0.95, 24000);
    }
  }
}

function bakeStep(ctx: BaseAudioContext, run: boolean): AudioBuffer {
  return bake(ctx, run ? 0.36 : 0.3, 1, (d, sr, len) => {
    const y = d[0];
    const thud = new BQ('lp', rand(120, 200) * (run ? 1.25 : 1), 0.9, sr);
    const hiss = new BQ('bp', rand(1800, 3200), 0.6, sr);
    const tt = run ? 0.026 : 0.038;
    const th = run ? rand(0.05, 0.08) : rand(0.035, 0.055);
    const kA = dk(0.0025, sr), kT = dk(tt, sr), kH = dk(th, sr);
    let eA = 1, eT = 1, eH = 1;
    const ha = run ? 0.7 : 0.45;
    for (let i = 0; i < len; i++) {
      y[i] = (thud.run(white()) * 9 * eT + hiss.run(white()) * ha * eH) * (1 - eA);
      eA *= kA; eT *= kT; eH *= kH;
    }
    addGrains(y, sr, run ? randi(16, 28) : randi(8, 15), 0.002, run ? 0.1 : 0.07, 1200, run ? 6500 : 5000,
      0.25, 0.9, 0.0012, 0.006, run ? 0.07 : 0.05);
    if (run) { // short scuff as the foot pushes off
      const sc = new BQ('bp', rand(1200, 2000), 0.8, sr);
      const s0 = Math.floor(0.03 * sr), s1 = Math.min(len, Math.floor(0.22 * sr));
      for (let i = s0; i < s1; i++) y[i] += sc.run(white()) * 0.5 * Math.sin((Math.PI * (i - s0)) / (s1 - s0));
    }
    const hp = new BQ('hp', 45, 0.7, sr);
    for (let i = 0; i < len; i++) y[i] = hp.run(y[i]);
  }, run ? 0.9 : 0.8);
}

function bakeSkid(ctx: BaseAudioContext): AudioBuffer {
  return bake(ctx, 0.5, 1, (d, sr, len) => {
    const y = d[0];
    const bp = new BQ('bp', rand(1100, 1700), 0.7, sr);
    const lp = new BQ('lp', 250, 0.8, sr);
    const kA = dk(0.02, sr), kD = dk(0.14, sr);
    let eA = 1, eD = 1, jit = 1;
    for (let i = 0; i < len; i++) {
      if (i % 256 === 0) jit = rand(0.6, 1);
      y[i] = (bp.run(white()) * 0.9 + lp.run(white()) * 4) * (1 - eA) * eD * jit;
      eA *= kA; eD *= kD;
    }
    addGrains(y, sr, randi(25, 40), 0.0, 0.3, 1500, 6000, 0.15, 0.6, 0.001, 0.005, 0.2);
  }, 0.85);
}

function bakeGravel(ctx: BaseAudioContext): AudioBuffer {
  return bake(ctx, 0.5, 1, (d, sr) => {
    addGrains(d[0], sr, randi(6, 12), 0.0, 0.35, 2000, 7000, 0.2, 0.8, 0.0008, 0.004, 0.2);
  }, 0.8);
}

function bakeJar(ctx: BaseAudioContext): AudioBuffer {
  return bake(ctx, 1.5, 2, (d, sr, len) => {
    const [L, R] = d;
    // initial crack + the jar's hollow body
    const bp = new BQ('bp', rand(2000, 3000), 0.7, sr); const lb = new BQ('lp', 900, 0.7, sr);
    const fb = rand(260, 420);
    const n0 = Math.min(len, Math.floor(0.3 * sr));
    const k1 = dk(0.012, sr), k2 = dk(0.03, sr), k3 = dk(0.045, sr), k4 = dk(0.02, sr), kA = dk(0.0007, sr);
    let e1 = 1, e2 = 1, e3 = 1, e4 = 1, eA = 1;
    const w1 = (TAU * fb) / sr, w2 = (TAU * fb * 2.37) / sr;
    for (let i = 0; i < n0; i++) {
      const n = white();
      const v = (bp.run(n) * 1.6 * e1 + lb.run(n) * 2 * e2 + Math.sin(w1 * i) * 0.5 * e3 + Math.sin(w2 * i) * 0.25 * e4) * (1 - eA);
      L[i] += v; R[i] += v;
      e1 *= k1; e2 *= k2; e3 *= k3; e4 *= k4; eA *= kA;
    }
    // fragments: inharmonic clay "tinks", clustered at impact then bouncing out.
    // Each mode is a damped-sine resonator recurrence (no per-sample transcendental).
    const count = randi(16, 28);
    const ratios = [1, 1.58, 2.41], rel = [1, 0.6, 0.4], amps = [1, 0.6, 0.35];
    for (let k = 0; k < count; k++) {
      const tk = k < 7 ? rand(0.002, 0.05) : 0.05 + Math.pow(Math.random(), 1.7) * 0.9;
      const size = Math.random();
      const f = lerp(1600, 7000, size) * rand(0.9, 1.1);
      const tau = lerp(0.03, 0.008, size);
      const amp = rand(0.15, 0.5) * (tk < 0.05 ? 1 : lerp(0.8, 0.25, tk / 0.95));
      const pan = rand(-0.8, 0.8);
      const gl = Math.cos(((pan + 1) * Math.PI) / 4) * amp, gr = Math.sin(((pan + 1) * Math.PI) / 4) * amp;
      const s0 = Math.floor(tk * sr), n = Math.min(len - s0, Math.floor(tau * 7 * sr));
      if (n <= 2) continue;
      const tmp = new Float32Array(n);
      for (let m = 0; m < 3; m++) {
        const w = (TAU * f * ratios[m]) / sr;
        if (w >= Math.PI) continue;
        const r = Math.exp(-1 / (tau * rel[m] * sr));
        const c1 = 2 * r * Math.cos(w), c2 = r * r, ph = Math.random() * TAU;
        let y1 = Math.sin(ph - w) / r, y2 = Math.sin(ph - 2 * w) / (r * r); // y[-1], y[-2] of r^n sin(wn+ph)
        for (let i = 0; i < n; i++) {
          const yv = c1 * y1 - c2 * y2;
          y2 = y1; y1 = yv;
          tmp[i] += yv * amps[m];
        }
      }
      const kA = dk(0.0004, sr);
      let eA = 1;
      const nc = Math.floor(0.001 * sr);
      for (let i = 0; i < n; i++) {
        let v = tmp[i] * (1 - eA);
        if (i < nc) v += white() * 0.8;
        L[s0 + i] += v * gl; R[s0 + i] += v * gr;
        eA *= kA;
      }
    }
    // dust
    const dl = new BQ('lp', 2500, 0.5, sr), dr = new BQ('lp', 2500, 0.5, sr);
    const kD = dk(0.25, sr), kDa = dk(0.01, sr);
    let eD = 0.07, eDa = 1;
    for (let i = 0; i < len; i++) {
      const e = eD * (1 - eDa);
      L[i] += dl.run(white()) * e * 3; R[i] += dr.run(white()) * e * 3;
      eD *= kD; eDa *= kDa;
    }
  }, 0.9);
}

function bakeRustle(ctx: BaseAudioContext): AudioBuffer {
  return bake(ctx, 0.55, 1, (d, sr, len) => {
    const y = d[0];
    const env = new Float32Array(len);
    const bursts = randi(14, 26);
    for (let k = 0; k < bursts; k++) {
      const s0 = Math.floor(Math.pow(Math.random(), 1.3) * 0.42 * sr);
      const bl = Math.floor(rand(0.012, 0.05) * sr);
      const a = rand(0.3, 1);
      for (let i = 0; i < bl && s0 + i < len; i++) env[s0 + i] += a * Math.sin((Math.PI * i) / bl);
    }
    const bp = new BQ('bp', rand(2200, 3800), 0.6, sr), lo = new BQ('bp', 600, 0.8, sr);
    for (let i = 0; i < len; i++) y[i] = (bp.run(white()) + 0.5 * lo.run(white())) * env[i];
  }, 0.8);
}

interface KSNote { buf: AudioBuffer; rate: number; }

/**
 * Karplus-Strong plucked gut string with a wooden body (the kinnor). Baked at 24 kHz to save
 * memory; tuning is corrected exactly through the playback rate.
 */
function bakeKS(ctx: BaseAudioContext, midi: number, bright: number): KSNote {
  const sr = 24000;
  const f = mtof(midi);
  const g = 0.5 - 0.2 * bright; // loop lowpass blend (0.5 = darkest)
  const N = Math.max(4, Math.floor(sr / f - g));
  const rate = (f * (N + g)) / sr;
  const t60 = clamp(3.3 - (midi - 45) * 0.07, 1.0, 3.3);
  const rho = Math.pow(10, -3 / (f * t60));
  const buf = bake(ctx, Math.min(t60 + 0.1, 2.8), 1, (d, srr, len) => {
    const y = d[0];
    const exc = new Float32Array(N);
    let lp = 0;
    const k = lerp(0.3, 0.85, bright);
    for (let i = 0; i < N; i++) { lp += k * (white() - lp); exc[i] = lp; }
    const P = Math.max(1, Math.round(N * rand(0.12, 0.24))); // pluck position comb
    for (let i = N - 1; i >= P; i--) exc[i] -= exc[i - P];
    let mean = 0;
    for (let i = 0; i < N; i++) mean += exc[i];
    mean /= N;
    for (let i = 0; i < N; i++) exc[i] -= mean;
    for (let n = 0; n < len; n++) {
      y[n] = n < N ? exc[n] : rho * ((1 - g) * y[n - N] + g * (n - N - 1 >= 0 ? y[n - N - 1] : 0));
    }
    const cb = new BQ('bp', 3000, 0.8, srr); // plectrum click
    const cl = Math.floor(0.004 * srr);
    for (let n = 0; n < cl; n++) y[n] += cb.run(white()) * 0.3 * bright * (1 - n / cl);
    const b1 = new BQ('hp', 70, 0.7, srr), b2 = new BQ('peak', 240, 1.1, srr, 4), b3 = new BQ('peak', 900, 1.5, srr, 1.5);
    const b4 = new BQ('peak', 2800, 1.3, srr, 3 * bright), b5 = new BQ('lp', lerp(3500, 7500, bright), 0.6, srr);
    for (let n = 0; n < len; n++) y[n] = b5.run(b4.run(b3.run(b2.run(b1.run(y[n])))));
    // loudness-normalise on the first 250 ms (peak-normalising makes low strings boom)
    const w = Math.min(len, Math.floor(0.25 * srr));
    let ss = 0, pk = 0;
    for (let n = 0; n < w; n++) ss += y[n] * y[n];
    for (let n = 0; n < len; n++) pk = Math.max(pk, Math.abs(y[n]));
    const gn = Math.min(0.2 / Math.sqrt(ss / w || 1), 0.95 / (pk || 1));
    const fi = Math.floor(0.0012 * srr); // ~1 ms fade-in: a pluck, not a digital click
    for (let n = 0; n < len; n++) y[n] *= n < fi ? (gn * n) / fi : gn;
  }, 0, sr);
  return { buf, rate };
}

type BankName = DrumKind | 'stepWalk' | 'stepRun' | 'skid' | 'gravel' | 'jar' | 'rustle';
const BANKS: Record<BankName, { n: number; make: (ctx: BaseAudioContext) => AudioBuffer }> = {
  dum: { n: 3, make: (c) => bakeDrum(c, 'dum') },
  tek: { n: 3, make: (c) => bakeDrum(c, 'tek') },
  ka: { n: 3, make: (c) => bakeDrum(c, 'ka') },
  taiko: { n: 3, make: (c) => bakeDrum(c, 'taiko') },
  boom: { n: 2, make: (c) => bakeDrum(c, 'boom') },
  stepWalk: { n: 6, make: (c) => bakeStep(c, false) },
  stepRun: { n: 6, make: (c) => bakeStep(c, true) },
  skid: { n: 3, make: bakeSkid },
  gravel: { n: 3, make: bakeGravel },
  jar: { n: 3, make: bakeJar },
  rustle: { n: 3, make: bakeRustle },
};

// ============================================================================
// Core: context, master chain, shared buffers, node garbage collection
// ============================================================================

class Core {
  readonly sr: number;
  readonly musicIn: GainNode;
  readonly musicDuck: GainNode;
  readonly worldIn: GainNode;
  readonly sfxWorld: GainNode;
  readonly uiIn: GainNode;
  readonly slowFilter: BiquadFilterNode;
  readonly slowVerb: GainNode;
  readonly hallIn: GainNode;
  readonly echoIn: GainNode;
  readonly master: GainNode;
  readonly mute: GainNode;
  readonly out: AudioNode;
  readonly noise: Record<NoiseKind, AudioBuffer>;
  slowPitch = 1;

  private garbage: Array<{ t: number; nodes: AudioNode[] }> = [];
  private readonly banks = new Map<BankName, AudioBuffer[]>();
  private readonly warmQueue: BankName[] = ['stepWalk', 'dum', 'tek', 'ka', 'taiko', 'stepRun', 'gravel', 'boom', 'jar', 'rustle', 'skid'];
  private readonly conv: ConvolverNode;
  private readonly sum: GainNode;
  private readonly echoRet: GainNode;
  private readonly echoVerb: GainNode;
  private echoLive = false;
  private echoUntil = 0;
  private readonly ksCache = new Map<number, KSNote>();
  /** Lyre strings to pre-bake (midi*2 + tier), most common first. */
  private readonly ksQueue: number[] = [];
  private readonly curves = new Map<string, Curve>();
  private readonly waves = new Map<string, PeriodicWave>();

  constructor(readonly ctx: BaseAudioContext) {
    this.sr = ctx.sampleRate;
    for (let m = 43; m <= 84; m++) this.ksQueue.push(m * 2);
    for (let m = 57; m <= 81; m++) this.ksQueue.push(m * 2 + 1);
    const g = (v: number): GainNode => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const bq = (type: BiquadFilterType, f: number, q = 0.707): BiquadFilterNode => {
      const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = this.hz(f); b.Q.value = q; return b;
    };
    this.noise = {
      white: bakeNoise(ctx, 'white', 2.5, 1),
      pink: bakeNoise(ctx, 'pink', 4, 2),
      brown: bakeNoise(ctx, 'brown', 4, 2),
    };

    // --- master chain -------------------------------------------------------
    const sum = g(1);
    const hp = bq('highpass', 32, 0.7);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -12; glue.knee.value = 12; glue.ratio.value = 1.6; glue.attack.value = 0.02; glue.release.value = 0.3;
    this.master = g(0.8);
    this.mute = g(1);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 1; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    const clipIn = g(0.5);
    const clip = ctx.createWaveShaper();
    clip.curve = this.curve('softclip', 1);
    sum.connect(hp); hp.connect(glue); glue.connect(this.master); this.master.connect(this.mute); this.mute.connect(lim);
    lim.connect(clipIn); clipIn.connect(clip); clip.connect(ctx.destination);
    this.out = clip;

    // --- buses ----------------------------------------------------------------
    this.musicIn = g(0.68);
    this.musicDuck = g(1);
    this.musicIn.connect(this.musicDuck); this.musicDuck.connect(sum);
    this.worldIn = g(1);
    this.slowFilter = bq('lowpass', 18000, 0.7);
    this.worldIn.connect(this.slowFilter); this.slowFilter.connect(sum);
    this.sfxWorld = g(1);
    this.sfxWorld.connect(this.worldIn);
    this.uiIn = g(1);
    this.uiIn.connect(sum);

    // --- hall reverb ------------------------------------------------------------
    this.hallIn = g(1);
    const hhp = bq('highpass', 180);
    const conv = ctx.createConvolver();
    this.conv = conv; // impulse is baked on the first warm() tick to keep init() short
    const hlp = bq('lowpass', 7000);
    const hret = g(1.25);
    this.hallIn.connect(hhp); hhp.connect(conv); conv.connect(hlp); hlp.connect(hret); hret.connect(sum);
    this.slowVerb = g(0);
    this.worldIn.connect(this.slowVerb); this.slowVerb.connect(this.hallIn);

    // --- ping-pong valley echo --------------------------------------------------
    this.echoIn = g(1);
    this.echoIn.channelCount = 1; this.echoIn.channelCountMode = 'explicit';
    const ehp = bq('highpass', 300), elp = bq('lowpass', 2800);
    const dL = ctx.createDelay(2), dR = ctx.createDelay(2);
    dL.delayTime.value = 0.37; dR.delayTime.value = 0.53;
    const dampL = bq('lowpass', 2200), dampR = bq('lowpass', 2000);
    const fbL = g(0.33), fbR = g(0.33);
    this.echoIn.connect(ehp); ehp.connect(elp); elp.connect(dL);
    dL.connect(dampL); dampL.connect(fbL); fbL.connect(dR);
    dR.connect(dampR); dampR.connect(fbR); fbR.connect(dL);
    const mg = ctx.createChannelMerger(2);
    dL.connect(mg, 0, 0); dR.connect(mg, 0, 1);
    this.echoRet = g(0.5); this.echoVerb = g(0.25);
    mg.connect(this.echoRet); mg.connect(this.echoVerb);
    this.sum = sum; // echo outputs are connected on demand (see echoSend) so the idle loop costs nothing
  }

  /** Input of the valley echo; wakes the echo loop for the next few seconds. */
  echoSend(): AudioNode {
    if (!this.echoLive) {
      this.echoRet.connect(this.sum); this.echoVerb.connect(this.hallIn);
      this.echoLive = true;
    }
    this.echoUntil = this.ctx.currentTime + 10;
    return this.echoIn;
  }

  hz(f: number): number { return clamp(f, 5, this.sr * 0.45); }

  /** Number of live one-shot voices (rough CPU load indicator). */
  load(): number { return this.garbage.length; }

  retire(nodes: AudioNode[], t: number): void { this.garbage.push({ t, nodes }); }

  sweep(now: number): void {
    if (this.echoLive && now > this.echoUntil) {
      this.echoRet.disconnect(); this.echoVerb.disconnect();
      this.echoLive = false;
    }
    if (!this.garbage.length) return;
    const keep: Array<{ t: number; nodes: AudioNode[] }> = [];
    for (const e of this.garbage) {
      if (e.t < now) {
        for (const n of e.nodes) { try { n.disconnect(); } catch { /* already gone */ } }
      } else keep.push(e);
    }
    this.garbage = keep;
  }

  /** Variants of a baked one-shot. A cold bank bakes a single variant now; warm() fills in the rest. */
  bank(name: BankName): AudioBuffer[] {
    let b = this.banks.get(name);
    if (!b) { b = []; this.banks.set(name, b); }
    if (!b.length) b.push(BANKS[name].make(this.ctx));
    return b;
  }

  /** Bake one pending buffer per call (spreads the init cost over frames). */
  warm(): void {
    if (!this.conv.buffer) { this.conv.buffer = bakeImpulse(this.ctx, 3.0, 0.025); return; }
    for (const name of this.warmQueue) {
      let b = this.banks.get(name);
      if (!b) { b = []; this.banks.set(name, b); }
      if (b.length < BANKS[name].n) { b.push(BANKS[name].make(this.ctx)); return; }
    }
    const k = this.ksQueue.shift();
    if (k !== undefined) this.ks(k >> 1, k & 1);
  }

  ks(midi: number, tier: number): KSNote {
    const m = Math.round(clamp(midi, 28, 100));
    const key = m * 2 + (tier ? 1 : 0);
    let k = this.ksCache.get(key);
    if (!k) { k = bakeKS(this.ctx, m, tier ? 0.8 : 0.3); this.ksCache.set(key, k); }
    return k;
  }

  curve(kind: 'drive' | 'pulse' | 'softclip', amt: number): Curve {
    const key = kind + amt;
    let c = this.curves.get(key);
    if (!c) {
      const n = 2048;
      c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        if (kind === 'drive') c[i] = Math.tanh(amt * x) / Math.tanh(amt);
        else if (kind === 'pulse') c[i] = Math.pow((x + 1) / 2, amt);
        else {
          // input is pre-scaled by 0.5, so x=±1 means ±2.0 full scale; linear to 0.8, then soft knee to 0.98
          const u = Math.abs(x * 2);
          c[i] = Math.sign(x) * (u <= 0.8 ? u : 0.8 + 0.18 * Math.tanh((u - 0.8) / 0.18));
        }
      }
      this.curves.set(key, c);
    }
    return c;
  }

  wave(kind: 'pulse' | 'ney'): PeriodicWave {
    let w = this.waves.get(kind);
    if (!w) {
      const n = 48;
      const re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        if (kind === 'pulse') re[k] = (2 * Math.sin(k * Math.PI * 0.22)) / (k * Math.PI);
        else im[k] = k === 1 ? 1 : k === 2 ? 0.3 : k === 3 ? 0.12 : k === 4 ? 0.05 : 0;
      }
      w = this.ctx.createPeriodicWave(re, im);
      this.waves.set(kind, w);
    }
    return w;
  }

  dispose(): void {
    this.sweep(Infinity);
  }
}

// ============================================================================
// Voice: a bag of short-lived nodes started/stopped together and auto-disconnected
// ============================================================================

class Voice {
  readonly nodes: AudioNode[] = [];
  private readonly starts: Array<(t0: number) => void> = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];
  constructor(readonly c: Core) {}

  private reg<T extends AudioNode>(n: T): T { this.nodes.push(n); return n; }
  private src(s: AudioScheduledSourceNode, at?: number): void {
    this.srcs.push(s);
    this.starts.push((t0) => s.start(Math.max(0, at ?? t0)));
  }

  gain(v = 1): GainNode {
    const g = this.c.ctx.createGain(); g.gain.value = v; return this.reg(g);
  }
  filter(type: BiquadFilterType, f: number, q = 0.707, db = 0): BiquadFilterNode {
    const b = this.c.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = this.c.hz(f); b.Q.value = q;
    if (db) b.gain.value = db;
    return this.reg(b);
  }
  osc(type: OscillatorType, f: number, detune = 0, at?: number): OscillatorNode {
    const o = this.c.ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    this.src(o, at);
    return this.reg(o);
  }
  wave(w: PeriodicWave, f: number, detune = 0, at?: number): OscillatorNode {
    const o = this.c.ctx.createOscillator();
    o.setPeriodicWave(w); o.frequency.value = f; o.detune.value = detune;
    this.src(o, at);
    return this.reg(o);
  }
  constant(v: number, at?: number): ConstantSourceNode {
    const s = this.c.ctx.createConstantSource(); s.offset.value = v; this.src(s, at); return this.reg(s);
  }
  noise(kind: NoiseKind = 'white', at?: number): AudioBufferSourceNode {
    const s = this.c.ctx.createBufferSource();
    const b = this.c.noise[kind];
    s.buffer = b; s.loop = true;
    const off = Math.random() * Math.max(0, b.duration - 0.5);
    this.srcs.push(s);
    this.starts.push((t0) => s.start(Math.max(0, at ?? t0), off));
    return this.reg(s);
  }
  buffer(b: AudioBuffer, rate = 1, at?: number): AudioBufferSourceNode {
    const s = this.c.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    this.src(s, at);
    return this.reg(s);
  }
  pan(p: number): AudioNode {
    const ctx = this.c.ctx;
    if (typeof ctx.createStereoPanner === 'function') {
      const s = ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return this.reg(s);
    }
    return this.gain(1);
  }
  shaper(curve: Curve): WaveShaperNode {
    const w = this.c.ctx.createWaveShaper(); w.curve = curve; return this.reg(w);
  }
  merger(): ChannelMergerNode { return this.reg(this.c.ctx.createChannelMerger(2)); }

  /** Start every source (at its own time or t0), stop all at t1 and schedule disconnection. */
  play(t0: number, t1: number): void {
    const end = Number.isFinite(t1) ? Math.max(t0 + 0.01, t1) : t0 + 5; // never leave a source running
    for (const st of this.starts) st(t0);
    for (const s of this.srcs) s.stop(end);
    this.c.retire(this.nodes, end + 0.1);
  }
}

// ============================================================================
// Instruments
// ============================================================================

interface Out { dry: AudioNode; wet: AudioNode | null; }
/** Per-kind loudness trims so drum velocities are comparable. */
const DRUM_GAIN: Record<DrumKind, number> = { dum: 0.55, tek: 1.6, ka: 1.4, taiko: 0.55, boom: 1 };
function connectOut(n: AudioNode, o: Out): void {
  n.connect(o.dry);
  if (o.wet) n.connect(o.wet);
}

interface PadOpts {
  level: number; attack: number; release: number; cutoff: number; cutoffEnd?: number; q?: number;
  detune?: number; voices?: number; type?: OscillatorType; lfoCents?: number; trem?: number; tremRate?: number;
}
interface ChoirOpts { level: number; attack: number; release: number; vowel: Vowel; to?: Vowel; morph?: number; breath?: number; }
type ShofarCall = 'tekiah' | 'gedolah' | 'shevarim' | 'teruah';
interface NeyNote { midi: number; dur: number; } // midi < 0 = breath rest

class Synth {
  constructor(private readonly c: Core) {}

  /** Kinnor pluck. `damp` > 0 mutes the string after that many seconds. */
  lyre(out: Out, t: number, midi: number, vel: number, pan = 0, damp = 0): void {
    const ks = this.c.ks(midi, vel > 0.6 ? 1 : 0);
    const v = new Voice(this.c);
    const rate = ks.rate * (1 + rand(-0.0025, 0.0025));
    const src = v.buffer(ks.buf, rate);
    const amp = clamp(vel, 0, 1.5) * 0.8;
    const g = v.gain(amp);
    const p = v.pan(pan);
    src.connect(g); g.connect(p); connectOut(p, out);
    let end = t + ks.buf.duration / rate;
    if (damp > 0 && t + damp < end) {
      g.gain.setValueAtTime(amp, t + damp);
      g.gain.setTargetAtTime(0, t + damp, 0.06);
      end = t + damp + 0.45;
    }
    v.play(t, end);
  }

  strum(out: Out, t: number, notes: readonly number[], vel: number, spread = 0.032): void {
    notes.forEach((m, i) => this.lyre(out, t + i * spread * rand(0.8, 1.2), m, vel * (1 - i * 0.06), lyrePan(m)));
  }

  /** Detuned-saw string / drone pad through a slowly breathing lowpass. */
  pad(out: Out, t: number, dur: number, midis: readonly number[], o: PadOpts): void {
    if (!midis.length) return;
    const v = new Voice(this.c);
    const n = o.voices ?? 3, det = o.detune ?? 9;
    const L = v.gain(), R = v.gain();
    let k = 0;
    for (const m of midis) {
      for (let i = 0; i < n; i++) {
        const d = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * det + rand(-2, 2);
        const osc = v.osc(o.type ?? 'sawtooth', mtof(m), d, t + rand(0, 0.03));
        osc.connect(k++ % 2 === 0 ? L : R);
      }
    }
    L.gain.value = R.gain.value = 2 / Math.sqrt(k);
    const mg = v.merger();
    L.connect(mg, 0, 0); R.connect(mg, 0, 1);
    const f = v.filter('lowpass', o.cutoff, o.q ?? 0.8);
    mg.connect(f);
    f.frequency.setValueAtTime(this.c.hz(o.cutoff * 0.55), t);
    f.frequency.linearRampToValueAtTime(this.c.hz(o.cutoff), t + o.attack);
    if (o.cutoffEnd) f.frequency.linearRampToValueAtTime(this.c.hz(o.cutoffEnd), t + dur);
    const lfo = v.osc('sine', rand(0.06, 0.14), 0, t);
    const lg = v.gain(o.lfoCents ?? 250);
    lfo.connect(lg); lg.connect(f.detune);
    let last: AudioNode = f;
    if (o.trem) {
      const tg = v.gain(1 - o.trem / 2);
      const tl = v.osc('sine', o.tremRate ?? 6, 0, t);
      const td = v.gain(o.trem / 2);
      tl.connect(td); td.connect(tg.gain); f.connect(tg);
      last = tg;
    }
    const env = v.gain(0);
    last.connect(env);
    const relStart = t + Math.max(o.attack, dur - o.release);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(o.level, t + o.attack);
    env.gain.setValueAtTime(o.level, relStart);
    env.gain.setTargetAtTime(0, relStart, o.release / 5);
    connectOut(env, out);
    v.play(t, relStart + o.release * 1.4);
  }

  /** "Aah" choir: detuned saws with delayed vibrato through a parallel formant bank. */
  choir(out: Out, t: number, dur: number, midis: readonly number[], o: ChoirOpts): void {
    if (!midis.length) return;
    const v = new Voice(this.c);
    const L = v.gain(), R = v.gain();
    const vib1 = v.osc('sine', rand(4.8, 5.4), 0, t), vib2 = v.osc('sine', rand(5.5, 6.1), 0, t);
    const vd1 = v.gain(0), vd2 = v.gain(0);
    vib1.connect(vd1); vib2.connect(vd2);
    for (const vd of [vd1, vd2]) {
      vd.gain.setValueAtTime(0, t);
      vd.gain.linearRampToValueAtTime(rand(9, 14), t + Math.min(1.4, o.attack + 0.5));
    }
    let k = 0;
    for (const m of midis) {
      for (let i = 0; i < 2; i++) {
        const osc = v.osc('sawtooth', mtof(m), (i ? 1 : -1) * 7 + rand(-3, 3), t + rand(0, 0.04));
        (k % 2 ? vd2 : vd1).connect(osc.detune);
        osc.connect(k % 2 ? R : L);
        k++;
      }
    }
    L.gain.value = R.gain.value = 1.2 / Math.sqrt(k);
    const mg = v.merger();
    L.connect(mg, 0, 0); R.connect(mg, 0, 1);
    const pre = v.gain(1);
    mg.connect(pre);
    const br = o.breath ?? 0.12;
    if (br > 0) {
      const nz = v.noise('white', t); const nh = v.filter('highpass', 900, 0.5); const ng = v.gain(br);
      nz.connect(nh); nh.connect(ng); ng.connect(pre);
    }
    const F = VOWELS[o.vowel];
    const F2 = o.to ? VOWELS[o.to] : null;
    const mix = v.gain(1);
    const qs = [5, 7, 9], gs = [1, 0.55, 0.28];
    for (let i = 0; i < 3; i++) {
      const bp = v.filter('bandpass', F[i], qs[i]);
      if (F2) {
        bp.frequency.setValueAtTime(F[i], t);
        bp.frequency.linearRampToValueAtTime(F2[i], t + (o.morph ?? o.attack));
      }
      const g = v.gain(gs[i] * 6);
      pre.connect(bp); bp.connect(g); g.connect(mix);
    }
    const body = v.filter('lowpass', 480, 0.7); const bg = v.gain(0.9);
    pre.connect(body); body.connect(bg); bg.connect(mix);
    const env = v.gain(0);
    mix.connect(env);
    const relStart = t + Math.max(o.attack, dur - o.release);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(o.level, t + o.attack);
    env.gain.setValueAtTime(o.level, relStart);
    env.gain.setTargetAtTime(0, relStart, o.release / 5);
    connectOut(env, out);
    v.play(t, relStart + o.release * 1.4);
  }

  /** Short bowed low-string note (spiccato ostinato). */
  strStac(out: Out, t: number, midi: number, vel: number, len = 0.2, bright = 1): void {
    const v = new Voice(this.c);
    const f = mtof(midi);
    const o1 = v.osc('sawtooth', f, -8, t), o2 = v.osc('sawtooth', f, 8, t);
    const low = f / 2 >= 55;
    const o3 = v.osc('sawtooth', low ? f / 2 : f * 2, low ? 0 : 5, t);
    const sub = v.gain(low ? 0.45 : 0.25);
    o3.connect(sub);
    const lp = v.filter('lowpass', 800, 1.2);
    o1.connect(lp); o2.connect(lp); sub.connect(lp);
    lp.frequency.setValueAtTime(this.c.hz(400 + 2600 * vel * bright), t);
    lp.frequency.setTargetAtTime(350 + 500 * bright, t + 0.01, len * 0.5);
    const env = v.gain(0);
    lp.connect(env);
    const pk = vel * 0.22;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(pk, t + 0.012);
    env.gain.setTargetAtTime(pk * 0.5, t + 0.012, len * 0.4);
    env.gain.setTargetAtTime(0, t + len, 0.05);
    const p = v.pan(rand(-0.2, 0.2));
    env.connect(p); connectOut(p, out);
    v.play(t, t + len + 0.4);
  }

  drum(out: Out, t: number, kind: DrumKind, vel: number, pan = 0, rate = 1): void {
    const b = pick(this.c.bank(kind));
    const v = new Voice(this.c);
    const r = rate * rand(0.985, 1.015);
    const s = v.buffer(b, r);
    const g = v.gain(vel * DRUM_GAIN[kind]);
    const p = v.pan(pan);
    s.connect(g); g.connect(p); connectOut(p, out);
    v.play(t, t + b.duration / r + 0.02);
  }

  /** Shofar (ram's horn): raw brassy buzz with the upward scoop and the leap to the upper partial. */
  shofar(out: Out, t: number, call: ShofarCall, level: number, low = 220, high = 293.66): number {
    const notes: Array<{ s: number; d: number; leap: boolean }> = [];
    switch (call) {
      case 'tekiah': notes.push({ s: 0, d: rand(1.6, 2.0), leap: true }); break;
      case 'gedolah': notes.push({ s: 0, d: rand(3.6, 4.2), leap: true }); break;
      case 'shevarim': for (let i = 0; i < 3; i++) notes.push({ s: i * 0.62, d: 0.48, leap: true }); break;
      case 'teruah': for (let i = 0; i < 9; i++) notes.push({ s: i * 0.15, d: i === 8 ? 0.6 : 0.1, leap: i === 8 }); break;
    }
    const v = new Voice(this.c);
    const f = v.constant(low, t);
    const o1 = v.osc('sawtooth', 0, 0, t), o2 = v.osc('square', 0, 6, t);
    f.connect(o1.frequency); f.connect(o2.frequency);
    const wob = v.osc('sine', rand(4.5, 6), 0, t), wg = v.gain(9);
    const drift = v.osc('sine', rand(0.4, 0.9), 0, t), dg = v.gain(12);
    wob.connect(wg); drift.connect(dg);
    for (const o of [o1, o2]) { wg.connect(o.detune); dg.connect(o.detune); }
    const m1 = v.gain(0.55), m2 = v.gain(0.3);
    o1.connect(m1); o2.connect(m2);
    const drive = v.shaper(this.c.curve('drive', 2.5));
    m1.connect(drive); m2.connect(drive);
    const bright = v.filter('lowpass', 900, 1.1);
    drive.connect(bright);
    const fsum = v.gain(1);
    const fm: ReadonlyArray<readonly [number, number, number]> = [[520, 3, 1.6], [1350, 5, 1.0], [2700, 6, 0.5]];
    for (const [ff, q, gg] of fm) {
      const bp = v.filter('bandpass', ff * rand(0.95, 1.05), q), g = v.gain(gg);
      bright.connect(bp); bp.connect(g); g.connect(fsum);
    }
    const dry = v.gain(0.35);
    bright.connect(dry); dry.connect(fsum);
    const nz = v.noise('white', t), nbp = v.filter('bandpass', 1500, 0.8), ng = v.gain(0.1);
    nz.connect(nbp); nbp.connect(ng); ng.connect(fsum);
    const env = v.gain(0);
    fsum.connect(env);
    connectOut(env, out);
    const F = f.offset, A = env.gain, B = bright.frequency;
    const lv = level * 0.6;
    A.setValueAtTime(0, t);
    B.setValueAtTime(800, t);
    let end = t;
    notes.forEach((n, i) => {
      const nx = notes[i + 1];
      const s = t + n.s, e = s + n.d;
      // release must finish strictly before the next onset (coincident events re-order and click)
      const r = Math.min(n.d < 0.2 ? 0.035 : 0.14, nx ? nx.s - n.s - n.d - 0.01 : 1);
      const sc = Math.min(0.14, n.d * 0.4), st = Math.min(0.24, n.d * 0.6);
      F.setValueAtTime(low * 0.8, s);
      F.exponentialRampToValueAtTime(low * 1.012, s + sc);
      F.exponentialRampToValueAtTime(low, s + st);
      A.linearRampToValueAtTime(0, s);
      A.linearRampToValueAtTime(lv * 0.7, s + Math.min(0.05, n.d * 0.3));
      A.linearRampToValueAtTime(lv, s + st);
      B.setValueAtTime(900, s);
      B.linearRampToValueAtTime(3200, s + st);
      if (n.leap && n.d > 0.3) {
        const ls = e - Math.min(0.55, n.d * 0.4);
        F.setValueAtTime(low, ls);
        F.exponentialRampToValueAtTime(high * 1.012, ls + 0.07);
        F.exponentialRampToValueAtTime(high, ls + 0.18);
        F.exponentialRampToValueAtTime(high * 0.985, e);
        A.setValueAtTime(lv, ls);
        A.linearRampToValueAtTime(lv * 1.12, ls + 0.1);
        A.linearRampToValueAtTime(lv * 1.02, e);
        B.setValueAtTime(3200, ls);
        B.linearRampToValueAtTime(4200, ls + 0.1);
      } else {
        F.exponentialRampToValueAtTime(low * 0.99, e);
        A.linearRampToValueAtTime(lv * 0.95, e);
      }
      A.linearRampToValueAtTime(0, e + r);
      B.linearRampToValueAtTime(700, e + r);
      end = e + r;
    });
    v.play(t, end + 0.05);
    return end;
  }

  /** Ney (reed flute): breathy tone, portamento between notes, delayed vibrato. Returns end time. */
  ney(out: Out, t: number, notes: readonly NeyNote[], level: number): number {
    const first = notes.find((n) => n.midi >= 0);
    if (!first) return t;
    const v = new Voice(this.c);
    const o = v.wave(this.c.wave('ney'), mtof(first.midi), 0, t);
    const vib = v.osc('sine', rand(4.6, 5.4), 0, t), vg = v.gain(0);
    vib.connect(vg); vg.connect(o.detune);
    const tone = v.gain(0);
    o.connect(tone);
    const nz = v.noise('white', t);
    const nbp = v.filter('bandpass', mtof(first.midi), 5);
    const air = v.filter('highpass', 2500, 0.7), airG = v.gain(0.12);
    const ng = v.gain(0);
    nz.connect(nbp); nbp.connect(ng); nz.connect(air); air.connect(airG); airG.connect(ng);
    const sum = v.gain(1);
    tone.connect(sum); ng.connect(sum);
    const lp = v.filter('lowpass', 4200, 0.6);
    sum.connect(lp);
    const p = v.pan(rand(-0.25, 0.25));
    lp.connect(p); connectOut(p, out);
    const T = tone.gain, N = ng.gain, VG = vg.gain, FR = o.frequency;
    const bl = level * 1.4; // breath level
    T.setValueAtTime(0, t); N.setValueAtTime(0, t); VG.setValueAtTime(0, t);
    let s = t, prev = -1;
    for (const n of notes) {
      const e = s + n.dur;
      if (n.midi < 0) {
        T.linearRampToValueAtTime(0, s + 0.06);
        N.linearRampToValueAtTime(0, s + 0.06);
        s = e; prev = -1;
        continue;
      }
      const f = mtof(n.midi), d = n.dur;
      // keep every automation time strictly inside the note, even for short ornaments
      const a1 = Math.min(0.07, d * 0.45), n1 = Math.min(0.025, d * 0.2), n2 = Math.min(0.12, d * 0.6);
      const mid = Math.max(s + a1 + 0.004, e - Math.min(0.04, d * 0.25));
      if (prev < 0) {
        FR.setValueAtTime(f * 0.96, s);
        FR.exponentialRampToValueAtTime(f, s + a1);
        T.setValueAtTime(0, s);
        N.setValueAtTime(0, s);
      } else {
        FR.setValueAtTime(mtof(prev), s);
        FR.exponentialRampToValueAtTime(f, s + Math.min(0.045, d * 0.4));
      }
      nbp.frequency.setValueAtTime(this.c.hz(f), s);
      T.linearRampToValueAtTime(level, s + a1);
      N.linearRampToValueAtTime(bl * 0.9, s + n1);
      N.linearRampToValueAtTime(bl * 0.3, s + n2);
      T.linearRampToValueAtTime(level * 0.85, mid);
      T.linearRampToValueAtTime(level * 0.7, e);
      N.linearRampToValueAtTime(bl * 0.3, e);
      VG.setValueAtTime(0, s);
      if (n.dur > 0.35) {
        VG.linearRampToValueAtTime(0, s + Math.min(0.25, n.dur * 0.4));
        VG.linearRampToValueAtTime(rand(12, 18), e);
      }
      prev = n.midi;
      s = e;
    }
    T.linearRampToValueAtTime(0, s + 0.12);
    N.linearRampToValueAtTime(0, s + 0.1);
    v.play(t, s + 0.3);
    return s;
  }
}

/** Generative ney melody over a chord sequence (one chord per bar). */
function makeMelody(
  scale: readonly number[], lo: number, hi: number, chords: ReadonlyArray<readonly number[]>, stepDur: number,
  cells: ReadonlyArray<readonly number[]>, endCells: ReadonlyArray<readonly number[]>,
): NeyNote[] {
  const sc = scaleNotes(scale, lo, hi);
  let idx = Math.floor(sc.length * rand(0.35, 0.65));
  const notes: NeyNote[] = [];
  chords.forEach((ch, b) => {
    const last = b === chords.length - 1;
    const cell = last ? pick(endCells) : pick(cells);
    cell.forEach((len, i) => {
      if (i > 0 && !last && chance(0.08)) { notes.push({ midi: -1, dur: len * stepDur }); return; }
      if (i === 0) idx = snapToChord(sc, idx, ch);
      else idx = clamp(idx + pick([-2, -1, -1, 1, 1, 2, 0, -1]), 0, sc.length - 1);
      notes.push({ midi: sc[idx], dur: len * stepDur });
    });
  });
  const ln = notes[notes.length - 1];
  if (ln && ln.midi >= 0) ln.midi = sc[snapToChord(sc, sc.indexOf(ln.midi), [0, 7])];
  return notes;
}

// ============================================================================
// Generative score — one composer per mood, each on its own gain bus
// ============================================================================

abstract class Composer {
  protected readonly out: Out;     // dry + extra reverb
  protected readonly dryOut: Out;  // dry only (still gets the bus's base reverb send)
  private readonly fader: GainNode;
  private readonly wetFader: GainNode;
  running = false;
  private stopAt = Infinity;
  protected nextTime = 0;
  protected step = 0;
  protected abstract readonly stepDur: number;
  protected abstract readonly stepsPerBar: number;

  constructor(protected readonly c: Core, protected readonly s: Synth, private readonly mix: number, drySend = 0.22) {
    const ctx = c.ctx;
    const dry = ctx.createGain(), wet = ctx.createGain(), send = ctx.createGain();
    this.fader = ctx.createGain(); this.wetFader = ctx.createGain();
    this.fader.gain.value = 0; this.wetFader.gain.value = 0; send.gain.value = drySend; wet.gain.value = 0.6;
    dry.connect(this.fader); this.fader.connect(c.musicIn);
    dry.connect(send); send.connect(this.wetFader);
    wet.connect(this.wetFader); this.wetFader.connect(c.hallIn);
    this.out = { dry, wet };
    this.dryOut = { dry, wet: null };
  }

  protected get barDur(): number { return this.stepDur * this.stepsPerBar; }

  /** Running and not fading out. */
  protected get active(): boolean { return this.running && this.stopAt === Infinity; }

  activate(now: number, fade: number): void {
    if (!this.running) {
      this.running = true;
      this.step = 0;
      this.nextTime = now + 0.12;
      this.reset();
    }
    this.stopAt = Infinity;
    rampTo(this.fader.gain, this.mix, now, fade);
    rampTo(this.wetFader.gain, this.mix, now, fade);
  }

  deactivate(now: number, fade: number): void {
    if (!this.running) return;
    rampTo(this.fader.gain, 0, now, fade);
    rampTo(this.wetFader.gain, 0, now, fade);
    this.stopAt = now + Math.max(0.05, fade);
  }

  /** Momentary duck of this bus (e.g. under the title hit). */
  protected dip(t: number, depth: number, hold: number, back: number): void {
    const p = this.fader.gain;
    rampTo(p, this.mix * depth, t, 0.12);
    p.setTargetAtTime(this.mix, t + hold, back / 4);
  }

  schedule(now: number, horizon: number): void {
    if (!this.running) return;
    if (now > this.stopAt + 0.25) { this.running = false; return; }
    if (this.nextTime < now - 0.05) { // fell behind (tab hidden etc.): skip, keep the bar grid
      const skip = Math.ceil((now - this.nextTime) / this.stepDur);
      this.step += skip;
      this.nextTime += skip * this.stepDur;
    }
    let guard = 0;
    while (this.nextTime < horizon && this.nextTime < this.stopAt && guard++ < 64) {
      this.onStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  protected hum(t: number, a = 0.008): number { return Math.max(this.c.ctx.currentTime, t + rand(-a, a)); }
  protected abstract reset(): void;
  protected abstract onStep(step: number, t: number): void;
}

// "David's motif": scale degrees + lengths in steps.
const MOTIF_DEG = [0, 4, 3, 2, 1, 2, 0];
const MOTIF_LEN = [2, 2, 1, 1, 1, 1, 4];

// ---------------------------------------------------------------------------
// Title: slow grand build in D Aeolian; re-centres on D minor when the title hit lands.
// ---------------------------------------------------------------------------
class TitleComposer extends Composer {
  protected readonly stepDur = 0.5; // eighth @ 60 bpm
  protected readonly stepsPerBar = 8;
  private readonly prog: readonly ChordName[] = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'Dm'];
  private revealed = false;
  private shofarDone = false;

  protected reset(): void { this.revealed = false; this.shofarDone = false; }

  reveal(t: number): void {
    this.revealed = true;
    this.shofarDone = true;
    if (!this.active) return;
    this.dip(t, 0.15, 1.4, 3);
    this.step = 16 * this.stepsPerBar; // restart on a Dm bar at full intensity
    this.nextTime = t + 1.6;
  }

  private intensity(bar: number): number { return this.revealed ? 1 : clamp(bar / 10, 0, 0.85); }

  protected onStep(step: number, t: number): void {
    const s = this.s;
    const bar = Math.floor(step / 8), k = step % 8, I = this.intensity(bar);
    const chord = CHORDS[this.prog[bar % 8]];
    const on = (b: number): boolean => this.revealed || bar >= b;
    if (k === 0) {
      if (bar % 2 === 0) {
        s.pad(this.out, t, this.barDur * 2 + 3, I > 0.5 ? [38, 45, 50] : [38, 45],
          { level: 0.12, attack: 2.5, release: 3, cutoff: 350 + 500 * I, voices: 3, detune: 7, lfoCents: 300 });
      }
      if (on(1)) {
        s.pad(this.out, t, this.barDur + 1.5, voicing(chord, 45, 62),
          { level: 0.035 + 0.05 * I, attack: 1.6 - 0.8 * I, release: 2, cutoff: 600 + 1200 * I, voices: 3, detune: 10 });
      }
      if (on(3)) {
        s.choir(this.out, t, this.barDur + 2, voicing(chord, 50, 72),
          I < 0.5 ? { level: 0.03 + 0.1 * I, attack: 2, release: 2.5, vowel: 'oo' }
            : { level: 0.03 + 0.1 * I, attack: 2 - I, release: 2.5, vowel: 'oh', to: 'ah', morph: 2.5 });
      }
      s.drum(this.out, t, 'taiko', 0.25 + 0.35 * I, 0);
      if (!this.shofarDone && bar === 4) { s.shofar(this.out, t + 0.5, 'tekiah', 0.26); this.shofarDone = true; }
      if (on(2) && bar % 4 === 2) this.motif(t, 0.55 + 0.15 * I);
    }
    if (on(4) && k === 4) s.drum(this.out, t, 'taiko', 0.18 + 0.25 * I, 0.1);
    if (on(6)) {
      if (k === 3 || k === 6) s.drum(this.dryOut, this.hum(t, 0.004), 'dum', 0.2 + 0.35 * I, -0.1);
      if (k % 2 === 1 && chance(0.7)) s.drum(this.dryOut, this.hum(t, 0.004), 'tek', 0.08 + 0.15 * I, 0.15);
      if (bar % 8 === 7 && k >= 4) { // roll into the next cycle
        s.drum(this.dryOut, t + this.stepDur / 2, 'tek', 0.1 + 0.05 * (k - 4), 0.2);
      }
    }
    if (on(8)) s.strStac(this.dryOut, this.hum(t, 0.003), rootIn(chord, 38), (k % 4 === 0 ? 0.45 : 0.3) + 0.25 * I, 0.35, 0.6);
  }

  private motif(t: number, vel: number): void {
    let o = 0;
    MOTIF_DEG.forEach((d, i) => {
      const m = degToMidi(SCALES.aeolian, 62, d);
      this.s.lyre(this.out, this.hum(t + o * this.stepDur), m, vel * (i === 0 ? 1.1 : 1), lyrePan(m));
      o += MOTIF_LEN[i];
    });
  }
}

// ---------------------------------------------------------------------------
// Pastoral: D Dorian, 6/8 lilt; lyre arpeggios, drone, soft strings, ney phrases.
// ---------------------------------------------------------------------------
const LYRE_68: ReadonlyArray<readonly number[]> = [
  [0, 2, 4, 5, 4, 2], [0, 3, 2, 4, 3, 5], [0, -1, 2, 3, -1, 4], [1, 2, 3, 2, 4, 3], [0, 2, 1, 3, 2, 4], [0, 4, 3, -1, 2, 1],
];
const PASTORAL_PROGS: ReadonlyArray<readonly ChordName[]> = [
  ['Dm', 'Dm', 'C', 'G', 'Dm', 'Am', 'G', 'Dm'],
  ['Dm', 'F', 'C', 'G', 'Dm', 'C', 'Am', 'Dm'],
  ['Dm', 'G', 'Dm', 'C', 'F', 'C', 'G', 'Dm'],
  ['Dm', 'Am', 'G', 'Dm', 'F', 'G', 'C', 'Dm'],
];
const CELLS_68: ReadonlyArray<readonly number[]> = [[3, 3], [2, 1, 3], [3, 2, 1], [1, 1, 1, 3], [4, 2], [2, 2, 2], [3, 1, 1, 1]];
const END_68: ReadonlyArray<readonly number[]> = [[6], [3, 3], [4, 2]];

class PastoralComposer extends Composer {
  protected readonly stepDur = 0.34;
  protected readonly stepsPerBar = 6;
  private prog: readonly ChordName[] = PASTORAL_PROGS[0];
  private pat: readonly number[] = LYRE_68[0];
  private shift = 0;
  private drums = false;
  private light = false;
  private fluteEnd = 0;

  protected reset(): void { this.prog = PASTORAL_PROGS[0]; this.fluteEnd = 0; this.drums = false; this.light = false; }

  protected onStep(step: number, t: number): void {
    const s = this.s;
    const bar = Math.floor(step / 6), k = step % 6, bip = bar % 4, phrase = Math.floor(bar / 4);
    if (k === 0 && bar % 8 === 0 && bar > 0) this.prog = pick(PASTORAL_PROGS);
    const chord = CHORDS[this.prog[bar % 8]];
    if (k === 0) {
      if (bip === 0) {
        s.pad(this.out, t, this.barDur * 4 + 3.5, [38, 45, 50],
          { level: 0.1, attack: 3, release: 3.5, cutoff: 480, voices: 3, detune: 6, lfoCents: 300 });
        this.drums = phrase > 0 && chance(0.45);
        this.light = phrase > 0 && chance(0.25);
        if (phrase > 0 && t > this.fluteEnd && chance(0.55)) {
          const chords = [0, 1, 2, 3].map((i) => CHORDS[this.prog[(bar + i) % 8]]);
          const mel = makeMelody(SCALES.dorian, 62, 81, chords, this.stepDur, CELLS_68, END_68);
          this.fluteEnd = s.ney(this.out, t, mel, 0.17);
        }
      }
      s.pad(this.out, t, this.barDur + 1.6, voicing(chord, 52, 67).slice(0, 4),
        { level: 0.055, attack: 1.0, release: 1.6, cutoff: 1400, voices: 2, detune: 11 });
      this.pat = pick(LYRE_68);
      this.shift = randi(0, 2);
      s.lyre(this.out, this.hum(t), rootIn(chord, 43), 0.38, -0.3);
    }
    const notes = voicing(chord, 57, 81);
    const idx = this.pat[k];
    const flute = t < this.fluteEnd;
    if (idx >= 0 && (!this.light || k === 0 || k === 3) && chance(flute ? 0.7 : 0.92)) {
      const m = notes[Math.min(notes.length - 1, idx + this.shift)];
      const vel = (k === 0 ? 0.72 : k === 3 ? 0.6 : 0.46) * rand(0.85, 1.1) * (flute ? 0.8 : 1);
      if (k === 0 && chance(0.2)) s.strum(this.out, this.hum(t), notes.slice(this.shift, this.shift + 3), vel);
      else s.lyre(this.out, this.hum(t), m, vel, lyrePan(m));
    }
    if (this.drums) {
      if (k === 0) s.drum(this.dryOut, this.hum(t, 0.004), 'dum', 0.3, -0.1);
      else if (k === 3) s.drum(this.dryOut, this.hum(t, 0.004), 'tek', 0.14, 0.15);
      else if (k === 5 && chance(0.5)) s.drum(this.dryOut, this.hum(t, 0.004), 'ka', 0.1, 0.2);
    }
  }
}

// ---------------------------------------------------------------------------
// Tension: D Freygish; heartbeat taiko, dark drone with a minor-2nd rub, sparse lyre.
// ---------------------------------------------------------------------------
const TENSION_MOTIFS: ReadonlyArray<readonly number[]> = [
  [0, 1, 4, 1], [7, 8, 7, 4], [4, 5, 7, 5], [12, 10, 8, 7], [1, 0, -2, 0], [7, 4, 1, 0],
];

class TensionComposer extends Composer {
  protected readonly stepDur = 0.36;
  protected readonly stepsPerBar = 8;
  private motif: readonly number[] | null = null;
  private base = 50;

  protected reset(): void { this.motif = null; }

  protected onStep(step: number, t: number): void {
    const s = this.s;
    const bar = Math.floor(step / 8), k = step % 8, bip = bar % 4, phrase = Math.floor(bar / 4);
    if (k === 0 && bip === 0) {
      s.pad(this.out, t, this.barDur * 4 + 3, [38, 45, 50],
        { level: 0.1, attack: 2.5, release: 3, cutoff: 380, voices: 3, detune: 8, lfoCents: 400 });
      s.pad(this.out, t + this.barDur, this.barDur * 3 + 2, phrase % 2 === 0 ? [74, 75] : [69, 70],
        { level: 0.022, attack: 4, release: 2.5, cutoff: 2600, voices: 2, detune: 6, trem: 0.5, tremRate: 6.5 });
      if (phrase % 3 === 2) s.choir(this.out, t, this.barDur * 4, [50, 57, 63], { level: 0.04, attack: 3, release: 3, vowel: 'oo' });
    }
    if (k === 0) s.drum(this.out, this.hum(t, 0.003), 'taiko', 0.42, 0);
    if (k === 1) s.drum(this.out, this.hum(t, 0.003), 'taiko', 0.26, 0);
    if (k === 4 && chance(0.6)) s.drum(this.dryOut, this.hum(t), 'dum', 0.26, -0.15);
    if (bip === 3 && k >= 5) s.drum(this.dryOut, this.hum(t), 'tek', 0.1 + (k - 5) * 0.07, 0.2);
    if (k % 2 === 0) s.strStac(this.dryOut, this.hum(t), bip === 2 && k >= 4 ? 39 : 38, k === 0 ? 0.5 : 0.36, 0.3, 0.4);
    if (k === 0 && bar % 2 === 1 && chance(0.6)) { this.motif = pick(TENSION_MOTIFS); this.base = pick([50, 62]); }
    if (this.motif && k % 2 === 0) {
      const i = k / 2;
      if (i < this.motif.length) {
        const m = this.base + this.motif[i];
        s.lyre(this.out, this.hum(t), m, rand(0.38, 0.5), lyrePan(m));
      }
    }
    if (k === 7) this.motif = null;
  }
}

// ---------------------------------------------------------------------------
// Battle: 118 bpm doumbek maqsum/baladi, taiko accents, spiccato ostinato, choir stabs, shofar.
// ---------------------------------------------------------------------------
const BATTLE_SECTIONS: ReadonlyArray<readonly ChordName[]> = [
  ['D', 'Eb', 'D', 'Cm', 'D', 'Bb', 'Cm', 'D'],
  ['D', 'Gm', 'D', 'Eb', 'Bb', 'Cm', 'Eb', 'D'],
];
// B = taiko+dum, D = dum, T = tek, k = ghost ka
const DRUM_PATTERNS: readonly string[] = ['B.Tk.kT.Dk.kT.k.', 'B.Dk.kT.Dk.kT.kk', 'B.Tk.TkkD.TkT.Tk'];
const DRUM_FILL = 'B.Tk.kT.TkTkTTTT';
const OSTINATO = [0, 0, 12, 0, 0, 12, 7, 12];

class BattleComposer extends Composer {
  protected readonly stepDur = 60 / 118 / 4;
  protected readonly stepsPerBar = 16;
  private sec: readonly ChordName[] = BATTLE_SECTIONS[0];
  private pat = DRUM_PATTERNS[0];
  private full = true;
  private alt = false;

  protected reset(): void { this.sec = BATTLE_SECTIONS[0]; this.pat = DRUM_PATTERNS[0]; this.full = true; this.alt = false; }

  protected onStep(step: number, t: number): void {
    const s = this.s;
    const bar = Math.floor(step / 16), k = step % 16, bis = bar % 8, section = Math.floor(bar / 8);
    if (k === 0 && bis === 0) {
      if (section > 0) { this.sec = pick(BATTLE_SECTIONS); this.full = section % 2 === 0 || chance(0.5); }
      s.drum(this.out, t, 'boom', 0.3, 0);
      if (section === 0 || chance(0.75)) { s.shofar(this.out, t + 0.05, this.alt ? 'teruah' : 'tekiah', 0.24); this.alt = !this.alt; }
    }
    if (k === 0 && bar % 2 === 0) this.pat = pick(DRUM_PATTERNS);
    const chord = CHORDS[this.sec[bis]];
    const root = rootIn(chord, 33);
    const fill = bar % 4 === 3;
    const acc = k % 4 === 0 ? 1 : 0.8;
    const ramp = fill && k >= 8 ? 0.6 + (k - 8) * 0.06 : 1;
    switch ((fill ? DRUM_FILL : this.pat)[k]) {
      case 'B': s.drum(this.out, t, 'taiko', 0.5, 0); s.drum(this.dryOut, t, 'dum', 0.55, -0.1); break;
      case 'D': s.drum(this.dryOut, this.hum(t, 0.004), 'dum', 0.62 * acc, -0.1); break;
      case 'T': s.drum(this.dryOut, this.hum(t, 0.004), 'tek', 0.55 * acc * ramp, 0.15); break;
      case 'k': if (chance(0.8)) s.drum(this.dryOut, this.hum(t, 0.004), 'ka', rand(0.2, 0.32), 0.25); break;
    }
    if (k === 8 && bar % 2 === 1) s.drum(this.out, t, 'taiko', 0.36, 0.1);
    if (fill && k === 14) s.drum(this.out, t, 'taiko', 0.5, -0.1);
    if (k % 2 === 0) {
      const i = k / 2;
      s.strStac(this.dryOut, this.hum(t, 0.003), root + OSTINATO[i], i % 4 === 0 ? 0.85 : 0.62, 0.17, 1);
    }
    if (k === 0) {
      s.pad(this.out, t, this.barDur + 0.4, [root + 12, root + 19, root + 24],
        { level: 0.04, attack: 0.12, release: 0.4, cutoff: 1100, voices: 2, detune: 12 });
    }
    if (this.full && k === 0 && bis % 2 === 0) {
      s.choir(this.out, t, 1.1, voicing(chord, 55, 72), { level: 0.13, attack: 0.04, release: 0.6, vowel: 'ah' });
    }
    if (this.full && bis === 7 && k === 8) {
      s.choir(this.out, t, 0.9, voicing(chord, 57, 74), { level: 0.12, attack: 0.03, release: 0.5, vowel: 'ah' });
    }
    if (this.full && bis >= 4 && k % 2 === 1) {
      const ns = voicing(chord, 62, 81);
      const m = ns[(k >> 1) % ns.length];
      s.lyre(this.dryOut, this.hum(t, 0.003), m, 0.3, lyrePan(m), 0.25);
    }
  }
}

// ---------------------------------------------------------------------------
// Victory: D Mixolydian / major; choir swells, lyre arpeggios, taiko, shofar gedolah.
// ---------------------------------------------------------------------------
const VICTORY_PROGS: ReadonlyArray<readonly ChordName[]> = [
  ['D', 'G', 'C', 'D'], ['Bm', 'G', 'A', 'D'], ['D', 'C', 'G', 'D'], ['G', 'D', 'A', 'D'],
];
const CELLS_44: ReadonlyArray<readonly number[]> = [[4, 4], [2, 2, 4], [3, 1, 4], [2, 2, 2, 2], [6, 2], [4, 2, 2]];
const END_44: ReadonlyArray<readonly number[]> = [[8], [4, 4], [6, 2]];

class VictoryComposer extends Composer {
  protected readonly stepDur = 60 / 66 / 2;
  protected readonly stepsPerBar = 8;
  private prog: readonly ChordName[] = VICTORY_PROGS[0];
  private fluteEnd = 0;

  protected reset(): void { this.prog = VICTORY_PROGS[0]; this.fluteEnd = 0; }

  protected onStep(step: number, t: number): void {
    const s = this.s;
    const bar = Math.floor(step / 8), k = step % 8, bip = bar % 4, phrase = Math.floor(bar / 4);
    if (k === 0 && bip === 0 && phrase > 0) this.prog = pick(VICTORY_PROGS);
    const chord = CHORDS[this.prog[bip]];
    if (k === 0) {
      if (bar === 0) s.shofar(this.out, t + 0.6, 'gedolah', 0.28, 220, 293.66);
      else if (bip === 0 && phrase % 4 === 0) s.shofar(this.out, t + 0.3, 'tekiah', 0.22, 220, 293.66);
      s.choir(this.out, t, this.barDur + 1.2, voicing(chord, 50, 71),
        { level: 0.1, attack: 1.3, release: 1.8, vowel: 'oh', to: 'ah', morph: 1.5 });
      const r = rootIn(chord, 38);
      s.pad(this.out, t, this.barDur + 1.5, [r, r + 7, r + 12], { level: 0.07, attack: 0.5, release: 1.6, cutoff: 900, voices: 3 });
      s.drum(this.out, t, 'taiko', 0.36, 0);
      if (bip === 0 && phrase > 0 && t > this.fluteEnd && chance(0.5)) {
        const chords = [0, 1, 2, 3].map((i) => CHORDS[this.prog[i]]);
        this.fluteEnd = s.ney(this.out, t, makeMelody(SCALES.mixolydian, 62, 81, chords, this.stepDur, CELLS_44, END_44), 0.16);
      }
    }
    if (k === 4) s.drum(this.dryOut, this.hum(t), 'dum', 0.3, -0.1);
    if (k === 2 || k === 6) s.drum(this.dryOut, this.hum(t), 'tek', 0.12, 0.15);
    const ns = voicing(chord, 57, 84);
    const arp = [0, 1, 2, 3, 4, 3, 2, 1][k] + (bar % 2);
    const flute = t < this.fluteEnd ? 0.75 : 1;
    if (k === 0 && chance(0.5)) s.strum(this.out, this.hum(t), ns.slice(0, 4), 0.7 * flute);
    else {
      const m = ns[Math.min(ns.length - 1, arp)];
      s.lyre(this.out, this.hum(t), m, (k === 0 ? 0.7 : 0.5 * rand(0.9, 1.1)) * flute, lyrePan(m));
    }
  }
}

// ============================================================================
// Ambience: wind, cicadas, birds (golden hour in the Judean hills)
// ============================================================================

interface Cicada { phrase: GainNode; singing: boolean; until: number; amp: number; sing: readonly [number, number]; rest: readonly [number, number]; }
type BirdKind = 'chirp' | 'trill' | 'warble' | 'dove' | 'hoopoe';

const WIND_GAIN = 0.3;
const CICADA_GAIN = 0.55;
const BIRD_GAIN = 1.1;

class Ambience {
  private readonly nodes: AudioNode[] = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];
  private readonly windBus: GainNode;
  private readonly cicBus: GainNode;
  private readonly birdBus: GainNode;
  private readonly wLP: BiquadFilterNode;
  private readonly wLow: GainNode;
  private readonly wBP: BiquadFilterNode;
  private readonly wHigh: GainNode;
  private readonly wWh: BiquadFilterNode;
  private readonly wWhG: GainNode;
  private readonly cicadas: Cicada[] = [];
  private readonly bus: GainNode;
  private readonly level = { wind: -1, cicadas: -1, birds: -1 };
  private readonly live = { wind: false, cicadas: false };
  private readonly silentSince = { wind: 0, cicadas: 0 };
  private phase = Math.random() * 100;
  private last = 0;
  private nextUpd = 0;
  private nextBird = 0;
  private readonly n1 = new SmoothNoise();
  private readonly n2 = new SmoothNoise();
  private readonly n3 = new SmoothNoise();

  constructor(private readonly c: Core) {
    const ctx = c.ctx;
    const now = ctx.currentTime;
    const mk = <T extends AudioNode>(n: T): T => { this.nodes.push(n); return n; };
    const g = (v: number): GainNode => { const n = mk(ctx.createGain()); n.gain.value = v; return n; };
    const bq = (type: BiquadFilterType, f: number, q: number): BiquadFilterNode => {
      const b = mk(ctx.createBiquadFilter()); b.type = type; b.frequency.value = c.hz(f); b.Q.value = q; return b;
    };
    const loop = (b: AudioBuffer): AudioBufferSourceNode => {
      const s = mk(ctx.createBufferSource()); s.buffer = b; s.loop = true;
      s.start(now, Math.random() * Math.max(0, b.duration - 0.5)); this.srcs.push(s); return s;
    };
    const lfo = (f: number): OscillatorNode => {
      const o = mk(ctx.createOscillator()); o.frequency.value = f; o.start(now); this.srcs.push(o); return o;
    };
    const panner = (p: number): AudioNode => {
      if (typeof ctx.createStereoPanner === 'function') { const s = mk(ctx.createStereoPanner()); s.pan.value = p; return s; }
      return g(1);
    };

    const bus = g(1);
    bus.connect(c.worldIn);
    const verb = g(0.12);
    bus.connect(verb); verb.connect(c.hallIn);
    this.windBus = g(0); this.cicBus = g(0); this.birdBus = g(0);
    this.bus = bus;
    this.birdBus.connect(bus); // wind & cicadas connect only while audible (see setLevels/tick)
    const bv = g(0.25);
    this.birdBus.connect(bv); bv.connect(c.hallIn);

    // wind: low rumble + mid gust band + faint narrow "whistle" over the ridges
    const brown = loop(c.noise.brown), pink = loop(c.noise.pink);
    this.wLP = bq('lowpass', 400, 0.5); this.wLow = g(0.5);
    brown.connect(this.wLP); this.wLP.connect(this.wLow); this.wLow.connect(this.windBus);
    this.wBP = bq('bandpass', 1000, 0.6); this.wHigh = g(0.1);
    pink.connect(this.wBP); this.wBP.connect(this.wHigh); this.wHigh.connect(this.windBus);
    this.wWh = bq('bandpass', 800, 14); this.wWhG = g(0);
    pink.connect(this.wWh); this.wWh.connect(this.wWhG); this.wWhG.connect(this.windBus);

    // cicadas: band-passed noise, buzz AM (~100 Hz pulses) and optional rhythmic pulsing
    const wA = loop(c.noise.white), wB = loop(c.noise.white);
    const defs = [
      { f: 4800, q: 5, buzz: 110, pr: 0, pd: 0, pan: -0.6, amp: 1.0, sing: [8, 20] as const, rest: [1, 3] as const },
      { f: 6200, q: 7, buzz: 140, pr: 7, pd: 0.8, pan: 0.55, amp: 0.8, sing: [3, 9] as const, rest: [2, 6] as const },
      { f: 5400, q: 4, buzz: 95, pr: 2.6, pd: 0.55, pan: 0.1, amp: 0.55, sing: [4, 10] as const, rest: [3, 8] as const },
    ];
    defs.forEach((d, i) => {
      const bp = bq('bandpass', d.f * rand(0.95, 1.05), d.q);
      (i === 1 ? wB : wA).connect(bp);
      const buzz = g(0);
      const bs = mk(ctx.createWaveShaper()); bs.curve = c.curve('pulse', 2.5);
      lfo(d.buzz * rand(0.95, 1.05)).connect(bs); bs.connect(buzz.gain);
      bp.connect(buzz);
      let tail: AudioNode = buzz;
      if (d.pr > 0) {
        const pg = g(1 - d.pd), pdg = g(d.pd);
        const ps = mk(ctx.createWaveShaper()); ps.curve = c.curve('pulse', 1.5);
        lfo(d.pr * rand(0.9, 1.1)).connect(ps); ps.connect(pdg); pdg.connect(pg.gain);
        buzz.connect(pg);
        tail = pg;
      }
      const phrase = g(0);
      tail.connect(phrase);
      const pn = panner(d.pan);
      phrase.connect(pn); pn.connect(this.cicBus);
      this.cicadas.push({ phrase, singing: false, until: now + rand(0, 2), amp: d.amp, sing: d.sing, rest: d.rest });
    });
  }

  setLevels(l: { wind: number; cicadas: number; birds: number }, now: number): void {
    if (l.wind > 0 && !this.live.wind) { this.windBus.connect(this.bus); this.live.wind = true; }
    if (l.cicadas > 0 && !this.live.cicadas) { this.cicBus.connect(this.bus); this.live.cicadas = true; }
    if (l.wind <= 0 && this.level.wind !== 0) this.silentSince.wind = now;
    if (l.cicadas <= 0 && this.level.cicadas !== 0) this.silentSince.cicadas = now;
    if (l.wind !== this.level.wind) this.windBus.gain.setTargetAtTime(l.wind * WIND_GAIN, now, 0.8);
    if (l.cicadas !== this.level.cicadas) this.cicBus.gain.setTargetAtTime(l.cicadas * CICADA_GAIN, now, 0.8);
    if (l.birds !== this.level.birds) this.birdBus.gain.setTargetAtTime(l.birds * BIRD_GAIN, now, 0.5);
    if (this.level.birds <= 0.02 && l.birds > 0.02) this.nextBird = now + rand(0.5, 2);
    this.level.wind = l.wind; this.level.cicadas = l.cicadas; this.level.birds = l.birds;
  }

  tick(now: number, slow: number): void {
    const dt = clamp(now - this.last, 0, 0.5);
    this.last = now;
    this.phase += dt * lerp(1, 0.35, slow);
    if (this.live.wind && this.level.wind <= 0 && now - this.silentSince.wind > 5) {
      this.windBus.disconnect(); this.live.wind = false;
    }
    if (this.live.cicadas && this.level.cicadas <= 0 && now - this.silentSince.cicadas > 5) {
      this.cicBus.disconnect(); this.live.cicadas = false;
    }
    if (now >= this.nextUpd) {
      this.nextUpd = now + 0.1;
      const ph = this.phase;
      if (this.level.wind > 0) {
        const gust = clamp(0.55 * this.n1.at(ph * 0.09) + 0.35 * this.n2.at(ph * 0.31) + 0.1 * this.n3.at(ph * 1.3), 0, 1);
        const g2 = gust * gust;
        this.wLow.gain.setTargetAtTime(0.35 + 0.65 * gust, now, 0.25);
        this.wLP.frequency.setTargetAtTime(220 + 650 * gust, now, 0.25);
        this.wHigh.gain.setTargetAtTime(0.04 + 0.35 * g2, now, 0.25);
        this.wBP.frequency.setTargetAtTime(600 + 1600 * gust, now, 0.25);
        this.wWh.frequency.setTargetAtTime(450 + 900 * this.n3.at(ph * 0.2), now, 0.4);
        this.wWhG.gain.setTargetAtTime(1.2 * g2 * gust, now, 0.25);
      }
      if (this.level.cicadas > 0) {
        for (const cc of this.cicadas) {
          if (now < cc.until) continue;
          cc.singing = !cc.singing;
          cc.until = now + (cc.singing ? rand(cc.sing[0], cc.sing[1]) : rand(cc.rest[0], cc.rest[1]));
          cc.phrase.gain.setTargetAtTime(cc.singing ? cc.amp * rand(0.7, 1) : 0, now, cc.singing ? 0.7 : 1.0);
        }
      }
    }
    if (this.level.birds > 0.02 && now >= this.nextBird) {
      this.bird(now + 0.05);
      this.nextBird = now + lerp(12, 2, this.level.birds) * rand(0.5, 1.5) / lerp(1, 0.5, slow);
    }
  }

  private bird(t: number): void {
    const c = this.c;
    const v = new Voice(c);
    const r = Math.random();
    const kind: BirdKind = r < 0.35 ? 'chirp' : r < 0.6 ? 'warble' : r < 0.75 ? 'trill' : r < 0.9 ? 'dove' : 'hoopoe';
    const dist = rand(0.3, 1);
    const o = v.osc('sine', 3000, 0, t);
    const fm = v.osc('sine', 30, 0, t), fg = v.gain(0);
    fm.connect(fg); fg.connect(o.frequency);
    const g = v.gain(0), lp = v.filter('lowpass', lerp(3500, 12000, dist), 0.7), p = v.pan(rand(-0.85, 0.85));
    o.connect(g); g.connect(lp); lp.connect(p); p.connect(this.birdBus);
    const F = o.frequency, G = g.gain;
    let tt = t;
    G.setValueAtTime(0, t);
    switch (kind) {
      case 'chirp': {
        const n = randi(2, 6), base = rand(2800, 4300), up = chance(0.5), amp = 0.1 * dist;
        for (let i = 0; i < n; i++) {
          const d = rand(0.04, 0.08);
          F.setValueAtTime(base * (up ? 0.8 : 1.25), tt);
          F.exponentialRampToValueAtTime(base * (up ? 1.25 : 0.8), tt + d);
          G.setValueAtTime(0, tt); G.linearRampToValueAtTime(amp, tt + 0.008); G.linearRampToValueAtTime(0, tt + d);
          tt += d + rand(0.06, 0.16);
        }
        break;
      }
      case 'trill': {
        const d = rand(0.4, 0.9), base = rand(3500, 5000), amp = 0.07 * dist;
        fm.frequency.value = rand(22, 38);
        fg.gain.setValueAtTime(rand(300, 700), t);
        F.setValueAtTime(base, t); F.linearRampToValueAtTime(base * 0.85, t + d);
        G.linearRampToValueAtTime(amp, t + 0.03); G.setValueAtTime(amp, t + d - 0.05); G.linearRampToValueAtTime(0, t + d);
        tt = t + d;
        break;
      }
      case 'warble': {
        const n = randi(5, 9), amp = 0.08 * dist;
        let f = rand(2200, 3500);
        F.setValueAtTime(f, t);
        G.linearRampToValueAtTime(amp, t + 0.02);
        for (let i = 0; i < n; i++) {
          const d = rand(0.05, 0.12);
          const nf = clamp(f * rand(0.75, 1.3), 1800, 4800);
          F.exponentialRampToValueAtTime(nf, tt + d * 0.6);
          G.linearRampToValueAtTime(amp * rand(0.6, 1), tt + d * 0.5);
          G.linearRampToValueAtTime(amp * 0.25, tt + d);
          f = nf; tt += d;
        }
        G.linearRampToValueAtTime(0, tt + 0.03);
        break;
      }
      case 'dove': { // laughing dove: soft "coo-COO-coo-coo"
        const base = rand(480, 600), amp = 0.12 * dist;
        const durs = [0.22, 0.32, 0.2, 0.2, 0.26].slice(0, randi(3, 5));
        fm.frequency.value = rand(18, 26); fg.gain.value = 6;
        for (const d of durs) {
          F.setValueAtTime(base * 0.94, tt); F.linearRampToValueAtTime(base, tt + d * 0.4); F.linearRampToValueAtTime(base * 0.92, tt + d);
          G.setValueAtTime(0, tt); G.linearRampToValueAtTime(amp, tt + 0.05); G.linearRampToValueAtTime(amp * 0.8, tt + d - 0.05);
          G.linearRampToValueAtTime(0, tt + d);
          tt += d + rand(0.08, 0.14);
        }
        break;
      }
      case 'hoopoe': { // "oop-oop-oop"
        const base = rand(380, 440), amp = 0.13 * dist;
        for (let i = 0; i < 3; i++) {
          F.setValueAtTime(base * 1.05, tt); F.exponentialRampToValueAtTime(base * 0.95, tt + 0.12);
          G.setValueAtTime(0, tt); G.linearRampToValueAtTime(amp, tt + 0.025); G.linearRampToValueAtTime(0, tt + 0.12);
          tt += 0.3;
        }
        break;
      }
    }
    v.play(t, tt + 0.1);
  }

  dispose(): void {
    for (const s of this.srcs) { try { s.stop(); } catch { /* ignore */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
  }
}

// ============================================================================
// Sling spin: continuous "whum-whum" whose rotation rate and pitch follow power
// ============================================================================

const SLING_GAIN = 0.55;

class SlingSpin {
  private nodes: AudioNode[] = [];
  private srcs: AudioScheduledSourceNode[] = [];
  private lfo: OscillatorNode | null = null;
  private bp: BiquadFilterNode | null = null;
  private fmD: GainNode | null = null;
  private level: GainNode | null = null;
  private active = false;
  private lastActive = -10;
  private lastSet = -10;
  private lastPower = -1;

  constructor(private readonly c: Core) {}

  private build(now: number): void {
    const ctx = this.c.ctx;
    const mk = <T extends AudioNode>(n: T): T => { this.nodes.push(n); return n; };
    const gain = (v: number): GainNode => { const g = mk(ctx.createGain()); g.gain.value = v; return g; };
    const nz = mk(ctx.createBufferSource()); nz.buffer = this.c.noise.pink; nz.loop = true;
    const nzL = mk(ctx.createBufferSource()); nzL.buffer = this.c.noise.brown; nzL.loop = true;
    const lfo = mk(ctx.createOscillator()); lfo.frequency.value = 2;
    const bp = mk(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 1.6;
    const lp = mk(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.8;
    const sh = mk(ctx.createWaveShaper()); sh.curve = this.c.curve('pulse', 3);
    const am = gain(0.06), amD = gain(1.6), amL = gain(0), amLD = gain(0.7), fmD = gain(300), level = gain(0);
    nz.connect(bp); bp.connect(am); am.connect(level);
    nzL.connect(lp); lp.connect(amL); amL.connect(level);
    lfo.connect(sh); sh.connect(amD); amD.connect(am.gain); sh.connect(amLD); amLD.connect(amL.gain);
    lfo.connect(fmD); fmD.connect(bp.frequency);
    if (typeof ctx.createStereoPanner === 'function') {
      const pan = mk(ctx.createStereoPanner()), pd = gain(0.35);
      lfo.connect(pd); pd.connect(pan.pan); level.connect(pan); pan.connect(this.c.sfxWorld);
    } else level.connect(this.c.sfxWorld);
    nz.start(now, Math.random() * 4); nzL.start(now, Math.random() * 4); lfo.start(now);
    this.srcs = [nz, nzL, lfo];
    this.lfo = lfo; this.bp = bp; this.fmD = fmD; this.level = level;
  }

  set(active: boolean, power: number, now: number): void {
    const pw = clamp(fin(power, 0), 0, 1);
    if (active) { this.lastActive = now; if (!this.lfo) this.build(now); }
    if (!this.lfo || !this.bp || !this.fmD || !this.level) return;
    if (active === this.active && Math.abs(pw - this.lastPower) < 0.01 && now - this.lastSet < 0.2) return;
    this.active = active; this.lastPower = pw; this.lastSet = now;
    const sp = this.c.slowPitch;
    if (active) {
      this.lfo.frequency.setTargetAtTime((2 + 5 * pw) * sp, now, 0.06);
      this.bp.frequency.setTargetAtTime(this.c.hz((420 + 1100 * pw) * sp), now, 0.08);
      this.fmD.gain.setTargetAtTime((200 + 500 * pw) * sp, now, 0.08);
      this.level.gain.setTargetAtTime(SLING_GAIN * (0.35 + 0.65 * pw), now, 0.06);
    } else {
      this.level.gain.setTargetAtTime(0, now, 0.035);
    }
  }

  tick(now: number): void {
    if (!this.lfo) return;
    if (this.active && now - this.lastActive > 0.3) this.set(false, 0, now); // caller stopped calling
    else if (!this.active && now - this.lastActive > 2.5) this.teardown();
  }

  teardown(): void {
    for (const s of this.srcs) { try { s.stop(); } catch { /* ignore */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    this.nodes = []; this.srcs = [];
    this.lfo = null; this.bp = null; this.fmD = null; this.level = null;
    this.active = false;
  }
}

// ============================================================================
// SFX library
// ============================================================================

interface Sends { hall(a: number): void; echo(a: number): void; }
type SfxFn = (v: Voice, t: number, out: AudioNode, p: number, s: Sends) => number;
type Pts = ReadonlyArray<readonly [number, number]>;

/** Routed around the slow-motion lowpass. */
const UI_SFX: ReadonlySet<string> = new Set<SfxName>(['uiObjective', 'uiConfirm', 'heartbeat', 'titleHit', 'shepherdCall', 'shepherdWhistle']);
/** [voice group, max concurrent] */
const SFX_LIMIT: Partial<Record<SfxName, readonly [string, number]>> = {
  footstep: ['step', 4], footstepRun: ['step', 4],
  sheepBleat: ['bleat', 4], lambBleat: ['bleat', 4], goatBleat: ['bleat', 4],
  bearRoar: ['bear', 2], bearGrowl: ['bear', 2], bearHurt: ['bearHurt', 2], bearDeath: ['bearDeath', 1],
  stoneHit: ['stone', 6], jarShatter: ['jar', 4], heartbeat: ['heart', 2], titleHit: ['title', 1], impactBoom: ['boom', 2],
  shepherdCall: ['call', 2], shepherdWhistle: ['call', 2],
};

/** Loudness trims (measured, K-weighted) so volume 1 of every effect sits well against the score. */
const SFX_GAIN: Partial<Record<SfxName, number>> = {
  footstep: 1.3, stoneHitBear: 0.75, jarShatter: 0.7, sheepBleat: 0.6, lambBleat: 0.6, goatBleat: 0.42,
  bearRoar: 0.7, bearGrowl: 0.85, bearHurt: 0.6, bearDeath: 0.7, davidHurt: 0.6, heartbeat: 0.7,
  impactBoom: 0.65, titleHit: 0.6,
};

interface BleatPreset {
  f: readonly [number, number]; dur: readonly [number, number]; vib: readonly [number, number];
  fm: number; am: number; breath: number; formants: ReadonlyArray<readonly [number, number, number]>; pulse: boolean; level: number;
}
const BLEATS: Record<'sheep' | 'lamb' | 'goat', BleatPreset> = {
  sheep: { f: [165, 230], dur: [0.55, 0.95], vib: [6, 8], fm: 0.03, am: 0.6, breath: 0.1,
    formants: [[780, 5, 1], [1250, 7, 0.6], [2600, 9, 0.28]], pulse: false, level: 1 },
  lamb: { f: [330, 460], dur: [0.3, 0.55], vib: [8, 10.5], fm: 0.035, am: 0.5, breath: 0.08,
    formants: [[980, 5, 1], [1750, 7, 0.6], [3100, 9, 0.3]], pulse: false, level: 0.9 },
  goat: { f: [250, 330], dur: [0.55, 1.05], vib: [10, 14], fm: 0.025, am: 0.85, breath: 0.12,
    formants: [[560, 6, 0.9], [1900, 9, 0.8], [2800, 10, 0.35]], pulse: true, level: 1 },
};

interface BeastPreset {
  dur: readonly [number, number]; f0: Pts; F1: Pts; amp: Pts; noise: Pts;
  rasp: readonly [number, number]; raspDepth: number; drive: number; wet: number; echo: number; level: number;
}
const BEASTS: Record<'roar' | 'growl' | 'hurt' | 'death', BeastPreset> = {
  roar: { dur: [1.7, 2.4], f0: [[0, 50], [0.12, 78], [0.35, 98], [0.7, 84], [1, 48]],
    F1: [[0, 300], [0.1, 560], [0.5, 650], [0.85, 520], [1, 320]],
    amp: [[0, 0], [0.08, 0.8], [0.25, 1], [0.7, 0.9], [0.9, 0.5], [1, 0]], noise: [[0, 0.5], [1, 0.6]],
    rasp: [34, 24], raspDepth: 0.55, drive: 4, wet: 0.35, echo: 0.22, level: 0.9 },
  growl: { dur: [0.8, 1.3], f0: [[0, 42], [0.3, 56], [0.7, 52], [1, 40]], F1: [[0, 250], [0.3, 380], [1, 280]],
    amp: [[0, 0], [0.15, 0.9], [0.6, 1], [1, 0]], noise: [[0, 0.45], [1, 0.45]],
    rasp: [24, 18], raspDepth: 0.75, drive: 3, wet: 0.2, echo: 0.06, level: 0.8 },
  hurt: { dur: [0.4, 0.6], f0: [[0, 120], [0.15, 190], [0.5, 170], [1, 90]], F1: [[0, 450], [0.15, 780], [1, 380]],
    amp: [[0, 0], [0.06, 1], [0.5, 0.8], [1, 0]], noise: [[0, 0.5], [1, 0.5]],
    rasp: [42, 30], raspDepth: 0.4, drive: 5, wet: 0.3, echo: 0.15, level: 0.85 },
  death: { dur: [2.8, 3.6], f0: [[0, 90], [0.15, 84], [0.5, 62], [0.8, 42], [1, 30]],
    F1: [[0, 520], [0.3, 480], [0.7, 320], [1, 230]],
    amp: [[0, 0], [0.08, 0.9], [0.4, 0.75], [0.75, 0.45], [1, 0]], noise: [[0, 0.4], [0.6, 0.5], [1, 0.9]],
    rasp: [30, 11], raspDepth: 0.7, drive: 3.5, wet: 0.4, echo: 0.2, level: 0.9 },
};

class SfxLib {
  onTitleHit: ((t: number) => void) | null = null;
  private readonly active = new Map<string, number[]>();
  private readonly table: Record<SfxName, SfxFn>;

  constructor(private readonly c: Core, private readonly syn: Synth) {
    this.table = {
      footstep: (v, t, o, p) => this.sample(v, o, t, 'stepWalk', p * rand(0.9, 1.1), rand(0.4, 0.55)),
      footstepRun: (v, t, o, p) => this.sample(v, o, t, 'stepRun', p * rand(0.92, 1.1), rand(0.55, 0.7)),
      slingRelease: (v, t, o, p, s) => this.slingRelease(v, t, o, p, s),
      stoneHit: (v, t, o, p, s) => this.stoneHit(v, t, o, p, s),
      stoneHitBear: (v, t, o, p, s) => this.stoneHitBear(v, t, o, p, s),
      jarShatter: (v, t, o, p, s) => {
        const e = this.sample(v, o, t, 'jar', p * rand(0.93, 1.07), 0.9);
        this.thump(v, o, t, 200 * p, 120 * p, 0.25, 0.04, 0.05);
        s.hall(0.15);
        return e;
      },
      sheepBleat: (v, t, o, p, s) => this.bleat(v, t, o, p, 'sheep', s),
      lambBleat: (v, t, o, p, s) => this.bleat(v, t, o, p, 'lamb', s),
      goatBleat: (v, t, o, p, s) => this.bleat(v, t, o, p, 'goat', s),
      bearRoar: (v, t, o, p, s) => this.beast(v, t, o, p, 'roar', s),
      bearGrowl: (v, t, o, p, s) => this.beast(v, t, o, p, 'growl', s),
      bearHurt: (v, t, o, p, s) => this.beast(v, t, o, p, 'hurt', s),
      bearDeath: (v, t, o, p, s) => this.beast(v, t, o, p, 'death', s),
      staffHit: (v, t, o, p, s) => this.staffHit(v, t, o, p, s),
      whoosh: (v, t, o, p) => this.swoosh(v, o, t, p, 0.34, 320, 1500, 420, 1.4),
      grab: (v, t, o, p) => {
        const e = this.sample(v, o, t, 'rustle', p * rand(0.9, 1.1), 0.55);
        this.thump(v, o, t, 95 * p, 60 * p, 0.3, 0.06, 0.06);
        return Math.max(e, this.human(v, t + 0.04, o, p, 'effort', 0.45));
      },
      davidHurt: (v, t, o, p) => this.human(v, t, o, p, 'hurt', 0.9),
      davidEffort: (v, t, o, p) => this.human(v, t, o, p, 'effort', 0.8),
      pickup: (v, t, o, p) => this.pickup(v, t, o, p),
      uiObjective: (v, t, o, p, s) => {
        const tr = Math.round(12 * Math.log2(p));
        [69, 74, 81].forEach((m, i) => this.syn.lyre({ dry: o, wet: null }, t + i * 0.13, m + tr, 0.55 + i * 0.05, (i - 1) * 0.25));
        s.hall(0.35);
        return t + 3;
      },
      uiConfirm: (v, t, o, p, s) => {
        this.syn.lyre({ dry: o, wet: null }, t, 74 + Math.round(12 * Math.log2(p)), 0.65, 0);
        s.hall(0.25);
        return t + 2.4;
      },
      heartbeat: (v, t, o, p) => {
        this.thump(v, o, t, 62 * p, 40 * p, 0.95, 0.07, 0.09, 'triangle');
        this.thump(v, o, t + 0.17, 55 * p, 38 * p, 0.62, 0.08, 0.1, 'triangle');
        this.burst(v, o, t, 'brown', 'lowpass', 180, 0.7, 0.5, 0.004, 0.05);
        return t + 0.8;
      },
      impactBoom: (v, t, o, p, s) => {
        const e = this.sample(v, o, t, 'boom', p * rand(0.95, 1.05), 1);
        this.thump(v, o, t, 70 * p, 30 * p, 0.6, 0.5, 0.5);
        this.burst(v, o, t, 'white', 'lowpass', 3500, 0.7, 0.35, 0.001, 0.025);
        s.hall(0.5); s.echo(0.12);
        return Math.max(e, t + 3.5);
      },
      dodge: (v, t, o, p) => Math.max(
        this.swoosh(v, o, t, p, 0.22, 500, 2200, 700, 1.1),
        this.sample(v, o, t + 0.05, 'skid', p * rand(0.9, 1.1), 0.5)),
      titleHit: (v, t, o, p, s) => this.titleHit(v, t, o, s),
      shepherdCall: (v, t, o, p, s) => this.shepherdCall(t, o, p, s),
      shepherdWhistle: (v, t, o, p, s) => this.shepherdWhistle(v, t, o, p, s),
    };
  }

  play(name: SfxName, opts: SfxOptions | undefined, now: number): void {
    const fn = this.table[name];
    if (typeof fn !== 'function') return;
    const c = this.c;
    const ui = UI_SFX.has(name);
    const [group, max] = SFX_LIMIT[name] ?? [name, 4];
    const list = (this.active.get(group) ?? []).filter((e) => e > now);
    this.active.set(group, list);
    if (list.length >= max) return;
    if (!ui && c.load() > 260) return;
    const o = opts ?? {};
    const vol = clamp(fin(o.volume, 1), 0, 2);
    if (vol < 0.001) return;
    const pitch = clamp(fin(o.pitch, 1), 0.25, 4) * (ui ? 1 : c.slowPitch);
    const v = new Voice(c);
    const inp = v.gain(vol * (SFX_GAIN[name] ?? 1));
    const pn = v.pan(clamp(fin(o.pan, 0), -1, 1));
    inp.connect(pn);
    pn.connect(ui ? c.uiIn : c.sfxWorld);
    const sends: Sends = {
      hall: (a) => { if (a > 0) { const g = v.gain(a); pn.connect(g); g.connect(c.hallIn); } },
      echo: (a) => { if (a > 0) { const g = v.gain(a); pn.connect(g); g.connect(c.echoSend()); } },
    };
    const t = now + 0.012;
    const end = fn(v, t, inp, pitch, sends);
    v.play(t, Math.max(end, t + 0.05));
    list.push(end);
  }

  // --- building blocks ------------------------------------------------------------

  private sample(v: Voice, out: AudioNode, t: number, bank: BankName, rate: number, amp: number): number {
    const b = pick(this.c.bank(bank));
    const s = v.buffer(b, rate, t), g = v.gain(amp);
    s.connect(g); g.connect(out);
    return t + b.duration / rate;
  }

  private ping(v: Voice, out: AudioNode, t: number, f: number, amp: number, tau: number): void {
    const o = v.osc('sine', this.c.hz(f), 0, t), g = v.gain(0);
    perc(g.gain, t, 0.0008, amp, tau);
    o.connect(g); g.connect(out);
  }

  private burst(v: Voice, out: AudioNode, t: number, kind: NoiseKind, type: BiquadFilterType,
    f: number, q: number, amp: number, a: number, tau: number): void {
    const n = v.noise(kind, t), fl = v.filter(type, f, q), g = v.gain(0);
    perc(g.gain, t, a, amp, tau);
    n.connect(fl); fl.connect(g); g.connect(out);
  }

  private thump(v: Voice, out: AudioNode, t: number, f0: number, f1: number, amp: number, tau: number,
    sweep: number, type: OscillatorType = 'sine'): void {
    const o = v.osc(type, f0, 0, t);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + sweep);
    const g = v.gain(0);
    perc(g.gain, t, 0.002, amp, tau);
    o.connect(g); g.connect(out);
  }

  /** Band-passed air sweep (staff swing, dodge, cloth). */
  private swoosh(v: Voice, out: AudioNode, t: number, p: number, dur: number, f0: number, fp: number, f1: number, amp: number): number {
    const c = this.c;
    const d = dur / Math.sqrt(p);
    const n = v.noise('pink', t), bp = v.filter('bandpass', f0 * p, 1.3), g = v.gain(0);
    bp.frequency.setValueAtTime(c.hz(f0 * p), t);
    bp.frequency.exponentialRampToValueAtTime(c.hz(fp * p), t + d * 0.45);
    bp.frequency.exponentialRampToValueAtTime(c.hz(f1 * p), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + d * 0.45); g.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp); bp.connect(g); g.connect(out);
    const n2 = v.noise('white', t), hp = v.filter('highpass', 3500, 0.7), g2 = v.gain(0);
    g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(amp * 0.12, t + d * 0.45); g2.gain.linearRampToValueAtTime(0, t + d);
    n2.connect(hp); hp.connect(g2); g2.connect(out);
    return t + d + 0.05;
  }

  // --- individual effects -------------------------------------------------------------

  private slingRelease(v: Voice, t: number, o: AudioNode, p: number, s: Sends): number {
    const c = this.c;
    this.burst(v, o, t, 'white', 'highpass', 2000 * p, 0.7, 0.35, 0.001, 0.01); // leather snap
    const n2 = v.noise('pink', t), bp = v.filter('bandpass', 700 * p, 2.2), g2 = v.gain(0);
    bp.frequency.setValueAtTime(c.hz(700 * p), t);
    bp.frequency.exponentialRampToValueAtTime(c.hz(3200 * p), t + 0.09);
    perc(g2.gain, t, 0.006, 0.8, 0.05);
    n2.connect(bp); bp.connect(g2); g2.connect(o);
    const t3 = t + 0.02; // stone tearing away through the air
    const n3 = v.noise('pink', t3), bp3 = v.filter('bandpass', 2200 * p, 3.5), g3 = v.gain(0);
    bp3.frequency.setValueAtTime(c.hz(2200 * p), t3);
    bp3.frequency.exponentialRampToValueAtTime(c.hz(650 * p), t + 0.5);
    g3.gain.setValueAtTime(0, t3); g3.gain.linearRampToValueAtTime(0.7, t + 0.07); g3.gain.setTargetAtTime(0, t + 0.07, 0.11);
    n3.connect(bp3); bp3.connect(g3); g3.connect(o);
    this.thump(v, o, t, 190 * p, 80 * p, 0.22, 0.025, 0.05);
    s.echo(0.18); s.hall(0.12);
    return t + 0.9;
  }

  private stoneHit(v: Voice, t: number, o: AudioNode, p: number, s: Sends): number {
    const f1 = rand(1700, 2600) * p;
    this.ping(v, o, t, f1, 0.24, 0.02);
    this.ping(v, o, t, f1 * 1.63, 0.15, 0.013);
    this.ping(v, o, t, f1 * 2.4, 0.07, 0.008);
    this.burst(v, o, t, 'white', 'highpass', 2500, 0.7, 0.35, 0.0005, 0.004);
    this.thump(v, o, t, 120 * p, 55 * p, 0.35, 0.045, 0.07);
    const e = this.sample(v, o, t + 0.012, 'gravel', p * rand(0.9, 1.2), 0.35);
    s.hall(0.1);
    return Math.max(e, t + 0.4);
  }

  private stoneHitBear(v: Voice, t: number, o: AudioNode, p: number, s: Sends): number {
    this.thump(v, o, t, 100 * p, 45 * p, 0.5, 0.08, 0.1);
    this.burst(v, o, t, 'white', 'lowpass', 650 * p, 1.2, 0.9, 0.002, 0.03);
    this.burst(v, o, t, 'pink', 'bandpass', 1800 * p, 0.8, 0.35, 0.004, 0.05);
    this.ping(v, o, t, 380 * p, 0.12, 0.02);
    s.hall(0.08);
    return t + 0.6;
  }

  private staffHit(v: Voice, t: number, o: AudioNode, p: number, s: Sends): number {
    const f = rand(360, 460) * p;
    this.ping(v, o, t, f, 0.32, 0.045);
    this.ping(v, o, t, f * 2.31, 0.2, 0.025);
    this.ping(v, o, t, f * 3.87, 0.11, 0.015);
    this.burst(v, o, t, 'white', 'bandpass', 1600 * p, 0.9, 0.3, 0.0008, 0.008);
    this.thump(v, o, t, 140 * p, 70 * p, 0.4, 0.05, 0.05);
    s.hall(0.1);
    return t + 0.45;
  }

  private pickup(v: Voice, t: number, o: AudioNode, p: number): number {
    for (let k = 0; k < 2; k++) {
      const tk = t + k * rand(0.05, 0.075);
      const f = rand(2500, 3600) * p * (k ? 0.92 : 1);
      const a = k ? 0.55 : 1;
      this.ping(v, o, tk, f, 0.28 * a, 0.012);
      this.ping(v, o, tk, f * 1.47, 0.16 * a, 0.008);
      this.burst(v, o, tk, 'white', 'highpass', 3000, 0.7, 0.35 * a, 0.0005, 0.003);
    }
    this.thump(v, o, t, 300 * p, 180 * p, 0.12, 0.02, 0.03);
    return t + 0.35;
  }

  /** Short human vocalisations for young David. */
  private human(v: Voice, t: number, out: AudioNode, p: number, kind: 'hurt' | 'effort', level: number): number {
    const hurt = kind === 'hurt';
    const f0 = (hurt ? rand(160, 200) : rand(175, 215)) * p;
    const dur = hurt ? rand(0.22, 0.32) : rand(0.16, 0.24);
    const tv = t + (hurt ? 0 : 0.025);
    const F = hurt ? [620, 1150, 2450] : [760, 1250, 2650];
    const o = v.osc('sawtooth', f0, 0, tv);
    if (hurt) contour(o.frequency, tv, dur, [[0, 1.05], [0.15, 1.18], [0.6, 0.95], [1, 0.72]], f0);
    else contour(o.frequency, tv, dur, [[0, 1.08], [0.3, 1.0], [1, 0.8]], f0);
    const jit = v.osc('sine', rand(18, 28), 0, t), jg = v.gain(f0 * 0.025);
    jit.connect(jg); jg.connect(o.frequency);
    const drive = v.shaper(this.c.curve('drive', hurt ? 3 : 1.5));
    const vg = v.gain(0);
    o.connect(drive); drive.connect(vg);
    const nz = v.noise('white', t), nh = v.filter('highpass', 500, 0.6), ng = v.gain(0);
    nz.connect(nh); nh.connect(ng);
    const pre = v.gain(1);
    vg.connect(pre); ng.connect(pre);
    const sum = v.gain(1);
    const gains = [1, 0.55, 0.25];
    F.forEach((f, i) => {
      const bp = v.filter('bandpass', f * rand(0.95, 1.05), 6 + i * 2), g = v.gain(gains[i] * 2.5);
      pre.connect(bp); bp.connect(g); g.connect(sum);
    });
    const chest = v.filter('lowpass', 400, 0.7), cg = v.gain(0.3);
    pre.connect(chest); chest.connect(cg); cg.connect(sum);
    const lv = v.gain(level);
    sum.connect(lv); lv.connect(out);
    if (hurt) {
      contour(vg.gain, t, dur, [[0, 0], [0.08, 0.9], [0.4, 0.7], [1, 0]]);
      contour(ng.gain, t, dur, [[0, 0], [0.05, 0.5], [0.5, 0.25], [1, 0]]);
    } else {
      contour(ng.gain, t, dur + 0.03, [[0, 0], [0.1, 0.8], [0.5, 0.5], [1, 0]]);
      contour(vg.gain, tv, dur, [[0, 0], [0.15, 0.5], [0.5, 0.35], [1, 0]]);
    }
    return t + dur + 0.1;
  }

  /** Sheep / lamb / goat: warbling source (shared FM+AM LFO) through opening formants. */
  private bleat(v: Voice, t: number, out: AudioNode, p: number, kind: 'sheep' | 'lamb' | 'goat', s: Sends): number {
    const B = BLEATS[kind];
    const f0 = rand(B.f[0], B.f[1]) * p;
    const dur = rand(B.dur[0], B.dur[1]) / Math.sqrt(p);
    const dbl = kind === 'sheep' && chance(0.3);
    const fc = v.constant(f0, t);
    const o = B.pulse ? v.wave(this.c.wave('pulse'), 0, 0, t) : v.osc('sawtooth', 0, 0, t);
    fc.connect(o.frequency);
    const lfo = v.osc('sine', rand(B.vib[0], B.vib[1]), 0, t);
    const fm = v.gain(f0 * B.fm);
    lfo.connect(fm); fm.connect(fc.offset);
    const am = v.gain(1 - B.am / 2), amd = v.gain(B.am / 2);
    lfo.connect(amd); amd.connect(am.gain);
    o.connect(am);
    const nz = v.noise('white', t), nh = v.filter('highpass', 1500, 0.7), ng = v.gain(B.breath);
    nz.connect(nh); nh.connect(ng);
    const pre = v.gain(1);
    am.connect(pre); ng.connect(pre);
    const sum = v.gain(1);
    let F1: BiquadFilterNode | null = null;
    const F1f = B.formants[0][0] * rand(0.93, 1.07);
    B.formants.forEach(([fr, q, gg], i) => {
      const bp = v.filter('bandpass', i === 0 ? F1f : fr * rand(0.93, 1.07), q), g = v.gain(gg * 2.2);
      pre.connect(bp); bp.connect(g); g.connect(sum);
      if (i === 0) F1 = bp;
    });
    const body = v.filter('lowpass', f0 * 2.5, 0.7), bg = v.gain(0.35);
    pre.connect(body); body.connect(bg); bg.connect(sum);
    const env = v.gain(0);
    sum.connect(env); env.connect(out);
    contour(fc.offset, t, dur, dbl
      ? [[0, 0.92], [0.15, 1.04], [0.45, 1.0], [0.55, 0.96], [0.65, 1.0], [1, 0.84]]
      : [[0, 0.9], [0.18, 1.05], [0.6, 1.0], [1, 0.85]], f0);
    if (F1) contour((F1 as BiquadFilterNode).frequency, t, dur, [[0, 0.5], [0.1, 1], [0.8, 0.95], [1, 0.6]], F1f);
    contour(env.gain, t, dur, dbl
      ? [[0, 0], [0.05, 0.9], [0.4, 0.85], [0.47, 0.3], [0.55, 0.95], [0.85, 0.7], [1, 0]]
      : [[0, 0], [0.06, 0.85], [0.2, 1], [0.8, 0.8], [1, 0]], B.level);
    s.hall(0.1);
    return t + dur + 0.05;
  }

  /** Bear vocalisations: detuned saws + noise, rasp AM, distortion and moving formants. */
  private beast(v: Voice, t: number, out: AudioNode, p: number, kind: 'roar' | 'growl' | 'hurt' | 'death', s: Sends): number {
    const B = BEASTS[kind];
    const c = this.c;
    const dur = rand(B.dur[0], B.dur[1]) / Math.sqrt(p);
    const fk = rand(0.9, 1.1) * p;
    const f = v.constant(B.f0[0][1] * fk, t);
    const o1 = v.osc('sawtooth', 0, -12, t), o2 = v.osc('sawtooth', 0, 14, t), o3 = v.osc('triangle', 0, 0, t);
    f.connect(o1.frequency); f.connect(o2.frequency);
    const half = v.gain(0.5);
    f.connect(half); half.connect(o3.frequency);
    const jit = v.osc('sine', rand(5, 9), 0, t), jg = v.gain(B.f0[0][1] * fk * 0.04);
    jit.connect(jg); jg.connect(f.offset);
    const src = v.gain(1);
    const g1 = v.gain(0.5), g2 = v.gain(0.4), g3 = v.gain(0.7);
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(src); g2.connect(src); g3.connect(src);
    const nz = v.noise('white', t), nbp = v.filter('bandpass', 700, 0.6), ng = v.gain(0);
    nz.connect(nbp); nbp.connect(ng); ng.connect(src);
    const am = v.gain(1 - B.raspDepth / 2), rl = v.osc('triangle', B.rasp[0], 0, t), rd = v.gain(B.raspDepth / 2);
    rl.connect(rd); rd.connect(am.gain); src.connect(am);
    const rj = v.osc('sine', rand(2, 4), 0, t), rjg = v.gain(B.rasp[0] * 0.3);
    rj.connect(rjg); rjg.connect(rl.frequency);
    const sh = v.shaper(c.curve('drive', B.drive));
    am.connect(sh);
    const sum = v.gain(1);
    const F1 = v.filter('bandpass', 400, 3.5), F2 = v.filter('bandpass', 900, 5), F3 = v.filter('bandpass', 2300 * p, 6);
    const bank: ReadonlyArray<readonly [BiquadFilterNode, number]> = [[F1, 1.6], [F2, 0.9], [F3, 0.25]];
    for (const [bp, gg] of bank) { const g = v.gain(gg); sh.connect(bp); bp.connect(g); g.connect(sum); }
    const chest = v.filter('lowpass', 320, 0.8), cg = v.gain(0.6);
    sh.connect(chest); chest.connect(cg); cg.connect(sum);
    const lp = v.filter('lowpass', 2500, 0.7), env = v.gain(0);
    sum.connect(lp); lp.connect(env); env.connect(out);
    const sp = Math.sqrt(p);
    contour(f.offset, t, dur, B.f0, fk);
    contour(F1.frequency, t, dur, B.F1, sp);
    contour(F2.frequency, t, dur, B.F1, 2.1 * sp);
    contour(env.gain, t, dur, B.amp, B.level);
    contour(ng.gain, t, dur, B.noise);
    rl.frequency.setValueAtTime(B.rasp[0], t);
    rl.frequency.linearRampToValueAtTime(B.rasp[1], t + dur);
    s.hall(B.wet); s.echo(B.echo);
    return t + dur + 0.1;
  }

  /**
   * David calling his flock: a friendly reed-pipe phrase in D Dorian (rise, little turn, fall),
   * answered by the hills through the valley echo.
   */
  private shepherdCall(t: number, o: AudioNode, p: number, s: Sends): number {
    const tr = Math.round(12 * Math.log2(p));
    const phrases: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
      [[69, 0.16], [74, 0.38], [76, 0.1], [74, 0.13], [69, 0.62]],             // A  D (E-D turn) A
      [[67, 0.13], [69, 0.13], [74, 0.4], [72, 0.09], [74, 0.12], [69, 0.6]],  // G A D (C-D turn) A
      [[69, 0.15], [72, 0.14], [74, 0.36], [76, 0.09], [74, 0.12], [71, 0.12], [69, 0.55]], // A C D (E-D) B A
    ];
    const notes = pick(phrases).map(([m, d]) => ({ midi: m + tr, dur: d * rand(0.94, 1.06) }));
    const end = this.syn.ney({ dry: o, wet: null }, t, notes, 0.16);
    s.echo(0.42); s.hall(0.22);
    return end + 0.35;
  }

  /** Two-note human "come here" whistle: an up-slide then a falling note, breathy and slightly wavering. */
  private shepherdWhistle(v: Voice, t: number, o: AudioNode, p: number, s: Sends): number {
    const c = this.c;
    const f1 = rand(1250, 1450) * p, f2 = f1 * rand(1.3, 1.42), f3 = f1 * rand(0.86, 0.95);
    const d1 = rand(0.22, 0.28), gap = rand(0.07, 0.1), d2 = rand(0.34, 0.42);
    const t2 = t + d1 + gap, e = t2 + d2;
    const osc = v.osc('sine', f1, 0, t), h2 = v.osc('sine', f1 * 2, 0, t), h2g = v.gain(0.04);
    const vib = v.osc('sine', rand(4.5, 6), 0, t), vg = v.gain(14);
    vib.connect(vg); vg.connect(osc.detune); vg.connect(h2.detune);
    const F = osc.frequency, H = h2.frequency;
    // note 1: quick scoop up into the high note; note 2: glide down and settle
    F.setValueAtTime(f1, t); F.exponentialRampToValueAtTime(f2, t + d1 * 0.7);
    F.setValueAtTime(f2, t2); F.exponentialRampToValueAtTime(f3, t2 + d2 * 0.6); F.exponentialRampToValueAtTime(f3 * 0.97, e);
    H.setValueAtTime(f1 * 2, t); H.exponentialRampToValueAtTime(c.hz(f2 * 2), t + d1 * 0.7);
    H.setValueAtTime(c.hz(f2 * 2), t2); H.exponentialRampToValueAtTime(f3 * 2, t2 + d2 * 0.6); H.exponentialRampToValueAtTime(f3 * 1.94, e);
    const tone = v.gain(0);
    osc.connect(tone); h2.connect(h2g); h2g.connect(tone);
    const nz = v.noise('white', t), bp = v.filter('bandpass', f2, 4), air = v.gain(0);
    nz.connect(bp); bp.connect(air);
    bp.frequency.setValueAtTime(c.hz(f1), t); bp.frequency.exponentialRampToValueAtTime(c.hz(f2), t + d1 * 0.7);
    bp.frequency.setValueAtTime(c.hz(f2), t2); bp.frequency.exponentialRampToValueAtTime(c.hz(f3), t2 + d2 * 0.6);
    const A = 0.13, B = 0.05;
    for (const [s0, s1] of [[t, t + d1], [t2, e]] as const) {
      const T = tone.gain, N = air.gain;
      T.setValueAtTime(0, s0); T.linearRampToValueAtTime(A, s0 + 0.03); T.linearRampToValueAtTime(A * 0.85, s1 - 0.05); T.linearRampToValueAtTime(0, s1);
      N.setValueAtTime(0, s0); N.linearRampToValueAtTime(B, s0 + 0.02); N.linearRampToValueAtTime(B * 0.4, s0 + 0.08); N.linearRampToValueAtTime(0, s1);
    }
    tone.connect(o); air.connect(o);
    s.echo(0.35); s.hall(0.2);
    return e + 0.1;
  }

  /** The DAVID title reveal: boom + taiko + D-minor choir + low strings + shofar + cymbal wash. */
  private titleHit(v: Voice, t: number, o: AudioNode, s: Sends): number {
    const lo: Out = { dry: o, wet: null };
    const syn = this.syn;
    this.sample(v, o, t, 'boom', 1, 1);
    syn.drum(lo, t + 0.004, 'taiko', 0.9, -0.35);
    syn.drum(lo, t + 0.022, 'taiko', 0.8, 0.35);
    syn.drum(lo, t, 'dum', 0.7, 0);
    syn.choir(lo, t + 0.02, 5.5, [50, 57, 62, 65, 69, 74], { level: 0.34, attack: 0.1, release: 3, vowel: 'ah', breath: 0.2 });
    syn.pad(lo, t, 5, [26, 38, 45, 50], { level: 0.22, attack: 0.06, release: 3, cutoff: 1400, cutoffEnd: 500, voices: 3, detune: 10 });
    syn.shofar(lo, t + 0.18, 'tekiah', 0.4);
    this.burst(v, o, t, 'white', 'highpass', 6000, 0.7, 0.08, 0.01, 1.1);
    s.hall(0.55); s.echo(0.12);
    if (this.onTitleHit) this.onTitleHit(t);
    return t + 7;
  }
}

// ============================================================================
// Public engine
// ============================================================================

const MUSIC_GAIN = 0.68;
const MOOD_MIX: Record<Exclude<MusicMood, 'silence'>, number> = { title: 0.85, pastoral: 0.9, tension: 1, battle: 0.95, victory: 0.95 };
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private core: Core | null = null;
  private lib: SfxLib | null = null;
  private syn: Synth | null = null;
  private amb: Ambience | null = null;
  private sling: SlingSpin | null = null;
  private title: TitleComposer | null = null;
  private readonly moods = new Map<MusicMood, Composer>();
  private _ready = false;
  private pending: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlock: (() => void) | null = null;
  private vol = 0.8;
  private muted = false;
  private musicVol = 1;
  private sfxVol = 1;
  private mood: MusicMood = 'silence';
  private moodFade = 3;
  private readonly amblv = { wind: 0, cicadas: 0, birds: 0 };
  private slowTarget = 0;
  private slowAmt = 0;
  private slowApplied = -1;
  private autoBeat = true;
  private nextBeat = 0;
  private lastTick = 0;
  private nextSweep = 0;
  private nextWarm = 0;

  /** True after init() succeeded. */
  get ready(): boolean { return this._ready; }
  /** The underlying AudioContext (null before init). */
  get context(): AudioContext | null { return this.ctx; }
  /** The last mood requested via setMusicMood. */
  get currentMood(): MusicMood { return this.mood; }

  /** Call from a user gesture. Creates/resumes the AudioContext and builds the graph. Safe to call repeatedly. */
  init(): Promise<void> {
    if (this._ready && this.ctx) {
      if (this.ctx.state !== 'running') return this.ctx.resume().catch(() => undefined);
      return Promise.resolve();
    }
    if (!this.pending) this.pending = this.boot().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async boot(): Promise<void> {
    let resumed: Promise<unknown> = Promise.resolve();
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) { console.warn('[AudioEngine] Web Audio API not available'); return; }
      let ctx: AudioContext;
      try { ctx = new Ctor({ latencyHint: 'interactive' }); } catch { ctx = new Ctor(); }
      // resume synchronously inside the gesture; never let a blocked resume hang init()
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
        resumed = Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 400))]);
      }
      const core = new Core(ctx);
      const syn = new Synth(core);
      this.ctx = ctx; this.core = core; this.syn = syn;
      this.title = new TitleComposer(core, syn, MOOD_MIX.title);
      this.moods.set('title', this.title);
      this.moods.set('pastoral', new PastoralComposer(core, syn, MOOD_MIX.pastoral));
      this.moods.set('tension', new TensionComposer(core, syn, MOOD_MIX.tension));
      this.moods.set('battle', new BattleComposer(core, syn, MOOD_MIX.battle));
      this.moods.set('victory', new VictoryComposer(core, syn, MOOD_MIX.victory));
      this.lib = new SfxLib(core, syn);
      this.lib.onTitleHit = (t) => { if (this.title) this.title.reveal(t); };
      this.amb = new Ambience(core);
      this.sling = new SlingSpin(core);
      core.master.gain.value = this.vol;
      core.mute.gain.value = this.muted ? 0 : 1;
      core.musicIn.gain.value = MUSIC_GAIN * this.musicVol;
      core.sfxWorld.gain.value = this.sfxVol;
      core.uiIn.gain.value = this.sfxVol;
      this.amb.setLevels(this.amblv, ctx.currentTime);
      this._ready = true;
      this.lastTick = ctx.currentTime;
      this.nextWarm = ctx.currentTime + 0.05;
      this.applyMood(this.moodFade);
      this.timer = setInterval(() => this.tick(), 40);
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const h = (): void => {
          const x = this.ctx;
          if (x && x.state !== 'running' && x.state !== 'closed') x.resume().catch(() => undefined);
        };
        for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, h, { capture: true, passive: true });
        this.unlock = h;
      }
      this.tick();
    } catch (e) {
      console.warn('[AudioEngine] init failed', e);
      this.teardown();
      return;
    }
    await resumed;
  }

  setMasterVolume(v: number): void {
    this.vol = clamp(fin(v, this.vol), 0, 1);
    const c = this.core;
    if (c) c.master.gain.setTargetAtTime(this.vol, c.ctx.currentTime, 0.03);
  }

  setMuted(m: boolean): void {
    this.muted = !!m;
    const c = this.core;
    if (c) c.mute.gain.setTargetAtTime(this.muted ? 0 : 1, c.ctx.currentTime, 0.04);
  }

  /** Extra: music bus volume 0..1 (settings menu). */
  setMusicVolume(v: number): void {
    this.musicVol = clamp(fin(v, this.musicVol), 0, 1);
    const c = this.core;
    if (c) c.musicIn.gain.setTargetAtTime(MUSIC_GAIN * this.musicVol, c.ctx.currentTime, 0.05);
  }

  /** Extra: sound-effects volume 0..1 (settings menu). Ambience is not affected. */
  setSfxVolume(v: number): void {
    this.sfxVol = clamp(fin(v, this.sfxVol), 0, 1);
    const c = this.core;
    if (c) {
      c.sfxWorld.gain.setTargetAtTime(this.sfxVol, c.ctx.currentTime, 0.05);
      c.uiIn.gain.setTargetAtTime(this.sfxVol, c.ctx.currentTime, 0.05);
    }
  }

  /** Crossfade to a mood (default ~3 s). Can be called before init(); applied once audio starts. */
  setMusicMood(mood: MusicMood, fadeSeconds = 3): void {
    const m: MusicMood = mood === 'title' || mood === 'pastoral' || mood === 'tension' || mood === 'battle' || mood === 'victory'
      ? mood : 'silence';
    const f = clamp(fin(fadeSeconds, 3), 0, 30);
    if (m === this.mood && this.core) return;
    this.mood = m;
    this.moodFade = f;
    this.applyMood(f);
  }

  private applyMood(fade: number): void {
    const c = this.core;
    if (!c) return;
    const now = c.ctx.currentTime;
    for (const [name, comp] of this.moods) {
      try {
        if (name === this.mood) comp.activate(now, fade);
        else comp.deactivate(now, fade);
      } catch { /* ignore */ }
    }
  }

  /** 0..1 each, smoothed. Omitted keys keep their value. All default to 0. */
  setAmbience(levels: AmbienceLevels): void {
    if (!levels || typeof levels !== 'object') return;
    for (const k of ['wind', 'cicadas', 'birds'] as const) {
      const v = levels[k];
      if (v !== undefined) this.amblv[k] = clamp(fin(v, this.amblv[k]), 0, 1);
    }
    if (this.amb && this.core) {
      try { this.amb.setLevels(this.amblv, this.core.ctx.currentTime); } catch { /* ignore */ }
    }
  }

  sfx(name: SfxName, opts?: SfxOptions): void {
    if (!this._ready || !this.lib || !this.core) return;
    try { this.lib.play(name, opts, this.core.ctx.currentTime); } catch { /* sfx must never throw */ }
  }

  /** Extra: pluck a kinnor string (midi note number, e.g. 62 = D4). */
  playLyre(midi: number, velocity = 0.7): void {
    if (!this._ready || !this.syn || !this.core) return;
    try {
      const m = clamp(Math.round(fin(midi, 62)), 36, 96);
      const vel = clamp(fin(velocity, 0.7), 0, 1);
      this.syn.lyre({ dry: this.core.uiIn, wet: null }, this.core.ctx.currentTime + 0.01, m, vel, lyrePan(m));
    } catch { /* ignore */ }
  }

  slingSpin(active: boolean, power: number): void {
    if (!this._ready || !this.sling || !this.core) return;
    try { this.sling.set(!!active, power, this.core.ctx.currentTime); } catch { /* ignore */ }
  }

  setSlowMotion(amount: number): void {
    this.slowTarget = clamp(fin(amount, 0), 0, 1);
    if (this._ready && Math.abs(this.slowTarget - this.slowAmt) > 0.05) this.tick();
  }

  /** Extra: enable/disable the automatic heartbeat that accompanies slow motion (default on). */
  setAutoHeartbeat(on: boolean): void { this.autoBeat = !!on; }

  update(dt: number): void {
    void dt; // timing comes from the AudioContext clock
    if (!this._ready) return;
    this.tick();
  }

  dispose(): void { this.teardown(); }

  // --------------------------------------------------------------------------

  private tick(): void {
    const c = this.core;
    if (!c || !this._ready) return;
    const now = c.ctx.currentTime;
    const dt = clamp(now - this.lastTick, 0, 0.25);
    this.lastTick = now;
    this.slowAmt += (this.slowTarget - this.slowAmt) * (1 - Math.exp(-dt * 6));
    if (Math.abs(this.slowTarget - this.slowAmt) < 0.002) this.slowAmt = this.slowTarget;
    if (Math.abs(this.slowAmt - this.slowApplied) > 0.003) {
      this.slowApplied = this.slowAmt;
      this.applySlow(now);
    }
    const hidden = typeof document !== 'undefined' && document.hidden;
    const horizon = now + (hidden ? 1.5 : 0.3);
    for (const m of this.moods.values()) {
      try { m.schedule(now, horizon); } catch { /* keep the other moods alive */ }
    }
    try { if (this.amb) this.amb.tick(now, this.slowAmt); } catch { /* ignore */ }
    try { if (this.sling) this.sling.tick(now); } catch { /* ignore */ }
    if (this.autoBeat && this.lib && this.slowAmt > 0.15 && now >= this.nextBeat) {
      try { this.lib.play('heartbeat', { volume: 0.2 + 0.4 * this.slowAmt }, now); } catch { /* ignore */ }
      this.nextBeat = now + lerp(0.95, 1.2, this.slowAmt);
    }
    if (now >= this.nextSweep) {
      c.sweep(now);
      this.nextSweep = now + 0.5;
    }
    if (now >= this.nextWarm) { // bake pending buffers gradually (a few ms each)
      this.nextWarm = now + 0.03;
      try { c.warm(); } catch { /* ignore */ }
    }
  }

  private applySlow(now: number): void {
    const c = this.core;
    if (!c) return;
    const a = this.slowAmt;
    c.slowFilter.frequency.setTargetAtTime(c.hz(expLerp(18000, 600, a)), now, 0.05);
    c.slowFilter.Q.setTargetAtTime(0.7 + 0.6 * a, now, 0.05);
    c.musicDuck.gain.setTargetAtTime(1 - 0.3 * a, now, 0.08);
    c.slowVerb.gain.setTargetAtTime(0.4 * a, now, 0.08);
    c.slowPitch = 1 - 0.2 * a;
  }

  private teardown(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.unlock && typeof window !== 'undefined') {
      for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, this.unlock, { capture: true });
      this.unlock = null;
    }
    try { if (this.sling) this.sling.teardown(); } catch { /* ignore */ }
    try { if (this.amb) this.amb.dispose(); } catch { /* ignore */ }
    try { if (this.core) this.core.dispose(); } catch { /* ignore */ }
    const ctx = this.ctx;
    this._ready = false;
    this.ctx = null; this.core = null; this.lib = null; this.syn = null;
    this.amb = null; this.sling = null; this.title = null;
    this.moods.clear();
    this.slowApplied = -1;
    if (ctx && ctx.state !== 'closed' && typeof ctx.close === 'function') ctx.close().catch(() => undefined);
  }
}
