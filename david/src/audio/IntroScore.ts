/**
 * DAVID — score and sound design of the opening film "הַטּוֹב מִמֶּךָּ", CUT v6.1 (104.7 s, docs/intro-script-v6-1.md on
 * top of docs/intro-script-v6.md: the
 * question and its answer — the cold open on the tear, the title, "before" (the land, the map, the host, Ramah), the
 * king (the shofar, Saul, the roar, two silent flashes of a shepherd), the fall (Samuel, the tear — the music's peak —
 * the verdict, Saul alone) and the answer (David, his face, the flock, the lamb and the logo, the hand-off into the
 * game)), synchronised to the film's shot sheet (src/content/introScript.ts). The sections of CUT v5 (Bethlehem,
 * Rachel's tomb, the tribes' map) are still scored if a sheet uses their cues.
 *
 * CUT v6 IN SHORT (the user: Saul's music must go on through the meeting with Samuel): C0 near silence — breath, wind,
 * the wool under strain, each thread snapping close and real, a very low tension; the smash to black and the TITLE's
 * one deep pulse and single low D, which becomes the land's drone; "before" is one build (the land theme rising with the
 * dawn, the map's people led like a flock — the theme warm and moving with the shepherd's pipe — "no king" darker, the
 * coast's Phrygian swell, the host's drums from its first frame, Ramah's fast tense ostinato) cut by the shofar; from
 * the shofar ONE LINE of Saul's music without a break — his stride, the spear and the roar, Samuel's arrival and 15:26
 * (his theme going on darker and heavier: Dm – B♭ – Gm – E♭ – A, never a hush), the turn and the grip (quickening), its
 * PEAK on the tear (the tutti on the rip) — the verdict its lowest, Saul alone the one breath, then the light.
 *
 * CUT v6.1 — THE SOUND CARRIES EVERY CUT (the user: "the transitions must be logical"; rule 6 of the edit): the last
 * thread's snap and the smash to the title are one gesture; P6's phrase closes on a drum hit exactly on the hard cut to
 * Ramah (after the crane has arrived, `settle`); the shofar on the cut to Gilgal; the cut to G2 hidden in a man passing
 * the lens (G1 `wipe`: his pass crosses the cut); G2's last stroke on his last stride (`lastStep`), none on the cut —
 * the stride goes on into G3's halt; the roar thins from G3 `notice` and BREAKS OFF on the cut to G4 while the king's
 * line goes on darker; the dominant on Samuel's turn (G4 `turnGo`) carries the cut to G5a; the spear's fall
 * (`spearHits`) and the knee (`kneel`) under the music; the grip into the peak; Samuel's stop (G5b `stop`) into the
 * verdict; a low breath on his look down (G6 `lookDown`) into G7; the flash into the light; a lamb's bleat 0.3 s before
 * David turns his head (D1 `turn`: a J-cut); the kinnor falling with his look (D2 `lookDown`) into D3; from D3 `walk` a
 * walking phrase and the kinnor carry the dissolve into D4. The flashes of CUT v6 are gone (an overlay cue, if a sheet
 * still had one, would only add a faint shimmer).
 *
 * KEYING. The sheet is read when the score starts. Every shot cue gets a musical ROLE (from its `cue`, else from its
 * set); consecutive shots with the same role form one section [t0, t1) with its own bus. A first shot that comes out of
 * black ON A HIT (CUT v3/v4: the shofar) gets an 'open' section for its black; one whose picture RISES out of black
 * (CUT v5's P1: `fade` > 0.3) keeps its black inside its own section. Every event is placed relative to a shot start, an
 * on-screen text, or a named BEAT inside a shot — the beats of the timing contract (the time card, the picture, the
 * flock, the rise, the climb, Egypt, the exodus, the wilderness, the Jordan, Gilgal, the tribes, the cities, the rise
 * and the turning away at Ramah, the blast, the horns, … the lamb, the descent, the kneel, the lift, the logo, the
 * Hebrew name, the chapter line, the set-down, the logo out, the settle). A beat is read from the shot's own `beats` in
 * the sheet (shot seconds), otherwise from the contract (SYNC below), and is clamped to its shot. Nothing is keyed on
 * absolute film seconds: a retimed sheet stays in sync. How a section is left comes from the NEXT shot's transition
 * (and RING for the musical joins): a hard cut or a smash (the blast out of Ramah, the cold open into the title) cuts
 * the bus a breath (GAP) before the frame; the roar into G4, the host into Ramah and the tear into the verdict FALL from
 * the frame (sag, then die away — never a dead stop) under the music that goes on; dissolves crossfade over their
 * length; the title into the land, "before"'s joins and David's theme ring on across their cuts. Events are built just
 * ahead of the audio clock (≤ 0.5 s; the hits of the hard cuts only
 * ≤ 60 ms ahead, so a picture stall before a cut cannot make them early), and the film's clock (syncIntro) re-anchors
 * the score after hitches.
 *
 * THE ARC (CUT v5's order — CUT v6 re-orders and reshapes it as above; D: the land in open fifths and D major, the
 * history darkening to D minor / Phrygian for the king, D Dorian → D major for David):
 *   0 PROLOGUE   out of silence a low air and, under the time card, a deep bloom on a D pedal; the LAND theme (D A | G A C
 *                | D, horns and strings, the light an open fifth above) rises with the picture into D major; BETHLEHEM
 *                in 6/8 — the kinnor, the pipe, a few sheep bells, a shepherd's far call; RACHEL — a woman's wordless
 *                lament (A B♭ A G F E D), rising with the lens into the sky; THE MAP — the climb swells to a broad D
 *                minor on Egypt, the processional (the land theme as a march: the tof, low strings, horns) walks out
 *                with the line of light, thins to wind and a lonely pipe in the wilderness, rolls across the Jordan
 *                (water, a kinnor glissando) and ARRIVES at Gilgal in D major, ringing on through the invisible cut;
 *                THE JUDGES — twelve plucks for the tribes, then "no king in Israel": the harmony slips to B♭ and G
 *                minor, an uneven pulse, the king's three notes (D A B♭); five strokes and a low Phrygian horn cluster
 *                for the Philistine cities; THE HOST — (CUT v5.2: from its first frame) war drums and low horns (D E♭ D
 *                C D … A), thousands on foot, bronze, the anvil under 13:19, its last stroke ringing across the cut as
 *                it falls away; RAMAH — the elders' murmur, the king's notes again under "give us a king", a
 *                tense, unresolved cluster when Samuel turns away, sucked into a breath of silence —
 *   1 GILGAL     THE SHOFAR with the hard cut (the blast, the hit, a low chord), the front rank's horns, the army out of
 *                the dust (thousands on foot, the murmur, bronze), a slow processional of drums and low men's voices.
 *                SAUL in slow motion: the world muffled, the drums at half time, his theme D A B♭-A G F in low strings
 *                and men's voices across the whole take — its B♭ on the head turn over the ranks — and the E held into:
 *   2 THE SPEAR  the halt (thousands of feet stop), a drum roll and a riser, the spear going up, and ON THE ROAR the
 *                theme resolves to D at full power (choir, strings, drums, thousands shouting, the teruah), its head
 *                restated and held — then (CUT v6, the user: the music goes ON when Samuel comes) the roar falls away
 *                under the king's music, which carries on darker and heavier: his stride at half time, his theme in
 *                the low horns and the men (D A B♭ … G F E♭ D C♯) over Dm – B♭ – Gm – E♭ – A under 15:26, one high A
 *                from Samuel's name — never a hush.
 *   3 THE TEAR   the turn: the pulse quickens, the theme climbs (A B♭ C D, E♭ trembling over the lunge), a riser into
 *                the grip; in slow motion the PEAK — Gm swelling, the tutti on E♭ ON the rip with the theme's head on
 *                top, the break onto A when the corner comes free (the last thread), falling into the verdict.
 *   4 VERDICT    near-silence, one deep stroke on its last word, then the held silence; SAUL ALONE: his motif on a lone
 *                cello, falling below the tonic into the warm light-flash.
 *   5 DAVID      a D-major bloom out of the light; the kinnor in 6/8, David's motif (D A G F E F D) on the shepherd's pipe
 *                under 15:28b; he turns into the light: the voices open, the kinnor and the pipe answer — the last bar
 *                on the dominant, ringing on across the cut into:
 *   6 THE FLOCK  (D3) warm and intimate: the kinnor's lilt in D major, a tender pipe line under Ps 78:70-71, soft voices,
 *                the flock's bells close by, the wind; the focus comes back to him on the motif's head.
 *     THE LAMB   (D4, one take) the music thins to a held chord for the lamb's bleat; he steps down (the kinnor walks,
 *     AND THE    vi–IV), kneels (a hush), gathers it up (the strings and the voices swell, David's motif rising on the
 *     LOGO       pipe so that its tonic falls ON the logo) — the warm D-major arrival on `logo` (the tutti, the choir, a
 *                strum, a warm stroke: an arrival, not a smash); the theme's answer under the Hebrew name, the chapter
 *                line on IV; a tender V–I cadence ON `setDown` (the lamb back with its mother, the ewe answering); the
 *                lockup fades into an afterglow; from `settle` the orchestra lets go into the game's 6/8 ON the game's
 *                own grid and at the end of the shot the score starts the game's pastoral music on its bar line
 *                (onHandoff) and rings out under it: no silence, no seam. A skip plays a compact logo statement.
 * Period instruments: shofar (1 Sam 13:3), tof, chalil, kinnor, nevel (10:5); the lament is a woman's voice (Jer
 * 31:15, Rachel weeping for her children; Rashi on Gen 48:7). The lyre is kept out of Saul's music (it enters his house
 * only after 16:23); drums are the score's, never on screen in Israel's army (docs/visual-bible.md §6); no horses in
 * Israel's sound (Israel fought on foot, 15:4); the Philistine host is heard on foot (the picture shows infantry).
 */
import type { IntroCue } from '../content/introScript';
import type { BedName } from './Beds';
import {
  Core, Synth, Voice, clamp, rand, randi, chance, pick, CHORDS, voicing, rootIn, lyrePan,
  type Out, type ChordName, type NeyNote,
} from './synth';
import { FilmSound, type SungNote } from './FilmSound';

/** The musical role of a shot (several consecutive shots of one role share a section and its bus). */
export type ScoreRole =
  | 'open' | 'cold' | 'title'
  | 'land' | 'bethlehem' | 'rachel' | 'map' | 'judges' | 'threat' | 'elders'
  | 'shofar' | 'saul' | 'peak' | 'silence' | 'tear' | 'verdict' | 'broken'
  | 'david' | 'watch' | 'horizon';

/**
 * Role of a shot from its score cue (FilmCue of the sheet). A shot with an unknown cue is left out (the section before
 * it rings on). CUT v6: 'cold' (C0, the cold open) and 'title' (T, the title on black) have music of their own; the
 * flashes ('glimpse', F1 / F2) are never sections — the king's music goes on under them (GLIMPSE: an overlay only).
 */
const ROLE_OF_CUE: Readonly<Record<string, ScoreRole>> = {
  cold: 'cold', title: 'title',
  land: 'land', judea: 'land', flight: 'land',
  bethlehem: 'bethlehem',
  rachel: 'rachel',
  map: 'map', exodus: 'map',
  judges: 'judges', tribes: 'judges',
  threat: 'threat', philistines: 'threat', coast: 'threat',
  elders: 'elders', ramah: 'elders',
  shofar: 'shofar', army: 'shofar', dust: 'shofar',
  saul: 'saul', king: 'saul', stride: 'saul',
  peak: 'peak', spear: 'peak', roar: 'peak',
  silence: 'silence', samuel: 'silence',
  faceoff: 'tear', tear: 'tear', rip: 'tear',
  verdict: 'verdict',
  broken: 'broken', alone: 'broken', saulAlone: 'broken',
  rise: 'david', flash: 'david', figure: 'david', david: 'david', face: 'david', contrast: 'david',
  watch: 'watch', flock: 'watch',
  horizon: 'horizon', logo: 'horizon', panorama: 'horizon', crane: 'horizon',
};
/** Cues that are an overlay inside the running section, never a section of their own (CUT v6's flashes). */
const OVERLAY_CUES: ReadonlySet<string> = new Set(['glimpse']); // (CUT v6's flashes; none in CUT v6.1)
/** ... or from its set when the cue is unknown (a Gilgal shot without a known cue gets no music of its own). */
const ROLE_OF_SET: Readonly<Record<string, ScoreRole>> = { world: 'david', judah: 'land', map: 'map', coast: 'threat', ramah: 'elders' };

/**
 * Beats inside the shots of each role: [index of the shot inside the role's section, shot seconds] — the timing
 * contract of docs/intro-script-v5.md (and -v3 / -v4), used only when the sheet lacks a beat. A beat the sheet carries
 * itself (a shot cue's `beats`, shot seconds, same name or an ALIAS, case-insensitive) wins. Every beat is clamped to its
 * shot.
 */
const SYNC: Readonly<Record<ScoreRole, Readonly<Record<string, readonly [number, number]>>>> = {
  open: { time: [0, 0.2], blast: [0, 1.5] },
  // CUT v6.1 (docs/intro-script-v6-1.md; v6 for the rest)
  cold: { grip: [0, 0.8], pull: [0, 1.8], rip: [0, 2.7], snap: [0, 4.2] },
  title: { title: [0, 0.3] },
  land: { time: [0, 0.3], picture: [0, 0.3], card: [0, 3.2] },
  bethlehem: { card: [0, 1.0], flock: [0, 2.2] },
  rachel: { card: [0, 0.6], verse: [0, 1.6], rise: [0, 4.0] },
  map: { egypt: [0, 0.6], flock: [0, 1.4], verse: [0, 1.8], jordan: [0, 4.8], gilgal: [0, 5.4], land: [0, 5.8], noKing: [0, 6.0] },
  judges: { tribes: [0, 0.4], verse: [0, 2.6], cities: [0, 6.2] },
  threat: { card: [0, 0.6], crane: [0, 2.4], settle: [0, 6.4] },
  elders: { rise: [0, 0.2], verse: [0, 0.6], away: [0, 3.4] },
  shofar: { blast: [0, 0], horns: [0, 0.6], card: [0, 1.3], wipe: [0, 3.6] },
  saul: { card: [0, 1.0], head: [0, 3.4], lastStep: [0, 5.6] },
  peak: { halt: [0, 0.6], spear: [0, 1.3], roar: [0, 1.7], spread: [0, 0.5], verse: [0, 2.0], notice: [0, 4.5] },
  silence: { heads: [0, 0.3], part: [0, 0.8], card: [0, 0.8], step: [0, 2.0], verse: [0, 1.8], turnGo: [0, 5.6] },
  tear: {
    turn: [0, 0.0], drop: [0, 0.5], spearHits: [0, 1.52], lunge: [0, 0.8], kneel: [0, 1.9], grip: [0, 2.6],
    pull: [1, 0.3], rip: [1, 1.1], free: [1, 3.0], stop: [1, 3.5],
  },
  verdict: { turn: [0, 0.5], words: [0, 1.2], wordsEnd: [0, 4.9], lookDown: [0, 5.0] },
  broken: { look: [0, 0.5], tighten: [0, 2.0], flash: [0, 3.55] },
  david: { verse: [0, 0.6], turn: [1, 0.1], lookDown: [1, 3.3] },
  watch: { verse: [0, 0.6], rack: [0, 4.6], walk: [0, 6.2] },
  horizon: {
    lamb: [0, 0.3], descend: [0, 1.2], kneel: [0, 3.4], lift: [0, 4.0], logo: [0, 5.2], hebrew: [0, 6.0], chapter: [0, 6.8],
    setDown: [0, 9.0], logoOut: [0, 9.8], settle: [0, 11.4],
  },
};
/** Other names a sheet may give a beat (normalised: lower case, letters only). */
const ALIAS: Readonly<Record<string, readonly string[]>> = {
  time: ['timecard'],
  blast: ['shofar', 'picture', 'picturein'],
  picture: ['picturein', 'imagein'],
  card: ['placecard', 'personcard', 'name'],
  head: ['headturn', 'turnhead', 'look'],
  verse: ['text', 'versestart'],
  turn: ['turnaway', 'samuelturns', 'turnback'],
  horns: ['hornslifted', 'blow', 'shofarot'],
  halt: ['stop'],
  spear: ['spearup', 'raise', 'lift', 'spearraised', 'thrust'],
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
  words: ['speech', 'speak'],
  wordsEnd: ['speechend', 'wordsend'],
  look: ['looksdown', 'lookdown'],
  tighten: ['fingers', 'fingerstighten', 'fist'],
  flash: ['whip', 'light'],
  rise: ['riseup', 'stand'],
  crane: ['craneup', 'rise'],
  climb: ['start'],
  egypt: ['region', 'mitzrayim'],
  exodus: ['route', 'line', 'linestart'],
  wilderness: ['desert', 'midbar'],
  jordan: ['crossing'],
  gilgal: ['arrival', 'camp'],
  tribes: ['tribenames'],
  cities: ['philistines', 'fivecities'],
  away: ['turnsaway', 'samuelaway'],
  rack: ['focus', 'refocus'],
  lamb: ['bleat', 'lambbleat'],
  descend: ['stepdown', 'down'],
  kneel: ['kneels'],
  lift: ['gather', 'pickup', 'lifts'],
  logo: ['title', 'logoin', 'davidlogo'],
  hebrew: ['hebrewname', 'davidhe', 'name'],
  chapter: ['chapterline', 'subtitle'],
  setDown: ['setdown', 'putdown', 'mother'],
  logoOut: ['logofade', 'lockupout'],
  settle: ['glide', 'handoff', 'settledown'],
};
/** Beat names (normalised) of the first shot's own picture coming in out of the black on a HIT — the end of 'open'. */
const PICTURE_IN = ['shofar', 'blast', 'picture', 'picturein'];
/** Contract lengths of the shots of the multi-shot roles (when a sheet merges them into one shot). */
const SPLIT: Partial<Record<ScoreRole, readonly number[]>> = { tear: [3.0, 4.0], david: [5.5, 4.0] };
/** Musical joins that ring on across their cut or dissolve ("from>to"): the bus is not faded, the layers overlap. */
const RING: ReadonlySet<string> = new Set([
  // CUT v6: the title's low note into the land; "before" is one build (the land, the map, the host)
  'title>land', 'land>map', 'map>threat',
  'land>bethlehem', 'bethlehem>rachel', 'rachel>map', 'map>judges', 'judges>threat',
  'david>watch', 'david>horizon', 'watch>horizon',
]);

/** Ambience bed per role (the score switches beds until the game calls ambience(name) itself). */
const ROLE_BED: Readonly<Record<ScoreRole, BedName>> = {
  open: 'none', cold: 'none', title: 'none',
  land: 'heights', bethlehem: 'dawn', rachel: 'dawn', map: 'heights', judges: 'heights', threat: 'coast', elders: 'ramah',
  shofar: 'gilgal', saul: 'gilgal', peak: 'gilgal', silence: 'gilgal', tear: 'gilgal', verdict: 'gilgal', broken: 'gilgal',
  david: 'fields', watch: 'fields', horizon: 'fields',
};

/** 120 bpm: every cut of the contract falls on this half-second grid. */
const BEAT = 0.5;
/** The pastoral 6/8 (s per eighth: a dotted quarter = 1 s, a bar = 2 s). */
const STEP68 = 1 / 3;
/** The breath of silence before a hit on a hard cut (the blast out of Ramah) (s). */
const GAP = 0.07;
/**
 * The game's pastoral 6/8 (s per eighth; AudioEngine's PastoralComposer runs on it): the score's settle lets go on this
 * grid, so its last bar ends exactly on the hand-off and the game's first bar continues it.
 */
export const PASTORAL_EIGHTH = 0.34;
const GAME_EIGHTH = PASTORAL_EIGHTH;
/** A skip's compact logo statement (s after the skip): the answer, the chapter pluck, the let-go, the hand-off. */
export const SKIP_STATEMENT = { hebrew: 1.0, chapter: 2.0, settle: 4.4, end: 6.4 } as const;
/**
 * The voices of D4's cue — the newborn lamb, then its mother (the ewe) — played by the score: film time = the shot's beat
 * + offset (s). cut8 can move the mouths on the same times (Flock animal bleat(0): animation only).
 */
export const D4_BLEATS: ReadonlyArray<{ who: 'lamb' | 'ewe'; beat: string; offset: number; v: number; far?: boolean; murmur?: boolean }> = [
  // cut8's schedule (scratchpad/wf/cut8_notes.md, 2 Oct 08:26) — D4 shot time = the beat + offset
  { who: 'lamb', beat: 'lamb', offset: 0, v: 0.85 }, //            the newborn, plaintive, alone on the rocks (0.3)
  { who: 'lamb', beat: 'lamb', offset: 1.25, v: 0.95 }, //         louder, as David steps down (1.55)
  { who: 'ewe', beat: 'descend', offset: 1.2, v: 0.6, far: true }, // its mother answers from below, far (2.6)
  { who: 'lamb', beat: 'kneel', offset: 0.35, v: 0.55 }, //        as he kneels to it (4.55)
  { who: 'lamb', beat: 'chapter', offset: 0.7, v: 0.3 }, //        soft, in his arms (9.3)
  { who: 'ewe', beat: 'setDown', offset: -0.5, v: 0.7 }, //        she calls as he brings it (10.7)
  { who: 'lamb', beat: 'setDown', offset: 0.35, v: 0.6 }, //       it answers and runs to her (11.55)
  { who: 'ewe', beat: 'setDown', offset: 1.0, v: 0.35, murmur: true }, // her low murmur as it nurses (12.2; no mouth)
];

// David's motif (D A G F E F D) as [offset from tonic, units] — Dorian, and its major form (D A G F♯ E F♯ D: the logo)
const DAVID: ReadonlyArray<readonly [number, number]> = [[0, 2], [7, 2], [5, 1], [3, 1], [2, 1], [3, 1], [0, 3]];
const DAVID_MAJOR: ReadonlyArray<readonly [number, number]> = [[0, 2], [7, 2], [5, 1], [4, 1], [2, 1], [4, 1], [0, 3]];
// the answer as he turns into the light (A B C♯ D C♯ A G A) — D major
const ANSWER: ReadonlyArray<readonly [number, number]> = [[-5, 1], [-3, 1], [-1, 1], [0, 2], [-1, 1], [-5, 1], [-7, 1], [-5, 3]];

/** cut: off at the frame (a breath early before a hit) · x: crossfade · ring: rings on · fall (CUT v5.2): sags to `fallTo`
 *  on the frame and dies away (tau) — the roar into G4's hush, the host into Ramah: never a dead stop */
