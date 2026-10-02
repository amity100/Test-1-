/**
 * DAVID audio — shared synthesis core (helpers, music theory, offline DSP bakers, Core bus graph,
 * Voice, Synth instruments, Composer base). Split out of AudioEngine.ts so the intro score and the
 * ambience beds can share it without circular imports. Everything here is internal to src/audio.
 */

// ============================================================================
// Small helpers
// ============================================================================

export const TAU = Math.PI * 2;
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const expLerp = (a: number, b: number, t: number): number => a * Math.pow(b / a, t);
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const randi = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
export const chance = (p: number): boolean => Math.random() < p;
export const white = (): number => Math.random() * 2 - 1;
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/** Pitch class relative to D (D = 0). */
export const pcOf = (m: number): number => (((m - 2) % 12) + 12) % 12;
export const fin = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
export function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export type Curve = NonNullable<WaveShaperNode['curve']>;
export type NoiseKind = 'white' | 'pink' | 'brown';

/** Linear attack then exponential decay. Returns the time the voice is ~-60 dB. */
export function perc(p: AudioParam, t: number, a: number, peak: number, tau: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(0, t + a, tau);
  return t + a + tau * 7;
}

/** Piecewise-linear automation: pts are [fractionOfDur, value]. */
export function contour(p: AudioParam, t: number, dur: number, pts: ReadonlyArray<readonly [number, number]>, scale = 1): void {
  p.setValueAtTime(pts[0][1] * scale, t);
  for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1] * scale, t + pts[i][0] * dur);
}

/**
 * Click-free glide from whatever the param is doing now (used for crossfades/ducks).
 * setTargetAtTime always starts from the true current value; a linear ramp would start
 * from the previous *event*, which jumps when that event finished long ago. ~98% at `dur`.
 */
export function rampTo(p: AudioParam, v: number, at: number, dur: number): void {
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(at);
  else p.cancelScheduledValues(at);
  p.setTargetAtTime(v, at, Math.max(0.005, dur / 4));
}

/** Smooth 1-D value noise in [0,1]. */
export class SmoothNoise {
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

export type ChordName = 'Dm' | 'D' | 'Eb' | 'F' | 'G' | 'Gm' | 'A' | 'Am' | 'Bb' | 'Bm' | 'C' | 'Cm' | 'Em';
/** Chord pitch classes relative to D, root first. */
export const CHORDS: Record<ChordName, readonly number[]> = {
  Dm: [0, 3, 7], D: [0, 4, 7], Eb: [1, 5, 8], F: [3, 7, 10], G: [5, 9, 0], Gm: [5, 8, 0],
  A: [7, 11, 2], Am: [7, 10, 2], Bb: [8, 0, 3], Bm: [9, 0, 4], C: [10, 2, 5], Cm: [10, 1, 5], Em: [2, 5, 9],
};

export const SCALES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  freygish: [0, 1, 4, 5, 7, 8, 10], // D Eb F# G A Bb C
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

/** All midi notes in [lo, hi] belonging to the chord, ascending. */
export function voicing(pcs: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(pcOf(m))) out.push(m);
  return out;
}
/** Lowest midi >= lo whose pitch class is the chord root. */
export function rootIn(pcs: readonly number[], lo: number): number {
  let m = lo;
  while (pcOf(m) !== pcs[0]) m++;
  return m;
}
export function scaleNotes(scale: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (scale.includes(pcOf(m))) out.push(m);
  return out;
}
export function degToMidi(scale: readonly number[], base: number, deg: number): number {
  const o = Math.floor(deg / 7);
  return base + scale[((deg % 7) + 7) % 7] + 12 * o;
}
export function snapToChord(sc: readonly number[], idx: number, pcs: readonly number[]): number {
  for (let d = 0; d < sc.length; d++) {
    for (const j of [idx - d, idx + d]) if (j >= 0 && j < sc.length && pcs.includes(pcOf(sc[j]))) return j;
  }
  return idx;
}
export const lyrePan = (m: number): number => clamp((m - 66) / 22, -0.55, 0.55);

export type Vowel = 'ah' | 'oh' | 'oo' | 'eh';
export const VOWELS: Record<Vowel, readonly [number, number, number]> = {
  ah: [720, 1120, 2600],
  oh: [520, 860, 2450],
  oo: [340, 800, 2300],
  eh: [560, 1800, 2550],
};

// ============================================================================
// Offline DSP — used to bake one-shot buffers (drums, footsteps, lyre strings, IR ...)
// ============================================================================

