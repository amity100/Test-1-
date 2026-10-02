// The biblical names on the opening film's REALISTIC 3D MAP (CUT v5, P4 'map-exodus' + P5 'map-tribes';
// docs/intro-script-v5.md "Text": "Map labels (place names, tribes, cities) are pointed biblical names from a verified
// list, each with the verse it is taken from"). DATA ONLY — src/film/map/mapLabels.ts shows them.
//
// Every `he` is spelled and pointed EXACTLY as it stands in its verse `refEn` (Miqra according to the Masorah, as in the
// catalog src/content/sources.ts; a maqaf is kept where the verse joins the words) and is checked by
// `python3 tools/sources/verify_sources.py` (section "map names": pointed, and found in the verse as a whole word —
// a prefix letter of the verse such as ל / ב / מ may stand before it). These are NAMES, not quotations: they are never
// styled as verses and carry no quotation marks.
//
// Positions (lon / lat, WGS84) are the usual identifications; where the sources are silent on a site the choice and
// its basis are noted. NO mountain is marked as Sinai and no point as the crossing of the sea (the brief: the sources do
// not fix them); the wilderness is one region name.

export type MapNameKind = 'region' | 'sea' | 'place' | 'tribe' | 'city';

export type MapNameId =
  // P4: out of Egypt to Gilgal
  | 'egypt' | 'raamses' | 'greatSea' | 'wilderness' | 'kadesh' | 'edom' | 'saltSea' | 'kinneret' | 'jordan'
  | 'moabPlains' | 'jericho' | 'gilgal'
  // P5: the tribes in the days of the Judges (Josh 13-19; Dan in the north: Judg 18)
  | 'dan' | 'naphtali' | 'asher' | 'zebulun' | 'issachar' | 'manassehW' | 'manassehE' | 'ephraim' | 'benjamin'
  | 'judah' | 'simeon' | 'reuben' | 'gad'
  // P5: the five lords of the Philistines (1 Sam 6:17)
  | 'gaza' | 'ashkelon' | 'ashdod' | 'gath' | 'ekron';

export interface MapName {
  readonly id: MapNameId;
  /** the name, pointed, exactly as in `refEn` */
  readonly he: string;
  /** the verse it is taken from (Sefaria-style reference, checked by verify_sources.py) */
  readonly refEn: string;
  readonly kind: MapNameKind;
  /** where it stands on the map (deg) */
  readonly lon: number;
  readonly lat: number;
  /** identification / placement note */
  readonly note: string;
}

