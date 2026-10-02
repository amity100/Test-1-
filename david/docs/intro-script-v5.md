# DAVID — opening film "הַטּוֹב מִמֶּךָּ" · CUT v5 (134.5 s): the prologue and the new end

**This document adds a PROLOGUE before Gilgal and replaces the END of CUT v4 (`docs/intro-script-v4.md`).** Gilgal
(G1–G7) and D1–D2 stay as they are (G1 now starts on its shofar blast — see below); `docs/intro-script-v3.md`,
`docs/director-notes-v5.md`, `docs/intro-script-v2.md` and `docs/visual-bible.md` stay binding for everything else.
The timing contract is written in `src/content/introScript.ts` (INTRO_SHOTS) and is FROZEN: build on it.

## The user's requests (2 Oct, verbatim)

> "הייתי שמח שלפני הקטע עם שאול יהיה קטע שמראה על התקופה... משהו שמראה על התקופה בהיסטוריה על המיקום על מה שעם
> ישראל עברו כדי להגיע לשם, נותן שניה כיוון איפה אנחנו נמצאים, לפני כן מה שנתנת זה "הרי יהודה ארץ ישראל בימי שאול
> המלך" ואז בית לחם, עירו של ישי בן עובד ואז הראת את קבר רחל כאילו נתת שניה הצצה אל תוך התקופה ... עזוב את הזמן לא
> משנה אם יהיה יותר ארוך"

and, approving the proposed outline:

> "תלך על נוף תלת מימדי ריאליסטי לגבי סגנון המפה... לגבי קבר רחל אם זה קשור ומתאים תשים אבל שיהיה לפני הסרטון שכרגע
> רץ זה לא אמור להפריד בין הפסוק של קרע ה' את ממלכות ישראל מעליך. כל המטרה של הסרטון שאתה מוסיף עכשיו לפני זה לתת
> מושג כללי. ... בסוף סרטון הנוכחי שזה כמובן גם יהיה הסוף סרטון אחרי השינויים אני צריך איזה שיפור, אמורים לראות את
> דוד רואה את הצאן כמה שניות ולא שזה יהיה כזה קצר כמו עכשיו ... והמצלמה כרגע עושה בסוף סיבוב מוזר מאוד ולא קשור
> לסצנה. אמור להיות כתוב גם משהו על דוד, אחד מהפסוקים מהתנ"ך כדי להכיר את הדמות, ובזמן שהוא רואה את הצאן או רואים
> אותו עושה איזה משהו אצילי כזה יהיה את הכותרת DAVID ואז המצלמה תתרחק קצת או תעשה משהו אחר אבל שמתאים לסיטואציה
> ולא תלוש."

So: (1) a **prologue** before Gilgal that gives a general idea — when, where, and what the people of Israel went
through to get there; the map is a **realistic 3D landscape** (satellite-like), not an illustration; Rachel's tomb
belongs in the prologue, never between the two halves of 1 Sam 15:28 (15:28a at Gilgal → 15:28b over David stays one
breath); length is free. (2) The **end**: David is seen watching his flock for several seconds; a Tanakh verse
introduces him; the DAVID logo appears while he watches the flock or does something noble; then the camera moves
away a little in a way that fits the moment — no strange orbit.

## The cut (written into `src/content/introScript.ts`)

