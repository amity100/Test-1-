// Shot sheet of the opening film "הַטּוֹב מִמֶּךָּ" (≈2:44) — the approved script docs/intro-script.md, shot by shot.
// docs/visual-bible.md is binding for everything on screen; this file is DATA ONLY (the camera work lives in
// src/gameplay/Intro.ts + src/film/Film*.ts, keyed by `set` + `take`).
//
// Every shot names the SET it is filmed in ('black', the prologue land sets 'judah' | 'coast' | 'ramah' of
// src/film/land, the Gilgal set of src/film/gilgal, or 'world' = the chapter's game world around Bethlehem), the
// TAKE inside that set (a named camera move of the set, or a world shot of src/film/FilmWorld.ts), its length, how
// it comes in (transition), the score cue and the on-screen text.
//
// On-screen text rules (docs/visual-bible.md §1, docs/intro-script.md):
//  * `narration` ids come from ./introNarration (narration(id)) — never styled or referenced as a verse;
//  * `quote` ids are catalog ids of ./sources, shown ONLY through verseArgs / quoteText / sourceRef /
//    quoteWithRefHtml — never hand-typed. The ids per shot are INTRO_FILM_TEXTS of ./introNarration.
//
// The score: every shot start is an IntroCue with `cue` (the new data-driven cue name, FilmCue) and a legacy `beat`
// (IntroBeat) that the current score (src/audio/IntroScore.ts) still understands. When the score is rewritten it
// should key on `cue`; the legacy `beat` / `world` fields can then go.

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
 *  'black'    fade in from black (`fade` s) — the first picture after the time card
 *  'light'    dip through the sunlit cloud colour (the rise into the clouds -> Bethlehem)
 *  'match'    short dissolve that matches a shape
 *  'smash'    smash cut to BLACK (the title) — the picture is gone in one frame
 *  'hard'     hard cut ON A SOUND (the shofar blast of shot 6) — the score's hit sits exactly on it
 */
export type IntroTransition = 'cut' | 'dissolve' | 'match' | 'light' | 'black' | 'smash' | 'hard';

/** Where a shot is filmed. */
export type FilmSetName = 'black' | 'judah' | 'coast' | 'ramah' | 'gilgal' | 'world';

/** Score cue names (data-driven: the score teammate keys the music on these). */
export type FilmCue =
  | 'dark' //       1  black, wind, one deep tone
  | 'land' //       2  above the clouds, dawn over Judah
  | 'rachel' //     3  Rachel's pillar in the first light
  | 'threat' //     4  the Philistine host on the coastal plain (war drums in the score)
  | 'elders' //     5  the elders before Samuel at Ramah
  | 'shofar' //     6  HARD CUT on a shofar blast: the army out of the dust
  | 'saul' //       7  the king, slow motion
  | 'peak' //       8  the spear raised, the roar: music at its peak
  | 'silence' //    9  the roar cuts out: wind and the far sound of the spoil (15:14)
  | 'faceoff' //   10a king and prophet face to face
  | 'tear' //      10b the robe tears (slow motion)
  | 'verdict' //   11  15:28
  | 'broken' //    12  the king shattered
  | 'rise' //      13  the rise into the sky, dark -> warm
  | 'bethlehem' // 14  down through the clouds into Bethlehem
  | 'figure' //    15  the figure on the rock, from behind
  | 'face' //      16  he turns: the face
  | 'contrast' //  17  the small youth in the vast land
  | 'peace' //     18  the flock grazes, the lamb strays to the thicket
  | 'thicket' //   19  the birds fall silent; eyes in the dark
  | 'title'; //    20  smash cut to black + deep hit: the title

export type IntroShotId =
  | 'black'
  | 'land'
  | 'rachel-dawn'
  | 'rachel-road'
  | 'coast-threat'
  | 'coast-glint'
  | 'ramah-gate'
  | 'ramah-elders'
  | 'gilgal-dust'
  | 'gilgal-king'
  | 'gilgal-spear'
  | 'gilgal-silence'
  | 'gilgal-faceoff'
  | 'gilgal-tear'
  | 'gilgal-verdict'
  | 'gilgal-saul'
  | 'rise'
  | 'bethlehem'
  | 'figure'
  | 'face'
  | 'contrast'
  | 'peace'
  | 'thicket'
  | 'lamb'
  | 'title';

/** How a text event is laid out (src/ui/UI.ts filmText kinds). */
export type FilmTextKind = 'time' | 'line' | 'place' | 'person' | 'verse';

