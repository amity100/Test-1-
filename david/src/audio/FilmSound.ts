/**
 * DAVID — sound design of the opening film "הַטּוֹב מִמֶּךָּ" (CUT v4, docs/intro-script-v4.md) and of the bear's hook in
 * gameplay, synthesised in WebAudio.
 *
 * Every generator writes into an `Out` (dry + optional hall send) at an exact context time, so the score
 * (IntroScore.ts) can place it on the film clock. Layers:
 *   - wind swells (Saul's cloak in the slow motion, David on the rock), dust gusts (Gilgal);
 *   - the army of Israel at Gilgal (1 Sam 15:4, 15:12): thousands on foot — a baked marching texture (no
 *     horses, no chariots), bronze clinks of spears and scale armour, spear shafts on shields, the murmur of the
 *     ranks and their ROAR (held to the hard cut);
 *   - the spoil (1 Sam 15:14, the bleating of the sheep and the lowing of the oxen): far, faint;
 *   - the torn robe (15:27): a slowed rip — fibres parting, threads snapping — baked as one buffer to the beats;
 *   - David's hills: a chukar and a bulbul at golden hour;
 *   - the thicket (CUT v4: the bear's hook in gameplay, played by AudioEngine's 'birdsScatter' / 'eyesSting' and the
 *     'hush' mood): small birds flushed from the bushes, leaves and twigs shifting, the heavy breathing of something
 *     large, a low rumble, the heart, the body of a dark sting;
 *   - hits: the sub drop / crack of the big cuts (the shofar, the title smash), the braam, a reverse "suck" into a cut.
 * Nothing here is sampled: all buffers are baked procedurally once (at the start of the film, under the black
 * time card) and reused. Phones (`lite`) get fewer simultaneous voices and sub layers moved into their band.
 */
import { Core, Voice, BQ, bake, addGrains, white, clamp, rand, randi, chance, mtof, type Out, type Curve } from './synth';

/** Flock / heart sounds borrowed from the engine's SFX library, played at an exact time into `dest`. */
export type FilmSfx = 'sheepBleat' | 'goatBleat' | 'lambBleat' | 'heartbeat' | 'bearGrowl';
export type SfxAtFn = (name: FilmSfx, t: number, volume: number, pan: number, pitch: number, dest: AudioNode) => void;

const out2 = (n: AudioNode, o: Out, wet = 1, v?: Voice): void => {
  n.connect(o.dry);
  if (o.wet) {
    if (wet === 1 || !v) n.connect(o.wet);
    else { const g = v.gain(wet); n.connect(g); g.connect(o.wet); }
  }
};

export class FilmSound {
  sfxAt: SfxAtFn | null = null;
  private marchBuf: AudioBuffer | null = null;
  private ripBuf: AudioBuffer | null = null;
  /** the tear's beats (s from the pull): the rip runs, the corner comes free */
  private ripShape: readonly [number, number] = [0.4, 1.6];
  private drive: Curve | null = null;

  constructor(private readonly c: Core, private lite: boolean) {}

  setLite(on: boolean): void { this.lite = on; }

  /**
   * Shape the baked tear to the beats of the insert: `run` = s from the pull until the rip runs, `free` = s from the
   * pull until the corner comes free. Call before the bake (IntroScore.start does); a changed shape re-bakes.
   */
  shapeRip(run: number, free: number): void {
    const r = clamp(Number.isFinite(run) ? run : 0.4, 0.05, 3), f = clamp(Number.isFinite(free) ? free : 1.6, r + 0.2, 5);
    if (Math.abs(r - this.ripShape[0]) > 0.01 || Math.abs(f - this.ripShape[1]) > 0.01) { this.ripShape = [r, f]; this.ripBuf = null; }
  }

  /** Drop the baked buffers (after the film; sources still playing keep theirs alive until they end). */
  release(): void { this.marchBuf = null; this.ripBuf = null; }

  /** True when every film buffer is baked. */
  get ready(): boolean { return !!this.marchBuf && !!this.ripBuf; }

  /**
   * Bake ONE pending film buffer (the march loop, then the tear) — call it under the black time card, once per
   * tick, so no single frame carries all the work. Returns the milliseconds spent (0 when nothing was pending).
   */
  prepareStep(): number {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!this.drive) this.drive = this.c.curve('drive', 3);
    if (!this.marchBuf) this.marchBuf = bakeMarch(this.c.ctx);
    else if (!this.ripBuf) this.ripBuf = bakeRip(this.c.ctx, this.ripShape[0], this.ripShape[1]);
    else return 0;
    return (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }

  // ------------------------------------------------------------------------------------------ air

  /** A wind swell: low body + a whistling band that sweeps up and down (the flight, the rise, dust). */
  windSwell(o: Out, t: number, dur: number, level: number, f0 = 380, f1 = 1400, pan0 = -0.5, pan1 = 0.5): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', f0, 0.9), g = v.gain(0), p = v.pan(pan0);
    const b = v.noise('brown', t), lp = v.filter('lowpass', 160, 0.6), bg = v.gain(0);
    bp.frequency.setValueAtTime(this.c.hz(f0), t);
    bp.frequency.exponentialRampToValueAtTime(this.c.hz(f1), t + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(this.c.hz(f0 * 1.2), t + dur);
    const G = g.gain, B = bg.gain;
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(level, t + dur * 0.55); G.linearRampToValueAtTime(0, t + dur);
    B.setValueAtTime(0, t); B.linearRampToValueAtTime(level * 1.6, t + dur * 0.5); B.linearRampToValueAtTime(0, t + dur);
    if ('pan' in p) {
      const P = (p as StereoPannerNode).pan;
      P.setValueAtTime(pan0, t); P.linearRampToValueAtTime(pan1, t + dur);
    }
    n.connect(bp); bp.connect(g); g.connect(p);
    b.connect(lp); lp.connect(bg); bg.connect(p);
    out2(p, o, 0.4, v);
    v.play(t, t + dur + 0.05);
  }

