/**
 * DAVID — named ambience beds for the intro and the chapter, layered on top of the legacy
 * wind / cicadas / birds ambience (which the engine drives with per-bed presets):
 *
 *   fields           olive leaves in the gusts, skylarks, far-off sheep & goats of other flocks
 *                    (+ legacy wind, cicadas, birds);
 *   gibeah-exterior  the wind on the height, distant voices and calls, bronze clinks, a dog,
 *                    cooking fires, a far donkey (Kish's household kept donkeys, 1 Sam 9:3 — and
 *                    no horses anywhere, see docs/sources.md);
 *   gibeah-hall      the room tone of a stone house, the wind outside through thick walls, oil
 *                    lamps fluttering and sputtering, fabric, bare feet / sandals on packed earth,
 *                    low murmurs;
 *   the opening film's beds (IntroScore.ts): dawn (the fields at first light — larks, no cicadas),
 *                    heights (air above the clouds: broad gusts, a thin whistle), coast (the sea beyond
 *                    the plain, grit on the wind), gilgal (hot dusty gusts of the Jordan valley — the
 *                    army itself is the score's sound design), hush (the pasture holding its breath).
 *
 * Continuous layers are built only while their bed is audible (sources stop and disconnect a few
 * seconds after the bed fades out); sporadic events are short-lived Voices, a handful per second
 * at most (fewer on phones).
 */
import { Core, Voice, SmoothNoise, bake, BQ, addGrains, white, clamp, rand, randi, chance, pick, lerp } from './synth';

export type BedName = 'fields' | 'dawn' | 'gibeah-exterior' | 'gibeah-hall' | 'heights' | 'coast' | 'gilgal' | 'hush' | 'none';
type Bed = Exclude<BedName, 'none'>;
const BEDS: readonly Bed[] = ['fields', 'dawn', 'gibeah-exterior', 'gibeah-hall', 'heights', 'coast', 'gilgal', 'hush'];
/** Every valid bed name (for input validation). */
export const BED_NAMES: ReadonlySet<string> = new Set<string>([...BEDS, 'none']);

/** Legacy ambience levels (wind, cicadas, birds) that go with each bed. */
export const BED_LEGACY: Record<BedName, { wind: number; cicadas: number; birds: number }> = {
  fields: { wind: 0.5, cicadas: 0.6, birds: 0.5 },
  'gibeah-exterior': { wind: 0.62, cicadas: 0.15, birds: 0.18 },
  'gibeah-hall': { wind: 0, cicadas: 0, birds: 0 },
  // the opening film's beds (src/audio/IntroScore.ts): above the clouds / the coastal plain / the Jordan valley at
  // Gilgal / the thicket when the birds fall silent
  dawn: { wind: 0.4, cicadas: 0, birds: 0.55 }, // the fields at first light (Rachel's pillar): larks, no cicadas yet
  heights: { wind: 0.72, cicadas: 0, birds: 0 },
  coast: { wind: 0.5, cicadas: 0.12, birds: 0.04 },
  gilgal: { wind: 0.55, cicadas: 0.1, birds: 0 },
  hush: { wind: 0.3, cicadas: 0, birds: 0 },
  none: { wind: 0, cicadas: 0, birds: 0 },
};

/** Plays a flock sound into `dest` (provided by the engine: the SFX library's bleats). */
export type BleatFn = (kind: 'sheepBleat' | 'goatBleat' | 'lambBleat', volume: number, pan: number, pitch: number, dest: AudioNode) => void;
export type StepFn = (volume: number, pan: number, rate: number, t: number, dest: AudioNode) => void;

interface Layer { nodes: AudioNode[]; srcs: AudioScheduledSourceNode[]; params: Record<string, AudioParam> }
interface BedState { gain: GainNode; far: GainNode; level: number; built: Layer | null; silentAt: number; next: Record<string, number> }

