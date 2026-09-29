/**
 * DAVID — the opening-cinematic score, synchronised to the intro cue sheet (src/content/introScript.ts).
 *
 * The cue sheet is read when the score starts: consecutive cues with the same `beat` form one
 * section [t0, t1) and every section has a composed plan whose events are placed relative to the
 * section's start / end / duration, so the intro teammate can retime, drop (the short cut) or reorder
 * cues and the music follows. Events are scheduled just ahead of the AudioContext clock (no node
 * storms: only what starts in the next ~0.5 s is built).
 *
 * Leitmotifs (all centred on D):
 *   - the land:  D drone, distant shepherd's pipe (chalil) with the valley echo, humming voices;
 *   - Saul:      low drones, deep frame drums / taiko, low strings and men's voices, ram's horn
 *                (1 Sam 13:3: Saul blew the shofar throughout the land) — his theme rises a fifth and sighs a semitone
 *                (D A Bb-A G F E D): majestic, heavy, never "evil". No lyre in Saul's house (the lyre
 *                at court belongs to after 16:14, see docs/sources.md);
 *   - David:     pipe + plucked kinnor + frame-drum fingers, D Dorian 6/8; his motif (D A G F E F D)
 *                shares Saul's rising fifth without the sigh; under the title card it is resolved in
 *                D major and closes on a plagal (G -> D) cadence.
 * Transitions: each section declares how it is entered ('soft' / 'hit' = arrival after a riser /
 * 'x' crossfade / 'cut' to silence); the previous section adds a riser before a 'hit' and its bus
 * is cut, faded or crossfaded accordingly. The hinge (15:28) is the emotional turn: the torn robe,
 * a suspended dissonance, then the flight south that blooms into the open D of Bethlehem.
 */
import type { IntroBeat, IntroCue } from '../content/introScript';
import type { BedName } from './Beds';
import {
  Core, Synth, Voice, clamp, rand, chance, CHORDS, voicing, rootIn, lyrePan, pcOf,
  type Out, type ChordName, type NeyNote,
} from './synth';

type Entry = 'soft' | 'hit' | 'x' | 'cut';
const ENTRY: Record<IntroBeat, Entry> = {
  judea: 'soft', gibeah: 'hit', 'saul-court': 'x', 'saul-portrait': 'hit', warriors: 'x', 'saul-hall': 'cut',
  hinge: 'x', bethlehem: 'hit', rachel: 'x', flock: 'x', david: 'x', title: 'hit',
};
/** How long the title section lasts when the sheet gives no shot length (s). */
const TITLE_LEN = 8;
const GIBEAH_BEATS: ReadonlySet<IntroBeat> = new Set<IntroBeat>(['gibeah', 'saul-court', 'saul-portrait', 'warriors', 'saul-hall', 'hinge']);
/** Ambience bed that goes with each beat (the score switches beds unless the game takes over). */
const BEAT_BED: Record<IntroBeat, BedName> = {
  judea: 'fields', gibeah: 'gibeah-exterior', 'saul-court': 'gibeah-exterior', 'saul-portrait': 'gibeah-exterior',
  warriors: 'gibeah-exterior', 'saul-hall': 'gibeah-hall', hinge: 'gibeah-hall', bethlehem: 'fields', rachel: 'fields',
  flock: 'fields', david: 'fields', title: 'fields',
};
const BED_FADE: Record<Entry, number> = { soft: 2, hit: 0.8, x: 1.6, cut: 0.25 };
/** The dynamic arc: section bus level per beat (David's shots inside Saul's part use INTERCUT_LEVEL). */
const SEC_LEVEL: Record<IntroBeat, number> = {
  judea: 0.6, gibeah: 0.85, 'saul-court': 0.9, 'saul-portrait': 1.1, warriors: 0.92, 'saul-hall': 0.58,
  hinge: 0.85, bethlehem: 0.88, rachel: 0.7, flock: 0.78, david: 0.86, title: 1,
};
const INTERCUT_LEVEL = 0.55;
const PASTORAL: ReadonlySet<IntroBeat> = new Set<IntroBeat>(['bethlehem', 'rachel', 'flock', 'david']);
/** 6/8 lilt of the pastoral block (s per eighth) — the same feel as the chapter's pastoral mood. */
const STEP68 = 0.34;
/** Saul's processional pulse (66 bpm). */
const BEAT_SAUL = 60 / 66;

export interface IntroSection { readonly beat: IntroBeat; readonly t0: number; readonly t1: number }

type World = 'field' | 'gibeah';
interface Sec {
  i: number; beat: IntroBeat; t0: number; t1: number;
  /** all cue times in the section; `shots` = the cues that start a shot */
  marks: number[]; shots: number[];
  world: World; cut: string; dur: number;
  /** how the NEXT section comes in (drives this section's end envelope) */
  next: Entry | null; nextTau: number; nextBeat: IntroBeat | null; prevBeat: IntroBeat | null;
  /** a David shot cut into Saul's part of the film */
  intercut: boolean;
}
type Fn = (t: number, o: Out, hold: number) => void;
interface Ev { at: number; sec: number; hold: number; fn: Fn; thru: boolean }
interface Bus { g: GainNode; wet: GainNode; send: GainNode; out: Out; sec: number }

// Saul's theme: [midi, beats]
const SAUL_A: ReadonlyArray<readonly [number, number]> = [[50, 2], [57, 2], [58, 1.5], [57, 0.5], [55, 1], [53, 1]];
// David's motif (D A G F E F D) as [midi offset from tonic, units]
const DAVID_MOTIF: ReadonlyArray<readonly [number, number]> = [[0, 2], [7, 2], [5, 1], [3, 1], [2, 1], [3, 1], [0, 4]];
// Dorian answer phrase (A B C D C A G A), offsets from D
const DAVID_ANSWER: ReadonlyArray<readonly [number, number]> = [[-5, 1], [-3, 1], [-2, 1], [0, 2], [-2, 1], [-5, 1], [-7, 1], [-5, 3]];
const PAST_PROG: readonly ChordName[] = ['Dm', 'Dm', 'C', 'G', 'Dm', 'Am', 'G', 'Dm', 'Dm', 'F', 'C', 'G', 'Dm', 'C', 'Am', 'Dm'];
const ARP68: ReadonlyArray<readonly number[]> = [[0, 2, 4, 5, 4, 2], [0, 3, 2, 4, 3, 5], [0, -1, 2, 3, -1, 4], [0, 2, 1, 3, 2, 4]];

