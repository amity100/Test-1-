// Recommended cue sheet for the chapter-1 cinematic intro: the king at Gibeah and the shepherd at
// Bethlehem (1 Samuel 15:34 - 16:1, before David's anointing). Source research: docs/sources.md.
//
// Rules this sheet follows (see docs/sources.md, "Recommendations"):
//  * every `verse` is a catalog id from ./sources - its text is verified exact by
//    tools/sources/verify_sources.py; show it with `ui.verse(...verseArgs(id), seconds)`;
//  * captions are narration (place / person names), never styled as quotations;
//  * nothing from after 16:13 is depicted as happening now: no evil spirit, no David at court,
//    no lyre, no spear thrown, no Goliath. Jerusalem is still Jebusite.
//
// Timings follow the current Story.ts intro (Bethlehem beats keep their order); the Saul beats are new.

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

export interface IntroCaption {
  /** Location / person card title (narration). */
  readonly title: string;
  /** Subtitle: plain narration, or a catalog quotation rendered with quoteWithRefHtml(id). */
  readonly sub?: string | { readonly quote: SourceId };
}

export interface IntroCue {
  readonly beat: IntroBeat;
  /** Suggested start (seconds from the start of the intro). */
  readonly t: number;
  readonly caption?: IntroCaption;
  /** Scripture line - show with ui.verse(...verseArgs(verse), seconds). */
  readonly verse?: SourceId;
  readonly seconds?: number;
  /** Optional cues may be dropped for the short (mobile / replay) cut. */
  readonly optional?: boolean;
  /** Camera / art direction. */
  readonly direction: string;
}

export const INTRO_CUES: readonly IntroCue[] = [
  {
    beat: 'judea', t: 1.2,
    caption: { title: 'הָרֵי יְהוּדָה', sub: 'אֶרֶץ יִשְׂרָאֵל · בִּימֵי שָׁאוּל הַמֶּלֶךְ' },
    direction: 'Dawn over the Judean ridge seen from the east; haze in the valleys, terraces catching low sun.',
  },
  {
    beat: 'gibeah', t: 8.8,
    caption: { title: 'גִּבְעַת שָׁאוּל', sub: 'בְּנַחֲלַת בִּנְיָמִין' },
    direction: 'Glide north along the watershed ridge to a high hill: a walled stronghold of rough limestone '
      + 'fieldstones with a corner tower above a cluster of pillared houses, terraces and threshing floor. '
      + 'Smoke from ovens; donkeys, oxen; guards on the wall. No horses, no chariots.',
  },
  {
    beat: 'gibeah', t: 11.4, verse: 's1_15_34_gibeah_home', seconds: 4.8,
    direction: 'Push in over the gate toward the height of the hill where a great tamarisk stands.',
  },
  {
    beat: 'saul-court', t: 17.0, verse: 's1_22_6_tamarisk', seconds: 6.5,
    direction: 'Saul seated on the height under the tamarisk (eshel), spear upright in his hand, servants and '
      + 'runners standing about him; wind in the fine tamarisk foliage. Formal, still, royal.',
  },
  {
    beat: 'saul-portrait', t: 24.5, verse: 's1_9_2_head_above', seconds: 4.8,
    direction: 'Low-angle portrait: Saul a head taller than everyone around him; mature, bearded, handsome, '
      + 'a thin gold diadem (nezer) and an armlet (etz\'adah); robe (me\'il) with a hem/corner, madim beneath; '
      + 'tzitzit with a blue thread on the corners of his outer garment.',
  },
  {
    beat: 'warriors', t: 30.0, optional: true,
    caption: { title: 'אַבְנֵר בֶּן־נֵר', sub: 'שַׂר הַצָּבָא' },
    direction: 'Abner inspecting men at arms in the courtyard: Benjaminite slingers and archers (1 Chr 12:2), '
      + 'spearmen with leather shields; the armour-bearer beside the king.',
  },
  {
    beat: 'warriors', t: 32.0, verse: 's1_14_52_mighty_men', seconds: 6, optional: true,
    direction: 'Hold on the warriors, then back to Saul watching them.',
  },
  {
    beat: 'saul-hall', t: 38.5, verse: 's1_15_35_samuel_mourned', seconds: 6,
    direction: 'Evening in Saul\'s house: the king alone on his seat by the wall, oil lamps (open saucer lamps '
      + 'with a pinched spout) in wall niches, woven wool hangings in scarlet and purple. Brooding, not mad.',
  },
  {
    beat: 'hinge', t: 45.0, verse: 's1_15_28_torn_kingdom', seconds: 5.5,
    direction: 'Close on the torn corner of a robe (memory of Gilgal), then the camera leaves the house '
      + 'through a window and flies south over the hills toward Bethlehem.',
  },
  {
    beat: 'bethlehem', t: 51.0,
    caption: { title: 'בֵּית לֶחֶם יְהוּדָה', sub: 'עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד' },
    direction: 'Existing shot: low glide over the terraced olive groves below Bethlehem.',
  },
  {
    beat: 'bethlehem', t: 53.0, verse: 's1_17_12_ephrathite', seconds: 4.6,
    direction: 'Existing shot continues.',
  },
  {
    beat: 'rachel', t: 58.0,
    caption: { title: 'מַצֶּבֶת קְבֻרַת רָחֵל', sub: { quote: 'gen_35_19_rachel_buried' } },
    direction: 'Existing shot: Rachel\'s pillar on the road to Ephrath.',
  },
  {
    beat: 'flock', t: 64.5, verse: 's1_16_11_youngest', seconds: 5,
    direction: 'Existing shot: the flock at pasture, the little lamb.',
  },
  {
    beat: 'david', t: 71.0, verse: 's1_16_12_ruddy', seconds: 6,
    direction: 'Existing shot: David on his rock. Match the framing of the Saul portrait (mirror composition).',
  },
  {
    beat: 'david', t: 77.5, verse: 's1_16_7_looks_heart', seconds: 5, optional: true,
    direction: 'Crane up behind David to reveal the land.',
  },
  {
    beat: 'title', t: 81.0,
    direction: 'Title card DAVID (hide the verse first).',
  },
];

/** The same cue sheet without the optional cues (short / mobile cut). */
export const INTRO_CUES_SHORT: readonly IntroCue[] = INTRO_CUES.filter((c) => !c.optional);
