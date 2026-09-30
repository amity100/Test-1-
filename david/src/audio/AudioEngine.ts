/**
 * DAVID — procedural audio engine (Web Audio API, zero audio files).
 *
 * Everything is synthesized at runtime: a generative cinematic score (kinnor/lyre via
 * Karplus-Strong, low strings, formant choir, frame drums & taiko, shofar, ney/chalil flute),
 * the score + sound design of the opening film, keyed on its shot sheet (IntroScore.ts +
 * FilmSound.ts), golden-hour ambience (wind, cicadas, birds) with named beds on top (Beds.ts:
 * fields, dawn / Gibeah exterior / Saul's hall / the film's heights, coast, Gilgal and hush) and all
 * gameplay SFX. Shared DSP, instruments and the Composer base live in synth.ts.
 *
 * Signal flow
 *
 *   mood composers ─► moodFader ─┐
 *   intro score (per-section buses) ─┴─► musicIn ─► musicDuck ─────┐
 *   film sound design (per-section) ─┐                            │
 *   world sfx ──┤                                                 │
 *   ambience + beds ─┴─► worldIn ─► slow-mo lowpass ──────────────┤
 *   ui / cinematic sfx ─► uiIn ───────────────────────────────────┤
 *   sends ─► hallIn ─► convolver (generated IR; 1.8 s on phones) ─┤
 *   sends ─► echoIn ─► ping-pong "valley" echo ───────────────────┤
 *                                                                 ▼
 *              sum ─► glue compressor ─► master ─► mute ─► limiter ─► soft clip ─► out
 *
 * One-shot voices are built from short-lived nodes that are stopped at their end time and
 * disconnected by a periodic sweeper; music is scheduled ahead on the AudioContext clock.
 * AudioEngine.renderOffline() runs the same graph on an OfflineAudioContext (dev/score.html).
 */

// ============================================================================
// Public types
// ============================================================================

export type MusicMood = 'silence' | 'title' | 'pastoral' | 'tension' | 'battle' | 'victory';

export type SfxName =
  | 'footstep' | 'footstepRun' | 'slingRelease' | 'stoneHit' | 'stoneHitBear' | 'jarShatter'
  | 'sheepBleat' | 'lambBleat' | 'goatBleat' | 'bearRoar' | 'bearGrowl' | 'bearHurt' | 'bearDeath'
  | 'staffHit' | 'whoosh' | 'grab' | 'davidHurt' | 'davidEffort' | 'pickup' | 'uiObjective'
  | 'uiConfirm' | 'heartbeat' | 'impactBoom' | 'dodge' | 'titleHit' | 'shepherdCall' | 'shepherdWhistle'
  // cinematic extras (score pass): a dark hit + swell, a 2 s riser into a cut, the torn robe (1 Sam 15:27)
  | 'stinger' | 'riser' | 'robeTear';

/** volume 0..1 (default 1), pitch multiplier (default 1; slight randomization is added), pan -1..1 */
export interface SfxOptions { volume?: number; pitch?: number; pan?: number; }

export interface AmbienceLevels { wind?: number; cicadas?: number; birds?: number; }

import {
  clamp, lerp, expLerp, rand, randi, chance, white, fin,
  pick, NoiseKind, perc, contour, SmoothNoise, ChordName, CHORDS, SCALES,
  voicing, rootIn, degToMidi, lyrePan, bake, BankName, Core, Voice,
  Out, Synth, makeMelody, Composer, MOTIF_DEG, MOTIF_LEN,
} from './synth';
import { IntroScore, riserFx, robeTearFx } from './IntroScore';
import { Beds, BED_LEGACY, BED_NAMES, type BedName } from './Beds';
import type { IntroCue } from '../content/introScript';

