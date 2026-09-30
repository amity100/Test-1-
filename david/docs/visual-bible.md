# DAVID — visual bible for the opening film "הַטּוֹב מִמֶּךָּ"

Owner: the sources teammate (`bible`). **Binding** for every character, costume, prop, place, light and sound
in the opening film (`docs/intro-script.md`). If something you are building is not covered here, ask / check
before inventing it. Every verse quoted below is checked by `tools/sources/verify_sources.py` against the
Miqra according to the Masorah text (Aleppo Codex); rabbinic texts are quoted from the Sefaria editions listed in
`docs/sources.md` §1.1.

Legend used in every section:

* **[TEXT]** — the Hebrew Bible says it. Not negotiable.
* **[CHAZAL]** — Talmud / Midrash / Targum / classical commentators (Rashi, Radak, Metzudat David, Ralbag).
  Followed unless marked otherwise.
* **[ARCH]** — Iron Age I–IIA archaeology of the southern Levant (≈1050–950 BCE) where the sources are silent.
  Conjecture, but the best available; say "reconstruction" if anyone asks.
* **[DECISION]** — our binding art-direction choice where everything above is silent or divided.
* **MUST / MUST-NOT** — checklists for modelers, costume, animation, lighting and sound.

---

## 1. Shot → text mapping (on-screen texts of the film)

Quotations appear on screen **only** through the catalog `src/content/sources.ts`
(`quoteText(id)`, `sourceRef(id)`, `verseArgs(id)`, `quoteWithRefHtml(id)`). Narration (non-quotation) lines come
**only** from `src/content/introNarration.ts` (`INTRO_NARRATION[id].text`) and must never be styled as a verse,
put in quotation marks or given a reference.

**CUT v2 (58 s, `docs/intro-script-v2.md`; cut3, 30 Sep):** only these 11 text events. The rough cut's lines
(the tribes line, Gen 35:19, 14:52, 14:47, 15:27, 13:14, 16:11, 16:12 and the film's name on the title card) are
dropped. Shot ids and timing: `src/content/introScript.ts`.

| Shot | On screen | Kind | Id |
|---|---|---|---|
| P1 (0.3 s, over black into the clouds) | לִפְנֵי כִּשְׁלֹשֶׁת אֲלָפִים שָׁנָה | narration (time card) | `INTRO_NARRATION.timeCard` |
| P3 | קֶבֶר רָחֵל | narration (place card) | `INTRO_NARRATION.rachelTomb` |
| P5 | 1 Sam 8:5 (the elders' demand) | quotation | `s1_8_5_give_us_king` |
| G1 | הַגִּלְגָּל | narration (place card) | `INTRO_NARRATION.gilgal` |
| G2 | שָׁאוּל · מֶלֶךְ יִשְׂרָאֵל | narration (person card: the name, the title under it) | `INTRO_NARRATION.saulShort` + `saulTitle` |
| G3 | 1 Sam 9:2 (end of verse) | quotation | `s1_9_2_head_above` |
| G4 | שְׁמוּאֵל | narration (person card) | `INTRO_NARRATION.samuel` |
| G6 | 1 Sam 15:28, first half (Samuel speaks it; word by word with his lips) | quotation | `s1_15_28_torn_today` |
| D1 | 1 Sam 15:28, second half (writes itself over David) | quotation | `s1_15_28_to_your_neighbor` |
| D2 | 1 Sam 16:7 (end of verse) | quotation | `s1_16_7_looks_heart` |
| T | DAVID · דָּוִד · פֶּרֶק רִאשׁוֹן · הָרֹעֶה | narration (title + chapter card) | `davidLogo`, `davidName`, `chapterTitle` |

Exact texts (all verified, catalog = source of truth):

* P5 — "שִׂימָה־לָּנוּ מֶלֶךְ לְשָׁפְטֵנוּ כְּכָל־הַגּוֹיִם" (1 Sam 8:5)
* G3 — "מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם" (1 Sam 9:2)
* G6 — "קָרַע ה׳ אֶת־מַמְלְכוּת יִשְׂרָאֵל מֵעָלֶיךָ הַיּוֹם" (1 Sam 15:28)
* D1 — "וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ" (1 Sam 15:28)
* D2 — "כִּי הָאָדָם יִרְאֶה לַעֵינַיִם וַה׳ יִרְאֶה לַלֵּבָב" (1 Sam 16:7)

Context notes the film must respect (they are why each line is shown *with its reference*):

* 15:28 is split across the cut G6 -> D1. The first half is Samuel's verdict to Saul at Gilgal; it fades out with
  Samuel. The second half is shown over David because Metzudat David on 15:28 reads "to your neighbour" as David
  (`metz_s1_15_28_neighbor`). Both halves carry the verse reference.
* 8:5 is the elders' demand at Ramah (8:4-5), years before Gilgal; Samuel's displeasure is 8:6 (he turns his face
  away in P5).
* 16:7 is God's word to Samuel about Eliab (Radak 16:7 cites "some explain" that it also alludes to tall, handsome
  Saul — `radak_s1_16_7_saul`). Never caption it as "said about Saul" or "said about this moment".

### 1.1 Cast at a glance (details and sources in §3)

| Who | Shots | Looks like (age) | Height | Hair / beard | Wears | Carries |
|---|---|---|---|---|---|---|
| **Samuel** | 5, 9–11 | ≈70 (really ≈51: "old age sprang upon him", Taanit 5b) | ≈1.65 m | uncut since birth: long loose grey-white hair to mid-back; long full grey-white beard | ankle tunic (light undyed wool) + **me'il**: dark undyed wool wrap-mantle, tzitzit with a tekhelet thread at 4 corners; sandals | nothing (no staff, no horn) |
| **Saul** | 7–12 | 50–55, at his peak | **≈2.00–2.05 m** | dark brown-black to the shoulders, full 6–10 cm beard, grey threads | crimson tunic, **bronze scale coat** to mid-thigh, belt + straight sword, **gold nezer band** on the bare head, **gold armlet** (left upper arm), sandals | **spear** (iron head, butt-spike) in the right hand, **bronze helmet** under the left arm |
| Armour-bearer | 7–10 | ≈20 | ≈1.68 m | short beard | undyed tunic, belt | Saul's round **oiled-leather shield**, javelins |
| Israelite soldiers | 6–10 | 20–50 | ≈1.60–1.75 m | full beards, hair to nape/shoulders, some head-cloths | knee tunics of undyed wool, belts, sandals/barefoot; almost no armour | spears, slings, bows, a few swords/axes, round leather shields; rams' horns |
| Elders | 5 (and a few at Gilgal) | 50–75 | ≈1.65 m | long grey/white beards | long tunic + wool mantle with tzitzit; head bare / headband / head-cloth | walking staffs |
| Philistines | 4 | 20–40 | ≈1.65–1.75 m | **clean-shaven** | elite: bronze helmets, scale/banded corselets, **greaves**; others: reed/feather headdress, kilts | round shields, straight long swords, spears; chariots only far away |
| **David** | 15–17, 21 | ≈17 youth | ≈1.70 m | sun-lightened copper curls, SHORT-to-medium exactly as the reference (to the nape, ear lobes visible — never long); no real beard | coarse undyed tunic, sash, shepherd's bag | staff, sling |
| Bear | 19 | adult Syrian brown bear | — | straw/golden-tan coat | — | eyes: faint amber shine only |

---

## 2. Palette and materials (use these values)

| Material | Where | Colour (linear-ish sRGB hex, base albedo) | Notes |
|---|---|---|---|
| Undyed sheep wool, light | tunics, most garments | `#cdbf9f` → `#b9a887` | never pure white; slightly uneven, felted |
| Undyed wool, dark (brown/black sheep, goat) | Samuel's me'il, some mantles | `#5e5143` → `#74644f` | matte, heavy drape, fuzzy edges |
| Linen (bleached in sun) | under-tunics of the rich | `#e2dac8` | crisp creases, slight sheen |
| Tekhelet thread (murex blue) | one thread in every tzitzit | `#2f4c8f` (sky-blue ↔ blue-violet) | "דומה לים וים דומה לרקיע" — like the sea, which is like the sky (Sotah 17a) |
| Tola'at shani (kermes crimson) | Saul's tunic (madim) | `#8a1c20` (sun-faded edges `#9c3a30`) | the royal colour Saul gave (2 Sam 1:24) |
| Madder red / ochre | stripes/bands on some commoners' clothes | `#9a4a2c`, `#a7773a` | small areas only |
| Gold (high purity, hammered) | nezer, armlet | `#d6a743`, metalness 1, roughness 0.25–0.35 | soft warm yellow, not orange, no gems |
| Bronze, polished | Saul's helmet & scales | `#b8773c`, metalness 1, roughness 0.3 | warm gold-brown; darker in overlaps |
| Bronze, field | soldiers' spearheads, Philistine gear | `#8c5e33` + patina `#56745b` in crevices | dull, scratched |
| Iron (forged, 11th c.) | some blades/spearheads | `#4b4a48`, roughness 0.55 | dark grey, rust bloom `#6b3f25` at edges |
| Leather, oiled | shields, belts, scabbards, sandals | `#5a3a22` shield face with oily sheen (roughness 0.35) | Rashi 2 Sam 1:21 — shields were oiled |
| Judean limestone | Rachel's pillar, Ramah, Bethlehem | `#cfc2a4` weathering to `#a99c80`, lichen-free in the valley | pitted, karst-worn |
| Lisan marl (Jordan valley) | Gilgal ground | `#d8cfbb` pale grey-cream; dust `#cbbd9c` | powdery, crumbly badlands |

---

## 3. The elements

### 3.0 Rules for every Israelite man on screen

* [TEXT] **Beards:** adult men keep full beards and do not round off the hair at the temples — "לֹא תַקִּפוּ פְּאַת
  רֹאשְׁכֶם וְלֹא תַשְׁחִית אֵת פְּאַת זְקָנֶךָ" (Lev 19:27). No shaved faces, no undercuts, no trimmed "corners"; no
  hasidic sidelocks either (a later custom) — just natural hair continuing into the beard.
* [TEXT] **No sha'atnez:** a garment is wool **or** linen, never both (Deut 22:11). Keep materials per garment
  pure (the one sanctioned exception, a wool tekhelet thread in linen tzitzit, is not needed: make mantles wool).
* [TEXT] **Tzitzit** only on a garment **with four corners** (Num 15:38; Deut 22:12 "עַל־אַרְבַּע כַּנְפוֹת כְּסוּתְךָ"): the
  wrapped mantle/me'il has them, a sewn tunic does not. Form [CHAZAL, later halakhic detail; any simple version is
  acceptable]: a tassel of four strings passed through a hole ≈3–5 cm from the corner and folded (eight hanging
  ends), 15–25 cm long, a knot and a few windings at the top; **one string tekhelet** (`#2f4c8f`), the rest
  undyed/white.