type Exit = 'cut' | 'x' | 'ring' | 'fall';
interface Shot { t: number; id: string; dur: number; cut: string; fade: number; beats: Readonly<Record<string, number>> | null }
interface Sec {
  i: number; role: ScoreRole; t0: number; t1: number; shots: Shot[];
  /** how this section comes in (its first shot's transition) */
  cut: string; fade: number;
  /** how its bus leaves at t1 (a 'cut' leaves `gap` s early; a 'fall' sags to `fallTo` on the frame, then decays with `tau`) */
  exit: Exit; tau: number; gap: number; fallTo: number;
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
interface Bus {
  gains: GainNode[]; m: Out; fx: Out; sec: number;
  /** the gain schedule in force (context time its exit starts), or — after a re-anchor mid-exit — where it carried on from */
  endAt?: number; carry?: { t: number; v: number };
}

export class IntroScore {
  /** Ambience bed changes requested by the score (at section starts). */
  onAmbience: ((bed: BedName, fade: number, t: number) => void) | null = null;
  /**
   * The hand-off (CUT v4): the end of the film's last shot, at context time `t` — the bar line on which the game's
   * pastoral music must start (the engine starts it there, phase-locked); the score's last chord rings out under it.
   */
  onHandoff: ((t: number) => void) | null = null;
  /** The film's sound design (the engine wires `fx.sfxAt` to its SFX library). */
  readonly fx: FilmSound;
  private secs: Sec[] = [];
  private cues: readonly IntroCue[] = [];
  private level = 0.92;
  private evs: Ev[] = [];
  private ei = 0;
  private readonly buses = new Map<number, Bus>();
  private master: GainNode | null = null;
  private fxMaster: GainNode | null = null;
  private wetMaster: GainNode | null = null;
  private anchor = 0;
  /** How far ahead of the film clock the score is scheduled: the output latency of the device (s). */
  private lead = 0;
  /** The film clock's last report (syncIntro): film time and context time. */
  private syncT = 0;
  private syncNow = -1;
  /** tools: [film time, picture drift (s) when built] of every hard-cut hit (after the tight re-lock) */
  readonly hitLog: Array<[number, number]> = [];
  private running = false;
  /** the film was skipped: the score plays its logo statement on its own clock (the film clock no longer applies) */
  private free = false;
  private endT = 0;
  /** film time of the logo (D3 `logo`): the arrival a skip jumps to */
  private titleT = Infinity;
  private titleAt = -Infinity;
  /** film time of the hand-off to the game's music (the end of D3), and whether it has happened */
  private handoffT = Infinity;
  private handedOff = false;
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
  /** Current intro time (s) according to the score clock (the picture's time; the sound is scheduled `lead` ahead). */
  time(now: number): number { return now - this.anchor - this.lead; }
  /** Sections derived from the last cue sheet (tools / debugging). */
  get sections(): readonly IntroSection[] { return this.secs; }
  /** Film times of the named beats the score keys on, per section (tools: the sync table). */
  beatTable(): Array<{ role: ScoreRole; beat: string; t: number; from: 'sheet' | 'contract' }> {
    const out: Array<{ role: ScoreRole; beat: string; t: number; from: 'sheet' | 'contract' }> = [];
    for (const sec of this.secs) {
      for (const name of Object.keys(SYNC[sec.role])) out.push({ role: sec.role, beat: name, t: round3(this.beat(sec, name)), from: this.sheetBeat(sec, name) === null ? 'contract' : 'sheet' });
      if (sec.words.length) out.push({ role: sec.role, beat: 'lastWord', t: round3(sec.words[sec.words.length - 1]), from: 'sheet' });
    }
    return out;
  }
  setLite(on: boolean): void { this.lite = on; this.fx.setLite(on); }

  // ---------------------------------------------------------------------------------- control

  start(cues: readonly IntroCue[], startAt: number, now: number, level = 0.92): void {
    if (this.running) this.stop(now, 0.3);
    this.cues = cues; this.level = level;
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
    // CUT v6's flashes: the running section plays on under them; at most a faint, high, airy shimmer over it
    for (const o of overlaysOf(cues)) {
      const sec = this.secs.find((x) => o.t >= x.t0 && o.t < x.t1);
      if (sec) this.planGlimpse(sec, o.t, o.dur);
    }
    this.evs.sort((a, b) => a.at - b.at);
    if (t0 > 0.05) this.trimBefore(t0);
    this.ei = 0;
    // the picture and the sound meet at the listener: schedule ahead by the device's output latency (a realtime
    // context reports it; offline renders have none)
    const ac = this.ctx as BaseAudioContext & { outputLatency?: number; baseLatency?: number };
    this.lead = clamp((Number.isFinite(ac.outputLatency) ? (ac.outputLatency as number) : 0) + (Number.isFinite(ac.baseLatency) ? (ac.baseLatency as number) : 0) - 0.016, 0, 0.12);
    this.anchor = now - t0 - this.lead;
    this.endT = this.secs[this.secs.length - 1].t1;
    const hz = this.secs.find((x) => x.role === 'horizon');
    this.titleT = hz ? this.beat(hz, 'logo') : Infinity;
    this.titleAt = -Infinity;
    this.handoffT = hz ? hz.t1 : Infinity;
    this.handedOff = false;
    this.syncNow = -1;
    this.free = false;
    this.hitLog.length = 0;
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = level;
    this.fxMaster = ctx.createGain(); this.fxMaster.gain.value = 1;
    this.wetMaster = ctx.createGain(); this.wetMaster.gain.value = level;
    this.master.connect(this.c.musicIn); this.fxMaster.connect(this.c.worldIn); this.wetMaster.connect(this.c.hallIn);
    this.running = true;
  }

  /** Starting mid-way: sustained events already under way restart shortened; one-shots before t0 are dropped, and so
   *  is what was under way on a section that has already left (its fall / crossfade / cut is over — e.g. ?introAt=
   *  inside G4 must not restart the roar), except a section that rings on into the next. */
  private trimBefore(t0: number): void {
    this.evs = this.evs.filter((e) => {
      if (e.at >= t0 - 0.02) return true;
      const own = this.secs[e.bus];
      if (own && own.exit !== 'ring' && own.t1 <= t0 + 0.05) return false;
      if (e.hold > 0 && e.at + e.hold > t0 + 0.6) { e.hold -= t0 - e.at; e.at = t0; return true; }
      return false;
    });
    this.evs.sort((a, b) => a.at - b.at);
  }

