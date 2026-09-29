# DAVID: sources and textual accuracy (מְקוֹרוֹת)

> **Generated file.** Edit `tools/sources/sources_doc.md.tmpl` and run `python3 tools/sources/render_docs.py`.
> Every Hebrew quotation below comes from the verified catalog (`src/content/sources.ts`,
> `src/content/sourcesReference.ts`), so it matches the source text exactly.

This document has four parts:

1. **Textual basis.** Which editions we quote, the normalization rules, and the verification tooling.
2. **Audit.** Every quotation the game displays today, with its verdict and the exact corrected text, plus the code changes needed.
3. **Dossier.** What the Hebrew Bible and the rabbinic sources say about King Saul, Gibeah of Saul and his court at the moment of the intro (after 1 Samuel 15, before 16:1). It also covers David, for contrast.
4. **Historical and archaeological context** (separate from the texts; certain facts are marked apart from conjecture), and **recommendations** for the new intro.

---

## 1. Textual basis

### 1.1 Editions

| Work | Edition used (Sefaria `versionTitle`) | License (per Sefaria) | Role |
|---|---|---|---|
| Tanakh | **Miqra according to the Masorah (MAM)**: Aleppo Codex tradition; Sefaria's default Hebrew text | CC BY-SA | canonical text for every verse |
| Tanakh | Tanach with Ta'amei Hamikra: Westminster Leningrad Codex (tanach.us) | Public Domain | cross-check only |
| Shemot Rabbah, Bereshit Rabbah | Midrash Rabbah (Torat Emet), vocalized | unknown (Torat Emet freeware) | text of the midrash quotations |
| Shemot Rabbah | Daat Shemot Rabbah, unvocalized | Public Domain | consonantal cross-check |
| Seder Olam Rabbah | Seder Olam, Warsaw 1904 | Public Domain | chronology |
| Bavli (Yoma, Megillah, Taanit, Moed Katan) | William Davidson Edition (Koren / Steinsaltz), vocalized by Dicta | **CC BY-NC** | research only (not shipped) |
| Targum Jonathan | Mikraot Gedolot | Public Domain | research only |
| Rashi, Radak | Sefaria vocalized edition / Radak on Nach | unknown | research only |

All files come from Sefaria's public export: the index is `https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json`, and the files are at `https://storage.googleapis.com/sefaria-export/json/<category>/<title>/Hebrew/<version>.json`. Verse numbering is the Hebrew (Masoretic) numbering. Some English Bibles number 1 Sam 21 and 24 differently.

MAM and the Leningrad codex differ in about 8% of the verses of Samuel, Psalms, Judges, Genesis and Ruth, almost always in plene or defective spelling, dagesh or maqaf. The builder checks every displayed quotation against both editions. Only one displayed quotation is affected: 1 Sam 17:36, where MAM (Aleppo) reads **הַדֹּב** and Leningrad reads **הַדּוֹב**. We follow MAM.

### 1.2 Normalization rules (display text)

Tanakh (`sourcelib.normalize_tanakh`):

- **R1 Ketiv/qere → qere**, as read. The ketiv is dropped and the qere is kept, and each pair is recorded in the entry's `kq` field.
  - **R1b** MAM prints some "trivial" pairs as the ketiv letters with the qere's vowels. These are respelled as the qere: `עָלָו → עָלָיו`, `מְרַאֲשֹׁתָו → מְרַאֲשֹׁתָיו`, `עִירֹה → עִירוֹ`, `שַׁתָּ → שַׁתָּה`. No displayed quotation contains a ketiv/qere word.
- **R2 Markup removed.** Section markers `{פ}` `{ס}`, HTML tags, line breaks and entities are stripped.
- **R3 Cantillation removed.**
  - The te'amim U+0591–U+05AF are removed.
  - Also removed: meteg/ga'ya U+05BD, paseq/legarmeh U+05C0, rafe U+05BF, nun hafukha U+05C6, sof pasuq U+05C3, and invisible controls (CGJ U+034F, ZWJ/ZWNJ, bidi marks).
- **R4 Points kept**: every vowel, dagesh/mappiq and shin/sin dot, plus **maqaf U+05BE**. MAM's reader-aid variants are folded to the standard points of printed Tanakhs: qamats qatan U+05C7 → qamats U+05B8, and holam haser U+05BA → holam U+05B9.
- **R5 Divine name.** The Tetragrammaton, in any pointing and with its one-letter prefixes, is written **ה׳** (U+05D4 U+05F3), for example `וַה׳`, `לַה׳`, `בַּה׳`. This follows the common Jewish printing convention. אֱלֹהִים is kept as written.
- **R6 Spacing.** Whitespace is collapsed, there is no space after a maqaf, and the text is Unicode **NFC**.
- **R7 Verse ranges.** Consecutive verses are joined with a single space, since the sof pasuq is dropped (R3).

Rabbinic texts (`sourcelib.normalize_rabbinic`):

- **M1** The edition's inline citation markers `<small>(תהלים עח, ע)</small>` are removed. Tags and entities are stripped.
- **M2** The edition's own vocalization and punctuation (commas, periods, `״…״`, dashes) are **kept**, because they are part of the edition's text. Editorial brackets such as `[במה הוא בוחנו]` stay in `text` but are never quoted.
- **M3** Whitespace is collapsed and the text is NFC. The divine-name rule is not applied, because these texts already write ה׳ or ה'.

Display rules (checked by the verifier):

- **D1** A displayed quotation is an **exact contiguous substring** of the normalized source. Nothing may be added: no commas, semicolons, periods, dashes or spaces in place of a maqaf.
- **D2** When a quotation skips words, it is split into exact pieces joined by `' … '` (U+2026 with spaces), in source order.
- **D3** Quotation marks around the quotation and the reference label are outside the quotation and are allowed. The reference must name the verse(s) that contain the text, not only the chapter.
- **D4** A paraphrase is never presented as a quotation, and "עַל פִּי" plus a paraphrase is not allowed.

### 1.3 Tooling

```bash
python3 tools/sources/build_catalog.py      # spec -> src/content/sources.ts + sourcesReference.ts (exact texts)
python3 tools/sources/verify_sources.py     # re-fetch sources, verify catalog + scan game strings; exit 1 on mismatch
python3 tools/sources/render_docs.py        # this document
```

- `tools/sources/catalog_spec.py` is the only place quotations are chosen. Each piece is written as an *unpointed skeleton*. The builder resolves it to the exact pointed substring on word boundaries, and the build fails if the words are not in the verse.
- `verify_sources.py` re-downloads every edition used, with a fallback to the cache in `~/.cache/david-sources`. It then does three things:
  - Checks that every catalog `text` equals the fresh normalized source, that every `quote` piece is a substring in order, and that every Hebrew `ref` label matches `refEn`.
  - Scans `src/**/*.ts`, `*.html` and `README.md` for pointed Hebrew shown as a quotation: `ui.verse(text, ref)`, `ui.caption(title, '"quote" · ref')`, `ui.toast(title, 'quote<small>ref</small>')`, `"quote"<span>ref</span>` HTML, README `"quote" (ref)`, and any other `"…"` pointed fragment (searched in the cited chapters).
  - Checks catalog uses: `quoteText('id')` must use a known id, and a hand-typed ref next to it must equal the catalog ref.
- Options: `--cache-only` (offline), `--quiet`, `--json FILE`. Exit codes: 0 means all exact (warnings allowed), 1 means at least one mismatch, 2 means a fetch or setup error.

---

## 2. Audit of every quotation currently in the game

The snapshot below was taken from the tree before integration (`tools/sources/audit_snapshot.json`). "Exact text to display" is the corrected string, and it is exactly the catalog quotation.

| # | Location | Kind | Current text (as shipped) | Verdict | Exact text to display | Reference | Catalog id |
|---|---|---|---|---|---|---|---|
| 1 | `src/gameplay/Story.ts:288` | ui.verse | וַיִּבְחַר לוֹ חֲמִשָּׁה חַלֻּקֵי אֲבָנִים מִן הַנַּחַל, וַיָּשֶׂם אֹתָם בִּכְלִי הָרֹעִים | FAIL — not an exact substring of the cited source | וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל וַיָּשֶׂם אֹתָם בִּכְלִי הָרֹעִים | שְׁמוּאֵל א׳ יז, מ | `s1_17_40_stones` |
| 2 | `src/gameplay/Story.ts:304` | ui.verse | כָּל זֶה קֹלֵעַ בָּאֶבֶן אֶל הַשַּׂעֲרָה וְלֹא יַחֲטִא | FAIL — not an exact substring of the cited source | כָּל־זֶה קֹלֵעַ בָּאֶבֶן אֶל־הַשַּׂעֲרָה וְלֹא יַחֲטִא | שׁוֹפְטִים כ, טז | `jdg_20_16_slingers` |
| 3 | `src/gameplay/Story.ts:466` | ui.verse | וְדָוִד בֶּן אִישׁ אֶפְרָתִי הַזֶּה מִבֵּית לֶחֶם יְהוּדָה וּשְׁמוֹ יִשַׁי | FAIL — not an exact substring of the cited source | וְדָוִד בֶּן־אִישׁ אֶפְרָתִי הַזֶּה מִבֵּית לֶחֶם יְהוּדָה וּשְׁמוֹ יִשַׁי | שְׁמוּאֵל א׳ יז, יב | `s1_17_12_ephrathite` |
| 4 | `src/gameplay/Story.ts:468` | ui.verse | עוֹד שָׁאַר הַקָּטָן, וְהִנֵּה רֹעֶה בַּצֹּאן | FAIL — not an exact substring of the cited source | עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן | שְׁמוּאֵל א׳ טז, יא | `s1_16_11_youngest` |
| 5 | `src/gameplay/Story.ts:469` | ui.verse | וְהוּא אַדְמוֹנִי עִם יְפֵה עֵינַיִם וְטוֹב רֹאִי | FAIL — not an exact substring of the cited source | וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי | שְׁמוּאֵל א׳ טז, יב | `s1_16_12_ruddy` |
| 6 | `src/gameplay/Story.ts:568` | ui.verse | וּבָא הָאֲרִי וְאֶת הַדּוֹב, וְנָשָׂא שֶׂה מֵהָעֵדֶר | FAIL — not an exact substring of the cited source | וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר | שְׁמוּאֵל א׳ יז, לד | `s1_17_34_bear` |
| 7 | `src/gameplay/Story.ts:760` | ui.verse | וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו | OK | וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_smote_delivered` |
| 8 | `src/gameplay/Story.ts:821` | ui.verse | וַיָּקָם עָלַי | OK | וַיָּקָם עָלַי | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_rose` |
| 9 | `src/gameplay/Story.ts:880` | ui.verse | ה׳ רֹעִי לֹא אֶחְסָר | OK | ה׳ רֹעִי לֹא אֶחְסָר | תְּהִלִּים כג, א | `ps_23_1_shepherd` |
| 10 | `src/gameplay/Story.ts:923` | ui.verse | וְהֶחֱזַקְתִּי בִּזְקָנוֹ | OK | וְהֶחֱזַקְתִּי בִּזְקָנוֹ | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_beard` |
| 11 | `src/gameplay/Story.ts:994` | ui.verse | וְהִכִּתִיו וַהֲמִיתִּיו | OK | וְהִכִּתִיו וַהֲמִיתִּיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_slew` |
| 12 | `src/gameplay/Story.ts:1086` | ui.verse | ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב, הוּא יַצִּילֵנִי | FAIL — not an exact substring of the cited source | ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי | שְׁמוּאֵל א׳ יז, לז | `s1_17_37_delivered_me` |
| 13 | `src/gameplay/Story.ts:1087` | ui.verse | גַּם כִּי אֵלֵךְ בְּגֵיא צַלְמָוֶת לֹא אִירָא רָע כִּי אַתָּה עִמָּדִי; שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי | FAIL — not an exact substring of the cited source | גַּם כִּי־אֵלֵךְ בְּגֵיא צַלְמָוֶת לֹא־אִירָא רָע כִּי־אַתָּה עִמָּדִי שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי | תְּהִלִּים כג, ד | `ps_23_4_rod_staff` |
| 14 | `src/gameplay/Story.ts:226` | ui.toast | דָּוִד הָיָה מוֹצִיא אֶת הַטְּלָאִים הַקְּטַנִּים לִרְעוֹת רִאשׁוֹנִים — שֶׁיֹּאכְלוּ אֶת הָעֵשֶׂב הָרַךְ. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא: מִי שֶׁיּוֹדֵעַ לִרְעוֹת צֹאן אִישׁ לְפִי כֹּחוֹ — יָבוֹא וְיִרְעֶה אֶת עַמִּי. | FAIL — paraphrase labelled "according to" a source - replace with an exact quotation | בָּדַק לְדָוִד בַּצֹּאן וּמְצָאוֹ רוֹעֶה יָפֶה … הָיָה מוֹנֵעַ הַגְּדוֹלִים מִפְּנֵי הַקְּטַנִּים, וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ, וְאַחַר כָּךְ מוֹצִיא הַזְּקֵנִים כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הַבֵּינוֹנִית, וְאַחַר כָּךְ מוֹצִיא הַבַּחוּרִים שֶׁיִּהְיוּ אוֹכְלִין עֵשֶׂב הַקָּשֶׁה. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי | שְׁמוֹת רַבָּה ב, ב | `shr_2_2_flock` |
| 15 | `src/gameplay/Story.ts:467` | ui.caption | וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם | OK | וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם | בְּרֵאשִׁית לה, יט | `gen_35_19_rachel_buried` |
| 16 | `src/gameplay/Story.ts:625` | quoted fragment (no reference) | וְיָצָאתִי אַחֲרָיו | OK | וְיָצָאתִי אַחֲרָיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_went_after` |
| 17 | `src/gameplay/Story.ts:650` | quoted fragment (no reference) | וְהִכִּתִיו | OK | וְהִכִּתִיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_smote` |
| 18 | `src/gameplay/Story.ts:697` | quoted fragment (no reference) | וְהִצַּלְתִּי מִפִּיו | OK | וְהִצַּלְתִּי מִפִּיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_delivered` |
| 19 | `src/ui/UI.ts:55` | html quote | ה׳ רֹעִי לֹא אֶחְסָר. בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי | FAIL — not an exact substring of the cited source | ה׳ רֹעִי לֹא אֶחְסָר בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי | תְּהִלִּים כג, א–ב | `ps_23_1_2_loading` |
| 20 | `src/ui/UI.ts:327` | html quote | גַּם אֶת הָאֲרִי גַּם הַדּוֹב הִכָּה עַבְדֶּךָ... ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב, הוּא יַצִּילֵנִי מִיַּד הַפְּלִשְׁתִּי הַזֶּה | FAIL — not an exact substring of the cited source | גַּם אֶת־הָאֲרִי גַּם־הַדֹּב הִכָּה עַבְדֶּךָ … ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי מִיַּד הַפְּלִשְׁתִּי הַזֶּה | שְׁמוּאֵל א׳ יז, לו–לז | `s1_17_36_37_endcard` |
| 21 | `src/ui/UI.ts:328` | html quote | מַלֵּא קַרְנְךָ שֶׁמֶן וְלֵךְ אֶשְׁלָחֲךָ אֶל יִשַׁי בֵּית הַלַּחְמִי, כִּי רָאִיתִי בְּבָנָיו לִי מֶלֶךְ | FAIL — not an exact substring of the cited source | מַלֵּא קַרְנְךָ שֶׁמֶן וְלֵךְ אֶשְׁלָחֲךָ אֶל־יִשַׁי בֵּית־הַלַּחְמִי כִּי־רָאִיתִי בְּבָנָיו לִי מֶלֶךְ | שְׁמוּאֵל א׳ טז, א | `s1_16_1_fill_horn` |
| 22 | `README.md:42` | quoted fragment (no reference) | וּבָא הָאֲרִי וְאֶת הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר | FAIL — quoted fragment not found verbatim in any cited source | וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר | שְׁמוּאֵל א׳ יז, לד | `s1_17_34_bear` |
| 23 | `README.md:43` | quoted fragment (no reference) | וְיָצָאתִי אַחֲרָיו | OK | וְיָצָאתִי אַחֲרָיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_went_after` |
| 24 | `README.md:44` | quoted fragment (no reference) | וְהִכִּתִיו | OK | וְהִכִּתִיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_smote` |
| 25 | `README.md:45` | quoted fragment (no reference) | וְהִצַּלְתִּי מִפִּיו | OK | וְהִצַּלְתִּי מִפִּיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_delivered` |
| 26 | `README.md:46` | quoted fragment (no reference) | וַיָּקָם עָלַי | OK | וַיָּקָם עָלַי | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_rose` |
| 27 | `README.md:48` | quoted fragment (no reference) | וְהֶחֱזַקְתִּי בִּזְקָנוֹ | OK | וְהֶחֱזַקְתִּי בִּזְקָנוֹ | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_beard` |
| 28 | `README.md:49` | quoted fragment (no reference) | וְהִכִּתִיו וַהֲמִיתִּיו | OK | וְהִכִּתִיו וַהֲמִיתִּיו | שְׁמוּאֵל א׳ יז, לה | `s1_17_35_slew` |
| 29 | `README.md:50` | quoted fragment (no reference) | ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב | OK | ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב | שְׁמוּאֵל א׳ יז, לז |  |
| 30 | `README.md:50` | quoted fragment (no reference) | שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי | OK | שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי | תְּהִלִּים כג, ד [ps_23_4_rod_staff] |  |
| 31 | `README.md:54` | markdown quote | אַדְמוֹנִי עִם יְפֵה עֵינַיִם וְטוֹב רֹאִי | FAIL — not an exact substring of the cited source | אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי | שְׁמוּאֵל א׳ טז, יב | `readme_s1_16_12_admoni` |
| 32 | `README.md:56` | markdown quote | בּוֹר בֵּית לֶחֶם אֲשֶׁר בַּשַּׁעַר | FAIL — not an exact substring of the cited source | מִבֹּאר בֵּית־לֶחֶם אֲשֶׁר בַּשָּׁעַר | שְׁמוּאֵל ב׳ כג, טו | `s2_23_15_well` |
| 33 | `README.md:57` | markdown quote | וַיַּצֵּב יַעֲקֹב מַצֵּבָה עַל קְבֻרָתָהּ | FAIL — not an exact substring of the cited source | וַיַּצֵּב יַעֲקֹב מַצֵּבָה עַל־קְבֻרָתָהּ | בְּרֵאשִׁית לה, כ | `gen_35_20_pillar` |
| 34 | `src/gameplay/Story.ts:231` | narration | לַקֵּט חֲמִשָּׁה חַלֻּקֵי אֲבָנִים מִן הַנַּחַל | WARN — narration reproduces scripture wording ("חמשה חלקי אבנים מן הנחל") without quotation marks |  | שְׁמוּאֵל א׳ יז, מ |  |