export class Beds {
  private readonly bus: GainNode;
  private readonly st = {} as Record<Bed, BedState>;
  private current: BedName = 'none';
  private readonly gust = new SmoothNoise();
  private readonly flick = new SmoothNoise();
  private phase = Math.random() * 50;
  private last = 0;
  private nextUpd = 0;
  private crackle: AudioBuffer | null = null;
  bleat: BleatFn | null = null;
  /** 0..1: how lively the fields are (larks, far flocks) — follows the legacy birds level. */
  density = 1;
  step: StepFn | null = null;

  constructor(private readonly c: Core, private lite: boolean) {
    const ctx = c.ctx;
    this.bus = ctx.createGain();
    this.bus.connect(c.worldIn);
    const hall = ctx.createGain(); hall.gain.value = 0.16;
    this.bus.connect(hall); hall.connect(c.hallIn);
    for (const b of BEDS) {
      const gain = ctx.createGain(); gain.gain.value = 0;
      const far = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = b === 'gibeah-hall' ? 1100 : 2600; lp.Q.value = 0.5;
      const fh = ctx.createGain(); fh.gain.value = b === 'gibeah-hall' ? 0.5 : 0.35;
      far.connect(lp); lp.connect(gain); lp.connect(fh); fh.connect(c.hallIn);
      this.st[b] = { gain, far, level: 0, built: null, silentAt: 0, next: {} };
    }
  }

  get name(): BedName { return this.current; }
  setLite(on: boolean): void { this.lite = on; }

  /** Crossfade to a bed (`fade` seconds, starting at context time `at`). */
  set(name: BedName, fade: number, at: number): void {
    this.current = name;
    const tau = Math.max(0.02, fade / 3);
    for (const b of BEDS) {
      const s = this.st[b];
      const on = b === name;
      if (on && !s.built) s.built = this.build(b, at);
      if (on) this.primeEvents(b, at);
      s.level = on ? 1 : 0;
      s.gain.gain.cancelScheduledValues(at);
      s.gain.gain.setTargetAtTime(on ? 1 : 0, at, tau);
      if (!on) s.silentAt = at + fade;
    }
  }

  tick(now: number, slow: number): void {
    const dt = clamp(now - this.last, 0, 0.5);
    this.last = now;
    this.phase += dt;
    for (const b of BEDS) {
      const s = this.st[b];
      if (s.built && s.level === 0 && now > s.silentAt + 4) { this.teardown(s.built); s.built = null; }
    }
    if (this.current === 'none') return;
    const bed = this.current as Bed;
    const s = this.st[bed];
    if (now >= this.nextUpd && s.built) {
      this.nextUpd = now + 0.1;
      this.modulate(bed, s.built, now);
    }
    this.rate = (this.lite ? 0.6 : 1) * lerp(1, 0.5, slow);
    this.now = now;
    const due = this.dueFn;
    const t = now + 0.03;
    try {
      switch (bed) {
        case 'fields': case 'dawn':
          if (due('lark', 7, 17) && chance(this.density)) this.lark(t, s.far);
          if (due('flock', 5, 12) && chance(0.3 + 0.7 * this.density)) this.farFlock(s.far);
          if (!this.lite && due('leaf', 2.5, 6)) this.leafGust(t, s.gain);
          break;
        case 'gibeah-exterior':
          if (due('voice', 1.0, 2.6)) this.voice(t, s.far, 0.03, chance(0.12));
          if (due('clink', 2.2, 6)) this.clinks(t, s.far, 0.036);
          if (due('dog', 13, 28)) this.dog(t, s.far);
          if (due('donkey', 28, 55)) this.donkey(t, s.far);
          break;
        case 'gibeah-hall':
          if (due('murmur', 2.4, 6)) this.voice(t, s.far, 0.014, false);
          if (due('sputter', 2.5, 7)) this.sputter(t, s.gain);
          if (due('fabric', 4, 9)) this.fabric(t, s.gain);
          if (due('steps', 8, 16)) this.footsteps(t, s.gain);
          break;
      }
    } catch { /* ambience must never throw */ }
  }