export class IntroScore {
  /** Called (slightly ahead, with the exact context time) when a section starts — used for auto-ambience. */
  onSection: ((beat: IntroBeat, t: number) => void) | null = null;
  /** Ambience bed changes requested by the score (section starts; the hinge's flight out of the window). */
  onAmbience: ((bed: BedName, fade: number, t: number) => void) | null = null;
  private secs: Sec[] = [];
  private evs: Ev[] = [];
  private ei = 0;
  private secFired = -1;
  private readonly buses = new Map<number, Bus>();
  private thruBus: Bus | null = null;
  private master: GainNode | null = null;
  private wetMaster: GainNode | null = null;
  private anchor = 0;
  private running = false;
  private endT = 0;
  private titleT = Infinity;
  private titleAt = -Infinity;
  private nextRetire = 0;
  private readonly dead: Array<{ t: number; nodes: AudioNode[] }> = [];
  private readonly ctx: BaseAudioContext;

  constructor(private readonly c: Core, private readonly s: Synth, private lite: boolean) {
    this.ctx = c.ctx;
  }

  get active(): boolean { return this.running; }
  /** Current intro time (s) according to the score clock. */
  time(now: number): number { return now - this.anchor; }
  /** Sections derived from the last cue sheet (for tools / debugging). */
  get sections(): readonly IntroSection[] { return this.secs; }
  setLite(on: boolean): void { this.lite = on; }

  // ---------------------------------------------------------------------------------- control

  start(cues: readonly IntroCue[], startAt: number, now: number, level = 0.92): void {
    if (this.running) this.stop(now, 0.3);
    this.secs = buildSections(cues);
    if (!this.secs.length) return;
    const t0 = clamp(Number.isFinite(startAt) ? startAt : 0, 0, this.secs[this.secs.length - 1].t1 - 0.5);
    this.evs = [];
    for (const sec of this.secs) this.plan(sec);
    this.evs.sort((a, b) => a.at - b.at);
    // starting mid-way: sustained beds already under way restart shortened; one-shots before t0 are dropped
    if (t0 > 0.05) {
      this.evs = this.evs.filter((e) => {
        if (e.at >= t0 - 0.02) return true;
        if (e.hold > 0 && e.at + e.hold > t0 + 0.6) { e.hold -= t0 - e.at; e.at = t0; return true; }
        return false;
      });
      this.evs.sort((a, b) => a.at - b.at);
    }
    this.ei = 0;
    this.anchor = now + 0.08 - t0;
    this.endT = this.secs[this.secs.length - 1].t1;
    const tsec = this.secs.find((x) => x.beat === 'title');
    this.titleT = tsec ? tsec.t0 : Infinity;
    this.titleAt = -Infinity;
    this.secFired = -1;
    while (this.secFired + 1 < this.secs.length && this.secs[this.secFired + 1].t1 <= t0) this.secFired++;
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = level;
    this.wetMaster = ctx.createGain(); this.wetMaster.gain.value = level;
    this.master.connect(this.c.musicIn); this.wetMaster.connect(this.c.hallIn);
    this.running = true;
  }

