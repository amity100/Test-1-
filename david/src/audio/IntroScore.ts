/**
 * DAVID — score and sound design of the opening film "הַטּוֹב מִמֶּךָּ" (docs/intro-script.md), synchronised to
 * the film's shot sheet (src/content/introScript.ts).
 *
 * KEYING. The sheet is read when the score starts: consecutive shot cues with the same `cue` (FilmCue) form one
 * section [t0, t1); every section has a composed plan whose events are placed relative to its start, its end, its
 * shots, or a named sync point inside a shot (SYNC below — the spear raised, the tear, the turn of David's head,
 * the eyes in the thicket; each is clamped to its shot's length). So the cut teammate can retime shots and the music
 * follows; nothing is keyed on absolute seconds. How a section is left comes from the NEXT shot's transition
 * (`cut` / `fade`): 'hard' (the shofar cut of shot 6) and 'smash' (the title) cut the bus to silence on the frame,
 * the silence of shot 9 cuts the roar at once, dissolves crossfade over their `fade`.
 * Events are built just ahead of the audio clock (≤ 0.5 s; the hard-cut hits only ≤ 60 ms ahead, so a picture stall
 * right before a cut cannot make them early), and the film's clock (syncIntro) re-anchors the score after hitches.
 *
 * THE ARC (all in D):
 *   PROLOGUE  mythic and vast — a deep tone out of black and wind; high string air and far voices as the camera
 *             breaks through the clouds; a distant shofar over Judah; the shepherd's pipe lament at Rachel's pillar
 *             with frame drums rising; Philistine war drums (D Phrygian ostinato, bronze strikes) on the coastal
 *             plain; a solemn chord of men's voices for the elders' demand (Dm – B♭ – Gm – A), a reverse swell into
 *   ACT I     a HARD shofar blast on the cut: the army out of the dust (thousands on foot, bronze, murmur) under
 *             massive drums and low male voices; Saul in slow motion (half-time drums, his theme D A B♭-A G F E D in
 *             low strings and men's voices, the world muffled); THE PEAK — his theme at full power on the raised
 *             spear, the roar of thousands — then SUDDEN SILENCE: only wind and the far bleating and lowing of the
 *             spoil (15:14); one sustained string for the face-off; THE TEAR as a slowed sound event; the verdict
 *             in near-silence; Saul's theme broken and falling below its tonic.
 *   THE RISE  a 15 s swell from dark to warm: Dm – B♭ – F – C – G – A, voices opening, into
 *   ACT II    an open D-major bloom over Bethlehem; David's theme (D A G F E F D, sharing Saul's rising fifth
 *             without the sigh) on the shepherd's pipe over the kinnor in 6/8, warm voices as he turns; the full
 *             theme in D major for the small youth in the vast land.
 *   THE HOOK  the birds stop; a low rumble; something large shifts; heavy breathing; the eyes; a heartbeat that
 *             quickens; a reverse swell — SMASH to black on a huge hit under the title, then a short resonant tail
 *             (kinnor and pipe: the opening of David's motif) into gameplay.
 * Period instruments: shofar (1 Sam 13:3), tof, chalil, kinnor, nevel (10:5) — the lyre is kept out of Saul's music
 * (it enters his house only after 16:23); drums are the score's, never on screen in Israel's army
 * (docs/visual-bible.md §6). No horses anywhere in the sound (Israel fought on foot).
 */
import type { FilmCue, IntroCue } from '../content/introScript';
import type { BedName } from './Beds';
import {
  Core, Synth, Voice, clamp, rand, randi, chance, CHORDS, voicing, rootIn, lyrePan,
  type Out, type ChordName, type NeyNote,
} from './synth';
import { FilmSound } from './FilmSound';

/**
 * Sync points inside shots (seconds from the start of the shot, by shot id). Sources: the Gilgal blocking
 * (src/film/gilgal/gilgalBlocking.ts: Saul's spear ss(0.9, 2.1), the ranks ss(1.4, 2.6), parting ss(1.8, 5.2),
 * SLOWMO.tear 0.3 from 2.05 s) and the cast (src/film/cast/performances.ts TEAR_BEATS: grab 1.95, tear 2.08-3.2
 * action seconds = 2.15-5.88 shot seconds), FilmWorld (David turns at 1.3 s for 2.3 s; the bear shifts 1.0-2.2 s,
 * its eyes open at 2.05 s), land pass 4 (the camera breaks through the cloud deck ~4.1-4.9 s into shot 2).
 * If a shot is retimed these are clamped to its length; if the blocking changes, update them here.
 */
const SYNC = {
  land: { breakThrough: 4.3 },
  'gilgal-spear': { halt: 0.8, lift: 0.9, roar: 1.45, top: 2.1 },
  'gilgal-silence': { partFrom: 1.8, partTo: 5.2 },
  'gilgal-tear': { turn: 0.2, go: 0.3, lunge: 1.45, grab: 1.95, slowIn: 2.3, ripFrom: 2.15, ripTo: 5.88 },
  face: { turn: 1.3, reveal: 3.6 },
  thicket: { shift: 1.0, shiftEnd: 2.2, eyes: 2.05 },
  lamb: { bleat: 0.9 },
} as const;

/** Ambience bed per cue (the score switches beds until the game calls ambience(name) itself). */
const CUE_BED: Record<FilmCue, BedName> = {
  dark: 'heights', land: 'heights', rachel: 'dawn', threat: 'coast', elders: 'gibeah-exterior',
  shofar: 'gilgal', saul: 'gilgal', peak: 'gilgal', silence: 'gilgal', faceoff: 'gilgal', tear: 'gilgal',
  verdict: 'gilgal', broken: 'gilgal', rise: 'heights', bethlehem: 'fields', figure: 'fields', face: 'fields',
  contrast: 'fields', peace: 'fields', thicket: 'hush', title: 'none',
};
const KNOWN: ReadonlySet<string> = new Set(Object.keys(CUE_BED));
/** How long the title rings when the sheet gives no length (s). */
const TITLE_LEN = 6.6;
/** 6/8 lilt of the pastoral (s per eighth) — the chapter's pastoral feel. */
const STEP68 = 0.34;
/** Act I pulse (84 bpm). */
const BEAT = 60 / 84;
/** The Philistine host (104 bpm). */
const BEAT_PH = 60 / 104;

// Saul's theme (D A Bb-A G F E D) as [midi, beats]
const SAUL: ReadonlyArray<readonly [number, number]> = [[50, 2], [57, 2], [58, 1.5], [57, 0.5], [55, 1], [53, 1], [52, 1], [50, 3]];
// ... broken: it stalls, loses its step and falls below the tonic (rests = -1)
const SAUL_BROKEN: ReadonlyArray<readonly [number, number]> = [
  [50, 2], [57, 2.5], [58, 2], [57, 1], [-1, 1], [55, 1.5], [53, 2.5], [-1, 1.2], [52, 1], [51, 2.5], [49, 4],
];
// David's motif (D A G F E F D) as [offset from tonic, units]
const DAVID: ReadonlyArray<readonly [number, number]> = [[0, 2], [7, 2], [5, 1], [3, 1], [2, 1], [3, 1], [0, 4]];
const DAVID_MAJ: ReadonlyArray<readonly [number, number]> = [[0, 2], [7, 2], [5, 1], [4, 1], [2, 1], [4, 1], [0, 4]];
// the Dorian answer (A B C D C A G A)
const ANSWER: ReadonlyArray<readonly [number, number]> = [[-5, 1], [-3, 1], [-2, 1], [0, 2], [-2, 1], [-5, 1], [-7, 1], [-5, 3]];

type Exit = 'cut' | 'x' | 'ring';
interface Shot { t: number; id: string; dur: number; cut: string; fade: number }
interface Sec {
  i: number; cue: FilmCue; t0: number; t1: number; shots: Shot[];
  /** how this section comes in (its first shot's transition) */
  cut: string; fade: number;
  /** how its bus leaves at t1 */
  exit: Exit; tau: number;
  next: FilmCue | null;
  /** film times of the on-screen texts inside the section (verses, names, lines) — musical accents key on them */
  texts: number[];
}
export interface IntroSection { readonly cue: FilmCue; readonly t0: number; readonly t1: number }

/** (t = context time, m = music out, hold = sustain length, fx = sound-design out) */
type Fn = (t: number, m: Out, hold: number, fx: Out) => void;
interface Ev { at: number; bus: number; hold: number; fn: Fn; tight: boolean }
interface Bus { gains: GainNode[]; m: Out; fx: Out; sec: number }

export class IntroScore {
  /** Ambience bed changes requested by the score (at section starts). */
  onAmbience: ((bed: BedName, fade: number, t: number) => void) | null = null;
  /** The film's sound design (the engine wires `fx.sfxAt` to its SFX library). */
  readonly fx: FilmSound;
  private secs: Sec[] = [];
  private evs: Ev[] = [];
  private ei = 0;
  private readonly buses = new Map<number, Bus>();
  private master: GainNode | null = null;
  private fxMaster: GainNode | null = null;
  private wetMaster: GainNode | null = null;
  private anchor = 0;
  private running = false;
  private endT = 0;
  private titleT = Infinity;
  private titleAt = -Infinity;
  private nextRetire = 0;
  private readonly dead: Array<{ t: number; nodes: AudioNode[] }> = [];
  private readonly ctx: BaseAudioContext;
  /** events that threw (tools) */
  errors = 0;
  /** main-thread milliseconds spent baking the film's buffers (tools) */
  bakeMs = 0;

