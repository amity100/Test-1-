// Cue sheet of the chapter-1 cinematic intro: the king at Gibeah and the shepherd at Bethlehem, INTERCUT
// (1 Samuel 15:34 - 16:1, before David's anointing). Source research: docs/sources.md (sections 3 and 5).
//
// The film is a list of SHOTS (INTRO_SHOTS). Each shot has a world ('field' = Bethlehem, the game world;
// 'gibeah' = Saul's house, src/palace), a beat, a duration, the way it comes in (cut / dissolve / match
// dissolve / dip through light) and the narration or verse that plays over it. The cue lists handed to the
// score (INTRO_CUES / INTRO_CUES_SHORT, `IntroCue { beat, t, ... }`) are DERIVED from the shot list, so their
// times always match the picture: one cue at the start of every shot (`shot` set) plus one per text event.
// The camera work itself lives in src/gameplay/Intro.ts (keyed by shot id).
//
// Rules this sheet follows (see docs/sources.md, "Recommendations"):
//  * every `verse` is a catalog id from ./sources - its text is verified exact by
//    tools/sources/verify_sources.py; show it with `ui.verse(...verseArgs(id), seconds)`;
//  * captions are narration (place / person names), never styled as quotations; Saul's home is
//    'גִּבְעַת שָׁאוּל' / 'בֵּית שָׁאוּל', never a "palace";
//  * nothing from after 16:13 is depicted as happening now: no evil spirit, no David at court,
//    no lyre, no spear thrown, no Goliath. Jerusalem is still Jebusite. 22:6 is shown as a portrait of
//    the court (proleptic, with its reference); 16:7 is shown with its reference and never captioned as
//    being about Saul.

import type { SourceId } from './sources';

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

/** 'field' = the Bethlehem game world (engine.scene); 'gibeah' = Saul's house (src/palace set + cast). */
export type IntroWorld = 'field' | 'gibeah';

/**
 * How a shot comes in: 'cut' hard cut; 'dissolve' crossfade; 'match' short match dissolve (spear -> staff,
 * sun -> lamp flame); 'light' dip through warm light (the hinge -> Bethlehem, never through black);
 * 'black' fade in from black (only the very first shot).
 */
export type IntroTransition = 'cut' | 'dissolve' | 'match' | 'light' | 'black';

export type IntroShotId =
  | 'judea-dawn'
  | 'gibeah-aerial'
  | 'tamarisk-walls'
  | 'court'
  | 'court-hand'
  | 'david-staff'
  | 'saul-portrait'
  | 'warriors-line'
  | 'warriors-saul'
  | 'david-lamb'
  | 'hall-lamp'
  | 'hall'
  | 'hinge'
  | 'bethlehem'
  | 'rachel'
  | 'flock'
  | 'david-portrait'
  | 'david-crane'
  | 'title';

export interface IntroCaption {
  /** Location / person card title (narration). */
  readonly title: string;
  /** Subtitle: plain narration, or a catalog quotation rendered with quoteWithRefHtml(id). */
  readonly sub?: string | { readonly quote: SourceId };
}

/** A text event inside a shot (`at` = seconds from the start of the shot). */
export interface IntroText {
  readonly at: number;
  readonly caption?: IntroCaption;
  /** Scripture line - show with ui.verse(...verseArgs(verse), seconds). */
  readonly verse?: SourceId;
  readonly seconds?: number;
}

export interface IntroShot {
  readonly id: IntroShotId;
  readonly beat: IntroBeat;
  readonly world: IntroWorld;
  /** seconds on screen (the incoming dissolve overlaps the start of the shot) */
  readonly dur: number;
  readonly cut: IntroTransition;
  /** dissolve length (s) for 'dissolve' / 'match' / 'light' / 'black' */
  readonly fade?: number;
  /** dropped from the short cut (phones, replays) */
  readonly optional?: boolean;
  readonly text?: readonly IntroText[];
  /** Camera / art direction. */
  readonly direction: string;
}

export interface IntroCue {
  readonly beat: IntroBeat;
  /** Start (seconds from the start of the intro, in this cut). */
  readonly t: number;
  readonly caption?: IntroCaption;
  /** Scripture line - show with ui.verse(...verseArgs(verse), seconds). */
  readonly verse?: SourceId;
  readonly seconds?: number;
  /** Optional cues are dropped for the short (mobile / replay) cut. */
  readonly optional?: boolean;
  /** Camera / art direction. */
  readonly direction: string;
  /** Set on the cue that starts a shot (text-only cues leave it undefined). */
  readonly shot?: IntroShotId;
  readonly world?: IntroWorld;
  /** Shot length (s), on shot cues. */
  readonly dur?: number;
  /** How the shot comes in, on shot cues. */
  readonly cut?: IntroTransition;
}

