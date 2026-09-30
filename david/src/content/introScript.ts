// Shot sheet of the opening film "הַטּוֹב מִמֶּךָּ" — CUT v2 (58 s): docs/intro-script-v2.md (the binding shot list,
// the shared timing contract and the typography) + docs/director-notes-v4.md. docs/visual-bible.md is binding for
// everything on screen; docs/intro-script.md for the story and the sources. This file is DATA ONLY (the camera work
// lives in src/gameplay/Intro.ts + src/film/Film*.ts, keyed by `set` + `take`).
//
// THE SHARED TIMING CONTRACT (cut3 · anim · score3): every shot's take, length and named BEATS (seconds from the
// start of the shot) are below. The performances time every action to `beats`, the score keys every hit to them
// (read `INTRO_SHOTS` / the shot cues' `beats`, never hard-coded seconds). Change a number only together with the
// other two teammates (and write it in your report).
//
// Every shot names the SET it is filmed in ('black', the prologue land sets 'judah' | 'coast' | 'ramah' of
// src/film/land, the Gilgal set of src/film/gilgal, or 'world' = the chapter's game world around Bethlehem), the
// TAKE inside that set (a named camera move; 'base:variant' = a second angle filmed on the blocking of `base`, see
// src/film/FilmCams.ts), its length, how it comes in (transition), the score cue and the on-screen text.
//
// On-screen text rules (docs/visual-bible.md §1, intro-script-v2 "On-screen text"): ONLY the 11 text events below.
//  * `narration` ids come from ./introNarration (narration(id)) — never styled or referenced as a verse;
//  * `quote` ids are catalog ids of ./sources, shown ONLY through verseArgs / quoteText / sourceRef /
//    quoteWithRefHtml — never hand-typed. Words appear one by one (`stagger`, or `words` = timed to speech).

import type { SourceId } from './sources';
import type { IntroNarrationId } from './introNarration';

/** LEGACY beat names of the previous film (still read by src/audio/IntroScore.ts and src/palace/cast). */
export type IntroBeat =
  | 'judea'
  | 'gibeah'
  | 'saul-court'
  | 'saul-portrait'
  | 'warriors'
  | 'saul-hall'
  | 'hinge'
  | 'bethlehem'
  | 'rachel'
  | 'flock'
  | 'david'
  | 'title';

/** LEGACY world flag for the score: 'field' = warm / pastoral side, 'gibeah' = the king's side. */
export type IntroWorld = 'field' | 'gibeah';

/**
 * How a shot comes in:
 *  'cut'      hard cut (engine.resetTemporal, no crossfade)
 *  'dissolve' crossfade from the previous frame (`fade` s)
 *  'black'    out of black: `hold` s of black, then the picture rises out of it over `fade` s (the first shot)
 *  'light'    a warm white light-flash dip (`fade` s in all, centred on the cut: the G7 -> D1 transition)
 *  'match'    short dissolve that matches a shape
 *  'smash'    smash cut to BLACK (the title) — the picture is gone in one frame
 *  'hard'     hard cut ON A SOUND (the shofar blast of G1) — the score's hit sits exactly on it
 */
export type IntroTransition = 'cut' | 'dissolve' | 'match' | 'light' | 'black' | 'smash' | 'hard';

/** Where a shot is filmed. */
export type FilmSetName = 'black' | 'judah' | 'coast' | 'ramah' | 'gilgal' | 'world';

/**
 * Score cue names (data-driven: the score keys the music on these; consecutive shots with the same cue form one
 * section). CUT v2 uses: land, rachel, threat, elders, shofar, saul, peak, silence, tear, verdict, broken, figure,
 * face, thicket, title. The others are UNUSED in CUT v2 (kept only so older score code still compiles).
 */
