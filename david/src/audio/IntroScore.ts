/**
 * DAVID — score and sound design of the opening film "הַטּוֹב מִמֶּךָּ", CUT v2 (58 s: film 53 s + title 5 s,
 * docs/intro-script-v2.md), synchronised to the film's shot sheet (src/content/introScript.ts).
 *
 * KEYING. The sheet is read when the score starts. Every shot cue gets a musical ROLE (from its `cue`, else from its
 * set); consecutive shots with the same role form one section [t0, t1) with its own bus. Every event is placed
 * relative to a shot start, an on-screen text, or a named BEAT inside a shot — the beats of the timing contract (the
 * elder rises, the horns, the halt, the spear, THE ROAR, the ranks parting, Samuel's step, the turn, the lunge, the
 * grip, the pull, the rip, the corner coming free, Samuel's words, the fingers tightening, David's head turning, the
 * birds stopping, the eyes). A beat is read from the shot's own `beats` in the sheet when it carries them (shot
 * seconds), otherwise from the contract (SYNC below), and is clamped to its shot. Nothing is keyed on absolute film
 * seconds: a retimed sheet stays in sync. How a section is left comes from the NEXT shot's transition: a hard cut
 * (the shofar) and the smash (the title) cut the bus to silence a breath (GAP) before the frame, the roar is cut ON
 * the frame of the silence, dissolves crossfade over their length. Events are built just ahead of the audio clock
 * (≤ 0.5 s; the hits of the hard cuts only ≤ 60 ms ahead, so a picture stall before a cut cannot make them early),
 * and the film's clock (syncIntro) re-anchors the score after hitches.
 *
 * THE ARC (D minor / Phrygian for the kings, D Dorian → D major for David; 120 bpm — every cut of the contract falls
 * on its half-second grid):
 *   PROLOGUE  one swell, 0 → 17 s. Out of black a deep bloom and a D pedal; the race over the cloud sea (air rushing
 *             past the lens, high string harmonics, rising voices); through the deck and OUT over the ridges: the chord
 *             opens (Dsus2 → B♭/D → C/D, the top line climbing A B♭ C → D) and a pulse of low strings and tof begins.
 *             Rachel's stone: the shepherd's pipe lament over Dm, the flock crossing, the pulse growing. The Philistine
 *             host: war drums, the Phrygian ostinato (D–E♭), bronze, a dark choir. Ramah: the drums fall away into a
 *             solemn chord of men's voices — Dm, the DEMAND (B♭) on the words of 8:5, Gm, and the A with its B♭ as
 *             Samuel turns his face away (8:6) — then a reverse swell and a breath of silence.
 *   ACT I     HARD CUT on the shofar (the blast, then the front rank's horns), the army out of the dust over massive
 *             drums and low men's voices; SAUL in slow motion — his theme D A B♭-A G F E in low strings and men's
 *             voices over half-time drums, the world muffled; the E is held through the halt and the raised spear
 *             (a drum roll, a riser) and resolves to D at full power ON THE ROAR (thousands shouting, the shofar's
 *             teruah); Dm – B♭ – A, cut in mid-phrase by SILENCE: wind, the far bleating and lowing of the spoil
 *             (15:14), the ranks shuffling apart, a ground tone under Samuel's name, one high A; THE TEAR: the turn,
 *             the lunge (bronze scales), the grip, the world in slow motion, the slowed wool rip under a semitone of
 *             grief (A–B♭) that breaks with the cloth; the VERDICT in near-silence (a ground tone, a thread, one deep
 *             stroke on its last word); SAUL ALONE: his motif on a lone cello, falling below the tonic.
 *   DAVID     a warm light-flash (a rising shimmer into a D-major bloom); the kinnor in 6/8, David's motif on the
 *             shepherd's pipe, soft voices; he turns into the light: the voices open, the kinnor answers 16:7.
 *   THE HOOK  the birds stop on the beat; a low rumble and a thin high tone; the heart; leaves, a heavy breath; the
 *             eyes (a low sting); the heart quickens; a reverse swell — SMASH on the loudest hit of the film under the
 *             title; DAVID forms from light; the title motif (the rising fifth D–A, then David's motif resolving in D
 *             major) on the kinnor and the pipe; the tail rings into gameplay.
 * Period instruments: shofar (1 Sam 13:3), tof, chalil, kinnor, nevel (10:5). The lyre is kept out of Saul's music
 * (it enters his house only after 16:23); drums are the score's, never on screen in Israel's army
 * (docs/visual-bible.md §6); no horses anywhere in the sound (Israel fought on foot).
 */
import type { IntroCue } from '../content/introScript';
import type { BedName } from './Beds';
import {
  Core, Synth, Voice, clamp, rand, randi, chance, pick, CHORDS, voicing, rootIn, lyrePan,
  type Out, type ChordName, type NeyNote,
} from './synth';
import { FilmSound } from './FilmSound';

/** The musical role of a shot (several consecutive shots of one role share a section and its bus). */
export type ScoreRole =
  | 'flight' | 'rachel' | 'threat' | 'elders'
  | 'shofar' | 'saul' | 'peak' | 'silence' | 'tear' | 'verdict' | 'broken'
  | 'david' | 'thicket' | 'title';

/** Role of a shot from its score cue (FilmCue of the sheet — old and new names). */
const ROLE_OF_CUE: Readonly<Record<string, ScoreRole>> = {
  dark: 'flight', land: 'flight', flight: 'flight', clouds: 'flight', prologue: 'flight',
  rachel: 'rachel',
  threat: 'threat', coast: 'threat', host: 'threat', philistines: 'threat',
  elders: 'elders', ramah: 'elders', demand: 'elders',
  shofar: 'shofar', army: 'shofar', dust: 'shofar',
  saul: 'saul', king: 'saul', stride: 'saul',
  peak: 'peak', spear: 'peak', roar: 'peak',
  silence: 'silence', samuel: 'silence',
  faceoff: 'tear', tear: 'tear', rip: 'tear',
  verdict: 'verdict',
  broken: 'broken', alone: 'broken', saulAlone: 'broken',
  rise: 'david', flash: 'david', bethlehem: 'david', figure: 'david', david: 'david', face: 'david', contrast: 'david',
  peace: 'thicket', thicket: 'thicket', hook: 'thicket', lamb: 'thicket', eyes: 'thicket',
  title: 'title',
};
/** ... or from its set when the cue is unknown. */
const ROLE_OF_SET: Readonly<Record<string, ScoreRole>> = {
  judah: 'flight', coast: 'threat', ramah: 'elders', gilgal: 'shofar', world: 'david', black: 'title',
};

/**
 * Beats inside the shots of each role: [index of the shot inside the role's section, shot seconds] — the timing
 * contract of docs/intro-script-v2.md. A beat the sheet carries itself (a shot cue's `beats`, shot seconds, same
 * name, case-insensitive) wins. Every beat is clamped to its shot.
 */
const SYNC: Readonly<Record<ScoreRole, Readonly<Record<string, readonly [number, number]>>>> = {
  flight: { card: [0, 0.3], dive: [0, 3.1], deck: [0, 3.6], out: [0, 4.5] },
  rachel: { card: [0, 0.4] },
  threat: {},
  elders: { rise: [0, 0.5], verse: [0, 1.0], turn: [0, 2.6] },
  shofar: { horns: [0, 0.4], card: [0, 0.6] },
  saul: { card: [0, 0.8] },
  peak: { halt: [0, 0.3], spear: [0, 0.8], roar: [0, 1.1], spread: [0, 0.4], verse: [0, 1.3] },
  silence: { heads: [0, 0.3], part: [0, 0.8], card: [0, 1.4], step: [0, 2.2] },
  tear: { turn: [0, 0.2], lunge: [0, 0.9], grip: [0, 1.6], pull: [1, 0.2], rip: [1, 0.6], free: [1, 1.8] },
  verdict: { turn: [0, 0.4], words: [0, 0.9], wordsEnd: [0, 4.04] },
  broken: { look: [0, 0.3], tighten: [0, 1.2], flash: [0, 1.75] },
  david: { verse: [0, 0.3], turn: [1, 0.5], heart: [1, 1.2] },
  thicket: { birds: [0, 0.4], lamb: [0, 1.5], eyes: [1, 0.7] },
  title: { forms: [0, 0.3], name: [0, 1.6], chapter: [0, 2.4] },
};
/** Other names a sheet may give a beat (normalised: lower case, letters only). */
const ALIAS: Readonly<Record<string, readonly string[]>> = {
  card: ['placecard', 'personcard', 'timecard', 'name'],
  deck: ['through', 'throughdeck', 'clouds'],
  dive: ['deckin', 'divein'],
  out: ['ridges', 'burst', 'emerge'],
  rise: ['elderrises', 'rises', 'stand', 'demand'],
  verse: ['text', 'words', 'versestart'],
  turn: ['turnaway', 'samuelturns', 'turnback', 'headturn'],
  horns: ['hornslifted', 'blow', 'shofarot'],
  halt: ['stop'],
  spear: ['spearup', 'raise', 'lift', 'spearraised'],
  roar: ['theroar', 'cheer'],
  spread: ['roarspread', 'stagger'],
  heads: ['headsturn'],
  part: ['ranksp', 'rankspart', 'parting'],
  step: ['hisstep', 'samuelstep'],
  lunge: ['saulslunge', 'lunges'],
  grip: ['grab', 'grasp', 'seize'],
  pull: ['tug'],
  rip: ['ripruns', 'tearruns', 'tear'],
  free: ['cornerfree', 'comesfree', 'release', 'torn'],
  words: ['speech', 'speak', 'verse'],
  wordsEnd: ['speechend', 'wordsend'],
  look: ['looksdown', 'lookdown'],
  tighten: ['fingers', 'fingerstighten', 'fist'],
  flash: ['whip', 'light'],
  heart: ['verse'],
  birds: ['birdsstop', 'silence', 'hush'],
  lamb: ['lambhead', 'lamblifts', 'lifts', 'head'],
  eyes: ['eyesopen', 'open'],
  forms: ['david', 'titleforms'],
  name: ['hebrew', 'davidhe', 'hebrewname'],
  chapter: ['chapterline', 'subtitle'],
};
/** Contract lengths of the shots of the multi-shot roles (when a sheet merges them into one shot). */
const SPLIT: Partial<Record<ScoreRole, readonly number[]>> = { tear: [2.0, 2.5], david: [4.0, 3.5], thicket: [2.5, 1.5] };