| Shot | Set : take (in) | Start | Dur | Beats | What | Text |
|---|---|---|---|---|---|---|
| **P1** | judah : `flight` (black, hold 3.0, fade 1.6) | 0.0 | 11.0 | timeCard 0.4 · picture 3.0 · card 5.4 | the land of Israel at dawn: out of the sea of clouds, a slow majestic flight over the hills of Judah toward Bethlehem | time card (over black) · person card אֶרֶץ יִשְׂרָאֵל / הָרֵי יְהוּדָה · בִּימֵי שָׁאוּל הַמֶּלֶךְ |
| **P2** | world : `bethlehem` (dissolve 1.0) | 11.0 | 7.0 | card 1.0 · flock 2.2 | Bethlehem on its ridge in the early morning, alive | person card בֵּית לֶחֶם / עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד |
| **P3** | world : `rachel-dawn` (dissolve 0.8) | 18.0 | 6.0 | card 0.6 · verse 1.6 · rise 4.0 | Rachel's tomb by the road to Ephrath; from `rise` the lens climbs into the sky | place קֶבֶר רָחֵל · verse Gen 35:19 |
| **P4** | map : `exodus` (dissolve 1.4) | 24.0 | 13.0 | climb 0 · egypt 3.0 · exodus 3.4 · wilderness 6.0 · jordan 9.0 · gilgal 10.2 | THE REALISTIC 3D MAP: out of Egypt, the wilderness, across the Jordan to Gilgal | lines יְצִיאַת מִצְרַיִם · אַרְבָּעִים שָׁנָה בַּמִּדְבָּר · verse Josh 4:19 |
| **P5** | map : `tribes` (cut — invisible, same camera) | 37.0 | 9.0 | tribes 0.4 · verse 2.6 · cities 6.2 | the tribes in their land; "no king in Israel"; the five Philistine cities glow; the lens descends to the coast | verse Judg 21:25 |
| **P6** | coast : `threat` (dissolve 1.0) | 46.0 | 7.0 | card 0.6 · verse 1.8 | the Philistine host on the coastal plain | place אֶרֶץ פְּלִשְׁתִּים · verse 1 Sam 13:19 |
| **P7** | ramah : `elders` (cut) | 53.0 | 8.0 | card 0.5 · rise 1.6 · verse 2.4 · away 6.0 | the elders at Ramah demand a king; Samuel turns his face away | place הָרָמָה · verse 1 Sam 8:5 |
| G1 | gilgal : `dustWall` (**hard cut on the shofar**) | 61.0 | 4.0 | shofar 0 · horns 0.6 · card 1.3 | the old G1 from its shofar on (TAKE_OFFSET 1.5) | הַגִּלְגָּל |
| G2–G7 | unchanged | 65.0–98.5 | | | Saul, the spear, the silence, the tear, the verdict (15:28a), Saul alone | unchanged |
| D1–D2 | unchanged | 98.5–108.5 | | | 15:28b over David (הַטּוֹב מִמֶּךָּ in gold); his face into the light | unchanged |
| **D3** | world : `watch` (cut) | 108.5 | 8.0 | verse 1.0 · rack 5.2 | David watches his flock | verse Ps 78:70-71 |
| **D4** | world : `horizon` (cut) | 116.5 | 18.0 | lamb 0.3 · descend 1.4 · kneel 4.2 · lift 5.0 · logo 6.6 · hebrew 7.6 · chapter 8.6 · setDown 11.2 · logoOut 12.2 · settle 14.6 | the noble act and the logo; the camera eases back into the game | DAVID · דָּוִד · פֶּרֶק רִאשׁוֹן · הָרֹעֶה |

Score cues: P1 `land` · P2 `bethlehem` · P3 `rachel` · P4 `map` · P5 `judges` · P6 `threat` · P7 `elders` · G1
`shofar` … D3 `watch` · D4 `horizon`. Every performance, camera event and musical hit is keyed to the beats above
(read them from INTRO_SHOTS — never hard-coded seconds).

## The prologue, shot by shot

The prologue is one movement from the present of the story (the land in the days of Saul, Bethlehem, Rachel's tomb)
up into the sky and back through history (the map: Egypt → the wilderness → Gilgal → the Judges → the Philistines)
and down again into the story's crisis (the Philistine host, the elders at Ramah: "give us a king") — then the shofar
of Gilgal. It must feel like the opening of a top game of today: slow, majestic, every frame a painting, nothing
static (if a frame 1 s later looks the same, the shot is wrong), nothing fast (the user: "too fast" was the problem
of CUT v2).

**P1 · the land (judah : flight).** Black; the time card לִפְנֵי כִּשְׁלֹשֶׁת אֲלָפִים שָׁנָה; at `picture` the image
rises out of black: dawn above a sea of clouds, the lens sinks through the deck and the hills of Judah open below —
ridge after ridge in the valley fog, terraces and olive groves on the near slopes, the Dead Sea glinting in the east
and the mountains of Moab beyond. ONE slow, majestic flight (never the racing dive of CUT v2), banking gently from
the sunrise toward the west — toward Bethlehem's ridge — so the dissolve into P2 continues the same flight. The
two-line card (אֶרֶץ יִשְׂרָאֵל · הָרֵי יְהוּדָה · בִּימֵי שָׁאוּל הַמֶּלֶךְ) in the sky.

**P2 · Bethlehem (world : bethlehem).** The chapter's own town on its ridge in the early light: stone houses with flat
roofs, courtyards, threshing floors, terraces with vines and olives on the slopes below, smoke rising from a few roofs
(morning fires), a slow aerial drift toward the village; from `flock` a shepherd leads a flock out along the terraces
(small in the frame — not David: he is introduced later). Alive, peaceful, the light warming. The Bethlehem of Iron
Age I–IIA: a village of a few dozen four-room houses — no walls of a city, no towers, no church, no modern buildings.

**P3 · Rachel's tomb (world : rachel-dawn).** Jacob's standing stone on Rachel's grave (Gen 35:20 "מַצֶּבֶת
קְבֻרַת־רָחֵל") by the road to Ephrath, which is Bethlehem (Gen 35:19 — the verse on screen); the flock and the
shepherd pass behind it (seen, not hidden by bushes), grass and branches in the wind, a low dolly toward the stone;
from `rise` the lens lifts away and climbs into the sky over the road and the hills, looking down — the dissolve into
the map continues the climb. No dome, no building: a single standing stone (a maṣṣebah) and a few field stones.

**P4 · the map: out of Egypt to Gilgal (map : exodus).** THE REALISTIC 3D MAP (the user chose it): the real land seen
from very high, like a satellite view in the first light — real elevation and real natural colour, NOT an illustrated
map, no parchment, no drawn coastlines, no modern borders, cities, roads, canals, fields or reservoirs (it is the land
of ~1000 BCE: no Suez Canal, the Hula lake still a lake, the Dead Sea higher (≈-400 m) with its southern basin under
water, the Nile delta green). The camera continues P3's climb from above Bethlehem up to the whole region (by `egypt`,
3.0 s: the Nile delta, the Great Sea, the wilderness, the Dead Sea and the Jordan valley, the hills of the land) in one
continuous, slow, grand move (a log-height climb, never a jump). At `exodus` a line of light starts in the eastern
delta (רַעְמְסֵס, Ex 12:37) and draws the way out of Egypt into the wilderness; at `wilderness` it wanders (forty years:
loops and long stays — Kadesh, Deut 1:46), then goes around the land of Edom (Num 21:4), up to the plains of Moab
(Num 22:1), at `jordan` crosses the Jordan opposite Jericho (Josh 3:16) and at `gilgal` ends at Gilgal (Josh 4:19 — the
verse) in a soft glow. Place names in biblical Hebrew appear on the land as the line reaches them (small, the film's
typography, legible on a phone). The line is a glowing ribbon draped on the terrain with a bright head and a fading
tail — elegant, not a GPS track. No specific mountain is marked as Sinai; no specific point is marked as the crossing
of the sea (the sources do not fix them).