  constructor(private readonly c: Core, private readonly s: Synth, private lite: boolean) {
    this.ctx = c.ctx;
    this.fx = new FilmSound(c, lite);
  }

  get active(): boolean { return this.running; }
  /** Current intro time (s) according to the score clock. */
  time(now: number): number { return now - this.anchor; }
  /** Sections derived from the last cue sheet (tools / debugging). */
  get sections(): readonly IntroSection[] { return this.secs; }
  setLite(on: boolean): void { this.lite = on; this.fx.setLite(on); }

  // ---------------------------------------------------------------------------------- control

  start(cues: readonly IntroCue[], startAt: number, now: number, level = 0.92): void {
    if (this.running) this.stop(now, 0.3);
    this.secs = buildSections(cues);
    if (!this.secs.length) return;
    const t0 = clamp(Number.isFinite(startAt) ? startAt : 0, 0, this.secs[this.secs.length - 1].t1 - 0.5);
    this.evs = [];
    for (const sec of this.secs) this.plan(sec);
    this.evs.sort((a, b) => a.at - b.at);
    if (t0 > 0.05) this.trimBefore(t0);
    this.ei = 0;
    this.anchor = now + 0.03 - t0; // a 30 ms pre-roll: events due "now" still start on time
    this.endT = this.secs[this.secs.length - 1].t1;
    const tsec = this.secs.find((x) => x.cue === 'title');
    this.titleT = tsec ? tsec.t0 : Infinity;
    this.titleAt = -Infinity;
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = level;
    this.fxMaster = ctx.createGain(); this.fxMaster.gain.value = 1;
    this.wetMaster = ctx.createGain(); this.wetMaster.gain.value = level;
    this.master.connect(this.c.musicIn); this.fxMaster.connect(this.c.worldIn); this.wetMaster.connect(this.c.hallIn);
    this.running = true;
  }

  /** Starting mid-way: sustained events already under way restart shortened; one-shots before t0 are dropped. */
  private trimBefore(t0: number): void {
    this.evs = this.evs.filter((e) => {
      if (e.at >= t0 - 0.02) return true;
      if (e.hold > 0 && e.at + e.hold > t0 + 0.6) { e.hold -= t0 - e.at; e.at = t0; return true; }
      return false;
    });
    this.evs.sort((a, b) => a.at - b.at);
  }

  /** Fade everything out over `fade` seconds; pending events are dropped. */
  stop(now: number, fade: number): void {
    if (!this.running) return;
    const f = Math.max(0.02, fade);
    const nodes: AudioNode[] = [];
    for (const g of [this.master, this.fxMaster, this.wetMaster]) {
      if (!g) continue;
      const p = g.gain;
      p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.setTargetAtTime(0, now, f / 4);
      nodes.push(g);
    }
    for (const b of this.buses.values()) nodes.push(...b.gains);
    this.dead.push({ t: now + f * 1.5 + 4, nodes });
    this.buses.clear();
    this.master = null; this.fxMaster = null; this.wetMaster = null;
    this.evs = []; this.ei = 0;
    this.running = false;
    this.restoreWorld(now, Math.min(1.5, f));
    this.fx.release();
  }

  /**
   * Keep the score locked to the picture: `t` = the film's own clock. Small drift is ignored; beyond 0.1 s
   * (a loading hitch, a hidden tab, a stalled frame) the future events are re-anchored.
   */
  sync(t: number, now: number): void {
    if (!this.running || !Number.isFinite(t)) return;
    const drift = now - this.anchor - t;
    if (Math.abs(drift) < 0.1) return;
    this.anchor = now - t;
    for (const b of this.buses.values()) this.envelope(b, now);
  }

  /**
   * The title card appeared (sfx('titleHit') during the film). In sync: absorbed (the score plays its own hit).
   * Ahead of the score (the film was skipped): jump to the title statement now. True when absorbed.
   */
  titleCue(now: number): boolean {
    if (!this.running || !Number.isFinite(this.titleT)) return false;
    if (now - this.titleAt < 5) return true; // already hit
    const due = this.anchor + this.titleT;
    if (due - now < 0.4) return true; // the score's own hit is (about to be) scheduled, or already played
    for (const b of this.buses.values()) {
      for (const g of b.gains) { const p = g.gain; p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.setTargetAtTime(0, now, 0.08); }
      this.dead.push({ t: now + 5, nodes: b.gains });
    }
    this.buses.clear();
    this.restoreWorld(now, 0.3);
    this.anchor = now + 0.03 - this.titleT;
    this.evs = this.evs.filter((e) => e.at >= this.titleT - 0.01);
    this.ei = 0;
    return true;
  }

  tick(now: number, horizon: number): void {
    if (this.dead.length) {
      for (let i = this.dead.length - 1; i >= 0; i--) {
        const d = this.dead[i];
        if (d.t < now) {
          for (const n of d.nodes) { try { n.disconnect(); } catch { /* gone */ } }
          this.dead.splice(i, 1);
        }
      }
    }
    if (!this.running) return;
    // the film's baked buffers: one per tick from 0.6 s of film time (under the black time card), never on the
    // first frame; a film started mid-way bakes lazily when a generator first needs its buffer
    if (!this.fx.ready && now - this.anchor > 0.6) {
      try { this.bakeMs += this.fx.prepareStep(); } catch { /* the generators bake lazily */ }
    }
    const limit = horizon - this.anchor;
    let guard = 0;
    while (this.ei < this.evs.length && this.evs[this.ei].at <= limit && guard++ < 64) {
      const e = this.evs[this.ei];
      // the hits of the hard cuts are built only just before they are due (never early after a stall)
      if (e.tight && e.at + this.anchor > now + 0.06) break;
      this.ei++;
      const t = Math.max(now + 0.004, e.at + this.anchor);
      const bus = this.bus(e.bus, now);
      if (!bus) continue;
      try { e.fn(t, bus.m, Math.max(0.2, e.hold), bus.fx); } catch (err) {
        // a bad event must not stop the score (reported, the first few times)
        if (this.errors++ < 3) console.warn('[IntroScore] event failed at', e.at.toFixed(2), err);
      }
    }
    if (now >= this.nextRetire) this.retire(now);
    if (this.ei >= this.evs.length && now > this.anchor + this.endT + 6) {
      const nodes: AudioNode[] = [];
      for (const g of [this.master, this.fxMaster, this.wetMaster]) if (g) nodes.push(g);
      for (const b of this.buses.values()) nodes.push(...b.gains);
      this.dead.push({ t: now, nodes });
      this.buses.clear(); this.master = null; this.fxMaster = null; this.wetMaster = null;
      this.running = false;
      this.fx.release();
    }
  }

  private retire(now: number): void {
    this.nextRetire = now + 0.5;
    this.buses.forEach((b, i) => {
      const sec = this.secs[i];
      if (!sec || now > this.anchor + sec.t1 + 9) {
        this.dead.push({ t: now, nodes: b.gains });
        this.buses.delete(i);
      }
    });
  }

  // ---------------------------------------------------------------------------------- buses

  private bus(i: number, now: number): Bus | null {
    let b = this.buses.get(i);
    if (b) return b;
    if (!this.master || !this.fxMaster || !this.wetMaster) return null;
    const ctx = this.ctx;
    const g = ctx.createGain(), wet = ctx.createGain(), send = ctx.createGain(), fg = ctx.createGain(), fwet = ctx.createGain();
    send.gain.value = 0.22;
    g.connect(this.master); g.connect(send); send.connect(this.wetMaster); wet.connect(this.wetMaster);
    fg.connect(this.fxMaster); fwet.connect(this.wetMaster);
    b = { gains: [g, wet, fg, fwet, send], m: { dry: g, wet }, fx: { dry: fg, wet: fwet }, sec: i };
    this.buses.set(i, b);
    this.envelope(b, now);
    return b;
  }

  /** Section bus envelope: hold, then cut / crossfade at the section end depending on what follows. */
  private envelope(b: Bus, now: number): void {
    const sec = this.secs[b.sec];
    if (!sec) return;
    const t1 = Math.max(now + 0.05, this.anchor + sec.t1);
    for (const g of b.gains.slice(0, 4)) {
      const p = g.gain;
      const v0 = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(v0 > 0 ? v0 : 1, now);
      if (sec.exit === 'cut') { p.setValueAtTime(1, Math.max(now, t1 - 0.03)); p.linearRampToValueAtTime(0, t1 + 0.012); }
      else if (sec.exit === 'x') { p.setValueAtTime(1, t1); p.setTargetAtTime(0, t1, sec.tau); }
    }
  }

  // ---------------------------------------------------------------------------------- world hooks

  /** Muffle the world (ambience + sound design through the engine's slow-motion filter) — slow motion. */
  private muffle(t: number, hz: number, tau: number, verb: number): void {
    const c = this.c;
    c.slowFilter.frequency.setTargetAtTime(c.hz(hz), t, tau);
    c.slowVerb.gain.setTargetAtTime(verb, t, tau);
  }