  /** Dust driven across the plain: gritty high band + a low push, with sand grains. */
  dustGust(o: Out, t: number, dur: number, level: number): void {
    const v = new Voice(this.c);
    const n = v.noise('white', t), bp = v.filter('bandpass', 1800, 0.7), g = v.gain(0);
    const b = v.noise('brown', t), lp = v.filter('lowpass', 220, 0.7), bg = v.gain(0);
    const p = v.pan(rand(-0.6, 0.6));
    bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(rand(2600, 3800), t + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(1200, t + dur);
    const G = g.gain, B = bg.gain;
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(level * 0.35, t + dur * 0.45); G.linearRampToValueAtTime(0, t + dur);
    B.setValueAtTime(0, t); B.linearRampToValueAtTime(level, t + dur * 0.4); B.linearRampToValueAtTime(0, t + dur);
    n.connect(bp); bp.connect(g); g.connect(p);
    b.connect(lp); lp.connect(bg); bg.connect(p);
    out2(p, o, 0.3, v);
    v.play(t, t + dur + 0.05);
  }

  // ------------------------------------------------------------------------------------------ the army

  /**
   * Thousands on foot (a looped baked texture of loose ranks on dry earth). `rate` < 1 slows and deepens it
   * (the slow motion of shot 7); `lp` = lowpass (distance).
   */
  march(o: Out, t: number, dur: number, level: number, rate = 1, lp = 6000, fadeIn = 0.4): void {
    if (!this.marchBuf) this.marchBuf = bakeMarch(this.c.ctx);
    const v = new Voice(this.c);
    const s = v.buffer(this.marchBuf, rate, t);
    s.loop = true;
    const f = v.filter('lowpass', lp, 0.6), g = v.gain(0);
    const G = g.gain;
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(level, t + fadeIn);
    G.setValueAtTime(level, t + Math.max(fadeIn, dur - 0.3)); G.linearRampToValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); out2(g, o, 0.25, v);
    v.play(t, t + dur + 0.05);
  }

  /** Bronze on bronze: spear butts, scales of armour, a shield rim. */
  clinks(o: Out, t: number, level: number, n = 0): void {
    const v = new Voice(this.c);
    const k = n || (chance(0.4) ? 2 : 1);
    const p = v.pan(rand(-0.85, 0.85));
    out2(p, o, 0.5, v);
    let x = 0;
    for (let j = 0; j < k; j++) {
      const f = rand(1500, 3300), tt = t + x;
      const amps = [1, 0.5, 0.28], ratios = [1, 2.76, 5.4], taus = [rand(0.07, 0.16), 0.05, 0.025];
      for (let i = 0; i < 3; i++) {
        const os = v.osc('sine', this.c.hz(f * ratios[i]), 0, tt), g = v.gain(0);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(level * amps[i] * (j ? 0.6 : 1), tt + 0.0015);
        g.gain.setTargetAtTime(0, tt + 0.0015, taus[i]);
        os.connect(g); g.connect(p);
      }
      x += rand(0.07, 0.22);
    }
    v.play(t, t + x + 1);
  }

  /**
   * The murmur of a great crowd for `dur` s: a few babbling voice streams (voiced source through moving vowel
   * formants) over a band-limited "many people" noise bed with syllabic flutter.
   */
  murmur(o: Out, t: number, dur: number, level: number, streams = 0): void {
    const v = new Voice(this.c);
    const bus = v.gain(0), p = v.pan(0);
    bus.connect(p); out2(p, o, 0.6, v);
    const B = bus.gain;
    B.setValueAtTime(0, t); B.linearRampToValueAtTime(level, t + Math.min(1, dur * 0.3));
    B.setValueAtTime(level, t + Math.max(0.5, dur - 0.6)); B.linearRampToValueAtTime(0, t + dur);
    // the bed: noise in the speech band with a fast random flutter
    const n = v.noise('pink', t), b1 = v.filter('bandpass', 520, 1.4), b2 = v.filter('bandpass', 1300, 2), fl = v.gain(0.5);
    n.connect(b1); n.connect(b2); b1.connect(fl); b2.connect(fl);
    const nb = v.gain(0.9); fl.connect(nb); nb.connect(bus);
    const F = fl.gain;
    F.setValueAtTime(0.5, t);
    for (let x = 0; x < dur; x += rand(0.07, 0.16)) F.linearRampToValueAtTime(rand(0.25, 0.8), t + x);
    // voice streams
    const k = streams || (this.lite ? 3 : 6);
    for (let i = 0; i < k; i++) this.babble(v, bus, t + rand(0, 0.5), dur - 0.5, 0.5 + 0.5 * Math.random());
    v.play(t, t + dur + 0.1);
  }

  private babble(v: Voice, dest: AudioNode, t: number, dur: number, amp: number): void {
    if (dur <= 0.2) return;
    const f0 = rand(95, 165);
    const os = v.osc('sawtooth', f0, 0, t);
    const f1 = v.filter('bandpass', 600, 5), f2 = v.filter('bandpass', 1300, 7), g1 = v.gain(2), g2 = v.gain(1.1);
    const env = v.gain(0), pn = v.pan(rand(-0.9, 0.9));
    os.connect(f1); os.connect(f2); f1.connect(g1); f2.connect(g2); g1.connect(env); g2.connect(env);
    env.connect(pn); pn.connect(dest);
    const VOW: ReadonlyArray<readonly [number, number]> = [[720, 1150], [520, 880], [360, 820], [560, 1750], [330, 2100], [650, 1450]];
    const E = env.gain, P = os.frequency;
    E.setValueAtTime(0, t);
    let x = 0;
    while (x < dur) {
      const d = rand(0.09, 0.24), tt = t + x;
      const [a, b] = VOW[randi(0, VOW.length - 1)];
      f1.frequency.setTargetAtTime(a, tt, 0.03); f2.frequency.setTargetAtTime(b, tt, 0.03);
      P.setTargetAtTime(f0 * rand(0.86, 1.16), tt, 0.04);
      const a0 = 0.05 * amp * rand(0.5, 1);
      E.setTargetAtTime(a0, tt, 0.02);
      E.setTargetAtTime(a0 * 0.2, tt + d * 0.75, 0.03);
      x += d + (chance(0.18) ? rand(0.15, 0.5) : 0.01);
    }
    E.setTargetAtTime(0, t + dur, 0.05);
  }