/** Ambience bed per role (the score switches beds until the game calls ambience(name) itself). */
const ROLE_BED: Readonly<Record<ScoreRole, BedName>> = {
  flight: 'heights', rachel: 'dawn', threat: 'coast', elders: 'gibeah-exterior',
  shofar: 'gilgal', saul: 'gilgal', peak: 'gilgal', silence: 'gilgal', tear: 'gilgal', verdict: 'gilgal', broken: 'gilgal',
  david: 'fields', thicket: 'fields', title: 'none',
};

/** How long the title rings when the sheet gives no length (s). */
const TITLE_LEN = 5;
/** 120 bpm: every cut of the contract falls on this half-second grid. */
const BEAT = 0.5;
/** The pastoral 6/8 (s per eighth: a dotted quarter = 1 s). */
const STEP68 = 1 / 3;
/** The breath of silence before a hit on a hard cut or the smash (s). */
const GAP = 0.07;

// Saul's theme (D A B♭-A G F E … D) as [midi, beats]; the final D waits for the roar
const SAUL_HEAD: ReadonlyArray<readonly [number, number]> = [[50, 2], [57, 2], [58, 1.5], [57, 0.5], [55, 1], [53, 1]];
// David's motif (D A G F E F D) as [offset from tonic, units] — Dorian, and its major form (the title)
const DAVID: ReadonlyArray<readonly [number, number]> = [[0, 2], [7, 2], [5, 1], [3, 1], [2, 1], [3, 1], [0, 3]];
// the kinnor's answer (A B C♯ D C♯ A G A) — 16:7
const ANSWER: ReadonlyArray<readonly [number, number]> = [[-5, 1], [-3, 1], [-1, 1], [0, 2], [-1, 1], [-5, 1], [-7, 1], [-5, 3]];