  /**
   * Fade everything out over `fade` seconds; pending events are dropped. AT THE HAND-OFF (the end of the last shot —
   * Intro.end's stopIntro, Story's music('pastoral')) it is not a fade: the game's music has started on the score's bar
   * line, and the score's last chord rings out under it (its own releases) before the buses close.
   */
  stop(now: number, fade: number): void {
    if (!this.running) return;
    const atEnd = Number.isFinite(this.handoffT) && (this.handedOff || this.time(now) >= this.handoffT - 0.35);
    if (atEnd && !this.handedOff) this.fireHandoff(Math.max(now + 0.004, this.anchor + this.handoffT));
    const f = atEnd ? 6 : Math.max(0.02, fade);
    const nodes: AudioNode[] = [];
    for (const g of [this.master, this.fxMaster, this.wetMaster]) {
      if (!g) continue;
      const p = g.gain;
      p.cancelScheduledValues(now); p.setValueAtTime(p.value, now);
      if (atEnd) p.setTargetAtTime(0, now + 3, 1.2);
      else p.setTargetAtTime(0, now, f / 4);
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
    if (!this.running || this.free || !Number.isFinite(t)) return;
    this.syncT = t; this.syncNow = now;
    const drift = now - this.anchor - this.lead - t;
    if (Math.abs(drift) < 0.1) return;
    // a jump of the film clock (a seek): start over from there instead of firing every skipped event at once
    if (Math.abs(drift) > 0.75 && this.cues.length) { this.start(this.cues, t, now, this.level); this.syncT = t; this.syncNow = now; return; }
    this.anchor = now - t - this.lead;
    for (const b of this.buses.values()) this.envelope(b, now);
  }

  /** Before a hard-cut hit: re-anchor to the picture (extrapolated from the last film-clock report) beyond 25 ms. */
  private relock(now: number): void {
    if (this.free || this.syncNow < 0 || now - this.syncNow > 0.12) return;
    const pic = this.syncT + (now - this.syncNow);
    if (Math.abs(now - this.anchor - this.lead - pic) <= 0.025) return;
    this.anchor = now - pic - this.lead;
    for (const b of this.buses.values()) this.envelope(b, now);
  }

  /** The hand-off is due: the game's music starts on this bar line (context time `t`). */
  private fireHandoff(t: number): void {
    if (this.handedOff) return;
    this.handedOff = true;
    if (this.onHandoff) {
      try { this.onHandoff(t); } catch (err) { if (this.errors++ < 3) console.warn('[IntroScore] hand-off failed', err); }
    }
  }

  /**
   * True while the score is about to hand over to the game's music by itself (it plays its last section; after a skip,
   * its logo statement): a request for the pastoral music now waits for that hand-off.
   */
  handoffPending(now: number): boolean {
    return this.running && !this.handedOff && Number.isFinite(this.handoffT) && this.handoffT - this.time(now) < 8;
  }

  /**
   * The logo appeared (sfx('titleHit') during the film). In sync: absorbed (the score plays its own warm hit ON the
   * logo beat). Ahead of the score (the film was skipped): jump to the logo statement now — the hit, the answer, the
   * settle and the hand-off to the game's music — on the score's own clock. True when absorbed.
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
    // from here the score runs on its own clock: a re-lock to the film's last clock report would push the logo
    // statement back to where the film was skipped (CUT v2 lost its title hit on a skip that way)
    this.free = true;
    this.syncNow = -1;
    this.anchor = now - this.titleT;
    // CUT v5: the compact logo statement (the hit now, the answer +1.0, the chapter +2.0, the let-go +4.4, the hand-off
    // +6.4) — the film's own D4 statement (setDown, the afterglow) is 11 s long, too long for a player who skipped
    const L = this.titleT, K = SKIP_STATEMENT;
    const sec = newSec(this.secs.length, 'horizon', L, { t: L, id: 'skip', dur: K.end, cut: 'cut', fade: 0, beats: null }, 1);
    sec.t1 = L + K.end;
    this.secs.push(sec);
    this.evs = [];
    this.ei = 0;
    this.planStatement(sec, L, L + K.hebrew, L + K.chapter, NaN, NaN, L + K.settle, L + K.end);
    this.evs.sort((a, b) => a.at - b.at);
    this.handoffT = L + K.end;
    this.endT = this.handoffT;
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
    // the film's baked buffers: one per tick right after the first frame, i.e. under the black the film opens on, never
    // in the frame that plans the score; a film started mid-way bakes lazily when a generator first needs its buffer
    if (!this.fx.ready && this.time(now) > 0.02) {
      try { this.bakeMs += this.fx.prepareStep(); } catch { /* the generators bake lazily */ }
    }
    const limit = horizon - this.anchor;
    let guard = 0;
    while (this.ei < this.evs.length && this.evs[this.ei].at <= limit && guard++ < 64) {
      const e = this.evs[this.ei];
      // the hits of the hard cuts are built only just before they are due (never early after a stall), re-locked
      // tightly to the picture first (a jump there is masked by the cut itself)
      if (e.tight) {
        this.relock(now);
        if (e.at + this.anchor > now + 0.06) break;
        if (this.syncNow >= 0 && this.hitLog.length < 64) this.hitLog.push([round3(e.at), round3(now - this.anchor - this.lead - (this.syncT + (now - this.syncNow)))]);
      }
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
    // handed over (its last event): the score is done — its last chord rings out under the game's music (stop at the
    // hand-off), and it no longer counts as playing (e.g. after a skip, where nobody calls stopIntro)
    if (this.handedOff && this.ei >= this.evs.length) { this.stop(now, 0); return; }
    if (this.ei >= this.evs.length && now > this.anchor + this.endT + 8) {
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

  /**
   * Section bus envelope: hold, then cut (a breath early before a hit) / crossfade / fall at the section end. Called
   * again on every re-anchor (a hitch, the relock before a hard-cut hit): a bus already on its way out — its cut, fall
   * or crossfade under way, or closed — carries on from where it is and never comes back up (the roar falling into G4's
   * hush must not swell again on a hitch; Ramah's bus must not reopen in the breath before the shofar).
   */
  private envelope(b: Bus, now: number): void {
    const sec = this.secs[b.sec];
    if (!sec) return;
    const v = this.busValue(b, sec, now);
    if (sec.exit !== 'ring' && v < 0.98) {
      for (const g of b.gains.slice(0, 4)) {
        const p = g.gain;
        p.cancelScheduledValues(now);
        p.setValueAtTime(v, now);
        if (v <= 1e-4) continue;
        if (sec.exit === 'cut') p.linearRampToValueAtTime(0, now + 0.03);
        else if (sec.exit === 'fall' && v > sec.fallTo) { p.linearRampToValueAtTime(sec.fallTo, now + 0.1); p.setTargetAtTime(0, now + 0.1, sec.tau); }
        else p.setTargetAtTime(0, now, sec.tau);
      }
      b.carry = { t: now, v };
      return;
    }
    const t1 = Math.max(now + 0.05, this.anchor + sec.t1 - (sec.exit === 'cut' ? sec.gap : 0));
    b.endAt = t1; b.carry = undefined;
    for (const g of b.gains.slice(0, 4)) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(v, now);
      if (sec.exit === 'cut') { p.setValueAtTime(1, Math.max(now, t1 - 0.03)); p.linearRampToValueAtTime(0, t1 + 0.012); }
      else if (sec.exit === 'x') { p.setValueAtTime(1, t1); p.setTargetAtTime(0, t1, sec.tau); }
      else if (sec.exit === 'fall') { p.setValueAtTime(1, t1); p.linearRampToValueAtTime(sec.fallTo, t1 + 0.12); p.setTargetAtTime(0, t1 + 0.12, sec.tau); }
    }
  }
  /** The bus gain `envelope` has scheduled, at context time `now` (computed — not read back from the AudioParam). */
  private busValue(b: Bus, sec: Sec, now: number): number {
    if (sec.exit === 'ring') return 1;
    const c = b.carry;
    if (c) {
      const dt = Math.max(0, now - c.t);
      if (c.v <= 1e-4) return 0;
      if (sec.exit === 'cut') return Math.max(0, c.v * (1 - dt / 0.03));
      if (sec.exit === 'fall' && c.v > sec.fallTo) return dt < 0.1 ? c.v + (sec.fallTo - c.v) * (dt / 0.1) : sec.fallTo * Math.exp(-(dt - 0.1) / sec.tau);
      return c.v * Math.exp(-dt / sec.tau);
    }
    const e = b.endAt;
    if (e === undefined) return 1;
    if (sec.exit === 'cut') return now < e - 0.03 ? 1 : Math.max(0, 1 - (now - (e - 0.03)) / 0.042);
    if (now < e) return 1;
    if (sec.exit === 'x') return Math.exp(-(now - e) / sec.tau);
    return now < e + 0.12 ? 1 + (sec.fallTo - 1) * ((now - e) / 0.12) : sec.fallTo * Math.exp(-(now - e - 0.12) / sec.tau);
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

  /** Duck the ambience at once to `level` (G4 after the roar: 0.55 when the roar falls, 0.12 for a hard silence), hold,
   *  then let it creep back over `back` s. */
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
  /** The named beat of the section's k-th shot only (film time), or `fallback` — for names several shots share (CUT
   *  v6.1: D1 and D2 both have a `turn`). */
  private shotBeat(sec: Sec, k: number, name: string, fallback: number): number {
    const sh = sec.shots[k];
    if (!sh) return fallback;
    for (const key of [norm(name), ...(ALIAS[name] ?? [])]) {
      const v = sh.beats?.[key];
      if (v !== undefined) return sh.t + clamp(v, 0, Math.max(0, sh.dur - 0.02));
    }
    return fallback;
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
      // a picture rising out of black (CUT v5's P1): silence under the black, the bed comes in with the picture
      const pic = !prev && sec.cut === 'black' && sec.role !== 'open' ? clamp(this.beat(sec, 'picture'), sec.t0, sec.t1 - 0.5) : sec.t0;
      const fade = pic > sec.t0 ? 2.5 : sec.i === 0 ? 0.8 : sec.cut === 'hard' || sec.cut === 'cut' ? 0.25 : Math.max(0.5, sec.fade || 1.2);
      // held over the whole run of sections sharing the bed (so starting mid-run still sets it)
      let j = sec.i;
      while (j + 1 < this.secs.length && ROLE_BED[this.secs[j + 1].role] === bed) j++;
      if (pic > sec.t0) this.add(sec, sec.t0, (t) => { if (this.onAmbience) this.onAmbience('none', 0.3, t); });
      this.add(sec, pic, (t) => { if (this.onAmbience) this.onAmbience(bed, fade, t); }, this.secs[j].t1 - pic);
    }
    switch (sec.role) {
      case 'open': this.planOpen(sec); break;
      case 'cold': this.planCold(sec); break;
      case 'title': this.planTitle(sec); break;
      case 'land': this.planLand(sec); break;
      case 'bethlehem': this.planBethlehem(sec); break;
      case 'rachel': this.planRachel(sec); break;
      case 'map': this.planMap(sec); break;
      case 'judges': this.planJudges(sec); break;
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
      case 'watch': this.planWatch(sec); break;
      case 'horizon': this.planHorizon(sec); break;
    }
  }

  // ================================================================================ CUT v6 · THE COLD OPEN AND THE TITLE

  /**
   * C0 — THE COLD OPEN (CUT v6): the tear before anything is known, extreme close, very slow motion. Near silence: a low
   * wind, a man's breath, the wool under strain from `pull`, each thread snapping as a tiny, close, real sound from `rip`
   * (one by one along the weft, faster), the last one ON `snap`; a very low tension underneath (a sub D and its rubbing
   * E♭, barely there) that lets go with the last thread — a short in-breath of the room, and the smash to black (the bus
   * is cut GAP s before the title's frame).
   */
  private planCold(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, t1 = end - sec.gap;
    const sm = sec.slowmo < 1 ? sec.slowmo : 0.25;
    const grip = clamp(this.beat(sec, 'grip'), t0 + 0.2, t1 - 3);
    const pull = clamp(this.beat(sec, 'pull'), grip + 0.3, t1 - 2);
    const rip = clamp(this.beat(sec, 'rip'), pull + 0.3, t1 - 1.2);
    const snap = clamp(this.beat(sec, 'snap'), rip + 0.5, t1 - 0.25);
    // the air: a low wind, barely there; the world holds still (no bed)
    this.add(sec, t0 + 0.05, (t, _m, h, fx) => this.fx.windSwell(fx, t, h, 0.02, 220, 700, -0.3, 0.2), t1 - t0 - 0.05);
    // the very low tension underneath: a sub D with its E♭ rubbing (phones: an octave up), creeping up to the last thread
    this.add(sec, t0 + 0.3, (t, m, h) => {
      S.pad(m, t, h, lite ? [38, 39, 50] : [26, 38, 39], { level: lite ? 0.026 : 0.03, attack: h * 0.85, release: 0.25, cutoff: lite ? 420 : 260, voices: 2, detune: 5, lfoCents: 30 });
      S.pad(m, t + 1, h - 1, [81, 82], { level: 0.0035, attack: (h - 1) * 0.9, release: 0.2, cutoff: 5000, voices: 1, type: 'sine', lfoCents: 15 });
    }, t1 - t0 - 0.3); // (CUT v6.1: held to the smash — the snap, the corner's whip and the suck rise into it as one)
    // his breath (slowed: deep and close) before the grip, and held out through the pull
    this.add(sec, t0 + 0.05, (t, _m, _h, fx) => this.humanBreath(fx, t, 0.04));
    this.add(sec, pull + 0.25, (t, _m, _h, fx) => this.humanBreath(fx, t, 0.034));
    // the grip: the fist closes on the wool — the weight of it, the cloth gathered
    this.add(sec, grip, (t, _m, _h, fx) => { this.fx.grab(fx, t, 0.03); this.fabric(fx, t + 0.02, 0.9, 0.016, -0.1); });
    // the pull: the weave goes taut and creaks, tightening until the last thread
    this.add(sec, pull, (t, _m, _h, fx) => this.fx.strain(fx, t, snap - pull + 0.02, 0.045, 0.05));
    // the threads: one by one along the weft from `rip`, faster and faster, each a tiny close sound; the last ON `snap`
    const n = lite ? 8 : 12;
    for (let i = 0; i < n; i++) {
      const u = i / n, x = rip + (snap - rip - 0.12) * (1 - (1 - u) ** 1.7) + rand(-0.02, 0.02);
      this.add(sec, x, (t, _m, _h, fx) => this.fx.threadSnap(fx, t, 0.09 + 0.09 * u * rand(0.6, 1.1), rand(-0.35, 0.35), sm * 2.2));
    }
    this.add(sec, snap, (t, _m, _h, fx) => {
      this.fx.threadSnap(fx, t, 0.24, 0.05, sm * 2);
      this.fabric(fx, t + 0.03, 0.5, 0.014, 0.1);
    }, 0, undefined, true);
    // CUT v6.1: the snap and the smash are one gesture — the corner flies free (the wool's whip through the air) and the
    // room draws in, into the smash to black half a second later
    this.add(sec, snap + 0.02, (t, _m, _h, fx) => this.whoosh(fx, t, Math.max(0.2, t1 - snap - 0.04), 0.03, 450, 2600, 0.25));
    this.add(sec, snap + 0.04, (t, m) => this.fx.suck(m, t1, Math.max(0.2, t1 - snap - 0.04), 0.17, 0.9));
  }

  /**
   * T — THE TITLE on black (CUT v6): הַטּוֹב מִמֶּךָּ, the question. ON the smash one deep pulse; then a single low note (D,
   * the low strings and the men's voices) holding the question — nothing else; it rings on under P1's rise out of black
   * and becomes the land's drone.
   */
  private planTitle(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    this.add(sec, t0, (t, m) => {
      S.drum(m, t, 'boom', 0.34, 0, 0.85);
      S.drum(m, t + 0.004, 'taiko', 0.3, 0, 0.62);
      S.drum({ dry: m.dry, wet: null }, t, 'dum', 0.3, 0, 0.8);
    }, 0, undefined, true);
    const ring = sec.exit === 'ring' ? 1.8 : 0.4;
    this.add(sec, t0 + 0.02, (t, m, h) => {
      // (phones: the note an octave up too, with its overtones open — their speaker does not play the low D)
      S.pad(m, t, h, lite ? [38, 50] : [26, 38], { level: lite ? 0.04 : 0.05, attack: 0.5, release: ring, cutoff: lite ? 950 : 420, voices: 2, detune: 4, lfoCents: 40 });
      S.choir(m, t + 0.2, h - 0.2, lite ? [50, 62] : [38], { level: 0.026, attack: 1.2, release: ring, vowel: 'oo', breath: 0.05 });
      this.line(m, t + 0.1, [[38, 1]], h - 0.1, 0.03, 'cello');
    }, end - t0 + 0.6);
  }

  /** CUT v6's flashes (F1 / F2): the king's music does not stop or dip — a faint, high, airy shimmer over it (the shepherd's world for a moment). */
  private planGlimpse(sec: Sec, t0: number, dur: number): void {
    const S = this.s;
    this.add(sec, t0 - 0.04, (t, m, _h, fx) => {
      S.pad(m, t, dur * 0.75, [93, 98, 102], { level: 0.011, attack: 0.1, release: 0.55, cutoff: 9500, voices: 2, detune: 7, trem: 0.4, tremRate: 9 });
      this.whoosh(fx, t, dur + 0.2, 0.012, 3500, 7500, 0.35);
    });
  }

  // ================================================================================ 0 · THE PROLOGUE (CUT v5)

  /**
   * P1 — THE LAND (out of black). Out of silence: a low air and, under the time card, a deep soft bloom on a D pedal.
   * ON `picture` the land theme rises with the image (the dawn above the clouds, the hills of Judah): the light (a high
   * open fifth) shimmering in, the theme D | A | G A | C | D on the low horns (cellos below), the C chord (♭VII) under
   * its C, and on its D the choir opens into D major as the flight banks toward Bethlehem — ringing on into the dissolve.
   */
  private planLand(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const time = clamp(this.text(sec, 0, this.beat(sec, 'time')), t0, end - 4);
    const pic = clamp(this.beat(sec, 'picture'), time + 0.4, end - 4);
    const card = clamp(this.text(sec, 1, this.beat(sec, 'card')), pic, end - 1);
    const rel = sec.exit === 'ring' ? 1.6 : 0.4;
    // out of silence: the low air in the dark, opening as the picture rises (the 'heights' bed takes over from it)
    this.add(sec, t0 + 0.15, (t, _m, h, fx) => {
      this.air(fx, t, h, 0.032);
      this.fx.windSwell(fx, t + 0.3, h - 0.3, 0.03, 280, 900, -0.4, 0.3);
    }, pic + 1.6 - t0 - 0.15);
    // the time card: a deep, soft bloom; the D pedal (the ground, low voices) from the black into the picture
    this.add(sec, time, (t, m, h) => {
      S.drum(m, t, 'boom', 0.15, 0, 0.85);
      this.ground(m, t, h, 0.05, 1.4, 1.2);
      S.choir(m, t + 0.1, h, [38, 45], { level: 0.02, attack: 2.4, release: 1.2, vowel: 'oo', breath: 0.04 });
    }, pic + 2.4 - time);
    // the picture: dawn — the light (a high open fifth shimmering in) and the drone opening (D–A, no third yet)
    this.add(sec, pic, (t, m, h, fx) => {
      S.pad(m, t, h, [74, 81], { level: 0.014, attack: 1.8, release: rel, cutoff: 5200, voices: 2, detune: 7, trem: 0.22, tremRate: 7 });
      S.pad(m, t, h, lite ? [50, 57] : [45, 50, 57], { level: 0.026, attack: 1.6, release: rel, cutoff: 800, cutoffEnd: 1600, voices: lite ? 2 : 3, detune: 7 });
      // through the deck of clouds and over the ridges: the air moving past the lens
      this.fx.windSwell(fx, t + 0.8, 4.6, 0.028, 350, 1700, -0.4, 0.3);
      this.fx.windSwell(fx, t + 4.6, Math.max(1, end - t - 4.2), 0.02, 400, 1500, 0.3, -0.2);
    }, end - pic + rel);
    // the LAND theme on the low horns (cellos an octave below): D | A | G A | C | D, rising to the octave
    const th0 = pic + 0.45, u = (end - 0.3 - th0) / 11;
    const theme: Array<readonly [number, number]> = [[50, 2], [57, 2], [55, 1], [57, 1], [60, 2], [62, 3 + rel / u]];
    this.add(sec, th0, (t, m) => {
      this.line(m, t, theme, u, 0.066, 'horn');
      this.line(m, t + 0.02, theme.map(([n, b]) => [n - 12, b] as const), u, 0.024, 'cello');
    });
    // under its C the ♭VII (C major over the drone); on its D the choir opens to D major (the dawn's F♯)
    const cC = th0 + 6 * u, cD = th0 + 8 * u;
    this.add(sec, cC, (t, m, h) => {
      S.pad(m, t, h, lite ? [55, 60, 64] : [48, 55, 60, 64], { level: 0.026, attack: 0.5, release: 0.6, cutoff: 1500, voices: lite ? 2 : 3, detune: 8 });
      S.choir(m, t + 0.05, h, lite ? [55, 60] : [48, 55, 60], { level: 0.02, attack: 0.6, release: 0.6, vowel: 'oh', breath: 0.05 });
    }, cD - cC + 0.35);
    this.add(sec, cD, (t, m, h) => {
      S.drum(m, t, 'boom', 0.1, 0, 0.95);
      S.strum(m, t + 0.02, [50, 57, 62, 66, 69, 74], 0.3, 0.045);
      S.choir(m, t, h, lite ? [57, 62, 66] : [50, 57, 62, 66, 69], { level: 0.05, attack: 0.9, release: rel, vowel: 'oh', to: 'ah', morph: 1.6, breath: 0.07 });
      S.pad(m, t, h, lite ? [62, 66, 69] : [62, 66, 69, 74], { level: 0.028, attack: 1.0, release: rel, cutoff: 2800, voices: lite ? 2 : 3, detune: 8, vib: 7, vibRate: 5.3, vibDelay: 0.6 });
    }, end - cD + rel);
    // the land card: a soft glint over the gold
    this.add(sec, card, (t, m) => {
      S.pad(m, t, 2.2, [81, 86], { level: 0.006, attack: 0.5, release: 1.4, cutoff: 7000, voices: 2, detune: 6, trem: 0.3, tremRate: 10 });
      S.lyre(m, t + 0.03, 86, 0.2, 0.35);
    });
  }

  /**
   * P2 — BETHLEHEM (the chapter's own town in the early light): the morning's D major settling in a warm drone, the
   * kinnor's 6/8 lilt (D | G | D | C — the C♮ of the hills, leading into Rachel's D minor), the pipe's morning tune from
   * the person card; from `flock` a few small bells as a shepherd leads a flock out along the terraces, his far call
   * across the valley (and its echo), far bleats.
   */
  private planBethlehem(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const card = clamp(this.text(sec, 0, this.beat(sec, 'card')), t0, end - 2);
    const flock = clamp(this.beat(sec, 'flock'), t0 + 0.5, end - 2);
    const rel = sec.exit === 'ring' ? 1.2 : 0.4;
    this.add(sec, t0, (t, m, h) => {
      S.pad(m, t, h, lite ? [50, 57] : [38, 45, 50, 57], { level: 0.02, attack: 1.2, release: rel, cutoff: 700, voices: 2, detune: 6, lfoCents: 200 });
      S.pad(m, t + 0.3, h - 0.3, lite ? [62, 66] : [57, 62, 66], { level: 0.011, attack: 1.5, release: rel, cutoff: 1800, voices: 2, detune: 8 });
    }, end - t0 + rel);
    const k0 = t0 + 0.4;
    this.kinnor(sec, k0, end - 0.05, ['D', 'G', 'D', 'C'], 0.5);
    // the pipe (the chalil): a morning tune in D Mixolydian, on the kinnor's dotted quarters
    const P = STEP68;
    const p0 = k0 + Math.ceil((card + 0.2 - k0) / (3 * P) - 1e-6) * 3 * P;
    const tune: Array<readonly [number, number]> = [[69, 2], [74, 1], [76, 1], [78, 2], [76, 1], [74, 1], [72, 1], [69, 3], [-1, 1], [67, 1], [69, 1], [72, 1], [74, 3]];
    this.add(sec, p0, (t, m) => S.ney(m, t, tune.map(([n, d]) => ({ midi: n, dur: d * P })), 0.058));
    // the flock goes out: a few small bells on the terraces, the shepherd's far call (and the valley's echo), bleats
    this.add(sec, flock, (t, _m, h, fx) => this.fx.bells(this.far(fx, t, h + 2, 4200, 0.12, 0.45), t, h, 0.05, 3, 0.45, 0.35), end - flock + 1.2);
    this.add(sec, flock + 0.45, (t, _m, _h, fx) => {
      const f = this.far(fx, t, 4.5, 2400, 0.45, 0.6);
      this.fx.sing(f, t, [{ midi: 57, dur: 0.2, vowel: 'eh' }, { midi: 62, dur: 0.62, vowel: 'oh', accent: 1.1 }, { midi: 60, dur: 0.14, vowel: 'oh' }, { midi: 57, dur: 0.85, vowel: 'oh' }], 0.04, false, 18);
    });
    this.add(sec, flock + 1.6, (t, _m, _h, fx) => { const f = this.far(fx, t, 3, 2000, 0.3, 0.5); this.fx.bleat(f.dry, t, 0.14, 0.5); });
    this.add(sec, flock + 2.9, (t, _m, _h, fx) => { const f = this.far(fx, t, 3, 2400, 0.3, 0.5); this.fx.bleat(f.dry, t, 0.1, 0.3, 'lambBleat', 1.05); });
    if (end - flock > 4.2) this.add(sec, flock + 4.0, (t, _m, _h, fx) => { const f = this.far(fx, t, 3, 1800, 0.3, 0.5); this.fx.bleat(f.dry, t, 0.09, 0.6, 'goatBleat'); });
  }

  /**
   * P3 — RACHEL'S TOMB (Gen 35:19-20). A tender, ancient line: a woman's wordless lament (A B♭ A G F E D — Rachel
   * weeping for her children, Jer 31:15) over a soft D minor and a low ground; the kinnor's slow arpeggio under the
   * verse; the flock passing behind the stone (bells, a lamb); from `rise` the line rises (A C D, held, opening to 'ah')
   * with the lens into the sky, the strings climbing B♭ – C (♭VI – ♭VII) into the map's D.
   */
  private planRachel(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const card = clamp(this.text(sec, 0, this.beat(sec, 'card')), t0, end - 2);
    const verse = clamp(this.text(sec, 1, this.beat(sec, 'verse')), card, end - 1.5);
    const rise = clamp(this.beat(sec, 'rise'), verse + 0.8, end - 0.6);
    const rel = sec.exit === 'ring' ? 1.4 : 0.4;
    this.add(sec, t0, (t, m, h) => {
      this.ground(m, t, h, 0.032, 1.0, 0.8);
      S.pad(m, t, h, lite ? [50, 57, 62] : [38, 45, 50, 57, 62], { level: 0.02, attack: 1.2, release: 0.8, cutoff: 900, voices: lite ? 2 : 3, detune: 6 });
      S.pad(m, t + 0.4, h - 0.4, [65, 69], { level: 0.007, attack: 1.4, release: 0.8, cutoff: 2400, voices: 2, detune: 7 });
    }, rise - t0 + 0.7);
    // Rachel's line: a woman's voice, from just before the verse to the rise
    const l0 = Math.max(card + 0.2, verse - 0.6), k = (rise - 0.08 - l0) / 3.0;
    const lament: SungNote[] = [
      { midi: 69, dur: 0.5 * k, vowel: 'oo' }, { midi: 70, dur: 0.3 * k, vowel: 'oo', accent: 1.1 }, { midi: 69, dur: 0.42 * k, vowel: 'oo' },
      { midi: 67, dur: 0.2 * k, vowel: 'oo' }, { midi: 65, dur: 0.55 * k, vowel: 'ah' }, { midi: 64, dur: 0.3 * k, vowel: 'oo' }, { midi: 62, dur: 0.73 * k, vowel: 'oo' },
    ];
    this.add(sec, l0, (t, m) => {
      this.fx.sing(m, t, lament, 0.042, true, 28);
      // a solo cello in unison under the voice: body, and the synthetic voice is never exposed alone
      this.line(m, t + 0.03, lament.map((n) => [n.midi, n.dur] as const), 1, 0.014, 'cello');
    });
    this.add(sec, verse, (t, m) => [50, 57, 62, 65, 69].forEach((n, i) => S.lyre(m, t + i * 0.13, n, 0.3 - i * 0.02, lyrePan(n))));
    // the rise: the line climbs with the lens and is held into the sky; the strings climb B♭ – C under it
    const hold = end - rise - 0.78 + 1.0;
    this.add(sec, rise, (t, m) => {
      this.fx.sing(m, t, [{ midi: 69, dur: 0.42, vowel: 'oo' }, { midi: 72, dur: 0.36, vowel: 'oo' }, { midi: 74, dur: Math.max(0.6, hold), vowel: 'ah', accent: 1.15 }], 0.048, true, 30);
    });
    const half = (end - rise) / 2;
    this.add(sec, rise, (t, m, h) => {
      S.pad(m, t, h, lite ? [53, 58, 62] : [46, 53, 58, 62, 65], { level: 0.026, attack: 0.5, release: 0.4, cutoff: 1500, voices: lite ? 2 : 3, detune: 8 });
      S.choir(m, t + 0.05, h, lite ? [58, 62] : [53, 58, 62], { level: 0.018, attack: 0.6, release: 0.4, vowel: 'oo', breath: 0.05 });
    }, half + 0.2);
    this.add(sec, rise + half, (t, m, h) => {
      S.pad(m, t, h, lite ? [55, 60, 64] : [48, 55, 60, 64, 67], { level: 0.03, attack: 0.4, release: rel, cutoff: 1900, voices: lite ? 2 : 3, detune: 8 });
      S.choir(m, t + 0.05, h, lite ? [60, 64] : [55, 60, 64], { level: 0.022, attack: 0.5, release: rel, vowel: 'oo', to: 'ah', morph: h, breath: 0.06 });
    }, end - rise - half + rel);
    this.add(sec, rise, (t, _m, h, fx) => this.fx.windSwell(fx, t, h, 0.03, 400, 1800, -0.2, 0.4), end - rise + 1.3);
    // the shepherd and the flock pass behind the stone: bells close by, a lamb, a ewe
    this.add(sec, card, (t, _m, h, fx) => this.fx.bells(fx, t, h, 0.032, 3, -0.15, 0.5), Math.max(1, rise - card + 0.6));
    this.add(sec, card + 1.3, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.09, -0.35, 'lambBleat', 1.06));
    this.add(sec, card + 2.7, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.08, 0.2));
  }

  /**
   * P4 — THE MAP (CUT v6, 10 s: the road out of Egypt drawn as a flock of light, Ps 78:52; the land; no king, Judg
   * 21:25; the lens turning toward the coast). Out of the land's D major the harmony darkens for a breath on `egypt` (a
   * deep, soft D minor: the house of bondage); on `flock` the people go out like a flock — the land theme (D | A | G A |
   * C) warm and moving on the horns with the shepherd's pipe above it, a gentle processional, a few far sheep bells; the
   * Jordan (water, the kinnor's glissando, the dominant rising) into a short, warm D-major arrival on `gilgal`; on
   * `noKing` the harmony slips (B♭ over the D pedal, then G minor), an uneven pulse, a high A–B♭ rubbing and the king's
   * three notes in the cellos (D A B♭: the king they will ask for); as the lens turns to the coast a low Phrygian horn
   * cluster (D–E♭), five soft strokes and a dark riser swell into the host — ringing on across the dissolve into P6.
   */
  private planMap(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const egypt = clamp(this.beat(sec, 'egypt'), t0 + 0.2, end - 8);
    const flock = clamp(this.beat(sec, 'flock'), egypt + 0.3, end - 7);
    const jor = clamp(this.beat(sec, 'jordan'), flock + 1.5, end - 4);
    const gil = clamp(this.beat(sec, 'gilgal'), jor + 0.3, end - 3.5);
    const noKing = clamp(this.text(sec, 1, this.beat(sec, 'noKing')), gil + 0.3, end - 2.5);
    const coast = clamp(noKing + (end - noKing) * 0.55, noKing + 1, end - 1);
    const rel = sec.exit === 'ring' ? 1.4 : 0.5;
    // Egypt: the region below — the land's D major darkens for a breath (a deep, soft D minor)
    this.add(sec, t0, (t, m, h) => {
      S.pad(m, t, h, lite ? [50, 57, 62, 65] : [45, 50, 57, 62, 65], { level: 0.03, attack: Math.max(0.2, egypt - t0), release: 0.4, cutoff: 900, cutoffEnd: 1700, voices: lite ? 2 : 3, detune: 8 });
    }, egypt - t0 + 0.2);
    this.add(sec, egypt, (t, m, h) => {
      S.drum(m, t, 'boom', 0.13, 0, 0.8);
      S.drum(m, t + 0.01, 'taiko', 0.24, 0, 0.8);
      this.ground(m, t, h, 0.028, 0.2, 0.6);
      S.pad(m, t, h, lite ? [50, 57, 62, 65] : [38, 45, 50, 53, 57, 62], { level: 0.036, attack: 0.2, release: 0.6, cutoff: 1400, cutoffEnd: 1000, voices: lite ? 2 : 3, detune: 9 });
      S.choir(m, t + 0.02, h, lite ? [50, 57, 62] : [45, 50, 53, 57], { level: 0.034, attack: 0.25, release: 0.6, vowel: 'oh', breath: 0.08 });
    }, flock - egypt + 0.3);
    this.add(sec, t0 + 0.2, (t, _m, h, fx) => this.fx.windSwell(fx, t, h, 0.026, 300, 1500, -0.3, 0.3), jor - t0);
    // the flock of light: the land theme warm and moving (D | A | G A | C — its D on the arrival), the pipe above it
    const u = (gil - flock) / 4;
    const th: Array<readonly [number, number]> = [[50, 1], [57, 1], [55, 0.5], [57, 0.5], [60, 1]];
    this.add(sec, flock + 0.02, (t, m) => {
      this.line(m, t, th, u, 0.06, 'horn');
      this.line(m, t + 0.01, th.map(([n, b]) => [n - 12, b] as const), u, 0.022, 'cello');
      S.ney(m, t + 0.04, th.map(([n, b]) => ({ midi: n + 24, dur: b * u })), 0.045);
    });
    // warm: D (open, then the third) under it, the C (♭VII) under its C
    const cC = flock + 3 * u;
    this.add(sec, flock, (t, m, h) => {
      S.pad(m, t, h, lite ? [50, 57, 62, 66] : [38, 50, 57, 62, 66], { level: 0.03, attack: 0.5, release: 0.4, cutoff: 1300, cutoffEnd: 2200, voices: lite ? 2 : 3, detune: 8 });
      S.choir(m, t + 0.1, h, lite ? [57, 62] : [50, 57, 62], { level: 0.022, attack: 0.8, release: 0.4, vowel: 'oo', to: 'ah', morph: h, breath: 0.05 });
    }, cC - flock + 0.3);
    this.add(sec, cC, (t, m, h) => S.pad(m, t, h, lite ? [55, 60, 64] : [36, 48, 55, 60, 64], { level: 0.03, attack: 0.3, release: 0.3, cutoff: 1600, voices: lite ? 2 : 3, detune: 8 }), jor - cC + 0.3);
    // the processional: the tof on the beats, soft, the low strings walking (the people on the move)
    for (let x = flock, k = 0; x < jor - 0.1; x += BEAT, k++) {
      const kk = k, w = clamp((x - flock) / Math.max(0.5, jor - flock), 0, 1);
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(dry, t, 'dum', 0.2 + 0.12 * w, kk % 2 ? 0.15 : -0.15);
        if (kk % 2 === 0) S.drum(m, t, 'taiko', 0.16 + 0.1 * w, 0, 0.95);
        S.drum(dry, t + BEAT * 0.5, 'tek', lite ? 0.08 : 0.06, 0.2);
        S.strStac(dry, t, kk % 4 === 3 ? 45 : 50, 0.3 + 0.12 * w, 0.22, 0.8);
      });
    }
    // a few far sheep bells: the people led like a flock (and the shepherd the film is about)
    this.add(sec, flock + 0.3, (t, _m, h, fx) => this.fx.bells(this.far(fx, t, h + 2, 4000, 0.15, 0.45), t, h, 0.026, 3, 0.2, 0.5), jor - flock);
    // the Jordan: water, a roll, the kinnor's glissando, the dominant rising into the arrival
    const jl = gil - jor;
    for (let x = jor, g = 0.14; x < gil - 0.05; x += g, g = Math.max(0.06, g * 0.84)) {
      const w = (x - jor) / jl;
      this.add(sec, x, (t, m) => S.drum({ dry: m.dry, wet: null }, t, 'dum', 0.1 + 0.22 * w * w, rand(-0.2, 0.2), 0.95));
    }
    this.add(sec, jor, (t, m, h, fx) => {
      this.fx.rush(fx, t, h + 0.4, 0.045, -0.2);
      S.pad(m, t, h + 0.05, lite ? [57, 61, 64] : [45, 52, 57, 61, 64], { level: 0.04, attack: h * 0.8, release: 0.05, cutoff: 1300, cutoffEnd: 3000, voices: lite ? 2 : 3, detune: 9 });
      [62, 64, 66, 69, 71, 74, 76, 78].forEach((n, i) => S.lyre(m, t + (i / 8) * h * 0.95, n, 0.17 + i * 0.025, lyrePan(n)));
    }, jl);
    // Gilgal: a short, warm D-major arrival (Josh 4:19) — the land
    this.add(sec, gil, (t, m, h) => {
      S.drum(m, t, 'boom', 0.16, 0, 0.9);
      S.drum(m, t + 0.004, 'taiko', 0.3, -0.2); S.drum(m, t + 0.016, 'taiko', 0.24, 0.2);
      S.strum(m, t + 0.01, [50, 57, 62, 66, 69, 74], 0.45, 0.03);
      S.pad(m, t, h, lite ? [50, 57, 62, 66] : [38, 50, 57, 62, 66], { level: 0.045, attack: 0.05, release: 0.35, cutoff: 2200, cutoffEnd: 1300, voices: lite ? 2 : 3, detune: 8 });
      S.choir(m, t + 0.01, h, lite ? [57, 62, 66] : [50, 57, 62, 66], { level: 0.05, attack: 0.08, release: 0.35, vowel: 'ah', breath: 0.1 });
      this.line(m, t, [[62, 1]], h, 0.045, 'horn');
    }, noKing - gil + 0.1);
    // "in those days there was no king in Israel": B♭ over the D pedal, then G minor; a high A–B♭ rubbing; the low
    // strings' uneven pulse; the king's three notes in the cellos (D A B♭)
    const mid = noKing + (coast - noKing) * 0.5;
    this.add(sec, noKing, (t, m, h) => {
      this.ground(m, t, h, 0.04, 0.4, 0.5);
      S.pad(m, t, mid - noKing + 0.25, lite ? [53, 58, 62] : [46, 53, 58, 62], { level: 0.032, attack: 0.3, release: 0.3, cutoff: 1200, voices: lite ? 2 : 3, detune: 9 });
      S.pad(m, t + 0.4, h - 0.4, [81, 82], { level: 0.005, attack: 1.0, release: 0.4, cutoff: 4000, voices: 2, detune: 4, trem: 0.5, tremRate: 8 });
    }, end - noKing + rel);
    this.add(sec, mid, (t, m, h) => {
      S.pad(m, t, h, lite ? [55, 58, 62] : [43, 50, 55, 58, 62], { level: 0.032, attack: 0.35, release: 0.35, cutoff: 1000, voices: lite ? 2 : 3, detune: 9 });
      S.choir(m, t, h, [43, 50], { level: 0.022, attack: 0.5, release: 0.35, vowel: 'oo', breath: 0.06 });
    }, coast - mid + 0.4);
    const kn = (coast - noKing - 0.2) / 2.6;
    this.add(sec, noKing + 0.15, (t, m) => this.line(m, t, [[50, 0.8], [57, 0.8], [58, 1.0 + (end - coast) / kn]], kn, 0.05, 'cello'));
    const lim = [0.45, 0.3, 0.6, 0.25, 0.7, 0.3, 0.5];
    for (let x = noKing + 0.1, k = 0; x < coast - 0.15; x += lim[k % lim.length], k++) {
      const kk = k;
      this.add(sec, x, (t, m) => S.strStac({ dry: m.dry, wet: null }, t, kk % 5 === 3 ? 39 : 38, 0.3 + 0.04 * (kk % 3), 0.26, 0.45));
    }
    // toward the coast: the Philistine cities glow at the edge of the frame — five soft strokes, the low Phrygian horn
    // cluster swelling, a dark riser into the host (ringing on into P6's first frame)
    const cg = Math.min(0.32, (end - coast - 0.4) / 5);
    for (let i = 0; i < 5; i++) {
      const ii = i;
      this.add(sec, coast + i * cg, (t, m) => {
        S.drum(m, t, 'taiko', 0.2 + 0.05 * ii, ii % 2 ? 0.25 : -0.25, 0.85);
        S.drum(m, t + 0.005, 'boom', 0.05 + 0.02 * ii, 0, 0.9);
      });
    }
    this.add(sec, coast, (t, m, h) => {
      this.horn(m, t, h, lite ? [50, 51, 57] : [38, 39, 50, 51, 57], 0.045, Math.min(h * 0.7, 1.6), rel);
      if (!lite) S.pad(m, t, h, [26], { level: 0.028, attack: h * 0.6, release: rel, cutoff: 140, voices: 2, detune: 4, type: 'triangle' });
      S.choir(m, t + 0.2, h - 0.2, [50, 51, 57], { level: 0.028, attack: h * 0.6, release: rel, vowel: 'oh', breath: 0.08 });
    }, end - coast + rel * 0.5);
    const rl = Math.min(1.8, end - coast);
    this.add(sec, end - rl, (t, m) => riserFx(this.c, S, m, t, rl, 'dark', 0.8, lite));
  }

  /**
   * P5 — THE TRIBES, THE JUDGES AND THE PHILISTINES (the same camera): the arrival's D settles under the tribes' names (a
   * pluck of the kinnor for each of the twelve, D – G/D); "in those days there was no king in Israel" — the harmony slips
   * (B♭ over the D pedal, then G minor), an uneven pulse in the low strings, a high tremolo rubbing (A–B♭), and the king's
   * three notes in the cellos (D A B♭: the king they will ask for); on `cities` five strokes (the five cities) and a low
   * Phrygian horn cluster (D–E♭) swelling with the descent toward the coast, into the host.
   */
  private planJudges(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const tribes = clamp(this.beat(sec, 'tribes'), t0, end - 4);
    const verse = clamp(this.text(sec, 0, this.beat(sec, 'verse')), tribes + 0.6, end - 3);
    const cities = clamp(this.beat(sec, 'cities'), verse + 1, end - 0.8);
    const rel = sec.exit === 'ring' ? 1.2 : 0.4;
    const pent = [62, 64, 66, 69, 71, 74, 76, 78, 81];
    const gap = Math.min(0.19, (verse - tribes - 0.3) / 12);
    for (let i = 0; i < 12; i++) {
      this.add(sec, tribes + 0.05 + i * gap + rand(-0.03, 0.03), (t, m) => { const n = pick(pent); S.lyre(m, t, n, rand(0.2, 0.3), lyrePan(n)); });
    }
    const gT = tribes + Math.min(1.1, (verse - tribes) * 0.5);
    this.add(sec, gT, (t, m, h) => {
      S.pad(m, t, h, lite ? [55, 59, 62] : [43, 50, 55, 59, 62], { level: 0.024, attack: 0.6, release: 0.5, cutoff: 1500, voices: lite ? 2 : 3, detune: 7 });
    }, verse - gT + 0.35);
    // no king: B♭ over the D pedal, then G minor; a high tremolo rubbing; the low strings' uneven pulse
    const mid = verse + (cities - verse) * 0.5;
    this.add(sec, verse, (t, m, h) => {
      this.ground(m, t, h, 0.04, 0.6, 0.5);
      S.pad(m, t, mid - verse + 0.25, lite ? [53, 58, 62] : [46, 53, 58, 62], { level: 0.03, attack: 0.5, release: 0.3, cutoff: 1200, voices: lite ? 2 : 3, detune: 9 });
      S.pad(m, t + 0.8, h - 0.8, [81, 82], { level: 0.005, attack: 1.4, release: 0.4, cutoff: 4000, voices: 2, detune: 4, trem: 0.5, tremRate: 8 });
    }, cities - verse + 0.35);
    this.add(sec, mid, (t, m, h) => {
      S.pad(m, t, h, lite ? [55, 58, 62] : [43, 50, 55, 58, 62], { level: 0.03, attack: 0.4, release: 0.35, cutoff: 1000, voices: lite ? 2 : 3, detune: 9 });
      S.choir(m, t, h, [43, 50], { level: 0.022, attack: 0.6, release: 0.35, vowel: 'oo', breath: 0.06 });
    }, cities - mid + 0.4);
    this.add(sec, verse + 0.3, (t, m) => this.line(m, t, [[50, 0.8], [57, 0.8], [58, Math.max(0.6, cities - verse - 1.9)]], 1, 0.052, 'cello'));
    const lim = [0.45, 0.3, 0.6, 0.25, 0.7, 0.3, 0.5];
    for (let x = verse + 0.1, k = 0; x < cities - 0.15; x += lim[k % lim.length], k++) {
      const kk = k;
      this.add(sec, x, (t, m) => S.strStac({ dry: m.dry, wet: null }, t, kk % 5 === 3 ? 39 : 38, 0.3 + 0.04 * (kk % 3), 0.26, 0.45));
    }
    // the five Philistine cities: five strokes, a low Phrygian horn cluster swelling into the descent to the coast
    const cg = Math.min(0.36, (end - cities - 0.6) / 5);
    for (let i = 0; i < 5; i++) {
      const ii = i;
      this.add(sec, cities + i * cg, (t, m) => {
        S.drum(m, t, 'taiko', 0.24 + 0.05 * ii, ii % 2 ? 0.25 : -0.25, 0.85);
        S.drum(m, t + 0.005, 'boom', 0.06 + 0.02 * ii, 0, 0.9);
      });
    }
    this.add(sec, cities, (t, m, h) => {
      this.horn(m, t, h, lite ? [50, 51, 57] : [38, 39, 50, 51, 57], 0.045, Math.min(h * 0.7, 2.2), rel);
      if (!lite) S.pad(m, t, h, [26], { level: 0.03, attack: h * 0.6, release: rel, cutoff: 140, voices: 2, detune: 4, type: 'triangle' });
      S.choir(m, t + 0.3, h - 0.3, [50, 51, 57], { level: 0.03, attack: h * 0.6, release: rel, vowel: 'oh', breath: 0.08 });
    }, end - cities + rel);
    const rl = Math.min(2.2, end - cities);
    this.add(sec, end - rl, (t, m) => riserFx(this.c, S, m, t, rl, 'dark', 0.8, lite));
  }

  /**
   * P6 — THE PHILISTINE HOST (7 s, open ON the host — close and clear from its first frame): the menace at once — the
   * front ranks' footfall near and full, the war drums already marching on the first frame (X . . x X . x . per bar, a
   * deep boom each bar, growing), the brass-like low horns (D E♭ D C D, E♭ D, then down to the dominant A), thousands on
   * foot, bronze glinting, a foreign host's murmur (with a 13:19 verse on screen, the anvil). CUT v6.1 (the sound
   * carries the cut): once the crane has arrived (`settle`) the last bar is a fill and the phrase CLOSES ON A DRUM HIT
   * exactly on the hard cut to Ramah (the hit on Ramah's bus, built tight); the host's own sound leaves with the picture.
   */
  private planThreat(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, D = end - t0;
    const card = clamp(this.text(sec, 0, this.beat(sec, 'card')), t0, end - 2);
    const verse = clamp(this.text(sec, 1, this.beat(sec, 'verse')), card, end - 1.5);
    // (CUT v6.1: the host leaves with the picture at the cut — a short fall; the phrase closes on a hit ON the cut)
    const fall = sec.exit === 'fall' ? (sec.tau < 0.4 ? 0.25 : 1.3) : 0.05;
    const settle = clamp(this.beat(sec, 'settle'), t0 + 1, end - 0.3);
    const nx = this.secs[sec.i + 1];
    // cut7's lens (FILM_CAM.threat): beside the front ranks, still, for its first 2 s, then one slow crane up and back
    // (still rising at the cut) — the near footfall full at once (no slow build), thinning as the lens climbs away from
    // it into the massed, darker tread of the whole column
    // (the contract's `crane` beat: when the lens starts its rise — 2.0 s if a sheet has none)
    const crane = Math.min(this.sheetBeat(sec, 'crane') ?? t0 + 2.0, end - 1), near = Math.min(end, crane + 5.5);
    this.add(sec, t0, (t, _m, h, fx) => this.fx.march(fx, t, h, 0.5, 0.92, 6000, 0.12, Math.max(0.3, near - crane - 0.5)), near - t0);
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(this.far(fx, t, h + 1, 2000, 0, 0.4), t + 0.1, h - 0.1, 0.17, lite ? 2 : 3), D + fall);
    this.add(sec, crane - 1, (t, _m, h, fx) => this.fx.march(fx, t, h, 0.4, 0.86, 2600, 3.5), end + fall - crane + 1);
    for (let x = t0 + 0.15; x < end - 0.2; x += rand(0.3, 0.6)) {
      const w = 1 - 0.6 * clamp((x - crane - 0.5) / 5.5, 0, 1);
      this.add(sec, x, (t, _m, _h, fx) => this.fx.clinks(fx, t, rand(0.012, 0.024) * w));
    }
    // the first frame: the host is already there — a downbeat accent
    this.add(sec, t0, (t, m) => { S.drum(m, t, 'taiko', 0.62, -0.15); S.drum(m, t + 0.012, 'taiko', 0.5, 0.15); S.drum(m, t + 0.004, 'boom', 0.12, 0, 0.9); });
    // the pattern grows over the shot; after the crane has arrived (`settle`) its last bar is a fill into the HIT that
    // closes the phrase exactly on the cut to Ramah (CUT v6.1: the hard cut lands on the drum, never in a move)
    const st = BEAT / 2, pat = 'X..xX.x.', fill = Math.max(settle, end - 0.75);
    for (let x = t0 + st, k = 1; x < fill - 0.05; x += st, k++) {
      const c = pat[k % 8], u = 0.4 + 0.6 * clamp((x - t0) / Math.max(1, D), 0, 1), kk = k;
      if (c === '.') {
        if (k % 8 === 7 || k % 8 === 2) this.add(sec, x, (t, m) => S.drum({ dry: m.dry, wet: null }, t, k % 8 === 7 ? 'tek' : 'ka', (lite ? 0.12 : 0.09) + 0.07 * u, 0.25));
        continue;
      }
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        if (c === 'X') { S.drum(m, t, 'taiko', 0.48 + 0.2 * u, kk % 16 ? 0.2 : -0.2, 0.82); S.drum(dry, t, 'dum', 0.38 + 0.12 * u, 0); }
        else S.drum(dry, t, 'dum', 0.3 + 0.12 * u, 0.1);
        if (kk % 8 === 0) S.drum(m, t + 0.004, 'boom', 0.08 + 0.06 * u, 0, 0.9);
        if (kk % 8 === 0 || kk % 8 === 4) S.strStac(dry, t, kk % 8 ? 45 : 50, 0.5 + 0.2 * u, 0.3, 0.8);
      });
    }
    for (let x = fill, k = 0; x < end - 0.06; x += st / 2, k++) {
      const w = clamp((x - fill) / Math.max(0.2, end - fill), 0, 1), kk = k;
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(dry, t, kk % 2 ? 'ka' : 'tek', (lite ? 0.14 : 0.11) + 0.2 * w, kk % 2 ? -0.25 : 0.25);
        if (kk % 2 === 0) S.drum(dry, t, 'dum', 0.26 + 0.24 * w, 0, 0.92);
      });
    }
    // THE HIT on the cut (Ramah's first frame; on its bus, built tight): the taiko pair, the deep drum, the low D
    if (nx) {
      this.add(sec, end, (t, m) => {
        S.drum(m, t, 'taiko', 0.66, -0.15); S.drum(m, t + 0.012, 'taiko', 0.54, 0.15);
        S.drum(m, t + 0.004, 'boom', 0.2, 0, 0.88);
        S.drum({ dry: m.dry, wet: null }, t, 'dum', 0.46, 0);
        S.strStac({ dry: m.dry, wet: null }, t, 38, 0.62, 0.45, 0.8);
        if (!lite) S.strStac({ dry: m.dry, wet: null }, t + 0.004, 26, 0.5, 0.5, 0.8);
      }, 0, nx, true);
    }
    // the low horns: the menace motif over the whole shot, down to the dominant (A) held into the fall
    const un = D / 10.2;
    const motif: Array<readonly [number, number]> = [[50, 2], [51, 1], [50, 1], [48, 2], [50, 1], [51, 0.5], [50, 0.5], [45, 2.2 + (fall - 0.3) / un]];
    this.add(sec, t0 + 0.02, (t, m) => {
      this.line(m, t, motif, un, 0.085, 'horn');
      this.line(m, t + 0.012, motif.map(([n, b]) => [n - 12, b] as const), un, lite ? 0.03 : 0.05, 'horn');
      // phones: the menace an octave up too, where their speaker plays
      if (lite) this.line(m, t + 0.006, motif.map(([n, b]) => [n + 12, b] as const), un, 0.04, 'horn');
      this.line(m, t + 0.008, motif.map(([n, b]) => [n + 7, b] as const), un, 0.04, 'horn');
      S.choir(m, t, D + fall, [50, 57], { level: 0.03, attack: 1.2, release: Math.max(0.2, fall), vowel: 'oh', breath: 0.08 });
    });
    // 13:19 — no smith in all the land of Israel: iron on the anvil, far off, twice (and once more) — only while the
    // verse is on screen (CUT v6 drops it: no anvil)
    if (sec.texts.length < 2) return;
    this.add(sec, verse + 0.1, (t, _m, _h, fx) => this.fx.anvil(this.far(fx, t, 4, 7000, 0.25, 0.6), t, 0.05, 0.35));
    this.add(sec, verse + 0.55, (t, _m, _h, fx) => this.fx.anvil(this.far(fx, t, 4, 7000, 0.25, 0.6), t, 0.04, 0.35));
    if (end - verse > 3) this.add(sec, verse + 2.55, (t, _m, _h, fx) => this.fx.anvil(this.far(fx, t, 4, 6000, 0.25, 0.6), t, 0.03, 0.4));
  }

  /**
   * P7 — RAMAH (1 Sam 8:4-6): the elders' murmur in the gateway (hushing as one of them rises, swelling in agreement
   * under the demand, falling silent when Samuel turns away), a low ground and a thin high tone; under "give us a king"
   * the king's three notes (D A B♭) in the low strings and the men's voices — the B♭ held, trembling; on `away` a tense,
   * unresolved cluster (D E♭ A B♭) swells, sucked into a breath of silence before the shofar (the bus is cut GAP s
   * before the frame).
   */
  private planElders(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const t1 = end - sec.gap;
    const rise = clamp(this.beat(sec, 'rise'), t0 + 0.3, t1 - 3);
    const verse = clamp(this.text(sec, 1, this.beat(sec, 'verse')), rise, t1 - 2.5);
    const away = clamp(this.beat(sec, 'away'), verse + 1, t1 - 0.8);
    // the gateway: the elders' murmur (8-12 old men, close)
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(fx, t, h, 0.21, 4), rise - t0 + 0.4);
    this.add(sec, verse + 0.5, (t, _m, h, fx) => this.fx.murmur(fx, t, h, 0.2, lite ? 3 : 5), away - verse - 0.3);
    // an elder rises: wool, his staff on the stones; Samuel turns his face away: his mantle, a step
    this.add(sec, rise, (t, _m, _h, fx) => { this.fabric(fx, t, 0.7, 0.02, -0.2); this.fx.knock(fx, t + 0.35, 0.03, 1); });
    this.add(sec, away, (t, _m, _h, fx) => { this.fabric(fx, t, 0.8, 0.018, 0.3); this.step(fx, t + 0.5, 0.18, 0.3); });
    // the ground, a thin high tone, the strings' bare D–A (tension without a third)
    this.add(sec, t0, (t, m, h) => {
      this.ground(m, t, h, 0.04, 0.8, 0.05);
      S.pad(m, t, h, lite ? [50, 57] : [38, 45, 50, 57], { level: 0.026, attack: 0.9, release: 0.05, cutoff: 800, voices: 2, detune: 6 });
      S.pad(m, t + 0.6, h - 0.6, [81], { level: 0.004, attack: 1.6, release: 0.05, cutoff: 4000, voices: 1, type: 'sine', lfoCents: 20 });
    }, t1 - t0);
    // CUT v6 (5 s, fast and dynamic): the low strings' ostinato in eighths from the rise (D … E♭ rubbing), a tek ticking
    // above it, the tof on the strong beats — growing without a break into the blast; "give us a king" rides on it
    for (let x = rise, k = 0; x < t1 - 0.06; x += BEAT / 2, k++) {
      const u = clamp((x - rise) / Math.max(0.5, t1 - rise), 0, 1), kk = k, rub = kk % 8 === 6 || (u > 0.6 && kk % 4 === 2);
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.strStac(dry, t, rub ? 39 : 38, 0.32 + 0.38 * u, 0.16, 0.55);
        if (!lite) S.strStac(dry, t + 0.005, rub ? 51 : 50, 0.14 + 0.2 * u, 0.12, 0.6);
        else S.strStac(dry, t + 0.005, rub ? 63 : 62, 0.08 + 0.13 * u, 0.1, 0.6);
        if (kk % 2 === 0) S.drum(dry, t + BEAT / 4, 'tek', (lite ? 0.08 : 0.06) + 0.06 * u, kk % 4 ? 0.3 : -0.3);
        if (kk % 4 === 0) S.drum(m, t, 'dum', 0.14 + 0.22 * u, 0, 0.9);
      });
    }
    // "give us a king": the king's notes in the low strings and the men's voices — D, A, then the B♭ held, trembling
    const kn: Array<readonly [number, number]> = [[50, 1], [57, 1], [58, Math.max(0.8, away - verse - 2 + 0.3)]];
    this.add(sec, verse, (t, m) => {
      this.line(m, t, kn, 1, 0.058, 'str');
      this.line(m, t + 0.02, kn, 1, 0.045, 'men');
    });
    // Samuel turns away: the unresolved cluster swells, sucked into the breath before the blast
    this.add(sec, away, (t, m) => {
      const sw = Math.max(0.4, t1 - away);
      S.pad(m, t, sw + 0.01, lite ? [50, 51, 57, 58] : [38, 50, 51, 57, 58], { level: 0.03, attack: 0.35, release: 0.02, cutoff: 700, cutoffEnd: 1400, voices: 2, detune: 10 });
      S.pad(m, t, sw + 0.01, lite ? [50, 51, 57, 58] : [38, 50, 51, 57, 58], { level: 0.075, attack: sw * 0.95, release: 0.02, cutoff: 500, cutoffEnd: 2800, voices: lite ? 2 : 3, detune: 12 });
      S.choir(m, t, sw + 0.01, [50, 51, 57, 58], { level: 0.065, attack: sw * 0.8, release: 0.02, vowel: 'oo', to: 'ah', morph: sw, breath: 0.1 });
      this.fx.suck(m, t1, Math.min(1.2, sw), 0.3, 1.1);
    });
    // the world holds its breath with the music: the gate's wind and voices duck, the hall's tail is cut, for the
    // breath of silence before the blast (the hall comes back with it)
    this.add(sec, t1 - 0.012, (t) => {
      this.duckAmbience(t, 0.1, end - t1 + 0.02, 0.5);
      const p = this.c.hallRet.gain, g = end - t1 + 0.012;
      p.cancelScheduledValues(t); p.setValueAtTime(this.c.hallLevel, t);
      p.linearRampToValueAtTime(0.06, t + 0.025); p.setValueAtTime(0.06, t + g); p.linearRampToValueAtTime(this.c.hallLevel, t + g + 0.2);
    }, 0, undefined, true);
  }

  /** A brass-like low horn section (the score's horns): a swelling chord with a slow brassy opening. */
  private horn(m: Out, t: number, dur: number, midis: readonly number[], level: number, attack: number, release: number): void {
    this.s.pad(m, t, dur, midis, { level, attack, release, cutoff: 1300, cutoffEnd: 900, q: 1.3, voices: this.lite ? 2 : 3, detune: 6, lfoCents: 60 });
  }

  // ================================================================================ 1 · GILGAL

  /**
   * The black before the first picture (G1's hold): a low air in the dark, one deep bloom on a D pedal under the time
   * card, and a swell sucked into a breath of silence before the blast (the bus is cut GAP s before the picture).
   */
  private planOpen(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0;
    const t1 = sec.t1 - sec.gap;
    if (t1 - t0 < 0.3) return;
    const card = clamp(this.text(sec, 0, this.beat(sec, 'time')), t0, Math.max(t0, t1 - 0.5));
    // the low air: wind in the dark, rising and opening toward the blast (the Gilgal bed comes in with the picture)
    this.add(sec, t0 + 0.02, (t, _m, h, fx) => this.air(fx, t, h, 0.06), t1 - t0 - 0.02);
    // the time card: one deep, soft bloom; a D pedal (sub and low voices) under it
    this.add(sec, card, (t, m, h) => {
      S.drum(m, t, 'boom', 0.2, 0, 0.88);
      this.ground(m, t, h, 0.06, Math.min(0.5, h * 0.4), 0.04);
      S.choir(m, t + 0.04, h - 0.04, [38, 45], { level: 0.03, attack: Math.max(0.3, h * 0.7), release: 0.04, vowel: 'oo', breath: 0.05 });
    }, t1 - card);
    // the swell into the blast: a reverse swell and a dark cluster (D–E♭–A) brightening into the breath of silence
    const sw = clamp(t1 - card - 0.25, 0.3, 1.0);
    this.add(sec, t1 - sw, (t, m) => {
      this.fx.suck(m, t + sw, sw, 0.16, 1.15);
      S.pad(m, t, sw + 0.01, lite ? [38, 39, 45] : [26, 38, 39, 45], { level: 0.055, attack: sw * 0.95, release: 0.02, cutoff: 450, cutoffEnd: 1900, voices: 2, detune: 12 });
    });
  }

  /**
   * G1 — THE SHOFAR with the picture: the blast and the hit (the film's opening hit), the front rank's horns, the army
   * out of the dust wall (thousands on foot, the murmur, bronze), a slow processional of drums and low men's voices.
   */
  private planShofar(sec: Sec): void {
    const S = this.s, lite = this.lite, end = sec.t1;
    const blast = clamp(this.beat(sec, 'blast'), sec.t0, end - 1);
    const d = end - blast;
    const horns = clamp(this.beat(sec, 'horns'), blast + 0.2, end - 0.5);
    const card = clamp(this.text(sec, 0, this.beat(sec, 'card')), blast, end - 0.3);
    // the blast ON the picture (tight: built just before it is due): the ram's horn, the hit, a low chord of strings
    // and men's voices that blooms and sinks into the march
    this.add(sec, blast, (t, m, _h, fx) => {
      S.shofar(m, t, 'gedolah', 0.43, 220, 293.66);
      this.hit(m, t, 0.8, true);
      this.fx.impact(fx, t, 0.45, 2.2);
      S.pad(m, t, 0.35, [26, 38, 45, 50], { level: 0.12, attack: 0.02, release: 2.4, cutoff: 1500, cutoffEnd: 420, voices: lite ? 2 : 3, detune: 11 });
      S.choir(m, t + 0.01, 0.4, lite ? [38, 45, 50] : [38, 45, 50, 57], { level: 0.09, attack: 0.04, release: 2.2, vowel: 'ah', breath: 0.16 });
    }, 0, undefined, true);
    // the front rank lifts its horns: two more rams' horns, raw and untuned against the first
    this.add(sec, horns, (t, m) => {
      S.shofar(this.panned(m, t, 3, -0.45), t, 'tekiah', 0.25, 211, 283);
      S.shofar(this.panned(m, t, 3, 0.5), t + 0.12, 'tekiah', 0.22, 229, 305);
    });
    // the army: thousands on foot coming out of the dust, the murmur of the ranks, bronze, spear shafts on shields
    this.add(sec, blast, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.34, 1, 6500, 0.6);
      this.fx.murmur(fx, t + 0.4, h - 0.4, 0.34, lite ? 2 : 0);
    }, d + 0.35);
    this.add(sec, blast + 0.2, (t, _m, _h, fx) => this.fx.dustGust(fx, t, Math.min(3.6, d), 0.09));
    for (let x = blast + 0.8; x < end - 0.2; x += lite ? rand(0.5, 1) : rand(0.3, 0.7)) {
      this.add(sec, x, (t, _m, _h, fx) => {
        this.fx.clinks(fx, t, rand(0.012, 0.028));
        if (chance(lite ? 0.3 : 0.45)) this.fx.knock(fx, t + rand(0.05, 0.25), rand(0.02, 0.04), randi(1, 3));
      });
    }
    // the drums (score only): a slow processional from a second after the blast — the big drum on every second, the
    // half-beats lighter — with low strings on D and men's voices growing toward the slow motion
    const p0 = blast + 2 * BEAT;
    for (let x = p0, k = 0; x < end - 0.05; x += BEAT, k++) {
      const big = k % 2 === 0, kk = k, u = clamp((x - p0) / Math.max(0.5, end - p0), 0, 1);
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        // CUT v6: the start of the king's line (it grows to the tear) — the processional a little under the roar
        if (big) {
          S.drum(m, t, 'taiko', 0.33 * (0.85 + 0.3 * u), kk % 4 ? 0.22 : -0.22);
          S.drum(m, t + 0.006, 'boom', 0.07 + 0.06 * u, 0, 0.95);
          S.drum(dry, t, 'dum', 0.22, 0);
          S.choir(m, t, BEAT * 2 + 0.25, lite ? [38, 45] : [38, 45, 50], { level: 0.036 + 0.022 * u, attack: 0.06, release: 0.35, vowel: 'oh', breath: 0.12 });
        } else S.drum(m, t, 'taiko', 0.2 * (0.85 + 0.3 * u), kk % 4 === 1 ? -0.3 : 0.3);
        S.drum(dry, t + BEAT * 0.5, 'tek', lite ? 0.12 : 0.09, 0.2);
        if (!lite) S.drum(dry, t + BEAT * 0.75, 'ka', 0.06 + 0.04 * u, -0.3);
        S.strStac(dry, t, kk % 4 === 3 ? 45 : 38, big ? 0.5 : 0.36, 0.26, 0.6);
        if (!lite) S.strStac(dry, t + BEAT * 0.5, 38, 0.28, 0.2, 0.5);
      });
    }
    // the place card: a high glint over the gold
    this.add(sec, card, (t, m) => S.pad(m, t, 1.6, [81, 86], { level: 0.007, attack: 0.4, release: 1, cutoff: 6500, voices: 2, detune: 6, trem: 0.3, tremRate: 10 }));
    // a flam into the slow motion; the low drone under the march
    this.add(sec, end - BEAT * 0.5, (t, m) => { S.drum(m, t, 'taiko', 0.25, -0.3); S.drum(m, t + 0.06, 'taiko', 0.32, 0.3); });
    // CUT v6.1: the cut to G2 is hidden in a man of the front rank passing close across the lens (`wipe`) — his pass (a
    // close rush of wool and air sweeping across, a footfall, bronze at his belt) crosses the cut on G2's bus
    const wipe = clamp(this.beat(sec, 'wipe'), blast + 0.5, end - 0.1);
    const nx = this.secs[sec.i + 1];
    // (his closest pass ≈ 0.2-0.3 s after `wipe`, his body filling the frame into the cut — host1's staging)
    const pk = Math.min(wipe + 0.25, end - 0.05);
    this.add(sec, wipe - 0.25, (t, _m, _h, fx) => this.passBy(fx, t, end - wipe + 0.75, pk - wipe + 0.25, 0.075), 0, nx);
    this.add(sec, blast + 0.4, (t, m, h) => S.pad(m, t, h, [26, 38, 45], { level: 0.055, attack: 0.8, release: 0.5, cutoff: 700, voices: lite ? 2 : 3, detune: 10 }), end - blast - 0.4);
  }

  /**
   * G2 — SAUL in slow motion (6.5 s): the world muffled, the drums at half time, his theme D A B♭-A G F in low strings
   * and men's voices across the whole take — its B♭ on the head turn over the ranks — and the E held into the roar.
   */
  private planSaul(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const card = clamp(this.text(sec, 0, this.beat(sec, 'card')), t0, end - 0.5);
    const head = clamp(this.beat(sec, 'head'), t0 + 1.2, end - 1.2);
    // slow motion: the world (ambience + army) through the slow filter, the tread slowed and deepened, wind in his cloak
    this.add(sec, t0, (t, _m, h, fx) => {
      this.muffle(t, 1300, 0.06, 0.35);
      this.fx.march(fx, t, h, 0.55, clamp(sec.slowmo * 0.85, 0.3, 1), 2400, 0.12);
      this.fx.windSwell(fx, t + 0.4, (h - 0.4) * 0.55, 0.04, 250, 700, 0.3, -0.3);
      this.fx.windSwell(fx, t + 0.4 + (h - 0.4) * 0.45, (h - 0.4) * 0.55, 0.035, 260, 760, -0.3, 0.3);
    }, d);
    this.add(sec, end - 0.02, (t) => this.muffle(t, 18000, 0.03, 0), 0, undefined, true);
    // half-time drums: his stride (a big drum every second, the subdivisions gone) — CUT v6.1: the last stroke falls ON
    // his last stride (`lastStep`), which G3 picks up from the other angle (a cut on action: no bar line at the cut; the
    // next stroke is his halt in G3)
    const lastStep = clamp(this.beat(sec, 'lastStep'), t0 + 1, end - 0.1);
    for (let x = t0, k = 0; x < Math.min(end - 0.3, lastStep - 0.45); x += BEAT * 2, k++) {
      const first = k === 0, kk = k;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', first ? 0.48 : 0.44 + 0.02 * kk, 0, 0.8);
        S.drum(m, t, 'boom', first ? 0.2 : 0.15, 0, 0.88);
      });
    }
    this.add(sec, lastStep, (t, m) => { S.drum(m, t, 'taiko', 0.52, 0, 0.8); S.drum(m, t, 'boom', 0.16, 0, 0.88); });
    // the theme across the take: D and A before the head turn, the B♭ ON it, then A G F — the E from the last bar
    const pre = head - t0, post = end - head;
    const theme: Array<readonly [number, number]> = [[50, pre * 0.5], [57, pre * 0.5], [58, post * 0.31], [57, post * 0.1], [55, post * 0.2], [53, post * 0.2]];
    const eAt = head + post * 0.81;
    this.add(sec, t0 + 0.03, (t, m) => {
      this.line(m, t, theme, 1, 0.095, 'str');
      this.line(m, t + 0.02, theme.map(([n, b]) => [n - 12, b] as const), 1, 0.075, 'men');
      // phones: the theme an octave up as well (its own octave is below their speaker) — the line must carry there too
      if (lite) this.line(m, t + 0.01, theme.map(([n, b]) => [n + 12, b] as const), 1, 0.05, 'str');
    });
    // the head turn: the theme's height — a deep stroke and the high strings opening
    this.add(sec, head, (t, m) => {
      S.drum(m, t, 'boom', 0.16, 0, 0.85);
      S.pad(m, t, Math.max(0.8, end - head), [74, 77], { level: 0.012, attack: 0.6, release: 0.5, cutoff: 3200, voices: 2, detune: 7, trem: 0.4, tremRate: 7 });
    });
    const peak = this.secs[sec.i + 1]?.role === 'peak' ? this.secs[sec.i + 1] : undefined;
    const roar = peak ? this.beat(peak, 'roar') : end;
    // the E: its low octave (strings and men) until the halt — the floor drops out when thousands of feet stop — its
    // upper octave held, trembling and brightening, into the roar
    const halt = peak ? clamp(this.beat(peak, 'halt'), eAt + 0.3, roar - 0.2) : roar;
    this.add(sec, eAt, (t, m, h) => {
      S.pad(m, t, h + 0.08, [52], { level: 0.085, attack: Math.min(0.3, h * 0.2), release: 0.06, cutoff: 1300, cutoffEnd: 2800, q: 1, voices: lite ? 2 : 3, detune: 10, lfoCents: 100, vib: 10, vibRate: 5.6, vibDelay: 0.3, trem: 0.25, tremRate: 7 });
      S.choir(m, t + 0.02, h + 0.06, [52], { level: 0.06, attack: Math.min(0.3, h * 0.2), release: 0.06, vowel: 'oh', breath: 0.1 });
    }, roar - eAt, peak);
    this.add(sec, eAt, (t, m, h) => {
      S.pad(m, t, h, [40], { level: 0.085, attack: Math.min(0.3, h * 0.2), release: 0.25, cutoff: 900, q: 1, voices: lite ? 2 : 3, detune: 10, lfoCents: 100 });
      S.choir(m, t + 0.02, h, [40], { level: 0.06, attack: Math.min(0.3, h * 0.2), release: 0.25, vowel: 'oh', breath: 0.1 });
    }, halt - eAt + 0.1, peak);
    this.add(sec, t0, (t, m, h) => {
      S.pad(m, t, h, [74, 81], { level: 0.013, attack: 1.2, release: 0.4, cutoff: 3000, voices: 2, detune: 8, trem: 0.5, tremRate: 7 });
      S.pad(m, t, h, lite ? [38, 50] : [26, 38], { level: 0.07, attack: 0.3, release: 0.4, cutoff: 400, voices: lite ? 2 : 3, detune: 6 });
    }, d);
    // the king's name: a soft high glint over the gold
    this.add(sec, card, (t, m) => S.pad(m, t, 1.8, [86], { level: 0.008, attack: 0.5, release: 1.1, cutoff: 7000, voices: 2, detune: 6, trem: 0.3, tremRate: 10 }));
  }

  // ================================================================================ 2 · THE SPEAR AND THE SILENCE

  /**
   * G3 — the halt, the spear raised, and THE ROAR of thousands ON the theme's resolution, held to the cut: the theme's
   * head restated at full power — then (CUT v5.2, the 'fall' exit) the roar and the chord sag on G4's first frame and
   * die away over ≈2 s with their reverb, the B♭ sighing to A, into G4's hush (planSilence).
   */
  private planPeak(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const spear = this.beat(sec, 'spear');
    const roar = clamp(this.beat(sec, 'roar'), spear + 0.05, end - 0.4);
    const halt = Math.min(this.beat(sec, 'halt'), roar - 0.25);
    const spread = clamp(this.beat(sec, 'spread') - sec.shots[0].t, 0.1, 0.8);
    // the march until the halt: thousands of feet stop, a last scuff and rattle
    this.add(sec, t0, (t, _m, _h, fx) => this.fx.march(fx, t, Math.max(0.3, halt - t0 + 0.12), 0.38, 1, 6500, 0.04));
    // (CUT v6.1: no stroke on the cut from G2 — the stride's next stroke is the halt)
    this.add(sec, halt, (t, _m, _h, fx) => {
      for (let i = 0; i < (lite ? 2 : 4); i++) this.step(fx, t + rand(0, 0.12), rand(0.25, 0.4), rand(-0.7, 0.7), 'gravel');
      this.fx.clinks(fx, t + 0.05, 0.03, 3);
    });
    // the build from the halt into the roar: a drum roll (high drums and a low tof rolling under them) growing ever
    // faster and louder, a riser, men's voices and low strings swelling on the E's open fifth, the spear going up
    for (let x = halt, k = 0; x < roar - 0.07; x += BEAT / 4, k++) {
      const u = (x - halt) / Math.max(0.3, roar - halt), even = k % 2 === 0;
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(dry, t, u > 0.5 ? 'tek' : 'ka', 0.12 + 0.44 * u * u, rand(-0.3, 0.3));
        if (u > 0.35 && !lite) S.drum(dry, t + BEAT / 8, 'ka', 0.07 + 0.26 * u * u, rand(-0.3, 0.3));
        if (u >= 0.4 && (even || u > 0.7)) S.drum(m, t, 'dum', 0.1 + 0.5 * (u - 0.4) / 0.6, rand(-0.15, 0.15), 0.95);
      });
    }
    this.add(sec, halt, (t, m) => S.drum(m, t, 'taiko', 0.45, 0, 0.9));
    const rl = roar - halt;
    this.add(sec, halt, (t, m) => {
      riserFx(this.c, S, m, t, rl, 'dark', 2, lite);
      S.choir(m, t, rl + 0.02, lite ? [47, 52] : [47, 52, 59], { level: 0.12, attack: rl * 0.95, release: 0.03, vowel: 'ah', breath: 0.16 });
      S.pad(m, t, rl + 0.02, [47, 52], { level: 0.09, attack: rl * 0.9, release: 0.03, cutoff: 600, cutoffEnd: 3200, voices: lite ? 2 : 3, detune: 12 });
    });
    // the second stage: the low brass and the men come in late and steep — the floor returns under the last beats
    // (desktop: on a phone speaker this is below its range, the first stage carries the build there)
    if (!lite) {
      const s2 = halt + rl * 0.5, l2 = roar - s2;
      this.add(sec, s2, (t, m) => {
        S.pad(m, t, l2 + 0.02, [28, 40, 47], { level: 0.12, attack: l2 * 0.95, release: 0.03, cutoff: 350, cutoffEnd: 2400, voices: 3, detune: 12 });
        S.choir(m, t, l2 + 0.02, [40, 47], { level: 0.11, attack: l2 * 0.95, release: 0.03, vowel: 'ah', breath: 0.2 });
      });
      for (let x = roar - Math.min(0.5, rl * 0.45); x < roar - 0.12; x += BEAT / 4) {
        const u = 1 - (roar - x) / 0.5;
        this.add(sec, x, (t, m) => S.drum(m, t, 'boom', 0.1 + 0.25 * u, 0, 1.05));
      }
    }
    this.add(sec, spear, (t, _m, _h, fx) => {
      this.whoosh(fx, t, 0.35, 0.05, 900, 3200, 0.3);
      this.fx.clinks(fx, t + 0.08, 0.025, 4);
    });
    // THE ROAR: the hit, the theme's D at full power, thousands shouting, spears on shields, the shofarot above
    this.add(sec, roar, (t, m) => this.hit(m, t, 1.02, true), 0, undefined, true);
    const rest = end - roar;
    // into G4 the music FALLS under the next section's music (exit 'fall'): the last chord and the theme's B♭ sighing to A
    // flow on across the cut (the roar itself breaks off on the cut — below)
    const fall = sec.exit === 'fall', fr = fall ? 1.4 : 0;
    this.add(sec, roar, (t, m, h) => {
      // Dm — B♭ — A: the cut comes on the dominant, the B♭ of the theme rubbing against it
      const chords: ReadonlyArray<readonly [ChordName, number]> = [['Dm', 0], ['Bb', 0.45], ['A', 0.75]];
      chords.forEach(([cn, f], i) => {
        const ch = CHORDS[cn];
        const last = i + 1 === chords.length;
        const len = (last ? h : chords[i + 1][1] * rest) - f * rest;
        const rc = last && fall ? fr : 0.25, rp = last && fall ? fr : 0.2;
        S.choir(m, t + f * rest, len + (last && fall ? rc : 0.3), voicing(ch, 50, 74).slice(0, lite ? 4 : 7), { level: 0.085, attack: 0.04, release: rc, vowel: 'ah', breath: 0.16 });
        S.pad(m, t + f * rest, len + (last && fall ? rp : 0.25), [rootIn(ch, 26), rootIn(ch, 38), rootIn(ch, 38) + 7], { level: 0.08, attack: 0.03, release: rp, cutoff: 1800, voices: lite ? 2 : 3, detune: 11 });
      });
      // the theme resolved: D in the high strings and the men, then its head again (A, B♭); falling into G4 (CUT v5.2),
      // the B♭ sighs down to A as the roar dies (the thread the hush keeps) — the old cut in mid-phrase without a fall
      if (fall) {
        this.line(m, t, [[74, 0.45 * rest], [81, 0.3 * rest], [82, 0.25 * rest + 0.05], [81, 1.2]], 1, 0.075, 'str');
        this.line(m, t, [[38, 0.75 * rest], [45, 0.25 * rest + 1.0]], 1, 0.08, 'men');
      } else {
        this.line(m, t, [[74, 0.45 * rest], [81, 0.3 * rest], [82, 0.25 * rest + 0.1]], 1, 0.075, 'str');
        this.line(m, t, [[38, 0.75 * rest], [45, 0.25 * rest + 0.1]], 1, 0.08, 'men');
      }
    }, rest);
    for (let x = roar, k = 0; x < end - 0.05; x += BEAT, k++) {
      const kk = k, u = clamp((x - roar) / Math.max(0.5, rest), 0, 1);
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        // CUT v6: a little under the tear's height (the peak of the line is the tear)
        S.drum(m, t, 'taiko', kk === 0 ? 0.62 : 0.44 + 0.06 * u, -0.2); S.drum(m, t + 0.01, 'taiko', 0.38 + 0.06 * u, 0.25);
        S.drum(dry, t + BEAT * 0.5, 'dum', 0.3, 0);
        if (!lite && u > 0.45) { S.drum(dry, t + BEAT * 0.25, 'tek', 0.08 + 0.06 * u, 0.25); S.drum(dry, t + BEAT * 0.75, 'ka', 0.07 + 0.05 * u, -0.25); }
      });
    }
    // the shofarot over the shouting: the teruah, then a long tekiah from the far ranks
    this.add(sec, roar + 0.3, (t, m) => S.shofar(m, t, 'teruah', 0.24, 220, 293.66));
    if (rest > 2.2) this.add(sec, roar + 1.75, (t, m) => S.shofar(this.panned(m, t, 3, -0.4), t, 'tekiah', 0.18, 214, 286));
    // CUT v6.1 (a cut on sound and eyeline): from `notice` the nearest men turn their heads and fall silent one by one —
    // the roar thins — and it BREAKS OFF exactly on the cut to G4 (what they see: Samuel); the king's music goes on
    const notice = clamp(this.beat(sec, 'notice'), roar + 0.6, end - 0.15);
    const brk = fall || this.secs[sec.i + 1]?.role === 'silence';
    this.add(sec, roar, (t, _m, _h, fx) => {
      if (brk) this.fx.roar(fx, t, rest, 0.17, spread, 1, undefined, notice - roar);
      else this.fx.roar(fx, t, rest + 0.05, 0.17, spread, 1);
      const k = Math.round(clamp(rest / 1.6, 1, 2) * (lite ? 3 : 5));
      for (let i = 0; i < k; i++) this.fx.clinks(fx, t + 0.3 + rand(0, Math.max(0.2, notice - roar - 0.5)), 0.03, 2);
      for (let i = 0; i < Math.round(k * 0.7); i++) this.fx.knock(fx, t + 0.25 + rand(0, Math.max(0.2, notice - roar - 0.4)), 0.05, randi(2, 4));
    }, rest + 0.05);
  }

  /**
   * G4 — SAMUEL BEFORE THE KING (CUT v6.1, 6 s — the user: Saul's music must go ON through the meeting with Samuel; not
   * a hush). The roar broke off on the cut (they have seen him); the chord's tail falls away under the king's music,
   * which carries on, darker and heavier: his stride in the drums at half time (the taiko pair on every second, a low tof
   * after it), the low strings pacing in quarters, and his theme going on in the low horns and the men's voices — D, A,
   * B♭ ON Samuel's name, A, G under 15:26, F, E♭ ("rejected"), D, and the C♯ leaning into the tear — over Dm – B♭ – Gm –
   * E♭ – A (the Neapolitan's weight before the dominant); the sub D under all of it; one high A (the thread the tear
   * takes up as its grief) from Samuel's name. The army's small sounds and his step stay in the world.
   */
  private planSilence(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const heads = this.beat(sec, 'heads'), part = this.beat(sec, 'part'), step = this.beat(sec, 'step');
    const card = clamp(this.text(sec, 0, this.beat(sec, 'card')), t0 + 0.3, end - 3);
    const verse = clamp(this.text(sec, 1, this.beat(sec, 'verse')), card + 0.4, end - 1.8);
    const tear = this.secs[sec.i + 1]?.role === 'tear' ? this.secs[sec.i + 1] : undefined;
    const fell = this.secs[sec.i - 1]?.exit === 'fall';
    // the world after the roar (CUT v6.1: it broke off on the cut — every man has seen Samuel): the army's own sound
    // drops with it and creeps back while the king's music goes on
    this.add(sec, t0, (t) => this.duckAmbience(t, fell ? 0.45 : 0.4, 0.4, 2.6), 0, undefined, true);
    // the harmony: Dm – B♭ (Samuel) – Gm (15:26) – E♭ ("rejected") – A ON his turn to go (`turnGo`: the cut to G5a
    // continues that turn — the dominant carries it)
    const rej = clamp(verse + 0.42 * (end - verse), verse + 0.6, end - 1.0);
    const dom = clamp(this.beat(sec, 'turnGo'), rej + 0.4, end - 0.1);
    const prog: ReadonlyArray<readonly [number, readonly number[], readonly number[], number]> = [
      // [from, desktop voicing, phone voicing, bass]
      [t0, [45, 50, 53, 57, 62], [50, 53, 57, 62], 38],
      [card, [46, 50, 53, 58, 62], [50, 53, 58, 62], 34],
      [verse, [43, 50, 55, 58, 62], [50, 55, 58, 62], 31],
      [rej, [46, 51, 55, 58, 63], [51, 55, 58, 63], 39],
      [dom, [45, 52, 55, 61, 64], [52, 55, 61, 64], 33],
    ];
    prog.forEach(([a, hi, ph, bass], i) => {
      const b = i + 1 < prog.length ? prog[i + 1][0] : end + 0.5;
      const last = i + 1 === prog.length;
      this.add(sec, a, (t, m, h) => {
        S.pad(m, t, h, lite ? ph : hi, { level: 0.052, attack: i === 0 ? 0.25 : 0.12, release: 0.25, cutoff: 1200, cutoffEnd: 1500, voices: lite ? 2 : 3, detune: 9 });
        S.pad(m, t, h, lite ? [bass + 12] : [bass, bass + 12], { level: 0.042, attack: 0.1, release: 0.25, cutoff: lite ? 700 : 380, voices: 2, detune: 6 });
        // (phones: the first chord's voices come from the roar's own falling choir — the voice budget at the junction)
        if (!lite || i > 0) S.choir(m, t + 0.02, h, (lite ? ph : hi).slice(0, 3), { level: 0.042, attack: 0.25, release: 0.3, vowel: 'oh', breath: 0.1 });
        if (!lite) this.horn(m, t, h, [bass + 12, bass + 19], 0.04, 0.2, 0.3);
      }, b - a + 0.1, last && tear ? tear : undefined);
    });
    const g0 = lite ? t0 + 0.8 : t0;
    this.add(sec, g0, (t, m, h) => this.ground(m, t, h, 0.05, 0.3, 0.4), end - g0 + 0.2);
    // the king's theme goes on in the low horns and the men (an octave apart), heavy and slow
    const vr = end - verse;
    const theme: Array<readonly [number, number]> = [
      [50, (card - t0) * 0.5], [45, (card - t0) * 0.5], [46, (verse - card) * 0.6], [45, (verse - card) * 0.4],
      [43, (rej - verse) * 0.55], [41, (rej - verse) * 0.45], [39, (dom - rej) * 0.7], [38, (dom - rej) * 0.3], [37, 0.45 + vr * 0.1],
    ];
    this.add(sec, t0 + 0.02, (t, m) => {
      this.line(m, t, theme, 1, 0.08, 'horn');
      if (!lite) this.line(m, t + 0.015, theme.map(([n, b]) => [n + 12, b] as const), 1, 0.062, 'men');
      // (phones: the cellos an octave higher instead — inside their speaker; the voice budget stays the same)
      if (lite) this.line(m, t + 0.01, theme.map(([n, b]) => [n + 24, b] as const), 1, 0.04, 'str');
      else this.line(m, t + 0.01, theme.map(([n, b]) => [n + 12, b] as const), 1, 0.02, 'cello');
    });
    // his stride: half-time drums — the taiko pair on every second, a low tof after it; heavier on "rejected"
    for (let x = t0, k = 0; x < end - 0.2; x += BEAT * 2, k++) {
      const kk = k, heavy = x >= rej - 0.05;
      this.add(sec, x, (t, m) => {
        const dry: Out = { dry: m.dry, wet: null };
        S.drum(m, t, 'taiko', (kk === 0 ? 0.46 : 0.5) + (heavy ? 0.08 : 0), kk % 2 ? 0.2 : -0.2, 0.82);
        if (!lite || kk > 0) S.drum(m, t + 0.012, 'taiko', 0.38 + (heavy ? 0.06 : 0), kk % 2 ? -0.2 : 0.2, 0.8);
        S.drum(dry, t + BEAT, 'dum', 0.3 + (heavy ? 0.06 : 0), 0, 0.9);
        if (heavy || kk % 2 === 1) S.drum(m, t + 0.004, 'boom', 0.08, 0, 0.92);
      });
    }
    // the low strings pace in quarters (D, its E♭ rubbing under "rejected")
    for (let x = t0 + BEAT, k = 1; x < end - 0.1; x += BEAT, k++) {
      const kk = k, eb = x >= rej && kk % 2 === 1;
      this.add(sec, x, (t, m) => S.strStac({ dry: m.dry, wet: null }, t, eb ? 39 : 38, 0.32 + (x >= rej ? 0.08 : 0), 0.24, 0.6));
    }
    // one high A from Samuel's name — the thread the tear takes up (on its bus: it rings across the cut)
    this.add(sec, card + 0.2, (t, m, h) => S.pad(m, t, h, [81], {
      level: 0.012, attack: Math.min(1.5, h * 0.3), release: 0.5, cutoff: 3600, voices: 2, detune: 4, lfoCents: 30, vib: 9, vibRate: 5.2, vibDelay: 0.8,
    }), (tear ? this.beat(tear, 'grip') : end) - card - 0.2, tear);
    // the world: heads turn (wool, bronze), the front ranks part, the spoil far off (15:14), Samuel's step and mantle
    this.add(sec, heads, (t, _m, _h, fx) => { this.fabric(fx, t, 0.6, 0.016, -0.3); this.fx.clinks(fx, t + 0.2, 0.01, 2); });
    this.add(sec, part, (t, _m, h, fx) => {
      this.fx.march(fx, t, h, 0.07, 0.72, 1100, 0.25);
      this.fx.clinks(fx, t + h * 0.4, 0.008);
      this.fabric(fx, t + h * 0.2, 0.7, 0.01, 0.4);
    }, Math.max(0.6, step - part));
    this.add(sec, t0 + 0.6, (t, _m, _h, fx) => { const f = this.far(fx, t, 4, 1800, 0.35, 0.5); this.fx.bleat(f.dry, t, 0.16, -0.6); });
    if (d > 3) this.add(sec, t0 + 2.6, (t, _m, _h, fx) => this.fx.lowing(this.far(fx, t, 4, 1400, 0.4, 0.5), t, 0.014, 0.55));
    this.add(sec, step, (t, _m, _h, fx) => { this.step(fx, t, 0.4, 0.1); this.fabric(fx, t + 0.05, 0.5, 0.012, 0.15); });
    this.add(sec, t0 + 0.4, (t, _m, h, fx) => this.fx.windSwell(fx, t, h, 0.018, 320, 1100, -0.3, 0.3), d);
  }

  // ================================================================================ 3 · THE TEAR

  /**
   * G5a + G5b — THE TEAR (the PEAK of Saul's music, one line from the shofar). CUT v6.1, G5a 3 s: Samuel's turn goes on
   * from G4's last frame; Saul lets the spear fall (`drop`) — a dull knock of wood on packed earth and a short rattle
   * when it strikes (`spearHits`) — two quick steps (`lunge`), his knee on the ground (`kneel`), all under the music: the
   * king's music quickens — the low strings' pulse accelerating from quarters to sixteenths, the drums on every beat,
   * then in eighths, a roll from the knee — the theme climbing in the strings and horns (A B♭ C D, pleading) to an E♭
   * trembling into the GRIP (a stroke), a riser and a suck from the knee. The insert drops into slow motion and the music reaches its
   * height in slow time: Gm swelling on the pull (the choir on 'ah', the strings in octaves, the grief's A pressing up
   * to B♭), and ON THE RIP the tutti on E♭ (the Neapolitan) with the theme's head on top (D A B♭) and the great drums;
   * when the corner comes free it breaks onto A — the B♭ sighing down to A, a deep stroke, the last thread (the sound of
   * the cold open) — and falls (the 'fall' exit) into the verdict's near-silence. The slowed rip is baked to the pull /
   * rip / free beats; Samuel walks on, Saul sinks back.
   */
  private planTear(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const turn = this.beat(sec, 'turn'), grip = this.beat(sec, 'grip'), lunge = clamp(this.beat(sec, 'lunge'), turn, grip - 0.3);
    // CUT v6.1: the spear is let fall ON SCREEN (`drop`: the hand opens; `spearHits`: the shaft strikes the dust — cut7's
    // beat, else ≈0.55 s after the drop), the two quick steps (`lunge`), the knee on the ground (`kneel`), the grip
    const drop = clamp(this.beat(sec, 'drop'), turn, grip - 0.6);
    const hits = clamp(this.sheetBeat(sec, 'spearHits') ?? drop + 0.55, drop + 0.15, grip - 0.15);
    const kneel = clamp(this.beat(sec, 'kneel'), lunge + 0.2, grip - 0.15);
    const ins = this.shotStart(sec, 1, (SPLIT.tear ?? [4])[0]);
    const pull = Math.max(grip + 0.05, this.beat(sec, 'pull')), free = Math.max(pull + 0.3, this.beat(sec, 'free'));
    const rip = clamp(this.beat(sec, 'rip'), pull + 0.2, free - 0.4);
    // ---- the world (under the music, never over it): Samuel's turn and his steps away, the spear falling, Saul's two
    // quick steps, his knee on the ground
    this.add(sec, turn, (t, _m, _h, fx) => this.fabric(fx, t, 0.8, 0.022, 0.3));
    for (let x = turn + 0.35, k = 0; x < grip - 0.1; x += 0.62, k++) {
      const kk = k;
      this.add(sec, x, (t, _m, _h, fx) => this.step(fx, t, Math.max(0.1, 0.26 - kk * 0.05), clamp(0.3 + kk * 0.12, -1, 0.8)));
    }
    this.add(sec, drop, (t, _m, _h, fx) => this.fabric(fx, t, 0.3, 0.01, -0.3));
    this.add(sec, hits, (t, _m, _h, fx) => this.fx.spearFall(fx, t, 0.09, -0.35));
    this.add(sec, lunge, (t, _m, _h, fx) => {
      this.step(fx, t, 0.4, -0.2, 'skid');
      this.step(fx, t + Math.min(0.32, (kneel - lunge) * 0.45), 0.36, -0.1);
      this.fx.clinks(fx, t + 0.02, 0.026, 4);
      this.whoosh(fx, t, Math.max(0.2, kneel - lunge), 0.035, 500, 2000, -0.2);
    });
    this.add(sec, kneel, (t, _m, _h, fx) => {
      this.step(fx, t, 0.42, -0.05, 'gravel', 0.7);
      this.fx.clinks(fx, t + 0.015, 0.024, 4);
      this.fabric(fx, t + 0.02, 0.45, 0.016, -0.15);
    });
    // ---- the music quickens: the low strings' pulse from quarters to sixteenths (D, the E♭ rubbing), growing
    for (let x = t0 + 0.02, g = BEAT, k = 0; x < grip - 0.06; x += g, g = Math.max(BEAT / 4, g * (x > drop ? 0.8 : 1)), k++) {
      const u = clamp((x - t0) / Math.max(0.5, grip - t0), 0, 1), up = chance(0.25), kk = k;
      this.add(sec, x, (t, m) => {
        S.strStac({ dry: m.dry, wet: m.wet }, t, up ? 39 : 38, 0.3 + 0.32 * u, 0.2, 0.5);
        if (!lite && u > 0.3) S.strStac({ dry: m.dry, wet: null }, t + 0.004, up ? 51 : 50, 0.12 + 0.2 * u, 0.14, 0.6);
        // (phones: the octave on every other note — the voice budget of the 3 s shot)
        else if (lite && kk % 2 === 0) S.strStac({ dry: m.dry, wet: null }, t + 0.004, up ? 63 : 62, 0.08 + 0.12 * u, 0.1, 0.6);
      });
    }
    // the drums: every beat from the turn, eighths from the lunge, a roll from the knee into the grip
    for (let x = t0, k = 0; x < kneel - 0.05; x += x < lunge - 0.05 ? BEAT : BEAT / 2, k++) {
      const u = clamp((x - t0) / Math.max(0.5, kneel - t0), 0, 1), kk = k;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', 0.42 + 0.22 * u, kk % 2 ? 0.2 : -0.2, 0.84);
        S.drum({ dry: m.dry, wet: null }, t + 0.01, 'dum', 0.26 + 0.18 * u, 0, 0.9);
      });
    }
    for (let x = kneel, g = 0.11; x < grip - 0.05; x += g, g = Math.max(lite ? 0.08 : 0.05, g * 0.86)) {
      const w = (x - kneel) / Math.max(0.2, grip - kneel);
      this.add(sec, x, (t, m) => S.drum({ dry: m.dry, wet: null }, t, w > 0.5 ? 'tek' : 'ka', 0.16 + 0.4 * w * w, rand(-0.3, 0.3)));
    }
    // the theme climbing (Saul pleading): A B♭ C D E♭ in the strings, the horns and the men over A – Gm/B♭ – C – Dm –
    // E♭, the E♭ trembling from the knee into the grip
    const cl = (grip - t0) / 5;
    const climb: Array<readonly [number, number]> = [[57, 1], [58, 1], [60, 1], [62, 1], [63, 1.25]];
    this.add(sec, t0 + 0.02, (t, m) => {
      this.line(m, t, climb, cl, 0.06, 'str');
      this.line(m, t + 0.01, climb.map(([n, b]) => [n - 12, b] as const), cl, 0.05, 'horn');
      if (!lite) this.line(m, t + 0.02, climb.map(([n, b]) => [n - 12, b] as const), cl, 0.04, 'men');
    });
    const climbCh: ReadonlyArray<readonly [readonly number[], readonly number[], number]> = [
      [[45, 52, 57, 61], [52, 57, 61], 33], [[46, 50, 55, 58], [50, 55, 58], 34], [[48, 52, 55, 60], [52, 55, 60], 36],
      [[45, 50, 53, 57, 62], [50, 53, 57, 62], 38], [[46, 51, 55, 58, 63], [51, 55, 58, 63], 39],
    ];
    climbCh.forEach(([hi, ph, bass], i) => {
      const a = t0 + i * cl, b = i === 4 ? grip + 0.25 : t0 + (i + 1) * cl;
      this.add(sec, a, (t, m, h) => {
        S.pad(m, t, h, lite ? ph : hi, { level: 0.042 + 0.01 * i, attack: 0.1, release: 0.2, cutoff: 1300 + 250 * i, voices: lite ? 2 : 3, detune: 9, trem: i === 4 ? 0.5 : 0, tremRate: 9 });
        S.pad(m, t, h, lite ? [bass + 12] : [bass, bass + 12], { level: 0.04 + 0.004 * i, attack: 0.08, release: 0.2, cutoff: lite ? 700 : 400, voices: 2, detune: 6 });
        S.choir(m, t + 0.02, h, (lite ? ph : hi).slice(0, 3), { level: 0.03 + 0.008 * i, attack: 0.15, release: 0.25, vowel: i >= 3 ? 'ah' : 'oh', breath: 0.12 });
      }, b - a + 0.06);
    });
    // from the knee: a riser and a suck into the grip
    this.add(sec, kneel, (t, m) => {
      riserFx(this.c, S, m, t, Math.max(0.3, grip - kneel), 'dark', 1.2, lite);
      this.fx.suck(m, t + (grip - kneel), grip - kneel, 0.05, 0.9);
    });
    // THE GRIP: the cloth snatched — a stroke (tight: re-locked to the picture)
    this.add(sec, grip, (t, m, _h, fx) => {
      this.fx.grab(fx, t, 0.35);
      S.drum(m, t, 'boom', 0.3, 0, 0.75);
      S.drum(m, t + 0.006, 'taiko', 0.5, -0.2, 0.8); S.drum(m, t + 0.018, 'taiko', 0.42, 0.2, 0.8);
    }, 0, undefined, true);
    // ---- the insert: slow motion (the world muffled; the music is not)
    this.add(sec, ins, (t) => this.muffle(t, 700, 0.08, 0.45), 0, undefined, true);
    this.add(sec, pull, (t, m) => this.fx.rip(m, t, free - pull, 0.62), 0, undefined, true);
    // the height in slow time: from the grip Gm swelling (strings in octaves, the choir on 'ah'), the grief's A pressing
    // up to B♭ on top; ON THE RIP the tutti on E♭ with the theme's head (D A B♭); ON `free` the break onto A
    const sw = rip - grip;
    this.add(sec, grip + 0.05, (t, m, h) => {
      // a floor at once (no dip after the grip), and the swell over it
      S.pad(m, t, h, lite ? [50, 55, 58, 62] : [43, 50, 55, 58, 62], { level: 0.1, attack: 0.15, release: 0.08, cutoff: 1600, voices: lite ? 2 : 3, detune: 9 });
      S.choir(m, t, h, lite ? [55, 58, 62] : [50, 55, 58, 62], { level: 0.085, attack: 0.2, release: 0.08, vowel: 'oh', breath: 0.12 });
      this.horn(m, t, h, lite ? [43 + 12, 50] : [31, 43, 50], 0.05, 0.2, 0.08);
      S.pad(m, t, h, lite ? [50, 55, 58, 62] : [43, 50, 55, 58, 62, 67], { level: 0.07, attack: h * 0.8, release: 0.08, cutoff: 1100, cutoffEnd: 2800, voices: lite ? 2 : 3, detune: 11 });
      S.choir(m, t, h, lite ? [50, 55, 58] : [43, 50, 55, 58, 62], { level: 0.08, attack: h * 0.8, release: 0.08, vowel: 'oh', to: 'ah', morph: h, breath: 0.14 });
      S.pad(m, t, h, lite ? [43] : [31, 43], { level: 0.05, attack: h * 0.5, release: 0.1, cutoff: 500, voices: 2, detune: 6 });
      this.line(m, t, [[81, h * 0.55], [82, h * 0.45 + 0.05]], 1, 0.05, 'str');
      riserFx(this.c, S, m, t + h * 0.35, h * 0.65, 'dark', 1.4, lite);
    }, sw);
    // a low roll under the swell (the slow-motion breath before the height), growing into the rip
    for (let x = grip + 0.12, g = 0.11; x < rip - 0.06; x += g, g = Math.max(0.06, g * 0.97)) {
      const w = clamp((x - grip) / Math.max(0.3, rip - grip), 0, 1);
      this.add(sec, x, (t, m) => S.drum({ dry: m.dry, wet: m.wet }, t, 'dum', 0.1 + 0.32 * w * w, rand(-0.2, 0.2), 0.8));
    }
    const pk = free - rip;
    this.add(sec, rip, (t, m, h) => {
      this.hit(m, t, 1.15, true);
      S.pad(m, t, h, lite ? [51, 55, 58, 63, 70] : [39, 46, 51, 55, 58, 63, 70], { level: 0.15, attack: 0.04, release: 0.4, cutoff: 2600, cutoffEnd: 1700, voices: lite ? 2 : 3, detune: 12 });
      S.choir(m, t + 0.01, h, lite ? [51, 58, 63, 67] : [46, 51, 55, 58, 63, 67, 70], { level: 0.15, attack: 0.06, release: 0.4, vowel: 'ah', breath: 0.18 });
      S.pad(m, t, h, lite ? [39 + 12] : [27, 39], { level: 0.1, attack: 0.04, release: 0.4, cutoff: lite ? 600 : 300, voices: 2, detune: 6 });
      this.horn(m, t, h, lite ? [51, 58] : [39, 46, 51, 58], 0.09, 0.08, 0.4);
      // the theme's head on top, broad (D A B♭ — the B♭ held over the E♭)
      this.line(m, t, [[74, h * 0.22], [81, h * 0.22], [82, h * 0.56 + 0.1]], 1, 0.1, 'str');
      this.line(m, t + 0.01, [[62, h * 0.22], [69, h * 0.22], [70, h * 0.56 + 0.1]], 1, 0.08, 'horn');
    }, pk);
    // the great drums in slow time under the height (every second, deep)
    for (let x = grip + 0.55, k = 0; x < free - 0.25; x += 0.95, k++) {
      if (Math.abs(x - rip) < 0.35) continue;
      const kk = k, u = clamp((x - grip) / Math.max(0.5, free - grip), 0, 1);
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'taiko', 0.5 + 0.12 * u, kk % 2 ? 0.25 : -0.25, 0.72);
        S.drum(m, t + 0.006, 'boom', 0.14 + 0.08 * u, 0, 0.8);
      });
    }
    // the corner comes free: the break onto A (the B♭ sighing down to A), a deep stroke, the last thread
    this.add(sec, free, (t, m, h, fx) => {
      S.drum(m, t, 'boom', 0.4, 0, 0.75);
      S.drum(m, t + 0.006, 'taiko', 0.48, 0, 0.7);
      this.fx.impact(fx, t, 0.16, 2.2);
      this.fx.threadSnap(fx, t, 0.16, 0.1, 0.6);
      S.pad(m, t, h, lite ? [52, 57, 61, 64] : [33, 45, 52, 57, 61, 64], { level: 0.07, attack: 0.03, release: 1.0, cutoff: 1800, cutoffEnd: 900, voices: lite ? 2 : 3, detune: 10 });
      S.choir(m, t + 0.02, h, lite ? [57, 61, 64] : [45, 52, 57, 61], { level: 0.07, attack: 0.04, release: 1.0, vowel: 'ah', to: 'oo', morph: h + 0.6, breath: 0.16 });
      this.line(m, t, [[82, 0.18], [81, h + 0.3]], 1, 0.07, 'str');
      this.ground(m, t + 0.1, h, 0.04, 0.2, 0.8);
    }, end - free + 0.2);
    // Samuel walks on and STOPS (`stop`, CUT v6.1: G6 continues his turn back) — slowed, deep in the muffled world: a
    // last step planted, his mantle swinging as he begins to turn; Saul sinks back with the piece
    const stop = clamp(this.beat(sec, 'stop'), free + 0.2, end - 0.1);
    this.add(sec, Math.max(free + 0.15, stop - 0.35), (t, _m, _h, fx) => this.step(fx, t, 0.24, 0.45, 'stepWalk', 0.62));
    this.add(sec, stop, (t, _m, _h, fx) => { this.step(fx, t, 0.3, 0.4, 'stepWalk', 0.55); this.fabric(fx, t + 0.05, Math.min(0.9, end - stop + 0.4), 0.014, 0.3); });
    // out of slow motion into the verdict
    this.add(sec, end - 0.15, (t) => this.muffle(t, 18000, 0.06, 0));
  }

  // ================================================================================ 4 · THE VERDICT

  /**
   * G6 — the verdict (15:28a), close on Samuel: near-silence; a ground tone, a thread under the words, one deep stroke
   * on the last word ("today"), then the held silence (the thread lets go, the ground sinks).
   */
  private planVerdict(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const turn = this.beat(sec, 'turn');
    const words = clamp(this.text(sec, 0, this.beat(sec, 'words')), t0, end - 1);
    // the last word of 15:28a: on the sheet's word timing (else ≈0.45 s before the end of the speech)
    const last = Math.min(end - 0.3, sec.words.length ? sec.words[sec.words.length - 1] : this.beat(sec, 'wordsEnd') - 0.45);
    const done = clamp(this.beat(sec, 'wordsEnd'), last + 0.1, end - 0.2);
    this.add(sec, t0, (t, m, h) => this.ground(m, t, h, 0.048, 0.8, 0.5), done - t0 + 0.2);
    this.add(sec, done - 0.1, (t, m, h) => this.ground(m, t, h, 0.026, 0.3, 0.6), end - done + 0.1);
    this.add(sec, turn, (t, _m, _h, fx) => this.fabric(fx, t, 0.5, 0.012, -0.2));
    this.add(sec, words, (t, m, h) => {
      S.choir(m, t, h, [38], { level: 0.02, attack: 1.4, release: 0.6, vowel: 'oo', breath: 0.04 });
      S.pad(m, t + 0.6, h - 0.6, [81], { level: 0.006, attack: 1.4, release: 0.6, cutoff: 4000, voices: 1, type: 'sine', lfoCents: 20 });
    }, done - words + 0.3);
    // "today": one deep, soft stroke
    this.add(sec, last, (t, m) => { S.drum(m, t, 'boom', 0.2, 0, 0.8); S.drum(m, t + 0.005, 'taiko', 0.12, 0, 0.7); });
    // CUT v6.1: after the last word his eyes go down to Saul (`lookDown`) — the eyeline cut to G7 rides a low breath: the
    // low voices draw in under the look and carry across the cut (on G7's bus)
    const nx = this.secs[sec.i + 1];
    const lookDown = clamp(this.beat(sec, 'lookDown'), done, end - 0.1);
    this.add(sec, lookDown - 0.1, (t, m, h) => S.choir(m, t, h, lite ? [50, 57] : [38, 45, 50], {
      level: 0.026, attack: Math.max(0.2, (end - lookDown) * 0.9), release: 0.9, vowel: 'oo', to: 'oh', morph: h, breath: 0.14,
    }), end - lookDown + 0.8, nx);
  }

  /** G7 — Saul alone with the torn piece in his fist: his motif on a lone cello, falling below the tonic, into the light. */
  private planBroken(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1, d = end - t0;
    const look = this.beat(sec, 'look'), tighten = clamp(this.beat(sec, 'tighten'), look + 0.6, end - 0.6);
    // A as he looks down — B♭, the sigh — A; the fingers tighten: F, E, and below the tonic C♯, held into the flash
    const a0 = look - 0.1, gap = tighten - a0;
    const ns: ReadonlyArray<readonly [number, number]> = [[57, gap * 0.36], [58, gap * 0.34], [57, gap * 0.3], [53, 0.28], [52, 0.28], [49, Math.max(0.4, end - tighten - 0.46)]];
    this.add(sec, a0, (t, m) => this.line(m, t, ns, 1, 0.062, 'cello'));
    this.add(sec, t0, (t, m, h) => S.pad(m, t, h, lite ? [38, 45] : [26, 38, 45], { level: 0.032, attack: 0.4, release: 0.4, cutoff: 600, voices: 2, detune: 6 }), d);
    const sigh = a0 + gap * 0.36;
    this.add(sec, sigh, (t, m, h) => S.choir(m, t, h, [46, 50], { level: 0.016, attack: 0.6, release: 0.4, vowel: 'oo', breath: 0.08 }), end - sigh);
    // his breath; the fingers; the army behind him, out of focus
    this.add(sec, look + 0.05, (t, _m, _h, fx) => this.humanBreath(fx, t, 0.035));
    this.add(sec, tighten, (t, _m, _h, fx) => this.fabric(fx, t, 0.3, 0.012, 0.1));
    this.add(sec, t0, (t, _m, h, fx) => this.fx.murmur(this.far(fx, t, h + 1, 900, 0, 0.4), t, h, 0.16, 2), d);
    // the light-flash: a warm rising shimmer and a kinnor glissando into David's light; the whip on `flash`
    const next = this.secs[sec.i + 1];
    if (next && next.role === 'david') {
      const rl = Math.min(0.6, d * 0.3);
      const whip = clamp(this.beat(sec, 'flash'), end - rl, end - 0.1);
      this.add(sec, end - rl, (t, m) => {
        riserFx(this.c, S, m, t, rl, 'warm', 0.7, lite);
        [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => S.lyre(m, t + (i / 7) * rl * 0.95, n, 0.22 + i * 0.03, lyrePan(n)));
      });
      this.add(sec, whip, (t, _m, _h, fx) => this.whoosh(fx, t, end - whip + 0.12, 0.05, 700, 5000, 0.2));
    }
  }

  // ================================================================================ 5 · DAVID

  /**
   * D1 + D2 (10 s) — out of the light-flash: David on the rock against the low sun. A D-major bloom; the kinnor in 6/8
   * from the verse; David's motif on the shepherd's pipe under 15:28b; soft voices; he turns into the light: the
   * voices open, the kinnor and the pipe answer; the last bar on the dominant into the dissolve.
   */
  private planDavid(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const face = this.shotStart(sec, 1, (SPLIT.david ?? [6])[0]);
    const verse = clamp(this.text(sec, 0, this.beat(sec, 'verse')), t0 + 0.1, face - 2);
    const turn = clamp(this.beat(sec, 'turn'), face, end - 1);
    const dis = sec.exit === 'x' ? Math.min(0.8, sec.tau * 3) : 0.3; // the dissolve out (the light cools)
    // CUT v4: into the crane (D3) the theme rings on — the bed and the voices hold to the cut and let go under its Bm
    // (a sustained layer's release starts `rel` s before the end of its hold: the hold runs `rel` past the cut)
    const ring = sec.exit === 'ring', rel = ring ? 0.7 : 0;
    // the bloom of the light: a soft stroke, a kinnor strum, voices opening, a high shimmer; wind in his curls
    this.add(sec, t0, (t, m, _h, fx) => {
      S.drum(m, t, 'boom', 0.14, 0, 1);
      S.strum(m, t + 0.03, [50, 54, 57, 62, 66, 69], 0.36, 0.045);
      S.choir(m, t, 1.8, lite ? [57, 62, 66] : [57, 62, 66, 69], { level: 0.03, attack: 0.12, release: 1.1, vowel: 'ah', to: 'oo', morph: 1.4, breath: 0.07 });
      S.pad(m, t, 1.8, [86, 90], { level: 0.009, attack: 0.05, release: 1.4, cutoff: 7000, voices: 2, detune: 8, trem: 0.3, tremRate: 10 });
      this.fx.windSwell(fx, t + 0.3, face - t0, 0.026, 700, 2600, -0.3, 0.4);
    });
    this.add(sec, face, (t, _m, _h, fx) => this.fx.windSwell(fx, t, end - face + 0.3, 0.02, 650, 2200, 0.35, -0.2));
    // a warm bed of open fifths under both shots (no third against the pipe's Dorian F: the major third arrives with
    // the voices as he turns into the light)
    this.add(sec, t0 + 0.05, (t, m, h) => {
      S.pad(m, t, h, [38, 45, 50, 57], { level: 0.024, attack: 0.5, release: ring ? rel : dis + 0.3, cutoff: 1000, voices: lite ? 2 : 3, detune: 7 });
      S.choir(m, t, h, lite ? [50, 57] : [50, 57, 62], { level: 0.016, attack: 0.8, release: ring ? rel : dis + 0.3, vowel: 'oo', breath: 0.05 });
    }, end - t0 + (ring ? rel : 0.2));
    // the kinnor in 6/8 from the verse (a bar = 2 s): D – C – G | as he turns, D – A
    this.kinnor(sec, verse, end - dis * 0.6, ['D', 'C', 'G', 'D', 'A'], 0.45);
    // 15:28b over David: his motif on the shepherd's pipe (D A G F E F D, Dorian) — the bars of the kinnor
    const u = clamp((face + 0.3 - verse) / 11, 0.3, 0.5);
    this.add(sec, verse, (t, m) => { S.ney(m, t, motif(74, DAVID, u), 0.075); });
    // the flock below him, the birds of the golden hour (they fall silent at the thicket, in gameplay: the bear's hook)
    this.add(sec, t0 + 0.9, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.15, 0.45));
    this.add(sec, t0 + 2.4, (t, _m, _h, fx) => this.fx.chukar(this.far(fx, t, 4, 4500, 0.3, 0.5), t, 0.014, -0.6));
    // CUT v6.1 (a J-cut): a lamb bleats below him 0.3 s before he begins to turn his head (D1 `turn`) — the sound that
    // turns his head, and motivates the cut to D2, which continues the turn
    const d1turn = this.shotBeat(sec, 0, 'turn', face - 0.5);
    this.add(sec, Math.max(t0 + 0.5, d1turn - 0.3), (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.15, -0.35, 'lambBleat', 1.08));
    this.add(sec, face + 0.25, (t, _m, _h, fx) => this.fx.bulbul(fx, t, 0.009, 0.5));
    if (end - face > 2.6) this.add(sec, face + 2.2, (t, _m, _h, fx) => this.fx.chukar(this.far(fx, t, 4, 4000, 0.3, 0.5), t, 0.011, 0.55));
    // he turns into the light: warm voices open to "ah" across the turn; the kinnor strums and the pipe answers
    const sw = Math.max(face, turn - 0.3), bloom = Math.min(end - 0.8, turn + 1.0);
    this.add(sec, sw, (t, m, h) => {
      S.choir(m, t, h, lite ? [62, 66, 69] : [57, 62, 66, 69, 74], { level: 0.04, attack: bloom - sw, release: ring ? rel : dis + 0.2, vowel: 'oo', to: 'ah', morph: bloom - sw + 0.3, breath: 0.06 });
      S.pad(m, t, h, [50, 57, 62, 66], { level: 0.028, attack: bloom - sw, release: ring ? rel : dis + 0.2, cutoff: 1500, voices: lite ? 2 : 3, detune: 7 });
    }, end - sw + (ring ? rel : 0.2));
    const ans = turn + 0.5;
    // CUT v6.1: his eyes go down to the flock (D2 `lookDown`) — the eyeline cut to D3: the answer ends on the look and
    // the kinnor falls with his eyes (a falling arpeggio) into D3's first strum
    const lookDown = clamp(this.beat(sec, 'lookDown'), ans + 1.2, end - 0.1);
    this.add(sec, turn, (t, m) => S.strum(m, t, [62, 66, 69, 74, 78], 0.4, 0.05));
    this.add(sec, ans, (t, m) => S.ney(m, t, motif(74, ANSWER, clamp((lookDown - 0.1 - ans) / 11, 0.16, 0.26)), 0.07));
    this.add(sec, lookDown, (t, m) => [81, 78, 74, 69, 66].forEach((n, i) => S.lyre(m, t + i * 0.11, n, 0.26 - i * 0.02, lyrePan(n))));
  }

  // ================================================================================ 6 · THE FLOCK, THE LAMB AND THE LOGO

  /**
   * D3 — DAVID WATCHES HIS FLOCK (CUT v5): warm and intimate. Out of D2's dominant a soft D major (the kinnor's low strum,
   * a warm bed, the wind in his curls); the kinnor's 6/8 lilt (D | G | D | G); soft voices under Ps 78:70-71; the pipe's
   * tender line from the second bar; the flock close by — a few bells, a lamb nursing and its mother, a ram; on `rack`
   * (the focus back on him) the cellos sing the head of his motif (D–A) and the voices warm.
   */
  private planWatch(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const verse = clamp(this.text(sec, 0, this.beat(sec, 'verse')), t0 + 0.2, end - 3);
    const rack = clamp(this.beat(sec, 'rack'), verse + 1, end - 1);
    const P = STEP68;
    const rel = sec.exit === 'ring' ? 0.9 : 0.4;
    this.add(sec, t0, (t, m, h, fx) => {
      S.strum(m, t + 0.02, [50, 57, 62, 66], 0.28, 0.05);
      S.pad(m, t, h, lite ? [50, 57, 62, 66] : [38, 45, 50, 57, 62, 66], { level: 0.027, attack: 0.45, release: rel, cutoff: 1300, voices: lite ? 2 : 3, detune: 7 });
      this.fx.windSwell(fx, t + 0.2, 4.2, 0.018, 600, 2200, -0.3, 0.3);
      this.fx.windSwell(fx, t + 4.1, Math.max(1, end - t - 3.8), 0.015, 550, 2000, 0.3, -0.2);
    }, end - t0 + rel);
    const k0 = t0 + 0.35;
    // CUT v6.1: into D4 by a DISSOLVE (time passes) — the kinnor walks on across it (its bar on G meets D4's G) until
    // D4's own walk down begins
    const nxs = this.secs[sec.i + 1];
    const kTo = nxs && sec.exit === 'ring' ? Math.min(end + 1.2, this.beat(nxs, 'descend') - 0.05) : end - 0.1;
    this.kinnor(sec, k0, kTo, ['D', 'G', 'D', 'G'], 0.48);
    this.add(sec, verse, (t, m, h) => S.choir(m, t, h, lite ? [57, 62] : [57, 62, 66], { level: 0.016, attack: 1.5, release: 0.8, vowel: 'oo', breath: 0.04 }), rack - verse + 0.6);
    // the pipe's tender line (D major) under the psalm — CUT v6.1: it closes as he starts down (`walk`), and a short
    // walking phrase (A F♯ E — D) carries him down across the dissolve into D4 (on its bus: no jump at the dissolve)
    const walk = clamp(this.beat(sec, 'walk'), rack + 0.5, end - 0.2);
    const p0 = Math.max(k0 + 3 * P, verse + 0.2), pu = clamp((walk - 0.1 - p0) / 15, 0.22, 0.4);
    const line: Array<readonly [number, number]> = [[78, 2], [76, 1], [74, 2], [71, 1], [69, 3], [71, 1], [74, 2], [76, 3]];
    this.add(sec, p0, (t, m) => S.ney(m, t, line.map(([n, d]) => ({ midi: n, dur: d * pu })), 0.05));
    const nx = nxs;
    this.add(sec, walk, (t, m) => S.ney(m, t + 0.05, [{ midi: 69, dur: 0.42 }, { midi: 66, dur: 0.4 }, { midi: 64, dur: 0.44 }, { midi: 62, dur: 1.3 }], 0.05), 0, nx);
    // his steps start down the slope (they go on in D4)
    for (let x = walk + 0.1, k = 0; x < end + 0.9; x += rand(0.5, 0.6), k++) {
      const kk = k;
      this.add(sec, x, (t, _m, _h, fx) => this.step(fx, t, 0.12, 0.15 - 0.05 * kk, kk % 3 === 2 ? 'gravel' : 'stepWalk'), 0, x >= end ? nx : undefined);
    }
    // the focus comes back to him: the head of his motif in the cellos, the voices warming
    this.add(sec, rack, (t, m, h) => {
      this.line(m, t, [[50, 1], [57, 2]], Math.min(0.9, (end - rack) / 3), 0.034, 'cello');
      S.choir(m, t + 0.05, h, lite ? [62, 66, 69] : [57, 62, 66, 69], { level: 0.02, attack: 0.9, release: 0.7, vowel: 'oo', to: 'ah', morph: 1.6, breath: 0.05 });
    }, end - rack + 0.4);
    // the flock below him: bells close by, a lamb nursing and its mother, a goat, a ram
    this.add(sec, t0 + 0.3, (t, _m, h, fx) => this.fx.bells(fx, t, h, 0.03, 3, 0.1, 0.7, 0.6), end - t0 - 0.2);
    this.add(sec, t0 + 2.1, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.1, 0.25, 'lambBleat', 1.04));
    this.add(sec, t0 + 2.8, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.08, 0.35, 'sheepBleat', 0.86));
    this.add(sec, t0 + 5.6, (t, _m, _h, fx) => { const f = this.far(fx, t, 3, 2600, 0.25, 0.5); this.fx.bleat(f.dry, t, 0.08, -0.5, 'goatBleat'); });
    if (end - rack > 1.6) this.add(sec, rack + 1.3, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.07, -0.25, 'sheepBleat', 0.78));
  }

  /**
   * D4 — THE LAMB AND THE LOGO (CUT v5, one long take), then the game. On `lamb` the music thins to a held G(add9) for
   * the newborn lamb's bleat (again a breath later); from `descend` the kinnor walks on the logo's grid (Bm – G); at
   * `kneel` a hush (Em7, the kinnor rests); on `lift` the strings and the voices swell (G – A), David's motif rising on
   * the pipe so that its tonic falls ON the logo, a warm riser and a timpani roll — then the logo statement
   * (planStatement): the warm D-major arrival ON `logo`, the answer under the Hebrew name and the chapter line, a tender
   * cadence ON `setDown`, the afterglow after `logoOut`, the let-go into the game's 6/8 from `settle` and the hand-off at
   * the end of the shot. The lamb's and the ewe's voices are the score's (D4_BLEATS).
   */
  private planHorizon(sec: Sec): void {
    const S = this.s, lite = this.lite, t0 = sec.t0, end = sec.t1;
    const P = STEP68;
    const logo = clamp(this.beat(sec, 'logo'), t0 + 2.0, end - 4);
    const lamb = clamp(this.beat(sec, 'lamb'), t0, logo - 1.6);
    const descend = clamp(this.beat(sec, 'descend'), lamb + 0.3, logo - 1.2);
    const kneel = clamp(this.beat(sec, 'kneel'), descend + 0.3, logo - 0.8);
    const lift = clamp(this.beat(sec, 'lift'), kneel + 0.2, logo - 0.4);
    const heb = clamp(this.beat(sec, 'hebrew'), logo + 0.3, end - 3);
    const chap = clamp(this.beat(sec, 'chapter'), heb + 0.3, end - 2.6);
    const setDown = clamp(this.beat(sec, 'setDown'), chap + 0.6, end - 1.6);
    const logoOut = clamp(this.beat(sec, 'logoOut'), setDown, end - 1.2);
    const settle = clamp(this.beat(sec, 'settle'), logoOut, end - 0.8);
    // ---- the lamb: the world listens (a held G(add9), soft); its bleats are the cue
    this.add(sec, t0, (t, m, h) => {
      S.pad(m, t, h, lite ? [55, 59, 62, 69] : [43, 50, 55, 59, 62, 69], { level: 0.024, attack: 0.5, release: 0.6, cutoff: 1300, voices: lite ? 2 : 3, detune: 7 });
      S.choir(m, t + 0.1, h, [55, 62], { level: 0.015, attack: 0.8, release: 0.6, vowel: 'oo', breath: 0.04 });
    }, descend - t0 + 0.5);
    this.bleats(sec, 'lamb', lamb);
    this.bleats(sec, 'descend', descend);
    this.bleats(sec, 'kneel', kneel);
    // ---- the walk down (the kinnor on the logo's grid: Bm – G), the kneel (a hush: Em7), the lift (G – A, swelling)
    const gB = descend, gG = descend + Math.max(0.6, (kneel - descend) * 0.5), gA = Math.max(lift + 0.3, logo - 3 * P);
    const plan: ReadonlyArray<readonly [number, ChordName]> = [[gB, 'Bm'], [gG, 'G'], [kneel, 'Em'], [lift, 'G'], [gA, 'A'], [logo, 'D']];
    const chordAt = (x: number): ChordName => { let c: ChordName = 'Bm'; for (const [a, n] of plan) if (x >= a - 1e-6) c = n; return c; };
    const VOX: Partial<Record<ChordName, readonly [readonly number[], readonly number[], number, number]>> = {
      // [desktop voicing, phone voicing, bass (desktop; phones an octave up), level]
      Bm: [[47, 54, 59, 62, 66], [54, 59, 62, 66], 35, 0.026],
      G: [[43, 50, 55, 59, 62, 67], [50, 55, 59, 67], 31, 0.03],
      Em: [[40, 47, 55, 59, 62, 64], [52, 55, 59, 62], 28, 0.024],
      A: [[45, 52, 57, 61, 64, 69], [52, 57, 61, 69], 33, 0.06],
    };
    plan.forEach(([a, n], i) => {
      if (n === 'D') return;
      const b = plan[i + 1][0], v = VOX[n];
      if (!v) return;
      const [hi, ph, bass, level] = v;
      const swell = a >= lift - 1e-6;
      const lv = swell && n === 'G' ? 0.045 : level;
      this.add(sec, a, (t, m, h) => {
        S.pad(m, t, h, lite ? ph : hi, { level: lv, attack: swell ? Math.min(0.6, h * 0.8) : 0.35, release: 0.3, cutoff: swell ? 1400 : 1000, cutoffEnd: swell ? 3200 : 1300, voices: lite ? 2 : 3, detune: 9 });
        S.pad(m, t, h, lite ? [bass + 12] : [bass, bass + 12], { level: 0.022 + (swell ? 0.016 : 0), attack: 0.3, release: 0.25, cutoff: lite ? 900 : 420, voices: 2, detune: 6 });
        if (swell) S.choir(m, t, h, lite ? ph.slice(1, 4) : hi.slice(2, 6), { level: n === 'A' ? 0.05 : 0.036, attack: Math.min(0.5, h * 0.6), release: 0.12, vowel: 'oo', to: 'ah', morph: h, breath: 0.08 });
      }, b - a + 0.12);
    });
    // the kinnor walks (running eighths on the logo's grid, the chord of the moment) — it rests at the kneel
    for (let k = Math.ceil((descend + 0.1 - logo) / P - 1e-6); logo + k * P < logo - 0.05; k++) {
      const x = logo + k * P, s6 = ((k % 6) + 6) % 6;
      if (x > kneel - 0.12 && x < lift - 0.05) continue;
      const ch = CHORDS[chordAt(x + 0.01)];
      const w = clamp((x - descend) / Math.max(0.5, logo - descend), 0, 1);
      const vel = 0.3 + 0.24 * w;
      const idx = [0, 2, 4, 5, 4, 2][s6];
      this.add(sec, x, (t, m) => {
        const ns = voicing(ch, 57, 81);
        const n = ns[Math.min(ns.length - 1, idx)];
        if (s6 === 0 || s6 === 3) S.lyre(m, t, rootIn(ch, 43), vel * (s6 === 0 ? 0.75 : 0.55), -0.3);
        S.lyre(m, t + rand(-0.005, 0.005), n, vel * (s6 === 0 ? 1.1 : s6 === 3 ? 0.95 : 0.8) * rand(0.92, 1.06), lyrePan(n));
      });
    }
    // the low strings' pulse from the lift, growing into the logo
    for (let k = Math.ceil((lift - logo) / P - 1e-6); logo + k * P < logo - 0.05; k++) {
      const x = logo + k * P, s6 = ((k % 6) + 6) % 6, w = clamp((x - lift) / Math.max(0.3, logo - lift), 0, 1);
      const root = rootIn(CHORDS[chordAt(x + 0.01)], 43);
      this.add(sec, x, (t, m) => S.strStac({ dry: m.dry, wet: null }, t, root, (0.24 + 0.32 * w) * (s6 === 0 || s6 === 3 ? 1.15 : 0.85), 0.2, 0.7));
    }
    // David's motif rising on the pipe (D A G F♯ E F♯ — D): from the kneel, its tonic ON the logo, held to the Hebrew name
    const um = Math.min(P, (logo - kneel + 0.3) / 8);
    const mStart = logo - 8 * um;
    const motifNs = DAVID_MAJOR.map(([o, n], i) => [74 + o, i === DAVID_MAJOR.length - 1 ? (heb - logo) / um : n] as const);
    this.add(sec, mStart, (t, m) => {
      S.ney(m, t, motifNs.map(([n, d]) => ({ midi: n, dur: d * um })), 0.08);
      this.line(m, t + 0.01, motifNs.map(([n, d], i) => [n - 12, i === motifNs.length - 1 ? 3 : d] as const), um, 0.02, 'str');
    });
    // a warm riser and a timpani roll into the arrival
    const rl = clamp(logo - gA + 0.4, 0.6, 1.6);
    this.add(sec, logo - rl, (t, m) => riserFx(this.c, S, m, t, rl, 'warm', 0.8, lite));
    const roll = Math.min(1.2, logo - lift);
    for (let x = logo - roll, g = 0.2; x < logo - 0.05; x += g, g = Math.max(0.055, g * 0.85)) {
      const w = 1 - (logo - x) / roll;
      this.add(sec, x, (t, m) => {
        S.drum(m, t, 'dum', 0.08 + 0.3 * w * w, rand(-0.2, 0.2), 0.9);
        if (!lite && w > 0.45) S.drum(m, t, 'boom', 0.03 + 0.1 * w, 0, 1.1);
      });
    }
    // ---- his steps down the rocks to the lamb, the kneel (gravel under the knee, wool), the lift (wool, the lamb)
    for (let x = descend + 0.15, k = 0; x < kneel - 0.25; x += rand(0.48, 0.6), k++) {
      const kk = k;
      this.add(sec, x, (t, _m, _h, fx) => this.step(fx, t, 0.16 - 0.01 * kk, clamp(-0.15 + 0.06 * kk, -0.4, 0.4), kk % 3 === 2 ? 'gravel' : 'stepWalk'));
    }
    this.add(sec, kneel, (t, _m, _h, fx) => { this.step(fx, t, 0.14, 0, 'gravel', 0.8); this.fabric(fx, t + 0.05, 0.5, 0.014, 0.1); });
    this.add(sec, lift, (t, _m, _h, fx) => this.fabric(fx, t, 0.7, 0.016, -0.1));
    // he carries it down to the ewe: soft steps
    for (let x = lift + 0.7, k = 0; x < setDown - 0.45; x += rand(0.55, 0.68), k++) {
      const kk = k;
      this.add(sec, x, (t, _m, _h, fx) => this.step(fx, t, 0.11, kk % 2 ? 0.15 : -0.1, kk % 4 === 3 ? 'gravel' : 'stepWalk'));
    }
    // ---- the logo statement: the arrival, the answer, the set-down, the afterglow, the let-go and the hand-off
    this.planStatement(sec, logo, heb, chap, setDown, logoOut, settle, end);
  }

  /**
   * The bleats of D4's cue that fall on the beat `beat` (film time `at`): the lamb on `lamb`, again a breath later
   * (keyed to `descend`'s side of it), softly at the lift, while it is carried (`chapter`), and at the set-down the ewe's
   * call, the lamb's answer and the ewe's low murmur — D4_BLEATS (cut8 animates the mouths on the same times).
   */
  private bleats(sec: Sec, beat: string, at: number): void {
    for (const b of D4_BLEATS) {
      if (b.beat !== beat) continue;
      const lamb = b.who === 'lamb';
      const vol = (lamb ? 0.34 : 0.28) * b.v, pitch = lamb ? 1.16 : b.murmur ? 0.8 : 0.92, pan = lamb ? 0.12 : 0.3;
      this.add(sec, at + b.offset, (t, _m, _h, fx) => {
        const o = b.far ? this.far(fx, t, 3, 2200, 0.3, 0.5).dry : fx.dry;
        this.fx.bleat(o, t, b.far ? vol * 1.3 : vol, pan, lamb ? 'lambBleat' : 'sheepBleat', pitch);
      });
    }
  }


  /**
   * THE LOGO STATEMENT (the film's D4 from `logo` on, and a skip's compact version): ON `logo` the warm D-major arrival
   * (tight: built just before it is due, re-locked to the picture) — a deep drum and a taiko pair, a low tof, a soft
   * cymbal bloom, the tutti, the choir on 'ah', a full strum, a high shimmer: an arrival, not a smash; the theme's answer
   * (A B C♯ D C♯ A G A) on the pipe under the Hebrew name, its D on the chapter line (IV). With a `setDown` (the film):
   * IV – ii – V7 into a tender cadence ON `setDown` (the kinnor's falling arpeggio, the ewe and the lamb), the lockup's
   * fade into an afterglow (D – G/D – D, bells, wind); without (a skip): IV – V into the settle. From `settle` the
   * orchestra lets go into the game's 6/8 ON the game's own grid (the drone, the kinnor's lilt, the pipe's last cadence
   * F♯ E F♯ — D, its D on the hand-off), and ON `end` the score hands over to the game's pastoral music (onHandoff).
   */
  private planStatement(sec: Sec, logo: number, heb: number, chap: number, setDown: number, logoOut: number, settle: number, end: number): void {
    const S = this.s, lite = this.lite;
    const film = Number.isFinite(setDown);
    const u = clamp((chap - heb) / 3, 0.2, 0.5); // the answer's eighth: its D falls on the chapter line
    this.add(sec, logo, (t, m, h) => {
      this.titleAt = t;
      S.drum(m, t, 'boom', 0.42, 0, 0.9);
      S.drum(m, t + 0.004, 'taiko', 0.56, -0.25);
      S.drum(m, t + 0.016, 'taiko', 0.47, 0.25);
      S.drum({ dry: m.dry, wet: null }, t, 'dum', 0.36, 0);
      this.bloom(m, t, lite ? 0.02 : 0.029);
      S.pad(m, t, h, lite ? [38, 50] : [38, 45], { level: 0.085, attack: 0.04, release: 0.5, cutoff: lite ? 900 : 560, voices: lite ? 2 : 3, detune: 6 });
      S.pad(m, t, h, lite ? [45, 54, 57] : [45, 50, 54, 57], { level: 0.098, attack: 0.05, release: 0.45, cutoff: 2100, cutoffEnd: 1400, voices: lite ? 2 : 3, detune: 9 });
      S.pad(m, t + 0.02, h, lite ? [62, 66, 74] : [62, 66, 69, 74], { level: 0.058, attack: 0.12, release: 0.5, cutoff: 4000, cutoffEnd: 2800, voices: lite ? 2 : 3, detune: 8, vib: 9, vibRate: 5.4, vibDelay: 0.3 });
      S.choir(m, t + 0.01, h, lite ? [50, 57, 62, 66] : [50, 54, 57, 62, 66, 69], { level: 0.115, attack: 0.07, release: 0.6, vowel: 'ah', breath: 0.12 });
      S.strum(m, t + 0.01, [50, 57, 62, 66, 69, 74, 78], 0.7, 0.028);
      // the light of the lockup: the high strings open above the choir (presence, not weight)
      S.pad(m, t + 0.03, h, lite ? [74, 78, 81] : [74, 78, 81, 86], { level: 0.034, attack: 0.18, release: 0.6, cutoff: 6000, cutoffEnd: 4200, voices: lite ? 2 : 3, detune: 7, vib: 8, vibRate: 5.5, vibDelay: 0.25 });
      S.choir(m, t + 0.02, h, [74, 78], { level: 0.05, attack: 0.1, release: 0.6, vowel: 'ah', breath: 0.1 });
      S.pad(m, t + 0.05, 2.6, [86, 90, 93], { level: 0.007, attack: 0.5, release: 1.4, cutoff: 9000, voices: 2, detune: 8, trem: 0.25, tremRate: 11 });
    }, chap - logo + 0.15, undefined, true);
    // the theme's answer under the Hebrew name (the pipe, strings doubling; דָּוִד: the kinnor's rising fifth D–A)
    this.add(sec, heb, (t, m) => {
      S.ney(m, t, motif(74, ANSWER, u), 0.08);
      this.line(m, t + 0.01, ANSWER.map(([o, n]) => [74 + o, n] as const), u, 0.026, 'str');
      S.lyre(m, t, 74, 0.42, 0.15); S.lyre(m, t + 0.03, 81, 0.38, 0.3);
    });
    this.add(sec, chap, (t, m) => S.lyre(m, t + 0.02, 86, 0.3, 0.25));
    // the harmony after the chapter line
    const ANS: Partial<Record<ChordName, readonly [readonly number[], readonly number[], readonly number[], number]>> = {
      // [strings, phone strings, choir, bass]
      G: [[43, 50, 55, 59, 62, 67], [50, 55, 59, 67], [55, 59, 62, 67], 31],
      Em: [[40, 47, 52, 55, 59, 64], [52, 55, 59, 64], [55, 59, 64], 28],
      A: [[45, 52, 57, 61, 64, 69], [52, 57, 61, 69], [57, 61, 64], 33],
    };
    const segs: Array<readonly [number, number, ChordName, number]> = [];
    if (film) {
      const e1 = clamp(chap + (setDown - chap) * 0.38, chap + 0.3, setDown - 0.6), a1 = clamp(setDown - Math.min(0.9, (setDown - chap) * 0.3), e1 + 0.2, setDown - 0.2);
      segs.push([chap, e1, 'G', 1], [e1, a1, 'Em', 0.85], [a1, setDown, 'A', 0.9]);
    } else {
      const a1 = clamp(chap + 3 * u, chap + 0.3, settle - 0.3);
      segs.push([chap, a1, 'G', 1], [a1, settle, 'A', 0.9]);
    }
    for (const [a, b, n, k] of segs) {
      const v = ANS[n];
      if (!v) continue;
      const [hi, ph, ch, bass] = v;
      this.add(sec, a, (t, m, h) => {
        S.pad(m, t, h, lite ? ph : hi, { level: 0.058 * k, attack: 0.18, release: 0.45, cutoff: 2000, cutoffEnd: 1600, voices: lite ? 2 : 3, detune: 9 });
        S.pad(m, t, h, lite ? [bass + 12] : [bass, bass + 12], { level: 0.038 * k, attack: 0.15, release: 0.4, cutoff: lite ? 900 : 420, voices: 2, detune: 6 });
        S.choir(m, t + 0.02, h, lite ? ch.slice(0, 3) : ch, { level: 0.064 * k, attack: 0.2, release: 0.5, vowel: 'ah', breath: 0.1 });
        if (n === 'G') S.drum(m, t, 'taiko', 0.22, 0, 0.85);
      }, b - a + 0.15);
    }
    // the kinnor keeps the 6/8 under the answer and the carrying (eighths on the logo's grid, the chord of the moment)
    const P = STEP68;
    const kEnd = film ? setDown - 0.12 : settle - P * 0.6;
    const chordAt = (x: number): ChordName => { let c: ChordName = 'D'; for (const [a, , n] of segs) if (x >= a - 1e-6) c = n; return c; };
    for (let k = 1; logo + k * P < kEnd; k++) {
      const x = logo + k * P, s6 = k % 6;
      const ch = CHORDS[chordAt(x + 0.01)];
      const w = clamp((x - logo) / Math.max(0.5, kEnd - logo), 0, 1);
      const vel = 0.5 - 0.16 * w;
      const idx = [0, 2, 4, 5, 4, 2][s6];
      this.add(sec, x, (t, m) => {
        const ns = voicing(ch, 57, 81);
        const n = ns[Math.min(ns.length - 1, idx)];
        if (s6 === 0 || s6 === 3) S.lyre(m, t, rootIn(ch, 43), vel * (s6 === 0 ? 0.75 : 0.55), -0.3);
        S.lyre(m, t + rand(-0.005, 0.005), n, vel * (s6 === 0 ? 1.1 : s6 === 3 ? 0.95 : 0.8) * rand(0.92, 1.06), lyrePan(n));
      });
    }
    if (film) {
      // the set-down: a tender cadence — D (the strings soft, the choir 'oo'), the kinnor's falling arpeggio, a soft stroke
      this.add(sec, setDown, (t, m, h) => {
        S.drum(m, t, 'boom', 0.12, 0, 0.95);
        [81, 78, 74, 69, 66, 62].forEach((n, i) => S.lyre(m, t + 0.02 + i * 0.11, n, 0.42 - i * 0.03, lyrePan(n)));
        S.pad(m, t, h, lite ? [50, 57, 62, 66] : [38, 45, 50, 57, 62, 66], { level: 0.04, attack: 0.3, release: 0.8, cutoff: 1500, cutoffEnd: 1100, voices: lite ? 2 : 3, detune: 8 });
        S.choir(m, t + 0.05, h, lite ? [57, 62, 66] : [50, 57, 62, 66], { level: 0.04, attack: 0.4, release: 0.8, vowel: 'ah', to: 'oo', morph: h * 0.6, breath: 0.06 });
      }, logoOut - setDown + 0.8);
      this.bleats(sec, 'chapter', chap);
      this.bleats(sec, 'setDown', setDown);
      this.add(sec, setDown - 1.0, (t, _m, h, fx) => this.fx.bells(fx, t, h, 0.03, 3, 0, 0.8, 0.5), end - setDown + 1.6);
      // the lockup fades: the afterglow — D, G/D, D, the strings thinning; the wind
      const g1 = logoOut + (settle - logoOut) * 0.35, d1 = logoOut + (settle - logoOut) * 0.7;
      this.add(sec, logoOut, (t, m, h) => {
        S.pad(m, t, h, lite ? [50, 57, 62, 66] : [38, 45, 50, 57, 62, 66], { level: 0.034, attack: 0.4, release: 0.6, cutoff: 1400, voices: lite ? 2 : 3, detune: 7 });
        S.choir(m, t, h, lite ? [57, 62] : [50, 57, 62], { level: 0.02, attack: 0.5, release: 0.6, vowel: 'oo', breath: 0.04 });
      }, g1 - logoOut + 0.3);
      this.add(sec, g1, (t, m, h) => {
        S.pad(m, t, h, lite ? [55, 59, 62, 67] : [38, 50, 55, 59, 62, 67], { level: 0.032, attack: 0.4, release: 0.5, cutoff: 1400, voices: lite ? 2 : 3, detune: 7 });
        S.ney(m, t + 0.1, [{ midi: 79, dur: 0.45 }, { midi: 78, dur: 0.3 }, { midi: 76, dur: 0.6 }], 0.05);
      }, d1 - g1 + 0.3);
      this.add(sec, d1, (t, m, h) => S.pad(m, t, h, lite ? [50, 57, 62, 66] : [38, 45, 50, 57, 62, 66], { level: 0.03, attack: 0.4, release: 0.4, cutoff: 1300, voices: lite ? 2 : 3, detune: 7 }), settle - d1 + 0.3);
      // the kinnor keeps a soft lilt through the afterglow (dotted quarters on the logo's grid): no thinning before the
      // settle takes over on the game's grid
      for (let k = Math.ceil((setDown + 1.0 - logo) / (3 * P)); logo + k * 3 * P < settle - 0.4; k++) {
        const x = logo + k * 3 * P, ch = CHORDS[x >= g1 && x < d1 ? 'G' : 'D'], first = k % 2 === 0;
        this.add(sec, x, (t, m) => {
          const ns = voicing(ch, 57, 81);
          if (first) S.lyre(m, t, rootIn(ch, 43), 0.24, -0.3);
          const n = ns[first ? 2 : 4] ?? ns[0];
          S.lyre(m, t + 0.004, n, first ? 0.34 : 0.28, lyrePan(n));
        });
      }
      this.add(sec, logoOut, (t, _m, h, fx) => this.fx.windSwell(fx, t, h, 0.016, 500, 1800, 0.3, -0.3), end - logoOut + 1.2);
    }
    // ---- the settle: the cadence on D lets go into the game's 6/8 — ON THE GAME'S GRID (its eighth, so the last bar
    // ends exactly on the hand-off): the drone, the kinnor's pastoral lilt (a pickup, then a full bar), the pipe's last
    // cadence (F♯ E F♯ — D: its D sounds as the player takes over)
    const letGo = 3;
    this.add(sec, settle, (t, m, h) => {
      S.drum(m, t, 'boom', 0.1, 0, 0.9);
      S.pad(m, t, h, lite ? [50, 54, 57, 62, 66] : [38, 45, 50, 54, 57, 62, 66], { level: 0.034, attack: 0.3, release: letGo, cutoff: 1700, cutoffEnd: 800, voices: lite ? 2 : 3, detune: 8 });
      S.choir(m, t + 0.02, h, lite ? [57, 62, 66] : [50, 57, 62, 66], { level: 0.032, attack: 0.35, release: letGo, vowel: 'ah', to: 'oo', morph: 1.6, breath: 0.06 });
      S.pad(m, t, h + 0.5 + 2, [38, 45, 50], { level: 0.066, attack: 0.9, release: letGo + 2, cutoff: 480, voices: lite ? 2 : 3, detune: 6, lfoCents: 300 });
    }, end - settle + letGo);
    const n8 = Math.max(3, Math.round((end - settle) / GAME_EIGHTH));
    const q = (end - settle) / n8;
    const lilt = [0.72, 0.46, 0.46, 0.6, 0.46, 0.46], pat = [0, 2, 4, 5, 4, 2];
    for (let j = 0; j < n8; j++) {
      const s6 = (((j - n8) % 6) + 6) % 6, jj = j;
      this.add(sec, settle + j * q, (t, m) => {
        const ns = voicing(CHORDS.D, 57, 81);
        if (s6 === 0 || jj === 0) S.lyre(m, t, 50, 0.36, -0.3);
        const n = ns[Math.min(ns.length - 1, pat[s6])];
        S.lyre(m, t + rand(-0.006, 0.006), n, lilt[s6] * 0.85 * rand(0.88, 1.08), lyrePan(n));
      });
    }
    this.add(sec, end - 3 * q, (t, m) => S.ney(m, t, [{ midi: 78, dur: q }, { midi: 76, dur: q }, { midi: 78, dur: q }, { midi: 74, dur: 1.6 }], 0.055));
    this.add(sec, settle - 0.2, (t, _m, _h, fx) => this.fx.windSwell(fx, t, end - settle + 1.6, 0.016, 450, 1600, 0.3, -0.2));
    if (!film) this.add(sec, settle + 0.6, (t, _m, _h, fx) => this.fx.bleat(fx.dry, t, 0.1, 0.4));
    // ---- the hand-off: ON the end of the shot the game's pastoral music starts on this bar line (tight)
    this.add(sec, end, (t) => this.fireHandoff(t), 0, undefined, true);
  }

  // ================================================================================ instruments

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
  private line(o: Out, t: number, ns: ReadonlyArray<readonly [number, number]>, beat: number, level: number, inst: 'str' | 'men' | 'cello' | 'hum' | 'horn'): void {
    let x = 0;
    for (const [m, b] of ns) {
      const d = b * beat;
      const tt = t + x;
      x += d;
      if (m < 0) continue;
      if (inst === 'horn') {
        // a brass-like horn section: each note opens with a brassy swell (the lowpass sweeping up), slightly detached
        this.s.pad(o, tt, d + 0.22, [m], {
          level, attack: Math.min(0.2, d * 0.3), release: 0.35, cutoff: 1500, cutoffEnd: 1000, q: 1.3,
          voices: this.lite ? 2 : 3, detune: 5, lfoCents: 60, vib: d > 0.6 ? 6 : 0, vibRate: 5, vibDelay: 0.45,
        });
      } else if (inst === 'str' || inst === 'cello') {
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

  /** A soft cymbal bloom (the logo's arrival): bright noise that swells in 15 ms and rings down over ~2.5 s. */
  private bloom(o: Out, t: number, level: number): void {
    const v = new Voice(this.c);
    const n = v.noise('white', t), hp = v.filter('highpass', 4200, 0.6), pk = v.filter('peaking', 7000, 0.8, 4), g = v.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.015); g.gain.setTargetAtTime(0, t + 0.02, 0.75);
    n.connect(hp); hp.connect(pk); pk.connect(g); g.connect(o.dry);
    if (o.wet) { const w = v.gain(0.6); g.connect(w); w.connect(o.wet); }
    v.play(t, t + 3.2);
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

  /**
   * A man passing close across the lens (CUT v6.1, G1's wipe): a rush of wool and air sweeping from one side to the
   * other, loudest at `peak` s (the cut), a footfall and a touch of bronze as he passes.
   */
  private passBy(o: Out, t: number, d: number, peak: number, lvl: number): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 600, 0.9), g = v.gain(0), p = v.pan(-0.8);
    const pk = clamp(peak, 0.1, d - 0.1);
    bp.frequency.setValueAtTime(this.c.hz(500), t); bp.frequency.exponentialRampToValueAtTime(this.c.hz(1900), t + pk);
    bp.frequency.exponentialRampToValueAtTime(this.c.hz(700), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + pk); g.gain.setTargetAtTime(0, t + pk, (d - pk) / 3);
    if ('pan' in p) {
      const P = (p as StereoPannerNode).pan;
      P.setValueAtTime(-0.8, t); P.linearRampToValueAtTime(0.85, t + d);
    }
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.25); p.connect(w); w.connect(o.wet); }
    v.play(t, t + d + 0.1);
    this.fabric(o, t + pk * 0.5, Math.min(0.6, d * 0.7), lvl * 0.35, -0.2);
    this.step(o, t + pk - 0.06, lvl * 2.6, 0.1, 'gravel');
    this.fx.clinks(o, t + pk + 0.04, lvl * 0.2, 2);
  }

  /** A fast air movement (the spear going up, the lunge, the whip into the light): a band of noise sweeping f0 → f1. */
  private whoosh(o: Out, t: number, d: number, lvl: number, f0: number, f1: number, pan = 0): void {
    const v = new Voice(this.c);
    const n = v.noise('pink', t), bp = v.filter('bandpass', f0, 1.1), g = v.gain(0), p = v.pan(pan);
    bp.frequency.setValueAtTime(this.c.hz(f0), t); bp.frequency.exponentialRampToValueAtTime(this.c.hz(f1), t + d * 0.7);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.4); p.connect(w); w.connect(o.wet); }
    v.play(t, t + d + 0.05);
  }

  /**
   * Air in the dark before the first picture: a low wind (a brown rumble and a breathy band) that slowly rises and
   * opens; phones get more of the band (the rumble is below their speaker).
   */
  private air(o: Out, t: number, dur: number, level: number): void {
    const v = new Voice(this.c);
    const b = v.noise('brown', t), lp = v.filter('lowpass', 150, 0.7), bg = v.gain(0);
    const n = v.noise('pink', t), bp = v.filter('bandpass', 280, 0.9), ng = v.gain(0), p = v.pan(-0.2);
    lp.frequency.setValueAtTime(140, t); lp.frequency.linearRampToValueAtTime(260, t + dur);
    bp.frequency.setValueAtTime(this.c.hz(260), t); bp.frequency.exponentialRampToValueAtTime(this.c.hz(950), t + dur);
    const band = this.lite ? 0.9 : 0.45;
    const B = bg.gain, N = ng.gain;
    B.setValueAtTime(0, t); B.linearRampToValueAtTime(level * 0.7, t + Math.min(0.45, dur * 0.35));
    B.linearRampToValueAtTime(level * 2, t + dur * 0.92); B.linearRampToValueAtTime(0, t + dur);
    N.setValueAtTime(0, t); N.linearRampToValueAtTime(level * band * 0.4, t + dur * 0.5);
    N.linearRampToValueAtTime(level * band, t + dur * 0.92); N.linearRampToValueAtTime(0, t + dur);
    if ('pan' in p) {
      const P = (p as StereoPannerNode).pan;
      P.setValueAtTime(-0.25, t); P.linearRampToValueAtTime(0.25, t + dur);
    }
    b.connect(lp); lp.connect(bg); bg.connect(p);
    n.connect(bp); bp.connect(ng); ng.connect(p);
    p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.3); p.connect(w); w.connect(o.wet); }
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

  /** A footstep from the engine's baked banks (a sandal on dry earth / gravel, or a skid); `rate` < 1 slows it. */
  private step(o: Out, t: number, lvl: number, pan = 0, kind: 'stepWalk' | 'gravel' | 'skid' = 'stepWalk', rate = 1): void {
    const b = pick(this.c.bank(kind));
    const v = new Voice(this.c);
    const r = rand(0.9, 1.05) * rate;
    const s = v.buffer(b, r, t), g = v.gain(lvl), p = v.pan(pan);
    s.connect(g); g.connect(p); p.connect(o.dry);
    if (o.wet) { const w = v.gain(0.3); p.connect(w); w.connect(o.wet); }
    v.play(t, t + b.duration / r + 0.05);
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
  if (OVERLAY_CUES.has(cue)) return null;
  return ROLE_OF_CUE[cue] ?? ROLE_OF_SET[String(c.set ?? '')] ?? null;
}