  /**
   * The ROAR of thousands (G3): shouting male voices (driven saws, rising pitch, "ah"/"eh" formants), staggered over
   * `spread` s, over a broadband formant-shaped noise wall and stamping. Rings until `dur`; over its last 0.8 s it
   * sinks to `tail` × level (1 = held at full voice to the end: the roar the silence cuts off).
   */
  roar(o: Out, t: number, dur: number, level: number, spread = 0.45, tail = 0.55): void {
    const v = new Voice(this.c);
    const bus = v.gain(0), p = v.pan(0);
    const drive = v.shaper(this.drive ?? this.c.curve('drive', 3));
    bus.connect(drive); drive.connect(p); out2(p, o, 0.9, v);
    const B = bus.gain;
    B.setValueAtTime(0, t); B.linearRampToValueAtTime(level * 0.6, t + spread * 0.6);
    B.linearRampToValueAtTime(level, t + spread + 0.5);
    B.setValueAtTime(level, t + Math.max(spread + 0.6, dur - 0.8)); B.linearRampToValueAtTime(level * clamp(tail, 0, 1.2), t + dur);
    // the noise wall ("ahh" of thousands)
    const n = v.noise('pink', t), wall = v.gain(1.1);
    for (const [f, q, g] of [[700, 3, 1], [1150, 4, 0.8], [2600, 5, 0.35], [300, 1.2, 0.6]] as const) {
      const bp = v.filter('bandpass', f, q), gg = v.gain(g);
      n.connect(bp); bp.connect(gg); gg.connect(wall);
    }
    wall.connect(bus);
    // shouting voices
    const k = this.lite ? 5 : 11;
    const vox = v.gain(1 / Math.sqrt(k));
    const fA = v.filter('bandpass', 740, 4), fB = v.filter('bandpass', 1250, 5), fC = v.filter('bandpass', 2500, 6);
    const gA = v.gain(1.6), gB = v.gain(1.1), gC = v.gain(0.4);
    vox.connect(fA); vox.connect(fB); vox.connect(fC); fA.connect(gA); fB.connect(gB); fC.connect(gC);
    gA.connect(bus); gB.connect(bus); gC.connect(bus);
    const lowBody = v.filter('lowpass', 500, 0.7), lg = v.gain(0.5);
    vox.connect(lowBody); lowBody.connect(lg); lg.connect(bus);
    for (let i = 0; i < k; i++) {
      const on = t + Math.pow(Math.random(), 0.7) * spread;
      const f0 = rand(125, 200);
      const os = v.osc('sawtooth', f0 * 0.8, rand(-20, 20), on);
      const vib = v.osc('sine', rand(5, 7.5), 0, on), vg = v.gain(rand(15, 35));
      vib.connect(vg); vg.connect(os.detune);
      os.frequency.setValueAtTime(f0 * 0.8, on);
      os.frequency.exponentialRampToValueAtTime(f0 * 1.15, on + rand(0.25, 0.5));
      os.frequency.exponentialRampToValueAtTime(f0 * rand(0.95, 1.08), on + rand(1, 1.8));
      const ge = v.gain(0), pn = v.pan(rand(-0.9, 0.9));
      ge.gain.setValueAtTime(0, on); ge.gain.linearRampToValueAtTime(rand(0.5, 1), on + rand(0.08, 0.2));
      // voices drop out and come back (breaths)
      const end = t + dur;
      let x = on + rand(1.4, 2.6);
      while (x < end - 0.4) {
        ge.gain.setTargetAtTime(0.05, x, 0.06);
        ge.gain.setTargetAtTime(rand(0.5, 1), x + rand(0.25, 0.45), 0.08);
        x += rand(1.6, 2.8);
      }
      os.connect(ge); ge.connect(pn); pn.connect(vox);
    }
    // stamping / spear butts on the ground
    const st = v.noise('brown', t), sl = v.filter('lowpass', 140, 0.8), sg = v.gain(0);
    const S = sg.gain;
    S.setValueAtTime(0, t);
    for (let x = spread; x < dur - 0.2; x += rand(0.18, 0.32)) {
      S.setValueAtTime(0, t + x); S.linearRampToValueAtTime(rand(0.8, 1.4), t + x + 0.01); S.setTargetAtTime(0, t + x + 0.01, 0.05);
    }
    st.connect(sl); sl.connect(sg); sg.connect(p);
    v.play(t, t + dur + 0.1);
  }

  /** Spear shafts knocking on leather-faced wooden shields (visual-bible 3.16): a dull woody thud. */
  knock(o: Out, t: number, level: number, n = 1): void {
    const v = new Voice(this.c);
    const p = v.pan(rand(-0.8, 0.8));
    out2(p, o, 0.4, v);
    let x = 0;
    for (let k = 0; k < n; k++) {
      const tt = t + x;
      const src = v.noise('white', tt), bp = v.filter('bandpass', rand(260, 520), rand(4, 7)), g = v.gain(0);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(level * 3, tt + 0.002); g.gain.setTargetAtTime(0, tt + 0.002, rand(0.02, 0.04));
      src.connect(bp); bp.connect(g); g.connect(p);
      x += rand(0.05, 0.16);
    }
    v.play(t, t + x + 0.3);
  }

  // ------------------------------------------------------------------------------------------ animals

  /**
   * A chukar partridge on the hillside (visual-bible 3.16, golden hour): a run of "chuk" notes that accelerates into
   * the rhythmic "chu-KAR, chu-KAR" — a harsh, reedy harmonic call around 1-2 kHz.
   */
  chukar(o: Out, t: number, level: number, pan = 0.5): void {
    const v = new Voice(this.c);
    const os = v.osc('sawtooth', 900, 0, t), bp = v.filter('bandpass', 1500, 3), g = v.gain(0), p = v.pan(pan);
    os.connect(bp); bp.connect(g); g.connect(p); out2(p, o, 0.6, v);
    const e = v.gain(0.3); p.connect(e); e.connect(this.c.echoSend());
    const F = os.frequency, G = g.gain;
    G.setValueAtTime(0, t);
    let x = 0;
    const chuks = randi(4, 6);
    for (let i = 0; i < chuks; i++) { // chuk chuk chuk… accelerating
      const tt = t + x, d = 0.05;
      F.setValueAtTime(820, tt); F.linearRampToValueAtTime(1050, tt + d * 0.4); F.linearRampToValueAtTime(760, tt + d);
      G.setValueAtTime(0, tt); G.linearRampToValueAtTime(level * 0.7, tt + 0.008); G.linearRampToValueAtTime(0, tt + d);
      x += 0.26 - i * 0.03;
    }
    const pairs = randi(3, 5);
    for (let i = 0; i < pairs; i++) { // chu-KAR
      const tt = t + x;
      F.setValueAtTime(760, tt); F.linearRampToValueAtTime(950, tt + 0.05);
      G.setValueAtTime(0, tt); G.linearRampToValueAtTime(level * 0.6, tt + 0.01); G.linearRampToValueAtTime(0, tt + 0.06);
      const k0 = tt + 0.09;
      F.setValueAtTime(1050, k0); F.linearRampToValueAtTime(1350, k0 + 0.06); F.linearRampToValueAtTime(900, k0 + 0.16);
      G.setValueAtTime(0, k0); G.linearRampToValueAtTime(level, k0 + 0.015); G.linearRampToValueAtTime(0, k0 + 0.17);
      x += 0.42;
    }
    v.play(t, t + x + 0.2);
  }