  private restoreWorld(now: number, tau: number): void {
    const c = this.c;
    try {
      for (const p of [c.slowFilter.frequency, c.slowVerb.gain, c.hallRet.gain]) { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); }
      c.slowFilter.frequency.setTargetAtTime(c.hz(18000), now, tau / 3);
      c.slowVerb.gain.setTargetAtTime(0, now, tau / 3);
      c.hallRet.gain.setTargetAtTime(c.hallLevel, now, tau / 3);
    } catch { /* ignore */ }
  }

  /** Kill the reverb tail at once (the roar that "cuts out at once"), then let the hall back in slowly. */
  private hallCut(t: number, back: number): void {
    const p = this.c.hallRet.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(this.c.hallLevel, t - 0.005);
    p.linearRampToValueAtTime(0, t + 0.02);
    p.setValueAtTime(0, t + 0.4);
    p.linearRampToValueAtTime(this.c.hallLevel, t + back);
  }

  // ---------------------------------------------------------------------------------- planning helpers

  /** Schedule `fn` at film time `at` on the bus of section `sec` (or of a later section `busSec` — a layer that spans). */
  private add(sec: Sec, at: number, fn: Fn, hold = 0, busSec?: Sec, tight = false): void {
    if (!Number.isFinite(at)) return;
    this.evs.push({ at, bus: (busSec ?? sec).i, hold, fn, tight });
  }
  private sec(cue: FilmCue): Sec | undefined { return this.secs.find((x) => x.cue === cue); }
  /** Film time of a sync point inside a shot of `sec` (clamped to the shot). */
  private at(sec: Sec, shotId: string, s: number): number {
    const sh = sec.shots.find((x) => x.id === shotId) ?? sec.shots[0];
    if (!sh) return sec.t0 + s;
    return sh.t + clamp(s, 0, Math.max(0, sh.dur - 0.05));
  }
  /** Film time of the section's k-th on-screen text (verse / name / line), or `fallback` s into the section. */
  private text(sec: Sec, k: number, fallback: number): number {
    const x = sec.texts[k];
    return x !== undefined ? x : sec.t0 + fallback;
  }
  /** A sub-bass tone that stays audible on phone speakers: lite voicing moves it up an octave with harmonics. */
  private ground(m: Out, t: number, h: number, level: number, attack: number, release: number): void {
    if (this.lite) this.s.pad(m, t, h, [38], { level: level * 0.9, attack, release, cutoff: 320, voices: 2, detune: 3 });
    else this.s.pad(m, t, h, [26], { level, attack, release, cutoff: 150, voices: 2, detune: 3, type: 'triangle' });
  }
  private shotStart(sec: Sec, idx: number): number {
    const sh = sec.shots[idx];
    return sh ? sh.t : sec.t0;
  }

  private plan(sec: Sec): void {
    const prev = this.secs[sec.i - 1];
    const bed = CUE_BED[sec.cue];
    if (!prev || CUE_BED[prev.cue] !== bed) {
      const fade = sec.i === 0 ? 1 : sec.cue === 'thicket' ? 0.35 : sec.cue === 'title' ? 0.05 : sec.exit === 'cut' || sec.cut === 'hard' || sec.cut === 'cut' ? 0.3 : Math.max(0.6, sec.fade || 1.5);
      // held over the whole run of sections sharing the bed (so starting mid-run still sets it)
      let j = sec.i;
      while (j + 1 < this.secs.length && CUE_BED[this.secs[j + 1].cue] === bed) j++;
      this.add(sec, sec.t0, (t) => { if (this.onAmbience) this.onAmbience(bed, fade, t); }, this.secs[j].t1 - sec.t0);
    }
    switch (sec.cue) {
      case 'dark': this.planDark(sec); break;
      case 'land': this.planLand(sec); break;
      case 'rachel': this.planRachel(sec); break;
      case 'threat': this.planThreat(sec); break;
      case 'elders': this.planElders(sec); break;
      case 'shofar': this.planShofar(sec); break;
      case 'saul': this.planSaul(sec); break;
      case 'peak': this.planPeak(sec); break;
      case 'silence': this.planSilence(sec); break;
      case 'faceoff': this.planFaceoff(sec); break;
      case 'tear': this.planTear(sec); break;
      case 'verdict': this.planVerdict(sec); break;
      case 'broken': this.planBroken(sec); break;
      case 'rise': this.planRise(sec); break;
      case 'bethlehem': this.planBethlehem(sec); break;
      case 'figure': this.planFigure(sec); break;
      case 'face': this.planFace(sec); break;
      case 'contrast': this.planContrast(sec); break;
      case 'peace': this.planPeace(sec); break;
      case 'thicket': this.planThicket(sec); break;
      case 'title': this.planTitle(sec); break;
    }
  }

  // ================================================================================ PROLOGUE

  /** 1 — Black. Wind; a single deep tone. The prologue's D pedal starts here and runs to the shofar cut. */
  private planDark(sec: Sec): void {
    const S = this.s, lite = this.lite;
    const last = this.lastOf(['dark', 'land', 'rachel', 'threat', 'elders']) ?? sec;
    const end = last.t1;
    // the pedal: D1 + D2, very dark, breathing; it lives on the bus of the prologue's last section (cut by the shofar)
    this.add(sec, sec.t0, (t, m, h) => S.pad(m, t, h, lite ? [38, 50] : [26, 38], {
      level: 0.06, attack: 3.2, release: 1.2, cutoff: 200, cutoffEnd: 380, voices: lite ? 2 : 3, detune: 5, lfoCents: 180,
    }), end - sec.t0, last);
    // the single deep tone under the time card: a soft tuned boom and a low hum
    this.add(sec, sec.t0 + 0.7, (t, m) => {
      S.drum(m, t, 'boom', 0.34, 0, 0.94);
      S.choir(m, t + 0.05, 3.6, [38, 45], { level: 0.03, attack: 1.4, release: 1.8, vowel: 'oo', breath: 0.05 });
    });
    this.add(sec, sec.t0 + 0.2, (t, _m, _h, fx) => this.fx.windSwell(fx, t, 4.8, 0.035, 300, 900, -0.4, 0.3));
  }

  /** 2 — above the clouds, the break through the deck, Judah at dawn: vast air, far voices, a distant shofar. */
  private planLand(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const brk = this.at(sec, 'land', SYNC.land.breakThrough);
    // high string air (harmonics) over the cloud sea
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h + 1.5, [74, 81], {
      level: 0.018, attack: 4, release: 2.5, cutoff: 2600, voices: 2, detune: 6, lfoCents: 90, trem: 0.25, tremRate: 5.5,
    }), d);
    this.add(sec, t0 + 1.2, (t, m, h) => S.choir(m, t, h, lite ? [57, 62] : [50, 57, 62], {
      level: 0.028, attack: 3, release: 2, vowel: 'oo', breath: 0.06,
    }), brk - t0 - 0.6);
    // through the deck: the air rushes, the chord opens (D5 → Dsus2, voices to "ah", low strings)
    this.add(sec, brk - 1.6, (t, _m, _h, fx) => this.fx.windSwell(fx, t, 3.4, 0.06, 450, 2400, 0.4, -0.4));
    this.add(sec, brk - 0.4, (t, m, h) => {
      S.choir(m, t, h, lite ? [50, 57, 64, 69] : [50, 57, 62, 64, 69], { level: 0.05, attack: 1.8, release: 3, vowel: 'oh', to: 'ah', morph: 3, breath: 0.08 });
      S.pad(m, t, h, [38, 45, 50, 57], { level: 0.05, attack: 2.2, release: 3, cutoff: 900, cutoffEnd: 1400, voices: lite ? 2 : 3, detune: 8 });
    }, sec.t1 - brk + 1.2);
    // "the tribes of Israel dwelling in their land": a distant tekiah over the hills, answered by the valleys
    this.add(sec, brk + 2.2, (t, m) => { S.shofar(this.far(m, t, 8, 2400, 0.55, 0.7), t, 'tekiah', 0.22); });
    // the frame drums begin, far and slow — they will rise through the prologue
    const p0 = brk + 4.5;
    for (let x = p0; x < sec.t1 - 0.2; x += BEAT * 2) {
      const u = (x - p0) / Math.max(1, sec.t1 - p0);
      this.add(sec, x, (t, m) => S.drum(m, t, 'dum', 0.1 + 0.08 * u, -0.2, 0.9));
    }
  }

  /** 3 — Rachel's pillar in the first light: the shepherd's pipe lament, a humming voice; drums rising. */
  private planRachel(sec: Sec): void {
    const S = this.s, t0 = sec.t0, d = sec.t1 - t0;
    this.add(sec, t0 + 0.6, (t, m) => {
      S.ney(this.far(m, t, 8, 3200, 0.45, 0.6), t, notes([[69, 0.9], [70, 0.55], [69, 0.45], [67, 0.7], [65, 0.8], [64, 0.6], [62, 2.4]]), 0.13);
    });
    this.add(sec, t0 + 1.2, (t, m, h) => this.line(m, t, [[62, 1.6], [65, 1.2], [64, 1.2], [62, 2.4]], clamp((h - 0.5) / 6.4, 0.5, 0.9), 0.024, 'hum'), d - 1.2);
    this.add(sec, t0 + 0.4, (t, m, h) => S.pad(m, t, h, [50, 57, 58], { level: 0.015, attack: 2.5, release: 1.5, cutoff: 700, voices: 2, detune: 7 }), d);
    // tof: a slow pulse growing into the threat, with ghost notes from the second shot
    const road = this.shotStart(sec, 1);
    let k = 0;
    for (let x = t0 + 0.3; x < sec.t1 - 0.1; x += BEAT, k++) {
      const u = (x - t0) / d;
      const kk = k;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'dum', 0.1 + 0.14 * u, -0.15, 0.95);
        if (x > road && kk % 2 === 1) S.drum(m, t + BEAT * 0.5, 'tek', 0.06 + 0.06 * u, 0.2);
      });
    }
    // the passing flock of shot 3b
    this.add(sec, road + 0.5, (t, _m, _h, fx) => { this.fx.bleat(fx.dry, t, 0.22, 0.5); this.fx.bleat(fx.dry, t + 1.4, 0.16, 0.6, 'lambBleat'); });
  }

  /** 4 — the Philistine host on the coastal plain: war drums (104 bpm), D Phrygian ostinato, bronze. */
  private planThreat(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const st = BEAT_PH / 4;
    const pat = 'B.tkD.tkB.tkDtkk';
    const OST = [0, 0, 1, 0, 0, 0, 1, 3];
    const end = sec.t1 - (sec.exit === 'x' ? 0.25 : 0.05);
    const n = Math.floor((end - t0) / st);
    for (let k = 0; k < n; k++) {
      const tt = t0 + k * st, s16 = k % 16, bar = Math.floor(k / 16), kk = k;
      const u = (tt - t0) / d;
      const ch = pat[s16];
      this.add(sec, tt, (t, m, _h, fx) => {
        const dry: Out = { dry: m.dry, wet: null };
        const g = 0.9 + 0.4 * u;
        switch (ch) {
          case 'B': S.drum(m, t, 'taiko', 0.5 * g, 0); S.drum(dry, t, 'dum', 0.4 * g, -0.1); break;
          case 'D': S.drum(dry, t, 'dum', 0.38 * g, 0.1); break;
          case 't': S.drum(dry, t, 'tek', 0.18 * g, 0.2); break;
          case 'k': if (!lite || chance(0.5)) S.drum(dry, t, 'ka', rand(0.1, 0.18) * g, -0.25); break;
        }
        if (kk % 2 === 0) S.strStac(dry, t, 38 + OST[(kk / 2) % 8], (kk / 2) % 4 === 0 ? 0.6 : 0.42, 0.16, 0.7);
        if (s16 === 0) {
          this.fx.bronze(fx, t + 0.005, 0.03 + 0.025 * u, rand(-0.5, 0.5));
          if (bar % 2 === 0) S.choir(m, t, BEAT_PH * 8, lite ? [50, 51] : [38, 50, 51, 57], { level: 0.04 + 0.03 * u, attack: 1.2, release: 0.6, vowel: 'ah', breath: 0.1 });
        }
      });
    }
    // the hit on the cut + a low brass-like drone of menace
    this.add(sec, t0, (t, m) => { this.hit(m, t, 0.45, false); }, 0, undefined, true);
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h, [26, 38, 39], { level: 0.05, attack: 1.5, release: 0.5, cutoff: 500, cutoffEnd: 900, voices: lite ? 2 : 3, detune: 12 }), d);
    // the host: far tread, dust, bronze, the sea beyond
    this.add(sec, t0, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.11, 0.9, 1500, 0.8);
      this.fx.surf(fx, t, h, 0.012);
    }, d);
    this.add(sec, t0 + 1.2, (t, _m, _h, fx) => this.fx.dustGust(fx, t, 2.6, 0.05));
    // 4b — the telephoto glint: helmets and spear points in the haze (a bright sting of bronze)
    const gl = this.shotStart(sec, 1);
    if (gl > t0) {
      this.add(sec, gl, (t, m, _h, fx) => {
        this.fx.clinks(fx, t + 0.1, 0.02, 3);
        S.pad(m, t, 2.4, [81, 82], { level: 0.012, attack: 0.3, release: 1.5, cutoff: 5000, voices: 2, detune: 5, trem: 0.4, tremRate: 9 });
      });
    }
  }

  /** 5 — the elders at Ramah before Samuel (8:5): a solemn chord of men's voices, Dm – B♭ – Gm – A; the suck into the cut. */
  private planElders(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    // Dm, then the DEMAND (B♭, fuller) as the words of 8:5 land on screen, Gm, and the unresolved A into the cut
    const verse = this.text(sec, 0, 1.2);
    const times = [t0 + 0.2, clamp(verse + 0.8, t0 + 1.4, t0 + d * 0.45), t0 + 0.2 + 0.58 * (d - 0.2), t0 + 0.2 + 0.8 * (d - 0.2)];
    const seq: readonly ChordName[] = ['Dm', 'Bb', 'Gm', 'A'];
    seq.forEach((cn, i) => {
      const at = times[i];
      const len = (i + 1 < seq.length ? times[i + 1] : sec.t1) - at;
      const ch = CHORDS[cn];
      const last = i === seq.length - 1, demand = i === 1;
      this.add(sec, at, (t, m) => {
        S.choir(m, t, len + 0.6, voicing(ch, 43, demand ? 67 : 62).slice(0, lite ? 3 : demand ? 6 : 5), { level: last || demand ? 0.07 : 0.055, attack: 0.9, release: 0.7, vowel: demand ? 'ah' : 'oh', breath: 0.07 });
        S.pad(m, t, len + 0.5, lite ? [rootIn(ch, 38), rootIn(ch, 50)] : [rootIn(ch, 26), rootIn(ch, 38)], { level: 0.05, attack: 0.8, release: 0.6, cutoff: 600, voices: lite ? 2 : 3, detune: 7 });
        S.drum(m, t, demand ? 'taiko' : 'dum', demand ? 0.3 : 0.2, 0, 0.85);
      });
    });
    // the elders murmur in the gate
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(fx, t, h, 0.3, this.lite ? 2 : 3), d - 1);
    // the reverse swell into the hard cut (only if the shofar comes next)
    if (sec.exit === 'cut') {
      this.add(sec, sec.t1 - 1.3, (t, m) => {
        this.fx.suck(m, t + 1.3, 1.3, 0.12, 1.2);
        riserFx(this.c, S, m, t, 1.3, 'dark', 0.9, lite);
      });
    }
  }

  // ================================================================================ ACT I

  /** 6 — HARD CUT on a shofar blast: the army out of the dust; massive drums, low male voices. */
  private planShofar(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    this.add(sec, t0, (t, m, _h, fx) => {
      S.shofar(m, t, 'gedolah', 0.5, 220, 293.66);
      this.hit(m, t, 0.95, true);
      this.fx.impact(fx, t, 0.5, 2.2);
    }, 0, undefined, true);
    // the army: thousands on foot, bronze, the murmur of the ranks, dust
    this.add(sec, t0, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.55, 1, 6500, 0.6);
      this.fx.murmur(fx, t + 0.4, h - 0.4, 0.5);
    }, d);
    this.add(sec, t0 + 0.3, (t, _m, _h, fx) => this.fx.dustGust(fx, t, 3.2, 0.09));
    for (let x = t0 + 0.9; x < sec.t1 - 0.3; x += rand(0.35, 0.8)) {
      this.add(sec, x, (t, _m, _h, fx) => {
        this.fx.clinks(fx, t, rand(0.012, 0.03));
        if (chance(0.45)) this.fx.knock(fx, t + rand(0.05, 0.3), rand(0.02, 0.04), randi(1, 3));
      });
    }
    // drums: the shofar's call first, then the pulse (84 bpm) with low men's voices on D
    const p0 = t0 + BEAT * 2;
    const nb = Math.floor((sec.t1 - p0) / BEAT);
    for (let k = 0; k < nb; k++) {
      const tt = p0 + k * BEAT, kk = k, u = k / Math.max(1, nb);
      this.add(sec, tt, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(m, t, 'taiko', (kk % 2 === 0 ? 0.55 : 0.4) * (0.85 + 0.3 * u), kk % 2 ? 0.25 : -0.25);
        S.drum(dry, t, 'dum', 0.35, 0);
        S.drum(dry, t + BEAT * 0.5, 'tek', 0.14, 0.2);
        if (!lite) S.drum(dry, t + BEAT * 0.75, 'ka', 0.1, -0.3);
        S.strStac(dry, t, kk % 4 === 2 ? 45 : 38, 0.55, 0.3, 0.6);
        if (kk % 4 === 0) {
          S.choir(m, t, BEAT * 4 + 0.3, lite ? [38, 45] : [38, 45, 50], { level: 0.07 + 0.03 * u, attack: 0.08, release: 0.5, vowel: 'oh', breath: 0.12 });
        }
      });
    }
    this.add(sec, t0 + 0.2, (t, m, h) => S.pad(m, t, h, [26, 38, 45], { level: 0.07, attack: 0.6, release: 0.8, cutoff: 700, voices: lite ? 2 : 3, detune: 10 }), d);
  }

  /** 7 — Saul, slow motion: half-time drums, his theme in low strings and men's voices; the world muffled. */
  private planSaul(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    // slow motion: the world (ambience + army) through the slow filter, the tread slowed and deepened
    this.add(sec, t0, (t, _m, h, fx) => {
      this.muffle(t, 1300, 0.12, 0.35);
      this.fx.march(fx, t, h, 0.55, 0.42, 2400, 0.15);
      this.fx.windSwell(fx, t + 0.5, h - 0.5, 0.04, 250, 700, 0.3, -0.3);
    }, d);
    this.add(sec, sec.t1 - 0.02, (t) => this.muffle(t, 18000, 0.04, 0), 0, undefined, true);
    for (let x = t0; x < sec.t1 - 0.4; x += BEAT * 2) {
      const first = x === t0;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', first ? 0.7 : 0.5, 0, 0.82);
        S.drum(m, t, 'boom', first ? 0.3 : 0.16, 0, 0.9);
      });
    }
    const beat = clamp((d - 0.6) / 13, 0.45, 0.72);
    this.add(sec, t0 + 0.15, (t, m) => {
      this.line(m, t, SAUL, beat, 0.095, 'str');
      this.line(m, t + 0.02, SAUL.map(([n, b]) => [n - 12, b] as const), beat, 0.075, 'men');
    });
    this.add(sec, t0, (t, m, h) => {
      S.pad(m, t, h, [74, 81], { level: 0.016, attack: 1.2, release: 0.5, cutoff: 3000, voices: 2, detune: 8, trem: 0.5, tremRate: 7 });
      S.pad(m, t, h, lite ? [38, 50] : [26, 38], { level: 0.07, attack: 0.4, release: 0.5, cutoff: 400, voices: lite ? 2 : 3, detune: 6 });
    }, d);
  }

  /** 8 — THE PEAK: the spear raised; his theme at full power; the roar of thousands. Cut at once. */
  private planPeak(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0;
    const halt = this.at(sec, 'gilgal-spear', SYNC['gilgal-spear'].halt);
    const top = this.at(sec, 'gilgal-spear', SYNC['gilgal-spear'].top);
    const roar = this.at(sec, 'gilgal-spear', SYNC['gilgal-spear'].roar);
    // the march until the halt, then the drum roll into the raise
    this.add(sec, t0, (t, _m, _h, fx) => this.fx.march(fx, t, Math.max(0.4, halt - t0 + 0.3), 0.5, 1, 6500, 0.05));
    for (let x = t0; x < top - 0.05; x += BEAT / 4) {
      const u = (x - t0) / Math.max(0.5, top - t0);
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(dry, t, u > 0.5 ? 'tek' : 'ka', 0.08 + 0.26 * u * u, rand(-0.3, 0.3));
        if (Math.abs(((x - t0) / BEAT) % 1) < 0.01) S.drum(m, t, 'taiko', 0.25 + 0.3 * u, 0);
      });
    }
    this.add(sec, top - 1.1, (t, m) => riserFx(this.c, S, m, t, 1.1, 'dark', 1, lite));
    // THE TOP of the spear: the hit, the theme in full (choir + strings + men), the shofar's teruah
    this.add(sec, top, (t, m) => this.hit(m, t, 1, true), 0, undefined, true);
    const beat = clamp((sec.t1 - top) / 8.5, 0.3, 0.6);
    this.add(sec, top, (t, m, h) => {
      const chords: ReadonlyArray<readonly [ChordName, number]> = [['Dm', 0], ['Bb', 4], ['Gm', 6], ['A', 7]];
      for (const [cn, b] of chords) {
        const ch = CHORDS[cn];
        S.choir(m, t + b * beat, Math.min(h, 4 * beat) + 0.4, voicing(ch, 50, 74).slice(0, lite ? 4 : 7), { level: 0.1, attack: 0.05, release: 0.4, vowel: 'ah', breath: 0.16 });
        S.pad(m, t + b * beat, Math.min(h, 4 * beat) + 0.3, [rootIn(ch, 26), rootIn(ch, 38), rootIn(ch, 38) + 7], { level: 0.1, attack: 0.04, release: 0.3, cutoff: 1500, voices: lite ? 2 : 3, detune: 11 });
      }
      this.line(m, t, SAUL.map(([n, b2]) => [n + 12, b2] as const), beat, 0.08, 'str');
      this.line(m, t, SAUL.map(([n, b2]) => [n - 12, b2] as const), beat, 0.07, 'men');
    }, sec.t1 - top);
    for (let x = top; x < sec.t1 - 0.05; x += BEAT) {
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', 0.6, -0.2); S.drum(m, t + 0.01, 'taiko', 0.5, 0.25);
        S.drum({ dry: m.dry, wet: null }, t + BEAT * 0.5, 'dum', 0.4, 0);
      });
    }
    this.add(sec, top + 0.45, (t, m) => { S.shofar(m, t, 'teruah', 0.3, 220, 293.66); });
    // the roar of thousands, raising their spears — it rings to the cut
    this.add(sec, roar, (t, _m, h, fx) => {
      this.fx.roar(fx, t, h, 0.16, top - roar + 0.3);
      for (let i = 0; i < (lite ? 3 : 7); i++) this.fx.clinks(fx, t + 0.5 + rand(0, 1.4), 0.03, 2);
      for (let i = 0; i < (lite ? 2 : 5); i++) this.fx.knock(fx, t + 0.4 + rand(0, 1.8), 0.05, randi(2, 4));
    }, sec.t1 - roar + 0.2);
  }

  /** 9 — SILENCE: the roar cut at once; only wind and the far sound of the spoil (15:14); the ranks part. */
  private planSilence(sec: Sec): void {
    const S = this.s, t0 = sec.t0, d = sec.t1 - t0;
    this.add(sec, t0, (t) => this.hallCut(t, 3.2), 0, undefined, true);
    const pf = this.at(sec, 'gilgal-silence', SYNC['gilgal-silence'].partFrom);
    const pt = this.at(sec, 'gilgal-silence', SYNC['gilgal-silence'].partTo);
    // the spoil, far away: bleating and the lowing of oxen
    this.add(sec, t0 + 1.1, (t, _m, _h, fx) => { const f = this.far(fx, t, 4, 1800, 0.35, 0.5); this.fx.bleat(f.dry, t, 0.2, -0.6); });
    this.add(sec, t0 + 2.2, (t, _m, _h, fx) => this.fx.lowing(this.far(fx, t, 4, 1400, 0.4, 0.5), t, 0.018, 0.55));
    this.add(sec, t0 + 3.6, (t, _m, _h, fx) => { const f = this.far(fx, t, 4, 1800, 0.35, 0.5); this.fx.bleat(f.dry, t, 0.14, 0.7, 'goatBleat'); });
    if (d > 6) this.add(sec, t0 + 6.1, (t, _m, _h, fx) => { const f = this.far(fx, t, 4, 1800, 0.35, 0.5); this.fx.bleat(f.dry, t, 0.16, -0.3); });
    // the front ranks part: shuffling feet, cloth, a clink
    this.add(sec, pf, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.07, 0.75, 1100, 0.8);
      this.fx.clinks(fx, t + h * 0.4, 0.008);
    }, pt - pf);
    // under the name of Samuel: the ground tone creeps in
    const name = this.text(sec, 0, d * 0.45);
    this.add(sec, name, (t, m, h) => this.ground(m, t, h, 0.05, 2.5, 1), sec.t1 - name + 0.5);
  }

  /** 10a — the face-off: one sustained string (A) that will carry into the tear. */
  private planFaceoff(sec: Sec): void {
    const S = this.s, t0 = sec.t0;
    const tear = this.sec('tear');
    const end = tear ? tear.t1 : sec.t1;
    const bus = tear ?? sec;
    this.add(sec, t0 + 0.1, (t, m, h) => S.pad(m, t, h, [57], {
      level: 0.045, attack: Math.min(4.5, h * 0.6), release: 1.5, cutoff: 1300, voices: 2, detune: 4, lfoCents: 60,
      vib: 11, vibRate: 5.1, vibDelay: 1.6,
    }), end - t0 - 0.1, bus);
    this.add(sec, t0, (t, m, h) => this.ground(m, t, h, 0.045, 0.5, 1), end - t0, bus);
    this.add(sec, t0 + 2.4, (t, _m, _h, fx) => this.fx.lowing(this.far(fx, t, 4, 1300, 0.4, 0.5), t, 0.012, -0.5));
  }

  /** 10b — THE TEAR (15:27): Samuel turns, Saul seizes the corner of the me'il, it tears in slow motion. */
  private planTear(sec: Sec): void {
    const S = this.s, lite = this.lite;
    const B = SYNC['gilgal-tear'];
    const id = 'gilgal-tear';
    const turn = this.at(sec, id, B.turn), grab = this.at(sec, id, B.grab), slow = this.at(sec, id, B.slowIn);
    const r0 = this.at(sec, id, B.ripFrom), r1 = this.at(sec, id, B.ripTo);
    this.add(sec, turn, (t, _m, _h, fx) => this.fabric(fx, t, 0.9, 0.022));
    this.add(sec, this.at(sec, id, B.go), (t, _m, _h, fx) => { for (let i = 0; i < 2; i++) this.fx.march(fx, t + i * 0.55, 0.3, 0.05, 0.9, 1200, 0.02); });
    this.add(sec, this.at(sec, id, B.lunge) - 0.45, (t, m) => this.fx.suck(m, t + 0.45 + (grab - this.at(sec, id, B.lunge)), 0.45 + (grab - this.at(sec, id, B.lunge)), 0.035, 0.8));
    // the grab: the world drops into slow motion
    this.add(sec, grab, (t, m, _h, fx) => {
      this.fx.grab(fx, t, 0.35);
      this.muffle(t, 700, (slow - grab) / 2.5, 0.45);
      S.drum(m, t, 'boom', 0.25, 0, 0.7);
    }, 0, undefined, true);
    // the rip itself — on the music bus so the slow-motion filter does not dull it
    this.add(sec, r0, (t, m) => this.fx.rip(m, t, r1 - r0, 0.4), 0, undefined, true);
    // the music: the held A is joined by B♭ (a semitone of grief), a low cluster swells and breaks with the cloth
    this.add(sec, grab + 0.1, (t, m, h) => {
      S.pad(m, t, h, [58], { level: 0.04, attack: h * 0.8, release: 0.8, cutoff: 1400, voices: 2, detune: 5, lfoCents: 80, vib: 14, vibRate: 5.8, vibDelay: 0.8 });
      S.choir(m, t, h, lite ? [45, 46] : [38, 45, 46, 52], { level: 0.035, attack: h * 0.7, release: 1, vowel: 'oo', breath: 0.12 });
    }, r1 - grab);
    this.add(sec, r1 - 0.05, (t, m, _h, fx) => {
      S.drum(m, t, 'boom', 0.4, 0, 0.75);
      this.fx.impact(fx, t, 0.18, 2.4);
      S.choir(m, t + 0.05, 2.2, [45, 46], { level: 0.02, attack: 0.05, release: 1.8, vowel: 'oo', breath: 0.2 });
    });
    // leaving slow motion into the verdict
    this.add(sec, sec.t1 - 0.2, (t) => this.muffle(t, 18000, 0.25, 0));
  }

  /** 11 — the verdict (15:28), close on Samuel: near-silence; a ground tone and one high thread of sound. */
  private planVerdict(sec: Sec): void {
    const S = this.s, t0 = sec.t0, d = sec.t1 - t0;
    this.add(sec, t0, (t, m, h) => this.ground(m, t, h, 0.05, 1.5, 1.2), d);
    const verse = this.text(sec, 0, 1.4); // 15:28 on screen
    this.add(sec, verse, (t, m, h) => {
      S.choir(m, t, h, [38], { level: 0.022, attack: 3, release: 2, vowel: 'oo', breath: 0.04 });
      S.pad(m, t + 1.5, h - 1.5, [81], { level: 0.006, attack: 3, release: 1.5, cutoff: 4000, voices: 1, type: 'sine', lfoCents: 20 });
    }, sec.t1 - verse);
  }

  /** 12 — Saul shattered: his theme on a lone cello, stalling and falling below the tonic; a lament under it. */
  private planBroken(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const tot = SAUL_BROKEN.reduce((a, [, b]) => a + b, 0);
    const beat = clamp((d - 1.2) / tot, 0.28, 0.6);
    this.add(sec, t0 + 0.5, (t, m) => this.line(m, t, SAUL_BROKEN, beat, 0.06, 'cello'));
    const chords: ReadonlyArray<readonly [ChordName, number]> = [['Dm', 0], ['Bb', 0.35], ['Gm', 0.6], ['A', 0.82]];
    chords.forEach(([cn, f], i) => {
      const at = t0 + f * d, nx = chords[i + 1];
      const len = (nx ? t0 + nx[1] * d : sec.t1) - at;
      const ch = CHORDS[cn];
      this.add(sec, at, (t, m) => {
        S.pad(m, t, len + 0.8, voicing(ch, 38, 57).slice(0, lite ? 2 : 4), { level: 0.03, attack: 1.2, release: 1, cutoff: 700, voices: 2, detune: 6 });
      });
    });
    this.add(sec, t0 + d * 0.4, (t, m, h) => this.line(m, t, [[50, 2], [49, 2], [48, 2], [46, 3]], h / 9.5, 0.018, 'men'), d * 0.6);
    // the army behind him, out of focus
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(this.far(fx, t, h + 1, 900, 0, 0.4), t, h, 0.18, 2), d);
  }

  // ================================================================================ THE RISE

  /** 13 — the rise into the sky, searching: from dark to warm, a 15 s swell into D major. */
  private planRise(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const seq: ReadonlyArray<readonly [ChordName, number]> = [['Dm', 0], ['Bb', 0.2], ['F', 0.4], ['C', 0.58], ['G', 0.74], ['A', 0.87]];
    seq.forEach(([cn, f], i) => {
      const at = t0 + f * d, nx = seq[i + 1];
      const len = (nx ? t0 + nx[1] * d : sec.t1) - at;
      const ch = CHORDS[cn];
      const u = f;
      this.add(sec, at, (t, m) => {
        S.pad(m, t, len + 0.9, [rootIn(ch, 26), ...voicing(ch, 45, 62).slice(0, lite ? 2 : 4)], {
          level: 0.035 + 0.05 * u, attack: Math.min(1.6, len * 0.6), release: 0.9, cutoff: 700 + 1600 * u, voices: lite ? 2 : 3, detune: 8,
        });
        S.choir(m, t, len + 0.8, voicing(ch, 50 + Math.round(12 * u), 72 + Math.round(6 * u)).slice(0, lite ? 3 : 5), {
          level: 0.025 + 0.06 * u, attack: Math.min(1.4, len * 0.5), release: 0.9, vowel: u < 0.35 ? 'oo' : u < 0.7 ? 'oh' : 'ah', breath: 0.07,
        });
      });
    });
    // the searching line: strings climbing D – F – A – C – D – E, landing on F# at Bethlehem
    this.add(sec, t0 + 0.4, (t, m) => this.line(m, t, [[62, 3], [65, 3], [69, 2.5], [72, 2], [74, 1.8], [76, 2.2]], (d - 0.6) / 14.5, 0.05, 'str'));
    const v1314 = this.text(sec, 0, d * 0.3); // 13:14 on screen: a high voice enters with the words
    this.add(sec, v1314, (t, m, h) => S.choir(m, t, h + 1, [81], { level: 0.02, attack: Math.min(4, h * 0.5), release: 1, vowel: 'oo', breath: 0.05 }), sec.t1 - v1314);
    // the army's murmur falls away below; the air of altitude
    this.add(sec, t0, (t, _m, _h, fx) => this.fx.murmur(fx, t, 3.5, 0.2, 2));
    this.add(sec, t0 + 0.3, (t, _m, _h, fx) => this.fx.windSwell(fx, t, 6, 0.05, 300, 1600, -0.5, 0.5));
    this.add(sec, t0 + d * 0.55, (t, _m, _h, fx) => this.fx.windSwell(fx, t, d * 0.45 + 0.8, 0.055, 500, 2600, 0.5, -0.4));
    // the warm riser and a kinnor glissando into the light
    this.add(sec, sec.t1 - 2.6, (t, m) => riserFx(this.c, S, m, t, 2.6, 'warm', 0.8, lite));
    this.add(sec, sec.t1 - 0.9, (t, m) => {
      const g = [62, 64, 66, 69, 71, 74, 76, 78, 81];
      g.forEach((n, i) => S.lyre(m, t + i * 0.085, n, 0.35 + i * 0.03, lyrePan(n)));
    });
  }

  // ================================================================================ ACT II

  /** 14 — Bethlehem in golden light: the D-major bloom, the kinnor in 6/8. */
  private planBethlehem(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const bloom = t0 + Math.min(0.5, (sec.fade || 1.6) * 0.3);
    this.add(sec, bloom, (t, m, h) => {
      S.drum(m, t, 'boom', 0.22, 0, 1);
      S.choir(m, t, h, lite ? [50, 57, 62, 66] : [50, 57, 62, 66, 69], { level: 0.055, attack: 0.6, release: 2.5, vowel: 'ah', to: 'oo', morph: 5, breath: 0.08 });
      S.pad(m, t, h, [38, 45, 50, 54], { level: 0.05, attack: 0.5, release: 2.5, cutoff: 1300, cutoffEnd: 800, voices: lite ? 2 : 3, detune: 8 });
      S.strum(m, t + 0.05, [50, 54, 57, 62, 66, 69], 0.5, 0.05);
    }, Math.min(d, 6));
    this.kinnor(sec, bloom + 1.6, sec.t1, ['D', 'G', 'D', 'A'], 0.8);
    this.add(sec, t0 + d * 0.55, (t, m, h) => S.pad(m, t, h + 1, [50, 57, 62], { level: 0.03, attack: 2, release: 1.5, cutoff: 1100, voices: 2, detune: 6 }), d * 0.45);
    this.add(sec, t0 + 2.5, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.16, 0.4));
    this.add(sec, t0 + d * 0.6, (t, _m, _h, fx) => this.fx.chukar(this.far(fx, t, 5, 4000, 0.3, 0.5), t, 0.014, -0.6));
  }

  /** 15 — the figure on the rock, from behind (16:11): David's motif on the pipe over the kinnor. */
  private planFigure(sec: Sec): void {
    const S = this.s, t0 = sec.t0, d = sec.t1 - t0;
    this.kinnor(sec, t0, sec.t1, ['D', 'C', 'G', 'D'], 0.85);
    const u = clamp((d - 1.8) / 13, 0.3, STEP68 * 1.25);
    this.add(sec, t0 + 0.9, (t, m) => { S.ney(m, t, motif(74, DAVID, u), 0.15); });
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h, [38, 45, 50], { level: 0.03, attack: 1.5, release: 1.2, cutoff: 800, voices: 2, detune: 5 }), d);
    this.add(sec, t0 + 0.8, (t, _m, _h, fx) => this.fx.windSwell(fx, t, 3.2, 0.03, 700, 2800, -0.3, 0.4)); // wind in his curls
    if (d > 5) this.add(sec, t0 + d - 2.6, (t, _m, _h, fx) => this.fx.bulbul(fx, t, 0.009, 0.5));
  }

  /** 16 — he turns: the face (16:12). Warm voices swell into the reveal; the pipe answers. */
  private planFace(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0;
    const turn = this.at(sec, 'face', SYNC.face.turn), rev = this.at(sec, 'face', SYNC.face.reveal);
    this.kinnor(sec, t0, sec.t1, ['G', 'D', 'A', 'D'], 0.7);
    this.add(sec, turn, (t, m, h) => {
      S.choir(m, t, h, lite ? [62, 66, 69] : [57, 62, 66, 69, 74], { level: 0.05, attack: rev - turn, release: 1.5, vowel: 'oo', to: 'ah', morph: rev - turn + 1, breath: 0.06 });
      S.pad(m, t, h, [38, 50, 57, 62], { level: 0.04, attack: rev - turn, release: 1.5, cutoff: 1500, voices: lite ? 2 : 3, detune: 7 });
    }, sec.t1 - turn + 0.3);
    const u = clamp((sec.t1 - rev - 0.4) / 11, 0.24, STEP68);
    this.add(sec, rev + 0.2, (t, m) => { S.ney(m, t, motif(74, ANSWER, u), 0.13); });
    this.add(sec, rev, (t, m) => S.strum(m, t, [62, 66, 69, 74], 0.45, 0.06));
  }

  /** 17 — the small youth in the vast land (16:7): David's full theme in D major, strings, voices, pipe, kinnor. */
  private planContrast(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const u = clamp((d - 1.4) / 12.5, 0.34, 0.5);
    const m0 = t0 + 0.3;
    this.add(sec, m0, (t, m) => {
      S.ney(m, t, motif(74, DAVID_MAJ, u), 0.16);
      this.line(m, t, DAVID_MAJ.map(([o, b]) => [62 + o, b] as const), u, 0.035, 'str');
    });
    const chords: ReadonlyArray<readonly [number, readonly number[], number]> = [
      [0, [38, 50, 54, 57, 62], 4], [4, [43, 50, 55, 59, 62], 2], [6, [45, 52, 57, 61, 64], 2], [8, [38, 50, 54, 57, 62], 5],
    ];
    for (const [at, ns, len] of chords) {
      this.add(sec, m0 + at * u, (t, m) => {
        S.choir(m, t, len * u + 0.8, ns.slice(1), { level: 0.05, attack: 0.5, release: 1, vowel: 'oh', breath: 0.07 });
        S.pad(m, t, len * u + 0.8, [ns[0], ns[0] + 7, ns[0] + 12], { level: 0.05, attack: 0.4, release: 1, cutoff: 1200, voices: lite ? 2 : 3, detune: 8 });
        S.strum(m, t, voicing([ (ns[0] - 2 + 120) % 12, (ns[3] - 2 + 120) % 12, (ns[2] - 2 + 120) % 12 ], 57, 74).slice(0, 4), 0.5);
      });
    }
    for (let x = m0; x < sec.t1 - 0.5; x += STEP68 * 3) this.add(sec, x, (t, m) => { S.drum({ dry: m.dry, wet: null }, t, 'tek', 0.07, 0.3); S.drum(m, t, 'dum', 0.1, -0.1); });
  }

  /** 18 — peace: the flock grazes, the lamb strays to the thicket. The music thins to the kinnor. */
  private planPeace(sec: Sec): void {
    const S = this.s, t0 = sec.t0, d = sec.t1 - t0;
    this.kinnor(sec, t0 + 0.4, sec.t1 - 0.6, ['D', 'C', 'D', 'G'], 0.55);
    this.add(sec, t0 + 1.4, (t, m) => { S.ney(m, t, notes([[74, 0.7], [81, 0.9], [79, 0.35], [77, 0.35], [76, 1.4]]), 0.1); });
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h, [50, 57], { level: 0.022, attack: 1.2, release: 1, cutoff: 900, voices: 2, detune: 5 }), d - 0.6);
    this.add(sec, t0 + 0.8, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.2, -0.3));
    this.add(sec, t0 + d * 0.62, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.24, 0.25, 'lambBleat', 1.05));
    // the birds of the Judean hills at golden hour (visual-bible 3.16) — they fall silent at the thicket
    this.add(sec, t0 + 0.3, (t, _m, _h, fx) => this.fx.chukar(this.far(fx, t, 5, 5000, 0.2, 0.4), t, 0.022, 0.6));
    if (d > 3.5) this.add(sec, t0 + 2.9, (t, _m, _h, fx) => this.fx.bulbul(fx, t, 0.012, -0.5));
  }

  // ================================================================================ THE HOOK

  /** 19 — the birds fall silent; something large shifts; heavy breathing; the eyes; a heartbeat. SMASH. */
  private planThicket(sec: Sec): void {
    const S = this.s, t0 = sec.t0;
    const T = SYNC.thicket;
    const sh = this.at(sec, 'thicket', T.shift), she = this.at(sec, 'thicket', T.shiftEnd), eyes = this.at(sec, 'thicket', T.eyes);
    const lamb = this.shotStart(sec, 1);
    this.add(sec, t0 + 0.2, (t, _m, h, fx) => this.fx.rumble(fx, t, h, 0.16), sec.t1 - t0 - 0.2);
    this.add(sec, t0 + 0.4, (t, m, h) => S.pad(m, t, h, [93], { level: 0.004, attack: h * 0.7, release: 0.2, cutoff: 6000, voices: 1, type: 'sine', lfoCents: 12 }), sec.t1 - t0 - 0.4);
    this.add(sec, sh, (t, _m, _h, fx) => this.fx.rustle(fx, t, she - sh + 0.3, 0.05));
    this.add(sec, sh + 0.35, (t, _m, _h, fx) => this.fx.breath(fx, t, 0.06, 1.0, 1.5));
    this.add(sec, eyes, (t, m, _h, fx) => {
      S.drum(m, t, 'boom', 0.28, 0, 0.8);
      S.pad(m, t, 1.8, [38, 39], { level: 0.03, attack: 0.02, release: 1.4, cutoff: 600, voices: 2, detune: 10 });
      this.fx.impact(fx, t, 0.08, 1.2);
    }, 0, undefined, true);
    // the heart: slow, then quickening in the lamb's shot
    const end = sec.t1 - 0.25;
    let x = eyes + 0.45, gap = 0.95;
    while (x < end) {
      const u = (x - eyes) / Math.max(0.5, end - eyes);
      this.add(sec, x, (t, _m, _h, fx) => this.fx.heart(fx, t, 0.12 + 0.2 * u));
      gap = Math.max(0.52, gap * 0.9);
      x += gap;
    }
    if (lamb > t0) this.add(sec, lamb + 0.15, (t, _m, _h, fx) => this.fx.breath(fx, t, 0.075, 0.8, 1.2));
    // the pull into the smash
    this.add(sec, sec.t1 - 1.1, (t, m) => this.fx.suck(m, t + 1.1, 1.1, 0.1, 1.4));
  }

  /** 20 — SMASH to black: a huge hit under the title; a short resonant tail (the opening of David's motif). */
  private planTitle(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0;
    this.add(sec, t0, (t, m, _h, fx) => {
      this.titleAt = t;
      this.hit(m, t, 1.1, true);
      this.fx.impact(fx, t, 0.7, 3);
      this.fx.braam(m, t, lite ? 0.5 : 0.4, 3.2);
      S.pad(m, t, 3.2, [26, 38, 45, 50], { level: 0.2, attack: 0.01, release: 2.6, cutoff: 1800, cutoffEnd: 300, voices: lite ? 2 : 3, detune: 12 });
      S.choir(m, t + 0.01, 2.2, lite ? [38, 50, 57, 65] : [38, 50, 57, 62, 65], { level: 0.2, attack: 0.03, release: 2.4, vowel: 'ah', breath: 0.2 });
      S.drum(m, t + 0.012, 'taiko', 0.7, 0);
    }, 0, undefined, true);
    const tl = sec.shots[0]?.dur || TITLE_LEN;
    const tail = t0 + clamp(tl * 0.4, 1.8, 3);
    this.add(sec, tail, (t, m) => {
      S.lyre(m, t, 50, 0.45, -0.2); S.lyre(m, t + 0.02, 57, 0.4, 0.1);
      S.ney(m, t + 0.6, notes([[74, 0.9], [81, 1.2], [79, 0.5], [78, 2.2]]), 0.1);
      S.choir(m, t + 0.4, 5, [50, 57, 62, 66], { level: 0.03, attack: 1.8, release: 3, vowel: 'oo', breath: 0.05 });
      S.pad(m, t, 6, [26, 38], { level: 0.04, attack: 1, release: 3, cutoff: 350, voices: 2, detune: 4 });
    });
  }

  // ================================================================================ instruments

  /** Kinnor in 6/8 over a chord per bar (D Dorian / major), plucked and spread. */
  private kinnor(sec: Sec, from: number, to: number, prog: readonly ChordName[], vel: number): void {
    const S = this.s;
    for (let k = 0; from + k * STEP68 < to - 0.2; k++) {
      const s6 = k % 6, bar = Math.floor(k / 6);
      if (s6 !== 0 && s6 !== 2 && s6 !== 3 && s6 !== 5) continue;
      const ch = CHORDS[prog[bar % prog.length]];
      const idx = [0, 2, 4, 5, 4, 2][s6];
      this.add(sec, from + k * STEP68, (t, m) => {
        const ns = voicing(ch, 57, 81);
        const n = ns[Math.min(ns.length - 1, idx)];
        if (s6 === 0) S.lyre(m, t, rootIn(ch, 43), 0.3 * vel, -0.3);
        S.lyre(m, t + rand(-0.006, 0.006), n, (s6 === 0 ? 0.5 : 0.36) * vel * rand(0.9, 1.08), lyrePan(n));
      });
    }
  }

  /** Legato line: low strings, men's voices, a lone cello, or a humming voice (rests: midi < 0). */
  private line(o: Out, t: number, ns: ReadonlyArray<readonly [number, number]>, beat: number, level: number, inst: 'str' | 'men' | 'cello' | 'hum'): void {
    let x = 0;
    for (const [m, b] of ns) {
      const d = b * beat;
      const tt = t + x;
      x += d;
      if (m < 0) continue;
      if (inst === 'str' || inst === 'cello') {
        this.s.pad(o, tt, d + 0.35, inst === 'str' ? [m, m - 12] : [m], {
          level, attack: Math.min(0.35, d * 0.35), release: 0.55, cutoff: inst === 'str' ? 1200 : 900, q: 1,
          voices: this.lite ? 2 : 3, detune: inst === 'str' ? 9 : 5, lfoCents: 120,
          vib: d > 0.45 ? (inst === 'cello' ? 16 : 9) : 0, vibRate: inst === 'cello' ? 5 : 5.6, vibDelay: Math.min(0.3, d * 0.3),
        });
      } else {
        this.s.choir(o, tt, d + 0.3, [m], { level, attack: Math.min(0.3, d * 0.4), release: 0.45, vowel: inst === 'men' ? 'oh' : 'oo', breath: inst === 'hum' ? 0.05 : 0.08 });
      }
    }
  }

  /** Output that sounds far away: lowpassed, with the valley echo and extra hall. */
  private far(o: Out, t: number, dur: number, lp: number, echo: number, hall: number): Out {
    const v = new Voice(this.c);
    const inp = v.gain(1), f = v.filter('lowpass', lp, 0.6), eg = v.gain(echo), hg = v.gain(hall);
    inp.connect(f); f.connect(o.dry);
    if (echo > 0) { f.connect(eg); eg.connect(this.c.echoSend()); }
    if (o.wet) { f.connect(hg); hg.connect(o.wet); }
    v.play(t, t + dur);
    return { dry: inp, wet: null };
  }

  /** Arrival hit: sub boom + taiko pair + deep tof (+ an air wash when `big`). */
  private hit(o: Out, t: number, level: number, big: boolean): void {
    const S = this.s;
    S.drum(o, t, 'boom', 0.7 * level, 0);
    S.drum(o, t + 0.004, 'taiko', 0.85 * level, -0.3);
    S.drum(o, t + 0.02, 'taiko', 0.75 * level, 0.3);
    S.drum({ dry: o.dry, wet: null }, t, 'dum', 0.55 * level, 0);
    if (big) {
      const v = new Voice(this.c);
      const n = v.noise('white', t), hp = v.filter('highpass', 5500, 0.7), g = v.gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * level, t + 0.012); g.gain.setTargetAtTime(0, t + 0.012, 0.45);
      n.connect(hp); hp.connect(g); g.connect(o.dry);
      if (o.wet) g.connect(o.wet);
      v.play(t, t + 3);
    }
  }

  /** Wool moving (Samuel turning away). */
  private fabric(o: Out, t: number, d: number, lvl: number): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 1900, 0.7), g = v.gain(0), p = v.pan(0.3);
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 3; i++) {
      const tt = t + (i / 3) * d;
      g.gain.linearRampToValueAtTime(lvl * rand(0.6, 1), tt + d / 3 * 0.4);
      g.gain.linearRampToValueAtTime(lvl * 0.2, tt + d / 3);
    }
    g.gain.linearRampToValueAtTime(0, t + d + 0.05);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) p.connect(o.wet);
    v.play(t, t + d + 0.1);
  }

  private lastOf(cues: readonly FilmCue[]): Sec | undefined {
    let last: Sec | undefined;
    for (const s of this.secs) if (cues.includes(s.cue)) last = s;
    return last;
  }
}