  private rate = 1;
  private now = 0;
  /** Event timer check for the current bed (bound once: no per-tick closure). */
  private readonly dueFn = (k: string, lo: number, hi: number): boolean => {
    const s = this.st[this.current as Bed];
    if (!s) return false;
    const n = s.next[k];
    if (n === undefined) { s.next[k] = this.now + rand(lo, hi) * 0.5 / this.rate; return false; }
    if (this.now < n) return false;
    s.next[k] = this.now + rand(lo, hi) / this.rate;
    return true;
  };

  dispose(): void {
    for (const b of BEDS) { const s = this.st[b]; if (s.built) { this.teardown(s.built); s.built = null; } }
  }

  // ------------------------------------------------------------------------------ continuous layers

  private primeEvents(b: Bed, at: number): void {
    const s = this.st[b];
    // first events soon after the bed starts (so a short shot still "reads")
    if (b === 'gibeah-exterior') s.next = { voice: at + rand(0.3, 1), clink: at + rand(0.8, 2), dog: at + rand(2.5, 5), donkey: at + rand(6, 14) };
    else if (b === 'gibeah-hall') s.next = { murmur: at + rand(0.8, 2), sputter: at + rand(0.5, 2), fabric: at + rand(1.5, 3), steps: at + rand(1.2, 3) };
    else if (b === 'fields' || b === 'dawn') s.next = { lark: at + rand(0.5, 2.5), flock: at + rand(1.5, 4), leaf: at + rand(1, 3) };
    else s.next = {};
  }

