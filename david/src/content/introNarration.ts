// Narration of the opening film "הַטּוֹב מִמֶּךָּ" (docs/intro-script.md) — the on-screen lines that are NOT
// quotations: the time card, the prologue line, place / person cards, the title and chapter cards.
//
// Rules (docs/visual-bible.md §1):
//  * These are NARRATION. Never wrap them in quotation marks, never give them a source reference, never style
//    them like a verse (ui.verse). Scripture on screen comes ONLY from ./sources (quoteText / verseArgs /
//    quoteWithRefHtml) — e.g. the film's own title "הַטּוֹב מִמֶּךָּ" is a quotation: 's1_15_28_better_than_you'.
//  * The texts were checked for accuracy (history, geography, chronology) and vocalization by the sources
//    teammate; tools/sources/verify_sources.py lists them as narration, checks that every Hebrew word is pointed,
//    that none contains quotation marks, and warns if one reproduces 4+ consecutive words of a verse.
//  * Do not add lines without checking them against docs/visual-bible.md.

import type { SourceId } from './sources';

/** How a narration line is presented. */
export type IntroNarrationKind =
  | 'time-card' //   white on black, alone, slow fade
  | 'line' //        prologue narration line over picture
  | 'place' //       place card (lower third / centred small caps style)
  | 'person' //      person card (name · title)
  | 'title' //       the game's name on the title card
  | 'chapter' //     chapter card under the title
  | 'act'; //        optional act label (the script's section names); not required on screen

export interface IntroNarrationLine {
  /** Stable id (identical to the key in INTRO_NARRATION). */
  readonly id: string;
  readonly kind: IntroNarrationKind;
  /** Shot number(s) of docs/intro-script.md where the line belongs (empty = optional / anywhere). */
  readonly shots: readonly number[];
  /** Exact on-screen text (pointed Hebrew, or Latin for the logo). */
  readonly text: string;
  /** Right-to-left text (all Hebrew lines) — false only for the Latin logo. */
  readonly rtl: boolean;
  /** English meaning (translation aid for developers; not shown). */
  readonly en: string;
  /** Accuracy / vocalization note. */
  readonly note?: string;
  /** true = not in the approved script; an allowed variant or an optional card. */
  readonly optional?: boolean;
}