  /** A bulbul's liquid phrase (a few whistled, gliding notes, 1.5-3 kHz), from a tree near the pasture. */
  bulbul(o: Out, t: number, level: number, pan = -0.4): void {
    const v = new Voice(this.c);
    const os = v.osc('sine', 2000, 0, t), h = v.osc('sine', 4000, 0, t), hg = v.gain(0.15), g = v.gain(0), p = v.pan(pan);
    os.connect(g); h.connect(hg); hg.connect(g); g.connect(p); out2(p, o, 0.5, v);
    const F = os.frequency, H = h.frequency, G = g.gain;
    G.setValueAtTime(0, t);
    let x = 0;
    const n = randi(4, 6);
    for (let i = 0; i < n; i++) {
      const tt = t + x, d = rand(0.1, 0.2);
      const f0 = rand(1500, 2600), f1 = f0 * rand(0.8, 1.3);
      F.setValueAtTime(f0, tt); F.exponentialRampToValueAtTime(f1, tt + d);
      H.setValueAtTime(f0 * 2, tt); H.exponentialRampToValueAtTime(f1 * 2, tt + d);
      G.setValueAtTime(0, tt); G.linearRampToValueAtTime(level * rand(0.6, 1), tt + 0.02); G.linearRampToValueAtTime(0, tt + d);
      x += d + rand(0.03, 0.09);
    }
    v.play(t, t + x + 0.1);
  }

  /** Oxen lowing, far (the spoil, 15:14): a long nasal "mooo" with a falling tail. */
  lowing(o: Out, t: number, level: number, pan = 0): void {
    const v = new Voice(this.c);
    const d = rand(1.5, 2.3), f0 = rand(92, 122);
    const os = v.osc('sawtooth', f0 * 0.85, 0, t), os2 = v.osc('sawtooth', f0 * 0.85, 9, t);
    const f1 = v.filter('bandpass', 380, 4), f2 = v.filter('bandpass', 850, 5), g1 = v.gain(2), g2 = v.gain(0.9);
    const env = v.gain(0), lp = v.filter('lowpass', 1300, 0.6), pn = v.pan(pan);
    os.connect(f1); os2.connect(f1); os.connect(f2); f1.connect(g1); f2.connect(g2);
    g1.connect(env); g2.connect(env); env.connect(lp); lp.connect(pn); out2(pn, o, 0.8, v);
    const e = v.gain(0.25); pn.connect(e); e.connect(this.c.echoSend());
    const F = os.frequency, F2 = os2.frequency;
    for (const P of [F, F2]) {
      P.setValueAtTime(f0 * 0.85, t); P.linearRampToValueAtTime(f0 * 1.05, t + d * 0.3);
      P.linearRampToValueAtTime(f0, t + d * 0.7); P.linearRampToValueAtTime(f0 * 0.78, t + d);
    }
    f1.frequency.setValueAtTime(320, t); f1.frequency.linearRampToValueAtTime(450, t + d * 0.4); f1.frequency.linearRampToValueAtTime(330, t + d);
    const E = env.gain;
    E.setValueAtTime(0, t); E.linearRampToValueAtTime(level, t + 0.25); E.setValueAtTime(level, t + d * 0.7);
    E.linearRampToValueAtTime(0, t + d);
    v.play(t, t + d + 0.1);
  }

  /** Far bleating of the flock (engine SFX, through `dest`). */
  bleat(dest: AudioNode, t: number, vol: number, pan: number, kind: 'sheepBleat' | 'goatBleat' | 'lambBleat' = 'sheepBleat', pitch = 1): void {
    if (this.sfxAt) this.sfxAt(kind, t, vol, pan, pitch, dest);
  }

  heartbeat(dest: AudioNode, t: number, vol: number, pitch = 1): void {
    if (this.sfxAt) this.sfxAt('heartbeat', t, vol, 0, pitch, dest);
  }

  // ------------------------------------------------------------------------------------------ the robe