  private build(b: Bed, at: number): Layer {
    const ctx = this.c.ctx;
    const L: Layer = { nodes: [], srcs: [], params: {} };
    const mk = <T extends AudioNode>(n: T): T => { L.nodes.push(n); return n; };
    const g = (v: number): GainNode => { const n = mk(ctx.createGain()); n.gain.value = v; return n; };
    const bq = (type: BiquadFilterType, f: number, q: number): BiquadFilterNode => {
      const n = mk(ctx.createBiquadFilter()); n.type = type; n.frequency.value = this.c.hz(f); n.Q.value = q; return n;
    };
    const loop = (buf: AudioBuffer): AudioBufferSourceNode => {
      const s = mk(ctx.createBufferSource()); s.buffer = buf; s.loop = true;
      s.start(at, Math.random() * Math.max(0, buf.duration - 0.5)); L.srcs.push(s); return s;
    };
    const out = this.st[b].gain;
    out.connect(this.bus);
    switch (b) {
      case 'fields': case 'dawn': {
        // olive / oak leaves: two bands following the gusts
        const n = loop(this.c.noise.pink);
        const hi = bq('bandpass', 4200, 0.8), hg = g(0.0);
        n.connect(hi); hi.connect(hg); hg.connect(out);
        L.params.leafHi = hg.gain;
        if (!this.lite) {
          const mid = bq('bandpass', 1800, 1.1), mg = g(0);
          n.connect(mid); mid.connect(mg); mg.connect(out);
          L.params.leafMid = mg.gain;
        }
        break;
      }
      case 'gibeah-exterior': {
        // cooking fires: crackle loop + a soft low flame breath
        const cr = loop(this.crackleBuf());
        const cg = g(0.05), cp = this.panNode(L, -0.35);
        cr.connect(cg); cg.connect(cp); cp.connect(out);
        const fl = loop(this.c.noise.brown), flp = bq('lowpass', 170, 0.7), fg = g(0.05);
        fl.connect(flp); flp.connect(fg); fg.connect(out);
        L.params.flame = fg.gain;
        break;
      }
      case 'heights': {
        // altitude: a broad air band, the body of the wind, a thin whistle over the cloud tops
        const pk = loop(this.c.noise.pink), br = loop(this.c.noise.brown);
        const air = bq('bandpass', 700, 0.6), ag = g(0.02);
        pk.connect(air); air.connect(ag); ag.connect(out);
        const body = bq('lowpass', 150, 0.6), bg = g(0.05);
        br.connect(body); body.connect(bg); bg.connect(out);
        L.params.air = ag.gain; L.params.body = bg.gain;
        if (!this.lite) {
          const wh = bq('bandpass', 1500, 11), wg = g(0);
          pk.connect(wh); wh.connect(wg); wg.connect(out);
          L.params.whistle = wg.gain; L.params.whistleF = wh.frequency;
        }
        break;
      }
      case 'coast': {
        // the sea beyond the plain (slow swells) + dry grit carried on the wind
        const pk = loop(this.c.noise.pink), wn = loop(this.c.noise.white);
        const sl = bq('lowpass', 650, 0.5), sg = g(0.02), sp = this.panNode(L, -0.55);
        pk.connect(sl); sl.connect(sg); sg.connect(sp); sp.connect(out);
        const dh = bq('bandpass', 3000, 0.7), dg = g(0.004);
        wn.connect(dh); dh.connect(dg); dg.connect(out);
        L.params.surf = sg.gain; L.params.dust = dg.gain;
        break;
      }
      case 'gilgal': {
        // the hot, low Jordan valley: dust-laden gusts over bare earth, a heavy low body
        const pk = loop(this.c.noise.pink), br = loop(this.c.noise.brown);
        const dh = bq('bandpass', 2400, 0.7), dg = g(0.006);
        pk.connect(dh); dh.connect(dg); dg.connect(out);
        const body = bq('lowpass', 180, 0.6), bg = g(0.04);
        br.connect(body); body.connect(bg); bg.connect(out);
        L.params.dust = dg.gain; L.params.body = bg.gain;
        break;
      }
      case 'hush': {
        // the pasture holding its breath: only the leaves at the thicket's edge
        const pk = loop(this.c.noise.pink);
        const hi = bq('bandpass', 3800, 0.8), hg = g(0.003);
        pk.connect(hi); hi.connect(hg); hg.connect(out);
        L.params.leafHi = hg.gain;
        break;
      }
      case 'gibeah-hall': {
        // stone-room air + the wind outside through thick walls
        const br = loop(this.c.noise.brown), blp = bq('lowpass', 210, 0.6), bg = g(0.07);
        br.connect(blp); blp.connect(bg); bg.connect(out);
        const pk = loop(this.c.noise.pink), pb = bq('bandpass', 460, 0.8), pg = g(0.012);
        pk.connect(pb); pb.connect(pg); pg.connect(out);
        const wl = bq('lowpass', 320, 0.7), wg = g(0.02);
        pk.connect(wl); wl.connect(wg); wg.connect(out);
        L.params.wallWind = wg.gain;
        // oil lamps: a flame flutter (band-limited noise, slowly flickering)
        const lamps = this.lite ? 1 : 2;
        for (let i = 0; i < lamps; i++) {
          const fb = bq('bandpass', rand(160, 320), 1.4), lg = g(0.012), lp = this.panNode(L, i ? 0.45 : -0.3);
          pk.connect(fb); fb.connect(lg); lg.connect(lp); lp.connect(out);
          L.params['lamp' + i] = lg.gain;
        }
        const cr = loop(this.crackleBuf());
        const cg = g(0.012), cp = this.panNode(L, 0.3);
        cr.connect(cg); cg.connect(cp); cp.connect(out);
        break;
      }
    }
    L.nodes.push(out); // disconnected from the bus on teardown (the gain itself is reused)
    return L;
  }