export type FilmCue =
  | 'land' //       P1+P2  the flight: black -> the clouds -> through the deck -> the Judean ridges
  | 'rachel' //     P3     Rachel's standing stone, a shepherd and his flock pass
  | 'threat' //     P4     the Philistine column on the coastal plain (war drums in the score)
  | 'elders' //     P5     the elders demand a king at Ramah (8:5)
  | 'shofar' //     G1     HARD CUT on a shofar blast: the army out of the dust
  | 'saul' //       G2     the king's slow-motion stride
  | 'peak' //       G3     the halt, the spear raised, THE ROAR
  | 'silence' //    G4     the roar cuts out; the ranks part; Samuel in the road
  | 'tear' //       G5a+b  the tear: wide, then the insert on the fist (slow motion)
  | 'verdict' //    G6     15:28a, close on Samuel, near-silence
  | 'broken' //     G7     Saul and the torn piece in his fist
  | 'figure' //     D1     (after the light-flash) David from behind above the flock — 15:28b
  | 'face' //       D2     his face turns into the light — 16:7
  | 'thicket' //    H1+H2  the lamb at the thicket; the birds fall silent; two eyes open; SMASH
  | 'title' //      T      smash cut to black + the hit: the title
  // ---- unused in CUT v2 (legacy names of the rough cut) ----
  | 'dark'
  | 'faceoff'
  | 'rise'
  | 'bethlehem'
  | 'contrast'
  | 'peace';

export type IntroShotId =
  | 'flight' //       P1+P2
  | 'rachel' //       P3
  | 'coast' //        P4
  | 'elders' //       P5
  | 'dust' //         G1
  | 'king' //         G2
  | 'spear' //        G3
  | 'silence' //      G4
  | 'tear' //         G5a
  | 'tear-insert' //  G5b
  | 'verdict' //      G6
  | 'saul-alone' //   G7
  | 'figure' //       D1
  | 'face' //         D2
  | 'thicket' //      H1
  | 'eyes' //         H2
  | 'title'; //       T

/** How a text event is laid out (src/ui/UI.ts filmText kinds). */
export type FilmTextKind = 'time' | 'line' | 'place' | 'person' | 'verse';

/** One spoken word of a speech-synced verse: `t` = seconds from the start of the SHOT, `syl` = its syllables. */
export interface IntroWord {
  readonly t: number;
  readonly dur: number;
  readonly syl: number;
}

/** A text event inside a shot (`at` = seconds from the start of the shot; it may run past the shot's end). */
export interface IntroText {
  readonly at: number;
  /** lifetime on screen (s), fade-out included */
  readonly seconds: number;
  readonly kind: FilmTextKind;
  /** narration line(s) (./introNarration); for 'person' the second id is the smaller title line */
  readonly narration?: readonly IntroNarrationId[];
  /** catalog quotation (./sources) */
  readonly quote?: SourceId;
  /** verses: seconds between words (word-by-word reveal); default 0.11 */
  readonly stagger?: number;
  /** verses: explicit word timing (spoken: the jaw of the speaker follows these) — one entry per word of the
   *  quotation split on spaces (a maqaf joins two words into one entry) */
  readonly words?: readonly IntroWord[];
  /** verses: the reference fades in this long after the last word appears (default 0.55 s) */
  readonly refAfter?: number;
  /** where the card sits: the negative space of the composition ('left' / 'right'; 'center' default for verses) */
  readonly side?: 'left' | 'right' | 'center';
  /** vertical placement of place / person cards */
  readonly v?: 'top' | 'middle' | 'bottom';
}

/** Named beats of a shot (seconds from the start of the shot) — the shared timing contract. */
export type IntroBeats = Readonly<Record<string, number>>;

export interface IntroShot {
  readonly id: IntroShotId;
  /** shot number of docs/intro-script-v2.md ('P1+P2', 'G5a', 'T' ...) */
  readonly n: string;
  readonly set: FilmSetName;
  /** the camera move inside the set: a land take, a Gilgal take ('base:variant' allowed) or a world take */
  readonly take: string;
  /** sub-range of the take's normalised time to play (default [0, 1]); the take is re-timed to `dur` */
  readonly span?: readonly [number, number];
  /** seconds on screen */
  readonly dur: number;
  readonly cut: IntroTransition;
  /** transition length (s) for 'dissolve' / 'light' / 'match' / 'black' */
  readonly fade?: number;
  /** 'black': seconds of pure black before the picture starts to rise */
  readonly hold?: number;
  readonly cue: FilmCue;
  /** legacy score beat (see IntroBeat) */
  readonly beat: IntroBeat;
  /** the timing contract: named beats in shot seconds (performances and score key to these) */
  readonly beats?: IntroBeats;
  /** slow motion: the ACTION runs at this fraction of real time (the camera moves in real time); 1 = none */
  readonly slowmo?: number;
  readonly text?: readonly IntroText[];
  /** Camera / art direction (what the shot must show). */
  readonly direction: string;
}