type Exit = 'cut' | 'x' | 'ring';
interface Shot { t: number; id: string; dur: number; cut: string; fade: number; beats: Readonly<Record<string, number>> | null }
interface Sec {
  i: number; role: ScoreRole; t0: number; t1: number; shots: Shot[];
  /** how this section comes in (its first shot's transition) */
  cut: string; fade: number;
  /** how its bus leaves at t1 (a 'cut' leaves `gap` s early) */
  exit: Exit; tau: number; gap: number;
  next: ScoreRole | null;
  /** film times of the on-screen texts inside the section (verses, cards) — accents key on them */
  texts: number[];
  /** speech-synced verses: film times of their words (the verdict) */
  words: number[];
  /** slow-motion factor of the section's first slowed shot (1 = none) */
  slowmo: number;
}
export interface IntroSection { readonly role: ScoreRole; readonly t0: number; readonly t1: number }

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
  /** Film times of the named beats the score keys on, per section (tools: the sync table). */
  beatTable(): Array<{ role: ScoreRole; beat: string; t: number; from: 'sheet' | 'contract' }> {
    const out: Array<{ role: ScoreRole; beat: string; t: number; from: 'sheet' | 'contract' }> = [];
    for (const sec of this.secs) {
      for (const name of Object.keys(SYNC[sec.role])) out.push({ role: sec.role, beat: name, t: round3(this.beat(sec, name)), from: this.sheetBeat(sec, name) === null ? 'contract' : 'sheet' });
    }
    return out;
  }
  setLite(on: boolean): void { this.lite = on; this.fx.setLite(on); }

  // ---------------------------------------------------------------------------------- control

  start(cues: readonly IntroCue[], startAt: number, now: number, level = 0.92): void {
    if (this.running) this.stop(now, 0.3);
    this.secs = buildSections(cues);
    if (!this.secs.length) return;
    const t0 = clamp(Number.isFinite(startAt) ? startAt : 0, 0, this.secs[this.secs.length - 1].t1 - 0.5);
    // the torn wool is baked to the beats of the tear (the pull, the rip running, the corner coming free)
    const tear = this.secs.find((x) => x.role === 'tear');
    if (tear) {
      const p = this.beat(tear, 'pull'), r = this.beat(tear, 'rip'), f = this.beat(tear, 'free');
      this.fx.shapeRip(r - p, f - p);
    }
    this.evs = [];
    for (const sec of this.secs) this.plan(sec);
    this.evs.sort((a, b) => a.at - b.at);
    if (t0 > 0.05) this.trimBefore(t0);
    this.ei = 0;
    this.anchor = now + 0.03 - t0; // a 30 ms pre-roll: events due "now" still start on time
    this.endT = this.secs[this.secs.length - 1].t1;
    const tsec = this.secs.find((x) => x.role === 'title');
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
    // the film's baked buffers: one per tick from 0.6 s of film time (under the time card), never on the first
    // frame; a film started mid-way bakes lazily when a generator first needs its buffer
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

  /** Section bus envelope: hold, then cut (a breath early before a hit) / crossfade at the section end. */
  private envelope(b: Bus, now: number): void {
    const sec = this.secs[b.sec];
    if (!sec) return;
    const t1 = Math.max(now + 0.05, this.anchor + sec.t1 - (sec.exit === 'cut' ? sec.gap : 0));
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
      for (const p of [c.slowFilter.frequency, c.slowVerb.gain, c.hallRet.gain, c.ambIn.gain]) { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); }
      c.slowFilter.frequency.setTargetAtTime(c.hz(18000), now, tau / 3);
      c.slowVerb.gain.setTargetAtTime(0, now, tau / 3);
      c.hallRet.gain.setTargetAtTime(c.hallLevel, now, tau / 3);
      c.ambIn.gain.setTargetAtTime(1, now, tau / 3);
    } catch { /* ignore */ }
  }

  /** Duck the ambience at once to `level` (the roar that cuts to silence), hold, then let it creep back over `back` s. */
  private duckAmbience(t: number, level: number, hold: number, back: number): void {
    const p = this.c.ambIn.gain;
    p.cancelScheduledValues(t - 0.01);
    p.setValueAtTime(1, t - 0.005);
    p.linearRampToValueAtTime(level, t + 0.015);
    p.setValueAtTime(level, t + hold);
    p.linearRampToValueAtTime(1, t + hold + back);
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
  private role(r: ScoreRole): Sec | undefined { return this.secs.find((x) => x.role === r); }
  /** A beat the sheet itself carries for this section (shot seconds → film time), or null. */
  private sheetBeat(sec: Sec, name: string): number | null {
    const keys = [norm(name), ...(ALIAS[name] ?? [])];
    const spec = SYNC[sec.role][name];
    // the contract's shot first (a name like 'turn' exists in several shots), then any shot of the section
    const order = spec && sec.shots[spec[0]] ? [sec.shots[spec[0]], ...sec.shots.filter((_, k) => k !== spec[0])] : sec.shots;
    for (const k of keys) {
      for (const sh of order) {
        const v = sh.beats?.[k];
        if (v !== undefined) return sh.t + clamp(v, 0, Math.max(0, sh.dur - 0.02));
      }
    }
    return null;
  }
  /** Film time of the named beat of a section (the sheet's own, else the contract's), clamped to its shot. */
  private beat(sec: Sec, name: string): number {
    const own = this.sheetBeat(sec, name);
    if (own !== null) return own;
    const spec = SYNC[sec.role][name];
    if (!spec) return sec.t0;
    const [k, s] = spec;
    const sh = sec.shots[k];
    if (sh) return sh.t + clamp(s, 0, Math.max(0, sh.dur - 0.05));
    // the sheet merged the role's shots into fewer: offset by the contract lengths of the shots before
    const split = SPLIT[sec.role] ?? [];
    let off = 0;
    for (let i = 0; i < k; i++) off += split[i] ?? 0;
    return clamp(sec.t0 + off + s, sec.t0, sec.t1 - 0.05);
  }
  /** Film time of the section's k-th on-screen text (verse / card), or `fallback` (film time). */
  private text(sec: Sec, k: number, fallback: number): number {
    const x = sec.texts[k];
    return x !== undefined ? x : fallback;
  }
  /** Start of the k-th shot of a section (or `fallback` s after the section start). */
  private shotStart(sec: Sec, k: number, fallback: number): number {
    const sh = sec.shots[k];
    return sh ? sh.t : Math.min(sec.t1, sec.t0 + fallback);
  }
  /** A sub-bass tone that stays audible on phone speakers: lite voicing moves it up an octave with harmonics. */
  private ground(m: Out, t: number, h: number, level: number, attack: number, release: number): void {
    if (this.lite) this.s.pad(m, t, h, [38], { level: level * 0.9, attack, release, cutoff: 320, voices: 2, detune: 3 });
    else this.s.pad(m, t, h, [26], { level, attack, release, cutoff: 150, voices: 2, detune: 3, type: 'triangle' });
  }

  private plan(sec: Sec): void {
    const prev = this.secs[sec.i - 1];
    const bed = ROLE_BED[sec.role];
    if (!prev || ROLE_BED[prev.role] !== bed) {
      const fade = sec.i === 0 ? 0.8 : sec.role === 'title' ? 0.05 : sec.cut === 'hard' || sec.cut === 'cut' ? 0.25 : Math.max(0.5, sec.fade || 1.2);
      // held over the whole run of sections sharing the bed (so starting mid-run still sets it)
      let j = sec.i;
      while (j + 1 < this.secs.length && ROLE_BED[this.secs[j + 1].role] === bed) j++;
      this.add(sec, sec.t0, (t) => { if (this.onAmbience) this.onAmbience(bed, fade, t); }, this.secs[j].t1 - sec.t0);
    }
    switch (sec.role) {
      case 'flight': this.planFlight(sec); break;
      case 'rachel': this.planRachel(sec); break;
      case 'threat': this.planThreat(sec); break;
      case 'elders': this.planElders(sec); break;
      case 'shofar': this.planShofar(sec); break;
      case 'saul': this.planSaul(sec); break;
      case 'peak': this.planPeak(sec); break;
      case 'silence': this.planSilence(sec); break;
      case 'tear': this.planTear(sec); break;
      case 'verdict': this.planVerdict(sec); break;
      case 'broken': this.planBroken(sec); break;
      case 'david': this.planDavid(sec); break;
      case 'thicket': this.planThicket(sec); break;
      case 'title': this.planTitle(sec); break;
    }
  }

  // ================================================================================ PROLOGUE

  /** P1+P2 — out of black, the race over the cloud sea, through the deck and out over the Judean ridges. */
  private planFlight(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const card = this.beat(sec, 'card'), deck = Math.max(card + 1, this.beat(sec, 'deck'));
    const out = clamp(sec.shots[1] ? sec.shots[1].t : this.beat(sec, 'out'), deck + 0.2, end - 0.5);
    const pro = this.lastOf(['flight', 'rachel', 'threat', 'elders']) ?? sec;
    // the prologue's D pedal: from black to the shofar cut (on the bus of the prologue's last section, cut with it)
    this.add(sec, t0 + 0.05, (t, m, h) => S.pad(m, t, h, lite ? [38, 50] : [26, 38], {
      level: 0.055, attack: 2.6, release: 0.5, cutoff: 190, cutoffEnd: 420, voices: lite ? 2 : 3, detune: 5, lfoCents: 160,
    }), pro.t1 - t0 - 0.05, pro);
    // out of black: one deep bloom and a low hum under the time card
    this.add(sec, card, (t, m) => {
      S.drum(m, t, 'boom', 0.3, 0, 0.92);
      S.choir(m, t + 0.05, deck - card + 0.6, [38, 45], { level: 0.028, attack: 1.2, release: 1, vowel: 'oo', breath: 0.05 });
    });
    // the race: air rushing past the lens, louder and brighter to the deck, grey inside it, wide open beyond
    this.add(sec, t0 + 0.15, (t, _m, _h, fx) => this.rush(fx, t, deck - (t0 + 0.15), out - (t0 + 0.15), end + 0.8 - (t0 + 0.15)));
    // high string harmonics (tremolo) and rising voices; low strings from the middle of the race
    this.add(sec, card + 0.4, (t, m, h) => S.pad(m, t, h, [74, 81], {
      level: 0.013, attack: h * 0.85, release: 0.3, cutoff: 3200, voices: 2, detune: 6, lfoCents: 50, trem: 0.35, tremRate: 7.5,
    }), out - card - 0.25);
    this.add(sec, card + 0.8, (t, m, h) => S.choir(m, t, h, lite ? [50, 57, 62] : [50, 57, 62, 69], {
      level: 0.03, attack: h * 0.8, release: 0.3, vowel: 'oo', breath: 0.06,
    }), out - card - 0.7);
    this.add(sec, card + 1.6, (t, m, h) => S.pad(m, t, h, [38, 45, 50], {
      level: 0.032, attack: h * 0.85, release: 0.25, cutoff: 480, cutoffEnd: 950, voices: lite ? 2 : 3, detune: 8,
    }), out - card - 1.5);
    // through the deck: from the dive, a swell sucked into the cloud
    const dive = clamp(this.beat(sec, 'dive'), card + 0.5, deck - 0.2);
    this.add(sec, dive, (t, m) => this.fx.suck(m, t + (deck - dive), deck - dive, 0.035, 1.3));
    // OUT over the ridges: the chord opens, the top line climbs A → B♭ → C (→ D at Rachel's stone)
    const rest = end - out;
    const chords: ReadonlyArray<readonly [number, readonly number[]]> = [
      [0, [50, 57, 62, 64, 69]], // Dsus2 (add9)
      [0.5, [50, 58, 62, 65, 70]], // B♭/D
      [0.83, [50, 60, 64, 67, 72]], // C/D
    ];
    chords.forEach(([f, ns], i) => {
      const at = out + f * rest;
      const len = (i + 1 < chords.length ? out + chords[i + 1][0] * rest : end) - at;
      const first = i === 0;
      this.add(sec, at, (t, m) => {
        S.choir(m, t, len + 0.5, lite ? ns.slice(1, 4) : ns, { level: first ? 0.05 : 0.042, attack: first ? 0.35 : 0.3, release: 0.5, vowel: first ? 'ah' : 'oh', breath: 0.07 });
        S.pad(m, t, len + 0.45, [ns[0] - 12, ...ns.slice(0, lite ? 2 : 4)], { level: first ? 0.05 : 0.04, attack: first ? 0.25 : 0.3, release: 0.45, cutoff: first ? 1600 : 1300, voices: lite ? 2 : 3, detune: 8 });
      });
    });
    this.add(sec, out, (t, m) => {
      S.drum(m, t, 'boom', 0.34, 0, 0.95);
      S.drum(m, t + 0.008, 'taiko', 0.26, 0, 0.9);
      S.pad(m, t, 2.2, [86, 93], { level: 0.012, attack: 0.08, release: 1.8, cutoff: 6000, voices: 2, detune: 9, trem: 0.3, tremRate: 9 });
    });
    // the pulse begins: low strings on every beat, the tof on one and three — the prologue's heartbeat
    this.pulse(sec, out + 1, end, 0.22, 0.36, 0.05, 0.1);
  }

  /** P3 — Rachel's standing stone at first light: the shepherd's pipe lament over Dm; the flock crosses behind it. */
  private planRachel(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const card = this.beat(sec, 'card');
    this.add(sec, t0, (t, m, h) => {
      S.choir(m, t, h, lite ? [50, 57, 65] : [50, 57, 62, 65, 74], { level: 0.03, attack: 0.4, release: 0.7, vowel: 'oo', breath: 0.06 });
      S.pad(m, t, h, [38, 45, 50, 57], { level: 0.03, attack: 0.35, release: 0.7, cutoff: 800, voices: lite ? 2 : 3, detune: 7 });
    }, d + 0.3);
    // the shepherd's pipe (chalil): A B♭ A G F E D — the lament, a little far, echoing in the valley
    const u = clamp((d - 0.35) / 2.9, 0.6, 1.2);
    this.add(sec, t0 + 0.1, (t, m) => S.ney(this.far(m, t, d + 1.5, 3600, 0.4, 0.5), t, notes([[69, 0.5 * u], [70, 0.32 * u], [69, 0.2 * u], [67, 0.3 * u], [65, 0.3 * u], [64, 0.28 * u], [62, 1.0 * u]]), 0.14));
    // the place card: a soft low stroke
    this.add(sec, card, (t, m) => S.drum(m, t, 'boom', 0.12, 0, 1));
    // the flock crossing behind the stone
    this.add(sec, t0 + d * 0.25, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.2, 0.35));
    this.add(sec, t0 + d * 0.62, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.12, 0.55, 'lambBleat', 1.05));
    // the pulse grows into the host; the last beat rolls into the war drums
    this.pulse(sec, t0, end, 0.3, 0.5, 0.1, 0.2);
    for (let x = end - BEAT; x < end - 0.02; x += BEAT / 4) {
      const k = (x - (end - BEAT)) / BEAT;
      this.add(sec, x, (t, m) => S.drum({ dry: m.dry, wet: null }, t, 'ka', 0.05 + 0.12 * k, rand(-0.3, 0.3)));
    }
  }

  /** P4 — the Philistine host on the coastal plain: war drums (120 bpm), the Phrygian ostinato, bronze, dust. */
  private planThreat(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, d = sec.t1 - t0;
    const st = BEAT / 4;
    const pat = 'B.tkD.tkB.tkDtkk';
    const OST = [0, 0, 1, 0, 0, 0, 1, 3];
    const n = Math.floor((sec.t1 + (sec.exit === 'x' ? 0.3 : 0) - t0) / st);
    for (let k = 0; k < n; k++) {
      const tt = t0 + k * st, s16 = k % 16, kk = k;
      const u = clamp((tt - t0) / d, 0, 1);
      const ch = pat[s16];
      this.add(sec, tt, (t, m, _h, fx) => {
        const dry: Out = { dry: m.dry, wet: null };
        const g = 0.9 + 0.35 * u;
        switch (ch) {
          case 'B': S.drum(m, t, 'taiko', 0.5 * g, 0); S.drum(dry, t, 'dum', 0.4 * g, -0.1); break;
          case 'D': S.drum(dry, t, 'dum', 0.38 * g, 0.1); break;
          case 't': S.drum(dry, t, 'tek', (lite ? 0.24 : 0.17) * g, 0.2); break;
          case 'k': if (!lite || chance(0.6)) S.drum(dry, t, 'ka', rand(0.1, 0.17) * g * (lite ? 1.3 : 1), -0.25); break;
        }
        if (kk % 2 === 0) S.strStac(dry, t, 38 + OST[(kk / 2) % 8], (kk / 2) % 4 === 0 ? 0.62 : 0.44, 0.16, 0.7);
        if (s16 === 0) this.fx.bronze(fx, t + 0.005, (0.03 + 0.02 * u) * (lite ? 1.5 : 1), rand(-0.5, 0.5));
        if (s16 === 0 || s16 === 8) S.choir(m, t, BEAT * 2 + 0.2, lite ? [50, 51] : [38, 50, 51, 57], { level: 0.045 + 0.03 * u, attack: 0.25, release: 0.4, vowel: 'ah', breath: 0.12 });
      });
    }
    // the hit on the cut and a low brass-like drone of menace
    this.add(sec, t0, (t, m) => this.hit(m, t, 0.5, false), 0, undefined, true);
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h, [26, 38, 39], { level: 0.05, attack: 0.4, release: 0.4, cutoff: 500, cutoffEnd: 950, voices: lite ? 2 : 3, detune: 12 }), d + 0.3);
    // the column: tread, dust, the glint of bronze in the heat haze, the sea beyond
    this.add(sec, t0, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.13, 0.95, 1700, 0.3);
      this.fx.surf(fx, t, h, 0.01);
    }, d + 0.4);
    this.add(sec, t0 + 0.4, (t, _m, _h, fx) => this.fx.dustGust(fx, t, Math.max(1.2, d - 0.2), 0.05));
    this.add(sec, t0 + d * 0.35, (t, m, _h, fx) => {
      this.fx.clinks(fx, t, 0.018, 3);
      S.pad(m, t, 1.6, [81, 82], { level: 0.011, attack: 0.25, release: 1, cutoff: 5000, voices: 2, detune: 5, trem: 0.4, tremRate: 9 });
    });
  }

  /** P5 — Ramah: the elders before Samuel (8:5–6): a solemn chord of men's voices; the reverse swell into the cut. */
  private planElders(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const rise = this.beat(sec, 'rise');
    const verse = clamp(this.text(sec, 0, this.beat(sec, 'verse')), rise + 0.2, end - 1.5);
    const turn = clamp(this.beat(sec, 'turn'), verse + 0.6, end - 0.6);
    const hasCut = sec.exit === 'cut';
    const swell = hasCut ? Math.min(1.0, end - turn - 0.1) : 0;
    // Dm (the gathering), the DEMAND (B♭) on the words of 8:5, Gm, and the A with its B♭ as Samuel turns away (8:6)
    const gm = (verse + turn) / 2 + 0.1;
    const plan: ReadonlyArray<readonly [ChordName, number, number]> = [['Dm', t0, verse], ['Bb', verse, gm], ['Gm', gm, turn], ['A', turn, end]];
    plan.forEach(([cn, a, b], i) => {
      const ch = CHORDS[cn];
      const demand = i === 1, last = i === 3;
      const len = b - a;
      this.add(sec, a, (t, m) => {
        const ns = voicing(ch, 43, demand ? 67 : 62).slice(0, lite ? 3 : demand ? 6 : 5);
        S.choir(m, t, len + 0.45, ns, { level: demand || last ? 0.068 : 0.052, attack: i === 0 ? 0.5 : 0.22, release: 0.45, vowel: demand ? 'ah' : 'oh', breath: 0.07 });
        S.pad(m, t, len + 0.4, lite ? [rootIn(ch, 38), rootIn(ch, 50)] : [rootIn(ch, 26), rootIn(ch, 38)], { level: 0.05, attack: 0.3, release: 0.4, cutoff: 600, voices: lite ? 2 : 3, detune: 7 });
        if (last) S.choir(m, t + 0.05, len + 0.3, [70], { level: 0.03, attack: 0.3, release: 0.3, vowel: 'oo', breath: 0.05 }); // the B♭ over A: 8:6
        if (i > 0) S.drum(m, t, demand ? 'taiko' : 'dum', demand ? 0.32 : 0.2, 0, 0.85);
      });
    });
    // one elder rises: a drum, and the murmur of the elders in the gate
    this.add(sec, rise, (t, m) => S.drum(m, t, 'taiko', 0.18, -0.2, 0.95));
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(fx, t, h, 0.28, lite ? 2 : 3), Math.max(1, turn - t0));
    // the reverse swell into the hard cut: a riser, a rising roll, a suck — then a breath of silence (GAP)
    if (hasCut && swell > 0.3) {
      const t1 = end - sec.gap;
      this.add(sec, t1 - swell, (t, m) => {
        this.fx.suck(m, t + swell, swell, 0.13, 1.2);
        riserFx(this.c, S, m, t, swell, 'dark', 0.95, lite);
      });
      for (let x = t1 - swell; x < t1 - 0.03; x += BEAT / 4) {
        const k = (x - (t1 - swell)) / swell;
        this.add(sec, x, (t, m) => S.drum({ dry: m.dry, wet: null }, t, k > 0.5 ? 'tek' : 'ka', 0.05 + 0.2 * k * k, rand(-0.3, 0.3)));
      }
    }
  }

  // ================================================================================ ACT I

  /** G1 — HARD CUT on the shofar: the army comes out of the dust wall; massive drums, low men's voices. */
  private planShofar(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const horns = this.beat(sec, 'horns'), card = this.text(sec, 0, this.beat(sec, 'card'));
    // the blast on the cut (tight: built just before it is due)
    this.add(sec, t0, (t, m, _h, fx) => {
      S.shofar(m, t, 'gedolah', 0.5, 220, 293.66);
      this.hit(m, t, 0.85, true);
      this.fx.impact(fx, t, 0.5, 2.2);
    }, 0, undefined, true);
    // the front rank lifts its horns: two more rams' horns, raw and untuned against the first
    this.add(sec, horns, (t, m) => {
      S.shofar(this.panned(m, t, 3, -0.45), t, 'tekiah', 0.3, 211, 283);
      S.shofar(this.panned(m, t, 3, 0.5), t + 0.12, 'tekiah', 0.26, 229, 305);
    });
    // the army: thousands on foot, the murmur of the ranks, bronze, spear shafts on shields, dust
    this.add(sec, t0, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.45, 1, 6500, 0.35);
      this.fx.murmur(fx, t + 0.3, h - 0.3, 0.4);
    }, d + 0.35);
    this.add(sec, t0 + 0.25, (t, _m, _h, fx) => this.fx.dustGust(fx, t, Math.min(3.2, d), 0.09));
    for (let x = t0 + 0.7; x < end - 0.2; x += rand(0.3, 0.7)) {
      this.add(sec, x, (t, _m, _h, fx) => {
        this.fx.clinks(fx, t, rand(0.012, 0.028));
        if (chance(0.45)) this.fx.knock(fx, t + rand(0.05, 0.25), rand(0.02, 0.04), randi(1, 3));
      });
    }
    // the drums (120 bpm) from the second beat, with low men's voices on D; the card gets its stroke
    const p0 = t0 + BEAT;
    const nb = Math.floor((end - p0) / BEAT + 1e-6);
    for (let k = 0; k < nb; k++) {
      const tt = p0 + k * BEAT, kk = k, u = k / Math.max(1, nb - 1);
      this.add(sec, tt, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(m, t, 'taiko', (kk % 2 === 0 ? 0.46 : 0.35) * (0.85 + 0.3 * u), kk % 2 ? 0.25 : -0.25);
        S.drum(dry, t, 'dum', 0.28, 0);
        S.drum(dry, t + BEAT * 0.5, 'tek', lite ? 0.14 : 0.11, 0.2);
        if (!lite) S.drum(dry, t + BEAT * 0.75, 'ka', 0.08, -0.3);
        S.strStac(dry, t, kk % 4 === 3 ? 45 : 38, 0.5, 0.28, 0.6);
        S.strStac(dry, t + BEAT * 0.5, 38, 0.32, 0.2, 0.5);
        if (kk % 2 === 0) S.choir(m, t, BEAT * 2 + 0.25, lite ? [38, 45] : [38, 45, 50], { level: 0.06 + 0.02 * u, attack: 0.06, release: 0.35, vowel: 'oh', breath: 0.12 });
      });
    }
    this.add(sec, card, (t, m) => S.drum(m, t, 'taiko', 0.3, 0.1, 0.8));
    // a flam into the slow motion
    this.add(sec, end - BEAT * 0.5, (t, m) => { S.drum(m, t, 'taiko', 0.35, -0.3); S.drum(m, t + 0.06, 'taiko', 0.45, 0.3); });
    this.add(sec, t0 + 0.2, (t, m, h) => S.pad(m, t, h, [26, 38, 45], { level: 0.06, attack: 0.5, release: 0.5, cutoff: 700, voices: lite ? 2 : 3, detune: 10 }), d);
  }

  /** G2 — SAUL, slow motion: his theme in low strings and men's voices over half-time drums; the world muffled. */
  private planSaul(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const card = this.text(sec, 0, this.beat(sec, 'card'));
    // slow motion: the world (ambience + army) through the slow filter, the tread slowed and deepened
    this.add(sec, t0, (t, _m, h, fx) => {
      this.muffle(t, 1300, 0.06, 0.35);
      this.fx.march(fx, t, h, 0.55, clamp(sec.slowmo * 0.85, 0.3, 1), 2400, 0.12);
      this.fx.windSwell(fx, t + 0.4, h - 0.4, 0.04, 250, 700, 0.3, -0.3);
    }, d);
    this.add(sec, end - 0.02, (t) => this.muffle(t, 18000, 0.03, 0), 0, undefined, true);
    // half-time drums: the stride
    for (let x = t0, k = 0; x < end - 0.3; x += BEAT * 2, k++) {
      const first = k === 0;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', first ? 0.72 : 0.5, 0, 0.8);
        S.drum(m, t, 'boom', first ? 0.34 : 0.15, 0, 0.88);
      });
    }
    // the theme: D A B♭-A G F … then the E (held through the halt and the spear, on the peak's bus)
    const unit = d / 9; // D2 A2 B♭1.5 A.5 G1 F1 = 8 units, then the E from the ninth
    this.add(sec, t0 + 0.04, (t, m) => {
      this.line(m, t, SAUL_HEAD, unit, 0.095, 'str');
      this.line(m, t + 0.02, SAUL_HEAD.map(([n, b]) => [n - 12, b] as const), unit, 0.075, 'men');
    });
    const peak = this.secs[sec.i + 1]?.role === 'peak' ? this.secs[sec.i + 1] : undefined;
    const eAt = t0 + 8 * unit;
    const roar = peak ? this.beat(peak, 'roar') : end;
    this.add(sec, eAt, (t, m, h) => {
      S.pad(m, t, h + 0.08, [52, 40], { level: 0.1, attack: Math.min(0.3, h * 0.2), release: 0.06, cutoff: 1300, cutoffEnd: 2600, q: 1, voices: lite ? 2 : 3, detune: 10, lfoCents: 100, vib: 10, vibRate: 5.6, vibDelay: 0.3, trem: 0.25, tremRate: 7 });
      S.choir(m, t + 0.02, h + 0.06, lite ? [40] : [40, 52], { level: 0.075, attack: Math.min(0.3, h * 0.2), release: 0.06, vowel: 'oh', breath: 0.1 });
    }, roar - eAt, peak);
    this.add(sec, t0, (t, m, h) => {
      S.pad(m, t, h, [74, 81], { level: 0.015, attack: 1, release: 0.4, cutoff: 3000, voices: 2, detune: 8, trem: 0.5, tremRate: 7 });
      S.pad(m, t, h, lite ? [38, 50] : [26, 38], { level: 0.07, attack: 0.3, release: 0.4, cutoff: 400, voices: lite ? 2 : 3, detune: 6 });
    }, d);
    // the king's name: a soft high glint over the gold
    this.add(sec, card, (t, m) => S.pad(m, t, 1.8, [86], { level: 0.008, attack: 0.5, release: 1.1, cutoff: 7000, voices: 2, detune: 6, trem: 0.3, tremRate: 10 }));
  }

  /** G3 — THE PEAK: the halt, the spear raised, and the roar of thousands ON the theme's resolution. Cut at once. */
  private planPeak(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const halt = this.beat(sec, 'halt'), spear = this.beat(sec, 'spear');
    const roar = clamp(this.beat(sec, 'roar'), spear + 0.05, end - 0.4);
    // the march until the halt: thousands of feet stop, a last scuff and rattle
    this.add(sec, t0, (t, _m, _h, fx) => this.fx.march(fx, t, Math.max(0.3, halt - t0 + 0.25), 0.5, 1, 6500, 0.04));
    this.add(sec, halt, (t, _m, _h, fx) => {
      for (let i = 0; i < (lite ? 2 : 4); i++) this.step(fx, t + rand(0, 0.12), rand(0.25, 0.4), rand(-0.7, 0.7), 'gravel');
      this.fx.clinks(fx, t + 0.05, 0.03, 3);
    });
    // the drum roll from the halt into the roar, a riser, the spear going up (a whoosh and the scales)
    for (let x = halt; x < roar - 0.03; x += BEAT / 4) {
      const u = (x - halt) / Math.max(0.3, roar - halt);
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(dry, t, u > 0.5 ? 'tek' : 'ka', 0.08 + 0.26 * u * u, rand(-0.3, 0.3));
        if (u > 0.4) S.drum(dry, t + BEAT / 8, 'ka', 0.05 + 0.15 * u * u, rand(-0.3, 0.3));
      });
    }
    this.add(sec, halt, (t, m) => S.drum(m, t, 'taiko', 0.45, 0, 0.9));
    const rl = roar - halt;
    this.add(sec, halt, (t, m) => riserFx(this.c, S, m, t, rl, 'dark', 1, lite));
    this.add(sec, spear, (t, _m, _h, fx) => {
      this.whoosh(fx, t, 0.35, 0.05, 900, 3200, 0.3);
      this.fx.clinks(fx, t + 0.08, 0.025, 4);
    });
    // THE ROAR: the hit, the theme's D at full power, thousands shouting, spears on shields, the teruah above
    this.add(sec, roar, (t, m) => this.hit(m, t, 1.08, true), 0, undefined, true);
    const rest = end - roar;
    this.add(sec, roar, (t, m, h) => {
      const chords: ReadonlyArray<readonly [ChordName, number]> = [['Dm', 0], ['Bb', 0.42], ['A', 0.72]];
      chords.forEach(([cn, f], i) => {
        const ch = CHORDS[cn];
        const len = (i + 1 < chords.length ? chords[i + 1][1] * rest : h) - f * rest;
        S.choir(m, t + f * rest, len + 0.3, voicing(ch, 50, 74).slice(0, lite ? 4 : 7), { level: 0.115, attack: 0.04, release: 0.25, vowel: 'ah', breath: 0.16 });
        S.pad(m, t + f * rest, len + 0.25, [rootIn(ch, 26), rootIn(ch, 38), rootIn(ch, 38) + 7], { level: 0.11, attack: 0.03, release: 0.2, cutoff: 1800, voices: lite ? 2 : 3, detune: 11 });
      });
      // the theme resolved: D in the high strings and the men, then the head again (D A B♭) — cut mid-phrase
      this.line(m, t, [[74, 0.42], [81, 0.3], [82, 0.28]].map(([n, b]) => [n, b * rest / BEAT] as const), BEAT, 0.075, 'str');
      this.line(m, t, [[38, 0.72], [45, 0.28]].map(([n, b]) => [n, b * rest / BEAT] as const), BEAT, 0.08, 'men');
    }, rest);
    for (let x = roar, k = 0; x < end - 0.05; x += BEAT, k++) {
      const kk = k;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', kk === 0 ? 0.7 : 0.58, -0.2); S.drum(m, t + 0.01, 'taiko', 0.5, 0.25);
        S.drum({ dry: m.dry, wet: null }, t + BEAT * 0.5, 'dum', 0.4, 0);
      });
    }
    this.add(sec, roar + 0.3, (t, m) => { S.shofar(m, t, 'teruah', 0.24, 220, 293.66); });
    this.add(sec, roar, (t, _m, h, fx) => {
      this.fx.roar(fx, t, h, 0.21, clamp(this.beat(sec, 'spread') - sec.shots[0].t, 0.1, 0.8));
      for (let i = 0; i < (lite ? 3 : 6); i++) this.fx.clinks(fx, t + 0.3 + rand(0, 1.2), 0.03, 2);
      for (let i = 0; i < (lite ? 2 : 5); i++) this.fx.knock(fx, t + 0.25 + rand(0, 1.4), 0.05, randi(2, 4));
    }, rest + 0.05);
  }

  /** G4 — SILENCE: the roar cut at once; wind and the far bleating and lowing of the spoil (15:14); the ranks part. */
  private planSilence(sec: Sec): void {
    const S = this.s, t0 = sec.t0, end = sec.t1;
    const heads = this.beat(sec, 'heads'), part = this.beat(sec, 'part'), step = this.beat(sec, 'step');
    const card = this.text(sec, 0, this.beat(sec, 'card'));
    this.add(sec, t0, (t) => { this.hallCut(t, 3); this.duckAmbience(t, 0.12, 0.35, 2.2); }, 0, undefined, true);
    // heads turn: wool and a few clinks through the ranks
    this.add(sec, heads, (t, _m, _h, fx) => { this.fabric(fx, t, 0.6, 0.016, -0.3); this.fx.clinks(fx, t + 0.2, 0.008); });
    // the spoil, far away: sheep, the lowing of oxen, a goat
    this.add(sec, t0 + 0.45, (t, _m, _h, fx) => { const f = this.far(fx, t, 4, 1800, 0.35, 0.5); this.fx.bleat(f.dry, t, 0.2, -0.6); });
    this.add(sec, t0 + 1.25, (t, _m, _h, fx) => this.fx.lowing(this.far(fx, t, 4, 1400, 0.4, 0.5), t, 0.018, 0.55));
    this.add(sec, t0 + 2.3, (t, _m, _h, fx) => { const f = this.far(fx, t, 4, 1800, 0.35, 0.5); this.fx.bleat(f.dry, t, 0.13, 0.7, 'goatBleat'); });
    // the front ranks part: men stepping aside, cloth, a clink
    this.add(sec, part, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.06, 0.72, 1100, 0.25);
      this.fx.clinks(fx, t + h * 0.4, 0.008);
    }, Math.max(0.6, step - part));
    // under Samuel's name: the ground tone creeps in, and one high A that will carry into the tear
    const tear = this.secs[sec.i + 1]?.role === 'tear' ? this.secs[sec.i + 1] : undefined;
    this.add(sec, card, (t, m, h) => this.ground(m, t, h, 0.05, 1.2, 0.6), end - card + 0.3);
    this.add(sec, card + 0.2, (t, m, h) => S.pad(m, t, h, [69], {
      level: 0.03, attack: Math.min(2.5, h * 0.45), release: 0.5, cutoff: 1500, voices: 2, detune: 4, lfoCents: 40, vib: 9, vibRate: 5.2, vibDelay: 1.2,
    }), (tear ? tear.t1 : end) - card - 0.2, tear);
    // his step forward
    this.add(sec, step, (t, m, _h, fx) => { this.step(fx, t, 0.5, 0.1); S.drum(m, t + 0.01, 'boom', 0.1, 0, 0.9); });
  }

  /** G5a + G5b — THE TEAR: Samuel turns to go, Saul lunges and grips the corner of the me'il; it tears (slow motion). */
  private planTear(sec: Sec): void {
    const S = this.s, lite = this.lite, end = sec.t1;
    const turn = this.beat(sec, 'turn'), lunge = this.beat(sec, 'lunge'), grip = this.beat(sec, 'grip');
    const ins = this.shotStart(sec, 1, (SPLIT.tear ?? [2])[0]);
    const pull = Math.max(grip + 0.05, this.beat(sec, 'pull')), free = Math.max(pull + 0.3, this.beat(sec, 'free'));
    // the turn: wool, a step of an old man
    this.add(sec, turn, (t, _m, _h, fx) => { this.fabric(fx, t, 0.7, 0.022, 0.3); this.step(fx, t + 0.3, 0.3, 0.3); });
    // the lunge: a stride, bronze scales rattling, the air; a suck into the grip
    this.add(sec, lunge, (t, _m, _h, fx) => {
      this.step(fx, t, 0.45, -0.2, 'skid');
      this.fx.clinks(fx, t + 0.02, 0.03, 5);
      this.whoosh(fx, t, Math.max(0.2, grip - lunge), 0.04, 500, 2200, -0.2);
    });
    this.add(sec, lunge, (t, m) => this.fx.suck(m, t + (grip - lunge), grip - lunge, 0.04, 0.8));
    // the strings under the lunge: the A starts to tremble, a low D pulse
    this.add(sec, lunge, (t, m, h) => S.pad(m, t, h, [57, 45], { level: 0.03, attack: h * 0.7, release: 0.2, cutoff: 1400, voices: 2, detune: 6, trem: 0.6, tremRate: 9 }), grip - lunge + 0.1);
    // the grip: the cloth snatched — a low stroke
    this.add(sec, grip, (t, m, _h, fx) => { this.fx.grab(fx, t, 0.35); S.drum(m, t, 'boom', 0.26, 0, 0.7); }, 0, undefined, true);
    // the insert: the world drops into slow motion
    this.add(sec, ins, (t) => this.muffle(t, 700, 0.08, 0.45), 0, undefined, true);
    // the rip itself (baked to the pull / rip / free beats) — on the music bus so the slow-motion filter keeps it sharp
    this.add(sec, pull, (t, m) => this.fx.rip(m, t, free - pull, 0.7), 0, undefined, true);
    // the semitone of grief: the held A is joined by B♭; a low cluster swells and breaks with the cloth
    this.add(sec, grip + 0.1, (t, m, h) => {
      S.pad(m, t, h, [58], { level: 0.036, attack: h * 0.75, release: 0.25, cutoff: 1400, voices: 2, detune: 5, lfoCents: 80, vib: 14, vibRate: 5.8, vibDelay: 0.6 });
      S.choir(m, t, h, lite ? [45, 46] : [38, 45, 46, 52], { level: 0.034, attack: h * 0.7, release: 0.3, vowel: 'oo', breath: 0.12 });
    }, free - grip);
    // the corner comes free: the break
    this.add(sec, free, (t, m, _h, fx) => {
      S.drum(m, t, 'boom', 0.4, 0, 0.75);
      this.fx.impact(fx, t, 0.16, 2.2);
      S.choir(m, t + 0.04, end - free + 0.6, [45, 46], { level: 0.018, attack: 0.04, release: 0.5, vowel: 'oo', breath: 0.2 });
    });
    // out of slow motion into the verdict
    this.add(sec, end - 0.15, (t) => this.muffle(t, 18000, 0.06, 0));
  }

  /** G6 — the verdict (15:28a), close on Samuel: near-silence; a ground tone, a thread, one deep stroke on "today". */
  private planVerdict(sec: Sec): void {
    const S = this.s, t0 = sec.t0, end = sec.t1;
    const turn = this.beat(sec, 'turn');
    const words = clamp(this.text(sec, 0, this.beat(sec, 'words')), t0, end - 1);
    this.add(sec, t0, (t, m, h) => this.ground(m, t, h, 0.048, 0.8, 0.8), end - t0);
    this.add(sec, turn, (t, _m, _h, fx) => this.fabric(fx, t, 0.5, 0.012, -0.2));
    this.add(sec, words, (t, m, h) => {
      S.choir(m, t, h, [38], { level: 0.02, attack: 1.4, release: 0.8, vowel: 'oo', breath: 0.04 });
      S.pad(m, t + 0.6, h - 0.6, [81], { level: 0.006, attack: 1.4, release: 0.8, cutoff: 4000, voices: 1, type: 'sine', lfoCents: 20 });
    }, end - words + 0.2);
    // the last word of 15:28a ("today"): one deep, soft stroke — on the sheet's word timing (else ≈0.45 s a word)
    const last = Math.min(end - 0.3, sec.words.length ? sec.words[sec.words.length - 1] : words + 5 * 0.45 + 0.1);
    this.add(sec, last, (t, m) => { S.drum(m, t, 'boom', 0.2, 0, 0.8); S.drum(m, t + 0.005, 'taiko', 0.12, 0, 0.7); });
  }

  /** G7 — Saul alone with the torn piece in his fist: his motif on a lone cello, falling below the tonic. */
  private planBroken(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const look = this.beat(sec, 'look'), tighten = this.beat(sec, 'tighten');
    // A (he looks down) — B♭, the sigh — A; the fingers tighten — F, E, and below the tonic: C♯ (into the flash)
    const a0 = look - 0.25, sigh = look + 0.3;
    this.add(sec, a0, (t, m) => {
      const k = clamp((tighten + 0.1 - a0) / 1.25, 0.6, 1.4); // the contract: the fingers tighten 0.9 s after the look
      this.line(m, t, [[57, 0.5 * k], [58, 0.45 * k], [57, 0.3 * k], [53, 0.2], [52, 0.2], [49, 0.7]], 1, 0.062, 'cello');
    });
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h, lite ? [38, 45] : [26, 38, 45], { level: 0.032, attack: 0.4, release: 0.4, cutoff: 600, voices: 2, detune: 6 }), d);
    this.add(sec, sigh, (t, m, h) => S.choir(m, t, h, [46, 50], { level: 0.016, attack: 0.6, release: 0.4, vowel: 'oo', breath: 0.08 }), end - sigh);
    // his breath; the army behind him, out of focus
    this.add(sec, look + 0.05, (t, _m, _h, fx) => this.humanBreath(fx, t, 0.035));
    this.add(sec, tighten, (t, _m, _h, fx) => this.fabric(fx, t, 0.3, 0.012, 0.1));
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(this.far(fx, t, h + 1, 900, 0, 0.4), t, h, 0.16, 2), d);
    // the light-flash: a warm rising shimmer into David's light
    const next = this.secs[sec.i + 1];
    if (next && next.role === 'david') {
      const rl = Math.min(0.6, d * 0.3);
      const whip = clamp(this.beat(sec, 'flash'), end - rl, end - 0.1);
      this.add(sec, end - rl, (t, m) => {
        riserFx(this.c, S, m, t, rl, 'warm', 0.7, lite);
        [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => S.lyre(m, t + (i / 7) * rl * 0.95, n, 0.22 + i * 0.03, lyrePan(n)));
      });
      this.add(sec, whip, (t, _m, _h, fx) => this.whoosh(fx, t, end - whip + 0.12, 0.05, 700, 5000, 0.2)); // the whip up into the light
    }
  }

  // ================================================================================ DAVID

  /** D1 + D2 — the light-flash into Bethlehem's hills; David from behind on the rock; he turns into the light. */
  private planDavid(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const face = this.shotStart(sec, 1, (SPLIT.david ?? [4])[0]);
    const verse = clamp(this.text(sec, 0, this.beat(sec, 'verse')), t0, face - 1);
    const turn = this.beat(sec, 'turn'), heart = clamp(this.text(sec, 1, this.beat(sec, 'heart')), turn + 0.2, end - 0.5);
    const dis = sec.exit === 'x' ? Math.min(0.8, sec.tau * 3) : 0.3; // the dissolve out (the light cools)
    // the bloom of the light: D major, voices, strings, a soft stroke, a kinnor strum, a high shimmer
    this.add(sec, t0, (t, m, _h, fx) => {
      S.drum(m, t, 'boom', 0.14, 0, 1);
      S.choir(m, t, face - t0 + 0.4, lite ? [50, 57, 62, 66] : [50, 57, 62, 66, 69], { level: 0.034, attack: 0.25, release: 0.9, vowel: 'ah', to: 'oo', morph: 2, breath: 0.07 });
      S.pad(m, t, face - t0 + 0.4, [38, 45, 50, 54], { level: 0.028, attack: 0.25, release: 0.9, cutoff: 1200, cutoffEnd: 700, voices: lite ? 2 : 3, detune: 8 });
      S.strum(m, t + 0.03, [50, 54, 57, 62, 66, 69], 0.4, 0.045);
      S.pad(m, t, 1.8, [86, 90], { level: 0.01, attack: 0.05, release: 1.4, cutoff: 7000, voices: 2, detune: 8, trem: 0.3, tremRate: 10 });
      this.fx.windSwell(fx, t + 0.3, face - t0, 0.028, 700, 2600, -0.3, 0.4); // wind in his curls
    });
    // the kinnor in 6/8 over both shots (D – C – G/D – D; then G – D – A – D as he turns)
    this.kinnor(sec, t0 + STEP68 * 1.5, face, ['D', 'C', 'G', 'D'], 0.56);
    this.kinnor(sec, face, end - dis * 0.6, ['G', 'D', 'A', 'D'], 0.5);
    // 15:28b over David: his motif on the shepherd's pipe (D A G F E F D, Dorian), close and intimate
    const u = clamp((face - verse - 0.2) / 11, 0.24, STEP68);
    this.add(sec, verse + 0.1, (t, m) => { S.ney(m, t, motif(74, DAVID, u), 0.12); });
    this.add(sec, verse, (t, m, h) => S.pad(m, t, h, [38, 45, 50], { level: 0.026, attack: 1, release: 0.6, cutoff: 800, voices: 2, detune: 5 }), face - verse + 0.3);
    // the flock below him, the birds of the golden hour (they stop at the thicket)
    this.add(sec, t0 + 0.9, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.16, 0.45));
    this.add(sec, t0 + 2.4, (t, _m, _h, fx) => this.fx.chukar(this.far(fx, t, 4, 4500, 0.3, 0.5), t, 0.014, -0.6));
    this.add(sec, face - 0.8, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.12, -0.35, 'lambBleat', 1.08));
    this.add(sec, face + 0.25, (t, _m, _h, fx) => this.fx.bulbul(fx, t, 0.009, 0.5));
    // he turns into the light: warm voices open to "ah" with the turn and bloom on 16:7; the kinnor answers
    this.add(sec, turn, (t, m, h) => {
      S.choir(m, t, h, lite ? [62, 66, 69] : [57, 62, 66, 69, 74], { level: 0.05, attack: heart - turn, release: dis + 0.2, vowel: 'oo', to: 'ah', morph: heart - turn + 0.4, breath: 0.06 });
      S.pad(m, t, h, [38, 50, 57, 62], { level: 0.04, attack: heart - turn, release: dis + 0.2, cutoff: 1500, voices: lite ? 2 : 3, detune: 7 });
    }, end - turn + 0.2);
    this.add(sec, heart, (t, m) => {
      S.strum(m, t, [62, 66, 69, 74, 78], 0.5, 0.05);
      S.ney(m, t + 0.25, motif(74, ANSWER, clamp((end - heart - 0.6) / 10, 0.16, 0.26)), 0.1);
    });
  }

  // ================================================================================ THE HOOK

  /** H1 + H2 — the lamb at the thicket's edge; the birds fall silent; in the dark two eyes open. SMASH. */
  private planThicket(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const birds = this.beat(sec, 'birds'), lamb = this.beat(sec, 'lamb'), eyes = this.beat(sec, 'eyes');
    const dark = this.shotStart(sec, 1, (SPLIT.thicket ?? [2.5])[0]);
    const t1 = end - (sec.exit === 'cut' ? sec.gap : 0);
    // the birds stop on the beat: the bed holds its breath
    this.add(sec, birds, (t) => { if (this.onAmbience) this.onAmbience('hush', 0.1, t); }, end - birds);
    // a thin high tone and a low rumble rising from the silence
    this.add(sec, birds + 0.1, (t, _m, h, fx) => this.fx.rumble(fx, t, h, 0.16), t1 - birds - 0.1);
    this.add(sec, birds + 0.2, (t, m, h) => S.pad(m, t, h, [93], { level: 0.004, attack: h * 0.7, release: 0.1, cutoff: 6000, voices: 1, type: 'sine', lfoCents: 12 }), t1 - birds - 0.2);
    // the lamb lifts its head
    this.add(sec, lamb, (t, _m, _h, fx) => this.fabric(fx, t, 0.3, 0.006, 0.4));
    // the dark of the thicket: leaves shiver, a heavy breath
    this.add(sec, dark, (t, _m, _h, fx) => this.fx.rustle(fx, t, Math.max(0.4, eyes - dark + 0.2), 0.045));
    this.add(sec, dark + 0.05, (t, _m, _h, fx) => this.fx.breath(fx, t, 0.06, Math.max(0.3, (eyes - dark) * 0.75), 0.9));
    // THE EYES: a low sting
    this.add(sec, eyes, (t, m, _h, fx) => {
      S.drum(m, t, 'boom', 0.3, 0, 0.8);
      S.pad(m, t, 1.2, [38, 39], { level: 0.03, attack: 0.02, release: 0.8, cutoff: 600, voices: 2, detune: 10 });
      S.pad(m, t, 0.9, [75, 76], { level: 0.008, attack: 0.02, release: 0.6, cutoff: 5000, voices: 2, detune: 4, trem: 0.5, tremRate: 13 });
      this.fx.impact(fx, t, 0.08, 1.2);
    }, 0, undefined, true);
    // the heart: slow after the lamb lifts its head, quickening after the eyes
    let x = lamb + 0.15, gap = 0.9;
    while (x < t1 - 0.2) {
      const u = clamp((x - lamb) / Math.max(0.5, t1 - lamb), 0, 1);
      this.add(sec, x, (t, _m, _h, fx) => this.fx.heart(fx, t, 0.1 + 0.2 * u));
      gap = x > eyes ? Math.max(0.3, gap * 0.72) : Math.max(0.55, gap * 0.92);
      x += gap;
    }
    // the pull into the smash
    const sl = Math.min(0.9, t1 - eyes - 0.05);
    if (sl > 0.2) this.add(sec, t1 - sl, (t, m) => this.fx.suck(m, t + sl, sl, 0.1, 1.4));
  }

  /** T — SMASH to black on the loudest hit; DAVID forms from light; the title motif; the tail into gameplay. */
  private planTitle(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0;
    const forms = this.beat(sec, 'forms'), name = this.beat(sec, 'name'), chapter = this.beat(sec, 'chapter');
    this.add(sec, t0, (t, m, _h, fx) => {
      this.titleAt = t;
      this.hit(m, t, 1.1, true);
      this.fx.impact(fx, t, 0.7, 3);
      this.fx.braam(m, t, lite ? 0.5 : 0.4, 3);
      S.pad(m, t, 3, [26, 38, 45, 50], { level: 0.2, attack: 0.01, release: 2.4, cutoff: 1800, cutoffEnd: 300, voices: lite ? 2 : 3, detune: 12 });
      S.choir(m, t + 0.01, 2, lite ? [38, 50, 57, 65] : [38, 50, 57, 62, 65], { level: 0.2, attack: 0.03, release: 2.2, vowel: 'ah', breath: 0.2 });
      S.drum(m, t + 0.012, 'taiko', 0.7, 0);
    }, 0, undefined, true);
    // DAVID forms from light: a high shimmer sweeping in
    this.add(sec, forms, (t, m) => S.pad(m, t, Math.max(1.2, name - forms + 0.8), [81, 86, 93], { level: 0.009, attack: Math.max(0.4, name - forms), release: 0.8, cutoff: 8000, voices: 2, detune: 8, trem: 0.25, tremRate: 11 }));
    // דָּוִד: the title motif — the rising fifth D–A on the kinnor and the pipe, then the motif resolving in D major
    const tail = Math.max(name, t0 + 0.8);
    const hold = Math.max(0.6, chapter - tail + 0.35);
    this.add(sec, tail, (t, m) => {
      S.lyre(m, t, 50, 0.45, -0.2); S.lyre(m, t + 0.02, 57, 0.42, 0.15);
      S.ney(m, t + 0.05, [{ midi: 74, dur: hold * 0.4 }, { midi: 81, dur: hold * 0.6 + 0.35 }, { midi: 79, dur: 0.24 }, { midi: 78, dur: 0.24 }, { midi: 76, dur: 0.24 }, { midi: 78, dur: 0.3 }, { midi: 74, dur: 2.2 }], 0.12);
      S.choir(m, t + 0.2, 4.6, [50, 57, 62, 66], { level: 0.03, attack: 1.4, release: 2.4, vowel: 'oo', breath: 0.05 });
      S.pad(m, t, 5.2, [26, 38, 45], { level: 0.04, attack: 0.8, release: 2.6, cutoff: 380, voices: 2, detune: 4 });
    });
    // the chapter line: the resolution on D major, a strum, the voices open
    const res = tail + 0.05 + hold + 0.35 + 0.24 * 3 + 0.3;
    this.add(sec, res, (t, m) => {
      S.strum(m, t, [50, 57, 62, 66, 69, 74], 0.42, 0.05);
      S.pad(m, t, 3.4, [62, 66, 69], { level: 0.022, attack: 0.5, release: 2.2, cutoff: 2000, voices: 2, detune: 6 });
    });
    this.add(sec, chapter, (t, m) => S.lyre(m, t, 62, 0.3, 0.1));
  }

  // ================================================================================ instruments

  /** The prologue's pulse: low strings on every beat, the tof on one and three (levels ramp from a to b). */
  private pulse(sec: Sec, from: number, to: number, str0: number, str1: number, tof0: number, tof1: number): void {
    const S = this.s;
    const d = Math.max(0.5, to - from);
    for (let x = from, k = 0; x < to - 0.02; x += BEAT, k++) {
      const u = (x - from) / d, kk = k;
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.strStac(dry, t, 38, str0 + (str1 - str0) * u, 0.3, 0.45);
        if (kk % 2 === 0) S.drum(m, t, 'dum', tof0 + (tof1 - tof0) * u, -0.1, 0.95);
        else S.drum(dry, t, 'tek', (tof0 + (tof1 - tof0) * u) * 0.45, 0.2);
      });
    }
  }

  /** Kinnor in 6/8 over a chord per bar (D Dorian / major), plucked and spread. */
  private kinnor(sec: Sec, from: number, to: number, prog: readonly ChordName[], vel: number): void {
    const S = this.s;
    for (let k = 0; from + k * STEP68 < to - 0.15; k++) {
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
        this.s.pad(o, tt, d + 0.3, inst === 'str' ? [m, m - 12] : [m], {
          level, attack: Math.min(0.3, d * 0.35), release: 0.5, cutoff: inst === 'str' ? 1200 : 900, q: 1,
          voices: this.lite ? 2 : 3, detune: inst === 'str' ? 9 : 5, lfoCents: 120,
          vib: d > 0.4 ? (inst === 'cello' ? 16 : 9) : 0, vibRate: inst === 'cello' ? 5 : 5.6, vibDelay: Math.min(0.25, d * 0.3),
        });
      } else {
        this.s.choir(o, tt, d + 0.25, [m], { level, attack: Math.min(0.25, d * 0.4), release: 0.4, vowel: inst === 'men' ? 'oh' : 'oo', breath: inst === 'hum' ? 0.05 : 0.08 });
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

  /** Output placed in the stereo field (`pan` -1..1), with its hall send. */
  private panned(o: Out, t: number, dur: number, pan: number): Out {
    const v = new Voice(this.c);
    const p = v.pan(pan);
    p.connect(o.dry);
    if (o.wet) p.connect(o.wet);
    v.play(t, t + dur);
    return { dry: p, wet: null };
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

  /** Wool moving (a turn, a mantle, men turning their heads). */
  private fabric(o: Out, t: number, d: number, lvl: number, pan = 0.3): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 1900, 0.7), g = v.gain(0), p = v.pan(pan);
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

  /** A fast air movement (the flight, the spear going up, the lunge): a band of noise sweeping f0 → f1. */
  private whoosh(o: Out, t: number, d: number, lvl: number, f0: number, f1: number, pan = 0): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', f0, 1.1), g = v.gain(0), p = v.pan(pan);
    bp.frequency.setValueAtTime(this.c.hz(f0), t); bp.frequency.exponentialRampToValueAtTime(this.c.hz(f1), t + d * 0.7);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.4); p.connect(w); w.connect(o.wet); }
    v.play(t, t + d + 0.05);
  }

  /** The race over the cloud sea: air louder and brighter to the deck (`deck` s), grey inside, wide open at `out`. */
  private rush(o: Out, t: number, deck: number, out: number, dur: number): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 420, 0.8), g = v.gain(0), p = v.pan(0);
    const b = v.noise('brown', t), lp = v.filter('lowpass', 200, 0.6), bg = v.gain(0);
    const F = bp.frequency, G = g.gain, B = bg.gain;
    const hz = (x: number): number => this.c.hz(x);
    F.setValueAtTime(hz(420), t); F.exponentialRampToValueAtTime(hz(2300), t + deck);
    F.exponentialRampToValueAtTime(hz(650), t + Math.min(out - 0.1, deck + 0.3));
    F.setValueAtTime(hz(650), t + out - 0.1); F.exponentialRampToValueAtTime(hz(3600), t + out + 0.15); F.exponentialRampToValueAtTime(hz(900), t + dur);
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(0.028, t + deck * 0.55); G.linearRampToValueAtTime(0.07, t + deck);
    G.linearRampToValueAtTime(0.036, t + Math.min(out - 0.1, deck + 0.3)); G.setValueAtTime(0.036, t + out - 0.1);
    G.linearRampToValueAtTime(0.06, t + out + 0.12); G.linearRampToValueAtTime(0.014, t + dur);
    B.setValueAtTime(0, t); B.linearRampToValueAtTime(0.05, t + deck); B.linearRampToValueAtTime(0.03, t + out);
    B.linearRampToValueAtTime(0.05, t + out + 0.15); B.linearRampToValueAtTime(0.012, t + dur);
    if ('pan' in p) {
      const P = (p as StereoPannerNode).pan;
      P.setValueAtTime(-0.2, t); P.linearRampToValueAtTime(0.25, t + deck); P.linearRampToValueAtTime(-0.3, t + dur); // the bank
    }
    n.connect(bp); bp.connect(g); g.connect(p);
    b.connect(lp); lp.connect(bg); bg.connect(p);
    p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.35); p.connect(w); w.connect(o.wet); }
    v.play(t, t + dur + 0.05);
  }

  /** A human breath (Saul): a short in-breath and a shaking out-breath, in the upper band (not the bear's growl). */
  private humanBreath(o: Out, t: number, lvl: number): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 1100, 1.1), g = v.gain(0), p = v.pan(-0.1);
    const B = bp.frequency, G = g.gain;
    B.setValueAtTime(900, t); B.linearRampToValueAtTime(1500, t + 0.35);
    G.setValueAtTime(0, t); G.linearRampToValueAtTime(lvl * 0.7, t + 0.3); G.linearRampToValueAtTime(lvl * 0.1, t + 0.4);
    B.setValueAtTime(1300, t + 0.45); B.linearRampToValueAtTime(700, t + 1.2);
    for (let x = 0.45; x < 1.1; x += rand(0.07, 0.12)) G.linearRampToValueAtTime(lvl * rand(0.5, 1) * (1.2 - (x - 0.45)), t + x);
    G.linearRampToValueAtTime(0, t + 1.2);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.3); p.connect(w); w.connect(o.wet); }
    v.play(t, t + 1.25);
  }

  /** A footstep from the engine's baked banks (a sandal on dry earth / gravel, or a skid). */
  private step(o: Out, t: number, lvl: number, pan = 0, kind: 'stepWalk' | 'gravel' | 'skid' = 'stepWalk'): void {
    const b = pick(this.c.bank(kind));
    const v = new Voice(this.c);
    const r = rand(0.9, 1.05);
    const s = v.buffer(b, r, t), g = v.gain(lvl), p = v.pan(pan);
    s.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.3); p.connect(w); w.connect(o.wet); }
    v.play(t, t + b.duration / r + 0.05);
  }

  private lastOf(roles: readonly ScoreRole[]): Sec | undefined {
    let last: Sec | undefined;
    for (const s of this.secs) if (roles.includes(s.role)) last = s;
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
const round3 = (x: number): number => Math.round(x * 1000) / 1000;
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

/** A shot cue's own beats (shot seconds), keyed by normalised name; numbers or { at } / { t } objects. */
function sheetBeats(c: IntroCue): Record<string, number> | null {
  const raw = (c as unknown as { beats?: unknown }).beats;
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, number> = {};
  const put = (k: string, v: unknown): void => {
    const x = typeof v === 'number' ? v : v && typeof v === 'object' ? ((v as { at?: unknown; t?: unknown }).at ?? (v as { t?: unknown }).t) : undefined;
    if (typeof x === 'number' && Number.isFinite(x) && k) out[norm(k)] = x;
  };
  if (Array.isArray(raw)) {
    for (const e of raw) if (e && typeof e === 'object') put(String((e as { name?: unknown; id?: unknown }).name ?? (e as { id?: unknown }).id ?? ''), e);
  } else {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) put(k, v);
  }
  return Object.keys(out).length ? out : null;
}