  private modulate(b: Bed, L: Layer, now: number): void {
    const ph = this.phase;
    const gust = clamp(0.55 * this.gust.at(ph * 0.09) + 0.45 * this.gust.at(ph * 0.37 + 17), 0, 1);
    const P = L.params;
    if (b === 'fields' || b === 'dawn') {
      const g2 = gust * gust;
      if (P.leafHi) P.leafHi.setTargetAtTime(0.004 + 0.03 * g2, now, 0.3);
      if (P.leafMid) P.leafMid.setTargetAtTime(0.002 + 0.02 * g2 * gust, now, 0.3);
    } else if (b === 'gibeah-exterior') {
      if (P.flame) P.flame.setTargetAtTime(0.03 + 0.03 * this.flick.at(ph * 1.7), now, 0.15);
    } else if (b === 'heights') {
      if (P.air) P.air.setTargetAtTime(0.012 + 0.05 * gust * gust, now, 0.35);
      if (P.body) P.body.setTargetAtTime(0.04 + 0.08 * gust, now, 0.4);
      if (P.whistle) P.whistle.setTargetAtTime(0.012 * gust * gust * gust, now, 0.4);
      if (P.whistleF) P.whistleF.setTargetAtTime(this.c.hz(1100 + 900 * gust), now, 0.5);
    } else if (b === 'coast') {
      if (P.surf) P.surf.setTargetAtTime(0.012 + 0.03 * (0.5 + 0.5 * Math.sin(ph * 0.9)) ** 2, now, 0.5);
      if (P.dust) P.dust.setTargetAtTime(0.002 + 0.012 * gust * gust, now, 0.3);
    } else if (b === 'gilgal') {
      if (P.dust) P.dust.setTargetAtTime(0.003 + 0.022 * gust * gust, now, 0.3);
      if (P.body) P.body.setTargetAtTime(0.03 + 0.06 * gust, now, 0.4);
    } else if (b === 'hush') {
      if (P.leafHi) P.leafHi.setTargetAtTime(0.002 + 0.008 * gust * gust, now, 0.4);
    } else {
      if (P.wallWind) P.wallWind.setTargetAtTime(0.006 + 0.03 * gust * gust, now, 0.4);
      for (let i = 0; i < 2; i++) {
        const p = P['lamp' + i];
        if (p) p.setTargetAtTime(0.006 + 0.016 * this.flick.at(ph * (2.1 + i * 0.7) + i * 9), now, 0.08);
      }
    }
  }