export interface IntroCue {
  readonly beat: IntroBeat;
  /** Start (seconds from the start of the film). */
  readonly t: number;
  /** New score cue name (on shot cues). */
  readonly cue?: FilmCue;
  /** Script shot number (on shot cues). */
  readonly n?: string;
  readonly set?: FilmSetName;
  /** Scripture line - catalog id. */
  readonly verse?: SourceId;
  readonly narration?: readonly IntroNarrationId[];
  readonly seconds?: number;
  readonly optional?: boolean;
  readonly direction: string;
  /** Set on the cue that starts a shot (text-only cues leave it undefined). */
  readonly shot?: IntroShotId;
  readonly world?: IntroWorld;
  /** Shot length (s), on shot cues. */
  readonly dur?: number;
  /** How the shot comes in, on shot cues. */
  readonly cut?: IntroTransition;
  /** Dissolve length (s), on shot cues that dissolve. */
  readonly fade?: number;
  /** On shot cues: the shot's named beats (shot seconds) — see IntroShot.beats. */
  readonly beats?: IntroBeats;
  /** On shot cues: slow-motion factor of the action. */
  readonly slowmo?: number;
  /** On text cues of speech-synced verses: the word timing (shot seconds). */
  readonly words?: readonly IntroWord[];
}

/**
 * G6 — Samuel speaks 15:28a (6 words; ה׳ is read as three syllables). Seconds from the start of the verdict shot.
 * The verse words appear exactly at `t` and Samuel's jaw/lips speak each word over [t, t + dur] (anim).
 */
export const VERDICT_WORDS: readonly IntroWord[] = [
  { t: 0.9, dur: 0.3, syl: 2 }, //   1 kara
  { t: 1.22, dur: 0.44, syl: 3 }, // 2 (the Name)
  { t: 1.68, dur: 0.58, syl: 4 }, // 3 et-mamlechut
  { t: 2.28, dur: 0.44, syl: 3 }, // 4 Yisrael
  { t: 2.74, dur: 0.54, syl: 4 }, // 5 me'alecha
  { t: 3.3, dur: 0.34, syl: 2 }, //  6 hayom (speech ends 3.64)
];