What the failures have in common:

1. **Maqaf replaced by a space.** Examples: `עִם יְפֵה` for `עִם־יְפֵה`, `חַלֻּקֵי אֲבָנִים` for `חַלֻּקֵי־אֲבָנִים`, `אֶל יִשַׁי` for `אֶל־יִשַׁי`. This affects 1 Sam 16:1, 16:12, 17:12, 17:34, 17:36, 17:40, Judg 20:16, Ps 23:4 and Gen 35:20.
2. **Added punctuation inside a quotation.** Commas appear in 16:1, 16:11, 17:34, 17:37 and 17:40. There is a semicolon in Ps 23:4 and a period between Ps 23:1 and 23:2.
3. **Wrong spelling.** 17:36 `הַדּוֹב` should be `הַדֹּב` (Aleppo). README 2 Sam 23:15 `בּוֹר … בַּשַּׁעַר` should be `מִבֹּאר בֵּית־לֶחֶם אֲשֶׁר בַּשָּׁעַר`.
4. **Paraphrase presented as a source** (Story.ts:226, "עַל פִּי שְׁמוֹת רַבָּה ב, ב"). The shipped text is not in the midrash; for example, it has "רִאשׁוֹנִים" and "אֶת עַמִּי". It is replaced by the exact words of Shemot Rabbah 2:2 below.
5. **Chapter-only reference** (loading screen "תהלים כג"). It should be `תְּהִלִּים כג, א–ב`.

Quotations that were already exact: the 17:35 fragments (verse and objective texts), Ps 23:1, the Rachel caption (Gen 35:19), and README's 17:35 and 17:37 fragments.

### 2.1 Replacement of the midrash toast (Story.ts:226)

The shipped text was a paraphrase. The exact text of **Shemot Rabbah 2:2** (Torat Emet, vocalized; the consonants are identical to the public-domain Daat edition) is:

> בָּדַק לְדָוִד בַּצֹּאן וּמְצָאוֹ רוֹעֶה יָפֶה … הָיָה מוֹנֵעַ הַגְּדוֹלִים מִפְּנֵי הַקְּטַנִּים, וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ, וְאַחַר כָּךְ מוֹצִיא הַזְּקֵנִים כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הַבֵּינוֹנִית, וְאַחַר כָּךְ מוֹצִיא הַבַּחוּרִים שֶׁיִּהְיוּ אוֹכְלִין עֵשֶׂב הַקָּשֶׁה. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי
>
> — **שְׁמוֹת רַבָּה ב, ב** · Shemot Rabbah 2:2 · `shr_2_2_flock`
>
> _He tested David with the sheep and found him a good shepherd... He would hold back the big ones for the sake of the small ones; he brought out the small ones to graze so they would eat the soft grass, then the old ones to eat the middling grass, then the young strong ones to eat the hard grass. Said the Holy One, blessed be He: whoever knows how to shepherd the flock, each according to its strength, let him come and shepherd My people._
>
> Note: Vocalized text of the Torat Emet edition (as on Sefaria); consonantal text verified identical to the Daat edition (public domain). The midrash expounds Ps 78:70-71.

Shorter variant (same passage, two exact pieces):

> וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ … אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי
>
> — **שְׁמוֹת רַבָּה ב, ב** · Shemot Rabbah 2:2 · `shr_2_2_flock_short`
>
> _He brought out the small ones to graze so they would eat the soft grass... Said the Holy One, blessed be He: whoever knows how to shepherd the flock, each according to its strength, let him come and shepherd My people._

The midrash expounds Psalms 78:70–71 (`ps_78_70_71_chose_david`). In the same passage, the story of the shepherd who **carries the tired kid on his shoulder** is told about **Moses**, not David (`shr_2_2_moses_kid`). The game's ending, where David carries the rescued lamb on his shoulders, is therefore an artistic image and must not be captioned with that text.

### 2.2 Integration mapping (for the owner of Story.ts / UI.ts / README.md)

Helpers exported by `src/content/sources.ts`: `quoteText(id)`, `sourceRef(id)`, `verseArgs(id)` (for `ui.verse`), `quoteWithRef(id)` (plain text; the reference uses no-break spaces) and `quoteWithRefHtml(id)`. The HTML helper sets the quotation in the serif Hebrew face with no letter-spacing and keeps the reference on one line; `dev/sources.html` shows that the sans caption style otherwise spreads the niqqud apart and wraps the reference mid-way.

```ts
import { quoteText, sourceRef, verseArgs, quoteWithRefHtml } from '../content/sources';

// Story.ts intro cues (current timeline)
this.ui.verse(...verseArgs('s1_17_12_ephrathite'), 4.6);                       // t=11.2
this.ui.caption('מַצֶּבֶת קְבֻרַת רָחֵל', quoteWithRefHtml('gen_35_19_rachel_buried'));  // t=16.2 (text already exact; the helper keeps the ref unbroken and the quote in the serif face)
this.ui.verse(...verseArgs('s1_16_11_youngest'), 5);                           // t=22.8
this.ui.verse(...verseArgs('s1_16_12_ruddy'), 6);                              // t=29.5
// Story.ts:226 midrash toast
this.ui.toast('מִדְרָשׁ', `${quoteText('shr_2_2_flock')}<small>${sourceRef('shr_2_2_flock')}</small>`, 16);
//   (or 'shr_2_2_flock_short' with ~11 s)
// Story.ts:288 / 304 / 568
this.ui.verse(...verseArgs('s1_17_40_stones'), 6);
this.ui.verse(...verseArgs('jdg_20_16_slingers'), 6);
this.ui.verse(...verseArgs('s1_17_34_bear'), 5);
// Story.ts:625 / 650 / 697 objective subtitles (already exact; optional switch to the catalog)
`"${quoteText('s1_17_35_went_after')}" — הַכֵּה אוֹתוֹ בַּקֶּלַע אוֹ בַּמַּקֵּל`
// Story.ts:760 / 821 / 880 / 923 / 994 (already exact)
this.ui.verse(...verseArgs('s1_17_35_smote_delivered'), 4);
this.ui.verse(...verseArgs('s1_17_35_rose'), 3.5);
this.ui.verse(...verseArgs('ps_23_1_shepherd'), 3);
this.ui.verse(...verseArgs('s1_17_35_beard'), 3.5);
this.ui.verse(...verseArgs('s1_17_35_slew'), 5);
// Story.ts:1086 / 1087 ending
this.ui.verse(...verseArgs('s1_17_37_delivered_me'), 6.5);
this.ui.verse(...verseArgs('ps_23_4_rod_staff'), 7);
// UI.ts:55 loading quote
`<div class="ld-quote">"${quoteText('ps_23_1_2_loading')}"<span>${sourceRef('ps_23_1_2_loading')}</span></div>`
// UI.ts:327 / 328 end card
`<div class="e-verse">"${quoteText('s1_17_36_37_endcard')}"<span>${sourceRef('s1_17_36_37_endcard')}</span></div>`
`<div class="e-next-verse">"${quoteText('s1_16_1_fill_horn')}"<span>${sourceRef('s1_16_1_fill_horn')}</span></div>`
```

README.md needs these corrections:

| Line | Replace with | Reference |
|---|---|---|
| 42 | וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר | שְׁמוּאֵל א׳ יז, לד |
| 54 | אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי | שְׁמוּאֵל א׳ טז, יב |
| 56 | מִבֹּאר בֵּית־לֶחֶם אֲשֶׁר בַּשָּׁעַר | שְׁמוּאֵל ב׳ כג, טו |
| 57 | וַיַּצֵּב יַעֲקֹב מַצֵּבָה עַל־קְבֻרָתָהּ | בְּרֵאשִׁית לה, כ |

---

## 3. Dossier: Saul and his court when the intro takes place

### 3.1 Chronology: where the intro sits