export type BQType = 'lp' | 'hp' | 'bp' | 'peak';

/** RBJ biquad for sample-by-sample processing in JS. */
export class BQ {
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
export function bake(
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
export function bakeNoise(ctx: BaseAudioContext, kind: NoiseKind, seconds: number, channels: number): AudioBuffer {
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
export function bakeImpulse(ctx: BaseAudioContext, seconds: number, pre: number): AudioBuffer {
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
export function addGrains(
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

export type DrumKind = 'dum' | 'tek' | 'ka' | 'taiko' | 'boom';

/** Cheap tanh-like soft saturation (Padé), for baking. */
export const sat = (x: number): number => {
  const c = x < -3 ? -3 : x > 3 ? 3 : x;
  return (c * (27 + c * c)) / (27 + 9 * c * c);
};

/** Per-sample multiplier giving exp(-t/tau) decay (cheap envelopes for baking). */
export const dk = (tau: number, sr: number): number => Math.exp(-1 / (tau * sr));

export function bakeDrum(ctx: BaseAudioContext, kind: DrumKind): AudioBuffer {
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

export function bakeStep(ctx: BaseAudioContext, run: boolean): AudioBuffer {
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

export function bakeSkid(ctx: BaseAudioContext): AudioBuffer {
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

export function bakeGravel(ctx: BaseAudioContext): AudioBuffer {
  return bake(ctx, 0.5, 1, (d, sr) => {
    addGrains(d[0], sr, randi(6, 12), 0.0, 0.35, 2000, 7000, 0.2, 0.8, 0.0008, 0.004, 0.2);
  }, 0.8);
}

export function bakeJar(ctx: BaseAudioContext): AudioBuffer {
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

export function bakeRustle(ctx: BaseAudioContext): AudioBuffer {
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

/**
 * A small bronze bell on a sheep or a goat (CUT v5: the flock at Bethlehem, at Rachel's stone, below David): a dull
 * clapper knock and a short inharmonic ring (modal synthesis — damped sinusoid recurrences, no per-sample sin()).
 * Played back at a rate per bell (pitch).
 */
export function bakeBell(ctx: BaseAudioContext): AudioBuffer {
  return bake(ctx, 1.4, 1, (d, sr, len) => {
    const y = d[0];
    const f0 = rand(860, 1020);
    const modes: ReadonlyArray<readonly [number, number, number]> = [
      [1, 1, rand(0.38, 0.55)], [2.13, 0.55, 0.26], [2.98, 0.36, 0.19], [4.32, 0.22, 0.1], [5.95, 0.12, 0.05],
    ];
    for (const [r, a, tau] of modes) {
      const w = (TAU * f0 * r * rand(0.992, 1.008)) / sr;
      if (w >= Math.PI) continue;
      const rr = Math.exp(-1 / (tau * sr)), c1 = 2 * rr * Math.cos(w), c2 = rr * rr, ph = Math.random() * TAU;
      let y1 = Math.sin(ph - w) / rr, y2 = Math.sin(ph - 2 * w) / (rr * rr);
      for (let i = 0; i < len; i++) { const v = c1 * y1 - c2 * y2; y2 = y1; y1 = v; y[i] += v * a; }
    }
    // the clapper: a dull knock (wood / bronze, damped by the wool)
    const bp = new BQ('bp', rand(1800, 2600), 1.3, sr);
    const n = Math.floor(0.005 * sr);
    for (let i = 0; i < n; i++) y[i] += bp.run(white()) * 1.4 * (1 - i / n);
    const fi = Math.floor(0.0008 * sr);
    for (let i = 0; i < fi; i++) y[i] *= i / fi;
  }, 0.85, 24000);
}

export interface KSNote { buf: AudioBuffer; rate: number; }

/**
 * Karplus-Strong plucked gut string with a wooden body (the kinnor). Baked at 24 kHz to save
 * memory; tuning is corrected exactly through the playback rate.
 */
export function bakeKS(ctx: BaseAudioContext, midi: number, bright: number): KSNote {
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

export type BankName = DrumKind | 'stepWalk' | 'stepRun' | 'skid' | 'gravel' | 'jar' | 'rustle' | 'bell';
export const BANKS: Record<BankName, { n: number; make: (ctx: BaseAudioContext) => AudioBuffer }> = {
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
  bell: { n: 3, make: bakeBell },
};

// ============================================================================
// Core: context, master chain, shared buffers, node garbage collection
// ============================================================================

export class Core {
  readonly sr: number;
  readonly musicIn: GainNode;
  readonly musicDuck: GainNode;
  readonly worldIn: GainNode;
  /** The ambience beds and the legacy wind / cicadas / birds enter the world here (the film score ducks it). */
  readonly ambIn: GainNode;
  readonly sfxWorld: GainNode;
  readonly uiIn: GainNode;
  readonly slowFilter: BiquadFilterNode;
  readonly slowVerb: GainNode;
  readonly hallIn: GainNode;
  /** Return of the shared hall reverb (the film score ducks it to cut a reverb tail at once). */
  readonly hallRet: GainNode;
  /** Resting level of `hallRet`. */
  readonly hallLevel = 1.25;
  readonly echoIn: GainNode;
  readonly master: GainNode;
  readonly mute: GainNode;
  readonly out: AudioNode;
  readonly noise: Record<NoiseKind, AudioBuffer>;
  slowPitch = 1;
  /** Length of the shared hall impulse (baked on the first warm()); phones use a shorter one (CPU). */
  irSeconds = 3.0;

  private garbage: Array<{ t: number; nodes: AudioNode[] }> = [];
  private readonly banks = new Map<BankName, AudioBuffer[]>();
  private readonly warmQueue: BankName[] = ['stepWalk', 'dum', 'tek', 'ka', 'taiko', 'stepRun', 'gravel', 'boom', 'jar', 'rustle', 'skid', 'bell'];
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
    this.ambIn = g(1);
    this.ambIn.connect(this.worldIn);
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
    const hret = g(this.hallLevel);
    this.hallRet = hret;
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
    if (!this.conv.buffer) { this.conv.buffer = bakeImpulse(this.ctx, this.irSeconds, 0.025); return; }
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

export class Voice {
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

export interface Out { dry: AudioNode; wet: AudioNode | null; }
/** Per-kind loudness trims so drum velocities are comparable. */
export const DRUM_GAIN: Record<DrumKind, number> = { dum: 0.55, tek: 1.6, ka: 1.4, taiko: 0.55, boom: 1 };
export function connectOut(n: AudioNode, o: Out): void {
  n.connect(o.dry);
  if (o.wet) n.connect(o.wet);
}

export interface PadOpts {
  level: number; attack: number; release: number; cutoff: number; cutoffEnd?: number; q?: number;
  detune?: number; voices?: number; type?: OscillatorType; lfoCents?: number; trem?: number; tremRate?: number;
  /** bowed-string pitch vibrato depth (cents), its rate (Hz) and the delay before it blooms (s) */
  vib?: number; vibRate?: number; vibDelay?: number;
}
export interface ChoirOpts { level: number; attack: number; release: number; vowel: Vowel; to?: Vowel; morph?: number; breath?: number; }
export type ShofarCall = 'tekiah' | 'gedolah' | 'shevarim' | 'teruah';
export interface NeyNote { midi: number; dur: number; } // midi < 0 = breath rest

export class Synth {
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
    let vibG: GainNode | null = null;
    if (o.vib && o.vib > 0) {
      const vl = v.osc('sine', (o.vibRate ?? 5.3) * rand(0.94, 1.06), 0, t);
      vibG = v.gain(0);
      const vd = Math.min(Math.max(0.05, o.vibDelay ?? 0.35), Math.max(0.06, dur * 0.6));
      vibG.gain.setValueAtTime(0, t);
      vibG.gain.linearRampToValueAtTime(0, t + vd);
      vibG.gain.linearRampToValueAtTime(o.vib, t + vd + 0.5);
      vl.connect(vibG);
    }
    let k = 0;
    for (const m of midis) {
      for (let i = 0; i < n; i++) {
        const d = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * det + rand(-2, 2);
        const osc = v.osc(o.type ?? 'sawtooth', mtof(m), d, t + rand(0, 0.03));
        if (vibG) vibG.connect(osc.detune);
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
export function makeMelody(
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

export abstract class Composer {
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

  /**
   * Fade in over `fade` s. A stopped composer starts its first bar at `startAt` (context time; default now + 0.12) —
   * the film's score hands over on its own bar line that way (phase-locked, no seam).
   */
  activate(now: number, fade: number, startAt?: number): void {
    if (!this.running) {
      this.running = true;
      this.step = 0;
      this.nextTime = startAt !== undefined && Number.isFinite(startAt) ? Math.max(now + 0.005, startAt) : now + 0.12;
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
export const MOTIF_DEG = [0, 4, 3, 2, 1, 2, 0];
export const MOTIF_LEN = [2, 2, 1, 1, 1, 1, 4];
