// Shot sheet of the opening film "הַטּוֹב מִמֶּךָּ" — CUT v3 (60 s): docs/intro-script-v3.md (the binding scene list and
// timing contract of this cut) on top of docs/intro-script-v2.md (typography, performances, models) and
// docs/director-notes-v5.md. docs/visual-bible.md is binding for everything on screen; docs/intro-script.md for the story
// and the sources. This file is DATA ONLY (the camera work lives in src/gameplay/Intro.ts + src/film/Film*.ts, keyed by
// `set` + `take`).
//
// CUT v3 (the user, 1 Oct: "too fast, in pieces too small — nobody watches a game opening that fast"; chose "about a
// minute, only 6 scenes"): no prologue — the film opens on the time card over black and the shofar at Gilgal; six
// scenes of 5-12 s, each one or two long takes (3-6.5 s), the camera slow, time to read every text.
//
// CUT v4 (the user, 2 Oct): the end of the film is a cinematic, epic introduction of David — "like Assassin's Creed 2
// when the two brothers are on the roof and then the game's logo": after D1-D2 the camera cranes up and back from
// David over his flock and the hills, DAVID forms over the panorama, and the film hands over to the game without a
// cut (docs/intro-script-v4.md). The bear (the thicket and the eyes, CUT v3's H1-H2) is no longer in the film: it
// opens the bear's attack in gameplay (src/gameplay/Story.ts bearAttack).
//
// CUT v5 (the user, 2 Oct: "before the Saul part, something that shows the period ... where we are, what the people
// of Israel went through to get there — a general idea"; approved the outline with a REALISTIC 3D map; Rachel's tomb
// inside the prologue, never between the two halves of 15:28) — docs/intro-script-v5.md: a 61 s PROLOGUE before
// Gilgal (the land of Israel at dawn, Bethlehem, Rachel's tomb, the realistic 3D map: out of Egypt, forty years in the
// wilderness, across the Jordan to Gilgal, the tribes in the days of the Judges, the five Philistine cities; the
// Philistine host; the elders at Ramah: give us a king), then Gilgal on the shofar as before; and a NEW END (the user:
// David must be seen watching his flock for several seconds, a verse to know him, the DAVID logo while he does
// something noble, and a fitting camera move — no strange orbit): D3 'watch' (Ps 78:70-71) and D4 'horizon' (one long
// take: he gathers a lamb into his arms and carries it to its mother; the logo; the camera eases back and settles
// behind him into the game).
//
// THE SHARED TIMING CONTRACT (cut · perf · score): every shot's take, length and named BEATS (seconds from the start of
// the shot) are below. The performances time every action to `beats`, the score keys every hit to them (read
// `INTRO_SHOTS` / the shot cues' `beats`, never hard-coded seconds). Change a number only together with the other two
// teammates (and write it in your report).
//
// Every shot names the SET it is filmed in ('black', the Gilgal set of src/film/gilgal, 'world' = the chapter's game
// world around Bethlehem, the prologue land sets 'judah' | 'coast' | 'ramah' of src/film/land, or CUT v5's realistic 3D
// map 'map' of src/film/map),
// the TAKE inside that set (a named camera move; 'base:variant' = a second angle filmed on the blocking of `base`, see
// src/film/FilmCams.ts), its length, how it comes in (transition), the score cue and the on-screen text.
//
// On-screen text rules (docs/visual-bible.md §1, intro-script-v5 "Text"): ONLY the text events below.
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
export type FilmSetName = 'black' | 'judah' | 'coast' | 'ramah' | 'gilgal' | 'world' | 'map';

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
  | 'horizon' //    D4     CUT v5: he gathers a lamb into his arms and carries it to its mother; the logo; the camera eases back into the game
  | 'map' //        P4     CUT v5: the realistic 3D map — out of Egypt, the wilderness, across the Jordan to Gilgal
  | 'judges' //     P5     CUT v5: the map — the tribes in their land, "no king in Israel", the five Philistine cities
  | 'watch' //      D3     CUT v5: David watches his flock (Ps 78:70-71)
  | 'thicket' //    (unused since CUT v4: the hook moved into gameplay, Story.bearAttack)
  | 'title' //      (unused since CUT v4: the logo sits over the panorama of D3)
  // ---- unused in CUT v2 (legacy names of the rough cut) ----
  | 'dark'
  | 'faceoff'
  | 'rise'
  | 'bethlehem'
  | 'contrast'
  | 'peace';