/** A text event inside a shot (`at` = seconds from the start of the shot; it may run past the shot's end). */
export interface IntroText {
  readonly at: number;
  readonly seconds: number;
  readonly kind: FilmTextKind;
  /** narration line(s) (./introNarration); for 'person' the second id is the smaller title line */
  readonly narration?: readonly IntroNarrationId[];
  /** catalog quotation (./sources) */
  readonly quote?: SourceId;
}

export interface IntroShot {
  readonly id: IntroShotId;
  /** shot number of docs/intro-script.md ('10a' etc.) */
  readonly n: string;
  readonly set: FilmSetName;
  /** the camera move inside the set: a LandSet shot name, a GilgalShotName or a world take (FilmWorld) */
  readonly take: string;
  /** sub-range of the take's normalised time to play (default [0, 1]); the take is re-timed to `dur` */
  readonly span?: readonly [number, number];
  /** seconds on screen (an incoming dissolve overlaps the start of the shot) */
  readonly dur: number;
  readonly cut: IntroTransition;
  /** dissolve length (s) for 'dissolve' / 'light' / 'match' / 'black' */
  readonly fade?: number;
  readonly cue: FilmCue;
  /** legacy score beat (see IntroBeat) */
  readonly beat: IntroBeat;
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
}

// ---------------------------------------------------------------------------------------------------------
// THE FILM — prologue 0:00-0:40 · Act I 0:40-1:40 · the rise 1:40-1:55 · Act II 1:55-2:25 · hook 2:25-2:44
// ---------------------------------------------------------------------------------------------------------
export const INTRO_SHOTS: readonly IntroShot[] = [
  // ================================================================== PROLOGUE · הָאָרֶץ — distant, mythic
  {
    id: 'black', n: '1', set: 'black', take: 'black', dur: 4.5, cut: 'cut', cue: 'dark', beat: 'judea',
    text: [{ at: 0.7, seconds: 3.3, kind: 'time', narration: ['timeCard'] }],
    direction: 'Black. Wind; a single deep tone. The time card, alone, slow fade.',
  },
  {
    id: 'land', n: '2', set: 'judah', take: 'flight', span: [0.1, 0.78], dur: 13, cut: 'black', fade: 2.4, cue: 'land', beat: 'judea',
    text: [{ at: 5.6, seconds: 6.2, kind: 'line', narration: ['tribes'] }],
    direction: 'Above the sunlit cloud sea at dawn, the sun rising behind Moab; the camera sinks and breaks through the '
      + 'deck: the Judean hills with mist in the valleys, the Dead Sea glinting in the east, the Moab wall beyond. '
      + 'The line appears as the camera breaks through.',
  },
  {
    id: 'rachel-dawn', n: '3', set: 'world', take: 'rachel-dawn', dur: 4.6, cut: 'dissolve', fade: 1.6, cue: 'rachel', beat: 'rachel',
    text: [{ at: 1.0, seconds: 6.4, kind: 'verse', quote: 'gen_35_19_rachel_full' }],
    direction: "Rachel's standing stone (one rough pillar, visual-bible 3.10) alone by the road in the first light, eye "
      + 'level, against the low sun; a slow push-in.',
  },
  {
    id: 'rachel-road', n: '3', set: 'world', take: 'rachel-road', dur: 3.6, cut: 'cut', cue: 'rachel', beat: 'rachel',
    direction: 'Down the worn road past the stone: a shepherd and his flock cross the slope in the distance.',
  },
  {
    id: 'coast-threat', n: '4', set: 'coast', take: 'threat', span: [0.15, 0.75], dur: 4.4, cut: 'cut', cue: 'threat', beat: 'warriors',
    text: [{ at: 0.8, seconds: 6.2, kind: 'verse', quote: 's1_14_52_war_all_days' }],
    direction: 'West, on the coastal plain by the sea: the Philistine host marches out of the dust toward the lens, '
      + 'bronze glinting against the late sun.',
  },
  {
    id: 'coast-glint', n: '4', set: 'coast', take: 'glint', dur: 3.1, cut: 'cut', cue: 'threat', beat: 'warriors',
    direction: 'Telephoto along the column: helmets, spear points and shields compressed in the heat haze.',
  },
  {
    id: 'ramah-gate', n: '5', set: 'ramah', take: 'gateWide', span: [0.25, 1], dur: 4.2, cut: 'dissolve', fade: 1.0, cue: 'elders', beat: 'saul-court',
    text: [{ at: 1.2, seconds: 6.0, kind: 'verse', quote: 's1_8_5_give_us_king' }],
    direction: 'Ramah: the modest gateway of a hill village; the elders of Israel gathered before one old man.',
  },
  {
    id: 'ramah-elders', n: '5', set: 'ramah', take: 'elders', dur: 3.4, cut: 'cut', cue: 'elders', beat: 'saul-court',
    direction: 'Along the benches: the elders (bearded, wool mantles) turned toward Samuel in the gate.',
  },

  // ================================================================== ACT I · הַמֶּלֶךְ — spectacle, then collapse
  {
    id: 'gilgal-dust', n: '6', set: 'gilgal', take: 'dustWall', dur: 7, cut: 'hard', cue: 'shofar', beat: 'warriors',
    text: [{ at: 1.6, seconds: 4.2, kind: 'place', narration: ['gilgal'] }],
    direction: 'A shofar blast — HARD CUT. Out of a towering, backlit dust cloud an army on foot returns from war.',
  },
  {
    id: 'gilgal-king', n: '7', set: 'gilgal', take: 'king', dur: 8, cut: 'cut', cue: 'saul', beat: 'warriors',
    text: [
      { at: 0.9, seconds: 4.6, kind: 'person', narration: ['saulName', 'saulTitle'] },
      { at: 3.4, seconds: 4.8, kind: 'verse', quote: 's1_9_2_head_above' },
    ],
    direction: 'Low angle, slow motion, the sun behind him: at the head of the army the man taller than all — helmet '
      + 'under his arm, scale armour, the gold band, the spear.',
  },
  {
    id: 'gilgal-spear', n: '8', set: 'gilgal', take: 'spearRaised', dur: 6, cut: 'cut', cue: 'peak', beat: 'warriors',
    text: [{ at: 1.0, seconds: 4.8, kind: 'verse', quote: 's1_14_47_fought_around' }],
    direction: 'Saul raises his spear to the sky; thousands roar and raise theirs. The music at its peak.',
  },
  {
    id: 'gilgal-silence', n: '9', set: 'gilgal', take: 'silence', dur: 8, cut: 'cut', cue: 'silence', beat: 'saul-hall',
    text: [{ at: 3.6, seconds: 4.0, kind: 'person', narration: ['samuel'] }],
    direction: 'The roar cuts out at once: only wind and the far bleating of the spoil. At the head of the road an old '
      + 'man wrapped in a me\'il stands in the way; the front ranks part.',
  },
  {
    id: 'gilgal-faceoff', n: '10a', set: 'gilgal', take: 'faceOff', dur: 5, cut: 'cut', cue: 'faceoff', beat: 'saul-hall',
    direction: 'The giant king and the old prophet face to face.',
  },
  {
    id: 'gilgal-tear', n: '10b', set: 'gilgal', take: 'tear', dur: 7, cut: 'cut', cue: 'tear', beat: 'saul-hall',
    text: [{ at: 0.6, seconds: 6.0, kind: 'verse', quote: 's1_15_27_robe_torn' }],
    direction: 'Samuel turns to go; Saul seizes the corner of his robe — it tears in slow motion: threads snapping, '
      + 'dust in the light.',
  },
  {
    id: 'gilgal-verdict', n: '11', set: 'gilgal', take: 'verdict', dur: 9, cut: 'cut', cue: 'verdict', beat: 'saul-hall',
    text: [{ at: 1.4, seconds: 7.0, kind: 'verse', quote: 's1_15_28_torn_kingdom' }],
    direction: 'Close on Samuel, hard and quiet.',
  },
  {
    id: 'gilgal-saul', n: '12', set: 'gilgal', take: 'saulAlone', dur: 10, cut: 'cut', cue: 'broken', beat: 'saul-hall',
    direction: 'A long close-up: the king at the height of his glory — shattered; the torn piece in his fist; the army '
      + 'behind him out of focus.',
  },

  // ================================================================== TRANSITION · הַחִפּוּשׂ
  {
    id: 'rise', n: '13', set: 'gilgal', take: 'rise', dur: 15, cut: 'cut', cue: 'rise', beat: 'hinge',
    text: [{ at: 4.2, seconds: 6.6, kind: 'verse', quote: 's1_13_14_after_his_heart' }],
    direction: 'One continuous move: up from Saul above the army, the plain, the clouds, the whole land, sweeping '
      + 'south over the hills like a searching gaze; into the sunlit cloud deck. Dark -> warm.',
  },

  // ================================================================== ACT II · הָרֹעֶה
  {
    id: 'bethlehem', n: '14', set: 'world', take: 'bethlehem', dur: 8, cut: 'light', fade: 1.6, cue: 'bethlehem', beat: 'bethlehem',
    direction: 'Down out of the clouds into the low golden light: Bethlehem on its ridge, the terraces, the flock on the '
      + 'slope; the descent continues toward the pasture.',
  },
  {
    id: 'figure', n: '15', set: 'world', take: 'figure', dur: 7.5, cut: 'dissolve', fade: 1.1, cue: 'figure', beat: 'david',
    text: [{ at: 1.3, seconds: 5.6, kind: 'verse', quote: 's1_16_11_youngest' }],
    direction: 'On a rock above the flock a lone figure seen from behind: staff planted, wind in his curls (the '
      + "user's reference image); a slow push toward him.",
  },
  {
    id: 'face', n: '16', set: 'world', take: 'face', dur: 7, cut: 'cut', cue: 'face', beat: 'david',
    text: [{ at: 2.8, seconds: 4.2, kind: 'verse', quote: 's1_16_12_ruddy' }],
    direction: 'He turns his head — the first time we see his face, in warm light (shallow focus on the eyes).',
  },
  {
    id: 'contrast', n: '17', set: 'world', take: 'contrast', dur: 7.5, cut: 'cut', cue: 'contrast', beat: 'david',
    text: [{ at: 1.0, seconds: 6.0, kind: 'verse', quote: 's1_16_7_looks_heart' }],
    direction: 'Wide: the small youth in the vast landscape — the answer to Saul, taller than all the people.',
  },

  // ================================================================== HOOK · בַּסְּבַךְ
  {
    id: 'peace', n: '18', set: 'world', take: 'peace', dur: 6, cut: 'dissolve', fade: 1.2, cue: 'peace', beat: 'flock',
    direction: 'The flock grazes; a little lamb wanders to the edge of a dark thicket.',
  },
  {
    id: 'thicket', n: '19', set: 'world', take: 'thicket', dur: 3.9, cut: 'cut', cue: 'thicket', beat: 'flock',
    direction: 'The birds fall silent. Over the lamb into the dark thicket: something large shifts; heavy breathing; '
      + 'two eyes open in the dark.',
  },
  {
    id: 'lamb', n: '19', set: 'world', take: 'lamb', dur: 2.5, cut: 'cut', cue: 'thicket', beat: 'flock',
    direction: 'Reverse, low and close: the lamb lifts its head toward the thicket.',
  },
  {
    id: 'title', n: '20', set: 'black', take: 'title', dur: 6.6, cut: 'smash', cue: 'title', beat: 'title',
    direction: 'Smash cut to black + a deep hit: DAVID · דָּוִד · פֶּרֶק רִאשׁוֹן · הָרֹעֶה, and the film\'s name '
      + '(catalog s1_15_28_better_than_you). Then shot 21: the game opens on David on his rock.',
  },
];

