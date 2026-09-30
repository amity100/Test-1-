// CUT v2 timing contract (docs/intro-script-v2.md, "The shared timing contract") as a cue sheet, for the score
// harness only: dev/score.ts uses it while src/content/introScript.ts still holds the old 164.8 s cut, and as a
// regression sheet afterwards. The live game always plays INTRO_CUES of src/content/introScript.ts.
import type { IntroCue } from '../src/content/introScript';

interface Row {
  id: string; n: string; set: string; cue: string; dur: number; cut: string; fade?: number;
  /** beats inside the shot (shot seconds), named like the contract */
  beats?: Record<string, number>;
  /** on-screen texts: [shot seconds, seconds on screen, kind] */
  texts?: ReadonlyArray<readonly [number, number, string]>;
}

const ROWS: readonly Row[] = [
  { id: 'flight', n: 'P1', set: 'judah', cue: 'land', dur: 7.5, cut: 'black', fade: 0.3, beats: { card: 0.3, deck: 3.6, out: 4.5 }, texts: [[0.3, 3.4, 'time']] },
  { id: 'rachel-dawn', n: 'P3', set: 'world', cue: 'rachel', dur: 3.0, cut: 'dissolve', fade: 0.8, beats: { card: 0.4 }, texts: [[0.4, 2.5, 'place']] },
  { id: 'coast-glint', n: 'P4', set: 'coast', cue: 'threat', dur: 2.5, cut: 'cut' },
  { id: 'ramah-elders', n: 'P5', set: 'ramah', cue: 'elders', dur: 4.0, cut: 'dissolve', fade: 0.6, beats: { rise: 0.5, verse: 1.0, turn: 2.6 }, texts: [[1.0, 3.6, 'verse']] },
  { id: 'gilgal-dust', n: 'G1', set: 'gilgal', cue: 'shofar', dur: 3.0, cut: 'hard', beats: { shofar: 0, horns: 0.4, card: 0.6 }, texts: [[0.6, 2.5, 'place']] },
  { id: 'gilgal-king', n: 'G2', set: 'gilgal', cue: 'saul', dur: 4.5, cut: 'cut', beats: { card: 0.8 }, texts: [[0.8, 2.8, 'person']] },
  { id: 'gilgal-spear', n: 'G3', set: 'gilgal', cue: 'peak', dur: 3.0, cut: 'cut', beats: { halt: 0.3, spear: 0.8, roar: 1.1, verse: 1.3 }, texts: [[1.3, 3.0, 'verse']] },
  { id: 'gilgal-silence', n: 'G4', set: 'gilgal', cue: 'silence', dur: 3.0, cut: 'cut', beats: { heads: 0.3, part: 0.8, card: 1.4, step: 2.2 }, texts: [[1.4, 2.8, 'person']] },
  { id: 'gilgal-tear', n: 'G5a', set: 'gilgal', cue: 'tear', dur: 2.0, cut: 'cut', beats: { turn: 0.2, lunge: 0.9, grip: 1.6 } },
  { id: 'gilgal-tear-insert', n: 'G5b', set: 'gilgal', cue: 'tear', dur: 2.5, cut: 'cut', beats: { pull: 0.2, rip: 0.6, free: 1.8 } },
  { id: 'gilgal-verdict', n: 'G6', set: 'gilgal', cue: 'verdict', dur: 4.5, cut: 'cut', beats: { turn: 0.4, words: 0.9 }, texts: [[0.9, 3.8, 'verse']] },
  { id: 'gilgal-saul', n: 'G7', set: 'gilgal', cue: 'broken', dur: 2.0, cut: 'cut', beats: { look: 0.3, tighten: 1.2 } },
  { id: 'figure', n: 'D1', set: 'world', cue: 'figure', dur: 4.0, cut: 'light', fade: 0.6, beats: { verse: 0.3 }, texts: [[0.3, 3.9, 'verse']] },
  { id: 'face', n: 'D2', set: 'world', cue: 'face', dur: 3.5, cut: 'cut', beats: { turn: 0.5, verse: 1.2 }, texts: [[1.2, 3.0, 'verse']] },
  { id: 'thicket', n: 'H1', set: 'world', cue: 'thicket', dur: 2.5, cut: 'dissolve', fade: 0.8, beats: { birds: 0.4, lamb: 1.5 } },
  { id: 'lamb', n: 'H2', set: 'world', cue: 'thicket', dur: 1.5, cut: 'cut', beats: { eyes: 0.7, smash: 1.5 } },
  { id: 'title', n: 'T', set: 'black', cue: 'title', dur: 5.0, cut: 'smash', beats: { hit: 0, forms: 0.3, name: 1.6, chapter: 2.4 } },
];

function build(): IntroCue[] {
  const out: Array<Record<string, unknown>> = [];
  let t = 0;
  for (const r of ROWS) {
    out.push({ beat: 'judea', t, cue: r.cue, n: r.n, set: r.set, shot: r.id, dur: r.dur, cut: r.cut, fade: r.fade, beats: r.beats, direction: r.id });
    for (const [at, seconds, kind] of r.texts ?? []) {
      out.push({ beat: 'judea', t: Math.round((t + at) * 1000) / 1000, narration: kind === 'verse' ? undefined : ['timeCard'], verse: kind === 'verse' ? 's1_8_5_give_us_king' : undefined, seconds, direction: `${r.id}: ${kind}` });
    }
    t = Math.round((t + r.dur) * 1000) / 1000;
  }
  return (out as unknown as IntroCue[]).sort((a, b) => a.t - b.t);
}

/** The v2 contract as a cue sheet (58.0 s). */
export const V2_CUES: readonly IntroCue[] = build();