  /** Saul's fist closes on the corner of the me'il: cloth snatched + a body thump (a jerk). */
  grab(o: Out, t: number, level: number): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 1400, 0.8), g = v.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level * 0.5, t + 0.03); g.gain.setTargetAtTime(0, t + 0.05, 0.08);
    n.connect(bp); bp.connect(g); out2(g, o, 0.6, v);
    const th = v.osc('sine', 90, 0, t), tg = v.gain(0);
    th.frequency.setValueAtTime(95, t); th.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(level, t + 0.008); tg.gain.setTargetAtTime(0, t + 0.01, 0.12);
    th.connect(tg); out2(tg, o, 0.4, v);
    v.play(t, t + 1);
  }

  /**
   * THE TEAR (1 Sam 15:27), slowed: the baked rip (fibres parting and threads snapping, already pitched down) from
   * the pull; `dur` = pull → the corner free. Baked to that shape (shapeRip) it plays at its own speed; otherwise it
   * is time-stretched by the playback rate. A low groan of the stretched wool rises under it until it gives.
   */
  rip(o: Out, t: number, dur: number, level: number): void {
    if (!this.ripBuf) this.ripBuf = bakeRip(this.c.ctx, this.ripShape[0], this.ripShape[1]);
    const v = new Voice(this.c);
    const shaped = this.ripShape[1];
    const rate = clamp(shaped / Math.max(0.3, dur), 0.6, 1.6);
    const s = v.buffer(this.ripBuf, rate, t), lpf = v.filter('lowpass', 3600, 0.6), g = v.gain(level);
    s.connect(lpf); lpf.connect(g); out2(g, o, 0.2, v); // dry (visual-bible 3.3: a dry, fibrous rip)
    const len = this.ripBuf.duration / rate, give = shaped / rate;
    // the groan: stretched wool under tension, rising until it gives
    const gr = v.osc('sawtooth', 48, 0, t), gr2 = v.osc('sawtooth', 48.7, 0, t), lp = v.filter('lowpass', 220, 2), gg = v.gain(0);
    gr.connect(lp); gr2.connect(lp); lp.connect(gg); out2(gg, o, 0.5, v);
    gr.frequency.setValueAtTime(44, t); gr.frequency.linearRampToValueAtTime(58, t + give);
    gr2.frequency.setValueAtTime(44.6, t); gr2.frequency.linearRampToValueAtTime(58.8, t + give);
    const G = gg.gain;
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(level * 0.12, t + give * 0.95); G.setTargetAtTime(0, t + give, 0.08);
    v.play(t, t + len + 0.2);
  }

  // ------------------------------------------------------------------------------------------ the thicket

  /** Something large shifting in the thicket: leaves, a twig cracking, a low body brush. */
  rustle(o: Out, t: number, dur: number, level: number, pan = 0.2): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 2600, 0.8), g = v.gain(0), p = v.pan(pan);
    const G = g.gain;
    G.setValueAtTime(0, t);
    for (let x = 0; x < dur; x += rand(0.08, 0.22)) G.linearRampToValueAtTime(level * rand(0.15, 0.6), t + x);
    G.linearRampToValueAtTime(0, t + dur);
    n.connect(bp); bp.connect(g); g.connect(p);
    const b = v.noise('brown', t), lp = v.filter('lowpass', 260, 0.7), bg = v.gain(0);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(level * 1.2, t + dur * 0.5); bg.gain.linearRampToValueAtTime(0, t + dur);
    b.connect(lp); lp.connect(bg); bg.connect(p);
    // twig cracks
    const cracks = randi(1, 3);
    for (let i = 0; i < cracks; i++) {
      const tt = t + rand(0.1, dur * 0.8);
      const cn = v.noise('white', tt), cb = v.filter('bandpass', rand(1800, 3400), 2.5), cg = v.gain(0);
      cg.gain.setValueAtTime(0, tt); cg.gain.linearRampToValueAtTime(level * 1.8, tt + 0.001); cg.gain.setTargetAtTime(0, tt + 0.001, 0.012);
      cn.connect(cb); cb.connect(cg); cg.connect(p);
    }
    out2(p, o, 0.6, v);
    v.play(t, t + dur + 0.1);
  }

  /**
   * Heavy breathing of something large (in the dark, a few metres away): an in-breath (rising band, nasal)
   * then a long out-breath with a growl-like flutter of the chest.
   */
  breath(o: Out, t: number, level: number, inhale = 1.1, exhale = 1.5): void {
    const v = new Voice(this.c);
    const p = v.pan(0.15);
    out2(p, o, 0.35, v);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 500, 1.4), lp = v.filter('lowpass', 1600, 0.6), g = v.gain(0);
    n.connect(bp); bp.connect(lp); lp.connect(g); g.connect(p);
    const B = bp.frequency, G = g.gain;
    B.setValueAtTime(380, t); B.linearRampToValueAtTime(760, t + inhale);
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(level * 0.6, t + inhale * 0.8); G.linearRampToValueAtTime(level * 0.1, t + inhale);
    const e0 = t + inhale + 0.08;
    B.setValueAtTime(700, e0); B.linearRampToValueAtTime(300, e0 + exhale);
    G.linearRampToValueAtTime(level, e0 + 0.12); G.linearRampToValueAtTime(level * 0.55, e0 + exhale * 0.6); G.linearRampToValueAtTime(0, e0 + exhale);
    // chest flutter on the out-breath (a low, wet growl texture)
    const gr = v.osc('sawtooth', 52, 0, e0), am = v.osc('sine', 23, 0, e0), amg = v.gain(0.45), amn = v.gain(0.55);
    const grg = v.gain(0), glp = v.filter('lowpass', 320, 1.5);
    am.connect(amg); amg.connect(amn.gain); // flutter: 0.1 .. 1.0 around the envelope
    gr.connect(glp); glp.connect(amn); amn.connect(grg); grg.connect(p);
    gr.frequency.setValueAtTime(56, e0); gr.frequency.linearRampToValueAtTime(44, e0 + exhale);
    const R = grg.gain;
    R.setValueAtTime(0, e0); R.linearRampToValueAtTime(level * 0.55, e0 + 0.15); R.linearRampToValueAtTime(0, e0 + exhale);
    v.play(t, e0 + exhale + 0.1);
  }

  /**
   * Small birds flushed out of the bushes (the bear's hook, gameplay): the bush shaking, a burst of wings — `n` birds
   * taking off one after another, each a band of noise beating at its wing rate, flying off (the band falling, the
   * top closing, the level fading) — and their alarm calls (sharp "tchk" chips and a harsh "tcherr", fewer and farther
   * as they go), into the valley echo. Every call is over by about `t + 2.1`. Returns the end time.
   */
  scatter(o: Out, t: number, level: number, n = this.lite ? 4 : 7): number {
    const v = new Voice(this.c);
    const echo = v.gain(0.16); echo.connect(this.c.echoSend());
    // the bush: leaves thrashing, a twig
    this.rustle(o, t - 0.01, 0.45, level * 0.09, rand(-0.2, 0.2));
    // the flock bursting out: a short low-mid whoosh of many wings at once
    const bn = v.noise('pink', t), bb = v.filter('bandpass', 900, 0.7), bg = v.gain(0);
    bb.frequency.setValueAtTime(700, t); bb.frequency.exponentialRampToValueAtTime(1700, t + 0.3);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(level * 0.12, t + 0.05); bg.gain.setTargetAtTime(0, t + 0.08, 0.12);
    bn.connect(bb); bb.connect(bg); out2(bg, o, 0.4, v);
    let end = t + 0.8;
    let x = 0;
    for (let i = 0; i < n; i++) {
      const tt = t + x, d = rand(0.7, 1.35), pan = rand(-0.85, 0.85);
      x += rand(0.025, 0.11);
      const nz = v.noise('pink', tt), bp = v.filter('bandpass', rand(1700, 3300), 0.9), lp = v.filter('lowpass', 9000, 0.6);
      const am = v.gain(0.45), lfo = v.osc('square', rand(15, 24), 0, tt), depth = v.gain(0.55), env = v.gain(0), p = v.pan(pan);
      lfo.connect(depth); depth.connect(am.gain);
      nz.connect(bp); bp.connect(lp); lp.connect(am); am.connect(env); env.connect(p);
      out2(p, o, 0.5, v); p.connect(echo);
      const f0 = bp.frequency.value;
      bp.frequency.setValueAtTime(f0, tt); bp.frequency.exponentialRampToValueAtTime(f0 * 0.75, tt + d);
      lp.frequency.setValueAtTime(this.c.hz(9000), tt); lp.frequency.exponentialRampToValueAtTime(this.c.hz(2600), tt + d);
      lfo.frequency.setValueAtTime(lfo.frequency.value, tt); lfo.frequency.linearRampToValueAtTime(lfo.frequency.value * 0.8, tt + d);
      const E = env.gain, a = level * rand(0.22, 0.34);
      E.setValueAtTime(0, tt); E.linearRampToValueAtTime(a, tt + 0.03); E.setTargetAtTime(0, tt + 0.08, d * 0.3);
      end = Math.max(end, tt + d + 0.2);
    }
    // the alarm calls: 2-3 callers, each a few sharp chips (a fast downward glide), the last ones far
    const callers = this.lite ? 2 : 3;
    for (let k = 0; k < callers; k++) {
      const os = v.osc(k === 2 ? 'sawtooth' : 'sine', 4000, 0, t), g = v.gain(0), p = v.pan(rand(-0.7, 0.7));
      let src: AudioNode = os;
      if (k === 2) { const bp = v.filter('bandpass', 2600, 2.2); os.connect(bp); src = bp; } // the harsh "tcherr"
      src.connect(g); g.connect(p); out2(p, o, 0.6, v); p.connect(echo);
      const F = os.frequency, G = g.gain;
      G.setValueAtTime(0, t);
      let y = rand(0.02, 0.18) + k * 0.07;
      let calls = 0;
      while (y < 1.75 && calls < 7) {
        const tt = t + y, far = Math.max(0.2, 1 - y / 1.9);
        if (k === 2) { // a rattling "tcherr": a short burst of fast chips
          const len = rand(0.14, 0.22);
          for (let z = 0; z < len; z += 0.028) {
            F.setValueAtTime(rand(2300, 2900), tt + z); F.exponentialRampToValueAtTime(1700, tt + z + 0.022);
            G.setValueAtTime(0, tt + z); G.linearRampToValueAtTime(level * 0.06 * far, tt + z + 0.004); G.linearRampToValueAtTime(0, tt + z + 0.024);
          }
          y += len + rand(0.25, 0.5);
        } else { // "tchk": 1-2 sharp chips
          const f0 = rand(3400, 5200), double = chance(0.5);
          for (let j = 0; j < (double ? 2 : 1); j++) {
            const s0 = tt + j * rand(0.06, 0.09), dd = rand(0.035, 0.055);
            F.setValueAtTime(f0, s0); F.exponentialRampToValueAtTime(f0 * 0.55, s0 + dd);
            G.setValueAtTime(0, s0); G.linearRampToValueAtTime(level * 0.075 * far, s0 + 0.004); G.linearRampToValueAtTime(0, s0 + dd);
          }
          y += rand(0.16, 0.38);
        }
        calls++;
      }
      end = Math.max(end, t + y + 0.1);
    }
    v.play(t, end + 0.6);
    return end + 0.6;
  }

  /**
   * The body of a low, dark sting (the bear's eyes opening in the dark, gameplay): a soft sub drop and a low earth
   * thump with a falling mid-range body a phone speaker can play — no crack (a sting, not a cut).
   */
  sting(o: Out, t: number, level: number): void {
    const v = new Voice(this.c);
    const s = v.osc('sine', 58, 0, t), sg = v.gain(0);
    s.frequency.setValueAtTime(58, t); s.frequency.exponentialRampToValueAtTime(30, t + 1.1);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(level * 0.8, t + 0.012); sg.gain.setTargetAtTime(0, t + 0.02, 0.45);
    s.connect(sg); out2(sg, o, 0.3, v);
    const b = v.noise('brown', t), bl = v.filter('lowpass', 160, 0.7), bg = v.gain(0);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(level * 0.9, t + 0.02); bg.gain.setTargetAtTime(0, t + 0.03, 0.35);
    b.connect(bl); bl.connect(bg); out2(bg, o, 0.6, v);
    const bo = v.osc('triangle', 120, 0, t), bog = v.gain(0), bol = v.filter('lowpass', 650, 0.7);
    bo.frequency.setValueAtTime(124, t); bo.frequency.exponentialRampToValueAtTime(58, t + 0.5);
    bog.gain.setValueAtTime(0, t); bog.gain.linearRampToValueAtTime(level * (this.lite ? 0.45 : 0.25), t + 0.01); bog.gain.setTargetAtTime(0, t + 0.02, 0.22);
    bo.connect(bol); bol.connect(bog); out2(bog, o, 0.4, v);
    v.play(t, t + 2.4);
  }

  /** A low rumble that rises (dread): sub beating on D1 + a lowpassed earth rumble. */
  rumble(o: Out, t: number, dur: number, level: number, rise = true): void {
    const v = new Voice(this.c);
    const a = v.osc('sine', mtof(26), 0, t), b = v.osc('sine', mtof(26) * 1.035, 0, t), c3 = v.osc('triangle', mtof(38) * 0.995, 0, t);
    const n = v.noise('brown', t), lp = v.filter('lowpass', 90, 0.8);
    const g = v.gain(0), sub = v.gain(0.5), tri = v.gain(0.12), nz = v.gain(1.6);
    a.connect(sub); b.connect(sub); c3.connect(tri); n.connect(lp); lp.connect(nz);
    sub.connect(g); tri.connect(g); nz.connect(g); out2(g, o, 0.3, v);
    if (this.lite) { // phones: the same dread an octave up, with harmonics the speaker can play (300-600 Hz)
      const ph = v.osc('sawtooth', mtof(38), 0, t), ph2 = v.osc('sawtooth', mtof(38) * 1.02, 0, t), pl = v.filter('lowpass', 560, 1.2), pg = v.gain(0.06);
      ph.connect(pl); ph2.connect(pl); pl.connect(pg); pg.connect(g);
    }
    const G = g.gain;
    G.setValueAtTime(0, t);
    if (rise) { G.linearRampToValueAtTime(level * 0.3, t + dur * 0.3); G.linearRampToValueAtTime(level, t + dur); }
    else { G.linearRampToValueAtTime(level, t + Math.min(1.5, dur * 0.3)); G.setValueAtTime(level, t + dur * 0.7); G.linearRampToValueAtTime(0, t + dur); }
    v.play(t, t + dur + 0.05);
  }

  // ------------------------------------------------------------------------------------------ hits

  /** Sub drop + crack + air: the physical part of a big cut (the shofar cut, the title smash). */
  impact(o: Out, t: number, level: number, tail = 2.5): void {
    const v = new Voice(this.c);
    const s = v.osc('sine', 60, 0, t), sg = v.gain(0);
    s.frequency.setValueAtTime(64, t); s.frequency.exponentialRampToValueAtTime(29, t + 0.9);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(level * 0.9, t + 0.006); sg.gain.setTargetAtTime(0, t + 0.01, tail * 0.3);
    s.connect(sg); out2(sg, o, 0.3, v);
    const n = v.noise('white', t), lp = v.filter('lowpass', 5200, 0.7), ng = v.gain(0);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(level * 0.45, t + 0.002); ng.gain.setTargetAtTime(0, t + 0.002, 0.035);
    n.connect(lp); lp.connect(ng); out2(ng, o, 1, v);
    const b = v.noise('brown', t), bl = v.filter('lowpass', 180, 0.7), bg = v.gain(0);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(level * 1.3, t + 0.01); bg.gain.setTargetAtTime(0, t + 0.01, tail * 0.35);
    b.connect(bl); bl.connect(bg); out2(bg, o, 0.6, v);
    // the body: a falling thump with harmonics a phone speaker can reproduce (the sub alone vanishes on phones)
    const bo = v.osc('triangle', 130, 0, t), bog = v.gain(0), bol = v.filter('lowpass', 700, 0.7);
    bo.frequency.setValueAtTime(140, t); bo.frequency.exponentialRampToValueAtTime(62, t + 0.35);
    bog.gain.setValueAtTime(0, t); bog.gain.linearRampToValueAtTime(level * (this.lite ? 0.5 : 0.3), t + 0.005); bog.gain.setTargetAtTime(0, t + 0.01, 0.16);
    bo.connect(bol); bol.connect(bog); out2(bog, o, 0.4, v);
    v.play(t, t + tail * 2.2);
  }

  /**
   * "Braam": a low brass cluster (driven saws on D2 / A2 / D3 / F3) whose filter tears open and closes — the modern
   * cinematic hit, carried by mid-range harmonics that survive a phone speaker.
   */
  braam(o: Out, t: number, level: number, dur = 2.6, notes: readonly number[] = [38, 45, 50, 53]): void {
    const v = new Voice(this.c);
    const sum = v.gain(1 / Math.sqrt(notes.length * 2));
    for (const m of notes) {
      for (const d of [-7, 7]) {
        const os = v.osc('sawtooth', mtof(m), d + rand(-3, 3), t);
        os.frequency.setValueAtTime(mtof(m) * 0.985, t); os.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.12);
        os.connect(sum);
      }
    }
    const drive = v.shaper(this.drive ?? this.c.curve('drive', 3)), pre = v.gain(1.6);
    const lp = v.filter('lowpass', 250, 2.2), env = v.gain(0);
    sum.connect(pre); pre.connect(drive); drive.connect(lp); lp.connect(env);
    const F = lp.frequency;
    F.setValueAtTime(220, t); F.exponentialRampToValueAtTime(this.c.hz(2600), t + 0.09); F.exponentialRampToValueAtTime(420, t + dur * 0.8);
    const E = env.gain;
    E.setValueAtTime(0, t); E.linearRampToValueAtTime(level, t + 0.02); E.setTargetAtTime(level * 0.45, t + 0.1, 0.35);
    E.setTargetAtTime(0, t + dur * 0.55, dur * 0.2);
    out2(env, o, 0.7, v);
    v.play(t, t + dur + 0.3);
  }

  /**
   * A heartbeat (lub-dub): a sub thump with a muffled mid-range knock on top, so it is felt on headphones and still
   * heard on a phone speaker (the knock is stronger in the phone voicing).
   */
  heart(o: Out, t: number, level: number): void {
    const v = new Voice(this.c);
    const knock = this.lite ? 0.9 : 0.5;
    for (const [dt, a] of [[0, 1], [0.17, 0.65]] as const) {
      const tt = t + dt;
      const s1 = v.osc('sine', 68, 0, tt), g1 = v.gain(0);
      s1.frequency.setValueAtTime(70, tt); s1.frequency.exponentialRampToValueAtTime(42, tt + 0.12);
      g1.gain.setValueAtTime(0, tt); g1.gain.linearRampToValueAtTime(level * a, tt + 0.008); g1.gain.setTargetAtTime(0, tt + 0.01, 0.06);
      s1.connect(g1); out2(g1, o, 0.2, v);
      const n = v.noise('brown', tt), bp = v.filter('bandpass', this.lite ? 340 : 230, 1.6), g2 = v.gain(0);
      g2.gain.setValueAtTime(0, tt); g2.gain.linearRampToValueAtTime(level * a * knock * (this.lite ? 2.4 : 1.6), tt + 0.006); g2.gain.setTargetAtTime(0, tt + 0.008, 0.035);
      n.connect(bp); bp.connect(g2); out2(g2, o, 0.2, v);
    }
    v.play(t, t + 0.7);
  }

  /** A reverse swell ("suck") that ends exactly at `t1` — breath before a hard cut. */
  suck(o: Out, t1: number, dur: number, level: number, bright = 1): void {
    const t = t1 - dur;
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 400, 0.8), g = v.gain(0);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(this.c.hz(2400 * bright), t1);
    const G = g.gain;
    G.setValueAtTime(0, t); G.setTargetAtTime(level, t, dur * 0.55);
    G.setValueAtTime(level * 0.9, t1 - 0.012); G.linearRampToValueAtTime(0, t1);
    n.connect(bp); bp.connect(g); out2(g, o, 0.3, v);
    v.play(t, t1 + 0.02);
  }
}