/** Crescendo into an arrival: filtered noise sweep + reversed-cymbal air + (full voicing) a rising cluster. */
export function riserFx(c: Core, S: Synth, o: Out, t: number, dur: number, colour: 'dark' | 'warm', level: number, lite: boolean): void {
  const v = new Voice(c);
  const end = t + dur;
  const n = v.noise('pink', t), bp = v.filter('bandpass', 300, 1.6), g = v.gain(0);
  bp.frequency.setValueAtTime(colour === 'dark' ? 180 : 320, t);
  bp.frequency.exponentialRampToValueAtTime(colour === 'dark' ? 1800 : 4200, end);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.02 * level, t + dur * 0.5);
  g.gain.linearRampToValueAtTime(0.11 * level, end - 0.02);
  g.gain.linearRampToValueAtTime(0, end + 0.04);
  n.connect(bp); bp.connect(g); g.connect(o.dry);
  if (o.wet) g.connect(o.wet);
  if (!lite) {
    const n2 = v.noise('white', t), hp = v.filter('highpass', colour === 'dark' ? 3500 : 6000, 0.7), g2 = v.gain(0);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.004 * level, t + dur * 0.6);
    g2.gain.linearRampToValueAtTime(0.05 * level, end - 0.01);
    g2.gain.linearRampToValueAtTime(0, end + 0.03);
    n2.connect(hp); hp.connect(g2); g2.connect(o.dry);
    const cl = colour === 'dark' ? [38, 39, 45] : [57, 62, 64];
    S.pad(o, t, dur + 0.05, cl, { level: 0.045 * level, attack: dur, release: 0.08, cutoff: 2400, voices: 2, detune: 14 });
  }
  v.play(t, end + 0.1);
}