  /** Fade everything out over `fade` seconds; pending events are dropped. */
  stop(now: number, fade: number): void {
    if (!this.running || !this.master || !this.wetMaster) return;
    const f = Math.max(0.02, fade);
    for (const p of [this.master.gain, this.wetMaster.gain]) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(0, now, f / 4);
    }
    const nodes: AudioNode[] = [this.master, this.wetMaster];
    for (const b of this.buses.values()) nodes.push(b.g, b.wet, b.send);
    if (this.thruBus) nodes.push(this.thruBus.g, this.thruBus.wet, this.thruBus.send);
    this.dead.push({ t: now + f * 1.5 + 4, nodes });
    this.buses.clear(); this.thruBus = null;
    this.master = null; this.wetMaster = null;
    this.evs = []; this.ei = 0;
    this.running = false;
  }

  /**
   * Keep the score locked to the picture: `t` = the intro's own clock. Small drift is ignored;
   * beyond 0.25 s (hitches, a hidden tab) the future events are re-anchored.
   */
  sync(t: number, now: number): void {
    if (!this.running || !Number.isFinite(t)) return;
    const drift = now - this.anchor - t;
    if (Math.abs(drift) < 0.25) return;
    this.anchor = now - t;
    for (const b of this.buses.values()) this.envelope(b, now);
  }

  /**
   * The title card appeared (sfx('titleHit') during the intro). In sync: nothing to do (the score
   * plays its own hit). Ahead of the score (skip / hitch): jump to the title statement now.
   * Returns true when the call was absorbed by the score.
   */
  titleCue(now: number): boolean {
    if (!this.running || !Number.isFinite(this.titleT)) return false;
    if (now - this.titleAt < 5) return true; // already hit
    const due = this.anchor + this.titleT;
    if (due - now < 0.4) return true; // the score's own hit is (about to be) scheduled
    for (const b of this.buses.values()) {
      b.g.gain.cancelScheduledValues(now); b.g.gain.setValueAtTime(b.g.gain.value, now); b.g.gain.setTargetAtTime(0, now, 0.08);
      b.wet.gain.cancelScheduledValues(now); b.wet.gain.setValueAtTime(b.wet.gain.value, now); b.wet.gain.setTargetAtTime(0, now, 0.08);
      this.dead.push({ t: now + 5, nodes: [b.g, b.wet, b.send] });
    }
    this.buses.clear();
    this.anchor = now + 0.03 - this.titleT;
    this.evs = this.evs.filter((e) => e.at >= this.titleT - 0.01);
    this.ei = 0;
    while (this.secFired + 1 < this.secs.length && this.secs[this.secFired + 1].t0 < this.titleT) this.secFired++;
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
    const limit = horizon - this.anchor;
    let guard = 0;
    while (this.ei < this.evs.length && this.evs[this.ei].at <= limit && guard++ < 48) {
      const e = this.evs[this.ei++];
      const t = Math.max(now + 0.004, e.at + this.anchor);
      const bus = e.thru ? this.thru() : this.bus(e.sec, now);
      if (!bus) continue;
      try { e.fn(t, bus.out, Math.max(0.2, e.hold)); } catch { /* a bad event must not stop the score */ }
    }
    while (this.secFired + 1 < this.secs.length && this.secs[this.secFired + 1].t0 + this.anchor <= now + 0.1) {
      const sec = this.secs[++this.secFired];
      if (this.onSection) { try { this.onSection(sec.beat, Math.max(now, sec.t0 + this.anchor)); } catch { /* ignore */ } }
    }
    // retire the buses of finished sections (checked twice a second)
    if (now >= this.nextRetire) this.retire(now);
    if (this.ei >= this.evs.length && now > this.anchor + this.endT + 6) {
      const nodes: AudioNode[] = [];
      if (this.master) nodes.push(this.master);
      if (this.wetMaster) nodes.push(this.wetMaster);
      for (const b of this.buses.values()) nodes.push(b.g, b.wet, b.send);
      if (this.thruBus) nodes.push(this.thruBus.g, this.thruBus.wet, this.thruBus.send);
      this.dead.push({ t: now, nodes });
      this.buses.clear(); this.thruBus = null; this.master = null; this.wetMaster = null;
      this.running = false;
    }
  }

  private retire(now: number): void {
    this.nextRetire = now + 0.5;
    this.buses.forEach((b, i) => {
      const sec = this.secs[i];
      if (!sec || now > this.anchor + sec.t1 + 9) {
        this.dead.push({ t: now, nodes: [b.g, b.wet, b.send] });
        this.buses.delete(i);
      }
    });
  }

  // ---------------------------------------------------------------------------------- buses

  private makeBus(sec: number): Bus | null {
    if (!this.master || !this.wetMaster) return null;
    const ctx = this.ctx;
    const g = ctx.createGain(), wet = ctx.createGain(), send = ctx.createGain();
    send.gain.value = 0.22;
    g.connect(this.master); g.connect(send); send.connect(this.wetMaster); wet.connect(this.wetMaster);
    return { g, wet, send, out: { dry: g, wet }, sec };
  }

  private thru(): Bus | null {
    if (!this.thruBus) this.thruBus = this.makeBus(-1);
    return this.thruBus;
  }

  private bus(i: number, now: number): Bus | null {
    let b = this.buses.get(i);
    if (!b) {
      const nb = this.makeBus(i);
      if (!nb) return null;
      b = nb;
      const sec = this.secs[i];
      const lvl = sec ? (sec.intercut ? INTERCUT_LEVEL : SEC_LEVEL[sec.beat]) : 1;
      b.g.gain.value = lvl; b.wet.gain.value = lvl;
      this.buses.set(i, b);
      this.envelope(b, now);
    }
    return b;
  }

  /** Section bus envelope: hold, then cut / fade / crossfade at the section end depending on what follows. */
  private envelope(b: Bus, now: number): void {
    const sec = this.secs[b.sec];
    if (!sec) return;
    const t1 = Math.max(now + 0.05, this.anchor + sec.t1);
    for (const p of [b.g.gain, b.wet.gain]) {
      const v0 = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(v0, now);
      switch (sec.next) {
        case 'cut': p.setValueAtTime(v0, Math.max(now, t1 - 0.05)); p.linearRampToValueAtTime(0, t1 + 0.03); break;
        case 'hit': case 'soft': case 'x': p.setValueAtTime(v0, t1); p.setTargetAtTime(0, t1, sec.nextTau); break;
        default: break; // last section: rings out
      }
    }
  }

  // ---------------------------------------------------------------------------------- planning

  private add(sec: Sec, at: number, fn: Fn, hold = 0, thru = false): void {
    if (!Number.isFinite(at)) return;
    this.evs.push({ at, sec: sec.i, hold, fn, thru });
  }

  private plan(sec: Sec): void {
    const prev = this.secs[sec.i - 1];
    const bed = BEAT_BED[sec.beat];
    if (!prev || BEAT_BED[prev.beat] !== bed || prev.beat === 'hinge') {
      this.add(sec, sec.t0, (t) => { if (this.onAmbience) this.onAmbience(bed, sec.i === 0 ? 0.8 : BED_FADE[ENTRY[sec.beat]], t); }, sec.t1 - sec.t0);
    }
    switch (sec.beat) {
      case 'judea': this.planJudea(sec); break;
      case 'gibeah': this.planGibeah(sec); break;
      case 'saul-court': this.planCourt(sec); break;
      case 'saul-portrait': this.planPortrait(sec); break;
      case 'warriors': this.planWarriors(sec); break;
      case 'saul-hall': this.planHall(sec); break;
      case 'hinge': this.planHinge(sec); break;
      case 'bethlehem': case 'rachel': case 'flock': case 'david':
        if (sec.intercut) this.planIntercut(sec);
        else this.planPastoral(sec);
        break;
      case 'title': this.planTitle(sec); break;
    }
    // riser into an arrival (the hinge and the crane build their own; Saul's portrait cuts in hard)
    const d = sec.t1 - sec.t0;
    const own = sec.beat === 'hinge' || (sec.beat === 'david' && sec.nextBeat === 'title');
    if (sec.next === 'hit' && !own && sec.nextBeat !== 'saul-portrait' && d > 2.2) {
      const warm = sec.world === 'field' && sec.nextBeat !== 'gibeah';
      const len = Math.min(2.6, d * 0.4);
      this.add(sec, sec.t1 - len, (t, o) => riserFx(this.c, this.s, o, t, len, warm ? 'warm' : 'dark', 0.8, this.lite));
    }
  }

  // -- the land ---------------------------------------------------------------------------
  private planJudea(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0;
    const S = this.s, lite = this.lite;
    this.add(sec, t0, (t, o, h) => S.pad(o, t, h + 3, [38, 45], {
      level: 0.085, attack: 4, release: 3, cutoff: 380, cutoffEnd: 520, voices: lite ? 2 : 3, detune: 6, lfoCents: 250,
    }), d);
    const call = Math.max(t0 + 0.6, sec.marks[0] - 0.1);
    this.add(sec, call, (t, o) => {
      const f = this.far(o, t, 9, 2600, 0.5, 0.5);
      S.ney(f, t, notes([[69, 0.9], [74, 1.35], [76, 0.16], [74, 0.2], [69, 1.7]]), 0.14);
    });
    if (d > 4) {
      this.add(sec, t0 + 2.4, (t, o, h) => S.choir(o, t, h + 1.2, lite ? [50, 57] : [50, 57, 62], {
        level: 0.03, attack: 3, release: 2.2, vowel: 'oo', breath: 0.08,
      }), d - 2.4);
    }
    if (d > 7) {
      this.add(sec, call + 4.3, (t, o) => {
        const f = this.far(o, t, 7, 1900, 0.6, 0.6);
        S.ney(f, t, notes([[72, 0.45], [74, 0.5], [69, 1.9]]), 0.085);
      });
    }
  }

  // -- Saul -------------------------------------------------------------------------------
  private planGibeah(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0, S = this.s, lite = this.lite;
    this.add(sec, t0, (t, o) => this.hit(o, t, 0.55, false));
    this.add(sec, t0, (t, o, h) => S.pad(o, t, h + 2.5, lite ? [26, 38] : [26, 38, 45], {
      level: 0.11, attack: 1.4, release: 2.5, cutoff: 300, cutoffEnd: 520, voices: lite ? 2 : 3, detune: 7, lfoCents: 300,
    }), d);
    this.add(sec, t0 + 0.25, (t, o, h) => S.choir(o, t, h + 1.5, [45, 50, 57], {
      level: 0.05, attack: 2.4, release: 2.2, vowel: 'oh', breath: 0.06,
    }), d - 0.25);
    // Saul "blew the shofar throughout the land" (1 Sam 13:3): distant tekiah from the walls
    if (d > 2.5) this.add(sec, t0 + 1.3, (t, o) => { S.shofar(this.far(o, t, 7, 2400, 0.35, 0.8), t, 'tekiah', 0.24, 220, 293.66); });
    // the royal pulse begins: taiko on 1, deep tof on 2
    const nb = Math.floor((sec.t1 - (t0 + 2.2)) / BEAT_SAUL);
    for (let j = nb; j >= 1; j--) {
      const tt = sec.t1 - j * BEAT_SAUL, taiko = j % 2 === 0, grow = 1 - j / Math.max(1, nb);
      this.add(sec, tt, (t, o) => {
        if (taiko) S.drum(o, t, 'taiko', 0.2 + 0.2 * grow, 0);
        else S.drum(o, t, 'dum', 0.2 + 0.08 * grow, -0.1);
      });
    }
    if (d > 4.5) this.add(sec, t0 + 3.0, (t, o) => this.line(o, t, [[50, 2], [57, 2.6]], BEAT_SAUL, 0.055, 'str'));
  }

  private planCourt(sec: Sec): void {
    const t0 = sec.t0, S = this.s, lite = this.lite;
    const chords: readonly ChordName[] = ['Dm', 'F', 'Bb', 'C'];
    const nBeats = Math.max(2, Math.floor((sec.t1 - t0) / BEAT_SAUL));
    for (let k = 0; k < nBeats; k++) {
      const tt = t0 + k * BEAT_SAUL, kk = k;
      const ch = CHORDS[chords[Math.floor(k / 2) % chords.length]];
      if (k % 2 === 0) {
        this.add(sec, tt, (t, o) => {
          S.pad(o, t, BEAT_SAUL * 2 + 0.9, voicing(ch, 45, 62).slice(0, lite ? 3 : 4), {
            level: 0.05, attack: 0.6, release: 0.9, cutoff: 1100, voices: lite ? 2 : 3, detune: 9,
          });
          S.choir(o, t, BEAT_SAUL * 2 + 0.6, voicing(ch, 43, 57).slice(0, 3), { level: 0.05, attack: 0.5, release: 0.8, vowel: 'oh' });
          S.drum(o, t, 'taiko', 0.44, 0);
          S.drum(o, t, 'dum', 0.3, -0.12);
        });
      } else {
        this.add(sec, tt, (t, o) => {
          S.drum(o, t, 'dum', 0.3, -0.12);
          S.drum(o, t + BEAT_SAUL * 0.5, 'tek', 0.1, 0.2);
        });
      }
      this.add(sec, tt, (t, o) => S.strStac(o, t, rootIn(ch, 33) + (kk % 2 ? 12 : 0), kk % 2 ? 0.34 : 0.5, 0.55, 0.45));
    }
    this.add(sec, t0 + 0.05, (t, o) => {
      this.line(o, t, SAUL_A, BEAT_SAUL, 0.06, 'str');
      this.line(o, t + 0.02, SAUL_A.map(([m, b]) => [m - 12, b] as const), BEAT_SAUL, 0.045, 'men');
    });
  }

  private planPortrait(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0, S = this.s, lite = this.lite;
    // A (the dominant, awe) -> Dm (shofar gedolah over it) -> Bb -> C ... looped if the section is long
    const seq: ReadonlyArray<readonly [ChordName, number]> = [['A', 1.9], ['Dm', 1.9], ['Bb', 1.7], ['C', 1.7], ['Dm', 1.9], ['Bb', 1.7], ['A', 1.9]];
    let tt = t0, i = 0;
    while (tt < sec.t1 - 0.8 && i < 14) {
      const [cn, len] = seq[i % seq.length];
      const ch = CHORDS[cn], first = i === 0;
      const dur = Math.min(len, sec.t1 - tt);
      this.add(sec, tt, (t, o) => {
        S.choir(o, t, dur + 0.9, voicing(ch, 45, 69).slice(0, lite ? 4 : 6), {
          level: first ? 0.12 : 0.085, attack: first ? 0.06 : 0.35, release: 1.2, vowel: 'ah', breath: 0.14,
        });
        S.pad(o, t, dur + 0.8, [rootIn(ch, 26), rootIn(ch, 38), rootIn(ch, 38) + 7], {
          level: first ? 0.12 : 0.09, attack: first ? 0.05 : 0.3, release: 1, cutoff: first ? 1600 : 1000, cutoffEnd: 600, voices: lite ? 2 : 3, detune: 10,
        });
        S.drum(o, t, 'taiko', first ? 0.6 : 0.36, 0);
        if (!first) S.drum(o, t + BEAT_SAUL, 'dum', 0.28, -0.1);
      });
      tt += len; i++;
    }
    this.add(sec, t0, (t, o) => this.hit(o, t, 0.75, true));
    this.add(sec, t0, (t, o) => this.line(o, t, [[52, 2], [50, 4]], BEAT_SAUL, 0.07, 'str'));
    // the king's horn, near and bright
    if (d > 3) this.add(sec, t0 + 1.9, (t, o) => { S.shofar(o, t, 'gedolah', 0.3, 220, 293.66); });
  }

  private planWarriors(sec: Sec): void {
    const t0 = sec.t0, S = this.s, lite = this.lite;
    const st = 60 / 92 / 4;
    const pat = 'B.Tk.kT.Dk.kT.k.';
    const OST = [0, 0, 12, 0, 0, 12, 7, 12];
    const bars: readonly ChordName[] = ['Dm', 'Eb', 'Dm', 'C'];
    const end = sec.t1 - 0.35;
    const n = Math.floor((end - t0) / st);
    for (let k = 0; k < n; k++) {
      const tt = t0 + k * st, kk = k, bar = Math.floor(k / 16), s16 = k % 16;
      const ch = CHORDS[bars[bar % bars.length]];
      const root = rootIn(ch, 33);
      const c = pat[s16];
      this.add(sec, tt, (t, o) => {
        const dry: Out = { dry: o.dry, wet: null };
        switch (c) {
          case 'B': S.drum(o, t, 'taiko', 0.42, 0); S.drum(dry, t, 'dum', 0.45, -0.1); break;
          case 'D': S.drum(dry, t, 'dum', 0.42, -0.1); break;
          case 'T': S.drum(dry, t, 'tek', 0.34, 0.15); break;
          case 'k': if (!lite || chance(0.5)) S.drum(dry, t, 'ka', rand(0.14, 0.22), 0.25); break;
        }
        if (kk % 2 === 0) S.strStac(dry, t, root + OST[(kk / 2) % 8], (kk / 2) % 4 === 0 ? 0.62 : 0.45, 0.17, 0.8);
        if (s16 === 0) {
          S.choir(o, t, 0.95, voicing(ch, 50, 67).slice(0, lite ? 3 : 4), { level: 0.075, attack: 0.03, release: 0.5, vowel: 'ah' });
          S.pad(o, t, st * 16 + 0.3, [root + 12, root + 19], { level: 0.035, attack: 0.1, release: 0.4, cutoff: 1000, voices: 2, detune: 12 });
        }
      });
    }
    if (sec.t1 - t0 > 2) this.add(sec, t0 + 0.55, (t, o) => { S.shofar(this.far(o, t, 5, 2200, 0.4, 0.6), t, 'shevarim', 0.2, 220, 293.66); });
    // a last stroke that rings into the silence of the hall (routed around the section cut)
    if (sec.next === 'cut') {
      this.add(sec, sec.t1 - 0.06, (t, o) => { this.s.drum(o, t, 'taiko', 0.55, 0); this.s.drum(o, t, 'boom', 0.3, 0); }, 0, true);
    }
  }

  private planHall(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0, S = this.s, lite = this.lite;
    this.add(sec, t0 + 0.35, (t, o, h) => S.pad(o, t, h + 2.5, [38, 45], {
      level: 0.075, attack: 2.2, release: 2.5, cutoff: 260, cutoffEnd: 340, voices: lite ? 2 : 3, detune: 6, lfoCents: 200,
    }), d);
    if (!lite && d > 3) {
      this.add(sec, t0 + 1.0, (t, o, h) => S.pad(o, t, h + 1.5, [74, 75], {
        level: 0.011, attack: 3, release: 2, cutoff: 2400, voices: 2, detune: 5, trem: 0.5, tremRate: 5.5,
      }), d - 1);
    }
    // Saul's theme, slowed to a sigh (the cello)
    this.add(sec, t0 + 1.1, (t, o) => this.line(o, t, [[50, 2], [57, 2], [58, 1.5], [57, 3]], 0.68, 0.05, 'cello'));
    // a slow heartbeat on the deep frame drum
    for (let tt = t0 + 2.0; tt < sec.t1 - 0.5; tt += 1.65) this.add(sec, tt, (t, o) => S.drum({ dry: o.dry, wet: null }, t, 'dum', 0.16, 0));
    // humming lament in the Freygish colour ("and Samuel mourned for Saul")
    if (d > 4) {
      const beat = clamp((d - 2.6) / 9, 0.3, 0.5);
      this.add(sec, t0 + 2.4, (t, o) => this.line(o, t,
        [[69, 1], [70, 1], [69, 0.5], [67, 0.5], [66, 1], [67, 0.5], [66, 0.5], [63, 1], [62, 3]], beat, 0.03, 'hum'));
    }
  }

  // -- the hinge: 15:28 --------------------------------------------------------------------
  private planHinge(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0, S = this.s, lite = this.lite;
    this.add(sec, t0 - 0.55, (t, o) => robeTearFx(this.c, o, t), 0, true);
    this.add(sec, t0, (t, o, h) => S.choir(o, t, h, [50, 57, 63], { level: 0.04, attack: 1.2, release: 1.2, vowel: 'oo', breath: 0.1 }), d * 0.5);
    this.add(sec, t0 + 0.2, (t, o, h) => S.pad(o, t, h + 1, [26, 38], { level: 0.1, attack: 1.2, release: 1.5, cutoff: 260, voices: 2, detune: 6 }), d * 0.6);
    // the flight south: Bb -> C swelling into Bethlehem's open D (the wind of the hills comes in)
    const f0 = t0 + d * 0.42, fl = sec.t1 - f0;
    this.add(sec, f0, (t) => { if (this.onAmbience) this.onAmbience('fields', 2.5, t); }, sec.t1 - f0);
    if (fl > 1) {
      const half = fl / 2;
      this.add(sec, f0, (t, o) => {
        S.choir(o, t, half + 0.5, [46, 53, 58, 62, 65].slice(0, lite ? 4 : 5), { level: 0.07, attack: half, release: 0.6, vowel: 'oo', to: 'ah', morph: half });
        S.pad(o, t, half + 0.4, [34, 46, 53, 58], { level: 0.07, attack: half, release: 0.4, cutoff: 900, cutoffEnd: 1800, voices: lite ? 2 : 3, detune: 9 });
      });
      this.add(sec, f0 + half, (t, o) => {
        S.choir(o, t, half + 0.3, [48, 55, 60, 64, 67].slice(0, lite ? 4 : 5), { level: 0.11, attack: half * 0.9, release: 0.3, vowel: 'ah', breath: 0.16 });
        S.pad(o, t, half + 0.2, [36, 48, 55, 60], { level: 0.1, attack: half * 0.9, release: 0.25, cutoff: 1600, cutoffEnd: 3600, voices: lite ? 2 : 3, detune: 10 });
      });
      this.add(sec, sec.t1 - Math.min(2.6, fl), (t, o) => riserFx(this.c, this.s, o, t, Math.min(2.6, fl), 'warm', 1, this.lite));
      // drum roll gathering speed
      const rl = Math.min(1.6, fl);
      for (let k = 0, tt = sec.t1 - rl; tt < sec.t1 - 0.05 && k < 24; k++) {
        const u = 1 - (sec.t1 - tt) / rl;
        this.add(sec, tt, (t, o) => S.drum({ dry: o.dry, wet: null }, t, u > 0.7 ? 'dum' : 'ka', 0.1 + 0.35 * u, (k % 2 ? 0.2 : -0.2)));
        tt += lerpN(0.2, 0.07, u);
      }
    }
  }

  // -- David ------------------------------------------------------------------------------
  private planPastoral(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0, S = this.s, lite = this.lite;
    const beat = sec.beat;
    let r = sec.i;
    while (r > 0 && PASTORAL.has(this.secs[r - 1].beat) && !this.secs[r - 1].intercut) r--;
    const P0 = this.secs[r].t0;
    if (beat === 'bethlehem' || !this.secs[sec.i - 1] || !PASTORAL.has(this.secs[sec.i - 1].beat) || this.secs[sec.i - 1].intercut) {
      // arrival on the open D (no third yet): warm bloom, soft drum
      this.add(sec, t0, (t, o) => {
        S.pad(o, t, 4.5, [38, 45, 50, 57], { level: 0.1, attack: 0.08, release: 3, cutoff: 1900, cutoffEnd: 650, voices: lite ? 2 : 3, detune: 8 });
        S.choir(o, t, 3.8, [50, 57, 62, 69], { level: 0.085, attack: 0.06, release: 2.6, vowel: 'ah', breath: 0.12 });
        S.drum(o, t, 'taiko', 0.32, 0);
        S.drum(o, t, 'boom', 0.28, 0);
      });
    }
    // drone bed
    this.add(sec, t0 + 0.15, (t, o, h) => S.pad(o, t, h + 2, [38, 45], {
      level: beat === 'rachel' ? 0.05 : 0.06, attack: 2.2, release: 2, cutoff: 480, voices: lite ? 2 : 3, detune: 6, lfoCents: 300,
    }), d);
    // the kinnor, on one 6/8 grid shared by the whole pastoral block
    const lyreFrom = beat === 'bethlehem' ? t0 + 1.36 : t0;
    const kStart = Math.ceil((lyreFrom - P0) / STEP68 - 1e-6);
    for (let k = kStart; P0 + k * STEP68 < sec.t1 - 0.05; k++) {
      const tt = P0 + k * STEP68, bar = Math.floor(k / 6), s6 = k % 6;
      const ch = CHORDS[PAST_PROG[bar % PAST_PROG.length]];
      const pat = ARP68[bar % ARP68.length];
      const sparse = beat === 'rachel';
      if (sparse && s6 !== 0 && s6 !== 3) continue;
      const idx = pat[s6];
      if (idx < 0) continue;
      this.add(sec, tt, (t, o) => {
        const ns = voicing(ch, 57, 81);
        const m = ns[Math.min(ns.length - 1, idx)];
        const vel = (s6 === 0 ? 0.62 : s6 === 3 ? 0.52 : 0.4) * rand(0.9, 1.08) * (beat === 'david' ? 1.1 : 1);
        if (s6 === 0) S.lyre(o, t + rand(-0.006, 0.006), rootIn(ch, 43), 0.36, -0.3);
        if (s6 === 0 && beat === 'david') S.strum(o, t, ns.slice(0, 3), vel);
        else S.lyre(o, t + rand(-0.006, 0.006), m, vel, lyrePan(m));
        if (beat === 'flock' || beat === 'david') {
          const dry: Out = { dry: o.dry, wet: null };
          if (s6 === 0) S.drum(dry, t, 'dum', 0.16, -0.1);
          else if (s6 === 3) S.drum(dry, t, 'tek', 0.08, 0.15);
          else if (s6 === 5 && chance(0.6)) S.drum(dry, t, 'ka', 0.06, 0.2);
        }
      });
    }
    switch (beat) {
      case 'bethlehem':
        if (d > 5.5) this.add(sec, t0 + 2.04, (t, o) => { S.ney(o, t, motif(74, DAVID_MOTIF, STEP68), 0.15); });
        break;
      case 'rachel':
        this.add(sec, t0 + 0.4, (t, o) => this.line(o, t, [[69, 1.5], [67, 0.5], [65, 1], [64, 1], [62, 2.5]], clamp((d - 1) / 7, 0.45, 0.8), 0.034, 'hum'));
        if (d > 4) this.add(sec, t0 + d * 0.5, (t, o) => S.pad(o, t, d * 0.5 + 1, [46, 53, 58], { level: 0.028, attack: 1.8, release: 1.6, cutoff: 900, voices: 2, detune: 7 }));
        break;
      case 'flock':
        if (d > 5) {
          this.add(sec, t0 + 0.68, (t, o) => {
            S.ney(o, t, notes([[69, 0.34], [71, 0.34], [72, 0.68], [71, 0.17], [72, 0.17], [74, 0.68], [72, 0.34], [71, 0.34], [69, 1.36]]), 0.14);
          });
        }
        break;
      case 'david': {
        // the portrait of the shepherd (mirror of Saul's): his theme in full, then the crane swells to the title
        const toTitle = sec.nextBeat === 'title';
        const crane = !toTitle ? sec.t1 + 1 : sec.shots.length > 1 ? sec.shots[1] : sec.marks.length > 1 && !sec.shots.length ? sec.marks[1] : t0 + d * 0.62;
        this.add(sec, t0, (t, o) => S.pad(o, t, Math.min(crane, sec.t1) - t0 + 1, [50, 57, 62, 65], { level: 0.045, attack: 2, release: 1.2, cutoff: 1300, voices: lite ? 2 : 3, detune: 9 }));
        this.add(sec, t0 + 0.34, (t, o) => {
          const u = clamp((crane - t0 - 0.6) / 12, 0.26, STEP68);
          S.ney(o, t, [...motif(74, DAVID_MOTIF, u), ...motif(74, DAVID_ANSWER, u)], 0.16);
        });
        if (!lite) this.add(sec, t0 + 1.8, (t, o) => S.choir(o, t, Math.min(crane, sec.t1) - t0 - 1, [57, 62, 69], { level: 0.028, attack: 2.2, release: 1.4, vowel: 'oo' }));
        const sw = sec.t1 - crane;
        if (toTitle && sw > 1) {
          const half = sw / 2;
          this.add(sec, crane, (t, o) => {
            S.choir(o, t, half + 0.4, [43, 50, 55, 59, 62].slice(0, lite ? 4 : 5), { level: 0.1, attack: half, release: 0.5, vowel: 'oh', to: 'ah', morph: half });
            S.pad(o, t, half + 0.3, [31, 43, 50, 55], { level: 0.09, attack: half, release: 0.35, cutoff: 900, cutoffEnd: 2200, voices: lite ? 2 : 3, detune: 9 });
          });
          this.add(sec, crane + half, (t, o) => {
            S.choir(o, t, half + 0.2, [45, 52, 57, 61, 64].slice(0, lite ? 4 : 5), { level: 0.17, attack: half * 0.9, release: 0.2, vowel: 'ah', breath: 0.18 });
            S.pad(o, t, half + 0.15, [33, 45, 52, 57], { level: 0.14, attack: half * 0.9, release: 0.2, cutoff: 1700, cutoffEnd: 4500, voices: lite ? 2 : 3, detune: 10 });
            S.drum(o, t, 'taiko', 0.3, 0);
          });
          this.add(sec, sec.t1 - Math.min(2.8, sw), (t, o) => riserFx(this.c, this.s, o, t, Math.min(2.8, sw), 'warm', 1.1, this.lite));
          const rl = Math.min(2, sw);
          for (let k = 0, tt = sec.t1 - rl; tt < sec.t1 - 0.05 && k < 28; k++) {
            const u = 1 - (sec.t1 - tt) / rl;
            this.add(sec, tt, (t, o) => this.s.drum({ dry: o.dry, wet: null }, t, u > 0.6 ? 'dum' : 'ka', 0.1 + 0.4 * u, k % 2 ? 0.25 : -0.25));
            tt += lerpN(0.22, 0.06, u);
          }
        }
        break;
      }
      default: break;
    }
  }

  /**
   * A David shot cut into Saul's part: intimate and bare (drone, a few kinnor strings, the pipe or a
   * humming voice) — the contrast with the king's drums is the point. The first intercut states
   * David's motif for the first time; later ones answer it.
   */
  private planIntercut(sec: Sec): void {
    const d = sec.t1 - sec.t0, t0 = sec.t0, S = this.s, lite = this.lite;
    const nth = this.secs.filter((x) => x.intercut && x.i < sec.i).length;
    this.add(sec, t0, (t, o, h) => S.pad(o, t, h + 1.5, [38, 45], {
      level: 0.055, attack: 1.2, release: 1.5, cutoff: 520, voices: lite ? 2 : 3, detune: 6, lfoCents: 250,
    }), d);
    const prog: readonly ChordName[] = nth === 0 ? ['Dm', 'C', 'G', 'Dm'] : ['Dm', 'F', 'C', 'Dm'];
    for (let k = 0; t0 + k * STEP68 < sec.t1 - 0.3; k++) {
      const s6 = k % 6, bar = Math.floor(k / 6);
      if (s6 !== 0 && s6 !== 2 && s6 !== 3 && s6 !== 5) continue;
      const ch = CHORDS[prog[bar % prog.length]];
      const idx = [0, 2, 4, 5, 4, 2][s6];
      this.add(sec, t0 + k * STEP68, (t, o) => {
        const ns = voicing(ch, 57, 81);
        const m = ns[Math.min(ns.length - 1, idx)];
        if (s6 === 0) S.lyre(o, t, rootIn(ch, 43), 0.3, -0.3);
        S.lyre(o, t + rand(-0.006, 0.006), m, (s6 === 0 ? 0.5 : 0.36) * rand(0.9, 1.08), lyrePan(m));
      });
    }
    if (nth === 0) {
      // the first sight of David: his motif on the pipe, unadorned
      const u = clamp((d - 1.6) / 13, 0.28, STEP68 * 1.15);
      this.add(sec, t0 + 0.9, (t, o) => { S.ney(o, t, motif(74, DAVID_MOTIF, u), 0.15); });
    } else {
      // tenderness (the lamb): a humming voice, then the pipe's answer phrase
      this.add(sec, t0 + 0.3, (t, o) => this.line(o, t, [[62, 1.5], [65, 1], [64, 1], [62, 2.5]], clamp((d - 1) / 10, 0.4, 0.62), 0.03, 'hum'));
      if (d > 4.5) {
        const u = clamp((d - 3.2) / 11, 0.24, STEP68);
        this.add(sec, t0 + 2.6, (t, o) => { S.ney(o, t, motif(74, DAVID_ANSWER, u), 0.13); });
      }
    }
  }

  private planTitle(sec: Sec): void {
    const t0 = sec.t0, S = this.s, lite = this.lite;
    this.add(sec, t0, (t, o) => {
      this.titleAt = t;
      this.hit(o, t, 1, true);
      S.choir(o, t + 0.02, 5.5, lite ? [50, 57, 62, 66] : [50, 57, 62, 66, 69, 74], { level: 0.3, attack: 0.08, release: 3.2, vowel: 'ah', breath: 0.2 });
      S.pad(o, t, 5, [26, 38, 45, 50], { level: 0.2, attack: 0.05, release: 3, cutoff: 1500, cutoffEnd: 520, voices: lite ? 2 : 3, detune: 10 });
      S.shofar(o, t + 0.16, 'tekiah', 0.34, 220, 293.66);
    });
    // David's theme resolved (D major), pipe + kinnor, over D | G | A | D — fitted to the title shot
    const tl = sec.dur > 0 ? sec.dur : TITLE_LEN;
    const u = clamp((tl - 2.2) / 12, 0.3, 0.46), m0 = t0 + 1.2;
    this.add(sec, m0, (t, o) => {
      S.ney(o, t, motifMajor(74, u), 0.17);
      const mel = motifMajor(62, u);
      let x = 0;
      for (const n of mel) { if (n.midi >= 0) S.lyre(o, t + x, n.midi, 0.5, lyrePan(n.midi)); x += n.dur; }
    });
    const chords: ReadonlyArray<readonly [number, readonly number[], number]> = [
      [0, [38, 50, 54, 57, 62], 4], [4, [43, 50, 55, 59, 62], 2], [6, [45, 52, 57, 61, 64], 2], [8, [38, 50, 54, 57, 62], 6],
    ];
    for (const [at, ns, len] of chords) {
      this.add(sec, m0 + at * u, (t, o) => {
        S.choir(o, t, len * u + 0.8, ns.slice(1), { level: 0.07, attack: 0.5, release: 1, vowel: 'oh', breath: 0.08 });
        S.pad(o, t, len * u + 0.8, [ns[0], ns[0] + 7, ns[0] + 12], { level: 0.07, attack: 0.4, release: 1, cutoff: 1100, voices: lite ? 2 : 3, detune: 8 });
        S.strum(o, t, voicing(ns.map((m) => pcOf(m)), 57, 74).slice(0, 4), 0.55);
        S.drum(o, t, 'taiko', 0.22, 0);
      });
    }
    // the last note: a long, open D major that rings past the cut (the game fades it with stopIntro)
    this.add(sec, m0 + 8 * u, (t, o) => {
      S.choir(o, t, 6, [50, 54, 57, 62, 66].slice(0, lite ? 4 : 5), { level: 0.08, attack: 0.5, release: 4, vowel: 'oh', to: 'oo', morph: 4 });
      S.pad(o, t, 6.5, [26, 38, 45, 50], { level: 0.08, attack: 0.4, release: 4.2, cutoff: 900, cutoffEnd: 380, voices: lite ? 2 : 3, detune: 7 });
      S.strum(o, t + 0.02, [50, 54, 57, 62, 66], 0.5, 0.06);
    });
  }

  // ---------------------------------------------------------------------------------- instruments

  /** Legato line; `inst`: low strings, men's humming, a single cello, or a high humming voice. */
  private line(o: Out, t: number, ns: ReadonlyArray<readonly [number, number]>, beat: number, level: number,
    inst: 'str' | 'men' | 'cello' | 'hum'): void {
    let x = 0;
    for (const [m, b] of ns) {
      const d = b * beat;
      const tt = t + x;
      if (inst === 'str' || inst === 'cello') {
        this.s.pad(o, tt, d + 0.35, inst === 'str' ? [m, m - 12] : [m], {
          level, attack: Math.min(0.35, d * 0.35), release: 0.55, cutoff: inst === 'str' ? 1200 : 900, q: 1,
          voices: this.lite ? 2 : 3, detune: inst === 'str' ? 9 : 5, lfoCents: 120,
        });
      } else {
        this.s.choir(o, tt, d + 0.3, [m], {
          level, attack: Math.min(0.3, d * 0.4), release: 0.45, vowel: inst === 'men' ? 'oh' : 'oo', breath: inst === 'hum' ? 0.05 : 0.08,
        });
      }
      x += d;
    }
  }

  /** Output that sounds far away: lowpassed, with the valley echo and extra hall. */
  private far(o: Out, t: number, dur: number, lp: number, echo: number, hall: number): Out {
    const v = new Voice(this.c);
    const inp = v.gain(1), f = v.filter('lowpass', lp, 0.6), eg = v.gain(echo), hg = v.gain(hall);
    inp.connect(f); f.connect(o.dry);
    f.connect(eg); eg.connect(this.c.echoSend());
    if (o.wet) { f.connect(hg); hg.connect(o.wet); }
    v.play(t, t + dur);
    return { dry: inp, wet: null };
  }

  /** Arrival hit: sub boom + taiko pair + deep tof (+ a cymbal-like air wash when `big`). */
  private hit(o: Out, t: number, level: number, big: boolean): void {
    const S = this.s;
    S.drum(o, t, 'boom', 0.7 * level, 0);
    S.drum(o, t + 0.004, 'taiko', 0.85 * level, -0.3);
    S.drum(o, t + 0.02, 'taiko', 0.75 * level, 0.3);
    S.drum({ dry: o.dry, wet: null }, t, 'dum', 0.55 * level, 0);
    if (big) {
      const v = new Voice(this.c);
      const n = v.noise('white', t), hp = v.filter('highpass', 5500, 0.7), g = v.gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * level, t + 0.012); g.gain.setTargetAtTime(0, t + 0.012, 0.45);
      n.connect(hp); hp.connect(g); g.connect(o.dry);
      if (o.wet) g.connect(o.wet);
      v.play(t, t + 3);
    }
  }

}