  private teardown(L: Layer): void {
    for (const s of L.srcs) { try { s.stop(); } catch { /* ignore */ } }
    for (const n of L.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    // the bed gains are reused: reconnect their internal routing (far -> lp -> gain stays intact)
  }

  private panNode(L: Layer, p: number): AudioNode {
    const ctx = this.c.ctx;
    if (typeof ctx.createStereoPanner === 'function') { const s = ctx.createStereoPanner(); s.pan.value = p; L.nodes.push(s); return s; }
    const g = ctx.createGain(); L.nodes.push(g); return g;
  }

  /** 4 s loop of wood-fire crackle: sparse sharp pops, softer ticks, a faint hiss. Baked once. */
  private crackleBuf(): AudioBuffer {
    if (this.crackle) return this.crackle;
    this.crackle = bake(this.c.ctx, 4, 1, (d, sr, len) => {
      const y = d[0];
      const hs = new BQ('bp', 3000, 0.5, sr);
      for (let i = 0; i < len; i++) y[i] = hs.run(white()) * 0.02;
      addGrains(y, sr, 70, 0, 4, 1500, 6000, 0.05, 0.3, 0.0004, 0.002, 100);
      addGrains(y, sr, 14, 0, 4, 700, 2500, 0.4, 1, 0.001, 0.004, 100);
      // loop-safe edges
      const f = Math.floor(0.02 * sr);
      for (let i = 0; i < f; i++) { y[i] *= i / f; y[len - 1 - i] *= i / f; }
    }, 0.8, 24000);
    return this.crackle;
  }

  // ------------------------------------------------------------------------------ events

  /** Skylark: a long, tumbling high song from above, far and thin. */
  private lark(t: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const dur = rand(2.5, 6);
    const o = v.osc('sine', 3500, 0, t), fm = v.osc('sine', rand(28, 45), 0, t), fg = v.gain(0);
    fm.connect(fg); fg.connect(o.frequency);
    const g = v.gain(0), hp = v.filter('highpass', 1800, 0.7), p = v.pan(rand(-0.6, 0.6));
    o.connect(g); g.connect(hp); hp.connect(p); p.connect(dest);
    const F = o.frequency, G = g.gain, FG = fg.gain;
    const amp = rand(0.018, 0.03);
    let x = 0;
    G.setValueAtTime(0, t);
    while (x < dur) {
      const d = rand(0.035, 0.09);
      const tt = t + x;
      if (chance(0.12)) { // trill
        FG.setValueAtTime(rand(250, 600), tt); FG.setValueAtTime(0, tt + d * 2);
        F.setValueAtTime(rand(3200, 4800), tt);
        G.setValueAtTime(amp, tt); G.setValueAtTime(amp * 0.4, tt + d * 2);
        x += d * 2 + rand(0.01, 0.03);
        continue;
      }
      F.setValueAtTime(rand(2600, 5600), tt);
      F.exponentialRampToValueAtTime(rand(2600, 5600), tt + d * 0.8);
      G.setValueAtTime(amp * rand(0.5, 1), tt);
      G.setValueAtTime(amp * 0.15, tt + d * 0.85);
      x += d + (chance(0.08) ? rand(0.08, 0.2) : rand(0.005, 0.02));
    }
    G.setValueAtTime(0, t + x);
    v.play(t, t + x + 0.1);
  }

  private farFlock(dest: AudioNode): void {
    if (!this.bleat) return;
    const r = Math.random();
    const kind = r < 0.55 ? 'sheepBleat' : r < 0.85 ? 'goatBleat' : 'lambBleat';
    this.bleat(kind, rand(0.18, 0.34), rand(-0.8, 0.8), rand(0.9, 1.08), dest);
  }

  private leafGust(t: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const d = rand(0.8, 1.8);
    const n = v.noise('pink', t), bp = v.filter('bandpass', rand(2500, 4500), 0.9), g = v.gain(0), p = v.pan(rand(-0.7, 0.7));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rand(0.01, 0.022), t + d * 0.4); g.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(dest);
    v.play(t, t + d + 0.05);
  }

  /** A distant human utterance (murmur, or a call): voiced source through moving vowel formants. */
  private voice(t: number, dest: AudioNode, level: number, call: boolean): void {
    const v = new Voice(this.c);
    const male = chance(0.8);
    const f0 = (male ? rand(95, 150) : rand(180, 240)) * (call ? 1.35 : 1);
    const syl = call ? randi(2, 3) : randi(3, 7);
    const o = v.osc('sawtooth', f0, 0, t);
    const nz = v.noise('white', t), nh = v.filter('highpass', 1800, 0.7), ng = v.gain(0.08);
    nz.connect(nh); nh.connect(ng);
    const pre = v.gain(1);
    o.connect(pre); ng.connect(pre);
    const f1 = v.filter('bandpass', 600, 5), f2 = v.filter('bandpass', 1300, 7), g1 = v.gain(2.2), g2 = v.gain(1.2);
    pre.connect(f1); f1.connect(g1); pre.connect(f2); f2.connect(g2);
    const env = v.gain(0), p = v.pan(rand(-0.85, 0.85));
    g1.connect(env); g2.connect(env); env.connect(p); p.connect(dest);
    const VOW: ReadonlyArray<readonly [number, number]> = [[720, 1150], [520, 880], [360, 820], [560, 1750], [330, 2100]];
    let x = 0;
    const E = env.gain, F = o.frequency;
    E.setValueAtTime(0, t);
    for (let i = 0; i < syl; i++) {
      const d = call ? (i === syl - 1 ? rand(0.45, 0.7) : rand(0.14, 0.22)) : rand(0.1, 0.26);
      const tt = t + x;
      const [a, b] = pick(VOW);
      f1.frequency.setTargetAtTime(a, tt, 0.03); f2.frequency.setTargetAtTime(b, tt, 0.03);
      const fp = f0 * (call ? (i === syl - 1 ? 1.25 : 1.05) : rand(0.88, 1.14));
      F.setTargetAtTime(fp, tt, 0.04);
      const a0 = level * (call ? 1.6 : rand(0.6, 1));
      E.setTargetAtTime(a0, tt, 0.02);
      E.setTargetAtTime(a0 * 0.25, tt + d * 0.75, 0.03);
      x += d + (chance(0.25) ? rand(0.08, 0.2) : 0.01);
    }
    if (call) F.setTargetAtTime(f0 * 0.9, t + x - 0.2, 0.1);
    E.setTargetAtTime(0, t + x, 0.05);
    v.play(t, t + x + 0.4);
  }