* [TEXT] Sandals of leather (נַעַל); walking barefoot is normal for the poor and for shepherds on grass.
* [ARCH] Men's garments: a sewn tunic (כֻּתֹּנֶת) to the knee (work/war) or to the shins/ankles (elders,
  dignitaries), a belt/girdle (חֲגוֹרָה / אֵזוֹר), and for dignity or cold a wrapped mantle (שִׂמְלָה; for the great a
  מְעִיל). Colours mostly undyed; dyes are costly and mark rank (crimson, murex purple and blue for the king's
  circle — 2 Sam 1:24; Timna murex-purple wool ≈1000 BCE).
* No sewn trousers, no buttons, no zips/pins of modern shape, no hats with brims.

### 3.1 SAMUEL (shots 5, 9, 10, 11)

**Sources**

* [TEXT] A Nazirite from birth by his mother's vow — "וּמוֹרָה לֹא־יַעֲלֶה עַל־רֹאשׁוֹ" (1 Sam 1:11): no razor
  ever touched his head. The Nazirite's hair is left to grow loose: "גַּדֵּל פֶּרַע שְׂעַר רֹאשׁוֹ" (Num 6:5).
* [CHAZAL] "נזיר היה שמואל, כדברי רבי נהוראי" (Mishnah Nazir 9:5). **Honest flag:** R. Yose there reads
  מוֹרָה as "fear of man"; R. Nehorai answers him and the Mishnah closes with R. Nehorai. We follow the plain
  sense of 1:11 and R. Nehorai. `mnazir_9_5_samuel_nazir`
* [TEXT] Old and grey: "וַאֲנִי זָקַנְתִּי וָשַׂבְתִּי" (1 Sam 12:2); "וַיְהִי כַּאֲשֶׁר זָקֵן שְׁמוּאֵל" (1 Sam 8:1);
  the elders to him: "הִנֵּה אַתָּה זָקַנְתָּ" (1 Sam 8:5).
* [CHAZAL] **His real age.** Samuel lived only 52 years (Taanit 5b; Moed Katan 28a; Seder Olam 13). The
  Talmud asks how he could be called old, and answers "זקנה קפצה עליו" — **old age sprang upon him** — citing
  15:11 ("I regret that I made Saul king"), i.e. exactly the night before Gilgal (Taanit 5b, R. Yochanan).
  `taan_5b_samuel_52`, `taan_5b_old_age_sprang`. At Gilgal he is ≈51 by years; **he must look ≈70.**
* [TEXT] The night before Gilgal: "וַיִּחַר לִשְׁמוּאֵל וַיִּזְעַק אֶל־ה׳ כָּל־הַלָּיְלָה" (1 Sam 15:11) — he cried out
  all night; next morning "וַיַּשְׁכֵּם שְׁמוּאֵל לִקְרַאת שָׁאוּל בַּבֹּקֶר" (15:12). After Gilgal he mourned for Saul
  (15:35). → **Exhausted, red-rimmed eyes, grief, iron resolve.** Not anger, not triumph.
* [TEXT] His garment is a **me'il**: his mother made him "וּמְעִיל קָטֹן" every year (2:19); Saul grasps
  "בִּכְנַף־מְעִילוֹ" (15:27); even at En-dor he is recognised by it: "אִישׁ זָקֵן עֹלֶה וְהוּא עֹטֶה מְעִיל"
  (28:14).
* [CHAZAL] Radak on 2:19: it was not their custom for anyone but "the great" to wrap in a me'il; Metzudat David
  on 28:14: "a garment special to a great and important person"; Rashi on 28:14: "he was accustomed to wear a
  me'il … and was buried in his me'il". `radak_s1_2_19_meil_great`, `rashi_s1_28_14_meil`
* [TEXT] עֹטֶה = *wrapped* (a wrap-mantle, not a pull-over robe). A wrapped rectangular mantle has four
  corners (כְּנָפוֹת) → by Torah law it carries **tzitzit** with a tekhelet thread (Num 15:38; Deut 22:12). The
  word Saul grabs, כָּנָף, is the very word of the tzitzit law ("עַל־כַּנְפֵי בִגְדֵיהֶם").

**MUST**