// ---------------------------------------------------------------------------------------------------------
// THE FILM — prologue 0-17 s · Act I (Gilgal) 17-41.5 s · David 41.5-49 s · the hook 49-53 s · title 53-58 s
// ---------------------------------------------------------------------------------------------------------
export const INTRO_SHOTS: readonly IntroShot[] = [
  // ================================================================== PROLOGUE — flows (dissolves, the music builds)
  {
    id: 'flight', n: 'P1+P2', set: 'judah', take: 'flight', dur: 7.5, cut: 'black', hold: 0.3, fade: 1.3, cue: 'land', beat: 'judea',
    // one continuous flight: over the sea of clouds at dawn -> the dive through the deck -> out over the ridges
    beats: { timeCard: 0.3, deckIn: 3.1, deck: 3.6, ridges: 4.5 },
    text: [{ at: 0.3, seconds: 3.9, kind: 'time', narration: ['timeCard'] }],
    direction: 'Black -> the sea of clouds at dawn: the camera races forward low over the deck, banks into the sun, dives '
      + 'through it (wisps rushing past the lens) and bursts out over the Judean ridges in valley fog, the Dead Sea '
      + 'glinting, Moab beyond — still racing forward, banking into the light.',
  },
  {
    id: 'rachel', n: 'P3', set: 'world', take: 'rachel-dawn', dur: 3.0, cut: 'dissolve', fade: 0.8, cue: 'rachel', beat: 'rachel',
    beats: { card: 0.4, flockCross: 0.0 },
    text: [{ at: 0.4, seconds: 2.5, kind: 'place', narration: ['rachelTomb'], side: 'right', v: 'top' }],
    direction: "Rachel's single standing stone at first light by the road (visual-bible 3.10); a low dolly through the "
      + 'grass toward it with parallax; a shepherd with his staff and his flock pass behind it; grass in the wind.',
  },
  {
    id: 'coast', n: 'P4', set: 'coast', take: 'glint', dur: 2.5, cut: 'cut', cue: 'threat', beat: 'warriors',
    beats: {},
    direction: 'The Philistine host on the coastal plain: a long lens, a lateral track along the marching COLUMN on the '
      + 'road (depth, not blocks), the dust plume, bronze glints, heat haze.',
  },
  {
    id: 'elders', n: 'P5', set: 'ramah', take: 'elders', dur: 4.0, cut: 'dissolve', fade: 0.6, cue: 'elders', beat: 'saul-court',
    beats: { rise: 0.5, verse: 1.0, turnAway: 2.6 },
    text: [{ at: 1.0, seconds: 2.85, kind: 'verse', quote: 's1_8_5_give_us_king', stagger: 0.22 }],
    direction: "Ramah: a dolly in over the elders' heads (they fill the lower third, beards and faces readable) toward "
      + 'Samuel; one elder rises and demands with his arm raised, the others gesture and react; Samuel turns his face '
      + 'away (8:6).',
  },

  // ================================================================== ACT I · GILGAL — hits hard (cuts on the beat)
  {
    id: 'dust', n: 'G1', set: 'gilgal', take: 'dustWall', dur: 3.0, cut: 'hard', cue: 'shofar', beat: 'warriors',
    beats: { shofar: 0.0, horns: 0.4, card: 0.6 },
    text: [{ at: 0.6, seconds: 2.3, kind: 'place', narration: ['gilgal'], side: 'left', v: 'top' }],
    direction: 'HARD CUT on the shofar. Low and close to the front rank as it comes out of the dust wall at the lens, '
      + "backing away, handheld: rams' horns lifted and blown in the front rank, the ranks marching (not in lockstep), dust.",
  },
  {
    id: 'king', n: 'G2', set: 'gilgal', take: 'king', dur: 4.5, cut: 'cut', cue: 'saul', beat: 'warriors', slowmo: 0.5,
    beats: { card: 0.8 },
    text: [{ at: 0.8, seconds: 3.2, kind: 'person', narration: ['saulShort', 'saulTitle'], side: 'left', v: 'top' }],
    direction: 'SAUL — slow-motion stride at the head of the army, the sun behind him: very low, tracking backward in '
      + 'front of him with a slow push; cloak, hair and beard in the wind, the spear swinging with the stride, dust '
      + 'kicked up, the army behind. The name card huge in the sky\'s negative space.',
  },
  {
    id: 'spear', n: 'G3', set: 'gilgal', take: 'spearRaised', dur: 3.0, cut: 'cut', cue: 'peak', beat: 'warriors',
    beats: { halt: 0.3, spearUp: 0.8, roar: 1.1, roarSpread: 0.4, verse: 1.3 },
    text: [{ at: 1.3, seconds: 2.5, kind: 'verse', quote: 's1_9_2_head_above', stagger: 0.1 }],
    direction: 'The halt; Saul thrusts his spear up with the whole body; THE ROAR (every rank, staggered 0-0.4 s): a '
      + 'fast push-in from low in front, a jolt on the roar; spears and fists raised through the ranks, mouths open.',
  },
  {
    id: 'silence', n: 'G4', set: 'gilgal', take: 'silence', dur: 3.0, cut: 'cut', cue: 'silence', beat: 'saul-hall',
    beats: { roarCut: 0.0, headsTurn: 0.3, part: 0.8, card: 1.4, step: 2.2 },
    text: [{ at: 1.4, seconds: 2.4, kind: 'person', narration: ['samuel'], side: 'right', v: 'top' }],
    direction: "The roar cuts to silence. A slow push between the soldiers' shoulders: heads turn, men step aside, the "
      + "ranks part; Samuel stands in the road, white hair and mantle in the wind, and takes one step forward.",
  },
  {
    id: 'tear', n: 'G5a', set: 'gilgal', take: 'tear', dur: 2.0, cut: 'cut', cue: 'tear', beat: 'saul-hall',
    beats: { turn: 0.2, lunge: 0.9, grip: 1.6 },
    direction: 'THE TEAR, wide profile: Samuel turns to go; Saul lunges and seizes the corner of his mantle (15:27). '
      + 'No text: the picture says it.',
  },
  {
    // the insert continues the SAME action on the blocking of 'tear' (base shot time = shot time + 2.0)
    id: 'tear-insert', n: 'G5b', set: 'gilgal', take: 'tear:insert', dur: 2.5, cut: 'cut', cue: 'tear', beat: 'saul-hall', slowmo: 0.35,
    beats: { pull: 0.2, rip: 0.6, free: 1.8 },
    direction: 'Insert, slow motion: close on the fist and the ripping wool — the pull, fibres stretching and snapping, '
      + 'the corner coming free, dust in the light.',
  },
  {
    id: 'verdict', n: 'G6', set: 'gilgal', take: 'verdict', dur: 4.5, cut: 'cut', cue: 'verdict', beat: 'saul-hall',
    beats: { turnBack: 0.4, speech: 0.9, speechEnd: 3.64 },
    // the words land on the cut: the verse fades out 0.35 s into G7 (Saul hears it)
    text: [{ at: 0.9, seconds: 3.95, kind: 'verse', quote: 's1_15_28_torn_today', words: VERDICT_WORDS, refAfter: 0.25 }],
    direction: "THE VERDICT: Samuel turns back and speaks, close; a slow push, Saul's shoulder soft in the foreground; the "
      + 'jaw speaks the words as they appear, eyes on Saul, hair in the wind. Near-silence.',
  },
  {
    id: 'saul-alone', n: 'G7', set: 'gilgal', take: 'saulAlone', dur: 2.0, cut: 'cut', cue: 'broken', beat: 'saul-hall',
    beats: { lookDown: 0.3, tighten: 1.2, flash: 1.75 },
    direction: 'Saul looks down at the torn piece in his fist: a slow push to the fist, a focus pull to his face; breath, '
      + 'a tremble, the fingers tighten. At the end a whip up into the light.',
  },

  // ================================================================== DAVID — calm but alive
  {
    id: 'figure', n: 'D1', set: 'world', take: 'figure', dur: 4.0, cut: 'light', fade: 0.6, cue: 'figure', beat: 'david',
    beats: { verse: 0.3 },
    text: [{ at: 0.3, seconds: 3.65, kind: 'verse', quote: 's1_15_28_to_your_neighbor', stagger: 0.34 }],
    direction: 'Out of the light-flash: David from behind on a rock above the flock at golden hour, the Bethlehem hills; '
      + 'a slow crane / orbit behind him revealing the valley; wind in his curls and tunic, the flock moving and grazing '
      + 'below, he shifts his weight on his staff. 15:28b writes itself.',
  },
  {
    id: 'face', n: 'D2', set: 'world', take: 'face', dur: 3.5, cut: 'cut', cue: 'face', beat: 'david',
    beats: { turn: 0.5, verse: 1.2 },
    text: [{ at: 1.2, seconds: 3.0, kind: 'verse', quote: 's1_16_7_looks_heart', stagger: 0.12 }],
    direction: 'His face turns into the light: a slow push-in, backlit rim, shallow focus; the turn, a blink, the eyes '
      + 'settle, wind.',
  },

  // ================================================================== THE HOOK — tightens for 4 s, smash to the title
  {
    id: 'thicket', n: 'H1', set: 'world', take: 'thicket', dur: 2.5, cut: 'dissolve', fade: 0.8, cue: 'thicket', beat: 'flock',
    beats: { birdsStop: 0.4, lambHead: 1.5 },
    direction: 'A lamb strays to the edge of the thicket; the birds fall silent: low in the grass, following the lamb, the '
      + 'light dims; the lamb grazing, lifting its head, ears twitching; branches stirring.',
  },
  {
    id: 'eyes', n: 'H2', set: 'world', take: 'lamb', dur: 1.5, cut: 'cut', cue: 'thicket', beat: 'flock',
    beats: { eyesOpen: 0.7, smash: 1.5 },
    direction: 'In the dark of the thicket two eyes open: a slow creep in; leaves shiver, a breath, the eyes catch the light.',
  },
  {
    id: 'title', n: 'T', set: 'black', take: 'title', dur: 5.0, cut: 'smash', cue: 'title', beat: 'title',
    beats: { hit: 0.0, david: 0.3, hebrew: 1.6, chapter: 2.4 },
    direction: 'Smash to black on a hit: DAVID forms from light (blur -> sharp, a slow light sweep), דָּוִד beneath, a gold '
      + 'rule grows, פֶּרֶק רִאשׁוֹן · הָרֹעֶה last. Then the dissolve into gameplay (David on his rock).',
  },
];