export type IntroShotId =
  | 'land' //         P1 (CUT v5) out of black: the land of Israel at dawn — the Judean hills
  | 'bethlehem' //    P2 (CUT v5) Bethlehem on its ridge
  | 'map-exodus' //   P4 (CUT v5) the realistic 3D map: the road out of Egypt to Gilgal
  | 'map-tribes' //   P5 (CUT v5) the map: the tribes, the Judges, the Philistine cities
  | 'philistines' //  P6 (CUT v5) the Philistine host on the coastal plain
  | 'watch' //        D3 (CUT v5) David watches his flock
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
  | 'horizon' //      D4 (CUT v5; D3 of CUT v4)
  | 'thicket' //      (unused since CUT v4)
  | 'eyes' //         (unused since CUT v4)
  | 'title'; //       (unused since CUT v4)

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
  /** where the text sits: the negative space of the composition ('left' / 'right' / 'center') — every verse has an
   *  explicit anchor (side + v) chosen from its shot's frames (director-notes-v5: never across a face or a body) */
  readonly side?: 'left' | 'right' | 'center';
  /** vertical placement (cards and verses) */
  readonly v?: 'top' | 'middle' | 'bottom';
  /** verses: 2 = set in two balanced lines (presentation only: the catalog's words are unchanged, only a line break
   *  is placed between two of them) */
  readonly lines?: 1 | 2;
  /** verses: the last N words set in gold (D1: הַטּוֹב מִמֶּךָּ — the film's own title) */
  readonly gold?: number;
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
 * G6 — Samuel speaks 15:28a (6 words; ה׳ is read as three syllables), measured and grave (CUT v3: slower than v2).
 * Seconds from the start of the verdict shot. The verse words appear exactly at `t` and Samuel's jaw/lips speak each
 * word over [t, t + dur] (perf).
 */
export const VERDICT_WORDS: readonly IntroWord[] = [
  { t: 1.2, dur: 0.38, syl: 2 }, //  1 kara
  { t: 1.68, dur: 0.52, syl: 3 }, // 2 (the Name)
  { t: 2.3, dur: 0.7, syl: 4 }, //   3 et-mamlechut
  { t: 3.1, dur: 0.52, syl: 3 }, //  4 Yisrael
  { t: 3.72, dur: 0.64, syl: 4 }, // 5 me'alecha
  { t: 4.46, dur: 0.44, syl: 2 }, // 6 hayom (speech ends 4.9)
];

