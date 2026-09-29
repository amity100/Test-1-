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

## Rendering algorithms (post-processing) — `src/fx/PostFX.ts`, `src/fx/Bloom.ts`

Maintained by *mobile-render*. No third-party files or assets are shipped; the shaders are our own GLSL
implementations of published techniques:

| Technique | Origin | License of the reference | Where |
|---|---|---|---|
| FXAA 3.11 "quality" (edge search + sub-pixel AA) | Timothy Lottes / NVIDIA, *FXAA 3.11* (as also ported in three.js `examples/jsm/shaders/FXAAShader.js`) | NVIDIA BSD-style license (redistribution with notice); three.js MIT | `ResolvePass` in `src/fx/PostFX.ts` (reimplemented; variable names follow the reference) |
| Contrast-adaptive sharpening (5-tap variant) | AMD FidelityFX CAS | MIT | `ResolvePass` in `src/fx/PostFX.ts` (simplified reimplementation) |
| Dual-filter bloom (13-tap down-sample with Karis average, 3x3 tent up-sample) | J. Jimenez, *Next Generation Post Processing in Call of Duty: Advanced Warfare* (SIGGRAPH 2014) | technique (no code used) | `src/fx/Bloom.ts` |
| ACES / AgX / Neutral tone-mapping curves | three.js `tonemapping_pars_fragment` chunk (included at build time) | MIT (three.js) | `FinishPass` in `src/fx/PostFX.ts` |

The quality tiers, warm-up benchmark, texture-budget resampling, spatial chunking of instanced scenery
(`src/core/Engine.ts`), the frame watchdog (`src/fx/Watchdog.ts`) and the artifact packager
(`tools/package_artifact.py`, Python standard library only) are our own code. Test tooling (Playwright)
runs outside the project and is not shipped.

## Realistic humans (David, Saul, men) — `tools/human/`, `src/characters/human/`, `src/assets/human/`

Maintained by *human-core*. Built by `tools/human/build_human.py` and `tools/human/bake_skin.py` from the
MakeHuman 1.1 data set, downloaded from the official repository
(https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/…).

| Asset | Origin | License | Where used |
|---|---|---|---|
| hm08 base mesh (`data/3dobjs/base.obj`: body topology, UV layout, joint / eye / teeth / lash helpers) | MakeHuman — © Data Collection AB, Joel Palmius, Jonas Hauquier | **CC0 1.0** (MakeHuman `license.txt`, section C: "the assets have been released under CC0 1.0 Universal") | body geometry, UVs, joint positions of every preset |
| Morph targets (`data/targets/macrodetails/**`, head, forehead, eyebrows, eyes, nose, mouth, ears, chin, cheek, neck, torso, hip, stomach, pelvis, armslegs, breast, measure) and modifier definitions (`data/modifiers/*.json`) | MakeHuman | CC0 1.0 | preset shapes (`tools/human/presets/*.json`), anatomical region masks for the skin bake, variation morphs of the "man" preset |
| Default skeleton + skin weights (`data/rigs/default.mhskel`, `default_weights.mhw`) | MakeHuman | CC0 1.0 | runtime skeleton (pruned to 132 bones) and skin weights |
| Face pose units (`data/poseunits/face-poseunits.bvh`, `.json`) | MakeHuman | CC0 1.0 | facial expressions, blinking, jaw, lids (`HumanRig`) |
| High-poly eye proxy (`data/eyes/high-poly/*`) | MakeHuman | CC0 1.0 | reference only (eye placement); the shipped eyes are our own geometry |

Everything else — skin, eye, detail-normal textures, eyelash/eyebrow strands, teeth, tear lines and all
shaders — is generated procedurally by our own code (no photographs or third-party textures).
Only the math of MakeHuman's AGPL program logic (target weighting, skeleton construction, BVH axis
conversion, proxy fitting) was re-implemented; no MakeHuman source code is included.
Python tooling additionally uses numpy, scipy, Pillow, trimesh (MIT) and embreex (Apache-2.0) at build
time only; nothing from them ships in the game.