/** Legacy world flag of a shot (the score's pastoral / king contrast). */
function worldOf(s: IntroShot): IntroWorld {
  return s.set === 'coast' || s.set === 'ramah' || s.set === 'gilgal' ? 'gibeah' : 'field';
}

/**
 * Cue list (derived from INTRO_SHOTS): one cue per shot start (`shot`, `cue`, `n`, `set`, `dur`, `cut`, `fade`) plus
 * one per text event. `short` is kept for API compatibility: the approved film has no optional shots.
 */
export function introCues(_short = false): IntroCue[] {
  const cues: IntroCue[] = [];
  let t = 0;
  for (const s of INTRO_SHOTS) {
    cues.push({ beat: s.beat, t: round(t), cue: s.cue, n: s.n, set: s.set, shot: s.id, world: worldOf(s), dur: s.dur, cut: s.cut, fade: s.fade, direction: s.direction });
    for (const x of s.text ?? []) {
      cues.push({ beat: s.beat, t: round(t + x.at), verse: x.quote, narration: x.narration, seconds: x.seconds, direction: `${s.id}: text` });
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

const round = (x: number) => Math.round(x * 1000) / 1000;

/** The film (desktop and phones play the same approved cut). */
export const INTRO_CUES: readonly IntroCue[] = introCues(false);

/** Kept for API compatibility (the score's tests import it): identical to INTRO_CUES. */
export const INTRO_CUES_SHORT: readonly IntroCue[] = INTRO_CUES;