/** The corner of the robe tears (1 Sam 15:27) — the short one-shot of sfx('robeTear'): a breath-in swell, then the rip. */
export function robeTearFx(c: Core, o: Out, t: number): void {
  const v = new Voice(c);
  const swell = v.noise('pink', t), sb = v.filter('bandpass', 500, 0.9), sg = v.gain(0);
  sb.frequency.setValueAtTime(400, t); sb.frequency.exponentialRampToValueAtTime(1400, t + 0.55);
  sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.05, t + 0.52); sg.gain.linearRampToValueAtTime(0, t + 0.58);
  swell.connect(sb); sb.connect(sg); sg.connect(o.dry);
  if (o.wet) sg.connect(o.wet);
  const r0 = t + 0.55, rl = 0.62;
  const n = v.noise('white', r0), bp = v.filter('bandpass', 900, 1.1), hp = v.filter('highpass', 350, 0.7), g = v.gain(0);
  bp.frequency.setValueAtTime(700, r0); bp.frequency.exponentialRampToValueAtTime(2600, r0 + rl);
  g.gain.setValueAtTime(0, r0);
  let x = 0, i = 0;
  while (x < rl && i < 90) {
    const u = x / rl;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.7 + 0.3 * u);
    g.gain.setValueAtTime(rand(0.25, 1) * env * 0.5, r0 + x);
    x += rand(0.004, 0.011) * (1.2 - 0.6 * u); i++;
  }
  g.gain.setValueAtTime(0, r0 + rl);
  n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(o.dry);
  if (o.wet) { const w = v.gain(1.6); g.connect(w); w.connect(o.wet); }
  const th = v.osc('sine', 110, 0, r0), tg = v.gain(0);
  th.frequency.setValueAtTime(110, r0); th.frequency.exponentialRampToValueAtTime(60, r0 + 0.2);
  tg.gain.setValueAtTime(0, r0); tg.gain.linearRampToValueAtTime(0.12, r0 + 0.01); tg.gain.setTargetAtTime(0, r0 + 0.01, 0.07);
  th.connect(tg); tg.connect(o.dry);
  v.play(t, r0 + rl + 0.6);
}