  /** Bronze on bronze: spear butts, a scale of armour, a cauldron. */
  private clinks(t: number, dest: AudioNode, level: number): void {
    const v = new Voice(this.c);
    const n = chance(0.35) ? 2 : 1;
    const p = v.pan(rand(-0.8, 0.8));
    p.connect(dest);
    let x = 0;
    for (let k = 0; k < n; k++) {
      const f = rand(1700, 3100), tt = t + x;
      const amps = [1, 0.5, 0.28], ratios = [1, 2.76, 5.4], taus = [rand(0.08, 0.16), 0.05, 0.025];
      for (let i = 0; i < 3; i++) {
        const o = v.osc('sine', this.c.hz(f * ratios[i]), 0, tt), g = v.gain(0);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(level * amps[i] * (k ? 0.6 : 1), tt + 0.0015);
        g.gain.setTargetAtTime(0, tt + 0.0015, taus[i]);
        o.connect(g); g.connect(p);
      }
      x += rand(0.09, 0.25);
    }
    v.play(t, t + x + 1.1);
  }

  /** A dog barking somewhere below the walls. */
  private dog(t: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const n = randi(2, 4);
    const f0 = rand(380, 520);
    const o = v.osc('sawtooth', f0, 0, t);
    const nz = v.noise('white', t), nb = v.filter('bandpass', 1600, 0.9), ng = v.gain(0.35);
    nz.connect(nb); nb.connect(ng);
    const pre = v.gain(1);
    o.connect(pre); ng.connect(pre);
    const f1 = v.filter('bandpass', 1000, 3), f2 = v.filter('bandpass', 2300, 5), g1 = v.gain(2), g2 = v.gain(0.9);
    pre.connect(f1); f1.connect(g1); pre.connect(f2); f2.connect(g2);
    const env = v.gain(0), p = v.pan(rand(-0.9, 0.9));
    g1.connect(env); g2.connect(env); env.connect(p); p.connect(dest);
    const pe = v.gain(0.3); p.connect(pe); pe.connect(this.c.echoSend());
    let x = 0;
    const E = env.gain, F = o.frequency;
    E.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
      const tt = t + x, d = rand(0.1, 0.15);
      F.setValueAtTime(f0 * 1.15, tt); F.exponentialRampToValueAtTime(f0 * 0.75, tt + d);
      E.setValueAtTime(0, tt); E.linearRampToValueAtTime(0.05, tt + 0.012); E.setTargetAtTime(0, tt + d * 0.6, 0.03);
      x += d + rand(0.22, 0.42);
    }
    v.play(t, t + x + 0.3);
  }

  /** Far donkey: a wheezing in-breath "hee" and a honking "haw", three times. */
  private donkey(t: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const o = v.osc('sawtooth', 500, 0, t), f = v.filter('bandpass', 1100, 2.5), f2 = v.filter('bandpass', 2400, 4);
    const g = v.gain(0), g2 = v.gain(0.5), p = v.pan(rand(-0.7, 0.7));
    o.connect(f); o.connect(f2); f.connect(g); f2.connect(g2); g2.connect(g); g.connect(p); p.connect(dest);
    const nz = v.noise('white', t), nb = v.filter('bandpass', 3000, 1.5), ng = v.gain(0);
    nz.connect(nb); nb.connect(ng); ng.connect(p);
    const cyc = randi(2, 3);
    let x = 0;
    const F = o.frequency, G = g.gain, N = ng.gain;
    G.setValueAtTime(0, t); N.setValueAtTime(0, t);
    for (let i = 0; i < cyc; i++) {
      const tt = t + x;
      F.setValueAtTime(560, tt); F.linearRampToValueAtTime(620, tt + 0.35);
      G.linearRampToValueAtTime(0.012, tt + 0.05); N.linearRampToValueAtTime(0.012, tt + 0.05);
      G.linearRampToValueAtTime(0.004, tt + 0.38); N.linearRampToValueAtTime(0.002, tt + 0.38);
      F.setValueAtTime(190, tt + 0.4); F.linearRampToValueAtTime(150, tt + 0.85);
      G.linearRampToValueAtTime(0.03, tt + 0.46); G.linearRampToValueAtTime(0.02, tt + 0.8); G.linearRampToValueAtTime(0, tt + 0.88);
      x += 0.95;
    }
    const pe = v.gain(0.35); p.connect(pe); pe.connect(this.c.echoSend());
    v.play(t, t + x + 0.2);
  }

  /** An oil lamp sputters: a few soft wet pops. */
  private sputter(t: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const p = v.pan(rand(-0.6, 0.6));
    p.connect(dest);
    const n = randi(2, 5);
    let x = 0;
    for (let i = 0; i < n; i++) {
      const tt = t + x;
      const s = v.noise('white', tt), b = v.filter('bandpass', rand(700, 2200), 2), g = v.gain(0);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(rand(0.02, 0.05), tt + 0.002); g.gain.setTargetAtTime(0, tt + 0.002, rand(0.006, 0.02));
      s.connect(b); b.connect(g); g.connect(p);
      x += rand(0.04, 0.2);
    }
    v.play(t, t + x + 0.2);
  }

  /** Wool garment moving: a slow brushing of cloth. */
  private fabric(t: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const d = rand(0.5, 1.2);
    const n = v.noise('pink', t), bp = v.filter('bandpass', rand(1500, 2600), 0.7), g = v.gain(0), p = v.pan(rand(-0.7, 0.7));
    const lvl = rand(0.012, 0.024);
    g.gain.setValueAtTime(0, t);
    const k = randi(2, 4);
    for (let i = 0; i < k; i++) {
      const tt = t + (i / k) * d;
      g.gain.linearRampToValueAtTime(lvl * rand(0.6, 1), tt + d / k * 0.4);
      g.gain.linearRampToValueAtTime(lvl * 0.2, tt + d / k);
    }
    g.gain.linearRampToValueAtTime(0, t + d + 0.05);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(dest);
    v.play(t, t + d + 0.1);
  }

  /** Someone crossing the room: soft steps on packed earth. */
  private footsteps(t: number, dest: AudioNode): void {
    if (!this.step) return;
    const n = randi(3, 6);
    const p0 = rand(-0.8, 0.8), p1 = clamp(p0 + rand(-0.8, 0.8), -0.9, 0.9);
    const gap = rand(0.52, 0.62);
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 0;
      this.step(rand(0.1, 0.16) * (1 - 0.3 * Math.abs(u - 0.5)), lerp(p0, p1, u), rand(0.8, 0.92), t + i * gap, dest);
    }
  }
}