// ---------------------------------------------------------------------------------------------------------
// THE FILM (CUT v5, 134.5 s) — PROLOGUE 0-61 (the land · Bethlehem · Rachel · the map · the Philistines · Ramah) ·
// 1 Gilgal 61-71.5 · 2 the spear and the silence 71.5-80.5 · 3 the tear 80.5-89.5 · 4 the verdict 89.5-98.5 ·
// 5 David 98.5-108.5 · 6 the flock, the lamb and the logo 108.5-134.5, then the game
// ---------------------------------------------------------------------------------------------------------
export const INTRO_SHOTS: readonly IntroShot[] = [
  // ================================================================== PROLOGUE (CUT v5, 61 s): a general idea — where, when, and how
  {
    id: 'land', n: 'P1', set: 'judah', take: 'flight', dur: 11.0, cut: 'black', hold: 3.0, fade: 1.6, cue: 'land', beat: 'judea',
    // timeCard: the time card over black · picture: the picture rises out of black (the sea of clouds at dawn) ·
    // card: the land card
    beats: { timeCard: 0.4, picture: 3.0, card: 5.4 },
    text: [
      { at: 0.4, seconds: 3.6, kind: 'time', narration: ['timeCard'] },
      { at: 5.4, seconds: 4.8, kind: 'person', narration: ['landIsrael', 'judahDays'], side: 'right', v: 'top' },
    ],
    direction: 'Out of black (the time card): dawn over a sea of clouds lying on the hills east of Bethlehem, the sun '
      + 'rising over Moab, the deck breaking up over the desert toward the Dead Sea; ONE slow flight (cut7: keyed, ~60 m/s) '
      + 'glides east and sinks through the deck while banking right, comes out under it over the hills of Judah in the '
      + 'valley fog (terraces and olives below, broken clouds lit from beneath) and turns on round to the west-north-west '
      + "until Bethlehem's ridge is ahead with the sun behind the lens — P2's aerial continues it through the dissolve. "
      + 'The two-line card in the sky.',
  },
  {
    id: 'bethlehem', n: 'P2', set: 'world', take: 'bethlehem', dur: 7.0, cut: 'dissolve', fade: 1.0, cue: 'bethlehem', beat: 'bethlehem',
    beats: { card: 1.0, flock: 2.2 },
    text: [{ at: 1.0, seconds: 4.8, kind: 'person', narration: ['bethlehem', 'bethlehemJesse'], side: 'left', v: 'top' }],
    direction: 'Bethlehem on its ridge in the early morning (one flight with P1 through the dissolve: from the ESE, the low '
      + 'sun behind the right shoulder): a village of a few dozen four-room houses of fieldstone with flat roofs of packed '
      + 'earth and courtyards — no city wall, no towers, a modest gateway by the well — the threshing floor, terraces with '
      + 'olives on the slopes below, thin morning smoke from a few roofs; the glide slows into a drift toward the village; '
      + 'from `flock` a shepherd leads his flock along a terrace (small in the frame). Peaceful, alive, the light warming.',
  },
  {
    id: 'rachel', n: 'P3', set: 'world', take: 'rachel-dawn', dur: 6.0, cut: 'dissolve', fade: 0.8, cue: 'rachel', beat: 'rachel',
    // rise: the lens starts to rise into the sky (the map takes over in P4 by a dissolve at the same view)
    beats: { card: 0.6, verse: 1.6, rise: 4.0 },
    text: [
      { at: 0.6, seconds: 3.2, kind: 'place', narration: ['rachelTomb'], side: 'right', v: 'top' },
      { at: 1.6, seconds: 3.9, kind: 'verse', quote: 'gen_35_19_rachel_buried', stagger: 0.16, side: 'left', v: 'top', lines: 2 },
    ],
    direction: "Rachel's tomb by the road to Ephrath at first light: Jacob's single standing stone (Gen 35:20) on its low "
      + 'mound of fieldstones beside the worn road (Rashi on Gen 48:7: the road is the point) — no dome, no building; a low '
      + 'dolly through the grass toward it, looking into the dawn (the sun just beside the stone), grass and branches in the '
      + 'wind, birds; a shepherd and his flock cross behind it, clear of the brush; from `rise` the lens lifts away and '
      + 'climbs, pulling back over the road and turning to the north, looking down — the map continues the climb (the end '
      + 'view: scratchpad/wf/cut8_notes.md).',
  },
  {
    id: 'map-exodus', n: 'P4', set: 'map', take: 'exodus', dur: 13.0, cut: 'dissolve', fade: 1.4, cue: 'map', beat: 'judea',
    // climb: still climbing from Bethlehem up to the whole region · egypt: the land of Egypt in view, the road starts
    // out of the Nile delta · wilderness: the road wanders in the wilderness · jordan: the road reaches the plains of
    // Moab and crosses the Jordan · gilgal: it ends at Gilgal (the verse)
    beats: { climb: 0.0, egypt: 3.0, exodus: 3.4, wilderness: 6.0, jordan: 9.0, gilgal: 10.2 },
    text: [
      { at: 3.4, seconds: 2.8, kind: 'line', narration: ['exodus'], v: 'bottom' },
      { at: 6.3, seconds: 2.8, kind: 'line', narration: ['wilderness'], v: 'bottom' },
      { at: 10.2, seconds: 3.6, kind: 'verse', quote: 'josh_4_19_camped_gilgal', stagger: 0.16, side: 'center', v: 'bottom', lines: 1 },
    ],
    direction: 'THE MAP — REALISTIC 3D (the user): the real land seen from very high, like a satellite view at dawn — the '
      + 'Great Sea, the Nile delta, the wilderness, the Dead Sea, the Jordan valley, the hills; a line of light draws the '
      + 'road out of Egypt (`exodus`), wanders in the wilderness (forty years), comes up to the plains of Moab and crosses '
      + 'the Jordan to Gilgal (`gilgal`), where it ends in a glow. Place names in biblical Hebrew appear on the land as the '
      + 'road reaches them. The camera keeps moving, slow and grand. No specific mountain is marked as Sinai.',
  },
  {
    id: 'map-tribes', n: 'P5', set: 'map', take: 'tribes', dur: 9.0, cut: 'cut', cue: 'judges', beat: 'judea',
    // the same continuous camera as P4 (the cut is invisible) · tribes: the names of the tribes spread over their land ·
    // verse: "no king in Israel" · cities: the five Philistine cities glow on the coast and the lens starts down to them
    beats: { tribes: 0.4, verse: 2.6, cities: 6.2 },
    text: [{ at: 2.6, seconds: 3.9, kind: 'verse', quote: 'jdg_21_25_no_king', stagger: 0.16, side: 'center', v: 'bottom', lines: 2 }],
    direction: 'The map continues (same camera, no visible cut): the lens comes lower over the land of Israel; the names '
      + 'of the twelve tribes appear over their territories (Dan in the north, as in the days of Saul); then on the '
      + 'coastal plain the five Philistine cities glow — Gaza, Ashkelon, Ashdod, Gath, Ekron (`cities`) — and the lens '
      + 'starts to descend toward the coast.',
  },
  {
    id: 'philistines', n: 'P6', set: 'coast', take: 'threat', dur: 7.0, cut: 'dissolve', fade: 1.0, cue: 'threat', beat: 'warriors',
    beats: { card: 0.6, verse: 1.8 },
    text: [
      { at: 0.6, seconds: 3.0, kind: 'place', narration: ['philistia'], side: 'right', v: 'top' },
      { at: 1.8, seconds: 4.8, kind: 'verse', quote: 's1_13_19_no_smith_film', stagger: 0.14, side: 'left', v: 'top', lines: 2 },
    ],
    direction: "The Philistine host on the coastal plain, the map's descent continued: from a crane 220 m over the plain, "
      + "looking back WNW down the column marching inland out of Ashdod (its tell behind it, the sea a pale band), the lens "
      + 'comes down on a log-height ease to a long lens at a man\'s height beside the front ranks — bronze glinting, dust in '
      + 'the low morning sun, the near files large. Menace, power, iron that Israel does not have (13:19 in the sky).',
  },
  {
    id: 'elders', n: 'P7', set: 'ramah', take: 'elders', dur: 8.0, cut: 'cut', cue: 'elders', beat: 'saul-court',
    // rise: an elder rises · verse: "give us a king" · away: Samuel turns his face away (8:6)
    beats: { card: 0.5, rise: 1.6, verse: 2.4, away: 6.0 },
    text: [
      { at: 0.5, seconds: 2.8, kind: 'place', narration: ['ramah'], side: 'right', v: 'top' },
      { at: 2.4, seconds: 4.4, kind: 'verse', quote: 's1_8_5_give_us_king', stagger: 0.16, side: 'left', v: 'top', lines: 2 },
    ],
    direction: 'Ramah in the late afternoon light (the sun low in the WSW raking the gate\'s stones, the roofed passage in '
      + 'shade, the doors open): the elders of Israel before old Samuel (8:4); a slow, low dolly in on the gate\'s axis, '
      + 'the near pair — turned to each other — framing it left and right; the speaker rises from the bench, his arm out '
      + '(`rise`, 8:5 at `verse`), the others murmur and nod; Samuel in the gateway listens and turns his face away at '
      + '`away` (8:6). Then the hard cut on the shofar into Gilgal.',
  },

  // ================================================================== 1 · GILGAL (10.5 s): the shofar, the army, the king
  {
    // CUT v5: the shot of CUT v3/v4 from its shofar on (the black and the time card moved to P1): a HARD CUT on the blast.
    // Shot time 0 = the old G1's 1.5 s (the blocking and the camera run on the old clock: TAKE_OFFSET 1.5)
    id: 'dust', n: 'G1', set: 'gilgal', take: 'dustWall', dur: 4.0, cut: 'hard', cue: 'shofar', beat: 'warriors',
    beats: { shofar: 0.0, horns: 0.6, card: 1.3 },
    text: [{ at: 1.3, seconds: 2.5, kind: 'place', narration: ['gilgal'], side: 'left', v: 'top' }],
    direction: 'HARD CUT ON THE SHOFAR BLAST out of Ramah: low and close to the front rank as it comes out of the dust '
      + "wall at the lens, the lens backing away slowly; rams' horns lifted and blown in the front rank, the ranks "
      + 'marching (not in lockstep), dust in the low sun. Exactly the frames of the old G1 from its shofar on (TAKE_OFFSET '
      + '1.5: the blocking, the horns, the set and the camera on the old clock; the set pre-rolled under the end of P7).',
  },
  {
    id: 'king', n: 'G2', set: 'gilgal', take: 'king', dur: 6.5, cut: 'cut', cue: 'saul', beat: 'warriors', slowmo: 0.5,
    beats: { card: 1.0, headTurn: 3.6 },
    text: [{ at: 1.0, seconds: 3.6, kind: 'person', narration: ['saulShort', 'saulTitle'], side: 'left', v: 'top' }],
    direction: 'SAUL — the slow-motion stride at the head of the army, the sun behind him: very low, tracking backward in '
      + 'front of him with a slow push; cloak, hair and beard in the wind, the spear swinging with the stride, dust kicked '
      + "up, the army behind; at `headTurn` his head turns over the ranks. The name card huge in the sky's negative space.",
  },

  // ================================================================== 2 · THE SPEAR, THE ROAR, THE SILENCE (9 s)
  {
    id: 'spear', n: 'G3', set: 'gilgal', take: 'spearRaised', dur: 5.0, cut: 'cut', cue: 'peak', beat: 'warriors',
    beats: { halt: 0.6, spearUp: 1.3, roar: 1.7, roarSpread: 0.5, verse: 2.0 },
    // in the dusty sky at frame left; gone before the roar cut (2.0 + 2.8 = 4.8)
    text: [{ at: 2.0, seconds: 2.8, kind: 'verse', quote: 's1_9_2_head_above', stagger: 0.14, refAfter: 0.4, side: 'left', v: 'top', lines: 2 }],
    direction: 'The halt; Saul thrusts his spear up with the whole body; THE ROAR (every rank, staggered): a slow push-in '
      + 'from low in front, a jolt on the roar; spears and fists raised through the ranks, mouths open — held long enough '
      + 'to feel it.',
  },
  {
    id: 'silence', n: 'G4', set: 'gilgal', take: 'silence', dur: 4.0, cut: 'cut', cue: 'silence', beat: 'saul-hall',
    beats: { roarCut: 0.0, headsTurn: 0.4, part: 1.0, card: 1.6, step: 2.8 },
    text: [{ at: 1.6, seconds: 2.3, kind: 'person', narration: ['samuel'], side: 'right', v: 'top' }],
    direction: "The roar cuts to silence. A slow push between the soldiers' shoulders: heads turn, men step aside, the "
      + 'ranks part; Samuel stands in the road, white hair and mantle in the wind, and takes one step forward.',
  },

  // ================================================================== 3 · THE TEAR (9 s)
  {
    id: 'tear', n: 'G5a', set: 'gilgal', take: 'tear', dur: 4.0, cut: 'cut', cue: 'tear', beat: 'saul-hall',
    beats: { turn: 0.5, lunge: 2.2, grip: 3.3 },
    direction: 'THE TEAR, wide: Samuel turns to go and walks away; Saul goes after him, lunges, drops to his knee and '
      + 'seizes the corner of his mantle (15:27). No text: the picture says it.',
  },
  {
    // the insert continues the SAME action on the blocking of 'tear' (base shot time = shot time + 4.0)
    id: 'tear-insert', n: 'G5b', set: 'gilgal', take: 'tear:insert', dur: 5.0, cut: 'cut', cue: 'tear', beat: 'saul-hall', slowmo: 0.35,
    beats: { pull: 0.4, rip: 1.4, free: 3.6 },
    direction: 'Low close two-shot, slow motion: Saul on his knee, the fist in the wool, the pull, the rip running along '
      + 'the weave, the corner with its tzitzit coming free in his fist while Samuel walks on; dust in the backlight.',
  },

  // ================================================================== 4 · THE VERDICT (9 s)
  {
    id: 'verdict', n: 'G6', set: 'gilgal', take: 'verdict', dur: 6.0, cut: 'cut', cue: 'verdict', beat: 'saul-hall',
    beats: { turnBack: 0.5, speech: 1.2, speechEnd: 4.9 },
    // the upper-left negative space; it ends WITH the shot (1.2 + 4.8 = 6.0)
    text: [{ at: 1.2, seconds: 4.8, kind: 'verse', quote: 's1_15_28_torn_today', words: VERDICT_WORDS, refAfter: 0.3, side: 'left', v: 'top', lines: 2 }],
    direction: 'THE VERDICT: Samuel turns back and speaks, close and backlit; a slow push; the jaw speaks the words as '
      + 'they appear, eyes on Saul, hair and beard in the wind; after the last word a held silence.',
  },
  {
    id: 'saul-alone', n: 'G7', set: 'gilgal', take: 'saulAlone', dur: 3.0, cut: 'cut', cue: 'broken', beat: 'saul-hall',
    beats: { lookDown: 0.4, tighten: 1.8, flash: 2.75 },
    direction: 'Saul looks down at the torn piece in his fist: the lens opens on the fist and tilts and racks to his face; '
      + 'breath, a tremble, the fingers tighten. At the end a whip up into the light.',
  },

  // ================================================================== 5 · DAVID (10 s)
  {
    id: 'figure', n: 'D1', set: 'world', take: 'figure', dur: 6.0, cut: 'light', fade: 0.6, cue: 'figure', beat: 'david',
    beats: { verse: 0.6 },
    // in the sky at frame right; its last two words — the film's own title — in gold
    text: [{ at: 0.6, seconds: 5.2, kind: 'verse', quote: 's1_15_28_to_your_neighbor', stagger: 0.45, side: 'right', v: 'top', lines: 2, gold: 2 }],
    direction: 'Out of the light-flash: David from behind on a rock above the valley at golden hour, against the low sun; '
      + 'a slow crane / orbit; wind in his curls and tunic; he shifts his weight; 15:28b writes itself slowly.',
  },
  {
    id: 'face', n: 'D2', set: 'world', take: 'face', dur: 4.0, cut: 'cut', cue: 'face', beat: 'david',
    beats: { turn: 0.8 },
    direction: 'His face turns into the light: a slow push-in, backlit rim, shallow focus; the turn, a blink, the eyes '
      + 'settle on the distance. No text.',
  },

  // ================================================================== 6 · THE FLOCK, THE LAMB AND THE LOGO (CUT v5, 26 s) — into the game
  {
    id: 'watch', n: 'D3', set: 'world', take: 'watch', dur: 8.0, cut: 'cut', cue: 'watch', beat: 'flock',
    // verse: Ps 78:70-71 writes itself · rack: the focus racks from the flock back to him
    beats: { verse: 1.0, rack: 5.2 },
    text: [{ at: 1.0, seconds: 6.6, kind: 'verse', quote: 'ps_78_70_71_chose_david', stagger: 0.17, side: 'right', v: 'top', lines: 2 }],
    direction: 'WHAT HE SEES (the user: "David must be seen watching his flock for a few seconds"): over his right shoulder '
      + 'from behind and a little above, looking DOWN onto the flock grazing on the slope below him, 7-17 m away (the '
      + 'v9 review: readable, no pale rock filling the frame) — ewes and their lambs (one nursing at her flank), the rams, '
      + 'a goat — in the '
      + 'warm low light from the left; he watches them, calm, the wind in his curls; a slow push over his shoulder (never '
      + 'an orbit); at `rack` the focus comes back from the flock to him. Ps 78:70-71 over the far hills and the sky.',
  },
  {
    // the logo shot of CUT v4 re-made as one long, motivated take (same id / take: Intro's logo and hand-off code)
    id: 'horizon', n: 'D4', set: 'world', take: 'horizon', dur: 18.0, cut: 'cut', cue: 'horizon', beat: 'title',
    // lamb: a newborn lamb, left behind on the rocks, bleats · descend: David steps down to it · kneel / lift: he kneels
    // and gathers it into his arms · logo / hebrew / chapter: the lockup forms while he carries it to its mother ·
    // setDown: he sets it down by the ewe · logoOut: the lockup fades · settle: the camera eases back and down behind
    // him into the gameplay camera (no orbit) · the film ends at 18.0 with the game's camera
    beats: { lamb: 0.3, descend: 1.4, kneel: 4.2, lift: 5.0, logo: 6.6, hebrew: 7.6, chapter: 8.6, setDown: 11.2, logoOut: 12.2, settle: 14.6 },
    direction: 'THE NOBLE ACT AND THE LOGO (the user: the DAVID title "while he does something noble", then the camera '
      + 'moves away a little in a way that fits — not the strange orbit of CUT v4): a newborn lamb has fallen behind on the '
      + 'rocks and bleats for its mother; David steps down, kneels, gathers it into his arms (Isa 40:11 "וּבְחֵיקוֹ '
      + 'יִשָּׂא") and carries it along the slope to the ewe — the spirit of Shemot Rabbah 2:2, the midrash on Ps 78:70-71 (he '
      + 'shepherds each lamb according to its strength). ONE long take, the lens on the uphill side of the slope at about '
      + '4 m, tracking with his walk and never circling him (the orchestrator\'s v9 review: the lamb must be SEEN): his '
      + 'back as he steps down to the lamb, his left side as he kneels and gathers it (one forearm under the lamb, the '
      + 'other hand over its back, the staff leaning in the crook of his arm), then his face and the lamb — its head at '
      + 'his left shoulder — as he carries it along the slope across the frame. While he carries it DAVID forms in the '
      + 'sky, דָּוִד beneath it, then the chapter line. He kneels and sets the lamb down by its mother — it runs to her '
      + 'flank and nurses — straightens and TURNS to look out over his flock and the valley: his turn, not the camera, '
      + 'puts the lens behind him; the lockup fades; the camera only eases back and a little down onto the gameplay '
      + 'camera (yaw almost unchanged, no orbit) and the game begins without a cut, among the flock.',
  },
];

/** Legacy world flag of a shot (the score's pastoral / king contrast). */
function worldOf(s: IntroShot): IntroWorld {
  return s.set === 'coast' || s.set === 'ramah' || s.set === 'gilgal' || s.set === 'map' ? 'gibeah' : 'field';
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

/** Total length of the film (CUT v5: 134.5 s — the prologue, Gilgal, David; the lamb and the logo are its last shot). */
export const INTRO_LENGTH = introLength(INTRO_CUES);