export type { BedName } from './Beds';


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
    if (step === 0) { // the bear's arrival lands on a dark hit (around the mood's fade-in): sub boom + a low cluster
      const hit: Out = { dry: this.c.musicIn, wet: this.c.hallIn };
      s.drum(hit, t, 'boom', 0.5, 0);
      s.drum(hit, t + 0.01, 'taiko', 0.5, 0);
      s.pad(hit, t, 3.2, [26, 38, 39], { level: 0.13, attack: 0.02, release: 2.4, cutoff: 1500, cutoffEnd: 300, voices: 3, detune: 14 });
      s.choir(hit, t + 0.03, 2.6, [50, 51, 57], { level: 0.07, attack: 0.05, release: 2, vowel: 'oh', to: 'oo', morph: 2 });
    }
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
    if (k === 0 && bip === 0 && phrase === 1) {
      // leitmotif: David's theme in D major on the pipe (D A G F# E F# D), over D | G | D | A-D
      this.prog = ['D', 'G', 'D', 'D'];
      const u = this.stepDur * 2;
      const mel = [[74, 2], [81, 2], [79, 1], [78, 1], [76, 1], [78, 1], [74, 4]].map(([m, d]) => ({ midi: m, dur: d * u }));
      this.fluteEnd = s.ney(this.out, t, mel, 0.17);
    } else if (k === 0 && bip === 0 && phrase > 1) this.prog = pick(VICTORY_PROGS);
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
    bus.connect(c.ambIn);
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

  setLevels(l: { wind: number; cicadas: number; birds: number }, now: number, tau = 0.8): void {
    if (l.wind > 0 && !this.live.wind) { this.windBus.connect(this.bus); this.live.wind = true; }
    if (l.cicadas > 0 && !this.live.cicadas) { this.cicBus.connect(this.bus); this.live.cicadas = true; }
    if (l.wind <= 0 && this.level.wind !== 0) this.silentSince.wind = now;
    if (l.cicadas <= 0 && this.level.cicadas !== 0) this.silentSince.cicadas = now;
    if (l.wind !== this.level.wind) this.windBus.gain.setTargetAtTime(l.wind * WIND_GAIN, now, tau);
    if (l.cicadas !== this.level.cicadas) this.cicBus.gain.setTargetAtTime(l.cicadas * CICADA_GAIN, now, tau);
    if (l.birds !== this.level.birds) this.birdBus.gain.setTargetAtTime(l.birds * BIRD_GAIN, now, Math.min(0.5, tau));
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
const UI_SFX: ReadonlySet<string> = new Set<SfxName>([
  'uiObjective', 'uiConfirm', 'heartbeat', 'titleHit', 'shepherdCall', 'shepherdWhistle', 'stinger', 'riser', 'robeTear',
]);
/** [voice group, max concurrent] */
const SFX_LIMIT: Partial<Record<SfxName, readonly [string, number]>> = {
  footstep: ['step', 4], footstepRun: ['step', 4],
  sheepBleat: ['bleat', 4], lambBleat: ['bleat', 4], goatBleat: ['bleat', 4],
  bearRoar: ['bear', 2], bearGrowl: ['bear', 2], bearHurt: ['bearHurt', 2], bearDeath: ['bearDeath', 1],
  stoneHit: ['stone', 6], jarShatter: ['jar', 4], heartbeat: ['heart', 2], titleHit: ['title', 1], impactBoom: ['boom', 2],
  shepherdCall: ['call', 2], shepherdWhistle: ['call', 2],
  stinger: ['stinger', 2], riser: ['riser', 1], robeTear: ['tear', 1],
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
      stinger: (v, t, o, p, s) => this.stinger(v, t, o, p, s),
      riser: (v, t, o, p) => {
        const w = v.gain(0.5); w.connect(this.c.hallIn);
        const d = 2 / p;
        riserFx(this.c, this.syn, { dry: o, wet: w }, t, d, 'dark', 1.2, false);
        return t + d + 0.3;
      },
      robeTear: (v, t, o) => {
        const w = v.gain(0.6); w.connect(this.c.hallIn);
        robeTearFx(this.c, { dry: o, wet: w }, t);
        return t + 2;
      },
    };
  }

  play(name: SfxName, opts: SfxOptions | undefined, now: number, dest?: AudioNode): void {
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
    pn.connect(dest ?? (ui ? c.uiIn : c.sfxWorld));
    const sends: Sends = {
      hall: (a) => { if (a > 0) { const g = v.gain(a); pn.connect(g); g.connect(c.hallIn); } },
      echo: (a) => { if (a > 0) { const g = v.gain(a); pn.connect(g); g.connect(c.echoSend()); } },
    };
    const t = now + 0.012;
    const end = fn(v, t, inp, pitch, sends);
    v.play(t, Math.max(end, t + 0.05));
    list.push(end);
  }

  /** A soft footstep at time `t` into `dest` (ambience beds: people crossing a room). */
  stepAt(t: number, volume: number, pan: number, rate: number, dest: AudioNode): void {
    const v = new Voice(this.c);
    const g = v.gain(clamp(volume, 0, 1) * 1.3), lp = v.filter('lowpass', 2200, 0.6), pn = v.pan(clamp(pan, -1, 1));
    const e = this.sample(v, g, t, 'stepWalk', rate, 1);
    g.connect(lp); lp.connect(pn); pn.connect(dest);
    v.play(t, e + 0.05);
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

  /** Cinematic dark hit: sub boom, taiko pair, a low string cluster that blooms and sinks, a choir groan. */
  private stinger(v: Voice, t: number, o: AudioNode, p: number, s: Sends): number {
    const lo: Out = { dry: o, wet: null };
    const syn = this.syn;
    this.sample(v, o, t, 'boom', p, 0.8);
    syn.drum(lo, t + 0.005, 'taiko', 0.8, -0.25);
    syn.drum(lo, t + 0.018, 'taiko', 0.7, 0.25);
    syn.pad(lo, t, 3.2, [26, 38, 39, 45], { level: 0.2, attack: 0.02, release: 2.4, cutoff: 1600, cutoffEnd: 300, voices: 3, detune: 14 });
    syn.choir(lo, t + 0.02, 2.6, [50, 51, 57], { level: 0.12, attack: 0.05, release: 2, vowel: 'oh', to: 'oo', morph: 2 });
    syn.pad(lo, t + 0.1, 2.8, [74, 75], { level: 0.02, attack: 0.4, release: 1.8, cutoff: 2800, voices: 2, detune: 6, trem: 0.6, tremRate: 7 });
    s.hall(0.45); s.echo(0.1);
    return t + 5;
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
/** Level of the intro score bus (relative to the music bus). */
const INTRO_MIX = 0.92;
/** Phones / tablets get the light voicing (fewer oscillators per chord, fewer ambience events). */
function detectLite(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

export interface OfflineRenderOptions {
  seconds: number;
  sampleRate?: number;
  /** Phone voicing. */
  lite?: boolean;
  /** Called every `step` seconds of rendered time (and once at t = 0) to drive the engine like a game would. */
  script?: (engine: AudioEngine, t: number) => void;
  step?: number;
}

export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private rt: AudioContext | null = null;
  private core: Core | null = null;
  private lib: SfxLib | null = null;
  private syn: Synth | null = null;
  private amb: Ambience | null = null;
  private beds: Beds | null = null;
  private intro: IntroScore | null = null;
  private sling: SlingSpin | null = null;
  private title: TitleComposer | null = null;
  private readonly moods = new Map<MusicMood, Composer>();
  private _ready = false;
  private pending: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlock: (() => void) | null = null;
  private onVis: (() => void) | null = null;
  private vol = 0.8;
  private muted = false;
  private musicVol = 1;
  private sfxVol = 1;
  private mood: MusicMood = 'silence';
  private moodFade = 3;
  private readonly amblv = { wind: 0, cicadas: 0, birds: 0 };
  private bed: BedName = 'none';
  private bedFade = 1.5;
  private introPending: { cues: readonly IntroCue[]; startAt: number; at: number } | null = null;
  private introAutoAmb = true;
  private introStartedAt = -1;
  private lite = detectLite();
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
  get context(): AudioContext | null { return this.rt; }
  /** The last mood requested via setMusicMood. */
  get currentMood(): MusicMood { return this.mood; }
  /** True while the intro score is playing. */
  get introActive(): boolean { return !!this.intro && this.intro.active; }
  /** The current named ambience bed. */
  get ambienceBed(): BedName { return this.bed; }
  /** Live one-shot voices (each a handful of nodes) — a CPU-load indicator for tools. */
  get voices(): number { return this.core ? this.core.load() : 0; }

  /** Call from a user gesture. Creates/resumes the AudioContext and builds the graph. Safe to call repeatedly. */
  init(): Promise<void> {
    if (this._ready && this.rt) {
      if (this.rt.state !== 'running') return this.rt.resume().catch(() => undefined);
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
      // iOS 17+: play through the ring/silent switch like video does (a cinematic needs its sound)
      try {
        const nav = navigator as unknown as { audioSession?: { type: string } };
        if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
      } catch { /* not supported */ }
      let ctx: AudioContext;
      try { ctx = new Ctor({ latencyHint: 'interactive' }); } catch { ctx = new Ctor(); }
      // resume synchronously inside the gesture; never let a blocked resume hang init()
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
        resumed = Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 400))]);
      }
      this.rt = ctx;
      this.build(ctx);
      this.timer = setInterval(() => this.tick(), 40);
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const h = (): void => {
          const x = this.rt;
          // 'suspended' or iOS 'interrupted' (a call, Siri, another app): resume on the next gesture
          if (x && x.state !== 'running' && x.state !== 'closed') x.resume().catch(() => undefined);
        };
        for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, h, { capture: true, passive: true });
        this.unlock = h;
        if (typeof document !== 'undefined') {
          const v = (): void => { if (!document.hidden) h(); };
          document.addEventListener('visibilitychange', v);
          this.onVis = v;
        }
      }
      this.tick();
    } catch (e) {
      console.warn('[AudioEngine] init failed', e);
      this.teardown();
      return;
    }
    await resumed;
  }

  /** Build the whole graph on a (realtime or offline) context. */
  private build(ctx: BaseAudioContext): void {
    const core = new Core(ctx);
    core.irSeconds = this.lite ? 1.8 : 3.0;
    const syn = new Synth(core);
    this.ctx = ctx; this.core = core; this.syn = syn;
    this.title = new TitleComposer(core, syn, MOOD_MIX.title);
    this.moods.set('title', this.title);
    this.moods.set('pastoral', new PastoralComposer(core, syn, MOOD_MIX.pastoral));
    this.moods.set('tension', new TensionComposer(core, syn, MOOD_MIX.tension));
    this.moods.set('battle', new BattleComposer(core, syn, MOOD_MIX.battle));
    this.moods.set('victory', new VictoryComposer(core, syn, MOOD_MIX.victory));
    const lib = new SfxLib(core, syn);
    this.lib = lib;
    lib.onTitleHit = (t) => { if (this.title) this.title.reveal(t); };
    this.amb = new Ambience(core);
    const beds = new Beds(core, this.lite);
    beds.bleat = (kind, volume, pan, pitch, dest) => lib.play(kind, { volume, pan, pitch }, core.ctx.currentTime, dest);
    beds.step = (volume, pan, rate, t, dest) => lib.stepAt(t, volume, pan, rate, dest);
    this.beds = beds;
    const intro = new IntroScore(core, syn, this.lite);
    intro.onAmbience = (bed, fade, t) => { if (this.introAutoAmb) this.applyBed(bed, fade, t); };
    // the film's sound design borrows the flock and the heart from the SFX library, placed at exact times
    intro.fx.sfxAt = (name, t, volume, pan, pitch, dest) => lib.play(name, { volume, pan, pitch }, Math.max(ctx.currentTime, t - 0.012), dest);
    this.intro = intro;
    this.sling = new SlingSpin(core);
    core.master.gain.value = this.vol;
    core.mute.gain.value = this.muted ? 0 : 1;
    core.musicIn.gain.value = MUSIC_GAIN * this.musicVol;
    core.sfxWorld.gain.value = this.sfxVol;
    core.uiIn.gain.value = this.sfxVol;
    this._ready = true;
    this.lastTick = ctx.currentTime;
    this.nextWarm = ctx.currentTime + 0.05;
    this.amb.setLevels(this.amblv, ctx.currentTime);
    if (this.bed !== 'none') this.applyBed(this.bed, 0.5, ctx.currentTime);
    this.applyMood(this.moodFade);
    const p = this.introPending;
    this.introPending = null;
    if (p) {
      const late = (typeof performance !== 'undefined' ? performance.now() : 0) - p.at;
      this.playIntro(p.cues, p.startAt + Math.max(0, late / 1000));
    }
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

  /** Light voicing for phones (auto-detected; the game may force it from its quality tier). */
  setLite(on: boolean): void {
    this.lite = !!on;
    if (this.beds) this.beds.setLite(this.lite);
    if (this.intro) this.intro.setLite(this.lite);
  }

  /**
   * Crossfade to a mood (default ~3 s). Can be called before init(); applied once audio starts.
   * While the intro score plays, 'title' is absorbed (the intro *is* the title music); any other mood
   * ends the intro score with the same fade.
   */
  setMusicMood(mood: MusicMood, fadeSeconds = 3): void {
    const m: MusicMood = mood === 'title' || mood === 'pastoral' || mood === 'tension' || mood === 'battle' || mood === 'victory'
      ? mood : 'silence';
    const f = clamp(fin(fadeSeconds, 3), 0, 30);
    if (this.introActive || this.introPending) {
      if (m === 'title') return;
      this.stopIntro(Math.max(0.3, f));
    }
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

  // ------------------------------------------------------------------------------ intro score

  /**
   * Start the opening-cinematic score, synchronised to the cue sheet (each cue's `beat` and `t` are
   * read now, so a retimed / reordered / shortened sheet stays in sync). `startAt` = intro time (s) to
   * start from. Stops any mood (the title mood is not needed). Auto-switches the ambience bed per beat
   * until the game calls ambience(name) itself.
   */
  playIntro(cues: readonly IntroCue[], startAt = 0): void {
    const st = Math.max(0, fin(startAt, 0));
    if (!this._ready || !this.core || !this.intro) {
      this.introPending = { cues, startAt: st, at: typeof performance !== 'undefined' ? performance.now() : 0 };
      this.mood = 'silence';
      return;
    }
    try {
      const now = this.core.ctx.currentTime;
      this.mood = 'silence';
      this.applyMood(1.2);
      this.introAutoAmb = true;
      this.introStartedAt = now;
      this.intro.start(cues, st, now, INTRO_MIX);
      this.intro.tick(now, now + 0.5);
    } catch (e) { console.warn('[AudioEngine] intro failed', e); }
  }

  /** Fade the intro score out (seconds). Safe to call any time. */
  stopIntro(fade = 1.5): void {
    this.introPending = null;
    if (!this.core || !this.intro) return;
    try { this.intro.stop(this.core.ctx.currentTime, clamp(fin(fade, 1.5), 0.02, 20)); } catch { /* ignore */ }
  }

  /** Optional: report the intro's own clock (s) every frame or so; re-locks the score after hitches. */
  syncIntro(t: number): void {
    if (!this.core || !this.intro || !this.intro.active) return;
    try { this.intro.sync(fin(t, 0), this.core.ctx.currentTime); } catch { /* ignore */ }
  }

  /** Intro time according to the score clock (NaN when not playing). */
  introTime(): number {
    if (!this.core || !this.intro || !this.intro.active) return NaN;
    return this.intro.time(this.core.ctx.currentTime);
  }

  // ------------------------------------------------------------------------------ ambience

  /**
   * Named ambience bed: 'fields' | 'dawn' | 'gibeah-exterior' | 'gibeah-hall' | 'heights' | 'coast' | 'gilgal' | 'hush' |
   * 'none' (crossfade `fade` s).
   * Sets the legacy wind / cicadas / birds levels that go with it. Calling this during the intro
   * takes the ambience over from the score's automatic per-beat switching.
   */
  setAmbienceBed(name: BedName, fade = 1.5): void {
    const n: BedName = BED_NAMES.has(name) ? name : 'none';
    const f = clamp(fin(fade, 1.5), 0, 20);
    if (this.core && this.introActive && this.core.ctx.currentTime - this.introStartedAt > 0.5) this.introAutoAmb = false;
    this.bedFade = f;
    if (!this.core) { this.bed = n; Object.assign(this.amblv, BED_LEGACY[n]); return; }
    this.applyBed(n, f, this.core.ctx.currentTime);
  }

  private applyBed(n: BedName, fade: number, at: number): void {
    const c = this.core;
    if (!c) return;
    const t = Math.max(at, c.ctx.currentTime);
    const changed = n !== this.bed;
    this.bed = n;
    this.bedFade = fade;
    try {
      if (changed || !this.beds || this.beds.name !== n) this.beds?.set(n, fade, t);
      Object.assign(this.amblv, BED_LEGACY[n]);
      if (this.amb) this.amb.setLevels(this.amblv, t, Math.max(0.05, fade / 3));
    } catch { /* ignore */ }
  }

  /**
   * Legacy continuous levels 0..1 each, smoothed. Omitted keys keep their value. All default to 0.
   * (Back in the fields: an active Gibeah bed crossfades to 'fields'.)
   */
  setAmbience(levels: AmbienceLevels): void {
    if (!levels || typeof levels !== 'object') return;
    // during the opening film the score owns the ambience (e.g. the birds falling silent at the thicket is its
    // 'hush' bed): legacy level calls are ignored until the film ends or the game names a bed itself
    if (this.introActive && this.introAutoAmb) return;
    for (const k of ['wind', 'cicadas', 'birds'] as const) {
      const v = levels[k];
      if (v !== undefined) this.amblv[k] = clamp(fin(v, this.amblv[k]), 0, 1);
    }
    const any = this.amblv.wind > 0 || this.amblv.cicadas > 0 || this.amblv.birds > 0;
    if (this.bed !== 'fields' && (any || this.bed !== 'none')) {
      // gameplay levels describe the fields: bring in (or back) the fields bed on top of them
      this.bed = 'fields';
      if (this.beds && this.core) { try { this.beds.set('fields', 2, this.core.ctx.currentTime); } catch { /* ignore */ } }
    }
    if (this.beds) this.beds.density = clamp(this.amblv.birds / 0.45, 0, 1);
    if (this.amb && this.core) {
      try { this.amb.setLevels(this.amblv, this.core.ctx.currentTime); } catch { /* ignore */ }
    }
  }

  sfx(name: SfxName, opts?: SfxOptions): void {
    if (!this._ready || !this.lib || !this.core) return;
    try {
      const now = this.core.ctx.currentTime;
      // the intro score plays its own title hit in sync with its cue: a second one would double it
      if (name === 'titleHit' && this.intro && this.intro.active && this.intro.titleCue(now)) return;
      this.lib.play(name, opts, now);
    } catch { /* sfx must never throw */ }
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

  /**
   * Render the engine offline (OfflineAudioContext) — for tools / verification. `script(engine, t)` is
   * called at t = 0 and every `step` s of rendered time (the engine is ticked right after), exactly as
   * the game's frame loop would drive it.
   */
  static async renderOffline(o: OfflineRenderOptions): Promise<AudioBuffer> {
    const sr = o.sampleRate ?? 48000;
    const len = Math.ceil(o.seconds * sr);
    const ctx = new OfflineAudioContext(2, len, sr);
    const eng = new AudioEngine();
    if (o.lite !== undefined) eng.lite = o.lite;
    eng.build(ctx);
    const core = eng.core as Core;
    for (let i = 0; i < 40; i++) core.warm(); // impulse response + a few banks up front
    const step = o.step ?? 0.05;
    const q = 128 / sr;
    const run = (t: number): void => {
      try { if (o.script) o.script(eng, t); } catch (e) { console.warn(e); }
      eng.tick();
    };
    run(0);
    for (let t = step; t < o.seconds - step; t += step) {
      const tq = Math.round(t / q) * q;
      ctx.suspend(tq).then(() => { run(tq); return ctx.resume(); }).catch(() => undefined);
    }
    return ctx.startRendering();
  }

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
    try { if (this.intro) this.intro.tick(now, now + (hidden ? 1.5 : 0.5)); } catch { /* ignore */ }
    try { if (this.amb) this.amb.tick(now, this.slowAmt); } catch { /* ignore */ }
    try { if (this.beds) this.beds.tick(now, this.slowAmt); } catch { /* ignore */ }
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
    if (this.onVis && typeof document !== 'undefined') { document.removeEventListener('visibilitychange', this.onVis); this.onVis = null; }
    try { if (this.sling) this.sling.teardown(); } catch { /* ignore */ }
    try { if (this.amb) this.amb.dispose(); } catch { /* ignore */ }
    try { if (this.beds) this.beds.dispose(); } catch { /* ignore */ }
    try { if (this.intro && this.core) this.intro.stop(this.core.ctx.currentTime, 0.05); } catch { /* ignore */ }
    try { if (this.core) this.core.dispose(); } catch { /* ignore */ }
    const ctx = this.rt;
    this._ready = false;
    this.ctx = null; this.rt = null; this.core = null; this.lib = null; this.syn = null;
    this.amb = null; this.beds = null; this.intro = null; this.sling = null; this.title = null;
    this.moods.clear();
    this.slowApplied = -1;
    if (ctx && ctx.state !== 'closed' && typeof ctx.close === 'function') ctx.close().catch(() => undefined);
  }
}