**P5 · the map: the tribes and the Philistines (map : tribes).** The same camera continues (the cut is invisible): the
lens comes lower over the land of Israel; at `tribes` the names of the tribes appear over their lands (Asher,
Naphtali, Zebulun, Issachar, Manasseh on both sides of the Jordan, Ephraim, Benjamin, Judah, Simeon, Dan in the north,
Reuben, Gad — Joshua 13–19 and Judges 18; soft, without hard borders); at `verse` "בַּיָּמִים הָהֵם אֵין מֶלֶךְ
בְּיִשְׂרָאֵל" (Judg 21:25); at `cities` the five Philistine cities glow on the coastal plain — עַזָּה, אַשְׁקְלוֹן,
אַשְׁדּוֹד, גַּת, עֶקְרוֹן (1 Sam 6:17) — and the lens starts down toward Ashdod's coast, where P6 dissolves in.

**P6 · the Philistine host (coast : threat).** The host on the coastal plain near Ashdod, the sea beyond: a column
marching inland, bronze helmets and spear points glinting, dust in the low sun, kilts, round shields, the
feather/reed-crown headdress of the rank and file (visual-bible §3.9). Menace and power — iron that Israel does not
have (13:19 on screen). Continue the map's descent in feeling: a long, slow, majestic move (e.g. a high wide move that
sinks toward the column, or a long-lens lateral track beside it — the cinematographer chooses, keyed to `verse`),
never locked, never a "crowd-simulation demo" (director-notes-v5 P4).

