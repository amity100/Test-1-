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
/** (CUT v6) 'macro': the cold open's own small close-up set (cut7, src/film/macro) — the film starts without Gilgal */
export type FilmSetName = 'black' | 'macro' | 'judah' | 'coast' | 'ramah' | 'gilgal' | 'world' | 'map';

/**
 * Score cue names (data-driven: the score keys the music on these; consecutive shots with the same cue form one
 * section). CUT v2 uses: land, rachel, threat, elders, shofar, saul, peak, silence, tear, verdict, broken, figure,
 * face, thicket, title. The others are UNUSED in CUT v2 (kept only so older score code still compiles).
 */
export type FilmCue =
  | 'cold' //       C0     CUT v6: the cold open — near silence, breath, the threads snapping
  | 'glimpse' //    F1 F2  CUT v6 only (unused since CUT v6.1: the flashes are out)
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
  | 'cold' //         C0 (CUT v6) the cold open: the tear, extreme close, before anything is known
  | 'glimpse-rock' // F1 (CUT v6; OUT in CUT v6.1 — the user: the flashes were not connected) the boy on the rock
  | 'glimpse-hand' // F2 (CUT v6; OUT in CUT v6.1) a young hand on a shepherd's staff
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
// THE FILM — CUT v6 (≈103.6 s; the user, 4 Oct: "it looks like a history film, too many uninteresting parts … it must
// grip people from the first moment, wow and interesting, and still to the point … more cinematic, less predictable,
// more artistic and suspenseful — not one scene leading to the next in plain time order"; his edit: Bethlehem,
// Rachel's tomb and the tribes' map out; the Exodus map shorter and tied to OUR story; the Philistines' animation far
// better; Ramah fast and dynamic; Saul and Samuel not too long; the lamb shot natural and artistic; Saul's music must
// go on through the meeting with Samuel). docs/intro-script-v6.md is binding.
// THE QUESTION OF THE FILM: "who is the one better than you?" — it opens on the tear (C0) with no context, the title
// הַטּוֹב מִמֶּךָּ, then "before": the land, the road out of Egypt (Ps 78:52, the people led like a flock), no king,
// the Philistines, "give us a king"; the shofar, the king, two silent flashes of a shepherd we never see the face of;
// Samuel, the tear again — now understood; the verdict; and the answer: David (his face first seen in D2).
// C0 0-5 · T 5-8 · P1 8-14.5 · P4 14.5-24.5 · P6 24.5-31.5 · P7 31.5-36.5 · G1 36.5-40.5 · G2 40.5-46.5 · F1 -47.3 ·
// G3 -52.3 · F2 -53.1 · G4 -58.1 · G5a -61.6 · G5b -65.6 · G6 -71.1 · G7 -74.1 · D1 -79.6 · D2 -83.6 · D3 -89.6 ·
// D4 -103.6, then the game
//
// CUT v6.1 (wave 6; the user, 5 Oct, after Version 11 — docs/intro-script-v6-1.md is binding): the two flashes of the
// shepherd are OUT ("the quick jumps to David while we see Saul are not connected at all"); EVERY TRANSITION HAS A
// REASON AND A LOGICAL TIMING ("there must be logic in the timing of the transitions … some just jump from thing to
// thing"): a hard cut continues the action, a look or a sound and matches exactly (positions, props in hand, screen
// direction, light); a dissolve marks a change of time or place; no cut while a verse is still being read or a camera
// move is half done. Saul's spear never vanishes: it falls from his hand ON SCREEN in G5a and lies in the dust. Every
// motion must be "super natural" (real contacts — no hand through a sheep, a fist that really holds the wool).
// C0 0-4.7 · T 4.7-7.7 · P1 7.7-14.2 · P4 14.2-24.7 · P6 24.7-31.7 · P7 31.7-36.7 · G1 36.7-40.7 · G2 40.7-46.7 ·
// G3 46.7-51.7 · G4 51.7-57.7 · G5a 57.7-60.7 · G5b 60.7-64.7 · G6 64.7-70.2 · G7 70.2-74.2 · D1 74.2-79.7 ·
// D2 79.7-83.7 · D3 83.7-90.7 · D4 90.7-104.7, then the game
// ---------------------------------------------------------------------------------------------------------
export const INTRO_SHOTS: readonly IntroShot[] = [
  // ================================================================== THE COLD OPEN (7.7 s): the question
  {
    id: 'cold', n: 'C0', set: 'macro', take: 'tear:macro', dur: 4.7, cut: 'black', hold: 0.5, fade: 0.6, cue: 'cold', beat: 'saul-hall', slowmo: 0.25,
    // grip: the fist closes on the wool · pull: the cloth goes taut · rip: the first threads snap · snap: the last thread
    // (CUT v6.1: the smash to the title comes 0.5 s after `snap`, as the corner flies free — the cut on the climax)
    beats: { grip: 0.8, pull: 1.8, rip: 2.7, snap: 4.2 },
    // (cut7) a set of its own, 'macro' (src/film/macro/MacroSet.ts): a small close-up set built in a fraction of a second
    // (Saul's fist, the corner of Samuel's me'il with its tzitzit, the threads, a warm out-of-focus ground) — the film
    // starts at once; the Gilgal set is not needed until G1 (36.5 s)
    direction: 'COLD OPEN, before anything is known: near silence (breath, wool, wind). Extreme close-up, very slow '
      + 'motion, shallow focus, warm backlight through the weave: a man\'s fist (scale armour at the wrist, no face) '
      + 'closes on dark wool at the corner of a mantle (its tzitzit); the pull; the weave stretches and the threads snap '
      + 'one by one along the weft; the last thread at `snap` — and the smash to black. The viewer does not know who, '
      + 'why or where; the film answers it at G5b.',
  },
  {
    id: 'title', n: 'T', set: 'black', take: 'title', dur: 3.0, cut: 'smash', cue: 'title', beat: 'title',
    beats: { title: 0.3 },
    text: [{ at: 0.3, seconds: 2.7, kind: 'verse', quote: 's1_15_28_better_than_you', stagger: 0.35, side: 'center', v: 'middle', lines: 1, gold: 2 }],
    direction: 'Black. The film\'s title, the question of the film, forms in gold in the middle: הַטּוֹב מִמֶּךָּ. '
      + 'A low pulse in the score; nothing else.',
  },

  // ================================================================== BEFORE (29 s): the land, the road, no king, the threat, "give us a king"
  {
    id: 'land', n: 'P1', set: 'judah', take: 'flight', dur: 6.5, cut: 'black', hold: 0.3, fade: 1.0, cue: 'land', beat: 'judea',
    beats: { timeCard: 0.3, card: 3.2 },
    text: [
      { at: 0.3, seconds: 3.0, kind: 'time', narration: ['timeCard'] },
      { at: 3.2, seconds: 3.2, kind: 'person', narration: ['landIsrael', 'judahDays'], side: 'right', v: 'top' },
    ],
    direction: 'Out of black straight into the most beautiful part of the dawn flight: the sea of clouds over the Judean '
      + 'hills with the sun rising over Moab, the lens diving through a gap in the deck to the ridges and the valley fog '
      + '(the second half of CUT v5\'s P1: a span / take offset, faster). The time card over its first seconds.',
  },
  {
    // (CUT v6.1) comes in as a MATCH DISSOLVE: the map opens on the same ridges at the same angle and light as P1's last
    // frame and soars up and back to the whole region — one continuous rise, no change of direction under the dissolve
    id: 'map-exodus', n: 'P4', set: 'map', take: 'exodus', dur: 10.5, cut: 'dissolve', fade: 1.2, cue: 'map', beat: 'judea',
    // egypt: the lens high over the region · flock: the road out of Egypt draws itself as a FLOCK of light — many small
    // lights moving together behind one, through the wilderness (Ps 78:52) · jordan: across the Jordan · land: the lens
    // sinks over the land of Israel, scattered tribes, no king (Judg 21:25) — and goes on toward the coast
    // (map1, CUT v6.1: egypt 0.6 -> 0.9 — the lens lifts off P1's ridges as the match dissolve ends; flock 1.4 -> 1.7 —
    //  the lights leave the delta as it comes into view on the soar)
    beats: { egypt: 0.9, flock: 1.7, verse: 1.8, jordan: 4.8, gilgal: 5.4, land: 5.8, noKing: 6.0 },
    text: [
      { at: 1.8, seconds: 3.8, kind: 'verse', quote: 'ps_78_52_flock', stagger: 0.15, side: 'center', v: 'bottom', lines: 1 },
      { at: 6.0, seconds: 4.4, kind: 'verse', quote: 'jdg_21_25_no_king', stagger: 0.12, side: 'center', v: 'bottom', lines: 2 },
    ],
    direction: 'The realistic 3D map, short and tied to the story (the user: "connect it to our story — how we got to '
      + 'David\'s story; something similar happens with the people of Israel"): out of Egypt the people go like a flock — '
      + 'the route is drawn as a stream of many small lights moving together like sheep behind a shepherd, through the '
      + 'wilderness, across the Jordan to Gilgal (Ps 78:52 — the same psalm that chooses David from the sheepfolds at the '
      + 'end); then the lens sinks over the land: the tribes scattered, no king (Judg 21:25), the coast and the Philistine '
      + 'cities glowing at the edge of the frame as the lens turns toward them. No names, no labels beyond the few that '
      + 'orient (Egypt, the Jordan).',
  },
  {
    id: 'philistines', n: 'P6', set: 'coast', take: 'threat', dur: 7.0, cut: 'dissolve', fade: 1.0, cue: 'threat', beat: 'warriors',
    // crane: the lens leaves the front ranks and rises over the column · settle: the crane has arrived (eased out) — the
    // hard cut to P7 lands on the drum hit at the end of the shot, never in the middle of the move (CUT v6.1)
    beats: { card: 0.6, crane: 2.4, settle: 6.4 },
    text: [{ at: 0.6, seconds: 3.0, kind: 'place', narration: ['philistia'], side: 'right', v: 'top' }],
    direction: 'The Philistine front rank marching out of the dust at a low lens, then the rise over the column (CUT v5.2 '
      + 'staging). THE ANIMATION AND THE POLISH MUST BE OF A TOP GAME TODAY (the user: "the animation here is most '
      + 'embarrassing and looks very bad"): every near man walks his own believable march (weight, stride, arms, heads, '
      + 'no lockstep, no sliding feet, no popping), weapons and shields carried with weight, cloth and plumes moving, '
      + 'faces lit, dust kicked up by the feet; the far column alive. Shorter: 7 s.',
  },
  {
    id: 'elders', n: 'P7', set: 'ramah', take: 'elders', dur: 5.0, cut: 'cut', cue: 'elders', beat: 'saul-court',
    // rise: the elder is already rising — the lens pushes fast on his raised arm · verse: 8:5 · away: Samuel's eyes close
    beats: { rise: 0.2, verse: 0.6, away: 3.4 },
    text: [{ at: 0.6, seconds: 4.2, kind: 'verse', quote: 's1_8_5_give_us_king', stagger: 0.12, side: 'left', v: 'top', lines: 2 }],
    direction: 'FAST AND DYNAMIC (the user: "watching people who only move their heads is annoying — it must be quick"): '
      + 'cut straight into the action — an elder already rising from the bench, his arm thrust out toward Samuel, the '
      + 'others half-risen with him, a quick push in; 8:5 on screen at once; at `away` a sharp cut / rack to Samuel\'s face '
      + 'as his eyes close and he turns away (8:6). No card.',
  },

  // ================================================================== THE KING (15 s): the shofar, Saul, the roar (CUT v6.1: no flashes)
  {
    // the shot of CUT v3/v4 from its shofar on (shot time 0 = the old G1's 1.5 s: TAKE_OFFSET 1.5)
    id: 'dust', n: 'G1', set: 'gilgal', take: 'dustWall', dur: 4.0, cut: 'hard', cue: 'shofar', beat: 'warriors',
    // wipe (CUT v6.1): a man of the front rank passes close across the lens — the cut to G2 is hidden in his passing
    beats: { shofar: 0.0, horns: 0.6, card: 1.3, wipe: 3.6 },
    text: [{ at: 1.3, seconds: 2.5, kind: 'place', narration: ['gilgal'], side: 'left', v: 'top' }],
    direction: 'HARD CUT ON THE SHOFAR BLAST: the army out of the dust wall at the lens; the rams\' horns blown in the '
      + 'front rank. From here SAUL\'S MUSIC runs without a break to the tear (the user).',
  },
  {
    id: 'king', n: 'G2', set: 'gilgal', take: 'king', dur: 6.0, cut: 'cut', cue: 'saul', beat: 'warriors', slowmo: 0.5,
    // lastStep (CUT v6.1): the stride that leads into the halt begins — G3 picks the same stride up (a cut on action)
    beats: { card: 1.0, headTurn: 3.4, lastStep: 5.6 },
    text: [{ at: 1.0, seconds: 3.4, kind: 'person', narration: ['saulShort', 'saulTitle'], side: 'left', v: 'top' }],
    direction: 'SAUL — the slow-motion stride at the head of the army, the sun behind him, the name huge in the sky.',
  },
  {
    id: 'spear', n: 'G3', set: 'gilgal', take: 'spearRaised', dur: 5.0, cut: 'cut', cue: 'peak', beat: 'warriors',
    // notice (CUT v6.1): the nearest men's heads begin to turn toward the road — the roar breaks off on the cut to G4,
    // which shows what they see (a cut on sound and eyeline)
    beats: { halt: 0.6, spearUp: 1.3, roar: 1.7, roarSpread: 0.5, verse: 2.0, notice: 4.5 },
    text: [{ at: 2.0, seconds: 2.8, kind: 'verse', quote: 's1_9_2_head_above', stagger: 0.14, refAfter: 0.4, side: 'left', v: 'top', lines: 2 }],
    direction: 'The halt; Saul thrusts his spear up; THE ROAR through every rank.',
  },

  // ================================================================== THE FALL (22.5 s): Samuel, the tear — now understood — the verdict, Saul alone
  {
    id: 'silence', n: 'G4', set: 'gilgal', take: 'silence', dur: 6.0, cut: 'cut', cue: 'silence', beat: 'saul-hall',
    // turnGo (CUT v6.1): 15:26 has been read; Samuel begins to turn away — G5a continues the same turn (a cut on action)
    beats: { roarCut: 0.0, headsTurn: 0.3, part: 0.8, card: 0.8, step: 2.0, verse: 1.8, turnGo: 5.6 },
    text: [
      { at: 0.8, seconds: 2.0, kind: 'person', narration: ['samuel'], side: 'right', v: 'top' },
      { at: 1.8, seconds: 4.2, kind: 'verse', quote: 's1_15_26_rejected_film', stagger: 0.14, side: 'left', v: 'top', lines: 2 },
    ],
    direction: 'Saul\'s music goes on — darker, not a hush (the user). What the army saw: Samuel in the road; the ranks '
      + 'part; he comes up and stands before the king; 15:26 as he speaks. SAUL\'S SPEAR stays gripped in his right fist '
      + '(fingers closed round the shaft — never an open hand beside a standing shaft). As the verse ends Samuel turns to go.',
  },
  {
    id: 'tear', n: 'G5a', set: 'gilgal', take: 'tear', dur: 3.0, cut: 'cut', cue: 'tear', beat: 'saul-hall',
    // (CUT v6.1, provisional — cut7 sets them): turn: Samuel's turn continues from G4's last frame (same positions) ·
    // drop: Saul's right hand opens and THE SPEAR FALLS (the shaft strikes the dust and lies there) · lunge: his two
    // quick steps after Samuel · kneel: the knee strikes the ground · grip: the empty right fist closes on the corner
    // of the me'il — the cut to G5b comes ~0.4 s later as the pull begins (a cut on action)
    // (cut7, wave 6: set — spearHits: the shaft strikes the dust, the knock; the fall's own physics from `drop`,
    // src/film/gilgal/spearFall.ts — a 2.5 m spear topples in ~1 s)
    beats: { turn: 0.0, drop: 0.5, spearHits: 1.52, lunge: 0.8, kneel: 1.9, grip: 2.6 },
    direction: 'Samuel turns to go (15:27) — the same turn, the same places as the end of G4 (Saul a pace from him). Saul '
      + 'lets the spear fall from his hand, ON SCREEN — it topples, strikes the dust and lies there (it never vanishes) — '
      + 'takes two quick steps after him, drops to his knee and seizes the corner of his mantle with that hand.',
  },
  {
    id: 'tear-insert', n: 'G5b', set: 'gilgal', take: 'tear:insert', dur: 4.0, cut: 'cut', cue: 'tear', beat: 'saul-hall', slowmo: 0.35,
    // stop (CUT v6.1): Samuel stops and begins to turn back — G6 continues his turn (a cut on action)
    beats: { pull: 0.3, rip: 1.1, free: 3.0, stop: 3.5 },
    direction: 'The tear in slow motion — the moment of the cold open, now seen whole and understood: Saul on his knee, '
      + 'THE FIST REALLY IN THE WOOL (the cloth gathered in it, stretched taut from the fist to Samuel), the rip, the '
      + 'corner coming free in his fist while Samuel walks on — and stops. The spear lies in the dust where it fell. '
      + 'The music\'s peak.',
  },
  {
    id: 'verdict', n: 'G6', set: 'gilgal', take: 'verdict', dur: 5.5, cut: 'cut', cue: 'verdict', beat: 'saul-hall',
    // lookDown (CUT v6.1): after the last word his eyes go down to Saul — G7 is what he sees (an eyeline cut)
    beats: { turnBack: 0.5, speech: 1.2, speechEnd: 4.9, lookDown: 5.0 },
    text: [{ at: 1.2, seconds: 4.3, kind: 'verse', quote: 's1_15_28_torn_today', words: VERDICT_WORDS, refAfter: 0.3, side: 'left', v: 'top', lines: 2 }],
    direction: 'THE VERDICT: Samuel turns back and speaks, close and backlit; the jaw speaks the words as they appear.',
  },
  {
    id: 'saul-alone', n: 'G7', set: 'gilgal', take: 'saulAlone', dur: 4.0, cut: 'cut', cue: 'broken', beat: 'saul-hall',
    // (CUT v6.1: a real breath — 3.0 -> 4.0 s; the lens rises from his fist to his face and on into the sun at `flash`)
    beats: { lookDown: 0.5, tighten: 2.0, flash: 3.55 },
    direction: 'Saul alone on his knee with the torn piece in his fist, his spear in the dust beside him; the one breath '
      + 'of quiet; the lens rises past his face into the sun.',
  },

  // ================================================================== THE ANSWER (30.5 s): David
  {
    id: 'figure', n: 'D1', set: 'world', take: 'figure', dur: 5.5, cut: 'light', fade: 0.8, cue: 'figure', beat: 'david',
    // turn (CUT v6.1): a lamb bleats below; he begins to turn his head — D2 continues the turn (a cut on action)
    beats: { verse: 0.6, turn: 5.0 },
    text: [{ at: 0.6, seconds: 4.8, kind: 'verse', quote: 's1_15_28_to_your_neighbor', stagger: 0.42, side: 'right', v: 'top', lines: 2, gold: 2 }],
    direction: 'Out of the light: a boy from behind on a rock above the valley at golden hour, his staff, his flock '
      + 'below; 15:28b answers the title: …הַטּוֹב מִמֶּךָּ. A lamb bleats; he begins to turn his head.',
  },
  {
    id: 'face', n: 'D2', set: 'world', take: 'face', dur: 4.0, cut: 'cut', cue: 'face', beat: 'david',
    // (CUT v6.1, provisional — cut8 sets them) turn: the head turn continues from D1's last frame into the light ·
    // lookDown: his eyes go down to his flock — D3 is what he sees (an eyeline cut)
    beats: { turn: 0.1, lookDown: 3.3 },
    direction: 'THE REVEAL: for the first time in the film, his face — the turn begun in D1 brings it into the light. '
      + 'Then his eyes go down to his flock. No text.',
  },
  {
    id: 'watch', n: 'D3', set: 'world', take: 'watch', dur: 7.0, cut: 'cut', cue: 'watch', beat: 'flock',
    // (CUT v6.1: 14 words need ~6 s on screen — 6.0 -> 7.0 s) walk: he starts down the slope toward his flock — the
    // dissolve into D4 rides his step (time passes)
    beats: { verse: 0.6, rack: 4.6, walk: 6.2 },
    text: [{ at: 0.6, seconds: 6.2, kind: 'verse', quote: 'ps_78_70_71_chose_david', stagger: 0.15, side: 'right', v: 'top', lines: 2 }],
    direction: 'What he sees: over his shoulder onto his flock below; Ps 78:70-71 — the psalm of the map, now about him. '
      + 'At `walk` he starts down toward them.',
  },
  {
    id: 'horizon', n: 'D4', set: 'world', take: 'horizon', dur: 14.0, cut: 'dissolve', fade: 1.0, cue: 'horizon', beat: 'title',
    // provisional beats (cut8 re-stages the take and sets them): the shepherd at work · the lamb lifted · the lockup ·
    // the lamb at its mother · the lockup out · the camera settles into the game
    beats: { lamb: 0.3, descend: 1.2, kneel: 3.4, lift: 4.0, logo: 5.2, hebrew: 6.0, chapter: 6.8, setDown: 9.0, logoOut: 9.8, settle: 11.4 },
    direction: 'NATURAL AND ARTISTIC (the user: "the lamb lifting must be far more polished, and David must look really '
      + 'artistic — busy with his flock and his work as a shepherd; what we see must be very natural"): David at work '
      + 'among his flock — moving through the sheep, a touch on a ewe\'s back, the staff, a look over them — then he '
      + 'kneels to a newborn lamb and gathers it up with real weight and care (the hands under its chest and belly, the '
      + 'lamb\'s legs and head alive, held to his chest), carries it to its mother and sets it down; DAVID forms; the '
      + 'camera eases into the game. One long, beautifully framed take with the light behind him. (CUT v6.1, the user: '
      + '"when David takes hold of the sheep his hand really goes through it — strange and disturbing": every contact '
      + 'is real — the hand rests ON the wool, the hands under the lamb press into its wool and never through it.)',
  },
];

/** Legacy world flag of a shot (the score's pastoral / king contrast). */
function worldOf(s: IntroShot): IntroWorld {
  return s.set === 'coast' || s.set === 'ramah' || s.set === 'gilgal' || s.set === 'map' || s.set === 'macro' ? 'gibeah' : 'field';
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

/** Total length of the film (CUT v6.1: 104.7 s — the prologue, Gilgal, David; the lamb and the logo are its last shot). */
export const INTRO_LENGTH = introLength(INTRO_CUES);