export const INTRO_NARRATION = {
  // ------------------------------------------------------------------ approved script lines
  timeCard: {
    id: 'timeCard',
    kind: 'time-card',
    shots: [1],
    text: 'לִפְנֵי כִּשְׁלֹשֶׁת אֲלָפִים שָׁנָה',
    rtl: true,
    en: 'About three thousand years ago',
    note:
      'True on both chronologies: the conventional date of Saul (~1020-1000 BCE) is ~3,040 years ago; the ' +
      'traditional (Seder Olam) date, AM ~2880, is ~2,900 years ago. כִּ before a shva; שְׁלֹשֶׁת (construct, ' +
      'feminine form with the masculine אֲלָפִים); singular שָׁנָה after a number above ten.',
  },
  tribes: {
    id: 'tribes',
    kind: 'line',
    shots: [2],
    text: 'שִׁבְטֵי יִשְׂרָאֵל יוֹשְׁבִים בְּאַרְצָם',
    rtl: true,
    en: 'The tribes of Israel dwell in their land',
    note:
      'Accurate for the days of Samuel (after Joshua and the Judges, before the monarchy). Not a verse ' +
      '(no verse has these words).',
  },
  gilgal: {
    id: 'gilgal',
    kind: 'place',
    shots: [6],
    text: 'הַגִּלְגָּל',
    rtl: true,
    en: 'Gilgal',
    note: 'With the article, as the Bible always names the place (1 Sam 15:12, 11:15; Josh 4:19).',
  },
  saul: {
    id: 'saul',
    kind: 'person',
    shots: [7],
    text: 'שָׁאוּל בֶּן־קִישׁ · מֶלֶךְ יִשְׂרָאֵל',
    rtl: true,
    en: 'Saul son of Kish · King of Israel',
    note: 'Name as in 1 Sam 10:21; "king over Israel" 15:17, 15:26. Two-line layouts: saulName + saulTitle.',
  },
  saulShort: {
    id: 'saulShort',
    kind: 'person',
    shots: [7],
    text: 'שָׁאוּל',
    rtl: true,
    en: 'Saul',
    note: 'CUT v2 person card (docs/intro-script-v2.md): the name alone, very large, with saulTitle under it. The name as in 1 Sam 9:2.',
  },
  saulName: {
    id: 'saulName',
    kind: 'person',
    shots: [7],
    text: 'שָׁאוּל בֶּן־קִישׁ',
    rtl: true,
    en: 'Saul son of Kish',
    note: 'First line of the two-line form of `saul`.',
  },
  saulTitle: {
    id: 'saulTitle',
    kind: 'person',
    shots: [7],
    text: 'מֶלֶךְ יִשְׂרָאֵל',
    rtl: true,
    en: 'King of Israel',
    note: 'Second line of the two-line form of `saul`.',
  },
  samuel: {
    id: 'samuel',
    kind: 'person',
    shots: [9],
    text: 'שְׁמוּאֵל',
    rtl: true,
    en: 'Samuel',
    note: 'The approved card is the name alone (see samuelProphet for the optional longer form).',
  },
  davidLogo: {
    id: 'davidLogo',
    kind: 'title',
    shots: [20],
    text: 'DAVID',
    rtl: false,
    en: 'DAVID (the game logo)',
  },
  davidName: {
    id: 'davidName',
    kind: 'title',
    shots: [20],
    text: 'דָּוִד',
    rtl: true,
    en: 'David',
    note: 'Defective spelling דָּוִד as in the books of Samuel (Chronicles writes דָּוִיד).',
  },
  chapterTitle: {
    id: 'chapterTitle',
    kind: 'chapter',
    shots: [20],
    text: 'פֶּרֶק רִאשׁוֹן · הָרֹעֶה',
    rtl: true,
    en: 'Chapter one · The Shepherd',
    note: 'הָרֹעֶה with holam haser, as the Bible spells רֹעֶה (1 Sam 16:11).',
  },
  chapterNumber: {
    id: 'chapterNumber',
    kind: 'chapter',
    shots: [20],
    text: 'פֶּרֶק רִאשׁוֹן',
    rtl: true,
    en: 'Chapter one',
    note: 'First line of the two-line form of `chapterTitle`.',
  },
  chapterName: {
    id: 'chapterName',
    kind: 'chapter',
    shots: [20],
    text: 'הָרֹעֶה',
    rtl: true,
    en: 'The Shepherd',
    note: 'Second line of the two-line form of `chapterTitle`.',
  },

  // ------------------------------------------------------------------ optional (allowed variants, act labels)
  samuelProphet: {
    id: 'samuelProphet',
    kind: 'person',
    shots: [9],
    text: 'שְׁמוּאֵל הַנָּבִיא',
    rtl: true,
    en: 'Samuel the prophet',
    note: 'Allowed longer card: "שְׁמוּאֵל הַנָּבִיא" is his title in 2 Chr 35:18; cf. 1 Sam 3:20.',
    optional: true,
  },
  rachelTomb: {
    id: 'rachelTomb',
    kind: 'place',
    shots: [3],
    text: 'קֶבֶר רָחֵל',
    rtl: true,
    en: "Rachel's tomb",
    note:
      'Traditional name of the place (Rachel\'s pillar, Gen 35:20). CUT v2: the place card of shot P3 ' +
      'replaces the verse Gen 35:19 (docs/intro-script-v2.md).',
  },
  philistia: {
    id: 'philistia',
    kind: 'place',
    shots: [4],
    text: 'אֶרֶץ פְּלִשְׁתִּים',
    rtl: true,
    en: 'The land of the Philistines',
    note: 'Optional place card for shot 4 (1 Sam 27:1 uses this name).',
    optional: true,
  },
  ramah: {
    id: 'ramah',
    kind: 'place',
    shots: [5],
    text: 'הָרָמָה',
    rtl: true,
    en: 'Ramah',
    note: "Optional place card for shot 5 — Samuel's town (1 Sam 7:17, 8:4).",
    optional: true,
  },
  bethlehem: {
    id: 'bethlehem',
    kind: 'place',
    shots: [14],
    text: 'בֵּית לֶחֶם',
    rtl: true,
    en: 'Bethlehem',
    note: 'Optional place card for shot 14 (non-pausal form בֵּית לֶחֶם).',
    optional: true,
  },
  // ------------------------------------------------------------------ CUT v5: the prologue (docs/intro-script-v5.md)
  landIsrael: {
    id: 'landIsrael',
    kind: 'place',
    shots: [1],
    text: 'אֶרֶץ יִשְׂרָאֵל',
    rtl: true,
    en: 'The Land of Israel',
    note: 'First card of the prologue (P1, the big line of a two-line card). The biblical name (1 Sam 13:19).',
  },
  judahDays: {
    id: 'judahDays',
    kind: 'line',
    shots: [1],
    text: 'הָרֵי יְהוּדָה · בִּימֵי שָׁאוּל הַמֶּלֶךְ',
    rtl: true,
    en: 'The hills of Judah · in the days of King Saul',
    note:
      'Second line of the P1 card. הַר יְהוּדָה (Josh 20:7, 21:11) in the common plural; בִּימֵי שָׁאוּל (1 Sam 17:12, ' +
      '1 Chr 5:10). The time of the story: the reign of Saul (~1020-1000 BCE).',
  },
  bethlehemJesse: {
    id: 'bethlehemJesse',
    kind: 'line',
    shots: [2],
    text: 'עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד',
    rtl: true,
    en: 'The town of Jesse son of Obed',
    note:
      'Second line of the P2 card (under בֵּית לֶחֶם). Jesse of Bethlehem (1 Sam 16:1, 17:12), son of Obed (Ruth 4:17, ' +
      '21-22; 1 Chr 2:12). Plain narration, not a verse.',
  },
  exodus: {
    id: 'exodus',
    kind: 'line',
    shots: [4],
    text: 'יְצִיאַת מִצְרַיִם',
    rtl: true,
    en: 'The Exodus from Egypt',
    note: 'The traditional name of the event (Ex 12-14); the map draws the road out of Egypt.',
  },
  wilderness: {
    id: 'wilderness',
    kind: 'line',
    shots: [4],
    text: 'אַרְבָּעִים שָׁנָה בַּמִּדְבָּר',
    rtl: true,
    en: 'Forty years in the wilderness',
    note: 'Num 14:33-34; Deut 8:2 (three words in common with Deut 8:2, below the four-word limit).',
  },
  actLand: {
    id: 'actLand',
    kind: 'act',
    shots: [1, 2, 3, 4, 5],
    text: 'הָאָרֶץ',
    rtl: true,
    en: 'The Land (prologue)',
    optional: true,
  },
  actKing: {
    id: 'actKing',
    kind: 'act',
    shots: [6, 7, 8, 9, 10, 11, 12],
    text: 'הַמֶּלֶךְ',
    rtl: true,
    en: 'The King (act I)',
    optional: true,
  },
  actSearch: {
    id: 'actSearch',
    kind: 'act',
    shots: [13],
    text: 'הַחִפּוּשׂ',
    rtl: true,
    en: 'The Search (transition)',
    note: 'Root ח־פ־שׂ with SIN (שׂ); the script\'s unpointed "החיפוש" must not be pointed with shin.',
    optional: true,
  },
  actShepherd: {
    id: 'actShepherd',
    kind: 'act',
    shots: [14, 15, 16, 17],
    text: 'הָרֹעֶה',
    rtl: true,
    en: 'The Shepherd (act II)',
    optional: true,
  },
  actThicket: {
    id: 'actThicket',
    kind: 'act',
    shots: [18, 19],
    text: 'בַּסְּבַךְ',
    rtl: true,
    en: 'In the thicket (hook)',
    note: 'As in Gen 22:13 (בַּסְּבַךְ) — a thicket.',
    optional: true,
  },
} as const satisfies Record<string, IntroNarrationLine>;