/** Crescendo into an arrival: filtered noise sweep + reversed-cymbal air + (full tier) a rising cluster. */
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

/** The corner of the robe tears (1 Sam 15:27, Samuel's robe in Saul's grip), heard as a memory: a breath-in swell, then the rip. */
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
  // fibres parting: a rough, accelerating train of grains
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

const lerpN = (a: number, b: number, u: number): number => a + (b - a) * clamp(u, 0, 1);

function notes(ns: ReadonlyArray<readonly [number, number]>): NeyNote[] {
  return ns.map(([midi, dur]) => ({ midi, dur: dur * rand(0.97, 1.03) }));
}
function motif(tonic: number, m: ReadonlyArray<readonly [number, number]>, unit: number): NeyNote[] {
  return m.map(([o, u]) => ({ midi: tonic + o, dur: u * unit }));
}
/** David's motif in D major: D A G F# E F# D. */
function motifMajor(tonic: number, unit: number): NeyNote[] {
  const offs = [0, 7, 5, 4, 2, 4, 0], lens = [2, 2, 1, 1, 1, 1, 4];
  return offs.map((o, i) => ({ midi: tonic + o, dur: lens[i] * unit }));
}

/** How a section is entered (and how fast the previous one leaves), from the beat and the shot transition. */
function entryOf(sec: Sec, prev: Sec): { kind: Entry; tau: number } {
  const worldChange = prev.world !== sec.world;
  switch (sec.beat) {
    case 'title': case 'bethlehem': case 'gibeah': return { kind: 'hit', tau: 0.3 };
    case 'saul-portrait': return { kind: 'hit', tau: worldChange ? 0.05 : 0.3 };
    default: break;
  }
  switch (sec.cut) {
    case 'cut': return worldChange ? { kind: 'cut', tau: 0.05 } : { kind: 'x', tau: 0.8 };
    case 'match': return { kind: 'x', tau: 0.25 };
    case 'dissolve': return { kind: 'x', tau: 0.4 };
    case 'light': return { kind: 'hit', tau: 0.3 };
    case 'black': return { kind: 'soft', tau: 0.8 };
    default: break;
  }
  const k = ENTRY[sec.beat];
  return { kind: k, tau: k === 'cut' ? 0.05 : k === 'hit' ? 0.3 : 0.8 };
}