/** The overlay shots of a sheet (CUT v6's flashes): film time and length; the section they fall in plays on under them. */
function overlaysOf(cues: readonly IntroCue[]): Array<{ t: number; dur: number; cue: string }> {
  return [...(cues ?? [])]
    .filter((c) => c && c.shot && Number.isFinite(c.t) && typeof c.cue === 'string' && OVERLAY_CUES.has(c.cue))
    .map((c) => ({ t: c.t, dur: Number.isFinite(c.dur) && (c.dur as number) > 0 ? (c.dur as number) : 0.8, cue: String(c.cue) }))
    .sort((a, b) => a.t - b.t);
}

function newSec(i: number, role: ScoreRole, t0: number, sh: Shot, slowmo: number): Sec {
  return { slowmo, i, role, t0, t1: Infinity, shots: [sh], cut: sh.cut, fade: sh.fade, exit: 'ring', tau: 0.5, gap: 0, fallTo: 1, next: null, texts: [], words: [] };
}

/**
 * Sections from a cue sheet: consecutive SHOT cues of the same role merge (text cues carry no `shot`); a first shot
 * that comes out of black with a beat its picture comes in on gets an 'open' section for its black; the exit of each
 * section comes from the transition of the next one's first shot.
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
    out.push(newSec(out.length, role, c.t, sh, slow));
  }
  if (!out.length) return out;
  out[0].t0 = Math.min(out[0].t0, 0);
  const last = out[out.length - 1];
  const lsh = last.shots[last.shots.length - 1];
  last.t1 = lsh.t + (lsh.dur > 0 ? lsh.dur : 8);
  // the film opens out of black ON A HIT (CUT v3/v4: G1 holds 1.5 s of black, the picture comes in ON the blast): that
  // black is a section of its own, cut a breath before the picture. A picture that RISES out of black (CUT v5's P1:
  // `fade` 1.6) keeps its black inside its own section (the land theme rises with it).
  const first = out[0], s0 = first.shots[0];
  const pin = s0.beats ? PICTURE_IN.map((k) => s0.beats?.[k]).find((v) => v !== undefined) : undefined;
  if (first.cut === 'black' && pin !== undefined && !(s0.fade >= 0.3)) {
    const at = s0.t + clamp(pin, 0, Math.max(0, s0.dur - 0.5));
    if (at - first.t0 > 0.4 && first.t1 - at > 0.5) {
      const open = newSec(0, 'open', first.t0, s0, 1);
      open.t1 = at;
      first.t0 = at; first.cut = 'hard';
      out.unshift(open);
      out.forEach((x, i) => { x.i = i; });
    }
  }
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
    // CUT v6/v6.1 (the user: Saul's music goes ON through the meeting with Samuel): into G4 the roar itself BREAKS OFF on
    // the cut (FilmSound.roar's `thin`: it thins from G3's `notice`, the men turning their heads) while the chord and
    // the theme flow on into G4's music (their tails fall away under it) — darker, heavier, never a hush
    else if (nx.role === 'silence') { sec.exit = 'fall'; sec.tau = 0.45; sec.gap = 0; sec.fallTo = 0.85; }
    // the peak of the tear (G5b) into the verdict: the break rings on and falls (≈1.5 s) to the lowest of the film
    else if (sec.role === 'tear' && nx.role === 'verdict') { sec.exit = 'fall'; sec.tau = 0.55; sec.gap = 0; sec.fallTo = 0.7; }
    // the prologue's joins and David's theme ring on across their cuts (D2 -> D3 -> D4: one arc into the logo)
    else if (RING.has(`${sec.role}>${nx.role}`)) { sec.exit = 'ring'; sec.tau = 0.5; }
    // CUT v6.1 (the sound carries the cut): P6's phrase closes on a drum hit exactly on the cut to Ramah (the hit is
    // Ramah's — on its bus); the host's march and murmur leave with the picture (a short fall)
    else if (sec.role === 'threat' && nx.cut === 'cut') { sec.exit = 'fall'; sec.tau = 0.2; sec.fallTo = 0.5; }
    else if (nx.cut === 'dissolve' || nx.cut === 'light' || nx.cut === 'match' || nx.cut === 'black') { sec.exit = 'x'; sec.tau = Math.max(0.12, (nx.fade || 1.2) / 3); }
    else { sec.exit = 'x'; sec.tau = 0.22; }
  }
  return out;
}