// ============================================================================================ baked buffers

/** 6 s loop of an army on foot: loose ranks (~1.9 steps/s each), feet on dry earth and gravel, a low tread. */
function bakeMarch(ctx: BaseAudioContext): AudioBuffer {
  const L = 6;
  return bake(ctx, L, 2, (d, sr, len) => {
    const [yl, yr] = d;
    const ranks = 14;
    for (let r = 0; r < ranks; r++) {
      const step = 60 / rand(106, 118);
      const pan = Math.random();
      const lvl = rand(0.35, 1);
      let t0 = rand(0, step);
      while (t0 < L) {
        const feet = randi(2, 5);
        for (let f = 0; f < feet; f++) {
          const ts = t0 + rand(-0.045, 0.045);
          const s0 = Math.floor(((ts % L) + L) % L * sr);
          const thud = new BQ('lp', rand(110, 190), 0.9, sr);
          const grit = new BQ('bp', rand(1400, 3200), 0.7, sr);
          const nL = Math.floor(0.06 * sr);
          const kT = Math.exp(-1 / (rand(0.018, 0.035) * sr)), kG = Math.exp(-1 / (rand(0.012, 0.03) * sr));
          let eT = 1, eG = 1;
          const a = lvl * rand(0.4, 1);
          const pp = clamp(pan + rand(-0.15, 0.15), 0, 1);
          for (let i = 0; i < nL; i++) {
            const j = (s0 + i) % len;
            const x = (thud.run(white()) * 6 * eT + grit.run(white()) * 0.35 * eG) * a * (i < 40 ? i / 40 : 1);
            yl[j] += x * (1 - pp); yr[j] += x * pp;
            eT *= kT; eG *= kG;
          }
        }
        t0 += step * rand(0.97, 1.03);
      }
    }
    // gravel spray and a continuous low tread
    addGrains(yl, sr, 900, 0, L, 2000, 6500, 0.02, 0.09, 0.001, 0.004, 1e9, yr);
    const lpL = new BQ('lp', 70, 0.7, sr), lpR = new BQ('lp', 70, 0.7, sr);
    for (let i = 0; i < len; i++) { yl[i] += lpL.run(white()) * 2.2; yr[i] += lpR.run(white()) * 2.2; }
    // loop seam: crossfade the last 80 ms into the head
    const xf = Math.floor(0.08 * sr);
    for (const y of d) for (let i = 0; i < xf; i++) { const u = i / xf; y[i] = y[i] * u + y[len - xf + i] * (1 - u); }
  }, 0.8, Math.round(ctx.sampleRate / 2)); // half rate: a lowpassed texture, half the bake time
}