**P7 · Ramah (ramah : elders).** "וַיִּתְקַבְּצוּ כֹּל זִקְנֵי יִשְׂרָאֵל וַיָּבֹאוּ אֶל־שְׁמוּאֵל הָרָמָתָה" (8:4): 8–12
elders (grey and white beards, mantles of undyed wool, brown and dark, head-cloths, staffs) in a loose arc before
Samuel in the gateway; a slow low dolly through the group; real faces in the near foreground (the near LOD — never a
blob); at `rise` the speaking elder rises and lifts his arm, at `verse` "שִׂימָה־לָּנוּ מֶלֶךְ לְשָׁפְטֵנוּ כְּכָל־הַגּוֹיִם"
(8:5), others turn to each other and nod; at `away` Samuel turns his face away (8:6 "וַיֵּרַע הַדָּבָר בְּעֵינֵי
שְׁמוּאֵל"). The gate: wooden doors standing open, a lintel beam, the passage in shade, the light of late afternoon.
The quality bar is the Gilgal set (the people as real as Saul and Samuel there). Then the HARD CUT on the shofar.

**G1 · Gilgal.** Exactly the old G1 from its shofar on: shot time 0 = old 1.5 s (FilmCams TAKE_OFFSET `dustWall`
1.5; the army's blocking, the horns and the camera run on the old clock).

## The end, shot by shot

**D3 · David watches his flock (world : watch, 8 s).** What he sees (the user: "David must be seen watching his flock
for a few seconds"): over his shoulder from behind and a little above, the flock grazing on the slope below him —
ewes and lambs, a lamb nursing, the rams, a goat on a rock — close enough to read every animal, in the warm low
light; he watches them, calm, the wind in his curls; a slow drift (never an orbit); at `rack` the focus racks from the
flock back to him. Psalm 78:70-71 writes itself in the sky ("וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת
צֹאן…") — the verse that tells who he is: chosen from the sheepfolds to shepherd Jacob his people.

**D4 · the lamb and the logo (world : horizon, 18 s, ONE long take).** The noble act (the user: "something noble"): a
newborn lamb has fallen behind on the rocks below him and bleats for its mother (`lamb`); David steps down to it
(`descend`), kneels (`kneel`) and gathers it into his arms (`lift`) — "בִּזְרֹעוֹ יְקַבֵּץ טְלָאִים וּבְחֵיקוֹ יִשָּׂא"
(Isa 40:11); the spirit of Shemot Rabbah 2:2 on Ps 78:70 (the shepherd who gives each lamb according to its strength
— the midrash already quoted in the chapter). He carries it down to the ewe; while he walks with the lamb in his arms
the logo forms in the sky: **DAVID** at `logo`, **דָּוִד** beneath at `hebrew`, the rule and *פֶּרֶק רִאשׁוֹן · הָרֹעֶה* at
`chapter` (the CUT v4 lockup: Cinzel gold metal forming from light, Frank Ruhl Libre gold; over the picture with a
soft glow, never a black card). At `setDown` he sets the lamb down by its mother — it runs to her and nurses — and he
straightens, looking over the flock; at `logoOut` the lockup fades; from `settle` the camera eases BACK and a little
DOWN behind him — a pull-back and a gentle descent with the yaw almost unchanged, NO orbit — and lands exactly on the
gameplay camera behind David at 18.0: the letterbox retracts, the game begins without a cut. The lens follows the
action at a respectful distance throughout, slow and steady, motivated by David's walk (it may track and pan with
him, never circle him).

**The hand-off into the game.** David ends among his flock (the ewe and the lamb at his side, the flock grazing
around); the first objective is adapted (he is already with the flock: the chapter goes on with what follows; no
objective that is already fulfilled).

## Text

Only the text events of INTRO_SHOTS (20). Narration lines come from `src/content/introNarration.ts` (pointed, never in
quotation marks, never styled as verses); verses only through the catalog `src/content/sources.ts` (verseArgs /
quoteText / sourceRef) — `python3 tools/sources/verify_sources.py --quiet` must exit 0. Map labels (place names,
tribes, cities) are pointed biblical names from a verified list (`src/content/mapNames.ts`, each with the verse it is
taken from). Every text sits in the composition's negative space (never across a face or a body), legible on a phone
held upright (390×844) and sideways (844×390).

## Sound

The prologue's music (score6): out of silence under the time card, a low drone and wind; the land theme rising with
the picture (P1); Bethlehem pastoral — the pipe, a few sheep bells, a distant voice (P2); a tender, ancient line for
Rachel (P3); a processional that grows with the line of light across the map — the exodus, the wilderness (sparser,
the wind), the crossing and Gilgal (an arrival) (P4); darker, unsettled under "no king in Israel", a menace entering
with the Philistine cities (P5); war drums and brass-like low horns under the host (P6); the elders' murmur and a
tense, unresolved chord (P7) — and the shofar of Gilgal as the hard cut's hit (G1). The end: David's theme (D1–D2) into
the flock-watching (D3: warm, intimate, the kinnor and the pipe, sheep bells), the lamb's bleat as the cue of D4, the
theme growing while he carries it, the logo's warm, majestic arrival (not a smash) on `logo`, the answer under the
Hebrew and the chapter line, and the flow into the game's pastoral music at the hand-off — no silence, no seam.

## Loading (the user: "the loading must run faster without harming the graphics")

The prologue adds four sets (judah, the map, coast, ramah) — they must NOT make the wait longer. Every set is built
from small, yielding steps (no step blocks the main thread for long), lazily imported, disposed when the film leaves
it, and reports its build time per tier; the film starts as soon as the sets of its first shots are ready while the
later sets (the map, coast, ramah, Gilgal) build in the background during the prologue (the loading wave makes this
progressive; the set builders must allow it). The map's assets are small (compressed imagery and elevation sized per
tier).

## Phones

Same cut on every device. Portrait (390×844) and landscape (844×390) framings for every new shot (portraitLens where
a subject must stay in frame); budgets per tier as before (8M / 5M / 2.5M / 1.5M triangles per frame incl. shadows);
the map light on mobile-low.