export const MAP_NAMES: Readonly<Record<MapNameId, MapName>> = {
  // ------------------------------------------------------------------ P4
  egypt: { id: 'egypt', he: 'מִצְרַיִם', refEn: 'Exodus 14:5', kind: 'region', lon: 30.95, lat: 30.45, note: 'over the delta and the valley' },
  raamses: { id: 'raamses', he: 'רַעְמְסֵס', refEn: 'Exodus 12:37', kind: 'place', lon: 31.83, lat: 30.8, note: 'Pi-Ramesses = Qantir on the Pelusiac branch (Bietak); the journey sets out from it (Ex 12:37)' },
  greatSea: { id: 'greatSea', he: 'הַיָּם הַגָּדוֹל', refEn: 'Numbers 34:6', kind: 'sea', lon: 32.9, lat: 32.55, note: 'the western border of the land' },
  wilderness: { id: 'wilderness', he: 'הַמִּדְבָּר', refEn: 'Deuteronomy 1:19', kind: 'region', lon: 33.75, lat: 29.95, note: 'the great and terrible wilderness of Deut 1:19 — one name for the wilderness (no station, no mountain is marked)' },
  kadesh: { id: 'kadesh', he: 'קָדֵשׁ', refEn: 'Deuteronomy 1:46', kind: 'place', lon: 34.42, lat: 30.64, note: 'the long stay of Deut 1:46; at the southern border of the land (Num 34:4) — the usual identification, the springs of Ain el-Qudeirat (Onkelos renders it Reqem, itself unlocated)' },
  edom: { id: 'edom', he: 'אֱדוֹם', refEn: 'Numbers 21:4', kind: 'region', lon: 35.62, lat: 30.45, note: 'the land the people went around (Num 21:4) — the plateau east of the Arabah' },
  saltSea: { id: 'saltSea', he: 'יָם־הַמֶּלַח', refEn: 'Joshua 3:16', kind: 'sea', lon: 35.5, lat: 31.42, note: 'at the Iron Age level (~-400 m), its southern basin under water' },
  kinneret: { id: 'kinneret', he: 'יָם־כִּנֶּרֶת', refEn: 'Numbers 34:11', kind: 'sea', lon: 35.59, lat: 32.83, note: '' },
  jordan: { id: 'jordan', he: 'הַיַּרְדֵּן', refEn: 'Joshua 4:19', kind: 'place', lon: 35.57, lat: 32.25, note: 'on the river, midway between the two seas' },
  moabPlains: { id: 'moabPlains', he: 'עַרְבוֹת מוֹאָב', refEn: 'Numbers 22:1', kind: 'place', lon: 35.64, lat: 31.8, note: 'the plain north-east of the Salt Sea, across the Jordan from Jericho (Num 22:1)' },
  jericho: { id: 'jericho', he: 'יְרִיחוֹ', refEn: 'Joshua 3:16', kind: 'place', lon: 35.444, lat: 31.871, note: 'Tell es-Sultan; the people crossed opposite it (Josh 3:16)' },
  gilgal: { id: 'gilgal', he: 'הַגִּלְגָּל', refEn: 'I Samuel 11:14', kind: 'place', lon: 35.5, lat: 31.855, note: 'on the east border of Jericho (Josh 4:19) — between Jericho and the Jordan; the site itself is not identified' },
  // ------------------------------------------------------------------ P5: the tribes (centres of their inheritances)
  dan: { id: 'dan', he: 'דָּן', refEn: 'Judges 18:29', kind: 'tribe', lon: 35.64, lat: 33.24, note: 'Dan in the north (Laish renamed Dan, Judg 18:29) — as in the days of Saul' },
  naphtali: { id: 'naphtali', he: 'נַפְתָּלִי', refEn: 'Joshua 19:32', kind: 'tribe', lon: 35.46, lat: 33.03, note: 'eastern Upper Galilee' },
  asher: { id: 'asher', he: 'אָשֵׁר', refEn: 'Joshua 19:24', kind: 'tribe', lon: 35.17, lat: 32.98, note: 'western Galilee and the coast' },
  zebulun: { id: 'zebulun', he: 'זְבוּלֻן', refEn: 'Joshua 19:10', kind: 'tribe', lon: 35.28, lat: 32.77, note: 'Lower Galilee' },
  issachar: { id: 'issachar', he: 'יִשָּׂשכָר', refEn: 'Joshua 19:17', kind: 'tribe', lon: 35.42, lat: 32.6, note: 'the eastern Jezreel valley' },
  manassehW: { id: 'manassehW', he: 'מְנַשֶּׁה', refEn: 'Joshua 17:1', kind: 'tribe', lon: 35.15, lat: 32.36, note: 'west of the Jordan (Josh 17)' },
  manassehE: { id: 'manassehE', he: 'מְנַשֶּׁה', refEn: 'Joshua 17:1', kind: 'tribe', lon: 35.95, lat: 32.68, note: 'the half tribe east of the Jordan, the Bashan and northern Gilead (Josh 13:29-31)' },
  ephraim: { id: 'ephraim', he: 'אֶפְרַיִם', refEn: 'Joshua 16:5', kind: 'tribe', lon: 35.22, lat: 32.08, note: 'the hill country of Ephraim' },
  benjamin: { id: 'benjamin', he: 'בִּנְיָמִן', refEn: 'Judges 20:20', kind: 'tribe', lon: 35.3, lat: 31.86, note: 'between Ephraim and Judah (Josh 18:11)' },
  judah: { id: 'judah', he: 'יְהוּדָה', refEn: 'Joshua 15:1', kind: 'tribe', lon: 35.05, lat: 31.5, note: 'the hill country of Judah' },
  simeon: { id: 'simeon', he: 'שִׁמְעוֹן', refEn: 'Joshua 19:1', kind: 'tribe', lon: 34.82, lat: 31.2, note: 'inside Judah, around Beersheba (Josh 19:1-9)' },
  reuben: { id: 'reuben', he: 'רְאוּבֵן', refEn: 'Joshua 13:15', kind: 'tribe', lon: 35.8, lat: 31.62, note: 'the plateau north of the Arnon (Josh 13:15-23)' },
  gad: { id: 'gad', he: 'גָּד', refEn: 'Deuteronomy 33:20', kind: 'tribe', lon: 35.78, lat: 32.1, note: 'Gilead (Josh 13:24-28)' },
  // ------------------------------------------------------------------ P5: the five Philistine cities (1 Sam 6:17)
  gaza: { id: 'gaza', he: 'עַזָּה', refEn: 'I Samuel 6:17', kind: 'city', lon: 34.462, lat: 31.505, note: 'Tell Harube (old Gaza)' },
  ashkelon: { id: 'ashkelon', he: 'אַשְׁקְלוֹן', refEn: 'I Samuel 6:17', kind: 'city', lon: 34.548, lat: 31.664, note: 'Tel Ashkelon' },
  ashdod: { id: 'ashdod', he: 'אַשְׁדּוֹד', refEn: 'I Samuel 6:17', kind: 'city', lon: 34.666, lat: 31.755, note: 'Tel Ashdod' },
  gath: { id: 'gath', he: 'גַּת', refEn: 'I Samuel 5:8', kind: 'city', lon: 34.847, lat: 31.7, note: 'Tell es-Safi; 1 Sam 6:17 has the same city after a prefix (לְגַת)' },
  ekron: { id: 'ekron', he: 'עֶקְרוֹן', refEn: 'I Samuel 6:17', kind: 'city', lon: 34.85, lat: 31.779, note: 'Tel Miqne' },
};

/** the order the tribes come up in at `tribes` (north to south, west then east) */
export const TRIBE_ORDER: readonly MapNameId[] = ['dan', 'naphtali', 'asher', 'zebulun', 'issachar', 'manassehE', 'manassehW', 'gad', 'ephraim', 'benjamin', 'reuben', 'judah', 'simeon'];
/** the five lords of the Philistines, in the order of 1 Sam 6:17 */
export const PHILISTINE_CITIES: readonly MapNameId[] = ['ashdod', 'gaza', 'ashkelon', 'gath', 'ekron'];