function roleOf(c: IntroCue): ScoreRole | null {
  const cue = typeof c.cue === 'string' ? c.cue : '';
  return ROLE_OF_CUE[cue] ?? ROLE_OF_SET[String(c.set ?? '')] ?? null;
}

/**
 * Sections from a cue sheet: consecutive SHOT cues of the same role merge (text cues carry no `shot`); the exit of
 * each section comes from the transition of the next one's first shot.
 */
function buildSections(cues: readonly IntroCue[]): Sec[] {
  const shots = [...(cues ?? [])]
    .filter((c) => c && c.shot && Number.isFinite(c.t) && roleOf(c) !== null)
    .sort((a, b) => a.t - b.t);
  const out: Sec[] = [];
  for (const c of shots) {
    const role = roleOf(c) as ScoreRole;
    const sh: Shot = { t: c.t, id: String(c.shot), dur: Number.isFinite(c.dur) ? (c.dur as number) : 0, cut: c.cut ?? '', fade: c.fade ?? 0, beats: sheetBeats(c) };
    const sm = (c as unknown as { slowmo?: unknown }).slowmo;
    const slow = typeof sm === 'number' && Number.isFinite(sm) && sm > 0 && sm < 1 ? sm : 1;
    const last = out[out.length - 1];
    if (last && last.role === role) { last.shots.push(sh); if (last.slowmo === 1) last.slowmo = slow; continue; }
    if (last) last.t1 = c.t;
    out.push({
      slowmo: slow, i: out.length, role, t0: c.t, t1: Infinity, shots: [sh], cut: sh.cut, fade: sh.fade,
      exit: 'ring', tau: 0.5, gap: 0, next: null, texts: [], words: [],
    });
  }
  if (!out.length) return out;
  out[0].t0 = Math.min(out[0].t0, 0);
  const last = out[out.length - 1];
  const lsh = last.shots[last.shots.length - 1];
  const lend = lsh.t + (lsh.dur > 0 ? lsh.dur : last.role === 'title' ? TITLE_LEN : 8);
  last.t1 = lend + (last.role === 'title' ? 6 : 0);
  for (const c of cues ?? []) {
    if (!c || c.shot || !Number.isFinite(c.t) || !(c.verse || c.narration)) continue;
    const sec = out.find((x) => c.t >= x.t0 && c.t < x.t1);
    if (!sec) continue;
    sec.texts.push(c.t);
    // speech-synced words are in seconds from the start of the text's SHOT
    const ws = (c as unknown as { words?: unknown }).words;
    if (Array.isArray(ws) && !sec.words.length) {
      const sh = [...sec.shots].reverse().find((x) => x.t <= c.t + 1e-6) ?? sec.shots[0];
      for (const w of ws) { const wt = (w as { t?: unknown })?.t; if (typeof wt === 'number' && Number.isFinite(wt)) sec.words.push(sh.t + wt); }
    }
  }
  for (const sec of out) sec.texts.sort((a, b) => a - b);
  for (let i = 0; i < out.length - 1; i++) {
    const sec = out[i], nx = out[i + 1];
    sec.next = nx.role;
    if (nx.cut === 'hard' || nx.cut === 'smash') { sec.exit = 'cut'; sec.tau = 0.01; sec.gap = GAP; }
    else if (nx.role === 'silence') { sec.exit = 'cut'; sec.tau = 0.01; sec.gap = 0; }
    else if (nx.cut === 'dissolve' || nx.cut === 'light' || nx.cut === 'match' || nx.cut === 'black') { sec.exit = 'x'; sec.tau = Math.max(0.12, (nx.fade || 1.2) / 3); }
    else { sec.exit = 'x'; sec.tau = 0.22; }
  }
  return out;
}