## Animals (Syrian brown bear, flock) — `tools/animals/`, `src/characters/BearModel.ts`, `src/characters/Flock.ts`, `src/assets/animals/`

Maintained by *animals*. **No third-party data, meshes, photos or textures are shipped.** The bear is sculpted
as signed-distance primitives in our own code (`tools/animals/bear_design.py`, `sdf.py`), and every texture
(albedo, normal, AO / roughness / fur-density mask, fur strand and clump maps) is painted or generated
procedurally by `bear_paint.py` / `fur_textures.py`. The sheep, goats and lamb are generated at runtime by
`Flock.ts` (procedural SDF + surface nets, no asset files). Build-time-only tools (nothing from them ships):

| Tool | Used for | License |
|---|---|---|
| numpy, scipy, Pillow | SDF evaluation, filtering, image output | BSD-3 / BSD-3 / MIT-CMU (HPND) |
| scikit-image (`measure.marching_cubes`) | iso-surface extraction of the bear sculpt | BSD-3 |
| fast-simplification | quadric decimation of the sculpt | MIT |
| xatlas-python | UV atlas | MIT |
| trimesh + embreex | per-vertex ambient occlusion rays | MIT / Apache-2.0 |
| meshoptimizer (npm) | LOD index buffers (`tools/animals/meshopt_lod.mjs`) | MIT |

Reference facts (not assets): body proportions and colouring of *Ursus arctos syriacus* from zoological
descriptions (pale straw / golden-tawny coat, darker legs, shoulder hump, ~1.0 m at the shoulder, ~2 m standing).
Realism pass (animals, 2nd session): re-sculpted bear skull (longer dished muzzle, brows, eyes seated on the
skull surface), longer legs, re-baked maps and a new coarse-lock fur shader; lamb face detail. Still entirely
our own code and procedural data: no new third-party assets or tools.

## Environment (Judean hills, Bethlehem, vegetation, sky) — `tools/world/`, `src/world/`, `src/assets/world/`

- **All world textures are our own procedural work** (no photographs, scans or third-party images):
  `tools/world/gen_world_textures.py` + `tools/world/texlib.py` generate the tileable limestone, dry-grass ground,
  terra rossa, wadi gravel, dry-stone wall, coursed masonry and olive bark materials (albedo + height in alpha,
  OpenGL normal + AO in alpha) and the foliage card atlases (olive, cypress, oak / terebinth / carob, shrubs,
  thistles, seed-head grasses) from periodic spectral noise and periodic Voronoi. `tools/world/make_lowres.py`
  derives the 512 px phone variants (per-channel resampling, so the alpha-packed data survives). Same license as the project.
- **All world geometry is generated at runtime by our own code**: terrain + terrace walls (`Terrain.ts`,
  `TerraceWalls.ts`), pitted limestone boulders / outcrops / rubble / pebbles (`RockGen.ts`, `Rocks.ts`), trees and
  shrubs (`TreeGen.ts`, `Vegetation.ts`), grass (`Grass.ts`), Bethlehem (`Village.ts`).
- Sky: single-scattering Rayleigh / Mie / ozone atmosphere ray-marched into a sky-view LUT (`Sky.ts`), after the
  published method of S. Hillaire, "A Scalable and Production Ready Sky and Atmosphere Rendering Technique"
  (EGSR 2020) and E. Bruneton & F. Neyret, "Precomputed Atmospheric Scattering" (2008) — algorithms only, no code
  copied. Standard physical constants (Rayleigh / ozone cross-sections, Mie g) from the scientific literature.
- Noise: simplex / value noise implementations are our own (`src/core/noise.ts`, `src/core/Shared.ts`).
- Historical / textual basis for Bethlehem ~1000 BCE (flat roofs with parapets — Deuteronomy 22:8; the well by the
  gate — 2 Samuel 23:15; Rachel's pillar on the road — Genesis 35:19-20; tabun bread ovens, pillared houses, no
  arches or domes) follows the general archaeological literature on Iron Age II Judah; no third-party assets.