/** Legacy world flag of a shot (the score's pastoral / king contrast). */
function worldOf(s: IntroShot): IntroWorld {
  return s.set === 'coast' || s.set === 'ramah' || s.set === 'gilgal' ? 'gibeah' : 'field';
}

/**
 * Cue list (derived from INTRO_SHOTS): one cue per shot start (`shot`, `cue`, `n`, `set`, `dur`, `cut`, `fade`,
 * `beats`, `slowmo`) plus one per text event. `short` is kept for API compatibility (one cut for every device).
 */
export function introCues(_short = false): IntroCue[] {
  const cues: IntroCue[] = [];
  let t = 0;
  for (const s of INTRO_SHOTS) {
    cues.push({
      beat: s.beat, t: round(t), cue: s.cue, n: s.n, set: s.set, shot: s.id, world: worldOf(s), dur: s.dur, cut: s.cut,
      fade: s.fade, beats: s.beats, slowmo: s.slowmo, direction: s.direction,
    });
    for (const x of s.text ?? []) {
      cues.push({ beat: s.beat, t: round(t + x.at), verse: x.quote, narration: x.narration, seconds: x.seconds, words: x.words, direction: `${s.id}: text` });
    }
    t += s.dur;
  }
  return cues.sort((a, b) => a.t - b.t);
}