The intro takes place **after 1 Samuel 15** (the war with Amalek, Samuel's rebuke at Gilgal) and **before 16:1** (God sends Samuel to Jesse). The last verses before the gap are:

> וְשָׁאוּל עָלָה אֶל־בֵּיתוֹ גִּבְעַת שָׁאוּל
>
> — **שְׁמוּאֵל א׳ טו, לד** · I Samuel 15:34 · `s1_15_34_gibeah_home`
>
> _...and Saul went up to his house, to Gibeah of Saul._
>
> Note: The last verse about Saul before 16:1 - exactly the moment of the intro.

> וְלֹא־יָסַף שְׁמוּאֵל לִרְאוֹת אֶת־שָׁאוּל עַד־יוֹם מוֹתוֹ כִּי־הִתְאַבֵּל שְׁמוּאֵל אֶל־שָׁאוּל
>
> — **שְׁמוּאֵל א׳ טו, לה** · I Samuel 15:35 · `s1_15_35_samuel_mourned`
>
> _And Samuel saw Saul no more until the day of his death, for Samuel mourned for Saul._

The next verse begins the anointing. That is the teaser of chapter 2, already in the end card:

> מַלֵּא קַרְנְךָ שֶׁמֶן וְלֵךְ אֶשְׁלָחֲךָ אֶל־יִשַׁי בֵּית־הַלַּחְמִי כִּי־רָאִיתִי בְּבָנָיו לִי מֶלֶךְ
>
> — **שְׁמוּאֵל א׳ טז, א** · I Samuel 16:1 · `s1_16_1_fill_horn`
>
> _Fill your horn with oil and go; I will send you to Jesse the Bethlehemite, for I have provided Me a king among his sons._

**Must not appear in this intro**, because it only happens *after* the anointing (16:13):

> וְרוּחַ ה׳ סָרָה מֵעִם שָׁאוּל וּבִעֲתַתּוּ רוּחַ־רָעָה מֵאֵת ה׳
>
> — **שְׁמוּאֵל א׳ טז, יד** · I Samuel 16:14 · `s1_16_14_evil_spirit`
>
> _Now the spirit of the LORD departed from Saul, and an evil spirit from the LORD terrified him._
>
> Note: Comes only AFTER David's anointing (16:13). It must not be shown or depicted (no madness, no seizures, no lyre-therapy scene) in the chapter-1 intro.

The same applies to everything built on 16:14. The following must not be shown in the intro:

- the lyre-player at court (16:16–23)
- David as armour-bearer (16:21)
- the spear thrown at David (18:10–11, 19:9–10)
- Saul "prophesying" or raging
- Goliath (ch. 17)

Saul in the intro is a king who has just been rejected by Samuel. He is proud, anxious for his honor before the elders, and mourned by Samuel. He is **not** a tormented madman.

> כַּבְּדֵנִי נָא נֶגֶד זִקְנֵי־עַמִּי וְנֶגֶד יִשְׂרָאֵל
>
> — **שְׁמוּאֵל א׳ טו, ל** · I Samuel 15:30 · `s1_15_30_honor`
>
> _Honour me now, I pray you, before the elders of my people and before Israel._

**Seder Olam** (traditional chronology) places the anointing in Saul's second year, with David aged 29. David becomes king at 30 (2 Sam 5:4). The Bible nevertheless calls him **נַעַר** (17:33, 17:42) and "the youngest" (16:11).

> ואותו הפרק נמשח דוד … והוא היה בן כ"ט שנים
>
> — **סֵדֶר עוֹלָם רַבָּה יג, ב** · Seder Olam Rabbah 13:2 · `seder_olam_13_david_29`
>
> _...and in that period David was anointed ... and he was twenty-nine years old._
>
> Note: Seder Olam: Saul reigned (alone) about two years; David was anointed in Saul's second year, aged 29, and became king at 30 (2 Sam 5:4). The Bible still calls him נַעַר (17:33, 17:42).

### 3.2 Saul: stature and appearance

> בָּחוּר וָטוֹב וְאֵין אִישׁ מִבְּנֵי יִשְׂרָאֵל טוֹב מִמֶּנּוּ מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם
>
> — **שְׁמוּאֵל א׳ ט, ב** · I Samuel 9:2 · `s1_9_2_tallest`
>
> _...a choice young man and goodly; there was not among the children of Israel a goodlier person than he; from his shoulders and upward he was taller than any of the people._
>
> Note: Describes Saul when he was chosen (years earlier); the portrait still holds.

> וַיִּגְבַּהּ מִכָּל־הָעָם מִשִּׁכְמוֹ וָמָעְלָה
>
> — **שְׁמוּאֵל א׳ י, כג** · I Samuel 10:23 · `s1_10_23_head_above`
>
> _...and he was taller than any of the people from his shoulders and upward._

> הַרְּאִיתֶם אֲשֶׁר בָּחַר־בּוֹ ה׳ כִּי אֵין כָּמֹהוּ בְּכָל־הָעָם וַיָּרִעוּ כָל־הָעָם וַיֹּאמְרוּ יְחִי הַמֶּלֶךְ
>
> — **שְׁמוּאֵל א׳ י, כד** · I Samuel 10:24 · `s1_10_24_long_live`
>
> _Do you see him whom the LORD has chosen, that there is none like him among all the people? And all the people shouted and said: Long live the king!_

- The Targum renders **בָּחוּר וָטוֹב** as `עוּלֵים וְשַׁפִּיר`, "a young man and handsome". Radak explains **טוֹב** as good in form and appearance, and Metzudat David as "chosen in his deeds and handsome".
- At the time of the intro, Saul is a **mature man**: his son Jonathan already commands a thousand men (13:2). His age is not stated in the text. 13:1 is famously cryptic, and the Talmud reads it morally (see 3.8).
- Torah law shapes his grooming: a full beard, and the corners of the head and beard not shaven.

> לֹא תַקִּפוּ פְּאַת רֹאשְׁכֶם וְלֹא תַשְׁחִית אֵת פְּאַת זְקָנֶךָ
>
> — **וַיִּקְרָא יט, כז** · Leviticus 19:27 · `lev_19_27_beard`
>
> _You shall not round the corners of your heads, nor destroy the corners of your beard._
>
> Note: Adult Israelite men: full beards, side hair not rounded off.

- Rashi (17:38): Saul's garments *miraculously fitted* David, although they belonged to Saul, "who was taller than all the people from his shoulders upward". A normal fit would not have been expected.

Character traits from the text, useful for performance:

- Modesty at his election: הִנֵּה־הוּא נֶחְבָּא אֶל־הַכֵּלִים (שְׁמוּאֵל א׳ י, כב).
- Restraint toward his detractors: וּבְנֵי בְלִיַּעַל אָמְרוּ מַה־יֹּשִׁעֵנוּ זֶה וַיִּבְזֻהוּ וְלֹא־הֵבִיאוּ לוֹ מִנְחָה וַיְהִי כְּמַחֲרִישׁ (שְׁמוּאֵל א׳ י, כז).
- A monument to himself after the victory: וְהִנֵּה מַצִּיב לוֹ יָד (שְׁמוּאֵל א׳ טו, יב).
- Samuel's rebuke: הֲלוֹא אִם־קָטֹן אַתָּה בְּעֵינֶיךָ רֹאשׁ שִׁבְטֵי יִשְׂרָאֵל אָתָּה (שְׁמוּאֵל א׳ טו, יז).
- Even as king he still followed his oxen in the field: וְהִנֵּה שָׁאוּל בָּא אַחֲרֵי הַבָּקָר מִן־הַשָּׂדֶה (שְׁמוּאֵל א׳ יא, ה).

### 3.3 Gibeah of Saul: his home, not a "palace"

The Bible calls it **בֵּיתוֹ**, "his house", at **גִּבְעַת שָׁאוּל**. In the books of Samuel, היכל is used only for the sanctuary (1 Sam 1:9; 3:3; 2 Sam 22:7) and ארמון never occurs. The phrase "בית המלך" appears only for David's house (2 Sam 11:8–9; 15:35; 19:19). The tool checked this against the full text of 1–2 Samuel.

> וְגַם־שָׁאוּל הָלַךְ לְבֵיתוֹ גִּבְעָתָה וַיֵּלְכוּ עִמּוֹ הַחַיִל אֲשֶׁר־נָגַע אֱלֹהִים בְּלִבָּם
>
> — **שְׁמוּאֵל א׳ י, כו** · I Samuel 10:26 · `s1_10_26_valiant_men`
>
> _And Saul also went to his house to Gibeah, and there went with him the band of men whose hearts God had touched._

> וְשָׁאוּל עָלָה אֶל־בֵּיתוֹ גִּבְעַת שָׁאוּל
>
> — **שְׁמוּאֵל א׳ טו, לד** · I Samuel 15:34 · `s1_15_34_gibeah_home`
>
> _...and Saul went up to his house, to Gibeah of Saul._
>
> Note: The last verse about Saul before 16:1 - exactly the moment of the intro.

> חָרְדָה הָרָמָה גִּבְעַת שָׁאוּל נָסָה
>
> — **יְשַׁעְיָהוּ י, כט** · Isaiah 10:29 · `isa_10_29_gibeah`
>
> _Ramah trembles; Gibeah of Saul has fled._
>
> Note: Geography: Gibeah of Saul lies on the ridge road north of Jerusalem, next to Ramah and Geba.

> בְּגִבְעַת שָׁאוּל בְּחִיר ה׳
>
> — **שְׁמוּאֵל ב׳ כא, ו** · II Samuel 21:6 · `s2_21_6_gibeah`
>
> _...in Gibeah of Saul, the chosen of the LORD._
>
> Note: Ketiv ינתן, qere יֻתַּן.

> ובנה שם שאול בית מלוכה
>
> — **רַדַ״ק, שְׁמוּאֵל א׳ טו, לד** · Radak on I Samuel 15:34:1 · `radak_s1_15_34_royal_house`
>
> _Radak: possibly this is Gibeah of Benjamin, and Saul built a royal house there, hence it was named after him; or it was another hill that Saul built up._

Radak's "בית מלוכה" is a *possibility* ("אפשר"), not a textual fact. It is the most a caption may claim.

**The tamarisk on the height.** This is the Bible's one image of Saul holding court:

> וְשָׁאוּל יוֹשֵׁב בַּגִּבְעָה תַּחַת־הָאֶשֶׁל בָּרָמָה וַחֲנִיתוֹ בְיָדוֹ וְכָל־עֲבָדָיו נִצָּבִים עָלָיו
>
> — **שְׁמוּאֵל א׳ כב, ו** · I Samuel 22:6 · `s1_22_6_tamarisk`
>
> _...and Saul was sitting in Gibeah under the tamarisk tree on the height, with his spear in his hand, and all his servants standing about him._
>
> Note: Chronology: this scene is from a later time (David already a fugitive). The quoted words omit the first clause about David and show only the portrait of Saul's court.

> וּמוּרְנִיתֵיהּ בִּידֵיהּ
>
> — **תַּרְגּוּם יוֹנָתָן, שְׁמוּאֵל א׳ כב, ו** · Targum Jonathan on I Samuel 22:6 · `tj_s1_22_6_spear`
>
> _Targum: "and his spear (murnita) in his hand"._

> ברמה. מקום היה בגבע' שאול והיה גבוה ונקרא רמה ואין זה רמת שמואל כי הוא בגבע' היה, ולדברי בעל הדרש הוא רמת שמואל שאמר וכי מה ענין גבעה אצל רמה אלא שאול יושב בגבעה במלכות בזכות האשל הגדול אשר ברמה והוא שמואל שהיה מתפלל עליו:
>
> — **רַדַ״ק, שְׁמוּאֵל א׳ כב, ו** · Radak on I Samuel 22:6:3 · `radak_s1_22_6_height`
>
> _Radak: "Ramah" was a high place in Gibeah of Saul, called ramah because it was elevated._

> וְכִי מָה עִנְיַן גִּבְעָה אֵצֶל רָמָה? אֶלָּא לוֹמַר לְךָ: מִי גָּרַם לְשָׁאוּל שֶׁיָּשַׁב בַּגִּבְעָה שְׁתֵּי שָׁנִים וּמֶחֱצָה — תְּפִלָּתוֹ שֶׁל שְׁמוּאֵל הָרָמָתִי
>
> — **תַּעֲנִית ה ע״ב** · Taanit 5b:6 · `taan_5b_tamarisk`
>
> _What has Gibeah to do with Ramah? It teaches: what caused Saul to sit [as king] in Gibeah two and a half years? The prayer of Samuel of Ramah._

> תַּחַת הָאֶשֶׁל בָּרָמָה. אַחַת שֶׁהָיְתָה בִּגְבוּל בִּנְיָמִן וְרַבּוֹתֵינוּ אָמְרוּ (תענית ה ב): הִיא הָיְתָה רָמָה שֶׁל שְׁמוּאֵל, וּשְׁנֵי מְקוֹמוֹת הֵן, וְכֵן מִדְרָשׁוֹ: וְשָׁאוּל יוֹשֵׁב בַּגִּבְעָה, בִּזְכוּת הָאֶשֶׁל הַגָּדוֹל אֲשֶׁר בָּרָמָה, שֶׁהָיָה מִתְפַּלֵּל עָלָיו:
>
> — **רַשִׁ״י, שְׁמוּאֵל א׳ כב, ו** · Rashi on I Samuel 22:6:2 · `rashi_s1_22_6_tamarisk`
>
> _Rashi: a (place called) Ramah in the border of Benjamin; the Rabbis (Taanit 5b) say it alludes to Samuel's Ramah - Saul sat in Gibeah by the merit of the great "tamarisk" in Ramah (Samuel) who prayed for him._

Earlier, during the Philistine war, Saul also sat outdoors under a tree:

> וְשָׁאוּל יוֹשֵׁב בִּקְצֵה הַגִּבְעָה תַּחַת הָרִמּוֹן אֲשֶׁר בְּמִגְרוֹן
>
> — **שְׁמוּאֵל א׳ יד, ב** · I Samuel 14:2 · `s1_14_2_pomegranate`
>
> _And Saul was staying in the outskirts of Gibeah under the pomegranate tree in Migron._

The tamarisk frames Saul's life. He holds court under one, and his bones are buried under one:

> וַיִּקְחוּ אֶת־עַצְמֹתֵיהֶם וַיִּקְבְּרוּ תַחַת־הָאֶשֶׁל בְּיָבֵשָׁה וַיָּצֻמוּ שִׁבְעַת יָמִים
>
> — **שְׁמוּאֵל א׳ לא, יג** · I Samuel 31:13 · `s1_31_13_tamarisk_jabesh`
>
> _They took their bones and buried them under the tamarisk tree in Jabesh._
>
> Note: The tamarisk frames Saul's story: he holds court under one (22:6) and is buried under one.

### 3.4 The court

**Servants standing about the king, and the runners (guards):**

> וַיֹּאמֶר שָׁאוּל לַעֲבָדָיו הַנִּצָּבִים עָלָיו שִׁמְעוּ־נָא בְּנֵי יְמִינִי גַּם־לְכֻלְּכֶם יִתֵּן בֶּן־יִשַׁי שָׂדוֹת וּכְרָמִים לְכֻלְּכֶם יָשִׂים שָׂרֵי אֲלָפִים וְשָׂרֵי מֵאוֹת
>
> — **שְׁמוּאֵל א׳ כב, ז** · I Samuel 22:7 · `s1_22_7_fields_vineyards`
>
> _Hear now, you Benjaminites: will the son of Jesse give every one of you fields and vineyards, will he make you all captains of thousands and captains of hundreds?_

> וַיֹּאמֶר הַמֶּלֶךְ לָרָצִים הַנִּצָּבִים עָלָיו
>
> — **שְׁמוּאֵל א׳ כב, יז** · I Samuel 22:17 · `s1_22_17_runners`
>
> _And the king said to the runners (guards) that stood about him..._
>
> Note: Context is the massacre at Nob - never quote in the intro. Ketiv אזנו, qere אָזְנִי.

**Commander of the army, and the mighty men he gathered:**

> וְשֵׁם שַׂר־צְבָאוֹ אֲבִינֵר בֶּן־נֵר דּוֹד שָׁאוּל
>
> — **שְׁמוּאֵל א׳ יד, נ** · I Samuel 14:50 · `s1_14_50_abner`
>
> _...and the name of the captain of his host was Abner son of Ner, Saul's uncle._
>
> Note: The verse spells the name אֲבִינֵר; elsewhere אַבְנֵר.

> וְאַבְנֵר בֶּן־נֵר שַׂר־צָבָא אֲשֶׁר לְשָׁאוּל
>
> — **שְׁמוּאֵל ב׳ ב, ח** · II Samuel 2:8 · `s2_2_8_abner`
>
> _Now Abner son of Ner, captain of Saul's host..._

> וַתְּהִי הַמִּלְחָמָה חֲזָקָה עַל־פְּלִשְׁתִּים כֹּל יְמֵי שָׁאוּל וְרָאָה שָׁאוּל כָּל־אִישׁ גִּבּוֹר וְכָל־בֶּן־חַיִל וַיַּאַסְפֵהוּ אֵלָיו
>
> — **שְׁמוּאֵל א׳ יד, נב** · I Samuel 14:52 · `s1_14_52_mighty_men`
>
> _And there was sore war against the Philistines all the days of Saul; and whenever Saul saw any mighty man or any valiant man, he took him unto him._

> וַיִּבְחַר־לוֹ שָׁאוּל שְׁלֹשֶׁת אֲלָפִים מִיִּשְׂרָאֵל וַיִּהְיוּ עִם־שָׁאוּל אַלְפַּיִם בְּמִכְמָשׂ וּבְהַר בֵּית־אֵל וְאֶלֶף הָיוּ עִם־יוֹנָתָן בְּגִבְעַת בִּנְיָמִין וְיֶתֶר הָעָם שִׁלַּח אִישׁ לְאֹהָלָיו
>
> — **שְׁמוּאֵל א׳ יג, ב** · I Samuel 13:2 · `s1_13_2_three_thousand`
>
> _Saul chose three thousand men of Israel: two thousand with Saul in Michmash and in the hill-country of Beth-el, and a thousand with Jonathan in Gibeah of Benjamin._

> וְשָׁאוּל לָכַד הַמְּלוּכָה עַל־יִשְׂרָאֵל וַיִּלָּחֶם סָבִיב בְּכָל־אֹיְבָיו … וּבְכֹל אֲשֶׁר־יִפְנֶה יַרְשִׁיעַ
>
> — **שְׁמוּאֵל א׳ יד, מז** · I Samuel 14:47 · `s1_14_47_took_kingship`
>
> _So Saul took the kingdom over Israel and fought against all his enemies on every side... and wherever he turned, he vanquished them._

> וַיַּעַשׂ חַיִל וַיַּךְ אֶת־עֲמָלֵק וַיַּצֵּל אֶת־יִשְׂרָאֵל מִיַּד שֹׁסֵהוּ
>
> — **שְׁמוּאֵל א׳ יד, מח** · I Samuel 14:48 · `s1_14_48_valor`
>
> _And he did valiantly, and smote the Amalekites, and delivered Israel out of the hands of them that spoiled them._

**Family.** Wife Ahinoam; sons Jonathan, Ishvi and Malchishua; daughters Merab and Michal:

> וַיִּהְיוּ בְּנֵי שָׁאוּל יוֹנָתָן וְיִשְׁוִי וּמַלְכִּישׁוּעַ וְשֵׁם שְׁתֵּי בְנֹתָיו שֵׁם הַבְּכִירָה מֵרַב וְשֵׁם הַקְּטַנָּה מִיכַל וְשֵׁם אֵשֶׁת שָׁאוּל אֲחִינֹעַם בַּת־אֲחִימָעַץ וְשֵׁם שַׂר־צְבָאוֹ אֲבִינֵר בֶּן־נֵר דּוֹד שָׁאוּל וְקִישׁ אֲבִי־שָׁאוּל וְנֵר אֲבִי־אַבְנֵר בֶּן־אֲבִיאֵל
>
> — **שְׁמוּאֵל א׳ יד, מט–נא** · I Samuel 14:49-51 · `s1_14_49_51_family`
>
> _Saul's sons Jonathan, Ishvi and Malchishua; daughters Merab (elder) and Michal (younger); wife Ahinoam daughter of Ahimaaz; Abner son of Ner, Saul's uncle; Kish father of Saul._

> וְנֵר הוֹלִיד אֶת־קִישׁ וְקִישׁ הוֹלִיד אֶת־שָׁאוּל וְשָׁאוּל הוֹלִיד אֶת־יְהוֹנָתָן וְאֶת־מַלְכִּישׁוּעַ וְאֶת־אֲבִינָדָב וְאֶת־אֶשְׁבָּעַל
>
> — **דִּבְרֵי הַיָּמִים א׳ ח, לג** · I Chronicles 8:33 · `chr1_8_33_genealogy`
>
> _Ner begot Kish, Kish begot Saul, Saul begot Jonathan, Malchishua, Abinadab and Eshbaal._

**Other members of the household:**

> הַנַּעַר נֹשֵׂא כֵלָיו
>
> — **שְׁמוּאֵל א׳ יד, א** · I Samuel 14:1 · `s1_14_1_armor_bearer`
>
> _...the young man who bore his armour._
>
> Note: Saul and Jonathan each had an armour-bearer (31:4).

> וּשְׁמוֹ דֹּאֵג הָאֲדֹמִי אַבִּיר הָרֹעִים אֲשֶׁר לְשָׁאוּל
>
> — **שְׁמוּאֵל א׳ כא, ח** · I Samuel 21:8 · `s1_21_8_doeg`
>
> _...his name was Doeg the Edomite, the chief of the herdsmen that belonged to Saul._

**The king's seat and the new-moon meal.** This takes place later, but it shows a court custom:

> וַיֵּשֶׁב הַמֶּלֶךְ עַל־מוֹשָׁבוֹ כְּפַעַם בְּפַעַם אֶל־מוֹשַׁב הַקִּיר
>
> — **שְׁמוּאֵל א׳ כ, כד–כה** · I Samuel 20:24-25 · `s1_20_24_25_new_moon`
>
> _The king sat on his seat as at other times, the seat by the wall; Jonathan rose, and Abner sat by Saul's side._
>
> Note: New-moon feast (later period). 20:24 ketiv עַל, qere אֶל־הַלֶּחֶם. Rashi: the seat at the head of the couch by the wall; they dined reclining on couches.

> שֶׁדַּרְכָּן הָיָה לֶאֱכֹל מְסֻבִּין עַל הַמִּטּוֹת
>
> — **רַשִׁ״י, שְׁמוּאֵל א׳ כ, כה** · Rashi on I Samuel 20:25:2 · `rashi_s1_20_25_reclining`
>
> _Rashi: their custom was to eat reclining on couches._

**What the Bible does *not* give Saul.** No chariots, horsemen or horses are ever attributed to him; his family's animals are donkeys and oxen. Samuel's warning about "the manner of the king" is a warning, not a description of Saul's court:

> וַתֹּאבַדְנָה הָאֲתֹנוֹת לְקִישׁ אֲבִי שָׁאוּל וַיֹּאמֶר קִישׁ אֶל־שָׁאוּל בְּנוֹ קַח־נָא אִתְּךָ אֶת־אַחַד מֵהַנְּעָרִים וְקוּם לֵךְ בַּקֵּשׁ אֶת־הָאֲתֹנֹת
>
> — **שְׁמוּאֵל א׳ ט, ג** · I Samuel 9:3 · `s1_9_3_donkeys`
>
> _The she-asses of Kish, Saul's father, were lost..._
>
> Note: Pack and riding animals of the family: donkeys (no horses at Saul's court).

> וַיֹּאמֶר זֶה יִהְיֶה מִשְׁפַּט הַמֶּלֶךְ אֲשֶׁר יִמְלֹךְ עֲלֵיכֶם אֶת־בְּנֵיכֶם יִקָּח וְשָׂם לוֹ בְּמֶרְכַּבְתּוֹ וּבְפָרָשָׁיו וְרָצוּ לִפְנֵי מֶרְכַּבְתּוֹ וְלָשׂוּם לוֹ שָׂרֵי אֲלָפִים וְשָׂרֵי חֲמִשִּׁים וְלַחֲרֹשׁ חֲרִישׁוֹ וְלִקְצֹר קְצִירוֹ וְלַעֲשׂוֹת כְּלֵי־מִלְחַמְתּוֹ וּכְלֵי רִכְבּוֹ וְאֶת־בְּנוֹתֵיכֶם יִקָּח לְרַקָּחוֹת וּלְטַבָּחוֹת וּלְאֹפוֹת וְאֶת־שְׂדוֹתֵיכֶם וְאֶת־כַּרְמֵיכֶם וְזֵיתֵיכֶם הַטּוֹבִים יִקָּח וְנָתַן לַעֲבָדָיו וְזַרְעֵיכֶם וְכַרְמֵיכֶם יַעְשֹׂר וְנָתַן לְסָרִיסָיו וְלַעֲבָדָיו וְאֶת־עַבְדֵיכֶם וְאֶת־שִׁפְחוֹתֵיכֶם וְאֶת־בַּחוּרֵיכֶם הַטּוֹבִים וְאֶת־חֲמוֹרֵיכֶם יִקָּח וְעָשָׂה לִמְלַאכְתּוֹ צֹאנְכֶם יַעְשֹׂר וְאַתֶּם תִּהְיוּ־לוֹ לַעֲבָדִים
>
> — **שְׁמוּאֵל א׳ ח, יא–יז** · I Samuel 8:11-17 · `s1_8_11_17_king_manner`
>
> _Samuel's warning on "the manner of the king": chariots and horsemen, runners, officers, perfumers, cooks and bakers, fields, vineyards and olive groves, a tenth of seed and flock._
>
> Note: A warning about kingship in general, not a description of Saul's actual court. Saul is never said to have chariots or horses.

### 3.5 Regalia, dress and arms

**The spear is Saul's constant attribute.** It is in his hand at court (22:6), at home (19:9) and at the table (18:10), and it is stuck in the ground at his head when he sleeps in the camp (26:7):

> וַחֲנִיתוֹ מְעוּכָה־בָאָרֶץ מְרַאֲשֹׁתָיו
>
> — **שְׁמוּאֵל א׳ כו, ז** · I Samuel 26:7 · `s1_26_7_spear_ground`
>
> _...his spear stuck in the ground at his head._
>
> Note: MAM prints the trivial ketiv מְרַאֲשֹׁתָו; qere מְרַאֲשֹׁתָיו.

> חָלִילָה לִּי מֵה׳ מִשְּׁלֹחַ יָדִי בִּמְשִׁיחַ ה׳ וְעַתָּה קַח־נָא אֶת־הַחֲנִית אֲשֶׁר מְרַאֲשֹׁתָיו וְאֶת־צַפַּחַת הַמַּיִם וְנֵלְכָה־לָּנוּ וַיִּקַּח דָּוִד אֶת־הַחֲנִית וְאֶת־צַפַּחַת הַמַּיִם מֵרַאֲשֹׁתֵי שָׁאוּל וַיֵּלְכוּ לָהֶם וְאֵין רֹאֶה וְאֵין יוֹדֵעַ וְאֵין מֵקִיץ כִּי כֻלָּם יְשֵׁנִים כִּי תַּרְדֵּמַת ה׳ נָפְלָה עֲלֵיהֶם
>
> — **שְׁמוּאֵל א׳ כו, יא–יב** · I Samuel 26:11-12 · `s1_26_11_12_water_jug`
>
> _...take the spear that is at his head and the cruse of water (tzapachat ha-mayim)..._

> וְהַחֲנִית בְּיַד־שָׁאוּל
>
> — **שְׁמוּאֵל א׳ יח, י–יא** · I Samuel 18:10-11 · `s1_18_10_11_spear`
>
> _...and Saul had his spear in his hand. And Saul cast the spear..._
>
> Note: Evil-spirit episode (after 16:14). Use only as evidence that the spear was Saul's constant attribute; do not show in the intro.

> וְהוּא בְּבֵיתוֹ יֹשֵׁב וַחֲנִיתוֹ בְּיָדוֹ
>
> — **שְׁמוּאֵל א׳ יט, ט–י** · I Samuel 19:9-10 · `s1_19_9_10_spear`
>
> _...as he sat in his house with his spear in his hand._
>
> Note: Evil-spirit episode - do not show in the intro.

Diadem and armlet, which he wore even in his last battle:

> וָאֶקַּח הַנֵּזֶר אֲשֶׁר עַל־רֹאשׁוֹ וְאֶצְעָדָה אֲשֶׁר עַל־זְרֹעוֹ
>
> — **שְׁמוּאֵל ב׳ א, י** · II Samuel 1:10 · `s2_1_10_diadem`
>
> _...and I took the crown (nezer) that was upon his head and the bracelet (etz'adah) that was on his arm._

The robe (me'il) and its corner (kanaf):

> וַיִּכְרֹת אֶת־כְּנַף־הַמְּעִיל אֲשֶׁר־לְשָׁאוּל בַּלָּט
>
> — **שְׁמוּאֵל א׳ כד, ה** · I Samuel 24:5 · `s1_24_5_corner`
>
> _...and cut off the skirt of Saul's robe privily._
>
> Note: Hebrew verse numbering (24:4 in many English Bibles). Ketiv איביך, qere אֹיִבְךָ.

> וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ וַיִּקָּרַע
>
> — **שְׁמוּאֵל א׳ טו, כז** · I Samuel 15:27 · `s1_15_27_robe`
>
> _...he laid hold upon the skirt of his robe, and it tore._
>
> Note: Whose robe? Plain sense (Rashi, Radak, Metzudat David): Saul grasped the corner of SAMUEL's me'il. The midrash cited by Rashi also records the opinion that Samuel tore Saul's.

> אִישׁ זָקֵן עֹלֶה וְהוּא עֹטֶה מְעִיל
>
> — **שְׁמוּאֵל א׳ כח, יד** · I Samuel 28:14 · `s1_28_14_samuel_meil`
>
> _An old man comes up, and he is wrapped in a robe (me'il)._
>
> Note: Samuel is recognised by his me'il (cf. 2:19, 15:27).

War gear: garments (madim), bronze helmet, coat of mail, sword, and a shield rubbed with oil:

> וַיַּלְבֵּשׁ שָׁאוּל אֶת־דָּוִד מַדָּיו וְנָתַן קוֹבַע נְחֹשֶׁת עַל־רֹאשׁוֹ וַיַּלְבֵּשׁ אֹתוֹ שִׁרְיוֹן וַיַּחְגֹּר דָּוִד אֶת־חַרְבּוֹ מֵעַל לְמַדָּיו וַיֹּאֶל לָלֶכֶת כִּי לֹא־נִסָּה וַיֹּאמֶר דָּוִד אֶל־שָׁאוּל לֹא אוּכַל לָלֶכֶת בָּאֵלֶּה כִּי לֹא נִסִּיתִי וַיְסִרֵם דָּוִד מֵעָלָיו
>
> — **שְׁמוּאֵל א׳ יז, לח–לט** · I Samuel 17:38-39 · `s1_17_38_39_armor`
>
> _Saul clad David with his apparel (madav), put a helmet of bronze on his head and clad him with a coat of mail. David girded his sword upon his apparel..._
>
> Note: Saul's own war gear: madim (garment), bronze helmet (קוֹבַע, spelled with qof here), coat of mail (שִׁרְיוֹן), sword.

> הָרֵי בַגִּלְבֹּעַ אַל־טַל וְאַל־מָטָר עֲלֵיכֶם וּשְׂדֵי תְרוּמֹת כִּי שָׁם נִגְעַל מָגֵן גִּבּוֹרִים מָגֵן שָׁאוּל בְּלִי מָשִׁיחַ בַּשָּׁמֶן מִדַּם חֲלָלִים מֵחֵלֶב גִּבּוֹרִים קֶשֶׁת יְהוֹנָתָן לֹא נָשׂוֹג אָחוֹר וְחֶרֶב שָׁאוּל לֹא תָשׁוּב רֵיקָם
>
> — **שְׁמוּאֵל ב׳ א, כא–כב** · II Samuel 1:21-22 · `s2_1_21_22_shield_sword`
>
> _...the shield of Saul, not anointed with oil... and the sword of Saul returned not empty._

> וַיִּתְפַּשֵּׁט יְהוֹנָתָן אֶת־הַמְּעִיל אֲשֶׁר עָלָיו וַיִּתְּנֵהוּ לְדָוִד וּמַדָּיו וְעַד־חַרְבּוֹ וְעַד־קַשְׁתּוֹ וְעַד־חֲגֹרוֹ
>
> — **שְׁמוּאֵל א׳ יח, ד** · I Samuel 18:4 · `s1_18_4_jonathan_gear`
>
> _Jonathan stripped off the robe (me'il) that was upon him and gave it to David, and his garments, even to his sword, his bow and his girdle._
>
> Note: The prince's outfit: me'il, madim, sword, bow, belt (later event; for costume design).

For contrast, the Philistine gear (scale armour, bronze and iron):

> וְכוֹבַע נְחֹשֶׁת עַל־רֹאשׁוֹ וְשִׁרְיוֹן קַשְׂקַשִּׂים הוּא לָבוּשׁ וּמִשְׁקַל הַשִּׁרְיוֹן חֲמֵשֶׁת־אֲלָפִים שְׁקָלִים נְחֹשֶׁת וּמִצְחַת נְחֹשֶׁת עַל־רַגְלָיו וְכִידוֹן נְחֹשֶׁת בֵּין כְּתֵפָיו וְעֵץ חֲנִיתוֹ כִּמְנוֹר אֹרְגִים וְלַהֶבֶת חֲנִיתוֹ שֵׁשׁ־מֵאוֹת שְׁקָלִים בַּרְזֶל וְנֹשֵׂא הַצִּנָּה הֹלֵךְ לְפָנָיו
>
> — **שְׁמוּאֵל א׳ יז, ה–ז** · I Samuel 17:5-7 · `s1_17_5_7_goliath_armor`
>
> _Goliath: bronze helmet, coat of scale armour (shiryon qasqasim) of bronze, bronze greaves, a bronze javelin (kidon), a spear-shaft like a weaver's beam with an iron head; a shield-bearer._
>
> Note: Philistine equipment for contrast; shows that scale armour, bronze and iron coexisted.

Metal was scarce in Israel. Only Saul and Jonathan had sword and spear at Michmash:

> וְחָרָשׁ לֹא יִמָּצֵא בְּכֹל אֶרֶץ יִשְׂרָאֵל כִּי־אָמְרוּ פְלִשְׁתִּים פֶּן יַעֲשׂוּ הָעִבְרִים חֶרֶב אוֹ חֲנִית
>
> — **שְׁמוּאֵל א׳ יג, יט** · I Samuel 13:19 · `s1_13_19_no_smith`
>
> _Now there was no smith found throughout all the land of Israel, for the Philistines said: Lest the Hebrews make themselves swords or spears._
>
> Note: Ketiv אמר, qere אָמְרוּ.

> וְהָיָה בְּיוֹם מִלְחֶמֶת וְלֹא נִמְצָא חֶרֶב וַחֲנִית בְּיַד כָּל־הָעָם אֲשֶׁר אֶת־שָׁאוּל וְאֶת־יוֹנָתָן וַתִּמָּצֵא לְשָׁאוּל וּלְיוֹנָתָן בְּנוֹ
>
> — **שְׁמוּאֵל א׳ יג, כב** · I Samuel 13:22 · `s1_13_22_no_swords`
>
> _...neither sword nor spear was found in the hand of any of the people with Saul and Jonathan; but with Saul and with Jonathan his son was there found._

Prosperity at court (scarlet, gold ornaments):

> בְּנוֹת יִשְׂרָאֵל אֶל־שָׁאוּל בְּכֶינָה הַמַּלְבִּשְׁכֶם שָׁנִי עִם־עֲדָנִים הַמַּעֲלֶה עֲדִי זָהָב עַל לְבוּשְׁכֶן
>
> — **שְׁמוּאֵל ב׳ א, כד** · II Samuel 1:24 · `s2_1_24_scarlet_gold`
>
> _Daughters of Israel, weep over Saul, who clothed you in scarlet with delights, who put ornaments of gold upon your apparel._

> וּתְכֵלֶת וְאַרְגָּמָן וְתוֹלַעַת שָׁנִי וְשֵׁשׁ וְעִזִּים
>
> — **שְׁמוֹת כה, ד** · Exodus 25:4 · `exo_25_4_dyes`
>
> _...blue (tekhelet), purple (argaman), scarlet (tola'at shani), fine linen and goats' hair._

Torah dress law that applies to Saul, David and every Israelite man:

> וְעָשׂוּ לָהֶם צִיצִת עַל־כַּנְפֵי בִגְדֵיהֶם לְדֹרֹתָם וְנָתְנוּ עַל־צִיצִת הַכָּנָף פְּתִיל תְּכֵלֶת
>
> — **בְּמִדְבַּר טו, לח** · Numbers 15:38 · `num_15_38_tzitzit`
>
> _...make them fringes on the corners of their garments throughout their generations, and put upon the fringe of each corner a thread of blue (tekhelet)._
>
> Note: Four-cornered garments of Israelite men carry tzitzit with a tekhelet thread (Deut 22:12).

> לֹא תִלְבַּשׁ שַׁעַטְנֵז צֶמֶר וּפִשְׁתִּים יַחְדָּו גְּדִלִים תַּעֲשֶׂה־לָּךְ עַל־אַרְבַּע כַּנְפוֹת כְּסוּתְךָ אֲשֶׁר תְּכַסֶּה־בָּהּ
>
> — **דְּבָרִים כב, יא–יב** · Deuteronomy 22:11-12 · `deut_22_11_12_shaatnez_gedilim`
>
> _You shall not wear sha'atnez, wool and linen together. You shall make twisted fringes on the four corners of your covering._
>
> Note: Costume rule: no garment mixing wool and linen.

Costume consequences:

- Outer four-cornered garments carry **tzitzit** with one **tekhelet** (blue) thread.
- No garment mixes **wool and linen**.

Benjaminite warriors, Saul's kin, were ambidextrous slingers and archers:

> נֹשְׁקֵי קֶשֶׁת מַיְמִינִים וּמַשְׂמִאלִים בָּאֲבָנִים וּבַחִצִּים בַּקָּשֶׁת מֵאֲחֵי שָׁאוּל מִבִּנְיָמִן
>
> — **דִּבְרֵי הַיָּמִים א׳ יב, ב** · I Chronicles 12:2 · `chr1_12_2_benjamin_archers`
>
> _They were armed with bows, and could use both the right hand and the left in slinging stones and shooting arrows; they were of Saul's brethren of Benjamin._

> וַיִּתְפָּקְדוּ בְנֵי בִנְיָמִן בַּיּוֹם הַהוּא מֵהֶעָרִים עֶשְׂרִים וְשִׁשָּׁה אֶלֶף אִישׁ שֹׁלֵף חָרֶב לְבַד מִיֹּשְׁבֵי הַגִּבְעָה הִתְפָּקְדוּ שְׁבַע מֵאוֹת אִישׁ בָּחוּר
>
> — **שׁוֹפְטִים כ, טו** · Judges 20:15 · `jdg_20_15_gibeah_men`
>
> _...besides the inhabitants of Gibeah, who numbered seven hundred picked men._

> כָּל־זֶה קֹלֵעַ בָּאֶבֶן אֶל־הַשַּׂעֲרָה וְלֹא יַחֲטִא
>
> — **שׁוֹפְטִים כ, טז** · Judges 20:16 · `jdg_20_16_slingers`
>
> _...every one of these could sling a stone at a hair and not miss._
>
> Note: Describes the 700 left-handed picked men of Benjamin from Gibeah (20:15) - Saul's tribe and town. Accurate as a statement about Israelite slingers.

Food of the period:

> וַיֹּאמֶר יִשַׁי לְדָוִד בְּנוֹ קַח־נָא לְאַחֶיךָ אֵיפַת הַקָּלִיא הַזֶּה וַעֲשָׂרָה לֶחֶם הַזֶּה וְהָרֵץ הַמַּחֲנֶה לְאַחֶיךָ וְאֵת עֲשֶׂרֶת חֲרִצֵי הֶחָלָב הָאֵלֶּה תָּבִיא לְשַׂר־הָאָלֶף וְאֶת־אַחֶיךָ תִּפְקֹד לְשָׁלוֹם וְאֶת־עֲרֻבָּתָם תִּקָּח
>
> — **שְׁמוּאֵל א׳ יז, יז–יח** · I Samuel 17:17-18 · `s1_17_17_18_provisions`
>
> _Parched grain, ten loaves, ten cheeses for the captain of the thousand._

> וַתְּמַהֵר אֲבִיגַיִל וַתִּקַּח מָאתַיִם לֶחֶם וּשְׁנַיִם נִבְלֵי־יַיִן וְחָמֵשׁ צֹאן עֲשׂוּיוֹת וְחָמֵשׁ סְאִים קָלִי וּמֵאָה צִמֻּקִים וּמָאתַיִם דְּבֵלִים וַתָּשֶׂם עַל־הַחֲמֹרִים
>
> — **שְׁמוּאֵל א׳ כה, יח** · I Samuel 25:18 · `s1_25_18_provisions`
>
> _Two hundred loaves, two skins of wine, five dressed sheep, five seahs of parched grain, a hundred clusters of raisins and two hundred cakes of figs, laden on donkeys._

### 3.6 Samuel's words to Saul, and God's words

> הִנֵּה שְׁמֹעַ מִזֶּבַח טוֹב לְהַקְשִׁיב מֵחֵלֶב אֵילִים
>
> — **שְׁמוּאֵל א׳ טו, כב** · I Samuel 15:22 · `s1_15_22_obey`
>
> _Behold, to obey is better than sacrifice, and to hearken than the fat of rams._

> יַעַן מָאַסְתָּ אֶת־דְּבַר ה׳ וַיִּמְאָסְךָ מִמֶּלֶךְ
>
> — **שְׁמוּאֵל א׳ טו, כג** · I Samuel 15:23 · `s1_15_23_rejected`
>
> _Because you have rejected the word of the LORD, He has rejected you from being king._

> וַיִּמְאָסְךָ ה׳ מִהְיוֹת מֶלֶךְ עַל־יִשְׂרָאֵל
>
> — **שְׁמוּאֵל א׳ טו, כו** · I Samuel 15:26 · `s1_15_26_rejected`
>
> _...and the LORD has rejected you from being king over Israel._

> קָרַע ה׳ אֶת־מַמְלְכוּת יִשְׂרָאֵל מֵעָלֶיךָ הַיּוֹם וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ
>
> — **שְׁמוּאֵל א׳ טו, כח** · I Samuel 15:28 · `s1_15_28_torn_kingdom`
>
> _The LORD has torn the kingdom of Israel from you this day, and has given it to a neighbour of yours who is better than you._
>
> Note: Samuel to Saul at Gilgal (ch. 15), shortly before the intro. Safe to show.

> בִּקֵּשׁ ה׳ לוֹ אִישׁ כִּלְבָבוֹ
>
> — **שְׁמוּאֵל א׳ יג, יד** · I Samuel 13:14 · `s1_13_14_after_his_heart`
>
> _The LORD has sought for Himself a man after His own heart._

> כִּי הָאָדָם יִרְאֶה לַעֵינַיִם וַה׳ יִרְאֶה לַלֵּבָב
>
> — **שְׁמוּאֵל א׳ טז, ז** · I Samuel 16:7 · `s1_16_7_looks_heart`
>
> _For man looks on the outward appearance, but the LORD looks on the heart._
>
> Note: Said to Samuel about Eliab on the day of the anointing (16:7). Radak cites an opinion that it also answers Samuel's attachment to tall, handsome Saul. Show only with the reference; do not caption it as said about Saul.

> ושאול הוא שהיה יפה מראה וגבה קומה
>
> — **רַדַ״ק, שְׁמוּאֵל א׳ טז, ז** · Radak on I Samuel 16:7:2 · `radak_s1_16_7_saul`
>
> _Radak (citing "some explain"): ...and it was Saul who was handsome and tall._

### 3.7 David, for contrast

> עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן
>
> — **שְׁמוּאֵל א׳ טז, יא** · I Samuel 16:11 · `s1_16_11_youngest`
>
> _There remains yet the youngest, and behold, he is tending the sheep._
>
> Note: Spoken by Jesse to Samuel on the day of the anointing (16:11). Shown in the intro as a description of David; the reference makes the source clear.

> וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי
>
> — **שְׁמוּאֵל א׳ טז, יב** · I Samuel 16:12 · `s1_16_12_ruddy`
>
> _And he was ruddy, with beautiful eyes and good looks._

> וְהוּא סַמוֹק עֵינוֹהִי יָאִין וְשַׁפִּיר בְּרֵיוֵיהּ
>
> — **תַּרְגּוּם יוֹנָתָן, שְׁמוּאֵל א׳ טז, יב** · Targum Jonathan on I Samuel 16:12 · `tj_s1_16_12_ruddy`
>
> _Targum: "and he was ruddy (samoq), his eyes beautiful and his appearance fine"._
>
> Note: The Targum reads אַדְמוֹנִי as a ruddy complexion.

> כִּי־הָיָה נַעַר וְאַדְמֹנִי עִם־יְפֵה מַרְאֶה
>
> — **שְׁמוּאֵל א׳ יז, מב** · I Samuel 17:42 · `s1_17_42_ruddy_youth`
>
> _...for he was but a youth, and ruddy, and of a fair countenance._

> ואדמני עם יפה מראה. כבר פירשנו שהוא כמו ויפה והנה לא בזה אותו בעבור כי ראה אותו שהיה נער אלא למה בזה אותו בעבור שהיה אדמוני עם יפה מראה לפי שחשב בלבו כי לא יתכן שיהיה איש מלחמה כי מי שהוא רגיל לצאת למלחמה לא יעמוד בו יופיו מפני היגיעה והטורח והיותו בחוץ בעתות המלחמה לקרח ולמטר ולשרב:
>
> — **רַדַ״ק, שְׁמוּאֵל א׳ יז, מב** · Radak on I Samuel 17:42:1 · `radak_s1_17_42_ruddy`
>
> _Radak: Goliath despised him not for being a youth but for being ruddy and handsome - he thought such a man could not be a warrior, for one who goes to war loses his beauty from toil and exposure to cold, rain and heat._
>
> Note: Art direction: David's face should read fresh and ruddy, not weather-beaten.

> וְכֵיוָן שֶׁרָאָה שְׁמוּאֵל אֶת דָּוִד אַדְמוֹנִי … נִתְיָרֵא וְאָמַר אַף זֶה שׁוֹפֵךְ דָּמִים כְּעֵשָׂו … עֵשָׂו מִדַּעַת עַצְמוֹ הוּא הוֹרֵג אֲבָל זֶה מִדַּעַת סַנְהֶדְרִין הוּא הוֹרֵג
>
> — **בְּרֵאשִׁית רַבָּה סג, ח** · Bereshit Rabbah 63:8 · `brr_63_8_ruddy`
>
> _When Samuel saw that David was ruddy... he was afraid and said: this one too will shed blood like Esau. [God answered: "with beautiful eyes"] - Esau kills of his own will, this one only by the verdict of the Sanhedrin._

> וַיַּעַן אֶחָד מֵהַנְּעָרִים וַיֹּאמֶר הִנֵּה רָאִיתִי בֵּן לְיִשַׁי בֵּית הַלַּחְמִי יֹדֵעַ נַגֵּן וְגִבּוֹר חַיִל וְאִישׁ מִלְחָמָה וּנְבוֹן דָּבָר וְאִישׁ תֹּאַר וַה׳ עִמּוֹ
>
> — **שְׁמוּאֵל א׳ טז, יח** · I Samuel 16:18 · `s1_16_18_david_skills`
>
> _...a son of Jesse the Bethlehemite, skilful in playing, a mighty man of valour, a man of war, prudent in speech, a comely person, and the LORD is with him._
>
> Note: Said to Saul by one of his young men after 16:14; usable for David's look, not as a line in the intro.

> וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל וַיָּשֶׂם אֹתָם בִּכְלִי הָרֹעִים
>
> — **שְׁמוּאֵל א׳ יז, מ** · I Samuel 17:40 · `s1_17_40_stones`
>
> _...and chose for himself five smooth stones out of the brook, and put them in the shepherd's bag._
>
> Note: Describes the day of the battle with Goliath; the objective text already frames it as foreshadowing ("כפי שיעשה יום אחד בעמק האלה").

> וְדָוִד הֹלֵךְ וָשָׁב מֵעַל שָׁאוּל לִרְעוֹת אֶת־צֹאן אָבִיו בֵּית לָחֶם
>
> — **שְׁמוּאֵל א׳ יז, טו** · I Samuel 17:15 · `s1_17_15_back_and_forth`
>
> _But David went back and forth from Saul to feed his father's sheep at Bethlehem._
>
> Note: The Bible's own juxtaposition of the two worlds - but it belongs to the period after 16:21.

> אֲנִי לְקַחְתִּיךָ מִן־הַנָּוֶה מֵאַחַר הַצֹּאן לִהְיוֹת נָגִיד עַל־עַמִּי עַל־יִשְׂרָאֵל
>
> — **שְׁמוּאֵל ב׳ ז, ח** · II Samuel 7:8 · `s2_7_8_from_pasture`
>
> _I took you from the pasture, from following the sheep, to be prince over My people, over Israel._

> וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן מֵאַחַר עָלוֹת הֱבִיאוֹ לִרְעוֹת בְּיַעֲקֹב עַמּוֹ וּבְיִשְׂרָאֵל נַחֲלָתוֹ
>
> — **תְּהִלִּים עח, ע–עא** · Psalms 78:70-71 · `ps_78_70_71_chose_david`
>
> _He chose David His servant and took him from the sheepfolds; from following the nursing ewes He brought him to shepherd Jacob His people and Israel His inheritance._
>
> Note: These are exactly the verses Shemot Rabbah 2:2 expounds.

Art direction for David, from the sources:

- The complexion is ruddy (Targum סַמוֹק), with beautiful eyes and a fresh face that is not war-hardened (Radak on 17:42).
- The hair colour is **not stated**. Auburn or copper hair, as in the reference image, is a legitimate reading of אַדְמוֹנִי, but it is an interpretation.
- Kit, per 17:40: a staff (מַקֵּל), the shepherd's bag (כְּלִי הָרֹעִים, יַלְקוּט) and a sling.
- Garments without sha'atnez. Tzitzit on a four-cornered outer garment if he wears one.

### 3.8 Rabbinic statements about Saul (verified text)

> ״בֶּן שָׁנָה שָׁאוּל בְּמָלְכוֹ״, אָמַר רַב הוּנָא: כְּבֶן שָׁנָה, שֶׁלֹּא טָעַם טַעַם חֵטְא.
>
> — **יוֹמָא כב ע״ב** · Yoma 22b:17 · `yoma_22b_one_year_old`
>
> _"Saul was a year old when he began to reign" - Rav Huna said: like a one-year-old, who has never tasted the taste of sin._

> מִפְּנֵי מָה לֹא נִמְשְׁכָה מַלְכוּת בֵּית שָׁאוּל — מִפְּנֵי שֶׁלֹּא הָיָה בּוֹ שׁוּם דּוֹפִי
>
> — **יוֹמָא כב ע״ב** · Yoma 22b:19 · `yoma_22b_no_blemish`
>
> _Why did the kingship of the house of Saul not endure? Because there was no blemish in him (in his lineage)._

> מִפְּנֵי מָה נֶעֱנַשׁ שָׁאוּל — מִפְּנֵי שֶׁמָּחַל עַל כְּבוֹדוֹ
>
> — **יוֹמָא כב ע״ב** · Yoma 22b:20 · `yoma_22b_forgave_honor`
>
> _Why was Saul punished? Because he waived his royal honour (1 Sam 10:27)._

> שָׁאוּל בְּאַחַת — וְעָלְתָה לוֹ. דָּוִד בִּשְׁתַּיִם — וְלֹא עָלְתָה לוֹ
>
> — **יוֹמָא כב ע״ב** · Yoma 22b:10 · `yoma_22b_one_sin`
>
> _Saul [failed] in one matter and it was counted against him; David in two, and it was not._

> ״וַיָּרֶב בַּנָּחַל״, אָמַר רַבִּי מָנִי: עַל עִסְקֵי נַחַל. בְּשָׁעָה שֶׁאָמַר לוֹ הַקָּדוֹשׁ בָּרוּךְ הוּא לְשָׁאוּל: ״לֵךְ וְהִכִּיתָ אֶת עֲמָלֵק״, אָמַר: וּמָה נֶפֶשׁ אַחַת אָמְרָה תּוֹרָה הָבֵא עֶגְלָה עֲרוּפָה — כָּל הַנְּפָשׁוֹת הַלָּלוּ, עַל אַחַת כַּמָּה וְכַמָּה.
>
> — **יוֹמָא כב ע״ב** · Yoma 22b:8 · `yoma_22b_amalek_mercy`
>
> _When God told Saul "Go and smite Amalek", he reasoned: if for one soul the Torah requires the heifer ceremony, how much more for all these souls..._

> וּבִשְׂכַר צְנִיעוּת שֶׁהָיָה בּוֹ בְּשָׁאוּל זָכָה וְיָצָאת מִמֶּנּוּ אֶסְתֵּר
>
> — **מְגִלָּה יג ע״ב** · Megillah 13b:1 · `meg_13b_modesty`
>
> _In reward for the modesty that was in Saul, he merited that Esther descended from him._

> וּמָה צְנִיעוּת הָיְתָה בְּשָׁאוּל? דִּכְתִיב: ״וְאֶת דְּבַר הַמְּלוּכָה לֹא הִגִּיד לוֹ אֲשֶׁר אָמַר שְׁמוּאֵל״, זָכָה וְיָצָאת מִמֶּנּוּ אֶסְתֵּר. וְאָמַר רַבִּי אֶלְעָזָר: כְּשֶׁהַקָּדוֹשׁ בָּרוּךְ הוּא פּוֹסֵק גְּדוּלָּה לְאָדָם — פּוֹסֵק לְבָנָיו וְלִבְנֵי בָנָיו עַד סוֹף כָּל הַדּוֹרוֹת, שֶׁנֶּאֱמַר: ״וַיּוֹשִׁיבֵם לָנֶצַח וַיִּגְבָּהוּ (וְגוֹ׳)״. וְאִם הֵגִיס דַּעְתּוֹ — הַקָּדוֹשׁ בָּרוּךְ הוּא מַשְׁפִּילוֹ, שֶׁנֶּאֱמַר: ״וְאִם אֲסוּרִים בַּזִּקִּים וְגוֹ׳״.
>
> — **מְגִלָּה יג ע״ב** · Megillah 13b:6 · `meg_13b_modesty_what`
>
> _What was Saul's modesty? "But of the matter of the kingdom, whereof Samuel spoke, he told him not" (1 Sam 10:16)._

> מָה כּוּשִׁי מְשׁוּנֶּה בְּעוֹרוֹ — אַף שָׁאוּל מְשׁוּנֶּה בְּמַעֲשָׂיו
>
> — **מוֹעֵד קָטָן טז ע״ב** · Moed Katan 16b:18 · `mk_16b_distinguished`
>
> _Just as a Cushite is distinguished by his skin, so Saul was distinguished by his deeds._

> אִלְמָלֵי אַתָּה שָׁאוּל וְהוּא דָּוִד — אִיבַּדְתִּי כַּמָּה דָּוִד מִפָּנָיו
>
> — **מוֹעֵד קָטָן טז ע״ב** · Moed Katan 16b:17 · `mk_16b_had_you_been_saul`
>
> _[God to David:] Were you Saul and he David, I would have destroyed many Davids for his sake._

The rabbis defend Saul's greatness: he was sinless when crowned, modest, merciful (to a fault) and "distinguished in his deeds". The intro should therefore show him as **awe-inspiring and noble**. He should not be shown as a villain.

The Talmud texts are CC BY-NC (Koren/Davidson). They live only in `sourcesReference.ts`, which the game does not import. If one must be displayed, first obtain a license, or quote a public-domain edition of the Vilna text instead.

---

## 4. Historical and archaeological context (non-textual)

This section does **not** come from the Jewish sources. Items marked **[certain]** reflect a broad scholarly consensus. Items marked **[debated]** or **[conjecture]** must not be presented to players as fact.

### 4.1 Place and date

- **[certain]** Gibeah of Saul lay in the territory of Benjamin, on the ridge road north of Jerusalem, near Ramah and Geba. See Isa 10:29, and 1 Sam 13:2 ("גִּבְעַת בִּנְיָמִין").
- **[certain]** In Saul's day Jerusalem was a **Jebusite** city (2 Sam 5:6, Josh 18:28). The intro must not show an Israelite Jerusalem or the Temple.
- **[debated]** The site is usually identified with **Tell el-Ful**, a prominent hill about 5 km north of the Old City of Jerusalem. W. F. Albright excavated there in 1922–23 and 1933, and P. Lapp in 1964. Albright interpreted a fortified building with a corner tower as "Saul's fortress". Later scholars dispute the date and scale of the Iron Age I remains, and some doubt the identification itself, preferring Jaba' (Geba) or another site. Reconstruct Saul's house as a **fortified stone residence**, not as a palace, and label it *"reconstruction"* in any bonus material. A modern trivia note: an unfinished royal palace begun for King Hussein of Jordan in the 1960s still stands on Tell el-Ful.
- **[certain]** Conventional scholarly dating puts Saul in the late 11th century BCE (Iron Age I/IIA transition). Traditional Jewish chronology (Seder Olam) gives him a very short reign (see 3.1).

### 4.2 Architecture and daily life (Iron Age I–IIA highlands)

**[certain]**

- Villages of pillared "four-room" houses, built of limestone fieldstones, sometimes with mudbrick upper courses.
- Flat roofs of wooden beams, branches and packed clay.
- Courtyards with bread ovens (tabun), silos and plastered cisterns.
- Agricultural terraces, threshing floors, olive presses.
- Pottery: collared-rim storage jars, cooking pots, bowls and jugs.
- **Lamps are open saucer lamps with a single pinched spout.** Do not use closed or Hellenistic "Aladdin" lamps.
- Looms with clay loom-weights, spindles, grinding stones.

**[conjecture, but plausible]** Saul's house was a larger building of this type inside a walled enclosure, possibly with a tower:

- a hall with wooden beams on stone pillars
- plastered walls
- woven wool hangings
- low benches along the walls
- a "seat by the wall" for the king (20:25)
- oil lamps in wall niches

The intro should not include:

- cedar panelling (that belongs to David's and Solomon's later palaces)
- ivory thrones (Megiddo ivories are Late Bronze Age and Canaanite)
- marble
- glass windows

### 4.3 Dress, dyes and ornaments

- **[certain]** Clothes were made of wool and linen, and the Torah forbids mixing them in one garment (Deut 22:11). Men wore:
  - a tunic (כֻּתֹּנֶת)
  - a mantle or robe (שִׂמְלָה / מְעִיל) with corners (כְּנָפַיִם) bearing tzitzit
  - a belt (חֲגוֹרָה / אֵזוֹר)
  - sandals
- **[certain]** Dyes:
  - blue (tekhelet) and purple (argaman) from murex sea snails
  - scarlet (tola'at shani) from the kermes insect
  - reds from madder
  - blues from woad or indigo

  Wool dyed with true murex purple was found at the **Timna** copper mines in textiles dated to about 1000 BCE, the time of Saul and David (published 2021). Scarlet with gold ornaments fits Saul's court (2 Sam 1:24).
- **[certain]** Royal ornaments named in the text: a **נֵזֶר** (a band or diadem, not a heavy crown) and an **אֶצְעָדָה** (armlet or bracelet), 2 Sam 1:10.
- **[debated / later evidence]** Israelite and Judahite iconography is 150–300 years later. The Black Obelisk (841 BCE) shows long fringed garments and soft caps. The Lachish reliefs (701 BCE) show short curly hair, beards, headbands and long tunics. Use them as guidance only.

### 4.4 Weapons and armour

- **[certain]** Spears with socketed metal heads, straight swords, bows and slings. Sling-stones of flint or limestone the size of a tennis ball are common finds.
- **[certain]** Shields of leather on a wooden or wicker frame, oiled (2 Sam 1:21). Bronze helmets and scale armour (17:5, 17:38).
- **[certain]** Bronze and iron coexisted. The text says the Philistines controlled smithing (13:19–22), so well-armed men are rare and the king's gear stands out.
- **[conjecture]** Saul's own equipment:
  - a bronze helmet with a simple crest-less dome
  - a long spear with an iron head
  - a straight sword in a leather scabbard
  - scale armour for battle only; at court, robe and spear

### 4.5 Landscape at Gibeah

- **[certain]** Benjamin hill country: limestone hills, terraces, olive, vine, fig, almond and pomegranate (14:2).
- **[certain]** The **tamarisk** (אֵשֶׁל, *Tamarix aphylla*) is a large tree with fine grey-green, needle-like foliage and rough, furrowed bark.
- **[certain]** Donkeys, oxen, sheep and black goats. The text gives Saul no horses. Camels belong to desert peoples such as Amalek (15:3), not to Saul's household.
- **[likely]** Avoid chickens. Domestic fowl are rare in the southern Levant before the later Iron Age.

---

## 5. Recommendations

### 5.1 Intro: verses in order

This order is implemented as a typed cue sheet in `src/content/introScript.ts` (`INTRO_CUES`, and `INTRO_CUES_SHORT` for the short cut).

1. **Judean hills.** Caption only (narration): "הָרֵי יְהוּדָה · אֶרֶץ יִשְׂרָאֵל · בִּימֵי שָׁאוּל הַמֶּלֶךְ".
2. **Gibeah of Saul.** Caption: "גִּבְעַת שָׁאוּל · בְּנַחֲלַת בִּנְיָמִין". Then:
   > וְשָׁאוּל עָלָה אֶל־בֵּיתוֹ גִּבְעַת שָׁאוּל
   >
   > — **שְׁמוּאֵל א׳ טו, לד** · I Samuel 15:34 · `s1_15_34_gibeah_home`
   >
   > _...and Saul went up to his house, to Gibeah of Saul._
   >
   > Note: The last verse about Saul before 16:1 - exactly the moment of the intro.
3. **Saul holding court under the tamarisk.** The quotation omits the first clause about David, and the reference shows its place:
   > וְשָׁאוּל יוֹשֵׁב בַּגִּבְעָה תַּחַת־הָאֶשֶׁל בָּרָמָה וַחֲנִיתוֹ בְיָדוֹ וְכָל־עֲבָדָיו נִצָּבִים עָלָיו
   >
   > — **שְׁמוּאֵל א׳ כב, ו** · I Samuel 22:6 · `s1_22_6_tamarisk`
   >
   > _...and Saul was sitting in Gibeah under the tamarisk tree on the height, with his spear in his hand, and all his servants standing about him._
   >
   > Note: Chronology: this scene is from a later time (David already a fugitive). The quoted words omit the first clause about David and show only the portrait of Saul's court.
4. **Portrait of Saul.**
   > מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם
   >
   > — **שְׁמוּאֵל א׳ ט, ב** · I Samuel 9:2 · `s1_9_2_head_above`
   >
   > _from his shoulders and upward he was taller than any of the people_
5. *(optional)* **Abner and the warriors.** Caption: "אַבְנֵר בֶּן־נֵר · שַׂר הַצָּבָא". Then:
   > וַתְּהִי הַמִּלְחָמָה חֲזָקָה עַל־פְּלִשְׁתִּים כֹּל יְמֵי שָׁאוּל וְרָאָה שָׁאוּל כָּל־אִישׁ גִּבּוֹר וְכָל־בֶּן־חַיִל וַיַּאַסְפֵהוּ אֵלָיו
   >
   > — **שְׁמוּאֵל א׳ יד, נב** · I Samuel 14:52 · `s1_14_52_mighty_men`
   >
   > _And there was sore war against the Philistines all the days of Saul; and whenever Saul saw any mighty man or any valiant man, he took him unto him._
6. **Saul alone in his house at dusk.**
   > וְלֹא־יָסַף שְׁמוּאֵל לִרְאוֹת אֶת־שָׁאוּל עַד־יוֹם מוֹתוֹ כִּי־הִתְאַבֵּל שְׁמוּאֵל אֶל־שָׁאוּל
   >
   > — **שְׁמוּאֵל א׳ טו, לה** · I Samuel 15:35 · `s1_15_35_samuel_mourned`
   >
   > _And Samuel saw Saul no more until the day of his death, for Samuel mourned for Saul._
7. **The hinge: from the king to the shepherd.** Show it as the memory of Gilgal and a torn robe corner, then fly south.
   > קָרַע ה׳ אֶת־מַמְלְכוּת יִשְׂרָאֵל מֵעָלֶיךָ הַיּוֹם וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ
   >
   > — **שְׁמוּאֵל א׳ טו, כח** · I Samuel 15:28 · `s1_15_28_torn_kingdom`
   >
   > _The LORD has torn the kingdom of Israel from you this day, and has given it to a neighbour of yours who is better than you._
   >
   > Note: Samuel to Saul at Gilgal (ch. 15), shortly before the intro. Safe to show.
8. **Bethlehem** (existing shots). Caption: "בֵּית לֶחֶם יְהוּדָה · עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד". Then:
   > וְדָוִד בֶּן־אִישׁ אֶפְרָתִי הַזֶּה מִבֵּית לֶחֶם יְהוּדָה וּשְׁמוֹ יִשַׁי
   >
   > — **שְׁמוּאֵל א׳ יז, יב** · I Samuel 17:12 · `s1_17_12_ephrathite`
   >
   > _Now David was the son of that Ephrathite of Bethlehem in Judah, whose name was Jesse._
9. **Rachel's tomb** (existing). Caption: "מַצֶּבֶת קְבֻרַת רָחֵל", with the quotation וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם · בְּרֵאשִׁית לה, יט.
10. **The flock.**
    > עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן
    >
    > — **שְׁמוּאֵל א׳ טז, יא** · I Samuel 16:11 · `s1_16_11_youngest`
    >
    > _There remains yet the youngest, and behold, he is tending the sheep._
    >
    > Note: Spoken by Jesse to Samuel on the day of the anointing (16:11). Shown in the intro as a description of David; the reference makes the source clear.
11. **David.**
    > וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי
    >
    > — **שְׁמוּאֵל א׳ טז, יב** · I Samuel 16:12 · `s1_16_12_ruddy`
    >
    > _And he was ruddy, with beautiful eyes and good looks._
12. *(optional, before the title)*
    > כִּי הָאָדָם יִרְאֶה לַעֵינַיִם וַה׳ יִרְאֶה לַלֵּבָב
    >
    > — **שְׁמוּאֵל א׳ טז, ז** · I Samuel 16:7 · `s1_16_7_looks_heart`
    >
    > _For man looks on the outward appearance, but the LORD looks on the heart._
    >
    > Note: Said to Samuel about Eliab on the day of the anointing (16:7). Radak cites an opinion that it also answers Samuel's attachment to tall, handsome Saul. Show only with the reference; do not caption it as said about Saul.

    Alternatives for this slot: `ps_78_70_chose_david` (וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן) or `s1_13_14_after_his_heart`.
13. Title card **DAVID**.

For the end card or epilogue, consider אֲנִי לְקַחְתִּיךָ מִן־הַנָּוֶה מֵאַחַר הַצֹּאן לִהְיוֹת נָגִיד עַל־עַמִּי עַל־יִשְׂרָאֵל (שְׁמוּאֵל ב׳ ז, ח).

### 5.2 How to phrase captions that are not quotations

- **Never** put quotation marks, or scripture-style niqqud *styling*, around words that are not an exact substring of the cited verse. Narration is written as plain statements: place names, people, titles.
- **Never** write "עַל פִּי …" beneath a paraphrase. Quote exactly (catalog) or write clear narration without a source label.
- Call Saul's residence **"בֵּית שָׁאוּל"**, **"בֵּית הַמֶּלֶךְ"** or **"גִּבְעַת שָׁאוּל"**. **"ארמון"** or **"היכל"** would suggest a textual claim the Bible does not make.
- Captions for people: "שָׁאוּל בֶּן־קִישׁ · מֶלֶךְ יִשְׂרָאֵל", "אַבְנֵר בֶּן־נֵר · שַׂר הַצָּבָא", "יוֹנָתָן בֶּן־שָׁאוּל". These are narration, without quotation marks.
- **Proleptic verses** (22:6; 2 Sam 1:23 `s2_1_23_eagles_lions`) always carry their reference and are never introduced with "now", "on that day", "בְּאוֹתוֹ יוֹם" or similar.
- **16:7** is spoken about Eliab. Show it with its reference, and never caption it as a statement about Saul.
- Do not show: the evil spirit, madness, the lyre at court, David at Saul's court, the spear thrown, Goliath, horses or chariots at Gibeah, or an Israelite Jerusalem.
- The divine name is always **ה׳**. Every verse shown is taken from the catalog, never retyped.

---

## 6. Catalog

### 6.1 Display catalog (`src/content/sources.ts`, shipped with the game)

| id | status | reference | displayed text / note |
|---|---|---|---|
| `s1_17_12_ephrathite` | in-game | שְׁמוּאֵל א׳ יז, יב · I Samuel 17:12 | וְדָוִד בֶּן־אִישׁ אֶפְרָתִי הַזֶּה מִבֵּית לֶחֶם יְהוּדָה וּשְׁמוֹ יִשַׁי |
| `gen_35_19_rachel_buried` | in-game | בְּרֵאשִׁית לה, יט · Genesis 35:19 | וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם |
| `s1_16_11_youngest` | in-game | שְׁמוּאֵל א׳ טז, יא · I Samuel 16:11 | עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן |
| `s1_16_12_ruddy` | in-game | שְׁמוּאֵל א׳ טז, יב · I Samuel 16:12 | וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי |
| `shr_2_2_flock` | in-game | שְׁמוֹת רַבָּה ב, ב · Shemot Rabbah 2:2 | בָּדַק לְדָוִד בַּצֹּאן וּמְצָאוֹ רוֹעֶה יָפֶה … הָיָה מוֹנֵעַ הַגְּדוֹלִים מִפְּנֵי הַקְּטַנִּים, וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ, וְאַחַר כָּךְ מוֹצִיא הַזְּקֵנִים כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הַבֵּינוֹנִית, וְאַחַר כָּךְ מוֹצִיא הַבַּחוּרִים שֶׁיִּהְיוּ אוֹכְלִין עֵשֶׂב הַקָּשֶׁה. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי |
| `shr_2_2_flock_short` | in-game | שְׁמוֹת רַבָּה ב, ב · Shemot Rabbah 2:2 | וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ … אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי |
| `s1_17_40_stones` | in-game | שְׁמוּאֵל א׳ יז, מ · I Samuel 17:40 | וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל וַיָּשֶׂם אֹתָם בִּכְלִי הָרֹעִים |
| `jdg_20_16_slingers` | in-game | שׁוֹפְטִים כ, טז · Judges 20:16 | כָּל־זֶה קֹלֵעַ בָּאֶבֶן אֶל־הַשַּׂעֲרָה וְלֹא יַחֲטִא |
| `s1_17_34_bear` | in-game | שְׁמוּאֵל א׳ יז, לד · I Samuel 17:34 | וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר |
| `s1_17_35_went_after` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וְיָצָאתִי אַחֲרָיו |
| `s1_17_35_smote` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וְהִכִּתִיו |
| `s1_17_35_delivered` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וְהִצַּלְתִּי מִפִּיו |
| `s1_17_35_smote_delivered` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו |
| `s1_17_35_rose` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וַיָּקָם עָלַי |
| `s1_17_35_beard` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וְהֶחֱזַקְתִּי בִּזְקָנוֹ |
| `s1_17_35_slew` | in-game | שְׁמוּאֵל א׳ יז, לה · I Samuel 17:35 | וְהִכִּתִיו וַהֲמִיתִּיו |
| `ps_23_1_shepherd` | in-game | תְּהִלִּים כג, א · Psalms 23:1 | ה׳ רֹעִי לֹא אֶחְסָר |
| `ps_23_1_2_loading` | in-game | תְּהִלִּים כג, א–ב · Psalms 23:1-2 | ה׳ רֹעִי לֹא אֶחְסָר בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי |
| `s1_17_37_delivered_me` | in-game | שְׁמוּאֵל א׳ יז, לז · I Samuel 17:37 | ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי |
| `ps_23_4_rod_staff` | in-game | תְּהִלִּים כג, ד · Psalms 23:4 | גַּם כִּי־אֵלֵךְ בְּגֵיא צַלְמָוֶת לֹא־אִירָא רָע כִּי־אַתָּה עִמָּדִי שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי |
| `s1_17_36_37_endcard` | in-game | שְׁמוּאֵל א׳ יז, לו–לז · I Samuel 17:36-37 | גַּם אֶת־הָאֲרִי גַּם־הַדֹּב הִכָּה עַבְדֶּךָ … ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי מִיַּד הַפְּלִשְׁתִּי הַזֶּה |
| `s1_16_1_fill_horn` | in-game | שְׁמוּאֵל א׳ טז, א · I Samuel 16:1 | מַלֵּא קַרְנְךָ שֶׁמֶן וְלֵךְ אֶשְׁלָחֲךָ אֶל־יִשַׁי בֵּית־הַלַּחְמִי כִּי־רָאִיתִי בְּבָנָיו לִי מֶלֶךְ |
| `s1_15_34_gibeah_home` | intro | שְׁמוּאֵל א׳ טו, לד · I Samuel 15:34 | וְשָׁאוּל עָלָה אֶל־בֵּיתוֹ גִּבְעַת שָׁאוּל |
| `s1_15_35_samuel_mourned` | intro | שְׁמוּאֵל א׳ טו, לה · I Samuel 15:35 | וְלֹא־יָסַף שְׁמוּאֵל לִרְאוֹת אֶת־שָׁאוּל עַד־יוֹם מוֹתוֹ כִּי־הִתְאַבֵּל שְׁמוּאֵל אֶל־שָׁאוּל |
| `s1_9_2_tallest` | intro | שְׁמוּאֵל א׳ ט, ב · I Samuel 9:2 | בָּחוּר וָטוֹב וְאֵין אִישׁ מִבְּנֵי יִשְׂרָאֵל טוֹב מִמֶּנּוּ מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם |
| `s1_9_2_head_above` | intro | שְׁמוּאֵל א׳ ט, ב · I Samuel 9:2 | מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם |
| `s1_10_23_head_above` | intro | שְׁמוּאֵל א׳ י, כג · I Samuel 10:23 | וַיִּגְבַּהּ מִכָּל־הָעָם מִשִּׁכְמוֹ וָמָעְלָה |
| `s1_10_26_valiant_men` | intro | שְׁמוּאֵל א׳ י, כו · I Samuel 10:26 | וְגַם־שָׁאוּל הָלַךְ לְבֵיתוֹ גִּבְעָתָה וַיֵּלְכוּ עִמּוֹ הַחַיִל אֲשֶׁר־נָגַע אֱלֹהִים בְּלִבָּם |
| `s1_22_6_tamarisk` | intro | שְׁמוּאֵל א׳ כב, ו · I Samuel 22:6 | וְשָׁאוּל יוֹשֵׁב בַּגִּבְעָה תַּחַת־הָאֶשֶׁל בָּרָמָה וַחֲנִיתוֹ בְיָדוֹ וְכָל־עֲבָדָיו נִצָּבִים עָלָיו |
| `s1_14_47_took_kingship` | intro | שְׁמוּאֵל א׳ יד, מז · I Samuel 14:47 | וְשָׁאוּל לָכַד הַמְּלוּכָה עַל־יִשְׂרָאֵל וַיִּלָּחֶם סָבִיב בְּכָל־אֹיְבָיו … וּבְכֹל אֲשֶׁר־יִפְנֶה יַרְשִׁיעַ |
| `s1_14_50_abner` | intro | שְׁמוּאֵל א׳ יד, נ · I Samuel 14:50 | וְשֵׁם שַׂר־צְבָאוֹ אֲבִינֵר בֶּן־נֵר דּוֹד שָׁאוּל |
| `s1_14_52_mighty_men` | intro | שְׁמוּאֵל א׳ יד, נב · I Samuel 14:52 | וַתְּהִי הַמִּלְחָמָה חֲזָקָה עַל־פְּלִשְׁתִּים כֹּל יְמֵי שָׁאוּל וְרָאָה שָׁאוּל כָּל־אִישׁ גִּבּוֹר וְכָל־בֶּן־חַיִל וַיַּאַסְפֵהוּ אֵלָיו |
| `s1_15_28_torn_kingdom` | intro | שְׁמוּאֵל א׳ טו, כח · I Samuel 15:28 | קָרַע ה׳ אֶת־מַמְלְכוּת יִשְׂרָאֵל מֵעָלֶיךָ הַיּוֹם וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ |
| `s1_13_14_after_his_heart` | intro | שְׁמוּאֵל א׳ יג, יד · I Samuel 13:14 | בִּקֵּשׁ ה׳ לוֹ אִישׁ כִּלְבָבוֹ |
| `s1_16_7_looks_heart` | intro | שְׁמוּאֵל א׳ טז, ז · I Samuel 16:7 | כִּי הָאָדָם יִרְאֶה לַעֵינַיִם וַה׳ יִרְאֶה לַלֵּבָב |
| `s1_15_17_small_in_eyes` | intro | שְׁמוּאֵל א׳ טו, יז · I Samuel 15:17 | הֲלוֹא אִם־קָטֹן אַתָּה בְּעֵינֶיךָ רֹאשׁ שִׁבְטֵי יִשְׂרָאֵל אָתָּה |
| `ps_78_70_71_chose_david` | intro | תְּהִלִּים עח, ע–עא · Psalms 78:70-71 | וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן מֵאַחַר עָלוֹת הֱבִיאוֹ לִרְעוֹת בְּיַעֲקֹב עַמּוֹ וּבְיִשְׂרָאֵל נַחֲלָתוֹ |
| `ps_78_70_chose_david` | intro | תְּהִלִּים עח, ע · Psalms 78:70 | וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן |
| `s2_1_23_eagles_lions` | intro | שְׁמוּאֵל ב׳ א, כג · II Samuel 1:23 | מִנְּשָׁרִים קַלּוּ מֵאֲרָיוֹת גָּבֵרוּ |
| `s2_7_8_from_pasture` | ending | שְׁמוּאֵל ב׳ ז, ח · II Samuel 7:8 | אֲנִי לְקַחְתִּיךָ מִן־הַנָּוֶה מֵאַחַר הַצֹּאן לִהְיוֹת נָגִיד עַל־עַמִּי עַל־יִשְׂרָאֵל |

### 6.2 Research catalog (`src/content/sourcesReference.ts`, not shipped)

| id | status | reference | displayed text / note |
|---|---|---|---|
| `s1_9_1_kish` | reference | שְׁמוּאֵל א׳ ט, א · I Samuel 9:1 | (full text; no display quote) |
| `s1_10_22_hiding` | reference | שְׁמוּאֵל א׳ י, כב · I Samuel 10:22 | הִנֵּה־הוּא נֶחְבָּא אֶל־הַכֵּלִים |
| `s1_10_24_long_live` | reference | שְׁמוּאֵל א׳ י, כד · I Samuel 10:24 | הַרְּאִיתֶם אֲשֶׁר בָּחַר־בּוֹ ה׳ כִּי אֵין כָּמֹהוּ בְּכָל־הָעָם וַיָּרִעוּ כָל־הָעָם וַיֹּאמְרוּ יְחִי הַמֶּלֶךְ |
| `s1_10_27_no_gift` | reference | שְׁמוּאֵל א׳ י, כז · I Samuel 10:27 | (full text; no display quote) |
| `s1_11_5_behind_oxen` | reference | שְׁמוּאֵל א׳ יא, ה · I Samuel 11:5 | וְהִנֵּה שָׁאוּל בָּא אַחֲרֵי הַבָּקָר מִן־הַשָּׂדֶה |
| `s1_13_2_three_thousand` | reference | שְׁמוּאֵל א׳ יג, ב · I Samuel 13:2 | (full text; no display quote) |
| `s1_13_19_no_smith` | reference | שְׁמוּאֵל א׳ יג, יט · I Samuel 13:19 | (full text; no display quote) |
| `s1_13_22_no_swords` | reference | שְׁמוּאֵל א׳ יג, כב · I Samuel 13:22 | (full text; no display quote) |
| `s1_14_2_pomegranate` | reference | שְׁמוּאֵל א׳ יד, ב · I Samuel 14:2 | וְשָׁאוּל יוֹשֵׁב בִּקְצֵה הַגִּבְעָה תַּחַת הָרִמּוֹן אֲשֶׁר בְּמִגְרוֹן |
| `s1_14_48_valor` | reference | שְׁמוּאֵל א׳ יד, מח · I Samuel 14:48 | (full text; no display quote) |
| `s1_14_49_51_family` | reference | שְׁמוּאֵל א׳ יד, מט–נא · I Samuel 14:49-51 | (full text; no display quote) |
| `s1_15_12_monument` | reference | שְׁמוּאֵל א׳ טו, יב · I Samuel 15:12 | וְהִנֵּה מַצִּיב לוֹ יָד |
| `s1_15_22_obey` | reference | שְׁמוּאֵל א׳ טו, כב · I Samuel 15:22 | הִנֵּה שְׁמֹעַ מִזֶּבַח טוֹב לְהַקְשִׁיב מֵחֵלֶב אֵילִים |
| `s1_15_23_rejected` | reference | שְׁמוּאֵל א׳ טו, כג · I Samuel 15:23 | יַעַן מָאַסְתָּ אֶת־דְּבַר ה׳ וַיִּמְאָסְךָ מִמֶּלֶךְ |
| `s1_15_26_rejected` | reference | שְׁמוּאֵל א׳ טו, כו · I Samuel 15:26 | וַיִּמְאָסְךָ ה׳ מִהְיוֹת מֶלֶךְ עַל־יִשְׂרָאֵל |
| `s1_15_27_robe` | reference | שְׁמוּאֵל א׳ טו, כז · I Samuel 15:27 | וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ וַיִּקָּרַע |
| `s1_15_30_honor` | reference | שְׁמוּאֵל א׳ טו, ל · I Samuel 15:30 | כַּבְּדֵנִי נָא נֶגֶד זִקְנֵי־עַמִּי וְנֶגֶד יִשְׂרָאֵל |
| `s1_16_13_anointed` | reference | שְׁמוּאֵל א׳ טז, יג · I Samuel 16:13 | (full text; no display quote) |
| `s1_16_14_evil_spirit` | avoid-in-intro | שְׁמוּאֵל א׳ טז, יד · I Samuel 16:14 | (full text; no display quote) |
| `s1_16_18_david_skills` | reference | שְׁמוּאֵל א׳ טז, יח · I Samuel 16:18 | (full text; no display quote) |
| `s1_16_19_20_jesse_gift` | reference | שְׁמוּאֵל א׳ טז, יט–כ · I Samuel 16:19-20 | (full text; no display quote) |
| `s1_17_15_back_and_forth` | reference | שְׁמוּאֵל א׳ יז, טו · I Samuel 17:15 | (full text; no display quote) |
| `s1_17_38_39_armor` | reference | שְׁמוּאֵל א׳ יז, לח–לט · I Samuel 17:38-39 | (full text; no display quote) |
| `s1_17_42_ruddy_youth` | reference | שְׁמוּאֵל א׳ יז, מב · I Samuel 17:42 | כִּי־הָיָה נַעַר וְאַדְמֹנִי עִם־יְפֵה מַרְאֶה |
| `s1_18_10_11_spear` | avoid-in-intro | שְׁמוּאֵל א׳ יח, י–יא · I Samuel 18:10-11 | וְהַחֲנִית בְּיַד־שָׁאוּל |
| `s1_19_9_10_spear` | avoid-in-intro | שְׁמוּאֵל א׳ יט, ט–י · I Samuel 19:9-10 | וְהוּא בְּבֵיתוֹ יֹשֵׁב וַחֲנִיתוֹ בְּיָדוֹ |
| `s1_20_24_25_new_moon` | reference | שְׁמוּאֵל א׳ כ, כד–כה · I Samuel 20:24-25 | וַיֵּשֶׁב הַמֶּלֶךְ עַל־מוֹשָׁבוֹ כְּפַעַם בְּפַעַם אֶל־מוֹשַׁב הַקִּיר |
| `s1_21_8_doeg` | reference | שְׁמוּאֵל א׳ כא, ח · I Samuel 21:8 | וּשְׁמוֹ דֹּאֵג הָאֲדֹמִי אַבִּיר הָרֹעִים אֲשֶׁר לְשָׁאוּל |
| `s1_22_7_fields_vineyards` | reference | שְׁמוּאֵל א׳ כב, ז · I Samuel 22:7 | (full text; no display quote) |
| `s1_22_17_runners` | reference | שְׁמוּאֵל א׳ כב, יז · I Samuel 22:17 | וַיֹּאמֶר הַמֶּלֶךְ לָרָצִים הַנִּצָּבִים עָלָיו |
| `s1_24_5_corner` | reference | שְׁמוּאֵל א׳ כד, ה · I Samuel 24:5 | וַיִּכְרֹת אֶת־כְּנַף־הַמְּעִיל אֲשֶׁר־לְשָׁאוּל בַּלָּט |
| `s1_26_7_spear_ground` | reference | שְׁמוּאֵל א׳ כו, ז · I Samuel 26:7 | וַחֲנִיתוֹ מְעוּכָה־בָאָרֶץ מְרַאֲשֹׁתָיו |
| `s1_26_11_12_water_jug` | reference | שְׁמוּאֵל א׳ כו, יא–יב · I Samuel 26:11-12 | (full text; no display quote) |
| `s1_31_13_tamarisk_jabesh` | reference | שְׁמוּאֵל א׳ לא, יג · I Samuel 31:13 | (full text; no display quote) |
| `s2_1_10_diadem` | reference | שְׁמוּאֵל ב׳ א, י · II Samuel 1:10 | וָאֶקַּח הַנֵּזֶר אֲשֶׁר עַל־רֹאשׁוֹ וְאֶצְעָדָה אֲשֶׁר עַל־זְרֹעוֹ |
| `s2_1_21_22_shield_sword` | reference | שְׁמוּאֵל ב׳ א, כא–כב · II Samuel 1:21-22 | (full text; no display quote) |
| `s2_1_24_scarlet_gold` | reference | שְׁמוּאֵל ב׳ א, כד · II Samuel 1:24 | (full text; no display quote) |
| `s2_2_8_abner` | reference | שְׁמוּאֵל ב׳ ב, ח · II Samuel 2:8 | וְאַבְנֵר בֶּן־נֵר שַׂר־צָבָא אֲשֶׁר לְשָׁאוּל |
| `s2_5_6_jebus` | reference | שְׁמוּאֵל ב׳ ה, ו · II Samuel 5:6 | (full text; no display quote) |
| `s2_21_6_gibeah` | reference | שְׁמוּאֵל ב׳ כא, ו · II Samuel 21:6 | בְּגִבְעַת שָׁאוּל בְּחִיר ה׳ |
| `isa_10_29_gibeah` | reference | יְשַׁעְיָהוּ י, כט · Isaiah 10:29 | חָרְדָה הָרָמָה גִּבְעַת שָׁאוּל נָסָה |
| `josh_18_28_gibeath` | reference | יְהוֹשֻׁעַ יח, כח · Joshua 18:28 | (full text; no display quote) |
| `jdg_20_15_gibeah_men` | reference | שׁוֹפְטִים כ, טו · Judges 20:15 | (full text; no display quote) |
| `chr1_12_2_benjamin_archers` | reference | דִּבְרֵי הַיָּמִים א׳ יב, ב · I Chronicles 12:2 | (full text; no display quote) |
| `chr1_8_33_genealogy` | reference | דִּבְרֵי הַיָּמִים א׳ ח, לג · I Chronicles 8:33 | (full text; no display quote) |
| `s1_8_11_17_king_manner` | reference | שְׁמוּאֵל א׳ ח, יא–יז · I Samuel 8:11-17 | (full text; no display quote) |
| `exo_25_4_dyes` | reference | שְׁמוֹת כה, ד · Exodus 25:4 | (full text; no display quote) |
| `ruth_4_17_obed` | reference | רוּת ד, יז · Ruth 4:17 | עוֹבֵד הוּא אֲבִי־יִשַׁי אֲבִי דָוִד |
| `gen_35_20_pillar` | docs | בְּרֵאשִׁית לה, כ · Genesis 35:20 | וַיַּצֵּב יַעֲקֹב מַצֵּבָה עַל־קְבֻרָתָהּ |
| `readme_s1_16_12_admoni` | docs | שְׁמוּאֵל א׳ טז, יב · I Samuel 16:12 | אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי |
| `s2_23_15_well` | docs | שְׁמוּאֵל ב׳ כג, טו · II Samuel 23:15 | מִבֹּאר בֵּית־לֶחֶם אֲשֶׁר בַּשָּׁעַר |
| `num_15_38_tzitzit` | reference | בְּמִדְבַּר טו, לח · Numbers 15:38 | וְעָשׂוּ לָהֶם צִיצִת עַל־כַּנְפֵי בִגְדֵיהֶם לְדֹרֹתָם וְנָתְנוּ עַל־צִיצִת הַכָּנָף פְּתִיל תְּכֵלֶת |
| `deut_22_11_12_shaatnez_gedilim` | reference | דְּבָרִים כב, יא–יב · Deuteronomy 22:11-12 | (full text; no display quote) |
| `lev_19_27_beard` | reference | וַיִּקְרָא יט, כז · Leviticus 19:27 | (full text; no display quote) |
| `s1_17_5_7_goliath_armor` | reference | שְׁמוּאֵל א׳ יז, ה–ז · I Samuel 17:5-7 | (full text; no display quote) |
| `s1_14_1_armor_bearer` | reference | שְׁמוּאֵל א׳ יד, א · I Samuel 14:1 | הַנַּעַר נֹשֵׂא כֵלָיו |
| `s1_18_4_jonathan_gear` | reference | שְׁמוּאֵל א׳ יח, ד · I Samuel 18:4 | (full text; no display quote) |
| `s1_28_14_samuel_meil` | reference | שְׁמוּאֵל א׳ כח, יד · I Samuel 28:14 | אִישׁ זָקֵן עֹלֶה וְהוּא עֹטֶה מְעִיל |
| `s1_9_3_donkeys` | reference | שְׁמוּאֵל א׳ ט, ג · I Samuel 9:3 | (full text; no display quote) |
| `s1_17_17_18_provisions` | reference | שְׁמוּאֵל א׳ יז, יז–יח · I Samuel 17:17-18 | (full text; no display quote) |
| `s1_25_18_provisions` | reference | שְׁמוּאֵל א׳ כה, יח · I Samuel 25:18 | (full text; no display quote) |
| `s1_17_33_naar` | reference | שְׁמוּאֵל א׳ יז, לג · I Samuel 17:33 | כִּי־נַעַר אַתָּה |
| `s2_5_4_thirty` | reference | שְׁמוּאֵל ב׳ ה, ד · II Samuel 5:4 | (full text; no display quote) |
| `seder_olam_13_david_29` | reference | סֵדֶר עוֹלָם רַבָּה יג, ב · Seder Olam Rabbah 13:2 | ואותו הפרק נמשח דוד … והוא היה בן כ"ט שנים |
| `yoma_22b_one_year_old` | reference | יוֹמָא כב ע״ב · Yoma 22b:17 | (full text; no display quote) |
| `yoma_22b_no_blemish` | reference | יוֹמָא כב ע״ב · Yoma 22b:19 | מִפְּנֵי מָה לֹא נִמְשְׁכָה מַלְכוּת בֵּית שָׁאוּל — מִפְּנֵי שֶׁלֹּא הָיָה בּוֹ שׁוּם דּוֹפִי |
| `yoma_22b_one_sin` | reference | יוֹמָא כב ע״ב · Yoma 22b:10 | שָׁאוּל בְּאַחַת — וְעָלְתָה לוֹ. דָּוִד בִּשְׁתַּיִם — וְלֹא עָלְתָה לוֹ |
| `yoma_22b_forgave_honor` | reference | יוֹמָא כב ע״ב · Yoma 22b:20 | מִפְּנֵי מָה נֶעֱנַשׁ שָׁאוּל — מִפְּנֵי שֶׁמָּחַל עַל כְּבוֹדוֹ |
| `yoma_22b_amalek_mercy` | reference | יוֹמָא כב ע״ב · Yoma 22b:8 | (full text; no display quote) |
| `meg_13b_modesty` | reference | מְגִלָּה יג ע״ב · Megillah 13b:1 | וּבִשְׂכַר צְנִיעוּת שֶׁהָיָה בּוֹ בְּשָׁאוּל זָכָה וְיָצָאת מִמֶּנּוּ אֶסְתֵּר |
| `meg_13b_modesty_what` | reference | מְגִלָּה יג ע״ב · Megillah 13b:6 | (full text; no display quote) |
| `taan_5b_tamarisk` | reference | תַּעֲנִית ה ע״ב · Taanit 5b:6 | וְכִי מָה עִנְיַן גִּבְעָה אֵצֶל רָמָה? אֶלָּא לוֹמַר לְךָ: מִי גָּרַם לְשָׁאוּל שֶׁיָּשַׁב בַּגִּבְעָה שְׁתֵּי שָׁנִים וּמֶחֱצָה — תְּפִלָּתוֹ שֶׁל שְׁמוּאֵל הָרָמָתִי |
| `mk_16b_distinguished` | reference | מוֹעֵד קָטָן טז ע״ב · Moed Katan 16b:18 | מָה כּוּשִׁי מְשׁוּנֶּה בְּעוֹרוֹ — אַף שָׁאוּל מְשׁוּנֶּה בְּמַעֲשָׂיו |
| `mk_16b_had_you_been_saul` | reference | מוֹעֵד קָטָן טז ע״ב · Moed Katan 16b:17 | אִלְמָלֵי אַתָּה שָׁאוּל וְהוּא דָּוִד — אִיבַּדְתִּי כַּמָּה דָּוִד מִפָּנָיו |
| `brr_63_8_ruddy` | reference | בְּרֵאשִׁית רַבָּה סג, ח · Bereshit Rabbah 63:8 | וְכֵיוָן שֶׁרָאָה שְׁמוּאֵל אֶת דָּוִד אַדְמוֹנִי … נִתְיָרֵא וְאָמַר אַף זֶה שׁוֹפֵךְ דָּמִים כְּעֵשָׂו … עֵשָׂו מִדַּעַת עַצְמוֹ הוּא הוֹרֵג אֲבָל זֶה מִדַּעַת סַנְהֶדְרִין הוּא הוֹרֵג |
| `shr_2_2_moses_kid` | reference | שְׁמוֹת רַבָּה ב, ב · Shemot Rabbah 2:2 | הִרְכִּיבוֹ עַל כְּתֵפוֹ וְהָיָה מְהַלֵּךְ |
| `tj_s1_22_6_spear` | reference | תַּרְגּוּם יוֹנָתָן, שְׁמוּאֵל א׳ כב, ו · Targum Jonathan on I Samuel 22:6 | וּמוּרְנִיתֵיהּ בִּידֵיהּ |
| `tj_s1_16_12_ruddy` | reference | תַּרְגּוּם יוֹנָתָן, שְׁמוּאֵל א׳ טז, יב · Targum Jonathan on I Samuel 16:12 | וְהוּא סַמוֹק עֵינוֹהִי יָאִין וְשַׁפִּיר בְּרֵיוֵיהּ |
| `radak_s1_17_42_ruddy` | reference | רַדַ״ק, שְׁמוּאֵל א׳ יז, מב · Radak on I Samuel 17:42:1 | (full text; no display quote) |
| `rashi_s1_22_6_tamarisk` | reference | רַשִׁ״י, שְׁמוּאֵל א׳ כב, ו · Rashi on I Samuel 22:6:2 | (full text; no display quote) |
| `radak_s1_22_6_height` | reference | רַדַ״ק, שְׁמוּאֵל א׳ כב, ו · Radak on I Samuel 22:6:3 | (full text; no display quote) |
| `radak_s1_15_34_royal_house` | reference | רַדַ״ק, שְׁמוּאֵל א׳ טו, לד · Radak on I Samuel 15:34:1 | ובנה שם שאול בית מלוכה |
| `rashi_s1_20_25_reclining` | reference | רַשִׁ״י, שְׁמוּאֵל א׳ כ, כה · Rashi on I Samuel 20:25:2 | שֶׁדַּרְכָּן הָיָה לֶאֱכֹל מְסֻבִּין עַל הַמִּטּוֹת |
| `radak_s1_16_7_saul` | reference | רַדַ״ק, שְׁמוּאֵל א׳ טז, ז · Radak on I Samuel 16:7:2 | ושאול הוא שהיה יפה מראה וגבה קומה |
| `rashi_s1_17_38_garments` | reference | רַשִׁ״י, שְׁמוּאֵל א׳ יז, לח · Rashi on I Samuel 17:38:1 | (full text; no display quote) |