/** Sections from a cue sheet: consecutive cues with the same beat merge; the title rings for its shot. */
function buildSections(cues: readonly IntroCue[]): Sec[] {
  const sorted = [...(cues ?? [])].filter((c) => c && Number.isFinite(c.t) && c.beat in ENTRY).sort((a, b) => a.t - b.t);
  const out: Sec[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && last.beat === c.beat) {
      last.marks.push(c.t);
      if (c.shot) last.shots.push(c.t);
      continue;
    }
    if (last) last.t1 = c.t;
    const world: World = c.world === 'gibeah' || c.world === 'field' ? c.world : GIBEAH_BEATS.has(c.beat) ? 'gibeah' : 'field';
    out.push({
      i: out.length, beat: c.beat, t0: c.t, t1: Infinity, marks: [c.t], shots: c.shot ? [c.t] : [], world,
      cut: c.cut ?? '', dur: 0, next: null, nextTau: 0.8, nextBeat: null, prevBeat: null, intercut: false,
    });
    if (c.dur !== undefined && Number.isFinite(c.dur)) out[out.length - 1].dur = c.dur;
  }
  if (!out.length) return out;
  out[0].t0 = Math.min(out[0].t0, 0); // the first section starts with the intro (pre-roll)
  const last = out[out.length - 1];
  last.t1 = last.t0 + (last.beat === 'title' ? (last.dur > 0 ? last.dur + 6 : TITLE_LEN + 6) : 8);
  for (let i = 0; i < out.length; i++) {
    const sec = out[i], nx = out[i + 1], pv = out[i - 1];
    sec.prevBeat = pv ? pv.beat : null;
    sec.nextBeat = nx ? nx.beat : null;
    if (nx) { const e = entryOf(nx, sec); sec.next = e.kind; sec.nextTau = e.tau; }
    sec.intercut = PASTORAL.has(sec.beat) && !!pv && !!nx && pv.world === 'gibeah' && nx.world === 'gibeah';
  }
  return out;
}
