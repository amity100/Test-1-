# Credits and licenses

Third-party data and assets used by DAVID. Each teammate maintains their own section.

## Source texts (quotations) — `src/content/sources*.ts`, `docs/sources.md`

Maintained by the *sources* tooling (`tools/sources/`). All texts are taken from Sefaria's public export
(index: https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json, files:
https://storage.googleapis.com/sefaria-export/json/...), normalized as documented in `docs/sources.md`.

| Text | Edition (Sefaria versionTitle) | License | Where used |
|---|---|---|---|
| Hebrew Bible (Tanakh) | *Miqra according to the Masorah* (MAM), Hebrew Wikisource (User:Dovi) — Aleppo Codex tradition | CC BY-SA (attribution: "Miqra according to the Masorah", he.wikisource.org / Sefaria). Our normalized excerpts (points kept, accents removed) are shared under the same license. | every verse shown in the game (`src/content/sources.ts`) |
| Hebrew Bible (cross-check) | *Tanach with Ta'amei Hamikra* — Westminster Leningrad Codex via tanach.us | Public Domain | verification only |
| Shemot Rabbah 2:2 | *Midrash Rabbah — TE* (Torat Emet freeware), vocalized | declared "unknown" on Sefaria; the underlying midrash text is public domain and its consonantal text is verified identical to the public-domain Daat edition | in-game midrash toast |
| Shemot Rabbah (cross-check) | *Daat Shemot Rabbah* (daat.ac.il) | Public Domain | verification only |
| Bereshit Rabbah 63:8 | *Midrash Rabbah — TE* | "unknown" | research catalog only (not shipped) |
| Seder Olam Rabbah 13 | *Seder Olam, Warsaw 1904* | Public Domain | research catalog only |
| Talmud Bavli (Yoma 22b, Megillah 13b, Taanit 5b, Moed Katan 16b) | *William Davidson Edition — Vocalized Aramaic* (Koren Noé Talmud, R. Adin Even-Israel Steinsaltz; vocalization by Dicta) | CC BY-NC | research catalog only (`sourcesReference.ts`, never imported by the game) |
| Targum Jonathan on I Samuel | *Mikraot Gedolot* | Public Domain | research catalog only |
| Rashi / Radak on I Samuel | *Sefaria vocalized edition* / *Radak on Nach* | "unknown" | research catalog only |

English glosses in the catalogs are our own short renderings (translation aids, not quotations).