export type IntroNarrationId = keyof typeof INTRO_NARRATION;

/** The exact on-screen text of a narration line. */
export function narration(id: IntroNarrationId): string {
  return INTRO_NARRATION[id].text;
}

/** All narration lines of a shot (approved lines first, optional ones after). */
export function narrationForShot(shot: number, includeOptional = false): readonly IntroNarrationLine[] {
  const all: IntroNarrationLine[] = Object.values(INTRO_NARRATION);
  return all
    .filter((l) => l.shots.includes(shot) && (includeOptional || !l.optional))
    .sort((a, b) => Number(!!a.optional) - Number(!!b.optional));
}

/**
 * The on-screen texts of every shot of docs/intro-script.md, in order (docs/visual-bible.md §1).
 * `narration` ids come from INTRO_NARRATION (show with narration(id), never as a verse);
 * `quote` is a catalog id (show with ui.verse(...verseArgs(id), seconds) / quoteWithRefHtml(id)).
 */
export interface IntroFilmText {
  readonly shot: number;
  readonly narration?: readonly IntroNarrationId[];
  readonly quote?: SourceId;
}

export const INTRO_FILM_TEXTS: readonly IntroFilmText[] = [
  // CUT v2 (docs/intro-script-v2.md): 11 text events; shot numbers of the story script (P1 = 1, P3 = 3, P5 = 5,
  // G1 = 6, G2 = 7, G3 = 8, G4 = 9, G6 = 11, D1 = 15, D2 = 16, T = 20)
  { shot: 1, narration: ['timeCard'] },
  { shot: 3, narration: ['rachelTomb'] },
  { shot: 5, quote: 's1_8_5_give_us_king' },
  { shot: 6, narration: ['gilgal'] },
  { shot: 7, narration: ['saulShort', 'saulTitle'] },
  { shot: 8, quote: 's1_9_2_head_above' },
  { shot: 9, narration: ['samuel'] },
  { shot: 11, quote: 's1_15_28_torn_today' },
  { shot: 15, quote: 's1_15_28_to_your_neighbor' },
  { shot: 16, quote: 's1_16_7_looks_heart' },
  { shot: 20, narration: ['davidLogo', 'davidName', 'chapterTitle'] },
];

/** The film's own title, "הַטּוֹב מִמֶּךָּ", is two words of 1 Sam 15:28 — a quotation, rendered from the catalog. */
export const INTRO_FILM_TITLE: SourceId = 's1_15_28_better_than_you';