## Saul's house at Gibeah (palace set) — `src/palace/`, `tools/palace/`, `src/assets/palace/`, `dev/palace*`

Maintained by *palace-set*. No third-party files or assets. Everything is our own code and procedurally generated data:

| Asset | Origin | License | Where used |
|---|---|---|---|
| `src/assets/palace/*.webp` (plaster, timber, beaten-earth floor, wool textile atlas + weave normal, tamarisk branchlet atlas, pottery clay, sheep fleece, reed/branch ceiling) | generated by `tools/palace/gen_palace_textures.py` (numpy / scipy / Pillow, seeded; no photographs, no scans) | our own work (project license) | `src/palace/palaceMaterials.ts` |
| World textures (limestone, masonry, dry-stone wall, ground, soil, gravel, bark, olive / cypress / shrub leaf atlases) | the environment teammate's generator (`tools/world/`), shared through `src/world/Textures.ts` | our own work | terrain, walls, rocks, trees of the set |
| Tree / rock generators (`TreeGen`, `RockGen`, `foliageMaterial`, `rockMaterial`, `gnarlyTube`) | reused from `src/world/` | our own work | olive groves, cypresses, pillar drums, boulders, tamarisk limbs |
| Sky / sun (`SkySystem`) and post chain (`PostFX`) | reused from `src/world/Sky.ts`, `src/fx/PostFX.ts` | our own work | lighting and rendering of the set |

Historical basis (not assets): `docs/sources.md` sections 3.3-3.5 and 4.1-4.5 (Gibeah of Saul / Tell el-Ful reconstruction as a
fortified stone residence, not a "palace"; open saucer lamps with one pinched spout; dyed wool hangings; no arches, marble,
glass windows, cedar panelling or ivory). Python tooling uses numpy, scipy and Pillow at build time only.

## Wardrobe (clothing, accessories, hand props) — `src/characters/wardrobe/`, `tools/wardrobe/`, `src/assets/wardrobe/`, `dev/wardrobe*`

Maintained by *wardrobe*. No third-party files or assets. Everything is our own code and procedurally generated data:

| Asset | Origin | License | Where used |
|---|---|---|---|
| `src/assets/wardrobe/*.webp` (coarse / medium / fine tileable weaves with thread coverage, normal, AO and height; frayed-fringe card; leather; 3-ply rope; braided sling cord; worn staff wood and bark; metal wear / scratch data) | generated by `tools/wardrobe/gen_textures.py` (numpy / Pillow, seeded; no photographs, no scans) | our own work (project license) | `src/characters/wardrobe/materials.ts` |
| Garment geometry (tunics, robes, sleeves, skirts, fringes, sashes, straps, sandals, diadem, armlet, belts, headbands) | fitted at load time from the MakeHuman (CC0) rest-pose body by `src/characters/wardrobe/{loft,garments,common}.ts` | our own work | `dressDavid`, `dressSaul`, `dressMan` |
| Props (staff, sling cradle, spear, sword + scabbard, dagger, shield, satchel) | procedural (`props.ts`, `david.ts`) | our own work | hand props / accessories |

Historical and textual basis (not assets): `docs/sources.md` 3.2, 3.5, 3.7, 4.3, 4.4 — wool-only (or linen-only) garments
(no sha'atnez, Deut 22:11), tzitzit with a tekhelet thread on four-cornered garments only (Num 15:38), murex purple
(argaman) / tekhelet / scarlet dyes (Timna textiles, ~1000 BCE), nezer as a thin band and etz'adah armlet (2 Sam 1:10),
socketed leaf-shaped spear heads with a butt spike (1 Sam 26:7), oiled leather shields (2 Sam 1:21), geometric (non-figurative) motifs.
`mergeGeometries` from three.js examples (MIT) is used for merging garment parts.