/** Length (s) of a cue list's picture (end of its last shot). */
export function introLength(cues: readonly IntroCue[]): number {
  let end = 0;
  for (const c of cues) if (c.shot && c.dur !== undefined) end = Math.max(end, c.t + c.dur);
  return end;
}

/** Start time (s) of every shot in the film. */
export function shotStarts(): { shot: IntroShot; start: number }[] {
  let t = 0;
  return INTRO_SHOTS.map((shot) => {
    const r = { shot, start: t };
    t += shot.dur;
    return r;
  });
}

/** Film time (s) of a named beat of a shot (NaN if the shot or beat is unknown). */
export function beatTime(shot: IntroShotId, beat: string): number {
  let t = 0;
  for (const s of INTRO_SHOTS) {
    if (s.id === shot) {
      const b = s.beats?.[beat];
      return b === undefined ? NaN : t + b;
    }
    t += s.dur;
  }
  return NaN;
}

/** The shot of a take (e.g. 'tear:insert' -> the G5b shot), or undefined. */
export function shotOfTake(take: string): IntroShot | undefined {
  return INTRO_SHOTS.find((s) => s.take === take);
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** The film (desktop and phones play the same cut). */
export const INTRO_CUES: readonly IntroCue[] = introCues(false);

/** Kept for API compatibility (the score's tests import it): identical to INTRO_CUES. */
export const INTRO_CUES_SHORT: readonly IntroCue[] = INTRO_CUES;

/** Total length of the film incl. the title card (58 s). */
export const INTRO_LENGTH = introLength(INTRO_CUES);