// ------------------------------------------------------------------------------------ helpers

function notes(ns: ReadonlyArray<readonly [number, number]>): NeyNote[] {
  return ns.map(([midi, dur]) => ({ midi, dur: dur * rand(0.97, 1.03) }));
}
function motif(tonic: number, m: ReadonlyArray<readonly [number, number]>, unit: number): NeyNote[] {
  return m.map(([o, u]) => ({ midi: tonic + o, dur: u * unit }));
}

/**
 * Sections from a cue sheet: consecutive SHOT cues with the same `cue` merge (text cues are ignored — they carry
 * no `cue`); the exit of each section comes from the transition of the next one's first shot.
 */
function buildSections(cues: readonly IntroCue[]): Sec[] {
  const shots = [...(cues ?? [])]
    .filter((c) => c && c.shot && typeof c.cue === 'string' && KNOWN.has(c.cue) && Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t);
  const out: Sec[] = [];
  for (const c of shots) {
    const sh: Shot = { t: c.t, id: String(c.shot), dur: Number.isFinite(c.dur) ? (c.dur as number) : 0, cut: c.cut ?? '', fade: c.fade ?? 0 };
    const last = out[out.length - 1];
    if (last && last.cue === c.cue) { last.shots.push(sh); continue; }
    if (last) last.t1 = c.t;
    out.push({
      i: out.length, cue: c.cue as FilmCue, t0: c.t, t1: Infinity, shots: [sh], cut: sh.cut, fade: sh.fade,
      exit: 'ring', tau: 0.5, next: null, texts: [],
    });
  }
  if (!out.length) return out;
  out[0].t0 = Math.min(out[0].t0, 0);
  const last = out[out.length - 1];
  const lsh = last.shots[last.shots.length - 1];
  const lend = lsh.t + (lsh.dur > 0 ? lsh.dur : last.cue === 'title' ? TITLE_LEN : 8);
  last.t1 = lend + (last.cue === 'title' ? 6 : 0);
  for (const c of cues ?? []) {
    if (!c || c.shot || !Number.isFinite(c.t) || !(c.verse || c.narration)) continue;
    const sec = out.find((x) => c.t >= x.t0 && c.t < x.t1);
    if (sec) sec.texts.push(c.t);
  }
  for (const sec of out) sec.texts.sort((a, b) => a - b);
  for (let i = 0; i < out.length - 1; i++) {
    const sec = out[i], nx = out[i + 1];
    sec.next = nx.cue;
    if (nx.cut === 'hard' || nx.cut === 'smash' || nx.cue === 'silence') { sec.exit = 'cut'; sec.tau = 0.01; }
    else if (nx.cut === 'dissolve' || nx.cut === 'light' || nx.cut === 'match' || nx.cut === 'black') { sec.exit = 'x'; sec.tau = Math.max(0.15, (nx.fade || 1.2) / 3); }
    else { sec.exit = 'x'; sec.tau = 0.22; }
  }
  return out;
}