* Man of average height, **≈1.65 m** (Saul must tower over him: his eye line reaches Saul's collarbone).
* Looks ≈70: deeply lined, lean, sun-weathered olive skin, prominent cheekbones, heavy brows; **eyes alive and
  piercing**, lids heavy and red-rimmed (a night of crying out).
* **Hair: uncut since birth** — very long, thick, grey-white (a few darker iron-grey strands at the nape), loose
  (פֶּרַע), falling over the shoulders to mid-back, pushed back from the face, a little wind-tossed. Not braided,
  not tied, no bun.
* **Beard:** full, long (to mid-chest), grey-white, untrimmed at the corners (Lev 19:27), moustache full.
* **Garments:** (1) long tunic (kutonet) to the ankles, undyed light wool `#cdbf9f`, long sleeves;
  (2) **the me'il**: a large, heavy **undyed dark wool** wrap-mantle `#5e5143`–`#74644f`, ankle length,
  wrapped around the body and over both shoulders (one end thrown over the left shoulder), a plain woven border
  band near the hem; **tzitzit at the four corners** — white/undyed strings with **one tekhelet thread**
  `#2f4c8f`; (3) cloth or cord belt; (4) plain leather sandals, dusty from the road down from Ramah.
* Head **uncovered** (the Nazirite hair is his identifying mark).
* Posture: upright, still, economical movement; walks slowly and does not step aside.
* Demeanour at the verdict: quiet, grieving, final (15:35 "כִּי־הִתְאַבֵּל שְׁמוּאֵל אֶל־שָׁאוּל").

**MUST-NOT**

* No staff in Act I (a white-bearded old man with a tall staff reads "wizard"); never a raised hand casting
  anything, never glowing, never a halo.
* **Not the High Priest's me'il** (all tekhelet, with pomegranates and golden bells — Exod 28:31–35); no ephod,
  no breastplate, no priestly headdress. Samuel is a Levite prophet-judge, not the High Priest.
* No horn of oil (that is 16:1, 16:13 — chapter 2).
* No turban, no hood, no kippah, no striped tallit (black stripes are modern), no jewellery, no rope belt of a
  monk, no sackcloth.
* No cut/trimmed hair line, no bald crown.

### 3.2 SAUL at Gilgal after the war with Amalek (shots 6–12)

**Sources — look**

* [TEXT] "בָּחוּר וָטוֹב וְאֵין אִישׁ מִבְּנֵי יִשְׂרָאֵל טוֹב מִמֶּנּוּ מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם" (1 Sam 9:2);
  "וַיִּגְבַּהּ מִכָּל־הָעָם מִשִּׁכְמוֹ וָמָעְלָה" (10:23); "כִּי אֵין כָּמֹהוּ בְּכָל־הָעָם" (10:24).
* [CHAZAL] Radak 9:2: טוֹב = good *in form and appearance* (Targum "שפיר"); Metzudat David: "chosen in his deeds
  and handsome". Berakhot 48b (Shmuel): the maidens of 9:11–13 spoke at length "כדי להסתכל ביפיו של שאול" — to
  gaze at Saul's beauty. `ber_48b_saul_beauty`
* [CHAZAL] Radak on 17:42: a man who goes to war "loses his beauty" from toil, cold, rain and heat. → Saul is
  handsome **and** campaign-weathered (the contrast with David's fresh face in Act II).
* [TEXT] Torah grooming: "וְלֹא תַשְׁחִית אֵת פְּאַת זְקָנֶךָ" (Lev 19:27) — full beard, sides of the head not
  rounded off.

**Sources — age** ([DECISION] **he looks 50–55**, vigorous)

* 13:1 is cryptic; the Talmud reads "בן שנה" morally — "like a one-year-old who has not tasted sin" (Yoma 22b;
  Rashi, Radak 13:1) — it says nothing about his physical age.
* Seder Olam 13: the events of chapter 15 and David's anointing fall in **Saul's second year**.
* [TEXT] Yet his son **Jonathan is already a commander of a thousand** (13:2) and a seasoned warrior (ch. 14),
  so Saul is at least ~40 at the start of the reign; and his son Ish-boshet — listed fourth (1 Chr 8:33) — was
  **40 when Saul died** (2 Sam 2:10). By the text's own arithmetic Saul at Gilgal is **50 or more** (on Seder
  Olam's short reign, nearer 60).
* We show him at the vigorous end of that range: a powerful, mature king at his peak — not a young man, not an
  old one. (Paradox to respect: Samuel is about the same age in years but must look ~15 years older — Taanit 5b.)

**Sources — war gear** (Saul's own kit, named when he lends it to David, 17:38–39)

* [TEXT] "וַיַּלְבֵּשׁ שָׁאוּל אֶת־דָּוִד מַדָּיו וְנָתַן קוֹבַע נְחֹשֶׁת עַל־רֹאשׁוֹ וַיַּלְבֵּשׁ אֹתוֹ שִׁרְיוֹן" (17:38) and
  a sword girded "מֵעַל לְמַדָּיו" — over the garment (17:39). No greaves, no shield named for him there.
* [TEXT] The type of שִׁרְיוֹן is defined by Goliath's: "וְשִׁרְיוֹן קַשְׂקַשִּׂים הוּא לָבוּשׁ" (17:5) — **scale**
  armour (קַשְׂקַשִּׂים = fish-scales). Never chain mail.
* [TEXT] In his last battle he wore "הַנֵּזֶר אֲשֶׁר עַל־רֹאשׁוֹ וְאֶצְעָדָה אֲשֶׁר עַל־זְרֹעוֹ" (2 Sam 1:10) — a
  diadem-band and an armlet, **worn even in battle**. Rashi: אֶצְעָדָה = Targum "טוטפתא דעל דרעיה", a band on the
  arm.
* [TEXT] The spear is his constant attribute (18:10, 19:9, 22:6); it has a butt that can be stuck into the
  ground: "וַחֲנִיתוֹ מְעוּכָה־בָאָרֶץ מְרַאֲשֹׁתָיו" (26:7) → **metal butt-spike**.
* [TEXT] Swords and spears were rare in Israel (13:19–22) but "וַתִּמָּצֵא לְשָׁאוּל וּלְיוֹנָתָן בְּנוֹ" — Saul had
  both. His sword: "וְחֶרֶב שָׁאוּל לֹא תָשׁוּב רֵיקָם" (2 Sam 1:22).
* [TEXT] His shield: "מָגֵן שָׁאוּל בְּלִי מָשִׁיחַ בַּשָּׁמֶן" (2 Sam 1:21). Rashi: "מגיני עור היו להם, וכשיוצאים
  למלחמה מושחין אותן בשמן" — leather shields, oiled before battle so blows slide off. `rashi_s2_1_21_leather_shields`
* [TEXT] He had an armour-bearer: "הַנַּעַר נֹשֵׂא כֵלָיו" (14:1 of Jonathan; 31:4 of Saul).
* [TEXT] Royal colours: "הַמַּלְבִּשְׁכֶם שָׁנִי עִם־עֲדָנִים" (2 Sam 1:24) — Saul dressed the daughters of Israel
  in scarlet and gold.

**MUST**

* **Height ≈2.00–2.05 m** against a crowd average of ≈1.66 m ([ARCH] Iron Age Levantine male stature): his
  shoulders are at the others' head height — "head and shoulders" literally. Broad shoulders, deep chest, long
  powerful limbs, athletic mass (not fat, not bodybuilder-cut).
* Face: strikingly handsome — strong regular features, straight nose, deep-set dark eyes, high cheekbones,
  strong jaw under the beard; tanned, sun-creased at the eyes; a few old scars allowed (small, on hands/forearms).
* **Hair:** thick, dark brown-black, slightly wavy, to the base of the neck / top of the shoulders, pushed back;
  hair continuous from the temples into the beard (no shaved sides). **Beard:** full, dense, 6–10 cm, natural
  (not Assyrian-curled), with **grey threads at the chin and a few at the temples**.
* **Nezer:** a narrow band of hammered gold, 1.5–2.5 cm high, around the head above the brow (on the bare head —
  the helmet is under his arm); may carry one small lozenge/rosette plaque at the front (existing wardrobe
  `headRing` is correct); tied/closed at the back.
* **Etz'adah:** a broad gold armlet (3–5 cm) on the upper arm (text does not say which; the existing wardrobe has
  it on the **left** — keep it there; it must read clearly in shots 7–8, above the helmet carried on that side).
* **Madim (tunic):** knee-length, short-sleeved, **kermes crimson** `#8a1c20`, sweat-darkened and sun-faded, under
  the armour; the sleeves and hem show below the scales.
* **Shiryon (scale coat):** bronze scales, each ≈5–7 cm × 2.5–3 cm, rounded lower end, a raised central rib,
  4–6 lacing holes at the top, laced in **horizontal rows onto a leather/linen backing, each row overlapping the
  one below (scales point down, like roof tiles/fish scales)**; coat from the neck to mid-thigh, short sleeves or
  shoulder-pieces of scales, leather edging at neck, armholes and hem; belted at the waist. Polished warm bronze
  with darker overlaps and dust in the rows; dented and scratched after a campaign. [ARCH] Late Bronze/Iron Age
  scales from Nuzi, Megiddo, Lachish and Egyptian depictions of Syro-Canaanite coats.
* **Helmet (קוֹבַע נְחֹשֶׁת):** carried **under the left arm**; a plain hammered bronze skull-cap, rounded to
  slightly conical (a low point or small knob at the crown), with a rolled rim band and small rivets for a
  leather lining; optional small leather cheek-flaps. [ARCH] (no Levantine helmet of ≈1000 BCE survives
  complete; Assyrian conical helmets are the nearest later parallel.)
* **Spear (חֲנִית):** ≈2.3–2.5 m wooden shaft (dark oiled ash/oak), socketed **leaf-shaped iron head** 25–30 cm,
  and a **metal butt-spike** (26:7). Held in the right hand.
* **Sword:** straight, double-edged, 55–65 cm blade (iron or bronze), simple hilt with rivets, in a
  leather-over-wood scabbard hanging at the left hip from the belt (girded over the madim).
* **Shield:** round, ≈60–70 cm, **oiled leather** over a wooden/wicker frame, dark brown with an oily sheen,
  carried by his **armour-bearer** one step behind him (not by Saul in these shots).
* **Sandals:** strong leather sandals with straps to the ankle; dust to the shins.

**MUST-NOT**

* No crown with points, no jewels, no fur, no cape/cloak with clasp (Roman/medieval), no purple velvet.
* **No chain mail** ("coat of mail" in English Bibles is misleading), no plate armour, no Roman lorica, no Greek
  muscle cuirass, no greaves for Saul (greaves are Goliath's, 17:6).
* No Greek/Corinthian/Roman helmet, **no crest, plume, horns or nasal bar**.
* No sickle-sword (khopesh — Late Bronze Age Egyptian), no curved sword, no medieval cross-guard.
* No horse, no chariot, no throne on the field. No evil-spirit behaviour (madness, seizures) — that is 16:14, after
  the anointing.

### 3.3 THE TEARING (shots 10–12)

* [TEXT] "וַיִּסֹּב שְׁמוּאֵל לָלֶכֶת וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ וַיִּקָּרַע" (15:27).
* [CHAZAL] Plain sense — Rashi ("לפי פשוטו … אחז שאול בכנף של שמואל"), Radak, Metzudat David ("שאול אחז בכנף
  מעיל שמואל למנעו מללכת מעמו, ובהאחזו בו, נקרע הכנף"): **Saul grabbed the corner of Samuel's me'il and it
  tore.** Midrash Shmuel 18 records a dispute (Rav and Levi) and concludes "ומסתברא כמאן דאמר כנף מעילו של
  שמואל". (Midrash Tehillim 57 gives the other view, that Samuel tore Saul's robe as a sign — **not** our
  version.)
* [DECISION] Choreography: Samuel **turns away to leave** (וַיִּסֹּב … לָלֶכֶת); Saul, from behind/side, seizes the
  **lower corner (כָּנָף) of the me'il** to hold him back; Samuel keeps walking one step — the wool tears.
* **Physics of the tear:** hand-woven wool tears **along the weave** (a straight-ish, stepped line), with fuzzy,
  frayed fibres and individual threads snapping, not a clean cut; the torn piece ≈25–35 cm, the corner **with its
  tzitzit** (tekhelet thread visible) ends in Saul's fist. Backlit lint/dust in the air. Sound: a dry, fibrous rip
  (wool, not silk or paper).
* [DECISION] Saul keeping the piece (shot 12) is a cinematic inference (the text only says it tore while he held
  it) — allowed.
* Saul's acting at this moment (15:24–30): he has just admitted "חָטָאתִי" and begged Samuel to return; the grab is
  desperation, not violence. Samuel does not strike or push him.

### 3.4 THE ARMY of Israel returning to Gilgal (shots 6–9)

**Sources**

* [TEXT] Mustered on foot: "מָאתַיִם אֶלֶף רַגְלִי וַעֲשֶׂרֶת אֲלָפִים אֶת־אִישׁ יְהוּדָה" (15:4). No horses or
  chariots for Israel anywhere in Saul's story (the "manner of the king" in 8:11 is a warning, not a description).
* [TEXT] Signal instrument: the **shofar** — "וְשָׁאוּל תָּקַע בַּשּׁוֹפָר בְּכָל־הָאָרֶץ" (13:3).
* [TEXT] Weapons: spears and swords scarce early in the reign (13:19–22); farm iron in use (ploughshares, axes,
  goads, 13:20–21); after the victories of 14:47–48 more captured weapons. Benjaminite **archers and slingers**,
  ambidextrous: "נֹשְׁקֵי קֶשֶׁת מַיְמִינִים וּמַשְׂמִאלִים בָּאֲבָנִים וּבַחִצִּים בַּקָּשֶׁת מֵאֲחֵי שָׁאוּל מִבִּנְיָמִן"
  (1 Chr 12:2); "כָּל־זֶה קֹלֵעַ בָּאֶבֶן אֶל־הַשַּׂעֲרָה וְלֹא יַחֲטִא" (Judg 20:16).
* [TEXT] Shields: מָגֵן (the round shield) and the large צִנָּה (17:7, carried by a shield-bearer); leather,
  oiled (Rashi 2 Sam 1:21).
* [TEXT] Military age from twenty (Num 1:3).
* [TEXT] The elders of the people are present at Gilgal: Saul asks "כַּבְּדֵנִי נָא נֶגֶד זִקְנֵי־עַמִּי וְנֶגֶד
  יִשְׂרָאֵל" (15:30). A few elders (see 3.7) may stand near the head of the column.
* [TEXT] The army brings the spoil to sacrifice at Gilgal: "וַיִּקַּח הָעָם מֵהַשָּׁלָל צֹאן וּבָקָר רֵאשִׁית הַחֵרֶם
  לִזְבֹּחַ לַה׳ אֱלֹהֶיךָ בַּגִּלְגָּל" (15:21) — **flocks and cattle driven with the army** (see 3.5).

**MUST**

* Men 20–50, mostly bearded (full beards; young men short beards), hair to the nape or shoulders, some with a
  simple headband or a wrapped head-cloth against the sun; sunburnt, dusty, tired, triumphant.
* Dress: knee-length tunics of undyed wool (cream, beige, brown, grey), some with a narrow madder-red or ochre
  stripe; leather or cloth belts; sandals or barefoot; bedrolls / mantles tied across the back; waterskins.
* Weapons mix per 100 men ([DECISION]): ~45 spears (2–2.4 m, iron or bronze leaf heads), ~20 slingers (sling
  wrapped at the wrist or belt, pouch of stones), ~15 bows (simple/composite, quiver of reed arrows), ~10 swords
  or daggers, ~10 axes/goads/clubs; ~35 carry a round leather shield (50–65 cm), a few big צִנָּה shields
  (rectangular/oval, body-height) at the front.
* Armour: almost none. At most one in twenty with a leather cap or a quilted/leather corselet; **bronze helmets
  and scale coats only for Saul (and, if shown, Abner/Jonathan-level commanders).**
* A few men blowing **rams' horns** (natural, short, curved, amber-brown, ~35–45 cm).
* Loose column / crowd, not Roman ranks: groups by clan, dust cloud, the king and his entourage at the head.
* Entourage around Saul: his armour-bearer (young man, carries shield and extra javelins), a few
  heavily-armed guards ("runners", 22:17), optionally Abner (14:50) — an older bearded commander.

**MUST-NOT**

* No horses, chariots, camels or cavalry for Israel.
* **No war drums carried by the army** (the תֹּף is a hand frame-drum played by women in celebrations — Exod
  15:20, 18:6 — not a military instrument). Drums belong in the score only.
* No banners, standards, flags or lettered signs; no uniforms, no identical shields, no painted shield emblems.
* No Roman marching order, testudo, legionary shields, trumpets of brass, or horns of kudu (twisted "Yemenite"
  shofars are a later/foreign type — use a plain ram's horn).
* No women, children or musicians celebrating (that is 18:6, after Goliath).

### 3.5 SPOILS and AGAG (background of shots 6–9 only)

* [TEXT] Saul and the people spared "אֲגָג וְעַל־מֵיטַב הַצֹּאן וְהַבָּקָר וְהַמִּשְׁנִים וְעַל־הַכָּרִים" (15:9) and
  brought sheep and cattle to Gilgal (15:15, 15:21). Samuel hears them: "וּמֶה קוֹל־הַצֹּאן הַזֶּה בְּאָזְנָי
  וְקוֹל הַבָּקָר אֲשֶׁר אָנֹכִי שֹׁמֵעַ" (15:14).
* **MUST:** herds of **fat-tailed sheep and small humpless cattle** driven behind/beside the column by soldiers
  with goads, raising dust. Their bleating and lowing is the one sound that survives the "silence" of shot 9
  (see 3.16) — the evidence of the sin, heard, not shown.
* **Camels: NO.** Amalek's camels and donkeys were to be destroyed (15:3) and the text lists only flock and herd
  among what was spared (15:9).
* **Agag: DO NOT SHOW.** He is alive at Gilgal (15:8, 15:32) and is executed by Samuel right after the tearing
  (15:33); showing him demands explanation and leads to a killing the film must not depict. At most, far in the
  background and never identifiable: a bound captive among guards. No Amalekite corpses, no plunder heaps of
  gold, no captives' women/children (15:3 was a ban; the film does not go there).

### 3.6 GILGAL (Act I)

**Sources**

* [TEXT] "וַיַּחֲנוּ בַּגִּלְגָּל בִּקְצֵה מִזְרַח יְרִיחוֹ" (Josh 4:19) — on the eastern edge of Jericho's land, in the
  Jordan valley. Jericho is "בִּקְעַת יְרֵחוֹ עִיר הַתְּמָרִים" (Deut 34:3) — the city of **date palms**.
* [TEXT] Twelve stones taken from the bed of the Jordan (Josh 4:3), "הֵקִים יְהוֹשֻׁעַ בַּגִּלְגָּל" (Josh 4:20) —
  **set up** (erected), not heaped. The name: "וַיִּקְרָא שֵׁם הַמָּקוֹם הַהוּא גִּלְגָּל" (Josh 5:9).
* [TEXT] Gilgal is Israel's assembly place and altar-site: Saul was crowned there with peace-offerings
  "לִפְנֵי ה׳ בַּגִּלְגָּל" (11:15); Samuel circuits there (7:16); Saul's first rebuke happened there (13:8–14).
* [CHAZAL] Rashi 15:27: Saul wanted to prostrate himself "בגלגל שהיה שם אהל מועד"; Radak 15:12: they still
  honoured Gilgal and sacrificed there "לפי שהיה שם המזבח ואהל מועד תחילה", although the Tabernacle was now at
  Nob. → **an altar stands at Gilgal, the Tabernacle does not.** `radak_s1_15_12_gilgal_altar`
* [TEXT] Route and timing: Samuel set out early in the morning (15:12) — from Ramah (15:34 he returns there) —
  down to Gilgal: ≈25–30 km and ≈1,100 m of descent → **he arrives in the afternoon**; Saul "וַיֵּרֶד הַגִּלְגָּל"
  (15:12) — came **down** from the hill country, i.e. from the **west**.

**MUST ([ARCH] + geography)**

* A flat, open plain ≈250–270 m **below sea level**, hot, hazy air, heat shimmer. Ground: pale grey-cream
  **Lisan marl** and loess, powdery dust `#d8cfbb`, cracked patches, low eroded marl badlands toward the river.
* Vegetation: **date palms** (clusters and single tall trunks, the Jericho oasis 2–4 km to the west), **acacia**
  (flat-topped *Vachellia*), **jujube / sidr** (*Ziziphus spina-christi*, dense thorny round trees),
  **tamarisk** (אֵשֶׁל), saltbush and dry grasses. The **Jordan's thicket** (גְּאוֹן הַיַּרְדֵּן, "the jungle of the Jordan", Jer 12:5, 49:19) as a dark
  green winding band to the east: tamarisk, Euphrates poplar, willows, giant reeds.
* **East:** the long, level wall of the **mountains of Moab** (≈1,000–1,300 m above the valley floor), reddish-tan,
  in late afternoon glowing warm rose-gold.
* **West:** the steep, bare escarpment of the **Judean desert** — pale limestone/dolomite cliffs and ravines —
  which puts the western sky behind the army; the ruin-mound (tell) of Jericho with a few houses and the green of
  its spring.
* **The twelve stones:** 12 large **rounded river boulders** (Jordan bed: grey/cream limestone, flint-brown,
  some dark basalt), each ≈70–100 cm, **standing upright** in a ring ≈10–14 m across ([DECISION]; the circle is a
  conjecture from the name "gilgal", not stated), weathered, half-buried at the base.
* **The altar:** a squarish altar of **unhewn fieldstones** and earth (Exod 20:22: no hewn stones; no steps), ≈1.2 m
  high, 2–3 m square, soot-blackened top, near the stones. No horns required (Iron Age horned altars are later and
  of cut stone).
* Temporary camp traces: goat-hair tents (black, low), fire pits, donkeys with packs, water jars.

**MUST-NOT**

* No Tabernacle, no Ark, no tent-sanctuary with gold, no temple, no columns.
* No green meadow or European trees; no cactus (prickly pear is a New-World plant), no eucalyptus, no citrus.
* No Jericho city walls standing high (Jericho lies ruined/sparsely rebuilt — 1 Kings 16:34 is later).
* No monument/stela of Saul here (his "יָד", 15:12, was set up at **Carmel** in Judah, not at Gilgal).

### 3.7 THE ELDERS of Israel (shot 5; a few at Gilgal, 15:30)

**Sources**

* [TEXT] "וַיִּתְקַבְּצוּ כֹּל זִקְנֵי יִשְׂרָאֵל וַיָּבֹאוּ אֶל־שְׁמוּאֵל הָרָמָתָה" (8:4); they say "הִנֵּה אַתָּה זָקַנְתָּ
  וּבָנֶיךָ לֹא הָלְכוּ בִּדְרָכֶיךָ" (8:5).
* [TEXT] Elders sit in the town gate as its court (Deut 21:19, 22:15; Ruth 4:1–2). An old man walks with a staff
  (Zech 8:4 "וְאִישׁ מִשְׁעַנְתּוֹ בְּיָדוֹ מֵרֹב יָמִים").
* [TEXT] Tzitzit on every four-cornered garment, with a tekhelet thread (Num 15:38; Deut 22:12); no sha'atnez
  (Deut 22:11).
* [ARCH] Later Israelite/Judahite depictions (Black Obelisk 841 BCE; Lachish reliefs 701 BCE) show full beards,
  long fringed garments, headbands, soft caps or wrapped head-cloths; nothing survives from ≈1030 BCE.

**MUST**

* 15–30 men, **50–75 years old**, full grey/white/greying beards, long hair; weathered heads of families and
  tribes, not a mob; some with **walking staffs** (plain, knotted wood, shoulder height).
* Long tunic to the shins + a **rectangular wool mantle (שִׂמְלָה)** wrapped over the shoulders, **tzitzit** at the
  four corners (white + one tekhelet thread). Mostly undyed wool (cream, brown, grey, black goat); the richer with
  a coloured woven band (madder red / ochre / blue) near the edge.
* Heads: [DECISION] a mix — bare heads, simple headbands, and head-cloths wrapped loosely (natural wool) with an
  end falling to the shoulder. Sandals.
* They face Samuel, some standing, some seated on stone benches/ground; the speakers gesture with open palms.

**MUST-NOT**

* No striped prayer shawls, no kippot, no shtreimel/fur hats, no Arab keffiyeh with a black double cord (agal),
  no Greek himation-and-toga look, no Roman sandals with straps to the knee, no scrolls/books in hand.

### 3.8 RAMAH (shot 5)

* [TEXT] Samuel's home: "וּתְשֻׁבָתוֹ הָרָמָתָה כִּי־שָׁם בֵּיתוֹ … וַיִּבֶן־שָׁם מִזְבֵּחַ לַה׳" (7:17) — an altar
  (Radak: his private *bamah*, permitted since Shiloh's fall). Samuel's native town is "הָרָמָתַיִם צוֹפִים מֵהַר
  אֶפְרָיִם" (1:1).
* **Script correction:** the script calls Ramah "a hill town of Benjamin". The text places Samuel's Ramah
  (Ramathaim-Zophim) in the **hill country of Ephraim** (1:1); its identification is debated (er-Ram in Benjamin,
  Nabi Samwil, Rentis…). Say "a hill town in the central highlands" — never label it on screen beyond "הָרָמָתָה"
  if at all.
* [ARCH] ≈1030 BCE hill villages (Khirbet Raddana, Ai, Tell en-Nasbeh Iron I): **pillared "four-room" houses** of
  rough limestone fieldstones, flat roofs of beams, branches and packed clay, courtyard walls; the outer houses
  form a continuous perimeter; **a modest gateway** (a narrow passage between two houses/short wall stubs,
  wooden lintel or flat stone slab — **no arch**) with stone benches; threshing floor on the edge; terraces with
  olive, vine, fig; collared-rim storage jars.
* **MUST:** hilltop, ≈750–850 m altitude, morning light; Samuel's house slightly larger; his **altar of unhewn
  stones** on the high point, a thin smoke line optional.
* **MUST-NOT:** the monumental six-chamber gates (Megiddo/Hazor/Gezer are 10th–9th c. and royal), city walls with
  towers and crenellations, arches, domes, whitewashed plaster façades, windows with glass, tiled roofs.

### 3.9 THE PHILISTINES (shot 4)

**Sources**

* [TEXT] "שְׁלֹשִׁים אֶלֶף רֶכֶב וְשֵׁשֶׁת אֲלָפִים פָּרָשִׁים וְעָם כַּחוֹל אֲשֶׁר עַל־שְׂפַת־הַיָּם לָרֹב" (13:5) —
  chariots, horsemen/charioteers and a numberless host.
* [TEXT] The Philistine champion ≈1000 BCE (17:5–7): "וְכוֹבַע נְחֹשֶׁת עַל־רֹאשׁוֹ", scale armour of bronze,
  "וּמִצְחַת נְחֹשֶׁת עַל־רַגְלָיו" (bronze greaves), "וְכִידוֹן נְחֹשֶׁת בֵּין כְּתֵפָיו" (a bronze javelin slung
  across the back), a spear with a shaft "כִּמְנוֹר אֹרְגִים" and an **iron** head, "וְנֹשֵׂא הַצִּנָּה הֹלֵךְ
  לְפָנָיו".
* [TEXT] They controlled metal-working (13:19–21) → they are **better armed** than Israel: more bronze and iron.
* [TEXT] They are הָעֲרֵלִים — uncircumcised (31:4) — foreigners from the sea (Amos 9:7 "וּפְלִשְׁתִּיִּים מִכַּפְתּוֹר").
* [ARCH] Medinet Habu reliefs of Ramesses III (≈1175 BCE): Peleset warriors **clean-shaven**, wearing the
  "feathered"/"reed" headdress (a band with vertical strips and a chin strap), ribbed corselets of horizontal bands,
  kilts with tassels, **round shields**, long straight swords (Naue II type) and paired spears; light chariots
  with two horses. By ≈1000 BCE the text itself gives their elite **bronze helmets**.

**MUST**

* A large host marching on the **coastal plain** (flat fields, sand dunes near the sea, kurkar ridges), the
  Mediterranean as a pale band on the western horizon; dust, bronze glints.
* [DECISION] Elite and front ranks: bronze helmets (rounded/conical, some with a low transverse ridge), bronze
  scale or banded corselets, **bronze greaves**, round shields (bronze-faced or leather with a central boss),
  long straight swords, spears with iron heads; big shields carried before champions by shield-bearers.
  Rank and file: the **reed/feather-crown headdress** (12th-c. evidence, allowed as a survival — a clear
  "Philistine" read), kilt/short tunic, round shield, spears.
* **Clean-shaven or very short beards** (Medinet Habu) — the visual opposite of bearded Israel.
* Chariots **only as distant, simple shapes** (two horses, light six-spoked car, 2–3 crew), or omitted if horses
  cannot be made believable. No mounted riders (true cavalry is rare before the 9th c.; we read פָּרָשִׁים as
  chariot horses/men).

**MUST-NOT**

* No horned helmets (Sherden), no Greek hoplite/Corinthian look, no crests of horsehair, no Viking/Celtic look,
  no Roman or medieval armour; no dagon-fish costumes; no lettering on shields.

### 3.10 RACHEL'S TOMB (shot 3)

* [TEXT] "וַתָּמָת רָחֵל וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם" (Gen 35:19); "וַיַּצֵּב יַעֲקֹב מַצֵּבָה
  עַל־קְבֻרָתָהּ הִוא מַצֶּבֶת קְבֻרַת־רָחֵל עַד־הַיּוֹם" (35:20) — **one** standing stone on her grave, by the road,
  still standing in later times.
* [TEXT/CHAZAL] In Saul's time the tomb is a known landmark: "עִם־קְבֻרַת רָחֵל בִּגְבוּל בִּנְיָמִן בְּצֶלְצַח"
  (1 Sam 10:2); Rashi and Radak there: the tomb is in Judah **near Bethlehem**; the men met at the tomb would be
  found later at the border of Benjamin. Rashi on Gen 48:7: Jacob buried her by the road so that the exiles
  passing there would have her prayer (Jer 31:14) — **the road is the point.**
* [ARCH] Masseboth of the period (Gezer high place, Arad, Hazor, Shechem): **unworked or roughly dressed
  monoliths, aniconic and uninscribed**.
* **MUST** ([DECISION] — the text gives no size or shape): a single **upright, rough limestone monolith ≈2.0–2.4 m
  high, ≈60–80 cm wide, ≈30–40 cm thick**,
  slightly tapering, rounded top, deeply weathered (≈500 years old in the tradition's reckoning), grey-cream
  with darker rain streaks; a low mound of fieldstones (the grave) at its foot; beside a worn earthen **road**
  (the north–south ridge route) with wheel-less donkey/foot traffic, terrace walls and a few olive trees; open
  sky; first light raking from the east (long shadow westward).
* **MUST-NOT:** the domed building (Crusader/Ottoman), the cupola on four pillars, fences, walls, the modern
  structure; inscriptions; the "eleven stones and a capstone" (a medieval travellers' tradition, not Chazal);
  candles, lamps, pilgrims praying.

### 3.11 THE LAND — dawn flyover (shots 2, 4, 13, 14)

* West → east (true geography, ≈60 km from the sea to the Jordan): Mediterranean → **coastal plain** (dunes,
  fields, Philistine tells) → **Shephelah** (low rolling hills, 200–400 m, oak/terebinth, fields) → **Judean
  mountains** (≈750–1,000 m; terraces, olives, vines, remaining oak-terebinth woodland, small villages of stone
  with flat roofs) → **Judean desert** (bare, rolling chalk and limestone hills in rain-shadow, deep wadis, no
  trees, ≈20 km wide) → **cliffs** 300–500 m high → **the Dead Sea** → **the Moab plateau** (a level wall,
  ≈1,000–1,300 m) on the eastern horizon.
* **Dawn from above Judah looking east:** the sun rises **behind Moab** — Moab a dark blue-violet silhouette with a
  sharp level top, the sky gold→rose→blue above it; the **Dead Sea a long molten mirror** reflecting the dawn;
  the desert hills in layered blue haze; **mist/fog lying in the valleys** of the Judean hills (typical morning
  inversion). Clouds: a broken stratocumulus deck below the camera that the camera breaks through.
* **Dead Sea in antiquity** [ARCH, approximate — lake-level studies disagree in detail]: roughly at its
  19th-century level (≈−390 to −410 m) and far above today's ≈−438 m → one long lake ≈75–80 km, the shallow
  **southern basin under water**, the Lisan peninsula a pale tongue from the east shore; natural shore — **no evaporation
  ponds, no hotels, no white retreating salt flats, no sinkholes, no roads**.
* **Jerusalem** is still the Jebusite city (2 Sam 5:6) — a small walled town on a spur. **Do not feature it**; if
  visible at all, a tiny indistinct settlement. **Never** the Old City walls, Temple Mount platform, Dome of the
  Rock, towers, churches, minarets.
* Other things that must not appear in the land: Masada's palaces (Herodian), Qumran, modern Jericho, roads, power
  lines, forests of pine (JNF plantations), prickly-pear hedges, eucalyptus, terraced orchards of citrus.

### 3.12 BETHLEHEM (shot 14) — consistent with the chapter-1 world

* [TEXT] "בֵּית לֶחֶם יְהוּדָה" (17:12), in Judah on the ridge by the road (Gen 35:19); a well by the gate
  (2 Sam 23:15 "מִבֹּאר בֵּית־לֶחֶם אֲשֶׁר בַּשָּׁעַר").
* [ARCH] Small Iron-Age village on a ridge: four-room houses of limestone, flat roofs, courtyards, terraces with
  vines, olives and figs, threshing floor; no church, no domes, no minarets. (Already built by the environment
  team — keep it.)

### 3.13 DAVID (shots 15–17, 21)

* [TEXT] "עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן" (16:11); "וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי" (16:12);
  "כִּי־הָיָה נַעַר וְאַדְמֹנִי עִם־יְפֵה מַרְאֶה" (17:42); his kit: "וַיִּקַּח מַקְלוֹ בְּיָדוֹ … בִּכְלִי הָרֹעִים אֲשֶׁר־לוֹ
  וּבַיַּלְקוּט וְקַלְעוֹ בְיָדוֹ" (17:40).
* [CHAZAL] Targum on 16:12: "סמוק" — ruddy complexion; Radak on 17:42: his beauty was not yet worn by war;
  Bereshit Rabbah 63:8: Samuel feared the ruddy one would be a shedder of blood like Esau — "עם יפה עינים"
  answered him. Seder Olam: he was 29 at the anointing — **but the Bible calls him "נַעַר"**; the game's approved
  decision (docs/sources.md §3.7) is a **youth**, and the reference image.
* **MUST:** exactly the existing chapter-1 David (the user's reference image): a youth ≈17, ≈1.70 m, lean-strong
  shepherd's build; **ruddy, fresh face** (not weather-beaten), **beautiful, warm, expressive eyes**; sun-lightened
  copper/auburn curls (אַדְמוֹנִי read as ruddy — hair colour is an interpretation, keep the reference);
  **HAIR LENGTH = EXACTLY THE REFERENCE IMAGE (the user's explicit order, 30 Sep): short-to-medium tousled curls,
  NOT long hair** — volume on the crown, a few loose curls falling onto the forehead (not over the eyes), the curls
  cover only the top of the ears (the ear lobes show), at the back they end at the nape/top of the neck and never
  reach the collar or the shoulders; no ringlets hanging to the jaw. Colour as in the reference: warm chestnut-brown
  with copper/auburn highlights where the sun catches it — not a bright ginger/orange; little or
  no beard (a youth's soft down at most); coarse undyed wool tunic, belt/sash, the shepherd's bag at the hip,
  **sling** (wound at the wrist or tucked in the belt), **staff** planted on the rock. Tzitzit only if an outer
  four-cornered mantle is worn.
* **MUST-NOT:** lyre in these shots (fine in principle — 16:18 — but not in the script); crown, oil, halo, light
  beams from heaven, a "Good Shepherd" lamb-on-shoulders pose in Act II (that image belongs to Moses in the
  midrash — `shr_2_2_moses_kid`); Renaissance (Michelangelo) nudity or Italian look.

### 3.14 THE FLOCK (shots 3, 14, 18)

* [TEXT] Sheep and goats (צֹאן) — the black goats of Song 4:1 (כְּעֵדֶר הָעִזִּים); the fat tail of the sheep is a
  Torah-attested feature (הָאַלְיָה, Exod 29:22) → **fat-tailed sheep** (Awassi-type: cream body, brown/black
  heads, drooping ears) mixed with **black long-haired goats**. Lambs small and fluffy.
* **MUST-NOT:** European white-faced merino/Suffolk sheep, sheepdogs of modern breeds (a rough Canaan-type dog
  is allowed), bells made of modern tin.

### 3.15 THE THICKET AND THE BEAR (shots 18–19)

* [TEXT] "וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר" (17:34). The bear as an ambusher: "דֹּב אֹרֵב הוּא לִי
  אֲרִי בְּמִסְתָּרִים" (Lam 3:10) — **exactly the hook shot**. A thicket is סְבַךְ (Gen 22:13; the lion comes up מִסֻּבְּכוֹ,
  Jer 4:7); bears come out of the woodland (יַעַר, 2 Kgs 2:24).
* **Thicket** [ARCH/botany of the Judean hills]: dense evergreen maquis 2–4 m high — **kermes oak** (*Quercus
  calliprinos*, small dark spiny leaves), **Palestine terebinth**, **mastic**, *Phillyrea*, hawthorn, carob, storax
  (*Styrax*, לִבְנֶה), climbing *Smilax*, bramble in the wadi bed; limestone boulders; **deep shadow inside**,
  golden rim light on the outer leaves.
* **Syrian brown bear** (*Ursus arctos syriacus*, native to the Levant until the 20th century): the smallest,
  palest brown bear — **straw/cream to golden-tan coat with darker legs**, often lighter (blond) tips, a clear
  **shoulder hump**, dished face, small rounded ears, long pale claws; adult male 150–250 kg. (The chapter-1
  BearModel is this bear — keep it.)
* **Eyes in the dark:** small, dark-brown bear eyes; a faint **amber** eyeshine (tapetum) is physically correct if
  light catches them — **never red, never glowing like a demon**. Breathing, a twig snapping, leaves shifting.

### 3.16 SOUND that is on screen (diegetic)

* Shofar (ram's horn) blasts — Israel's only military signal (13:3).
* Sheep bleating and cattle lowing — the spoil (15:14). Recommended as the **only sound under the silence of
  shot 9** besides the wind: the audience hears what Samuel heard.
* Feet, dust, bronze scales clinking, spears knocking shields, men shouting (not a chant in unison).
* No drums, trumpets or cymbals on screen for Israel; Philistine war-drums likewise are **score only**.
* Birds of the Judean hills at golden hour (shot 18): chukar partridge calls, bulbuls, larks; they fall silent in
  shot 19.

---

## 4. Light and time of day per shot

| Shot | Time | Sun | Notes |
|---|---|---|---|
| 1 | black | — | wind, one tone |
| 2 | **dawn** | rising behind Moab (east), 0–3° | above/through clouds, valley mist, the Dead Sea a mirror |
| 3 | **first light** | just risen, east, 2–6° | long westward shadow of the pillar, cool shadows / warm stone |
| 4 | early morning | east, **behind the camera** (camera faces west) | frontal warm light on the Philistine host, haze over the plain |
| 5 | morning | east-south-east, 15–30° | soft, dignified; Ramah hilltop |
| 6–9 | **afternoon → late afternoon** at Gilgal (15:12: Samuel left early and walked down ≈25–30 km) | **west, behind the army** (they came down from the western hills) | backlit Saul, dust glowing, heat haze; Moab lit warm in the east |
| 10–12 | late afternoon | west, 15–20° | long shadows, rim light on the torn fibres; the Judean escarpment starts to shade the plain |
| 13 | late afternoon → golden hour | west | rise into warm clouds |
| 14–19 | **golden hour** at Bethlehem | west, 3–10° | warm key, cool blue shadows; the thicket very dark |
| 20 | black | — | smash cut |

---

## 5. Chronology and things that must not appear

The film sits **inside 1 Samuel 15**, before David's anointing (16:13). Therefore:

* Nothing from after 16:13: no anointing, no horn of oil, no "evil spirit" (16:14), no David at Saul's court, no
  lyre-playing before Saul, no spear thrown, no Goliath (ch. 17), no women dancing with drums (18:6), no
  Jonathan–David friendship, no Michal.
* Jerusalem is **Jebusite** (2 Sam 5:6): no Israelite capital, no Temple, no Ark procession; the Ark is at
  Kiriath-jearim (7:2), the Tabernacle at Nob (Seder Olam 13; Radak 15:12).
* Agag's execution (15:33) is not shown.
* **Never:** New Testament imagery (the "Good Shepherd", "ninety-nine sheep", nativity stars, mangers), halos,
  crosses, angels with wings, light-rays "from heaven" on a person; the hexagram "Star of David" (medieval); a
  menorah; striped tallit, kippah, hasidic sidelocks or black hats; square Hebrew script (Assyrian script) on
  any in-world object — writing of the time is Paleo-Hebrew/Proto-Canaanite, and none is needed on screen.
* **Never (material culture):** arches, domes, vaults, columns with capitals, marble, glass windows, tiled roofs,
  candles (use saucer oil lamps), coins, paper/books, stirrups/saddles, horses or camels for Israel, chain mail,
  plate armour, Roman/Greek/medieval arms, crests and plumes, lettered banners, heraldry.
* **Never (nature):** prickly-pear cactus, eucalyptus, agave, citrus orchards, maize, tomatoes, pine plantations,
  bougainvillea, chickens, European sheep breeds, zebu.

---

## 6. Notes on `docs/intro-script.md` (for the orchestrator)

1. **Drums (shots 4, 6):** war drums are not attested for Israel's army (the תֹּף is a women's frame-drum of
   celebration, Exod 15:20; 1 Sam 18:6). Keep drums in the **score**, never visible in soldiers' hands.
2. **Shot 9 "only wind":** the text gives this moment a sound — "וּמֶה קוֹל־הַצֹּאן הַזֶּה בְּאָזְנָי וְקוֹל הַבָּקָר"
   (15:14). Recommended: wind + distant bleating/lowing of the spoil.
3. **Table, "Gilgal":** "circle/**cairn** of twelve standing stones" → the stones were **set up** (הֵקִים, Josh 4:20),
   so standing stones, not a cairn; the circle is conjecture. Add the **altar** (Rashi/Radak 15:12–27; 11:15).
4. **Table, "Elders at Ramah":** "a hill town of Benjamin" → Samuel's Ramah is Ramathaim-Zophim "מֵהַר אֶפְרָיִם"
   (1:1), identification debated; say "hill town in the central highlands".
5. **Samuel's age:** the Talmud makes him ≈51 at Gilgal but "old age sprang upon him" (Taanit 5b) — the script's
   "old, grey man" is right; the model must look ~70 but stand strong.
6. **Saul's age:** "mature and powerful" is right; by the text's arithmetic he is 50+ (see 3.2). Not young.
7. **Samuel's hair:** the Nazirite reading of 1:11 is R. Nehorai's (Mishnah Nazir 9:5), disputed by R. Yose —
   we follow it (plain sense), but do not caption it as certain.
8. **Shot 12** (the torn piece stays in Saul's fist) — an inference, acceptable.
9. **Film title** "הַטּוֹב מִמֶּךָּ" is a quotation (15:28) — render it from the catalog (`s1_15_28_better_than_you`).
10. **Act labels** in the script, if they ever appear on screen, need niqqud and a sin: הַחִפּוּשׂ (not ‑ס),
    בַּסְּבַךְ, הָאָרֶץ, הַמֶּלֶךְ, הָרֹעֶה — they are in `introNarration.ts` as optional ids.

---

## 7. Catalog ids used in this document

Display (shipped, `src/content/sources.ts`): `gen_35_19_rachel_full`, `s1_14_52_war_all_days`,
`s1_8_5_give_us_king`, `s1_9_2_head_above`, `s1_14_47_fought_around`, `s1_15_27_robe_torn`,
`s1_15_28_torn_kingdom`, `s1_15_28_better_than_you`, `s1_13_14_after_his_heart`, `s1_16_11_youngest`,
`s1_16_12_ruddy`, `s1_16_7_looks_heart`.

Research (`src/content/sourcesReference.ts`, not shipped; listed in `docs/sources.md` §6.2 — the entries added for
this film have `use: visual-bible …`): `s1_1_11_no_razor`, `num_6_5_nazir_hair`, `mnazir_9_5_samuel_nazir`,
`s1_8_1_samuel_old`, `s1_12_2_old_grey`, `taan_5b_samuel_52`, `taan_5b_old_age_sprang`, `mk_28a_samuel_52`,
`s1_15_11_cried_all_night`, `s1_15_12_rose_early`, `s1_2_19_little_meil`, `radak_s1_2_19_meil_great`,
`rashi_s1_28_14_meil`, `metz_s1_28_14_meil`, `s1_28_14_samuel_meil`, `ber_48b_saul_beauty`, `radak_s1_9_2_goodly`,
`metz_s1_9_2_goodly`, `s2_2_10_ishbosheth_40`, `s2_1_10_diadem`, `rashi_s2_1_10_armlet`, `s2_1_21_shield_oil`,
`rashi_s2_1_21_leather_shields`, `s1_17_38_39_armor`, `s1_17_5_7_goliath_armor`, `s1_26_7_spear_ground`,
`s1_13_3_shofar`, `s1_15_4_foot_soldiers`, `chr1_12_2_benjamin_archers`, `s1_18_6_frame_drums`, `s1_15_3_ban`,
`s1_15_9_spared`, `s1_15_14_bleating`, `s1_15_21_gilgal_sacrifice`, `s1_15_33_agag`, `josh_4_3_river_stones`,
`josh_4_19_gilgal`, `josh_4_20_twelve_stones`, `josh_5_9_gilgal_name`, `deut_34_3_palms`, `s1_11_15_gilgal_crowned`,
`radak_s1_15_12_gilgal_altar`, `rashi_s1_15_27_whose_robe`, `metz_s1_15_27_torn`, `exo_20_22_unhewn_altar`,
`s1_1_1_ramathaim`, `s1_7_17_ramah_altar`, `s1_8_4_elders_ramah`, `zech_8_4_staff`, `sotah_17a_tekhelet`,
`num_15_38_tzitzit`, `deut_22_11_12_shaatnez_gedilim`, `lev_19_27_beard`, `s1_13_5_philistine_host`,
`amos_9_7_caphtor`, `gen_35_20_pillar`, `s1_10_2_rachel_tomb`, `rashi_s1_10_2_rachel`, `lam_3_10_bear_ambush`,
`radak_s1_17_42_ruddy`, `tj_s1_16_12_ruddy`, `brr_63_8_ruddy`, `seder_olam_13_david_29`, `yoma_22b_one_year_old`,
`radak_s1_16_7_saul`, `shr_2_2_moses_kid`.