/**
 * The robe tearing, as heard in slow motion (~3.7 s): tension creaks, then fibres parting in an accelerating,
 * then thinning train of grains (pitched down ~3x), threads snapping as low plucked "twangs", a final give.
 */
/**
 * The slowed tear, baked to the beats of the insert (s from the pull): the wool under tension until `run`, the tear
 * running until `free` (fibres parting ever faster, threads snapping), the corner coming away at `free` (a last burst
 * of snaps and a cloth flap), then a few last fibres.
 */
function bakeRip(ctx: BaseAudioContext, run = 0.4, free = 1.6): AudioBuffer {
  const L = free + 0.5;
  return bake(ctx, L, 2, (d, sr, len) => {
    const [yl, yr] = d;
    // a faint friction of the wool under tension (kept low: the tear must read as snaps, not hiss)
    const bpL = new BQ('bp', 650, 1.2, sr), bpR = new BQ('bp', 720, 1.2, sr);
    for (let i = 0; i < len; i++) {
      const ts = i / sr;
      const env = ts < run ? 0.35 + 0.65 * (ts / Math.max(0.05, run)) : ts < free ? 1 : Math.max(0, 1 - (ts - free) / 0.2);
      yl[i] += bpL.run(white()) * env * 0.12;
      yr[i] += bpR.run(white()) * env * 0.12;
    }
    // fibres parting, heard in slow motion: discrete resonant ticks (an impulse into a narrow band, 1-5 ms) — sparse
    // under the pull, their rate rising to ~140/s as the tear runs, then only a few after the corner is free
    let t = 0.04;
    while (t < L - 0.08) {
      let rate: number, amp0: number;
      if (t < run) { rate = 6 + 16 * (t / Math.max(0.05, run)); amp0 = 0.5; }
      else if (t < free) { const u = (t - run) / Math.max(0.1, free - run); rate = 25 + 115 * Math.sin(Math.PI * clamp(0.12 + u * 0.8, 0, 1)) ** 1.2; amp0 = 0.6 + 0.6 * u; }
      else { rate = Math.max(5, 45 * Math.exp(-(t - free) / 0.1)); amp0 = 0.6; }
      const cluster = chance(0.12) ? randi(2, 4) : 1;
      for (let c = 0; c < cluster; c++) {
        const s0 = Math.floor((t + c * rand(0.002, 0.006)) * sr);
        const f = rand(450, 3000);
        const bq = new BQ('bp', f, rand(1.4, 3.5), sr); // wool: dry and fuzzy, not a ringing tick
        const n = Math.floor(rand(0.003, 0.008) * sr);
        const kd = Math.exp(-1 / (rand(0.0008, 0.0025) * sr));
        const amp = rand(0.25, 1) * amp0 * (cluster > 1 ? 1.3 : 1);
        const pan = clamp(0.5 + (Math.random() - 0.5) * 0.9, 0, 1);
        let e = 1;
        for (let i = 0; i < n && s0 + i < len; i++) {
          const x = bq.run(i < 3 ? white() * 4 : white() * 0.3) * e * amp * 3.2;
          yl[s0 + i] += x * (1 - pan); yr[s0 + i] += x * pan;
          e *= kd;
        }
      }
      t += (1 / rate) * rand(0.35, 1.65);
    }
    // threads snapping while the tear runs: low, fast-decaying plucks that bend down (pitched down by the slow motion)
    const snaps = Math.round(clamp(20 * (free - run), 10, 36));
    const snap = (ts: number, amp: number): void => {
      const s0 = Math.floor(ts * sr), n = Math.floor(0.14 * sr);
      let ph = 0;
      const f0 = rand(150, 480), kd = Math.exp(-1 / (rand(0.02, 0.05) * sr));
      let e = 1;
      const pan = Math.random();
      for (let i = 0; i < n && s0 + i < len; i++) {
        const f = f0 * (1 - 0.4 * (i / n));
        ph += (2 * Math.PI * f) / sr;
        const x = (Math.sin(ph) + 0.15 * Math.sin(ph * 2.7)) * e * amp * (i < 24 ? i / 24 : 1);
        yl[s0 + i] += x * (1 - pan); yr[s0 + i] += x * pan;
        e *= kd;
      }
    };
    for (let k = 0; k < snaps; k++) snap(rand(run, free - 0.05), rand(0.35, 0.9));
    // the give: the corner comes away — a burst of snaps and a soft cloth flap on `free`
    for (let k = 0; k < 5; k++) snap(free - 0.03 + rand(0, 0.06), rand(0.6, 1));
    const g0 = Math.floor((free - 0.02) * sr);
    const bq = new BQ('bp', 800, 0.9, sr);
    for (let i = 0; i < Math.floor(0.35 * sr) && g0 + i < len; i++) {
      const u = i / (0.35 * sr);
      const x = bq.run(white()) * Math.exp(-u * 7) * 1.2;
      yl[g0 + i] += x; yr[g0 + i] += x;
    }
    const hp = [new BQ('hp', 90, 0.7, sr), new BQ('hp', 90, 0.7, sr)];
    for (let c = 0; c < 2; c++) { const y = d[c]; for (let i = 0; i < len; i++) y[i] = hp[c].run(y[i]); }
  }, 0.85, Math.round(ctx.sampleRate / 2)); // half rate: its content sits below 6 kHz
}