// ---------------------------------------------------------------------------------------------------------
// The film (~104 s full cut, ~88 s short cut). Intercut: the king's height and the shepherd's field.
// ---------------------------------------------------------------------------------------------------------
export const INTRO_SHOTS: readonly IntroShot[] = [
  // ------------------------------------------------------------------ I. two worlds at dawn
  {
    id: 'judea-dawn', beat: 'judea', world: 'field', dur: 7.5, cut: 'black', fade: 2.6,
    text: [{ at: 1.2, caption: { title: 'הָרֵי יְהוּדָה', sub: 'אֶרֶץ יִשְׂרָאֵל · בִּימֵי שָׁאוּל הַמֶּלֶךְ' }, seconds: 5.6 }],
    direction: 'Out of black: dawn over the Judean ridge from the east, the low sun behind the lens, haze in the '
      + 'valleys, terraces catching the light. Slow aerial drift west.',
  },
  {
    id: 'gibeah-aerial', beat: 'gibeah', world: 'gibeah', dur: 6.6, cut: 'dissolve', fade: 2.2,
    text: [
      { at: 0.9, caption: { title: 'גִּבְעַת שָׁאוּל', sub: 'בְּנַחֲלַת בִּנְיָמִין' }, seconds: 4.6 },
      { at: 3.4, verse: 's1_15_34_gibeah_home', seconds: 4.4 },
    ],
    direction: 'Long dissolve north along the watershed to a high hill: the walled stronghold of rough limestone '
      + 'fieldstones above its village, oven smoke, terraces. No horses, no chariots.',
  },
  {
    id: 'tamarisk-walls', beat: 'gibeah', world: 'gibeah', dur: 4.5, cut: 'cut', optional: true,
    direction: 'Low lateral track past the great tamarisk on the height, the walls behind, the court gathered.',
  },
  {
    id: 'court', beat: 'saul-court', world: 'gibeah', dur: 5.6, cut: 'cut',
    text: [{ at: 0.6, verse: 's1_22_6_tamarisk', seconds: 7.8 }],
    direction: 'Saul enthroned under the tamarisk (eshel), spear upright in his hand, servants and runners '
      + 'standing about him; wind in the fine foliage. Formal, still, royal. Slow push in, shallow focus on the king.',
  },
  {
    id: 'court-hand', beat: 'saul-court', world: 'gibeah', dur: 3, cut: 'cut',
    direction: 'Insert: the king\'s fist on the spear shaft ("his spear in his hand"), tilting up the shaft to the '
      + 'bronze head against the tamarisk. The shaft ends vertical in the left third - match cut to the staff.',
  },
  {
    id: 'david-staff', beat: 'flock', world: 'field', dur: 7, cut: 'match', fade: 0.7,
    text: [{ at: 1.4, verse: 's1_16_11_youngest', seconds: 5.2 }],
    direction: 'MATCH: the shepherd\'s hand on his gnarled staff in the same place of the frame as the king\'s on '
      + 'the spear. Pull back and up: David alone among the grazing flock in open golden light, the sun behind him.',
  },
  {
    id: 'saul-portrait', beat: 'saul-portrait', world: 'gibeah', dur: 5.5, cut: 'cut',
    text: [
      { at: 0.35, caption: { title: 'שָׁאוּל בֶּן־קִישׁ', sub: 'מֶלֶךְ יִשְׂרָאֵל' }, seconds: 4.4 },
      { at: 1.1, verse: 's1_9_2_head_above', seconds: 4.2 },
    ],
    direction: 'Hard cut from the open field to the king: low-angle push from a medium to a close shot, the sun '
      + 'rim behind his shoulder, a head taller than the men beside him. Brooding, awe-inspiring, never mad.',
  },
  {
    id: 'warriors-line', beat: 'warriors', world: 'gibeah', dur: 3.8, cut: 'cut', optional: true,
    text: [
      { at: 0.25, caption: { title: 'אַבְנֵר בֶּן־נֵר', sub: 'שַׂר הַצָּבָא' }, seconds: 3.4 },
      { at: 1.0, verse: 's1_14_52_mighty_men', seconds: 6.2 },
    ],
    direction: 'Abner walks the line of men at arms: Benjaminite slingers and archers, a spearman with a '
      + 'leather shield.',
  },
  {
    id: 'warriors-saul', beat: 'warriors', world: 'gibeah', dur: 3.4, cut: 'cut', optional: true,
    direction: 'Over the men\'s shoulders back to Saul watching them from his seat.',
  },
  {
    id: 'david-lamb', beat: 'david', world: 'field', dur: 6, cut: 'dissolve', fade: 1.2,
    direction: 'The shepherd\'s calm: at knee height through the grazing flock, the little white lamb close, David '
      + 'soft behind it; the focus finds him. The lens drifts toward the low sun - match dissolve to a lamp flame.',
  },
  {
    id: 'hall-lamp', beat: 'saul-hall', world: 'gibeah', dur: 2.6, cut: 'match', fade: 1.1,
    direction: 'MATCH: the sun becomes the flame of an open saucer lamp in a wall niche of Saul\'s house at dusk.',
  },
  {
    id: 'hall', beat: 'saul-hall', world: 'gibeah', dur: 6.4, cut: 'cut',
    text: [{ at: 0.6, verse: 's1_15_35_samuel_mourned', seconds: 5.5 }],
    direction: 'Evening in Saul\'s house: the king alone on his seat by the wall, the lamps, the woven wool '
      + 'hangings in scarlet and purple, his spear leaning by him. The weight of the crown. Brooding, not mad.',
  },
  {
    id: 'hinge', beat: 'hinge', world: 'gibeah', dur: 6, cut: 'cut',
    text: [{ at: 0.5, verse: 's1_15_28_torn_kingdom', seconds: 5.6 }],
    direction: 'Close on the torn corner of a prophet\'s robe in the king\'s hand (the memory of Gilgal), pulling '
      + 'back to his bowed face. Restrained.',
  },
  // ------------------------------------------------------------------ II. Bethlehem
  {
    id: 'bethlehem', beat: 'bethlehem', world: 'field', dur: 6.6, cut: 'light', fade: 2.4,
    text: [
      { at: 1.0, caption: { title: 'בֵּית לֶחֶם יְהוּדָה', sub: 'עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד' }, seconds: 4.8 },
      { at: 2.6, verse: 's1_17_12_ephrathite', seconds: 4.4 },
    ],
    direction: 'Through warm light, south over the hills: low glide over the terraced olive groves below Bethlehem.',
  },
  {
    id: 'rachel', beat: 'rachel', world: 'field', dur: 5.8, cut: 'dissolve', fade: 1.2,
    text: [{ at: 0.6, caption: { title: 'מַצֶּבֶת קְבֻרַת רָחֵל', sub: { quote: 'gen_35_19_rachel_buried' } }, seconds: 5 }],
    direction: 'Rachel\'s pillar on the road to Ephrath.',
  },
  {
    id: 'flock', beat: 'flock', world: 'field', dur: 5, cut: 'dissolve', fade: 1.0, optional: true,
    direction: 'The flock at pasture, the little lamb.',
  },
  {
    id: 'david-portrait', beat: 'david', world: 'field', dur: 7.2, cut: 'dissolve', fade: 0.9,
    text: [{ at: 0.9, verse: 's1_16_12_ruddy', seconds: 5.6 }],
    direction: 'David on his rock: the mirror of Saul\'s portrait - the same low-angle push, but the young face in '
      + 'the open light, calm eyes on the horizon, not on the lens.',
  },
  {
    id: 'david-crane', beat: 'david', world: 'field', dur: 6.6, cut: 'cut',
    text: [{ at: 0.7, verse: 's1_16_7_looks_heart', seconds: 5.5 }],
    direction: 'Crane up behind David to reveal the land he looks over.',
  },
  {
    id: 'title', beat: 'title', world: 'field', dur: 6.2, cut: 'cut',
    direction: 'The crane continues; title card DAVID / דָּוִד (the verse has faded first).',
  },
];

/** Cue list of one cut (derived from INTRO_SHOTS; `short` drops the optional shots and retimes the rest). */
export function introCues(short: boolean): IntroCue[] {
  const cues: IntroCue[] = [];
  let t = 0;
  for (const s of INTRO_SHOTS) {
    if (short && s.optional) continue;
    cues.push({ beat: s.beat, t: round(t), shot: s.id, world: s.world, dur: s.dur, cut: s.cut, optional: s.optional, direction: s.direction });
    for (const x of s.text ?? []) {
      cues.push({ beat: s.beat, t: round(t + x.at), caption: x.caption, verse: x.verse, seconds: x.seconds, optional: s.optional, direction: `${s.id}: text` });
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

const round = (x: number) => Math.round(x * 1000) / 1000;

/** The full cut (desktop, first viewing). */
export const INTRO_CUES: readonly IntroCue[] = introCues(false);

/** The short cut (phones, replays): the optional shots dropped, the rest retimed. */
export const INTRO_CUES_SHORT: readonly IntroCue[] = introCues(true);
